/* LOFT: the storage floor up in the roof at the ends of a lofted building.
   Node-safe.

   NEW -- Barnwright drew none. A lofted barn (and the lofted cabins and
   garage) has a loft at each end: a floor at the top of the walls, reaching
   in from the end wall, that you reach from the doors and store things on
   under the barn roof. The style's "loft" trait says which ends and how deep
   ({ends: ["F","B"], depthFt: 4} on the standard line -- the 4 ft is marked
   "assumed" in the manufacturer file: confirm it with the shop). This part
   draws, at each of those ends:
   * LOFT JOISTS ({loft.joist}) across the building every {loft.spacingIn} in
     on centre, standing on the long walls' top plates at topY, from the
     inside of the end framing in to the loft's edge (a joist on the edge).
     Their ends are cut to the roof slope where the roof comes down to the
     wall, so they stay under the roof deck. Where a joist would land on a
     roof truss, the truss's own bottom chord (which lies on the same plates)
     is that joist and no second board is drawn; on a rafter-framed roof
     (no bottom chords) the joist is nailed alongside the rafter instead.
   * the LOFT FLOOR: a plywood deck {loft.deck.thicknessIn} in thick on the
     joists (and over any truss bottom chord in the loft, whichever is
     deeper), as wide as the trusses' top chords allow at that height.
   Everything stays inside the roof volume: above topY, under the trusses'
   top chords and the roof deck. The trusses crossing a loft keep their webs
   and gusset plates out of the floor's thickness (parts/roof-frame.js), and
   a gambrel's collar tie is well above it.

   Where the lofts are comes from roof-frame's loftZones (shared with the
   trusses): from the inside of that end's framing -- the gable framing, or on
   a porch cabin the enclosed end wall -- to depthFt from the end wall.

   STAGE "loft" (kind frame): hidden in the Finished view, shown in the
   Framing view; in Watch-it-build it lands after the roof framing and is
   covered when the roofing lands. PIPELINE entry "loft" (parts/index.js),
   among the framing entries. Only on a style with the loft trait. */

import { trussLayout, rectPoly, clipAll, cleanPoly, belowAll, GUSSET_T, drawMembers } from "./roof-frame.js";

export function loftMembers(plan) {
  if (!plan.t.loft) return [];
  var lay = trussLayout(plan), sec = lay.sec, topY = plan.topY;
  var ct = sec.chord.t, cd = sec.chord.d, dT = sec.deckT;
  var out = [];
  lay.lofts.forEach(function (zn) {
    var lt = zn.joist.t, ld = zn.joist.d, s = zn.spacing;
    /* WHERE THE JOISTS GO, from the wall end inward: one against the end
       framing, then every spacing, and one on the loft's edge. A truss's
       bottom chord lies on the same plates, so where the next support would
       come at or past a truss, the truss IS that support and no joist is
       added; a joist that would land on a truss (or, with rafters, on a
       rafter) is set just before it instead. So no two supports are ever
       further apart than the spacing. */
    var dir = zn.end === "F" ? -1 : 1, zw = zn.wallZ, zEdge = zn.end === "F" ? zn.z0 : zn.z1;
    var rafter = sec.framing === "rafter";
    var trs = lay.trusses.map(function (tr) { return { z: tr.z, reach: ct / 2 + (tr.end ? 0 : GUSSET_T) + lt / 2 + 0.002 }; });
    function along(z) { return (z - zw) * dir; }                  /* distance in from the wall end */
    function clash(z) { return trs.filter(function (tr) { return Math.abs(tr.z - z) < tr.reach; })[0]; }
    var zs = [], cur = zw + dir * lt / 2, last = zEdge - dir * lt / 2;
    if (along(last) - along(cur) < -1e-9) return;
    var c0 = clash(cur);
    if (c0) cur = c0.z + dir * c0.reach;                            /* just inside a truss standing at the wall */
    zs.push(cur);
    for (var guard = 0; guard < 200; guard++) {
      if (along(last) - along(cur) < lt + 0.01) break;
      var target = along(cur) + s >= along(last) - 1e-9 ? last : cur + dir * s;
      /* a truss between here and there carries the floor itself */
      var mid = !rafter && trs.filter(function (tr) { var a = along(tr.z); return a > along(cur) + 1e-9 && a <= along(target) + 1e-9; })
        .sort(function (a, b) { return along(b.z) - along(a.z); })[0];
      if (mid) {
        cur = mid.z;
        if (along(last) - along(cur) < lt + 0.01) break;
        continue;
      }
      var hit = clash(target);
      var z = hit ? hit.z - dir * hit.reach : target;
      if (along(z) - along(cur) < lt + 0.002) {
        /* no room before it: with trusses the truss carries it; with rafters
           the joist goes just past the rafter instead */
        if (!rafter || !hit) { cur = hit ? hit.z : target; continue; }
        z = hit.z + dir * hit.reach;
        if (along(z) > along(last) + 1e-9) break;
      }
      zs.push(z);
      cur = z;
      if (!hit && target === last) break;
    }
    var underDeck = belowAll(sec, dT);
    zs.forEach(function (z) {
      var p = cleanPoly(clipAll(rectPoly(sec.innerL, topY, sec.innerR, topY + ld), underDeck));
      if (p) out.push({ poly: p, z0: z - lt / 2, z1: z + lt / 2, kind: "loft-joist", mat: "lumber", end: zn.end });
    });
    /* the floor: under every top chord, the whole loft */
    var fl = cleanPoly(clipAll(rectPoly(sec.innerL, zn.yd0, sec.innerR, zn.yd1), belowAll(sec, dT + cd)));
    if (fl) out.push({ poly: fl, z0: zn.z0, z1: zn.z1, kind: "loft-deck", mat: "plywood", end: zn.end });
  });
  return out;
}

export default {
  id: "loft",
  name: "Loft",
  stage: "loft",
  realLife: "{loft.joist} loft joists every {loft.spacingIn} in on centre across the building at the wall top, at the loft end or ends, with a plywood loft floor {loft.deck.thicknessIn} in thick on top, under the roof trusses.",
  appliesTo(plan) { return !!plan.t.loft; },
  members(plan) { return loftMembers(plan); },
  build(plan, kit) {
    kit.setStage("loft");
    drawMembers(kit, loftMembers(plan));
  },
};
