/* PROVE THE CONSTRUCTION SETTINGS ARE READ THE WAY THE CONTRACT SAYS.

   node tools/check-construction.mjs

   1. library/construction.json has the contract's defaults (skids, floor,
      walls, openings, roof, roof deck, loft, porch, build order, notes) and no
      badly written rules; its roof numbers are the same as the ones built into
      model/roof-shapes.js, so the two cannot drift.
   2. Rules settle per building: 8 ft wide and smaller get 2x4 joists, wider
      2x6; metal buildings get purlins, painted ones OSB; anchors by length;
      tests by style, roof and metal; the header rule (by opening width) is
      kept as a list and picked per opening.
   3. Options change the frame: 12 in joists -> floor.spacingIn 12; a double
      floor -> floor.deck.layers 2; a company extra can carry an effect too.
   4. Merge order: library < manufacturer < company < the options chosen --
      later wins, objects merge key by key, a list or value replaces.
   5. The door-height and window-top shop rules give Barnwright's exact numbers
      (71 1/2 in draws as 5.9583 ft), and follow a company's own numbers.
   6. Every building of every demo style settles without a leftover rule, and a
      company's roof numbers really move the roof line. */

import { readJSON, readManufacturer, loadCatalogue } from "./lib/load.mjs";
import { barnwrightCompany } from "./lib/barnwright-company.mjs";
import { resolve } from "../model/company.js";
import {
  resolveConstruction, mergeConstruction, pickRule, isRuleList, constructionProblems, effectsToTree,
  doorHeightFt, windowTopFt, constructionFor, buildingFacts,
} from "../model/construction.js";
import { DEFAULT_ROOF } from "../model/roof-shapes.js";
import { frameOf } from "../model/frame.js";
import { defaults } from "../model/design.js";

const counts = {};
const failures = [];
function check(group, ok, msg) {
  counts[group] = counts[group] || { pass: 0, fail: 0 };
  if (ok) counts[group].pass++; else { counts[group].fail++; failures.push(`[${group}] ${msg}`); }
  return ok;
}
const J = (v) => JSON.stringify(v);
const copy = (v) => JSON.parse(JSON.stringify(v));
const LIB = readJSON("library/construction.json");
const M = readManufacturer("standard");
const DEMO = loadCatalogue("demo");

/* ---------------------------------------------------------------- 1 */
check("the library's defaults", constructionProblems(LIB, "library").length === 0, constructionProblems(LIB, "library").join(" | "));
const L0 = resolveConstruction(LIB, { W: 10, L: 16, style: "UT", roof: "gable", metal: false });
const want = [
  ["site.blocks", "4x8x16"], ["site.perimeterFtPerBlock", 4],
  ["skids.size", "4x6"], ["skids.onEdge", true], ["skids.treated", true],
  ["skids.table", { "6": [6], "8": [18], "10": [30], "12": [8, 37], "14": [8, 54] }], ["skids.bunkSpacingIn", 60],
  ["floor.spacingIn", 16], ["floor.rim", "2x6"], ["floor.deck", { thicknessIn: 0.625, sheet: "4x8 T&G", layers: 1 }],
  ["walls.stud", "2x4"], ["walls.spacingIn", 16], ["walls.bottomPlates", 1], ["walls.topPlates", 2], ["walls.corner", "3-stud"],
  ["walls.studLengthIn", { loft: 75, tall: 89 }],
  ["openings.doorHeightIn", { gambrel: 71.5, other: 76.5 }],
  ["roof.framing", "truss"], ["roof.spacingIn", 24], ["roof.chord", "2x4"], ["roof.gussets", "plywood"],
  ["roofDeck.purlins", { size: "2x4", flat: true, spacingIn: 24 }],
  ["loft.joist", "2x6"], ["loft.spacingIn", 16], ["loft.deck", { thicknessIn: 0.625 }],
  ["porch.post", "4x4"], ["porch.joist", "2x6"], ["porch.railHeightIn", 34],
  ["buildOrder", ["site", "foundation", "skids", "floor-frame", "floor-deck", "wall-frame", "siding", "porch-frame", "roof-frame", "dormer-frame",
    "loft", "gable-end", "roof-deck", "roofing", "dormer", "trim", "porch", "doors", "windows", "extras", "interior", "ramp"]],
  ["notes", { "12": "A 12 ft wide building is 11 ft 2 in actual.", "14": "14 ft wide needs a permit or pilot car." }],
];
const at = (o, p) => p.split(".").reduce((a, k) => (a == null ? a : a[k]), o);
for (const [p, v] of want) check("the library's defaults", J(at(L0, p)) === J(v), `${p} is ${J(at(L0, p))}, the contract says ${J(v)}`);
check("the library's defaults", J(L0.roof.shapes) === J(DEFAULT_ROOF.shapes) && J(L0.roof.dormerRise) === J(DEFAULT_ROOF.dormerRise) && J(L0.roof.cottageEave) === J(DEFAULT_ROOF.cottageEave),
  "library/construction.json's roof shapes differ from the ones built into model/roof-shapes.js");
check("the library's defaults", !J(L0).includes("_help"), "notes (_help keys) were left in a settled construction");

/* ---------------------------------------------------------------- 2 */
const facts = (W, L, style, roof, metal) => ({ W, L, style, roof, metal });
for (const [W, joist] of [[6, "2x4"], [8, "2x4"], [10, "2x6"], [12, "2x6"], [14, "2x6"]]) {
  const r = resolveConstruction(LIB, facts(W, 16, "UT", "gable", false));
  check("rules settle per building", r.floor.joist === joist, `a ${W} ft wide building got ${r.floor.joist} joists, not ${joist}`);
}
check("rules settle per building", resolveConstruction(LIB, facts(10, 16, "MU", "gable", true)).roofDeck.type === "purlins", "a metal building did not get purlins");
check("rules settle per building", resolveConstruction(LIB, facts(10, 16, "UT", "gable", false)).roofDeck.type === "osb", "a painted building did not get OSB");
for (const [L, n] of [[8, 4], [16, 4], [20, 6], [28, 6], [32, 8], [40, 8]]) {
  check("rules settle per building", resolveConstruction(LIB, facts(10, L, "UT", "gable", false)).site.anchors === n, `a ${L} ft building did not get ${n} anchors`);
}
const header = L0.walls.header;
check("rules settle per building", isRuleList(header), "the header rule (by opening width) should stay a list for each opening to pick from");
for (const [span, h] of [[3.104, "2x6 doubled"], [4, "2x6 doubled"], [4.021, "2x8 doubled"], [6.333, "2x8 doubled"], [6.5, "2x8 doubled"], [8, "2x10 doubled"]]) {
  check("rules settle per building", pickRule(header, { spanFt: span }) === h, `a ${span} ft opening got a ${pickRule(header, { spanFt: span })} header, not ${h}`);
}
const custom = { x: [{ when: { styles: ["LB", "SLB"] }, value: "loft" }, { when: { roof: ["gambrel", "salt"] }, value: "steep" }, { when: { metal: false, minW: 12, maxL: 24 }, value: "wide short painted" }, { value: "other" }] };
for (const [f, v] of [[facts(10, 20, "LB", "gambrel", false), "loft"], [facts(10, 20, "LBC", "gambrel", false), "steep"], [facts(12, 24, "UT", "gable", false), "wide short painted"],
  [facts(12, 24, "MU", "gable", true), "other"], [facts(12, 28, "UT", "gable", false), "other"], [facts(10, 16, "CS", "salt", false), "steep"]]) {
  check("rules settle per building", resolveConstruction(custom, f).x === v, `${J(f)} gave ${resolveConstruction(custom, f).x}, not ${v}`);
}
{
  let err = null; try { resolveConstruction({ x: [{ when: { maxWidth: 8 }, value: 1 }, { value: 2 }] }, facts(8, 12, "UT", "gable", false)); } catch (e) { err = e; }
  check("rules settle per building", !!err && /"maxWidth", which is not something a rule can test/.test(err.message), "an unknown rule test was not refused in plain words");
  err = null; try { resolveConstruction({ x: [{ when: { maxW: 8 }, value: 1 }] }, facts(10, 12, "UT", "gable", false)); } catch (e) { err = e; }
  check("rules settle per building", !!err && /No construction rule matched/.test(err.message), "a rule list with no match and no fallback was not refused in plain words");
  check("rules settle per building", constructionProblems({ x: [{ when: { maxW: 8 }, value: 1 }] }).some((e) => /last rule should have no/.test(e)), "validation did not spot a rule list without a fallback");
}

/* ---------------------------------------------------------------- 3 option effects */
function stateFor(cat, t, z, opts) { const s = defaults(cat); s.type = t; s.size = z; Object.assign(s.opts, opts || {}); return s; }
{
  const none = frameOf(stateFor(DEMO, "UT", "10x16"), DEMO).construction;
  const jo = frameOf(stateFor(DEMO, "UT", "10x16", { jo12: true }), DEMO).construction;
  const db = frameOf(stateFor(DEMO, "UT", "10x16", { dbl: true }), DEMO).construction;
  const both = frameOf(stateFor(DEMO, "UT", "10x16", { dbl: true, jo12: true }), DEMO).construction;
  check("options change the frame", none.floor.spacingIn === 16 && none.floor.deck.layers === 1, "without options the floor should be 16 in, one layer");
  check("options change the frame", jo.floor.spacingIn === 12 && jo.floor.deck.layers === 1, `12 in joists gave spacing ${jo.floor.spacingIn}`);
  check("options change the frame", db.floor.deck.layers === 2 && db.floor.spacingIn === 16, `a double floor gave ${db.floor.deck.layers} layers`);
  check("options change the frame", both.floor.deck.layers === 2 && both.floor.spacingIn === 12 && both.floor.deck.thicknessIn === 0.625, "both options together lost one of them");
  check("options change the frame", J(effectsToTree({ "floor.deck.layers": 2, "walls.spacingIn": 24 })) === J({ floor: { deck: { layers: 2 } }, walls: { spacingIn: 24 } }), "effectsToTree did not build the tree");
  const bc = barnwrightCompany();
  bc.options.extras = [{ key: "tight-studs", name: "Studs 12 in on centre", input: "check", price: 300, construction: { "walls.spacingIn": 12 } }];
  const catX = resolve(bc, M, LIB);
  const s = stateFor(catX, "UT", "10x16"); s.xopt = { "tight-studs": 1 };
  check("options change the frame", frameOf(s, catX).construction.walls.spacingIn === 12, "a company extra's construction effect was not applied");
  s.xopt = {};
  check("options change the frame", frameOf(s, catX).construction.walls.spacingIn === 16, "a company extra's effect applied while it was off");
}

/* ---------------------------------------------------------------- 4 merge order */
{
  const man = copy(M); man.construction = { floor: { spacingIn: 19.2, rim: "2x8" }, walls: { header: "4x10" } };
  const base = barnwrightCompany();
  const withCo = copy(base); withCo.construction = { floor: { spacingIn: 24 }, walls: { stud: [{ when: { minW: 12 }, value: "2x6" }, { value: "2x4" }] } };
  const cM = resolve(base, man, LIB), cC = resolve(withCo, man, LIB);
  const f = (cat, t, z, o) => frameOf(stateFor(cat, t, z, o), cat).construction;
  check("merge order: library < manufacturer < company < options", f(cM, "UT", "10x16").floor.spacingIn === 19.2, "the manufacturer did not override the library");
  check("merge order: library < manufacturer < company < options", f(cM, "UT", "10x16").floor.rim === "2x8" && f(cM, "UT", "10x16").floor.deck.layers === 1, "a manufacturer override lost the library's other floor settings");
  check("merge order: library < manufacturer < company < options", f(cC, "UT", "10x16").floor.spacingIn === 24, "the company did not override the manufacturer");
  check("merge order: library < manufacturer < company < options", f(cC, "UT", "10x16").floor.rim === "2x8", "a company override lost the manufacturer's rim");
  check("merge order: library < manufacturer < company < options", f(cC, "UT", "10x16", { jo12: true }).floor.spacingIn === 12, "the option did not override the company");
  check("merge order: library < manufacturer < company < options", f(cC, "UT", "12x20").walls.stud === "2x6" && f(cC, "UT", "10x16").walls.stud === "2x4", "a company rule list did not replace the library value per building");
  check("merge order: library < manufacturer < company < options", f(cM, "UT", "10x16").walls.header === "4x10", "a plain value did not replace the library's header rule list");
  const m2 = mergeConstruction({ a: [1, 2], b: { c: 1, d: 2 } }, { a: [3], b: { c: 5 } });
  check("merge order: library < manufacturer < company < options", J(m2) === J({ a: [3], b: { c: 5, d: 2 } }), "mergeConstruction did not merge objects and replace lists");
}

/* ---------------------------------------------------------------- 5 opening rules */
check("door height and window top", doorHeightFt(L0, "gambrel") === 5.9583, `71.5 in drew as ${doorHeightFt(L0, "gambrel")} ft, Barnwright draws 5.9583`);
check("door height and window top", doorHeightFt(L0, "gable") === 6.375 && doorHeightFt(L0, "salt") === 6.375 && doorHeightFt(null, "lean") === 6.375, "76.5 in should draw as 6.375 ft on every other roof");
check("door height and window top", doorHeightFt({ openings: { doorHeightIn: { gambrel: 72, other: 80 } } }, "gambrel") === 6, "a company's own door height was not used");
for (const [roof, wallH, want2] of [["gambrel", 6.67, 6.67 - 5 / 12], ["gambrel", 6.9, 6.9 - 5 / 12], ["gable", 7.75, 6.375], ["gable", 6.4, 6.4 - 0.15], ["slope", 7.0, 6.375], ["gable", 4.2, 4.2 - 0.15]]) {
  check("door height and window top", windowTopFt(L0, roof, wallH) === want2, `window top on a ${wallH} ft ${roof} wall: ${windowTopFt(L0, roof, wallH)}, Barnwright ${want2}`);
}
check("door height and window top", windowTopFt({ openings: { doorHeightIn: { other: 80 }, windowTop: { other: { levelWithDoor: true, minBelowWallTopFt: 0.15 } } } }, "gable", 7.75) === Math.min(Math.round(80 / 12 * 1e4) / 1e4, 7.6),
  "the window top did not follow a company's door height");

/* ---------------------------------------------------------------- 6 every demo building */
let settled = 0;
for (const t of Object.keys(DEMO.P)) for (const z of Object.keys(DEMO.P[t])) {
  const s = stateFor(DEMO, t, z);
  const c = frameOf(s, DEMO).construction;
  const lists = [];
  (function walk(v, p) {
    if (isRuleList(v)) { if (p !== "walls.header") lists.push(p); return; }
    if (v && typeof v === "object" && !Array.isArray(v)) for (const k of Object.keys(v)) walk(v[k], p ? p + "." + k : k);
  })(c, "");
  check("every demo building settles", lists.length === 0, `${t} ${z} still has rule lists at ${lists.join(", ")}`);
  const d = frameOf(s, DEMO).d;
  check("every demo building settles", c.floor.joist === (d.W <= 8 ? "2x4" : "2x6"), `${t} ${z} joists ${c.floor.joist}`);
  check("every demo building settles", J(c) === J(constructionFor(DEMO, s, DEMO.TYPES[t], d)) && J(buildingFacts(t, DEMO.TYPES[t], d)) === J({ W: d.W, L: d.L, style: t, roof: DEMO.TYPES[t].roof, metal: !!DEMO.TYPES[t].metal }), `${t} ${z} construction is not stable`);
  settled++;
}
{
  const bc = barnwrightCompany(); bc.construction = { roof: { shapes: { gable: { rise: { w: 0.35 } } } } };
  const steep = resolve(bc, M, LIB);
  const a = frameOf(stateFor(DEMO, "UT", "10x16"), DEMO).prof, b = frameOf(stateFor(steep, "UT", "10x16"), steep).prof;
  check("every demo building settles", Math.abs((b[1][1] - a[1][1]) - 10 * (0.35 - 0.27)) < 1e-12, "a company's roof rise did not move the roof line");
}

/* ------------------------------------------------ bad values are named */
{
  /* A typo in a lumber size used to pass and then break the Framing view;
     settings with impossible values must be refused, in plain words. */
  const bad = [
    [{ roof: { chord: "2y4" } }, /roof\.chord: "2y4" is not a lumber size/],
    [{ walls: { header: [{ when: { maxSpanFt: 4 }, value: "2x6 doubled" }, { value: "2z10" }] } }, /walls\.header: "2z10" is not a lumber size/],
    [{ floor: { spacingIn: 0 } }, /floor\.spacingIn: 0 is not a spacing/],
    [{ walls: { topPlates: 7 } }, /walls\.topPlates: 7 should be a whole number from 1 to 3/],
    [{ roof: { framing: "beams" } }, /roof\.framing: "beams" should be one of truss or rafter/],
    [{ roofDeck: { type: "tin" } }, /roofDeck\.type: "tin" should be one of purlins or osb/],
    [{ buildOrder: ["skids", "skids"] }, /"skids" is listed twice/],
    [{ buildOrder: ["frame"] }, /"frame" is not a building step/],
  ];
  for (const [tree, re] of bad) {
    const bc = barnwrightCompany(); bc.construction = tree;
    let msgs = [];
    try { resolve(bc, M, LIB); msgs = ["(accepted)"]; } catch (e) { msgs = String(e.message || e).split("\n"); }
    check("bad construction values are refused in plain words", msgs.some((m) => re.test(m)), `${JSON.stringify(tree)} gave: ${msgs.slice(0, 3).join(" | ")}`);
  }
  const good = barnwrightCompany(); good.construction = { walls: { stud: "2x6", spacingIn: 24, header: [{ value: "2x8 tripled" }] }, roof: { framing: "Rafter", chord: "2x6" }, floor: { deck: { layers: 2 } } };
  let okGood = true; try { resolve(good, M, LIB); } catch (e) { okGood = false; }
  check("bad construction values are refused in plain words", okGood, "a sensible company construction block (2x6 studs at 24 in, tripled 2x8 headers, rafters) was refused");
}

/* ---------------------------------------------------------------- report */
let total = 0, bad = 0;
console.log("Construction settings:");
for (const [g, c] of Object.entries(counts)) {
  total += c.pass + c.fail; bad += c.fail;
  console.log(`  ${c.fail ? "FAIL" : "ok  "} ${g}: ${c.pass} passed${c.fail ? `, ${c.fail} failed` : ""}`);
}
if (failures.length) { console.log("\nProblems:"); for (const f of failures.slice(0, 40)) console.log("  " + f); }
console.log(`\n${total - bad} of ${total} checks passed (${settled} demo buildings settled).`);
if (bad) process.exit(1);
console.log("Proved: construction rules settle per building, options change the frame, later layers win in the contract's order, and the shop's door and window heights come out as Barnwright draws them.");
