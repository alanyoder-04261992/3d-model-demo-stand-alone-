---
name: part-window-plate
description: Draw or resize Alan's flat window plate and supporting studs in a lofted wall, keeping the original wall layout and calculating stud cuts from window height.
---

# Lofted-wall window plate and studs

## What it is in real life

The **window plate** is the flat 2x4 across the bottom of the window
opening, actual 1.5 in tall and 3.5 in deep through the wall. Its supporting
studs stand on the **bottom plate** and touch the window plate's underside.
This assembly is separate from the flat board belonging to the header.

## Stage

Stage `wall-frame`; opt-in `window-plate` entry after `window-header`.
`window-framing.html` starts with this assembly. It can show all learned
pieces or return to the header views. Side framing is still unfinished.

## Construction settings

Read `construction.windowPlateLesson`: `scope: lofted-wall`,
`orientation: flat`, `studsBelow: true`,
`studLayout: wall-stud-layout`, `studSeat: bottom-plate-top`.
Actual thickness/depth come from these settings, stud section and horizontal
layout from `wallStudy`. The 36 in clear-height example is an adjustable
input, never a fixed window size.

Pass independent plate cut `lengthIn` and vertical `clearHeightIn` into
`windowPlateStudyPlan` after the header study. Clear height is between
the window-plate top and header underside. For header-bottom elevation
`HB` above flooring, clear height `H`, window-plate thickness `t` and
bottom-plate thickness `b`:

- Window-plate top above flooring = `HB - H`.
- Window-plate bottom = `HB - H - t`.
- Supporting stud cut = `HB - H - t - b`.

In the learned 75 in stud-height wall, `HB = 75 + 1.5 - 5 = 71.5` in.
With an illustrative 36 in clear height: plate top 35.5 in, underside
34 in, supporting stud cut **32.5 in**. A 48 in clear height gives **20.5 in**
studs. Footprint and window size do not scale lumber thickness or header
height.

Reuse the exact stud positions from `wallStudyFrame`; do not restart the
16 in layout at a window edge. Preserve doubled studs around each 4 ft
mark, with that mark between the touching pair. The wall's initial layout
datum remains provisional; this confirmation does not establish it.
Only full-width studs within the sample plate cut are drawn. End-stud
packs, support spacing at the plate ends and side joints remain to learn.
Reject a sample missing all stud marks or leaving zero/negative stud height.

## Where it came from in Barnwright

New learned lesson — Barnwright drew none of this isolated detail. The
ordinary designer's sill/cripple rules remain in `parts/wall-frame.js`.
Do not change them or overlay this assembly on an uncut plain wall.

## The owner's facts

Alan said the window plate is the lower horizontal 2x4, confirmed that it
lays flat, added studs underneath, and specified **lofted wall**.
He then confirmed those studs sit on the bottom plate and follow the
same 16-inch-on-center layout as the wall studs. Preserve his terminology;
do not replace it with an unconfirmed shop name.

## Kept quirks

The lesson uses the measured end wall's coordinate frame, but the rule is
for lofted walls. Outside is smaller Z; inside is larger Z. Bottom/top/
upper wall plates shown are contextual portions, not shortened wall cuts.
The UI gives header and window plate equal illustrative cut lengths;
their cut-to-opening-width relationship remains unconfirmed. Record it
as an example instead of claiming a complete framed opening.

## How to change it safely

Keep inputs validated, source plans frozen, full contact at both ends of
each support stud and vertical grain along each stud. The lower assembly
lives in `parts/window-plate.js`; placement/selection in
`model/window-plate-study.js`. Actual mesh records drive both 3D and PNG.
Refresh the phone picture with `node tools/export-window-header.mjs --plate`
then `python tools/render-joist-picture.py --window-plate`.
Read [the header skill](../part-window-header/SKILL.md) for the fixed top
datum and [measurements](../../../.agents/skills/shed-measurements/SKILL.md)
before adapting another building. Treatment and fasteners are unconfirmed.

## Checks that guard it

`node tools/check-window-plate.mjs` checks varying cuts/heights, retained
wall marks, double studs, bearing contact, no solid overlaps, correct grain,
immutable source, invalid inputs and unchanged ordinary framing. Run
company validation and `node tools/check-all.mjs --fast`, then inspect
the controls and phone picture. Skipped browser checks are not passes.
