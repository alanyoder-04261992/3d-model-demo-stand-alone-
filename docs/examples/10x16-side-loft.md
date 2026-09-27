# First example: 10 x 16 Side Lofted Barn

Alan confirmed on September 27, 2026 that “10 x 16 side loft” means a
**Side Lofted Barn (`SLB`)**: a lofted barn with a side entrance. He also
initially chose the finished building, then changed the starting approach:
**“build a floor first and we build it step by step.”** That later request
now controls the lesson. This example gives us one building to point at
while agreeing on
[our building terms](../BUILDING-TERMS.md), one physical part at a time.

Alan has asked us to check that we mean the same thing before treating a
name as learned. **Only terms marked confirmed in the discussion record
below are agreed. All others are draft discussion labels from the code and
existing skills.** Their descriptions explain what the assistant intends
to point to; they are not yet agreed shop language.

## Discussion record

| Status | Alan's wording or proposed term | What it points to | Confirmation |
| --- | --- | --- | --- |
| Confirmed | Alan: “side loft” | A lofted barn with a side entrance, matched to `SLB`; other details still need discussion. | Alan's reply, September 27, 2026 |
| Superseded choice | Start with the finished building | Earlier starting view, replaced by the later floor-first request. | Earlier reply, September 27, 2026 |
| Current direction | “Build a floor first and we build it step by step” | Begin with the floor, discuss one visible piece at a time, and wait for agreement before adding the next stage. | Later request, September 27, 2026 |
| Confirmed starting piece; name pending | Long supports underneath | Show these alone first. No floor frame or top sheets yet; “skids” and “runners” remain proposed names. | Alan's later reply, September 27, 2026 |
| Confirmed | Alan: **“Lofted roof”** | The whole roof with a gentle upper slope and a steep lower slope on each side. `gambrel` is its code reference, not Alan's preferred term. | Alan's reply, September 27, 2026 |
| Confirmed | **Ridge cap** | The highest long metal strip covering the meeting line of the two roof sides. | Alan's reply, September 27, 2026 |

The whole shape is **lofted roof**, and its highest long metal meeting strip
is **ridge cap** in our conversation. We have agreed on those specific
meanings. The other part names remain draft for later discussion; no
dimensions or installation details were confirmed by those naming replies.

Open the [floor learning page](../../learn.html), for example
`http://127.0.0.1:8282/learn.html?company=learning-side-loft` after
`npm run serve`.
The [example's settings](../../companies/learning-side-loft/company.json)
offer only this style and size.

## Our first floor discussion

Alan selected **the long supports underneath** as the first piece. The
learning page therefore begins with those supports alone: no floor frame,
top sheets, walls or roof, and no autoplay. Show the supports first, then
point to them and ask what Alan calls them. **Skids** and **runners** remain
candidate names; choosing the physical piece has not confirmed a name or
its specifications.

Alan's latest request is to put the terms **on the 3D render** so we can
check our names and understanding of how the pieces fit. In the
[learning page](../../learn.html), anchor each proposed label to its actual
piece with a leader line or another unambiguous visual pointer. Use
**skids / runners** for the long supports, **floor joist** for a crosswise
floor-frame member, **rim joist** for its perimeter member, and **floor
decking** for a top sheet. All these names remain proposed. Inspect the
rendered labels before reporting that this visual requirement is complete.

As Alan directs the lesson, manually reveal the frame and then the sheets
to show the model's intended relationship: crosswise members resting on
the long supports, perimeter members enclosing the frame, and sheets over
the members. Keep the supports-only starting view and no autoplay. These
are relationships to examine together, not newly confirmed shop details.

| Status | Candidate description | What still needs agreement |
| --- | --- | --- |
| Starting piece confirmed; name pending | Long supports underneath | His name for the visible pieces; proposed words are “skids” or “runners.” |
| Later; pending | Open rectangular frame | Its members and whole-frame names when Alan is ready to add it. |
| Later; pending | Flat sheets on top | Their name and meaning when Alan is ready to add them. |

Stay with the visible supports until we agree on their name. The optional
`?step=frame` and `?step=deck` views are for later manual additions, not an
automatic sequence. A learning display choice is not a declaration of the
shop's build order. Agree on the current meaning and record corrections before
advancing, following Alan's direction and pace in the conversation.

The [regular designer](../../index.html) at
`/?company=learning-side-loft` remains available as a finished-building
reference. It is no longer the starting page for this lesson.

## Floor measurements to show

Alan requested measurements on the 3D render so he can check the lengths.
Dimension lines should attach to the actual measured endpoints or faces,
and the readout should say which piece or spacing they describe. Derive the
values from the same geometry that is drawn. Keep the nominal **10 x 16 ft
building footprint** separate from the dimensions of its supports, frame
and sheets; inspect the visible lines and values before reporting them as
shown correctly.

The current model preserves some older drawing sizes. For this example:

| Measurement | Current model value | What it means |
| --- | --- | --- |
| Nominal building footprint | 10 ft x 16 ft | The selected building size; it is not every individual piece's length. |
| Overall support extent along the length | 16.14 ft = 16 ft 1.68 in | The outer extent of the drawn support boxes, including their extensions past the inset floor. It is not an approved stock or cut length. |
| Support cross-section | Drawn 6 in x 6 in; configured size `4x6` | A preserved drawing discrepancy. The settings' nominal lumber size does not control these boxes' thickness or height. |
| Floor-frame depth with one 5/8 in deck layer | Drawn 4.415 in; configured joist size `2x6` | The frame fits the older floor envelope: `(0.92 - 0.5) ft x 12 - 0.625 in`. It does not draw the 5 1/2 in depth associated with a nominal 2x6. |

The support extent follows the inset floor length plus the end extensions:
`16 - 2 x 0.03 + 0.2 = 16.14 ft`. The supports are drawn in segments, so do
not present this overall extent as a measured single timber or interpret
the segment seams as confirmed shop joints. Sources:
[support geometry](../../parts/skids.js),
[floor segmentation and inset](../../parts/floor.js),
[floor-frame envelope](../../parts/floor-frame.js), and
[construction settings](../../library/construction.json).

These values describe what the model currently draws. The floor names,
physical measurements, materials and connections still need Alan's
confirmation. Keep any mismatch visible for discussion; do not silently
label the drawn support “16 ft” or its cross-section “4x6,” and do not
promise a physical cut list from this rendering.

## Finished-model reference for later

This table records the complete model behind the floor lesson. The walls,
openings and roof listed here are absent from the initial floor display.
Except for the
confirmed side-entrance style choice, lofted roof term and ridge cap term
above, its labels and details still need checking against Alan's meaning
and his building.

| Feature | This example | Source |
| --- | --- | --- |
| Building size | 10 ft wide x 16 ft long; 160 sq ft nominal footprint | [Dimension rule](../../model/frame.js) |
| Style | Side Lofted Barn, `SLB` | [Standard building line](../../library/manufacturers/standard.json) |
| Roof | **Lofted roof**, Alan's confirmed term for the whole shape; gentle upper slope and steep lower slope on each side. Code reference: `gambrel`. Dimensions and other part names beyond ridge cap remain unconfirmed. | [Roof profile](../../model/roof-shapes.js), [roofing skill](../../.claude/skills/part-roofing/SKILL.md) |
| Highest metal cap | **Ridge cap**, confirmed to mean the highest long metal strip covering where the roof sides meet. Its measurements remain unconfirmed. | [Roofing skill](../../.claude/skills/part-roofing/SKILL.md) |
| Main entrance | One pair of wooden double doors, centered on the 16 ft entrance side (`R`) | [Standard layout](../../model/loadouts.js) |
| Wall windows | Two separate 2 x 3 windows, one on each side of the doors | [Standard layout](../../model/loadouts.js) |
| Gable details | Gable siding, horizontal gable trim bands and gable vents at the two ends | [Gable siding](../../parts/gable-siding.js), [band](../../parts/gable-band.js), [vent](../../parts/gable-vent.js) |
| Loft setting | Both end lofts are present in the style's data; 4 ft depth at each end is **unconfirmed** | [Loft skill](../../.claude/skills/part-loft/SKILL.md) |

The standard `SLB` layout has no gable window, porch or dormer. Do not copy
the faux loft window from the end-entry Lofted Barn (`LB`) into this example.

## Model orientation to check together

For the finished-model reference, stand outside facing the doors. The wall
in front of you is 16 ft long.
Internally it is `R`. The two ends to your left and right are each 10 ft wide.
The model calls those `F` and `B`; “front” in a customer's conversation may
instead mean the entrance side.

```text
Top view: entrance side at the bottom (not to scale)

                     Opposite long side L — 16 ft
              +-------------------------------------+
              |                                     |
 End F        |                                     |        End B
 10 ft        |                                     |        10 ft
              |                                     |
              +--- window --- double doors --- window+
                         Entrance side R — 16 ft
                                You
```

For discussion we can point to **entrance side**, **opposite long side**,
**F end**, or **B end**. Alan's preferred names are still to be recorded;
plain “front” could mean two things. The source is
[the wall coordinate rule](../../model/frame.js): positions increase to your
right as you face a wall from outside.

## Measurements stored in the model

These are drawing values for reference, not physical specifications approved
in this conversation. Confirm the actual piece and its name first; confirm
its measurements separately.

The standard layout is symmetrical about the entrance wall's center:

| Item | Catalogue code | Center position along `R` |
| --- | --- | --- |
| Left window | `w23` | -5.4 ft |
| Double doors | `w72` | 0 ft |
| Right window | `w23` | +5.4 ft |

The window centers come from `L / 4 + 1.4`: `16 / 4 + 1.4 = 5.4 ft`, or
5 ft 4.8 in from center. They are 2.6 ft from the nearer end. These are
opening-center positions; they are not gaps between trim boards. They
describe a fresh standard layout, before a visitor moves an item.

The product name **72-inch wooden double doors** and its rough opening are
different measures: the catalogue draws the pair 6.333 ft wide (about 76 in).
The recorded shop opening height for this gambrel building is 71 1/2 in,
drawn as 5.9583 ft. The **2 x 3 window** is stored as 2.1 x 2.9 ft; its top
sits 5 in below the wall top. The style's wall drawing height is 6.67 ft
above the floor, separate from the recorded 75 in loft-wall stud length.
See [the item catalogue](../../library/manufacturers/standard.json),
[opening geometry](../../model/layout.js),
[door skill](../../.claude/skills/part-door-wood/SKILL.md), and
[window skill](../../.claude/skills/part-window/SKILL.md).

## How we learn from this example

Follow Alan's latest request: use the manual floor page to point to one
visible piece, describe where it is, and agree that both of us mean that
piece. Then record his wording and the agreed term. The candidate list
gives us questions to work through; it is not a lesson of already confirmed
names. Show incomplete assemblies whenever that helps this conversation.
Do not use the saved `buildOrder` or automatic playback as an approved shop
sequence, and do not advance stages before shared agreement.

The regular designer still has `framingView: false`,
`buildPlayback: false` and `floorPlan: true`. Those switches describe that
designer's menus; they do not prohibit the separate manual floor lesson or
override Alan's new direction. **Inside** remains its floor-plan view.

**The loft is absent from the initial floor assembly.** In the regular
designer, it is also hidden in Outside, while Inside is a floor plan. The
loft's location and assumed depth below are model background; they do not
confirm our shared understanding of the actual loft. See
[the loft stage](../../parts/stages.js),
[view behavior](../../ui/views.js), and
[loft skill](../../.claude/skills/part-loft/SKILL.md).

## Keep agreement, source evidence and specifications separate

**Agreed in this conversation:** “side loft” means a lofted barn with a side
entrance; our latest starting direction is **floor first, then step by
step**, beginning with **the long supports underneath**; and Alan calls the whole
two-slope-per-side shape **lofted roof** (`gambrel` in code). **Ridge cap**
means the highest long metal strip covering where its sides meet. Other
anatomy names and their intended pieces remain pending.

**Verified in the code:** the dimension order, roof profile, long-side
entrance, standard door/window layout and opening rules above. This proves
how the current designer behaves. It does not prove that we understand
Alan's words or that every detail matches his building.

**Earlier recorded shop notes:** those notes identify 2x6 floor joists for
this width, 16 in standard floor-joist spacing, 5/8 in floor decking,
75 in loft-wall studs and 71 1/2 in barn shop-door openings. Their current
record is [Building facts we had to choose](../FOR-ALAN.md#building-facts-we-had-to-choose).
These are background references, not fresh confirmation of the terms or
specifications in this example.

**Still assumptions:** the 4 ft loft depth at each end, loft-joist size and
spacing, loft-deck thickness, anchor count, and several wall/roof framing
details. The same record lists them individually. Leave them labeled until
Alan or the relevant shop confirms or corrects them. The decorative gable
band does not establish the loft floor's elevation.

No real sale price or quote destination has been set up. This teaching
company hides pricing and uses internal `$1` placeholders where the schema
requires prices. Those are not estimates. The owner contact sheet
(`setup.html`) can show those placeholders, so use the floor learning link above
for this lesson and enter real prices before preparing a customer sign-off.

## Reuse it for the next customer

Reuse confirmed term records; carry unconfirmed labels as questions rather
than facts. Then collect that company's actual
styles, sizes, standard openings, colors and prices. Confirm how their
building differs before copying any construction setting. A company selling
the standard line can be configured in its own settings file; a changed
building line belongs in manufacturer/style data.

Follow [Shed customer setup](../../.agents/skills/shed-customer-setup/SKILL.md)
and [New company](../../.claude/skills/new-company/SKILL.md). When Alan
confirms or corrects a term or a part, record his wording, what it points to,
its status and the confirmation source. Update the glossary, this example
and the matching part skill so the next setup knows what is agreed and
what still needs discussion.
