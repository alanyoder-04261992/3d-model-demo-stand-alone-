/* The next learned assembly below a lofted-wall window. Window dimensions
   are inputs; the existing wall supplies its layout and support datums.
   Side framing is deliberately unfinished, not guessed from a window size. */
import {deepFreeze} from "./company.js";
import {wallStudyFrame} from "../parts/wall-frame.js";
import {windowPlateMembers} from "../parts/window-plate.js";
import {prismMember,drawMembers} from "../parts/floor-frame.js";
import {windowDetailRecord} from "./window-header-study.js";
import {createBuild,makeKit} from "../engine/buckets.js";

export function windowPlateStudyPlan(plan,{lengthIn,clearHeightIn}={}) {
  const raw=plan.construction?.windowPlateLesson,header=plan.windowHeaderStudy,wall=plan.wallStudy;
  if(!raw || !header || wall?.wall!=="end")throw new Error("The window plate needs the measured lofted-wall header lesson.");
  if(raw.scope!=="lofted-wall" || raw.orientation!=="flat" || raw.studsBelow!==true
    || raw.studLayout!=="wall-stud-layout" || raw.studSeat!=="bottom-plate-top")
    throw new Error("Use the learned flat window plate with studs on the bottom plate and the wall layout.");
  if(![lengthIn,clearHeightIn,raw.thicknessIn,raw.depthIn].every(v=>Number.isFinite(v)&&v>0))
    throw new Error("Use positive, finite plate length and clear window height.");
  if(lengthIn>wall.frameRange.lengthFt*12 || lengthIn<=wall.stud.widthIn
    || Math.abs(raw.depthIn-wall.stud.depthIn)>1e-8)
    throw new Error("The sample window plate must fit the wall and match its framing depth.");
  const x0Ft=header.centerXFt-lengthIn/24,x1Ft=header.centerXFt+lengthIn/24;
  const topYFt=header.bottomYFt-clearHeightIn/12,bottomYFt=topYFt-raw.thicknessIn/12;
  if(bottomYFt<=wall.bottomPlateTopYFt+1e-8)throw new Error("That window height leaves no room for studs under its plate.");
  // Reuse the original layout rather than restarting it at a window edge.
  // Only full-width members bearing entirely under this sample are shown.
  const studs=wallStudyFrame(plan).members.filter(m=>m.kind==="stud" && m.meta.role!=="end")
    .filter(m=>m.meta.at.u0>=x0Ft-1e-8 && m.meta.at.u1<=x1Ft+1e-8)
    .map(m=>({x0Ft:m.meta.at.u0,x1Ft:m.meta.at.u1,role:m.meta.role,
      markFt:m.meta.markFt,markXFt:m.meta.markFt-wall.lengthFt/2,
      pairIndex:m.meta.pairIndex??null,pairReference:m.meta.pairReference??null}));
  if(!studs.length)throw new Error("That sample misses the wall's stud layout. Use a wider sample plate.");
  const copy=structuredClone(plan);
  copy.windowPlateStudy={nominal:raw.nominal,x0Ft,x1Ft,lengthIn,clearHeightIn,topYFt,bottomYFt,
    depthFt:raw.depthIn/12,thicknessFt:raw.thicknessIn/12,outsideZFt:header.outsideZFt,
    studBottomYFt:wall.bottomPlateTopYFt,studs,
    status:{seat:"confirmed",layout:"confirmed",layoutDatum:wall.status.layoutDatum,
      length:"illustrative",clearHeight:"illustrative",sideJoints:"unconfirmed"}};
  return deepFreeze(copy);
}

export function windowPlateMeasurements(plan) {
  const s=plan.windowPlateStudy;
  if(!s)return null;
  const members=windowPlateMembers(plan),wall=plan.wallStudy;
  const bottom=prismMember("bottom-plate","lumber",
    [[s.x0Ft,wall.baseYFt],[s.x1Ft,wall.baseYFt],[s.x1Ft,wall.bottomPlateTopYFt],[s.x0Ft,wall.bottomPlateTopYFt]],
    [0,0,s.outsideZFt],[1,0,0],[0,1,0],[0,0,1],s.depthFt,
    {name:"Bottom plate · portion shown",size:wall.plates.nominal,displayContext:true});
  bottom.stage="wall-frame";
  const records=members.map(windowDetailRecord),bottomPlate=windowDetailRecord(bottom);
  return {study:s,members:[...records,bottomPlate],plate:records[0],studMembers:records.slice(1),bottomPlate,
    studLengthIn:(s.bottomYFt-s.studBottomYFt)*12,
    plateTopAboveFloorIn:(s.topYFt-wall.baseYFt)*12,
    plateBottomAboveFloorIn:(s.bottomYFt-wall.baseYFt)*12};
}

export function windowFramingRecords(measurements,{view="plate",plates=true}={}) {
  if(!["plate","all","header","end"].includes(view))throw new Error("Choose a window-plate or header view.");
  const {header,windowPlate}=measurements,groups=[];
  if(view!=="plate")groups.push({part:"window-header",
    records:plates && view!=="end"?header.members:header.headerMembers});
  if(view==="plate" || view==="all")groups.push({part:"window-plate",
    records:plates?windowPlate.members:[windowPlate.plate,...windowPlate.studMembers]});
  return groups;
}

export function windowFramingDrawing(plan,measurements,options={}) {
  const build=createBuild({sel:null}),kit=makeKit(build,{STEP:plan.STEP});
  for(const group of windowFramingRecords(measurements,options))
    kit.part(group.part,()=>drawMembers(kit,group.records.map(r=>r.member),"wall-frame"));
  return build;
}
