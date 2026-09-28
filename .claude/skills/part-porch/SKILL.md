---
name: part-porch
description: The open porch on a cabin (front, side or wrap-around) -- its posts, header bands, white ceiling, railing with the entry gap and the side-porch step -- read before changing anything on a porch style.
---

# Porch (`parts/porch.js`, plus `parts/porch-junction.js`)

## What it is in real life

A cabin's porch is part of the building's own floor: the floor runs out past
a wall that stands back from the edge, and the roof carries on over it.

* At the open corners stand **4x4 posts of natural pressure-treated wood**
  (drawn 0.34 ft square, from the deck up to the wall top; centred 0.28 ft
  in from each open edge -- except on a front porch, where the two posts are
  0.28 ft in from the sides but only 0.20 ft back from the front edge). The customer can add more ("Porch Post" items, drawn by the
  openings part); the railing then runs post to post.
* Across the opening, under the roof, runs a **1x4 header band** painted the
  trim colour (white on the real cabins), 0.29 ft deep under the wall top,
  and short **wrap bands** carry it round the corners.
* The underside of the roof over the porch is a **white ceiling** (#F2F1EA).
* A **wooden railing** closes the open sides: a flat cap board (0.10 thick,
  0.30 deep, its top 2.88 ft -- about 34 1/2 in -- above the deck), a top rail
  and a bottom rail (0.14 x 0.13), and 2x2 balusters (0.12 square, 2.18 tall)
  on 0.44 ft (5.3 in) centres. A run shorter than 0.4 ft is left out. The
  railing stops 0.16 ft clear of every post.
* **The widest gap is the way in**: between the corner posts and any added
  posts, the widest gap is left open. On a side porch the bay in front of the
  porch door stays open instead (the widest gap only if there is no door).
* A side porch gets a **two-step wooden stair** at the entry: a lower box
  1.42 ft deep and 0.30 tall standing on the ground, and an upper box 0.72
  deep and 0.34 tall on it, both 2.6 ft wide -- two treads (tops at 0.30 and
  0.64 ft), then the deck at 0.92 ft: three rises of 0.30, 0.34 and 0.28 ft.

Three kinds, set by the style's `porch` trait:

| `porch` | styles (standard line) | what it is |
|---|---|---|
| `F` | Cabin, Lofted Barn Cabin | a 4 ft deep porch across the whole front end, inside the length (the front wall stands 4 ft back). Header band across the end, a 4 ft wrap band down each side, ceiling, two corner posts, railing across the front and down both sides from 3.75 ft back. |
| `S` | Side Cabin, Loft Side Cabin | a 4 ft deep notch in the door side (+x), 8 or 12 ft long -- 8 on a building under 20 ft -- at the back end, flipped to the front end, or in the middle (the design's `pLen`, `pFlip`, `pMid`; `plan.span`). Header band across the open end (not when centred), a band along the opening, ceiling, a fixed post at the wrap corner (not when centred), railing along the edge, a railing across the porch end (not when centred), the step. |
| `C` | Deluxe Side Cabin, Deluxe Loft Side Cabin | a wrap porch: a 4 ft deck across the front end (the style adds 4 ft to L for it) plus a 12 ft run down the door side, closed behind by the P1 (angled), P2 and P3 porch walls. Bands across the end, along the 12 ft opening and on the 4 ft stub on the -x side, ceiling over the end 12 ft, two corner posts, railing across the end and down the side, a rail stub on the -x side. |

There is no porch deck here: the building's floor slab (`parts/floor.js`)
runs under the porch, as it does in Barnwright. The porch walls themselves
(set back, notched, P1-P3) are the siding part's; the trim boards where those
walls meet the main walls are `parts/porch-junction.js` (below).

## Stage

* `porch-frame` (id 19, kind `both` -- shown in the Finished AND the Framing
  view): the corner posts and the header / wrap bands over the openings (the
  porch's posts and beam).
* `porch` (id 12, kind `finish`): the ceiling, every railing run and the
  side-porch step.
* The porch junction trim (`parts/porch-junction.js`) is `trim`.

In Watch-it-build the posts and bands land with `porch-frame` (after the
siding), the rest with `porch` near the end. PIPELINE entry `porch`
(`parts/index.js`, entry 11): after the belt band and before the roofing --
Barnwright's buildShed draws the porch block (4020-4034) there. The junction
trim is its own entry, `porch-junction` (entry 5), straight after the corner
trim, attributed to part `porch`, because that is where buildShed draws it and
the trim material's triangles must come out in that order.

## Construction settings

* `porch.post` (default `"4x4"`, `library/construction.json`) -- caption only.
  The drawn post is Barnwright's 0.34 ft square whatever it says.
* `porch.railHeightIn` (34) and `porch.joist` ("2x6") are NOT read here. The
  drawn railing is Barnwright's (cap top 2.88 ft = 34.56 in above the deck);
  making it follow `railHeightIn` would move the look (34 is not 34.56).
  `porch.joist` belongs to the NEW framing part `parts/porch-deck-frame.js`.
* Not construction settings but design values the porch reads: the side
  porch's `plan.span` (from `pLen`, `pFlip`, `pMid`, `model/frame.js pSpan`),
  the porch posts (`plan.state.items` with `plan.CAT[cat].k === "post"`, on
  wall F or R) and the side porch's door (`k === "door"` on wall S1).

## Where it came from in Barnwright

`boisterous-lokum-a737e0/public/3ddesign.html` (pinned SHA-256
`0bdcf663c5cb988623d2cb0dd271156fb690564072b301b0a15b917fd921ac6c`):

* `railX`, `railZ`, `railAnchors` (2444-2464), `porchFront` (2465-2475),
  `porchSideCorner` (2488-2524), `porchCorner` (2525-2560);
* buildShed's porch block (4020-4034): the front porch's header band, wrap
  bands and ceiling, then `porchFront` / `porchCorner` / `porchSideCorner`;
* buildShed's porch junction trim (3946-3960) -> `parts/porch-junction.js`.
* `porchSide` (2476-2486, a full-length side porch for `porch "R"`) is dead
  code -- no style uses `porch "R"` and buildShed never calls it -- and was
  NOT ported. `wallDefs` still knows `porch "R"`.

Porting edits (contract, Porting rules), and nothing else:
* rule 1: `state` -> `plan.state`, `CAT` -> `plan.CAT`, `pSpan()` ->
  `plan.span`, `y0` from `engine/constants.js`, `texFlat` from
  `engine/tex-names.js`; `box gq2 pushQuad mat` are the kit's, bound to
  Barnwright's names; `mT` is `core.mT`; `topY` is `plan.topY`.
* The porch functions stay FUNCTION DECLARATIONS, inside `porchDrawing(plan,
  kit)` so they draw into this build's kit; their bodies read as Barnwright
  wrote them. `railAnchors` (pure) is also exported on its own.
* rule 7: `kit.setStage("porch-frame")` / `kit.setStage("porch")` before each
  block (`railX` and `railZ` set `porch` themselves).

## The owner's facts

Barnwright's comments, kept word for word in the code:
* "porches (natural pressure-treated wood, like the real cabins)" -- #96682F.
* "porches: white header band, white ceiling, wrap bands (like the real
  cabins)".
* "rails along the front edge; the bay in front of the door stays open".
* "wood step at the front entry"; "railing across the porch end, wall to
  corner post"; "fixed post at the wrap corner"; "fixed corner posts at both
  deck-end corners"; "rail stub along the back-side porch edge".
* "short buildings carry the 4x8 porch" (`pSpan`, `model/frame.js`): a side
  porch is 8 ft on a building under 20 ft long; 12 ft is offered from 20 ft.
* The corner porch is "a 4-ft deck past the end wall, then the blueprint
  walls" (`wallDefs`, `model/frame.js`).
* The cabin porch front "IN THE ORDER IT IS BUILT: door in the middle, a post
  to each side of the steps, then a window in whatever wall is left"
  (`includedItems`, `model/loadouts.js`) -- which is why a front porch's
  railing usually has its widest gap in the middle.

## Kept quirks

* The corner porch style's length includes the 4 ft deck (`dims()` adds it).
* `porchFront` takes an `mT` it never uses; `porchCorner` repeats the
  widest-gap loop inline twice instead of calling `railAnchors` (same answer).
* The side-porch entry test is `entryZ >= a[j]` and `entryZ < a[j+1]`, except
  the LAST gap, which also takes `entryZ === a[j+1]`.
* The step's boxes start at the ground (`y = 0`), not at the deck line `y0`.
* The band UVs are fixed numbers (`[15,0]`, `[5.2,0]`, `[5,0]`) or
  `(zHi-zLo)*1.25`; the ceiling's `[5,0]` / `W/0.8` and `15` / `5` /
  `sp.P*1.25` -- all look-defining.
* "pwood" is FIRST made here (the porch-post items ask for the same key with
  the same paint later); "ceil" is made here. On a front porch "ceil" is made
  before "pwood" (the header block runs before `porchFront`), on a side or
  corner porch after -- that is Barnwright's draw order.

## How to change it safely

* Run `node tools/check-golden.mjs --part porch` before and after; it must
  stay green on all 148 buildings (32 of them have a porch: every porch kind,
  flipped, centred, 8 and 12 ft, added posts, a resized side cabin).
* Keep the order of the blocks and of the `mat()` calls: the trim triangles
  of the junction boards, the bands and every material's draw order depend on
  it.
* Porch posts the customer adds are drawn by the openings part
  (`porch-post`); this part only reads where they are.
* A new porch shape is a new `porch` value AND new walls in `wallDefs`
  (`model/frame.js`) AND the siding cut-outs (`parts/siding.js`) AND the
  junction boards; do not bend an existing branch.
* OTHER PARTS COPY THIS PART'S RULES -- change them together:
  * `parts/ramp.js` imports `railAnchors` (a front or corner porch's ramp goes
    in the widest gap) and keeps its OWN copy of the side porch's entry rule
    (`entryZ`: in front of the porch door, else the middle of the widest
    gap). Change the way in here and the ramp lands in the wrong gap unless
    `ramp.js` changes too.
  * `parts/porch-deck-frame.js` (with `parts/floor-frame.js`) decks every
    porch and frames the front porch's floor under these posts; the posts
    stand on its boards in the Framing view.
  * `parts/openings/porch-post.js` draws the customer's extra posts in the
    same "pwood" paint at the same 0.34 ft size and the same edge offsets
    (0.20 ft on the front, 0.20 ft on the side), so the railing meets them.
* The STAGES are not checked by anything but eye (the golden check only drops
  framing-kind stages): posts and bands must stay `porch-frame` (shown in the
  Framing view), ceiling, rails and step `porch`, junction boards `trim`.
* If the look must really change, re-record the golden fixtures on purpose
  (`node tools/capture-golden.mjs`, with a reason).

## Checks that guard it

* `node tools/check-golden.mjs --part porch` -- every porch triangle (the
  junction trim included) of all 148 recorded Barnwright buildings, number
  for number: 15,112 triangles in 32 buildings; with `--case` on those 32 it
  also proves the porch drawn on its own is exactly its triangles on the
  whole building. Run with no `--part` it also proves the WHOLE building --
  the draw order of every material and every material's triangles and
  settings -- which is what proves the porch's triangles land in the right
  place among the other parts' in the shared "trim" material, and that
  "ceil" / "pwood" are made in Barnwright's order.
* `node tools/check-golden-labels.mjs` -- Barnwright's page redrawn and
  relabelled region by region (buildShed 3946-3960 and 4020-4034 are
  `porch`).
* `node tools/check-parts.mjs` -- valid part, caption fills in, this skill.
* `node tools/check-imports.mjs` -- loads in Node with no browser.
