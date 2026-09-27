/* Manual floor study: only these three existing parts may be displayed.
   Pure selection data; it does not change the building or its construction. */
export const FLOOR_PIECES = Object.freeze([
  Object.freeze({ key: "supports", part: "skids", label: "Long supports underneath",
    description: "The long wooden pieces that run underneath the floor.",
    draft: "Possible shop terms: skids or runners. We will confirm the name together." }),
  Object.freeze({ key: "frame", part: "floor-frame", label: "Wooden floor frame",
    description: "The rectangle of boards, with more boards crossing between its sides.",
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
