/* THE 11-LITE DOOR AND THE FRENCH DOORS: a white entry door with an arch-top
   fan window, single (36 in) or a pair (the French doors). Node-safe.

   Drawn in the wall's own coordinates, in front of the unbroken siding: the
   shared opening frame first (common.js openingFrame: tap target, soft
   shadow, side casings, the 22.5-degree head, the porch header band on a porch
   building), then each LEAF:
   * the white slab and the shadow the head throws on it;
   * the glass: a rectangle from 0.42 of the height up to the spring line,
     topped by a half-round fan of ten glass triangles, in a white frame;
   * the muntins: two verticals, a horizontal, a bar at the spring line and
     three fan spokes (45, 90 and 135 degrees) -- six lites below and four in
     the fan;
   * two raised panels below the glass;
   * a silver knob 0.30 ft in from the latch edge (on the French doors, the
     meeting edges).

   STAGE "doors" (set by parts/openings/index.js before it hands over).

   Ported from Barnwright's 3ddesign.html, renderItem's d36lite / dfr branch
   (lines 3423-3467). Porting edits: rule 1 (mat wq wtri3 wbrace wallPt box
   are the kit's), rule 3 (it.cat==="d36lite"||"dfr" -> the "lite-door" draw
   trait, how the item reaches this module; it.cat==="dfr", twice -> a pair of
   leaves, plan.CAT[it.cat].leaves===2), rule 7 (the stage is set by the
   caller). Every number is Barnwright's.

   FIRST CALL WINS: "galv" and "doorSh6" are also made by the six-panel steel
   door (door-steel.js) with slightly different paint; whichever door is drawn
   first on a building sets it for both, exactly as in Barnwright.

   guv is a function declaration inside the fan loop, as Barnwright wrote it:
   block-scoped in a module, and only used inside that same loop pass. */

import { texFlat } from "../../engine/tex-names.js";
import { openingFrame, hasDraw, drawOwn } from "./common.js";

const DRAWS = Object.freeze(["lite-door"]);

/* one 11-lite door or pair of French doors, after the renderItem preamble
   (common.js eachItem) */
function drawLiteDoor(plan, kit, it, c, mats) {
  var mT=mats.mT, mWht=mats.mWht, mG=mats.mG;
  var op=openingFrame(plan, kit, it, c, mT);
  if(!op) return;
  var mat=kit.mat, wq=kit.wq, wtri3=kit.wtri3, wbrace=kit.wbrace, wallPt=kit.wallPt, box=kit.box;
  var w=op.w, ch=op.ch, yb=op.yb, u=op.u;
  var pair=plan.CAT[it.cat].leaves===2;
  var lv2=pair?[[-c.w/4,c.w/2-0.06],[c.w/4,c.w/2-0.06]]:[[0,c.w]];
  var mGalv2=mat("galv",texFlat,"#cfd4d8",0.5,44);
  var mPan2=mat("panIn",texFlat,"#e2e2de",0.1,20);
  var mDshL=mat("doorSh6",texFlat,"#d3d3cf",0.06,12);
  var mPanHi2=mat("panHi",texFlat,"#ffffff",0.16,30);
  lv2.forEach(function(lv){
    var lu=u+lv[0], lw=lv[1];
    wq(mWht,w,lu-lw/2,yb,lu+lw/2,yb+ch,0.05);
    wq(mDshL,w,lu-lw/2+0.02,yb+ch-0.26,lu+lw/2-0.02,yb+ch-0.02,0.056);
    /* arch-top fan lite */
    var gw=lw-0.76, R2=gw/2;
    var gy0=yb+ch*0.42, gy1=yb+ch-0.55-R2;
    wq(mWht,w,lu-gw/2-0.10,gy0-0.10,lu-gw/2,gy1,0.086);
    wq(mWht,w,lu+gw/2,gy0-0.10,lu+gw/2+0.10,gy1,0.086);
    wq(mWht,w,lu-gw/2,gy0-0.10,lu+gw/2,gy0,0.086);
    wq(mG,w,lu-gw/2,gy0,lu+gw/2,gy1,0.072,"glass");
    var gh=gy1+R2-gy0;
    for(var ai=0;ai<10;ai++){
      var a0=Math.PI*ai/10, a1=Math.PI*(ai+1)/10;
      var q0=[lu+Math.cos(a0)*R2,gy1+Math.sin(a0)*R2], q1=[lu+Math.cos(a1)*R2,gy1+Math.sin(a1)*R2];
      function guv(p){return [0.03+0.94*(p[0]-lu+R2)/gw,0.03+0.94*(p[1]-gy0)/gh];}
      wtri3(mG,w,[lu,gy1],q0,q1,0.072,[guv([lu,gy1]),guv(q0),guv(q1)]);
    }
    /* muntins: 2 verticals + a horizontal + spring bar + 3 fan spokes */
    [-gw/6,gw/6].forEach(function(d){ wq(mWht,w,lu+d-0.028,gy0,lu+d+0.028,gy1,0.082); });
    wq(mWht,w,lu-gw/2,(gy0+gy1)/2-0.026,lu+gw/2,(gy0+gy1)/2+0.026,0.082);
    wq(mWht,w,lu-gw/2,gy1-0.03,lu+gw/2,gy1+0.03,0.082);
    [0.25,0.5,0.75].forEach(function(f){
      var a=Math.PI*f;
      wbrace(mWht,w,lu,gy1,lu+Math.cos(a)*(R2-0.02),gy1+Math.sin(a)*(R2-0.02),0.055,0.082);
    });
    /* two raised panels below the glass */
    var pw2=lw-1.0;
    [[yb+0.30,yb+1.12],[yb+1.36,gy0-0.24]].forEach(function(pr2){
      wq(mPan2,w,lu-pw2/2,pr2[0],lu+pw2/2,pr2[1],0.058);
      wq(mWht,w,lu-pw2/2+0.07,pr2[0]+0.07,lu+pw2/2-0.07,pr2[1]-0.07,0.064);
      wq(mPanHi2,w,lu-pw2/2+0.07,pr2[1]-0.14,lu+pw2/2-0.07,pr2[1]-0.07,0.068);
    });
    /* silver knob */
    var kx=lu+(pair?(lv[0]<0?1:-1):1)*(lw/2-0.30);
    var kpL=wallPt(w,kx,0,0.10);
    box(mGalv2,kpL[0],yb+ch*0.44-0.05,kpL[2],0.10,0.10,0.10);
    box(mGalv2,kpL[0],yb+ch*0.44-0.11,kpL[2],0.15,0.03,0.15);
  });
}

const part = {
  id: "door-lite",
  name: "11-lite door and French doors",
  stage: "doors",
  draws: DRAWS,
  realLife: "A white entry door with glass in its top half under an arched fan window -- single, or a pair of French doors -- with white muntins, two raised panels below the glass and a silver knob, trimmed with side casings and a head board.",
  appliesTo(plan) { return hasDraw(plan, DRAWS); },
  /* every 11-lite and French door on the building on its own; the whole
     building draws them through parts/openings/index.js, in the order the
     items were added */
  build(plan, kit) { drawOwn(plan, kit, part); },
  drawItem: drawLiteDoor,
};
export default part;
