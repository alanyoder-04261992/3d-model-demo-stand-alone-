---
name: how-its-built
description: The "How it's built" settings -- roof pitch, barn roof height by width, eave and gable-end overhangs, wall height, wooden shop door height, porch depth, side porch lengths and dormer side -- for one style, a whole business or the shop standard; use when a business builds a style differently, when Alan confirms a shop number for the standard, when adding a new knob, or when a save is refused with a How it's built problem.
---

# How it's built

Alan (Oct 2026, "lets all 5"): a business types how its buildings are built
-- the roof pitch like 5/12, the wall height like 7 ft 9 1/2 in -- with sane
limits, a plain error on a typo, and every change in History. The module is
`model/build-settings.js` (pure: the designer, the server and the checks all
use it). Read it with `docs/ARCHITECTURE.md` "How it's built".

## The knobs

| id | words | unit (stored as a number) | limits | applies to |
|---|---|---|---|---|
| `roofPitch` | Roof pitch | rise per 12 (5 = 5/12) | gable 3-12 (a metal gable roof 4-12), lean-to 1 1/4-6, single slope 2-8 -- the flattest the 3D designer can frame (`pitchLimits`, shared with `model/style-check.js`); typed in quarter steps | gable, lean-to, single slope roofs |
| `barnPeak` | Barn roof height | inches from the wall top to the top of the trusses, by width in feet `{"10": 48}`; the roof line over the deck stands about 1/2 in higher (`model/roof-shapes.js barnTrussPeakFt`) | 24-96 in, widths 6-16, 1-8 widths, a wider barn never lower | barn (gambrel) roofs |
| `eaveOverhang` | Eave overhang | inches, measured level out from the long walls | gable 0-12, barn 0-3 | gable and barn roofs (not the cottages) |
| `gableEndOverhang` | Gable-end overhang | inches | 0-12 | every roof |
| `wallHeight` | Wall height | inches, floor to the top of the wall plate | 48-120 | every style; never business-wide |
| `doorHeight` | Wooden shop door height | inches | 60-96 | every style |
| `porchDepth` | Porch depth | feet | 3-8, 4 ft of room left inside; a wrap porch at most 7 ft and W - 6 | porch styles |
| `sidePorchLengths` | Side porch lengths | whole feet, a list | 1-4 lengths, 4-20 ft, none twice; each leaves at least 4 ft of side wall on every size it is offered on (the shortest on every size, the others from 20 ft long) | side porch styles |
| `dormerSide` | Dormer side | "door" or "back" | -- | dormer styles |

`parse(id, text, {kind})` reads what a person types ("5/12", "5 1/2/12",
"7 ft 9 1/2 in", "93 1/2", a bare number in the box's unit) and says what is
wrong in plain words ("Porch depth 72 ft is deeper than 8 ft. Did you mean
72 in (6 ft)?"). `format(id, value)` writes it back the way a shed builder
says it.

## Where a number lives, and which wins (first found)

1. `offer.<KEY>.built` -- this style's own.
2. `offer.<BASE>.built` -- for a style of the business's own (`base`), the
   style it is built like.
3. `built` (top level) -- business-wide, by roof kind
   (`{"roofPitch": {"gable": 6}, "doorHeight": {"barn": 71.5, "other": 76.5}}`),
   unless the style has a **style feature** for that knob: the flush gable
   ends of the Garden Utility and the cottages (`rakeOverhang`), the Standard
   Barn's own shoulders (`gambrel`), the Dormer Shed's own main roof. A
   number set on that style itself replaces the feature.
4. `library/manufacturers/<m>.json` `styles.<KEY>.built` -- the shop
   standard, except on a construction path the business's own raw
   `construction` already sets. Today the Utility Shed and Side Utility
   (5/12, a 4 in eave, 93 1/2 in walls) and the Lofted Barn and Side Lofted
   Barn (79 1/2 in walls, barn roofs 43 3/4, 48 and 51 in at 8, 10 and
   12 ft wide) carry Alan's shop numbers (Oct 2026, "yes match"), each with
   a `_source` note. Barnwright's own company in the checks is the standard
   without these blocks (`tools/lib/barnwright-company.mjs`), so the golden
   test still draws Barnwright's numbers; `node tools/check-shop-numbers.mjs`
   holds the shop numbers (`test/golden-shop/`).
5. The library's raw number (`library/construction.json`, the style's raw
   traits).

Barn roof heights are found **width by width** (`byWidthFirst`): each width
takes the first layer that names it, so a height typed for 10 ft wide keeps
the shop's 8 and 12 ft heights, and an empty box really is the next number.
`t.built.barnPeak.parts` says where each width came from. If the joined
heights would drop as the barn gets wider, the save is refused in words
("Barn roof height: the 12 ft wide barn (4 ft 3 in, the standard) would be
lower than the 10 ft wide barn (5 ft). Type a height for the 12 ft wide
barn too."). `effective()` lists the height at every width sold, a width
no number names (the Lofted Barn's 14 ft) at the height it is drawn, and
History says each width that moved ("Lofted Barn barn roof height at 10 ft
wide: 4 ft → 4 ft 2 in").

An extra (`options.extras[i].built`) may hold roof pitch, barn roof height,
eave and gable-end overhang and door height. Its roof pitch only ever makes
a roof steeper (`constructionFor`'s "at least"); its other numbers replace
the style's for that design. An extra may not change the wall height, the
porch or the dormer. `options.extras[i].styles` (["UT", "SU"]) offers it
only on those buildings and the styles built like them
(`model/company.js extraOfferedOn`): the designer's list
(`model/pricing.js optxList(cat, state)`), `normalize` (takes it off in
words), the server (409) and the Options tab ("Offered on" chips) all
follow it. The example price list's **Steep roof (7/12)** is one: Alan's
steep A-frame pitch, on the Utility Shed and Side Utility.

## How a number reaches the drawing

`resolve()` (`model/company.js`) calls `apply()`: traits are set on the
style (`wallH`, `porchDepthFt`, `sidePorch`, `dormerSide`; a replaced
feature is deleted) and roof and door numbers go into the style's own
construction layer `t.construction` (plain values: `roof.shapes.gable.rise =
{"w": p/24}`, `roof.dormerRise` on the Dormer Shed, `roof.shapes.gambrel.peakIn`,
`eaveOverhang {"flatIn": n}`, `rakeOverhang` / `endOverhang` in feet,
`openings.doorHeightIn`). `constructionFor()` merges library < manufacturer
< company < `t.construction` < the chosen options. `t.built` keeps where
each number came from; `effective(cat, key)` gives the screens every knob's
number, its words and its source.

## Reading never fails; saving refuses only new problems

* `validate()` keeps its old rules: the lot's designer and quotes open on any
  price list that opened before.
* `strictProblems()` (model/company.js) holds the new ones: every
  `problems()` line here, a raw construction value on a path a knob owns
  (`KNOB_PATHS`: "The construction settings hold the roof pitch. Set it in
  How it's built instead."), an extra's knob it may not hold, and an extra's
  or an option's `construction` effect (`effectProblems()`: a path the code
  never reads, a value that cannot be built, or a path a knob owns -- the
  owner reads "Steep roof: set this extra's roof pitch in How it's
  built."). The Dealer
  Center's save (`server/office/price-list.js check(next, previous)`) refuses
  only the ones the stored price list did not already have; putting an old
  copy back is always allowed.
* On read, a bad value is skipped -- the next layer wins -- and said in
  `cat.settingsWarnings` for the owner, with the number built instead and
  where it comes from ("Utility Shed: Roof pitch "5\12" cannot be read:
  write it like 5/12. Until it is fixed in How it's built, it is built at
  5/12 (the standard)."). An extra whose `construction` effect
  has a problem changes nothing ("Steep roof: its construction settings
  could not be used, so it does not change how the building is built.").
* `liftRawRules()`: the Barnwright setup connector's raw roof pitch rule
  list (one `{"when": {"styles": [K]}, "value": {"w": N}}` per gable style,
  then the library's rise) becomes `offer.K.built.roofPitch`. `resolve()`
  lifts in memory, `save()` for real ("Roof pitch rules moved into How it's
  built (no building changes)"); the drawn roof is identical.
* History: `describeChanges()` -- "Lofted Barn wall height: 6 ft 7 1/2 in
  → 7 ft", "Business-wide roof pitch for gable roofs: standard → 6/12
  (Utility Shed and Side Utility 5/12 → 6/12; Garden Utility, Cabin and 6
  more about 6 1/2/12 → 6/12)" (`groupByWords`, `namesWords`); the
  business-wide card says "Built now: 5/12 on the Utility Shed and Side
  Utility; about 6 1/2/12 on the ..." under each box.
  A change that moves what is drawn (`drawnOf`) raises `cfg` and open
  designers redraw; the standard's number typed on a style says "standard
  (5/12) → 5/12 of its own" and keeps `cfg`; the same number in other words
  says nothing. `tidyBuilt()` stores each value as its number on save, and
  a barn width given twice ("08" and "8") is refused.

## In the Dealer Center (the screens and the save)

* `ui/office/views/price-list/built.js`: each style's editor ends with
  "How it's built" -- one box per knob that applies, the number an empty box
  builds with as the placeholder and where it comes from ("Standard: 7 ft
  9 in", "Built like the Utility Shed: 6/12"), chips for dormer side and
  side porch lengths, and "Check every size". The Buildings tab ends with
  "How your buildings are built" (business-wide, by roof kind, each box
  saying which styles it reaches, `businessReach()`), and opens with a
  yellow note for numbers the 3D designer could not use
  (`cat.settingsWarnings`) and what the quiet check found. The Options tab
  gives each extra "Roof pitch at least". Managers and dealers see the
  numbers read only. A box that cannot be read keeps the typed words in the
  draft, so `ui/office/views/price-list/model.js builtProblemsOf()` shows
  the problem under it (data-field / data-msgs `built:<KEY>:<knob>`,
  `built:biz:<knob>:<kind>`, `extra:<i>:roofPitch`) and Save waits.
* `model/built-check.js` + `server/office/built-check.js`: every save draws
  the styles whose numbers changed -- their own, business-wide, the style
  they are built like, or the business's raw construction settings for that
  roof -- (or gained sizes, or are newly sold) at every size, and each of
  them again with every extra that changes how it is built switched on (the
  sample's Steep roof with a new wall); an extra whose numbers or
  construction changed, or that reaches a style it did not reach before
  (its styles list widened, a style it lists is sold again), is drawn on
  each style it reaches (`changedStyles`). Within about 3 s, the size each
  style opens on first for every style, then the smallest and largest of
  each, then the rest (`jobSteps`, `checkJobs`). A problem the business's
  numbers cause -- not one the standard building has too, with the
  business's raw construction as it was before the save -- refuses the
  save in words. What is left after 3 s is listed ("Not checked yet: ...
  Press Check every size.") and never refuses. Putting an old copy back is
  never refused; what does not fit is said instead.
* Raw construction and extras' construction settings: a barn roof's rises
  and knee are How it's built's (`KNOB_PATHS.barnPeak`: "set it in How it's
  built"); a roof length no knob owns (a saltbox rise or ridge, a lean-to
  eave) must draw: 0 to 8 ft above the wall at 6 and 16 ft wide, knee and
  ridge inside the walls, an eave 0 to 2 ft out
  (`model/construction.js roofValueProblems`).
* History: `describeChanges()` (per style and business-wide),
  `describeExtraBuilt()` ("Steep roof: roof pitch at least 7/12"), and
  "Wall upgrades priced by the square foot follow the new wall height: ..."
  when a wall height moves a per-square-foot wall price.
* Words: a pitch between quarters is said "about 6 1/2/12"; a door opening
  in inches ("76 1/2 in"); walls, barn heights and overhangs in feet and
  inches ("7 ft 9 1/2 in", "4 ft 3 in", "4 in").

## Adding a knob

1. Add it to `KNOBS` (words, unit, business-wide keys, `inExtra`), its limits,
   `knobsFor()` (which styles), `mapKnob()` (which trait or construction path)
   and `KNOB_PATHS` if it owns a construction path; `plainValue()` for what a
   style has without it.
2. The drawing must already read that trait or path with today's number as
   its default -- the golden check (`node tools/check-golden.mjs`) must stay
   the same.
3. Prove it in `tools/check-build-settings.mjs` (it moves the drawing, typing
   and errors, which layer wins) and, for a save, `tools/check-office.mjs`.
4. Update this skill, the part skills it reaches and `docs/ARCHITECTURE.md`.

## Checks

* `node tools/check-build-settings.mjs` -- every seam, parse and format, the
  order of the layers, features, extras, the lift, problems and History.
* `node tools/check-office.mjs` -- saves refuse new problems in plain words,
  an older price list keeps working, History lines, cfg, and the every-size
  check on save (a 5 ft wall refused with the door words, a price change
  draws nothing, a 1 ms budget still saves, a Steep roof extra checked on
  the gable styles).
* `node tools/check-how-its-built.mjs` -- the screens in Chromium: typing,
  problems under the box, Check every size, the refused and the good save,
  the quiet check, a manager's read-only numbers and the "try it" demo, at
  1280 and 390 wide.
* `node tools/check-golden.mjs` -- with no settings, every building is
  Barnwright's triangle for triangle.
