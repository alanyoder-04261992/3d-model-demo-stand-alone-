---
name: check-the-look
description: Prove the finished building still looks exactly like Barnwright's 3D designer -- use before and after any change to a finished part, the engine, the shaders, the roof shapes, the standard doors and windows or the construction defaults, whenever check-golden goes red, and when Alan says something looks different from Barnwright.
---

# Prove the finished look is still Barnwright's

Alan's first ask: the finished building must **look exactly like Barnwright's
3D designer**. `test/golden/` holds Barnwright's own drawing of 148 buildings,
recorded from its real page (`test/golden/README.md` explains every file). The
Outside view is held to it triangle for triangle. The Framing view, Watch it
build, the ramp and the true-colour light are new and are proved separately;
none of them may move a finished triangle.

## What can change the look

Any finished part in `parts/` (and `parts/openings/`); anything in `engine/`
(materials and their order, textures, shaders, the renderer, the camera fit);
`model/roof-shapes.js`, `model/layout.js`, `model/loadouts.js`,
`model/frame.js`; the construction defaults the drawing reads
(`library/construction.json`: door heights, the window-top rule, the skid
table, the roof numbers); and the Barnwright style entries in
`library/manufacturers/standard.json`. Run the checks below before you start
(so you know they were green) and after.

## The checks, fastest first

1. **`node tools/check-golden.mjs`** (Node, about 20 seconds). For every one of
   the 148 buildings: the camera fit and lawn radius; per material and per
   part, the triangle count and a fingerprint of every number; then the draw
   order (`ORDER`), every whole material and its settings; a part drawn on its
   own keeps exactly its triangles; and drawing the framing too changes nothing
   finished. On a difference it names the building, the material, the part and
   the FIRST triangle that differs (with its numbers on the six buildings whose
   every vertex is on file, `test/golden/geometry-full/`).
   * `--part skids,floor` -- just those part labels (fast, while working on one
     part); `--case ut-8x12,lb-8x12` -- just those buildings; `--verbose` -- a
     line per building and part; `--whole` -- compare the whole building even
     while a part is still a stub.
2. **`node tools/check-look.mjs`** (browser). The 24 finished pictures in
   `test/golden/look/` (every style at its usual size, and the Utility Shed
   with its doors selected) drawn by our engine, set up exactly as
   Barnwright's page was for the recording: the eleven textures are
   Barnwright's bytes, and EVERY PIXEL of every picture is Barnwright's. A
   difference writes `test/out/look-diff/<case>.png` (Barnwright's, ours,
   where they differ). It also proves the comparison can fail, that
   `look.trueColour` changes the colour and nothing else, and that a Finished
   rebuild of a 14x40 stays inside a time bound. `--case ut-10x20,lb-10x20`
   for just those buildings.
3. **`node tools/check-engine.mjs`** (browser). Barnwright's own page and ours,
   side by side in one browser: every drawing primitive, the maths, the camera
   fit, all eleven textures pixel for pixel with the same seeded randomness,
   and five whole pictures (styles, scenes, a selected item, camera angles,
   the Finished step table on) byte for byte.
4. **`node tools/check-shaders.mjs`** (browser). The fragment shader is
   Barnwright's byte for byte; the true-colour one differs only in its six
   documented colour lines; the vertex shaders only add the building-step
   table; the texture painters are Barnwright's text.
5. **`node tools/check-engine-smoke.mjs`** (browser). The first frame after a
   rebuild has its shadows (docs/DIFFERENCES.md #1), and the Finished view of
   a building carrying framing is exactly the building without it.
6. **`node tools/check-golden-labels.mjs`** (browser, a few minutes). Every
   recorded triangle's part label, proved a second, independent way -- so
   `--part` in check-golden is proving the right triangles.
7. **`node tools/check-model-live.mjs`** (browser). Sizes, walls, roof line,
   standard doors and windows, clamping and prices against Barnwright's live
   page, for every style at every size.
8. **`node tools/check-ui.mjs`** and **`node tools/check-blueprint.mjs`**
   (browser). The page and the floor plan look like Barnwright's (type sizes,
   spacing, the plan side by side, pixel for pixel outside the lettering).

`node tools/check-all.mjs --fast` runs the Node ones (1); `node
tools/check-all.mjs` runs all of them.

## When check-golden goes red

A red golden check is a look change. **Fix the code**; do not re-record.

* Narrow it: `--part <label>` for the part you touched, then `--case <id>` for
  the first building named.
* The usual causes: a changed number in ported code; a `mat()` call moved,
  removed or "tidied" (first call wins, and first use sets the draw order); an
  entry moved in `parts/index.js`; drawing without the right `kit.setStage`
  or `kit.part` (triangles labelled with the wrong part); a construction
  default changed that the finished drawing reads.
* **Kept Barnwright quirks are look-defining -- never "fix" them**: `CASING` is
  0.27 (not 3 1/2 in); metal siding texture coordinates divide by `GROOVE`;
  the gambrel's rake overhang is forced to 0.10; `roofRise` is 0.45W on the
  mini barn; the corner porch adds 4 ft to the length; the warm sun in the
  fragment shader; the floor slab is drawn in segments inset 0.03 ft;
  resizing the browser window re-fits the camera but keeps the lawn radius of
  the last build. Each part's skill lists its own quirks.
* Behaviour that deliberately differs from Barnwright is in
  `docs/DIFFERENCES.md`, and none of it changes a finished picture.

## Looking at it yourself

`npm run serve`, then compare `http://127.0.0.1:8282/?company=demo` with
Barnwright's own designer at the same style, size and colours. For pictures
use Playwright from `/opt/node22/lib/node_modules/playwright/index.js` with
Chromium and `--use-angle=swiftshader --enable-unsafe-swiftshader
--ignore-gpu-blocklist`, wait for `window.shedUI.ready`, and save into
`test/out/`. The demo company uses Barnwright's warm light
(`look.trueColour: false`); a company with true colour on looks different
on purpose (grey light), so never compare the look with one.

## Re-recording the fixtures, on purpose only

The fixtures are **Barnwright's answers**. `node tools/capture-golden.mjs`
records them again from Barnwright's page (read only, at
`/home/user/boisterous-lokum-a737e0/public/3ddesign.html`, about five
minutes); `--check` records into a temporary folder and proves the result is
byte for byte what is in `test/golden/`; `--only=ut-10x20,lb-8x12` does just
those cases. It refuses to run when Barnwright's file is not the pinned copy
(its SHA-256 in `tools/lib/barnwright-blocks.mjs`).

So re-recording is right only when:

* **Barnwright's own designer changed** and Alan wants this one to follow it:
  re-read Barnwright's `buildShed`, update the line ranges and the pin in
  `tools/lib/barnwright-blocks.mjs`, re-run
  `node tools/extract-barnwright-catalogue.mjs`, re-record, port the change,
  and say why in the commit; or
* **new cases** are added in `tools/lib/golden-cases.mjs`.

Re-recording can never bless a change in THIS engine -- it would record
Barnwright's picture again. If Alan decides the finished look should differ
from Barnwright's, that is a company setting that is off for the Barnwright
and demo catalogues (the way `look.trueColour` is), listed in
`docs/DIFFERENCES.md`, with check-golden still green with it off.
