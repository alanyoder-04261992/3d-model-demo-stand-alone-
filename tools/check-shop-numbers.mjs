/* CHECK: THE STANDARD BUILDINGS ARE BUILT WITH ALAN'S SHOP NUMBERS, AND THE
   RECORDED SET OF THEM HAS NOT MOVED.
   Run: node tools/check-shop-numbers.mjs             (check)
        node tools/check-shop-numbers.mjs --record    (write test/golden-shop/shop-standard.json again, ON PURPOSE)
   check-all: node

   WHY. Alan said "yes match" (Oct 2026): the standard buildings every dealer
   gets are built the way his own shop builds them, where he confirmed the
   numbers. On Oct 11 2026, after the before-and-after and proposal
   pictures, he said yes to more styles ("not metal garage"). Barnwright's
   own company keeps Barnwright's numbers, and the golden test
   (tools/check-golden.mjs) still proves the drawing engine against
   Barnwright triangle for triangle. That test cannot see the shop numbers
   (Barnwright never drew them), so this one holds them:
   test/golden-shop/shop-standard.json is the recorded set -- for every
   library style at every size Barnwright sells, drawn with the shop standard
   (library/manufacturers/standard.json with its How it's built blocks):
     wall height, roof height above the wall, roof pitch (gable, lean-to and
     single slope roofs), how far the eave and the gable-end overhang reach,
     measured level, and the wooden shop door height, in inches;
   and, for the ten styles the shop numbers change, a fingerprint of every
   finished triangle (the golden test's own hashing,
   tools/lib/golden-cases.mjs).

   THE SHOP NUMBERS, style by style (SHOP below):
     Utility Shed, Side Utility, Garage: 5/12 roofs, 4 in eaves, 7 ft 9 1/2 in walls
     Dog Kennel, Garden Utility:          5/12 roofs, 4 in eaves, walls as they were
     Dormer Shed:                         main roof 7/12, everything else as it was
     Lofted Barn, Side Lofted Barn,
     Metal Lofted Barn:                   6 ft 7 1/2 in walls; barn roofs 3 ft 7 3/4 in,
                                          4 ft and 4 ft 3 in tall at 8, 10 and 12 ft wide
     Lofted Barn Garage:                  those barn roofs, walls as they were
   Not the Metal Garage ("not metal garage") nor the Metal Utility (not
   picked), nor any other style.

   WHAT IT PROVES
   1. Every recorded number and fingerprint is drawn again exactly (to a
      thousandth of an inch; triangles to 1e-4 ft as the golden test does).
      A change shows which style, size and number moved. A change made on
      purpose is recorded again with --record, and the commit says why.
   2. The ten styles carry Alan's numbers at every size (barn roofs measured
      at the top of the trusses as Alan measures them; other widths: the
      library shape, held so a wider barn is never lower).
   3. Every other style, and the ten at what Alan did not give, are
      Barnwright's numbers exactly: drawn side by side with Barnwright's
      company (tools/lib/barnwright-company.mjs barnwrightCatalogue). The
      Metal Garage and Metal Utility are named on their own.
   4. Alan's other answers (Oct 11 2026):
      a. the 14 ft wide lofted barns keep today's height (the Lofted Barn,
         Side Lofted Barn, and a 14 ft Metal Lofted Barn or Lofted Barn
         Garage a business sells);
      b. a gable window that does not fit under the roof is not offered,
         on the newly changed styles too: the designer will not put it on a
         gable end, the server refuses one, and a design saved with one
         opens with it taken off;
      c. no sample price list a new business starts with has the Steep roof
         (or any option that changes the roof), and an owner can still make
         one of their own with "Roof pitch at least";
      d. a business-wide roof pitch still leaves the Dormer Shed's main roof
         alone: it stays at the shop's 7/12.
   Prints PROVED with the counts, or FAIL with what moved. */

import { writeFileSync, mkdirSync } from "node:fs";
import { resolve as resolvePath, dirname } from "node:path";
import { createHash } from "node:crypto";
import { ROOT, readJSON } from "./lib/load.mjs";
import { barnwrightCatalogue, shopStandardCatalogue, standardManufacturer } from "./lib/barnwright-company.mjs";
import { canonical } from "./lib/headless.mjs";
import { defaults, setType, fromState, toState } from "../model/design.js";
import { resolve as resolveCompany, strictProblems } from "../model/company.js";
import { optxList } from "../model/pricing.js";
import { addItem } from "../ui/state.js";
import { priceDesign } from "../server/office/pricing.js";
import { frameOf } from "../model/frame.js";
import { makePlan } from "../model/plan.js";
import { resetItems, fitsOnWall } from "../model/layout.js";
import { doorHeightFt } from "../model/construction.js";
import { roofOutline } from "../model/framing-geometry.js";
import { gableEndOverhangOf } from "../parts/roofing.js";
import { barnTrussPeakFt } from "../model/roof-shapes.js";
import { assemble } from "../engine/assemble.js";
import * as BUILT from "../model/build-settings.js";

const FILE = "test/golden-shop/shop-standard.json";
const RECORD = process.argv.includes("--record");
/* Alan's shop numbers, style by style: pitch (per 12), eave (inches,
   measured level), wall (inches), peaks (barn roof heights at 8, 10 and
   12 ft wide, to the top of the trusses). What a style does not list keeps
   Barnwright's number (part 3). */
const PEAK = { 8: 43.75, 10: 48, 12: 51 };
const SHOP_NUMBERS = {
  UT: { pitch: 5, eave: 4, wall: 93.5 },
  SU: { pitch: 5, eave: 4, wall: 93.5 },
  G: { pitch: 5, eave: 4, wall: 93.5 },
  DK: { pitch: 5, eave: 4 },
  GU: { pitch: 5, eave: 4 },
  DS: { pitch: 7 },
  LB: { wall: 79.5, peaks: PEAK },
  SLB: { wall: 79.5, peaks: PEAK },
  MLB: { wall: 79.5, peaks: PEAK },
  LBG: { peaks: PEAK },
};
const MATCHED = Object.keys(SHOP_NUMBERS);
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
      "THE STANDARD BUILDINGS WITH ALAN'S SHOP NUMBERS (Oct 2026, \"yes match\"; more styles Oct 11 2026), recorded by node tools/check-shop-numbers.mjs --record and checked by node tools/check-shop-numbers.mjs.",
      "For every library style at every size Barnwright sells, drawn with library/manufacturers/standard.json as every Dealer Center business gets it: wallIn (floor to the top of the wall plate), peakIn (the roof line's peak above the wall top), trussPeakIn (a barn roof's trusses' peak above the wall top: what Alan measures), pitch (rise per 12, gable, lean-to and single slope roofs), eaveLeftIn and eaveRightIn (how far the roof edge reaches past each long wall, measured level), gableEndIn (past the gable ends), doorIn (the wooden shop door opening), all in inches to a thousandth.",
      "triangles and hash (the ten styles with shop numbers only: Utility Shed, Side Utility, Garage, Dog Kennel, Garden Utility, Dormer Shed, Lofted Barn, Side Lofted Barn, Metal Lofted Barn, Lofted Barn Garage): every finished triangle, hashed the golden test's way (tools/lib/golden-cases.mjs).",
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

/* 2. Alan's numbers */
const near = (a, b) => Math.abs(a - b) < 0.0011;
const width = (z) => +z.split("x")[0];
for (const key of MATCHED) {
  const want = SHOP_NUMBERS[key], name = now.styles[key].name, rows = Object.entries(now.styles[key].sizes);
  for (const [size, m] of rows) {
    const run = width(size) * 6;                     /* half the width, in inches */
    if (want.pitch != null) ok(`${name} ${size}: ${want.pitch}/12 (a ${run} in run rises ${r3(run * want.pitch / 12)} in)`, near(m.pitch, want.pitch) && near(m.peakIn, run * want.pitch / 12), JSON.stringify(m));
    if (want.eave != null) ok(`${name} ${size}: ${want.eave} in eaves, measured level`, near(m.eaveLeftIn, want.eave) && near(m.eaveRightIn, want.eave), JSON.stringify(m));
    if (want.wall != null) ok(`${name} ${size}: ${want.wall} in walls`, near(m.wallIn, want.wall), JSON.stringify(m));
    if (want.peaks && want.peaks[width(size)] != null) ok(`${name} ${size}: the barn roof's trusses are ${want.peaks[width(size)]} in tall above the wall`, near(m.trussPeakIn, want.peaks[width(size)]), JSON.stringify(m));
  }
  if (want.peaks) {
    const byW = {};
    for (const [size, m] of rows) byW[width(size)] = m.trussPeakIn;
    const ws = Object.keys(byW).map(Number).sort((a, b) => a - b);
    ok(`${name}: a wider barn is never lower`, ws.every((w, i) => i === 0 || byW[w] >= byW[ws[i - 1]] - 1e-9), JSON.stringify(byW));
  }
}
console.log("2. Alan's numbers: 5/12 roofs with 4 in eaves on the Utility Shed, Side Utility, Garage, Dog Kennel and Garden Utility (93 1/2 in walls on the first three); the Dormer Shed's main roof at 7/12; 43 3/4, 48 and 51 in barn roofs at 8, 10 and 12 ft wide on the Lofted Barn, Side Lofted Barn, Metal Lofted Barn and Lofted Barn Garage (79 1/2 in walls on the first three).");

/* 3. everything else is Barnwright's */
let sameCount = 0;
/* the numbers a shop number does not move: what each style keeps */
function keptFields(key, size, all) {
  const want = SHOP_NUMBERS[key];
  if (!want) return all;
  const out = ["doorIn", "gableEndIn"];
  if (want.wall == null) out.push("wallIn");
  if (want.peaks && want.peaks[width(size)] == null) out.push("peakIn", "trussPeakIn");
  return out;
}
const bwOf = {};
for (const key of Object.keys(now.styles)) {
  for (const [size, m] of Object.entries(now.styles[key].sizes)) {
    const bw = bwOf[key + " " + size] = measures(BW, key, size).out;
    for (const f of keptFields(key, size, Object.keys(bw))) {
      if (ok(`${now.styles[key].name} ${size}: ${f} is Barnwright's`, bw[f] === m[f], `Barnwright ${bw[f]}, shop standard ${m[f]}`)) sameCount++;
    }
  }
}
/* the Dormer Shed keeps its eave board: measured along the roof it is
   Barnwright's, so on a 7/12 roof it reaches within a hair of the same */
for (const [size, m] of Object.entries(now.styles.DS.sizes)) {
  const bw = bwOf["DS " + size];
  ok(`Dormer Shed ${size}: its eave reaches what Barnwright's does, within 1/16 in`, Math.abs(m.eaveLeftIn - bw.eaveLeftIn) < 1 / 16 && Math.abs(m.eaveRightIn - bw.eaveRightIn) < 1 / 16, `Barnwright ${bw.eaveLeftIn}, shop standard ${m.eaveLeftIn}`);
}
/* ... and the Dealer Center says the eave the Dormer Shed is drawn with:
   worked out on its own 7/12 main roof, not the plain gable's pitch */
{
  const eff = BUILT.effective(SHOP, "DS").find((e) => e.id === "eaveOverhang");
  const drawn = Math.round(now.styles.DS.sizes["10x16"].eaveLeftIn * 16) / 16;
  ok(`Dormer Shed: the screens say the eave it is drawn with (${BUILT.format("eaveOverhang", drawn)}, measured level)`, !!eff && eff.words === BUILT.format("eaveOverhang", drawn), JSON.stringify(eff));
}
/* "not metal garage"; the Metal Utility was not picked */
for (const key of ["MG", "MU"]) {
  ok(`${now.styles[key].name}: no shop number in the standard`, !SHOP.TYPES[key].built || Object.values(SHOP.TYPES[key].built).every((b) => b.from !== "standard"), JSON.stringify(SHOP.TYPES[key].built));
  ok(`${now.styles[key].name}: Barnwright's roof, walls and eaves at every size`, Object.entries(now.styles[key].sizes).every(([z, m]) => JSON.stringify(m) === JSON.stringify(bwOf[key + " " + z])));
}
console.log(`3. Everything Alan did not give is Barnwright's number: ${sameCount} numbers compared with Barnwright's own company (the other ${Object.keys(now.styles).length - MATCHED.length} styles in full, the Metal Garage and Metal Utility among them; on the ten: door heights, gable ends, the walls Alan kept and the 14 ft barns).`);

/* 4. Alan's other answers (Oct 11 2026) */
const LIB = readJSON("library/construction.json"), SM = standardManufacturer();
const demoCompany = () => JSON.parse(JSON.stringify(readJSON("companies/demo/company.json")));

/* a. the 14 ft wide lofted barns keep today's height, a 14 ft Metal Lofted
      Barn or Lofted Barn Garage a business sells too */
{
  const BARNS = ["LB", "SLB", "MLB", "LBG"];
  const add14 = (c) => { for (const k of BARNS) if (c.offer[k] && !Object.keys(c.offer[k].sizes).some((z) => width(z) === 14)) c.offer[k].sizes["14x24"] = 9999; };
  const s14 = shopStandardCatalogue(add14), b14 = barnwrightCatalogue(add14);
  for (const k of BARNS) {
    const z = Object.keys(s14.P[k]).find((x) => width(x) === 14);
    const a = measures(s14, k, z).out, b = measures(b14, k, z).out;
    ok(`${s14.TYPES[k].name} ${z}: today's barn roof height (${r3(b.trussPeakIn)} in to the top of the trusses)`, !!z && a.trussPeakIn === b.trussPeakIn && a.peakIn === b.peakIn, `shop standard ${a.trussPeakIn}, Barnwright ${b.trussPeakIn}`);
  }
}

/* b. a gable window that does not fit is not offered, on the changed
      styles too (BUILDFAST-SPEC E.4, model/layout.js gableItemFits) */
const NOT_OFFERED = {        /* style -> width -> gable windows kept off the gable ends */
  UT: { 8: ["g1824", "oct"], 10: ["g1824"], 12: ["g1824"] },
  SU: { 8: ["g1824", "oct"], 10: ["g1824"], 12: ["g1824"] },
  G: { 12: ["g1824"] },
  DK: { 8: ["g1824", "oct"] },
  GU: { 6: ["g1824", "oct"] },
  DS: { 8: ["g1824"], 10: ["g1824"] },
};
let gableTries = 0;
{
  for (const key of MATCHED) {
    for (const size of Object.keys(SHOP.P[key])) {
      const s = stateOf(SHOP, key, size), fr = frameOf(s, SHOP);
      for (const id of ["g1824", "oct", "fake"]) {
        if (!SHOP.CAT[id]) continue;
        const kept = ((NOT_OFFERED[key] || {})[width(size)] || []).includes(id);
        const offered = fitsOnWall(SHOP.CAT[id], "F", fr) && fitsOnWall(SHOP.CAT[id], "B", fr);
        gableTries++;
        ok(`${now.styles[key].name} ${size}: the ${SHOP.CAT[id].n} is ${kept ? "not offered on the gable ends (too tall)" : "offered on the gable ends"}`, offered === !kept);
      }
    }
  }
  /* the newly changed styles, the way a customer meets it */
  for (const [key, size, id] of [["G", "12x24", "g1824"], ["DS", "10x16", "g1824"], ["DK", "8x12", "oct"]]) {
    const name = `${now.styles[key].name} ${size}`, c = SHOP.CAT[id];
    const s = stateOf(SHOP, key, size);
    ok(`${name}: the designer does not put the ${c.n} on the gable`, addItem(s, id, SHOP, 0) === null && !s.items.some((i) => i.cat === id));
    const onGable = stateOf(SHOP, key, size); onGable.items.push({ id: "gx", cat: id, wall: "F", pos: 0, vy: 0, inc: false, shut: false });
    let err = null; try { priceDesign(fromState(onGable, SHOP), SHOP); } catch (e) { err = e; }
    ok(`${name}: the server refuses a design with the ${c.n} on the gable (409, no longer offered)`, !!err && err.status === 409 && /no longer offered/.test(err.message), err ? `${err.status} ${err.message}` : "priced");
    /* saved with Barnwright's roof, when it fitted: opens with it taken off */
    const old = stateOf(BW, key, size), was = addItem(old, id, BW, 0);
    const back = was ? toState(fromState(old, BW), SHOP) : null;
    ok(`${name}: a design saved when it fitted opens with the ${c.n} taken off, said once`, !!was && !back.state.items.some((i) => i.cat === id && (i.wall === "F" || i.wall === "B")) && back.warnings.includes(`The ${c.n} is too tall for this gable, so it was taken off.`), JSON.stringify(back && back.warnings));
  }
}
console.log(`4b. A gable window too tall for the gable is not offered there: ${gableTries} gable windows tried on the ten styles at every size, and on the 12 ft Garage, the 10 ft Dormer Shed and the 8 ft Dog Kennel the designer leaves it off, the server refuses it and an older design opens without it.`);

/* c. no sample price list has the Steep roof; an owner can still make one */
{
  const SAMPLES = ["demo", "starter", "_template", "learning-side-loft"];
  for (const id of SAMPLES) {
    const extras = (readJSON(`companies/${id}/company.json`).options || {}).extras || [];
    const roofy = extras.filter((x) => x && (x.built || x.construction || /steep/i.test(`${x.key} ${x.name}`)));
    ok(`companies/${id}: no Steep roof, nor any option that changes how a building is built`, roofy.length === 0, JSON.stringify(roofy));
  }
  const own = demoCompany();
  own.options.extras.push({ key: "own-steep", name: "Steep roof", input: "check", price: 300, built: { roofPitch: 7 }, styles: ["UT", "SU"] });
  const cat = resolveCompany(own, SM, LIB);
  const s = stateOf(cat, "UT", "10x16"); s.xopt = { "own-steep": 1 };
  const fr = frameOf(s, cat), peak = (Math.max(...fr.prof.map((p) => p[1])) - fr.topY) * 12;
  ok("an owner's own option \"Roof pitch at least 7/12\" saves with no problem and makes a 10x16 Utility Shed's roof 7/12 (35 in)", strictProblems(own, SM).length === 0 && near(peak, 35), `${JSON.stringify(strictProblems(own, SM))} ${peak}`);
  ok("... offered on the buildings it names only", optxList(cat, stateOf(cat, "SU", "10x16")).some((x) => x.key === "own-steep") && !optxList(cat, stateOf(cat, "G", "12x24")).some((x) => x.key === "own-steep"));
}

/* d. a business-wide roof pitch leaves the Dormer Shed's main roof at the
      shop's 7/12 (its own main roof is a style feature) */
{
  const biz = demoCompany(); biz.built = { roofPitch: { gable: 6 } };
  const cat = resolveCompany(biz, SM, LIB);
  const pitchOf = (k, z) => measures(cat, k, z).out.pitch;
  ok("a business-wide 6/12 for gable roofs: the Utility Shed and Garage 6/12, the Dormer Shed still 7/12", near(pitchOf("UT", "10x16"), 6) && near(pitchOf("G", "12x24"), 6) && near(pitchOf("DS", "10x16"), 7), JSON.stringify([pitchOf("UT", "10x16"), pitchOf("G", "12x24"), pitchOf("DS", "10x16")]));
}
console.log("4. The 14 ft lofted barns keep today's height; no sample price list has the Steep roof and an owner can still make one; a business-wide pitch leaves the Dormer Shed at 7/12.");

const secs = ((performance.now() - T0) / 1000).toFixed(1);
if (failures.length) {
  console.log(`\nFAIL: ${failures.length} of ${pass + failures.length} checks failed.`);
  for (const f of failures.slice(0, 40)) console.log("  " + f);
  if (failures.length > 40) console.log(`  ... and ${failures.length - 40} more`);
  console.log(`\nIf a shop number was changed on purpose, run node tools/check-shop-numbers.mjs --record and say why in the commit.`);
  process.exit(1);
}
console.log(`\nPROVED (${pass} checks, ${secs} s): every standard building is drawn with Alan's shop numbers where he gave them (the Utility Shed, Side Utility, Garage, Dog Kennel, Garden Utility, Dormer Shed, Lofted Barn, Side Lofted Barn, Metal Lofted Barn and Lofted Barn Garage) and Barnwright's everywhere else (the Metal Garage and Metal Utility too), and ${buildings} buildings (${fingerprints} triangle for triangle) are exactly as recorded in ${FILE}.`);
