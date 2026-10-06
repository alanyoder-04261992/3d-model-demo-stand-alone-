/* INTERNAL PART GALLERY HELPERS. These descriptions and geometry summaries
   support onboarding and construction inspection, outside the customer UI. */

import { STAGES } from "../parts/stages.js";
import { PIPELINE } from "../parts/index.js";
import { DRAW_MODULES } from "../parts/openings/index.js";

/* How many triangles each part drew on each building step:
   Map stageKey -> Map part label -> count, in drawing order. Reads the 9th
   number of each triangle's first corner (every corner of a triangle carries
   the same step). */
export function stageTriangles(build) {
  const out = new Map();
  const add = (sid, part, n) => {
    const st = STAGES[sid];
    if (!st || !n) return;
    let s = out.get(st.key);
    if (!s) { s = new Map(); out.set(st.key, s); }
    s.set(part, (s.get(part) || 0) + n);
  };
  /* counted in runs of triangles on the same step, so a big framing build
     costs one lookup per run, not one per triangle */
  const run = (v, from, to, part) => {
    let sid = -1, n = 0;
    for (let tri = from; tri < to; tri++) {
      const x = v[tri * 27 + 8];
      if (x !== sid) { add(sid, part, n); sid = x; n = 0; }
      n++;
    }
    add(sid, part, n);
  };
  for (const k of build.ORDER) {
    const b = build.buckets[k];
    if (!b || !b.n) continue;
    const segs = build.tags && build.tags[k];
    if (segs && segs.length) for (const sg of segs) run(b.v, sg.from, sg.from + sg.count, sg.part);
    else run(b.v, 0, Math.floor(b.v.length / 27), "?");
  }
  return out;
}

/* Which building steps this drawing has triangles on, and which parts drew
   them: Map stageKey -> Set of part labels, in drawing order. */
export function stagesPresent(build, counts) {
  const out = new Map();
  for (const [key, parts] of (counts || stageTriangles(build))) out.set(key, new Set(parts.keys()));
  return out;
}

/* Every part module and the part labels triangles carry, in PIPELINE order:
   { order: [label...], byId: {id: module}, byLabel: {label: [module...]},
     lessons: {label: page} }.
   A label is usually a module's own id; the porch label is also drawn by the
   porch-junction entry, and the door/window labels by the draw modules of
   parts/openings/. A label is a LESSON part's when every module that draws
   it says `lesson` (parts/README.md): only that lesson page draws it, so
   `lessons` maps it to the page. */
let PARTCAT = null;
export function partCatalogue() {
  if (PARTCAT) return PARTCAT;
  const byId = {}, byLabel = {}, order = [], lessons = {};
  for (const en of PIPELINE) if (en.module && en.module.id) byId[en.module.id] = en.module;
  for (const m of DRAW_MODULES) byId[m.id] = m;
  for (const en of PIPELINE) for (const tag of en.tags) if (order.indexOf(tag) < 0) order.push(tag);
  for (const tag of order) {
    const list = [];
    if (byId[tag] && tag !== "openings") list.push(byId[tag]);
    for (const en of PIPELINE) if (en.part === tag && en.module && list.indexOf(en.module) < 0) list.push(en.module);
    byLabel[tag] = list;
    if (list.length && list.every((m) => typeof m.lesson === "string" && m.lesson)) lessons[tag] = list[0].lesson;
  }
  PARTCAT = Object.freeze({ order: Object.freeze(order), byId: Object.freeze(byId), byLabel: Object.freeze(byLabel), lessons: Object.freeze(lessons) });
  return PARTCAT;
}
