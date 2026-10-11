/* CHECK: THE STANDARD BUILDINGS ARE BUILT WITH ALAN'S SHOP NUMBERS, AND THE
   RECORDED SET OF THEM HAS NOT MOVED.
   Run: node tools/check-shop-numbers.mjs             (check)
        node tools/check-shop-numbers.mjs --record    (write test/golden-shop/shop-standard.json again, ON PURPOSE)
   check-all: node

   WHY. Alan said "yes match" (Oct 2026): the standard buildings every dealer
   gets are built the way his own shop builds them, where he confirmed the
   numbers. Barnwright's own company keeps Barnwright's numbers, and the
   golden test (tools/check-golden.mjs) still proves the drawing engine
   against Barnwright triangle for triangle. That test cannot see the shop
   numbers (Barnwright never drew them), so this one holds them:
   test/golden-shop/shop-standard.json is the recorded set -- for every
   library style at every size Barnwright sells, drawn with the shop standard
   (library/manufacturers/standard.json with its How it's built blocks):
     wall height, roof height above the wall, roof pitch (gable, lean-to and
     single slope roofs), how far the eave and the gable-end overhang reach,
     measured level, and the wooden shop door height, in inches;
   and, for the four styles the shop numbers change (Utility Shed, Side
   Utility, Lofted Barn, Side Lofted Barn), a fingerprint of every finished
   triangle (the golden test's own hashing, tools/lib/golden-cases.mjs).

   WHAT IT PROVES
   1. Every recorded number and fingerprint is drawn again exactly (to a
      thousandth of an inch; triangles to 1e-4 ft as the golden test does).
      A change shows which style, size and number moved. A change made on
      purpose is recorded again with --record, and the commit says why.
   2. The four matched styles carry Alan's confirmed numbers at every size:
      5/12 roofs, 4 in eaves and 93 1/2 in walls on the Utility Shed and Side
      Utility; 79 1/2 in walls and 43 3/4, 48 and 51 in barn roofs at 8, 10
      and 12 ft wide on the Lofted Barn and Side Lofted Barn, measured at the
      top of the trusses as Alan measures them (other widths: the library
      shape, held so a wider barn is never lower).
   3. Every other style, and the four at what Alan did not confirm, are
      Barnwright's numbers exactly: drawn side by side with Barnwright's
      company (tools/lib/barnwright-company.mjs barnwrightCatalogue).
   Prints PROVED with the counts, or FAIL with what moved. */

import { writeFileSync, mkdirSync } from "node:fs";
import { resolve as resolvePath, dirname } from "node:path";
import { createHash } from "node:crypto";
import { ROOT, readJSON } from "./lib/load.mjs";
import { barnwrightCatalogue, shopStandardCatalogue } from "./lib/barnwright-company.mjs";
import { canonical } from "./lib/headless.mjs";
import { defaults, setType } from "../model/design.js";
import { frameOf } from "../model/frame.js";
import { makePlan } from "../model/plan.js";
import { resetItems } from "../model/layout.js";
import { doorHeightFt } from "../model/construction.js";
import { roofOutline } from "../model/framing-geometry.js";
import { gableEndOverhangOf } from "../parts/roofing.js";
import { barnTrussPeakFt } from "../model/roof-shapes.js";
import { assemble } from "../engine/assemble.js";

const FILE = "test/golden-shop/shop-standard.json";
const RECORD = process.argv.includes("--record");
const MATCHED = ["UT", "SU", "LB", "SLB"];
const T0 = performance.now();

let pass = 0;
const failures = [];
function ok(what, cond, extra) {
  if (cond) { pass++; return true; }
  failures.push(what + (extra ? " -- " + extra : ""));
  return false;
}
const r3 = (v) => Math.round(v * 1000) / 1000;

/* One building, as the designer opens it at that size (its standard doors
   and windows). */
function stateOf(cat, key, size) {
  const s = defaults(cat);
  setType(s, key, cat);
  s.size = size;
  resetItems(s, frameOf(s, cat), cat);
  return s;
}

/* The numbers a shed builder would measure, in inches. */
function measures(cat, key, size) {
  const plan = makePlan(stateOf(cat, key, size), cat);
  const t = plan.t, P = plan.prof, W = plan.W;
  let top = -Infinity, apexX = 0, low = Infinity;
  for (const p of P) { if (p[1] > top + 1e-9) { top = p[1]; apexX = p[0]; } low = Math.min(low, p[1]); }
  const out = { wallIn: r3(t.wallH * 12), peakIn: r3((top - plan.topY) * 12) };
  /* a barn roof's height is its TRUSSES' peak (Alan: "from the top of the
     upper plate to the peak"); the roof line over the deck stands higher */
  if (t.roof === "gambrel") out.trussPeakIn = r3(barnTrussPeakFt(W, t, plan.construction) * 12);
  if (t.roof === "gable") out.pitch = r3((top - P[0][1]) / (apexX - P[0][0]) * 12);
  if (t.roof === "lean" || t.roof === "slope") out.pitch = r3((top - low) / W * 12);
  const O = roofOutline(plan).P;
  out.eaveLeftIn = r3((-W / 2 - O[0][0]) * 12);
  out.eaveRightIn = r3((O[O.length - 1][0] - W / 2) * 12);
  out.gableEndIn = r3(gableEndOverhangOf(plan) * 12);
  out.doorIn = r3(doorHeightFt(plan.construction, t.roof) * 12);
  return { plan, out };
}

/* Every finished triangle of the building, boiled down the golden way:
   per material, its triangle count and hash; then one hash of them all. */
function fingerprint(plan) {
  const r = assemble(plan, { viewport: { w: 742, h: 803 }, fit: "barnwright", scene: "studio", trueColour: false, frames: false });
  const c = canonical(r.build);
  let triangles = 0;
  const lines = c.order.map((k) => { triangles += c.buckets[k].triangles; return `${k}:${c.buckets[k].triangles}:${c.buckets[k].hash}`; });
  return { triangles, hash: createHash("sha256").update(lines.join("\n")).digest("hex") };
}

const SHOP = shopStandardCatalogue(), BW = barnwrightCatalogue();
const now = { styles: {} };
let buildings = 0, fingerprints = 0;
for (const key of Object.keys(SHOP.TYPES)) {
  const sizes = {};
  for (const size of Object.keys(SHOP.P[key])) {
    const { plan, out } = measures(SHOP, key, size);
    if (MATCHED.includes(key)) { Object.assign(out, fingerprint(plan)); fingerprints++; }
    sizes[size] = out;
    buildings++;
  }
  now.styles[key] = { name: SHOP.TYPES[key].name, sizes };
}

if (RECORD) {
  const file = resolvePath(ROOT, FILE);
  mkdirSync(dirname(file), { recursive: true });
  const doc = {
    _help: [
      "THE STANDARD BUILDINGS WITH ALAN'S SHOP NUMBERS (Oct 2026, \"yes match\"), recorded by node tools/check-shop-numbers.mjs --record and checked by node tools/check-shop-numbers.mjs.",
      "For every library style at every size Barnwright sells, drawn with library/manufacturers/standard.json as every Dealer Center business gets it: wallIn (floor to the top of the wall plate), peakIn (the roof line's peak above the wall top), trussPeakIn (a barn roof's trusses' peak above the wall top: what Alan measures), pitch (rise per 12, gable, lean-to and single slope roofs), eaveLeftIn and eaveRightIn (how far the roof edge reaches past each long wall, measured level), gableEndIn (past the gable ends), doorIn (the wooden shop door opening), all in inches to a thousandth.",
      "triangles and hash (Utility Shed, Side Utility, Lofted Barn, Side Lofted Barn only): every finished triangle, hashed the golden test's way (tools/lib/golden-cases.mjs).",
      "Re-record only on purpose (a confirmed shop number changed, or the drawing changed and check-golden still passes), and say why in the commit.",
    ],
    styles: now.styles,
  };
  writeFileSync(file, JSON.stringify(doc, null, 1) + "\n");
  console.log(`Recorded ${buildings} buildings (${fingerprints} with every triangle) in ${FILE}.`);
  process.exit(0);
}

console.log("check-shop-numbers: the standard buildings are built with Alan's shop numbers\n");

/* 1. the recorded set */
let rec = null;
try { rec = readJSON(FILE); } catch (e) { ok(`${FILE} can be read`, false, e.message); }
if (rec) {
  let moved = 0;
  for (const key of Object.keys(now.styles)) {
    const a = rec.styles && rec.styles[key];
    if (!ok(`${key} is in the recorded set`, !!a)) continue;
    for (const size of Object.keys(now.styles[key].sizes)) {
      const want = a.sizes[size], got = now.styles[key].sizes[size];
      if (!ok(`${now.styles[key].name} ${size} is in the recorded set`, !!want)) continue;
      for (const f of Object.keys(got)) {
        if (!ok(`${now.styles[key].name} ${size}: ${f} is as recorded`, want[f] === got[f], `recorded ${JSON.stringify(want[f])}, now ${JSON.stringify(got[f])}`)) moved++;
      }
      ok(`${now.styles[key].name} ${size}: nothing recorded has gone`, Object.keys(want).every((f) => f in got));
    }
    ok(`${key}: no recorded size has gone`, Object.keys(a.sizes).every((z) => z in now.styles[key].sizes));
  }
  ok("no recorded style has gone", Object.keys(rec.styles || {}).every((k) => k in now.styles));
  console.log(`1. The recorded set (${FILE}): ${buildings} buildings, ${fingerprints} of them triangle for triangle; ${moved ? moved + " numbers moved" : "nothing moved"}.`);
}

/* 2. Alan's confirmed numbers */
const near = (a, b) => Math.abs(a - b) < 0.0011;
const width = (z) => +z.split("x")[0];
for (const key of ["UT", "SU"]) {
  for (const [size, m] of Object.entries(now.styles[key].sizes)) {
    const run = width(size) * 6;                     /* half the width, in inches */
    ok(`${now.styles[key].name} ${size}: 5/12 (a ${run} in run rises ${r3(run * 5 / 12)} in)`, near(m.pitch, 5) && near(m.peakIn, run * 5 / 12), JSON.stringify(m));
    ok(`${now.styles[key].name} ${size}: 4 in eaves, measured level`, near(m.eaveLeftIn, 4) && near(m.eaveRightIn, 4), JSON.stringify(m));
    ok(`${now.styles[key].name} ${size}: 93 1/2 in walls`, near(m.wallIn, 93.5), JSON.stringify(m));
  }
}
const PEAK = { 8: 43.75, 10: 48, 12: 51 };
for (const key of ["LB", "SLB"]) {
  const rows = Object.entries(now.styles[key].sizes);
  for (const [size, m] of rows) {
    ok(`${now.styles[key].name} ${size}: 79 1/2 in walls`, near(m.wallIn, 79.5), JSON.stringify(m));
    const w = width(size);
    if (PEAK[w] != null) ok(`${now.styles[key].name} ${size}: the barn roof's trusses are ${PEAK[w]} in tall above the wall`, near(m.trussPeakIn, PEAK[w]), JSON.stringify(m));
  }
  const byW = {};
  for (const [size, m] of rows) byW[width(size)] = m.trussPeakIn;
  const ws = Object.keys(byW).map(Number).sort((a, b) => a - b);
  ok(`${now.styles[key].name}: a wider barn is never lower`, ws.every((w, i) => i === 0 || byW[w] >= byW[ws[i - 1]] - 1e-9), JSON.stringify(byW));
}
console.log("2. Alan's confirmed numbers: the Utility Shed and Side Utility at 5/12 with 4 in eaves and 93 1/2 in walls at every size; the Lofted Barn and Side Lofted Barn with 79 1/2 in walls and 43 3/4, 48 and 51 in barn roofs at 8, 10 and 12 ft wide.");

/* 3. everything else is Barnwright's */
let sameCount = 0;
const KEEP_ALL = ["doorIn", "gableEndIn"];
for (const key of Object.keys(now.styles)) {
  for (const [size, m] of Object.entries(now.styles[key].sizes)) {
    const bw = measures(BW, key, size).out;
    const fields = MATCHED.includes(key) ? KEEP_ALL.concat(key === "LB" || key === "SLB" ? (PEAK[width(size)] == null ? ["peakIn", "trussPeakIn"] : []) : []) : Object.keys(bw);
    for (const f of fields) {
      if (ok(`${now.styles[key].name} ${size}: ${f} is Barnwright's`, bw[f] === m[f], `Barnwright ${bw[f]}, shop standard ${m[f]}`)) sameCount++;
    }
  }
}
console.log(`3. Everything Alan did not confirm is Barnwright's number: ${sameCount} numbers compared with Barnwright's own company (the other 19 styles in full; door heights, gable ends and the 14 ft barn on the four).`);

const secs = ((performance.now() - T0) / 1000).toFixed(1);
if (failures.length) {
  console.log(`\nFAIL: ${failures.length} of ${pass + failures.length} checks failed.`);
  for (const f of failures.slice(0, 40)) console.log("  " + f);
  if (failures.length > 40) console.log(`  ... and ${failures.length - 40} more`);
  console.log(`\nIf a shop number was changed on purpose, run node tools/check-shop-numbers.mjs --record and say why in the commit.`);
  process.exit(1);
}
console.log(`\nPROVED (${pass} checks, ${secs} s): every standard building is drawn with Alan's shop numbers where he confirmed them (the Utility Shed, Side Utility, Lofted Barn and Side Lofted Barn) and Barnwright's everywhere else, and ${buildings} buildings (${fingerprints} triangle for triangle) are exactly as recorded in ${FILE}.`);
