/* CHECK: the measured, explicitly selected truss preview. Geometry here
   verifies a provisional fit, not an approved shop cut list. check-all: node */
import assert from "node:assert/strict";
import { loadCatalogue } from "./lib/load.mjs";
import { defaults } from "../model/design.js";
import { makePlan } from "../model/plan.js";
import { floorStudyPlan } from "../model/floor-study.js";
import { wallStudyPlan } from "../model/wall-study.js";
import { gableStudyPlan } from "../model/gable-study.js";
import { gableStudyMeasurements } from "../model/gable-measurements.js";
import { trussStudyPlan, trussStudyMembers, trussGableStudMembers } from "../model/truss-study.js";
import { trussStudyMeasurements } from "../model/truss-measurements.js";
import { polyArea, clipHalf } from "../parts/floor-frame.js";
import { assemble } from "../engine/assemble.js";

const near = (actual, expected, label) => assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) < 1e-8,
  `${label}: ${actual} vs ${expected}`);
const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
const cross = (a, b, p) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
const lineDistance = (point, a, b) => Math.abs(cross(a, b, point)) / distance(a, b);
const inches = m => m.poly.map(p => p.map(v => v * 12));
const pointsMatch = (a, b) => distance(a, b) < 1e-8;
function intersectionArea(a, b) {
  let clipped = a;
  for (let i = 0; i < b.length; i++) {
    const p = b[i], q = b[(i + 1) % b.length], dx = q[0] - p[0], dy = q[1] - p[1];
    clipped = clipHalf(clipped, -dy, dx, dy * p[0] - dx * p[1]);
  }
  return Math.abs(polyArea(clipped));
}
const cat = loadCatalogue("learning-side-loft"), ordinary = makePlan(defaults(cat), cat);
const floor = floorStudyPlan(ordinary), wall = wallStudyPlan(floor, { wall: "end" });
const gable = gableStudyPlan(wall, { gable: true }), snapshot = JSON.stringify(gable);
assert.strictEqual(trussStudyPlan(gable), gable, "preview requires explicit selection");
assert.strictEqual(trussStudyPlan(gable, { truss: false }), gable);
assert.deepEqual(trussStudyMembers(gable), []);
assert.deepEqual(trussGableStudMembers(gable), []);
assert.equal(trussStudyMeasurements(gable), null);
assert.throws(() => trussStudyPlan(gable, { truss: "true" }), /boolean/);
assert.throws(() => trussStudyPlan(ordinary, { truss: true }), /end wall/);
assert.throws(() => trussStudyPlan(wall, { truss: true }), /gable board/);
const noSettings = structuredClone(ordinary); delete noSettings.construction.trussStudy;
assert.deepEqual(assemble(ordinary, { frames: true }).build, assemble(noSettings, { frames: true }).build,
  "truss settings alone cannot change ordinary geometry, materials or framing");

const plan = trussStudyPlan(gable, { truss: true }), m = trussStudyMeasurements(plan);
const chords = trussStudyMembers(plan), studs = trussGableStudMembers(plan), members = [...chords, ...studs];
assert.equal(JSON.stringify(gable), snapshot, "source floor, wall and gable plan remains exact");
assert.deepEqual(gableStudyMeasurements(plan), gableStudyMeasurements(gable));
assert.ok(Object.isFrozen(plan) && Object.isFrozen(plan.trussStudy.profile.peak));
assert.equal(chords.length, 4, "two upper and two lower pieces");
assert.deepEqual(studs.map(s => s.meta.centerIn), [-48, -24, 0, 24, 48], "centered 24-inch stud layout");
near(gable.gableStudy.range.lengthFt * 12, 118, "confirmed gable board span");
near(plan.wallStudy.upperPlateRange.lengthFt * 12, 113, "projection datum is the upper plate cut span");
near((m.anchors.peak[1] - m.anchors.gableTop[1]) * 12, 48, "peak above board top");
near((m.anchors.rightTip[0] - m.anchors.rightPlateCut[0]) * 12, 6.25, "right horizontal projection");
near((m.anchors.leftPlateCut[0] - m.anchors.leftTip[0]) * 12, 6.25, "provisionally mirrored left projection");
near((m.bounds.x1Ft - m.bounds.x0Ft) * 12, 125.5, "actual outside tip span");
near(m.topYFt - m.baseYFt, 4, "visible measurement rise");
for (const record of m.trussMembers) {
  near(record.widthFt * 12, 3.5, "measurement record keeps actual face width");
  near(record.depthFt * 12, 1.5, "measurement record keeps through-gable thickness");
  assert.equal(record.member.meta.bearingOn, record.kind === "truss-lower" ? "gable-board" : undefined);
}
for (const [kind, expected] of [["truss-upper", 54], ["truss-lower", 37.75]]) {
  const pair = chords.filter(c => c.kind === kind);
  for (const chord of pair) {
    const poly = inches(chord), [a, b] = chord.meta.longEdgeIn;
    near(distance(a, b), expected, "actual outer long-point length");
    assert.ok(poly.some(p => pointsMatch(p, a)) && poly.some(p => pointsMatch(p, b)), "long edge belongs to polygon");
    const inner = poly.filter(p => !pointsMatch(p, a) && !pointsMatch(p, b));
    assert.equal(inner.length, 2);
    for (const point of inner) near(lineDistance(point, a, b), 3.5, "normal depth is actual 3.5-inch lumber");
    near(chord.t * 12, 1.5, "board thickness through gable depth");
    if (kind === "truss-lower") {
      const tail = inner.reduce((best, p) => distance(p, a) < distance(best, a) ? p : best);
      near(distance(a, tail), 3.5, "tail cut spans full stock depth");
      near((tail[0] - a[0]) * (b[0] - a[0]) + (tail[1] - a[1]) * (b[1] - a[1]), 0,
        "provisional tail cut is square to the member");
    }
  }
  for (const p of inches(pair[0])) assert.ok(inches(pair[1]).some(q => pointsMatch([-p[0], p[1]], q)),
    "left and right pieces are exact reflections");
}
for (const side of ["left", "right"]) {
  const upper = inches(chords.find(c => c.kind === "truss-upper" && c.meta.side === side));
  const lower = inches(chords.find(c => c.kind === "truss-lower" && c.meta.side === side));
  assert.equal(upper.filter(p => lower.some(q => pointsMatch(p, q))).length, 2, "knee cut is a shared full-depth edge");
  const bearing = [side === "left" ? -59 : 59, 0];
  assert.ok(lower.some((p, i) => lineDistance(bearing, p, lower[(i + 1) % lower.length]) < 1e-8 &&
    distance(p, bearing) + distance(bearing, lower[(i + 1) % lower.length]) <= distance(p, lower[(i + 1) % lower.length]) + 1e-8),
    "plain lower edge touches the actual board corner");
}
const boardPoly = [[-59, -5.5], [59, -5.5], [59, 0], [-59, 0]];
for (let i = 0; i < members.length; i++) {
  const poly = inches(members[i]);
  assert.ok(polyArea(poly) > 0, "each prism has positive polygon winding");
  near(intersectionArea(poly, boardPoly), 0, "member does not intersect gable board solid");
  for (let j = i + 1; j < members.length; j++) near(intersectionArea(poly, inches(members[j])), 0,
    "studs and chords touch without solid overlap");
}
for (const stud of studs) {
  const poly = inches(stud), bottom = poly.filter(p => Math.abs(p[1]) < 1e-8), top = poly.filter(p => p[1] > 1e-8);
  assert.equal(bottom.length, 2, "full-width bottom bears on board top");
  near(distance(...bottom), 3.5, "outward stud face is 3.5 inches wide");
  near(stud.t * 12, 1.5, "turned stud is 1.5 inches deep");
  for (const p of top) {
    assert.ok(chords.some(chord => inches(chord).some((a, i, poly) =>
      lineDistance(p, a, poly[(i + 1) % poly.length]) < 1e-8 &&
      distance(a, p) + distance(p, poly[(i + 1) % poly.length]) <= distance(a, poly[(i + 1) % poly.length]) + 1e-8)),
    "every top cut point meets an actual chord underside");
  }
}
assert.equal(inches(studs[2]).length, 5, "center stud receives both peak bevels");
for (const key of ["mirror", "bearing", "tailCut", "mitres", "depthAlignment", "studSection", "studFace", "studLayoutOrigin"])
  assert.equal(m.status[key], "provisional", `${key} is not presented as a confirmed shop rule`);
assert.equal(m.status.slopes, "derived-from-preview-assumptions");
assert.equal(m.status.studLengths, "derived-from-preview-assumptions");
for (const change of [raw => raw.upperLengthIn = 0, raw => raw.lowerLengthIn = NaN,
  raw => raw.peakRiseIn = 500, raw => raw.projectionIn = 1, raw => raw.chord.depthIn = 1,
  raw => raw.chord.thicknessIn = 2, raw => raw.studs.spacingIn = 3.5, raw => raw.studs.thicknessIn = 2,
  raw => raw.bearing = "unknown", raw => raw.tailCut = "level", raw => raw.layout = "asymmetric",
  raw => raw.studs.layoutOrigin = "end", raw => raw.studs.orientation = "edge-outward"]) {
  const invalid = structuredClone(gable); change(invalid.construction.trussStudy);
  assert.throws(() => trussStudyPlan(invalid, { truss: true }));
}
const missing = structuredClone(gable); delete missing.construction.trussStudy;
assert.throws(() => trussStudyPlan(missing, { truss: true }), /measurements/);
const asymmetric = structuredClone(wall); asymmetric.construction.gableStudy.endProjectionIn.end = 2;
assert.throws(() => trussStudyPlan(gableStudyPlan(asymmetric, { gable: true }), { truss: true }), /centered/);
console.log("PROVED: explicit preview, unchanged ordinary model, 54/37.75-inch long edges, true 3.5-inch normal depth, 48-inch rise, 6.25-inch plate-cut projections, mirrored mitres and square tails, corner bearing without overlap, and five fitted 24-inch-center gable studs; provisional cuts remain labeled.");
