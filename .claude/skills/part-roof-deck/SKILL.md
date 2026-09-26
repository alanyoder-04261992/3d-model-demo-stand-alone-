---
name: part-roof-deck
description: The roof deck under the steel -- flat 2x4 purlins on metal buildings, OSB sheathing on the rest -- read before changing purlin spacing, sheet layout, or where the deck stops at walls, eaves and the dormer.
---

# Roof deck (`parts/roof-deck.js`)

## What it is in real life

What the steel roof is screwed to, lying on top of the trusses or rafters:

* PURLINS (metal buildings by default): 2x4s laid FLAT across the trusses,
  running the whole length of the roof and out over the gable-end overhangs,
  every 24 in up each slope -- the first flush with the eave (or a barn
  roof's knee), then on the spacing, and one flush at the top of the slope
  under the ridge (or the knee). Where the top one would crowd the last
  regular one, the regular one steps down just clear of it, so no gap is ever
  wider than the spacing. The rows of screws the roofing draws "about every
  two feet of slope where the purlins are" are these.
* OSB SHEATHING (everything else): sheets 4 ft up the slope by 8 ft along the
  building, laid from each eave (or knee) upward with the usual 1/8 in gap;
  the top row is cut to fit, the two slopes meet in a mitre at the ridge, and
  along the building the sheets are cut to equal lengths (no sliver left
  hanging over a gable-end overhang).

The deck fills the space between the underside of the drawn roof slab and
the tops of the trusses (`parts/roof-frame.js` puts the framing exactly one
deck-thickness down), runs out over the eave to the tip of the drawn roof on
eaves that have rafter tails under them, and over the gable-end (rake)
overhang. Where it crosses a wall it is cut off at the wall top like
everything else (the drawn roof meets the wall top in a sharp corner). It is
left out over a lean-to's or single slope's tall wall (whose framing rises to
the roof line) and out over the single slope's boxed eaves (no tails there,
so nothing to nail it to). On a Dormer Shed it is left open where the dormer
stands (roof-frame `dormerHoles`: the dormer's inside and the strip its front
wall stands in); the dormer's own deck is in `parts/dormer-frame.js` (same
code: `deckOnSection`, `layPurlins`, `subtractBoxes`).

## Stage

Stage `roof-deck` (kind `frame`): hidden in the Finished view, shown in the
Framing view; in Watch-it-build it lands just before the roofing and is
hidden once the roofing lands. PIPELINE entry `roof-deck`, among the framing
entries (only with `frames: true`). Materials `osb` (texFlat `#b8915a`) and
`lumber` for purlins.

## Construction settings

* `roofDeck.type` -- a rule list; default `[{when: {metal: true}, value:
  "purlins"}, {value: "osb"}]`: purlins on a metal building, OSB otherwise.
* `roofDeck.purlins.size` (`"2x4"`, laid flat: its thin side is the deck's
  thickness, its wide side the width up the slope) and
  `roofDeck.purlins.spacingIn` (24).
* `roofDeck.sheathingIn` -- OSB thickness, default 0.4375 (7/16 in).
* The sheet size (4 x 8 ft) and the 1/8 in gap are the standard sheet, in the
  code (`SHEET_UP`, `SHEET_ALONG`, `SHEET_GAP`).
* `walls.stud` -- how deep a tall wall's framing is (no deck over it).

## Where it came from in Barnwright

New -- Barnwright drew none. It lies directly under the roof Barnwright draws
(`profileRoof`, `public/3ddesign.html` 2562-2976: the slab's underside at the
profile line, run out over the eaves; the rake overhang passed in from
`buildShed` 4035-4039; a gambrel's upper sheets reaching RAKE_STEP further).
Pinned SHA-256 `0bdcf663c5cb988623d2cb0dd271156fb690564072b301b0a15b917fd921ac6c`.

## The owner's facts

* "SCREWS, one per pan, a row about every two feet of slope where the purlins
  are" (Alan's photographs of a steel roof, `parts/roofing.js`) -- the
  purlins' 24 in spacing up the slope.
* Metal roofing panels have a raised rib every 9 in (RIB 0.75) -- the steel,
  not the deck, but the purlins run across those panels.
* The single slope has "a proper boxed eave with a soffit under it" (Alan's
  photo, `parts/roofing.js`) -- in the drawing that soffit is the roof's own
  sloped underside, which is why no deck is framed out there.
* Whether a deck is purlins or OSB is the construction default, not a
  statement of Alan's; confirm with the shop.

## Kept quirks

* At a wall line the deck is cut down to nothing (the drawn roof meets the
  wall top in a corner): a small wedge is missing over each long wall.
* Along the building the sheets are cut to equal lengths rather than full 8 ft
  sheets plus a short one.

## How to change it safely

1. Read this skill and `part-roof-frame` (it reads the hub's `roofSection`,
   `fitRoof`, `band`, `zRange`, `dormerHoles`).
2. Change the deck type or the purlin spacing and size in
   `library/construction.json` (or a company's `construction`): the trusses
   move down or up by the deck's thickness by themselves.
3. Run `node tools/check-framing-roof.mjs`, `node tools/check-framing.mjs`,
   `node tools/check-parts.mjs` and `node tools/check-golden.mjs`.

## Checks that guard it

* `node tools/check-framing-roof.mjs` -- purlins exactly where
  `roofDeck.type` is "purlins" (by default the metal buildings, and only
  they), OSB elsewhere; purlins flush at the low end and at the top of every
  slope and no further apart than `roofDeck.purlins.spacingIn` (except across
  a tall wall); every sheet and purlin under the drawn roof slab, only deck
  out over the gable-end overhangs, no overlap with the trusses or the dormer;
  exactly its members drawn, in stage `roof-deck`.
* `node tools/check-framing.mjs` -- region, overlap, and every sheet and purlin
  resting on or nailed to the framing.
* `node tools/check-parts.mjs` -- valid part, caption, this skill.
