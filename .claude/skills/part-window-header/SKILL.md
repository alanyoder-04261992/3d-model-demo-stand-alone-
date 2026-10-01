---
name: part-window-header
description: Model or explain Alan's lofted-wall window header, outside ledge and top-plate fit; read before changing the learned three-board assembly or reusing it at another window size.
---

# Lofted-wall window header

For the utility style, use
[top window plate](../part-utility-window-frame/SKILL.md): one flat 2x4
with studs filling the space above it. Alan taught that October 1;
the three-board loft assembly below remains specifically lofted-wall.

## What it is in real life

The **window header**, also called the **loft header** here, crosses above
the window opening. Two nominal 2x4s stand on edge and touch side by side,
on top of another 2x4 lying flat. The whole assembly touches the underside
of the **top plate**. The **upper plate** remains a separate board above it.
This is Alan's **lofted-wall** rule; do not apply it to other wall types.

Alan subsequently confirmed this same section for the usual doorway
header. The [doorway lesson](../part-doorway-frame/SKILL.md) adds his king
studs and derives cuts from opening width plus bearing at each end;
alternative headers and the height datum are separate doorway rules.

The **window plate** is a different 2x4 across the bottom of the window
opening. Alan confirmed it lays flat, 1.5 in tall and 3.5 in deep through
the wall, and that there are **studs under the window plate**. Do not call
the flat board in the header the window plate.

## Stage

Stage `wall-frame`, framing only. The opt-in `window-header` PIPELINE entry
follows wall framing. `window-framing.html` is an isolated connection
lesson: header views retain two contextual wall-plate portions. The next
[window-plate lesson](../part-window-plate/SKILL.md) adds the flat plate and
studs below it. The all-pieces view is incomplete until side framing is
learned. The separate wall lesson remains a plain wall.

## Construction settings

Read `construction.windowHeader` in the learning company. Its section is
actual 1.5 x 3.5 in; `plies: 2`, `base: flat-same-stock`,
`ledgeSide: outside`, `topDatum: top-plate-underside`,
`scope: lofted-wall`. Explicitly pass the sample cut length to
`windowHeaderStudyPlan`. The current 36 in example is illustrative, not a
rough-opening width, a universal cut length or a fixed window size.

For thickness `t`, stock depth `D` and selected header cut `C`:

- Total header height = `D + t` = 5 in.
- Combined edge-board thickness = `2t` = 3 in.
- Outside ledge = `D - 2t` = 0.5 in.
- Header top = top-plate underside.
- Header bottom = `topPlate.bottom - (D + t)`.
- Each displayed board length = `C`; equal end cuts are provisional
  until the side-support/end-joint details are taught.

For the learned 75 in wall stud and 1.5 in bottom plate, top-plate
underside is 76.5 in above the flooring and header underside is a derived
71.5 in above the flooring. Changing footprint or sample cut does not
scale this section or the 75 in stud rule.

`construction.windowPlateLesson` records the confirmed flat section and
presence of studs below it. Alan confirmed their seat on the bottom plate
and the same 16-inch wall layout; its starting datum remains provisional.
Window-plate cut-to-opening-width and side support details remain unconfirmed.
Once opening height `Rh` is supplied,
window-plate top = `header.bottom - Rh`; bottom = `plate.top - t`.
Its support studs sit on the bottom plate, so their cut length =
`windowPlate.bottom - bottomPlate.top`. The window height is an input,
not a fixed shop size.

## Where it came from in Barnwright

New isolated lesson — Barnwright drew none of this learned connection
detail. Ordinary opening framing stays in `parts/wall-frame.js`. Do not
silently replace its existing headers with this company-specific rule.

## The owner's facts

Alan supplied an end-view header photograph and described the three-board
loft header against the top plate. He confirmed **outside of the wall**
for the remaining half-inch ledge. The inside faces are therefore flush.
He added studs under the window plate, confirmed that plate lays flat,
and clarified **this is for a lofted wall**. He then confirmed that these
studs stand on the bottom plate and retain the wall layout. Preserve those facts when
changing the drawing; do not publish his original photo.

## Kept quirks

This isolated lesson uses the measured end-wall coordinate frame: outside
is the smaller Z face; inside is the larger Z face. The ledge is on the
smaller Z side, even if a camera rotation puts it on the other screen side.
Both wall plates shown in the detail are portions only. Their real wall
cut lengths remain unchanged. No side supports, opening clearances,
fastening, treatment or full opening layout are inferred from the photo.

## How to change it safely

Read the wall-frame skill and shared measurements workflow. Keep exact
prism geometry, plate contact and per-board grain; dimensions come from
settings. The lesson uses `model/window-header-study.js` and
`ui/learn-window-header.js`. Keep the phone images available without WebGL.
Regenerate them with `node tools/export-window-header.mjs`, followed by
`python tools/render-joist-picture.py --header` (Pillow and NumPy).
Only the isolated lesson opts into this part. Do not assemble it over a
plain wall's uncut studs and present that as a correctly framed opening.

## Checks that guard it

`node tools/check-window-header.mjs` proves three touching boards, the
outside ledge, total height, plate contact, resizing and invalid-input
handling; wood finish preserves the mesh. It also proves the normal plan
has no new header and remains immutable. Run company validation and
`node tools/check-all.mjs --fast`, then inspect the lesson, controls and
phone pictures. Legacy Linux browser checks skipped on Windows are not
passes.
