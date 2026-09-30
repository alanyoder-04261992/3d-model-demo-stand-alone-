/* Visible measurements and anchors read the same polygons the preview draws. */
import { trussStudyMembers, trussGableStudMembers } from "./truss-study.js";

function record(member) {
  const poly = member.poly.map(p => [p[0] + member.origin[0], p[1] + member.origin[1]]);
  const z0Ft = member.origin[2], z1Ft = z0Ft + member.t;
  const bounds = { x0Ft: Math.min(...poly.map(p => p[0])), x1Ft: Math.max(...poly.map(p => p[0])),
    y0Ft: Math.min(...poly.map(p => p[1])), y1Ft: Math.max(...poly.map(p => p[1])), z0Ft, z1Ft };
  const center = [(bounds.x0Ft + bounds.x1Ft) / 2, (bounds.y0Ft + bounds.y1Ft) / 2, (z0Ft + z1Ft) / 2];
  const edge = member.meta.longEdgeIn;
  const [p0, p1] = edge ? edge.map(p => [member.origin[0] + p[0] / 12, member.origin[1] + p[1] / 12, center[2]])
    : [[center[0], bounds.y0Ft, center[2]], [center[0], bounds.y1Ft, center[2]]];
  const lengthFt = Math.hypot(...p1.map((value, i) => value - p0[i]));
  const grainAxis = p1.map((value, i) => (value - p0[i]) / lengthFt);
  return { member, kind: member.kind, name: member.meta.name, side: member.meta.side,
    poly, z0Ft, z1Ft, bounds, center, p0, p1, lengthFt, grainAxis, nominalLumber: member.meta.size,
    // Face width is perpendicular to the grain; depth is through the gable.
    widthFt: member.kind === "gable-stud" ? bounds.x1Ft - bounds.x0Ft : member.meta.faceWidthFt,
    depthFt: member.t };
}

export function trussStudyMeasurements(plan) {
  if (!plan.trussStudy) return null;
  const study = plan.trussStudy, p = study.profile;
  const trussMembers = trussStudyMembers(plan).map(record), studMembers = trussGableStudMembers(plan).map(record);
  const members = [...trussMembers, ...studMembers];
  const bounds = Object.fromEntries(["x", "y", "z"].flatMap(axis => [
    [axis + "0Ft", Math.min(...members.map(m => m.bounds[axis + "0Ft"]))],
    [axis + "1Ft", Math.max(...members.map(m => m.bounds[axis + "1Ft"]))],
  ]));
  // Label anchors are on the inside exposed face, not an invented centerline.
  const at = (xIn, yIn, z = study.centerZFt + study.chord.thicknessFt / 2) =>
    [study.centerXFt + xIn / 12, study.baseYFt + yIn / 12, z];
  const left = point => at(-point[0], point[1]), right = point => at(...point);
  const plateFaceZ = plan.wallStudy.floorBounds.z0Ft + plan.wallStudy.plates.depthFt;
  return { name: study.name, wall: "end", preview: true, members, trussMembers, studMembers, bounds,
    upperLengthFt: study.upperLengthFt, lowerLengthFt: study.lowerLengthFt, peakRiseFt: study.peakRiseFt,
    projectionFt: { start: study.projectionFt, end: study.projectionFt }, outerSpanFt: study.outerSpanFt,
    baseYFt: study.baseYFt, topYFt: study.topYFt, upperAngleDeg: p.upperAngle * 180 / Math.PI,
    lowerAngleDeg: p.lowerAngle * 180 / Math.PI, studSpacingFt: study.studs.spacingFt,
    studFirstCenterFt: study.studs.firstCenterFt, studLayoutFrom: study.studs.layoutFrom,
    studWallDistancesFt: study.studs.wallDistancesIn.map(value => value / 12),
    anchors: { peak: at(...p.peak), upperPlateTop: at(0, 0, plateFaceZ),
      gableTop: at(0, study.studBaseIn, study.boardFrontZFt), leftTip: left(p.tip), rightTip: right(p.tip),
      leftLowestTip: left(p.innerTip), rightLowestTip: right(p.innerTip),
      leftPlateCut: at(-study.plateHalfSpanFt * 12, 0, plateFaceZ),
      rightPlateCut: at(study.plateHalfSpanFt * 12, 0, plateFaceZ),
      upperLeftStart: left(p.knee), upperLeftEnd: left(p.peak), lowerLeftStart: left(p.tip), lowerLeftEnd: left(p.knee),
      upperRightStart: right(p.knee), upperRightEnd: right(p.peak), lowerRightStart: right(p.tip), lowerRightEnd: right(p.knee),
      wallLayoutOrigin: [study.studs.layoutOriginXFt, plan.wallStudy.topPlateTopYFt, plateFaceZ],
      studCenters: studMembers.map(m => [m.center[0], study.studBaseYFt, m.z1Ft]) },
    status: study.status, assumptionNotes: study.assumptionNotes.slice() };
}
