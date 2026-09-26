---
name: part-interior
description: What the customer puts inside the building -- work benches, shelves, outlets, the switch with its GFCI outlet and the overhead lights -- drawn in 3D for the Framing view; read before changing their sizes, heights or how they are fitted into the room.
---

# Shelves, benches and electrical (`parts/interior.js`)

## What it is in real life

* A WORK BENCH: a top on two 2x4 aprons and end rails, on 2x4 legs at the
  ends and at most 4 ft apart, as long as the customer stretched it on the
  floor plan, 2 ft deep, about 3 ft high.
* A SHELF: the same build, 1 ft deep, about 5 ft up. A shelf over a bench
  stands its legs on the bench top.
* An OUTLET or the SWITCH + GFCI: a steel box and a white cover plate
  surface-mounted on the face of a stud (the shed has no inside wall
  covering), its centre at the catalogue's mounting height; the switch +
  GFCI is a two-gang box.
* An OVERHEAD LIGHT: a box and a globe hung under the roof framing at the
  wall top.

EVERYTHING IS BUILT INSIDE THE STUDS. Barnwright's floor plan clamps a bench
only to the whole footprint, so it can run the full nominal width into the
studs ("the shop calls a 20-ft shelf 20 ft even though the studs eat 7 in"),
across a side porch's wall, or across the kennel's partition; its electrical
package puts the overhead lights at a quarter of the length, which on a
front-porch cabin is out on the porch or right on the front wall. So:
* a bench or shelf is cut shorter where a wall is in the way (its LENGTH is
  what gives), and only if its depth does not fit where it was put, moved
  across the least it can be; with no room anywhere near, it is not drawn;
* a light that would be on the porch or over a wall's framing goes to the
  nearest spot inside the room;
* a box goes on the stud nearest where the customer put it, skipping a stud
  where it would stand past the room's inside corner or on a box already
  there.
The room inside the studs is `clearOutline(plan)`: the room's outline moved in
to the inside face of the wall framing.

## Stage

Stage `interior` (kind `frame`): Framing view, and last-but-one in
Watch-it-build. A piece glows with its item when that item is selected
(`meta.glowItem`). PIPELINE: among the framing entries, only with
`frames: true`, and only when the building has an inside item.

## Construction settings

* `interior.benchHeightIn` (36), `interior.shelfHeightIn` (60),
  `interior.topIn` (0.75), `interior.legMaxSpacingFt` (4) -- read with Alan's
  answers as the defaults. `library/construction.json` has no `interior`
  block yet; a company adds one to change them.
* The catalogue: `dep` (bench 2, shelf 1), `sill` (outlet height 1.2 ft),
  `switch` (the two-gang box).
* `walls.stud` -- the framing depth, for the room inside the studs.

## Where it came from in Barnwright

New -- Barnwright drew none in 3D (renderItem skips `int` items). The
positions are its floor plan's (`bpDraw`, `3ddesign.html` 4457-4480: benches
first, then shelves on top; pinned SHA-256 `0bdcf663...`), kept by `clampPos`
(`model/layout.js`, Barnwright 2296-2306). The fixtures come from the
electrical packages (`pkFixtures`, 4651-4674).

## The owner's facts

* Alan, Aug 2026 (answered for the Yoder site): "the work bench is 2 ft deep
  and about 3 ft off the floor; shelving is 1 ft deep, standard about 5 ft
  off the floor". Barnwright's own hint (line 544): "Work benches are 2 ft
  deep, shelves 1 ft."
* "benches and shelves may run the full nominal length of the build -- the
  shop calls a 20-ft shelf 20 ft even though the studs eat 7 in" (Barnwright
  2299-2302, `model/layout.js`).
* Electric packages (Barnwright 5201): Option 1 is 1 overhead light plus a
  switch with GFCI outlet; Option 2 adds 3 more outlets; Option 3 has 2
  overhead lights, the switch with GFCI and 5 more outlets. "The switch and
  GFCI go right beside the biggest door." (4662)
* The outlet mounting height 1.2 ft is Barnwright's `CAT.sill` (726-727).

## Kept quirks

* A box moves to the nearest stud (up to half a bay from where the floor
  plan shows it); `meta.movedBy` records how far. A light moved off the porch
  records it the same way; a cut bench records `meta.cut`.
* The light hangs at the wall top whether or not a truss is right over it.

## How to change it safely

* Heights and leg spacing are settings; sizes of the electrical pieces are
  `ELEC` (drawn sizes).
* Run `node tools/check-framing.mjs` -- it proves every piece stands inside
  the studs, overlaps nothing (the wall framing included) and rests on the
  floor, a bench top or its stud.

## Checks that guard it

* `node tools/check-framing.mjs` -- on every building with an electrical
  package, a bench and a shelf: everything inside the room inside the studs,
  no overlaps, legs on the floor or a bench top, boxes on their studs.
* `node tools/check-parts.mjs`, `node tools/check-imports.mjs`.
