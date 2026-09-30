/* CHECK: gable backing has real stud contact, the correct plate datum and
   a per-gable window/fake-window condition. check-all: node */
import assert from "node:assert/strict";
import { loadCatalogue } from "./lib/load.mjs";
import { defaults } from "../model/design.js";
import { makePlan } from "../model/plan.js";
import { floorStudyPlan } from "../model/floor-study.js";
import { wallStudyPlan } from "../model/wall-study.js";
import { gableStudyPlan } from "../model/gable-study.js";
import { trussStudyPlan } from "../model/truss-study.js";
import { trussStudyMeasurements } from "../model/truss-measurements.js";
import { gableBackingMembers, gableBackingRule } from "../parts/gable-backing.js";
import { assemble, onlyParts } from "../engine/assemble.js";
import { woodFinish } from "../ui/learn-wood.js";

const near=(a,b,why)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<1e-8,`${why}: ${a} / ${b}`);
const cat=loadCatalogue("learning-side-loft");
const ordinary=makePlan(defaults(cat),cat);
const lesson=input=>trussStudyPlan(gableStudyPlan(wallStudyPlan(floorStudyPlan(input),{wall:"end"}),{gable:true}),{truss:true});
const plan=lesson(ordinary), snapshot=JSON.stringify(plan), m=trussStudyMeasurements(plan);
const pieces=gableBackingMembers(plan), rule=gableBackingRule(plan);
assert.equal(pieces.length,5,"four gable studs leave three internal bays plus two outer bays to the truss");
assert.equal(rule.status.orientation,"confirmed");
assert.deepEqual(gableBackingMembers(ordinary),[],"settings do not enable the part in the ordinary model");
const without=structuredClone(plan);delete without.construction.gableBacking;
assert.deepEqual(gableBackingMembers(without),[]);
const oldMeasures=trussStudyMeasurements(without);
assert.deepEqual(m.trussMembers,oldMeasures.trussMembers,"adding backing never changes a truss cut");
assert.deepEqual(m.studMembers,oldMeasures.studMembers,"adding backing never moves or shortens gable studs");
const studs=m.studMembers.slice().sort((a,b)=>a.center[0]-b.center[0]);
const internal=m.backingMembers.filter(r=>r.member.meta.bay==="internal");
const outer=m.backingMembers.filter(r=>r.member.meta.bay==="outer");
for(const piece of m.backingMembers) {
  near(piece.widthFt*12,3.5,"wide face is vertical");near(piece.depthFt*12,1.5,"thickness through wall");
  near((piece.bounds.y0Ft-plan.wallStudy.topYFt)*12,11,"bottom measured from upper-plate TOP");
  near((piece.bounds.y0Ft-plan.gableStudy.topYFt)*12,5.5,"only 5.5-inch clear gap above gable board");
  near((piece.bounds.y1Ft-plan.wallStudy.topYFt)*12,14.5,"top adds actual backing height");
  near(piece.z1Ft,studs[0].z1Ft,"wide faces are flush");
  assert.equal(piece.member.meta.purpose,"siding-seam-support");
  assert.deepEqual(piece.grainAxis,[1,0,0],"wood grain follows the horizontal piece");
}
for(const [i,piece] of internal.entries()) {
  near(piece.lengthFt*12,20.5,"clear length is 24 minus 3.5, not the thickness");
  near(piece.bounds.x0Ft,studs[i].bounds.x1Ft,"left cut meets adjacent stud face");
  near(piece.bounds.x1Ft,studs[i+1].bounds.x0Ft,"right cut meets adjacent stud face");
}
function checkOuter(measurements, fitted) {
  const profile=fitted.trussStudy.profile, center=fitted.trussStudy.centerXFt;
  const sortedStuds=measurements.studMembers.slice().sort((a,b)=>a.center[0]-b.center[0]);
  for(const piece of measurements.backingMembers.filter(r=>r.member.meta.bay==="outer")) {
    const left=piece.side==="left", adjacent=left?sortedStuds[0]:sortedStuds.at(-1);
    near(left?piece.bounds.x1Ft:piece.bounds.x0Ft,left?adjacent.bounds.x0Ft:adjacent.bounds.x1Ft,"outer piece reaches outer stud face");
    const truss=measurements.trussMembers.find(r=>r.side===piece.side&&r.kind==="truss-lower");
    near(piece.z1Ft,truss.z0Ft,"backing face meets truss back face without volume overlap");
    for(const y of [11,14.5]) {
      const points=piece.poly.filter(p=>Math.abs((p[1]-fitted.trussStudy.baseYFt)*12-y)<1e-7);
      const edge=left?Math.min(...points.map(p=>p[0])):Math.max(...points.map(p=>p[0]));
      const expected=profile.tip[0]-(y-profile.tipY)/profile.lowerSlope;
      near(Math.abs(edge-center)*12,expected,"outer cut follows actual truss outline at both backing edges");
      const inner=(profile.tipY+profile.lowerSlope*profile.tip[0]-fitted.trussStudy.chord.depthIn/Math.cos(profile.lowerAngle)-y)/profile.lowerSlope;
      assert.ok(expected>inner&&expected>Math.abs((left?adjacent.bounds.x0Ft:adjacent.bounds.x1Ft)-center)*12,"outer end has contact area behind the truss face");
    }
    assert.ok(piece.lengthFt*12>piece.member.meta.topLengthIn,"angled outer cut has distinct bottom and top lengths");
  }
}
checkOuter(m,plan);
const built=assemble(plan,{frames:true}).build,isolated=onlyParts(built,["gable-backing"]);
let triangleCount=0,volume=0;
for(const key of isolated.ORDER) {
  const v=isolated.buckets[key].v;
  for(let i=0;i<v.length;i+=27) {
    triangleCount++;
    const a=v.slice(i,i+3),b=v.slice(i+9,i+12),c=v.slice(i+18,i+21);
    volume+=(a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6;
    for(const p of [a,b,c]) assert.ok(m.backingMembers.some(r=>["x","y","z"].every((axis,j)=>
      p[j]>=r.bounds[axis+"0Ft"]-1e-8&&p[j]<=r.bounds[axis+"1Ft"]+1e-8)),"mesh stays in its measured piece");
  }
}
assert.equal(triangleCount,60,"three rectangular and two tapered prisms are actually drawn");
const outerVolume=outer.reduce((sum,r)=>sum+(r.lengthFt*12+r.member.meta.topLengthIn)/2*3.5*1.5/1728,0);
near(volume,3*20.5*3.5*1.5/1728+outerVolume,"closed mesh matches rectangular plus trapezoidal lumber volume");
const finish=woodFinish(isolated,{truss:m});
const textured=finish.ORDER.filter(key=>finish.buckets[key].n>0);
assert.equal(new Set(textured.map(key=>key.split("-").at(-1))).size,5,"each board gets its own seeded texture identity");
for(const key of textured) assert.match(finish.buckets[key].tex,/Wood/);
const preserve=["skids","floor-frame","floor-deck","wall-frame","gable-frame","roof-frame"];
assert.deepEqual(onlyParts(built,preserve),onlyParts(assemble(without,{frames:true}).build,preserve),"earlier assemblies stay unchanged");

const demo=makePlan(defaults(loadCatalogue("demo")),loadCatalogue("demo"));
const windows=Object.entries(demo.CAT).filter(([,entry])=>entry.gable);
assert.ok(windows.some(([,entry])=>entry.draw==="faux-loft"),"test includes the actual fake-window catalogue entry");
assert.ok(windows.some(([,entry])=>entry.draw!=="faux-loft"),"test includes actual real gable windows");
for(const [catId,entry] of windows) {
  const withWindow=structuredClone(plan);withWindow.CAT[catId]=entry;
  withWindow.state.items.push({cat:catId,wall:"B",pos:0});
  assert.deepEqual(gableBackingMembers(withWindow),[],`${catId} excludes backing on its gable`);
  assert.equal(gableBackingRule(withWindow).enabled,false);
  withWindow.state.items.at(-1).wall="F";
  assert.equal(gableBackingMembers(withWindow).length,5,`${catId} on opposite end does not remove this end's backing`);
}
const lowWindow=structuredClone(plan);lowWindow.state.items.push({cat:"w23",wall:"B",pos:0});
assert.equal(gableBackingMembers(lowWindow).length,5,"a wall window below the gable is not a gable window");
const wider=structuredClone(makePlan({...defaults(cat),size:"12x20"},cat));
wider.construction.floorStudy.frame.widthFt=12;wider.construction.floorStudy.skids.lengthFt=20;
const widerPlan=lesson(wider),widerM=trussStudyMeasurements(widerPlan);
assert.equal(widerM.backingMembers.length,6,"wider gable derives four internal and two outer bays");
for(const r of widerM.backingMembers.filter(r=>r.member.meta.bay==="internal")) near(r.lengthFt*12,20.5,"width change does not scale internal cuts");
checkOuter(widerM,widerPlan);
assert.notEqual(widerM.backingMembers[0].lengthFt,m.backingMembers[0].lengthFt,"outer length follows the new roof profile");
const changedSpacing=structuredClone(ordinary);changedSpacing.construction.trussStudy.studs.spacingIn=30;
for(const r of trussStudyMeasurements(lesson(changedSpacing)).backingMembers.filter(r=>r.member.meta.bay==="internal")) near(r.lengthFt*12,26.5,"new spacing recalculates clear cut length");
for(const edit of [r=>r.bottomOffsetIn=0,r=>r.bottomOffsetIn=45,r=>r.thicknessIn=4,r=>r.datum="gable-board-top"]){
  const invalid=structuredClone(plan);edit(invalid.construction.gableBacking);
  assert.throws(()=>gableBackingMembers(invalid));
}
assert.equal(JSON.stringify(plan),snapshot,"backing generation leaves the plan immutable");
console.log("PROVED: five backing pieces reach both outer trusses and all stud bays; siding-seam purpose, 11-inch plate datum, 20.5-inch internal cuts, tapered outer ends with face contact, five varied wood finishes, exact solid volume, unchanged prior members, window exclusions and other-width recalculation.");
