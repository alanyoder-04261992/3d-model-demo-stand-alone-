/* THE SIX-PANEL STEEL DOOR: the 36 in in-swing steel entry door, the one a
   cabin or an office shed gets. Node-safe.

   Drawn in the wall's own coordinates, in front of the unbroken siding: the
   shared opening frame first (common.js openingFrame: tap target, soft
   shadow, side casings, the 22.5-degree head, the porch header band on a porch
   building), then the door, which SITS IN A HOLE:
   * a white jamb behind it, the white slab set back at 0.048 ft, and the
     reveal from the slab out to the casing face (0.12) you can see down;
   * the shadow the head throws on the slab, and the gap down the latch edge;
   * SIX RAISED PANELS at the fractions measured off Alan's photograph --
     columns at 0.170-0.435 and 0.565-0.830 of the width, rows at 0.064-0.300,
     0.369-0.758 and 0.822-0.945 of the height -- each stepping DOWN off the
     stile first, then ramping back up on four bevels to the field;
   * a satin knob on a rose (rose, neck, ball), 0.32 ft in from the latch edge
     at 0.44 of the height;
   * the wood threshold under the slab.
   It is always white (it does not take the door colour), and it has no hinges
   on the outside: an in-swing door hinges inside.

   STAGE "doors" (set by parts/openings/index.js before it hands over).

   Ported from Barnwright's 3ddesign.html, renderItem's d36in branch (lines
   3376-3422). Porting edits: rule 1 (mat wq are the kit's, wrev wbevel wdrum
   wdisc wslant the item primitives in common.js), rule 3 (it.cat==="d36in" ->
   the "steel-6panel" draw trait, how the item reaches this module), rule 7
   (the stage is set by the caller). Every number is Barnwright's.

   FIRST CALL WINS: "galv" and "doorSh6" are also made by the 11-lite door
   (door-lite.js) with slightly different paint; whichever door is drawn first
   on a building sets it for both, exactly as in Barnwright. Keep the mat()
   calls and their order as they are. */

import { texFlat } from "../../engine/tex-names.js";
import { itemTools, openingFrame, hasDraw, drawOwn } from "./common.js";

const DRAWS = Object.freeze(["steel-6panel"]);

/* one six-panel steel door, after the renderItem preamble (common.js eachItem) */
function drawSteelDoor(plan, kit, it, c, mats) {
  var mT=mats.mT, mWht=mats.mWht;
  var op=openingFrame(plan, kit, it, c, mT);
  if(!op) return;
  var P=itemTools(kit), wrev=P.wrev, wbevel=P.wbevel, wdrum=P.wdrum, wdisc=P.wdisc, wslant=P.wslant;
  var mat=kit.mat, wq=kit.wq;
  var w=op.w, ch=op.ch, yb=op.yb, u=op.u;
  /* A SIX-PANEL STEEL DOOR, measured off Alan's photograph of one hanging in
     a real building. The rails and stiles were roughly right; the panels were
     not -- the bottom pair ran nearly as tall as the middle pair, where on a
     real door they are barely two thirds of it. And every panel was a flat
     rectangle with a lighter rectangle inside it, so the door read as a sheet
     with lines drawn on it. They are raised panels now, on real bevels. */
  /* THE DOOR IS IN A HOLE IN A WALL, and the panels have an edge you can
     catch a fingernail on. Both were flat before: the slab sat level with the
     casing so there was no frame to see down into, and each panel was a gentle
     ramp with nothing to cast a line. A real six-panel steel door steps DOWN
     off the stile first and then ramps back up to the field -- that little
     step is what draws the dark outline round every panel. */
  var dL=u-c.w/2, dR=u+c.w/2, DFACE=0.048, DCASE=0.12;
  wq(mat("dJamb",texFlat,"#F1F1ED",0.10,20),w,dL-0.10,yb,dR+0.10,yb+ch+0.10,0.030);   /* white jamb behind it */
  wq(mWht,w,dL,yb,dR,yb+ch,DFACE);
  wrev(mat("dRev",texFlat,"#EDEDE8",0.09,18),w,dL-0.02,yb,dR+0.02,yb+ch+0.03,DFACE,DCASE); /* the reveal */
  var mDsh6=mat("doorSh6",texFlat,"#cfcfca",0.06,12);
  wq(mDsh6,w,dL+0.02,yb+ch-0.26,dR-0.02,yb+ch-0.02,DFACE+0.004);                      /* head shadow on the slab */
  wq(mDsh6,w,dR-0.075,yb,dR-0.02,yb+ch-0.02,DFACE+0.004);                             /* and the gap down the latch edge */
  var mPanF=mat("panFace",texFlat,"#FBFBF8",0.13,26);
  var mPanB=mat("panBev",texFlat,"#F2F2EE",0.11,22);
  var mPanG=mat("panGroove",texFlat,"#DEDEDA",0.08,16);
  var FR=[[0.064,0.300],[0.369,0.758],[0.822,0.945]];                                  /* bottom, middle, top */
  var CW=c.w, xs6=[[dL+CW*0.170,dL+CW*0.435],[dL+CW*0.565,dL+CW*0.830]];
  xs6.forEach(function(cx6){
    FR.forEach(function(fr6){
      var p0=yb+ch*fr6[0], p1=yb+ch*fr6[1];
      var ins=Math.min(0.070,(p1-p0)*0.24,(cx6[1]-cx6[0])*0.24);
      var GRV=DFACE-0.016, FLD=DFACE+0.030;
      wrev(mPanG,w,cx6[0],p0,cx6[1],p1,GRV,DFACE);                                     /* the step down off the stile */
      wbevel(mPanB,w,cx6[0],p0,cx6[1],p1,ins,GRV,FLD);                                 /* and the ramp back up */
      wq(mPanF,w,cx6[0]+ins,p0+ins,cx6[1]-ins,p1-ins,FLD);
    });
  });
  /* satin knob on a rose, and the wood threshold under the slab */
  /* a knob you can see round: rose, then a neck, then the ball */
  var mGalv6=mat("galv",texFlat,"#cbd0d4",0.60,54);
  var mGalvD=mat("galvD",texFlat,"#9AA0A6",0.45,44);
  var ku6=dR-0.32, ky6=yb+ch*0.44;
  wdrum(mGalvD,w,ku6,ky6,0.135,DFACE,DFACE+0.028,0.13);                               /* rose, standing off the slab */
  wdisc(mGalvD,w,ku6,ky6,0.135,DFACE+0.028,0.13);
  wdrum(mGalv6,w,ku6,ky6,0.072,DFACE+0.028,DFACE+0.075,0.26);                         /* neck */
  wdrum(mGalv6,w,ku6,ky6,0.105,DFACE+0.075,DFACE+0.125,0.26);                         /* and the ball */
  wdisc(mGalv6,w,ku6,ky6,0.105,DFACE+0.125,0.26);
  var mThr=mat("thresh",texFlat,"#C8BFA6",0.20,26);
  wslant(mThr,w,dL-0.09,dR+0.09, yb+0.05,DFACE+0.010, yb-0.02,0.20);
}

const part = {
  id: "door-steel",
  name: "Six-panel steel door",
  stage: "doors",
  draws: DRAWS,
  realLife: "A 36 in in-swing steel entry door: a white six-panel slab set back in its frame, with raised panels, a satin knob on a rose and a wood threshold, trimmed with side casings and a head board.",
  appliesTo(plan) { return hasDraw(plan, DRAWS); },
  /* every steel door on the building on its own; the whole building draws them
     through parts/openings/index.js, in the order the items were added */
  build(plan, kit) { drawOwn(plan, kit, part); },
  drawItem: drawSteelDoor,
};
export default part;
