/* Different windows drive the same box-framing rule. check-all: node */
import assert from "node:assert/strict";
import { loadCatalogue } from "./lib/load.mjs";
import { defaults } from "../model/design.js";
import { makePlan } from "../model/plan.js";
import { floorStudyPlan } from "../model/floor-study.js";
import { wallStudyPlan } from "../model/wall-study.js";
import { gableStudyPlan } from "../model/gable-study.js";
import { trussStudyPlan, trussStudyMembers, trussGableStudMembers } from "../model/truss-study.js";
import { trussStudyMeasurements } from "../model/truss-measurements.js";
import { gableWindowFrameMembers } from "../parts/gable-window-frame.js";
import { gableBackingMembers } from "../parts/gable-backing.js";
import { assemble, onlyParts } from "../engine/assemble.js";
import { woodFinish } from "../ui/learn-wood.js";
const near=(a,b,label)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<1e-8,`${label}: ${a} != ${b}`);
const cat=loadCatalogue("learning-side-loft"),ordinary=makePlan(defaults(cat),cat);
const base=gableStudyPlan(wallStudyPlan(floorStudyPlan(ordinary),{wall:"end"}),{gable:true});
const lesson=input=>trussStudyPlan(base,{truss:true,windowOpening:input});
const plain=lesson(null),snapshot=JSON.stringify(base),plainStuds=trussGableStudMembers(plain);
assert.deepEqual(gableWindowFrameMembers(ordinary),[]);
assert.deepEqual(gableWindowFrameMembers(plain),[]);
assert.equal(gableBackingMembers(plain).length,5);
for(const [widthIn,heightIn,centerIn] of [[18,24,0],[30,18,0],[22,14,12],[12,16,-28],[48,10,0],[5,20,0]]) {
  const plan=lesson({kind:"window",widthIn,heightIn,centerIn});
  const t=plan.trussStudy,o=t.windowOpening,m=trussStudyMeasurements(plan);
  assert.deepEqual(trussStudyMembers(plan),trussStudyMembers(plain),"window must not alter truss cuts");
  assert.equal(gableBackingMembers(plan).length,0,"backing omitted with real opening");
  assert.equal(m.windowMembers.length,2);
  const sides=m.studMembers.filter(s=>Math.abs(s.bounds.x1Ft-(t.centerXFt+o.x0In/12))<1e-8 || Math.abs(s.bounds.x0Ft-(t.centerXFt+o.x1In/12))<1e-8).sort((a,b)=>a.center[0]-b.center[0]);
  assert.equal(sides.length,2,"one full stud exactly against each opening side");
  near((sides[1].bounds.x0Ft-sides[0].bounds.x1Ft)*12,widthIn,"clear width");
  const bottom=m.windowMembers.find(s=>s.side==="bottom"),top=m.windowMembers.find(s=>s.side==="top");
  near((top.bounds.y0Ft-bottom.bounds.y1Ft)*12,heightIn,"clear height");
  for(const piece of m.windowMembers) {
    near(piece.lengthFt*12,widthIn,"each horizontal resizes with window");
    near(piece.widthFt*12,3.5,"wide face vertical");near(piece.depthFt*12,1.5,"actual thickness");
    near(piece.bounds.x0Ft,sides[0].bounds.x1Ft,"left end touches stud");
    near(piece.bounds.x1Ft,sides[1].bounds.x0Ft,"right end touches stud");
    near(piece.z1Ft,sides[0].z1Ft,"outward faces flush");
    assert.deepEqual(piece.grainAxis,[1,0,0]);
  }
  for(const stud of m.studMembers) {
    assert.ok(stud.bounds.x1Ft<=bottom.bounds.x0Ft+1e-8 || stud.bounds.x0Ft>=bottom.bounds.x1Ft-1e-8,"no regular stud crosses window cavity");
    near(stud.bounds.y0Ft,plan.gableStudy.topYFt,"side studs still stand on gable board");
  }
  const mesh=onlyParts(assemble(plan,{frames:true}).build,["gable-window-frame"]);
  const triangles=mesh.ORDER.flatMap(k=>Array.from({length:mesh.buckets[k].v.length/27},(_,i)=>mesh.buckets[k].v.slice(i*27,i*27+27)));
  assert.equal(triangles.length,24,"two six-face boxes drawn");
  let volume=0;
  for(const v of triangles) {
    const [a,b,c]=[0,9,18].map(i=>v.slice(i,i+3));
    volume+=(a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6;
  }
  near(volume,2*widthIn*3.5*1.5/1728,"actual mesh volume");
  const finished=woodFinish(mesh,{truss:m});
  assert.ok(finished.ORDER.some(k=>finished.buckets[k].tex.includes("Wood")),"frame uses wood texture");
  const manual=lesson({kind:"window",widthIn,heightIn,centerIn,bottomIn:o.bottomIn});
  near(manual.trussStudy.windowOpening.bottomIn,o.bottomIn,"explicit selected height respected");
  assert.equal(manual.trussStudy.windowOpening.autoHeight,false);
}
const fake=lesson({kind:"fake"});
const wider=structuredClone(makePlan({...defaults(cat),size:"12x20"},cat));
wider.construction.floorStudy.frame.widthFt=12;wider.construction.floorStudy.skids.lengthFt=20;
const widerBase=gableStudyPlan(wallStudyPlan(floorStudyPlan(wider),{wall:"end"}),{gable:true});
const widerPlan=trussStudyPlan(widerBase,{truss:true,windowOpening:{kind:"window",widthIn:30,heightIn:18}});
for(const piece of trussStudyMeasurements(widerPlan).windowMembers)
  near(piece.lengthFt*12,30,"larger shed does not scale a selected fixed window opening");
assert.deepEqual(gableWindowFrameMembers(fake),[],"fake is not a real opening");
assert.deepEqual(trussGableStudMembers(fake),plainStuds,"no invented fake-window box");
assert.deepEqual(gableBackingMembers(fake),[]);
assert.deepEqual(trussGableStudMembers(lesson(null)),plainStuds,"no-window layout restored");
for(const input of [{widthIn:120,heightIn:12},{widthIn:24,heightIn:60},{widthIn:18,heightIn:20,centerIn:100},
  {widthIn:18,heightIn:24,bottomIn:0},{widthIn:18,heightIn:24,bottomIn:100},{widthIn:NaN,heightIn:20},{widthIn:18,heightIn:-1}])
  assert.throws(()=>lesson({kind:"window",...input}),/window|Window/);
assert.equal(JSON.stringify(base),snapshot,"input plan stays immutable");
console.log("PROVED: variable opening sizes/positions move side studs and resize wide-face-outward box pieces; clear cavity, full contacts, exact mesh volume, wood grain, height fit, no-window restoration and fake-window exclusion.");
