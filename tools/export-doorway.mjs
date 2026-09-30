/* Exact doorway meshes and browser wood pixels for the phone renderer.
   Run this, then render-joist-picture.py --doorway loft|flat|to-plate. */
import {mkdirSync,writeFileSync} from "node:fs";
import {loadCatalogue} from "./lib/load.mjs";
import {defaults} from "../model/design.js";
import {makePlan} from "../model/plan.js";
import {floorStudyPlan} from "../model/floor-study.js";
import {wallStudyPlan} from "../model/wall-study.js";
import {doorwayStudyPlan,doorwayMeasurements,doorwayDrawing} from "../model/doorway-study.js";
import {woodFinish,floorWoodTexture} from "../ui/learn-wood.js";

const cat=loadCatalogue("learning-side-loft"),raw=cat.construction.doorwayLesson;
const wall=wallStudyPlan(floorStudyPlan(makePlan(defaults(cat),cat)),{wall:"end"});
const availableIn=(wall.wallStudy.studTopYFt-wall.wallStudy.bottomPlateTopYFt)*12;
mkdirSync(new URL("../test/out/",import.meta.url),{recursive:true});
for(const headerMode of ["loft","flat","to-plate"]) {
  const height=headerMode==="loft"?raw.depthIn+raw.thicknessIn:headerMode==="flat"?2*raw.thicknessIn:0;
  const plan=doorwayStudyPlan(wall,{widthIn:raw.exampleWidthIn,kingCutIn:availableIn-height,headerMode});
  const doorway=doorwayMeasurements(plan),build=woodFinish(doorwayDrawing(plan,doorway),{doorway}),groups=[],textures={};
  for(const key of build.ORDER) {
    const b=build.buckets[key],triangles=[];
    for(const tag of build.tags[key]||[])for(let t=tag.from;t<tag.from+tag.count;t++){
      const v=b.v.slice(t*27,t*27+27);
      triangles.push({part:tag.part,positions:[0,9,18].map(i=>v.slice(i,i+3)),
        normals:[0,9,18].map(i=>v.slice(i+3,i+6)),uv:[0,9,18].map(i=>v.slice(i+6,i+8)),stage:v[8]});
    }
    groups.push({key,material:{tint:b.tint,tintSpace:"linear",texture:b.tex},triangles});
    if(!textures[b.tex]){
      const tx=floorWoodTexture(b.tex),file=b.tex+".rgba";
      writeFileSync(new URL("../test/out/"+file,import.meta.url),tx.pixels);
      textures[b.tex]={width:tx.width,height:tx.height,file};
    }
  }
  writeFileSync(new URL(`../test/out/doorway-${headerMode}-render-data.json`,import.meta.url),
    JSON.stringify({units:"feet",groups,textures,metadata:{doorway}},null,2)+"\n");
  console.log(`Exported ${headerMode}: ${raw.exampleWidthIn} in opening, ${plan.doorwayStudy.kingCutIn} in king studs.`);
}
