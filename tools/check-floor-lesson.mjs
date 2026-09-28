/* CHECK: the manual floor lesson starts with visible supports, and every
   selection contains only its original floor-part triangles.
   Run: node tools/check-floor-lesson.mjs                 (check-all: node)
   Browser checks cover controls, camera fitting and on-model labels. */
import assert from "node:assert/strict";
import { loadCatalogue } from "./lib/load.mjs";
import { defaults } from "../model/design.js";
import { makePlan } from "../model/plan.js";
import { assemble, onlyParts } from "../engine/assemble.js";
import { STAGE_ID } from "../parts/stages.js";
import { initialFloorSelection, floorParts, floorPiece } from "../model/floor-lesson.js";
import { floorMeasurements, formatInches, formatFeetInches } from "../model/floor-measurements.js";
import { floorStudyPlan } from "../model/floor-study.js";
import { skidStudyMembers } from "../parts/skids.js";

const choices = ["supports", "frame", "deck"];
const parts = ["skids", "floor-frame", "floor-deck"];
const allowedStages = new Map(parts.map((part) => [part, STAGE_ID[part]]));
const catalogue = loadCatalogue("learning-side-loft");
const plan = makePlan(defaults(catalogue), catalogue);
assert.equal(plan.state.type, "SLB");
assert.equal(plan.state.size, "10x16");
const source = assemble(plan, { frames: true }).build;
const original = JSON.stringify(source);

for (const step of [undefined, null, "", "roof", "wall-frame", "__proto__", "<img src=x>"])
  assert.deepEqual(initialFloorSelection(step), ["supports"], "a missing or invalid starting step shows supports only");
for (const step of choices) assert.deepEqual(initialFloorSelection(step), [step]);
assert.deepEqual(floorParts(["roof", "deck", "supports", "supports", "wall-frame", "__proto__"]), ["skids", "floor-deck"]);
assert.deepEqual(floorParts("supports"), [], "non-array selection cannot bypass the part allowlist");
assert.equal(floorPiece(["supports", "frame"], "frame").key, "frame");
assert.equal(floorPiece(["supports"], "deck").key, "supports", "a hidden piece cannot describe the visible selection");
assert.equal(floorPiece([], "supports"), null);

let triangleChecks = 0;
for (let mask = 0; mask < 8; mask++) {
  const selection = choices.filter((_, index) => mask & (1 << index));
  const expectedParts = parts.filter((_, index) => mask & (1 << index));
  assert.deepEqual(floorParts(selection), expectedParts);
  const filtered = onlyParts(source, floorParts(selection));
  assert.deepEqual(filtered.hitQuads, [], "isolated floor pieces cannot expose hidden door/window hit targets");
  const found = new Set();
  for (const key of source.ORDER) {
    const expected = [];
    for (const segment of source.tags[key] || []) {
      if (!expectedParts.includes(segment.part)) continue;
      for (let index = segment.from * 27; index < (segment.from + segment.count) * 27; index++) expected.push(source.buckets[key].v[index]);
    }
    const bucket = filtered.buckets[key];
    assert.deepEqual(bucket.v, expected, `${selection.join("+") || "empty"}: ${key} preserves every selected source triangle`);
    assert.equal(bucket.n * 9, expected.length);
    for (const segment of filtered.tags[key] || []) {
      assert.ok(expectedParts.includes(segment.part), "a non-floor part must never enter the lesson");
      if (segment.count) found.add(segment.part);
      for (let triangle = segment.from; triangle < segment.from + segment.count; triangle++) {
        for (let vertex = 0; vertex < 3; vertex++) {
          const offset = triangle * 27 + vertex * 9;
          assert.equal(bucket.v[offset + 8], allowedStages.get(segment.part), "the frame renderer must receive the piece's actual visible stage");
          for (let axis = 0; axis < 3; axis++) assert.ok(Number.isFinite(bucket.v[offset + axis]));
        }
        triangleChecks++;
      }
    }
  }
  assert.deepEqual([...found].sort(), expectedParts.slice().sort(), "every selected piece has visible geometry; no wall, roof or finished slab is included");
}
assert.equal(JSON.stringify(source), original, "switching lesson pieces cannot alter the shared building geometry");

// Measure actual rendered vertices independently of the measurement helper.
function geometryBounds(build, part) {
  const result = { x0Ft: Infinity, y0Ft: Infinity, z0Ft: Infinity,
    x1Ft: -Infinity, y1Ft: -Infinity, z1Ft: -Infinity };
  for (const key of build.ORDER) for (const segment of build.tags[key] || []) {
    if (segment.part !== part) continue;
    const vertices = build.buckets[key].v;
    for (let index = segment.from * 27; index < (segment.from + segment.count) * 27; index += 9) {
      for (const [axis, coordinate] of ["x", "y", "z"].map((axis, coordinate) => [axis, coordinate])) {
        result[axis + "0Ft"] = Math.min(result[axis + "0Ft"], vertices[index + coordinate]);
        result[axis + "1Ft"] = Math.max(result[axis + "1Ft"], vertices[index + coordinate]);
      }
    }
  }
  return result;
}
function near(actual, expected, label) {
  assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) < 1e-9,
    `${label}: expected ${expected}, received ${actual}`);
}
function matchesBounds(measured, rendered, label) {
  for (const axis of ["x", "y", "z"]) for (const end of [0, 1]) {
    const key = axis + end + "Ft";
    near(measured[key], rendered[key], label + " " + key);
  }
}
const planBefore = JSON.stringify(plan);
const measurements = floorMeasurements(plan);
assert.equal(JSON.stringify(plan), planBefore, "reading measurements cannot change the design or construction settings");
assert.deepEqual(measurements.nominal, { widthFt: 10, lengthFt: 16 });
matchesBounds(measurements.supports, geometryBounds(source, "skids"), "support envelope matches rendered mesh");
matchesBounds(measurements.frame.bounds, geometryBounds(source, "floor-frame"), "frame envelope matches rendered mesh");
near(measurements.supports.lengthFt, 16.14, "legacy support length includes both ends beyond the inset floor");
near(measurements.supports.z0Ft, -8.07, "back support end");
near(measurements.supports.z1Ft, 8.07, "front support end");
near(measurements.supports.widthFt * 12, 6, "drawn support width, not nominal lumber width");
near(measurements.supports.depthFt * 12, 6, "drawn support depth, not nominal lumber depth");
assert.equal(measurements.supports.nominalLumber, "4x6");
near(measurements.supports.settingsSection.widthFt * 12, 3.5, "separate settings lumber width");
near(measurements.supports.settingsSection.depthFt * 12, 5.5, "separate settings lumber depth");
assert.deepEqual(measurements.supports.xsFt, [-2.5, 2.5]);
near(measurements.supports.centerSpacingsFt[0] * 12, 60, "support center spacing");
for (const inset of measurements.supports.insetCentersFt) near(inset.nearestSideFt * 12, 30, "support center inset from nominal side");
near(measurements.frame.joist.lengthFt, 9.69, "joist fits between the two rims");
near(measurements.frame.rim.lengthFt, 15.94, "rim follows the inset floor length");
near(measurements.frame.joist.widthFt * 12, 1.5, "drawn joist thickness");
near(measurements.frame.joist.depthFt * 12, 4.415, "legacy joist drawing depth remains distinct from 2x6 settings");
assert.equal(measurements.frame.nominalJoist, "2x6");
near(measurements.frame.spacingFt * 12, 16, "measured layout spacing");
for (const pair of measurements.frame.spacingPairs) near(pair.spacingFt * 12, 16, "each regular joist pair uses the measured spacing");
near(measurements.deck.representative.acrossFt, 3.99, "representative sheet width includes the rendered seam gap");
near(measurements.deck.representative.alongFt, 7.99, "representative sheet length includes the rendered seam gap");
near(measurements.deck.thicknessFt * 12, 0.625, "actual sheet thickness");
for (const sheet of measurements.deck.sheets) {
  assert.ok(sheet.acrossFt > 0 && sheet.alongFt > 0 && sheet.thicknessFt > 0);
  for (const [x, z] of sheet.member.poly) {
    assert.ok(x >= sheet.x0Ft - 1e-9 && x <= sheet.x1Ft + 1e-9);
    assert.ok(z >= sheet.z0Ft - 1e-9 && z <= sheet.z1Ft + 1e-9);
  }
  near(sheet.topPoint[1], geometryBounds(source, "floor-deck").y1Ft, "sheet anchor is on the rendered top");
}

// A changed builder setting must change the measured model, not leave the
// teaching page displaying hard-coded 10x16 defaults.
const changedPlan = { ...plan, construction: { ...plan.construction,
  skids: { ...plan.construction.skids, table: { ...plan.construction.skids.table, 10: [20] } },
  floor: { ...plan.construction.floor, spacingIn: 12,
    deck: { ...plan.construction.floor.deck, thicknessIn: 0.75 } },
} };
const changed = floorMeasurements(changedPlan);
const changedDrawing = assemble(changedPlan, { frames: true }).build;
matchesBounds(changed.supports, geometryBounds(changedDrawing, "skids"), "changed support placement matches mesh");
matchesBounds(changed.frame.bounds, geometryBounds(changedDrawing, "floor-frame"), "changed framing matches mesh");
near(changed.supports.centerSpacingsFt[0] * 12, 80, "changed support center spacing");
near(changed.frame.spacingFt * 12, 12, "changed floor spacing");
near(changed.deck.thicknessFt * 12, 0.75, "changed deck thickness");
assert.equal(formatFeetInches(measurements.supports.lengthFt), "16 ft 1.68 in");
assert.equal(formatInches(measurements.frame.joist.depthFt), "4.42 in");
assert.equal(formatFeetInches(11.999 / 12), "1 ft", "rounded inches carry to the next foot");
assert.equal(formatFeetInches(0), "0 in");
assert.equal(formatInches(NaN), "—");

// The lesson opts in to the measured notched floor. Company settings alone
// must never change the ordinary designer or any legacy framing geometry.
const confirmedSpec = {
  skids:{nominal:"4x6",widthIn:3.5,heightIn:5.5,lengthFt:16,insetToInsideIn:30,
    bottomCuts:{reachIn:3,angleDeg:45}},
  joists:{nominal:"2x6",widthIn:1.5,heightIn:5.5,spacingIn:16},
  frame:{widthFt:10,sideBoardWidthIn:1.5,endCounts:{negative:2,positive:1},treated:true,
    backing:{nominal:"2x4",widthIn:3.5,heightIn:1.5,lengthIn:93,end:"negative",treated:true,purpose:"mule-attachment"}},
  notches:{widthIn:1.5,depthIn:1,alternateSpacingIn:12,
    endRebates:{negative:{lengthIn:3,depthIn:1},positive:{lengthIn:1.5,depthIn:1}}},
  status:{skidSection:"confirmed",skidLength:"confirmed",joistSection:"confirmed",
    standardSpacing:"confirmed",alternateSpacing:"confirmed",notchDepth:"confirmed",supportOffset:"confirmed",endRebates:"confirmed",bottomCuts:"confirmed",
    frameWidth:"confirmed",sideBoardWidth:"confirmed",joistLength:"derived",endBoardCounts:"confirmed",
    endBoardMapping:"derived",endMemberPlacement:"derived",frameTreatment:"confirmed",
    backingSection:"confirmed",backingOrientation:"confirmed",backingTreatment:"confirmed",backingLocation:"confirmed",backingLength:"confirmed",
    backingLateralPosition:"provisional",backingPurpose:"confirmed",
    notchWidth:"provisional",notchPositions:"provisional"},
};
const noStudy = structuredClone(plan);
delete noStudy.construction.floorStudy;
assert.equal(floorStudyPlan(noStudy),noStudy,"an ordinary plan is returned unchanged");
const configured = structuredClone(noStudy);
configured.construction.floorStudy=confirmedSpec;
const configuredBefore=JSON.stringify(configured);
assert.equal(JSON.stringify(assemble(configured,{frames:true}).build),original,
  "study settings alone cannot change normal finished or framing triangles");
const studyPlan=floorStudyPlan(configured);
assert.equal(JSON.stringify(configured),configuredBefore,"opting in never mutates the ordinary plan");
assert.ok(Object.isFrozen(studyPlan)&&Object.isFrozen(studyPlan.floorStudy.skids));
const studyDrawing=assemble(studyPlan,{frames:true}).build;
const study=floorMeasurements(studyPlan);
const members=skidStudyMembers(studyPlan);
assert.deepEqual(plan.construction.floorStudy.frame,confirmedSpec.frame,"the company enables the confirmed width, board counts and treatment explicitly");
const withoutBacking=structuredClone(configured);
delete withoutBacking.construction.floorStudy.frame.backing;
const withoutBackingPlan=floorStudyPlan(withoutBacking),withoutBackingMeasures=floorMeasurements(withoutBackingPlan);
assert.deepEqual(study.frame.members.filter((record)=>record.member.kind!=="end-backing"),withoutBackingMeasures.frame.members,
  "adding the flat backing board changes none of the existing floor boards");
assert.equal(withoutBackingMeasures.frame.backing,null,"the added board is opt-in only");
assert.deepEqual(onlyParts(studyDrawing,"skids"),onlyParts(assemble(withoutBackingPlan,{frames:true}).build,"skids"),
  "the flat backing board adds no notch and changes no skid triangle");
const priorFrame=structuredClone(configured);
delete priorFrame.construction.floorStudy.frame;
const priorPlan=floorStudyPlan(priorFrame),priorMeasures=floorMeasurements(priorPlan);
const priorDrawing=assemble(priorPlan,{frames:true}).build;
assert.deepEqual(onlyParts(studyDrawing,"skids"),onlyParts(priorDrawing,"skids"),
  "changing frame width and end counts preserves every skid triangle, notch, material and stage");
assert.deepEqual(study.supports.notches,priorMeasures.supports.notches,
  "the complete repeated-notch grid and first offset are unchanged");
assert.deepEqual(study.frame.joists.map((record)=>record.center[2]),priorMeasures.frame.joists.map((record)=>record.center[2]),
  "widening the frame cannot move the regular joist Z centers");
near(study.frame.rim.lengthFt,priorMeasures.frame.rim.lengthFt,"existing long-board length is still provisional and unchanged");
assert.equal(priorMeasures.frame.endGroups.negative.count,1,"a 3in cut never creates an extra board without an explicit count");
assert.equal(priorMeasures.frame.endGroups.positive.count,1);
assert.deepEqual(plan.construction.floorStudy.skids.bottomCuts,{reachIn:3,angleDeg:45},"the learning company opts in to both confirmed bottom cuts");
assert.equal(study.supports.bottomCuts.length,4,"two bottom cuts per skid are available to the annotation layer");
const withoutBottomCuts=structuredClone(configured);
delete withoutBottomCuts.construction.floorStudy.skids.bottomCuts;
for(const member of skidStudyMembers(floorStudyPlan(withoutBottomCuts))) {
  assert.deepEqual(member.meta.bottomCuts,[],"a study without bottom-cut dimensions keeps the prior flat bottom");
  assert.ok(member.poly.some(([z,y])=>z===-8&&y===0));
  assert.ok(member.poly.some(([z,y])=>z===8&&y===0));
}
assert.equal(members.length,measurements.supports.count,"one continuous prism per support, with no artificial segment seams");
const withoutInset=structuredClone(configured);
delete withoutInset.construction.floorStudy.skids.insetToInsideIn;
assert.deepEqual(floorMeasurements(floorStudyPlan(withoutInset)).supports.xsFt,measurements.supports.xsFt,
  "a study without the explicit inside-face datum retains the old support positions");
near(study.supports.centerSpacingsFt[0]*12,63.5,"inside-face datum gives 63.5in between centres on a 10ft width");
for(const inset of study.supports.insetCentersFt) {
  near(inset.nearestInsideFaceFt*12,30,"outside wall to inside skid face");
  near(inset.nearestSideFt*12,28.25,"outside wall to skid centre is 28.25in");
}
// Independent of the readout helper: the prism definition has the correct
// inner face. The rendered triangles are checked separately below.
for(const member of members) {
  const insideFace=member.meta.xFt<0 ? member.origin[0]+member.t : member.origin[0];
  near((plan.W/2-Math.abs(insideFace))*12,30,"actual inner prism face is 30in from the outside wall");
}
matchesBounds(study.supports,geometryBounds(studyDrawing,"skids"),"measured support envelope");
matchesBounds(study.frame.bounds,geometryBounds(studyDrawing,"floor-frame"),"measured frame envelope");
for(const run of study.supports.runs) {
  near(run.lengthFt,16,"confirmed exact support length");
  near(run.widthFt*12,3.5,"confirmed support width");
  near(run.depthFt*12,5.5,"confirmed support height");
  near(run.z0Ft,-8,"support back at exact 16ft length"); near(run.z1Ft,8,"support front at exact 16ft length");
  assert.equal(run.bottomCuts.length,2,"both bottom corners are cut across each timber's width");
  for(const cut of run.bottomCuts) {
    near(cut.reachFt*12,3,"confirmed 3in reach from each end");
    near(cut.riseFt*12,3,"45-degree slope gives a 3in rise");
    near(cut.angleDeg,45,"confirmed bottom-cut angle");
    near(Math.abs(cut.startZFt-cut.tipZFt),cut.reachFt,"bottom cut starts the measured distance inward from its tip");
    near(cut.tipZFt,cut.end==="negative"?run.z0Ft:run.z1Ft,"cut ends at the original skid tip");
    near(cut.bottomYFt,0,"bottom cut starts at the original underside");
    near(cut.tipYFt,3/12,"bottom of the tip rises 3in");
    near(study.supports.notchSeatYFt-cut.tipYFt,1.5/12,"1.5in of vertical tip remains below the open notch seat");
  }
  assert.ok(run.notches.some((cut)=>cut.sources.includes("standard")&&cut.sources.includes("alternate")),"coincident 12in/16in cuts merge");
  assert.ok(run.notches.some((cut)=>cut.sources.length===1&&cut.sources[0]==="alternate"),"unused 12in-option notches remain visible");
  for(let i=0;i<run.notches.length;i++) {
    const cut=run.notches[i];
    near(cut.depthFt*12,1,"confirmed cut depth");
    near(cut.widthFt*12,cut.end==="negative"?3:1.5,cut.end?"confirmed end rebate length":"provisional width fits the board");
    near(cut.seatYFt*12,4.5,"notch seat height");
    assert.ok(cut.z0Ft>=-8&&cut.z1Ft<=8,"all cuts clipped to timber ends");
    if(i) assert.ok(cut.z0Ft>run.notches[i-1].z1Ft,"merged cuts cannot overlap or self-intersect");
  }
  assert.equal(run.notches.filter((cut)=>cut.end).length,2,"both skid tips have an open rebate");
  const negative=run.notches.find((cut)=>cut.end==="negative"),positive=run.notches.find((cut)=>cut.end==="positive");
  near(negative.z0Ft,run.z0Ft,"3in rebate starts exactly at the negative tip");
  near(positive.z1Ft,run.z1Ft,"1.5in rebate reaches exactly to the positive tip");
  assert.deepEqual(negative.sources,["end-negative"],"explicit end cut replaces the inset end-notch candidate");
  assert.deepEqual(positive.sources,["end-positive"],"narrow cut cannot silently grow to fit the old inset board");
}
const endMembers=study.frame.members.filter((record)=>record.member.kind==="end-joist");
assert.equal(endMembers.length,3,"explicit counts give two touching boards at one end and one at the other");
const positiveEnd=endMembers.find((record)=>record.member.meta.endRebate==="positive");
near(positiveEnd.bounds.z1Ft,8,"single-end board is fit-derived flush with the tip");
near(positiveEnd.bounds.z0Ft,8-1.5/12,"narrow-end board fits the exact 1.5in open seat");
assert.equal(positiveEnd.member.meta.placementStatus,"derived");
const negativeEnds=endMembers.filter((record)=>record.member.meta.endRebate==="negative").sort((a,b)=>a.center[2]-b.center[2]);
assert.equal(negativeEnds.length,2);
near(negativeEnds[0].bounds.z0Ft,-8,"double package begins at the 3in rebate's tip");
near(negativeEnds[1].bounds.z1Ft,-8+3/12,"double package ends at the 3in rebate's shoulder");
near(negativeEnds[0].bounds.z1Ft,negativeEnds[1].bounds.z0Ft,"the two boards touch with neither a gap nor solid overlap");
assert.equal(study.frame.endGroups.negative.count,2);
assert.equal(study.frame.endGroups.positive.count,1);
for(const group of Object.values(study.frame.endGroups)) {
  assert.deepEqual(group.status,{count:"confirmed",mapping:"derived",placement:"derived"});
  near(group.bounds.z1Ft-group.bounds.z0Ft,group.count*1.5/12,"group bounds measure the actual touching board package");
}
near(study.frame.widthFt*12,120,"confirmed overall frame width");
near((geometryBounds(studyDrawing,"floor-frame").x1Ft-geometryBounds(studyDrawing,"floor-frame").x0Ft)*12,120,
  "actual outer frame vertices span exactly 120in");
near(study.frame.sideBoardWidthFt*12,1.5,"each outer long board has its confirmed 1.5in thickness");
near(study.frame.joistLengthFt*12,117,"derived joist cut length is 120 minus both 1.5in outer boards");
assert.equal(study.frame.treated,true,"floor framing treatment is explicitly confirmed");
for(const record of study.frame.members.filter((record)=>!["rim","end-backing"].includes(record.member.kind))) {
  near(record.lengthFt*12,117,"every crosswise board fits the exact inside width");
  near(record.bounds.x0Ft,study.frame.rims.find((rim)=>rim.member.meta.side==="L").bounds.x1Ft,"crosswise board touches the left outer board");
  near(record.bounds.x1Ft,study.frame.rims.find((rim)=>rim.member.meta.side==="R").bounds.x0Ft,"crosswise board touches the right outer board");
}
const backing=study.frame.backing;
assert.ok(backing,"the flat reinforcement has its own measured member");
assert.equal(backing.member.kind,"end-backing");
assert.equal(backing.nominalLumber,"2x4");
assert.equal(backing.member.meta.orientation,"flat");
assert.equal(backing.member.meta.support,"skid-top");
assert.equal(backing.member.meta.treated,true);
near(backing.widthFt*12,3.5,"flat 2x4 is 3.5in wide horizontally along the skid");
near(backing.depthFt*12,1.5,"flat 2x4 is 1.5in tall");
near(backing.bounds.y0Ft*12,5.5,"backing rests on the skid top, not the 4.5in notch seat");
near(backing.bounds.y1Ft*12,7,"backing top is 7in above the original skid bottom");
near(backing.bounds.z0Ft,study.frame.endGroups.negative.bounds.z1Ft,"backing touches the inside face of the doubled end package");
near(backing.lengthFt*12,93,"confirmed mule-attachment board cut length is 93in");
near(backing.bounds.x0Ft,-3.875,"93in board is provisionally centered");
near(backing.bounds.x1Ft,3.875,"93in board is provisionally centered");
near(backing.bounds.x0Ft-study.frame.rims.find((rim)=>rim.member.meta.side==="L").bounds.x1Ft,1,"centering currently gives a derived 12in left gap");
near(study.frame.rims.find((rim)=>rim.member.meta.side==="R").bounds.x0Ft-backing.bounds.x1Ft,1,"centering currently gives a derived 12in right gap");
assert.equal(backing.member.meta.lengthStatus,"confirmed");
assert.equal(backing.member.meta.lateralPositionStatus,"provisional");
assert.equal(backing.member.meta.purpose,"mule-attachment");
assert.equal(studyPlan.floorStudy.frame.backing.lengthIn,93,"the explicit backing length comes from Alan's reply");
for(const run of study.supports.runs) assert.ok(backing.bounds.x0Ft<=run.x0Ft && backing.bounds.x1Ft>=run.x1Ft,
  "the 93in board spans and bears over both existing skids");
for(let a=0;a<study.frame.members.length;a++) for(let b=a+1;b<study.frame.members.length;b++) {
  const A=study.frame.members[a].bounds,B=study.frame.members[b].bounds;
  const overlaps=["x","y","z"].every((axis)=>Math.min(A[axis+"1Ft"],B[axis+"1Ft"])-Math.max(A[axis+"0Ft"],B[axis+"0Ft"])>1e-9);
  assert.equal(overlaps,false,"no pair of floor boards occupies the same solid space");
}
for(const record of study.frame.members.filter((record)=>record.member.kind!=="end-backing")) {
  near(record.bounds.y0Ft*12,4.5,"cross members and rims begin at the seated floor height");
  near(record.bounds.y1Ft*12,10,"full-depth joist tops are 10in above skid bottoms");
  near(record.depthFt*12,5.5,"joists are not squashed to the old finished datum");
}
near(study.frame.joist.widthFt*12,1.5,"cross-member thickness");
near(study.frame.spacingFt*12,16,"standard joist pitch from lesson data");
near(study.frame.joist.lengthFt,9.75,"117in is 9ft9in");
near(study.deck.representative.topPoint[1]*12,10.625,"deck rests on actual joist tops");
for(const sheet of study.deck.sheets) near(sheet.member.origin[1],study.frame.bounds.y1Ft,"first deck layer touches joists");
assert.equal(study.study.status.notchDepth,"confirmed");
assert.equal(study.study.status.notchWidth,"provisional");
assert.equal(study.study.status.notchPositions,"provisional");
assert.equal(study.study.status.supportOffset,"confirmed");
assert.equal(study.study.status.endRebates,"confirmed");
assert.equal(study.study.status.bottomCuts,"confirmed");
assert.equal(study.study.status.endMemberPlacement,"derived");
assert.equal(study.study.status.frameWidth,"confirmed");
assert.equal(study.study.status.sideBoardWidth,"confirmed");
assert.equal(study.study.status.joistLength,"derived");
assert.equal(study.study.status.endBoardCounts,"confirmed");
assert.equal(study.study.status.endBoardMapping,"derived");
assert.equal(study.study.status.frameTreatment,"confirmed");
for(const key of ["backingSection","backingOrientation","backingTreatment","backingLocation"])
  assert.equal(study.study.status[key],"confirmed");
assert.equal(study.study.status.backingLength,"confirmed");
assert.equal(study.study.status.backingLateralPosition,"provisional");
assert.equal(study.study.status.backingPurpose,"confirmed");
assert.equal(study.study.status.rimSection,"provisional","outer-board height/other section claims are not promoted by confirmed thickness");
assert.equal(study.study.status.supportLayout,"provisional","omitted status is never promoted to confirmed");

function trianglesFor(build,part) {
  const triangles=[];
  for(const key of build.ORDER) for(const segment of build.tags[key]||[]) {
    if(segment.part!==part) continue;
    const v=build.buckets[key].v;
    for(let i=segment.from*27;i<(segment.from+segment.count)*27;i+=27) {
      const triangle=[v.slice(i,i+3),v.slice(i+9,i+12),v.slice(i+18,i+21)];
      triangles.push(triangle);
      const normal=triangleNormal(triangle);
      for(let j=0;j<3;j++) {
        assert.equal(v[i+j*9+8],STAGE_ID.skids,"notched support retains its stage");
        for(let axis=0;axis<3;axis++) near(v[i+j*9+3+axis],normal[axis],"stored lighting normal agrees with triangle winding");
      }
    }
  }
  return triangles;
}
function triangleNormal([a,b,c]) {
  const u=b.map((v,i)=>v-a[i]),v=c.map((value,i)=>value-a[i]);
  const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
  const length=Math.hypot(...n);
  assert.ok(length>1e-10,"every skid triangle has nonzero area");
  return n.map((value)=>value/length);
}
const skidTriangles=trianglesFor(studyDrawing,"skids");
const meshCenters=[];
for(const sign of [-1,1]) {
  const xs=skidTriangles.flatMap((triangle)=>triangle.filter((p)=>Math.sign(p[0])===sign).map((p)=>p[0]));
  const lo=Math.min(...xs),hi=Math.max(...xs);
  const insideFace=sign<0?hi:lo, center=(lo+hi)/2;
  near((plan.W/2-Math.abs(insideFace))*12,30,"rendered inside face is exactly 30in from the outside wall");
  near((plan.W/2-Math.abs(center))*12,28.25,"rendered centre is 28.25in from the outside wall");
  meshCenters.push(center);
}
near((meshCenters[1]-meshCenters[0])*12,63.5,"rendered support centre spacing is 63.5in");
// Intersect vertical lines with the actual rendered triangles, independently
// of the member/notch records. A notch must have a real floor and no top cap.
function meshYAt(x,z) {
  const hits=[];
  for(const [a,b,c] of skidTriangles) {
    const den=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);
    if(Math.abs(den)<1e-12) continue;
    const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/den;
    const v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/den;
    const w=1-u-v;
    if(u>=-1e-9&&v>=-1e-9&&w>=-1e-9) hits.push(u*a[1]+v*b[1]+w*c[1]);
  }
  assert.ok(hits.length,"vertical line must intersect the support mesh");
  return {top:Math.max(...hits),bottom:Math.min(...hits)};
}
function meshTopAt(x,z) { return meshYAt(x,z).top; }
for(const run of study.supports.runs) {
  near(meshTopAt(run.xFt,run.z0Ft),4.5/12,"negative tip top is the seat, with no raised lip");
  near(meshTopAt(run.xFt,run.z1Ft),4.5/12,"positive tip top is the seat, with no raised lip");
  near(meshYAt(run.xFt,0).bottom,0,"the middle of the skid keeps its flat bottom");
  for(const fraction of [.2,.5,.8]) {
    const z=backing.bounds.z0Ft+(backing.bounds.z1Ft-backing.bounds.z0Ft)*fraction;
    near(meshTopAt(run.xFt,z),backing.bounds.y0Ft,"actual unnotched skid top contacts the flat backing board underside");
  }
  for(const cut of run.bottomCuts) {
    for(const across of [-.3,0,.3]) for(const fraction of [0,.2,.5,.8,1]) {
      const z=cut.tipZFt+(cut.startZFt-cut.tipZFt)*fraction;
      near(meshYAt(run.xFt+run.widthFt*across,z).bottom,cut.riseFt*(1-fraction),
        "actual bottom mesh slopes up toward the tip at 45 degrees across the full skid width");
    }
    const outward=cut.end==="negative"?-1:1;
    const cutFaces=skidTriangles.filter((triangle)=>{
      const center=triangle[0].map((_,axis)=>triangle.reduce((sum,p)=>sum+p[axis]/3,0));
      if(center[0]<=run.x0Ft||center[0]>=run.x1Ft) return false;
      const fromTip=Math.abs(center[2]-cut.tipZFt);
      return fromTip>1e-9&&fromTip<cut.reachFt-1e-9&&
        Math.abs(center[1]-cut.riseFt*(1-fromTip/cut.reachFt))<1e-9;
    });
    assert.equal(cutFaces.length,2,"each bottom cut is one continuous surface made from two triangles");
    for(const face of cutFaces) {
      const normal=triangleNormal(face);
      near(normal[0],0,"bottom cut has no sideways normal");
      near(normal[1],-Math.SQRT1_2,"bottom cut faces downward");
      near(normal[2],outward*Math.SQRT1_2,"bottom cut faces toward its skid tip");
    }
  }
  let previousEnd=run.z0Ft;
  for(const cut of run.notches) {
    for(const across of [-.3,0,.3]) for(const along of [.2,.5,.8]) {
      near(meshTopAt(run.xFt+run.widthFt*across,cut.z0Ft+cut.widthFt*along),cut.seatYFt,"actual notch mesh is open above its 1in-deep seat");
    }
    if(cut.z0Ft>previousEnd+1e-9) near(meshTopAt(run.xFt,(previousEnd+cut.z0Ft)/2),run.y1Ft,"wood between cuts remains full height");
    previousEnd=cut.z1Ft;
  }
  if(previousEnd<run.z1Ft) near(meshTopAt(run.xFt,(previousEnd+run.z1Ft)/2),run.y1Ft,"end wood remains full height");
  for(const record of study.frame.members.filter((record)=>["joist","end-joist","wall-joist"].includes(record.member.kind))) {
    if(run.x1Ft<=record.bounds.x0Ft||run.x0Ft>=record.bounds.x1Ft) continue;
    const cut=run.notches.find((cut)=>record.bounds.z0Ft>=cut.z0Ft-1e-9&&record.bounds.z1Ft<=cut.z1Ft+1e-9);
    assert.ok(cut,"every crosswise board has a matching cut through each supporting timber");
    near(record.bounds.y0Ft,cut.seatYFt,"board sits on the notch floor with no gap");
    for(const fraction of [.2,.5,.8]) near(meshTopAt(run.xFt,record.bounds.z0Ft+(record.bounds.z1Ft-record.bounds.z0Ft)*fraction),record.bounds.y0Ft,
      "skid solid ends at the board underside: no wood intersection");
  }
}
// A closed outward-facing mesh has the analytical timber-minus-notches volume.
const signedVolume=skidTriangles.reduce((sum,[a,b,c])=>sum+(a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6,0);
const expectedVolume=study.supports.runs.reduce((sum,run)=>sum+run.widthFt*(run.lengthFt*run.depthFt-
  run.notches.reduce((removed,cut)=>removed+cut.widthFt*cut.depthFt,0)-
  run.bottomCuts.reduce((removed,cut)=>removed+cut.reachFt*cut.riseFt/2,0)),0);
near(signedVolume,expectedVolume,"prism caps/winding enclose exactly the wood left after cutting");
for(const [key,value] of [["depthIn",5.5],["widthIn",1],["alternateSpacingIn",1]]) {
  const invalid=structuredClone(configured); invalid.construction.floorStudy.notches[key]=value;
  assert.throws(()=>floorStudyPlan(invalid),/floorStudy/);
}
for(const value of [0,-1,3,60,61,Infinity]) {
  const invalid=structuredClone(configured);invalid.construction.floorStudy.skids.insetToInsideIn=value;
  assert.throws(()=>floorStudyPlan(invalid),/floorStudy/);
}
for(const value of [0,1,192]) {
  const invalid=structuredClone(configured);invalid.construction.floorStudy.notches.endRebates.positive.lengthIn=value;
  assert.throws(()=>floorStudyPlan(invalid),/floorStudy/);
}
for(const bottomCuts of [{reachIn:0,angleDeg:45},{reachIn:3,angleDeg:0},
  {reachIn:3,angleDeg:90},{reachIn:3,angleDeg:NaN},{reachIn:4.5,angleDeg:45},
  {reachIn:96,angleDeg:1},{reachIn:Infinity,angleDeg:45}]) {
  const invalid=structuredClone(configured);invalid.construction.floorStudy.skids.bottomCuts=bottomCuts;
  assert.throws(()=>floorStudyPlan(invalid),/floorStudy/,"invalid cuts cannot erase the tip face or the flat skid bottom");
}
for(const frame of [{widthFt:0},{widthFt:11},{widthFt:10,sideBoardWidthIn:60},
  {endCounts:{negative:0}},{endCounts:{negative:1.5}},{endCounts:{negative:3}},
  {endCounts:{positive:2}}]) {
  const invalid=structuredClone(configured);invalid.construction.floorStudy.frame=frame;
  assert.throws(()=>floorStudyPlan(invalid),/floorStudy/,"invalid widths or end packages cannot erase the span or overrun a seat");
}
for(const backingChange of [{widthIn:0},{heightIn:3.5},{end:"front"},{end:"positive"},{lengthIn:118},{lengthIn:0}]) {
  const invalid=structuredClone(configured);
  Object.assign(invalid.construction.floorStudy.frame.backing,backingChange);
  assert.throws(()=>floorStudyPlan(invalid),/floorStudy/,"backing must lie flat behind the double package and fit within the outer boards");
}

console.log(`PROVED: supports-only start, all 8 manual floor selections, ${triangleChecks} legacy triangles preserved, 120in overall width with exact 117in joists, touching 2/1 end-board packages, flat treated 2x4 backing on the unnotched skid tops, no overlaps, unchanged prior members/skid mesh/notch grid, open rebates and bottom cuts, deck fit, and ordinary geometry unchanged.`);
