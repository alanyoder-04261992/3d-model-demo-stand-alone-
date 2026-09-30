/* check-all: node
   Physical doorway bearing, variable cuts and all learned arrangements. */
import assert from "node:assert/strict";
import {loadCatalogue} from "./lib/load.mjs";
import {defaults} from "../model/design.js";
import {makePlan} from "../model/plan.js";
import {floorStudyPlan} from "../model/floor-study.js";
import {wallStudyPlan} from "../model/wall-study.js";
import {doorwayStudyPlan,doorwayMeasurements,doorwayDrawing} from "../model/doorway-study.js";
import part from "../parts/doorway-frame.js";
import {woodFinish} from "../ui/learn-wood.js";
import {assemble} from "../engine/assemble.js";

const near=(a,b,label)=>assert.ok(Math.abs(a-b)<1e-8,`${label}: ${a} != ${b}`);
function signature(build){
  const out=[];
  for(const key of build.ORDER)for(const tag of build.tags[key]||[])for(let t=tag.from;t<tag.from+tag.count;t++){
    const v=build.buckets[key].v,values=[tag.part];
    for(const n of [0,9,18]){const i=t*27+n;values.push(...v.slice(i,i+6),v[i+8]);}
    out.push(JSON.stringify(values));
  }
  return out.sort();
}
const cat=loadCatalogue("learning-side-loft"),ordinary=makePlan(defaults(cat),cat);
assert.equal(part.appliesTo(ordinary),false);assert.deepEqual(part.members(ordinary),[]);
assert.ok(!Object.values(assemble(ordinary,{frames:true}).build.tags).flat().some(t=>t.part==="doorway-frame"));
let baseline;
for(const wallCut of [75,84]){
  const custom=structuredClone(cat);custom.construction.wallStudy.stud.lengthIn=wallCut;
  const wall=wallStudyPlan(floorStudyPlan(makePlan(defaults(custom),custom)),{wall:"end"}),before=JSON.stringify(wall);
  if(wallCut===75)baseline=wall;
  for(const widthIn of [24,36,72,114])for(const headerMode of ["loft","flat","to-plate"]){
    const height=headerMode==="loft"?5:headerMode==="flat"?3:0;
    for(const inputCut of [50,wallCut-height]){
      const plan=doorwayStudyPlan(wall,{widthIn,kingCutIn:inputCut,headerMode}),m=doorwayMeasurements(plan),s=m.study;
      const cut=headerMode==="to-plate"?wallCut:inputCut;
      assert.ok(Object.isFrozen(plan)&&Object.isFrozen(s));
      near(s.kingCutIn,cut,"king cut");near(s.headerHeightIn,height,"header height");
      near((s.x1Ft-s.x0Ft)*12,widthIn,"clear opening width");
      near(m.headerBottomAboveFloorIn,cut+1.5,"flooring datum includes bottom plate");
      near(m.gapAboveHeaderIn,wallCut-cut-height,"available height");
      assert.equal(m.kingMembers.length,2);assert.equal(m.studMembers.length,2);
      assert.equal(m.headerMembers.length,headerMode==="loft"?3:headerMode==="flat"?2:0);
      for(const r of [...m.kingMembers,...m.studMembers]){
        near(r.bounds.y0Ft,wall.wallStudy.bottomPlateTopYFt,"stud stands on bottom plate");
        near((r.bounds.x1Ft-r.bounds.x0Ft)*12,1.5,"upright width");near(r.depthFt*12,3.5,"upright depth");
        assert.deepEqual(r.grainAxis,[0,1,0]);
      }
      for(const r of m.kingMembers){near(r.lengthFt*12,cut,"king length");near(r.bounds.y1Ft,s.headerBottomYFt,"king meets header or plate");}
      for(const r of m.studMembers){near(r.lengthFt*12,wallCut,"full-height neighbor");near(r.bounds.y1Ft,wall.wallStudy.studTopYFt,"stud touches top plate");}
      if(height){
        const lower=m.headerMembers[0].bounds;
        near((s.x0Ft-lower.x0Ft)*12,1.5,"left bearing");near((lower.x1Ft-s.x1Ft)*12,1.5,"right bearing");
        near(lower.x0Ft,m.kingMembers[0].bounds.x0Ft,"left full bearing");near(lower.x1Ft,m.kingMembers[1].bounds.x1Ft,"right full bearing");
        near(lower.y0Ft,s.headerBottomYFt,"header sits on kings");
        for(const r of m.headerMembers)near(r.lengthFt*12,widthIn+3,"variable header cut");
        for(const r of m.headerMembers.slice(1))near(r.bounds.y0Ft,lower.y1Ft,"boards stack without gap");
        if(headerMode==="loft"){
          const a=m.headerMembers[1].bounds,b=m.headerMembers[2].bounds;
          near((a.z0Ft-lower.z0Ft)*12,.5,"outside ledge");near(a.z1Ft,b.z0Ft,"edge boards touch");near(b.z1Ft,lower.z1Ft,"flush inside");
        }else for(const r of m.headerMembers){near(r.widthFt*12,1.5,"flat height");near(r.depthFt*12,3.5,"flat depth");}
      }else{assert.equal(s.headerCutIn,null);near(s.headerBottomYFt,wall.wallStudy.studTopYFt,"to-plate contact");}
      for(let i=0;i<m.members.length;i++)for(let j=i+1;j<m.members.length;j++){
        const a=m.members[i].bounds,b=m.members[j].bounds;
        assert.ok(!["x","y","z"].every(axis=>Math.min(a[axis+"1Ft"],b[axis+"1Ft"])-Math.max(a[axis+"0Ft"],b[axis+"0Ft"])>1e-8),"no solid overlap");
      }
      const upper=m.plateMembers[2].bounds;
      assert.ok(upper.x0Ft>=wall.wallStudy.upperPlateRange.u0-1e-8&&upper.x1Ft<=wall.wallStudy.upperPlateRange.u1+1e-8,"upper setback retained");
      for(const plates of [false,true]){
        const build=doorwayDrawing(plan,m,{plates}),finish=woodFinish(build,{doorway:m});
        near(signature(build).length,(plates?m.members:m.frameMembers).length*12,"mesh follows pieces");
        assert.deepEqual(signature(finish),signature(build),"finish preserves positions normals and stages");
        assert.ok(finish.ORDER.every(k=>finish.buckets[k].tex.startsWith("lessonWood")),"all boards textured");
      }
    }
  }
  assert.equal(JSON.stringify(wall),before,"source wall unchanged");
}
for(const widthIn of [0,-1,NaN,Infinity,115])assert.throws(()=>doorwayStudyPlan(baseline,{widthIn,kingCutIn:70}));
for(const kingCutIn of [0,-1,NaN,Infinity,70.25])assert.throws(()=>doorwayStudyPlan(baseline,{widthIn:36,kingCutIn}));
assert.throws(()=>doorwayStudyPlan(baseline,{widthIn:36,kingCutIn:72.25,headerMode:"flat"}));
assert.throws(()=>doorwayStudyPlan(baseline,{widthIn:36,kingCutIn:70,headerMode:"guessed"}));
const bad=structuredClone(baseline);bad.construction.doorwayLesson.bearingEachEndIn=.75;
assert.throws(()=>doorwayStudyPlan(bad,{widthIn:36,kingCutIn:70}));
console.log("PROVED: shop king studs, variable header cuts and bearing, three arrangements, bottom/top contacts, wall-height reuse, fit rejection, plate setbacks, no overlaps and unchanged mesh after wood finish.");
