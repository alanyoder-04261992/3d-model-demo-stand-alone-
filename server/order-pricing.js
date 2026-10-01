/* PRICE AN INCOMING ORDER USING THE COMPANY'S OWN CATALOGUE. Saved designs
   are untrusted: their included and electrical-package flags are checked
   against real allowances before the existing pure pricing rules run. */
import { toState, fromState } from "../model/design.js";
import { frameOf } from "../model/frame.js";
import { standardItems } from "../model/loadouts.js";
import { pkFixtures } from "../model/layout.js";
import { priceParts } from "../model/pricing.js";

function fail(message) { const e = new Error(message); e.status = 422; throw e; }
const own = (o, k) => Object.prototype.hasOwnProperty.call(o || {}, k);

function object(value, keys, label) {
  if (!value || typeof value !== "object" || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail(`${label} must be an object.`);
  if (keys && Object.keys(value).some((key) => !keys.includes(key))) fail(`${label} contains an unknown field.`);
}
function text(value, max, label) { if (typeof value !== "string" || value.length > max) fail(`${label} must be text of at most ${max} characters.`); }
function boolean(value, label) { if (typeof value !== "boolean") fail(`${label} must be true or false.`); }
function number(value, min, max, label, integer = false) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isSafeInteger(value))) fail(`${label} is not a valid ${integer ? "whole " : ""}number.`);
}

/* Validate before toState: that browser compatibility helper intentionally
   coerces old saved links. Order input must never use those coercions to
   create a different price (for example a negative electrical package). */
function validateDesign(design, cat) {
  object(design, ["v", "company", "cfg", "type", "size", "colors", "items", "dormer", "porch", "opts", "elec", "ramp", "xopt", "priced"], "The design");
  if (design.v !== 1 || design.company !== cat.id) fail("This design belongs to a different company or format.");
  number(design.cfg, 1, Number.MAX_SAFE_INTEGER, "Catalogue version", true);
  text(design.type, 40, "Building style"); text(design.size, 40, "Building size");
  if (!own(cat.TYPES, design.type) || !own(cat.P[design.type], design.size)) fail("This building or size is not offered.");
  object(design.colors, ["body", "trim", "roof", "door", "shutters"], "Colors");
  for (const key of ["body", "trim", "roof", "door", "shutters"]) text(design.colors[key], 100, `${key} color`);
  object(design.porch, ["pLen", "pFlip", "pMid"], "Porch");
  if (![8, 12].includes(design.porch.pLen)) fail("Porch length must be 8 or 12.");
  boolean(design.porch.pFlip, "Porch position"); boolean(design.porch.pMid, "Middle porch");
  text(design.dormer, 40, "Dormer"); text(design.ramp, 40, "Ramp");
  if (!cat.DORMERS.some((entry) => entry[0] === design.dormer)) fail("This dormer is not offered.");
  if (!cat.RAMPS.some((entry) => entry[0] === design.ramp)) fail("This ramp is not offered.");
  if (!Array.isArray(design.opts) || design.opts.length > 100) fail("Upgrades must be a list of at most 100 options.");
  const seen = new Set();
  for (const key of design.opts) {
    text(key, 40, "Upgrade"); if (!own(cat.RATES, key) || seen.has(key)) fail("An upgrade is unavailable or repeated."); seen.add(key);
  }
  object(design.xopt, null, "Extras");
  const extras = new Map((cat.OPTX?.extras || []).map((extra) => [extra.key, extra]));
  for (const [key, value] of Object.entries(design.xopt)) {
    const extra = extras.get(key); if (!extra) fail("An extra is unavailable.");
    const maximum = extra.input === "qty" ? 99 : extra.input === "lf" ? 200 : 1;
    number(value, 0, maximum, "Extra quantity", true);
  }
  object(design.elec, ["pkg", "ext"], "Electrical options");
  number(design.elec.pkg, 0, 1000000, "Electrical package", true);
  if (!cat.ELECPK.some((entry) => entry[0] === String(design.elec.pkg))) fail("This electrical package is not offered.");
  boolean(design.elec.ext, "Exterior electrical light");
  if (design.elec.ext && (design.elec.pkg === 0 || cat.MISC.ext == null)) fail("The exterior electrical light needs an offered electrical package.");
  if (own(design, "priced")) {
    object(design.priced, ["total", "at"], "The displayed price");
    number(design.priced.total, 0, 100000000, "The displayed price");
    text(design.priced.at, 10, "Price date"); if (!/^\d{4}-\d{2}-\d{2}$/.test(design.priced.at)) fail("The price date is invalid.");
  }
  if (!Array.isArray(design.items) || design.items.length > 250) fail("The design must have at most 250 items.");
  for (const item of design.items) {
    object(item, ["cat", "wall", "pos", "vy", "px", "pz", "ln", "inc", "pk", "dbl", "shut", "lite", "rot", "origCat"], "An item");
    text(item.cat, 40, "Item type");
    if (!own(cat.CAT, item.cat)) fail("The design contains an unavailable item.");
    text(item.wall, 3, "Item wall");
    if (!["F", "B", "R", "L", "IN", "S1", "S2", "S3", "P1", "P2", "P3"].includes(item.wall)) fail("An item wall is invalid.");
    if (own(item, "origCat")) { text(item.origCat, 40, "Original item type"); if (!own(cat.CAT, item.origCat)) fail("The original item type is unavailable."); }
    for (const key of ["pos", "vy", "px", "pz", "ln"]) {
      if (own(item, key)) number(item[key], key === "ln" ? 1 : -1000, key === "ln" ? 200 : 1000, "An item measurement", key === "ln");
    }
    for (const key of ["inc", "pk", "dbl", "shut", "lite", "rot"]) if (own(item, key)) boolean(item[key], "An item flag");
  }
}

export function priceOrder(design, cat) {
  validateDesign(design, cat);
  const { state, warnings } = toState(design, cat);
  if (warnings.length) fail("The design needs to be reopened before ordering: " + warnings.join(" "));
  const fr = frameOf(state, cat);
  const included = standardItems(fr.t, fr.d.W, fr.d.L, { CAT: fr.CAT, span: fr.span, ws: fr.ws }, state.type);
  const available = new Map();
  for (const item of included) available.set(item.cat, (available.get(item.cat) || 0) + 1);
  const packageState = structuredClone(state);
  packageState.items = packageState.items.filter((item) => !item.pk);
  pkFixtures(packageState, frameOf(packageState, cat), cat);
  const fixtures = new Map();
  for (const item of packageState.items.filter((item) => item.pk)) fixtures.set(item.cat, (fixtures.get(item.cat) || 0) + 1);
  for (const item of state.items) {
    const c = cat.CAT[item.cat];
    if (item.pk) {
      if (item.inc || item.dbl || item.shut || item.lite || !(fixtures.get(item.cat) > 0)) fail("An item was incorrectly marked as part of the electrical package.");
      fixtures.set(item.cat, fixtures.get(item.cat) - 1);
      item.inc = false; delete item.origCat;
    } else if (item.inc) {
      const original = item.origCat || item.cat;
      if (!(available.get(original) > 0)) fail("The design claims more included equipment than this building provides.");
      const originalKind = cat.CAT[original].k;
      const choices = originalKind === "win" ? cat.LISTS.sheetWindow : ["door", "ru"].includes(originalKind) ? cat.LISTS.sheetDoor : [original];
      if (item.cat !== original && !(choices || []).includes(item.cat)) fail("An included item was swapped for an unrelated item.");
      available.set(original, available.get(original) - 1);
      item.origCat = original; item.pk = false;
    } else {
      item.inc = false; item.pk = false; delete item.origCat;
    }
    if (item.dbl && (c.k !== "win" || c.gable)) fail("Only ordinary windows can be doubled.");
  }
  const price = priceParts(state, cat);
  if (!Number.isFinite(price.total) || price.total < 0 || price.total > 100000000) fail("This design could not be priced.");
  return { design: fromState(state, cat), price };
}
