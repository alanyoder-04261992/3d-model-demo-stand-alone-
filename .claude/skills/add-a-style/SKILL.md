---
name: add-a-style
description: Add a new building style (a new kind of shed, barn, cabin or garage) to the designer -- use when a company or manufacturer sells a building the style list does not have, or asks to rename, resize or re-door an existing style.
---

# Add a building style

A style is **data**: an entry in a manufacturer file saying its name, roof
shape, wall height, traits and standard doors and windows. Prices never go
there -- every company that sells the style prices it in its own file. Read
`docs/ARCHITECTURE.md` ("Catalogue: manufacturer + company", "Style traits",
"Loadouts") before starting.

## 0. Is it really a new style?

* **Same building, another name or other sizes** -- no new style. The company
  renames it in its own `offer` (`"LB": {"name": "Loft Barn", "sizes": {...}}`)
  and lists the sizes it sells. Done.
* **A building the traits below can describe** (a roof shape that exists, a
  wall height, a porch, a loft, a dormer, metal or painted, its own doors and
  windows) -- a new style entry, no code. This skill.
* **A shape nothing can describe yet** (a new roof shape, a wall that is not
  straight, a new kind of porch) -- that is code in `model/roof-shapes.js` and
  the parts. Tell Alan first: it is a bigger job, and every existing building
  must still draw exactly as Barnwright does (`check-the-look` skill).

## 1. Where the entry goes

* A style of the **standard portable-building line** (the one Barnwright draws):
  `library/manufacturers/standard.json`, under `styles`.
* A style of **another builder**: a new file `library/manufacturers/<id>.json`
  with `"extends": "standard"` (it then has every standard style, item and
  colour, plus its own), its own `id` and `name`, and its `styles`. A company
  selling it sets `"manufacturer": "<id>"` in its file. A manufacturer file
  carries **no prices** (validation refuses one), and `extends` may not loop.

**Never change an existing Barnwright style's entry** (its `roof`, `wallH`,
traits or `loadout`): the 148 golden buildings and `check-model-live.mjs`
hold those to Barnwright's own numbers. A new style has a new key.

## 2. The style entry

```json
"TS": {
  "name": "Tall Side Utility",
  "category": "Utility & Storage",
  "roof": "gable",
  "wallH": 8.5,
  "side": true,
  "loadout": [
    { "cat": "w72", "wall": "R" },
    { "cat": "w23", "wall": "R", "at": { "sym": "L/4+1.4" } }
  ]
}
```

* key: 1 to 8 letters or digits, not already used. (In a file that
  `extends` another, a style with the same key REPLACES the parent's -- so
  never reuse a standard key by accident. Note the merge is shallow: a child's
  `palettes.paint` list replaces the whole standard paint list.)
* `name`, `category` (the group its button sits in unless a company groups
  its styles itself).
* `roof`: `gable`, `gambrel`, `salt`, `lean` or `slope` (the roof numbers for
  each are in `library/construction.json` `roof.shapes`).
* `wallH`: wall height in feet above the deck.
* flags: `metal` (metal siding from the metal colours; purlins under the roof
  by default), `dormer` (offers the dormer sizes), `porch`: `F` front, `S` side
  notch, `C` corner; `side` (a side-entry style, recorded as Barnwright has it;
  where the doors go comes from the loadout).
* traits (the parts read these, never a style key):
  `kennel`, `cottage`, `gambrel: {lowerRise, upperRise, knee}` (each
  `{"ft": n}` or `{"w": fraction of the width}`), `gableVent: false`,
  `gableBand: false`, `rakeOverhang` (feet), `loft: {"ends": ["F","B"],
  "depthFt": 4}` -- a loft depth nobody has confirmed carries
  `"assumed": true`, and `docs/FOR-ALAN.md` must list it (check-docs holds
  that).

## 3. The standard doors and windows (the loadout)

Either a **named Barnwright recipe** (`"barnwright:UT"` ... one per Barnwright
style, `NAMED_RECIPES` in `model/loadouts.js`) when it comes with exactly
what a Barnwright style comes with, or a **data recipe**: a list of

* `cat` -- the item code (`w72`, `w48`, `w23`, `tr`, `d36lite`, `ru8`, `fake`
  ...: `items` in the manufacturer file); `wall` -- `F`, `B`, `R` or `L`;
* `at` -- `"center"` (default), `{"pos": "q"}` (feet from the middle, + to the
  right from outside), `{"fromStart": "0.9"}` / `{"fromEnd": "1.2"}` (gap from
  the wall's left / right end), `{"sym": "L/4+1.4"}` (a matching pair);
* `when: {minL, maxL, minW, maxW}`, `ifFits: true` (left off when it would
  not fit), `dbl: true` (a double window),
  `repeat: {"count": "...", "spread": "..."}`.

Numbers are formulas over `W L q len CASING CAT.<item>.w CAT.<item>.h` with
`+ - * / ( ) ? :`, comparisons and `min max floor ceil round abs` -- read by a
small parser, never `eval`. `model/loadouts.js` has the full rules; the data
recipes in `tools/check-companies.mjs` (section 8) are the best examples: they
reproduce thirteen of the named Barnwright recipes exactly, at every size (the
utility, side-door, garden, barn, single-slope, garage and kennel ones -- the
cottage, backyard utility, dormer shed and the cabins have no data twin yet).

Every item a style comes with must be priced by every company that sells the
style (0 is fine): included items are charged as the difference when swapped.

## 4. Prices

In each company that sells it: `offer.<key>.sizes` (`"10x16": 5190`, in
button order) and a place in `categories`. The easy way is a spreadsheet:
`node tools/import-prices.mjs companies/<id> prices.csv` adds a style not
offered yet and puts it in its group. See the `new-company` skill.

This exact example (in a file extending the standard line, sold by a
made-up company at 10x16 and 12x24) was tried end to end: it loads, the
importer adds it from a spreadsheet, the contact sheet prices it and names its
door and two windows, and the Framing view frames all three openings.

## 5. Look at every size

The automatic sweeps do not reach a new style yet: `check-framing.mjs`,
`check-blueprint.mjs`, `check-ui.mjs` and `check-gallery.mjs` build the
Barnwright, demo and starter catalogues, and the demo must offer exactly
Barnwright's styles (`check-companies.mjs`). So look yourself, with a company
that sells the style (`npm run serve`):

* `setup.html?company=<id>` -- every size: the standard doors and windows sit
  on their walls without overlapping each other or the corners, the price is
  right. Take a full-page picture into `test/out/` for Alan.
* `/?company=<id>` -- pick the style at its smallest, typical and largest
  size: Outside, Inside (the floor plan), Framing (studs round every opening,
  trusses to the roof line, loft only if it has the trait) and Watch it build.
* `parts.html?company=<id>&style=<key>` -- every part the building has, each
  on its own.

Say plainly in your report which of these you looked at.

## 6. Checks to run

* `node tools/list-companies.mjs` -- the company still loads.
* `node tools/check-companies.mjs` -- the manufacturer file and every company
  pass validation (a bad trait, roof, porch, loadout or item gives a plain
  error), and the data-recipe reader.
* `node tools/check-golden.mjs` -- must stay green: no Barnwright building may
  change because a style was added.
* `node tools/check-construction.mjs`, `node tools/check-parts.mjs` (every
  caption fills in), `node tools/check-imports.mjs`, then
  `node tools/check-all.mjs --fast`.
