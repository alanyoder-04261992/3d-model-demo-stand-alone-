---
name: shed-customer-setup
description: Set up a shed company or an individual buyer's design in the 3D stand alone repository, and learn or agree on building terms using the visible 10x16 Side Lofted Barn example. Use when Alan asks to onboard a designer customer, start a shed design, or clarify what a building part is called.
---

# Shed customer setup

Work in this repository. Start with the relevant entries in
[the building terms](../../../docs/BUILDING-TERMS.md) and
[the 10x16 Side Lofted Barn example](../../../docs/examples/10x16-side-loft.md).
These hold the confirmed vocabulary, proposed labels and first worked example;
refer to them instead of copying the glossary into each customer's files.
For a different building size or an explanation of how the measurements
were calculated, use [Shed measurements](../shed-measurements/SKILL.md).
It separates reusable formulas from this example's fixed dimensions and
records the settings that must be reconsidered together when resizing.
For Alan's loft sizes, 12-wide means an actual 134-inch width (11 ft 2 in).
Use the measurement skill's discrete truss table: upper 34 in for 8-wide,
54 in for 10/12-wide, lower 37.75 in for all three. Peak heights from the
upper-plate top are 43.75 in for 8-wide, 48 in for 10-wide and 51 in for
12-wide. Other widths do not inherit these measurements; confirm missing
actual widths and tip projections before fitting a full truss.

## Choose what is being set up

- A **shed company or dealer buying the designer** gets
  `companies/<id>/company.json`. Reuse the existing company when updating it.
  Follow the relevant steps in [new-company](../../../.claude/skills/new-company/SKILL.md).
- A **person buying a shed** gets a design within their dealer's existing
  catalogue. Select the style, size, colours and openings, then save or share
  the design using the existing designer. Do not create a new company for
  each shed buyer.
- A **learning exercise** can start at
  [the manual floor page](../../../learn.html),
  `learn.html?company=learning-side-loft` after `npm run serve`. Alan's latest
  request is to build a floor first, then build step by step; this supersedes
  his earlier choice to begin with the finished building. The example is the
  10x16 Side Lofted Barn (`SLB`), with prices hidden and quotes off. Its regular
  designer at `/?company=learning-side-loft` is a finished-model reference.
  This example is not a customer's price book.

Use facts already provided or recorded. Ask only for missing information that
affects the current result; a learning exercise does not need a complete
company intake. Preserve the user's selected scope and view choices.

## Learn the terms together

For Alan's doorway lesson, read
[its construction guide](../../../.claude/skills/part-doorway-frame/SKILL.md)
and [adjustable preview](../../../doorway-framing.html). His **king stud**
means the support under the header beside a full-height **stud**, seated on
the bottom plate. Preserve these shop terms even though legacy code calls
that support a jack. Header cut is opening width plus 1.5 in at each end.
Use the selected king cut and actual wall height for the loft-header,
stacked-flat-header or to-top-plate arrangement. Carry these rules only
within the builder's confirmed scope, without fixing a doorway size.

For the **lofted-wall window** lesson, use
[the header skill](../../../.claude/skills/part-window-header/SKILL.md) and
[phone-friendly detail](../../../window-framing.html). Alan confirmed
**window plate** (flat 2x4 below the opening), studs underneath it, and
**window header / loft header** (two touching 2x4s on edge on a flat 2x4,
outside half-inch ledge, against the top-plate underside). These are
lofted-wall rules, not assumptions for every new company or wall type.
The [window-plate skill](../../../.claude/skills/part-window-plate/SKILL.md)
records his later confirmation: supporting studs stand on the bottom plate
and keep the wall's 16-inch layout. The lesson now draws that lower assembly
with an adjustable clear window height. Continue learning side supports
and opening-width allowances without demanding one fixed window size.

Follow the user's latest learning direction and show the relevant view,
including an incomplete assembly when requested. During terminology learning,
discuss one physical part at a time. Locate it in plain visual words before
naming it: its position, appearance, and a nearby feature Alan can see. Point
it out or annotate the view when the available tools make that useful.

For the current floor-first lesson, Alan has selected **the long supports
underneath** as the starting physical piece. The manual floor page starts
with those supports only: no frame, top sheets, walls or roof, and no autoplay.
He has now named them **skids** and their top cuts **notches**. Use those
confirmed terms; **runners** remains an unconfirmed alternate. Alan then
accepted the skid render (“Ok looks good now the next part”) and answered
“Yes—floor joist” for the crosswise 2x6 seated 1 in down in those notches.
Use **floor joist** as confirmed. Alan subsequently confirmed a 10 ft
outside floor width, 1 1/2 in **outer boards** on both sides, and joists
3 in shorter than that width. The resulting **117 in / 9 ft 9 in** joist
length is calculated from his rule. He also explicitly confirmed two
boards at one end and one at the other. He subsequently added **Flooring**
and has progressed through the walls and gable board to the truss preview.
The current manual view is `learn.html?company=learning-side-loft&step=truss`:
the end wall, **gable board**, truss and outward-turned gable studs over the
existing floor. The earlier `?step=gable` keeps the single gable board above
the end wall. The earlier
`learn.html?company=learning-side-loft&step=walls` selects one plain 16 ft
side wall or one plain 10 ft end wall independently.
The earlier `?step=deck`, `?step=frame` and `?step=joists` views remain available.
Keep joined corners, openings, additional roof assemblies and autoplay out
of this step. This is a learning order, not an approved
shop sequence. Do not impose the software's `buildOrder` as the order the shop
uses. Agree on the current part's meaning before moving on, and follow Alan's
direction and pace in the conversation. Preserve already confirmed terms even
when the starting view changes.

Alan has explicitly requested a **3D render with the terms** to check names
and how pieces fit together. Provide labels anchored to actual rendered
parts using leader lines or another clear visual pointer; text in a glossary
or a detached list is not sufficient. For the floor lesson, **skids**,
**notches**, **floor joist**, **Flooring** and Alan's **outer board** are
confirmed labels; **rim joist**, **end joist**, **floor frame** and **runners**
remain proposed. Use Flooring as the preferred term; “floor decking” is a
reference alias for the `floor-deck` part.
Start with the selected supports, then reveal floor layers manually as Alan
directs so he can see the crosswise members seated in the skids' notches,
perimeter members around them, and sheets on top. Distinguish that confirmed
seating from the remaining model assumptions. Inspect the
actual 3D result before saying that labels or connections are visible.

For the flooring request, update the existing
[part-floor-deck skill](../../../.claude/skills/part-floor-deck/SKILL.md)
rather than create another skill. Alan confirmed stated **4x8 ft tongue-and-
groove sheets, 5/8 in thick**, staggered end seams and trimming the last row.
Row one is 8+8 ft; he explicitly confirmed row two as **4+8+4 ft**; row three
is 8+8 ft trimmed to a **derived 2 ft width** (`10 - 4 - 4`). Seven laid
pieces are not a confirmed stock-sheet count or reuse plan. Cover the actual
10x16 ft frame envelope without changing the frame. Keep stated sheet size
separate from manufacturer net coverage and exact tongue/groove profile,
which have not been supplied. OSB/plywood, species, grade, sheet treatment,
fasteners and exact clearance are also unspecified. The one modeled layer
stays provisional. See the example for the confirmed and derived statuses.

For walls, use the existing
[part-wall-frame skill](../../../.claude/skills/part-wall-frame/SKILL.md).
On September 28, 2026 Alan confirmed **end wall** for the 10 ft walls
(`F`/`B` internally), **side wall** for the 16 ft walls (`R`/`L`), **stud**
for an upright, **bottom plate** below the studs, **top plate** for the lower
board above them and **upper plate** for the board above that. Studs and all
three plates are confirmed nominal 2x4, actual 1 1/2 x 3 1/2 in; stud cut
length is 75 in. The three flat plates give a **derived 79 1/2 in overall
wall height**. Alan confirmed 16 in on center and a double stud every 4 ft,
with each 4 ft mark between the touching pair. Alan subsequently confirmed
the side wall's bottom plate, top plate and end studs stop 3 1/2 in short
at **both ends**, while its upper plate runs the full 16 ft. The end wall's
bottom plate, top plate and studs span the full 10 ft, while its upper plate
stops 3 1/2 in short at each end. Derived plate lengths are **185 in
(15 ft 5 in)** for the side bottom/top, **192 in (16 ft)** for its upper,
**120 in (10 ft)** for the end bottom/top and **113 in (9 ft 5 in)** for
its upper. This confirms the alternating plate overlap, not extra corner
studs or fastening. Keep the starting layout datum, further wall placement,
openings and wall treatment unconfirmed. Do not copy floor-timber treatment onto walls or publish the
private reference photographs. The wall lesson is opt-in and must leave
the existing floor and ordinary finished designer unchanged.

For the first gable piece, read the existing
[part-gable-frame skill](../../../.claude/skills/part-gable-frame/SKILL.md).
Use Alan's confirmed name **gable board**; the earlier “2x6 along upper
plate” label remains a useful physical description.
Alan confirmed a nominal 2x6, actual 1 1/2 x 5 1/2 in, on edge along and on
top of the end wall's upper plate. His later correction keeps
the new board position but fixes the names: **1/2 in inside ledge** and
a calculated **1 1/2 in outside ledge**. It extends **2 1/2 in past both cut ends** of the
plate. The half-inch gap is at the selected wall-line edge; store its physical
`ledgeEdge` separately from the inside/outside name; the end projection is
along the wall, not vertical. For this 10 ft end wall, derive the new length
from the 113 in upper plate: `113 + 2.5 + 2.5 = 118 in` (9 ft 10 in).
This leaves 1 in to each full-wall endpoint. The on-edge height raises its
top 5 1/2 in above the plate. Show the single new board at `?step=gable`
and in [the gable picture page](../../../gable.html); preserve that earlier
board-only lesson when adding the truss preview. Alan confirmed that the
gable board is **nailed to the upper plate**. His later correction places
the **truss against its shown front face**, with its lowest tips at plate-top height. Nail size/count/spacing, treatment, species and grade remain
unconfirmed; names such as “chord,” “rafter” or “header” are not agreed
alternatives for the gable board. Keep
the supplied photo private and preserve the earlier floor and wall lessons.

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
Use [roof framing](../../../.claude/skills/part-roof-frame/SKILL.md) and
[the measurement workflow](../shed-measurements/SKILL.md) for the fit.
Review `learn.html?step=truss` and [the phone picture page](../../../truss.html).

Alan also requested **measurements on the render** so he can check the
lengths. Anchor dimension lines to the measured geometry and name the span
they measure. Derive lengths, spacing and cross-sections from the same part
geometry or member data used by the renderer; show units and distinguish
nominal footprint, configured lumber sizes and actual modeled extents.
Inspect the visible dimension lines and readout together before reporting
success. Naming a part and measuring the model do not confirm a shop's
physical specification or authorize treating the result as a cut list.

Alan confirmed these example-specific facts on September 27, 2026: nominal
4x6 skids are actual 3 1/2 x 5 1/2 in and 16 ft long; nominal 2x6 members are
actual 1 1/2 x 5 1/2 in, running across and sitting 1 in down in skid
notches. Standard spacing is 16 in on center; extra notches provide the
12 in on center option and may be unused in the standard layout. The
12 in unit was explicitly clarified. His supplied photos corroborate the
connection; use the stated dimensions rather than measurements from pixels,
and do not publish the photos.

Alan explicitly confirmed **the skids are treated wood**, then confirmed
the discussed **floor-framing boards are also treated wood**: floor joists,
outer boards and end boards. This does not confirm the deck or other parts.
He requested grain and knots that vary between boards. Use varied,
deterministic per-board patterns so they look different but stay stable
between renders. Keep the lesson finish subtle and inspect it alongside
labels and measurements. Do not infer species, grade or treatment chemistry.

Alan confirmed end notches measuring **3 in inward from one skid tip** and
**1 1/2 in inward from the other**, **both 1 in deep**. The little raised
piece beyond the end notch should **stay at notch height**. He clarified
that the **45-degree bottom-corner cuts slope upward toward the tips**;
this supersedes the earlier plan-view side-corner interpretation. Alan
confirmed **3 in back from each end** for both bottom cuts. Their rise is
**calculated as 3 in** from the 45-degree angle. With the notch seat
`5.5 - 1 = 4.5 in` above the bottom, the vertical end face between cut and
seat is **calculated as 1 1/2 in**. Keep these derived values distinct from
his directly stated dimensions. Record
`floorStudy.skids.bottomCuts: { reachIn: 3, angleDeg: 45 }` and
`floorStudy.status.bottomCuts: "confirmed"`. The same bottom cut applies at
both ends; it does not assign the unequal top notches to front/back.
The lesson's `floorStudy.notches.endRebates` negative/positive entries are
display coordinates, not agreed front/back names. Alan later explicitly
confirmed the two-board/one-board end counts; map the pair to the 3 in seat
and the single to the 1 1/2 in seat by fit. That mapping and placement are
derived, while the counts are confirmed. Inspect the
render before reporting these corrections as visible, and keep using
**skids** and **notches** without requiring another part name.

Alan clarified the **30 in skid offset** as **outside of the wall to the
inside face of the skid**, the face toward the middle of the floor. With
the actual 3 1/2 in width, the derived wall-to-center distance is 28 1/4 in.
The current two-skid lesson consequently has 63 1/2 in between centers
across the nominal 10 ft width; two remains a provisional count. Record the
lesson offset in `construction.floorStudy.skids.insetToInsideIn: 30` with
`construction.floorStudy.status.supportOffset: "confirmed"`; do not alter
the normal model's legacy skid table. Keep repeated-notch first-center
placement, notch cut clearance, skid count, outer-board height and length,
remaining long-board dimensions and unspecified flooring product details pending.
A provisional 1 1/2 in notch width is a
modeling fit to the member, not a confirmed clearance. Use the opt-in
`floorStudy` plan only for the learning page to show the corrected sections
and notched connection. Call
[floorStudyPlan](../../../model/floor-study.js) on the lesson's plan; it
reads `construction.floorStudy` and adds `plan.floorStudy` with separate
confirmation statuses. A company having the settings alone must not enable
the correction in its normal designer. Keep the finished reference's legacy geometry
unchanged: 6 in square support boxes, 16.14 ft outer extent and a 4.415 in
frame depth with one 5/8 in deck layer. Those older values are historical
drawing differences, not this lesson's approved sizes. See the
[measurement record](../../../docs/examples/10x16-side-loft.md#floor-measurements-to-show)
and the three affected part skills. A partly confirmed model is not a
complete cut list.

Use the lesson-only `floorStudy.frame` settings
`{ widthFt: 10, sideBoardWidthIn: 1.5, treated: true, endCounts: { negative: 2, positive: 1 } }`.
Record `frameWidth`, `sideBoardWidth`, `frameTreatment` and `endBoardCounts` as **confirmed**;
record `joistLength`, `endBoardMapping` and `endMemberPlacement` as **derived**.
Only the X width changes; preserve the current Z footprint and repeated-notch
grid until their dimensions are agreed. `frameFootprint` and `rimSection`
remain provisional. The aggregate `deck` status remains provisional, while
the granular flooring sheet/layout fields record Alan's confirmations.
A confirmed 10 ft floor width does not establish
the outer-board length or complete floor-frame length.

Alan also identified a flat treated 2x4 behind the double end boards,
resting on top of the skids, **93 in long** (7 ft 9 in by conversion).
Use **Board the mule hooks onto** as a descriptive label for his stated
purpose when dragging the barn; no formal shop part name was supplied.
The flat actual section is 3 1/2 in horizontal by 1 1/2 in vertical, with
bottom at the 5 1/2 in skid top and calculated top at 7 in. Its currently
centered sideways placement remains provisional; do not confuse the
superseded 117 in draft with the confirmed 93 in length. See the
[floor-frame skill](../../../.claude/skills/part-floor-frame/SKILL.md) for
the `frame.backing` record. Do not infer hardware or a load rating.

Alan's nominal-size explanation for the examples discussed is to subtract
1/2 in from each dimension: 2x4 → 1 1/2 x 3 1/2 in; 2x6 → 1 1/2 x 5 1/2 in;
4x6 → 3 1/2 x 5 1/2 in. Record these as confirmed conversation examples.
Do not universalize the rule to other sections or overwrite shared lumber
conversions without confirmation for those sections.

Propose a name as a draft, then ask whether the description identifies the
same part and what Alan's shop calls it. For example: "I mean the white outside
panels around the double doors. I'd call those siding. Is that the part and
name you mean?" Allow Alan to confirm or correct it before introducing the
next term. Do not ask him to approve a whole glossary at once.

Code names and conventional building words are useful source mappings, but
neither proves that a name is agreed with Alan. Keep those mappings marked as
proposed until he confirms the referent and wording. Promote only the name he
confirms to the shared confirmed vocabulary. Agreement on a name does not
confirm dimensions, materials or construction methods.

## Keep the building facts straight

For model inputs, **10x16** means width × length in feet. `SLB` is the model's
standard Side Lofted Barn; Alan confirmed that "side loft" means a lofted barn
with a side entrance. Read the example for the model's wall letters and opening
locations before moving a door or describing a side. Explain these conventions
when needed instead of assuming the user already knows them.

Distinguish what the current software draws, what Alan or the builder has
confirmed, and what the data marks as an assumption. For example, the standard
SLB loft depth is marked `assumed` in the manufacturer file. A displayed
dimension is not evidence that a shop builds it that way.

Trace a term or setting to its source as needed:

- [Manufacturer catalogue](../../../library/manufacturers/standard.json):
  style names, traits, standard openings and colours; no prices.
- [Construction defaults](../../../library/construction.json): construction
  values and explicit assumption flags.
- `model/`, `parts/`, and the relevant `.claude/skills/part-<id>/SKILL.md`:
  how the model resolves and draws a particular part.
- `companies/<id>/company.json`: that company's offer, prices, starting
  building, appearance and enabled views.

When Alan confirms or corrects a term, update the shared glossary and the
affected worked example. Record the preferred wording, the physical part it
identifies, any useful old alias, who confirmed it and when, and whether it
applies to one builder or the shared line. Preserve useful source-code mappings
as draft mappings if their shop meaning is not yet agreed. Keep uncertain
facts visibly uncertain. Change construction data only when the task calls
for it, using [change-construction](../../../.claude/skills/change-construction/SKILL.md).
Company names, prices, sizes and feature choices belong in company settings;
read [add-a-style](../../../.claude/skills/add-a-style/SKILL.md) if another
builder needs different style traits or standard openings.

## Reuse the company setup

Use `node tools/new-company.mjs` and `node tools/import-prices.mjs` as described
in the existing workflow. Run commands from the repository root. For a visitor
starting on this example, set `defaults.style` to `SLB` and `defaults.size`
to `10x16`; that style and size must also exist in `offer`.

For this learning company, `features.framingView` and `features.buildPlayback`
are `false`, and `features.floorPlan` is `true` in the regular designer. Those
menu settings do not block the separate manual learning page or override the
latest request to show an incomplete floor assembly. Keep shared rendering
code intact; do not impose these menu choices on future customers.

A company inherits no prices. Use its supplied prices; never substitute demo
or golden-test prices. The setup tool uses `$1` placeholders when prices are
missing. Keep missing prices explicit in unfinished work. After generating a
new customer draft with missing prices, use `pricing.show: "none"` and
`leads.mode: "none"` while pricing is unsettled, just as for the learning
showroom. This is a default for new drafts; respect an explicit user choice
for a preview, and do not silently change a live company's settings. Hidden
prices still exist in the data. Before treating a draft as ready for customer
quotes, replace placeholders with that company's supplied prices and finish
its requested quote setup.

## Verify and preserve the result

For a phone or another device, provide an HTTPS link to a hosted preview.
The current [floor preview](https://yoder-3d-floor-preview.netlify.app/learn.html)
is a separate site Alan approved for this lesson. A localhost URL or a Windows
file path is not a phone-accessible deliverable. Verify the hosted render and
its narrow-screen layout; distinguish browser emulation from real iOS testing.

For company edits, run `node tools/list-companies.mjs` and
`node tools/check-all.mjs --fast`. Open the affected designer and check the
starting style/size, standard openings and enabled views. Use the contact sheet
at `setup.html?company=<id>` when reviewing a company's offered range.
Rebuild `_headers` with `node tools/build-headers.mjs` after adding a company
or changing its embed/lead settings, then check with `--check`.

Browser checks in this repository currently reference Linux Playwright paths.
On another machine, use available browser tooling to verify the result and
report which automated checks could not run; do not claim they passed.
For terminology-only edits, verify source facts and relative links and run
`node tools/check-docs.mjs` where applicable.
For a learning-page change, open `learn.html?company=learning-side-loft` and
verify the requested starting assembly, manual additions and absence of
unrequested walls, roof or automatic stage changes.

Keep the glossary, example and skill changes together in version control.
When GitHub work is requested, follow the repository's branch/PR workflow and
report the resulting link or the concrete reason publishing was unavailable.
Company setup alone does not authorize a production deployment or contacting
the company's customers.

## Gable backing when setting up the learned assembly

Use [gable backing](../../../.claude/skills/part-gable-backing/SKILL.md)
for the horizontal 2x4 pieces across the gable to the outer truss, including
both outer bays. They support the siding where its seams meet: broad faces outward,
bottom 11 in above upper-plate top. Include it only on a gable without a
window or fake window. Recalculate the clear stud-to-stud lengths, outer
stud-to-truss fits and bay count for the customer's size. Do not infer this
rule for unrelated builders or invent siding sheet dimensions or fasteners.

For a **real gable window**, Alan confirmed a different layout: move the
gable studs to the two sides of the opening and add horizontal 2x4s above
and below to form a box, all 3.5 in wide faces outward. Read the
[gable-frame rule](../../../.claude/skills/part-gable-frame/SKILL.md#learned-rule-when-there-is-a-real-gable-window).
Use each selected window's clear framing opening and location as inputs;
there is no fixed window size for the skill. Alan explicitly requested
continuing with this reusable rule. The [adjustable window-box lesson](../../../learn.html) (`?step=truss&window=1`)
starts with example dimensions and an auto-fit height that can be changed;
these are not confirmed measurements for a product. Read its
[part skill](../../../.claude/skills/part-gable-window-frame/SKILL.md).
Do not apply the real-opening box to a fake window without confirmation.
