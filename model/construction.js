/* HOW THIS PARTICULAR BUILDING IS REALLY BUILT. Node-safe, pure, no I/O.

   library/construction.json holds the default real-life construction numbers
   (joist size and spacing, studs, headers, trusses, skids...). A manufacturer
   file can change any of them, then a company can, then the options the
   customer picks can (12 in joists, a double floor). This file merges those
   layers in that order -- later wins -- and then settles every RULE LIST for
   one building.

   A rule list is how a number can depend on the building:
     [{ "when": {"maxW": 8}, "value": "2x4" }, { "value": "2x6" }]
   The first rule whose "when" matches wins. "when" may test:
     minW maxW minL maxL   the building's width / length in feet
     styles                a list of style keys ("UT", "LB", ...); a company's own
                           style built like another is tested as its base
     roof                  a roof shape, or a list of them
     metal                 true for a metal building, false for a painted one
   and, for rules that are about ONE OPENING rather than the building (the
   header size), minSpanFt / maxSpanFt. Those lists are left as lists when the
   building is settled; a part picks from them per opening with pickRule().

   Keys that start with "_" (the "_help" notes in the JSON files) are notes for
   people and are dropped here.

   Main entry points:
     mergeConstruction(a, b, c...)            deep merge, later wins
     effectsToTree({"floor.spacingIn": 12})   an option's effect as a tree
     resolveConstruction(tree, facts)         settle the rule lists for one building
     constructionFor(cat, state, t, d)        the whole thing for a live design
     doorHeightFt / windowTopFt               the two opening-height shop rules */

import { STAGES, STAGE_ID } from "../parts/stages.js";
import { lengthOf } from "./roof-shapes.js";

export const BUILDING_WHEN = ["minW", "maxW", "minL", "maxL", "styles", "roof", "metal"];
export const OPENING_WHEN = ["minSpanFt", "maxSpanFt"];

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/* A rule list: a non-empty array of {when?, value} objects. */
export function isRuleList(v) {
  return Array.isArray(v) && v.length > 0 && v.every((r) =>
    isPlainObject(r) && Object.prototype.hasOwnProperty.call(r, "value") &&
    Object.keys(r).every((k) => k === "when" || k === "value" || k.startsWith("_")));
}

/* Does one rule's "when" match these facts?  Throws, in plain words, on a test
   it does not know, so a typo in a settings file is caught rather than ignored. */
export function ruleMatches(when, facts) {
  if (when == null) return true;
  if (!isPlainObject(when)) throw new Error("A rule's \"when\" must be an object of tests, like {\"maxW\": 8}.");
  for (const k of Object.keys(when)) {
    if (k.startsWith("_")) continue;
    const v = when[k];
    switch (k) {
      case "minW": if (!(facts.W >= v)) return false; break;
      case "maxW": if (!(facts.W <= v)) return false; break;
      case "minL": if (!(facts.L >= v)) return false; break;
      case "maxL": if (!(facts.L <= v)) return false; break;
      case "styles": if (!Array.isArray(v) || v.indexOf(facts.style) < 0) return false; break;
      case "roof": if (Array.isArray(v) ? v.indexOf(facts.roof) < 0 : v !== facts.roof) return false; break;
      case "metal": if (!!facts.metal !== !!v) return false; break;
      case "minSpanFt": if (!(facts.spanFt >= v)) return false; break;
      case "maxSpanFt": if (!(facts.spanFt <= v)) return false; break;
      default:
        throw new Error(`A construction rule tests "${k}", which is not something a rule can test. ` +
          `Use one of: ${BUILDING_WHEN.concat(OPENING_WHEN).join(", ")}.`);
    }
  }
  return true;
}

/* The value of the first matching rule. */
export function pickRule(list, facts) {
  if (!isRuleList(list)) return list;
  for (const r of list) if (ruleMatches(r.when, facts)) return r.value;
  throw new Error("No construction rule matched this building, and the list has no last rule without a \"when\" to fall back on.");
}

/* Which "when" tests a rule list uses. */
function whenKeys(list) {
  const out = new Set();
  for (const r of list) if (isPlainObject(r.when)) for (const k of Object.keys(r.when)) if (!k.startsWith("_")) out.add(k);
  return out;
}

/* Deep merge, later layers win. Objects merge key by key; arrays (including
   rule lists) and plain values replace. "_" keys are dropped. */
export function mergeConstruction(...layers) {
  let out = {};
  for (const layer of layers) {
    if (layer == null) continue;
    out = mergeTwo(out, layer);
  }
  return out;
}
function mergeTwo(a, b) {
  if (!isPlainObject(b)) return clone(b);
  const out = isPlainObject(a) ? Object.assign({}, a) : {};
  for (const k of Object.keys(b)) {
    if (k.startsWith("_")) continue;
    out[k] = isPlainObject(b[k]) && isPlainObject(out[k]) ? mergeTwo(out[k], b[k]) : clone(b[k]);
  }
  return out;
}
function clone(v) {
  if (Array.isArray(v)) return v.map(clone);
  if (isPlainObject(v)) {
    const o = {};
    for (const k of Object.keys(v)) if (!k.startsWith("_")) o[k] = clone(v[k]);
    return o;
  }
  return v;
}

/* {"floor.deck.layers": 2} -> {floor: {deck: {layers: 2}}} */
export function effectsToTree(effects) {
  const out = {};
  if (!isPlainObject(effects)) return out;
  for (const path of Object.keys(effects)) {
    if (path.startsWith("_")) continue;
    const bits = path.split(".");
    let o = out;
    for (let i = 0; i < bits.length - 1; i++) {
      if (!isPlainObject(o[bits[i]])) o[bits[i]] = {};
      o = o[bits[i]];
    }
    o[bits[bits.length - 1]] = clone(effects[path]);
  }
  return out;
}

/* Settle every building rule list in the tree for these facts
   {W, L, style, roof, metal}. Lists about an opening are kept as lists. */
export function resolveConstruction(tree, facts) {
  function walk(v) {
    if (isRuleList(v)) {
      const keys = whenKeys(v);
      for (const k of keys) if (OPENING_WHEN.indexOf(k) >= 0) return v.map(clone);
      return walk(pickRule(v, facts));
    }
    if (Array.isArray(v)) return v.map(walk);
    if (isPlainObject(v)) {
      const o = {};
      for (const k of Object.keys(v)) if (!k.startsWith("_")) o[k] = walk(v[k]);
      return o;
    }
    return v;
  }
  return walk(tree);
}

/* Plain-English problems with a construction tree (used by validation):
   unknown "when" tests, and rule lists with no fallback rule. */
export function constructionProblems(tree, where = "construction") {
  const out = [];
  function walk(v, path) {
    if (isRuleList(v)) {
      v.forEach((r, i) => {
        if (r.when != null && !isPlainObject(r.when)) out.push(`${path}[${i}].when must be an object of tests like {"maxW": 8}.`);
        else if (r.when) for (const k of Object.keys(r.when)) {
          if (!k.startsWith("_") && BUILDING_WHEN.indexOf(k) < 0 && OPENING_WHEN.indexOf(k) < 0) {
            out.push(`${path}[${i}] tests "${k}", which a rule cannot test (use ${BUILDING_WHEN.concat(OPENING_WHEN).join(", ")}).`);
          }
        }
        walk(r.value, `${path}[${i}].value`);
      });
      const last = v[v.length - 1];
      if (last.when && Object.keys(last.when).some((k) => !k.startsWith("_"))) {
        out.push(`${path}: the last rule should have no "when", so every building still gets a value.`);
      }
      return;
    }
    if (Array.isArray(v)) { v.forEach((x, i) => walk(x, `${path}[${i}]`)); return; }
    if (isPlainObject(v)) for (const k of Object.keys(v)) if (!k.startsWith("_")) walk(v[k], `${path}.${k}`);
  }
  walk(tree, where);
  out.push(...valueProblems(tree, where));
  return out;
}

/* WHAT A VALUE MUST LOOK LIKE. A typo in a lumber size ("2y4") used to pass
   and then break the Framing view for every building; a check here names it
   in plain words when the settings are loaded instead. Only keys this file
   knows are tested -- anything else is left alone. */
const LUMBER_KEYS = new Set(["floor.joist", "floor.rim", "walls.stud", "walls.header", "roof.chord",
  "roofDeck.purlins.size", "loft.joist", "porch.post", "porch.joist", "skids.size"]);
const LUMBER_RE = /^\s*(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)\b/i;
const COUNT_KEYS = { "walls.bottomPlates": [1, 3], "walls.topPlates": [1, 3], "floor.deck.layers": [1, 4] };
const CHOICES = { "roof.framing": ["truss", "rafter"], "roofDeck.type": ["purlins", "osb"], "openings.trim.headJoint": ["continuous", "reveal"] };
function valueProblems(tree, where) {
  const out = [];
  const say = (path, msg) => out.push(`${where}.${path}: ${msg}`);
  function values(v) { return isRuleList(v) ? v.map((r) => r && r.value) : [v]; }
  function check(key, v) {
    if (v === undefined) return;
    if (key === "openings.trim.porchBand") {
      for (const x of values(v)) if (typeof x !== "boolean") say(key, `${JSON.stringify(x)} should be true or false.`);
      return;
    }
    if (key === "openings.trim.widthIn") {
      for (const x of values(v)) if (!(typeof x === "number" && Number.isFinite(x) && x >= 1 && x <= 8)) say(key, `${JSON.stringify(x)} should be a trim width from 1 to 8 inches.`);
      return;
    }
    if (LUMBER_KEYS.has(key)) {
      for (const x of values(v)) {
        const m = LUMBER_RE.exec(String(x == null ? "" : x));
        if (!m || !(+m[1] >= 1 && +m[1] <= 12 && +m[2] >= 1 && +m[2] <= 16)) {
          say(key, `"${x}" is not a lumber size -- write it like "2x4", "2x6 doubled" or "4x4".`);
        }
      }
      return;
    }
    if (/spacingIn$/.test(key)) {
      for (const x of values(v)) if (!(typeof x === "number" && x >= 8 && x <= 48)) say(key, `${JSON.stringify(x)} is not a spacing in inches (between 8 and 48, for example 16 or 24).`);
      return;
    }
    if (COUNT_KEYS[key]) {
      const [lo, hi] = COUNT_KEYS[key];
      for (const x of values(v)) if (!(Number.isInteger(x) && x >= lo && x <= hi)) say(key, `${JSON.stringify(x)} should be a whole number from ${lo} to ${hi}.`);
      return;
    }
    if (CHOICES[key]) {
      for (const x of values(v)) if (CHOICES[key].indexOf(String(x).toLowerCase()) < 0) say(key, `${JSON.stringify(x)} should be one of ${CHOICES[key].join(" or ")}.`);
      return;
    }
    if (/(In|Ft)$/.test(key) && !/^(roof\.shapes|openings\.)/.test(key)) {
      for (const x of values(v)) if (typeof x === "number" && !(Number.isFinite(x) && x >= 0)) say(key, `${JSON.stringify(x)} should be a measurement of 0 or more.`);
    }
  }
  function walk(v, key) {
    if (isRuleList(v) || Array.isArray(v) || !isPlainObject(v)) { check(key, v); return; }
    for (const k of Object.keys(v)) if (!k.startsWith("_")) walk(v[k], key ? key + "." + k : k);
  }
  if (isPlainObject(tree)) {
    for (const k of Object.keys(tree)) {
      if (k.startsWith("_")) continue;
      if (k === "buildOrder") {
        const bo = tree.buildOrder;
        if (!Array.isArray(bo)) { say("buildOrder", "should be a list of building steps, for example [\"skids\", \"floor-frame\"]."); continue; }
        const seen = new Set();
        for (const x of bo) {
          if (STAGE_ID[x] === undefined) say("buildOrder", `"${x}" is not a building step (the steps are: ${STAGES.map((st) => st.key).join(", ")}).`);
          else if (seen.has(x)) say("buildOrder", `"${x}" is listed twice.`);
          seen.add(x);
        }
        continue;
      }
      walk(tree[k], k);
    }
  }
  return out;
}

/* ------------------------------------------------------------------------
   WHAT CAN BE SET: every construction setting the code reads, so a typo is
   named instead of quietly doing nothing ("roof.shapes.gable.rize" used to
   be kept and never read). Built from what parts/, model/ and engine/ read
   -- the library file, plus interior.* (parts/interior.js), ramp.lengthFt
   (parts/ramp.js) and the lesson blocks the learning pages read, which hold
   free-form notes. tools/check-construction.mjs proves every library path
   is here and every block the code reads is here.

   A node is VALUE (one setting: a number, words, a list, a length or a rule
   list), FREE (a lesson block: anything inside), a group {key: node}, or a
   map whose keys are building widths ("10") or roof shapes ("gambrel",
   "other"). */
const VALUE = "value";
const FREE = "free";
const byWidth = (of) => ({ $keys: "width", of });
const byRoof = (of, plain) => ({ $keys: "roof", of, plain: !!plain });
export const ROOF_KEYS = ["gable", "gambrel", "salt", "lean", "slope"];
const eaves = () => ({ left: VALUE, right: VALUE });
export const CONSTRUCTION_SCHEMA = freezeAll({
  site: { blocks: VALUE, perimeterFtPerBlock: VALUE, anchors: VALUE, anchorsAssumed: VALUE },
  skids: { size: VALUE, onEdge: VALUE, treated: VALUE, table: byWidth(VALUE), bunkSpacingIn: VALUE },
  floor: { joist: VALUE, spacingIn: VALUE, rim: VALUE, deck: { thicknessIn: VALUE, sheet: VALUE, layers: VALUE } },
  walls: { stud: VALUE, spacingIn: VALUE, bottomPlates: VALUE, topPlates: VALUE, corner: VALUE, header: VALUE,
    studLengthIn: { loft: VALUE, tall: VALUE } },
  openings: {
    trim: { widthIn: VALUE, headJoint: VALUE, porchBand: VALUE },
    doorHeightIn: byRoof(VALUE, true),
    windowTop: byRoof({ belowWallTopIn: VALUE, levelWithDoor: VALUE, minBelowWallTopFt: VALUE }),
  },
  roof: {
    framing: VALUE, spacingIn: VALUE, chord: VALUE, gussets: VALUE,
    dormerRise: VALUE,
    cottageEave: { backIn: VALUE, frontIn: VALUE, fasciaIn: VALUE },
    shapes: {
      gable: { rise: VALUE, eaveOverhang: eaves(), rakeOverhang: VALUE },
      gambrel: { rise: VALUE, lowerRise: VALUE, upperRise: VALUE, knee: VALUE, eaveOverhang: eaves(), rakeOverhang: VALUE,
        endOverhang: VALUE, peakIn: byWidth(VALUE) },
      salt: { rise: VALUE, ridge: VALUE, eaveOverhang: eaves(), rakeOverhang: VALUE },
      lean: { rise: VALUE, eaveOverhang: eaves(), rakeOverhang: VALUE },
      slope: { rise: VALUE, eaveOverhang: eaves(), rakeOverhang: VALUE },
    },
  },
  roofDeck: { type: VALUE, purlins: { size: VALUE, flat: VALUE, spacingIn: VALUE }, sheathingIn: VALUE },
  loft: { joist: VALUE, spacingIn: VALUE, deck: { thicknessIn: VALUE } },
  porch: { post: VALUE, joist: VALUE, railHeightIn: VALUE },
  buildOrder: VALUE,
  notes: byWidth(VALUE),
  interior: { benchHeightIn: VALUE, shelfHeightIn: VALUE, topIn: VALUE, legMaxSpacingFt: VALUE },
  ramp: { lengthFt: VALUE },
  claddingStudy: FREE, utilityStudy: FREE, trussStudy: FREE, windowHeader: FREE, windowPlateLesson: FREE,
  doorwayLesson: FREE, gableBacking: FREE, gableStudy: FREE, wallStudy: FREE, floorStudy: FREE,
});
function freezeAll(o) {
  if (o && typeof o === "object" && !Object.isFrozen(o)) { Object.freeze(o); for (const k of Object.keys(o)) freezeAll(o[k]); }
  return o;
}

/* The closest of `choices` to a mistyped `word` (case ignored, one or two
   letters off), or null. "rize" -> "rise", "sizez" -> "sizes". */
export function closest(word, choices) {
  const w = String(word).toLowerCase();
  let best = null, bestD = Infinity;
  for (const c of choices) {
    const d = editDistance(w, String(c).toLowerCase());
    if (d < bestD) { best = c; bestD = d; }
  }
  const limit = w.length <= 4 ? 1 : 2;
  return best != null && bestD <= limit ? best : null;
}
function editDistance(a, b) {
  const m = a.length, n = b.length;
  const d = [];
  for (let i = 0; i <= m; i++) { d.push(new Array(n + 1).fill(0)); d[i][0] = i; }
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[m][n];
}
/* " Did you mean rise?" or " (here it can be: a, b, c)." -- the tail of a typo's words. */
export function didYouMean(word, choices) {
  const c = closest(word, choices);
  return c != null ? `. Did you mean ${c}?` : ` (here it can be: ${choices.join(", ")}).`;
}

/* Every path in a construction tree that the schema does not know, in plain
   words, with the closest known name: "construction.roof.shapes.gable.rize
   is not a construction setting. Did you mean rise?". These are STRICT
   problems (model/company.js strictProblems): a save that adds one is
   refused; a price list that already holds one still opens and draws. */
export function constructionPathProblems(tree, where = "construction") {
  const out = [];
  function walk(v, s, path) {
    if (s === VALUE || s === FREE) return;
    if (isRuleList(v)) { v.forEach((r, i) => walk(r.value, s, `${path}[${i}].value`)); return; }
    if (s.$keys) {
      if (s.plain && !isPlainObject(v)) return;
      if (!isPlainObject(v)) { out.push(`${path} must be a group of settings, one per ${s.$keys === "width" ? "building width" : "roof shape"}.`); return; }
      for (const k of Object.keys(v)) {
        if (k.startsWith("_")) continue;
        if (s.$keys === "width" ? !/^\d{1,2}$/.test(k) : ROOF_KEYS.concat("other").indexOf(k) < 0) {
          out.push(s.$keys === "width"
            ? `${path}.${k} is not a building width: write the width in whole feet, like "10".`
            : `${path}.${k} is not a roof shape${didYouMean(k, ROOF_KEYS.concat("other"))}`);
          continue;
        }
        walk(v[k], s.of, `${path}.${k}`);
      }
      return;
    }
    if (!isPlainObject(v)) { out.push(`${path} must be a group of settings (${Object.keys(s).join(", ")}), not one value.`); return; }
    for (const k of Object.keys(v)) {
      if (k.startsWith("_")) continue;
      if (!Object.prototype.hasOwnProperty.call(s, k)) {
        out.push(`${path}.${k} is not a construction setting${didYouMean(k, Object.keys(s))}`);
        continue;
      }
      walk(v[k], s[k], `${path}.${k}`);
    }
  }
  walk(tree, CONSTRUCTION_SCHEMA, where);
  return out;
}

/* A length the roof reads with lengthOf (model/roof-shapes.js): feet, {"ft"},
   {"in"} or {"w"} (a share of the width). A bad one used to throw when the
   building was drawn. */
const LENGTH_KEYS = ["rise", "lowerRise", "upperRise", "knee", "ridge"];
function lengthProblem(v, flat) {
  if (typeof v === "number") return Number.isFinite(v) ? null : "is not a number";
  const units = flat ? ["ft", "in", "w", "flatIn"] : ["ft", "in", "w"];
  if (isPlainObject(v)) {
    const ks = Object.keys(v).filter((k) => !k.startsWith("_"));
    if (ks.length === 1 && units.indexOf(ks[0]) >= 0 && typeof v[ks[0]] === "number" && Number.isFinite(v[ks[0]])) return null;
  }
  return `${JSON.stringify(v)} is not a length: write feet (2.5), {"ft": 2.5}, {"in": 30}${flat ? ", inches out from the wall ({\"flatIn\": 4})" : ""} or a share of the width ({"w": 0.27})`;
}
/* A roof length as feet at width W (lengthOf, with the eave's {"flatIn"}). */
function feetAt(v, W) {
  if (typeof v === "number") return v;
  if (isPlainObject(v)) {
    if (typeof v.w === "number") return v.w * W;
    if (typeof v.ft === "number") return v.ft;
    if (typeof v.in === "number") return v.in / 12;
    if (typeof v.flatIn === "number") return v.flatIn / 12;
  }
  return NaN;
}
/* feet -> "9 ft 7 1/4 in", "4 in" (to the nearest 1/8 in) */
function feetWords(ft) {
  const e = Math.round(Math.abs(ft) * 96), inch = Math.floor(e / 8), f = ["", "1/8", "1/4", "3/8", "1/2", "5/8", "3/4", "7/8"][e % 8];
  const sign = ft < 0 ? "-" : "";
  if (inch >= 12) { const feet = Math.floor(inch / 12), rest = inch % 12; return sign + (!rest && !f ? `${feet} ft` : `${feet} ft ${rest}${f ? " " + f : ""} in`); }
  return sign + (inch ? `${inch}${f ? " " + f : ""} in` : `${f || "0"} in`);
}
const ROOF_WORDS = { gable: "gable roof", gambrel: "barn roof", salt: "saltbox roof", lean: "lean-to roof", slope: "single slope roof", other: "roof" };
const KEY_WORDS = { rise: "height above the wall", lowerRise: "lower slope's rise", upperRise: "upper slope's rise", knee: "knee (where its two slopes meet)", ridge: "ridge", dormerRise: "height above the wall" };
/* The widths the 3D designer draws a roof at (narrowest, widest). */
const ROOF_WIDTHS = [6, 16];
/* What a roof length must be to draw: a roof 0 to 8 ft above the wall (the
   every-size check's limit, model/style-check.js), its knee and ridge inside
   the walls, an eave 0 to 2 ft out. In the owner's words, after the path. */
function sizeProblem(k, v, roofWord) {
  const at = ROOF_WIDTHS.map((W) => ({ W, ft: feetAt(v, W) }));
  if (at.some((a) => !Number.isFinite(a.ft))) return null;          /* said by lengthProblem */
  if (k === "rise" || k === "lowerRise" || k === "upperRise" || k === "dormerRise") {
    const hi = at.find((a) => a.ft > 8 + 1e-9), lo = at.find((a) => !(a.ft > 0));
    if (hi) return `The ${roofWord}'s ${KEY_WORDS[k]} would be ${feetWords(hi.ft)} on a ${hi.W} ft wide building: 8 ft at most.`;
    if (lo) return `The ${roofWord}'s ${KEY_WORDS[k]} must be more than 0.`;
  }
  if (k === "knee" || k === "ridge") {
    const out = at.find((a) => Math.abs(a.ft) >= a.W / 2 - 1e-9 || (k === "knee" && !(a.ft > 0)));
    if (out) return `The ${roofWord}'s ${KEY_WORDS[k]} would be ${feetWords(out.ft)} from the middle of a ${out.W} ft wide building, past its walls.`;
  }
  if (k === "eave") {
    const bad = at.find((a) => a.ft < 0 || a.ft > 2 + 1e-9);
    if (bad) return `The ${roofWord}'s eave would stand ${feetWords(bad.ft)} out from the wall: 0 to 2 ft.`;
  }
  return null;
}
export function roofValueProblems(tree, where = "construction") {
  const out = [];
  const roof = isPlainObject(tree) && isPlainObject(tree.roof) ? tree.roof : null;
  if (!roof) return out;
  const each = (v, path, fn) => { if (isRuleList(v)) v.forEach((r, i) => fn(r.value, `${path}[${i}].value`)); else fn(v, path); };
  const len = (v, path, flat, k, roofWord) => {
    if (v === undefined) return;
    each(v, path, (x, p) => {
      const why = lengthProblem(x, flat);
      if (why) { out.push(`${p}: ${why}.`); return; }
      const big = sizeProblem(k, x, roofWord);
      if (big) out.push(`${p}: ${big}`);
    });
  };
  len(roof.dormerRise, `${where}.roof.dormerRise`, false, "dormerRise", "Dormer Shed's main roof");
  const shapes = isPlainObject(roof.shapes) ? roof.shapes : {};
  for (const s of Object.keys(shapes)) {
    const sh = shapes[s];
    if (!isPlainObject(sh)) continue;
    const at = `${where}.roof.shapes.${s}`;
    for (const k of LENGTH_KEYS) len(sh[k], `${at}.${k}`, false, k, ROOF_WORDS[s] || "roof");
    if (isPlainObject(sh.eaveOverhang)) for (const side of ["left", "right"]) len(sh.eaveOverhang[side], `${at}.eaveOverhang.${side}`, true, "eave", ROOF_WORDS[s] || "roof");
    for (const k of ["rakeOverhang", "endOverhang"]) if (sh[k] !== undefined) each(sh[k], `${at}.${k}`, (x, p) => {
      if (!(typeof x === "number" && x >= 0 && x <= 3)) out.push(`${p}: ${JSON.stringify(x)} should be feet past the gable end, from 0 to 3.`);
    });
    if (isPlainObject(sh.peakIn)) for (const w of Object.keys(sh.peakIn)) if (!w.startsWith("_")) each(sh.peakIn[w], `${at}.peakIn.${w}`, (x, p) => {
      if (!(typeof x === "number" && x >= 12 && x <= 120)) out.push(`${p}: ${JSON.stringify(x)} should be the barn roof's height above the wall in inches, from 12 to 120.`);
    });
  }
  return out;
}

/* The strict construction problems: unknown paths and badly written roof
   lengths. Never checked when a price list is read (it still opens). */
export function strictConstructionProblems(tree, where = "construction") {
  return constructionPathProblems(tree, where).concat(roofValueProblems(tree, where));
}

/* The facts a building rule can test. d is {W, L} (the corner porch's
   deck is part of L, as it is everywhere else in the model). A company's own
   style built like another (t.base, model/company.js) is framed exactly like
   that one, so a "styles" rule tests the base: "LB" covers the Lofted Barn and
   a "Premium Lofted Barn" built like it. */
export function buildingFacts(styleKey, t, d) {
  return { W: d.W, L: d.L, style: (t && t.base) || styleKey, roof: t.roof, metal: !!t.metal };
}

/* The option keys switched on in a live design, in the key form the catalogue
   uses for everything (rate.jo12, elec.2, ramp.r4, dormer.9, misc.ext, and an
   extra's own key). */
export function chosenOptionKeys(state, t) {
  const out = [];
  const O = state.opts || {};
  for (const k of Object.keys(O)) if (O[k]) out.push("rate." + k);
  if (t && t.dormer && state.dormer && state.dormer !== "none") out.push("dormer." + state.dormer);
  if (state.elec && state.elec.pkg > 0) {
    out.push("elec." + state.elec.pkg);
    if (state.elec.ext) out.push("misc.ext");
  }
  if (state.ramp && state.ramp !== "none") out.push("ramp." + state.ramp);
  const X = state.xopt || {};
  for (const k of Object.keys(X)) if (+X[k] > 0) out.push(k);
  return out;
}

/* The construction for one live design: library < manufacturer < company
   (already merged into cat.construction by model/company.js) < the style's
   own numbers (t.construction: what "How it's built" sets for this style,
   model/build-settings.js) < the effects of the options chosen, then settled
   for this building. */
export function constructionFor(cat, state, t, d) {
  const effects = (cat && cat.optionEffects) || {};
  const layers = [cat && cat.construction, t && t.construction];
  const chosen = chosenOptionKeys(state, t);
  for (const k of chosen) if (effects[k]) layers.push(effectsToTree(effects[k]));
  const facts = buildingFacts(state.type, t, d);
  /* an extra's How it's built numbers for this style (model/build-settings.js
     optionEffectFor): they replace the style's, except a roof rise marked
     "at least", which is kept when the building's own is steeper already */
  const own = (t && t.optionEffects) || {};
  const extra = chosen.filter((k) => own[k]);
  if (!extra.length) return resolveConstruction(mergeConstruction(...layers), facts);
  const before = resolveConstruction(mergeConstruction(...layers), facts);
  const after = resolveConstruction(mergeConstruction(before, ...extra.map((k) => own[k].tree)), facts);
  for (const k of extra) {
    for (const path of own[k].atLeast || []) {
      const a = atPath(before, path), b = atPath(after, path);
      if (a !== undefined && b !== undefined && lengthOf(a, d.W) > lengthOf(b, d.W)) putPath(after, path, clone(a));
    }
  }
  return after;
}
function atPath(tree, path) { return path.split(".").reduce((o, k) => (isPlainObject(o) ? o[k] : undefined), tree); }
function putPath(tree, path, v) {
  const bits = path.split(".");
  let o = tree;
  for (let i = 0; i < bits.length - 1; i++) { if (!isPlainObject(o[bits[i]])) o[bits[i]] = {}; o = o[bits[i]]; }
  o[bits[bits.length - 1]] = v;
}

/* The wooden shop-door opening height in FEET for this roof. The settings say
   inches (71.5, 76.5); Barnwright draws them to four decimals of a foot
   (5.9583, 6.375), so the conversion rounds to four decimals -- which gives
   Barnwright's numbers exactly. */
export function doorHeightFt(construction, roof) {
  const o = (construction && construction.openings && construction.openings.doorHeightIn) || { gambrel: 71.5, other: 76.5 };
  const inches = typeof o === "number" ? o : (o[roof] != null ? o[roof] : o.other);
  return Math.round(inches / 12 * 1e4) / 1e4;
}

/* Where a wall window's TOP sits, in feet above the deck, for this roof and
   wall height. Barnwright's rule (renderItem 3190-3196): on loft builds 5 in
   under the wall top; on tall walls level with the door head, but never closer
   than 0.15 ft to the wall top. */
export function windowTopFt(construction, roof, wallH) {
  const o = (construction && construction.openings && construction.openings.windowTop) ||
    { gambrel: { belowWallTopIn: 5 }, other: { levelWithDoor: true, minBelowWallTopFt: 0.15 } };
  const r = (o[roof] != null ? o[roof] : o.other) || {};
  if (r.belowWallTopIn != null) return wallH - r.belowWallTopIn / 12;
  const cap = wallH - (r.minBelowWallTopFt != null ? r.minBelowWallTopFt : 0.15);
  return r.levelWithDoor ? Math.min(doorHeightFt(construction, roof), cap) : cap;
}
