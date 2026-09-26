/* WHICH LINES OF BARNWRIGHT'S DESIGNER DRAW WHICH PART OF THE SHED.

   The golden capture (tools/capture-golden.mjs) records every triangle
   Barnwright's 3D designer draws, and labels each one with the real-life part
   it belongs to -- skids, siding, roofing, a window, the lawn. That labelling
   is what lets the checks prove one part of our port at a time ("the roofing
   matches triangle for triangle; the dormer is not ported yet").

   This file is the labelling table, and it is tied to ONE exact copy of
   Barnwright's file: the line numbers below are only true of the file whose
   SHA-256 is pinned here. If Barnwright's designer changes, the capture
   refuses to run until somebody re-reads buildShed and updates this table on
   purpose. Nothing here ever writes to Barnwright -- it is read only.

   HOW A TRIANGLE IS LABELLED (the contract, docs/ARCHITECTURE.md, "The golden
   test" and the PIPELINE table):
     1. If the triangle is drawn while one of the WRAPPED functions below is
        running, the innermost one wins: profileRoof -> roofing, dormer ->
        dormer, the porch functions -> porch, the kennel functions -> kennel,
        and renderItem -> the part for that item's kind (ITEM_PARTS).
     2. Otherwise, look up the call stack for the innermost line of
        buildShed (lines 3854-4078) and use the LINE_RANGES table.
     3. Anything else is UNTAGGED and the capture fails. */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

export const BARNWRIGHT_PUBLIC = "/home/user/boisterous-lokum-a737e0/public";
export const BARNWRIGHT_FILE = BARNWRIGHT_PUBLIC + "/3ddesign.html";

/* The one copy of Barnwright's 3ddesign.html this table was written against
   (read Sep 26 2026). test/golden/barnwright-catalogue.json carries the same. */
export const BARNWRIGHT_SHA256 = "0bdcf663c5cb988623d2cb0dd271156fb690564072b301b0a15b917fd921ac6c";

/* Every part id a Barnwright triangle can belong to (the finished-building
   parts of the PIPELINE; the framing parts are new and Barnwright draws none). */
export const PART_IDS = Object.freeze([
  "skids", "floor", "siding", "kennel", "corner-trim", "porch", "gable-siding",
  "gable-band", "gable-vent", "belt-band", "roofing", "dormer", "door-wood",
  "door-steel", "door-lite", "roll-up", "window", "gable-window", "light",
  "porch-post", "ground",
]);

/* buildShed, the function that draws the whole building. */
export const BUILDSHED = Object.freeze({ from: 3854, to: 4078 });

/* mkTex creates its FIRST canvas on this line: that is the entry of one
   texture, where the capture restarts the seeded random numbers. (Its second
   canvas, for the height map, is created further down, on line 1730.) */
export const MKTEX_ENTRY_LINE = 1717;

/* Functions replaced by a labelling wrapper while one build is recorded.
   renderItem is labelled by the item it draws (ITEM_PARTS), so it maps to null. */
export const WRAPPERS = Object.freeze({
  profileRoof: "roofing",       /* the roof: slab, ribs, ridge cap, fascia, soffit, rake boards */
  dormer: "dormer",             /* the dormer on a Dormer Shed */
  porchFront: "porch",          /* front porch (cabins): deck, posts, beam, rails */
  porchSideCorner: "porch",     /* side-cabin porch set into one corner or the middle */
  porchCorner: "porch",         /* deluxe corner porch */
  kennelFront: "kennel",        /* dog kennel: open front with chain-link */
  kennelSide: "kennel",         /* dog kennel: side walls with the run */
  kennelExtras: "kennel",       /* dog kennel: dividers, gates, the rest of the run */
  meshWall: "kennel",           /* chain-link panels (only the kennel uses them) */
  renderItem: null,             /* one door / window / light / post: see ITEM_PARTS */
});

/* renderItem's triangles, by the item's catalogue code (Barnwright's CAT keys).
   Shutters are drawn inside the window code, so they count as "window".
   Interior items (bench, shelf, outlets, the overhead light) draw nothing in 3D. */
export const ITEM_PARTS = Object.freeze({
  w36: "door-wood", w48: "door-wood", w72: "door-wood",
  d36in: "door-steel",
  d36lite: "door-lite", dfr: "door-lite",
  ru6: "roll-up", ru8: "roll-up",
  w23: "window", w33: "window", tr: "window",
  fake: "gable-window", g1824: "gable-window", oct: "gable-window",
  light: "light",
  ppost: "porch-post",
});
export const INTERIOR_ITEMS = Object.freeze(["bench", "shelf", "outlet", "gfci", "ilight"]);

/* buildShed's own lines, in order, and the part their triangles belong to.
   Lines not listed draw nothing of their own (setup, the item loop -- every
   item is wrapped -- and the upload at the end). Read line by line on the
   pinned file; the PIPELINE entry each range belongs to is in `entry`. */
export const LINE_RANGES = Object.freeze([
  { from: 3872, to: 3875, part: "skids",        entry: "skids",          what: "floor loop: the skid boxes under each floor segment" },
  { from: 3876, to: 3877, part: "floor",        entry: "floor",          what: "floor loop: the deck slab segment (kennel floor on a kennel)" },
  { from: 3878, to: 3905, part: "siding",       entry: "siding",         what: "walls loop F B R L and porch walls: wall siding, porch cut-outs, skirt rule, the kennel's inner back face (bodyIn)" },
  { from: 3906, to: 3945, part: "corner-trim",  entry: "corner-trim",    what: "chamfered corner posts and the corner AO decal" },
  { from: 3946, to: 3960, part: "porch",        entry: "porch-junction", what: "white trim boxes at the porch wall junctions (corner and side porches)" },
  { from: 3961, to: 3961, part: "kennel",       entry: "kennel",         what: "kennelExtras call (also wrapped)" },
  { from: 3962, to: 3979, part: "gable-siding", entry: "gable-siding",   what: "gable-end fill (cottage fill to the roof line included)" },
  { from: 3980, to: 4001, part: "gable-band",   entry: "gable-band",     what: "the gable trim band and its returns (bandRet)" },
  { from: 4002, to: 4014, part: "gable-vent",   entry: "gable-vent",     what: "the louvred gable vent" },
  { from: 4015, to: 4019, part: "belt-band",    entry: "belt-band",      what: "single slope: the belt band under the transom row" },
  { from: 4020, to: 4034, part: "porch",        entry: "porch",          what: "porch header band, wrap bands, ceiling, and the porch function calls" },
  { from: 4035, to: 4039, part: "roofing",      entry: "roofing",        what: "profileRoof call (also wrapped)" },
  { from: 4040, to: 4041, part: "dormer",       entry: "dormer",         what: "dormer call (also wrapped)" },
  { from: 4044, to: 4074, part: "ground",       entry: "ground",         what: "lawn disc, contact shadow, eave AO on gambrel roofs" },
]);

/* Lines of the pinned file that must read exactly like this, so a table that
   has drifted from the file fails loudly even before the SHA check is read. */
export const ANCHORS = Object.freeze([
  [1716, "function mkTex(painter,size,norm,hpaint){"],
  [1717, '  var c=document.createElement("canvas");c.width=size;c.height=size;'],
  [2082, "function pushTri(b,p0,p1,p2,uv0,uv1,uv2){"],
  [3854, "function buildShed(){"],
  [3875, "    for(var sx=0;sx<SKX.length;sx++) box(mSk,SKX[sx],0,fzc,0.5,0.5,fend);"],
  [3876, "    box(mFlr,0,0.5,fzc,W-FIN*2,0.42,fl);"],
  [3905, "  });"],
  [3961, '  if(state.type==="DK") kennelExtras(W,L,topY,prof);'],
  [3979, '    gq2(mB,pp,gz,sgn,gob,"sid");'],
  [4043, "  state.items.forEach(function(it){ renderItem(it,ws,prof); });"],
  [4075, "  uploadBuffers();"],
  [4078, "}"],
  [4081, "function uploadBuffers(){"],
]);

export function barnwrightSha256() {
  return createHash("sha256").update(readFileSync(BARNWRIGHT_FILE)).digest("hex");
}

/* Refuse to go on unless Barnwright's file is exactly the pinned copy. */
export function assertBarnwrightPinned() {
  const sha = barnwrightSha256();
  if (sha !== BARNWRIGHT_SHA256) {
    throw new Error(
      "Barnwright's 3ddesign.html has changed (SHA-256 " + sha + ", this table was written for " +
      BARNWRIGHT_SHA256 + "). The line numbers in tools/lib/barnwright-blocks.mjs are only true of the " +
      "pinned copy: re-read buildShed, update the table and the pin on purpose, then re-record.");
  }
  const lines = readFileSync(BARNWRIGHT_FILE, "utf8").split(/\r?\n/);   /* the file has Windows line endings */
  for (const [n, text] of ANCHORS) {
    if (lines[n - 1] !== text) throw new Error("Barnwright line " + n + " does not read as expected: " + JSON.stringify(lines[n - 1]));
  }
  for (const r of LINE_RANGES) {
    if (!PART_IDS.includes(r.part)) throw new Error("Unknown part id in LINE_RANGES: " + r.part);
    if (r.from < BUILDSHED.from || r.to > BUILDSHED.to || r.from > r.to) throw new Error("Bad line range " + r.from + "-" + r.to);
  }
  for (let i = 1; i < LINE_RANGES.length; i++) {
    if (LINE_RANGES[i].from <= LINE_RANGES[i - 1].to) throw new Error("Overlapping line ranges at " + LINE_RANGES[i].from);
  }
  for (const t of [...Object.values(WRAPPERS), ...Object.values(ITEM_PARTS)]) {
    if (t !== null && !PART_IDS.includes(t)) throw new Error("Unknown part id: " + t);
  }
  return sha;
}

/* The part for a line of buildShed, or null if that line draws nothing of its own. */
export function partForLine(line) {
  for (const r of LINE_RANGES) if (line >= r.from && line <= r.to) return r.part;
  return null;
}

/* Everything the page-side labeller needs, as plain JSON. */
export function taggingTable() {
  return {
    buildShed: BUILDSHED,
    wrappers: WRAPPERS,
    itemParts: ITEM_PARTS,
    interior: INTERIOR_ITEMS,
    lineRanges: LINE_RANGES.map((r) => ({ from: r.from, to: r.to, part: r.part })),
    parts: PART_IDS,
  };
}
