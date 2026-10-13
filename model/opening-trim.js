/* One set of opening-trim measurements for the drawing, placement and plan.
   The shop uses actual 3 1/2 in boards (Alan, Oct 12 2026). A catalogue
   without that setting retains the recorded Barnwright drawing. */
import { CASING } from "../engine/constants.js";

export function openingTrim(frame) {
  const trim = frame?.construction?.openings?.trim;
  const measured = trim?.widthIn !== undefined;
  const width = measured ? trim.widthIn / 12 : CASING;
  return {
    measured,
    width,
    overlap: measured ? 0 : 0.02,
    headHeight: measured ? width : 0.29,
    sillHeight: measured ? width : 0.25,
    headFlare: measured ? width * Math.tan(Math.PI / 8) : 0.12,
    sillFlare: measured ? width * Math.tan(Math.PI / 8) : 0.10,
    continuous: String(trim?.headJoint || "reveal").toLowerCase() === "continuous",
  };
}
