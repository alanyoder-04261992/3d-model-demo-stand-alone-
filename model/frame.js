/* THE BUILDING'S FRAME OF REFERENCE: its size, its walls and its roof line.
   Node-safe, pure (it reads the state; it never changes it).

   frameOf(state, cat) answers everything a part or a layout rule needs to know
   about the building as it stands, in one object:

     t             the style (name, roof, wallH, flags, traits, loadout)
     d, W, L       the size in feet. A corner-porch style (porch "C") adds its
                   porch depth (4 ft standard) to L, exactly as Barnwright's
                   dims() does: the porch deck is past the end wall, and every
                   price by the square foot and every porch-C number assumes it.
     topY          top of the walls (the deck top y0 plus the wall height)
     span          the side-cabin porch notch {z0, z1, P, f, mid} (Barnwright's pSpan)
     ws            every wall: F B R L, plus S1-S3 (side porch) or P1-P3
                   (corner porch). {ax, n, at, cx, len, top} or, for the
                   diagonal P1, {ox, oz, ax, n, len, top}. See engine/wall.js.
     prof          the roof cross-section (model/roof-shapes.js)
     CAT           the item catalogue
     STEP          the siding tile pitch: RIB on metal buildings, else GROOVE
     construction  the real-life construction numbers for this building

   dims, pSpan and wallDefs are lifted from Barnwright (1267-1274, 2254-2286)
   with byte-identical maths. The lean-to and single-slope wall rises are read
   from the same roof settings the profile uses, so the two can never disagree
   (their defaults are Barnwright's W*0.17 and W*0.28). */

import { y0, GROOVE, RIB } from "../engine/constants.js";
import { roofProfile, roofShape, lengthOf } from "./roof-shapes.js";
import { constructionFor } from "./construction.js";

/* THE PORCH DEPTH, a style trait (porchDepthFt): how far a front porch's
   wall stands back, how deep a side porch's notch is and how deep a wrap
   porch's deck is. 4 ft standard -- Barnwright's number, which is what every
   style has unless "How it's built" (model/build-settings.js) gives it
   another. A trait, not a construction value, because the corner porch adds
   it to L before any construction rule is settled. */
export var PORCH_DEPTH_FT = 4;
export function porchDepthOf(t) {
  return t && typeof t.porchDepthFt === "number" && t.porchDepthFt > 0 ? t.porchDepthFt : PORCH_DEPTH_FT;
}

/* THE SIDE PORCH LENGTHS a customer can pick (trait sidePorch.lengthsFt,
   8 and 12 standard), shortest first. */
export var SIDE_PORCH_LENGTHS = Object.freeze([8, 12]);
export function sidePorchLengthsOf(t) {
  var l = t && t.sidePorch && Array.isArray(t.sidePorch.lengthsFt) ? t.sidePorch.lengthsFt.filter(function (n) { return typeof n === "number" && n > 0; }) : [];
  return (l.length ? l : SIDE_PORCH_LENGTHS).slice().sort(function (a, b) { return a - b; });
}
/* THE SIDE WALL LEFT BESIDE A SIDE PORCH: a porch is never offered so long
   that less than this much of the long wall is left beside it (4 ft). A
   porch as long as the building leaves no wall at all: its end wall would
   stand in the back wall and the building could not be framed. */
export var SIDE_WALL_MIN_FT = 4;
/* The lengths allowed on a building this long: those that leave at least
   SIDE_WALL_MIN_FT of side wall, and only the shortest under 20 ft ("short
   buildings carry the 4x8 porch"). A building too short for every length
   keeps the shortest (the price list refuses such a size:
   model/build-settings.js). */
export function sidePorchLengthsFor(t, L) {
  var all = sidePorchLengthsOf(t);
  var fit = all.filter(function (n) { return L - n >= SIDE_WALL_MIN_FT - 1e-9; });
  if (!fit.length) fit = [all[0]];
  return L < 20 ? [fit[0]] : fit;
}
/* The length a porch of pLen becomes: pLen when it is allowed, else the
   nearest allowed one (the longer on a tie; a missing pLen is the longest --
   today's "anything but 8 is 12"). */
export function porchLengthFor(t, L, pLen) {
  var ok = sidePorchLengthsFor(t, L), n = +pLen;
  if (ok.indexOf(n) >= 0) return n;
  if (!(n > 0)) return ok[ok.length - 1];
  var best = ok[0];
  for (var i = 1; i < ok.length; i++) if (Math.abs(ok[i] - n) <= Math.abs(best - n)) best = ok[i];
  return best;
}

/* THE DORMER SIDE (trait dormerSide): "door" (+x, the R wall, where the
   Dormer Shed's doors are -- every dormer today) or "back" (-x). -> +1 / -1. */
export function dormerSideOf(t) { return t && t.dormerSide === "back" ? -1 : 1; }

/* {W, L} from "WxL"; the corner porch adds its deck (the porch depth, 4 ft
   standard) to L. */
export function dims(size, t) {
  var a = String(size).split("x");
  var W = +a[0], L = +a[1];
  if (t && t.porch === "C") L += porchDepthOf(t);
  return { W: W, L: L };
}

/* The side-cabin porch notch along z: one of the style's side porch lengths
   (pLen; 8 or 12 standard), the shortest on a building under 20 ft ("short
   buildings carry the 4x8 porch"). At the +z end, flipped to the -z end
   (pFlip), or centred (pMid). t is the style (its sidePorch trait); without
   it the lengths are the standard 8 and 12. */
export function pSpan(state, d, t) {
  var P4 = porchLengthFor(t, d.L, state.pLen);
  if (state.pMid) return { z0: -P4 / 2, z1: P4 / 2, P: P4, f: false, mid: true };
  return state.pFlip ? { z0: -d.L / 2, z1: -d.L / 2 + P4, P: P4, f: true }
                     : { z0: d.L / 2 - P4, z1: d.L / 2, P: P4, f: false };
}

/* Every wall of the building. u runs to the viewer's right from outside on
   every wall: R has world z = -u, L has z = +u, B has x = -u. */
export function wallDefs(t, d, span, construction) {
  var W = d.W, L = d.L, wh = t.wallH;
  var sh = roofShape(t, construction);
  var leanUp = (t.roof === "lean") ? lengthOf(sh.rise, W) : 0, slopeUp = (t.roof === "slope") ? lengthOf(sh.rise, W) : 0;
  var pF = t.porch === "F", pR = t.porch === "R", pC = t.porch === "C";
  var pd = porchDepthOf(t);
  var zF = L / 2 - (pF ? pd : 0), xR = W / 2 - (pR ? 3.5 : 0);
  var tY = y0 + wh;
  var ws = {
    F: { ax: [1, 0, 0], n: [0, 0, 1], at: zF, len: (pR ? xR + W / 2 : W), cx: (pR ? (xR - W / 2) / 2 : 0), top: tY },
    B: { ax: [-1, 0, 0], n: [0, 0, -1], at: -L / 2, len: (pR ? xR + W / 2 : W), cx: (pR ? -(xR - W / 2) / 2 : 0), top: tY },
    R: { ax: [0, 0, -1], n: [1, 0, 0], at: xR, len: (pF ? L - pd : L), cx: (pF ? -pd / 2 : 0), top: tY + slopeUp },
    L: { ax: [0, 0, 1], n: [-1, 0, 0], at: -W / 2, len: (pF ? L - pd : L), cx: (pF ? -pd / 2 : 0), top: tY + leanUp },
  };
  if (t.porch === "S") {
    /* corner porch notched into one end of the long side (Side Cabin
       blueprint), the porch depth deep */
    var sp = span;
    ws.S1 = { ax: [0, 0, -1], n: [1, 0, 0], at: W / 2 - pd, cx: (sp.z0 + sp.z1) / 2, len: sp.P, top: tY };
    if (sp.mid) {
      ws.S2 = { ax: [1, 0, 0], n: [0, 0, 1], at: sp.z0, cx: W / 2 - pd / 2, len: pd, top: tY };
      ws.S3 = { ax: [-1, 0, 0], n: [0, 0, -1], at: sp.z1, cx: W / 2 - pd / 2, len: pd, top: tY };
    } else {
      ws.S2 = sp.f ? { ax: [-1, 0, 0], n: [0, 0, -1], at: sp.z1, cx: W / 2 - pd / 2, len: pd, top: tY }
                   : { ax: [1, 0, 0], n: [0, 0, 1], at: sp.z0, cx: W / 2 - pd / 2, len: pd, top: tY };
    }
  }
  if (pC) {
    /* corner (wrap) porch: a deck the porch depth deep past the end wall,
       then the blueprint walls. The 4 ft stub of front wall on the -x side
       and the 12 ft run down the door side are fixed; the depth moves the
       rest. P1 runs from (-W/2+4, L/2-pd) to (W/2-pd, L/2-(pd+4)); P2 down
       the door side at W/2-pd to L/2-12; P3 back across to the R wall.
       Every number is Barnwright's at pd = 4. */
    ws.F.at = L / 2 - pd;
    var dxp = W - 4 - pd, dzp = -4, lp = Math.hypot(dxp, dzp);
    ws.P1 = { ox: (4 - pd) / 2, oz: L / 2 - (pd + 2), ax: [dxp / lp, 0, dzp / lp], n: [4 / lp, 0, dxp / lp], len: lp, top: tY };
    ws.P2 = { ax: [0, 0, -1], n: [1, 0, 0], at: W / 2 - pd, cx: L / 2 - (pd + 16) / 2, len: 8 - pd, top: tY };
    ws.P3 = { ax: [1, 0, 0], n: [0, 0, 1], at: L / 2 - 12, cx: W / 2 - pd / 2, len: pd, top: tY };
  }
  return ws;
}

/* Everything about the building as it stands. Throws, in plain words, if the
   style is not in this catalogue. */
export function frameOf(state, cat) {
  var t = Object.prototype.hasOwnProperty.call(cat.TYPES, state.type) ? cat.TYPES[state.type] : null;
  if (!t) throw new Error(`"${state.type}" is not a building style this company offers.`);
  var d = dims(state.size, t);
  if (!(d.W > 0) || !(d.L > 0)) throw new Error(`"${state.size}" is not a size (it should look like 10x20).`);
  var construction = constructionFor(cat, state, t, d);
  var topY = y0 + t.wallH;
  var span = pSpan(state, d, t);
  var ws = wallDefs(t, d, span, construction);
  var prof = roofProfile(d.W, topY, t, construction);
  return {
    style: state.type,
    t: t, d: d, W: d.W, L: d.L, topY: topY, span: span, ws: ws, prof: prof,
    CAT: cat.CAT, STEP: t.metal ? RIB : GROOVE, construction: construction,
  };
}
