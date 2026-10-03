/* A COMPANY'S SETTINGS FILE, CHECKED AND TURNED INTO ONE CATALOGUE. Node-safe,
   pure, no I/O (ui/load.js and tools/lib/load.mjs read the files).

   A company file (companies/<id>/company.json) says which of a manufacturer's
   styles it sells, at which sizes, for how much; which doors, windows and
   options it offers and their prices; its colours, name, lead settings and so
   on. The manufacturer file (library/manufacturers/<id>.json) says what the
   builder MAKES: styles, items, palettes, options -- and no prices.

   validate(company, manufacturer)  -> a list of problems in plain English
                                       (empty when the file is good)
   validateManufacturer(m)          -> the same for a manufacturer file
   resolve(company, manufacturer, library)
                                    -> ONE catalogue in Barnwright's shapes, so
                                       ported code keeps its names:
     P        {style: {"WxL": price}}           the price book, in chip order
     TYPES    {style: {name roof wallH metal dormer porch side + traits, loadout, category, base?}}
     CATS     [[label, "UT,SU,..."]]
     CAT      {item: {k n w h p + flags (gable int stretch dep perFt free sill)
                      + draw traits (draw leaves rotatable liteSwap switch)}}
     DORMERS  [["none","No dormer",0], [id, label, price]...]
     RAMPS    [["none","No ramp",0], [id, label, price, quoteLabel?]...]
     ELECPK   [["0","No electric",0], [id, label, price, quoteLabel?]...]
     MISC     {shutter, lite, ext: price}      RATES {dbl, jo12, ...: price per sq ft}
     MISCNAMES {shutter?, lite?, ext?: the company's own name}
     RATEDEF  {id: {name, quoteName, basis}}   OPTX {extras, hide}
     COLORS   {paint, trim, metal: [[name, hex]...]}
     ELECDESC {"0": "", id: text}              ELECFX {id: [fixture...]}
     LISTS    the add-button / item-sheet item lists, offered items only
     defaults {type size body trim roof dormer pLen doorC shutC}
     construction   library < manufacturer < company, not yet settled for a building
     optionEffects  {"rate.jo12": {"floor.spacingIn": 12}, ...}
     pricing brand leads embed look features notes license renames cfg id status

   THE ONE RULE ABOUT MONEY: a company inherits NO price. Every size, item and
   option it offers carries a price in its OWN file, or validation fails. A
   manufacturer file with a price in it fails too. The catalogue is frozen.

   A STYLE OF THE COMPANY'S OWN, BUILT LIKE ONE OF THE MANUFACTURER'S. An offer
   entry is normally one of the manufacturer's styles, by its key ("LB"). It
   can also be a new key with "base" -- the manufacturer style it is built
   like -- and a name of its own:
     "offer": {"LB":   {"sizes": {"10x16": 5540}},
               "LBX1": {"base": "LB", "name": "Premium Lofted Barn", "sizes": {"10x16": 6290}}}
   TYPES.LBX1 is then a copy of the Lofted Barn's traits (roof, walls, loft,
   standard doors and windows...) with the new name and "base": "LB", so it is
   drawn, framed, fitted and priced exactly like the Lofted Barn. Only its name
   and its prices are its own. Anything that looks a style up by its key (a
   construction rule's "styles" test) uses the base: baseStyle(t, key).

   OPTION NAMES. options.dormers / ramps / elec / misc / rates entries are a
   price, or {"price": n, "name": "Basic electric"} -- the name is then shown
   to customers and printed on the quote instead of the usual words. */

import { constructionProblems, mergeConstruction } from "./construction.js";
import { standardItems, NAMED_RECIPES } from "./loadouts.js";
import { dims, pSpan, wallDefs } from "./frame.js";

export const ID_RE = /^[a-z0-9-]{2,40}$/;
export const SIZE_RE = /^(\d{1,3}(?:\.\d+)?)x(\d{1,3}(?:\.\d+)?)$/;
export const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
export const LEAD_MODES = ["none", "form", "mailto", "webhook", "postMessage"];
export const LEAD_FIELDS = ["name", "phone", "email", "zip", "address", "note"];
export const FIELD_WORDS = ["required", "optional", "off"];
export const EXTRA_INPUTS = ["check", "qty", "lf", "sqftF", "sqftW", "sqftR", "pct"];
export const ROOFS = ["gable", "gambrel", "salt", "lean", "slope"];
export const KINDS = ["door", "ru", "win", "light", "bench", "shelf", "out", "ilt", "post"];
export const DRAWS = ["shop-door", "steel-6panel", "lite-door", "roll-up", "window", "transom", "octagon", "gable-1824",
  "faux-loft", "light", "porch-post", "bench", "shelf", "outlet", "overhead-light"];
export const SCENES = ["studio", "yard", "paper"];
const TOP_KEYS = ["id", "status", "manufacturer", "brand", "offer", "categories", "items", "options", "palettes", "defaults",
  "construction", "pricing", "notes", "leads", "embed", "look", "features", "license", "renames", "cfg"];
const OPTION_GROUPS = ["dormers", "ramps", "elec", "misc", "rates", "extras"];

const DEFAULT_CREDIT = { text: "3D designer by Barnwright", url: "", show: true };

function isObj(v) { return v !== null && typeof v === "object" && !Array.isArray(v); }
function own(o, k) { return isObj(o) && Object.prototype.hasOwnProperty.call(o, k); }
function keysOf(o) { return isObj(o) ? Object.keys(o).filter((k) => !k.startsWith("_")) : []; }
function isPrice(v) { return typeof v === "number" && isFinite(v) && v >= 0; }
function q(s) { return JSON.stringify(String(s)); }

/* An item's price in the company file: a number, or {"price": n, "name": "..."}.
   Options (dormers, ramps, elec, misc, rates) are written the same way. */
function itemPrice(v) { return isObj(v) ? v.price : v; }

/* The company's own name for an option, or null when it uses the usual words. */
function ownName(v) { return isObj(v) && typeof v.name === "string" && v.name.trim() ? v.name.trim() : null; }

/* The longest name a company can give a style or an option (it has to fit on
   a button and a quote line). */
export const NAME_MAX = 60;
export const STYLE_KEY_RE = /^[A-Za-z0-9]{1,8}$/;

/* The manufacturer style a catalogue style is drawn as: its base when it is
   a company's own style built like another, otherwise its own key. Use it
   wherever a style KEY is used to look something up. */
export function baseStyle(t, key) { return (t && t.base) || key; }

/* Names compared the way a customer reads them: case and spacing ignored. */
function sameNameKey(s) { return String(s).trim().replace(/\s+/g, " ").toLowerCase(); }

/* https://host[:port] only (http allowed for localhost / 127.0.0.1), never "*". */
export function originProblem(o) {
  if (o === "*") return "is \"*\", which would let ANY website embed the designer; list the company's own sites instead";
  if (typeof o !== "string") return "must be text like \"https://acme-sheds.com\"";
  /* "https://*" and "https://*.com" are wildcards too: in a frame-ancestors
     header the first lets ANY https site embed the designer. */
  if (o.indexOf("*") >= 0) return `has a "*" in it, which would let other websites embed the designer; list each of the company's own sites in full, like "https://acme-sheds.com"`;
  let u;
  try { u = new URL(o); } catch (e) { return "is not a web address (write it like \"https://acme-sheds.com\")"; }
  const local = u.hostname === "localhost" || u.hostname === "127.0.0.1";
  if (u.protocol !== "https:" && !(local && u.protocol === "http:")) return "must start with https:// (only localhost may use http://)";
  if (u.origin !== o.replace(/\/$/, "")) return `must be just the site, with no path, like ${q(u.origin)}`;
  return null;
}
function urlProblem(s, allowEmpty) {
  if (allowEmpty && (s === "" || s == null)) return null;
  if (typeof s !== "string") return "must be a web address";
  let u;
  try { u = new URL(s); } catch (e) { return "is not a web address"; }
  const local = u.hostname === "localhost" || u.hostname === "127.0.0.1";
  if (u.protocol !== "https:" && !(local && u.protocol === "http:")) return "must start with https://";
  return null;
}
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ------------------------------------------------------------------------ */
/* Palettes: names picked from the manufacturer, or [name, hex] pairs.      */

function findColor(manufacturer, group, name) {
  const P = manufacturer.palettes || {};
  const order = [group].concat(Object.keys(P).filter((g) => g !== group && !g.startsWith("_")));
  for (const g of order) {
    const hit = (P[g] || []).find((c) => Array.isArray(c) && c[0] === name);
    if (hit) return hit[1];
  }
  return null;
}

function resolvePalette(list, manufacturer, group) {
  if (list == null) return ((manufacturer.palettes || {})[group] || []).map((c) => [c[0], c[1]]);
  return list.map((e) => Array.isArray(e) ? [String(e[0]), String(e[1])] : [String(e), findColor(manufacturer, group, e)]);
}

export function pickByName(list, wanted) {
  if (!list || !list.length) return "";
  for (let w = 0; w < wanted.length; w++) {
    for (let i = 0; i < list.length; i++) {
      if (String(list[i][0] || "").toLowerCase().indexOf(wanted[w]) > -1) return list[i][1];
    }
  }
  return list[0][1];
}
export function colorName(list, hex) { for (let i = 0; i < list.length; i++) if (list[i][1] === hex) return list[i][0]; return hex; }
export function hexOfName(list, name) { const hit = (list || []).find((c) => c[0] === name); return hit ? hit[1] : null; }
/* metal styles are sided from the metal palette, everything else from paint */
export function sidingPalette(t, COLORS) { return t && t.metal ? COLORS.metal : COLORS.paint; }

/* ------------------------------------------------------------------------ */
/* The manufacturer file                                                     */

export function validateManufacturer(m) {
  const err = [];
  if (!isObj(m)) return ["The manufacturer file is not a settings object (it should start with {)."];
  if (!ID_RE.test(String(m.id || ""))) err.push(`The manufacturer id ${q(m.id)} is not allowed: use 2 to 40 lower-case letters, digits or dashes.`);
  /* no prices, anywhere */
  (function scan(v, path) {
    if (Array.isArray(v)) { v.forEach((x, i) => scan(x, `${path}[${i}]`)); return; }
    if (!isObj(v)) return;
    for (const k of Object.keys(v)) {
      if (k.startsWith("_")) continue;
      if (k === "p" || k === "price" || k === "prices") err.push(`${path}.${k}: a manufacturer file carries NO prices -- prices belong in each company's own file.`);
      scan(v[k], `${path}.${k}`);
    }
  })(m, "manufacturer");
  const S = m.styles;
  if (!isObj(S) || !keysOf(S).length) err.push("The manufacturer file has no styles.");
  for (const k of keysOf(S)) {
    const s = S[k], at = `styles.${k}`;
    if (!/^[A-Za-z0-9]{1,8}$/.test(k)) err.push(`${at}: a style key is 1 to 8 letters or digits, like "UT".`);
    if (!isObj(s)) { err.push(`${at} must be an object.`); continue; }
    if (typeof s.name !== "string" || !s.name) err.push(`${at}.name is missing.`);
    if (ROOFS.indexOf(s.roof) < 0) err.push(`${at}.roof ${q(s.roof)} is not a roof shape (use ${ROOFS.join(", ")}).`);
    if (!(typeof s.wallH === "number" && s.wallH > 0)) err.push(`${at}.wallH (the wall height in feet) must be a number above 0.`);
    if (s.porch != null && ["F", "S", "C"].indexOf(s.porch) < 0) err.push(`${at}.porch must be "F" (front), "S" (side notch) or "C" (corner).`);
    if (typeof s.loadout === "string" && NAMED_RECIPES.indexOf(s.loadout) < 0) err.push(`${at}.loadout ${q(s.loadout)} is not a known recipe.`);
    if (s.loadout != null && typeof s.loadout !== "string" && !Array.isArray(s.loadout)) err.push(`${at}.loadout must be a recipe name or a list.`);
    if (s.gambrel != null && (!isObj(s.gambrel) || s.roof !== "gambrel")) err.push(`${at}.gambrel only makes sense on a gambrel roof, as {lowerRise, upperRise, knee}.`);
    if (s.loft != null && !(isObj(s.loft) && Array.isArray(s.loft.ends) && typeof s.loft.depthFt === "number")) err.push(`${at}.loft must look like {"ends": ["F", "B"], "depthFt": 4}.`);
    if (s.rakeOverhang != null && typeof s.rakeOverhang !== "number") err.push(`${at}.rakeOverhang must be a number of feet.`);
  }
  const I = m.items;
  if (!isObj(I) || !keysOf(I).length) err.push("The manufacturer file has no items.");
  for (const k of keysOf(I)) {
    const it = I[k], at = `items.${k}`;
    if (!/^[A-Za-z0-9_]{1,16}$/.test(k)) err.push(`${at}: an item key is 1 to 16 letters, digits or underscores.`);
    if (!isObj(it)) { err.push(`${at} must be an object.`); continue; }
    if (typeof it.name !== "string" || !it.name) err.push(`${at}.name is missing.`);
    if (KINDS.indexOf(it.kind) < 0) err.push(`${at}.kind ${q(it.kind)} is not a kind (use ${KINDS.join(", ")}).`);
    if (DRAWS.indexOf(it.draw) < 0) err.push(`${at}.draw ${q(it.draw)} is not a drawing module (use ${DRAWS.join(", ")}).`);
    if (!(typeof it.w === "number" && it.w > 0) || !(typeof it.h === "number" && it.h > 0)) err.push(`${at}: w and h are its width and height in feet, both above 0.`);
    if (it.liteSwap != null && !own(I, it.liteSwap)) err.push(`${at}.liteSwap names ${q(it.liteSwap)}, which is not an item.`);
  }
  for (const g of ["paint", "trim", "metal"]) {
    const list = (m.palettes || {})[g];
    if (!Array.isArray(list) || !list.length) { err.push(`palettes.${g} is missing (a list of [name, "#hex"]).`); continue; }
    list.forEach((c, i) => { if (!Array.isArray(c) || typeof c[0] !== "string" || !HEX_RE.test(String(c[1]))) err.push(`palettes.${g}[${i}] must be [name, "#rrggbb"].`); });
  }
  const O = m.options || {};
  for (const [id, r] of Object.entries(O.rates || {})) {
    if (id.startsWith("_")) continue;
    if (["floor", "wall", "roof"].indexOf(r && r.basis) < 0) err.push(`options.rates.${id}.basis must be floor, wall or roof.`);
  }
  err.push(...constructionProblems(m.construction || {}, "manufacturer construction"));
  return err;
}

/* The CAT-shaped item table from the manufacturer (used to work out loadouts
   during validation, before any price is known). */
function manufacturerCAT(m) {
  const out = {};
  for (const k of keysOf(m.items)) {
    const it = m.items[k];
    out[k] = Object.assign({ k: it.kind, n: it.name, w: it.w, h: it.h, p: 0 }, traitsOf(it));
  }
  return out;
}
function traitsOf(it) {
  const o = {};
  for (const f of ["gable", "int", "stretch", "free", "perFt"]) if (it[f]) o[f] = true;
  if (it.dep != null) o.dep = it.dep;
  if (it.sill != null) o.sill = it.sill;
  o.draw = it.draw;
  if (it.leaves != null) o.leaves = it.leaves;
  if (it.rotatable) o.rotatable = true;
  if (it.liteSwap) o.liteSwap = it.liteSwap;
  if (it.switch) o.switch = true;
  return o;
}

/* Every item a style's standard layout uses at any of these sizes. */
function loadoutCats(t, key, sizes, CAT) {
  const cats = new Set();
  const variants = t.porch === "S" ? [{ pLen: 12 }, { pLen: 12, pMid: true }, { pLen: 8, pFlip: true }] : [{ pLen: 12 }];
  for (const z of sizes) {
    const d = dims(z, t);
    for (const v of variants) {
      const span = pSpan(v, d);
      const ws = wallDefs(t, d, span, null);
      for (const it of standardItems(t, d.W, d.L, { CAT, span, ws }, key)) cats.add(it.cat);
    }
  }
  return cats;
}

/* ------------------------------------------------------------------------ */
/* A style of the company's own, built like one of the manufacturer's        */

/* What is wrong with offer[k] = {"base": ..., "name": ..., "sizes": ...}, or
   null when it is a good one. One problem at a time: each later test needs
   the earlier ones to have passed. */
function variantProblem(k, o, offer, styles, mid) {
  const at = `offer.${k}`;
  const named = typeof o.name === "string" && o.name.trim() ? ` (${q(o.name.trim())})` : "";
  /* the manufacturer's own style is sold as itself, never "built like" another */
  if (own(styles, k)) {
    return `${at} is the ${mid} manufacturer's own ${styles[k].name}, so it cannot also be built like another style: ` +
      `take out "base", or give the new style a code of its own.`;
  }
  if (!STYLE_KEY_RE.test(k)) return `${at}: a style's code is 1 to 8 letters or digits, like "LBX1".`;
  /* "lb" next to the manufacturer's "LB" would be two styles a person cannot tell apart by code */
  const twin = keysOf(styles).find((s) => s.toLowerCase() === k.toLowerCase());
  if (twin) return `${at}: the code ${q(k)} is the manufacturer's ${q(twin)} (${styles[twin].name}) in other letters; give the new style a code of its own, like ${q(twin + "X1")}.`;
  const base = o.base;
  if (typeof base !== "string" || !own(styles, base)) {
    /* built like another of the company's own styles: point at that one's base */
    if (typeof base === "string" && own(offer, base) && isObj(offer[base]) && typeof offer[base].base === "string" && own(styles, offer[base].base)) {
      const root = offer[base].base;
      return `${at}${named} is built like ${q(base)}, which is itself built like ${q(root)} (${styles[root].name}): ` +
        `a style can only be built like one of the manufacturer's own styles, so write "base": ${q(root)}.`;
    }
    return `${at}${named} is built like ${q(base)}, but the ${mid} manufacturer file has no style ${q(base)} (its styles are ${keysOf(styles).join(", ")}).`;
  }
  if (typeof o.name !== "string" || !o.name.trim()) {
    return `${at} is built like the ${styles[base].name}, so it needs a name of its own that customers see on its button, like ${q("Premium " + styles[base].name)}.`;
  }
  return null;
}

/* A construction rule that tests one of the company's own styles by its code
   would never match: such a style is framed exactly as its base (buildingFacts
   in model/construction.js tests the base). Name it instead. */
function variantRuleProblems(tree, offer, styles, where) {
  const out = [];
  (function walk(v, path) {
    if (Array.isArray(v)) {
      v.forEach((r, i) => {
        const tested = isObj(r) && isObj(r.when) && Array.isArray(r.when.styles) ? r.when.styles : [];
        for (const k of tested) {
          if (typeof k === "string" && !own(styles, k) && own(offer, k) && isObj(offer[k]) && typeof offer[k].base === "string") {
            out.push(`${path}[${i}].when.styles names ${q(k)}, which is built like ${q(offer[k].base)} and framed exactly like it: test ${q(offer[k].base)} instead.`);
          }
        }
        walk(r, `${path}[${i}]`);
      });
      return;
    }
    if (isObj(v)) for (const k of keysOf(v)) walk(v[k], `${path}.${k}`);
  })(tree, where);
  return out;
}

/* ------------------------------------------------------------------------ */
/* The company file                                                          */

export function validate(company, manufacturer) {
  const err = [];
  const c = company;
  if (!isObj(c)) return ["The company file is not a settings object (it should start with {)."];
  if (!isObj(manufacturer)) return ["No manufacturer file was given to check the company against."];
  for (const k of Object.keys(c)) {
    if (k.startsWith("_")) continue;
    if (TOP_KEYS.indexOf(k) < 0) err.push(`${q(k)} is not a setting a company file can have. The settings are: ${TOP_KEYS.join(", ")}.`);
  }
  if (!ID_RE.test(String(c.id || ""))) err.push(`The company id ${q(c.id)} is not allowed: use 2 to 40 lower-case letters, digits or dashes, like "acme-sheds".`);
  if (c.status != null && c.status !== "active" && c.status !== "suspended") err.push(`status must be "active" or "suspended" (it is ${q(c.status)}).`);
  if (c.manufacturer !== manufacturer.id) err.push(`manufacturer is ${q(c.manufacturer)}, but the manufacturer file loaded is ${q(manufacturer.id)}.`);

  /* brand */
  const b = c.brand;
  if (!isObj(b)) err.push("brand is missing: the company's name, phone and colours go there.");
  else {
    if (typeof b.name !== "string" || !b.name.trim()) err.push("brand.name is missing: the company's name is shown on the designer and on every quote.");
    for (const f of ["short", "initials", "tagline", "phone", "email", "website", "logo"]) {
      if (b[f] != null && typeof b[f] !== "string") err.push(`brand.${f} must be text.`);
    }
    if (b.email && !EMAIL_RE.test(b.email)) err.push(`brand.email ${q(b.email)} is not an e-mail address.`);
    if (b.website) { const p = urlProblem(b.website, true); if (p) err.push(`brand.website ${q(b.website)} ${p}.`); }
    if (b.colors != null) {
      if (!isObj(b.colors)) err.push("brand.colors must be {\"header\": \"#hex\", \"accent\": \"#hex\"}.");
      else for (const k of keysOf(b.colors)) if (!HEX_RE.test(String(b.colors[k]))) err.push(`brand.colors.${k} ${q(b.colors[k])} is not a colour: write it like "#1f2a24".`);
    }
    if (b.credit != null) {
      if (!isObj(b.credit)) err.push("brand.credit must be {\"text\", \"url\", \"show\"}.");
      else if (b.credit.show != null && typeof b.credit.show !== "boolean") err.push("brand.credit.show must be true or false.");
    }
  }

  /* offer: the styles, their sizes and prices. Each entry is one of the
     manufacturer's styles, or the company's own style built like one of them
     ("base" + its own "name"; variantProblem below). */
  const styles = manufacturer.styles || {};
  const offer = c.offer;
  const offered = [];
  const baseOf = {};          /* offered key -> the manufacturer style it is drawn as */
  const nameOf = {};          /* offered key -> the name customers see */
  if (!isObj(offer) || !keysOf(offer).length) err.push("offer is empty: offer at least one building style, with its sizes and prices.");
  else for (const k of keysOf(offer)) {
    const o = offer[k], at = `offer.${k}`;
    const isVariant = isObj(o) && o.base != null;
    if (isVariant) {
      const p = variantProblem(k, o, offer, styles, manufacturer.id);
      if (p) { err.push(p); continue; }
    } else if (!own(styles, k)) {
      err.push(`${at}: there is no style ${q(k)} in the ${manufacturer.id} manufacturer file (its styles are ${keysOf(styles).join(", ")}). ` +
        `A style of the company's own needs "base" (the style it is built like) and a "name".`);
      continue;
    }
    if (!isObj(o)) { err.push(`${at} must be {"sizes": {"10x20": price, ...}}.`); continue; }
    if (o.name != null && (typeof o.name !== "string" || !o.name.trim())) err.push(`${at}.name must be text (it renames the style).`);
    else if (o.name != null && o.name.trim().length > NAME_MAX) err.push(`${at}.name ${q(o.name)} is too long: a style's name is at most ${NAME_MAX} letters, so it fits on its button.`);
    if (!isObj(o.sizes) || !keysOf(o.sizes).length) { err.push(`${at}.sizes: no sizes. List each size sold with its price, like "10x20": 6095.`); continue; }
    offered.push(k);
    baseOf[k] = isVariant ? o.base : k;
    nameOf[k] = isVariant ? o.name.trim() : styles[k].name;
    for (const z of keysOf(o.sizes)) {
      const v = o.sizes[z];
      if (!SIZE_RE.test(z)) err.push(`${at}.sizes[${q(z)}]: a size must be written width x length in feet, like "10x20".`);
      if (v === null || v === undefined || v === "") err.push(`${at}.sizes[${q(z)}] has no price. Every size needs the company's own price -- nothing is copied from anywhere else.`);
      else if (!isPrice(v)) err.push(`${at}.sizes[${q(z)}]: the price must be a number of dollars (it is ${JSON.stringify(v)}).`);
      else if (v === 0) err.push(`${at}.sizes[${q(z)}]: the price must be more than 0 (0 would mean "not sold" -- leave the size out instead).`);
    }
  }
  /* no two buttons with one name: every offered style's name (after renames)
     must be its own, case and spacing ignored */
  {
    const byName = new Map();
    for (const k of offered) {
      const shown = isObj(offer[k]) && typeof offer[k].name === "string" && offer[k].name.trim() ? offer[k].name.trim() : nameOf[k];
      const key = sameNameKey(shown);
      if (byName.has(key)) {
        err.push(`offer.${k} is called ${q(shown)}, the same name as offer.${byName.get(key)}: customers would see two ${q(shown)} buttons. Give each building style its own name.`);
      } else byName.set(key, k);
    }
  }

  /* items and their prices */
  const mItems = manufacturer.items || {};
  const items = c.items;
  if (!isObj(items)) err.push("items is missing: list each door, window and fixture offered with its price, like \"w48\": 150.");
  const priced = new Set();
  for (const k of keysOf(items)) {
    const v = items[k];
    if (!own(mItems, k)) { err.push(`items.${k}: there is no item ${q(k)} in the ${manufacturer.id} manufacturer file.`); continue; }
    const p = itemPrice(v);
    if (p === null || p === undefined || p === "") err.push(`items.${k} has no price.`);
    else if (!isPrice(p)) err.push(`items.${k}: the price must be a number of dollars, 0 or more (it is ${JSON.stringify(p)}).`);
    else priced.add(k);
    if (isObj(v) && v.name != null && typeof v.name !== "string") err.push(`items.${k}.name must be text.`);
  }
  /* every standard door and window of every offered style must be priced */
  const mCAT = manufacturerCAT(manufacturer);
  const needs = {};
  for (const k of offered) {
    const t = styles[baseOf[k]];          /* a style built like another comes with its doors and windows */
    let cats;
    try { cats = loadoutCats(t, k, keysOf(offer[k].sizes).filter((z) => SIZE_RE.test(z)), mCAT); }
    catch (e) { err.push(`offer.${k}: its standard doors and windows could not be worked out: ${e.message}`); continue; }
    for (const ic of cats) if (!priced.has(ic) && !own(items, ic)) (needs[ic] = needs[ic] || []).push(`${nameOf[k]} (${k})`);
  }
  for (const ic of Object.keys(needs)) {
    err.push(`items.${ic} needs a price: the ${mItems[ic] ? mItems[ic].name : ic} (${ic}) comes as standard on the ${needs[ic].join(", ")}. 0 is fine for one that is never charged.`);
  }

  /* options */
  const O = c.options == null ? {} : c.options;
  const mO = manufacturer.options || {};
  if (!isObj(O)) err.push("options must be an object: {\"dormers\": {...}, \"ramps\": {...}, \"elec\": {...}, \"misc\": {...}, \"rates\": {...}, \"extras\": []}.");
  else {
    for (const g of keysOf(O)) if (OPTION_GROUPS.indexOf(g) < 0) err.push(`options.${g} is not an option group (use ${OPTION_GROUPS.join(", ")}).`);
    for (const g of ["dormers", "ramps", "elec", "misc", "rates"]) {
      if (O[g] == null) continue;
      if (!isObj(O[g])) { err.push(`options.${g} must be {id: price}.`); continue; }
      for (const id of keysOf(O[g])) {
        if (!own(mO[g], id)) err.push(`options.${g}.${id}: the manufacturer has no ${g} option ${q(id)} (it has ${keysOf(mO[g]).join(", ") || "none"}).`);
        /* a price, or {"price": n, "name": "..."} -- the company's own name for it */
        const v = O[g][id];
        if (isObj(v)) {
          for (const f of keysOf(v)) {
            if (f !== "price" && f !== "name") err.push(`options.${g}.${id}.${f} is not part of an option: write a price, or {"price": 250, "name": "..."}.`);
          }
          if (v.name != null && (typeof v.name !== "string" || !v.name.trim())) err.push(`options.${g}.${id}.name must be text: the name customers see for this option.`);
          else if (v.name != null && v.name.trim().length > NAME_MAX) err.push(`options.${g}.${id}.name ${q(v.name)} is too long: an option's name is at most ${NAME_MAX} letters, so it fits on its button and the quote.`);
        }
        const p = itemPrice(v);
        if (p === null || p === undefined || p === "") err.push(`options.${g}.${id} has no price.`);
        else if (!isPrice(p)) err.push(`options.${g}.${id}: the price must be a number of dollars, 0 or more (it is ${JSON.stringify(p)}).`);
      }
    }
    const dormerStyles = offered.filter((k) => styles[baseOf[k]].dormer);
    if (dormerStyles.length && !keysOf(O.dormers).length) {
      err.push(`${dormerStyles.map((k) => nameOf[k]).join(", ")} ${dormerStyles.length > 1 ? "are" : "is"} offered, so options.dormers needs at least one dormer size with a price.`);
    }
    if (keysOf(O.elec).length) {
      /* every fixture the OFFERED packages place, read from the manufacturer's
         own fixture lists (a fixture nobody priced would be silently left out
         of a package the customer pays for) */
      const fx = [];
      for (const id of keysOf(O.elec)) for (const f of ((isObj(mO.elec) && isObj(mO.elec[id]) && mO.elec[id].fixtures) || [])) if (f && fx.indexOf(f.cat) < 0) fx.push(f.cat);
      for (const ic of fx) {
        if (own(mItems, ic) && !own(items, ic)) err.push(`An electrical package places a ${mItems[ic].name}, so items.${ic} needs a price (0 is fine: package pieces are never charged on their own).`);
      }
    }
    if (O.misc && own(O.misc, "ext") && own(mItems, "light") && !own(items, "light")) err.push("options.misc.ext (the exterior light) places an Outside Light, so items.light needs a price.");
    if (O.extras != null) {
      if (!Array.isArray(O.extras)) err.push("options.extras must be a list of {key, name, input, price}.");
      else {
        const seen = new Set();
        O.extras.forEach((x, i) => {
          const at = `options.extras[${i}]`;
          if (!isObj(x)) { err.push(`${at} must be {key, name, input, price}.`); return; }
          if (!/^[A-Za-z0-9_-]{1,40}$/.test(String(x.key || ""))) err.push(`${at}.key must be 1 to 40 letters, digits, dashes or underscores.`);
          else if (seen.has(x.key)) err.push(`${at}.key ${q(x.key)} is used twice.`);
          seen.add(x.key);
          if (typeof x.name !== "string" || !x.name.trim()) err.push(`${at}.name is missing.`);
          if (EXTRA_INPUTS.indexOf(x.input) < 0) err.push(`${at}.input ${q(x.input)} is not a kind of extra (use ${EXTRA_INPUTS.join(", ")}).`);
          if (!isPrice(x.price)) err.push(`${at}.price must be a number, 0 or more.`);
        });
      }
    }
  }

  /* categories */
  if (c.categories != null) {
    if (!Array.isArray(c.categories)) err.push("categories must be a list of [label, [style keys]].");
    else {
      const inCat = new Set();
      c.categories.forEach((g, i) => {
        if (!Array.isArray(g) || typeof g[0] !== "string" || !Array.isArray(g[1])) { err.push(`categories[${i}] must be [label, ["UT", "SU"]].`); return; }
        for (const k of g[1]) {
          if (offered.indexOf(k) < 0) err.push(`categories[${i}] (${g[0]}) lists ${q(k)}, which is not in offer.`);
          inCat.add(k);
        }
      });
      for (const k of offered) if (!inCat.has(k)) err.push(`${nameOf[k]} (${k}) is offered but in no category, so a customer could never pick it.`);
    }
  }

  /* palettes */
  const pal = {};
  const P = c.palettes;
  if (P != null && !isObj(P)) err.push("palettes must be {\"paint\": [...], \"trim\": [...], \"metal\": [...]}.");
  for (const g of ["paint", "trim", "metal"]) {
    const list = isObj(P) ? P[g] : undefined;
    if (list != null) {
      if (!Array.isArray(list) || !list.length) { err.push(`palettes.${g} must be a list of colour names from the manufacturer, or [name, "#hex"] pairs.`); continue; }
      const names = new Set();
      list.forEach((e, i) => {
        const name = Array.isArray(e) ? e[0] : e;
        if (Array.isArray(e)) {
          if (typeof e[0] !== "string" || !e[0] || !HEX_RE.test(String(e[1]))) err.push(`palettes.${g}[${i}] must be [name, "#rrggbb"] (got ${JSON.stringify(e)}).`);
        } else if (typeof e !== "string") err.push(`palettes.${g}[${i}] must be a colour name or [name, "#hex"].`);
        else if (!findColor(manufacturer, g, e)) err.push(`palettes.${g}[${i}]: the manufacturer has no colour called ${q(e)}; give it as [${q(e)}, "#rrggbb"].`);
        if (names.has(name)) err.push(`palettes.${g} lists ${q(name)} twice.`);
        names.add(name);
      });
    }
    try { pal[g] = resolvePalette(list == null || !Array.isArray(list) ? null : list, manufacturer, g); } catch (e) { pal[g] = []; }
  }

  /* defaults */
  const D = c.defaults;
  if (D != null) {
    if (!isObj(D)) err.push("defaults must be {\"style\", \"size\", \"colors\"}.");
    else {
      if (D.style != null && offered.indexOf(D.style) < 0) err.push(`defaults.style ${q(D.style)} is not an offered style.`);
      const st = D.style != null ? D.style : offered[0];
      if (D.size != null && st && isObj(offer[st]) && !own(offer[st].sizes, D.size)) err.push(`defaults.size ${q(D.size)} is not a size of ${q(st)} in offer.`);
      const cc = D.colors;
      if (cc != null) {
        if (!isObj(cc)) err.push("defaults.colors must be {\"body\", \"trim\", \"roof\"} colour names.");
        else {
          const t = styles[baseOf[st]] || {};
          const checks = [["body", t.metal ? pal.metal : pal.paint, t.metal ? "metal" : "paint"], ["trim", pal.trim, "trim"], ["roof", pal.metal, "metal"]];
          for (const [f, list, gname] of checks) {
            if (cc[f] != null && !hexOfName(list, cc[f])) err.push(`defaults.colors.${f} ${q(cc[f])} is not on the ${gname} palette.`);
          }
        }
      }
      if (D.dormer != null && D.dormer !== "none" && !(isObj(O) && own(O.dormers, D.dormer))) err.push(`defaults.dormer ${q(D.dormer)} is not an offered dormer size.`);
      if (D.porchLength != null && D.porchLength !== 8 && D.porchLength !== 12) err.push("defaults.porchLength must be 8 or 12.");
    }
  }

  /* construction */
  if (c.construction != null && !isObj(c.construction)) err.push("construction must be an object of construction settings.");
  else {
    err.push(...constructionProblems(c.construction || {}, "construction"));
    err.push(...variantRuleProblems(c.construction || {}, isObj(offer) ? offer : {}, styles, "construction"));
  }

  /* pricing */
  const pr = c.pricing;
  if (pr != null) {
    if (!isObj(pr)) err.push("pricing must be an object.");
    else {
      if (pr.show != null && ["price", "from", "none"].indexOf(pr.show) < 0) err.push("pricing.show must be \"price\", \"from\" or \"none\".");
      if (pr.roundTo != null && !(typeof pr.roundTo === "number" && pr.roundTo > 0)) err.push("pricing.roundTo must be a number above 0 (5 rounds per-square-foot charges to the nearest $5).");
      if (pr.minCharge != null && !isPrice(pr.minCharge)) err.push("pricing.minCharge must be a number, 0 or more.");
      if (pr.roofAreaFactor != null && !(typeof pr.roofAreaFactor === "number" && pr.roofAreaFactor > 0)) err.push("pricing.roofAreaFactor must be a number above 0 (roof area = floor area x this).");
      if (pr.rto != null) {
        if (!isObj(pr.rto) || !isObj(pr.rto.factors)) err.push("pricing.rto must be {\"factors\": {\"36\": 0.60, ...}, \"showTerm\": 60}.");
        else {
          for (const k of keysOf(pr.rto.factors)) {
            const f = pr.rto.factors[k];
            if (!/^\d+$/.test(k) || !(typeof f === "number" && f > 0 && f <= 1)) err.push(`pricing.rto.factors[${q(k)}] must be a term in months with a factor between 0 and 1.`);
          }
          if (pr.rto.showTerm != null && !own(pr.rto.factors, String(pr.rto.showTerm))) err.push("pricing.rto.showTerm must be one of the terms in pricing.rto.factors (or null).");
        }
      }
    }
  }

  /* notes */
  if (c.notes != null) {
    if (!isObj(c.notes)) err.push("notes must be an object.");
    else {
      if (c.notes.finePrint != null && typeof c.notes.finePrint !== "string") err.push("notes.finePrint must be text.");
      if (c.notes.sizeNotes != null && (!isObj(c.notes.sizeNotes) || keysOf(c.notes.sizeNotes).some((k) => typeof c.notes.sizeNotes[k] !== "string"))) err.push("notes.sizeNotes must be {width: text}.");
    }
  }

  /* leads */
  const L = c.leads;
  if (L != null) {
    if (!isObj(L)) err.push("leads must be an object.");
    else {
      if (LEAD_MODES.indexOf(L.mode) < 0) err.push(`leads.mode ${q(L.mode)} is not a way to receive leads (use ${LEAD_MODES.join(", ")}).`);
      if (L.mode === "form" || L.mode === "webhook") {
        const p = urlProblem(L.url, false);
        if (p) err.push(`leads.url ${L.url == null ? "is missing" : q(L.url) + " " + p}: leads mode "${L.mode}" sends each quote request there.`);
      }
      if (L.mode === "mailto") {
        const to = L.email || (isObj(b) && b.email);
        if (!to || !EMAIL_RE.test(to)) err.push("leads mode \"mailto\" needs an e-mail address (leads.email or brand.email).");
      }
      if (L.mode === "postMessage" && !(isObj(c.embed) && Array.isArray(c.embed.origins) && c.embed.origins.length)) {
        err.push("leads mode \"postMessage\" hands leads to the page the designer is embedded in, so embed.origins must list that site.");
      }
      if (L.fields != null) {
        if (!isObj(L.fields)) err.push("leads.fields must be {name: \"required\", ...}.");
        else for (const f of keysOf(L.fields)) {
          if (LEAD_FIELDS.indexOf(f) < 0) err.push(`leads.fields.${f} is not a field (use ${LEAD_FIELDS.join(", ")}).`);
          else if (FIELD_WORDS.indexOf(L.fields[f]) < 0) err.push(`leads.fields.${f} must be "required", "optional" or "off".`);
        }
      }
      if (L.smsConsent != null && typeof L.smsConsent !== "string") err.push("leads.smsConsent must be the wording of the texting box, or null.");
      if (L.images != null && typeof L.images !== "boolean") err.push("leads.images must be true or false.");
    }
  }

  /* embed */
  const E = c.embed;
  if (E != null) {
    if (!isObj(E)) err.push("embed must be an object.");
    else {
      if (E.origins != null && !Array.isArray(E.origins)) err.push("embed.origins must be a list of sites like [\"https://acme-sheds.com\"].");
      (Array.isArray(E.origins) ? E.origins : []).forEach((o, i) => { const p = originProblem(o); if (p) err.push(`embed.origins[${i}] ${p}.`); });
      if (E.shareUrl != null) { const p = urlProblem(E.shareUrl, true); if (p) err.push(`embed.shareUrl ${q(E.shareUrl)} ${p}.`); }
    }
  }

  /* look, features, license, renames, cfg */
  if (c.look != null) {
    if (!isObj(c.look)) err.push("look must be an object.");
    else {
      if (c.look.trueColour != null && typeof c.look.trueColour !== "boolean") err.push("look.trueColour must be true or false.");
      if (c.look.scene != null && SCENES.indexOf(c.look.scene) < 0) err.push(`look.scene must be one of ${SCENES.join(", ")}.`);
    }
  }
  if (c.features != null) {
    if (!isObj(c.features)) err.push("features must be an object of true / false switches.");
    else for (const k of keysOf(c.features)) if (typeof c.features[k] !== "boolean") err.push(`features.${k} must be true or false.`);
  }
  if (c.license != null) {
    if (!isObj(c.license)) err.push("license must be an object.");
    else if (c.license.renews && !/^\d{4}-\d{2}-\d{2}$/.test(c.license.renews)) err.push("license.renews must be a date like 2027-09-01.");
  }
  if (c.renames != null) {
    if (!isObj(c.renames)) err.push("renames must be {\"items\": {}, \"sizes\": {}, \"colors\": {}}.");
    else for (const g of keysOf(c.renames)) {
      if (["items", "sizes", "colors"].indexOf(g) < 0) err.push(`renames.${g} is not something that can be renamed (items, sizes, colors).`);
      else if (!isObj(c.renames[g]) || keysOf(c.renames[g]).some((k) => typeof c.renames[g][k] !== "string")) err.push(`renames.${g} must be {old name: new name}.`);
    }
  }
  if (c.cfg != null && !(Number.isInteger(c.cfg) && c.cfg >= 1)) err.push("cfg must be a whole number, 1 or more (raise it whenever prices or items change).");
  return err;
}

/* ------------------------------------------------------------------------ */
/* resolve                                                                   */

export function deepFreeze(o) {
  if (o && typeof o === "object" && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const k of Object.keys(o)) deepFreeze(o[k]);
  }
  return o;
}

function copy(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }
function stripHelp(v) {
  if (Array.isArray(v)) return v.map(stripHelp);
  if (isObj(v)) { const o = {}; for (const k of Object.keys(v)) if (!k.startsWith("_")) o[k] = stripHelp(v[k]); return o; }
  return v;
}

export function resolve(company, manufacturer, library) {
  const mErr = validateManufacturer(manufacturer);
  const cErr = validate(company, manufacturer);
  const all = mErr.map((e) => "manufacturer file: " + e).concat(cErr);
  if (all.length) {
    const e = new Error(`The settings for ${q(company && company.id)} have ${all.length} problem${all.length > 1 ? "s" : ""}:\n - ` + all.join("\n - "));
    e.problems = all;
    throw e;
  }
  const c = company, m = manufacturer, mO = m.options || {}, O = c.options || {};
  const COLORS = {
    paint: resolvePalette(c.palettes && c.palettes.paint, m, "paint"),
    trim: resolvePalette(c.palettes && c.palettes.trim, m, "trim"),
    metal: resolvePalette(c.palettes && c.palettes.metal, m, "metal"),
  };
  const P = {}, TYPES = {};
  for (const k of keysOf(c.offer)) {
    /* a style of the company's own is a copy of its base's traits: only the
       name (and, below, the prices) are its own */
    const o = c.offer[k], base = o.base != null ? o.base : k, s = m.styles[base];
    const t = { name: o.base != null ? o.name.trim() : (o.name || s.name), roof: s.roof, wallH: s.wallH };
    for (const f of ["side", "dormer", "porch", "metal"]) if (s[f] !== undefined) t[f] = s[f];
    for (const f of ["kennel", "cottage", "gambrel", "gableVent", "gableBand", "rakeOverhang", "loft"]) if (s[f] !== undefined) t[f] = copy(s[f]);
    t.loadout = copy(s.loadout);
    t.category = s.category || "";
    if (o.base != null) t.base = base;
    TYPES[k] = t;
    P[k] = {};
    for (const z of keysOf(o.sizes)) P[k][z] = o.sizes[z];
  }
  let CATS;
  if (Array.isArray(c.categories)) CATS = c.categories.map((g) => [g[0], g[1].join(",")]);
  else {
    const order = [], groups = {};
    for (const k of keysOf(c.offer)) {
      const label = TYPES[k].category || "Buildings";
      if (!groups[label]) { groups[label] = []; order.push(label); }
      groups[label].push(k);
    }
    CATS = order.map((l) => [l, groups[l].join(",")]);
  }
  const CAT = {};
  const hide = [];
  for (const k of keysOf(m.items)) {
    const it = m.items[k];
    if (!own(c.items, k)) { hide.push("cat." + k); continue; }
    const v = c.items[k];
    const name = isObj(v) && v.name ? v.name : it.name;
    CAT[k] = Object.assign({ k: it.kind, n: name, w: it.w, h: it.h, p: itemPrice(v) }, traitsOf(it));
  }
  /* The options. Each is a price, or {"price", "name"}: a name the company
     gives replaces the manufacturer's on the buttons AND on the quote; with
     no name the labels are exactly the usual ones (Barnwright's). */
  const none = mO.none || {};
  const DORMERS = [["none", none.dormer || "No dormer", 0]];
  for (const id of keysOf(mO.dormers)) {
    if (!own(O.dormers, id)) { hide.push("dormer." + id); continue; }
    DORMERS.push([id, ownName(O.dormers[id]) || mO.dormers[id].name, itemPrice(O.dormers[id])]);
  }
  const RAMPS = [["none", none.ramp || "No ramp", 0]];
  for (const id of keysOf(mO.ramps)) {
    if (!own(O.ramps, id)) { hide.push("ramp." + id); continue; }
    const named = ownName(O.ramps[id]);
    const r = [id, named || mO.ramps[id].name, itemPrice(O.ramps[id])];
    if (!named && mO.ramps[id].quoteName) r.push(mO.ramps[id].quoteName);
    RAMPS.push(r);
  }
  const ELECPK = [["0", none.elec || "No electric", 0]];
  const ELECDESC = { 0: "" }, ELECFX = {};
  for (const id of keysOf(mO.elec)) {
    if (!own(O.elec, id)) { hide.push("elec." + id); continue; }
    const named = ownName(O.elec[id]);
    /* the fourth entry, the quote's words, only when the company named it
       (otherwise the quote says "Electric package 1", as it always has) */
    ELECPK.push(named ? [id, named, itemPrice(O.elec[id]), named] : [id, mO.elec[id].name, itemPrice(O.elec[id])]);
    ELECDESC[id] = mO.elec[id].desc || "";
    ELECFX[id] = copy(mO.elec[id].fixtures || []);
  }
  const MISC = {}, MISCNAMES = {};
  for (const id of keysOf(mO.misc)) {
    if (!own(O.misc, id)) { hide.push("misc." + id); continue; }
    MISC[id] = itemPrice(O.misc[id]);
    if (ownName(O.misc[id])) MISCNAMES[id] = ownName(O.misc[id]);
  }
  const RATES = {}, RATEDEF = {}, optionEffects = {};
  for (const id of keysOf(mO.rates)) {
    if (!own(O.rates, id)) { hide.push("rate." + id); continue; }
    const r = mO.rates[id];
    const named = ownName(O.rates[id]);
    RATES[id] = itemPrice(O.rates[id]);
    RATEDEF[id] = { name: named || r.name, quoteName: named || r.quoteName || r.name, basis: r.basis };
    if (r.construction) optionEffects["rate." + id] = stripHelp(copy(r.construction));
  }
  for (const g of [["dormers", "dormer"], ["ramps", "ramp"], ["elec", "elec"], ["misc", "misc"]]) {
    for (const id of keysOf(mO[g[0]])) if (own(O[g[0]], id) && mO[g[0]][id].construction) optionEffects[g[1] + "." + id] = stripHelp(copy(mO[g[0]][id].construction));
  }
  const extras = (O.extras || []).map((x) => {
    const e = { key: x.key, name: x.name, input: x.input, price: x.price };
    if (x.construction) optionEffects[x.key] = stripHelp(copy(x.construction));
    return e;
  });
  const LISTS = {};
  for (const k of keysOf(m.lists)) LISTS[k] = (m.lists[k] || []).filter((id) => own(CAT, id));

  /* the design a new visitor starts on */
  const D = c.defaults || {};
  const offered = keysOf(c.offer);
  const type = D.style || offered[0];
  const sizes = keysOf(c.offer[type].sizes);
  const size = D.size || sizes[Math.min(4, sizes.length - 1)];
  const tDef = TYPES[type];
  const DC = D.colors || {};
  const siding = tDef.metal ? COLORS.metal : COLORS.paint;
  const defaults = {
    type, size,
    body: DC.body ? hexOfName(siding, DC.body) : pickByName(siding, ["white"]),
    trim: DC.trim ? hexOfName(COLORS.trim, DC.trim) : pickByName(COLORS.trim, ["black", "charcoal"]),
    roof: DC.roof ? hexOfName(COLORS.metal, DC.roof) : pickByName(COLORS.metal, ["black", "charcoal"]),
    dormer: D.dormer != null ? D.dormer : (DORMERS[1] ? DORMERS[1][0] : "none"),
    pLen: D.porchLength || 12,
    doorC: "", shutC: "",
  };
  const pr = c.pricing || {};
  const cat = {
    id: c.id,
    status: c.status || "active",
    manufacturer: m.id,
    cfg: c.cfg || 1,
    P, TYPES, CATS, CAT, DORMERS, RAMPS, ELECPK, MISC, MISCNAMES, RATES, RATEDEF,
    OPTX: { extras, hide },
    COLORS, ELECDESC, ELECFX, LISTS,
    defaults,
    construction: mergeConstruction(library || {}, m.construction || {}, c.construction || {}),
    optionEffects,
    pricing: {
      show: pr.show || "price",
      roundTo: pr.roundTo != null ? pr.roundTo : 5,
      minCharge: pr.minCharge != null ? pr.minCharge : 5,
      roofAreaFactor: pr.roofAreaFactor != null ? pr.roofAreaFactor : 1.15,
      rto: pr.rto ? stripHelp(copy(pr.rto)) : null,
    },
    brand: Object.assign({ name: "", short: "", initials: "", tagline: "", phone: "", email: "", website: "", colors: {}, logo: "" },
      stripHelp(copy(c.brand)), { credit: Object.assign({}, DEFAULT_CREDIT, stripHelp(copy((c.brand || {}).credit || {}))) }),
    leads: Object.assign({ mode: "none", url: "", fields: { name: "required", phone: "required", email: "optional", zip: "required", address: "optional", note: "optional" }, smsConsent: null, images: false },
      stripHelp(copy(c.leads || {}))),
    embed: Object.assign({ origins: [], shareUrl: "" }, stripHelp(copy(c.embed || {}))),
    look: Object.assign({ trueColour: false, scene: "studio" }, stripHelp(copy(c.look || {}))),
    features: Object.assign({ framingView: true, buildPlayback: true, floorPlan: true }, stripHelp(copy(c.features || {}))),
    notes: Object.assign({ finePrint: "", sizeNotes: {} }, stripHelp(copy(c.notes || {}))),
    license: stripHelp(copy(c.license || {})),
    renames: Object.assign({ items: {}, sizes: {}, colors: {} }, stripHelp(copy(c.renames || {}))),
  };
  if (!cat.brand.short) cat.brand.short = cat.brand.name;
  /* an origin is compared letter for letter with the embedding page's
     (event.origin has no trailing slash), so store exactly that form */
  cat.embed.origins = (cat.embed.origins || []).map((o) => new URL(o).origin);
  return deepFreeze(cat);
}
