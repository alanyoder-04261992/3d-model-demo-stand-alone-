---
name: check-the-look
description: Prove the finished building is still Barnwright's shape for shape and lit the way the Yoder Storage Barns site lights it -- use before and after any change to a finished part, the engine, the shaders, the textures, the roof shapes, the standard doors and windows or the construction defaults, whenever check-golden goes red, and when Alan says something looks different from Barnwright or from his own website.
---

# Prove the finished look is still Barnwright's

Alan's first ask: the finished building must **look exactly like Barnwright's
3D designer**. `test/golden/` holds Barnwright's own drawing of 148 buildings,
recorded from its real page (`test/golden/README.md` explains every file). The
Outside view is held to it triangle for triangle. The Framing view, Watch it
build, the ramp and the true-colour light are new and are proved separately;
none of them may move a finished triangle.

His later ask (Oct 2026: "use the 3d configuration in yoder storage barns ...
change the building looks only"): the buildings are **lit the way his own
Yoder Storage Barns site lights them**. That is true colour
(`look.trueColour`), now the standard -- the demo, the template, the starter
and any company that leaves `look` out. It is three things, each read against
`/home/user/yoder-storage-barns/design.html` (read only) by
`tools/check-shaders.mjs`: the site's fragment shader (`FSTRUE`), its rooms
(`TRUE_SCENES`) and its darker contact shadow (the YODER CONTACT SHADOW block
in `engine/textures.js`). It changes colours only. The golden and look
fixtures stay Barnwright's, in Barnwright's warm light, drawn with the
Barnwright company (`look.trueColour: false`).

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
   Barnwright's byte for byte; the true-colour one is the Yoder site's and
   differs from Barnwright's only in its six documented colour lines; the
   true-colour rooms and contact shadow are the Yoder site's; the vertex
   shaders only add the building-step table; the texture painters are
   Barnwright's text.
5. **`node tools/check-engine-smoke.mjs`** (browser). The first frame after a
   rebuild has its shadows (docs/DIFFERENCES.md #1), true colour paints the
   same eleven textures and then the Yoder contact shadow, and the Finished view of
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
use the Playwright loader in `tools/lib/barnwright-page.mjs` (`loadPlaywright`)
with Chromium and `--use-angle=swiftshader --enable-unsafe-swiftshader
--ignore-gpu-blocklist`, wait for `window.shedUI.ready`, and save into
`test/out/`. That loader targets the original Linux environment; on another
machine, use available browser tooling for visual inspection and report any
automated checks that could not run. The demo company now uses the Yoder
site's true colour (grey light, a neutral room, a darker contact shadow), so
it looks different from Barnwright's page on purpose: to compare with
Barnwright, open `?company=demo` with a copy of the demo whose
`look.trueColour` is `false`, or use the checks (they draw the Barnwright
company). To compare the light with the Yoder site, open
`yoder-storage-barns/design.html` the same way (its 7171-line page carries
Yoder's own colour list and standard doors, so pick the same colours and
doors).

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
* **Barnwright's file changed, but not its drawing** (Oct 6 2026: only its
  saving code, after line 5792, changed): prove the lines the labelling
  reads are byte for byte the same (in Barnwright, read only:
  `diff <(git show <old>:public/3ddesign.html | head -N) <(git show <new>:public/3ddesign.html | head -N)`),
  move the pin (`BARNWRIGHT_SHA256` in `tools/lib/barnwright-blocks.mjs`,
  `PINNED_SHA256` in `tools/check-golden-labels.mjs`), re-run
  `node tools/extract-barnwright-catalogue.mjs` and
  `node tools/capture-golden.mjs`, and prove with `git diff` that only the
  recorded `sha256` lines in `test/golden/` changed. If anything else
  changed, it is a look change: stop and tell Alan; or
* **new cases** are added in `tools/lib/golden-cases.mjs`.

Re-recording can never bless a change in THIS engine -- it would record
Barnwright's picture again. If Alan decides the finished look should differ
from Barnwright's, that is a company setting (the way `look.trueColour` is)
that is always off for the Barnwright company the checks draw, listed in
`docs/DIFFERENCES.md`, with check-golden still green with it off. Whether the
demo and new companies get it is Alan's call: for true colour he chose yes
(docs/DIFFERENCES.md #25).

The Yoder site's look is followed the same way: if Alan changes how his own
site lights a building, re-read its `FS`, `SCENES` and `texAO` in
`yoder-storage-barns/design.html`, copy them into `FSTRUE`,
`TRUE_SCENES` and the YODER CONTACT SHADOW block, and run
`node tools/check-shaders.mjs`. Things the site's copy draws worse than
Barnwright does (DIFFERENCES #25, "Not taken from the Yoder site") stay
Barnwright's.
