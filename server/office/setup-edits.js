/* BARNWRIGHT'S EDITS (docs/OFFICE.md, "Barnwright setup access", The edits
   and Warnings).

   The Control Room (and Claude, through it) never sends a whole price list.
   It sends a short list of edits, like
       {do: "set_price", style: "LB", size: "10x16", price: 5700}
   and this file applies them, in order, to a copy of the business's own
   settings, with the business's own library and the owner's screen's own
   rules (a new style's code, where a style goes in the groups, which doors
   come standard). A later edit sees the earlier ones. An edit that can't be
   done is skipped and said in one plain sentence ("Edit 3: ..."), and every
   problem is listed, so Alan sees them all at once.

   After this, the door runs the lock (setup-lock.js) and then the very same
   check() the owner's save runs (price-list.js). So nothing an edit writes
   can be anything an owner's save couldn't be.

   warnings(old, next) are the things Alan should look at before he says
   yes ("a bigger size is cheaper than a smaller one"). They never stop a
   save.

   The logo, how the 3D designer looks, where quotes go, which websites may
   show it, opening it to customers and how the buildings are built (other
   than a building style's own numbers in How it's built: set_built, and
   its short form set_roof_pitch) are never edits.

   Pure: no store, no clock. Node-safe and browser-safe. */

import { lockedItems, newStyleKey, placeStyle, groupsOf, sortSizes, paletteNames, nameKey } from "../../ui/office/views/price-list/model.js";
import { LOCK_WORDS, GABLE_STYLES } from "./setup-lock.js";
import { liftRawRules, setBuilt, parse as parseBuilt, checkStyleNumber, extrasThatChangeNothing, KNOBS, KNOB_PATHS } from "../../model/build-settings.js";
import { styleName, itemName, optionName, BUILT_PARTS } from "./setup-view.js";

export const MAX_EDITS = 300;
export const TOO_MANY_EDITS = "Send 1 to 300 edits at a time.";
export const UNDO_LINE = "Put back the price list from before Barnwright's last change";

const NAME_MAX = 60, TEXT_MAX = 300, BUSINESS_NAME_MAX = 80, COLOR_NAME_MAX = 40;
const PRICE_CAP = 1_000_000;
const OPTION_GROUPS = ["dormers", "ramps", "elec", "misc", "rates"];
const OPTION_ONE = { dormers: "dormer", ramps: "ramp", elec: "electrical package", misc: "option", rates: "upgrade priced by the square foot" };
const EXTRA_KINDS = ["check", "qty", "lf", "sqftF", "sqftW", "sqftR", "pct"];
const QUOTE_BOXES = ["phone", "email", "zip", "address", "note"];
const BOX_WORDS = ["required", "optional", "off"];
const SHOWS = ["price", "from", "none"];
const ROUNDS = [1, 5, 10, 25];
const ROOF_WORDS = { gambrel: "a gambrel roof", salt: "a saltbox roof", lean: "a lean-to roof", slope: "a single slope roof" };
const CONTROL = /[\u0000-\u001f\u007f]/;
const HEX = /^#[0-9a-fA-F]{6}$/;
const CODE = /^[A-Za-z0-9]{1,8}$/;
const EMAIL_RE = /^[^\s@<>()",;]+@[^\s@<>()",;]+\.[^\s@<>()",;]+$/;

/* set_built's parts: How it's built's knobs by the names the door uses
   (setup-view.js BUILT_PARTS, the library part's names too), in the order
   they are written in. */
export const BUILT_PART_NAMES = Object.freeze(Object.keys(BUILT_PARTS));
const BUILT_WORDS_MAX = 120;

/* Every edit and the parts it takes (besides `do`). */
const EDITS = Object.freeze({
  set_price: ["style", "size", "price"],
  remove_size: ["style", "size"],
  sell_style: ["style", "name", "group", "sizes"],
  add_own_style: ["built_like", "name", "group", "sizes"],
  stop_selling_style: ["style"],
  rename_style: ["style", "name"],
  change_prices: ["scope", "by_percent", "by_dollars", "round_to"],
  set_built: ["style", ...Object.keys(BUILT_PARTS)],
  set_roof_pitch: ["style", "pitch"],
  set_item: ["item", "price", "name"],
  stop_selling_item: ["item"],
  set_option: ["group", "key", "price", "name"],
  stop_option: ["group", "key"],
  set_extra: ["key", "name", "charged", "price"],
  remove_extra: ["key"],
  set_colors: ["which", "colors"],
  set_defaults: ["style", "size", "colors"],
  set_price_display: ["show"],
  set_fine_print: ["text"],
  set_size_note: ["width", "text"],
  set_rent_to_own: ["terms", "show_term", "note"],
  set_quote_form: ["fields", "ask_plan", "sms_consent"],
  set_business: ["name", "short", "tagline", "phone", "email", "website"],
  set_brand_colors: ["header", "primary", "accent"],
});
export const EDIT_NAMES = Object.freeze(Object.keys(EDITS));

/* ---- small helpers ------------------------------------------------------------------- */

class EditProblem extends Error {}
const no = (words) => { throw new EditProblem(words); };

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const keysOf = (o) => (isObj(o) ? Object.keys(o).filter((k) => !k.startsWith("_")) : []);
const has = (o, k) => isObj(o) && typeof k === "string" && !k.startsWith("_") && Object.prototype.hasOwnProperty.call(o, k);
const priceOf = (v) => (isObj(v) ? v.price : v);
const ownName = (v) => (isObj(v) && typeof v.name === "string" ? v.name.trim() : "");
/* a value said back in words: short, one line */
const shown = (v) => String(typeof v === "string" ? v : JSON.stringify(v) ?? v).replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, 40);
const times = (z) => String(z).slice(0, 20).replace("x", "×");
const money = (n) => "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 });
const listWords = (a) => (a.length < 2 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1]);
const slug = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 34).replace(/-+$/, "") || "extra";

/* Words a customer reads: a string, one line, short enough. */
function words(v, label, max, { needed = false } = {}) {
  if (typeof v !== "string") no(`${label} must be written as words.`);
  if (v.length > max) no(`${label} can be at most ${max} letters.`);
  if (CONTROL.test(v)) no(`${label} has characters that can't be saved.`);
  const t = v.trim();
  if (needed && !t) no(`${label} is needed.`);
  return t;
}

/* A price: dollars, 0 to 1,000,000, at most 2 decimals (above 0 for a building size). */
function price(v, what, { above0 = false } = {}) {
  if (typeof v !== "number" || !Number.isFinite(v)) no("a price must be a number of dollars.");
  if (v < 0) no("a price can't be below $0.");
  if (v > PRICE_CAP) no(`${what} costs more than $1,000,000 — check that price.`);
  if (Math.abs(Math.round(v * 100) - v * 100) > 1e-6) no("a price can have at most 2 decimals.");
  if (above0 && v === 0) no(`${what} needs a price above $0. To stop selling a size, remove it.`);
  return v;
}

/* "10x16": whole feet, width 4 to 16, length 4 to 60. */
function sizeKey(v, name) {
  const m = typeof v === "string" ? /^([1-9]\d?)[x×X]([1-9]\d?)$/.exec(v.trim()) : null;
  const w = m ? Number(m[1]) : 0, l = m ? Number(m[2]) : 0;
  if (!m || w < 4 || w > 16 || l < 4 || l > 60) {
    no(`${name} ${times(typeof v === "string" ? v.trim() : shown(v))} is not a size the designer can sell (width 4 to 16 ft, length 4 to 60 ft, whole feet).`);
  }
  return `${w}x${l}`;
}

/* {"10x16": 5540, ...}: 1 to 60 sizes, in the order given. */
function sizeList(v, name) {
  if (!isObj(v) || !Object.keys(v).length || Object.keys(v).length > 60) no("sizes must list 1 to 60 sizes, each with its price.");
  const out = {};
  for (const z0 of Object.keys(v)) {
    const z = sizeKey(z0, name);
    if (has(out, z)) no(`${name} ${times(z)} is listed twice.`);
    out[z] = price(v[z0], `${name} ${times(z)}`, { above0: true });
  }
  return out;
}

const sorted = (sizes) => {
  const out = {};
  for (const z of Object.keys(sizes).filter((z) => z.startsWith("_"))) out[z] = sizes[z];
  for (const z of sortSizes(keysOf(sizes))) out[z] = sizes[z];
  return out;
};

function soldStyle(s, v) {
  if (typeof v !== "string" || !CODE.test(v) || !has(s.offer, v) || !isObj(s.offer[v])) no(`there is no building style ${shown(v)} in their price list.`);
  if (!isObj(s.offer[v].sizes)) s.offer[v].sizes = {};
  return v;
}
function libraryStyle(v, M) {
  if (typeof v !== "string" || !CODE.test(v) || !has(M.styles, v)) no(`${shown(v)} is not a style in the builder's library.`);
  return v;
}

/* Put a style in the groups customers see: in the named group (a new name
   makes a new group at the end), or, with no group, where the owner's
   screen would put it. */
function place(s, k, group, M, original) {
  const live = (g) => Array.isArray(g) && Array.isArray(g[1]);
  if (group != null) {
    if (!Array.isArray(s.categories)) s.categories = groupsOf(s, M);
    for (const g of s.categories) if (live(g)) g[1] = g[1].filter((x) => x !== k);
    let g = s.categories.find((c) => live(c) && typeof c[0] === "string" && nameKey(c[0]) === nameKey(group));
    if (!g) s.categories.push((g = [group, []]));
    g[1].push(k);
    s.categories = s.categories.filter((c) => !live(c) || c[1].length);
  } else if (Array.isArray(s.categories) && !s.categories.some((c) => live(c) && c[1].includes(k))) {
    placeStyle(s.categories, k, s.offer, groupsOf(original, M), M);
  }
}

/* The building the 3D designer opens on stays one they sell (as the owner's
   screen keeps it): the first style still sold, then its first size. */
function keepOpening(s, M) {
  const D = s.defaults;
  const sold = keysOf(s.offer);
  if (!isObj(D) || !sold.length) return;
  if (D.style != null && !sold.includes(D.style)) D.style = groupsOf(s, M).flatMap((g) => g[1]).find((k) => sold.includes(k)) || sold[0];
  const st = D.style != null ? D.style : sold[0];
  const sizes = sortSizes(keysOf(s.offer[st]?.sizes));
  if (D.size != null && !sizes.includes(D.size) && sizes.length) D.size = sizes[0];
}
function keepColors(s, M) {
  const D = s.defaults;
  const sold = keysOf(s.offer);
  if (!isObj(D) || !isObj(D.colors)) return;
  const st = D.style != null && sold.includes(D.style) ? D.style : sold[0];
  const metal = !!M.styles?.[s.offer?.[st]?.base || st]?.metal;
  for (const [f, g, wanted] of [["body", metal ? "metal" : "paint", ["white"]], ["trim", "trim", ["black", "charcoal"]], ["roof", "metal", ["black", "charcoal"]]]) {
    const names = paletteNames(s, M, g);
    if (D.colors[f] == null || !names.length || names.includes(D.colors[f])) continue;
    D.colors[f] = wanted.map((w) => names.find((n) => n.toLowerCase().includes(w))).find(Boolean) || names[0];
  }
}

/* What set_built was sent for one part, as text How it's built reads
   (model/build-settings.js parse): words, or for the barn heights
   {"10": "4 ft"} with words, or for the side porch lengths a list of words.
   undefined when it isn't words at all (a bare number could be inches or
   feet, so it is never guessed). */
function builderWords(v, knob) {
  const text = (x) => typeof x === "string" && x.trim() && x.length <= BUILT_WORDS_MAX && !CONTROL.test(x);
  if (text(v)) return v.trim();
  if (knob === "barnPeak" && isObj(v) && Object.keys(v).length && Object.keys(v).length <= 8 && Object.values(v).every(text)) {
    return Object.fromEntries(Object.entries(v).map(([w, x]) => [w, x.trim()]));
  }
  if (knob === "sidePorchLengths" && Array.isArray(v) && v.length && v.length <= 4 && v.every(text)) return v.map((x) => x.trim()).join(", ");
  return undefined;
}

/* Does the business's own construction settings hold one of the paths
   this How it's built number owns (set up by hand)? */
function rawHolds(raw, knob) {
  return (KNOB_PATHS[knob] || []).some((p) => p.split(".").reduce((o, b) => (isObj(o) ? o[b] : undefined), raw) !== undefined);
}

/* Write a style's own How it's built numbers ([{knob, value}], value null
   for standard) with model/build-settings.js setBuilt, after moving an old
   roof pitch rule list into How it's built, into s itself. */
function writeBuilt(s, style, writes, M) {
  let next = liftRawRules(s, M).settings;
  for (const w of writes) {
    const r = setBuilt(next, { style, knob: w.knob, value: w.value });
    if (r.problems.length) no(r.problems.map((p) => p.words).join(" "));
    next = r.settings;
  }
  if (next === s) return;
  for (const key of Object.keys(s)) delete s[key];
  Object.assign(s, structuredClone(next));
}

/* ---- the edits ------------------------------------------------------------------------- */

const HANDLERS = {
  set_price(s, e, { M }) {
    const k = soldStyle(s, e.style), name = styleName(s, k, M);
    const z = sizeKey(e.size, name);
    const p = price(e.price, `${name} ${times(z)}`, { above0: true });
    if (has(s.offer[k].sizes, z)) s.offer[k].sizes[z] = p;
    else s.offer[k].sizes = sorted({ ...s.offer[k].sizes, [z]: p });
  },

  remove_size(s, e, { M }) {
    const k = soldStyle(s, e.style), name = styleName(s, k, M);
    const z = sizeKey(e.size, name);
    const sizes = s.offer[k].sizes;
    if (!has(sizes, z)) no(`the ${name} doesn't have a ${times(z)} size.`);
    if (keysOf(sizes).length === 1) no(`${times(z)} is the ${name}'s last size. Stop selling the style instead.`);
    delete sizes[z];
    keepOpening(s, M);
  },

  sell_style(s, e, { M, original }) {
    const k = libraryStyle(e.style, M);
    const name = e.name === undefined ? null : words(e.name, "The name", NAME_MAX, { needed: true });
    const group = e.group === undefined ? null : words(e.group, "The group", NAME_MAX, { needed: true });
    const sizes = sizeList(e.sizes, name || styleName(s, k, M));
    if (!isObj(s.offer)) s.offer = {};
    if (isObj(s.offer[k])) s.offer[k].sizes = sizes;
    else s.offer[k] = { sizes };
    if (name) s.offer[k].name = name;
    place(s, k, group, M, original);
    keepOpening(s, M);
  },

  add_own_style(s, e, { M, original, newCodes }) {
    const base = libraryStyle(e.built_like, M);
    const name = words(e.name, "The name", NAME_MAX, { needed: true });
    const group = e.group === undefined ? null : words(e.group, "The group", NAME_MAX, { needed: true });
    const sizes = sizeList(e.sizes, name);
    const code = newStyleKey(base, keysOf(s.offer), M);
    if (!code) no(`there is no code left for another style built like the ${M.styles[base].name}.`);
    if (!isObj(s.offer)) s.offer = {};
    s.offer[code] = { base, name, sizes };
    place(s, code, group, M, original);
    newCodes[name] = code;
  },

  stop_selling_style(s, e, { M }) {
    const k = soldStyle(s, e.style);
    delete s.offer[k];
    if (Array.isArray(s.categories)) {
      for (const g of s.categories) if (Array.isArray(g?.[1])) g[1] = g[1].filter((x) => x !== k);
      s.categories = s.categories.filter((g) => !Array.isArray(g?.[1]) || g[1].length);
    }
    keepOpening(s, M);
  },

  rename_style(s, e) {
    const k = soldStyle(s, e.style);
    s.offer[k].name = words(e.name, "The name", NAME_MAX, { needed: true });
  },

  /* the owner's Change prices: every size price in it moves, rounds to the
     nearest round_to, and never drops below round_to */
  change_prices(s, e, { M }) {
    const which = "change_prices needs which buildings: one style, one group, or all of them.";
    const sc = e.scope;
    if (!isObj(sc) || Object.keys(sc).length !== 1) no(which);
    let keys;
    if ("all" in sc) { if (sc.all !== true) no(which); keys = keysOf(s.offer); }
    else if ("style" in sc) keys = [soldStyle(s, sc.style)];
    else if ("group" in sc) {
      const g = typeof sc.group === "string" ? groupsOf(s, M).find((x) => nameKey(x[0]) === nameKey(sc.group)) : null;
      if (!g) no(`there is no group called ${shown(sc.group)}.`);
      keys = g[1].filter((k) => has(s.offer, k));
    } else no(which);
    const pct = "by_percent" in e;
    if (pct === ("by_dollars" in e)) no("change_prices needs by_percent or by_dollars (one of them).");
    const amount = pct ? e.by_percent : e.by_dollars;
    if (typeof amount !== "number" || !Number.isFinite(amount)) no("The amount must be a number.");
    if (pct && amount <= -100) no("Lowering by 100% or more would make the buildings free.");
    if (pct && amount > 1000) no("A raise can be at most 1,000%.");
    if (!pct && Math.abs(amount) > PRICE_CAP) no("The amount can be at most $1,000,000.");
    if (!ROUNDS.includes(e.round_to)) no("round_to must be 1, 5, 10 or 25.");
    const r = e.round_to;
    for (const k of keys) {
      const sizes = isObj(s.offer[k]?.sizes) ? s.offer[k].sizes : {};
      for (const z of sortSizes(keysOf(sizes))) {
        const old = sizes[z];
        if (!(typeof old === "number" && old > 0)) continue;
        let next = pct ? old * (1 + amount / 100) : old + amount;
        next = Math.round(next / r) * r;
        if (next < r) next = r;
        if (next !== old) sizes[z] = next;
      }
    }
  },

  /* F13: one library gable style's roof pitch, as that style's own number
     in How it's built (offer.<code>.built.roofPitch, written with
     model/build-settings.js setBuilt). It reaches every style of their own
     built like it that has no pitch of its own. A style of their own built
     like one of the gable styles takes a pitch of its own the same way. "standard" takes the
     style's own number out, so the standard building's pitch (the shop
     standard, or the library's) is used again. */
  set_roof_pitch(s, e, { M }) {
    const v = e.style;
    if (typeof v !== "string" || !CODE.test(v)) no(`there is no building style ${shown(v)}.`);
    /* a style of their own built like one of the gable styles: its own
       pitch, as set_built writes it (review M3: the only way before was
       set_built) */
    const own = !has(M.styles, v) && isObj(s.offer?.[v]) && typeof s.offer[v].base === "string" && has(M.styles, s.offer[v].base);
    if (!has(M.styles, v) && !own) {
      const stem = /^([A-Za-z]{1,5})\d+$/.exec(v)?.[1];
      if (stem && Object.keys(M.styles || {}).some((k) => k.toLowerCase() === stem.toLowerCase())) no(`there is no building style ${shown(v)} in their price list.`);
      no(`${v} is not a style in the builder's library.`);
    }
    const libKey = own ? s.offer[v].base : v, lib = M.styles[libKey];
    /* "The Premium Loft Barn is built like the Loft Barn, which has ..." */
    const which = own ? `The ${styleName(s, v, M)} is built like the ${styleName(s, libKey, M)}, which` : `The ${styleName(s, v, M)}`;
    if (lib.roof !== "gable") no(`Only a gable roof's pitch can be changed here. ${which} has ${ROOF_WORDS[lib.roof] || "a roof that isn't a gable"}, so a different pitch needs a new library style.`);
    if (lib.dormer) no(own ? `${which} has a dormer that sets its roof, so its pitch can't be changed here. A different pitch needs a new library style.`
      : `The ${styleName(s, v, M)}'s dormer sets its roof, so its pitch can't be changed here. A different pitch needs a new library style.`);
    if (!GABLE_STYLES.includes(libKey)) no(`The ${styleName(s, v, M)}'s roof pitch can't be changed here. A different pitch needs a new library style.`);
    let twelfths = null;
    if (e.pitch !== "standard") {
      const m = typeof e.pitch === "string" ? /^(\d{1,2})\/12$/.exec(e.pitch.trim()) : null;
      if (!m || Number(m[1]) < 3 || Number(m[1]) > 12) no("Pick a pitch from 3/12 to 12/12, in whole twelfths, or standard.");
      twelfths = Number(m[1]);
      /* inside How it's built's own limits for this roof (a metal roof is never flatter than 4/12) */
      const r = parseBuilt("roofPitch", twelfths, { kind: "gable", metal: !!lib.metal, name: lib.name });
      if (r.problem) no(r.problem);
    }
    if (!isObj(s.offer?.[v])) {
      /* their own styles built like it can have a pitch of their own */
      const theirs = keysOf(s.offer).filter((k) => isObj(s.offer[k]) && s.offer[k].base === v).map((k) => `${styleName(s, k, M)} (${k})`);
      no(`They don't sell the ${styleName(s, v, M)}. Sell it first (sell_style), then set its roof pitch${theirs.length ? `, or set the roof pitch of their own ${theirs.join(" or ")}, built like it` : ""}.`);
    }
    /* a price list from before How it's built: the roof pitch rule list
       this edit used to write moves into How it's built first (the same
       move every save makes); any other gable rise stays theirs */
    const lifted = liftRawRules(s, M).settings;
    if (isObj(lifted.construction?.roof?.shapes?.gable) && "rise" in lifted.construction.roof.shapes.gable) {
      no("Their gable roofs were set up another way, so the pitch can't be changed here.");
    }
    /* the short form of set_built {style, roofPitch}, with its stricter
       limits above */
    writeBuilt(s, v, [{ knob: "roofPitch", value: twelfths }], M);
  },

  /* A building style's own numbers in How it's built
     (offer.<code>.built, model/build-settings.js), the way the owner's own
     How it's built boxes write them: each part in a builder's words
     ("5/12", "7 ft 9 1/2 in", "4 in"), or "standard" to take the style's
     own number out. Only the parts that apply to that style; each is
     checked with How it's built's own limits for that style (its roof, its
     sizes, its porch). A style of their own may have numbers of its own;
     numbers on a library style also reach every style of theirs built
     like it that has none of its own. The every-size check judges the
     result after the lock, like the owner's save. */
  set_built(s, e, { M }) {
    const v = e.style;
    if (typeof v === "string" && CODE.test(v) && has(M.styles, v) && !isObj(s.offer?.[v])) {
      no(`They don't sell the ${styleName(s, v, M)}. Sell it first (sell_style), then set how it's built.`);
    }
    const k = soldStyle(s, v);
    const parts = BUILT_PART_NAMES.filter((p) => p in e);
    if (!parts.length) no(`set_built needs one or more of ${BUILT_PART_NAMES.join(", ")}.`);
    /* a price list from before How it's built: an old roof pitch rule
       list moves into How it's built first (the same move every save makes) */
    const lifted = liftRawRules(s, M).settings;
    const problems = [], writes = [];
    for (const p of parts) {
      const { knob, like } = BUILT_PARTS[p];
      const K = KNOBS.find((x) => x.id === knob);
      const standard = typeof e[p] === "string" && e[p].trim().toLowerCase() === "standard";
      const typed = standard ? null : builderWords(e[p], knob);
      if (typed === undefined) { problems.push(`${K.Words}: write it the way a builder says it, like ${like}, or standard.`); continue; }
      const r = checkStyleNumber(lifted, M, k, knob, typed);
      if (r.problem) { problems.push(r.problem); continue; }
      /* set up by hand some other way (a construction setting on a path
         this number owns): that stays theirs */
      if (typed !== null && rawHolds(lifted.construction, knob)) { problems.push(`Their ${K.words} was set up another way, so it can't be changed here.`); continue; }
      writes.push({ knob, value: r.value });
    }
    if (problems.length) no(problems.join(" "));
    writeBuilt(s, k, writes, M);
  },

  set_item(s, e, { M }) {
    const k = e.item;
    if (typeof k !== "string" || !/^[A-Za-z0-9_]{1,16}$/.test(k) || !has(M.items, k)) no(`there is no door or window called ${shown(k)} in the builder's library.`);
    const name = e.name === undefined ? null : words(e.name, "The name", NAME_MAX, { needed: true });
    const p = price(e.price, `The ${name || itemName(s, k, M)}`);
    if (!isObj(s.items)) s.items = {};
    const cur = s.items[k];
    if (isObj(cur)) { cur.price = p; if (name) cur.name = name; }
    else s.items[k] = name ? { price: p, name } : p;
  },

  stop_selling_item(s, e, { M }) {
    const k = e.item;
    if (!has(s.items, k)) no(`they don't sell ${has(M.items, k) ? "the " + M.items[k].name : shown(k)}.`);
    const name = itemName(s, k, M);
    const lock = lockedItems(s, M)[k];
    const sold = (lock?.styles || []).filter((c) => has(s.offer, c));
    if (sold.length) no(`The ${name} comes with ${listWords(sold.map((c) => "the " + styleName(s, c, M)))}, so it stays sold.`);
    if (lock?.elec) no(`The ${name} goes in with an electrical package they sell, so it stays sold.`);
    if (lock?.ext) no(`The ${name} goes up with the exterior light option, so it stays sold.`);
    delete s.items[k];
  },

  set_option(s, e, { M }) {
    const g = e.group;
    if (!OPTION_GROUPS.includes(g)) no("group must be dormers, ramps, elec, misc or rates.");
    const key = Number.isInteger(e.key) ? String(e.key) : e.key;
    if (!has(M.options?.[g], key)) no(`there is no ${OPTION_ONE[g]} called ${shown(e.key)} in the builder's library.`);
    const name = e.name === undefined ? null : words(e.name, "The name", NAME_MAX, { needed: true });
    const p = price(e.price, name || optionName(s, g, key, M));
    if (!isObj(s.options)) s.options = {};
    if (!isObj(s.options[g])) s.options[g] = {};
    const cur = s.options[g][key];
    if (isObj(cur)) { cur.price = p; if (name) cur.name = name; }
    else s.options[g][key] = name ? { price: p, name } : p;
  },

  stop_option(s, e, { M }) {
    const g = e.group;
    if (!OPTION_GROUPS.includes(g)) no("group must be dormers, ramps, elec, misc or rates.");
    const key = Number.isInteger(e.key) ? String(e.key) : e.key;
    if (!has(s.options?.[g], key)) no(`they don't offer ${has(M.options?.[g], key) ? optionName(s, g, key, M) : shown(e.key)}.`);
    delete s.options[g][key];
  },

  set_extra(s, e) {
    const name = words(e.name, "The name", NAME_MAX, { needed: true });
    if (!EXTRA_KINDS.includes(e.charged)) no("charged must be check, qty, lf, sqftF, sqftW, sqftR or pct.");
    const p = price(e.price, name);
    if (e.charged === "pct" && p > 100) no("A percent of the building can be 100% at most.");
    if (!isObj(s.options)) s.options = {};
    if (!Array.isArray(s.options.extras)) s.options.extras = [];
    const list = s.options.extras;
    if (e.key !== undefined) {
      const x = list.find((x) => isObj(x) && x.key === e.key);
      if (!x) no(`there is no extra ${shown(e.key)}.`);
      Object.assign(x, { name, input: e.charged, price: p });
    } else {
      const used = new Set(list.map((x) => x?.key).filter(Boolean));
      let key = slug(name), n = 2;
      while (used.has(key)) key = `${slug(name)}-${n++}`;
      list.push({ key, name, input: e.charged, price: p });
    }
  },

  remove_extra(s, e) {
    const list = Array.isArray(s.options?.extras) ? s.options.extras : [];
    if (!list.some((x) => isObj(x) && x.key === e.key)) no(`there is no extra ${shown(e.key)}.`);
    s.options.extras = list.filter((x) => !(isObj(x) && x.key === e.key));
  },

  set_colors(s, e, { M }) {
    if (!["paint", "trim", "metal"].includes(e.which)) no("which must be paint, trim or metal.");
    if (!Array.isArray(e.colors) || e.colors.length < 1 || e.colors.length > 40) no("colors must list 1 to 40 colors.");
    const library = new Set(Object.values(M.palettes || {}).flat().filter(Array.isArray).map((c) => c[0]));
    const list = e.colors.map((c) => {
      if (typeof c === "string") {
        if (!library.has(c)) no(`${shown(c)} isn't one of the builder's colors. Send it as a color of their own, with its name and hex.`);
        return c;
      }
      if (!isObj(c) || Object.keys(c).some((k) => k !== "name" && k !== "hex")) no("each color must be a name, or a name with its hex.");
      const name = words(c.name, "A color's name", COLOR_NAME_MAX, { needed: true });
      if (typeof c.hex !== "string" || !HEX.test(c.hex)) no(`${name} needs its color written like #2F4A3B.`);
      return [name, c.hex];
    });
    if (!isObj(s.palettes)) s.palettes = {};
    s.palettes[e.which] = list;
    keepColors(s, M);
  },

  set_defaults(s, e, { M }) {
    if (!["style", "size", "colors"].some((k) => k in e)) no("set_defaults needs style, size or colors.");
    if (!isObj(s.defaults)) s.defaults = {};
    const D = s.defaults;
    if ("style" in e) D.style = soldStyle(s, e.style);
    if ("size" in e) {
      if (typeof e.size !== "string" || !/^\d{1,2}x\d{1,2}$/.test(e.size)) no(`${shown(e.size)} is not a size. Write it like 10x16.`);
      D.size = e.size;
    } else if ("style" in e) keepOpening(s, M);
    if ("colors" in e) {
      if (!isObj(e.colors) || !Object.keys(e.colors).length) no("colors must say body, trim or roof.");
      if (!isObj(D.colors)) D.colors = {};
      for (const f of Object.keys(e.colors)) {
        if (!["body", "trim", "roof"].includes(f)) no(`colors has no ${shown(f)}: use body, trim or roof.`);
        D.colors[f] = words(e.colors[f], "A color", COLOR_NAME_MAX, { needed: true });
      }
    }
  },

  set_price_display(s, e) {
    if (!SHOWS.includes(e.show)) no("show must be price, from or none.");
    if (!isObj(s.pricing)) s.pricing = {};
    s.pricing.show = e.show;
  },

  set_fine_print(s, e) {
    const t = words(e.text, "The line under the price", TEXT_MAX);
    if (!isObj(s.notes)) s.notes = {};
    s.notes.finePrint = t;
  },

  set_size_note(s, e) {
    const w = e.width;
    if (!Number.isInteger(w) || w < 4 || w > 16) no("width must be a whole number of feet from 4 to 16.");
    if (!("text" in e)) no("set_size_note needs text (or null to take the note away).");
    const t = e.text === null ? null : words(e.text, `The note for ${w} ft wide buildings`, TEXT_MAX, { needed: true });
    if (!isObj(s.notes)) s.notes = {};
    if (!isObj(s.notes.sizeNotes)) s.notes.sizeNotes = {};
    if (t === null) delete s.notes.sizeNotes[String(w)];
    else s.notes.sizeNotes[String(w)] = t;
  },

  set_rent_to_own(s, e) {
    if (!("terms" in e)) no("set_rent_to_own needs terms (or null to turn rent to own off).");
    if (e.terms === null) {
      if (isObj(s.pricing)) delete s.pricing.rto;
      return;
    }
    if (!Array.isArray(e.terms) || e.terms.length < 1 || e.terms.length > 12) no("terms must list 1 to 12 terms, each with months and a factor.");
    const factors = {}, months = [];
    for (const t of e.terms) {
      if (!isObj(t) || !Number.isInteger(t.months) || t.months < 1 || t.months > 120
        || typeof t.factor !== "number" || !Number.isFinite(t.factor) || t.factor <= 0 || t.factor > 1) {
        no("each term needs months from 1 to 120 and a factor above 0 and at most 1.");
      }
      if (months.includes(t.months)) no(`the ${t.months}-month term is listed twice.`);
      months.push(t.months);
      factors[String(t.months)] = t.factor;
    }
    if ("show_term" in e && e.show_term !== null && !months.includes(e.show_term)) no("show_term must be one of the terms' months, or null.");
    const note = "note" in e && e.note !== null ? words(e.note, "The words under the rent-to-own price", TEXT_MAX, { needed: true }) : null;
    if (!isObj(s.pricing)) s.pricing = {};
    const old = isObj(s.pricing.rto) ? s.pricing.rto : null;
    const showTerm = "show_term" in e ? e.show_term : old && months.includes(old.showTerm) ? old.showTerm : null;
    const rto = old || {};
    rto.factors = factors;
    rto.showTerm = showTerm;
    if ("note" in e) { if (note === null) delete rto.note; else rto.note = note; }
    s.pricing.rto = rto;
  },

  set_quote_form(s, e) {
    if (!["fields", "ask_plan", "sms_consent"].some((k) => k in e)) no("set_quote_form needs fields, ask_plan or sms_consent.");
    if ("fields" in e) {
      if (!isObj(e.fields) || !Object.keys(e.fields).length) no("fields must name one or more boxes of the quote form.");
      for (const [f, v] of Object.entries(e.fields)) {
        if (f === "name") no("The name is always asked, so it can't be changed.");
        if (!QUOTE_BOXES.includes(f)) no(`the quote form has no ${shown(f)} box.`);
        if (!BOX_WORDS.includes(v)) no("each box must be required, optional or off.");
      }
    }
    if ("ask_plan" in e && typeof e.ask_plan !== "boolean") no("ask_plan must be true or false.");
    const sms = "sms_consent" in e && e.sms_consent !== null ? words(e.sms_consent, "The texting permission words", TEXT_MAX, { needed: true }) : null;
    if (!isObj(s.leads)) s.leads = {};
    const L = s.leads;
    if ("fields" in e) {
      if (!isObj(L.fields)) L.fields = {};
      for (const [f, v] of Object.entries(e.fields)) L.fields[f] = v;
    }
    if ("ask_plan" in e) L.askPlan = e.ask_plan;
    if ("sms_consent" in e) L.smsConsent = sms;
  },

  /* F5: while the owner's switch is on, the business phone, email and
     website are the owner's (or Alan's by hand in the visit) */
  set_business(s, e, { mode }) {
    const keys = ["name", "short", "tagline", "phone", "email", "website"].filter((k) => k in e);
    if (!keys.length) no("set_business needs name, short, tagline, phone, email or website.");
    if (mode === "switch" && keys.some((k) => ["phone", "email", "website"].includes(k))) no(LOCK_WORDS.contact);
    const out = {};
    for (const k of keys) {
      if (k === "name") out.name = words(e.name, "The business name", BUSINESS_NAME_MAX, { needed: true });
      if (k === "short") out.short = words(e.short, "The short name", NAME_MAX);
      if (k === "tagline") out.tagline = words(e.tagline, "The tagline", TEXT_MAX);
      if (k === "phone") {
        out.phone = words(e.phone, "The business phone", 40);
        if (out.phone && (!/^[0-9+().\-\s x#]+$/i.test(out.phone) || out.phone.replace(/\D/g, "").length < 7)) no("The business phone can only have numbers, spaces and ( ) - +, with at least 7 numbers.");
      }
      if (k === "email") {
        out.email = words(e.email, "The business email", 200).toLowerCase();
        if (out.email && !EMAIL_RE.test(out.email)) no("The business email doesn't look like an email address.");
      }
      if (k === "website") {
        out.website = words(e.website, "The business website", TEXT_MAX);
        if (out.website && !/^https:\/\/[^\s]+$/.test(out.website)) no("The business website must be a web address that starts with https://.");
      }
    }
    if (!isObj(s.brand)) s.brand = {};
    for (const k of keys) s.brand[k] = out[k];
  },

  set_brand_colors(s, e) {
    const keys = ["header", "primary", "accent"].filter((k) => k in e);
    if (!keys.length) no("set_brand_colors needs header, primary or accent.");
    for (const k of keys) if (typeof e[k] !== "string" || !HEX.test(e[k])) no(`${k} must be a color written like #1f2a24.`);
    if (!isObj(s.brand)) s.brand = {};
    if (!isObj(s.brand.colors)) s.brand.colors = {};
    for (const k of keys) s.brand.colors[k] = e[k];
  },
};

/* -> {settings, problems, newCodes}. settings is null when there are
   problems ("Edit 3: ..."): nothing is half done. options:
     manufacturer  the builder's library
     mode          "prelive" or "switch" (access() says which) */
export function applyEdits(settings, edits, { manufacturer: M, mode = "prelive" } = {}) {
  if (!Array.isArray(edits) || edits.length < 1 || edits.length > MAX_EDITS) return { settings: null, problems: [TOO_MANY_EDITS], newCodes: {} };
  let s = structuredClone(settings);
  const problems = [];
  const newCodes = {};
  const ctx = { M, mode, original: settings, newCodes };
  edits.forEach((e, i) => {
    try {
      if (!isObj(e) || typeof e.do !== "string") no("every edit needs do: the name of the edit.");
      if (!Object.prototype.hasOwnProperty.call(EDITS, e.do)) no(`there is no edit called ${shown(e.do)}.`);
      for (const k of Object.keys(e)) if (k !== "do" && !EDITS[e.do].includes(k)) no(`${shown(k)} isn't part of ${e.do}.`);
      const trial = structuredClone(s);
      HANDLERS[e.do](trial, e, ctx);
      s = trial;
    } catch (err) {
      if (!(err instanceof EditProblem)) throw err;
      problems.push(`Edit ${i + 1}: ${err.message}`);
    }
  });
  return { settings: problems.length ? null : s, problems, newCodes };
}

/* ---- warnings ------------------------------------------------------------------------- */

const EMAIL_IN = /[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[A-Za-z]{2,}/g;
/* a web address: http://, https://, www., or any name.ending like
   othersheds.shop, bit.ly/3xYz or t.me/x (an ending of 2 to 24 letters) */
const WEB_IN = /\bhttps?:\/\/|\bwww\.|\b[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,24}\b/i;
const PHONE_IN = /(?<!\d)(?:\+?1[\s.-]*)?(?:\(\d{3}\)|\d{3})[\s.-]*\d{3}[\s.-]*\d{4}(?!\d)/;

/* What contact details are in words a customer reads: a web address, an
   email address, a phone number (10 digits in any usual form). */
export function contactKinds(text) {
  const t = String(text ?? "");
  const out = [];
  if (WEB_IN.test(t.replace(EMAIL_IN, " "))) out.push("a web address");
  if (new RegExp(EMAIL_IN.source).test(t)) out.push("an email address");
  if (PHONE_IN.test(t)) out.push("a phone number");
  return out;
}

/* Every bit of free text customers read: [where, before, after]. */
const PALETTE_WORDS = { paint: "siding", trim: "trim", metal: "roof" };
function customerTexts(old, next, M) {
  const out = [];
  const add = (where, a, b) => out.push([where, typeof a === "string" ? a : "", typeof b === "string" ? b : ""]);
  add("The business name", old.brand?.name, next.brand?.name);
  add("The short name", old.brand?.short, next.brand?.short);
  add("The line under the price", old.notes?.finePrint, next.notes?.finePrint);
  for (const w of [...new Set([...keysOf(old.notes?.sizeNotes), ...keysOf(next.notes?.sizeNotes)])]) {
    add(`The note for ${w} ft wide buildings`, old.notes?.sizeNotes?.[w], next.notes?.sizeNotes?.[w]);
  }
  add("The words under the rent-to-own price", old.pricing?.rto?.note, next.pricing?.rto?.note);
  add("The texting permission words", old.leads?.smsConsent, next.leads?.smsConsent);
  add("The tagline", old.brand?.tagline, next.brand?.tagline);
  const groupNames = (s) => (Array.isArray(s.categories) ? s.categories : []).map((g) => g?.[0]).filter((n) => typeof n === "string");
  const oldGroups = groupNames(old);
  for (const g of groupNames(next)) add(`The building group "${g}"`, oldGroups.includes(g) ? g : "", g);
  for (const k of keysOf(next.offer)) add(`The building name "${ownName(next.offer[k])}"`, ownName(old.offer?.[k]), ownName(next.offer[k]));
  for (const k of keysOf(next.items)) add(`The door or window name "${ownName(next.items[k])}"`, ownName(old.items?.[k]), ownName(next.items[k]));
  for (const g of OPTION_GROUPS) for (const k of keysOf(next.options?.[g])) add(`The option name "${ownName(next.options[g][k])}"`, ownName(old.options?.[g]?.[k]), ownName(next.options[g][k]));
  const oldExtras = new Map((Array.isArray(old.options?.extras) ? old.options.extras : []).map((x) => [x?.key, x?.name]));
  for (const x of Array.isArray(next.options?.extras) ? next.options.extras : []) add(`The extra name "${x?.name}"`, oldExtras.get(x?.key), x?.name);
  /* colors of their own ([name, hex]): the name is on the 3D designer's swatch */
  const own = (s, g) => (Array.isArray(s.palettes?.[g]) ? s.palettes[g] : []).filter((c) => Array.isArray(c) && typeof c[0] === "string").map((c) => c[0]);
  for (const g of Object.keys(PALETTE_WORDS)) {
    const before = own(old, g);
    for (const name of own(next, g)) add(`The ${PALETTE_WORDS[g]} color "${name}"`, before.includes(name) ? name : "", name);
  }
  return out;
}

const sizesIn = (s, k) => (isObj(s.offer?.[k]?.sizes) ? s.offer[k].sizes : {});
const dims = (z) => z.split("x").map(Number);
const movedWords = (what, a, b) => (typeof a === "number" && typeof b === "number" && a > 0 && a !== b && Math.abs(b - a) / a > 0.4
  ? `${what} moves ${Math.round((Math.abs(b - a) / a) * 100)}%: ${money(a)} → ${money(b)}.` : null);

/* -> the warnings for going from `old` to `next`, in the contract's order. */
export function warnings(old, next, M) {
  const o = isObj(old) ? old : {}, n = isObj(next) ? next : {};
  const out = [];
  /* 1. the business phone, email or website that customers see */
  const contact = ["phone", "email", "website"].filter((k) => (o.brand?.[k] || "") !== (n.brand?.[k] || ""));
  if (contact.length) out.push(`This changes the business ${listWords(contact)} that customers see. Check it with the owner.`);
  /* 2. text customers read, written or changed, with contact details in it */
  for (const [where, before, after] of customerTexts(o, n, M)) {
    if (!after || after === before) continue;
    const kinds = contactKinds(after);
    const many = / words$/.test(where);
    if (kinds.length) out.push(`${where} ${many ? "have" : "has"} ${listWords(kinds)} in ${many ? "them" : "it"}. Customers read ${many ? "them" : "it"}, so check ${many ? "they are" : "it is"} right.`);
  }
  /* 3 to 6: only the styles and prices this change touches */
  const cheaper = [], moved = [], extreme = [], same = [];
  let changed = 0, total = 0;
  for (const k of keysOf(n.offer)) {
    const ns = sizesIn(n, k), os = sizesIn(o, k), name = styleName(n, k, M);
    const zs = sortSizes(keysOf(ns));
    total += zs.length;
    const touched = zs.filter((z) => ns[z] !== os[z]);
    const removed = keysOf(os).some((z) => !has(ns, z));
    for (const z of zs) if (has(os, z) && os[z] !== ns[z]) changed++;
    for (const big of zs) {
      const [bw, bl] = dims(big);
      const smaller = zs.filter((z) => z !== big && dims(z)[0] <= bw && dims(z)[1] <= bl && ns[z] > ns[big] && (touched.includes(z) || touched.includes(big)));
      if (!smaller.length) continue;
      const worst = smaller.reduce((a, b) => (ns[b] > ns[a] ? b : a));
      cheaper.push(`${name} ${times(big)} (${money(ns[big])}) costs less than the smaller ${times(worst)} (${money(ns[worst])}).`);
    }
    for (const z of touched) {
      const w = movedWords(`${name} ${times(z)}`, os[z], ns[z]);
      if (w) moved.push(w);
      if (ns[z] < 500) extreme.push(`${name} ${times(z)} at ${money(ns[z])} is under $500.`);
      if (ns[z] > 100000) extreme.push(`${name} ${times(z)} at ${money(ns[z])} is over $100,000.`);
    }
    const prices = zs.map((z) => ns[z]);
    if ((touched.length || removed || !has(o.offer, k)) && prices.length >= 2 && prices.every((p) => p === prices[0])) same.push(`Every size of the ${name} is ${money(prices[0])}.`);
  }
  for (const k of keysOf(n.items)) if (has(o.items, k)) { const w = movedWords(itemName(n, k, M), priceOf(o.items[k]), priceOf(n.items[k])); if (w) moved.push(w); }
  for (const g of OPTION_GROUPS) {
    for (const k of keysOf(n.options?.[g])) if (has(o.options?.[g], k)) { const w = movedWords(optionName(n, g, k, M), priceOf(o.options[g][k]), priceOf(n.options[g][k])); if (w) moved.push(w); }
  }
  const oldExtras = new Map((Array.isArray(o.options?.extras) ? o.options.extras : []).map((x) => [x?.key, x]));
  for (const x of Array.isArray(n.options?.extras) ? n.options.extras : []) {
    const was = oldExtras.get(x?.key);
    /* charged another way (a foot, a percent): the two prices aren't comparable */
    if (!was || was.input !== x?.input) continue;
    const w = x.input === "pct" ? movedWords(String(x?.name), was.price, x.price)?.replace(/\$([\d.,]+)/g, "$1%") : movedWords(String(x?.name), was.price, x?.price);
    if (w) moved.push(w);
  }
  /* a rent-to-own factor: the monthly payment customers see moves with it */
  const factors = (s) => (isObj(s.pricing?.rto?.factors) ? s.pricing.rto.factors : {});
  const of = factors(o), nf = factors(n);
  for (const m of Object.keys(nf).filter((m) => /^\d+$/.test(m) && has(of, m)).sort((a, b) => Number(a) - Number(b))) {
    const a = Number(of[m]), b = Number(nf[m]);
    if (a > 0 && b > 0 && a !== b && Math.abs(b - a) / a > 0.4) moved.push(`The rent-to-own factor for ${m} months moves ${Math.round((Math.abs(b - a) / a) * 100)}%: ${a} → ${b}.`);
  }
  out.push(...cheaper, ...moved, ...extreme, ...same);
  /* 7. more than half of the building prices */
  if (changed * 2 > total) out.push(`This changes ${changed} of ${total} building prices.`);
  /* 8. three or more styles stop selling */
  const stopped = keysOf(o.offer).filter((k) => !has(n.offer, k));
  if (stopped.length >= 3) out.push(`This stops selling ${stopped.length} building styles: ${stopped.map((k) => styleName(o, k, M)).join(", ")}.`);
  /* 9. an extra of theirs that changes how the building is built, and that
     this change makes change nothing on a building it is offered on: its
     roof pitch counts only when it is steeper than the style's (review
     SEC-BUILT-2). The owner's own How it's built screen says the same. A
     building it already changed nothing on isn't said again. */
  const nothingOn = (s) => { try { return extrasThatChangeNothing(s, M); } catch { return []; } };
  const before = new Map(nothingOn(o).map((x) => [String(x.key), new Set(x.styles)]));
  for (const x of nothingOn(n)) {
    const had = before.get(String(x.key));
    if (x.styles.some((k) => !had || !had.has(k))) out.push(x.words);
  }
  return out;
}
