---
name: part-light
description: The outside wall light (the lantern beside a door, also placed by the electrical package's exterior-light option) -- read before changing how it looks or how high it hangs.
---

# Outside light (`parts/openings/light.js`)

## What it is in real life

A wall lantern outside the building, usually beside the door: a white fixture
with a warm bulb. The customer adds it on its own, or the electrical package's
"exterior light" option places it 1.2 ft past the switch beside the biggest
door (`model/layout.js pkFixtures`). On the picture:

* a white **backplate** on the wall and an **arm** up from it;
* a white **shade** box and a warm (`#F4D48A`) **bulb** box under it;
* its own tap target.

How high it hangs: `y0 + 6.6 ft` plus however far the customer dragged it,
never lower than `y0 + 2.2`, and never higher than
* 0.55 ft under the roof line on an end wall (F or B),
* 0.40 ft under the belt band on the tall wall of a single slope,
* 0.35 ft under the wall top anywhere else.

It gets none of the door and window trim: it is not an opening.

## Stage

`extras` (id 16, finish: "Shutters, lights and extras"): shown in the Finished
view, hidden in Framing, lowered into place at the `extras` step of
Watch-it-build. Drawn by PIPELINE entry 14, `openings`
(`parts/openings/index.js`), for every item whose catalogue `draw` trait is
`light`, in the order the items were added (Barnwright's `buildShed` line
4043).

## Construction settings

None. (Its height on an end wall follows the roof line, `plan.prof`, which a
company's roof settings shape.)

## Where it came from in Barnwright

`boisterous-lokum-a737e0/public/3ddesign.html` (pinned SHA-256
`0bdcf663c5cb988623d2cb0dd271156fb690564072b301b0a15b917fd921ac6c`):
`renderItem`'s light branch, lines **3142-3157** (`if(c.k==="light"){ ... }`),
after the preamble (3122-3140, `common.js eachItem`).

Porting edits (docs/ARCHITECTURE.md, Porting rules), and nothing else:
1. Rule 1: `wallDefs()` -> `plan.ws`, `dims()` -> `plan.d`, `T()` -> `plan.t`,
   `prof` -> `plan.prof`; `mat wq box wallPt` are the kit's; `profileYat` from
   `model/roof-shapes.js`, `y0` from `engine/constants.js`.
2. Rule 3: the branch was chosen by the kind (`c.k==="light"`); the item now
   reaches this module by its `light` draw trait.
3. Rule 6: `hitQuads.push` -> `kit.hit`; `CURIT=null; return;` -> the caller
   clears the current item on every way out (a light on a wall this building
   does not have draws nothing, as before).

## The owner's facts

None recorded: Barnwright's light branch carries no comment from Alan. The
height rules above are Barnwright's numbers.

## Kept quirks

* **The shade and the bulb are upright boxes in WORLD axes** (`kit.box`), so
  on the corner porch's diagonal wall (`P1`) they do not turn with the wall.
* **On an end wall the roof line is read at the light's DISTANCE from the
  middle** (`|u|`), so on an off-centre roof (single slope, lean-to, cottage)
  it is measured against the wrong side of the roof.
* The tap target is 1 ft wide and 1.3 ft tall, at 0.35 ft out.

## How to change it safely

1. Read this skill, `part-openings`, and the comments in
   `parts/openings/light.js`.
2. Run `node tools/check-golden.mjs --part light` before and after, then the
   whole `node tools/check-golden.mjs` (the paint and draw order of
   `lightFix` and `bulb`).
3. The heights (6.6, 2.2, 0.55, 0.40, 0.35) are also the drag limits the
   customer feels; `model/layout.js clampPos` keeps the drag (`vy`) between
   -4.2 and 3.2.
4. If the look must really change, re-record the golden fixtures on purpose
   (`node tools/capture-golden.mjs`, with a reason).

## Checks that guard it

* `node tools/check-golden.mjs --part light` -- every light triangle of the
  148 recorded Barnwright buildings, number for number (7 buildings, 196
  triangles, Sep 26 2026): on a side wall, dragged up to its limit, dragged
  down, on a front gable end beside the doors, on a single slope's tall wall,
  on a kennel, and placed by the electrical package.
* `node tools/check-golden.mjs` -- also the draw order and paint.
* `node tools/check-parts.mjs`, `node tools/check-imports.mjs`.
