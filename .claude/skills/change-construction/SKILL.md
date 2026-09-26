---
name: change-construction
description: Change how the buildings are framed -- stud size or spacing, floor joists, trusses or rafters and their spacing, headers, plates, blocks and anchors, the roof deck, the loft, the porch -- for one company, a manufacturer or everybody; use when a company builds differently, when Alan confirms or corrects a framing assumption, or when an option should change the frame.
---

# Change the construction numbers

The Framing view and Watch it build draw real lumber, sized from
**construction settings**, never from numbers typed into the parts. So "Acme
uses 2x6 studs at 24 in" is a settings change: no part file changes. Read
`docs/ARCHITECTURE.md` "Construction settings" and "Framing datums", and the
`_help` notes in `library/construction.json`.

## Where a number lives (later wins)

1. `library/construction.json` -- the defaults, for **everybody**.
2. the manufacturer file's `construction` block
   (`library/manufacturers/standard.json`) -- everybody selling that line.
3. the company's `construction` block (`companies/<id>/company.json`) --
   **that company only**. This is almost always the right place.
4. the options the customer picks: an option with a `construction` effect,
   like the standard line's `rates.jo12` (`{"floor.spacingIn": 12}`) and
   `rates.dbl` (`{"floor.deck.layers": 2}`); a company's own extra can carry
   an effect the same way.

Layers merge **key by key** (a company's `{"walls": {"spacingIn": 24}}` keeps
the default stud size); a list or a plain value **replaces**. (One exception:
in a manufacturer file that `extends` another, its `construction` block
replaces the parent's section by section.)

## Rules that depend on the building

Any value can be a rule list, first match wins, and it must end with a rule
with no `when`:

```json
"joist": [ { "when": { "maxW": 8 }, "value": "2x4" }, { "value": "2x6" } ]
```

`when` may test `minW maxW minL maxL` (feet), `styles` (a list of style keys),
`roof` (a shape or a list) and `metal` (true / false). The header rule tests
the opening instead: `minSpanFt maxSpanFt`. A test the reader does not know is
refused in plain words, never ignored.

## Common changes (in the company's file)

```json
"construction": {
  "walls": { "stud": "2x6", "spacingIn": 24, "topPlates": 1 },
  "floor": { "spacingIn": 12 },
  "roof":  { "framing": "rafter", "spacingIn": 16, "chord": "2x6" },
  "site":  { "anchors": [ { "when": { "maxL": 20 }, "value": 4 }, { "value": 6 } ] }
}
```

* **walls**: `stud`, `spacingIn`, `bottomPlates`, `topPlates`, `corner`,
  `header` (a rule list by opening span), `studLengthIn` (caption only).
* **floor**: `joist` (rule list), `spacingIn`, `rim`, `deck` (`thicknessIn`,
  `sheet`, `layers`).
* **roof**: `framing` (`truss` or `rafter`), `spacingIn`, `chord`,
  `gussets`; `roofDeck`: `type` (`purlins` / `osb`, a rule list by `metal`),
  `purlins` (`size`, `spacingIn`), `sheathingIn` (7/16 in = 0.4375).
* **site**: `blocks`, `perimeterFtPerBlock`, `anchors` (rule list by length).
* **loft**: `joist`, `spacingIn`, `deck`. **The loft DEPTH is not here**: it
  is the style's `loft` trait (`{"ends": ["F","B"], "depthFt": 4}`) in the
  manufacturer file. For everybody, change it there; for one company only,
  give that company a manufacturer file that `extends` the standard one and
  repeats the lofted styles with its own `depthFt` (see the `add-a-style`
  skill).
* **porch**: `post`, `joist`, `railHeightIn`.
* **interior**: `benchHeightIn` (36) and `shelfHeightIn` (60) -- Alan's
  answers are the defaults in `parts/interior.js`; the library has no
  `interior` block yet, so a company adds one to change them.
* **buildOrder** (the Watch-it-build order) and **notes** (the width notes on
  the contact sheet).

## Numbers that change the FINISHED building

Most numbers only change the framing. These also move the finished picture,
because Barnwright's drawing reads them: `openings.doorHeightIn`,
`openings.windowTop`, `skids.table` and `skids.bunkSpacingIn`, and everything
under `roof` that shapes the roof line (`shapes`, `dormerRise`,
`cottageEave`). Changing one **for a company** is allowed (their building then
differs from Barnwright's on purpose); changing one **in the library or the
standard manufacturer file** changes every Barnwright building and turns
`check-golden.mjs` red -- do not, unless Alan decides it (then see the
`check-the-look` skill).

## When Alan confirms or corrects an assumption

`docs/FOR-ALAN.md` ("What you still need to decide") lists every number we
chose. When he answers:

* change the number where it lives (usually the library, for everybody);
* take the ASSUMPTION note off: `site.anchorsAssumed` in
  `library/construction.json`, `"assumed": true` on a style's `loft`, and the
  word ASSUMPTION in the `_help` note;
* take it off the list in `docs/FOR-ALAN.md` and add it to the settled facts
  there (with his words and the date), and copy his words into the part's
  skill under "The owner's facts".

`node tools/check-docs.mjs` fails while a number is still marked as an
assumption in the settings but missing from Alan's list.

## Checks, and what they prove

* `node tools/check-construction.mjs` -- the defaults are the contract's, rule
  lists settle per building, options change the frame, layers merge in the
  right order, the door and window shop rules give Barnwright's numbers and
  follow a company's own.
* `node tools/check-framing.mjs` -- on more than 1,000 buildings, and on test
  companies that build differently (fewer blocks and more anchors, 19.2 in
  joists, 2x6 studs at 24 in with one top plate, tripled headers, a triple
  floor): every piece stands where framing can stand, nothing overlaps or
  floats, every door and window is framed (jacks, kings, header, sill and
  cripples), headers are the size the rule gives, and the spacing is the
  construction number.
* `node tools/check-framing-roof.mjs` -- trusses or rafters at the spacing,
  one at each gable end, inside the roof as drawn; also with rafters, 16 in
  spacing, 2x6 chords, 2x6 studs, purlins on a painted building, OSB on a
  metal one and a 2x4 loft joist.
* `node tools/check-parts.mjs` -- every caption still fills in from the
  settings.
* `node tools/check-golden.mjs` -- the finished buildings did not move.
* Browser: `node tools/check-views.mjs` (a company with 24 in studs and 16 in
  trusses reads its own numbers in the Framing note and the Watch-it-build
  captions) and `node tools/check-gallery.mjs` (the wall-framing card reads
  "24 in on centre").

These sweeps build their own test companies; they do **not** read a real
company's file. For a real company, also open `/?company=<id>` (after
`npm run serve`), switch to Framing, and look at its smallest and largest
building: the note under the view names the stud, truss and joist sizes it
now uses. Then `node tools/check-all.mjs --fast`.
