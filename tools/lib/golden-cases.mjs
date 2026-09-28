/* THE BUILDINGS WE ASK BARNWRIGHT TO DRAW, AND THE FORMAT WE RECORD THEM IN.

   tools/capture-golden.mjs opens Barnwright's 3D designer and, for every case
   listed here, sets the building up exactly the way a customer would -- only
   through Barnwright's own functions (pick a style, pick a size, add a door
   facing a wall, flip the porch, tick shutters...) -- then records every
   triangle it draws. tools/check-golden.mjs later feeds the same recorded
   building to our engine and demands the same triangles.

   The matrix:
     * every style x its smallest size, its "typical" size (the size
       Barnwright's setType lands on from the page's opening state, which is a
       10x20 Lofted Barn) and its largest size, each with its standard doors
       and windows;
     * variations: colours (paint and metal palettes, door and shutter
       colours), dormers, side and corner porches (length, flip, middle),
       porch posts, the selection glow, double windows, shutters, door
       windows, every door / window / roll-up / gable-window kind added to
       walls (gable windows on the ends and on side walls), a turned transom,
       outside lights at moved heights, interior items and electric packages
       (no 3D, but carried in the state), resizes that keep the items, dragged
       items, and the kennel.

   A case is a list of STEPS, run in the page by tools/lib/golden-page.mjs
   (inPageRunSteps). The steps say what a person does, in Barnwright's terms:
     setType, setSize, resetItems, flipPorch, porchLen, porchMid, dormer,
     color (a swatch, by colour NAME), opt, elec, ramp,
     addItem {cat, face}   -- turn the camera to face that wall, press add
     addInterior {cat}
     edit {item, set, toWall} -- an item-sheet toggle: change it, then clampPos
     drag {item, pos, vy}     -- what a drag leaves behind: pos/vy, clampPos, snapCenter
     select {item} / deselect
   Every case ends with nothing selected unless it is a selection case.

   This file is also where THE FIXTURE FORMAT lives (roundFloat, floatsText,
   hashFloats, segmentsOf), so the capture and the checks hash triangles with
   the very same code. */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { BARNWRIGHT_SHA256 } from "./barnwright-blocks.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/* ---------------------------------------------------------------------------
   THE FIXTURE FORMAT

   A Barnwright vertex is 8 numbers: x y z (position, feet), nx ny nz (the flat
   face normal), u v (texture coordinates). Our engine adds a 9th (the
   construction stage); the check drops it before comparing.

   A list of vertex numbers is hashed like this:
     1. each number x becomes Math.round(x * 1e4) / 1e4, and -0 becomes 0;
     2. each is written with toFixed(4) ("0.3000", "-12.5000");
     3. they are joined with "," in emission order (no spaces, no trailing comma);
     4. the SHA-256 of that text (UTF-8), as lower-case hex.
   An empty list hashes the empty string. */
export const VERTEX_FLOATS = 8;
export const FLOATS_PER_TRIANGLE = 24;

export function roundFloat(x) {
  const r = Math.round(x * 1e4) / 1e4;
  return r === 0 ? 0 : r;               /* folds -0 into 0 */
}

export function floatsText(floats) {
  const parts = new Array(floats.length);
  for (let i = 0; i < floats.length; i++) parts[i] = roundFloat(floats[i]).toFixed(4);
  return parts.join(",");
}

export function hashFloats(floats) {
  return createHash("sha256").update(floatsText(floats), "utf8").digest("hex");
}

/* A short fingerprint of ONE triangle (its 24 numbers): the first 6 hex
   characters of hashFloats. A bucket's "prints" is these, triangle after
   triangle, run together -- so when a part's hash differs, a check can name
   the first triangle that differs without the whole vertex list on disk. */
export const PRINT_CHARS = 6;
export function trianglePrint(floats24) {
  return hashFloats(floats24).slice(0, PRINT_CHARS);
}
export function printsOf(floats) {
  let s = "";
  for (let i = 0; i + FLOATS_PER_TRIANGLE <= floats.length; i += FLOATS_PER_TRIANGLE) {
    s += trianglePrint(floats.subarray ? floats.subarray(i, i + FLOATS_PER_TRIANGLE) : floats.slice(i, i + FLOATS_PER_TRIANGLE));
  }
  return s;
}

/* Per-triangle part labels -> run-length segments {part, from, count}, in
   TRIANGLES (from = index of the first triangle of the run in its bucket). */
export function segmentsOf(tags) {
  const out = [];
  for (let i = 0; i < tags.length; i++) {
    const last = out[out.length - 1];
    if (last && last.part === tags[i]) last.count++;
    else out.push({ part: tags[i], from: i, count: 1 });
  }
  return out;
}

/* Reading the recorded fixtures back (for the checks). */
export const GOLDEN_DIR = resolve(ROOT, "test/golden");
export function readGoldenCases() {
  return JSON.parse(readFileSync(resolve(GOLDEN_DIR, "cases.json"), "utf8"));
}
export function readGoldenCase(id) {
  return JSON.parse(readFileSync(resolve(GOLDEN_DIR, "geometry", id + ".json"), "utf8"));
}
export function readGoldenFull(id) {
  return JSON.parse(readFileSync(resolve(GOLDEN_DIR, "geometry-full", id + ".json"), "utf8"));
}

/* The camera for the look pictures: Barnwright's own opening angle (yaw 0.62,
   pitch 0.215) at exactly the fitted distance. */
export const LOOK_CAMERA = Object.freeze({ yaw: 0.62, pitch: 0.215, distOverFit: 1 });

/* ---------------------------------------------------------------------------
   THE CASES */

/* Barnwright's own tables, as recorded by tools/extract-barnwright-catalogue.mjs
   from the same pinned file. Used only to know each style's sizes. */
export function loadCatalogue() {
  const file = resolve(ROOT, "test/golden/barnwright-catalogue.json");
  const cat = JSON.parse(readFileSync(file, "utf8"));
  if (cat.sha256 !== BARNWRIGHT_SHA256) {
    throw new Error("test/golden/barnwright-catalogue.json was read from a different Barnwright file (" + cat.sha256 +
      "); re-run node tools/extract-barnwright-catalogue.mjs first.");
  }
  return cat;
}

const area = (z) => { const [w, l] = z.split("x").map(Number); return w * l; };

/* The styles in Barnwright's own chip order, and for each its smallest,
   typical and largest size (typical = where setType lands from a 10x20). */
export function styleSizes(cat) {
  const order = [];
  for (const [, list] of cat.CATS) for (const t of list.split(",")) order.push(t);
  const openSize = cat.defaultState.size;
  return order.map((t) => {
    const sizes = Object.keys(cat.P[t]);
    const typical = cat.P[t][openSize] ? openSize : sizes[Math.min(4, sizes.length - 1)];
    let smallest = sizes[0], largest = sizes[0];
    for (const z of sizes) {
      if (area(z) < area(smallest)) smallest = z;
      if (area(z) >= area(largest)) largest = z;       /* ties: the last on the sheet */
    }
    return { type: t, name: cat.TYPES[t].name, sizes, smallest, typical, largest };
  });
}

/* the steps that put a style at a size with its standard doors and windows */
function styleAt(s, size) {
  if (size === s.typical) return [{ op: "setType", type: s.type }];
  return [{ op: "setType", type: s.type }, { op: "setSize", size }, { op: "resetItems" }];
}

function id(t, size, extra) { return (t.toLowerCase() + "-" + size + (extra ? "-" + extra : "")); }

export function buildCases(cat) {
  const styles = styleSizes(cat);
  const S = Object.fromEntries(styles.map((s) => [s.type, s]));
  const cases = [];
  const add = (c) => {
    if (cases.some((o) => o.id === c.id)) throw new Error("duplicate case id " + c.id);
    const selecting = c.steps.some((s) => s.op === "select");
    const makesSel = c.steps.some((s) => s.op === "addItem" || s.op === "addInterior");
    const steps = c.steps.slice();
    if (makesSel && !selecting) steps.push({ op: "deselect" });
    cases.push({ id: c.id, description: c.description, steps, expect: c.expect || null, look: !!c.look });
  };
  const at = (t, size) => styleAt(S[t], size || S[t].typical);

  /* 1. every style x smallest / typical / largest, standard doors and windows */
  for (const s of styles) {
    const seen = new Set();
    for (const size of [s.smallest, s.typical, s.largest]) {
      if (seen.has(size)) continue;
      seen.add(size);
      const labels = [["smallest", s.smallest], ["typical", s.typical], ["largest", s.largest]].filter((p) => p[1] === size).map((p) => p[0]);
      add({
        id: id(s.type, size),
        description: `${s.name} ${size} (${labels.join(" and ")} size) with its standard doors and windows`,
        steps: styleAt(s, size),
        expect: { type: s.type, size },
        look: size === s.typical,
      });
    }
  }

  /* 2. colours, including the metal palettes and the door / shutter colours */
  add({ id: "col-lb-barnred-white-galvalume", description: "Lofted Barn 10x20 in Barn Red with White trim and a Galvalume roof",
    steps: [...at("LB"), { op: "color", key: "body", group: "paint", name: "Barn Red" }, { op: "color", key: "trim", group: "trim", name: "White" }, { op: "color", key: "roof", group: "metal", name: "Galvalume" }] });
  add({ id: "col-ut-navy-beige-hunter-doors", description: "Utility Shed 10x20 in Navy, Beige trim, Hunter Green roof, Chocolate door colour",
    steps: [...at("UT"), { op: "color", key: "body", group: "paint", name: "Navy" }, { op: "color", key: "trim", group: "trim", name: "Beige" }, { op: "color", key: "roof", group: "metal", name: "Hunter Green" }, { op: "color", key: "doorC", group: "paint", name: "Chocolate" }] });
  add({ id: "col-mu-galvalume-copper", description: "Metal Utility 10x20 in Galvalume with Charcoal trim and a Copper roof",
    steps: [...at("MU"), { op: "color", key: "body", group: "metal", name: "Galvalume" }, { op: "color", key: "trim", group: "trim", name: "Charcoal" }, { op: "color", key: "roof", group: "metal", name: "Copper" }] });
  add({ id: "col-mlb-burgundy-galleryblue", description: "Metal Lofted Barn 10x20 in Burgundy with White trim and a Gallery Blue roof",
    steps: [...at("MLB"), { op: "color", key: "body", group: "metal", name: "Burgundy" }, { op: "color", key: "trim", group: "trim", name: "White" }, { op: "color", key: "roof", group: "metal", name: "Gallery Blue" }] });
  add({ id: "col-mg-forest-slate", description: "Metal Garage 12x32 in Forest with Barn Red trim and a Burnished Slate roof",
    steps: [...at("MG"), { op: "color", key: "body", group: "metal", name: "Forest" }, { op: "color", key: "trim", group: "trim", name: "Barn Red" }, { op: "color", key: "roof", group: "metal", name: "Burnished Slate" }] });
  add({ id: "col-mcs-tan-clay", description: "Metal Cottage 10x20 in Tan with Chocolate trim and a Clay roof",
    steps: [...at("MCS"), { op: "color", key: "body", group: "metal", name: "Tan" }, { op: "color", key: "trim", group: "trim", name: "Chocolate" }, { op: "color", key: "roof", group: "metal", name: "Clay" }] });
  add({ id: "col-cs-pequea-shutters-navy", description: "Cottage Shed 10x20 in Pequea Green, White trim, Brown roof, shutters on its window in Navy",
    steps: [...at("CS"), { op: "color", key: "body", group: "paint", name: "Pequea Green" }, { op: "color", key: "trim", group: "trim", name: "White" }, { op: "color", key: "roof", group: "metal", name: "Brown" },
      { op: "edit", item: { cat: "w23", nth: 0 }, set: { shut: true } },
      { op: "color", key: "shutC", group: "paint", name: "Navy" }] });
  add({ id: "col-dk-clay-hunter", description: "Dog Kennel 8x16 in Clay with Hunter Green trim (the inner back wall is a shade of the body colour)",
    steps: [...at("DK"), { op: "color", key: "body", group: "paint", name: "Clay" }, { op: "color", key: "trim", group: "trim", name: "Hunter Green" }] });

  /* 3. dormers */
  for (const dv of ["none", "6", "12"]) {
    add({ id: "dormer-ds-10x20-" + dv, description: `Dormer Shed 10x20 with ${dv === "none" ? "no dormer" : "the " + dv + " ft dormer"}`,
      steps: [...at("DS"), { op: "dormer", value: dv }] });
  }
  add({ id: "dormer-ds-8x12-12", description: "Dormer Shed 8x12 with the 12 ft dormer (a big dormer on the smallest building)",
    steps: [...at("DS", "8x12"), { op: "dormer", value: "12" }] });
  add({ id: "dormer-ds-12x32-6", description: "Dormer Shed 12x32 with the 6 ft dormer",
    steps: [...at("DS", "12x32"), { op: "dormer", value: "6" }] });

  /* 4. side porches (SC / LSC): length, flip, middle. (No side-porch size is
     under 20 ft long, so the forced 4x8 of a short building cannot occur.) */
  const scAt = (t, size) => at(t, size);
  add({ id: "porch-sc-12x24-p8", description: "Side Cabin 12x24 with the 4x8 corner porch", steps: [...scAt("SC", "12x24"), { op: "porchLen", len: 8 }] });
  add({ id: "porch-sc-12x24-p12", description: "Side Cabin 12x24 with the 4x12 corner porch", steps: [...scAt("SC", "12x24"), { op: "porchLen", len: 12 }] });
  add({ id: "porch-sc-12x24-p8-flip", description: "Side Cabin 12x24, 4x8 porch flipped to the other end", steps: [...scAt("SC", "12x24"), { op: "porchLen", len: 8 }, { op: "flipPorch" }] });
  add({ id: "porch-sc-12x24-p12-flip", description: "Side Cabin 12x24, 4x12 porch flipped to the other end", steps: [...scAt("SC", "12x24"), { op: "flipPorch" }] });
  add({ id: "porch-sc-12x24-mid-p8", description: "Side Cabin 12x24 with a 4x8 porch in the middle of the long side", steps: [...scAt("SC", "12x24"), { op: "porchMid", mid: true }, { op: "porchLen", len: 8 }] });
  add({ id: "porch-sc-12x24-mid-p12", description: "Side Cabin 12x24 with a 4x12 porch in the middle of the long side", steps: [...scAt("SC", "12x24"), { op: "porchMid", mid: true }] });
  add({ id: "porch-lsc-10x20-p8-flip", description: "Loft Side Cabin 10x20, 4x8 porch flipped", steps: [...scAt("LSC"), { op: "porchLen", len: 8 }, { op: "flipPorch" }] });
  add({ id: "porch-lsc-12x32-mid-p12", description: "Loft Side Cabin 12x32 with a 4x12 middle porch", steps: [...scAt("LSC", "12x32"), { op: "porchMid", mid: true }] });
  add({ id: "porch-lsc-12x30-p8", description: "Loft Side Cabin 12x30 with the 4x8 corner porch", steps: [...scAt("LSC", "12x30"), { op: "porchLen", len: 8 }] });

  /* 5. porch posts on front, corner and side porches */
  add({ id: "post-c-10x20-front", description: "Cabin 10x20 with an extra porch post on the front porch",
    steps: [...at("C"), { op: "addItem", cat: "ppost", face: "F" }] });
  add({ id: "post-lbc-12x24-two-moved", description: "Lofted Barn Cabin 12x24 with two extra porch posts dragged apart",
    steps: [...at("LBC", "12x24"), { op: "addItem", cat: "ppost", face: "F", as: "p1" }, { op: "drag", item: "p1", pos: -3 }, { op: "addItem", cat: "ppost", face: "F", as: "p2" }, { op: "drag", item: "p2", pos: 3.5 }] });
  add({ id: "post-dsc-12x20-front", description: "Deluxe Side Cabin 12x20 with an extra post on the front of the corner porch",
    steps: [...at("DSC", "12x20"), { op: "addItem", cat: "ppost", face: "F" }] });
  add({ id: "post-dsc-12x24-side", description: "Deluxe Side Cabin 12x24 with an extra post on the side of the corner porch",
    steps: [...at("DSC", "12x24"), { op: "addItem", cat: "ppost", face: "R" }] });
  add({ id: "post-slc-12x30-both", description: "Deluxe Loft Side Cabin 12x30 with a post on each face of the corner porch",
    steps: [...at("SLC", "12x30"), { op: "addItem", cat: "ppost", face: "F" }, { op: "addItem", cat: "ppost", face: "R" }] });
  add({ id: "post-sc-12x24-side", description: "Side Cabin 12x24 with an extra post on the side porch",
    steps: [...scAt("SC", "12x24"), { op: "addItem", cat: "ppost", face: "R" }] });

  /* 6. the selection glow */
  add({ id: "sel-door-ut-10x20", description: "Utility Shed 10x20 with its double doors selected (the blue selection glow)",
    steps: [...at("UT"), { op: "select", item: { cat: "w72" } }], look: true });
  add({ id: "sel-window-su-10x20", description: "Side Utility 10x20 with a window selected (the blue selection glow)",
    steps: [...at("SU"), { op: "select", item: { cat: "w23" } }] });
  add({ id: "sel-gable-lb-10x20", description: "Lofted Barn 10x20 with its faux loft window selected",
    steps: [...at("LB"), { op: "select", item: { cat: "fake" } }] });

  /* 7. double windows and shutters */
  add({ id: "dbl-su-10x20-w23", description: "Side Utility 10x20 with one 2x3 window made a double window",
    steps: [...at("SU"), { op: "edit", item: { cat: "w23" }, set: { dbl: true } }] });
  add({ id: "dbl-ut-12x24-w33-shut", description: "Utility Shed 12x24 with a 3x3 double window, shutters on, added to the right wall",
    steps: [...at("UT", "12x24"), { op: "addItem", cat: "w33", face: "R", as: "w" }, { op: "edit", item: "w", set: { dbl: true } }, { op: "edit", item: "w", set: { shut: true } }] });
  add({ id: "dbl-c-12x24-tr", description: "Cabin 12x24 with a transom window made double, on the left wall",
    steps: [...at("C", "12x24"), { op: "addItem", cat: "tr", face: "L", as: "t" }, { op: "edit", item: "t", set: { dbl: true } }] });
  add({ id: "dbl-ss-12x24-w23-shut-colour", description: "Single Slope 12x24: a double 2x3 window with Barn Red shutters",
    steps: [...at("SS", "12x24"), { op: "edit", item: { cat: "w23" }, set: { dbl: true } }, { op: "edit", item: { cat: "w23" }, set: { shut: true } }, { op: "color", key: "shutC", group: "paint", name: "Barn Red" }] });
  add({ id: "shut-su-10x20-both", description: "Side Utility 10x20 with shutters on both windows (shutters match the trim)",
    steps: [...at("SU"), { op: "edit", item: { cat: "w23", nth: 0 }, set: { shut: true } }, { op: "edit", item: { cat: "w23", nth: 1 }, set: { shut: true } }] });
  add({ id: "shut-lb-10x20-w33-off-on", description: "Lofted Barn 10x20: a 3x3 window added to the right wall, shutters on then off (back to none)",
    steps: [...at("LB"), { op: "addItem", cat: "w33", face: "R", as: "w" }, { op: "edit", item: "w", set: { shut: true } }, { op: "edit", item: "w", set: { shut: false } }] });

  /* 8. a window in a wooden door (door lite), and the steel door swap */
  add({ id: "lite-ut-10x20-w72", description: "Utility Shed 10x20 with windows in its double doors",
    steps: [...at("UT"), { op: "edit", item: { cat: "w72" }, set: { lite: true } }] });
  add({ id: "lite-ut-12x24-w36-w48", description: "Utility Shed 12x24 with a 36 in door (window in it) on the left and a 48 in door (window in it) on the back",
    steps: [...at("UT", "12x24"), { op: "addItem", cat: "w36", face: "L", as: "a" }, { op: "edit", item: "a", set: { lite: true } }, { op: "addItem", cat: "w48", face: "B", as: "b" }, { op: "edit", item: "b", set: { lite: true } }] });
  add({ id: "lite-lb-10x20-w48", description: "Lofted Barn 10x20 with a 48 in door (window in it) on the right wall",
    steps: [...at("LB"), { op: "addItem", cat: "w48", face: "R", as: "a" }, { op: "edit", item: "a", set: { lite: true } }] });
  add({ id: "lite-su-10x20-steel-swap", description: "Side Utility 10x20 with a 36 in in-swing steel door on the back, swapped to the 11-lite door",
    steps: [...at("SU"), { op: "addItem", cat: "d36in", face: "B", as: "a" }, { op: "edit", item: "a", set: { cat: "d36lite" } }] });

  /* 9. every door and roll-up kind added to walls */
  add({ id: "doors-ut-12x24-a", description: "Utility Shed 12x24 with a 36 in door (left), 48 in door (back) and in-swing steel door (right)",
    steps: [...at("UT", "12x24"), { op: "addItem", cat: "w36", face: "L" }, { op: "addItem", cat: "w48", face: "B" }, { op: "addItem", cat: "d36in", face: "R" }] });
  add({ id: "doors-ut-14x28-b", description: "Utility Shed 14x28 with 72 in double doors (right), 11-lite door (left) and French doors (back)",
    steps: [...at("UT", "14x28"), { op: "addItem", cat: "w72", face: "R" }, { op: "addItem", cat: "d36lite", face: "L" }, { op: "addItem", cat: "dfr", face: "B" }] });
  add({ id: "doors-mu-10x20", description: "Metal Utility 10x20 with a 48 in door (right) and French doors (left): doors on a metal building",
    steps: [...at("MU"), { op: "addItem", cat: "w48", face: "R" }, { op: "addItem", cat: "dfr", face: "L" }] });
  add({ id: "doors-lb-10x20-back-dfr", description: "Lofted Barn 10x20 with French doors on the back gable end (a gambrel end wall)",
    steps: [...at("LB"), { op: "addItem", cat: "dfr", face: "B" }] });
  add({ id: "doors-gu-6x8-w48-back", description: "Garden Utility 6x8 with a 48 in door on the back (a small gable rising into the roof)",
    steps: [...at("GU", "6x8"), { op: "addItem", cat: "w48", face: "B" }] });
  add({ id: "doors-cs-10x20-w36-back", description: "Cottage Shed 10x20 with a 36 in door on the back gable end (saltbox roof)",
    steps: [...at("CS"), { op: "addItem", cat: "w36", face: "B" }] });
  add({ id: "rollup-g-14x40-sides", description: "Garage 14x40 with a 6 ft roll-up on the right and an 8 ft roll-up on the left",
    steps: [...at("G", "14x40"), { op: "addItem", cat: "ru6", face: "R" }, { op: "addItem", cat: "ru8", face: "L" }] });
  add({ id: "rollup-g-12x20-back", description: "Garage 12x20 with an 8 ft roll-up on the back gable end",
    steps: [...at("G", "12x20"), { op: "addItem", cat: "ru8", face: "B" }] });
  add({ id: "rollup-lbg-12x24-side", description: "Lofted Barn Garage 12x24 with a 6 ft roll-up on the right wall (gambrel)",
    steps: [...at("LBG", "12x24"), { op: "addItem", cat: "ru6", face: "R" }] });
  add({ id: "rollup-mg-12x32-side", description: "Metal Garage 12x32 with a 6 ft roll-up on the left wall (metal)",
    steps: [...at("MG"), { op: "addItem", cat: "ru6", face: "L" }] });
  add({ id: "rollup-ut-10x20-front", description: "Utility Shed 10x20 with its doors swapped for an 8 ft roll-up on the front gable end",
    steps: [...at("UT"), { op: "edit", item: { cat: "w72" }, set: { cat: "ru8" } }] });

  /* 10. every window kind added to walls, and the turned transom */
  add({ id: "win-ut-12x24-kinds", description: "Utility Shed 12x24 with a 2x3 window (left), 3x3 window (back) and transom (right)",
    steps: [...at("UT", "12x24"), { op: "addItem", cat: "w23", face: "L" }, { op: "addItem", cat: "w33", face: "B" }, { op: "addItem", cat: "tr", face: "R" }] });
  add({ id: "win-ut-12x24-tr-rotated", description: "Utility Shed 12x24 with a transom on the right wall turned on end (rotated)",
    steps: [...at("UT", "12x24"), { op: "addItem", cat: "tr", face: "R", as: "t" }, { op: "edit", item: "t", set: { rot: true } }] });
  add({ id: "win-ss-12x24-tr-band", description: "Single Slope 12x24 with another transom on the tall right wall (the high transom row)",
    steps: [...at("SS", "12x24"), { op: "addItem", cat: "tr", face: "R" }] });
  add({ id: "win-ss-10x20-tr-rotated-left", description: "Single Slope 10x20 with a transom on the low left wall, turned on end",
    steps: [...at("SS"), { op: "addItem", cat: "tr", face: "L", as: "t" }, { op: "edit", item: "t", set: { rot: true } }] });
  add({ id: "win-bu-6x12-back", description: "Backyard Utility 6x12 (lean-to roof) with a 2x3 window on the back",
    steps: [...at("BU"), { op: "addItem", cat: "w23", face: "B" }] });
  add({ id: "win-gu-6x8-w33-side", description: "Garden Utility 6x8 with a 3x3 window on the left wall",
    steps: [...at("GU", "6x8"), { op: "addItem", cat: "w33", face: "L" }] });
  add({ id: "win-lbg-12x32-w23-back", description: "Lofted Barn Garage 12x32 with a 2x3 window on the back gambrel end",
    steps: [...at("LBG"), { op: "addItem", cat: "w23", face: "B" }] });

  /* 11. gable windows: on the ends and moved to side walls */
  add({ id: "gable-ut-10x20-g1824-front", description: "Utility Shed 10x20 with an 18x24 gable window on the front gable",
    steps: [...at("UT"), { op: "addItem", cat: "g1824" }] });
  add({ id: "gable-ut-10x20-oct-back", description: "Utility Shed 10x20 with an octagon gable window moved to the back gable",
    steps: [...at("UT"), { op: "addItem", cat: "oct", as: "g" }, { op: "edit", item: "g", set: {}, toWall: "B" }] });
  add({ id: "gable-ut-10x20-fake-back", description: "Utility Shed 10x20 with a faux loft window moved to the back gable",
    steps: [...at("UT"), { op: "addItem", cat: "fake", as: "g" }, { op: "edit", item: "g", set: {}, toWall: "B" }] });
  add({ id: "gable-ut-12x24-g1824-right", description: "Utility Shed 12x24 with an 18x24 gable window moved to the right side wall",
    steps: [...at("UT", "12x24"), { op: "addItem", cat: "g1824", as: "g" }, { op: "edit", item: "g", set: {}, toWall: "R" }] });
  add({ id: "gable-lb-12x24-oct-left-dragged", description: "Lofted Barn 12x24 with an octagon window on the left side wall, dragged along and up",
    steps: [...at("LB", "12x24"), { op: "addItem", cat: "oct", as: "g" }, { op: "edit", item: "g", set: {}, toWall: "L" }, { op: "drag", item: "g", pos: 3, vy: 0.8 }] });
  add({ id: "gable-gu-6x8-g1824", description: "Garden Utility 6x8 with an 18x24 gable window (too big for the gable: clipped at the roof)",
    steps: [...at("GU", "6x8"), { op: "addItem", cat: "g1824" }] });
  add({ id: "gable-ut-8x12-oct-dragged", description: "Utility Shed 8x12 with an octagon window dragged sideways and up on the front gable",
    steps: [...at("UT", "8x12"), { op: "addItem", cat: "oct", as: "g" }, { op: "drag", item: "g", pos: 1.5, vy: 2 }] });
  add({ id: "gable-sb-10x12-oct", description: "Standard Barn 10x12 with an octagon gable window (short gambrel)",
    steps: [...at("SB"), { op: "addItem", cat: "oct" }] });
  add({ id: "gable-cs-10x20-g1824-back", description: "Cottage Shed 10x20 with an 18x24 gable window on the back (saltbox gable)",
    steps: [...at("CS"), { op: "addItem", cat: "g1824", as: "g" }, { op: "edit", item: "g", set: {}, toWall: "B" }] });
  add({ id: "gable-ss-10x20-oct", description: "Single Slope 10x20 with an octagon window on the front end (sloped end wall)",
    steps: [...at("SS"), { op: "addItem", cat: "oct" }] });
  add({ id: "gable-bu-6x12-fake", description: "Backyard Utility 6x12 with a faux loft window on the front end (lean-to end wall)",
    steps: [...at("BU"), { op: "addItem", cat: "fake" }] });
  add({ id: "gable-mlb-10x20-g1824-back", description: "Metal Lofted Barn 10x20 with an 18x24 gable window on the back",
    steps: [...at("MLB"), { op: "addItem", cat: "g1824", as: "g" }, { op: "edit", item: "g", set: {}, toWall: "B" }] });

  /* 12. outside lights */
  add({ id: "light-ut-10x20-right", description: "Utility Shed 10x20 with an outside light on the right wall",
    steps: [...at("UT"), { op: "addItem", cat: "light", face: "R" }] });
  add({ id: "light-ut-10x20-raised", description: "Utility Shed 10x20 with an outside light dragged up (clamped to its top limit)",
    steps: [...at("UT"), { op: "addItem", cat: "light", face: "R", as: "l" }, { op: "drag", item: "l", pos: 2, vy: 5 }] });
  add({ id: "light-lb-10x20-lowered", description: "Lofted Barn 10x20 with an outside light dragged down 3 ft on the left wall",
    steps: [...at("LB"), { op: "addItem", cat: "light", face: "L", as: "l" }, { op: "drag", item: "l", pos: -1, vy: -3 }] });
  add({ id: "light-ut-10x20-front-gable", description: "Utility Shed 10x20 with an outside light on the front end beside the doors",
    steps: [...at("UT"), { op: "addItem", cat: "light", face: "F", as: "l" }, { op: "drag", item: "l", pos: 4.2, vy: 1 }] });
  add({ id: "light-ss-10x20-tall-wall", description: "Single Slope 10x20 with an outside light on the tall right wall (under the belt band)",
    steps: [...at("SS"), { op: "addItem", cat: "light", face: "R", as: "l" }, { op: "drag", item: "l", pos: 0, vy: 3 }] });

  /* 13. interior items and electric packages: no 3D of their own, carried in the state */
  add({ id: "int-ut-10x20-bench-shelf", description: "Utility Shed 10x20 with a work bench and a shelf (floor-plan items, nothing new in 3D)",
    steps: [...at("UT"), { op: "addInterior", cat: "bench" }, { op: "addInterior", cat: "shelf" }] });
  add({ id: "int-lb-10x20-elec1", description: "Lofted Barn 10x20 with electric package 1 (switch, GFCI, one overhead light)",
    steps: [...at("LB"), { op: "elec", pkg: 1 }] });
  add({ id: "int-ut-12x24-elec2", description: "Utility Shed 12x24 with electric package 2 (four outlets)",
    steps: [...at("UT", "12x24"), { op: "elec", pkg: 2 }] });
  add({ id: "int-su-10x20-elec3-ext", description: "Side Utility 10x20 with electric package 3 and the outside light (the light is drawn in 3D)",
    steps: [...at("SU"), { op: "elec", pkg: 3, ext: true }] });
  add({ id: "int-ut-10x20-options", description: "Utility Shed 10x20 with double floor, 12 in joists, moisture barrier and a ramp ticked (no 3D change)",
    steps: [...at("UT"), { op: "opt", key: "dbl", on: true }, { op: "opt", key: "jo12", on: true }, { op: "opt", key: "mbF", on: true }, { op: "ramp", value: cat.RAMPS[1][0] }] });

  /* 14. the kennel */
  add({ id: "kennel-dk-8x12-window-back", description: "Dog Kennel 8x12 with a 2x3 window added (the kennel sends a front add to the back wall)",
    steps: [...at("DK", "8x12"), { op: "addItem", cat: "w23", face: "F" }] });
  add({ id: "kennel-dk-8x16-door-light", description: "Dog Kennel 8x16 with a 36 in door on the left and a light on the right (kennel side-wall rule)",
    steps: [...at("DK"), { op: "addItem", cat: "w36", face: "L" }, { op: "addItem", cat: "light", face: "R" }] });

  /* 15. resizes that keep the items, and dragged items */
  add({ id: "resize-ut-10x20-to-8x12", description: "Utility Shed 10x20 resized to 8x12 WITHOUT re-laying the doors and windows (they are clamped)",
    steps: [...at("UT"), { op: "setSize", size: "8x12" }] });
  add({ id: "resize-lb-10x20-to-14x40", description: "Lofted Barn 10x20 resized to 14x40 keeping its doors and windows",
    steps: [...at("LB"), { op: "setSize", size: "14x40" }] });
  add({ id: "resize-sc-12x24-to-10x20", description: "Side Cabin 12x24 resized to 10x20 keeping its items",
    steps: [...at("SC", "12x24"), { op: "setSize", size: "10x20" }] });
  add({ id: "drag-su-10x20-window-far", description: "Side Utility 10x20 with a window dragged past the end of its wall (clamped)",
    steps: [...at("SU"), { op: "drag", item: { cat: "w23", nth: 1 }, pos: 100 }] });
  add({ id: "drag-ut-12x24-window-into-door", description: "Utility Shed 12x24: a 3x3 window added beside the doors on the front and pushed into them (settles clear)",
    steps: [...at("UT", "12x24"), { op: "addItem", cat: "w33", face: "F", as: "w" }, { op: "drag", item: "w", pos: 1 }] });
  add({ id: "drag-c-12x32-window-porch", description: "Cabin 12x32 with a 2x3 window added on the front porch wall and dragged along it",
    steps: [...at("C", "12x32"), { op: "addItem", cat: "w23", face: "F", as: "w" }, { op: "drag", item: "w", pos: -3 }] });

  return cases;
}

/* Which cases also get a look picture: every style at its typical size, and
   the door selection glow. */
export function lookCases(cases) {
  return cases.filter((c) => c.look).map((c) => c.id);
}
