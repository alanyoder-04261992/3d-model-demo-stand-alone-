---
name: part-openings
description: The openings walk (parts/openings/index.js + common.js) that hands every door, window, light and extra porch post to its draw module, and the trim every door and window shares -- read before changing the item order, the dispatch by draw trait, the casings, the head board, the porch header band or the window sill.
---

# Doors, windows and lights -- the openings walk (`parts/openings/index.js`, `parts/openings/common.js`)

## What it is in real life

Everything the customer puts ON the building: doors, roll-up doors, wall
windows, gable windows, the outside light and extra porch posts. Each one is
its own part with its own skill (`part-door-wood`, `part-door-steel`,
`part-door-lite`, `part-roll-up`, `part-window`, `part-gable-window`,
`part-light`, `part-porch-post`). This part is the walk that visits them, in
the order the customer added them, and the trim they all share:

* **Side casings** -- the 3 1/2 in boards standing proud of the siding up each
  side of an opening. On a DOOR they stop just under the head board (three cut
  boards with a joint); on a WINDOW they run right up into it.
* **The head board** -- over every opening, WIDEST AT ITS TOP, its ends cut at
  22.5 degrees sloping back down onto the side casings (a drip cap).
* **The porch header band** -- on a porch building (cabins), a second trim
  band over every door and window on EVERY wall (not a roll-up).
* **The window sill** -- the head's mirror image under a window: widest at its
  bottom, face a little prouder than the casings.
* A soft shadow on the wall round the whole thing, and the tap target the
  customer touches to pick the item.

No hole is ever cut in the wall: the siding is one unbroken sheet, and every
opening is layered in front of it a few hundredths of a foot out. The depth
order of those offsets is the whole illusion of a recessed opening.

## Stage

This entry draws nothing under its own name: every triangle is attributed to
the item's own part (a triangle left as `openings` would fail the golden
check). The steps each item lands on (`parts/stages.js`):

| draw trait | module | part | stage |
|---|---|---|---|
| `shop-door` | `door-wood.js` | door-wood | `doors` |
| `steel-6panel` | `door-steel.js` | door-steel | `doors` |
| `lite-door` | `door-lite.js` | door-lite | `doors` |
| `roll-up` | `roll-up.js` | roll-up | `doors` |
| `window`, `transom` | `window.js` | window | `windows` (shutters `extras`) |
| `faux-loft`, `gable-1824`, `octagon` | `gable-window.js` | gable-window | `windows` |
| `light` | `light.js` | light | `extras` |
| `porch-post` | `porch-post.js` | porch-post | `porch-frame` |

The shared trim (casings, head, porch band, sill) is drawn on the item's own
step: a door's trim lands with the door, a window's with the window. The tap
target (`kit.hit`) records that step too.

PIPELINE entry 14, `openings` (`parts/index.js`): Barnwright's `buildShed`
line 4043, after the roof and the dormer and before the ground. It must stay
there: the materials the items make (`aoWall`, `iron`, `galv`, `doorSh6`,
`white` ...) are drawn in the order they are first made.

## Construction settings

Read through `model/layout.js openingRect` and `model/construction.js`:

* **`openings.doorHeightIn`** `{gambrel: 71.5, other: 76.5}` -- the wooden
  shop door's opening height in inches by roof shape (`doorHeightFt`, drawn
  to four decimals of a foot: 5.9583 and 6.375, Barnwright's numbers). Set in
  `eachItem` on the shop door, and used by the window-top rule.
* **`openings.windowTop`** -- on gambrel (loft) builds a window's top sits
  `belowWallTopIn` (5) under the wall top; on other roofs it is level with the
  door head, never closer than `minBelowWallTopFt` (0.15) to the wall top.

A company changing either moves every door or window on those buildings, and
the wall framing (which uses the same `openingRect`) moves with them.

## Where it came from in Barnwright

`boisterous-lokum-a737e0/public/3ddesign.html` (pinned SHA-256
`0bdcf663c5cb988623d2cb0dd271156fb690564072b301b0a15b917fd921ac6c`):

* the call, `buildShed` line **4043**:
  `state.items.forEach(function(it){ renderItem(it,ws,prof); });`
* `renderItem` preamble, lines **3122-3140** -> `common.js eachItem`: skip
  interior items (`c.int`, before `CURIT` is set), the rotated transom and the
  shop-door height overrides, `CURIT=it.id`, the five materials `trim`,
  `body` (+`age`), `dark`, `white`, `glass` (+`glassM`), and `CURIT=null` on
  every way out (`finally`);
* the dispatch (`if(c.gable)` 3141, `if(c.k==="light")` 3142, `if(c.k==="post")`
  3158, then the item-code branches) -> `index.js moduleFor(c)`, by the
  catalogue's `draw` trait;
* the item primitives `RUV wret wrev wslab wbevel wdisc wdrum wslant`, lines
  **3062-3121** -> `common.js itemTools(kit)`, bodies word for word;
* the opening height and bottom, lines **3172-3197** -> `model/layout.js
  openingRect` (rule 5; `tools/check-model-live.mjs` proves it against the
  trim Barnwright draws);
* the tap target, soft shadow, casings, head and porch band, lines
  **3198-3236** -> `common.js openingFrame`;
* the window sill, lines **3468-3481** -> `common.js windowSill`.

Porting edits (docs/ARCHITECTURE.md, Porting rules), and nothing else:
1. Rule 1: `T()` -> `plan.t`, `state` -> `plan.state`, `CAT` -> `plan.CAT`,
   `wallDefs()` -> `plan.ws`, `prof` -> `plan.prof`; `mat quadUV wallPt wq
   wtri3` are the kit's; `tintShade` from `engine/math.js`, `CASING` from
   `engine/constants.js`.
2. Rule 3: `it.cat==="tr"` -> draw `"transom"`; `it.cat==="w36"|"w48"|"w72"`
   -> draw `"shop-door"`; which branch draws an item -> its `draw` trait. The
   override copies of the catalogue entry now also carry `draw` and `leaves`
   (Barnwright's copies dropped every field they did not list), because those
   traits are what the item-code tests became.
3. Rule 4: the door heights and the window-top rule are construction reads
   with Barnwright's numbers as defaults.
4. Rule 5: the opening's `ch`/`yb` come from `openingRect(it, plan)`.
5. Rule 6: `CURIT` -> `kit.setItem`; `hitQuads.push` -> `kit.hit`.
6. Rule 7: `kit.part(<the item's part>)` and `kit.setStage(<its step>)` round
   each item (`common.js drawWith`).

Two guards Barnwright did not have, which change no recorded building: an item
whose code is not in the catalogue, or whose wall is not on this building,
draws nothing (Barnwright stopped with an error).

## The owner's facts

The opening rules, as Barnwright wrote them beside the arithmetic (now in
`model/layout.js openingRect`, summarised again in `common.js`):

> shop door openings: 71 1/2" tall on loft (short-wall) builds, 76 1/2" on tall walls

> cottage: full foot between door top and roof

> slope: doors stay under the belt band

> header trim never pokes above the eave

> doors on the end walls rise into the gable up to the roofline

> the header casing (0.30 above the leaf) must finish under the gable band

> shop rule: on loft builds a window top sits 5" under the wall top and never higher; on tall walls the window top matches the shop-door opening (76 1/2"), so both trims run level around the building

The catalogue note (Barnwright 707-710, now the manufacturer file's item
widths):

> Wooden-door widths are the real rough openings from the shop: a "36" door opens 37 1/4", a 48 opens 48 1/4", the double door opens 76". Heights are set per building at render time: 71 1/2" on loft (short-wall) builds, 76 1/2" on tall walls — h below is just the ceiling for that.

The trim, from `common.js` (word for word):

> casings the way the shop cuts them (see the lot photos): side casings run between sill and head; the head board is WIDEST AT ITS TOP, the ends cut at 22.5 degrees sloping back down to land flush on the side casings

> THE REVEAL IS A DOOR DETAIL, and only a door gets it. On a door the side casings stop just below the head board rather than running through it, so the three boards read as three cut boards with a joint between them instead of one poured white slab. That was asked for and it is what the lot photographs show. A window is not trimmed that way. Its casing runs right up into the head, and giving it the door's gap and the shadow that fills it made the trim round every window look broken - a white line across the top corners of something that should be one continuous frame.

> the shadow the head board drops into that gap. Sits in front of the side casings (0.12) and behind the head board's face (0.13), so it fills the reveal without poking through either. There is no gap on a window, so there is nothing for it to fill.

> the sill mirrors the head: widest at its BOTTOM, ends cut at 22.5 degrees flaring down and out from the side casings, face sitting a little prouder than the casings the way a real sill does

> T().metal, not state.metal. Whether a building is steel is a fact about its TYPE - Metal Utility, Metal Lofted Barn - and state has no such field, so this read undefined and every metal building was given wooden siding while the three settings beside it correctly said steel.

The primitives (`common.js`):

> A RAISED PANEL. The field stands proud of the slab on four slanted bevels, so the top one catches sun and the bottom one falls into shade. That is the whole reason a six-panel door reads as a six-panel door instead of six rectangles drawn on a flat sheet -- which is what it was.

> a round thing on a wall -- a knob, a rose. Stacked boxes made a doorknob look like a little staircase; twelve sides read as round at any size it is ever drawn.

> The corners have to come out anticlockwise seen from outside, or the face is turned inside out and back-face culling throws the whole quad away - it does not draw wrong, it does not draw at all. Two of the six calls here name their HIGH edge first: the door threshold and the roll-up's floor plate both slope down and outwards, which is the natural way to describe them. Both were invisible on every building because of it. Rather than make each caller remember, the pair is put in order here.

## Kept quirks

* **The `body` material is made for every item and never drawn with.** It is
  there because, on the SELECTED item, it makes the glowing twin
  `body!==g`, and that bucket's place in the draw order is recorded
  (`sel-*` golden cases). Do not drop it.
* **`CASING` is 0.27 ft (3.24 in) but the side casings are drawn 0.29 wide**
  (0.27 plus a 0.02 lap into the opening), and the head board is 0.29 tall;
  the comments call all of them "3 1/2 in". Unifying them moves pixels.
* **The tap target sits at 0.3 ft out**, round the opening plus one casing.
* **The soft shadow and the shutter shadow are skewed +0.07 / +0.05 ft to the
  right** -- a baked sun direction.
* **The porch header band goes on every wall of a porch building**, not just
  the porch wall.
* **The roll-up gets the casings and head but not the porch band.**
* `wdisc` computes a `first` it never uses; `wret`/`wrev` differ only in
  winding, and the winding is load-bearing (back faces are culled; the shadow
  pass draws back faces, so the returns are what cast the trim's shadow lines).
* The draw ORDER is the order the items were added: the first door or window
  to make a material (`galv`, `doorSh6`, `aoWall` ...) decides its paint.

## How to change it safely

1. Read this skill and the item's own skill first.
2. Run `node tools/check-golden.mjs` before and after -- the whole building,
   not just one part, because the walk decides the draw order of every item
   material. Every offset (0.015 ... 0.17) and every number here is
   look-defining.
3. A new kind of door or window: add a draw module (copy the nearest one:
   `id` = a new part label, `stage`, `draws`, `drawItem`, `build`,
   `appliesTo`), list it in `DRAW_MODULES`, add its label to `OPENING_TAGS`
   in `parts/index.js`, give its items that `draw` trait in the manufacturer
   file, and write its skill. Never test an item's code (`it.cat`).
4. A different door height or window-top rule for a company: change its
   construction (`openings.doorHeightIn`, `openings.windowTop`), not the code.
5. If the finished look must really change, re-record the golden fixtures on
   purpose (`node tools/capture-golden.mjs`, with a reason) and say so in
   `docs/DIFFERENCES.md`.

## Checks that guard it

* `node tools/check-golden.mjs` -- all 148 recorded buildings: every item
  triangle of every opening part, number for number (door-wood 17,074,
  door-steel 3,584, door-lite 5,114, roll-up 5,588, window 27,588,
  gable-window 715, light 196, porch-post 1,032 triangles, Sep 26 2026), and
  -- because nothing is pending -- the whole draw order (`ORDER`, including
  the `!==g` glow materials of the three selection cases) and every
  material's settings.
* `node tools/check-golden.mjs --part <label>` -- one opening part on its own.
* `node tools/check-model-live.mjs` -- `openingRect` against the trim
  Barnwright's live page draws, piece by piece.
* `node tools/check-parts.mjs` -- a valid part with a caption and this skill.
* `node tools/check-imports.mjs` -- loads in Node with no browser.
