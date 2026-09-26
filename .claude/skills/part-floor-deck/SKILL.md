---
name: part-floor-deck
description: The tongue-and-groove floor decking sheets over the floor joists (one layer, or two for the double floor) -- read before changing the sheet size, thickness, layers or how the sheets are laid.
---

# Floor decking (`parts/floor-deck.js`)

## What it is in real life

The floor is decked with 4x8 tongue-and-groove sheets nailed over the
joists, laid with their long edge ACROSS the joists (the joists run across
the width, so the sheets run along the length), started at the back end,
with every other row started on a half sheet so the end joints are
staggered. The joists are laid out from the same back end, so every end
joint lands on a joist (8 ft is six 16 in bays, or eight 12 in ones). The
walls stand on the decking. A DOUBLE FLOOR is a second full layer of the
same sheets over the first, its joints moved half a sheet both ways. The
open porch decks get treated deck boards instead (part `porch-deck-frame`);
the Dog Kennel is decked all over, run and room alike.

## Stage

Stage `floor-deck` (kind `frame`): Framing view only; in Watch-it-build it
lands on the floor frame. PIPELINE: among the framing entries, only with
`frames: true`.

## Construction settings

* `floor.deck.sheet` -- "4x8 T&G": the sheet size is read from it (long side
  along the building).
* `floor.deck.thicknessIn` -- per layer (default 0.625, 5/8 in).
* `floor.deck.layers` -- 1, or 2 with the "Double floor" option
  (`rate.dbl` construction effect).
The joists under it are drawn shallower by thickness x layers so the top of
the decking is always y0.

## Where it came from in Barnwright

New -- Barnwright drew none (its floor is one solid slab, `parts/floor.js`,
`3ddesign.html` 3868-3877, pinned SHA-256 `0bdcf663...`). It fits the top of
that slab's envelope and the shop's floor note (2147-2150). The area decked
is the room's outline (`roomOutline` in `parts/floor-frame.js`, the same walls
`parts/siding.js` draws), inset to the slab.

## The owner's facts

* Barnwright 2147-2150 (the shop): "2x6 joists on skids with 5/8" decking".
* Alan, Aug 2026: "Double floors is the 4x8 tongue and groove flooring that
  goes on top of the 2x6. And double means they is another layer of
  flooring." (kept in the code comment too)

## Kept quirks

* A hairline joint (`SEAM`, 0.01 ft) is left between sheets so each one can be
  seen; the real sheets butt tight.
* The decking covers the room to the OUTSIDE of the walls (the walls stand on
  it), not just the floor you can walk on.

## How to change it safely

* Sheet size, thickness and layers are settings -- change them there.
* If the decked area changes (a new porch shape), `roomOutline` in
  `parts/floor-frame.js` is the one place; `porch-deck-frame` decks the rest.
* Run `node tools/check-framing.mjs` (covers every layer, sits on the joists,
  nothing overlapping) and `node tools/check-golden.mjs`.

## Checks that guard it

* `node tools/check-framing.mjs` -- every layer of decking covers the room
  (at least 97 %, the joints taken out), there are `floor.deck.layers` layers
  (two with the double floor), every sheet rests on joists (or the layer
  under it), nothing overlaps, and the finished building is untouched.
* `node tools/check-parts.mjs`, `node tools/check-imports.mjs`.
