/* THE GABLE-END SIDING: the siding that fills each end of the building from
   the wall top up to the roof line. Node-safe.

   In real life the end walls (F, the front gable end, and B, the back) are
   sided right up into the peak: the same sheets as the walls, cut to the
   roof's slope. The walls part (parts/siding.js) draws each end wall up to the
   wall top; this part fills the triangle (or the barn's five-sided shape)
   above it, following the roof's cross-section:
   * a gable, gambrel or saltbox: the roof profile itself, flipped;
   * a lean-to: the triangle up to the high -x side;
   * a single slope: the triangle up to the high +x side;
   * the COTTAGE (saltbox) fills up to the roof LINE, not the bare
     wall-to-peak triangle: its roof deck runs past the wall top at the eave
     (the level-soffit eave, model/roof-shapes.js cottageEave), and it is set
     out 0.028 ft to the rake plane (see the owner's facts below).

   Stage "gable-end".

   Ported from Barnwright's 3ddesign.html (pinned SHA-256 0bdcf663...),
   buildShed's gable-ends loop, lines 3962-3979, numbers byte for byte.
   Barnwright does the fill, the band and the vent of F, then the same for B,
   in one loop; each goes into its own material, so this part (F then B), the
   band part and the vent part in turn give every material the same triangles
   in the same order (parts/index.js). Porting edits (docs/ARCHITECTURE.md,
   Porting rules):
   * state.type==="CS"||"MCS" -> the cottage trait (plan.t.cottage); T() ->
     plan.t, the profile is plan.prof, mB is core.mB (rules 1, 2);
   * rule 4: the lean-to's W*0.17 and the single slope's W*0.28 are the roof's
     rise, read from the construction setting the roof itself is drawn from
     (defaults {"w": 0.17} and {"w": 0.28}, bit for bit the same), and the
     cottage eave's 4 in / 8 in / 4 in fascia come from roof.cottageEave;
   * setStage added (rule 7). */

import { ROOF_TH, cottageEave, profileYat, roofShape, lengthOf } from "../model/roof-shapes.js";

/* The polygon that fills a gable end (the same for F and B; gq2 mirrors it
   for B) and how far out from the end wall it sits (gob). Exported so
   anything that must follow the same outline -- a gable framing view, a
   check -- reads it from here rather than working it out again. */
export function gableFill(plan){
  var W=plan.W, t=plan.t, topY=plan.topY, prof=plan.prof;
  var sh=roofShape(t, plan.construction);
  var gob=0;
  var pp=(t.roof==="lean")? [[W/2,topY],[-W/2,topY+lengthOf(sh.rise,W)],[-W/2,topY]] : (t.roof==="slope")? [[W/2,topY+lengthOf(sh.rise,W)],[-W/2,topY],[W/2,topY]] : prof.slice().reverse();
  /* A COTTAGE DECK RUNS ABOVE THE WALL TOP AT THE EAVE (cottageEave), so the
     gable end has to be filled up to the roof line and not to the bare
     wall-to-peak triangle -- otherwise a wedge of sky shows between the
     siding and the roof, widening to half a foot at the front corner. */
  if(t.cottage){
    var pr=cottageEave(prof.map(function(q){return q.slice();}),ROOF_TH,sh.cottageEave);
    pp=[[W/2,topY],[W/2,profileYat(pr,W/2)],prof[1].slice(),[-W/2,profileYat(pr,-W/2)],[-W/2,topY]];
    /* out to the rake plane, or the 3/8 in between the siding and the roof
       edge shows as a chip of sky at each eave corner. The band over it is
       proud by 0.10 anyway, so nothing steps. */
    gob=0.028;
  }
  return { pp: pp, gob: gob };
}

export default {
  id: "gable-siding",
  name: "Gable-end siding",
  stage: "gable-end",
  realLife: "The siding that fills each gable end from the wall top up to the roof line, cut to the roof's slope (on the cottage, up to the underside of the eave that runs past the wall top).",
  appliesTo() { return true; },
  build(plan, kit, core) {
    var L=plan.L, mB=core.mB;
    kit.setStage("gable-end");
    /* gable ends */
    ["F","B"].forEach(function(k){
      var sgn=k==="F"?1:-1, gz=k==="F"?L/2:-L/2;
      var g=gableFill(plan);
      kit.gq2(mB,g.pp,gz,sgn,g.gob,"sid");
    });
  },
};
