---
name: part-door-wood
description: The wooden shop door (36 in, 48 in, and the 72 in double doors) the shop builds from the building's own siding -- read before changing its panels, hinges, handle, door window, the kennel transom, its casings or its height.
---

# Wooden shop door (`parts/openings/door-wood.js`)

## What it is in real life

The door the shop builds itself, out of the same siding as the walls: a
single door (the "36" opens 37 1/4 in, the "48" opens 48 1/4 in) or a pair of
double doors (the "72", opening 76 in). The opening is 71 1/2 in tall on loft
(gambrel) builds and 76 1/2 in on tall walls. On the picture:

* **The leaf** -- siding-textured, in the door colour (else the siding
  colour), its grooves lined up with the wall's; the header throws a shadow
  across its top.
* **Its frame** -- trim-colour stiles and a top rail 0.29 ft (3 1/2 in) wide, a
  bottom rail, and a mid rail centred at 0.52 of the height.
* **On a painted building**: solid trim-colour clipped corners -- the lower
  panel a full octagon (four corners), the upper panel its top corners only --
  and three black spade T-hinges on the hinge edge. In the upper panel instead
  of the corners: the **door window** if the customer ticked it (a white frame
  with three lites), or, on the **Dog Kennel's** single back door, its transom
  window.
* **On a metal building**: short corner braces in each panel, dark hinge pads
  and a dark vertical handle.
* **A pair**: a trim astragal down the middle (plus an iron seam when painted).
* **The handle** on a painted door: black, 0.44 ft in from the latch edge
  (0.16 ft left of centre on a pair).
* A single door hinges on the LEFT (handle on the right); on a pair each leaf
  hinges on its outer edge.
* Round it, the shared trim: side casings stopping just under the head, the
  22.5-degree head board, and on a porch building the header band (see
  `part-openings`).

## Stage

`doors` (id 14, finish) -- the door, its hardware and its trim. Shown in the
Finished view, hidden in the Framing view (the wall framing shows the
opening's king and jack studs and header instead), and lowered into place at
the `doors` step of Watch-it-build (after `porch`, before `windows`). Drawn by
PIPELINE entry 14, `openings` (`parts/openings/index.js`), for every item
whose catalogue `draw` trait is `shop-door`, in the order the items were
added (Barnwright's `buildShed` line 4043).

## Construction settings

* **`openings.doorHeightIn`** `{gambrel: 71.5, other: 76.5}` -- the opening
  height in inches for this roof shape. Drawn to four decimals of a foot
  (5.9583 / 6.375 -- Barnwright's numbers exactly). A company building a
  taller door changes this; the door, its trim and the wall framing's header
  all move together. The opening is then capped as every door is: a full foot
  under the roof on a cottage, 0.42 ft under the eave (or belt band) on a
  side wall, and on an end wall up into the gable but 0.14 under the roof line
  and 0.34 under the gable band (`model/layout.js openingRect`).

Nothing else: the rails, corners, hinges and handle are the DOOR's design, not
the shop's framing.

## Where it came from in Barnwright

`boisterous-lokum-a737e0/public/3ddesign.html` (pinned SHA-256
`0bdcf663c5cb988623d2cb0dd271156fb690564072b301b0a15b917fd921ac6c`):

* `renderItem`'s shop-door branch, lines **3292-3375**
  (`else if(it.cat==="w48"||it.cat==="w72"||it.cat==="w36")`);
* the door height override, lines **3126-3129** (`common.js eachItem`);
* the shared frame before it, lines **3172-3236** (`common.js openingFrame`).

Porting edits (docs/ARCHITECTURE.md, Porting rules), and nothing else:
1. Rule 1: `T()` -> `plan.t`, `state` -> `plan.state`; `mat wq wtri3 wbrace`
   are the kit's; `wslab wrev` the item primitives (`common.js`); `tintShade`
   from `engine/math.js`.
2. Rule 2: `state.type==="DK"` (the kennel back door's transom) -> the style's
   kennel trait, `plan.t.kennel`.
3. Rule 3: `it.cat==="w48"||"w72"||"w36"` -> the `shop-door` draw trait (how
   the item reaches this module); `it.cat==="w72"` (a pair) ->
   `plan.CAT[it.cat].leaves===2`.
4. Rule 4: the heights 5.9583 / 6.375 -> `openings.doorHeightIn`.
5. Rule 7: the stage is set by the caller (`common.js drawWith`).

## The owner's facts

From Barnwright's comments, kept word for word in the code:

> shop door openings: 71 1/2" tall on loft (short-wall) builds, 76 1/2" on tall walls

> Wooden-door widths are the real rough openings from the shop: a "36" door opens 37 1/4", a 48 opens 48 1/4", the double door opens 76". Heights are set per building at render time: 71 1/2" on loft (short-wall) builds, 76 1/2" on tall walls — h below is just the ceiling for that.

> real shed door: solid white clipped corners. lower panel = full octagon, upper panel = top corners only

> kennel back door: transom window up top

> shop-door window: 2-lite strip in the upper panel

> black spade T-hinges: knuckle at the edge, short strap tapering to a point

> header shadow on the leaf

> seam between leaves

And the trim round it (shared, `common.js`; full text in `part-openings`):

> casings the way the shop cuts them (see the lot photos): side casings run between sill and head; the head board is WIDEST AT ITS TOP, the ends cut at 22.5 degrees sloping back down to land flush on the side casings

> THE REVEAL IS A DOOR DETAIL, and only a door gets it. On a door the side casings stop just below the head board rather than running through it, so the three boards read as three cut boards with a joint between them instead of one poured white slab. That was asked for and it is what the lot photographs show.

> cottage: full foot between door top and roof / slope: doors stay under the belt band / header trim never pokes above the eave / doors on the end walls rise into the gable up to the roofline / the header casing (0.30 above the leaf) must finish under the gable band

## Kept quirks

* **The door window is called a "2-lite strip" and draws THREE lites** (two
  muntins at +-1/6 of the width). The picture is the three-lite one; do not
  "fix" the count.
* **Painted or metal follows the BUILDING** (`plan.t.metal`), not the door.
* **The kennel transom beats the door window**: on a Dog Kennel's single door
  the transom is drawn even when the door window is ticked. And it goes on
  EVERY single shop door on a kennel, not only the back door -- the test is
  the style (`plan.t.kennel`), not the wall (a 36 in door added to a kennel's
  side wall gets it too, `kennel-dk-8x16-door-light`).
* The leaf's UVs use the wall's own `u` ("sid" mode), so its grooves line up
  with the siding round it. Rewriting the leaf in door-local coordinates
  silently shifts them.
* The stiles and rails are 0.29 wide while `CASING` is 0.27; both are called
  "3 1/2 in".
* `iron` is made again for the handle (first call wins; the same paint).

## How to change it safely

1. Read this skill, `part-openings`, and the comments in
   `parts/openings/door-wood.js`.
2. Run `node tools/check-golden.mjs --part door-wood` before and after, then
   the whole `node tools/check-golden.mjs` (the door's materials -- `doorF`,
   `doorSh`, `iron` -- take their place in the draw order from it).
3. Every number is look-defining. The door height is the one that belongs to
   a company: change `openings.doorHeightIn`, not the code.
4. To offer a new wooden door size, add an item with `draw: "shop-door"` (and
   `leaves: 2` for a pair) to the manufacturer file -- no code.
5. If the look must really change, re-record the golden fixtures on purpose
   (`node tools/capture-golden.mjs`, with a reason).

## Checks that guard it

* `node tools/check-golden.mjs --part door-wood` -- every shop-door triangle
  of the 148 recorded Barnwright buildings, number for number (94 buildings,
  17,074 triangles, Sep 26 2026): painted and metal buildings, single and
  double doors, door windows (`lite-*`), the kennel back door, doors on the
  end walls of gambrel and gable buildings (where the rule lets them rise
  toward the gable) and on a cottage's end wall (where it never does: the cap
  there is a full foot under the wall top, which a 76 1/2 in door does not
  reach -- `doors-cs-10x20-w36-back`), and the selected door
  (`sel-door-ut-10x20`, the blue glow).
* `node tools/check-golden.mjs` -- also the draw order and paint of its
  materials.
* `node tools/check-model-live.mjs` -- the opening rectangle (`openingRect`)
  against the trim Barnwright's live page draws.
* `node tools/check-parts.mjs`, `node tools/check-imports.mjs`.
