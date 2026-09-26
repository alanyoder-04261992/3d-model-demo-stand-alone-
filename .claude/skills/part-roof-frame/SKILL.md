---
name: part-roof-frame
description: The roof trusses (or rafters) of a portable building, for every roof shape, and the roof-geometry hub every roof framing part shares -- read before changing truss spacing, chord size, web layout, how the chords sit on the walls and run out over the eaves, or anything the other roof framing parts read from parts/roof-frame.js.
---

# Roof framing (`parts/roof-frame.js`)

## What it is in real life

The frame that holds the roof up. The standard build is TRUSSES: a flat,
factory-style frame of 2x4s set across the building every 24 in along its
length, one at each gable end. A truss has

* two (on a barn roof, four) TOP CHORDS following the roof line, mitred where
  the slopes meet; where a chord crosses a wall it sits on the wall's top
  plates with a seat cut (the "bird's-mouth"), and past the wall its TAIL
  runs out under the eave;
* a BOTTOM CHORD lying on the long walls' top plates, wall to wall, tying them
  together (it is also the ceiling tie);
* WEBS between them: on a gable or the cottage's saltbox a king post under
  the ridge and, from 10 ft wide, two struts from its foot up to the middle of
  each top chord; on a gambrel (barn) roof a collar tie across the two knees
  and a king post over it -- the space under the collar is left open for the
  loft and for headroom; on a lean-to or single slope a MONO truss: an end
  post against the tall wall (the tall wall stands in for the truss's high
  post), posts with diagonals between them toward the low heel;
* plywood GUSSET plates, half an inch, on both faces at the apex, the knees,
  the heels and the king-post foot.

The two END trusses stand at the gable ends, flush inside the gable siding:
they carry no webs and no gussets, because the gable studs
(`parts/gable-frame.js`) fill them and the siding covers their outer face --
a gable-end truss.

A company can set `roof.framing` to `"rafter"`: the same top-chord boards
become rafters in pairs, meeting a RIDGE BOARD where the roof peaks, with a
COLLAR TIE on every pair but the end ones (a gambrel's collar sits across its
knees, with knee gussets); a lean-to or single slope is plain rafters.

The Dormer Shed's dormer CUTS the trusses it stands over: their +x (door side)
top chord is taken out between the dormer's two headers, with that side's
strut, and their bottom chord's heel stops at the dormer's front wall; the
full trusses either side (the trimmers) carry the headers. See
`part-dormer-frame`.

Everything is fitted INSIDE the roof Barnwright draws:
* every member is under the underside of the drawn roof slab (the profile
  line, run out over the eaves exactly as `parts/roofing.js` draws it), one
  roof-deck thickness down (the roof deck lies between);
* inside the walls it stays above the wall top (topY) -- or above a tall
  wall's own top over that wall's framing on a lean-to or single slope;
* Barnwright's roof line meets the wall top in a sharp corner at the siding,
  so a chord crossing a wall is cut there: the inside part sits on the plate
  and ends in a point at the wall line, the tail hangs outside. The tail never
  goes past the tip of the drawn eave, and is cut level: on a bare metal eave
  (utility sheds, garages, barns, the lean-to's low side) at the bottom of the
  metal's cut edge (0.03 under the tip), on the cottage at its level soffit.
  The single slope's eaves are boxed with a SLOPED soffit that is the drawn
  roof's own underside, so there is no room for a tail -- nothing is framed
  out there (not even the deck, which would have nothing to be nailed to);
* a lean-to's or single slope's tall wall rises to the roof line, so a chord
  stops against the inside of its studs.

## Stage

Stage `roof-frame` (kind `frame`): hidden in the Finished view, shown in the
Framing view; in Watch-it-build it lands after the wall framing and the
siding, and is hidden again once the roofing lands (`COVERS` in
`parts/stages.js`). PIPELINE entry `roof-frame`, among the framing entries
(only with `assemble(plan, {frames: true})`), after `gable-frame`. Materials:
`lumber` (texFlat `#c9a46e`) and `plywood` (`#d8bc8a`) for the gussets --
first call wins, so if another framing part made `lumber` first its paint is
used.

## Construction settings

* `roof.framing` -- `"truss"` (default) or `"rafter"`.
* `roof.spacingIn` -- truss/rafter spacing on centre, default 24. The last gap
  before the front end truss is whatever is left (never smaller than two
  trusses' gussets need).
* `roof.chord` -- the lumber of the chords, webs and rafters, default `"2x4"`.
  Its thin side is the truss's thickness; its wide side the chord depth.
* `roof.gussets` -- caption only (`"plywood"`); the plates are drawn half an
  inch thick.
* `roof.shapes.<roof>` (rise, knee, lower/upper rise, ridge, eave and rake
  overhangs) and `roof.cottageEave` -- through `plan.prof` and
  `parts/roofing.js`: the framing follows whatever roof those draw.
* `roofDeck.type`, `roofDeck.sheathingIn`, `roofDeck.purlins.size` -- the deck
  thickness the chords sit under (a flat purlin's thin side, or the OSB).
* `walls.stud` -- how deep the long walls' framing is (where a chord must stay
  above a wall's own top) and the gable framing's depth.
* `loft.*` -- through `loftZones`: a truss crossing a loft keeps its webs and
  plates out of the loft floor's thickness.
* A size is written like `2x4`, `2x6`, `"2x8 doubled"` (`lumberFt`).

## Where it came from in Barnwright

New -- Barnwright drew none. It fits into the roof Barnwright draws, in
`public/3ddesign.html` (pinned SHA-256
`0bdcf663c5cb988623d2cb0dd271156fb690564072b301b0a15b917fd921ac6c`):
`roofProfile` 2159-2175 (the cross-section, `plan.prof`), `profileRoof`
2562-2976 (the slab's underside at the profile line, its eave extensions and
eave drops, the gambrel's forced 0.10 rake), `cottageEave` 2198-2203, and
`dormer()` 2978-3059 for the dormer's cut. `roofSection()` repeats
profileRoof's eave rules in the same order so the framing sits exactly under
the roof that is drawn; `tools/check-framing-roof.mjs` reads the drawn
underside back from the finished triangles to prove it.

The hub (exported, used by gable-frame, roof-deck, loft, dormer-frame and the
checks): `roofSection`, `zRange`, `offY`, `envY`, `below`/`above`/`belowAll`,
`band`, `offsetPolyline`, `fitRoof`, `trussLayout`, `loftZones`,
`dormerGeom`, `dormerHoles`, `gableOpenings`, `ridgeBoard`,
`roofFrameMembers`, `drawMembers`, `frameMats`, `lumberFt`, and the plane
kit (`clipHalf`, `clipAll`, `cleanPoly`, `splitX`, `splitY`, `rectPoly`,
`strip`, `centroid`, `polyArea`). A MEMBER is
`{poly: [[x,y]...] convex anticlockwise, z0, z1, kind, mat}` -- a shape in
the building's cross-section pushed along the length; a plain rectangular
board is drawn with `kit.beam`, a cut one as a prism of its outline (12
triangles for a four-sided board, 4n-4 for n sides).

## The owner's facts

* The cottage's eave (Alan, Aug 2026, drawn in section on a screenshot of the
  designer): "the rafters bear on the plate and the tails are cut off level
  for the soffit" -- a 4 in fascia, then 8 in of level soffit back to the wall
  at the front (4 in at the back), one straight roof line from tip to ridge,
  the deck running past the wall top to land one fascia above the soffit.
  Here: the cottage's tails are cut level with its soffit (topY).
* The cottage roof is a SALTBOX with the ridge over the FRONT (the door side,
  +x, at +0.18W; his photograph measures 77 percent across) -- the trusses
  follow `plan.prof`, so they are saltbox trusses with the king post under
  that ridge.
* The Standard Barn (mini barn) has steep shoulders and a taller cap: lower
  rise 2.43 ft, upper 1.0 ft, knee at 0.30W (its gambrel trait) -- its
  gambrel trusses follow it.
* Loft (short-wall) studs are 75 in, tall-wall studs 89 in; a 2x4 is 1 1/2 in
  by 3 1/2 in (`engine/constants.js` LUMBER).
* Roof screws are "one per pan, in a row about every two feet of slope where
  the purlins are" (Alan's photographs, `parts/roofing.js`) -- the purlins of
  `part-roof-deck` are where the frame carries them.
* No stated truss or rafter size or spacing exists in Barnwright; the
  24 in / 2x4 / plywood defaults are `library/construction.json`'s.

## Kept quirks

* The drawn roof meets the wall top in a sharp corner, so a chord cannot
  pass over a wall with its full depth: it ends in a point at the wall line
  and its tail (outside) is a separate wedge that tapers to nothing at the
  eave's tip. That is the drawn envelope, not a framing choice; do not raise
  the chords above the drawn roof to "fix" it.
* The gambrel's rake overhang is 0.10 (profileRoof forces it) and its upper
  slopes reach a further 0.135 (RAKE_STEP) -- the deck follows that; the
  trusses stay inside the gable ends.
* The single slope has no eave framing at all (its sloped soffit is the drawn
  underside).

## How to change it safely

1. Read this skill and `docs/ARCHITECTURE.md` "Framing datums" 3.
2. Change `library/construction.json` (or a company's `construction`) for a
   different spacing, lumber or framing type -- never a literal in the code.
3. If you change the geometry, keep every member a convex outline pushed
   along z, inside `fitRoof`, and keep the hub's exports' meaning: the other
   four roof framing parts and both framing checks read them.
4. Run `node tools/check-framing-roof.mjs` and `node tools/check-framing.mjs`
   (the walls' check holds the roof parts to region, overlap -- against the
   wall framing too -- and bearing), then `node tools/check-parts.mjs`,
   `node tools/check-imports.mjs` and `node tools/check-golden.mjs` (the
   finished building must not move: this part only adds framing materials).
5. The golden fixtures are never re-recorded for framing: a finished triangle
   that changes means the framing leaked into the Finished view.

## Checks that guard it

* `node tools/check-framing-roof.mjs` -- on 515 buildings (the 148 recorded,
  every style at every size, every dormer, and rafters / 16 in / 2x6 chords /
  2x6 studs / purlins / OSB / 2x4 loft joists on every style): every corner
  under the drawn roof slab (read off the finished `roofU` triangles), above
  the wall top inside the walls, not past or below the eave; no two boards
  overlapping by more than 0.01 ft; trusses at `roof.spacingIn` with the last
  gap no larger, one at each gable end, a top chord on every slope and a
  bottom chord; the part draws exactly its members in its own stage; the
  finished building untouched.
* `node tools/check-framing.mjs` -- the same buildings and more, every
  framing part together: region, overlap with the walls and floor, bearing.
* `node tools/check-parts.mjs` -- the part is valid, its caption fills in from
  the construction settings with no number of its own, and this skill exists.
