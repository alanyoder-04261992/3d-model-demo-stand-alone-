/* THE ORDER A SHED IS DRAWN IN: the PIPELINE. Node-safe.

   engine/assemble.js runs these entries one after another to put a whole
   building together. The order is Barnwright's own buildShed
   (3ddesign.html lines 3854-4078), read line by line, and it matters: the
   first part to ask for a material decides its paint, and the order the
   materials are first asked for is the order they are drawn in (see
   parts/README.md, "first call wins"). Never reorder the finished entries.

   Each entry:
     entry   the name of this step (usually the part's id)
     module  the part (parts/<id>.js default export)
     file    where it lives, for the checks and for people
     frame   true for NEW framing (Barnwright drew none): run only when a view
             asks for it (assemble(plan, {frames: true})), after everything else
     part    the part id assemble wraps the entry in (kit.part): every triangle
             it draws belongs to this part unless the module says otherwise
     tags    the part ids (golden labels) this entry's triangles can carry --
             how tools/check-golden.mjs knows which parts are still pending

   A PIPELINE ENTRY IS A BARNWRIGHT CALL SITE, NOT A PART BOUNDARY. Three
   places where that shows:
   * skids and floor: Barnwright draws both in ONE loop (a skid box, then the
     deck slab, per floor segment). They go into different materials, so
     running all the skids and then all the slabs gives every material the
     same triangles in the same order.
   * siding: on a kennel the walls loop draws the open front (kennelFront) and
     the run walls (kennelSide) from inside the loop; those live in
     parts/kennel.js and are attributed to "kennel". The kennel entry itself
     is only kennelExtras.
   * gable-siding / gable-band / gable-vent: Barnwright does F then B for all
     three inside one loop; each goes into its own material, so three entries
     give the same triangles in the same order.

   fillRealLife(template, construction) fills a part's caption:
   {floor.joist} -> plan.construction.floor.joist. */

import skids from "./skids.js";
import floor from "./floor.js";
import siding from "./siding.js";
import cornerTrim from "./corner-trim.js";
import porchJunction from "./porch-junction.js";
import kennel from "./kennel.js";
import gableSiding from "./gable-siding.js";
import gableBand from "./gable-band.js";
import gableVent from "./gable-vent.js";
import beltBand from "./belt-band.js";
import porch from "./porch.js";
import roofing from "./roofing.js";
import dormer from "./dormer.js";
import openings from "./openings/index.js";
import ground from "./ground.js";
import ramp from "./ramp.js";
import foundation from "./foundation.js";
import floorFrame from "./floor-frame.js";
import floorDeck from "./floor-deck.js";
import wallFrame from "./wall-frame.js";
import windowHeader from "./window-header.js";
import windowPlate from "./window-plate.js";
import gableFrame from "./gable-frame.js";
import gableBacking from "./gable-backing.js";
import gableWindowFrame from "./gable-window-frame.js";
import roofFrame from "./roof-frame.js";
import loft from "./loft.js";
import roofDeck from "./roof-deck.js";
import dormerFrame from "./dormer-frame.js";
import porchDeckFrame from "./porch-deck-frame.js";
import interior from "./interior.js";

/* The golden part labels a door/window/light entry can carry (by the item's
   draw trait; tools/lib/barnwright-blocks.mjs ITEM_PARTS). */
export const OPENING_TAGS = Object.freeze(["door-wood", "door-steel", "door-lite", "roll-up", "window", "gable-window", "light", "porch-post"]);

function e(entry, module, file, frame, part, tags) {
  return Object.freeze({ entry, module, file, frame, part, tags: Object.freeze(tags) });
}

export const PIPELINE = Object.freeze([
  /* ---- the finished building, in Barnwright's buildShed order ---- */
  e("skids",          skids,          "parts/skids.js",            false, "skids",          ["skids"]),          /* 3872-3875 floor loop: skid boxes */
  e("floor",          floor,          "parts/floor.js",            false, "floor",          ["floor"]),          /* 3876-3877 floor loop: deck slab */
  e("siding",         siding,         "parts/siding.js",           false, "siding",         ["siding", "kennel"]), /* 3878-3905 walls loop (+ kennel front/side) */
  e("corner-trim",    cornerTrim,     "parts/corner-trim.js",      false, "corner-trim",    ["corner-trim"]),    /* 3906-3945 */
  e("porch-junction", porchJunction,  "parts/porch-junction.js",   false, "porch",          ["porch"]),          /* 3946-3960 */
  e("kennel",         kennel,         "parts/kennel.js",           false, "kennel",         ["kennel"]),         /* 3961 kennelExtras */
  e("gable-siding",   gableSiding,    "parts/gable-siding.js",     false, "gable-siding",   ["gable-siding"]),   /* 3962-3979 */
  e("gable-band",     gableBand,      "parts/gable-band.js",       false, "gable-band",     ["gable-band"]),     /* 3980-4001 */
  e("gable-vent",     gableVent,      "parts/gable-vent.js",       false, "gable-vent",     ["gable-vent"]),     /* 4002-4014 */
  e("belt-band",      beltBand,       "parts/belt-band.js",        false, "belt-band",      ["belt-band"]),      /* 4015-4019 */
  e("porch",          porch,          "parts/porch.js",            false, "porch",          ["porch"]),          /* 4020-4034 */
  e("roofing",        roofing,        "parts/roofing.js",          false, "roofing",        ["roofing"]),        /* 4035-4039 profileRoof */
  e("dormer",         dormer,         "parts/dormer.js",           false, "dormer",         ["dormer"]),         /* 4040-4041 */
  e("openings",       openings,       "parts/openings/index.js",   false, "openings",       OPENING_TAGS),       /* 4043 renderItem per item */
  e("ground",         ground,         "parts/ground.js",           false, "ground",         ["ground"]),         /* 4044-4074 lawn, contact shadow, eave AO */
  /* ---- NEW, only when a ramp is chosen ---- */
  e("ramp",           ramp,           "parts/ramp.js",             false, "ramp",           ["ramp"]),
  /* ---- NEW framing: only with assemble(plan, {frames: true}) ---- */
  e("foundation",       foundation,     "parts/foundation.js",       true, "foundation",       ["foundation"]),
  e("floor-frame",      floorFrame,     "parts/floor-frame.js",      true, "floor-frame",      ["floor-frame"]),
  e("floor-deck",       floorDeck,      "parts/floor-deck.js",       true, "floor-deck",       ["floor-deck"]),
  e("wall-frame",       wallFrame,      "parts/wall-frame.js",       true, "wall-frame",       ["wall-frame"]),
  e("window-header",    windowHeader,   "parts/window-header.js",    true, "window-header",    ["window-header"]),
  e("window-plate",     windowPlate,    "parts/window-plate.js",     true, "window-plate",     ["window-plate"]),
  e("gable-frame",      gableFrame,     "parts/gable-frame.js",      true, "gable-frame",      ["gable-frame"]),
  e("roof-frame",       roofFrame,      "parts/roof-frame.js",       true, "roof-frame",       ["roof-frame"]),
  e("gable-backing",    gableBacking,   "parts/gable-backing.js",    true, "gable-backing",    ["gable-backing"]),
  e("gable-window-frame", gableWindowFrame, "parts/gable-window-frame.js", true, "gable-window-frame", ["gable-window-frame"]),
  e("loft",             loft,           "parts/loft.js",             true, "loft",             ["loft"]),
  e("roof-deck",        roofDeck,       "parts/roof-deck.js",        true, "roof-deck",        ["roof-deck"]),
  e("dormer-frame",     dormerFrame,    "parts/dormer-frame.js",     true, "dormer-frame",     ["dormer-frame"]),
  e("porch-deck-frame", porchDeckFrame, "parts/porch-deck-frame.js", true, "porch-deck-frame", ["porch-deck-frame"]),
  e("interior",         interior,       "parts/interior.js",         true, "interior",         ["interior"]),
]);

/* Is this golden part label still waiting on a stub? A label is ready only
   when EVERY entry that can draw it is finished (the kennel label needs both
   the kennel part and the siding loop that calls it; the porch label needs
   the porch and the porch-junction entries). A module's `pending` may be
   true (all of it) or a list of the labels still pending. */
export function entryPendingFor(entry, tag) {
  const p = entry.module && entry.module.pending;
  if (p === true) return true;
  if (Array.isArray(p)) return p.indexOf(tag) >= 0;
  return false;
}
export function tagPending(tag, pipeline = PIPELINE) {
  for (const en of pipeline) {
    if (en.tags.indexOf(tag) >= 0 && entryPendingFor(en, tag)) return true;
  }
  return false;   /* a label no entry claims is never "pending": it is a mistake */
}
/* Which entries (by name) still hold a label back. */
export function pendingEntriesFor(tag, pipeline = PIPELINE) {
  return pipeline.filter((en) => en.tags.indexOf(tag) >= 0 && entryPendingFor(en, tag)).map((en) => en.entry);
}

/* A part's caption, filled from the building's construction settings.
   {a.b.c} is plan.construction.a.b.c. Returns { text, missing } -- missing
   lists every placeholder that did not lead to a plain value (text or a
   number), so a check can refuse a caption that would print "{...}". */
export function fillRealLife(template, construction) {
  const missing = [];
  const text = String(template || "").replace(/\{([^{}]*)\}/g, function (m, path) {
    let v = construction;
    for (const k of String(path).split(".")) {
      if (v == null || typeof v !== "object" || !Object.prototype.hasOwnProperty.call(v, k)) { v = undefined; break; }
      v = v[k];
    }
    if (typeof v === "string" || typeof v === "number") return String(v);
    missing.push(path);
    return m;
  });
  return { text, missing };
}
