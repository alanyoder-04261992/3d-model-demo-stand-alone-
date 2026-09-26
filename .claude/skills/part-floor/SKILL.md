---
name: part-floor
description: The floor deck of a portable building as the finished picture shows it (the slab the walls stand on) -- read before changing the floor's height, inset, segments or colour.
---

# Floor (`parts/floor.js`)

## What it is in real life

The floor is framed on the skids: joists across the width (2x6, or 2x4 on an
8 ft wide and smaller building), a rim joist along both long sides, and
tongue-and-groove decking on top. Its top is the line every wall, door and
roof height is measured up from: `y0 = 0.92` ft (11 in) above the ground. On
a dog kennel the floor is a grey kennel floor that runs right out to the
edges.

The finished picture draws the floor as one solid slab, from the top of the
skids (y 0.5) up to the deck top (y 0.92). The real joists and decking are
their own NEW parts for the Framing view: `parts/floor-frame.js` and
`parts/floor-deck.js`.

## Stage

Stage `floor` (kind `finish`): shown in the Finished view only. The Framing
view shows the real joists and decking instead, and Watch-it-build shows the
slab only once the playback ends in the Finished view. PIPELINE entry 2
(`parts/index.js`), right after the skids: Barnwright draws both in the same
floor loop at the start of `buildShed`.

## Construction settings

* None change the drawing. The slab is Barnwright's.
* The caption reads `floor.joist`, `floor.spacingIn`, `floor.rim`,
  `floor.deck.sheet` and `floor.deck.thicknessIn`
  (`library/construction.json`; `floor.joist` is 2x4 on 8 ft wide and
  smaller, else 2x6).

## Where it came from in Barnwright

`boisterous-lokum-a737e0/public/3ddesign.html` (pinned SHA-256
`0bdcf663c5cb988623d2cb0dd271156fb690564072b301b0a15b917fd921ac6c`),
`buildShed` lines 3867-3877:

```js
var mFlr=state.type==="DK"? mat("kfloor",texFlat,"#8f9599",0.18,20) : mWd;
var NF=Math.max(3,Math.ceil(L/2.5)), FIN=(state.type==="DK")?0:0.03;
for(var fi=0;fi<NF;fi++){
  var fz0=-L/2+(L-FIN*2)*fi/NF+FIN, fz1=-L/2+(L-FIN*2)*(fi+1)/NF+FIN, fzc=(fz0+fz1)/2, fl=fz1-fz0;
  ... skid boxes ...
  box(mFlr,0,0.5,fzc,W-FIN*2,0.42,fl);
}
```

Porting edits (contract, Porting rules): `state.type==="DK"` -> the style's
`kennel` trait; the segment arithmetic moved, unchanged, into
`floorSegments(plan)` so the skids use the very same segments; `mFlr` is
`core.mFlr`, made by `engine/assemble.js` with the other core materials (a
`kfloor` material on a kennel, else the `wood` material); `kit.setStage("floor")`.

## The owner's facts

Barnwright's note on the real construction (3ddesign.html 2147-2150, kept in
`parts/floor.js`): "Floor: 2x6 joists on skids with 5/8" decking
(8-ft-wide and smaller use 2x4 joists) -- that assembly is the 0.92 ft base
line y0." And (buildShed, kept): the deck is tucked 0.03 ft inside the walls
"so the siding skirt that hangs past the wall bottom never fights it for a
plane".

## Kept quirks

* The slab is SEGMENTED into `max(3, ceil(L / 2.5))` pieces along the length
  (look-defining: each piece is shaded on its own).
* It is INSET 0.03 ft from the walls on every side (0 on a kennel).
* On a corner-porch cabin `L` includes the 4 ft porch deck, so the slab runs
  under the porch too, as in Barnwright.

## How to change it safely

* Do not change the numbers in `parts/floor.js` or `floorSegments()`: they
  also place the skids. Run `node tools/check-golden.mjs --part floor,skids`
  before and after; both must stay green on all 148 buildings.
* The floor colour is Barnwright's `wood` (#6f5c42) and kennel `kfloor`
  (#8f9599), made in `engine/assemble.js`; other parts share the `wood`
  material, so changing it changes them too.
* If the look must really change, re-record the golden fixtures on purpose
  (`node tools/capture-golden.mjs`, with a reason).

## Checks that guard it

* `node tools/check-golden.mjs --part floor` -- every floor triangle of all
  148 recorded Barnwright buildings, number for number (15,732 triangles),
  kennel floors included.
* `node tools/check-parts.mjs` -- valid part, caption fills in, this skill.
* `node tools/check-imports.mjs` -- loads in Node with no browser.
