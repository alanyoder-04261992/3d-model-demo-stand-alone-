/* Wall and roof records for the same exact 3D and phone-picture meshes. */
import {utilityRoofStudyMembers} from "./utility-roof-study.js";
import {wallStudyMeasurements} from "./wall-measurements.js";
import {prismMember,drawMembers} from "../parts/floor-frame.js";
import {createBuild,makeKit} from "../engine/buckets.js";

function record(member) {
  const poly=member.poly,z0Ft=member.origin[2],z1Ft=z0Ft+member.t;
  const bounds={x0Ft:Math.min(...poly.map(p=>p[0])),x1Ft:Math.max(...poly.map(p=>p[0])),
    y0Ft:Math.min(...poly.map(p=>p[1])),y1Ft:Math.max(...poly.map(p=>p[1])),z0Ft,z1Ft};
  const center=[(bounds.x0Ft+bounds.x1Ft)/2,(bounds.y0Ft+bounds.y1Ft)/2,(z0Ft+z1Ft)/2];
  const edge=member.meta.grainEdge;
  const p0=edge?[...edge[0],center[2]]:[center[0],center[1],z0Ft];
  const p1=edge?[...edge[1],center[2]]:[center[0],center[1],z1Ft];
  const lengthFt=Math.hypot(...p1.map((v,i)=>v-p0[i]));
  return {member,poly,bounds,center,p0,p1,lengthFt,kind:member.kind,depthFt:member.t,
    widthFt:member.meta.faceWidthFt,grainAxis:p1.map((v,i)=>(v-p0[i])/lengthFt)};
}

export function utilityRoofMeasurements(plan) {
  const s=plan.utilityRoofStudy;if(!s)return null;
  const wall=wallStudyMeasurements(plan),w=plan.wallStudy,roofMembers=utilityRoofStudyMembers(plan).map(record);
  const sidePlates=["left","right"].map(side=>{
    const x0=side==="left"?w.floorBounds.x0Ft:w.floorBounds.x1Ft-w.plates.depthFt,x1=x0+w.plates.depthFt;
    const member=prismMember("side-upper-plate-context","lumber",[[x0,w.topPlateTopYFt],[x1,w.topPlateTopYFt],
      [x1,w.topYFt],[x0,w.topYFt]],[0,0,w.floorBounds.z0Ft],[1,0,0],[0,1,0],[0,0,1],1,
      {name:"Side wall upper plate · portion shown",side,size:w.plates.nominal,displayContext:true});
    member.stage="wall-frame";return record(member);
  });
  const all=[...wall.members,...roofMembers,...sidePlates];
  const bounds=Object.fromEntries(["x","y","z"].flatMap(a=>[
    [a+"0Ft",Math.min(...all.map(r=>r.bounds[a+"0Ft"]))],[a+"1Ft",Math.max(...all.map(r=>r.bounds[a+"1Ft"]))]]));
  return {study:s,wall,roofMembers,sidePlates,bounds,
    wallFinish:{...wall,members:[...wall.members,...sidePlates]},
    anchors:{leftWall:[w.floorBounds.x0Ft,s.baseYFt,s.outsideZFt],
      rightWall:[w.floorBounds.x1Ft,s.baseYFt,s.outsideZFt],
      leftTip:[s.centerXFt-s.halfRunIn/12,s.baseYFt,s.outsideZFt],
      rightTip:[s.centerXFt+s.halfRunIn/12,s.baseYFt,s.outsideZFt],
      peak:[s.centerXFt,s.baseYFt+s.peakRiseIn/12,s.outsideZFt]}};
}

export function utilityRoofDrawing(plan,m=utilityRoofMeasurements(plan)) {
  const build=createBuild({sel:null}),kit=makeKit(build,{STEP:plan.STEP});
  kit.part("wall-frame",()=>drawMembers(kit,m.wallFinish.members.map(r=>r.member),"wall-frame"));
  kit.part("roof-frame",()=>drawMembers(kit,m.roofMembers.map(r=>r.member),"roof-frame"));
  return build;
}
