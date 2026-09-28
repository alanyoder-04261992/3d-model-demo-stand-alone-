---
name: part-floor-frame
description: The floor frame (joists, rims and end joists on the skids) of a portable building, and the shared framing kit the other framing parts use -- read before changing joist size, spacing or layout, or any framing helper in parts/floor-frame.js.
---

# Floor frame (`parts/floor-frame.js`)

The lesson-only `ui/learn-wood.js` finish uses the shared `floorWoodTexture`
RGBA generator: eight seeded grain/end-grain variants with different knot
counts and positions. A stable per-board hash varies the texture scale,
offset and tint. Browser and static model renders use the same pixels and
texture coordinates, so camera changes and checkbox toggles do not
re-randomize a board. This changes material and texture coordinates after
assembly; vertices, normals and stages remain unchanged. Alan confirmed treated wood for the
skids and later for the discussed floor joists, outer boards and end boards.
His later finish request is for varied grain and knots so boards do not all
look alike; use deterministic per-board variation. This does not confirm
deck treatment, wood species, grade or treatment chemistry.

## Confirmed connection for the opt-in floor lesson

Alan's September 27, 2026 description and supplied photos identify the
crosswise members as nominal **2x6**, actual **1 1/2 x 5 1/2 in**. They sit
**1 in down in notches** cut into the tops of nominal 4x6 skids, actual
**3 1/2 x 5 1/2 in**, each **16 ft** long in this example. The photos
corroborate the connection; dimensions come from his words, not pixels.
Do not publish the photos.

He confirmed **16 in on center standard** and extra skid notches for the
**12 in on center option**. The purpose of unused cuts is settled; the
repeated-notch first-center placement and notch cut clearance remain pending, as
do skid count, outer-board height and length, and full-frame length. Alan clarified skid placement
as 30 in from the outside wall to the inside skid face, toward the floor's
middle. A 3 1/2 in skid puts its center 28 1/4 in from that wall and the
current pair 63 1/2 in apart across the nominal 10 ft width. The pair's
count is still provisional. Do not infer the remaining details from the
nominal footprint. **Skids**, **notches** and **floor joist** are confirmed
terms; **outer board** is Alan's confirmed wording for each long side
board. **Rim joist**, **end joist** and **floor frame** remain proposed.
Alan has since confirmed **Flooring** for the sheets; “floor decking” is
a reference label for that part.

Alan accepted the skid render (“Ok looks good now the next part”), then
explicitly answered **“Yes—floor joist”** on September 27, 2026 for the
regular crosswise 2x6 seated 1 in down in the skid notches. He later
confirmed the outside floor width as 10 ft, with a 1 1/2 in outer board on
each side and joists 3 in shorter than the width. Their **117 in / 9 ft 9 in
length is derived** as `120 - 1.5 - 1.5`, not a separate field measurement.
The frame-inspection view is `learn.html?company=learning-side-loft&step=frame`,
showing the complete floor frame on the skids, including outer/end boards.
Alan has also confirmed a **flat treated 2x4** behind the doubled end
boards toward the inside, resting on the skid tops. Alan confirmed it is
**93 in long**, and says the mule hooks onto it to drag the barn. Use the
descriptive label **Board the mule hooks onto**; its current lateral
centering is not confirmed.
It starts with an angled overview; the connection button opens the close-up.
Keep sheets, walls and roof out of that frame-inspection view. The current
flooring lesson uses `?step=deck` to add sheets over the same unchanged
frame. The earlier
`?step=joists` view still isolates regular joists. Continue only as Alan
directs; the render acceptance does not settle
unrelated assumptions or authorize autoplay.

The [joist picture page](../../../joists.html) addresses the visibility
report with labeled model renders:
[overview](../../../images/floor-joists.png),
[connection](../../../images/floor-joist-connection.png) and
[board the mule hooks onto](../../../images/floor-end-backing.png). The page needs no
JavaScript. These images are generated from the current model geometry;
refresh all three after geometry edits with `node tools/export-joist-render-data.mjs`
then `python tools/render-joist-picture.py` (Pillow and NumPy are development
dependencies only). The renderer accepts font overrides; inspect labels after
changing fonts. They do not publish Alan's reference
photos or confirm first-joist position, outer-board height/length or
full-frame length. Browser
tooling was unavailable for this visibility fix, so do not describe it as
browser-verified.
The flat treated 2x4 close-up should show its top-of-skid seating, 3 1/2 in
horizontal by 1 1/2 in vertical section and confirmed 93 in length, with
sideways centering still marked provisional.

The optional joists-only view calls `onlyFloorJoists` in
[floor-joist-lesson](../../../model/floor-joist-lesson.js). It retains the
existing triangles belonging to regular `kind: "joist"` members; it does
not rebuild their dimensions or change the shared full-frame part. Rims,
end members and wall-support members remain absent in that view. The
retained triangles keep their coordinates, normals, texture coordinates,
materials and stages.

The learning page opts into a `floorStudy` plan with those actual sections
and notched seating. Its crosswise members begin at the notch floor and keep
their full 5 1/2 in height. Do not shrink them into the old fixed floor
envelope. The normal finished reference keeps the legacy framing datums
documented below; this lesson does not alter every company's construction.
See [the agreement record](../../../docs/examples/10x16-side-loft.md).

The lesson calls [floorStudyPlan](../../../model/floor-study.js), reading
`construction.floorStudy` and adding `plan.floorStudy`. `floorPlanOf(plan)`
then uses its actual member section and `joistBottomFt` / `joistTopFt`.
Those values seat the member at skid height minus notch depth and keep the
full member height. Plans without that opt-in retain the legacy datums.
The lesson's skid offset is `floorStudy.skids.insetToInsideIn: 30`, with
`floorStudy.status.supportOffset: "confirmed"`; the legacy skid table stays
unchanged.

Alan also confirmed end notches running **3 in inward from one skid tip**
and **1 1/2 in inward from the other**, **both 1 in deep**, with the piece
beyond each cut kept at notch height. The lesson's
`floorStudy.notches.endRebates` uses `negative` for 3 in and `positive` for
1 1/2 in; these are display coordinates, not agreed front/back names.
Alan later explicitly confirmed **two boards at one end and one at the
other**, superseding the earlier one-board-at-each-end model. Fit the pair
of 1 1/2 in boards into the 3 in seat and the single into the 1 1/2 in seat.
The fit supplies display-coordinate mapping and touching-board placement;
it does not establish shop front/back names. `endBoardCounts` is confirmed,
while `endBoardMapping` and `endMemberPlacement` are derived. See the
[skid skill](../part-skids/SKILL.md) for the confirmed 45-degree bottom cuts,
each reaching 3 in back from its tip.

The opt-in schema is `floorStudy.frame` with
`{ widthFt: 10, sideBoardWidthIn: 1.5, treated: true, endCounts: { negative: 2, positive: 1 } }`.
Statuses `frameWidth`, `sideBoardWidth`, `frameTreatment` and `endBoardCounts` are confirmed;
`joistLength`, `endBoardMapping` and `endMemberPlacement` are derived.
Expand the frame's X width only; its Z footprint, repeated-notch grid and
first offset remain unchanged and provisional. The outer boards retain
their previous height and length assumptions: currently 15.94 ft long,
while the fitted end-board packages reach the 16 ft skid tips. These are
model extents, not a newly confirmed full-frame length. Optional decking
now covers the actual 10x16 ft frame envelope with the confirmed 4x8 T&G,
5/8 in layout described in the [flooring skill](../part-floor-deck/SKILL.md).
Sheet material/profile details remain unspecified. `frameFootprint` and
`rimSection` remain provisional. Aggregate `deck` also stays provisional;
its granular sheet/layout statuses identify the confirmed facts.
The normal designer is unchanged.

The flat treated 2x4 is an `end-backing` member in the full-frame lesson.
Its schema is `floorStudy.frame.backing`:
`{ nominal: "2x4", widthIn: 3.5, heightIn: 1.5, lengthIn: 93, end: "negative", treated: true, purpose: "mule-attachment" }`.
The 3 1/2 in dimension lies horizontally along Z, while 1 1/2 in is
vertical. It sits against the inside of the doubled end package, with
bottom at skid-top elevation **5 1/2 in** and a **calculated 7 in top**.
Do not lower it to the 4 1/2 in notch seat or add another notch.
`backingSection`, `backingOrientation`, `backingTreatment` and
`backingLocation` are confirmed, as is `backingLength` with Alan's **93 in**
reply. **7 ft 9 in** is the conversion; the former 117 in draft is superseded.
`backingPurpose` is confirmed; `backingLateralPosition` is provisional.
The model centers it laterally, leaving calculated 12 in gaps to the inside
faces of the outer boards, but those gaps are not approved shop dimensions.
Member metadata retains `lengthStatus`, `lateralPositionStatus` and `purpose`.
Negative
identifies the model's doubled end, not a confirmed shop front/back
direction. Use **Board the mule hooks onto** with Alan and describe it as
the flat treated 2x4 he identified. His stated purpose is attachment while
the mule drags the barn; do not infer hardware or a load rating.
`end-backing` is a code identifier, and “cleat” or “blocking” has not
been agreed. Keep this extra piece out of the optional regular-joists-only
view, and retain the normal designer's geometry.

Alan also confirmed the discussed nominal/actual examples by subtracting
1/2 in from each dimension: 2x4 → 1 1/2 x 3 1/2 in, 2x6 → 1 1/2 x 5 1/2 in,
4x6 → 3 1/2 x 5 1/2 in. Do not extend this to other unconfirmed sections.

## What it is in real life

The floor of a portable building is a frame of joists laid ACROSS the width,
supported by the skids that run along the length (seated in their notches
in the confirmed floor lesson): a rim joist down each long
side, an end joist across each end, and joists in between at the shop's
spacing on centre, measured from the back end. The tongue-and-groove decking
is nailed on top (part `floor-deck`). A wall that runs the same way as the
joists and stands on the floor away from its ends -- the side porch's S2/S3,
the corner porch's P3, the kennel's partition -- gets a joist of its own
under its bottom plate (doubled beside a layout joist when one is close),
the way a framer backs up a wall.

On a cabin with a FRONT porch (porch "F") or the corner porch ("C"), this
frame stops at the front wall (its front end joist is right under it); the
4 ft porch deck in front is framed by `porch-deck-frame`. A side porch and
the corner porch's run down the door side sit on this frame: the joists run
straight under the porch walls.

## Stage

Stage `floor-frame` (kind `frame`): Framing view only, never Finished; in
Watch-it-build it lands after the skids. PIPELINE: among the framing entries
(`parts/index.js`), run only by `assemble(plan, {frames: true})`, after every
finished part, so it can never change Barnwright's picture.

## Construction settings

The fixed height datum below belongs to the normal model's legacy path.

* `floor.joist` -- the joist size; a rule list, default 2x4 on 8 ft wide and
  smaller, 2x6 above. Its thickness is drawn (1 1/2 in).
* `floor.rim` -- the rim size (default 2x6).
* `floor.spacingIn` -- joists on centre, default 16. The option "Floor joists
  12 in on center" sets it to 12 (`rate.jo12` construction effect), and the
  drawing puts them 12 in apart and adds joists.
* `floor.deck.thicknessIn` x `floor.deck.layers` -- the decking on top; the
  normal model's joists are drawn that much shallower so the decking's top
  is y0. The opt-in lesson retains the confirmed 5 1/2 in member height and
  places sheets above it instead.
* `porch.joist` -- read here for the porch-deck part's joists.
* `walls.stud` -- its depth, to find the bottom plate of a cross wall.

## Where it came from in Barnwright

New -- Barnwright drew none. It fits into Barnwright's floor slab
(`buildShed` floor loop, `3ddesign.html` lines 3868-3877, pinned SHA-256
`0bdcf663c5cb988623d2cb0dd271156fb690564072b301b0a15b917fd921ac6c`; ported
in `parts/floor.js`): the slab runs from the top of the skids (y 0.5) to the
deck top y0 = 0.92 and is inset 0.03 ft inside the walls (0 on the kennel),
so the frame is inset the same (`floorInset`). docs/ARCHITECTURE.md "Framing
datums" 1: joists on the skids, drawn depth = 0.42 - deck thickness x layers.

THE FRAMING KIT lives in this file and is imported by the other framing
parts: `lumberSize` ("2x6" -> real feet, "doubled" -> plies), `FRAME_PAINT` /
`frameMat` (framing's own materials, never a finished bucket), the member
constructors `beamMember boxMember wallMember slabMember prismMember`,
`drawMembers`, `drawPrism`, the polygon helpers (`clipRect clipHalf
cleanPoly triangulate polyArea pointInPoly`), `floorPlanOf` (footprint, the
enclosed room, the porch decks, heights), `roomOutline` / `porchOutlines`,
`rectFrame` (one rectangular frame) and `crossWallPlates`. `WALL_INSET`
(0.02) and `PARTITION_INSET` (0.05) say where every wall frame stands.

## The owner's facts

These historical notes support the legacy defaults. The confirmed 16 in
spacing now also has a direct September 27 reply; the old layout's end offset
is still not an approved measurement for the current floor lesson.

* The shop's floor (Barnwright 2147-2150, kept word for word in
  `parts/floor.js` and here): "Floor: 2x6 joists on skids with 5/8" decking
  (8-ft-wide and smaller use 2x4 joists) -- that assembly is the 0.92 ft base
  line y0."
* Alan, Aug 2026: standard joist spacing is 16 inches on centre; the 12 in
  upgrade: "their less space from support under the floors so you are going
  have less waves in your floor if you are putting heavy items in the barn."
* Siding hangs past the wall bottom "to nail into the 2x6 rim" (Barnwright
  2153-2155) -- the rim this part draws.

## Kept quirks

These quirks belong to the normal model, not the opt-in floor lesson.

* The joists are drawn 0.42 ft minus the decking deep (about 4.4 in with one
  layer), not a real 5 1/2 in 2x6: the drawn floor height is Barnwright's
  (skids 0.5 ft, deck top 0.92 ft) and the framing fits into it. The caption
  names the real lumber.
  The exact depth is 4.415 in with one 5/8 in layer. This is historical
  reference behavior, not the corrected `floorStudy` member depth.
* The rims are not over the skids (neither are they on the real building);
  they are nailed to the joist ends -- the check treats them as fastened.

## How to change it safely

* In the opt-in lesson, check the 1 1/2 x 5 1/2 in member sections and their
  seating 1 in below skid tops, with no solid material left inside the slots.
  Keep spacing separate from the still-pending repeated-notch first-center placement and
  cut clearance. Check normal-model golden fixtures to preserve that path.
* A company's joists: change `floor.joist`, `floor.spacingIn`, `floor.rim` in
  its construction settings (or give an option a `construction` effect),
  never the code.
* The layout starts at the BACK end (-z) so 8 ft sheet joints land on joists;
  keep that if you touch `rectFrame`.
* The kit is shared: a change to `wallMember`, `drawPrism` or the polygon
  helpers moves every framing part. Run `node tools/check-framing.mjs` (all of
  it) and `node tools/check-golden.mjs` after any change here.

## Checks that guard it

* `node tools/check-floor-lesson.mjs` -- the opt-in frame spans 120 in,
  crosswise boards are exactly 117 in, and touching two/one end-board
  packages fit their seats. Skid geometry, notch grid and normal geometry
  stay unchanged; confirmed and derived statuses stay distinct.
* `node tools/check-floor-joist-lesson.mjs` -- regular joists match an
  independent member build across all eight manual selections; no rim,
  end or wall-support members leak into the focused view, and the source
  frame and other selected parts stay unchanged.
* `node tools/check-framing.mjs` -- on 956 buildings: joists on their
  floor.spacingIn marks from the back end with no wider bay, 12 in joists
  closer and more of them, every joist resting on a skid, nothing overlapping
  or outside the footprint, and the finished building untouched.
* `node tools/check-golden.mjs` -- drawing the framing leaves all 148 recorded
  Barnwright buildings exactly as they were.
* `node tools/check-parts.mjs`, `node tools/check-imports.mjs`.
