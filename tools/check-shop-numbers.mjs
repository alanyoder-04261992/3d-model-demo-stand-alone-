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
     Side Utility 8x12 and 10x12:         the 48 in Wooden Door, not the 72 in
                                          double doors ("replace 6 foot to 4 foot")
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
         alone: it stays at the shop's 7/12;
      e. the 8x12 and 10x12 Side Utility come with the 48 in Wooden Door
         ("replace 6 foot to 4 foot"): in the middle of the door side, where
         the 72 in Wooden Double Doors were, between the same two 2x3
         windows, and no window runs into it any more. Every other Side
         Utility size, every other style and Barnwright's own Side Utility
         keep what they have; a style built like the Side Utility gets it
         too; a price list that does not sell the 48 in door keeps the
         doubles and the owner is told; a new price list must sell it, and
         the Dealer Center keeps it sold.
   5. What the screens and Alan's papers say is what is drawn:
      a. the Dealer Center's How it's built box says the eave each style is
         drawn with, measured level: a barn's eave width by width, since
         its lower slope changes with the barn roof height (the Metal Lofted
         Barn 1 11/16 in at 8 ft wide, 1 7/8 in at 10 ft and 2 1/8 in at
         12 ft); History and the warnings say the same;
      b. docs/DIFFERENCES.md #26 gives the barn heights and walls the
         drawing has (Barnwright's 10 ft Lofted Barn is 4 ft 5 9/16 in);
      c. docs/FOR-ALAN.md says how much lower overall a 14 ft lofted barn
         stands (its roof keeps today's height, its walls are the shop's),
         and asks no question Alan answered on Oct 11 2026 (the 14 ft Garage
         at 5/12 was in the proposal he said yes to).
   Prints PROVED with the counts, or FAIL with what moved. */

import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { resolve as resolvePath, dirname } from "node:path";
import { createHash } from "node:crypto";
import { ROOT, readJSON } from "./lib/load.mjs";
import { barnwrightCatalogue, shopStandardCatalogue, standardManufacturer } from "./lib/barnwright-company.mjs";
import { canonical } from "./lib/headless.mjs";
import { defaults, setType, fromState, toState } from "../model/design.js";
import { resolve as resolveCompany, strictProblems, validateManufacturer } from "../model/company.js";
import { optxList, priceParts } from "../model/pricing.js";
import { checkStyle } from "../model/style-check.js";
import { lockedItems } from "../ui/office/views/price-list/model.js";
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
/* e. the 8x12 and 10x12 Side Utility: the 48 in Wooden Door (Alan, Oct 11
      2026, asked how he builds them: "replace 6 foot to 4 foot") */
const SU48 = ["8x12", "10x12"];
let sameLayouts = 0;
{
  const items = (cat, key, size) => stateOf(cat, key, size).items.map((i) => ({ id: i.id, cat: i.cat, wall: i.wall, pos: r3(i.pos), inc: i.inc, origCat: i.origCat }));
  const J = (v) => JSON.stringify(v);
  /* the door side of the 8x12 and 10x12: the 48 in door in the middle, the
     two 2x3 windows where they were */
  for (const z of SU48) {
    const got = items(SHOP, "SU", z);
    ok(`Side Utility ${z}: the 48″ Wooden Door in the middle of the door side, the two 2×3 Windows 4.4 ft either side of it`,
      J(got) === J([{ id: "i0", cat: "w48", wall: "R", pos: 0, inc: true, origCat: "w48" }, { id: "i1", cat: "w23", wall: "R", pos: -4.4, inc: true, origCat: "w23" }, { id: "i2", cat: "w23", wall: "R", pos: 4.4, inc: true, origCat: "w23" }]), J(got));
  }
  /* no door or window runs into another, with nothing on the known list */
  const fit = checkStyle(SHOP, "SU", { sizes: SU48, framing: false });
  const touching = fit.problems.concat(fit.warnings).filter((f) => f.code === "overlap");
  ok("Side Utility 8×12 and 10×12: no window runs into the door, nor their trim (every-size check, nothing on the known list)", fit.buildings === 2 && touching.length === 0, J(touching.map((f) => f.words)));
  /* everything else: the same doors and windows as Barnwright's */
  for (const key of Object.keys(SHOP.TYPES)) {
    for (const z of Object.keys(SHOP.P[key])) {
      if (key === "SU" && SU48.includes(z)) continue;
      if (ok(`${now.styles[key].name} ${z}: the same standard doors and windows as Barnwright's`, J(items(SHOP, key, z)) === J(items(BW, key, z)), `${J(items(SHOP, key, z))} against ${J(items(BW, key, z))}`)) sameLayouts++;
    }
  }
  /* Barnwright's own Side Utility keeps its double doors (the golden test) */
  for (const z of SU48) ok(`Barnwright's own Side Utility ${z} keeps the 72″ Wooden Double Doors`, items(BW, "SU", z)[0].cat === "w72");
  /* the sample price list: the door comes with the building, so it is not charged, and the server agrees */
  const DEMO = resolveCompany(demoCompany(), SM, LIB);
  for (const z of SU48) {
    const s = stateOf(DEMO, "SU", z), parts = priceParts(s, DEMO);
    let sent = null; try { sent = priceDesign(fromState(s, DEMO), DEMO); } catch (e) { sent = e; }
    ok(`the sample price list's Side Utility ${z} comes with the 48″ Wooden Door, not charged, and the server prices it the same (${parts.total})`,
      s.items[0].cat === "w48" && !parts.lines.some((l) => /48″ Wooden Door/.test(J(l))) && parts.total === DEMO.P.SU[z] && !!sent && !!sent.price && sent.price.total === parts.total, sent && (sent.message || J(sent.price)));
  }
  /* a style of a business's own built like the Side Utility gets it too */
  const like = demoCompany(); like.offer.SUX1 = { base: "SU", name: "Premium Side Utility", sizes: { "8x12": 4000, "10x16": 5000 } }; like.categories[0][1].push("SUX1");
  const LIKE = resolveCompany(like, SM, LIB);
  ok("a Premium Side Utility built like the Side Utility: the 48″ Wooden Door at 8×12, the 72″ Wooden Double Doors at 10×16", items(LIKE, "SUX1", "8x12")[0].cat === "w48" && items(LIKE, "SUX1", "10x16")[0].cat === "w72");
  /* a price list that sells the Side Utility only (no other building comes
     with the 48 in door) and does not sell the 48 in door: the double doors
     stay, and the owner is told */
  const suOnly = (sizes) => { const c = demoCompany(); c.offer = { SU: { sizes: sizes || c.offer.SU.sizes } }; c.categories = [["Utility & Storage", ["SU"]]]; c.defaults = { style: "SU", size: Object.keys(c.offer.SU.sizes)[0], colors: c.defaults.colors }; delete c.items.w48; return c; };
  const no48 = suOnly();
  const NO48 = resolveCompany(no48, SM, LIB);
  const told = (NO48.settingsWarnings || []).filter((w) => /48″ Wooden Door/.test(w));
  ok("a price list without the 48″ Wooden Door still opens: its 8×12 Side Utility keeps the 72″ Wooden Double Doors", items(NO48, "SU", "8x12")[0].cat === "w72" && items(NO48, "SU", "10x12")[0].cat === "w72");
  ok("... and the owner reads why and what to do", told.length === 1 && told[0] === "Side Utility: the 8×12 and 10×12 come with the 48″ Wooden Door. Sell it on Doors & windows ($0 is fine); until then they keep the 72″ Wooden Double Doors.", J(told));
  ok("... nothing is said to a price list that sells it", !(DEMO.settingsWarnings || []).some((w) => /48″ Wooden Door/.test(w)), J(DEMO.settingsWarnings));
  /* a new price list must sell it (the save refuses only a new problem), and the Dealer Center keeps it sold */
  const want = "items.w48 needs a price: the 48″ Wooden Door (w48) comes as standard on the Side Utility (SU) at 8×12 and 10×12. 0 is fine for one that is never charged.";
  ok(`a price list selling the 8×12 Side Utility without the 48″ Wooden Door has the problem "${want}"`, strictProblems(no48, SM).includes(want), J(strictProblems(no48, SM)));
  const only16 = suOnly({ "10x16": 4800 });
  ok("... one that sells the Side Utility at no 8×12 nor 10×12 does not", !strictProblems(only16, SM).some((p) => /^items\.w48 /.test(p)) && !strictProblems(demoCompany(), SM).some((p) => /^items\.w48 /.test(p)), J(strictProblems(only16, SM)));
  /* the library's swap is checked like the rest of the library; a business may not hold one */
  const bad = JSON.parse(JSON.stringify(SM)); bad.styles.SU.built.standardSwaps = [{ sizes: ["8x12", "8x99x"], from: "w72", to: "w48" }, { sizes: ["10x16"], from: "w36", to: "w48" }];
  const mp = validateManufacturer(bad);
  ok("the library's swap is checked: a size written wrong, or a door the style does not come with there, is named", mp.some((p) => /^styles\.SU\.built\.standardSwaps\[0\]\.sizes must list sizes/.test(p)) && mp.some((p) => /^styles\.SU\.built\.standardSwaps\[1\]: the Side Utility at 10x16 comes without the 36″ Wooden Door \(w36\)/.test(p)) && validateManufacturer(SM).length === 0, JSON.stringify(mp));
  const biz = demoCompany(); biz.offer.SU.built = { standardSwaps: [{ sizes: ["8x16"], from: "w72", to: "w48" }] };
  ok("a business cannot hold a swap of its own (\"not a building setting\")", strictProblems(biz, SM).some((p) => /^offer\.SU\.built\.standardSwaps: "standardSwaps" is not a building setting/.test(p)) && items(resolveCompany(biz, SM, LIB), "SU", "8x16")[0].cat === "w72", JSON.stringify(strictProblems(biz, SM)));
  const locks = lockedItems(demoCompany(), SM);
  ok("the Dealer Center's Doors & windows tab keeps the 48″ Wooden Door sold (it comes with the Side Utility)", !!locks.w48 && (locks.w48.styles || []).includes("SU"), J(locks.w48));
}
console.log(`4e. The 8×12 and 10×12 Side Utility come with the 48″ Wooden Door in the middle of the door side, clear of both windows; ${sameLayouts} other buildings have Barnwright's doors and windows, Barnwright's own Side Utility keeps the doubles, and a price list must sell the 48″ door.`);

console.log("4. The 14 ft lofted barns keep today's height; no sample price list has the Steep roof and an owner can still make one; a business-wide pitch leaves the Dormer Shed at 7/12.");

/* 5. What the screens and Alan's papers say is what is drawn (round 2
      review, Oct 11 2026) */
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const ftIn = (inches) => BUILT.format("wallHeight", Math.round(inches * 16) / 16);
const and = (list) => (list.length < 2 ? list.join("") : list.slice(0, -1).join(", ") + " and " + list[list.length - 1]);
/* the eave a style is drawn with at each width it is sold in, measured
   level, in a builder's words: { 8: "1 11/16 in", ... } */
function drawnEaves(key, measuredAt) {
  const out = {};
  for (const z of Object.keys(now.styles[key].sizes)) {
    const m = measuredAt(key, z);
    out[width(z)] = BUILT.format("eaveOverhang", Math.round(m.eaveRightIn * 16) / 16);
  }
  return out;
}
/* "1 3/4 in at 8 ft wide, 1 15/16 in at 10 ft wide and 2 1/8 in at 12 ft
   wide", or the one number when every width has it */
function eaveWords(byW) {
  const ws = Object.keys(byW).map(Number).sort((a, b) => a - b);
  return new Set(ws.map((w) => byW[w])).size === 1 ? byW[ws[0]] : and(ws.map((w) => `${byW[w]} at ${w} ft wide`));
}
let eaveStyles = 0;
/* a. the How it's built box says the eave each style is drawn with */
{
  for (const [label, CAT, at] of [["shop standard", SHOP, (k, z) => now.styles[k].sizes[z]], ["Barnwright", BW, (k, z) => bwOf[k + " " + z]]]) {
    for (const key of Object.keys(CAT.TYPES)) {
      const eff = BUILT.effective(CAT, key).find((e) => e.id === "eaveOverhang");
      if (!eff) continue;
      const byW = drawnEaves(key, at), words = eaveWords(byW), ws = Object.keys(byW);
      const byWidth = new Set(Object.values(byW)).size > 1;
      eaveStyles++;
      ok(`${label} ${now.styles[key].name}: How it's built says the eave it is drawn with (${words})`,
        eff.words === words && (byWidth ? isObj(eff.value) && ws.every((w) => BUILT.format("eaveOverhang", eff.value[w]) === byW[w]) : typeof eff.value === "number"),
        `says ${JSON.stringify(eff.words)} (${JSON.stringify(eff.value)})`);
    }
  }
  /* the business-wide card and the empty box say it short: from the
     narrowest reach to the widest */
  const lb = BUILT.effective(SHOP, "LB").find((e) => e.id === "eaveOverhang");
  ok(`Lofted Barn: the empty eave box says "1 3/4 to 2 1/8 in" (${BUILT.shortWords ? BUILT.shortWords("eaveOverhang", lb.value) : "no shortWords"})`, !!BUILT.shortWords && BUILT.shortWords("eaveOverhang", lb.value) === "1 3/4 to 2 1/8 in");
  /* History and the warnings say the eave it was built with too */
  const SM2 = standardManufacturer();
  const before = demoCompany(), after = demoCompany();
  for (const k of ["LB", "MLB"]) after.offer[k].built = Object.assign({}, after.offer[k].built, { eaveOverhang: 2 });
  const lines = BUILT.describeChanges(before, after, SM2, LIB);
  for (const [k, name] of [["LB", "Lofted Barn"], ["MLB", "Metal Lofted Barn"]]) {
    const was = eaveWords(drawnEaves(k, (key, z) => now.styles[key].sizes[z]));
    ok(`History: "${name} eave overhang: ${was} → 2 in"`, lines.includes(`${name} eave overhang: ${was} → 2 in`), JSON.stringify(lines));
  }
  const typo = demoCompany(); typo.offer.MLB.built = Object.assign({}, typo.offer.MLB.built, { eaveOverhang: "two" });
  const mlbWas = eaveWords(drawnEaves("MLB", (k, z) => now.styles[k].sizes[z]));
  const warn = resolveCompany(typo, SM2, LIB).settingsWarnings || [];
  ok(`a typo in the Metal Lofted Barn's eave box says it is built at ${mlbWas} until it is fixed`, warn.some((w) => w.startsWith("Metal Lofted Barn: ") && w.endsWith(`it is built at ${mlbWas} (the standard).`)), JSON.stringify(warn));
}
/* b. DIFFERENCES #26 gives the barn heights and walls that are drawn */
{
  const diff = readFileSync(resolvePath(ROOT, "docs/DIFFERENCES.md"), "utf8");
  const row = diff.split("\n").find((l) => /^\s*\| Lofted Barn, Side Lofted Barn, Metal Lofted Barn, Lofted Barn Garage \| barn roof height at 8, 10, 12 ft wide/.test(l));
  const cells = row ? row.split("|").map((c) => c.trim()) : [];
  const peaks = (rows, k) => [8, 10, 12].map((w) => { const z = Object.keys(now.styles[k].sizes).find((x) => width(x) === w); return ftIn(rows(k, z).trussPeakIn); }).join(", ");
  const bwLB = peaks((k, z) => bwOf[k + " " + z], "LB"), bwMLB = peaks((k, z) => bwOf[k + " " + z], "MLB"), shopLB = peaks((k, z) => now.styles[k].sizes[z], "LB");
  ok(`DIFFERENCES #26: Barnwright's Lofted Barn and Side Lofted Barn are ${bwLB} tall at 8, 10 and 12 ft wide`, !!row && cells[3].startsWith(bwLB + " ") && peaks((k, z) => bwOf[k + " " + z], "SLB") === bwLB, cells[3]);
  ok(`DIFFERENCES #26: Barnwright's Metal Lofted Barn is ${bwMLB}`, !!row && cells[3].includes(`the Metal Lofted Barn ${bwMLB};`), cells[3]);
  ok(`DIFFERENCES #26: now ${shopLB}, the Lofted Barn Garage on its own ${ftIn(now.styles.LBG.sizes["12x24"].wallIn)} walls`, !!row && cells[4].startsWith(shopLB + " ") && cells[4].includes(`on its own ${ftIn(now.styles.LBG.sizes["12x24"].wallIn)} walls`), cells[4]);
  const wallRow = diff.split("\n").find((l) => /^\s*\| Lofted Barn, Side Lofted Barn, Metal Lofted Barn \| wall \|/.test(l));
  ok(`DIFFERENCES #26: their walls ${ftIn(bwOf["LB 10x16"].wallIn)} before, ${ftIn(now.styles.LB.sizes["10x16"].wallIn)} now`, !!wallRow && wallRow.includes(`| ${ftIn(bwOf["LB 10x16"].wallIn)} (`) && wallRow.includes(`| ${ftIn(now.styles.LB.sizes["10x16"].wallIn)} |`), wallRow);
}
/* c. FOR-ALAN: the 14 ft lofted barns, and no question asked twice */
{
  const forAlan = readFileSync(resolvePath(ROOT, "docs/FOR-ALAN.md"), "utf8");
  const BARNS = ["LB", "SLB", "MLB", "LBG"];
  const add14 = (c) => { for (const k of BARNS) if (c.offer[k] && !Object.keys(c.offer[k].sizes).some((z) => width(z) === 14)) c.offer[k].sizes["14x24"] = 9999; };
  const s14 = shopStandardCatalogue(add14), b14 = barnwrightCatalogue(add14);
  const lower = {};
  for (const k of BARNS) {
    const z = Object.keys(s14.P[k]).find((x) => width(x) === 14);
    const a = measures(s14, k, z).out, b = measures(b14, k, z).out;
    lower[k] = (b.wallIn + b.trussPeakIn) - (a.wallIn + a.trussPeakIn);
    const wantLower = SHOP_NUMBERS[k].wall != null ? b.wallIn - SHOP_NUMBERS[k].wall : 0;
    ok(`${s14.TYPES[k].name} ${z}: overall ${lower[k] ? ftIn(lower[k]) + " lower than today (its walls are the shop's, its roof today's)" : "as tall as today"}`, Math.abs(lower[k] - wantLower) < 1e-9, `${lower[k]} against ${wantLower}`);
  }
  const para = (forAlan.split(/\n(?=\* )/).find((p) => p.startsWith("* **14 ft wide lofted barns keep today's")) || "").replace(/\s+/g, " ");
  ok(`FOR-ALAN: the 14 ft lofted barns keep today's roof height, and with ${ftIn(SHOP_NUMBERS.LB.wall)} walls stand ${ftIn(lower.LB)} lower overall`, para.includes(`${ftIn(SHOP_NUMBERS.LB.wall)}`) && para.includes(`${ftIn(lower.LB)} lower overall`), para);
  /* the questions still open: none about a style Alan answered on Oct 11 */
  const open = forAlan.split("### Your shop numbers: what we still need from you")[1] || "";
  const items = (open.split(/\n### /)[0].match(/\n\d+\. \*\*[^*]+\*\*/g) || []).map((x) => x.trim());
  const ANSWERED = [["Garage", /(?<!Metal |Barn )\bGarages?\b/], ["Dog Kennel", /\bDog Kennels?\b/], ["Garden Utility", /\bGarden Utilit/], ["Dormer Shed", /\bDormer Sheds?\b/], ["Metal Lofted Barn", /\bMetal Lofted Barns?\b/], ["Lofted Barn Garage", /\bLofted Barn Garages?\b/], ["Metal Garage", /\bMetal Garages?\b/]];
  ok(`FOR-ALAN: ${items.length} open questions, none about a style Alan answered on Oct 11 (the Garage he said yes to at 14 ft wide too)`, items.length > 0 && items.every((q) => ANSWERED.every(([, re]) => !re.test(q))), items.filter((q) => ANSWERED.some(([, re]) => re.test(q))).join(" / "));
}
console.log(`5. What the screens and papers say is what is drawn: the eave on ${eaveStyles} styles (a barn's width by width), DIFFERENCES #26's barn heights, FOR-ALAN's 14 ft barns and its open questions.`);

const secs = ((performance.now() - T0) / 1000).toFixed(1);
if (failures.length) {
  console.log(`\nFAIL: ${failures.length} of ${pass + failures.length} checks failed.`);
  for (const f of failures.slice(0, 40)) console.log("  " + f);
  if (failures.length > 40) console.log(`  ... and ${failures.length - 40} more`);
  console.log(`\nIf a shop number was changed on purpose, run node tools/check-shop-numbers.mjs --record and say why in the commit.`);
  process.exit(1);
}
console.log(`\nPROVED (${pass} checks, ${secs} s): every standard building is drawn with Alan's shop numbers where he gave them (the Utility Shed, Side Utility, Garage, Dog Kennel, Garden Utility, Dormer Shed, Lofted Barn, Side Lofted Barn, Metal Lofted Barn and Lofted Barn Garage) and Barnwright's everywhere else (the Metal Garage and Metal Utility too), the 8×12 and 10×12 Side Utility come with the 48″ Wooden Door ("replace 6 foot to 4 foot"), and ${buildings} buildings (${fingerprints} triangle for triangle) are exactly as recorded in ${FILE}.`);
