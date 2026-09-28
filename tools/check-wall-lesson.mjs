/* CHECK: separate lesson walls, confirmed members, contacts and double-stud marks.
   Run: node tools/check-wall-lesson.mjs                    (check-all: node) */
import assert from "node:assert/strict";
import { loadCatalogue } from "./lib/load.mjs";
import { defaults } from "../model/design.js";
import { makePlan } from "../model/plan.js";
import { floorStudyPlan } from "../model/floor-study.js";
import { floorMeasurements } from "../model/floor-measurements.js";
import { wallStudyPlan } from "../model/wall-study.js";
import { wallStudyMeasurements } from "../model/wall-measurements.js";
import { wallFrame, wallFrameMembers } from "../parts/wall-frame.js";
import { assemble } from "../engine/assemble.js";
import { STAGE_ID } from "../parts/stages.js";
import { woodFinish } from "../ui/learn-wood.js";

const near = (a, b, label) => assert.ok(Number.isFinite(a) && Math.abs(a - b) < 1e-8, `${label}: ${a} vs ${b}`);
const cat = loadCatalogue("learning-side-loft"), ordinary = makePlan(defaults(cat), cat);
const floor = floorStudyPlan(ordinary), floorSnapshot = JSON.stringify(floor);
const floorMeasures = floorMeasurements(floor), floorDrawing = assemble(floor, { frames: true }).build;
const noWallSettings = structuredClone(ordinary);
delete noWallSettings.construction.wallStudy;
assert.deepEqual(assemble(ordinary, { frames: true }).build, assemble(noWallSettings, { frames: true }).build,
  "company wall data alone cannot alter normal finished geometry or framing");
assert.equal(wallStudyMeasurements(ordinary), null);
assert.strictEqual(wallStudyPlan(noWallSettings), noWallSettings);
assert.throws(() => wallStudyPlan(ordinary), /floor study/, "never silently use the old floor height");

function triangles(build, part) {
  const list = [];
  for (const key of build.ORDER) for (const tag of build.tags[key] || []) {
    if (tag.part !== part) continue;
    const bucket = build.buckets[key];
    for (let t = tag.from; t < tag.from + tag.count; t++)
      list.push({ values: bucket.v.slice(t * 27, t * 27 + 27), material: {
        tex: bucket.tex, tint: bucket.tint, spec: bucket.spec, gloss: bucket.gloss, bump: bucket.bump,
      } });
  }
  return list;
}
function geometry(build, part) {
  return triangles(build, part).map(triangle => JSON.stringify(triangle.values.filter((_, i) => i % 9 !== 6 && i % 9 !== 7))).sort();
}
function inside(point, b) {
  return ["x", "y", "z"].every((axis, i) => point[i] >= b[axis + "0Ft"] - 1e-8 && point[i] <= b[axis + "1Ft"] + 1e-8);
}
function volumeOf(record) {
  return ["x", "y", "z"].reduce((v, axis) => v * (record.bounds[axis + "1Ft"] - record.bounds[axis + "0Ft"]), 1);
}

for (const [wall, lengthFt, studs, pairMarks] of [["side", 16, 16, [4, 8, 12]], ["end", 10, 11, [4, 8]]]) {
  const plan = wallStudyPlan(floor, { wall }), m = wallStudyMeasurements(plan);
  const drawing = assemble(plan, { frames: true }).build;
  assert.ok(Object.isFrozen(plan) && Object.isFrozen(plan.wallStudy));
  assert.deepEqual(floorMeasurements(plan), floorMeasures, "wall study cannot modify any floor measurement");
  for (const part of ["skids", "floor-frame", "floor-deck"])
    assert.deepEqual(triangles(drawing, part), triangles(floorDrawing, part), `all ${part} vertices, UVs, normals, stages and materials stay exact`);
  assert.equal(m.wall, wall); near(m.lengthFt, lengthFt, "separate wall length");
  near(m.studLengthFt * 12, 75, "confirmed stud cut length");
  near(m.widthFt * 12, 1.5, "actual stud thickness"); near(m.depthFt * 12, 3.5, "actual wall depth");
  near(m.heightFt * 12, 79.5, "75-inch stud plus three 1.5-inch plates");
  near(m.baseYFt * 12, 10.625, "bottom plate sits on existing flooring");
  near(m.topYFt * 12, 90.125, "derived upper plate top from skid bottom");
  near(m.plates.bottom.bounds.y0Ft, floorMeasures.deck.bounds.y1Ft, "flooring-to-bottom-plate contact");
  near(m.plates.top.bounds.y1Ft, m.plates.upper.bounds.y0Ft, "top-to-upper-plate contact");
  const frameSetbackIn = wall === "side" ? 3.5 : 0;
  const upperSetbackIn = wall === "end" ? 3.5 : 0;
  near(m.nominalLengthFt, lengthFt, "nominal wall span is separate from plate cuts");
  assert.deepEqual(m.start, m.nominalStart); assert.deepEqual(m.end, m.nominalEnd);
  near(m.setbacks.frameIn, frameSetbackIn, "frame setback at each end");
  near(m.setbacks.upperPlateIn, upperSetbackIn, "upper plate setback at each end");
  near(m.frameLengthFt * 12, wall === "side" ? 185 : 120, "actual bottom/top plate length");
  near(m.upperPlateLengthFt * 12, wall === "side" ? 192 : 113, "actual upper plate length");
  for (const [name, plate] of Object.entries(m.plates)) {
    near(plate.lengthFt, lengthFt - (name === "upper" ? upperSetbackIn : frameSetbackIn) / 6, "actual plate length excludes both setbacks");
    near(plate.widthFt * 12, 3.5, "plate lies flat"); near(plate.depthFt * 12, 1.5, "plate height");
  }
  assert.equal(m.studs.length, studs); assert.equal(m.members.length, studs + 3);
  assert.deepEqual(new Set(m.members.map(record => record.kind)), new Set(["bottom-plate", "stud", "top-plate", "upper-plate"]));
  for (const stud of m.studs) {
    near(stud.lengthFt * 12, 75, "each actual stud cut");
    near(stud.bounds.y0Ft, m.plates.bottom.bounds.y1Ft, "every stud stands on bottom plate");
    near(stud.bounds.y1Ft, m.plates.top.bounds.y0Ft, "top plate rests on every stud");
  }
  for (let i = 0; i < m.members.length; i++) for (let j = i + 1; j < m.members.length; j++) {
    const a = m.members[i].bounds, b = m.members[j].bounds;
    assert.ok(["x", "y", "z"].some(axis => Math.min(a[axis + "1Ft"], b[axis + "1Ft"]) - Math.max(a[axis + "0Ft"], b[axis + "0Ft"]) <= 1e-9),
      "wall members touch without overlapping solids");
  }
  assert.deepEqual(m.doubles.map(pair => pair.markFt), pairMarks);
  const axis = wall === "side" ? "z" : "x", axisIndex = wall === "side" ? 2 : 0;
  const start = m.nominalStart[axisIndex], end = m.nominalEnd[axisIndex];
  near(end - start, lengthFt, "explicit nominal endpoints preserve the full span");
  for (const [name, plate] of Object.entries(m.plates)) {
    const setbackFt = (name === "upper" ? upperSetbackIn : frameSetbackIn) / 12;
    near(plate.bounds[axis + "0Ft"], start + setbackFt, "actual negative-end plate tip");
    near(plate.bounds[axis + "1Ft"], end - setbackFt, "actual positive-end plate tip");
  }
  const endStuds = m.studs.filter(record => record.member.meta.role === "end");
  near(endStuds[0].bounds[axis + "0Ft"], start + frameSetbackIn / 12, "start stud follows shortened frame");
  near(endStuds[1].bounds[axis + "1Ft"], end - frameSetbackIn / 12, "finish stud follows shortened frame");
  near(m.frameStart[axisIndex], m.plates.bottom.bounds[axis + "0Ft"], "frame start anchor is its physical tip");
  near(m.frameEnd[axisIndex], m.plates.bottom.bounds[axis + "1Ft"], "frame end anchor is its physical tip");
  near(m.upperPlateStart[axisIndex], m.plates.upper.bounds[axis + "0Ft"], "upper start anchor is its physical tip");
  near(m.upperPlateEnd[axisIndex], m.plates.upper.bounds[axis + "1Ft"], "upper end anchor is its physical tip");
  for (const pair of m.doubles) {
    assert.equal(pair.members.length, 2);
    const [left, right] = pair.members;
    near(left.bounds[axis + "1Ft"], right.bounds[axis + "0Ft"], "paired studs touch exactly");
    near(left.bounds[axis + "1Ft"] - start, pair.markFt, "4-foot mark is their joint");
    near(left.center[wall === "side" ? 2 : 0] - start, pair.markFt - .75 / 12, "negative-side center offset");
    near(right.center[wall === "side" ? 2 : 0] - start, pair.markFt + .75 / 12, "positive-side center offset");
    assert.equal(pair.status, "confirmed");
  }
  for (let i = 1; i < m.layoutMarks.length; i++) near(m.layoutMarks[i].markFt - m.layoutMarks[i - 1].markFt, 16 / 12, "16-inch layout mark spacing");
  assert.equal(m.status.layoutDatum, "provisional"); assert.equal(m.status.plateLengths, "derived");
  for (const key of ["frameSetbacks", "upperPlateSetbacks", "cornerLap"]) assert.equal(m.status[key], "confirmed");
  assert.equal(m.openings, "omitted-for-lesson"); assert.equal(m.corners, "separate-wall-study");
  const frame = wallFrame(plan);
  assert.equal(frame.runs.length, 1); assert.equal(frame.framed[0].frames.length, 0, "no fabricated door/window layout");
  assert.equal(frame.members.length, wallFrameMembers(plan).length);
  const uncutInput = structuredClone(floor);
  delete uncutInput.construction.wallStudy.endSetbacksIn;
  const uncut = wallStudyMeasurements(wallStudyPlan(uncutInput, { wall }));
  assert.deepEqual(m.layoutMarks, uncut.layoutMarks, "shortening board ends never shifts the global layout marks");
  assert.deepEqual(m.studs.filter(record => record.member.meta.role !== "end"),
    uncut.studs.filter(record => record.member.meta.role !== "end"), "regular and doubled studs keep all existing coordinates");
  for (const plate of Object.values(uncut.plates)) near(plate.lengthFt, lengthFt, "absent setbacks retain earlier full-length geometry");

  // Independently assign actual mesh faces, using outward normals to disambiguate
  // the shared faces of two touching pieces, and check signed solid volume.
  const wallTriangles = triangles(drawing, "wall-frame"), ownership = new Map(m.members.map(record => [record, 0]));
  let volume = 0;
  for (const triangle of wallTriangles) {
    const v = triangle.values, points = [v.slice(0, 3), v.slice(9, 12), v.slice(18, 21)], normal = v.slice(3, 6);
    const center = [0, 1, 2].map(i => points.reduce((sum, p) => sum + p[i] / 3, 0));
    const owners = m.members.filter(record => points.every(point => inside(point, record.bounds)) &&
      ["x", "y", "z"].some((axis, i) => Math.abs(normal[i]) > .9 && Math.abs(center[i] - record.bounds[axis + (normal[i] > 0 ? "1Ft" : "0Ft")]) < 1e-8));
    assert.equal(owners.length, 1, "each rendered triangle belongs to exactly one board");
    ownership.set(owners[0], ownership.get(owners[0]) + 1);
    const [a, b, c] = points, ab = b.map((value, i) => value - a[i]), ac = c.map((value, i) => value - a[i]);
    const cross = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
    assert.ok(Math.hypot(...cross) > 1e-9, "no degenerate wall triangle");
    assert.ok(cross.reduce((sum, value, i) => sum + value * normal[i], 0) > 0, "stored normal agrees with triangle winding");
    for (const i of [8, 17, 26]) assert.equal(v[i], STAGE_ID["wall-frame"]);
    volume += (a[0] * (b[1] * c[2] - b[2] * c[1]) + a[1] * (b[2] * c[0] - b[0] * c[2]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6;
  }
  for (const count of ownership.values()) assert.equal(count, 12, "every real board owns twelve triangles");
  assert.equal(wallTriangles.length, m.members.length * 12);
  near(volume, m.members.reduce((sum, record) => sum + volumeOf(record), 0), "positive closed mesh volume equals the measured timber solids");
  const finished = woodFinish(drawing, { ...floorMeasures, wall: m });
  for (const part of ["skids", "floor-frame", "floor-deck", "wall-frame"])
    assert.deepEqual(geometry(finished, part), geometry(drawing, part), "surface finish preserves positions, normals and stages");
}
// Check the physical lap between the separately modeled side and end walls.
// This proves their supplied cuts fit; it does not add a corner-stud pack.
const side = wallStudyMeasurements(wallStudyPlan(floor, { wall: "side" }));
const end = wallStudyMeasurements(wallStudyPlan(floor, { wall: "end" }));
for (const a of side.members) for (const b of end.members)
  assert.ok(["x", "y", "z"].some(axis => Math.min(a.bounds[axis + "1Ft"], b.bounds[axis + "1Ft"]) - Math.max(a.bounds[axis + "0Ft"], b.bounds[axis + "0Ft"]) <= 1e-9),
    "separate wall records fit together without inter-wall solid overlap");
near(side.plates.bottom.bounds.z0Ft, end.plates.bottom.bounds.z1Ft, "side body butts against the full end body");
near(side.plates.top.bounds.z0Ft, end.plates.top.bounds.z1Ft, "lower top-plate layer has the same butt");
near(side.plates.upper.bounds.y0Ft, end.plates.top.bounds.y1Ft, "side upper plate rests on end top plate at the corner");
const contactX = Math.min(side.plates.upper.bounds.x1Ft, end.plates.top.bounds.x1Ft) - Math.max(side.plates.upper.bounds.x0Ft, end.plates.top.bounds.x0Ft);
const contactZ = Math.min(side.plates.upper.bounds.z1Ft, end.plates.top.bounds.z1Ft) - Math.max(side.plates.upper.bounds.z0Ft, end.plates.top.bounds.z0Ft);
near(contactX * 12, 3.5, "corner lap contact width"); near(contactZ * 12, 3.5, "corner lap contact depth");
near(end.plates.upper.bounds.x1Ft, side.plates.upper.bounds.x0Ft, "end upper plate stops at side upper plate inside face");
assert.equal(JSON.stringify(floor), floorSnapshot, "both wall choices leave the source floor plan unchanged");
for (const change of [spec => spec.stud.lengthIn = null, spec => spec.spacingIn = 0,
  spec => spec.layoutOriginIn = -1, spec => spec.doubleEveryIn = 47, spec => spec.pairReference = "center",
  spec => spec.endSetbacksIn.side.frame = -1, spec => spec.endSetbacksIn.side.frame = 96,
  spec => spec.endSetbacksIn.end.upperPlate = 60])
  { const plan = structuredClone(floor); change(plan.construction.wallStudy); assert.throws(() => wallStudyPlan(plan)); }
assert.throws(() => wallStudyPlan(floor, { wall: "both" }), /sidewall or endwall/);
const taller = structuredClone(floor); taller.construction.wallStudy.stud.lengthIn = 89;
near(wallStudyMeasurements(wallStudyPlan(taller)).heightFt * 12, 93.5, "wall height is parameterized by cut length");
console.log("PROVED: confirmed wall setbacks give 185/192 in side plates and 120/113 in end plates; corner lap contacts without solid overlap; 75 in studs, unchanged global marks/floor/normal geometry, 12 outward triangles per board and material-only finishes.");
