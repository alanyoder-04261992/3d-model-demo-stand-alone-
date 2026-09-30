/* An explicitly selected, measured truss preview. This does not reuse the
   ordinary designer's roof profile, spacing or connector defaults. */
import { deepFreeze } from "./company.js";
import { prismMember, polyArea, clipHalf, cleanPoly } from "../parts/floor-frame.js";

function positive(value, name) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0)
    throw new Error(`trussStudy.${name} must be a positive measurement.`);
  return value;
}

/* Fit the long outer edges between the plate datum and peak. The entire
   tail cut is level with the gable-board bottom / upper-plate top.
   The truss is against the front face of the board.
   All working lengths here are inches. */
function solveProfile(upper, lower, rise, tipX, depth) {
  function evaluate(angle) {
    const c = Math.cos(angle), s = Math.sin(angle);
    const tipY = 0;
    const kneeX = tipX - lower * c, kneeY = tipY + lower * s;
    const upperAngle = Math.atan2(rise - kneeY, kneeX);
    return { residual: Math.hypot(kneeX, rise - kneeY) - upper,
      lowerAngle: angle, upperAngle, tipY, kneeX, kneeY };
  }
  const roots = [];
  let a = .0001, fa = evaluate(a);
  for (let index = 1; index <= 2048; index++) {
    const b = .0001 + (Math.PI / 2 - .0002) * index / 2048, fb = evaluate(b);
    if (fa.residual * fb.residual <= 0) {
      let lo = a, hi = b, flo = fa.residual;
      for (let n = 0; n < 64; n++) {
        const mid = (lo + hi) / 2, fm = evaluate(mid).residual;
        if (flo * fm <= 0) hi = mid;
        else { lo = mid; flo = fm; }
      }
      const fit = evaluate((lo + hi) / 2);
      if (fit.kneeX > 0 && fit.kneeX < tipX && fit.kneeY > 0 && fit.kneeY < rise &&
          fit.upperAngle > 0 && fit.upperAngle < fit.lowerAngle && Math.abs(fit.residual) < 1e-7)
        if (!roots.some(root => Math.abs(root.lowerAngle - fit.lowerAngle) < 1e-7)) roots.push(fit);
    }
    a = b; fa = fb;
  }
  if (roots.length !== 1)
    throw new Error("The truss measurements do not give one valid plate-to-peak profile; confirm the dimensions and cuts.");
  const fit = roots[0], upperSlope = Math.tan(fit.upperAngle), lowerSlope = Math.tan(fit.lowerAngle);
  const innerPeakY = rise - depth / Math.cos(fit.upperAngle);
  const lowerInnerIntercept = fit.tipY + lowerSlope * tipX - depth / Math.cos(fit.lowerAngle);
  const innerKneeX = (lowerInnerIntercept - innerPeakY) / (lowerSlope - upperSlope);
  const innerKneeY = innerPeakY - upperSlope * innerKneeX;
  // Intersect the inward-offset stock edge with the same horizontal datum.
  const innerTipX = tipX - depth / Math.sin(fit.lowerAngle);
  const innerTipY = 0;
  if (innerPeakY <= 0 || innerKneeX <= 0 || innerKneeY <= 0 || innerTipX <= 0 ||
      innerKneeX >= innerTipX || innerKneeX >= fit.kneeX || innerKneeY >= fit.kneeY)
    throw new Error("The truss preview cuts do not leave a valid full-depth board.");
  return { ...fit, upperSlope, lowerSlope, innerPeakY, innerKneeX, innerKneeY, innerTipX, innerTipY,
    peak: [0, rise], knee: [fit.kneeX, fit.kneeY], tip: [tipX, fit.tipY],
    innerPeak: [0, innerPeakY], innerKnee: [innerKneeX, innerKneeY], innerTip: [innerTipX, innerTipY] };
}

export function trussStudyPlan(plan, { truss = false } = {}) {
  if (typeof truss !== "boolean") throw new Error("The truss preview needs an explicit boolean selection.");
  if (!truss) return plan;
  if (!plan.gableStudy || plan.wallStudy?.wall !== "end")
    throw new Error("The truss preview needs the measured gable board and end wall first.");
  const raw = plan.construction?.trussStudy;
  if (!raw) throw new Error("The truss preview needs construction.trussStudy measurements.");
  if (raw.placement !== "against-gable-inner-face" || raw.peakDatum !== "upper-plate-top" ||
      raw.lowestTipDatum !== "upper-plate-top" || raw.tailCut !== "level-with-gable-bottom" || raw.layout !== "mirrored-about-center")
    throw new Error("The truss preview needs its face placement, plate datums, tail cut and mirrored layout.");
  const thicknessIn = positive(raw.chord?.thicknessIn, "chord.thicknessIn");
  const depthIn = positive(raw.chord?.depthIn, "chord.depthIn");
  const upperLengthIn = positive(raw.upperLengthIn, "upperLengthIn");
  const lowerLengthIn = positive(raw.lowerLengthIn, "lowerLengthIn");
  const peakRiseIn = positive(raw.peakRiseIn, "peakRiseIn");
  const projectionIn = positive(raw.projectionIn, "projectionIn");
  const widthIn = positive(raw.studs?.widthIn, "studs.widthIn");
  const studThicknessIn = positive(raw.studs?.thicknessIn, "studs.thicknessIn");
  const spacingIn = positive(raw.studs?.spacingIn, "studs.spacingIn");
  const firstCenterIn = positive(raw.studs?.firstCenterIn, "studs.firstCenterIn");
  if (raw.studs?.layoutOrigin !== "outside-end-wall" || !["start", "end"].includes(raw.studs?.layoutFrom) ||
      raw.studs?.orientation !== "broad-face-outward" ||
      raw.studs?.topFit !== "behind-truss-face")
    throw new Error("The gable studs need the outside-wall datum, starting end, first center and outward face.");
  const gable = plan.gableStudy, plate = plan.wallStudy.upperPlateRange;
  if (thicknessIn >= depthIn ||
      studThicknessIn > gable.board.thicknessIn + 1e-9 || spacingIn <= widthIn || widthIn <= studThicknessIn)
    throw new Error("The truss section must be valid and the turned studs must fit on the gable board.");
  const centerU = (plate.u0 + plate.u1) / 2, bearingIn = gable.range.lengthFt * 6;
  if (Math.abs((gable.range.u0 + gable.range.u1) / 2 - centerU) > 1e-9)
    throw new Error("This mirrored truss preview requires a centered gable board; resolve asymmetric seating first.");
  const tipIn = plate.lengthFt * 6 + projectionIn;
  if (tipIn <= bearingIn) throw new Error("The truss tip must project beyond the gable board for this preview fit.");
  const profile = solveProfile(upperLengthIn, lowerLengthIn, peakRiseIn, tipIn, depthIn);
  if (profile.innerPeakY <= gable.board.heightIn)
    throw new Error("The truss peak must clear the gable board and leave room for gable studs.");
  const floor = plan.wallStudy.floorBounds;
  const centerXFt = (floor.x0Ft + floor.x1Ft) / 2 + centerU;
  const boardFrontZFt = floor.z0Ft - gable.faceOffsetMinFt;
  const centerZFt = boardFrontZFt + thicknessIn / 24;
  const studCenterZFt = boardFrontZFt - studThicknessIn / 24;
  const layoutDirection = raw.studs.layoutFrom === "start" ? 1 : -1;
  const layoutOriginXFt = layoutDirection > 0 ? floor.x0Ft : floor.x1Ft;
  const firstRelativeIn = (layoutOriginXFt - centerXFt) * 12 + layoutDirection * firstCenterIn;
  if (firstRelativeIn - widthIn / 2 < -bearingIn - 1e-9 || firstRelativeIn + widthIn / 2 > bearingIn + 1e-9)
    throw new Error("The first gable stud must fit fully on the gable board; check its center offset.");
  const remainingIn = bearingIn - layoutDirection * firstRelativeIn - widthIn / 2;
  const studCount = Math.floor(remainingIn / spacingIn + 1e-9) + 1;
  const centersIn = Array.from({ length: studCount }, (_, n) => firstRelativeIn + layoutDirection * n * spacingIn);
  const wallDistancesIn = centersIn.map((_, n) => firstCenterIn + n * spacingIn);
  const status = {};
  for (const key of ["section", "upperLength", "lowerLength", "peakRise", "projection", "projectionDatum",
    "peakDatum", "lowestTipDatum", "trussPlacement", "studPlacement", "studSpacing", "studTurnedOutward", "mirror", "tailCut",
    "mitres", "depthAlignment", "studSection", "studFace", "studLayoutOrigin", "studFirstCenter", "studTopFit", "treatment"])
    status[key] = ["confirmed", "derived"].includes(raw.status?.[key]) ? raw.status[key] : "provisional";
  status.slopes = "derived-from-preview-assumptions";
  status.studLengths = "derived-from-preview-assumptions";
  const copy = structuredClone(plan);
  copy.trussStudy = {
    enabled: true, preview: true, wall: "end", name: "Truss",
    chord: { nominal: raw.chord.nominal || "2x4", thicknessIn, thicknessFt: thicknessIn / 12, depthIn, depthFt: depthIn / 12 },
    upperLengthIn, upperLengthFt: upperLengthIn / 12, lowerLengthIn, lowerLengthFt: lowerLengthIn / 12,
    peakRiseIn, peakRiseFt: peakRiseIn / 12, projectionIn, projectionFt: projectionIn / 12,
    outerSpanFt: tipIn / 6, bearingHalfSpanFt: bearingIn / 12, plateHalfSpanFt: plate.lengthFt / 2,
    centerXFt, centerZFt, studCenterZFt, boardFrontZFt,
    baseYFt: gable.baseYFt, topYFt: gable.baseYFt + peakRiseIn / 12,
    studBaseIn: gable.board.heightIn, studBaseYFt: gable.topYFt,
    placement: raw.placement, peakDatum: raw.peakDatum, lowestTipDatum: raw.lowestTipDatum,
    tailCut: raw.tailCut, layout: raw.layout,
    studs: { nominal: raw.studs.nominal || "2x4", widthIn, widthFt: widthIn / 12,
      thicknessIn: studThicknessIn, thicknessFt: studThicknessIn / 12, spacingIn, spacingFt: spacingIn / 12,
      layoutOrigin: raw.studs.layoutOrigin, layoutFrom: raw.studs.layoutFrom,
      layoutOriginXFt, layoutDirection, firstCenterIn, firstCenterFt: firstCenterIn / 12,
      centersIn, wallDistancesIn, orientation: "broad-face-outward", topFit: raw.studs.topFit },
    profile, status,
    assumptionNotes: [
      `Preview mirrors the marked ${projectionIn}-inch projection at both ends.`,
      `The truss is against the shown face of the gable board; its lowest tips and ${peakRiseIn}-inch peak rise use the upper-plate top.`,
      "The whole bottom cut is level with the gable-board bottom, at the upper-plate top. Knee and peak mitres remain provisional.",
      `Gable-stud centers start ${firstCenterIn} inches from the outside end-wall edge, then repeat at ${spacingIn} inches. The first-center offset is the preview interpretation of Alan's "centered" reply.`,
      `Gable studs are ${raw.studs.nominal || "2x4"}s, wide face outward, on the board with their tops behind the truss face. This top fit is provisional.`,
      "Derived slopes and stud cuts are a preview fit, not an approved shop cut list.",
    ],
  };
  return deepFreeze(copy);
}

function member(plan, kind, polyIn, thicknessFt, meta) {
  const study = plan.trussStudy;
  let poly = polyIn.map(p => p.map(value => value / 12));
  if (polyArea(poly) < 0) poly = poly.reverse();
  const item = prismMember(kind, "lumber", poly,
    [study.centerXFt, study.baseYFt, (kind === "gable-stud" ? study.studCenterZFt : study.centerZFt) - thicknessFt / 2],
    [1, 0, 0], [0, 1, 0], [0, 0, 1], thicknessFt,
    { wall: "B", lesson: true, preview: true, ...meta });
  item.stage = "roof-frame";
  return item;
}

export function trussStudyMembers(plan) {
  if (!plan.trussStudy) return [];
  const study = plan.trussStudy, p = study.profile, out = [];
  for (const sign of [-1, 1]) {
    const side = sign < 0 ? "left" : "right", mirror = point => [point[0] * sign, point[1]];
    for (const [kind, outline, edge, length] of [
      ["truss-upper", [p.knee, p.peak, p.innerPeak, p.innerKnee], [p.knee, p.peak], study.upperLengthFt],
      ["truss-lower", [p.tip, p.knee, p.innerKnee, p.innerTip], [p.tip, p.knee], study.lowerLengthFt],
    ]) out.push(member(plan, kind, outline.map(mirror), study.chord.thicknessFt,
      { size: study.chord.nominal, side, name: kind === "truss-upper" ? "Upper truss piece" : "Lower truss piece",
        longEdgeIn: edge.map(mirror), longEdgeLengthFt: length, faceWidthFt: study.chord.depthFt,
        ...(kind === "truss-lower" ? { againstFaceOf: "gable-board" } : {}) }));
  }
  return out;
}

export function trussGableStudMembers(plan) {
  if (!plan.trussStudy) return [];
  const study = plan.trussStudy, p = study.profile, out = [];
  const width = study.studs.widthIn;
  for (const [index, center] of study.studs.centersIn.entries()) {
    const x0 = center - width / 2, x1 = center + width / 2;
    let poly = [[x0, study.studBaseIn], [x1, study.studBaseIn], [x1, study.peakRiseIn], [x0, study.peakRiseIn]];
    // Studs remain on the board, behind the truss. Provisional face joint:
    // tops follow the outer roof outline, giving contact area on its back face.
    for (const slope of [-p.upperSlope, p.upperSlope]) poly = clipHalf(poly, -slope, -1, study.peakRiseIn);
    for (const slope of [-p.lowerSlope, p.lowerSlope]) poly = clipHalf(poly, -slope, -1, p.tipY + p.lowerSlope * p.tip[0]);
    poly = cleanPoly(poly);
    if (poly.length < 3 || polyArea(poly) <= 0 || Math.max(...poly.map(q => q[1])) <= study.studBaseIn)
      throw new Error("A preview gable stud does not fit below the truss.");
    out.push(member(plan, "gable-stud", poly, study.studs.thicknessFt,
      { name: "Gable stud", size: study.studs.nominal, centerIn: center, layoutIndex: index,
        wallDistanceIn: study.studs.wallDistancesIn[index],
        support: "bear", bearingOn: "gable-board", orientation: "broad-face-outward" }));
  }
  return out;
}
