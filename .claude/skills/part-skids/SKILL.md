---
name: part-skids
description: The skids (treated runners) under a portable building -- read before changing where they sit, how many there are, or how they are drawn.
---

# Skids (`parts/skids.js`)

## What it is in real life

Every portable building sits on skids: heavy treated timbers laid on edge
along the whole length of the building. They let the finished building be
winched onto a trailer and set down on blocks, and the floor joists sit on
top of them. A 6, 8 or 10 ft wide building has two skids; a 12 or 14 ft wide
one has four (a pair tucked under the walls and a pair on the trailer bunks).

## Stage

Stage `skids` (kind `both`): shown in the Finished view AND the Framing view,
and placed third in Watch-it-build (after the site and the foundation
blocks). PIPELINE entry 1 (`parts/index.js`): Barnwright draws the skids first
thing in `buildShed`, inside the floor loop, before the walls.

## Construction settings

* `skids.table` -- per building width in feet, the inches from each side edge
  in to a skid's centre. Default (Alan's build sheet):
  `{ "6": [6], "8": [18], "10": [30], "12": [8, 37], "14": [8, 54] }`. Each
  number gives a PAIR of skids (one each side). A company that builds its
  skids elsewhere changes this table and the drawing follows.
* `skids.bunkSpacingIn` -- for a width not in the table: two skids this many
  inches apart, centred (never closer than 6 in to the edge). Default 60.
* `skids.size` (`"4x6"`), `skids.onEdge`, `skids.treated` -- the caption only.
  The drawn skid stays Barnwright's 0.5 x 0.5 ft box whatever the size says.

## Where it came from in Barnwright

`boisterous-lokum-a737e0/public/3ddesign.html` (pinned SHA-256
`0bdcf663c5cb988623d2cb0dd271156fb690564072b301b0a15b917fd921ac6c`):
* `skidXs(w)`, lines 3826-3851 -- ported as `skidXs(w, skids)`;
* `buildShed` floor loop, lines 3868-3875: `var SKX=skidXs(W);` and, per floor
  segment, `var fend=fl+(fi===0||fi===NF-1?0.2:0); for(...) box(mSk,SKX[sx],0,fzc,0.5,0.5,fend);`.

Porting edits, all from the contract's Porting rules: the build sheet `SHEET`
and the 60 in fallback are read from `plan.construction.skids` with
Barnwright's values as the defaults (rule 4); the floor segments come from
`floorSegments()` in `parts/floor.js` (the same arithmetic -- Barnwright draws
the skid boxes and the deck slab in ONE loop, and the two go into different
materials, so drawing them in two passes gives each material the same
triangles in the same order); `mSk` is `core.mSk`; `kit.setStage("skids")`.

## The owner's facts

From Alan's build sheet, Sep 2026 (Barnwright's comment, kept word for word
in `parts/skids.js`):

> WHERE THE SKIDS SIT UNDER THE BUILDING. Alan's build sheet, Sep 2026,
> measured from each side edge of the building in to the CENTRE of a skid:
> 6 wide .. 6", 8 wide .. 18", 10 wide .. 30", 12 wide .. 8" and 37",
> 14 wide .. 8" and 54" (four skids).
> Six, eight and ten wide are two skids and all three land on exactly 60"
> between centres -- one trailer's bunk spacing, which is the number that
> makes the rest of the sheet read straight, and it is what an unlisted
> width falls back to. Twelve and fourteen carry four: a pair tucked right
> under the walls and a pair on the bunks.
> It was ONE rule before this, +/- 0.30 x width, which put two skids on
> every building however wide and sat them nowhere in particular -- on a
> 12 wide that is 28.8" in from the edge, and there should be four.

The skids are treated 4x6 laid on edge (`library/construction.json`).

## Kept quirks

* The drawn skid is a 0.5 x 0.5 ft (6 in) square box from the ground to
  y 0.5, not the real 3 1/2 x 5 1/2 in 4x6 -- the finished picture is
  Barnwright's.
* The skids are drawn in pieces, one per floor segment (the floor is split
  into `max(3, ceil(L / 2.5))` pieces), and the two end pieces are 0.2 ft
  longer, so the skids poke about 0.1 ft past each end of the floor.
* The table is looked up by the ROUNDED width (`Math.round(w)`).

## How to change it safely

* A company's skid positions: change `skids.table` in its company file (or
  the manufacturer file), never the code.
* Anything in `parts/skids.js` or `floorSegments()` in `parts/floor.js` moves
  Barnwright's picture. Run `node tools/check-golden.mjs --part skids` before
  and after; it must stay green on all 148 buildings. If the look must really
  change, re-record the golden fixtures on purpose
  (`node tools/capture-golden.mjs`, with a reason in the commit).
* The framing parts (`floor-frame`, `foundation`) sit on and under the skids:
  if the skids move, check `node tools/check-framing.mjs` too.

## Checks that guard it

* `node tools/check-golden.mjs --part skids` -- every skid triangle of all 148
  recorded Barnwright buildings, number for number (48,264 triangles).
* `node tools/check-parts.mjs` -- the part is valid, its caption fills in from
  the construction settings, and this skill exists.
* `node tools/check-imports.mjs` -- the file loads in Node with no browser.
