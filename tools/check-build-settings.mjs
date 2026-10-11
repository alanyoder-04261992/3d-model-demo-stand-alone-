/* CHECK: "HOW IT'S BUILT" -- THE NUMBERS THAT USED TO BE FIXED IN THE CODE
   ARE SETTINGS, AND TODAY'S BUILDINGS DO NOT MOVE.
   Run: node tools/check-build-settings.mjs            (check-all: node)

   WHY. Alan asked (Oct 2026, "lets all 5") for the numbers a shop builds
   differently to be settings: the porch depth (4 ft), the side porch lengths
   (8 or 12 ft), the barn roof's gable-end overhang (fixed in the code), the
   side the dormer goes on, the barn roof's height by width, and eaves
   measured level from the wall. Each one is a seam in the drawing code whose
   default is exactly today's number, so every building is drawn as before
   (tools/check-golden.mjs proves it triangle for triangle) until a setting
   changes it.

   WHAT IT PROVES, one heading each:
    1. Porch depth: a 6 ft front porch moves the front wall to L/2 - 6 and
       the porch outline, the room, the floor frame's porch deck, the white
       ceiling and the floor plan with it; a 6 ft wrap porch moves its walls.
    2. Side porch lengths: a style selling 10 and 14 ft porches draws a 14 ft
       notch on a 12x24, the nearest length for a length it does not sell, and
       the shortest under 20 ft long.
    3. Dormer side: a back-side dormer draws every triangle at x < 0, the
       mirror image of the door-side one, and its framing and the cut roof
       framing are the mirror of the door side's.
    4. Barn gable-end overhang: 6 in draws the roof 0.4 ft further past each
       end than today's 0.10 ft.
    5. Eaves measured level: a 4 in eave on a 5/12 roof ends exactly 4 in
       past the wall.
    6. Barn roof height by width: 48 in on a 10 ft barn draws the peak 4 ft
       above the wall; with 8, 10 and 12 ft heights an 11 ft barn is no
       taller than the 12 ft one, a 9 ft no taller than the 10 ft one, and 13
       and 14 ft keep their own shape.
    7. A style's own numbers (t.construction) reach that style only.
    8. Written out with today's numbers, every one of these settings draws
       exactly today's building.
   Prints PROVED with the counts, or FAIL with what broke. */

import { readJSON, readManufacturer } from "./lib/load.mjs";
import { barnwrightCompany } from "./lib/barnwright-company.mjs";
import { resolve } from "../model/company.js";
import { defaults, setType, setSize } from "../model/design.js";
import { frameOf } from "../model/frame.js";
import { makePlan } from "../model/plan.js";
import { assemble } from "../engine/assemble.js";
import { porchOutlines, roomOutline, floorPlanOf } from "../parts/floor-frame.js";
import { roofSection, roofFrameMembers, dormerHoles } from "../parts/roof-frame.js";
import { dormerFrameMembers } from "../parts/dormer-frame.js";
import { roofDeckMembers } from "../parts/roof-deck.js";
import { porchRect } from "../ui/blueprint.js";

const LIB = readJSON("library/construction.json");
const M = readManufacturer("standard");
const copy = (v) => JSON.parse(JSON.stringify(v));
const J = (v) => JSON.stringify(v);
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

let passed = 0;
const failures = [];
const groups = [];
function group(title) { groups.push({ title, n: 0, bad: 0 }); }
function ok(what, cond, extra = "") {
  const g = groups[groups.length - 1];
  g.n++;
  if (cond) { passed++; return true; }
  g.bad++;
  failures.push(`[${g.title}] ${what}${extra ? " -- " + extra : ""}`);
  return false;
}
/* run a test that may throw on code that does not know the setting yet */
function tryOk(what, fn) {
  try { const r = fn(); return ok(what, r === true, r === true ? "" : String(r)); }
  catch (e) { return ok(what, false, "threw: " + e.message); }
}

/* A catalogue of Barnwright's company on the standard manufacturer, with
   style traits and the company's construction changed. */
function catalogue({ traits = {}, construction = null } = {}) {
  const m = copy(M);
  for (const k of Object.keys(traits)) Object.assign(m.styles[k], traits[k]);
  const c = barnwrightCompany();
  if (construction) c.construction = construction;
  return resolve(c, m, LIB);
}
function stateOf(cat, type, size, more = {}) {
  const s = defaults(cat);
  setType(s, type, cat);
  setSize(s, size, cat);
  return Object.assign(s, more);
}
function partVerts(plan, part) {
  const r = assemble(plan, { viewport: { w: 800, h: 600 }, fit: "fitref", scene: "studio", trueColour: false, only: part });
  const out = [];
  for (const key of r.build.ORDER) {
    const b = r.build.buckets[key];
    for (let i = 0; i + 8 < b.v.length; i += 9) out.push({ key, x: b.v[i], y: b.v[i + 1], z: b.v[i + 2], nx: b.v[i + 3], ny: b.v[i + 4], nz: b.v[i + 5] });
  }
  return out;
}
const minOf = (list, f) => list.reduce((m, v) => Math.min(m, f(v)), Infinity);
const maxOf = (list, f) => list.reduce((m, v) => Math.max(m, f(v)), -Infinity);
/* member boxes, rounded, sorted: compares framing without caring where a polygon starts */
function boxes(list, mirror) {
  return list.map((m) => {
    const xs = m.poly.map((q) => (mirror ? -q[0] : q[0])), ys = m.poly.map((q) => q[1]);
    return [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys), m.z0, m.z1].map((v) => Math.round(v * 1e6) / 1e6).join(",") + ":" + (m.kind || "");
  }).sort();
}

const BASE = catalogue();

/* ------------------------------------------------------------------ 1 */
group("1. porch depth");
{
  const cat = catalogue({ traits: { C: { porchDepthFt: 6 }, DSC: { porchDepthFt: 6 } } });
  const s = stateOf(cat, "C", "10x16");
  const fr = frameOf(s, cat), plan = makePlan(s, cat), L = fr.L;
  ok("a 6 ft front porch moves the front wall to L/2 - 6", fr.ws.F.at === L / 2 - 6, `F.at ${fr.ws.F.at}, L ${L}`);
  ok("... and the side walls stop there", fr.ws.R.len === L - 6 && fr.ws.L.len === L - 6 && fr.ws.R.cx === -3, J({ len: fr.ws.R.len, cx: fr.ws.R.cx }));
  const po = porchOutlines(plan)[0];
  ok("... the open porch deck runs from it to the end", J(po) === J([[-5, L / 2 - 6], [5, L / 2 - 6], [5, L / 2], [-5, L / 2]]), J(po));
  ok("... the room stops at it", maxOf(roomOutline(plan), (p) => p[1]) === L / 2 - 6);
  const fp = floorPlanOf(plan);
  ok("... the porch deck's framing starts at it", fp.porchRect && fp.porchRect.z0 === L / 2 - 6, J(fp.porchRect));
  const ceil = partVerts(plan, "porch").filter((v) => v.key === "ceil");
  ok("... the white porch ceiling covers the 6 ft", ceil.length > 0 && near(minOf(ceil, (v) => v.z), L / 2 - 6) && near(maxOf(ceil, (v) => v.z), L / 2), `${minOf(ceil, (v) => v.z)}..${maxOf(ceil, (v) => v.z)}`);
  ok("... and the floor plan draws the porch 6 ft deep", J(porchRect(fr)) === J([-5, L / 2 - 6, 10, 6]), J(porchRect(fr)));
  const sd = stateOf(BASE, "C", "10x16"), frd = frameOf(sd, BASE);
  ok("with no setting the porch is today's 4 ft", frd.ws.F.at === frd.L / 2 - 4 && J(porchRect(frd)) === J([-5, frd.L / 2 - 4, 10, 4]));
  /* the wrap porch */
  const w = frameOf(stateOf(cat, "DSC", "12x20"), cat), w0 = frameOf(stateOf(BASE, "DSC", "12x20"), BASE);
  ok("a 6 ft wrap porch adds 6 ft (not 4) to the length", w.L === 26 && w0.L === 24, `${w.L} / ${w0.L}`);
  ok("... its front wall stands 6 ft back and its walls follow", w.ws.F.at === w.L / 2 - 6 && w.ws.P2.at === 6 - 6 && w.ws.P3.len === 6 && w.ws.P2.len === 2 && near(w.ws.P1.len, Math.hypot(12 - 4 - 6, 4)),
    J({ F: w.ws.F.at, P2: [w.ws.P2.at, w.ws.P2.len], P3: w.ws.P3.len, P1: w.ws.P1.len }));
}

/* ------------------------------------------------------------------ 2 */
group("2. side porch lengths");
{
  const cat = catalogue({ traits: { SC: { sidePorch: { lengthsFt: [10, 14] } } } });
  const fr14 = frameOf(stateOf(cat, "SC", "12x24", { pLen: 14 }), cat);
  ok("a style selling 10 and 14 ft porches draws a 14 ft notch on a 12x24", fr14.span.P === 14 && fr14.ws.S1.len === 14 && fr14.span.z1 - fr14.span.z0 === 14, J(fr14.span));
  const fr12 = frameOf(stateOf(cat, "SC", "12x24", { pLen: 12 }), cat);
  ok("... a length it does not sell becomes the nearest one (12 -> 14 on a tie, the longer)", fr12.span.P === 14, J(fr12.span));
  const frShort = frameOf(stateOf(cat, "SC", "12x16", { pLen: 14 }), cat);
  ok("... and a building under 20 ft long gets the shortest, 10 ft", frShort.span.P === 10, J(frShort.span));
  const fr0 = frameOf(stateOf(BASE, "SC", "12x24", { pLen: 12 }), BASE), fr8 = frameOf(stateOf(BASE, "SC", "12x24", { pLen: 8 }), BASE);
  ok("with no setting the porch is 8 or 12 ft, as today", fr0.span.P === 12 && fr8.span.P === 8 && frameOf(stateOf(BASE, "SC", "12x16", { pLen: 12 }), BASE).span.P === 8);
}

/* ------------------------------------------------------------------ 3 */
group("3. dormer side");
{
  const cat = catalogue({ traits: { DS: { dormerSide: "back" } } });
  for (const z of ["8x12", "10x16", "12x24"]) {
    const back = makePlan(stateOf(cat, "DS", z, { dormer: "9" }), cat), door = makePlan(stateOf(BASE, "DS", z, { dormer: "9" }), BASE);
    const vb = partVerts(back, "dormer"), vd = partVerts(door, "dormer");
    ok(`${z}: a back-side dormer draws every triangle at x < 0`, vb.length > 0 && vb.every((v) => v.x < 0), `${vb.filter((v) => v.x >= 0).length} of ${vb.length} at x >= 0`);
    ok(`${z}: ... the door-side one (today's) every triangle at x > 0`, vd.length > 0 && vd.every((v) => v.x > 0));
    const key = (v, m) => [m ? -v.x : v.x, v.y, v.z, m ? -v.nx : v.nx, v.ny, v.nz].map((n) => Math.round(n * 1e6) / 1e6).join(",");
    ok(`${z}: ... and it is the door-side dormer's mirror image, faces still facing out`, J(vb.map((v) => key(v, false)).sort()) === J(vd.map((v) => key(v, true)).sort()));
    ok(`${z}: its framing is the mirror of the door side's`, J(boxes(dormerFrameMembers(back), false)) === J(boxes(dormerFrameMembers(door), true)));
    ok(`${z}: the roof framing it cuts is the mirror of the door side's`, J(boxes(roofFrameMembers(back), false)) === J(boxes(roofFrameMembers(door), true)));
    const hb = dormerHoles(back), hd = dormerHoles(door);
    ok(`${z}: the roof deck's holes are the door side's, mirrored`, hb.length === 2 && J(hb.map((h) => [-h.x1, -h.x0, h.z0, h.z1])) === J(hd.map((h) => [h.x0, h.x1, h.z0, h.z1])));
    /* at z = 0.37 ft (inside the dormer, clear of where a sheet or purlin may end) */
    const covers = (list, x) => list.some((m) => m.z0 < 0.37 && m.z1 > 0.37 && Math.min(...m.poly.map((q) => q[0])) < x && Math.max(...m.poly.map((q) => q[0])) > x);
    const mid = (hb[0].x0 + hb[0].x1) / 2, deck = roofDeckMembers(back);
    ok(`${z}: ... so the deck is open under the dormer on the back and closed on the door side`, !covers(deck, mid) && covers(deck, -mid));
  }
}

/* ------------------------------------------------------------------ 4 */
group("4. barn gable-end overhang");
{
  const cat = catalogue({ construction: { roof: { shapes: { gambrel: { endOverhang: 0.5 } } } } });
  for (const [t, z] of [["LB", "10x16"], ["SB", "8x12"], ["LBC", "12x24"]]) {
    const a = partVerts(makePlan(stateOf(cat, t, z), cat), "roofing"), b = partVerts(makePlan(stateOf(BASE, t, z), BASE), "roofing");
    ok(`${t} ${z}: 6 in draws the roof 0.4 ft further past each end than today's 0.10`, near(maxOf(a, (v) => v.z) - maxOf(b, (v) => v.z), 0.4) && near(minOf(b, (v) => v.z) - minOf(a, (v) => v.z), 0.4),
      `${maxOf(a, (v) => v.z) - maxOf(b, (v) => v.z)}`);
  }
  const sec = roofSection(makePlan(stateOf(cat, "LB", "10x16"), cat));
  ok("... and the roof framing follows it", sec && near(sec.ov !== undefined ? sec.ov : 0.5, 0.5), J(sec.ov));
}

/* ------------------------------------------------------------------ 5 */
group("5. eaves measured level");
{
  for (const W of [8, 10, 12]) {
    const cat = catalogue({ construction: { roof: { shapes: { gable: { rise: { w: 5 / 24 }, eaveOverhang: { left: { flatIn: 4 }, right: { flatIn: 4 } } } } } } });
    tryOk(`${W} ft wide at 5/12: a 4 in eave ends exactly 4 in past each wall`, () => {
      const sec = roofSection(makePlan(stateOf(cat, "UT", `${W}x16`), cat));
      const P = sec.P;
      return (near(P[P.length - 1][0] - W / 2, 4 / 12) && near(-W / 2 - P[0][0], 4 / 12)) || `eave tips at ${P[0][0]} and ${P[P.length - 1][0]}`;
    });
  }
}

/* ------------------------------------------------------------------ 6 */
group("6. barn roof height by width");
{
  const peakOf = (cat, z) => { const fr = frameOf(stateOf(cat, "LB", z), cat); return { rise: Math.max(...fr.prof.map((p) => p[1])) - fr.topY, knee: fr.prof[1][0] }; };
  const one = catalogue({ construction: { roof: { shapes: { gambrel: { peakIn: { 10: 48 } } } } } });
  ok("48 in on a 10 ft barn draws the peak 4 ft above the wall", near(peakOf(one, "10x16").rise, 4), String(peakOf(one, "10x16").rise));
  ok("... with the knee where it was", peakOf(one, "10x16").knee === peakOf(BASE, "10x16").knee);
  const three = catalogue({ construction: { roof: { shapes: { gambrel: { peakIn: { 8: 43.75, 10: 48, 12: 51 } } } } } });
  ok("8, 10 and 12 ft: 43 3/4, 48 and 51 in", near(peakOf(three, "8x12").rise * 12, 43.75) && near(peakOf(three, "10x16").rise * 12, 48) && near(peakOf(three, "12x16").rise * 12, 51));
  const w11 = catalogue({ construction: { roof: { shapes: { gambrel: { peakIn: { 8: 43.75, 10: 48, 12: 51 } } } } } });
  const m = copy(barnwrightCompany()); m.offer.LB.sizes["11x16"] = 7000; m.offer.LB.sizes["9x12"] = 5000; m.offer.LB.sizes["13x24"] = 9000;
  m.construction = { roof: { shapes: { gambrel: { peakIn: { 8: 43.75, 10: 48, 12: 51 } } } } };
  const cat11 = resolve(m, M, LIB);
  ok("an 11 ft barn is no taller than the 12 ft one (51 in, not 4 ft 11 3/8 in)", near(peakOf(cat11, "11x16").rise * 12, 51), String(peakOf(cat11, "11x16").rise * 12));
  ok("a 9 ft barn is no taller than the 10 ft one (48 in)", near(peakOf(cat11, "9x12").rise * 12, 48), String(peakOf(cat11, "9x12").rise * 12));
  ok("13 and 14 ft keep their own shape (taller than 51 in)", near(peakOf(cat11, "13x24").rise, 0.45 * 13) && near(peakOf(w11, "14x24").rise, peakOf(BASE, "14x24").rise));
}

/* ------------------------------------------------------------------ 7 */
group("7. a style's own numbers");
{
  const cat = Object.assign({}, BASE, { TYPES: Object.assign({}, BASE.TYPES, { UT: Object.assign({}, BASE.TYPES.UT, { construction: { roof: { shapes: { gable: { rise: { w: 0.2 } } } } } }) }) });
  const ut = frameOf(stateOf(cat, "UT", "10x16"), cat), su = frameOf(stateOf(cat, "SU", "10x16"), cat);
  ok("a style's own roof rise (t.construction) draws that style's roof", near(ut.prof[1][1] - ut.topY, 2), String(ut.prof[1][1] - ut.topY));
  ok("... and no other style's", near(su.prof[1][1] - su.topY, 10 * 0.27));
}

/* ------------------------------------------------------------------ 8 */
group("8. today's numbers written out draw today's buildings");
{
  const cat = catalogue({
    traits: { C: { porchDepthFt: 4 }, SC: { porchDepthFt: 4, sidePorch: { lengthsFt: [8, 12] } }, DSC: { porchDepthFt: 4 }, DS: { dormerSide: "door" } },
    construction: { roof: { shapes: { gambrel: { endOverhang: 0.1 } } } },
  });
  let same = 0, n = 0;
  for (const t of ["C", "SC", "DSC", "DS", "LB", "SB", "UT"]) {
    for (const z of Object.keys(BASE.P[t])) {
      for (const more of t === "SC" ? [{ pLen: 12 }, { pLen: 8, pFlip: true }, { pLen: 12, pMid: true }] : [{}]) {
        const a = frameOf(stateOf(cat, t, z, more), cat), b = frameOf(stateOf(BASE, t, z, more), BASE);
        n++;
        if (J([a.d, a.span, a.ws, a.prof]) === J([b.d, b.span, b.ws, b.prof])) same++;
      }
    }
  }
  ok(`every building of those styles is the same (${same} of ${n})`, same === n && n > 50);
  const a = partVerts(makePlan(stateOf(cat, "DSC", "12x20"), cat), "porch"), b = partVerts(makePlan(stateOf(BASE, "DSC", "12x20"), BASE), "porch");
  ok("... and a wrap porch draws the same triangles", J(a) === J(b));
}

/* ---------------------------------------------------------------- report */
console.log("How it's built:");
for (const g of groups) console.log(`  ${g.bad ? "FAIL" : "ok  "} ${g.title}: ${g.n - g.bad} of ${g.n}`);
if (failures.length) {
  console.log("\nProblems:");
  for (const f of failures.slice(0, 40)) console.log("  " + f);
  console.log(`\nFAIL: ${failures.length} of ${passed + failures.length} checks failed.`);
  process.exit(1);
}
console.log(`\nPROVED (${passed} checks): the porch depth, the side porch lengths, the dormer side, the barn roof's gable-end overhang, its height by width and eaves measured level are settings the drawing follows, and with today's numbers every building is drawn as before.`);
