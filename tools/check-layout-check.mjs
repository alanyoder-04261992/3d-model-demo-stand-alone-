/* The owner's every-size result must agree with the customer's real layout.
   Covers BUILD-PLAN test 19, including its corrected porch and transom cases. */
import assert from "node:assert/strict";
import { loadCatalogue } from "./lib/load.mjs";
import { checkLayout } from "../model/layout-check.js";
import { loadoutTwin } from "../model/loadout-twins.js";
import { frameOf } from "../model/frame.js";
import { evalDataRecipe, layoutVariants } from "../model/loadouts.js";
import { resetItems, itemW } from "../model/layout.js";

const cat = loadCatalogue("demo"), copy = (v) => JSON.parse(JSON.stringify(v));
let passed = 0;
const check = (name, fn) => { fn(); passed++; console.log("PASS " + name); };
const added = (key, ...entries) => loadoutTwin(key).concat(entries);
const evaluate = (key, recipe, size, variant = {}) => {
  const state = { type: key, size, ...variant, items: [] }, frame = frameOf(state, cat);
  return evalDataRecipe(recipe, frame.W, frame.L, { ...frame, frame });
};
const ownCat = (key, recipe) => ({ ...cat, TYPES: { ...cat.TYPES, [key]: { ...cat.TYPES[key], builderLoadout: cat.TYPES[key].loadout, loadout: recipe } } });

check("Lofted Barn warns exactly which small sizes leave off the owner's middle window", () => {
  const recipe = added("LB", { cat: "d36lite", wall: "R", at: { fromStart: "1.5" } }, { cat: "w23", wall: "R", at: "center", ifFits: true }, { cat: "w23", wall: "R", at: { fromEnd: "2" }, ifFits: true });
  const r = checkLayout(recipe, cat, "LB");
  assert.equal(r.ok, true); assert.equal(r.sizes.length, 14);
  assert.ok(r.warnings.includes("On the 8×12 and 10×12 the 2×3 window in the middle of the right side doesn't fit, so it's left off there."));
  assert.equal(r.examples.length, 3);
});

check("two 48 inch doors fail small sizes and offer the exact length rule", () => {
  const recipe = [{ cat: "w48", wall: "R", at: "center" }, { cat: "w48", wall: "R", at: { pos: "len*0.25" } }];
  const r = checkLayout(recipe, cat, "UT");
  assert.equal(r.ok, false); assert.ok(r.errors.some((s) => s.includes("closer than 7 1/2 in")));
  assert.deepEqual(r.fixes.find((f) => f.entryIndex === 1)?.when, { minL: 20 });
  const fixed = copy(recipe); fixed[1].when = r.fixes[0].when;
  assert.equal(checkLayout(fixed, cat, "UT").ok, true);
});

check("every size needs a door, including porch-inside doors", () => {
  assert.equal(checkLayout([{ cat: "w23", wall: "R", at: "center", ifFits: true }], cat, "LB").ok, false);
  assert.match(checkLayout([], cat, "LB").errors.join(" "), /every size needs a door/i);
  assert.equal(checkLayout(loadoutTwin("SC"), cat, "SC").ok, true);
  assert.equal(checkLayout(loadoutTwin("DSC"), cat, "DSC").ok, true);
});

check("Single Slope keeps its transom row and agrees on the owner's lower window", () => {
  const base = checkLayout(loadoutTwin("SS"), cat, "SS");
  assert.equal(base.ok, true); assert.deepEqual(base.warnings, []);
  assert.equal(base.checks.find((c) => c.size === "12x24").items.filter((i) => i.cat === "tr").length, 6);
  const recipe = added("SS", { cat: "w23", wall: "R", at: { pos: "len*0.175" }, ifFits: true });
  const r = checkLayout(recipe, cat, "SS"), kept = [];
  for (const c of r.checks) {
    const actual = evaluate("SS", recipe, c.size);
    const runtimeHas = actual.some((i) => i.entryIndex === recipe.length - 1);
    assert.equal(c.items.some((i) => i.entryIndex === recipe.length - 1), runtimeHas);
    if (runtimeHas) kept.push(c.size);
  }
  assert.deepEqual(kept, ["10x20", "12x20", "12x24", "12x32"]);
  assert.equal(r.leftOff.flatMap((p) => p.sizes).length, 5);
});

check("builder's crowded Side Utility windows remain exact and never get left off", () => {
  const recipe = loadoutTwin("SU"), r = checkLayout(recipe, cat, "SU"), c = r.checks.find((c) => c.size === "8x12");
  assert.equal(r.ok, true); assert.deepEqual(r.warnings, []);
  assert.equal(c.items.filter((i) => i.cat === "w23").length, 2);
  const state = { type: "SU", size: "8x12" }; resetItems(state, null, cat);
  assert.deepEqual(c.items.map((i) => [i.cat, i.wall, i.pos]), state.items.map((i) => [i.cat, i.wall, i.pos]));
});

check("wrap-porch openings get one shared fit result, while Cabin sides are real wall", () => {
  const at = { fromStart: "0.5" };
  const win = checkLayout(added("DSC", { cat: "w23", wall: "R", at, ifFits: true }), cat, "DSC");
  assert.equal(win.ok, true); assert.match(win.warnings.join(" "), /would stand in the open porch/);
  assert.equal(win.checks.every((c) => c.leftOff.length === 1), true);
  const door = checkLayout(added("DSC", { cat: "d36in", wall: "R", at }), cat, "DSC");
  assert.equal(door.ok, false); assert.match(door.errors.join(" "), /would stand in the open porch/);
  const cabin = checkLayout(added("C", { cat: "w23", wall: "R", at, ifFits: true }), cat, "C");
  assert.equal(cabin.ok, true); assert.deepEqual(cabin.leftOff.flatMap((p) => p.sizes), ["8x12"]);
});

check("Cabin builder posts stay at two feet and owners' posts are held at the porch end", () => {
  const base = checkLayout(loadoutTwin("C"), cat, "C");
  assert.deepEqual(base.checks.find((c) => c.size === "8x12").items.filter((i) => i.cat === "ppost").map((i) => i.pos), [-2, 2]);
  const r = checkLayout(added("C", { cat: "ppost", wall: "F", at: { pos: "4" } }), cat, "C");
  assert.equal(r.ok, true); assert.equal(r.leftOff.length, 0);
  assert.equal(r.checks.find((c) => c.size === "8x16").items.at(-1).pos, 3.2);
});

check("duplicate posts warn without any Everything fits claim on affected drawings", () => {
  const base = loadoutTwin("C").filter((e) => e.cat !== "ppost");
  const same = checkLayout(base.concat([{ cat: "ppost", wall: "F", at: { pos: "2" } }, { cat: "ppost", wall: "F", at: { pos: "2" } }]), cat, "C");
  assert.equal(same.ok, true);
  assert.ok(same.warnings.includes("Two porch posts stand in the same spot on the front of the porch. Move one, or remove it."));
  assert.ok(!same.summary.includes("Everything fits"));
  assert.ok(same.examples.every((e) => !e.caption.includes("Everything fits")));
  const ends = checkLayout(base.concat([{ cat: "ppost", wall: "F", at: { pos: "3.5" } }, { cat: "ppost", wall: "F", at: { pos: "4.5" } }]), cat, "C");
  assert.ok(ends.warnings.includes("On the 8×12 and 8×16 two porch posts stand in the same spot at the end of the porch. Move one, or remove it."));
  assert.equal(ends.checks.find((c) => c.size === "8x12").allFits, false);
});

check("Side Cabin checks every porch choice and never clamps an added window onto another", () => {
  const recipe = added("SC", { cat: "w23", wall: "R", at: { pos: "len*0.0833" }, ifFits: true }), r = checkLayout(recipe, cat, "SC");
  assert.equal(r.ok, true); assert.match(r.warnings.join(" "), /when the customer taps Middle porch/);
  const middle = r.checks.find((c) => c.size === "12x24" && c.variant.pLen === 12 && c.variant.pMid);
  assert.equal(middle.items.some((i) => i.entryIndex === recipe.length - 1), false);
  const own = ownCat("SC", recipe);
  for (const size of Object.keys(cat.P.SC)) for (const variant of layoutVariants(cat.TYPES.SC, size)) {
    const state = { type: "SC", size, ...variant }; resetItems(state, null, own);
    const windows = state.items.filter((i) => i.wall === "R" && i.cat === "w23");
    for (let a = 0; a < windows.length; a++) for (let b = a + 1; b < windows.length; b++) assert.ok(Math.abs(windows[a].pos - windows[b].pos) - (itemW(windows[a], cat.CAT) + itemW(windows[b], cat.CAT)) / 2 >= 0.62 - 1e-8);
    assert.deepEqual(state.items.map((i) => [i.cat, i.wall, i.pos]), r.checks.find((c) => c.size === size && JSON.stringify(c.variant) === JSON.stringify(variant)).items.map((i) => [i.cat, i.wall, i.pos]));
  }
  assert.deepEqual(checkLayout(loadoutTwin("SC"), cat, "SC").warnings, []);
});

check("Side Cabin merges the held-post warning across matching porch choices", () => {
  const recipe = loadoutTwin("SC"); recipe[10] = { cat: "ppost", wall: "R", at: { porchStart: 7.5 } };
  const r = checkLayout(recipe, cat, "SC");
  assert.equal(r.ok, true);
  assert.ok(r.warnings.includes("If a customer picks the 4 × 8 porch at the front end and in the middle (Middle porch), two porch posts end up in the same spot at the end of the porch, on every size. Move one, or remove it."));
  assert.ok(!r.summary.includes("Everything fits"));
});

check("an owner's door gives way to the settled builder window pair", () => {
  const recipe = added("SU", { cat: "w36", wall: "R", at: { pos: "9.4166666667" } }), r = checkLayout(recipe, cat, "SU");
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((s) => s.includes("second 2×3 window of the pair on the right side")));
  const state = { type: "SU", size: "12x24" }; resetItems(state, null, cat);
  const c = r.checks.find((c) => c.size === "12x24");
  assert.deepEqual(c.items.slice(0, 3).map((i) => i.pos), state.items.map((i) => i.pos));
});

check("time budgets leave a clear unfinished result and no success claim", () => {
  const r = checkLayout(loadoutTwin("SC"), cat, "SC", { budgetMs: 0 });
  assert.equal(r.ok, false); assert.ok(r.unchecked.length); assert.ok(!r.summary.includes("Everything fits"));
  assert.match(r.summary, /^Checked 0 sizes/);
});

check("an owner's duplicate of a canonical builder door must fit in its own right", () => {
  const recipe = loadoutTwin("UT").concat(loadoutTwin("UT")), r = checkLayout(recipe, cat, "UT");
  assert.equal(r.ok, false); assert.match(r.errors.join(" "), /closer than 7 1\/2 in/);
});

check("windows give way to doors even when their recipe entry comes first", () => {
  const recipe = [{ cat: "w23", wall: "R", at: "center", ifFits: true }, { cat: "w48", wall: "R", at: "center" }];
  const r = checkLayout(recipe, cat, "UT");
  assert.equal(r.ok, true); assert.equal(r.leftOff.length, 1);
  assert.deepEqual(r.leftOff[0].sizes, r.sizes);
  assert.ok(r.checks.every((c) => c.items.length === 1 && c.items[0].cat === "w48"));
  assert.ok(r.checks.every((c) => c.leftOff.length === 1));
});

check("a door size rule is never offered if it leaves a small size with no door", () => {
  const recipe = [{ cat: "w72", wall: "R", at: { pos: "len*0.25" } }], r = checkLayout(recipe, cat, "UT");
  assert.equal(r.ok, false); assert.deepEqual(r.fixes, []);
});

check("posts must stay on their porch edge and ordinary equipment stays out of a standard layout", () => {
  assert.equal(checkLayout(added("UT", { cat: "ppost", wall: "F", at: "center" }), cat, "UT").ok, false);
  assert.equal(checkLayout(added("C", { cat: "ppost", wall: "B", at: "center" }), cat, "C").ok, false);
  assert.equal(checkLayout(added("C", { cat: "bench", wall: "F", at: "center" }), cat, "C").ok, false);
});

console.log(`Standard-layout check: ${passed} groups passed.`);
