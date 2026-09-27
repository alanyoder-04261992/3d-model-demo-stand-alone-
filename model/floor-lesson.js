/* Manual floor study: only these three existing parts may be displayed.
   Pure selection data; it does not change the building or its construction. */
export const FLOOR_PIECES = Object.freeze([
  Object.freeze({ key: "supports", part: "skids", label: "Long supports underneath",
    description: "The 16-foot skids are treated wood. Their top notches receive the crosswise 2×6s, one inch down. At both ends, the bottom corners are cut at 45°, reaching 3 inches back from the tips.",
    draft: "Confirmed names: skids and notches. 4×6 nominal = 3½×5½ inches actual." }),
  Object.freeze({ key: "frame", part: "floor-frame", label: "Wooden floor frame",
    description: "The crosswise 2×6s sit one inch down in the skid notches. Standard spacing is 16 inches on center; extra notches allow 12 inches on center.",
    draft: "Proposed name: floor frame. We will confirm what your shop calls it." }),
  Object.freeze({ key: "deck", part: "floor-deck", label: "Flat sheets on top",
    description: "The flat sheets that cover the wooden frame and make the floor surface.",
    draft: "Possible shop terms: floor sheets or decking. We will confirm the name together." }),
]);

export function initialFloorSelection(step) {
  const key = FLOOR_PIECES.some((p) => p.key === step) ? step : "supports";
  return [key];
}

export function floorParts(selection) {
  const selected = new Set(Array.isArray(selection) ? selection : []);
  return FLOOR_PIECES.filter((p) => selected.has(p.key)).map((p) => p.part);
}

export function floorPiece(selection, focus) {
  const selected = new Set(Array.isArray(selection) ? selection : []);
  return FLOOR_PIECES.find((p) => selected.has(p.key) && p.key === focus)
    || FLOOR_PIECES.find((p) => selected.has(p.key)) || null;
}
