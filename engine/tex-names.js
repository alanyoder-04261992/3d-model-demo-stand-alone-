/* THE NAMES OF THE ELEVEN SURFACE PICTURES (textures). Node-safe.

   A part never holds a real WebGL texture -- it says which picture a surface
   wears by name ("siding", "trim" ...), so a building can be put together in
   Node with no graphics card at all (the golden test does exactly that). The
   renderer swaps each name for the real texture when it draws.

   The identifiers are Barnwright's own (texSiding, texTrim ...), so ported
   code reads exactly as it did: `mat("trim", texTrim, ...)`.

   TEX_ORDER is the order Barnwright paints them in when the page opens
   (3ddesign.html lines 1750-2054). The order matters for one reason: the
   repeatable test randomness (engine/seeded.js) numbers the pictures by it,
   0 = siding ... 10 = the corner shadow. */

export const texSiding = "siding";       /* LP rough-sawn 8 in panel, one board per tile */
export const texMetal = "metal";         /* 9 in metal wall panel: rib, flutes, screws */
export const texTrim = "trim";           /* painted wood trim board */
export const texFlat = "flat";           /* plain, for small parts and solid colours */
export const texGrass = "grass";         /* St Augustine lawn, 3 ft per tile (yard scene) */
export const texGlass = "glass";         /* not a picture: the glass shader's channel map */
export const texRoofMetal = "roofMetal"; /* roof pan between the ribs (ribs are geometry) */
export const texRoofCap = "roofCap";     /* the ridge cap, a plain bent sheet */
export const texAO = "ao";               /* soft contact shadow under the building */
export const texAOv = "aoV";             /* the shadow under an eave */
export const texAOcorner = "aoCorner";   /* the hairline shadow beside a corner board */

export const TEX_ORDER = Object.freeze([
  texSiding, texMetal, texTrim, texFlat, texGrass, texGlass,
  texRoofMetal, texRoofCap, texAO, texAOv, texAOcorner,
]);
