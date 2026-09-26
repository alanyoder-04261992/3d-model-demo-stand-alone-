/* THE OUTSIDE LIGHT: the wall lantern beside a door. Node-safe.

   A white fixture: a backplate on the wall, an arm, a shade box and a warm
   bulb under it. It hangs at y0 + 6.6 ft plus however far the customer
   dragged it, never lower than y0 + 2.2 and never higher than
   * 0.55 ft under the roof line on an end wall (F or B),
   * 0.40 ft under the belt band on the tall wall of a single slope,
   * 0.35 ft under the wall top anywhere else.
   Its own tap target. It gets none of the opening trim -- it is not an
   opening.

   The shade and the bulb are upright boxes in WORLD axes (kit.box), so on the
   corner porch's diagonal wall they do not turn with the wall. And the roof
   line on an end wall is read at the light's distance from the middle, so on
   an off-centre roof (single slope, lean-to, cottage) it is measured against
   the wrong side of the roof. Both are Barnwright's, kept (see the skill).

   STAGE "extras" (set by parts/openings/index.js before it hands over).

   Ported from Barnwright's 3ddesign.html, renderItem's light branch (lines
   3142-3157). Porting edits: rule 1 (wallDefs() -> plan.ws, dims() ->
   plan.d, T() -> plan.t; mat wq box wallPt are the kit's; profileYat from
   model/roof-shapes.js, y0 from engine/constants.js), rule 3 (c.k==="light"
   -> the "light" draw trait, how the item reaches this module), rule 6
   (hitQuads.push -> kit.hit; the caller clears the current item on every way
   out, as `CURIT=null; return;` did). Every number is Barnwright's. */

import { texFlat } from "../../engine/tex-names.js";
import { y0 } from "../../engine/constants.js";
import { profileYat } from "../../model/roof-shapes.js";
import { hasDraw, drawOwn } from "./common.js";

const DRAWS = Object.freeze(["light"]);

/* one outside light, after the renderItem preamble (common.js eachItem) */
function drawLight(plan, kit, it, c, mats) {
  var mat=kit.mat, wq=kit.wq, box=kit.box, wallPt=kit.wallPt;
  var prof=plan.prof;
  var wsl=plan.ws, wl=wsl[it.wall];
  if(!wl){ return; }
  var ul=it.pos;
  var capL=(it.wall==="F"||it.wall==="B")? profileYat(prof,Math.min(plan.d.W/2,Math.abs(ul)))-0.55 : ((plan.t.roof==="slope"&&it.wall==="R")? y0+plan.t.wallH-0.40 : wl.top-0.35);
  var cyl=Math.max(y0+2.2, Math.min(capL, y0+6.6+(it.vy||0)));
  var mFix=mat("lightFix",texFlat,"#F6F5F0",0.22,32);
  var mWarm=mat("bulb",texFlat,"#F4D48A",0.9,60);
  wq(mFix,wl,ul-0.14,cyl-0.32,ul+0.14,cyl+0.10,0.07);
  wq(mFix,wl,ul-0.05,cyl+0.06,ul+0.05,cyl+0.34,0.10);
  var hpv=wallPt(wl,ul,0,0.26);
  box(mFix,hpv[0],cyl+0.32,hpv[2],0.30,0.15,0.30);
  box(mWarm,hpv[0],cyl+0.20,hpv[2],0.17,0.12,0.17);
  kit.hit(it.id, wl.n, [wallPt(wl,ul-0.5,cyl-0.55,0.35),wallPt(wl,ul+0.5,cyl-0.55,0.35),wallPt(wl,ul+0.5,cyl+0.75,0.35),wallPt(wl,ul-0.5,cyl+0.75,0.35)]);
}

const part = {
  id: "light",
  name: "Outside light",
  stage: "extras",
  draws: DRAWS,
  realLife: "An outside wall light: a white lantern with a warm bulb, mounted about six and a half feet up beside the door, kept under the eave or the roof line.",
  appliesTo(plan) { return hasDraw(plan, DRAWS); },
  /* every outside light on the building on its own; the whole building draws
     them through parts/openings/index.js, in the order the items were added */
  build(plan, kit) { drawOwn(plan, kit, part); },
  drawItem: drawLight,
};
export default part;
