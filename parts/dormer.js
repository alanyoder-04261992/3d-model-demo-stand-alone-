/* THE DORMER: the shed dormer on the roof of a Dormer Shed. Node-safe.

   In real life a shed dormer is a box built up out of the main roof on the
   door side: a short upright front wall, sided like the building, standing
   just above the eave and resting on the main roof; two triangular side
   walls (cheeks) closing it to the roof; a single-slope steel roof that rises
   BACKWARD from the front wall and ties into the main roof just under the
   ridge cap. Its front wall carries a row of white-framed four-light windows
   (two, or three once the dormer is 8 ft or wider), trim boards at both
   corners and a trim band under the roof edge. The dormer roof overhangs the
   front wall and both sides and has a fascia round it and a soffit closing
   the front overhang.

   The size is the customer's pick: the design's dormer size (plan.state.dormer
   -- "6", "9" or "12" on the standard line, the id IS the width in feet along
   the building), clamped to the building's length less 2 ft. It is drawn only
   on a style with the "dormer" trait, and only when the design has one
   (plan.state.dormer is not "none"). It always sits on the +x (door) side.
   The main roof of a dormer style is a little steeper (construction
   roof.dormerRise, Barnwright's W*0.30 -- model/roof-shapes.js), which is
   what gives the dormer room to stand.

   Stage "dormer" (kind "finish"): shown in the Finished view; in
   Watch-it-build it lands after the roofing. Its framing is a separate NEW
   part (parts/dormer-frame.js).

   Ported from Barnwright's 3ddesign.html (pinned SHA-256 85c4b022...),
   dormer() lines 2978-3059 and its call in buildShed lines 4040-4041
   (`if(t.dormer && state.dormer!=="none") dormer(prof,W,L,+state.dormer);`),
   numbers byte for byte. Porting edits (docs/ARCHITECTURE.md, Porting rules),
   and nothing else:
   * rule 1: state -> plan.state, T() -> plan.t, STEP -> kit.STEP, RIB and y0
     from engine/constants.js, profileYat from model/roof-shapes.js (the same
     maths), the texture names from engine/tex-names.js; mat and pushQuad are
     the kit's; prof, W and L are plan.prof, plan.W, plan.L;
   * rule 2: the call's test is the style's dormer trait (appliesTo);
   * dormer() stays a FUNCTION DECLARATION (inside build), its body as
     Barnwright wrote it;
   * rule 7: kit.setStage("dormer") added.

   KEPT (look-defining, and harmless): the unused `slope` local; the corner
   boards are 0.29 ft on the +z side and 0.26 on the -z side; no screws on
   the dormer roof; the dormer asks for "body" with the painted-siding
   settings and sets its age to 4 -- the body bucket already exists (made by
   assemble first), so this only re-states age 4 on a painted building.

   MATERIALS, FIRST CALL WINS (parts/README.md): "body", "trim" and "roof"
   already exist (assemble, then parts/roofing.js, with the same settings);
   the dormer is the FIRST to ask for "glass" (glassM = 1) and "white"
   (#FBFBF8), so on a Dormer Shed those two buckets are made here, in that
   order, before any door or window. */

import { y0, RIB } from "../engine/constants.js";
import { texSiding, texTrim, texRoofMetal, texGlass, texFlat } from "../engine/tex-names.js";
import { profileYat } from "../model/roof-shapes.js";

export default {
  id: "dormer",
  name: "Dormer",
  stage: "dormer",
  realLife: "A shed dormer built up out of the roof on the door side: a sided front wall standing just above the eave with trim boards at its corners and a band under the roof edge, two or three white-framed four-light windows, triangular sided cheeks down to the main roof, and a ribbed steel roof rising back to tie in just under the ridge, with a fascia round its overhang and a soffit under the front.",
  appliesTo(plan) { return !!plan.t.dormer && plan.state.dormer !== "none"; },
  build(plan, kit) {
    var state=plan.state, STEP=kit.STEP;
    var mat=kit.mat, pushQuad=kit.pushQuad;
    kit.setStage("dormer");

    /* ---------- dormer (Dormer Shed) ---------- */
    function dormer(prof,W,L,dw){
      var mB=mat("body",texSiding,state.body,0.06,14,0.6);
      mB.age=4;
      var mT=mat("trim",texTrim,state.trim,0.10,20,0.12);
      var mR=mat("roof",texRoofMetal,state.roof,0.34,80,0.6);
      var mG=mat("glass",texGlass,[1,1,1],1.2,80); mG.glassM=1;
      var mWht=mat("white",texFlat,"#FBFBF8",0.12,22);
      var topY=y0+plan.t.wallH, R=profileYat(prof,0)-topY, half=W/2;
      var slope=R/half;
      var D=Math.min(dw, L-2), hw=D/2;
      /* vertical face set just above the eave, resting on the main roof */
      var xF=half-0.50;
      var yB=profileYat(prof,xF);
      /* dormer roof rises backward and ties in just under the ridge cap */
      var xI=0.12, yI=profileYat(prof,xI)+0.03;
      var faceH=Math.min(1.95, yI-0.35-yB); if(faceH<1.2)faceH=1.2;
      var yT=yB+faceH;
      var m=(yI-yT)/(xF-xI);
      var ovF=0.30, ovS=0.26;
      var yF=yT-ovF*m;
      /* face — body siding */
      pushQuad(mB,[xF,yB-0.08,hw],[xF,yB-0.08,-hw],[xF,yT,-hw],[xF,yT,hw],
        [hw/STEP,(yB-0.08)/2.6],[-hw/STEP,(yB-0.08)/2.6],[-hw/STEP,yT/2.6],[hw/STEP,yT/2.6]);
      /* cheeks — triangles of siding tucked onto the main roof */
      pushQuad(mB,[xF,yB-0.06,hw],[xF,yT,hw],[xI,yI,hw],[xI,yI-0.02,hw],
        [xF/STEP,yB/2.6],[xF/STEP,yT/2.6],[xI/STEP,yI/2.6],[xI/STEP,(yI-0.02)/2.6]);
      pushQuad(mB,[xI,yI-0.02,-hw],[xI,yI,-hw],[xF,yT,-hw],[xF,yB-0.06,-hw],
        [xI/STEP,(yI-0.02)/2.6],[xI/STEP,yI/2.6],[xF/STEP,yT/2.6],[xF/STEP,yB/2.6]);
      /* face trim — corner boards + band under the fascia */
      pushQuad(mT,[xF+0.03,yB-0.02,hw],[xF+0.03,yB-0.02,hw-0.29],[xF+0.03,yT,hw-0.29],[xF+0.03,yT,hw],
        [0,0],[0.33,0],[0.33,faceH/0.8],[0,faceH/0.8]);
      pushQuad(mT,[xF+0.03,yB-0.02,-hw+0.26],[xF+0.03,yB-0.02,-hw],[xF+0.03,yT,-hw],[xF+0.03,yT,-hw+0.26],
        [0,0],[0.33,0],[0.33,faceH/0.8],[0,faceH/0.8]);
      pushQuad(mT,[xF+0.03,yT-0.31,hw],[xF+0.03,yT-0.31,-hw],[xF+0.03,yT-0.02,-hw],[xF+0.03,yT-0.02,hw],
        [0,0],[D/0.8,0],[D/0.8,0.35],[0,0.35]);
      /* window band — white-framed 4-lite windows */
      var n=D>=8?3:2, gap2=0.55;
      var ww=Math.min(2.7,(D-1.5-(n-1)*gap2)/n);
      var wh2=Math.min(1.15,faceH-0.85), yw=yB+(faceH-0.28-wh2)*0.55;
      var band=n*ww+(n-1)*gap2;
      for(var i=0;i<n;i++){
        var zc=band/2-ww/2-i*(ww+gap2);
        pushQuad(mWht,[xF+0.05,yw-0.10,zc+ww/2+0.10],[xF+0.05,yw-0.10,zc-ww/2-0.10],[xF+0.05,yw+wh2+0.10,zc-ww/2-0.10],[xF+0.05,yw+wh2+0.10,zc+ww/2+0.10],
          [0,0],[1,0],[1,1],[0,1]);
        pushQuad(mG,[xF+0.075,yw,zc+ww/2],[xF+0.075,yw,zc-ww/2],[xF+0.075,yw+wh2,zc-ww/2],[xF+0.075,yw+wh2,zc+ww/2],
          [0.03,0.03],[0.97,0.03],[0.97,0.97],[0.03,0.97]);
        pushQuad(mWht,[xF+0.085,yw+0.02,zc+0.028],[xF+0.085,yw+0.02,zc-0.028],[xF+0.085,yw+wh2-0.02,zc-0.028],[xF+0.085,yw+wh2-0.02,zc+0.028],
          [0,0],[0.2,0],[0.2,1],[0,1]);
        pushQuad(mWht,[xF+0.085,yw+wh2/2-0.028,zc+ww/2-0.02],[xF+0.085,yw+wh2/2-0.028,zc-ww/2+0.02],[xF+0.085,yw+wh2/2+0.028,zc-ww/2+0.02],[xF+0.085,yw+wh2/2+0.028,zc+ww/2-0.02],
          [0,0],[1,0],[1,0.2],[0,0.2]);
      }
      /* dormer roof — metal, rising to the peak */
      pushQuad(mR,[xI,yI+0.02,hw+ovS],[xF+ovF,yF+0.02,hw+ovS],[xF+ovF,yF+0.02,-hw-ovS],[xI,yI+0.02,-hw-ovS],
        [(hw+ovS)/RIB,0],[(hw+ovS)/RIB,0.8],[(-hw-ovS)/RIB,0.8],[(-hw-ovS)/RIB,0]);
      /* dormer panel ribs, same profile as the main roof */
      (function(){
        var da=[xI,yI+0.02], db=[xF+ovF,yF+0.02];
        var dal=Math.hypot(db[0]-da[0],db[1]-da[1])||1;
        var dxr=(db[0]-da[0])/dal, dyr=(db[1]-da[1])/dal, nxr=-dyr, nyr=dxr;
        var RBH=0.055,RBB=0.05,RBT=0.018,UA=0.50,UB=0.64, s0=0.06, s1=dal-0.06;
        var rpt=function(sd,off,dz){ return [da[0]+dxr*sd+nxr*off, da[1]+dyr*sd+nyr*off, dz]; };
        for(var zc=Math.ceil((-hw-ovS+0.08)/RIB)*RIB; zc<=hw+ovS-0.08; zc+=RIB){
          pushQuad(mR, rpt(s0,0,zc+RBB),rpt(s1,0,zc+RBB),rpt(s1,RBH,zc+RBT),rpt(s0,RBH,zc+RBT),
            [UA,s0/3],[UA,s1/3],[UB,s1/3],[UB,s0/3]);
          pushQuad(mR, rpt(s0,RBH,zc+RBT),rpt(s1,RBH,zc+RBT),rpt(s1,RBH,zc-RBT),rpt(s0,RBH,zc-RBT),
            [UA,s0/3],[UA,s1/3],[UB,s1/3],[UB,s0/3]);
          pushQuad(mR, rpt(s0,RBH,zc-RBT),rpt(s1,RBH,zc-RBT),rpt(s1,0,zc-RBB),rpt(s0,0,zc-RBB),
            [UA,s0/3],[UA,s1/3],[UB,s1/3],[UB,s0/3]);
        }
      })();
      /* fascia — front and both sides */
      pushQuad(mT,[xF+ovF,yF-0.15,hw+ovS],[xF+ovF,yF-0.15,-hw-ovS],[xF+ovF,yF+0.03,-hw-ovS],[xF+ovF,yF+0.03,hw+ovS],
        [0,0],[(D+2*ovS)/0.8,0],[(D+2*ovS)/0.8,0.22],[0,0.22]);
      pushQuad(mT,[xF+ovF,yF-0.15,hw+ovS],[xF+ovF,yF+0.03,hw+ovS],[xI,yI+0.04,hw+ovS],[xI,yI-0.05,hw+ovS],
        [0,0],[0,0.22],[(xF-xI)/0.8,0.22],[(xF-xI)/0.8,0]);
      pushQuad(mT,[xI,yI-0.05,-hw-ovS],[xI,yI+0.04,-hw-ovS],[xF+ovF,yF+0.03,-hw-ovS],[xF+ovF,yF-0.15,-hw-ovS],
        [(xF-xI)/0.8,0],[(xF-xI)/0.8,0.22],[0,0.22],[0,0]);
      /* soffit closing the front overhang */
      pushQuad(mT,[xF,yT-0.02,hw+ovS],[xF+ovF,yF-0.15,hw+ovS],[xF+ovF,yF-0.15,-hw-ovS],[xF,yT-0.02,-hw-ovS],
        [0,0],[0.4,0],[0.4,(D+2*ovS)/0.8],[0,(D+2*ovS)/0.8]);
    }

    /* dormer -- buildShed: if(t.dormer && state.dormer!=="none") dormer(prof,W,L,+state.dormer); */
    dormer(plan.prof,plan.W,plan.L,+state.dormer);
  },
};
