# CLAUDE.md — the standalone 3D shed designer

## Who and why

Alan Yoder runs Yoder Storage Barns (a Weather King dealer, Port Charlotte FL)
and sells shed software under the name **Barnwright**. He **knows very little
about coding** — explain what things do in plain language, and never assume he
will read code.

This repo is the **3D designer on its own**: something he can sell to a shed
company that wants only the 3D designer, not the whole Barnwright software.
His words (Sep 2026): he likes how Barnwright's 3D designer looks; he wants a
3D model of **each part of a shed**, **a skill for each part**, and when there
is a new design it **builds it like in real life**; and it must be **fast to
set up new companies**. Build it here and **do not touch Barnwright**.
His words (Oct 2026): "use the 3d configuration in yoder storage barns …
change the building looks only" — the buildings are lit the way his own
Yoder Storage Barns site lights them (true colour), and nothing else moved.

## The rules that matter most

1. **Never modify Barnwright** (`alanyoder-04261992/boisterous-lokum-a737e0`).
   It is read only to record the golden fixtures. The one change Alan asked
   for there (Oct 10 2026, "yes change"): Barnwright's 3D designer wears the
   Yoder site's look too; its warm light is kept at `3ddesign.html?light=warm`,
   which is how every check here opens it (`BARNWRIGHT_PAGE`).
2. **The engine draws Barnwright's buildings shape for shape, and the
   standard buildings use Alan's shop numbers where he confirmed them.** The
   golden test (`node tools/check-golden.mjs`) draws Barnwright's own company
   with Barnwright's numbers (the standard library without its "How it's
   built" blocks, `tools/lib/barnwright-company.mjs`) and compares every
   triangle with Barnwright's (in Barnwright's warm light). Every other
   company gets the shop standard (Oct 2026, "yes match"; more styles
   Oct 11 2026): 5/12 roofs and 4 in eaves on the Utility Shed, Side
   Utility, Garage, Dog Kennel and Garden Utility, with 7 ft 9 1/2 in walls
   on the first three; the Dormer Shed's main roof at 7/12; barn roofs
   3 ft 7 3/4 in, 4 ft and 4 ft 3 in tall at 8, 10 and 12 ft wide on the
   Lofted Barn, Side Lofted Barn, Metal Lofted Barn and Lofted Barn Garage,
   with 6 ft 7 1/2 in walls on the first three (14 ft wide barns keep their
   height). Not the Metal Garage or Metal Utility; every other style keeps
   Barnwright's numbers until Alan says yes. The 8x12 and 10x12 Side
   Utility, Dormer Shed and Side Lofted Barn come with the 48 in Wooden Door,
   not the 72 in double doors (the Side Utility: Alan, Oct 11 2026, "replace
   6 foot to 4 foot"; the Dormer Shed and Side Lofted Barn: Oct 12 2026,
   "yes"; the prices stay as they were; Barnwright's own keep the double
   doors).
   No sample price list has a Steep roof; an owner can make one ("Roof pitch
   at least").
   `node tools/check-shop-numbers.mjs` holds the shop numbers (the recorded
   set `test/golden-shop/`) and `node tools/check-style-sizes.mjs` checks
   every style at every size. A red golden test is an engine change: fix the
   code, or re-record on purpose with a reason. A business can change how
   its own buildings are built in the Dealer Center (How it's built). The
   light is the Yoder site's
   true colour (`look.trueColour`, on for the demo and by default; its shader,
   rooms and contact shadow are read against
   `yoder-storage-barns/design.html` by `node tools/check-shaders.mjs`). The
   Yoder site is read only too.
3. **One real-life part = one module in `parts/` + one skill in
   `.claude/skills/part-<id>/SKILL.md`.** Before changing a part, read its
   skill. After changing a part, update its skill.
4. **A new company is configuration, never company-specific code.** Static
   examples use `companies/<id>/company.json`; a business on the Dealer Center
   keeps the same validated settings as its price list. Use the `new-company`
   skill.
5. **Keep the customer designer separate from internal construction lessons.**
   The designer stays plain ES modules. The **Dealer Center** (`/dealer`,
   `ui/office/`, `server/office/`, contract `docs/OFFICE.md`) runs on Netlify
   Functions, Identity and Blobs. The owner sets sizes, styles, prices and
   options once and every lot uses them; dealers see their own lots'
   customers and orders. `npm run build:client` makes a client package
   without lesson pages, skills, reference photos or setup tools. Only Alan's
   learning preview has lesson pages. A business Barnwright sells to is
   connected to Barnwright's control room (`server/office/account.js`):
   its account being off stops changes and closes its 3D designer links.
6. The contract is `docs/ARCHITECTURE.md`. Deliberate behaviour differences from
   Barnwright are listed in `docs/DIFFERENCES.md`.

## Words we use

Everything a person reads (screens, emails, errors, docs) uses one word per
thing: **Dealer Center** (never portal, office, workspace), **owner**,
**manager**, **dealer** (never admin, member, user), **lot**, **price list**
(never catalogue), **customer**, **quote** (#1042), **order** (same number),
**follow-up**, **3D designer**. Stages: New, Contacted, Quoted, Sold,
Delivered, Lost. Say what happened and what to tap; no disclaimers, no
slashes, no "this does not…". The full list is in `docs/OFFICE.md`.

## Running it

```
npm run serve            # http://127.0.0.1:8282/  (the designer)
npm run office           # http://127.0.0.1:8383/dealer  (the Dealer Center, sample data)
node tools/check-all.mjs # every check; each one prints what it proved
```

Browser checks use the Playwright that is installed globally
(`/opt/node22/lib/node_modules/playwright`) with Chromium's software GL
(`--use-angle=swiftshader --enable-unsafe-swiftshader`).
