---
name: part-door-lite
description: The 11-lite entry door and the 11-lite French doors -- a white door with glass under an arched fan window -- read before changing its glass, fan, muntins, panels, knob or trim.
---

# 11-lite door and French doors (`parts/openings/door-lite.js`)

## What it is in real life

A white entry door with glass in its top half: the 36 in 11-lite door, or a
pair of them as French doors (5.6 ft across). On the picture, per leaf:

* **The slab**, white, set at 0.05 ft, with the shadow the head throws across
  its top.
* **The glass**: a rectangle from 0.42 of the height up to the spring line,
  topped by a half-round FAN (ten glass triangles), in a white frame 0.10 ft
  wide.
* **The muntins**: two uprights, a horizontal, a bar at the spring line and
  three spokes in the fan at 45, 90 and 135 degrees -- six lites below the
  spring line and four in the fan.
* **Two raised panels** below the glass.
* **A silver knob** 0.30 ft in from the latch edge (on the French doors, at
  the meeting edges).
* On the French doors the two leaves are each `w/2 - 0.06` wide, a hair apart.
* Round it, the shared trim: side casings stopping just under the head, the
  22.5-degree head board, and on a porch building the header band (see
  `part-openings`).

## Stage

`doors` (id 14, finish): shown in the Finished view, hidden in Framing, lowered
into place at the `doors` step of Watch-it-build. Drawn by PIPELINE entry 14,
`openings` (`parts/openings/index.js`), for every item whose catalogue `draw`
trait is `lite-door`, in the order the items were added (Barnwright's
`buildShed` line 4043).

## Construction settings

None. The opening height is the catalogue item's own `h` (6.3 ft), capped as
every door is (`model/layout.js openingRect`). The door height settings
(`openings.doorHeightIn`) are for the wooden shop door only, as in Barnwright.

## Where it came from in Barnwright

`boisterous-lokum-a737e0/public/3ddesign.html` (pinned SHA-256
`0bdcf663c5cb988623d2cb0dd271156fb690564072b301b0a15b917fd921ac6c`):

* `renderItem`'s `d36lite` / `dfr` branch, lines **3423-3467** (with `guv`,
  line 3444);
* the shared frame before it, lines **3172-3236** (`common.js openingFrame`).

Porting edits (docs/ARCHITECTURE.md, Porting rules), and nothing else:
1. Rule 1: `mat wq wtri3 wbrace wallPt box` are the kit's.
2. Rule 3: `it.cat==="d36lite"||it.cat==="dfr"` -> the `lite-door` draw trait
   (how the item reaches this module); `it.cat==="dfr"` (twice: the pair of
   leaves, and which way each knob faces) -> `plan.CAT[it.cat].leaves===2`.
3. Rule 7: the stage is set by the caller.

## The owner's facts

Barnwright's comments, kept word for word in the code:

> arch-top fan lite

> muntins: 2 verticals + a horizontal + spring bar + 3 fan spokes

> two raised panels below the glass

> silver knob

And the shared trim (`common.js`, full text in `part-openings`):

> casings the way the shop cuts them (see the lot photos): side casings run between sill and head; the head board is WIDEST AT ITS TOP, the ends cut at 22.5 degrees sloping back down to land flush on the side casings

> THE REVEAL IS A DOOR DETAIL, and only a door gets it. On a door the side casings stop just below the head board rather than running through it, so the three boards read as three cut boards with a joint between them instead of one poured white slab.

## Kept quirks

* **`galv` and `doorSh6` are shared with the six-panel steel door, with
  different paint** (11-lite: `#cfd4d8` 0.5/44 and `#d3d3cf`; steel:
  `#cbd0d4` 0.60/54 and `#cfcfca`). First call wins: whichever door is drawn
  first on a building paints both. No recorded building carries both at once,
  so the golden test does not see the clash; it is kept by keeping every
  `mat()` call, in Barnwright's order.
* **The knob and its rose are upright boxes in WORLD axes** (`kit.box`), so on
  the corner porch's diagonal wall they do not turn with the wall.
* **`guv` is a function declared inside the fan loop** (block-scoped in a
  module, used only in the same pass). Do not hoist it out without passing
  `lu R2 gw gy0 gh`.
* The fan spokes' `[0.25,0.5,0.75].forEach(function(f){...})` names its
  argument `f`, as Barnwright wrote it; nothing in that callback needs
  anything else by that name.

## How to change it safely

1. Read this skill, `part-openings`, and the comments in
   `parts/openings/door-lite.js`.
2. Run `node tools/check-golden.mjs --part door-lite` before and after, then
   the whole `node tools/check-golden.mjs` (the paint and draw order of
   `galv`, `panIn`, `doorSh6`, `panHi`).
3. Every number is look-defining (the glass is 0.76 ft narrower than the
   leaf, the spring line 0.55 ft under the head plus the fan's radius ...).
4. A new size, single or pair, is a catalogue item with `draw: "lite-door"`
   and `leaves` 1 or 2 -- no code.
5. If the look must really change, re-record the golden fixtures on purpose
   (`node tools/capture-golden.mjs`, with a reason).

## Checks that guard it

* `node tools/check-golden.mjs --part door-lite` -- every 11-lite and French
  door triangle of the 148 recorded Barnwright buildings, number for number
  (44 buildings, 5,114 triangles, Sep 26 2026): the cabins' standard doors,
  and French doors on a gable end wall, on a metal building's side wall and on
  a gambrel end wall.
* `node tools/check-golden.mjs` -- also its materials' paint and draw order.
* `node tools/check-model-live.mjs` -- its opening rectangle against the trim
  Barnwright's live page draws.
* `node tools/check-parts.mjs`, `node tools/check-imports.mjs`.
