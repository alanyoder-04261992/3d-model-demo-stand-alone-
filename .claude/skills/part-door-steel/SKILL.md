---
name: part-door-steel
description: The six-panel steel in-swing entry door (36 in) with its raised panels, satin knob and wood threshold -- read before changing its panels, knob, threshold, the hole it sits in or its trim.
---

# Six-panel steel door (`parts/openings/door-steel.js`)

## What it is in real life

A 36 in in-swing steel entry door, the kind a cabin or an office shed gets:
white, six raised panels, a satin knob, hung in a real frame. On the picture:

* **It sits in a hole**: a white jamb behind it, the slab set back at 0.048 ft,
  and the reveal from the slab out to the casing face (0.12 ft) that you can
  see down; the head throws a shadow across the slab's top and there is a gap
  down the latch edge.
* **Six raised panels**, at the fractions measured off Alan's photograph:
  columns at 0.170-0.435 and 0.565-0.830 of the width; rows (bottom, middle,
  top) at 0.064-0.300, 0.369-0.758 and 0.822-0.945 of the height -- the bottom
  pair barely two thirds the height of the middle pair. Each panel steps DOWN
  off the stile first, then ramps back up on four bevels to its field.
* **A satin knob on a rose** -- rose, neck, ball, each twelve-sided -- 0.32 ft
  in from the latch edge at 0.44 of the height.
* **A wood threshold** under the slab.
* It is always WHITE (it does not take the door colour), and no hinges show:
  an in-swing door hinges inside.
* Round it, the shared trim: side casings stopping just under the head, the
  22.5-degree head board, and on a porch building the header band (see
  `part-openings`).

## Stage

`doors` (id 14, finish): shown in the Finished view, hidden in Framing, lowered
into place at the `doors` step of Watch-it-build. Drawn by PIPELINE entry 14,
`openings` (`parts/openings/index.js`), for every item whose catalogue `draw`
trait is `steel-6panel`, in the order the items were added (Barnwright's
`buildShed` line 4043).

## Construction settings

None. The door's opening height is the catalogue item's own `h` (6.3 ft),
capped as every door is (`model/layout.js openingRect`: a full foot under the
roof on a cottage, under the eave or belt band on a side wall, under the roof
line and gable band on an end wall). The door height settings
(`openings.doorHeightIn`) are for the wooden shop door only, as in Barnwright.

## Where it came from in Barnwright

`boisterous-lokum-a737e0/public/3ddesign.html` (pinned SHA-256
`0bdcf663c5cb988623d2cb0dd271156fb690564072b301b0a15b917fd921ac6c`):

* `renderItem`'s `d36in` branch, lines **3376-3422**;
* the shared frame before it, lines **3172-3236** (`common.js openingFrame`);
* the primitives it uses, `wrev wbevel wdrum wdisc wslant`, lines 3069-3121
  (`common.js itemTools`).

Porting edits (docs/ARCHITECTURE.md, Porting rules), and nothing else:
1. Rule 1: `mat wq` are the kit's; `wrev wbevel wdrum wdisc wslant` the item
   primitives.
2. Rule 3: `it.cat==="d36in"` -> the `steel-6panel` draw trait (how the item
   reaches this module).
3. Rule 7: the stage is set by the caller.

## The owner's facts

Barnwright's comments, kept word for word in the code:

> A SIX-PANEL STEEL DOOR, measured off Alan's photograph of one hanging in a real building. The rails and stiles were roughly right; the panels were not -- the bottom pair ran nearly as tall as the middle pair, where on a real door they are barely two thirds of it. And every panel was a flat rectangle with a lighter rectangle inside it, so the door read as a sheet with lines drawn on it. They are raised panels now, on real bevels.

> THE DOOR IS IN A HOLE IN A WALL, and the panels have an edge you can catch a fingernail on. Both were flat before: the slab sat level with the casing so there was no frame to see down into, and each panel was a gentle ramp with nothing to cast a line. A real six-panel steel door steps DOWN off the stile first and then ramps back up to the field -- that little step is what draws the dark outline round every panel.

> satin knob on a rose, and the wood threshold under the slab

> a knob you can see round: rose, then a neck, then the ball

And the shared trim (`common.js`, full text in `part-openings`):

> casings the way the shop cuts them (see the lot photos): side casings run between sill and head; the head board is WIDEST AT ITS TOP, the ends cut at 22.5 degrees sloping back down to land flush on the side casings

> THE REVEAL IS A DOOR DETAIL, and only a door gets it. On a door the side casings stop just below the head board rather than running through it, so the three boards read as three cut boards with a joint between them instead of one poured white slab.

## Kept quirks

* **`galv` and `doorSh6` are shared with the 11-lite door, with different
  paint** (steel: `#cbd0d4` 0.60/54 and `#cfcfca`; 11-lite: `#cfd4d8` 0.5/44
  and `#d3d3cf`). First call wins: whichever of the two doors is drawn first on
  a building paints both. No recorded building carries both doors at once
  (`lite-su-10x20-steel-swap` swaps one for the other), so the golden test
  does not see the clash: it is kept by keeping both `mat()` calls, in
  Barnwright's order, and the items walked in the order they were added.
* Always white; ignores the door colour.
* The panel bevel inset is `min(0.070, 24% of the panel)`, so small panels get
  a smaller bevel.
* The threshold is described high edge first; `wslant` puts the pair in order
  (see `part-openings`).

## How to change it safely

1. Read this skill, `part-openings`, and the comments in
   `parts/openings/door-steel.js`.
2. Run `node tools/check-golden.mjs --part door-steel` before and after, then
   the whole `node tools/check-golden.mjs` (its materials' paint and draw
   order, `galv` and `doorSh6` above all).
3. The panel fractions came off a photograph of a real door: do not "round"
   them. Every depth (0.030, 0.048, 0.12 ...) decides what shows through what.
4. A different steel door size is a catalogue item with `draw:
   "steel-6panel"` and its own `w`/`h` -- no code.
5. If the look must really change, re-record the golden fixtures on purpose
   (`node tools/capture-golden.mjs`, with a reason).

## Checks that guard it

* `node tools/check-golden.mjs --part door-steel` -- every steel-door
  triangle of the 148 recorded Barnwright buildings, number for number (14
  buildings, 3,584 triangles, Sep 26 2026), including the steel door swapped
  to the 11-lite door and back.
* `node tools/check-golden.mjs` -- also the draw order and paint of `dJamb`,
  `dRev`, `doorSh6`, `panFace`, `panBev`, `panGroove`, `galv`, `galvD`,
  `thresh`.
* `node tools/check-model-live.mjs` -- its opening rectangle against the trim
  Barnwright's live page draws.
* `node tools/check-parts.mjs`, `node tools/check-imports.mjs`.
