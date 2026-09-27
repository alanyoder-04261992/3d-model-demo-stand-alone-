# First example: 10 x 16 Side Lofted Barn

Alan confirmed on September 27, 2026 that “10 x 16 side loft” means a
**Side Lofted Barn (`SLB`)**: a lofted barn with a side entrance. He also
confirmed that we should start with the finished building. This example
gives us one building to point at while agreeing on
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
| Confirmed | Start with the finished building | Begin in Outside; Framing and Watch it build stay off for this example. | Alan's reply, September 27, 2026 |
| Confirmed | Alan: **“Lofted roof”** | The whole roof with a gentle upper slope and a steep lower slope on each side. `gambrel` is its code reference, not Alan's preferred term. | Alan's reply, September 27, 2026 |
| Confirmed | **Ridge cap** | The highest long metal strip covering the meeting line of the two roof sides. | Alan's reply, September 27, 2026 |

The whole shape is **lofted roof**, and its highest long metal meeting strip
is **ridge cap** in our conversation. We have agreed on those specific
meanings. The other part names remain draft for later discussion; no
dimensions or installation details were confirmed by those naming replies.

Open the designer with `?company=learning-side-loft`, for example
`http://127.0.0.1:8282/?company=learning-side-loft` after `npm run serve`.
The [example's settings](../../companies/learning-side-loft/company.json)
offer only this style and size.

## What the current model draws

This table records the model we opened for discussion. Except for the
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

Stand outside facing the doors. The wall in front of you is 16 ft long.
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

Use **Outside** to point to one visible part, describe where it is, and
agree that both of us mean the same piece. Then record Alan's wording and
the agreed term. The list of candidate terms in the glossary gives us
questions to work through; it is not a lesson of already confirmed names.
**Inside** is available for discussing the floor plan and opening placement
when useful.

For this learning example, following Alan's confirmed preference, Framing
and Watch it build are switched off:
`framingView: false`, `buildPlayback: false`; `floorPlan: true` keeps Inside
available. This is an example preference, not a rule for every customer.

**The loft is not visible in either of these views.** Its geometry is a
framing part, hidden in Outside, and Inside is the floor plan. The loft's
location and assumed depth are recorded here as model background. They do
not confirm our shared understanding of the actual loft; a visible loft
discussion would need a separate view decision. See
[the loft stage](../../parts/stages.js),
[view behavior](../../ui/views.js), and
[loft skill](../../.claude/skills/part-loft/SKILL.md).

## Keep agreement, source evidence and specifications separate

**Agreed in this conversation:** “side loft” means a lofted barn with a side
entrance; we begin with the finished building; and Alan calls the whole
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
(`setup.html`) can show those placeholders, so use the designer link above
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
