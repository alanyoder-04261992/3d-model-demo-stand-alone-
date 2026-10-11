/* THE EVERY-SIZE CHECK FOR A BUSINESS'S OWN BUILDING NUMBERS. Node-safe,
   pure, no I/O: the Dealer Center's save (server/office/built-check.js) and
   its How it's built screen (ui/office/views/price-list/built.js) use the
   same code.

   WHY. Alan (Oct 2026, "lets all 5"): each business can build a style its
   own way -- taller walls, another roof pitch, a deeper porch -- without a
   redeploy, and an automatic check replaces looking at every size by eye.
   model/style-check.js draws a style at every size it is sold in and says
   what does not fit. This file decides WHICH styles a change reaches and
   what the business's numbers CAUSED: a finding the same building also has
   with the standard numbers (Barnwright's own layouts have a few, listed in
   test/style-sizes-known.json) is the shop's, never the owner's, so it never
   stops a save.

     ownNumbersOf(settings, M)    {KEY: {knob: {value, from}}} for every
                                  offered style with numbers of the
                                  business's own (this style, the style it is
                                  built like, or business-wide)
     withoutOwnNumbers(settings)  the same price list with every How it's
                                  built number taken out: the standard
     changedStyles(before, after, M, cat)
                                  what a save has to check: each style whose
                                  own numbers changed (every size), whose
                                  sizes were added (those sizes), and each
                                  style a changed extra with numbers reaches
                                  (with that extra on)
     checkAgainstStandard(cat, std, key, opts)
                                  one style through model/style-check.js, each
                                  finding compared with the same building
                                  drawn with the standard numbers
     summarize(results)           the findings in words, the same finding at
                                  many sizes said once: {problems, warnings,
                                  unchecked, already, buildings}

   A PROBLEM caused by the business's numbers refuses the save. A WARNING the
   business's numbers caused is shown ("worth a look"). What the standard
   building has too is counted, never shown as the owner's. */

import * as BUILT from "./build-settings.js";
import { checkStyle, checkBuilding, variantsOf } from "./style-check.js";
import { defaults, setType } from "./design.js";
import { frameOf } from "./frame.js";
import { makePlan } from "./plan.js";
import { resetItems } from "./layout.js";

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const keysOf = (o) => (isObj(o) ? Object.keys(o).filter((k) => !k.startsWith("_")) : []);
const own = (o, k) => isObj(o) && Object.prototype.hasOwnProperty.call(o, k);
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
function now() { return (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now(); }

/* Where a number counts as the business's own (model/build-settings.js
   effective "from"): set on this style, on the style it is built like, or
   for the whole business. */
export function isOwnSource(from) {
  return from === "this style" || from === "business-wide" || /^built like /.test(String(from || ""));
}

/* {KEY: {knob: {value, from}}}: only styles with at least one own number. */
export function ownNumbersOf(settings, M) {
  const out = {};
  if (!isObj(settings) || !isObj(M)) return out;
  const applied = BUILT.apply(BUILT.liftRawRules(settings, M).settings, M).styles;
  for (const k of Object.keys(applied)) {
    const b = applied[k].built || {};
    const mine = {};
    for (const id of Object.keys(b)) if (isOwnSource(b[id].from)) mine[id] = { value: b[id].value, from: b[id].from };
    if (Object.keys(mine).length) out[k] = mine;
  }
  return out;
}

/* What reaches the drawing for each offered style: the traits it sets, the
   traits it drops and its own construction layer. Two price lists that give
   a style the same of these draw it the same. */
function drawnOf(settings, M) {
  const out = {};
  const applied = BUILT.apply(BUILT.liftRawRules(settings, M).settings, M).styles;
  for (const k of Object.keys(applied)) {
    const r = applied[k];
    out[k] = JSON.stringify([r.traits, r.drop, r.construction]);
  }
  return out;
}

/* The same price list with no How it's built number of the business's own:
   no business-wide numbers, none on a style, none on an extra. (The shop
   standard, styles.<KEY>.built in the builder's library, still counts: it
   is the standard.) */
export function withoutOwnNumbers(settings) {
  const s = structuredClone(settings);
  delete s.built;
  for (const k of keysOf(s.offer)) if (isObj(s.offer[k])) delete s.offer[k].built;
  if (isObj(s.options) && Array.isArray(s.options.extras)) for (const x of s.options.extras) if (isObj(x)) delete x.built;
  return s;
}

/* What a save from `before` to `after` must check: [{key, sizes, extra}].
   sizes null = every size; extra = {key, name} for a check with that extra
   on. A price change, a new name or a style with only standard numbers
   gives nothing to check. cat: after, resolved (model/company.js). */
export function changedStyles(before, after, M, cat) {
  const out = [];
  if (!isObj(after) || !isObj(M)) return out;
  const mine = ownNumbersOf(after, M);
  const drawnA = drawnOf(after, M);
  const drawnB = isObj(before) ? drawnOf(before, M) : {};
  const offerB = isObj(before) && isObj(before.offer) ? before.offer : {};
  for (const k of keysOf(after.offer)) {
    if (!mine[k]) continue;
    const was = offerB[k];
    if (!isObj(was) || drawnA[k] !== drawnB[k]) { out.push({ key: k, sizes: null, extra: null }); continue; }
    const added = keysOf(after.offer[k].sizes).filter((z) => !own(was.sizes, z));
    if (added.length) out.push({ key: k, sizes: added, extra: null });
  }
  /* an extra with numbers of its own, new or changed: every style it changes */
  const extrasB = new Map((isObj(before) && isObj(before.options) && Array.isArray(before.options.extras) ? before.options.extras : []).filter(isObj).map((x) => [x.key, x]));
  const extrasA = isObj(after.options) && Array.isArray(after.options.extras) ? after.options.extras : [];
  for (const x of extrasA) {
    if (!isObj(x) || !isObj(x.built) || !keysOf(x.built).length) continue;
    const old = extrasB.get(x.key);
    if (old && same(old.built, x.built)) continue;
    for (const k of keysOf(after.offer)) {
      const t = cat && cat.TYPES && cat.TYPES[k];
      if (t && t.optionEffects && t.optionEffects[x.key]) out.push({ key: k, sizes: null, extra: { key: x.key, name: String(x.name || "").trim() || "your extra" } });
    }
  }
  return out;
}

/* The ways one size is built, with an extra switched on when asked. */
function variantsFor(cat, key, extra) {
  const t = cat.TYPES[key];
  const vs = variantsOf(t, cat);
  if (!extra) return vs;
  return vs.map((v) => ({
    id: (v.id ? v.id + " " : "") + "with " + extra.key,
    words: (v.words ? v.words + " and " : "with ") + extra.name,
    set: Object.assign({}, v.set, { xopt: { [extra.key]: 1 } }),
  }));
}

/* One building of a style, laid out the way model/style-check.js lays it. */
function planOf(cat, key, size, set) {
  const st = defaults(cat);
  setType(st, key, cat);
  st.size = size;
  Object.assign(st, structuredClone(set || {}));
  const fr = frameOf(st, cat);
  resetItems(st, fr, cat);
  return makePlan(st, cat);
}

/* The finding ids the standard building has (problems and warnings). */
function standardIds(std, key, size, set, label, framing) {
  try {
    const r = checkBuilding(planOf(std, key, size, set), { label, framing, gableItems: true });
    return new Set(r.problems.concat(r.warnings).map((f) => f.id));
  } catch (e) {
    return new Set(["draws:" + size]);
  }
}

/* One style, every size it is sold in (or opts.sizes), each finding
   compared with the standard building. opts: {sizes, extra, budgetMs}.
   -> {key, name, extra, problems, warnings, already, unchecked, buildings, ms}
   problems/warnings/already are model/style-check.js findings. */
export function checkAgainstStandard(cat, std, key, opts) {
  opts = opts || {};
  const t0 = now();
  const t = cat.TYPES[key];
  const out = { key, name: t ? t.name : key, extra: opts.extra || null, problems: [], warnings: [], already: [], unchecked: [], buildings: 0, ms: 0 };
  if (!t || !std.TYPES[key]) return out;
  const variants = variantsFor(cat, key, opts.extra);
  const byId = new Map(variants.map((v) => [v.id, v]));
  const r = checkStyle(cat, key, { sizes: opts.sizes || undefined, variants, budgetMs: opts.budgetMs });
  out.buildings = r.buildings;
  out.unchecked = r.unchecked.map((u) => ({ size: u.size, variant: u.variant, words: u.words }));
  /* findings about the style as a whole (a wider building lower than a
     narrower one): compared with the standard style as a whole */
  const inRows = new Set();
  for (const row of r.results) for (const f of row.problems.concat(row.warnings)) inRows.add(f);
  const styleLevel = r.problems.concat(r.warnings).filter((f) => !inRows.has(f));
  if (styleLevel.length) {
    const s = checkStyle(std, key, { sizes: [] });
    const ids = new Set(s.problems.concat(s.warnings).map((f) => f.id));
    for (const f of styleLevel) {
      if (ids.has(f.id)) out.already.push(f);
      else if (r.problems.indexOf(f) >= 0) out.problems.push(f);
      else out.warnings.push(f);
    }
  }
  for (const row of r.results) {
    if (!row.problems.length && !row.warnings.length) continue;
    const v = byId.get(row.variant) || { set: {} };
    const ids = standardIds(std, key, row.size, v.set, row.label, row.problems.some((f) => f.code === "framing"));
    for (const f of row.problems) (ids.has(f.id) ? out.already : out.problems).push(f);
    for (const f of row.warnings) if (!ids.has(f.id)) out.warnings.push(f);
  }
  out.ms = now() - t0;
  return out;
}

/* "8x12" sizes in a sentence: "8x12, 10x12 and 3 more" */
function sizeList(sizes) {
  const list = [...new Set(sizes)];
  if (list.length <= 3) return list.length < 2 ? list.join("") : list.slice(0, -1).join(", ") + " and " + list[list.length - 1];
  return list.slice(0, 2).join(", ") + ` and ${list.length - 2} more`;
}
/* The size a finding is about, read off its words ("Utility Shed 10x20: ..."). */
function sizeOf(f, name) {
  const m = new RegExp("^" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + " (\\d+x\\d+)").exec(f.words);
  return m ? m[1] : null;
}

/* The same finding at many sizes, said once: the first one in full (the
   typical size is drawn first), then where else. */
function grouped(list, results) {
  const out = [];
  const seen = new Map();
  for (const f of list) {
    const res = results.find((r) => r.problems.indexOf(f) >= 0 || r.warnings.indexOf(f) >= 0) || {};
    const k = (res.key || "") + "|" + ((res.extra && res.extra.key) || "") + "|" + f.id;
    const z = sizeOf(f, res.name || "");
    if (!seen.has(k)) { const g = { first: f, sizes: [] }; seen.set(k, g); out.push(g); continue; }
    const g = seen.get(k);
    if (z && z !== sizeOf(g.first, res.name || "")) g.sizes.push(z);
  }
  return out.map((g) => g.first.words + (g.sizes.length ? ` The same at ${sizeList(g.sizes)}.` : ""));
}

/* Every result in words: {problems, warnings, unchecked, already, buildings}. */
export function summarize(results) {
  const problems = [], warnings = [];
  let already = 0, buildings = 0;
  for (const r of results) {
    problems.push(...r.problems);
    warnings.push(...r.warnings);
    already += r.already.length;
    buildings += r.buildings;
  }
  const unchecked = [];
  const byStyle = new Map();
  for (const r of results) {
    if (!r.unchecked.length) continue;
    const g = byStyle.get(r.key) || { name: r.name, sizes: new Set() };
    for (const u of r.unchecked) g.sizes.add(u.size);
    byStyle.set(r.key, g);
  }
  for (const g of byStyle.values()) unchecked.push(`Not checked yet: ${g.sizes.size} size${g.sizes.size === 1 ? "" : "s"} of the ${g.name}. Press Check every size.`);
  return {
    problems: [...new Set(grouped(problems, results))],
    warnings: [...new Set(grouped(warnings, results))],
    unchecked, already, buildings,
  };
}
