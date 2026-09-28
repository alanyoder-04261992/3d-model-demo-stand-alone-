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

For the learned **gable board**, Alan confirmed on-edge seating
on top of the end upper plate, a 1/2 in inside ledge and 2 1/2 in projection
past each cut end. Use the actual plate endpoints: the new start is the
plate start minus its start projection, and the new end is the plate end
plus its end projection. Its distance to each full-wall endpoint is that
end's upper-plate setback minus its projection. Do not subtract 2 1/2 in
from the full wall or treat it as a vertical rise. With the example's
3.5 in setbacks, the board stays 1 in short at each wall end.

The on-edge 2x6 is 1.5 in thick through the wall depth and 5.5 in tall.
Its inside face is 0.5 in back toward the outside from the upper plate's
inside face; the remaining outside ledge is `plate depth - inside ledge -
board thickness`, or 1.5 in for this example. Bottom elevation equals upper
plate top; board top is `upper plate top + board height`, giving 85 in above
the flooring here. Keep lengths, ledges and elevations as separate axes.
Before reusing this fit for a new builder or changed wall section, confirm
its applicability; a longer building alone does not lengthen an end-wall
board. **Gable board** is now the confirmed name, and nailing it to the
upper plate is confirmed; treatment and nail size/count/spacing remain
unspecified.

## Resolve the truss before calculating its profile

Alan confirmed the truss sits on top of the gable board and uses nominal
2x4 lumber, actual 1.5 x 3.5 in. His current longest-point member
lengths are **54 in for the upper piece leading to the peak** and
**37.75 in for the lower, steeper piece** in this 10 ft-wide example. Record
those values separately from centerline lengths, horizontal runs and the
overall truss span. Slope angles and end-cut geometry remain pending.
Two member lengths alone do not
determine a unique lofted-roof profile. Do not scale them in proportion to
building width or use the finished model's roof angles as shop inputs.

The confirmed peak height is **4 ft = 48 in**, measured vertically from
the **top of the gable board to the highest point of the peak**. Thus
`peak elevation = gable-board top elevation + 48 in`; the current example
gives `85 + 48 = 133 in` above flooring. Do not measure this rise from the
upper plate or substitute it for a sloping member length. These inputs
still need the horizontal extent and end-cut geometry
before resolving the complete profile. Neither the member lengths nor
the peak height is a universal scaling rule for wider buildings.

His **6.25 in** measurement is from the farthest truss point to the upper
plate. Confirm the direction, exact upper-plate reference and whether both
ends share it before deriving a truss span or overhang. It is a separate
measurement from the gable board's **2.5 in** projection past the plate cuts.
Do not add either distance to a sloping member length.

The gable-end studs sit on the gable board and are **24 in on center**,
“turned outward.” Their section, precise outward-facing lumber face,
starting layout datum and cut lengths are unresolved. Once those and the
truss profile are agreed, lay centers at `gable layout origin + n x 24 in`
within the supported run and derive each top cut from the actual truss
underside. Check the full rotated section against that cut, not just the
center point. Do not reuse the wall's 16 in grid or its doubled-stud rule
for these members. Confirm any reuse at a different building size with
the builder, and keep lengthwise spacing between trusses a separate input.

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
  projections from that upper plate's cuts, while `innerLedgeIn` controls
  depth placement. A new end-wall width therefore changes board length
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
