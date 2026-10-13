/* Included opening choices must show the actual quote contribution, rather
   than the replacement's standalone price. check-all: node */
import assert from "node:assert/strict";
import { loadCatalogue } from "./lib/load.mjs";
import { defaults } from "../model/design.js";
import { priceParts } from "../model/pricing.js";
import * as S from "../ui/state.js";
import { replacementCharge } from "../ui/sheet.js";

const cat = loadCatalogue("demo"), original = defaults(cat), before = structuredClone(original);
const door = original.items.find(item => item.cat === "w72"), base = priceParts(original, cat).total;
assert.equal(base, 6700);
let checks = 1;
for (const [kind, expected] of [["w48", 0], ["w72", 0], ["w36", 0], ["d36in", 150], ["d36lite", 200], ["dfr", 400]]) {
  assert.equal(replacementCharge(original, door.id, kind, cat), expected, kind + " menu contribution");
  const picked = structuredClone(original); S.setItemType(picked, door.id, kind, cat);
  assert.equal(priceParts(picked, cat).total, base + expected, kind + " actual total");
  checks += 2;
}
assert.deepEqual(original, before, "previewing choices must not alter the building"); checks++;
const upgraded = structuredClone(original); S.setItemType(upgraded, door.id, "d36in", cat);
assert.equal(replacementCharge(upgraded, door.id, "dfr", cat), 400, "another choice remains relative to the included door"); checks++;
const added = structuredClone(original), extra = S.addItem(added, "d36in", cat, 0);
assert.equal(replacementCharge(added, extra.id, "dfr", cat), 725, "an added door keeps its full standalone charge"); checks++;
assert.equal(cat.P.LB["10x20"], 6700, "the standard price book is unchanged"); checks++;
console.log(`PROVED: ${checks} opening price checks passed; menu contributions agree with the quote without changing the price list or design.`);
