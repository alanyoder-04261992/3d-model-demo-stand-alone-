/* THE PRICE LIST'S RULES, without any screen: sorting sizes, grouping
   building styles, keeping the groups and the "opens on" building right,
   saying what changed in words, and turning model/company.js's problems
   into sentences an owner can act on (and the place on the screen each one
   belongs to).

   Everything here works on a copy of the settings (the DRAFT); nothing is
   sent anywhere. model/company.js's validate() is the same check the server
   runs before it saves, so a draft with no problems here saves. */

import { validate } from "../../../../model/company.js";
import { money, size as sizeWords } from "../../words.js";

export const keysOf = (o) => (o && typeof o === "object" && !Array.isArray(o) ? Object.keys(o).filter((k) => !k.startsWith("_")) : []);
export const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
export const priceOf = (v) => (isObj(v) ? v.price : v);
export const ownName = (v) => (isObj(v) && typeof v.name === "string" ? v.name.trim() : "");
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/* Limits the Dealer Center keeps (docs/OFFICE.md "Building styles"). */
export const WIDTH_MIN = 4, WIDTH_MAX = 16, LENGTH_MIN = 4, LENGTH_MAX = 60;
export const COMMON_WIDTHS = [6, 8, 10, 12, 14];
export const PRICE_CAP = 1000000;
export const NAME_MAX = 60;

/* A price as an owner types it: "" -> null (not priced yet), cents kept. */
export function readPrice(raw) {
  const s = String(raw ?? "").trim();
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

/* ---- sizes ------------------------------------------------------------ */

export function sizeParts(z) {
  const m = /^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/.exec(String(z));
  return m ? [Number(m[1]), Number(m[2])] : [0, 0];
}
export function sortSizes(list) {
  return [...list].sort((a, b) => {
    const [aw, al] = sizeParts(a), [bw, bl] = sizeParts(b);
    return aw - bw || al - bl;
  });
}
export function priced(sizes) {
  return keysOf(sizes).map((z) => sizes[z]).filter((p) => typeof p === "number" && p > 0);
}
export function fromPrice(sizes) {
  const list = priced(sizes);
  return list.length ? Math.min(...list) : null;
}
export function missingPrices(sizes) {
  return keysOf(sizes).filter((z) => !(typeof sizes[z] === "number" && sizes[z] > 0)).length;
}

/* ---- building styles ---------------------------------------------------- */

export const baseOf = (key, entry) => (isObj(entry) && entry.base) || key;

/* The name customers see: the owner's own, or the builder's. */
export function styleName(M, key, entry) {
  const own = isObj(entry) && typeof entry.name === "string" && entry.name.trim();
  return own || M.styles?.[baseOf(key, entry)]?.name || "Building";
}
export function libraryCategory(M, key, entry) {
  return M.styles?.[baseOf(key, entry)]?.category || "Buildings";
}
function libraryIndex(M, key, entry) {
  const order = Object.keys(M.styles || {});
  const i = order.indexOf(baseOf(key, entry));
  return (i < 0 ? order.length : i) + (isObj(entry) && entry.base ? 0.5 : 0);
}

/* The groups as the 3D designer shows them: settings.categories when the
   business has them, otherwise the builder's group for each style. */
export function groupsOf(settings, M) {
  if (Array.isArray(settings?.categories)) {
    return settings.categories.filter((g) => Array.isArray(g) && Array.isArray(g[1])).map(([label, ks]) => [label, [...ks]]);
  }
  const out = [];
  for (const k of keysOf(settings?.offer)) {
    const label = libraryCategory(M, k, settings.offer[k]);
    let g = out.find((x) => x[0] === label);
    if (!g) out.push((g = [label, []]));
    g[1].push(k);
  }
  return out;
}

function ensureGroup(cats, label, savedCats) {
  let g = cats.find((c) => c[0] === label);
  if (g) return g;
  g = [label, []];
  const order = (savedCats || []).map((c) => c[0]);
  const want = order.indexOf(label);
  let at = cats.length;
  if (want >= 0) {
    at = 0;
    cats.forEach((c, i) => { const o = order.indexOf(c[0]); if (o >= 0 && o < want) at = i + 1; });
  }
  cats.splice(at, 0, g);
  return g;
}

/* Put one style into the groups: where it was when last saved; a style of
   the business's own right after the style it is built like; otherwise in
   the builder's group for it, in the builder's order. */
export function placeStyle(cats, key, offerAll, savedCats, M) {
  const entry = offerAll[key];
  for (const [label, ks] of savedCats || []) {
    const i = ks.indexOf(key);
    if (i < 0) continue;
    const g = ensureGroup(cats, label, savedCats);
    let at = 0;
    for (let j = i - 1; j >= 0; j--) { const p = g[1].indexOf(ks[j]); if (p >= 0) { at = p + 1; break; } }
    g[1].splice(at, 0, key);
    return;
  }
  if (isObj(entry) && entry.base) {
    for (const g of cats) {
      const p = g[1].indexOf(entry.base);
      if (p < 0) continue;
      let at = p + 1;
      while (at < g[1].length && offerAll[g[1][at]]?.base === entry.base) at++;
      g[1].splice(at, 0, key);
      return;
    }
  }
  const g = ensureGroup(cats, libraryCategory(M, key, entry), savedCats);
  const mine = libraryIndex(M, key, entry);
  let at = g[1].findIndex((k) => libraryIndex(M, k, offerAll[k]) > mine);
  if (at < 0) at = g[1].length;
  g[1].splice(at, 0, key);
}

/* Every sold style listed once, in a group; empty groups dropped. Only when
   the business keeps its own groups (settings.categories). */
export function tidyCategories(draft, saved, M) {
  if (!Array.isArray(draft.categories)) return;
  const offered = keysOf(draft.offer);
  const seen = new Set();
  const cats = draft.categories.filter((g) => Array.isArray(g) && typeof g[0] === "string" && Array.isArray(g[1]))
    .map(([label, ks]) => [label, ks.filter((k) => offered.includes(k) && !seen.has(k) && !!seen.add(k))]);
  const savedCats = groupsOf(saved, M);
  for (const k of offered) if (!seen.has(k)) { placeStyle(cats, k, draft.offer, savedCats, M); seen.add(k); }
  draft.categories = cats.filter((g) => g[1].length);
}

/* The groups the owner's screen shows: the sold styles, plus the ones
   switched off since the last save (in the group they came from). */
export function displayGroups(draft, saved, M, parked) {
  const cats = groupsOf(draft, M);
  const all = { ...parked, ...draft.offer };
  const savedCats = groupsOf(saved, M);
  for (const k of keysOf(parked)) if (!cats.some((g) => g[1].includes(k))) placeStyle(cats, k, all, savedCats, M);
  return cats;
}

/* A code for a style of the business's own: its base and a number, "LB1".
   Never a builder's code, in any letters. */
export function newStyleKey(base, taken, M) {
  const library = Object.keys(M.styles || {}).map((k) => k.toLowerCase());
  const used = new Set([...taken].map((k) => k.toLowerCase()));
  const stem = String(base).replace(/[^A-Za-z0-9]/g, "").slice(0, 5) || "S";
  for (let n = 1; n < 1000; n++) {
    const k = `${stem}${n}`;
    if (k.length <= 8 && !used.has(k.toLowerCase()) && !library.includes(k.toLowerCase())) return k;
  }
  return null;
}

/* Names compared the way a customer reads them. */
export const nameKey = (s) => String(s || "").trim().replace(/\s+/g, " ").toLowerCase();

/* ---- colors ---------------------------------------------------------------- */

export const COLOR_GROUPS = [
  ["paint", "Siding", "Walls on wood buildings."],
  ["trim", "Trim", "Corner boards, door trim and shutters."],
  ["metal", "Roof", "Steel roofs, and the walls of metal buildings."],
];

/* [[name, hex, own?]] the customer can pick, in order. */
export function paletteList(settings, M, g) {
  const lib = M.palettes?.[g] || [];
  const list = settings.palettes?.[g];
  if (!Array.isArray(list)) return lib.map(([n, hex]) => [n, hex, false]);
  return list.map((e) => {
    if (Array.isArray(e)) return [String(e[0]), String(e[1]), !lib.some((c) => c[0] === e[0])];
    const hit = lib.find((c) => c[0] === e) || Object.values(M.palettes || {}).flat().find((c) => Array.isArray(c) && c[0] === e);
    return [String(e), hit ? hit[1] : "#cccccc", false];
  });
}
export const paletteNames = (settings, M, g) => paletteList(settings, M, g).map((c) => c[0]);

/* Write a group's colors back: builder colors by name, the business's own as
   [name, "#hex"]. When the list says the same as the saved one, keep the
   saved way of writing it (so nothing changes for nothing). */
export function setPalette(draft, saved, M, g, list) {
  const lib = M.palettes?.[g] || [];
  const savedNames = paletteList(saved, M, g).map((c) => `${c[0]}|${c[1]}`.toLowerCase());
  const newNames = list.map((c) => `${c[0]}|${c[1]}`.toLowerCase());
  if (same(savedNames, newNames)) {
    if (saved.palettes && Object.prototype.hasOwnProperty.call(saved.palettes, g)) {
      draft.palettes = { ...(draft.palettes || {}), [g]: structuredClone(saved.palettes[g]) };
    } else if (draft.palettes) {
      delete draft.palettes[g];
      if (!keysOf(draft.palettes).length && !(saved.palettes)) delete draft.palettes;
    }
    return;
  }
  draft.palettes = { ...(draft.palettes || {}) };
  draft.palettes[g] = list.map(([name, hex, own]) => (!own && lib.some((c) => c[0] === name && c[1].toLowerCase() === String(hex).toLowerCase()) ? name : [name, hex]));
}

/* ---- the building the 3D designer opens on -------------------------------- */

function pickColor(names, wanted) {
  for (const w of wanted) { const hit = names.find((n) => n.toLowerCase().includes(w)); if (hit) return hit; }
  return names[0];
}

/* The style the designer opens on (as resolve() picks it). */
export function openingStyle(settings) {
  const offered = keysOf(settings.offer);
  const D = isObj(settings.defaults) ? settings.defaults : {};
  return D.style && offered.includes(D.style) ? D.style : offered[0];
}

/* Keep settings.defaults pointing at things still sold. Returns sentences
   saying what moved, for a short message. */
export function tidyDefaults(draft, M, order) {
  const D = draft.defaults;
  const offered = keysOf(draft.offer);
  const notes = [];
  if (!isObj(D) || !offered.length) return notes;
  if (D.style != null && !offered.includes(D.style)) {
    const first = order.find((k) => offered.includes(k)) || offered[0];
    notes.push(`The 3D designer opens on the ${styleName(M, first, draft.offer[first])} now.`);
    D.style = first;
    delete D.size;
  }
  const st = D.style != null ? D.style : offered[0];
  const sizes = sortSizes(keysOf(draft.offer[st]?.sizes));
  if (D.size != null && !sizes.includes(D.size)) {
    if (sizes.length) D.size = sizes[0]; else delete D.size;
  }
  if (isObj(D.colors)) {
    const metal = !!M.styles?.[baseOf(st, draft.offer[st])]?.metal;
    const lists = [["body", metal ? "metal" : "paint", ["white"], metal ? "walls" : "siding"], ["trim", "trim", ["black", "charcoal"], "trim"], ["roof", "metal", ["black", "charcoal"], "roof"]];
    for (const [f, g, wanted, word] of lists) {
      const names = paletteNames(draft, M, g);
      if (D.colors[f] != null && names.length && !names.includes(D.colors[f])) {
        const next = pickColor(names, wanted);
        notes.push(`The 3D designer opens on ${next} ${word} now, because ${D.colors[f]} is off.`);
        D.colors[f] = next;
      }
    }
  }
  if (D.dormer != null && D.dormer !== "none" && !Object.prototype.hasOwnProperty.call(draft.options?.dormers || {}, D.dormer)) {
    D.dormer = keysOf(draft.options?.dormers)[0] || "none";
  }
  return notes;
}

/* ---- your own options ------------------------------------------------------ */

export const EXTRA_KINDS = [
  ["check", "One price", "a flat price"],
  ["qty", "Per item", "each"],
  ["lf", "Per foot", "a foot"],
  ["sqftF", "Per sq ft of floor", "a sq ft of floor"],
  ["sqftW", "Per sq ft of walls", "a sq ft of walls"],
  ["sqftR", "Per sq ft of roof", "a sq ft of roof"],
  ["pct", "Percent of the building", "of the building price"],
];

function slug(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 34).replace(/-+$/, "") || "extra";
}

/* The copy that is checked and saved: each new extra gets its key, made
   from its name, once (afterwards the key never changes). */
export function prepare(draft) {
  const s = structuredClone(draft);
  /* sizes in order, width then length: the 3D designer shows its size
     buttons in this order, so a size added later still lands in its place */
  for (const k of keysOf(s.offer)) {
    const e = s.offer[k];
    if (!isObj(e) || !isObj(e.sizes)) continue;
    const sorted = {};
    for (const z of Object.keys(e.sizes).filter((z) => z.startsWith("_"))) sorted[z] = e.sizes[z];
    for (const z of sortSizes(keysOf(e.sizes))) sorted[z] = e.sizes[z];
    e.sizes = sorted;
  }
  const extras = s.options?.extras;
  if (Array.isArray(extras)) {
    const used = new Set(extras.map((x) => x?.key).filter(Boolean));
    for (const x of extras) {
      if (!isObj(x) || x.key) continue;
      let k = slug(x.name), n = 2;
      while (used.has(k)) k = `${slug(x.name)}-${n++}`;
      x.key = k;
      used.add(k);
    }
  }
  return s;
}

/* ---- what changed, in words ---------------------------------------------------- */

export function describe(before, after, M) {
  const out = [];
  const sName = (s, k) => styleName(M, k, s.offer?.[k]);
  const iName = (s, k) => ownName(s.items?.[k]) || M.items?.[k]?.name || "Door or window";

  const oldStyles = keysOf(before.offer), newStyles = keysOf(after.offer);
  for (const k of newStyles) if (!oldStyles.includes(k)) {
    const n = keysOf(after.offer[k].sizes).length;
    const base = after.offer[k].base ? ` (built like the ${M.styles?.[after.offer[k].base]?.name || "builder's style"})` : "";
    out.push(`Start selling the ${sName(after, k)}${base} in ${n} size${n === 1 ? "" : "s"}`);
  }
  for (const k of oldStyles) if (!newStyles.includes(k)) out.push(`Stop selling the ${sName(before, k)}`);
  for (const k of newStyles) {
    if (!oldStyles.includes(k)) continue;
    const o = before.offer[k], n = after.offer[k];
    if (nameKey(sName(before, k)) !== nameKey(sName(after, k)) || (o.name || "") !== (n.name || "")) {
      if (sName(before, k) !== sName(after, k)) out.push(`The ${sName(before, k)} is now called the ${sName(after, k)}`);
    }
    const name = sName(after, k);
    const os = o.sizes || {}, ns = n.sizes || {};
    for (const z of sortSizes(keysOf(ns))) {
      if (!(z in os)) out.push(`${name}: add ${sizeWords(z)}${ns[z] != null ? ` at ${money(ns[z])}` : ""}`);
      else if (os[z] !== ns[z]) out.push(`${name} ${sizeWords(z)}: ${money(os[z])} → ${ns[z] == null ? "no price yet" : money(ns[z])}`);
    }
    for (const z of sortSizes(keysOf(os))) if (!(z in ns)) out.push(`${name}: remove ${sizeWords(z)}`);
  }

  const oi = before.items || {}, ni = after.items || {};
  for (const k of keysOf(ni)) {
    if (!(k in oi)) out.push(`Start selling the ${iName(after, k)}${priceOf(ni[k]) != null ? ` at ${money(priceOf(ni[k]))}` : ""}`);
    else {
      if (priceOf(oi[k]) !== priceOf(ni[k])) out.push(`${iName(after, k)}: ${money(priceOf(oi[k]))} → ${priceOf(ni[k]) == null ? "no price yet" : money(priceOf(ni[k]))}`);
      if (iName(before, k) !== iName(after, k)) out.push(`The ${iName(before, k)} is now called the ${iName(after, k)}`);
    }
  }
  for (const k of keysOf(oi)) if (!(k in ni)) out.push(`Stop selling the ${iName(before, k)}`);

  for (const g of ["dormers", "ramps", "elec", "misc", "rates"]) {
    const og = before.options?.[g] || {}, ng = after.options?.[g] || {};
    const oName = (s, id) => optionName(M, g, id, s.options?.[g]?.[id]);
    const fmt = (v) => (priceOf(v) == null ? "no price yet" : g === "rates" ? `${money(priceOf(v))} a sq ft` : money(priceOf(v)));
    for (const id of keysOf(ng)) {
      if (!(id in og)) out.push(`Start offering ${oName(after, id)}${priceOf(ng[id]) != null ? ` at ${fmt(ng[id])}` : ""}`);
      else {
        if (priceOf(og[id]) !== priceOf(ng[id])) out.push(`${oName(after, id)}: ${fmt(og[id])} → ${fmt(ng[id])}`);
        if (oName(before, id) !== oName(after, id)) out.push(`${oName(before, id)} is now called ${oName(after, id)}`);
      }
    }
    for (const id of keysOf(og)) if (!(id in ng)) out.push(`Stop offering ${oName(before, id)}`);
  }
  const xb = Array.isArray(before.options?.extras) ? before.options.extras : [];
  const xa = Array.isArray(after.options?.extras) ? after.options.extras : [];
  const label = (x) => (x?.name || "").trim() || "a new option";
  for (const x of xa) {
    const old = x.key ? xb.find((o) => o.key === x.key) : null;
    if (!old) out.push(`Add your option "${label(x)}"${x.price != null ? ` at ${x.input === "pct" ? `${x.price}%` : money(x.price)}` : ""}`);
    else if (!same(old, x)) {
      if (old.price !== x.price) out.push(`${label(x)}: ${x.input === "pct" ? `${old.price}%` : money(old.price)} → ${x.price == null ? "no price yet" : x.input === "pct" ? `${x.price}%` : money(x.price)}`);
      if (old.name !== x.name) out.push(`Your option "${old.name}" is now called "${label(x)}"`);
      if (old.input !== x.input) out.push(`${label(x)} is priced ${EXTRA_KINDS.find((e) => e[0] === x.input)?.[1].toLowerCase() || "another way"} now`);
    }
  }
  for (const x of xb) if (!xa.some((n) => n.key === x.key)) out.push(`Remove your option "${label(x)}"`);

  for (const [g, word] of COLOR_GROUPS) {
    const oldList = paletteNames(before, M, g), newList = paletteNames(after, M, g);
    const added = newList.filter((c) => !oldList.includes(c)), removed = oldList.filter((c) => !newList.includes(c));
    if (added.length) out.push(`${word} colors: add ${added.join(", ")}`);
    if (removed.length) out.push(`${word} colors: take off ${removed.join(", ")}`);
  }

  const od = before.defaults || {}, nd = after.defaults || {};
  if ((od.style || "") !== (nd.style || "") || (od.size || "") !== (nd.size || "")) {
    const st = openingStyle(after);
    if (st) out.push(`The 3D designer opens on the ${nd.size ? sizeWords(nd.size) + " " : ""}${styleName(M, st, after.offer[st])}`);
  }
  if (!same(od.colors, nd.colors)) out.push("Change the colors the 3D designer opens on");

  if (!out.length && !same(stripCats(before), stripCats(after))) out.push("Tidy the price list");
  return [...new Set(out)];
}
const stripCats = (s) => ({ ...s, categories: null, defaults: { ...(s.defaults || {}), dormer: null } });

export function optionName(M, g, id, value) {
  const own = ownName(value);
  if (own) return own;
  const def = M.options?.[g]?.[id];
  if (g === "elec") return `Electrical package ${String(def?.name || id).replace(/^Option /, "")}`;
  return def?.name || "Option";
}

/* ---- problems: model/company.js's sentences, in the owner's words, and where they go ---- */

/* Each problem -> {words, tab, where, field, style?}. where is the box the
   sentence shows in; field is the input that turns red. */
export function explain(problem, draft, M) {
  const S = draft;
  const sName = (k) => styleName(M, k, S.offer?.[k]);
  const iName = (k) => ownName(S.items?.[k]) || M.items?.[k]?.name || "door or window";
  const z = (quoted) => { try { return sizeWords(JSON.parse(quoted)); } catch { return "One size"; } };
  const raw = (quoted) => { try { return JSON.parse(quoted); } catch { return ""; } };
  const xName = (i) => (S.options?.extras?.[Number(i)]?.name || "").trim() || "This option";
  const colorWord = { paint: "siding", trim: "trim", metal: "roof" };
  const rules = [
    [/^offer is empty/, () => ({ words: "Sell at least one building style. Switch one back on, or add one.", tab: "buildings", where: "buildings" })],
    [/^offer\.(\w+) is built like the .+?, so it needs a name/, (m) => ({ words: "Give this style a name customers will see.", tab: "buildings", where: `style:${m[1]}`, field: `name:${m[1]}`, style: m[1] })],
    [/^offer\.(\w+)\.name must be text/, (m) => ({ words: "Give this style a name customers will see.", tab: "buildings", where: `style:${m[1]}`, field: `name:${m[1]}`, style: m[1] })],
    [/^offer\.(\w+)\.name .* is too long/, (m) => ({ words: `Use a shorter name: ${NAME_MAX} letters at most.`, tab: "buildings", where: `style:${m[1]}`, field: `name:${m[1]}`, style: m[1] })],
    [/^offer\.(\w+)\.sizes: no sizes/, (m) => ({ words: `The ${sName(m[1])} has no sizes. Add a size, or switch it to Not sold.`, tab: "buildings", where: `style:${m[1]}`, field: `newsize:${m[1]}`, style: m[1] })],
    [/^offer\.(\w+)\.sizes\[(.+?)\]: a size must be written/, (m) => ({ words: `${z(m[2])} isn't a size. Remove it and add it again.`, tab: "buildings", where: `style:${m[1]}`, field: `size:${m[1]}:${raw(m[2])}`, style: m[1] })],
    [/^offer\.(\w+)\.sizes\[(.+?)\] has no price/, (m) => ({ words: `${z(m[2])} needs a price.`, tab: "buildings", where: `style:${m[1]}`, field: `size:${m[1]}:${raw(m[2])}`, style: m[1], missing: true })],
    [/^offer\.(\w+)\.sizes\[(.+?)\]: the price must be more than 0/, (m) => ({ words: `${z(m[2])} needs a price above $0. To stop selling a size, remove it.`, tab: "buildings", where: `style:${m[1]}`, field: `size:${m[1]}:${raw(m[2])}`, style: m[1], missing: true })],
    [/^offer\.(\w+)\.sizes\[(.+?)\]: the price must be/, (m) => ({ words: `${z(m[2])}: type the price in dollars.`, tab: "buildings", where: `style:${m[1]}`, field: `size:${m[1]}:${raw(m[2])}`, style: m[1], missing: true })],
    [/^offer\.(\w+) is called "(.+?)", the same name as offer\.(\w+)/, (m) => ({ words: `The ${m[2]} is already a building you sell. Give each style its own name.`, tab: "buildings", where: `style:${m[1]}`, field: `name:${m[1]}`, style: m[1] })],

    [/^items\.(\w+) needs a price: the .+? \([A-Za-z0-9_-]+\) comes as standard on the (.+?)\. 0 is fine/, (m) => ({ words: `It comes with the ${withoutCodes(m[2])}, so it needs a price. $0 is fine.`, tab: "doors", where: `item:${m[1]}`, field: `item:${m[1]}` })],
    [/^items\.(\w+) has no price/, (m) => ({ words: `The ${iName(m[1])} needs a price. $0 is fine.`, tab: "doors", where: `item:${m[1]}`, field: `item:${m[1]}` })],
    [/^items\.(\w+): the price must be/, (m) => ({ words: `The ${iName(m[1])}: type the price in dollars, $0 or more.`, tab: "doors", where: `item:${m[1]}`, field: `item:${m[1]}` })],
    [/^items\.(\w+)\.name must be text/, (m) => ({ words: "Give it a name customers will see.", tab: "doors", where: `item:${m[1]}`, field: `item:${m[1]}` })],
    [/^An electrical package places an? (.+?), so items\.(\w+) needs a price/, (m) => ({ words: `Your electrical packages put in the ${iName(m[2])}, so sell it here. $0 is fine.`, tab: "doors", where: `item:${m[2]}`, field: `item:${m[2]}` })],
    [/^options\.misc\.ext \(the exterior light\)/, () => ({ words: `The exterior light option puts up the ${iName("light")}, so sell it here. $0 is fine.`, tab: "doors", where: "item:light", field: "item:light" })],

    [/^(.+?) (?:is|are) offered, so options\.dormers needs at least one dormer/, (m) => ({ words: `You sell the ${withoutCodes(m[1])}, so sell at least one dormer size.`, tab: "options", where: "opts:dormers" })],
    [/^options\.extras\[(\d+)\]\.key .* is used twice/, (m) => ({ words: "Two of your options have the same name. Remove one.", tab: "options", where: `extra:${m[1]}`, field: `extra:${m[1]}:name` })],
    [/^options\.extras\[(\d+)\]\.name is missing/, (m) => ({ words: "Give this option a name.", tab: "options", where: `extra:${m[1]}`, field: `extra:${m[1]}:name` })],
    [/^options\.extras\[(\d+)\]\.input/, (m) => ({ words: `Pick how ${xName(m[1])} is priced.`, tab: "options", where: `extra:${m[1]}`, field: `extra:${m[1]}:input` })],
    [/^options\.extras\[(\d+)\]\.price/, (m) => ({ words: `${xName(m[1])} needs a price, $0 or more.`, tab: "options", where: `extra:${m[1]}`, field: `extra:${m[1]}:price` })],
    [/^options\.(\w+)\.([^:\s.]+)\.name .*too long/, (m) => ({ words: `Use a shorter name: ${NAME_MAX} letters at most.`, tab: "options", where: `opt:${m[1]}:${m[2]}`, field: `opt:${m[1]}:${m[2]}` })],
    [/^options\.(\w+)\.([^:\s.]+)\.name must be text/, (m) => ({ words: "Give it a name customers will see.", tab: "options", where: `opt:${m[1]}:${m[2]}`, field: `opt:${m[1]}:${m[2]}` })],
    [/^options\.(\w+)\.([^:\s.]+) has no price/, (m) => ({ words: `${optionName(M, m[1], m[2], S.options?.[m[1]]?.[m[2]])} needs a price. $0 is fine.`, tab: "options", where: `opt:${m[1]}:${m[2]}`, field: `opt:${m[1]}:${m[2]}` })],
    [/^options\.(\w+)\.([^:\s.]+): the price must be/, (m) => ({ words: `${optionName(M, m[1], m[2], S.options?.[m[1]]?.[m[2]])}: type the price in dollars, $0 or more.`, tab: "options", where: `opt:${m[1]}:${m[2]}`, field: `opt:${m[1]}:${m[2]}` })],

    [/^palettes\.(\w+) must be a list/, (m) => ({ words: `Keep at least one ${colorWord[m[1]] || ""} color on.`, tab: "colors", where: `colors:${m[1]}` })],
    [/^palettes\.(\w+) lists "(.+?)" twice/, (m) => ({ words: `${m[2]} is on the ${colorWord[m[1]] || ""} list twice. Remove one.`, tab: "colors", where: `colors:${m[1]}` })],
    [/^palettes\.(\w+)/, (m) => ({ words: `One of the ${colorWord[m[1]] || ""} colors can't be read. Remove it and add it again.`, tab: "colors", where: `colors:${m[1]}` })],
  ];
  for (const [re, say] of rules) {
    const m = re.exec(problem);
    if (m) return say(m);
  }
  return { words: "Part of the price list can't be saved as it is. Undo your changes, or reload the page and try again.", tab: "buildings", where: "buildings" };
}
const withoutCodes = (names) => names.replace(/ \([A-Za-z0-9_-]+\)/g, "").replace(/, ([^,]+)$/, " and $1");

/* Checks the Dealer Center adds on top of model/company.js (the same as
   server/office/price-list.js officeProblems), in the same shape. */
function officeChecks(draft, M) {
  const out = [];
  for (const k of keysOf(draft.offer)) {
    for (const z of keysOf(draft.offer[k]?.sizes)) {
      const [w, l] = sizeParts(z);
      if (!Number.isInteger(w) || !Number.isInteger(l) || w < WIDTH_MIN || w > WIDTH_MAX || l < LENGTH_MIN || l > LENGTH_MAX) {
        out.push({ words: `${sizeWords(z)} can't be sold: widths are 4 to 16 ft and lengths 4 to 60 ft, in whole feet. Remove it.`, tab: "buildings", where: `style:${k}`, field: `size:${k}:${z}`, style: k });
      }
      if (draft.offer[k].sizes[z] > PRICE_CAP) out.push({ words: `${sizeWords(z)} costs more than $1,000,000. Check that price.`, tab: "buildings", where: `style:${k}`, field: `size:${k}:${z}`, style: k });
    }
  }
  for (const k of keysOf(draft.items)) if (priceOf(draft.items[k]) > PRICE_CAP) out.push({ words: "That costs more than $1,000,000. Check the price.", tab: "doors", where: `item:${k}`, field: `item:${k}` });
  for (const g of ["dormers", "ramps", "elec", "misc", "rates"]) {
    for (const id of keysOf(draft.options?.[g])) if (priceOf(draft.options[g][id]) > PRICE_CAP) out.push({ words: "That costs more than $1,000,000. Check the price.", tab: "options", where: `opt:${g}:${id}`, field: `opt:${g}:${id}` });
  }
  (Array.isArray(draft.options?.extras) ? draft.options.extras : []).forEach((x, i) => {
    if (x?.price > PRICE_CAP) out.push({ words: "That costs more than $1,000,000. Check the price.", tab: "options", where: `extra:${i}`, field: `extra:${i}:price` });
    if (x?.input === "pct" && x?.price > 100) out.push({ words: "A percent of the building can be 100% at most.", tab: "options", where: `extra:${i}`, field: `extra:${i}:price` });
  });
  return out;
}

/* Every problem with the draft, in words, each with its place. */
export function problemsOf(prepared, M) {
  const list = validate(prepared, M).map((p) => explain(p, prepared, M)).concat(officeChecks(prepared, M));
  const seen = new Set();
  return list.filter((p) => { const k = `${p.where}|${p.field || ""}|${p.words}`; if (seen.has(k)) return false; seen.add(k); return true; });
}

/* Doors, windows and fixtures that cannot be switched off: standard on a
   sold style, or put in by a sold option. {itemId: {styles: [keys], elec, ext}} */
export function lockedItems(prepared, M) {
  const copy = { ...prepared, items: {} };
  const locks = {};
  const offered = keysOf(prepared.offer);
  for (const p of validate(copy, M)) {
    let m = /^items\.(\w+) needs a price: the .+? \([A-Za-z0-9_-]+\) comes as standard on the (.+)\. 0 is fine/.exec(p);
    if (m) {
      const styles = [...m[2].matchAll(/\(([A-Za-z0-9]+)\)/g)].map((x) => x[1]).filter((k) => offered.includes(k));
      (locks[m[1]] = locks[m[1]] || {}).styles = styles;
      continue;
    }
    m = /^An electrical package places an? .+?, so items\.(\w+) needs a price/.exec(p);
    if (m) { (locks[m[1]] = locks[m[1]] || {}).elec = true; continue; }
    if (/^options\.misc\.ext/.test(p)) (locks.light = locks.light || {}).ext = true;
  }
  return locks;
}
