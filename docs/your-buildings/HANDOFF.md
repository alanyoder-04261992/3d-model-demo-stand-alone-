# Handoff: build "Your Buildings" into the Dealer Center

The completed build and current review instructions are recorded in
[IMPLEMENTED.md](IMPLEMENTED.md). The original handoff below is retained for
its approved scope and historical decisions.

This is for whoever picks up the build, whether a person or another AI. Claude started it and stopped on October 12, 2026. Claude will check the finished work on October 17 before anything is merged.

## Who this is for, and the one rule about words

Alan Yoder sells shed software:

- a 3D shed designer, and
- the **Dealer Center** (`/dealer`), where shed dealers run their price list, quotes and orders.

Alan knows very little about coding. So every word a dealer or Alan reads on screen must be plain. Say what happened and what to tap. Use no slashes, no tech words and no disclaimers.

Use the designer's own word list: Dealer Center, owner, manager, dealer, lot, price list, customer, quote, order, 3D designer.

## The goal

Alan approved a clickable mockup of a new Dealer Center screen called **Your Buildings**. His words were: "merge it to the /dealer". Build that screen for real in this repository.

- **The approved mockup:** `docs/your-buildings/mockup/index.html`. Open it in a browser. The pictures are in `mockup/thumbs/`. It is the target look and behaviour.
- **The detailed build plan:** `docs/your-buildings/BUILD-PLAN.md`. Read all of it first. Section 10 (Standard layout) is the largest part.
- **Open problems:** `docs/your-buildings/OPEN-PROBLEMS.md`. These were left in the mockup and its plan. Fix them in the real build:
  - two buttons hidden under the black bottom bar on a phone,
  - the porch-post messages,
  - corrections to BUILD-PLAN section 10.

### What the owner gets

1. **Your buildings.** The Buildings tab of the price list shows a picture card for every building the business sells. Each card has the name, the number of sizes, the "from" price and **Edit**. These cards replace the old on/off switches.
2. **Edit page** for each building:
   - picture, name, sizes and prices,
   - **How it's built** (roof pitch, wall height, overhangs, door height, porch depth, and "Check every size"),
   - "open the 3D designer on this building",
   - **Stop selling** at the bottom.
3. **Add a building.** A gallery of every standard building, with **Add it** and **Make my own from it**.
4. **How all your buildings are built** moves to a page of its own.
5. **Set the standard layout.** The owner moves, adds and removes doors, windows and **porch posts** the way a customer does, then taps **Save as standard**.
   - Every size is checked first.
   - Every lot's 3D designer then starts customers from that layout.
   - Porch posts move along the porch edge; they can be removed and more can be added. Copy the real 3D designer's rules for this; see BUILD-PLAN section 10, "Porch posts".

## Where the code is

- **Repository:** `alanyoder-04261992/3d-model-demo-stand-alone-` on GitHub.
- **Work branch:** `claude/friendly-carson-n2nllt`. Keep working on this branch, and open the pull request from it into `main` as a **draft**.
- **Starting point:** `main` at `6cef112`. Main already contains everything the plan's "section 0 (merge first)" asks for. Skip section 0.
- Section 5 (First setup) is **out of date**. First setup was removed, and a new owner's first sign-in now opens Today. Skip section 5, and do not bring First setup back.
- Line numbers in the plan are old. Read the current code.
- Read `CLAUDE.md` and the `.claude/skills/` files for any part you touch.

## Done so far

| Plan step | State |
|---|---|
| 3. Picture key (`model/picture-key.js`) | Done, committed |
| 4. Pictures drawn in the browser (`ui/office/pictures.js`, `ui/office/views/price-list/pictures.js`, `tools/build-site.mjs`, `tools/office-local.mjs`) | **Started, not finished and not checked.** It was saved as a "work in progress" commit. Check it, finish it, and test it. |
| Everything else (BUILD-PLAN section 9 commits 1, 2, 5-8, 10-11, and section 10 commits 12-16) | Not started |

## Alan's answers to the plan's "Questions for Alan"

1. **Barnwright visits:** keep exactly what the live code allows today. Do not widen it.
2. **First setup:** not needed, because it was removed.
3. **Pictures on managers' and dealers' price sheets:** not now. That comes later.
4. **Standard layout in a Barnwright visit:** yes, Barnwright may change it, and the change shows in History.
5. **A door too big for small sizes:** allowed, with the words "only on sizes N ft long and up".

## Rules that must hold

- **Every price list saved today opens unchanged.**
  - No price changes on its own.
  - Old saved designs and quotes price the same as before.
- New server routes use the same sign-in and permission checks as the routes next to them.
- The Barnwright lock (`setup-lock`) still holds.
- Every save goes into History in plain words.
- **Phone first.** At 390 px wide (iPhone), 820 (iPad) and 1280 (Windows, Edge), in light and dark:
  - nothing is hidden under a fixed bar,
  - nothing scrolls sideways,
  - every tap target is at least 44 px.
- Every new check fails on the old code and passes on the new code.

## How to check

- Run the full check with `node tools/check-all.mjs`. Three checks fail on `main` too and are not caused by this work: golden-labels, model-live and shaders.
- `npm run office demo` (see `tools/office-local.mjs`) starts a local Dealer Center to click through.
- BUILD-PLAN section 8 and "Tests that must fail on today's code" in section 10 list the tests to write.
- Take pictures of the new screens at 390, 820 and 1280 and save them in `test/out/your-buildings/`.

## When you are done

1. Make small commits in the plan's order, with clear messages.
2. Push to `claude/friendly-carson-n2nllt`.
3. Open a **draft** pull request into `main` with a plain-words summary.
4. **Do not merge.** Claude checks it on October 17 and merges it once it passes.
