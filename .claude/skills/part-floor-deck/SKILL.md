---
name: part-floor-deck
description: The flooring sheets over the floor joists, including Alan's confirmed 4x8 tongue-and-groove, 5/8-inch staggered layout -- read before changing sheet size, thickness, coverage, layers or how the flooring is laid.
---

# Flooring (`parts/floor-deck.js`)

## Scope of the current floor lesson

On September 27, 2026 Alan requested the **flooring** and confirmed the
preferred term, **4 ft by 8 ft tongue-and-groove sheets, 5/8 in thick**,
staggered end seams, and trimming the last row. He explicitly confirmed the
second row as **4 ft + 8 ft + 4 ft**. Reuse this part skill; do not create a
duplicate flooring skill. `floor-deck` and “floor decking” remain code or
reference labels; use **Flooring** with Alan.

For the lesson's 10 x 16 ft coverage, the sheet's 8 ft direction follows the
building length. Read rows across its width:

| Row | Width across the floor | Pieces along the length | Basis |
| --- | --- | --- | --- |
| 1 | 4 ft | 8 ft + 8 ft | Agreed layout using full-length sheets. |
| 2 | 4 ft | 4 ft + 8 ft + 4 ft | Alan's explicitly confirmed stagger. |
| 3 | 2 ft | 8 ft + 8 ft, trimmed to 2 ft wide | Width derived as `10 - 4 - 4`; trimming the last row is confirmed. |

This produces **seven laid pieces**, not a confirmed stock-sheet purchase
count or cutting/reuse plan. The end joints alternate between the 8 ft mark
and the 4/12 ft marks, so adjacent rows' end seams do not line up.

The current manual page is
`learn.html?company=learning-side-loft&step=deck`: skids, complete floor
frame and flooring, with no autoplay, walls or roof. Earlier frame and
joist views remain available. The sheet coverage comes from the actual
outer frame bounds, a **derived 10 x 16 ft footprint** in this lesson.
Do not move the frame, skids, notches or end boards to lay the flooring.
Its bottom is at the corrected frame top, **10 in** above skid bottom;
one modeled 5/8 in layer gives a **calculated 10 5/8 in top**. Preserve the
ordinary designer's legacy geometry and height datums.

The confirmed 4x8 is the stated sheet size. Manufacturer-specific net
coverage, tongue and groove profile dimensions, expansion allowance and
fastening details have not been supplied. Do not invent a tongue/groove
shape or physical seam gap. Do not infer OSB, plywood, wood species, grade
or sheet treatment: treated wood was confirmed for the floor timbers,
not these sheets. Any surface appearance is illustrative.

The opt-in is [floorStudyPlan](../../../model/floor-study.js), reading
`construction.floorStudy`. Its `deck` record uses
`{ sheetWidthFt: 4, sheetLengthFt: 8, thicknessIn: 0.625, layers: 1, tongueAndGroove: true, staggerFt: 4, orientation: "lengthwise", coverage: "frame" }`.
`deckSheetSize`, `deckThickness`, `deckTongueAndGroove`, `deckStagger`,
`deckStaggerOffset`, `deckOrientation` and `deckTrimLastRow` are confirmed;
`deckFootprint` is derived from the frame. The one modeled layer
(`deckLayers`), exact edge profile (`deckEdgeProfile`) and aggregate `deck`
status remain provisional because not every product detail is settled.
Keep stock sizes separate from
the dimensions of the trimmed pieces. In the current model, the four
sheet-end seams bear over existing joist faces, 0.36 in off their centers
because the first-position datum is unchanged. Do not move the frame to
make that datum look confirmed or treat this contact as structural approval.
Remaining skid count, first-notch
position, cut clearance, long-board dimensions and lateral placement of
the mule-hook board remain independent questions.

The [flooring picture page](../../../flooring.html) uses labeled model
renders: [overview](../../../images/flooring.png) and
[layout](../../../images/flooring-layout.png). Refresh them after relevant
geometry changes and describe them as model renders. Alan's private
reference photographs must not be published. Netlify hosting is currently
blocked; do not claim the hosted page is live before deployment succeeds.
Refresh the model-render artifacts with
`node tools/export-joist-render-data.mjs --deck`, then
`python tools/render-joist-picture.py --deck` (Pillow and NumPy required).
See [the example](../../../docs/examples/10x16-side-loft.md).

## What it is in real life

**Normal-model background.** The older behavior below is not fresh
confirmation of fastening, a starting end or the joist datum for this lesson.

The floor is decked with 4x8 tongue-and-groove sheets nailed over the
joists, laid with their long edge ACROSS the joists (the joists run across
the width, so the sheets run along the length), started at the back end,
with every other row started on a half sheet so the end joints are
staggered. The joists are laid out from the same back end, so every end
joint lands on a joist (8 ft is six 16 in bays, or eight 12 in ones). The
walls stand on the decking. A DOUBLE FLOOR is a second full layer of the
same sheets over the first, its joints moved half a sheet both ways. The
open porch decks get treated deck boards instead (part `porch-deck-frame`);
the Dog Kennel is decked all over, run and room alike.

## Stage

Stage `floor-deck` (kind `frame`): Framing view only; in Watch-it-build it
lands on the floor frame. PIPELINE: among the framing entries, only with
`frames: true`.

## Construction settings

* `floor.deck.sheet` -- "4x8 T&G": the sheet size is read from it (long side
  along the building).
* `floor.deck.thicknessIn` -- per layer (default 0.625, 5/8 in).
* `floor.deck.layers` -- 1, or 2 with the "Double floor" option
  (`rate.dbl` construction effect).
On the normal-model path the joists under it are drawn shallower by thickness
x layers so the deck top remains y0. The opt-in lesson instead lays the
specified sheet thickness on the full-height corrected frame.
Its explicit `floorStudy.deck` settings and frame-bound coverage are
separate from these legacy settings.

## Where it came from in Barnwright

New -- Barnwright drew none (its floor is one solid slab, `parts/floor.js`,
`3ddesign.html` 3868-3877, pinned SHA-256 `0bdcf663...`). It fits the top of
that slab's envelope and the shop's floor note (2147-2150). The area decked
is the room's outline (`roomOutline` in `parts/floor-frame.js`, the same walls
`parts/siding.js` draws), inset to the slab.

## The owner's facts

The September 27, 2026 confirmation above establishes the current flooring
term, sheet size, thickness, joint type and staggered layout. These older
notes remain background for normal-model and double-floor behavior.

* Barnwright 2147-2150 (the shop): "2x6 joists on skids with 5/8" decking".
* Alan, Aug 2026: "Double floors is the 4x8 tongue and groove flooring that
  goes on top of the 2x6. And double means they is another layer of
  flooring." (kept in the code comment too)

## Kept quirks

* On the normal-model path, a hairline joint (`SEAM`, 0.01 ft) is left between
  sheets so each can be seen. The lesson's confirmed layout does not invent
  that physical gap or a manufacturer tongue/groove profile.
* The decking covers the room to the OUTSIDE of the walls (the walls stand on
  it), not just the floor you can walk on.

## How to change it safely

* Sheet size, thickness and layers are settings -- change them there.
* In this lesson, check the 8+8 / 4+8+4 / 8+8 lengths and 4+4+2 row widths,
  5/8 in thickness and exact frame-bound coverage. Keep the existing timber
  geometry unchanged, and preserve confirmed versus derived statuses.
* If the decked area changes (a new porch shape), `roomOutline` in
  `parts/floor-frame.js` is the one place; `porch-deck-frame` decks the rest.
* Run `node tools/check-framing.mjs` (covers every layer, sits on the joists,
  nothing overlapping) and `node tools/check-golden.mjs`.

## Checks that guard it

* `node tools/check-floor-deck-lesson.mjs` -- the seven-piece layout, exact
  coverage, thickness, stagger and trimmed row; sheet-end bearing; unchanged
  frame, skids and ordinary designer.
* `node tools/check-framing.mjs` -- every layer of decking covers the room
  (at least 97 %, the joints taken out), there are `floor.deck.layers` layers
  (two with the double floor), every sheet rests on joists (or the layer
  under it), nothing overlaps, and the finished building is untouched.
* `node tools/check-parts.mjs`, `node tools/check-imports.mjs`.
