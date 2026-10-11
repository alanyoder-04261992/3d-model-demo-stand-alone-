/* THE EVERY-SIZE CHECK: a style drawn at every size it is sold in, and looked
   over the way a builder looks over a new drawing. Node-safe, pure (no I/O):
   it runs in the tools checks (tools/check-style-sizes.mjs), and is written
   to run in the browser and on the server too (a Dealer Center save, the
   price list on open).

   WHY. Alan asked (Oct 2026, "lets all 5 to make it as fast as possible")
   for a check that replaces checking a style by eye. A business can now set
   its own numbers (taller walls, another roof pitch, a deeper porch), and
   nobody can look at every size of every style after every change. This
   draws each one from the model's own geometry -- the same code the 3D
   designer and the framing parts use, never a copy of it -- and says in
   plain words what does not fit.

     checkBuilding(plan, opts)   one building: {problems, warnings, ms}
     checkStyle(cat, key, opts)  one style at every size it is sold in, with
                                 its variants: {results, problems, warnings,
                                 buildings, unchecked, knownHits, ms}
     variantsOf(t, cat)          the ways one size can be built: side porch
                                 lengths x {corner, flipped, middle}; each
                                 dormer size; [{}] otherwise
     lengthWords(ft)             "2 3/8 in", "4 ft 3 in" (a shed builder's words)

   A FINDING is {code, id, words, detail, where}. `words` starts with the
   building ("Side Utility 8x12: ..."), `detail` is the same without it,
   `id` is code + a stable name for what was found ("overlap:R:w23/w72"),
   which is what test/style-sizes-known.json matches. A PROBLEM blocks (the
   tools check fails, a save is refused); a WARNING is shown only.

   THE CHECKS (BUILDFAST-SPEC section C.2):
     draws       (checkStyle) the size can be laid out and drawn at all; a
                 size that throws is a problem, never a crash of the check
     past-wall   each door's and window's trim stays on its wall (problem:
                 past the corner; warning: under 1 in from it)
     overlap     no two openings on one wall overlap (problem); their side
                 casings touching or lapping is a warning
     too-high    head trim under the top of a side wall; on an end wall under
                 the gable trim band and the roof line; a gable window's
                 glass under the roof (problem); its trim cut by the roof
                 (warning)
     gable-item  every gable window the business sells, under the peak of a
                 gable (the middle, on most roofs) as low as it goes, at
                 every size where the designer offers it: glass under the
                 roof (problem), trim cut (warning)
     eave        the roof edge over each long wall at least 6 ft above the
                 floor and above every door's head trim there (problem);
                 above every window's head trim there (warning)
     door-fit    the wooden shop door drawn at its rule height
                 (openings.doorHeightIn): shorter by over 1/2 in is a problem
     roof        every slope rises toward the peak; a barn's lower slope is
                 steeper than its upper and its knee is inside the walls;
                 the peak 1 ft to 8 ft above the wall (under 18 in: warning);
                 the pitch inside the How it's built limits
     roof-widths (checkStyle) a wider building is never lower than a
                 narrower one of the same style; a jump of over 12 in
                 between sold widths is a warning
     dormer      the dormer front at least 1 ft 2 3/8 in tall without the
                 drawing's floor rule; its windows at least 7 in tall; its
                 roof rising from the front to the main roof (problems);
                 drawn shorter than its size (warning)
     porch       every opening on a wall of the closed-in room (not out on
                 the open porch or the kennel run); porch posts on the
                 porch deck; at least 4 ft of room left inside and 4 ft of
                 side wall beside a side porch; the corner
                 porch's angled wall at least 2 ft sideways, its front wall
                 at least 1 ft
     framing     every framing part's members(plan) works out; no piece
                 outside where framing may stand, no two overlapping by more
                 than 0.01 ft, every piece resting on or nailed to something
                 (the rules of tools/check-framing.mjs 3-5, from
                 model/framing-geometry.js)
     loft        headroom from the loft floor to the underside of the roof
                 framing at the middle: under 24 in a problem, under 36 in a
                 warning

   Numbers the How it's built settings (model/build-settings.js, lane 1) will
   own -- porch depth, side porch lengths, the dormer side -- are read from
   the drawn geometry (plan.ws, plan.span), so they follow whatever the
   style is set to. variantsOf reads t.sidePorch.lengthsFt when a style has
   it, else today's 8 and 12 ft. */

import { y0, OCT_WIN } from "../engine/constants.js";
import { wallPt } from "../engine/wall.js";
import { frameOf, SIDE_WALL_MIN_FT } from "./frame.js";
import { makePlan } from "./plan.js";
import { defaults, setType } from "./design.js";
import * as LAYOUT from "./layout.js";
import { doorHeightFt } from "./construction.js";
import { profileYat, gableBandY } from "./roof-shapes.js";
import { PIPELINE } from "../parts/index.js";
import { dormerGeom, loftZones, roofSection, envY } from "../parts/roof-frame.js";
import { porchOutlines, roomOutline, pointInPoly } from "../parts/floor-frame.js";
import * as G from "./framing-geometry.js";

export const CODES = Object.freeze(["draws", "past-wall", "overlap", "too-high", "gable-item", "eave", "door-fit", "roof", "roof-widths", "dormer", "porch", "framing", "loft"]);

/* The roof pitch a style may have, rise per 12 in of run: the same limits
   as the How it's built roof pitch setting (BUILDFAST-SPEC A.2). A barn roof
   and a saltbox have no pitch setting, so no limit here. */
export const ROOF_PITCH_LIMITS = Object.freeze({ gable: [3, 12], lean: [1, 6], slope: [1, 8] });

/* Every limit the checks use, in feet. */
export const LIMITS = Object.freeze({
  cornerWarnFt: 1 / 12,        /* trim under 1 in from the corner */
  eaveMinFt: 6,                /* the roof edge at least 6 ft above the floor */
  doorShortFt: 0.5 / 12,       /* a shop door more than 1/2 in short */
  peakMinFt: 1, peakWarnFt: 1.5, peakMaxFt: 8,
  widthJumpFt: 1,              /* over 12 in between neighbouring widths */
  dormerFaceFt: 1.2,           /* parts/dormer.js: if(faceH<1.2)faceH=1.2 */
  dormerWindowFt: 7 / 12,
  roomFt: 4,                   /* room left inside a porch */
  sideWallFt: SIDE_WALL_MIN_FT, /* side wall left beside a side porch */
  wrapSidewaysFt: 2, wrapFrontFt: 1,
  loftMinFt: 2, loftWarnFt: 3,
});

const EPS = 1e-6;
/* how far an opening's ends may be from a wall of the room (the trim stands
   proud of the siding, the walls meet at the siding planes) */
const ON_WALL_FT = 0.05;
/* a gable window's trim is cut 0.10 ft under the roof line (parts/openings/
   gable-window.js gableClip(..., 0.10)): glass above that line shows through */
const GABLE_CUT_FT = LAYOUT.GABLE_CUT_FT;          /* where the drawing cuts a gable window at the roof */

function now() { return (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now(); }

/* ------------------------------------------------------------------ words */

const EIGHTHS = ["", "1/8", "1/4", "3/8", "1/2", "5/8", "3/4", "7/8"];
/* A length the way a shed builder says it: 4 in, 2 3/8 in, 1 ft 1 in,
   4 ft 3 in, 4 ft 0 5/8 in, 4 ft (to the nearest 1/8 in). */
export function lengthWords(ft) {
  const e = Math.round(Math.abs(ft) * 96);
  const inch = Math.floor(e / 8), f = EIGHTHS[e % 8];
  if (inch >= 12) {
    const feet = Math.floor(inch / 12), rest = inch % 12;
    if (!rest && !f) return feet + " ft";
    return feet + " ft " + rest + (f ? " " + f : "") + " in";
  }
  if (!inch && !f) return "0 in";
  return (inch ? inch + (f ? " " + f : "") : f) + " in";
}
/* Inches only, for door heights: 76 1/2 in. */
function inchWords(ft) {
  const e = Math.round(Math.abs(ft) * 96), inch = Math.floor(e / 8), f = EIGHTHS[e % 8];
  return (inch ? inch + (f ? " " + f : "") : (f || "0")) + " in";
}
/* A pitch to the nearest quarter: 5/12, 6 1/2/12. */
function pitchWords(p) {
  const q = Math.round(p * 4), whole = Math.floor(q / 4), part = ["", "1/4", "1/2", "3/4"][q % 4];
  return (whole ? whole + (part ? " " + part : "") : (part || "0")) + "/12";
}

const WALL_WORDS = { F: "front", B: "back", L: "left side", R: "right side", S1: "porch back wall", S2: "porch side wall", S3: "porch side wall", P1: "porch angled wall", P2: "porch front wall", P3: "porch door wall" };
function itemWords(o) {
  const where = o.r && o.r.plane === "gable" ? (o.r.end === "B" ? "back gable" : "front gable") : (WALL_WORDS[o.it.wall] || o.it.wall);
  return `the ${o.c.n} on the ${where}`;
}
/* The top of an opening's head board (a gable window on a side wall: the top
   of its trim). A porch building's header band is trim on the siding, not
   the head: it is looked at on its own. */
function headTop(o) { return o.r.head ? o.r.head.y1 : o.r.y1; }
/* The side casings' outer edges along the wall (the head board's ears and
   the sill reach a little further; Barnwright spaces openings by casings). */
function casingSpan(o) { return o.r.casing ? [o.r.casing.u0, o.r.casing.u1] : [o.r.u0, o.r.u1]; }

const PART_WORDS = {
  foundation: "foundation", "floor-frame": "floor framing", "floor-deck": "floor decking", "wall-frame": "wall framing",
  "window-header": "window headers", "window-plate": "window plates", "doorway-frame": "doorway framing",
  "utility-window-frame": "window framing", "gable-frame": "gable framing", "roof-frame": "roof framing",
  "gable-backing": "gable backing", "gable-window-frame": "gable window framing", loft: "loft", "roof-deck": "roof deck",
  "dormer-frame": "dormer framing", "porch-deck-frame": "porch deck framing", interior: "inside pieces", skids: "skids",
};
function partWords(p) { return PART_WORDS[p] || String(p).replace(/-/g, " "); }
/* Two openings in one breath: "the 72″ Wooden Double Doors and the 2×3
   Window on the right side", "the 2×3 Window and another 2×3 Window on ...". */
function pairWords(a, b) {
  const wa = itemWords(a), wb = itemWords(b), at = / on the .*$/;
  const where = wa.match(at)[0];
  if (where !== wb.match(at)[0]) return wa + " and " + wb;
  return wa.replace(at, "") + (a.c.n === b.c.n ? " and another " + b.c.n : " and " + wb.replace(at, "")) + where;
}

/* ------------------------------------------------------------ one building */

/* Every door, window, roll-up and gable window on the building with the
   rectangle its trim covers (model/layout.js openingRect). */
function openingsOf(plan) {
  const out = [];
  for (const it of plan.state.items) {
    const c = plan.CAT[it.cat];
    if (!c) continue;
    const r = LAYOUT.openingRect(it, plan);
    if (!r || r.u0 == null) continue;
    out.push({ it, c, r });
  }
  return out;
}

/* The two openings share a surface: a wall, or the gable over it. On a front
   or corner porch the front gable stands 4 ft past the front wall. */
function surfaceOf(o, plan) {
  if (o.r.plane === "gable") {
    const porchFront = (plan.t.porch === "F" || plan.t.porch === "C") && o.r.end === "F";
    return porchFront ? "gable-F" : o.r.end;
  }
  return o.it.wall;
}

/* A gable window's glass (its opening) as points in world x and y: the
   octagon's window ring, the 18x24's sash; the faux loft window has none. */
function glassOf(o) {
  const r = o.r, c = o.c;
  if (c.draw === "faux-loft") return null;
  if (r.plane !== "gable") return null;
  if (c.draw === "octagon") {
    const R = OCT_WIN / 2, pts = [];
    for (let i = 0; i < 8; i++) { const a = Math.PI / 8 + i * Math.PI / 4; pts.push([r.x + Math.cos(a) * R, r.yc + Math.sin(a) * R]); }
    return pts;
  }
  return [[r.clearX.x0, r.clear.y0], [r.clearX.x1, r.clear.y0], [r.clearX.x1, r.clear.y1], [r.clearX.x0, r.clear.y1]];
}
/* How far the glass reaches above the line the drawing cuts at. */
function glassOver(plan, pts) {
  let over = -Infinity;
  const half = plan.W / 2;
  for (const p of pts) over = Math.max(over, p[1] - (profileYat(plan.prof, Math.max(-half, Math.min(half, p[0]))) - GABLE_CUT_FT));
  return over;
}

function distToPoly(p, P) {
  let best = Infinity;
  for (let i = 0; i < P.length; i++) {
    const a = P[i], b = P[(i + 1) % P.length], dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz;
    const s = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l2)) : 0;
    best = Math.min(best, Math.hypot(p[0] - a[0] - s * dx, p[1] - a[1] - s * dz));
  }
  return best;
}

function checkOpenings(plan, ops, add) {
  const ws = plan.ws;
  /* past-wall and too-high, one opening at a time */
  for (const o of ops) {
    const r = o.r, it = o.it, w = ws[it.wall];
    if (r.plane === "gable") {
      const pts = glassOf(o);
      const over = pts ? glassOver(plan, pts) : -Infinity;
      if (over > EPS) add("problem", "too-high", "glass:" + r.end + ":" + it.cat, `${itemWords(o)} has its glass ${lengthWords(over)} above the roof.`, { wall: it.wall, items: [it.id] });
      else if (r.clipped) add("warning", "too-high", "trim:" + r.end + ":" + it.cat, `the roof cuts the trim of ${itemWords(o)}.`, { wall: it.wall, items: [it.id] });
      continue;
    }
    if (!w) continue;
    const half = w.len / 2, gap = Math.min(r.u0 + half, half - r.u1);
    if (gap < -EPS) add("problem", "past-wall", it.wall + ":" + it.cat, `${itemWords(o)} runs ${lengthWords(-gap)} past the corner.`, { wall: it.wall, items: [it.id] });
    else if (gap < LIMITS.cornerWarnFt - EPS) add("warning", "past-wall", it.wall + ":" + it.cat, `the trim of ${itemWords(o)} ends only ${lengthWords(gap)} from the corner.`, { wall: it.wall, items: [it.id] });
    const endWall = (it.wall === "F" || it.wall === "B") && !o.c.gable;
    const head = headTop(o), band = r.porchBand;
    if (!endWall) {
      const over = head - w.top;
      if (over > EPS) add("problem", "too-high", "head:" + it.wall + ":" + it.cat, `the head trim of ${itemWords(o)} is ${lengthWords(over)} above the top of the wall.`, { wall: it.wall, items: [it.id] });
      else if (band && band.y1 - w.top > EPS) add("warning", "too-high", "porch-band:" + it.wall + ":" + it.cat, `the porch header band over ${itemWords(o)} runs ${lengthWords(band.y1 - w.top)} above the top of the wall, into the roof.`, { wall: it.wall, items: [it.id] });
    } else {
      const gb = gableBandY(it.wall, plan);
      if (gb != null && head > gb + EPS) add("problem", "too-high", "band:" + it.wall + ":" + it.cat, `the head trim of ${itemWords(o)} runs ${lengthWords(head - gb)} into the gable trim band.`, { wall: it.wall, items: [it.id] });
      else if (gb != null && band && band.y1 > gb + EPS) add("warning", "too-high", "porch-band:" + it.wall + ":" + it.cat, `the porch header band over ${itemWords(o)} runs ${lengthWords(band.y1 - gb)} into the gable trim band.`, { wall: it.wall, items: [it.id] });
      let over = -Infinity;
      const hb = r.head || r;
      for (const u of [hb.u0, hb.u1]) {
        const x = (w.cx || 0) + w.ax[0] * u;
        over = Math.max(over, head - profileYat(plan.prof, Math.max(-plan.W / 2, Math.min(plan.W / 2, x))));
      }
      if (over > EPS) add("problem", "too-high", "roof:" + it.wall + ":" + it.cat, `the head trim of ${itemWords(o)} is ${lengthWords(over)} above the roof line.`, { wall: it.wall, items: [it.id] });
    }
    if (o.c.draw === "shop-door") {
      const want = doorHeightFt(plan.construction, plan.t.roof);
      if (want - r.ch > LIMITS.doorShortFt + EPS) add("problem", "door-fit", it.wall + ":" + it.cat, `${itemWords(o)} should be ${inchWords(want)} tall, but the wall leaves room for ${inchWords(r.ch)}.`, { wall: it.wall, items: [it.id] });
    }
  }
  /* overlap: every pair on one surface */
  const bySurface = new Map();
  for (const o of ops) { const k = surfaceOf(o, plan); if (!bySurface.has(k)) bySurface.set(k, []); bySurface.get(k).push(o); }
  for (const list of bySurface.values()) {
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      const du = Math.min(a.r.clear.u1, b.r.clear.u1) - Math.max(a.r.clear.u0, b.r.clear.u0);
      const dy = Math.min(a.r.clear.y1, b.r.clear.y1) - Math.max(a.r.clear.y0, b.r.clear.y0);
      const id = a.it.wall + ":" + [a.it.cat, b.it.cat].sort().join("/");
      if (du > EPS && dy > EPS) { add("problem", "overlap", id, `${pairWords(a, b)} overlap by ${lengthWords(du)}.`, { wall: a.it.wall, items: [a.it.id, b.it.id] }); continue; }
      const ca = casingSpan(a), cb = casingSpan(b);
      const tu = Math.min(ca[1], cb[1]) - Math.max(ca[0], cb[0]), ty = Math.min(a.r.y1, b.r.y1) - Math.max(a.r.y0, b.r.y0);
      if (tu > -EPS && ty > EPS) add("warning", "overlap", id, `the casings of ${pairWords(a, b)} ${tu > EPS ? "lap by " + lengthWords(tu) : "touch"}.`, { wall: a.it.wall, items: [a.it.id, b.it.id] });
    }
  }
}

/* Every gable window the business sells, put where the gable is tallest
   (under the peak, as far over as the designer lets it go) and as low as
   the designer lets it go. A window that does not fit there fits nowhere.
   Both gables are the same shape, so one is tried. */
function checkGableItems(plan, add, opts) {
  const P = plan.prof;
  let apexX = P[0][0], apexY = -Infinity;
  for (const p of P) if (p[1] > apexY + EPS) { apexY = p[1]; apexX = p[0]; }
  for (const id of Object.keys(plan.CAT)) {
    const c = plan.CAT[id];
    if (!c.gable) continue;
    /* lane 4 (BUILDFAST-SPEC E.4) stops offering a gable item that does not
       fit; where the designer does not offer it there is nothing to check */
    if (!opts.allGableItems && typeof LAYOUT.gableItemFits === "function" && !LAYOUT.gableItemFits(c, plan)) continue;
    const lim = Math.max(0, plan.W / 2 - c.w / 2 - 0.6);          /* model/layout.js clampPos, a gable end */
    const it = { id: "gable-item-check", cat: id, wall: "B", pos: Math.max(-lim, Math.min(lim, apexX)), vy: -1000, inc: false };
    const r = LAYOUT.openingRect(it, plan);
    if (!r) continue;
    const o = { it, c, r };
    const pts = glassOf(o);
    const over = pts ? glassOver(plan, pts) : -Infinity;
    if (over > EPS) add("problem", "gable-item", id, `the ${c.n}, put under the peak of a gable as low as it goes, pokes ${lengthWords(over)} through the roof.`, { items: [id] });
    else if (r.clipped || r.u0 == null) add("warning", "gable-item", id, `the roof cuts the trim of the ${c.n}, even under the peak of a gable as low as it goes.`, { items: [id] });
  }
}

/* The roof edge over each long wall: high enough to walk under, and clear of
   the door heads on that wall (a builder cannot hang a door behind it). */
function checkEave(plan, ops, add) {
  const P = G.roofOutline(plan).P;
  for (const [wall, tip, side] of [["L", P[0], "left side"], ["R", P[P.length - 1], "right side"]]) {
    const h = tip[1] - y0;
    if (h < LIMITS.eaveMinFt - EPS) add("problem", "eave", wall + ":floor", `the roof edge over the ${side} is only ${lengthWords(h)} above the floor (6 ft at least).`, { wall });
    for (const o of ops) {
      if (o.it.wall !== wall || o.r.plane !== "wall") continue;
      const hang = headTop(o) - tip[1];
      if (hang <= EPS) continue;
      const words = `the roof edge hangs ${lengthWords(hang)} in front of the head of ${itemWords(o)}.`;
      if (o.c.k === "win") add("warning", "eave", wall + ":" + o.it.cat, words, { wall, items: [o.it.id] });
      else add("problem", "eave", wall + ":" + o.it.cat, words, { wall, items: [o.it.id] });
    }
  }
}

function checkRoof(plan, add) {
  const P = plan.prof, t = plan.t, topY = plan.topY, W = plan.W;
  let apex = 0;
  for (let i = 1; i < P.length; i++) if (P[i][1] > P[apex][1]) apex = i;
  for (let i = 0; i < apex; i++) if (!(P[i + 1][1] > P[i][1] + EPS)) { add("problem", "roof", "rise-left", "the roof does not rise toward the peak on the left side."); break; }
  for (let i = apex; i < P.length - 1; i++) if (!(P[i + 1][1] < P[i][1] - EPS)) { add("problem", "roof", "rise-right", "the roof does not rise toward the peak on the right side."); break; }
  if (t.roof === "gambrel" && P.length === 5) {
    const kx = P[3][0];
    if (!(kx > EPS && kx < W / 2 - EPS) || !(P[1][0] < -EPS && P[1][0] > -W / 2 + EPS)) add("problem", "roof", "knee", "the barn roof's knee is outside the walls.");
    else {
      const lower = (P[1][1] - P[0][1]) / (P[1][0] - P[0][0]), upper = (P[2][1] - P[1][1]) / (P[2][0] - P[1][0]);
      if (!(lower > upper + EPS)) add("problem", "roof", "barn-slopes", `the barn roof's upper slope (${pitchWords(upper * 12)}) is steeper than its lower slope (${pitchWords(lower * 12)}).`);
    }
  }
  const rise = P[apex][1] - topY;
  if (rise < LIMITS.peakMinFt - EPS) add("problem", "roof", "peak-low", `the roof peak is only ${lengthWords(rise)} above the wall (1 ft at least).`);
  else if (rise > LIMITS.peakMaxFt + EPS) add("problem", "roof", "peak-high", `the roof peak is ${lengthWords(rise)} above the wall (8 ft at most).`);
  else if (rise < LIMITS.peakWarnFt - EPS) add("warning", "roof", "peak-low", `the roof peak is only ${lengthWords(rise)} above the wall.`);
  const lim = ROOF_PITCH_LIMITS[t.roof];
  if (lim && rise > 0) {
    const pitch = rise / (t.roof === "gable" ? W / 2 : W) * 12;
    if (pitch > lim[1] + 1e-6) add("problem", "roof", "pitch", `the roof pitch is ${pitchWords(pitch)}, steeper than ${lim[1]}/12, the steepest the 3D designer draws.`);
    else if (pitch < lim[0] - 1e-6) add("problem", "roof", "pitch", `the roof pitch is ${pitchWords(pitch)}, flatter than ${lim[0]}/12, the flattest the 3D designer draws.`);
  }
}

/* The dormer, as parts/dormer.js draws it (parts/roof-frame.js dormerGeom). */
function checkDormer(plan, add) {
  const g = dormerGeom(plan);
  if (!g) return;
  const raw = Math.min(1.95, g.yI - 0.35 - g.yB);
  if (raw < LIMITS.dormerFaceFt - EPS) add("problem", "dormer", "face", `the dormer front is only ${lengthWords(Math.max(0, raw))} tall; the roof is too flat for it (1 ft 2 3/8 in at least).`);
  if (!(g.yI > g.yT + EPS)) add("problem", "dormer", "roof", "the dormer roof would not rise from its front to the main roof.");
  const wh = g.wins.length ? g.wins[0].wh : 0;
  if (wh < LIMITS.dormerWindowFt - EPS) add("problem", "dormer", "windows", `the dormer windows are only ${lengthWords(Math.max(0, wh))} tall (7 in at least).`);
  const want = +plan.state.dormer;
  if (g.D < want - EPS) add("warning", "dormer", "short", `the ${want} ft dormer is drawn ${lengthWords(g.D)} long on a ${lengthWords(plan.L)} long building.`);
}

function checkPorch(plan, ops, add) {
  const t = plan.t, ws = plan.ws, W = plan.W, L = plan.L;
  if (t.porch === "S" && ws.S1) {
    const room = W / 2 + ws.S1.at;
    if (room < LIMITS.roomFt - EPS) add("problem", "porch", "room", `the side porch leaves only ${lengthWords(room)} of room inside (4 ft at least).`);
    /* the long wall left beside the porch (model/frame.js SIDE_WALL_MIN_FT):
       a porch as long as the building puts its end wall in the back wall */
    const wall = L - plan.span.P;
    if (wall < LIMITS.sideWallFt - EPS) add("problem", "porch", "side-wall", wall <= EPS
      ? `the ${lengthWords(plan.span.P)} side porch is as long as the building, so there is no side wall beside it (4 ft at least).`
      : `the ${lengthWords(plan.span.P)} side porch leaves only ${lengthWords(wall)} of side wall beside it (4 ft at least).`);
  }
  if ((t.porch === "F" || t.porch === "C") && ws.F) {
    const room = L / 2 + ws.F.at;
    if (room < LIMITS.roomFt - EPS) add("problem", "porch", "room", `the porch leaves only ${lengthWords(room)} of room inside (4 ft at least).`);
  }
  if (t.porch === "C" && ws.P1 && ws.P2) {
    const side = ws.P1.ax[0] * ws.P1.len;
    if (side < -EPS) add("problem", "porch", "angled", "the angled porch wall would run backwards.");
    else if (side < LIMITS.wrapSidewaysFt - EPS) add("problem", "porch", "angled", `the angled porch wall runs only ${lengthWords(side)} sideways (2 ft at least).`);
    if (ws.P2.len < LIMITS.wrapFrontFt - EPS) add("problem", "porch", "front-wall", `the porch front wall is only ${lengthWords(ws.P2.len)} long (1 ft at least).`);
  }
  /* every opening on a wall of the closed-in room */
  const room = roomOutline(plan);
  for (const o of ops) {
    if (o.r.plane !== "wall") continue;
    const w = ws[o.it.wall];
    if (!w) continue;
    const us = o.r.casing ? [o.r.casing.u0, o.r.u, o.r.casing.u1] : [o.r.u0, (o.r.u0 + o.r.u1) / 2, o.r.u1];
    let off = 0;
    for (const u of us) { const p = wallPt(w, u, 0, 0); off = Math.max(off, distToPoly([p[0], p[2]], room)); }
    if (off > ON_WALL_FT) add("problem", "porch", "open:" + o.it.wall + ":" + o.it.cat, `${itemWords(o)} is where there is no wall (${t.kennel ? "the open run" : "the open porch"}).`, { wall: o.it.wall, items: [o.it.id] });
  }
  /* porch posts on the porch deck, where parts/openings/porch-post.js stands them */
  const decks = porchOutlines(plan);
  for (const it of plan.state.items) {
    const c = plan.CAT[it.cat];
    if (!c || c.k !== "post") continue;
    let p = null;
    if (t.porch === "F" || (t.porch === "C" && it.wall === "F")) p = [it.pos, L / 2 - 0.2];
    else if (t.porch === "R" || t.porch === "S" || (t.porch === "C" && it.wall === "R")) p = [W / 2 - 0.2, -it.pos];
    if (!p) { add("warning", "porch", "post-none:" + it.wall, `the ${c.n} on the ${WALL_WORDS[it.wall] || it.wall} is not drawn: there is no porch edge there.`, { wall: it.wall, items: [it.id] }); continue; }
    if (!decks.some((P) => pointInPoly(p, P))) add("problem", "porch", "post:" + it.wall, `the ${c.n} on the ${WALL_WORDS[it.wall] || it.wall} stands off the porch deck.`, { wall: it.wall, items: [it.id] });
  }
}

/* The framing, held to tools/check-framing.mjs rules 3 to 5. Findings are
   gathered by kind and part, so one bad rule is one line, not a hundred. */
function checkFraming(plan, add) {
  const solids = [];
  let idBase = 0;
  for (const en of PIPELINE) {
    if (!en.frame) continue;
    const m = en.module;
    if (!m || m.pending === true) continue;
    let ms;
    try {
      if (typeof m.appliesTo === "function" && !m.appliesTo(plan)) continue;
      if (typeof m.members !== "function") { add("warning", "framing", "unlisted:" + en.entry, `the ${partWords(en.entry)} lists no pieces, so it was not checked.`); continue; }
      ms = m.members(plan) || [];
    } catch (e) {
      add("problem", "framing", "works-out:" + en.entry, `the ${partWords(en.entry)} could not be worked out (${String(e && e.message || e)}).`);
      continue;
    }
    for (const s of G.solidsOf(ms, en.entry, idBase)) solids.push(s);
    idBase += ms.length;
  }
  const skids = G.skidSolids(plan);
  const region = new Map();
  for (const r of G.regionProblems(plan, solids)) {
    const k = r.solid.part + "|" + r.why;
    const g = region.get(k) || { n: 0, part: r.solid.part, kind: r.solid.kind, why: r.why };
    g.n++; region.set(k, g);
  }
  for (const g of region.values()) add("problem", "framing", "region:" + g.part + ":" + g.why, `${g.n === 1 ? "a piece" : g.n + " pieces"} of the ${partWords(g.part)} (${g.kind}) ${g.n === 1 ? "stands" : "stand"} ${g.why}.`);
  const pairs = new Map();
  for (const o of G.overlaps(solids.concat(skids))) {
    if (o.a.part === "skids" && o.b.part === "skids") continue;
    const ab = [o.a, o.b].sort((x, y) => String(x.part).localeCompare(String(y.part)));
    const k = ab[0].part + "/" + ab[1].part;
    const g = pairs.get(k) || { n: 0, depth: 0, a: ab[0], b: ab[1] };
    g.n++; if (o.depth > g.depth) { g.depth = o.depth; g.a = ab[0]; g.b = ab[1]; }
    pairs.set(k, g);
  }
  for (const [k, g] of pairs) {
    const which = g.a.part === g.b.part && g.a.kind === g.b.kind ? `two ${g.a.kind}s of the ${partWords(g.a.part)}` : `the ${partWords(g.a.part)} ${g.a.kind} and the ${partWords(g.b.part)} ${g.b.kind}`;
    add("problem", "framing", "overlap:" + k, `${g.n === 1 ? "two framing pieces overlap" : g.n + " pairs of framing pieces overlap, the most"} by ${lengthWords(g.depth)} (${which}).`);
  }
  const bear = new Map();
  for (const b of G.bearingProblems(solids, solids.concat(skids))) {
    const k = b.solid.part + "|" + b.solid.kind;
    const g = bear.get(k) || { n: 0, part: b.solid.part, kind: b.solid.kind };
    g.n++; bear.set(k, g);
  }
  for (const g of bear.values()) add("problem", "framing", "bearing:" + g.part + ":" + g.kind, `${g.n === 1 ? "a piece" : g.n + " pieces"} of the ${partWords(g.part)} (${g.kind}) ${g.n === 1 ? "rests" : "rest"} on nothing and ${g.n === 1 ? "is" : "are"} nailed to nothing.`);
}

/* Room to stand or store under the roof framing over the loft floor, at the
   middle (the highest spot). */
function checkLoft(plan, add) {
  const zones = loftZones(plan);
  if (!zones.length) return;
  const sec = roofSection(plan);
  const under = envY(sec, sec.deckT + sec.chord.d, 0);
  const head = under - Math.max.apply(null, zones.map((z) => z.yd1));
  if (head < LIMITS.loftMinFt - EPS) add("problem", "loft", "headroom", `the loft has only ${lengthWords(Math.max(0, head))} of headroom under the roof framing (2 ft at least).`);
  else if (head < LIMITS.loftWarnFt - EPS) add("warning", "loft", "headroom", `the loft has ${lengthWords(head)} of headroom under the roof framing.`);
}

/* One building, as it is drawn. opts:
     label          the words that start every line (default "<style> <size>")
     gableItems     false: skip the gable-item placements (checkStyle tries
                    them once per size, not once per variant)
     allGableItems  true: try every gable item even where the designer would
                    not offer it (the fixtures that prove the check)
     framing        false: skip the framing (the slowest part, ~8 ms) */
export function checkBuilding(plan, opts) {
  opts = opts || {};
  const t0 = now();
  const label = opts.label || (plan.t.name + " " + plan.state.size);
  const out = { problems: [], warnings: [], ms: 0 };
  function add(level, code, id, detail, where) {
    const f = { code, id: code + ":" + id, words: label + ": " + detail, detail, where: where || {} };
    (level === "problem" ? out.problems : out.warnings).push(f);
  }
  const ops = openingsOf(plan);
  checkOpenings(plan, ops, add);
  if (opts.gableItems !== false) checkGableItems(plan, add, opts);
  checkEave(plan, ops, add);
  checkRoof(plan, add);
  checkDormer(plan, add);
  checkPorch(plan, ops, add);
  if (opts.framing !== false) checkFraming(plan, add);
  checkLoft(plan, add);
  out.ms = now() - t0;
  return out;
}

/* ------------------------------------------------------------- one style */

/* The ways one size of style t can be built that change the drawing:
   [{id, words, set}] where set is what goes into the design. */
export function variantsOf(t, cat) {
  if (t.porch === "S") {
    const lengths = (t.sidePorch && Array.isArray(t.sidePorch.lengthsFt) && t.sidePorch.lengthsFt.length) ? t.sidePorch.lengthsFt.slice() : [8, 12];
    const out = [];
    for (const len of lengths) {
      out.push({ id: `porch ${len} corner`, words: `with the ${len} ft side porch at the corner`, set: { pLen: len, pFlip: false, pMid: false } });
      out.push({ id: `porch ${len} flipped`, words: `with the ${len} ft side porch flipped to the other end`, set: { pLen: len, pFlip: true, pMid: false } });
      out.push({ id: `porch ${len} middle`, words: `with the ${len} ft side porch in the middle`, set: { pLen: len, pFlip: false, pMid: true } });
    }
    return out;
  }
  if (t.dormer) {
    const sizes = (cat.DORMERS || []).filter((d) => d[0] !== "none");
    if (sizes.length) return sizes.map((d) => ({ id: "dormer " + d[0], words: `with the ${d[0]} ft dormer`, set: { dormer: d[0] } }));
  }
  return [{ id: "", words: "", set: {} }];
}

/* Typical size first (the one the designer opens on), then the smallest and
   the largest, then the rest in the price list's order -- so a check that
   runs out of time has looked at the ones that matter most. */
export function orderSizes(sizes) {
  if (sizes.length < 3) return sizes.slice();
  const area = (z) => { const a = String(z).split("x"); return (+a[0]) * (+a[1]); };
  const typical = sizes[Math.min(4, sizes.length - 1)];
  let small = sizes[0], large = sizes[0];
  for (const z of sizes) { if (area(z) < area(small)) small = z; if (area(z) > area(large)) large = z; }
  const out = [typical];
  for (const z of [small, large].concat(sizes)) if (out.indexOf(z) < 0) out.push(z);
  return out;
}

/* Does a known-list entry cover this finding? An entry:
   {styles: ["SU"], sizes?: ["8x12"], variants?: ["dormer 9"], code, id?, reason} */
function knownMatch(known, styleKey, size, variant, f) {
  for (let i = 0; i < known.length; i++) {
    const k = known[i];
    if (!k || k.code !== f.code) continue;
    if (k.id && k.id !== f.id) continue;
    if (Array.isArray(k.styles) && k.styles.indexOf(styleKey) < 0) continue;
    if (Array.isArray(k.sizes) && k.sizes.indexOf(size) < 0) continue;
    if (Array.isArray(k.variants) && k.variants.indexOf(variant) < 0) continue;
    return i;
  }
  return -1;
}

/* The roof's height above the wall at every sold width: a wider building of
   one style is never lower. Cheap (no drawing), so it always covers every
   size, whatever the time budget. */
function checkWidths(cat, key, base, sizes, add) {
  const byW = new Map();
  for (const z of sizes) {
    let fr;
    try { fr = frameOf(Object.assign({}, base, { size: z }), cat); } catch (e) { continue; }   /* checkStyle reports it */
    let top = -Infinity;
    for (const p of fr.prof) top = Math.max(top, p[1]);
    const rise = top - fr.topY, g = byW.get(fr.W) || { lo: Infinity, hi: -Infinity };
    g.lo = Math.min(g.lo, rise); g.hi = Math.max(g.hi, rise);
    byW.set(fr.W, g);
  }
  const widths = [...byW.keys()].sort((a, b) => a - b);
  let tallest = null;      /* {w, rise}: the tallest narrower width so far */
  for (let i = 0; i < widths.length; i++) {
    const w = widths[i], g = byW.get(w);
    if (tallest && g.lo < tallest.rise - EPS) {
      add("problem", "roof-widths", tallest.w + "-" + w, `${tallest.w} ft wide is ${lengthWords(tallest.rise)} tall, taller than ${w} ft wide (${lengthWords(g.lo)}).`);
    } else if (i > 0) {
      const prev = byW.get(widths[i - 1]);
      if (g.lo - prev.hi > LIMITS.widthJumpFt + EPS) add("warning", "roof-widths", widths[i - 1] + "-" + w, `the roof is ${lengthWords(g.lo - prev.hi)} taller at ${w} ft wide than at ${widths[i - 1]} ft wide.`);
    }
    if (!tallest || g.hi > tallest.rise) tallest = { w, rise: g.hi };
  }
}

/* One style at every size it is sold in, each with its variants. opts:
     sizes      only these sizes (default: every size in the price list)
     variants   instead of variantsOf(t, cat)
     known      the known list (test/style-sizes-known.json "known"): a
                finding it covers becomes a warning with its reason
     budgetMs   stop starting new buildings after this long; what is left
                is listed in `unchecked` (the roof-widths test always runs)
     widths     false: skip the roof-widths test (a check done a size at a
                time runs it once)
     framing, allGableItems   passed to checkBuilding */
export function checkStyle(cat, key, opts) {
  opts = opts || {};
  const t0 = now();
  const t = cat.TYPES[key];
  if (!t) throw new Error(`"${key}" is not a building style this price list offers.`);
  const styleKey = t.base || key;
  const all = Object.keys(cat.P[key] || {});
  const sizes = orderSizes(opts.sizes ? all.filter((z) => opts.sizes.indexOf(z) >= 0) : all);
  const variants = opts.variants || variantsOf(t, cat);
  const known = opts.known || [];
  const budget = opts.budgetMs == null ? Infinity : opts.budgetMs;
  const res = { key, name: t.name, base: styleKey, results: [], problems: [], warnings: [], buildings: 0, unchecked: [], knownHits: [], ms: 0 };
  function file(f, size, variant) {
    const k = knownMatch(known, styleKey, size, variant, f);
    if (k >= 0) { f.known = known[k].reason; f.knownIndex = k; res.knownHits.push(k); res.warnings.push(f); return "warning"; }
    res.problems.push(f); return "problem";
  }
  const base = defaults(cat);
  setType(base, key, cat);
  if (opts.widths !== false) checkWidths(cat, key, base, all, function (level, code, id, detail) {
    const f = { code, id: code + ":" + id, words: t.name + ": " + detail, detail, where: {} };
    if (level === "problem") file(f, "", ""); else res.warnings.push(f);
  });
  /* a size that cannot even be laid out is a problem in plain words, never
     a crash of the whole check (a save must still get its answer) */
  function cannotDraw(z, v, label, e) {
    const detail = `this building could not be drawn: ${String(e && e.message || e).replace(/\.?\s*$/, "")}.`;
    return { problems: [{ code: "draws", id: "draws:" + z, words: label + ": " + detail, detail, where: {} }], warnings: [], ms: 0 };
  }
  for (const z of sizes) {
    const seen = new Set();
    let first = true;
    for (const v of variants) {
      const label = t.name + " " + z + (v.words ? " " + v.words : "");
      const st = structuredClone(base);
      st.size = z;
      Object.assign(st, v.set);
      let fr = null, r = null;
      try { fr = frameOf(st, cat); } catch (e) { r = cannotDraw(z, v, label, e); }
      if (fr) {
        const sig = JSON.stringify([fr.span, t.dormer ? st.dormer : null]);
        if (seen.has(sig)) continue;          /* a 12 ft side porch on a building under 20 ft is the 8 ft one */
        seen.add(sig);
      } else if (seen.has("cannot draw")) continue;
      else seen.add("cannot draw");
      if (now() - t0 > budget) { res.unchecked.push({ size: z, variant: v.id, words: label }); continue; }
      if (!r) {
        try {
          LAYOUT.resetItems(st, fr, cat);
          r = checkBuilding(makePlan(st, cat), { label, gableItems: first, framing: opts.framing, allGableItems: opts.allGableItems });
        } catch (e) { r = cannotDraw(z, v, label, e); }
      }
      first = false;
      res.buildings++;
      const row = { size: z, variant: v.id, label, problems: [], warnings: r.warnings.slice(), ms: r.ms };
      for (const f of r.problems) { if (file(f, z, v.id) === "problem") row.problems.push(f); else row.warnings.push(f); }
      for (const f of r.warnings) res.warnings.push(f);
      res.results.push(row);
    }
  }
  res.ms = now() - t0;
  return res;
}
