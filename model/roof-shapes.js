/* THE SHAPE OF EACH ROOF, as a cross-section. Node-safe, pure.

   Lifted from Barnwright's 3ddesign.html (lines 2158-2252) with its numbers
   byte for byte. What changed is only WHERE the numbers come from:
   - the rise, the gambrel's shoulders and the saltbox ridge are construction
     settings (library/construction.json roof.shapes), whose defaults ARE
     Barnwright's numbers ({"w": 0.27} means 0.27 x the width);
   - the Standard Barn's steep shoulders, which Barnwright wrote as
     `if(state.type==="SB")`, are the style's "gambrel" trait;
   - "GU" and "SB" having no gable band are the style's "gableBand": false,
     and the Dog Kennel's clean front is its "kennel" trait.

   Coordinates: x across the width (the R wall is +x), y up. A profile is a
   list of [x, y] points from the -x eave to the +x eave at the wall top topY.

   roofShape(t, construction)            the numbers for this style's roof
   roofRise(W, t, construction)          ridge height above the wall top (camera and shadow box only)
   roofProfile(W, topY, t, construction) the cross-section points
   profileYat(prof, x)                   the roof line's height at x
   cottageEave(P, th, eave)              the cottage's level-soffit eave (eave: construction
                                         roof.cottageEave, or roofShape(...).cottageEave). MUTATES P and returns it,
                                         exactly like Barnwright: pass a copy (prof.map(q => q.slice()))
                                         unless you mean to change the profile you hold
   gableClip(pts, prof, inset)           cut a gable-end shape off at the roof line
   gableBandY(k, frame, items)           height of the trim band across gable end k, or null */

import { y0 } from "../engine/constants.js";

/* How thick the roof slab draws, and how much further a gambrel's upper panels
   hang past the gable end than its lower ones (an inch and a half, off Alan's
   photograph). Barnwright's ROOF_TH and RAKE_STEP. */
export const ROOF_TH = 0.26;
export const RAKE_STEP = 0.135;

/* Barnwright's numbers, used when no construction is passed. They are the same
   as library/construction.json's roof block (tools/check-construction.mjs
   proves the two agree). */
export const DEFAULT_ROOF = Object.freeze({
  dormerRise: { w: 0.30 },
  cottageEave: { backIn: 4, frontIn: 8, fasciaIn: 4 },
  shapes: {
    gable: { rise: { w: 0.27 }, eaveOverhang: { left: 0.42, right: 0.42 }, rakeOverhang: 0.45 },
    gambrel: { rise: { w: 0.45 }, lowerRise: { w: 0.32 }, upperRise: { w: 0.13 }, knee: { w: 0.38 }, eaveOverhang: { left: 0.42, right: 0.42 }, rakeOverhang: 0.12 },
    salt: { rise: { w: 0.26 }, ridge: { w: 0.18 }, eaveOverhang: { left: 0.42, right: 0.42 }, rakeOverhang: 0.45 },
    lean: { rise: { w: 0.17 }, eaveOverhang: { left: 0, right: 0.333 }, rakeOverhang: 0.12 },
    slope: { rise: { w: 0.28 }, eaveOverhang: { left: 0.35, right: 1.15 }, rakeOverhang: 0.45 },
  },
});

/* A length setting in feet: a plain number of feet, {"ft": n}, {"in": n}, or
   {"w": f} = f times the building width W. W*f is computed in that order, which
   is what Barnwright writes (W*0.27), so the result is bit-identical. */
export function lengthOf(v, W) {
  if (typeof v === "number") return v;
  if (v && typeof v === "object") {
    if (typeof v.w === "number") return W * v.w;
    if (typeof v.ft === "number") return v.ft;
    if (typeof v.in === "number") return v.in / 12;
  }
  throw new Error("A roof setting must be feet ({\"ft\": 2.43}), inches ({\"in\": 8}) or a share of the width ({\"w\": 0.27}); got " + JSON.stringify(v));
}

/* The roof numbers for this style: the construction's shape for its roof,
   then the style's own gambrel trait (the Standard Barn) and rake overhang. */
export function roofShape(t, construction) {
  const roof = (construction && construction.roof) || DEFAULT_ROOF;
  const shapes = roof.shapes || DEFAULT_ROOF.shapes;
  const base = shapes[t.roof] || DEFAULT_ROOF.shapes[t.roof] || shapes.gable || DEFAULT_ROOF.shapes.gable;
  const s = Object.assign({}, base);
  if (t.roof === "gambrel" && t.gambrel) Object.assign(s, t.gambrel);
  if (t.rakeOverhang != null) s.rakeOverhang = t.rakeOverhang;
  s.dormerRise = roof.dormerRise || DEFAULT_ROOF.dormerRise;
  s.cottageEave = roof.cottageEave || DEFAULT_ROOF.cottageEave;
  return s;
}

/* Ridge height above the wall top. Only the camera target and the shadow box
   use it, never the geometry -- and for the gambrel it is 0.45W even on the
   Standard Barn, whose real profile rises 3.43 ft. That mismatch is a kept
   Barnwright quirk: "fixing" it moves the framing and the shadows. */
export function roofRise(W, t, construction) {
  const s = roofShape(t, construction);
  if (t.dormer) return lengthOf(s.dormerRise, W);
  return lengthOf(s.rise, W);
}

export function roofProfile(W, topY, t, construction) {
  const s = roofShape(t, construction);
  const r = t.roof;
  if (r === "gambrel") {
    /* the mini barn (Standard Barn) overrides these through its gambrel trait:
       steep shoulders, taller cap, break at the door frame corners */
    const rL = lengthOf(s.lowerRise, W), rU = lengthOf(s.upperRise, W), kx = lengthOf(s.knee, W);
    return [[-W / 2, topY], [-kx, topY + rL], [0, topY + rL + rU], [kx, topY + rL], [W / 2, topY]];
  }
  /* THE RIDGE SITS OVER THE FRONT. Alan, Aug 2026: the doors and windows go on
     the front side, and his drawing puts the front on the SHORT slope. The
     doors are on the R wall, which is +x, so the ridge belongs at +0.18W --
     short steep slope over the doors, long shallow one down the back. His
     photograph agrees: the ridge measures 77 percent of the way across the
     gable from the back corner toward the door corner. */
  if (r === "salt") return [[-W / 2, topY], [lengthOf(s.ridge, W), topY + lengthOf(s.rise, W)], [W / 2, topY]];
  if (r === "lean") return [[-W / 2, topY + lengthOf(s.rise, W)], [W / 2, topY]];
  if (r === "slope") return [[-W / 2, topY], [W / 2, topY + lengthOf(s.rise, W)]];
  return [[-W / 2, topY], [0, topY + (t.dormer ? lengthOf(s.dormerRise, W) : lengthOf(s.rise, W))], [W / 2, topY]];
}

export function profileYat(prof, x) {
  for (var i = 0; i < prof.length - 1; i++) {
    var a = prof[i], b = prof[i + 1];
    if (x >= a[0] - 1e-6 && x <= b[0] + 1e-6) { var s = (x - a[0]) / ((b[0] - a[0]) || 1); return a[1] + (b[1] - a[1]) * s; }
  }
  return prof[0][1];
}

/* THE COTTAGE EAVE, and it has to satisfy two drawings of Alan's at once.
   His RED line over the designer is ONE STRAIGHT RUN each side, ridge to the
   outer tip, no kink at the wall. His BLUE section of the same eave is a 4 in
   fascia and then 8 in of level soffit back to the wall. Both are true only if
   the deck runs PAST the wall top and lands at the fascia, one fascia depth
   above the soffit -- which is how the real one is framed: rafters bearing on
   the plate, tails cut off level for the soffit.
   Back (-x) 4 in, front (+x, the door side) 8 in, both level, raised one fascia.
   MUTATES P (replaces its first and last points) and returns it. */
export function cottageEave(P, th, eave) {
  var e = eave || DEFAULT_ROOF.cottageEave;
  var fas = Math.max(0.02, e.fasciaIn / 12 - th);
  P[0] = [P[0][0] - e.backIn / 12, P[0][1] + fas];                              /* back, -x, 4 in */
  P[P.length - 1] = [P[P.length - 1][0] + e.frontIn / 12, P[P.length - 1][1] + fas];   /* front, +x, 8 in */
  return P;
}

/* CUT A GABLE-END SHAPE OFF AT THE ROOF LINE.
   A gable window can be taller than the triangle it has to live in -- the 18x24
   does not fit the gable of ANY 8 ft wide shed. Moving it is not the answer:
   pushed up it draws through the roof into the sky, pushed down it lands on the
   wall over the door. So the window stays where a window belongs and what falls
   above the roof is simply not drawn, the way the roof trim would cover it.
   Every roof profile here is concave, so the region under it is the
   intersection of one half-plane per segment -- clipping against each
   segment's whole line is exact, not an approximation. */
export function gableClip(pts, prof, inset) {
  var out = pts;
  for (var i = 0; i < prof.length - 1 && out.length > 2; i++) {
    var a = prof[i], b = prof[i + 1];
    if (Math.abs(b[0] - a[0]) < 1e-9) continue;
    var m = (b[1] - a[1]) / (b[0] - a[0]);
    var keep = [];
    for (var j = 0; j < out.length; j++) {
      var P = out[j], Q = out[(j + 1) % out.length];
      var fp = (a[1] + (P[0] - a[0]) * m - inset) - P[1], fq = (a[1] + (Q[0] - a[0]) * m - inset) - Q[1];
      if (fp >= 0) keep.push(P);
      if ((fp >= 0) !== (fq >= 0)) { var t = fp / (fp - fq); keep.push([P[0] + (Q[0] - P[0]) * t, P[1] + (Q[1] - P[1]) * t]); }
    }
    out = keep;
  }
  return out;
}

/* The horizontal trim band across gable end k ("F" or "B"), or null when that
   end has none. Shared by the band part and the door-height clamp so a door's
   header casing always stops just under the band instead of overlapping it.
   frame: {t, W, topY, prof, CAT} (a plan or a frame); items: the building's
   items (defaults to frame.state.items). A gable window on R or L counts as the
   FRONT end, as in Barnwright.
   THE COTTAGE SHED HAS THE BAND (Alan's photograph, Aug 2026, and Weather
   King's own illustration). The metal cottage is clean: a metal building has
   no wood trim, and the metal test returns null for it. */
export function gableBandY(k, frame, items) {
  var t = frame.t;
  if (t.metal || t.roof === "lean" || t.roof === "slope" || t.gableBand === false) return null;
  if (t.kennel && k === "F") return null;
  if ((t.porch === "F" || t.porch === "C") && k === "F") return null;
  var list = items || (frame.state && frame.state.items) || [];
  var CAT = frame.CAT;
  var hasG = false;
  list.forEach(function (g8) { if (CAT[g8.cat] && CAT[g8.cat].gable && (g8.wall === "B" ? "B" : "F") === k) hasG = true; });
  var topY = y0 + t.wallH, prof = frame.prof;
  var ry = -1; for (var pv = 1; pv < prof.length - 1; pv++) if (prof[pv][1] > ry) ry = prof[pv][1];
  return (t.roof === "gambrel" && !hasG) ? topY + (ry - topY) * 0.40 : topY - 0.02;
}
