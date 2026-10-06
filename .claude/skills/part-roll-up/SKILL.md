---
name: part-roll-up
description: The steel roll-up door (6 ft and 8 ft) -- the slatted curtain, its track, bottom rail, latch and the diamond-plate threshold -- read before changing how a roll-up door or its opening is drawn.
---

# Roll-up door (`parts/openings/roll-up.js`)

## What it is in real life

The garage door of a portable building: a curtain of narrow steel slats that
rolls up into a drum over the opening. Garages carry one as standard; any
building can have one added (6 ft or 8 ft). On the picture:

* **The track box** -- dark, behind everything.
* **The curtain** -- set a full inch back behind the casing (at 0.032 ft, the
  casing face at 0.12), inset 0.075 ft each side, made of slats 0.1875 ft
  (2 1/4 in) tall -- at least fourteen -- each a GROOVE leaning up and out, a
  CROWN that catches the sun, and a groove back in under the next.
* **The reveal** -- the sides and head of the opening seen edge-on.
* **The bottom rail** standing proud of the curtain.
* **The diamond-plate threshold** the shop screws across every roll-up
  opening, near enough level, and its front edge.
* **The guides** the curtain runs in, the dark **gap at the top** it
  disappears into (shade, not a painted bar), and the **wood jamb boards**
  outside the guides.
* **The black latch plate** -- an oval with the corners knocked off and a slot
  across it, 0.62 ft in from the right edge at 0.42 of the height; the only
  dark thing on the door.
* Round it, the shared trim: side casings and the 22.5-degree head board (see
  `part-openings`) -- but NOT the porch header band, even on a porch building.

The 6 ft and 8 ft doors draw the same way; they differ only in the catalogue
width and height.

## Stage

`doors` (id 14, finish): shown in the Finished view, hidden in Framing, lowered
into place at the `doors` step of Watch-it-build. Drawn by PIPELINE entry 14,
`openings` (`parts/openings/index.js`), for every item whose catalogue `draw`
trait is `roll-up`, in the order the items were added (Barnwright's
`buildShed` line 4043).

## Construction settings

None. The opening height is the catalogue item's own `h`, capped as every door
is (`model/layout.js openingRect`: under the eave on a side wall, rising into
the gable but under the roof line and gable band on an end wall).

## Where it came from in Barnwright

`boisterous-lokum-a737e0/public/3ddesign.html` (pinned SHA-256
`85c4b022d2f75db2145f4ff5cf1ea43c1b52074f8972b96180d64840eb4c5d36`):

* `renderItem`'s roll-up branch, lines **3237-3291** (`if(c.k==="ru")`);
* the shared frame before it, lines **3172-3236** (`common.js openingFrame`;
  the porch band test `c.k!=="ru"` is there).

Porting edits (docs/ARCHITECTURE.md, Porting rules), and nothing else:
1. Rule 1: `mat wq wtri3` are the kit's; `wslant wrev wslab wret` the item
   primitives (`common.js`).
2. Rule 3: the branch was chosen by the item's kind (`c.k==="ru"`); the item
   now reaches this module by its `roll-up` draw trait. (The porch-band test
   still reads the kind, `c.k!=="ru"`, as Barnwright's did.)
3. Rule 7: the stage is set by the caller.

## The owner's facts

Barnwright's comments, kept word for word in the code:

> A ROLL-UP DOOR IS A COIL OF NARROW SLATS. Alan photographed a real one: better than thirty slats across six feet, each about 2 1/4 inches. This was drawing thirteen wide flat bands, which is a sectional garage door, not a roll-up. And a flat band shaded flat -- so each slat is now two leaning faces, a crown that catches the sun and a groove under it that does not, the way rolled steel actually reads.

> THE DOOR IS IN A HOLE IN A WALL. It was drawn as a sheet laid ON the siding, and with nothing to see the depth of it read as a sticker. The curtain now sits a full inch back behind the casing, and the sides and head of the opening are real returns you can see down -- that reveal, and the shade in it, is most of what makes a door look like a door.

> bottom rail, standing proud of the curtain the way the real one does

> the diamond-plate threshold the shop screws across every roll-up opening

> the gap the curtain disappears into -- shadow, not a painted black bar

> the black latch plate: an oval with the corners knocked off, a slot across it, and a keeper below -- it is the only dark thing on the door and it is what your eye lands on in the photograph

And the shared trim (`common.js`, full text in `part-openings`):

> casings the way the shop cuts them (see the lot photos): side casings run between sill and head; the head board is WIDEST AT ITS TOP, the ends cut at 22.5 degrees sloping back down to land flush on the side casings

## Kept quirks

* **The latch comment promises "a keeper below"; none is drawn.** The picture
  is the one without it -- do not add it without re-recording.
* **The slats are counted over `ch - 0.40`** from `yb + 0.22`, at least 14,
  and spaced to fill that height exactly, so each slat comes out a little
  over 0.1875 ft.
* **The threshold and its edge are described high edge first**; `wslant`
  puts the pair in order (they were invisible before that fix -- see
  `part-openings`).
* **No porch header band** over a roll-up, on any building.
* The roll-up gets the DOOR's casing reveal (side casings stopping 0.04 under
  the head, with the shadow in the gap), as every non-window does.

## How to change it safely

1. Read this skill, `part-openings`, and the comments in
   `parts/openings/roll-up.js`.
2. Run `node tools/check-golden.mjs --part roll-up` before and after, then the
   whole `node tools/check-golden.mjs` (the paint and draw order of `ruChan`,
   `ruCurt`, `ruRib`, `ruRibL`, `ruRail`, `diamond`, `diaE`, `ruDrum`, `iron`,
   `latchSlot`).
3. Every depth (0.026 track, 0.032 curtain, +0.036 crown, 0.12 casing face,
   0.34 threshold) decides what shows through what. Do not round them.
4. A new roll-up size is a catalogue item with `draw: "roll-up"`, kind `ru`
   and its own `w`/`h` -- no code.
5. If the look must really change, re-record the golden fixtures on purpose
   (`node tools/capture-golden.mjs`, with a reason).

## Checks that guard it

* `node tools/check-golden.mjs --part roll-up` -- every roll-up triangle of
  the 148 recorded Barnwright buildings, number for number (14 buildings,
  5,588 triangles, Sep 26 2026): the garages' standard 8 ft door, 6 ft and 8 ft
  doors on side walls, on the front and back gable ends, on a gambrel garage
  and on a metal garage.
* `node tools/check-golden.mjs` -- also its materials' paint and draw order.
* `node tools/check-model-live.mjs` -- its opening rectangle against the trim
  Barnwright's live page draws.
* `node tools/check-parts.mjs`, `node tools/check-imports.mjs`.
