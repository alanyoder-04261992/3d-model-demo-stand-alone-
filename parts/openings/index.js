/* DOORS, WINDOWS, LIGHTS AND EXTRA PORCH POSTS: everything the customer puts
   ON the building. Node-safe.

   This is PIPELINE entry 14, "openings" (parts/index.js): Barnwright's
   buildShed line 4043, `state.items.forEach(function(it){ renderItem(it,ws,prof); })`,
   run after the roof and the dormer and before the ground. It walks the
   building's items IN THE ORDER THE CUSTOMER ADDED THEM (plan.state.items),
   exactly as renderItem was called, because the order decides which material
   is made first -- and the first call for a material decides its paint and
   its place in the draw order (parts/README.md, "first call wins").

   For each item (common.js eachItem, Barnwright's renderItem preamble,
   3122-3140):
   1. an item that lives INSIDE the building (bench, shelf, outlets, the
      overhead light -- the `int` trait) is skipped before anything else: it is
      drawn on the floor plan, not in 3D, and makes no material;
   2. a transom stood on end swaps its width and height; a wooden shop door
      takes the shop's door height for this roof (plan.construction
      openings.doorHeightIn: 71 1/2 in on loft builds, 76 1/2 in on tall
      walls);
   3. the item becomes the one being drawn (kit.setItem -- the selected one
      glows blue) and the five materials Barnwright makes for EVERY item are
      made, in its order: trim, body (with its weathering), dark, white,
      glass;
   4. it is handed to its DRAW MODULE, chosen by the item's `draw` trait in
      the catalogue (never by its code), and every triangle it draws is
      attributed to that module's part:
        shop-door              door-wood.js     stage doors
        steel-6panel           door-steel.js    stage doors
        lite-door              door-lite.js     stage doors
        roll-up                roll-up.js       stage doors
        window, transom        window.js        stage windows (shutters: extras)
        faux-loft, gable-1824,
        octagon                gable-window.js  stage windows
        light                  light.js         stage extras
        porch-post             porch-post.js    stage porch-frame
   5. kit.setItem(null) on every way out.

   The trim round every door and window (the casings, the head board, the
   porch header band, the window sill) and the item primitives are shared, in
   common.js.

   A draw trait this folder does not know falls back the way Barnwright's
   renderItem branched: a gable item to the gable window, a light to the
   light, a porch post to the post, anything else to the wall window (its
   final else). A company's catalogue should never need that.

   Barnwright source: renderItem (3ddesign.html 3122-3574) and renderGableWin
   (3575-3705). Porting edits: see common.js and each draw module. */

import { eachItem, drawWith } from "./common.js";
import doorWood from "./door-wood.js";
import doorSteel from "./door-steel.js";
import doorLite from "./door-lite.js";
import rollUp from "./roll-up.js";
import windowPart from "./window.js";
import gableWindow from "./gable-window.js";
import light from "./light.js";
import porchPost from "./porch-post.js";

/* every draw module, and the draw traits each one draws */
export const DRAW_MODULES = Object.freeze([doorWood, doorSteel, doorLite, rollUp, windowPart, gableWindow, light, porchPost]);
export const BY_DRAW = Object.freeze(DRAW_MODULES.reduce(function (o, m) {
  m.draws.forEach(function (d) { o[d] = m; });
  return o;
}, {}));

/* Which draw module draws this (possibly overridden) catalogue entry. */
export function moduleFor(c) {
  if (Object.prototype.hasOwnProperty.call(BY_DRAW, c.draw)) return BY_DRAW[c.draw];
  /* Barnwright's own branch order, for a draw trait nobody taught us */
  if (c.gable) return gableWindow;
  if (c.k === "light") return light;
  if (c.k === "post") return porchPost;
  return windowPart;
}

export default {
  id: "openings",
  name: "Doors, windows and lights",
  stage: ["doors", "windows", "extras", "porch-frame"],
  realLife: "Every door, window, roll-up, gable window, outside light and extra porch post the customer placed on the building, each with its own trim.",
  appliesTo(plan) { return true; },
  build(plan, kit) {
    /* items */
    eachItem(plan, kit, null, function (it, c, mats) {
      drawWith(plan, kit, moduleFor(c), it, c, mats);
    });
  },
};
