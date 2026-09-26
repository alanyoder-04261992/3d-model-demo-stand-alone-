/* THE GEOMETRY THE FRAMING CHECKS SHARE. Node, no browser.

   The framing parts (parts/foundation.js, floor-frame.js, floor-deck.js,
   wall-frame.js, porch-deck-frame.js, interior.js, and the roof-framing
   parts) describe every piece they draw as plain data -- a "member"
   (parts/floor-frame.js beamMember / prismMember) -- and a part that lists
   them exposes `members(plan)` on its default export. This file turns those
   members into solids and answers the questions tools/check-framing.mjs (and
   tools/check-framing-roof.mjs) ask of real framing:

     solidsOf(members, part)        every member as one or more convex solids
     solidsFromBuild(build, parts)  the same for a part that lists no members:
                                    its drawn triangles, twelve to a board
     satDepth(A, B)                 how far two solids overlap (negative: the gap)
     overlaps(solids, tol)          every pair overlapping by more than tol (a sweep)
     regionOf(plan)                 where framing may be: below y0 inside the
                                    footprint, y0..topY inside the walls (not on
                                    a porch deck), above topY under the roof
                                    (its overhangs included, the dormer's too)
     regionProblems(plan, solids)   every corner of every solid outside it
     bearingProblems(solids, supports)  every member that rests on nothing
     skidSolids(plan)               the skids as drawn, which the floor frame rests on
     finishedFingerprint(build)     the finished building's triangles, to prove
                                    the framing never changes them
     membersOfEntry(entry, plan)    a frame part's members, if it lists them

   A MEMBER comes in either form the framing parts use: ours (parts/floor-
   frame.js: shape "beam" {p0, p1, w, d, up} or shape "prism" {poly, origin,
   e1, e2, e3, t}) or the roof framing's cross-section {poly [[x,y]...], z0,
   z1} (parts/roof-frame.js). It may say how it is carried, as meta.support or
   support: "bear" (on what is under it), "fasten" (nailed to what it
   touches), "bearOrFasten" (either -- the default), "ground" or "none".

   A SOLID is { part, kind, meta, member (index), verts [[x,y,z]x n],
   normals [...], edges [...], min [x,y,z], max [x,y,z], bottom, top,
   bottomFace [[x,z]...], topFace [[x,z]...] } -- a convex polyhedron: its
   face normals and edge directions are all the separating-axis test needs.

   TOLERANCE: 0.01 ft (an eighth of an inch), docs/ARCHITECTURE.md Framing
   datums 5: no two members overlap by more than 0.01 ft, no bearing gap over
   0.01 ft. */

import { norm3, sub3, cross3, dot3 } from "../../engine/math.js";
import { y0 } from "../../engine/constants.js";
import { profileYat, ROOF_TH, RAKE_STEP, roofShape, cottageEave } from "../../model/roof-shapes.js";
import { eaveOverhangs, rakeOverhangOf } from "../../parts/roofing.js";
import { skidXs } from "../../parts/skids.js";
import { floorSegments } from "../../parts/floor.js";
import { triangulate, polyArea, porchOutlines, roomOutline, pointInPoly } from "../../parts/floor-frame.js";
import { canonical } from "./headless.mjs";
import { STAGES, visibleIn } from "../../parts/stages.js";

export const TOL = 0.01;
/* How far under the eave's tip anything may hang: the deepest fascia and
   cut-edge Barnwright draws (the boxed eaves drop 0.24 ft under the slab;
   the cottage's fascia is 4 in). */
export const EAVE_DROP = 0.34;

/* ------------------------------------------------------------------ solids */

function len3(a) { return Math.sqrt(dot3(a, a)); }
function add3(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function mul3(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }

/* The board kit.beam draws, as a box: the same arithmetic (engine/buckets.js). */
export function beamFrame(m) {
  var ax = norm3(sub3(m.p1, m.p0)), L = len3(sub3(m.p1, m.p0));
  var u = m.up || [0, 1, 0], k = dot3(u, ax);
  u = [u[0] - ax[0] * k, u[1] - ax[1] * k, u[2] - ax[2] * k];
  if (dot3(u, u) < 1e-12) { u = Math.abs(ax[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]; k = dot3(u, ax); u = [u[0] - ax[0] * k, u[1] - ax[1] * k, u[2] - ax[2] * k]; }
  u = norm3(u);
  var s = norm3(cross3(ax, u));
  var c = mul3(add3(m.p0, m.p1), 0.5);
  return { c: c, axes: [ax, s, u], half: [L / 2, m.w / 2, m.d / 2] };
}

function finish(sol) {
  var min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  sol.verts.forEach(function (v) { for (var i = 0; i < 3; i++) { if (v[i] < min[i]) min[i] = v[i]; if (v[i] > max[i]) max[i] = v[i]; } });
  sol.min = min; sol.max = max; sol.bottom = min[1]; sol.top = max[1];
  sol.bottomFace = hull2(sol.verts.filter(function (v) { return v[1] <= min[1] + 1e-6; }).map(function (v) { return [v[0], v[2]]; }));
  sol.topFace = hull2(sol.verts.filter(function (v) { return v[1] >= max[1] - 1e-6; }).map(function (v) { return [v[0], v[2]]; }));
  return sol;
}

export function beamSolid(m, extra) {
  var f = beamFrame(m), verts = [];
  for (var i = -1; i <= 1; i += 2) for (var j = -1; j <= 1; j += 2) for (var k = -1; k <= 1; k += 2) {
    verts.push(add3(add3(add3(f.c, mul3(f.axes[0], f.half[0] * i)), mul3(f.axes[1], f.half[1] * j)), mul3(f.axes[2], f.half[2] * k)));
  }
  return finish(Object.assign({ verts: verts, normals: f.axes.slice(), edges: f.axes.slice(), frame: f }, extra));
}

/* A prism member's convex pieces: the polygon itself when it is convex,
   else its triangles. */
export function prismSolids(m, extra) {
  var P = m.poly, pieces = isConvex(P) ? [P] : triangulate(P).map(function (t) { return [P[t[0]], P[t[1]], P[t[2]]]; });
  return pieces.map(function (Q, pi) {
    function at(p, h) { return [m.origin[0] + m.e1[0] * p[0] + m.e2[0] * p[1] + m.e3[0] * h, m.origin[1] + m.e1[1] * p[0] + m.e2[1] * p[1] + m.e3[1] * h, m.origin[2] + m.e1[2] * p[0] + m.e2[2] * p[1] + m.e3[2] * h]; }
    var verts = [], normals = [norm3(m.e3)], edges = [norm3(m.e3)];
    Q.forEach(function (p) { verts.push(at(p, 0)); verts.push(at(p, m.t)); });
    for (var i = 0; i < Q.length; i++) {
      var a = at(Q[i], 0), b = at(Q[(i + 1) % Q.length], 0), e = sub3(b, a);
      if (len3(e) < 1e-12) continue;
      e = norm3(e);
      edges.push(e);
      normals.push(norm3(cross3(e, m.e3)));
    }
    return finish(Object.assign({ verts: verts, normals: normals, edges: edges, piece: pi }, extra));
  });
}
function isConvex(P) {
  var sign = 0;
  for (var i = 0; i < P.length; i++) {
    var a = P[i], b = P[(i + 1) % P.length], c = P[(i + 2) % P.length];
    var cr = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    if (Math.abs(cr) < 1e-12) continue;
    if (sign === 0) sign = Math.sign(cr); else if (Math.sign(cr) !== sign) return false;
  }
  return true;
}

/* Every member of a part as solids. `id` numbers the members so the pieces
   of one member are never tested against each other. */
export function solidsOf(members, part, idBase) {
  var out = [];
  members.forEach(function (m, i) {
    var meta = m.meta || {};
    if (meta.support == null && m.support != null) meta = Object.assign({}, meta, { support: m.support });
    var extra = { part: part, kind: m.kind, meta: meta, member: (idBase || 0) + i, stage: m.stage };
    if (m.shape === "beam") {
      if (len3(sub3(m.p1, m.p0)) < 1e-4 || !(m.w > 1e-4) || !(m.d > 1e-4)) return;
      out.push(beamSolid(m, extra));
    } else if (m.shape === undefined && m.z0 != null && m.z1 != null) {
      /* the roof framing's form: a cross-section outline (x across, y up)
         pushed along the length from z0 to z1 (parts/roof-frame.js) */
      var sm = asPrism(m);
      if (!(sm.t > 1e-4) || !sm.poly || sm.poly.length < 3 || Math.abs(polyArea(sm.poly)) < 1e-6) return;
      prismSolids(sm, extra).forEach(function (s) { out.push(s); });
    } else {
      if (!(m.t > 1e-4) || !m.poly || m.poly.length < 3 || Math.abs(polyArea(m.poly)) < 1e-6) return;
      prismSolids(m, extra).forEach(function (s) { out.push(s); });
    }
  });
  return out;
}

/* A cross-section member {poly, z0, z1} as one of ours. */
export function asPrism(m) {
  return { kind: m.kind, mat: m.mat, shape: "prism", poly: m.poly, origin: [0, 0, m.z0], e1: [1, 0, 0], e2: [0, 1, 0], e3: [0, 0, 1], t: m.z1 - m.z0, meta: m.meta || {} };
}

/* For a framing part that lists no members: rebuild its boards from what it
   drew. kit.beam draws six quads (twelve triangles) with eight corners; each
   run of twelve triangles with eight distinct corners is taken as one board
   (its convex hull, as a box when it is one). Anything else becomes one solid
   per triangle group, which is conservative. */
export function solidsFromBuild(build, partIds, idBase) {
  var want = new Set(Array.isArray(partIds) ? partIds : [partIds]), out = [], id = idBase || 0;
  build.ORDER.forEach(function (key) {
    var b = build.buckets[key];
    (build.tags[key] || []).forEach(function (seg) {
      if (!want.has(seg.part)) return;
      for (var t0 = seg.from; t0 + 12 <= seg.from + seg.count; t0 += 12) {
        var pts = [];
        for (var t = t0; t < t0 + 12; t++) for (var v = 0; v < 3; v++) {
          var o = (t * 3 + v) * 9, p = [b.v[o], b.v[o + 1], b.v[o + 2]];
          if (!pts.some(function (q) { return Math.abs(q[0] - p[0]) + Math.abs(q[1] - p[1]) + Math.abs(q[2] - p[2]) < 1e-7; })) pts.push(p);
        }
        if (pts.length !== 8) continue;
        var box = boxFromCorners(pts);
        if (!box) continue;
        out.push(finish({ verts: pts, normals: box.slice(), edges: box.slice(), part: seg.part, kind: "drawn", meta: { support: "bearOrFasten" }, member: id++ }));
      }
    });
  });
  return out;
}
function boxFromCorners(pts) {
  /* three edge directions from the first corner to its three nearest neighbours */
  var p = pts[0];
  var ds = pts.slice(1).map(function (q) { return sub3(q, p); }).sort(function (a, b) { return len3(a) - len3(b); });
  var a = norm3(ds[0]), b = null, c = null;
  for (var i = 1; i < ds.length && !c; i++) {
    var d = norm3(ds[i]);
    if (Math.abs(dot3(d, a)) > 1e-3) continue;
    if (!b) { b = d; continue; }
    if (Math.abs(dot3(d, b)) > 1e-3) continue;
    c = d;
  }
  return c ? [a, b, c] : null;
}

/* ----------------------------------------------------------- overlap tests */

function project(verts, a) {
  var lo = Infinity, hi = -Infinity;
  for (var i = 0; i < verts.length; i++) { var d = verts[i][0] * a[0] + verts[i][1] * a[1] + verts[i][2] * a[2]; if (d < lo) lo = d; if (d > hi) hi = d; }
  return [lo, hi];
}
/* The separating-axis test for two convex solids: the smallest overlap over
   every face normal and every pair of edges. Positive: they overlap by at
   least that much in every direction (the penetration depth); negative: they
   are that far apart along some axis. Stops early once it is below `floor`. */
export function satDepth(A, B, floor) {
  var axes = A.normals.concat(B.normals);
  for (var i = 0; i < A.edges.length; i++) for (var j = 0; j < B.edges.length; j++) {
    var c = cross3(A.edges[i], B.edges[j]), l = len3(c);
    if (l > 1e-6) axes.push(mul3(c, 1 / l));
  }
  var min = Infinity;
  for (var k = 0; k < axes.length; k++) {
    var pa = project(A.verts, axes[k]), pb = project(B.verts, axes[k]);
    var ov = Math.min(pa[1], pb[1]) - Math.max(pa[0], pb[0]);
    if (ov < min) { min = ov; if (floor != null && min < floor) return min; }
  }
  return min;
}

/* Every pair of solids (from different members) whose boxes come within
   `pad` of each other, by a sweep along x. */
export function sweepPairs(solids, pad, fn) {
  var s = solids.slice().sort(function (a, b) { return a.min[0] - b.min[0]; });
  var active = [];
  for (var i = 0; i < s.length; i++) {
    var A = s[i];
    active = active.filter(function (B) { return B.max[0] >= A.min[0] - pad; });
    for (var j = 0; j < active.length; j++) {
      var B = active[j];
      if (B.member === A.member && B.part === A.part) continue;
      if (B.max[1] < A.min[1] - pad || A.max[1] < B.min[1] - pad || B.max[2] < A.min[2] - pad || A.max[2] < B.min[2] - pad) continue;
      fn(B, A);
    }
    active.push(A);
  }
}

/* Every pair overlapping by more than tol. */
export function overlaps(solids, tol) {
  tol = tol == null ? TOL : tol;
  var out = [];
  sweepPairs(solids, -tol, function (A, B) {
    var d = satDepth(A, B, tol);
    if (d > tol) out.push({ a: A, b: B, depth: d });
  });
  return out;
}

/* ------------------------------------------------------------------ regions */

/* The roof's outline over the building: the profile carried out over the
   eaves exactly as parts/roofing.js does (its ext() along the slope, or the
   cottage's level eave), and how far past each gable end it reaches. */
export function roofOutline(plan) {
  var P = plan.prof.map(function (p) { return p.slice(); });
  var EO = eaveOverhangs(plan), t = plan.t;
  function ext(i, j, d) { var a = P[i], b = P[j]; var dx = a[0] - b[0], dy = a[1] - b[1], l = Math.hypot(dx, dy) || 1; a[0] += dx / l * d; a[1] += dy / l * d; }
  if (t.roof === "lean") { ext(P.length - 1, P.length - 2, EO.right); if (EO.left) ext(0, 1, EO.left); }
  else if (t.roof === "slope") { ext(P.length - 1, P.length - 2, EO.right); ext(0, 1, EO.left); }
  else if (t.cottage) cottageEave(P, ROOF_TH, roofShape(t, plan.construction).cottageEave);
  else { ext(0, 1, EO.left); ext(P.length - 1, P.length - 2, EO.right); }
  var ov = t.roof === "gambrel" ? 0.10 + RAKE_STEP : rakeOverhangOf(plan);
  /* the lowest the eave reaches: its tip, less a fascia's depth */
  var eaveFloor = Math.min(P[0][1], P[P.length - 1][1]) - EAVE_DROP;
  return { P: P, zMax: plan.L / 2 + ov, eaveFloor: eaveFloor };
}
function polylineY(P, x) {
  if (x <= P[0][0]) return P[0][1];
  for (var i = 0; i < P.length - 1; i++) {
    var a = P[i], b = P[i + 1];
    if (x >= a[0] - 1e-9 && x <= b[0] + 1e-9) return a[1] + (b[1] - a[1]) * (x - a[0]) / ((b[0] - a[0]) || 1);
  }
  return P[P.length - 1][1];
}
/* The dormer's box, as parts/dormer.js draws it (face, cheeks and its roof). */
export function dormerRegion(plan) {
  var t = plan.t, st = plan.state;
  if (!t.dormer || !st.dormer || st.dormer === "none") return null;
  var prof = plan.prof, W = plan.W, L = plan.L, topY = y0 + t.wallH, half = W / 2;
  var xF = half - 0.50, yB = profileYat(prof, xF), xI = 0.12, yI = profileYat(prof, xI) + 0.03;
  var faceH = Math.min(1.95, yI - 0.35 - yB); if (faceH < 1.2) faceH = 1.2;
  var yT = yB + faceH, m = (yI - yT) / (xF - xI), ovF = 0.30, ovS = 0.26, yF = yT - ovF * m;
  var D = Math.min(+st.dormer, L - 2), hw = D / 2;
  return { x0: xI, x1: xF + ovF, zMax: hw + ovS, yAt: function (x) { return yI + (yF - yI) * (x - xI) / ((xF + ovF) - xI) + 0.02; } };
}

/* Where framing may stand, as a test of one point. */
export function regionOf(plan) {
  var W = plan.W, L = plan.L, topY = plan.topY;
  var roof = roofOutline(plan), dorm = dormerRegion(plan);
  var porches = porchOutlines(plan);
  var room = roomOutline(plan);
  var xR0 = roof.P[0][0], xR1 = roof.P[roof.P.length - 1][0];
  function distToPoly(p, P) {
    var best = Infinity;
    for (var i = 0; i < P.length; i++) {
      var a = P[i], b = P[(i + 1) % P.length], dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz;
      var s = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l2)) : 0;
      best = Math.min(best, Math.hypot(p[0] - a[0] - s * dx, p[1] - a[1] - s * dz));
    }
    return best;
  }
  function inFootprint(x, z, tol) { return Math.abs(x) <= W / 2 + tol && Math.abs(z) <= L / 2 + tol; }
  function onPorch(x, z, tol) {
    return porches.some(function (P) { return pointInPoly([x, z], P) && distToPoly([x, z], P) > tol; });
  }
  return {
    roof: roof, dormer: dorm, porches: porches, room: room,
    /* null when framing may stand at v, or the reason it may not */
    test: function (v, tol, opts) {
      tol = tol == null ? TOL : tol;
      opts = opts || {};
      var x = v[0], y = v[1], z = v[2];
      if (y <= y0 + tol) return inFootprint(x, z, tol) ? null : "below the floor line but outside the footprint";
      if (inFootprint(x, z, tol)) {
        if (y < topY - tol) return (!opts.porchOk && onPorch(x, z, tol)) ? "between the floor and the wall top but out on the open porch" : null;
        if (dorm && x >= dorm.x0 - tol && x <= dorm.x1 + tol && Math.abs(z) <= dorm.zMax + tol && y <= dorm.yAt(x) + tol) return null;
        if (y > polylineY(roof.P, x) + tol) return "above the underside of the roof";
        return null;
      }
      /* outside the walls: only under the roof's overhang -- the eave (out to
         the fascia, and no lower than a fascia's depth under the eave's tip)
         and the rake past the gable ends */
      if (x < xR0 - tol || x > xR1 + tol) return "outside the walls and past the fascia";
      if (Math.abs(z) > roof.zMax + tol) return "outside the walls and past the rake overhang";
      if (y > polylineY(roof.P, x) + tol) return "outside the walls and above the underside of the roof";
      if (y < roof.eaveFloor - tol) return "outside the walls and below the eave";
      return null;
    },
    inRoom: function (x, z, tol) { return pointInPoly([x, z], room) || distToPoly([x, z], room) <= (tol == null ? TOL : tol); },
  };
}

/* Every corner of every solid, tested. */
export function regionProblems(plan, solids, opts) {
  var R = regionOf(plan), out = [];
  solids.forEach(function (s) {
    var o = opts && opts.forSolid ? opts.forSolid(s) : {};
    for (var i = 0; i < s.verts.length; i++) {
      var why = R.test(s.verts[i], TOL, o);
      if (why) { out.push({ solid: s, vert: s.verts[i], why: why }); break; }
    }
  });
  return out;
}

/* ------------------------------------------------------------------ bearing */

/* The skids as parts/skids.js draws them (boxes 0.5 x 0.5 per floor segment). */
export function skidSolids(plan) {
  var out = [], id = 1e7;
  var SKX = skidXs(plan.W, plan.construction && plan.construction.skids);
  floorSegments(plan).forEach(function (s) {
    var fend = s.fl + (s.fi === 0 || s.fi === s.NF - 1 ? 0.2 : 0);
    SKX.forEach(function (x) {
      out.push(beamSolid({ p0: [x, 0.25, s.fzc - fend / 2], p1: [x, 0.25, s.fzc + fend / 2], w: 0.5, d: 0.5, up: [0, 1, 0] },
        { part: "skids", kind: "skid", meta: { support: "ground" }, member: id++ }));
    });
  });
  return out;
}

/* 2-D convex hull (monotone chain); 1 or 2 points come back as they are. */
export function hull2(pts) {
  var P = pts.slice().sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
  var U = [];
  P.forEach(function (p) { if (!U.length || Math.abs(U[U.length - 1][0] - p[0]) + Math.abs(U[U.length - 1][1] - p[1]) > 1e-9) U.push(p); });
  if (U.length < 3) return U;
  function cr(o, a, b) { return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); }
  var lo = [], hi = [];
  U.forEach(function (p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 1e-12) lo.pop(); lo.push(p); });
  for (var i = U.length - 1; i >= 0; i--) { var p = U[i]; while (hi.length >= 2 && cr(hi[hi.length - 2], hi[hi.length - 1], p) <= 1e-12) hi.pop(); hi.push(p); }
  lo.pop(); hi.pop();
  return lo.concat(hi);
}
/* How much two convex 2-D shapes overlap (the smallest overlap over the
   separating axes; a point or a segment counts too). */
export function overlap2(A, B) {
  var axes = [];
  function addAxes(P) {
    for (var i = 0; i < P.length; i++) {
      var a = P[i], b = P[(i + 1) % P.length], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz);
      if (l < 1e-9) continue;
      axes.push([-dz / l, dx / l]);
      if (P.length === 2) axes.push([dx / l, dz / l]);
    }
  }
  addAxes(A); addAxes(B);
  if (!axes.length) axes.push([1, 0], [0, 1]);
  var min = Infinity;
  axes.forEach(function (a) {
    var pa = A.map(function (p) { return p[0] * a[0] + p[1] * a[1]; }), pb = B.map(function (p) { return p[0] * a[0] + p[1] * a[1]; });
    var ov = Math.min(Math.max.apply(null, pa), Math.max.apply(null, pb)) - Math.max(Math.min.apply(null, pa), Math.min.apply(null, pb));
    if (ov < min) min = ov;
  });
  return min;
}

/* Does every member rest on something? A member's meta.support says how:
     "bear"          its underside sits on the top of another solid (within tol,
                     overlapping in plan) -- a joist on a skid, a stud on a plate;
     "fasten"        it is nailed to another solid it touches (a rim to the
                     joist ends, an electrical box to a stud);
     "bearOrFasten"  either;
     "ground"        it stands in or on the ground (a block, an anchor);
     "none"          not asked (a light hung from the roof framing).
   `supports` are the solids anything may rest on (the skids plus every member). */
export function bearingProblems(solids, supports, tol) {
  tol = tol == null ? TOL : tol;
  var byTop = supports.slice().sort(function (a, b) { return a.top - b.top; });
  var tops = byTop.map(function (s) { return s.top; });
  function firstAtLeast(v) { var lo = 0, hi = tops.length; while (lo < hi) { var mid = (lo + hi) >> 1; if (tops[mid] < v) lo = mid + 1; else hi = mid; } return lo; }
  function bears(S) {
    for (var i = firstAtLeast(S.bottom - tol); i < byTop.length && byTop[i].top <= S.bottom + tol; i++) {
      var T = byTop[i];
      if (T === S || (T.member === S.member && T.part === S.part)) continue;
      if (T.max[0] < S.min[0] || T.min[0] > S.max[0] || T.max[2] < S.min[2] || T.min[2] > S.max[2]) continue;
      if (overlap2(S.bottomFace, T.topFace) > 1e-4) return T;
    }
    return null;
  }
  function fastened(S) {
    for (var i = 0; i < supports.length; i++) {
      var T = supports[i];
      if (T === S || (T.member === S.member && T.part === S.part)) continue;
      if (T.max[0] < S.min[0] - tol || T.min[0] > S.max[0] + tol || T.max[1] < S.min[1] - tol || T.min[1] > S.max[1] + tol || T.max[2] < S.min[2] - tol || T.min[2] > S.max[2] + tol) continue;
      if (satDepth(S, T, -tol) >= -tol) return T;
    }
    return null;
  }
  var out = [];
  solids.forEach(function (S) {
    var how = (S.meta && S.meta.support) || "bearOrFasten";
    if (how === "none") return;
    if (how === "ground") { if (S.bottom > 0.004 + tol) out.push({ solid: S, why: "is meant to stand in the ground but its foot is " + S.bottom.toFixed(3) + " ft up" }); return; }
    if (how === "bear" || how === "bearOrFasten") { if (bears(S)) return; if (how === "bear") { out.push({ solid: S, why: "rests on nothing: no solid's top is within " + tol + " ft under its foot at y " + S.bottom.toFixed(3) }); return; } }
    if (!fastened(S)) out.push({ solid: S, why: "touches nothing it could be nailed to" });
  });
  return out;
}

/* ----------------------------------------------------- finished drawing */

export const FINISHED_STAGE_IDS = Object.freeze(new Set(STAGES.filter(function (s) { return visibleIn("finished", s); }).map(function (s) { return s.id; })));
/* The finished building's materials and a hash of their triangles (only the
   steps the Finished view shows). Two builds with the same fingerprint draw
   the same finished building. */
export function finishedFingerprint(build) {
  var c = canonical(build, FINISHED_STAGE_IDS);
  return { order: c.order, buckets: c.order.map(function (k) { return { key: k, triangles: c.buckets[k].triangles, hash: c.buckets[k].hash, params: JSON.stringify(c.buckets[k].params) }; }) };
}

/* ------------------------------------------------------------------ parts */

/* A frame entry's members, when its part lists them (default export
   `members(plan)`, or a named export `members`). */
/* A framing part's list of members: `members(plan)` on its default export,
   else a named export called members or ending in "Members" (roofFrameMembers,
   gableFrameMembers ...). `ns` is the module's namespace. Null when it lists
   none (then its boards are read back from what it drew: solidsFromBuild). */
export function membersFunction(ns) {
  if (!ns) return null;
  if (ns.default && typeof ns.default.members === "function") return ns.default.members;
  if (typeof ns.members === "function") return ns.members;
  var id = ns.default && ns.default.id ? String(ns.default.id) : "";
  var camel = id.replace(/-([a-z])/g, function (m, c) { return c.toUpperCase(); }) + "Members";
  if (typeof ns[camel] === "function") return ns[camel];
  var named = Object.keys(ns).filter(function (k) { return /Members$/.test(k) && typeof ns[k] === "function"; });
  return named.length === 1 ? ns[named[0]] : null;
}
