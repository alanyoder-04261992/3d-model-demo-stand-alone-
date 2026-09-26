/* GABLE-END FRAMING: the studs that fill each gable end. Node-safe.

   NEW -- Barnwright drew no framing. In real life each gable end of the roof
   is closed by a gable-end truss sitting on the end wall: the end truss's
   chords (drawn by parts/roof-frame.js, flush inside the gable siding) and,
   between them, upright gable studs the siding is nailed to. This part draws
   those studs, and the framing round every opening in the gable:
   * gable studs ({walls.stud}, the same way round as the wall studs: the thin
     side across the building, the deep side into it) every {walls.spacingIn}
     in on centre, on the same marks as the end wall's own studs (from the
     corner that wall's layout starts at: -x on the F end, +x on the B end)
     so every one stands over a wall stud, standing on the end truss's bottom
     chord (on the end wall's top
     plate when the roof is framed with rafters) and cut off under the end
     truss's top chord -- cut with model/roof-shapes.js gableClip against the
     chords' underside, so a stud can never poke into the chord or the roof;
   * round a gable window (the octagon, the 18x24), the gable vent, and a door
     on the end wall that rises past the wall top into the gable (the
     Standard Barn's): king studs each side; a header ({walls.header}, picked
     for the opening's width like a wall header -- and, like a wall header,
     the next size down, then a flat 2x, when the rule's size does not fit
     under the top chord) on jack studs -- only when not even a flat 2x fits
     does the top chord itself span the opening. A gable window dragged
     toward an eave runs up into the top chord on its low side: the chord
     closes that side, and a king there is only as tall as the room under it;
     cripple studs above the header; a flat sill under a window or vent when
     there is room above the chord, with cripples under it. Where a window or
     a door dips into the end truss's bottom chord the chord is cut (parts/
     roof-frame.js cuts it at the same place -- both read gableOpenings), and
     its framing stands on the end wall's top plate instead.
   The faux loft window is trim nailed to the siding, not an opening: nothing
   is framed round it.

   Where the openings are comes from model/layout.js openingRect (the same
   rectangle the openings part draws round), gathered by roof-frame's
   gableOpenings; the gable vent's box from parts/gable-vent.js ventSpot.

   STAGE "roof-frame" (the gable-end truss is part of the roof framing): hidden
   in the Finished view, shown in the Framing view, covered once the roofing
   lands in Watch-it-build. PIPELINE entry "gable-frame" (parts/index.js),
   among the framing entries, before "roof-frame". */

import { gableClip } from "../model/roof-shapes.js";
import { wallRuns } from "./wall-frame.js";
import {
  trussLayout, gableOpenings, offsetPolyline, ridgeBoard, cleanPoly, clipHalf, rectPoly, drawMembers,
} from "./roof-frame.js";

/* Every stud and opening member of both gable ends, as members (see
   parts/roof-frame.js): x-y outline pushed along z through the gable wall. */
export function gableFrameMembers(plan) {
  var lay = trussLayout(plan), sec = lay.sec;
  var W = plan.W, L = plan.L, topY = plan.topY;
  var st = sec.stud.t, sd = sec.stud.d, cd = sec.chord.d, dT = sec.deckT;
  var con = plan.construction || {};
  var sg = ((con.walls && con.walls.spacingIn != null) ? +con.walls.spacingIn : 16) / 12;
  var base = sec.framing === "truss" ? topY + cd : topY;
  /* the underside of the end truss's (or end rafters') top chords */
  var lowerLine = offsetPolyline(sec, dT + cd);
  /* with rafters, the ridge board runs through the gable framing too */
  var runs = wallRuns(plan);
  var rb = ridgeBoard(plan, lay), rbx0 = null, rbx1 = null, rby0 = null;
  if (rb) {
    rbx0 = Math.min.apply(null, rb.poly.map(function (q) { return q[0]; }));
    rbx1 = Math.max.apply(null, rb.poly.map(function (q) { return q[0]; }));
    rby0 = Math.min.apply(null, rb.poly.map(function (q) { return q[1]; }));
  }
  function upTo(poly) {
    var p = gableClip(poly, lowerLine, 0);
    if (rb && p.length > 2) {
      var x0 = Math.min.apply(null, p.map(function (q) { return q[0]; })), x1 = Math.max.apply(null, p.map(function (q) { return q[0]; }));
      if (x1 > rbx0 + 1e-9 && x0 < rbx1 - 1e-9) p = clipHalf(p, [0, 1, rby0]);
    }
    return cleanPoly(p);
  }
  function tall(p) {                      /* a stud shorter than 0.05 ft is not worth a board */
    if (!p) return null;
    var y0_ = Infinity, y1_ = -Infinity;
    p.forEach(function (q) { y0_ = Math.min(y0_, q[1]); y1_ = Math.max(y1_, q[1]); });
    return y1_ - y0_ >= 0.05 ? p : null;
  }
  var out = [];
  ["F", "B"].forEach(function (end) {
    var z0 = end === "F" ? L / 2 - 0.02 - sd : -L / 2 + 0.02;
    var z1 = z0 + sd;
    var ops = gableOpenings(plan, end, lay);
    function add(poly, kind, extra) {
      if (!poly) return;
      var m = { poly: poly, z0: z0, z1: z1, kind: kind, mat: "lumber", end: end };
      if (extra) Object.keys(extra).forEach(function (k) { m[k] = extra[k]; });
      out.push(m);
    }
    /* the stud grid: the SAME marks as the end wall's own studs under it
       (parts/wall-frame.js lays them from its run's start, which on the F end
       is the -x corner and on the B end the +x corner, since u runs to the
       right seen from outside), so every gable stud stands over a wall stud
       and the siding sheets land on both. It was always from the -x corner,
       which put not one gable stud over a B-wall stud on a 10 or 14 ft wide
       building. Over a porch (the F wall set back) the enclosed end wall's
       marks are used; with no wall under that end (the kennel's open run),
       that end's own corner. */
    var grid = [], w = plan.ws[end];
    var run = runs.filter(function (r) { return r.key === end; })[0];
    var uo = run ? run.a : -w.len / 2, ax = w.ax[0], cx = w.cx || 0;
    for (var k = -200; k <= 200; k++) {
      var gx = cx + ax * (uo + k * sg);
      if (gx > -W / 2 + 1e-9 && gx < W / 2 - 1e-9) grid.push(gx);
    }
    grid.sort(function (a, b) { return a - b; });
    var xs = grid.slice();
    /* a stud tight in each corner where the gable has any height there (the
       cottage's roof runs above the wall top at the eaves) */
    [sec.innerL + st / 2, sec.innerR - st / 2].forEach(function (x) {
      if (!xs.some(function (g) { return Math.abs(g - x) < st + 0.005; })) xs.push(x);
    });
    xs.sort(function (a, b) { return a - b; });
    function inFrame(x) {
      return ops.some(function (o) { return x + st / 2 > o.fx0 - 1e-6 && x - st / 2 < o.fx1 + 1e-6; });
    }
    xs.forEach(function (x) {
      if (x - st / 2 < sec.innerL - 1e-9 || x + st / 2 > sec.innerR + 1e-9 || inFrame(x)) return;
      add(tall(upTo(rectPoly(x - st / 2, base, x + st / 2, base + 60))), "gable-stud");
    });
    /* the framing round each opening */
    ops.forEach(function (o) {
      var info = { opening: o.what, kindOf: o.kind };
      /* kings, outside everything */
      add(tall(upTo(rectPoly(o.fx0, o.base, o.fx0 + st, o.base + 60))), "king", info);
      add(tall(upTo(rectPoly(o.fx1 - st, o.base, o.fx1, o.base + 60))), "king", info);
      if (o.header) {
        add(tall(upTo(rectPoly(o.x0 - st, o.base, o.x0, o.header.y0))), "jack", info);
        add(tall(upTo(rectPoly(o.x1, o.base, o.x1 + st, o.header.y0))), "jack", info);
        add(upTo(rectPoly(o.x0 - st, o.header.y0, o.x1 + st, o.header.y1)), "header", info);
        grid.forEach(function (x) {
          if (x - st / 2 > o.x0 - st + 1e-6 && x + st / 2 < o.x1 + st - 1e-6) {
            add(tall(upTo(rectPoly(x - st / 2, o.header.y1, x + st / 2, o.header.y1 + 60))), "cripple", info);
          }
        });
      }
      if (o.sill) {
        add(upTo(rectPoly(o.x0, o.y0 - st, o.x1, o.y0)), "sill", info);
        grid.forEach(function (x) {
          if (x - st / 2 > o.x0 + 1e-6 && x + st / 2 < o.x1 - 1e-6) {
            add(tall(upTo(rectPoly(x - st / 2, o.base, x + st / 2, o.y0 - st))), "cripple", info);
          }
        });
      }
    });
  });
  return out;
}

export default {
  id: "gable-frame",
  name: "Gable-end framing",
  stage: "roof-frame",
  realLife: "{walls.stud} gable studs every {walls.spacingIn} in on centre filling each gable end between the end truss's chords, with king studs, jack studs, a header and a sill framed round every gable window, vent and tall end door.",
  appliesTo() { return true; },
  members(plan) { return gableFrameMembers(plan); },
  build(plan, kit) {
    kit.setStage("roof-frame");
    drawMembers(kit, gableFrameMembers(plan));
  },
};
