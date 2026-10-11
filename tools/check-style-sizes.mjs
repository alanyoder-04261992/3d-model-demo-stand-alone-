/* CHECK: EVERY STYLE, AT EVERY SIZE IT IS SOLD IN, IS A BUILDING A SHOP COULD BUILD.
   Run: node tools/check-style-sizes.mjs              (everything)
        node tools/check-style-sizes.mjs --style LB   (one style; the fixtures still run)
        node tools/check-style-sizes.mjs --warnings   (also list every warning)
   check-all: node

   WHY. Alan (Oct 2026, "lets all 5 to make it as fast as possible") wants an
   automatic check of a style at every size instead of checking it by eye:
   doors and windows land cleanly, nothing overlaps, everything fits under
   the roof, the framing builds. A business can now set its own numbers, so
   this has to run every time those numbers change. The checks themselves
   are model/style-check.js (pure: the Dealer Center can run them too); this
   tool runs them on everything the repo sells and proves each one catches
   a real fault.

   WHAT IT PROVES
   1. EACH CHECK CATCHES A REAL FAULT. A broken test style for every check
      (a 5 ft wall under a 76 1/2 in door, a 12/12 roof with a 12 in eave on
      a 7 ft wall, a dormer on a 5/12 roof, a wider barn lower than a
      narrower one, 2x12 truss chords on a Standard Barn ...) is caught as a
      problem, in the plain words printed below; and the same building
      without the fault has no such problem.
   2. THE KNOWN LIST WORKS. A problem in test/style-sizes-known.json becomes
      a warning with its reason; the same problem without the list fails;
      a time budget stops early and lists what is left.
   3. EVERY LIBRARY STYLE AT EVERY SIZE Barnwright sells
      (test/golden/barnwright-catalogue.json), with its side porch lengths
      (corner, flipped, middle) and dormer sizes, twice: with the shop
      standard (library/manufacturers/standard.json as it is) and with
      Barnwright's own numbers (tools/lib/barnwright-company.mjs). While the
      two are the same, the second run is skipped and the table says so.
   4. EVERY STYLE THE DEMO AND STARTER COMPANIES SELL, at their sizes. A
      style that is the very same building as one already checked is not
      drawn twice (the table says which).
   5. No problem is left that the known list does not name with a reason,
      and no line of the known list is left that matches nothing.
   It prints a table (style, sizes, buildings, problems, warnings, time)
   and how long the whole run took. */

import { readJSON, readManufacturer, loadCatalogue } from "./lib/load.mjs";
import { barnwrightCompany, barnwrightCatalogue } from "./lib/barnwright-company.mjs";
import { resolve } from "../model/company.js";
import { makePlan } from "../model/plan.js";
import { frameOf } from "../model/frame.js";
import { defaults, setType } from "../model/design.js";
import { resetItems } from "../model/layout.js";
import { checkStyle, checkBuilding, variantsOf, lengthWords, CODES } from "../model/style-check.js";

const T0 = performance.now();
const args = process.argv.slice(2);
const ONLY = (() => { const i = args.indexOf("--style"); return i >= 0 ? args[i + 1] : null; })();
const SHOW_WARNINGS = args.includes("--warnings");
const LIB = readJSON("library/construction.json");
const KNOWN_FILE = readJSON("test/style-sizes-known.json");
const KNOWN = KNOWN_FILE.known || [];

let pass = 0, fail = 0;
const failures = [];
function ok(what, cond, extra) {
  if (cond) { pass++; return true; }
  fail++; failures.push(what + (extra ? "\n      " + extra : ""));
  return false;
}

/* --------------------------------------------------------------- the known list */

for (const [i, k] of KNOWN.entries()) {
  const where = `test/style-sizes-known.json line ${i + 1}`;
  ok(`${where} names a check`, CODES.includes(k.code), JSON.stringify(k.code));
  ok(`${where} names its styles`, Array.isArray(k.styles) && k.styles.length > 0);
  ok(`${where} gives the exact id the check prints`, typeof k.id === "string" && k.id.startsWith(k.code + ":"), JSON.stringify(k.id));
  ok(`${where} gives a reason a person can read`, typeof k.reason === "string" && k.reason.trim().length >= 20, JSON.stringify(k.reason));
}

/* ------------------------------------------------------------ test buildings */

/* A price list that sells only `offer` ({KEY: ["8x12", ...]}), built from
   the standard manufacturer with `styles` changed and the business's own
   `construction` on top: the broken test styles. */
function testCatalogue({ styles, construction, offer }) {
  const M = structuredClone(readManufacturer("standard"));
  for (const [k, v] of Object.entries(styles || {})) Object.assign(M.styles[k], v);
  const c = structuredClone(barnwrightCompany());
  c.offer = {};
  for (const [k, sizes] of Object.entries(offer)) c.offer[k] = { sizes: Object.fromEntries(sizes.map((z) => [z, 1000])) };
  delete c.categories;
  const k0 = Object.keys(offer)[0];
  c.defaults = Object.assign({}, c.defaults, { style: k0, size: offer[k0][0] });
  if (construction) c.construction = construction;
  return resolve(c, M, LIB);
}
const LIBRARY = barnwrightCatalogue();
/* A standard building with extra items added by hand (no clamp). */
function planWith(cat, key, size, items, set) {
  const st = defaults(cat);
  setType(st, key, cat);
  st.size = size;
  Object.assign(st, set || {});
  resetItems(st, frameOf(st, cat), cat);
  for (const it of items || []) st.items.push(Object.assign({ inc: false, shut: false }, it));
  return makePlan(st, cat);
}
const FLAT = (inches, rise12) => (inches / 12) * Math.hypot(12, rise12) / 12;   /* a flat overhang, along the slope */
const barnLower = (W) => (0.32 * W) / ((0.5 - 0.38) * W) * 12;                    /* the library barn's lower slope, per 12 */
const peakRules = (byW) => ({
  lowerRise: Object.entries(byW).map(([w, inches]) => ({ when: { minW: +w, maxW: +w }, value: { ft: inches / 12 * 32 / 45 } })).concat([{ value: { w: 0.32 } }]),
  upperRise: Object.entries(byW).map(([w, inches]) => ({ when: { minW: +w, maxW: +w }, value: { ft: inches / 12 * 13 / 45 } })).concat([{ value: { w: 0.13 } }]),
});

/* (A length in a construction setting is written as plain feet here: an
   object such as {"ft": 1} would be merged key by key into the library's
   {"w": 0.32}, and the "w" would still win.)
   Each fixture: a broken building, the check that must catch it, the words
   it must say, and the same building without the fault (the control),
   which must not have that problem. */
const FIXTURES = [
  { name: "a size that cannot be laid out (\"10xA\" slipped into a price list)", code: "draws",
    words: /^Utility Shed 10xA: this building could not be drawn: "10xA" is not a size \(it should look like 10x20\)\.$/,
    style: () => { const c = structuredClone(testCatalogue({ offer: { UT: ["10x16"] } })); c.P.UT["10xA"] = 1000; return checkStyle(c, "UT", { framing: false }); },
    control: () => checkStyle(testCatalogue({ offer: { UT: ["10x16"] } }), "UT", { framing: false }) },
  { name: "a 5 ft wall with a 76 1/2 in wooden door", code: "door-fit",
    words: /^Utility Shed 10x16: the 72″ Wooden Double Doors on the front should be 76 1\/2 in tall, but the wall leaves room for 55 5\/8 in\.$/,
    style: () => checkStyle(testCatalogue({ styles: { UT: { wallH: 5 } }, offer: { UT: ["10x16"] } }), "UT"),
    control: () => checkStyle(testCatalogue({ offer: { UT: ["10x16"] } }), "UT") },
  { name: "a 6 ft 6 in Side Utility wall: the window heads stand above it", code: "too-high",
    words: /^Side Utility 10x16: the head trim of the 2×3 Window on the right side is 1 1\/2 in above the top of the wall\.$/,
    style: () => checkStyle(testCatalogue({ styles: { SU: { wallH: 6.5 } }, offer: { SU: ["10x16"] } }), "SU"),
    control: () => checkStyle(testCatalogue({ offer: { SU: ["10x16"] } }), "SU") },
  { name: "a gable window pushed above the roof (the 18x24 on an 8 ft Utility Shed's front gable)", code: "too-high",
    words: /^Utility Shed 8x12: the 18×24 Gable Window on the front gable has its glass 9 in above the roof\.$/,
    building: () => checkBuilding(planWith(LIBRARY, "UT", "8x12", [{ id: "x1", cat: "g1824", wall: "F", pos: 0, vy: -1000 }]), { gableItems: false }),
    controlBuilding: () => checkBuilding(planWith(LIBRARY, "UT", "8x12", [{ id: "x1", cat: "g1824", wall: "F", pos: 0, vy: -1000 }].slice(1)), { gableItems: false }) },
  { name: "an 18x24 gable window on a 12 ft Utility Shed at 5/12, forced past the fit rule", code: "gable-item",
    words: /^Utility Shed 12x16: the 18×24 Gable Window, put under the peak of a gable as low as it goes, pokes 3 7\/8 in through the roof\.$/,
    style: () => checkStyle(testCatalogue({ construction: { roof: { shapes: { gable: { rise: { w: 5 / 24 } } } } }, offer: { UT: ["12x16"] } }), "UT", { allGableItems: true, framing: false }),
    control: () => checkStyle(testCatalogue({ offer: { UT: ["12x16"] } }), "UT", { allGableItems: true, framing: false }) },
  { name: "a 12/12 roof with a 12 in eave on a 7 ft wall", code: "eave",
    words: /^Side Utility 10x16: the roof edge hangs 7 3\/4 in in front of the head of the 72″ Wooden Double Doors on the right side\.$/,
    style: () => checkStyle(testCatalogue({ styles: { SU: { wallH: 7 } }, construction: { roof: { shapes: { gable: { rise: { w: 0.5 }, eaveOverhang: { left: FLAT(12, 12), right: FLAT(12, 12) } } } } }, offer: { SU: ["10x16"] } }), "SU", { framing: false }),
    control: () => checkStyle(testCatalogue({ styles: { SU: { wallH: 7 } }, offer: { SU: ["10x16"] } }), "SU", { framing: false }) },
  /* (on a 6 ft wall the library's own barn eave is already under 6 ft, so the
     wall here is 6 ft 6 in: today's eave clears 6 ft, a 3 in flat one does not) */
  { name: "a 3 in barn eave on a 6 ft 6 in wall", code: "eave",
    words: /^Side Lofted Barn 10x16: the roof edge over the right side is only 5 ft 10 in above the floor \(6 ft at least\)\.$/,
    style: () => checkStyle(testCatalogue({ styles: { SLB: { wallH: 6.5 } }, construction: { roof: { shapes: { gambrel: { eaveOverhang: { left: FLAT(3, barnLower(10)), right: FLAT(3, barnLower(10)) } } } } }, offer: { SLB: ["10x16"] } }), "SLB", { framing: false }),
    control: () => checkStyle(testCatalogue({ styles: { SLB: { wallH: 6.5 } }, offer: { SLB: ["10x16"] } }), "SLB", { framing: false }) },
  { name: "a dormer on a 5/12 roof 8 ft wide", code: "dormer",
    words: /^Dormer Shed 8x12 with the 6 ft dormer: the dormer front is only 1 ft 1 in tall; the roof is too flat for it \(1 ft 2 3\/8 in at least\)\.$/,
    style: () => checkStyle(testCatalogue({ construction: { roof: { dormerRise: { w: 5 / 24 } } }, offer: { DS: ["8x12"] } }), "DS", { framing: false }),
    control: () => checkStyle(testCatalogue({ offer: { DS: ["8x12"] } }), "DS", { framing: false }) },
  { name: "a corner porch too deep for its width (a 7 ft wide Deluxe Side Cabin: the 4 ft porch leaves no angled wall)", code: "porch",
    words: /^Deluxe Side Cabin 7x20: the angled porch wall would run backwards\.$/,
    style: () => checkStyle(testCatalogue({ offer: { DSC: ["7x20"] } }), "DSC", { framing: false }),
    control: () => checkStyle(testCatalogue({ offer: { DSC: ["12x20"] } }), "DSC", { framing: false }) },
  { name: "a window on the open side porch, where there is no wall", code: "porch",
    words: /^Side Cabin 12x24 with the 12 ft side porch at the corner: the 2×3 Window on the right side is where there is no wall \(the open porch\)\.$/,
    building: () => checkBuilding(planWith(LIBRARY, "SC", "12x24", [{ id: "x1", cat: "w23", wall: "R", pos: -8 }], { pLen: 12, pFlip: false, pMid: false }), { label: "Side Cabin 12x24 with the 12 ft side porch at the corner", gableItems: false }),
    controlBuilding: () => checkBuilding(planWith(LIBRARY, "SC", "12x24", [], { pLen: 12, pFlip: false, pMid: false }), { label: "Side Cabin 12x24 with the 12 ft side porch at the corner", gableItems: false }) },
  { name: "a porch post off the porch deck", code: "porch",
    words: /^Side Cabin 12x24: the Porch Post on the right side stands off the porch deck\.$/,
    building: () => checkBuilding(planWith(LIBRARY, "SC", "12x24", [{ id: "x1", cat: "ppost", wall: "R", pos: 3 }], { pLen: 12, pFlip: false, pMid: false }), { gableItems: false, framing: false }),
    controlBuilding: () => checkBuilding(planWith(LIBRARY, "SC", "12x24", [{ id: "x1", cat: "ppost", wall: "R", pos: -9 }], { pLen: 12, pFlip: false, pMid: false }), { gableItems: false, framing: false }) },
  { name: "a window placed past the wall end (no clamp)", code: "past-wall",
    words: /^Utility Shed 10x16: the 2×3 Window on the left side runs 1 ft 0 1\/2 in past the corner\.$/,
    building: () => checkBuilding(planWith(LIBRARY, "UT", "10x16", [{ id: "x1", cat: "w23", wall: "L", pos: 7.6 }]), { gableItems: false, framing: false }),
    controlBuilding: () => checkBuilding(planWith(LIBRARY, "UT", "10x16", [{ id: "x1", cat: "w23", wall: "L", pos: 0 }]), { gableItems: false, framing: false }) },
  { name: "two windows on top of each other", code: "overlap",
    words: /^Utility Shed 10x16: the 2×3 Window and another 2×3 Window on the left side overlap by 1 ft 1 1\/4 in\.$/,
    building: () => checkBuilding(planWith(LIBRARY, "UT", "10x16", [{ id: "x1", cat: "w23", wall: "L", pos: 0 }, { id: "x2", cat: "w23", wall: "L", pos: 1 }]), { gableItems: false, framing: false }),
    controlBuilding: () => checkBuilding(planWith(LIBRARY, "UT", "10x16", [{ id: "x1", cat: "w23", wall: "L", pos: -2 }, { id: "x2", cat: "w23", wall: "L", pos: 2 }]), { gableItems: false, framing: false }) },
  { name: "a barn with a 2 ft peak at 14 ft wide", code: "roof-widths",
    words: /^Lofted Barn: 12 ft wide is 5 ft 4 3\/4 in tall, taller than 14 ft wide \(2 ft\)\.$/,
    style: () => checkStyle(testCatalogue({ construction: { roof: { shapes: { gambrel: peakRules({ 14: 24 }) } } }, offer: { LB: ["12x24", "14x24"] } }), "LB", { framing: false }),
    control: () => checkStyle(testCatalogue({ offer: { LB: ["12x24", "14x24"] } }), "LB", { framing: false }) },
  { name: "a barn style whose 11 ft width is taller than its 12 ft width (the width hold switched off)", code: "roof-widths",
    words: /^Lofted Barn: 11 ft wide is 4 ft 11 3\/8 in tall, taller than 12 ft wide \(4 ft 3 in\)\.$/,
    style: () => checkStyle(testCatalogue({ construction: { roof: { shapes: { gambrel: peakRules({ 10: 48, 12: 51 }) } } }, offer: { LB: ["10x16", "11x16", "12x16"] } }), "LB", { framing: false }),
    control: () => checkStyle(testCatalogue({ construction: { roof: { shapes: { gambrel: peakRules({ 10: 48, 11: 49.5, 12: 51 }) } } }, offer: { LB: ["10x16", "11x16", "12x16"] } }), "LB", { framing: false }) },
  { name: "a barn roof whose upper slope is steeper than its lower slope", code: "roof",
    words: /^Lofted Barn 10x16: the barn roof's upper slope \(13\/12\) is steeper than its lower slope \(10\/12\)\.$/,
    style: () => checkStyle(testCatalogue({ construction: { roof: { shapes: { gambrel: { knee: { w: 0.12 } } } } }, offer: { LB: ["10x16"] } }), "LB", { framing: false }),
    control: () => checkStyle(testCatalogue({ offer: { LB: ["10x16"] } }), "LB", { framing: false }) },
  { name: "a 15/12 roof", code: "roof",
    words: /^Utility Shed 10x16: the roof pitch is 15\/12, steeper than 12\/12, the steepest the 3D designer draws\.$/,
    style: () => checkStyle(testCatalogue({ construction: { roof: { shapes: { gable: { rise: { w: 15 / 24 } } } } }, offer: { UT: ["10x16"] } }), "UT", { framing: false }),
    control: () => checkStyle(testCatalogue({ offer: { UT: ["10x16"] } }), "UT", { framing: false }) },
  { name: "a lofted barn roof too low for its loft", code: "loft",
    words: /^Lofted Barn 8x12: the loft has only 6 3\/4 in of headroom under the roof framing \(2 ft at least\)\.$/,
    style: () => checkStyle(testCatalogue({ construction: { roof: { shapes: { gambrel: { lowerRise: 1.0, upperRise: 0.4 } } } }, offer: { LB: ["8x12"] } }), "LB"),
    control: () => checkStyle(testCatalogue({ offer: { LB: ["8x12"] } }), "LB") },
  { name: "2x12 truss chords on a Standard Barn: the framing does not build", code: "framing",
    words: /^Standard Barn 8x12: 20 pairs of framing pieces overlap, the most by 1\/2 in \(two gussets of the roof framing\)\.$/,
    style: () => checkStyle(testCatalogue({ construction: { roof: { chord: "2x12" } }, offer: { SB: ["8x12"] } }), "SB"),
    control: () => checkStyle(testCatalogue({ offer: { SB: ["8x12"] } }), "SB") },
];

console.log("check-style-sizes: every style at every size it is sold in is a building a shop could build\n");
console.log("1. Each check catches a real fault (a broken test style each; the words it says):");
const caught = new Set();
for (const fx of FIXTURES) {
  let got, ctl;
  try { got = fx.style ? fx.style() : fx.building(); } catch (e) { ok(`fixture "${fx.name}" can be checked`, false, e.stack); continue; }
  const probs = got.problems.filter((f) => f.code === fx.code);
  const hit = probs.find((f) => fx.words.test(f.words));
  if (ok(`fixture "${fx.name}" is caught by ${fx.code} with its words`, !!hit, probs.length ? "it said: " + probs.map((f) => f.words).join(" | ") : "no " + fx.code + " problem at all")) {
    caught.add(fx.code);
    console.log(`   ${fx.code.padEnd(11)} ${hit.words}`);
  }
  try { ctl = fx.control ? fx.control() : fx.controlBuilding(); } catch (e) { ok(`fixture "${fx.name}": the building without the fault can be checked`, false, e.stack); continue; }
  const cprobs = ctl.problems.filter((f) => f.code === fx.code && f.id === (hit || {}).id);
  ok(`fixture "${fx.name}": the same building without the fault has no such problem`, cprobs.length === 0, cprobs.map((f) => f.words).join(" | "));
}
for (const code of CODES) ok(`the ${code} check has a fixture that proves it`, caught.has(code));

/* ------------------------------------------------------- the known list, budget */

console.log("\n2. The known list and the time budget:");
{
  const su = testCatalogue({ offer: { SU: ["8x12"] } });
  const bare = checkStyle(su, "SU", { framing: false });
  const p = bare.problems.find((f) => f.id === "overlap:R:w23/w72");
  ok("without the known list, Barnwright's 8x12 Side Utility layout is a problem (window into the double doors)", !!p);
  const listed = checkStyle(su, "SU", { framing: false, known: KNOWN });
  const w = listed.warnings.find((f) => f.id === "overlap:R:w23/w72");
  ok("with the known list it is a warning carrying the list's reason", !!w && !listed.problems.some((f) => f.id === "overlap:R:w23/w72") && /golden test/.test(w.known || ""));
  if (w) console.log(`   known: ${w.words}\n          reason: ${w.known}`);
  const lb = checkStyle(LIBRARY, "LB", { budgetMs: 0 });
  ok("a 0 ms budget checks no building, lists every size as not checked yet, and still compares the widths", lb.buildings === 0 && lb.unchecked.length === Object.keys(LIBRARY.P.LB).length && lb.results.length === 0);
  console.log(`   budget: with no time at all, ${lb.unchecked.length} sizes of the Lofted Barn are listed as not checked yet ("${lb.unchecked[0].words}" first: the size the designer opens on)`);
  const sc = variantsOf(LIBRARY.TYPES.SC, LIBRARY), ds = variantsOf(LIBRARY.TYPES.DS, LIBRARY), ut = variantsOf(LIBRARY.TYPES.UT, LIBRARY);
  ok("variants: a side porch is tried 8 and 12 ft long at the corner, flipped and in the middle; a dormer at each size; anything else once", sc.length === 6 && ds.length === 3 && ut.length === 1);
  let threw = null; try { checkStyle(LIBRARY, "NOPE"); } catch (e) { threw = e.message; }
  ok("a style the price list does not offer is refused in plain words", /"NOPE" is not a building style this price list offers/.test(threw || ""), threw);
  ok("lengths in a builder's words", lengthWords(2.375 / 12) === "2 3/8 in" && lengthWords(51 / 12) === "4 ft 3 in" && lengthWords(48.625 / 12) === "4 ft 0 5/8 in" && lengthWords(4) === "4 ft" && lengthWords(0.5 / 12) === "1/2 in");
}

/* ------------------------------------------------------------ what is sold */

/* The same building, whoever sells it: a style whose traits, sizes,
   construction, items and dormers are the same draws the same buildings. */
function fingerprint(cat, key) {
  const t = Object.assign({}, cat.TYPES[key]); delete t.name;
  const items = Object.keys(cat.CAT).sort().map((k) => { const c = Object.assign({}, cat.CAT[k]); delete c.n; delete c.p; return [k, c]; });
  return JSON.stringify([t, Object.keys(cat.P[key]), cat.construction, items, (cat.DORMERS || []).map((d) => d[0])]);
}
const shopStandard = resolve(barnwrightCompany(), readManufacturer("standard"), LIB);
const barnwrightNumbers = barnwrightCatalogue();
const sameNumbers = JSON.stringify([shopStandard.TYPES, shopStandard.construction]) === JSON.stringify([barnwrightNumbers.TYPES, barnwrightNumbers.construction]);
const RUNS = [
  { id: "library", words: "the library, shop standard", cat: shopStandard },
  { id: "barnwright", words: "the library, Barnwright's numbers", cat: barnwrightNumbers, skip: sameNumbers ? "the same numbers as the shop standard today: checked once" : null },
  { id: "demo", words: "demo company", cat: loadCatalogue("demo") },
  { id: "starter", words: "starter company", cat: loadCatalogue("starter") },
];

console.log("\n3-4. Every style at every size it is sold in (problems the known list names are counted as warnings):");
const seen = new Map();                 /* fingerprint -> "library UT" */
const rows = [], problems = [], warnings = [], knownHits = new Set();
let buildings = 0, buildingMs = 0;
for (const run of RUNS) {
  if (run.skip) { rows.push({ run: run.id, key: "(all)", note: run.skip }); continue; }
  for (const key of Object.keys(run.cat.TYPES)) {
    if (ONLY && key !== ONLY && run.cat.TYPES[key].base !== ONLY) continue;
    const fp = fingerprint(run.cat, key);
    if (seen.has(fp)) { rows.push({ run: run.id, key, note: "the same building as " + seen.get(fp) }); continue; }
    seen.set(fp, run.id + " " + key);
    const r = checkStyle(run.cat, key, { known: KNOWN });
    buildings += r.buildings; buildingMs += r.results.reduce((a, x) => a + x.ms, 0);
    r.knownHits.forEach((i) => knownHits.add(i));
    for (const f of r.problems) problems.push(run.id + ": " + f.words);
    for (const f of r.warnings) warnings.push({ run: run.id, f });
    rows.push({ run: run.id, key, name: r.name, sizes: Object.keys(run.cat.P[key]).length, buildings: r.buildings, problems: r.problems.length, warnings: r.warnings.length, known: r.warnings.filter((f) => f.known).length, ms: r.ms });
  }
}
console.log("   " + "price list".padEnd(11) + "style".padEnd(28) + "sizes  buildings  problems  warnings (known)    ms");
for (const r of rows) {
  if (r.note) { console.log("   " + r.run.padEnd(11) + r.key.padEnd(28) + r.note); continue; }
  console.log("   " + r.run.padEnd(11) + (r.key + " " + r.name).slice(0, 27).padEnd(28) + String(r.sizes).padStart(5) + String(r.buildings).padStart(11) + String(r.problems).padStart(10) +
    String(r.warnings).padStart(10) + (r.known ? ` (${r.known})` : "").padEnd(7) + r.ms.toFixed(0).padStart(7));
}

for (const p of problems) ok("no problem the known list does not name", false, p);
if (!problems.length) ok("no problem the known list does not name", true);
if (!ONLY) for (const [i, k] of KNOWN.entries()) ok(`test/style-sizes-known.json line ${i + 1} (${k.styles.join(", ")} ${k.id}) still matches a problem; take it out if the building is fixed`, knownHits.has(i));

/* the warnings, gathered: one line per kind with how many and one example */
const byId = new Map();
for (const { run, f } of warnings) { const g = byId.get(f.id) || { n: 0, eg: f, runs: new Set() }; g.n++; g.runs.add(run); byId.set(f.id, g); }
console.log(`\n   Warnings (shown, never failing): ${warnings.length} in ${byId.size} kinds${SHOW_WARNINGS ? "" : "; one example of each (--warnings lists them all)"}:`);
for (const [id, g] of [...byId].sort((a, b) => b[1].n - a[1].n)) console.log(`   ${String(g.n).padStart(4)} x ${g.eg.words}${g.eg.known ? "  [known]" : ""}`);
if (SHOW_WARNINGS) for (const { run, f } of warnings) console.log(`      ${run}: ${f.words}${f.known ? "  [known: " + f.known + "]" : ""}`);

const secs = (performance.now() - T0) / 1000;
console.log(`\n   ${buildings} buildings drawn and checked in ${(buildingMs / 1000).toFixed(1)} s (${(buildingMs / Math.max(1, buildings)).toFixed(1)} ms each); the whole run took ${secs.toFixed(1)} s.`);

console.log("\n" + (fail ? "FAILED" : "PASSED") + ": " + pass + " passed, " + fail + " failed.");
if (fail) {
  console.log("\nWhat failed:\n  " + failures.join("\n  "));
  process.exit(1);
}
console.log(`Proved: each of the ${CODES.length} checks catches a broken test style in plain words and passes the same building without the fault;`);
console.log(`every library style at every size (and the demo's and starter's) has no problem but the ${KNOWN.length} known ones in test/style-sizes-known.json, each with its reason.`);
