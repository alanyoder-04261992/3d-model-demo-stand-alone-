/* THE PICTURE OF A BUILDING ON "YOUR BUILDINGS", AND ITS KEY. Node-safe, pure.

   The Dealer Center's Buildings tab shows each building the business sells
   as the business's own 3D designer opens on it (docs/OFFICE.md, "Your
   buildings"). The owner's browser draws the pictures
   (ui/office/pictures.js) and keeps them; this file says WHAT is drawn and
   gives each picture a KEY, so a picture is drawn again only when what it
   shows changed.

   pictureState(cat, key)
       the design a customer lands on when they pick that style in the 3D
       designer: the opening design (model/design.js defaults), switched to
       the style (setType: the opening size if the style sells it, else its
       5th size, or its last), with its standard doors and windows, in the
       colors the 3D designer opens on. The same steps as
       tools/lib/style-facts.mjs typicalState, which makes the standard
       pictures in library/style-refs/.

   pictureKey(cat, key, recipe, engine)
       16 hex characters, from
         * the building's plan (model/plan.js makePlan of pictureState), with
           the whole catalogue (cat), the list of doors and windows with their
           prices (CAT) and the style's name (t.name) left out: a price or a
           new name never draws a picture again, a roof pitch, a wall height,
           a color the 3D designer opens on or a door moved in the standard
           layout always does;
         * engine: the hash of the built drawing code (__PICTURES_ID__), so a
           change to how buildings are drawn draws them all again;
         * recipe: what the picture is (its size, pixels per point, camera and
           backdrop).
       Two hashes (cyrb53) with different seeds, 8 hex characters each.

   Nothing here touches a browser, so tools/check-picture-key.mjs proves the
   key rules in Node. */

import { defaults, setType, normalize } from "./design.js";
import { makePlan } from "./plan.js";

/* the opening view of the 3D designer, on the studio backdrop */
export const PICTURE_CAMERA = Object.freeze({ yaw: 0.62, pitch: 0.215, fit: "fitref" });
export const PICTURE_BACKDROP = "#E9E9E5";
export const CARD_PICTURE = Object.freeze({ w: 400, h: 300 });
export const PAGE_PICTURE = Object.freeze({ w: 640, h: 480 });

const has = (o, k) => o != null && Object.prototype.hasOwnProperty.call(o, k);

export function pictureState(cat, key) {
  if (!cat || !has(cat.TYPES, key)) throw new Error(`"${key}" is not a building style this price list sells.`);
  const s = defaults(cat);
  if (s.type !== key) setType(s, key, cat);
  normalize(s, null, cat);
  s.sel = null;
  return s;
}

/* cyrb53 (public domain, bryc): a quick 53-bit string hash */
function cyrb53(str, seed = 0) {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}
const hex8 = (n) => (n % 4294967296).toString(16).padStart(8, "0");
export function hash16(text) {
  return hex8(cyrb53(text, 1)) + hex8(cyrb53(text, 7919));
}

/* The plan as the key reads it: no catalogue, no price list of doors, no name. */
export function leanPlan(plan) {
  const { cat: _cat, CAT: _CAT, t, ...rest } = plan;
  const { name: _name, ...tLean } = t || {};
  return { ...rest, t: tLean };
}

export function pictureKey(cat, key, recipe = {}, engine = "") {
  const plan = makePlan(pictureState(cat, key), cat);
  return hash16(JSON.stringify([leanPlan(plan), String(engine || ""), recipe]));
}

/* The size a picture shows ("10x20"), for "Drawn at 10×20". */
export function pictureSize(cat, key) {
  return pictureState(cat, key).size;
}
