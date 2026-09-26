---
name: part-kennel
description: The Dog Kennel's run -- open front with pipe gates, chain-link sides, the partition with doggie doors, the divider, run ceiling and diamond-plate rims -- read before changing anything on the kennel style.
---

# Dog kennel run and gates (`parts/kennel.js`)

## What it is in real life

The Dog Kennel is a portable building split in two along its length. The
BACK half is an enclosed room: sided outside, and you can see its inside face
(a shade darker) from the run. The FRONT half is an open run for the dogs:

* along both sides, chain-link fence fabric on thin galvanized line posts,
  under a cream band at the top of the wall, with a white trim board where the
  room meets the run;
* across the front, a cream header board over three chunky wood posts and two
  full-width galvanized pipe gates (frame, mid rail, latch-side upright, two
  hinge collars, a latch rod), with chain-link behind;
* a partition wall between the room and the run with one doggie door into
  each half of the run (trim surround, white door, dark opening);
* a chain-link divider down the middle of the run with galvanized top and
  bottom rails, a light ceiling over the run, and diamond-plate kick rims
  round the run floor.

## Stage

The kennel's triangles carry four building steps (`stage` lists them, the
first is the main one): `siding` (the enclosed half of each side wall, its
inside face, the partition and its inside face), `trim` (the front header
board, the junction board and the band over the run), `doors` (the doggie
doors) and `extras` (chain-link, gates, wood posts, line posts, divider
rails, the run ceiling, the diamond-plate rims). All four are kind `finish`,
so they show only in the Finished view and land in Watch-it-build in that
order of the build.

It is drawn from TWO places, both at Barnwright's positions:
* `front` and `side` (Barnwright `kennelFront` / `kennelSide`) are called
  from the siding part's walls loop (`parts/siding.js`, PIPELINE entry 3), at
  the F wall and the R/L walls. Each is wrapped in `kit.part("kennel", ...)`
  (by the siding loop, and by `front`/`side` themselves), so its triangles
  belong to the kennel.
* The kennel's own PIPELINE entry 6 (`parts/index.js`, after the corner trim
  and the porch junction trim) runs `kennelExtras` only.

The kennel's inside BACK face (bodyIn on the B wall) is drawn by the siding
loop's own lines and belongs to `siding`.

## Construction settings

None. Every kennel dimension is Barnwright's drawing (header 0.15 ft under
the wall top, mesh pitch 0.46 ft, wire 0.017 ft, posts 0.34 ft, gate frame
0.07 ft, partition at the middle of the length, doggie door surround 1.7 x
2.35 ft, rims 0.46 ft tall, line posts 0.10 ft). The run depth is always half
the length (RD = L/2).

## Where it came from in Barnwright

`boisterous-lokum-a737e0/public/3ddesign.html` (pinned SHA-256
`0bdcf663c5cb988623d2cb0dd271156fb690564072b301b0a15b917fd921ac6c`):
* `meshWall(b,w,x0,ym0,x1,ym1,sp,o)`, lines 3707-3717 -- the chain-link;
* `kennelFront(w,half,topY,mB,mT)`, lines 3718-3755;
* `kennelSide(w,k,half,topY,mB,mT)`, lines 3756-3780;
* `kennelExtras(W,L,topY,prof)`, lines 3782-3816, called at line 3961;
* the calls from the walls loop, lines 3881-3882.

Porting edits, all from the contract's Porting rules:
* every function takes the plan and the kit first; the kit's `mat wq box
  wallPt quadUV pushQuad wbrace` are bound to local names of the same name, so
  the bodies read as Barnwright's (rule 1);
* `dims()` -> `plan.d`, `state` -> `plan.state`, `STEP` -> `kit.STEP`, `y0`
  from `engine/constants.js`, texture names from `engine/tex-names.js` (rule 1);
* `state.type === "DK"` (in the siding loop and `appliesTo`) -> the `kennel`
  style trait (rule 2);
* `kit.setStage` calls (rule 7) and the `kit.part("kennel")` wrappers
  `front` / `side` (rule 7).

## The owner's facts

The comments on the real kennel, kept in the code: "one cream header board
across the front", "three chunky wood posts", "two full-width galvanized pipe
gates", "hinge collars on the outer post side", "galvanized line posts along
the run (thin metal, like the real one)", "white trim board at the junction",
"cream band over the run", "doggie doors, one per run", "chain-link divider
between the two runs", "light ceiling over the run", "diamond-plate rims
around the run floor". No measurements from Alan are recorded for the kennel;
its numbers are Barnwright's drawing.

## Kept quirks

* `kennelFront`'s `mB` and `kennelExtras`'s `prof` are never used -- kept as
  Barnwright has them.
* `kennelExtras` asks for `body` and `trim` again without the bump argument;
  first call wins, so it gets the core materials unchanged. Do not "tidy" it.
* The gates, posts, rims and doggie doors are fixed colours (#96682F wood,
  #cfd4d8 / #a6adb3 galvanized, #FBFBF8 white, #c6cbd0 plate, #F2F1EA
  ceiling), not the customer's palette. `pwood`, `galv`, `galvD` are asked
  for again in `kennelSide` (first call wins).
* The inside faces divide their UVs by `STEP` (RIB on metal), unlike the
  "sid" walls, which divide by GROOVE.
* The enclosed half is always the BACK half (z < 0); the line posts stand at
  fixed z = 0.22 and z = L/4. `clampPos`'s kennel rule assumes the same.
* The mesh is coarse: 0.46 ft (about 5 1/2 in) between wires, where real
  chain-link is about 2 in. Kept, because the picture is Barnwright's.

## How to change it safely

* The kennel's F, R and L walls are drawn from the siding loop: read the
  `part-siding` skill before moving the calls.
* Run `node tools/check-golden.mjs --part kennel,siding` before and after
  (and `--case dk-8x12,dk-8x16,col-dk-clay-hunter,kennel-dk-8x12-window-back,kennel-dk-8x16-door-light`
  for just the kennels). It must stay green.
* Never reorder the `mat()` calls: the order materials are first created is
  the draw order (`pwood`, `galv`, `galvD` at the front; `bodyIn` at the back
  wall; then the rest), and the first call decides a material's paint.
* If the kennel's look must really change, re-record the golden fixtures on
  purpose (`node tools/capture-golden.mjs`, with a reason).

## Checks that guard it

* `node tools/check-golden.mjs --part kennel` -- every kennel triangle of the
  5 recorded kennel buildings, number for number (5,948 triangles): the front,
  both sides and the extras; drawn on its own it is exactly those triangles.
* `node tools/check-golden.mjs --part siding` -- the siding loop that calls
  it, including the kennel's inside back face.
* `node tools/check-parts.mjs` -- the part is valid and this skill is well formed.
* `node tools/check-imports.mjs` -- the file loads in Node with no browser.
