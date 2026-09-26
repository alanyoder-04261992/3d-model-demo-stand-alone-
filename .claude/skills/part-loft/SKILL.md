---
name: part-loft
description: The loft at the ends of a lofted barn, lofted cabin or lofted garage -- loft joists at the wall top and a plywood loft floor -- read before changing loft depth, joist size or spacing, or which styles have a loft.
---

# Loft (`parts/loft.js`)

## What it is in real life

A lofted building (the Lofted Barn, Side Lofted Barn, the loft cabins, the
Lofted Barn Garage, the Metal Lofted Barn) has a storage LOFT at each end: a
floor at the top of the walls, reaching in from the end wall, that you reach
from the doors and store things on under the barn roof. At each loft end
this part draws:

* LOFT JOISTS across the building, standing on the long walls' top plates at
  the wall top, every `loft.spacingIn` on centre from the inside of the end
  framing in to the loft's edge (a joist on the edge). Their ends are cut to
  the roof slope where the roof comes down to the wall, so they stay under the
  roof deck. A roof truss's bottom chord lies on the same plates: where the
  next joist would land at or past a truss, the truss's own bottom chord is
  that support and no second board is drawn, and a joist that would land on a
  truss is set just before it. On a rafter-framed roof (no bottom chords) a
  joist that would land on a rafter is set just before it -- or just past it
  where there is no room before. No two supports are ever further apart than
  the spacing.
* the LOFT FLOOR: a plywood deck on the joists (or on the truss bottom chords,
  whichever is deeper), the whole loft, as wide as the trusses' top chords
  allow at that height.

On a porch cabin the loft at the porch end is measured from the enclosed end
wall, not from the gable over the porch. The trusses crossing a loft keep
their webs and gusset plates out of the floor's thickness (they stand on it
instead); a barn's collar tie is well above it.

## Stage

Stage `loft` (kind `frame`): hidden in the Finished view, shown in the
Framing view; in Watch-it-build it lands after the roof framing and is hidden
once the roofing lands. PIPELINE entry `loft`, among the framing entries
(only with `frames: true`), only on a style with the `loft` trait. Materials
`lumber` and `plywood`.

## Construction settings

* `loft.joist` -- the joist lumber, default `"2x6"`.
* `loft.spacingIn` -- joist spacing, default 16.
* `loft.deck.thicknessIn` -- the loft floor, default 0.625 (5/8 in).
* The style's `loft` trait (manufacturer file): `{ends: ["F","B"], depthFt: 4,
  assumed: true}` -- which ends have a loft and how deep, from the end wall.
* `walls.stud` -- how deep the end framing is (the loft starts inside it).
* `roof.framing`, `roof.chord`, `roofDeck.*` -- through `trussLayout` and
  `roofSection` in `parts/roof-frame.js` (where the trusses are, how high the
  roof comes down at the walls).

## Where it came from in Barnwright

New -- Barnwright drew none (it has no loft geometry at all). It fits inside
the gambrel roof Barnwright draws (`roofProfile` 2159-2175, `profileRoof`
2562-2976, `public/3ddesign.html`, pinned SHA-256
`0bdcf663c5cb988623d2cb0dd271156fb690564072b301b0a15b917fd921ac6c`), above the
wall top Barnwright uses for every lofted style (`TYPES[t].wallH`). The zones
come from `loftZones` in `parts/roof-frame.js`, shared with the trusses.

## The owner's facts

* Loft (short-wall) studs are 75 in, giving about a 6.63 ft wall; the lofted
  styles' walls are 6.67 ft (6.9 on the loft cabins and garage) -- the loft
  floor sits on those walls' top plates.
* On loft builds a window top sits 5 in under the wall top and never higher,
  and the shop door opening is 71 1/2 in (Barnwright's shop rules) -- the
  loft joists at the wall top clear both.
* The LOFT DEPTH (4 ft at each end) is an ASSUMPTION: the manufacturer file
  marks it `"assumed": true` and nothing in Barnwright or from Alan states
  it. Confirm with the shop before relying on it.

## Kept quirks

* Where a truss stands in for a joist, the loft floor rests on the (deeper)
  loft joists; the truss's 2x4 bottom chord is a little lower than them.

## How to change it safely

1. Read this skill and `part-roof-frame` (`loftZones`, `trussLayout`).
2. Change the depth or the ends in the style's `loft` trait (manufacturer
   file), and the joist size, spacing or floor thickness in
   `library/construction.json` or a company's `construction`.
3. Run `node tools/check-framing-roof.mjs` (the loft is checked on every
   lofted building, with a 2x4 loft joist variant too), `node
   tools/check-framing.mjs`, `node tools/check-parts.mjs` and `node
   tools/check-golden.mjs`.

## Checks that guard it

* `node tools/check-framing-roof.mjs` -- a loft floor at each loft end of
  every lofted style and no loft framing on any other style; its supports
  (loft joists, and truss bottom chords standing in) no further apart than
  `loft.spacingIn`; every joist and the floor inside the roof as drawn and
  overlapping no truss, web, gusset or gable stud; exactly its members drawn,
  in stage `loft`.
* `node tools/check-framing.mjs` -- region, overlap, and every joist bearing on
  the wall plates, the floor on the joists.
* `node tools/check-parts.mjs` -- valid part, caption, this skill.
