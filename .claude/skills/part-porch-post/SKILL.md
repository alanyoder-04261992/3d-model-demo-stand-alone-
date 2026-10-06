---
name: part-porch-post
description: A porch post the customer places along the edge of a cabin's porch deck -- read before changing its size, colour, or where it stands on front, side and corner porches.
---

# Porch post (`parts/openings/porch-post.js`)

## What it is in real life

A stained wood post (about a 4x4) holding up the porch roof, standing on the
porch deck from the deck top to the porch beam at the wall top. The cabins'
standard layouts include their posts as items, and the customer can add more
or drag them along the porch edge. On the picture: one box, 0.34 ft square,
colour `#96682F`, and its tap target.

Where it stands, 0.2 ft in from the deck's outer edge:
* on a **front porch** (cabins, lofted barn cabins) -- and on the front face
  of a **corner porch** -- along the front edge, `z = L/2 - 0.2`, at
  `x = ` its position;
* on a **side-cabin porch** or a right-side porch -- and on the side face of a
  corner porch -- along the side edge, `x = W/2 - 0.2`, at `z = -` its
  position.
On any other building, or a corner-porch post on any other face, nothing is
drawn.

## Stage

`porch-frame` (id 19, kind `both`: "Porch posts and beam"): shown in the
Finished view AND the Framing view, and lowered into place at the
`porch-frame` step of Watch-it-build (after the siding, before the roof
framing). Drawn by PIPELINE entry 14, `openings` (`parts/openings/index.js`),
for every item whose catalogue `draw` trait is `porch-post`, in the order the
items were added (Barnwright's `buildShed` line 4043). The porch's own beam,
rails and deck are the `porch` part's.

## Construction settings

* **`porch.post`** (`"4x4"`) -- the caption only. The drawn post stays
  Barnwright's 0.34 ft (4 in) square box whatever the size says.

## Where it came from in Barnwright

`boisterous-lokum-a737e0/public/3ddesign.html` (pinned SHA-256
`85c4b022d2f75db2145f4ff5cf1ea43c1b52074f8972b96180d64840eb4c5d36`):
`renderItem`'s post branch, lines **3158-3171** (`if(c.k==="post"){ ... }`),
after the preamble (3122-3140, `common.js eachItem`).

Porting edits (docs/ARCHITECTURE.md, Porting rules), and nothing else:
1. Rule 1: `T()` -> `plan.t`, `dims()` -> `plan.d`; `mat box` are the kit's;
   `y0` from `engine/constants.js`.
2. Rule 3: the branch was chosen by the kind (`c.k==="post"`); the item now
   reaches this module by its `porch-post` draw trait.
3. Rule 6: `hitQuads.push` -> `kit.hit`; the caller clears the current item.

## The owner's facts

None recorded: Barnwright's post branch carries no comment from Alan. (The
manufacturer file calls it a 4x4; Barnwright draws it 0.34 ft square.)

## Kept quirks

* **Drawn 0.34 ft square**, not a real 3 1/2 in 4x4, and from the deck top to
  the WALL top (`y0 + wallH`).
* **A post on a building with no porch draws nothing** -- but the preamble has
  already made the five item materials (Barnwright's order).
* The front-porch position is world `x = pos`; the side-porch position is
  world `z = -pos` (the R wall's own direction).

## How to change it safely

1. Read this skill, `part-openings` and `part-porch`, and the comments in
   `parts/openings/porch-post.js`.
2. Run `node tools/check-golden.mjs --part porch-post` before and after, then
   the whole `node tools/check-golden.mjs` (the paint and draw order of
   `pwood`).
3. Where a post may be dragged is `model/layout.js clampPos` (porch `S` and
   `C` rules), not this file.
4. If the look must really change, re-record the golden fixtures on purpose
   (`node tools/capture-golden.mjs`, with a reason).

## Checks that guard it

* `node tools/check-golden.mjs --part porch-post` -- every porch-post
  triangle of the 148 recorded Barnwright buildings, number for number (32
  buildings, 1,032 triangles, Sep 26 2026): the cabins' standard posts, extra
  posts on front, side and corner porches, posts dragged apart, a post on each
  face of a corner porch.
* `node tools/check-golden.mjs` -- also the draw order and paint.
* `node tools/check-parts.mjs`, `node tools/check-imports.mjs`.
