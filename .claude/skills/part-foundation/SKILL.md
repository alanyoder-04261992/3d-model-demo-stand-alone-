---
name: part-foundation
description: The concrete blocks under the skids and the ground anchors a portable building is set on and tied down with -- read before changing how many there are or where they go.
---

# Blocks and anchors (`parts/foundation.js`)

## What it is in real life

A portable building is delivered onto solid concrete blocks laid under its
skids and tied down with ground anchors: steel augers screwed into the
ground beside the skids, each with a galvanized strap up to the skid.

What is drawn: one block per `site.perimeterFtPerBlock` ft of outside wall
(at least), spread evenly along EVERY skid, at least two a skid, one flush
with each end. A 4x8x16 block is laid along the skid with its widest face
down: 4 in tall, 8 in across (the skid is drawn 6 in wide, so an inch of
block shows each side), 16 in along. The anchors, `site.anchors` of them,
half down each OUTSIDE skid, on its inside face, each set in a gap between
blocks (half way between them) -- or, when there are more anchors than gaps
(a company laying a block every 12 ft, or asking for 12 anchors), at the
nearest spot to its even share of the skid that is clear of every block and
of the other anchors: an auger shaft into the ground with its helix, a head
on the grass and a strap up the side of the skid.

## Stage

Stage `foundation` (kind `frame`): Framing view only; in Watch-it-build it
is the first step after the site. PIPELINE: among the framing entries, only
with `frames: true`.

## Construction settings

* `site.blocks` -- "4x8x16": the block's size (smallest face down).
* `site.perimeterFtPerBlock` -- one block per this many feet of outside wall
  (default 4).
* `site.anchors` -- a rule list by length (default 4 up to 16 ft, 6 up to
  28 ft, 8 longer). `site.anchorsAssumed` is true: an ASSUMPTION -- Barnwright
  never drew anchors; confirm with the shop's master anchor plan.
* `skids.table`, `skids.bunkSpacingIn` -- where the skids are (`parts/skids.js`
  skidXs), which is where the blocks go.

## Where it came from in Barnwright

New -- Barnwright drew none. It fits under the skids Barnwright draws
(`3ddesign.html` skidXs 3826-3851 and the floor loop 3868-3875, pinned
SHA-256 `85c4b022...`; `parts/skids.js`), which stand on the ground at y 0.

## The owner's facts

* The skid positions are Alan's build sheet, Sep 2026 (see the `part-skids`
  skill): 6 wide 6 in, 8 wide 18 in, 10 wide 30 in, 12 wide 8 and 37 in,
  14 wide 8 and 54 in, from each side edge in to a skid's centre.
* The delivery facts on the Yoder site: the customer prepares the site; the
  master anchor plan and the engineer plans go with the quote. The anchor
  count here is not Alan's -- it is the library's assumption.

## Kept quirks

* Barnwright's skids stand ON the ground (y 0), so a block under a skid is
  set into the ground with its top only 0.008 ft (a tenth of an inch) proud
  of the grass (`BLOCK_PROUD`; the lawn is drawn at y 0.004) -- just enough
  to be seen round the skid. That overlaps the skid's bottom by 0.008 ft,
  inside the checks' 0.01 ft tolerance.
* The anchors sit on the INSIDE of the outside skids so they stay inside the
  footprint on every width (on a real building they are often outside).

## How to change it safely

* Counts and sizes are settings (`site.*`); change them there.
* If a company has more anchors than gaps between blocks, they share the
  gaps, spaced clear of the blocks and each other; only when a skid has no
  room left at all would one be missing -- the check counts them and will
  say so.
* Run `node tools/check-framing.mjs` after any change.

## Checks that guard it

* `node tools/check-framing.mjs` -- on every building (and a company laying a
  block every 12 ft with 12 anchors): at least one block per
  `site.perimeterFtPerBlock` ft of wall, on every skid a block at each end of
  the building, exactly `site.anchors` anchors, everything below the floor
  inside the footprint, standing in the ground, overlapping nothing (skids
  included).
* `node tools/check-parts.mjs`, `node tools/check-imports.mjs`.
