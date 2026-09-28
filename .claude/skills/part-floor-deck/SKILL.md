---
name: part-floor-deck
description: The tongue-and-groove floor decking sheets over the floor joists (one layer, or two for the double floor) -- read before changing the sheet size, thickness, layers or how the sheets are laid.
---

# Floor decking (`parts/floor-deck.js`)

## Scope of the current floor lesson

On September 27, 2026 Alan confirmed **skids**, **notches**, the actual skid
and crosswise member sections, their 1 in notched seating, and 16 in standard
spacing with extra notches for a 12 in option. This did **not** confirm the
term **floor decking**, the sheet specification or its layout in the current
lesson. Keep that label proposed and the sheet values identified as existing
model defaults until discussed. The earlier shop notes below remain source
evidence, not a new confirmation from the photos.

The learning page's opt-in `floorStudy` plan keeps the crosswise members at
their confirmed actual 5 1/2 in height, seated 1 in into actual 5 1/2 in-high
skids. When sheets are manually added, they sit on that corrected frame top.
Do not compress the frame or force the lesson deck top to the legacy `y0`.
The normal finished reference retains its older envelope below. Start the
lesson with skids only; Alan has since accepted that render and confirmed
**floor joist** for the regular crosswise member. The current manual
`?step=frame` view now includes the outer/end boards and still excludes
sheets. Reveal them when Alan directs it; the joist term and Alan's
“outer board” wording do not confirm decking or the technical perimeter names.

Alan confirmed the 10 ft outside floor width and 1 1/2 in outer boards on
both sides; his 3 in subtraction gives a derived 117 in joist length. He
also confirmed two end boards at one end, one at the other, and treated
wood for those floor-framing boards. These facts do not confirm sheet
dimensions, layout or treatment. The frame's X width changes, while its
Z footprint stays provisional; do not treat the 16 ft skid length as an
approved complete floor-frame or sheet extent.

The opt-in is [floorStudyPlan](../../../model/floor-study.js), reading
`construction.floorStudy`. `floorDeckMembers(plan)` already reads the frame
top from `floorPlanOf(plan)`, so it follows the corrected study height when
`plan.floorStudy` is present; ordinary plans still use the legacy height.

The supplied photos corroborate the notched connection, not dimensions
measured from pixels. Do not publish the photos. Alan's 30 in skid offset is
confirmed from the outside wall to the inside skid face, toward the floor's
middle. The lesson uses `floorStudy.skids.insetToInsideIn: 30` and a confirmed
`supportOffset` status; the legacy skid table is unchanged. Keep
repeated-notch first-center placement, cut clearance, skid count,
outer-board height/length, full-frame length and deck details pending.
See [the example](../../../docs/examples/10x16-side-loft.md).

## What it is in real life

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

## Where it came from in Barnwright

New -- Barnwright drew none (its floor is one solid slab, `parts/floor.js`,
`3ddesign.html` 3868-3877, pinned SHA-256 `0bdcf663...`). It fits the top of
that slab's envelope and the shop's floor note (2147-2150). The area decked
is the room's outline (`roomOutline` in `parts/floor-frame.js`, the same walls
`parts/siding.js` draws), inset to the slab.

## The owner's facts

These are earlier source notes, separate from this lesson's confirmed terms.

* Barnwright 2147-2150 (the shop): "2x6 joists on skids with 5/8" decking".
* Alan, Aug 2026: "Double floors is the 4x8 tongue and groove flooring that
  goes on top of the 2x6. And double means they is another layer of
  flooring." (kept in the code comment too)

## Kept quirks

* A hairline joint (`SEAM`, 0.01 ft) is left between sheets so each one can be
  seen; the real sheets butt tight.
* The decking covers the room to the OUTSIDE of the walls (the walls stand on
  it), not just the floor you can walk on.

## How to change it safely

* Sheet size, thickness and layers are settings -- change them there.
* If the decked area changes (a new porch shape), `roomOutline` in
  `parts/floor-frame.js` is the one place; `porch-deck-frame` decks the rest.
* Run `node tools/check-framing.mjs` (covers every layer, sits on the joists,
  nothing overlapping) and `node tools/check-golden.mjs`.

## Checks that guard it

* `node tools/check-framing.mjs` -- every layer of decking covers the room
  (at least 97 %, the joints taken out), there are `floor.deck.layers` layers
  (two with the double floor), every sheet rests on joists (or the layer
  under it), nothing overlaps, and the finished building is untouched.
* `node tools/check-parts.mjs`, `node tools/check-imports.mjs`.
