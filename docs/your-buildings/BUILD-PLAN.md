# Build plan: "Your buildings" in the Dealer Center

Start this only after Alan says yes to the mockup. Build it on one new lane, `lane/dc-buildings`, cut from
`lane/dc-fast` merged with `lane/dc-setup` and `lane/dc-refs` (see step 0). Nothing here changes how a
price list is stored, so every price list saved today opens unchanged.

## What Alan gets (plain words)

* **Your buildings.** The Buildings tab of the price list shows one card for each building the
  business sells. Each card has a picture of that building as the business's own 3D designer shows it,
  in the colors it opens on and with the business's own build numbers. Under the picture are the name,
  the number of sizes, the "from" price and an **Edit** button. The on/off switches are gone.
* **Edit** opens the building's own page. It has the picture, the name customers see, the sizes and
  prices, and **How it's built** (roof pitch, wall height, eave overhang, gable-end overhang, door
  height, porch depth and the rest, with "Check every size"). There is a box to make the 3D designer
  open on this building, and **Stop selling** sits at the bottom. The picture is drawn again as the
  numbers change.
* **Add a building** opens a gallery of every standard building with its picture. **Add it** adds one as
  it is. **Make my own from it** starts the business's own style built like it.
* **How all your buildings are built** moves to a page of its own, linked from the list.
* **Set the standard layout** (section 10). On the Edit page, the owner opens their own 3D designer on
  that building, moves, adds or removes doors and windows the way a customer does, and taps **Save
  as standard**. Every size is checked first. Every lot's 3D designer then starts customers from that
  layout.
* The Barnwright switch in Settings, Barnwright stays exactly as it is.

## 0. The base: merge first (prerequisite)

I tried the merge in a scratch clone, since removed; the conflict list is in `run/merge-tree.txt`:

* `lane/dc-setup` into `lane/dc-fast` has **conflicts in 2 files**:
  * `server/office/index.js`: one hunk where `createPriceList` is made. Keep both sides: dc-fast's
    `sizeCheckMs` and dc-setup's `markLive`, `setupReport` and `terms: shipped`.
  * `server/office/price-list.js`: 9 hunks. dc-setup split `save()` into `prepared()` (dc-setup
    :664-700), `preview()` and `save()` (:703-731). dc-fast added `liftRawRules`, `tidyBuilt`,
    `check(next, restoredFrom ?? old)` and `sizeCheckOf` inside `save()` (dc-fast :537-570).
  * Resolution for `price-list.js`:
    * Move the dc-fast steps into `prepared()`, after the lock. `prepared()` returns
      `{next, changes, sizeCheck}`.
    * `save()` returns `{...record, changes, sizeCheck}`. Its "no changes" early return carries
      `sizeCheck` too.
    * `restore()` keeps dc-setup's `carry` and passes dc-fast's `restoredFrom`.
    * Imports: take both sides.
    * `describeChanges` for extras: combine dc-setup's `chargeWords` and rename lines with dc-fast's
      `describeExtraBuilt` and `offeredOn`.
    * `startingSettings()` calls `check(settings, null)`.
* `ui/office/views/price-list.js`, `setup.js`, `app.js` and `main.js` merge with no conflicts.
* `lane/dc-refs` merges cleanly on both lanes. It brings `library/style-refs/<code>.jpg` (the
  standard pictures used as the fallback) and `tools/make-style-refs.mjs`.
* After the merge, `node tools/check-all.mjs` must be green before any commit below. Once dc-fast's shop
  numbers are in, `check-style-refs` will ask for the pictures to be remade (commit 2).

Line numbers below are dc-fast's (`/home/user/wt-dc-fast`) unless they say otherwise. After the merge:

* `ui/office/views/price-list.js` shifts by +11 to +27 lines: render :109, renderTab :199,
  focusPending :254, showFirstProblem :275, leaveGuard :436, hashchange :452.
* `setup.js` shifts by +29: priceList :159, ready :235.
* The price-list route in `main.js` is at :67, and `DEMO_MODULE` is at :481.

## 1. Files to change

| File | Lines today | Change |
|---|---|---|
| `ui/office/views/price-list/buildings.js` | `ownerView` :29-45, `groupCard` :47-63, `metaParts` :65-75, `styleBlock` :77-101, `redrawStyle` :103-108 | Replace with `cardsView()`: toolbar (count, Change prices, **Add a building**, link to How all your buildings are built), `builtNotes()`, then one `<section>` per group from `displayGroups` (model.js:153) with a grid of cards. Parked styles (stopped, not saved) show greyed with **Sell it again**. Groups no longer fold. |
| same | `styleEditor` :110-152, `addSizeForm` :154-193, `removeSize` :195-207, `setSold` :211-227 | Move to a new `price-list/building-page.js`, unchanged inside. `setSold` stays the one way to stop and restart selling. |
| same | `opensOnCard` :231-261 | Becomes a row on the Edit page ("Open the 3D designer on this building", plus the size). The card says **Opens first**. Settings keeps its own "The building it opens on" (settings.js:495-526). The Colors tab keeps its `opensOnCard` (colors.js:18). |
| same | `loadExample` :369-379, `libraryGroups` :381-390, `openAddStyle` :392-515 | Move to a new `price-list/add-building.js` as a page, not a dialog. "Add it" keeps the :470-479 logic. "Make my own from it" keeps the :481-497 logic in a small dialog (name, start with its sizes and prices). The parked note bug (the early return at :410-411 skips the parked note at :435) goes away because every card says its own state. |
| same | `openChangePrices` :275-365, `priceSheet` :519-560 | Unchanged. Managers and dealers keep the price sheet. |
| `ui/office/views/price-list/built.js` | `memo`/`builtKey`/`builtView`/`catOf` :66-103 | Export `catOf` (or move the four into `price-list/catalogue.js`) for the pictures. `builtKey` :77-81 also keys on `defaults` and `palettes`, so the opens-on colors reach the pictures. |
| same | `builtSection` :263-299 | Takes `{ readOnly(id) }` for a Barnwright visit (see section 6). Otherwise unchanged. |
| same | `builtCard` :420-456 | Rendered by the new page `#/price-list/how-its-built`. |
| `ui/office/views/price-list.js` | `TAB_VIEWS` :27, render tab choice :111-113, `renderTab` :187-193 | Sub-pages of Buildings: `S.sub = {page: "list" \| "building" \| "add" \| "built", key}` from `ctx.params`. `renderTab` draws the sub-page. The tab strip keeps Buildings selected. |
| same | `S.hooks.edited` :85-92 | Also calls `pictures.changed()`, debounced, so only pictures whose key changed are drawn again. |
| same | `focusPending` :242-261, `showFirstProblem` :263-274 | A problem with `p.style` goes to `#/price-list/building/<key>` and focuses its box. Drop the `S.openStyles` and `.pl-group-body` code. |
| same | hashchange :425-437 | Leaving the price list also calls `pictures.release()` (frees the 3D renderer). |
| `ui/office/main.js` | ROUTES :56 | Add `[/^\/price-list\/(building)\/([A-Za-z0-9]{1,8})$/, "price-list"]`. `add-building` and `how-its-built` already match `:56` as `params[0]`. `leaveGuard`'s `IS_PRICE_LIST` (:28) already keeps the draft across these addresses. |
| `ui/office/views/price-list/state.js` | `openStyles` :46, `closedGroups` :47 | Remove. Add `sub`, `listScroll` and `pictures` (the memory cache handle). |
| `ui/office/views/price-list/bits.js` | `switchInput` :29-38 | Remove (no other user; `sellBox` :41 stays for Doors and Options). |
| `ui/office/views/price-list/model.js` | explain rule :437 | "Add a size, or switch it to Not sold." becomes "Add a size, or tap Stop selling." Do not change `lockedItems`, `newStyleKey`, `placeStyle`, `groupsOf`, `sortSizes`, `paletteNames` or `nameKey`: Barnwright's connector imports them (dc-setup `server/office/setup-edits.js:27`). |
| **new** `model/picture-key.js` | | Node-safe. `pictureState(cat, key)` is the design the 3D designer lands on for that style (`defaults`, then `setType`, then `normalize`, as in `ui/parts-gallery.js:112-123`, which is learning-only so it can't be imported). `pictureKey(cat, key, recipe)` hashes the plan with `cat`, `CAT` and `t.name` taken out (section 2). |
| **new** `ui/office/pictures.js` | | Its own bundle: `startPictures(cat)` makes one hidden renderer (`engine/renderer.js` `createRenderer`, as in `ui/parts-gallery.js:100-110`) and returns `draw(key, size) → Blob` (`model/plan.js` `makePlan`, then `engine/assemble.js`, then `engine/snapshot.js` `snapshotCanvas`, then JPEG 0.85), plus `close()`. |
| **new** `ui/office/views/price-list/pictures.js` | | In the main bundle: the queue, the cache, the fallback and the lazy import of `/ui/office/pictures.js` (section 2). |
| **new** `ui/office/views/price-list/building-page.js`, `add-building.js` | | Edit page and gallery (sections 3 and 4). |
| `ui/office/owner.css` | `.pl-switch*` :62-70, `.pl-group*` :82-91, `.pl-style*` :93-116, `.pl-opens-fields` :140-141, phone :358-388 | Remove the switch, fold and row styles. Add `.pl-cards`, `.pl-card`, `.pl-pic`, `.pl-edit-head` and `.pl-gallery` (section 7). |
| `tools/build-site.mjs` | main bundle :106-108, demo pattern :109-115 | Build `ui/office/pictures.js` as its own minified file in every build, client builds too. Then define `__PICTURES_ID__` in the main bundle: the first 16 hex characters of the sha256 of the built `pictures.js`. |
| `tools/office-local.mjs` | bundlers :142-150, serving :229-235 | A third esbuild context for `/ui/office/pictures.js`. `__PICTURES_ID__` is hashed from each rebuild. |
| `ui/office/views/setup.js` | choices :139-143, ready :220 | Section 5. |
| `server/office/price-list.js` (merged) | dc-setup `startingSettings` :575-604 | `start: "pick"` with `styles`. |
| `server/office/index.js` (merged) | dc-setup setup route :183-220 (`start` at :213); `me()` visit answer :356 | Pass `start` (`full`, `small` or `pick`) and `styles`. Add `gableStyles` to `barnwright`. |
| `server/office/setup-lock.js` (dc-setup) | `lockProblems` :159-182, `LOCK_WORDS` :32-46 | Section 6, commit 1. |
| `ui/office/help-answers.js` | :37 | "tap **Edit** on a building under **Your buildings**". Add an answer "Add a building or stop selling one". |
| `docs/OFFICE.md` | :148, :160, :819-831 | Describe Your buildings, the Edit page, the gallery, the How-it's-built page and the Pick-your-buildings start. |
| `docs/FOR-ALAN.md` | price list part | One paragraph and the pictures. |
| `tools/check-how-its-built.mjs` | open-a-style helper :89-95, the `[data-built=...]` lookups | Open `#/price-list/building/<key>` instead of clicking `.pl-style-open`. The business-wide card is on `#/price-list/how-its-built`. |
| `tools/check-setup-screens.mjs` (dc-setup) | :251, :280, :433-439 | Same: the Edit page instead of `.pl-style-open`. ":436 ... (23 styles)" counts `.pl-card`. |
| `tools/check-wording.mjs` | `BANNED` :27+ | Ban "Not sold", "Switch it on to sell", "Turn off the ones you don't sell" and "Turn off what you don't sell" in `ui/office/`. Plain "Turn off" stays allowed: the Barnwright card uses it. |

## 2. Pictures: how the cards and the gallery get them

**Drawn in the owner's browser, with the standard picture first.** Netlify Functions have no WebGL,
and a headless Chromium is too slow to start for this. The browser uses the same catalogue a lot's
3D designer uses (`model/company.js` `resolve` :793 with `BUILT.apply` :806), so a picture
can't disagree with the 3D designer.

* **What is drawn.** The style at the size the 3D designer lands on when a customer picks it:
  * The opening size if the style sells it. Otherwise the 5th size, or the last if it has fewer.
    That is the `setType` rule in `model/design.js:89-104`.
  * Standard doors and windows, in the opening colors (`defaults.colors`).
  * The camera is the opening view (yaw 0.62, pitch 0.215, `fit: "fitref"`) on the studio backdrop
    #E9E9E5.
  * Cards are 400×300 CSS px at `min(2, devicePixelRatio)`. The Edit page picture is 640×480.
* **The catalogue it is drawn from** is `pictureCatalogue(draft)`, the draft as it stands, so an
  unsaved roof pitch shows at once:
  * Every missing or $0 price becomes 1, so a size added a moment ago is still a size.
  * Every How it's built value that can't be read is left out (`builtProblems`) and drawn as the
    standard.
  * If it still won't resolve, it falls back to the saved price list.
  * The result is memoized on `builtKey` plus defaults and palettes, so typing a price never
    re-resolves.
  * The gallery's catalogue is the same plus each standard building not sold, with example sizes.
* **The key.** `pictureKey` hashes:
  * the plan from `makePlan(pictureState(cat, key), cat)`, with `cat`, `CAT` and `t.name` left out;
  * `__PICTURES_ID__`, the hash of the built engine file;
  * the recipe: size, dpr, camera and backdrop.

  It uses cyrb53, 16 hex characters. I measured it on the sample price list (`run/plan-key.mjs`,
  `run/plan-key.txt`):

  | Change | UT key | LB key |
  |---|---|---|
  | UT price +$100 | same | same |
  | LB price +$100 | same | same |
  | Door price +$5 | same | same |
  | UT renamed | changes, so `t.name` is left out | same |
  | UT roof 8/12 | changes | same |
  | Business-wide gable roof 6/12 | changes | same |
  | Opens-on siding Barn Red | changes | changes |

  The lean plan is about 3.6 KB. All 23 plans, JSON and hashes take 32-37 ms in Node.
* **Cost**, from the study, measured in software graphics (SwiftShader); a real graphics card will be
  faster:

  | What | Cost |
  |---|---|
  | Engine file | 237 KB minified, 87 KB gzipped, loaded only when a picture is missing |
  | Renderer, once per page | 2.0-2.3 s (shaders and 12 surface pictures) |
  | Each picture | median 138 ms (99-206 ms); the first 327-371 ms |
  | All 23 | about 3.4 s |
  | Each JPEG | about 35 KB |
  | Fixed graphics memory | 16 MB shadow map and 8.3 MB of textures |

  The main Dealer Center bundle (569 KB, 198 KB gzipped) does not grow by the engine. The engine
  file is loaded like the demo is (`main.js:336`): its name is kept in a variable so esbuild does
  not fold it in. The page's security policy (`server/office/pages.js:12-16`: script 'self', img
  data: blob:) needs no change.
* **The queue.** One picture at a time, cards on screen first (IntersectionObserver, 300 px margin),
  with `await frame()` between pictures. The queue:
  * pauses while the tab is hidden and is dropped when the screen changes;
  * makes the renderer only when a key is missing from the cache, so a second visit draws nothing;
  * starts a new renderer on `webglcontextlost` (iPhones drop contexts in the background);
  * on `release()`, called on leaving the price list, does `WEBGL_lose_context` and removes the
    canvas.
* **The cache.**
  * Memory: key to blob URL, kept for the tab, so redrawing the tab never flickers.
  * Browser storage: IndexedDB `dealer-center-pictures`, at most 150 pictures (about 5 MB), oldest
    removed first. Every read and write is in try/catch, and private mode falls back to memory.
  * Content keys mean no rule is needed to clear old pictures: a deploy that doesn't touch the
    engine keeps them, and one that does changes `__PICTURES_ID__`.
* **The fallback picture.** `/library/style-refs/<baseOf(key)>.jpg` (from lane/dc-refs) shows at once
  with alt text "The standard <name>". The drawn picture replaces it when ready (`data-picture="drawn"`).
  * The fallback stays when:
    * there is no WebGL (`renderer.off`);
    * the engine file fails to load;
    * a drawing throws.
  * A style of the business's own uses its base's picture.
  * A library with no picture of a style (another manufacturer) shows the shed icon tile.
  * These pictures show the old Barnwright numbers in White, Black and Black, so commit 2 remakes them
    with `node tools/make-style-refs.mjs` before anything ships.
* **Redrawing after a save.** Nothing special is needed. After `saveAll` (:354-390), `startFrom`
  loads the saved record. Its plans equal the draft's, because the server stores "5/12" as 5 (as the
  draft already does), so the keys match and the pictures come from memory. If the server changed
  something (`liftRawRules` moving a Barnwright pitch rule into How it's built), the key changes and
  that one picture is drawn again. The same holds for Undo changes, Reload and "someone else saved
  first".
* **On the Edit page**, the picture is drawn again 500 ms after the last change whose key differs.
  While a How it's built box on this style is red, the old picture stays with the line "The picture
  waits until the red boxes are fixed." A small "Drawn at 10×20" caption says which size it shows.
* **Later, not in this build:** on save, the owner's browser could upload the finished JPEGs to Blobs.
  Then managers' and dealers' price sheets could show pictures without their phones drawing anything.

## 3. Edit and the price list: what each part writes

The Edit page is `#/price-list/building/<key>` and works on the same draft (`S.draft`), the same bar
at the bottom and the same "Save for all lots".

| On the Edit page | In the price list settings | Code that does it |
|---|---|---|
| Name customers see | `offer[K].name`: only when it differs for a builder's style, required for the business's own | `styleEditor` :113-129 |
| Built like (own style, read only) | `offer[K].base` | set when added, never changed |
| Sizes and prices, Add a size, remove | `offer[K].sizes` `{"10x16": 5540}` | :132-143, `addSizeForm` :154-193, `removeSize` :195-207 |
| How it's built boxes | `offer[K].built.{roofPitch, barnPeak{width: in}, eaveOverhang, gableEndOverhang, wallHeight, doorHeight, porchDepth, sidePorchLengths, dormerSide}`. Which boxes show comes from `BUILT.knobsFor` (model/build-settings.js:125). | `builtSection` built.js:263, `setOwn` :243 |
| Check every size | nothing saved; `model/built-check.js` `checkInSteps` (:335) on `catOf(S.draft)` | `checkRow` built.js:303-333 |
| Open the 3D designer on this building, and its size | `defaults.style`, `defaults.size` (kept right by `tidyDefaults` model.js:234) | from `opensOnCard` :245-251 |
| Stop selling | `delete offer[K]`; the entry waits in `S.parked.offer[K]` until save, and **Sell it again** brings it back with its sizes, prices and numbers | `setSold` :211-227 |
| How all your buildings are built (own page) | `built.{id}` or `built.{id}.{roof kind}` | `builtCard` :420-456, `setBiz` :377-393 |

* **Checking.** Each edit runs `recompute` (:69-83): `prepare`, then `problemsOf` (model.js:533:
  `validate`, `officeChecks`, `builtProblemsOf`). `paintProblems` (:197) still finds each box by
  `data-field`.
  * On the list, a card with problems carries `data-flag="style:K"` (red dot) and says, for example,
    "2 missing a price".
  * **Show me** in the bar goes to that building's Edit page and puts the cursor in the box.
* **Saving.**
  * PUT `/api/office/price-list` runs the merged `prepared()`: the lock (in a visit), then
    `liftRawRules`, `tidyBuilt`, `check`, and `sizeCheckOf` (the 3 s every-size check).
  * A building that doesn't fit at some size is refused (422) and lands in `notSaved`.
  * The Saved banner keeps `builtSaved` with its 3D designer link.
* **Back.** "← Your buildings" (and the browser's Back) returns to the list at the same scroll
  (`S.listScroll`).
* **Not sold.** A key not sold and not parked shows "This building isn't on your price list" with
  **Add a building**.
* **Not saved yet.** A card whose entry differs from the saved one carries a small "Not saved yet"
  chip, since the Edit page is out of sight.

## 4. What replaces the switches, and old price lists

* **Sold** is a card. **Not sold** for a builder's style is the gallery's **Add it**. **Switched off,
  not saved yet** is a greyed card with **Sell it again** (the same `S.parked`). The business's own
  style that is stopped "goes away when you save", as today.
* **Removing the last size** still asks "Stop selling the …?" (:195-203) and then returns to the list.
* **No data changes.**
  * The switch was only screen over "the key is in `offer` or it isn't", so nothing needs migrating.
  * Old price lists open as they are: own styles (`base`), `categories` groups, How it's built
    blocks, raw pitch rules Barnwright's connector wrote (`liftRawRules` reads them), and price lists
    with no `built` at all.
  * Old addresses `#/price-list` and `#/price-list/buildings` show the list.
  * A Barnwright visit's kept draft (`visit-draft.js`, sessionStorage) has the same shape and still
    comes back.
* **Test for it:** a price list saved by today's code opens, shows one card per style, and saving
  with no edits writes nothing (`changes: []`).

## 5. First setup: "Your starting price list"

Starting truly empty can't work. A price list must sell at least one building
(`validate`: "offer is empty"), and the 3D designer must open on one. So step 2 offers:

* **Every standard building:** "All 23 at example prices. Stop selling any you don't sell from Your
  buildings." This is `start: "full"`, companies/demo, as today.
* **Pick your buildings:** "Tap the ones you sell. They start at example prices; add more any time."
  * A grid of the 23 standard pictures (style-refs JPGs, grouped like the 3D designer) with a tick
    on each, none ticked at first.
  * Next waits until one is ticked: "Pick at least one building."
  * Sends `start: "pick", styles: [...]`.
* **Server.** `startingSettings` takes the full template and keeps only the picked keys in `offer`.
  It filters `categories` and drops empty groups. If the opening style was dropped, it moves
  `defaults` to the first kept style with `tidyDefaults` (the server already imports
  `ui/office/views/price-list/model.js` in setup-edits.js).
  * Unknown key: 422 "Pick buildings from the list."
  * Empty list: 422 "Pick at least one building."
  * `start: "small"` (companies/starter) stays accepted for old pages and checks
    (check-setup-screens.mjs:145).
* **The ready step** (:220): "Check your prices. In Your buildings tap Edit to type your own prices,
  or Stop selling the ones you don't sell."
* **Unchanged:** when Barnwright started the price list (dc-setup `wiz.started`), there is no
  price-list step.

## 6. The Barnwright visit and the Claude connector

* **Same screens.**
  * In a visit, `app.can("changePrices")` is true (dc-setup app.js:39-40), so Alan sees the same
    cards, Edit pages and gallery.
  * The pictures are drawn in Alan's browser and cached under the dealer's own site.
  * Saves already go to `/api/office/barnwright/price-list` (dc-setup api.js:46-47).
* **The lock has a gap to close first (commit 1).**
  * dc-setup's `lockProblems` (setup-lock.js:159-182) checks `construction` and extras'
    `construction`, but it does not check dc-fast's `built` blocks. After the merge, a visit could
    change any wall height or porch depth, against the rule written at setup-lock.js:13 ("except one
    gable roof's pitch").
  * Extend it: `built` (business-wide) and `options.extras[].built` must not change. For a key in
    both old and new `offer`, `offer[K].built` must not change, except `roofPitch` when K is in
    `GABLE_STYLES` (:49). A newly added key carries no `built` (or only that pitch). A key removed is
    fine, since stop selling is allowed.
  * Words: `LOCK_WORDS.construction`.
* **The Edit page in a visit.** `builtSection` gets `readOnly(id)`, true for every box except
  `roofPitch` on a `GABLE_STYLES` library key. Read-only boxes show as `builtLines` rows with "Only
  the owner changes how buildings are built. Barnwright can change a gable roof's pitch." The
  How-it's-built page is read only. `gableStyles` comes in the `me()` visit answer
  (dc-setup index.js:356).
* **The Claude connector: no change to its edits.**
  * `setup-edits.js` writes the same settings keys: `sell_style`, `add_own_style`,
    `stop_selling_style`, `rename_style`, `set_price`, `remove_size`, `set_roof_pitch`,
    `set_defaults` and the rest.
  * It imports model.js helpers that this build leaves alone (section 1).
  * `check-setup-access.mjs` must pass untouched.
  * One side effect to tell Alan about: remaking the style pictures (commit 2) also rewrites
    `library/style-refs/styles.json`, which the Control Room's `get_style_reference` reads from
    GitHub main. Claude will then see the shop numbers, for example the Utility Shed at 5/12 with
    7 ft 9 1/2 in walls.
* **The switch** (dc-setup settings.js `barnwrightCard` :770, words `CARD` :48-60) is not touched.

## 7. Phone and iPad

Content widths:

| Screen | Content width |
|---|---|
| Phone 390 | 358 px, tab bar at the bottom |
| iPad portrait 768 | about 498 px; the 224 px sidebar shows above 760 (office.css:52, :147) |
| iPad landscape 1024 | about 754 px |
| Desktop 1280 | about 980 px |

* **Cards:**
  * Grid `repeat(auto-fill, minmax(220px, 1fr))`: 4 columns at 1280, 3 at 1024, 2 at 768.
  * Up to 520 px, each card is a row: a 132×99 picture on the left, then the name, facts and an
    **Edit** pill. That makes the 23 cards about 2,900 px on a phone; today's list is longer.
  * The whole card is one link, so the target is never under 44 px. Edit is always visible, not
    shown on hover, because iPads have no hover.
* **Edit page:**
  * Phone and iPad portrait: one column. The picture is full width (4:3, capped at 480 px), then
    the sections.
  * At 1024 and up the top is a row (picture 320-360 px, name, facts and Stop selling), with the
    sections full width under it. That leaves the How it's built grid room for two boxes across.
* **Gallery:** the same grid as the cards, with two buttons per card (Add it, Make my own from it)
  stacked full width on phones.
* **The save bar** stays fixed at the bottom on every page; the pages already pad for it (`has-bar`).
* **Checks** at 390, 768, 1024 and 1280:
  * no sideways scroll;
  * every tap at least 44 px;
  * pictures in `test/out/your-buildings/`.

## 8. Tests that must fail on today's code

Each test is written first and shown red on the merged base, then made green by its commit.

New browser check `tools/check-your-buildings.mjs` (check-all: browser, port 8394,
`YOUR_BUILDINGS_PORT`; sample data like check-how-its-built):

1. The owner's Buildings tab has 23 `.pl-card[data-style]`, each with an `img`, and **no**
   `input[role=switch]`. Today: no cards and 23 switches.
2. The first visible cards reach `data-picture="drawn"` with a `blob:` source. With WebGL taken away
   (an init script makes `getContext("webgl2"/"webgl")` return null), every card shows
   `data-picture="standard"` from `/library/style-refs/<code>.jpg`, with no page error.
3. Tapping Edit on the Utility Shed goes to `#/price-list/building/UT`. The page shows its name,
   sizes, the Roof pitch and Wall height boxes and **Stop selling**. Back returns to the same scroll.
4. Roof pitch 8/12 on UT changes UT's `data-picture-key` (and the picture), and the LB card's key
   stays the same. A price change keeps every key.
5. Stop selling UT: the card is greyed with **Sell it again**. Save says "Stop selling the Utility
   Shed". The gallery then offers UT with **Add it**.
6. The parked bug: with all 23 sold, stop selling one, then open Add a building. Its card says
   "Stopped, not saved yet" with **Sell it again**. Today: "You sell every building in the builder's
   list" (`add-style-library-390.png`).
7. Add it, and Make my own from it (name "Premium Lofted Barn"), each land on the new building's
   Edit page with the first empty price box focused. The own style's key is LB1.
8. A missing price flags the card ("1 missing a price"). **Show me** opens that Edit page with the
   box focused.
9. At 390, 768, 1024 and 1280: no sideways scroll, every tap at least 44 px, pictures taken.
10. A manager sees the price sheet with no Edit and no cards.
11. A price list saved by today's code (own style LB1, How it's built numbers, categories) opens and
    saves with `changes: []`.

Node checks:

12. New `tools/check-picture-key.mjs`, the key rules in the table in section 2. Today the module
    doesn't exist.
13. `tools/check-setup-access.mjs`, extended: a visit save that changes `offer.LB.built.wallHeight`,
    business-wide `built`, or an extra's `built` is refused with `LOCK_WORDS.construction`.
    `offer.UT.built.roofPitch` is allowed. Stopping a style with numbers of its own is allowed.
    Today on the merged base these are accepted.
14. `tools/check-office.mjs`, extended for setup:
    * `start: "pick", styles: ["UT","G"]` gives exactly those two in `offer`, empty groups dropped,
      and `defaults.style` set to one of them;
    * `[]` gives 422 "Pick at least one building.";
    * `["ZZ"]` gives 422;
    * `"small"` still works.
15. A build check (in the check that runs `build-site --client`): `dist-client/ui/office/pictures.js`
    exists, `main.js` does not contain `createRenderer`, and `main.js` carries the same
    `__PICTURES_ID__` as the sha256 of `pictures.js`.
16. `tools/check-wording.mjs`: the new banned phrases. Today it fails on setup.js :140 and :220,
    buildings.js :66 and model.js :437.

Checks to update so they pass, not to weaken them: `check-how-its-built.mjs` and
`check-setup-screens.mjs` (section 1). Browser checks on SwiftShader with
`--use-angle=swiftshader --enable-unsafe-swiftshader`, and every server stopped at the end.

## 9. Order of commits (on `lane/dc-buildings`)

0. **Merge** `lane/dc-setup` into `lane/dc-fast` (the 10 hunks of section 0), then `lane/dc-refs`.
   check-all green apart from `check-style-refs`. Skip if a merged lane already exists.
1. **Barnwright's lock covers How it's built.** setup-lock.js and test 13.
2. **Standard pictures remade with the shop numbers.** `node tools/make-style-refs.mjs`;
   check-style-refs green; Alan sees the new sheet.
3. **Picture key.** `model/picture-key.js` and test 12.
4. **Pictures drawn in the browser.** `ui/office/pictures.js`, `price-list/pictures.js`, build-site,
   office-local, `__PICTURES_ID__`, IndexedDB cache, fallback; test 15. Nothing on screen uses it yet
   except a hidden check hook.
5. **Your buildings: cards and the Edit page.** buildings.js split, building-page.js, routes, state,
   bits, owner.css, focusPending and showFirstProblem, opens-on row; tests 1-5 and 8-11. Update
   check-how-its-built and check-setup-screens in the same commit.
6. **Add a building gallery.** add-building.js, Make my own dialog; tests 6-7.
7. **How all your buildings are built gets its own page.** Toolbar link; check-how-its-built's
   business-card part points there.
8. **Barnwright mode on the Edit page.** `readOnly`, `gableStyles` in `me()`; a visit step in
   check-setup-screens.
9. **First setup: Every standard building, or Pick your buildings.** setup.js, server, index.js;
   test 14 and a setup step in check-your-buildings.
10. **Words and docs.** help-answers.js, OFFICE.md, FOR-ALAN.md, check-wording (test 16).
11. **Pictures for Alan.** `test/out/your-buildings/` at 390, 768, 1024 and 1280; then
    `node tools/check-all.mjs`. No push or PR until Alan has seen them.

## 10. Standard layout

Alan: "Let them edit the building to set the layout of their standard building for all the
dealership." The owner sets the doors, windows and porch posts each building comes with, and every
lot uses it. The mockup's screen is `#layout-LB` (the Edit page's **Set the standard layout** button);
`#layout-C` shows a porch.

### What is saved: a data loadout per business

* **Where.** A new offer key, `offer[K].layout`: a data recipe in the language `model/loadouts.js`
  already reads (`evalDataRecipe` :294-338: `center`, `pos`, `fromStart`, `fromEnd`, `sym`, `when`,
  `ifFits`, `dbl`; formulas over W, L, q, len, CASING and CAT sizes, no `eval`).
  * `OFFER_KEYS` (company.js :78) gains `"layout"`. `resolve()` takes it ahead of the style's own:
    at company.js :820, `t.loadout = o.layout ? copy(o.layout) : copy(s.loadout)`. A style of the
    business's own (`base`) gets its own layout the same way.
  * `validate()` must check it, and today it would not. The loadout shape check (:191-192) is in
    `validateManufacturer`, for the manufacturer's styles only, and `validate()` runs `loadoutCats`
    (:266) on the manufacturer's style (`const t = styles[baseOf[k]]`, :443-445), never on the
    offer. Without a change, a layout naming an item the business doesn't price would save, and
    every customer's 3D designer would then stop in `evalDataRecipe` with "uses item …, which this
    company does not sell". So company.js gains two small changes:
    * `validate()` checks `offer[k].layout`'s shape: a list of entries with only the keys a recipe
      knows (`cat`, `wall`, `at`, `when`, `dbl`, `ifFits`, `repeat`), and inside them too: an `at`
      that is `center` or one of `pos`, `fromStart`, `fromEnd`, `sym`, `porchStart`, `porchDoor`, and a
      `when` with only `minL`, `maxL`, `minW`, `maxW`, `minP`, `maxP` and `porch`. `evalDataRecipe`
      never reads a `when` key it doesn't know (loadouts.js :305-309), so a misspelt one would put the
      entry on every size; it is refused in words instead: "The standard layout of the Side Cabin has
      "minp", which is not a size rule (use minP).";
    * at :445 it calls `loadoutCats(o.layout ? Object.assign({}, t, {loadout: o.layout}) : t, k, …)`,
      so "needs a price" and "could not be worked out" cover the owner's layout too.
  * Beyond those, `resetItems` (layout.js :240-247), `stdDouble` (model/pricing.js :103-108) and the
    porch walls in design.js :362 go through `standardItems`, so the 3D designer, the price and the
    order paperwork follow the layout with no other code. One more user of `standardItems` has to
    change: the server's quote check, server/office/pricing.js :135-163 (see **What customers
    see**). It refuses some quotes on today's code, and owner layouts would make that common.
  * No layout saved means the builder's (`barnwright:<K>`), so every price list saved today opens
    unchanged.
* **The builder's items the owner did not touch stay exact.** Each named recipe gets a data twin in
  new `model/loadout-twins.js`: the same items, written as data. Thirteen already exist and pass: the
  `DATA` list in tools/check-companies.mjs section 8 ("data loadouts = the named Barnwright
  recipes": UT, MU, SU, SLB, GU, SB, LB, MLB, SS, G, MG, LBG and DK). They move into the new file;
  DS, BU, CS, MCS and the six porch cabins are written new. For example SU is
  `[{cat:"w72",wall:"R",at:"center"}, {cat:"w23",wall:"R",at:{sym:"q+1.4"}}]`, the cottage's door
  choice is two entries with `when` on L, and the cabin's front windows use `when: {minW: 10}`. A
  test checks every twin against `includedItems` at every size from 6×8 to 14×40. The porch cabins:
  * **Cabin and Lofted Barn Cabin.** Their two posts are one entry,
    `{cat:"ppost",wall:"F",at:{sym:"CAT.d36lite.w/2+0.2+CAT.ppost.w/2"}}` (2 ft each side of the
    middle at every width), and the front windows
    `{cat:"w23",wall:"F",at:{sym:"(CAT.d36lite.w/2+0.2+CAT.ppost.w+W/2-0.45)/2"},when:{minW:10}}`.
    Checked the same as the real layout at 8×12, 10×20 and 12×24 (`run/facts/porch-facts.mjs`).
  * **Deluxe Side Cabin and Deluxe Loft Side Cabin.** Pure data, the porch walls P1 to P3 included:
    `d36lite P3 {pos:"0.45"}`, `w23 P1 center`, `w23 P2 center`, `w23 F {pos:"-(W/2-2)"}`,
    `w23 R {pos:"6"}`, `ppost F {sym:"W/6"}`, `ppost R {pos:"6-L/2"}`, `ppost R {pos:"10-L/2"}`, plus
    `fake F center` for the loft one. L includes the 4 ft deck there. Checked the same at 12×20, 12×24
    and 12×32 (`run/facts/dsc-twin.mjs`).
  * **Side Cabin and Loft Side Cabin.** Their porch door, porch windows, right-side window, end-wall
    window and posts follow the porch the customer picks (8 or 12 ft, at the front, flipped to the
    back, or in the middle; model/loadouts.js `includedItems` SC/LSC). Porch anchors alone can't
    write that: the right-side window sits P/2 from the middle (minus P/2 when flipped, and two
    windows at ±(P/2+2.7) in the middle), the end-wall window is on F, on B, or on both, the second
    porch window comes only with a 12 ft porch, and the end-wall window sits at half the porch
    depth, which a data recipe is never given today (`standardItems` passes `porchDepth` only to
    named recipes, loadouts.js :349 against :351). So the first build extends `evalDataRecipe`:
    * two more formula variables: `P`, the porch length (`ctx.span.P`), and `pd`, the porch depth
      (`standardItems` passes `porchDepthOf(t)` to data recipes too);
    * `when` learns `porch: "front" | "back" | "middle"` (from `span.f` and `span.mid`; a list is
      allowed) and `minP` / `maxP`;
    * two porch anchors read from `ctx.span`:
      * `{porchStart: d}`, d ft from the porch's front end. On a porch at the front end that is its
        open end, at the corner post (R pos = -(z1 - d), that is d - L/2). On a flipped porch the open
        end and the corner post are at the back, and d is from there (R pos = -(z0 + d), that is
        L/2 - d), so a post set beside the corner post stays beside it. A middle porch has no open end
        and no corner post (parts/porch.js :166 draws none when `mid` is set): d is from its end
        toward the front wall (R pos = -(z1 - d), that is d - P/2). The real 3D designer lays the
        layout out again when a customer taps Middle porch (ui/state.js `choosePorchPlace` calls
        `resetItems`), so every moved post has a place on every porch;
      * `{porchDoor: d}`, d ft from the porch door: R pos = (the pos of the first door entry on S1
        already placed) - (span.z0 + span.z1)/2 + d, so +d is toward the back end (the same sums as
        `includedItems` SC, loadouts.js :152-154). It is refused in words when no S1 door comes
        before it: "The Side Cabin's porch post is set from the porch door, but there is no porch
        door before it in the standard layout."
    The SC twin, for example:
    * the porch door `{cat:"d36lite",wall:"S1",at:{pos:"P>=12 ? 0 : 1.4"}}`;
    * the porch windows `{cat:"w23",wall:"S1",at:{pos:"P>=12 ? -(P/2-1.9) : -1.7"}}` and
      `{cat:"w23",wall:"S1",at:{pos:"P/2-1.9"},when:{minP:12}}`;
    * the right-side window `{cat:"w23",wall:"R",at:{pos:"P/2"},when:{porch:"front"}}`, the same at
      `{pos:"-P/2"}` with `when: {porch: "back"}`, and on the middle porch two entries, in this order
      (the order `includedItems` gives, which test 17 compares item for item):
      `{cat:"w23",wall:"R",at:{pos:"P/2+2.7"},when:{porch:"middle"}}` then
      `{cat:"w23",wall:"R",at:{pos:"-(P/2+2.7)"},when:{porch:"middle"}}`;
    * the end-wall window `{cat:"w23",wall:"F",at:{pos:"-pd/2"},when:{porch:["front","middle"]}}` and
      `{cat:"w23",wall:"B",at:{pos:"pd/2"},when:{porch:["back","middle"]}}`;
    * the posts, in this order, `{cat:"ppost",wall:"R",at:{porchDoor:2.2}}` then `{porchDoor:-2.2}`;
    * LSC adds the faux loft window on F (`when: {porch: ["front","middle"]}`) or on B (`back`).
    Test 17 checks them on the 8 ft, 12 ft, flipped and middle porch at every size, and on a 6 ft
    deep porch (the end-wall window then sits 3 ft off the middle). It also checks an owner's moved
    post, `{porchStart: 3}` on the 12×24: R -9 with the porch at the front end, 9 flipped, and -3 on
    the 12 ft middle porch. If that slips, SC and LSC keep
    `barnwright:SC` and `barnwright:LSC`, and layout mode shows their posts but cannot save changes
    to them.
* **Anchors worked out from where each item sits** (new `model/layout-recipe.js`, Node-safe,
  `inferRecipe(items, frame)`), at the size the owner is looking at. The rules are the mockup's
  (`src/layout.js` `infer`):
  * exactly in the middle of its wall (within 1/16 in): `at: "center"`. Dragging snaps an item onto
    the middle when it comes within 4 in, so the middle is easy to hit; but one Move tap (3 in) off
    the middle is kept as it is (it gives `pos`), so the owner's move is never undone;
  * its near edge 3 ft or less from an end: `fromStart` / `fromEnd` with that gap, to the inch.
    "An item near the left end stays at the left end";
  * two of the same item mirrored about the middle (within 1/2 in; dragging snaps one onto the
    other's mirror within 4 in): one `sym` entry. Near the corners
    (3 ft or less) the gap is kept (`sym: "len/2-<gap>-CAT.w23.w/2"`); otherwise it is a share of the
    wall (`sym: "len*0.31"`). "A matched pair stays matched";
  * anywhere else: `pos: "len*<share>"`, the same share of the wall on every size;
  * an untouched builder item: its twin entry, unchanged;
  * a porch post: see **Porch posts** below;
  * the owner can change any of these on the item's sheet ("How it carries over to other sizes"),
    and type the gap.
  * Windows get `ifFits: true`. Doors get no `ifFits`: a door must fit everywhere, or carry a `when`
    the owner agreed to. The order is: the builder's untouched twin entries first, then the owner's
    doors, then the owner's windows, then gable items, then porch posts (they need no `ifFits`,
    below). So `fitsWall` already sees the builder's items when it places the owner's: an owner's
    door that comes closer than 7 1/2 in to one of them is refused (with the `when` fix when one
    exists), an owner's window is left off, and a window gives way to a door. It is always the
    owner's item that gives way. Without this order the real `resetItems` would keep the builder's
    window and crowd both, moving the owner's door (on the SU 12×24, a 36″ wooden door set at 9 ft
    5 in would end up at 9 ft 11 3/8 in).
  * A gable window's left-and-right place is saved (`center`, or `pos: "len*<share>"`); its height in
    the gable is not, because a recipe entry has no height (below).
* **The every-size check** (new `model/layout-check.js`, used by the 3D designer before it sends and by
  the server before it saves). For every size the style sells:
  * `evalDataRecipe` places the items. A door must be inside its wall with 0.5 ft spare at each end,
    and 0.62 ft (7 1/2 in) clear of every item already on that wall: the numbers of `fitsWall`
    (loadouts.js :279-291). A window that doesn't fit is left off that size, as `ifFits` does.
  * **One fit check, and it is `fitsWall` itself.** `fitsWall` is what every lot's 3D designer runs
    (`evalDataRecipe`'s `ifFits`, loadouts.js :279-291 and :331), so the check must give its answer,
    not a second one. Today `fitsWall` lacks two of `clampPos`'s rules (model/layout.js), and a check
    with its own copy of them would tell the owner one thing while every customer gets another:
    * on the Single Slope it measures an owner's window against the builder's transoms, which come
      first in the recipe. A window between the door and the right window, under the transoms
      (`{pos:"len*0.175"}`), is left off all nine sizes, though it fits on the 10×20, 12×20, 12×24 and
      12×32 (`run/verify-true-to-designer/ss-compare.mjs`);
    * where a window would stand in the open porch, `ifFits` places it anyway, and `resetItems` then
      moves it out of the porch with `clampPos`, whose porch rule runs after its push-apart passes, so
      it can land on another window: on the 12×24 Side Cabin with the Middle porch, an owner's window
      set 2 ft right of the middle ends up at 7 ft 6 in, 10 3/4 in over the builder's window
      (`sc-middle.mjs`, `sc-porch-compare.mjs`).
    So `fitsWall` gets the style (its roof, porch and kennel), `ctx.span` and the porch depth, and
    learns the two rules; `layout-check.js` calls the same `fitsWall` for every door and window. Then
    the check, the server and every customer's 3D designer give one answer:
    * **The Single Slope's transom row.** On the tall wall (R) of the Single Slope the transoms are a
      row of their own above the door and windows. A transom keeps clear of transoms only, and a door
      or window of doors and windows only (`clampPos`'s band rule, layout.js :106-107). Without this
      the check would leave off or refuse nearly every Single Slope transom.
    * **The open porch and the dog run are not wall.** A door or window that would come within
      `clampPos`'s margin of a side porch's opening (0.45 ft beside it on R, 0.35 ft on F and B), a
      wrap porch's deck (0.45 ft on R and L, 0.35 ft on F) or the Dog Kennel's run (0.55 ft) doesn't
      fit (layout.js :114-153). So `ifFits` really leaves a window off there, and a door there is
      refused. The words say so: "it would stand in the open porch". A front porch's side walls are L
      minus the porch depth long, and a wrap porch's length includes the deck (frame.js wallDefs,
      dims).
  * **Porch posts** are never left off and never refused. Each is held on its porch edge at every
      size (clampPos's porch rules, below), and a post never blocks a door or window, nor is blocked
      by one (fitsWall :283 and :287 already skip posts). The check only says when two of them stand
      in the same spot (closer than a post's width, 0.34 ft), because they are then drawn as one:
      "Two porch posts stand in the same spot on the front of the porch. Move one, or remove it.", or
      "On the 8×12 two porch posts stand in the same spot at the end of the porch." where two are
      held at the end on a smaller size. On the Side Cabin it is said once for every porch place a
      customer can pick that has the same sizes: "If a customer picks the 4 × 8 porch at the front
      end or in the middle (Middle porch), two porch posts end up in the same spot at the end of the
      porch, on every size. Move one, or remove it." Then it never says "Everything fits", and no
      drawing in the result says it for a size a line names ("These posts fit", "This wall fits").
      The result is headed "Saved. One thing to look at", in an amber box, with **Show me the two
      posts** (below).
  * The builder's own items the owner did not touch are never left off either: the real 3D
    designer settles them with `clampPos` (pushed 7 1/2 in apart in four passes, kept 6 in from the corners),
    so on the smallest sizes they are crowded, not dropped (SU, DS and SLB at 8×12 and 10×12, BU at
    6×10, SS at 8×12 and 10×12). They come first in the recipe, so only the owner's own entries get
    the left-off or refused words.
  * **Every place a customer can put a side porch.** On the Side Cabin and Loft Side Cabin the
    customer picks the porch length ("4 × 8 porch" or "4 × 12 porch"), Corner porch or Middle porch,
    and Flip porch. Flip porch mirrors the items and "4 × 8 porch" only moves them along
    (design.js flipPorch :116, state.js choosePorchLength :176); the mirror of a layout that fits
    always fits, so the check works out the places where the layout is laid out again: Middle porch
    (`choosePorchPlace` calls `resetItems`), and `resetItems` for the porch the design has, flipped or
    shorter too (Corner porch after Middle porch, `chooseSize` on an untouched layout, `setType`,
    design.js :84 and :100). `validate()` already works out every one of them (`loadoutCats`
    :266-283). So for these two styles the check runs every size × every side porch length the size
    allows × at the front end, flipped to the back end, and in the middle: the same variant list. With
    `fitsWall`'s porch rule (above), a door or window that would stand in the open porch, or too close
    to the builder's item that follows the porch, is treated like the other cases: a door is refused,
    a window is left off there. The words name the porch the way the 3D designer does: "On the 10×20,
    12×20, 12×24, 12×30 and 12×32 when the customer taps Middle porch, the 2×3 window about three
    fifths of the way along the right side would stand in the open porch, so it's left off there."
    The Edit page's card says "(left off the 12×24 when the customer moves the porch)". The mockup
    does the same (`checkLayout` with `porchPlaces`).
  * Every size must keep at least one door. A porch-inside door counts on the side-porch and
    wrap-porch cabins.
  * The words, the same in the 3D designer and the server's 422:
    * left off: "Checked 14 sizes. On the 8×12 and 10×12 the 2×3 window in the middle of the
      right side doesn't fit, so it's left off there."
    * refused: "On the 8×12, 8×16, 10×12, 10×16 and 12×16 the 48″ wooden door about three
      quarters of the way along the right side doesn't fit: it would be closer than 7 1/2 in to the
      48″ wooden door in the middle of the right side." The fix offered is a `when` that leaves the
      door off exactly those sizes ("Only put it on sizes 20 ft long and up"), when one exists.
  * It also returns item positions for the smallest, typical and largest size, so the result can
    show three small drawings.
  * The server runs it in `checkChangedStyles` (the `sizeCheckOf` path, price-list.js :574) for each
    offer whose `layout` changed. It stays inside the 3 s budget: 14 sizes × a few items is
    microseconds.

### Layout mode in the 3D designer

* **Opening it.** The Edit page's **Set the standard layout** goes to the business's own 3D
  designer, `/d/<first lot>/?layout=<K>`. It is the same site, so the owner's Dealer Center sign-in comes with
  it. The 3D designer asks `GET /api/office/layout-mode?style=K`. Only an owner, or Barnwright in a
  visit, gets `{name, sizes, layout, version, colors}`; anyone else gets 403 "Only the owner sets
  the standard layout." and the 3D designer opens as a customer sees it.
* **New `ui/layout-mode.js`**, a plugin loaded only with `?layout=` (ui/app.js PLUGINS), like
  `views.js`:
  * the bar under the header: "Setting the standard layout for Lofted Barn. Every lot uses it."
    with **Cancel** and **Save as standard**;
  * the price plate says "Standard layout", and the quote, share and color cards are hidden;
  * the size chips stay, so the owner can look at any size. Front, Right, Back and Left in the views
    menu (index.html :65-69) give the straight-on wall the mockup draws, and the porch cabins get
    Porch too (see **Porch posts**);
  * the Side Cabin's porch chips become one choice under the size, **Porch the customer picks**, with
    the places the size allows: "4 × 12 porch at the front end (opens first)", "4 × 8 porch at the
    front end", "… at the back end (Flip porch)" and "… in the middle (Middle porch)", with the line
    "Customers can change the porch in the 3D designer. Pick one here to see your layout with it."
    Layout mode opens on the first, and the every-size check works the layout out on all of them
    (above). Picking another changes only what is drawn: the standard layout laid out for that
    porch, as `resetItems` does and the check sees it (not mirrored or moved along like a customer's
    chip). The line under the drawing names it ("The side porch of the 10×20 with the 4 × 8 porch at
    the front end, …"), the floor plan moves the porch, and the picture is greyed (it shows the
    porch the 3D designer opens on). The owner can move, add and remove posts there too. A post is
    saved the same way (`porchStart`, above), from the porch's corner post: "… from the front of the
    porch", or "… from the back of the porch" when it is flipped. A porch in the middle has no corner
    post: d is from its front end ("… from the front end of the porch"), the railing runs from end to
    end, and its limit words are "It's at the end of the porch: a post stays 10 3/16 in from the end."
    at both ends. This is how the owner sees, and fixes, two posts that end up in one spot only on a
    porch a customer picks;
  * moving, adding and removing use the 3D designer's own code (`clampPos`, the sheet, the "Add
    here" menu, "+ Add post"). The sheet gains, in `ui/layout-mode.js`:
    * "How it carries over to other sizes" with the inferred anchor, and a gap box;
    * **Move ‹ ›**, 3 in a tap through `clampPos`, and the Left and Right arrow keys on the picked
      item. The real sheet has neither today (ui/sheet.js has the type, Done, Remove and Duplicate),
      so test 21's arrows are these;
    * the words when `clampPos` stops a move, written under the arrows in two lines kept for them,
      not in a pop-up over the buttons (see **How far a post can go**);
    * for a post, **Add another post**: the 3D designer's Duplicate, 1.5 ft along, except that when
      the copy would be held at the end of the porch it goes 1.5 ft the other way (the real
      Duplicate, ui/state.js `duplicateItem`, leaves it at the end, closer than 1.5 ft to the first),
      and never onto another post (see **Adding and removing**). On the 8 ft wide Cabin and Lofted
      Barn Cabin the copy of the builder's right post then turns back to 6 in right of the middle, in
      front of the door, and the message says so ("Added another porch post, 6 in right of the
      middle, in front of the door.");
  * the sheet's switches a recipe cannot store are hidden in layout mode: Shutters, the window in a
    door, Turn 90 degrees, and a light's or gable window's height. A recipe entry has only `cat`,
    `wall`, `at`, `when`, `dbl`, `ifFits` and `repeat` (loadouts.js :14-18; `toItems` :48 sets
    `shut` to false). Adding those fields to the language, `toItems` and the twins test is a later
    step, if owners ask for it;
  * when an item is picked, the page scrolls as little as it can: the whole sheet above the bar with
    Cancel and Save as standard when it fits beside the picked item, else its heading and buttons,
    with room left for a phone app's header at the top (not the 3D designer's own
    `scrollIntoView`, ui/sheet.js :258, which on a phone pushes the picture away). Every sheet (a
    door's, a window's, a gable window's and a post's) has its title, Move and its buttons (Add a
    matching one or Add another post, Remove, Done) first, so on a phone at least half of the picked
    item stays in view above them, and Move moves something the owner can see. To make room for a
    gable window high in a porch cabin's gable, once something is picked the line under the drawing
    keeps only what still matters (what doesn't fit, the open porch), the line about the dashed
    posts says only "Move the dashed posts on the porch", and a gable window's sheet has
    no "Fits on this size" (it always fits). Where even then the buttons and half of a gable window
    can't both show (the 8 ft wide Lofted Barn Cabin's octagon), the buttons show with the bottom
    quarter of it. The wall choice, the rule, and the "How it carries over" choices are one scroll
    further down; for the builder's own item, none of which is pressed, a line under them says
    "Now: where the builder puts it. Pick one to change it."
    Nothing that comes and goes (the "close together" buttons, the limit words) sits above the Move
    row, and when the words above the sheet grow a line ("2 items don't fit on this size") the page
    scrolls by that line, so the arrows stay under the finger tap after tap. Messages go above the
    sheet's card (or, with no room there, above the picked item's box), never over its heading or
    buttons, and only the newest shows while an item is picked;
  * the floor plan (`ui/blueprint.js`) works as it does for customers.
* **Save as standard:**
  * `inferRecipe` and `checkLayout` run in the page, and the result shows at once;
  * when the layout saves but a line asks for a change (two posts in one spot), the result is headed
    "Saved. One thing to look at" in an amber box. **Show me the two posts** (and the X) keeps layout
    mode open on the Porch view, at the first size and porch place the line names, with one of the
    two posts picked; its sheet says "It's standing on another porch post. Move it along, or tap
    Remove." **Back to Edit building** still goes back;
  * then `POST /api/office/price-list/layout {style, layout, version}`, through the same `prepared()`
    and save as "Save for all lots": the lock in a visit, `check`, the size check, history ("Standard
    layout of the Lofted Barn: 36″ 11-Lite Door added on the right side, …") and publish to the
    lots;
  * 409 "Someone saved the price list first" reloads and keeps the owner's layout on screen;
  * **Back to Edit building** returns to `/dealer#/price-list/building/K`.
* **The Edit page's draft.** The layout saves on its own, so an Edit page with unsaved price changes
  would get a 409 on its next save. On return (focus or hashchange), the Dealer Center fetches the
  record. If the only newer change is `offer[*].layout`, it moves the draft's base forward and keeps
  the owner's other unsaved changes. Anything else is the usual "someone else saved first".
* **The Edit page's card** "Doors and windows that come with it" lists the layout wall by wall with
  each item's rule and the sizes it is left off, from `layout-check.js`. It also has **Change the
  standard layout** and **Go back to the builder's layout** (with a confirm; that saves
  `offer[K].layout` removed). The Your buildings picture changes by itself: the plan, and so
  `pictureKey`, includes the items.

### Porch posts

The six porch cabins (Cabin, Lofted Barn Cabin, Side Cabin, Loft Side Cabin, Deluxe Side Cabin and
Deluxe Loft Side Cabin) come with porch posts. In the real 3D designer a post is an ordinary item:
the customer drags it along the porch edge, removes it, duplicates it and adds more with "+ Add post"
(ui/interaction.js :213, :239-260; ui/state.js :219, :258-277; ui/panels.js :288). Layout mode does
the same, so the owner sets the posts every customer starts from.

* **Where a post stands.** On the porch deck, 0.2 ft in from its outer edge, not on a wall: along the
  front edge on a front porch and on the front face of a wrap porch, along the side edge on a side
  porch and on the side face of a wrap porch (parts/openings/porch-post.js). The porch depth moves
  the wall behind the porch, not the posts. The fixed corner posts are part of the porch: two on a
  front or a wrap porch (parts/porch.js :136, :211), one at the open corner of a side porch (:166),
  and none when the customer puts that porch in the middle. They cannot be moved or removed. The
  Porch view draws them darker and striped, says "Brown posts move. The striped corner posts hold up
  the porch roof, so they stay." under the drawing, and a tap on one says why it stays.
* **The Porch view.** Layout mode's views menu gains **Porch** on these cabins (**Porch front** and
  **Porch side** on the wrap-porch ones). It shows the porch edge straight on: the deck, the corner
  posts, the posts the owner can drag, the header band, and the railing with its way in left open in
  the widest gap (in front of the porch door on a side porch, parts/porch.js :89-95, :168-181; on a
  wrap porch's side a tie goes to the bay nearer the back end of its 12 ft run, as `porchCorner`
  scans, :221-226). That gap is also where a customer's ramp goes when the door it is for opens onto
  the porch (parts/ramp.js :21-29), so moving posts moves the ramp too; the post sheet says so: "The
  railing stays open in the widest gap: that's the way in, and where a ramp goes." The front view of
  the wall behind shows the posts only as faint dashed outlines, with a line under it that opens the
  Porch view: "The dashed posts stand on the porch, 4 ft in front of this wall. Move them on the
  porch" (on a wrap porch "… on the front edge of the porch"). A tap on the open porch drawn on a
  wall (the Side Cabin's front, the Cabin's sides) opens the Porch view, and such a wall's line says
  "The porch posts are on the side of the porch. Go to the porch". In the Porch view a tap on the
  pale drawing says what it is: "That's the front wall behind the porch. To move its door or
  windows, tap Front." The mockup's screen is `#layout-C`, Porch. How the 3D picture does it
  (`ui/layout-mode.js`, with a small hook in `ui/interaction.js`; commit 15):
  * In layout mode's Front, Right, Back and Left views the renderer's stage table hides the stages
    `porch` and `porch-frame` (parts/stages.js: the railing, ceiling and step; the posts and header
    bands). `pickItem` already skips the hit quads of hidden stages (`hiddenStages`, ui/interaction.js
    :166-197). Today a post's tap area stands 0.3 ft in front of the post, about 4 ft in front of the
    front wall (parts/openings/porch-post.js :37-43; the door and window tap areas are 0.3 ft in
    front of the wall, common.js :198), and the nearest tap area wins, so in a straight-on Front view
    a post covers the edge of the door behind it. That is the same trouble Alan had in the mockup.
  * The dashed outlines are a 2D layer over the picture, each placed from its post's position
    through the camera (the way `measShow`, ui/interaction.js :83, places the tape measure). Each
    is a button at least 44 px wide (it steps in, row by row, only where a door's or window's middle
    is that close) and is decided on the finger's first touch: a tap, or a drag that starts on it,
    opens the Porch view with that post picked, and never picks or moves the door or window behind.
    A drag carries on in the Porch view: the rest of the same finger movement moves the post along
    the porch edge, so the first drag is never "it didn't move".
  * The Porch view is a straight-on camera at the porch edge with every stage shown. While it is
    up, the hook in `pickItem` skips the hit quads of anything but porch posts, so the pale wall
    behind can't be picked. The line under it says "The pale drawing is the wall behind the porch,
    with its door and windows." (on the wrap porch's front that includes the porch door in the wall
    across the back of the porch, P3). Each post's tap area is at least 44 px wide: where two
    posts stand close, they share the space between them halfway and each grows outward, away from
    its neighbour, into the railing bay. Only a post with a close neighbour on both sides stays
    narrower, and its sheet then offers "The one to the left" and "The one to the right".
* **How far a post can go** (clampPos, model/layout.js): on a front porch, up to W/2 - 0.8 ft from the
  middle (±3.2, ±4.2 and ±5.2 ft at 8, 10 and 12 ft wide); on a side porch, inside the porch run,
  0.85 ft from each end; on a wrap porch, 0.85 ft in from the corners across the front and 0.85 to
  11.4 ft back down the side. When a move is stopped there, the words under the Move arrows say why:
  * a front porch, and the front of a wrap porch: "It's as close to the corner post as it can go.";
  * a side porch: "It's as close to the corner post as it can go: a post stays 10 3/16 in from the
    front of the porch." and "It's at the end of the porch: a post stays 10 3/16 in from the end.";
  * a wrap porch's side: the same at the front, and "It's at the end of the porch: a post stays
    7 3/16 in from the end." at the back of its 12 ft run.
  The 3D designer itself stops a drag there and says nothing, so these words are part of layout
  mode (`ui/layout-mode.js`).
* **Adding and removing.** "Porch post" in the add list puts one in the real 3D designer's first free
  spot from the middle, else in the middle (on a 10×20 Cabin that is in front of the door, and the
  way in moves to the widest gap; the message says "in front of the door"). "Add another post" is the
  3D designer's Duplicate, 1.5 ft along, turning back the other way where the copy would be held at
  the end (above). Remove works on every post, the builder's too. The posts are never snapped to the
  middle while dragged: the real 3D designer's `snapCenter` skips posts (`neighborGaps` gives null
  for them, model/layout.js :194).
  * **A new post never lands on another one**, on any size the style sells, nor on any porch place a
    customer can pick. The 3D designer has no such rule (its first free spot gives the middle when
    nothing is free, whatever post stands there, and Duplicate goes pos + w + 0.9 ft), so layout mode
    adds it in `ui/layout-mode.js`: a new post that would stand closer than 0.67 ft (a post and 4 in)
    to another post on the same porch edge, on the size shown or held at the end of a shorter porch
    on another, steps on 3 in (a Move tap) at a time, first the same way, then the other way,
    staying on the porch edge, until it is clear of every post everywhere. On the 10×20 Side Cabin
    the first free spot is 10 ft from the front of the 12 ft porch; the 4 × 8 porch would hold it at
    its end, on the builder's post, so it goes 6 ft 3 in from the front instead. When no spot is
    clear everywhere it takes one clear on the size shown, and the message says "With some sizes, or
    a porch a customer can pick, it stands on another post. Save as standard says where." Only when
    there is no clear spot even there does it stay, and the message says "It's right beside another
    post. Drag it where you want it."
  * **A post moved onto another** is allowed, as in the 3D designer (`clampPos` skips posts when it
    pushes items apart), but it is said: the two lines under the Move arrows say "It's standing on
    another porch post. Move it along, or tap Remove.", the line under the drawing says two stand
    in the same spot, and so does the every-size check (above).
  * **How many.** `validate()` caps `offer[K].layout` at 100 items in all, counting repeat counts
    ("The standard layout can have at most 100 doors, windows and posts."). The server reads at most
    250 items on a quote or an order (server/office/pricing.js :111), and the customer's own
    additions and the electric package's fixtures must still fit under that.
* **How a post is saved and carries over.** A post the owner did not touch stays its twin entry
  (above). A moved or added post is saved by how it was set:
  * on a front porch or a wrap porch's front: "Same distance from the middle" (the default,
    `{pos:"<d>"}`), "From the left corner" (`{pos:"-W/2+<d>"}`) or "From the right corner"
    (`{pos:"W/2-<d>"}`), d to the middle of the post. The Cabin's and Lofted Barn Cabin's twin keeps
    both builder posts in one `sym` entry; moving one of them splits it into two `pos` entries, the
    untouched one as `{pos:"-(CAT.d36lite.w/2+0.2+CAT.ppost.w/2)"}` (no minus for the right one) and
    the moved one as `{pos:"<d>"}`. Posts the owner sets are never paired into a `sym`;
  * on a wrap porch's side: from the front of the porch, `{pos:"<d>-L/2"}` (L includes the deck);
  * on a side porch: from the front of the porch, `{porchStart:<d>}` (the new anchor above).
  d is to the 1/16 in, so each tap of Move ‹ › is 3 in even from the builder's post that stands off
  the inch (on the Side Cabin it stands 8 ft 2 3/8 in from the front of the porch). A post put at
  the end of its porch edge, or within 1 in of it, is saved at the end itself: W/2 - 0.8 ft on a
  front porch, so 4.2 ft on a 10 ft wide Cabin (said as 4 ft 2 3/8 in), where the 3D designer lets
  it go, and on that size it is not "held". On a smaller size a post that would land past its end
  is held at the end of the porch edge. It is never left off; the every-size check only says when
  two posts stand in the same spot.
* **Price.** Posts in the standard layout are included (`inc: true`), like the builder's; the demo
  and starter price lists price a post at $0 (companies/demo/company.json :241).

### What customers see

* Every lot's 3D designer starts each customer on the business's layout at the size they pick
  (`resetItems`). They can still move, add or remove doors, windows and porch posts on their own
  building, as today.
* Items in the standard layout are included (`inc: true`), so their price is in the building's price,
  the same as the builder's doors today (pricing.js :119-120). The add list on the layout screen says
  so, because adding a door to the standard layout gives it away unless the owner raises the
  building's prices.
* **The server's quote check must change** (server/office/pricing.js :135-163). It counts how many
  of each item the standard layout has for the design's size and porch now (`comesWith`), and
  refuses the whole quote ("This design could not be read. Refresh the page and try again.") when the
  design has more of an item marked included. Included items stay included when a customer changes
  the size or the porch of a layout that is no longer untouched (`setSize` and `choosePorchLength`
  only move them), so on today's code these are refused: a 12×24 Side Cabin where the customer taps
  "4 × 8 porch" (the second porch window stays included; the 8 ft porch comes with one), and a 10×20
  Cabin whose door was moved 3 in, then made 8×12 (its front windows stay included; the 8 ft wide
  recipe has none); the same for the Backyard Utility from 6×12 to 6×8
  (`run/verify-true-to-designer/server-porch.mjs`, `server-inc.mjs`). Owner layouts make this much
  more common: every owner window with `ifFits` or a `when` that drops on some sizes or porch places
  gives a refused quote once the customer has moved anything and then changes the size or the porch.
  The fix: `comesWith` counts, for each item, the most the style's standard layout has at any size
  and porch place the price list sells (the same variants as company.js `loadoutCats` :266-283). It
  is picked over clearing `inc` in `chooseSize`, `setSize` and `choosePorchLength` because it keeps
  today's prices: an item that came with the building stays in its price.
* Orders and saved designs keep their own items (`itemOut` stores `cat`, `wall`, `pos` and `inc`,
  design.js :197-211), so an order made before the change reopens with the same doors and the same
  price.
* Versions (LB1) have their own layout. The result says "Your Tall Wall Lofted Barn keeps its own
  layout."

### The Barnwright visit

* In a visit Alan can open layout mode from the dealer's Edit page. The 3D designer's save goes to
  `/api/office/barnwright/price-list/layout`.
* The lock (setup-lock.js `lockProblems`, commit 1) allows `offer[K].layout` to change: doors and
  windows are part of setting up a dealer's buildings, not how they are built. The change shows in
  History under "Barnwright", and the owner can put it back from there.
* The Claude connector gets one edit, `set_standard_layout {style, layout}`. It goes through the same
  `layout-check.js`, so Claude gets the same words when a door doesn't fit.
  `check-setup-access.mjs` adds a case.

### Tests that must fail on today's code

17. `tools/check-loadout-twins.mjs`: every twin equals `includedItems` at every size, within 0.001 ft,
    the porch posts included; for SC and LSC also on the 8 ft, 12 ft, flipped and middle porch, and
    with a 6 ft deep porch. Today the 13 twins in check-companies.mjs pass, but DS, BU, CS, MCS and
    the six porch cabins have none, and `evalDataRecipe` has no `P`, `pd`, porch `when` or porch
    anchors.
18. `tools/check-layout-recipe.mjs` (`inferRecipe`):
    * an item exactly in the middle gives `center`; one 0.25 ft (one Move tap) right of the middle
      gives `pos: "len*<share>"`, and `evalDataRecipe` puts it back 3 in right of the middle;
    * one 1 ft 6 in from the left end gives `{fromStart: "1.5"}`;
    * a mirrored pair gives one `sym`;
    * one a third along gives `pos: "len*-0.1667"`;
    * an untouched SU window pair gives its twin.
    Then `evalDataRecipe` of the result at the same size puts every item back within 1 in.
19. `tools/check-layout-check.mjs` with the mockup's cases:
    * the Lofted Barn layout gives exactly the "left off the 8×12 and 10×12" words;
    * two 48″ doors on the UT right side are refused, with the `when` fix `{minL: 20}`;
    * a layout with no door is refused, with the words "every size needs a door";
    * the Single Slope's builder layout on the 12×24 keeps all six transoms (the transom row), and
      `evalDataRecipe` of the SS twin plus `{cat:"w23",wall:"R",at:{pos:"len*0.175"},ifFits:true}`
      keeps the window on the 10×20, 12×20, 12×24 and 12×32 and leaves it off the five smaller sizes,
      exactly as `layout-check.js` says (today `fitsWall` leaves it off all nine);
    * the builder's SU layout on the 8×12 keeps both windows, crowded, with no left-off words;
    * a 2×3 window set 6 in from the front corner of the Deluxe Side Cabin's right side is left off
      every size ("it would stand in the open porch"), and a 36″ in-swing door there is refused; a
      window in a Side Cabin's porch opening is left off the same way. (The Cabin's right side is the
      wall behind its front porch, L minus the porch depth long, frame.js wallDefs: a window 6 in from
      its front corner is on the wall, kept on every size but the 8×12, where it crowds the builder's
      window.);
    * the Cabin's posts are at ±2 ft on the 8×12; a post set 4 ft from the middle on the 12×24 is
      held at 3.2 ft on the 8×16, with no left-off words;
    * the Cabin's left post moved onto the right one gives "Two porch posts stand in the same spot
      on the front of the porch. Move one, or remove it." and not "Everything fits"; two posts set
      3 ft 6 in and 4 ft 6 in right of the middle on the 12×24 give "On the 8×12 and 8×16 two porch posts
      stand in the same spot at the end of the porch.";
    * a window set 2 ft right of the middle of the Side Cabin's right side on the 12×24 is left off
      "when the customer taps Middle porch", and the builder's own Side Cabin layout fits every size
      on every porch place. `evalDataRecipe` and `resetItems` for that window (`{pos:"len*0.0833"}`,
      `ifFits`) with the Middle porch leave it off too, and on every size and porch place no two
      right-side windows end up closer than 7 1/2 in (today `clampPos` moves it to 7 ft 6 in, 10 3/4
      in over the builder's window);
    * on the Side Cabin, the builder's post 3 ft 9 5/8 in from the front of the porch moved to 7 ft 6 in
      gives "If a customer picks the 4 × 8 porch at the front end or in the middle (Middle porch), two
      porch posts end up in the same spot at the end of the porch, on every size. Move one, or remove
      it.";
    * on the SU 12×24 an owner's 36″ wooden door set at 9 ft 5 in on the right side is refused
      ("it would be closer than 7 1/2 in to the second 2×3 window of the pair on the right side"),
      and the builder's two windows stay where `clampPos` puts them.
20. `tools/check-office.mjs`:
    * `offer.LB.layout` saves, and `resolve` uses it;
    * a door clash gives 422 with the words above;
    * a layout using an item the business doesn't sell is refused, with the "needs a price" words
      (today `validate()` never reads `offer[k].layout`, so it would save);
    * an old price list with no `layout` saves with `changes: []`;
    * `priceDesign` prices, and does not refuse as "This design could not be read": a 10×20 Cabin with
      its door moved 3 in, then made 8×12; a 12×24 Side Cabin, then "4 × 8 porch"; a Backyard Utility
      from 6×12 to 6×8; and a Lofted Barn with an owner layout whose window is left off the 8×12,
      after the same steps. Today the first three are refused;
    * a manager gets 403 from `layout-mode`.
21. Browser `tools/check-layout-mode.mjs` (port 8395):
    * the owner opens `/d/riverside/?layout=LB` and sees the bar words;
    * picks Right, adds a 36″ 11-Lite door, sets the gap to 1 ft 6 in, adds two windows, and taps
      Save as standard;
    * on the Cabin, opens Porch, drags a post along the porch edge, moves it with Move ‹ › until it
      stops and reads the words under the arrows, removes one, adds one with "+ Add post", and saves;
      a customer's Cabin then has those posts, and the railing's way in and a ramp on the door
      follow them;
    * a post moved to the middle and then "+ Add post", and "Add another post" twice from one post,
      give posts drawn in separate places, never two in one spot;
    * at 390 with a 100 px bar over the top, a finger tap on each dashed post on the Cabin's and the
      Lofted Barn Cabin's front wall, at every size, opens Porch with that post picked; a finger drag
      that starts on a dashed post moves no door or window, and moves that post along the porch;
      after a finger tap on a post in Porch, at
      least half of the post is still in view and the Move arrows are above the bar; 14 taps on the
      same spot of the right arrow move the post 3 in each until it stops;
    * after picking an item at 390 with a 100 px bar laid over the top, its sheet's buttons are all
      above Cancel and Save as standard;
    * at 390 with that bar, a finger tap on the Cabin's door and on a front window leaves at least
      half of it in view with Move, Remove and Done reachable, and four taps on Move › move it while
      at least half of it stays in view; the same for the Lofted Barn Cabin's octagon gable window
      (at least a quarter of it on the 8 ft wide sizes) and the Deluxe Loft Side Cabin's faux loft
      window, high in the gable;
    * at 390, after "Add another post" on the Cabin, and after "+ Add post" from the Back of the
      Deluxe Side Cabin (it lands next to the builder's post at the end of the porch's side), every
      post's tap area in the Porch view is at least 44 px wide;
    * the result shows the every-size words and three drawings;
    * on the Side Cabin, "+ Add post" and "Add another post" never put a post where it ends up on
      another one, on any size or porch place; Porch the customer picks draws each place (the posts
      held at the end of the 4 × 8 porch, no corner post on a porch in the middle); the builder's post
      moved to 7 ft 6 in from the front of the porch gives "Saved. One thing to look at", and Show me
      the two posts, or the X, opens the Porch view on the 10×20 with the 4 × 8 porch at the front end,
      one of the two posts picked;
    * at 390 with a 100 px bar laid over the top, the Edit page's "Go back to the builder's layout"
      shows its whole confirm, "Go back to the builder's" and "Keep yours", above the save bar;
    * the Edit page lists the layout;
    * a customer's 3D designer on the 10×20 Lofted Barn has the door on the right side and can drag it;
    * an order saved before the change reopens with the same items and price;
    * no sideways scroll and 44 px taps at 390, 768 and 1280.
22. `check-setup-access.mjs`: `set_standard_layout` in a visit saves, and shows in History as
    Barnwright's.

### Commits (after commit 11 above)

12. **Loadout twins**, the porch posts in them and the porch anchors (`porchStart`, `porchDoor`),
    test 17.
13. **`layout-recipe.js` and `layout-check.js`**, tests 18-19.
14. **`offer[K].layout`** in company.js, the server route, the size check and the history words;
    test 20.
15. **Layout mode** in the 3D designer (`ui/layout-mode.js`: the views with Porch, the stages hidden
    on the wall views, the dashed-post layer, the sheet's rule row, Move ‹ › and the arrow keys with
    the limit words, Add another post, the switches it hides; the `pickItem` hook in
    `ui/interaction.js`), and the Edit page's card and draft rebase; test 21.
16. **The visit and the connector**, test 22. Then pictures for Alan, and `check-all`.

## Questions for Alan before building

1. In a Barnwright visit, should Barnwright change only a gable roof's pitch (today's rule, kept
   here), or every How it's built number?
2. First setup: replace "Start small" (3 buildings) with "Pick your buildings"?
3. Should managers and dealers see the pictures on their price sheet too? That means the owner's
   browser uploads the pictures when it saves, which is a later step.
4. Standard layout: may Barnwright change a dealer's standard layout in a visit (planned: yes, shown
   in History), or only the owner?
5. Standard layout: should a door that doesn't fit a small size be allowed with "only on sizes 20 ft
   long and up" (planned), or must every door fit every size?
