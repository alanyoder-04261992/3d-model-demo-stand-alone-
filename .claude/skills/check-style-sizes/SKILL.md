---
name: check-style-sizes
description: Check a building style at every size it is sold in, instead of by eye -- use after changing a style, a manufacturer file, the construction settings (roof pitch, overhangs, wall height, door height, porch, dormer), the standard doors and windows, or any part's geometry; when node tools/check-style-sizes.mjs goes red; when a Dealer Center save is refused with "every size" words; and before adding a line to test/style-sizes-known.json.
---

# Check a style at every size

Alan (Oct 2026, "lets all 5 to make it as fast as possible") wants every
style checked at every size automatically, not by eye. A business can now
set its own numbers (taller walls, another pitch, a deeper porch), and
nobody can look at every size after every change.

* `model/style-check.js` -- the checks. Pure: the tools run it, and it is
  written to run in the Dealer Center (browser) and on its server too.
  `checkBuilding(plan)`, `checkStyle(cat, key, {sizes, variants, known,
  budgetMs})`, `variantsOf(t, cat)`, `lengthWords(ft)`.
* `model/framing-geometry.js` -- the framing tests it shares with
  `tools/check-framing.mjs` (moved from `tools/lib/framing-geometry.mjs`,
  which re-exports it).
* `tools/check-style-sizes.mjs` -- runs it on every library style at every
  size Barnwright sells (with the shop standard, and with Barnwright's own
  numbers when they differ), on the demo and starter companies, and proves
  each check on a broken test style. In `check-all`. About 2 seconds.
* `test/style-sizes-known.json` -- the problems in today's buildings that are
  kept on purpose, each with its reason.

## What it looks at

Each building is drawn from the model's own geometry (`openingRect`,
`gableBandY`, `roofOutline`, `dormerGeom`, `loftZones`, `roomOutline`,
`porchOutlines`, every framing part's `members(plan)`), never a copy of it.

| Check | Problem (fails) | Warning (shown) |
|---|---|---|
| `draws` | a size that cannot even be laid out (reported in plain words, never a crash, so a save still gets its answer) | |
| `past-wall` | a door's or window's trim runs past the corner | trim under 1 in from the corner |
| `overlap` | two openings on one wall overlap | their casings touch or lap |
| `too-high` | head board above a side wall's top; on an end wall into the gable trim band or above the roof line; a gable window's glass above the roof | a gable window's trim cut by the roof; a porch header band above the wall or into the gable band |
| `gable-item` | a gable window the business sells, under the peak as low as it goes, pokes through the roof | its trim is cut by the roof |
| `eave` | the roof edge over a long wall under 6 ft from the floor, or in front of a door's head | in front of a window's head |
| `door-fit` | the wooden shop door more than 1/2 in shorter than `openings.doorHeightIn` | |
| `roof` | a slope that does not rise to the peak; a barn's upper slope as steep as its lower; the knee outside the walls; the peak under 1 ft or over 8 ft above the wall; a pitch outside gable 3-12, lean-to 1-6, single slope 1-8 /12 | the peak under 18 in |
| `roof-widths` | a wider width of the style lower than a narrower one | over 12 in more between neighbouring widths |
| `dormer` | the dormer front under 1 ft 2 3/8 in (the drawing would force it), its windows under 7 in, its roof not rising to the main roof | drawn shorter than its size |
| `porch` | an opening where there is no wall (open porch, kennel run); a porch post off the deck; under 4 ft of room left inside; the corner porch's angled wall under 2 ft sideways or its front wall under 1 ft | a porch post with no porch edge to stand on |
| `framing` | a framing part that cannot be worked out; a piece where framing may not stand; two pieces overlapping by over 0.01 ft; a piece resting on nothing | |
| `loft` | under 24 in from the loft floor to the roof framing at the middle | under 36 in |

Every line starts with the building ("Side Utility 8x12: ...") and says the
measurement the way a shed builder does (`lengthWords`: 2 3/8 in, 4 ft 3 in).

## Reading the report

`node tools/check-style-sizes.mjs` prints:
1. one line per fixture: the broken test style and the words the check said;
2. the known list working and the time budget;
3. a table per price list and style: sizes, buildings drawn (a side porch
   style is drawn 8 and 12 ft, at the corner, flipped and in the middle; a
   dormer style with each dormer), problems, warnings (how many of them are
   known), time. "the same building as library UT" means that style was
   already checked in the library run;
4. every kind of warning once, with how many there were
   (`--warnings` lists them all; `--style LB` runs one style).

A FAIL line names the building, the check and the words. Fix the building,
the style or the code. Never make a check quieter to get past it.

## Adding a known case

Only for a problem kept on purpose (Barnwright's standard layout that the
golden test holds, or a style that is so by design). One line in
`test/style-sizes-known.json`:

```json
{ "styles": ["SU"], "sizes": ["8x12"], "code": "overlap", "id": "overlap:R:w23/w72",
  "reason": "Barnwright's standard layout ... Kept for the golden test." }
```

* `code` and `id` exactly as the failure printed them; `styles` are library
  codes (a business's own style is matched by the style it is built like);
  leave out `sizes` or `variants` only when it really is every one.
* The reason is read by people: plain words, why it is kept, who decided.
* A line that matches nothing any more FAILS the check: take it out when the
  building is fixed (for example, once the gable fit rule stops offering a
  gable window that does not fit, BUILDFAST-SPEC E.4, its lines go).
* A business's own numbers are never added here: the Dealer Center refuses
  those saves instead.

## Adding a check or a variant

* A new check gets a code in `CODES`, a fixture in `tools/check-style-sizes.mjs`
  (a broken test style, the exact words, and the same building without the
  fault as its control) and a row in the table above.
* New How it's built numbers (porch depth, side porch lengths, dormer side)
  only widen `variantsOf`: the checks read the drawn walls (`plan.ws`,
  `plan.span`), so they follow whatever the style is set to. When the porch
  depth setting lands, add the fixture "a 10 ft wide wrap porch with a 7 ft
  depth" (today it is a 7 ft wide Deluxe Side Cabin, the same fault).
* The pitch limits (`ROOF_PITCH_LIMITS`) are the How it's built limits; when
  `model/build-settings.js` exists, read them from its `KNOBS`.

## Speed

About 7 ms a building here (plan, every opening, every framing piece,
region, overlap and bearing tests); the whole check about 2 seconds.
`checkStyle(..., {budgetMs})` stops starting new buildings after that long
and lists the rest in `unchecked` (typical size first, then the smallest and
largest); the roof-widths test always covers every size. A Dealer Center
save passes about 3 s, the price list on open about 1 1/2 s.
