/* CHECK: THE FRAMING IS BUILT THE WAY A REAL SHED IS BUILT.
   Run: node tools/check-framing.mjs            (every framing part, the roof's included)
        node tools/check-framing.mjs --mine     (only the floor, wall, foundation, porch-deck and inside parts)
   check-all: node

   WHY. Alan asked that "when there is a new design it builds it like in real
   life". Barnwright drew no framing, so the framing parts are NEW geometry
   (parts/foundation.js floor-frame.js floor-deck.js wall-frame.js
   porch-deck-frame.js interior.js, the roof framing, and the ramp). Nothing
   can compare them to Barnwright; this check holds them to how a shed is
   really built, on every building we can make.

   THE BUILDINGS: every one of the 148 recorded golden buildings (Barnwright's
   own states), and every style at every size each company offers
   (Barnwright's catalogue, the demo and the starter company) with its
   standard doors and windows -- side porches also flipped, centred and 8 ft;
   each style also with each electrical package (outside light included), a
   work bench and a shelf, and every per-square-foot option on (12 in floor
   joists, double floor ...); and each style's typical size with each ramp.
   And the buildings a customer can make that framing finds hardest:
   crowded walls laid by hand; openings wider than their wall (an 8 ft
   roll-up on an 8 ft end wall, double doors swapped onto a 4 ft porch wall),
   a window framed under the single slope's transom row, a gable window
   dragged down onto another window; benches and shelves along the walls
   where the package's outlets are, two benches meeting in an L, shelves
   overlapping, a shelf on the Standard Barn's 4.2 ft walls; and companies
   that build differently (fewer blocks and more anchors, 19.2 in joists,
   2x6 studs at 24 in with one top plate, tripled headers, a triple floor).

   WHAT IT PROVES, on every building (docs/ARCHITECTURE.md "Framing datums"):
   1. drawing the framing (assemble frames:true) changes NOTHING in the
      finished building -- its materials and every triangle, hashed -- and
      frames:false draws no framing at all; every framing triangle belongs to
      a framing part and carries only that part's own stages;
   2. each framing part draws exactly the pieces (members) it lists: the
      triangle count and the outline match;
   3. REGIONS: below the floor line (y0) everything is inside the footprint;
      between the floor and the wall top everything is inside the walls and
      not out on an open porch; above the wall top everything is under the
      roof, never past the fascia, the soffit or the rake overhang (the
      dormer's roof included);
   4. no two pieces overlap by more than 0.01 ft (a sweep over every piece,
      the skids included, with an exact separating-axis test);
   5. no bearing gap over 0.01 ft: every joist, plate, stud, header, sill,
      sheet and leg rests on what is under it (a rim on the joist ends, an
      electrical box on its stud -- nailed; a block and an anchor in the
      ground);
   6. every door and window on a framed wall has jack studs, king studs (or a
      corner or a neighbour's jack doing that job) and a header (or, where not
      even a flat 2x fits, the top plate right over it), and a window its
      rough sill with cripples under it; openings too close to frame apart
      share a stud or are framed as one; every header is the size the
      walls.header rule gives for its span, or -- only where that one does
      not fit -- the deepest that does; every header is tight under what it
      carries or has cripples between (no gap under the plates); a stud two
      openings share carries both their headers;
   7. SPACING matches plan.construction: floor joists at floor.spacingIn on
      centre from the back end, studs at walls.spacingIn from the corner, no
      bay wider than that except across an opening; and choosing 12 in floor
      joists really puts them 12 in apart (and adds joists); a double floor
      really lays two layers of decking;
   8. the foundation has one block per site.perimeterFtPerBlock ft of outside
      wall at least, spread on every skid (one at each end of the building),
      and site.anchors anchors;
   9. the decking covers the room and the deck boards cover every porch;
  10. the ramp is drawn only when a 4 or 6 ft ramp is chosen (not for the DIY
      kit), in the finished view, as long as chosen, from the floor line at
      the biggest door (or the porch entry) down to the ground, and cuts into
      nothing of the finished building (door trim, thresholds, porch posts,
      railing, the side porch's step, the siding) by more than 0.01 ft.

   The roof framing parts (gable-frame, roof-frame, loft, roof-deck,
   dormer-frame) are held to 1-5 too; a part that lists no members is read
   back from the triangles it drew (tools/lib/framing-geometry.mjs
   solidsFromBuild). tools/check-framing-roof.mjs checks what only a roof has. */

import { PIPELINE } from "../parts/index.js";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { STAGES, STAGE_ID } from "../parts/stages.js";
import { readGoldenCases } from "./lib/golden-cases.mjs";
import { readFixture, catalogue } from "./lib/headless.mjs";
import { loadCatalogue } from "./lib/load.mjs";
import { makePlan } from "../model/plan.js";
import { frameOf } from "../model/frame.js";
import { defaults, setType } from "../model/design.js";
import { resetItems, pkFixtures, openingRect } from "../model/layout.js";
import { assemble } from "../engine/assemble.js";
import { y0 } from "../engine/constants.js";
import * as G from "./lib/framing-geometry.mjs";
import { triangulate, polyArea, solidEnough, floorPlanOf } from "../parts/floor-frame.js";
import { wallFrame, wallSpec, CRIPPLE_MIN, HEADER_FALLBACK } from "../parts/wall-frame.js";
import { lumberSize } from "../parts/floor-frame.js";
import { pickRule } from "../model/construction.js";
import { clampPos } from "../model/layout.js";
import { skidRuns } from "../parts/foundation.js";
import { rampMembers, rampSite, rampLength, SIDE_STEP } from "../parts/ramp.js";
import { clearOutline } from "../parts/interior.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MINE_PARTS = ["foundation", "floor-frame", "floor-deck", "wall-frame", "porch-deck-frame", "interior"];
const onlyMine = process.argv.includes("--mine");
const FRAME_ENTRIES = PIPELINE.filter((en) => en.frame && (!onlyMine || MINE_PARTS.includes(en.entry)));
/* each framing part's list of members, however it names it (tools/lib/framing-geometry.mjs membersFunction) */
const MEMBERS_FN = new Map();
for (const en of PIPELINE.filter((e) => e.frame)) MEMBERS_FN.set(en.entry, G.membersFunction(await import(pathToFileURL(resolve(ROOT, en.file)).href)));
const STAGE_BY_ID = new Map(STAGES.map((s) => [s.id, s]));

let pass = 0, fail = 0;
const failures = new Map();                 /* one line per kind of failure, with the first few buildings */
function ok(what, cond, where) {
  if (cond) { pass++; return true; }
  fail++;
  const f = failures.get(what) || { n: 0, where: [] };
  f.n++; if (f.where.length < 4) f.where.push(where);
  failures.set(what, f);
  return false;
}
const tally = { buildings: 0, members: 0, openings: 0, combined: 0, shared: 0, through: 0, fitted: 0, lifted: 0, clipped: 0, headers: 0, hard: 0, ways: 0, stepRamps: 0, stepCut: 0, joists: 0, studs: 0, blocks: 0, anchors: 0, sheets: 0, boards: 0, ramps: 0, interior: 0, pairs: 0, roofParts: new Set(), pending: new Set() };

/* ---------------------------------------------------------------- buildings */

function standardState(cat, t, z) {
  const st = defaults(cat);
  setType(st, t, cat);
  st.size = z;
  resetItems(st, frameOf(st, cat), cat);
  return st;
}
function* buildings() {
  const cat0 = catalogue();
  for (const c of readGoldenCases().cases) yield { tag: `golden ${c.id}`, cat: cat0, state: readFixture(c.id).state };
  /* crowded walls, laid by hand (no clamp): openings a stud's width apart
     share it; closer, or overlapping, they are framed as one opening; a
     transom off-centre over a window is framed round it */
  function item(id, cat, wall, pos) { return { id, cat, wall, pos, inc: false, shut: false, dbl: false }; }
  const crowded = [
    ["UT", "12x24", [item("a", "w33", "R", -2.72), item("b", "w23", "R", 0), item("c", "w23", "R", 2.3)], "three windows, two shared studs"],
    ["LB", "10x20", [item("a", "w48", "R", 0), item("b", "w23", "R", 3.26)], "a door and a window a stud apart, their headers at different heights"],
    ["UT", "12x24", [item("a", "w23", "R", 6), item("b", "w23", "R", 7), item("c", "w23", "R", 9.2)], "three windows too close to frame apart"],
    ["SS", "12x24", [item("a", "w23", "R", 0), item("b", "tr", "R", 0.8), item("c", "w72", "L", 0)], "a transom off-centre over a window"],
    ["UT", "12x24", [item("a", "w72", "F", 0), item("b", "w23", "F", 4.4)], "a door and a window a stud apart on a gable end"],
  ];
  for (const [t, z, items, what] of crowded) {
    const st = standardState(cat0, t, z);
    st.items = items; st.seq = items.length;
    yield { tag: `crowded ${t} ${z}: ${what}`, cat: cat0, state: st, variant: "crowded" };
  }
  /* what a customer can make that is hardest to frame; each added item goes
     through clampPos, as the designer puts it */
  function added(t, z, add, mut) {
    const st = standardState(cat0, t, z);
    if (mut) mut(st);
    for (const it of add) { st.items.push(Object.assign({ inc: false, shut: false }, it)); clampPos(st.items[st.items.length - 1], st, frameOf(st, cat0)); }
    st.seq = st.items.length + 50;
    return st;
  }
  let nx = 0;
  function bench(px, pz, ln, rot, c = "bench") { return { id: "fx" + (nx++), cat: c, wall: "IN", ln, rot, px, pz }; }
  function pkg(st) { st.elec = { pkg: 3, ext: true }; pkFixtures(st, frameOf(st, cat0), cat0); }
  const hard = [
    ["UT", "8x12", [{ id: "h1", cat: "ru8", wall: "F", pos: 0 }], null, "an 8 ft roll-up on an 8 ft end wall"],
    ["SB", "8x12", [{ id: "h1", cat: "ru8", wall: "F", pos: 0 }], null, "an 8 ft roll-up reaching up into a Standard Barn's plates"],
    ["BU", "6x8", [{ id: "h1", cat: "w72", wall: "F", pos: 0 }], null, "double doors on a 6 ft end wall"],
    ["SC", "10x20", [{ id: "h1", cat: "dfr", wall: "S2", pos: 0 }], null, "French doors swapped onto a 4 ft porch wall"],
    ["DSC", "12x20", [{ id: "h1", cat: "w72", wall: "P1", pos: 0 }], null, "double doors on the corner porch's angled wall"],
    ["SS", "12x32", [{ id: "h1", cat: "w33", wall: "R", pos: -1.3, dbl: true }], null, "a double window under the transom row"],
    ["SU", "8x12", [{ id: "h1", cat: "g1824", wall: "R", pos: 100, vy: -5 }], null, "a gable window dragged down onto a window"],
    ["SLB", "8x12", [{ id: "h1", cat: "w36", wall: "R", pos: 0 }], null, "a fourth opening on a full 12 ft side wall"],
    ["UT", "10x16", [bench(-3.65, -4, 6, true), bench(3.65, 4, 6, true), bench(0, -7.65, 8, false), bench(-2.6, -7.2, 4, false, "shelf"), bench(-4.15, 3, 6, true, "shelf")], pkg, "benches and shelves along the walls where the outlets are"],
    ["UT", "10x16", [bench(-3.65, -4.65, 6, true), bench(-1, -7.65, 6, false)], null, "two benches meeting in an L"],
    ["UT", "10x16", [bench(0, 0, 6, false, "shelf"), bench(1, 0.5, 6, true, "shelf"), bench(0, 0, 6, false), bench(0.5, 0.5, 6, true)], null, "shelves and benches piled on each other"],
    ["SB", "8x12", [bench(0, -5.15, 8, false, "shelf")], pkg, "a shelf against a Standard Barn's 4.2 ft wall"],
    ["SC", "12x24", [bench(4.65, -9, 3, true), bench(4.65, -3, 3, true), bench(4.65, 3, 3, true), bench(0, 0, 12, false)], pkg, "benches along the porch side and one right across"],
    ["DSC", "12x24", [bench(3, 6, 6, true), bench(0, 9, 12, false)], pkg, "benches against the corner porch's walls"],
  ];
  for (const [t, z, add, mut, what] of hard) yield { tag: `hard ${t} ${z}: ${what}`, cat: cat0, state: added(t, z, add, mut), variant: "hard" };
  /* companies that build differently: the same framing rules must hold */
  const merge = (a, b) => { for (const k of Object.keys(b)) { if (b[k] && typeof b[k] === "object" && !Array.isArray(b[k]) && a[k] && typeof a[k] === "object") merge(a[k], b[k]); else a[k] = b[k]; } return a; };
  const ways = [
    ["a block every 12 ft and 12 anchors", { site: { perimeterFtPerBlock: 12, anchors: 12 } }],
    ["19.2 in floor joists", { floor: { spacingIn: 19.2 } }],
    ["2x6 studs at 24 in, one top plate, two-stud corners", { walls: { stud: "2x6", spacingIn: 24, topPlates: 1, corner: "2-stud" } }],
    ["tripled 2x12 headers and two bottom plates", { walls: { header: [{ value: "2x12 tripled" }], bottomPlates: 2 } }],
    ["2x8 joists under a triple 3/4 in floor", { floor: { joist: "2x8", rim: "2x8", deck: { layers: 3, thicknessIn: 0.75 } } }],
  ];
  for (const [how, extra] of ways) {
    const cw = structuredClone(cat0); merge(cw.construction, extra);
    for (const [t, z] of [["UT", "10x16"], ["LB", "12x24"], ["SC", "12x24"], ["DSC", "12x24"], ["DK", "10x16"], ["SS", "12x24"], ["G", "12x24"], ["SB", "8x12"], ["BU", "6x12"]]) {
      if (!cw.P[t] || !cw.P[t][z]) continue;
      const st = standardState(cw, t, z);
      st.elec = { pkg: 3, ext: true }; pkFixtures(st, frameOf(st, cw), cw);
      yield { tag: `built with ${how}: ${t} ${z}`, cat: cw, state: st, variant: "construction" };
    }
  }
  const cats = [["barnwright", cat0]];
  for (const id of ["demo", "starter"]) cats.push([id, loadCatalogue(id)]);
  for (const [cid, cat] of cats) {
    for (const t of Object.keys(cat.P)) {
      const sizes = Object.keys(cat.P[t]);
      for (const z of sizes) {
        const st = standardState(cat, t, z);
        yield { tag: `${cid} ${t} ${z}`, cat, state: st };
        if (cat.TYPES[t].porch === "S") {
          for (const v of [{ pFlip: true }, { pMid: true }, { pLen: 8 }, { pMid: true, pLen: 8 }]) {
            const s2 = structuredClone(st); Object.assign(s2, v); resetItems(s2, frameOf(s2, cat), cat);
            yield { tag: `${cid} ${t} ${z} ${JSON.stringify(v)}`, cat, state: s2 };
          }
        }
      }
      const zt = sizes[Math.min(4, sizes.length - 1)];
      const base = standardState(cat, t, zt);
      for (const pk of Object.keys(cat.ELECFX || {})) {
        const s3 = structuredClone(base);
        s3.elec = { pkg: +pk, ext: !!(cat.MISC && cat.MISC.ext != null) };
        pkFixtures(s3, frameOf(s3, cat), cat);
        if (cat.CAT.bench) s3.items.push({ id: "bench1", cat: "bench", wall: "IN", ln: 6, rot: false, px: 0, pz: 0, inc: false, shut: false });
        if (cat.CAT.shelf) s3.items.push({ id: "shelf1", cat: "shelf", wall: "IN", ln: 4, rot: true, px: 1, pz: 1, inc: false, shut: false });
        for (const k of Object.keys(s3.opts || {})) s3.opts[k] = true;
        yield { tag: `${cid} ${t} ${zt} electric ${pk} + bench, shelf, every option`, cat, state: s3, variant: "options" };
      }
      for (const r of (cat.RAMPS || []).map((x) => x[0]).filter((x) => x !== "none")) {
        const s4 = structuredClone(base); s4.ramp = r;
        yield { tag: `${cid} ${t} ${zt} ramp ${r}`, cat, state: s4, variant: "ramp" };
      }
      /* the same building with and without 12 in joists and a double floor */
      const s5 = structuredClone(base);
      for (const k of Object.keys(s5.opts || {})) s5.opts[k] = false;
      yield { tag: `${cid} ${t} ${zt} standard floor`, cat, state: s5, variant: "floor", pair: "std" };
      if (cat.RATES && cat.RATES.jo12 != null) {
        const s6 = structuredClone(s5); s6.opts.jo12 = true; if (cat.RATES.dbl != null) s6.opts.dbl = true;
        yield { tag: `${cid} ${t} ${zt} 12 in joists + double floor`, cat, state: s6, variant: "floor", pair: "12" };
      }
    }
  }
}

/* --------------------------------------------------------------- the checks */

function triCountOf(m) {
  if (m.shape === undefined && m.z0 != null) return m.poly && m.poly.length >= 3 && m.z1 - m.z0 > 1e-4 ? 4 * m.poly.length - 4 : 0;
  if (!solidEnough(m)) return 0;
  if (m.shape === "beam") return 12;
  let edges = 0;
  for (let i = 0; i < m.poly.length; i++) { const p = m.poly[i], q = m.poly[(i + 1) % m.poly.length]; if (Math.hypot(q[0] - p[0], q[1] - p[1]) > 1e-9) edges++; }
  return 2 * triangulate(m.poly).length + 2 * edges;
}
function partTriangles(build, part) {
  let n = 0; const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity]; const stages = new Set();
  for (const key of build.ORDER) {
    const b = build.buckets[key];
    for (const s of build.tags[key] || []) {
      if (s.part !== part) continue;
      n += s.count;
      for (let t = s.from; t < s.from + s.count; t++) for (let v = 0; v < 3; v++) {
        const o = (t * 3 + v) * 9;
        for (let i = 0; i < 3; i++) { if (b.v[o + i] < min[i]) min[i] = b.v[o + i]; if (b.v[o + i] > max[i]) max[i] = b.v[o + i]; }
        stages.add(b.v[o + 8]);
      }
    }
  }
  return { n, min, max, stages };
}
function stageIdsOf(mod) { return new Set((Array.isArray(mod.stage) ? mod.stage : [mod.stage]).map((k) => STAGE_ID[k])); }

const joistPairs = new Map();              /* "cid t z" -> { std: n, "12": n } */

for (const B of buildings()) {
  const where = B.tag;
  let plan;
  try { plan = makePlan(B.state, B.cat); } catch (e) { ok("the building can be planned", false, `${where}: ${e.message}`); continue; }
  tally.buildings++;
  if (B.variant === "hard") tally.hard++;
  if (B.variant === "construction") tally.ways++;
  const vp = { w: 742, h: 803 };
  let rF, rT;
  try {
    rF = assemble(plan, { viewport: vp, fit: "barnwright", scene: "studio", trueColour: false, frames: false });
    rT = assemble(plan, { viewport: vp, fit: "barnwright", scene: "studio", trueColour: false, frames: true });
  } catch (e) { ok("the building draws with and without framing", false, `${where}: ${e.message}`); continue; }

  /* 1. the finished building is untouched */
  /* (a framing part may make a material it draws nothing into on this
     building -- an empty bucket after all the finished ones; it draws no
     triangle, so it is left out of the comparison) */
  const gF = G.finishedFingerprint(rF.build), gT = G.finishedFingerprint(rT.build), keysF = new Set(gF.order);
  gT.buckets = gT.buckets.filter((b) => keysF.has(b.key) || b.triangles > 0); gT.order = gT.buckets.map((b) => b.key);
  const fpF = JSON.stringify(gF), fpT = JSON.stringify(gT);
  ok("drawing the framing leaves every finished triangle and material exactly as it was", fpF === fpT, where);
  let frameTrisWithout = 0, strayFrame = 0;
  for (const key of rF.build.ORDER) { const b = rF.build.buckets[key]; for (let t = 0; t < b.n / 3; t++) if (STAGE_BY_ID.get(b.v[t * 27 + 8]).kind === "frame") frameTrisWithout++; }
  ok("with framing off, not one framing triangle is drawn", frameTrisWithout === 0, `${where}: ${frameTrisWithout}`);
  const frameParts = new Set(PIPELINE.filter((en) => en.frame).map((en) => en.part));
  for (const key of rT.build.ORDER) {
    const b = rT.build.buckets[key];
    for (const s of rT.build.tags[key] || []) for (let t = s.from; t < s.from + s.count; t++) {
      if (STAGE_BY_ID.get(b.v[t * 27 + 8]).kind === "frame" && !frameParts.has(s.part)) strayFrame++;
    }
  }
  ok("every framing triangle belongs to a framing part", strayFrame === 0, `${where}: ${strayFrame}`);

  /* 2. members, and what each part drew */
  const skids = G.skidSolids(plan);
  let solids = [], idBase = 0;
  const membersBy = {};
  for (const en of FRAME_ENTRIES) {
    const m = en.module;
    const drawn = partTriangles(rT.build, en.part);
    if (m.pending === true) { tally.pending.add(en.entry); continue; }
    if (!m.appliesTo(plan)) { ok(`a framing part that does not apply draws nothing (${en.entry})`, drawn.n === 0, where); continue; }
    const want = stageIdsOf(m);
    ok(`${en.entry}'s triangles carry only its own stages (${[...want].map((i) => STAGE_BY_ID.get(i).key).join(", ")})`, [...drawn.stages].every((s) => want.has(s)), where);
    if (!MINE_PARTS.includes(en.entry)) tally.roofParts.add(en.entry);
    const fn = MEMBERS_FN.get(en.entry);
    let ms = fn ? fn(plan) : null;
    if (ms) {
      membersBy[en.entry] = ms;
      const expect = ms.reduce((a, x) => a + triCountOf(x), 0);
      ok(`${en.entry} draws exactly the pieces it lists (triangle count)`, expect === drawn.n, `${where}: listed ${expect}, drawn ${drawn.n}`);
      const sol = G.solidsOf(ms, en.entry, idBase); idBase += ms.length;
      if (drawn.n) {
        const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
        sol.forEach((s) => { for (let i = 0; i < 3; i++) { mn[i] = Math.min(mn[i], s.min[i]); mx[i] = Math.max(mx[i], s.max[i]); } });
        const same = [0, 1, 2].every((i) => Math.abs(mn[i] - drawn.min[i]) < 1e-6 && Math.abs(mx[i] - drawn.max[i]) < 1e-6);
        ok(`${en.entry} draws exactly the pieces it lists (outline)`, same, where);
      }
      solids.push(...sol);
      tally.members += ms.length;
    } else {
      const sol = G.solidsFromBuild(rT.build, en.part, idBase); idBase += sol.length + 1;
      solids.push(...sol);
    }
  }

  /* 3. regions */
  const reg = G.regionProblems(plan, solids);
  for (const r of reg) ok(`every framing piece is where framing can be (${r.solid.part} ${r.solid.kind}: ${r.why})`, false, `${where} at ${r.vert.map((v) => v.toFixed(2)).join(",")}`);
  if (!reg.length) ok("every framing piece is where framing can be", true);

  /* 4. overlaps */
  const ov = G.overlaps(solids.concat(skids)).filter((o) => !(o.a.part === "skids" && o.b.part === "skids"));
  tally.pairs += solids.length;
  for (const o of ov) ok(`no two pieces overlap by more than ${G.TOL} ft (${o.a.part} ${o.a.kind} / ${o.b.part} ${o.b.kind})`, false, `${where}: ${o.depth.toFixed(3)} ft`);
  if (!ov.length) ok("no two pieces overlap", true);

  /* 5. bearing */
  const bear = G.bearingProblems(solids, solids.concat(skids));
  for (const b of bear) ok(`every piece rests on or is nailed to something (${b.solid.part} ${b.solid.kind} ${b.why})`, false, `${where} ${JSON.stringify(b.solid.meta.wall || b.solid.meta.frame || "")}`);
  if (!bear.length) ok("every piece rests on or is nailed to something", true);

  /* 6. openings, 7. stud spacing */
  if (membersBy["wall-frame"]) {
    const WF = wallFrame(plan), spec = wallSpec(plan);
    const framedItems = new Map();
    for (const fr of WF.framed) {
      const ms = fr.members;
      for (const f of fr.frames) {
        tally.openings++; if (f.combined) tally.combined++; if (f.shareL || f.shareR) tally.shared++; if (f.through) tally.through++; if (f.header.size && !f.header.fits) tally.fitted++;
        if (f.clipped) tally.clipped++; if (f.header.size && f.hBot > f.ro.y1 + 1e-9) tally.lifted++;
        f.ids.forEach((id) => framedItems.set(id, f));
        const mine = ms.filter((m) => m.meta.item === f.id);
        const shared = ms.filter((m) => m.kind === "jack" && m.meta.sharedWith === f.id);
        const jackL = mine.some((m) => m.kind === "jack" && m.meta.side === "L") || shared.length > 0;
        const jackR = mine.some((m) => m.kind === "jack" && m.meta.side === "R");
        ok("every opening has a jack stud on each side", jackL && jackR, `${where} ${fr.run.key} ${f.id}`);
        function kingOk(side) {
          if (mine.some((m) => m.kind === "king" && m.meta.side === side)) return true;
          if (f.kingByEnd[side]) return true;
          if ((side === "L" && f.shareL) || (side === "R" && f.shareR)) return true;
          return ms.some((m) => (m.meta.servesAsKing || []).indexOf(f.id + ":" + side) >= 0);
        }
        ok("every opening has a king stud on each side (or a corner or a neighbour's jack doing its job)", kingOk("L") && kingOk("R"), `${where} ${fr.run.key} ${f.id}`);
        const hdr = mine.some((m) => m.kind === "header");
        const plateOver = !f.header.size && f.plateHead;
        if (f.header.size) {
          tally.headers++;
          /* the size: the walls.header rule's for this span, or -- only when
             that does not fit under what the header carries -- the deepest
             one that does (a flat 2x last) */
          const asked = lumberSize(pickRule(plan.construction.walls.header, { spanFt: f.ro.u1 - f.ro.u0 }));
          const got = f.header.size, room = f.limit - f.ro.y1;
          let sizeOk;
          if (got.nominal === asked.nominal && got.plies === asked.plies && !f.header.flat) sizeOk = true;
          else {
            const tries = [asked.d].concat(HEADER_FALLBACK.map((n) => lumberSize(n).d).filter((d) => d < asked.d - 1e-9));
            const deepestFit = tries.find((d) => d <= room + 1e-9);
            sizeOk = asked.d > room + 1e-9 && (f.header.flat ? deepestFit === undefined && spec.plateT <= room + 1e-9 : deepestFit !== undefined && Math.abs(got.d - deepestFit) < 1e-9);
          }
          ok("every header is the size the walls.header rule gives for its opening, or the deepest that fits where that one does not", sizeOk, `${where} ${fr.run.key} ${f.id}: ${got.nominal} for ${asked.name} with ${room.toFixed(3)} ft of room`);
          /* no gap between the header and what it carries: tight under it,
             or cripples standing on the header up to it */
          const gap = f.limit - f.hTop;
          const cripOn = ms.some((m) => (m.kind === "cripple" || m.kind === "stud" || m.kind === "jack") && Math.abs(m.meta.at.y0 - f.hTop) < 1e-6 && m.meta.at.u1 > f.edgeL - 1e-9 && m.meta.at.u0 < f.edgeR + 1e-9);
          ok("every header is tight under what it carries, or has cripples up to it (no gap)", Math.abs(gap) < 1e-6 || (gap >= CRIPPLE_MIN - 1e-9 && cripOn), `${where} ${fr.run.key} ${f.id}: ${gap.toFixed(3)} ft`);
        }
        /* a stud two openings share carries both their headers */
        if (f.shareR) {
          const js = ms.find((m) => m.kind === "jack" && m.meta.shared && m.meta.sharedWith === f.shareR.right);
          const nb = fr.frames.find((q) => q.id === f.shareR.right);
          ok("a stud two openings share carries both their headers", !!(js && nb && Math.abs(js.meta.at.y1 - Math.min(f.hBot, fr.yTB)) < 1e-6 && Math.abs(js.meta.at.y1 - Math.min(nb.hBot, fr.yTB)) < 1e-6), `${where} ${fr.run.key} ${f.id}`);
        }
        if (f.through) {
          /* its header is the gable framing's: something of the gable framing
             spans the opening above it (when that part is built) */
          const gf = (membersBy["gable-frame"] || []).concat(membersBy["roof-frame"] || []);
          if (gf.length) {
            /* the gable framing's pieces over the opening, at that end, cover its width */
            const x = [f.ro.u0, f.ro.u1].map((u) => fr.run.w.cx + fr.run.w.ax[0] * u), x0 = Math.min(...x), x1 = Math.max(...x);
            const zEnd = fr.run.w.at;
            const iv = G.solidsOf(gf, "gable").filter((so) => so.min[1] >= f.ro.y1 - 0.01 && so.max[0] > x0 && so.min[0] < x1 && Math.abs((so.min[2] + so.max[2]) / 2 - zEnd) < 0.5)
              .map((so) => [so.min[0], so.max[0]])
              /* (a crowded opening framed as one keeps its top plates over a
                 door in it that stops under them: those span it too) */
              .concat(ms.filter((m) => m.kind === "top-plate").map((m) => [m.meta.at.u0, m.meta.at.u1].map((u) => fr.run.w.cx + fr.run.w.ax[0] * u)).map(([a, b]) => [Math.min(a, b), Math.max(a, b)]))
              .sort((a, b) => a[0] - b[0]);
            let reach = x0;
            for (const [a, b] of iv) if (a <= reach + 0.01) reach = Math.max(reach, b);
            ok("a door reaching through the top plates has its header, or the roof framing, spanning it in the gable", reach >= x1 - 0.01, `${where} ${fr.run.key} ${f.id}`);
          } else {
            /* (the roof framing is not built here: the plates must at least be
               cut round the doors in it that rise into the gable) */
            const rising = f.parts.filter((p) => p.carried).map((p) => [Math.max(p.ro.u0, f.ro.u0), Math.min(p.ro.u1, f.ro.u1)]);
            ok("a door reaching through the top plates has the top plates cut round it", rising.length > 0 && !ms.some((m) => m.kind === "top-plate" && rising.some(([a, b]) => m.meta.at.u0 < b - 1e-6 && m.meta.at.u1 > a + 1e-6)), `${where} ${fr.run.key} ${f.id}`);
          }
        } else ok("every opening has a header (or the top plate right over it where not even a flat 2x fits)", hdr || plateOver, `${where} ${fr.run.key} ${f.id}`);
        if (f.win) {
          const sillOk = mine.some((m) => m.kind === "sill") || f.ro.y0 - f.sillBot <= 0.01;
          ok("every window has its rough sill", sillOk, `${where} ${fr.run.key} ${f.id}`);
          if (f.sillBot - fr.yPT >= 0.05) ok("every window has cripples under its sill", ms.some((m) => m.kind === "cripple" && m.meta.at.y1 <= f.sillBot + 1e-9 && m.meta.at.u0 >= f.ro.u0 - 1e-9 && m.meta.at.u1 <= f.ro.u1 + 1e-9), `${where} ${fr.run.key} ${f.id}`);
        }
      }
      /* studs: every layout stud (or cripple cut from one) is on the layout, and no bay is wider than the spacing but across an opening */
      const s = spec.spacing;
      ok("the stud spacing is walls.spacingIn", Math.abs(s - (plan.construction.walls.spacingIn / 12)) < 1e-12, where);
      for (const m of ms) {
        if (m.meta.layout == null) continue;
        tally.studs++;
        const u = (m.meta.at.u0 + m.meta.at.u1) / 2;
        ok("every layout stud stands on its mark, walls.spacingIn on centre from the corner", Math.abs(u - (m.meta.origin + m.meta.layout * s)) < 1e-9 && Math.abs(m.meta.spacing - s) < 1e-12, `${where} ${fr.run.key} ${u}`);
      }
      const verts = ms.filter((m) => ["stud", "cripple", "king", "jack", "end-stud", "corner-stud", "mullion"].includes(m.kind));
      const lines = fr.yTB - fr.yPT > 0.8 ? [fr.yPT + 0.3, (fr.yPT + fr.yTB) / 2, fr.yTB - 0.3] : [(fr.yPT + fr.yTB) / 2];
      for (const y of lines) {
        const iv = verts.filter((m) => m.meta.at.y0 <= y && m.meta.at.y1 >= y).map((m) => [m.meta.at.u0, m.meta.at.u1]).sort((a, b) => a[0] - b[0]);
        let last = fr.run.fu0, bad = null;
        for (const [a, b] of iv.concat([[fr.run.fu1, fr.run.fu1]])) {
          if (a - last > s + 1e-6) {
            /* what is left of the bay once the openings at this height are
               taken out must be no wider than the spacing */
            let rest = [[last, a]];
            fr.frames.forEach((f) => {
              if (!(f.zone.y0 <= y + 1e-9 && Math.max(f.zone.y1, f.kingTop) >= y - 1e-9)) return;
              rest = rest.flatMap(([p, q]) => (q <= f.zone.u0 || p >= f.zone.u1) ? [[p, q]] : [[p, Math.min(q, f.zone.u0)], [Math.max(p, f.zone.u1), q]].filter(([x0, x1]) => x1 - x0 > 1e-9));
            });
            const wide = rest.find(([p, q]) => q - p > s + 1e-6);
            if (wide) bad = `${wide[0].toFixed(3)}..${wide[1].toFixed(3)} at y ${y.toFixed(2)}`;
          }
          last = Math.max(last, b);
        }
        ok("no bay between studs is wider than walls.spacingIn, except across an opening", !bad, `${where} ${fr.run.key}: ${bad}`);
      }
    }
    /* every opening on a wall that is framed was framed */
    const runKeys = new Set(WF.runs.map((r) => r.key));
    for (const it of plan.state.items) {
      const r = openingRect(it, plan);
      if (!r || r.plane !== "wall" || !runKeys.has(it.wall)) continue;
      const onRun = WF.runs.some((run) => run.key === it.wall && r.u >= run.a - 1e-9 && r.u <= run.b + 1e-9);
      if (!onRun) continue;
      ok("every door and window on a framed wall is framed", framedItems.has(it.id), `${where} ${it.wall} ${it.id} ${it.cat}`);
    }
  }

  /* 7. floor joist spacing */
  const F = floorPlanOf(plan);
  const s = F.spacing;
  ok("the floor joist spacing is floor.spacingIn", Math.abs(s - plan.construction.floor.spacingIn / 12) < 1e-12, where);
  for (const [who, ms] of [["room", membersBy["floor-frame"]], ["porch", membersBy["porch-deck-frame"]]]) {
    if (!ms) continue;
    const js = ms.filter((m) => (m.kind === "joist" || m.kind === "end-joist" || m.kind === "wall-joist") && m.meta.frame === who).sort((a, b) => a.meta.zc - b.meta.zc);
    if (!js.length) continue;
    const lay = js.filter((m) => m.meta.layout != null);
    tally.joists += js.length;
    ok("every layout floor joist is on its mark, floor.spacingIn on centre from the back end", lay.every((m, i) => m.meta.layout === i + 1 && Math.abs(m.meta.zc - (m.meta.origin + m.meta.layout * s)) < 1e-9), `${where} ${who}`);
    let worst = 0;
    for (let i = 0; i + 1 < js.length; i++) worst = Math.max(worst, (js[i + 1].meta.zc - js[i].meta.zc) - F.joist.t);
    if (who === "porch") worst = Math.max(worst, js[0].meta.zc - F.joist.t / 2 - F.porchRect.z0);
    ok("no bay between floor joists is wider than floor.spacingIn", worst <= s + 1e-6, `${where} ${who}: ${worst.toFixed(3)} ft`);
  }
  if (B.pair && membersBy["floor-frame"]) {
    const key = B.tag.split(" ").slice(0, 3).join(" ");
    const e = joistPairs.get(key) || {};
    e[B.pair] = { n: membersBy["floor-frame"].filter((m) => m.kind === "joist").length, s: F.spacing, layers: F.layers,
      sheetLayers: new Set((membersBy["floor-deck"] || []).map((m) => m.meta.layer)).size };
    joistPairs.set(key, e);
  }

  /* 8. foundation */
  if (membersBy.foundation) {
    const ms = membersBy.foundation, site = plan.construction.site;
    const blocks = ms.filter((m) => m.kind === "block"), anchors = ms.filter((m) => m.kind === "anchor-head");
    tally.blocks += blocks.length; tally.anchors += anchors.length;
    ok("at least one block per site.perimeterFtPerBlock ft of outside wall", blocks.length >= Math.ceil(2 * (plan.W + plan.L) / site.perimeterFtPerBlock - 1e-9), `${where}: ${blocks.length}`);
    const runs = skidRuns(plan);
    ok("every skid has blocks, one flush with each end of the building", runs.every((sk, i) => {
      const bs = blocks.filter((b) => b.meta.skid === i).map((b) => G.solidsOf([b], "x")[0]);
      return bs.length >= 2 && bs.some((b) => Math.abs(b.min[2] + plan.L / 2) < 1e-6) && bs.some((b) => Math.abs(b.max[2] - plan.L / 2) < 1e-6);
    }), where);
    ok("site.anchors ground anchors", anchors.length === Math.round(site.anchors), `${where}: ${anchors.length} of ${site.anchors}`);
  }

  /* 9. decking */
  if (membersBy["floor-deck"]) {
    const ms = membersBy["floor-deck"];
    tally.sheets += ms.length;
    for (let layer = 1; layer <= F.layers; layer++) {
      const area = ms.filter((m) => m.meta.layer === layer).reduce((a, m) => a + Math.abs(polyArea(m.poly)), 0);
      const want = Math.abs(polyArea(F.deckArea));
      ok("the floor decking covers the room (every layer, less the hairline joints)", area >= want * 0.97 && area <= want + 1e-6, `${where} layer ${layer}: ${area.toFixed(2)} of ${want.toFixed(2)} sq ft`);
    }
    ok("the decking has floor.deck.layers layers", new Set(ms.map((m) => m.meta.layer)).size === F.layers, where);
  }
  if (membersBy["porch-deck-frame"]) {
    const boards = membersBy["porch-deck-frame"].filter((m) => m.kind === "deck-board");
    tally.boards += boards.length;
    const area = boards.reduce((a, m) => a + Math.abs(polyArea(m.poly)), 0), want = F.porches.reduce((a, P) => a + Math.abs(polyArea(P)), 0);
    ok("the deck boards cover every porch deck (less the gaps between boards)", area >= want * 0.9 && area <= want + 1e-6, `${where}: ${area.toFixed(2)} of ${want.toFixed(2)} sq ft`);
  }
  if (membersBy.interior) {
    const ms = membersBy.interior;
    tally.interior += ms.length;
    const C = clearOutline(plan);
    const R = G.regionOf(plan);
    ok("everything inside stands in the room, inside the studs", G.solidsOf(ms, "interior").every((so) => so.verts.every((v) => R.inRoom(v[0], v[2], 0.01))), where);
    ok("the inside is built at all when there is room", C.length >= 3, where);
  }

  /* 10. the ramp */
  const rampTris = partTriangles(rF.build, "ramp");
  const len = rampLength(plan);
  if (B.state.ramp && B.state.ramp !== "none") {
    if (len > 0) {
      tally.ramps++;
      const ms = rampMembers(plan), site = rampSite(plan);
      const expect = ms.reduce((a, m) => a + triCountOf(m), 0);
      ok("a chosen ramp is drawn in the finished building, exactly its pieces", rampTris.n > 0 && rampTris.n === expect, `${where}: drawn ${rampTris.n}, listed ${expect}`);
      ok("the ramp is drawn in the ramp step only", [...rampTris.stages].every((x) => x === STAGE_ID.ramp), where);
      const sol = G.solidsOf(ms, "ramp");
      const top = Math.max(...sol.map((x) => x.max[1])), bottom = Math.min(...sol.map((x) => x.min[1]));
      ok("the ramp's top is the floor line at the building", Math.abs(top - y0) < 0.01, `${where}: ${top.toFixed(3)}`);
      ok("the ramp comes down to the ground", bottom <= 0.01 && bottom > -0.2, `${where}: ${bottom.toFixed(3)}`);
      const w = site.w, n2 = [w.n[0], w.n[2]];
      /* how far out from the wall line the ramp reaches (o, along the wall's outward normal) */
      const reach = Math.max(...sol.flatMap((x) => x.verts.map((v) =>
        w.ox !== undefined ? (v[0] - w.ox) * n2[0] + (v[2] - w.oz) * n2[1] : (w.n[2] !== 0 ? (v[2] - w.at) * w.n[2] : (v[0] - w.at) * w.n[0]))));
      /* the top of the boards meets the ground as long as chosen; the last
         board's lower corner lies past that by at most its own thickness */
      ok("the ramp is as long as the one chosen", reach >= site.start + len - 0.01 && reach <= site.start + len + 0.06, `${where}: reaches ${reach.toFixed(3)}, wants ${(site.start + len).toFixed(3)}`);
      ok("the ramp has at least two stringers", ms.filter((m) => m.kind === "stringer").length >= 2, where);
      /* it cuts into nothing of the finished building -- except that a 4 ft
         ramp on a side porch is steep enough to touch the top corner of
         Barnwright's two-step stair it is laid over (the stringers are
         notched to sit on it; the step is Barnwright's and stays): that one
         contact is held to at most 0.06 ft (3/4 in) and counted apart */
      let worstCut = 0, cutWhat = "", stepCut = 0;
      const W2 = plan.W / 2, stepZ = site.step ? -site.u : null, stepTop = site.step ? Math.max(...SIDE_STEP.map((b) => b.y1)) : 0;
      function onStep(tri) {
        return site.step && tri.every((p) => p[0] >= W2 - 1e-6 && p[0] <= W2 + Math.max(...SIDE_STEP.map((b) => b.o1)) + 1e-6 && p[1] <= stepTop + 1e-6 && Math.abs(p[2] - stepZ) <= SIDE_STEP[0].along / 2 + 1e-6);
      }
      const lo = [0, 1, 2].map((i) => Math.min(...sol.map((x) => x.min[i]))), hi = [0, 1, 2].map((i) => Math.max(...sol.map((x) => x.max[i])));
      for (const key of rF.build.ORDER) {
        const bk = rF.build.buckets[key];
        for (const seg of rF.build.tags[key] || []) {
          if (seg.part === "ramp" || seg.part === "ground") continue;
          for (let ti = seg.from; ti < seg.from + seg.count; ti++) {
            const o = ti * 27, tri = [0, 1, 2].map((v) => [bk.v[o + v * 9], bk.v[o + v * 9 + 1], bk.v[o + v * 9 + 2]]);
            if ([0, 1, 2].some((i) => Math.max(tri[0][i], tri[1][i], tri[2][i]) < lo[i] || Math.min(tri[0][i], tri[1][i], tri[2][i]) > hi[i])) continue;
            for (const S of sol) {
              if ([0, 1, 2].some((i) => Math.max(tri[0][i], tri[1][i], tri[2][i]) < S.min[i] || Math.min(tri[0][i], tri[1][i], tri[2][i]) > S.max[i])) continue;
              const d = G.triangleSolidDepth(tri, S);
              if (seg.part === "porch" && onStep(tri)) { if (d > stepCut) stepCut = d; continue; }
              if (d > worstCut) { worstCut = d; cutWhat = `${seg.part} (${key})`; }
            }
          }
        }
      }
      ok("the ramp cuts into nothing of the finished building", worstCut <= G.TOL, `${where}: ${cutWhat} by ${worstCut.toFixed(3)} ft`);
      if (site.step) { tally.stepRamps++; tally.stepCut = Math.max(tally.stepCut, stepCut); ok("a side porch's ramp sits on Barnwright's step, touching its top corner by no more than 0.06 ft", stepCut <= 0.06, `${where}: ${stepCut.toFixed(3)} ft`); }
    } else {
      ok("the DIY ramp kit (no wood) draws no ramp", rampTris.n === 0, where);
    }
  } else ok("no ramp is drawn when none is chosen", rampTris.n === 0, where);
}

/* 7b. 12 in joists and the double floor */
let pairsSeen = 0;
for (const [key, e] of joistPairs) {
  if (!e.std || !e["12"]) continue;
  pairsSeen++;
  ok("choosing 12 in floor joists puts them 12 in apart", Math.abs(e["12"].s - 1) < 1e-12 && Math.abs(e.std.s - 16 / 12) < 1e-12, key);
  ok("choosing 12 in floor joists adds joists", e["12"].n > e.std.n, `${key}: ${e.std.n} -> ${e["12"].n}`);
  ok("choosing a double floor lays a second layer of decking", e["12"].layers === 2 && e["12"].sheetLayers === 2 && e.std.sheetLayers === 1, key);
}
ok("the 12 in joist option was tried on some building", pairsSeen > 0, "no building offers it");

/* ------------------------------------------------------------------- report */
if (failures.size) {
  console.log(`FAIL: ${fail} of ${pass + fail} framing checks failed:`);
  for (const [what, f] of failures) console.log(`  - ${what} -- ${f.n} time(s), e.g. ${f.where.join(" | ")}`);
  process.exitCode = 1;
} else {
  console.log(`PROVED (${pass} checks) on ${tally.buildings} buildings (the 148 golden ones, and every style at every size of the Barnwright, demo and starter catalogues, with porch, electrical, bench, shelf, option and ramp variants; ${tally.hard} of the hardest a customer can make; ${tally.ways} built the way other companies build):`);
  console.log(`  drawing the framing changes no finished triangle or material, and every framing triangle is a framing part's, in its own stages;`);
  console.log(`  every one of ${tally.members} framing pieces is drawn exactly as listed, stands where framing can stand (under the floor inside the footprint, inside the walls, under the roof), overlaps no other piece or skid by more than ${G.TOL} ft, and rests on or is nailed to what carries it;`);
  console.log(`  ${tally.openings} door/window framings each have jacks, kings (or a corner or neighbour doing that job) and a header, windows a sill and cripples (${tally.shared} share a stud with a neighbour, ${tally.combined} crowded openings framed as one, ${tally.clipped} wider than their wall framed as wide as it allows, ${tally.through} doors reaching through the top plates into the gable);`);
  console.log(`  ${tally.headers} headers each the walls.header rule's size for its span, or the deepest that fits under what it carries (${tally.fitted} fitted a size down), none with a gap under what it carries (${tally.lifted} set tight up under it), and every shared stud carrying both headers;`);
  console.log(`  ${tally.studs} layout studs on their walls.spacingIn marks and ${tally.joists} floor joists on their floor.spacingIn marks with no wider bay; 12 in joists tried on ${pairsSeen} buildings (closer and more of them, and the double floor's second layer);`);
  console.log(`  ${tally.blocks} blocks (at least one per site.perimeterFtPerBlock ft of wall, one at each end of the building on every skid) and ${tally.anchors} anchors (site.anchors); the decking covers every room (${tally.sheets} sheets) and deck boards every porch (${tally.boards}); ${tally.interior} inside pieces all inside the studs;`);
  console.log(`  ${tally.ramps} chosen ramps drawn in the finished view from the floor line to the ground, as long as chosen, cutting into nothing of the finished building (${tally.stepRamps} on side porches sit on Barnwright's step, touching its top corner by at most ${tally.stepCut.toFixed(3)} ft); none for "no ramp" or the DIY kit.`);
  if (tally.roofParts.size) console.log(`  Roof framing parts held to the same rules: ${[...tally.roofParts].join(", ")}.`);
  if (tally.pending.size) console.log(`  Still stubs (nothing drawn yet, so nothing to check): ${[...tally.pending].join(", ")}.`);
  if (onlyMine) console.log(`  (--mine: only ${MINE_PARTS.join(", ")} were checked.)`);
}
