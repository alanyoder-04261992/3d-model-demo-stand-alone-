/* The manual gable lesson adds one board on the selected end wall's upper
   plate. Company settings alone never enable it or alter the normal roof. */
import { deepFreeze } from "./company.js";

function measurement(value, name, zeroAllowed = false) {
  if (typeof value !== "number" || !Number.isFinite(value) || (zeroAllowed ? value < 0 : value <= 0))
    throw new Error(`gableStudy.${name} must be a ${zeroAllowed ? "nonnegative" : "positive"} measurement.`);
  return value;
}

export function gableStudyPlan(plan, { gable = false } = {}) {
  if (typeof gable !== "boolean") throw new Error("The gable lesson needs an explicit boolean selection.");
  if (!gable) return plan;
  if (!plan.floorStudy || !plan.wallStudy || plan.wallStudy.wall !== "end")
    throw new Error("The gable lesson needs the existing floor and a selected end wall.");
  const raw = plan.construction?.gableStudy;
  if (!raw) throw new Error("The gable lesson needs construction.gableStudy measurements.");
  if (raw.placement !== "on-upper-plate")
    throw new Error("gableStudy.placement must put the board on the upper plate.");
  const board = raw.board || {}, wall = plan.wallStudy;
  const thicknessIn = measurement(board.thicknessIn, "board.thicknessIn");
  const heightIn = measurement(board.heightIn, "board.heightIn");
  if (!["inside", "outside"].includes(raw.ledgeSide))
    throw new Error("gableStudy.ledgeSide must be inside or outside.");
  if (!["wall-line", "opposite"].includes(raw.ledgeEdge))
    throw new Error("gableStudy.ledgeEdge must identify the physical plate edge.");
  const ledgeIn = measurement(raw.ledgeIn, "ledgeIn", true);
  const endProjectionIn = {
    start: measurement(raw.endProjectionIn?.start, "endProjectionIn.start", true),
    end: measurement(raw.endProjectionIn?.end, "endProjectionIn.end", true),
  };
  if (heightIn <= thicknessIn || ledgeIn + thicknessIn > wall.plates.depthIn + 1e-9)
    throw new Error("The gable board must stand on edge and fit across the upper plate with its specified ledge.");
  if (Math.max(endProjectionIn.start, endProjectionIn.end) > wall.setbacks.upperPlateIn + 1e-9)
    throw new Error("The gable lesson's end projections must fit within the end-wall span.");
  const endProjectionFt = { start: endProjectionIn.start / 12, end: endProjectionIn.end / 12 };
  const u0 = wall.upperPlateRange.u0 - endProjectionFt.start;
  const u1 = wall.upperPlateRange.u1 + endProjectionFt.end;
  const otherLedgeIn = wall.plates.depthIn - ledgeIn - thicknessIn;
  const innerLedgeIn = raw.ledgeSide === "inside" ? ledgeIn : otherLedgeIn;
  const outerLedgeIn = raw.ledgeSide === "outside" ? ledgeIn : otherLedgeIn;
  const innerLedgeFt = innerLedgeIn / 12, thicknessFt = thicknessIn / 12, heightFt = heightIn / 12;
  // Physical placement is separate from Alan's names for the two ledges.
  // Wall-line is offset zero in the wall member's local normal coordinates.
  const faceOffsetMinFt = raw.ledgeEdge === "wall-line"
    ? -(ledgeIn / 12) - thicknessFt : -wall.plates.depthFt + ledgeIn / 12;
  const faceOffsetMaxFt = faceOffsetMinFt + thicknessFt;
  const status = {};
  for (const key of ["section", "orientation", "placement", "ledge", "ledgeSide", "ledgeEdge", "endProjection", "name", "treatment"])
    status[key] = ["confirmed", "derived"].includes(raw.status?.[key]) ? raw.status[key] : "provisional";
  status.innerLedge = raw.ledgeSide === "inside" ? status.ledge : "derived";
  status.outerLedge = raw.ledgeSide === "outside" ? status.ledge : "derived";
  status.length = "derived"; status.elevation = "derived";
  const copy = structuredClone(plan);
  copy.gableStudy = {
    enabled: true, wall: "end", name: "Gable board",
    board: { nominal: board.nominal || "2x6", thicknessIn, thicknessFt, heightIn, heightFt },
    placement: "on-upper-plate", orientation: "on-edge", innerLedgeIn, innerLedgeFt,
    outerLedgeIn, outerLedgeFt: outerLedgeIn / 12,
    ledgeSide: raw.ledgeSide, ledgeEdge: raw.ledgeEdge, ledgeIn, ledgeFt: ledgeIn / 12,
    endProjectionIn, endProjectionFt, range: { u0, u1, lengthFt: u1 - u0 },
    faceOffsetMinFt, faceOffsetMaxFt,
    baseYFt: wall.topYFt, topYFt: wall.topYFt + heightFt,
    status,
  };
  return deepFreeze(copy);
}
