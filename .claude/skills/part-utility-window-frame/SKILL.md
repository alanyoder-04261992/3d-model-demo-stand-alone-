---
name: part-utility-window-frame
description: Model or resize Alan's utility top window plate and studs above it. Read before changing this flat 2x4 detail, its height datum, upper-stud cuts or layout; lofted-wall headers use a separate part.
---

# Utility top window plate

## What it is in real life

Alan's October 1 rule is **one flat 2x4 across the top of the window**,
actual 1.5 in high and 3.5 in deep, with studs filling the space above it
to the underside of the wall's **top plate**. The **upper plate** is the
separate board above the top plate. Preserve his name **top window plate**;
do not substitute the lofted wall's three-board window header.

## Stage

Stage `wall-frame`; opt-in `utility-window-frame` in `parts/index.js`.
The `utilityWindowStudy` drives `parts/utility-window-frame.js` and is
created by `utilityWindowStudyPlan` in `model/utility-study.js` after
`utilityWallStudyPlan`. No new part appears in the ordinary designer or
the loft lesson. The measured window detail shows contextual top/upper
plate portions, not a full framed opening. Window side supports, end
bearing and cut-to-opening-width allowances remain unconfirmed.

## Construction settings

Read `construction.utilityStudy.windowTopPlate` and the current wall
stock. Select sample plate cut `C`; position its top **12.5 in below the
bottom of the wall top plate**. The plate's underside is the opening top.

- Top window plate top = `wall.topPlate.bottom - gapAboveIn`.
- Plate bottom = `plate.top - actual thickness`.
- Short upper stud bottom = top window plate top.
- Short upper stud top = wall top-plate underside.
- Short stud cut = `topPlate.bottom - windowTopPlate.top`.

For the current 89 in wall studs and 1.5 in bottom plate, top-plate
underside is 90.5 in above flooring. Plate top is `90.5 - 12.5 = 78 in`;
underside is `78 - 1.5 = 76.5 in`. Upper studs cut to **12.5 in**.
The sample plate cut is 36 in and remains illustrative. The gap is a
confirmed shop rule independent of window width. An explicit API
`gapAboveIn` override is marked a study override, not confirmed product data.

## Kept quirks

Reuse the wall grid through `openingStudLayout`, including covered double
studs. The exact layout above openings remains provisional. Only draw
full-width supported members; reject a positive gap with no covered mark.
If the plate meets the top plate, create no zero-height studs. Reject a
plate above the top plate, nonfinite dimensions or mismatched stock.

## Where it came from in Barnwright

This is a new learned utility detail. The ordinary designer's headers and
finished geometry stay unchanged; only this lesson opts into the assembly.

## The owner's facts

Alan specified 89-inch utility wall studs, a flat top window plate with
studs above it, the 12.5-inch bottom-of-top-plate to top-of-window-plate
gap, and studs wherever there is space above framed openings.
He separately supplied standard 5/12 and steep 7/12 A-frame roof pitch.

## How to change it safely

The exact meshes drive both 3D and PNGs, with vertical stud grain and
different deterministic wood textures/knots. Texture changes must preserve
positions, normals and stages. Keep source plans immutable and retained
drawings/readouts together after invalid UI input. Treatment, fastening
and engineering span/load ratings have not been taught.

Read [utility framing](../../../.agents/skills/utility-framing/SKILL.md)
for scope and [measurements](../../../.agents/skills/shed-measurements/SKILL.md)
for formulas. Refresh pictures with `node tools/export-utility.mjs` then
`python tools/render-joist-picture.py --utility window`.
## Checks that guard it

`node tools/check-utility-framing.mjs` validates contacts, actual sections,
default gap/derived elevations, variable cuts and explicit gap overrides,
no overlaps, no zero-length studs and roof pitch
calculations. Also run company/skill validation and the required fast suite.
