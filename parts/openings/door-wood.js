/* THE WOODEN SHOP DOOR: the door the shop builds itself out of the same
   siding as the walls, single (36 in, 48 in) or a pair (72 in double doors).
   Node-safe.

   Drawn in the wall's own coordinates, in front of the unbroken siding: the
   shared opening frame first (common.js openingFrame: tap target, soft shadow,
   side casings stopping just under the head board, the 22.5-degree head, and
   the header band on a porch building), then each LEAF:
   * the leaf itself, siding-textured in the door colour (else the siding
     colour) with its grooves lined up on the wall's (UV mode "sid" uses the
     wall's own u), and the shadow the header throws on it;
   * the trim-coloured frame on it: two stiles and a top rail 0.29 ft wide, a
     bottom rail, and a mid rail centred at 0.52 of the height;
   * on a PAINTED building: solid trim-colour clipped corners (the lower panel
     a full octagon, the upper panel its top corners only), and three black
     spade T-hinges on the hinge edge -- or, in the upper panel, the Dog
     Kennel back door's transom window, or the optional door window;
   * on a METAL building: short corner braces in each panel, dark hinge pads
     and a dark vertical handle;
   and on a pair, the trim astragal down the middle (plus an iron seam when
   painted); on a painted door, the black handle.
   A single door hinges on the left (handle on the right); on a pair each leaf
   hinges on its outer edge.

   STAGE "doors" (set by parts/openings/index.js before it hands over).

   Ported from Barnwright's 3ddesign.html, renderItem's shop-door branch
   (lines 3292-3375). Porting edits, and nothing else:
   * rule 1: T() -> plan.t, state -> plan.state; mat wq wtri3 wbrace are the
     kit's, wslab wrev the item primitives (common.js);
   * rule 2: state.type==="DK" -> the style's kennel trait (plan.t.kennel);
   * rule 3: it.cat==="w48"||"w72"||"w36" -> the "shop-door" draw trait (how
     the item reaches this module); it.cat==="w72" -> plan.CAT[it.cat].leaves===2;
   * rule 7: the stage is set by the caller.
   The door height (71 1/2 in on loft builds, 76 1/2 in on tall walls) is set
   before this runs (common.js eachItem) and the opening's height and bottom
   come from openingRect (common.js openingFrame). */

import { texSiding, texMetal, texFlat } from "../../engine/tex-names.js";
import { tintShade } from "../../engine/math.js";
import { itemTools, openingFrame, hasDraw, drawOwn } from "./common.js";

const DRAWS = Object.freeze(["shop-door"]);

/* one shop door, after the renderItem preamble (common.js eachItem) */
function drawShopDoor(plan, kit, it, c, mats) {
  var mT=mats.mT, mWht=mats.mWht, mG=mats.mG, mDark=mats.mDark;
  var op=openingFrame(plan, kit, it, c, mT);
  if(!op) return;
  var P=itemTools(kit), wslab=P.wslab, wrev=P.wrev;
  var mat=kit.mat, wq=kit.wq, wtri3=kit.wtri3, wbrace=kit.wbrace;
  var w=op.w, ch=op.ch, yb=op.yb, u=op.u;
  var state=plan.state;
  var dbl=plan.CAT[it.cat].leaves===2, painted=!plan.t.metal;
  var mDf=mat("doorF",plan.t.metal?texMetal:texSiding,(state.doorC||state.body),plan.t.metal?0.5:0.06,plan.t.metal?40:14,plan.t.metal?1.1:0.6);
  mDf.age=plan.t.metal?3:4;
  var leaves=dbl?[[-c.w/4,c.w/2-0.06],[c.w/4,c.w/2-0.06]]:[[0,c.w]];
  leaves.forEach(function(lv){
    var lu=u+lv[0], lw=lv[1];
    wq(mDf,w,lu-lw/2,yb,lu+lw/2,yb+ch,0.05,"sid");
    var mDsh=mat("doorSh",texFlat,tintShade(state.doorC||state.body,0.62),0.05,10);
    wq(mDsh,w,lu-lw/2+0.02,yb+ch-0.30,lu+lw/2-0.02,yb+ch-0.02,0.056);  /* header shadow on the leaf */
    var BW=0.29, BB=0.29;
    wslab(mT,w,lu-lw/2,yb,lu-lw/2+BW,yb+ch,0.05,0.088);
    wslab(mT,w,lu+lw/2-BW,yb,lu+lw/2,yb+ch,0.05,0.088);
    wslab(mT,w,lu-lw/2+BW,yb+ch-BW,lu+lw/2-BW,yb+ch,0.05,0.088);
    wslab(mT,w,lu-lw/2+BW,yb,lu+lw/2-BW,yb+BB,0.05,0.088);
    var ymid=yb+ch*0.52;
    wslab(mT,w,lu-lw/2+BW-0.02,ymid-0.145,lu+lw/2-BW+0.02,ymid+0.145,0.05,0.088);
    var xl=lu-lw/2+BW, xr=lu+lw/2-BW;
    var hs=dbl?(lv[0]<0?-1:1):-1;
    if(painted){
      /* real shed door: solid white clipped corners.
         lower panel = full octagon, upper panel = top corners only */
      var pb1=yb+BB, pt1=ymid-0.145, pb2=ymid+0.145, pt2=yb+ch-BW;
      var g=Math.min(0.58,(xr-xl)*0.24,(pt1-pb1)*0.24,(pt2-pb2)*0.24);
      /* lower panel — all four corners */
      wtri3(mT,w,[xl,pb1],[xl+g,pb1],[xl,pb1+g],0.092);
      wtri3(mT,w,[xr-g,pb1],[xr,pb1],[xr,pb1+g],0.092);
      wtri3(mT,w,[xl,pt1-g],[xl+g,pt1],[xl,pt1],0.092);
      wtri3(mT,w,[xr,pt1-g],[xr,pt1],[xr-g,pt1],0.092);
      if(plan.t.kennel && !dbl){
        /* kennel back door: transom window up top */
        var wy1=yb+ch-BW-0.04, wy0=wy1-1.05;
        wq(mWht,w,xl+0.02,wy0,xl+0.15,wy1,0.086);
        wq(mWht,w,xr-0.15,wy0,xr-0.02,wy1,0.086);
        wq(mWht,w,xl+0.15,wy0,xr-0.15,wy0+0.11,0.086);
        wq(mWht,w,xl+0.15,wy1-0.10,xr-0.15,wy1,0.086);
        wrev(mWht,w,xl+0.15,wy0+0.11,xr-0.15,wy1-0.10,0.072,0.086);
        wq(mG,w,xl+0.15,wy0+0.11,xr-0.15,wy1-0.10,0.072,"glass");
        [(xl+xr)/2-(xr-xl)/6,(xl+xr)/2+(xr-xl)/6].forEach(function(mx){ wq(mWht,w,mx-0.028,wy0+0.09,mx+0.028,wy1-0.08,0.082); });
        wq(mT,w,xl-0.02,wy0-0.24,xr+0.02,wy0-0.02,0.086);
      } else if(it.lite){
        /* shop-door window: 2-lite strip in the upper panel */
        var ly1=pt2-0.03, ly0=Math.max(pb2+0.42, ly1-0.92);
        wq(mWht,w,xl+0.02,ly0,xl+0.14,ly1,0.086);
        wq(mWht,w,xr-0.14,ly0,xr-0.02,ly1,0.086);
        wq(mWht,w,xl+0.14,ly0,xr-0.14,ly0+0.10,0.086);
        wq(mWht,w,xl+0.14,ly1-0.09,xr-0.14,ly1,0.086);
        wrev(mWht,w,xl+0.14,ly0+0.10,xr-0.14,ly1-0.09,0.072,0.086);
        wq(mG,w,xl+0.14,ly0+0.10,xr-0.14,ly1-0.09,0.072,"glass");
        [(xl+xr)/2-(xr-xl)/6,(xl+xr)/2+(xr-xl)/6].forEach(function(mx3){ wq(mWht,w,mx3-0.026,ly0+0.08,mx3+0.026,ly1-0.07,0.082); });
      } else {
        /* upper panel — top corners only */
        wtri3(mT,w,[xl,pt2-g],[xl+g,pt2],[xl,pt2],0.092);
        wtri3(mT,w,[xr,pt2-g],[xr,pt2],[xr-g,pt2],0.092);
      }
      /* black spade T-hinges: knuckle at the edge, short strap tapering to a point */
      var mIron=mat("iron",texFlat,"#17191b",0.18,26);
      var hx=lu+hs*(lw/2+0.02);
      [yb+ch-0.16,ymid,yb+0.20].forEach(function(yc2){
        var s1=hx-hs*0.62;
        wq(mIron,w,Math.min(hx,hx-hs*0.12),yc2-0.15,Math.max(hx,hx-hs*0.12),yc2+0.15,0.096);
        wtri3(mIron,w,[hx-hs*0.10,yc2-0.11],[hx-hs*0.10,yc2+0.11],[s1,yc2],0.094);
      });
    } else {
      [[yb+BB,ymid-0.145],[ymid+0.145,yb+ch-BW]].forEach(function(pn){
        var pb=pn[0], pt3=pn[1];
        var g5=Math.min(0.66,(xr-xl)*0.42,(pt3-pb)*0.42);
        wbrace(mT,w,xl,pb+g5, xl+g5,pb, 0.23,0.125);
        wbrace(mT,w,xr-g5,pb, xr,pb+g5, 0.23,0.125);
        wbrace(mT,w,xl,pt3-g5, xl+g5,pt3, 0.23,0.125);
        wbrace(mT,w,xr-g5,pt3, xr,pt3-g5, 0.23,0.125);
      });
      [0.55,ch*0.52,ch-0.55].forEach(function(hy){ wq(mDark,w,lu+hs*(lw/2-0.26)-0.1,yb+hy-0.11,lu+hs*(lw/2-0.26)+0.1,yb+hy+0.11,0.096); });
      wq(mDark,w,lu-hs*(lw/2-0.42)-0.06,yb+ch*0.46,lu-hs*(lw/2-0.42)+0.06,yb+ch*0.46+0.38,0.096);
    }
  });
  if(dbl) wq(mT,w,u-0.06,yb,u+0.06,yb+ch,0.13);
  if(painted){
    var mIron2=mat("iron",texFlat,"#17191b",0.18,26);
    if(dbl) wq(mIron2,w,u-0.018,yb+0.04,u+0.018,yb+ch-0.04,0.135); /* seam between leaves */
    var ax=dbl? u-0.16 : u+(c.w/2-0.44), ay=yb+ch*0.52;
    wq(mIron2,w,ax-0.045,ay-0.16,ax+0.045,ay+0.16,0.15);          /* handle */
    wq(mIron2,w,ax-0.085,ay-0.05,ax+0.085,ay+0.05,0.152);
  }
}

const part = {
  id: "door-wood",
  name: "Wooden shop door",
  stage: "doors",
  draws: DRAWS,
  realLife: "A wooden door the shop builds from the building's own siding -- single, or a pair of double doors -- framed with trim-colour stiles and rails, clipped-corner panels and black T-hinges on a painted building (corner braces on a metal one), in an opening {openings.doorHeightIn.other} in tall ({openings.doorHeightIn.gambrel} in on loft builds).",
  appliesTo(plan) { return hasDraw(plan, DRAWS); },
  /* every shop door on the building on its own; the whole building draws them
     through parts/openings/index.js, in the order the items were added */
  build(plan, kit) { drawOwn(plan, kit, part); },
  drawItem: drawShopDoor,
};
export default part;
