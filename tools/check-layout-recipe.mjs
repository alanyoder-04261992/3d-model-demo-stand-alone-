import assert from "node:assert/strict";
import { barnwrightCatalogue } from "./lib/barnwright-company.mjs";
import { frameOf } from "../model/frame.js";
import { itemW, resetItems } from "../model/layout.js";
import { evalDataRecipe, recipeEntries } from "../model/loadouts.js";
import { inferRecipe } from "../model/layout-recipe.js";
import { checkLayout } from "../model/layout-check.js";
import { loadoutTwin, builderEntryIndices } from "../model/loadout-twins.js";
const cat = barnwrightCatalogue(), fr = frameOf({ type: "UT", size: "10x20" }, cat);
const item = (pos, id = "test") => ({ id, cat: "w23", wall: "R", pos, inc: true, dbl: false });
function infer(items) { return inferRecipe(items, fr, { originalRecipe: [], originalItems: [] }); }
const center = infer([item(0)]); assert.equal(center[0].at, "center");
const moved = infer([item(0.25)]); assert.deepEqual(moved[0].at, { pos: "len*0.0125" });
const gap = infer([item(-10 + 1.5 + cat.CAT.w23.w / 2)]); assert.deepEqual(gap[0].at, { fromStart: "1.5" });
const pair = infer([item(-5, "left"), item(5, "right")]); assert.equal(pair.length, 1); assert.ok(pair[0].at.sym);
const third = infer([item(-20 / 6)]); assert.deepEqual(third[0].at, { pos: "len*-0.1667" });
for (const items of [[item(0)], [item(.25)], [item(-10 + 1.5 + cat.CAT.w23.w / 2)], [item(-5, "l"), item(5, "r")], [item(-20 / 6)]]) {
  const recipe = infer(items), got = evalDataRecipe(recipe, fr.W, fr.L, { t: fr.t, CAT: fr.CAT, span: fr.span, ws: fr.ws, frame: fr });
  for (const it of items) assert.ok(got.some((other) => Math.abs(other.pos - it.pos) < 1 / 12), `${it.pos}: recipe round trip`);
}
const su = { type: "SU", size: "8x12", items: [] }; const suFrame = frameOf(su, cat); resetItems(su, suFrame, cat);
assert.deepEqual(inferRecipe(su.items, suFrame), loadoutTwin("SU"), "Untouched crowded builder pair keeps exact formulas");
const cabin = { type: "C", size: "10x20", items: [] }, cabinFrame = frameOf(cabin, cat); resetItems(cabin, cabinFrame, cat);
const originalItems = cabin.items.map((it) => ({ ...it })), recipe = loadoutTwin("C");
cabin.items.find((it) => it.cat === "ppost").pos -= .25;
const changed = inferRecipe(cabin.items, cabinFrame, { originalItems, originalRecipe: recipe });
assert.ok(changed.some((e) => e.cat === "ppost" && e.at.pos && String(e.at.pos).startsWith("CAT.d36lite")), "Untouched half of builder pair keeps its formula");
assert.equal(changed.filter((e) => e.cat === "ppost").length, 2);
const small = { type: "C", size: "8x12", items: [] }, smallFrame = frameOf(small, cat); resetItems(small, smallFrame, cat);
assert.deepEqual(inferRecipe(small.items, smallFrame), recipe, "A hidden conditional builder window remains in its recipe");
const explicit = inferRecipe([item(1)], fr, { originalRecipe: [], originalItems: [], rules: { test: { at: { fromEnd: "2" }, when: { minL: 20 } } } });
assert.deepEqual(explicit[0].at, { fromEnd: "2" }); assert.deepEqual(explicit[0].when, { minL: 20 });
const conditional = [{ cat: "w72", wall: "F", at: "center" }, { cat: "w48", wall: "R", at: "center" }, { cat: "w23", wall: "R", at: { fromStart: "1.5" }, ifFits: true }];
for (const size of ["8x12", "12x24", "8x12", "12x24"]) {
  const frame = frameOf({ type: "UT", size }, cat), items = evalDataRecipe(conditional, frame.W, frame.L, { ...frame, frame });
  assert.equal(items.some((it) => it.entryIndex === 2), size === "12x24");
  assert.deepEqual(inferRecipe(items, frame, { originalItems: items, originalRecipe: conditional }), conditional, "Switching sizes cannot erase an owner's temporarily hidden window");
}
/* Adding the mirror of an existing source item changes the original pair's
   carry-over rule, even though the first item itself has not moved. */
const pairedSource = [{ cat: "w23", wall: "R", at: { pos: "3" }, ifFits: true }], pairedOriginal = evalDataRecipe(pairedSource, fr.W, fr.L, { ...fr, frame: fr });
const mirrored = { ...pairedOriginal[0], id: "mirror", pos: -3 };
const deliberatePair = inferRecipe([pairedOriginal[0], mirrored], fr, { originalItems: pairedOriginal, originalRecipe: pairedSource, touched: new Set([pairedOriginal[0].id]) });
assert.equal(deliberatePair.length, 1); assert.deepEqual(deliberatePair[0].at, { sym: "len*0.15" });
/* A removed member of a repeated builder row is removed only where it
   originally existed. Smaller rows and larger unseen members stay exact. */
const slopeRecipe = loadoutTwin("SS"), slopeFrame = frameOf({ type: "SS", size: "12x24" }, cat);
const slopeOriginal = evalDataRecipe(slopeRecipe, slopeFrame.W, slopeFrame.L, { ...slopeFrame, frame: slopeFrame });
const removedTransom = slopeOriginal.findLast((it) => it.cat === "tr");
const smallerRow = slopeOriginal.filter((it) => it !== removedTransom);
const slopeChanged = inferRecipe(smallerRow, slopeFrame, { originalItems: slopeOriginal, originalRecipe: slopeRecipe, sizes: Object.keys(cat.P.SS) });
assert.equal(checkLayout(slopeChanged, cat, "SS").ok, true, "Removing a transom must save at every sold size");
const builderIndices = builderEntryIndices(slopeChanged, slopeFrame.t);
for (const size of Object.keys(cat.P.SS)) {
  const frame = frameOf({ type: "SS", size }, cat), original = evalDataRecipe(slopeRecipe, frame.W, frame.L, { ...frame, frame });
  const changed = evalDataRecipe(slopeChanged, frame.W, frame.L, { ...frame, frame });
  const originalTransoms = original.filter((it) => it.cat === "tr"), newTransoms = changed.filter((it) => it.cat === "tr");
  const expected = originalTransoms.filter((it) => it._layoutOccurrence !== removedTransom._layoutOccurrence);
  assert.equal(newTransoms.length, expected.length, `${size}: only the removed occurrence disappears`);
  newTransoms.forEach((it, index) => {
    assert.equal(it.pos, expected[index].pos, `${size}: untouched transoms never move`);
    assert.ok(builderIndices.has(it.entryIndex), `${size}: surviving members retain builder identity`);
  });
}
const largestSlope = frameOf({ type: "SS", size: "12x32" }, cat);
const future = evalDataRecipe(slopeChanged, largestSlope.W, largestSlope.L, { ...largestSlope, frame: largestSlope }).filter((it) => it.cat === "tr");
assert.equal(future.length, 7, "Two unseen transoms on the largest sold size remain present");
/* The same source contract preserves a matched, repeated manufacturer's row. */
const repeatPair = [{ cat: "w23", wall: "R", at: { sym: "len*0.25" }, repeat: { count: "L>=24 ? 2 : 1", spread: 2 } }];
const pairFrame = frameOf({ type: "UT", size: "10x24" }, cat), pairSource = recipeEntries(repeatPair, pairFrame.W, pairFrame.L, { ...pairFrame, frame: pairFrame });
const pairLeft = pairSource.filter((it) => it._layoutOccurrence !== 1);
const pairChanged = inferRecipe(pairLeft, pairFrame, { originalItems: pairSource, originalRecipe: repeatPair, sizes: ["10x20", "10x24", "12x32"] });
assert.equal(recipeEntries(pairChanged, pairFrame.W, pairFrame.L, { ...pairFrame, frame: pairFrame }).length, 3);
console.log("check-layout-recipe: middle, 3 in Move, end gaps, matched pair, share, exact untouched builder entries and explicit rules survive inference.");
