/* THE BELT BAND on a single slope: a trim board along the tall wall. Node-safe.

   In real life the single slope's tall side (the R wall, +x) carries a row of
   transom windows above the ordinary wall height. A white trim board runs the
   full length of that wall at the ordinary wall top, just under the transom
   row, the way a belt band does on the real building. Doors on that wall are
   kept under it (the door-height rule).

   The drawing is one board on the R wall from y0 + wallH - 0.04 to
   y0 + wallH + 0.25 (a 0.29 ft = 3 1/2 in board), 0.035 ft proud of the
   siding, painted the trim colour.

   Stage "trim".

   Ported from Barnwright's 3ddesign.html (pinned SHA-256 0bdcf663...),
   buildShed lines 4015-4019, numbers byte for byte. Porting edits
   (docs/ARCHITECTURE.md, Porting rules): T() -> plan.t, wallDefs() ->
   plan.ws, y0 from engine/constants.js, mT is core.mT (rule 1); setStage
   added (rule 7). */

import { y0 } from "../engine/constants.js";

export default {
  id: "belt-band",
  name: "Belt band",
  stage: "trim",
  realLife: "On a single slope, a trim board the full length of the tall wall at the ordinary wall height, just under the transom row.",
  appliesTo(plan) { return plan.t.roof === "slope"; },
  build(plan, kit, core) {
    var t=plan.t, ws=plan.ws, mT=core.mT;
    kit.setStage("trim");
    /* single slope: white belt band under the transom row on the tall wall */
    if(t.roof==="slope"){
      var wR9=ws.R, hR9=wR9.len/2;
      kit.wq(mT,wR9,-hR9,y0+t.wallH-0.04,hR9,y0+t.wallH+0.25,0.035);
    }
  },
};
