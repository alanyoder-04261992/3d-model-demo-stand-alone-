/* GABLE BACKING: Alan's horizontal 2x4 pieces between the gable studs,
   present when that gable has no window or fake window. Their bottoms are
   11 inches above the TOP OF THE UPPER PLATE, not above the gable board.
   Actual lumber is 1.5 x 3.5 inches. Alan confirmed the broad faces align
   outward with the wide faces of the gable studs.
   Lengths come from the clear distance between neighboring stud faces.
   This rule is enabled only in the learned truss/gable assembly. */
import { prismMember, drawMembers } from "./floor-frame.js";
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
  for (let i = 0; i < studs.length - 1; i++) {
    const left = studs[i], right = studs[i + 1];
    const x0 = Math.max(...left.poly.map(p => p[0])), x1 = Math.min(...right.poly.map(p => p[0]));
    if (x1 <= x0 || ![y0, y1].every(y => contains(left.poly, x0, y) && contains(right.poly, x1, y)))
      throw new Error("Gable backing must fit fully between both neighboring studs at its specified height.");
    const item = prismMember("gable-backing", "lumber", [[x0,y0],[x1,y0],[x1,y1],[x0,y1]],
      [study.centerXFt, study.baseYFt, study.boardFrontZFt - rule.thicknessIn / 12],
      [1,0,0], [0,1,0], [0,0,1], rule.thicknessIn / 12,
      { wall: rule.end, lesson: true, name: "Gable backing", size: rule.nominal,
        orientation: rule.orientation, betweenStuds: [left.meta.layoutIndex, right.meta.layoutIndex],
        grainEdgeIn: [[x0 * 12, y0 * 12], [x1 * 12, y0 * 12]],
        faceWidthFt: rule.heightIn / 12, bottomDatum: rule.datum, bottomOffsetIn: rule.bottomOffsetIn });
    item.stage = "roof-frame";
    out.push(item);
  }
  return out;
}

export default {
  id: "gable-backing", name: "Gable backing", stage: "roof-frame",
  realLife: "Horizontal backing between the gable studs when this gable has no window or fake window; its bottom is measured from the upper-plate top.",
  appliesTo(plan) { return Boolean(gableBackingRule(plan)?.enabled); },
  members: gableBackingMembers,
  build(plan, kit) { drawMembers(kit, gableBackingMembers(plan), "roof-frame"); },
};
