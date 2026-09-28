/* CHECK: the next floor lesson isolates regular joists without redrawing
   them or changing skids, deck, materials, normals, UVs or stages.
   Run: node tools/check-floor-joist-lesson.mjs          (check-all: node) */
import assert from "node:assert/strict";
import { loadCatalogue } from "./lib/load.mjs";
import { defaults } from "../model/design.js";
import { makePlan } from "../model/plan.js";
import { floorStudyPlan } from "../model/floor-study.js";
import { floorMeasurements } from "../model/floor-measurements.js";
import { floorParts, initialFloorSelection } from "../model/floor-lesson.js";
import { onlyFloorJoists } from "../model/floor-joist-lesson.js";
import { assemble, onlyParts } from "../engine/assemble.js";
import { createBuild, makeKit } from "../engine/buckets.js";
import { drawMembers, floorFrameMembers } from "../parts/floor-frame.js";
import { STAGE_ID } from "../parts/stages.js";

const cat=loadCatalogue("learning-side-loft");
assert.deepEqual(initialFloorSelection("joists"),["supports","frame"],"the joist link opens the seated assembly, with its supporting skids");
const plan=floorStudyPlan(makePlan(defaults(cat),cat));
const measurements=floorMeasurements(plan);
const source=assemble(plan,{frames:true}).build;
const sourceBefore=JSON.stringify(source),measuresBefore=JSON.stringify(measurements);
const members=floorFrameMembers(plan),regular=members.filter((member)=>member.kind==="joist");
assert.ok(regular.length>0);
assert.ok(members.some((member)=>member.kind==="rim"));
assert.ok(members.some((member)=>member.kind==="end-joist"));
assert.ok(members.some((member)=>member.kind==="end-backing"),"the full frame includes the flat reinforcement");

// An independent build from the actual member list is the reference. The
// production helper uses bounds, not this redraw or triangle-count guesses.
function memberBuild(list) {
  const build=createBuild({sel:source.sel}),kit=makeKit(build,{STEP:plan.STEP});
  kit.part("floor-frame",()=>drawMembers(kit,list,"floor-frame"));
  return build;
}
const reference=memberBuild(regular);
function partTriangles(build,part) {
  const out={};
  for(const key of build.ORDER) for(const tag of build.tags[key] || []) {
    if(tag.part!==part) continue;
    (out[key] ||= []).push(...build.buckets[key].v.slice(tag.from*27,(tag.from+tag.count)*27));
  }
  return out;
}
const expectedJoists=partTriangles(reference,"floor-frame");
const choices=["supports","frame","deck"];
for(let mask=0;mask<8;mask++) {
  const selection=choices.filter((_,index)=>mask&(1<<index));
  const selected=onlyParts(source,floorParts(selection)),before=JSON.stringify(selected);
  const filtered=onlyFloorJoists(selected,measurements);
  assert.deepEqual(partTriangles(filtered,"floor-frame"),selection.includes("frame")?expectedJoists:{},
    `${selection.join("+") || "empty"}: every regular joist triangle is retained exactly, with no rim, end or flat-backing triangles`);
  for(const part of ["skids","floor-deck"]) assert.deepEqual(partTriangles(filtered,part),partTriangles(selected,part),
    `${part} coordinates, normals, UVs and stages remain unchanged`);
  assert.deepEqual(filtered.ORDER,selected.ORDER,"material order stays unchanged");
  assert.deepEqual(filtered.hitQuads,selected.hitQuads,"the isolated view has no extra picking targets");
  for(const key of filtered.ORDER) {
    const {v:sourceV,n:sourceN,...sourceMaterial}=selected.buckets[key];
    const {v,n,...material}=filtered.buckets[key];
    assert.deepEqual(material,sourceMaterial,"each original material is retained");
    assert.equal(v.length,n*9,"bucket counts match retained geometry");
    assert.ok(v!==sourceV,"filter does not share a mutable vertex array with its input");
  }
  assert.equal(JSON.stringify(selected),before,"filter cannot mutate an existing checkbox selection");
}

// This SLB has no internal wall joists. Add one between regular positions to
// prove the lesson filter also excludes that member kind when it is present.
const wall=structuredClone(regular[0]);
wall.kind="wall-joist";
wall.p0[2]+=measurements.frame.spacingFt/2;
wall.p1[2]+=measurements.frame.spacingFt/2;
const withWall=memberBuild([...members,wall]);
assert.notDeepEqual(partTriangles(withWall,"floor-frame"),expectedJoists);
assert.deepEqual(partTriangles(onlyFloorJoists(withWall,measurements),"floor-frame"),expectedJoists,
  "rim, end and extra internal-wall members are absent from the joist lesson");
assert.deepEqual(partTriangles(onlyFloorJoists(withWall,{frame:{members:[]}}),"floor-frame"),{},
  "without regular joist records no whole-frame triangles leak into the lesson");

for(const vertices of Object.values(expectedJoists)) for(let i=0;i<vertices.length;i+=9) {
  assert.equal(vertices[i+8],STAGE_ID["floor-frame"],"regular joists keep their visible framing stage");
  assert.ok(vertices[i+1]>=4.5/12-1e-9 && vertices[i+1]<=10/12+1e-9,
    "the confirmed full-depth 2x6 still seats 1 inch down in the skid notch");
}
for(const record of measurements.frame.joists) {
  assert.ok(Math.abs(record.depthFt*12-5.5)<1e-9);
  assert.ok(Math.abs(record.widthFt*12-1.5)<1e-9);
  assert.ok(Math.abs(record.lengthFt*12-117)<1e-9,"each regular floor joist is 9ft9in between the confirmed outer boards");
}
assert.equal(measurements.frame.endGroups.negative.count,2,"the source full frame keeps its confirmed double end");
assert.equal(measurements.frame.endGroups.positive.count,1,"the source full frame keeps its confirmed single end");
assert.equal(JSON.stringify(source),sourceBefore,"the original full frame stays available for its checkbox");
assert.equal(JSON.stringify(measurements),measuresBefore,"measurement/member data remains untouched");
console.log(`PROVED: ${regular.length} regular floor joists isolated exactly across all 8 manual selections; no rims, end boards, flat backing or wall joists; skids, deck, materials, normals, UVs, stages and original full frame unchanged.`);
