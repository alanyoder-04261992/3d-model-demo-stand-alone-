/* THE WALL SIDING: the sheets on the outside of every wall. Node-safe.

   In real life the walls are studs on a bottom plate with two top plates, and
   the siding goes on in 4x8 sheets: LP rough-sawn panel on a painted
   building, ribbed metal over OSB on a metal one. The shop's own words
   (Barnwright's note on the real construction, 3ddesign.html 2147-2156, kept
   word for word):

     "Walls: studs on a bottom plate with two top plates; loft ("short wall")
     studs are 75" for about a 6.63 ft wall, tall-wall (UTX) studs are 89" for
     about 7.79 ft. A 2x4 really measures 1 1/2" x 3 1/2". Siding comes in 4x8
     sheets: on utility buildings it runs flush with the top of the wall and
     hangs past the bottom to nail into the 2x6 rim; on loft buildings it
     hangs 3 1/2" past the wall bottom and gets trimmed at the top. SKIRT
     below is that hang-down — it is why you never see a bare floor edge
     under the siding."

   SKIRT (0.29 ft = 3 1/2 in) lives in engine/constants.js.

   The finished view draws each wall as ONE flat siding face (no studs, no
   thickness: the real studs are the NEW wall-frame part). The siding
   texture carries the grooves.

   Ported from Barnwright's 3ddesign.html (pinned SHA-256 85c4b022...),
   buildShed's walls loop, lines 3878-3905, numbers byte for byte:
   * which walls: F B R L, plus P1-P3 on a corner porch or S1-S2 (S3 when the
     notch is in the middle) on a side porch;
   * the SKIRT RULE: the four main walls hang y0-SKIRT (to cover the floor
     rim) -- except on the kennel, on the front wall of a front or corner
     porch and the right wall of a porch "R" (no style uses "R"; Barnwright's
     branch is kept), which stand on a deck, and on every porch wall (S*, P*);
   * the PORCH CUT-OUTS: a side porch cuts the R wall round the notch (both
     sides of it when it is in the middle) and trims 4 ft off whichever end
     wall the notch reaches; a corner porch draws only a 4 ft stub of F, the R
     wall from 12 ft back and the L wall to 4 ft short of the front;
   * the DOG KENNEL: at F the kennel's open front (kennel.front), at R and L
     the kennel's side walls (kennel.side) -- drawn from inside this loop, at
     Barnwright's position, and attributed to the kennel (kit.part); at B the
     ordinary siding plus an inside face (bodyIn, 0.72 of the siding colour)
     seen through the run. That inside face is drawn by these lines, so it is
     siding (test/golden/README.md).

   Porting edits (docs/ARCHITECTURE.md, Porting rules): state.type==="DK" ->
   the kennel trait (plan.t.kennel); T() -> plan.t, pSpan() -> plan.span,
   wallDefs() -> plan.ws, state -> plan.state, STEP -> kit.STEP, y0 and SKIRT
   from engine/constants.js; mB is core.mB (made by assemble); kennelFront /
   kennelSide -> kennel.front / kennel.side wrapped in kit.part("kennel");
   setStage added. */

import { y0, SKIRT } from "../engine/constants.js";
import { texSiding } from "../engine/tex-names.js";
import { tintShade } from "../engine/math.js";
import * as kennel from "./kennel.js";

/* The walls that carry siding, in Barnwright's order (the order is the draw
   order within the siding material, so it is part of the look). */
export function sidingWalls(plan){
  var t=plan.t;
  return (t.porch==="C"?["F","B","R","L","P1","P2","P3"]:t.porch==="S"?(plan.span.mid?["F","B","R","L","S1","S2","S3"]:["F","B","R","L","S1","S2"]):["F","B","R","L"]);
}

export default {
  id: "siding",
  name: "Siding",
  stage: "siding",
  realLife: "The wall siding in 4x8 sheets: rough-sawn LP panel on a painted building or ribbed metal over OSB on a metal one, hanging past the bottom of each wall to cover the floor rim (except where a wall stands on a porch deck), cut round the porch notch on a porch building.",
  appliesTo() { return true; },
  build(plan, kit, core) {
    var t=plan.t, ws=plan.ws, topY=plan.topY, state=plan.state, STEP=kit.STEP;
    var mB=core.mB;
    var mat=kit.mat, wq=kit.wq, wallPt=kit.wallPt, quadUV=kit.quadUV;
    kit.setStage("siding");
    /* walls */
    sidingWalls(plan).forEach(function(k){
      var w=ws[k], half=w.len/2;
      if(t.kennel && k==="F"){ kit.part("kennel",function(){ kennel.front(plan,kit,core,w,half,topY); }); return; }
      if(t.kennel && (k==="R"||k==="L")){ kit.part("kennel",function(){ kennel.side(plan,kit,core,w,k,half,topY); }); return; }
      /* siding hangs past the wall bottom to cover the floor rim — except on
         walls that sit back on a porch deck, where it stops at the deck */
      var yb0=("FBRL".indexOf(k)>=0 && !t.kennel
        && !((t.porch==="F"||t.porch==="C") && k==="F")
        && !(t.porch==="R" && k==="R"))? y0-SKIRT : y0;
      if(t.porch==="S" && (k==="R"||k==="F"||k==="B")){
        var spw=plan.span;
        if(k==="R"){
          if(spw.mid){ wq(mB,w,-half,yb0,-spw.z1,w.top,0,"sid"); wq(mB,w,-spw.z0,yb0,half,w.top,0,"sid"); return; }
          if(spw.f) wq(mB,w,-half,yb0,half-spw.P,w.top,0,"sid"); else wq(mB,w,-half+spw.P,yb0,half,w.top,0,"sid"); return; }
        if(k==="F"&&!spw.f&&!spw.mid){ wq(mB,w,-half,yb0,half-4,w.top,0,"sid"); return; }
        if(k==="B"&&spw.f){ wq(mB,w,-half+4,yb0,half,w.top,0,"sid"); return; }
      }
      if(t.porch==="C" && k==="F"){ wq(mB,w,-half,y0,-half+4,w.top,0,"sid"); return; }
      if(t.porch==="C" && k==="R"){ wq(mB,w,-half+12,yb0,half,w.top,0,"sid"); return; }
      if(t.porch==="C" && k==="L"){ wq(mB,w,-half,yb0,half-4,w.top,0,"sid"); return; }
      wq(mB,w,-half,yb0,half,w.top,0,"sid");
      if(t.kennel){
        var mIn=mat("bodyIn",texSiding,tintShade(state.body,0.72),0.04,10);
        var pI=[wallPt(w,half,y0,-0.05),wallPt(w,-half,y0,-0.05),wallPt(w,-half,w.top,-0.05),wallPt(w,half,w.top,-0.05)];
        quadUV(mIn,pI,[[half/STEP,y0/2.6],[-half/STEP,y0/2.6],[-half/STEP,w.top/2.6],[half/STEP,w.top/2.6]]);
      }
    });
  },
};
