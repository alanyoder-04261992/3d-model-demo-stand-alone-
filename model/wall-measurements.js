/* Actual members and dimension anchors for the separate wall lesson. */
import { wallStudyFrame } from "../parts/wall-frame.js";
import { framePt } from "../parts/floor-frame.js";

function boundsOf(records) {
  return Object.fromEntries(["x", "y", "z"].flatMap(axis => [
    [axis + "0Ft", Math.min(...records.map(record => record.bounds[axis + "0Ft"]))],
    [axis + "1Ft", Math.max(...records.map(record => record.bounds[axis + "1Ft"]))],
  ]));
}

export function wallStudyMeasurements(plan) {
  if (!plan.wallStudy) return null;
  const study = plan.wallStudy, frame = wallStudyFrame(plan), run = frame.runs[0];
  const members = frame.members.map(member => {
    const at = member.meta.at, corners = [];
    for (const u of [at.u0, at.u1]) for (const y of [at.y0, at.y1]) for (const o of [at.o0, at.o1])
      corners.push(framePt(run.w, u, y, o));
    const bounds = Object.fromEntries(["x", "y", "z"].flatMap((axis, i) => [
      [axis + "0Ft", Math.min(...corners.map(point => point[i]))],
      [axis + "1Ft", Math.max(...corners.map(point => point[i]))],
    ]));
    const p0 = member.p0.slice(), p1 = member.p1.slice();
    return { member, kind: member.kind, bounds, p0, p1,
      center: p0.map((value, i) => (value + p1[i]) / 2),
      lengthFt: Math.hypot(...p0.map((value, i) => p1[i] - value)),
      widthFt: member.w, depthFt: member.d, nominalLumber: member.meta.size };
  });
  const studs = members.filter(record => record.kind === "stud");
  const doubles = frame.layoutMarks.filter(mark => mark.doubled).map(mark => {
    const pair = studs.filter(record => record.member.meta.role === "double" && record.member.meta.markFt === mark.markFt);
    return { markFt: mark.markFt, u: mark.u, members: pair, bounds: boundsOf(pair),
      jointPoint: framePt(run.w, mark.u, (study.bottomPlateTopYFt + study.studTopYFt) / 2, 0),
      status: study.status.pairPlacement };
  });
  return {
    wall: study.wall, name: study.name, lengthFt: study.lengthFt, heightFt: study.heightFt,
    baseYFt: study.baseYFt, topYFt: study.topYFt, studLengthFt: study.stud.lengthFt,
    widthFt: study.stud.widthFt, depthFt: study.stud.depthFt,
    plateThicknessFt: study.plates.thicknessFt, spacingFt: study.spacingFt, doubleEveryFt: study.doubleEveryFt,
    nominalStud: study.stud.nominal, nominalPlates: study.plates.nominal,
    bounds: boundsOf(members), members, studs, gridStuds: studs.filter(record => record.member.meta.role === "grid"), doubles,
    plates: { bottom: members.find(record => record.kind === "bottom-plate"),
      top: members.find(record => record.kind === "top-plate"), upper: members.find(record => record.kind === "upper-plate") },
    layoutMarks: frame.layoutMarks.map(mark => ({ ...mark,
      point: framePt(run.w, mark.u, study.bottomPlateTopYFt, 0) })),
    alongAxis: run.w.ax.slice(), outwardNormal: run.w.n.slice(),
    start: framePt(run.w, run.a, study.baseYFt, 0), end: framePt(run.w, run.b, study.baseYFt, 0),
    status: study.status, openings: study.openings, corners: study.corners,
  };
}
