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
      Numbers are FORMULAS over W (width), L (length), q (= L/4), len (this
      wall's length), CASING, and CAT.<item>.w / CAT.<item>.h (catalogue sizes),
      with + - * / ( ), comparisons, "? :", and min max floor ceil round abs.
      They are read by a small parser in this file: nothing is ever handed to
      eval or Function.

   standardItems(t, W, L, ctx)  the items for style t at W x L.
                                ctx = {CAT, span, ws}: the catalogue, the side
                                porch span, and the walls (data recipes only).
   includedItems(key, W, L, ctx)  the named Barnwright recipe for style key. */

import { CASING } from "../engine/constants.js";

function toItems(s) {
  /* A fourth entry, when a building comes with a DOUBLE of something - two
     sashes sharing one board down the middle. Everything else leaves it off
     and gets a single, which is what every building but the cottage wants. */
  return s.map(function (a, i) { return { id: "i" + i, cat: a[0], wall: a[1], pos: a[2], inc: true, origCat: a[0], shut: false, dbl: !!a[3] }; });
}

/* Barnwright's includedItems, verbatim but for CAT and pSpan() coming in. */
export function includedItems(t, W, L, ctx) {
  var CAT = ctx.CAT;
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
      var sp = ctx.span, zc = (sp.z0 + sp.z1) / 2, eW = sp.mid ? "F" : (sp.f ? "B" : "F");
      s = [["d36lite", "S1", sp.P >= 12 ? 0.0 : 1.4],
           ["w23", "S1", sp.P >= 12 ? -(sp.P / 2 - 1.9) : -1.7]];
      if (sp.P >= 12) s.push(["w23", "S1", (sp.P / 2 - 1.9)]);
      if (sp.mid) {
        s.push(["w23", "R", (sp.P / 2 + 2.7)]);
        s.push(["w23", "R", -(sp.P / 2 + 2.7)]);
        s.push(["w23", "F", -2]);
        s.push(["w23", "B", 2]);
      } else {
        s.push(["w23", "R", sp.f ? -sp.P / 2 : sp.P / 2]);
        s.push(["w23", eW, eW === "F" ? -2 : 2]);
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
function widthOf(CAT, cat, dbl) {
  const c = CAT[cat];
  if (dbl && c.k === "win" && !c.gable) return 2 * c.w + CASING;
  return c.w;
}

function fitsWall(CAT, placed, cat, wall, pos, dbl, len) {
  const c = CAT[cat];
  const w = widthOf(CAT, cat, dbl);
  if (Math.abs(pos) > len / 2 - w / 2 - 0.5 + 1e-9) return false;
  if (c.gable || c.k === "post") return true;
  for (const o of placed) {
    if (o[1] !== wall) continue;
    const oc = CAT[o[0]];
    if (oc.gable || oc.k === "post" || oc.k === "light" || oc.k === "out" || oc.k === "ilt") continue;
    if (Math.abs(pos - o[2]) < (w + widthOf(CAT, o[0], o[3])) / 2 + 0.62 - 1e-9) return false;
  }
  return true;
}

/* Evaluate a data recipe (see the top of this file). */
export function evalDataRecipe(recipe, W, L, ctx) {
  if (!Array.isArray(recipe)) throw new Error("A data loadout must be a list of entries.");
  const CAT = ctx.CAT, ws = ctx.ws || {};
  const s = [];
  recipe.forEach((e, idx) => {
    const where = `loadout entry ${idx + 1}`;
    if (!e || typeof e !== "object") throw new Error(`${where} must be an object like {"cat": "w23", "wall": "R", "at": "center"}.`);
    if (!CAT[e.cat]) throw new Error(`${where} uses item "${e.cat}", which this company does not sell.`);
    const wd = ws[e.wall];
    if (!wd && e.wall !== "IN") throw new Error(`${where} puts "${e.cat}" on wall "${e.wall}", which this building does not have.`);
    const w = e.when || {};
    if (w.minL != null && !(L >= w.minL)) return;
    if (w.maxL != null && !(L <= w.maxL)) return;
    if (w.minW != null && !(W >= w.minW)) return;
    if (w.maxW != null && !(W <= w.maxW)) return;
    const len = wd ? wd.len : 0;
    const vars = { W, L, q: L / 4, len, CASING, CAT };
    const dbl = !!e.dbl;
    const iw = widthOf(CAT, e.cat, dbl);
    let bases;
    const at = e.at == null ? "center" : e.at;
    if (at === "center") bases = [0];
    else if (at && typeof at === "object" && "pos" in at) bases = [evalFormula(at.pos, vars)];
    else if (at && typeof at === "object" && "fromStart" in at) bases = [(-len / 2 + evalFormula(at.fromStart, vars)) + iw / 2];
    else if (at && typeof at === "object" && "fromEnd" in at) bases = [(len / 2 - evalFormula(at.fromEnd, vars)) - iw / 2];
    else if (at && typeof at === "object" && "sym" in at) { const v = evalFormula(at.sym, vars); bases = [-v, v]; }
    else throw new Error(`${where} has an "at" I do not understand: ${JSON.stringify(at)}.`);
    let positions = [];
    if (e.repeat) {
      const n = Math.round(evalFormula(e.repeat.count, vars));
      const spread = e.repeat.spread == null ? 0 : evalFormula(e.repeat.spread, vars);
      for (const c of bases) {
        if (n <= 1) { if (n === 1) positions.push(c); continue; }
        for (let i = 0; i < n; i++) {
          const off = -spread / 2 + i * (spread / (n - 1));
          positions.push(c === 0 ? off : c + off);
        }
      }
    } else positions = bases;
    for (const pos of positions) {
      if (e.ifFits && !fitsWall(CAT, s, e.cat, e.wall, pos, dbl, len)) continue;
      s.push([e.cat, e.wall, pos, dbl]);
    }
  });
  return toItems(s);
}

/* The standard items for style t (its TYPES entry, which carries "loadout")
   at W x L. key is the style's own key (used only in error messages). */
export function standardItems(t, W, L, ctx, key) {
  const lo = t.loadout;
  if (typeof lo === "string") {
    if (lo.indexOf("barnwright:") !== 0 || NAMED_RECIPES.indexOf(lo) < 0) {
      throw new Error(`Style ${key || t.name}: its loadout "${lo}" is not a known recipe (use one of ${NAMED_RECIPES.join(", ")} or a data list).`);
    }
    return includedItems(lo.slice("barnwright:".length), W, L, ctx);
  }
  if (Array.isArray(lo)) return evalDataRecipe(lo, W, L, ctx);
  if (lo == null) return [];
  throw new Error(`Style ${key || t.name}: its loadout must be a recipe name like "barnwright:UT" or a list of entries.`);
}
