/* CHECK: our designer's finished pictures are Barnwright's pictures, pixel for pixel.
   Run: node tools/check-look.mjs [--case ut-10x20,lb-10x20]
   (check-all: browser -- it opens headless Chromium with software graphics.)

   WHY. Alan's first ask was "make it look like Barnwright's". The golden test
   (tools/check-golden.mjs) already proves our engine builds the same
   TRIANGLES as Barnwright. This check proves the last step: the PICTURE a
   customer sees is the same. test/golden/look/ holds 24 pictures recorded
   from Barnwright's own 3D designer (every style at its usual size, and the
   Utility Shed with its doors selected -- the blue glow). This check draws
   the same 24 buildings with our engine on tools/look.html, set up exactly as
   Barnwright's page was for the recording (test/golden/README.md: a 742 x 803
   picture drawn 1.5 times bigger, the same camera, shadows forced on, the
   watchdogs frozen, the studio scene, the textures painted with the same
   repeatable "random" numbers), and compares every pixel.

   WHAT IT PROVES, in order:
   1. the eleven surface pictures our page paints are the exact bytes
      Barnwright painted for the recording (test/golden/textures.json);
   2. for each of the 24 buildings: the same picture size, camera fit, lawn
      size and camera; no graphics error; our FIRST draw is the picture (a
      second draw gives the same one -- Barnwright needed two, see
      docs/DIFFERENCES.md #1); and EVERY PIXEL is identical to Barnwright's.
      When one is not, it says how many pixels differ and by how much, and
      writes a picture to test/out/look-diff/<case>.png: Barnwright's | ours |
      where they differ (red, brighter = bigger difference);
   3. the comparison CAN fail: the same Utility Shed with its trim one step
      of blue different, or the camera turned a thousandth of a radian, is
      caught (test/out/look-control-diff.png shows the second);
   4. the TRUE-COLOUR switch (a company's look.trueColour) changes colour and
      nothing else: the demo company's opening building drawn both ways has
      the same drawing to the last number (checked without a browser), the
      same see-through outline to the last pixel (the alpha channel), and
      different colours, with the warm cast gone
      (test/out/look-truecolour.png: warm | true colour);
   5. a Finished-view rebuild of the biggest Utility Shed (14x40) stays inside
      a loose time bound on this software-graphics machine (the phone budget
      in docs/ARCHITECTURE.md is 45 ms on real hardware; the time is printed);
   6. the picture was drawn on a graphics context our own engine/gl.js asked
      for, with Barnwright's settings (the harness never asks first: the
      browser keeps the settings of the first request), and every file the
      page loaded is this copy's own file, byte for byte (a web server left
      running from another copy of the repo cannot stand in for this one).
   Also writes test/out/look-contact.png: our 24 pictures, a quarter size, on
   the studio backdrop -- one glance at every style.

   Uses port 8360 (tools/lib/look-page.mjs). Exits non-zero on any failure. */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { openLook, ROOT } from "./lib/look-page.mjs";
import { decodePng, encodePng } from "./capture-golden.mjs";
import { readGoldenCases, readGoldenCase } from "./lib/golden-cases.mjs";
import { loadCatalogue } from "./lib/load.mjs";
import { makePlan } from "../model/plan.js";
import { assemble } from "../engine/assemble.js";
import { sceneFor } from "../engine/scene-data.js";

const args = process.argv.slice(2);
const caseArg = (() => {
  const i = args.indexOf("--case");
  const v = i >= 0 ? args[i + 1] : (args.find((a) => a.startsWith("--case=")) || "").slice(7);
  return v ? v.split(",").map((s) => s.trim()).filter(Boolean) : null;
})();

const OUT = resolve(ROOT, "test/out");
const DIFF_DIR = resolve(OUT, "look-diff");
/* the studio backdrop behind the see-through canvas (engine/scene-data.js: fogC 0.9137 = #E9E9E5) */
const BACKDROP = [0xE9, 0xE9, 0xE5];
/* a Finished rebuild on this software-graphics machine must stay under this */
const REBUILD_BOUND_MS = 200;
const REBUILD_BUDGET_MS = 45;

let pass = 0, fail = 0;
const failures = [];
function ok(name, cond, extra) {
  if (cond) { pass++; console.log("  ok   " + name); }
  else { fail++; failures.push(name); console.log("  FAIL " + name + (extra ? "\n       " + String(extra).slice(0, 900) : "")); }
}
const sha = (b) => createHash("sha256").update(b).digest("hex");

/* ---------------------------------------------------------------- pictures */

/* Every pixel of two same-size RGBA pictures: how many differ, the biggest
   difference in any one channel, and a per-pixel map of the biggest one. */
function comparePixels(a, b) {
  if (a.width !== b.width || a.height !== b.height) return { sameSize: false, differing: -1, maxDiff: -1, map: null };
  const n = a.width * a.height, map = new Uint8Array(n);
  let differing = 0, maxDiff = 0;
  for (let p = 0, i = 0; p < n; p++, i += 4) {
    let m = 0;
    for (let k = 0; k < 4; k++) { const d = Math.abs(a.rgba[i + k] - b.rgba[i + k]); if (d > m) m = d; }
    if (m) { differing++; if (m > maxDiff) maxDiff = m; map[p] = m; }
  }
  return { sameSize: true, differing, maxDiff, map };
}

/* A pixel of a see-through picture laid on the studio backdrop, as the page shows it
   (`back` is another backdrop colour: the true-colour studio's is neutral grey). */
function onBackdrop(img, p, back) {
  const i = p * 4, a = img.rgba[i + 3] / 255, bg = back || BACKDROP;
  return [0, 1, 2].map((k) => Math.round(img.rgba[i + k] * a + bg[k] * (1 - a)));
}

/* Panels side by side, each shrunk by `scale` (1, 2, 4 ...: a box average). */
function sideBySide(panels, scale) {
  const pw = Math.floor(panels[0].width / scale), ph = Math.floor(panels[0].height / scale), gap = Math.max(4, 12 / scale | 0);
  const W = pw * panels.length + gap * (panels.length - 1), H = ph;
  const out = Buffer.alloc(W * H * 4);
  for (let i = 0; i < out.length; i += 4) { out[i] = 255; out[i + 1] = 255; out[i + 2] = 255; out[i + 3] = 255; }
  panels.forEach((pan, n) => {
    for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) {
      const acc = [0, 0, 0];
      for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
        const c = pan.pixel((y * scale + dy) * pan.width + (x * scale + dx));
        acc[0] += c[0]; acc[1] += c[1]; acc[2] += c[2];
      }
      const o = (y * W + n * (pw + gap) + x) * 4, s2 = scale * scale;
      out[o] = Math.round(acc[0] / s2); out[o + 1] = Math.round(acc[1] / s2); out[o + 2] = Math.round(acc[2] / s2); out[o + 3] = 255;
    }
  });
  return encodePng(W, H, out);
}
const asPanel = (img, back) => ({ width: img.width, height: img.height, pixel: (p) => onBackdrop(img, p, back) });
/* where each panel of sideBySide(panels, scale) starts, for its label */
function panelLefts(panels, scale) {
  const pw = Math.floor(panels[0].width / scale), gap = Math.max(4, 12 / scale | 0);
  return panels.map((_, n) => n * (pw + gap));
}

/* WORDS ON THE PICTURES, so Alan can tell what he is looking at without this
   file: each picture is handed to the harness page, which writes the labels
   with a canvas (it can draw text; this file cannot) and hands it back. The
   words come from our own golden files, never from a visitor, and are drawn,
   not put into HTML. Only the pictures in test/out/ get words -- the
   comparison never reads them. Any trouble: the picture without words. */
async function labelled(png, labels) {
  try {
    if (!h || !h.page || h.page.isClosed()) return png;
    const url = "data:image/png;base64," + png.toString("base64");
    const out = await h.page.evaluate(async ({ url, labels }) => {
      const img = new Image(); img.src = url; await img.decode();
      const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
      const x = c.getContext("2d"); x.drawImage(img, 0, 0);
      x.font = "600 13px system-ui, sans-serif"; x.textBaseline = "top";
      for (const l of labels) {
        const lines = String(l.text).split("\n");
        const w = Math.ceil(Math.max(...lines.map((t) => x.measureText(t).width))) + 12;
        x.fillStyle = "rgba(255,255,255,0.9)"; x.fillRect(l.x + 6, l.y + 6, w, 5 + 16 * lines.length);
        x.fillStyle = "#1d2a33"; lines.forEach((t, i) => x.fillText(t, l.x + 12, l.y + 10 + 16 * i));
      }
      return c.toDataURL("image/png");
    }, { url, labels });
    const img = decodePng(Buffer.from(out.replace(/^data:image\/png;base64,/, ""), "base64"));
    return encodePng(img.width, img.height, img.rgba);
  } catch { return png; }
}
/* "Utility Shed 10x20 (typical size) with ..." -> "Utility Shed 10x20"; a second line for what is special */
const shortName = (fx) => String(fx.description || fx.case || "").split(" (")[0].replace(/ with its (.+)$/, "\n$1 (the blue glow)");
/* where two pictures differ: red, brighter the bigger the difference, over a pale copy of the first */
function diffPanel(a, cmp) {
  return {
    width: a.width, height: a.height,
    pixel: (p) => {
      const m = cmp.map[p];
      if (m) { const v = Math.min(255, 110 + m * 4); return [v, 0, 0]; }
      const c = onBackdrop(a, p), l = (c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722) / 4 + 190;
      return [l, l, l];
    },
  };
}

/* ---------------------------------------------------------------- the run */

const index = readGoldenCases();
const lookIds = index.cases.filter((c) => c.look).map((c) => c.id);
if (caseArg) for (const id of caseArg) if (!lookIds.includes(id)) { console.log(`FAIL: "${id}" is not one of the ${lookIds.length} buildings with a look picture: ${lookIds.join(", ")}.`); process.exit(1); }
const ids = caseArg || lookIds;
const texturesGolden = JSON.parse(readFileSync(resolve(ROOT, "test/golden/textures.json"), "utf8"));

mkdirSync(OUT, { recursive: true });
mkdirSync(DIFF_DIR, { recursive: true });
/* old difference pictures would look like today's failures: start clean (only this check writes there) */
for (const f of readdirSync(DIFF_DIR)) if (f.endsWith(".png")) rmSync(resolve(DIFF_DIR, f));

console.log("check-look: our engine's pictures against Barnwright's recorded pictures\n");
const t0 = Date.now();
let h;
const results = [];
const ours = new Map();
let firstAttrs = null;
try {
  h = await openLook();
  const styles = await h.useBarnwright();
  ok(`the harness page opened and resolved the Barnwright company (served as JSON: ${styles} styles)`, styles > 20);

  /* ---------- the 24 pictures ---------- */
  console.log(`\nThe ${ids.length} recorded buildings, drawn by our engine`);
  for (const id of ids) {
    const fx = readGoldenCase(id);
    const L = fx.look;
    const golden = decodePng(readFileSync(resolve(ROOT, "test/golden", L.file)));
    const goldenOk = sha(golden.rgba) === L.pixelsSha256;
    const s = Date.now();
    const pic = await h.draw({
      company: "barnwright", state: fx.state,
      size: { w: L.canvas.clientWidth, h: L.canvas.clientHeight },
      fit: "barnwright", scene: L.scene, trueColour: false,
      camera: { yaw: L.camera.yaw, pitch: L.camera.pitch, distOverFit: L.camera.distOverFit },
      stages: "finished", again: true,
    });
    const secs = (Date.now() - s) / 1000;
    const I = pic.info;
    if (!firstAttrs) firstAttrs = I.contextAttributes;
    const cmp = comparePixels(golden, pic);
    ours.set(id, pic);
    const errs = [].concat(I.glErrors.before, I.glErrors.first, I.glErrors.second);
    const setupOk = goldenOk && I.drew && I.againSame === true && errs.length === 0 && I.hasShadow &&
      pic.width === L.canvas.width && pic.height === L.canvas.height &&
      I.canvas.clientWidth === L.canvas.clientWidth && I.canvas.clientHeight === L.canvas.clientHeight &&
      I.fitDist === fx.fitDist && I.gr === fx.gr && I.camera.dist === L.camera.dist && I.camera.yaw === L.camera.yaw && I.camera.pitch === L.camera.pitch;
    const why = [];
    if (!goldenOk) why.push("the golden picture file does not decode to its recorded fingerprint");
    if (!I.drew) why.push("nothing was drawn");
    if (I.againSame !== true) why.push("a second draw gave a different picture");
    if (errs.length) why.push("WebGL errors " + errs.join(","));
    if (!I.hasShadow) why.push("shadows were not on");
    if (pic.width !== L.canvas.width || pic.height !== L.canvas.height) why.push(`picture ${pic.width}x${pic.height}, Barnwright's ${L.canvas.width}x${L.canvas.height}`);
    if (I.fitDist !== fx.fitDist) why.push(`camera fit ${I.fitDist} vs ${fx.fitDist}`);
    if (I.gr !== fx.gr) why.push(`lawn radius ${I.gr} vs ${fx.gr}`);
    if (I.camera.dist !== L.camera.dist) why.push(`camera distance ${I.camera.dist} vs ${L.camera.dist}`);
    ok(`${id}: drawn the recording's way (${pic.width}x${pic.height}, fit ${I.fitDist}, lawn ${I.gr}, shadows on, no WebGL error, first draw = second draw)`, setupOk, why.join("; "));
    const total = golden.width * golden.height;
    const same = cmp.sameSize && cmp.differing === 0;
    let drawn = 0; for (let i = 3; i < pic.rgba.length; i += 4) if (pic.rgba[i]) drawn++;
    let note = "";
    if (!same && cmp.sameSize) {
      const file = resolve(DIFF_DIR, id + ".png");
      const panels = [asPanel(golden), asPanel(pic), diffPanel(golden, cmp)], at = panelLefts(panels, 1);
      writeFileSync(file, await labelled(sideBySide(panels, 1), [
        { x: at[0], y: 0, text: "Barnwright's picture: " + shortName(fx) }, { x: at[1], y: 0, text: "ours" },
        { x: at[2], y: 0, text: "where they differ (red: brighter = bigger)" }]));
      note = `${cmp.differing} of ${total} pixels differ, by up to ${cmp.maxDiff} (of 255) in one channel; picture: test/out/look-diff/${id}.png`;
    }
    ok(`${id}: every one of the ${total} pixels identical to Barnwright's (${drawn} of them drawn on, ${I.triangles} triangles, ${secs.toFixed(1)} s)`, same, note || (cmp.sameSize ? "" : "the pictures are different sizes"));
    results.push({ id, same, differing: cmp.differing, maxDiff: cmp.maxDiff, secs, size: pic.width + "x" + pic.height });
  }

  /* nothing recorded was left out: every picture in test/golden/look/ is one of the cases compared */
  if (!caseArg) {
    const files = readdirSync(resolve(ROOT, "test/golden/look")).filter((f) => f.endsWith(".png")).map((f) => f.slice(0, -4)).sort();
    const missing = files.filter((f) => !ids.includes(f)), noFile = ids.filter((id) => !files.includes(id));
    ok(`every one of the ${files.length} pictures in test/golden/look/ was compared (the README promises 24), and every case compared has its picture`,
      files.length >= 24 && missing.length === 0 && noFile.length === 0, `not compared: ${missing.join(", ") || "none"}; no picture: ${noFile.join(", ") || "none"}`);
  }

  /* the graphics context was asked for by OUR renderer (engine/gl.js), with Barnwright's settings */
  const A = firstAttrs || {};
  ok(`the 3D picture was drawn on a graphics context with Barnwright's settings, asked for by our own engine/gl.js (antialiasing on, see-through, premultiplied, not kept between frames)`,
    A.antialias === true && A.alpha === true && A.premultipliedAlpha === true && A.preserveDrawingBuffer === false, JSON.stringify(A));

  /* ---------- the textures ---------- */
  console.log("\nThe surface pictures (textures)");
  const tex = await h.textures();
  const warm = tex.filter((t) => t.context === "warm");
  const want = texturesGolden.textures;
  const texBad = want.filter((w, i) => !warm[i] || warm[i].sha256 !== w.sha256 || warm[i].w !== w.size[0] || warm[i].h !== w.size[1]).map((w) => w.name);
  ok(`all ${want.length} textures our page painted are Barnwright's exact bytes, in order (${want.map((w) => w.name).join(", ")})`, warm.length === want.length && texBad.length === 0,
    texBad.length ? "different: " + texBad.join(", ") : `${warm.length} painted`);

  /* ---------- the comparison can fail ---------- */
  console.log("\nControls: the comparison can fail");
  {
    const fx = readGoldenCase("ut-10x20"), L = fx.look;
    const golden = decodePng(readFileSync(resolve(ROOT, "test/golden", L.file)));
    const base = { company: "barnwright", size: { w: L.canvas.clientWidth, h: L.canvas.clientHeight }, fit: "barnwright", scene: "studio", trueColour: false, stages: "finished" };
    const trim = fx.state.trim;
    const nudged = trim.slice(0, 5) + ((parseInt(trim.slice(5), 16) + 1) & 255).toString(16).padStart(2, "0");
    const c1 = await h.draw(Object.assign({}, base, { state: Object.assign({}, fx.state, { trim: nudged }), camera: { yaw: L.camera.yaw, pitch: L.camera.pitch, distOverFit: 1 } }));
    const d1 = comparePixels(golden, c1);
    const said = (d) => d.sameSize ? `${d.differing} pixels differ` : "the picture is a different size";
    ok(`the Utility Shed 10x20 with its trim ${trim} -> ${nudged} (one step of blue) is caught: ${said(d1)}`, d1.sameSize && d1.differing > 1000);
    const c2 = await h.draw(Object.assign({}, base, { state: fx.state, camera: { yaw: L.camera.yaw + 0.001, pitch: L.camera.pitch, distOverFit: 1 } }));
    const d2 = comparePixels(golden, c2);
    ok(`the same shed with the camera turned 0.001 radian (under a tenth of a degree) is caught: ${said(d2)}`, d2.sameSize && d2.differing > 1000);
    if (d2.sameSize) {
      const panels = [asPanel(golden), asPanel(c2), diffPanel(golden, d2)], at = panelLefts(panels, 2);
      writeFileSync(resolve(OUT, "look-control-diff.png"), await labelled(sideBySide(panels, 2), [
        { x: at[0], y: 0, text: "Barnwright's picture" }, { x: at[1], y: 0, text: "ours, camera turned 0.001 radian ON PURPOSE" },
        { x: at[2], y: 0, text: "where they differ (red) -- the check catches it" }]));
    }
  }

  /* ---------- true colour changes colour only ---------- */
  console.log("\nThe true-colour switch (look.trueColour) changes colour, not the building");
  const demo = await h.useCompany("demo");
  const state = await h.defaultState("demo");
  const tc = { company: "demo", state, size: { w: 742, h: 803 }, fit: "fitref", scene: demo.look.scene || "studio", camera: { yaw: 0.62, pitch: 0.215, distOverFit: 1 }, stages: "finished" };
  /* the drawing itself, without a browser: every number the same both ways */
  const cat = loadCatalogue("demo");
  const plan = makePlan(state, cat);
  const rw = assemble(plan, { viewport: tc.size, fit: "fitref", scene: tc.scene, trueColour: false });
  const rt = assemble(plan, { viewport: tc.size, fit: "fitref", scene: tc.scene, trueColour: true });
  let floatsSame = JSON.stringify(rw.ORDER) === JSON.stringify(rt.ORDER), nFloats = 0;
  const paramDiffs = [];
  for (const k of rw.ORDER) {
    const a = rw.build.buckets[k], b = rt.build.buckets[k];
    if (!b || a.n !== b.n || a.v.length !== b.v.length) { floatsSame = false; continue; }
    for (let i = 0; i < a.v.length; i++) if (!Object.is(a.v[i], b.v[i])) { floatsSame = false; break; }
    nFloats += a.v.length;
    for (const p of ["tex", "spec", "gloss", "glow", "bump", "unlit", "noCast", "age", "glassM", "turf"]) if (a[p] !== b[p]) paramDiffs.push(k + "." + p);
    if (JSON.stringify(a.tint) !== JSON.stringify(b.tint)) paramDiffs.push(k + ".tint");
  }
  const onlyGround = paramDiffs.every((p) => /\.tint$/.test(p));
  ok(`${state.type} ${state.size} (the demo's opening building): both ways draw the same ${rw.ORDER.length} materials in the same order, all ${nFloats} vertex numbers identical`, floatsSame && nFloats > 10000 && rw.fitDist === rt.fitDist && rw.gr === rt.gr);
  ok(`the only material setting that changes is a paint colour (${paramDiffs.join(", ") || "none"} -- the studio floor turns neutral grey)`, onlyGround && paramDiffs.length <= 2);
  const warmPic = await h.draw(Object.assign({}, tc, { trueColour: false }));
  const truePic = await h.draw(Object.assign({}, tc, { trueColour: true }));
  let alphaSame = warmPic.rgba.length === truePic.rgba.length, cover = 0, coverSame = alphaSame, rgbDiff = 0;
  let warmRB = 0, trueRB = 0;
  if (alphaSame) {
    for (let i = 0; i < warmPic.rgba.length; i += 4) {
      const aw = warmPic.rgba[i + 3], at = truePic.rgba[i + 3];
      if (aw !== at) alphaSame = false;
      if ((aw > 0) !== (at > 0)) coverSame = false;
      if (aw === 255 && at === 255) {
        cover++;
        if (warmPic.rgba[i] !== truePic.rgba[i] || warmPic.rgba[i + 1] !== truePic.rgba[i + 1] || warmPic.rgba[i + 2] !== truePic.rgba[i + 2]) rgbDiff++;
        warmRB += warmPic.rgba[i] - warmPic.rgba[i + 2];
        trueRB += truePic.rgba[i] - truePic.rgba[i + 2];
      }
    }
  }
  ok(`the see-through outline (every pixel's alpha, ${warmPic.width}x${warmPic.height}) is identical both ways -- same shape, same edges`, alphaSame && coverSame);
  ok(`the colours differ: ${rgbDiff} of the ${cover} solid pixels changed colour`, cover > 100000 && rgbDiff > cover * 0.5);
  const mw = cover ? warmRB / cover : 0, mt = cover ? trueRB / cover : 0;
  ok(`the warm cast is gone: red minus blue averages ${mw.toFixed(1)} warm, ${mt.toFixed(1)} true colour`, mw > mt + 3);
  /* each on its own scene's backdrop, as the designer page shows it (the true-colour studio's is neutral grey) */
  const backOf = (tcOn) => sceneFor(tc.scene, tcOn).fogC.map((v) => Math.round(v * 255));
  const tcPanels = [asPanel(warmPic, backOf(false)), asPanel(truePic, backOf(true))], tcAt = panelLefts(tcPanels, 2);
  writeFileSync(resolve(OUT, "look-truecolour.png"), await labelled(sideBySide(tcPanels, 2), [
    { x: tcAt[0], y: 0, text: "true colour OFF (Barnwright's warm light)" }, { x: tcAt[1], y: 0, text: "true colour ON (look.trueColour: true)" }]));

  /* ---------- the cost of a rebuild ---------- */
  console.log("\nThe cost of a Finished-view rebuild");
  const big = readGoldenCase("ut-14x40");
  const times = await h.rebuildTime({ company: "barnwright", state: big.state, size: { w: 742, h: 803 }, fit: "barnwright", scene: "studio", trueColour: false, runs: 7 });
  const sorted = times.slice().sort((a, b) => a - b), median = sorted[sorted.length >> 1];
  ok(`a 14x40 Utility Shed rebuild (plan + every part + upload) takes ${median.toFixed(1)} ms (median of ${times.length}) -- under the ${REBUILD_BOUND_MS} ms bound for this software-graphics machine` +
    `${median <= REBUILD_BUDGET_MS ? ` and inside the ${REBUILD_BUDGET_MS} ms phone budget` : ` (the ${REBUILD_BUDGET_MS} ms budget is for real hardware)`}`, median < REBUILD_BOUND_MS, times.map((t) => t.toFixed(1)).join(", "));

  console.log("\nWhat the page was made of");
  ok(`every one of the ${h.checkedFiles.size} files the page loaded is this copy's own file, byte for byte (so a web server left running from another copy cannot stand in for this one)`,
    h.checkedFiles.size > 20 && h.notOurs.length === 0, h.notOurs.join(", "));
  ok("the harness page raised no errors", h.errors.length === 0, h.errors.join(" | "));
} catch (e) {
  ok("the look check ran to the end", false, e && e.stack ? e.stack : e);
} finally {
  if (h) {
    try { await writeContact(); } catch (e) { console.log("  (the contact sheet could not be written: " + (e && e.message) + ")"); }
    await h.close();
  }
}

/* ---------- a contact sheet of our pictures, each with its name ---------- */
async function writeContact() {
  if (!ours.size) return;
  const list = ids.filter((id) => ours.has(id)).map((id) => ours.get(id));
  const cols = Math.min(6, list.length), rows = Math.ceil(list.length / cols), sc = 4;
  const tw = Math.floor(list[0].width / sc), th = Math.floor(list[0].height / sc);
  const W = cols * tw, H = rows * th, out = Buffer.alloc(W * H * 4);
  for (let p = 0; p < W * H; p++) { out[p * 4] = BACKDROP[0]; out[p * 4 + 1] = BACKDROP[1]; out[p * 4 + 2] = BACKDROP[2]; out[p * 4 + 3] = 255; }
  list.forEach((img, n) => {
    const ox = (n % cols) * tw, oy = Math.floor(n / cols) * th;
    for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
      const acc = [0, 0, 0];
      for (let dy = 0; dy < sc; dy++) for (let dx = 0; dx < sc; dx++) { const c = onBackdrop(img, (y * sc + dy) * img.width + x * sc + dx); acc[0] += c[0]; acc[1] += c[1]; acc[2] += c[2]; }
      const o = ((oy + y) * W + ox + x) * 4;
      out[o] = Math.round(acc[0] / 16); out[o + 1] = Math.round(acc[1] / 16); out[o + 2] = Math.round(acc[2] / 16);
    }
  });
  const shown = ids.filter((id) => ours.has(id));
  const labels = shown.map((id, n) => ({ x: (n % cols) * tw, y: Math.floor(n / cols) * th, text: shortName(readGoldenCase(id)) }));
  writeFileSync(resolve(OUT, "look-contact.png"), await labelled(encodePng(W, H, out), labels));
}

const exact = results.filter((r) => r.same).length;
console.log("\nThe pictures, one line each:");
for (const r of results) console.log(`  ${r.id.padEnd(18)} ${r.same ? "IDENTICAL" : `${r.differing} pixels differ (max ${r.maxDiff})`}  ${r.secs.toFixed(1)} s`);
const secs = ((Date.now() - t0) / 1000).toFixed(0);
console.log("\n" + (fail ? "FAILED" : "PASSED") + `: ${pass} passed, ${fail} failed; ${exact} of ${results.length} pictures identical to Barnwright's, pixel for pixel. ${secs} s.`);
if (fail) {
  console.log("\nWhat failed:\n  " + failures.join("\n  "));
  if (existsSync(DIFF_DIR) && readdirSync(DIFF_DIR).length) console.log("Difference pictures (Barnwright's | ours | where they differ): test/out/look-diff/");
  process.exit(1);
}
console.log(`PROVED: all ${results.length} recorded buildings drawn by our engine are Barnwright's pictures to the last pixel (${results.length ? results[0].size : ""}, shadows,`);
console.log("textures and the selection glow included), on our FIRST draw; the comparison catches a one-step colour change and a");
console.log("0.001-radian camera turn; the true-colour switch changes colours only, never the drawing or its outline; a 14x40");
console.log("rebuild stays inside its time bound. Pictures: test/out/look-contact.png, test/out/look-truecolour.png, test/out/look-control-diff.png.");
