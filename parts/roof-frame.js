/* ROOF FRAMING: the trusses (or rafters) that hold the roof up. Node-safe.

   NEW -- Barnwright drew no framing. This part builds the real roof frame of
   the building inside the roof Barnwright draws, so the Framing view and
   Watch-it-build can show how the building is really put together. It never
   changes the finished picture: it runs only with assemble(plan, {frames:
   true}), after every finished part, into its own materials ("lumber" for the
   boards, "plywood" for the gusset plates), and every triangle carries the
   stage "roof-frame" (a framing stage, hidden in the Finished view).

   WHAT IS BUILT (per plan.construction.roof; library/construction.json):
   * roof.framing "truss" (the default): a truss every roof.spacingIn inches
     on centre along the length, and one at each gable end. A truss is
       - TOP CHORDS ({roof.chord}) following the roof line of EVERY roof shape
         (gable, the gambrel -- the Standard Barn's own steep shoulders come in
         through its gambrel trait --, the cottage saltbox with its level-cut
         tails, the lean-to, the single slope, the Dormer Shed's steeper
         gable), one board per slope, mitred where two slopes meet;
       - a BOTTOM CHORD ({roof.chord}) at the wall top (topY) between the
         walls, its ends cut to the top chords at the heels. The drawn roof
         comes down to the wall top at the siding, so on every roof but the
         cottage's the bottom chord's cut ends stop short of the wall plates
         (a few inches on a barn, 4 to 8 in on a gable, up to two feet on a
         lean-to's shallow slope) and the top chord's seat bears on the plates
         instead; the heel plate ties the two together;
       - WEBS: a king post and, from 10 ft wide, two struts on a gable or
         saltbox; a collar tie across the knees and a king post above it on a
         gambrel (the space under the collar is left open for the loft and for
         headroom); an end post against the tall wall and posts with
         diagonals between them on a lean-to or single slope (a mono truss --
         the tall wall itself stands in for the post at its high end);
       - {roof.gussets} GUSSET PLATES (half an inch) on both faces at the apex,
         the knees, the heels and the king-post foot; a heel plate runs in
         from the wall until the bottom chord is half its depth (at least a
         foot), so it always covers the joint between the two chords.
     The two END trusses (at the gable ends) have no webs and no gussets: the
     gable studs (parts/gable-frame.js) fill them, flush with the outside, the
     way a gable-end truss is built, and the siding covers their outer face.
   * roof.framing "rafter": the same top-chord boards as rafters in pairs, a
     ridge board where the roof peaks, and a collar tie on every pair but the
     end ones (a gambrel's collar sits across its knees, with knee gussets); a
     lean-to or single slope is plain rafters.

   HOW REAL LUMBER FITS BARNWRIGHT'S DRAWN ROOF (docs/ARCHITECTURE.md, Framing
   datums 3): every roof member lives UNDER the underside of the drawn roof
   slab (the profile line, run out over the eaves exactly as parts/roofing.js
   draws it), under the roof deck (roof-deck part: OSB {roofDeck.sheathingIn}
   in, or {roofDeck.purlins.size} purlins laid flat), and above topY inside the
   walls. Barnwright's roof line meets the wall top in a sharp corner at the
   siding, so where a chord crosses a wall it gets a seat cut at topY (the
   bird's-mouth) and ends in a point at the wall line; the tail outside the
   wall hangs under the eave overhang, never past the fascia and never below
   the eave: on a bare metal eave (utility sheds, garages, barns, the lean-to)
   it is cut level with the bottom of the metal's cut edge, on the cottage it
   is cut level with the soffit ("the rafters bear on the plate and the tails
   are cut off level for the soffit" -- Alan's section of the cottage eave),
   and the single slope's boxed eave, whose sloped soffit IS the drawn roof
   underside, leaves no room for tails at all -- so nothing is framed out
   there, not even the deck, which would have nothing to be nailed to. A lean-to's or single slope's tall wall rises to the roof line, so
   the chords stop against the inside of its studs.

   WHAT ELSE LIVES HERE: this file is the roof-geometry hub the other roof
   framing parts share, so they can never disagree about where the roof is:
     roofSection(plan)       the roof line as drawn, its slopes, the deck and
                             chord sizes, the wall zones, the eaves
     trussLayout(plan)       where every truss stands, which ones the dormer
                             cuts, which ones cross a loft
     loftZones(plan)         where the loft floors are (parts/loft.js)
     dormerGeom(plan)        the dormer's own geometry, from parts/dormer.js
     dormerHoles(plan)       where the main roof deck is left open under it
     gableOpenings(plan,end) the gable windows, vents and tall doors to frame
     roofFrameMembers(plan)  this part's lumber, as data (the check reads it)
     drawMembers(kit, list)  draw members (kit.beam for a plain board, a cut
                             prism for a board with a seat cut or a mitre)
   and the small plane-geometry kit they use (clipHalf, band, fitRoof...).

   A MEMBER is one piece of lumber or sheet, as data:
     { poly: [[x,y],...] convex, anticlockwise seen from +z; z0, z1; kind; mat }
   -- a shape in the building's cross-section (x across, y up) pushed along the
   length (z). Every piece of roof framing is one: a truss is a flat thing in
   an x-y plane, and a purlin, a sheet, a header or a ridge board runs along z.

   STAGE "roof-frame" (kind frame): hidden in the Finished view, shown in the
   Framing view, lands after the wall framing in Watch-it-build and is covered
   (hidden) once the roofing lands. PIPELINE entry "roof-frame", among the
   framing entries (parts/index.js). */

import { y0 } from "../engine/constants.js";
import { texFlat } from "../engine/tex-names.js";
import { ROOF_TH, RAKE_STEP, roofShape, cottageEave, profileYat } from "../model/roof-shapes.js";
import { openingRect } from "../model/layout.js";
import { pickRule } from "../model/construction.js";
import { eaveOverhangs, rakeOverhangOf } from "./roofing.js";
import { ventSpot } from "./gable-vent.js";
import { trussStudyMembers } from "../model/truss-study.js";
import { drawMembers as drawStudyMembers } from "./floor-frame.js";

/* Plywood gusset plates are half an inch thick (the construction settings say
   only "plywood"; half inch is the usual truss plate). */
export const GUSSET_T = 0.5 / 12;
/* Pieces smaller than this (square feet of cross-section) are slivers left by
   a cut and are not drawn. */
const MIN_AREA = 1e-5;

/* ================= the plane-geometry kit ================= */

/* Keep the part of a convex polygon where a*x + b*y <= c. */
export function clipHalf(poly, h) {
  if (!poly || poly.length < 3) return [];
  var a = h[0], b = h[1], c = h[2], out = [];
  for (var i = 0; i < poly.length; i++) {
    var P = poly[i], Q = poly[(i + 1) % poly.length];
    var fp = c - (a * P[0] + b * P[1]), fq = c - (a * Q[0] + b * Q[1]);
    if (fp >= 0) out.push(P);
    if ((fp >= 0) !== (fq >= 0)) {
      var t = fp / (fp - fq);
      out.push([P[0] + (Q[0] - P[0]) * t, P[1] + (Q[1] - P[1]) * t]);
    }
  }
  return out;
}
export function clipAll(poly, hs) {
  var p = poly;
  for (var i = 0; i < hs.length && p.length >= 3; i++) p = clipHalf(p, hs[i]);
  return p;
}
export function polyArea(p) {
  var s = 0;
  for (var i = 0; i < p.length; i++) { var a = p[i], b = p[(i + 1) % p.length]; s += a[0] * b[1] - b[0] * a[1]; }
  return s / 2;
}
/* Drop repeated and in-line corners, make it anticlockwise; null when nothing
   worth drawing is left. */
export function cleanPoly(poly) {
  if (!poly || poly.length < 3) return null;
  var p = [];
  poly.forEach(function (q) {
    var l = p[p.length - 1];
    if (!l || Math.abs(l[0] - q[0]) > 1e-7 || Math.abs(l[1] - q[1]) > 1e-7) p.push([q[0], q[1]]);
  });
  while (p.length > 1 && Math.abs(p[0][0] - p[p.length - 1][0]) <= 1e-7 && Math.abs(p[0][1] - p[p.length - 1][1]) <= 1e-7) p.pop();
  var changed = true;
  while (changed && p.length >= 3) {
    changed = false;
    for (var i = 0; i < p.length; i++) {
      var A = p[(i + p.length - 1) % p.length], B = p[i], C = p[(i + 1) % p.length];
      var cr = (B[0] - A[0]) * (C[1] - B[1]) - (B[1] - A[1]) * (C[0] - B[0]);
      if (Math.abs(cr) < 1e-10) { p.splice(i, 1); changed = true; break; }
    }
  }
  if (p.length < 3) return null;
  var ar = polyArea(p);
  if (Math.abs(ar) < MIN_AREA) return null;
  if (ar < 0) p.reverse();
  return p;
}
export function rectPoly(x0, y0_, x1, y1_) { return [[x0, y0_], [x1, y0_], [x1, y1_], [x0, y1_]]; }
/* Take the open strip x0 < x < x1 out of a polygon: the pieces either side. */
export function splitX(poly, x0, x1) {
  var out = [];
  var a = cleanPoly(clipHalf(poly, [1, 0, x0])), b = cleanPoly(clipHalf(poly, [-1, 0, -x1]));
  if (a) out.push(a); if (b) out.push(b);
  return out;
}
/* The same across y: the pieces below y0_ and above y1_. */
export function splitY(poly, y0_, y1_) {
  var out = [];
  var a = cleanPoly(clipHalf(poly, [0, 1, y0_])), b = cleanPoly(clipHalf(poly, [0, -1, -y1_]));
  if (a) out.push(a); if (b) out.push(b);
  return out;
}
/* A board of width w along the line p -> q, run on past both ends by E (the
   clipping decides where it really ends). */
export function strip(p, q, w, E) {
  var dx = q[0] - p[0], dy = q[1] - p[1], l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l;
  var nx = -uy * w / 2, ny = ux * w / 2, e = E || 0;
  var a = [p[0] - ux * e, p[1] - uy * e], b = [q[0] + ux * e, q[1] + uy * e];
  return [[a[0] - nx, a[1] - ny], [b[0] - nx, b[1] - ny], [b[0] + nx, b[1] + ny], [a[0] + nx, a[1] + ny]];
}
export function centroid(p) {
  var x = 0, y = 0; p.forEach(function (q) { x += q[0]; y += q[1]; });
  return [x / p.length, y / p.length];
}

/* ================= lumber sizes ================= */

/* Real (dressed) sizes of nominal lumber, in inches. */
var DRESSED = { 1: 0.75, 2: 1.5, 3: 2.5, 4: 3.5, 6: 5.5, 8: 7.25, 10: 9.25, 12: 11.25 };
/* "2x4" -> { t: 1.5 in, d: 3.5 in } in FEET; "2x6 doubled" -> t is two boards. */
export function lumberFt(name) {
  var m = /^\s*(\d+)\s*x\s*(\d+)(.*)$/i.exec(String(name == null ? "" : name));
  if (!m || DRESSED[+m[1]] == null || DRESSED[+m[2]] == null) {
    throw new Error("\"" + name + "\" is not a lumber size this designer knows (write it like 2x4, 2x6 or \"2x8 doubled\").");
  }
  var plies = /tripled/i.test(m[3]) ? 3 : /doubled/i.test(m[3]) ? 2 : 1;
  return { t: DRESSED[+m[1]] * plies / 12, d: DRESSED[+m[2]] / 12, name: String(name) };
}

/* ================= the roof as drawn ================= */

/* Everything about the roof's cross-section the framing needs.
   RL is the underside of the roof slab exactly as parts/roofing.js draws it:
   the profile with its eaves run out along the slope (or the cottage's
   level-soffit eave). Each slope segment carries its direction t (always
   toward +x) and its DOWN normal n; an "offset d" line of a segment is the
   roof line moved d feet straight down into the roof (perpendicular to the
   slope). */
export function roofSection(plan) {
  var t = plan.t, W = plan.W, L = plan.L, topY = plan.topY, con = plan.construction || {};
  var roofC = con.roof || {}, deckC = con.roofDeck || {}, wallC = con.walls || {};
  var sh = roofShape(t, con);
  var EO = eaveOverhangs(plan);
  var gam = t.roof === "gambrel", lean = t.roof === "lean", slp = t.roof === "slope", cot = !!t.cottage;
  var ov = gam ? 0.10 : rakeOverhangOf(plan);            /* profileRoof forces a gambrel to 0.10 */
  var P = plan.prof.map(function (q) { return q.slice(); });
  function ext(i, j, d) { var a = P[i], b = P[j]; var dx = a[0] - b[0], dy = a[1] - b[1], l = Math.hypot(dx, dy) || 1; a[0] += dx / l * d; a[1] += dy / l * d; }
  /* the same eave rules, in the same order, as parts/roofing.js profileRoof */
  if (lean) { ext(P.length - 1, P.length - 2, EO.right); if (EO.left) ext(0, 1, EO.left); }
  else if (slp) { ext(P.length - 1, P.length - 2, EO.right); ext(0, 1, EO.left); }
  else if (cot) { cottageEave(P, ROOF_TH, sh.cottageEave); }
  else { ext(0, 1, EO.left); ext(P.length - 1, P.length - 2, EO.right); }
  var cutE = !cot && !slp;
  var drop = cutE ? 0.03 : (cot ? Math.max(0.02, sh.cottageEave.fasciaIn / 12 - ROOF_TH) : 0.24);

  var chord = lumberFt(roofC.chord || "2x4");
  var stud = lumberFt(wallC.stud || "2x4");
  var deckType = deckC.type === "purlins" ? "purlins" : "osb";
  var purlin = lumberFt((deckC.purlins && deckC.purlins.size) || "2x4");
  var sheathIn = deckC.sheathingIn != null ? +deckC.sheathingIn : 0.4375;
  /* the deck's thickness under the steel: a flat purlin is its thin side */
  var deckT = deckType === "purlins" ? purlin.t : sheathIn / 12;

  var segs = [];
  for (var i = 0; i < P.length - 1; i++) {
    var A = P[i], B = P[i + 1], dx = B[0] - A[0], dy = B[1] - A[1], len = Math.hypot(dx, dy);
    var tx = dx / len, ty = dy / len;
    segs.push({ i: i, A: A, B: B, len: len, t: [tx, ty], n: [ty, -tx], upper: gam && i > 0 && i < P.length - 2 });
  }
  /* the peak (where the roof rises into it on one side and falls away on the
     other -- a gambrel's knees are NOT peaks, as in profileRoof's isPeak) */
  var peak = null;
  for (var k = 1; k < P.length - 1; k++) if (P[k][1] - P[k - 1][1] > 0.0005 && P[k + 1][1] - P[k][1] < -0.0005) peak = k;

  /* THE WALL ZONES. The long walls' framing sits inside the siding plane
     (o from -0.02 to -0.02 - stud depth) and is the wall-frame part's; inside
     them a roof member must stay above the wall's own top (topY, or the tall
     wall's top on a lean-to or single slope). */
  var zd = 0.02 + stud.d;
  var topL = Math.max(topY, plan.ws.L.top), topR = Math.max(topY, plan.ws.R.top);
  var tallL = topL > topY + 1e-9, tallR = topR > topY + 1e-9;
  var inner = [];
  if (tallL) inner.push({ x0: -W / 2, x1: -W / 2 + zd, floor: topL });
  inner.push({ x0: tallL ? -W / 2 + zd : -W / 2, x1: tallR ? W / 2 - zd : W / 2, floor: topY });
  if (tallR) inner.push({ x0: W / 2 - zd, x1: W / 2, floor: topR });

  function side(isLeft) {
    var tip = isLeft ? P[0] : P[P.length - 1];
    var eave = isLeft ? tip[0] < -W / 2 - 1e-6 : tip[0] > W / 2 + 1e-6;
    var tails = eave && (cutE || cot);
    var floorY = cot ? Math.max(topY, tip[1] - drop) : tip[1] - drop;
    return { left: isLeft, x: tip[0], y: tip[1], eave: eave, tails: tails, floorY: floorY, seg: isLeft ? segs[0] : segs[segs.length - 1] };
  }
  return {
    plan: plan, W: W, L: L, topY: topY, P: P, segs: segs, peak: peak,
    roof: t.roof, gambrel: gam, lean: lean, slope: slp, cottage: cot, mono: lean || slp,
    ov: ov, drop: drop, cutE: cutE,
    chord: chord, stud: stud, purlin: purlin, deckType: deckType, deckT: deckT, sheathFt: sheathIn / 12,
    framing: String(roofC.framing || "truss").toLowerCase() === "rafter" ? "rafter" : "truss",
    spacing: (roofC.spacingIn != null ? +roofC.spacingIn : 24) / 12,
    zd: zd, tallL: tallL, tallR: tallR, topL: topL, topR: topR,
    /* inside faces of the long walls' framing: where a tie between the walls ends */
    innerL: tallL ? -W / 2 + zd : -W / 2 + 0.02, innerR: tallR ? W / 2 - zd : W / 2 - 0.02,
    inner: inner, left: side(true), right: side(false),
  };
}

/* The gable-end (rake) extent along z of segment i: the roof runs past each
   gable end by the rake overhang, and a gambrel's upper sheets a further
   RAKE_STEP (profileRoof). */
export function zRange(sec, i) {
  var st = sec.segs[i] && sec.segs[i].upper ? RAKE_STEP : 0;
  return [-sec.L / 2 - sec.ov - st, sec.L / 2 + sec.ov + st];
}

/* y of segment i's offset-d line at x. */
export function offY(sec, i, d, x) {
  var s = sec.segs[i];
  var q = (x - s.A[0] - s.n[0] * d) / s.t[0];
  return s.A[1] + s.n[1] * d + s.t[1] * q;
}
/* The lowest of all the offset-d lines at x -- the offset of the roof line
   (every roof here is concave, so the region under it is under every line). */
export function envY(sec, d, x) {
  var m = Infinity;
  for (var i = 0; i < sec.segs.length; i++) m = Math.min(m, offY(sec, i, d, x));
  return m;
}
/* Half-planes: keep below segment i's offset-d line / above it. */
export function below(sec, i, d) { var s = sec.segs[i]; return [-s.n[0], -s.n[1], -(s.n[0] * s.A[0] + s.n[1] * s.A[1] + d)]; }
export function above(sec, i, d) { var s = sec.segs[i]; return [s.n[0], s.n[1], s.n[0] * s.A[0] + s.n[1] * s.A[1] + d]; }
export function belowAll(sec, d) { return sec.segs.map(function (s, i) { return below(sec, i, d); }); }

/* The mitre at vertex j (between segments j-1 and j): the half-plane of
   segment j-1's side (left), or of segment j's side. */
function mitre(sec, j, leftSide) {
  var a = sec.segs[j - 1], b = sec.segs[j], V = b.A;
  var m = [a.n[0] + b.n[0], a.n[1] + b.n[1]];
  if (Math.hypot(m[0], m[1]) < 1e-9) m = a.n.slice();
  var q = [m[1], -m[0]];
  var sgn = -(q[0] * a.t[0] + q[1] * a.t[1]);             /* which side segment j-1 is on */
  var h = sgn < 0 ? [q[0], q[1], q[0] * V[0] + q[1] * V[1]] : [-q[0], -q[1], -(q[0] * V[0] + q[1] * V[1])];
  return leftSide ? h : [-h[0], -h[1], -h[2]];
}

/* The band under segment i between offsets d1 < d2, mitred into its
   neighbours and cut plumb at an eave tip. */
export function band(sec, i, d1, d2) {
  var s = sec.segs[i], A = s.A, B = s.B, t = s.t, n = s.n, E = 200;
  var poly = [
    [A[0] + n[0] * d1 - t[0] * E, A[1] + n[1] * d1 - t[1] * E],
    [B[0] + n[0] * d1 + t[0] * E, B[1] + n[1] * d1 + t[1] * E],
    [B[0] + n[0] * d2 + t[0] * E, B[1] + n[1] * d2 + t[1] * E],
    [A[0] + n[0] * d2 - t[0] * E, A[1] + n[1] * d2 - t[1] * E]];
  poly = clipHalf(poly, i > 0 ? mitre(sec, i, false) : [-1, 0, -A[0]]);
  poly = clipHalf(poly, i < sec.segs.length - 1 ? mitre(sec, i + 1, true) : [1, 0, B[0]]);
  return poly;
}

/* The offset-d line as a polyline (its mitre points), run out far past both
   eaves -- the "profile" model/roof-shapes.js gableClip cuts a gable shape
   against. */
export function offsetPolyline(sec, d) {
  var out = [], segs = sec.segs, n = segs.length;
  var far = sec.W + 5;
  out.push([-far, offY(sec, 0, d, -far)]);
  for (var j = 1; j < n; j++) {
    /* intersection of the offset lines of segments j-1 and j */
    var a = segs[j - 1], b = segs[j];
    var pa = [a.A[0] + a.n[0] * d, a.A[1] + a.n[1] * d], pb = [b.A[0] + b.n[0] * d, b.A[1] + b.n[1] * d];
    var den = a.t[0] * b.t[1] - a.t[1] * b.t[0];
    var u = ((pb[0] - pa[0]) * b.t[1] - (pb[1] - pa[1]) * b.t[0]) / den;
    out.push([pa[0] + a.t[0] * u, pa[1] + a.t[1] * u]);
  }
  out.push([far, offY(sec, n - 1, d, far)]);
  return out;
}

/* FIT A PIECE OF THE ROOF INTO THE DRAWN ENVELOPE. Inside the walls it stays
   above the wall top (the seat cut / bird's-mouth); outside a wall it is a
   tail: under the eave, never past the tip (the fascia or the metal's cut
   edge), cut level at the eave's floor -- or, where the eave has no room for
   tails, only the deck's own thickness under the roof line is allowed.
   Returns the convex pieces (a chord that crosses a wall comes back as its
   inside part and its tail). */
export function fitRoof(sec, poly) {
  var out = [], W = sec.W;
  sec.inner.forEach(function (r) {
    var p = cleanPoly(clipAll(poly, [[-1, 0, -r.x0], [1, 0, r.x1], [0, -1, -r.floor]]));
    if (p) out.push(p);
  });
  [sec.left, sec.right].forEach(function (sd) {
    /* an eave with no room for tails (the single slope's boxed eave, whose
       sloped soffit IS the drawn roof's underside) gets no framing and no
       deck: there would be nothing under the deck to nail it to */
    if (!sd.eave || !sd.tails) return;
    var hs = sd.left ? [[1, 0, -W / 2], [-1, 0, -sd.x]] : [[-1, 0, -W / 2], [1, 0, sd.x]];
    hs.push([0, -1, -sd.floorY]);
    var p = cleanPoly(clipAll(poly, hs));
    if (p) out.push(p);
  });
  return out;
}

/* ================= where things are ================= */

/* The loft floors: at each end the style's loft trait names, from the inside
   of that end's framing in to the depth the trait gives (measured from the
   end wall; on a porch cabin from the enclosed end wall, not the gable over
   the porch). Each zone: {end, z0, z1, joist, yd0, yd1} -- the joists stand on
   the wall top plates at topY, the deck (yd0..yd1) on the joists. */
export function loftZones(plan) {
  var lt = plan.t && plan.t.loft;
  if (!lt) return [];
  var con = plan.construction || {}, loftC = con.loft || {};
  var stud = lumberFt((con.walls && con.walls.stud) || "2x4");
  var chord = lumberFt((con.roof && con.roof.chord) || "2x4");
  var joist = lumberFt(loftC.joist || "2x6");
  var truss = String((con.roof && con.roof.framing) || "truss").toLowerCase() !== "rafter";
  var deckIn = (loftC.deck && loftC.deck.thicknessIn != null) ? +loftC.deck.thicknessIn : 0.625;
  var depth = lt.depthFt != null ? +lt.depthFt : 4;
  var ends = Array.isArray(lt.ends) ? lt.ends : ["F", "B"];
  var zF = plan.ws.F.at, zB = plan.ws.B.at;
  var faceF = zF - 0.02 - stud.d, faceB = zB + 0.02 + stud.d;
  var mid = (faceF + faceB) / 2;
  var yd0 = plan.topY + Math.max(joist.d, truss ? chord.d : 0), yd1 = yd0 + deckIn / 12;
  var out = [];
  ends.forEach(function (e) {
    if (e === "F") { var z0 = Math.max(zF - depth, mid + 0.25); if (faceF - z0 > 0.3) out.push({ end: "F", z0: z0, z1: faceF, wallZ: faceF, joist: joist, yd0: yd0, yd1: yd1, spacing: (loftC.spacingIn != null ? +loftC.spacingIn : 16) / 12 }); }
    if (e === "B") { var z1 = Math.min(zB + depth, mid - 0.25); if (z1 - faceB > 0.3) out.push({ end: "B", z0: faceB, z1: z1, wallZ: faceB, joist: joist, yd0: yd0, yd1: yd1, spacing: (loftC.spacingIn != null ? +loftC.spacingIn : 16) / 12 }); }
  });
  return out;
}

/* THE DORMER, worked out exactly as parts/dormer.js draws it (Barnwright's
   dormer(), 2978-3059), plus the few lines its framing needs:
   hx0..hx1 the upper header (just clear of the king post / ridge board, where
   the main trusses are cut), xFi..xFw the front wall's framing (inside the
   face siding at xF), and the dormer roof's underside line (its steel is
   drawn 0.02 above the line through (xI, yI) and (xF, yT)). */
export function dormerGeom(plan) {
  var t = plan.t, st = plan.state;
  if (!t.dormer || !st || st.dormer === "none") return null;
  var dw = +st.dormer;
  if (!(dw > 0)) return null;
  var prof = plan.prof, W = plan.W, L = plan.L;
  var topY = y0 + t.wallH, half = W / 2;
  var D = Math.min(dw, L - 2), hw = D / 2;
  /* vertical face set just above the eave, resting on the main roof */
  var xF = half - 0.50;
  var yB = profileYat(prof, xF);
  /* dormer roof rises backward and ties in just under the ridge cap */
  var xI = 0.12, yI = profileYat(prof, xI) + 0.03;
  var faceH = Math.min(1.95, yI - 0.35 - yB); if (faceH < 1.2) faceH = 1.2;
  var yT = yB + faceH;
  var m = (yI - yT) / (xF - xI);
  var ovF = 0.30, ovS = 0.26;
  var yF = yT - ovF * m;
  /* window band -- white-framed 4-lite windows */
  var n = D >= 8 ? 3 : 2, gap2 = 0.55;
  var ww = Math.min(2.7, (D - 1.5 - (n - 1) * gap2) / n);
  var wh2 = Math.min(1.15, faceH - 0.85), yw = yB + (faceH - 0.28 - wh2) * 0.55;
  var bandW = n * ww + (n - 1) * gap2, wins = [];
  for (var i = 0; i < n; i++) wins.push({ zc: bandW / 2 - ww / 2 - i * (ww + gap2), ww: ww, yw: yw, wh: wh2 });
  var con = plan.construction || {};
  var chord = lumberFt((con.roof && con.roof.chord) || "2x4");
  var stud = lumberFt((con.walls && con.walls.stud) || "2x4");
  /* where the main trusses are cut: just clear of the king post (a web as wide
     as the chord is deep) and of a ridge board */
  var apexX = profileApexX(prof);
  var hx0 = Math.max(xI, apexX + Math.max(chord.d / 2, chord.t / 2)) + 0.005;
  return {
    W: W, L: L, topY: topY, D: D, hw: hw, xF: xF, yB: yB, xI: xI, yI: yI, faceH: faceH, yT: yT, m: m,
    ovF: ovF, ovS: ovS, yF: yF, wins: wins,
    xFw: xF - 0.02, xFi: xF - 0.02 - stud.d, hx0: hx0, hx1: hx0 + 2 * chord.t,
    /* the dormer roof's underside: y at x */
    roofY: function (x) { return yI + 0.02 - m * (x - xI); },
    /* its soffit, from the top of the face out to the fascia */
    soffitY: function (x) { return (yT - 0.02) + ((yF - 0.15) - (yT - 0.02)) * (x - xF) / ovF; },
  };
}
function profileApexX(prof) {
  var best = 0, by = -Infinity;
  for (var i = 0; i < prof.length; i++) if (prof[i][1] > by) { by = prof[i][1]; best = prof[i][0]; }
  return best;
}

/* Where the main roof deck is left open under the dormer: the dormer's inside
   (between its cheek walls, from the upper header down to its front wall) and
   the strip its front wall stands in. Boxes in x and z. */
export function dormerHoles(plan) {
  var dg = dormerGeom(plan);
  if (!dg) return [];
  var stud = lumberFt(((plan.construction || {}).walls || {}).stud || "2x4");
  var zi = dg.hw - 0.02 - stud.d, zw = dg.hw - 0.02;
  return [
    { x0: dg.hx0, x1: dg.xFw, z0: -zi, z1: zi },
    { x0: dg.xFi, x1: dg.xFw, z0: -zw, z1: zw },
  ];
}

/* WHERE EVERY TRUSS (or rafter pair) STANDS: one at each gable end, flush
   inside the gable siding (0.02 in from it, as the walls' framing is), and
   the rest at the spacing from the back end; the last gap before the front
   end truss is whatever is left (never so small that two gusset plates
   touch). Each: {z, end ("B", "F" or null), cut (the dormer opens it), trim
   (the full truss either side of a dormer), loft (the loft zone it crosses)}. */
export function trussLayout(plan) {
  var sec = roofSection(plan), L = plan.L, ct = sec.chord.t;
  var s = sec.spacing;
  var zA = -L / 2 + 0.02 + ct / 2, zB = L / 2 - 0.02 - ct / 2;
  var list = [{ z: zA, end: "B" }];
  var lim = zB - ct - GUSSET_T - 0.005;
  for (var k = 1; zA + k * s <= lim + 1e-9; k++) list.push({ z: zA + k * s, end: null });
  list.push({ z: zB, end: "F" });
  list.forEach(function (tr) { tr.cut = false; tr.trim = false; tr.loft = null; });
  var dg = dormerGeom(plan), reach = ct / 2 + GUSSET_T;
  var trimFace = { minus: null, plus: null };
  if (dg) {
    list.forEach(function (tr) { if (!tr.end && Math.abs(tr.z) - reach < dg.hw) tr.cut = true; });
    var plus = list.filter(function (tr) { return !tr.cut && tr.z > 0; }).sort(function (a, b) { return a.z - b.z; })[0];
    var minus = list.filter(function (tr) { return !tr.cut && tr.z < 0; }).sort(function (a, b) { return b.z - a.z; })[0];
    if (plus) plus.trim = true;
    if (minus) minus.trim = true;
    /* the headers run between the trimmers' chords -- or, when the trimmer is
       an end truss, between the inside faces of the gable framing */
    trimFace.plus = plus ? (plus.end ? L / 2 - 0.02 - sec.stud.d : plus.z - ct / 2) : L / 2 - 0.02 - sec.stud.d;
    trimFace.minus = minus ? (minus.end ? -L / 2 + 0.02 + sec.stud.d : minus.z + ct / 2) : -L / 2 + 0.02 + sec.stud.d;
  }
  var lofts = loftZones(plan);
  list.forEach(function (tr) {
    lofts.forEach(function (zn) { if (tr.z + reach > zn.z0 && tr.z - reach < zn.z1) tr.loft = zn; });
  });
  return { sec: sec, spacing: s, trusses: list, dormer: dg, trimFace: trimFace, lofts: lofts };
}

/* THE OPENINGS IN A GABLE END that its framing has to go round, in world x
   and y: gable windows (octagon, 18x24 -- not the faux loft window, which is
   trim on the siding), the gable vent, and a door or window on that end wall
   that rises past the wall top into the gable (the Standard Barn's door does).
   Openings whose framing would touch are merged into one. Each comes back
   with how it is framed:
     x0 x1 y0 y1   the rough opening (the item's clear opening)
     header        {y0, y1, depth} when a header fits under the end truss's
                   top chord, else null (the chord itself carries it)
     jacks         true when there is a header to stand on them
     fx0 fx1       the outer edges of its king studs
     cutsChord     it dips into the end truss's bottom chord, which is cut
     base          what its framing stands on (the bottom chord, or the end
                   wall's top plate where the chord is cut)
     sill          true when a sill fits under a window or vent */
export function gableOpenings(plan, end, lay) {
  lay = lay || trussLayout(plan);
  var sec = lay.sec, W = plan.W, L = plan.L, topY = plan.topY;
  var st = sec.stud.t, cd = sec.chord.d, dT = sec.deckT;
  var base = sec.framing === "truss" ? topY + cd : topY;
  var lowerD = dT + cd;
  var raw = [];
  var items = (plan.state && plan.state.items) || [];
  items.forEach(function (it) {
    var c = plan.CAT[it.cat];
    if (!c || c.int) return;
    if (it.wall !== "F" && it.wall !== "B") return;
    if (c.gable) {
      if (c.draw === "faux-loft") return;                  /* trim on the siding, no opening */
      var r = openingRect(it, plan);
      if (!r || r.plane !== "gable" || r.end !== end || !r.clearX) return;
      raw.push({ x0: r.clearX.x0, x1: r.clearX.x1, y0: r.clear.y0, y1: r.clear.y1, kind: "window", what: it.cat });
      return;
    }
    if (it.wall !== end) return;
    var w = plan.ws[end];
    if (!w || Math.abs(Math.abs(w.at) - L / 2) > 1e-9) return;   /* a porch's end wall is not the gable */
    var r2 = openingRect(it, plan);
    if (!r2 || !r2.clear || !(r2.clear.y1 > topY + 0.01)) return;
    var xa = w.cx + w.ax[0] * r2.clear.u0, xb = w.cx + w.ax[0] * r2.clear.u1;
    raw.push({ x0: Math.min(xa, xb), x1: Math.max(xa, xb), y0: r2.clear.y0, y1: r2.clear.y1, kind: c.k === "win" ? "window" : "door", what: it.cat });
  });
  var vs = ventSpot(plan);
  if (vs.show) {
    var lean = plan.t.roof === "lean";
    var vy = lean ? vs.ry - 0.34 : vs.ry - 0.92, vw = lean ? 0.42 : 0.56, vh = lean ? 0.26 : 0.38;
    raw.push({ x0: vs.rx - vw, x1: vs.rx + vw, y0: vy - vh, y1: vy + vh, kind: "vent", what: "vent" });
  }
  /* an opening whose rough opening does not fit inside the gable's framing
     (out past the walls, or wholly above the top chord) is not framed. "Wholly
     above" is tested at its HIGHEST point under the chord: a gable window
     dragged toward an eave runs up into the top chord on its low side, but
     the part of it under the chord is still a window, and leaving it unframed
     ran gable studs and the end truss's bottom chord straight through its
     glass (found by fuzzing the window positions the designer allows). */
  var chordLine = offsetPolyline(sec, lowerD);
  function highestUnder(x0, x1) {
    var m = Math.max(envY(sec, lowerD, x0), envY(sec, lowerD, x1));
    chordLine.forEach(function (q) { if (q[0] > x0 && q[0] < x1) m = Math.max(m, q[1]); });
    return m;
  }
  raw = raw.filter(function (o) {
    return o.x0 - 2 * st > sec.innerL + 1e-6 && o.x1 + 2 * st < sec.innerR - 1e-6 &&
      o.y0 < highestUnder(o.x0, o.x1) - 0.05;
  });
  /* THE HEADER, the way the wall framing picks one (parts/wall-frame.js
     fitHeader): the walls.header rule's size for the opening's width, else the
     deepest smaller one (same number of plies) that fits under the top chord,
     else a flat 2x, else none -- the top chord itself spans the opening. It
     used to be the rule's size or nothing, which left the Standard Barn 8x12's
     door (it rises into the gable) with half a foot of open space over its
     head and no header, where a doubled 2x6 fits. */
  var HEADER_STEPS = ["2x12", "2x10", "2x8", "2x6", "2x4"];
  function frame(o) {
    var want = pickRule(((plan.construction || {}).walls || {}).header || "2x6 doubled", { spanFt: o.x1 - o.x0 });
    var wantL = lumberFt(want), plies = /tripled/i.test(want) ? " tripled" : /doubled/i.test(want) ? " doubled" : "";
    var hx0 = o.x0 - st, hx1 = o.x1 + st;
    var room = Math.min(envY(sec, lowerD, hx0), envY(sec, lowerD, hx1)) - 1e-6 - o.y1;
    var tries = [{ name: want, d: wantL.d }];
    HEADER_STEPS.forEach(function (n) { var z = lumberFt(n + plies); if (z.d < wantL.d - 1e-9) tries.push({ name: n + plies, d: z.d }); });
    tries.push({ name: (((plan.construction || {}).walls || {}).stud || "2x4") + " flat", d: st });
    var pick = null;
    for (var ti = 0; ti < tries.length && !pick; ti++) if (tries[ti].d <= room) pick = tries[ti];
    var fits = !!pick;
    o.header = fits ? { y0: o.y1, y1: o.y1 + pick.d, depth: pick.d, name: pick.name, asked: want } : null;
    o.jacks = fits;
    o.fx0 = o.x0 - (fits ? 2 : 1) * st;
    o.fx1 = o.x1 + (fits ? 2 : 1) * st;
    o.cutsChord = sec.framing === "truss" && o.y0 < base - 0.005;
    o.base = o.cutsChord ? topY : base;
    o.sill = o.kind !== "door" && o.y0 - st >= o.base + 0.005;
    return o;
  }
  var ops = raw.map(frame);
  /* merge any two whose framing would touch */
  var merged = true;
  while (merged) {
    merged = false;
    ops.sort(function (a, b) { return a.fx0 - b.fx0; });
    for (var i = 0; i + 1 < ops.length && !merged; i++) {
      var a = ops[i], b = ops[i + 1];
      if (b.fx0 < a.fx1 + 0.01) {
        var u = { x0: Math.min(a.x0, b.x0), x1: Math.max(a.x1, b.x1), y0: Math.min(a.y0, b.y0), y1: Math.max(a.y1, b.y1),
          kind: (a.kind === "door" || b.kind === "door") ? "door" : (a.kind === "window" || b.kind === "window") ? "window" : "vent",
          what: a.what + "+" + b.what };
        ops.splice(i, 2, frame(u));
        merged = true;
      }
    }
  }
  return ops.filter(function (o) {
    return o.fx0 > sec.innerL + 1e-6 && o.fx1 < sec.innerR - 1e-6;
  });
}

/* ================= this part's members ================= */

function mk(poly, z0, z1, kind, mat, extra) {
  var p = cleanPoly(poly);
  if (!p) return null;
  var m = { poly: p, z0: Math.min(z0, z1), z1: Math.max(z0, z1), kind: kind, mat: mat || "lumber" };
  if (extra) Object.keys(extra).forEach(function (k) { m[k] = extra[k]; });
  return m;
}

/* The lumber of one truss (or rafter pair) at tr.z. */
function trussMembers(plan, lay, tr) {
  var sec = lay.sec, W = plan.W, topY = plan.topY, P = sec.P;
  var ct = sec.chord.t, cd = sec.chord.d, dT = sec.deckT, ww = cd;
  var z0 = tr.z - ct / 2, z1 = tr.z + ct / 2, gT = GUSSET_T;
  var rafter = sec.framing === "rafter";
  var dg = lay.dormer;
  var out = [], tag = { truss: tr.z, end: tr.end };
  function add(list, kind, mat, zs) {
    list.forEach(function (p) { var m = mk(p, zs ? zs[0] : z0, zs ? zs[1] : z1, kind, mat, Object.assign({}, tag)); if (m) out.push(m); });
  }
  var lower = belowAll(sec, dT + cd);          /* under every top chord */
  var under = belowAll(sec, dT);               /* under the deck */
  var peakX = sec.peak != null ? P[sec.peak][0] : null;

  /* ---- top chords (rafters) ---- */
  sec.segs.forEach(function (s, i) {
    var tops = fitRoof(sec, band(sec, i, dT, dT + cd));
    if (rafter && peakX != null) tops = [].concat.apply([], tops.map(function (p) { return splitX(p, peakX - ct / 2, peakX + ct / 2); }));
    if (tr.cut) tops = [].concat.apply([], tops.map(function (p) { return splitX(p, dg.hx0, dg.xFw); }));
    tag.seg = i;
    add(tops, "top-chord", "lumber");
  });
  delete tag.seg;

  /* ---- bottom chord: at the wall top, wall to wall, cut to the top chords
     (so on all but the cottage it stops short of the plates -- see the note
     at the top of this file) ---- */
  if (!rafter) {
    var bc = clipAll(rectPoly(sec.innerL, topY, sec.innerR, topY + cd), lower);
    var bcs = [bc];
    /* on a truss the dormer cuts, the heel end of the bottom chord stops at
       the dormer's front wall, which comes down to the wall top there */
    if (tr.cut) bcs = [cleanPoly(clipHalf(bc, [1, 0, dg.xFi]))].filter(Boolean);
    if (tr.end) {
      gableOpenings(plan, tr.end, lay).forEach(function (o) {
        if (!o.cutsChord) return;
        bcs = [].concat.apply([], bcs.map(function (p) { return splitX(p, o.fx0, o.fx1); }));
      });
    }
    add(bcs, "bottom-chord", "lumber");
  }

  /* ---- webs and gussets (not on an end truss: the gable studs fill it) ---- */
  if (tr.end) return out;
  var webs = [], guss = [];
  var inside = lower.concat([[0, -1, -(topY + (rafter ? 0 : cd))], [-1, 0, -sec.innerL], [1, 0, sec.innerR]]);
  function web(poly, extra) { var p = cleanPoly(clipAll(poly, inside.concat(extra || []))); if (p) webs.push(p); }
  function gusset(poly) { var p = cleanPoly(clipAll(poly, under.concat([[-1, 0, -sec.innerL], [1, 0, sec.innerR], [0, -1, -topY]]))); if (p) guss.push(p); }
  var lowPt = offsetPolyline(sec, dT + cd);    /* the chords' lower mitre points */
  /* THE HEEL PLATE has to reach the bottom chord. The drawn roof meets the
     wall top at the siding, so the bottom chord's end is cut to the top
     chord's slope and stops short of the wall -- a few inches on a barn, over
     half a foot on a gable, nearly two feet on a lean-to's shallow slope. A
     plate a fixed foot long from the wall covered only the top chord's seat
     on every lean-to and single-slope heel, leaving the tie unconnected. So
     each heel plate runs in from the wall until the bottom chord is half its
     depth, and a quarter foot past that (never less than a foot). */
  function heelPlate(xWall, dir) {
    var x = xWall, stepX = 0.02;
    for (var hs = 0; hs < 800 && envY(sec, dT + cd, x) < topY + cd / 2; hs++) x += dir * stepX;
    var reach = Math.max(1.0, Math.abs(x - xWall) + 0.25);
    var xa = xWall, xb = xWall + dir * reach;
    gusset(rectPoly(Math.min(xa, xb), topY, Math.max(xa, xb), topY + cd + 0.12));
  }

  if (sec.mono) {
    if (!rafter) {
      /* a mono truss: the tall wall stands in for its high post, so an end
         post stands against the inside of the tall wall's studs; posts with
         diagonals between them toward the low heel */
      var tallLeft = sec.tallL, xt = tallLeft ? sec.innerL : sec.innerR, dir = tallLeft ? 1 : -1;
      var xh = tallLeft ? sec.innerR : sec.innerL;            /* the low heel */
      /* where the chords meet at the low heel */
      var heelX = xh;
      for (var q = 0; q < 200; q++) { var xx = xt + dir * (Math.abs(xh - xt) * q / 200); if (envY(sec, dT + cd, xx) <= topY + cd + 1e-6) { heelX = xx; break; } }
      var postX = [xt + dir * ww / 2];
      var nIn = W >= 10 ? 2 : 1;
      for (var pi = 1; pi <= nIn; pi++) postX.push(postX[0] + (heelX - postX[0]) * pi / (nIn + 1));
      postX.forEach(function (px) { web(strip([px, topY], [px, topY + 50], ww, 0)); });
      for (var di = 0; di + 1 < postX.length; di++) {
        var pa = postX[di], pb = postX[di + 1];
        var d0 = [pa + dir * ww / 2, topY + cd], d1 = [pb - dir * ww / 2, envY(sec, dT + cd, pb - dir * ww / 2)];
        var lo = Math.min(pa + dir * ww / 2, pb - dir * ww / 2), hi = Math.max(pa + dir * ww / 2, pb - dir * ww / 2);
        web(strip(d0, d1, ww, 3), [[-1, 0, -lo], [1, 0, hi]]);
      }
      /* gussets: the low heel, and the end post's foot and head */
      heelPlate(xh, -dir);
      var e0 = Math.min(xt, xt + dir * 0.6), e1 = Math.max(xt, xt + dir * 0.6);
      var yTopPost = envY(sec, dT + cd, xt + dir * 0.6);
      /* on a short post the foot plate and the head plate would meet: one
         plate the height of the post instead */
      if (yTopPost - 0.30 <= topY + cd + 0.25 + 0.01) gusset(rectPoly(e0, topY, e1, yTopPost + 5));
      else { gusset(rectPoly(e0, topY, e1, topY + cd + 0.25)); gusset(rectPoly(e0, yTopPost - 0.30, e1, yTopPost + 5)); }
    }
  } else if (sec.gambrel) {
    /* collar tie across the knees, king post above it */
    var kL = lowPt[1], kR = lowPt[3], apL = lowPt[2];
    var yc = Math.min(kL[1], kR[1]);
    web(rectPoly(-W, yc - ww, W, yc));
    if (!rafter) web(strip([peakX, yc], [peakX, yc + 50], ww, 0), [[0, -1, -yc]]);
    /* gussets: knees (both framings), apex and heels (trusses) */
    [P[1], P[3]].forEach(function (K, ki) {
      var Kl = ki === 0 ? kL : kR;
      gusset(rectPoly(K[0] - 0.45, Kl[1] - ww - 0.18, K[0] + 0.45, K[1] + 1));
    });
    if (!rafter) {
      gusset(rectPoly(peakX - 0.55, apL[1] - 0.30, peakX + 0.55, P[2][1] + 1));
      heelPlate(sec.innerL, 1);
      heelPlate(sec.innerR, -1);
    }
  } else {
    /* gable or saltbox */
    var apex = P[sec.peak], apLow = lowPt[1];
    if (!rafter) {
      web(strip([apex[0], topY], [apex[0], topY + 50], ww, 0));
      var struts = W >= 10;
      if (struts) {
        [-1, 1].forEach(function (sg) {
          var xm = (apex[0] + sg * W / 2) / 2;
          var T = [xm, envY(sec, dT + cd, xm)], B0 = [apex[0], topY + cd];
          web(strip(B0, T, ww, 3), [sg < 0 ? [1, 0, apex[0] - ww / 2] : [-1, 0, -(apex[0] + ww / 2)]]);
        });
        gusset(rectPoly(apex[0] - 0.45, topY, apex[0] + 0.45, topY + cd + 0.25));
      }
      gusset(rectPoly(apex[0] - 0.55, apLow[1] - 0.30, apex[0] + 0.55, apex[1] + 1));
      heelPlate(sec.innerL, 1);
      heelPlate(sec.innerR, -1);
    } else {
      /* rafters: a collar tie on every pair, a little over halfway up */
      var yc2 = topY + 0.62 * (apex[1] - topY);
      var rb = ridgeBoard(plan, lay);
      var cap = rb ? [[0, 1, rb.poly.reduce(function (m, q) { return Math.min(m, q[1]); }, Infinity)]] : [];
      if (!tr.cut) web(rectPoly(-W, yc2 - ww, W, yc2), cap);
    }
  }

  /* the dormer: a cut truss loses its +x top chord between the headers, and
     with it the web and gusset parts in that stretch (the +x strut goes
     altogether). A TRIMMER either side stays whole -- it is the truss that
     carries the upper header -- and only the plate on its inner face gives
     way where the header butts its chord (hx0..hx1, by the ridge). It used to
     lose everything between the header and the dormer's front wall, its +x
     strut and its heel plate included: the one truss that has to be whole. */
  if (dg && tr.cut) {
    webs = webs.filter(function (p) { return centroid(p)[0] <= (peakX != null ? peakX : 0) + ww; });
    webs = [].concat.apply([], webs.map(function (p) { return splitX(p, dg.hx0, dg.xFw); }));
    guss = [].concat.apply([], guss.map(function (p) { return splitX(p, dg.hx0, dg.xFw); }));
    if (rafter) webs = [];
  } else if (dg && tr.trim) {
    guss = [].concat.apply([], guss.map(function (p) { return splitX(p, dg.hx0, dg.hx1); }));
  }
  /* a loft floor runs through this truss: nothing of its webs or plates may
     stand in the floor's thickness (they stand on it instead) */
  if (tr.loft) {
    var zn = tr.loft;
    webs = [].concat.apply([], webs.map(function (p) { return splitY(p, zn.yd0, zn.yd1); }));
    guss = [].concat.apply([], guss.map(function (p) { return splitY(p, zn.yd0, zn.yd1); }));
  }
  add(webs, "web", "lumber");
  add(guss, "gusset", "plywood", [z1, z1 + gT]);
  add(guss, "gusset", "plywood", [z0 - gT, z0]);
  return out;
}

/* The ridge board of a rafter-framed roof that peaks: on edge under the ridge,
   a little deeper than the rafters' plumb cut, the whole length of the
   building inside the gable siding. */
export function ridgeBoard(plan, lay) {
  var sec = lay.sec;
  if (sec.framing !== "rafter" || sec.peak == null) return null;
  var ct = sec.chord.t, cd = sec.chord.d, dT = sec.deckT, x = sec.P[sec.peak][0];
  var yr1 = Math.min(envY(sec, dT, x - ct / 2), envY(sec, dT, x + ct / 2));
  var yr0 = Math.min(envY(sec, dT + cd, x - ct / 2), envY(sec, dT + cd, x + ct / 2)) - 0.15;
  return mk(rectPoly(x - ct / 2, yr0, x + ct / 2, yr1), -plan.L / 2 + 0.02, plan.L / 2 - 0.02, "ridge-board", "lumber");
}

export function roofFrameMembers(plan) {
  if (plan.trussStudy) return trussStudyMembers(plan);
  var lay = trussLayout(plan), out = [];
  lay.trusses.forEach(function (tr) { trussMembers(plan, lay, tr).forEach(function (m) { out.push(m); }); });
  var rb = ridgeBoard(plan, lay);
  if (rb) out.push(rb);
  return out;
}

/* ================= drawing ================= */

/* The framing materials. First call wins (parts/README.md): if another
   framing part made "lumber" first, this reuses its paint. */
export function frameMats(kit) {
  return {
    lumber: kit.mat("lumber", texFlat, "#c9a46e", 0.04, 12),
    plywood: kit.mat("plywood", texFlat, "#d8bc8a", 0.04, 10),
    osb: kit.mat("osb", texFlat, "#b8915a", 0.03, 10),
  };
}

/* Is this polygon a plain rectangle? Then it is drawn with kit.beam. */
function asBoard(p) {
  if (p.length !== 4) return null;
  for (var i = 0; i < 4; i++) {
    var a = p[i], b = p[(i + 1) % 4], c = p[(i + 2) % 4];
    var e1 = [b[0] - a[0], b[1] - a[1]], e2 = [c[0] - b[0], c[1] - b[1]];
    var l1 = Math.hypot(e1[0], e1[1]), l2 = Math.hypot(e2[0], e2[1]);
    if (Math.abs(e1[0] * e2[0] + e1[1] * e2[1]) > 1e-9 * Math.max(1, l1 * l2)) return null;
  }
  var u = [p[1][0] - p[0][0], p[1][1] - p[0][1]], lu = Math.hypot(u[0], u[1]);
  var v = [p[2][0] - p[1][0], p[2][1] - p[1][1]], lv = Math.hypot(v[0], v[1]);
  return { cx: (p[0][0] + p[2][0]) / 2, cy: (p[0][1] + p[2][1]) / 2, up: [u[0] / lu, u[1] / lu, 0], d: lu, w: lv };
}

/* A convex cross-section pushed along z: two end caps and the sides, every
   face wound to face outward. */
function prism(kit, b, poly, z0, z1) {
  var n = poly.length, i;
  for (i = 1; i < n - 1; i++) {
    var A = poly[0], B = poly[i], C = poly[i + 1];
    kit.pushTri(b, [A[0], A[1], z1], [B[0], B[1], z1], [C[0], C[1], z1], [A[0] / 0.8, A[1] / 0.8], [B[0] / 0.8, B[1] / 0.8], [C[0] / 0.8, C[1] / 0.8]);
    kit.pushTri(b, [A[0], A[1], z0], [C[0], C[1], z0], [B[0], B[1], z0], [A[0] / 0.8, A[1] / 0.8], [C[0] / 0.8, C[1] / 0.8], [B[0] / 0.8, B[1] / 0.8]);
  }
  var dz = (z1 - z0) / 0.8;
  for (i = 0; i < n; i++) {
    var a = poly[i], c = poly[(i + 1) % n], l = Math.hypot(c[0] - a[0], c[1] - a[1]) / 0.8;
    kit.pushQuad(b, [a[0], a[1], z0], [c[0], c[1], z0], [c[0], c[1], z1], [a[0], a[1], z1], [0, 0], [l, 0], [l, dz], [0, dz]);
  }
}

/* Draw members: a plain rectangular board through kit.beam, anything with a
   cut (seat cut, mitre, heel, a sloped end) as a prism of its own outline.
   Both give 12 triangles for a four-sided board, 4n-4 for n sides. */
export function drawMembers(kit, members, mats) {
  var M = mats || frameMats(kit);
  members.forEach(function (m) {
    var b = M[m.mat] || M.lumber;
    var bd = asBoard(m.poly);
    if (bd) kit.beam(b, [bd.cx, bd.cy, m.z0], [bd.cx, bd.cy, m.z1], bd.w, bd.d, bd.up);
    else prism(kit, b, m.poly, m.z0, m.z1);
  });
}

export default {
  id: "roof-frame",
  name: "Roof framing",
  stage: "roof-frame",
  realLife: "Roof trusses of {roof.chord} lumber ({roof.framing} framing) every {roof.spacingIn} in on centre along the building and one at each gable end, with {roof.gussets} gusset plates at the joints: the top chords follow the roof line of every roof shape with a seat cut where they cross a wall, the tails run out under the eave, and the bottom chord ties the walls together at the wall top.",
  appliesTo() { return true; },
  members(plan) { return roofFrameMembers(plan); },
  build(plan, kit) {
    if (plan.trussStudy) { drawStudyMembers(kit, trussStudyMembers(plan), "roof-frame"); return; }
    kit.setStage("roof-frame");
    drawMembers(kit, roofFrameMembers(plan));
  },
};
