/* An explicitly selected, measured truss preview. This does not reuse the
   ordinary designer's roof profile, spacing or connector defaults. */
import { deepFreeze } from "./company.js";
import { prismMember, polyArea, clipHalf, cleanPoly } from "../parts/floor-frame.js";

function positive(value, name) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0)
    throw new Error(`trussStudy.${name} must be a positive measurement.`);
  return value;
}

/* Given the long OUTER edges, solve the two slopes. The plain lower
   underside passes through the outer top corner of the gable board.
   This seating and the square tail cut are preview assumptions, not a
   shop cut list. All working lengths here are inches. */
function solveProfile(upper, lower, rise, tipX, bearingX, depth) {
  function evaluate(angle) {
    const c = Math.cos(angle), s = Math.sin(angle);
    const tipY = depth / c - (tipX - bearingX) * s / c;
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
    throw new Error("The truss measurements do not give one valid plain-bearing lofted profile; confirm the dimensions and cuts.");
  const fit = roots[0], upperSlope = Math.tan(fit.upperAngle), lowerSlope = Math.tan(fit.lowerAngle);
  const innerPeakY = rise - depth / Math.cos(fit.upperAngle);
  const innerKneeX = (lowerSlope * bearingX - innerPeakY) / (lowerSlope - upperSlope);
  const innerKneeY = innerPeakY - upperSlope * innerKneeX;
  const innerTipX = tipX - depth * Math.sin(fit.lowerAngle);
  const innerTipY = fit.tipY - depth * Math.cos(fit.lowerAngle);
  if (innerPeakY <= 0 || innerKneeX <= 0 || innerKneeY <= 0 || innerTipX < bearingX - 1e-8 ||
      innerKneeX >= innerTipX || innerKneeX >= fit.kneeX || innerKneeY >= fit.kneeY)
    throw new Error("The truss preview cuts do not leave a full-depth board clear of the gable board.");
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
  if (raw.bearing !== "plain-edge-on-board-corner" || raw.tailCut !== "square-to-member" ||
      raw.layout !== "mirrored-about-center")
    throw new Error("The truss preview needs its declared bearing, tail cut and mirrored layout assumptions.");
  const thicknessIn = positive(raw.chord?.thicknessIn, "chord.thicknessIn");
  const depthIn = positive(raw.chord?.depthIn, "chord.depthIn");
  const upperLengthIn = positive(raw.upperLengthIn, "upperLengthIn");
  const lowerLengthIn = positive(raw.lowerLengthIn, "lowerLengthIn");
  const peakRiseIn = positive(raw.peakRiseIn, "peakRiseIn");
  const projectionIn = positive(raw.projectionIn, "projectionIn");
  const widthIn = positive(raw.studs?.widthIn, "studs.widthIn");
  const studThicknessIn = positive(raw.studs?.thicknessIn, "studs.thicknessIn");
  const spacingIn = positive(raw.studs?.spacingIn, "studs.spacingIn");
  if (raw.studs?.layoutOrigin !== "center" || raw.studs?.orientation !== "broad-face-outward")
    throw new Error("The gable-stud preview needs its declared center layout and outward face assumptions.");
  const gable = plan.gableStudy, plate = plan.wallStudy.upperPlateRange;
  if (thicknessIn >= depthIn || thicknessIn > gable.board.thicknessIn + 1e-9 ||
      studThicknessIn > gable.board.thicknessIn + 1e-9 || spacingIn <= widthIn || widthIn <= studThicknessIn)
    throw new Error("The truss and turned gable studs must fit on the gable board and remain separate members.");
  const centerU = (plate.u0 + plate.u1) / 2, bearingIn = gable.range.lengthFt * 6;
  if (Math.abs((gable.range.u0 + gable.range.u1) / 2 - centerU) > 1e-9)
    throw new Error("This mirrored truss preview requires a centered gable board; resolve asymmetric seating first.");
  const tipIn = plate.lengthFt * 6 + projectionIn;
  if (tipIn <= bearingIn) throw new Error("The truss tip must project beyond the gable board for this preview fit.");
  const profile = solveProfile(upperLengthIn, lowerLengthIn, peakRiseIn, tipIn, bearingIn, depthIn);
  const floor = plan.wallStudy.floorBounds;
  const centerXFt = (floor.x0Ft + floor.x1Ft) / 2 + centerU;
  const centerZFt = floor.z0Ft - (gable.innerFaceOffsetFt + gable.outerFaceOffsetFt) / 2;
  const status = {};
  for (const key of ["section", "upperLength", "lowerLength", "peakRise", "projection", "projectionDatum",
    "trussPlacement", "studPlacement", "studSpacing", "studTurnedOutward", "mirror", "bearing", "tailCut",
    "mitres", "depthAlignment", "studSection", "studFace", "studLayoutOrigin", "treatment"])
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
    centerXFt, centerZFt, baseYFt: gable.topYFt, topYFt: gable.topYFt + peakRiseIn / 12,
    bearing: raw.bearing, tailCut: raw.tailCut, layout: raw.layout,
    studs: { nominal: raw.studs.nominal || "2x4", widthIn, widthFt: widthIn / 12,
      thicknessIn: studThicknessIn, thicknessFt: studThicknessIn / 12, spacingIn, spacingFt: spacingIn / 12,
      layoutOrigin: "center", orientation: "broad-face-outward" },
    profile, status,
    assumptionNotes: [
      `Preview mirrors the marked ${projectionIn}-inch projection at both ends.`,
      "Preview uses a plain underside seated at the gable-board corner; a seat notch is not confirmed.",
      "Tail cuts are square across the stock; knee and peak cuts share mitres. These are provisional cuts.",
      `Preview gable studs are ${raw.studs.nominal || "2x4"}s with their broad face outward, starting under the peak and centered on the board depth.`,
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
    [study.centerXFt, study.baseYFt, study.centerZFt - thicknessFt / 2],
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
        ...(kind === "truss-lower" ? { support: "bear", bearingOn: "gable-board" } : {}) }));
  }
  return out;
}

export function trussGableStudMembers(plan) {
  if (!plan.trussStudy) return [];
  const study = plan.trussStudy, p = study.profile, out = [];
  const width = study.studs.widthIn, spacing = study.studs.spacingIn, bearing = study.bearingHalfSpanFt * 12;
  for (let index = -Math.floor((bearing - width / 2) / spacing); index <= Math.floor((bearing - width / 2) / spacing); index++) {
    const center = index * spacing, x0 = center - width / 2, x1 = center + width / 2;
    let poly = [[x0, 0], [x1, 0], [x1, study.peakRiseIn], [x0, study.peakRiseIn]];
    // The four inward-offset chord lines form the exact roof underside.
    for (const slope of [-p.upperSlope, p.upperSlope]) poly = clipHalf(poly, -slope, -1, p.innerPeakY);
    for (const slope of [-p.lowerSlope, p.lowerSlope]) poly = clipHalf(poly, -slope, -1, p.lowerSlope * bearing);
    poly = cleanPoly(poly);
    if (poly.length < 3 || polyArea(poly) <= 0 || Math.min(...poly.filter(q => q[1] > 1e-8).map(q => q[1])) <= 0)
      throw new Error("A preview gable stud does not fit below the truss.");
    out.push(member(plan, "gable-stud", poly, study.studs.thicknessFt,
      { name: "Gable stud", size: study.studs.nominal, centerIn: center, layoutIndex: index,
        support: "bear", bearingOn: "gable-board", orientation: "broad-face-outward" }));
  }
  return out;
}
