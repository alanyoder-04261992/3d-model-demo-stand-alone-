/* Opt-in utility lesson. Explicit shop rules do not replace the loft lesson
   or alter the ordinary designer. Window placement follows the shop gap;
   plate cuts and explicitly selected gap-study overrides can vary. */
import {deepFreeze} from "./company.js";
import {floorStudyPlan} from "./floor-study.js";
import {wallStudyPlan} from "./wall-study.js";
import {openingStudLayout} from "./opening-studs.js";
import {utilityWindowMembers} from "../parts/utility-window-frame.js";
import {windowDetailRecord} from "./window-header-study.js";
import {prismMember,drawMembers} from "../parts/floor-frame.js";
import {createBuild,makeKit} from "../engine/buckets.js";

const positive=(value,name)=>{
  if(!Number.isFinite(value)||value<=0)throw new Error(`Use a positive ${name}.`);
  return value;
};

export function utilityWallStudyPlan(plan,{wall="end"}={}) {
  const raw=plan.construction?.utilityStudy;
  if(!raw || !plan.construction.wallStudy?.stud || !plan.construction.wallStudy?.plates)
    throw new Error("Utility framing needs its learned shop settings and base wall rules.");
  const copy=structuredClone(plan);
  copy.construction.wallStudy.stud.lengthIn=positive(raw.studLengthIn,"utility stud cut");
  copy.construction.wallStudy.status.studLength=raw.status.studLength;
  const result=structuredClone(wallStudyPlan(floorStudyPlan(copy),{wall}));
  result.wallStudy.style="utility";
  result.wallStudy.status.plateCountAndCorners=raw.status.plateCountAndCorners;
  return deepFreeze(result);
}

export function utilityWindowStudyPlan(plan,{lengthIn,gapAboveIn}={}) {
  const raw=plan.construction?.utilityStudy?.windowTopPlate,wall=plan.wallStudy;
  if(!raw || wall?.style!=="utility" || wall.wall!=="end")throw new Error("Use the measured utility end-wall lesson.");
  const t=positive(raw.thicknessIn,"top window plate thickness"),d=positive(raw.depthIn,"plate depth");
  positive(lengthIn,"plate cut");
  if(raw.gapDatum!=="top-plate-bottom-to-window-plate-top")throw new Error("Confirm the top window plate gap datum.");
  const gap=gapAboveIn===undefined?positive(raw.gapAboveIn,"shop window-plate gap"):gapAboveIn;
  if(!Number.isFinite(gap)||gap<0)throw new Error("Use a nonnegative gap above the top window plate.");
  if(raw.orientation!=="flat" || raw.studsAbove!==true || Math.abs(d-wall.stud.depthIn)>1e-8
    || Math.abs(t-wall.stud.widthIn)>1e-8 || lengthIn>wall.frameRange.lengthFt*12 || lengthIn<=t)
    throw new Error("The flat 2x4 top window plate must match and fit the utility wall.");
  const center=(wall.floorBounds.x0Ft+wall.floorBounds.x1Ft)/2;
  const x0Ft=center-lengthIn/24,x1Ft=center+lengthIn/24;
  const topYFt=wall.studTopYFt-gap/12,bottomYFt=topYFt-t/12;
  const openingTopAboveFloorIn=(bottomYFt-wall.baseYFt)*12;
  if(bottomYFt<=wall.bottomPlateTopYFt || topYFt>wall.studTopYFt+1e-8)
    throw new Error("That window-top height and plate must fit below the wall's top plate.");
  const gapIn=(wall.studTopYFt-topYFt)*12;
  const studs=gapIn>1e-8?openingStudLayout(plan,x0Ft,x1Ft):[];
  if(gapIn>1e-8 && !studs.length)throw new Error("Choose a plate cut that covers a wall stud mark.");
  const copy=structuredClone(plan);
  copy.utilityWindowStudy={nominal:raw.nominal,lengthIn,gapAboveIn:gap,gapDatum:raw.gapDatum,openingTopAboveFloorIn,x0Ft,x1Ft,bottomYFt,topYFt,
    studTopYFt:wall.studTopYFt,thicknessFt:t/12,depthFt:d/12,outsideZFt:wall.floorBounds.z0Ft,studs,
    status:{section:"confirmed",orientation:"confirmed",studsAbove:"confirmed",layout:"provisional-wall-layout",
      length:"illustrative-input",gap:gapAboveIn===undefined?"confirmed-shop-rule":"explicit-study-override",
      openingHeight:"derived-from-gap",sideSupports:"unconfirmed"}};
  return deepFreeze(copy);
}

export function utilityWindowMeasurements(plan) {
  const s=plan.utilityWindowStudy;
  if(!s)return null;
  const wall=plan.wallStudy,frame=utilityWindowMembers(plan).map(windowDetailRecord),plateMembers=[];
  for(const [kind,y0,y1,name] of [
    ["top-plate",wall.studTopYFt,wall.topPlateTopYFt,"Top plate · portion shown"],
    ["upper-plate",wall.topPlateTopYFt,wall.topYFt,"Upper plate · portion shown"]]) {
    const center=(wall.floorBounds.x0Ft+wall.floorBounds.x1Ft)/2;
    const x0=kind==="upper-plate"?Math.max(s.x0Ft,center+wall.upperPlateRange.u0):s.x0Ft;
    const x1=kind==="upper-plate"?Math.min(s.x1Ft,center+wall.upperPlateRange.u1):s.x1Ft;
    const member=prismMember(kind,"lumber",[[x0,y0],[x1,y0],[x1,y1],[x0,y1]],
      [0,0,s.outsideZFt],[1,0,0],[0,1,0],[0,0,1],s.depthFt,{name,size:s.nominal,displayContext:true});
    member.stage="wall-frame";plateMembers.push(windowDetailRecord(member));
  }
  return {study:s,members:[...frame,...plateMembers],frameMembers:frame,plate:frame[0],
    studMembers:frame.slice(1),plateMembers,studLengthIn:Math.max(0,(s.studTopYFt-s.topYFt)*12),
    topPlateBottomAboveFloorIn:(s.studTopYFt-wall.baseYFt)*12};
}

export function utilityWindowDrawing(plan,m=utilityWindowMeasurements(plan)) {
  const build=createBuild({sel:null}),kit=makeKit(build,{STEP:plan.STEP});
  kit.part("utility-window-frame",()=>drawMembers(kit,m.members.map(r=>r.member),"wall-frame"));
  return build;
}

export function utilityRoofPitch(plan,mode="standard",runIn=12) {
  const raw=plan.construction?.utilityStudy?.roof;
  if(raw?.shape!=="a-frame" || !["standard","steep"].includes(mode))throw new Error("Choose standard or steep A-frame roof pitch.");
  const {rise,run}=raw[mode];positive(rise,"pitch rise");positive(run,"horizontal pitch run");positive(runIn,"horizontal distance");
  return {name:raw.name,mode,rise,run,horizontalRunIn:runIn,riseIn:runIn*rise/run,
    angleDeg:Math.atan(rise/run)*180/Math.PI,slopeLengthIn:Math.hypot(runIn,runIn*rise/run),
    scope:"pitch-geometry-only"};
}

/* Sales width selects stock; actual wall width remains a separate input. */
export function utilityRoofRule(plan,nominalWidthFt=Number(String(plan.state?.size).split("x")[0])) {
  const raw=plan.construction?.utilityStudy?.roof;
  if(raw?.shape!=="a-frame")throw new Error("Use the learned utility A-frame roof settings.");
  positive(nominalWidthFt,"nominal building width");
  const threshold=positive(raw.stock?.thresholdNominalWidthFt,"roof stock threshold");
  const stock=raw.stock[nominalWidthFt<=threshold?"atOrBelow":"above"];
  positive(stock?.thicknessIn,"roof stock thickness");positive(stock?.depthIn,"roof stock depth");
  if(stock.thicknessIn>=stock.depthIn || raw.bottomCutDatum!=="side-wall-upper-plate-top")
    throw new Error("Confirm the utility roof stock and upper-plate bottom-cut datum.");
  return {name:raw.name,nominalWidthFt,stock:{...stock},
    overhangEachSideIn:positive(raw.overhangEachSideIn,"side overhang"),
    tipHeightIn:positive(raw.tipHeightIn,"truss end height"),bottomCutDatum:raw.bottomCutDatum};
}
