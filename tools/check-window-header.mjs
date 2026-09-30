/* check-all: node
   Verify the learned lofted-wall header, not assumed opening side framing. */
import assert from "node:assert/strict";
import {loadCatalogue} from "./lib/load.mjs";
import {defaults} from "../model/design.js";
import {makePlan} from "../model/plan.js";
import {floorStudyPlan} from "../model/floor-study.js";
import {wallStudyPlan} from "../model/wall-study.js";
import {windowHeaderStudyPlan,windowHeaderMeasurements,windowHeaderDrawing} from "../model/window-header-study.js";
import headerPart from "../parts/window-header.js";
import {assemble} from "../engine/assemble.js";
import {woodFinish} from "../ui/learn-wood.js";

const near=(a,b,message)=>assert.ok(Math.abs(a-b)<1e-8,message+`: ${a} vs ${b}`);
const cat=loadCatalogue("learning-side-loft"),ordinary=makePlan(defaults(cat),cat);
const wall=wallStudyPlan(floorStudyPlan(ordinary),{wall:"end"}),before=JSON.stringify(wall);
assert.equal(headerPart.appliesTo(ordinary),false);
assert.deepEqual(headerPart.members(ordinary),[]);
const original=assemble(ordinary,{frames:true}).build;
assert.ok(!Object.values(original.tags).flat().some(tag=>tag.part==="window-header"));
for(const lengthIn of [24,36,48,120]) {
  const plan=windowHeaderStudyPlan(wall,{lengthIn}),m=windowHeaderMeasurements(plan);
  const [flat,a,b]=m.headerMembers.map(r=>r.bounds),[top,upper]=m.plateMembers.map(r=>r.bounds);
  assert.equal(headerPart.members(plan).length,3);
  near((flat.y1Ft-flat.y0Ft)*12,1.5,"flat header board height");
  near((flat.z1Ft-flat.z0Ft)*12,3.5,"flat header board depth");
  for(const p of [a,b]) {
    near((p.y1Ft-p.y0Ft)*12,3.5,"edge board height");
    near((p.z1Ft-p.z0Ft)*12,1.5,"edge board thickness");
    near(p.y0Ft,flat.y1Ft,"edge board sits directly on flat board");
    near(p.y1Ft,top.y0Ft,"header touches underside of TOP plate");
  }
  near(a.z1Ft,b.z0Ft,"edge boards touch without overlap");
  near((a.z0Ft-flat.z0Ft)*12,.5,"half-inch ledge on OUTSIDE (smaller Z)");
  near(b.z1Ft,flat.z1Ft,"inside faces flush");
  near(top.y1Ft,upper.y0Ft,"upper plate above top plate");
  near((a.y1Ft-flat.y0Ft)*12,5,"total header height");
  near(m.headerBottomAboveFloorIn,71.5,"header underside height above flooring");
  for(const r of m.headerMembers)near(r.lengthFt*12,lengthIn,"all sample cuts follow input length");
  for(const p of m.plateMembers)assert.equal(p.member.meta.displayContext,true);
  const drawing=windowHeaderDrawing(plan,m),finish=woodFinish(drawing,{header:m});
  function triangles(build) {
    const out=[];
    for(const key of build.ORDER) for(const tag of build.tags[key]||[]) for(let t=tag.from;t<tag.from+tag.count;t++) {
      const v=build.buckets[key].v,values=[tag.part];
      for(const n of [0,9,18]){const i=t*27+n;values.push(...v.slice(i,i+6),v[i+8]);}
      out.push(JSON.stringify(values));
    }
    return out.sort();
  }
  near(triangles(drawing).length,60,"three header boards and two plate portions");
  near(triangles(windowHeaderDrawing(plan,m,{plates:false})).length,36,"isolated three-board section");
  assert.deepEqual(triangles(finish),triangles(drawing),"surface finish preserves geometry, normals and stages");
  assert.ok(finish.ORDER.every(k=>finish.buckets[k].tex.startsWith("lessonWood")),"every board has grain");
}
for(const lengthIn of [undefined,NaN,Infinity,-1,0,3.5,121])assert.throws(()=>windowHeaderStudyPlan(wall,{lengthIn}));
const wrong=structuredClone(wall);wrong.construction.windowHeader.ledgeSide="inside";
assert.throws(()=>windowHeaderStudyPlan(wrong,{lengthIn:36}));
wrong.construction.windowHeader.ledgeSide="outside";wrong.construction.windowHeader.scope="utility-wall";
assert.throws(()=>windowHeaderStudyPlan(wrong,{lengthIn:36}));
assert.equal(JSON.stringify(wall),before,"source measured wall is unchanged");
assert.equal(cat.construction.windowPlateLesson.orientation,"flat");
assert.equal(cat.construction.windowPlateLesson.studsBelow,true);
assert.equal(cat.construction.windowPlateLesson.scope,"lofted-wall");
console.log("PROVED: lofted-wall header section, outside ledge, top-plate contact, variable cuts, unchanged mesh, and learned flat window plate with studs below.");
