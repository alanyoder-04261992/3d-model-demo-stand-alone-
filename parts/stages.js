/* THE STEPS OF BUILDING A SHED, in the numbering every triangle carries.
   Node-safe.

   Every vertex the engine draws is stamped with one of these ids (the 9th
   float). The shaders use the id to show or hide a whole step, or to lower it
   into place when the build is played back. IDS ARE PERMANENT: add new steps
   at the end, never renumber, because saved pictures and checks rely on them.

   kind "frame"  -- new geometry Barnwright never drew (joists, studs, trusses).
                    Hidden in the finished view, so that view stays Barnwright's.
   kind "finish" -- Barnwright's own geometry, triangle for triangle.
   kind "both"   -- shown in both the finished and the framing view (skids).
   kind "always" -- the ground the building sits on. */

export const STAGES = Object.freeze([
  { id: 0,  key: "site",        name: "Site and ground",                    kind: "always" },
  { id: 1,  key: "skids",       name: "Skids",                              kind: "both" },
  { id: 2,  key: "floor-frame", name: "Floor frame (joists and rim)",       kind: "frame" },
  { id: 3,  key: "floor-deck",  name: "Floor decking",                      kind: "frame" },
  { id: 4,  key: "wall-frame",  name: "Wall framing (studs, plates, headers)", kind: "frame" },
  { id: 5,  key: "roof-frame",  name: "Roof framing (trusses and rafters)", kind: "frame" },
  { id: 6,  key: "loft",        name: "Loft",                               kind: "frame" },
  { id: 7,  key: "roof-deck",   name: "Roof deck and purlins",              kind: "frame" },
  { id: 8,  key: "floor",       name: "Floor",                              kind: "finish" },
  { id: 9,  key: "siding",      name: "Siding",                             kind: "finish" },
  { id: 10, key: "trim",        name: "Trim",                               kind: "finish" },
  { id: 11, key: "roofing",     name: "Roofing",                            kind: "finish" },
  { id: 12, key: "porch",       name: "Porch",                              kind: "finish" },
  { id: 13, key: "dormer",      name: "Dormer",                             kind: "finish" },
  { id: 14, key: "doors",       name: "Doors",                              kind: "finish" },
  { id: 15, key: "windows",     name: "Windows",                            kind: "finish" },
  { id: 16, key: "extras",      name: "Shutters, lights and extras",        kind: "finish" },
  { id: 17, key: "shading",     name: "Contact shadows",                    kind: "finish" },
  { id: 18, key: "gable-end",   name: "Gable ends",                         kind: "finish" },
  { id: 19, key: "porch-frame", name: "Porch posts and beam",               kind: "both" },
  { id: 20, key: "dormer-frame", name: "Dormer framing",                    kind: "frame" },
  { id: 21, key: "foundation",  name: "Blocks and anchors",                 kind: "frame" },
  { id: 22, key: "interior",    name: "Shelves, benches and electrical",    kind: "frame" },
  { id: 23, key: "ramp",        name: "Ramp",                               kind: "finish" },
]);

/* The shader table has room for 32 steps (uniform vec4 uStg[32]). */
export const MAX_STAGES = 32;

export const STAGE_ID = Object.freeze(Object.fromEntries(STAGES.map((s) => [s.key, s.id])));

export function stageId(key) {
  const id = STAGE_ID[key];
  if (id === undefined) throw new Error("Unknown stage: " + key);
  return id;
}

/* Which steps the Finished and Framing views show. (The Build view is a
   timeline -- see buildVisibility below.) */
export function visibleIn(view, stage) {
  const k = stage.kind;
  if (k === "always" || k === "both") return true;
  if (view === "finished") return k === "finish";
  if (view === "framing") return k === "frame";
  throw new Error("visibleIn: use buildVisibility for the build view, not " + view);
}

/* When a finish step lands it hides the framing it covers, so an inch of stud
   or truss can never show through siding or roofing during the playback. */
export const COVERS = Object.freeze({
  siding: ["wall-frame"],
  roofing: ["roof-frame", "roof-deck", "loft", "dormer-frame"],
});

/* The Build view at step `k` of `order` (an array of stage keys):
   returns { [stageKey]: { shown, lifting } } for every stage.
   Stages not in the order are hidden until the end, when the view becomes
   Finished. The step being placed is `lifting`. */
export function buildVisibility(order, k) {
  const out = {};
  for (const s of STAGES) out[s.key] = { shown: false, lifting: false };
  const landed = new Set(order.slice(0, k + 1));
  for (let i = 0; i <= k && i < order.length; i++) out[order[i]] = { shown: true, lifting: i === k };
  for (const cover in COVERS) {
    if (landed.has(cover) && order.indexOf(cover) < k) {
      for (const hid of COVERS[cover]) out[hid] = { shown: false, lifting: false };
    }
  }
  return out;
}
