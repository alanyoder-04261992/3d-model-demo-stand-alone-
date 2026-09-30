/* Export the current lesson mesh for a deterministic static illustration.
   Run: node tools/export-joist-render-data.mjs [--deck | --wall | --end-wall | --gable | --truss]
   Writes test/out/joist-render-data.json (ignored intermediate).
   Then: python tools/render-joist-picture.py
   With --deck: writes flooring-render-data.json instead; render with
   python tools/render-joist-picture.py --deck for the flooring PNGs.
   Python needs Pillow and NumPy as development-only rendering dependencies;
   the website itself still has no runtime dependencies or build step. */
import { mkdirSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import { loadCatalogue } from "./lib/load.mjs";
import { defaults } from "../model/design.js";
import { makePlan } from "../model/plan.js";
import { floorStudyPlan } from "../model/floor-study.js";
import { floorMeasurements } from "../model/floor-measurements.js";
import { wallStudyPlan } from "../model/wall-study.js";
import { wallStudyMeasurements } from "../model/wall-measurements.js";
import { gableStudyPlan } from "../model/gable-study.js";
import { gableStudyMeasurements } from "../model/gable-measurements.js";
import { trussStudyPlan } from "../model/truss-study.js";
import { trussStudyMeasurements } from "../model/truss-measurements.js";
import { assemble, onlyParts } from "../engine/assemble.js";
import { woodFinish, floorWoodTexture } from "../ui/learn-wood.js";
import { flooringFinish, flooringTexture } from "../ui/learn-flooring.js";

const cat=loadCatalogue("learning-side-loft");
const windowArg=process.argv.find(arg=>arg.startsWith("--window="))?.split("=")[1];
const windowSize=windowArg?.split("x").map(Number);
if(windowSize && (windowSize.length!==2 || !windowSize.every(n=>Number.isFinite(n)&&n>0))) throw new Error("Use --window=WIDTHxHEIGHT in inches.");
const withTruss=process.argv.includes("--truss") || Boolean(windowSize);
const withGable=process.argv.includes("--gable") || withTruss;
const withWall=process.argv.includes("--wall") || process.argv.includes("--end-wall") || withGable;
const wallType=process.argv.includes("--end-wall") || withGable?"end":"side";
const withDeck=process.argv.includes("--deck") || withWall;
const selectedParts=["skids","floor-frame",...(withDeck ? ["floor-deck"] : []),...(withWall?["wall-frame"]:[]),...(withGable?["gable-frame"]:[]),...(withTruss?["roof-frame","gable-backing","gable-window-frame"]:[])];
const floorPlan=floorStudyPlan(makePlan(defaults(cat),cat));
const wallPlan=withWall?wallStudyPlan(floorPlan,{wall:wallType}):floorPlan;
const gablePlan=withGable?gableStudyPlan(wallPlan,{gable:true}):wallPlan;
const plan=withTruss?trussStudyPlan(gablePlan,{truss:true,windowOpening:windowSize?{kind:"window",widthIn:windowSize[0],heightIn:windowSize[1]}:null}):gablePlan;
const measurements={...floorMeasurements(plan),...(withWall?{wall:wallStudyMeasurements(plan)}:{}),...(withGable?{gable:gableStudyMeasurements(plan)}:{}),...(withTruss?{truss:trussStudyMeasurements(plan)}:{})};
const original=assemble(plan,{frames:true,scene:"studio",trueColour:true}).build;
const isolated=onlyParts(original,selectedParts);
const build=flooringFinish(woodFinish(isolated,measurements),measurements);
function geometrySignature(drawing) {
  const triangles=[];
  for(const key of drawing.ORDER) for(const tag of drawing.tags[key] || []) {
    const v=drawing.buckets[key].v;
    for(let t=tag.from;t<tag.from+tag.count;t++) {
      const values=[tag.part];
      for(let vertex=0;vertex<3;vertex++) {
        const i=t*27+vertex*9;
        values.push(...v.slice(i,i+6),v[i+8]);
      }
      triangles.push(JSON.stringify(values));
    }
  }
  return triangles.sort();
}
assert.deepEqual(geometrySignature(build),geometrySignature(isolated),
  "surface finish preserves every actual position, normal and stage in the exported mesh");
const modelBounds={x0:Infinity,y0:Infinity,z0:Infinity,x1:-Infinity,y1:-Infinity,z1:-Infinity};
const partCounts={};
const groups=[];
const textures={};
mkdirSync(new URL("../test/out/",import.meta.url),{recursive:true});
for(const key of build.ORDER) {
  const bucket=build.buckets[key];
  if(!bucket.n) continue;
  const group={key,material:{tint:bucket.tint,tintSpace:"linear",texture:bucket.tex,
    spec:bucket.spec,gloss:bucket.gloss,bump:bucket.bump,glow:bucket.glow},triangles:[]};
  if(!textures[bucket.tex]) {
    const texture=floorWoodTexture(bucket.tex) || flooringTexture(bucket.tex);
    if(texture) {
      const filename=bucket.tex+".rgba";
      writeFileSync(new URL("../test/out/"+filename,import.meta.url),texture.pixels);
      textures[bucket.tex]={width:texture.width,height:texture.height,file:filename};
    }
  }
  for(const tag of build.tags[key] || []) for(let t=tag.from;t<tag.from+tag.count;t++) {
    assert.ok(selectedParts.includes(tag.part));
    const offset=t*27,positions=[],normals=[],uv=[];
    for(let vertex=0;vertex<3;vertex++) {
      const i=offset+vertex*9;
      const p=bucket.v.slice(i,i+3);
      positions.push(p); normals.push(bucket.v.slice(i+3,i+6)); uv.push(bucket.v.slice(i+6,i+8));
      for(let axis=0;axis<3;axis++) {
        const letter=["x","y","z"][axis];
        modelBounds[letter+"0"]=Math.min(modelBounds[letter+"0"],p[axis]);
        modelBounds[letter+"1"]=Math.max(modelBounds[letter+"1"],p[axis]);
      }
    }
    group.triangles.push({part:tag.part,positions,normals,uv,stage:bucket.v[offset+8]});
    partCounts[tag.part]=(partCounts[tag.part] || 0)+1;
  }
  groups.push(group);
}
const joist=measurements.frame.joist;
const support=measurements.supports.runs.find((run)=>run.xFt>0);
const notch=support.notches.find((cut)=>cut.z0Ft<=joist.bounds.z0Ft+1e-9 && cut.z1Ft>=joist.bounds.z1Ft-1e-9);
assert.ok(notch,"the representative floor joist must have a supporting notch");
assert.ok(Math.abs(joist.bounds.y0Ft-notch.seatYFt)<1e-9,"the joint must touch at the notch seat");
assert.equal(partCounts["floor-frame"],measurements.frame.members.length*12);
const output={
  schemaVersion:1,units:"feet",coordinateAxes:{x:"across building width",y:"up",z:"along skid length"},
  source:`Current learning-side-loft plan: ${selectedParts.join(", ")}; exact assembly vertices.`,
  renderingNote:"Lesson timber and flooring material tints, UVs and seeded texture pixels retained. This is mesh data, not a browser capture.",
  modelBounds,partCounts,groups,textures,
  metadata:{nominal:measurements.nominal,status:plan.floorStudy.status,
    supports:measurements.supports,regularJoists:measurements.frame.joists,
    ...(withDeck ? {deck:measurements.deck} : {}),
    ...(withWall ? {wall:measurements.wall} : {}),
    ...(withGable ? {gable:measurements.gable} : {}),
    ...(withTruss ? {truss:measurements.truss} : {}),
    frame:{count:measurements.frame.joists.length,nominalJoist:measurements.frame.nominalJoist,
      members:measurements.frame.members,bounds:measurements.frame.bounds,
      outerBoards:measurements.frame.rims,
      endBoards:measurements.frame.members.filter(record=>record.member.kind==="end-joist"),
      backing:measurements.frame.members.find(record=>record.member.kind==="end-backing") || null,
      spacingFt:measurements.frame.spacingFt,spacingPairs:measurements.frame.spacingPairs},
    joint:{joist,skid:support,notch,anchors:{
      joistTop:[joist.center[0],joist.bounds.y1Ft,joist.center[2]],
      skidTop:[support.x1Ft,notch.topYFt,notch.z1Ft+.06],
      occupiedSeat:[support.x1Ft,notch.seatYFt,notch.centerZFt],
      joistAtSkidTop:[support.x1Ft,joist.bounds.y1Ft,joist.center[2]],
    }},
  },
};
const file=new URL(`../test/out/${windowSize?"window-"+windowArg:withTruss ? "truss" : withGable ? "gable" : withWall ? wallType+"-wall" : withDeck ? "flooring" : "joist"}-render-data.json`,import.meta.url);
mkdirSync(new URL("../test/out/",import.meta.url),{recursive:true});
writeFileSync(file,JSON.stringify(output,null,2)+"\n");
console.log(JSON.stringify({file:file.pathname,groups:groups.length,partCounts,modelBounds,
  joists:measurements.frame.joists.length,occupiedNotchZ:notch.centerZFt,seatHeightIn:notch.seatYFt*12}));
