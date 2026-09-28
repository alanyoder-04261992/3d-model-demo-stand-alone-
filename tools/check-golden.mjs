/* CHECK: every triangle our engine draws is the triangle Barnwright drew.
   Run: node tools/check-golden.mjs [--case id,id] [--part label,label] [--verbose]

   WHY. Alan's first ask: the finished building must look exactly like
   Barnwright's 3D designer. test/golden/ holds Barnwright's own drawing of
   148 buildings, recorded from its real page (tools/capture-golden.mjs,
   test/golden/README.md). This check draws the same 148 buildings with our
   parts, in Node with no browser (tools/lib/headless.mjs), and compares.

   WHAT IT COMPARES, for every building:
   1. the camera fit (fitDist) and the lawn's radius (gr) -- exactly equal;
   2. per material and per PART (skids, floor, siding, a door...): how many
      triangles, and a fingerprint of every one of their numbers (rounded to
      1e-4, as recorded). A part still waiting to be ported (a stub marked
      "pending" in parts/) is reported as PENDING, not as a failure, so the
      parts can be proved one at a time;
   3. once NO part is pending: the draw order of the materials (ORDER), every
      whole material's triangles, and every material's settings (texture,
      tint, spec, gloss, glow, bump, unlit, noCast, age, glassM, turf);
   4. a finished part drawn ON ITS OWN (assemble(plan, {only: part}), what the
      parts gallery shows) holds exactly its triangles from the whole
      building, in the same materials and draw order (on the six buildings
      whose every vertex is on file, or on the --case buildings);
   5. drawing the FRAMING too (assemble(plan, {frames: true}): the Framing
      view, Watch-it-build) leaves every finished triangle, every material's
      settings and the finished materials' draw order untouched.
   On a difference it names the building, the material, the part and the
   FIRST triangle that differs (with its numbers when the building is one of
   the six whose every vertex is on file, test/golden/geometry-full).

   Options: --case ut-8x12,lb-8x12 (just these buildings), --part skids,floor
   (just these part labels; the whole-building comparison is then skipped),
   --verbose (a line per building and part), --whole (also compare the whole
   building while parts are still pending -- for a porter who wants to see
   what is left; expect differences). Exits non-zero on any failure. */

import { readGoldenCases, FLOATS_PER_TRIANGLE } from "./lib/golden-cases.mjs";
import { PART_IDS } from "./lib/barnwright-blocks.mjs";
import {
  buildGoldenCase, readFixture, catalogue, printOf, triangleFloats, hasFullFixture, readFullFixture, canonical, viewportOf,
} from "./lib/headless.mjs";
import { assemble } from "../engine/assemble.js";
import { PIPELINE, tagPending, pendingEntriesFor, entryPendingFor } from "../parts/index.js";

const args = process.argv.slice(2);
function optList(name) {
  const i = args.indexOf("--" + name);
  let v = null;
  if (i >= 0) v = args[i + 1];
  const eq = args.find((a) => a.startsWith("--" + name + "="));
  if (eq) v = eq.slice(name.length + 3);
  return v ? v.split(",").map((s) => s.trim()).filter(Boolean) : null;
}
const ONLY_CASES = optList("case");
const ONLY_PARTS = optList("part");
const VERBOSE = args.includes("--verbose");
const FORCE_WHOLE = args.includes("--whole");

const t0 = Date.now();
const allCases = readGoldenCases().cases.map((c) => c.id);
if (ONLY_CASES) for (const id of ONLY_CASES) if (!allCases.includes(id)) { console.log(`FAIL: there is no recorded building called "${id}" (see test/golden/cases.json).`); process.exit(1); }
if (ONLY_PARTS) for (const p of ONLY_PARTS) if (!PART_IDS.includes(p)) { console.log(`FAIL: "${p}" is not one of Barnwright's part labels: ${PART_IDS.join(", ")}.`); process.exit(1); }
const cases = ONLY_CASES || allCases;

/* Which labels are still waiting on a stub, and is the whole finished
   building ported (every entry that draws a Barnwright label is done)? */
const pending = new Set(PART_IDS.filter((p) => tagPending(p)));
const goldenEntries = PIPELINE.filter((en) => en.tags.some((t) => PART_IDS.includes(t)));
const complete = goldenEntries.every((en) => en.tags.every((t) => !PART_IDS.includes(t) || !entryPendingFor(en, t)));
const wanted = (p) => !ONLY_PARTS || ONLY_PARTS.includes(p);

const cat = catalogue();
const stats = {};                 /* label -> { cases, triangles, failed, pending } */
for (const p of PART_IDS) stats[p] = { cases: 0, triangles: 0, failed: 0, pending: 0 };
const failures = [];
let fitOk = 0, grOk = 0, wholeOk = 0, fullCompared = 0, ulpTints = 0;
let fullCache = new Map();

function fail(caseId, msg) { failures.push(`[${caseId}] ${msg}`); }
function fmt(a) { return "[" + a.map((x) => (Math.round(x * 1e4) / 1e4 || 0).toFixed(4)).join(", ") + "]"; }
function goldenIndex(gb, part) {
  const out = [];
  for (const s of gb.segments) if (s.part === part) for (let k = 0; k < s.count; k++) out.push(s.from + k);
  return out;
}
function fullBucket(caseId, key) {
  if (!hasFullFixture(caseId)) return null;
  if (!fullCache.has(caseId)) fullCache.set(caseId, readFullFixture(caseId));
  return fullCache.get(caseId).buckets.find((b) => b.key === key) || null;
}
function goldenFloats(caseId, key, i) {
  const fb = fullBucket(caseId, key);
  return fb ? fb.v.slice(i * FLOATS_PER_TRIANGLE, (i + 1) * FLOATS_PER_TRIANGLE) : null;
}

/* Name the first triangle of `part` in material `key` that differs. */
function firstDifference(caseId, gb, cb, part) {
  const gi = gb ? goldenIndex(gb, part) : [];
  const oi = cb && cb.parts[part] ? cb.parts[part].index : [];
  const n = Math.max(gi.length, oi.length);
  for (let k = 0; k < n; k++) {
    const gp = k < gi.length ? gb.prints.substr(gi[k] * 6, 6) : null;
    const op = k < oi.length ? printOf(cb, oi[k]) : null;
    if (gp === op) continue;
    let s = `the first difference is ${part} triangle ${k + 1} of ${n} in material "${gb ? gb.key : cb.key}"`;
    if (gp === null) s += ` -- ours has an EXTRA triangle there (our material triangle #${oi[k]}): ${fmt(triangleFloats(cb, oi[k]))}`;
    else if (op === null) s += ` -- ours is MISSING it (Barnwright's material triangle #${gi[k]})`;
    else {
      s += ` (Barnwright's material triangle #${gi[k]}, ours #${oi[k]})`;
      const g = goldenFloats(caseId, gb.key, gi[k]);
      s += `\n      ours:       ${fmt(triangleFloats(cb, oi[k]))}`;
      s += g ? `\n      Barnwright: ${fmt(g)}` : `\n      (Barnwright's numbers for this building are not on file; test/golden/geometry-full has six buildings)`;
    }
    if (gp === null || op === null) {
      if (op === null && gb) { const g = goldenFloats(caseId, gb.key, gi[k]); if (g) s += `\n      Barnwright: ${fmt(g)}`; }
    }
    return s;
  }
  return `every triangle's short fingerprint agrees but the full fingerprint does not (a difference below the 6-character print)`;
}

for (const id of cases) {
  let fx, built;
  try {
    fx = readFixture(id);
    built = buildGoldenCase(fx, { cat });
  } catch (e) {
    fail(id, "our engine could not draw this building: " + (e && e.stack ? e.stack.split("\n").slice(0, 4).join(" | ") : e));
    continue;
  }
  const { result, canon } = built;
  const lines = [];

  /* 1. camera fit and lawn radius */
  if (result.fitDist === fx.fitDist) fitOk++;
  else fail(id, `the camera fit is ${result.fitDist}, Barnwright's is ${fx.fitDist}`);
  if (pending.has("ground")) lines.push("gr PENDING (the ground part is a stub)");
  else if (result.gr === fx.gr) grOk++;
  else fail(id, `the lawn radius (gr) is ${result.gr}, Barnwright's is ${fx.gr}`);

  /* 2. per part */
  const gByKey = new Map(fx.buckets.map((b) => [b.key, b]));
  const labels = new Set();
  for (const b of fx.buckets) for (const p of Object.keys(b.parts)) labels.add(p);
  for (const k of canon.order) for (const p of Object.keys(canon.buckets[k].parts)) labels.add(p);
  for (const label of [...labels].sort()) {
    if (!PART_IDS.includes(label)) {
      const where = canon.order.filter((k) => canon.buckets[k].parts[label]);
      fail(id, `triangles labelled "${label}" in ${where.map((k) => `"${k}"`).join(", ")}: that is not a Barnwright part. ` +
        (label === "null" ? "They were drawn outside any part (kit.part)." : label === "openings" ? "Every door/window/light must be attributed to its own part (door-wood, window ...)." : "Attribute them to the real part."));
      continue;
    }
    if (!wanted(label)) continue;
    const st = stats[label];
    if (pending.has(label)) {
      st.pending++;
      lines.push(`${label} PENDING (waiting on ${pendingEntriesFor(label).join(", ")})`);
      continue;
    }
    const keys = new Set();
    for (const b of fx.buckets) if (b.parts[label]) keys.add(b.key);
    for (const k of canon.order) if (canon.buckets[k].parts[label]) keys.add(k);
    let ok = true, tris = 0;
    for (const key of keys) {
      const gb = gByKey.get(key) || null, cb = canon.buckets[key] || null;
      const g = gb && gb.parts[label], o = cb && cb.parts[label];
      if (g && o && g.triangles === o.triangles && g.hash === o.hash) { tris += g.triangles; continue; }
      ok = false;
      const gn = g ? g.triangles : 0, on = o ? o.triangles : 0;
      fail(id, `part "${label}" in material "${key}": Barnwright drew ${gn} triangle(s), we drew ${on}` +
        (gn === on ? " (same count, different numbers)" : "") + ";\n    " + firstDifference(id, gb, cb, label));
      break;
    }
    if (ok) { st.cases++; st.triangles += tris; lines.push(`${label} ok (${tris} triangles in ${keys.size} material(s))`); }
    else st.failed++;
  }

  /* 3. the whole building, once nothing is pending */
  if ((complete || FORCE_WHOLE) && !ONLY_PARTS) {
    fullCompared++;
    let ok = true;
    if (JSON.stringify(canon.order) !== JSON.stringify(fx.order)) {
      ok = false;
      let i = 0; while (i < fx.order.length && canon.order[i] === fx.order[i]) i++;
      fail(id, `the material draw order differs at position ${i + 1}: Barnwright "${fx.order[i]}", ours "${canon.order[i]}"\n    Barnwright: ${fx.order.join(",")}\n    ours:       ${canon.order.join(",")}`);
    }
    for (const gb of fx.buckets) {
      const cb = canon.buckets[gb.key];
      if (!cb) { ok = false; fail(id, `material "${gb.key}" is missing from our drawing`); continue; }
      if (cb.triangles !== gb.triangles || cb.hash !== gb.hash) {
        ok = false;
        let i = 0; const n = Math.max(cb.triangles, gb.triangles);
        while (i < n && i < cb.triangles && i < gb.triangles && printOf(cb, i) === gb.prints.substr(i * 6, 6)) i++;
        fail(id, `material "${gb.key}": Barnwright ${gb.triangles} triangles, ours ${cb.triangles}; the first difference is triangle #${i}` +
          ` (Barnwright's part ${gb.segments.find((s) => i >= s.from && i < s.from + s.count)?.part ?? "-"}, ours ${cb.tags[i] ?? "-"})`);
      }
      const same = sameParams(gb.params, cb.params);
      if (!same.ok) { ok = false; fail(id, `material "${gb.key}" settings differ (${same.why}):\n    Barnwright ${JSON.stringify(sortKeys(gb.params))}\n    ours       ${JSON.stringify(sortKeys(cb.params))}`); }
      else if (same.ulp) ulpTints++;
    }
    if (ok) wholeOk++;
  }
  if (VERBOSE) console.log(`${id}: ` + (lines.length ? lines.join("; ") : "nothing to compare"));
}

function sortKeys(o) { const out = {}; for (const k of Object.keys(o).sort()) out[k] = o[k]; return out; }

/* Material settings are compared EXACTLY, with one measured exception: a
   paint colour becomes a tint through Math.pow(c, 2.2) (engine/math.js
   srgbLin, Barnwright's own line), and Node's V8 and the Chromium V8 that
   recorded the fixtures round that power differently in the LAST binary
   digit for 17 of the 256 possible colour bytes (for example 0x31: Node
   0.026548682828472912, Chromium 0.026548682828472916). In the browser our
   engine runs on the same V8 as Barnwright and gets Barnwright's number; in
   Node a tint may differ from the recording by at most 2 units in its last
   place, and nothing else may differ at all. */
function ulpOf(x) { const a = Math.abs(x); return a === 0 ? Number.MIN_VALUE : Math.pow(2, Math.floor(Math.log2(a))) * Number.EPSILON; }
function sameParams(g, o) {
  const gk = Object.keys(g).sort(), ok = Object.keys(o).sort();
  if (gk.join() !== ok.join()) return { ok: false, why: `Barnwright has ${gk.join(" ")}, ours ${ok.join(" ")}` };
  let ulp = false;
  for (const k of gk) {
    if (k === "tint" && Array.isArray(g.tint) && Array.isArray(o.tint) && g.tint.length === o.tint.length) {
      for (let i = 0; i < g.tint.length; i++) {
        if (g.tint[i] === o.tint[i]) continue;
        if (Math.abs(g.tint[i] - o.tint[i]) <= 2 * ulpOf(g.tint[i])) { ulp = true; continue; }
        return { ok: false, why: `tint[${i}] ${o.tint[i]} is not Barnwright's ${g.tint[i]}` };
      }
      continue;
    }
    if (JSON.stringify(g[k]) !== JSON.stringify(o[k])) return { ok: false, why: `${k} is ${JSON.stringify(o[k])}, Barnwright's ${JSON.stringify(g[k])}` };
  }
  return { ok: true, ulp };
}

/* ---- a part on its own: assemble(plan, {only}) keeps exactly that part's
   triangles in every material, and every material in the same draw order,
   as on the whole building (the parts gallery relies on it). Checked on the
   six buildings whose every vertex is on file (or the --case ones). ---- */
let onlyChecked = 0;
const onlyCases = ONLY_CASES || cases.filter((id) => hasFullFixture(id));
for (const id of onlyCases) {
  let fx, full;
  try { fx = readFixture(id); full = buildGoldenCase(fx, { cat }); } catch (e) { continue; }
  const labels = new Set();
  for (const k of full.canon.order) for (const p of Object.keys(full.canon.buckets[k].parts)) if (PART_IDS.includes(p) && !pending.has(p) && wanted(p)) labels.add(p);
  for (const label of labels) {
    const r = assemble(full.plan, { viewport: viewportOf(fx), fit: "barnwright", scene: "studio", trueColour: false, only: label });
    const co = canonical(r.build);
    let why = null;
    if (JSON.stringify(r.ORDER) !== JSON.stringify(full.result.ORDER)) why = "the draw order of the materials changed";
    for (const k of full.canon.order) {
      if (why) break;
      const want = full.canon.buckets[k].parts[label], got = co.buckets[k];
      if (!want) { if (got && got.triangles) why = `material "${k}" has ${got.triangles} triangle(s) that are not ${label}`; continue; }
      if (!got || got.triangles !== want.triangles || got.hash !== want.hash) why = `material "${k}" does not hold exactly the ${label} triangles of the whole building`;
    }
    if (why) fail(id, `drawn on its own (assemble only: "${label}"): ${why}`);
    else onlyChecked++;
  }
}

/* ---- the framing does not touch the finished building: assemble(plan,
   {frames: true}) (the Framing view, Watch-it-build) must leave every
   finished triangle, every material's settings and the draw order of the
   finished materials exactly as they are without it -- the framing parts run
   last, so any material only they make comes after all of Barnwright's. ---- */
let framesOk = 0;
for (const id of cases) {
  let fx, base;
  try { fx = readFixture(id); base = buildGoldenCase(fx, { cat }); } catch (e) { continue; }
  let r;
  try { r = assemble(base.plan, { viewport: viewportOf(fx), fit: "barnwright", scene: "studio", trueColour: false, frames: true }); }
  catch (e) { fail(id, "drawing it with the framing (frames: true) failed: " + (e && e.message || e)); continue; }
  const a = base.result.ORDER, b = r.ORDER;
  let why = null;
  if (b.length < a.length || a.some((k, i) => b[i] !== k)) why = "the finished materials are no longer drawn first, in the same order";
  const cf = canonical(r.build);
  for (const k of base.canon.order) {
    if (why) break;
    const x = base.canon.buckets[k], y = cf.buckets[k];
    if (!y || x.hash !== y.hash || x.triangles !== y.triangles) why = `material "${k}" has different finished triangles`;
    else if (JSON.stringify(sortKeys(x.params)) !== JSON.stringify(sortKeys(y.params))) why = `material "${k}" has different settings (a framing part changed a finished material)`;
  }
  if (why) fail(id, "with the framing drawn too (frames: true): " + why);
  else framesOk++;
}

/* ---- the report ---- */
const secs = ((Date.now() - t0) / 1000).toFixed(1);
console.log(`\nGolden check: ${cases.length} recorded Barnwright building(s), drawn by our engine in Node (${secs} s).`);
console.log(`  camera fit (fitDist) identical on ${fitOk}/${cases.length}` + (pending.has("ground") ? "; lawn radius (gr) PENDING" : `; lawn radius (gr) identical on ${grOk}/${cases.length}`));
console.log("  part            buildings  triangles  failed  pending");
for (const p of PART_IDS) {
  if (!wanted(p)) continue;
  const s = stats[p];
  if (!s.cases && !s.failed && !s.pending) continue;
  console.log(`  ${p.padEnd(15)} ${String(s.cases).padStart(9)}  ${String(s.triangles).padStart(9)}  ${String(s.failed).padStart(6)}  ${String(s.pending).padStart(7)}`);
}
const ready = PART_IDS.filter((p) => !pending.has(p) && wanted(p));
const waiting = PART_IDS.filter((p) => pending.has(p) && wanted(p));
if ((complete || FORCE_WHOLE) && !ONLY_PARTS) console.log(`  whole buildings (ORDER, every material's triangles and settings) identical on ${wholeOk}/${fullCompared}` +
  (ulpTints ? ` (${ulpTints} material tint(s) differ only in Math.pow's last binary digit, Node against Chromium -- see sameParams)` : ""));
else if (!ONLY_PARTS) console.log(`  whole-building comparison (ORDER, whole materials, material settings) waits until no part is pending.`);
if (waiting.length) console.log(`  PENDING (stubs, not failed): ${waiting.join(", ")}`);
console.log(`  a part drawn on its own (assemble { only }) is exactly its triangles on the whole building: ${onlyChecked} part(s) x building(s) checked`);
console.log(`  drawing the framing too (assemble { frames: true }) leaves the finished building untouched on ${framesOk}/${cases.length}`);

if (failures.length) {
  console.log(`\nFAIL: ${failures.length} difference(s) from Barnwright:`);
  for (const f of failures.slice(0, 40)) console.log("  " + f);
  if (failures.length > 40) console.log(`  ... and ${failures.length - 40} more (use --case and --part to narrow it down).`);
  process.exitCode = 1;
} else {
  const tris = ready.reduce((a, p) => a + stats[p].triangles, 0);
  console.log(`\nPROVED: for ${ready.length ? ready.join(", ") : "no part yet"}, every triangle our engine draws for the ${cases.length} building(s) is ` +
    `Barnwright's, number for number (${tris} triangles), and the camera fit` + (pending.has("ground") ? "" : " and lawn radius") + " are identical;" +
    ` each part drawn on its own is exactly its triangles on the whole building (${onlyChecked} checked), and drawing the framing too changes none of it.` +
    (complete && !ONLY_PARTS ? " Nothing is pending: the draw order and every material's settings are Barnwright's too." : ""));
}
