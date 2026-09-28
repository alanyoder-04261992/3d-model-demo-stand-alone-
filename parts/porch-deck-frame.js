/* THE PORCH DECK: the joists under a cabin's front porch and the deck
   boards on every porch. Node-safe. NEW geometry -- Barnwright drew none (its
   porch floor is part of the one floor slab, parts/floor.js).

   In real life a cabin's porch floor is at the same height as the room's
   floor and sits on the same skids:
   * a FRONT porch (porch "F", and the 4 ft end deck of the corner porch "C")
     is framed on from the room's floor frame, whose front end joist sits
     under the front wall: joists across the width at the floor's spacing
     (floor.spacingIn) measured from that end joist, a rim down each side
     carrying on from the room's rims, and a band joist across the front edge.
     The joists are porch.joist lumber, drawn the same depth as the floor's so
     the deck is one level (parts/floor-frame.js);
   * a SIDE porch (porch "S") and the corner porch's run down the door side
     sit on the room's own floor joists, which run straight under the porch
     wall -- so they need no joists of their own here;
   * every porch is decked with treated deck boards laid across the joists
     (along the length of the building), with a small gap between boards
     for the rain, from the porch wall out to the deck's edge -- where the
     room itself gets tongue-and-groove sheets (parts/floor-deck.js).
   The boards are drawn as thick as the room's decking so both finish at y0.

   Stages: the joists are "floor-frame", the boards "floor-deck" -- the
   Watch-it-build playback lays them with the room's floor frame and decking.

   Barnwright source: new -- Barnwright drew none. It fits the porch floor of
   Barnwright's slab (buildShed 3868-3877) under the porch it draws
   (parts/porch.js: porchFront 2465, porchSideCorner 2488, porchCorner 2525). */

import { floorPlanOf, rectFrame, slabMember, clipRect, drawMembers } from "./floor-frame.js";

/* A treated deck board: 5 1/2 in wide with a 1/4 in gap to the next (drawn
   sizes; the settings have no porch deck board yet). */
export const DECK_BOARD = Object.freeze({ widthIn: 5.5, gapIn: 0.25 });

export function porchDeckMembers(plan) {
  var F = floorPlanOf(plan), out = [];
  if (F.porchRect) {
    rectFrame(F.porchRect, F, { joist: F.porchJoist, rim: F.rim, backEnd: false, frontEnd: true, frame: "porch" })
      .forEach(function (m) { m.stage = "floor-frame"; out.push(m); });
  }
  var bw = DECK_BOARD.widthIn / 12, gap = DECK_BOARD.gapIn / 12, fp = F.fp;
  F.porches.forEach(function (P, pi) {
    var x0 = Math.min.apply(null, P.map(function (p) { return p[0]; })), x1 = Math.max.apply(null, P.map(function (p) { return p[0]; }));
    for (var x = x0, n = 0; x < x1 - 1e-6; x += bw + gap, n++) {
      var Q = clipRect(P, x, Math.min(x + bw, x1), fp.z0, fp.z1);
      if (!Q.length) continue;
      var m = slabMember("deck-board", "board", Q, F.joistTop, F.joistTop + F.deckT, { porch: pi, n: n, support: "bear" });
      m.stage = "floor-deck";
      out.push(m);
    }
  });
  return out;
}

export default {
  id: "porch-deck-frame",
  name: "Porch deck",
  stage: ["floor-frame", "floor-deck"],
  realLife: "The porch floor, level with the room's: {porch.joist} joists under a front porch deck at {floor.spacingIn} in on centre on the skids, with a rim down each side and a band across the front (a side porch sits on the room's own joists), and treated deck boards laid across the joists with a gap between them.",
  appliesTo(plan) { return plan.t.porch === "F" || plan.t.porch === "C" || plan.t.porch === "S"; },
  members: porchDeckMembers,
  build(plan, kit) {
    drawMembers(kit, porchDeckMembers(plan), "floor-frame");
  },
};
