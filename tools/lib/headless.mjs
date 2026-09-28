/* DRAW A RECORDED BARNWRIGHT BUILDING WITH OUR ENGINE, IN NODE (no browser).

   The golden fixtures (test/golden/geometry/<case>.json) hold Barnwright's
   exact state for 148 buildings and, for each, a fingerprint of every
   triangle it drew. This file draws the same building with our parts and
   boils our drawing down to the SAME fingerprints, so tools/check-golden.mjs
   can compare the two number for number.

     buildGoldenCase(id)  -> { fixture, plan, result, canon }
     canonical(build)     -> canon (below)

   How the case is drawn: the Barnwright company (tools/lib/barnwright-
   company.mjs: Barnwright's exact tables as a company file), the case's
   recorded `state`, makePlan, and assemble({ viewport: the recorded canvas
   size (742 x 803), fit: "barnwright", scene: "studio", trueColour: false,
   frames: false }).

   How it is boiled down (the capture's own rules, tools/capture-golden.mjs,
   with the hashing code imported from tools/lib/golden-cases.mjs so the two
   cannot disagree):
   * the 9th number of every vertex (the building step) is dropped -- after it
     has been used to keep only the steps the Finished view shows
     (parts/stages.js visibleIn("finished")), less the NEW finish steps
     Barnwright never drew (the ramp). A material whose every triangle was
     left out that way is left out of ORDER too (it is not Barnwright's);
     materials that were empty all along stay, as Barnwright's do.
   * per material: its parameters (texture name, tint, spec, gloss, glow,
     bump and the flags age glassM turf noCast unlit when set), its triangle
     count and hash, and per part label the count and hash of just that
     part's triangles in drawing order. Per-triangle "prints" are worked out
     only when asked (printsOf), to name the first triangle that differs. */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { hashFloats, trianglePrint, GOLDEN_DIR, FLOATS_PER_TRIANGLE } from "./golden-cases.mjs";
import { barnwrightCatalogue } from "./barnwright-company.mjs";
import { makePlan } from "../../model/plan.js";
import { assemble } from "../../engine/assemble.js";
import { STAGES, visibleIn } from "../../parts/stages.js";

const OURS_PER_TRIANGLE = 27;          /* 9 numbers per vertex, 3 vertices */

/* The finish steps that are NEW (never drawn by Barnwright), shown in the
   Finished view only when the customer chose them. */
export const NEW_FINISH_STAGES = Object.freeze(["ramp"]);

/* Which step ids a Barnwright comparison keeps. */
export const COMPARED_STAGE_IDS = Object.freeze(new Set(
  STAGES.filter((s) => visibleIn("finished", s) && NEW_FINISH_STAGES.indexOf(s.key) < 0).map((s) => s.id)));

let CAT = null;
export function catalogue() {
  if (!CAT) CAT = barnwrightCatalogue();
  return CAT;
}

export function readFixture(id) {
  return JSON.parse(readFileSync(resolve(GOLDEN_DIR, "geometry", id + ".json"), "utf8"));
}
export function hasFullFixture(id) {
  return existsSync(resolve(GOLDEN_DIR, "geometry-full", id + ".json"));
}
export function readFullFixture(id) {
  return JSON.parse(readFileSync(resolve(GOLDEN_DIR, "geometry-full", id + ".json"), "utf8"));
}

/* Barnwright's material parameters, keyed and valued exactly as the capture
   records them (tools/lib/golden-page.mjs params()). */
export function paramsOf(b) {
  const out = { tex: b.tex };
  for (const k of Object.keys(b).sort()) {
    if (k === "v" || k === "n" || k === "buf" || k === "count" || k === "tex") continue;
    out[k] = b[k];
  }
  return out;
}

/* Our drawing, boiled down to the golden format:
   { order, buckets: { key: { key, params, triangles, floats (8 per vertex),
     tags (one label per triangle), hash, parts: { label: { triangles, hash, index } } } } }
   `index` lists each of the part's triangles' positions in its material. */
export function canonical(build, keepStages = COMPARED_STAGE_IDS) {
  const order = [];
  const buckets = {};
  for (const key of build.ORDER) {
    const b = build.buckets[key];
    const nTri = b.n / 3;
    const perTri = new Array(nTri);
    for (const s of build.tags[key] || []) for (let i = 0; i < s.count; i++) perTri[s.from + i] = s.part;
    const keptIdx = [];
    for (let i = 0; i < nTri; i++) if (keepStages.has(b.v[i * OURS_PER_TRIANGLE + 8])) keptIdx.push(i);
    if (nTri > 0 && keptIdx.length === 0) continue;       /* every triangle was a step Barnwright never drew */
    const floats = new Float64Array(keptIdx.length * FLOATS_PER_TRIANGLE);
    const tags = new Array(keptIdx.length);
    keptIdx.forEach((ti, k) => {
      for (let vtx = 0; vtx < 3; vtx++) {
        const src = ti * OURS_PER_TRIANGLE + vtx * 9, dst = k * FLOATS_PER_TRIANGLE + vtx * 8;
        for (let f = 0; f < 8; f++) floats[dst + f] = b.v[src + f];
      }
      tags[k] = perTri[ti] === undefined ? null : perTri[ti];
    });
    const parts = {};
    const byPart = new Map();
    tags.forEach((t, i) => { if (!byPart.has(t)) byPart.set(t, []); byPart.get(t).push(i); });
    for (const [part, idx] of byPart) {
      const fl = new Float64Array(idx.length * FLOATS_PER_TRIANGLE);
      idx.forEach((ti, k) => fl.set(floats.subarray(ti * FLOATS_PER_TRIANGLE, (ti + 1) * FLOATS_PER_TRIANGLE), k * FLOATS_PER_TRIANGLE));
      parts[String(part)] = { triangles: idx.length, hash: hashFloats(fl), index: idx };
    }
    order.push(key);
    buckets[key] = { key, params: paramsOf(b), triangles: keptIdx.length, floats, tags, hash: hashFloats(floats), parts };
  }
  return { order, buckets };
}

/* The 24 numbers of one triangle of a canonical material. */
export function triangleFloats(cb, i) {
  return Array.from(cb.floats.subarray(i * FLOATS_PER_TRIANGLE, (i + 1) * FLOATS_PER_TRIANGLE));
}
/* The short fingerprint of one triangle (the golden "prints", 6 hex characters). */
export function printOf(cb, i) {
  return trianglePrint(cb.floats.subarray(i * FLOATS_PER_TRIANGLE, (i + 1) * FLOATS_PER_TRIANGLE));
}

/* The recorded canvas size is the camera fit's viewport. */
export function viewportOf(fixture) {
  return { w: fixture.canvas.clientWidth, h: fixture.canvas.clientHeight };
}

export function buildGoldenCase(idOrFixture, opts = {}) {
  const fixture = typeof idOrFixture === "string" ? readFixture(idOrFixture) : idOrFixture;
  const cat = opts.cat || catalogue();
  const plan = makePlan(fixture.state, cat);
  const result = assemble(plan, { viewport: viewportOf(fixture), fit: "barnwright", scene: "studio", trueColour: false, frames: false });
  const canon = canonical(result.build);
  return { fixture, plan, result, canon };
}
