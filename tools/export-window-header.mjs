/* Export the exact isolated header mesh and the same wood pixels as the
   browser. Run node tools/export-window-header.mjs, then render with
   python tools/render-joist-picture.py --header.
   Use --plate here, then --window-plate on the Python renderer for the
   lower assembly's phone picture. */
import {mkdirSync,writeFileSync} from "node:fs";
import {loadCatalogue} from "./lib/load.mjs";
import {defaults} from "../model/design.js";
import {makePlan} from "../model/plan.js";
import {floorStudyPlan} from "../model/floor-study.js";
import {wallStudyPlan} from "../model/wall-study.js";
import {windowHeaderStudyPlan,windowHeaderMeasurements,windowHeaderDrawing} from "../model/window-header-study.js";
import {windowPlateStudyPlan,windowPlateMeasurements,windowFramingDrawing} from "../model/window-plate-study.js";
import {woodFinish,floorWoodTexture} from "../ui/learn-wood.js";

const cat=loadCatalogue("learning-side-loft");
const wall=wallStudyPlan(floorStudyPlan(makePlan(defaults(cat),cat)),{wall:"end"});
const withPlate=process.argv.includes("--plate");
const headerPlan=windowHeaderStudyPlan(wall,{lengthIn:cat.construction.windowHeader.exampleLengthIn});
const plan=withPlate?windowPlateStudyPlan(headerPlan,{lengthIn:cat.construction.windowHeader.exampleLengthIn,
  clearHeightIn:cat.construction.windowPlateLesson.exampleClearHeightIn}):headerPlan;
const header=windowHeaderMeasurements(plan),windowPlate=withPlate?windowPlateMeasurements(plan):null;
const measurements={header,...(windowPlate?{windowPlate}:{})},groups=[],textures={};
const build=woodFinish(withPlate?windowFramingDrawing(plan,measurements):windowHeaderDrawing(plan,header),measurements);
mkdirSync(new URL("../test/out/",import.meta.url),{recursive:true});
for(const key of build.ORDER) {
  const b=build.buckets[key],triangles=[];
  for(const tag of build.tags[key]||[]) for(let t=tag.from;t<tag.from+tag.count;t++) {
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
writeFileSync(new URL("../test/out/"+(withPlate?"window-plate":"header")+"-render-data.json",import.meta.url),
  JSON.stringify({units:"feet",groups,textures,metadata:measurements},null,2)+"\n");
console.log(withPlate?"Exported flat window plate, wall-layout studs and bottom-plate portion."
  :"Exported header: three boards, two plate portions; 5 in high, half-inch outside ledge.");
