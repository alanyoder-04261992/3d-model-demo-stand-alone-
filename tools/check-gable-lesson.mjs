/* CHECK: the measured 2x6 above the end-wall upper plate, independently of
   the normal gable/roof. Run: node tools/check-gable-lesson.mjs (check-all: node) */
import assert from "node:assert/strict";
import { loadCatalogue } from "./lib/load.mjs";
import { defaults } from "../model/design.js";
import { makePlan } from "../model/plan.js";
import { floorStudyPlan } from "../model/floor-study.js";
import { wallStudyPlan } from "../model/wall-study.js";
import { wallStudyMeasurements } from "../model/wall-measurements.js";
import { gableStudyPlan } from "../model/gable-study.js";
import { gableStudyMeasurements } from "../model/gable-measurements.js";
import { gableStudyMembers, gableFrameMembers } from "../parts/gable-frame.js";
import { assemble } from "../engine/assemble.js";
import { STAGE_ID } from "../parts/stages.js";

const near = (a, b, label) => assert.ok(Number.isFinite(a) && Math.abs(a - b) < 1e-8, `${label}: ${a} vs ${b}`);
const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
const cat = loadCatalogue("learning-side-loft"), ordinary = makePlan(defaults(cat), cat);
const floor = floorStudyPlan(ordinary), end = wallStudyPlan(floor, { wall: "end" });
const endSnapshot = JSON.stringify(end), mBefore = wallStudyMeasurements(end);
assert.strictEqual(gableStudyPlan(ordinary), ordinary, "no implicit gable lesson");
assert.strictEqual(gableStudyPlan(end, { gable: false }), end, "explicitly disabled lesson leaves the wall alone");
assert.equal(gableStudyMeasurements(end), null);
assert.deepEqual(gableStudyMembers(end), []);
assert.throws(() => gableStudyPlan(end, { gable: "true" }), /boolean/);
assert.throws(() => gableStudyPlan(ordinary, { gable: true }), /selected end wall/);
assert.throws(() => gableStudyPlan(wallStudyPlan(floor), { gable: true }), /selected end wall/);
const noGableSettings = structuredClone(ordinary);
delete noGableSettings.construction.gableStudy;
assert.deepEqual(assemble(ordinary, { frames: true }).build, assemble(noGableSettings, { frames: true }).build,
  "company gable settings alone never alter the normal designer or normal framing");
assert.deepEqual(gableFrameMembers(ordinary), gableFrameMembers(noGableSettings));

function triangles(build, part) {
  const out = [];
  for (const key of build.ORDER) for (const tag of build.tags[key] || []) {
    if (tag.part !== part) continue;
    const bucket = build.buckets[key];
    for (let n = tag.from; n < tag.from + tag.count; n++)
      out.push({ values: bucket.v.slice(n * 27, n * 27 + 27), material: {
        tex: bucket.tex, tint: bucket.tint, spec: bucket.spec, gloss: bucket.gloss, bump: bucket.bump,
      } });
  }
  return out;
}
const plan = gableStudyPlan(end, { gable: true }), measures = gableStudyMeasurements(plan);
const board = measures.board.bounds, plate = measures.upperPlate.bounds;
assert.ok(Object.isFrozen(plan) && Object.isFrozen(plan.gableStudy) && Object.isFrozen(plan.gableStudy.range));
assert.deepEqual(wallStudyMeasurements(plan), mBefore, "adding a gable board leaves every wall member and datum exact");
assert.equal(JSON.stringify(end), endSnapshot, "source floor and wall plan was not mutated");
near(measures.lengthFt * 12, 118, "113-inch upper plate plus 2.5 inches at both cut ends");
near((board.x1Ft - board.x0Ft) * 12, 118, "actual board cut length");
near((board.y1Ft - board.y0Ft) * 12, 5.5, "2x6 stands 5.5 inches high");
near((board.z1Ft - board.z0Ft) * 12, 1.5, "2x6 has 1.5-inch thickness across plate depth");
near(board.y0Ft, plate.y1Ft, "board bears on top of upper plate");
near((plate.x0Ft - board.x0Ft) * 12, 2.5, "start projection is from the plate's actual cut face");
near((board.x1Ft - plate.x1Ft) * 12, 2.5, "end projection is from the plate's actual cut face");
near((plate.z1Ft - board.z1Ft) * 12, .5, "half-inch ledge is at the inner face, not the outside face");
near((board.z0Ft - plate.z0Ft) * 12, 1.5, "remaining outside ledge is a derived 1.5 inches");
near((mBefore.nominalStart[0] - board.x0Ft) * -12, 1, "board stops one inch inside the full wall's start");
near((mBefore.nominalEnd[0] - board.x1Ft) * 12, 1, "board stops one inch inside the full wall's end");
near(board.y1Ft * 12, 95.625, "board top is derived from floor, wall and board height");
near(distance(measures.boardStart, measures.plateStart) * 12, 2.5, "start extension label anchors actual cuts");
near(distance(measures.boardEnd, measures.plateEnd) * 12, 2.5, "end extension label anchors actual cuts");
near(distance(measures.innerLedgeStart, measures.innerLedgeEnd) * 12, .5, "ledge anchors span actual inner faces");
for (const member of mBefore.members) assert.ok(["x", "y", "z"].some(axis =>
  Math.min(board[axis + "1Ft"], member.bounds[axis + "1Ft"]) - Math.max(board[axis + "0Ft"], member.bounds[axis + "0Ft"]) <= 1e-9),
"gable board and every wall member touch without solid overlap");
const contactLength = Math.min(board.x1Ft, plate.x1Ft) - Math.max(board.x0Ft, plate.x0Ft);
const contactDepth = Math.min(board.z1Ft, plate.z1Ft) - Math.max(board.z0Ft, plate.z0Ft);
near(contactLength * 12, 113, "bearing length on upper plate");
near(contactDepth * 12, 1.5, "board's full thickness bears on upper plate");
for (const key of ["section", "orientation", "placement", "innerLedge", "endProjection"])
  assert.equal(measures.status[key], "confirmed");
assert.equal(measures.status.name, "provisional");
assert.equal(measures.status.treatment, "provisional");
assert.equal(measures.status.length, "derived");
assert.equal(measures.members.length, 1, "no gable studs, roof angles or sloping rafters were inferred");
assert.deepEqual(gableFrameMembers(plan), gableStudyMembers(plan));

const drawing = assemble(plan, { frames: true }).build, wallDrawing = assemble(end, { frames: true }).build;
for (const part of ["skids", "floor-frame", "floor-deck", "wall-frame"])
  assert.deepEqual(triangles(drawing, part), triangles(wallDrawing, part), `${part} geometry, UVs and materials remain exact`);
const mesh = triangles(drawing, "gable-frame");
assert.equal(mesh.length, 12, "one closed rectangular board owns twelve triangles");
const actualBounds = { x0Ft: Infinity, x1Ft: -Infinity, y0Ft: Infinity, y1Ft: -Infinity, z0Ft: Infinity, z1Ft: -Infinity };
let volume = 0;
for (const triangle of mesh) {
  const v = triangle.values, points = [v.slice(0, 3), v.slice(9, 12), v.slice(18, 21)], normal = v.slice(3, 6);
  const center = [0, 1, 2].map(i => points.reduce((sum, p) => sum + p[i] / 3, 0));
  for (const point of points) for (const [i, axis] of ["x", "y", "z"].entries()) {
    actualBounds[axis + "0Ft"] = Math.min(actualBounds[axis + "0Ft"], point[i]);
    actualBounds[axis + "1Ft"] = Math.max(actualBounds[axis + "1Ft"], point[i]);
    assert.ok(point[i] >= board[axis + "0Ft"] - 1e-8 && point[i] <= board[axis + "1Ft"] + 1e-8);
  }
  assert.ok(["x", "y", "z"].some((axis, i) => Math.abs(normal[i]) > .9 &&
    Math.abs(center[i] - board[axis + (normal[i] > 0 ? "1Ft" : "0Ft")]) < 1e-8), "face normals point out of the board");
  const [a, b, c] = points, ab = b.map((n, i) => n - a[i]), ac = c.map((n, i) => n - a[i]);
  const cross = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
  assert.ok(cross.reduce((sum, n, i) => sum + n * normal[i], 0) > 1e-9, "nondegenerate triangle winding agrees with normal");
  for (const offset of [8, 17, 26]) assert.equal(v[offset], STAGE_ID["roof-frame"]);
  volume += (a[0] * (b[1] * c[2] - b[2] * c[1]) + a[1] * (b[2] * c[0] - b[0] * c[2]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6;
}
for (const key of Object.keys(actualBounds)) near(actualBounds[key], board[key], `actual mesh ${key}`);
near(volume, (118 / 12) * (1.5 / 12) * (5.5 / 12), "positive closed-mesh volume equals actual board dimensions");

// Different-size arithmetic is a fixture of these same rules, not approval
// of this company's floor supports, stock lengths or roof for another size.
const widerInput = structuredClone(makePlan({ ...defaults(cat), size: "12x20" }, cat));
widerInput.construction.floorStudy.frame.widthFt = 12;
widerInput.construction.floorStudy.skids.lengthFt = 20;
const widerWall = wallStudyPlan(floorStudyPlan(widerInput), { wall: "end" });
const wider = gableStudyMeasurements(gableStudyPlan(widerWall, { gable: true }));
near(wider.upperPlate.lengthFt * 12, 137, "12-foot end upper plate follows both wall cutbacks");
near(wider.lengthFt * 12, 142, "gable board follows the resized upper plate, not a stored 118-inch value");
near(wider.innerLedgeFt * 12, .5, "ledge does not scale with footprint");
const differentProjection = structuredClone(end);
differentProjection.construction.gableStudy.endProjectionIn = { start: 1, end: 2 };
const asymmetric = gableStudyMeasurements(gableStudyPlan(differentProjection, { gable: true }));
near(asymmetric.lengthFt * 12, 116, "each end's projection is independent");
near(distance(asymmetric.boardStart, asymmetric.plateStart) * 12, 1, "start projection retains its own datum");
near(distance(asymmetric.boardEnd, asymmetric.plateEnd) * 12, 2, "end projection retains its own datum");
for (const change of [raw => raw.board.heightIn = 0, raw => raw.board.thicknessIn = NaN,
  raw => raw.board.heightIn = 1, raw => raw.innerLedgeIn = -1, raw => raw.innerLedgeIn = 3,
  raw => raw.endProjectionIn.start = -1, raw => raw.endProjectionIn.end = 4,
  raw => raw.placement = "beside-plate"]) {
  const invalid = structuredClone(end); change(invalid.construction.gableStudy);
  assert.throws(() => gableStudyPlan(invalid, { gable: true }));
}
const missing = structuredClone(end); delete missing.construction.gableStudy;
assert.throws(() => gableStudyPlan(missing, { gable: true }), /measurements/);
console.log("PROVED: one 118-inch 2x6 on edge, 2.5-inch projections past both upper-plate cuts, 0.5-inch inner ledge, plate contact without overlap, actual closed mesh, unchanged wall/floor/normal model, and formula-based resizing.");
