/* Data twins of the builder's named layouts. Keep item order and arithmetic:
   the twins are editable without changing any existing customer's building. */
const entry = (cat, wall, at, rest) => Object.assign({ cat, wall }, at === undefined ? {} : { at }, rest || {});
const side = () => [entry("w72", "R", "center"), entry("w23", "R", { sym: "q+1.4" })];
const garage = () => [entry("ru8", "F", "center"), entry("d36in", "R", { pos: "q+1.6" }), entry("w23", "R", { pos: "-q-1.6" })];
const cottage = () => [
  entry("w48", "R", { fromStart: "0.9" }, { when: { maxL: 13.9999 } }),
  entry("w72", "R", { fromStart: "0.9" }, { when: { minL: 14 } }),
  entry("w23", "R", { pos: "(0.9+(L>=14 ? CAT.w72.w : CAT.w48.w))/2" }, { dbl: true }),
];
const frontCabin = () => [entry("d36lite", "F", "center"), entry("w23", "R", "center"),
  entry("ppost", "F", { sym: "CAT.d36lite.w/2+0.2+CAT.ppost.w/2" }),
  entry("w23", "F", { sym: "(CAT.d36lite.w/2+0.2+CAT.ppost.w+W/2-0.45)/2" }, { when: { minW: 10 } })];
const wrapCabin = () => [entry("d36lite", "P3", { pos: "0.45" }), entry("w23", "P1", "center"), entry("w23", "P2", "center"),
  entry("w23", "F", { pos: "-(W/2-2)" }), entry("w23", "R", { pos: "6" }), entry("ppost", "F", { sym: "W/6" }),
  entry("ppost", "R", { pos: "6-L/2" }), entry("ppost", "R", { pos: "10-L/2" })];
const sideCabin = () => [entry("d36lite", "S1", { pos: "P>=12 ? 0 : 1.4" }),
  entry("w23", "S1", { pos: "P>=12 ? -(P/2-1.9) : -1.7" }),
  entry("w23", "S1", { pos: "P/2-1.9" }, { when: { minP: 12 } }),
  entry("w23", "R", { pos: "P/2" }, { when: { porch: "front" } }),
  entry("w23", "R", { pos: "-P/2" }, { when: { porch: "back" } }),
  entry("w23", "R", { pos: "P/2+2.7" }, { when: { porch: "middle" } }),
  entry("w23", "R", { pos: "-(P/2+2.7)" }, { when: { porch: "middle" } }),
  entry("w23", "F", { pos: "-pd/2" }, { when: { porch: ["front", "middle"] } }),
  entry("w23", "B", { pos: "pd/2" }, { when: { porch: ["back", "middle"] } }),
  entry("ppost", "R", { porchDoor: 2.2 }), entry("ppost", "R", { porchDoor: -2.2 })];
const twins = {
  UT: [entry("w72", "F", "center")], MU: [entry("w72", "F", "center")], SU: side(), DS: side(), SLB: side(),
  BU: [entry("w48", "R", "center"), entry("w23", "R", { sym: "q+0.7" }, { when: { minL: 9.821 } })],
  GU: [entry("w48", "F", "center")], SB: [entry("w48", "F", "center")],
  LB: [entry("w72", "F", "center"), entry("fake", "F", "center")], MLB: [entry("w72", "F", "center")],
  CS: cottage(), MCS: cottage(),
  SS: [entry("d36lite", "R", "center"), entry("w23", "R", { sym: "min(q+1.6,L/2-2.4)" }),
    entry("tr", "R", "center", { repeat: { count: "L<12 ? 2 : 3+floor((L-12)/4)", spread: "min(L-3.5,L*0.74)" } })],
  C: frontCabin(), LBC: frontCabin().concat(entry("oct", "F", "center")),
  DSC: wrapCabin(), SLC: wrapCabin().concat(entry("fake", "F", "center")),
  SC: sideCabin(), LSC: sideCabin().concat([
    entry("fake", "F", "center", { when: { porch: ["front", "middle"] } }),
    entry("fake", "B", "center", { when: { porch: "back" } }),
  ]),
  G: garage(), MG: garage(), LBG: garage().concat(entry("fake", "F", "center")),
  DK: [entry("w48", "B", "center"), entry("w23", "R", { pos: "q" }), entry("w23", "L", { pos: "-q" })],
};
function freeze(v) { if (v && typeof v === "object") { Object.values(v).forEach(freeze); Object.freeze(v); } return v; }
export const LOADOUT_TWINS = freeze(twins);
const clone = (v) => JSON.parse(JSON.stringify(v));
export function loadoutTwin(key) { return twins[String(key).replace(/^barnwright:/, "")] ? clone(twins[String(key).replace(/^barnwright:/, "")]) : null; }
export function builderRecipe(cat, key) {
  const t = cat.TYPES[key];
  if (!t) throw new Error("Pick a building from your price list.");
  const original = t.builderLoadout !== undefined ? t.builderLoadout : t.loadout;
  if (Array.isArray(original)) return clone(original);
  const twin = loadoutTwin(original || t.base || key);
  if (!twin) throw new Error(`The ${t.name}'s builder layout could not be read.`);
  return twin;
}
function canonical(v) {
  if (v && typeof v === "object") {
    if (Array.isArray(v)) return v.map(canonical);
    return Object.fromEntries(Object.keys(v).sort().map((k) => [k, canonical(v[k])]));
  }
  return typeof v === "string" ? v.replace(/\s+/g, "") : v;
}
function signature(e) { return JSON.stringify(canonical(Object.assign({ at: "center" }, e))); }
export function builderLoadout(t) {
  const source = t && (t.builderLoadout !== undefined ? t.builderLoadout : t.loadout);
  return Array.isArray(source) ? clone(source) : loadoutTwin(source || (t && t.base));
}
/* A surviving repeat occurrence keeps the source's original position formula
   and exists only where that occurrence originally existed. The language
   already supports a repeat count of zero; no private layout fields are saved. */
export function splitRepeatedEntry(source, occurrence, baseIndex = 0) {
  const e = clone(source), count = String(source.repeat.count), spread = String(source.repeat.spread || 0);
  const offset = `(-(${spread})/2+${occurrence}*((${spread})/((${count})-1)))`;
  const at = source.at == null ? "center" : source.at;
  let base = "0";
  if (at && typeof at === "object") {
    if (at.pos !== undefined) base = String(at.pos);
    else if (at.sym !== undefined) base = baseIndex === 0 ? `-(${at.sym})` : String(at.sym);
    else if (at.fromStart !== undefined || at.fromEnd !== undefined) {
      const width = source.dbl ? `(2*CAT.${source.cat}.w+CASING)` : `CAT.${source.cat}.w`;
      base = at.fromStart !== undefined ? `-len/2+(${at.fromStart})+${width}/2` : `len/2-(${at.fromEnd})-${width}/2`;
    } else throw new Error("A repeated porch anchor cannot be split into separate items.");
  }
  e.at = { pos: `(${count})<=1 ? (${base}) : (${base})+${offset}` };
  e.repeat = { count: `(${count})>${occurrence} ? 1 : 0` };
  return e;
}

/* Consume source occurrences so a copied builder formula is only included
   once. Split pairs and repeated rows keep their original source identity. */
export function builderEntrySources(recipe, t) {
  const twin = builderLoadout(t), matches = new Map();
  if (!twin) return matches;
  const available = twin.map((entry, sourceIndex) => ({ entry, sourceIndex, left: false, right: false, whole: false, repeatParts: new Set() }));
  recipe.forEach((e, index) => {
    if (!e || typeof e !== "object" || e.ifFits) return;
    for (const candidate of available) {
      if (candidate.whole) continue;
      const b = candidate.entry;
      if (e.cat !== b.cat || e.wall !== b.wall) continue;
      if (!candidate.left && !candidate.right && !candidate.repeatParts.size && signature(e) === signature(b)) {
        candidate.whole = true; matches.set(index, { sourceIndex: candidate.sourceIndex }); return;
      }
      if (b.repeat) {
        const bases = b.at && b.at.sym !== undefined ? 2 : 1;
        for (let baseIndex = 0; baseIndex < bases; baseIndex++) for (let occurrence = 0; occurrence < 100; occurrence++) {
          const partKey = `${baseIndex}:${occurrence}`;
          if (candidate.repeatParts.has(partKey)) continue;
          let part; try { part = splitRepeatedEntry(b, occurrence, baseIndex); } catch { break; }
          if (signature(e) === signature(part)) {
            candidate.repeatParts.add(partKey); matches.set(index, { sourceIndex: candidate.sourceIndex, repeatBase: baseIndex, repeatOccurrence: occurrence }); return;
          }
        }
      } else if (b.at && b.at.sym !== undefined) {
        for (const [half, pos, occurrence] of [["left", `-(${b.at.sym})`, 0], ["right", b.at.sym, 1]]) {
          if (!candidate[half] && signature(e) === signature(Object.assign({}, b, { at: { pos } }))) {
            candidate[half] = true; matches.set(index, { sourceIndex: candidate.sourceIndex, sourceOccurrence: occurrence }); return;
          }
        }
      }
    }
  });
  return matches;
}
export function isBuilderEntry(e, t) { return builderEntrySources([e], t).has(0); }
export function builderEntryIndices(recipe, t) { return new Set(builderEntrySources(recipe, t).keys()); }
