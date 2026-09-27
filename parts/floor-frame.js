/* THE FLOOR FRAME: the joists the floor decking is nailed to. Node-safe.
   NEW geometry -- Barnwright drew no framing, only a solid floor slab.

   In real life a portable building's floor is a frame of joists laid ACROSS
   the width, sitting on the skids that run along the length: a rim joist down
   each long side, an end joist across each end, and joists in between at the
   shop's spacing on centre, measured from the back end. The decking goes on
   top (parts/floor-deck.js). On a building with a front porch (a cabin's
   porch "F", or the corner porch "C") this frame stops at the front wall --
   its front end joist is right under that wall -- and the 4 ft porch deck in
   front is framed on the same skids by parts/porch-deck-frame.js. A side
   porch and the corner porch's side run are part of this frame: the joists
   run straight under the porch walls, as they do on the real building.

   WHERE IT SITS (docs/ARCHITECTURE.md, "Framing datums" 1): Barnwright's
   finished floor is one slab from the top of the skids (y 0.5) to the deck
   top (y0 = 0.92 ft), tucked 0.03 ft inside the walls (the kennel's runs out
   to the edge). The framing fits INTO that envelope: joists sit on the skids
   at y 0.5, and are drawn 0.42 ft minus the decking deep, so the decking's
   top lands on y0. The caption names the real lumber (a real 2x6 is 5 1/2 in
   deep; the drawing keeps Barnwright's floor height).

   A wall that runs the same way as the joists and stands on the floor away
   from its ends (the porch walls S2, S3, P3 and the kennel's partition) gets
   a joist of its own under its bottom plate, the way a framer doubles up
   under a wall -- beside a layout joist when one is already close.

   THIS FILE ALSO HOLDS THE FRAMING KIT the other framing parts share
   (foundation, floor-deck, wall-frame, porch-deck-frame, interior, ramp):
     lumberSize(name)          "2x6" -> real thickness and depth in feet ("2x8 doubled" -> plies 2)
     FRAME_PAINT, frameMat     the framing materials (their own buckets, never a finished part's)
     beamMember boxMember wallMember slabMember prismMember   one piece of material, as data
     drawMembers(kit, list)    draw a list of pieces
     floorPlanOf(plan)         the floor as the framing sees it: footprint, the
                               enclosed room, the porch decks, deck and joist heights
     polygon helpers           clipRect, clipHalf, polyArea, triangulate
   A piece is plain data (a "member") so tools/check-framing.mjs can test the
   very same pieces that are drawn.

   Barnwright source: new -- Barnwright drew none. What it fits into: the
   floor loop of buildShed (3868-3877, parts/floor.js) and the shop's floor
   note (2147-2150): "Floor: 2x6 joists on skids with 5/8" decking (8-ft-wide
   and smaller use 2x4 joists) -- that assembly is the 0.92 ft base line y0."
   Those numbers live in library/construction.json (floor.joist,
   floor.deck.thicknessIn) and engine/constants.js (y0). */

import { y0, LUMBER } from "../engine/constants.js";
import { texFlat } from "../engine/tex-names.js";
import { floorInset, FLOOR_TOP_OF_SKIDS } from "./floor.js";
import { norm3, sub3, cross3, dot3 } from "../engine/math.js";

/* The wall frame's outer face stands this far inside the siding plane
   (docs/ARCHITECTURE.md Framing datums 2: studs from o = -0.02 inward). */
export const WALL_INSET = 0.02;
/* The kennel's partition has a painted inner face drawn 0.03 ft behind its
   siding, so its frame stands behind that face. */
export const PARTITION_INSET = 0.05;

/* ------------------------------------------------------------------ lumber */

/* A nominal lumber size in real feet. A real 2x4 is 1 1/2 x 3 1/2 in
   (engine/constants.js LUMBER); any other size is the usual mill rule: 2 in
   and up to 6 in lose 1/2 in, 8 in and up lose 3/4 in. "doubled" / "tripled"
   give the number of plies of a built-up header; "flat" says it lies flat. */
export function lumberSize(name) {
  var s = String(name == null ? "" : name).toLowerCase();
  var m = /(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)/.exec(s);
  if (!m) throw new Error("\"" + name + "\" is not a lumber size (it should look like 2x6).");
  var a = +m[1], b = +m[2], key = a + "x" + b, t, d;
  if (Object.prototype.hasOwnProperty.call(LUMBER, key)) { t = LUMBER[key][0]; d = LUMBER[key][1]; }
  else { t = actualIn(a) / 12; d = actualIn(b) / 12; }
  var plies = /tripled|triple/.test(s) ? 3 : /doubled|double/.test(s) ? 2 : 1;
  return { name: String(name), nominal: key, t: t, d: d, plies: plies, flat: /\bflat\b/.test(s) };
}
function actualIn(n) { if (n <= 1) return n * 0.75; if (n < 8) return n - 0.5; return n - 0.75; }

/* ---------------------------------------------------------------- materials */

/* Framing has its own materials, so a framing piece never lands in a bucket
   the finished building draws with (the finished picture stays Barnwright's
   bucket for bucket, whether or not the framing is built). */
export const FRAME_PAINT = Object.freeze({
  lumber:   Object.freeze({ key: "frameLumber",  hex: "#C9A36A", spec: 0.04, gloss: 12 }),   /* kiln-dried studs, plates, headers */
  treated:  Object.freeze({ key: "frameTreated", hex: "#8F8A5E", spec: 0.04, gloss: 12 }),   /* pressure-treated floor framing */
  sheet:    Object.freeze({ key: "frameSheet",   hex: "#B99664", spec: 0.03, gloss: 10 }),   /* tongue-and-groove floor decking */
  board:    Object.freeze({ key: "frameBoard",   hex: "#9C8F63", spec: 0.04, gloss: 12 }),   /* treated porch deck boards */
  concrete: Object.freeze({ key: "frameBlock",   hex: "#96968F", spec: 0.02, gloss: 8 }),    /* concrete blocks */
  steel:    Object.freeze({ key: "frameSteel",   hex: "#A8AEB2", spec: 0.40, gloss: 40 }),   /* ground anchors, electrical boxes */
  fixture:  Object.freeze({ key: "frameFixture", hex: "#EFEEE8", spec: 0.10, gloss: 20 }),   /* cover plates, light globes */
});
export function frameMat(kit, which) {
  var p = FRAME_PAINT[which];
  if (!p) throw new Error("No framing material called \"" + which + "\".");
  return kit.mat(p.key, texFlat, p.hex, p.spec, p.gloss);
}

/* ------------------------------------------------------------------ members */

/* One piece of material, as data. shape "beam" is a straight board (drawn
   with kit.beam: from p0 to p1, d along `up`, w across it); shape "prism" is
   a flat polygon `poly` (2-D points in the plane origin + e1*a + e2*b) given
   thickness t along e3. `stage` is the building step; `meta` says what the
   piece is for (the checks read it). */
export function beamMember(kind, mat, p0, p1, w, d, up, meta) {
  return { kind: kind, mat: mat, shape: "beam", p0: p0, p1: p1, w: w, d: d, up: up || [0, 1, 0], meta: meta || {} };
}
/* An upright box, axis-aligned in the world. */
export function boxMember(kind, mat, x0, x1, ya, yb, z0, z1, meta) {
  var dx = x1 - x0, dy = yb - ya, dz = z1 - z0, xc = (x0 + x1) / 2, yc = (ya + yb) / 2, zc = (z0 + z1) / 2;
  if (dy >= dx && dy >= dz) return beamMember(kind, mat, [xc, ya, zc], [xc, yb, zc], dx, dz, [0, 0, 1], meta);
  if (dx >= dz) return beamMember(kind, mat, [x0, yc, zc], [x1, yc, zc], dz, dy, [0, 1, 0], meta);
  return beamMember(kind, mat, [xc, yc, z0], [xc, yc, z1], dx, dy, [0, 1, 0], meta);
}
/* A board on wall w, in the wall's own coordinates: u along the wall, y
   height, o out from the siding plane (framing has o < 0, inside). */
export function wallMember(kind, mat, w, u0, u1, ya, yb, o0, o1, meta) {
  var uc = (u0 + u1) / 2, yc = (ya + yb) / 2, oc = (o0 + o1) / 2;
  meta = Object.assign({}, meta || {}, { at: { u0: u0, u1: u1, y0: ya, y1: yb, o0: o0, o1: o1 } });
  if (yb - ya >= u1 - u0) return beamMember(kind, mat, wpt(w, uc, ya, oc), wpt(w, uc, yb, oc), u1 - u0, o1 - o0, [w.n[0], w.n[1], w.n[2]], meta);
  return beamMember(kind, mat, wpt(w, u0, yc, oc), wpt(w, u1, yc, oc), o1 - o0, yb - ya, [0, 1, 0], meta);
}
/* A flat horizontal plate: polygon `poly` in (x, z), from height ya to yb. */
export function slabMember(kind, mat, poly, ya, yb, meta) {
  return prismMember(kind, mat, poly, [0, ya, 0], [1, 0, 0], [0, 0, 1], [0, 1, 0], yb - ya, meta);
}
export function prismMember(kind, mat, poly, origin, e1, e2, e3, t, meta) {
  return { kind: kind, mat: mat, shape: "prism", poly: poly, origin: origin, e1: e1, e2: e2, e3: e3, t: t, meta: meta || {} };
}
function wpt(w, u, y, o) {
  if (w.ox !== undefined) return [w.ox + w.ax[0] * u + w.n[0] * o, y, w.oz + w.ax[2] * u + w.n[2] * o];
  var c = w.cx || 0;
  if (w.n[2] !== 0) return [c + w.ax[0] * u, y, w.at + w.n[2] * o];
  return [w.at + w.n[0] * o, y, c + w.ax[2] * u];
}
export { wpt as framePt };

/* Is this member big enough to be a real piece? (a board cut to nothing is not drawn) */
export function solidEnough(m) {
  if (m.shape === "beam") {
    var L = Math.hypot(m.p1[0] - m.p0[0], m.p1[1] - m.p0[1], m.p1[2] - m.p0[2]);
    return L > 1e-4 && m.w > 1e-4 && m.d > 1e-4;
  }
  return m.t > 1e-4 && m.poly && m.poly.length >= 3 && Math.abs(polyArea(m.poly)) > 1e-6;
}

/* Draw a list of members. Each carries its stage (or the part's, `stage`);
   a member with meta.glowItem is drawn as that item (it glows when selected). */
export function drawMembers(kit, list, stage) {
  var cur = null;
  for (var i = 0; i < list.length; i++) {
    var m = list[i];
    if (!solidEnough(m)) continue;
    var st = m.stage || stage;
    if (st !== cur) { kit.setStage(st); cur = st; }
    if (m.meta && m.meta.glowItem) kit.setItem(m.meta.glowItem);
    var b = frameMat(kit, m.mat);
    if (m.shape === "beam") kit.beam(b, m.p0, m.p1, m.w, m.d, m.up);
    else drawPrism(kit, b, m);
    if (m.meta && m.meta.glowItem) kit.setItem(null);
  }
}

/* A flat polygon given thickness: its two faces and its edges, every face
   wound to face outward (the kit draws a triangle from the side it is wound
   anticlockwise from). */
export function drawPrism(kit, b, m) {
  var P = m.poly, o = m.origin, e1 = m.e1, e2 = m.e2, e3 = m.e3, t = m.t, n = P.length;
  function at(p, h) {
    return [o[0] + e1[0] * p[0] + e2[0] * p[1] + e3[0] * h, o[1] + e1[1] * p[0] + e2[1] * p[1] + e3[1] * h, o[2] + e1[2] * p[0] + e2[2] * p[1] + e3[2] * h];
  }
  function tri(a, c, d, ua, uc, ud, want) {
    var nn = cross3(sub3(c, a), sub3(d, a));
    if (dot3(nn, want) < 0) kit.pushTri(b, a, d, c, ua, ud, uc); else kit.pushTri(b, a, c, d, ua, uc, ud);
  }
  var neg = [-e3[0], -e3[1], -e3[2]];
  triangulate(P).forEach(function (tr) {
    var A = P[tr[0]], B = P[tr[1]], C = P[tr[2]];
    var uA = [A[0] / 0.8, A[1] / 0.8], uB = [B[0] / 0.8, B[1] / 0.8], uC = [C[0] / 0.8, C[1] / 0.8];
    tri(at(A, 0), at(B, 0), at(C, 0), uA, uB, uC, neg);
    tri(at(A, t), at(B, t), at(C, t), uA, uB, uC, e3);
  });
  var ccw = polyArea(P) > 0;
  for (var i = 0; i < n; i++) {
    var p = P[i], q = P[(i + 1) % n];
    var dx = q[0] - p[0], dy = q[1] - p[1], len = Math.hypot(dx, dy);
    if (len < 1e-9) continue;
    var out2 = ccw ? [dy, -dx] : [-dy, dx];
    var out3 = norm3([e1[0] * out2[0] + e2[0] * out2[1], e1[1] * out2[0] + e2[1] * out2[1], e1[2] * out2[0] + e2[2] * out2[1]]);
    var a = at(p, 0), c = at(q, 0), d = at(q, t), e = at(p, t);
    var U = len / 0.8, V = t / 0.8;
    tri(a, c, d, [0, 0], [U, 0], [U, V], out3);
    tri(a, d, e, [0, 0], [U, V], [0, V], out3);
  }
}

/* ----------------------------------------------------------------- polygons
   2-D polygons are lists of [a, b] points. */

export function polyArea(P) {
  var s = 0;
  for (var i = 0; i < P.length; i++) { var p = P[i], q = P[(i + 1) % P.length]; s += p[0] * q[1] - q[0] * p[1]; }
  return s / 2;
}
/* keep the part of P where a*x + b*y + c >= 0 */
export function clipHalf(P, a, b, c) {
  var out = [];
  for (var i = 0; i < P.length; i++) {
    var p = P[i], q = P[(i + 1) % P.length];
    var fp = a * p[0] + b * p[1] + c, fq = a * q[0] + b * q[1] + c;
    if (fp >= 0) out.push(p);
    if ((fp >= 0) !== (fq >= 0)) { var s = fp / (fp - fq); out.push([p[0] + (q[0] - p[0]) * s, p[1] + (q[1] - p[1]) * s]); }
  }
  return out;
}
/* the part of P inside the box [x0,x1] x [y0,y1] (any simple polygon; the
   box is convex, so this is exact whenever the answer is one piece) */
export function clipRect(P, x0, x1, ya, yb) {
  var Q = clipHalf(P, 1, 0, -x0);
  Q = clipHalf(Q, -1, 0, x1);
  Q = clipHalf(Q, 0, 1, -ya);
  Q = clipHalf(Q, 0, -1, yb);
  return cleanPoly(Q);
}
/* drop repeated and in-line points; nothing at all if it has no area */
export function cleanPoly(P) {
  var Q = [];
  for (var i = 0; i < P.length; i++) {
    var p = P[i], last = Q[Q.length - 1];
    if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) > 1e-9) Q.push(p);
  }
  if (Q.length > 1 && Math.hypot(Q[0][0] - Q[Q.length - 1][0], Q[0][1] - Q[Q.length - 1][1]) <= 1e-9) Q.pop();
  var changed = true;
  while (changed && Q.length >= 3) {
    changed = false;
    for (var j = 0; j < Q.length; j++) {
      var a = Q[(j + Q.length - 1) % Q.length], b = Q[j], c = Q[(j + 1) % Q.length];
      var cr = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      if (Math.abs(cr) < 1e-10) { Q.splice(j, 1); changed = true; break; }
    }
  }
  if (Q.length < 3 || Math.abs(polyArea(Q)) < 1e-7) return [];
  return Q;
}
/* ear clipping: triangles as index triples */
export function triangulate(P) {
  var n = P.length;
  if (n < 3) return [];
  var idx = [];
  for (var i = 0; i < n; i++) idx.push(i);
  if (polyArea(P) < 0) idx.reverse();
  var tris = [], guard = 0;
  while (idx.length > 3 && guard++ < 10 * n) {
    var cut = false;
    for (var k = 0; k < idx.length; k++) {
      var ia = idx[(k + idx.length - 1) % idx.length], ib = idx[k], ic = idx[(k + 1) % idx.length];
      var a = P[ia], b = P[ib], c = P[ic];
      var cr = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      if (cr <= 1e-12) continue;
      var inside = false;
      for (var j = 0; j < idx.length; j++) {
        var q = idx[j];
        if (q === ia || q === ib || q === ic) continue;
        if (inTri(P[q], a, b, c)) { inside = true; break; }
      }
      if (inside) continue;
      tris.push([ia, ib, ic]); idx.splice(k, 1); cut = true; break;
    }
    if (!cut) break;
  }
  if (idx.length === 3) tris.push([idx[0], idx[1], idx[2]]);
  else if (idx.length > 3) for (var f = 1; f < idx.length - 1; f++) tris.push([idx[0], idx[f], idx[f + 1]]);
  return tris;
}
function inTri(p, a, b, c) {
  function s(u, v, w) { return (v[0] - u[0]) * (w[1] - u[1]) - (v[1] - u[1]) * (w[0] - u[0]); }
  var d1 = s(a, b, p), d2 = s(b, c, p), d3 = s(c, a, p);
  return d1 >= -1e-12 && d2 >= -1e-12 && d3 >= -1e-12;
}
export function pointInPoly(p, P) {
  var inside = false;
  for (var i = 0, j = P.length - 1; i < P.length; j = i++) {
    var a = P[i], b = P[j];
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

/* ------------------------------------------------------ the floor, framed */

function rect(x0, x1, z0, z1) { return [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]; }

/* The enclosed room's outline at the siding planes, in (x, z) -- the same
   walls parts/siding.js draws: a front porch stops the room at the front
   wall, a side porch cuts its notch out of the door side, the corner porch
   cuts its end and runs its angled wall P1 across. On the kennel the room is
   the back half (the front half is the run). */
export function roomOutline(plan) {
  var W = plan.W, L = plan.L, t = plan.t, ws = plan.ws, sp = plan.span;
  if (t.kennel) return rect(-W / 2, W / 2, -L / 2, 0);
  if (t.porch === "F") return rect(-W / 2, W / 2, -L / 2, ws.F.at);
  if (t.porch === "S") {
    var xn = W / 2 - 4;
    if (sp.mid) return [[-W / 2, -L / 2], [W / 2, -L / 2], [W / 2, sp.z0], [xn, sp.z0], [xn, sp.z1], [W / 2, sp.z1], [W / 2, L / 2], [-W / 2, L / 2]];
    if (sp.f) return [[-W / 2, -L / 2], [xn, -L / 2], [xn, sp.z1], [W / 2, sp.z1], [W / 2, L / 2], [-W / 2, L / 2]];
    return [[-W / 2, -L / 2], [W / 2, -L / 2], [W / 2, sp.z0], [xn, sp.z0], [xn, L / 2], [-W / 2, L / 2]];
  }
  if (t.porch === "C") {
    var a = cornerPorchPoints(plan);
    return [[-W / 2, -L / 2], [W / 2, -L / 2], a.rEnd, a.p3in, a.p2top, a.p1end, [-W / 2, ws.F.at]];
  }
  return rect(-W / 2, W / 2, -L / 2, L / 2);
}
/* The corner porch's wall ends, read off plan.ws (model/frame.js wallDefs). */
function cornerPorchPoints(plan) {
  var ws = plan.ws;
  function pt(w, u) { var p = wpt(w, u, 0, 0); return [p[0], p[2]]; }
  return {
    p1end: pt(ws.P1, -ws.P1.len / 2),     /* where P1 meets the stub of the front wall */
    p2top: pt(ws.P1, ws.P1.len / 2),      /* where P1 meets P2 */
    p3in: pt(ws.P3, -ws.P3.len / 2),      /* where P2 meets P3 */
    rEnd: pt(ws.P3, ws.P3.len / 2),       /* where P3 meets the R wall */
  };
}
/* The open porch decks' outlines at the building's edges, in (x, z). */
export function porchOutlines(plan) {
  var W = plan.W, L = plan.L, t = plan.t, ws = plan.ws, sp = plan.span;
  if (t.porch === "F") return [rect(-W / 2, W / 2, ws.F.at, L / 2)];
  if (t.porch === "S") return [rect(W / 2 - 4, W / 2, sp.z0, sp.z1)];
  if (t.porch === "C") {
    var a = cornerPorchPoints(plan);
    return [[a.rEnd, [W / 2, L / 2], [-W / 2, L / 2], [-W / 2, ws.F.at], a.p1end, a.p2top, a.p3in]];
  }
  return [];
}

/* Everything the floor framing needs to know, in one object. */
export function floorPlanOf(plan) {
  var W = plan.W, L = plan.L, t = plan.t, con = plan.construction || {};
  var fl = con.floor || {}, dk = fl.deck || {};
  var FIN = floorInset(plan);
  var fp = { x0: -W / 2 + FIN, x1: W / 2 - FIN, z0: -L / 2 + FIN, z1: L / 2 - FIN };
  var layers = Math.max(1, Math.round(dk.layers != null ? +dk.layers : 1));
  var deckT1 = (dk.thicknessIn != null ? +dk.thicknessIn : 0.625) / 12;
  var deckT = deckT1 * layers;
  var joist = lumberSize(fl.joist || "2x6");
  var rim = lumberSize(fl.rim || fl.joist || "2x6");
  var porchJoist = lumberSize((con.porch && con.porch.joist) || fl.joist || "2x6");
  var spacing = (fl.spacingIn != null ? +fl.spacingIn : 16) / 12;
  /* Only the manual floor study uses Alan's measured section and notched
     seat. Every ordinary plan retains the original finished-floor datum. */
  var study = plan.floorStudy;
  if (study) {
    joist = Object.assign({}, joist, { nominal:study.joists.nominal, t:study.joists.widthFt, d:study.joists.heightFt });
    spacing = study.joists.spacingFt;
  }
  var front = (t.porch === "F" || t.porch === "C");
  var zP = front ? plan.ws.F.at : null;
  var fpPoly = rect(fp.x0, fp.x1, fp.z0, fp.z1);
  var room = clipRect(roomOutline(plan), fp.x0, fp.x1, fp.z0, fp.z1);
  var porches = porchOutlines(plan).map(function (P) { return clipRect(P, fp.x0, fp.x1, fp.z0, fp.z1); }).filter(function (P) { return P.length; });
  return {
    W: W, L: L, FIN: FIN, fp: fp, footprint: fpPoly,
    room: room,                                   /* the enclosed room, inset to the slab */
    deckArea: t.kennel ? fpPoly : room,           /* where the tongue-and-groove decking goes */
    porches: porches,                             /* the open porch decks */
    joist: joist, rim: rim, porchJoist: porchJoist, spacing: spacing,
    layers: layers, deckT1: deckT1, deckT: deckT,
    joistBot: study ? study.joistBottomFt : FLOOR_TOP_OF_SKIDS,
    joistTop: study ? study.joistTopFt : y0 - deckT,
    frontPorch: front, zP: zP,
    roomRect: { x0: fp.x0, x1: fp.x1, z0: fp.z0, z1: front ? zP : fp.z1 },
    porchRect: front ? { x0: fp.x0, x1: fp.x1, z0: zP, z1: fp.z1 } : null,
  };
}

/* The joists of one rectangular frame: a rim along each long side (the full
   length), an end joist across each end that has one (between the rims), and
   joists between the rims at `spacing` on centre measured from the back end,
   leaving out any that would crowd the front end joist. */
export function rectFrame(R, F, opts) {
  var out = [], jl = opts.joist, rl = opts.rim, s = F.spacing;
  var yb = F.joistBot, yt = F.joistTop, jw = jl.t, rw = rl.t;
  var xa = R.x0 + rw, xb = R.x1 - rw;
  var who = opts.frame;
  out.push(boxMember("rim", "treated", R.x0, R.x0 + rw, yb, yt, R.z0, R.z1, { frame: who, side: "L", size: rl.nominal, support: "fasten" }));
  out.push(boxMember("rim", "treated", R.x1 - rw, R.x1, yb, yt, R.z0, R.z1, { frame: who, side: "R", size: rl.nominal, support: "fasten" }));
  if (opts.backEnd) out.push(boxMember("end-joist", "treated", xa, xb, yb, yt, R.z0, R.z0 + jw, { frame: who, end: "back", size: jl.nominal, zc: R.z0 + jw / 2, support: "bear" }));
  var zEnd = opts.frontEnd ? R.z1 - jw : R.z1;
  for (var k = 1; ; k++) {
    var c = R.z0 + k * s;
    if (c + jw / 2 > zEnd + 1e-9) break;
    out.push(boxMember("joist", "treated", xa, xb, yb, yt, c - jw / 2, c + jw / 2, { frame: who, layout: k, origin: R.z0, spacing: s, size: jl.nominal, zc: c, support: "bear" }));
  }
  if (opts.frontEnd) out.push(boxMember("end-joist", "treated", xa, xb, yb, yt, R.z1 - jw, R.z1, { frame: who, end: "front", size: jl.nominal, zc: R.z1 - jw / 2, support: "bear" }));
  return out;
}

/* Walls that run across the width and stand on the floor away from its ends:
   their bottom plate's z range. (The wall frame is inset WALL_INSET behind
   the siding and is one stud deep; the kennel partition PARTITION_INSET.) */
export function crossWallPlates(plan) {
  var ws = plan.ws, out = [];
  var D = lumberSize((plan.construction.walls || {}).stud || "2x4").d;
  function add(key, at, nz, inset) {
    var a = at + nz * (-inset), b = at + nz * (-inset - D);
    out.push({ key: key, z0: Math.min(a, b), z1: Math.max(a, b) });
  }
  ["S2", "S3", "P3"].forEach(function (k) { if (ws[k]) add(k, ws[k].at, ws[k].n[2], WALL_INSET); });
  if (plan.t.kennel) add("KP", 0, 1, PARTITION_INSET);
  return out;
}

export function floorFrameMembers(plan) {
  var F = floorPlanOf(plan);
  var out = rectFrame(F.roomRect, F, { joist: F.joist, rim: F.rim, backEnd: true, frontEnd: true, frame: "room" });
  var jw = F.joist.t, rw = F.rim.t;
  var joists = out.filter(function (m) { return m.kind === "joist" || m.kind === "end-joist"; });
  crossWallPlates(plan).forEach(function (wp) {
    if (wp.z1 <= F.roomRect.z0 || wp.z0 >= F.roomRect.z1) return;
    var c = (wp.z0 + wp.z1) / 2, half = (wp.z1 - wp.z0) / 2;
    var hit = joists.filter(function (j) { return Math.abs(j.meta.zc - c) < jw - 1e-9; })[0];
    if (hit) {
      if (Math.abs(hit.meta.zc - c) <= half - jw / 2 + 1e-9) return;       /* a layout joist is already under the wall */
      c = hit.meta.zc + (c > hit.meta.zc ? jw : -jw);                       /* double it, on the wall's side */
    }
    var m = boxMember("wall-joist", "treated", F.roomRect.x0 + rw, F.roomRect.x1 - rw, F.joistBot, F.joistTop, c - jw / 2, c + jw / 2,
      { frame: "room", wall: wp.key, size: F.joist.nominal, zc: c, support: "bear" });
    out.push(m); joists.push(m);
  });
  /* The lesson's explicit open end rebates replace the old inset end cuts.
     Keep a single board at each end, moving it only enough to fit its seat.
     This placement is provisional; the rim/deck footprint stays unchanged. */
  var endRebates = plan.floorStudy && plan.floorStudy.notches.endRebates;
  if (endRebates) out.forEach(function(m) {
    if (m.kind !== "end-joist") return;
    var end = m.meta.end === "back" ? "negative" : "positive";
    var rebate = endRebates[end];
    if (!rebate) return;
    var tip = plan.floorStudy.skids.lengthFt/2;
    var a = end === "negative" ? -tip : tip-rebate.lengthFt;
    var b = end === "negative" ? -tip+rebate.lengthFt : tip;
    var centre = (m.p0[2]+m.p1[2])/2;
    var next = Math.max(a+m.w/2,Math.min(b-m.w/2,centre));
    m.p0[2] += next-centre; m.p1[2] += next-centre;
    m.meta.zc = next; m.meta.endRebate = end;
    m.meta.placementStatus = plan.floorStudy.status.endMemberPlacement;
  });
  out.forEach(function (m) { m.stage = "floor-frame"; });
  return out;
}

export default {
  id: "floor-frame",
  name: "Floor frame",
  stage: "floor-frame",
  realLife: "{floor.joist} floor joists at {floor.spacingIn} in on centre across the width, sitting on the skids, with a {floor.rim} rim joist along both long sides and an end joist across each end; a wall standing on the floor between the ends gets a joist of its own under it.",
  appliesTo(plan) { return true; },
  members: floorFrameMembers,
  build(plan, kit) {
    drawMembers(kit, floorFrameMembers(plan), "floor-frame");
  },
};
