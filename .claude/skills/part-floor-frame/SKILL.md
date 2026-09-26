---
name: part-floor-frame
description: The floor frame (joists, rims and end joists on the skids) of a portable building, and the shared framing kit the other framing parts use -- read before changing joist size, spacing or layout, or any framing helper in parts/floor-frame.js.
---

# Floor frame (`parts/floor-frame.js`)

## What it is in real life

The floor of a portable building is a frame of joists laid ACROSS the width,
sitting on the skids that run along the length: a rim joist down each long
side, an end joist across each end, and joists in between at the shop's
spacing on centre, measured from the back end. The tongue-and-groove decking
is nailed on top (part `floor-deck`). A wall that runs the same way as the
joists and stands on the floor away from its ends -- the side porch's S2/S3,
the corner porch's P3, the kennel's partition -- gets a joist of its own
under its bottom plate (doubled beside a layout joist when one is close),
the way a framer backs up a wall.

On a cabin with a FRONT porch (porch "F") or the corner porch ("C"), this
frame stops at the front wall (its front end joist is right under it); the
4 ft porch deck in front is framed by `porch-deck-frame`. A side porch and
the corner porch's run down the door side sit on this frame: the joists run
straight under the porch walls.

## Stage

Stage `floor-frame` (kind `frame`): Framing view only, never Finished; in
Watch-it-build it lands after the skids. PIPELINE: among the framing entries
(`parts/index.js`), run only by `assemble(plan, {frames: true})`, after every
finished part, so it can never change Barnwright's picture.

## Construction settings

* `floor.joist` -- the joist size; a rule list, default 2x4 on 8 ft wide and
  smaller, 2x6 above. Its thickness is drawn (1 1/2 in).
* `floor.rim` -- the rim size (default 2x6).
* `floor.spacingIn` -- joists on centre, default 16. The option "Floor joists
  12 in on center" sets it to 12 (`rate.jo12` construction effect), and the
  drawing puts them 12 in apart and adds joists.
* `floor.deck.thicknessIn` x `floor.deck.layers` -- the decking on top; the
  joists are drawn that much shallower so the decking's top is y0.
* `porch.joist` -- read here for the porch-deck part's joists.
* `walls.stud` -- its depth, to find the bottom plate of a cross wall.

## Where it came from in Barnwright

New -- Barnwright drew none. It fits into Barnwright's floor slab
(`buildShed` floor loop, `3ddesign.html` lines 3868-3877, pinned SHA-256
`0bdcf663c5cb988623d2cb0dd271156fb690564072b301b0a15b917fd921ac6c`; ported
in `parts/floor.js`): the slab runs from the top of the skids (y 0.5) to the
deck top y0 = 0.92 and is inset 0.03 ft inside the walls (0 on the kennel),
so the frame is inset the same (`floorInset`). docs/ARCHITECTURE.md "Framing
datums" 1: joists on the skids, drawn depth = 0.42 - deck thickness x layers.

THE FRAMING KIT lives in this file and is imported by the other framing
parts: `lumberSize` ("2x6" -> real feet, "doubled" -> plies), `FRAME_PAINT` /
`frameMat` (framing's own materials, never a finished bucket), the member
constructors `beamMember boxMember wallMember slabMember prismMember`,
`drawMembers`, `drawPrism`, the polygon helpers (`clipRect clipHalf
cleanPoly triangulate polyArea pointInPoly`), `floorPlanOf` (footprint, the
enclosed room, the porch decks, heights), `roomOutline` / `porchOutlines`,
`rectFrame` (one rectangular frame) and `crossWallPlates`. `WALL_INSET`
(0.02) and `PARTITION_INSET` (0.05) say where every wall frame stands.

## The owner's facts

* The shop's floor (Barnwright 2147-2150, kept word for word in
  `parts/floor.js` and here): "Floor: 2x6 joists on skids with 5/8" decking
  (8-ft-wide and smaller use 2x4 joists) -- that assembly is the 0.92 ft base
  line y0."
* Alan, Aug 2026: standard joist spacing is 16 inches on centre; the 12 in
  upgrade: "their less space from support under the floors so you are going
  have less waves in your floor if you are putting heavy items in the barn."
* Siding hangs past the wall bottom "to nail into the 2x6 rim" (Barnwright
  2153-2155) -- the rim this part draws.

## Kept quirks

* The joists are drawn 0.42 ft minus the decking deep (about 4.4 in with one
  layer), not a real 5 1/2 in 2x6: the drawn floor height is Barnwright's
  (skids 0.5 ft, deck top 0.92 ft) and the framing fits into it. The caption
  names the real lumber.
* The rims are not over the skids (neither are they on the real building);
  they are nailed to the joist ends -- the check treats them as fastened.

## How to change it safely

* A company's joists: change `floor.joist`, `floor.spacingIn`, `floor.rim` in
  its construction settings (or give an option a `construction` effect),
  never the code.
* The layout starts at the BACK end (-z) so 8 ft sheet joints land on joists;
  keep that if you touch `rectFrame`.
* The kit is shared: a change to `wallMember`, `drawPrism` or the polygon
  helpers moves every framing part. Run `node tools/check-framing.mjs` (all of
  it) and `node tools/check-golden.mjs` after any change here.

## Checks that guard it

* `node tools/check-framing.mjs` -- on 956 buildings: joists on their
  floor.spacingIn marks from the back end with no wider bay, 12 in joists
  closer and more of them, every joist resting on a skid, nothing overlapping
  or outside the footprint, and the finished building untouched.
* `node tools/check-golden.mjs` -- drawing the framing leaves all 148 recorded
  Barnwright buildings exactly as they were.
* `node tools/check-parts.mjs`, `node tools/check-imports.mjs`.
