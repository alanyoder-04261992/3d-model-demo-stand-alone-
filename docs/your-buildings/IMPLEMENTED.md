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
  that size rule. Added or moved windows that do not fit are left off in the stated sizes;
  posts are held on their porch edge, and overlapping posts are reported.
  The Edit page lists the layout's rules and sizes where items are left off.
- Phone sheets, confirmation choices and save buttons have room above the
  fixed bars. Review pictures cover 390, 820 and 1280 px, in light and dark.
  The sample Dealer Center also opens layout mode and keeps its changes in
  the same browser tab.

## Compatibility and scope

A price list without an owner layout still uses the builder's layout.
Existing saved designs, quotes and orders keep their items and prices.
Included items keep their "comes with the building" mark after a customer
moves them and changes size or porch, but since Oct 17 2026 (Alan: "Yes,
charge for them") only as many as the design's own size comes with are free;
the rest are charged at their normal price, and nothing is refused for them
(DIFFERENCES #30).

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
node tools/check-all.mjs --only loadout-twins,layout-recipe,layout-check,layout-server,layout-return,standard-layout,picture-key,building-pictures,picture-cache,your-buildings,layout-mode,layout-demo,layout-conflict
npm run build:client
npm run office -- --demo
```

The local sample is at `http://127.0.0.1:8383/dealer?demo`.
`check-layout-return` exercises the actual Dealer Center state hooks without
opening a browser. It covers malformed and expired drafts, business and
person binding, preserved prices and stopped buildings, layout-only rebasing
and unrelated or late revisions.

The new checks and adapted reference checks accept these location overrides.
Some legacy browser checks still use their recorded Playwright location:

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

Selected review captures are committed here:

- [Desktop building cards](review/buildings-1280-light.png)
- [Phone building cards](review/buildings-390-light.png)
- [Phone Edit in dark mode](review/edit-390-dark.png)
- [Phone porch selection above the save bar](review/layout-sheet-390-light.png)
- [Phone reset choices with the 100 px app header](review/reset-layout-390-dark.png)
- [Tablet building cards in dark mode](review/buildings-820-dark.png)
- [Tablet Edit](review/edit-820-light.png) and [desktop Edit in dark mode, Stop selling readable](review/edit-1280-dark.png)
- [How all your buildings are built, dark, desktop](review/built-1280-dark.png) and [phone](review/built-390-dark.png)
- Saved result box: [phone](review/layout-result-390-light.png), [tablet dark](review/layout-result-820-dark.png), [desktop](review/layout-result-1280-light.png), [phone turned sideways](review/layout-result-844x390-light.png)
- [Phone leave question with named buttons](review/layout-leave-390-light.png)

Completed focused checks: Your Buildings **144**, Dealer Center **73**,
layout server **60**, layout return **27**, public demo flow **15**,
conflict recovery **14**, layout editor **45**, How it's built **78**,
sign-in screens **112**, quote requests **83**, browser picture cache **15**,
and Help **168**.
The builder twins match **295** size and porch cases. The golden geometry
check matches **521,769 triangles across 148 buildings**. The live reference
model matches all **24,111 comparisons**, and all **24 finished pictures**
match the recorded pixels.

**Correction (review after merge, c355440).** The sentence that used to
stand here said there were no remaining check failures. That was not true
on main: a full run of every check had 77 programs, 72 passing and
5 failing. Three (golden-labels, model-live, shaders) fail because
Barnwright's pinned `3ddesign.html` changed; they failed before this work
too. The other two were new: the layout editor (a phone tap or a long press on a
dashed porch post picked a different post) and the support check (it read the
address before the leave-page box had been answered). Both are fixed on
`lane/fix17-screens`. After those fixes the full run has **78 programs:
75 pass and 3 fail**, and the 3 are only golden-labels, model-live and
shaders, waiting on Barnwright's changed page.

**Prices after the "comes with the building" rule (review 17, Oct 17
2026).** The fix pull request first said that of 1,947 sample designs 1,835
kept their price, 99 went up and 0 went down. A larger sample of 19,873
designs made the way customers make them showed that was not the whole
story: 20 Side Cabin and Loft Side Cabin designs went up only because the
customer tapped the 8 ft porch, and 48 Cottage Shed and Metal Cottage
designs went down. Alan then asked for a standard door or window the
customer removes to come off the price ("Yes, take its price off"), always
compared with the business's own standard layout. After the review fixes:

- 19,873 designs: 18,525 the same, 254 up, 998 down, 96 refused before and
  after (a door swap the price list does not sell). Every one that went up
  went up by exactly the normal price of the included items above what its
  own size comes with. Of those that went down, 950 had a standard door or
  window removed, each down by exactly that item's price (1,178 removals
  were checked; the other 228 removed a $0 item such as a porch post), and
  48 are Cottage Shed and Metal Cottage 8x12 or 10x12 designs whose 48″
  door was swapped for the 72″ double doors before picking 10x16 or
  larger: those sizes come with the double doors, so the $150 swap is no
  longer charged (kept on purpose, docs/FOR-ALAN.md).
- The first 1,947 designs (none removes anything): 1,908 the same line for
  line, 39 up (by $145 to $400, each the normal price of its extra items),
  0 down, 13 refused as before. The other 60 that had gone up were 8 ft
  porch designs, now free.
- In both samples the 3D designer's total equals the server's for every
  design.

The record below is the original build's own account. The first aggregate run
covered 65 programs and reported 55 passes and 10 failures. The three checks
added during review (layout return, demo and conflict recovery) passed
separately. Targeted reruns resolved all ten initial failures:

- Dealer Center and engine smoke passed after the install-profile fixture,
  Help expectation and fixture favicon were corrected.
- Gallery passed on its uninterrupted rerun; the first run was paused by the
  runner and timed out during teardown.
- How it's built and customer packaging now check the single-building Edit
  pages and separate picture bundle while preserving their old assertions.
- The layout editor passed all six width/theme combinations after the
  selected sheet was made to stay visible following page reflow.
- Quote checks use a controlled rapid-submit clock and a local mail-handler
  fixture, retaining the real minimum, clicked mail link and response checks.
- Sign-in screens passed after the older test server's port was released.
- Designer sections 9 and 14 passed with a Date-only animation fixture and
  the pinned reference folder; the other sections passed in the full run.
- Golden labels matched for 141 buildings in the first run; the seven load
  timeouts each passed when rerun individually, with no drawing or label
  differences. No baseline exception is needed.

`npm run build:client` also passed. The site profiles still keep the sample
demo and internal learning/reference material out of customer builds.

The deployed PR preview passed **14 desktop and phone checks**: all 23
building cards, Edit, the actual standard-layout designer, a three-inch move,
every-size drawings, save and return with the layout still present. No
script, stylesheet or picture was missing; no real account API call or page
error occurred. The preview-only Netlify drawer was hidden in the browser
fixture so it could not intercept the app's save buttons.
