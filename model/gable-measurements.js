/* Physical board bounds and labeled endpoints for the one-board gable lesson.
   All dimensions come from the drawn member and the actual upper plate. */
import { gableStudyMembers } from "../parts/gable-frame.js";
import { wallStudyFrame } from "../parts/wall-frame.js";
import { framePt } from "../parts/floor-frame.js";
import { wallStudyMeasurements } from "./wall-measurements.js";

export function gableStudyMeasurements(plan) {
  if (!plan.gableStudy) return null;
  const study = plan.gableStudy, member = gableStudyMembers(plan)[0];
  const wall = wallStudyMeasurements(plan), upperPlate = wall.plates.upper;
  const run = wallStudyFrame(plan).runs[0], at = member.meta.at, corners = [];
  for (const u of [at.u0, at.u1]) for (const y of [at.y0, at.y1]) for (const o of [at.o0, at.o1])
    corners.push(framePt(run.w, u, y, o));
  const bounds = Object.fromEntries(["x", "y", "z"].flatMap((axis, i) => [
    [axis + "0Ft", Math.min(...corners.map(point => point[i]))],
    [axis + "1Ft", Math.max(...corners.map(point => point[i]))],
  ]));
  const p0 = member.p0.slice(), p1 = member.p1.slice();
  const board = { member, kind: member.kind, bounds, p0, p1,
    center: p0.map((value, i) => (value + p1[i]) / 2),
    lengthFt: Math.hypot(...p0.map((value, i) => p1[i] - value)),
    widthFt: member.w, depthFt: member.d, nominalLumber: member.meta.size };
  const projectionY = study.baseYFt, boardO = study.faceOffsetMinFt;
  const atPoint = (u, y, o) => framePt(run.w, u, y, o);
  const wallLineStart = atPoint(0, projectionY, 0);
  const wallLineEnd = atPoint(0, projectionY, study.faceOffsetMaxFt);
  const oppositeStart = atPoint(0, projectionY, -plan.wallStudy.plates.depthFt);
  const oppositeEnd = atPoint(0, projectionY, study.faceOffsetMinFt);
  const ledgeStart = study.ledgeEdge === "wall-line" ? wallLineStart : oppositeStart;
  const ledgeEnd = study.ledgeEdge === "wall-line" ? wallLineEnd : oppositeEnd;
  const otherStart = study.ledgeEdge === "wall-line" ? oppositeStart : wallLineStart;
  const otherEnd = study.ledgeEdge === "wall-line" ? oppositeEnd : wallLineEnd;
  const innerLedgeStart = study.ledgeSide === "inside" ? ledgeStart : otherStart;
  const innerLedgeEnd = study.ledgeSide === "inside" ? ledgeEnd : otherEnd;
  const outerLedgeStart = study.ledgeSide === "outside" ? ledgeStart : otherStart;
  const outerLedgeEnd = study.ledgeSide === "outside" ? ledgeEnd : otherEnd;
  return {
    wall: "end", name: study.name, board, members: [board], upperPlate,
    bounds, lengthFt: board.lengthFt, heightFt: study.board.heightFt,
    thicknessFt: study.board.thicknessFt, innerLedgeFt: study.innerLedgeFt,
    outerLedgeFt: study.outerLedgeFt, ledgeSide: study.ledgeSide, ledgeEdge: study.ledgeEdge, ledgeFt: study.ledgeFt,
    endProjectionFt: { ...study.endProjectionFt },
    baseYFt: bounds.y0Ft, topYFt: bounds.y1Ft,
    boardStart: atPoint(at.u0, projectionY, boardO), boardEnd: atPoint(at.u1, projectionY, boardO),
    plateStart: atPoint(plan.wallStudy.upperPlateRange.u0, projectionY, boardO),
    plateEnd: atPoint(plan.wallStudy.upperPlateRange.u1, projectionY, boardO),
    innerLedgeStart, innerLedgeEnd, outerLedgeStart, outerLedgeEnd,
    ledgeStart, ledgeEnd,
    alongAxis: run.w.ax.slice(), outwardNormal: run.w.n.slice(), status: study.status,
  };
}
