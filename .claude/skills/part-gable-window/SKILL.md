---
name: part-gable-window
description: The gable windows -- the faux loft window, the 18x24 window and the octagon window -- up in a gable end or high on a side wall, cut off at the roof line -- read before changing their look, where they sit, the octagon shrink or the roof-line clip.
---

# Gable window (`parts/openings/gable-window.js`)

## What it is in real life

The windows that go up in the triangle of a gable end (or high on a side
wall):

* **Faux loft window** (2.6 x 1.9 ft) -- decorative: a trim-colour frame
  0.3 ft wide with a triangle in each inside corner, and NO glass (the siding
  shows through). Standard on lofted barns, at no charge.
* **18x24 window** -- a real double-hung window, four panes to a sash, with
  the SAME trim as every wall window: side casings, a drip-cap head widest at
  its top, a sloped sill widest at its bottom -- drawn flat, because a gable
  end is drawn flat.
* **Octagon window** (2.3 ft across) -- an 18 in white octagon window with
  glass and a cross of white muntins, and octagonal TRIM-colour boards 0.4 ft
  wide going ROUND it (so it changes with the trim colour).

Where it goes:

* **On a side wall** (R or L): centred at `y0 + min(4.6, wall height - 1)`
  plus however far the customer dragged it, kept between 1 ft off the floor
  and 0.30 ft under the wall top.
* **On a gable end** (F or B): on the plane of the gable, `z = +-L/2`,
  centred at `topY + max(0.62 + h/2, 0.34 of the gable's height)` plus the
  drag; never lower than 0.14 ft above the wall top (THE FLOOR WINS) and,
  where it fits, 0.22 ft under the roof and 0.35 under the peak. Whatever
  still rises past the roof line is CUT OFF at it (0.10 ft inside the roof),
  the way the roof trim covers it on a real building.
* **An octagon too big for its gable** -- when the gable (wall top to peak)
  is less than 0.92 ft taller than the octagon -- shrinks to the gable's
  height less 0.92 ft, never below 0.55 of its size.
* The 18x24's outside trim needs room of its own (0.39 ft each side, 0.29
  above, 0.27 below), so those pads are part of where it may go.

## Stage

`windows` (id 15, finish): shown in the Finished view, hidden in Framing (the
gable framing, `gable-frame`, frames round it), lowered into place at the
`windows` step of Watch-it-build. Drawn by PIPELINE entry 14, `openings`
(`parts/openings/index.js`), for every item whose catalogue `draw` trait is
`faux-loft`, `gable-1824` or `octagon`, in the order the items were added
(Barnwright's `buildShed` line 4043, `renderItem` -> `renderGableWin`).

## Construction settings

No setting of its own. It reads the roof line (`plan.prof`, and the same
`roofProfile(W, topY, style, construction)` for the clip), so a company that
changes a roof's rise or shape (`roof.shapes.<roof>` in
`library/construction.json`) moves where it sits and where it is cut.

## Where it came from in Barnwright

`boisterous-lokum-a737e0/public/3ddesign.html` (pinned SHA-256
`0bdcf663c5cb988623d2cb0dd271156fb690564072b301b0a15b917fd921ac6c`):

* `renderGableWin(it,c,prof,mT,mG)`, lines **3575-3705** (with its inner `G`
  3626-3642 and `gp` 3644), called from `renderItem` line **3141**
  (`if(c.gable){ renderGableWin(...); CURIT=null; return; }`);
* the catalogue note on the octagon and `OCT_WIN`/`OCT_TRIM`, lines 731-738
  (`engine/constants.js`, the manufacturer file).

Porting edits (docs/ARCHITECTURE.md, Porting rules), and nothing else:
1. Rule 1: `dims()` -> `plan.d`, `T()` -> `plan.t`, `wallDefs()` ->
   `plan.ws`; `roofProfile(d.W, y0+t.wallH)` -> `roofProfile(d.W, y0+t.wallH,
   t, plan.construction)` (the same maths, told the style and settings);
   `gq2 pushQuad wallPt mat` are the kit's; `gableClip profileYat` from
   `model/roof-shapes.js`; `y0 OCT_WIN` from `engine/constants.js`.
2. Rule 3: `it.cat==="g1824"` -> draw `gable-1824`; `"fake"` -> `faux-loft`;
   `"oct"` -> `octagon`. The octagon's shrink copies the catalogue entry, and
   that copy now also carries `draw`, because the draw trait is what the later
   "which window" tests read.
3. Rule 6: `hitQuads.push` -> `kit.hit`. The current item is cleared by the
   caller, as `renderItem` did after it.

## The owner's facts

Barnwright's comments, kept word for word in the code:

> THE 18x24 WEARS ITS TRIM OUTSIDE ITS OWN OPENING -- a head board above and a sill below, like every window on a wall (see the casing further down). So the room it needs in the gable is bigger than c.w/c.h, and clamping on the window alone would push the head board through the roof line.

> same shape as the gable clamp: a lower bound that cannot be overruled, so a window taller than the wall does not end up under the floor

> The octagon gable window is 2.3 ft across, which is right on a barn and far too big on a six foot garden shed: the roof cuts it into a pointed arch with the trim ring left hanging below, which is not a window anybody sells. Clipping is the right answer for a window that ALMOST fits. A window that was never going to fit should be a smaller window, so it shrinks to what the gable can take - never below about half, because past that it is a porthole and the customer should pick something else.

> THE FLOOR WINS THE ARGUMENT, and the roof line is handled by CUTTING rather than by shoving. On a small gable the window is taller than the triangle -- the 18x24 does not fit any 8 ft wide shed and never has. If the ROOF wins that argument the window's centre drops below the eave and it is drawn on the wall over the door, which is worse than the problem: an 8x12 utility put the octagon straight through its gable trim band and a 6x8 garden utility put it on the door head. So the bottom edge stays where a window belongs, and gableClip below removes whatever rises past the roof instead of moving the window to avoid it.

> nothing on a gable end may be drawn above the roof. On the buildings with room to spare this changes nothing at all; on the ones without, it is the difference between a window tucked under the eave and a window floating in the sky.

> THREE RINGS, and the outer one is the whole point. The octagonal trim boards go ROUND the 18 inch window, they are not cut out of it, and they wear the TRIM colour -- so picking a trim colour changes this window. It used to be one white octagon 18 inches across all in, which is why Alan said it was too small AND that it never changed.

> THE SAME TRIM AS EVERY OTHER WINDOW (Alan, Aug 2026: "the trim looks different then other window trim and it should be the same"). It was one flat rectangle behind a blank pane -- no head board, no sill, no bars. A window on a WALL gets a drip-cap head widest at its TOP with the ends cut back, side casings between, and a sloped sill widest at its BOTTOM. These are that code's own numbers (fr / hE / sE and the 0.29 head), drawn flat because a gable end is drawn flat.

> double-hung, four panes to a sash, the way the real one is glazed

From the catalogue (Barnwright 731-734, `engine/constants.js`):

> THE OCTAGON IS 18 INCHES OF WINDOW PLUS THE TRIM ROUND IT. w/h is what the whole assembly covers on the gable: OCT_WIN of glass with OCT_TRIM of trim board each side. Setting it to 1.5 all in draws the trim INSIDE the 18 inches and leaves a 10 inch window.

## Kept quirks

* **The octagon shrink scales the trim ring but NOT the white window or the
  glass** (`Rw = OCT_WIN/2`, `r = Rw - 0.15`). On a small gable the trim ring
  can shrink inside the white octagon, which is drawn in front of it, and the
  trim-colour ring disappears. That is Barnwright's picture (the shrink happens on
  `gable-ut-10x20-oct-back`, to 0.77, and on `gable-ut-8x12-oct-dragged` and
  `gable-ss-10x20-oct`, to 0.55); fixing it is a look change.
* **The gable plane is `z = +-L/2` even on a front-porch building**, where the
  front wall is set back 4 ft -- the window is on the porch gable there, which
  is right. Do not "fix" it to wall F's z.
* **The clip uses the raw roof profile**, not the cottage's raised eave.
* **On a side wall nothing is clipped**, and each polygon is drawn as a fan of
  quads whose last corner is repeated (half of every quad is a zero-area
  triangle); the glass UVs there run 0.06-0.94, on a gable 0.03-0.97.
* **The 18x24's trim numbers are copied by hand** from the wall window's
  (`fr 0.27`, `hE 0.12`, `sE 0.10`, the 0.29 head, drawn 0.27 and 0.25 here).
* `white` is made again for the octagon and the 18x24 (first call wins; the
  same paint). `u_` is computed and never used.
* A gable window on a gambrel end moves that end's gable band down
  (`gableBandY`, the `gable-band` part) -- adding or removing one changes the
  door-height cap on that end too.

## How to change it safely

1. Read this skill, `part-openings`, and the comments in
   `parts/openings/gable-window.js`.
2. Run `node tools/check-golden.mjs --part gable-window` before and after,
   then the whole `node tools/check-golden.mjs`.
3. The placement numbers (0.62, 0.34, 0.14, 0.22, 0.35, 0.92, 0.55, the pads)
   decide where it sits on every building; `model/layout.js openingRect`
   repeats them for the gable framing and picking, so change both together and
   run `node tools/check-model-live.mjs`.
4. A new gable window is a catalogue item with `gable: true` and one of these
   draw traits; a new SHAPE needs a new branch here and its own golden cases.
5. If the look must really change, re-record the golden fixtures on purpose
   (`node tools/capture-golden.mjs`, with a reason).

## Checks that guard it

* `node tools/check-golden.mjs --part gable-window` -- every gable-window
  triangle of the 148 recorded Barnwright buildings, number for number (39
  buildings, 715 triangles, Sep 26 2026): all three kinds on the front and
  back gables, on side walls (dragged along and up), the 18x24 clipped at the
  roof on a 6x8, the octagon shrunk on 8 and 10 ft wide gables and a single
  slope's end wall, on saltbox, gambrel and lean-to end walls, on a metal
  barn, and the selected faux loft window (`sel-gable-lb-10x20`, the blue
  glow).
* `node tools/check-golden.mjs` -- also the draw order and paint.
* `node tools/check-model-live.mjs` -- `openingRect` for gable windows (centre,
  opening and trim in one set of coordinates, clipped as drawn) against
  Barnwright's live page.
* `node tools/check-parts.mjs`, `node tools/check-imports.mjs`.
