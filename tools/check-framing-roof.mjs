/* CHECK: the roof framing is built like a real roof and fits inside the roof
   Barnwright draws. Run: node tools/check-framing-roof.mjs   (check-all: node)

   The five roof framing parts -- roof-frame (trusses or rafters), gable-frame
   (gable studs and the framing round gable openings), roof-deck (purlins or
   OSB), loft and dormer-frame -- are NEW geometry (Barnwright drew none),
   shown only in the Framing view and in Watch-it-build. This check builds
   every one of them for many buildings and proves, in plain words:

   1. INSIDE THE ROOF AS DRAWN. Every corner of every board is:
      * under the underside of the roof slab -- taken from the finished
        drawing itself (the roof's underside triangles, "roofU", at stage
        roofing), not from the framing's own sums;
      * inside the walls: above the wall top (topY, or a lean-to's or single
        slope's tall wall's own top over that wall's framing);
      * outside the walls (the eaves): not past the tip of the drawn roof and
        not below the eave's drawn bottom edge (the metal's cut edge on a bare
        eave, the fascia on a boxed one, the level soffit on the cottage);
      * past the gable ends (the rake overhang): only roof deck, only under
        the slab, not past the roof's own end;
      * for the dormer's framing, alternatively inside the dormer as drawn:
        under its roof panel (found in the dormer part's own triangles), inside
        its face and cheeks, above its soffit, and above the main roof's steel
        where it overhangs to the sides.
   2. NO TWO BOARDS OVERLAP by more than 0.01 ft (an exact penetration depth
      for the boards' shapes, across all five parts at once).
   3. TRUSSES (or rafter pairs) stand at construction roof.spacingIn on
      centre along the length, with the last gap no larger, and there is one
      at EACH GABLE END, flush inside the gable siding; every truss has a top
      chord on every slope and (truss framing) a bottom chord, and at every
      heel a gusset plate covering the bottom chord's end.
   4. LOFT framing only on the styles with the loft trait, at each loft end,
      with the floor carried by members that really touch its underside (loft
      joists, and truss bottom chords only when they are as deep) no further
      apart than loft.spacingIn.
   5. PURLINS only where roofDeck.type is "purlins" (by default: the metal
      buildings, and only they), OSB only where it is "osb"; purlins no
      further apart up the slope than roofDeck.purlins.spacingIn.
   6. DORMER framing only when a dormer is drawn; nothing of the main roof's
      trusses or deck is left inside the dormer (item 2 proves it); the
      trimmer trusses either side of the dormer, which carry its header, are
      whole (as much web lumber as a plain truss).
   7. GABLE OPENINGS: every gable window, vent and tall end door the gable
      framing frames has a king stud each side (or, for a window run up into
      the top chord near an eave, the chord closing that side) and a header
      on jacks wherever even a flat 2x fits under the top chord (worked out
      from the drawn roof), else the end truss's chord over it; no gable stud
      or chord crosses a gable window's clear opening, wherever the window is
      dragged; the gable studs stand on the end wall's own stud layout.
   8. THE DRAWING IS THE DATA: in assemble(plan, {frames: true}) each part
      draws exactly its members (the number of triangles, and every corner),
      in its own building step(s).
   9. frames: true LEAVES THE FINISHED BUILDING UNTOUCHED: every triangle of
      every finished step is identical, in the same materials, in the same
      order, with the framing drawn or not.
   Buildings: all 148 recorded Barnwright buildings; every style at EVERY size
   it is sold in with its standard doors and windows (and the Dormer Shed with
   each dormer size); every style's typical building again with the
   construction changed -- rafters instead of trusses, 16 in spacing, 2x6
   chords, 2x6 studs, purlins forced on a painted building and OSB on a metal
   one, and a 2x4 loft joist; every style's typical building with each gable
   window dragged as far as the designer lets it go toward both eaves, up and
   down; and the Standard Barn with two openings on one end.
   If another framing part (walls, floor) is finished, any of its corners
   buried more than 0.01 ft inside a roof board is reported as a warning. */

import { readGoldenCases } from "./lib/golden-cases.mjs";
import { readFixture, catalogue } from "./lib/headless.mjs";
import { makePlan } from "../model/plan.js";
import { frameOf } from "../model/frame.js";
import { setType, setSize, defaults } from "../model/design.js";
import { resetItems, openingRect, clampPos } from "../model/layout.js";
import { mergeConstruction } from "../model/construction.js";
import { ROOF_TH } from "../model/roof-shapes.js";
import { assemble } from "../engine/assemble.js";
import { STAGES, STAGE_ID } from "../parts/stages.js";
import { PIPELINE } from "../parts/index.js";
import roofFramePart, { roofFrameMembers, lumberFt, gableOpenings, roofSection, trussLayout } from "../parts/roof-frame.js";
import { wallRuns } from "../parts/wall-frame.js";
import gableFramePart, { gableFrameMembers } from "../parts/gable-frame.js";
import roofDeckPart, { roofDeckMembers } from "../parts/roof-deck.js";
import loftPart, { loftMembers } from "../parts/loft.js";
import dormerFramePart, { dormerFrameMembers } from "../parts/dormer-frame.js";

const EPS = 1e-4;           /* a corner may sit this far past a boundary (float noise) */
const OVERLAP = 0.01;       /* boards may touch; overlapping by more than this fails */

let pass = 0, fail = 0;
const failures = [];
const firstOf = new Map();
function ok(name, cond, extra) {
  if (cond) { pass++; return true; }
  fail++;
  const n = (firstOf.get(name) || 0) + 1;
  firstOf.set(name, n);
  if (n <= 3) failures.push(name + (extra ? " -- " + extra : ""));
  else if (n === 4) failures.push(name + " -- (more of the same not listed)");
  return false;
}
const warnings = [];

const MY_PARTS = [
  { id: "roof-frame", part: roofFramePart, members: roofFrameMembers, stages: ["roof-frame"] },
  { id: "gable-frame", part: gableFramePart, members: gableFrameMembers, stages: ["roof-frame"] },
  { id: "roof-deck", part: roofDeckPart, members: roofDeckMembers, stages: ["roof-deck"] },
  { id: "loft", part: loftPart, members: loftMembers, stages: ["loft"] },
  { id: "dormer-frame", part: dormerFramePart, members: dormerFrameMembers, stages: ["dormer-frame", "roof-deck"] },
];
const FINISHED_STAGE_IDS = new Set(STAGES.filter((s) => s.kind !== "frame").map((s) => s.id));

/* ======================= the buildings ======================= */

const cat = catalogue();
function withConstruction(over) {
  return Object.assign({}, cat, { construction: mergeConstruction(cat.construction, over) });
}
const buildings = [];
for (const c of readGoldenCases().cases) buildings.push({ id: c.id, state: readFixture(c.id).state, cat, full: true });
/* every style at every size, with its standard doors and windows */
const styleKeys = Object.keys(cat.TYPES);
const typical = {};
for (const k of styleKeys) {
  const st = defaults(cat);
  setType(st, k, cat);
  typical[k] = structuredClone(st);
  for (const size of Object.keys(cat.P[k] || {})) {
    const s = structuredClone(st);
    setSize(s, size, cat);
    resetItems(s, frameOf(s, cat), cat);
    if (cat.TYPES[k].dormer) {
      for (const dz of (cat.DORMERS || []).map((d) => d[0]).filter((d) => d !== "none")) {
        const sd = structuredClone(s); sd.dormer = dz;
        buildings.push({ id: `${k}-${size}-dormer${dz}`, state: sd, cat, full: false });
      }
    } else buildings.push({ id: `${k}-${size}`, state: s, cat, full: false });
  }
}
/* the construction changed, on every style's typical building */
const VARIANTS = [
  ["rafters", { roof: { framing: "rafter" } }],
  ["16in", { roof: { spacingIn: 16 } }],
  ["2x6-chords", { roof: { chord: "2x6" } }],
  ["2x6-studs", { walls: { stud: "2x6" } }],
  ["purlins", { roofDeck: { type: "purlins" } }],
  ["osb", { roofDeck: { type: "osb" } }],
  ["rafters+purlins", { roof: { framing: "rafter" }, roofDeck: { type: "purlins" } }],
  ["2x4-loft", { loft: { joist: "2x4" } }],
];
for (const [vn, over] of VARIANTS) {
  const vcat = withConstruction(over);
  for (const k of styleKeys) {
    const s = structuredClone(typical[k]);
    if (cat.TYPES[k].dormer) s.dormer = "12";
    buildings.push({ id: `${k}-${s.size}-${vn}`, state: s, cat: vcat, full: true, variant: vn });
  }
}

/* gable windows DRAGGED: to both eaves and to the top and bottom of the
   gable, on every style's typical building (clampPos keeps them where the
   designer lets a customer put them) -- a window near an eave runs up into
   the end truss's top chord and must still be framed. And the Standard Barn,
   whose end doors rise into the gable, with two openings on one end. */
for (const k of styleKeys) {
  for (const c of ["oct", "g1824", "fake"]) {
    if (!cat.CAT[c]) continue;
    for (const wall of ["F", "B"]) for (const pos of [-99, 99]) for (const vy of [-9, 9]) {
      const s = structuredClone(typical[k]);
      const it = { id: "drag", cat: c, wall, pos, vy, inc: false };
      s.items.push(it);
      clampPos(it, s, frameOf(s, cat));
      buildings.push({ id: `${k}-${s.size}-${c}-${wall}-${pos < 0 ? "left" : "right"}-${vy < 0 ? "low" : "high"}`, state: s, cat, full: false, dragged: true });
    }
  }
}
for (const size of Object.keys(cat.P.SB || {})) for (const [a, b] of [["w36", "ru6"], ["d36in", "ru6"], ["w48", "w36"]]) {
  const s = structuredClone(typical.SB);
  setSize(s, size, cat); resetItems(s, frameOf(s, cat), cat);
  const W = +size.split("x")[0];
  const i1 = { id: "e1", cat: a, wall: "B", pos: -W / 2 + 1.2, inc: false }, i2 = { id: "e2", cat: b, wall: "B", pos: W / 2 - 3, inc: false };
  s.items.push(i1, i2);
  clampPos(i1, s, frameOf(s, cat)); clampPos(i2, s, frameOf(s, cat));
  buildings.push({ id: `SB-${size}-${a}+${b}-on-B`, state: s, cat, full: false });
}

/* ======================= the region test ======================= */

/* The roof as DRAWN: the underside quads of the roof slab (roofU, stage
   roofing) -> the underside line and each slope's z extent. */
function drawnRoof(build) {
  const b = build.buckets.roofU;
  const pts = [], segs = [];
  const RS = STAGE_ID.roofing;
  for (let i = 0; i < b.n; i += 3) {
    const v = b.v.slice(i * 9, i * 9 + 27);
    if (v[8] !== RS) continue;
    const xs = [v[0], v[9], v[18]], ys = [v[1], v[10], v[19]], zs = [v[2], v[11], v[20]];
    for (let k = 0; k < 3; k++) pts.push([xs[k], ys[k]]);
    segs.push({ x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) });
  }
  const uniq = [];
  pts.sort((a, c) => a[0] - c[0] || a[1] - c[1]).forEach((p) => {
    const l = uniq[uniq.length - 1];
    if (!l || Math.abs(l[0] - p[0]) > 1e-6 || Math.abs(l[1] - p[1]) > 1e-6) uniq.push(p);
  });
  return { line: uniq, segs };
}
function lineY(line, x) {
  if (x <= line[0][0]) return line[0][1];
  for (let i = 0; i + 1 < line.length; i++) {
    const a = line[i], c = line[i + 1];
    if (x >= a[0] - 1e-9 && x <= c[0] + 1e-9) return a[1] + (c[1] - a[1]) * ((x - a[0]) / ((c[0] - a[0]) || 1));
  }
  return line[line.length - 1][1];
}
function zExtentAt(roof, x) {
  let z0 = Infinity, z1 = -Infinity;
  for (const s of roof.segs) if (x >= s.x0 - 1e-6 && x <= s.x1 + 1e-6) { z0 = Math.min(z0, s.z0); z1 = Math.max(z1, s.z1); }
  return [z0, z1];
}
/* The dormer as drawn (the dormer part's own triangles): its face (body) and
   its roof panel (the roof quad reaching out over both side overhangs). */
function drawnDormer(build) {
  const tags = build.tags;
  function tris(key, part) {
    const out = [], b = build.buckets[key];
    if (!b) return out;
    for (const s of tags[key] || []) {
      if (s.part !== part) continue;
      for (let t = s.from; t < s.from + s.count; t++) {
        const v = b.v.slice(t * 27, t * 27 + 27);
        out.push([[v[0], v[1], v[2]], [v[9], v[10], v[11]], [v[18], v[19], v[20]]]);
      }
    }
    return out;
  }
  const roofT = tris("roof", "dormer"), bodyT = tris("body", "dormer");
  if (!roofT.length || !bodyT.length) return null;
  let zmax = 0;
  roofT.forEach((t) => t.forEach((p) => { zmax = Math.max(zmax, Math.abs(p[2])); }));
  const panel = [];
  roofT.forEach((t) => { if (t.every((p) => Math.abs(Math.abs(p[2]) - zmax) < 1e-6)) t.forEach((p) => panel.push([p[0], p[1]])); });
  panel.sort((a, c) => a[0] - c[0]);
  const A = panel[0], B = panel[panel.length - 1];
  /* the face: body quads that stand at one x (the front wall's siding) */
  let xF = -Infinity, hw = 0, yT = -Infinity;
  bodyT.forEach((t) => { if (Math.abs(t[0][0] - t[1][0]) < 1e-9 && Math.abs(t[1][0] - t[2][0]) < 1e-9) { xF = Math.max(xF, t[0][0]); } });
  bodyT.forEach((t) => t.forEach((p) => { if (Math.abs(p[0] - xF) < 1e-9) { hw = Math.max(hw, Math.abs(p[2])); yT = Math.max(yT, p[1]); } }));
  const U = (x) => A[1] + (B[1] - A[1]) * (x - A[0]) / (B[0] - A[0]);
  /* the soffit, as parts/dormer.js draws it: from the top of the face
     (yT - 0.02) out to the fascia's bottom (0.15 under the panel's front
     edge, which is 0.02 above the dormer roof line) */
  const S0 = [xF, yT - 0.02], S1 = [B[0], U(B[0]) - 0.02 - 0.15];
  const soffit = (x) => S0[1] + (S1[1] - S0[1]) * (x - S0[0]) / (S1[0] - S0[0]);
  return { xI: A[0], xT: B[0], U, xF, hw, ovS: zmax - hw, yT, soffit };
}

/* Barnwright's eave drops (parts/roofing.js profileRoof): the metal's cut
   edge on a bare eave is 0.03 deep; the cottage's fascia is 4 in less the
   slab; any other boxed eave (the single slope) drops 0.24. */
function eaveDrop(plan) {
  const t = plan.t;
  if (t.cottage) {
    const ce = (plan.construction.roof && plan.construction.roof.cottageEave) || { fasciaIn: 4 };
    return Math.max(0.02, ce.fasciaIn / 12 - ROOF_TH);
  }
  return t.roof === "slope" ? 0.24 : 0.03;
}

function makeRegion(plan, build) {
  const roof = drawnRoof(build);
  const W = plan.W, L = plan.L, topY = plan.topY;
  const studD = lumberFt(plan.construction.walls.stud).d, zd = 0.02 + studD;
  const topL = Math.max(topY, plan.ws.L.top), topR = Math.max(topY, plan.ws.R.top);
  const tipL = roof.line[0], tipR = roof.line[roof.line.length - 1];
  const drop = eaveDrop(plan);
  const floorL = plan.t.cottage ? Math.max(topY, tipL[1] - drop) : tipL[1] - drop;
  const floorR = plan.t.cottage ? Math.max(topY, tipR[1] - drop) : tipR[1] - drop;
  const dormer = drawnDormer(build);
  /* the deck's depth measured straight down, on the steepest slope */
  const rd = plan.construction.roofDeck;
  const deckT = rd.type === "purlins" ? lumberFt(rd.purlins.size).t : rd.sheathingIn / 12;
  let steep = 0;
  for (let i = 0; i + 1 < roof.line.length; i++) { const a = roof.line[i], c = roof.line[i + 1]; steep = Math.max(steep, Math.abs(c[1] - a[1]) / Math.max(1e-9, Math.abs(c[0] - a[0]))); }
  const deckBand = deckT * Math.sqrt(1 + steep * steep);
  function mainWhy(p, isDeck) {
    const [x, y, z] = p;
    if (x < tipL[0] - EPS || x > tipR[0] + EPS) return "out past the tip of the roof";
    const U = lineY(roof.line, x);
    if (y > U + EPS) return `above the underside of the roof slab (${(y - U).toFixed(4)} ft)`;
    const [z0, z1] = zExtentAt(roof, x);
    if (z < z0 - EPS || z > z1 + EPS) return "past the end of the roof";
    if (Math.abs(z) > L / 2 + EPS) {
      if (!isDeck) return "a frame board out in the gable-end overhang";
      return null;
    }
    /* inside the walls: above the wall top (a tall wall's own top over its framing) */
    let inside = null;
    if (x >= -W / 2 - EPS && x <= W / 2 + EPS) {
      let floor = topY;
      /* over a wall's framing (from the siding plane in to the studs' inside
         face; a point ON that inside face is not over the wall) */
      if (x < -W / 2 + zd - EPS) floor = Math.max(floor, topL);
      if (x > W / 2 - zd + EPS) floor = Math.max(floor, topR);
      inside = y < floor - EPS ? `below the wall top inside the walls (${(floor - y).toFixed(4)} ft)` : null;
      if (!inside || (Math.abs(x) < W / 2 - EPS)) return inside;
    }
    /* out in an eave (or on the wall line itself, where either side may hold it) */
    const fl = x < 0 ? floorL : floorR;
    const tipX = x < 0 ? tipL[0] : tipR[0];
    if (Math.abs(tipX) <= W / 2 + EPS) return inside || "outside the walls where the roof has no eave";
    /* the deck may always follow the roof's underside out to the tip (the
       sheathing or purlins the steel is screwed to, and a boxed eave's
       fascia is nailed to); anything else stays above the eave's bottom */
    if (isDeck && y >= U - deckBand - EPS) return null;
    if (y < fl - EPS) return `below the eave's bottom edge (${(fl - y).toFixed(4)} ft)`;
    return null;
  }
  function dormerWhy(p) {
    if (!dormer) return "no dormer drawn";
    const [x, y, z] = p, d = dormer;
    if (x < d.xI - EPS || x > d.xT + EPS) return "outside the dormer's length";
    if (y > d.U(x) + EPS) return "above the dormer roof's underside";
    const az = Math.abs(z);
    if (az > d.hw + d.ovS + EPS) return "past the dormer's side overhang";
    if (az > d.hw + EPS) {
      if (y < lineY(roof.line, x) + ROOF_TH - EPS) return "in the main roof's steel under the dormer's side overhang";
      return null;
    }
    if (x > d.xF + EPS) { if (y < d.soffit(x) - EPS) return "below the dormer's soffit"; return null; }
    if (y < topY - EPS) return "below the wall top in the dormer";
    return null;
  }
  return {
    roof, deckT,
    why(p, partId, kind) {
      const isDeck = kind === "osb-sheet" || kind === "purlin";
      const a = mainWhy(p, isDeck);
      if (!a) return null;
      if (partId === "dormer-frame") { const b = dormerWhy(p); if (!b) return null; return a + " / dormer: " + b; }
      return a;
    },
  };
}

/* ======================= overlap (exact, for boards pushed along z) ======================= */

function axesOf(poly) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const nx = b[1] - a[1], ny = -(b[0] - a[0]), l = Math.hypot(nx, ny);
    if (l > 1e-12) out.push([nx / l, ny / l]);
  }
  return out;
}
function project(poly, ax) {
  let lo = Infinity, hi = -Infinity;
  for (const p of poly) { const d = p[0] * ax[0] + p[1] * ax[1]; if (d < lo) lo = d; if (d > hi) hi = d; }
  return [lo, hi];
}
/* How deep two boards overlap (the smallest push that separates them):
   the separating-axis test over both outlines' edge normals, and along z. */
function penetration(a, b) {
  const dz = Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0);
  if (dz <= 0) return 0;
  let best = dz;
  for (const ax of a.axes.concat(b.axes)) {
    const [a0, a1] = project(a.poly, ax), [b0, b1] = project(b.poly, ax);
    const o = Math.min(a1, b1) - Math.max(a0, b0);
    if (o <= 0) return 0;
    if (o < best) best = o;
  }
  return best;
}
function bbox(m) {
  let x0 = Infinity, x1 = -Infinity, y0_ = Infinity, y1_ = -Infinity;
  for (const p of m.poly) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0_ = Math.min(y0_, p[1]); y1_ = Math.max(y1_, p[1]); }
  return { x0, x1, y0: y0_, y1: y1_ };
}
function overlaps(all) {
  all.forEach((m) => { m.axes = axesOf(m.poly); m.bb = bbox(m); });
  const sorted = all.slice().sort((a, b) => a.z0 - b.z0);
  const bad = [];
  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i];
    for (let j = i + 1; j < sorted.length; j++) {
      const b = sorted[j];
      if (b.z0 >= a.z1 - OVERLAP) break;
      if (b.bb.x0 >= a.bb.x1 - OVERLAP || a.bb.x0 >= b.bb.x1 - OVERLAP || b.bb.y0 >= a.bb.y1 - OVERLAP || a.bb.y0 >= b.bb.y1 - OVERLAP) continue;
      const d = penetration(a, b);
      if (d > OVERLAP) bad.push({ a, b, d });
    }
  }
  return bad;
}
function describe(m) {
  const c = m.poly.reduce((s, p) => [s[0] + p[0] / m.poly.length, s[1] + p[1] / m.poly.length], [0, 0]);
  return `${m.part} ${m.kind} at x ${c[0].toFixed(2)} y ${c[1].toFixed(2)} z ${m.z0.toFixed(2)}..${m.z1.toFixed(2)}`;
}

/* ======================= run ======================= */

const counts = { buildings: 0, members: 0, corners: 0, pairs: 0, drawnChecked: 0, finishedChecked: 0, openings: 0, lofts: 0, purlinBuildings: 0, osbBuildings: 0, dormers: 0, rafterBuildings: 0, chordless: 0, chordClosed: 0, gableHeaders: 0, gableStuds: 0, heels: 0, trimmers: 0 };
const otherFrameParts = PIPELINE.filter((en) => en.frame && !MY_PARTS.some((p) => p.id === en.entry) && en.module && en.module.pending !== true);

for (const B of buildings) {
  let plan;
  try { plan = makePlan(B.state, B.cat); }
  catch (e) { ok(`${B.id}: the building can be planned`, false, e.message); continue; }
  counts.buildings++;
  const con = plan.construction, t = plan.t;
  let res;
  try { res = assemble(plan, { viewport: { w: 742, h: 803 }, fit: "barnwright", frames: true }); }
  catch (e) { ok(`${B.id}: assemble with frames draws`, false, e.stack); continue; }
  const region = makeRegion(plan, res.build);

  /* the members of every part */
  const all = [], byPart = {};
  for (const P of MY_PARTS) {
    const applies = P.part.appliesTo(plan);
    let list = [];
    try { list = applies ? P.members(plan) : []; }
    catch (e) { ok(`${B.id}: ${P.id} works out its members`, false, e.stack); }
    list.forEach((m) => { m.part = P.id; all.push(m); });
    byPart[P.id] = list;
  }
  counts.members += all.length;

  /* 1. the region */
  for (const m of all) {
    for (const q of m.poly) for (const z of [m.z0, m.z1]) {
      counts.corners++;
      const why = region.why([q[0], q[1], z], m.part, m.kind);
      if (why) { ok(`${B.id}: every corner of every board is inside the roof as drawn`, false, `${describe(m)}: corner (${q[0].toFixed(3)}, ${q[1].toFixed(3)}, ${z.toFixed(3)}) is ${why}`); break; }
    }
  }
  ok(`${B.id}: the roof as drawn was found`, region.roof.line.length >= 2);

  /* 2. overlaps */
  const bad = overlaps(all);
  counts.pairs += all.length;
  ok(`${B.id}: no two roof framing boards overlap by more than ${OVERLAP} ft`, bad.length === 0,
    bad.slice(0, 2).map((o) => `${describe(o.a)} and ${describe(o.b)} overlap ${o.d.toFixed(4)} ft`).join("; ") + (bad.length > 2 ? ` (+${bad.length - 2} more)` : ""));

  /* 3. trusses */
  const ct = lumberFt(con.roof.chord).t;
  const rf = byPart["roof-frame"];
  const zs = [...new Set(rf.filter((m) => m.kind === "top-chord").map((m) => Math.round(((m.z0 + m.z1) / 2) * 1e6) / 1e6))].sort((a, b) => a - b);
  const sp = con.roof.spacingIn / 12, endZ = plan.L / 2 - 0.02 - ct / 2;
  ok(`${B.id}: a truss (or rafter pair) at each gable end, flush inside the gable siding`,
    zs.length >= 2 && Math.abs(zs[0] + endZ) < 1e-6 && Math.abs(zs[zs.length - 1] - endZ) < 1e-6, `truss centres ${zs.map((z) => z.toFixed(3)).join(" ")}`);
  let spacingOk = true;
  for (let i = 1; i < zs.length; i++) {
    const g = zs[i] - zs[i - 1];
    if (i < zs.length - 1 ? Math.abs(g - sp) > 1e-6 : !(g <= sp + 1e-6 && g > ct)) spacingOk = false;
  }
  ok(`${B.id}: trusses at roof.spacingIn (${con.roof.spacingIn} in) on centre, the last gap no larger`, spacingOk, `centres ${zs.map((z) => z.toFixed(3)).join(" ")}`);
  const nSeg = plan.prof.length - 1;
  const rafter = String(con.roof.framing).toLowerCase() === "rafter";
  if (rafter) counts.rafterBuildings++;
  for (const z of zs) {
    const here = rf.filter((m) => Math.abs((m.z0 + m.z1) / 2 - z) < 1e-6);
    /* a chord on every slope, and each chord piece really lies under its slope */
    const segHit = new Set();
    here.filter((m) => m.kind === "top-chord").forEach((m) => {
      const c = m.poly.reduce((s, p) => s + p[0], 0) / m.poly.length;
      const i = m.seg, a = plan.prof[i], b = plan.prof[i + 1];
      if (a && b && c >= Math.min(a[0], b[0]) - 1.5 && c <= Math.max(a[0], b[0]) + 1.5) segHit.add(i);
    });
    ok(`${B.id}: every truss has a top chord on every slope`, segHit.size === nSeg, `truss at z ${z.toFixed(2)} has chords on ${segHit.size} of ${nSeg} slopes`);
    if (!rafter) {
      /* an END truss over openings that take its whole width (two doors on a
         barn end that rise into the gable) has its chord cut away entirely --
         allowed only when the cuts really cover everything a bottom chord
         would span there (read off a full truss's bottom chord) */
      let exempt = false;
      const endKey = here.length && here[0].end;
      if (endKey && !here.some((m) => m.kind === "bottom-chord")) {
        const full = rf.filter((m) => m.kind === "bottom-chord" && !m.end);
        const xa = Math.min(...full.flatMap((m) => m.poly.map((q) => q[0]))), xb = Math.max(...full.flatMap((m) => m.poly.map((q) => q[0])));
        const cuts = gableOpenings(plan, endKey).filter((o) => o.cutsChord).map((o) => [o.fx0, o.fx1]).sort((p, q) => p[0] - q[0]);
        let reach = xa;
        for (const [a, b] of cuts) { if (a > reach + 0.25) break; reach = Math.max(reach, b); }
        exempt = full.length > 0 && reach >= xb - 0.25;
        if (exempt) counts.chordless++;
      }
      ok(`${B.id}: every truss has a bottom chord (an end truss only loses it where gable openings take its whole width)`, exempt || here.some((m) => m.kind === "bottom-chord"), `truss at z ${z.toFixed(2)}`);
    }
  }

  /* 3b. every truss HEEL is a joint: a gusset plate covers the bottom
     chord's end where it meets the top chord (the bottom chord is cut back
     from the wall by the drawn roof -- nearly two feet on a lean-to -- and a
     plate that only covers the top chord's seat leaves the tie loose). Not on
     the end trusses (the gable framing fills them), not at a lean-to's or
     single slope's tall wall, and not on the trusses a dormer cuts (their
     heel is the dormer's front wall: see part-dormer-frame). */
  if (!rafter) {
    const layT = trussLayout(plan), secT = layT.sec;
    /* the trusses either side of a dormer (the trimmers) carry its upper
       header: they must stay whole -- as much web lumber as a plain truss */
    const plain = layT.trusses.find((tr) => !tr.end && !tr.cut && !tr.trim && !tr.loft);
    if (plain) {
      const area = (p) => { let a = 0; for (let i = 0; i < p.length; i++) { const u = p[i], v = p[(i + 1) % p.length]; a += u[0] * v[1] - v[0] * u[1]; } return Math.abs(a) / 2; };
      const webArea = (z) => rf.filter((m) => m.truss === z && m.kind === "web").reduce((a, m) => a + area(m.poly), 0);
      for (const tr of layT.trusses.filter((q) => q.trim && !q.end)) {
        counts.trimmers++;
        ok(`${B.id}: a dormer's trimmer trusses stay whole (as much web as a plain truss)`, Math.abs(webArea(tr.z) - webArea(plain.z)) < 1e-6, `trimmer at z ${tr.z.toFixed(2)}: ${webArea(tr.z).toFixed(3)} sq ft of web, a plain truss ${webArea(plain.z).toFixed(3)}`);
      }
    }
    for (const tr of layT.trusses) {
      if (tr.end || tr.cut) continue;
      const here = rf.filter((m) => m.truss === tr.z);
      const bcx = here.filter((m) => m.kind === "bottom-chord").flatMap((m) => m.poly.map((q) => q[0]));
      if (!bcx.length) continue;
      const gus = here.filter((m) => m.kind === "gusset").map((m) => { const xs = m.poly.map((q) => q[0]); return [Math.min(...xs), Math.max(...xs)]; });
      for (const [side, xe] of [["-x", Math.min(...bcx)], ["+x", Math.max(...bcx)]]) {
        if ((side === "-x" && secT.tallL) || (side === "+x" && secT.tallR)) continue;
        counts.heels++;
        ok(`${B.id}: every truss heel has a gusset plate over the bottom chord's end`, gus.some((g) => g[0] <= xe + 1e-6 && g[1] >= xe - 1e-6), `truss at z ${tr.z.toFixed(2)}, ${side} heel: bottom chord ends at x ${xe.toFixed(2)}, plates ${gus.map((g) => g.map((v) => v.toFixed(2)).join("..")).join(", ")}`);
      }
    }
  }

  /* 4. loft */
  const lf = byPart.loft;
  if (t.loft) {
    counts.lofts++;
    const ends = t.loft.ends || ["F", "B"];
    for (const e of ends) {
      const joists = lf.filter((m) => m.kind === "loft-joist" && m.end === e), deck = lf.filter((m) => m.kind === "loft-deck" && m.end === e);
      ok(`${B.id}: a loft floor at the ${e} end of a lofted style`, deck.length === 1 && joists.length > 0, `${joists.length} joists, ${deck.length} decks`);
      if (!deck.length) continue;
      const d0 = deck[0].z0, d1 = deck[0].z1;
      /* a SUPPORT is a loft joist or a truss bottom chord whose top really
         touches the floor's underside (a 2x4 chord under a floor laid on 2x6
         joists does not, and used to be counted anyway) */
      const deckBot = Math.min(...deck[0].poly.map((q) => q[1]));
      const touches = (m) => Math.abs(Math.max(...m.poly.map((q) => q[1])) - deckBot) < 0.01 && m.z1 > d0 - 0.2 && m.z0 < d1 + 0.2;
      const sup = joists.concat(rf.filter((m) => m.kind === "bottom-chord")).filter(touches).map((m) => [m.z0, m.z1]);
      const cs = sup.map((s) => (s[0] + s[1]) / 2).sort((a, b) => a - b);
      /* between the loft's own ends, no stretch without a support longer than
         the spacing -- measured centre to centre, and from each end of the
         floor to the support nearest it */
      let maxGap = cs.length ? Math.max(cs[0] - d0, d1 - cs[cs.length - 1]) : Infinity;
      for (let i = 1; i < cs.length; i++) maxGap = Math.max(maxGap, cs[i] - cs[i - 1]);
      const slack = 1e-6;
      ok(`${B.id}: loft floor carried by joists (or chords) touching it, no further apart than loft.spacingIn (${con.loft.spacingIn} in)`, cs.length >= 2 && maxGap <= con.loft.spacingIn / 12 + slack,
        `${e}: floor ${d0.toFixed(2)}..${d1.toFixed(2)}, supports touching it at ${cs.map((c) => c.toFixed(2)).join(" ")}`);
    }
  } else ok(`${B.id}: no loft framing on a style without a loft`, lf.length === 0, `${lf.length} loft boards`);

  /* 5. the roof deck */
  const rd = byPart["roof-deck"], dfDeck = byPart["dormer-frame"].filter((m) => m.kind === "purlin" || m.kind === "osb-sheet");
  const decks = rd.concat(dfDeck);
  const wantP = con.roofDeck.type === "purlins";
  if (wantP) counts.purlinBuildings++; else counts.osbBuildings++;
  ok(`${B.id}: purlins exactly when roofDeck.type is "purlins" (${con.roofDeck.type})`,
    wantP ? decks.every((m) => m.kind === "purlin") && decks.length > 0 : decks.every((m) => m.kind === "osb-sheet") && decks.length > 0,
    `kinds ${[...new Set(decks.map((m) => m.kind))].join(",")}`);
  if (!B.variant) ok(`${B.id}: by default purlins on a metal building and OSB otherwise`, wantP === !!t.metal);
  if (wantP) {
    /* along each slope (the main roof's), the gaps between neighbouring
       purlins, from the low end to the top: none wider than the spacing */
    const line = region.roof.line, segs = line.length - 1, pSp = con.roofDeck.purlins.spacingIn / 12;
    const pw = lumberFt(con.roofDeck.purlins.size).d;
    const W = plan.W, zd = 0.02 + lumberFt(con.walls.stud).d;
    /* a tall wall's framing rises to the roof line (a lean-to's or single
       slope's tall wall): a stretch of slope no purlin can lie on */
    const tall = [];
    if (plan.ws.L.top > plan.topY + 1e-9) tall.push([-W / 2, -W / 2 + zd]);
    if (plan.ws.R.top > plan.topY + 1e-9) tall.push([W / 2 - zd, W / 2]);
    /* the single slope's boxed eaves: their sloped soffit is the roof's own
       underside, so no tail fits under the deck there and the deck stops at
       the wall line (a design decision of parts/roof-frame.js) */
    if (plan.t.roof === "slope") { tall.push([line[0][0], -W / 2]); tall.push([W / 2, line[line.length - 1][0]]); }
    let bad = "";
    for (let i = 0; i < segs && !bad; i++) {
      const a = line[i], b = line[i + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const rising = b[1] >= a[1], lo = rising ? a : b, hi = rising ? b : a, cosx = Math.abs(b[0] - a[0]) / len;
      const sAt = (x) => Math.abs(x - lo[0]) / cosx;
      const dead = tall.map((z) => [sAt(z[0]), sAt(z[1])].sort((p, q) => p - q)).filter((iv) => iv[1] > 1e-9 && iv[0] < len - 1e-9);
      /* the ends of the slope: the roof's ends, or a tall wall or a
         deck-less eave that closes them (touching stretches taken as one) */
      dead.sort((p, q) => p[0] - q[0]);
      for (let k = 1; k < dead.length; k++) if (dead[k][0] <= dead[k - 1][1] + 1e-6) { dead[k - 1][1] = Math.max(dead[k - 1][1], dead[k][1]); dead.splice(k, 1); k--; }
      let sLo = 0, sHi = len;
      dead.forEach((iv) => { if (iv[1] >= len - 1e-6) sHi = Math.min(sHi, iv[0]); if (iv[0] <= 1e-6) sLo = Math.max(sLo, iv[1]); });
      const ps = rd.filter((m) => m.kind === "purlin" && m.seg === i);
      if (!ps.length) { bad = `slope ${i} has no purlins`; break; }
      const u = [...new Set(ps.map((m) => Math.round(m.at * 1e6) / 1e6))].sort((x, y) => x - y);
      if (Math.abs(u[0] - sLo) > 1e-6) bad = `slope ${i}: the lowest purlin is not flush at the low end (${u[0].toFixed(3)}, the low end is ${sLo.toFixed(3)})`;
      else if (Math.abs(u[u.length - 1] + pw - sHi) > 1e-6) bad = `slope ${i}: the top purlin ends at ${(u[u.length - 1] + pw).toFixed(3)}, the top of the slope is ${sHi.toFixed(3)}`;
      for (let k = 1; k < u.length && !bad; k++) {
        const gap = u[k] - u[k - 1];
        const across = dead.find((iv) => u[k - 1] + pw <= iv[0] + 1e-6 && u[k] >= iv[1] - 1e-6);
        const allowed = across ? Math.max(pSp, across[1] - across[0] + 2 * pw + 0.02) : pSp;
        if (gap > allowed + 1e-6) bad = `slope ${i}: ${gap.toFixed(3)} ft between purlins at ${u[k - 1].toFixed(3)} and ${u[k].toFixed(3)}`;
      }
    }
    ok(`${B.id}: purlins flush at the eave and at the top of each slope, no further apart than roofDeck.purlins.spacingIn (except across a tall wall)`, !bad, bad);
  }

  /* 6. dormer */
  const df = byPart["dormer-frame"];
  const drawn = !!(t.dormer && plan.state.dormer !== "none");
  if (drawn) counts.dormers++;
  ok(`${B.id}: dormer framing exactly when a dormer is drawn`, drawn ? df.some((m) => m.kind === "dormer-header") && df.some((m) => m.kind === "dormer-rafter") : df.length === 0,
    `${df.length} dormer boards, dormer ${plan.state.dormer}`);

  /* 7. gable openings */
  const gf = byPart["gable-frame"];
  /* the underside of the end truss's top chords, worked out from the roof
     as DRAWN (every roof here is concave: the lowest of the offset lines) */
  const lineD = region.roof.line, chordD = region.deckT + lumberFt(con.roof.chord).d;
  const chordUnder = (x) => {
    let m = Infinity;
    for (let i = 0; i + 1 < lineD.length; i++) {
      const a = lineD[i], c = lineD[i + 1];
      if (Math.abs(c[0] - a[0]) < 1e-9) continue;
      const sl = (c[1] - a[1]) / (c[0] - a[0]);
      m = Math.min(m, a[1] + sl * (x - a[0]) - chordD * Math.sqrt(1 + sl * sl));
    }
    return m;
  };
  const stT = lumberFt(con.walls.stud).t;
  for (const end of ["F", "B"]) {
    for (const o of gableOpenings(plan, end)) {
      counts.openings++;
      const on = end + ":" + o.what;
      const ms = gf.filter((m) => m.opening && m.end === end && m.opening === o.what && Math.abs(m.openingAt - o.x0) < 1e-9);
      const kings = ms.filter((m) => m.kind === "king"), jacks = ms.filter((m) => m.kind === "jack").length, headers = ms.filter((m) => m.kind === "header").length;
      /* a king each side -- or, on a window run up into the top chord near an
         eave, the chord itself closing that side (no room for a king there) */
      for (const [side, x] of [["left", o.fx0 + stT / 2], ["right", o.fx1 - stT / 2]]) {
        const has = kings.some((m) => { const xs = m.poly.map((q) => q[0]); return Math.abs((Math.min(...xs) + Math.max(...xs)) / 2 - x) < 0.01; });
        const closed = chordUnder(x) <= o.base + 0.06;
        if (closed && !has) counts.chordClosed++;
        ok(`${B.id}: every framed gable opening has a king stud each side (or the top chord closing that side)`, has || closed, `${on} ${side}: no king at x ${x.toFixed(2)} and ${(chordUnder(x) - o.base).toFixed(2)} ft of room under the chord`);
      }
      ok(`${B.id}: every framed gable opening has a header on two jacks, or the chord over it`, (headers === 1 && jacks === 2) || (headers === 0 && jacks === 0), `${on}: ${headers} headers, ${jacks} jacks`);
      /* a header wherever even a flat 2x fits between the opening's top and
         the chord (the wall framing's rule, parts/wall-frame.js fitHeader) */
      const room = Math.min(chordUnder(o.x0 - stT), chordUnder(o.x1 + stT)) - o.y1;
      ok(`${B.id}: a gable opening with room for a header under the top chord has one`, room < stT + 0.002 || headers === 1, `${on}: ${room.toFixed(3)} ft of room over it, ${headers} headers`);
      if (headers) counts.gableHeaders++;
    }
  }
  /* the gable studs stand over the end wall's own studs: on its layout
     marks (parts/wall-frame.js, from its run's start), or tight in a corner */
  const runs = wallRuns(plan), gsp = con.walls.spacingIn / 12, secG = roofSection(plan);
  for (const end of ["F", "B"]) {
    const w = plan.ws[end], run = runs.find((r) => r.key === end);
    const uo = run ? run.a : -w.len / 2;
    const studs = gf.filter((m) => m.end === end && m.kind === "gable-stud");
    const off = studs.filter((m) => {
      /* the stud's centre line: a stud cut off under a steep chord can be a
         triangle narrower than the stud, so take it from its uncut side */
      const xs = m.poly.map((q) => q[0]), x0 = Math.min(...xs), x1 = Math.max(...xs);
      const x = x1 - x0 > stT - 1e-6 ? (x0 + x1) / 2 : xs.filter((v) => Math.abs(v - x0) < 1e-7).length >= 2 ? x0 + stT / 2 : x1 - stT / 2;
      if (Math.abs(x0 - secG.innerL) < 1e-3 || Math.abs(x1 - secG.innerR) < 1e-3) return false;   /* tight in a corner */
      const u = (x - (w.cx || 0)) / w.ax[0], k = (u - uo) / gsp;
      return Math.abs(k - Math.round(k)) * gsp > 0.005;
    });
    counts.gableStuds += studs.length;
    ok(`${B.id}: gable studs stand on the ${end} wall's stud layout (over its studs)`, off.length === 0, `${off.length} of ${studs.length} off the marks`);
  }
  /* no gable stud or end chord crosses a gable window's clear opening */
  for (const it of plan.state.items || []) {
    const c = plan.CAT[it.cat];
    if (!c || !c.gable || c.draw === "faux-loft" || (it.wall !== "F" && it.wall !== "B")) continue;
    const r = openingRect(it, plan);
    if (!r || r.plane !== "gable" || !r.clearX) continue;
    const zIn = r.end === "F" ? plan.L / 2 - 0.5 : -plan.L / 2 + 0.5;
    const hole = { poly: [[r.clearX.x0, r.clear.y0], [r.clearX.x1, r.clear.y0], [r.clearX.x1, r.clear.y1], [r.clearX.x0, r.clear.y1]], z0: Math.min(zIn, r.z), z1: Math.max(zIn, r.z) };
    hole.axes = axesOf(hole.poly);
    const inside = all.filter((m) => m.part === "gable-frame" || (m.part === "roof-frame" && m.end && m.kind !== "top-chord")).filter((m) => { m.axes = m.axes || axesOf(m.poly); return penetration(m, hole) > OVERLAP; });
    ok(`${B.id}: nothing framed across a gable window's clear opening`, inside.length === 0, `${it.cat} on ${it.wall}: ${inside.slice(0, 2).map(describe).join("; ")}`);
  }

  /* 8. the drawing is the members; 9. finished untouched */
  if (B.full) {
    const build = res.build;
    const tri = {}, corners = {}, badStage = {};
    for (const P of MY_PARTS) { tri[P.id] = 0; corners[P.id] = []; badStage[P.id] = 0; }
    for (const key of build.ORDER) {
      const b = build.buckets[key];
      for (const s of build.tags[key] || []) {
        if (!(s.part in tri)) continue;
        const P = MY_PARTS.find((q) => q.id === s.part);
        for (let tt = s.from; tt < s.from + s.count; tt++) {
          tri[s.part]++;
          for (let k = 0; k < 3; k++) {
            const o = tt * 27 + k * 9;
            corners[s.part].push([b.v[o], b.v[o + 1], b.v[o + 2]]);
            if (!P.stages.includes(STAGES[b.v[o + 8]].key)) badStage[s.part]++;
          }
        }
      }
    }
    for (const P of MY_PARTS) {
      const list = byPart[P.id];
      const want = list.reduce((s, m) => s + 4 * m.poly.length - 4, 0);
      ok(`${B.id}: ${P.id} draws exactly its boards (${want} triangles)`, tri[P.id] === want, `drew ${tri[P.id]}`);
      const keys = new Set();
      list.forEach((m) => m.poly.forEach((q) => { keys.add(key3(q[0], q[1], m.z0)); keys.add(key3(q[0], q[1], m.z1)); }));
      const stray = corners[P.id].filter((p) => !keys.has(key3(p[0], p[1], p[2])));
      ok(`${B.id}: every corner ${P.id} draws is a corner of one of its boards`, stray.length === 0, `${stray.length} stray, e.g. ${JSON.stringify(stray[0])}`);
      ok(`${B.id}: ${P.id} draws only in its own building step(s) (${P.stages.join(", ")})`, badStage[P.id] === 0, `${badStage[P.id]} corners in another step`);
      counts.drawnChecked++;
    }
    /* 9 */
    const plain = assemble(plan, { viewport: { w: 742, h: 803 }, fit: "barnwright", frames: false }).build;
    let same = true, why = "";
    for (let i = 0; i < plain.ORDER.length && same; i++) if (build.ORDER[i] !== plain.ORDER[i]) { same = false; why = `material ${i} is ${build.ORDER[i]} with framing, ${plain.ORDER[i]} without`; }
    for (const key of plain.ORDER) {
      if (!same) break;
      const a = finishedFloats(plain.buckets[key]), b = finishedFloats(build.buckets[key]);
      if (a.length !== b.length) { same = false; why = `${key}: ${a.length / 27} finished triangles without framing, ${b.length / 27} with`; break; }
      for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) { same = false; why = `${key}: triangle ${Math.floor(i / 27)} differs`; break; }
    }
    ok(`${B.id}: frames:true leaves every finished triangle untouched`, same, why);
    counts.finishedChecked++;
  }

  /* other finished framing parts: a corner of theirs buried in a roof board? */
  if (otherFrameParts.length) {
    const mine = all.map((m) => { m.axes = m.axes || axesOf(m.poly); return m; });
    for (const en of otherFrameParts) {
      const pts = [];
      for (const key of res.build.ORDER) {
        const b = res.build.buckets[key];
        for (const s of res.build.tags[key] || []) if (s.part === en.entry) for (let tt = s.from; tt < s.from + s.count; tt++) for (let k = 0; k < 3; k++) { const o = tt * 27 + k * 9; pts.push([b.v[o], b.v[o + 1], b.v[o + 2]]); }
      }
      let buried = 0, eg = null;
      for (const p of pts) {
        for (const m of mine) {
          if (p[2] <= m.z0 + OVERLAP || p[2] >= m.z1 - OVERLAP) continue;
          if (p[0] <= m.bb.x0 + OVERLAP || p[0] >= m.bb.x1 - OVERLAP || p[1] <= m.bb.y0 + OVERLAP || p[1] >= m.bb.y1 - OVERLAP) continue;
          let inside = true;
          for (let i = 0; i < m.poly.length && inside; i++) {
            const a = m.poly[i], c = m.poly[(i + 1) % m.poly.length];
            const cr = (c[0] - a[0]) * (p[1] - a[1]) - (c[1] - a[1]) * (p[0] - a[0]);
            if (cr / Math.hypot(c[0] - a[0], c[1] - a[1]) < OVERLAP) inside = false;
          }
          if (inside) { buried++; eg = eg || `${en.entry} corner (${p.map((v) => v.toFixed(2)).join(", ")}) inside ${describe(m)}`; break; }
        }
      }
      if (buried) warnings.push(`${B.id}: ${buried} corner(s) of ${en.entry} lie inside roof framing boards, e.g. ${eg}`);
    }
  }
}

function key3(x, y, z) { return Math.round(x * 1e5) + "," + Math.round(y * 1e5) + "," + Math.round(z * 1e5); }
function finishedFloats(b) {
  const out = [];
  if (!b) return out;
  for (let i = 0; i < b.n; i++) {
    const o = i * 9;
    if (!FINISHED_STAGE_IDS.has(b.v[o + 8])) continue;
    for (let k = 0; k < 9; k++) out.push(b.v[o + k]);
  }
  return out;
}

/* ======================= report ======================= */

if (warnings.length) {
  console.log(`WARNING (not a failure of these parts): ${warnings.length} building(s) where another framing part's corners sit inside roof framing:`);
  warnings.slice(0, 8).forEach((w) => console.log("  - " + w));
}
if (fail) {
  console.log(`FAIL: ${fail} of ${pass + fail} roof framing checks failed:`);
  for (const f of failures.slice(0, 60)) console.log("  - " + f);
  process.exitCode = 1;
} else {
  console.log(`PROVED (${pass} checks) on ${counts.buildings} buildings (the 148 recorded ones, every style at every size it is sold in, the Dormer Shed with each dormer, ${VARIANTS.length} construction changes on every style, gable windows dragged to both eaves and the top and bottom of every gable, and two openings on a barn end), ${counts.members} boards and sheets:`);
  console.log(`  1. all ${counts.corners} board corners are inside the roof as drawn: under the roof slab's underside (read off the finished drawing), above the wall top inside the walls, not past the eave's tip or below its drawn bottom edge, only deck out over the gable-end overhangs, and the dormer's framing inside the dormer as drawn.`);
  console.log(`  2. no two boards of the five roof framing parts overlap by more than ${OVERLAP} ft (exact penetration depth).`);
  console.log(`  3. trusses (or rafter pairs; ${counts.rafterBuildings} rafter-framed buildings) stand at roof.spacingIn on centre with the last gap no larger, one at each gable end, each with a top chord on every slope and (trusses) a bottom chord (${counts.chordless} end truss(es) whose chord gable openings take entirely), and a gusset plate over the bottom chord's end at all ${counts.heels} truss heels.`);
  console.log(`  4. loft framing on the ${counts.lofts} lofted buildings only, at each loft end, the floor carried by joists (or truss chords) that really touch its underside, no further apart than loft.spacingIn.`);
  console.log(`  5. purlins exactly where roofDeck.type says (${counts.purlinBuildings} buildings; by default only the metal ones), OSB elsewhere (${counts.osbBuildings}), purlins within their spacing up every slope.`);
  console.log(`  6. dormer framing exactly when a dormer is drawn (${counts.dormers} buildings), clear of the main roof's trusses and deck, and the ${counts.trimmers} trimmer trusses either side of a dormer whole.`);
  console.log(`  7. ${counts.openings} framed gable openings each with a king each side (${counts.chordClosed} sides closed by the top chord near an eave) and a header on jacks wherever even a flat 2x fits under the chord (${counts.gableHeaders} headers), else the chord over it; nothing framed across a gable window; ${counts.gableStuds} gable studs all on their end wall's stud layout.`);
  console.log(`  8. in assemble(frames:true) each part draws exactly its boards, every corner, in its own step (${counts.drawnChecked} part drawings checked).`);
  console.log(`  9. frames:true leaves every finished triangle, material and draw order untouched (${counts.finishedChecked} buildings).`);
}
