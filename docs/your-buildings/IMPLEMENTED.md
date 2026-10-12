# Your Buildings: implementation and review record

The build is on `claude/friendly-carson-n2nllt`. Alan's later instruction in
this session authorizes merging the finished, checked build. It supersedes
this handoff's original hold on merging and its planned October 17 review.
The original handoff, approved mockup and build plan remain as the historical
record; this file describes what was implemented.

## What the Dealer Center now does

- **Your buildings** shows picture cards with the building name, sizes,
  from price, **Edit**, opening-building marker and unfinished-change marker.
  A stopped building keeps its draft sizes and numbers until Save, with
  **Sell it again**. Managers and dealers keep the existing price sheet.
- **Edit** keeps the shared price-list draft across pages. It has the name,
  sizes, prices, **How it's built**, opening building and size, a 3D designer
  link, the standard layout and **Stop selling**. **Show me** opens the
  building with the problem and focuses its box.
- **Add a building** shows the standard gallery, including sold and stopped
  buildings. **Add it** starts with example sizes and empty price boxes;
  **Make my own from it** gives a building its own name and prices.
  **How all your buildings are built** has its own page.
- Pictures use the draft's colors and building numbers, a separate drawing
  file, browser caching and shipped fallback pictures. A red building-number
  box keeps the last usable picture until it is fixed.
- **Set the standard layout** opens the real 3D designer. Doors, windows and
  porch posts can be moved, added and removed. **Save as standard** checks
  every sold size and every allowed side-porch length and place, using the
  same fit rules customers use. Doors that fit only larger sizes can carry
  that size rule. Windows that do not fit are left off in the stated sizes;
  posts are held on their porch edge, and overlapping posts are reported.
  The Edit page lists the layout's rules and sizes where items are left off.
- Phone sheets, confirmation choices and save buttons have room above the
  fixed bars. Review pictures cover 390, 820 and 1280 px, in light and dark.
  The sample Dealer Center also opens layout mode and keeps its changes in
  the same browser tab.

## Compatibility and scope

A price list without an owner layout still uses the builder's layout.
Existing saved designs, quotes and orders keep their items and prices.
Included items remain included after a customer moves them and changes
size or porch. Server checks still reject invented included additions.

Layout saves use the existing permission checks, version checks, Barnwright
lock and History. Current Barnwright visit permissions are preserved:
per-building numbers remain editable; business-wide numbers remain the
owner's. A layout-only save advances the draft's saved version and `cfg`
while preserving unfinished prices and stopped buildings. Other saves stay
stale, and a late reply cannot move the saved version backward. Return drafts
are tied to the business, builder, person or visit, version and eight-hour
limit, then cleared on return.

First setup remains removed. A new owner's first sign-in still opens Today.
No setup picker was restored. Managers' picture price sheets are outside this
build. The historical plan's sections 0 and 5 were skipped as the handoff
instructed.

## Repeatable checks

```sh
node tools/check-all.mjs
node tools/check-all.mjs --only loadout-twins,layout-recipe,layout-check,layout-server,layout-return,standard-layout,picture-key,building-pictures,your-buildings,layout-mode
npm run build:client
npm run office -- --demo
```

The local sample is at `http://127.0.0.1:8383/dealer?demo`.
`check-layout-return` exercises the actual Dealer Center state hooks without
opening a browser. It covers malformed and expired drafts, business and
person binding, preserved prices and stopped buildings, layout-only rebasing
and unrelated or late revisions.

Reference and browser locations can be supplied for another machine:

| Setting | Location it supplies |
|---|---|
| `BARNWRIGHT_PUBLIC` | Barnwright reference folder containing `3ddesign.html` |
| `YODER_FILE` | Yoder reference `design.html` |
| `YODER_ROOT` | Yoder reference repository root for document checks |
| `PLAYWRIGHT_MODULE` | Installed Playwright `index.js` |
| `CHROMIUM_EXECUTABLE_PATH` | Installed Chromium executable for the new browser checks |

## Review artifacts and final verification

Screenshots are in `test/out/your-buildings/`, including the `layout-porch-`
and `layout-sheet-` pictures at all three widths and both themes, and
`layout-demo-saved-390.png`. Check logs are in `test/out/checks/`.
Public fallback pictures and their recorded metadata are in
`ui/office/building-pictures/`.

The final full-suite counts, baseline comparison and any remaining reference
check failures will be recorded here after the final run. This record does
not claim that the full suite passed.
