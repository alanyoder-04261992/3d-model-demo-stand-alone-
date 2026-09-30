---
name: shed-measurements
description: Calculate shed floor, wall and learned gable-board measurements for a different building size using actual lumber, plate end offsets, stud layout and staggered flooring. Use when Alan asks how dimensions were calculated or wants to reuse the learned assembly at another size; keep builder-confirmed rules separate from illustrative arithmetic.
---

# Shed measurements

Use this workflow to explain and apply the measurement relationships learned
in [the 10x16 example](../../../docs/examples/10x16-side-loft.md). It does not
replace the individual [wall](../../../.claude/skills/part-wall-frame/SKILL.md),
[floor-frame](../../../.claude/skills/part-floor-frame/SKILL.md),
[flooring](../../../.claude/skills/part-floor-deck/SKILL.md),
[gable-frame](../../../.claude/skills/part-gable-frame/SKILL.md) or
[skid](../../../.claude/skills/part-skids/SKILL.md) skills; read the affected
part's skill before changing it. Use Alan's agreed names in the
[shared glossary](../../../docs/BUILDING-TERMS.md).

## Establish the inputs and their scope

Record width `W` and length `L` in feet; calculate in inches with
`W_in = 12W` and `L_in = 12L`. Keep nominal footprint, actual frame bounds,
member cut length and dimension datum separate. A side wall follows `L`;
an end wall follows `W`. Retain fractions until formatting the result.

Use actual lumber dimensions: the discussed 2x4 is 1.5 x 3.5 in and the
2x6 is 1.5 x 5.5 in. Do not generalize Alan's half-inch subtraction to
unconfirmed sections. Record each end's offset separately, even when both
are equal. Each input needs its source and status: confirmed for this
building/builder, derived from stated inputs, or provisional.

The existing 75 in stud cut is a loft-wall rule, not a proportion of the
10x16 footprint. A wider/longer building does not automatically need taller
studs. Equally, the example's 16 ft skids, 93 in mule-hook board, two-skid
model, 30 in support offset, notch/end-board arrangement and treatment are
not universal size rules. Confirm their applicability before using them
for another building. Do not copy all `confirmed` statuses into a new design;
carry the provenance of a reusable rule and mark new results as derived.

## Gable window box measurements

For a real window in Alan's learned gable, studs move to its two sides and
horizontal 2x4s form the top and bottom of the box. All four wide faces
point outward: 3.5 in in the wall plane and 1.5 in through it. Read the
[gable-frame rule](../../../.claude/skills/part-gable-frame/SKILL.md#learned-rule-when-there-is-a-real-gable-window).

Collect clear opening width `Rw`, clear height `Rh`, horizontal position
and clear-opening bottom `B` above the upper-plate top. Catalogue size and
trim bounds do not establish those framing dimensions. Then:

- `opening top = upperPlate.top + B + Rh`.
- For opening left/right edges `xL,xR`, `xR - xL = Rw`.
- Adjacent full-width side-stud centers are `xL - 3.5/2` and
  `xR + 3.5/2`; their center distance is `Rw + 3.5`, not necessarily 24 in.
- The bottom horizontal's top face and top horizontal's bottom face bound
  the clear opening. Their outside faces are another 3.5 in beyond it.
- Horizontal cut lengths depend on the board-end joint: a piece fitted
  between the side studs cuts to `Rw`. Confirm that joint before treating
  this conditional formula as the shop's cut list.

These are reusable relationships, not confirmed window dimensions. Do not
inherit the 11 in backing offset, force a window onto the 24 in stud marks,
or scale a fixed window with the shed width. Check the complete box fits
between the gable board and truss. The measured window example and its
geometry are pending the opening dimensions/placement. The fake-window
box rule remains unconfirmed; both real and fake windows already exclude
ordinary gable backing on the same end.

## Calculate plates, studs and floor joists

For any straight member, `cut = full span - start offset - end offset`.
For Alan's learned wall assembly, use:

| Member | Cut length in inches |
| --- | --- |
| Side wall bottom plate and top plate | `L_in - a_s - b_s` |
| Side wall upper plate | `L_in` |
| End wall bottom plate and top plate | `W_in` |
| End wall upper plate | `W_in - a_e - b_e` |
| Gable board (2x6 along the end upper plate) | `upper plate cut length + start projection + end projection` |
| Wall height above the flooring | `stud cut + 3 x plate thickness` |
| Floor joist between equal outer boards | `actual outside frame width in inches - 2 x outer-board thickness` |

Here `a_s,b_s` are the side frame's two end offsets and `a_e,b_e` are the
end upper plate's offsets. In the confirmed example all four are 3.5 in:
the actual 2x4 wall depth fills that corner space. If the section or corner
assembly changes, confirm the offsets and overlap rule with the builder;
do not silently retain 3.5 in or replace it with a new nominal dimension.
The side end-stud outside faces follow the shortened frame endpoints;
the end wall's end studs follow its full span. Stud cut height is unchanged.
These lengths describe the required modeled members or plate runs. For
longer buildings, stock lengths and splice/joint placement need their own
shop rule before producing a fabrication cut list; do not assume a single
continuous stock board or invent splice locations.

With 1.5 in outer boards and actual frame width matching `W`, floor joist
length is `12W - 2(1.5)`. The 75 in studs plus three 1.5 in plates give
79.5 in wall height. Add actual flooring-top elevation only when measuring
from skid bottom; do not label that combined height as stud length.

For **gable backing**, use [its part skill](../../../.claude/skills/part-gable-backing/SKILL.md).
It is horizontal 2x4, actual 1.5 in thick by 3.5 in high, wide face outward,
between gable studs when that end has no window or fake window.
`bottom = actual upper-plate top + 11 in`; `top = bottom + actual backing height`.
Derive each cut from neighboring stud faces: `center spacing - half the
left stud face width - half the right stud face width`. Current result:
three pieces at 20.5 in (`24 - 3.5`), with 5.5 in above the gable board
(`11 - 5.5`). Recompute bay count and clear lengths for other widths;
do not scale the 11 in offset. A window on another end does not remove it here.

For the learned **gable board**, Alan confirmed on-edge seating
on top of the end upper plate and 2 1/2 in projection
past each cut end. Use the actual plate endpoints: the new start is the
plate start minus its start projection, and the new end is the plate end
plus its end projection. Its distance to each full-wall endpoint is that
end's upper-plate setback minus its projection. Do not subtract 2 1/2 in
from the full wall or treat it as a vertical rise. With the example's
3.5 in setbacks, the board stays 1 in short at each wall end.

The on-edge 2x6 is 1.5 in thick through the wall depth and 5.5 in tall.
Alan's later request moves it to the other side of the upper plate. He
then corrected the ledge names and explicitly kept the new position:
**inside ledge 0.5 in**, **outside ledge 1.5 in**. The latter is
`plate depth - inside ledge - board thickness`. Store `ledgeEdge` separately
from `ledgeSide` and `ledgeIn`: wall-line means local wall offset zero,
while opposite means `-plate depth`. Changing names must not move the
board. The current half-inch gap is at wall-line, named inside for this
gable connection. This convention does not change skid or ordinary-wall
coordinates. For another section, recalculate the other gap and validate
full-width bearing on the plate. Bottom elevation equals upper
plate top; board top is `upper plate top + board height`, giving 85 in above
the flooring here. Keep lengths, ledges and elevations as separate axes.
Before reusing this fit for a new builder or changed wall section, confirm
its applicability; a longer building alone does not lengthen an end-wall
board. **Gable board** is now the confirmed name, and nailing it to the
upper plate is confirmed; treatment and nail size/count/spacing remain
unspecified.

## Fit the measured truss and keep the remaining assumptions explicit

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

For reuse, calculate `peakY = upperPlate.topY + peakRise`,
`studBaseY = gableBoard.topY`, and each end's `tipX = plateCutX + outwardProjection`.
Resolve new lengths, rise and tail cut together; do not scale this example's
54/37.75/48 in inputs automatically. Set the outer tail point and inner
cut corner to `Y = upperPlate.topY = gableBoard.bottomY`. Fit the two outer
member lengths from that point to the knee and peak, then offset their lines
by the actual 3.5 in depth for the inner edges. For the right-hand piece,
`innerTailX = outerTailX - chordDepth / sin(lowerSlopeAngle)` is the
intersection with that horizontal bottom cut; mirror it for the left side. The projected board and truss
outlines overlap because they touch across depth; verify 3D volumes rather
than rejecting that intended 2D overlap. Stud top cuts and mirrored opposite
ends remain conditional results until confirmed.

## Keep the layout datum when the ends change

Lay regular marks on the full wall coordinate system:
`mark = layout origin + n x spacing`, using the applicable 16 in spacing.
For the learned rule, each 48 in mark is the joint between two touching
studs. For actual stud width `t`, pair centers are `mark - t/2` and
`mark + t/2`; at `t=1.5`, these are 0.75 in either side.

Shortening a plate does not reset the grid to the shortened plate's start.
Keep the starting datum explicit; Alan's first wall-layout datum remains
provisional. Fit full-width end studs to the frame endpoints, bound the
interior marks to that span, and check for collisions with end studs or
other pairs. Do not manufacture zero-length pieces, overlapping studs,
extra corner packs, opening framing or an approved stud count to make a
formula fit. An unresolved collision needs a layout decision, not a hidden
shift of the whole grid. Member counts come from the resolved layout.

## Lay out the flooring from actual coverage

Use the actual frame envelope for deck width `D_w` and length `D_l`, in
consistent units. With sheet width `S_w` across the floor, make
`ceil(D_w / S_w)` rows; row `r` (starting at zero) has width
`min(S_w, D_w - r x S_w)`. An exact multiple has a full final row, with no
extra zero-width row.

For sheet length `S_l` along the building, the learned stagger starts
alternate rows with a piece of length `q` (4 ft for the 8 ft sheets).
Unstaggered rows start with `min(S_l,D_l)`; staggered rows start with
`min(q,D_l)`. Fill the remainder with full lengths and trim the last piece
to the positive remainder. A remainder of zero creates no extra piece.
Check seam locations against the actual joist faces after resizing; an
8 ft sheet and 16 in spacing alone do not establish bearing when the
starting datums differ. Preserve thickness and layout separately from
appearance, and do not invent seam gaps or tongue/groove profile dimensions.
Laid pieces are not a stock-sheet purchase count or a cutting/reuse plan.

## Worked arithmetic

The first column applies the recorded 10x16 assembly. The **12x20 column is
illustrative only**, assuming the same sections, 3.5 in offsets, 75 in
studs, three plates, 2.5 in gable-board end projections, 1.5 in outer boards
and 4x8 flooring with a 4 ft stagger.
It is not confirmation that those rules suit a new building.

| Measurement | 10x16 example | Illustrative 12x20 |
| --- | --- | --- |
| Width and length in inches | 120; 192 | 144; 240 |
| Side bottom/top plate | `192 - 7 = 185` = 15 ft 5 in | `240 - 7 = 233` = 19 ft 5 in |
| Side upper plate | 192 = 16 ft | 240 = 20 ft |
| End bottom/top plate | 120 = 10 ft | 144 = 12 ft |
| End upper plate | `120 - 7 = 113` = 9 ft 5 in | `144 - 7 = 137` = 11 ft 5 in |
| Gable board, with 2.5 in projection at each end | `113 + 5 = 118` = 9 ft 10 in | `137 + 5 = 142` = 11 ft 10 in |
| Floor joist | `120 - 3 = 117` = 9 ft 9 in | `144 - 3 = 141` = 11 ft 9 in |
| Wall height above flooring | `75 + 4.5 = 79.5` in | `75 + 4.5 = 79.5` in |
| Flooring row widths | 4 + 4 + 2 ft | 4 + 4 + 4 ft |
| First/third row piece lengths | 8 + 8 ft | 8 + 8 + 4 ft |
| Second row piece lengths | 4 + 8 + 4 ft | 4 + 8 + 8 ft |

## Apply to this repository deliberately

- Rebuild the plan with the requested size through `makePlan`. A company's
  `offer` must include that style/size and its `defaults.size` must be valid;
  changing a label or only a saved size string is insufficient. Follow
  [customer setup](../shed-customer-setup/SKILL.md) for catalogue changes.
- [floorStudyPlan](../../../model/floor-study.js) reads explicit
  `construction.floorStudy.frame.widthFt` and `skids.lengthFt`; the learning
  company currently fixes these at 10 and 16. They do not follow a new
  footprint automatically. Resolve them together with the new size and
  revisit support layout, `frame.backing.lengthIn` and their statuses.
  Do not change the saved 10x16 example merely to demonstrate arithmetic.
- Nominal labels do not set the study's actual sections: inspect explicit
  `widthIn`, `heightIn`, spacing, notch depth/width and end-board counts
  together. Members must still fit their notches and end seats. In the
  current skid code, a non-null `insetToInsideIn` forces two supports;
  removing it switches to the legacy center-based table, not a generalized
  inside-face rule. Do not infer a new support layout or turn the fixed
  93 in mule-hook board into a width-minus-27 rule.
- [Floor-frame geometry](../../../parts/floor-frame.js) retains a legacy
  length inset for long boards (`L - 0.06 ft` in this example); its fitted
  end packages use skid length.
  Verify the resulting outer bounds, rather than assuming all drawn pieces
  become exactly `W` by `L`. [Flooring](../../../parts/floor-deck.js) clips
  its rows to those actual frame bounds. Its study path currently supports
  one lengthwise layer, `coverage: 'frame'`, and a stagger smaller than the
  sheet length; these study algorithms cover a rectangular floor and
  separate plain walls, not arbitrary porches or openings.
- [wallStudyPlan](../../../model/wall-study.js) derives wall spans from the
  actual flooring bounds and uses explicit sections and end setbacks.
  Its current `endSetbacksIn` schema has one value per wall type/layer
  applied equally at both ends. The formulas above allow unequal `a,b`,
  but implementing asymmetric ends needs a deliberate schema/geometry
  change, not an invented existing field.
- [gableStudyPlan](../../../model/gable-study.js) adds the single on-edge
  board only with `{ gable: true }` on an end-wall study. Its
  `construction.gableStudy.endProjectionIn.start` and `.end` are separate
  projections from that upper plate's cuts, while `ledgeEdge` and `ledgeIn`
  control physical depth placement and `ledgeSide` names the selected gap. The other ledge is calculated from actual plate
  depth minus board thickness minus the selected ledge. A new end-wall width therefore changes board length
  through the actual upper-plate range; changing building length alone
  does not. Check both endpoint clearance and ledge fit with
  [gable measurements](../../../model/gable-measurements.js).
- The study helpers are opt-in; company settings alone must not change the
  ordinary designer. [The learning UI](../../../ui/learn.js) currently
  requires `SLB` and `10x16`; its labels/cameras and static-render tooling
  also contain example-specific values. A different-size calculation is
  not evidence that the interactive page or pictures support that size.
  Inspect and adapt those paths only when a new render is requested.

For an arithmetic-only request, state the assumed inputs and report the
derived measurements without changing the example. Say that actual resized
geometry has not been checked. Before reporting a resized model as verified,
compare calculated lengths with
[floor measurements](../../../model/floor-measurements.js) and
[wall measurements](../../../model/wall-measurements.js), check actual
contacts, sheet coverage and endpoints, and inspect labels on the render.
Use the existing relevant checks (`check-wall-lesson.mjs`,
`check-floor-lesson.mjs`, `check-floor-joist-lesson.mjs`,
`check-floor-deck-lesson.mjs`) and meaningful checks for the new size;
the 10x16 fixtures alone do not validate resizing. For company changes run
`node tools/list-companies.mjs` and `node tools/check-all.mjs --fast`.
Read each affected part skill for render-refresh commands. Report the
calculation, inputs, geometry checks and remaining assumptions separately;
a successful model check is not approval of a physical cut list.
