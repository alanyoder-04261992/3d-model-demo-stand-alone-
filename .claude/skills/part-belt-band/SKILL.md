---
name: part-belt-band
description: The belt band on a single slope building -- the trim board along the tall wall just under the transom row -- read before changing it or the single slope's tall wall.
---

# Belt band (`parts/belt-band.js`)

## What it is in real life

The single slope's tall side (the right-hand wall, +x) rises above the
ordinary wall height and carries a row of transom windows up there. A white
trim board -- a belt band -- runs the full length of that wall at the ordinary
wall height, just under the transom row, the way it does on the real
building. Doors on that wall are kept under it (the door-height rule,
Barnwright 3176: "slope: doors stay under the belt band").

The drawing is one board on the R wall from `y0 + wallH - 0.04` to
`y0 + wallH + 0.25` (0.29 ft = 3 1/2 in), 0.035 ft proud of the siding,
painted the trim colour.

## Stage

Stage `trim` (kind `finish`). PIPELINE entry 10 (`parts/index.js`), after the
gable ends and before the porch: Barnwright draws it straight after its gable
loop.

## Construction settings

None. The board sits at the style's wall height (`plan.t.wallH`), on the R
wall from `plan.ws`.

## Where it came from in Barnwright

`boisterous-lokum-a737e0/public/3ddesign.html` (pinned SHA-256
`85c4b022d2f75db2145f4ff5cf1ea43c1b52074f8972b96180d64840eb4c5d36`),
`buildShed` lines 4015-4019:

    if(t.roof==="slope"){
      var wR9=ws.R, hR9=wR9.len/2;
      wq(mT,wR9,-hR9,y0+t.wallH-0.04,hR9,y0+t.wallH+0.25,0.035);
    }

Porting edits, all from the contract's Porting rules: `T()` -> `plan.t`,
`wallDefs()` -> `plan.ws`, `y0` from `engine/constants.js`, `mT` is
`core.mT`, `wq` is the kit's (rule 1); `kit.setStage("trim")` (rule 7).

## The owner's facts

Kept in the code: "single slope: white belt band under the transom row on the
tall wall". No measurements from Alan are recorded for it; its numbers are
Barnwright's drawing.

## Kept quirks

* The comment calls it white, but it is drawn in the TRIM colour: it wears
  whatever trim colour the customer picks.
* It runs the whole wall length (`-len/2` to `+len/2`), under the corner
  posts, which stand proud of it.

## How to change it safely

* Run `node tools/check-golden.mjs --part belt-band` before and after (the
  recorded single slopes: `--case ss-8x12,ss-10x20,ss-12x32,win-ss-12x24-tr-band,win-ss-10x20-tr-rotated-left,light-ss-10x20-tall-wall,gable-ss-10x20-oct,dbl-ss-12x24-w23-shut-colour`).
* The transom row and the doors on that wall are placed around this band
  (`model/layout.js` and the openings part): moving the band means checking
  them too (`node tools/check-golden.mjs --part window,door-wood,door-lite`).
* A real look change means re-recording the golden fixtures on purpose
  (`node tools/capture-golden.mjs`, with a reason).

## Checks that guard it

* `node tools/check-golden.mjs --part belt-band` -- every belt band triangle
  of the 8 recorded single slope buildings, number for number (16
  triangles); drawn on its own it is exactly those triangles.
* `node tools/check-parts.mjs` -- the part is valid and this skill is well formed.
* `node tools/check-imports.mjs` -- the file loads in Node with no browser.
