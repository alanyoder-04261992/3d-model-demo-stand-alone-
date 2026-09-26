/* THE CORNER TRIM: the trim boards up every outside corner of the building,
   and the hairline shadow they throw on the siding beside them. Node-safe.

   In real life each outside corner gets a pair of 1x4 trim boards nailed over
   the siding, one on each face, painted the trim colour. They stand proud of
   the siding and their outer edge is eased, so the corner catches the light
   in a thin bright line. The drawing makes the pair ONE five-sided post
   (0.2917 ft = 3 1/2 in square, the outer corner chamfered 0.05 ft) standing
   0.08 ft proud of both faces, with a flat cap on top, plus a soft shadow
   strip (the "cornerAO" decal) on the siding on both sides of it.

   * The posts run from just under the siding skirt (y0 - SKIRT + 0.02) --
     from the floor line y0 on the kennel, whose siding has no skirt -- up to
     the wall top. On a lean-to the two -x corners are taller by the lean's
     rise; on a single slope the two +x corners are taller by its rise.
   * No post where there is no outside corner: the front corners of a front or
     corner porch building, the right corners of a porch "R" (no style uses
     it; Barnwright's branch is kept), the notch-side corner of a side porch,
     and the kennel's open front.

   Stages: the posts are "trim"; the shadow strips are "shading" (contact
   shadows are only drawn in the finished view).

   Ported from Barnwright's 3ddesign.html (pinned SHA-256 0bdcf663...),
   buildShed lines 3906-3945 (cornerPost9, cornerAO9 and the corner loop),
   numbers byte for byte. Porting edits (docs/ARCHITECTURE.md, Porting rules):
   * state.type==="DK" -> the kennel trait (plan.t.kennel); T() -> plan.t,
     pSpan() -> plan.span, wallDefs() -> plan.ws, y0 and SKIRT from
     engine/constants.js, the texture name from engine/tex-names.js (rule 1, 2);
   * rule 4: the lean-to's W*0.17 and the single slope's W*0.28 extra post
     height are the roof's rise, read from the same construction setting the
     roof and the wall tops use (roof.shapes.lean.rise / slope.rise, whose
     defaults ARE {"w": 0.17} and {"w": 0.28}) -- so a company that changes
     the rise gets corner posts that still reach the wall top;
   * mT is core.mT; the kit's pushQuad pushTri DECAL quadUV wallPt are bound
     to Barnwright's names; setStage added (rule 7). */

import { y0, SKIRT } from "../engine/constants.js";
import { texAOcorner } from "../engine/tex-names.js";
import { roofShape, lengthOf } from "../model/roof-shapes.js";

/* The extra wall height on a lean-to's high (-x) side or a single slope's
   high (+x) side: the roof's rise. Barnwright's dims().W*0.17 / *0.28. */
function sideRise(plan){
  return lengthOf(roofShape(plan.t, plan.construction).rise, plan.W);
}

export default {
  id: "corner-trim",
  name: "Corner trim",
  stage: ["trim", "shading"],
  realLife: "A pair of trim boards up every outside corner, standing proud of the siding with the outer edge eased, painted the trim colour, and the hairline shadow they throw on the siding beside them.",
  appliesTo() { return true; },
  build(plan, kit, core) {
    var W=plan.W, L=plan.L, t=plan.t, ws=plan.ws;
    var mT=core.mT;
    var pushQuad=kit.pushQuad, pushTri=kit.pushTri, DECAL=kit.DECAL, quadUV=kit.quadUV, wallPt=kit.wallPt;
    /* corner trim: chamfered posts (eased outer edge catches the light the way a
       real 1x4 pair does) plus a soft thickness shadow on both adjoining walls */
    var cw=0.2917, co=cw/2-0.08;
    var cornerPost9=function(cx9,cz9,sx9,sz9,yb9,h9){
      kit.setStage("trim");
      var a9=cw/2, b9=0.05;
      var pts=[[cx9-sx9*a9,cz9+sz9*a9],[cx9+sx9*(a9-b9),cz9+sz9*a9],[cx9+sx9*a9,cz9+sz9*(a9-b9)],[cx9+sx9*a9,cz9-sz9*a9],[cx9-sx9*a9,cz9-sz9*a9]];
      if(sx9*sz9<0) pts.reverse();
      for(var i9=0;i9<pts.length;i9++){
        var A9=pts[i9],B9=pts[(i9+1)%pts.length];
        var ln9=Math.hypot(B9[0]-A9[0],B9[1]-A9[1]);
        pushQuad(mT,[A9[0],yb9,A9[1]],[B9[0],yb9,B9[1]],[B9[0],yb9+h9,B9[1]],[A9[0],yb9+h9,A9[1]],
          [0,0],[ln9/0.8,0],[ln9/0.8,h9/0.8],[0,h9/0.8]);
      }
      for(var j9=1;j9<pts.length-1;j9++)
        pushTri(mT,[pts[0][0],yb9+h9,pts[0][1]],[pts[j9][0],yb9+h9,pts[j9][1]],[pts[j9+1][0],yb9+h9,pts[j9+1][1]],
          [0,0],[0.42,0],[0.42,0.42]);
    };
    var cornerAO9=function(w9,uc9,hgt9){
      if(!w9) return;
      kit.setStage("shading");
      var mCA=DECAL("cornerAO",texAOcorner);
      var yA=(t.kennel? y0 : y0-SKIRT)+0.03;
      var e9=uc9-(uc9>0?1:-1)*0.17, f9=uc9-(uc9>0?1:-1)*0.44;
      var lo9=Math.min(e9,f9), hi9=Math.max(e9,f9), vLo=(lo9===e9)?0:1, vHi=1-vLo;
      quadUV(mCA,[wallPt(w9,lo9,yA,0.018),wallPt(w9,hi9,yA,0.018),wallPt(w9,hi9,y0+hgt9,0.018),wallPt(w9,lo9,y0+hgt9,0.018)],
        [[0.5,vLo],[0.5,vHi],[0.5,vHi],[0.5,vLo]]);
    };
    [[-W/2+co,-L/2+co],[W/2-co,-L/2+co],[-W/2+co,L/2-co],[W/2-co,L/2-co]].forEach(function(c2){
      if(t.porch==="F" && c2[1]>0) return;
      if(t.porch==="R" && c2[0]>0) return;
      if(t.porch==="C" && c2[1]>0) return;
      if(t.porch==="S" && !plan.span.mid && c2[0]>0 && (plan.span.f? c2[1]<0 : c2[1]>0)) return;
      if(t.kennel && c2[1]>0) return;
      var ch=t.wallH+((t.roof==="lean"&&c2[0]<0)?sideRise(plan):0)+((t.roof==="slope"&&c2[0]>0)?sideRise(plan):0);
      var sx=c2[0]>0?1:-1, sz=c2[1]>0?1:-1;
      var cyb=(t.kennel)? y0 : y0-SKIRT+0.02;
      cornerPost9(c2[0],c2[1],sx,sz,cyb,ch+(y0-cyb));
      var wz9=ws[sz>0?"F":"B"], wx9=ws[sx>0?"R":"L"];
      if(wz9) cornerAO9(wz9,(c2[0]-(wz9.cx||0))*wz9.ax[0],Math.min(ch,wz9.top-y0-0.03));
      if(wx9) cornerAO9(wx9,(c2[1]-(wx9.cx||0))*wx9.ax[2],Math.min(ch,wx9.top-y0-0.03));
    });
  },
};
