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
  const endRebates = {};
  for (const end of ["negative","positive"]) {
    const rebate = notch.endRebates?.[end];
    if (rebate == null) continue;
    const endLengthIn = positive(rebate.lengthIn,`notches.endRebates.${end}.lengthIn`);
    const endDepthIn = positive(rebate.depthIn,`notches.endRebates.${end}.depthIn`);
    if (endLengthIn < joistWidthIn || endLengthIn >= lengthFt*12)
      throw new Error(`floorStudy.notches.endRebates.${end} must fit an end joist and leave timber along the skid.`);
    if (Math.abs(endDepthIn-depthIn)>1e-9)
      throw new Error(`floorStudy.notches.endRebates.${end} must use the floor's notch-seat depth.`);
    endRebates[end] = { lengthIn:endLengthIn,depthIn:endDepthIn,
      lengthFt:endLengthIn/12,depthFt:endDepthIn/12,seatYFt:(heightIn-endDepthIn)/12 };
  }
  if ((endRebates.negative?.lengthFt || 0)+(endRebates.positive?.lengthFt || 0) >= lengthFt)
    throw new Error("floorStudy end rebates must leave timber between the two ends.");
  let frame = null;
  if (raw.frame != null) {
    const frameWidthFt = raw.frame.widthFt == null ? null : positive(raw.frame.widthFt,"frame.widthFt");
    const sideBoardWidthIn = raw.frame.sideBoardWidthIn == null ? null
      : positive(raw.frame.sideBoardWidthIn,"frame.sideBoardWidthIn");
    if (frameWidthFt != null && (frameWidthFt > plan.W ||
      (sideBoardWidthIn != null && frameWidthFt*12 <= 2*sideBoardWidthIn)))
      throw new Error("floorStudy.frame.widthFt must fit the building width and leave space between its side boards.");
    const endCounts = {};
    for (const end of ["negative","positive"]) {
      const count = raw.frame.endCounts?.[end];
      if (count == null) continue;
      if (!Number.isInteger(count) || count < 1 || !endRebates[end] || count*joistWidthIn > endRebates[end].lengthIn+1e-9)
        throw new Error(`floorStudy.frame.endCounts.${end} must be a positive whole board count that fits its explicit end rebate.`);
      endCounts[end] = count;
    }
    let backing = null;
    if (raw.frame.backing != null) {
      const rawBacking = raw.frame.backing;
      const backingWidthIn = positive(rawBacking.widthIn,"frame.backing.widthIn");
      const backingHeightIn = positive(rawBacking.heightIn,"frame.backing.heightIn");
      const backingLengthIn = rawBacking.lengthIn == null ? null : positive(rawBacking.lengthIn,"frame.backing.lengthIn");
      if (backingWidthIn <= backingHeightIn || !["negative","positive"].includes(rawBacking.end) ||
        !(endCounts[rawBacking.end] >= 2))
        throw new Error("floorStudy.frame.backing must lie flat behind an explicitly doubled end package.");
      if (backingLengthIn != null && frameWidthFt != null && sideBoardWidthIn != null &&
        backingLengthIn > frameWidthFt*12-2*sideBoardWidthIn+1e-9)
        throw new Error("floorStudy.frame.backing.lengthIn must fit between the outer boards.");
      backing = { nominal:rawBacking.nominal || "2x4",widthIn:backingWidthIn,heightIn:backingHeightIn,
        widthFt:backingWidthIn/12,heightFt:backingHeightIn/12,lengthIn:backingLengthIn,
        lengthFt:backingLengthIn == null ? null : backingLengthIn/12,end:rawBacking.end,treated:rawBacking.treated===true,
        purpose:typeof rawBacking.purpose === "string" ? rawBacking.purpose : null };
    }
    frame = { widthFt:frameWidthFt,sideBoardWidthIn,treated:raw.frame.treated===true,
      sideBoardWidthFt:sideBoardWidthIn == null ? null : sideBoardWidthIn/12,endCounts,backing };
  }
  let bottomCuts = null;
  if (skid.bottomCuts != null) {
    const reachIn = positive(skid.bottomCuts.reachIn,"skids.bottomCuts.reachIn");
    const angleDeg = positive(skid.bottomCuts.angleDeg,"skids.bottomCuts.angleDeg");
    if (angleDeg >= 90) throw new Error("floorStudy.skids.bottomCuts.angleDeg must be less than 90 degrees.");
    const riseIn = angleDeg===45 ? reachIn : reachIn*Math.tan(angleDeg*Math.PI/180);
    if (reachIn*2 >= lengthFt*12 || riseIn >= heightIn-depthIn-1e-9)
      throw new Error("floorStudy.skids.bottomCuts must leave a flat bottom and wood beneath the notch seat at both tips.");
    bottomCuts = { reachIn,angleDeg,riseIn,reachFt:reachIn/12,riseFt:riseIn/12 };
  }
  let deck = null;
  if (raw.deck != null) {
    const sheetWidthFt = positive(raw.deck.sheetWidthFt,"deck.sheetWidthFt");
    const sheetLengthFt = positive(raw.deck.sheetLengthFt,"deck.sheetLengthFt");
    const thicknessIn = positive(raw.deck.thicknessIn,"deck.thicknessIn");
    const staggerFt = positive(raw.deck.staggerFt,"deck.staggerFt");
    if (staggerFt >= sheetLengthFt || raw.deck.layers !== 1 || raw.deck.orientation !== "lengthwise" || raw.deck.coverage !== "frame")
      throw new Error("floorStudy.deck needs one lengthwise layer over the frame and a stagger shorter than a full sheet.");
    deck = { sheetWidthFt,sheetLengthFt,thicknessIn,thicknessFt:thicknessIn/12,
      staggerFt,layers:1,orientation:"lengthwise",coverage:"frame",tongueAndGroove:raw.deck.tongueAndGroove===true };
  }
  const status = {};
  for (const key of ["skidSection", "skidLength", "skidTreatment", "joistSection", "standardSpacing", "alternateSpacing",
    "notchDepth", "notchWidth", "notchPositions", "endRebates", "endMemberPlacement", "bottomCuts",
    "supportOffset", "supportLayout", "frameFootprint", "frameWidth", "sideBoardWidth", "joistLength",
    "endBoardCounts", "endBoardMapping", "frameTreatment", "backingSection", "backingOrientation",
    "backingTreatment", "backingLocation", "backingLength", "backingLateralPosition", "backingPurpose", "rimSection", "deck",
    "deckSheetSize", "deckThickness", "deckTongueAndGroove", "deckStagger", "deckStaggerOffset", "deckOrientation",
    "deckTrimLastRow", "deckFootprint", "deckLayers", "deckEdgeProfile"]) {
    status[key] = ["confirmed","derived"].includes(raw.status?.[key]) ? raw.status[key] : "provisional";
  }
  const study = {
    skids: { nominal:skid.nominal || "4x6", widthIn,heightIn,lengthFt,insetToInsideIn,
      widthFt:widthIn/12,heightFt:heightIn/12,treated:skid.treated===true,bottomCuts },
    joists: { nominal:joist.nominal || "2x6", widthIn:joistWidthIn,heightIn:joistHeightIn,
      spacingIn,widthFt:joistWidthIn/12,heightFt:joistHeightIn/12,spacingFt:spacingIn/12 },
    notches: { widthIn:notchWidthIn,depthIn,widthFt:notchWidthIn/12,depthFt:depthIn/12,
      alternateSpacingIn, alternateSpacingFt:alternateSpacingIn == null ? null : alternateSpacingIn/12,endRebates,
      placement:alternateSpacingIn == null ? "cross-members" : "cross-members-and-alternate-grid" },
    frame,deck,
    joistBottomFt:(heightIn-depthIn)/12,
    joistTopFt:(heightIn-depthIn+joistHeightIn)/12,
    status,
  };
  const copy = structuredClone(plan);
  copy.floorStudy = study;
  return deepFreeze(copy);
}
