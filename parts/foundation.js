/* BLOCKS AND ANCHORS: what the building is set down on and tied to. Node-safe.
   NEW geometry -- Barnwright drew none.

   In real life a portable building is delivered onto solid concrete blocks
   laid under its skids, and tied down with ground anchors: steel augers
   screwed into the ground beside the skids, each with a galvanized strap up
   to the skid. The settings say how many (library/construction.json "site"):
   one block per site.perimeterFtPerBlock ft of outside wall, spread evenly
   along every skid (at least two a skid, one flush with each end), and
   site.anchors anchors, half down each outside skid, set between blocks.

   WHERE IT SITS: Barnwright's skids stand on the ground at y 0 (their boxes
   run y 0 .. 0.5; parts/skids.js), so a block under a skid is set into the
   ground with its top just proud of the grass -- 0.008 ft, a tenth of an
   inch, so it can be seen round the skid in the Framing view (the lawn is
   drawn at y 0.004). A block is laid along the skid, its widest face down:
   a 4x8x16 block is 4 in tall, 8 in across the skid (the skid is drawn 6 in
   wide) and 16 in along it. An anchor sits on the INSIDE of an outside skid,
   so it stays inside the building's footprint on every width: an auger shaft
   into the ground with its helix, a head on the grass, and a strap up the
   skid's side.

   THE ANCHOR COUNT IS AN ASSUMPTION (library/construction.json says so:
   site.anchorsAssumed) -- Barnwright never drew anchors; confirm with the
   shop's master anchor plan.

   Barnwright source: new -- Barnwright drew none. It fits under the skids
   (parts/skids.js skidXs, the skid table from Alan's build sheet) and the
   floor segments (parts/floor.js floorSegments). */

import { skidXs } from "./skids.js";
import { floorSegments } from "./floor.js";
import { boxMember, drawMembers } from "./floor-frame.js";

/* The block's top stands this far above y 0 (the lawn is drawn at 0.004). */
export const BLOCK_PROUD = 0.008;
/* The anchor: auger shaft and helix depth, head and strap (drawn sizes). */
export const ANCHOR = Object.freeze({ depth: 2.5, helixAt: 2.3, helix: 0.5, rod: 0.0625, head: 0.18, headH: 0.08, strapT: 0.01, strapW: 0.12, strapTop: 0.45 });

/* "4x8x16" -> { h, across, along } in feet (smallest face down). */
export function blockSize(name) {
  var m = /(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)/.exec(String(name || ""));
  var d = m ? [+m[1], +m[2], +m[3]].sort(function (a, b) { return a - b; }) : [4, 8, 16];
  return { h: d[0] / 12, across: d[1] / 12, along: d[2] / 12 };
}

/* The skids as drawn: centre x, and the z range the boxes cover. */
export function skidRuns(plan) {
  var SKX = skidXs(plan.W, plan.construction && plan.construction.skids);
  var segs = floorSegments(plan), first = segs[0], last = segs[segs.length - 1];
  /* the end segments' skid boxes run 0.2 ft longer (parts/skids.js) */
  var z0 = first.fzc - (first.fl + 0.2) / 2, z1 = last.fzc + (last.fl + 0.2) / 2;
  return SKX.map(function (x) { return { x: x, x0: x - 0.25, x1: x + 0.25, y0: 0, y1: 0.5, z0: z0, z1: z1 }; });
}

export function foundationMembers(plan) {
  var site = (plan.construction && plan.construction.site) || {};
  var W = plan.W, L = plan.L, out = [];
  var skids = skidRuns(plan);
  var B = blockSize(site.blocks || "4x8x16");
  var per = +site.perimeterFtPerBlock > 0 ? +site.perimeterFtPerBlock : 4;
  var need = Math.ceil(2 * (W + L) / per - 1e-9);
  var perSkid = Math.max(2, Math.ceil(need / skids.length));
  var za = -L / 2 + B.along / 2, zb = L / 2 - B.along / 2;
  var blockZ = [];
  for (var i = 0; i < perSkid; i++) blockZ.push(za + (zb - za) * i / (perSkid - 1));
  skids.forEach(function (sk, si) {
    blockZ.forEach(function (z, bi) {
      out.push(boxMember("block", "concrete", sk.x - B.across / 2, sk.x + B.across / 2, BLOCK_PROUD - B.h, BLOCK_PROUD, z - B.along / 2, z + B.along / 2,
        { skid: si, n: bi, support: "ground" }));
    });
  });
  /* anchors: half down each outside skid, on its inside face, between blocks */
  var n = Math.max(0, Math.round(+site.anchors || 0));
  var xs = skids.map(function (s) { return s.x; });
  var outer = [Math.min.apply(null, xs), Math.max.apply(null, xs)];
  var mids = [];
  for (var g = 0; g < blockZ.length - 1; g++) mids.push((blockZ[g] + blockZ[g + 1]) / 2);
  [Math.ceil(n / 2), Math.floor(n / 2)].forEach(function (count, side) {
    if (!count) return;
    var sx = outer[side], inward = sx < 0 ? 1 : -1;
    var face = sx + inward * 0.25;                          /* the skid's inside face */
    var used = [];
    for (var a = 0; a < count; a++) {
      var target = count === 1 ? 0 : (-L / 2 + 1.5) + (L - 3) * a / (count - 1);
      var best = null;
      mids.forEach(function (m) { if (used.indexOf(m) < 0 && (best === null || Math.abs(m - target) < Math.abs(best - target))) best = m; });
      if (best === null) break;
      used.push(best);
      anchorAt(out, face, inward, best, { side: side, n: a });
    }
  });
  out.forEach(function (m) { m.stage = "foundation"; });
  return out;
}

function anchorAt(out, face, inward, z, meta) {
  var A = ANCHOR;
  var sx0 = face, sx1 = face + inward * A.strapT;                  /* the strap against the skid */
  var hx = face + inward * (A.strapT + A.head / 2);                /* the head beside the strap */
  var r = A.rod / 2, h = A.head / 2, g = 0.004;                     /* g: the lawn's height */
  function mm(kind, x0, x1, ya, yb, z0, z1) {
    out.push(boxMember(kind, "steel", Math.min(x0, x1), Math.max(x0, x1), ya, yb, z0, z1, Object.assign({ support: "ground" }, meta)));
  }
  mm("anchor-strap", sx0, sx1, g, A.strapTop, z - A.strapW / 2, z + A.strapW / 2);
  mm("anchor-head", hx - h, hx + h, g, g + A.headH, z - h, z + h);
  mm("anchor-shaft", hx - r, hx + r, -A.helixAt, g, z - r, z + r);
  mm("anchor-helix", hx - A.helix / 2, hx + A.helix / 2, -A.helixAt - 0.03, -A.helixAt, z - A.helix / 2, z + A.helix / 2);
  mm("anchor-shaft", hx - r, hx + r, -A.depth, -A.helixAt - 0.03, z - r, z + r);
}

export default {
  id: "foundation",
  name: "Blocks and anchors",
  stage: "foundation",
  realLife: "Solid concrete {site.blocks} blocks under the skids, one per {site.perimeterFtPerBlock} ft of outside wall spread evenly along every skid, and {site.anchors} ground anchors screwed in beside the outside skids and strapped to them.",
  appliesTo(plan) { return true; },
  members: foundationMembers,
  build(plan, kit) {
    drawMembers(kit, foundationMembers(plan), "foundation");
  },
};
