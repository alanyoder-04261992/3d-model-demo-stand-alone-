/* Exact utility opening meshes and wood pixels for phone PNGs. */
import {mkdirSync,writeFileSync} from "node:fs";
import {loadCatalogue} from "./lib/load.mjs";
import {defaults} from "../model/design.js";
import {makePlan} from "../model/plan.js";
import {utilityWallStudyPlan,utilityWindowStudyPlan,utilityWindowMeasurements,utilityWindowDrawing} from "../model/utility-study.js";
import {doorwayStudyPlan,doorwayMeasurements,doorwayDrawing} from "../model/doorway-study.js";
import {utilityRoofStudyPlan} from "../model/utility-roof-study.js";
import {utilityRoofMeasurements,utilityRoofDrawing} from "../model/utility-roof-measurements.js";
import {woodFinish,floorWoodTexture} from "../ui/learn-wood.js";

const cat=loadCatalogue("learning-side-loft"),raw=cat.construction.utilityStudy;
const wall=utilityWallStudyPlan(makePlan(defaults(cat),cat));
const windowPlan=utilityWindowStudyPlan(wall,{lengthIn:raw.examplePlateCutIn});
const doorPlan=doorwayStudyPlan(wall,{widthIn:cat.construction.doorwayLesson.exampleWidthIn,kingCutIn:raw.exampleKingCutIn});
const window=utilityWindowMeasurements(windowPlan),door=doorwayMeasurements(doorPlan);
const roofPlan=utilityRoofStudyPlan(wall),roof=utilityRoofMeasurements(roofPlan);
mkdirSync(new URL("../test/out/",import.meta.url),{recursive:true});
for(const [name,build,metadata] of [
  ["window",woodFinish(utilityWindowDrawing(windowPlan,window),{utilityWindow:window}),{utilityWindow:window}],
  ["door",woodFinish(doorwayDrawing(doorPlan,door),{doorway:door}),{doorway:door}],
  ["roof",woodFinish(utilityRoofDrawing(roofPlan,roof),{wall:roof.wallFinish,utilityRoof:roof}),{utilityRoof:roof}]
]) {
  const groups=[],textures={};
  for(const key of build.ORDER) {
    const b=build.buckets[key],triangles=[];
    for(const tag of build.tags[key]||[])for(let t=tag.from;t<tag.from+tag.count;t++) {
      const v=b.v.slice(t*27,t*27+27);
      triangles.push({part:tag.part,positions:[0,9,18].map(i=>v.slice(i,i+3)),
        normals:[0,9,18].map(i=>v.slice(i+3,i+6)),uv:[0,9,18].map(i=>v.slice(i+6,i+8)),stage:v[8]});
    }
    groups.push({key,material:{tint:b.tint,tintSpace:"linear",texture:b.tex},triangles});
    if(!textures[b.tex]) {
      const tx=floorWoodTexture(b.tex),file=b.tex+".rgba";
      writeFileSync(new URL("../test/out/"+file,import.meta.url),tx.pixels);
      textures[b.tex]={width:tx.width,height:tx.height,file};
    }
  }
  writeFileSync(new URL(`../test/out/utility-${name}-render-data.json`,import.meta.url),
    JSON.stringify({units:"feet",groups,textures,metadata},null,2)+"\n");
  console.log(`Exported utility ${name} from exact members.`);
}
