---
name: part-gable-band
description: The 1x4 trim band across a gable end (at the eave line, or the loft line on a barn end) -- read before changing which buildings have one, its height, or how it meets the roof.
---

# Gable trim band (`parts/gable-band.js`)

## What it is in real life

A 1x4 trim board (3 1/2 in, 0.29 ft), painted the trim colour, nailed across
the gable end over the siding. On most buildings it sits at the eave line,
just under the wall top. On a barn (gambrel) end with no gable window it sits
at the loft line, 40% of the way up from the wall top to the ridge. It is
mitred into the rake boards at both ends, so the drawing stops it just short
of the roof on each side. It stands 0.10 ft proud of the siding with a
bottom, a top and two end returns, so it throws its own shadow line instead of
reading as paint.

No band on: a metal building (no wood trim), a lean-to, a single slope, the
Garden Utility and the Standard Barn (the style trait `"gableBand": false`),
the kennel's open front, and the front of a front-porch or corner-porch
building.

## Stage

Stage `gable-end` (kind `finish`). PIPELINE entry 8 (`parts/index.js`), after
the gable-end siding and before the gable vent (Barnwright draws fill, band,
vent for F then B in one loop; the three entries give each material the same
triangles in the same order).

## Construction settings

None directly. Which ends have a band and at what height is
`gableBandY(k, plan)` in `model/roof-shapes.js`, which reads the style's
traits (`metal`, `roof`, `gableBand`, `kennel`, `porch`), the items (a gable
window on that end) and `plan.prof`. The band's inset follows the first
segment of the roof profile, itself built from `roof.shapes.*`.

## Where it came from in Barnwright

`boisterous-lokum-a737e0/public/3ddesign.html` (pinned SHA-256
`85c4b022d2f75db2145f4ff5cf1ea43c1b52074f8972b96180d64840eb4c5d36`),
`buildShed`'s gable-ends loop, lines 3980-4001 (the face, `bandRet` for the
underside and top edge, and the two end returns). `gableBandY(k)` is
2231-2252, ported in `model/roof-shapes.js` as `gableBandY(k, frame, items)`
and shared with the door-height rule.

Porting edits, all from the contract's Porting rules:
* `gableBandY(k)` -> `gableBandY(k, plan)`; `state.type === "GU" / "SB"` ->
  the `gableBand: false` trait and `"DK"` -> the `kennel` trait inside it
  (rule 2);
* `T()` -> `plan.t`, `prof` -> `plan.prof`, `mT` is `core.mT`, the kit's
  `gq2 pushQuad` bound to Barnwright's names (rule 1); `bandRet` stays a
  function expression as Barnwright wrote it;
* `kit.setStage("gable-end")` (rule 7).

## The owner's facts

Kept word for word in the code: "a real 1x4 band: face proud of the siding,
with bottom, top and end returns, so it throws its own shadow line instead of
reading as paint".

The cottage band (Barnwright 2237-2244, kept in `parts/gable-band.js`):

> THE COTTAGE SHED HAS THE BAND, and this line used to say it did not ("the
> real cottage gable is clean"). Alan sent a photograph of a real one (Aug
> 2026) with the cream board running the full width of the gable at the eave
> line, mitred into the rake boards at both corners -- and Weather King's OWN
> illustration on our /building-cottage-shed page shows the same thing. Two
> independent sources against one comment somebody wrote. The METAL cottage
> is still clean: a metal building has no wood trim, and the t.metal test
> above already returns null for it.

And (Barnwright 2231-2233): the band height is "shared by the band builder and
the door-height clamp so a door's header casing always stops just under the
band instead of overlapping it."

## Kept quirks

* The inset at both ends is worked out from the profile's SECOND point
  (`prof[1]`): its height above the wall top (`rL2`) over its distance in from
  the building's side (`kx2 = W/2 - |prof[1][0]|`). On a gable (ridge at x=0)
  and a gambrel (the knee) that is exactly the slope at each end. On a
  saltbox (ridge at +0.18W) it is the steep FRONT slope's rate, used at the
  shallow back end too, so the back end of the band is inset too little. The
  cottage gets away with it only because its raised eave (`cottageEave`) lifts
  the roof line: the band's top is 0.27 ft over the wall top and the cottage
  roof line there is about 0.32 ft (worked out for 8, 10 and 12 ft wide). A
  saltbox style WITHOUT the cottage trait (none exists today) would put the
  back end of the band about 0.13 ft through the roof line.
* A gable window on the R or L wall counts as being on the FRONT end
  (`gableBandY`), so it drops the front band of a gambrel from 40% to the
  eave line.
* The returns are wound by swapping points when `sgn < 0` (the B end) and
  when `sgn * ec[1] < 0` (the end returns); that swap is what makes them face
  outward.
* The band's top edge is 0.29 above `by`; the eave band sits 0.02 under the
  wall top (`topY - 0.02`).

## How to change it safely

* Run `node tools/check-golden.mjs --part gable-band` before and after; it must
  stay green on all 148 buildings.
* The band's height lives in `gableBandY` (model/roof-shapes.js), which the
  door-height rule reads too: change it there, never here, and re-run the
  door checks (`node tools/check-golden.mjs --part door-wood,door-steel,door-lite,roll-up`).
* A style that should have no band gets `"gableBand": false` in the
  manufacturer file, not code.
* A real look change means re-recording the golden fixtures on purpose
  (`node tools/capture-golden.mjs`, with a reason).

## Checks that guard it

* `node tools/check-golden.mjs --part gable-band` -- every band triangle of
  the 110 recorded Barnwright buildings that have one, number for number
  (1,980 triangles), including the gambrel loft-line band, the cottage band
  and a gambrel end with a gable window; drawn on its own it is exactly those
  triangles.
* `node tools/check-parts.mjs` -- the part is valid and this skill is well formed.
* `node tools/check-imports.mjs` -- the file loads in Node with no browser.
