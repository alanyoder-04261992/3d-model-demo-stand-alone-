/* THE GABLE VENT: a louvred vent high in each gable end. Node-safe.

   In real life a louvred vent is set into the siding under the ridge at each
   end, so hot air can leave the roof space. The drawing makes it a frame
   (the siding colour at 0.82) with five louvre slats (the siding colour at
   0.45) standing a little proud of the siding:
   * under the ridge on a gable, gambrel or saltbox end, centred 0.92 ft below
     the ridge, 1.12 x 0.76 ft -- only when the ridge is more than 1.2 ft
     above the wall top, and never on the Standard Barn (style trait
     "gableVent": false);
   * on a lean-to, 0.9 ft in from the high -x side and smaller (0.84 x 0.52);
   * on a single slope, 0.9 ft in from the high +x side.

   Stage "gable-end".

   Ported from Barnwright's 3ddesign.html (pinned SHA-256 0bdcf663...),
   buildShed's gable-ends loop: the ridge search on line 3980 and the vent,
   lines 4002-4014, numbers byte for byte. Barnwright draws the fill, band and
   vent of F, then of B, in one loop; the three parts in turn give each
   material the same triangles in the same order, and the "vent" and "ventD"
   materials are first made here, at F, as in Barnwright. Porting edits
   (docs/ARCHITECTURE.md, Porting rules):
   * state.type!=="SB" -> the style trait (plan.t.gableVent !== false); T() ->
     plan.t, state -> plan.state, prof -> plan.prof (rules 1, 2);
   * rule 4: the lean-to's W*0.17 and the single slope's W*0.28 are the roof's
     rise, read from the construction setting the roof is drawn from
     (defaults {"w": 0.17} and {"w": 0.28}, bit for bit the same);
   * the kit's mat gq2 bound to Barnwright's names; setStage added (rule 7). */

import { texFlat } from "../engine/tex-names.js";
import { tintShade } from "../engine/math.js";
import { roofShape, lengthOf } from "../model/roof-shapes.js";

/* Where the vent goes and whether there is one: {rx, ry, show}. rx, ry is the
   ridge point the vent hangs under (the highest inner profile point; on a
   lean-to or single slope a point 0.9 ft in from the high side).
   On a lean-to or single slope the vent hangs a FIXED distance under the
   high side, not under the sloping roof line, so it fits only near the
   default rise: a lean-to steeper than about 0.21 x the width has its top
   corner cut by the roof, and a rise under 0.80 ft (single slope 1.56 ft)
   hangs it below the wall top. See the part-gable-vent skill. */
export function ventSpot(plan){
  var W=plan.W, t=plan.t, topY=plan.topY, prof=plan.prof;
  var rx=0,ry=-1;for(var pv=1;pv<prof.length-1;pv++){if(prof[pv][1]>ry){ry=prof[pv][1];rx=prof[pv][0];}}
  var rise=(t.roof==="lean"||t.roof==="slope")? lengthOf(roofShape(t, plan.construction).rise, W) : 0;
  if(t.roof==="lean"){ rx=-W/2+0.9; ry=topY+rise-0.20; }
  if(t.roof==="slope"){ rx=W/2-0.9; ry=topY+rise-0.26; }
  var show=(ry-topY>1.2 && t.gableVent!==false) || t.roof==="lean" || t.roof==="slope";
  return { rx: rx, ry: ry, show: show };
}

export default {
  id: "gable-vent",
  name: "Gable vent",
  stage: "gable-end",
  realLife: "A louvred vent set into the siding high in each gable end, under the ridge (near the high side on a lean-to or single slope), to let hot air out of the roof space.",
  appliesTo(plan) { return ventSpot(plan).show; },
  build(plan, kit) {
    var W=plan.W, L=plan.L, t=plan.t, state=plan.state;
    var mat=kit.mat, gq2=kit.gq2;
    kit.setStage("gable-end");
    ["F","B"].forEach(function(k){
      var sgn=k==="F"?1:-1, gz=k==="F"?L/2:-L/2;
      var v=ventSpot(plan), rx=v.rx, ry=v.ry;
      if(v.show){
        var mV=mat("vent",texFlat,tintShade(state.body,0.82),0.05,12);
        var mVd=mat("ventD",texFlat,tintShade(state.body,0.45),0.05,12);
        var vy=(t.roof==="lean")? ry-0.34 : ry-0.92, vw=(t.roof==="lean")?0.42:0.56, vh=(t.roof==="lean")?0.26:0.38;
        gq2(mV,[[rx-vw,vy-vh],[rx+vw,vy-vh],[rx+vw,vy+vh],[rx-vw,vy+vh]],gz,sgn,0.03);
        for(var vi=0;vi<5;vi++){
          var sy=vy-vh+0.12+vi*((vh*2-0.24)/4);
          gq2(mVd,[[rx-vw+0.09,sy-0.038],[rx+vw-0.09,sy-0.038],[rx+vw-0.09,sy+0.038],[rx-vw+0.09,sy+0.038]],gz,sgn,0.045);
        }
      }
    });
  },
};
