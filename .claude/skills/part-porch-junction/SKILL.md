---
name: part-porch-junction
description: The trim boards up the inside corners where a side or wrap porch's walls meet the main walls -- part of the porch; read part-porch too before changing it.
---

# Porch junction trim (`parts/porch-junction.js`)

This is one piece of the PORCH. Its triangles are attributed to the `porch`
part, and the main skill is `.claude/skills/part-porch/SKILL.md` -- read that
first. This file exists because the boards are drawn at a different place in
the build from the rest of the porch.

## What it is in real life

On a Side Cabin or a Deluxe (wrap-porch) Cabin the porch is notched into the
building, so there are inside corners under the porch roof: where a short
porch wall turns into a long wall, where it meets the end wall, and, on the
wrap porch, the end-wall corner behind the deck. Each joint is covered with a
trim board painted the trim colour, like the outside corners. Drawn as a
square post 0.29 ft (3 1/2 in) on a side from the deck (`y0`) up the full wall
height.

* Wrap porch (`porch "C"`): five boards -- at the end-wall corner
  (`-W/2+0.11, L/2-4`), where the angled wall starts (`-W/2+4, L/2-4`), at
  both ends of the 4 ft side wall (`W/2-4, L/2-8` and `W/2-4, L/2-12+0.11`)
  and where the door wall meets the long wall (`W/2-0.11, L/2-12`).
* Side porch (`porch "S"`): three boards (notch corner and both junctions) at
  the back or flipped end, or four when the porch is centred.

## Stage

`trim` (kind `finish`): the Finished view; in Watch-it-build it lands with the
trim. PIPELINE entry `porch-junction` (entry 5, `parts/index.js`), attributed
to part `porch`: straight after the corner trim and before the kennel and the
gable ends, because that is where Barnwright's buildShed draws it (3946-3960),
and the trim material's triangles must come out in Barnwright's order.

## Construction settings

None. The boards follow the porch walls (`plan.span`, the style's wall
height).

## Where it came from in Barnwright

`boisterous-lokum-a737e0/public/3ddesign.html` (pinned SHA-256
`0bdcf663c5cb988623d2cb0dd271156fb690564072b301b0a15b917fd921ac6c`),
buildShed lines 3946-3960. Porting edits (contract, Porting rules):
`pSpan()` -> `plan.span`, `T()` -> `plan.t`, `W`/`L` -> `plan.W`/`plan.L`,
`y0` from `engine/constants.js` (rule 1); `box` is the kit's, `mT` is
`core.mT`; `kit.setStage("trim")` (rule 7).

## The owner's facts

Barnwright's comments, kept in the code: "white trim at the end-wall corner
and each porch wall junction" (wrap porch) and "white trim at the notch
corner and each porch wall junction" (side porch). White because the real
cabins' trim is white; the drawing uses the trim colour.

## Kept quirks

* Boards sit 0.11 ft in from a wall end where they meet an outside wall
  (`0.11`, `12+0.11`), and exactly on the junction elsewhere.
* The wrap porch's board positions are fixed numbers from the corner porch's
  blueprint walls (4, 8, 12 ft) -- they must move with `wallDefs` P1-P3 if
  those ever change.

## How to change it safely

Run `node tools/check-golden.mjs --part porch` before and after (it covers
these boards and the rest of the porch). Never move this entry in the
PIPELINE: the trim material's order would change. Change the porch walls in
`model/frame.js` and these boards together.

## Checks that guard it

* `node tools/check-golden.mjs --part porch` -- these boards are part of the
  15,112 porch triangles proved on 32 recorded buildings.
* `node tools/check-parts.mjs` -- valid part, caption fills in, this skill.
* `node tools/check-imports.mjs` -- loads in Node with no browser.
