---
name: part-roofing
description: The steel roof (ribbed panels, screws, ridge cap, barn-roof laps, the scalloped eave) and the painted boards round its edges (rake boards, fascia, cottage soffit) -- read before changing how any roof, eave or gable-end edge is drawn.
---

# Roofing (`parts/roofing.js`)

## What it is in real life

The last big step of the shell: sheets of painted, ribbed steel screwed down
over the roof framing, and the painted trim boards that finish its edges.
On the picture:

* **Panels** -- the steel sheet's top face, 0.26 ft (about 3 in) above the
  roof line (`ROOF_TH`), with its **underside**.
* **Ribs** -- a raised rib every 9 in (`RIB = 0.75`), real geometry, about
  0.84 in proud. They sit on the WORLD's 9 in grid (a rib at every z that is a
  multiple of 0.75), so the panel texture's shading lines up with them. They
  run up under the ridge cap and straight over a barn roof's bend.
* **Screws** -- one per pan, a row about every two feet of slope (where the
  purlins are).
* **Barn (gambrel) roofs** -- the shallow upper sheet LAPS over the steep
  lower one at each break (a tail about 4 in long with its own ribs, a
  scalloped cut edge, the hairline shadow it throws, and closures at both
  gable ends), and the upper sheets reach about 1.6 in further past the gable
  end than the lower ones (`RAKE_STEP = 0.135`).
* **The eave** -- on most styles the bare CUT END of the sheet, scalloped at
  every rib, with the dark shadow of the overhang under it. The cottage and
  the single slope have a boxed eave instead: a trim **fascia** board (4 in on
  the cottage, about 6 in on the single slope), and the cottage also has a
  level **soffit** back to the wall with a board closing each end of it.
* **Ridge cap** -- only where the roof truly PEAKS (rising into it on one side
  and falling away on the other), never on a barn roof's two bends. It rides
  on the rib crests, with a closure at each gable end down to the pan, its
  bent lip, the shade it throws on the pan and a screw at every rib, both
  sides.
* **Gable ends** -- on gable, saltbox, lean-to and single-slope roofs a strip
  of trim showing under the roof metal's edge (the metal covers 2/3, 1/3 trim
  shows). On a gambrel, one continuous mitred **rake board** round the whole
  gable with **metal rake trim** covering 2/3 of it.

## Stage

Two stages (`parts/stages.js`):

* **`roofing`** (id 11, finish) -- the steel and everything that belongs to
  it: panels, ribs, screws, the underside of the roof slab, the metal edge
  over the gable-end trim, the gambrel laps, the cut eave and its shadow
  skirt, the ridge cap with its closures, lip, shade and screws, and the
  gambrel's metal rake trim.
* **`trim`** (id 10, finish) -- the painted TRIM-colour boards: the 1/3 rake
  reveal on the gable ends, the boxed-eave fascia (cottage and single slope),
  the cottage soffit and the boards closing its ends, and the gambrel's
  mitred rake board.

Finished view: both shown (it is Barnwright's geometry). Framing view: hidden
(finish stages). Watch-it-build: the steel lands at the `roofing` step and,
from the next step on, hides the roof framing, roof deck, loft and dormer
framing (`COVERS` in `parts/stages.js`); the boards land later, at the
`trim` step.

The single slope's roof UNDERSIDE is painted trim-colour (Barnwright's boxed
eave), but it is the underside of the whole roof slab, so it stays `roofing`
-- otherwise the roof would have no underside until the trim step. (It also
has to: `tools/check-framing-roof.mjs` finds the roof as drawn from the
`roofU` triangles at stage `roofing`, and would find no roof on a single
slope if they were `trim`.)

WHAT WATCH-IT-BUILD SHOWS BETWEEN THE TWO STEPS (rendered Sep 26 2026): the
roof framing is hidden from the step AFTER `roofing` (`buildVisibility`
hides a covered step once the cover is before the current one), and the
trim boards land at `trim`, a step or two later. In between, the steel is on
and the boards are not, so:
* on a COTTAGE the eave box is open -- no fascia, no soffit -- and a low view
  sees through the slot along the eave (exactly what the soffit comment
  below warns about);
* on the SINGLE SLOPE the two eave edges of the roof slab are open (the
  fascia closes them), so the ribs show through the edge;
* on every other roof nothing opens: the metal edge (stage `roofing`) closes
  the slab at the gable ends, and a cut eave is all metal. Only the trim
  strip under the gable-end metal and the barn's rake board are missing.
This is what the contract's split (boards = `trim`) and `buildOrder` (trim
after roofing) give; it is not a porting fault. Changing it is a
`buildOrder` / `COVERS` decision, not a change to this file.

PIPELINE entry 12, `roofing` (`parts/index.js`), after the porch and before
the dormer -- Barnwright's `buildShed` calls `profileRoof` at line 4039, and
the dormer's `mat("roof")` comes after (first call wins, so the roofing sets
the roof paint the dormer then shares).

## Construction settings

All from `plan.construction.roof` through `roofShape(t, construction)`
(`model/roof-shapes.js`); every default is Barnwright's number, so nothing
moves unless a company changes one:

* **`roof.shapes.<roof>.rakeOverhang`** -- the gable-end overhang in feet
  (`rakeOverhangOf(plan)`). Defaults: gable 0.45, salt 0.45, slope 0.45,
  gambrel 0.12, lean 0.12. A style's own `rakeOverhang` trait wins: the
  Garden Utility, the Cottage and the Metal Cottage carry 0.03 ("the same
  nothing"). A GAMBREL IS ALWAYS DRAWN AT 0.10 whatever this says (kept
  quirk, below).
* **`roof.shapes.<roof>.eaveOverhang`** `{left, right}` -- how far the sheet
  runs past the -x (left/back) and +x (right/door-side) walls, measured ALONG
  THE SLOPE, in feet (or `{"in": n}`, `{"w": f}`). Defaults: gable, salt,
  gambrel 0.42 / 0.42; lean-to 0 / 0.333 (4 in over the door, flush at the
  back); single slope 0.35 / 1.15 (the deep eave shading the tall door wall).
  On a lean-to the high (left) end is only extended when `left` is not 0.
* **`roof.cottageEave`** `{backIn, frontIn, fasciaIn}` -- the cottage's level
  eave: 4 in at the back, 8 in at the front (door side), both horizontal, the
  roof raised one fascia (`fasciaIn` 4, less the slab) so the roof line stays
  straight to the tip. The cottage's eave fascia strip is `fasciaIn` deep too.
  Only styles with the `cottage` trait use it.
* The roof's shape itself (`plan.prof`, rise, gambrel shoulders, saltbox
  ridge) comes from the same block through `model/roof-shapes.js`.

Not settings (kept in the code, they are the roofing PRODUCT, not the shop):
rib spacing 9 in (`RIB`, shared with metal siding), rib height 0.07 and
half-widths 0.058/0.02, screw size 0.038 and row pitch 1.95, ridge cap half
width 0.52, lap 0.34 x 0.024.

## Where it came from in Barnwright

`boisterous-lokum-a737e0/public/3ddesign.html` (pinned SHA-256
`0bdcf663c5cb988623d2cb0dd271156fb690564072b301b0a15b917fd921ac6c`):

* `profileRoof(prof,L,ov,W)`, lines **2562-2976** (the whole function, with
  its inner `isPeak`, `ext`, `steepOf`, `lapBack`, the rib/screw IIFE, the lap
  helpers `LP`/`LB2`/`LB`, and `eaveEdge`);
* its call in `buildShed`, lines **4035-4039**, which chose the rake overhang
  (0.03 for GU/CS/MCS, 0.12 for gambrel and lean, else 0.45);
* helpers it reads: `RIB` (2157), `profileYat` (2176), `RAKE_STEP` (2184),
  `ROOF_TH` (2197), `cottageEave` (2198-2203), `tintShade` (2435) -- now in
  `engine/constants.js`, `model/roof-shapes.js` and `engine/math.js` with the
  same maths.

Porting edits (docs/ARCHITECTURE.md, Porting rules), and nothing else -- a
diff of the function against Barnwright's shows only these:

1. Rule 1: `T()` -> `plan.t`; `state` -> `plan.state`; `mat`, `pushQuad`,
   `gq2` -> `kit.mat`, `kit.pushQuad`, `kit.gq2`; the function takes
   `(plan, kit, prof, L, ov, W)`; the textures are named
   (`engine/tex-names.js`).
2. Rule 2: `state.type==="CS"||state.type==="MCS"` -> `!!plan.t.cottage`.
3. Rule 4: the rake overhang is `roofShape(...).rakeOverhang`
   (`tools/check-model-live.mjs` proves it equals what the page passes, style
   by style); the eave extensions `0.333`, `1.15`/`0.35`, `0.42`/`0.42` are
   `roof.shapes.<roof>.eaveOverhang`; `cottageEave(P,th)` is
   `cottageEave(P,th,CE)` with `CE = roof.cottageEave`; the cottage fascia
   drop `4/12` is `CE.fasciaIn/12`. The lean-to also extends its high end
   when a company sets a non-zero `left` (Barnwright never extended it; with
   the default 0 the code does not run).
4. Rule 7: `kit.setStage("roofing")` / `kit.setStage("trim")` around the
   trim-colour boards.

## The owner's facts

Every real-life fact in this part is Alan's (his photographs, his drawings on
screenshots of the designer, his words), kept in `parts/roofing.js` as
Barnwright wrote it. Copied here word for word, in the order they appear in
the code:

> THE TOP ANGLE STICKS PAST. On a real gambrel the shallow upper panels are cut longer at the gable end than the steep lower ones, so the rake edge does not run as one straight line -- it steps out about an inch and a half where the two meet. Alan photographed the step. The model was giving every segment the same overhang, which is the one thing that reads as drawn rather than built when you look at a barn roof end-on.

> A CAP GOES WHERE THE ROOF PEAKS, AND NOWHERE ELSE. Alan, with photographs of a lofted barn roof going on: "there is no ridge cap on secondary peaks, of the middle peak". A gambrel has three ridges to look at and only ONE of them is a ridge -- the two breaks halfway down are just a bend in the same sheet, ribs and all, and this was capping all three. A real peak has the roof rising into it on one side and falling away on the other; a break has it rising on both, or falling on both.

> Painted steel is semi-gloss. At spec .15 / gloss 26 the sun smeared a wide dull sheen across the seams and a black roof came out looking like a hole with khaki dashes on it. Narrow and brighten the highlight and the standing seams pick out the way they do in the yard photos.

> WHAT YOU SEE OF THE LIP IS ITS UNDERSIDE, not its face -- in his photo the cut edge is a good deal darker than the pan above it, and the rib tabs darker still. Painting it the same near-white as the rake made every tab a little bright square.

> the lap's own shadow is a different animal from the eave's -- a quarter inch of standoff, not four inches of overhang, so it is a hairline, not a band

> WHICH EAVES ARE BARE METAL. Alan: "add it to every building" -- and his own gallery bears it out. On the utility sheds and the garages the sheet overhangs the wall with nothing across it at all, scalloped edge and a shadow under it, exactly like the barn; the cream board this used to draw there was invented. Two keep a board and are left alone: the single slope, whose photo shows a proper boxed eave with a soffit under it, and the cottage, whose level board he specified himself off a photo of a real one. Declared HERE, above the segment loop, because that loop reads it.

> THE UPPER SHEET LAPS OVER THE LOWER ONE AT THE BREAK. Alan's photograph of a lofted barn roof shows it plainly: the shallow upper panel does not bend into the steep lower one, it stops a few inches down the lower slope with the same scalloped cut edge, and the lower sheet runs up underneath it. This drew the whole gambrel as one folded sheet, so the break was nothing but a change of angle -- no line, no shadow, nothing to say two sheets. LAPL is how far the tail runs past the bend; LAPO is one sheet's thickness, which is all that separates the two pans.

> THE COTTAGE OVERHANGS ARE NOT EQUAL (Alan, Aug 2026, with the two sides labelled on a screenshot of this very designer): 8 inches at the FRONT and 4 inches at the BACK, both measured horizontally, and nothing on the gable ends. It used to be 9 in all round, and 12 on one side once the roof became a saltbox -- too much, and in the wrong proportion. WHICH WALL IS WHICH is settled by where the doors go: Alan, in the same exchange, the doors and windows go on the front side. The standard loadout puts them on the R wall, which is +x, so FRONT is P[last] and BACK is P[0]. Do not try to read it off the screenshot instead -- the view can be rotated, and the two readings disagree.

> THE OVERHANG IS LEVEL AND ENDS SQUARE (Alan, Aug 2026, circling both eaves on a screenshot: "they are straight 90 degree with the wall"). His photo of a real one shows it plainly at the corner -- the cream eave board runs out HORIZONTALLY past the wall and is cut off square, it does not carry on down at the roof pitch the way every other style here does. So the cottage gets an extra profile point at each eave, level with the wall top, instead of the endpoint being pushed along the slope.

> THE ROOF LINE IS STRAIGHT FROM THE TIP TO THE PEAK, and the tip sits at the fascia over a level soffit -- see cottageEave, which both this and the gable end fill go through so they cannot draw different roofs.

> raised panel ribs every 9 inches — real geometry, so they catch sun and read from any distance. They run all the way to the ridge and finish UNDER the cap -- Alan's photograph of a real one shows the ribs going under and the cap riding on top of them, where this used to stop them half a foot short and lay the cap down in the flat.

> AND NOTHING SETS THEM BACK AT A BREAK. Alan, with the stacked panels photographed: the ribs run straight over the bend. Half an inch either side left a dashed line of little gaps along it.

> CLOSE THE END WHERE A LAP CUT IT SHORT. Everywhere else something covers the open end of a rib -- the ridge cap at a peak, the edge band at an eave -- but where the upper sheet's tail stops these, the hollow faces up the slope and reads as a dashed line of little dark notches across the roof.

> SCREWS, one per pan, a row about every two feet of slope where the purlins are. Rows of dark screw heads down a steel roof is the single thing that says "steel roof" from across the yard, and Alan photographed them plainly -- this roof had none at all.

> fascia caps front/back: roof metal covers 2/3 of the end trim, 1/3 white reveal

> THE FASCIA AT THE EAVE IS 4 INCHES DEEP on a cottage (Alan, Aug 2026, who drew the eave in section: down the slope, a 4 in drop, then 8 in of soffit back to the wall). The strip runs from e[1]-drop up to e[1]+th, so the drop is 4 inches LESS the roof slab. Everything else keeps the 0.24 that works out at about 6 inches.

> ...and here is that tail. It belongs to the upper sheet, so it runs to the upper sheet's rake length (zFu/zBu) and carries the ribs for its own few inches, while the lower sheet's ribs have already stopped under it. It lifts off the lower pan over its length, from a hair at the bend to one sheet at the cut, which is what a bent sheet actually does.

> THE CUT END OF A CORRUGATED SHEET IS CORRUGATED, so the bottom of the roof is not a straight line. Alan circled one on a photograph: between the ribs the edge runs straight, and at every rib it steps out a tab as deep as the rib is tall. This was one flat band the length of the building, which is the giveaway on any metal roof -- a real one scallops, and the scallop is what tells you the roof is a folded sheet and not a painted board.

> WHAT YOU SEE OF THE EDGE IS THIN. On the real one the sheet's own edge is a bright line about an inch deep and everything under it is the shadow of the overhang -- his photo has the wall going dark right at the metal. This band has to be as deep as the roof slab or the eave opens up, so the slab's face is painted as that shadow instead of as more roof, and only the top inch of it is metal.

> ...and only the SHEET steps out at a rib. What is under it is framing in shadow, which runs dead straight, so the skirt's bottom edge stays put and only its top follows the corrugation up. Move the whole band and the eave castellates like a battlement.

> THE SOFFIT UNDER A COTTAGE EAVE -- level, from the back of the fascia to the wall, the second half of Alan's blue section. Without it the deck runs above the wall top with nothing closing the gap, which is a slot of sky along the whole eave from any low angle.

> AND CLOSE BOTH ENDS OF IT. Roof over, soffit under, fascia outside, wall inside -- and open at the two gable ends, where a 3/4 view looks straight into it and sees sky. The real one has a board across there.

> THE CAP RIDES ON TOP OF THE RIBS. Alan circled it on a photograph: the ribs run up under the cap and the cap sits on their crests, so it stands off the flat of the panel and throws a line the length of the roof, with the rib gaps dark underneath it. It used to be laid down IN the flat, half an inch off the deck, which is why it read as a painted stripe.

> u across the cap (0 at the crown, 1 at the edge) and v along the ridge, so the roll marks run gable to gable the way they do on the real sheet.

> AND IT IS SCREWED DOWN. A row of them either side, one at every rib, because that is where there is something solid under the cap to bite into -- the same reason the ribs run under it in the first place.

> CLOSE THE TWO ENDS, ALL THE WAY DOWN TO THE PAN. Standing the cap up on the rib crests opens a slot under it at the gable, where the ribs have already stopped -- his own gable-on test found eight pixels of daylight through the building there. A real one gets a closure across that end; so does this, from the cap down to the deck.

> one continuous mitered rake board + metal rake trim covering 2/3 of it

Short notes in the same function that also say how the real building is
(kept word for word in the code too):

> gambrel (barn/lofted) roofs: metal wraps a near-flush edge

> 4-inch eave over the door, flush at the back

(the lean-to)

> single slope: deep eave shading the tall door wall

> eave edge strips at the low outer edges (metal on gambrel — no trim across the side wall)

> close the tail at both gable ends, or you look into the quarter inch between the two sheets from anywhere off the end

And from the call in `buildShed` (lines 4035-4038), kept above the call in
`build()`:

> NO OVERHANG ON THE GABLE ENDS for a cottage (Alan, Aug 2026) -- 0.03 is the same nothing the Garden Utility uses, enough to keep the roof edge off the wall plane without reading as an overhang. It was 0.70, an 8 inch rake.

## Kept quirks

* **A gambrel's rake overhang is forced to 0.10** inside `profileRoof`,
  whatever the construction or the caller says (the 0.12 default only ever
  applies to lean-to roofs).
* The rake extents are deliberately three: `zF/zB` (the eave edge and the
  boxed fascia), `zFi/zBi` per segment (the gambrel's upper segments use
  `zFu/zBu`), and `zFu/zBu` (the ridge cap, the lap tail). Unifying them loses
  the 1.6 in step or opens gaps.
* `profileYat(P, x)` returns the FIRST point's height for an x outside the
  profile; the cottage's front soffit end board asks at `eN.x + 0.02`, outside,
  and gets the back tip's height -- right only because both tips are raised
  by the same fascia.
* The cottage soffit is at `prof[0][1]` (the ORIGINAL profile, the wall top),
  not the eave-extended copy `P`.
* Ribs overshoot a CUT eave by 0.02 along the slope -- every roof whose eave
  is a bare cut edge, the barn (gambrel) roofs included (`eA=(cutE&&i===0)`,
  and `cutE` is only false on the cottage and the single slope, whose ribs
  stop flush under the fascia); ribs at a peak stop 0.055 short (hidden by
  the 0.52 cap); screws exist as geometry AND as painted dots in the texture.
* `mat("roofEdge")` is made early on a gambrel (as `mE`) but inside the
  segment loop on every other roof (as `mEg`); the dark eave shadow skirt is
  painted as shadow, with only its top inch metal.
* The winding of every quad is deliberate (mirrored front/back fascia quads,
  the two ridge-cap sides, `eaveEdge`'s `rev`, the lap closures' `ab`); the
  back of a triangle is invisible.

## How to change it safely

1. Read this skill and the comments in `parts/roofing.js` first.
2. Run `node tools/check-golden.mjs --part roofing` before and after. It must
   stay green on every building. Every number in `profileRoof` is
   look-defining; so is the ORDER of the `kit.mat` calls (first call wins,
   and it sets the draw order).
3. To change an overhang for one company, change its construction
   (`roof.shapes.<roof>.eaveOverhang` / `rakeOverhang`, `roof.cottageEave`),
   or a style's `rakeOverhang` trait -- not the code. The framing parts read
   the same settings, so the roof and its framing stay in step.
4. Changing a stage (`roofing` / `trim`) changes no triangle, only the
   Framing and Watch-it-build views.
5. If the finished look must really change, re-record the golden fixtures on
   purpose (`node tools/capture-golden.mjs`, with a reason in the commit),
   and list anything that is not Barnwright's in `docs/DIFFERENCES.md`.

## Checks that guard it

* `node tools/check-golden.mjs --part roofing` -- every roofing triangle of
  the 148 recorded Barnwright buildings, number for number (347,528
  triangles, Sep 26 2026), plus the part drawn on its own and with the
  framing added. It does NOT compare the materials: `--part` skips the
  whole-building comparison.
* `node tools/check-golden.mjs` (no `--part`) -- once no part is pending, it
  also compares every material's settings (texture, tint, shine) and the draw
  order, which is where a reordered or re-painted `kit.mat` call in this part
  would show. Run this one too.
* NOT checked by either: the building step (the 9th number) -- the golden
  check drops it. `tools/check-framing.mjs` proves this part draws no
  FRAMING step, but nothing checks which of its two finish steps (`trim` or
  `roofing`) a triangle gets, beyond `tools/check-framing-roof.mjs` reading
  the roof underside at `roofing` (below). If you move a board between the
  two, count them again by hand (Sep 26 2026: 1,600 triangles in the `trim`
  material and the 40 cottage-soffit triangles are `trim`; all other
  347,528 - 1,640 are `roofing`).
* `node tools/check-framing-roof.mjs` -- the roof framing fits under the roof
  AS THIS PART DRAWS IT: it finds the roof from the `roofU` triangles at stage
  `roofing` (so the cottage soffit, stage `trim`, is not mistaken for the
  roof). It does not vary the eave, rake or cottage-eave settings.
* `node tools/check-model-live.mjs` -- the rake overhang each style gets
  equals what Barnwright's page hands `profileRoof`; `cottageEave` and
  `profileYat` equal the page's.
* `node tools/check-construction.mjs` -- the library's roof block equals
  Barnwright's numbers (`DEFAULT_ROOF`).
* `node tools/check-parts.mjs` -- a valid part with a caption and this skill.
* `node tools/check-imports.mjs` -- loads in Node with no browser.
