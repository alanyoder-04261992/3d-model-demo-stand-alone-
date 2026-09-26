/* PROVE THE MODEL'S RULES ARE BARNWRIGHT'S RULES, number for number.

   node tools/check-model-live.mjs

   Opens Barnwright's untouched 3D designer in a headless browser (read only;
   see tools/lib/barnwright-page.mjs), builds a company that sells exactly what
   Barnwright sells at Barnwright's prices (tools/lib/barnwright-company.mjs),
   and asks both the same questions:

   1. the tables: prices, styles, categories, items, options and colours read
      live from the page equal the resolved catalogue; the design a new
      visitor starts on is the same;
   2. for EVERY style at EVERY size (and 2b, the rake overhang buildShed hands
      profileRoof, per style): the size (dims), the side-porch span, every
      wall (wallDefs), the roof line (roofProfile), the ridge height (roofRise),
      the standard doors and windows after clamping (resetItems), and the
      gable band with and without gable windows;
   3. the side porch flipped, centred and at 8 and 12 ft, on every porch-S size;
   4. clampPos with items thrown to random places (and added doors, windows,
      lights, benches, shelves, outlets, gable windows, turned transoms),
      clamped in order -- plus neighborGaps, snapCenter and freeSpot;
   4b. clampPos on CROWDED walls: three to seven openings thrown onto one wall
      of every building, which is what makes the settling loop take a third
      pass (the random round above never needs more than two);
   5. the electrical package fixtures (packages 1-3, with and without the
      exterior light);
   6. priceParts for the standard design of every size and a sample of option
      combinations (dormers, packages with the light, ramps, every per-square-
      foot upgrade, double windows, shutters, door windows, swapped included
      items, benches and shelves by the foot, company extras of every kind);
   6b. the per-square-foot button labels Barnwright's page shows (updateOpts)
      equal our ONE sqftCharge for every style and size, and money() writes
      amounts the way the page does;
   6c. the roof helpers: profileYat along every roof, the cottage eave, and
      gableClip cutting shapes at every roof line; pSizes, pPrice, minPrice;
   7. openingRect against the trim renderItem ACTUALLY DRAWS: during a real
      buildShed in Barnwright's page, pushTri is wrapped and every triangle
      that goes into the "trim" material while CURIT names an item is kept; the
      edges of those triangles, turned back into that item's wall coordinates,
      must equal openingRect's u0 u1 y0 y1 (to a billionth of a foot). And the
      PIECES, not just the outer box: every edge openingRect reports for the
      side casings, the head board, the sill and the porch band must be a
      coordinate the trim was drawn at (the head's ears always reach past the
      sill's, so the outer box alone never sees the sill); a gable window's
      centre, its opening and its trim must all be in one set of coordinates
      (one is placed off-centre on the back gable, where world x and the wall's
      own u run opposite ways).

   Exact means exact: numbers are compared with ===, not a tolerance, except
   step 7, where the drawn triangles are turned back from world coordinates. */

import { openBarnwright } from "./lib/barnwright-page.mjs";
import { barnwrightCatalogue, barnwrightCompany, golden } from "./lib/barnwright-company.mjs";
import { readJSON, readManufacturer } from "./lib/load.mjs";
import { resolve } from "../model/company.js";
import { frameOf } from "../model/frame.js";
import { roofRise, roofShape, gableBandY, profileYat, cottageEave, gableClip, ROOF_TH } from "../model/roof-shapes.js";
import { resetItems, clampPos, neighborGaps, snapCenter, freeSpot, pkFixtures, openingRect } from "../model/layout.js";
import { itemW } from "../model/layout.js";

/* Barnwright's neighborGaps and snapCenter (3ddesign.html 2401-2428), copied
   verbatim except that widths come from itemW -- the one deliberate
   difference (a double window is two windows and a middle board wide). */
let DBLWALLS = 0;
function refGaps(it, st, fr, CAT) {
  var c = CAT[it.cat];
  if (it.rot && c.draw === "transom") c = { k: c.k, w: c.h, h: c.w };
  if (c.gable || c.free || c.stretch || c.k === "post") return null;
  var w = fr.ws[it.wall]; if (!w) return null;
  var cw = itemW(it, CAT);
  var half = w.len / 2, lo = -half, hi = half;
  st.items.forEach(function (o) {
    if (o.id === it.id || o.wall !== it.wall) return;
    var oc = CAT[o.cat];
    if (oc.gable || oc.k === "post" || oc.k === "light" || oc.k === "out" || oc.k === "ilt" || oc.free || oc.stretch) return;
    var ow = itemW(o, CAT);
    if (o.pos <= it.pos) lo = Math.max(lo, o.pos + ow / 2);
    else hi = Math.min(hi, o.pos - ow / 2);
  });
  return { lo: lo, hi: hi, cw: cw, gL: it.pos - cw / 2 - lo, gR: hi - (it.pos + cw / 2) };
}
function refSnap(it, st, fr, CAT) {
  var g = refGaps(it, st, fr, CAT); if (!g) return null;
  var mid = (g.lo + g.hi) / 2;
  if (g.hi - g.lo > g.cw + 0.2 && Math.abs(it.pos - mid) < 0.22) { it.pos = mid; g.centered = true; }
  else g.centered = Math.abs(g.gL - g.gR) < 0.045;
  g.gL = Math.max(0, it.pos - g.cw / 2 - g.lo); g.gR = Math.max(0, g.hi - (it.pos + g.cw / 2));
  return g;
}
import { priceParts, pSizes, minPrice, pPrice, money, rateCharges } from "../model/pricing.js";
import { defaults } from "../model/design.js";
import { makePlan } from "../model/plan.js";
import { mulberry32 } from "../engine/seeded.js";

const t0 = Date.now();
const counts = {};
const failures = [];
function tally(group, ok, msg) {
  counts[group] = counts[group] || { pass: 0, fail: 0 };
  if (ok) counts[group].pass++;
  else { counts[group].fail++; if (failures.length < 40) failures.push(`[${group}] ${msg}`); }
}
function eq(a, b) {
  if (a === b) return true;
  if (typeof a === "number" && typeof b === "number") return a === b;
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a).filter((k) => a[k] !== undefined), kb = Object.keys(b).filter((k) => b[k] !== undefined);
  if (ka.length !== kb.length) return false;
  for (const k of ka) if (!eq(a[k], b[k])) return false;
  return true;
}
function firstDiff(a, b, path = "") {
  if (eq(a, b)) return null;
  if (a && b && typeof a === "object" && typeof b === "object") {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) { const d = firstDiff(a[k], b[k], path + "." + k); if (d) return d; }
  }
  return `${path || "(value)"}: ours ${JSON.stringify(a)} vs Barnwright ${JSON.stringify(b)}`;
}
function same(group, label, ours, theirs) {
  const ok = eq(ours, theirs);
  tally(group, ok, ok ? "" : `${label}: ${firstDiff(ours, theirs)}`);
  return ok;
}
const copy = (v) => JSON.parse(JSON.stringify(v));

const G = golden();
const cat = barnwrightCatalogue();
const bw = await openBarnwright();

try {
  /* ---------------------------------------------------------------- 0 */
  if (bw.sha256 !== G.sha256) {
    tally("pinned file", false, `Barnwright's 3ddesign.html has changed since test/golden/barnwright-catalogue.json was recorded (now ${bw.sha256}, recorded ${G.sha256}). Re-run tools/extract-barnwright-catalogue.mjs on purpose.`);
  } else tally("pinned file", true);

  /* ---------------------------------------------------------------- 1 tables */
  const live = await bw.evaluate(() => JSON.parse(JSON.stringify({ P, TYPES, CATS, CAT, COLORS, DORMERS, RAMPS, ELECPK, MISC, RATES, OPTX, ELECDESC, state })));
  same("tables", "P", cat.P, live.P);
  same("tables", "CATS", cat.CATS, live.CATS);
  for (const k of Object.keys(live.TYPES)) {
    const ours = {}; for (const f of Object.keys(live.TYPES[k])) ours[f] = cat.TYPES[k] ? cat.TYPES[k][f] : undefined;
    same("tables", "TYPES." + k, ours, live.TYPES[k]);
  }
  same("tables", "TYPES keys", Object.keys(cat.TYPES), Object.keys(live.TYPES));
  for (const k of Object.keys(live.CAT)) {
    const ours = {}; for (const f of Object.keys(live.CAT[k])) ours[f] = cat.CAT[k] ? cat.CAT[k][f] : undefined;
    same("tables", "CAT." + k, ours, live.CAT[k]);
    /* and no Barnwright flag set on our side that Barnwright does not have */
    const extra = ["gable", "int", "stretch", "free", "perFt", "dep", "sill"].filter((f) => cat.CAT[k] && cat.CAT[k][f] !== undefined && live.CAT[k][f] === undefined);
    tally("tables", extra.length === 0, `CAT.${k} has flags Barnwright does not: ${extra.join(", ")}`);
  }
  same("tables", "CAT keys", Object.keys(cat.CAT), Object.keys(live.CAT));
  for (const k of ["COLORS", "DORMERS", "RAMPS", "ELECPK", "MISC", "RATES", "OPTX", "ELECDESC"]) same("tables", k, copy(cat[k]), live[k]);
  same("tables", "the design a new visitor starts on", defaults(cat), live.state);
  same("tables", "golden file equals the live page", { P: G.P, TYPES: G.TYPES, CAT: G.CAT, COLORS: G.COLORS }, { P: live.P, TYPES: live.TYPES, CAT: live.CAT, COLORS: live.COLORS });

  const ALL = [];
  for (const t of Object.keys(cat.P)) for (const z of Object.keys(cat.P[t])) ALL.push([t, z]);

  /* ---------------------------------------------------------------- 2 every style x size */
  function freshState(t, z, extra) {
    return Object.assign({ type: t, size: z, body: "#FAF9F3", trim: "#2E3134", roof: "#2E3134", items: [], dormer: "9", pLen: 12, pFlip: false, pMid: false,
      doorC: "", shutC: "", sel: null, seq: 0, opts: { dbl: false, jo12: false, mbF: false, mbW: false, rbS: false, rbR: false }, xopt: {}, elec: { pkg: 0, ext: false }, ramp: "none" }, extra || {});
  }
  const pageFrames = await bw.evaluate((cases) => cases.map(([t, z, ex]) => {
    Object.assign(state, { type: t, size: z, pLen: 12, pFlip: false, pMid: false, items: [], sel: null, seq: 0 }, ex || {});
    const d = dims(), topY = y0 + TYPES[t].wallH;
    const out = { dims: d, span: pSpan(), ws: wallDefs(), prof: roofProfile(d.W, topY), rise: roofRise(d.W) };
    resetItems();
    out.items = JSON.parse(JSON.stringify(state.items)); out.seq = state.seq; out.sel = state.sel;
    out.bandF = gableBandY("F"); out.bandB = gableBandY("B");
    /* a gable window on F, then one on B, then none, then one on R */
    const keep = state.items;
    state.items = keep.filter((i) => !CAT[i.cat].gable).concat([{ id: "g1", cat: "g1824", wall: "F", pos: 0, inc: false }]);
    out.gF = [gableBandY("F"), gableBandY("B")];
    state.items = keep.filter((i) => !CAT[i.cat].gable).concat([{ id: "g2", cat: "oct", wall: "B", pos: 0, inc: false }]);
    out.gB = [gableBandY("F"), gableBandY("B")];
    state.items = keep.filter((i) => !CAT[i.cat].gable);
    out.g0 = [gableBandY("F"), gableBandY("B")];
    state.items = keep.filter((i) => !CAT[i.cat].gable).concat([{ id: "g3", cat: "fake", wall: "R", pos: 0, inc: false }]);
    out.gR = [gableBandY("F"), gableBandY("B")];
    state.items = keep;
    return out;
  }), ALL);
  ALL.forEach(([t, z], i) => {
    const b = pageFrames[i], label = `${t} ${z}`;
    const s = freshState(t, z);
    const fr = frameOf(s, cat);
    same("frame (dims, span, walls, roof)", label + " dims", fr.d, b.dims);
    same("frame (dims, span, walls, roof)", label + " pSpan", fr.span, b.span);
    same("frame (dims, span, walls, roof)", label + " wallDefs", fr.ws, b.ws);
    same("frame (dims, span, walls, roof)", label + " roofProfile", fr.prof, b.prof);
    same("frame (dims, span, walls, roof)", label + " roofRise", roofRise(fr.d.W, fr.t, fr.construction), b.rise);
    resetItems(s, fr, cat);
    same("resetItems (standard doors and windows, clamped)", label, { items: s.items, seq: s.seq, sel: s.sel }, { items: b.items, seq: b.seq, sel: b.sel });
    const band = (items) => [gableBandY("F", fr, items), gableBandY("B", fr, items)];
    const noG = s.items.filter((it) => !cat.CAT[it.cat].gable);
    same("gableBandY", label + " standard", band(s.items), [b.bandF, b.bandB]);
    same("gableBandY", label + " + gable window on F", band(noG.concat([{ id: "g1", cat: "g1824", wall: "F", pos: 0 }])), b.gF);
    same("gableBandY", label + " + gable window on B", band(noG.concat([{ id: "g2", cat: "oct", wall: "B", pos: 0 }])), b.gB);
    same("gableBandY", label + " no gable windows", band(noG), b.g0);
    same("gableBandY", label + " + gable window on R", band(noG.concat([{ id: "g3", cat: "fake", wall: "R", pos: 0 }])), b.gR);
  });

  /* ---------------------------------------------------------------- 2b rake overhang */
  /* The gable-end overhang is a style trait here (GU, CS and MCS are 0.03) and
     a roof-shape setting otherwise. Barnwright decides it inline in buildShed
     and hands it to profileRoof, its only call: wrap profileRoof and read it. */
  const RAKE = Object.keys(cat.P).map((t) => [t, Object.keys(cat.P[t])[0]]);
  const pageRake = await bw.evaluate((cases) => cases.map(([t, z]) => {
    Object.assign(state, { type: t, size: z, pLen: 12, pFlip: false, pMid: false, items: [], sel: null, seq: 0, elec: { pkg: 0, ext: false } });
    resetItems();
    const got = [], orig = window.profileRoof;
    window.profileRoof = function (prof, L, ov, W) { got.push(ov); return orig.apply(this, arguments); };
    try { buildShed(); } finally { window.profileRoof = orig; }
    return got;
  }), RAKE);
  RAKE.forEach(([t, z], i) => {
    const fr = frameOf(freshState(t, z), cat);
    same("rake overhang (what buildShed hands profileRoof)", t, [roofShape(fr.t, fr.construction).rakeOverhang], pageRake[i]);
  });

  /* ---------------------------------------------------------------- 3 porch variants */
  const VARIANTS = [{ pLen: 8 }, { pLen: 12, pFlip: true }, { pLen: 8, pFlip: true }, { pMid: true }, { pLen: 8, pMid: true }];
  const PORCH = [];
  for (const [t, z] of ALL) if (cat.TYPES[t].porch) for (const v of VARIANTS) PORCH.push([t, z, v]);
  const pagePorch = await bw.evaluate((cases) => cases.map(([t, z, ex]) => {
    Object.assign(state, { type: t, size: z, pLen: 12, pFlip: false, pMid: false, items: [], sel: null, seq: 0 }, ex);
    const d = dims();
    const out = { span: pSpan(), ws: wallDefs() };
    resetItems(); out.items = JSON.parse(JSON.stringify(state.items));
    return out;
  }), PORCH);
  PORCH.forEach(([t, z, v], i) => {
    const b = pagePorch[i], label = `${t} ${z} ${JSON.stringify(v)}`;
    const s = freshState(t, z, v);
    const fr = frameOf(s, cat);
    same("porch variants (pFlip, pMid, pLen 8/12)", label + " pSpan", fr.span, b.span);
    same("porch variants (pFlip, pMid, pLen 8/12)", label + " wallDefs", fr.ws, b.ws);
    resetItems(s, fr, cat);
    same("porch variants (pFlip, pMid, pLen 8/12)", label + " resetItems", s.items, b.items);
  });

  /* ---------------------------------------------------------------- 4 clampPos fuzz */
  const rnd = mulberry32(20260926);
  const EXTRA = [["w33", "L"], ["ru6", "B"], ["light", "R"], ["bench", "IN"], ["shelf", "IN"], ["outlet", "L"], ["ilight", "IN"],
    ["g1824", "R"], ["tr", "L"], ["w23", "B"], ["w36", "F"], ["oct", "F"], ["ppost", "F"]];
  const FUZZ = [];
  for (const [t, z] of ALL) {
    for (let round = 0; round < 2; round++) {
      const s = freshState(t, z, cat.TYPES[t].porch === "S" ? { pFlip: rnd() < 0.5, pMid: rnd() < 0.3 } : {});
      const fr = frameOf(s, cat);
      resetItems(s, fr, cat);
      let n = 0;
      for (const [c, w] of EXTRA) {
        if (!fr.ws[w] && w !== "IN") continue;
        const it = { id: "x" + (n++), cat: c, wall: w, pos: 0, inc: false, shut: false };
        if (c === "bench" || c === "shelf") { it.ln = Math.round(rnd() * 30); it.rot = rnd() < 0.5; }
        if (c === "tr") it.rot = rnd() < 0.5;
        if (c === "w23") it.dbl = true;
        s.items.push(it);
      }
      for (const it of s.items) {
        it.pos = (rnd() * 2 - 1) * fr.d.L;
        if (cat.CAT[it.cat].gable || it.cat === "light") it.vy = (rnd() * 2 - 1) * 5;
        if (cat.CAT[it.cat].free || cat.CAT[it.cat].stretch) { it.px = (rnd() * 2 - 1) * fr.d.W; it.pz = (rnd() * 2 - 1) * fr.d.L; }
      }
      FUZZ.push(s);
    }
  }
  const pageFuzz = await bw.evaluate((states) => states.map((s) => {
    Object.assign(state, JSON.parse(JSON.stringify(s)));
    state.items.forEach(clampPos);
    const after = JSON.parse(JSON.stringify(state.items));
    const gaps = state.items.map((it) => neighborGaps(it));
    const snaps = state.items.map((it) => { const g = snapCenter(it); return [g, it.pos]; });
    const spots = ["F", "B", "R", "L"].map((w) => [freeSpot(w, 2.1), freeSpot(w, 4.021), freeSpot(w, 8)]);
    return { after, gaps, snaps, spots };
  }), FUZZ);
  FUZZ.forEach((s0, i) => {
    const b = pageFuzz[i], label = `${s0.type} ${s0.size} round ${i % 2 + 1}`;
    const s = copy(s0);
    const fr = frameOf(s, cat);
    s.items.forEach((it) => clampPos(it, s, fr));
    same("clampPos (random positions, added items)", label, s.items, b.after);
    /* Gaps and the snap to the middle: Barnwright's numbers, except on a wall
       carrying a DOUBLE window, where Barnwright measured the double as a
       single (docs/DIFFERENCES.md). There the expected value is Barnwright's
       own sequence re-run with itemW -- refGaps/refSnap below, a verbatim
       copy of his neighborGaps/snapCenter with that one change. */
    const dblWall = (it) => s.items.some((o) => o.wall === it.wall && o.dbl && cat.CAT[o.cat].k === "win" && !cat.CAT[o.cat].gable);
    const r = copy(s);
    const gapsRef = r.items.map((it) => refGaps(it, r, fr, cat.CAT));
    const snapsRef = r.items.map((it) => { const g = refSnap(it, r, fr, cat.CAT); return [g, it.pos]; });
    const gapsOurs = s.items.map((it) => neighborGaps(it, s, fr));
    s.items.forEach((it, j) => {
      const dbl = dblWall(it);
      if (dbl) DBLWALLS++;
      same(dbl ? "neighborGaps (double window on the wall: measured with itemW)" : "neighborGaps", label, gapsOurs[j], dbl ? gapsRef[j] : b.gaps[j]);
    });
    const snapsOurs = s.items.map((it) => { const g = snapCenter(it, s, fr); return [g, it.pos]; });
    s.items.forEach((it, j) => {
      const dbl = dblWall(it);
      same(dbl ? "snapCenter (double window on the wall: measured with itemW)" : "snapCenter", label, snapsOurs[j], dbl ? snapsRef[j] : b.snaps[j]);
    });
    same("freeSpot", label, ["F", "B", "R", "L"].map((w) => [freeSpot(w, 2.1, s, fr), freeSpot(w, 4.021, s, fr), freeSpot(w, 8, s, fr)]), b.spots);
  });

  /* ---------------------------------------------------------------- 4b crowded walls */
  const rnd2 = mulberry32(99);
  const CROWD_CATS = ["w23", "w33", "w36", "w48", "d36in", "ru6", "tr", "dfr"];
  const CROWD = [];
  for (const [t, z] of ALL) for (let r = 0; r < 6; r++) {
    const s = freshState(t, z);
    const fr = frameOf(s, cat);
    resetItems(s, fr, cat);
    const wall = ["F", "B", "R", "L"][Math.floor(rnd2() * 4)];
    const k = 3 + Math.floor(rnd2() * 5);
    for (let i = 0; i < k; i++) s.items.push({ id: "c" + i, cat: CROWD_CATS[Math.floor(rnd2() * CROWD_CATS.length)], wall, pos: (rnd2() * 2 - 1) * fr.ws[wall].len / 2, inc: false, shut: false, dbl: rnd2() < 0.3 });
    CROWD.push(s);
  }
  const pageCrowd = await bw.evaluate((states) => states.map((s) => {
    Object.assign(state, JSON.parse(JSON.stringify(s)));
    state.items.forEach(clampPos);
    return JSON.parse(JSON.stringify(state.items));
  }), CROWD);
  CROWD.forEach((s0, i) => {
    const s = copy(s0), fr = frameOf(s, cat);
    s.items.forEach((it) => clampPos(it, s, fr));
    same("clampPos on crowded walls (up to seven openings on one wall)", `${s0.type} ${s0.size} wall ${s0.items[s0.items.length - 1].wall} #${i % 6 + 1}`, s.items, pageCrowd[i]);
  });

  /* ---------------------------------------------------------------- 5 package fixtures */
  const PK = [];
  for (const t of Object.keys(cat.P)) {
    const sizes = Object.keys(cat.P[t]);
    for (const z of [sizes[0], sizes[sizes.length - 1]]) for (const pkg of [1, 2, 3]) for (const ext of [false, true]) PK.push([t, z, pkg, ext]);
  }
  const pagePk = await bw.evaluate((cases) => cases.map(([t, z, pkg, ext]) => {
    Object.assign(state, { type: t, size: z, pLen: 12, pFlip: false, pMid: false, items: [], sel: null, seq: 0, elec: { pkg: pkg, ext: ext } });
    resetItems(); pkFixtures();
    const out = { items: JSON.parse(JSON.stringify(state.items)), seq: state.seq };
    state.elec = { pkg: 0, ext: false };
    return out;
  }), PK);
  PK.forEach(([t, z, pkg, ext], i) => {
    const s = freshState(t, z, { elec: { pkg, ext } });
    const fr = frameOf(s, cat);
    resetItems(s, fr, cat); pkFixtures(s, fr, cat);
    same("pkFixtures (electrical packages)", `${t} ${z} package ${pkg}${ext ? " + light" : ""}`, { items: s.items, seq: s.seq }, pagePk[i]);
  });

  /* ---------------------------------------------------------------- 6 priceParts */
  const EXTRAS = [
    { key: "ex1", name: "Loft ladder", input: "check", price: 250 },
    { key: "ex2", name: "Vents", input: "qty", price: 35 },
    { key: "ex3", name: "Trim run", input: "lf", price: 4.5 },
    { key: "ex4", name: "Spray foam floor", input: "sqftF", price: 1.1 },
    { key: "ex5", name: "Wall liner", input: "sqftW", price: 0.8 },
    { key: "ex6", name: "Roof liner", input: "sqftR", price: 0.65 },
    { key: "ex7", name: "Tall walls", input: "pct", price: 10 },
  ];
  const bwx = barnwrightCompany();
  bwx.options.extras = EXTRAS;
  const catX = resolve(bwx, readManufacturer("standard"), readJSON("library/construction.json"));
  const PRICE = [];
  for (const [t, z] of ALL) {
    const s = freshState(t, z); resetItems(s, frameOf(s, cat), cat);
    PRICE.push({ s, label: `${t} ${z} standard`, extras: false });
  }
  for (const t of Object.keys(cat.P)) {
    const sizes = Object.keys(cat.P[t]);
    for (const z of [sizes[0], sizes[Math.floor(sizes.length / 2)], sizes[sizes.length - 1]]) {
      const base = () => { const s = freshState(t, z); resetItems(s, frameOf(s, cat), cat); return s; };
      const add = (label, fn, extras) => { const s = base(); fn(s); PRICE.push({ s, label: `${t} ${z} ${label}`, extras: !!extras }); };
      for (const dm of ["none", "6", "9", "12"]) add("dormer " + dm, (s) => { s.dormer = dm; });
      for (const pkg of [1, 2, 3]) for (const ext of [false, true]) add(`package ${pkg}${ext ? " + light" : ""}`, (s) => { s.elec = { pkg, ext }; pkFixtures(s, frameOf(s, cat), cat); });
      add("light switched on with no package", (s) => { s.elec = { pkg: 0, ext: true }; });
      for (const r of ["r4", "r6", "kit"]) add("ramp " + r, (s) => { s.ramp = r; });
      for (const k of Object.keys(cat.RATES)) add("upgrade " + k, (s) => { s.opts[k] = true; });
      add("every upgrade", (s) => { for (const k of Object.keys(s.opts)) s.opts[k] = true; });
      add("double, shutters, swaps", (s) => {
        const wins = s.items.filter((i) => cat.CAT[i.cat].k === "win" && !cat.CAT[i.cat].gable);
        if (wins[0]) { wins[0].dbl = true; wins[0].shut = true; }
        if (wins[1]) { wins[1].cat = "w33"; wins[1].shut = true; }
        const doors = s.items.filter((i) => cat.CAT[i.cat].k === "door");
        if (doors[0]) { doors[0].lite = true; if (doors[0].cat === "w72") doors[0].cat = "dfr"; else if (doors[0].cat === "w48") doors[0].cat = "w72"; else if (doors[0].cat === "d36lite") doors[0].cat = "d36in"; }
        s.items.push({ id: "n1", cat: "w23", wall: "L", pos: 0, inc: false, shut: true, dbl: true });
        s.items.push({ id: "n2", cat: "w33", wall: "B", pos: 1, inc: false, shut: false });
        s.items.push({ id: "n3", cat: "w48", wall: "B", pos: -2, inc: false, lite: true });
        s.items.push({ id: "n4", cat: "d36in", wall: "L", pos: 3, inc: false, lite: true });
        s.items.push({ id: "n5", cat: "fake", wall: "F", pos: 0, inc: false, dbl: true, shut: true });
      });
      add("benches, shelves, electrical", (s) => {
        s.items.push({ id: "b1", cat: "bench", wall: "IN", px: 0, pz: 0, ln: 6, inc: false });
        s.items.push({ id: "b2", cat: "shelf", wall: "IN", px: 0, pz: 1, inc: false });
        s.items.push({ id: "b3", cat: "outlet", wall: "L", pos: 0, inc: false });
        s.items.push({ id: "b4", cat: "ilight", wall: "IN", px: 0, pz: 0, inc: false });
        s.items.push({ id: "b5", cat: "light", wall: "R", pos: 0, inc: false });
        s.items.push({ id: "b6", cat: "gfci", wall: "R", pos: 1, inc: false, pk: true });
        s.items.push({ id: "b7", cat: "ru8", wall: "B", pos: 0, inc: false });
      });
      add("company extras", (s) => { s.xopt = { ex1: 1, ex2: 3, ex3: 24, ex4: 1, ex5: 1, ex6: 1, ex7: 1 }; }, true);
      add("company extras, one each", (s) => { s.xopt = { ex2: 1, ex3: 1 }; }, true);
    }
  }
  /* the cottage's standard double window (priced as included) and a swapped one */
  for (const t of ["CS", "MCS"]) for (const z of Object.keys(cat.P[t])) {
    const s = freshState(t, z); resetItems(s, frameOf(s, cat), cat);
    const w = s.items.find((i) => i.dbl); if (w) w.cat = "w33";
    PRICE.push({ s, label: `${t} ${z} standard double window made 3x3`, extras: false });
  }
  const pagePrice = await bw.evaluate(([cases, extras]) => cases.map((c) => {
    OPTX = c.extras ? { extras: extras, hide: [] } : { extras: [], hide: [] };
    Object.assign(state, JSON.parse(JSON.stringify(c.s)));
    const r = priceParts();
    OPTX = { extras: [], hide: [] };
    return r;
  }), [PRICE, EXTRAS]);
  PRICE.forEach((c, i) => {
    same("priceParts", c.label, priceParts(c.s, c.extras ? catX : cat), pagePrice[i]);
  });

  /* ---------------------------------------------------------------- 6b labels and money */
  const pageLabels = await bw.evaluate((cases) => cases.map(([t, z]) => {
    Object.assign(state, { type: t, size: z, pLen: 12, pFlip: false, pMid: false, sel: null, elec: { pkg: 0, ext: false } });
    resetItems(); refreshUI();
    const out = {};
    ["dbl", "jo12", "mbF", "mbW", "rbS", "rbR"].forEach((k) => { out[k] = document.getElementById("opr-" + k).textContent; });
    return out;
  }), ALL);
  ALL.forEach(([t, z], i) => {
    const s = freshState(t, z);
    const rc = rateCharges(s, cat);
    const ours = {}; for (const k of Object.keys(rc)) ours[k] = "+ " + money(rc[k]);
    same("upgrade button labels (one sqftCharge for label and charge)", `${t} ${z}`, ours, pageLabels[i]);
  });
  const AMOUNTS = [0, 5, 40, 1234.5, -99.99, 1234567.891, 6675, 0.004, -0.005, 12.345];
  const pageMoney = await bw.evaluate((a) => a.map((n) => money(n)), AMOUNTS);
  AMOUNTS.forEach((n, i) => same("money()", String(n), money(n), pageMoney[i]));

  /* ---------------------------------------------------------------- 6c roof helpers, sizes */
  const pageRoof = await bw.evaluate((cases) => cases.map(([t, z]) => {
    Object.assign(state, { type: t, size: z, pLen: 12, pFlip: false, pMid: false });
    const d = dims(), topY = y0 + TYPES[t].wallH, prof = roofProfile(d.W, topY);
    const xs = []; for (let k = -6; k <= 6; k++) xs.push(d.W / 2 * k / 5);
    const at = xs.map((x) => profileYat(prof, x));
    const eave = cottageEave(prof.map((q) => q.slice()), ROOF_TH);
    const peak = profileYat(prof, 0);
    const clips = [0.1, 0.5, 0.9].map((f) => {
      const yc = topY + (peak - topY) * f;
      const box = [[-1.2, yc - 1], [1.2, yc - 1], [1.2, yc + 1], [-1.2, yc + 1]];
      const off = [[d.W / 4 - 1, yc - 0.5], [d.W / 4 + 1.5, yc - 0.5], [d.W / 4 + 1.5, yc + 0.8], [d.W / 4 - 1, yc + 0.8]];
      return [gableClip(box, prof, 0.10), gableClip(off, prof, 0.10), gableClip(box, prof, 0)];
    });
    return { at, eave, clips, sizes: pSizes(t), min: minPrice(t), p: pPrice(t, z), none: pPrice(t, "99x99") };
  }), ALL);
  ALL.forEach(([t, z], i) => {
    const b = pageRoof[i], label = `${t} ${z}`;
    const fr = frameOf(freshState(t, z), cat);
    const xs = []; for (let k = -6; k <= 6; k++) xs.push(fr.d.W / 2 * k / 5);
    same("roof helpers (profileYat, cottageEave, gableClip)", label + " profileYat", xs.map((x) => profileYat(fr.prof, x)), b.at);
    same("roof helpers (profileYat, cottageEave, gableClip)", label + " cottageEave", cottageEave(fr.prof.map((q) => q.slice()), ROOF_TH), b.eave);
    const peak = profileYat(fr.prof, 0);
    const clips = [0.1, 0.5, 0.9].map((f) => {
      const yc = fr.topY + (peak - fr.topY) * f;
      const box = [[-1.2, yc - 1], [1.2, yc - 1], [1.2, yc + 1], [-1.2, yc + 1]];
      const off = [[fr.d.W / 4 - 1, yc - 0.5], [fr.d.W / 4 + 1.5, yc - 0.5], [fr.d.W / 4 + 1.5, yc + 0.8], [fr.d.W / 4 - 1, yc + 0.8]];
      return [gableClip(box, fr.prof, 0.10), gableClip(off, fr.prof, 0.10), gableClip(box, fr.prof, 0)];
    });
    same("roof helpers (profileYat, cottageEave, gableClip)", label + " gableClip", clips, b.clips);
    same("pSizes, pPrice, minPrice", label, { sizes: pSizes(t, cat), min: minPrice(t, cat), p: pPrice(t, z, cat), none: pPrice(t, "99x99", cat) },
      { sizes: b.sizes, min: b.min, p: b.p, none: b.none });
  });

  /* ---------------------------------------------------------------- 7 openingRect */
  const ADD = [["w33", "L", { shut: true }], ["w36", "B", { lite: true }], ["dfr", "L", {}], ["ru6", "B", {}], ["g1824", "F", {}], ["oct", "B", {}],
    ["tr", "L", { rot: true }], ["w23", "B", { dbl: true, shut: true }], ["d36in", "L", {}], ["light", "R", {}], ["g1824", "R", {}], ["fake", "B", { vy: 2 }], ["w48", "R", {}], ["g1824", "B", { pos: 1.1 }]];
  const TRIM = ALL.map(([t, z]) => [t, z, {}]);
  for (const [t, z] of ALL) if (cat.TYPES[t].porch === "S") for (const v of [{ pFlip: true }, { pMid: true }, { pLen: 8 }]) TRIM.push([t, z, v]);
  const pageTrim = await bw.evaluate(([cases, add]) => cases.map(([t, z, v]) => {
    Object.assign(state, { type: t, size: z, pLen: 12, pFlip: false, pMid: false, items: [], sel: null, seq: 0, elec: { pkg: 0, ext: false } }, v);
    resetItems();
    add.forEach(([c, w, f], n) => {
      const it = Object.assign({ id: "x" + n, cat: c, wall: w, pos: CAT[c].gable ? 0 : freeSpot(w, CAT[c].w), inc: false, shut: false }, f);
      clampPos(it); state.items.push(it);
    });
    const rec = {}, orig = window.pushTri;
    window.pushTri = function (b, p0, p1, p2) {
      const id = window.CURIT;
      if (id != null && b === window.buckets.trim) (rec[id] = rec[id] || []).push(p0, p1, p2);
      return orig.apply(this, arguments);
    };
    try { buildShed(); } finally { window.pushTri = orig; }
    const ws = wallDefs(), boxes = {};
    state.items.forEach((it) => {
      const pts = rec[it.id];
      if (!pts) { boxes[it.id] = null; return; }
      const gablePlane = CAT[it.cat].gable && it.wall !== "R" && it.wall !== "L";
      const w = ws[it.wall];
      let b = null;
      pts.forEach((p) => {
        let u;
        if (gablePlane) u = p[0];
        else { const o = w.ox !== undefined ? [w.ox, w.oz] : (w.n[2] !== 0 ? [w.cx || 0, w.at] : [w.at, w.cx || 0]); u = (p[0] - o[0]) * w.ax[0] + (p[2] - o[1]) * w.ax[2]; }
        if (!b) b = { u0: u, u1: u, y0: p[1], y1: p[1], n: 0 };
        b.u0 = Math.min(b.u0, u); b.u1 = Math.max(b.u1, u); b.y0 = Math.min(b.y0, p[1]); b.y1 = Math.max(b.y1, p[1]);
      });
      b.n = pts.length / 3;
      b.plane = gablePlane ? "gable" : "wall";
      /* every distinct coordinate the trim was drawn at, for the piece test */
      if (!gablePlane) {
        const o = w.ox !== undefined ? [w.ox, w.oz] : (w.n[2] !== 0 ? [w.cx || 0, w.at] : [w.at, w.cx || 0]);
        const us = new Set(), ys = new Set();
        pts.forEach((p) => { us.add((p[0] - o[0]) * w.ax[0] + (p[2] - o[1]) * w.ax[2]); ys.add(p[1]); });
        b.us = Array.from(us); b.ys = Array.from(ys);
      }
      boxes[it.id] = b;
    });
    return { items: JSON.parse(JSON.stringify(state.items)), boxes };
  }), [TRIM, ADD]);
  let tris = 0, clippedN = 0, pieces = 0;
  TRIM.forEach(([t, z, v], i) => {
    const b = pageTrim[i];
    const s = freshState(t, z, v); s.items = b.items;
    const plan = makePlan(s, cat);
    for (const it of plan.state.items) {
      const r = openingRect(it, plan), box = b.boxes[it.id];
      const label = `${t} ${z}${Object.keys(v).length ? " " + JSON.stringify(v) : ""} ${it.cat} on ${it.wall}`;
      if (!box) { tally("openingRect vs drawn trim", r === null || r.u0 === null, `${label}: nothing drawn in trim, but openingRect says ${JSON.stringify(r)}`); continue; }
      tris += box.n;
      if (!r) { tally("openingRect vs drawn trim", false, `${label}: ${box.n} trim triangles drawn, openingRect says null`); continue; }
      if (r.clipped) clippedN++;
      const got = box.plane === "gable" ? [r.x0, r.x1, r.y0, r.y1] : [r.u0, r.u1, r.y0, r.y1];
      const want = [box.u0, box.u1, box.y0, box.y1];
      const ok = got.every((v, k) => Math.abs(v - want[k]) < 1e-9) && (box.plane === "gable") === (r.plane === "gable");
      tally("openingRect vs drawn trim", ok, `${label}: openingRect ${JSON.stringify(got)} vs drawn ${JSON.stringify(want)} (${box.plane})`);
      if (box.plane === "wall" && r.casing) {
        const near = (list, v) => list.some((x) => Math.abs(x - v) < 1e-9);
        const us = [["casing.u0", r.casing.u0], ["casing.u1", r.casing.u1], ["casing inner edge (clear.u0 + 0.02)", r.clear.u0 + 0.02], ["casing inner edge (clear.u1 - 0.02)", r.clear.u1 - 0.02],
          ["head.u0", r.head.u0], ["head.u1", r.head.u1]];
        const ys = [["casing.y0", r.casing.y0], ["casing.y1", r.casing.y1], ["head.y0", r.head.y0], ["head.y1", r.head.y1]];
        if (r.sill) { us.push(["sill.u0", r.sill.u0], ["sill.u1", r.sill.u1]); ys.push(["sill.y0", r.sill.y0], ["sill.y1", r.sill.y1]); }
        if (r.porchBand) { us.push(["porchBand.u0", r.porchBand.u0], ["porchBand.u1", r.porchBand.u1]); ys.push(["porchBand.y0", r.porchBand.y0], ["porchBand.y1", r.porchBand.y1]); }
        const missing = us.filter((e) => !near(box.us, e[1])).concat(ys.filter((e) => !near(box.ys, e[1])));
        tally("openingRect pieces (casing, head, sill, porch band) vs drawn trim", missing.length === 0 && us.length + ys.length >= 10,
          `${label}: nothing is drawn at ${missing.map((e) => e[0] + " " + e[1]).join(", ")}`);
        pieces += us.length + ys.length;
      }
      if (r.plane === "gable") {
        /* the trim is symmetric about the window, so its centre (turned into the
           end wall's own u) must be u, and so must the opening's */
        const uc = it.wall === "B" ? -(r.unclipped.x0 + r.unclipped.x1) / 2 : (r.unclipped.x0 + r.unclipped.x1) / 2;
        const ok2 = Math.abs(uc - r.u) < 1e-9 && Math.abs((r.clear.u0 + r.clear.u1) / 2 - r.u) < 1e-9 && Math.abs(r.x - it.pos) < 1e-9 &&
          (r.u0 === null || (r.u0 <= r.u && r.u <= r.u1) || r.clipped);
        tally("openingRect pieces (casing, head, sill, porch band) vs drawn trim", ok2, `${label}: a gable window's centre, opening and trim are not in one set of coordinates: ${JSON.stringify({ u: r.u, x: r.x, clear: r.clear, u0: r.u0, u1: r.u1, uc })}`);
      }
    }
  });
  counts["openingRect vs drawn trim"].note = `${tris} trim triangles measured; ${clippedN} gable windows cut by the roof line`;
  counts["openingRect pieces (casing, head, sill, porch band) vs drawn trim"].note = `${pieces} piece edges found among the drawn coordinates`;
} finally {
  await bw.close();
}

/* ---------------------------------------------------------------- report */
let total = 0, bad = 0;
console.log("Barnwright's rules vs ours (Barnwright's page, file SHA-256 " + G.sha256.slice(0, 12) + "...):");
for (const [g, c] of Object.entries(counts)) {
  total += c.pass + c.fail; bad += c.fail;
  console.log(`  ${c.fail ? "FAIL" : "ok  "} ${g}: ${c.pass} identical${c.fail ? `, ${c.fail} different` : ""}${c.note ? " (" + c.note + ")" : ""}`);
}
if (failures.length) { console.log("\nFirst differences:"); for (const f of failures) console.log("  " + f); }
console.log(`\n${total - bad} of ${total} comparisons identical, ${bad} different. (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
if (bad) {
  console.log("The model does NOT match Barnwright yet.");
  process.exit(1);
}
console.log("Proved: for every style at every size, the model's frame, walls, roof line, standard doors and windows, clamping (crowded walls included), gable band, package fixtures, prices and opening rectangles (outer box and every piece) are Barnwright's, number for number.");
