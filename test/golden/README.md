# The golden fixtures — Barnwright's own drawing, recorded

Alan's first ask for this designer was "make it look like Barnwright's". These
files are how that is proved. They are **Barnwright's exact answers**, recorded
from its real 3D designer (`boisterous-lokum-a737e0/public/3ddesign.html`,
read only, opened at `3ddesign.html?light=warm` -- its warm late-afternoon
light; since Oct 10 2026 the page without it draws the Yoder site's look),
for 148 buildings. Our engine is then asked to draw
the same buildings, and `tools/check-golden.mjs` demands the same triangles,
and `tools/check-look.mjs` the same pictures.

Nothing in here is typed by hand. Everything except `barnwright-catalogue.json`
(written by `tools/extract-barnwright-catalogue.mjs`) is written by
`tools/capture-golden.mjs`.

## What is here

| file | what it holds |
|---|---|
| `cases.json` | the 148 buildings, one line each saying what it is; which have a look picture and which a full vertex list |
| `geometry/<case>.json` | one building, see below |
| `geometry-full/<case>.json` | every vertex number of six buildings (one per roof shape, and the kennel): `ut-8x12` gable, `lb-8x12` gambrel, `cs-8x12` saltbox cottage, `bu-6x8` lean-to, `ss-8x12` single slope, `dk-8x12` kennel |
| `look/<case>.png` | the finished picture of 24 buildings: every style at its typical size, plus the Utility Shed with its doors selected (the blue glow) |
| `textures.json` | a fingerprint of each of the 11 surface pictures Barnwright paints, with its random numbers seeded |
| `barnwright-catalogue.json` | Barnwright's price and parts tables (another tool; real prices, used only by checks) |

### A `geometry/<case>.json` file

* `steps` — what was done to Barnwright's page, in Barnwright's own terms
  (pick a style, a size, add a door facing a wall, tick shutters...). Every
  step goes through Barnwright's own functions (`setType`, `setSize`,
  `resetItems`, `addItem`, `flipPorch`, `select`...), or changes an item and
  then calls `clampPos` exactly as its item sheet or a drag does.
* `state` — Barnwright's exact `state` afterwards: style, size, colours as hex,
  every item with its id and position, the selection, porch settings, dormer,
  options, electric package. **This is what the check feeds our engine.**
* `viewport` (1440x900, 1 pixel per pixel) and `canvas` (the 3D canvas's size
  on that page: 742x803 — taller than wide, so Barnwright's camera backs off by
  its 1.16 rule), `fitDist` (the camera fit) and `gr` (the lawn's radius).
* `order` — the materials in the order Barnwright draws them.
* `buckets` — one per material, in that order:
  * `params` — texture (by name: `siding metal trim flat grass glass roofMetal
    roofCap ao aoV aoCorner`), `tint` (linear colour, exact), `spec`, `gloss`,
    `glow`, `bump`, and the flags `age glassM turf noCast unlit` when set;
  * `triangles` and `hash` — how many triangles, and a fingerprint of all of
    their numbers;
  * `segments` — which part each run of triangles belongs to,
    `{part, from, count}` counted in triangles;
  * `parts` — per part: its triangle count and a fingerprint of just its
    triangles (so one part can be proved at a time);
  * `prints` — 6 hex characters per triangle, in order: a short fingerprint of
    each single triangle, so a check can name the FIRST triangle that differs.
* `parts` / `totals` — summaries.
* `look` (only on the 24 picture cases) — the file, the camera (`yaw`, `pitch`,
  `dist`, `fitDist`), the canvas size (1113x1204 drawn, shown at 742x803:
  Barnwright draws 1.5x bigger than the screen), and how it was drawn.

### The fingerprint ("hash") rule

A vertex is 8 numbers: position `x y z`, face normal `nx ny nz`, texture
`u v` (our engine adds a 9th, the building stage; the check drops it). For a
list of vertex numbers, in the order they were drawn:

1. round each: `Math.round(x * 1e4) / 1e4`, and `-0` becomes `0`;
2. write each with `toFixed(4)`;
3. join them with `,`;
4. take the SHA-256 of that text, in lower-case hex.

The code for this is `hashFloats` / `printsOf` in `tools/lib/golden-cases.mjs`,
which both the capture and the checks import, so they cannot disagree.

### Which part a triangle belongs to

Every triangle is labelled while Barnwright draws it, using the table in
`tools/lib/barnwright-blocks.mjs` (pinned to the SHA-256 of Barnwright's file):
the innermost of Barnwright's part functions that is running wins
(`profileRoof` roofing, `dormer`, the porch functions, the kennel functions,
and `renderItem` by the item's kind — shutters count as the window); anything
drawn by `buildShed`'s own lines takes the part of that line range. A triangle
that cannot be labelled stops the capture. All 21 parts appear somewhere in
the 148 cases.

One judgement call: the Dog Kennel's inner back wall (`bodyIn`, drawn inline
in the walls loop) is labelled `siding`, because it is drawn by the siding
lines of `buildShed`; the kennel's own front and side walls, run, gates and
chain-link are `kennel`.

### The look pictures

Drawn with Barnwright's opening camera angle (yaw 0.62, pitch 0.215) at exactly
the fitted distance, shadows forced on, supersampling capped at 2, the
frame-cost watchdogs frozen (their warm-up pushed out of reach, so they never
switch shadows or sharpness off), no auto-spin, the studio scene. `draw()` is
called TWICE and the canvas read in the same step (Barnwright's canvas forgets
its picture once the browser shows it).

Why twice: Barnwright's first draw after every rebuild has its whole shadow
pass refused by WebGL. `buildShed` deletes the old vertex buffers while the
normal and texture arrays are still switched on and pointing at them, so every
shadow-pass draw fails (`INVALID_OPERATION`). The shadow map has already been
cleared by then, so that frame has **no cast shadow at all** (checked: pixel for
pixel the same as a draw with shadows switched off). Whether the recording's
first draw was that frame depended on whether the page's own animation loop
happened to draw in between, which made one recording show a cast shadow and
the next one not. The second draw is the real picture: a shadow made for this
building from this camera, and the capture fails if WebGL reports any error in
it.

This is **visible in Barnwright itself**: its loop only draws while something
has asked for a draw, and one draw satisfies that, so after a rebuild with the
camera still (a colour tap, a size change, an item added) the customer sees the
building without its cast shadow until the camera next moves. The recorded
picture is Barnwright's look once the camera has moved. Our engine's renderer
must switch those arrays off before its shadow pass (`engine/renderer.js`
does), so that ITS first draw is already this picture -- `docs/DIFFERENCES.md`
is the place to say so.

The background is see-through: on Barnwright's page the grey backdrop is the
page behind the canvas. The browser's
PNG is decoded to its exact pixels and saved again losslessly in one fixed way,
so the file only changes when the picture does.

### The textures

Barnwright paints its textures with random numbers, so they differ a little on
every load. For recording, the random numbers are made repeatable: each
texture restarts the same generator our engine uses in tests
(`mulberry32(textureSeed(i))`, `engine/seeded.js`), at the moment Barnwright
starts painting that texture. The fingerprint is of the exact bytes sent to the
graphics card. Every one of the 148 page loads of a capture gave the same
bytes; `mathRandomCallsOutsideTextures: 0` shows nothing else in Barnwright
uses random numbers.

## Re-recording

Only on purpose — a changed fixture means "Barnwright looks different now".

```
node tools/capture-golden.mjs            # record all 148 (about 5 minutes)
node tools/capture-golden.mjs --check    # record again into a temporary folder and
                                         # prove it is byte-for-byte what is here
node tools/capture-golden.mjs --only=ut-10x20,lb-8x12   # just these cases
```

It refuses to run if Barnwright's `3ddesign.html` is not the exact copy the
labelling table was written for; then somebody must re-read `buildShed`,
update `tools/lib/barnwright-blocks.mjs` and its pin, and re-record, saying why
in the commit. New cases go in `tools/lib/golden-cases.mjs`.
