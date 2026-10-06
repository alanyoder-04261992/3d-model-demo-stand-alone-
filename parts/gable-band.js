/* THE GABLE TRIM BAND: a trim board across each gable end. Node-safe.

   In real life it is a 1x4 painted the trim colour, nailed across the gable
   end over the siding: at the eave line on most buildings (just under the
   wall top), and at the loft line -- 40% of the way up to the ridge -- on a
   barn (gambrel) end that has no gable window. It is mitred into the rake
   boards at both ends, so the drawing stops it just short of the roof on each
   side. It stands 0.10 ft proud of the siding with a bottom, a top and two
   end returns, so it throws its own shadow line instead of reading as paint.

   Which ends have one is gableBandY (model/roof-shapes.js), shared with the
   door-height rule so a door's head casing always stops just under the band:
   none on a metal building (no wood trim), a lean-to, a single slope, the
   Garden Utility or the Standard Barn (the style trait "gableBand": false),
   the kennel's open front, or the front of a front or corner porch.

   THE COTTAGE SHED HAS ONE. Barnwright's note in gableBandY (2237-2244),
   kept word for word:
     "THE COTTAGE SHED HAS THE BAND, and this line used to say it did not
     ("the real cottage gable is clean"). Alan sent a photograph of a real one
     (Aug 2026) with the cream board running the full width of the gable at
     the eave line, mitred into the rake boards at both corners -- and Weather
     King's OWN illustration on our /building-cottage-shed page shows the same
     thing. Two independent sources against one comment somebody wrote.
     The METAL cottage is still clean: a metal building has no wood trim, and
     the t.metal test above already returns null for it."

   Stage "gable-end".

   Ported from Barnwright's 3ddesign.html (pinned SHA-256 85c4b022...),
   buildShed's gable-ends loop, lines 3980-4001 (bandRet and the end returns),
   numbers byte for byte; gableBandY itself is 2231-2252 (model/roof-shapes.js).
   Barnwright draws the fill, the band and the vent of F, then of B, in one
   loop; the three parts in turn give each material the same triangles in the
   same order. Porting edits (docs/ARCHITECTURE.md, Porting rules):
   gableBandY(k) -> gableBandY(k, plan); T() -> plan.t, prof -> plan.prof,
   mT is core.mT, the kit's gq2 pushQuad bound to Barnwright's names
   (rule 1); bandRet stays a function expression as Barnwright wrote it;
   setStage added (rule 7). */

import { gableBandY } from "../model/roof-shapes.js";

export default {
  id: "gable-band",
  name: "Gable trim band",
  stage: "gable-end",
  realLife: "A 1x4 trim board across each gable end at the eave line (at the loft line on a barn end with no gable window), standing proud of the siding and mitred into the rake boards at both ends.",
  appliesTo(plan) { return gableBandY("F", plan) != null || gableBandY("B", plan) != null; },
  build(plan, kit, core) {
    var W=plan.W, L=plan.L, topY=plan.topY, prof=plan.prof, mT=core.mT;
    var gq2=kit.gq2, pushQuad=kit.pushQuad;
    kit.setStage("gable-end");
    ["F","B"].forEach(function(k){
      var sgn=k==="F"?1:-1, gz=k==="F"?L/2:-L/2;
      var by=gableBandY(k, plan);
      if(by!=null){
        var rL2=prof[1][1]-topY, kx2=W/2-Math.abs(prof[1][0]);
        var ins=Math.max(0,(by+0.29-topY))/(rL2||1)*kx2, bx2=W/2-ins-0.04;
        /* a real 1x4 band: face proud of the siding, with bottom, top and end
           returns, so it throws its own shadow line instead of reading as paint */
        var bo=0.10, zi=gz+sgn*0.012, zo=gz+sgn*bo;
        gq2(mT,[[-bx2,by],[bx2,by],[bx2,by+0.29],[-bx2,by+0.29]],gz,sgn,bo);
        var bandRet=function(yv,z0,z1){
          var q=[[-bx2,yv,z0],[bx2,yv,z0],[bx2,yv,z1],[-bx2,yv,z1]];
          if(sgn<0){ q=[q[1],q[0],q[3],q[2]]; }
          pushQuad(mT,q[0],q[1],q[2],q[3],[0,0],[bx2*2/0.8,0],[bx2*2/0.8,bo/0.8],[0,bo/0.8]);
        };
        bandRet(by,zi,zo);        /* underside — catches the shade */
        bandRet(by+0.29,zo,zi);   /* top edge — catches the sun */
        [[bx2,1],[-bx2,-1]].forEach(function(ec){
          var q2=[[ec[0],by,zi],[ec[0],by+0.29,zi],[ec[0],by+0.29,zo],[ec[0],by,zo]];
          if(sgn*ec[1]<0){ q2=[q2[1],q2[0],q2[3],q2[2]]; }
          pushQuad(mT,q2[0],q2[1],q2[2],q2[3],[0,0],[0.3,0],[0.3,0.12],[0,0.12]);
        });
      }
    });
  },
};
