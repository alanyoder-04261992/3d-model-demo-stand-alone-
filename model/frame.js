/* THE BUILDING'S FRAME OF REFERENCE: its size, its walls and its roof line.
   Node-safe, pure (it reads the state; it never changes it).

   frameOf(state, cat) answers everything a part or a layout rule needs to know
   about the building as it stands, in one object:

     t             the style (name, roof, wallH, flags, traits, loadout)
     d, W, L       the size in feet. A corner-porch style (porch "C") adds 4 ft
                   to L, exactly as Barnwright's dims() does: the porch deck is
                   past the end wall, and every price by the square foot and
                   every porch-C number assumes it.
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

/* {W, L} from "WxL"; the corner porch adds its 4 ft deck to L. */
export function dims(size, t) {
  var a = String(size).split("x");
  var W = +a[0], L = +a[1];
  if (t && t.porch === "C") L += 4;
  return { W: W, L: L };
}

/* The side-cabin porch notch along z: 8 or 12 ft long (pLen), forced to 8 on a
   building under 20 ft ("short buildings carry the 4x8 porch"). At the +z end,
   flipped to the -z end (pFlip), or centred (pMid). */
export function pSpan(state, d) {
  var P4 = (+state.pLen === 8 ? 8 : 12);
  if (d.L < 20) P4 = 8; /* short buildings carry the 4x8 porch */
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
  var zF = L / 2 - (pF ? 4 : 0), xR = W / 2 - (pR ? 3.5 : 0);
  var tY = y0 + wh;
  var ws = {
    F: { ax: [1, 0, 0], n: [0, 0, 1], at: zF, len: (pR ? xR + W / 2 : W), cx: (pR ? (xR - W / 2) / 2 : 0), top: tY },
    B: { ax: [-1, 0, 0], n: [0, 0, -1], at: -L / 2, len: (pR ? xR + W / 2 : W), cx: (pR ? -(xR - W / 2) / 2 : 0), top: tY },
    R: { ax: [0, 0, -1], n: [1, 0, 0], at: xR, len: (pF ? L - 4 : L), cx: (pF ? -2 : 0), top: tY + slopeUp },
    L: { ax: [0, 0, 1], n: [-1, 0, 0], at: -W / 2, len: (pF ? L - 4 : L), cx: (pF ? -2 : 0), top: tY + leanUp },
  };
  if (t.porch === "S") {
    /* corner porch notched into one end of the long side (Side Cabin blueprint) */
    var sp = span;
    ws.S1 = { ax: [0, 0, -1], n: [1, 0, 0], at: W / 2 - 4, cx: (sp.z0 + sp.z1) / 2, len: sp.P, top: tY };
    if (sp.mid) {
      ws.S2 = { ax: [1, 0, 0], n: [0, 0, 1], at: sp.z0, cx: W / 2 - 2, len: 4, top: tY };
      ws.S3 = { ax: [-1, 0, 0], n: [0, 0, -1], at: sp.z1, cx: W / 2 - 2, len: 4, top: tY };
    } else {
      ws.S2 = sp.f ? { ax: [-1, 0, 0], n: [0, 0, -1], at: sp.z1, cx: W / 2 - 2, len: 4, top: tY }
                   : { ax: [1, 0, 0], n: [0, 0, 1], at: sp.z0, cx: W / 2 - 2, len: 4, top: tY };
    }
  }
  if (pC) {
    /* corner porch: 4-ft deck past the end wall, then the blueprint walls */
    ws.F.at = L / 2 - 4;
    var dxp = W - 8, dzp = -4, lp = Math.hypot(dxp, dzp);
    ws.P1 = { ox: 0, oz: L / 2 - 6, ax: [dxp / lp, 0, dzp / lp], n: [4 / lp, 0, dxp / lp], len: lp, top: tY };
    ws.P2 = { ax: [0, 0, -1], n: [1, 0, 0], at: W / 2 - 4, cx: L / 2 - 10, len: 4, top: tY };
    ws.P3 = { ax: [1, 0, 0], n: [0, 0, 1], at: L / 2 - 12, cx: W / 2 - 2, len: 4, top: tY };
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
  var span = pSpan(state, d);
  var ws = wallDefs(t, d, span, construction);
  var prof = roofProfile(d.W, topY, t, construction);
  return {
    style: state.type,
    t: t, d: d, W: d.W, L: d.L, topY: topY, span: span, ws: ws, prof: prof,
    CAT: cat.CAT, STEP: t.metal ? RIB : GROOVE, construction: construction,
  };
}
