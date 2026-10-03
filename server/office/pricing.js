/* CHECK A DESIGN AND PRICE IT ON THE SERVER, from the stored price list.

   A design arrives from a browser, so nothing in it is trusted: every field
   is checked for its type and range BEFORE the designer's own reader
   (model/design.js toState) sees it, because that reader is kind to old
   saved links and would quietly turn a bad value into a different building.
   Then the "this came with the building" and "part of the electrical
   package" marks are checked against what the building really comes with,
   and the price is worked out by the same priceParts the designer uses.

   A design made under an earlier price list (its cfg is lower) is priced at
   today's prices when everything in it is still sold, so a customer who
   took an hour to design is never sent back because the owner fixed a
   price meanwhile. */

import { toState, fromState } from "../../model/design.js";
import { frameOf } from "../../model/frame.js";
import { standardItems } from "../../model/loadouts.js";
import { pkFixtures } from "../../model/layout.js";
import { priceParts } from "../../model/pricing.js";
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

const DESIGN_KEYS = ["v", "company", "cfg", "type", "size", "colors", "items", "dormer", "porch", "opts", "elec", "ramp", "xopt", "priced"];
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
  if (![8, 12].includes(design.porch.pLen)) unreadable();
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
    if (!extra) notOffered();
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
export function priceDesign(input, cat) {
  checkDesign(input, cat);
  const repriced = input.cfg !== cat.cfg;
  const design = repriced ? { ...input, cfg: cat.cfg } : input;

  const { state, warnings } = toState(design, cat);
  if (warnings.length) notOffered();

  const frame = frameOf(state, cat);
  const comesWith = new Map();
  for (const item of standardItems(frame.t, frame.d.W, frame.d.L, { CAT: frame.CAT, span: frame.span, ws: frame.ws }, state.type)) {
    comesWith.set(item.cat, (comesWith.get(item.cat) || 0) + 1);
  }

  const packageOnly = structuredClone(state);
  packageOnly.items = packageOnly.items.filter((item) => !item.pk);
  pkFixtures(packageOnly, frameOf(packageOnly, cat), cat);
  const fixtures = new Map();
  for (const item of packageOnly.items.filter((i) => i.pk)) fixtures.set(item.cat, (fixtures.get(item.cat) || 0) + 1);

  for (const item of state.items) {
    const c = cat.CAT[item.cat];
    if (item.pk) {
      if (item.inc || item.dbl || item.shut || item.lite || !(fixtures.get(item.cat) > 0)) unreadable();
      fixtures.set(item.cat, fixtures.get(item.cat) - 1);
      item.inc = false;
      delete item.origCat;
    } else if (item.inc) {
      const original = item.origCat || item.cat;
      if (!(comesWith.get(original) > 0)) unreadable();
      const kind = cat.CAT[original].k;
      const swaps = kind === "win" ? cat.LISTS.sheetWindow : ["door", "ru"].includes(kind) ? cat.LISTS.sheetDoor : [original];
      if (item.cat !== original && !(swaps || []).includes(item.cat)) unreadable();
      comesWith.set(original, comesWith.get(original) - 1);
      item.origCat = original;
      item.pk = false;
    } else {
      item.inc = false;
      item.pk = false;
      delete item.origCat;
    }
    if (item.dbl && (c.k !== "win" || c.gable)) unreadable();
  }

  const price = priceParts(state, cat);
  if (!Number.isFinite(price.total) || price.total < 0 || price.total > 100000000) unreadable();
  return { design: fromState(state, cat), price, repriced, state };
}

/* priceDesign for the routes: a DesignProblem keeps its words; anything
   else (a design the drawing code cannot lay out) is logged and told as
   "could not be read". */
export function priceOrExplain(design, cat, log = console.error) {
  try {
    return priceDesign(design, cat);
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
