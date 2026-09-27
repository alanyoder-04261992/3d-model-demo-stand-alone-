# Our building terms — working discussion list

We are learning the names together by pointing to one part at a time on the
[10 x 16 Side Lofted Barn](examples/10x16-side-loft.md). Alan asked us to
confirm that we mean the same physical part. A name found in the code or an
older skill is a **draft discussion label**, not proof that Alan uses that
name or that we have understood his meaning.

Only entries in the confirmed record below are agreed. All other names and
descriptions on this page are candidates awaiting that conversation. A
source link explains the current model; it does not confirm shop language
or the physical building's specifications.

**Current approach:** Alan has changed the starting point to the floor, then
building it step by step. Use the [floor learning page](../learn.html) at
`learn.html?company=learning-side-loft`. Show one incomplete assembly or piece
at a time, beginning with **the long supports underneath**, and wait for
agreement before adding the next stage. The earlier
finished-building starting preference is superseded; the agreed roof names
below remain valid.

Alan also requested a **3D render with the terms**, so we can check both the
names and how the pieces fit together. The lesson should place each label
on the rendered part using a leader line or another clear visual anchor;
a written glossary alone does not satisfy that request. Start with supports
only, then reveal the floor layers manually to discuss what rests on what.
Use proposed labels **skids / runners**, **floor joist**, **rim joist** and
**floor decking** on the corresponding pieces, visibly marked as proposed
until Alan confirms them. This describes the intended lesson method; verify
the labels against the actual render before claiming they are shown.

Alan also requested measurements on the render to check the lengths. Anchor
dimension lines to the actual visible endpoints or faces and identify what
is measured. Keep **nominal building size**, **configured lumber size** and
**drawn geometry** separate. For this example, a nominal 16 ft building has
drawn support extents of 16.14 ft (16 ft 1.68 in); its support settings say
4x6 while the preserved drawing uses 6 in square boxes. These are known
model differences, not confirmed shop lengths. The
[example's measurement notes](examples/10x16-side-loft.md#floor-measurements-to-show)
record the sources. A visible number does not confirm a term or provide a
physical cut list.

## What we have confirmed

| Status | Alan's wording or choice | What we agreed it points to | Record |
| --- | --- | --- | --- |
| Confirmed meaning | “Side loft” | A lofted barn with a side entrance; matched to the model's Side Lofted Barn (`SLB`). This does not confirm every feature of its existing model. | Alan's reply, September 27, 2026 |
| Superseded starting choice | Start with the finished building | This was the earlier starting point; Alan later requested floor first. It no longer controls the lesson. | Earlier reply, September 27, 2026 |
| Current learning direction | “Build a floor first and we build it step by step” | Start with the floor in the manual learning page. Add further stages only after we agree what the visible piece means. | Alan's later request, September 27, 2026 |
| Confirmed starting piece; name pending | Long supports underneath | Show only those supports first, with no floor frame or top sheets yet. “Skids” and “runners” remain proposed names until we point to the visible pieces and agree. | Alan's later reply, September 27, 2026 |
| Confirmed preferred term | **“Lofted roof”** | The whole roof shape with a gentle upper slope and a steep lower slope on each side. The code calls this `gambrel`; use **lofted roof** with Alan. This confirms the name and intended shape, not dimensions or individual roof-part names. | Alan's reply, September 27, 2026 |
| Confirmed part term | **Ridge cap** | The highest long metal strip covering the meeting line of the two roof sides. This identifies that piece; it does not confirm its dimensions or installation details. | Alan's reply, September 27, 2026 |

## What remains to agree on

The first agreed terms are **side loft**, **lofted roof** and **ridge cap**.
The remaining candidate names below await a later discussion, one physical
part at a time. Their presence in code or an older skill does not make them
agreed. `gambrel` remains the project's code reference for the whole lofted
roof shape, not Alan's preferred spoken term.

**The first piece is now agreed:** the long supports underneath. Show those
pieces before asking what Alan calls them. **Skids** and **runners** are
still candidate names; the physical starting choice does not confirm either
word. The learning page begins with supports only, without a floor frame,
top sheets, walls or roof, and has no autoplay. Later views can add the frame
and sheets manually once we agree on the current piece and continue. This
learning order is not a confirmed shop construction sequence.

## Candidate names and directions

**Status for every row in this section: draft; shared meaning and Alan's
preferred wording have not yet been confirmed.**

| Proposed or model term | What the current model means |
| --- | --- |
| **Side Lofted Barn** | A barn with the agreed lofted roof shape (`gambrel` in code) and its standard entrance on a long side. In this model it has centered wooden double doors with one wall window on each side; those detailed labels and layout still need discussion. |
| **10 x 16** | Width first, length second, in feet: a 10 ft wide building, 16 ft long. Its nominal footprint is 160 square feet. |
| **Gable end / end wall** | Either short end under the roof profile. On this example the end walls are 10 ft wide. The software calls them `F` and `B`. |
| **Long side / sidewall** | Either wall running along the 16 ft length. The software calls them `R` and `L`. |
| **Entrance side** | The wall with the main doors. On the standard Side Lofted Barn it is `R`, a long side. A person may call this the front; that does not change the software's `F` end-wall code. |
| **Centered** | The center of the opening is at the middle of its wall. Positions run left/right as seen by someone standing outside and facing that wall. |

The [style catalogue](../library/manufacturers/standard.json),
[wall definitions](../model/frame.js), and
[standard door/window layouts](../model/loadouts.js) are the source for these
model names and directions. Keep the stable codes when a company uses a
different display name, and record the agreed spoken name alongside them.

## Candidate labels for the finished building

**Every row below is pending shared confirmation.** The descriptions say
what the assistant currently intends to point to. We should show the part,
ask whether Alan means that same piece, and record his wording before
teaching the name as agreed.

| Proposed label | Intended physical part | Existing model/skill reference |
| --- | --- | --- |
| **Ridge** | The highest meeting line along the roof, underneath the agreed ridge cap. This proposed name for the line is separate from the confirmed name for the metal piece. | [Roofing](../.claude/skills/part-roofing/SKILL.md) |
| **Roof break / shoulder** | Where the steep and shallow roof slopes meet. This is a bend below the ridge. The upper metal sheet laps over the lower sheet here. | [Roofing](../.claude/skills/part-roofing/SKILL.md) |
| **Eave** | The low roof edge along a long side, where the roof reaches past the wall. | [Roofing](../.claude/skills/part-roofing/SKILL.md) |
| **Rake board / metal rake trim** | The sloped trim following the roof edge at a gable end. On this barn, metal rake trim partly covers the painted rake board. | [Roofing](../.claude/skills/part-roofing/SKILL.md) |
| **Siding** | The outside wall covering. This painted style uses the LP rough-sawn panel appearance, with vertical grooves. | [Siding](../.claude/skills/part-siding/SKILL.md) |
| **Siding skirt** | The siding extending below floor level to cover the floor's rim. | [Siding](../.claude/skills/part-siding/SKILL.md) |
| **Corner trim** | Trim boards covering the outside wall corners. | [Corner trim](../.claude/skills/part-corner-trim/SKILL.md) |
| **Gable siding** | The end-wall covering above the wall top, cut to the roof shape. | [Gable siding](../.claude/skills/part-gable-siding/SKILL.md) |
| **Gable trim band** | The horizontal trim board across a gable end. Its drawn position depends on roof shape and whether that end has a gable window. Do not use it to measure the loft floor height. | [Gable band](../.claude/skills/part-gable-band/SKILL.md) |
| **Gable vent** | The louvered opening high in the gable siding. It is different from a window. | [Gable vent](../.claude/skills/part-gable-vent/SKILL.md) |
| **Wooden shop door / double doors** | A door made from the building's siding; double doors have two moving leaves. The standard `w72` pair is sold as “72-inch” doors, while the recorded shop rough opening is about 76 inches wide. | [Wooden door](../.claude/skills/part-door-wood/SKILL.md) |
| **Rough opening** | The opening sized to receive a door or window. Keep the product's named size separate from the dimensions stored for the opening. | [Openings](../.claude/skills/part-openings/SKILL.md) |
| **Casing / head trim** | The trim around an opening; the head trim is the board across its top. This is separate from the structural header inside the wall. | [Openings](../.claude/skills/part-openings/SKILL.md) |
| **Door leaf / astragal** | A leaf is one moving door panel. The astragal is the strip covering the meeting edge of a pair. | [Wooden door](../.claude/skills/part-door-wood/SKILL.md) |
| **2 x 3 window / sash / sill** | `w23` is the named wall-window size. The sash holds the glass; the sill is the lower piece. Two separate windows beside a door are different from one double-window opening. | [Window](../.claude/skills/part-window/SKILL.md) |

## Candidate labels for the floor and later hidden parts

**Every row below is pending shared confirmation.** Keep these as reference
notes while we point to the floor first. The remaining wall and roof pieces
can wait until Alan wants to add them.

| Proposed label | Intended physical part | Existing model/skill reference |
| --- | --- | --- |
| **Skids / runners** | Long supports under the floor, running along the building's length. | [Skids](../.claude/skills/part-skids/SKILL.md) |
| **Floor joists / rim joists** | Joists support the floor across the building; the rim boards close the floor frame's perimeter. | [Floor frame](../.claude/skills/part-floor-frame/SKILL.md) |
| **Floor decking** | The sheet material laid over the joists. | [Floor deck](../.claude/skills/part-floor-deck/SKILL.md) |
| **Stud / top plate / bottom plate** | Upright wall member / horizontal board at the top / horizontal board at the bottom. | [Wall frame](../.claude/skills/part-wall-frame/SKILL.md) |
| **Header / king stud / jack stud** | The member spanning an opening / the full-height stud beside it / the shorter stud supporting the header. | [Wall frame](../.claude/skills/part-wall-frame/SKILL.md) |
| **Truss / chord / gusset** | Roof-supporting assembly / a principal member of that assembly / a plate joining members. | [Roof frame](../.claude/skills/part-roof-frame/SKILL.md) |
| **Roof deck / sheathing** | The layer under the roof covering. Keep this distinct from the steel roofing above it. | [Roof deck](../.claude/skills/part-roof-deck/SKILL.md) |
| **Loft / loft joists / loft deck** | A raised storage floor near an end of the building / its supporting members / its sheet floor. “Side loft” does not mean the loft projects from a sidewall. | [Loft](../.claude/skills/part-loft/SKILL.md) |
| **On center (OC)** | Spacing measured from one member's center to the next member's center. | [Construction settings](../.claude/skills/change-construction/SKILL.md) |

The current loft geometry belongs to the `loft` framing stage. It is absent
from our floor-first starting assembly. In the regular designer it is also
hidden in Outside, and Inside opens the floor plan rather than a loft view.
The written explanation records only the model's current interpretation of
the loft's location. It does not replace pointing to and agreeing on the
real part. See [view behavior](../ui/views.js) and
[construction stages](../parts/stages.js).

## Current software labels for customer setup

These explain where data lives. They are not an agreed shop vocabulary;
record any wording Alan prefers when we discuss the corresponding idea.

| Term | What we store |
| --- | --- |
| **Manufacturer / building line** | Shared styles, parts, dimensions and standard layouts in `library/manufacturers/`. |
| **Company / dealer** | One customer of this designer: branding, offered buildings, prices and preferences in `companies/<id>/company.json`. A retail buyer's individual shed is a saved design, not a new company. |
| **Style** | A named building type, such as `SLB`. |
| **Loadout / standard layout** | The included doors and windows, with their walls and positions. |
| **Part** | A real building component represented by a module in `parts/` and a matching `part-…` skill. |
| **Construction settings** | The building dimensions and rules used by the parts. Defaults, manufacturer settings, company settings, then selected upgrades are applied in that order. |
| **Drawing value** | A number preserving the current picture. For example, the style's `wallH` is not the stud cut length, and the drawn roofing slab is not the steel sheet gauge. |
| **Assumption** | A value awaiting the shop's confirmation. It must stay labeled as an assumption in docs and skills. |

For the reusable procedure, use
[Shed customer setup](../.agents/skills/shed-customer-setup/SKILL.md) and the
existing [New company skill](../.claude/skills/new-company/SKILL.md).

## How our vocabulary grows

For each part, keep a small record with **status**, **Alan's wording**,
**what it points to**, **model/part reference**, and **confirmation source or
date**. Start with `draft`; move to `confirmed` only after both of us mean
the same physical piece. If Alan corrects us, keep his correction and revise
the proposed label or description. Do not confirm a group of nearby parts
from an answer about only one of them.

Update this page, the affected example and that part's skill together.
Skills may retain useful technical mappings, but must distinguish pending
labels from agreed language. A dimension or construction detail needs its
own confirmation: agreeing on the name does not approve the specification.

The existing [record of shop facts and assumptions](FOR-ALAN.md#building-facts-we-had-to-choose)
is background evidence to review. It does not confirm a term for this
conversation. Customer-specific terminology can be recorded with that
company's setup without changing the meaning of the shared codes.
