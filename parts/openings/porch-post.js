/* AN EXTRA PORCH POST: a post the customer adds along the edge of a porch.
   Node-safe.

   A stained wood post (#96682F), 0.34 ft square (about a 4x4), standing on
   the porch deck from the deck top (y0) to the wall top, 0.2 ft in from the
   deck's outer edge:
   * on a front porch (and the front face of a corner porch): along the front
     edge, z = L/2 - 0.2, at x = its position;
   * on a right-side or side-cabin porch (and the side face of a corner
     porch): along the side edge, x = W/2 - 0.2, at z = -its position.
   Its own tap target. On a building with no porch (or a corner-porch post on
   any other face) nothing is drawn. The posts that come WITH a porch are the
   porch part's (parts/porch.js); this is only the extra ones.

   STAGE "porch-frame" (set by parts/openings/index.js before it hands over):
   porch posts and beam are shown in the Finished view AND the Framing view.

   Ported from Barnwright's 3ddesign.html, renderItem's post branch (lines
   3158-3171). Porting edits: rule 1 (T() -> plan.t, dims() -> plan.d; mat
   box are the kit's, y0 from engine/constants.js), rule 3 (c.k==="post" ->
   the "porch-post" draw trait, how the item reaches this module), rule 6
   (hitQuads.push -> kit.hit; the caller clears the current item). Every
   number is Barnwright's. */

import { texFlat } from "../../engine/tex-names.js";
import { y0 } from "../../engine/constants.js";
import { hasDraw, drawOwn } from "./common.js";

const DRAWS = Object.freeze(["porch-post"]);

/* one extra porch post, after the renderItem preamble (common.js eachItem) */
function drawPorchPost(plan, kit, it, c, mats) {
  var mat=kit.mat, box=kit.box;
  var t3=plan.t, d4=plan.d, topY3=y0+t3.wallH;
  var mWp=mat("pwood",texFlat,"#96682F",0.05,12);
  if(t3.porch==="F" || (t3.porch==="C" && it.wall==="F")){
    var zE2=d4.L/2-0.2;
    box(mWp,it.pos,y0,zE2,0.34,topY3-y0,0.34);
    kit.hit(it.id, [0,0,1], [[it.pos-0.45,y0+0.1,zE2+0.3],[it.pos+0.45,y0+0.1,zE2+0.3],[it.pos+0.45,topY3-0.3,zE2+0.3],[it.pos-0.45,topY3-0.3,zE2+0.3]]);
  } else if(t3.porch==="R" || t3.porch==="S" || (t3.porch==="C" && it.wall==="R")){
    var xE2=d4.W/2-0.2, zz=-it.pos;
    box(mWp,xE2,y0,zz,0.34,topY3-y0,0.34);
    kit.hit(it.id, [1,0,0], [[xE2+0.3,y0+0.1,zz+0.45],[xE2+0.3,y0+0.1,zz-0.45],[xE2+0.3,topY3-0.3,zz-0.45],[xE2+0.3,topY3-0.3,zz+0.45]]);
  }
}

const part = {
  id: "porch-post",
  name: "Porch post",
  stage: "porch-frame",
  draws: DRAWS,
  realLife: "An extra stained {porch.post} porch post standing on the edge of the porch deck, from the deck up to the porch beam at the wall top.",
  appliesTo(plan) { return hasDraw(plan, DRAWS); },
  /* every extra porch post on the building on its own; the whole building
     draws them through parts/openings/index.js, in the order the items were
     added */
  build(plan, kit) { drawOwn(plan, kit, part); },
  drawItem: drawPorchPost,
};
export default part;
