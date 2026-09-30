/* GABLE BACKING: Alan's horizontal 2x4 siding-seam support across the gable,
   present when that gable has no window or fake window. Their bottoms are
   11 inches above the TOP OF THE UPPER PLATE, not above the gable board.
   Actual lumber is 1.5 x 3.5 inches. Alan confirmed the broad faces align
   outward with the wide faces of the gable studs.
   Fill internal stud bays AND the outer bays, right out to the truss.
   Outer ends follow the existing behind-truss-face preview joint.
   This rule is enabled only in the learned truss/gable assembly. */
import { prismMember, drawMembers, clipHalf, cleanPoly, polyArea } from "./floor-frame.js";
import { trussGableStudMembers } from "../model/truss-study.js";

export function gableBackingRule(plan) {
  const raw = plan.construction?.gableBacking;
  if (!plan.trussStudy || !raw) return null;
  for (const key of ["thicknessIn", "heightIn", "bottomOffsetIn"])
    if (!Number.isFinite(raw[key]) || raw[key] <= 0)
      throw new Error(`gableBacking.${key} must be a positive measurement.`);
  if (raw.datum !== "upper-plate-top" || raw.orientation !== "broad-face-outward" ||
      raw.when !== "no-window-or-fake-window")
    throw new Error("Gable backing needs the upper-plate datum, outward face and no-window condition.");
  if (raw.thicknessIn > plan.trussStudy.studs.thicknessIn + 1e-9 || raw.heightIn <= raw.thicknessIn ||
      raw.bottomOffsetIn < plan.gableStudy.board.heightIn - 1e-9)
    throw new Error("The backing section must fit the gable studs and clear the gable board.");
  const end = plan.trussStudy.end;
  const windowPresent = Boolean(plan.trussStudy.windowOpening) || (plan.state.items || []).some(item => {
    const entry = plan.CAT[item.cat];
    return item.wall === end && entry && !entry.int &&
      (entry.gable || entry.draw === "faux-loft");
  });
  return { ...raw, end, enabled: !windowPresent,
    bottomYFt: plan.wallStudy.topYFt + raw.bottomOffsetIn / 12,
    topYFt: plan.wallStudy.topYFt + (raw.bottomOffsetIn + raw.heightIn) / 12 };
}

function contains(poly, x, y) {
  return poly.every((p, i) => {
    const q = poly[(i + 1) % poly.length];
    return (q[0] - p[0]) * (y - p[1]) - (q[1] - p[1]) * (x - p[0]) >= -1e-8;
  });
}

export function gableBackingMembers(plan) {
  const rule = gableBackingRule(plan);
  if (!rule?.enabled) return [];
  const study = plan.trussStudy;
  const studs = trussGableStudMembers(plan).sort((a, b) => a.meta.centerIn - b.meta.centerIn);
  const y0 = rule.bottomYFt - study.baseYFt, y1 = rule.topYFt - study.baseYFt;
  const out = [];
  function add(poly, meta) {
    const bottom = poly.filter(p => Math.abs(p[1] - y0) < 1e-8).sort((a,b) => a[0]-b[0]);
    const top = poly.filter(p => Math.abs(p[1] - y1) < 1e-8).sort((a,b) => a[0]-b[0]);
    if (polyArea(poly) <= 0 || bottom.length < 2 || top.length < 2)
      throw new Error("Gable backing must fit its full height below the outer truss.");
    const item = prismMember("gable-backing", "lumber", poly,
      [study.centerXFt, study.baseYFt, study.boardFrontZFt - rule.thicknessIn / 12],
      [1,0,0], [0,1,0], [0,0,1], rule.thicknessIn / 12,
      { wall: rule.end, lesson: true, name: "Gable backing", size: rule.nominal,
        orientation: rule.orientation, purpose: "siding-seam-support", ...meta,
        grainEdgeIn: [bottom[0], bottom.at(-1)].map(p => p.map(v => v * 12)),
        topLengthIn: (top.at(-1)[0] - top[0][0]) * 12,
        faceWidthFt: rule.heightIn / 12, bottomDatum: rule.datum, bottomOffsetIn: rule.bottomOffsetIn });
    item.stage = "roof-frame";
    out.push(item);
  }
  if (!studs.length) throw new Error("Gable backing needs the gable stud layout.");
  function outer(stud, side) {
    const x = side === "left" ? Math.min(...stud.poly.map(p => p[0])) : Math.max(...stud.poly.map(p => p[0]));
    if (![y0,y1].every(y => contains(stud.poly,x,y)))
      throw new Error("The outer backing must contact the full height of the outermost stud.");
    const p = study.profile, tip = p.tip[0]/12;
    const x0 = side === "left" ? -tip : x, x1 = side === "left" ? x : tip;
    let poly = [[x0,y0],[x1,y0],[x1,y1],[x0,y1]];
    // Like the stud tops, these ends reach behind the truss for face contact.
    // The owner's extent is confirmed; this precise cut/joint is a preview fit.
    for (const slope of [-p.upperSlope,p.upperSlope])
      poly = clipHalf(poly,-slope,-1,study.peakRiseIn/12);
    for (const slope of [-p.lowerSlope,p.lowerSlope])
      poly = clipHalf(poly,-slope,-1,(p.tipY+p.lowerSlope*p.tip[0])/12);
    add(cleanPoly(poly), { bay: "outer", side, adjacentStud: stud.meta.layoutIndex,
      endFit: "behind-truss-face", endFitStatus: "provisional" });
  }
  outer(studs[0], "left");
  for (let i = 0; i < studs.length - 1; i++) {
    const left = studs[i], right = studs[i + 1];
    const x0 = Math.max(...left.poly.map(p => p[0])), x1 = Math.min(...right.poly.map(p => p[0]));
    if (x1 <= x0 || ![y0, y1].every(y => contains(left.poly, x0, y) && contains(right.poly, x1, y)))
      throw new Error("Gable backing must fit fully between both neighboring studs at its specified height.");
    add([[x0,y0],[x1,y0],[x1,y1],[x0,y1]],
      { bay: "internal", betweenStuds: [left.meta.layoutIndex, right.meta.layoutIndex] });
  }
  outer(studs.at(-1), "right");
  return out;
}

export default {
  id: "gable-backing", name: "Gable backing", stage: "roof-frame",
  realLife: "Horizontal backing across the gable to the outer truss supports siding seams. Used with no gable window or fake window; its bottom is measured from the upper-plate top.",
  appliesTo(plan) { return Boolean(gableBackingRule(plan)?.enabled); },
  members: gableBackingMembers,
  build(plan, kit) { drawMembers(kit, gableBackingMembers(plan), "roof-frame"); },
};
