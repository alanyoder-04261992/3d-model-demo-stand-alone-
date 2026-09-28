/* THE ROOFING: the steel roof that goes on last, and the boards round its edges.
   Node-safe.

   On a real building the roof is sheets of painted, ribbed steel screwed down
   over the roof framing. This part draws, from the roof's cross-section
   (plan.prof, model/roof-shapes.js) run the length of the building:
   * the steel PANELS (top face 0.26 ft above the roof line), with a raised RIB
     every 9 in -- real geometry, lined up on the world's 9 in grid -- and a row
     of SCREWS about every two feet of slope, and the panel's UNDERSIDE;
   * on a barn (gambrel) roof, the upper sheet LAPPING over the lower one at
     each break, and the upper sheets reaching an inch and a half further past
     the gable end than the lower ones (RAKE_STEP);
   * the EAVE: on most styles the bare cut end of the sheet, scalloped at every
     rib, with the shadow of the overhang under it; on the cottage and the
     single slope a boxed eave with a trim FASCIA board, and on the cottage a
     level SOFFIT with a board closing each end of it;
   * the RIDGE CAP, only where the roof truly peaks, riding on the rib crests,
     with a closure at each gable end, its bent lip, the shade it casts and a
     screw at every rib;
   * the GABLE ENDS: a strip of trim under the roof metal's edge (1/3 trim
     showing) on gable-type roofs; on a gambrel one continuous mitred rake
     board with metal rake trim over two thirds of it.

   STAGES: the fascia, the soffit and the rake boards (the painted TRIM-colour
   boards) are stage "trim"; everything else -- the steel, its edges, the ridge
   cap, the screws, the shadows the steel throws -- is stage "roofing". The
   stage number changes no triangle; it only lets the Framing and
   Watch-it-build views show or hide the step.

   Ported from Barnwright's 3ddesign.html, profileRoof (lines 2562-2976) and
   its call in buildShed (lines 4035-4039), numbers byte for byte. Porting edits
   (docs/ARCHITECTURE.md, Porting rules), and nothing else:
   * rule 1: T() -> plan.t, state -> plan.state; mat/pushQuad/gq2 are the kit's
     (kit.mat, kit.pushQuad, kit.gq2); ROOF_TH and RAKE_STEP come from
     model/roof-shapes.js, RIB from engine/constants.js, tintShade from
     engine/math.js, cottageEave and profileYat from model/roof-shapes.js (the
     same maths as Barnwright's);
   * rule 2: state.type==="CS"||state.type==="MCS" -> the style's cottage trait
     (plan.t.cottage);
   * rule 4: the gable-end (rake) overhang Barnwright's buildShed passed in
     -- 0.03 for GU, CS, MCS; 0.12 for gambrel and lean-to roofs; 0.45 for the
     rest -- is roofShape(...).rakeOverhang (the style's rakeOverhang trait, else
     library/construction.json roof.shapes.<roof>.rakeOverhang, whose defaults
     are those numbers; tools/check-model-live.mjs proves they agree with the
     page). The gambrel still forces 0.10 inside profileRoof (a kept quirk).
     The eave overhangs (lean-to 0.333 over the door; single slope 1.15 and
     0.35; the rest 0.42 each side; all along the slope) are
     roof.shapes.<roof>.eaveOverhang, and the cottage's 4 in back / 8 in front
     level eave and its 4 in fascia are roof.cottageEave -- defaults
     Barnwright's numbers. On a lean-to Barnwright extends only the low (door)
     end; the high end is extended too only when a company sets a non-zero
     left overhang (the default 0 draws exactly as before);
   * rule 7: kit.setStage("roofing") / kit.setStage("trim") added.

   THE WINDING OF EVERY QUAD IS DELIBERATE. A triangle is only seen from the
   side it is wound anticlockwise from, so the front and back fascia quads,
   the two ridge-cap sides, the eaveEdge `rev` flag and the lap closures are
   mirror images of each other on purpose. Never "tidy" one into the other.

   FIRST CALL WINS for materials (parts/README.md): "roof" (also the dormer's),
   "trim" (made by assemble first), and "roofEdge" -- made early on a gambrel
   (mE) but inside the segment loop on the other roofs (mEg). The order of the
   mat() calls here is part of the look; keep it. */

import { texRoofMetal, texRoofCap, texFlat, texTrim } from "../engine/tex-names.js";
import { RIB } from "../engine/constants.js";
import { tintShade } from "../engine/math.js";
import { ROOF_TH, RAKE_STEP, roofShape, lengthOf, cottageEave, profileYat } from "../model/roof-shapes.js";

/* The gable-end (rake) overhang the roof is drawn with, in feet, before
   profileRoof's gambrel rule (a gambrel is always drawn at 0.10). Barnwright's
   buildShed: 0.03 for the Garden Utility and both cottages, 0.12 for gambrel
   and lean-to roofs, 0.45 for everything else. */
export function rakeOverhangOf(plan) {
  return roofShape(plan.t, plan.construction).rakeOverhang;
}

/* The eave overhangs in feet ALONG THE SLOPE at the -x (left) and +x (right)
   eaves (a cottage uses its level cottage eave instead). */
export function eaveOverhangs(plan) {
  var eo = roofShape(plan.t, plan.construction).eaveOverhang;
  return { left: lengthOf(eo.left, plan.W), right: lengthOf(eo.right, plan.W) };
}

/* ---------- roof ---------- */
function profileRoof(plan,kit,prof,L,ov,W){
  var th=ROOF_TH;
  /* the eave overhangs and the cottage eave are construction settings (library/construction.json
     roof.shapes.<roof>.eaveOverhang and roof.cottageEave); their defaults are the numbers
     Barnwright wrote here, so every building draws as before */
  var EO=eaveOverhangs(plan), CE=roofShape(plan.t,plan.construction).cottageEave;
  /* gambrel (barn/lofted) roofs: metal wraps a near-flush edge */
  var gam=(plan.t.roof==="gambrel");
  if(gam) ov=0.10;
  var zF=L/2+ov, zB=-L/2-ov;
  /* THE TOP ANGLE STICKS PAST. On a real gambrel the shallow upper panels are
     cut longer at the gable end than the steep lower ones, so the rake edge
     does not run as one straight line -- it steps out about an inch and a half
     where the two meet. Alan photographed the step. The model was giving every
     segment the same overhang, which is the one thing that reads as drawn
     rather than built when you look at a barn roof end-on. */
  /* A CAP GOES WHERE THE ROOF PEAKS, AND NOWHERE ELSE. Alan, with photographs
     of a lofted barn roof going on: "there is no ridge cap on secondary peaks,
     of the middle peak". A gambrel has three ridges to look at and only ONE of
     them is a ridge -- the two breaks halfway down are just a bend in the same
     sheet, ribs and all, and this was capping all three. A real peak has the
     roof rising into it on one side and falling away on the other; a break has
     it rising on both, or falling on both. */
  function isPeak(pi){
    if(pi<=0||pi>=P.length-1) return false;
    return (P[pi][1]-P[pi-1][1])>0.0005 && (P[pi+1][1]-P[pi][1])<-0.0005;
  }
  var RIBH=0.07, RBB=0.058, RBT=0.02;  /* how proud a rib stands off the pan, and its base/top half-widths */
  var STEPUP=gam?RAKE_STEP:0;
  var zFu=zF+STEPUP, zBu=zB-STEPUP;
  /* Painted steel is semi-gloss. At spec .15 / gloss 26 the sun smeared a wide
     dull sheen across the seams and a black roof came out looking like a hole
     with khaki dashes on it. Narrow and brighten the highlight and the standing
     seams pick out the way they do in the yard photos. */
  var mR=kit.mat("roof",texRoofMetal,plan.state.roof,0.34,80,0.6);
  var mRC=kit.mat("roofCap",texRoofCap,tintShade(plan.state.roof,0.92),0.38,92,0.35);
  var mSc=kit.mat("roofScrew",texFlat,tintShade(plan.state.roof,0.30),0.30,44);
  var mCapSh=kit.mat("capShade",texFlat,tintShade(plan.state.roof,0.76),0.10,20);
  /* lean and slp are wanted here, and `var` only hoists the NAME - the value is
     not set until the line further down, so this read saw undefined every time
     and every roof underside took the wrong branch. Declared where it is first
     used instead. */
  var lean=(plan.t.roof==="lean"), slp=(plan.t.roof==="slope");
  var mRU=kit.mat("roofU",texFlat, slp? tintShade(plan.state.trim,0.90) : tintShade(plan.state.roof,0.55), slp?0.06:0.03,10);
  var mT=kit.mat("trim",texTrim,plan.state.trim,0.10,20,0.12);
  var mE=gam? kit.mat("roofEdge",texFlat,tintShade(plan.state.roof,0.9),0.4,60) : mT;
  /* the eave strip is roof metal on every style whose eave is a cut edge, so it
     cannot come off mE -- on a gable roof mE is the white trim board */
  /* WHAT YOU SEE OF THE LIP IS ITS UNDERSIDE, not its face -- in his photo the
     cut edge is a good deal darker than the pan above it, and the rib tabs
     darker still. Painting it the same near-white as the rake made every tab
     a little bright square. */
  var mEdg=kit.mat("eaveEdge",texFlat,tintShade(plan.state.roof,0.62),0.18,34);
  var mEsh=kit.mat("eaveShade",texFlat,tintShade(plan.state.roof,0.22),0.04,10);
  /* the lap's own shadow is a different animal from the eave's -- a quarter inch
     of standoff, not four inches of overhang, so it is a hairline, not a band */
  var mLap=kit.mat("lapShade",texFlat,tintShade(plan.state.roof,0.68),0.06,14);
  var fx=gam?0:0.18;
  var P=prof.map(function(p){return p.slice();});
  function ext(i,j,d){var a=P[i],b=P[j];var dx=a[0]-b[0],dy=a[1]-b[1],l=Math.hypot(dx,dy)||1;a[0]+=dx/l*d;a[1]+=dy/l*d;}
  var cot=!!plan.t.cottage;
  /* WHICH EAVES ARE BARE METAL. Alan: "add it to every building" -- and his own
     gallery bears it out. On the utility sheds and the garages the sheet
     overhangs the wall with nothing across it at all, scalloped edge and a
     shadow under it, exactly like the barn; the cream board this used to draw
     there was invented. Two keep a board and are left alone: the single slope,
     whose photo shows a proper boxed eave with a soffit under it, and the
     cottage, whose level board he specified himself off a photo of a real one.
     Declared HERE, above the segment loop, because that loop reads it. */
  var cutE=!cot&&!slp;
  /* THE UPPER SHEET LAPS OVER THE LOWER ONE AT THE BREAK. Alan's photograph of
     a lofted barn roof shows it plainly: the shallow upper panel does not bend
     into the steep lower one, it stops a few inches down the lower slope with
     the same scalloped cut edge, and the lower sheet runs up underneath it.
     This drew the whole gambrel as one folded sheet, so the break was nothing
     but a change of angle -- no line, no shadow, nothing to say two sheets.
     LAPL is how far the tail runs past the bend; LAPO is one sheet's thickness,
     which is all that separates the two pans. */
  var LAPL=0.34, LAPO=0.024;
  function steepOf(i){ var a=P[i],b=P[i+1]; return Math.abs(b[1]-a[1])/(Math.abs(b[0]-a[0])+1e-6); }
  /* how far segment `sg` keeps its ribs back at vertex `vi`: the whole lap if
     it is the LOWER of the two there, because those ribs are under the tail and
     would otherwise stand straight through it */
  function lapBack(vi,sg){
    if(!gam||vi<=0||vi>=P.length-1||isPeak(vi)) return 0;
    return (steepOf(sg)>steepOf(sg===vi?vi-1:vi))? LAPL : 0;
  }
  if(lean){ ext(P.length-1,P.length-2,EO.right); if(EO.left) ext(0,1,EO.left); }  /* 4-inch eave over the door, flush at the back */
  else if(slp){ ext(P.length-1,P.length-2,EO.right); ext(0,1,EO.left); }  /* single slope: deep eave shading the tall door wall */
  /* THE COTTAGE OVERHANGS ARE NOT EQUAL (Alan, Aug 2026, with the two sides
     labelled on a screenshot of this very designer): 8 inches at the FRONT
     and 4 inches at the BACK, both measured horizontally, and nothing on the
     gable ends. It used to be 9 in all round, and 12 on one side once the
     roof became a saltbox -- too much, and in the wrong proportion.

     WHICH WALL IS WHICH is settled by where the doors go: Alan, in the same
     exchange, the doors and windows go on the front side. The standard
     loadout puts them on the R wall, which is +x, so FRONT is P[last] and
     BACK is P[0]. Do not try to read it off the screenshot instead -- the
     view can be rotated, and the two readings disagree. */
  /* THE OVERHANG IS LEVEL AND ENDS SQUARE (Alan, Aug 2026, circling both eaves
     on a screenshot: "they are straight 90 degree with the wall"). His photo of
     a real one shows it plainly at the corner -- the cream eave board runs out
     HORIZONTALLY past the wall and is cut off square, it does not carry on down
     at the roof pitch the way every other style here does. So the cottage gets
     an extra profile point at each eave, level with the wall top, instead of
     the endpoint being pushed along the slope. */
  /* THE ROOF LINE IS STRAIGHT FROM THE TIP TO THE PEAK, and the tip sits at the
     fascia over a level soffit -- see cottageEave, which both this and the
     gable end fill go through so they cannot draw different roofs. */
  else if(cot){ cottageEave(P,th,CE); }
  else { ext(0,1,EO.left); ext(P.length-1,P.length-2,EO.right); }
  for(var i=0;i<P.length-1;i++){
    var a=P[i],b=P[i+1], al=Math.hypot(b[0]-a[0],b[1]-a[1]);
    /* the two middle segments of a gambrel are the shallow upper slopes */
    var upSeg=(gam && i>0 && i<P.length-2);
    var zFi=upSeg?zFu:zF, zBi=upSeg?zBu:zB;
    /* top metal */
    kit.pushQuad(mR,[a[0],a[1]+th,zFi],[b[0],b[1]+th,zFi],[b[0],b[1]+th,zBi],[a[0],a[1]+th,zBi],
      [zFi/RIB,0],[zFi/RIB,al/3],[zBi/RIB,al/3],[zBi/RIB,0]);
    /* raised panel ribs every 9 inches — real geometry, so they catch sun and
       read from any distance. They run all the way to the ridge and finish
       UNDER the cap -- Alan's photograph of a real one shows the ribs going
       under and the cap riding on top of them, where this used to stop them
       half a foot short and lay the cap down in the flat. */
    (function(){
      var dxr=(b[0]-a[0])/al, dyr=(b[1]-a[1])/al, nxr=-dyr, nyr=dxr;
      var eA=(cutE&&i===0), eB=(cutE&&i===P.length-2); /* the two ends that are a cut edge, not a joint */
      /* AND NOTHING SETS THEM BACK AT A BREAK. Alan, with the stacked panels
         photographed: the ribs run straight over the bend. Half an inch either
         side left a dashed line of little gaps along it. */
      var bk0=lapBack(i,i), bk1=lapBack(i+1,i);
      var s0=eA?-0.02:(isPeak(i)?0.055:bk0), s1=al-(eB?-0.02:(isPeak(i+1)?0.055:bk1));
      if(s1<=s0+0.2) return;
      var RBH=RIBH,UA=0.50,UB=0.64;
      var rpt=function(sd,off,dz){ return [a[0]+dxr*sd+nxr*off, a[1]+dyr*sd+nyr*off+th, dz]; };
      for(var zc=Math.ceil((zBi+0.10)/RIB)*RIB; zc<=zFi-0.10; zc+=RIB){
        /* CLOSE THE END WHERE A LAP CUT IT SHORT. Everywhere else something
           covers the open end of a rib -- the ridge cap at a peak, the edge
           band at an eave -- but where the upper sheet's tail stops these,
           the hollow faces up the slope and reads as a dashed line of little
           dark notches across the roof. */
        if(bk0>0) kit.pushQuad(mR, rpt(s0,0,zc+RBB),rpt(s0,RBH,zc+RBT),rpt(s0,RBH,zc-RBT),rpt(s0,0,zc-RBB),
          [UA,0],[UB,0],[UB,0.05],[UA,0.05]);
        if(bk1>0) kit.pushQuad(mR, rpt(s1,0,zc-RBB),rpt(s1,RBH,zc-RBT),rpt(s1,RBH,zc+RBT),rpt(s1,0,zc+RBB),
          [UA,0],[UB,0],[UB,0.05],[UA,0.05]);
        kit.pushQuad(mR, rpt(s0,0,zc+RBB),rpt(s1,0,zc+RBB),rpt(s1,RBH,zc+RBT),rpt(s0,RBH,zc+RBT),
          [UA,s0/3],[UA,s1/3],[UB,s1/3],[UB,s0/3]);
        kit.pushQuad(mR, rpt(s0,RBH,zc+RBT),rpt(s1,RBH,zc+RBT),rpt(s1,RBH,zc-RBT),rpt(s0,RBH,zc-RBT),
          [UA,s0/3],[UA,s1/3],[UB,s1/3],[UB,s0/3]);
        kit.pushQuad(mR, rpt(s0,RBH,zc-RBT),rpt(s1,RBH,zc-RBT),rpt(s1,0,zc-RBB),rpt(s0,0,zc-RBB),
          [UA,s0/3],[UA,s1/3],[UB,s1/3],[UB,s0/3]);
      }
      /* SCREWS, one per pan, a row about every two feet of slope where the
         purlins are. Rows of dark screw heads down a steel roof is the single
         thing that says "steel roof" from across the yard, and Alan photographed
         them plainly -- this roof had none at all. */
      var SCW=0.038, nRow=Math.max(1,Math.round((s1-s0-0.9)/1.95));
      for(var rr=0;rr<=nRow;rr++){
        var sd=s0+0.45+(s1-s0-0.90)*(rr/nRow);
        for(var zs=Math.ceil((zBi+0.10)/RIB)*RIB; zs<=zFi-0.10-RIB*0.5; zs+=RIB){
          var zm=zs+RIB*0.5;
          kit.pushQuad(mSc, rpt(sd-SCW,0.005,zm+SCW),rpt(sd+SCW,0.005,zm+SCW),
                        rpt(sd+SCW,0.005,zm-SCW),rpt(sd-SCW,0.005,zm-SCW),
            [0,0],[0.075,0],[0.075,0.075],[0,0.075]);
        }
      }
    })();
    /* underside */
    kit.pushQuad(mRU,[a[0],a[1],zBi],[b[0],b[1],zBi],[b[0],b[1],zFi],[a[0],a[1],zFi],
      [0,0],[al/2,0],[al/2,(zFi-zBi)/2],[0,(zFi-zBi)/2]);
    /* fascia caps front/back: roof metal covers 2/3 of the end trim, 1/3 white reveal */
    if(gam){
      kit.pushQuad(mE,[a[0],a[1],zFi],[b[0],b[1],zFi],[b[0],b[1]+th,zFi],[a[0],a[1]+th,zFi],
        [0,0],[al/0.8,0],[al/0.8,th/0.8],[0,th/0.8]);
      kit.pushQuad(mE,[b[0],b[1],zBi],[a[0],a[1],zBi],[a[0],a[1]+th,zBi],[b[0],b[1]+th,zBi],
        [0,0],[al/0.8,0],[al/0.8,th/0.8],[0,th/0.8]);
    } else {
      var rv=0.15, mEg=kit.mat("roofEdge",texFlat,tintShade(plan.state.roof,0.9),0.4,60);
      kit.setStage("trim");       /* the 1/3 trim reveal is the rake board (stage trim) ... */
      kit.pushQuad(mT,[a[0],a[1]-fx,zFi],[b[0],b[1]-fx,zFi],[b[0],b[1]-fx+rv,zFi],[a[0],a[1]-fx+rv,zFi],
        [0,0],[al/0.8,0],[al/0.8,rv/0.8],[0,rv/0.8]);
      kit.setStage("roofing");    /* ... and the 2/3 of roof metal over it is roofing */
      kit.pushQuad(mEg,[a[0],a[1]-fx+rv,zFi],[b[0],b[1]-fx+rv,zFi],[b[0],b[1]+th,zFi],[a[0],a[1]+th,zFi],
        [0,0],[al/0.8,0],[al/0.8,(th+fx-rv)/0.8],[0,(th+fx-rv)/0.8]);
      kit.setStage("trim");
      kit.pushQuad(mT,[b[0],b[1]-fx,zBi],[a[0],a[1]-fx,zBi],[a[0],a[1]-fx+rv,zBi],[b[0],b[1]-fx+rv,zBi],
        [0,0],[al/0.8,0],[al/0.8,rv/0.8],[0,rv/0.8]);
      kit.setStage("roofing");
      kit.pushQuad(mEg,[b[0],b[1]-fx+rv,zBi],[a[0],a[1]-fx+rv,zBi],[a[0],a[1]+th,zBi],[b[0],b[1]+th,zBi],
        [0,0],[al/0.8,0],[al/0.8,(th+fx-rv)/0.8],[0,(th+fx-rv)/0.8]);
    }
  }
  /* eave edge strips at the low outer edges (metal on gambrel — no trim across the side wall) */
  /* THE FASCIA AT THE EAVE IS 4 INCHES DEEP on a cottage (Alan, Aug 2026, who
     drew the eave in section: down the slope, a 4 in drop, then 8 in of soffit
     back to the wall). The strip runs from e[1]-drop up to e[1]+th, so the
     drop is 4 inches LESS the roof slab. Everything else keeps the 0.24 that
     works out at about 6 inches. */
  /* ...and here is that tail. It belongs to the upper sheet, so it runs to the
     upper sheet's rake length (zFu/zBu) and carries the ribs for its own few
     inches, while the lower sheet's ribs have already stopped under it. It
     lifts off the lower pan over its length, from a hair at the bend to one
     sheet at the cut, which is what a bent sheet actually does. */
  if(gam){
    for(var bi=1;bi<P.length-1;bi++){
      if(isPeak(bi)) continue;
      (function(PV,A,B){
        var stA=Math.abs(A[1]-PV[1])/(Math.abs(A[0]-PV[0])+1e-6);
        var stB=Math.abs(B[1]-PV[1])/(Math.abs(B[0]-PV[0])+1e-6);
        var dn=(stA>stB)?A:B, sg=(stA>stB)?(bi-1):bi;
        var ux=dn[0]-PV[0], uy=dn[1]-PV[1], ul=Math.hypot(ux,uy)||1; ux/=ul; uy/=ul;
        var sa=P[sg], sb=P[sg+1], sl=Math.hypot(sb[0]-sa[0],sb[1]-sa[1])||1;
        var nx=-(sb[1]-sa[1])/sl, ny=(sb[0]-sa[0])/sl;
        var O0=0.004;
        /* a point s down the lower slope from the bend, `ex` proud of the tail */
        function LP(sd,ex,dz){
          var o=O0+(LAPO-O0)*(sd/LAPL)+ex;
          return [PV[0]+ux*sd+nx*o, PV[1]+th+uy*sd+ny*o, dz];
        }
        kit.pushQuad(mR,LP(LAPL,0,zFu),LP(0,0,zFu),LP(0,0,zBu),LP(LAPL,0,zBu),
          [zFu/RIB,0],[zFu/RIB,LAPL/3],[zBu/RIB,LAPL/3],[zBu/RIB,0]);
        var UA=0.50, UB=0.64;
        for(var zc=Math.ceil((zBu+0.10)/RIB)*RIB; zc<=zFu-0.10; zc+=RIB){
          kit.pushQuad(mR,LP(LAPL,0,zc+RBB),LP(0,0,zc+RBB),LP(0,RIBH,zc+RBT),LP(LAPL,RIBH,zc+RBT),
            [UA,0],[UA,LAPL/3],[UB,LAPL/3],[UB,0]);
          kit.pushQuad(mR,LP(LAPL,RIBH,zc+RBT),LP(0,RIBH,zc+RBT),LP(0,RIBH,zc-RBT),LP(LAPL,RIBH,zc-RBT),
            [UA,0],[UA,LAPL/3],[UB,LAPL/3],[UB,0]);
          kit.pushQuad(mR,LP(LAPL,RIBH,zc-RBT),LP(0,RIBH,zc-RBT),LP(0,0,zc-RBB),LP(LAPL,0,zc-RBB),
            [UA,0],[UA,LAPL/3],[UB,LAPL/3],[UB,0]);
        }
        /* the cut edge, carrying the corrugation the same way the eave does,
           and the shadow it throws on the sheet below */
        var pr=[[zBu,0]];
        for(var zr=Math.ceil((zBu+0.10)/RIB)*RIB; zr<=zFu-0.10; zr+=RIB)
          pr.push([zr-RBB,0],[zr-RBT,RIBH],[zr+RBT,RIBH],[zr+RBB,0]);
        pr.push([zFu,0]);
        for(var q=0;q<pr.length-1;q++){
          var Ax=pr[q], Bx=pr[q+1];
          if(Math.abs(Bx[0]-Ax[0])<1e-6) continue;
          /* down to the sheet below at every z, not a thin band following the
             ribs up -- a band would leave the open end of each rib to look
             into. Straight along the bottom, corrugated along the top, the
             same shape the eave edge takes. */
          kit.pushQuad(mEdg,LP(LAPL,-LAPO+0.002,Ax[0]),LP(LAPL,Ax[1],Ax[0]),
                        LP(LAPL,Bx[1],Bx[0]),LP(LAPL,-LAPO+0.002,Bx[0]),
            [Ax[0]/0.8,0],[Ax[0]/0.8,0.06],[Bx[0]/0.8,0.06],[Bx[0]/0.8,0]);
        }
        /* the shadow it throws on the sheet below -- which is corrugated, so
           the shadow has to ride over the ribs too. Laid flat in the pans it
           came out as a dashed line of dark ticks across the roof, with every
           rib crest bright between them. */
        function LB2(sd,off,dz){ return [PV[0]+ux*sd+nx*off, PV[1]+th+uy*sd+ny*off, dz]; }
        for(var q2=pr.length-1;q2>0;q2--){
          var Ay=pr[q2], By=pr[q2-1];
          if(Math.abs(Ay[0]-By[0])<1e-6) continue;
          kit.pushQuad(mLap,LB2(LAPL+0.06,Ay[1]+0.004,Ay[0]),LB2(LAPL,Ay[1]+0.004,Ay[0]),
                        LB2(LAPL,By[1]+0.004,By[0]),LB2(LAPL+0.06,By[1]+0.004,By[0]),
            [Ay[0]/0.8,0.1],[Ay[0]/0.8,0],[By[0]/0.8,0],[By[0]/0.8,0.1]);
        }
        /* close the tail at both gable ends, or you look into the quarter inch
           between the two sheets from anywhere off the end */
        function LB(sd,dz){ return [PV[0]+ux*sd, PV[1]+th+uy*sd, dz]; }
        var ab=(sg===bi)?1:-1, sA=(ab>0)?0:LAPL, sB=(ab>0)?LAPL:0;
        kit.pushQuad(mR,LB(sA,zFu),LB(sB,zFu),LP(sB,0,zFu),LP(sA,0,zFu),
          [0,0],[LAPL/0.8,0],[LAPL/0.8,0.04],[0,0.04]);
        kit.pushQuad(mR,LB(sB,zBu),LB(sA,zBu),LP(sA,0,zBu),LP(sB,0,zBu),
          [0,0],[LAPL/0.8,0],[LAPL/0.8,0.04],[0,0.04]);
      })(P[bi],P[bi-1],P[bi+1]);
    }
  }
  var e0=P[0], eN=P[P.length-1], drop=cutE?0.03:(cot? Math.max(0.02, CE.fasciaIn/12-th) : 0.24);
  /* THE CUT END OF A CORRUGATED SHEET IS CORRUGATED, so the bottom of the roof
     is not a straight line. Alan circled one on a photograph: between the ribs
     the edge runs straight, and at every rib it steps out a tab as deep as the
     rib is tall. This was one flat band the length of the building, which is
     the giveaway on any metal roof -- a real one scallops, and the scallop is
     what tells you the roof is a folded sheet and not a painted board. */
  var EDGH=Math.min(0.10,th*0.5);      /* how much of that band is the sheet itself */
  function eaveEdge(ex,ey,nx,ny,rev){
    var pr=[[zB,0]];
    for(var zc=Math.ceil((zB+0.10)/RIB)*RIB; zc<=zF-0.10; zc+=RIB)
      pr.push([zc-RBB,0],[zc-RBT,RIBH],[zc+RBT,RIBH],[zc+RBB,0]);
    pr.push([zF,0]);
    if(rev) pr.reverse();
    for(var q=0;q<pr.length-1;q++){
      var A=pr[q], B=pr[q+1];
      if(Math.abs(B[0]-A[0])<1e-6) continue;
      var ax=ex+nx*A[1], ay=ey+ny*A[1], bx=ex+nx*B[1], by=ey+ny*B[1];
      /* WHAT YOU SEE OF THE EDGE IS THIN. On the real one the sheet's own edge
         is a bright line about an inch deep and everything under it is the
         shadow of the overhang -- his photo has the wall going dark right at
         the metal. This band has to be as deep as the roof slab or the eave
         opens up, so the slab's face is painted as that shadow instead of as
         more roof, and only the top inch of it is metal. */
      kit.pushQuad(mEdg,[ax,ay+th-EDGH,A[0]],[ax,ay+th,A[0]],[bx,by+th,B[0]],[bx,by+th-EDGH,B[0]],
        [A[0]/0.8,0],[A[0]/0.8,0.12],[B[0]/0.8,0.12],[B[0]/0.8,0]);
      /* ...and only the SHEET steps out at a rib. What is under it is framing
         in shadow, which runs dead straight, so the skirt's bottom edge stays
         put and only its top follows the corrugation up. Move the whole band
         and the eave castellates like a battlement. */
      kit.pushQuad(mEsh,[ex,ey-drop,A[0]],[ax,ay+th-EDGH,A[0]],[bx,by+th-EDGH,B[0]],[ex,ey-drop,B[0]],
        [A[0]/0.8,0],[A[0]/0.8,0.4],[B[0]/0.8,0.4],[B[0]/0.8,0]);
    }
  }
  if(cutE){
    var g0=[P[1][0]-P[0][0],P[1][1]-P[0][1]], l0=Math.hypot(g0[0],g0[1])||1;
    var gN=[eN[0]-P[P.length-2][0],eN[1]-P[P.length-2][1]], lN=Math.hypot(gN[0],gN[1])||1;
    eaveEdge(e0[0]-0.02,e0[1],-g0[1]/l0,g0[0]/l0,true);
    eaveEdge(eN[0]+0.02,eN[1],-gN[1]/lN,gN[0]/lN,false);
  } else {
    kit.setStage("trim");         /* a boxed eave: mE is the trim fascia board (stage trim) */
    kit.pushQuad(mE,[e0[0]-0.02,e0[1]-drop,zF],[e0[0]-0.02,e0[1]+th,zF],[e0[0]-0.02,e0[1]+th,zB],[e0[0]-0.02,e0[1]-drop,zB],
      [0,0],[0,0.4],[(zF-zB)/0.8,0.4],[(zF-zB)/0.8,0]);
    kit.pushQuad(mE,[eN[0]+0.02,eN[1]-drop,zB],[eN[0]+0.02,eN[1]+th,zB],[eN[0]+0.02,eN[1]+th,zF],[eN[0]+0.02,eN[1]-drop,zF],
      [0,0],[0,0.4],[(zF-zB)/0.8,0.4],[(zF-zB)/0.8,0]);
    kit.setStage("roofing");
  }
  /* THE SOFFIT UNDER A COTTAGE EAVE -- level, from the back of the fascia to
     the wall, the second half of Alan's blue section. Without it the deck runs
     above the wall top with nothing closing the gap, which is a slot of sky
     along the whole eave from any low angle. */
  if(cot){
    kit.setStage("trim");         /* the level soffit and the boards closing its ends (stage trim) */
    var yS=prof[0][1];                                   /* the wall top, before cottageEave moved the tips */
    [[e0[0]-0.02,-W/2],[W/2,eN[0]+0.02]].forEach(function(sp){
      kit.pushQuad(mRU,[sp[0],yS,zB],[sp[1],yS,zB],[sp[1],yS,zF],[sp[0],yS,zF],
        [0,0],[(sp[1]-sp[0])/0.8,0],[(sp[1]-sp[0])/0.8,(zF-zB)/0.8],[0,(zF-zB)/0.8]);
      /* AND CLOSE BOTH ENDS OF IT. Roof over, soffit under, fascia outside,
         wall inside -- and open at the two gable ends, where a 3/4 view looks
         straight into it and sees sky. The real one has a board across there. */
      var yA=profileYat(P,sp[0]), yB2=profileYat(P,sp[1]);
      kit.pushQuad(mT,[sp[0],yS,zF],[sp[1],yS,zF],[sp[1],yB2,zF],[sp[0],yA,zF],
        [0,0],[(sp[1]-sp[0])/0.8,0],[(sp[1]-sp[0])/0.8,0.4],[0,0.4]);
      kit.pushQuad(mT,[sp[1],yS,zB],[sp[0],yS,zB],[sp[0],yA,zB],[sp[1],yB2,zB],
        [0,0],[(sp[1]-sp[0])/0.8,0],[(sp[1]-sp[0])/0.8,0.4],[0,0.4]);
    });
    kit.setStage("roofing");
  }
  /* the ridge cap hugs both slopes -- at the ridge, and only there */
  for(var pi=1;pi<P.length-1;pi++){
    if(!isPeak(pi)) continue;
    var PV=P[pi];
    /* THE CAP RIDES ON TOP OF THE RIBS. Alan circled it on a photograph: the
       ribs run up under the cap and the cap sits on their crests, so it stands
       off the flat of the panel and throws a line the length of the roof, with
       the rib gaps dark underneath it. It used to be laid down IN the flat, half
       an inch off the deck, which is why it read as a painted stripe. */
    var CAPY=th+RIBH+0.010, CAPW=0.52, CAPE=0.030;
    /* u across the cap (0 at the crown, 1 at the edge) and v along the ridge,
       so the roll marks run gable to gable the way they do on the real sheet. */
    var CVF=zFu/2.5, CVB=zBu/2.5;
    [[P[pi-1],true],[P[pi+1],false]].forEach(function(nb){
      var dx=nb[0][0]-PV[0], dy=nb[0][1]-PV[1], dl=Math.hypot(dx,dy)||1;
      var ux=dx/dl, uy=dy/dl;
      var ix=PV[0]+ux*CAPW, iy=PV[1]+uy*CAPW+CAPY, ry=PV[1]+CAPY;
      /* the shade the cap casts on the pan just below its edge */
      var sx0=PV[0]+ux*CAPW, sy0=PV[1]+uy*CAPW+th+0.002;
      var sx1=PV[0]+ux*(CAPW+0.085), sy1=PV[1]+uy*(CAPW+0.085)+th+0.002;
      /* AND IT IS SCREWED DOWN. A row of them either side, one at every rib,
         because that is where there is something solid under the cap to bite
         into -- the same reason the ribs run under it in the first place. */
      var CSD=CAPW-0.115, CSW=0.037, CSY=CAPY+0.004;
      var cs=[];
      for(var zc=Math.ceil((zBu+0.14)/RIB)*RIB; zc<=zFu-0.14; zc+=RIB){
        cs.push([[PV[0]+ux*(CSD-CSW),PV[1]+uy*(CSD-CSW)+CSY],
                 [PV[0]+ux*(CSD+CSW),PV[1]+uy*(CSD+CSW)+CSY], zc]);
      }
      /* CLOSE THE TWO ENDS, ALL THE WAY DOWN TO THE PAN. Standing the cap up
         on the rib crests opens a slot under it at the gable, where the ribs
         have already stopped -- his own gable-on test found eight pixels of
         daylight through the building there. A real one gets a closure across
         that end; so does this, from the cap down to the deck. */
      var pb=PV[1]+th, eb=PV[1]+uy*CAPW+th;
      if(nb[1]){
        kit.pushQuad(mRC,[ix,eb,zFu],[PV[0],pb,zFu],[PV[0],ry,zFu],[ix,iy,zFu],
          [0,0],[0.3,0],[0.3,0.06],[0,0.06]);
        kit.pushQuad(mRC,[PV[0],pb,zBu],[ix,eb,zBu],[ix,iy,zBu],[PV[0],ry,zBu],
          [0,0],[0.3,0],[0.3,0.06],[0,0.06]);
        kit.pushQuad(mRC,[ix,iy,zFu],[PV[0],ry,zFu],[PV[0],ry,zBu],[ix,iy,zBu],
          [1,CVF],[0,CVF],[0,CVB],[1,CVB]);
        kit.pushQuad(mRC,[ix,iy-CAPE,zFu],[ix,iy,zFu],[ix,iy,zBu],[ix,iy-CAPE,zBu],   /* its edge */
          [1,CVF],[0.86,CVF],[0.86,CVB],[1,CVB]);
        kit.pushQuad(mCapSh,[sx1,sy1,zFu],[sx0,sy0,zFu],[sx0,sy0,zBu],[sx1,sy1,zBu],
          [0,0],[0,0.2],[(zFu-zBu)/0.8,0.2],[(zFu-zBu)/0.8,0]);
        cs.forEach(function(q){
          kit.pushQuad(mSc,[q[1][0],q[1][1],q[2]+CSW],[q[0][0],q[0][1],q[2]+CSW],
                       [q[0][0],q[0][1],q[2]-CSW],[q[1][0],q[1][1],q[2]-CSW],
            [0,0],[0.075,0],[0.075,0.075],[0,0.075]);
        });
      } else {
        kit.pushQuad(mRC,[PV[0],pb,zFu],[ix,eb,zFu],[ix,iy,zFu],[PV[0],ry,zFu],
          [0,0],[0.3,0],[0.3,0.06],[0,0.06]);
        kit.pushQuad(mRC,[ix,eb,zBu],[PV[0],pb,zBu],[PV[0],ry,zBu],[ix,iy,zBu],
          [0,0],[0.3,0],[0.3,0.06],[0,0.06]);
        kit.pushQuad(mRC,[PV[0],ry,zFu],[ix,iy,zFu],[ix,iy,zBu],[PV[0],ry,zBu],
          [0,CVF],[1,CVF],[1,CVB],[0,CVB]);
        kit.pushQuad(mRC,[ix,iy,zFu],[ix,iy-CAPE,zFu],[ix,iy-CAPE,zBu],[ix,iy,zBu],
          [0.86,CVF],[1,CVF],[1,CVB],[0.86,CVB]);
        kit.pushQuad(mCapSh,[sx0,sy0,zFu],[sx1,sy1,zFu],[sx1,sy1,zBu],[sx0,sy0,zBu],
          [0,0],[0,0.2],[(zFu-zBu)/0.8,0.2],[(zFu-zBu)/0.8,0]);
        cs.forEach(function(q){
          kit.pushQuad(mSc,[q[0][0],q[0][1],q[2]+CSW],[q[1][0],q[1][1],q[2]+CSW],
                       [q[1][0],q[1][1],q[2]-CSW],[q[0][0],q[0][1],q[2]-CSW],
            [0,0],[0.075,0],[0.075,0.075],[0,0.075]);
        });
      }
    });
  }
  if(gam){
    /* one continuous mitered rake board + metal rake trim covering 2/3 of it */
    var MN=[];
    for(var mi=0;mi<P.length;mi++){
      var sx=0,sy=0;
      if(mi>0){var dA=[P[mi][0]-P[mi-1][0],P[mi][1]-P[mi-1][1]],lA=Math.hypot(dA[0],dA[1])||1;sx+=dA[1]/lA;sy+=-dA[0]/lA;}
      if(mi<P.length-1){var dB=[P[mi+1][0]-P[mi][0],P[mi+1][1]-P[mi][1]],lB=Math.hypot(dB[0],dB[1])||1;sx+=dB[1]/lB;sy+=-dB[0]/lB;}
      var sl=Math.hypot(sx,sy)||1; MN.push([sx/sl,sy/sl]);
    }
    [[L/2,1],[-L/2,-1]].forEach(function(fz){
      for(var si=0;si<P.length-1;si++){
        var A=P[si],B=P[si+1],mA=MN[si],mB=MN[si+1];
        kit.setStage("trim");       /* the mitred rake board (stage trim) */
        kit.gq2(mT,[[A[0]+mA[0]*0.29,A[1]+mA[1]*0.29],[B[0]+mB[0]*0.29,B[1]+mB[1]*0.29],[B[0],B[1]],[A[0],A[1]]],fz[0],fz[1],0.05);
        kit.setStage("roofing");    /* the metal rake trim over 2/3 of it (roofing) */
        kit.gq2(mE,[[A[0]+mA[0]*0.20,A[1]+mA[1]*0.20],[B[0]+mB[0]*0.20,B[1]+mB[1]*0.20],[B[0],B[1]],[A[0],A[1]]],fz[0],fz[1],0.14);
      }
    });
  }
}

export default {
  id: "roofing",
  name: "Roofing",
  stage: ["roofing", "trim"],
  realLife: "Painted steel roof panels with a raised rib every 9 in, screwed down in rows over the roof framing, a ridge cap along the peak where the roof has one, and painted trim boards at the edges: the rake boards on the gable ends and, on boxed eaves, the fascia and the soffit.",
  appliesTo() { return true; },
  build(plan, kit) {
    kit.setStage("roofing");
    /* roof */
    /* NO OVERHANG ON THE GABLE ENDS for a cottage (Alan, Aug 2026) -- 0.03 is the
     same nothing the Garden Utility uses, enough to keep the roof edge off the
     wall plane without reading as an overhang. It was 0.70, an 8 inch rake. */
    profileRoof(plan,kit,plan.prof,plan.L,rakeOverhangOf(plan),plan.W);
  },
};
