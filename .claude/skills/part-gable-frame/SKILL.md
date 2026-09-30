---
name: part-gable-frame
description: The gable-end framing and the opt-in lesson's gable board on the end upper plate. Read before changing the board's seating, ledges or projections, the learned gable studs, or framing around gable openings.
---

# Gable-end framing (`parts/gable-frame.js`)

## Learned rule when there is a real gable window

Alan added this rule after the gable-backing lesson: **move the gable studs
to the two sides of the window, then add horizontal 2x4s above and below
the opening to form a box**. He confirmed all four members have their
**3.5 in wide faces outward**, in line with the existing gable studs;
actual through-wall thickness is 1.5 in. The window's framing opening
controls the neighboring stud positions instead of the regular 24 in
marks. Do not leave a regular-layout stud crossing the clear opening.

Keep this learned assembly separate from the ordinary model's generic
king/jack/header rules below. Alan has not specified doubled members,
larger headers, fasteners, or a new name for the horizontal pieces.
The existing gable-backing rule omits the 11 in backing on this same end.
A fake window also omits backing, but its framing has not yet been
confirmed; do not infer a real opening or this box around it.

Alan clarified that window sizes vary: this is a parameterized rule, not
a request to stop for one fixed window measurement. The adjustable lesson
at `learn.html?step=truss&window=1` now accepts each selected clear opening's
width, height and position. Its starting dimensions and centered/auto-fit
placement are labeled examples, not confirmed shop measurements. Read the
[window-box skill](../part-gable-window-frame/SKILL.md) before editing it.
Use the upper-plate top as the bottom-height datum; the 11 in backing
height is not a window-placement rule. Do not scale windows with shed width.

Read [Shed measurements](../../../.agents/skills/shed-measurements/SKILL.md#gable-window-box-measurements)
for the parameter relationships. The nearest distinct regular stud pair
moves to the opening sides; any additional stud crossing the box is
removed. Unaffected studs retain their marks. Top/bottom pieces fit between
the side studs as a preview joint. Verify the clear opening stays empty,
the four outward faces align, moved studs still fit the board and truss,
and returning to no window restores the regular layout and backing.

## Gable backing added to the learned assembly

Read [the gable-backing skill](../part-gable-backing/SKILL.md) before changing
these horizontal 2x4 pieces. They fit between neighboring gable studs,
wide face outward, only when the selected gable has no window or fake window.
Their bottom is 11 in above the **upper-plate top**. With 24 in centers and
3.5 in outward stud faces, each current clear cut is 20.5 in. The backing
has its own part; preserve this part's existing members and fit.

## Alan's first gable piece: opt-in learning view

The manual 10x16 lesson at
`learn.html?company=learning-side-loft&step=gable` contains the existing floor,
one end wall and **one gable board**, Alan's confirmed name for the 2x6
along the upper plate. Do not substitute chord, rafter or header. The ordinary framing
described below is separate background and must not fill in the rest of the
gable during this step.

Alan confirmed on September 28, 2026 that the nominal 2x6 is **on edge along
and on top of the end wall's upper plate**. Its actual section is **1 1/2 in
through the wall depth by 5 1/2 in vertically**. His later request moves
it across the upper plate. He corrected the inside/outside names and then
explicitly said to **leave it in the new spot**. Do not move it back when
correcting labels. The ledge he calls **inside is 1/2 in**; the opposite
**outside ledge is a derived 1 1/2 in**. Extend it **2 1/2 in past both
cut ends of the upper plate**, along the wall, not upward. These facts
supersede the earlier face naming and initial ambiguity about an upright
stud or a vertical 2 1/2 in extension.

Derive dimensions from the actual supporting upper plate, never a second
10 ft constant:

- `board length = upper plate length + start projection + end projection`.
  Here `113 + 2.5 + 2.5 = 118 in`, or **9 ft 10 in**. Each board end stays
  **1 in short of the 120 in end-wall endpoint**, from `3.5 - 2.5`.
- `board bottom = upper plate top`; `board top = bottom + board height`.
  The top is **85 in above flooring**, from `79.5 + 5.5`, or **95 5/8 in
  above skid bottom** in the current floor model. These are different datums.
- `opposite ledge = plate depth - selected ledge - board thickness`.
  For the corrected names, the outside ledge is a derived
  **1 1/2 in**, from `3.5 - 0.5 - 1.5`. Specify the ledge side explicitly;
  do not infer it from the camera. The half-inch offset does not scale
  when changing building size.

Alan named it **gable board** and confirmed it is **nailed to the upper
plate**. His September 29 correction places the **truss against the board’s
front face**, with its lowest tips level with the upper-plate top. Nail
size/count/spacing, treatment, species and grade remain unconfirmed.
Do not inherit the floor timber's treatment.
Show varied wood grain as a visual finish without treating it as a material
specification. Keep the private photo out of tracked files and published
assets; do not derive dimensions from its pixels. See
[the example](../../../docs/examples/10x16-side-loft.md#first-gable-piece--september-28-2026)
and [measurement workflow](../../../.agents/skills/shed-measurements/SKILL.md)
for provenance and reuse at another size.

### Lesson inputs and geometry

The learning company's `construction.gableStudy` record is:

```js
{
  board: { nominal: "2x6", thicknessIn: 1.5, heightIn: 5.5 },
  ledgeEdge: "wall-line", ledgeSide: "inside", ledgeIn: 0.5,
  endProjectionIn: { start: 2.5, end: 2.5 },
  placement: "on-upper-plate",
  status: {
    section: "confirmed", orientation: "confirmed", placement: "confirmed",
    ledge: "confirmed", ledgeSide: "confirmed", ledgeEdge: "confirmed",
    endProjection: "confirmed",
    name: "confirmed", treatment: "provisional"
  }
}
```

Activate with `gableStudyPlan(endWallPlan, { gable: true })` in
[model/gable-study.js](../../../model/gable-study.js); its default flag is
false. First obtain the existing floor study and an end wall study. Company
settings alone must not activate this lesson in the normal designer.
`gableStudyMembers(plan)` in this part returns the single board, and
`gableStudyMeasurements(plan)` in
[model/gable-measurements.js](../../../model/gable-measurements.js) supplies
member-based dimensions and anchors. Preserve the existing floor, wall
members and ordinary finished geometry. For another size, resolve the real
end upper plate first; do not keep 118 in as a universal board length.

Physical placement and ledge names are separate. `ledgeEdge = "wall-line"`
means local wall offset zero; `"opposite"` means offset `-plate depth`.
With the selected edge at wall-line, the board's normal offsets are
`[-ledge - board thickness, -ledge]`. With the opposite edge selected,
they are `[-plate depth + ledge, -plate depth + ledge + board thickness]`.
`ledgeSide` names the selected gap using Alan's terms; renaming it must
not change geometry. For this corrected gable, wall-line is the half-inch
gap he calls inside. Derive the other gap from the actual sections. Keep
this convention scoped to the gable connection; do not relabel the skid
or ordinary wall coordinate system.

### Lesson checks and pictures

Run `node tools/check-gable-lesson.mjs` for section, measured lengths,
projection at each end, face-to-face ledge, plate-top seating, opt-in
behavior and unchanged preceding assemblies. The normal model is guarded
by the existing framing and golden checks below. A passed geometry check
does not establish a physical cut list or unknown fastening rule.

Refresh the model pictures with:

```text
node tools/export-joist-render-data.mjs --gable
python tools/render-joist-picture.py --gable
```

The [gable picture page](../../../gable.html) uses
[the overview](../../../images/gable-framing.png) and
[the close-up](../../../images/gable-board-detail.png). Inspect both:
dimension endpoints must land on the actual upper-plate cuts, board ends
and the selected plate and board faces; the 1/2 in ledge must be distinguishable from the 2 1/2 in
end projection. Retain the earlier plain-wall and floor views. If browser
checks cannot run, report that limitation separately from static-picture
and geometry checks.

## Truss and gable studs: opt-in fit preview

Alan's September 29 correction supersedes the earlier top-bearing fit:
**the truss goes against the broad face of the gable board facing the
viewer in the connection picture** (the room-facing face in this model).
He explicitly confirmed that the **lowest truss tip is level with the
upper-plate top**. The **48 in peak height starts at that same upper-plate
top**, not the gable-board top. Thus the peak is `79.5 + 48 = 127.5 in`
above flooring, or `48 - 5.5 = 42.5 in` above the gable board.

The truss is actual **1.5 x 3.5 in** (nominal 2x4). Keep the **54 in upper**
and **37.75 in lower** longest-point lengths. The **6.25 in** projection
runs along the wall from the **upper-plate cut end to the farthest truss
tip**. It is a separate horizontal dimension, not the height or a sloping
length. Mirroring it at both ends remains provisional; this gives
`113 + 6.25 + 6.25 = 125.5 in` tip-to-tip. The gable board remains 118 in
long, on edge above the upper plate. After the other-side correction it
keeps the new physical position, with Alan’s corrected labels: a 0.5 in
inside ledge and a derived 1.5 in outside ledge, with
2.5 in projections unchanged.

Alan’s later blue line confirms that the **whole bottom cut of the truss
is level with the gable-board bottom**, which is the upper-plate top.
Both corners of that cut use the same elevation. This replaces the earlier
square-to-stock tail assumption; shared knee/peak miters remain provisional.
Solve the slopes from the farthest tail point on that horizontal datum;
do not impose the superseded gable-board top-corner bearing constraint.
Place the truss's back face against the board's shown face, with no solid
overlap. Do not add a notch or infer a fastening schedule.

Gable studs remain **on the gable board**, **24 in on center**. Alan
confirmed nominal **2x4**, actual **1.5 x 3.5 in**, with the **3.5 in face
outward**. Hook the tape at the **outside edge of the end wall**. The
current preview reads his reply “centered” as centering the first stud on
the **24 in mark**. That first-center interpretation remains provisional;
the wall-end datum, section, outward face and spacing are confirmed.
On the 120 in end wall this produces four centers at **24, 48, 72 and
96 in from that wall edge**, not a forced stud under the peak.

For another size, use inches consistently and calculate
`centerX = wallEndX + direction * (firstCenterIn + n * spacingIn)` for
integer `n >= 0`. `direction` is +1 from the starting end or -1 from the
opposite end; store the chosen end and first-center offset separately.
Use `spacingIn = 24` and preview `firstCenterIn = 24` for this example.
Keep the outside-wall datum: the upper plate starts 3.5 in inward and
the gable board starts `3.5 - 2.5 = 1 in` inward, so the first stud is
**23 in from the gable-board end**. Include only whole-width studs that
fit the gable board and roof. Do not center the pattern on the peak or
scale the first offset when changing wall width. In this model use
`studs.layoutOrigin = "outside-end-wall"`, `layoutFrom = "start" | "end"`,
`firstCenterIn` and `spacingIn`; anchors and measurements come from the
same member layout.

The exact top fit remains provisional. The preview puts their fronts
against the truss backs and clips their tops to the outer roof outline,
giving a face joint behind the truss. This replaces the earlier coplanar
underside joint; it is not a confirmed stud cut list. Show this fit choice
and the first-center interpretation for Alan to check.

Preserve the earlier lessons and ordinary finished model. Keep original
photos private; do not derive lengths or angles from pixels. Treatment,
species, grade, fasteners and lengthwise truss spacing remain unspecified.

`trussStudyPlan(gablePlan, { truss: true })` in
[model/truss-study.js](../../../model/truss-study.js) explicitly enables
the preview; this part adds `trussGableStudMembers(plan)` to its existing
gable board. `trussStudyMeasurements` supplies matching member dimensions
and anchors. Run `node tools/check-truss-lesson.mjs` and inspect
[the truss picture page](../../../truss.html). Keep `?step=gable` board-only,
the earlier lessons and the ordinary finished geometry unchanged. Keep
the original photos private.

## What it is in real life

This section describes the ordinary model. The learned assembly above has
its own confirmed gable-board and gable-stud rules.

Each gable end of the roof is closed by a gable-end truss sitting on the end
wall: the end truss's chords (drawn by `parts/roof-frame.js`, flush inside
the gable siding) and, between them, upright GABLE STUDS the siding is nailed
to. This part draws:

* gable studs, the same size and the same way round as the wall studs (thin
  side across the building, deep side into it), every `walls.spacingIn` on
  centre ON THE SAME MARKS AS THE END WALL'S OWN STUDS (`wallRuns` in
  `parts/wall-frame.js`: from the -x corner on the F end, the +x corner on
  the B end, since a wall's layout runs to the right seen from outside), so
  every gable stud stands over a wall stud and the siding sheets land on
  both -- over a porch, the enclosed end wall's marks;
  standing on the end truss's bottom chord (on the end wall's top plate when
  the roof is framed with rafters) and cut off under the end truss's top
  chord -- cut with `model/roof-shapes.js` `gableClip` against the chords'
  underside, so a stud can never poke into the chord or the roof; a stud tight
  in each corner where the gable has any height there (the cottage);
* round every opening in the gable -- a gable window (the octagon, the 18x24),
  the gable vent, and a door (or window) on the end wall that rises past the
  wall top into the gable (the Standard Barn's door does): KING studs each
  side; a HEADER on JACK studs -- the `walls.header` rule's size for its
  width, and when that does not fit under the top chord the next size down,
  then a flat 2x, exactly as a wall header is fitted (`fitHeader` in
  `parts/wall-frame.js`); only when not even a flat 2x fits does the top
  chord itself span the opening, with the kings run up to it; CRIPPLES over
  the header; a flat SILL under a window or vent when there is room above the
  chord, with cripples under it. Openings whose framing would touch are
  framed as one. A gable window dragged toward an eave runs up into the top
  chord on its low side: it is still framed (the chord closes that side, and
  a king there is only as tall as the room under the chord). Each opening
  member carries `opening` (what it frames), `openingAt` (the rough
  opening's left edge, so two octagons on one end are told apart) and
  `kindOf`.
* Where a window or door dips into the end truss's bottom chord, the chord is
  cut there (roof-frame cuts it at the same place -- both read `gableOpenings`)
  and the opening's framing stands on the end wall's top plate instead. For a
  door rising out of the end wall, the wall framing (`parts/wall-frame.js`)
  stops its kings and jacks under its top plates and this part carries them
  on up and puts the header in the gable.

The faux loft window is trim nailed to the siding, not an opening: nothing is
framed round it. An opening whose framing would not fit inside the gable's
framing (out past the walls, or wholly above the top chord) is not framed.

## Stage

Stage `roof-frame` (the gable-end truss is part of the roof framing, kind
`frame`): hidden in the Finished view, shown in the Framing view, and in
Watch-it-build it lands with the roof framing and is hidden once the roofing
lands. PIPELINE entry `gable-frame`, among the framing entries (only with
`frames: true`), just before `roof-frame`. Material `lumber`.

## Construction settings

* `walls.stud` -- the gable studs' size (thin side across, deep side into the
  building), default `2x4`.
* `walls.spacingIn` -- gable stud spacing, default 16, on the end wall's own
  layout marks.
* `walls.header` -- the rule list by opening width (`maxSpanFt`): 2x6 doubled
  up to 4 ft, 2x8 doubled to 6.5 ft, 2x10 doubled beyond; a header that does
  not fit under the top chord steps down a size at a time (same plies), then
  to a flat 2x; only when none fits does the chord span the opening. The
  Standard Barn 8x12's 48 in door gets a doubled 2x6 this way (the 2x8
  doubled its width asks for does not fit).
* `roof.framing` -- with `"truss"` the studs stand on the end truss's bottom
  chord; with `"rafter"` on the end wall's top plate, and under a ridge board
  they stop under it.
* `roof.chord`, `roofDeck.*` -- where the end truss's chords are (roof-frame).

## Where it came from in Barnwright

New -- Barnwright drew none. It fits behind the gable fill Barnwright draws
(`buildShed` 3962-3979, `parts/gable-siding.js` `gableFill`), round the
openings it draws: the gable windows (`renderGableWin` 3575-3705, clipped with
`gableClip` 2204-2213, rectangles from `model/layout.js` `openingRect`), the
vent (4002-4013, `parts/gable-vent.js` `ventSpot`), and the end-wall doors
that "rise into the gable up to the roofline" (`renderItem` 3175-3188).
`public/3ddesign.html` pinned SHA-256
`0bdcf663c5cb988623d2cb0dd271156fb690564072b301b0a15b917fd921ac6c`.
The openings are gathered by `gableOpenings` in `parts/roof-frame.js`.

## The owner's facts

* A door on an end wall rises into the gable up to the roofline, and its
  header casing always stops just under the gable band (Barnwright's door
  clamps, 3175-3188) -- which is why the Standard Barn's door needs framing in
  the gable at all.
* The 18x24 gable window does not fit the gable of ANY 8 ft wide shed; the
  window stays where a window belongs and whatever rises above the roof line
  is clipped, as the roof trim would cover it -- so its framing uses the top
  chord as its header when no header fits.
* The octagon is 18 in of window plus 0.4 ft of trim each side; its rough
  opening here is the 18 in window (`openingRect`'s clear opening).
* The faux loft window is 2.6 x 1.9 ft of trim (no opening).
* Studs are 2x4, 1 1/2 in by 3 1/2 in; loft studs 75 in, tall-wall studs
  89 in (`library/construction.json`, caption only).

## Kept quirks

* A gable window sits wherever the finished drawing puts it (the floor of the
  gable wins, the roof line clips it), so its bottom can be only 0.14 ft over
  the wall top -- lower than the end truss's bottom chord. The chord is then
  cut under it, as a real framer would on a gable end that sits on its wall.
* Kings are clipped to the chord's underside, so beside a window near the
  eave they can be short.

## How to change it safely

1. Read this skill, `part-roof-frame` (the hub it reads) and
   `docs/ARCHITECTURE.md` "Framing datums" 3.
2. Change spacing, stud size or the header rule in
   `library/construction.json` (or a company's `construction`).
3. If you change which openings are framed or how, change `gableOpenings` in
   `parts/roof-frame.js` -- the end truss's bottom-chord cuts read it too, and
   the wall framing hands door framing over to it at the wall top.
4. Run `node tools/check-framing-roof.mjs`, `node tools/check-framing.mjs`,
   `node tools/check-parts.mjs` and `node tools/check-golden.mjs`.

## Checks that guard it

* `node tools/check-framing-roof.mjs` -- every gable stud and opening member
  inside the roof as drawn, no overlaps (with the end truss, the loft, the
  deck), every framed gable opening with a king each side (or the top chord
  closing that side near an eave) and a header on two jacks wherever even a
  flat 2x fits under the chord (worked out from the drawn roof, not from this
  part's sums), nothing framed across a gable window's clear opening --
  including every gable window dragged as far as the designer lets it go
  toward both eaves, up and down -- every gable stud on its end wall's stud
  layout, the part draws exactly its members in stage `roof-frame`.
* `node tools/check-framing.mjs` -- region, overlap with the wall framing,
  bearing (every stud stands on the chord or the plate).
* `node tools/check-parts.mjs` -- valid part, caption, this skill.
