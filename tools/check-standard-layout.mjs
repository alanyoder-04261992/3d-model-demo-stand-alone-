/* Strict company validation and compatibility for optional owner layouts. */
import assert from "node:assert/strict";
import { loadCompany } from "./lib/load.mjs";
import { validate, resolve, strictProblems } from "../model/company.js";
import { layoutProblems } from "../model/loadouts.js";
import { defaults, fromState, toState } from "../model/design.js";
import { frameOf } from "../model/frame.js";
import { resetItems } from "../model/layout.js";
import { priceParts } from "../model/pricing.js";
import { loadoutTwin } from "../model/loadout-twins.js";
const base = loadCompany("demo"), copy = (x) => JSON.parse(JSON.stringify(x));
const company = copy(base.company); company.offer.UT.layout = [{ cat: "w48", wall: "R", at: "center" }];
assert.deepEqual(validate(company, base.manufacturer), []);
assert.ok(!strictProblems(company, base.manufacturer).some((x) => /layout/.test(x)));
const cat = resolve(company, base.manufacturer, base.library), state = defaults(cat); state.type = "UT"; state.size = "10x20"; resetItems(state, frameOf(state, cat), cat);
assert.equal(state.items[0].wall, "R"); assert.equal(state.items[0].cat, "w48"); assert.equal(state.items[0].inc, true);
assert.deepEqual(base.company.offer.UT.layout, undefined);
const variant = copy(company); variant.offer.UT1 = { base: "UT", name: "Own Utility", sizes: { "10x20": 1000 }, layout: [{ cat: "w36", wall: "B", at: "center" }] }; variant.categories[0][1].push("UT1");
const variantCat = resolve(variant, base.manufacturer, base.library); assert.equal(variantCat.TYPES.UT1.loadout[0].cat, "w36"); assert.equal(variantCat.TYPES.UT.loadout[0].cat, "w48");
const unpriced = copy(company); delete unpriced.items.w48; assert.ok(validate(unpriced, base.manufacturer).some((x) => /items.w48 needs a price/.test(x)));
assert.ok(layoutProblems([{ cat: "w23", wall: "R", when: { minp: 12 } }], "Side Cabin").some((x) => /minp.*use minP/.test(x)));
assert.ok(layoutProblems([{ cat: "w23", wall: "R", at: { ps: 1 } }]).some((x) => /not a place rule/.test(x)));
const malformed = copy(company); malformed.offer.SU.layout = [null];
assert.ok(validate(malformed, base.manufacturer).some((x) => /could not be read/.test(x)));
assert.doesNotThrow(() => strictProblems(malformed, base.manufacturer));
for (const layout of [Array.from({ length: 101 }, () => ({ cat: "w23", wall: "B" })), [{ cat: "w23", wall: "B", repeat: { count: 101 } }], [{ cat: "w23", wall: "B", at: { sym: 4 }, repeat: { count: "51" } }]]) {
  const bad = copy(company); bad.offer.UT.layout = layout; assert.ok(validate(bad, base.manufacturer).some((x) => /at most 100/.test(x)));
}
const badPost = copy(company); badPost.offer.UT.layout = [{ cat: "ppost", wall: "F" }]; assert.ok(validate(badPost, base.manufacturer).some((x) => /porch edge/.test(x)));
/* Replacing a swapped-door builder layout does not require its unused door. */
const noSwap = copy(base.company); noSwap.offer.SU.layout = [{ cat: "d36lite", wall: "B", at: "center" }];
for (const key of Object.keys(noSwap.offer)) if (key !== "SU") delete noSwap.offer[key];
noSwap.defaults.style = "SU"; noSwap.defaults.size = "10x20";
noSwap.categories = noSwap.categories.map(([name, keys]) => [name, keys.filter((k) => noSwap.offer[k])]).filter(([, keys]) => keys.length);
delete noSwap.items.w48; assert.ok(!validate(noSwap, base.manufacturer).some((x) => /items.w48 needs a price/.test(x)));
/* Even an owner's item left off at every current size needs its own price. */
const hidden = copy(company); hidden.offer.UT.layout.push({ cat: "w33", wall: "F", at: { pos: 100 }, ifFits: true }); delete hidden.items.w33;
assert.ok(validate(hidden, base.manufacturer).some((x) => /items.w33 needs a price/.test(x)));
/* A builder twin at only the shop's smaller sizes can still sell only its
   swapped-in door, exactly like the named recipe. */
const swappedOnly = copy(base.company); swappedOnly.offer = { SU: { sizes: { "8x12": 2000, "10x12": 2500 }, layout: loadoutTwin("SU") } };
swappedOnly.categories = [["Buildings", ["SU"]]]; swappedOnly.defaults.style = "SU"; swappedOnly.defaults.size = "8x12"; delete swappedOnly.items.w72;
assert.deepEqual(validate(swappedOnly, base.manufacturer), []);
const swappedCat = resolve(swappedOnly, base.manufacturer, base.library), swappedState = defaults(swappedCat);
assert.equal(swappedState.items[0].cat, "w48");
/* Formula dimensions must come from the same priced item table the lot's
   public designer receives. The item need not still be drawn in the layout. */
const dimensionSource = copy(base.company); dimensionSource.offer = { C: { sizes: { "10x20": 4000 }, layout: [{ cat: "w48", wall: "F", at: "center" }, { cat: "ppost", wall: "F", at: { sym: "CAT.d36lite.w/2+0.2+CAT.ppost.w/2" } }] } };
dimensionSource.categories = [["Buildings", ["C"]]]; dimensionSource.defaults.style = "C"; dimensionSource.defaults.size = "10x20";
const validDimensions = resolve(dimensionSource, base.manufacturer, base.library); assert.doesNotThrow(() => defaults(validDimensions));
delete dimensionSource.items.d36lite;
assert.ok(validate(dimensionSource, base.manufacturer).some((x) => /items.d36lite needs a price.*uses.*size/.test(x)), "A referenced item's Stop selling change must be refused before the lot designer receives it");
assert.throws(() => resolve(dimensionSource, base.manufacturer, base.library), /items.d36lite needs a price/);
const repeatDimensions = copy(company); repeatDimensions.offer.UT.layout.push({ cat: "w23", wall: "R", repeat: { count: 1, spread: "CAT.w33.w" }, ifFits: true }); delete repeatDimensions.items.w33;
assert.ok(validate(repeatDimensions, base.manufacturer).some((x) => /items.w33 needs a price/.test(x)), "Repeated placements require their dimension source too");
/* Every old saved design reopens with its own doors and price after an owner
   changes the standard; it must never pick up today's recipe. */
const oldState = defaults(base.catalogue), oldPrice = priceParts(oldState, base.catalogue).total, saved = fromState(oldState, base.catalogue);
const changed = copy(base.company); changed.cfg++; changed.offer[oldState.type].layout = [{ cat: "w48", wall: "B", at: "center" }];
const changedCat = resolve(changed, base.manufacturer, base.library), reopened = toState(saved, changedCat, { asSaved: true }).state;
assert.deepEqual(fromState(reopened, changedCat).items, saved.items); assert.equal(priceParts(reopened, changedCat).total, oldPrice);
const crowded = defaults(base.catalogue); crowded.type = "SU"; crowded.size = "8x12"; resetItems(crowded, frameOf(crowded, base.catalogue), base.catalogue);
const crowdedSaved = fromState(crowded, base.catalogue), crowdedOpened = toState(crowdedSaved, changedCat, { asSaved: true }).state;
assert.deepEqual(fromState(crowdedOpened, changedCat).items, crowdedSaved.items, "An old quote's crowded doors and windows never move after cfg changes");
const slope = defaults(base.catalogue); slope.type = "SS"; slope.size = "12x32"; resetItems(slope, frameOf(slope, base.catalogue), base.catalogue);
const slopeSaved = fromState(slope, base.catalogue), slopeOpened = toState(slopeSaved, changedCat, { asSaved: true }).state;
assert.deepEqual(fromState(slopeOpened, changedCat).items, slopeSaved.items, "An old quote's high transom row never shifts after cfg changes");
console.log("check-standard-layout: owner and own-style layouts resolve, included prices stay unchanged, saved designs keep their items, misspelled rules and more than 100 expanded items are refused.");
