/* Infer an owner's standard layout from the live items. Plain data only;
   default entries keep their exact builder formulas and conditional sizes. */
import { itemW } from "./item-placement.js";
import { evalDataRecipe, evalFormula, recipeEntries, standardPostBounds, layoutVariants } from "./loadouts.js";
import { loadoutTwin, splitRepeatedEntry } from "./loadout-twins.js";
import { porchDepthOf, dims, pSpan, wallDefs } from "./frame.js";
import { CASING } from "../engine/constants.js";
const clone = (v) => JSON.parse(JSON.stringify(v));
const CENTER = 1 / 192, PAIR = 1 / 24;
function number(n, places = 4) { const v = Math.round(n * 10 ** places) / 10 ** places; return String(Object.is(v, -0) ? 0 : v); }
function inch(n) { return number(Math.round(n * 12) / 12, 6); }
function sixteenth(n) { return number(Math.round(n * 192) / 192, 6); }
const ruleOf = (rules, id) => rules instanceof Map ? rules.get(id) : rules && rules[id];
function same(a, b, CAT) { return a.cat === b.cat && a.wall === b.wall && !!a.dbl === !!b.dbl && Math.abs(a.pos - b.pos) <= CENTER && itemW(a, CAT) === itemW(b, CAT); }
function context(frame) { return { t: frame.t, CAT: frame.CAT, span: frame.span, ws: frame.ws, porchDepth: porchDepthOf(frame.t), frame }; }
function originalRecipe(frame, options) {
  if (options.originalRecipe) return clone(options.originalRecipe);
  if (Array.isArray(frame.t.loadout)) return clone(frame.t.loadout);
  return loadoutTwin(frame.t.loadout || frame.t.base || frame.style) || [];
}
function sourceItems(recipe, frame, options) {
  if (options.originalItems) return options.originalItems;
  const t = Object.assign({}, frame.t, { loadout: recipe, builderLoadout: frame.t.builderLoadout !== undefined ? frame.t.builderLoadout : frame.t.loadout });
  return evalDataRecipe(recipe, frame.W, frame.L, Object.assign(context(frame), { t, frame: Object.assign({}, frame, { t }) }));
}
function inferredAt(it, frame) {
  const c = frame.CAT[it.cat], len = frame.ws[it.wall].len;
  if (c.k === "post") {
    const bounds = standardPostBounds(it.wall, frame);
    const edge = bounds && (Math.abs(it.pos - bounds.lo) <= 1 / 12 ? bounds.lo : Math.abs(it.pos - bounds.hi) <= 1 / 12 ? bounds.hi : null);
    const pos = edge == null ? it.pos : edge;
    if (frame.t.porch === "S") {
      const sp = frame.span, distance = sp.f ? -pos - sp.z0 : sp.z1 + pos;
      return { porchStart: +(edge == null ? sixteenth(distance) : number(distance, 8)) };
    }
    if (frame.t.porch === "C" && it.wall === "R") return { pos: `${edge == null ? sixteenth(pos + frame.L / 2) : number(pos + frame.L / 2, 8)}-L/2` };
    return { pos: edge == null ? sixteenth(pos) : number(pos, 8) };
  }
  if (Math.abs(it.pos) <= CENTER) return "center";
  if (!c.gable) {
    const left = it.pos - itemW(it, frame.CAT) / 2 + len / 2;
    const right = len / 2 - it.pos - itemW(it, frame.CAT) / 2;
    /* A Move tap off the middle always stays a share, even on a short wall. */
    if (Math.abs(it.pos) >= 0.5 && Math.min(left, right) <= 3 && Math.min(left, right) >= -CENTER) return left <= right ? { fromStart: inch(left) } : { fromEnd: inch(right) };
  }
  return { pos: `len*${number(it.pos / len)}` };
}
function madeEntry(it, frame, rule) {
  const e = { cat: it.cat, wall: it.wall, at: rule && rule.at !== undefined ? clone(rule.at) : inferredAt(it, frame) };
  if (it.dbl) e.dbl = true;
  if (rule && rule.when && Object.keys(rule.when).length) e.when = clone(rule.when);
  if (frame.CAT[it.cat].k === "win" && !frame.CAT[it.cat].gable) e.ifFits = true;
  return e;
}
function splitEntry(source, occurrence) {
  const e = clone(source);
  if (e.at && e.at.sym !== undefined) e.at = { pos: occurrence === 0 ? `-(${e.at.sym})` : e.at.sym };
  else if (e.repeat) return splitRepeatedEntry(source, occurrence);
  return e;
}
function repeatCount(entry, frame) {
  return evalFormula(entry.repeat.count, { W: frame.W, L: frame.L, P: frame.span.P, pd: porchDepthOf(frame.t), q: frame.L / 4, len: frame.ws[entry.wall].len, CAT: frame.CAT, CASING });
}
function largestRepeatCount(entry, frame, sizes) {
  let largest = repeatCount(entry, frame);
  for (const size of sizes || []) for (const variant of layoutVariants(frame.t, size)) {
    const d = dims(size, frame.t), span = pSpan(variant, d, frame.t), ws = wallDefs(frame.t, d, span, frame.construction);
    const other = { ...frame, W: d.W, L: d.L, d, span, ws };
    largest = Math.max(largest, repeatCount(entry, other));
  }
  return largest;
}
function priority(e, CAT) { const c = CAT[e.cat]; return c.k === "post" ? 4 : c.gable ? 3 : c.k === "win" ? 2 : 1; }
/** options.originalRecipe/originalItems are the editor's current snapshot.
 * options.rules is a Map or object: item id -> {at,when}. Item entry identity
 * from evalDataRecipe survives resizing without leaking into saved designs.
 * options.touched is an optional Set for pairing an unchanged source item
 * with a newly added mirror; it marks intent without forcing an anchor. */
export function inferRecipe(items, frame, options = {}) {
  const source = originalRecipe(frame, options), originals = sourceItems(source, frame, options), ctx = context(frame);
  const raw = recipeEntries(source, frame.W, frame.L, ctx);
  const originalGroups = source.map(() => []);
  originals.forEach((it, n) => {
    const meta = it.entryIndex !== undefined ? it.entryIndex : it._layoutEntry;
    const ri = meta !== undefined ? meta : raw[n] && raw[n].entryIndex;
    if (ri !== undefined && originalGroups[ri]) originalGroups[ri].push({ item: it, occurrence: it._layoutOccurrence !== undefined ? it._layoutOccurrence : raw[n] && raw[n]._layoutOccurrence || 0 });
  });
  const used = new Set(), preserved = [], changed = [];
  source.forEach((e, index) => {
    const group = originalGroups[index];
    if (!group.length) { preserved.push(clone(e)); return; }
    const matches = group.map(({ item: original, occurrence }) => {
      const byId = items.find((it) => it.id === original.id && !used.has(it));
      const live = byId || items.find((it) => !used.has(it) && same(it, original, frame.CAT));
      if (live) used.add(live);
      return { live, original, occurrence, untouched: live && !ruleOf(options.rules, live.id) && !(options.touched && options.touched.has(live.id)) && same(live, original, frame.CAT) };
    });
    if (matches.every((x) => x.untouched)) { preserved.push(clone(e)); return; }
    if (e.repeat) {
      const count = repeatCount(e, frame), largest = largestRepeatCount(e, frame, options.sizes), bases = e.at && e.at.sym !== undefined ? 2 : 1;
      for (let baseIndex = 0; baseIndex < bases; baseIndex++) for (let occurrence = 0; occurrence < largest; occurrence++) {
        const sourceOccurrence = baseIndex * count + occurrence;
        const match = occurrence < count ? matches.find((part) => part.occurrence === sourceOccurrence) : null;
        /* An occurrence absent on the size shown still belongs to larger
           sold sizes. Only an item the owner actually removed is removed. */
        if (!match || match.untouched) {
          if (match || !group.some((part) => part.occurrence === sourceOccurrence)) preserved.push(splitRepeatedEntry(e, occurrence, baseIndex));
        } else if (match.live) changed.push({ item: match.live, rule: ruleOf(options.rules, match.live.id) });
      }
      return;
    }
    for (const match of matches) {
      if (!match.live) continue;
      if (match.untouched) preserved.push(splitEntry(e, match.occurrence));
      else changed.push({ item: match.live, rule: ruleOf(options.rules, match.live.id) });
    }
  });
  for (const item of items) if (!used.has(item)) changed.push({ item, rule: ruleOf(options.rules, item.id) });
  const entries = [], paired = new Set();
  changed.forEach(({ item: it, rule }, i) => {
    if (paired.has(i)) return;
    const c = frame.CAT[it.cat], len = frame.ws[it.wall].len;
    if (!rule && c.k !== "post" && !c.gable && Math.abs(it.pos) > CENTER) {
      const pi = changed.findIndex(({ item: other, rule: otherRule }, j) => j > i && !paired.has(j) && !otherRule && other.cat === it.cat && other.wall === it.wall && !!other.dbl === !!it.dbl && Math.abs(other.pos + it.pos) <= PAIR);
      if (pi >= 0) {
        const gap = len / 2 - Math.abs(it.pos) - itemW(it, frame.CAT) / 2;
        const e = madeEntry(it, frame);
        e.at = { sym: gap <= 3 && gap >= -CENTER ? `len/2-${inch(gap)}-${it.dbl ? `(2*CAT.${it.cat}.w+CASING)` : `CAT.${it.cat}.w`}/2` : `len*${number(Math.abs(it.pos) / len)}` };
        entries.push(e); paired.add(pi); return;
      }
    }
    entries.push(madeEntry(it, frame, rule));
  });
  entries.sort((a, b) => priority(a, frame.CAT) - priority(b, frame.CAT));
  return preserved.concat(entries);
}
function distance(value) {
  const total = Math.round(+value * 12), ft = Math.floor(total / 12), inches = total - ft * 12;
  return ft ? `${ft} ft${inches ? ` ${inches} in` : ""}` : `${inches} in`;
}
export function ruleWords(entry, frame) {
  const at = entry.at === undefined ? "center" : entry.at;
  if (at === "center") return "In the middle";
  if (at.fromStart !== undefined) return `${distance(at.fromStart)} from the left end`;
  if (at.fromEnd !== undefined) return `${distance(at.fromEnd)} from the right end`;
  if (at.porchStart !== undefined) return `${distance(at.porchStart)} from the ${frame && frame.span.f ? "back" : "front"} of the porch`;
  if (at.porchDoor !== undefined) return `${distance(Math.abs(at.porchDoor))} from the porch door`;
  if (at.sym !== undefined) return "A matched pair stays matched";
  if (at.pos !== undefined && /^-?\d+(\.\d+)?$/.test(String(at.pos))) return `${distance(Math.abs(at.pos))} ${+at.pos < 0 ? "left" : "right"} of the middle`;
  if (at.pos !== undefined && /^len\*/.test(String(at.pos))) return "The same share of the wall on every size";
  return "Where the builder puts it";
}
