---
name: part-porch-deck-frame
description: The porch floor of a cabin -- the joists under a front porch deck and the treated deck boards on every porch -- read before changing how a porch deck is framed or decked.
---

# Porch deck (`parts/porch-deck-frame.js`)

## What it is in real life

A cabin's porch floor is at the same height as the room's floor and sits on
the same skids.
* A FRONT porch (porch "F", and the 4 ft end deck of the corner porch "C") is
  framed on from the room's floor frame, whose front end joist sits under
  the front wall: joists across the width at the floor's spacing measured
  from that end joist, a rim down each side carrying on from the room's rims,
  and a band joist across the front edge.
* A SIDE porch (porch "S") and the corner porch's run down the door side sit
  on the room's own floor joists (which run straight under the porch wall),
  so they need no joists of their own.
* Every porch is decked with treated deck boards laid across the joists
  (along the length of the building), with a gap between boards, from the
  porch wall out to the deck's edge.

## Stage

Two stages: the joists are `floor-frame`, the boards `floor-deck` (both kind
`frame`), so Watch-it-build lays them with the room's floor frame and
decking. PIPELINE: among the framing entries, only with `frames: true`.

## Construction settings

* `porch.joist` (2x6) -- the porch joists' size (drawn as deep as the floor
  joists so the deck is one level).
* `floor.spacingIn` -- the porch joists' spacing.
* `floor.rim` -- the porch rims.
* `floor.deck.thicknessIn` x `floor.deck.layers` -- the boards are drawn this
  thick so they finish at y0 like the room's decking.
The boards' width and gap (5 1/2 in, 1/4 in: `DECK_BOARD`) are drawn sizes;
the settings have no porch deck board yet.

## Where it came from in Barnwright

New -- Barnwright drew none (its porch floor is part of the one floor slab,
`buildShed` 3868-3877, pinned SHA-256 `0bdcf663...`). It fits under the
porches Barnwright draws (`porchFront` 2465, `porchSideCorner` 2488,
`porchCorner` 2525; `parts/porch.js`), whose posts and railings stand on it.
The porch outlines are `porchOutlines` in `parts/floor-frame.js`, read off
`plan.ws` (the P1/P2/P3 and S1/S2/S3 walls).

## The owner's facts

* "PORCHES are natural pressure-treated wood, like the real cabins"
  (Barnwright 2443, 2466).
* The side porch is 4 ft deep, 8 ft on a building under 20 ft long and 12 ft
  from 20 ft up (Barnwright 1269-1270); the deluxe corner porch is a 4 ft deck
  past the end wall plus a run down the door side (1267, 2277-2284).
No other porch-floor facts from Alan yet.

## Kept quirks

* Nothing of Barnwright's: the boards and joists are new. The corner porch's
  4 ft end deck is part of the building's length L (Barnwright's dims() adds
  it), so the deck boards cover L to the end.

## How to change it safely

* Joist size and spacing are settings. A new porch shape needs its outline
  in `porchOutlines` / `roomOutline` (`parts/floor-frame.js`).
* Run `node tools/check-framing.mjs` after any change.

## Checks that guard it

* `node tools/check-framing.mjs` -- the deck boards cover every porch (at
  least 90 %, the gaps taken out), the porch joists sit on their
  `floor.spacingIn` marks with no wider bay and on the skids, nothing overlaps
  or strays off the footprint, the finished building is untouched.
* `node tools/check-parts.mjs`, `node tools/check-imports.mjs`.
