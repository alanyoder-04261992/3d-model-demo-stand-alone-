---
name: part-ground
description: The ground under the building (lawn or studio floor), the soft contact shadow under it and the eave shadow on barn walls -- read before changing the lawn size, the ground colour or those shadows.
---

# Ground (`parts/ground.js`)

## What it is in real life

The customer's yard the building is set down in. The picture draws:
* a round **lawn** (in the studio scene, a plain light floor that melts into
  the backdrop) far wider than the building, so the building never sits on a
  "doormat";
* a soft **contact shadow** on the ground around the skids, 0.85 ft wider
  than the building on every side;
* on barn (gambrel) roofs, the **eave shadow** -- the top 1.05 ft of each long
  wall darkened where the deep eave shades it.

## Stage

The lawn is stage `site` (kind `always`: in every view, and the first step of
Watch-it-build). The two shadows are stage `shading` (kind `finish`: Finished
view only; they appear when the playback ends). PIPELINE entry 15
(`parts/index.js`), after every door and window, as in Barnwright's
`buildShed`: its three materials (`ground`, `ctshadow`, `eaveAO`) are made
last and drawn last.

The part returns `{ gr }`, the lawn's radius. `engine/assemble.js` hands it
back, and the renderer sizes the distance haze from it (Barnwright kept it in
`window.__GR`).

## Construction settings

None. What the ground looks like comes from the SCENE (`engine/scene-data.js`,
`kit.view.scene.ground`: studio floor, yard grass, paper sweep; its tint,
shine, bump and the `turf` flag the shader uses to roll the lawn), which is
the company's `look.scene` (and `look.trueColour`).

The contact shadow's picture (`texAO`) comes from the renderer, not from
this part: with `look.trueColour` on (the standard, the Yoder site's look)
it is the Yoder site's darker gradient (`#3f3f3f` in the middle), otherwise
Barnwright's (`#565656`) -- engine/textures.js, YODER CONTACT SHADOW. The
part draws the same triangles either way; only the shade on them differs.

## Where it came from in Barnwright

`boisterous-lokum-a737e0/public/3ddesign.html` (pinned SHA-256
`85c4b022d2f75db2145f4ff5cf1ea43c1b52074f8972b96180d64840eb4c5d36`),
`buildShed` lines 4044-4074: the lawn disc (4044-4061), the contact shadow
(4062-4065), the eave shadow on gambrel roofs (4066-4074).

Porting edits (contract, Porting rules): `SC()` -> `kit.view.scene`;
`cam.fitDist` -> `kit.view.fitDist`; `window.__GR = GR` -> returned as
`{ gr }` (rule 6); the textures are named (`engine/tex-names.js`); `W L ws`
are `plan.W plan.L plan.ws`; `kit.setStage("site")` / `kit.setStage("shading")`.
The radius sum is in `groundRadius(fitDist, W, L)`, the same expression.

## The owner's facts

Barnwright's comments, kept word for word in `parts/ground.js`:

> the lawn was painted at nearly full brightness, and full sun on top of that
> took it to a pale mint no grass has ever been. Held down to roughly what a
> mown St Augustine yard actually reflects, it reads as grass again.

> THE LAWN. It used to be a disc half the camera distance across, which put
> the haze about a barn-and-a-half out and left the building sitting on a
> green doormat. A real yard runs off past the fence, so this one does too --
> the grass stays grass out to arm's length and only then goes soft.

## Kept quirks

* The lawn radius is `max(1.28 x fitDist, 3 x the longer side)`, so it
  depends on the CAMERA FIT, which depends on the picture's shape: the same
  building gets a different lawn on a phone and on a desktop. The renderer
  keeps the radius from the last build when the window is resized
  (Barnwright did the same).
* The lawn is a 72-sided disc at y 0.004 (just above the ground plane); the
  contact shadow is at y 0.012; the eave shadow sits 0.02 ft proud of the
  wall.
* The lawn is made with `MAT`, not `mat`, so it never glows when something is
  selected; it casts no shadow (`noCast`).
* On a corner-porch cabin `L` includes the 4 ft porch deck (Barnwright's
  `dims()`), so the contact shadow covers the porch too.

## How to change it safely

* The ground's colour and texture belong to the scene
  (`engine/scene-data.js`), not to this part.
* The lawn radius feeds the haze: change it and the whole picture's fog moves.
  Run `node tools/check-golden.mjs --part ground` (it also compares `gr` on
  every building) and the look check before and after.
* If the look must really change, re-record the golden fixtures on purpose
  (`node tools/capture-golden.mjs`, with a reason).

## Checks that guard it

* `node tools/check-golden.mjs --part ground` -- the lawn, contact shadow and
  eave shadow triangles of all 148 recorded Barnwright buildings, number for
  number (11,108 triangles), and the lawn radius `gr` on every one.
* `node tools/check-parts.mjs` -- valid part, caption, this skill.
* `node tools/check-imports.mjs` -- loads in Node with no browser.
