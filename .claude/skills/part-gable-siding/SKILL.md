---
name: part-gable-siding
description: The siding that fills each gable end of a portable building from the wall top up to the roof line (including the cottage's fill up to its raised eave) -- read before changing the shape of a gable end.
---

# Gable-end siding (`parts/gable-siding.js`)

## What it is in real life

The end walls of a building -- F, the front gable end, and B, the back -- are
sided right up into the peak with the same sheets as the walls, cut to the
roof's slope. The walls part draws each end wall to the wall top; this part
fills the shape above it:

* a gable, gambrel (barn) or saltbox roof: the roof's own cross-section;
* a lean-to: the triangle up to the high left (-x) side;
* a single slope: the triangle up to the high right (+x) side;
* the cottage (Cottage Shed, Metal Cottage Shed): up to the roof LINE, which
  on the cottage runs past the wall top at the eave (its roof deck lands on a
  level soffit, one fascia above it), and set 0.028 ft out to the rake plane.

## Stage

Stage `gable-end` (kind `finish`). PIPELINE entry 7 (`parts/index.js`), after
the kennel extras and before the gable band. Barnwright draws the fill, the
band and the vent of the F end, then of the B end, in one loop; they go into
three different materials, so running the fill for F and B, then the band,
then the vent gives every material the same triangles in the same order.

## Construction settings

* `roof.shapes.lean.rise`, `roof.shapes.slope.rise` -- the height of the
  lean-to and single-slope fill. Defaults `{"w": 0.17}` and `{"w": 0.28}`,
  bit for bit Barnwright's `W*0.17` and `W*0.28`; the same settings the roof
  line is drawn from, so the fill always meets the roof (checked with a
  steeper rise: the fill still reaches the roof peak).
* `roof.cottageEave` (`backIn 4`, `frontIn 8`, `fasciaIn 4`) -- the cottage's
  eave, through `model/roof-shapes.js cottageEave`, which decides how high the
  cottage fill reaches at each corner.
* The gable, gambrel and saltbox fills are `plan.prof` (the roof profile,
  itself built from `roof.shapes.*`).

## Where it came from in Barnwright

`boisterous-lokum-a737e0/public/3ddesign.html` (pinned SHA-256
`85c4b022d2f75db2145f4ff5cf1ea43c1b52074f8972b96180d64840eb4c5d36`),
`buildShed`'s gable-ends loop, lines 3962-3979 (`pp`, the cottage branch and
`gq2(mB,pp,gz,sgn,gob,"sid")`). `cottageEave` is 2185-2202 (ported in
`model/roof-shapes.js`).

Porting edits, all from the contract's Porting rules:
* `state.type === "CS" || state.type === "MCS"` -> the `cottage` style trait
  (rule 2); `T()` -> `plan.t`, `prof` -> `plan.prof`, `mB` is `core.mB`
  (rule 1);
* the lean/slope `W*0.17` / `W*0.28` -> the roof's rise, and
  `cottageEave(P, ROOF_TH)` -> `cottageEave(P, ROOF_TH, roof.cottageEave)`
  (rule 4, Barnwright's values as the defaults);
* the fill polygon is worked out in `gableFill(plan)` (exported), the same
  arithmetic (rule 5);
* `kit.setStage("gable-end")` (rule 7).

## The owner's facts

Kept word for word in the code (Barnwright 3967-3978, from Alan's drawings of
the cottage eave, Aug 2026):

> A COTTAGE DECK RUNS ABOVE THE WALL TOP AT THE EAVE (cottageEave), so the
> gable end has to be filled up to the roof line and not to the bare
> wall-to-peak triangle -- otherwise a wedge of sky shows between the siding
> and the roof, widening to half a foot at the front corner.

> out to the rake plane, or the 3/8 in between the siding and the roof edge
> shows as a chip of sky at each eave corner. The band over it is proud by
> 0.10 anyway, so nothing steps.

The eave itself (Alan, Aug 2026, in `model/roof-shapes.js`): back 4 in, front
(the door side) 8 in, both level soffits, the roof raised one 4 in fascia.
Barnwright's note on it (2185-2196), word for word -- it is what decides how
high this fill reaches at each corner (`model/roof-shapes.js` keeps a shorter
version):

> THE COTTAGE EAVE, and it has to satisfy two drawings of Alan's at once.
> His RED line over the designer is ONE STRAIGHT RUN each side, ridge to the
> outer tip, no kink at the wall. His BLUE section of the same eave is a 4 in
> fascia and then 8 in of level soffit back to the wall, which is also what
> "they are straight 90 degree with the wall" was pointing at.
> Both are true only if the deck runs PAST the wall top and lands at the
> fascia, one fascia depth above the soffit -- which is how the real one is
> framed: rafters bearing on the plate, tails cut off level for the soffit.
> Pushed along the slope instead (what shipped first) the tip lands half a
> foot BELOW his line; a level return at the wall bends a line he drew
> straight. Measured off his screenshot, this construction puts all three of
> his points -- both tips and the ridge -- inside the width of his brush.

## Kept quirks

* The cottage fill takes `prof[1]` as the ridge: it assumes the saltbox's
  three-point profile.
* A copy of the profile is handed to `cottageEave` (`prof.map(q => q.slice())`)
  because `cottageEave` changes the list it is given; never pass `plan.prof`
  itself (it is frozen, and the roof and items read it).
* The fill uses the "sid" UVs (divided by GROOVE, even on metal).
* A gable or gambrel fill is the profile reversed (`prof.slice().reverse()`)
  so it winds the right way before `gq2` mirrors it for the B end.

## How to change it safely

* Run `node tools/check-golden.mjs --part gable-siding` before and after; it
  must stay green on all 148 buildings.
* Change a company's rise or cottage eave in its construction settings, never
  here; the roofing part reads the same settings, so the two stay together.
* Keep F before B and keep this entry before the gable band and vent.
* A real look change means re-recording the golden fixtures on purpose
  (`node tools/capture-golden.mjs`, with a reason).

## Checks that guard it

* `node tools/check-golden.mjs --part gable-siding` -- every gable-end siding
  triangle of all 148 recorded Barnwright buildings, number for number (492
  triangles), gable, gambrel, saltbox cottage, lean-to and single slope;
  drawn on its own it is exactly those triangles.
* `node tools/check-parts.mjs` -- the part is valid and this skill is well formed.
* `node tools/check-imports.mjs` -- the file loads in Node with no browser.
