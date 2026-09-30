---
name: part-gable-window-frame
description: Build Alan's adjustable gable window box from the selected clear opening, with moved side studs and outward-facing horizontal 2x4s. Use for different window sizes or positions in the learned gable assembly.
---

# Gable window box (`parts/gable-window-frame.js`)

## What it is in real life

For a real gable window, Alan's gable studs move to the two sides of the
window. Horizontal 2x4s make the top and bottom of the box. All four
3.5 in wide faces point outward, with 1.5 in through-wall thickness.
Window dimensions vary; use the selected clear opening, never one fixed
window size for every building. The side studs belong to `gable-frame`;
this part owns the two horizontal pieces.

## Stage

`roof-frame`, framing only. PIPELINE entry `gable-window-frame` follows
`gable-backing`. It is active only with a real `trussStudy.windowOpening`.
The normal finished designer and no-window lesson remain unchanged.

## Construction settings

`construction.trussStudy.studs` supplies the section and outward-face rule.
Pass the selected design's opening to
`trussStudyPlan(gablePlan, {truss:true, windowOpening})`:

```js
{kind:"window", widthIn, heightIn, centerIn, bottomIn}
```

`widthIn`/`heightIn` are clear distances between framing faces, not trim or
catalogue marketing dimensions. `centerIn` is horizontal offset from the
truss center. `bottomIn` is clear-opening bottom above upper-plate top.
Null bottom height uses a visibly labeled auto-fit preview: halfway
between the lowest and highest positions that fit. It is not a shop rule.
Null opening means no window; `{kind:"fake"}` suppresses backing without
inventing fake-window framing. Settings alone do not activate a window.

`windowExample` seeds editable lesson inputs only. Its 18x24 values are
illustrative, not approved dimensions, a fixed requirement or a default
framing opening for a manufacturer's product. Any caller selecting a real
window must supply that window's framing opening. The lesson URL
`learn.html?step=truss&window=1` opens the adjustable example.

## Where it came from in Barnwright

New -- Barnwright drew none. Uses the learned gable board, truss and gable
studs, separate from the ordinary model's generic opening framing.

## The owner's facts

Alan confirmed moved side studs, horizontal 2x4s forming a box and all
wide faces outward. He then clarified that windows differ in size: implement
the reusable relationship without waiting for one example's measurements.
Both real and fake gable windows omit ordinary gable backing on that end.
Treatment, fastening and fake-window box framing remain unspecified.

## Kept quirks

No inherited finished geometry. The horizontal pieces fit between full
side studs as an explicit preview joint. The regular stud pair nearest
the new sides moves; any further stud crossing the box is omitted. This
choice does not confirm added short studs above or below the opening.
Unchanged truss miters and stud-top joints retain their provisional status.

## How to change it safely

`model/truss-window.js` validates and resolves the opening in inches:
left/right edges = center minus/plus half clear width. With actual face
width `f`, side-stud centers are `left-f/2` and `right+f/2`. Each horizontal
cuts to clear width in the between-stud preview joint. Bottom piece spans
`[bottom-f,bottom]`; top spans `[bottom+height,bottom+height+f]`.
All fronts align with the existing stud front. Never use the backing's
11 in offset as a window-height rule.

Recalculate for every selected width, height, position or shed size.
Validate the full box and side studs on the board and below the truss;
reject an invalid opening rather than shrinking it or drawing a clipped
window. Invalid UI edits keep the last valid drawing and show a message.
The fixed preview truss itself still has its own sizing constraints.

The current lesson represents one chosen opening on end B. It is not a
multiple-window layout solver or a change to the ordinary designer.
The same members feed meshes, measurements, labels and varied horizontal
wood grain. Keep previous lessons and ordinary golden geometry unchanged.

## Checks that guard it

`node tools/check-gable-window.mjs` checks different sizes and offsets,
the clear cavity, exact stud/board contacts, mesh volume, outward faces,
invalid fit rejection, and return to no-window/fake-window states.
Run `node tools/check-all.mjs --fast` and validate the affected skills.
Check the phone controls, dimension labels and invalid-input recovery.

Export any example using `node tools/export-joist-render-data.mjs --window=18x24`
and `python tools/render-joist-picture.py --window 18x24`. Example dimensions
must be labeled as changeable, never recorded as builder-confirmed sizes.
