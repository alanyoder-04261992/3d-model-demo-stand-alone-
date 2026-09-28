# The 3D shed designer, on its own

<!-- WHAT THIS FILE IS: the front page of this repo. What the product is, how
     to run it, where everything lives, and every check with what it proves.
     tools/check-docs.mjs proves every file, tool, command and skill named
     here really exists. Plain-English guide for Alan: docs/FOR-ALAN.md. -->

A 3D shed designer that a shed company puts on its own website. The customer
picks a building, a size and colours, moves the doors and windows, looks at the
floor plan, sees the framing inside the walls, watches the building go up step
by step, and sends a quote request. It is the 3D designer from **Barnwright**
(Alan Yoder's shed software), taken out on its own so it can be sold to a
company that only wants the designer.

* **It looks exactly like Barnwright's designer.** Every triangle of 148
  recorded Barnwright buildings is compared by `node tools/check-golden.mjs`,
  and every pixel of 24 finished pictures by `node tools/check-look.mjs`.
* **Every real-life part of a shed is its own file** in `parts/` (skids,
  floor, siding, roofing, each kind of door and window, and the framing: floor
  joists, studs, trusses, the loft, the roof deck, blocks and anchors) and has
  its own skill in `.claude/skills/part-<id>/SKILL.md`.
* **A new company is one settings file**, `companies/<id>/company.json`, made
  with `node tools/new-company.mjs` and filled from a price spreadsheet with
  `node tools/import-prices.mjs`.
* **No server, no database, no build step, no dependencies.** Plain files and
  plain JavaScript modules. Quote requests go wherever the company says (a form
  service, a webhook, e-mail, or its own web page).

For Alan, in plain words: [docs/FOR-ALAN.md](docs/FOR-ALAN.md).
Start with the [10x16 Side Lofted Barn](docs/examples/10x16-side-loft.md):
[open the latest wall model picture saved in GitHub](images/wall-framing.png).
Netlify hosting is currently unavailable because its account credit limit
blocks service and deployment; use the GitHub picture or local pages.
For local development,
run the designer and open `learn.html?company=learning-side-loft` to start
with the long floor supports and reveal pieces by hand. Labels and dimensions
point to the visible pieces. The lesson now draws Alan's 16 ft, actual
3½ × 5½ in skids, with 1 in-deep notches for actual 1½ × 5½ in crosswise
members. Standard 16 in spacing and extra 12 in cuts are confirmed; remaining
layout assumptions are labeled. “Notch close-up” shows the connection.
The two end views show open 3 in and 1½ in notches, both 1 in deep, without
raised lips. Skids are confirmed treated wood; light grain and knots help
show the lumber. Alan confirmed that the 45° bottom corner cuts reach 3 in
back from **each** skid tip. That gives a calculated 3 in rise and leaves
a 1½ in vertical end face below the notch seat.
Alan accepted the skid view and confirmed **floor joist** for the crosswise
2x6 seated in its notches. He then confirmed a 10 ft outside floor width,
1½ in **outer boards** each side, and joists 3 in shorter: a calculated
117 in / 9 ft 9 in. One end has two boards and the other one. Those floor
joists, outer boards and end boards are confirmed treated wood, with varied
grain and knots that stay stable when the view changes. The frame remains
available at `learn.html?company=learning-side-loft&step=frame`;
`?step=joists` isolates the regular joists.
The frame also includes the **Board the mule hooks onto**: a treated 2x4
lying flat behind the double end boards, on top of the skids. Alan confirmed
93 in length (7 ft 9 in); its sideways centering is still provisional.
The picture page includes a [close-up](images/floor-end-backing.png).
The **Flooring** view remains at `learn.html?company=learning-side-loft&step=deck`:
stated 4x8 ft tongue-and-groove sheets, 5/8 in thick, over the unchanged frame.
Rows run 8+8 ft, the confirmed 4+8+4 ft stagger, then 8+8 ft trimmed to a
calculated 2 ft width. The [picture page](flooring.html) shows the flooring
and its layout. Sheet material, treatment, net coverage and exact joint
profile remain unspecified. First joist position, notch clearance and
outer-board dimensions still need agreement; rim/end-joist names remain proposed.
The current view is **Walls** at `learn.html?company=learning-side-loft&step=walls`.
Choose one 16 ft **side wall** or one 10 ft **end wall** on the completed floor.
The studs and all three plates are 2x4, actual 1½ × 3½ in. Alan confirmed
75 in stud cut lengths, 16 in layout spacing and a double stud every 4 ft,
with the mark **between the two touching studs**. The bottom plate, top plate
and upper plate add a calculated 4½ in, giving 79½ in total wall height above
the flooring. The [wall picture page](walls.html) includes both wall views
and a [close-up of the plates and double stud](images/wall-framing-detail.png).
The side wall's bottom/top plates and end studs stop 3½ in short at each end;
its upper plate stays 16 ft. The end wall frame stays 10 ft, and its upper
plate stops 3½ in short at each end. Calculated cuts are **15 ft 5 in** for
the side wall bottom/top plates and **9 ft 5 in** for the end wall upper plate.
The [side wall end detail](images/wall-end-detail.png) and
[end wall upper-plate detail](images/end-wall-plate-detail.png) show the fit.
The starting layout datum, extra corner studs, fasteners, openings and wall
treatment remain unconfirmed. Nothing advances automatically.
The finished reference remains at `/?company=learning-side-loft`, with prices
and quote requests hidden. Agree on the
[building terms](docs/BUILDING-TERMS.md), then use
[shed-customer-setup](.agents/skills/shed-customer-setup/SKILL.md) for the next
company or shed buyer. The regular designer's Framing and Watch it build
stay switched off; the separate learning page follows Alan's latest request
to learn one piece at a time. Other companies keep their own choices.

Selling it to a company: [docs/SELLING.md](docs/SELLING.md).
The rules every file is built to: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
Where it deliberately behaves differently from Barnwright: [docs/DIFFERENCES.md](docs/DIFFERENCES.md).

## Reusable building skills

These skills live in this project alongside the model. They record what Alan
has confirmed and what still needs agreement, so future work can reuse the
same terms and construction details.

| Skill | What it covers |
| --- | --- |
| [Customer setup](.agents/skills/shed-customer-setup/SKILL.md) | Set up a company or buyer's design and continue the manual building lesson. |
| [Measurements for other sizes](.agents/skills/shed-measurements/SKILL.md) | Recalculate lengths from the building width, length, actual lumber and end setbacks, with worked examples. |
| [Skids](.claude/skills/part-skids/SKILL.md) | Treated supports, notches, end cuts and their measurements. |
| [Floor frame](.claude/skills/part-floor-frame/SKILL.md) | Floor joists, outer/end boards and the board the mule hooks onto. |
| [Flooring](.claude/skills/part-floor-deck/SKILL.md) | Tongue-and-groove sheets, thickness, staggered seams and appearance. |
| [Wall framing](.claude/skills/part-wall-frame/SKILL.md) | Side/end walls, studs, three plates and touching double studs. |

Use the [shared building terms](docs/BUILDING-TERMS.md) and
[10x16 worked example](docs/examples/10x16-side-loft.md) with these skills.
The [full collection of part skills](.claude/skills/) also covers the other model
parts; those existing model rules are separate from Alan's confirmed lesson facts.

## Run it

```
npm run serve
```

then open <http://127.0.0.1:8282/> (the demo company). Other pages on the same
address:

| address | what it is |
|---|---|
| `/?company=starter` | the designer for another company (here the made-up "Cedar Ridge Sheds") |
| `/parts.html?company=demo&style=LB` | the parts gallery: every part of one building, each drawn on its own with what it is in real life |
| `/setup.html?company=starter` | the contact sheet: every building and size a company offers, with its standard doors and windows and its price, to send for sign-off |
| `/embed-demo.html?company=starter` | a pretend company web page with the designer pasted into it (`embed.js`). Only on the hosted site: the frame opens `/c/<id>/`, an address Netlify makes (`netlify.toml`) and `npm run serve` does not, so locally the frame stays empty |
| `/?company=demo#d=...` | a shared design link opens that exact building (`&view=1` makes it look-only) |

Node 22 or newer. `npm run serve` uses `npx http-server`, which npm fetches the
first time.

## What is where

```
index.html          the designer page
parts.html          the parts gallery
setup.html          the contact sheet for a new company
embed.js            the one script a company pastes on its website
embed-demo.html     a sample company page with the designer in it
netlify.toml        how Netlify serves it (/c/<id>/ for each company)
_headers            which websites may show each company's designer
                    (written by tools/build-headers.mjs, never by hand)
engine/             drawing: materials, textures, shaders, camera, renderer,
                    and assemble.js, which puts a building together
model/              the rules, no drawing: company settings, sizes, roof shapes,
                    where doors and windows go, prices, saved designs,
                    construction numbers, the frozen "plan" the parts read
parts/              one file per real-life part of a shed; index.js is the
                    PIPELINE (the order they are drawn in), stages.js the
                    building steps; parts/openings/ holds the doors and windows
library/            construction.json: how the sheds are really built (joists,
                    studs, trusses...); manufacturers/standard.json: the styles,
                    doors, windows and colours of the standard line (no prices)
companies/          one folder per company: demo (every style, example prices),
                    starter (a small made-up company), _template (what
                    new-company copies)
ui/                 the screens: app.js (the page and its API, window.shedUI),
                    views.js (Outside / Framing / Watch it build), blueprint.js
                    (the floor plan), quote.js (quote requests), share.js
                    (share links), embed-mode.js, setup.js, parts-gallery.js,
                    esc.js (every outside word is escaped here)
fonts/              the two typefaces, served from this site (with their licence)
tools/              the checks and the setup tools (below)
test/golden/        Barnwright's own drawing of 148 buildings, recorded
test/out/           pictures the checks take (not kept in git)
docs/               ARCHITECTURE.md (the contract), DIFFERENCES.md,
                    SKILL-TEMPLATE.md, FOR-ALAN.md, SELLING.md
.claude/skills/     a skill for every part (part-<id>), and the workflow skills:
                    new-company, add-a-style, add-a-part, check-the-look,
                    change-construction
```

## The tools that are not checks

| command | what it does |
|---|---|
| `node tools/new-company.mjs --id acme --name "Acme Sheds" --phone "(555) 010-0100" --styles UT,LB --from-csv prices.csv` | writes `companies/acme/company.json` from the template, checks it, and lists what is still to do |
| `node tools/import-prices.mjs companies/acme prices.csv` | puts a company's prices in from a spreadsheet saved as CSV (`--dry-run` shows, `--export` writes them back out) |
| `node tools/list-companies.mjs` | every company: loads or not, active or SUSPENDED, licence renewal, styles, where quotes go, which websites show it |
| `node tools/build-headers.mjs` | writes `_headers` from the companies' settings (`--check` says whether it is up to date) |
| `node tools/capture-golden.mjs` | records Barnwright's drawing into `test/golden/` again (only on purpose; `--check` proves it is repeatable) |
| `node tools/extract-barnwright-catalogue.mjs` | records Barnwright's exact price and parts tables (for the checks only) |

The `acme` company and `prices.csv` above are examples: a real company gets
its own id and spreadsheet. The `new-company` skill walks through all of it.

## The checks

```
node tools/check-all.mjs          # every check, one table at the end
node tools/check-all.mjs --fast   # only the ones that need no browser
```

Each check runs on its own as `node tools/<name>.mjs`, prints in plain words
what it proved, and exits non-zero when anything is wrong. The browser checks
use the Playwright installed at `/opt/node22/lib/node_modules/playwright` with
Chromium's software graphics, each on its own port.

| check | browser? | what it proves |
|---|---|---|
| `check-golden.mjs` | no | every triangle of the 148 recorded Barnwright buildings, part by part, then whole; drawing the framing too changes no finished triangle |
| `check-look.mjs` | yes | the 24 finished pictures recorded from Barnwright, pixel for pixel; true colour changes the colour and nothing else; a rebuild stays inside its time budget |
| `check-golden-labels.mjs` | yes | the part label on every recorded triangle, proved a second, independent way |
| `check-engine.mjs` | yes | the drawing kit, the maths, the camera fit, the 11 textures and five whole pictures match Barnwright's own page, byte for byte |
| `check-engine-smoke.mjs` | yes | the engine really draws in a browser, and the building-step table hides and lifts steps (shadows included) |
| `check-shaders.mjs` | yes | the shaders and texture painters are Barnwright's, character for character (the true-colour shader differs only in its six documented lines) |
| `check-imports.mjs` | no | every file meant to run without a browser really does; no JSON imports; no stray `Math.random` |
| `check-parts.mjs` | no | every part is a valid part, its caption fills in, it has its skill, and every skill has its part |
| `check-construction.mjs` | no | the construction settings are read, merged and settled per building the way the contract says |
| `check-framing.mjs` | no | the floor, wall, foundation, porch-deck and inside framing is built like a real shed on 1,000+ buildings (and changes nothing in the finished view) |
| `check-framing-roof.mjs` | no | the trusses, gable studs, roof deck, loft and dormer framing fit inside the roof as drawn and follow the construction numbers |
| `check-companies.mjs` | yes | a company is one checked settings file, never given a price it did not set; about 35 mistakes give the right plain-English error |
| `check-design.mjs` | no | a design saved, shared and opened again is the same building at the same price; nothing missing is dropped silently |
| `check-floor-lesson.mjs` | no | the lesson starts with supports; all eight selections preserve original floor geometry, and measurements match drawn pieces |
| `check-floor-joist-lesson.mjs` | no | the joist lesson retains only regular crosswise joists, preserving their geometry, materials and stages while keeping the full frame unchanged |
| `check-floor-deck-lesson.mjs` | no | the seven flooring pieces cover the 10x16 frame at 5/8 in thick, with staggered seams and a trimmed last row, without changing the frame, skids or ordinary designer |
| `check-wall-lesson.mjs` | no | separate side and end walls use 75 in studs, three flat plates and touching pairs at 4 ft marks; exact mesh contacts, volume, floor and ordinary designer are preserved |
| `check-model-live.mjs` | yes | the rules (sizes, walls, roof line, standard doors and windows, clamping, prices) are Barnwright's, number for number, against its live page |
| `check-ui.mjs` | yes | the designer page works: every style, size, colour, door and window, drag, "Add here", layouts on phone and desktop, escaping |
| `check-views.mjs` | yes | Outside, Inside, Framing and Watch it build on seven buildings, from real clicks and real pixels |
| `check-blueprint.mjs` | yes | the floor plan: every wall, door, window and fixture symbol, touch and pinch, side by side with Barnwright's |
| `check-gallery.mjs` | yes | the parts gallery and the contact sheet draw what they promise |
| `check-leads.mjs` | yes | a quote request reaches the company every way a company can ask for it, and nobody it should not |
| `check-share.mjs` | yes | "Share my design" opens the same building; look-only links, changed prices and damaged links are handled honestly |
| `check-embed.mjs` | yes | the designer sits safely inside a company's website: lazy loading, events, full screen, phones, who may show it |
| `check-starter.mjs` | yes | a new company can be set up in one command from a spreadsheet, and shows up in the designer, the list and the headers |
| `check-docs.mjs` | no | every file, tool, command and skill named in this README, docs/FOR-ALAN.md, docs/SELLING.md and the workflow skills exists; every part has its skill; no broken links |

## The rules that matter most

1. **Never change Barnwright.** Its files are only ever read, by the golden
   capture and the live comparisons.
2. **The finished building must look exactly like Barnwright's.** A red
   `check-golden.mjs` is a look change: fix the code (see the `check-the-look`
   skill).
3. **One real-life part = one file in `parts/` + one skill.** Read the part's
   skill before changing it; update the skill after (the `add-a-part` skill
   for a new one).
4. **A new company is a settings file, never code** (the `new-company` skill).
5. **Every word from a company file, a link or a customer goes through
   `ui/esc.js`** before it reaches the page.
