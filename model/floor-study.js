/* The teaching page opts in to actual floor dimensions. Simply saving these
   settings on a company does not change its normal designer or golden look. */
import { deepFreeze } from "./company.js";

function positive(value, name) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0)
    throw new Error(`floorStudy.${name} must be a positive measurement.`);
  return value;
}

export function floorStudyPlan(plan) {
  const raw = plan.construction?.floorStudy;
  if (!raw) return plan;
  const skid = raw.skids || {}, joist = raw.joists || {}, notch = raw.notches || {};
  const widthIn = positive(skid.widthIn, "skids.widthIn");
  const heightIn = positive(skid.heightIn, "skids.heightIn");
  const lengthFt = positive(skid.lengthFt, "skids.lengthFt");
  const insetToInsideIn = skid.insetToInsideIn == null ? null
    : positive(skid.insetToInsideIn, "skids.insetToInsideIn");
  if (insetToInsideIn != null && (insetToInsideIn < widthIn || insetToInsideIn >= plan.W*6))
    throw new Error("floorStudy.skids.insetToInsideIn must keep two separate skids inside the outside-wall width.");
  const joistWidthIn = positive(joist.widthIn, "joists.widthIn");
  const joistHeightIn = positive(joist.heightIn, "joists.heightIn");
  const spacingIn = positive(joist.spacingIn ?? plan.construction.floor?.spacingIn, "joists.spacingIn");
  const depthIn = positive(notch.depthIn, "notches.depthIn");
  const notchWidthIn = positive(notch.widthIn, "notches.widthIn");
  const alternateSpacingIn = notch.alternateSpacingIn == null ? null
    : positive(notch.alternateSpacingIn, "notches.alternateSpacingIn");
  if (depthIn >= heightIn) throw new Error("floorStudy.notches.depthIn must leave wood below the notch.");
  if (notchWidthIn < joistWidthIn) throw new Error("floorStudy.notches.widthIn must fit the joist width.");
  if (spacingIn <= notchWidthIn || (alternateSpacingIn != null && alternateSpacingIn <= notchWidthIn))
    throw new Error("floorStudy notch spacing must leave wood between cuts.");
  const status = {};
  for (const key of ["skidSection", "skidLength", "joistSection", "standardSpacing", "alternateSpacing",
    "notchDepth", "notchWidth", "notchPositions", "supportOffset", "supportLayout", "frameFootprint", "rimSection", "deck"]) {
    status[key] = raw.status?.[key] === "confirmed" ? "confirmed" : "provisional";
  }
  const study = {
    skids: { nominal:skid.nominal || "4x6", widthIn,heightIn,lengthFt,insetToInsideIn,
      widthFt:widthIn/12,heightFt:heightIn/12 },
    joists: { nominal:joist.nominal || "2x6", widthIn:joistWidthIn,heightIn:joistHeightIn,
      spacingIn,widthFt:joistWidthIn/12,heightFt:joistHeightIn/12,spacingFt:spacingIn/12 },
    notches: { widthIn:notchWidthIn,depthIn,widthFt:notchWidthIn/12,depthFt:depthIn/12,
      alternateSpacingIn, alternateSpacingFt:alternateSpacingIn == null ? null : alternateSpacingIn/12,
      placement:alternateSpacingIn == null ? "cross-members" : "cross-members-and-alternate-grid" },
    joistBottomFt:(heightIn-depthIn)/12,
    joistTopFt:(heightIn-depthIn+joistHeightIn)/12,
    status,
  };
  const copy = structuredClone(plan);
  copy.floorStudy = study;
  return deepFreeze(copy);
}
