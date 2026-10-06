---
name: part-window
description: The wall window (2x3 and 3x3 double-hung, the 36x12 transom flat or on end, the double window sharing one middle board) and its board-and-batten shutters -- read before changing sashes, glass, screen, sill, the double window or the shutters.
---

# Window and shutters (`parts/openings/window.js`)

## What it is in real life

A window in a wall, and the shutters that can go either side of it:

* **The 2x3 and 3x3 windows** -- double-hung: the lower sash sits proud of the
  upper, the lower one has an **insect screen** in it (flatter and greyer than
  the glass above), a meeting rail between them and a cross bar in each sash.
* **The 36x12 transom** -- lying flat: one pane with two upright bars (three
  lites); **stood on end**: one tall pane whose two bars turn with it. On the
  tall wall of a single slope the transoms sit in a row just under the belt
  band.
* **A double window** -- two windows butted together in ONE opening, sharing
  a single 3 1/2 in casing board down the middle (the casing, head and sill
  run across both).
* Every window: a white frame ring 0.12 ft wide with the glass set back
  behind a reveal; the shared trim round it -- side casings running right up
  into the head (no door-style gap), the 22.5-degree head board, the porch
  header band on a porch building -- and the sloped **sill** under it, widest
  at its bottom (see `part-openings`).
* **Shutters** (ticked per window): board and batten, 0.86 ft wide, one each
  side of the WHOLE opening (both sides of a double), 0.09 ft outside the
  casing: three boards with a daylight gap and three battens across them
  (bottom, middle, top -- the top and bottom flush with the ends), a dark back
  seen through the gaps, and a shadow on the wall. Colour: the shutter colour,
  else the trim colour -- and when the trim is the same colour as the siding,
  the trim colour darkened (x0.72) so they still show.

Where it sits: on loft (gambrel) builds a window's top is 5 in under the wall
top; on other roofs level with the shop-door head (76 1/2 in), never closer
than 0.15 ft to the wall top; never lower than 0.25 ft off the floor
(`model/layout.js openingRect`).

## Stage

Two stages (`parts/stages.js`):

* **`windows`** (id 15, finish) -- the window, its glass and its trim.
* **`extras`** (id 16, finish) -- the shutters.

Both shown in the Finished view, hidden in Framing (the wall framing shows the
opening with its sill and cripples), and lowered into place at their own steps
of Watch-it-build (`windows`, then `extras`). The shutters' triangles still
belong to THIS part (`window`), as they do in Barnwright's recording. Drawn by
PIPELINE entry 14, `openings` (`parts/openings/index.js`), for every item
whose catalogue `draw` trait is `window` or `transom`, in the order the items
were added (Barnwright's `buildShed` line 4043).

## Construction settings

* **`openings.windowTop`** -- where a window's top sits: on gambrel roofs
  `belowWallTopIn` (5) under the wall top; on other roofs `levelWithDoor`
  (true: the shop-door height) but never closer than `minBelowWallTopFt`
  (0.15) to the wall top. Read through `openingRect`; the wall framing reads
  the same rectangle.
* **`openings.doorHeightIn.other`** -- through the window-top rule (the door
  head the windows line up with).

## Where it came from in Barnwright

`boisterous-lokum-a737e0/public/3ddesign.html` (pinned SHA-256
`85c4b022d2f75db2145f4ff5cf1ea43c1b52074f8972b96180d64840eb4c5d36`):

* `renderItem`'s window branch (its final `else`), lines **3468-3571**: the
  sill 3469-3481 (`common.js windowSill`), the panes and glazing 3482-3531,
  the stale note 3532-3544, the shutters 3545-3571;
* the rotated-transom override, line **3125** (`common.js eachItem`);
* the window-top rule and the single-slope transom row, lines 3189-3197
  (`model/layout.js openingRect`);
* the shared frame, lines **3172-3236** (`common.js openingFrame`);
* `itemW`, lines 746-751 (`model/layout.js`): a double window is `2w + CASING`.

Porting edits (docs/ARCHITECTURE.md, Porting rules), and nothing else:
1. Rule 1: `state` -> `plan.state`; `mat wq` are the kit's; `wslab wret wrev`
   the item primitives; `hexRGB srgbLin tintShade` from `engine/math.js`.
2. Rule 3: `it.cat==="tr"` -> the `transom` draw trait
   (`plan.CAT[it.cat].draw==="transom"`); the window reaches this module by
   its `window` or `transom` draw trait, where Barnwright's final `else` took
   everything that was not a door.
3. Rule 4: the window-top rule is `openings.windowTop` (through
   `openingRect`).
4. Rule 7: `kit.setStage("extras")` before the shutters.

## The owner's facts

Barnwright's comments, kept word for word in the code:

> ONE SASH SET PER PANE. A double window is two windows in one opening sharing a single board down the middle -- the photograph Alan sent of a real pair -- so the casing, head and sill above already span both and only the glazing repeats.

> The board the pair share. It is the same 3 1/2 in casing that runs round the outside, standing on end between the two sashes - without it the two windows read as one long hole with a gap of siding showing through.

> THE DOUBLE WINDOW: two windows butted together in ONE opening, sharing a single trim board down the middle instead of each carrying its own casing with siding between them. CASING is the 3 1/2 in board that runs round every opening, and the shared middle board is one of them. *(model/layout.js itemW)*

> a transom stood on end stays one tall pane — its divider bars turn with it

> double-hung: recessed glass, lower sash sits proud

> THE LOWER SASH HAS A SCREEN IN IT. In Alan's photo the bottom half of the window is visibly flatter and greyer than the top -- that is the insect screen, and drawing both halves as clear glass is one of the things that made the window look drawn rather than photographed.

> BOARD AND BATTEN, built the way the shop builds it: three boards with a gap you can see daylight in, and two battens laid ACROSS them, standing proud. It used to be one flat sheet with two hairlines scratched down it and two bands so faint you could not find them.

> THREE battens, not two, and the top and bottom ones sit flush with the ends -- that is what the photograph shows, and it is the difference between a shutter and a bit of fence. The boards are set in a little from the batten ends, the same way.

> shop rule: on loft builds a window top sits 5" under the wall top and never higher; on tall walls the window top matches the shop-door opening (76 1/2"), so both trims run level around the building

And the shared trim (`common.js`, full text in `part-openings`):

> the sill mirrors the head: widest at its BOTTOM, ends cut at 22.5 degrees flaring down and out from the side casings, face sitting a little prouder than the casings the way a real sill does

> A window is not trimmed that way. Its casing runs right up into the head, and giving it the door's gap and the shadow that fills it made the trim round every window look broken - a white line across the top corners of something that should be one continuous frame.

## Kept quirks

* **A STALE NOTE, kept word for word**: "THE SHARED MIDDLE BOARD IS NOT DRAWN
  YET ... nothing in this file can set it.dbl". Both halves are false: the
  board IS drawn (the `wq` on `if(panes.length>1)`, a flat board at 0.125
  from `yb-0.01` to `yb+c.h+0.01`), and `it.dbl` IS set. "Adding it back" as
  the note says would draw it twice and change the look.
* **The glazing is chosen by HEIGHT** (`c.h > 2.0` is double-hung), not by
  which window it is -- and the stood-on-end transom is tested FIRST, because
  turning it swaps its height to 3 ft.
* **The panes and shutters use the catalogue height `c.h`, the casing uses
  `ch`** (the height after the wall-top cap).
* **Shutters sit off the WHOLE opening** (`HW2`), so on a double window they
  flank the pair.
* The shutters' wall shadow is skewed +0.05 ft to the right (a baked sun).
* The trim-equals-siding test compares the two HEX strings exactly.
* `glShade` is made inside the pane loop (first call wins; the same paint).

## How to change it safely

1. Read this skill, `part-openings`, and the comments in
   `parts/openings/window.js`.
2. Run `node tools/check-golden.mjs --part window` before and after, then the
   whole `node tools/check-golden.mjs` (the paint and draw order of `aoWall`,
   `glShade`, `screen`, `shut`, `shutD`, `shutBack`).
3. Every depth (glass 0.048/0.046, screen 0.056, frame 0.10, sill face 0.17,
   middle board 0.125, shutter boards 0.050-0.082, battens 0.082-0.116) is
   look-defining.
4. A new window size is a catalogue item with `draw: "window"` (or
   `"transom"`, `rotatable`) and its own `w`/`h`. Remember a window over 2 ft
   tall is drawn double-hung. Where windows sit is `openings.windowTop`.
5. If the look must really change, re-record the golden fixtures on purpose
   (`node tools/capture-golden.mjs`, with a reason).

## Checks that guard it

* `node tools/check-golden.mjs --part window` -- every window and shutter
  triangle of the 148 recorded Barnwright buildings, number for number (97
  buildings, 27,588 triangles, Sep 26 2026): 2x3, 3x3, transoms flat and on
  end, the single-slope transom row, double windows (with and without
  shutters, in a colour), shutters matching the trim, on and off, windows on
  gambrel and lean-to end walls, windows dragged into doors and along a porch
  wall, and the selected window (`sel-window-su-10x20`, the blue glow).
* `node tools/check-golden.mjs` -- also its materials' paint and draw order.
* `node tools/check-model-live.mjs` -- `openingRect` (casings, head, sill,
  porch band) against the trim Barnwright's live page draws.
* `node tools/check-parts.mjs`, `node tools/check-imports.mjs`.
