/* "HOW IT'S BUILT": THE NUMBERS A SHOP BUILDS BY, AS SETTINGS. Node-safe,
   pure, no I/O (the 3D designer, the server, the Dealer Center screens and
   the checks all use it).

   Alan (Oct 2026, "lets all 5"): a business types the roof pitch like 5/12,
   the eave and gable-end overhangs, the wall height, the shop door height,
   the porch depth, the side porch lengths, the barn roof height for each
   width and which side the dormer goes on -- with sane limits, a plain error
   on a typo, and each change in History. Each one is a KNOB:

     roofPitch         Roof pitch                rise per 12 in (5 = 5/12)
     barnPeak          Barn roof height          inches above the wall top, by width in feet
     eaveOverhang      Eave overhang             inches, measured level out from the long walls
     gableEndOverhang  Gable-end overhang        inches past the gable ends
     wallHeight        Wall height               inches, floor to the top of the wall plate
     doorHeight        Wooden shop door height   inches (the opening)
     porchDepth        Porch depth               feet
     sidePorchLengths  Side porch lengths        whole feet, a list
     dormerSide        Dormer side               "door" or "back"

   WHERE THEY LIVE, and which one wins for a style (first one found):
     1. offer.<KEY>.built            this style's own
     2. offer.<BASE>.built           for a style of the business's own: the
                                     style it is built like ("Premium Utility"
                                     follows the owner's Utility Shed)
     3. built                        business-wide (by roof kind), unless the
                                     style has a STYLE FEATURE for that knob
     4. styles.<BASE>.built          the shop standard (library/manufacturers),
                                     except on a construction path the
                                     business's own raw construction sets
     5. the library's raw number     (library/construction.json, the style's
                                     raw traits)
   Then, for one design only, an extra the customer picked: its roof pitch
   counts only when it is STEEPER ("at least this steep"), its other numbers
   replace the style's.

   STYLE FEATURES are what make a style what it is; a business-wide number
   does not reach them, a number set on that style itself replaces them:
   the flush gable end (rakeOverhang) of the Garden Utility and the cottages,
   the Standard Barn's own barn shoulders (gambrel), the Dormer Shed's own
   main roof (roof.dormerRise).

   Exports:
     KNOBS, KNOB_PATHS, knobsFor(t), parse(id, input, ctx), format(id, value),
     shortWords(id, value),
     problems(settings, manufacturer), libraryProblems(manufacturer),
     apply(settings, manufacturer, library), optionEffectFor(built, t),
     extraProblems(built, at), effective(cat, key),
     libraryNumbers(settings, manufacturer, library),
     businessReach(settings, manufacturer, id, kind), roofKindOf(t),
     describeExtraBuilt(name, before, after),
     describeChanges(before, after, manufacturer, library), setBuilt(settings, edit),
     checkStyleNumber(settings, manufacturer, key, id, input),
     liftRawRules(settings, manufacturer)

   A value is stored as a NUMBER in its knob's unit; screens and the connector
   may send text ("5/12", "7 ft 9 1/2 in"), which parse() turns into the
   number and format() turns back. Problems speak the owner's words, after
   the settings path: "offer.LB.built.roofPitch: The Lofted Barn has a barn
   roof, ...". */

import { closest, resolveConstruction, buildingFacts } from "./construction.js";
import { DEFAULT_ROOF, lengthOf, barnTrussPeakFt, roofProfile, roofShape } from "./roof-shapes.js";
import { SIDE_WALL_MIN_FT, SIDE_PORCH_LENGTHS } from "./frame.js";

const lengthOfFt = (v, W) => lengthOf(v, W);

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const own = (o, k) => isObj(o) && Object.prototype.hasOwnProperty.call(o, k);
const keysOf = (o) => (isObj(o) ? Object.keys(o).filter((k) => !k.startsWith("_")) : []);
const copy = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/* ------------------------------------------------------------------------ */
/* The knobs                                                                 */

export const KNOBS = Object.freeze([
  { id: "roofPitch", Words: "Roof pitch", words: "roof pitch", unit: "pitch", business: ["gable", "lean", "slope"], inExtra: true },
  { id: "barnPeak", Words: "Barn roof height", words: "barn roof height", unit: "byWidth", business: true, inExtra: true },
  { id: "eaveOverhang", Words: "Eave overhang", words: "eave overhang", unit: "in", business: ["gable", "barn"], inExtra: true },
  { id: "gableEndOverhang", Words: "Gable-end overhang", words: "gable-end overhang", unit: "in", business: ["gable", "lean", "slope", "barn"], inExtra: true },
  { id: "wallHeight", Words: "Wall height", words: "wall height", unit: "in", business: false, inExtra: false },
  { id: "doorHeight", Words: "Wooden shop door height", words: "wooden shop door height", unit: "in", business: ["barn", "other"], inExtra: true },
  { id: "porchDepth", Words: "Porch depth", words: "porch depth", unit: "ft", business: true, inExtra: false },
  { id: "sidePorchLengths", Words: "Side porch lengths", words: "side porch lengths", unit: "ftList", business: true, inExtra: false },
  { id: "dormerSide", Words: "Dormer side", words: "dormer side", unit: "side", business: true, inExtra: false },
].map((k) => Object.freeze(k)));
const KNOB = Object.fromEntries(KNOBS.map((k) => [k.id, k]));
const KNOB_IDS = KNOBS.map((k) => k.id);

/* The limits, in each knob's unit. */
/* The pitches the 3D designer draws AND frames: flatter than these, its
   trusses or gussets cannot be worked out (a lean-to at 1/12, a single
   slope at 1 1/2/12), and on a metal building's purlin deck a gable roof
   needs 4/12 (at 3 1/2/12 its top chords stop short of the wall). */
const PITCH = { gable: [3, 12], lean: [1.25, 6], slope: [2, 8] };
const METAL_GABLE_MIN = 4;
/* -> [flattest, steepest] per 12 for a roof kind ("gable", "lean", "slope"),
   on a metal building or not */
export function pitchLimits(kind, metal) {
  const l = PITCH[kind] || [1, 12];
  return kind === "gable" && metal ? [METAL_GABLE_MIN, l[1]] : l;
}
const EAVE = { gable: [0, 12], barn: [0, 3] };
const LIMITS = { gableEndOverhang: [0, 12], wallHeight: [48, 120], doorHeight: [60, 96], porchDepth: [3, 8], barnPeak: [24, 96] };

/* The construction paths the knobs own. A raw construction setting on one of
   them is a strict problem: set it in How it's built instead. */
export const KNOB_PATHS = Object.freeze({
  roofPitch: ["roof.shapes.gable.rise", "roof.dormerRise", "roof.shapes.lean.rise", "roof.shapes.slope.rise"],
  /* the barn roof's shape is its height by width: its rises and knee are
     never set raw (a barn whose upper slope is steeper than its lower) */
  barnPeak: ["roof.shapes.gambrel.peakIn", "roof.shapes.gambrel.lowerRise", "roof.shapes.gambrel.upperRise", "roof.shapes.gambrel.knee"],
  eaveOverhang: ["roof.shapes.gable.eaveOverhang", "roof.shapes.gambrel.eaveOverhang"],
  gableEndOverhang: ["roof.shapes.gable.rakeOverhang", "roof.shapes.salt.rakeOverhang", "roof.shapes.lean.rakeOverhang", "roof.shapes.slope.rakeOverhang", "roof.shapes.gambrel.endOverhang"],
  doorHeight: ["openings.doorHeightIn"],
});

/* The roof kind a style has, in the words the knobs use. */
function kindOf(t) {
  if (!t) return null;
  if (t.roof === "gambrel") return "barn";
  return t.roof || "gable";
}
const KIND_WORDS = { gable: "gable roofs", lean: "lean-to roofs", slope: "single slope roofs", barn: "barn roofs", other: "every other roof", salt: "saltbox roofs" };

/* The knobs that apply to a style (its raw or resolved traits). */
export function knobsFor(t) {
  if (!t) return [];
  const out = [];
  const k = kindOf(t);
  if (k === "gable" || k === "lean" || k === "slope") out.push("roofPitch");
  if (k === "barn") out.push("barnPeak");
  if ((k === "gable" || k === "barn") && !t.cottage) out.push("eaveOverhang");
  out.push("gableEndOverhang", "wallHeight", "doorHeight");
  if (t.porch === "F" || t.porch === "S" || t.porch === "C") out.push("porchDepth");
  if (t.porch === "S") out.push("sidePorchLengths");
  if (t.dormer) out.push("dormerSide");
  return out;
}

/* Why a knob does not apply to a style, in words. */
function notApplying(id, name, t) {
  const k = kindOf(t);
  if (id === "roofPitch") return k === "barn" ? `The ${name} has a barn roof, so it has no roof pitch. Set its barn roof height instead.` : `The ${name} has a ${k === "salt" ? "saltbox" : k} roof with no roof pitch to set here.`;
  if (id === "barnPeak") return `The ${name} has no barn roof, so it has no barn roof height. Set its roof pitch instead.`;
  if (id === "eaveOverhang") return `The ${name} has no eave overhang to set here.`;
  if (id === "porchDepth") return `The ${name} has no porch.`;
  if (id === "sidePorchLengths") return `The ${name} has no side porch.`;
  if (id === "dormerSide") return `The ${name} has no dormer.`;
  return `The ${name} has no ${KNOB[id] ? KNOB[id].words : id}.`;
}

/* ------------------------------------------------------------------------ */
/* Reading what a person typed                                               */

/* "93", "93.5", "93 1/2", "1/2" -> the number, or NaN */
const NUM = "(?:\\d+(?:\\.\\d+)?(?:\\s+\\d+\\s*\\/\\s*\\d+)?|\\d+\\s*\\/\\s*\\d+)";
/* A fraction is less than one ("1/2", "7 1/2"): "6'71/2"" is 6 ft 7 1/2 in
   with the space left out, never 6 ft and 35 3/4 in (review W9). */
function numOf(s) {
  const t = String(s).trim();
  let m = /^(\d+(?:\.\d+)?)\s+(\d+)\s*\/\s*(\d+)$/.exec(t);
  if (m) return +m[3] && +m[2] < +m[3] ? +m[1] + +m[2] / +m[3] : NaN;
  m = /^(\d+)\s*\/\s*(\d+)$/.exec(t);
  if (m) return +m[2] && +m[1] < +m[2] ? +m[1] / +m[2] : NaN;
  return /^\d+(?:\.\d+)?$/.test(t) ? +t : NaN;
}
function clean(s) {
  return String(s).trim().toLowerCase().replace(/[′’']/g, "'").replace(/[″“”"]/g, "\"").replace(/\s+/g, " ");
}
/* A length typed as text -> { value, unitGiven } in `unit` ("in" or "ft"),
   or null when it cannot be read. A bare number is in `unit`. */
function readLength(text, unit) {
  const s = clean(text);
  const re = new RegExp(`^(?:(${NUM})\\s*(?:ft|feet|foot|')\\s*)?(?:(${NUM})\\s*(in|inch|inches|")?)?$`);
  const m = re.exec(s);
  if (!m || (m[1] == null && m[2] == null)) return null;
  const ft = m[1] != null ? numOf(m[1]) : 0;
  const inch = m[2] != null ? numOf(m[2]) : 0;
  if (!Number.isFinite(ft) || !Number.isFinite(inch)) return null;
  if (m[1] == null && !m[3]) return { value: inch, unitGiven: false };          /* a bare number */
  const inches = ft * 12 + inch;
  return { value: unit === "ft" ? inches / 12 : inches, unitGiven: true };
}
/* "5/12", "5 1/2/12", "5.5/12", "5 in 12", or a bare number -> per 12 */
function readPitch(text) {
  const s = clean(text);
  const m = new RegExp(`^(${NUM})\\s*(?:\\/|in|:)\\s*12$`).exec(s) || new RegExp(`^(${NUM})$`).exec(s);
  if (!m) return null;
  const v = numOf(m[1]);
  return Number.isFinite(v) ? v : null;
}

const r4 = (v) => Math.round(v * 1e4) / 1e4;

/* -> { value } or { problem }. ctx: { kind: the roof kind ("gable", "lean",
   "slope", "barn"), name: the style's name } -- the limits that depend on the
   roof use it; without it the widest limits are used. */
export function parse(id, input, ctx = {}) {
  const K = KNOB[id];
  if (!K) return { problem: `${JSON.stringify(String(id))} is not a building setting${dym(id)}` };
  const text = typeof input === "string";
  if (input == null || (text && !input.trim())) return { problem: `${K.Words}: type a value, or leave it empty for the standard.` };
  let v;
  switch (K.unit) {
    case "pitch": {
      v = typeof input === "number" ? input : (text ? readPitch(input) : null);
      if (v == null || !Number.isFinite(v)) return { problem: `${K.Words}: write it like 5/12.` };
      if (text && Math.abs(v * 4 - Math.round(v * 4)) > 1e-9) return { problem: `${K.Words}: use quarter steps, like 5 1/4/12.` };
      const [lo, hi] = pitchLimits(ctx.kind, ctx.metal);
      if (v > hi) return { problem: `${K.Words} ${format(id, v)} is steeper than ${hi}/12, the steepest the 3D designer draws${ctx.kind && ctx.kind !== "gable" ? ` on ${KIND_WORDS[ctx.kind]}` : ""}.` };
      if (v < lo) return { problem: ctx.metal && ctx.kind === "gable"
        ? `${K.Words} ${format(id, v)} is flatter than ${format(id, lo)}, the flattest the 3D designer can frame a metal roof.`
        : `${K.Words} ${format(id, v)} is flatter than ${format(id, lo)}, the flattest the 3D designer ${ctx.kind && ctx.kind !== "gable" ? `can frame on ${KIND_WORDS[ctx.kind]}` : "draws"}.` };
      return { value: text ? v : r4(v) };
    }
    case "in": case "ft": {
      let bare = false;
      if (typeof input === "number") { v = input; bare = false; }
      else if (text) { const r = readLength(input, K.unit); if (!r) return { problem: `${K.Words}: write it like ${K.unit === "ft" ? "4 ft or 4 ft 6 in" : "7 ft 9 1/2 in"}.` }; v = r.value; bare = !r.unitGiven; }
      else return { problem: `${K.Words}: write it like ${K.unit === "ft" ? "4 ft" : "7 ft 9 1/2 in"}.` };
      if (!Number.isFinite(v) || v < 0) return { problem: `${K.Words}: write it like ${K.unit === "ft" ? "4 ft" : "7 ft 9 1/2 in"}.` };
      const lim = id === "eaveOverhang" ? (EAVE[ctx.kind] || EAVE.gable) : LIMITS[id];
      const [lo, hi] = lim;
      /* the way a builder says each: overhangs and door openings in inches
         ("12 in"), walls in feet and inches, porches in feet (review W13) */
      const overhang = id === "eaveOverhang" || id === "gableEndOverhang";
      const shown = (x) => (K.unit === "ft" ? fmtFt(x) : id === "doorHeight" || overhang ? fmtInOnly(x) : fmtIn(x));
      const typed = shown(v);
      if (v > hi) {
        if (id === "eaveOverhang" && ctx.kind === "barn") return { problem: `${K.Words} ${typed} is more than a barn roof can take: ${shown(hi)} at most.` };
        /* a bare number is in the box's unit; when it only makes sense in
           the other unit, say so */
        const hint = bare && K.unit === "ft" && v / 12 >= lo && v / 12 <= hi ? ` Did you mean ${fmtNum(v)} in (${shown(v / 12)})?` : "";
        return { problem: `${K.Words} ${typed} is ${K.unit === "ft" ? "deeper" : id === "wallHeight" || id === "doorHeight" ? "taller" : "more"} than ${shown(hi)}${overhang ? ", the most the 3D designer draws" : ""}.${hint}` };
      }
      if (v < lo) {
        const hint = bare && K.unit === "in" && v * 12 >= lo && v * 12 <= hi ? ` Did you mean ${fmtIn(v * 12)}?` : "";
        return { problem: `${K.Words} ${typed} is ${K.unit === "ft" ? "shallower" : id === "wallHeight" || id === "doorHeight" ? "lower" : "less"} than ${shown(lo)}.${hint}` };
      }
      return { value: r4(v) };
    }
    case "byWidth": {
      let map = input;
      if (text) {
        map = {};
        for (const part of input.split(/[;,]/).map((x) => x.trim()).filter(Boolean)) {
          const m = /^(\d{1,2})\s*(?:ft|feet|')?\s*(?:wide)?\s*:\s*(.+)$/i.exec(part);
          if (!m) return { problem: `${K.Words}: write each width like 10 ft wide: 4 ft.` };
          map[m[1]] = m[2];
        }
      }
      if (!isObj(map)) return { problem: `${K.Words}: give a height for each width, like 10 ft wide: 4 ft.` };
      const ws = keysOf(map);
      if (ws.length < 1 || ws.length > 8) return { problem: `${K.Words}: give 1 to 8 widths.` };
      const out = {};
      for (const w of ws) {
        if (!/^\d{1,2}$/.test(w) || +w < 6 || +w > 16) return { problem: `${K.Words}: ${w} is not a building width from 6 to 16 ft.` };
        const r = typeof map[w] === "number" ? { value: map[w], unitGiven: true } : readLength(String(map[w]), "in");
        if (!r || !Number.isFinite(r.value)) return { problem: `${K.Words} for the ${w} ft wide barn: write it like 4 ft 3 in.` };
        const [lo, hi] = LIMITS.barnPeak;
        if (r.value < lo || r.value > hi) return { problem: `${K.Words} for the ${w} ft wide barn: ${fmtIn(r.value)} is not between ${fmtIn(lo)} and ${fmtIn(hi)}.` };
        /* "08" and "8" are one width: never keep one and drop the other */
        if (own(out, String(+w))) return { problem: `${K.Words}: the ${+w} ft wide barn is listed twice.` };
        out[String(+w)] = r4(r.value);
      }
      const sorted = Object.keys(out).map(Number).sort((a, b) => a - b);
      for (let i = 1; i < sorted.length; i++) {
        if (out[sorted[i]] < out[sorted[i - 1]]) return { problem: `${K.Words}: the ${sorted[i]} ft wide barn (${fmtIn(out[sorted[i]])}) is lower than the ${sorted[i - 1]} ft wide barn (${fmtIn(out[sorted[i - 1]])}).` };
      }
      return { value: out };
    }
    case "ftList": {
      let list = input;
      if (text) list = input.split(/,|\band\b|\s+/i).map((x) => x.replace(/ft|feet|'/gi, "").trim()).filter(Boolean).map((x) => (/^\d+$/.test(x) ? +x : NaN));
      if (typeof list === "number") list = [list];
      if (!Array.isArray(list)) return { problem: `${K.Words}: write the lengths like 8 ft, 12 ft.` };
      if (list.length < 1 || list.length > 4) return { problem: `${K.Words}: list 1 to 4 lengths.` };
      const seen = new Set();
      for (const n of list) {
        if (!Number.isInteger(n)) return { problem: `${K.Words}: write each length in whole feet, like 8 ft.` };
        if (n < 4 || n > 20) return { problem: `${K.Words}: ${n} ft is not a length from 4 to 20 ft.` };
        if (seen.has(n)) return { problem: `${K.Words}: ${n} ft is listed twice.` };
        seen.add(n);
      }
      return { value: list.slice().sort((a, b) => a - b) };
    }
    case "side": {
      const s = clean(input);
      if (/^(door|doors|door side|front)$/.test(s)) return { value: "door" };
      if (/^(back|back side|rear)$/.test(s)) return { value: "back" };
      return { problem: `${K.Words}: pick the door side or the back side.` };
    }
  }
  return { problem: `${K.Words} could not be read.` };
}
function dym(word) {
  const c = closest(word, KNOB_IDS);
  return c ? `. Did you mean ${KNOB[c].words}?` : ".";
}

/* ------------------------------------------------------------------------ */
/* Writing a value the way a shed builder says it                            */

function fmtNum(v) { return String(Math.round(v * 1e4) / 1e4); }
/* inches -> "7 ft 9 1/2 in", "4 in", "4 ft", "1/2 in" (to the nearest 1/16) */
function fmtIn(inches) {
  const neg = inches < 0;
  let s16 = Math.round(Math.abs(inches) * 16);
  const ft = Math.floor(s16 / 192); s16 -= ft * 192;
  const whole = Math.floor(s16 / 16); let frac = s16 - whole * 16, den = 16;
  while (frac && frac % 2 === 0) { frac /= 2; den /= 2; }
  /* "1 ft 0 1/4 in", the way a tape is read, never "1 ft 1/4 in" */
  const inWords = whole && frac ? `${whole} ${frac}/${den}` : frac ? `${ft ? "0 " : ""}${frac}/${den}` : `${whole}`;
  const out = ft ? (whole || frac ? `${ft} ft ${inWords} in` : `${ft} ft`) : `${inWords} in`;
  return (neg ? "-" : "") + out;
}
function fmtFt(feet) { return fmtIn(feet * 12); }
/* inches only, the way door openings are said: "76 1/2 in" */
function fmtInOnly(inches) {
  const s16 = Math.round(Math.abs(inches) * 16);
  const whole = Math.floor(s16 / 16); let frac = s16 - whole * 16, den = 16;
  while (frac && frac % 2 === 0) { frac /= 2; den /= 2; }
  return (inches < 0 ? "-" : "") + (whole && frac ? `${whole} ${frac}/${den}` : frac ? `${frac}/${den}` : `${whole}`) + " in";
}
/* 5 -> "5/12", 5.25 -> "5 1/4/12"; a pitch between quarters (the library's
   6.48) is said the way a builder would: "about 6 1/2/12" */
function fmtPitch(p) {
  const q = Math.round(p * 4);
  const whole = Math.floor(q / 4), quarters = q - whole * 4;
  const f = quarters === 2 ? "1/2" : quarters ? `${quarters}/4` : "";
  const words = `${whole && f ? whole + " " + f : f || whole}/12`;
  return Math.abs(p * 4 - q) < 1e-6 ? words : `about ${words}`;
}
/* The same words for any length or pitch, so what other places say matches
   How it's built to the 1/16 in: the style reference facts Claude reads
   (tools/lib/style-facts.mjs). inchesWords(88.8125) -> "7 ft 4 13/16 in",
   pitchWords(6.48) -> "about 6 1/2/12". */
export const inchesWords = (inches) => fmtIn(+inches);
export const pitchWords = (p) => fmtPitch(+p);
function joinWords(list) { return list.length < 2 ? list.join("") : list.slice(0, -1).join(", ") + " and " + list[list.length - 1]; }
/* "Utility Shed and Side Utility", "Cabin, Garage and 6 more" */
export function namesWords(names) {
  return names.length <= 3 ? joinWords(names) : `${names.slice(0, 2).join(", ")} and ${names.length - 2} more`;
}
/* [{name, words}] -> [{words, names}] in first-seen order */
export function groupByWords(entries) {
  const out = [];
  for (const e of entries) {
    const g = out.find((x) => x.words === e.words);
    if (g) g.names.push(e.name); else out.push({ words: e.words, names: [e.name] });
  }
  return out;
}

export function format(id, value) {
  const K = KNOB[id];
  if (!K || value == null) return "";
  switch (K.unit) {
    case "pitch": return fmtPitch(+value);
    /* an eave that differs by width (a barn's): "1 3/4 in at 8 ft wide,
       1 15/16 in at 10 ft wide and 2 1/8 in at 12 ft wide" */
    case "in": return isObj(value) ? byWidthIn(value) : id === "doorHeight" ? fmtInOnly(+value) : fmtIn(+value);
    case "ft": return fmtFt(+value);
    case "byWidth": return Object.keys(value).map(Number).sort((a, b) => a - b).map((w) => `${w} ft wide: ${fmtIn(value[w])}`).join(", ");
    case "ftList": return joinWords(value.map((n) => `${n} ft`));
    case "side": return value === "back" ? "back side" : "door side";
  }
  return String(value);
}

function widthKeys(value) { return keysOf(value).map(Number).filter((w) => w > 0).sort((a, b) => a - b); }
function byWidthIn(value) {
  const ws = widthKeys(value), words = ws.map((w) => fmtIn(value[w]));
  return new Set(words).size === 1 ? words[0] : joinWords(ws.map((w, i) => `${words[i]} at ${w} ft wide`));
}
/* A number said short, for an empty box and the business-wide card: one
   that differs by width from the least to the most ("1 3/4 to 2 1/8 in"),
   anything else as format() says it. */
export function shortWords(id, value) {
  const K = KNOB[id];
  if (!K || K.unit !== "in" || !isObj(value)) return format(id, value);
  const vs = widthKeys(value).map((w) => +value[w]);
  if (!vs.length) return "";
  const lo = fmtIn(Math.min(...vs)), hi = fmtIn(Math.max(...vs));
  if (lo === hi) return lo;
  return / in$/.test(lo) && !/ ft/.test(lo) ? `${lo.slice(0, -3)} to ${hi}` : `${lo} to ${hi}`;
}

/* ------------------------------------------------------------------------ */
/* Where a style's number comes from                                         */

function styleName(settings, M, k) {
  const o = settings && settings.offer && settings.offer[k];
  const s = M && M.styles && M.styles[o && o.base != null ? o.base : k];
  return (isObj(o) && typeof o.name === "string" && o.name.trim()) || (s && s.name) || "building style";
}

/* The business-wide value for this knob on this style's roof, or undefined. */
function businessValue(biz, id, t) {
  const v = isObj(biz) ? biz[id] : undefined;
  if (v === undefined) return undefined;
  const K = KNOB[id];
  if (Array.isArray(K.business)) {
    if (!isObj(v)) return undefined;
    const kind = kindOf(t);
    const key = id === "doorHeight" ? (kind === "barn" ? "barn" : "other") : kind;
    return own(v, key) ? { value: v[key], key } : undefined;
  }
  return K.business ? { value: v, key: null } : undefined;
}
/* Does a style feature keep a business-wide number off this style? */
function feature(id, t) {
  if (id === "gableEndOverhang" && t.rakeOverhang != null) return "its flush gable end";
  if (id === "barnPeak" && t.gambrel) return "its own barn shoulders";
  if (id === "roofPitch" && t.dormer) return "its own main roof, which gives the dormer room";
  return null;
}
/* Does the business's own raw construction set this knob's path for this
   style's roof (so the shop standard does not reach it)? */
function rawSets(raw, id, t) {
  if (!isObj(raw)) return false;
  const kind = kindOf(t), sh = isObj(raw.roof) && isObj(raw.roof.shapes) ? raw.roof.shapes : {};
  const has = (o, k) => isObj(o) && own(o, k);
  switch (id) {
    case "roofPitch": return t.dormer ? has(raw.roof, "dormerRise") : has(sh[t.roof], "rise");
    case "barnPeak": return has(sh.gambrel, "peakIn") || has(sh.gambrel, "lowerRise") || has(sh.gambrel, "upperRise");
    case "eaveOverhang": return has(sh[t.roof], "eaveOverhang");
    case "gableEndOverhang": return kind === "barn" ? has(sh.gambrel, "endOverhang") : has(sh[t.roof], "rakeOverhang");
    case "doorHeight": return has(raw.openings, "doorHeightIn");
  }
  return false;
}

/* Every layer that has a value for knob id on offered style k, in order. */
function layersOf(settings, M, k, id) {
  const offer = (settings && settings.offer) || {};
  const o = offer[k];
  const base = isObj(o) && o.base != null ? o.base : k;
  const s = M.styles[base];
  const out = [];
  const ownB = isObj(o) && isObj(o.built) ? o.built : null;
  if (ownB && own(ownB, id)) out.push({ value: ownB[id], from: "this style", path: `offer.${k}.built.${id}` });
  if (base !== k && isObj(offer[base]) && isObj(offer[base].built) && own(offer[base].built, id)) {
    out.push({ value: offer[base].built[id], from: `built like ${styleName(settings, M, base)}`, path: `offer.${base}.built.${id}` });
  }
  const sb = isObj(s.built) && own(s.built, id) ? s.built[id] : undefined;
  const standard = sb !== undefined && !rawSets(settings && settings.construction, id, s);
  const bv = businessValue(settings && settings.built, id, s);
  if (bv) {
    const f = feature(id, s);
    /* a style feature keeps the business-wide number off; the shop
       standard's own number for that style (the Dormer Shed's 7/12 main
       roof) still holds, so the feature only stands in when there is none */
    if (!f) out.push({ value: bv.value, from: "business-wide", path: `built.${id}${bv.key ? "." + bv.key : ""}` });
    else if (!standard) out.push({ feature: f, from: "style feature" });
  }
  if (standard) out.push({ value: sb, from: "standard", path: `styles.${base}.built.${id}` });
  return id === "barnPeak" ? byWidthFirst(out) : out;
}
/* Barn roof heights are kept width by width (review W1): each width takes
   the first layer that names it, so a height typed for 10 ft wide keeps the
   shop's 8 and 12 ft heights (an empty box really is the standard). The
   joined list goes first, `parts` saying where each width came from; the
   layers stay behind it for when the joined list cannot be used. */
function byWidthFirst(layers) {
  const values = [];
  for (const l of layers) { if (l.feature) break; values.push(l); }
  if (values.length < 2 || !values.every((l) => isObj(l.value) && !parse("barnPeak", l.value).problem)) return layers;
  const value = {}, parts = {};
  for (const l of values) {
    for (const w of keysOf(l.value)) {
      const key = /^\d{1,2}$/.test(w) ? String(+w) : w;
      if (own(value, key)) continue;
      value[key] = l.value[w]; parts[key] = l.from;
    }
  }
  if (new Set(Object.values(parts)).size < 2) return layers;
  return [{ value, from: values[0].from, path: values[0].path, parts }, ...layers];
}

/* A size as a person reads it: the key "10x20" written 10×20 (model/
   style-check.js sizeWords, which reads this file, says the same). */
const sizeWords = (z) => String(z).replace("x", "×");

/* A value checked for this style: -> { value } or { problem }. */
function checkFor(id, value, s, name, sizes) {
  const r = parse(id, value, { kind: kindOf(s), metal: !!s.metal, name });
  if (r.problem) return r;
  if (id === "porchDepth") {
    const d = r.value, Ws = sizes.map((z) => +String(z).split("x")[0]).filter((n) => n > 0), Ls = sizes.map((z) => +String(z).split("x")[1]).filter((n) => n > 0);
    if (s.porch === "F" && Ls.length && Math.min(...Ls) - d < 4) return { problem: `Porch depth ${fmtFt(d)} leaves the ${Math.min(...Ls)} ft long ${name} less than 4 ft of room inside.` };
    if (s.porch === "S" && Ws.length && Math.min(...Ws) - d < 4) return { problem: `Porch depth ${fmtFt(d)} leaves the ${Math.min(...Ws)} ft wide ${name} less than 4 ft of room inside.` };
    if (s.porch === "C" && Ws.length) {
      const W = Math.min(...Ws), most = Math.min(7, W - 6);
      if (d > most) return { problem: `Porch depth ${fmtFt(d)} leaves the ${W} ft wide ${name} no angled wall: ${fmtFt(Math.max(most, 0))} at most.` };
    }
  }
  if (id === "sidePorchLengths") {
    const bad = porchMisfit(r.value, sizes);
    if (bad) return { problem: bad.left <= 0
      ? `Side porch lengths: ${bad.n} ft is ${bad.left < 0 ? "longer than" : "as long as"} the ${sizeWords(bad.z)} ${name}. Leave at least ${fmtFt(SIDE_WALL_MIN_FT)} of side wall beside the porch.`
      : `Side porch lengths: ${bad.n} ft leaves the ${sizeWords(bad.z)} ${name} only ${fmtFt(bad.left)} of side wall beside the porch (${fmtFt(SIDE_WALL_MIN_FT)} at least).` };
  }
  return r;
}

/* The first side porch length that leaves less than 4 ft of side wall on a
   size it is offered on -- the shortest on every size, the others from 20 ft
   long (model/frame.js sidePorchLengthsFor) -- or null. A porch as long as
   the building cannot be framed. -> {n, z, left} */
function porchMisfit(list, sizes) {
  const sold = sizes.map((z) => ({ z: String(z), L: +String(z).split("x")[1] })).filter((x) => x.L > 0).sort((a, b) => a.L - b.L);
  for (const n of list) {
    const bad = sold.find((x) => (n === list[0] || x.L >= 20) && x.L - n < SIDE_WALL_MIN_FT - 1e-9);
    if (bad) return { n, z: bad.z, left: bad.L - n };
  }
  return null;
}

/* ------------------------------------------------------------------------ */
/* Problems                                                                  */

/* Every problem with the business's "How it's built" settings, in words:
   [{path, knob, style, words}]. Never run when a price list is READ (model/
   company.js strictProblems; a save refuses only new ones). */
export function problems(settings, manufacturer) {
  const out = [];
  const S = settings || {}, M = manufacturer || {}, styles = M.styles || {};
  const offer = isObj(S.offer) ? S.offer : {};
  const say = (path, knob, style, words) => { if (!out.some((p) => p.path === path && p.words === words)) out.push({ path, knob, style, words }); };
  const offered = keysOf(offer).filter((k) => isObj(offer[k]) && styles[offer[k].base != null ? offer[k].base : k]);

  /* business-wide */
  if (S.built !== undefined) {
    if (!isObj(S.built)) say("built", null, null, "How it's built could not be read. Reload the page and try again.");
    else for (const id of Object.keys(S.built)) {
      if (id.startsWith("_")) continue;
      const K = KNOB[id], at = `built.${id}`, v = S.built[id];
      if (!K) { say(at, null, null, `"${id}" is not a building setting${dym(id)}`); continue; }
      if (!K.business) { say(at, id, null, `${K.Words} is set on each style, not for the whole business: a utility wall and a lofted wall are different walls.`); continue; }
      if (Array.isArray(K.business)) {
        if (!isObj(v)) { say(at, id, null, `${K.Words}: give one for each roof kind (${joinWords(K.business.map((k) => KIND_WORDS[k]))}).`); continue; }
        for (const kind of Object.keys(v)) {
          if (kind.startsWith("_")) continue;
          if (K.business.indexOf(kind) < 0) { const c = closest(kind, K.business); say(`${at}.${kind}`, id, null, `${K.Words}: "${kind}" is not a roof kind${c ? `. Did you mean ${c}?` : ` (use ${K.business.join(", ")}).`}`); continue; }
          const r = parse(id, v[kind], { kind: id === "doorHeight" ? null : kind });
          if (r.problem) say(`${at}.${kind}`, id, null, r.problem);
        }
      } else {
        const r = parse(id, v, {});
        if (r.problem) say(at, id, null, r.problem);
      }
    }
  }

  /* each offered style's own */
  for (const k of offered) {
    const o = offer[k], base = o.base != null ? o.base : k, s = styles[base], name = styleName(S, M, k);
    if (o.built === undefined) continue;
    const at = `offer.${k}.built`;
    if (!isObj(o.built)) { say(at, null, k, `How the ${name} is built could not be read. Reload the page and try again.`); continue; }
    const applies = knobsFor(s);
    for (const id of Object.keys(o.built)) {
      if (id.startsWith("_")) continue;
      if (!KNOB[id]) { say(`${at}.${id}`, null, k, `"${id}" is not a building setting${dym(id)}`); continue; }
      if (applies.indexOf(id) < 0) { say(`${at}.${id}`, id, k, notApplying(id, name, s)); continue; }
      const r = checkFor(id, o.built[id], s, name, keysOf(o.sizes));
      if (r.problem) say(`${at}.${id}`, id, k, r.problem);
    }
  }

  /* what each style ends up with: a value from another layer that does not
     fit this style's sizes (a business-wide porch depth on a narrow cabin) */
  for (const k of offered) {
    const o = offer[k], base = o.base != null ? o.base : k, s = styles[base], name = styleName(S, M, k);
    for (const id of knobsFor(s)) {
      const layers = layersOf(S, M, k, id);
      /* barn heights joined width by width: a 10 ft height of the style's
         own taller than the standard's 12 ft is said, never quietly
         dropped for the standard */
      if (layers[0] && layers[0].parts && layers[0].path && !layers[0].path.startsWith("styles.")) {
        const r = checkFor(id, layers[0].value, s, name, keysOf(o.sizes));
        if (r.problem) { say(layers[0].path, id, k, joinedPeakWords(layers[0]) || r.problem); continue; }
      }
      const win = layers.find((l) => !l.feature && !parse(id, l.value, { kind: kindOf(s), metal: !!s.metal }).problem);
      if (win && win.path === `offer.${k}.built.${id}`) continue;
      /* the standard side porch lengths still have to fit the sizes sold (a
         10x8 Side Cabin is too short for its 8 ft porch) */
      if ((!win || win.from === "standard") && id === "sidePorchLengths") {
        const r = parse(id, win ? win.value : (s.sidePorch && Array.isArray(s.sidePorch.lengthsFt) ? s.sidePorch.lengthsFt : SIDE_PORCH_LENGTHS.slice()), {});
        const bad = r.value ? porchMisfit(r.value, keysOf(o.sizes)) : null;
        if (bad) say(`offer.${k}.built.${id}`, id, k, `The ${sizeWords(bad.z)} ${name} is too short for its ${bad.n} ft side porch: sell it ${bad.n + SIDE_WALL_MIN_FT} ft long and up, or set a shorter side porch length.`);
        continue;
      }
      if (!win || win.from === "standard") continue;
      const r = checkFor(id, win.value, s, name, keysOf(o.sizes));
      if (r.problem) say(win.path, id, k, r.problem);
    }
  }

  /* set twice: raw construction on a knob's own path */
  out.push(...rawKnobProblems(S));
  return out;
}

/* "Barn roof height: the 12 ft wide barn (4 ft 3 in, the standard) would
   be lower than the 10 ft wide barn (5 ft). Type a height for the 12 ft
   wide barn too." -- for barn heights joined width by width. */
function joinedPeakWords(layer) {
  const v = layer.value, parts = layer.parts || {};
  const ws = Object.keys(v).map(Number).sort((a, b) => a - b);
  const whose = (w) => (parts[w] === layer.from ? "" : `, ${parts[w] === "standard" ? "the standard" : parts[w]}`);
  for (let i = 1; i < ws.length; i++) {
    const lo = ws[i], hi = ws[i - 1];
    if (!(v[lo] < v[hi])) continue;
    const other = parts[lo] !== layer.from ? lo : hi;
    return `Barn roof height: the ${lo} ft wide barn (${fmtIn(v[lo])}${whose(lo)}) would be lower than the ${hi} ft wide barn (${fmtIn(v[hi])}${whose(hi)}). Type a height for the ${other} ft wide barn too.`;
  }
  return null;
}

/* A raw construction value on a path a knob owns. */
function rawKnobProblems(S) {
  const out = [];
  const raw = isObj(S.construction) ? S.construction : null;
  if (!raw) return out;
  const builtSets = (id) => (isObj(S.built) && own(S.built, id)) || keysOf(S.offer).some((k) => isObj(S.offer[k]) && isObj(S.offer[k].built) && own(S.offer[k].built, id));
  for (const id of Object.keys(KNOB_PATHS)) {
    for (const p of KNOB_PATHS[id]) {
      const bits = p.split(".");
      let v = raw;
      for (const b of bits) v = isObj(v) ? v[b] : undefined;
      if (v === undefined) continue;
      out.push({ path: `construction.${p}`, knob: id, style: null,
        words: builtSets(id) ? `The construction settings hold the ${KNOB[id].words} too. Set it in How it's built only.` : `The construction settings hold the ${KNOB[id].words}. Set it in How it's built instead.` });
    }
  }
  return out;
}

/* What a library style's built block may hold besides the knobs: the shop
   standard's own door at some sizes (standardSwaps, model/loadouts.js). A
   business's offer.<KEY>.built may not (problems: "not a building setting"). */
export const LIBRARY_ONLY = Object.freeze(["standardSwaps"]);

/* The same checks for the shop standard in a manufacturer file
   (styles.<KEY>.built): -> ["styles.LB.built.wallHeight: ..."] */
export function libraryProblems(manufacturer) {
  const out = [];
  const styles = (manufacturer && manufacturer.styles) || {};
  for (const k of keysOf(styles)) {
    const s = styles[k];
    if (!isObj(s) || s.built === undefined) continue;
    const at = `styles.${k}.built`;
    if (!isObj(s.built)) { out.push(`${at}: must be {"wallHeight": 93.5, ...}.`); continue; }
    const applies = knobsFor(s);
    for (const id of Object.keys(s.built)) {
      if (id.startsWith("_")) continue;
      /* the shop standard's own doors at some sizes: library-only, never a
         knob (model/company.js validateManufacturer checks it) */
      if (LIBRARY_ONLY.indexOf(id) >= 0) continue;
      if (!KNOB[id]) { out.push(`${at}.${id}: "${id}" is not a building setting${dym(id)}`); continue; }
      if (applies.indexOf(id) < 0) { out.push(`${at}.${id}: ${notApplying(id, s.name || k, s)}`); continue; }
      const r = parse(id, s.built[id], { kind: kindOf(s), metal: !!s.metal, name: s.name });
      if (r.problem) out.push(`${at}.${id}: ${r.problem}`);
    }
  }
  return out;
}

/* An extra's built (options.extras[i].built): only the knobs an extra may
   hold, each within its widest limits. -> [{path, words}] */
export function extraProblems(built, at, name) {
  const out = [];
  if (built === undefined) return out;
  if (!isObj(built)) return [{ path: at, words: `${name || "An extra"}: how it changes the building could not be read.` }];
  for (const id of Object.keys(built)) {
    if (id.startsWith("_")) continue;
    const K = KNOB[id];
    if (!K) { out.push({ path: `${at}.${id}`, words: `"${id}" is not a building setting${dym(id)}` }); continue; }
    if (!K.inExtra) { out.push({ path: `${at}.${id}`, words: `An extra cannot change the ${K.words}. Set it on the style in How it's built.` }); continue; }
    const r = parse(id, built[id], { kind: id === "eaveOverhang" ? "gable" : id === "roofPitch" ? "gable" : null });
    if (r.problem) out.push({ path: `${at}.${id}`, words: r.problem });
  }
  return out;
}

/* ------------------------------------------------------------------------ */
/* Applying the numbers                                                      */

function setPath(tree, path, value) {
  const bits = path.split(".");
  let o = tree;
  for (let i = 0; i < bits.length - 1; i++) { if (!isObj(o[bits[i]])) o[bits[i]] = {}; o = o[bits[i]]; }
  o[bits[bits.length - 1]] = value;
}

/* One knob's value -> traits and construction for a style with traits t. */
function mapKnob(id, v, t, res) {
  const kind = kindOf(t);
  switch (id) {
    case "roofPitch":
      if (t.dormer) setPath(res.construction, "roof.dormerRise", { w: v / 24 });
      else if (kind === "gable") setPath(res.construction, "roof.shapes.gable.rise", { w: v / 24 });
      else if (kind === "lean" || kind === "slope") setPath(res.construction, `roof.shapes.${kind}.rise`, { w: v / 12 });
      return;
    case "barnPeak": setPath(res.construction, "roof.shapes.gambrel.peakIn", copy(v)); return;
    case "eaveOverhang": setPath(res.construction, `roof.shapes.${t.roof}.eaveOverhang`, { left: { flatIn: v }, right: { flatIn: v } }); return;
    case "gableEndOverhang":
      if (kind === "barn") setPath(res.construction, "roof.shapes.gambrel.endOverhang", v / 12);
      else { setPath(res.construction, `roof.shapes.${t.roof}.rakeOverhang`, v / 12); if (t.rakeOverhang != null) res.drop.push("rakeOverhang"); }
      return;
    case "wallHeight": res.traits.wallH = v / 12; return;
    case "doorHeight": setPath(res.construction, "openings.doorHeightIn", v); return;
    case "porchDepth": res.traits.porchDepthFt = v; return;
    case "sidePorchLengths": res.traits.sidePorch = { lengthsFt: v.slice() }; return;
    case "dormerSide": res.traits.dormerSide = v; return;
  }
}

/* For every offered style: the traits to set, the traits to drop, the
   construction overlay (plain values, no rule lists) and where each knob's
   number came from. A bad value is skipped -- the next layer is used -- and
   said in warnings (the owner sees them; the designer and quotes never fail
   on them). -> { styles: {KEY: {traits, drop, construction, built}}, warnings } */
export function apply(settings, manufacturer, library) {
  const S = settings || {}, M = manufacturer || {}, styles = M.styles || {};
  const out = { styles: {}, warnings: [] };
  const offer = isObj(S.offer) ? S.offer : {};
  for (const k of keysOf(offer)) {
    const o = offer[k];
    if (!isObj(o)) continue;
    const base = o.base != null ? o.base : k, s = styles[base];
    if (!s) continue;
    const name = styleName(S, M, k);
    const res = { traits: {}, drop: [], construction: {}, built: {} };
    for (const id of knobsFor(s)) {
      const layers = layersOf(S, M, k, id);
      const unusable = [];
      for (const l of layers) {
        if (l.feature) { res.built[id] = { from: "style feature", feature: l.feature }; break; }
        const r = checkFor(id, l.value, s, name, keysOf(o.sizes));
        /* the joined barn heights failing is said by the layer it came from */
        if (r.problem) {
          /* "Roof pitch "5\12" cannot be read: write it like 5/12." -- what was typed */
          const K = KNOB[id], lead = `${K.Words}: `;
          if (!l.parts) unusable.push(typeof l.value === "string" && r.problem.startsWith(lead) ? `${K.Words} "${l.value}" cannot be read: ${r.problem.slice(lead.length)}` : r.problem);
          continue;
        }
        mapKnob(id, r.value, s, res);
        res.built[id] = l.parts ? { value: r.value, from: l.from, parts: l.parts } : { value: r.value, from: l.from };
        break;
      }
      if (!res.built[id] && rawSets(S.construction, id, s)) res.built[id] = { from: "your construction settings" };
      /* a number that cannot be used: say it, and the number built instead
         and where it comes from (review W5) */
      if (unusable.length) {
        const b = res.built[id];
        let used = b && b.value !== undefined ? format(id, b.value) : "";
        if (!used && !(b && b.feature)) {
          /* with this style's other numbers (its barn roof heights move
             the slope its eave is measured on) */
          const v = plainValue(id, s, mergeTwo(mergeTwo(mergeTwo(baseOf(library), M.construction || {}), S.construction || {}), res.construction), keysOf(o.sizes));
          used = v !== undefined ? format(id, v) : "";
        }
        const from = !b || b.from === "standard" || b.from === "library" ? "the standard"
          : b.from === "business-wide" ? "your number for the whole business"
            : b.from === "style feature" ? b.feature
              : b.from === "your construction settings" ? "your construction settings"
                : b.from.replace(/^built like /, "built like the ");
        for (const p of unusable) out.warnings.push(`${name}: ${p} Until it is fixed in How it's built, it is built ${used ? `at ${used} (${from})` : `with ${from}`}.`);
      }
    }
    out.styles[k] = res;
  }
  out.warnings = [...new Set(out.warnings)];
  return out;
}

/* An extra's built, for one style t: -> { tree, atLeast: [paths] } or null
   when none of its numbers reaches this style. Its roof pitch counts only
   when steeper ("at least this steep", model/construction.js constructionFor);
   its other numbers replace the style's. A number outside this style's own
   limits (a 7/12 pitch on a lean-to) leaves that style alone. */
export function optionEffectFor(built, t) {
  if (!isObj(built) || !t) return null;
  const res = { traits: {}, drop: [], construction: {}, built: {} };
  const atLeast = [];
  const applies = knobsFor(t);
  for (const id of Object.keys(built)) {
    const K = KNOB[id];
    if (!K || !K.inExtra || applies.indexOf(id) < 0) continue;
    const r = parse(id, built[id], { kind: kindOf(t), metal: !!t.metal });
    if (r.problem) continue;
    mapKnob(id, r.value, t, res);
    if (id === "roofPitch") atLeast.push(t.dormer ? "roof.dormerRise" : `roof.shapes.${t.roof}.rise`);
  }
  return keysOf(res.construction).length ? { tree: res.construction, atLeast } : null;
}

/* ------------------------------------------------------------------------ */
/* What a style has, for the screens                                         */

/* -> [{id, value, words, from}] for every knob that applies to style key,
   from a resolved catalogue (model/company.js resolve). from: "this style",
   "built like <name>", "business-wide", "standard", "style feature", "your
   construction settings" or "library". */
export function effective(cat, key) {
  const t = cat && cat.TYPES && cat.TYPES[key];
  if (!t) return [];
  const sizes = Object.keys((cat.P && cat.P[key]) || {});
  return rowsFor(t, t.built, mergeTwo(cat.construction || {}, t.construction || {}), sizes);
}

/* Every knob of a style with traits t: its number (where a layer gave one,
   else read off the drawing's own numbers), in words, and where it came
   from (built: what apply() found). merged: the construction it is drawn
   with. */
function rowsFor(t, built, merged, sizes) {
  const out = [];
  for (const id of knobsFor(t)) {
    const b = (built && built[id]) || { from: "library" };
    let value = b.value !== undefined ? b.value : plainValue(id, t, merged, sizes);
    /* barn heights at every width sold, as drawn: a width no number names
       (the Lofted Barn's 14 ft) shows the height it is built at (review W6) */
    if (id === "barnPeak" && isObj(value) && b.value !== undefined && sizes.length) {
      const drawn = plainValue(id, t, merged, sizes);
      if (isObj(drawn)) value = Object.assign({}, drawn, Object.fromEntries(Object.keys(value).filter((w) => own(drawn, w)).map((w) => [w, value[w]])));
    }
    out.push({ id, value, words: value === undefined ? "" : format(id, value), from: b.from, feature: b.feature });
  }
  return out;
}

/* The widths a style they don't sell is read at (libraryNumbers): the
   widths a shop sells most, and a porch style from 10 ft wide (a 4 ft wrap
   porch needs 10). 20 ft long. */
const READ_WIDTHS = [8, 10, 12, 14];
function readSizes(t) {
  const ws = t.porch === "S" || t.porch === "C" ? READ_WIDTHS.filter((w) => w >= 10) : READ_WIDTHS;
  return ws.map((w) => `${w}x20`);
}

/* Every knob of every style in the builder's library, for one business:
   what each is built with NOW (their own numbers for that style, their
   numbers for the whole business, the shop standard, the library; a style
   they don't sell as it would be if they sold it) and what the STANDARD
   building has (none of the business's own numbers, nor its construction
   settings). Read at the sizes they sell, or, for a style they don't sell,
   8 to 14 ft wide (READ_WIDTHS). For Barnwright's door (server/office/
   setup-view.js, read part "library"), so Claude can compare a dealer's
   building in a photo with the drawing: roof pitch, barn roof height,
   walls, doors. -> {KEY: [{id, now, standard, from, feature}]}, now and
   standard as effective() gives them ({value, words}). Never fails: a
   style that can't be read is left out. */
export function libraryNumbers(settings, manufacturer, library) {
  const M = manufacturer || {}, styles = M.styles || {};
  const S = copy(liftRawRules(settings || {}, M).settings) || {};
  S.offer = isObj(S.offer) ? S.offer : {};
  const sizesOf = {};
  for (const k of keysOf(styles)) {
    if (!isObj(styles[k])) continue;
    if (isObj(S.offer[k])) { sizesOf[k] = keysOf(S.offer[k].sizes); continue; }
    sizesOf[k] = readSizes(styles[k]);
    S.offer[k] = { sizes: Object.fromEntries(sizesOf[k].map((z) => [z, 1])) };
  }
  /* the standard: no number of the business's own, nor its construction settings */
  const std = copy(S);
  delete std.built;
  delete std.construction;
  for (const k of keysOf(std.offer)) if (isObj(std.offer[k])) delete std.offer[k].built;
  const read = (X) => {
    const applied = apply(X, M, library).styles;
    const base = mergeTwo(mergeTwo(baseOf(library), M.construction || {}), X.construction || {});
    const out = {};
    for (const k of Object.keys(sizesOf)) {
      const a = applied[k];
      if (!a) continue;
      try {
        const t = Object.assign({}, styles[k], copy(a.traits));
        for (const f of a.drop) delete t[f];
        out[k] = rowsFor(t, a.built, mergeTwo(base, a.construction), sizesOf[k]);
      } catch (e) { /* left out */ }
    }
    return out;
  };
  const now = read(S), was = read(std);
  const out = {};
  for (const k of Object.keys(now)) {
    if (!was[k]) continue;
    out[k] = now[k].map((r) => {
      const st = was[k].find((x) => x.id === r.id) || { value: undefined, words: "" };
      return { id: r.id, now: { value: r.value, words: r.words }, standard: { value: st.value, words: st.words }, from: r.from, feature: r.feature };
    });
  }
  return out;
}

/* The number a style has with no How it's built setting: read off its
   traits and its construction (merged: library < manufacturer < company). */
function plainValue(id, t, merged, sizes) {
  const W0 = sizes.length ? +String(sizes[0]).split("x")[0] : 10;
  const roofOf = (r) => (merged.roof && merged.roof.shapes && merged.roof.shapes[r]) || DEFAULT_ROOF.shapes[r] || {};
  const settle = (v) => (Array.isArray(v) ? (v.find((r) => !r.when) || v[v.length - 1] || {}).value : v);
  try {
    switch (id) {
      case "roofPitch": {
        const rise = settle(t.dormer ? (merged.roof && merged.roof.dormerRise) || DEFAULT_ROOF.dormerRise : roofOf(t.roof).rise);
        const run = t.roof === "gable" ? W0 / 2 : W0;
        return r4(lengthOfFt(rise, W0) / run * 12);
      }
      case "barnPeak": {
        /* what is drawn at each width sold: the trusses' peak above the wall
           (model/roof-shapes.js barnTrussPeakFt), as a builder measures it */
        const value = {};
        for (const z of sizes) {
          const W = +String(z).split("x")[0];
          if (value[W] !== undefined) continue;
          value[W] = r4(barnTrussPeakFt(W, t, settledAt(merged, W, t)) * 12);
        }
        return value;
      }
      case "eaveOverhang": {
        const sh = Object.assign({}, roofOf(t.roof), t.roof === "gambrel" ? t.gambrel || {} : {});
        const eo = settle(sh.eaveOverhang) || {}, e = settle(eo.right);
        if (e && typeof e === "object" && e.flatIn != null) return e.flatIn;
        /* an eave given along the slope, measured level on the slope that is
           drawn at each width sold (round 2 review): a barn's lower slope
           changes with its height (the shop's barn roof heights, the
           Standard Barn's own shoulders), and a dormer style's main roof has
           its own rise (roof.dormerRise). One number when every width has
           the same to the 1/16 in; else the reach width by width
           ({"8": 1.6957, "10": 1.9059, "12": 2.1151}, the Metal Lofted
           Barn). */
        const value = {};
        for (const W of widthsOf(sizes)) {
          const c = settledAt(merged, W, t);
          const P = roofProfile(W, 0, t, c), a = P[P.length - 2], b = P[P.length - 1];
          const run = b[0] - a[0], rise = a[1] - b[1];
          const ev = settle((roofShape(t, c).eaveOverhang || {}).right);
          value[W] = r4(isObj(ev) && ev.flatIn != null ? ev.flatIn : lengthOfFt(ev, W) * 12 * run / Math.hypot(run, rise));
        }
        const ws = Object.keys(value);
        return new Set(ws.map((w) => Math.round(value[w] * 16))).size === 1 ? value[ws[0]] : value;
      }
      case "gableEndOverhang": {
        const sh = roofOf(t.roof);
        return r4((t.roof === "gambrel" ? (settle(sh.endOverhang) != null ? settle(sh.endOverhang) : 0.10) : (t.rakeOverhang != null ? t.rakeOverhang : settle(sh.rakeOverhang))) * 12);
      }
      case "wallHeight": return r4(t.wallH * 12);
      case "doorHeight": {
        const o = (merged.openings && settle(merged.openings.doorHeightIn)) || { gambrel: 71.5, other: 76.5 };
        return typeof o === "number" ? o : (o[t.roof] != null ? o[t.roof] : o.other);
      }
      case "porchDepth": return typeof t.porchDepthFt === "number" ? t.porchDepthFt : 4;
      case "sidePorchLengths": return t.sidePorch && Array.isArray(t.sidePorch.lengthsFt) ? t.sidePorch.lengthsFt.slice() : [8, 12];
      case "dormerSide": return t.dormerSide || "door";
    }
  } catch (e) { return undefined; }
  return undefined;
}
/* What a style's numbers are read against: the builder's library
   (library/construction.json) when it is given -- it says a metal building's
   roofing lies on purlins, which sets how high a barn roof's line stands
   over its trusses and so the slope its eave is measured on -- else
   Barnwright's roof numbers alone. */
function baseOf(library) {
  return isObj(library) ? mergeTwo({ roof: DEFAULT_ROOF }, library) : { roof: DEFAULT_ROOF };
}
/* The widths a list of sizes is sold in ("10x16" -> 10), or 10 ft wide
   when there are none. */
function widthsOf(sizes) {
  const ws = [...new Set(sizes.map((z) => +String(z).split("x")[0]).filter((w) => w > 0))];
  return ws.length ? ws : [10];
}
/* The construction settled for a building this wide (rule lists picked). */
function settledAt(merged, W, t) {
  try { return resolveConstruction(merged, buildingFacts(t.base || null, t, { W, L: 16 })); } catch (e) { return merged; }
}
function mergeTwo(a, b) {
  if (!isObj(b)) return b === undefined ? a : b;
  const out = isObj(a) ? Object.assign({}, a) : {};
  for (const k of Object.keys(b)) out[k] = isObj(b[k]) && isObj(out[k]) ? mergeTwo(out[k], b[k]) : b[k];
  return out;
}

/* Which offered styles a business-wide number reaches, for the Dealer
   Center's "How your buildings are built" card: id is the knob, kind the
   roof kind it is kept by ("gable", "lean", "slope", "barn"; door height
   "barn" or "other"; omitted for a knob kept once for the whole business).
   -> {reaches: [KEY], own: [KEY] (a number of their own wins), kept:
   [{key, feature}] (a style feature keeps it off)} */
export function businessReach(settings, manufacturer, id, kind) {
  const out = { reaches: [], own: [], kept: [] };
  const K = KNOB[id];
  if (!K || !K.business) return out;
  const S = settings || {}, styles = (manufacturer && manufacturer.styles) || {};
  const offer = isObj(S.offer) ? S.offer : {};
  for (const k of keysOf(offer)) {
    const o = offer[k];
    if (!isObj(o)) continue;
    const base = o.base != null ? o.base : k, s = styles[base];
    if (!s || knobsFor(s).indexOf(id) < 0) continue;
    if (Array.isArray(K.business)) {
      const sk = kindOf(s);
      if ((id === "doorHeight" ? (sk === "barn" ? "barn" : "other") : sk) !== kind) continue;
    }
    const f = feature(id, s);
    if (f) { out.kept.push({ key: k, feature: f }); continue; }
    const mine = isObj(o.built) && own(o.built, id);
    const like = base !== k && isObj(offer[base]) && isObj(offer[base].built) && own(offer[base].built, id);
    (mine || like ? out.own : out.reaches).push(k);
  }
  return out;
}

/* Each How it's built number stored as the number it reads as: a pitch
   sent as "5/12" is kept as 5, a barn width "08" as "8" (review F9), so the
   same number never reads as a change and the stored price list holds
   numbers, as the contract says. A value that cannot be read is left as
   sent, for problems() to refuse in words. -> a new copy, or the same
   object when every value already is its number. */
export function tidyBuilt(settings, manufacturer) {
  const S = settings || {}, styles = (manufacturer && manufacturer.styles) || {};
  let out = null;
  const edit = () => (out = out || copy(S));
  const tidy = (v, id, ctx) => {
    const r = parse(id, v, ctx);
    return r.problem || r.value === undefined || same(r.value, v) ? undefined : r.value;
  };
  if (isObj(S.built)) for (const id of keysOf(S.built)) {
    const K = KNOB[id];
    if (!K || !K.business) continue;
    if (Array.isArray(K.business)) {
      if (!isObj(S.built[id])) continue;
      for (const kind of keysOf(S.built[id])) {
        if (K.business.indexOf(kind) < 0) continue;
        const v = tidy(S.built[id][kind], id, { kind: id === "doorHeight" ? null : kind });
        if (v !== undefined) edit().built[id][kind] = v;
      }
    } else {
      const v = tidy(S.built[id], id, {});
      if (v !== undefined) edit().built[id] = v;
    }
  }
  for (const k of keysOf(S.offer)) {
    const o = S.offer[k];
    if (!isObj(o) || !isObj(o.built)) continue;
    const s = styles[o.base != null ? o.base : k];
    if (!s) continue;
    for (const id of keysOf(o.built)) {
      if (!KNOB[id]) continue;
      const v = tidy(o.built[id], id, { kind: kindOf(s), metal: !!s.metal, name: s.name });
      if (v !== undefined) edit().offer[k].built[id] = v;
    }
  }
  const xs = isObj(S.options) && Array.isArray(S.options.extras) ? S.options.extras : [];
  xs.forEach((x, i) => {
    if (!isObj(x) || !isObj(x.built)) return;
    for (const id of keysOf(x.built)) {
      if (!KNOB[id]) continue;
      const v = tidy(x.built[id], id, {});
      if (v !== undefined) edit().options.extras[i].built[id] = v;
    }
  });
  return out || S;
}

/* An option's roof pitch that changes nothing on a building it is offered
   on (review W2), one line per option: "Steep roof does not change the
   Lofted Barn (it has a barn roof), the Backyard Utility (its lean-to roof
   can be 6/12 at most) or the Dormer Shed (its roof is already about
   7 1/4/12)." A customer would pay for nothing there.
   -> [{key, index (its place in options.extras), name, styles: [KEY], words}] */
export function extrasThatChangeNothing(settings, manufacturer) {
  const out = [];
  const M = manufacturer || {}, styles = M.styles || {};
  const S = liftRawRules(settings || {}, M).settings;
  const xs = isObj(S.options) && Array.isArray(S.options.extras) ? S.options.extras : [];
  if (!xs.some((x) => isObj(x) && isObj(x.built) && x.built.roofPitch !== undefined)) return out;
  const applied = apply(S, M).styles;
  const merged = mergeTwo(mergeTwo({ roof: DEFAULT_ROOF }, M.construction || {}), S.construction || {});
  const ONE = { lean: "lean-to roof", slope: "single slope roof", gable: "roof" };
  for (const [index, x] of xs.entries()) {
    if (!isObj(x) || !isObj(x.built) || x.built.roofPitch === undefined) continue;
    const r = parse("roofPitch", x.built.roofPitch, {});
    if (r.problem) continue;
    const p = r.value, misses = [];
    for (const k of keysOf(S.offer)) {
      const o = S.offer[k];
      if (!isObj(o)) continue;
      const base = o.base != null ? o.base : k, t = styles[base];
      if (!t) continue;
      if (Array.isArray(x.styles) && x.styles.indexOf(k) < 0 && x.styles.indexOf(base) < 0) continue;
      const kind = kindOf(t);
      let why = null;
      if (kind === "barn") why = "it has a barn roof";
      else if (kind === "salt") why = "it has a saltbox roof";
      else {
        const hi = pitchLimits(kind, !!t.metal)[1];
        if (p > hi + 1e-9) why = `its ${ONE[kind] || "roof"} can be ${format("roofPitch", hi)} at most`;
        else {
          const b = applied[k] && applied[k].built.roofPitch;
          const now = b && b.value !== undefined ? b.value : plainValue("roofPitch", t, merged, keysOf(o.sizes));
          if (now !== undefined && now >= p - 1e-6) why = `its roof is already ${format("roofPitch", now)}`;
        }
      }
      if (why) misses.push({ key: k, words: `the ${styleName(S, M, k)} (${why})` });
    }
    if (!misses.length) continue;
    const list = misses.map((m) => m.words);
    const name = typeof x.name === "string" && x.name.trim() ? x.name.trim() : "This option";
    out.push({ key: x.key, index, name, styles: misses.map((m) => m.key),
      words: `${name} does not change ${list.length < 2 ? list[0] : list.slice(0, -1).join(", ") + " or " + list[list.length - 1]}. A customer would pay for nothing there.` });
  }
  return out;
}

/* The roof kind of a style, in the words the knobs use: "gable", "lean",
   "slope", "barn" or "salt". */
export function roofKindOf(t) { return kindOf(t); }

/* ------------------------------------------------------------------------ */
/* History words                                                             */

/* -> ["Lofted Barn wall height: 6 ft 8 in → 7 ft", "Business-wide roof pitch
   for gable roofs: standard → 6/12"]. Raw rule lists moved by liftRawRules
   are compared after the move, so they say nothing. */
export function describeChanges(before, after, manufacturer, library) {
  const out = [];
  const M = manufacturer || {};
  const b = liftRawRules(before || {}, M).settings, a = liftRawRules(after || {}, M).settings;
  const bb = isObj(b.built) ? b.built : {}, ab = isObj(a.built) ? a.built : {};
  const shownBiz = (id, v) => {
    if (v === undefined) return "standard";
    const r = parse(id, v, {});
    return r.value !== undefined ? format(id, r.value) : String(v);
  };
  const ea = apply(b, M, library).styles, eb = apply(a, M, library).styles;
  /* a style's construction with its How it's built numbers in: an eave is
     measured on the slope its barn roof height gives it */
  const styleConstruction = (S, E, k) => mergeTwo(mergeTwo(mergeTwo(baseOf(library), M.construction || {}), S.construction || {}), (E[k] && E[k].construction) || {});
  /* what a style is built with, in words: its number, or the library's */
  const builtWords = (S, E, k, id) => {
    const e = E[k] && E[k].built[id];
    if (e && e.value !== undefined) return format(id, e.value);
    const o = isObj(S.offer) ? S.offer[k] : null, t = o && (M.styles || {})[o.base != null ? o.base : k];
    if (!t) return "";
    const v = plainValue(id, t, styleConstruction(S, E, k), keysOf(o.sizes));
    return v !== undefined ? format(id, v) : "";
  };
  const soldWidths = (S1, S2, k) => {
    const sizes = [...new Set([...keysOf(S1.offer && S1.offer[k] && S1.offer[k].sizes), ...keysOf(S2.offer && S2.offer[k] && S2.offer[k].sizes)])];
    return [...new Set(sizes.map((z) => +String(z).split("x")[0]).filter((w) => w > 0))].sort((x, y) => x - y);
  };
  /* a barn's height at width W as drawn: the trusses' peak */
  const drawnBarnWords = (S, E, k, t, W) => {
    const merged = styleConstruction(S, E, k);
    try { return fmtIn(barnTrussPeakFt(W, t, settledAt(merged, W, t)) * 12); } catch (e) { return null; }
  };
  /* the styles a business-wide number moved, before → after (review W4):
     "standard" is not one number */
  const moved = (id, kind) => {
    const list = [];
    for (const k of keysOf(a.offer)) {
      if (!isObj(b.offer) || !own(b.offer, k) || !isObj(a.offer[k])) continue;
      const t = (M.styles || {})[a.offer[k].base != null ? a.offer[k].base : k];
      if (!t || knobsFor(t).indexOf(id) < 0) continue;
      if (kind && (id === "doorHeight" ? (kindOf(t) === "barn" ? "barn" : "other") : kindOf(t)) !== kind) continue;
      if (id === "barnPeak") {
        /* width by width, as drawn */
        for (const W of soldWidths(b, a, k)) {
          const x = drawnBarnWords(b, ea, k, t, W), y = drawnBarnWords(a, eb, k, t, W);
          if (x && y && x !== y) list.push({ name: styleName(a, M, k), words: `at ${W} ft wide ${x} → ${y}` });
        }
        continue;
      }
      const x = builtWords(b, ea, k, id), y = builtWords(a, eb, k, id);
      if (x && y && x !== y) list.push({ name: styleName(a, M, k), words: `${x} → ${y}` });
    }
    const groups = groupByWords(list);
    return groups.length ? ` (${groups.map((g) => `${namesWords(g.names)} ${g.words}`).join("; ")})` : "";
  };
  /* A library style's own number reaches every style of theirs built like
     it that has no number of its own for that setting (A.1 step 2), so its
     line names them, the way a business-wide line names the styles it moves
     (reviews M2, SEC-BUILT-4): "Utility Shed roof pitch: 5/12 → 6/12 (and
     Premium Utility, built like it)". Named: those whose building it
     moved, and those new in this change (drawn with it from the start). W:
     one barn width, for a barn roof height said width by width. */
  const builtLike = (k, id, W) => {
    if (!isObj(a.offer[k]) || a.offer[k].base != null) return "";
    const t = (M.styles || {})[k];
    const names = [];
    for (const k2 of keysOf(a.offer)) {
      const o2 = a.offer[k2];
      if (k2 === k || !isObj(o2) || o2.base !== k || (isObj(o2.built) && own(o2.built, id))) continue;
      const was = isObj(b.offer) && own(b.offer, k2) && isObj(b.offer[k2]);
      /* it had a number of its own before: its own line says the change */
      if (was && isObj(b.offer[k2].built) && own(b.offer[k2].built, id)) continue;
      if (W != null) {
        if (!keysOf(o2.sizes).some((z) => +String(z).split("x")[0] === W)) continue;
        if (was && drawnBarnWords(b, ea, k2, t, W) === drawnBarnWords(a, eb, k2, t, W)) continue;
      } else if (was && builtWords(b, ea, k2, id) === builtWords(a, eb, k2, id)) continue;
      names.push(styleName(a, M, k2));
    }
    return names.length ? ` (and ${namesWords(names)}, built like it)` : "";
  };
  for (const id of KNOB_IDS) {
    const K = KNOB[id];
    if (Array.isArray(K.business)) {
      for (const kind of K.business) {
        const x = isObj(bb[id]) ? bb[id][kind] : undefined, y = isObj(ab[id]) ? ab[id][kind] : undefined;
        if (!same(x, y) && shownBiz(id, x) !== shownBiz(id, y)) out.push(`Business-wide ${K.words} for ${KIND_WORDS[kind]}: ${shownBiz(id, x)} → ${shownBiz(id, y)}${moved(id, kind)}`);
      }
    } else if (!same(bb[id], ab[id]) && shownBiz(id, bb[id]) !== shownBiz(id, ab[id])) out.push(`Business-wide ${K.words}: ${shownBiz(id, bb[id])} → ${shownBiz(id, ab[id])}${moved(id, null)}`);
  }
  for (const k of keysOf(a.offer)) {
    if (!isObj(b.offer) || !own(b.offer, k)) {
      /* a new style says "Started selling"; a number of its own on it is
         said too ("Tall Barn wall height: 7 ft 6 in of its own") */
      const oa = isObj(a.offer[k]) && isObj(a.offer[k].built) ? a.offer[k].built : {};
      const name = styleName(a, M, k);
      for (const id of KNOB_IDS) {
        if (oa[id] === undefined) continue;
        const r = parse(id, oa[id], {});
        if (id === "barnPeak" && isObj(r.value)) {
          for (const w of Object.keys(r.value).map(Number).sort((x, y) => x - y)) out.push(`${name} ${KNOB[id].words} at ${w} ft wide: ${fmtIn(r.value[w])} of its own${builtLike(k, id, w)}`);
          continue;
        }
        out.push(`${name} ${KNOB[id].words}: ${r.value !== undefined ? format(id, r.value) : `"${String(oa[id]).slice(0, 40)}"`} of its own${r.value !== undefined ? builtLike(k, id) : ""}`);
      }
      continue;
    }
    const ob = (isObj(b.offer[k]) && b.offer[k].built) || {}, oa = (isObj(a.offer[k]) && a.offer[k].built) || {};
    if (same(ob, oa)) continue;
    const name = styleName(a, M, k), base = a.offer[k].base != null ? a.offer[k].base : k, s = (M.styles || {})[base];
    const words = (S, E, id) => {
      const e = E[k] && E[k].built[id];
      /* a number typed on this style that cannot be used: say what was typed */
      const typed = isObj(S.offer[k]) && isObj(S.offer[k].built) ? S.offer[k].built[id] : undefined;
      if (typed !== undefined && !(e && e.from === "this style")) return typeof typed === "string" ? `"${typed}"` : shownRaw(id, typed);
      if (e && e.value !== undefined) return format(id, e.value);
      const v = s ? plainValue(id, s, styleConstruction(S, E, k), keysOf(S.offer[k] && S.offer[k].sizes)) : undefined;
      return v !== undefined ? format(id, v) : "standard";
    };
    for (const id of KNOB_IDS) {
      if (same(ob[id], oa[id])) continue;
      /* barn heights width by width, as drawn: "Lofted Barn barn roof
         height at 10 ft wide: 4 ft → 5 ft" (the other widths kept theirs) */
      if (id === "barnPeak" && s) {
        const usable = (S, E) => { const typed = S.offer[k].built && S.offer[k].built[id]; return typed === undefined || (E[k] && E[k].built[id] && E[k].built[id].from === "this style"); };
        if (usable(b, ea) && usable(a, eb)) {
          const lines = [];
          for (const W of soldWidths(b, a, k)) {
            const x = drawnBarnWords(b, ea, k, s, W), y = drawnBarnWords(a, eb, k, s, W);
            if (x && y && x !== y) lines.push(`${name} ${KNOB[id].words} at ${W} ft wide: ${x} → ${y}${builtLike(k, id, W)}`);
          }
          if (lines.length) { out.push(...lines); continue; }
        }
      }
      const was = words(b, ea, id), now = words(a, eb, id);
      /* the same number in other words ("5/12" for 5) is no change; the
         standard's number typed as the style's own is: the style now keeps
         it when the standard moves (review W12) */
      if (was === now) {
        const typed = ob[id] === undefined ? oa[id] : oa[id] === undefined ? ob[id] : undefined;
        const r = id === "barnPeak" && typed !== undefined ? parse(id, typed, {}) : null;
        const at = r && r.value ? Object.keys(r.value).map((w) => ({ w, words: fmtIn(r.value[w]) })) : [{ w: null, words: was }];
        for (const x of at) {
          const what = `${name} ${KNOB[id].words}${x.w ? ` at ${x.w} ft wide` : ""}`;
          if (ob[id] === undefined) out.push(`${what}: standard (${x.words}) → ${x.words} of its own`);
          else if (oa[id] === undefined) out.push(`${what}: ${x.words} of its own → standard (${x.words})`);
        }
        continue;
      }
      out.push(`${name} ${KNOB[id].words}: ${was} → ${now}${builtLike(k, id)}`);
    }
  }
  /* a new wall height changes what a wall upgrade priced by the square foot
     costs on that building (model/pricing.js areasOf): say so once */
  const walls = keysOf(a.offer).some((k) => {
    const x = ea[k] && ea[k].built.wallHeight, y = eb[k] && eb[k].built.wallHeight;
    return isObj(b.offer) && own(b.offer, k) && !same(x && x.value, y && y.value);
  });
  if (walls) {
    const rates = (isObj(a.options) && isObj(a.options.rates)) ? keysOf(a.options.rates) : [];
    const mr = (M.options && M.options.rates) || {};
    const byWall = rates.filter((id) => mr[id] && mr[id].basis === "wall").map((id) => (isObj(a.options.rates[id]) && typeof a.options.rates[id].name === "string" && a.options.rates[id].name.trim()) || mr[id].name || "");
    const extras = isObj(a.options) && Array.isArray(a.options.extras) ? a.options.extras : [];
    for (const x of extras) if (isObj(x) && x.input === "sqftW" && typeof x.name === "string" && x.name.trim()) byWall.push(x.name.trim());
    const names = [...new Set(byWall.filter(Boolean))];
    if (names.length) out.push(`Wall upgrades priced by the square foot follow the new wall height: ${joinWords(names)}`);
  }
  return out;
}

/* A value as stored, in words when it can be read */
function shownRaw(id, v) {
  const r = parse(id, v, {});
  return r.value !== undefined ? format(id, r.value) : String(v);
}

/* What changed in an extra's own numbers, in History words: "Steep roof:
   roof pitch at least 7/12", "Steep roof no longer changes the roof pitch". */
export function describeExtraBuilt(name, before, after) {
  const out = [];
  const b = isObj(before) ? before : {}, a = isObj(after) ? after : {};
  for (const id of KNOB_IDS) {
    if (same(b[id], a[id])) continue;
    const K = KNOB[id];
    if (a[id] === undefined) { out.push(`${name} no longer changes the ${K.words}`); continue; }
    const r = parse(id, a[id], {});
    out.push(`${name}: ${K.words}${id === "roofPitch" ? " at least" : ""} ${r.value !== undefined ? format(id, r.value) : String(a[id])}`);
  }
  return out;
}

/* ------------------------------------------------------------------------ */
/* Editing                                                                   */

/* A pure edit: -> { settings (a new copy), problems }. style omitted = the
   business-wide value; roof = which roof kind for a knob kept by roof kind
   ("gable", "lean", "slope", "barn"; door height "barn" or "other"); value
   null = back to the standard. */
export function setBuilt(settings, { style, knob, value, roof } = {}) {
  const S = copy(settings || {});
  const K = KNOB[knob];
  if (!K) return { settings: S, problems: [{ path: "built", words: `"${knob}" is not a building setting${dym(knob)}` }] };
  let container, at;
  if (style != null) {
    if (!isObj(S.offer) || !isObj(S.offer[style])) return { settings: S, problems: [{ path: `offer.${style}`, words: "That building style is not sold." }] };
    container = S.offer[style].built = isObj(S.offer[style].built) ? S.offer[style].built : {};
    at = `offer.${style}.built.${knob}`;
  } else {
    if (!K.business) return { settings: S, problems: [{ path: `built.${knob}`, words: `${K.Words} is set on each style, not for the whole business.` }] };
    S.built = isObj(S.built) ? S.built : {};
    container = S.built;
    at = `built.${knob}`;
    if (Array.isArray(K.business)) {
      if (K.business.indexOf(roof) < 0) return { settings: S, problems: [{ path: at, words: `${K.Words}: pick the roof kind (${K.business.join(", ")}).` }] };
      container = S.built[knob] = isObj(S.built[knob]) ? S.built[knob] : {};
      knob = roof; at += "." + roof;
    }
  }
  if (value == null) {
    delete container[knob];
    if (style != null && !keysOf(S.offer[style].built).length) delete S.offer[style].built;
    if (style == null && Array.isArray(K.business) && !keysOf(S.built[K.id]).length) delete S.built[K.id];
    if (style == null && isObj(S.built) && !keysOf(S.built).length) delete S.built;
    return { settings: S, problems: [] };
  }
  const r = parse(K.id, value, { kind: style == null && Array.isArray(K.business) && K.id !== "doorHeight" ? roof : undefined });
  if (r.problem) return { settings: S, problems: [{ path: at, words: r.problem }] };
  container[knob] = r.value;
  return { settings: S, problems: [] };
}

/* One number typed for one offered style, checked the way that style's own
   How it's built box checks it (its roof, its sizes, its porch): -> {value}
   or {problem} in words. A knob that doesn't apply to the style is a
   problem ("The Utility Shed has no porch."). input null is "standard"
   (take the style's own number out): only whether the knob applies is
   checked, -> {value: null}. For the Barnwright door's set_built
   (server/office/setup-edits.js), which then writes it with setBuilt. */
export function checkStyleNumber(settings, manufacturer, key, id, input) {
  const S = settings || {}, M = manufacturer || {};
  const o = isObj(S.offer) ? S.offer[key] : null;
  const s = isObj(o) ? (M.styles || {})[o.base != null ? o.base : key] : null;
  if (!s) return { problem: "That building style is not sold." };
  const K = KNOB[id];
  if (!K) return { problem: `${JSON.stringify(String(id))} is not a building setting${dym(id)}` };
  const name = styleName(S, M, key);
  if (knobsFor(s).indexOf(id) < 0) return { problem: notApplying(id, name, s) };
  if (input === null) return { value: null };
  return checkFor(id, input, s, name, keysOf(o.sizes));
}

/* ------------------------------------------------------------------------ */
/* Older price lists                                                         */

/* A raw roof pitch rule list of exactly the shape the Barnwright setup
   connector writes -- one {"when": {"styles": [K]}, "value": {"w": N}} per
   gable style, then the library's own rise last -- becomes
   offer.K.built.roofPitch (24N per 12) and the raw rule goes. The drawn roof
   is the same either way. Anything else stays raw and is honoured as before.
   -> { settings, moved: [words] } (settings is the same object when nothing
   moved). */
export function liftRawRules(settings, manufacturer) {
  const S = settings;
  const rise = S && isObj(S.construction) && isObj(S.construction.roof) && isObj(S.construction.roof.shapes) && isObj(S.construction.roof.shapes.gable) ? S.construction.roof.shapes.gable.rise : undefined;
  if (!Array.isArray(rise) || rise.length < 2) return { settings: S, moved: [] };
  const styles = (manufacturer && manufacturer.styles) || {};
  const last = rise[rise.length - 1];
  if (!isObj(last) || keysOf(last).join() !== "value" || !isObj(last.value) || keysOf(last.value).join() !== "w" || last.value.w !== DEFAULT_ROOF.shapes.gable.rise.w) return { settings: S, moved: [] };
  const lifts = [];
  for (const r of rise.slice(0, -1)) {
    if (!isObj(r) || keysOf(r).sort().join() !== "value,when" || !isObj(r.when) || keysOf(r.when).join() !== "styles") return { settings: S, moved: [] };
    const st = r.when.styles;
    if (!Array.isArray(st) || st.length !== 1 || typeof st[0] !== "string") return { settings: S, moved: [] };
    const K = st[0], s = styles[K];
    if (!s || s.roof !== "gable" || s.dormer || !isObj(S.offer) || !isObj(S.offer[K]) || S.offer[K].base != null || lifts.some((l) => l.K === K)) return { settings: S, moved: [] };
    if (!isObj(r.value) || keysOf(r.value).join() !== "w" || typeof r.value.w !== "number") return { settings: S, moved: [] };
    const p = r4(24 * r.value.w);
    if (!(p >= PITCH.gable[0] && p <= PITCH.gable[1])) return { settings: S, moved: [] };
    lifts.push({ K, p });
  }
  const out = copy(S);
  for (const { K, p } of lifts) {
    const o = out.offer[K];
    o.built = isObj(o.built) ? o.built : {};
    if (o.built.roofPitch === undefined) o.built.roofPitch = p;
  }
  const g = out.construction.roof.shapes.gable;
  delete g.rise;
  if (!keysOf(g).length) delete out.construction.roof.shapes.gable;
  if (!keysOf(out.construction.roof.shapes).length) delete out.construction.roof.shapes;
  if (!keysOf(out.construction.roof).length) delete out.construction.roof;
  if (!keysOf(out.construction).length) delete out.construction;
  return { settings: out, moved: ["Roof pitch rules moved into How it's built (no building changes)"] };
}
