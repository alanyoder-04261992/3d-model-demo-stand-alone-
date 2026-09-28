/* Export the current lesson mesh for a deterministic static illustration.
   Run: node tools/export-joist-render-data.mjs
   Writes test/out/joist-render-data.json (ignored intermediate).
   Then: python tools/render-joist-picture.py
   Python needs Pillow and NumPy as development-only rendering dependencies;
   the website itself still has no runtime dependencies or build step. */
import { mkdirSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import { loadCatalogue } from "./lib/load.mjs";
import { defaults } from "../model/design.js";
import { makePlan } from "../model/plan.js";
import { floorStudyPlan } from "../model/floor-study.js";
import { floorMeasurements } from "../model/floor-measurements.js";
import { onlyFloorJoists } from "../model/floor-joist-lesson.js";
import { assemble, onlyParts } from "../engine/assemble.js";
import { woodFinish } from "../ui/learn-wood.js";

const cat=loadCatalogue("learning-side-loft");
const plan=floorStudyPlan(makePlan(defaults(cat),cat));
const measurements=floorMeasurements(plan);
const original=assemble(plan,{frames:true,scene:"studio",trueColour:true}).build;
const isolated=onlyFloorJoists(onlyParts(original,["skids","floor-frame"]),measurements);
const build=woodFinish(isolated,measurements);
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
for(const key of build.ORDER) {
  const bucket=build.buckets[key];
  if(!bucket.n) continue;
  const group={key,material:{tint:bucket.tint,tintSpace:"linear",texture:bucket.tex,
    spec:bucket.spec,gloss:bucket.gloss,bump:bucket.bump,glow:bucket.glow},triangles:[]};
  for(const tag of build.tags[key] || []) for(let t=tag.from;t<tag.from+tag.count;t++) {
    assert.ok(["skids","floor-frame"].includes(tag.part));
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
assert.equal(partCounts["floor-frame"],measurements.frame.joists.length*12);
const output={
  schemaVersion:1,units:"feet",coordinateAxes:{x:"across building width",y:"up",z:"along skid length"},
  source:"Current learning-side-loft plan, only skids and regular floor joists; exact assembly vertices.",
  renderingNote:"woodFinish material tint and UVs retained; procedural texture images are not included. This is mesh data, not a browser capture.",
  modelBounds,partCounts,groups,
  metadata:{nominal:measurements.nominal,status:plan.floorStudy.status,
    supports:measurements.supports,regularJoists:measurements.frame.joists,
    frame:{count:measurements.frame.joists.length,nominalJoist:measurements.frame.nominalJoist,
      spacingFt:measurements.frame.spacingFt,spacingPairs:measurements.frame.spacingPairs},
    joint:{joist,skid:support,notch,anchors:{
      joistTop:[joist.center[0],joist.bounds.y1Ft,joist.center[2]],
      skidTop:[support.x1Ft,notch.topYFt,notch.z1Ft+.06],
      occupiedSeat:[support.x1Ft,notch.seatYFt,notch.centerZFt],
      joistAtSkidTop:[support.x1Ft,joist.bounds.y1Ft,joist.center[2]],
    }},
  },
};
const file=new URL("../test/out/joist-render-data.json",import.meta.url);
mkdirSync(new URL("../test/out/",import.meta.url),{recursive:true});
writeFileSync(file,JSON.stringify(output,null,2)+"\n");
console.log(JSON.stringify({file:file.pathname,groups:groups.length,partCounts,modelBounds,
  joists:measurements.frame.joists.length,occupiedNotchZ:notch.centerZFt,seatHeightIn:notch.seatYFt*12}));
