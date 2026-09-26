/* THE INSIDE: work benches, shelves, outlets, the switch and the overhead
   lights. Node-safe. NEW geometry -- Barnwright drew none (it shows these
   only on the floor plan, never in 3D).

   Every piece comes from the customer's own items (plan.state.items with the
   catalogue's `int` trait), where they put them on the floor plan:
   * a WORK BENCH (draw "bench"): its length where the customer stretched it
     (it.ln), as deep as the catalogue says (dep), turned when it.rot. Alan,
     Aug 2026: "the work bench is 2 ft deep and about 3 ft off the floor". A
     top on two 2x4 aprons and end rails, on 2x4 legs at the ends and at most
     4 ft apart.
   * a SHELF (draw "shelf"): the same build, 1 ft deep and higher up -- Alan:
     "shelving is 1 ft deep, standard about 5 ft off the floor". A shelf over
     a bench stands its legs on the bench top.
   * an OUTLET or the SWITCH + GFCI (draw "outlet"): a steel box and a white
     cover plate on the inside face of its wall's framing, its centre
     catalogue `sill` above the floor (1.2 ft), screwed to the face of the
     stud nearest where the customer put it -- the way an electrician surface-
     mounts a box in a shed with no inside wall covering. The switch + GFCI is
     a two-gang box.
   * an OVERHEAD LIGHT (draw "overhead-light"): a box and a globe hung under
     the roof framing at the wall top, where the customer put it.
   The heights are construction settings with Alan's answers as the defaults:
   construction.interior.benchHeightIn (36) and shelfHeightIn (60) -- the
   library does not carry an "interior" block yet, so a company adds one to
   change them.

   STAGE "interior" (a framing-kind step): shown in the Framing view and last
   in the Watch-it-build playback. A piece glows with its item when that item
   is selected.

   Barnwright source: new -- Barnwright drew none. The positions are the ones
   its floor plan draws (bpDraw, 3ddesign.html 4457-4480: benches first, then
   shelves on top) and clampPos keeps (model/layout.js: benches and shelves
   0.35 ft in from the walls -- "the shop calls a 20-ft shelf 20 ft even though
   the studs eat 7 in"). */

import { y0 } from "../engine/constants.js";
import { lumberSize, boxMember, wallMember, drawMembers, WALL_INSET, PARTITION_INSET, roomOutline, polyArea, pointInPoly } from "./floor-frame.js";
import { wallFrame, wallSpec } from "./wall-frame.js";

/* Alan's answers (Aug 2026), used when the settings say nothing. */
export const INTERIOR_DEFAULTS = Object.freeze({ benchHeightIn: 36, shelfHeightIn: 60, topIn: 0.75, legMaxSpacingFt: 4 });
/* Drawn sizes of the electrical pieces, in feet. */
export const ELEC = Object.freeze({ gangW: 0.19, boxH: 0.33, boxD: 0.125, plateT: 0.02, plateGrow: 0.03, lightBox: 0.33, lightBoxH: 0.125, globe: 0.36, globeH: 0.3 });

function heights(plan) {
  var c = (plan.construction && plan.construction.interior) || {};
  var d = INTERIOR_DEFAULTS;
  return {
    bench: (c.benchHeightIn != null ? +c.benchHeightIn : d.benchHeightIn) / 12,
    shelf: (c.shelfHeightIn != null ? +c.shelfHeightIn : d.shelfHeightIn) / 12,
    top: (c.topIn != null ? +c.topIn : d.topIn) / 12,
    legGap: c.legMaxSpacingFt != null ? +c.legMaxSpacingFt : d.legMaxSpacingFt,
  };
}

/* THE ROOM INSIDE THE STUDS: the room's outline (parts/floor-frame.js
   roomOutline) moved in to the inside face of the wall framing -- the kennel's
   partition stands further back (PARTITION_INSET). Everything inside is
   built within it. */
export function clearOutline(plan) {
  var P = roomOutline(plan), n = P.length, D = wallSpec(plan).D;
  var ccw = polyArea(P) > 0, lines = [];
  for (var i = 0; i < n; i++) {
    var a = P[i], b = P[(i + 1) % n], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz);
    var inN = ccw ? [-dz / l, dx / l] : [dz / l, -dx / l];
    var part = plan.t.kennel && Math.abs(a[1]) < 1e-9 && Math.abs(b[1]) < 1e-9;
    var d = (part ? PARTITION_INSET : WALL_INSET) + D;
    lines.push({ p: [a[0] + inN[0] * d, a[1] + inN[1] * d], d: [dx / l, dz / l] });
  }
  var out = [];
  for (var j = 0; j < n; j++) {
    var A = lines[(j + n - 1) % n], B = lines[j];
    var den = A.d[0] * B.d[1] - A.d[1] * B.d[0];
    if (Math.abs(den) < 1e-12) { out.push(B.p); continue; }
    var t = ((B.p[0] - A.p[0]) * B.d[1] - (B.p[1] - A.p[1]) * B.d[0]) / den;
    out.push([A.p[0] + A.d[0] * t, A.p[1] + A.d[1] * t]);
  }
  return out;
}
function inside(C, x, z) {
  if (pointInPoly([x, z], C)) return true;
  for (var i = 0; i < C.length; i++) {            /* on the edge counts */
    var a = C[i], b = C[(i + 1) % C.length], dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz;
    var s = l2 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l2)) : 0;
    if (Math.hypot(x - a[0] - s * dx, z - a[1] - s * dz) < 1e-7) return true;
  }
  return false;
}
/* a box [x0,x1] x [z0,z1] wholly inside C: its corners inside and no corner of
   C poking into it */
function boxInside(C, x0, x1, z0, z1) {
  if (!inside(C, x0, z0) || !inside(C, x1, z0) || !inside(C, x1, z1) || !inside(C, x0, z1)) return false;
  for (var i = 0; i < C.length; i++) { var p = C[i]; if (p[0] > x0 + 1e-7 && p[0] < x1 - 1e-7 && p[1] > z0 + 1e-7 && p[1] < z1 - 1e-7) return false; }
  var c = [(x0 + x1) / 2, (z0 + z1) / 2];
  return inside(C, c[0], c[1]);
}
/* Fit a bench or shelf inside the studs, the way the shop builds it: cut
   shorter where a wall is in the way (its length is what gives), and only if
   its depth does not fit where it was put, moved across the least it can be.
   Returns the box, or null when there is no room anywhere near. */
export function fitStand(C, f) {
  var bx = { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity };
  C.forEach(function (p) { bx.x0 = Math.min(bx.x0, p[0]); bx.x1 = Math.max(bx.x1, p[0]); bx.z0 = Math.min(bx.z0, p[1]); bx.z1 = Math.max(bx.z1, p[1]); });
  var L = f.alongZ ? [Math.max(f.z0, bx.z0), Math.min(f.z1, bx.z1)] : [Math.max(f.x0, bx.x0), Math.min(f.x1, bx.x1)];
  var Dp = f.alongZ ? [f.x0, f.x1] : [f.z0, f.z1];
  var dLo = f.alongZ ? bx.x0 : bx.z0, dHi = f.alongZ ? bx.x1 : bx.z1;
  function box(a0, a1, b0, b1) { return f.alongZ ? { x0: b0, x1: b1, z0: a0, z1: a1 } : { x0: a0, x1: a1, z0: b0, z1: b1 }; }
  function ok(b) { return boxInside(C, b.x0, b.x1, b.z0, b.z1); }
  if (!(L[1] - L[0] > 0.5)) return null;
  var cen = (f.alongZ ? (f.z0 + f.z1) : (f.x0 + f.x1)) / 2;
  cen = Math.max(L[0], Math.min(L[1], cen));
  for (var k = 0; k <= 200; k++) {
    var sh = (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.05;
    var b0 = Dp[0] + sh, b1 = Dp[1] + sh;
    if (b0 < dLo - 1e-9 || b1 > dHi + 1e-9) continue;
    if (ok(box(L[0], L[1], b0, b1))) return box(L[0], L[1], b0, b1);
    var seg = function (a) { return ok(box(a - 0.01, a + 0.01, b0, b1)); };
    if (!seg(cen)) continue;
    var a0 = cen, a1 = cen;
    while (a0 - 0.02 >= L[0] - 1e-9 && seg(a0 - 0.02)) a0 -= 0.02;
    while (a1 + 0.02 <= L[1] + 1e-9 && seg(a1 + 0.02)) a1 += 0.02;
    a0 = Math.max(L[0], a0 - 0.01); a1 = Math.min(L[1], a1 + 0.01);
    while (a1 - a0 > 0.5 && !ok(box(a0, a1, b0, b1))) { a0 += 0.01; a1 -= 0.01; }
    if (a1 - a0 > 0.5 && ok(box(a0, a1, b0, b1))) return box(a0, a1, b0, b1);
  }
  return null;
}
/* the nearest spot to (x, z) where a square s across fits inside C */
function fitSquare(C, x, z, s) {
  var h = s / 2;
  if (boxInside(C, x - h, x + h, z - h, z + h)) return [x, z];
  for (var r = 0.05; r <= 12; r += 0.05) {
    var best = null;
    var n = Math.max(8, Math.ceil(2 * Math.PI * r / 0.05));
    for (var i = 0; i < n; i++) {
      var a = 2 * Math.PI * i / n, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
      if (boxInside(C, px - h, px + h, pz - h, pz + h)) { best = [px, pz]; break; }
    }
    if (best) return best;
  }
  return null;
}

/* A bench or shelf's footprint: x0 x1 z0 z1 and which way it runs. */
export function standFootprint(plan, it) {
  var c = plan.CAT[it.cat], ln = it.ln || 4;
  var ex = (it.rot ? c.dep : ln), ez = (it.rot ? ln : c.dep);
  return { x0: (it.px || 0) - ex / 2, x1: (it.px || 0) + ex / 2, z0: (it.pz || 0) - ez / 2, z1: (it.pz || 0) + ez / 2, alongZ: !!it.rot, len: ln, dep: c.dep };
}

/* A bench or shelf, built on the box `f` (already fitted inside the studs):
   a top on front and back aprons and end rails, on legs at the ends and at
   most legMaxSpacingFt apart. `floorAt(x0,x1,z0,z1)` says where a leg's foot
   lands (the floor, or a bench top under a shelf). */
function stand(out, plan, it, f, H, floorAt) {
  var hs = heights(plan);
  var s2 = lumberSize("2x4"), t = s2.t, d = s2.d;
  var topB = y0 + H - hs.top, aprB = topB - d;
  var id = it.id, kind = plan.CAT[it.cat].k;
  var len = f.alongZ ? f.z1 - f.z0 : f.x1 - f.x0, dep = f.alongZ ? f.x1 - f.x0 : f.z1 - f.z0;
  var m0 = { item: id, glowItem: id, what: kind, cut: f.cut, moved: f.moved };
  function M(extra) { return Object.assign({}, m0, extra); }
  /* in the stand's own terms: a along its length, b across its depth */
  function box(k, a0, a1, b0, b1, ya, yb, extra) {
    if (f.alongZ) out.push(boxMember(k, "lumber", f.x0 + b0, f.x0 + b1, ya, yb, f.z0 + a0, f.z0 + a1, M(extra)));
    else out.push(boxMember(k, "lumber", f.x0 + a0, f.x0 + a1, ya, yb, f.z0 + b0, f.z0 + b1, M(extra)));
  }
  box(kind + "-top", 0, len, 0, dep, topB, y0 + H, { support: "bear" });
  box(kind + "-apron", 0, len, 0, t, aprB, topB, { support: "bear" });
  box(kind + "-apron", 0, len, dep - t, dep, aprB, topB, { support: "bear" });
  box(kind + "-rail", 0, t, t, dep - t, aprB, topB, { support: "fasten" });
  box(kind + "-rail", len - t, len, t, dep - t, aprB, topB, { support: "fasten" });
  var n = Math.max(2, Math.ceil((len - d) / hs.legGap) + 1);
  for (var i = 0; i < n; i++) {
    var a0 = (len - d) * i / (n - 1);
    [[0, t], [dep - t, dep]].forEach(function (bb) {
      var foot = f.alongZ ? floorAt(f.x0 + bb[0], f.x0 + bb[1], f.z0 + a0, f.z0 + a0 + d) : floorAt(f.x0 + a0, f.x0 + a0 + d, f.z0 + bb[0], f.z0 + bb[1]);
      if (aprB - foot > 0.02) box(kind + "-leg", a0, a0 + d, bb[0], bb[1], foot, aprB, { support: "bear" });
    });
  }
}

/* The box on a wall: centred on the face of the stud (or king, jack, end
   stud) nearest where the customer put it, at its height, on the inside face
   of the framing -- skipping a stud where the box would stand out past the
   room's inside corner or on top of a box already there. */
function outletAt(out, plan, it, WF, C, placed) {
  var c = plan.CAT[it.cat], run = null, fr = null;
  WF.framed.forEach(function (x) { if (!run && x.run.key === it.wall && it.pos >= x.run.a - 1e-9 && it.pos <= x.run.b + 1e-9) { run = x.run; fr = x; } });
  if (!run) return;
  var yc = y0 + (c.sill != null ? c.sill : 1.2), gangs = c.switch ? 2 : 1;
  var bw = ELEC.gangW * gangs, bh = ELEC.boxH, g = ELEC.plateGrow;
  var oIn = -run.inset - run.D;                                   /* the framing's inside face */
  var oOut = oIn - ELEC.boxD - ELEC.plateT;
  function fits(u) {
    var a = wpt2(run.w, u - bw / 2 - g, oOut), b = wpt2(run.w, u + bw / 2 + g, oOut);
    var x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]), z0 = Math.min(a[1], b[1]), z1 = Math.max(a[1], b[1]);
    var e = wpt2(run.w, u, oIn);
    x0 = Math.min(x0, e[0]); x1 = Math.max(x1, e[0]); z0 = Math.min(z0, e[1]); z1 = Math.max(z1, e[1]);
    if (!boxInside(C, x0, x1, z0, z1)) return false;
    return !placed.some(function (q) { return q.run === run && Math.abs(q.u - u) < (q.w + bw) / 2 + 2 * g && Math.abs(q.y - yc) < bh + 2 * g; });
  }
  var best = null;
  fr.members.forEach(function (m) {
    if (["stud", "king", "jack", "end-stud", "corner-stud", "cripple"].indexOf(m.kind) < 0) return;
    var at = m.meta.at, u = (at.u0 + at.u1) / 2;
    if (at.y0 > yc - bh / 2 || at.y1 < yc + bh / 2) return;
    if (!fits(u)) return;
    if (best === null || Math.abs(u - it.pos) < Math.abs(best - it.pos)) best = u;
  });
  if (best === null) return;
  var u = best;
  placed.push({ run: run, u: u, w: bw, y: yc });
  var meta = { item: it.id, glowItem: it.id, what: c.k, onStud: true, movedBy: +(u - it.pos).toFixed(3), support: "fasten" };
  out.push(wallMember("elec-box", "steel", run.w, u - bw / 2, u + bw / 2, yc - bh / 2, yc + bh / 2, oIn - ELEC.boxD, oIn, meta));
  out.push(wallMember("elec-plate", "fixture", run.w, u - bw / 2 - g, u + bw / 2 + g, yc - bh / 2 - g, yc + bh / 2 + g,
    oOut, oIn - ELEC.boxD, Object.assign({}, meta)));
}
/* a point of wall w (at height 0) in plan, [x, z] */
function wpt2(w, u, o) {
  if (w.ox !== undefined) return [w.ox + w.ax[0] * u + w.n[0] * o, w.oz + w.ax[2] * u + w.n[2] * o];
  var c = w.cx || 0;
  if (w.n[2] !== 0) return [c + w.ax[0] * u, w.at + w.n[2] * o];
  return [w.at + w.n[0] * o, c + w.ax[2] * u];
}

/* An overhead light: a box and a globe hung under the roof framing at the
   wall top, where the customer put it -- or, when that is on the porch or
   over a wall's framing (the package puts its lights at a quarter of the
   length, which on a front-porch cabin is out on the porch), at the nearest
   spot inside the room. */
function lightAt(out, plan, it, C) {
  var E = ELEC, top = plan.topY;
  var at = fitSquare(C, it.px || 0, it.pz || 0, Math.max(E.globe, E.lightBox) + 0.02);
  if (!at) return;
  var x = at[0], z = at[1];
  var meta = { item: it.id, glowItem: it.id, what: "ilt", movedBy: +Math.hypot(x - (it.px || 0), z - (it.pz || 0)).toFixed(3), support: "none" };
  out.push(boxMember("light-box", "steel", x - E.lightBox / 2, x + E.lightBox / 2, top - E.lightBoxH, top, z - E.lightBox / 2, z + E.lightBox / 2, meta));
  out.push(boxMember("light-globe", "fixture", x - E.globe / 2, x + E.globe / 2, top - E.lightBoxH - E.globeH, top - E.lightBoxH, z - E.globe / 2, z + E.globe / 2, Object.assign({}, meta)));
}

export function interiorMembers(plan) {
  var out = [], CAT = plan.CAT, hs = heights(plan), C = clearOutline(plan);
  var items = plan.state.items.filter(function (it) { return CAT[it.cat] && CAT[it.cat].int; });
  var benches = items.filter(function (it) { return CAT[it.cat].draw === "bench"; });
  var shelves = items.filter(function (it) { return CAT[it.cat].draw === "shelf"; });
  function fitted(it) {
    var f0 = standFootprint(plan, it), f = fitStand(C, f0);
    if (!f) return null;
    f.alongZ = f0.alongZ;
    f.cut = +(((f0.alongZ ? f0.z1 - f0.z0 : f0.x1 - f0.x0) - (f.alongZ ? f.z1 - f.z0 : f.x1 - f.x0))).toFixed(3);
    f.moved = +(f0.alongZ ? (f.x0 - f0.x0) : (f.z0 - f0.z0)).toFixed(3);
    return f;
  }
  function onFloor() { return y0; }
  /* benches first, then the shelves (a shelf over a bench stands on it) */
  var benchTops = [];
  benches.forEach(function (it) {
    var f = fitted(it);
    if (!f) return;
    stand(out, plan, it, f, hs.bench, onFloor);
    benchTops.push({ x0: f.x0, x1: f.x1, z0: f.z0, z1: f.z1, y: y0 + hs.bench });
  });
  shelves.forEach(function (it) {
    var f = fitted(it);
    if (!f) return;
    stand(out, plan, it, f, hs.shelf, function (x0, x1, z0, z1) {
      var y = y0;
      benchTops.forEach(function (b) { if (x1 > b.x0 + 1e-9 && x0 < b.x1 - 1e-9 && z1 > b.z0 + 1e-9 && z0 < b.z1 - 1e-9 && b.y < y0 + hs.shelf) y = Math.max(y, b.y); });
      return y;
    });
  });
  var WF = null, placed = [];
  items.forEach(function (it) {
    var d = CAT[it.cat].draw;
    if (d === "outlet") { WF = WF || wallFrame(plan); outletAt(out, plan, it, WF, C, placed); }
    else if (d === "overhead-light") lightAt(out, plan, it, C);
  });
  out.forEach(function (m) { m.stage = "interior"; });
  return out;
}

export default {
  id: "interior",
  name: "Shelves, benches and electrical",
  stage: "interior",
  realLife: "Work benches and shelves built from framing lumber where the customer placed them on the floor plan (a top on aprons and legs; a shelf over a bench stands on it), the outlets and the switch with its GFCI outlet in steel boxes on the studs, and the overhead lights hung under the roof framing.",
  appliesTo(plan) { return plan.state.items.some(function (it) { return plan.CAT[it.cat] && plan.CAT[it.cat].int; }); },
  members: interiorMembers,
  build(plan, kit) {
    drawMembers(kit, interiorMembers(plan), "interior");
  },
};
