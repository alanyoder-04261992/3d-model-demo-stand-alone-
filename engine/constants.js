/* THE NUMBERS EVERY PART SHARES, lifted from Barnwright's 3ddesign.html.
   Node-safe: plain values, no DOM, no WebGL.

   These are look-defining. They came from the shop (see each note) and the
   golden test proves the drawing matches Barnwright's with them exactly as
   they are. Do not "correct" one without re-recording the golden fixtures on
   purpose -- CASING is the famous example: the board is 3 1/2 in, the number
   is 3.24 in, and every door, window and gap on every wall is built on 3.24. */

/* The siding texture has a groove every 8 in (LP rough-sawn panel). Wall UVs
   in the "sid" mode divide by this -- on metal buildings too, which is why a
   9 in metal rib tiles at 8 in. Keep it that way; the metal look depends on it. */
export const GROOVE = 0.667;

/* Metal roofing and metal siding: one raised rib every 9 in. */
export const RIB = 0.75;

/* Top of the floor deck above the ground. The shop's floor is 2x6 joists on
   skids with 5/8 in decking (2x4 joists on 8 ft wide and smaller); every wall,
   door and roof height is measured up from this line. */
export const y0 = 0.92;

/* Siding hangs 3 1/2 in past the bottom of the wall to nail into the 2x6 rim,
   which is why you never see a bare floor edge under the siding. */
export const SKIRT = 0.29;

/* The casing board that runs round every opening (and the shared middle board
   of a double window). Called 3 1/2 in; drawn at 3.24 in. Kept as drawn. */
export const CASING = 0.27;

/* The octagon gable window: 18 in of glass plus 0.4 ft of trim board each side.
   The catalogue width of the octagon must stay OCT_WIN + 2*OCT_TRIM = 2.3. */
export const OCT_WIN = 1.5;
export const OCT_TRIM = 0.4;

/* A real 2x4 is 1 1/2 in by 3 1/2 in. Used by the framing parts. */
export const LUMBER = Object.freeze({
  "2x4": [1.5 / 12, 3.5 / 12],
  "2x6": [1.5 / 12, 5.5 / 12],
  "2x8": [1.5 / 12, 7.25 / 12],
  "4x4": [3.5 / 12, 3.5 / 12],
  "4x6": [3.5 / 12, 5.5 / 12],
});
