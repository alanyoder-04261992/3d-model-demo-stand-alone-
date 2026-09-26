/* RECORD EXACTLY WHAT BARNWRIGHT'S 3D DESIGNER DRAWS, AS THE "GOLDEN" ANSWERS.

   node tools/capture-golden.mjs            record every case into test/golden/
   node tools/capture-golden.mjs --check    record again into a temporary folder and
                                            prove it is byte-for-byte what is in
                                            test/golden/ (the capture is repeatable)
   options: --only=id,id   just these cases (the shared files are then only checked)
            --jobs=N       pages at once (default 2)

   What it does, in plain words: it opens Barnwright's own 3ddesign.html (read
   only -- see tools/lib/golden-page.mjs), and for each building in
   tools/lib/golden-cases.mjs it sets the building up through Barnwright's own
   buttons-in-code, then asks it to draw once more while listening to every
   triangle it draws. Each triangle is labelled with the real-life part it
   belongs to (tools/lib/barnwright-blocks.mjs). It writes:

     test/golden/geometry/<case>.json       the building's exact state, the canvas
                                            size, the camera fit, the ground radius,
                                            the draw order, every material's settings,
                                            and per material and per part the
                                            triangle count and a fingerprint (hash)
                                            of every vertex number
     test/golden/geometry-full/<case>.json  every vertex number itself, for six
                                            representative buildings
     test/golden/look/<case>.png            the finished picture, for 24 buildings
     test/golden/cases.json                 the list of cases with a line each
     test/golden/textures.json              a fingerprint of each seeded texture

   It fails (and writes nothing) if Barnwright's file is not the pinned copy,
   if any triangle cannot be labelled, if listening changed the drawing, if a
   texture came out different on any page load, or if the page reports an
   error. */

import { mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync, existsSync, mkdtempSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { inflateSync, deflateSync, constants as zc } from "node:zlib";
import {
  assertBarnwrightPinned, taggingTable, PART_IDS, BARNWRIGHT_SHA256, MKTEX_ENTRY_LINE,
} from "./lib/barnwright-blocks.mjs";
import {
  loadCatalogue, buildCases, hashFloats, roundFloat, segmentsOf, printsOf, LOOK_CAMERA,
  VERTEX_FLOATS, FLOATS_PER_TRIANGLE,
} from "./lib/golden-cases.mjs";
import {
  startServer, launchBrowser, openPage, textureReport, inPageRunSteps, inPageCapture, inPageLook,
  VIEWPORT, DEVICE_SCALE_FACTOR, PORT, TEXTURE_COUNT,
} from "./lib/golden-page.mjs";
import { textureSeed } from "../engine/seeded.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const GOLDEN = resolve(ROOT, "test/golden");

/* the buildings whose every vertex number is also kept: one per roof shape and the kennel */
export const FULL_CASES = Object.freeze(["ut-8x12", "lb-8x12", "cs-8x12", "bu-6x8", "ss-8x12", "dk-8x12"]);

const TEX_GLOBALS = ["texSiding", "texMetal", "texTrim", "texFlat", "texGrass", "texGlass", "texRoofMetal", "texRoofCap", "texAO", "texAOv", "texAOcorner"];
const TEX_NAMES = ["siding", "metal", "trim", "flat", "grass", "glass", "roofMetal", "roofCap", "ao", "aoV", "aoCorner"];

/* ---------------------------------------------------------------- arguments */
const args = process.argv.slice(2);
const flag = (name) => args.includes("--" + name);
const opt = (name, dflt) => { const a = args.find((x) => x.startsWith("--" + name + "=")); return a ? a.slice(name.length + 3) : dflt; };
const CHECK = flag("check");
const ONLY = opt("only", "") ? opt("only", "").split(",").map((s) => s.trim()).filter(Boolean) : null;
const JOBS = Math.max(1, Math.min(4, +opt("jobs", "2") || 2));

/* ---------------------------------------------------------------- output formatting */

/* JSON with small things on one line, so the files read well and diff well.
   Deterministic: the same value always gives the same text. */
function stringify(v, indent = "") {
  const flat = JSON.stringify(v);
  if (flat === undefined) return "null";
  if (flat.length <= 110 || v === null || typeof v !== "object") return flat;
  const inner = indent + " ";
  if (Array.isArray(v)) return "[\n" + v.map((x) => inner + stringify(x, inner)).join(",\n") + "\n" + indent + "]";
  const keys = Object.keys(v).filter((k) => v[k] !== undefined);
  return "{\n" + keys.map((k) => inner + JSON.stringify(k) + ": " + stringify(v[k], inner)).join(",\n") + "\n" + indent + "}";
}

/* ---------------------------------------------------------------- PNG, re-encoded canonically
   The browser's own PNG encoder is fast, not small, and its bytes could change
   with a browser update even when the picture does not. So the picture is
   decoded to its exact RGBA pixels and encoded again here, the same way every
   time (each row's filter chosen by the usual smallest-sum rule, deflate at
   level 9). The pixels are untouched. */
const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf) { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function paeth(a, b, c) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }

export function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error("not a PNG");
  let off = 8, w = 0, h = 0, depth = 0, ctype = 0, interlace = 0;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off), type = buf.toString("latin1", off + 4, off + 8), data = buf.subarray(off + 8, off + 8 + len);
    if (type === "IHDR") { w = data.readUInt32BE(0); h = data.readUInt32BE(4); depth = data[8]; ctype = data[9]; interlace = data[12]; }
    else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    off += 12 + len;
  }
  if (depth !== 8 || (ctype !== 6 && ctype !== 2) || interlace) throw new Error(`PNG kind not handled (depth ${depth}, colour type ${ctype}, interlace ${interlace})`);
  const ch = ctype === 6 ? 4 : 3, stride = w * ch, raw = inflateSync(Buffer.concat(idat));
  const px = Buffer.alloc(w * h * 4);
  let prev = Buffer.alloc(stride), cur = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let i = 0; i < stride; i++) {
      const a = i >= ch ? cur[i - ch] : 0, b = prev[i], c = i >= ch ? prev[i - ch] : 0;
      const x = row[i];
      cur[i] = (f === 0 ? x : f === 1 ? x + a : f === 2 ? x + b : f === 3 ? x + ((a + b) >> 1) : x + paeth(a, b, c)) & 255;
    }
    for (let x = 0; x < w; x++) {
      px[(y * w + x) * 4] = cur[x * ch]; px[(y * w + x) * 4 + 1] = cur[x * ch + 1]; px[(y * w + x) * 4 + 2] = cur[x * ch + 2];
      px[(y * w + x) * 4 + 3] = ch === 4 ? cur[x * ch + 3] : 255;
    }
    const t = prev; prev = cur; cur = t;
  }
  return { width: w, height: h, rgba: px };
}

export function encodePng(width, height, rgba) {
  const stride = width * 4, out = Buffer.alloc((stride + 1) * height), cand = [0, 1, 2, 3, 4].map(() => Buffer.alloc(stride));
  for (let y = 0; y < height; y++) {
    const row = rgba.subarray(y * stride, (y + 1) * stride), prev = y ? rgba.subarray((y - 1) * stride, y * stride) : null;
    let best = 0, bestSum = Infinity;
    for (let f = 0; f < 5; f++) {
      const o = cand[f]; let sum = 0;
      for (let i = 0; i < stride; i++) {
        const a = i >= 4 ? row[i - 4] : 0, b = prev ? prev[i] : 0, c = prev && i >= 4 ? prev[i - 4] : 0;
        const v = (row[i] - (f === 0 ? 0 : f === 1 ? a : f === 2 ? b : f === 3 ? ((a + b) >> 1) : paeth(a, b, c))) & 255;
        o[i] = v; sum += v < 128 ? v : 256 - v;
      }
      if (sum < bestSum) { bestSum = sum; best = f; }
    }
    out[y * (stride + 1)] = best;
    cand[best].copy(out, y * (stride + 1) + 1);
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, "latin1"), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(out, { level: 9, memLevel: 9, strategy: zc.Z_DEFAULT_STRATEGY })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const sha = (b) => createHash("sha256").update(b).digest("hex");

/* ---------------------------------------------------------------- one case */

function decode(b64) {
  const b = Buffer.from(b64, "base64");
  return new Float64Array(b.buffer, b.byteOffset, b.length / 8);
}

function fail(caseId, msg) { throw new Error(`[${caseId}] ${msg}`); }

async function runCase(browser, server, c, lookIds) {
  let p;
  try {
    p = await openPage(browser, server);
  } catch (e) {
    /* a busy machine can make one load slow; loading again changes nothing about what is recorded */
    process.stdout.write(`  (${c.id}: the page was slow to open, opening it again)\n`);
    p = await openPage(browser, server);
  }
  try {
    return await recordOn(p, c, lookIds);
  } catch (e) {
    throw new Error(`[${c.id}] ${e && e.message ? e.message : e}`);
  } finally {
    await p.close();
  }
}

async function recordOn(p, c, lookIds) {
  const ran = await p.page.evaluate(inPageRunSteps, { steps: c.steps });
  const cap = await p.page.evaluate(inPageCapture, taggingTable());
  let look = null;
  if (lookIds.has(c.id)) look = await p.page.evaluate(inPageLook, { ...LOOK_CAMERA });
  /* read last, so "Math.random called outside a texture" covers the whole
     recording (the steps, both builds and the picture), not only the page load */
  const tex = await textureReport(p.page);
  if (p.errors.length) fail(c.id, "Barnwright's page reported errors: " + p.errors.join(" | "));
  return { tex, ran, cap, look };
}

function processCase(c, r, full) {
  const { cap } = r;
  if (cap.problems.length) fail(c.id, cap.problems.join("; "));
  if (!cap.restored) fail(c.id, "Barnwright's functions were not all put back after the recording");
  if (c.expect && (cap.state.type !== c.expect.type || cap.state.size !== c.expect.size)) {
    fail(c.id, `expected ${c.expect.type} ${c.expect.size} but Barnwright is on ${cap.state.type} ${cap.state.size}`);
  }
  const selecting = c.steps.some((s) => s.op === "select");
  if (!selecting && cap.state.sel != null) fail(c.id, "something is still selected: " + cap.state.sel);
  if (selecting && cap.state.sel == null) fail(c.id, "the selection did not take");

  const buckets = [];
  const partTotals = {};
  let triTotal = 0;
  const fullBuckets = [];
  if (cap.plain.length !== cap.buckets.length) fail(c.id, "the unhooked build made a different number of materials");
  cap.buckets.forEach((b, bi) => {
    const v = decode(b.v);
    const plain = cap.plain[bi];
    if (plain.key !== b.key || plain.n !== b.n || plain.v !== b.v) fail(c.id, `listening changed the drawing of material ${b.key}`);
    const nTri = b.n / 3;
    if (v.length !== b.n * VERTEX_FLOATS || b.tags.length !== nTri) fail(c.id, `material ${b.key}: ${v.length} numbers for ${b.n} vertices and ${b.tags.length} labels`);
    b.tags.forEach((t, i) => {
      if (!PART_IDS.includes(t)) {
        const tri = Array.from(v.subarray(i * FLOATS_PER_TRIANGLE, i * FLOATS_PER_TRIANGLE + 9)).map(roundFloat);
        fail(c.id, `triangle ${i} of material ${b.key} has no part (${t}); its first corner is at ${tri.slice(0, 3).join(", ")}`);
      }
    });
    const parts = {};
    const byPart = new Map();
    b.tags.forEach((t, i) => {
      if (!byPart.has(t)) byPart.set(t, []);
      byPart.get(t).push(i);
    });
    for (const [part, tris] of byPart) {
      const fl = new Float64Array(tris.length * FLOATS_PER_TRIANGLE);
      tris.forEach((ti, k) => fl.set(v.subarray(ti * FLOATS_PER_TRIANGLE, (ti + 1) * FLOATS_PER_TRIANGLE), k * FLOATS_PER_TRIANGLE));
      parts[part] = { triangles: tris.length, hash: hashFloats(fl) };
      partTotals[part] = (partTotals[part] || 0) + tris.length;
    }
    triTotal += nTri;
    buckets.push({ key: b.key, params: b.params, triangles: nTri, hash: hashFloats(v), segments: segmentsOf(b.tags), parts, prints: printsOf(v) });
    if (full) fullBuckets.push({ key: b.key, triangles: nTri, segments: segmentsOf(b.tags), v: Array.from(v, roundFloat) });
  });
  if (JSON.stringify(cap.order) !== JSON.stringify(buckets.map((b) => b.key))) fail(c.id, "ORDER does not match the materials recorded");

  const out = {
    case: c.id,
    description: c.description,
    barnwright: { file: "boisterous-lokum-a737e0/public/3ddesign.html", sha256: BARNWRIGHT_SHA256 },
    steps: c.steps,
    viewport: { width: VIEWPORT.width, height: VIEWPORT.height, deviceScaleFactor: DEVICE_SCALE_FACTOR },
    canvas: cap.canvas,
    fitDist: cap.fitDist,
    gr: cap.gr,
    state: cap.state,
    order: cap.order,
    totals: { triangles: triTotal, materials: buckets.length },
    parts: Object.fromEntries(PART_IDS.filter((p) => partTotals[p]).map((p) => [p, partTotals[p]])),
    buckets,
  };
  let png = null;
  if (r.look) {
    const raw = Buffer.from(r.look.png.replace(/^data:image\/png;base64,/, ""), "base64");
    const img = decodePng(raw);
    if (img.width !== r.look.canvas.width || img.height !== r.look.canvas.height) fail(c.id, "the picture is not the canvas size");
    png = encodePng(img.width, img.height, img.rgba);
    if (!decodePng(png).rgba.equals(img.rgba)) fail(c.id, "the re-encoded picture does not decode to the same pixels");
    out.look = {
      file: "look/" + c.id + ".png",
      camera: r.look.camera,
      canvas: r.look.canvas,
      devicePixelRatio: 1,
      drawScale: r.look.dpr,
      hasShadow: r.look.hasShadow,
      DPRCAP: r.look.DPRCAP,
      scene: "studio",
      pixelsSha256: sha(img.rgba),
      how: "draw() twice (the first draw after a rebuild refuses its shadow pass in Barnwright, see tools/lib/golden-page.mjs inPageLook), " +
        "then canvas.toDataURL('image/png') in the same task; no WebGL error in the second draw; pixels re-encoded losslessly as RGBA PNG",
    };
    if (!r.look.hasShadow || r.look.DPRCAP !== 2) fail(c.id, "the picture was not drawn with shadows on and DPRCAP 2");
    if (r.look.glErrors.secondDraw.length) fail(c.id, "WebGL reported errors while drawing the picture: " + r.look.glErrors.secondDraw.join(","));
  }
  const fullOut = full ? { case: c.id, format: formatNote(), order: cap.order, buckets: fullBuckets } : null;
  return { json: out, png, full: fullOut };
}

function formatNote() {
  return "8 numbers per vertex (x y z nx ny nz u v), 3 vertices per triangle, in the order Barnwright drew them; " +
    "each number rounded as Math.round(x*1e4)/1e4 (-0 as 0). segments label runs of triangles {part, from, count} (in triangles).";
}

function fullText(f) {
  /* one material per line: the arrays are long */
  return "{\"case\":" + JSON.stringify(f.case) + ",\n\"format\":" + JSON.stringify(f.format) + ",\n\"order\":" + JSON.stringify(f.order) +
    ",\n\"buckets\":[\n" + f.buckets.map((b) => JSON.stringify(b)).join(",\n") + "\n]}\n";
}

/* ---------------------------------------------------------------- the run */

async function pool(items, n, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
  return results;
}

async function capture(outDir, onlyIds) {
  assertBarnwrightPinned();
  const catalogue = loadCatalogue();
  const all = buildCases(catalogue);
  const byId = new Map(all.map((c) => [c.id, c]));
  if (onlyIds) for (const id of onlyIds) if (!byId.has(id)) throw new Error("No case called " + id + ". The cases are listed in test/golden/cases.json.");
  const run = onlyIds ? all.filter((c) => onlyIds.includes(c.id)) : all;
  const lookIds = new Set(all.filter((c) => c.look).map((c) => c.id));

  const server = await startServer(PORT);
  const browser = await launchBrowser();
  const started = Date.now();
  let done = 0;
  let results;
  try {
    results = await pool(run, JOBS, async (c) => {
      const r = await runCase(browser, server, c, lookIds);
      /* boil it down straight away, so the raw vertex data of 148 buildings is never all in memory */
      const processed = processCase(c, r, FULL_CASES.includes(c.id));
      done++;
      if (done % 10 === 0 || done === run.length) process.stdout.write(`  ${done}/${run.length} buildings recorded\n`);
      return { tex: r.tex, canvas: r.cap.canvas, processed };
    });
  } finally {
    await browser.close();
    await server.stop();
  }

  /* the textures must be the same on every single page load */
  const first = results[0].tex;
  if (first.textures.length !== TEXTURE_COUNT || !first.globalsDefined) throw new Error("Barnwright did not make its 11 textures");
  if (first.mkTexEntries.join(",") !== "0,1,2,3,4,5,6,7,8,9,10") throw new Error("mkTex was not entered exactly 11 times in order: " + first.mkTexEntries.join(","));
  if (first.randomOutsideTextures !== 0) throw new Error("Barnwright called Math.random outside a texture " + first.randomOutsideTextures + " times");
  results.forEach((r, i) => {
    if (JSON.stringify(r.tex) !== JSON.stringify(first)) throw new Error(`[${run[i].id}] the seeded textures came out different on this page load`);
  });
  const canvas0 = JSON.stringify(results[0].canvas);
  results.forEach((r, i) => {
    if (JSON.stringify(r.canvas) !== canvas0) throw new Error(`[${run[i].id}] the canvas was a different size (${JSON.stringify(r.canvas)})`);
  });

  const processed = results.map((r) => r.processed);

  /* write */
  mkdirSync(join(outDir, "geometry"), { recursive: true });
  mkdirSync(join(outDir, "geometry-full"), { recursive: true });
  mkdirSync(join(outDir, "look"), { recursive: true });
  processed.forEach((p, i) => {
    const id = run[i].id;
    writeFileSync(join(outDir, "geometry", id + ".json"), stringify(p.json) + "\n");
    if (p.png) writeFileSync(join(outDir, "look", id + ".png"), p.png);
    if (p.full) writeFileSync(join(outDir, "geometry-full", id + ".json"), fullText(p.full));
  });
  const casesJson = {
    about: "The buildings recorded from Barnwright's 3D designer by tools/capture-golden.mjs. See test/golden/README.md.",
    barnwright: { file: "boisterous-lokum-a737e0/public/3ddesign.html", sha256: BARNWRIGHT_SHA256 },
    viewport: { width: VIEWPORT.width, height: VIEWPORT.height, deviceScaleFactor: DEVICE_SCALE_FACTOR },
    canvas: results[0].canvas,
    lookCamera: LOOK_CAMERA,
    count: all.length,
    cases: all.map((c) => ({ id: c.id, description: c.description, look: c.look, full: FULL_CASES.includes(c.id) })),
  };
  const texturesJson = {
    about: "One SHA-256 per procedural texture Barnwright paints when its page opens, with its random numbers seeded. See test/golden/README.md.",
    barnwright: { file: "boisterous-lokum-a737e0/public/3ddesign.html", sha256: BARNWRIGHT_SHA256 },
    seeding: `Math.random is replaced before Barnwright's scripts run. When mkTex creates its first canvas (line ${MKTEX_ENTRY_LINE}, the entry of one mkTex call) ` +
      "it is restarted as mulberry32(textureSeed(i)) from engine/seeded.js, i = 0 for the first texture made. mkTex's painter and height painter draw from that one stream.",
    read: "The bytes hashed are the ImageData mkTex hands to gl.texImage2D: width x height x RGBA, rows top to bottom, after its brightness normalising and height-in-alpha packing.",
    mathRandomCallsInsideTextures: first.randomInsideTextures,
    mathRandomCallsOutsideTextures: first.randomOutsideTextures,
    textures: first.textures.map((t, i) => ({ index: i, global: TEX_GLOBALS[i], name: TEX_NAMES[i], seed: textureSeed(i), size: t.size, sha256: t.sha256 })),
  };
  if (!onlyIds) {
    texturesJson.proof = `Identical on every one of the ${results.length} page loads of a full capture (one fresh page per case).`;
    writeFileSync(join(outDir, "cases.json"), stringify(casesJson) + "\n");
    writeFileSync(join(outDir, "textures.json"), stringify(texturesJson) + "\n");
    /* files for cases that no longer exist */
    const keep = new Set(all.map((c) => c.id));
    for (const [dir, ext] of [["geometry", ".json"], ["geometry-full", ".json"], ["look", ".png"]]) {
      for (const f of readdirSync(join(outDir, dir))) {
        if (f.endsWith(ext) && !keep.has(f.slice(0, -ext.length))) rmSync(join(outDir, dir, f));
      }
    }
  } else {
    /* a partial run must agree with the shared files already there */
    const tf = join(GOLDEN, "textures.json");
    if (existsSync(tf)) {
      const had = JSON.parse(readFileSync(tf, "utf8"));
      if (JSON.stringify(had.textures.map((t) => t.sha256)) !== JSON.stringify(texturesJson.textures.map((t) => t.sha256))) {
        throw new Error("The textures differ from test/golden/textures.json");
      }
    }
  }
  const secs = ((Date.now() - started) / 1000).toFixed(0);
  const tris = processed.reduce((a, p) => a + p.json.totals.triangles, 0);
  return { run, processed, secs, tris, all, textures: texturesJson };
}

function compareDirs(a, b, rel = "") {
  const diffs = [];
  const la = existsSync(join(a, rel)) ? readdirSync(join(a, rel), { withFileTypes: true }) : [];
  const lb = existsSync(join(b, rel)) ? readdirSync(join(b, rel), { withFileTypes: true }) : [];
  const names = new Set([...la.map((d) => d.name), ...lb.map((d) => d.name)]);
  for (const n of [...names].sort()) {
    const r = rel ? rel + "/" + n : n;
    const da = la.find((d) => d.name === n), db = lb.find((d) => d.name === n);
    if (!da || !db) { diffs.push(r + (da ? " is only in the fresh recording" : " is only in test/golden")); continue; }
    if (da.isDirectory()) { diffs.push(...compareDirs(a, b, r)); continue; }
    if (!readFileSync(join(a, r)).equals(readFileSync(join(b, r)))) diffs.push(r + " differs");
  }
  return diffs;
}

const OWNED = ["geometry", "geometry-full", "look", "cases.json", "textures.json"];

async function main() {
  if (CHECK) {
    const tmp = mkdtempSync(join(tmpdir(), "golden-check-"));
    try {
      const r = await capture(tmp, ONLY);
      const diffs = [];
      if (ONLY) {
        for (const id of ONLY) {
          for (const f of ["geometry/" + id + ".json", "geometry-full/" + id + ".json", "look/" + id + ".png"]) {
            const a = join(tmp, f), b = join(GOLDEN, f);
            if (existsSync(a) !== existsSync(b)) diffs.push(f + " exists on one side only");
            else if (existsSync(a) && !readFileSync(a).equals(readFileSync(b))) diffs.push(f + " differs");
          }
        }
      } else {
        for (const o of OWNED) {
          if (o.endsWith(".json")) {
            const a = join(tmp, o), b = join(GOLDEN, o);
            if (!existsSync(b)) diffs.push(o + " is missing from test/golden");
            else if (!readFileSync(a).equals(readFileSync(b))) diffs.push(o + " differs");
          } else {
            diffs.push(...compareDirs(join(tmp, o), join(GOLDEN, o)).map((d) => o + "/" + d));
          }
        }
      }
      if (diffs.length) {
        console.log("NOT REPEATABLE: recording Barnwright again gave different fixtures:");
        for (const d of diffs.slice(0, 40)) console.log("  " + d);
        process.exitCode = 1;
        return;
      }
      console.log(`PROVED: recording Barnwright again (${r.run.length} buildings, ${r.tris} triangles, ${r.secs} s) gives ` +
        `byte-for-byte the same fixtures as test/golden/ -- geometry, full vertex lists, look pictures${ONLY ? "" : ", cases.json and textures.json"}.`);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
    return;
  }
  const r = await capture(GOLDEN, ONLY);
  const looks = r.processed.filter((p) => p.png).length;
  const fulls = r.processed.filter((p) => p.full).length;
  console.log(`Recorded ${r.run.length} buildings from Barnwright's designer (SHA-256 ${BARNWRIGHT_SHA256.slice(0, 12)}...) in ${r.secs} s:`);
  console.log(`  ${r.tris} triangles, every one labelled with its part; listening changed nothing (each build was drawn twice and compared).`);
  console.log(`  ${looks} look pictures, ${fulls} full vertex lists.`);
  console.log(`  The 11 seeded textures came out identical on every page load${ONLY ? "" : " (" + r.run.length + " loads)"}.`);
  console.log(`  Written to test/golden/ (geometry/, geometry-full/, look/${ONLY ? "" : ", cases.json, textures.json"}).`);
}

/* Only when run as a command. decodePng / encodePng are exported for the
   picture checks; importing this file for them must never start a recording
   (which would write over test/golden/). */
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error("CAPTURE FAILED: " + (e && e.message ? e.message : e));
    process.exitCode = 1;
  });
}
