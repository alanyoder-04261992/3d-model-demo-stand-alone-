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

console.log(`PROVED: supports-only start, all 8 manual floor selections, ${triangleChecks} selected triangles preserved, no hidden building parts, source geometry unchanged, and measurements match rendered geometry with default and changed builder settings.`);
