# The parts of a shed, one module each

Alan asked for "a 3D model of each part of a shed" and "a skill for each part".
This folder is that: one file per real-life part (the skids, the floor, the
siding, the roofing, a door ...). `engine/assemble.js` puts a whole building
together by running them in `PIPELINE` order (`parts/index.js`), which is
Barnwright's own `buildShed` order line by line. The contract for all of it is
`docs/ARCHITECTURE.md`; this page is the short version for whoever writes or
changes a part.

## What a part file exports

```js
export default {
  id: "skids",                 // = the file name; skill at .claude/skills/part-skids/SKILL.md
  name: "Skids",               // shown in the parts gallery
  stage: "skids",              // a stage key from parts/stages.js, or a list of them
  realLife: "Treated {skids.size} runners ...",   // caption; {a.b} = plan.construction.a.b
  appliesTo(plan) { return true; },               // does this building have one?
  build(plan, kit, core) { ... },                 // draw it
};
```

* `id` equals the file name (`parts/openings/index.js` is `openings`). A
  module in a sub-folder (a draw module under `parts/openings/`) may instead
  take the id of the part label it draws (`door-wood`, `window` ...), as
  listed in its folder's PIPELINE entry `tags`; a skill may likewise be for
  such a label (`.claude/skills/part-door-wood/`).
* `stage` is one key or a list of keys; the first is the main one. A frame
  part (a stage of kind `frame`) is never drawn in the Finished view.
* `realLife` is a template. `{floor.joist}` is replaced by
  `plan.construction.floor.joist` (`fillRealLife` in `parts/index.js`). A frame
  part's caption may not contain a digit outside a placeholder.
* `pending: true` marks a STUB: a placeholder that draws nothing, waiting to be
  ported. `tools/check-golden.mjs` reports its triangles as PENDING instead of
  failing them, and `tools/check-parts.mjs` does not ask it for a skill yet.
  `pending` may also be a list of the part tags still pending (e.g.
  `["roll-up"]`) while the rest of the module is done. Remove it when the part
  is finished and its golden check is green.
* `lesson: "<page>"` marks a LESSON part: a construction detail Alan taught
  that only that lesson page draws (`window-framing.html`,
  `learn.html?step=truss` ...). It applies only to a plan the lesson builds
  (a `windowHeaderStudy`, a `trussStudy` ...), so no building in the designer
  has one (CLAUDE.md rule 5 keeps the designer apart from the lessons). The
  parts gallery lists it under "Only in a lesson" with a link to that page,
  and `tools/check-gallery.mjs` proves both halves: no building draws it,
  and it draws on its own from the plan its lesson page builds (add that
  plan to `LESSON_PLANS` in the check).
* A module may export helpers another PIPELINE entry calls at Barnwright's
  position (the kennel's `front` and `side` are called from inside the siding
  loop). Wrap the helper's drawing in `kit.part("<owner id>", fn)` so the
  triangles are attributed to their owner.

## What `build(plan, kit, core)` receives

* **`plan`** -- the frozen snapshot of the building (`model/plan.js`):
  `plan.state` (Barnwright's `state`), `plan.t` (the style: `T()`), `plan.d`,
  `plan.W`, `plan.L`, `plan.topY`, `plan.span` (`pSpan()`), `plan.ws`
  (`wallDefs()`), `plan.prof` (the roof profile), `plan.CAT`, `plan.STEP`,
  `plan.construction`. It is deep-frozen: a part can never change the design.
* **`kit`** -- the drawing toolbox for THIS build (`engine/buckets.js`):
  `mat MAT DECAL pushTri pushQuad quadUV box wq wbrace wtri3 gq2 gbrace2 wallPt
  beam setStage setItem hit part`, and `kit.STEP`, `kit.constants`,
  `kit.view.fitDist` (the camera fit), `kit.view.scene` (the scene settings,
  Barnwright's `SC()`). Exactly ONE kit is made per build, by `assemble`; a
  part never makes its own.
* **`core`** -- Barnwright's five core materials, made by `assemble` before any
  part runs, in Barnwright's order and with Barnwright's settings, under the
  names Barnwright's code uses for them (so ported code reads the same):

  | `core.` | Barnwright | material key | what |
  |---|---|---|---|
  | `mB`   | `mB`   | `body`  | the siding (texMetal on a metal building), with `age` |
  | `mT`   | `mT`   | `trim`  | the painted trim |
  | `mWd`  | `mWd`  | `wood`  | plain wood (#6f5c42) |
  | `mSk`  | `mSk`  | `skid`  | the skids (#6d5f49) |
  | `mFlr` | `mFlr` | `kfloor` on a kennel, else the same bucket as `wood` | the floor deck |

  Why a third argument and not on the plan or the kit: the plan is frozen
  before any material exists, and the kit is frozen by `makeKit` and belongs
  to the engine. The core materials belong to one build, so they travel with
  the build call.

## Stages and attribution

* Call `kit.setStage("<stage key>")` before drawing. Drawing with no stage
  throws. `assemble` runs every entry inside `kit.part(<entry's part>, ...)`,
  and `kit.part` puts the stage back when it ends, so every entry starts with
  NO stage and must say its own.
* Every triangle is attributed to the entry's part (`part` in `PIPELINE`). A
  part that draws triangles belonging to another real part wraps them:
  `kit.part("kennel", function(){ ... })` -- the innermost wins. The openings
  entry is wrapped as `openings`, which is not a golden part on purpose: every
  item must be re-attributed (`door-wood`, `window` ...), and a triangle left
  as `openings` fails the golden check.
* A part may return a value. The ground part returns `{ gr }` (the lawn
  radius, Barnwright's `window.__GR`), which `assemble` hands back.

## Materials: first call wins

`MAT`/`mat`/`DECAL` with a key that already exists hands back the existing
bucket and IGNORES the new paint, and `ORDER` (the draw order) is the order
buckets were first made. Barnwright relies on both, so the order the entries
run in -- and the order of `mat()` calls inside a part -- is part of the look.
Never reorder them, never "tidy" a duplicate `mat()` call away.

## Adding a part

1. Write `parts/<id>.js` (read a finished part like `parts/skids.js` first).
2. Add it to `PIPELINE` in `parts/index.js` at the Barnwright position (or,
   for new framing, among the frame entries), with the golden part tags it
   produces (`tags`).
3. Write `.claude/skills/part-<id>/SKILL.md` from `docs/SKILL-TEMPLATE.md`.
4. Run `node tools/check-parts.mjs`, `node tools/check-imports.mjs` and
   `node tools/check-golden.mjs --part <tag>`.

## Checks

* `node tools/check-golden.mjs` -- every triangle of the 148 recorded
  Barnwright buildings, per part (pending parts reported, not failed).
* `node tools/check-parts.mjs` -- every part is a valid part, its caption fills
  in, it has its skill and every skill has its part.
* `node tools/check-imports.mjs` -- every part loads in Node with no browser.
* `node tools/check-all.mjs` -- all of the above and everything else.
