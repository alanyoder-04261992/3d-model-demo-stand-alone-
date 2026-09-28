/* THE FROZEN SNAPSHOT EVERY PART DRAWS FROM. Node-safe, pure.

   makePlan(state, cat) copies the live design (structuredClone), works out the
   building's frame (model/frame.js frameOf: size, walls, roof line,
   construction), adds the resolved colours, and deep-freezes the lot. A part
   only ever reads a plan, never the live state, so a part cannot change the
   design by accident, and two builds never share anything they could change.

   plan = {
     state          the copied design (items, colours as hex, porch fields...)
     style, t, d, W, L, topY, span, ws, prof, CAT, STEP, construction   (frameOf)
     colors         {body, trim, roof, door, shutters}: hex, with "match
                    siding / match trim" already worked out, plus names {...}
     look           the company's look settings {trueColour, scene}
     cat            the whole (frozen) catalogue, for anything else a part needs
   } */

import { frameOf } from "./frame.js";
import { colorName, sidingPalette, deepFreeze } from "./company.js";

export function makePlan(state, cat) {
  const s = structuredClone(state);
  const frame = frameOf(s, cat);
  const siding = sidingPalette(frame.t, cat.COLORS);
  const colors = {
    body: s.body,
    trim: s.trim,
    roof: s.roof,
    door: s.doorC || s.body,
    shutters: s.shutC || s.trim,
    names: {
      body: colorName(siding, s.body),
      trim: colorName(cat.COLORS.trim, s.trim),
      roof: colorName(cat.COLORS.metal, s.roof),
      door: s.doorC ? colorName(cat.COLORS.paint, s.doorC) : "Match siding",
      shutters: s.shutC ? colorName(cat.COLORS.paint, s.shutC) : "Match trim",
    },
  };
  const plan = Object.assign({ state: s, colors: colors, look: cat.look, cat: cat }, frame);
  return deepFreeze(plan);
}
