/* Measured doorway lesson. Opening width, king-stud cut and header option
   are independent inputs; stock size and wall height remain actual values.
   Bottom-plate portions are framing context, not a learned threshold cut. */
import {deepFreeze} from "./company.js";
import {doorwayMembers} from "../parts/doorway-frame.js";
import {prismMember,drawMembers} from "../parts/floor-frame.js";
import {windowDetailRecord} from "./window-header-study.js";
import {createBuild,makeKit} from "../engine/buckets.js";
import {openingStudLayout} from "./opening-studs.js";

export function doorwayStudyPlan(plan,{widthIn,kingCutIn,headerMode="loft"}={}) {
  const raw=plan.construction?.doorwayLesson,wall=plan.wallStudy;
  if(!raw || wall?.wall!=="end")throw new Error("The doorway detail needs its measured end wall and shop settings.");
  if(raw.kingStudRole!=="under-header" || raw.kingStudSeat!=="bottom-plate-top"
    || raw.flatHeader!=="two-stacked" || raw.toPlate!=="no-separate-header"
    || raw.loftHeader!=="same-as-loft-window" || raw.ledgeSide!=="outside")
    throw new Error("Use the learned king-stud seat and header arrangements.");
  const {thicknessIn:t,depthIn:d,bearingEachEndIn:b}=raw;
  if(![widthIn,t,d,b].every(v=>Number.isFinite(v)&&v>0) || Math.abs(b-t)>1e-8
    || Math.abs(t-wall.stud.widthIn)>1e-8 || Math.abs(d-wall.stud.depthIn)>1e-8 || d<=2*t)
    throw new Error("Use matching actual stock and full-width bearing on each king stud.");
  if(!["loft","flat","to-plate"].includes(headerMode))throw new Error("Choose a learned header option.");
  if(widthIn+4*t>wall.frameRange.lengthFt*12+1e-8)
    throw new Error("The opening and both stud pairs must fit inside the wall.");
  const availableIn=(wall.studTopYFt-wall.bottomPlateTopYFt)*12;
  if(headerMode==="to-plate")kingCutIn=availableIn;
  if(!Number.isFinite(kingCutIn)||kingCutIn<=0)throw new Error("Use a positive king-stud cut length.");
  const headerHeightIn=headerMode==="loft"?d+t:headerMode==="flat"?2*t:0;
  if(kingCutIn+headerHeightIn>availableIn+1e-8)
    throw new Error("That king-stud cut and header are too tall for this wall. Select another learned option or reduce the cut.");
  const copy=structuredClone(plan),center=(wall.floorBounds.x0Ft+wall.floorBounds.x1Ft)/2;
  copy.doorwayStudy={nominal:raw.nominal,widthIn,kingCutIn,headerMode,headerHeightIn,
    headerCutIn:headerMode==="to-plate"?null:widthIn+2*b,bearingEachEndIn:b,
    x0Ft:center-widthIn/24,x1Ft:center+widthIn/24,outsideZFt:wall.floorBounds.z0Ft,
    thicknessFt:t/12,depthFt:d/12,ledgeFt:(d-2*t)/12,
    studBottomYFt:wall.bottomPlateTopYFt,studTopYFt:wall.studTopYFt,
    headerBottomYFt:wall.bottomPlateTopYFt+kingCutIn/12,
    headerTopYFt:wall.bottomPlateTopYFt+(kingCutIn+headerHeightIn)/12,
    status:{width:"illustrative-input",heightDatum:"bottom-plate-top",seat:"confirmed",
      bearing:"confirmed",headerOption:"builder-selected",thresholdCut:"unconfirmed",
      aboveHeader:raw.studsAboveHeader===true?"confirmed":"unconfirmed",aboveHeaderStudLayout:"provisional"}};
  const s=copy.doorwayStudy;
  s.aboveHeaderStuds=raw.studsAboveHeader===true && wall.studTopYFt-s.headerTopYFt>1e-8
    ?openingStudLayout(plan,s.x0Ft-s.thicknessFt,s.x1Ft+s.thicknessFt):[];
  if(raw.studsAboveHeader===true && wall.studTopYFt-s.headerTopYFt>1e-8 && !s.aboveHeaderStuds.length)
    throw new Error("This doorway detail misses the wall's stud marks. Its upper-stud layout needs a separate placement choice.");
  return deepFreeze(copy);
}

export function doorwayMeasurements(plan) {
  const s=plan.doorwayStudy;
  if(!s)return null;
  const wall=plan.wallStudy,members=doorwayMembers(plan).map(windowDetailRecord);
  const x0=s.x0Ft-2*s.thicknessFt,x1=s.x1Ft+2*s.thicknessFt;
  const plateMembers=[];
  for(const [kind,y0,y1,name] of [
    ["bottom-plate",wall.baseYFt,wall.bottomPlateTopYFt,"Bottom plate · framing portion"],
    ["top-plate",wall.studTopYFt,wall.topPlateTopYFt,"Top plate · portion shown"],
    ["upper-plate",wall.topPlateTopYFt,wall.topYFt,"Upper plate · portion shown"]]) {
    const center=(wall.floorBounds.x0Ft+wall.floorBounds.x1Ft)/2;
    const left=kind==="upper-plate"?Math.max(x0,center+wall.upperPlateRange.u0):x0;
    const right=kind==="upper-plate"?Math.min(x1,center+wall.upperPlateRange.u1):x1;
    const member=prismMember(kind,"lumber",[[left,y0],[right,y0],[right,y1],[left,y1]],
      [0,0,s.outsideZFt],[1,0,0],[0,1,0],[0,0,1],wall.plates.depthFt,
      {name,size:wall.plates.nominal,displayContext:true});
    member.stage="wall-frame";plateMembers.push(windowDetailRecord(member));
  }
  return {study:s,members:[...members,...plateMembers],frameMembers:members,plateMembers,
    kingMembers:members.filter(r=>r.kind==="king-stud"),studMembers:members.filter(r=>r.kind==="door-stud"),
    headerMembers:members.filter(r=>r.kind.startsWith("door-header")),
    aboveStudMembers:members.filter(r=>r.kind==="door-above-stud"),
    headerBottomAboveFloorIn:(s.headerBottomYFt-wall.baseYFt)*12,
    gapAboveHeaderIn:(wall.studTopYFt-s.headerTopYFt)*12};
}

export function doorwayDrawing(plan,measurements=doorwayMeasurements(plan),{plates=true}={}) {
  const build=createBuild({sel:null}),kit=makeKit(build,{STEP:plan.STEP});
  kit.part("doorway-frame",()=>drawMembers(kit,(plates?measurements.members:measurements.frameMembers).map(r=>r.member),"wall-frame"));
  return build;
}
