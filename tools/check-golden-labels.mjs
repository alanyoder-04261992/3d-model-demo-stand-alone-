/* CHECK: the part labels on the golden fixtures are right -- proved a second,
   independent way.
   Run: node tools/check-golden-labels.mjs [case,case]      (a browser; a few minutes)

   WHY. tools/check-golden.mjs proves our engine one PART at a time (the
   skids, the siding, a door...), against the labels the golden capture put
   on every one of Barnwright's triangles. If a label were wrong, a part could
   be "proved" against triangles that belong to another part. The capture
   labels by reading the call stack (tools/lib/barnwright-blocks.mjs: the
   innermost wrapped function, else the line range of buildShed). This check
   labels the same triangles by a completely different method and demands
   the same answer for every triangle of every building.

   THE OTHER METHOD. Barnwright's own page is served from an IN-MEMORY copy
   of its 3ddesign.html in which one short statement is put at the start of
   17 lines of buildShed -- `__R="skids";`, `__R="gable-band";` ... -- marking
   where each region of the drawing begins (no line is added or removed, so
   every line number stays true). While buildShed draws, a triangle takes the
   label of the region it is drawn in -- or, while a door/window/light is
   being drawn (Barnwright's CURIT), the label of that item's kind. Nothing
   reads a stack. Barnwright's file on disk is only ever READ: it must be the
   pinned copy (SHA-256 below and tools/lib/barnwright-blocks.mjs), and every
   marked line must read exactly as expected, or the check refuses to run.

   WHAT IT PROVES, for all 148 recorded buildings: the page draws every
   material with exactly the recorded numbers (the markers change nothing),
   in the recorded ORDER, and every single triangle's label equals the
   recorded one. Uses port 8330. */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { inPageRunSteps, loadPlaywright, CHROMIUM_ARGS, VIEWPORT, startServer } from "./lib/golden-page.mjs";
import { loadCatalogue, buildCases, hashFloats } from "./lib/golden-cases.mjs";
import { BARNWRIGHT_FILE, BARNWRIGHT_SHA256, PART_IDS, assertBarnwrightPinned, BARNWRIGHT_PAGE } from "./lib/barnwright-blocks.mjs";
import { MULBERRY32_SOURCE, textureSeed } from "../engine/seeded.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 8330;
const JOBS = 3;

/* The one copy of Barnwright's file this check is true of: written against
   the copy of Sep 26 2026 (0bdcf663...), re-pinned Oct 6 2026 to Barnwright's
   current copy, whose lines 1-5792 are the same byte for byte (only its
   saving code, after line 5792, changed), and re-pinned Oct 10 2026 to the
   copy with the Yoder site's look (lines 1-4089 the same but three one-line
   switches; the new code after uploadBuffers), so every marked line below
   still reads as it did. The page is opened with ?light=warm. */
export const PINNED_SHA256 = "fd9c12b86a07c628252792c97e82d6d230e359679d6cd5c2ff81e5ff4bbd1bc7";

/* Each item's part label, by its catalogue code -- this check's OWN copy,
   written from what each item is (a door with no glass, a steel door, a door
   with a window, a roll-up, a wall window or transom, a gable window, the
   outside light, a porch post), not imported from the capture's table. */
const ITEMS = Object.freeze({
  w36: "door-wood", w48: "door-wood", w72: "door-wood", d36in: "door-steel", d36lite: "door-lite", dfr: "door-lite",
  ru6: "roll-up", ru8: "roll-up", w23: "window", w33: "window", tr: "window", fake: "gable-window", g1824: "gable-window",
  oct: "gable-window", light: "light", ppost: "porch-post",
});

/* line -> [the statement put at its start, how the line must begin (after
   its indentation) on the pinned file] */
const MARKS = Object.freeze({
  3855: ['__R="PRE";', "for(var bk in buckets){"],
  3875: ['__R="skids";', "for(var sx=0;sx<SKX.length;sx++) box(mSk,"],
  3876: ['__R="floor";', "box(mFlr,0,0.5,fzc,W-FIN*2,0.42,fl);"],
  3879: ['__R="siding";', '(t.porch==="C"?["F","B","R","L","P1","P2","P3"]'],
  3881: ['__R=(state.type==="DK"&&(k==="F"||k==="R"||k==="L"))?"kennel":"siding";', 'if(state.type==="DK" && k==="F"){ kennelFront('],
  3906: ['__R="corner-trim";', "/* corner trim: chamfered posts"],
  3946: ['__R="porch";', 'if(t.porch==="C"){'],
  3961: ['__R="kennel";', 'if(state.type==="DK") kennelExtras(W,L,topY,prof);'],
  3964: ['__R="gable-siding";', 'var sgn=k==="F"?1:-1, gz=k==="F"?L/2:-L/2;'],
  3980: ['__R="gable-band";', "var rx=0,ry=-1;for(var pv=1;"],
  4002: ['__R="gable-vent";', 'if(t.roof==="lean"){ rx=-W/2+0.9;'],
  4015: ['__R="belt-band";', "/* single slope: white belt band"],
  4020: ['__R="porch";', "/* porches: white header band"],
  4035: ['__R="roofing";', "/* roof */"],
  4040: ['__R="dormer";', "/* dormer */"],
  4042: ['__R="ITEMS";', "/* items */"],
  4044: ['__R="ground";', "/* ground disc"],
});

function markedCopy() {
  assertBarnwrightPinned();
  const buf = readFileSync(BARNWRIGHT_FILE);
  const sha = createHash("sha256").update(buf).digest("hex");
  if (sha !== PINNED_SHA256 || sha !== BARNWRIGHT_SHA256) throw new Error(`Barnwright's 3ddesign.html is not the pinned copy (SHA-256 ${sha}); this check was written for ${PINNED_SHA256}.`);
  const src = buf.toString("utf8");
  const lines = src.split("\r\n");
  for (const [n, [code, starts]] of Object.entries(MARKS)) {
    const line = lines[+n - 1];
    if (!line.trimStart().startsWith(starts)) throw new Error(`Barnwright line ${n} does not begin "${starts}": ${JSON.stringify(line)}`);
    lines[+n - 1] = code + line;
  }
  const mod = lines.join("\r\n");
  if (mod.split("\r\n").length !== src.split("\r\n").length) throw new Error("marking moved the line count");
  return { mod, sha, lines: lines.length };
}

function initScript() {
  const seeds = []; for (let i = 0; i < 32; i++) seeds.push(textureSeed(i));
  return `(function(){ window.__R=null;
  var mulberry32=${MULBERRY32_SOURCE}; var SEEDS=${JSON.stringify(seeds)}; var G={i:0,rand:null,pendingFetch:0};
  var nr=Math.random; Math.random=function(){ return G.rand? G.rand() : nr(); };
  var ce=Document.prototype.createElement;
  Document.prototype.createElement=function(tag){
    if(typeof tag==="string"&&tag.toLowerCase()==="canvas"){ var s=String(new Error().stack); if(/at mkTex \\(.*3ddesign\\.html(\\?[^:]*)?:1717:/.test(s)){ G.rand=mulberry32(SEEDS[G.i++]); } }
    return ce.apply(this,arguments); };
  var of=window.fetch; window.fetch=function(){ G.pendingFetch++; var d=function(){G.pendingFetch--;}; var p=of.apply(this,arguments); p.then(d,d); return p; };
  window.__G=G; })();`;
}

/* Runs in the page: one build, every triangle labelled by region or item. */
function labeller(itemMap) {
  const tags = new Map();
  const probs = [];
  const origPush = window.pushTri, origUp = window.uploadBuffers;
  let out = null;
  function b64(arr) { const f = new Float64Array(arr); const u8 = new Uint8Array(f.buffer); let s = ""; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); }
  window.pushTri = function (b) {
    let t;
    if (CURIT != null) {
      if (__R !== "ITEMS") probs.push("an item was being drawn outside the item loop, in region " + __R);
      const it = itemById(CURIT);
      t = it ? (itemMap[it.cat] || "UNKNOWN-ITEM:" + it.cat) : "NO-ITEM:" + CURIT;
    } else {
      t = __R;
      if (t === "ITEMS" || t === "PRE" || t == null) t = "UNTAGGED:" + t;
    }
    let l = tags.get(b); if (!l) { l = []; tags.set(b, l); } l.push(t);
    return origPush.apply(this, arguments);
  };
  window.uploadBuffers = function () {
    out = ORDER.map((k) => ({ key: k, n: buckets[k].n, v: b64(buckets[k].v), tags: tags.get(buckets[k]) || [] }));
    return origUp.apply(this, arguments);
  };
  try { buildShed(); } finally { window.pushTri = origPush; window.uploadBuffers = origUp; }
  return { out, probs, curitAfter: CURIT };
}

async function main() {
  const { mod, sha, lines } = markedCopy();
  const server = await startServer(PORT);
  const origin = server.url.replace(/\/$/, "");
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ args: [...CHROMIUM_ARGS] });
  const cases = buildCases(loadCatalogue());
  const ONLY = process.argv[2] ? process.argv[2].split(",") : null;
  const run = ONLY ? cases.filter((c) => ONLY.includes(c.id)) : cases;
  if (ONLY && run.length !== ONLY.length) throw new Error("unknown case in " + ONLY.join(","));
  const t0 = Date.now();
  let bad = 0, tris = 0, done = 0, buckets = 0;
  const partSeen = new Set();
  const diffs = [];

  async function one(c) {
    const ctx = await browser.newContext({ viewport: { ...VIEWPORT }, deviceScaleFactor: 1, reducedMotion: "reduce", serviceWorkers: "block" });
    try {
      const page = await ctx.newPage();
      const errs = []; page.on("pageerror", (e) => errs.push(String(e.message || e)));
      await page.route("**/*", (route) => {
        const u = route.request().url();
        if (!u.startsWith(origin + "/")) return route.abort();
        if (/shedline-[a-z]+\.json|designs(-img)?\/|\.netlify\/functions/.test(u)) return route.abort();
        if (/\/3ddesign\.html(\?.*)?$/.test(u)) return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: mod });
        return route.continue();
      });
      await page.addInitScript({ content: initScript() });
      await page.goto(origin + "/" + BARNWRIGHT_PAGE, { waitUntil: "load" });
      await page.waitForFunction(() => typeof buildShed === "function" && window.state && state.items.length > 0 && ORDER.length > 0 && window.__G.i === 11, null, { timeout: 120000 });
      await page.waitForFunction(() => window.__G.pendingFetch === 0, null, { timeout: 60000 });
      await page.waitForTimeout(100);
      await page.waitForFunction(() => window.__G.pendingFetch === 0, null, { timeout: 60000 });
      await page.evaluate(inPageRunSteps, { steps: c.steps });
      const r = await page.evaluate(labeller, ITEMS);
      const gold = JSON.parse(readFileSync(resolve(ROOT, "test/golden/geometry", c.id + ".json"), "utf8"));
      const msgs = [];
      if (errs.length) msgs.push("page errors " + errs.join("|"));
      if (r.probs.length) msgs.push(r.probs.slice(0, 3).join("; "));
      if (r.curitAfter != null) msgs.push("an item was still marked as being drawn after the build: " + r.curitAfter);
      if (JSON.stringify(r.out.map((b) => b.key)) !== JSON.stringify(gold.order)) msgs.push("the material ORDER differs from the recording");
      r.out.forEach((b, i) => {
        const g = gold.buckets[i];
        if (!g || g.key !== b.key) return;
        buckets++;
        const buf = Buffer.from(b.v, "base64");
        const v = new Float64Array(buf.buffer, buf.byteOffset, buf.length / 8);
        if (hashFloats(v) !== g.hash) msgs.push(`material ${b.key}: the marked page drew different numbers`);
        const gl = [];
        for (const s of g.segments) for (let k = 0; k < s.count; k++) gl.push(s.part);
        if (gl.length !== b.tags.length) { msgs.push(`material ${b.key}: ${gl.length} recorded labels, ${b.tags.length} independent ones`); return; }
        for (let k = 0; k < gl.length; k++) {
          partSeen.add(b.tags[k]);
          if (gl[k] !== b.tags[k]) { msgs.push(`material ${b.key} triangle ${k}: recorded "${gl[k]}", independent "${b.tags[k]}"`); break; }
        }
        tris += gl.length;
      });
      if (msgs.length) { bad++; diffs.push(`${c.id}: ${msgs.join(" | ")}`); }
    } finally {
      await ctx.close();
    }
    done++;
    if (done % 25 === 0 || done === run.length) process.stdout.write(`  ${done}/${run.length} buildings labelled\n`);
  }

  try {
    let next = 0;
    await Promise.all(Array.from({ length: JOBS }, async () => {
      for (;;) {
        const i = next++;
        if (i >= run.length) return;
        try { await one(run[i]); } catch (e) { bad++; diffs.push(`${run[i].id}: ${e && e.message ? e.message.split("\n")[0] : e}`); }
      }
    }));
  } finally {
    await browser.close();
    await server.stop();
  }
  const secs = ((Date.now() - t0) / 1000).toFixed(0);
  const unseen = PART_IDS.filter((p) => !partSeen.has(p));
  if (bad) {
    console.log(`FAIL: ${bad} of ${run.length} buildings have a label (or drawing) difference:`);
    for (const d of diffs.slice(0, 40)) console.log("  " + d);
    process.exitCode = 1;
    return;
  }
  console.log(`PROVED: on the pinned Barnwright file (SHA-256 ${sha.slice(0, 12)}..., ${lines} lines, 17 region marks in memory, the file on disk untouched), ` +
    `all ${run.length} recorded buildings were drawn again and labelled region by region and item by item: ${tris} triangles in ${buckets} materials, ` +
    `0 label differences from test/golden, every material's numbers and the draw order identical (${secs} s).`);
  console.log(`  Part labels seen: ${[...partSeen].sort().join(" ")}` + (unseen.length && !ONLY ? `; never seen: ${unseen.join(" ")}` : "") + ".");
  if (!ONLY && unseen.length) { console.log("FAIL: some Barnwright part labels never appeared"); process.exitCode = 1; }
}

main().catch((e) => { console.error("FAIL: " + (e && e.message ? e.message : e)); process.exitCode = 1; });
