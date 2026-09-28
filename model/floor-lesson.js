/* Manual floor study: only these three existing parts may be displayed.
   Pure selection data; it does not change the building or its construction. */
export const FLOOR_PIECES = Object.freeze([
  Object.freeze({ key: "supports", part: "skids", label: "Long supports underneath",
    description: "The 16-foot skids are treated wood. Their top notches receive the crosswise 2×6s, one inch down. At both ends, the bottom corners are cut at 45°, reaching 3 inches back from the tips.",
    draft: "Confirmed names: skids and notches. 4×6 nominal = 3½×5½ inches actual." }),
  Object.freeze({ key: "frame", part: "floor-frame", label: "Wooden floor frame",
    description: "The crosswise 2×6s sit one inch down in the skid notches. Standard spacing is 16 inches on center; extra notches allow 12 inches on center.",
    draft: "Proposed name: floor frame. We will confirm what your shop calls it." }),
  Object.freeze({ key: "deck", part: "floor-deck", label: "Flooring",
    description: "4-by-8-foot tongue-and-groove sheets, 5/8 inch thick, cover the floor frame. The middle row runs 4 feet, 8 feet, then 4 feet, moving its end seams away from the neighboring rows. That offset is called staggered. The last row is trimmed to the remaining width.",
    draft: "Flooring is our confirmed term. The last row is 2 feet wide: 10 feet minus two 4-foot rows. The tongue-and-groove joint is specified; its detailed profile is not modeled." }),
]);

export function initialFloorSelection(step) {
  if(step === "joists") return ["supports", "frame"];
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
