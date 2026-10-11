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
       framing are the mirror of the door side's; the every-size check finds
       none of its framing outside where framing may stand.
    4. Barn gable-end overhang: 6 in draws the roof 0.4 ft further past each
       end than today's 0.10 ft, and the every-size check follows it.
    5. Eaves measured level: a 4 in eave on a 5/12 roof ends exactly 4 in
       past the wall.
    6. Barn roof height by width: 48 in on a 10 ft barn draws the peak 4 ft
       above the wall; with 8, 10 and 12 ft heights an 11 ft barn is no
       taller than the 12 ft one, a 9 ft no taller than the 10 ft one, and 13
       and 14 ft keep their own shape.
    7. A style's own numbers (t.construction) reach that style only.
    8. Written out with today's numbers, every one of these settings draws
       exactly today's building.
    9. What a person types ("5/12", "7 ft 9 1/2 in") is read, written back
       and, when wrong, said in plain words.
   10. Which number wins: style, built-like base, business-wide, shop
       standard, library; style features; extras only steepen a roof; the
       setup connector's rule list lifts to the same roof.
   11. Problems, the screens' numbers and History words.
   12. An extra's construction settings: a How it's built number set there
       (it used to be copied in unchecked), a typo or a value that cannot be
       built is a problem on save, never on read, and is not drawn; a good
       one still works; a builder's option is held to the same rule.
   13. The shop standard (Oct 2026, "yes match"; BUILDFAST-SPEC E.2, E.3):
       the demo company -- like every company on the standard manufacturer --
       draws Alan's shop numbers: a Utility Shed or Side Utility 10x16 roof
       rises 25 in above its 93 1/2 in walls (5/12) and its eave ends 4 in
       past the wall; Lofted Barn and Side Lofted Barn walls are 79 1/2 in
       and their barn roofs 43 3/4, 48 and 51 in tall at 8, 10 and 12 ft
       wide; an 11 ft barn is no taller than 51 in; the 14 ft barn, the
       Garage, the Dormer Shed and every other style are exactly Barnwright's;
       Barnwright's own company keeps 6.48/12; the screens say "5/12" from
       "standard"; and every style still passes the every-size check.
   Prints PROVED with the counts, or FAIL with what broke. */

import { readJSON, loadCatalogue } from "./lib/load.mjs";
import { barnwrightCompany, barnwrightManufacturer, barnwrightCatalogue, standardManufacturer } from "./lib/barnwright-company.mjs";
import { resolve, validate, validateManufacturer, strictProblems } from "../model/company.js";
import * as BUILT from "../model/build-settings.js";
import { gableEndOverhangOf } from "../parts/roofing.js";
import { defaults, setType, setSize } from "../model/design.js";
import { frameOf } from "../model/frame.js";
import { makePlan } from "../model/plan.js";
import { assemble } from "../engine/assemble.js";
import { porchOutlines, roomOutline, floorPlanOf } from "../parts/floor-frame.js";
import { roofSection, roofFrameMembers, dormerHoles } from "../parts/roof-frame.js";
import { dormerFrameMembers } from "../parts/dormer-frame.js";
import { roofDeckMembers } from "../parts/roof-deck.js";
import { porchRect } from "../ui/blueprint.js";
import { constructionFor } from "../model/construction.js";
import { checkStyle } from "../model/style-check.js";
import { barnTrussPeakFt, roofRise } from "../model/roof-shapes.js";

const LIB = readJSON("library/construction.json");
/* Barnwright's own numbers (the standard manufacturer without the shop
   standard's built blocks): every seam is proved against them, and the
   shop standard layer is built by hand where a test needs one (MS). */
const M = barnwrightManufacturer();
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
const gableEndOf = (plan) => gableEndOverhangOf(plan);

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
  /* a porch as long as the building (review GL-1, F1): never offered, and
     a length that would be is a problem in words, never a save that runs
     until the computer is out of memory */
  const long = catalogue({ traits: { SC: { sidePorch: { lengthsFt: [12, 20] } } } });
  ok("a 20 ft porch is never offered on a 20 ft long building (4 ft of side wall at least): it gets the 12", frameOf(stateOf(long, "SC", "12x20", { pLen: 20 }), long).span.P === 12
    && frameOf(stateOf(long, "SC", "12x24", { pLen: 20 }), long).span.P === 20);
  const c20 = barnwrightCompany(); c20.offer.SC.built = { sidePorchLengths: [12, 20] };
  ok("... and the price list says why: \"Side porch lengths: 20 ft is as long as the 10x20 Side Cabin.\"", BUILT.problems(c20, M).some((x) => x.path === "offer.SC.built.sidePorchLengths" && /^Side porch lengths: 20 ft is as long as the 10x20 Side Cabin\. Leave at least 4 ft of side wall beside the porch\.$/.test(x.words)), J(BUILT.problems(c20, M)));
  const c18 = barnwrightCompany(); c18.built = { sidePorchLengths: [8, 18] };
  ok("... 18 ft business-wide leaves the 10x20 only 2 ft of side wall", BUILT.problems(c18, M).some((x) => x.path === "built.sidePorchLengths" && x.words === "Side porch lengths: 18 ft leaves the 10x20 Side Cabin only 2 ft of side wall beside the porch (4 ft at least)."), J(BUILT.problems(c18, M)));
  const c8 = barnwrightCompany(); c8.offer.SC.sizes["10x8"] = 4000;
  ok("... and a size too short for the standard 8 ft porch is said at the porch lengths", BUILT.problems(c8, M).some((x) => x.path === "offer.SC.built.sidePorchLengths" && x.words === "The 10x8 Side Cabin is too short for its 8 ft side porch: sell it 12 ft long and up, or set a shorter side porch length."), J(BUILT.problems(c8, M)));
  ok("... the standard sizes have no such problem", !BUILT.problems(barnwrightCompany(), M).some((x) => /side porch/i.test(x.words)));
  /* the wall framing never runs away: a porch as long as the building is a
     plain problem of the every-size check */
  let framed = null;
  try { framed = checkStyle(resolve((() => { const x = barnwrightCompany(); x.offer.SC.sizes = { "10x8": 4000 }; return x; })(), M, LIB), "SC"); } catch (e) { framed = e; }
  ok("... and a 10x8 Side Cabin is checked to the end in words (\"no side wall beside it\")", framed && framed.problems && framed.problems.some((f) => /the 8 ft side porch is as long as the building, so there is no side wall beside it/.test(f.words)), framed && framed.stack);
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
  /* the every-size check's "where framing may stand" follows the dormer to
     the back (model/framing-geometry.js dormerRegion reads dormerGeom) */
  const all = checkStyle(cat, "DS");
  const outside = all.problems.filter((f) => f.code === "framing");
  ok(`the every-size check finds no framing problem on a back-side dormer (${all.buildings} buildings: every size, every dormer)`, all.buildings > 0 && outside.length === 0, outside.slice(0, 2).map((f) => f.words).join(" | "));
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
  /* the every-size check's rake (model/framing-geometry.js roofOutline reads
     gableEndOverhangOf): the roof deck out past a 6 in end is not "outside" */
  for (const t of ["LB", "SB"]) {
    const all = checkStyle(cat, t);
    const outside = all.problems.filter((f) => f.code === "framing");
    ok(`${t}: the every-size check finds no framing problem with a 6 in barn gable-end overhang (${all.buildings} buildings)`, all.buildings > 0 && outside.length === 0, outside.slice(0, 2).map((f) => f.words).join(" | "));
  }
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
  /* the barn roof height is the TRUSSES' peak above the wall (Alan: "from
     the top of the upper plate to the peak"); the roof line drawn over the
     deck stands the deck's thickness higher (review GL-5) */
  const peakOf = (cat, z) => { const fr = frameOf(stateOf(cat, "LB", z), cat); return { rise: barnTrussPeakFt(fr.W, fr.t, fr.construction), line: Math.max(...fr.prof.map((p) => p[1])) - fr.topY, knee: fr.prof[1][0] }; };
  const one = catalogue({ construction: { roof: { shapes: { gambrel: { peakIn: { 10: 48 } } } } } });
  ok("48 in on a 10 ft barn draws the trusses' peak 4 ft above the wall", near(peakOf(one, "10x16").rise, 4), String(peakOf(one, "10x16").rise));
  const plan10 = makePlan(stateOf(one, "LB", "10x16"), one);
  const trussTop = Math.max(...roofFrameMembers(plan10).flatMap((m) => (m.poly || []).map((q) => q[1])));
  ok("... the roof framing itself reaches it (its highest piece 4 ft above the wall)", near(trussTop - plan10.topY, 4, 1e-6), String((trussTop - plan10.topY) * 12));
  ok("... and the roof line over the deck stands 15/32 in higher", near(peakOf(one, "10x16").line - 4, 0.4375 / 12 / Math.cos(Math.atan2(peakOf(one, "10x16").line - (plan10.prof[1][1] - plan10.topY), -plan10.prof[1][0])), 1e-9), String((peakOf(one, "10x16").line - 4) * 12));
  ok("... with the knee where it was", peakOf(one, "10x16").knee === peakOf(BASE, "10x16").knee);
  const three = catalogue({ construction: { roof: { shapes: { gambrel: { peakIn: { 8: 43.75, 10: 48, 12: 51 } } } } } });
  ok("8, 10 and 12 ft: 43 3/4, 48 and 51 in", near(peakOf(three, "8x12").rise * 12, 43.75) && near(peakOf(three, "10x16").rise * 12, 48) && near(peakOf(three, "12x16").rise * 12, 51));
  const w11 = catalogue({ construction: { roof: { shapes: { gambrel: { peakIn: { 8: 43.75, 10: 48, 12: 51 } } } } } });
  const m = copy(barnwrightCompany()); m.offer.LB.sizes["11x16"] = 7000; m.offer.LB.sizes["9x12"] = 5000; m.offer.LB.sizes["13x24"] = 9000;
  m.construction = { roof: { shapes: { gambrel: { peakIn: { 8: 43.75, 10: 48, 12: 51 } } } } };
  const cat11 = resolve(m, M, LIB);
  ok("an 11 ft barn is no taller than the 12 ft one (51 in, not 4 ft 11 3/8 in)", near(peakOf(cat11, "11x16").rise * 12, 51), String(peakOf(cat11, "11x16").rise * 12));
  ok("a 9 ft barn is no taller than the 10 ft one (48 in)", near(peakOf(cat11, "9x12").rise * 12, 48), String(peakOf(cat11, "9x12").rise * 12));
  /* the camera and the shadow box (roofRise) take a barn roof set taller
     than Barnwright's 0.45 W, so its top is never cut off (review GL-6);
     Barnwright's own barn keeps 0.45 W */
  const tall = catalogue({ construction: { roof: { shapes: { gambrel: { peakIn: { 8: 96 } } } } } });
  const fTall = frameOf(stateOf(tall, "LB", "8x12"), tall), fBase = frameOf(stateOf(BASE, "LB", "8x12"), BASE);
  const bTall = assemble(makePlan(stateOf(tall, "LB", "8x12"), tall), { viewport: { w: 742, h: 803 }, fit: "barnwright", frames: false }).bounds;
  ok("a 96 in barn roof on an 8 ft barn: the camera's box reaches its peak", near(roofRise(8, fTall.t, fTall.construction), Math.max(...fTall.prof.map((p) => p[1])) - fTall.topY) && (!bTall || bTall.H >= Math.max(...fTall.prof.map((p) => p[1])) - 1e-9),
    J({ rise: roofRise(8, fTall.t, fTall.construction), peak: Math.max(...fTall.prof.map((p) => p[1])) - fTall.topY, bounds: bTall }));
  ok("... while Barnwright's own barn keeps 0.45 W", near(roofRise(8, fBase.t, fBase.construction), 0.45 * 8));
  ok("13 and 14 ft keep their own shape (taller than 51 in)", near(peakOf(cat11, "13x24").line, 0.45 * 13) && near(peakOf(w11, "14x24").line, peakOf(BASE, "14x24").line));
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

/* ------------------------------------------------------------------ 9 */
group("9. typing a value: parse, format and the plain errors");
{
  const P = (id, v, c) => BUILT.parse(id, v, c || {});
  ok("5/12 reads as 5", P("roofPitch", "5/12", { kind: "gable" }).value === 5);
  ok("5 1/2/12, 5.5/12 and 5 in 12 read too", P("roofPitch", "5 1/2/12").value === 5.5 && P("roofPitch", "5.5/12").value === 5.5 && P("roofPitch", "5 in 12").value === 5);
  ok("\"5\\12\" is a typo: \"Roof pitch: write it like 5/12.\"", P("roofPitch", "5\\12").problem === "Roof pitch: write it like 5/12.", J(P("roofPitch", "5\\12")));
  ok("15/12 is past the limit, in words", P("roofPitch", "15/12", { kind: "gable" }).problem === "Roof pitch 15/12 is steeper than 12/12, the steepest the 3D designer draws.");
  ok("\"roofPich\" says \"Did you mean roof pitch?\"", P("roofPich", "5/12").problem === "\"roofPich\" is not a building setting. Did you mean roof pitch?");
  ok("93.5 in writes as 7 ft 9 1/2 in", BUILT.format("wallHeight", 93.5) === "7 ft 9 1/2 in");
  ok("7 ft 9 1/2 in, 7' 9 1/2\" and 93 1/2 all read as 93.5", P("wallHeight", "7 ft 9 1/2 in").value === 93.5 && P("wallHeight", "7' 9 1/2\"").value === 93.5 && P("wallHeight", "93 1/2").value === 93.5);
  ok("a porch depth of \"6\" is 6 ft (the box's unit)", P("porchDepth", "6").value === 6);
  ok("\"72\" in the porch depth suggests inches", P("porchDepth", "72").problem === "Porch depth 72 ft is deeper than 8 ft. Did you mean 72 in (6 ft)?", P("porchDepth", "72").problem);
  ok("a 6 in eave is refused on a barn roof", P("eaveOverhang", "6", { kind: "barn" }).problem === "Eave overhang 6 in is more than a barn roof can take: 3 in at most.");
  ok("barn heights must not drop as the barn gets wider", /the 12 ft wide barn \(4 ft\) is lower than the 10 ft wide barn \(4 ft 3 in\)/.test(P("barnPeak", { 10: 51, 12: 48 }).problem || ""));
  ok("side porch lengths: listed twice is said", P("sidePorchLengths", [8, 8]).problem === "Side porch lengths: 8 ft is listed twice.");
  /* a fraction is less than one: 6'71/2" (the space left out) is a typo,
     never 6 ft and 35 3/4 in = 8 ft 11 3/4 in (review W9) */
  ok("\"6'71/2\\\"\" is refused (\"Wall height: write it like 7 ft 9 1/2 in.\"), \"6' 7 1/2\\\"\" reads 6 ft 7 1/2 in", P("wallHeight", "6'71/2\"").problem === "Wall height: write it like 7 ft 9 1/2 in." && P("wallHeight", "6' 7 1/2\"").value === 79.5 && P("wallHeight", "13/8").problem !== undefined, J([P("wallHeight", "6'71/2\""), P("wallHeight", "6' 7 1/2\"")]));
  /* limits the way a builder says them (review W13) */
  ok("overhang limits in inches: \"Eave overhang 16 in is more than 12 in, the most the 3D designer draws.\"", P("eaveOverhang", "16").problem === "Eave overhang 16 in is more than 12 in, the most the 3D designer draws." && P("gableEndOverhang", "13").problem === "Gable-end overhang 13 in is more than 12 in, the most the 3D designer draws.", J([P("eaveOverhang", "16"), P("gableEndOverhang", "13")]));
  ok("a wall of 7.75 asks \"Did you mean 7 ft 9 in?\", never \"7.75 ft\"", P("wallHeight", "7.75").problem === "Wall height 7 3/4 in is lower than 4 ft. Did you mean 7 ft 9 in?", P("wallHeight", "7.75").problem);
  /* the flattest pitch the 3D designer can FRAME (review GL-7): a metal
     building's purlin deck needs 4/12, a lean-to 1 1/4/12, a single slope
     2/12; said for the setting, never as framing pieces */
  ok("a metal gable roof at 3 1/2/12: \"... the flattest the 3D designer can frame a metal roof\"", P("roofPitch", "3 1/2/12", { kind: "gable", metal: true }).problem === "Roof pitch 3 1/2/12 is flatter than 4/12, the flattest the 3D designer can frame a metal roof." && P("roofPitch", "3/12", { kind: "gable" }).value === 3, J(P("roofPitch", "3 1/2/12", { kind: "gable", metal: true })));
  ok("a lean-to at 1/12 and a single slope at 1 1/2/12 are refused for the setting", P("roofPitch", 1, { kind: "lean" }).problem === "Roof pitch 1/12 is flatter than 1 1/4/12, the flattest the 3D designer can frame on lean-to roofs." && /flatter than 2\/12, the flattest the 3D designer can frame on single slope roofs\./.test(P("roofPitch", 1.5, { kind: "slope" }).problem || ""));
  const mu = barnwrightCompany(); mu.offer.MU.built = { roofPitch: 3 };
  ok("... and on the Metal Utility itself, at its box", BUILT.problems(mu, M).some((x) => x.path === "offer.MU.built.roofPitch" && /flattest the 3D designer can frame a metal roof/.test(x.words)), J(BUILT.problems(mu, M)));
  ok("pitches write as a shed builder says them", BUILT.format("roofPitch", 5) === "5/12" && BUILT.format("roofPitch", 5.25) === "5 1/4/12" && BUILT.format("barnPeak", { 8: 43.75, 10: 48 }) === "8 ft wide: 3 ft 7 3/4 in, 10 ft wide: 4 ft");
}

/* ------------------------------------------------------------------ 10 */
group("10. which number wins");
{
  const rise = (cat, t, z = "10x16") => { const fr = frameOf(stateOf(cat, t, z), cat); return Math.max(...fr.prof.map((p) => p[1])) - fr.topY; };
  const pitchOf = (cat, t, z = "10x16") => rise(cat, t, z) / (+z.split("x")[0] / 2) * 12;
  const co = (more) => Object.assign(barnwrightCompany(), more || {});
  const withBuilt = (fn, m = M) => { const c = barnwrightCompany(); fn(c); return resolve(c, m, LIB); };
  /* a manufacturer with a shop standard of 5/12 on the Utility Shed */
  const MS = copy(M); MS.styles.UT.built = { roofPitch: 5 }; MS.styles.GU.built = { roofPitch: 4 };
  ok("the library's own (no setting anywhere): 6.48/12", near(pitchOf(BASE, "UT"), 6.48));
  ok("the shop standard (styles.UT.built) beats the library: 5/12", near(pitchOf(withBuilt(() => {}, MS), "UT"), 5));
  ok("business-wide beats the standard: 6/12", near(pitchOf(withBuilt((c) => { c.built = { roofPitch: { gable: 6 } }; }, MS), "UT"), 6));
  ok("the style's own beats business-wide: 8/12", near(pitchOf(withBuilt((c) => { c.built = { roofPitch: { gable: 6 } }; c.offer.UT.built = { roofPitch: 8 }; }, MS), "UT"), 8));
  ok("the business's raw construction keeps the standard off its path", near(pitchOf(withBuilt((c) => { c.construction = { roof: { shapes: { gable: { rise: { w: 0.25 } } } } }; }, MS), "UT"), 6));
  const prem = withBuilt((c) => { c.offer.UTX1 = { base: "UT", name: "Premium Utility", sizes: { "10x16": 6000 } }; c.categories[0][1].push("UTX1"); c.offer.UT.built = { roofPitch: 6 }; });
  ok("\"Premium Utility\" (built like the Utility Shed) follows offer.UT.built.roofPitch 6", near(pitchOf(prem, "UTX1"), 6) && near(pitchOf(prem, "UT"), 6));
  const prem2 = withBuilt((c) => { c.offer.UTX1 = { base: "UT", name: "Premium Utility", sizes: { "10x16": 6000 }, built: { roofPitch: 7 } }; c.categories[0][1].push("UTX1"); c.offer.UT.built = { roofPitch: 6 }; });
  ok("... unless it has its own number", near(pitchOf(prem2, "UTX1"), 7) && near(pitchOf(prem2, "UT"), 6));
  /* style features */
  const biz = withBuilt((c) => { c.built = { roofPitch: { gable: 4 }, gableEndOverhang: { gable: 6 } }; });
  ok("a business-wide gable-end overhang does not reach the Garden Utility's flush end", near(frameOf(stateOf(biz, "GU", "8x12"), biz).t.rakeOverhang, 0.03) && biz.TYPES.GU.built.gableEndOverhang.from === "style feature");
  ok("... nor a business-wide pitch the Dormer Shed's own main roof", near(rise(biz, "DS"), 10 * 0.30) && near(pitchOf(biz, "UT"), 4));
  const own = withBuilt((c) => { c.offer.GU.built = { gableEndOverhang: 6 }; c.offer.DS.built = { roofPitch: 8 }; });
  const gu = makePlan(stateOf(own, "GU", "8x12"), own);
  ok("set on the Garden Utility itself, it replaces the flush end (6 in)", near(roofSection(gu).ov !== undefined ? roofSection(gu).ov : gableEndOf(gu), 0.5) && own.TYPES.GU.rakeOverhang === undefined, J(own.TYPES.GU));
  ok("set on the Dormer Shed itself, its main roof is 8/12", near(rise(own, "DS"), 10 * 8 / 24));
  /* the wall height used to be ignored */
  const lb = withBuilt((c) => { c.offer.LB.built = { wallHeight: 84 }; });
  ok("offer.LB.built.wallHeight 84 draws 7 ft walls", near(frameOf(stateOf(lb, "LB", "10x16"), lb).topY - frameOf(stateOf(BASE, "LB", "10x16"), BASE).topY, 7 - 6.67));
  /* a bad value falls through, with a warning for the owner */
  const bad = withBuilt((c) => { c.offer.UT.built = { roofPitch: 20 }; }, MS);
  ok("a value past the limits is skipped (the standard 5/12 is used) and said", near(pitchOf(bad, "UT"), 5) && bad.settingsWarnings.some((w) => /Roof pitch 20\/12 is steeper/.test(w)), J(bad.settingsWarnings));
  /* ... naming the number built instead and where it comes from, never
     "the next number" or "the library number" (review W5) */
  ok("... \"Until it is fixed in How it's built, it is built at 5/12 (the standard).\"", bad.settingsWarnings.includes("Utility Shed: Roof pitch 20/12 is steeper than 12/12, the steepest the 3D designer draws. Until it is fixed in How it's built, it is built at 5/12 (the standard)."), J(bad.settingsWarnings));
  const typed = withBuilt((c) => { c.offer.UT.built = { roofPitch: "5\\12" }; c.built = { eaveOverhang: { gable: 5 } }; c.offer.SU.built = { eaveOverhang: 40 }; }, MS);
  ok("... what was typed (\"Roof pitch \"5\\12\" cannot be read: write it like 5/12.\"), and a business-wide number in its words", typed.settingsWarnings.includes("Utility Shed: Roof pitch \"5\\12\" cannot be read: write it like 5/12. Until it is fixed in How it's built, it is built at 5/12 (the standard).")
    && typed.settingsWarnings.includes("Side Utility: Eave overhang 40 in is more than 12 in, the most the 3D designer draws. Until it is fixed in How it's built, it is built at 5 in (your number for the whole business).")
    && !typed.settingsWarnings.some((w) => /next number|library/.test(w)), J(typed.settingsWarnings));
  /* extras: a roof pitch only ever makes a roof steeper */
  const ex = (pitch) => withBuilt((c) => { c.offer.UT.built = { roofPitch: pitch }; c.options.extras = [{ key: "steep", name: "Steep roof", input: "check", price: 300, built: { roofPitch: 7 } }]; });
  const on = (cat) => { const s = stateOf(cat, "UT", "10x16"); s.xopt = { steep: 1 }; return s; };
  const pOn = (cat) => { const fr = frameOf(on(cat), cat); return (Math.max(...fr.prof.map((p) => p[1])) - fr.topY) / 5 * 12; };
  ok("an extra with roof pitch 7 on a Utility Shed set to 8/12 leaves it at 8/12", near(pOn(ex(8)), 8), String(pOn(ex(8))));
  ok("... and makes a 5/12 one 7/12", near(pOn(ex(5)), 7), String(pOn(ex(5))));
  ok("... only while it is picked", near(pitchOf(ex(5), "UT"), 5));
  /* the setup connector's raw rule list lifts, drawing the same roof */
  const rule = withBuilt((c) => { c.construction = { roof: { shapes: { gable: { rise: [{ when: { styles: ["UT"] }, value: { w: 5 / 24 } }, { value: { w: LIB.roof.shapes.gable.rise.w } }] } } } }; });
  const raw = barnwrightCompany(); raw.construction = { roof: { shapes: { gable: { rise: [{ when: { styles: ["UT"] }, value: { w: 5 / 24 } }, { value: { w: LIB.roof.shapes.gable.rise.w } }] } } } };
  const lifted = BUILT.liftRawRules(raw, M);
  ok("the connector's rule for the Utility Shed lifts to offer.UT.built.roofPitch 5", lifted.settings.offer.UT.built.roofPitch === 5 && lifted.settings.construction === undefined && lifted.moved.length === 1, J(lifted.settings.construction));
  const after = resolve(lifted.settings, M, LIB);
  ok("... and draws the same roof before and after, every size", Object.keys(BASE.P.UT).every((z) => J(frameOf(stateOf(rule, "UT", z), rule).prof) === J(frameOf(stateOf(after, "UT", z), after).prof)) && near(pitchOf(after, "UT"), 5));
  ok("... while a rule list of another shape stays raw", BUILT.liftRawRules({ offer: raw.offer, construction: { roof: { shapes: { gable: { rise: [{ when: { maxW: 8 }, value: { w: 0.3 } }, { value: { w: 0.27 } }] } } } } }, M).moved.length === 0);
}

/* ------------------------------------------------------------------ 11 */
group("11. problems, screens and History words");
{
  const c = barnwrightCompany();
  c.offer.LB.built = { roofPitch: 6, wallHeigth: 84 };
  c.offer.UT.built = { porchDepth: 6 };
  c.built = { roofPich: { gable: 5 }, wallHeight: 90, eaveOverhang: { barn: 6 } };
  c.options.extras = [{ key: "tall", name: "Tall walls", input: "check", price: 100, built: { wallHeight: 96 } }];
  const p = BUILT.problems(c, M).map((x) => `${x.path}: ${x.words}`);
  const has = (re) => p.some((x) => re.test(x));
  ok("a barn style has no roof pitch: said with the path first", has(/^offer\.LB\.built\.roofPitch: The Lofted Barn has a barn roof, so it has no roof pitch\. Set its barn roof height instead\.$/), J(p));
  ok("a typo in a knob on a style: did you mean", has(/^offer\.LB\.built\.wallHeigth: "wallHeigth" is not a building setting\. Did you mean wall height\?$/));
  ok("a porch depth on a style with no porch", has(/^offer\.UT\.built\.porchDepth: The Utility Shed has no porch\.$/));
  ok("a business-wide typo", has(/^built\.roofPich: "roofPich" is not a building setting\. Did you mean roof pitch\?$/));
  ok("no business-wide wall height", has(/^built\.wallHeight: Wall height is set on each style/));
  ok("a business-wide barn eave of 6 in", has(/^built\.eaveOverhang\.barn: Eave overhang 6 in is more than a barn roof can take: 3 in at most\.$/));
  const sp = strictProblems(c, M);
  ok("an extra cannot change the wall height", sp.includes("options.extras[0].built.wallHeight: An extra cannot change the wall height. Set it on the style in How it's built."), J(sp.filter((x) => /extras/.test(x))));
  ok("every one of them is a strict problem (refused on save when new, never on read)", p.every((x) => sp.includes(x)) && validate(c, M).length === 0);
  const raw = barnwrightCompany(); raw.construction = { roof: { shapes: { gable: { rise: { w: 0.3 } } } } };
  ok("a raw roof rise: \"The construction settings hold the roof pitch\"", strictProblems(raw, M).includes("construction.roof.shapes.gable.rise: The construction settings hold the roof pitch. Set it in How it's built instead."), J(strictProblems(raw, M)));
  const wide = barnwrightCompany(); wide.built = { porchDepth: 7 };
  ok("a wrap porch too deep for its narrowest size is said", BUILT.problems(wide, M).some((x) => x.path === "built.porchDepth" && x.words === "Porch depth 7 ft leaves the 12 ft wide Deluxe Side Cabin no angled wall: 6 ft at most."), J(BUILT.problems(wide, M)));
  ok("... and a side porch that leaves too little room", BUILT.problems(wide, M).some((x) => x.words === "Porch depth 7 ft leaves the 10 ft wide Side Cabin less than 4 ft of room inside."));
  /* the shop standard in the manufacturer file is checked as errors */
  const MS = copy(M); MS.styles.LB.built = { roofPitch: 5 };
  ok("the shop standard's mistakes are manufacturer errors", validateManufacturer(MS).some((x) => /^styles\.LB\.built\.roofPitch: The Lofted Barn has a barn roof/.test(x)));
  /* what the screens show */
  const cat = (() => { const x = barnwrightCompany(); x.offer.UT.built = { roofPitch: 6 }; x.built = { eaveOverhang: { gable: 5 } }; return resolve(x, M, LIB); })();
  const eff = Object.fromEntries(BUILT.effective(cat, "UT").map((e) => [e.id, e]));
  ok("effective: the style's own pitch, from this style", eff.roofPitch.words === "6/12" && eff.roofPitch.from === "this style");
  ok("effective: a business-wide eave", eff.eaveOverhang.words === "5 in" && eff.eaveOverhang.from === "business-wide");
  ok("effective: the library's wall, in a builder's words", eff.wallHeight.words === "7 ft 9 in" && eff.wallHeight.from === "library", J(eff.wallHeight));
  const effLB = Object.fromEntries(BUILT.effective(BASE, "LB").map((e) => [e.id, e]));
  ok("effective: the library's barn roof heights at every width sold, at the trusses' peak (the roof line over the deck stands 15/32 in higher)", /^8 ft wide: 3 ft 6 3\/4 in, 10 ft wide: 4 ft 5 9\/16 in, 12 ft wide: 5 ft 4 5\/16 in, 14 ft wide: 6 ft 3 1\/8 in$/.test(effLB.barnPeak.words), effLB.barnPeak.words);
  /* History */
  const before = barnwrightCompany(), after = copy(before);
  after.offer.LB.built = { wallHeight: 84 }; after.built = { roofPitch: { gable: 6 } };
  const lines = BUILT.describeChanges(before, after, M);
  ok("History: \"Lofted Barn wall height: 6 ft 8 1/16 in → 7 ft\"", lines.includes("Lofted Barn wall height: 6 ft 8 1/16 in → 7 ft"), J(lines));
  /* ... with the styles it moved, before → after: "standard" is not one
     number (review W4) */
  ok("History: \"Business-wide roof pitch for gable roofs: standard → 6/12 (Utility Shed, Side Utility and 8 more about 6 1/2/12 → 6/12)\"", lines.includes("Business-wide roof pitch for gable roofs: standard → 6/12 (Utility Shed, Side Utility and 8 more about 6 1/2/12 → 6/12)"), J(lines));
  {
    const SMx = standardManufacturer(), plainCo = readJSON("companies/demo/company.json"), biz6 = copy(plainCo); biz6.built = { roofPitch: { gable: 6 } };
    ok("History on the shop standard: \"... (Utility Shed and Side Utility 5/12 → 6/12; Garden Utility, Cabin and 6 more about 6 1/2/12 → 6/12)\"", J(BUILT.describeChanges(plainCo, biz6, SMx)) === J(["Business-wide roof pitch for gable roofs: standard → 6/12 (Utility Shed and Side Utility 5/12 → 6/12; Garden Utility, Cabin and 6 more about 6 1/2/12 → 6/12)"]), J(BUILT.describeChanges(plainCo, biz6, SMx)));
    const biz12 = copy(plainCo); biz12.built = { barnPeak: { 12: 54 } };
    ok("... and a business-wide barn height width by width (\"Lofted Barn and Side Lofted Barn at 12 ft wide 4 ft 3 in → 4 ft 6 in; ...\")", /^Business-wide barn roof height: standard → 12 ft wide: 4 ft 6 in \(Lofted Barn and Side Lofted Barn at 12 ft wide 4 ft 3 in → 4 ft 6 in; /.test(BUILT.describeChanges(plainCo, biz12, SMx)[0] || ""), J(BUILT.describeChanges(plainCo, biz12, SMx)));
  }
  /* the Dealer Center's change list while a box holds words that cannot be read */
  const typo = copy(before); typo.offer.LB.built = { wallHeight: "5\\12" };
  const typoLines = BUILT.describeChanges(before, typo, M);
  ok("changes: a wall height typed wrong says what was typed (\"... → \"5\\12\"\")", typoLines.includes('Lofted Barn wall height: 6 ft 8 1/16 in → "5\\12"'), J(typoLines));
  /* the standard's own number typed on a style (review W12), the same
     number in other words (F9) */
  {
    const SMx = standardManufacturer();
    const mine = copy(before); mine.offer.UT.built = { roofPitch: 5 };
    const asText = copy(before); asText.offer.UT.built = { roofPitch: "5/12" };
    ok("History: the standard's 5/12 typed on the Utility Shed is \"standard (5/12) → 5/12 of its own\"", J(BUILT.describeChanges(before, mine, SMx)) === J(["Utility Shed roof pitch: standard (5/12) → 5/12 of its own"]), J(BUILT.describeChanges(before, mine, SMx)));
    ok("... and taken out again \"5/12 of its own → standard (5/12)\"", J(BUILT.describeChanges(mine, before, SMx)) === J(["Utility Shed roof pitch: 5/12 of its own → standard (5/12)"]), J(BUILT.describeChanges(mine, before, SMx)));
    ok("History: 5 and \"5/12\" are the same number, no line", J(BUILT.describeChanges(mine, asText, SMx)) === "[]", J(BUILT.describeChanges(mine, asText, SMx)));
    const bizA = copy(before); bizA.built = { roofPitch: { gable: 6 } };
    const bizB = copy(before); bizB.built = { roofPitch: { gable: "6/12" } };
    ok("History: a business-wide 6 and \"6/12\" are the same number, no line", J(BUILT.describeChanges(bizA, bizB, SMx)) === "[]", J(BUILT.describeChanges(bizA, bizB, SMx)));
    /* stored as numbers */
    const sent = copy(before);
    sent.built = { roofPitch: { gable: "6/12" }, eaveOverhang: { gable: "5 in" } };
    sent.offer.UT.built = { roofPitch: "5 1/2/12", wallHeight: "7 ft 9 1/2 in" };
    sent.offer.LB.built = { barnPeak: { "08": "3 ft 7 3/4 in", 10: 48 }, wallHeight: "5\\12" };
    sent.options.extras = [{ key: "steep", name: "Steep roof", input: "check", price: 1, built: { roofPitch: "7/12" } }];
    const tidy = BUILT.tidyBuilt(sent, SMx);
    ok("tidyBuilt: every number stored as its number (\"6/12\" → 6, \"7 ft 9 1/2 in\" → 93.5, \"08\" → 8)", J(tidy.built) === J({ roofPitch: { gable: 6 }, eaveOverhang: { gable: 5 } }) && J(tidy.offer.UT.built) === J({ roofPitch: 5.5, wallHeight: 93.5 })
      && J(tidy.offer.LB.built.barnPeak) === J({ 8: 43.75, 10: 48 }) && tidy.options.extras[0].built.roofPitch === 7, J([tidy.built, tidy.offer.UT.built, tidy.offer.LB.built, tidy.options.extras[0].built]));
    ok("... a value that cannot be read is left as sent (the save refuses it in words), and the one sent is not changed", tidy.offer.LB.built.wallHeight === "5\\12" && sent.offer.UT.built.roofPitch === "5 1/2/12");
    ok("... a price list already in numbers comes back as itself", BUILT.tidyBuilt(tidy, SMx) === tidy);
    ok("a barn width given twice (\"08\" and \"8\") is refused: \"Barn roof height: the 8 ft wide barn is listed twice.\"", BUILT.parse("barnPeak", { "08": 40, 8: 50 }).problem === "Barn roof height: the 8 ft wide barn is listed twice.", J(BUILT.parse("barnPeak", { "08": 40, 8: 50 })));
  }
  ok("words: a pitch between quarters is \"about 6 1/2/12\"; a door opening in inches", BUILT.format("roofPitch", 6.48) === "about 6 1/2/12" && BUILT.format("roofPitch", 5.25) === "5 1/4/12" && BUILT.format("doorHeight", 76.5) === "76 1/2 in");
  ok("History: an extra's roof pitch (\"Steep roof: roof pitch at least 7/12\")", J(BUILT.describeExtraBuilt("Steep roof", undefined, { roofPitch: 7 })) === J(["Steep roof: roof pitch at least 7/12"])
    && J(BUILT.describeExtraBuilt("Steep roof", { roofPitch: 7 }, undefined)) === J(["Steep roof no longer changes the roof pitch"]));
  const reach = BUILT.businessReach(barnwrightCompany(), M, "gableEndOverhang", "gable");
  ok("businessReach: a business-wide gable-end overhang reaches the Utility Shed, and the Garden Utility keeps its flush gable end",
    reach.reaches.includes("UT") && reach.kept.some((k) => k.key === "GU" && /flush gable end/.test(k.feature)), J(reach));
  /* a pure edit */
  const e1 = BUILT.setBuilt(before, { style: "UT", knob: "roofPitch", value: "5/12" });
  ok("setBuilt writes the number", e1.problems.length === 0 && e1.settings.offer.UT.built.roofPitch === 5 && before.offer.UT.built === undefined);
  const e2 = BUILT.setBuilt(e1.settings, { style: "UT", knob: "roofPitch", value: null });
  ok("... and null puts the standard back", e2.settings.offer.UT.built === undefined);
  ok("... a typo comes back as words", BUILT.setBuilt(before, { style: "UT", knob: "roofPitch", value: "5\\12" }).problems[0].words === "Roof pitch: write it like 5/12.");
}

/* ------------------------------------------------------------------ 12 */
group("12. an extra's construction settings");
{
  const rise = (cat, s) => { const fr = frameOf(s, cat); return Math.max(...fr.prof.map((p) => p[1])) - fr.topY; };
  const withExtra = (construction) => { const c = barnwrightCompany(); c.options.extras = [{ key: "x1", name: "Steep roof", input: "check", price: 300, construction }]; return c; };
  const picked = (cat, t = "UT", z = "10x16") => { const s = stateOf(cat, t, z); s.xopt = { x1: 1 }; return s; };
  /* the hole: an extra raising the roof through a raw construction path
     used to be copied in unchecked, past the pitch limits and History */
  const steep = withExtra({ "roof.shapes.gable.rise": { w: 0.35 } });
  const sp = strictProblems(steep, M);
  ok("an extra that raises the roof through \"roof.shapes.gable.rise\" is a problem on save", sp.includes("options.extras[0].construction.roof.shapes.gable.rise: An option's construction settings hold the roof pitch. Set it in How it's built instead."), J(sp));
  ok("... never on read (the designer still opens on it)", validate(steep, M).length === 0, J(validate(steep, M)));
  const catSteep = resolve(steep, M, LIB);
  ok("... it is not drawn when picked: the Utility Shed keeps its 6.48/12", near(rise(catSteep, picked(catSteep)) / 5 * 12, 6.48), String(rise(catSteep, picked(catSteep)) / 5 * 12));
  ok("... and the owner is told", catSteep.settingsWarnings.includes("Steep roof: its construction settings could not be used, so it does not change how the building is built."), J(catSteep.settingsWarnings));
  ok("... while the same roof pitch given as the extra's built is drawn (7/12)", (() => {
    const c = barnwrightCompany(); c.options.extras = [{ key: "x1", name: "Steep roof", input: "check", price: 300, built: { roofPitch: 7 } }];
    const cat = resolve(c, M, LIB); return strictProblems(c, M).length === 0 && near(rise(cat, picked(cat)) / 5 * 12, 7);
  })());
  for (const [p, v, words] of [["roof.shapes.gambrel.peakIn", { "10": 60 }, "barn roof height"], ["roof.shapes.gable.eaveOverhang", { flatIn: 8 }, "eave overhang"], ["roof.shapes.gambrel.endOverhang", 0.5, "gable-end overhang"], ["openings.doorHeightIn", 80, "wooden shop door height"]]) {
    ok(`an extra's "${p}" is a problem too (${words})`, strictProblems(withExtra({ [p]: v }), M).includes(`options.extras[0].construction.${p}: An option's construction settings hold the ${words}. Set it in How it's built instead.`), J(strictProblems(withExtra({ [p]: v }), M)));
  }
  /* a typo or a value that cannot be built: said, and not used */
  const typo = withExtra({ "floor.spacingInn": 12 });
  ok("a misspelt setting on an extra is named, with did-you-mean", strictProblems(typo, M).some((x) => /^options\.extras\[0\]\.construction\.floor\.spacingInn is not a construction setting\. Did you mean spacingIn\?/.test(x)), J(strictProblems(typo, M)));
  ok("... and changes nothing", resolve(typo, M, LIB).optionEffects.x1 === undefined);
  const words = withExtra({ "floor.spacingIn": "lots" });
  ok("a value that cannot be built is a problem and changes nothing", strictProblems(words, M).some((x) => /^options\.extras\[0\]\.construction/.test(x)) && resolve(words, M, LIB).optionEffects.x1 === undefined, J(strictProblems(words, M)));
  /* a good one keeps working */
  const good = withExtra({ "floor.spacingIn": 12 });
  const catGood = resolve(good, M, LIB);
  const d = { W: 10, L: 16 };
  ok("a good extra (joists 12 in apart) has no problems and is used when picked", strictProblems(good, M).length === 0 && constructionFor(catGood, picked(catGood), catGood.TYPES.UT, d).floor.spacingIn === 12 && constructionFor(catGood, stateOf(catGood, "UT", "10x16"), catGood.TYPES.UT, d).floor.spacingIn === LIB.floor.spacingIn && catGood.settingsWarnings.length === 0, J(catGood.settingsWarnings));
  /* a builder's option is held to the same rule */
  const MS = copy(M); MS.options.rates.jo12.construction = { "roof.shapes.gable.rise": { w: 0.4 } };
  ok("a builder's option that sets the roof pitch is a library error", validateManufacturer(MS).includes("options.rates.jo12.construction.roof.shapes.gable.rise: An option's construction settings hold the roof pitch. Set it in How it's built instead."), J(validateManufacturer(MS)));
  ok("... and the standard library's own options pass", validateManufacturer(M).length === 0, J(validateManufacturer(M)));
}

/* ------------------------------------------------------------------ 13 */
group("13. the shop standard (Alan's numbers)");
{
  const DEMO = loadCatalogue("demo"), BW = barnwrightCatalogue(), SM = standardManufacturer();
  const fr = (cat, t, z) => frameOf(stateOf(cat, t, z), cat);
  /* a barn: its trusses' peak (what Alan measured); every other roof: its line */
  const peakIn = (cat, t, z) => { const f = fr(cat, t, z); return (f.t.roof === "gambrel" ? barnTrussPeakFt(f.W, f.t, f.construction) : Math.max(...f.prof.map((p) => p[1])) - f.topY) * 12; };
  const lineIn = (cat, t, z) => { const f = fr(cat, t, z); return (Math.max(...f.prof.map((p) => p[1])) - f.topY) * 12; };
  const wallIn = (cat, t, z) => fr(cat, t, z).t.wallH * 12;
  for (const t of ["UT", "SU"]) {
    ok(`${t} 10x16: the roof rises 25 in above the wall (5/12; Barnwright 32.4 in)`, near(peakIn(DEMO, t, "10x16"), 25, 1e-9), String(peakIn(DEMO, t, "10x16")));
    ok(`${t} 10x16: walls 93 1/2 in (Barnwright 93 in)`, near(wallIn(DEMO, t, "10x16"), 93.5, 1e-9), String(wallIn(DEMO, t, "10x16")));
    const sec = roofSection(makePlan(stateOf(DEMO, t, "10x16"), DEMO));
    ok(`${t} 10x16: the eave ends 4 in past each wall, measured level`, near(-5 - sec.P[0][0], 4 / 12) && near(sec.P[sec.P.length - 1][0] - 5, 4 / 12), J(sec.P[0]));
    ok(`${t} 8x12, 12x16 and 14 ft: 5/12 at every width`, [["8x12", 4], ["12x16", 6]].every(([z, run]) => near(peakIn(DEMO, t, z), run * 12 * 5 / 12, 1e-9)) && (!DEMO.P[t]["14x24"] || near(peakIn(DEMO, t, "14x24"), 7 * 12 * 5 / 12, 1e-9)));
  }
  for (const t of ["LB", "SLB"]) {
    const sizes = Object.keys(DEMO.P[t]);
    const at = (w) => sizes.find((z) => +z.split("x")[0] === w);
    ok(`${t}: barn roofs 43 3/4, 48 and 51 in tall at 8, 10 and 12 ft wide`, [[8, 43.75], [10, 48], [12, 51]].every(([w, h]) => at(w) && near(peakIn(DEMO, t, at(w)), h, 1e-9)), J([8, 10, 12].map((w) => at(w) && peakIn(DEMO, t, at(w)))));
    ok(`${t}: walls 79 1/2 in (Barnwright 80.04 in)`, sizes.every((z) => near(wallIn(DEMO, t, z), 79.5, 1e-9)));
    const w14 = at(14);
    ok(`${t}: the 14 ft barn is unchanged (not confirmed): ${w14 ? (peakIn(DEMO, t, w14) / 12).toFixed(2) + " ft" : "not sold"}`, !w14 || near(peakIn(DEMO, t, w14), peakIn(BW, t, w14), 1e-9));
  }
  const c11 = JSON.parse(JSON.stringify(readJSON("companies/demo/company.json"))); c11.offer.LB.sizes["11x16"] = 7000;
  const cat11 = resolve(c11, SM, LIB);
  ok("an 11 ft Lofted Barn is no taller than the 12 ft one (51 in)", peakIn(cat11, "LB", "11x16") <= 51 + 1e-9, String(peakIn(cat11, "LB", "11x16")));
  /* every other style is Barnwright's, number for number */
  const same = Object.keys(DEMO.TYPES).filter((k) => ["UT", "SU", "LB", "SLB"].indexOf(k) < 0);
  const differs = same.filter((k) => Object.keys(DEMO.P[k]).some((z) => J(fr(DEMO, k, z).prof) !== J(fr(BW, k, z).prof) || fr(DEMO, k, z).t.wallH !== fr(BW, k, z).t.wallH));
  ok(`the other ${same.length} styles (the Garage, the Dormer Shed ...) draw Barnwright's roof and walls at every size`, same.length === 19 && differs.length === 0, differs.join(", "));
  ok("G 12x24 and DS 10x16 unchanged", near(peakIn(DEMO, "G", "12x24"), 38.88, 1e-9) && near(peakIn(DEMO, "DS", "10x16"), 36, 1e-9));
  ok("Barnwright's own company keeps Barnwright's numbers (6.48/12, 93 in, 54 in at 10 ft)", near(peakIn(BW, "UT", "10x16"), 32.4, 1e-9) && near(wallIn(BW, "UT", "10x16"), 93, 1e-9) && near(lineIn(BW, "LB", "10x16"), 54, 1e-9));
  const eff = BUILT.effective(DEMO, "UT");
  const pitch = eff.find((e) => e.id === "roofPitch"), wall = eff.find((e) => e.id === "wallHeight");
  ok("the screens say 5/12 and 7 ft 9 1/2 in, from the standard", pitch && pitch.words === "5/12" && pitch.from === "standard" && wall && wall.words === "7 ft 9 1/2 in" && wall.from === "standard", J(eff));
  ok("the manufacturer file's shop numbers have no problems", validateManufacturer(SM).length === 0 && BUILT.libraryProblems(SM).length === 0, J(BUILT.libraryProblems(SM)));
  ok("each shop number says where it came from (_source)", ["UT", "SU", "LB", "SLB"].every((k) => SM.styles[k].built && /Alan's shop numbers/.test(SM.styles[k].built._source || "")));
  /* a business's own number still wins over the shop standard */
  const own = JSON.parse(JSON.stringify(readJSON("companies/demo/company.json"))); own.offer.UT.built = { roofPitch: 6 };
  ok("a business's own roof pitch (6/12) beats the shop standard's 5/12", near(peakIn(resolve(own, SM, LIB), "UT", "10x16"), 30, 1e-9));
  /* barn heights width by width (review W1): one width typed keeps the
     shop's other widths; the empty boxes are really the standard */
  const one = JSON.parse(JSON.stringify(readJSON("companies/demo/company.json"))); one.offer.LB.built = { barnPeak: { 10: 50 } };
  const catOne = resolve(one, SM, LIB);
  ok("the Lofted Barn with only 10 ft wide typed (4 ft 2 in): 8 and 12 ft keep 43 3/4 and 51 in", near(peakIn(catOne, "LB", "8x12"), 43.75, 1e-9) && near(peakIn(catOne, "LB", "10x12"), 50, 1e-9) && near(peakIn(catOne, "LB", "12x16"), 51, 1e-9),
    J(["8x12", "10x12", "12x16"].map((z) => peakIn(catOne, "LB", z))));
  ok("... with no problem, and the screens say where each width comes from", BUILT.problems(one, SM).length === 0 && J(catOne.TYPES.LB.built.barnPeak.parts) === J({ 8: "standard", 10: "this style", 12: "standard" }), J([BUILT.problems(one, SM), catOne.TYPES.LB.built.barnPeak]));
  const biz = JSON.parse(JSON.stringify(readJSON("companies/demo/company.json"))); biz.built = { barnPeak: { 12: 54 } };
  ok("a business-wide 12 ft height (4 ft 6 in) leaves the 8 and 10 ft standard alone", near(peakIn(resolve(biz, SM, LIB), "LB", "8x12"), 43.75, 1e-9) && near(peakIn(resolve(biz, SM, LIB), "LB", "10x12"), 48, 1e-9) && near(peakIn(resolve(biz, SM, LIB), "LB", "12x16"), 54, 1e-9));
  const tall = JSON.parse(JSON.stringify(readJSON("companies/demo/company.json"))); tall.offer.LB.built = { barnPeak: { 10: 60 } };
  ok("a 10 ft height above the standard's 12 ft is said, never quietly dropped (\"... Type a height for the 12 ft wide barn too.\")",
    BUILT.problems(tall, SM).some((p) => p.path === "offer.LB.built.barnPeak" && p.words === "Barn roof height: the 12 ft wide barn (4 ft 3 in, the standard) would be lower than the 10 ft wide barn (5 ft). Type a height for the 12 ft wide barn too."), J(BUILT.problems(tall, SM)));
  /* the every-size check measures a barn at its trusses too: the same height
     at every width is no "taller than", and 8 ft (the most the setting
     takes) is no "over 8 ft" (the roof line over the deck stands a hair
     higher on a narrower, steeper barn) */
  {
    const flat = JSON.parse(JSON.stringify(readJSON("companies/demo/company.json"))); flat.offer.LB.built = { barnPeak: { 8: 48, 10: 48, 12: 48, 14: 48 } };
    const tall = JSON.parse(JSON.stringify(readJSON("companies/demo/company.json"))); tall.offer.LB.built = { barnPeak: { 8: 96, 10: 96, 12: 96, 14: 96 } };
    const bad = (co) => checkStyle(resolve(co, SM, LIB), "LB", { framing: false }).problems.filter((f) => f.code === "roof-widths" || (f.code === "roof" && /peak/.test(f.words)));
    ok("a barn 4 ft tall at every width is not \"taller than\" itself, and one 8 ft tall is within the 8 ft limit", bad(flat).length === 0 && bad(tall).length === 0, J([bad(flat).map((f) => f.words), bad(tall).map((f) => f.words)]));
  }
  /* every width sold, as drawn (review W6) */
  const effOne = BUILT.effective(catOne, "LB").find((e) => e.id === "barnPeak");
  ok("the screens list the barn height at every width sold, 14 ft too (\"... 14 ft wide: 6 ft 3 1/8 in\")", effOne.words === "8 ft wide: 3 ft 7 3/4 in, 10 ft wide: 4 ft 2 in, 12 ft wide: 4 ft 3 in, 14 ft wide: 6 ft 3 1/8 in", effOne.words);
  /* an option's roof pitch that changes nothing where it is offered is said
     (review W2): a barn roof, past a lean-to's limit, a roof already steeper */
  {
    const steepEverywhere = JSON.parse(JSON.stringify(readJSON("companies/demo/company.json")));
    const sx = steepEverywhere.options.extras.find((x) => x.key === "steep-roof");
    ok("the sample's Steep roof (Utility Shed and Side Utility only) changes the roof everywhere it is offered", !!sx && BUILT.extrasThatChangeNothing(readJSON("companies/demo/company.json"), SM).length === 0);
    sx.styles = ["UT", "SU", "LB", "BU", "DS"];
    const said = BUILT.extrasThatChangeNothing(steepEverywhere, SM);
    ok("offered on the Lofted Barn, Backyard Utility and Dormer Shed too, it says where it changes nothing and why",
      said.length === 1 && said[0].words === "Steep roof does not change the Dormer Shed (its roof is already about 7 1/4/12), the Backyard Utility (its lean-to roof can be 6/12 at most) or the Lofted Barn (it has a barn roof). A customer would pay for nothing there." && J(said[0].styles.sort()) === J(["BU", "DS", "LB"]), J(said));
    steepEverywhere.offer.UT.built = { roofPitch: 8 };
    ok("... and on a Utility Shed set to 8/12 of its own (\"its roof is already 8/12\")", /the Utility Shed \(its roof is already 8\/12\)/.test((BUILT.extrasThatChangeNothing(steepEverywhere, SM)[0] || {}).words || ""), J(BUILT.extrasThatChangeNothing(steepEverywhere, SM)));
  }
  /* History, width by width */
  const plain = readJSON("companies/demo/company.json");
  ok("History: \"Lofted Barn barn roof height at 10 ft wide: 4 ft → 4 ft 2 in\" and nothing about the other widths", J(BUILT.describeChanges(plain, one, SM)) === J(["Lofted Barn barn roof height at 10 ft wide: 4 ft → 4 ft 2 in"]), J(BUILT.describeChanges(plain, one, SM)));
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
console.log(`\nPROVED (${passed} checks): the porch depth, the side porch lengths, the dormer side, the barn roof's gable-end overhang, its height by width and eaves measured level are settings the drawing follows; How it's built numbers are typed, checked and layered; an extra's construction settings are checked like the rest; with no setting every building is drawn as Barnwright's numbers say; and every company on the standard manufacturer draws Alan's shop numbers on the Utility Shed, Side Utility, Lofted Barn and Side Lofted Barn, and Barnwright's on the rest.`);
