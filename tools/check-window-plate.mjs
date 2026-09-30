/* check-all: node
   Prove support cuts follow window height without moving the wall layout. */
import assert from "node:assert/strict";
import {loadCatalogue} from "./lib/load.mjs";
import {defaults} from "../model/design.js";
import {makePlan} from "../model/plan.js";
import {floorStudyPlan} from "../model/floor-study.js";
import {wallStudyPlan} from "../model/wall-study.js";
import {windowHeaderStudyPlan,windowHeaderMeasurements} from "../model/window-header-study.js";
import {windowPlateStudyPlan,windowPlateMeasurements,windowFramingDrawing,windowFramingRecords} from "../model/window-plate-study.js";
import windowPlatePart from "../parts/window-plate.js";
import {wallStudyFrame} from "../parts/wall-frame.js";
import {woodFinish} from "../ui/learn-wood.js";
import {assemble} from "../engine/assemble.js";

const near=(a,b,label)=>assert.ok(Math.abs(a-b)<1e-8,label+`: ${a} != ${b}`);
const cat=loadCatalogue("learning-side-loft"),ordinary=makePlan(defaults(cat),cat);
const wall=wallStudyPlan(floorStudyPlan(ordinary),{wall:"end"});
const wallBefore=JSON.stringify(wall);
const layout=wallStudyFrame(wall).members.filter(m=>m.kind==="stud" && m.meta.role!=="end");
function signature(build) {
  const triangles=[];
  for(const key of build.ORDER)for(const tag of build.tags[key]||[])for(let t=tag.from;t<tag.from+tag.count;t++){
    const v=build.buckets[key].v,values=[tag.part];
    for(const n of [0,9,18]){const i=t*27+n;values.push(...v.slice(i,i+6),v[i+8]);}
    triangles.push(JSON.stringify(values));
  }
  return triangles.sort();
}
assert.equal(windowPlatePart.appliesTo(ordinary),false);
assert.deepEqual(windowPlatePart.members(ordinary),[]);
assert.ok(!Object.values(assemble(ordinary,{frames:true}).build.tags).flat().some(t=>t.part==="window-plate"));
for(const lengthIn of [24,36,48,72,120])for(const clearHeightIn of [24,36,48,60]) {
  const headerPlan=windowHeaderStudyPlan(wall,{lengthIn});
  const plan=windowPlateStudyPlan(headerPlan,{lengthIn,clearHeightIn});
  const m=windowPlateMeasurements(plan),header=windowHeaderMeasurements(plan),p=m.plate.bounds;
  near((p.y1Ft-p.y0Ft)*12,1.5,"flat window plate height");
  near((p.z1Ft-p.z0Ft)*12,3.5,"window plate depth");
  near((p.x1Ft-p.x0Ft)*12,lengthIn,"sample plate cut");
  near((header.study.bottomYFt-p.y1Ft)*12,clearHeightIn,"clear vertical opening");
  near(m.plateTopAboveFloorIn,71.5-clearHeightIn,"plate elevation above floor");
  near(m.studLengthIn,68.5-clearHeightIn,"support cut changes with window height");
  const expected=layout.filter(v=>v.meta.at.u0>=p.x0Ft-1e-8 && v.meta.at.u1<=p.x1Ft+1e-8);
  assert.equal(m.studMembers.length,expected.length);
  for(const [i,r] of m.studMembers.entries()) {
    near(r.bounds.x0Ft,expected[i].meta.at.u0,"unchanged wall layout left face");
    near(r.bounds.x1Ft,expected[i].meta.at.u1,"unchanged wall layout right face");
    near((r.bounds.x1Ft-r.bounds.x0Ft)*12,1.5,"stud thickness");
    near(r.bounds.y0Ft,m.bottomPlate.bounds.y1Ft,"bearing on bottom plate");
    near(r.bounds.y1Ft,p.y0Ft,"top touches window plate");
    assert.deepEqual(r.grainAxis,[0,1,0],"grain follows the upright");
    near(r.lengthFt*12,m.studLengthIn,"grain record uses actual cut length");
  }
  if(lengthIn===36) {
    assert.equal(m.studMembers.length,3,"one pair at 48-inch mark and one stud at 64-inch mark");
    near(m.studMembers[0].bounds.x1Ft,m.studMembers[1].bounds.x0Ft,"double studs touch");
    near(m.studMembers[0].member.meta.markFt*12,48,"pair at original four-foot mark");
    near(m.studMembers[2].member.meta.markFt*12,64,"next original layout mark");
  }
  // Every pair of solids may touch, but may not occupy any shared volume.
  for(let i=0;i<m.members.length;i++)for(let j=i+1;j<m.members.length;j++) {
    const a=m.members[i].bounds,b=m.members[j].bounds;
    assert.ok(["x","y","z"].some(k=>Math.min(a[k+"1Ft"],b[k+"1Ft"])-Math.max(a[k+"0Ft"],b[k+"0Ft"])<=1e-8),"no solid overlap");
  }
  const measurements={header,windowPlate:m};
  for(const view of ["plate","all","header","end"])for(const plates of [true,false]) {
    const build=windowFramingDrawing(plan,measurements,{view,plates});
    const records=windowFramingRecords(measurements,{view,plates}).flatMap(g=>g.records);
    assert.equal(signature(build).length,records.length*12,"every visible board draws one solid");
    assert.deepEqual(signature(woodFinish(build,measurements)),signature(build),"surface finish preserves all mesh geometry");
  }
  assert.ok(Object.isFrozen(plan.windowPlateStudy.studs));
}
const hp=windowHeaderStudyPlan(wall,{lengthIn:36});
for(const clearHeightIn of [undefined,NaN,Infinity,0,-1,68.5,80])
  assert.throws(()=>windowPlateStudyPlan(hp,{lengthIn:36,clearHeightIn}));
for(const lengthIn of [undefined,NaN,Infinity,0,-1,4,121])
  assert.throws(()=>windowPlateStudyPlan(hp,{lengthIn,clearHeightIn:36}));
const bad=structuredClone(hp);bad.construction.windowPlateLesson.studSeat="flooring";
assert.throws(()=>windowPlateStudyPlan(bad,{lengthIn:36,clearHeightIn:36}));
assert.equal(JSON.stringify(wall),wallBefore,"wall source is immutable");
console.log("PROVED: flat window plate, retained wall layout and doubles, variable support cuts, contact at both ends, no overlaps, vertical grain and unchanged ordinary model.");
