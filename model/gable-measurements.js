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
  const projectionY = study.baseYFt, boardO = study.innerFaceOffsetFt;
  const atPoint = (u, y, o) => framePt(run.w, u, y, o);
  return {
    wall: "end", name: study.name, board, members: [board], upperPlate,
    bounds, lengthFt: board.lengthFt, heightFt: study.board.heightFt,
    thicknessFt: study.board.thicknessFt, innerLedgeFt: study.innerLedgeFt,
    endProjectionFt: { ...study.endProjectionFt },
    baseYFt: bounds.y0Ft, topYFt: bounds.y1Ft,
    boardStart: atPoint(at.u0, projectionY, boardO), boardEnd: atPoint(at.u1, projectionY, boardO),
    plateStart: atPoint(plan.wallStudy.upperPlateRange.u0, projectionY, boardO),
    plateEnd: atPoint(plan.wallStudy.upperPlateRange.u1, projectionY, boardO),
    innerLedgeStart: atPoint(0, projectionY, -plan.wallStudy.plates.depthFt),
    innerLedgeEnd: atPoint(0, projectionY, boardO),
    alongAxis: run.w.ax.slice(), outwardNormal: run.w.n.slice(), status: study.status,
  };
}
