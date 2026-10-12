/* Every data twin must reproduce the builder's named items, in order. */
import assert from "node:assert/strict";
import { barnwrightCatalogue } from "./lib/barnwright-company.mjs";
import { frameOf } from "../model/frame.js";
import { includedItems, evalDataRecipe, layoutVariants } from "../model/loadouts.js";
import { LOADOUT_TWINS } from "../model/loadout-twins.js";
const cat = barnwrightCatalogue();
let cases = 0;
for (const [key, recipe] of Object.entries(LOADOUT_TWINS)) for (const size of Object.keys(cat.P[key])) {
  const t = cat.TYPES[key];
  for (const variant of layoutVariants(t, size)) for (const depth of t.porch ? [4, 6] : [4]) {
    const t6 = Object.assign({}, t, { porchDepthFt: depth });
    const local = Object.assign({}, cat, { TYPES: Object.assign({}, cat.TYPES, { [key]: t6 }) });
    const frame = frameOf(Object.assign({ type: key, size }, variant), local);
    const ctx = { CAT: cat.CAT, span: frame.span, ws: frame.ws, porchDepth: depth };
    const named = includedItems(key, frame.W, frame.L, ctx), data = evalDataRecipe(recipe, frame.W, frame.L, ctx);
    assert.equal(data.length, named.length, `${key} ${size} ${JSON.stringify(variant)} ${depth}: count`);
    data.forEach((it, i) => {
      for (const field of ["cat", "wall", "inc", "origCat", "dbl", "shut", "id"]) assert.equal(it[field], named[i][field], `${key} ${size} ${field}`);
      assert.ok(Math.abs(it.pos - named[i].pos) <= 0.001, `${key} ${size} ${it.cat}: ${it.pos} != ${named[i].pos}`);
    });
    cases++;
  }
}
const frame = frameOf({ type: "SC", size: "12x24", pLen: 12 }, cat);
for (const [variant, position] of [[{ pLen: 12 }, -9], [{ pLen: 12, pFlip: true }, 9], [{ pLen: 12, pMid: true }, -3]]) {
  const fr = frameOf(Object.assign({ type: "SC", size: "12x24" }, variant), cat);
  const items = evalDataRecipe([{ cat: "ppost", wall: "R", at: { porchStart: 3 } }], fr.W, fr.L, { CAT: fr.CAT, ws: fr.ws, span: fr.span, t: fr.t, frame: fr });
  assert.equal(items[0].pos, position);
}
console.log(`check-loadout-twins: ${cases} builder layouts, every size and allowed porch choice, match in item order within 0.001 ft; porch anchors match.`);
