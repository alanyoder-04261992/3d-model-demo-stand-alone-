/* CHECK A DESIGN AND PRICE IT ON THE SERVER, from the stored price list.

   A design arrives from a browser, so nothing in it is trusted: every field
   is checked for its type and range BEFORE the designer's own reader
   (model/design.js toState) sees it, because that reader is kind to old
   saved links and would quietly turn a bad value into a different building.
   Then the "part of the electrical package" marks are checked against the
   package, and the "this came with the building" marks are priced: free
   only up to what the building comes with at its own size and porch, the
   rest at their normal price (model/pricing.js chargedIncluded). An older
   design may use the included counts from its original price list,
   provided by the server's own History copy. The price is worked out by
   the same priceParts the designer uses.

   A design made under an earlier price list (its cfg is lower) is priced at
   today's prices when everything in it is still sold, so a customer who
   took an hour to design is never sent back because the owner fixed a
   price meanwhile. */

import { toState, fromState } from "../../model/design.js";
import { frameOf } from "../../model/frame.js";
import { pkFixtures, fitsOnWall } from "../../model/layout.js";
import { priceParts, includedAllowance, chargedIncluded, swapsOf } from "../../model/pricing.js";
import { extraOfferedOn } from "../../model/company.js";
import { OfficeError } from "./http.js";

export class DesignProblem extends Error {
  constructor(message, status = 422) {
    super(message);
    this.status = status;
  }
}

const UNREADABLE = "This design could not be read. Refresh the page and try again.";
const NOT_OFFERED = "Something in this building is no longer offered. Refresh the page to see today's options, then send it again.";

function unreadable() { throw new DesignProblem(UNREADABLE); }
function notOffered() { throw new DesignProblem(NOT_OFFERED, 409); }

const own = (o, k) => o != null && Object.prototype.hasOwnProperty.call(o, k);

function plainObject(value, keys) {
  if (!value || typeof value !== "object" || Array.isArray(value)) unreadable();
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) unreadable();
  if (keys && Object.keys(value).some((k) => !keys.includes(k))) unreadable();
}
function isText(value, max) { if (typeof value !== "string" || value.length > max) unreadable(); }
function isBool(value) { if (typeof value !== "boolean") unreadable(); }
function isNumber(value, min, max, whole = false) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) unreadable();
  if (whole && !Number.isSafeInteger(value)) unreadable();
}

const DESIGN_KEYS = ["v", "company", "cfg", "type", "size", "colors", "items", "dormer", "porch", "opts", "elec", "ramp", "xopt", "priced", "removed"];
const ITEM_KEYS = ["cat", "wall", "pos", "vy", "px", "pz", "ln", "inc", "pk", "dbl", "shut", "lite", "rot", "origCat"];
const WALLS = ["F", "B", "R", "L", "IN", "S1", "S2", "S3", "P1", "P2", "P3"];

/* The shape and types, and that every choice is still sold. */
function checkDesign(design, cat) {
  plainObject(design, DESIGN_KEYS);
  if (design.v !== 1 || design.company !== cat.id) unreadable();
  isNumber(design.cfg, 1, Number.MAX_SAFE_INTEGER, true);
  isText(design.type, 40);
  isText(design.size, 40);
  if (!own(cat.TYPES, design.type) || !own(cat.P[design.type], design.size)) notOffered();

  plainObject(design.colors, ["body", "trim", "roof", "door", "shutters"]);
  for (const key of ["body", "trim", "roof", "door", "shutters"]) isText(design.colors[key], 100);

  plainObject(design.porch, ["pLen", "pFlip", "pMid"]);
  /* a side porch length: whole feet, 4 to 20 (the style's own lengths, 8 and
     12 standard, are checked when the design is read: a length no longer
     sold is "no longer offered", never "could not be read") */
  isNumber(design.porch.pLen, 4, 20, true);
  isBool(design.porch.pFlip);
  isBool(design.porch.pMid);

  isText(design.dormer, 40);
  isText(design.ramp, 40);
  if (!cat.DORMERS.some((d) => d[0] === design.dormer)) notOffered();
  if (!cat.RAMPS.some((r) => r[0] === design.ramp)) notOffered();

  if (!Array.isArray(design.opts) || design.opts.length > 100) unreadable();
  const seen = new Set();
  for (const key of design.opts) {
    isText(key, 40);
    if (seen.has(key)) unreadable();
    if (!own(cat.RATES, key)) notOffered();
    seen.add(key);
  }

  plainObject(design.xopt, null);
  const extras = new Map((cat.OPTX?.extras || []).map((x) => [x.key, x]));
  for (const [key, value] of Object.entries(design.xopt)) {
    const extra = extras.get(key);
    if (!extra || !extraOfferedOn(extra, cat.TYPES[design.type], design.type)) notOffered();
    isNumber(value, 0, extra.input === "qty" ? 99 : extra.input === "lf" ? 200 : 1, true);
  }

  plainObject(design.elec, ["pkg", "ext"]);
  isNumber(design.elec.pkg, 0, 1000000, true);
  if (!cat.ELECPK.some((e) => e[0] === String(design.elec.pkg))) notOffered();
  isBool(design.elec.ext);
  if (design.elec.ext && (design.elec.pkg === 0 || cat.MISC.ext == null)) notOffered();

  if (own(design, "priced")) {
    plainObject(design.priced, ["total", "at"]);
    isNumber(design.priced.total, 0, 100000000);
    isText(design.priced.at, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(design.priced.at)) unreadable();
  }

  /* the standard doors and windows the customer took off: item names; one
     this price list does not sell is passed over (model/design.js toState) */
  if (own(design, "removed")) {
    if (!Array.isArray(design.removed) || design.removed.length > 100) unreadable();
    for (const key of design.removed) isText(key, 40);
  }

  if (!Array.isArray(design.items) || design.items.length > 250) unreadable();
  for (const item of design.items) {
    plainObject(item, ITEM_KEYS);
    isText(item.cat, 40);
    if (!own(cat.CAT, item.cat)) notOffered();
    isText(item.wall, 3);
    if (!WALLS.includes(item.wall)) unreadable();
    if (own(item, "origCat")) { isText(item.origCat, 40); if (!own(cat.CAT, item.origCat)) notOffered(); }
    for (const key of ["pos", "vy", "px", "pz"]) if (own(item, key)) isNumber(item[key], -1000, 1000);
    if (own(item, "ln")) isNumber(item.ln, 1, 200, true);
    for (const key of ["inc", "pk", "dbl", "shut", "lite", "rot"]) if (own(item, key)) isBool(item[key]);
  }
}

/* -> {design (as the Office stores it), price: {base, lines, total}, repriced}.
   repriced is true when the design was made under an earlier price list. */
export function priceDesign(input, cat, { includedCat = null } = {}) {
  checkDesign(input, cat);
  const repriced = input.cfg !== cat.cfg;
  const design = repriced ? { ...input, cfg: cat.cfg } : input;

  const { state, warnings } = toState(design, cat);
  if (warnings.length) notOffered();

  const frame = frameOf(state, cat);
  const packageOnly = structuredClone(state);
  packageOnly.items = packageOnly.items.filter((item) => !item.pk);
  pkFixtures(packageOnly, frameOf(packageOnly, cat), cat);
  const fixtures = new Map();
  for (const item of packageOnly.items.filter((i) => i.pk)) fixtures.set(item.cat, (fixtures.get(item.cat) || 0) + 1);

  for (const item of state.items) {
    const c = cat.CAT[item.cat];
    /* a gable window too tall for this gable is not offered there
       (model/layout.js gableItemFits; the designer greys it) */
    if (!fitsOnWall(c, item.wall, frame)) notOffered();
    if (item.pk) {
      if (item.inc || item.dbl || item.shut || item.lite || !(fixtures.get(item.cat) > 0)) unreadable();
      fixtures.set(item.cat, fixtures.get(item.cat) - 1);
      item.inc = false;
      delete item.origCat;
    } else if (item.inc) {
      const original = item.origCat || item.cat;
      if (item.cat !== original && !swapsOf(original, cat).includes(item.cat)) unreadable();
      item.origCat = original;
      item.pk = false;
    } else {
      item.inc = false;
      item.pk = false;
      delete item.origCat;
    }
    if (item.dbl && (c.k !== "win" || c.gable)) unreadable();
  }

  /* "Comes with the building" covers only what this size comes with, at
     any of its porch lengths (model/pricing.js includedAllowance and
     chargedIncluded, Alan Oct 17 2026: "Yes, charge for them"): more is
     charged at its normal price, never refused. The server cannot tell a
     customer who laid out a bigger size and then chose this one from a
     link edited by hand, so both are priced the same.
     A standard door or window the customer took off comes off the price
     (model/pricing.js removedCredits; Alan: "Yes, take its price off").
     Every comparison is with this business's own standard layout. A design
     made under an older price list is compared with that list's standard
     (Alan, Oct 17 2026), which only an authoritative History copy from the
     price-list service can give, by the same function the designer uses
     with the same copy (ui/load.js withOlderList).
     Never infer an allowance from browser positions, counts, or an
     unrecognised cfg. The whole included set comes from one price list:
     merging their counts would give away both the old door and its new
     replacement. */
  const older = includedCat?.id === cat.id && includedCat.cfg === input.cfg && input.cfg < cat.cfg ? includedCat : null;
  const allowance = includedAllowance(state, cat, frame, older);
  const price = priceParts(state, cat, frame, { allowance, older });
  if (!Number.isFinite(price.total) || price.total < 0 || price.total > 100000000) unreadable();
  /* saved with the older version it was priced under, so reopening or
     sending it again prices it the same way (review 17 final SHOULD-2) */
  const savedCat = older ? { ...cat, olderIncluded: older } : cat;
  return { design: fromState(chargedAsAdded(state, cat, frame, allowance, price.total, older), savedCat), price, repriced, state };
}

/* What is saved, printed and sold says what was charged (review 17
   FREE-4): an item marked "comes with the building" that was charged at
   its normal price is saved as an item the customer added (the order
   sheet's "Added"), and one standing in for an item this size comes with
   is saved as a swap from that item (the order sheet names both). The
   price is the same either way; when it would not be, the design is saved
   as it was sent. */
function chargedAsAdded(state, cat, frame, allowance, total, older = null) {
  const charged = chargedIncluded(state, cat, frame, allowance);
  if (!charged.size) return state;
  const out = structuredClone(state);
  state.items.forEach((item, i) => {
    if (!charged.has(item)) return;
    const as = charged.get(item), copy = out.items[i];
    if (as == null) { copy.inc = false; delete copy.origCat; }
    else copy.origCat = as;
  });
  return priceParts(out, cat, frame, { allowance, older }).total === total ? out : state;
}

/* priceDesign for the routes: a DesignProblem keeps its words; anything
   else (a design the drawing code cannot lay out) is logged and told as
   "could not be read". */
export function priceOrExplain(design, cat, log = console.error, context = {}) {
  try {
    return priceDesign(design, cat, context);
  } catch (e) {
    if (e instanceof DesignProblem) throw new OfficeError(e.status, e.message);
    log("A design could not be priced:", e);
    throw new OfficeError(422, UNREADABLE);
  }
}

/* "10×16 Lofted Barn" */
export function buildingName(design, cat) {
  const style = cat.TYPES[design.type]?.name || "building";
  return `${String(design.size).replace("x", "×")} ${style}`;
}
