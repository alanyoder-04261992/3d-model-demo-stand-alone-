---
name: part-gable-vent
description: The louvred vent high in each gable end of a portable building -- read before changing where the vent sits, its size, or which buildings have one.
---

# Gable vent (`parts/gable-vent.js`)

## What it is in real life

A louvred vent set into the siding high in each gable end, so hot air can
leave the roof space. The drawing is a frame painted the siding colour at
0.82 brightness, 0.03 ft proud of the siding, with five louvre slats in the
siding colour at 0.45 brightness, 0.045 ft proud:

* on a gable, gambrel or saltbox end: centred under the ridge, 0.92 ft below
  it, 1.12 x 0.76 ft -- only when the ridge is more than 1.2 ft above the
  wall top, and never on the Standard Barn (the style trait
  `"gableVent": false`);
* on a lean-to: 0.9 ft in from the high (-x) side, smaller (0.84 x 0.52 ft),
  0.34 ft under a point 0.20 ft below the high side's top;
* on a single slope: 0.9 ft in from the high (+x) side, 0.92 ft under a
  point 0.26 ft below the high side's top.

## Stage

Stage `gable-end` (kind `finish`). PIPELINE entry 9 (`parts/index.js`), after
the gable band and before the single-slope belt band. The `vent` and `ventD`
materials are first made here, at the F end, exactly where Barnwright first
makes them (its gable loop draws fill, band and vent of F, then of B).

## Construction settings

* `roof.shapes.lean.rise`, `roof.shapes.slope.rise` -- where the vent sits on
  a lean-to or single slope (under the high side). Defaults `{"w": 0.17}` and
  `{"w": 0.28}`, bit for bit Barnwright's `W*0.17` and `W*0.28`, the same
  settings the roof line is drawn from. The vent is hung a FIXED distance
  under the high side (Barnwright's numbers), not under the sloping roof line,
  so it only fits for rises near the default. Worked out and rendered (Sep
  2026), with f = rise / width:
  * lean-to: the vent's top corner nearest the low side clears the roof line
    by `0.28 - 1.32 f` ft -- 0.056 ft at the default 0.17. From about
    f = 0.21 (roughly a 2 1/2 in 12 pitch) the roof line cuts that corner off
    (hidden inside the 0.26 ft roof panel up to about f = 0.41, then showing
    above the roof). The vent's bottom is `rise - 0.80` ft above the wall top,
    so a rise under 0.80 ft (f under 0.13 on a 6 ft lean-to) hangs it below
    the wall top onto the end wall.
  * single slope: the corner clears the roof line by `0.80 - 1.46 f` ft,
    fine up to about f = 0.55; its bottom is `rise - 1.56` ft above the wall
    top, so a rise under 1.56 ft hangs it onto the end wall.
  A company that changes either rise far from the default needs a vent rule
  that follows the roof line -- a look decision, not a port (it would move
  the default too unless written as a separate branch).
  `parts/roof-frame.js` frames round the vent with `ventSpot`, so the same
  limits apply there.
* On the other roofs the vent hangs under the ridge of `plan.prof`.

## Where it came from in Barnwright

`boisterous-lokum-a737e0/public/3ddesign.html` (pinned SHA-256
`85c4b022d2f75db2145f4ff5cf1ea43c1b52074f8972b96180d64840eb4c5d36`),
`buildShed`'s gable-ends loop: the ridge search on line 3980
(`var rx=0,ry=-1; for(...)`) and the vent, lines 4002-4014.

Porting edits, all from the contract's Porting rules:
* `state.type !== "SB"` -> `t.gableVent !== false` (rule 2); `T()` ->
  `plan.t`, `state` -> `plan.state`, `prof` -> `plan.prof`, the kit's `mat
  gq2` bound to Barnwright's names (rule 1);
* the lean/slope `W*0.17` / `W*0.28` -> the roof's rise from
  `plan.construction` (rule 4, Barnwright's value as the default);
* where the vent goes is worked out in `ventSpot(plan)` (exported; the same
  arithmetic), which `appliesTo` uses too (rule 5);
* `kit.setStage("gable-end")` (rule 7).

## The owner's facts

None recorded: the vent's size and place are Barnwright's drawing.

## Kept quirks

* The vent is drawn on BOTH ends, identical.
* On a lean-to or single slope it is always drawn, however short the rise.
* The vent colours are shades of the SIDING colour (`tintShade(body, 0.82)` /
  `0.45`), not the trim colour.
* The slats are spaced over the frame height less 0.24 ft, in four equal
  steps.

## How to change it safely

* Run `node tools/check-golden.mjs --part gable-vent` before and after; it
  must stay green on all 148 buildings.
* A style that should have no vent gets `"gableVent": false` in the
  manufacturer file, not code.
* Keep this entry after the gable band and before anything else that asks for
  a `vent` or `ventD` material (first call wins, and creation order is draw
  order).
* A real look change means re-recording the golden fixtures on purpose
  (`node tools/capture-golden.mjs`, with a reason).

## Checks that guard it

* `node tools/check-golden.mjs --part gable-vent` -- every vent triangle of
  the 145 recorded Barnwright buildings that have one, number for number
  (3,480 triangles), including the lean-to and single-slope vents and the
  Standard Barn without one; drawn on its own it is exactly those triangles.
* `node tools/check-parts.mjs` -- the part is valid and this skill is well formed.
* `node tools/check-imports.mjs` -- the file loads in Node with no browser.
