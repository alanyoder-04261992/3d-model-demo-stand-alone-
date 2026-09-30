/* Isolated loft-header detail, using the real wall's top-plate datum.
   A sample cut length illustrates the section; it is not a rough opening.
   Wall plate portions are display context, not changes to the wall cuts. */
import {deepFreeze} from "./company.js";
import {windowHeaderMembers} from "../parts/window-header.js";
import {prismMember,drawMembers} from "../parts/floor-frame.js";
import {createBuild,makeKit} from "../engine/buckets.js";

export function windowHeaderStudyPlan(plan,{lengthIn}={}) {
  const raw=plan.construction?.windowHeader;
  if(!raw || plan.wallStudy?.wall!=="end") throw new Error("The header detail needs its company settings and measured end wall.");
  const {thicknessIn,depthIn}=raw;
  if(![thicknessIn,depthIn,lengthIn].every(v=>Number.isFinite(v)&&v>0) || depthIn<=2*thicknessIn)
    throw new Error("Use positive header measurements with room for the outside ledge.");
  if(raw.scope!=="lofted-wall" || raw.plies!==2 || raw.base!=="flat-same-stock" || raw.ledgeSide!=="outside" || raw.topDatum!=="top-plate-underside")
    throw new Error("The loft header needs two touching edge boards on a flat board, outside ledge and top-plate underside datum.");
  const wall=plan.wallStudy;
  if(lengthIn>wall.frameRange.lengthFt*12 || lengthIn<=depthIn || Math.abs(depthIn-wall.plates.depthIn)>1e-8)
    throw new Error("Header length must fit the selected wall and stock must match its depth.");
  const copy=structuredClone(plan),heightIn=depthIn+thicknessIn;
  copy.windowHeaderStudy={nominal:raw.nominal,lengthIn,lengthFt:lengthIn/12,
    thicknessFt:thicknessIn/12,depthFt:depthIn/12,heightIn,ledgeFt:(depthIn-2*thicknessIn)/12,
    centerXFt:(wall.floorBounds.x0Ft+wall.floorBounds.x1Ft)/2,
    outsideZFt:wall.floorBounds.z0Ft,topYFt:wall.studTopYFt,bottomYFt:wall.studTopYFt-heightIn/12,
    lengthStatus:"illustrative-input",endAlignmentStatus:"provisional",scope:"isolated-header-detail"};
  return deepFreeze(copy);
}

export function windowDetailRecord(member) {
  const poly=member.poly,z0Ft=member.origin[2],z1Ft=z0Ft+member.t;
  const bounds={x0Ft:Math.min(...poly.map(p=>p[0])),x1Ft:Math.max(...poly.map(p=>p[0])),
    y0Ft:Math.min(...poly.map(p=>p[1])),y1Ft:Math.max(...poly.map(p=>p[1])),z0Ft,z1Ft};
  const center=[(bounds.x0Ft+bounds.x1Ft)/2,(bounds.y0Ft+bounds.y1Ft)/2,(z0Ft+z1Ft)/2];
  const vertical=member.meta.grainAxis==="vertical";
  return {member,kind:member.kind,poly,bounds,center,z0Ft,z1Ft,
    p0:vertical?[center[0],bounds.y0Ft,center[2]]:[bounds.x0Ft,center[1],center[2]],
    p1:vertical?[center[0],bounds.y1Ft,center[2]]:[bounds.x1Ft,center[1],center[2]],
    lengthFt:vertical?bounds.y1Ft-bounds.y0Ft:bounds.x1Ft-bounds.x0Ft,
    widthFt:vertical?bounds.x1Ft-bounds.x0Ft:bounds.y1Ft-bounds.y0Ft,depthFt:member.t,
    grainAxis:vertical?[0,1,0]:[1,0,0]};
}

export function windowHeaderMeasurements(plan) {
  const s=plan.windowHeaderStudy;
  if(!s) return null;
  const members=windowHeaderMembers(plan),wall=plan.wallStudy;
  // Use the header's displayed length for plate portions; real wall plates
  // retain their existing full cuts in wallStudyFrame and the wall lesson.
  const x0=s.centerXFt-s.lengthFt/2,x1=s.centerXFt+s.lengthFt/2;
  for(const [kind,y0,y1,name] of [
    ["top-plate",wall.studTopYFt,wall.topPlateTopYFt,"Top plate · portion shown"],
    ["upper-plate",wall.topPlateTopYFt,wall.topYFt,"Upper plate · portion shown"]]) {
    const item=prismMember(kind,"lumber",[[x0,y0],[x1,y0],[x1,y1],[x0,y1]],
      [0,0,s.outsideZFt],[1,0,0],[0,1,0],[0,0,1],wall.plates.depthFt,
      {name,size:wall.plates.nominal,displayContext:true});
    item.stage="wall-frame";members.push(item);
  }
  const records=members.map(windowDetailRecord);
  const bounds=Object.fromEntries(["x","y","z"].flatMap(a=>[
    [a+"0Ft",Math.min(...records.map(r=>r.bounds[a+"0Ft"]))],
    [a+"1Ft",Math.max(...records.map(r=>r.bounds[a+"1Ft"]))]]));
  return {study:s,members:records,headerMembers:records.slice(0,3),plateMembers:records.slice(3),bounds,
    heightIn:s.heightIn,ledgeIn:s.ledgeFt*12,headerBottomAboveFloorIn:(s.bottomYFt-wall.baseYFt)*12};
}

export function windowHeaderDrawing(plan,measurements=windowHeaderMeasurements(plan),{plates=true}={}) {
  const build=createBuild({sel:null}),kit=makeKit(build,{STEP:plan.STEP});
  const records=plates?measurements.members:measurements.headerMembers;
  kit.part("window-header",()=>drawMembers(kit,records.map(r=>r.member),"wall-frame"));
  return build;
}
