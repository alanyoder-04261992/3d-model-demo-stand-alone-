/* Actual shop boards and continuous Yoder joints, at every sold style/size.
   Check emitted front faces, paired-window layout and full trim tap bounds.
   check-all: node */
import assert from "node:assert/strict";
import { shopStandardCatalogue, barnwrightCatalogue } from "./lib/barnwright-company.mjs";
import { defaults } from "../model/design.js";
import { resetItems, openingRect, itemW } from "../model/layout.js";
import { frameOf } from "../model/frame.js";
import { makePlan } from "../model/plan.js";
import { layoutVariants, recipeEntries } from "../model/loadouts.js";
import { inferRecipe } from "../model/layout-recipe.js";
import { createBuild, makeKit } from "../engine/buckets.js";
import { openingFrame, windowSill } from "../parts/openings/common.js";
import { constructionProblems } from "../model/construction.js";
import gableWindow from "../parts/openings/gable-window.js";

const cat = shopStandardCatalogue(), width = 3.5 / 12;
const near = (a, b, name) => assert.ok(Math.abs(a - b) < 1e-10, `${name}: ${a} != ${b}`);
let buildings = 0, openings = 0;
for (const type of Object.keys(cat.TYPES)) for (const size of Object.keys(cat.P[type])) for (const variant of layoutVariants(cat.TYPES[type], size)) {
  const state = { ...defaults(cat), type, size, ...variant };
  resetItems(state, frameOf(state, cat), cat);
  const plan = makePlan(state, cat);
  buildings++;
  for (const it of state.items) {
    const c = plan.CAT[it.cat];
    if (c.gable || !["door", "ru", "win"].includes(c.k)) continue;
    const build = createBuild(), kit = { ...makeKit(build) }, faces = [], original = kit.quadUV;
    kit.setStage("trim");
    kit.quadUV = function (material, points, uv) {
      if (material === trim) faces.push(points);
      return original(material, points, uv);
    };
    const originalWq = kit.wq;
    kit.wq = function (material, wall, u0, y0, u1, y1, offset, mode) {
      if (material === trim) faces.push([kit.wallPt(wall,u0,y0,offset),kit.wallPt(wall,u1,y0,offset),kit.wallPt(wall,u1,y1,offset),kit.wallPt(wall,u0,y1,offset)]);
      return originalWq(material, wall, u0, y0, u1, y1, offset, mode);
    };
    const trim = kit.mat("trim", "trim", "#ffffff"), op = openingFrame(plan, kit, it, c, trim);
    const origin = kit.wallPt(op.w, 0, 0, 0);
    const local = p => [(p[0] - origin[0]) * op.w.ax[0] + (p[2] - origin[2]) * op.w.ax[2], p[1]];
    const bounds = points => {
      const pp = points.map(local);
      return { u0: Math.min(...pp.map(p => p[0])), u1: Math.max(...pp.map(p => p[0])), y0: Math.min(...pp.map(p => p[1])), y1: Math.max(...pp.map(p => p[1])) };
    };
    // Each side slab emits a front and four returns; the head follows them.
    const left = bounds(faces[0]), right = bounds(faces[5]), head = bounds(faces[10]);
    const label = `${type} ${size} ${it.cat}`;
    assert.equal(faces.length, 15, label + " has one head board and no second stacked band");
    assert.equal(openingRect(it, plan).porchBand, null, label + " uses the loft window's single header");
    near(left.u1 - left.u0, width, label + " left board");
    near(right.u1 - right.u0, width, label + " right board");
    near(head.y1 - head.y0, width, label + " head board");
    assert.ok(left.y1 >= head.y0 && right.y1 >= head.y0, label + " continuous head joint");
    if (c.k === "win") {
      const start = faces.length;
      windowSill(plan, kit, op, trim);
      const sill = bounds(faces[start]);
      near(sill.y1 - sill.y0, width, label + " sill board");
      if (it.dbl) near(itemW(it, plan.CAT, plan), 2 * c.w + width, label + " paired opening");
    }
    const rect = openingRect(it, plan), hit = bounds(build.hitQuads[0].pts);
    near(hit.u0, rect.u0, label + " tap left"); near(hit.u1, rect.u1, label + " tap right");
    near(hit.y0, rect.y0, label + " tap bottom"); near(hit.y1, rect.y1, label + " tap top");
    openings++;
  }
}
// A paired window's measured board must also survive the owner's layout rules.
const state = { ...defaults(cat), type: "CS", size: "10x20" };
resetItems(state, frameOf(state, cat), cat);
const frame = frameOf(state, cat), pair = state.items.find(it => it.dbl);
assert.ok(pair);
const layout = inferRecipe(state.items, frame);
const again = recipeEntries(layout, frame.W, frame.L, { ...frame, frame });
near(again.find(it => it.dbl).pos, pair.pos, "paired-window layout round trip");
const legacy = barnwrightCatalogue(), oldFrame = frameOf({ ...state }, legacy);
near(itemW(pair, legacy.CAT, oldFrame), 2 * legacy.CAT[pair.cat].w + 0.27, "legacy reference casing");
for (const invalid of [0, -1, 9, "3.5", NaN]) assert.ok(constructionProblems({ openings: { trim: { widthIn: invalid } } }, "trim").length);
for (const invalid of [0, "false", null]) assert.ok(constructionProblems({ openings: { trim: { porchBand: invalid } } }, "trim").length);
// Existing reference catalogues still draw their original porch band.
const cabin = { ...state, type: "C", size: "10x20" };
resetItems(cabin, frameOf(cabin, legacy), legacy);
const oldPlan = makePlan(cabin, legacy), oldDoor = cabin.items.find(it => legacy.CAT[it.cat].k === "door");
assert.ok(openingRect(oldDoor, oldPlan).porchBand, "legacy cabin opening band remains exact");
// The rectangular gable window is drawn by a separate module. Inspect its
// actual flat trim faces on a side wall, where no roof clipping is applied.
const gstate = { ...state, items: [{ id: "gable", cat: "g1824", wall: "R", pos: 0, vy: 0 }] };
const gp = makePlan(gstate, cat), gb = createBuild(), gk = makeKit(gb);
gk.setStage("windows");
const gm = gk.mat("trim", "trim", "#ffffff"), glass = gk.mat("glass", "glass", "#ffffff");
gableWindow.drawItem(gp, gk, gstate.items[0], gp.CAT.g1824, { mT: gm, mG: glass });
const gface = i => {
  const points = Array.from({ length: 12 }, (_, n) => gm.v.slice((i * 12 + n) * 9, (i * 12 + n) * 9 + 3));
  return { width: Math.max(...points.map(p => p[2])) - Math.min(...points.map(p => p[2])), height: Math.max(...points.map(p => p[1])) - Math.min(...points.map(p => p[1])) };
};
near(gface(0).width, width, "gable left board"); near(gface(1).width, width, "gable right board");
near(gface(2).height, width, "gable head board"); near(gface(3).height, width, "gable sill board");
const steep = shopStandardCatalogue(c => { c.offer.UT.built = { roofPitch: 6 }; });
const end = makePlan({ type: "UT", size: "12x20", items: [], pLen: 12 }, steep);
const clipped = openingRect({ id: "gable", cat: "g1824", wall: "F", pos: 0, vy: -1000 }, end);
assert.ok(clipped.clipped, "roof cuts the measured head corners even when the full trim bounding box is unchanged");
near(clipped.unclipped.x0, clipped.x0, "unchanged box left after corner clip");
near(clipped.unclipped.y1, clipped.y1, "unchanged box top after corner clip");
console.log(`PROVED: ${openings} openings across ${buildings} buildings use actual 3 1/2 in side, head and sill boards with one loft-style header, no extra cabin band; continuous joints, full trim tap bounds and paired-window layouts agree. Legacy reference trim remains exact.`);
