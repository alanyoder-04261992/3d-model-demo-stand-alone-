/* CHECK: exact study flooring, stagger, trimmed row and existing joist bearing.
   Run: node tools/check-floor-deck-lesson.mjs             (check-all: node) */
import assert from "node:assert/strict";
import { loadCatalogue } from "./lib/load.mjs";
import { defaults } from "../model/design.js";
import { makePlan } from "../model/plan.js";
import { floorStudyPlan } from "../model/floor-study.js";
import { floorMeasurements } from "../model/floor-measurements.js";
import { floorFrameMembers } from "../parts/floor-frame.js";
import { assemble, onlyParts } from "../engine/assemble.js";
import { STAGE_ID } from "../parts/stages.js";

const near=(a,b,label)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<1e-9,`${label}: ${a} versus ${b}`);
const cat=loadCatalogue("learning-side-loft");
const ordinary=makePlan(defaults(cat),cat),snapshot=JSON.stringify(ordinary);
const plan=floorStudyPlan(ordinary),m=floorMeasurements(plan),deck=m.deck;
const drawing=assemble(plan,{frames:true}).build;
const withoutDeck=structuredClone(ordinary);
delete withoutDeck.construction.floorStudy.deck;
const prior=floorStudyPlan(withoutDeck),priorDrawing=assemble(prior,{frames:true}).build;
assert.deepEqual(floorFrameMembers(plan),floorFrameMembers(prior),"flooring cannot move any existing floor member or its first-position datum");
for(const part of ["skids","floor-frame"]) assert.deepEqual(onlyParts(drawing,part),onlyParts(priorDrawing,part),
  `adding flooring keeps every ${part} vertex, normal, material and stage unchanged`);
const withoutStudy=structuredClone(ordinary);
delete withoutStudy.construction.floorStudy;
assert.deepEqual(assemble(ordinary,{frames:true}).build,assemble(withoutStudy,{frames:true}).build,
  "saving flooring data alone does not change the ordinary designer or its framing");

assert.equal(deck.sheets.length,7,"seven laid pieces, not a claimed stock-sheet purchase count");
assert.equal(deck.layers,1);
assert.equal(deck.tongueAndGroove,true);
assert.equal(deck.edgeProfile,"unspecified","no unknown tongue or groove profile dimensions are invented");
assert.deepEqual(deck.rows.map((row)=>row.widthFt),[4,4,2]);
assert.deepEqual(deck.rows.map((row)=>row.sheets.map((sheet)=>sheet.alongFt)),[[8,8],[4,8,4],[8,8]]);
assert.deepEqual(deck.rows.map((row)=>row.trimmed),[false,false,true]);
assert.deepEqual(deck.rows.map((row)=>row.staggerFt),[0,4,0]);
assert.deepEqual([deck.representative.acrossFt,deck.representative.alongFt],[4,8],"representative dimensions refer to a full sheet");
assert.deepEqual([deck.stockAcrossFt,deck.stockAlongFt],[4,8]);
for(const [axis,lo,hi] of [["x",-5,5],["z",-8,8]]) {
  near(deck.bounds[axis+"0Ft"],lo,"flooring reaches the actual outer frame edge");
  near(deck.bounds[axis+"1Ft"],hi,"flooring reaches the actual outer frame edge");
  near(deck.bounds[axis+"0Ft"],m.frame.bounds[axis+"0Ft"],"deck and existing frame share their outer envelope");
  near(deck.bounds[axis+"1Ft"],m.frame.bounds[axis+"1Ft"],"deck and existing frame share their outer envelope");
}
near(deck.bounds.y0Ft*12,10,"flooring rests on the unchanged joist tops");
near(deck.bounds.y1Ft*12,10.625,"the finished flooring top is 5/8in above the joists");
let area=0;
for(const sheet of deck.sheets) {
  near(sheet.thicknessFt*12,0.625,"each sheet is exactly 5/8in thick");
  near(sheet.stockAcrossFt,4,"stock sheet width stays distinct from a trimmed piece");
  near(sheet.stockAlongFt,8,"stock sheet length stays distinct from a cut piece");
  near(sheet.cutAcrossFt,sheet.acrossFt,"cut width has no artificial visual gap removed");
  near(sheet.cutAlongFt,sheet.alongFt,"cut length has no artificial visual gap removed");
  near(sheet.member.meta.visualGapFt,0,"surface seam lines never remove physical wood");
  assert.equal(sheet.member.poly.length,4,"a simple exact rectangle represents the unspecified edge profile");
  assert.equal(sheet.tongueAndGroove,true);
  near(sheet.bounds.y0Ft,m.frame.bounds.y1Ft,"sheet bottoms contact the frame top");
  area+=sheet.acrossFt*sheet.alongFt;
}
near(area,160,"laid sheet pieces cover exactly the 10x16 floor area");
for(let i=0;i<deck.sheets.length;i++) for(let j=i+1;j<deck.sheets.length;j++) {
  const a=deck.sheets[i],b=deck.sheets[j];
  const dx=Math.min(a.x1Ft,b.x1Ft)-Math.max(a.x0Ft,b.x0Ft);
  const dz=Math.min(a.z1Ft,b.z1Ft)-Math.max(a.z0Ft,b.z0Ft);
  assert.ok(dx<=1e-9||dz<=1e-9,"physical sheets cannot overlap");
}
assert.deepEqual(deck.endJoints.map((joint)=>[joint.row,joint.zFt]),[[0,0],[1,-4],[1,4],[2,0]],
  "adjacent rows' sheet-end seams do not align");
for(const joint of deck.endJoints) {
  assert.equal(joint.supported,true,"the full butt-seam span bears on existing framing");
  assert.ok(joint.supportingJoist);
  const board=floorFrameMembers(plan).find((member)=>member.kind==="joist" &&
    Math.abs(member.p0[2]-joint.zFt)<=member.w/2+1e-9);
  assert.ok(board,"independently locate an unchanged joist beneath each sheet-end seam");
  near(joint.zFt-board.p0[2],-.03,"the existing provisional joist datum remains 0.36in from the seam");
  assert.ok(joint.zFt>board.p0[2]-board.w/2 && joint.zFt<board.p0[2]+board.w/2,
    "the seam is inside the joist top face, without silently moving its center");
}

// Read the actual renderer triangles independently of polygon/measurement
// records: top-face area, full envelope, thickness, winding and volume.
let triangleCount=0,topArea=0,volume=0;
const vertices=[];
for(const key of drawing.ORDER) for(const tag of drawing.tags[key] || []) {
  if(tag.part!=="floor-deck") continue;
  const v=drawing.buckets[key].v;
  for(let t=tag.from;t<tag.from+tag.count;t++) {
    const a=v.slice(t*27,t*27+3),b=v.slice(t*27+9,t*27+12),c=v.slice(t*27+18,t*27+21);
    const u=b.map((value,i)=>value-a[i]),w=c.map((value,i)=>value-a[i]);
    const cross=[u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0]];
    const size=Math.hypot(...cross);
    assert.ok(size>1e-10,"every floor triangle has positive area");
    if(cross[1]>0) topArea+=cross[1]/2;
    volume+=(a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6;
    for(let corner=0;corner<3;corner++) {
      const offset=t*27+corner*9;
      assert.equal(v[offset+8],STAGE_ID["floor-deck"]);
      for(let axis=0;axis<3;axis++) near(v[offset+3+axis],cross[axis]/size,"lighting normals match the actual triangle winding");
      vertices.push(v.slice(offset,offset+3));
    }
    triangleCount++;
  }
}
assert.equal(triangleCount,84,"each of the seven exact sheet solids has twelve triangles");
near(topArea,160,"actual upper mesh covers 160sqft without fake seam gaps");
near(volume,160*0.625/12,"outward sheet surfaces enclose exactly area times thickness");
for(const [axis,lo,hi] of [[0,-5,5],[1,10/12,10.625/12],[2,-8,8]]) {
  near(Math.min(...vertices.map((p)=>p[axis])),lo,"actual mesh lower extent");
  near(Math.max(...vertices.map((p)=>p[axis])),hi,"actual mesh upper extent");
}
for(const key of ["deckSheetSize","deckThickness","deckTongueAndGroove","deckStagger","deckStaggerOffset","deckOrientation","deckTrimLastRow"])
  assert.equal(plan.floorStudy.status[key],"confirmed");
assert.equal(plan.floorStudy.status.deckFootprint,"derived");
assert.equal(plan.floorStudy.status.deckEdgeProfile,"provisional");
for(const change of [{sheetWidthFt:0},{sheetLengthFt:0},{thicknessIn:0},{staggerFt:8},{layers:2},{orientation:"diagonal"},{coverage:"roof"}]) {
  const invalid=structuredClone(ordinary);Object.assign(invalid.construction.floorStudy.deck,change);
  assert.throws(()=>floorStudyPlan(invalid),/floorStudy/);
}
assert.equal(JSON.stringify(ordinary),snapshot,"reading and drawing the lesson never mutates company or plan inputs");
console.log("PROVED: seven exact 4x8-stock flooring pieces, 5/8in thick, 160sqft full coverage, 4/8/4 stagger, 2ft trimmed row, no physical gaps/overlap, supported sheet-end seams, correct normals/volume, and unchanged frame/skids/ordinary designer.");
