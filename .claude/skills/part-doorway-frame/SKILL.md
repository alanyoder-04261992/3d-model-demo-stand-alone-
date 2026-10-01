---
name: part-doorway-frame
description: Model or resize Alan's doorway framing with his king-stud terminology, header bearing, loft or stacked-flat headers, and king studs to the top plate. Read before changing the doorway lesson or adapting it to another opening size.
---

# Doorway framing

## What it is in real life

Alan's **king stud** is the support beneath the header, beside a full-height
**stud**. Both sit on the **bottom plate**. The king-stud cut is the selected
door height, measured from bottom-plate top. The header extends 1.5 in over
each king stud, bearing on its full width.

The usual header is the learned loft-window assembly: two touching 2x4s
on edge on one flat 2x4, 5 in tall, with the 0.5 in ledge outside.
For a taller door, two flat 2x4s stack to a 3 in header. Alan confirmed a
garage-door arrangement where king studs reach the top-plate underside,
with no separate header below that plate.

## Stage

Stage `wall-frame`; opt-in `doorway-frame` after the window lessons in
`parts/index.js`. Only a `doorwayStudy` draws it. The separate
`doorway-framing.html` lesson shows four uprights and the chosen header,
with optional contextual plate portions. It uses the measured end-wall
coordinate frame for the detail. A later side-wall integration needs the
proper wall basis.

## Construction settings

Read `construction.doorwayLesson`. Actual stock thickness `t=1.5` in and
depth `D=3.5` in match the measured wall studs. Keep opening width `R`,
king-stud cut `K`, and header option independent. They vary per doorway.
The adjustable 36 in width / 70 in cut are illustrative examples.

- Header cut = `R + bearingLeft + bearingRight = R + 2t`.
- King-stud top = `bottomPlate.top + K`; header bottom equals that top.
- Loft-header height = `D + t`; outside ledge = `D - 2t`.
- Stacked-flat-header height = `2t`, with full stock depth through the wall.
- Available height = `topPlate.bottom - bottomPlate.top`.
- A header fits when `K + headerHeight <= availableHeight`.
- Maximum king cut = `availableHeight - headerHeight`.
- To-plate king cut = `availableHeight`; there is no separate header below it.
- Opening top above flooring = `bottomPlate.thickness + K`.

The learned 75 in wall-stud cut makes available height 75 in. Maximum
king cuts are 70 in with the 5 in loft header, 72 in with the 3 in flat
header, and 75 in to the top plate. Their tops are respectively 71.5,
73.5 and 76.5 in above flooring. These are derived for this wall, not
universal door sizes. A 36 in opening gives 39 in header cuts; a 72 in
opening gives 75 in cuts. A product's named size does not establish `R`.

The neighboring full-height stud is outside each king stud. Its bottom and
top follow the wall's stud datums. Two upright widths per side leave a
required sample span `R + 4t`; validate it against the frame bounds.
Contextual upper-plate portions retain the actual end setbacks.

## Where it came from in Barnwright

New learned detail. Ordinary `parts/wall-frame.js` retains its existing
header selection and internal names. There, the full-height member is
called `king`, and the shorter support `jack`. In Alan's shop terminology,
that shorter support is the **king stud**, and the full-height neighbor
is the **stud**. Preserve his labels without renaming the legacy member API.

## The owner's facts

Alan described a stud and king stud with a header resting on the king stud.
He confirmed the king stud is the shorter support beside a full-height stud,
stands on the bottom plate, and gets 1.5 in of header bearing at each end.
He confirmed two flat boards stacked for a taller door and the garage
arrangement reaching the top plate without a separate header below it.
The usual loft header is the one already learned for the loft window.

## Kept quirks

The height input is the king-stud cut from bottom-plate top. Show its
flooring elevation separately. Width is the clear space between king
studs. No fixed doorway size or automatic engineering choice is established.
The builder selects an option and the drawing validates geometric fit.
Header depth does not scale with building width. Splices, fastening,
treatment and load/span ratings are unspecified.

The bottom plate is shown as framing context; its eventual doorway/threshold
cut is still to learn. Alan confirmed October 1 that studs fill empty space
above framed openings. Enable `doorwayLesson.studsAboveHeader`; upper-stud
cut = `wallStudCut - kingCut - headerHeight`. Use full-width supported wall
marks through `openingStudLayout`; exact upper-stud positions remain
provisional. Keep covered double-stud pairs; draw none at zero gap.
Reject a positive gap with no covered wall mark instead of silently leaving
it empty or inventing an extra stud location.
In the utility wall, 89 in studs with illustrative 80 in kings and a 5 in
header leave 4 in upper studs. `doorway-framing.html?wall=utility#rotate`
selects the utility wall; its 89 in cut does not change the 75 in loft wall.

## How to change it safely

Use `model/doorway-study.js` for the immutable plan and measurements;
`parts/doorway-frame.js` draws those members. Keep bottom-plate contact,
full header bearing and the correct outside ledge. Stud grain is vertical;
header/plate grain follows the run, with different deterministic textures.
Phone images use the exact mesh: run `node tools/export-doorway.mjs`, then
`python tools/render-joist-picture.py --doorway loft`, and repeat with
`flat` and `to-plate`. Read [wall framing](../part-wall-frame/SKILL.md),
[the loft header](../part-window-header/SKILL.md), and
[measurements](../../../.agents/skills/shed-measurements/SKILL.md) before reuse.

## Checks that guard it

`node tools/check-doorway.mjs` checks varied widths/cuts and all arrangements,
both bearing ends, stock dimensions, contact, overlaps, fit rejection,
plate setbacks, vertical grain, unchanged mesh after wood finish and
immutable source plans. Run company/skill validation and
`node tools/check-all.mjs --fast`; inspect 3D controls and phone images.
Skipped legacy browser checks are not passes.
