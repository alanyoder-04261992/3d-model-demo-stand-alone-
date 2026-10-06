---
name: part-ramp
description: The wooden ramp up to the biggest door, drawn in the finished building only when a 4 or 6 ft ramp is chosen -- read before changing where the ramp goes, how long it is or how it is built.
---

# Ramp (`parts/ramp.js`)

## What it is in real life

A pressure-treated wood ramp up to the door: stringers (the porch joist
size) cut to the slope, standing on their edges at most `floor.spacingIn`
apart across the width, their top ends against the building at the floor
line and their toes on the ground, with boards across them from the door
sill down to the grass, as wide as the door opening. The DIY ramp kit comes
with no wood, so nothing is drawn for it.

WHERE: Barnwright's floor plan puts the ramp "at the biggest door" -- the
widest door or roll-up -- straight out from that door's wall, 4 ft long for
the 4 ft ramp and 6 ft for the 6 ft one. It starts past the diamond-plate
threshold on a roll-up (0.34 ft out), a hair off the siding otherwise. A door
that opens onto a PORCH cannot have a ramp at its sill (the porch floor is at
the same height), so the ramp goes where the porch is entered: the widest
gap Barnwright leaves in the front railing (front or corner porch), or in
front of the porch door on a side porch.

## Stage

Stage `ramp` (kind `finish`, NEW): shown in the Finished view -- the only new
finished geometry -- and only when a ramp is chosen; last in Watch-it-build.
PIPELINE entry `ramp`, after the ground and before the framing entries, run
in every build (not only with `frames: true`). Barnwright never drew it, so
the golden checks leave the `ramp` stage out (`NEW_FINISH_STAGES`).

## Construction settings

* `ramp.lengthFt` -- when a ramp option carries it as a construction effect
  (none does yet: the manufacturer file's `lengthFt` is not in the resolved
  catalogue); otherwise Barnwright's rule: r4 -> 4 ft, r6 -> 6 ft, any other
  ramp id with a number in it, that number; the kit -> none.
* `porch.joist` (2x6) -- the stringers.
* `floor.spacingIn` -- the most the stringers stand apart.
The boards are 2x6 (5 1/2 in wide, 1/4 in apart: `RAMP_BOARD`).

## Where it came from in Barnwright

New -- Barnwright drew no ramp in 3D. The placement is its blueprint's
(`bpDraw`, `3ddesign.html` 4440-4456, pinned SHA-256 `85c4b022...`: "ramp at
the biggest door", `rlen=(state.ramp==="r4")?4:6`); the options are its
RAMPS table (line 768: "4′ ramp", "6′ ramp", "DIY kit (no wood)"). The porch
entry follows `porchSideCorner` (entryZ) and `railAnchors` (the widest gap),
imported from `parts/porch.js`. Its colour is the porch's natural
pressure-treated wood ("pwood", #96682F -- first call wins, the same paint
`parts/porch.js` makes).

## The owner's facts

* "The ramp goes at the biggest door and is 4 or 6 ft long. A DIY ramp kit
  comes with no wood." (Barnwright 768, 4440-4456)
* "The shop screws a diamond-plate threshold across every roll-up opening"
  (Barnwright 3268-3271) -- why a ramp at a roll-up starts past it.
* Porches are "natural pressure-treated wood, like the real cabins"
  (Barnwright 2443).

## Kept quirks

* The blueprint draws the ramp as a trapezoid narrowing to 80 % at the
  ground, starting 0.25 ft out from the wall; the 3D ramp is rectangular, as
  wide as the door, and starts where it meets the building (a hair off the
  siding, or past a roll-up's threshold) -- the blueprint's is a plan symbol,
  not a shape.
* On a SIDE porch the ramp lands where Barnwright draws its two-step wooden
  stair, which stays (the finished drawing is Barnwright's): the stringers
  over it are notched to sit on it (`SIDE_STEP` -- Barnwright's step boxes
  from `parts/porch.js` porchSideCorner, copied: change both together), as a
  shop would set a ramp over a step already there. A 6 ft ramp clears the
  step; a 4 ft one is steep enough that its boards touch the step's top
  corner by about 0.05 ft (5/8 in) -- the one contact the check allows, held
  to 0.06 ft and counted apart.
* At an end wall the skids run a little past the wall (0.07 ft); the
  stringers over a skid are notched to sit on its end.
* The last board's lower corner lies past the toe by its own thickness and
  dips into the grass (the lawn covers it).

## How to change it safely

* The ramp is FINISHED geometry customers see: after any change look at it
  (Finished view with a ramp chosen) and run `node tools/check-framing.mjs`
  (its ramp checks) and `node tools/check-golden.mjs` (proves the ramp never
  touches Barnwright's triangles: the golden case `int-ut-10x20-options`
  carries a 4 ft ramp).

## Checks that guard it

* `node tools/check-framing.mjs` -- every chosen ramp (99 buildings, three
  companies) is drawn in the finished view in the ramp step only, exactly its
  pieces, from the floor line at the building down to the ground, as long as
  chosen, with at least two stringers, cutting into nothing of the finished
  building (door trim, thresholds, porch posts and railing, the skids, the
  siding) by more than 0.01 ft -- the side porch's step by no more than
  0.06 ft; none for "no ramp" or the DIY kit. The cut test measures how far
  the ramp would have to move to come clear (a flat surface buried in a
  board counts), which is what catches a ramp pushed back into the wall.
* `node tools/check-golden.mjs` -- the ramp never changes a Barnwright
  triangle or material.
* `node tools/check-parts.mjs`, `node tools/check-imports.mjs`.
