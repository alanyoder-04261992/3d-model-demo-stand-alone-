/* THE STANDARD DOORS AND WINDOWS EACH BUILDING COMES WITH. Node-safe, pure.

   A style's "loadout" (in the manufacturer file) says where its included doors
   and windows go. Two kinds:

   1. A NAMED BARNWRIGHT RECIPE, "barnwright:UT", "barnwright:CS", ... one per
      branch of Barnwright's includedItems (3ddesign.html 928-1064), ported
      exactly: same numbers, same order, same ids. The only change: the side
      cabins (SC/LSC) are handed their porch span instead of reading the global
      state, so a loadout can be worked out for any building, not just the one
      on screen.

   2. A DATA RECIPE, for a new style without writing code: a list of
        { "cat": "w23", "wall": "R",
          "at": "center" | {"pos": "q"} | {"fromStart": "0.9"} | {"fromEnd": "1.2"} | {"sym": "L/4+1.4"},
          "when": {"minL": 14, "maxL": 40, "minW": 8, "maxW": 12},
          "dbl": true, "ifFits": true,
          "repeat": {"count": "L<12 ? 2 : 3+floor((L-12)/4)", "spread": "min(L-3.5, L*0.74)"} }
      at:  "center" is the middle of the wall; pos is feet from the middle,
           positive to your right as you face the wall from outside; fromStart /
           fromEnd is the gap from the left / right end of the wall to the
           item's near edge (casing not counted); sym puts a matching PAIR at
           minus and plus that distance.
      when: the entry is used only on buildings in that size range.
      ifFits: the entry is left off when it would not fit -- inside the wall
           with 0.5 ft to spare at the ends, and a casing-and-a-hair (the same
           0.62 ft clampPos keeps) clear of every standard item already placed
           on that wall.
      repeat: count items spread evenly over spread feet, centred on "at".
      Numbers are FORMULAS over W (width), L (length), P (porch length), pd (porch depth), q (= L/4), len (this
      wall's length), CASING, and CAT.<item>.w / CAT.<item>.h (catalogue sizes),
      with + - * / ( ), comparisons, "? :", and min max floor ceil round abs.
      They are read by a small parser in this file: nothing is ever handed to
      eval or Function.

   standardItems(t, W, L, ctx)  the items for style t at W x L, with the shop
                                standard's own swaps at some sizes
                                (t.standardSwaps, see swapped() below).
                                ctx = {CAT, span, ws}: the catalogue, the side
                                porch span, and the walls (data recipes only).
   includedItems(key, W, L, ctx)  the named Barnwright recipe for style key. */

import { openingTrim } from "./opening-trim.js";
import { porchDepthOf, dims, sidePorchLengthsFor } from "./frame.js";
import { clampPos } from "./item-placement.js";
import { builderEntryIndices, builderEntrySources, builderLoadout } from "./loadout-twins.js";

function toItems(s) {
  /* A fourth entry, when a building comes with a DOUBLE of something - two
     sashes sharing one board down the middle. Everything else leaves it off
     and gets a single, which is what every building but the cottage wants. */
  return s.map(function (a, i) { return { id: "i" + i, cat: a[0], wall: a[1], pos: a[2], inc: true, origCat: a[0], shut: false, dbl: !!a[3] }; });
}

/* Barnwright's includedItems, verbatim but for CAT and pSpan() coming in. */
export function includedItems(t, W, L, ctx) {
  var CAT = ctx.CAT;
  var CASING = openingTrim(ctx.frame || ctx).width;
  var s = [], q = L / 4, pi = Math.max(1.8, W * 0.16), ps = Math.max(1.8, L * 0.12);   /* pi, ps: unused, as in Barnwright */
  void pi; void ps;
  switch (t) {
    case "UT": case "MU": s = [["w72", "F", 0]]; break;
    case "SU": case "DS": s = [["w72", "R", 0], ["w23", "R", -q - 1.4], ["w23", "R", q + 1.4]]; break;
    /* THE SMALLEST BACKYARD UTILITY HAS MORE OPENING THAN IT HAS WALL.
       A 48 inch door is just over four feet and each window is a shade over
       two, so the three together are 8.2 ft - and the smallest one sold, a 6x8,
       has an eight foot wall. Centred, the door leaves 1.99 ft each side and a
       window needs 2.1. So the windows are only included when there is wall
       for them. A 6x8 comes with its door and nothing beside it. */
    case "BU": {
      var dB = CAT.w48.w, wB = CAT.w23.w, mB = 0.4;
      s = [["w48", "R", 0]];
      if (dB / 2 + wB + mB <= L / 2 - 0.4) {       /* room for one each side of the door */
        s.push(["w23", "R", -q - 0.7], ["w23", "R", q + 0.7]);
      }
      break; }
    case "GU": s = [["w48", "F", 0]]; break;
    case "SB": s = [["w48", "F", 0]]; break;
    case "LB": s = [["w72", "F", 0], ["fake", "F", 0]]; break;
    case "MLB": s = [["w72", "F", 0]]; break;
    case "SLB": s = [["w72", "R", 0], ["w23", "R", -q - 1.4], ["w23", "R", q + 1.4]]; break;
    /* THE COTTAGE IS BUILT DOOR LEFT, WINDOWS RIGHT - the shop's standard
       layout, the two windows close together. WHICH DOOR depends on the length,
       as the cottage-shed page publishes: a 10x12 and smaller gets one 46 inch
       door and a 10x14 and larger gets 70 inch double doors. Both are included
       either way, so no price moves. The Metal Cottage is the same building in
       steel and is built the same way. */
    case "CS": case "MCS": {
      var mC = 0.9;                                  /* the door, a margin off its corner */
      var dC = (L >= 14) ? "w72" : "w48";            /* the breakpoint the building page states */
      var dXC = -L / 2 + mC + CAT[dC].w / 2;         /* where the door sits */
      var dRC = dXC + CAT[dC].w / 2;                 /* and where it ends */
      /* ONE DOUBLE WINDOW, not two singles side by side: a single opening with
         two sashes sharing a board down the middle, centred in what is left
         between the far side of the door and the corner. */
      var wwC = 2 * CAT.w23.w + CASING;              /* both sashes and the board between */
      var winC = (dRC + L / 2) / 2;
      /* The guard is for a cottage shorter than any sold: rather than draw a
         window through a door, fall back to spreading from the middle. */
      if (winC - wwC / 2 < dRC + 0.3 || winC + wwC / 2 > L / 2 - 0.4) {
        s = [["w72", "R", 0], ["w23", "R", -q - 1.2], ["w23", "R", q + 1.2]];
        break;
      }
      s = [[dC, "R", dXC],
           ["w23", "R", winC, true]];
      break; }
    case "SS": {
      /* Two transoms at ten feet, then one more every four feet from twelve -
         so twelve and fourteen get three, sixteen and eighteen four, and so on. */
      var nT = (L < 12) ? 2 : (3 + Math.floor((L - 12) / 4)), spanT = Math.min(L - 3.5, L * 0.74), wOff = Math.min(q + 1.6, L / 2 - 2.4);
      s = [["d36lite", "R", 0], ["w23", "R", -wOff], ["w23", "R", wOff]];
      for (var ti = 0; ti < nT; ti++) s.push(["tr", "R", -spanT / 2 + ti * (spanT / (nT - 1))]);
      break; }
    /* THE PORCH FRONT, IN THE ORDER IT IS BUILT: door in the middle, a post to
       each side of the steps, then a window in whatever wall is left. A wall
       with no room left for a window simply does not get one (8 ft cabins). */
    case "C": case "LBC": {
      var dHC = CAT.d36lite.w / 2, pWC = CAT.ppost.w, wWC = CAT.w23.w;
      var pXC = dHC + 0.20 + pWC / 2;                /* the post, just clear of the door */
      var freeC = (W / 2 - 0.45) - (pXC + pWC / 2);  /* what is left out to the corner */
      s = [["d36lite", "F", 0], ["w23", "R", 0], ["ppost", "F", -pXC], ["ppost", "F", pXC]];
      if (freeC >= wWC) {
        var wXC = (pXC + pWC / 2 + W / 2 - 0.45) / 2;  /* centred in what is left */
        s.push(["w23", "F", -wXC], ["w23", "F", wXC]);
      }
      if (t === "LBC") s.push(["oct", "F", 0]);
      break; }
    case "DSC": case "SLC":
      s = [["d36lite", "P3", 0.45], ["w23", "P1", 0], ["w23", "P2", 0], ["w23", "F", -(W / 2 - 2)], ["w23", "R", 6], ["ppost", "F", -W / 6], ["ppost", "F", W / 6], ["ppost", "R", 6 - L / 2], ["ppost", "R", 10 - L / 2]];
      if (t === "SLC") s.push(["fake", "F", 0]);
      break;
    case "SC": case "LSC": {
      /* the end-wall window sits in the middle of the closed part of the end
         wall: half the porch depth (4 ft standard) off the centre */
      var hd = (ctx.porchDepth != null ? ctx.porchDepth : 4) / 2;
      var sp = ctx.span, zc = (sp.z0 + sp.z1) / 2, eW = sp.mid ? "F" : (sp.f ? "B" : "F");
      s = [["d36lite", "S1", sp.P >= 12 ? 0.0 : 1.4],
           ["w23", "S1", sp.P >= 12 ? -(sp.P / 2 - 1.9) : -1.7]];
      if (sp.P >= 12) s.push(["w23", "S1", (sp.P / 2 - 1.9)]);
      if (sp.mid) {
        s.push(["w23", "R", (sp.P / 2 + 2.7)]);
        s.push(["w23", "R", -(sp.P / 2 + 2.7)]);
        s.push(["w23", "F", -hd]);
        s.push(["w23", "B", hd]);
      } else {
        s.push(["w23", "R", sp.f ? -sp.P / 2 : sp.P / 2]);
        s.push(["w23", eW, eW === "F" ? -hd : hd]);
      }
      var dz = zc - (sp.P >= 12 ? 0.0 : 1.4);   /* door position */
      s.push(["ppost", "R", -(dz - 2.2)]);
      s.push(["ppost", "R", -(dz + 2.2)]);
      if (t === "LSC") s.push(["fake", eW, 0]);
      break; }
    case "G": case "MG": s = [["ru8", "F", 0], ["d36in", "R", q + 1.6], ["w23", "R", -q - 1.6]]; break;
    case "LBG": s = [["ru8", "F", 0], ["d36in", "R", q + 1.6], ["w23", "R", -q - 1.6], ["fake", "F", 0]]; break;
    case "DK": s = [["w48", "B", 0], ["w23", "R", q], ["w23", "L", -q]]; break;
    default:
      throw new Error(`There is no Barnwright loadout called "barnwright:${t}".`);
  }
  return toItems(s);
}

export const NAMED_RECIPES = Object.freeze(["UT", "SU", "DS", "BU", "GU", "SB", "LB", "SLB", "CS", "SS", "C", "LBC", "SC", "LSC",
  "DSC", "SLC", "G", "LBG", "MU", "MLB", "MG", "MCS", "DK"].map((k) => "barnwright:" + k));

/* ----------------------------------------------------------------------------
   THE SAFE FORMULA READER. Numbers, the names listed above, + - * / ( ),
   < <= > >= == !=, a ? b : c, and six functions. Anything else is refused
   with a plain-English message. Nothing is ever evaluated as code.        */

const FUNCS = { min: Math.min, max: Math.max, floor: Math.floor, ceil: Math.ceil, round: Math.round, abs: Math.abs };

function tokenize(src) {
  if (typeof src === "number") return [{ k: "num", v: src }];
  if (typeof src !== "string") throw new Error("A formula must be a number or text like \"L/4+1.4\".");
  if (src.length > 200) throw new Error("A formula is limited to 200 characters.");
  const out = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === " " || ch === "\t") { i++; continue; }
    if (/[0-9.]/.test(ch)) {
      const m = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i.exec(src.slice(i));
      if (!m) throw new Error(`The formula "${src}" has a number I cannot read at "${src.slice(i)}".`);
      out.push({ k: "num", v: parseFloat(m[0]) }); i += m[0].length; continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      const m = /^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_0-9][A-Za-z0-9_]*)*/.exec(src.slice(i));
      out.push({ k: "id", v: m[0] }); i += m[0].length; continue;
    }
    const two = src.slice(i, i + 2);
    if (two === "<=" || two === ">=" || two === "==" || two === "!=") { out.push({ k: "op", v: two }); i += 2; continue; }
    if ("+-*/()<>?:,".indexOf(ch) >= 0) { out.push({ k: "op", v: ch }); i++; continue; }
    throw new Error(`The formula "${src}" has a character I do not understand: "${ch}".`);
  }
  return out;
}

function lookupName(name, vars, src) {
  const own = (o, k) => o !== null && typeof o === "object" && Object.prototype.hasOwnProperty.call(o, k);
  const bits = name.split(".");
  if (bits.length === 1) {
    if (own(vars, name) && typeof vars[name] === "number") return vars[name];
    throw new Error(`The formula "${src}" uses "${name}", which is not something a formula can use (W, L, q, len, CASING, or CAT.<item>.w / CAT.<item>.h).`);
  }
  if (bits.length === 3 && bits[0] === "CAT" && (bits[2] === "w" || bits[2] === "h") && own(vars.CAT, bits[1]) && typeof vars.CAT[bits[1]][bits[2]] === "number") {
    return vars.CAT[bits[1]][bits[2]];
  }
  throw new Error(`The formula "${src}" uses "${name}", which is not a catalogue size (write CAT.<item>.w or CAT.<item>.h for an item the company sells).`);
}

/* Evaluate one formula over vars {W, L, q, len, CASING, CAT}. */
export function evalFormula(src, vars) {
  const toks = tokenize(src);
  let p = 0;
  const peek = () => toks[p];
  const take = (v) => { const t = toks[p]; if (!t || t.v !== v) throw new Error(`The formula "${src}" is missing "${v}".`); p++; };
  function ternary() {
    const c = comparison();
    if (peek() && peek().v === "?") { p++; const a = ternary(); take(":"); const b = ternary(); return c ? a : b; }
    return c;
  }
  function comparison() {
    let a = additive();
    while (peek() && peek().k === "op" && ["<", "<=", ">", ">=", "==", "!="].indexOf(peek().v) >= 0) {
      const op = toks[p++].v, b = additive();
      a = op === "<" ? a < b : op === "<=" ? a <= b : op === ">" ? a > b : op === ">=" ? a >= b : op === "==" ? a === b : a !== b;
    }
    return a;
  }
  function additive() {
    let a = term();
    while (peek() && (peek().v === "+" || peek().v === "-") && peek().k === "op") {
      const op = toks[p++].v, b = term();
      a = op === "+" ? a + b : a - b;
    }
    return a;
  }
  function term() {
    let a = unary();
    while (peek() && (peek().v === "*" || peek().v === "/") && peek().k === "op") {
      const op = toks[p++].v, b = unary();
      a = op === "*" ? a * b : a / b;
    }
    return a;
  }
  function unary() {
    if (peek() && peek().k === "op" && peek().v === "-") { p++; return -unary(); }
    if (peek() && peek().k === "op" && peek().v === "+") { p++; return +unary(); }
    return primary();
  }
  function primary() {
    const t = toks[p++];
    if (!t) throw new Error(`The formula "${src}" ends too soon.`);
    if (t.k === "num") return t.v;
    if (t.k === "op" && t.v === "(") { const v = ternary(); take(")"); return v; }
    if (t.k === "id") {
      if (peek() && peek().v === "(") {
        if (!Object.prototype.hasOwnProperty.call(FUNCS, t.v)) throw new Error(`The formula "${src}" calls "${t.v}", which is not one of min max floor ceil round abs.`);
        p++;
        const args = [];
        if (!(peek() && peek().v === ")")) { args.push(ternary()); while (peek() && peek().v === ",") { p++; args.push(ternary()); } }
        take(")");
        return FUNCS[t.v].apply(null, args);
      }
      return lookupName(t.v, vars, src);
    }
    throw new Error(`The formula "${src}" has "${t.v}" where a number should be.`);
  }
  const v = ternary();
  if (p !== toks.length) throw new Error(`The formula "${src}" has something left over after "${toks.slice(0, p).map((x) => x.v).join(" ")}".`);
  if (typeof v === "boolean") return v;
  if (typeof v !== "number" || !isFinite(v)) throw new Error(`The formula "${src}" does not give a number.`);
  return v;
}

/* How much wall an item takes (layout.js itemW's rule, without importing it). */
function widthOf(CAT, cat, dbl, ctx) {
  const c = CAT[cat];
  if (dbl && c.k === "win" && !c.gable) return 2 * c.w + openingTrim(ctx?.frame || ctx).width;
  return c.w;
}

/* All porch choices that customers can reach. Both pricing and validation use
   this list, so included items stay included after a size or porch change. */
export function layoutVariants(t, size) {
  if (t.porch !== "S") return [{ pLen: 12, pMid: false, pFlip: false }];
  return sidePorchLengthsFor(t, dims(size, t).L).flatMap((pLen) => [
    { pLen, pMid: false, pFlip: false }, { pLen, pMid: false, pFlip: true }, { pLen, pMid: true, pFlip: false },
  ]);
}
const obj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const own = (o, k) => o != null && Object.prototype.hasOwnProperty.call(o, k);
const ENTRY_KEYS = ["cat", "wall", "at", "when", "dbl", "ifFits", "repeat"];
const AT_KEYS = ["pos", "fromStart", "fromEnd", "sym", "porchStart", "porchDoor"];
const WHEN_KEYS = ["minL", "maxL", "minW", "maxW", "minP", "maxP", "porch"];
function suggestion(k, choices) { const s = choices.find((v) => v.toLowerCase() === k.toLowerCase()); return s ? ` (use ${s})` : ""; }
const formula = (v) => (typeof v === "number" && Number.isFinite(v)) || (typeof v === "string" && v.length > 0 && v.length <= 200);
export function layoutProblems(recipe, name = "this building") {
  const out = [], prefix = `The standard layout of the ${name}`;
  if (!Array.isArray(recipe)) return [`${prefix} must be a list of doors, windows and posts.`];
  if (recipe.length > 100) out.push("The standard layout can have at most 100 doors, windows and posts.");
  recipe.forEach((e) => {
    if (!obj(e)) { out.push(`${prefix} has an item that could not be read.`); return; }
    for (const k of Object.keys(e)) if (!ENTRY_KEYS.includes(k)) out.push(`${prefix} has "${k}", which is not a layout setting${suggestion(k, ENTRY_KEYS)}.`);
    if (typeof e.cat !== "string" || !/^[A-Za-z0-9_]{1,16}$/.test(e.cat)) out.push(`${prefix} needs an item from your price list.`);
    if (typeof e.wall !== "string" || !/^(F|B|R|L|S[123]|P[123])$/.test(e.wall)) out.push(`${prefix} needs a wall this building has.`);
    if (e.at !== undefined && e.at !== "center") {
      if (!obj(e.at) || Object.keys(e.at).length !== 1) out.push(`${prefix} needs one place for each item.`);
      else for (const k of Object.keys(e.at)) {
        if (!AT_KEYS.includes(k)) out.push(`${prefix} has "${k}", which is not a place rule${suggestion(k, AT_KEYS)}.`);
        else if (!formula(e.at[k])) out.push(`${prefix} has a place that could not be read.`);
      }
    }
    for (const k of ["dbl", "ifFits"]) if (e[k] !== undefined && typeof e[k] !== "boolean") out.push(`${prefix}'s ${k} choice must be true or false.`);
    if (e.when !== undefined) {
      if (!obj(e.when)) out.push(`${prefix} needs size rules written as a list of limits.`);
      else {
        for (const k of Object.keys(e.when)) {
          if (!WHEN_KEYS.includes(k)) out.push(`${prefix} has "${k}", which is not a size rule${suggestion(k, WHEN_KEYS)}.`);
          else if (k === "porch") {
            const places = Array.isArray(e.when[k]) ? e.when[k] : [e.when[k]];
            if (!places.length || places.some((v) => !["front", "back", "middle"].includes(v))) out.push(`${prefix} needs a porch at the front, back or middle.`);
          } else if (!(typeof e.when[k] === "number" && Number.isFinite(e.when[k]) && e.when[k] >= 0)) out.push(`${prefix}'s ${k} must be a number of feet.`);
        }
        for (const dim of ["L", "W", "P"]) if (e.when["min" + dim] > e.when["max" + dim]) out.push(`${prefix}'s smallest size must not be greater than its largest.`);
      }
    }
    if (e.repeat !== undefined) {
      if (!obj(e.repeat) || !formula(e.repeat.count)) out.push(`${prefix} needs a number for repeated items.`);
      else {
        for (const k of Object.keys(e.repeat)) if (!["count", "spread"].includes(k)) out.push(`${prefix} has "${k}", which is not a repeat setting.`);
        if (e.repeat.spread !== undefined && !formula(e.repeat.spread)) out.push(`${prefix} needs a distance for repeated items.`);
        if (typeof e.repeat.count === "number" && (!Number.isInteger(e.repeat.count) || e.repeat.count < 0 || e.repeat.count > 100)) out.push("The standard layout can have at most 100 doors, windows and posts.");
      }
    }
  });
  return [...new Set(out)];
}

/* One fit decision for the checker and every customer's designer. `placed`
   accepts current item objects or the legacy [cat,wall,pos,dbl] tuples. */
export function fitProblem(CAT, placed, cat, wall, pos, dbl, len, ctx = {}) {
  const c = CAT[cat], t = ctx.t || {}, sp = ctx.span || {}, d = ctx.d || { W: ctx.W || 0, L: ctx.L || len };
  const width = widthOf(CAT, cat, dbl, ctx);
  if (c.k === "post") return null;
  if (!Number.isFinite(pos) || Math.abs(pos) > len / 2 - width / 2 - 0.5 + 1e-9) return { kind: "edge" };
  if (c.gable) return null;
  if (t.kennel && ((wall === "R" && pos < width / 2 + 0.55 - 1e-9) || (wall === "L" && pos > -width / 2 - 0.55 + 1e-9))) return { kind: "run" };
  const pd = ctx.porchDepth == null ? porchDepthOf(t) : ctx.porchDepth;
  if (t.porch === "S") {
    if (wall === "R" && pos > -sp.z1 - width / 2 - 0.45 + 1e-9 && pos < -sp.z0 + width / 2 + 0.45 - 1e-9) return { kind: "porch" };
    if (!sp.mid && wall === "F" && !sp.f && pos > d.W / 2 - pd - width / 2 - 0.35 + 1e-9) return { kind: "porch" };
    if (!sp.mid && wall === "B" && sp.f && pos < pd - d.W / 2 + width / 2 + 0.35 - 1e-9) return { kind: "porch" };
  }
  if (t.porch === "C") {
    if (wall === "F" && pos > -d.W / 2 + 4 - width / 2 - 0.35 + 1e-9) return { kind: "porch" };
    if (wall === "R" && pos < 12 - d.L / 2 + width / 2 + 0.45 - 1e-9) return { kind: "porch" };
    if (wall === "L" && pos > d.L / 2 - pd - width / 2 - 0.45 + 1e-9) return { kind: "porch" };
  }
  for (const row of placed) {
    const o = Array.isArray(row) ? { cat: row[0], wall: row[1], pos: row[2], dbl: row[3] } : row;
    if (o.wall !== wall) continue;
    const oc = CAT[o.cat];
    if (!oc || oc.gable || ["post", "light", "out", "ilt"].includes(oc.k)) continue;
    const band = t.roof === "slope" && wall === "R";
    if (band && (c.draw === "transom") !== (oc.draw === "transom")) continue;
    if (Math.abs(pos - o.pos) < (width + widthOf(CAT, o.cat, o.dbl, ctx)) / 2 + 0.62 - 1e-9) return { kind: "crowding", other: o };
  }
  return null;
}
export function fitsWall(CAT, placed, cat, wall, pos, dbl, len, ctx) { return !fitProblem(CAT, placed, cat, wall, pos, dbl, len, ctx); }
/* The owner's post edges. Front-porch posts keep 0.8 ft from a corner;
   side and wrap porch limits are the existing customer's clampPos rules. */
export function standardPostBounds(wall, frame) {
  const t = frame.t, W = frame.W == null ? frame.d.W : frame.W, L = frame.L == null ? frame.d.L : frame.L;
  if (t.porch === "F" && wall === "F") return { lo: -W / 2 + 0.8, hi: W / 2 - 0.8 };
  if (t.porch === "S" && wall === "R") return { lo: -frame.span.z1 + 0.85, hi: -frame.span.z0 - 0.85 };
  if (t.porch === "C" && wall === "F") return { lo: -W / 2 + 0.85, hi: W / 2 - 0.85 };
  if (t.porch === "C" && wall === "R") return { lo: 0.85 - L / 2, hi: 11.4 - L / 2 };
  return null;
}
export function clampStandardPost(it, frame) {
  const bounds = standardPostBounds(it.wall, frame);
  if (bounds) it.pos = Math.max(bounds.lo, Math.min(bounds.hi, it.pos));
  return it;
}
function matchWhen(w, W, L, span) {
  for (const [dim, value] of [["L", L], ["W", W], ["P", span && span.P || 0]]) {
    if (w["min" + dim] != null && value < w["min" + dim]) return false;
    if (w["max" + dim] != null && value > w["max" + dim]) return false;
  }
  const place = span && span.mid ? "middle" : span && span.f ? "back" : "front";
  return w.porch == null || (Array.isArray(w.porch) ? w.porch : [w.porch]).includes(place);
}
function metadata(it, idx, occurrence) {
  Object.defineProperties(it, { entryIndex: { value: idx }, recipeIndex: { value: idx },
    _layoutEntry: { value: idx }, _layoutOccurrence: { value: occurrence } });
  return it;
}
/* Raw placements, before ifFits: useful to explain why an item is left off.
   Entry identity is non-enumerable, so saved designs and golden fixtures do
   not acquire fields from the editor. */
export function recipeEntries(recipe, W, L, ctx) {
  const CASING = openingTrim(ctx.frame || ctx).width;
  if (!Array.isArray(recipe)) throw new Error("A data loadout must be a list of entries.");
  if (recipe.length > 100) throw new Error("The standard layout can have at most 100 doors, windows and posts.");
  const CAT = ctx.CAT, ws = ctx.ws || {}, span = ctx.span, pd = ctx.porchDepth == null ? porchDepthOf(ctx.t) : ctx.porchDepth;
  const items = [], builderIndices = ctx.t ? builderEntryIndices(recipe, ctx.t) : new Set();
  recipe.forEach((e, idx) => {
    const where = `loadout entry ${idx + 1}`;
    if (!obj(e)) throw new Error(`${where} must describe a door, window or post.`);
    if (!matchWhen(e.when || {}, W, L, span)) return;
    let cat = e.cat;
    if (builderIndices.has(idx)) for (const swap of ctx.t.standardSwaps || []) {
      if (swap.from === cat && swap.sizes.some((z) => sizeIs(z, ctx.t, W, L)) && own(CAT, swap.to)) { cat = swap.to; break; }
    }
    if (!own(CAT, cat)) throw new Error(`${where} uses item "${cat}", which this company does not sell.`);
    const wd = ws[e.wall];
    if (!wd && e.wall !== "IN") throw new Error(`${where} puts "${e.cat}" on wall "${e.wall}", which this building does not have.`);
    const len = wd ? wd.len : 0, vars = { W, L, P: span && span.P || 0, pd, q: L / 4, len, CASING, CAT }, dbl = !!e.dbl, iw = widthOf(CAT, cat, dbl, ctx);
    const at = e.at == null ? "center" : e.at;
    let bases;
    if (at === "center") bases = [0];
    else if (obj(at) && own(at, "pos")) bases = [evalFormula(at.pos, vars)];
    else if (obj(at) && own(at, "fromStart")) bases = [-len / 2 + evalFormula(at.fromStart, vars) + iw / 2];
    else if (obj(at) && own(at, "fromEnd")) bases = [len / 2 - evalFormula(at.fromEnd, vars) - iw / 2];
    else if (obj(at) && own(at, "sym")) { const v = evalFormula(at.sym, vars); bases = [-v, v]; }
    else if (obj(at) && own(at, "porchStart")) {
      if (!span || !ctx.t || ctx.t.porch !== "S") throw new Error("A post set from the porch needs a side porch.");
      const distance = evalFormula(at.porchStart, vars); bases = [span.f ? -(span.z0 + distance) : -(span.z1 - distance)];
    } else if (obj(at) && own(at, "porchDoor")) {
      const door = items.find((it) => it.wall === "S1" && CAT[it.cat].k === "door");
      if (!span || !door) throw new Error(`The ${ctx.t && ctx.t.name || "Side Cabin"}'s porch post is set from the porch door, but there is no porch door before it in the standard layout.`);
      bases = [door.pos - (span.z0 + span.z1) / 2 + evalFormula(at.porchDoor, vars)];
    } else throw new Error(`${where} has a place that could not be read.`);
    let positions = bases;
    if (e.repeat) {
      const n = evalFormula(e.repeat.count, vars), spread = e.repeat.spread == null ? 0 : evalFormula(e.repeat.spread, vars);
      if (!Number.isInteger(n) || n < 0 || n * bases.length + items.length > 100) throw new Error("The standard layout can have at most 100 doors, windows and posts.");
      positions = bases.flatMap((base) => Array.from({ length: n }, (_, i) => n === 1 ? base : base + (-spread / 2 + i * (spread / (n - 1)))));
    }
    if (items.length + positions.length > 100) throw new Error("The standard layout can have at most 100 doors, windows and posts.");
    positions.forEach((pos, occurrence) => {
      if (!Number.isFinite(pos)) throw new Error(`${where} needs a distance that can be read.`);
      items.push(metadata(toItems([[cat, e.wall, pos, dbl]])[0], idx, occurrence));
    });
  });
  items.forEach((it, i) => { it.id = "i" + i; });
  return items;
}

/* Evaluate the shared language. With a style in ctx, unchanged builder items
   settle first using the customer's original clampPos; owner's windows then
   give way to those items, with exactly the checker's fit rules. */
export function evalDataRecipe(recipe, W, L, ctx) {
  const raw = recipeEntries(recipe, W, L, ctx), t = ctx.t, CAT = ctx.CAT;
  const frame = t ? Object.assign({ t, CAT, span: ctx.span, ws: ctx.ws, d: { W, L }, W, L }, ctx.frame || {}) : null;
  const originalIndices = t && (t.builderLoadout !== undefined || typeof t.loadout === "string") ? builderEntryIndices(recipe, t) : new Set();
  const builders = raw.filter((it) => originalIndices.has(it.entryIndex));
  if (frame && builders.length) {
    for (const it of builders) {
      for (const swap of t.standardSwaps || []) if (swap.sizes.some((z) => sizeIs(z, t, W, L)) && it.cat === swap.from && CAT[swap.to]) it.cat = it.origCat = swap.to;
    }
    const state = { items: builders };
    for (const it of builders) { if (CAT[it.cat].gable && !frame.prof) continue; clampPos(it, state, frame); }
    const sources = builderEntrySources(recipe, t);
    if ([...sources.values()].some((source) => source.repeatOccurrence !== undefined)) {
      /* Removing a repeat member never makes its untouched neighbours walk
         around the newly empty space. Use the full builder row's settled
         positions, exactly as before the owner touched that row. */
      try {
        const sourceRecipe = builderLoadout(t), original = recipeEntries(sourceRecipe, W, L, ctx);
        const sourceState = { items: original };
        for (const it of original) { if (CAT[it.cat].gable && !frame.prof) continue; clampPos(it, sourceState, frame); }
        for (const it of builders) {
          const source = sources.get(it.entryIndex); if (!source) continue;
          let occurrence = source.sourceOccurrence === undefined ? it._layoutOccurrence : source.sourceOccurrence;
          if (source.repeatOccurrence !== undefined) {
            const e = sourceRecipe[source.sourceIndex], vars = { W, L, P: ctx.span.P, pd: porchDepthOf(t), q: L / 4, len: ctx.ws[e.wall].len, CAT, CASING: openingTrim(ctx.frame || ctx).width };
            occurrence = source.repeatBase * evalFormula(e.repeat.count, vars) + source.repeatOccurrence;
          }
          const before = original.find((part) => part.entryIndex === source.sourceIndex && part._layoutOccurrence === occurrence);
          if (before) it.pos = before.pos;
        }
      } catch { /* An unsold removed builder item is not needed by this row. */ }
    }
  }
  const placed = [];
  const priority = (it) => { const c = CAT[it.cat]; return c.k === "post" ? 4 : c.gable ? 3 : c.k === "win" ? 2 : 1; };
  const ordered = t ? builders.concat(raw.filter((it) => !builders.includes(it)).sort((a, b) => priority(a) - priority(b))) : raw;
  for (const it of ordered) {
    const e = recipe[it.entryIndex], c = CAT[it.cat], len = ((ctx.ws || {})[it.wall] || {}).len || 0;
    const builder = builders.includes(it);
    if (!builder && e.ifFits && !fitsWall(CAT, placed, it.cat, it.wall, it.pos, it.dbl, len, Object.assign({ W, L, d: { W, L } }, ctx))) continue;
    if (frame && !builder && (c.k === "post" || (c.gable && frame.prof))) {
      clampPos(it, { items: placed }, frame);
      if (c.k === "post") clampStandardPost(it, frame);
    }
    placed.push(it);
  }
  placed.forEach((it, i) => { it.id = "i" + i; });
  return placed;
}

/* The standard items for style t (its TYPES entry, which carries "loadout")
   at W x L. key is the style's own key (used only in error messages). */
export function standardItems(t, W, L, ctx, key) {
  const lo = t.loadout;
  if (typeof lo === "string") {
    if (lo.indexOf("barnwright:") !== 0 || NAMED_RECIPES.indexOf(lo) < 0) {
      throw new Error(`Style ${key || t.name}: its loadout "${lo}" is not a known recipe (use one of ${NAMED_RECIPES.join(", ")} or a data list).`);
    }
    return swapped(includedItems(lo.slice("barnwright:".length), W, L, Object.assign({}, ctx, { porchDepth: porchDepthOf(t) })), t, W, L, ctx);
  }
  if (Array.isArray(lo)) {
    const items = evalDataRecipe(lo, W, L, Object.assign({}, ctx, { t, porchDepth: porchDepthOf(t) }));
    return t.builderLoadout !== undefined ? items : swapped(items, t, W, L, ctx);
  }
  if (lo == null) return [];
  throw new Error(`Style ${key || t.name}: its loadout must be a recipe name like "barnwright:UT" or a list of entries.`);
}

/* THE SHOP STANDARD'S OWN DOOR AT SOME SIZES (t.standardSwaps, from the
   library style's built.standardSwaps; model/company.js resolve puts it on
   the style only when the price list sells the "to" item). At exactly
   those sizes, each standard "from" item becomes "to": the same wall,
   place, id and order, and it comes with the building (origCat). Alan,
   Oct 11 2026, on the 8x12 and 10x12 Side Utility: "replace 6 foot to 4
   foot" -- the 48 in Wooden Door where Barnwright's recipe puts the 72 in
   double doors; Oct 12 2026, the 8x12 and 10x12 Dormer Shed and Side
   Lofted Barn too ("yes"; same recipe, same door side). Barnwright's own
   company has no built blocks, so its recipe is untouched (the golden
   test). */
function sizeIs(z, t, W, L) {
  const m = /^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/.exec(String(z));
  if (!m) return false;
  const len = t && t.porch === "C" ? L - porchDepthOf(t) : L;      /* a corner porch's deck is not in the size */
  return Math.abs(+m[1] - W) < 1e-9 && Math.abs(+m[2] - len) < 1e-9;
}
function swapped(items, t, W, L, ctx) {
  const list = t && t.standardSwaps;
  if (!Array.isArray(list) || !list.length) return items;
  for (const s of list) {
    if (!s || !Array.isArray(s.sizes) || !s.sizes.some((z) => sizeIs(z, t, W, L))) continue;
    if (!ctx || !ctx.CAT || !ctx.CAT[s.to]) continue;
    for (const it of items) if (it.cat === s.from) { it.cat = s.to; it.origCat = s.to; }
  }
  return items;
}
