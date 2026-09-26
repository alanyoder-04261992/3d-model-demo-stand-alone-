---
name: part-dormer
description: The shed dormer on the roof of a Dormer Shed (front wall, cheeks, white four-light windows, ribbed steel roof, fascia and soffit) -- read before changing the dormer's size, windows or roof.
---

# Dormer (`parts/dormer.js`)

## What it is in real life

A shed dormer is a box built up out of the main roof on the door side:

* a short upright **front wall**, sided like the building, standing just above
  the eave (0.5 ft in from the wall line) and resting on the main roof; its
  height is the room under the ridge less 0.35 ft, at most 1.95 ft and never
  under 1.2 ft;
* two triangular **cheeks** of siding closing it down to the main roof;
* **trim boards** at both front corners and a trim **band** under the roof
  edge;
* a row of **white-framed four-light windows** -- three when the dormer is
  8 ft or wider, two otherwise, 0.55 ft apart, each at most 2.7 ft wide and
  1.15 ft tall;
* a single-slope **steel roof** with ribs every 9 in (on the world rib grid,
  like the main roof, no screws), rising BACKWARD from the front wall and
  tying into the main roof just under the ridge cap, overhanging 0.30 ft at
  the front and 0.26 ft each side;
* a **fascia** across the front and down both sides, and a **soffit**
  closing the front overhang.

Its width along the building is the customer's pick -- the design's dormer
size, `plan.state.dormer` ("6", "9" or "12" on the standard line; the id IS
the width in feet) -- but never more than the building's length less 2 ft.
It sits on the +x (door) side, always. A dormer style's main roof is a little
steeper (`roof.dormerRise`, Barnwright's W x 0.30), which gives it the room to
stand.

## Stage

`dormer` (id 13, kind `finish`): the Finished view; in Watch-it-build it
lands after the roofing. Its framing is a separate NEW part,
`parts/dormer-frame.js` (stage `dormer-frame`, which the roofing covers).
PIPELINE entry `dormer` (entry 13, `parts/index.js`): straight after the
roofing and before the doors and windows, as in Barnwright's buildShed
(4040-4041). It runs only on a style with the `dormer` trait and a design
whose dormer is not "none" (`appliesTo`).

## Construction settings

None read by the part. The main roof it sits on comes from `plan.prof`,
whose dormer-style rise is `roof.dormerRise` (default `{"w": 0.30}`,
`library/construction.json`) -- change that and the dormer's face height
follows it.

The manufacturer file's dormer `widthFt` (6, 9, 12) is NOT read: the resolved
catalogue does not carry it, so the width is `+plan.state.dormer`, as in
Barnwright. A dormer id that is not its own width would need
`model/company.js` to carry `widthFt` through first. MEASURED (Sep 2026): a
Dormer Shed whose dormer id is `"6ft"`, `"six"` or missing draws 38 dormer
triangles with NaN corners (the window band) -- nothing validates that a
manufacturer's dormer ids are numbers, so a new manufacturer file must name
its dormers by their width in feet until that is fixed. (The dormer framing,
`parts/roof-frame.js dormerGeom`, draws nothing for such an id.)

## Where it came from in Barnwright

`boisterous-lokum-a737e0/public/3ddesign.html` (pinned SHA-256
`0bdcf663c5cb988623d2cb0dd271156fb690564072b301b0a15b917fd921ac6c`),
`dormer(prof,W,L,dw)` lines 2978-3059, called from buildShed 4040-4041:
`if(t.dormer && state.dormer!=="none") dormer(prof,W,L,+state.dormer);`.

Porting edits (contract, Porting rules), and nothing else:
* rule 1: `state` -> `plan.state`, `T()` -> `plan.t`, `STEP` -> `kit.STEP`,
  `RIB`/`y0` from `engine/constants.js`, `profileYat` from
  `model/roof-shapes.js`, texture names from `engine/tex-names.js`; `mat` and
  `pushQuad` are the kit's; the call passes `plan.prof`, `plan.W`, `plan.L`,
  `+plan.state.dormer`;
* rule 2: the call's test is the style's `dormer` trait (`appliesTo`);
* `dormer()` stays a function declaration (inside `build`), body as written;
* rule 7: `kit.setStage("dormer")`.

## The owner's facts

Barnwright's comments, kept word for word in the code: "vertical face set
just above the eave, resting on the main roof"; "dormer roof rises backward
and ties in just under the ridge cap"; "window band -- white-framed 4-lite
windows"; "dormer panel ribs, same profile as the main roof"; "face trim --
corner boards + band under the fascia"; "soffit closing the front overhang".
Dormer sizes are 6, 9 or 12 ft (Barnwright's DORMERS; the Yoder site
standardised on the 6 ft as its standard dormer -- company data).

## Kept quirks

* The unused local `slope` (and `R`) is kept.
* The corner boards are 0.29 ft on the +z side and 0.26 ft on the -z side.
* No screws on the dormer roof; its ribs are a little smaller than the main
  roof's (0.055 high).
* The dormer asks for "body" with the PAINTED siding settings and sets its
  `age` to 4. "body" already exists (made by `engine/assemble.js`), so on a
  painted building this changes nothing; on a metal building with a dormer
  (none on the standard line) it would set the metal's age to 4, as
  Barnwright would.
* It is the FIRST to ask for "glass" (`glassM = 1`) and "white" (#FBFBF8), in
  that order, so on a Dormer Shed those two buckets are made here, before any
  door or window -- look-defining draw order.

## How to change it safely

* Run `node tools/check-golden.mjs --part dormer` before and after; it must
  stay green (7 recorded Dormer Sheds: 8x12, 10x20, 12x32 and the 6, 9 and
  12 ft dormers, including a 12 ft dormer clamped on an 8x12).
* Keep the `mat()` calls in their order ("glass" before "white").
* THE DORMER'S NUMBERS LIVE TWICE. `dormerGeom(plan)` in
  `parts/roof-frame.js` repeats this part's arithmetic (xF = W/2 - 0.50,
  xI = 0.12, yI, the 1.2-1.95 ft face, ovF 0.30, ovS 0.26, the width
  min(dw, L-2), the window band) so the dormer's NEW framing
  (`parts/dormer-frame.js`) and the cut main trusses fit inside it. Change a
  number here and change it there too, then run
  `node tools/check-framing-roof.mjs` and `node tools/check-framing.mjs`
  (their region test keeps framing under the dormer's roof).
* The dormer's roof ribs use the world 9 in grid (`k * RIB`) so they line up
  with the rib shading in the roof texture; do not shift them.
* If the look must really change, re-record the golden fixtures on purpose
  (`node tools/capture-golden.mjs`, with a reason).

## Checks that guard it

* `node tools/check-golden.mjs --part dormer` -- every dormer triangle of all
  148 recorded Barnwright buildings, number for number (828 triangles in 7
  buildings); with `--case` on those 7 it also proves the dormer drawn on its
  own is exactly its triangles on the whole building.
* `node tools/check-parts.mjs` -- valid part, caption fills in, this skill.
* `node tools/check-imports.mjs` -- loads in Node with no browser.
