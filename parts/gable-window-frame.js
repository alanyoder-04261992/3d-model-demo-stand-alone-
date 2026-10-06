/* Alan's gable window box: the gable studs move to the opening's sides;
   horizontal 2x4s form its top and bottom. All 3.5-inch faces point outward.
   These two pieces fit between the full-height side studs (preview joint).
   Clear opening dimensions belong to the selected window, not the shed size.
   A LESSON part (`lesson`, parts/README.md): only the truss lesson with a
   gable window builds the windowOpening it needs, so no building in the
   designer has one. */
import { prismMember, drawMembers } from "./floor-frame.js";

export function gableWindowFrameMembers(plan) {
  const study = plan.trussStudy, opening = study?.windowOpening;
  if (opening?.kind !== "window") return [];
  const { x0In, x1In, bottomIn, topIn, faceIn, thicknessIn } = opening;
  return [["bottom",bottomIn-faceIn,bottomIn],["top",topIn,topIn+faceIn]].map(([side,y0,y1]) => {
    const item = prismMember("gable-window-horizontal", "lumber",
      [[x0In,y0],[x1In,y0],[x1In,y1],[x0In,y1]].map(p=>p.map(v=>v/12)),
      [study.centerXFt,study.baseYFt,study.boardFrontZFt-thicknessIn/12],
      [1,0,0],[0,1,0],[0,0,1],thicknessIn/12,
      { wall:study.end,lesson:true,preview:true,name:side === "top" ? "Window box top 2x4" : "Window box bottom 2x4",
        side,size:study.studs.nominal,orientation:"broad-face-outward",joint:opening.joint,
        grainEdgeIn:[[x0In,y0],[x1In,y0]],faceWidthFt:faceIn/12 });
    item.stage="roof-frame";return item;
  });
}

export default {
  id:"gable-window-frame",name:"Gable window box",stage:"roof-frame",lesson:"learn.html?step=truss&window=1",
  realLife:"Horizontal boards above and below the selected window opening, fitted between the moved gable studs with all wide faces outward.",
  appliesTo(plan) { return plan.trussStudy?.windowOpening?.kind === "window"; },
  members:gableWindowFrameMembers,
  build(plan,kit) { drawMembers(kit,gableWindowFrameMembers(plan),"roof-frame"); },
};
