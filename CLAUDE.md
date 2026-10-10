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
2. **The finished building is Barnwright's shape for shape, lit the way the
   Yoder Storage Barns site lights it.** The golden test
   (`node tools/check-golden.mjs`) compares every triangle with Barnwright's
   (in Barnwright's warm light). A red golden test is a look change — fix the
   code, or re-record on purpose with a reason. The light is the Yoder site's
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
