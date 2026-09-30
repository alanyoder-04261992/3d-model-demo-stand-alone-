---
name: part-roof-frame
description: The roof trusses (or rafters) of a portable building, for every roof shape, and the roof-geometry hub every roof framing part shares -- read before changing truss spacing, chord size, web layout, how the chords sit on the walls and run out over the eaves, or anything the other roof framing parts read from parts/roof-frame.js.
---

# Roof framing (`parts/roof-frame.js`)

## Gable backing added to the learned assembly

Read [the gable-backing skill](../part-gable-backing/SKILL.md) before changing
these horizontal 2x4 pieces. They fit between neighboring gable studs,
wide face outward, only when the selected gable has no window or fake window.
Their bottom is 11 in above the **upper-plate top**. With 24 in centers and
3.5 in outward stud faces, each current clear cut is 20.5 in. The backing
has its own part; preserve this part's existing members and fit.

## Alan's learned truss: opt-in fit preview

Alan's September 29 correction supersedes the earlier top-bearing fit:
**the truss goes against the broad face of the gable board facing the
viewer in the connection picture** (the room-facing face in this model).
He explicitly confirmed that the **lowest truss tip is level with the
upper-plate top**. The **48 in peak height starts at that same upper-plate
top**, not the gable-board top. Thus the peak is `79.5 + 48 = 127.5 in`
above flooring, or `48 - 5.5 = 42.5 in` above the gable board.

The truss is actual **1.5 x 3.5 in** (nominal 2x4). Keep the **54 in upper**
and **37.75 in lower** longest-point lengths. The **6.25 in** projection
runs along the wall from the **upper-plate cut end to the farthest truss
tip**. It is a separate horizontal dimension, not the height or a sloping
length. Mirroring it at both ends remains provisional; this gives
`113 + 6.25 + 6.25 = 125.5 in` tip-to-tip. The gable board remains 118 in
long, on edge above the upper plate. After the other-side correction it
keeps the new physical position, with Alan’s corrected labels: a 0.5 in
inside ledge and a derived 1.5 in outside ledge, with
2.5 in projections unchanged.

Alan’s later blue line confirms that the **whole bottom cut of the truss
is level with the gable-board bottom**, which is the upper-plate top.
Both corners of that cut use the same elevation. This replaces the earlier
square-to-stock tail assumption; shared knee/peak miters remain provisional.
Solve the slopes from the farthest tail point on that horizontal datum;
do not impose the superseded gable-board top-corner bearing constraint.
Place the truss's back face against the board's shown face, with no solid
overlap. Do not add a notch or infer a fastening schedule.

Gable studs remain **on the gable board**, **24 in on center**. Alan
confirmed nominal **2x4**, actual **1.5 x 3.5 in**, with the **3.5 in face
outward**. Hook the tape at the **outside edge of the end wall**. The
current preview reads his reply “centered” as centering the first stud on
the **24 in mark**. That first-center interpretation remains provisional;
the wall-end datum, section, outward face and spacing are confirmed.
On the 120 in end wall this produces four centers at **24, 48, 72 and
96 in from that wall edge**, not a forced stud under the peak.

For another size, use inches consistently and calculate
`centerX = wallEndX + direction * (firstCenterIn + n * spacingIn)` for
integer `n >= 0`. `direction` is +1 from the starting end or -1 from the
opposite end; store the chosen end and first-center offset separately.
Use `spacingIn = 24` and preview `firstCenterIn = 24` for this example.
Keep the outside-wall datum: the upper plate starts 3.5 in inward and
the gable board starts `3.5 - 2.5 = 1 in` inward, so the first stud is
**23 in from the gable-board end**. Include only whole-width studs that
fit the gable board and roof. Do not center the pattern on the peak or
scale the first offset when changing wall width. In this model use
`studs.layoutOrigin = "outside-end-wall"`, `layoutFrom = "start" | "end"`,
`firstCenterIn` and `spacingIn`; anchors and measurements come from the
same member layout.

The exact top fit remains provisional. The preview puts their fronts
against the truss backs and clips their tops to the outer roof outline,
giving a face joint behind the truss. This replaces the earlier coplanar
underside joint; it is not a confirmed stud cut list. Show this fit choice
and the first-center interpretation for Alan to check.

Preserve the earlier lessons and ordinary finished model. Keep original
photos private; do not derive lengths or angles from pixels. Treatment,
species, grade, fasteners and lengthwise truss spacing remain unspecified.
Use [the measurement workflow](../../../.agents/skills/shed-measurements/SKILL.md)
for another size; these truss lengths and rise are not universal scaling rules.

### Lesson implementation and checks

`trussStudyPlan(gablePlan, { truss: true })` in
[model/truss-study.js](../../../model/truss-study.js) explicitly enables
`construction.trussStudy` after the floor, end wall and gable-board studies.
Settings alone cannot enable it. `trussStudyMembers` supplies the four roof
pieces to this part; `trussGableStudMembers` supplies the studs to gable-frame.
`trussStudyMeasurements` in
[model/truss-measurements.js](../../../model/truss-measurements.js) reads the
same member polygons for lengths and dimension anchors.

Review `learn.html?company=learning-side-loft&step=truss` and the static
[truss picture page](../../../truss.html). Preserve `?step=gable` as the
board-only lesson, all earlier assemblies and the ordinary finished model.
Run `node tools/check-truss-lesson.mjs` for measured geometry, assumptions,
opt-in behavior and unchanged earlier assemblies. Refresh pictures with
`node tools/export-joist-render-data.mjs --truss` followed by
`python tools/render-joist-picture.py --truss`; inspect the overview and
connection detail for readable labels and endpoints on the measured pieces.
Report browser and physical iOS checks separately from geometry checks.

## What it is in real life

This section describes the ordinary model. Its roof profile and construction
defaults do not establish the missing inputs for Alan's learned truss above.

The frame that holds the roof up. The standard build is TRUSSES: a flat,
factory-style frame of 2x4s set across the building every 24 in along its
length, one at each gable end. A truss has

* two (on a barn roof, four) TOP CHORDS following the roof line, mitred where
  the slopes meet; where a chord crosses a wall it sits on the wall's top
  plates with a seat cut (the "bird's-mouth"), and past the wall its TAIL
  runs out under the eave;
* a BOTTOM CHORD at the wall top between the long walls, tying them together
  (it is also the ceiling tie). Its ends are cut to the top chords, and
  because the drawn roof comes down to the wall top at the siding, on every
  roof but the cottage's those cut ends stop SHORT of the wall plates -- a few
  inches on a barn, 4 to 8 in on a gable, up to about two feet on a lean-to's
  shallow slope -- and it is the top chord's seat that bears on the plates.
  (On the cottage the raised eave leaves room for a true heel: the bottom
  chord runs onto the plates and the top chord sits on it.);
* WEBS between them: on a gable or the cottage's saltbox a king post under
  the ridge and, from 10 ft wide, two struts from its foot up to the middle of
  each top chord; on a gambrel (barn) roof a collar tie across the two knees
  and a king post over it -- the space under the collar is left open for the
  loft and for headroom; on a lean-to or single slope a MONO truss: an end
  post against the tall wall (the tall wall stands in for the truss's high
  post), posts with diagonals between them toward the low heel;
* plywood GUSSET plates, half an inch, on both faces at the apex, the knees,
  the heels and the king-post foot. A HEEL plate runs in from the wall until
  the bottom chord is half its depth, and a quarter foot past (never less than
  a foot), so it always covers the joint between the two chords -- on a
  lean-to that is two to three feet of plywood.

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
full trusses either side (the trimmers) carry the upper header and stay WHOLE
-- webs, heel plates and all; only the plate on a trimmer's inner face gives
way where the header butts its chord, by the ridge. See `part-dormer-frame`.

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

* The truss heel: the bottom chord stops short of the wall (above) and the
  top chord sits on the plate; the heel plate joins them. A real truss's
  bottom chord bears on the plate and runs to the outside of the wall; the
  drawn roof, which meets the wall top at the siding, leaves no room for that.

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

## Known limits (not fixed here -- other parts, or Alan's call)

* THE TRUSSES OVER A PORCH REST ON NOTHING BUT THE PORCH POSTS AT THE
  CORNERS. On a cabin with a front, side or wrap porch the trusses run on over
  the porch at the spacing, but no framing part draws a porch BEAM for their
  heels: the porch's header is Barnwright's painted band (a flat face, stage
  `porch-frame`), and the side walls stop at the porch. Measured: on the front
  porch cabins (Cabin, Lofted Barn Cabin) and the wrap porch cabins, every
  truss between the enclosed end wall and the porch's end truss has nothing
  under either heel; on the side porch cabins every truss over the notch
  reaches four feet past the porch wall with nothing under its door-side heel.
  The framing checks' "rests on or is nailed to" test passes them because the
  roof deck and the truss's own boards touch each other -- it cannot see a
  whole roof section floating. A porch beam on the posts, under the heels, is
  the missing piece (wall framing or porch framing, not this part).
* With `roof.framing: "rafter"` the only tie is a collar tie a little over
  halfway up (0.62 of the rise) -- a real rafter roof on a ridge BOARD also
  needs rafter ties in the lower third (or ceiling joists at the plates) to
  stop the walls spreading. Only the loft joists do that job, and only at the
  loft ends.

## Checks that guard it

* `node tools/check-framing-roof.mjs` -- on 1073 buildings (the 148 recorded,
  every style at every size, every dormer, and rafters / 16 in / 2x6 chords /
  2x6 studs / purlins / OSB / 2x4 loft joists on every style): every corner
  under the drawn roof slab (read off the finished `roofU` triangles), above
  the wall top inside the walls, not past or below the eave; no two boards
  overlapping by more than 0.01 ft; trusses at `roof.spacingIn` with the last
  gap no larger, one at each gable end, a top chord on every slope and a
  bottom chord (an end truss loses it only where gable openings take its whole
  width); a gusset plate over the bottom chord's end at every truss heel; a
  dormer's trimmers whole; the part draws exactly its members in its own
  stage; the finished building untouched. Also every style with each gable
  window dragged to both eaves, up and down, and the Standard Barn with two
  openings on one end (for `gableOpenings`, which this file owns).
* `node tools/check-framing.mjs` -- the same buildings and more, every
  framing part together: region, overlap with the walls and floor, bearing.
* `node tools/check-parts.mjs` -- the part is valid, its caption fills in from
  the construction settings with no number of its own, and this skill exists.
