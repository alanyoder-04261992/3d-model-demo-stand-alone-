---
name: part-corner-trim
description: The trim boards up every outside corner of a portable building and the hairline shadow they throw on the siding -- read before changing which corners get a post, how tall they are, or their shadow.
---

# Corner trim (`parts/corner-trim.js`)

## What it is in real life

Every outside corner of the building gets a pair of 1x4 trim boards (3 1/2 in
each), nailed over the siding and painted the trim colour. They stand a
fraction of an inch proud of the siding, and the outer edge is eased, so the
corner catches the light in a thin bright line and throws only a hairline
shadow on the siding beside it.

The drawing makes the pair one five-sided post, 0.2917 ft (3 1/2 in) square
with the outer corner chamfered 0.05 ft, centred 0.0658 ft inside the corner
so it stands 0.08 ft proud of both faces, with a flat cap. It runs from just
under the siding skirt (y0 - SKIRT + 0.02; from the floor line on the kennel,
whose siding has no skirt) to the wall top -- on a lean-to the two high
(-x) corners are taller by the lean's rise, on a single slope the two high
(+x) corners by its rise. A soft shadow strip (the `cornerAO` decal) lies on
the siding on both sides of each post, from 0.17 to 0.44 ft in from the
post's centre line (the post's own edge is 0.146 ft in), which is about
0.24 to 0.51 ft in from the corner of the building.

No post where there is no outside corner: the front corners of a front-porch
or corner-porch building, the right corners of a `porch "R"` building, the
notch-side corner of a side porch (not when the notch is in the middle), and
the kennel's open front.

## Stage

The posts are stage `trim`; the shadow strips are stage `shading` (contact
shadows, finished view only). Both kind `finish`. PIPELINE entry 4
(`parts/index.js`), right after the siding: Barnwright draws the corner posts
straight after its walls loop, and the shadow decal must come after the
siding it darkens.

## Construction settings

* `roof.shapes.lean.rise` and `roof.shapes.slope.rise` -- the extra height of
  the high-side corner posts on a lean-to or a single slope. Defaults
  `{"w": 0.17}` and `{"w": 0.28}` (0.17 and 0.28 times the width,
  `library/construction.json`), bit for bit Barnwright's `W*0.17` and
  `W*0.28`. They are the same settings the roof line and the wall tops
  (`wallDefs`) are drawn from, so a company that changes a rise gets posts
  that still reach the wall top (checked with a steeper rise on a 6x12 lean-to
  and a 10x20 single slope: the high posts end exactly at the new wall top).

## Where it came from in Barnwright

`boisterous-lokum-a737e0/public/3ddesign.html` (pinned SHA-256
`85c4b022d2f75db2145f4ff5cf1ea43c1b52074f8972b96180d64840eb4c5d36`),
`buildShed` lines 3906-3945: `cw`, `co`, `cornerPost9`, `cornerAO9` and the
four-corner loop. The texture it uses, `texAOcorner`, is painted at
2044-2058.

Porting edits, all from the contract's Porting rules:
* `state.type === "DK"` -> the `kennel` trait (rule 2); `T()` -> `plan.t`,
  `pSpan()` -> `plan.span`, `wallDefs()` -> `plan.ws`, `y0`/`SKIRT` from
  `engine/constants.js`, `mT` is `core.mT`, the kit's `pushQuad pushTri DECAL
  quadUV wallPt` bound to Barnwright's names (rule 1);
* `dims().W*0.17` / `dims().W*0.28` -> the roof's rise from
  `plan.construction` (rule 4, Barnwright's value as the default);
* `kit.setStage("trim")` in `cornerPost9`, `kit.setStage("shading")` in
  `cornerAO9` (rule 7). `cornerPost9` and `cornerAO9` stay function
  expressions, as Barnwright wrote them.

## The owner's facts

Alan confirmed the discussed **trim stock is 3.5 in wide × 5/8 in thick**
on October 1, 2026. These are actual dimensions. Store them as learned
construction facts in the learning company's `construction.claddingStudy.trim`;
the current chamfered-post drawing below does not implement that board
thickness. Specific corner joints, ends and the application of this stock
to other named trim pieces remain to learn. Keep the utility's outside
2x4 separate: it is actual 1.5 × 3.5 in stock, not this trim board.
See [siding](../part-siding/SKILL.md#alans-learned-siding-rules--october-1-2026)
for its confirmed placement. This lesson is internal setup knowledge,
not a request to add a customer lesson or change the finished model.

Kept word for word in the code: "corner trim: chamfered posts (eased outer
edge catches the light the way a real 1x4 pair does) plus a soft thickness
shadow on both adjoining walls".

Barnwright's note on the shadow texture (2044-2053):

> The eave shadow above can afford to be strong - it is a roof overhanging a
> wall, and in real light that IS dark. A corner board is a 1x trim board
> standing a fraction of an inch proud of the siding, so what it actually
> casts is a hairline, not the deep band the eave gradient was drawing on all
> four corners at once. Sharing one texture made every corner of the building
> look burnt.

## Kept quirks

* The post is 0.2917 ft wide but centred only 0.0658 ft in from the corner,
  so it stands 0.08 ft proud -- that is how it hides the siding's edge.
* The point list is reversed when `sx*sz < 0` so every face is wound to face
  outward; do not "simplify" it.
* The cap's UVs are a fixed `[0,0],[0.42,0],[0.42,0.42]`.
* The shadow strip starts at y0 - SKIRT + 0.03 (0.01 above the post's own
  bottom; y0 + 0.03 on the kennel) and stops at the lower of the post height
  and the wall top less 0.03.
* `porch "R"` (no style uses it) still skips its right corners -- Barnwright's
  branch, kept.

## How to change it safely

* Run `node tools/check-golden.mjs --part corner-trim` before and after; it
  must stay green on all 148 buildings.
* The `cornerAO` decal must stay after the siding in the PIPELINE (a decal
  darkens what was drawn before it) and before anything else asks for a
  `cornerAO` material.
* Change a company's lean-to or single-slope rise in its construction
  settings, never here. The width, chamfer and shadow numbers are
  look-defining: changing them means re-recording the golden fixtures on
  purpose (`node tools/capture-golden.mjs`, with a reason).

## Checks that guard it

* `node tools/check-golden.mjs --part corner-trim` -- every corner post and
  corner shadow triangle of all 148 recorded Barnwright buildings, number for
  number (9,112 triangles); drawn on its own it is exactly those triangles.
* `node tools/check-parts.mjs` -- the part is valid and this skill is well formed.
* `node tools/check-imports.mjs` -- the file loads in Node with no browser.
