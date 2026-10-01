/* check-all: node
   Utility stock/datum, opening infill, variable inputs and roof pitch geometry. */
import assert from "node:assert/strict";
import {loadCatalogue} from "./lib/load.mjs";
import {defaults} from "../model/design.js";
import {makePlan} from "../model/plan.js";
import {floorStudyPlan} from "../model/floor-study.js";
import {wallStudyPlan} from "../model/wall-study.js";
import {utilityWallStudyPlan,utilityWindowStudyPlan,utilityWindowMeasurements,utilityWindowDrawing,utilityRoofPitch,utilityRoofRule} from "../model/utility-study.js";
import {doorwayStudyPlan,doorwayMeasurements} from "../model/doorway-study.js";
import {openingStudLayout} from "../model/opening-studs.js";
import utilityPart from "../parts/utility-window-frame.js";
import {woodFinish} from "../ui/learn-wood.js";
import {utilityRoofStudyPlan,utilityRoofStudyMembers} from "../model/utility-roof-study.js";
import {utilityRoofMeasurements,utilityRoofDrawing} from "../model/utility-roof-measurements.js";
import roofPart from "../parts/roof-frame.js";

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
for(const lengthIn of [24,36,60])for(const gapAboveIn of [0,12.5,36]) {
  const plan=utilityWindowStudyPlan(wall,{lengthIn,gapAboveIn}),m=utilityWindowMeasurements(plan);
  near(m.plate.lengthFt*12,lengthIn,"variable plate cut");near(m.plate.widthFt*12,1.5,"plate lies flat");near(m.plate.depthFt*12,3.5,"actual depth");
  near((s.studTopYFt-m.plate.bounds.y1Ft)*12,gapAboveIn,"gap measures to plate top, not underside");
  const cut=gapAboveIn;near(m.studLengthIn,cut,"upper-stud cut equals clear gap");
  assert.equal(m.study.status.gap,"explicit-study-override");
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
for(const lengthIn of [24,36,60]) {
  const sample=utilityWindowMeasurements(utilityWindowStudyPlan(wall,{lengthIn}));
  near(sample.studLengthIn,12.5,"confirmed shop gap is default at every plate cut");
  near((sample.plate.bounds.y1Ft-s.baseYFt)*12,78,"window plate top from flooring");
  near((sample.plate.bounds.y0Ft-s.baseYFt)*12,76.5,"window plate underside from flooring");
  assert.equal(sample.study.status.gap,"confirmed-shop-rule");
}
// Width labels choose stock even if a nominal 12-wide frame is actually 134 in.
for(const [width,nominal,depth] of [[8,"2x4",3.5],[10,"2x4",3.5],[12,"2x6",5.5],[14,"2x6",5.5]]) {
  const source=structuredClone(base);source.state.size=`${width}x16`;source.W=134/12;
  const rule=utilityRoofRule(source);
  assert.equal(rule.stock.nominal,nominal);near(rule.stock.depthIn,depth,"roof actual depth");
  near(rule.stock.thicknessIn,1.5,"roof actual thickness");near(rule.overhangEachSideIn,4,"overhang beyond each side wall");
  near(rule.tipHeightIn,2,"vertical end height");assert.equal(rule.bottomCutDatum,"side-wall-upper-plate-top");
}
for(const [mode,rise] of [["standard",5],["steep",7]])for(const run of [12,60,67]) {
  const p=utilityRoofPitch(base,mode,run);
  near(p.riseIn,run*rise/12,"pitch uses horizontal run");near(p.slopeLengthIn**2,run**2+p.riseIn**2,"slope length separate from run");
  near(Math.tan(p.angleDeg*Math.PI/180),rise/12,"pitch angle");assert.equal(p.scope,"pitch-geometry-only");
}
for(const value of [0,-1,NaN,Infinity])assert.throws(()=>utilityRoofPitch(base,"standard",value));
assert.throws(()=>utilityRoofPitch(base,"loft"));
for(const value of [-1,90,Infinity,NaN])assert.throws(()=>utilityWindowStudyPlan(wall,{lengthIn:36,gapAboveIn:value}));
for(const value of [0,1,121,NaN])assert.throws(()=>utilityWindowStudyPlan(wall,{lengthIn:value}));
for(const value of [0,-1,NaN,Infinity])assert.throws(()=>utilityRoofRule(base,value));
const roofPlan=utilityRoofStudyPlan(wall),roof=utilityRoofMeasurements(roofPlan),rs=roof.study;
assert.equal(roof.roofMembers.length,2,"only the two learned roof slopes");
assert.equal(roof.sidePlates.length,2,"corner plate display portions");
assert.deepEqual(roofPart.members(roofPlan),utilityRoofStudyMembers(roofPlan),"actual roof part uses measured preview");
near(rs.widthIn,120,"actual end-wall width");near(rs.halfRunIn,64,"run includes overhang");
near(rs.peakRiseIn,28+2/3,"shown peak is derived from level-tail fit");
assert.equal(rs.status.tailShape,"provisional-level-tail");assert.equal(rs.status.peak,"derived-from-preview-fit");
for(const side of ["left","right"]) {
  const tip=roof.anchors[side+"Tip"],edge=roof.anchors[side+"Wall"];
  near(Math.abs(tip[0]-edge[0])*12,4,"four inches from outside wall to outer roof tip");
  near(tip[1],s.topYFt,"tail bottom at upper-plate top");
  const r=roof.roofMembers.find(r=>r.member.meta.side===side),atTip=r.poly.filter(p=>Math.abs(p[0]-tip[0])<1e-8);
  assert.equal(atTip.length,2);near(Math.abs(atTip[0][1]-atTip[1][1])*12,2,"vertical end face");
  const [a,b]=r.member.meta.grainEdge;near(Math.abs((b[1]-a[1])/(b[0]-a[0])),5/12,"top-edge pitch");
  near(r.depthFt*12,1.5,"roof stock through thickness");
  // Mid-board perpendicular distance between long edges is actual stock,
  // regardless of its greater vertical height in a front view.
  const inner=r.poly.find(p=>Math.abs(p[0]-rs.centerXFt)<1e-8&&p[1]<roof.anchors.peak[1]-1e-8);
  const perpendicular=Math.abs((b[0]-a[0])*(inner[1]-a[1])-(b[1]-a[1])*(inner[0]-a[0]))/Math.hypot(b[0]-a[0],b[1]-a[1]);
  near(perpendicular*12,3.5,"uncut slope stock depth perpendicular to grain");
  const contact=rs.levelCutRunIn-rs.overhangEachSideIn;assert.ok(contact>0&&contact<3.5,"shown cut reaches plate without stretching stock");
}
noOverlap([...roof.wall.members,...roof.sidePlates,...roof.roofMembers]);
const rawRoof=utilityRoofDrawing(roofPlan,roof),finishedRoof=woodFinish(rawRoof,{wall:roof.wallFinish,utilityRoof:roof});
assert.deepEqual(mesh(rawRoof),mesh(finishedRoof),"roof wood preserves geometry and stages");
assert.ok(finishedRoof.ORDER.every(key=>finishedRoof.buckets[key].tex.startsWith("lessonWood")));
assert.throws(()=>utilityRoofStudyPlan(base),/utility end-wall/);
assert.throws(()=>utilityRoofStudyPlan(wall,{mode:"steep"}),/different seat fit/,"do not add timber to an incompatible tail");
assert.equal(JSON.stringify(base),before,"utility lesson does not mutate loft source");
console.log("PROVED: utility window 12.5-in gap/elevations; real opening contacts; roof stock uses nominal 10-wide threshold; exact 10-wide standard roof preview has 4-in projection, 2-in end height, perpendicular 3.5-in stock depth and level plate datum, with provisional fit status; no solid overlap or wood geometry changes; incompatible seats reject; loft source unchanged.");
