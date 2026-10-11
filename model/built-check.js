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
   with the standard numbers, no worse (Barnwright's own layouts have a few,
   listed in test/style-sizes-known.json), is the shop's, never the owner's,
   so it never stops a save; made WORSE (a roof edge that hung 3/4 in in
   front of a door head now hangs 6 1/4 in) it is the owner's, said with
   what the standard building has.

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
import { checkStyle, checkBuilding, variantsOf, orderSizes, amountWords, AMOUNT_SLACK_IN } from "./style-check.js";
import { defaults, setType } from "./design.js";
import { frameOf } from "./frame.js";
import { makePlan } from "./plan.js";
import { resetItems } from "./layout.js";
import { extraOfferedOn } from "./company.js";

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
export function drawnOf(settings, M) {
  const out = {};
  const applied = BUILT.apply(BUILT.liftRawRules(settings, M).settings, M).styles;
  for (const k of Object.keys(applied)) {
    const r = applied[k];
    out[k] = JSON.stringify([r.traits, r.drop, r.construction]);
  }
  return out;
}

/* The same price list with no number of the business's own: no
   business-wide numbers, none on a style, nothing an extra changes about
   the building (its built and its construction). The business's raw
   construction settings are the ones `rawFrom` had (the price list before
   this save), so what a save changes there is the owner's and what was
   already there is not. (The shop standard, styles.<KEY>.built in the
   builder's library, still counts: it is the standard.) */
export function withoutOwnNumbers(settings, rawFrom) {
  const s = structuredClone(settings);
  delete s.built;
  for (const k of keysOf(s.offer)) if (isObj(s.offer[k])) delete s.offer[k].built;
  if (isObj(s.options) && Array.isArray(s.options.extras)) for (const x of s.options.extras) if (isObj(x)) { delete x.built; delete x.construction; }
  if (rawFrom !== undefined) {
    if (isObj(rawFrom) && rawFrom.construction !== undefined) s.construction = structuredClone(rawFrom.construction);
    else delete s.construction;
  }
  return s;
}

/* The business's extras that change how a building is built: their own
   How it's built numbers (built) or construction settings. */
function effectExtras(settings) {
  const xs = isObj(settings) && isObj(settings.options) && Array.isArray(settings.options.extras) ? settings.options.extras : [];
  return xs.filter((x) => isObj(x) && typeof x.key === "string" && ((isObj(x.built) && keysOf(x.built).length) || (isObj(x.construction) && keysOf(x.construction).length)));
}
/* Does extra x change style k in the resolved catalogue c? */
function extraReaches(c, x, k) {
  const t = c && c.TYPES && c.TYPES[k];
  if (!t || !x || !extraOfferedOn(x, t, k)) return false;
  return !!((t.optionEffects && t.optionEffects[x.key]) || (c.optionEffects && c.optionEffects[x.key]));
}

/* The construction settings that reach style k's drawing, as text: every
   block but the roof, and of the roof only this style's shape (and the
   Dormer Shed's main roof, the cottages' eave). */
function rawSig(c, k) {
  const t = c && c.TYPES && c.TYPES[k];
  if (!t) return "";
  const con = isObj(c.construction) ? c.construction : {};
  const roof = isObj(con.roof) ? con.roof : {};
  const rest = Object.assign({}, con);
  delete rest.roof;
  const others = Object.keys(roof).filter((x) => ["shapes", "dormerRise", "cottageEave"].indexOf(x) < 0).map((x) => [x, roof[x]]);
  return JSON.stringify([rest, isObj(roof.shapes) ? roof.shapes[t.roof] : null, t.dormer ? roof.dormerRise : null, t.cottage ? roof.cottageEave : null, others]);
}

/* What a save from `before` to `after` must check: [{key, sizes, extra}].
   sizes null = every size; extra = {key, name} for a check with that extra
   on. cat: after, resolved (model/company.js); catBefore: before, resolved
   (when it can be). A price change, a new name or a style with only
   standard numbers gives nothing to check.
     - a style whose drawing changed (its own numbers, the style it is built
       like, business-wide numbers, the business's raw construction), or a
       style newly sold: every size; a style that only gained sizes: those
       sizes. Only a style with numbers of the business's own is drawn on its
       own (the tools check covers the standard).
     - with each extra that changes how that style is built (a Steep roof,
       an extra's construction settings) switched on, too: a new wall with
       the sample's Steep roof may not fit when the wall alone does.
     - an extra whose numbers changed, that is new, or that reaches a style
       it did not reach before (its styles list widened, a style it lists is
       sold again): every size of each style it reaches, with it on. */
export function changedStyles(before, after, M, cat, catBefore) {
  const out = [];
  if (!isObj(after) || !isObj(M)) return out;
  const mine = ownNumbersOf(after, M);
  const drawnA = drawnOf(after, M);
  const drawnB = isObj(before) ? drawnOf(before, M) : {};
  const offerB = isObj(before) && isObj(before.offer) ? before.offer : {};
  const rawChanged = !same(isObj(before) ? before.construction : undefined, after.construction);
  const extrasA = effectExtras(after);
  const extrasB = new Map(effectExtras(before).map((x) => [x.key, x]));
  const job = (key, sizes, x) => out.push({ key, sizes, extra: x ? { key: x.key, name: String(x.name || "").trim() || "your extra" } : null });
  for (const k of keysOf(after.offer)) {
    const was = offerB[k];
    const isNew = !isObj(was);
    /* the business's raw construction settings changed for this style (a
       saltbox rise reaches the cottages, not the barns) */
    const rawK = rawChanged && (!catBefore || rawSig(catBefore, k) !== rawSig(cat, k));
    const styleChanged = isNew || drawnA[k] !== drawnB[k] || rawK;
    const added = isNew ? [] : keysOf(after.offer[k].sizes).filter((z) => !own(was.sizes, z));
    if (mine[k] || rawK) {
      if (styleChanged) job(k, null, null);
      else if (added.length) job(k, added, null);
    }
    for (const x of extrasA) {
      if (!extraReaches(cat, x, k)) continue;
      const old = extrasB.get(x.key);
      const xChanged = !old || !same(old.built, x.built) || !same(old.construction, x.construction);
      const newlyReaches = isNew || !old || !catBefore || !extraReaches(catBefore, old, k);
      if (styleChanged || xChanged || newlyReaches) job(k, null, x);
      else if (added.length) job(k, added, x);
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

/* What the standard building has (problems and warnings): {id: the
   finding, the worst of that id}. */
function standardFindings(std, key, size, set, label, framing) {
  const out = new Map();
  try {
    const r = checkBuilding(planOf(std, key, size, set), { label, framing, gableItems: true });
    for (const f of r.problems.concat(r.warnings)) keepWorst(out, f);
  } catch (e) {
    out.set("draws:" + size, { id: "draws:" + size });
  }
  return out;
}
function keepWorst(map, f) {
  const had = map.get(f.id);
  if (!had || (typeof f.amount === "number" && !(f.amount <= had.amount))) map.set(f.id, f);
}
/* Is finding f worse than the same finding s on the standard building?
   (more than 1/16 in further out, or more pieces) */
function worseThan(f, s) {
  if (typeof f.amount !== "number" || typeof s.amount !== "number") return false;
  return f.amount > s.amount + (f.unit === "count" ? 0 : AMOUNT_SLACK_IN / 12);
}
/* f in words, with what the standard building has: "... hangs 6 1/4 in in
   front of the head of the 36″ In-Swing Door on the right side. With the
   standard numbers it is 3/4 in." */
function worsened(f, s) {
  return Object.assign({}, f, { words: `${f.words} With the standard numbers it is ${amountWords(s)}.`, detail: `${f.detail} With the standard numbers it is ${amountWords(s)}.`, standardAmount: s.amount });
}
/* A finding the standard building has too, no worse, is "already so";
   worse, or not on the standard building at all, it is the business's. */
function sortFinding(f, std, out, problem) {
  const s = std.get(f.id);
  if (s && !worseThan(f, s)) { if (problem) out.already.push(f); return; }
  (problem ? out.problems : out.warnings).push(s ? worsened(f, s) : f);
}

/* One style, every size it is sold in (or opts.sizes), each finding
   compared with the same building drawn with the standard numbers.
   opts: {sizes, extra, budgetMs, widths}.
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
  const r = checkStyle(cat, key, { sizes: opts.sizes || undefined, variants, budgetMs: opts.budgetMs, widths: opts.widths });
  out.buildings = r.buildings;
  out.unchecked = r.unchecked.map((u) => ({ size: u.size, variant: u.variant, words: u.words }));
  /* findings about the style as a whole (a wider building lower than a
     narrower one): compared with the standard style as a whole */
  const inRows = new Set();
  for (const row of r.results) for (const f of row.problems.concat(row.warnings)) inRows.add(f);
  const styleLevel = r.problems.concat(r.warnings).filter((f) => !inRows.has(f));
  if (styleLevel.length) {
    const s = checkStyle(std, key, { sizes: [] });
    const stdStyle = new Map();
    for (const f of s.problems.concat(s.warnings)) keepWorst(stdStyle, f);
    for (const f of styleLevel) sortFinding(f, stdStyle, out, r.problems.indexOf(f) >= 0);
  }
  for (const row of r.results) {
    if (!row.problems.length && !row.warnings.length) continue;
    const v = byId.get(row.variant) || { set: {} };
    const stdRow = standardFindings(std, key, row.size, v.set, row.label, row.problems.some((f) => f.code === "framing"));
    for (const f of row.problems) sortFinding(f, stdRow, out, true);
    for (const f of row.warnings) sortFinding(f, stdRow, out, false);
  }
  out.ms = now() - t0;
  return out;
}

/* The order the sizes of every job are drawn in, ACROSS styles: the size
   the designer opens on of every job first, then the smallest and the
   largest of each, then the rest -- so a business-wide change that reaches
   many styles never leaves the last styles in the price list unchecked
   while the first are done to the last size. -> [{job (its index), sizes,
   first (the job's first step: the roof-widths test runs there)}] */
export function jobSteps(cat, jobs) {
  const phases = jobs.map((j) => {
    const all = Object.keys((cat.P && cat.P[j.key]) || {});
    const sizes = orderSizes(j.sizes ? all.filter((z) => j.sizes.indexOf(z) >= 0) : all);
    return [sizes.slice(0, 1), sizes.slice(1, 3), sizes.slice(3)];
  });
  const out = [], started = new Set();
  for (let ph = 0; ph < 3; ph++) {
    phases.forEach((p, i) => {
      if (!p[ph].length) return;
      out.push({ job: i, sizes: p[ph], first: !started.has(i) });
      started.add(i);
    });
  }
  return out;
}

/* Every job of changedStyles within one time budget, in jobSteps order.
   What the time does not reach is listed in `unchecked`.
   -> one result per job, as checkAgainstStandard gives */
export function checkJobs(cat, std, jobs, { budgetMs = Infinity } = {}) {
  const t0 = now();
  const res = jobs.map((j) => {
    const t = cat.TYPES[j.key];
    return { key: j.key, name: t ? t.name : j.key, extra: j.extra || null, problems: [], warnings: [], already: [], unchecked: [], buildings: 0, ms: 0 };
  });
  for (const step of jobSteps(cat, jobs)) {
    const j = jobs[step.job], r0 = res[step.job];
    const left = budgetMs - (now() - t0);
    if (left <= 0) {
      for (const z of step.sizes) r0.unchecked.push({ size: z, variant: "", words: `${r0.name} ${z}` });
      continue;
    }
    const r = checkAgainstStandard(cat, std, j.key, { sizes: step.sizes, extra: j.extra, budgetMs: left, widths: step.first });
    for (const f of ["problems", "warnings", "already", "unchecked"]) r0[f].push(...r[f]);
    r0.buildings += r.buildings;
    r0.ms += r.ms;
  }
  return res;
}

/* The same as checkAgainstStandard for every size, one size at a time,
   waiting on `pause()` (a promise: the next frame, a timeout) between sizes,
   so a page stays usable while a style with many sizes is drawn (the
   Dealer Center's Check every size). The roof-widths test runs once. */
export async function checkInSteps(cat, std, key, { extra = null, pause = null } = {}) {
  const t0 = now();
  const sizes = orderSizes(Object.keys((cat.P && cat.P[key]) || {}));
  let all = null;
  for (let i = 0; i < sizes.length; i++) {
    if (pause) await pause();
    const r = checkAgainstStandard(cat, std, key, { sizes: [sizes[i]], extra, widths: i === 0 });
    if (!all) { all = r; continue; }
    for (const f of ["problems", "warnings", "already", "unchecked"]) all[f].push(...r[f]);
    all.buildings += r.buildings;
  }
  if (!all) all = checkAgainstStandard(cat, std, key, { sizes: [], extra });
  all.ms = now() - t0;
  return all;
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
