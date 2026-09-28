---
name: part-skids
description: The skids (treated runners) under a portable building -- read before changing where they sit, how many there are, or how they are drawn.
---

# Skids (`parts/skids.js`)

The lesson's surface finish is in `ui/learn-wood.js`. Its shared
`floorWoodTexture` generator produces seeded RGBA pixels for eight grain
and end-grain variants, with differing knot counts and positions. A stable
board hash selects the variant and varies texture scale, offset and tint.
The browser and static renders use those same pixels and texture coordinates;
camera changes and checkbox toggles must not rearrange a board's finish.
This changes surface material and texture coordinates only. Keep dimensions,
normals and stages unchanged. `floorStudy.skids.treated: true` and
`status.skidTreatment: "confirmed"` record Alan's material confirmation;
colour and knot placement are illustrative, not a species or grade claim.

## Confirmed floor lesson and its scope

Alan confirmed **skids** and **notches** on September 27, 2026. For the
10x16 lesson the skids are nominal 4x6, actual **3 1/2 x 5 1/2 in**, with a
total length of **16 ft**. The top notches are **1 in deep** and receive
crosswise nominal 2x6 members, actual **1 1/2 x 5 1/2 in**. Those members
seat down into the cuts rather than sit on an uncut skid top.

Alan explicitly confirmed **the skids are treated wood** on September 27,
2026. This is now a direct example fact, not only an older catalogue
default. His request for **a little texture and knots in the wood** is a
visual finish request; use subtle detail in the lesson without changing
the dimensions or obscuring the cuts. It does not establish species, grade,
treatment chemistry. Alan later separately confirmed treated wood for the
floor joists, outer boards and end boards, with varied grain and knots per
board. This does not establish deck treatment.

He also confirmed **16 in on center standard**, with extra notches for the
**12 in on center option**; the extra positions can be unused at standard
spacing. Alan clarified the skid offset as **30 in from the outside of the
wall to the inside face of the skid**, toward the middle of the floor.
With a 3 1/2 in-wide skid, this gives **28 1/4 in to its center**. Across the
nominal 10 ft width, the current two-skid lesson gives **63 1/2 in between
centers**; the count of two is still provisional. Repeated-notch first-center
placement, cut clearance and skid count remain pending.
A 1 1/2 in drawn slot width is only a
provisional fit to the stated member width. **Runners** remains a draft
alternate name. Alan has since accepted the skid render and confirmed
**floor joist** for the regular crosswise 2x6 seated in the notches. The
manual lesson now shows the full frame on the skids at `?step=frame`;
the earlier `?step=joists` remains available. Alan confirmed a 120 in outside
floor width with 1 1/2 in outer boards each side and joists 3 in shorter,
giving a **derived 117 in / 9 ft 9 in** cut length. “Outer board” is Alan's
wording; rim/end-member names and the floor-frame assembly name remain
proposed. Outer-board height/length, full-frame length and remaining layout
are not established by skid visual acceptance.

Alan confirmed the end details on September 27, 2026: one notch runs
**3 in inward from its skid tip**, the other **1 1/2 in inward**, and
**both are 1 in deep**. The little raised piece beyond the end notch should
**stay at notch height**, leaving no full-height lip beyond the cut.
Each **45-degree bottom-corner cut slopes upward toward the skid tip**;
this supersedes the earlier plan-view side-corner interpretation. Alan
confirmed the reach as **3 in back from each skid tip**, the same at both
ends. At 45 degrees this gives a **calculated 3 in rise**. The top-notch
seat is `5.5 - 1 = 4.5 in` above the bottom, so the remaining vertical end
face between cut and seat is **calculated as 1 1/2 in**. Record the confirmed
reach and angle separately from those derived heights. Do not assign the
unequal top notches to front/back. Keep repeated-notch first-center
placement and cutting clearance separately provisional. Alan later explicitly
confirmed two boards at one end and one at the other. The pair fits the 3 in
notch, the single fits the 1 1/2 in notch; this is a derived display mapping,
not a shop front/back assignment. Check the visible end shape before
claiming it is corrected.

Alan has also confirmed a **flat treated 2x4** behind the double end
boards toward the inside. It rests **on top of the skids**, at their
5 1/2 in top elevation; it does not use the 4 1/2 in notch seat or require
a new skid notch. From the agreed size conversion, it is 3 1/2 in horizontal
by 1 1/2 in vertical, with a calculated 7 in top elevation. Alan confirmed
**93 in length**, converting to **7 ft 9 in**, replacing the earlier 117 in
draft. Its current sideways centering remains provisional. Alan says the
mule hooks onto this board to drag the barn; use the descriptive label
**Board the mule hooks onto**, without inferring hardware or load ratings.
Show it in the full-frame view; see the
[floor-frame skill](../part-floor-frame/SKILL.md) for its `end-backing`
record. **Flat treated 2x4** describes the piece; a formal shop part name
has not been supplied.

The opt-in setting is `floorStudy.notches.endRebates`, with
`negative: { lengthIn: 3, depthIn: 1 }` and
`positive: { lengthIn: 1.5, depthIn: 1 }`. Negative/positive are display
coordinates only. Use `status.endRebates: "confirmed"` for those dimensions
and record `status.endBoardCounts: "confirmed"`, with
`status.endBoardMapping` and `status.endMemberPlacement` as `"derived"`.
This does not confirm
the repeated-notch layout datum.

Use `floorStudy.skids.bottomCuts: { reachIn: 3, angleDeg: 45 }` and
`floorStudy.status.bottomCuts: "confirmed"` for the two bottom cuts.
Derive the rise from reach and angle; apply the same bottom profile at both
ends without changing the confirmed 16 ft tip-to-tip length. The unequal
top-notch lengths are a separate setting.

His supplied photos corroborate the notched connection. The numbers above
come from his words; do not measure them from image pixels or publish the
photos. Record corrections in [the glossary](../../../docs/BUILDING-TERMS.md)
and [the example](../../../docs/examples/10x16-side-loft.md).

Alan's nominal-size examples subtract 1/2 in per dimension: 2x4 is actual
1 1/2 x 3 1/2 in, 2x6 is 1 1/2 x 5 1/2 in and 4x6 is 3 1/2 x 5 1/2 in.
These examples do not establish the conversion for other sections.

The learning page uses an opt-in `floorStudy` plan for the actual sections,
16 ft length and notches. The ordinary finished model keeps the legacy
boxes below. Do not enable the lesson correction for every company or
silently change the reference geometry. Neither the historical drawing nor
the partly confirmed lesson is a complete physical cut list.

The entry point is [floorStudyPlan](../../../model/floor-study.js), reading
`construction.floorStudy` and adding `plan.floorStudy` on a copied plan.
The lesson setting `floorStudy.skids.insetToInsideIn: 30` measures to the
inside face and has `floorStudy.status.supportOffset: "confirmed"`. The
normal model's center-based `skids.table` is unchanged. Do not conflate the
confirmed offset with the still-provisional number of skids.
`skidStudyMembers(plan)` in `parts/skids.js` extrudes each notched side
profile across its actual width. It combines the standard cross-member cuts
and 12 in alternate positions, merging coincident cuts. It records notch
bounds and sources for the measurement view. Repeated-notch first-center placement and
clearance remain separately provisional despite confirmed spacing values.

## What it is in real life

Every portable building sits on skids: heavy treated timbers laid on edge
along the whole length of the building. They let the finished building be
winched onto a trailer and set down on blocks, and carry the crosswise floor
members. In the corrected lesson these members sit in the confirmed notches.
The existing standard catalogue uses two skids on a 6, 8 or 10 ft width and
four on a 12 or 14 ft width; the count remains a model default awaiting
confirmation for the current lesson. The lesson's offset uses the confirmed
inside-face rule above instead of the normal model's center-based table.

## Stage

Stage `skids` (kind `both`): shown in the Finished view AND the Framing view,
and placed third in Watch-it-build (after the site and the foundation
blocks). PIPELINE entry 1 (`parts/index.js`): Barnwright draws the skids first
thing in `buildShed`, inside the floor loop, before the walls.

## Construction settings

The settings below describe the normal model's legacy path.

* `skids.table` -- per building width in feet, the inches from each side edge
  in to a skid's centre. Default (Alan's build sheet):
  `{ "6": [6], "8": [18], "10": [30], "12": [8, 37], "14": [8, 54] }`. Each
  number gives a PAIR of skids (one each side). A company that builds its
  skids elsewhere changes this table and the drawing follows.
* `skids.bunkSpacingIn` -- for a width not in the table: two skids this many
  inches apart, centred (never closer than 6 in to the edge). Default 60.
* `skids.size` (`"4x6"`), `skids.onEdge`, `skids.treated` -- the caption only
  on the legacy path.
  The drawn skid stays Barnwright's 0.5 x 0.5 ft box whatever the size says.

## Where it came from in Barnwright

`boisterous-lokum-a737e0/public/3ddesign.html` (pinned SHA-256
`0bdcf663c5cb988623d2cb0dd271156fb690564072b301b0a15b917fd921ac6c`):
* `skidXs(w)`, lines 3826-3851 -- ported as `skidXs(w, skids)`;
* `buildShed` floor loop, lines 3868-3875: `var SKX=skidXs(W);` and, per floor
  segment, `var fend=fl+(fi===0||fi===NF-1?0.2:0); for(...) box(mSk,SKX[sx],0,fzc,0.5,0.5,fend);`.

Porting edits, all from the contract's Porting rules: the build sheet `SHEET`
and the 60 in fallback are read from `plan.construction.skids` with
Barnwright's values as the defaults (rule 4); the floor segments come from
`floorSegments()` in `parts/floor.js` (the same arithmetic -- Barnwright draws
the skid boxes and the deck slab in ONE loop, and the two go into different
materials, so drawing them in two passes gives each material the same
triangles in the same order); `mSk` is `core.mSk`; `kit.setStage("skids")`.

## The owner's facts

These earlier records explain the default positions. The September 27 floor
lesson confirms the section, length and notched connection above; it does
not reconfirm the number or positions of skids from this older table.

From Alan's build sheet, Sep 2026 (Barnwright's comment, kept word for word
in `parts/skids.js`):

> WHERE THE SKIDS SIT UNDER THE BUILDING. Alan's build sheet, Sep 2026,
> measured from each side edge of the building in to the CENTRE of a skid:
> 6 wide .. 6", 8 wide .. 18", 10 wide .. 30", 12 wide .. 8" and 37",
> 14 wide .. 8" and 54" (four skids).
> Six, eight and ten wide are two skids and all three land on exactly 60"
> between centres -- one trailer's bunk spacing, which is the number that
> makes the rest of the sheet read straight, and it is what an unlisted
> width falls back to. Twelve and fourteen carry four: a pair tucked right
> under the walls and a pair on the bunks.
> It was ONE rule before this, +/- 0.30 x width, which put two skids on
> every building however wide and sat them nowhere in particular -- on a
> 12 wide that is 28.8" in from the edge, and there should be four.

The skids are treated 4x6 laid on edge (`library/construction.json`).

## Kept quirks

These quirks belong to the normal finished model, not the opt-in lesson.

* The drawn skid is a 0.5 x 0.5 ft (6 in) square box from the ground to
  y 0.5, not the real 3 1/2 x 5 1/2 in 4x6 -- the finished picture is
  Barnwright's.
* The skids are drawn in pieces, one per floor segment (the floor is split
  into `max(3, ceil(L / 2.5))` pieces), and the two end pieces are 0.2 ft
  longer, so the skids poke about 0.1 ft past each end of the floor.
  On the nominal 16 ft SLB this totals 16.14 ft in outer extent. The corrected
  `floorStudy` lesson uses Alan's confirmed 16 ft total instead.
* The table is looked up by the ROUNDED width (`Math.round(w)`).

## How to change it safely

* For the opt-in lesson, verify actual skid extents, visible notch depth,
  the two spacing provisions, and that the crosswise members seat in the
  cuts. Retain pending labels for repeated-notch first-center placement,
  clearance and other unconfirmed layout
  defaults. Run the ordinary golden check too, to prove its path is unchanged.
* A company's skid positions: change `skids.table` in its company file (or
  the manufacturer file), never the code.
* Anything in `parts/skids.js` or `floorSegments()` in `parts/floor.js` moves
  Barnwright's picture. Run `node tools/check-golden.mjs --part skids` before
  and after; it must stay green on all 148 buildings. If the look must really
  change, re-record the golden fixtures on purpose
  (`node tools/capture-golden.mjs`, with a reason in the commit).
* The framing parts (`floor-frame`, `foundation`) sit on and under the skids:
  if the skids move, check `node tools/check-framing.mjs` too.

## Checks that guard it

* `node tools/check-golden.mjs --part skids` -- every skid triangle of all 148
  recorded Barnwright buildings, number for number (48,264 triangles).
* `node tools/check-parts.mjs` -- the part is valid, its caption fills in from
  the construction settings, and this skill exists.
* `node tools/check-imports.mjs` -- the file loads in Node with no browser.
