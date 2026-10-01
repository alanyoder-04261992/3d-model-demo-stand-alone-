---
name: part-siding
description: The wall siding of a portable building (the sheets on every wall, the skirt over the floor rim, the porch cut-outs, the kennel's inside back face) -- read before changing which walls get siding, how far it hangs, or where a porch cuts it.
---

# Siding (`parts/siding.js`)

## What it is in real life

The walls of a portable building are studs on a bottom plate with two top
plates, sided in 4x8 sheets: LP rough-sawn panel (a groove every 8 in) on a
painted building, ribbed metal over OSB on a metal one. The siding hangs past
the bottom of the wall to nail into the 2x6 rim joist, so you never see a bare
floor edge under it -- except where a wall stands back on a porch deck, where
it stops at the deck.

On a porch building the siding follows the porch: a side-cabin porch is a
notch cut into one end (or the middle) of the long right-hand wall, and a
deluxe corner porch cuts a diagonal corner off the front. On the Dog Kennel
the back half is an ordinary sided room and you can see its inside face (a
shade darker, 0.72 of the siding colour) through the open run.

The finished picture draws each wall as ONE flat siding face -- no studs, no
thickness; the texture carries the grooves. The real studs are the NEW
`wall-frame` part.

## Stage

Stage `siding` (kind `finish`) for every triangle this part draws. In the
Framing view it is hidden; in Watch-it-build it lands after the wall framing
and, once it has landed, hides the wall framing it covers
(`parts/stages.js` COVERS).

PIPELINE entry 3 (`parts/index.js`), after the skids and the floor and before
the corner trim: Barnwright's walls loop runs right after its floor loop.

The kennel's front and side walls are drawn FROM INSIDE this loop (at
Barnwright's position, so every material gets its triangles in Barnwright's
order) but belong to the kennel: the loop wraps `kennel.front` /
`kennel.side` in `kit.part("kennel", ...)`, and those carry their own stages
(`siding`, `trim`, `extras`). See the `part-kennel` skill. `kit.part` puts
the step back to `siding` when they return.

## Construction settings

None. The walls come from `plan.ws` (model/frame.js `wallDefs`, which reads
the lean-to and single-slope rise from `roof.shapes.lean.rise` /
`roof.shapes.slope.rise` for the wall tops), the porch notch from
`plan.span`, and the skirt from `SKIRT` in `engine/constants.js`. The drawing
itself reads no `plan.construction` value.

## Where it came from in Barnwright

`boisterous-lokum-a737e0/public/3ddesign.html` (pinned SHA-256
`0bdcf663c5cb988623d2cb0dd271156fb690564072b301b0a15b917fd921ac6c`),
`buildShed`'s walls loop, lines 3878-3905:

* the wall list: `F B R L`, plus `P1 P2 P3` on a corner porch (`porch "C"`),
  `S1 S2` (and `S3` when the notch is in the middle) on a side porch
  (`porch "S"`) -- `sidingWalls(plan)`, exported;
* at the kennel's F wall `kennelFront(...)`, at its R/L walls
  `kennelSide(...)` (now `kennel.front` / `kennel.side`);
* the skirt rule `yb0` (y0 - SKIRT on F B R L, else y0);
* the side-porch and corner-porch cut-outs;
* one `wq(mB, w, -half, yb0, half, w.top, 0, "sid")` per wall;
* on the kennel's B wall, the inside face `bodyIn` (texSiding,
  `tintShade(state.body, 0.72)`, 0.04, 10) at o = -0.05, UVs divided by STEP.

Porting edits, all from the contract's Porting rules:
* `state.type === "DK"` -> the style's `kennel` trait (rule 2);
* `T()` -> `plan.t`, `pSpan()` -> `plan.span`, `wallDefs()` -> `plan.ws`,
  `state` -> `plan.state`, `STEP` -> `kit.STEP`, `y0`/`SKIRT` from
  `engine/constants.js`, `mB` is `core.mB` (rule 1);
* `kennelFront` / `kennelSide` -> `kennel.front` / `kennel.side`, wrapped in
  `kit.part("kennel", ...)` (rule 7);
* `kit.setStage("siding")` (rule 7).

## The owner's facts

### Alan's learned siding rules — October 1, 2026

Alan's word “sliding” in this lesson means **siding**, the outside wall
covering. Its actual thickness is **1/2 in**. On the **lofted barn** it
extends **3.5 in below the bottom of the bottom plate**. On the **utility**
its top is flush with the **upper-plate top** and its bottom extends below
the wall. The utility bottom overhang differs from the lofted barn's 3.5 in;
the exact utility amount remains unconfirmed. Do not copy the lofted value
or derive a confirmed overhang from the legacy 4x8 sheet description.

The utility also has a **2x4 nailed outside the siding**, parallel to the
upper plate. Its **3.5 in broad face is against the siding** and its **top
edge is level with the upper-plate top**. Using the already agreed actual
2x4 section, it projects 1.5 in out from the siding and extends 3.5 in down
from that datum. Those two extents are derived from the section and
orientation. Keep the descriptive name “outside 2x4” until Alan supplies
a shop name; its length, end/corner fit and nail details remain unconfirmed.
It is separate from the learned 3.5 × 5/8 in trim stock and must not be
silently mapped to the existing single-slope belt band or gable trim band.

These are internal construction-learning facts, retained in
`construction.claddingStudy` in the learning company's file. No existing
renderer reads that record. It does not change the ordinary designer's
zero-thickness siding or legacy skirt. Apply the rules within the
confirmed builder/style scope when an actual geometry change is requested.
The older Barnwright note below is historical context, not a resolution
of the remaining utility measurement.

The shop's note on the real construction (Barnwright 2147-2156), kept word for
word in `parts/siding.js`:

> Walls: studs on a bottom plate with two top plates; loft ("short wall")
> studs are 75" for about a 6.63 ft wall, tall-wall (UTX) studs are 89" for
> about 7.79 ft. A 2x4 really measures 1 1/2" x 3 1/2". Siding comes in 4x8
> sheets: on utility buildings it runs flush with the top of the wall and
> hangs past the bottom to nail into the 2x6 rim; on loft buildings it hangs
> 3 1/2" past the wall bottom and gets trimmed at the top. SKIRT below is
> that hang-down -- it is why you never see a bare floor edge under the
> siding.

And in the loop itself: "siding hangs past the wall bottom to cover the floor
rim -- except on walls that sit back on a porch deck, where it stops at the
deck".

The siding texture is LP rough-sawn panel with one groove every 8 in
(`GROOVE = 0.667`), on 4 ft sheets for the per-sheet weathering
(`body` material `age` 4; 3 ft metal panels, `age` 3 -- set by assemble).

## Kept quirks

* The skirt (y0 - 0.29) is on the four main walls only, and not on: the
  kennel (its siding starts at the floor line), the front wall of a front
  porch (`porch "F"`) or a corner porch (`porch "C"`), the right wall of a
  `porch "R"` building (no style uses `"R"`; Barnwright's branch is kept so
  the code stays Barnwright's), and every porch wall (S*, P*).
* The corner porch's F stub is written with `y0` where the other branches
  use `yb0`; on a corner porch the F wall's `yb0` IS `y0` (no skirt), so the
  two agree -- keep Barnwright's spelling. Its R wall starts 12 ft back from
  the front (`-half+12`): the porch deck is in `L`, which is 4 ft longer than
  the size says (Barnwright's `dims()`).
* The side porch trims 4 ft off the F wall only when the notch is at the
  front end (not flipped, not in the middle), and 4 ft off the B wall only
  when it is flipped.
* Wall UVs ("sid") divide by GROOVE even on a metal building, while the
  kennel's inside face divides by STEP (RIB on metal). Both are look-defining.
* The inside face is on the B wall only because the kennel's F, R and L walls
  are handed off before it; it is labelled `siding` because Barnwright's
  siding lines draw it (test/golden/README.md).

## How to change it safely

* Read the `part-kennel` skill too: the kennel's walls are called from here.
* Run `node tools/check-golden.mjs --part siding,kennel` before and after; it
  must stay green on all 148 buildings. Also `node tools/check-parts.mjs` and
  `node tools/check-imports.mjs`.
* Never reorder the wall list or the cut-out branches: the order of the
  `wq` calls is the order of the `body` material's triangles, which is part
  of the golden picture. Never create a material here before `bodyIn` is
  created (first call wins, and creation order is draw order).
* A different skirt belongs in `engine/constants.js` (it moves every wall, the
  corner posts and the corner shadows) and means re-recording the golden
  fixtures on purpose (`node tools/capture-golden.mjs`, with a reason).
* The wall-frame part fits studs inside this siding plane; after changing the
  walls, run `node tools/check-framing.mjs` too.

## Checks that guard it

* `node tools/check-golden.mjs --part siding` -- every siding triangle of all
  148 recorded Barnwright buildings, number for number (1,278 triangles),
  including the side-porch and corner-porch cut-outs and the kennel's inside
  back face; drawn on its own it is exactly those triangles.
* `node tools/check-golden.mjs --part kennel` -- proves the kennel walls this
  loop calls (5 kennel buildings, 5,948 triangles with kennelExtras).
* `node tools/check-parts.mjs` -- the part is valid and this skill is well formed.
* `node tools/check-imports.mjs` -- the file loads in Node with no browser.
