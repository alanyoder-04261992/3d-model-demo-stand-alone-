/* check-all: node
   Utility stock/datum, opening infill, variable inputs and roof pitch geometry. */
import assert from "node:assert/strict";
import {loadCatalogue} from "./lib/load.mjs";
import {defaults} from "../model/design.js";
import {makePlan} from "../model/plan.js";
import {floorStudyPlan} from "../model/floor-study.js";
import {wallStudyPlan} from "../model/wall-study.js";
import {utilityWallStudyPlan,utilityWindowStudyPlan,utilityWindowMeasurements,utilityWindowDrawing,utilityRoofPitch} from "../model/utility-study.js";
import {doorwayStudyPlan,doorwayMeasurements} from "../model/doorway-study.js";
import {openingStudLayout} from "../model/opening-studs.js";
import utilityPart from "../parts/utility-window-frame.js";
import {woodFinish} from "../ui/learn-wood.js";

const near=(a,b,label)=>assert.ok(Math.abs(a-b)<1e-8,`${label}: ${a} != ${b}`);
const cat=loadCatalogue("learning-side-loft"),base=makePlan(defaults(cat),cat),before=JSON.stringify(base);
assert.equal(utilityPart.appliesTo(base),false);assert.deepEqual(utilityPart.members(base),[]);
const wall=utilityWallStudyPlan(base),s=wall.wallStudy;
assert.ok(Object.isFrozen(wall));near(s.stud.lengthIn,89,"utility stud cut");near(s.heightFt*12,93.5,"height includes three plates");
near((s.studTopYFt-s.baseYFt)*12,90.5,"top-plate underside from flooring");
near(wallStudyPlan(floorStudyPlan(base),{wall:"end"}).wallStudy.stud.lengthIn,75,"loft rule unchanged");
function noOverlap(records) {
  for(let i=0;i<records.length;i++)for(let j=i+1;j<records.length;j++) {
    const a=records[i].bounds,b=records[j].bounds;
    assert.ok(!["x","y","z"].every(axis=>Math.min(a[axis+"1Ft"],b[axis+"1Ft"])-Math.max(a[axis+"0Ft"],b[axis+"0Ft"])>1e-8),"no solid overlap");
  }
}
function mesh(build) {
  const out=[];
  for(const key of build.ORDER)for(let i=0;i<build.buckets[key].v.length;i+=9) {
    const v=build.buckets[key].v;out.push(JSON.stringify([...v.slice(i,i+6),v[i+8]]));
  }
  return out.sort();
}
for(const lengthIn of [24,36,60])for(const openingTopAboveFloorIn of [48,72,89]) {
  const plan=utilityWindowStudyPlan(wall,{lengthIn,openingTopAboveFloorIn}),m=utilityWindowMeasurements(plan);
  near(m.plate.lengthFt*12,lengthIn,"variable plate cut");near(m.plate.widthFt*12,1.5,"plate lies flat");near(m.plate.depthFt*12,3.5,"actual depth");
  near((m.plate.bounds.y0Ft-s.baseYFt)*12,openingTopAboveFloorIn,"opening top is plate underside");
  const cut=89-openingTopAboveFloorIn;near(m.studLengthIn,cut,"upper-stud cut");
  assert.deepEqual(m.study.studs,cut?openingStudLayout(wall,m.study.x0Ft,m.study.x1Ft):[],"retain existing wall marks");
  assert.equal(m.studMembers.length,cut?m.study.studs.length:0,"no zero-height upper studs");
  for(const r of m.studMembers) {
    near(r.bounds.y0Ft,m.plate.bounds.y1Ft,"stud sits on top window plate");near(r.bounds.y1Ft,s.studTopYFt,"stud touches top plate");
    near(r.lengthFt*12,cut,"selected height recalculates cut");near(r.widthFt*12,1.5,"upper stock width");
    assert.deepEqual(r.grainAxis,[0,1,0]);
  }
  noOverlap(m.members);
  const build=utilityWindowDrawing(plan,m),finish=woodFinish(build,{utilityWindow:m});
  assert.deepEqual(mesh(build),mesh(finish),"wood finish preserves exact mesh");
  assert.ok(finish.ORDER.every(key=>finish.buckets[key].tex.startsWith("lessonWood")));
}
for(const widthIn of [24,36,72])for(const headerMode of ["loft","flat","to-plate"])for(const kingCutIn of [70,80]) {
  const plan=doorwayStudyPlan(wall,{widthIn,kingCutIn,headerMode}),m=doorwayMeasurements(plan);
  noOverlap(m.members);
  for(const r of m.aboveStudMembers) {
    near(r.bounds.y0Ft,plan.doorwayStudy.headerTopYFt,"stud sits on header");near(r.bounds.y1Ft,s.studTopYFt,"stud meets top plate");
    near(r.lengthFt*12,m.gapAboveHeaderIn,"gap becomes stud cut");assert.deepEqual(r.grainAxis,[0,1,0]);
  }
  assert.equal(m.aboveStudMembers.length,m.gapAboveHeaderIn>1e-8?plan.doorwayStudy.aboveHeaderStuds.length:0);
  if(headerMode==="to-plate")assert.equal(m.aboveStudMembers.length,0);
}
const sample=doorwayMeasurements(doorwayStudyPlan(wall,{widthIn:36,kingCutIn:80}));
near(sample.gapAboveHeaderIn,4,"utility doorway gap");assert.ok(sample.aboveStudMembers.length>0,"utility gap contains real studs");
assert.throws(()=>doorwayStudyPlan(wall,{widthIn:1,kingCutIn:80}),/upper-stud layout/,"do not silently leave positive space empty when no grid mark fits");
const windowSample=utilityWindowMeasurements(utilityWindowStudyPlan(wall,{lengthIn:36,openingTopAboveFloorIn:72}));
near(windowSample.studLengthIn,17,"utility window sample");
for(const [mode,rise] of [["standard",5],["steep",7]])for(const run of [12,60,67]) {
  const p=utilityRoofPitch(base,mode,run);
  near(p.riseIn,run*rise/12,"pitch uses horizontal run");near(p.slopeLengthIn**2,run**2+p.riseIn**2,"slope length separate from run");
  near(Math.tan(p.angleDeg*Math.PI/180),rise/12,"pitch angle");assert.equal(p.scope,"pitch-geometry-only");
}
for(const value of [0,-1,NaN,Infinity])assert.throws(()=>utilityRoofPitch(base,"standard",value));
assert.throws(()=>utilityRoofPitch(base,"loft"));
for(const value of [0,1,89.25,Infinity,NaN])assert.throws(()=>utilityWindowStudyPlan(wall,{lengthIn:36,openingTopAboveFloorIn:value}));
for(const value of [0,1,121,NaN])assert.throws(()=>utilityWindowStudyPlan(wall,{lengthIn:value,openingTopAboveFloorIn:72}));
assert.equal(JSON.stringify(base),before,"utility lesson does not mutate loft source");
console.log("PROVED: utility studs 89 in, derived wall height 93.5 in; flat top window plate and variable upper-stud cuts with real contact; door gaps filled without overlap or zero-length studs; unchanged loft source and wood geometry; standard 5/12 and steep 7/12 use horizontal run.");
