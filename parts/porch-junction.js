/* THE PORCH JUNCTION TRIM: the trim boards up the corners where a side or
   corner porch's walls meet the main walls. Node-safe.

   On a Side Cabin or a Deluxe (wrap-porch) Cabin the porch is notched into
   the building, so there are INSIDE corners under the porch roof: where the
   short porch wall turns into the long wall, where it meets the end wall, and
   (on the wrap porch) at the end-wall corner behind the deck. The shop covers
   each of those joints with a trim board painted the trim colour, the same
   way the outside corners get their corner trim. The drawing makes each one a
   square trim post 0.29 ft (3 1/2 in) on a side, from the deck (y0) up the
   full wall height.

   It is part of the PORCH (every triangle is attributed to "porch", the
   PIPELINE entry's part), but it is drawn HERE, at Barnwright's own place in
   buildShed -- straight after the corner trim and before the gable ends --
   because the trim material's triangles must come out in Barnwright's order.
   The rest of the porch is parts/porch.js, which also carries the skill
   (.claude/skills/part-porch); this file has a short skill of its own
   (part-porch-junction) that points there.

   Stage "trim" (kind "finish"): shown in the Finished view; in
   Watch-it-build it lands with the rest of the trim.

   Ported from Barnwright's 3ddesign.html (pinned SHA-256 0bdcf663...),
   buildShed lines 3946-3960, numbers byte for byte. Porting edits
   (docs/ARCHITECTURE.md, Porting rules): pSpan() -> plan.span, T() ->
   plan.t, dims() W/L -> plan.W/plan.L, y0 from engine/constants.js (rule 1);
   box is the kit's; mT is core.mT; kit.setStage("trim") added (rule 7). */

import { y0 } from "../engine/constants.js";

export default {
  id: "porch-junction",
  name: "Porch junction trim",
  stage: "trim",
  realLife: "Trim boards painted the trim colour up the inside corners where a side or wrap porch's walls meet the main walls, from the porch floor to the wall top.",
  appliesTo(plan) { return plan.t.porch === "C" || plan.t.porch === "S"; },
  build(plan, kit, core) {
    var W=plan.W, L=plan.L, t=plan.t;
    var mT=core.mT, box=kit.box;
    kit.setStage("trim");
    if(t.porch==="C"){
      /* white trim at the end-wall corner and each porch wall junction */
      [[-W/2+0.11,L/2-4],[-W/2+4,L/2-4],[W/2-4,L/2-8],[W/2-4,L/2-12+0.11],[W/2-0.11,L/2-12]].forEach(function(j2){
        box(mT,j2[0],y0,j2[1],0.29,t.wallH,0.29);
      });
    }
    if(t.porch==="S"){
      /* white trim at the notch corner and each porch wall junction */
      var spj=plan.span;
      var jl = spj.mid? [[W/2-4,spj.z0],[W/2-0.11,spj.z0],[W/2-4,spj.z1],[W/2-0.11,spj.z1]]
                      : [[W/2-4, spj.f? -L/2+0.11 : L/2-0.11],[W/2-4, spj.f? spj.z1 : spj.z0],[W/2-0.11, spj.f? spj.z1 : spj.z0]];
      jl.forEach(function(j2){
        box(mT,j2[0],y0,j2[1],0.29,t.wallH,0.29);
      });
    }
  },
};
