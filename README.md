# The 3D shed designer, on its own

<!-- WHAT THIS FILE IS: the front page of this repo. What the product is, how
     to run it, where everything lives, and every check with what it proves.
     tools/check-docs.mjs proves every file, tool, command and skill named
     here really exists. Plain-English guide for Alan: docs/FOR-ALAN.md. -->

A 3D shed designer that a shed company puts on its own website. The customer
picks a building, a size and colours, moves the doors and windows, looks at the
dimensioned floor plan, shares the design, and sends a quote request. It is the 3D designer from **Barnwright**
(Alan Yoder's shed software), taken out on its own so it can be sold to a
company that only wants the designer.

* **Its buildings are Barnwright's, lit the way the Yoder Storage Barns
  site lights them.** Every triangle of 148 recorded Barnwright buildings is
  compared by `node tools/check-golden.mjs`, and every pixel of 24 finished
  pictures (in Barnwright's warm light) by `node tools/check-look.mjs`. The
  light every company gets unless it says otherwise is the Yoder site's
  **true colour** (`look.trueColour`: white daylight, a neutral room, its
  darker contact shadow), proved against the Yoder site's own file by
  `node tools/check-shaders.mjs` (Alan, Oct 2026: "use the 3d configuration
  in yoder storage barns … change the building looks only").
* **Every real-life part of a shed is its own file** in `parts/` (skids,
  floor, siding, roofing, each kind of door and window, and the framing: floor
  joists, studs, trusses, the loft, the roof deck, blocks and anchors) and has
  its own skill in `.claude/skills/part-<id>/SKILL.md`.
* **A new company is one settings file**, `companies/<id>/company.json`, made
  with `node tools/new-company.mjs` and filled from a price spreadsheet with
  `node tools/import-prices.mjs`.
* **The Dealer Center** (`/dealer`) for each shed business: the owner sets
  the price list (sizes, styles, prices, options, colors) once and every lot
  uses it; each lot gets its own 3D designer link; dealers work their lots'
  customers (stages, follow-ups, notes, quotes) and orders; a **Help**
  button on every screen has short answers and asks Barnwright. Netlify
  Functions, Identity and Blobs. Try it with sample data: `npm run office`.
  See [the Dealer Center guide](docs/OFFICE.md).
* **Client build.** `npm run build:client` packages the customer designer
  and the Dealer Center without internal lessons, photos, skills or setup tools.

For Alan, in plain words: [docs/FOR-ALAN.md](docs/FOR-ALAN.md).
The construction lessons, part skills and setup previews below are internal
onboarding tools for Alan. They inform how buildings are modeled and new
companies are set up; they are not customer features or part of the client
website. The customer designer offers only Outside and Inside.

Latest internal lesson: [utility framing](utility-framing.html), with 89-inch wall
studs, a flat top window plate 12.5 inches below the wall top plate,
and studs filling space above openings.
The [utility skill](.agents/skills/utility-framing/SKILL.md) records those
rules, standard 5/12 / steep 7/12 A-frame pitch, roof stock by sales width,
4-inch side overhang and 2-inch truss end height.
The roof section includes a measured 3D render over the utility end wall
and a close-up of the tail/upper-plate fit for Alan to check.
The preceding lesson: [doorway framing](doorway-framing.html), with three
adjustable header arrangements, labeled phone pictures and
[a reusable skill](.claude/skills/part-doorway-frame/SKILL.md).
Alan's king stud is the shorter support on the bottom plate; header cuts
are opening width plus 1.5 in at each end. The selected cut and available
wall height determine which illustrated arrangement fits.
The preceding lesson: [lofted-wall window header](window-framing.html), with
[phone end view](images/window-header-section.png), adjustable 3D cut length
and [reusable header skill](.claude/skills/part-window-header/SKILL.md).
The outside half-inch ledge, top-plate contact, flat window plate and studs
beneath it are recorded. The 3D view now starts with the window plate and
supporting studs; adjustable clear height recalculates the cuts. See their
[phone picture](images/window-plate-studs.png) and
[skill](.claude/skills/part-window-plate/SKILL.md).
Start with the [10x16 Side Lofted Barn](docs/examples/10x16-side-loft.md):
[open the truss and gable-stud preview saved in GitHub](images/truss-framing.png).
For a phone, open the [hosted truss picture page](https://yoder-3d-floor-preview.netlify.app/truss.html)
or [rotate the preview](https://yoder-3d-floor-preview.netlify.app/learn.html?step=truss).
This preview is serving successfully after the earlier Netlify credit-limit interruption.
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
The **Walls** view remains at `learn.html?company=learning-side-loft&step=walls`.
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
The earlier **gable board** step remains at
`learn.html?company=learning-side-loft&step=gable`. A 2x6 stands on edge
on the end wall's upper plate. Alan's later correction keeps its new
position across the plate and uses his corrected labels: 1/2 in inside
ledge and a calculated 1 1/2 in outside ledge, while
projecting 2 1/2 in past each cut end. The calculated board length is
`113 + 2.5 + 2.5 = 118 in` (9 ft 10 in). Its actual section is 1 1/2 in
thick and 5 1/2 in high. The [gable picture page](gable.html) includes a
[measured connection close-up](images/gable-board-detail.png).
Alan's confirmed name for this piece is **gable board**. It is nailed to
the upper plate; the truss goes against its shown front face. Treatment and nail size/count/spacing
remain unconfirmed. He confirmed **2x4 truss lumber** and supplied
54 in for the upper piece leading to the peak and 37 3/4 in for the lower,
steeper piece, measured at the longest points. The peak is 4 ft (48 in)
above the upper-plate top, and the lowest truss tips are level with that
same top (Alan’s September 29 correction). His later blue line confirms
that the entire bottom cut is level with the gable-board bottom. His annotated photograph resolves the separate
**6 1/4 in** dimension: along the end wall from the **upper plate's cut end
to the outermost truss tip**. The current `?step=truss` view adds four
sloping pieces and the gable studs for review; the
[truss picture page](truss.html) includes an
[end connection detail](images/truss-connection.png).
The preview mirrors that projection at both ends, giving a calculated
125 1/2 in tip-to-tip span. That mirroring, the modeled cuts and stud-top connection,
and the gable studs' first-center offset and top fit still need Alan's agreement.
The studs' confirmed rules are that they sit on the gable board, are
“turned outward” and are **24 in on center**. The studs are confirmed 2x4s
with the 3 1/2 in face outward. Their 24 in layout starts at the outside
edge of the end wall. The current preview reads “centered” as putting the
first center at 24 in, then 48, 72 and 96 in on this 10 ft end wall. This
interpretation remains provisional. The [stud layout picture](images/gable-stud-layout.png)
shows the tape origin and center marks. For another width or starting end,
the skills record `centerX = wallEndX + direction * (firstCenterIn + n * spacingIn)`.
Its slope
angles are calculated to fit the measurements and actual lumber; they are
not confirmed shop saw settings. These distinctions are saved in the skills.
The finished reference remains at `/?company=learning-side-loft`, with prices
and quote requests hidden. Agree on the
[building terms](docs/BUILDING-TERMS.md), then use
[shed-customer-setup](.agents/skills/shed-customer-setup/SKILL.md) for the next
company or shed buyer. All customer designers offer Outside and Inside only.
The separate internal learning page follows Alan's request to learn one
piece at a time.

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
| [Gable backing](.claude/skills/part-gable-backing/SKILL.md) | Horizontal 2x4 siding-seam support across all bays to the outer truss, bottom 11 in above upper-plate top, only without a window or fake window. |
| [Gable window box](.claude/skills/part-gable-window-frame/SKILL.md) | Adjustable opening moves its side studs and resizes top/bottom 2x4s, all wide faces outward. |
| [Gable framing](.claude/skills/part-gable-frame/SKILL.md) | The gable board, its ledge side and end projections, plus the learned gable-stud rules. |
| [Roof framing](.claude/skills/part-roof-frame/SKILL.md) | The measured 2x4 truss preview, its upper-plate datum, derived profile and remaining fit assumptions, separate from ordinary model rules. |
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
                    views.js (Outside / Inside), blueprint.js
                    (the floor plan), quote.js (quote requests), share.js
                    (share links), embed-mode.js, setup.js, parts-gallery.js,
                    esc.js (every outside word is escaped here), problems.js
                    (an error nothing caught goes to the site's own server);
                    ui/office/ is the Dealer Center
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
| `check-window-header.mjs` | no | learned loft header section, outside ledge, top-plate contact, variable cut lengths and unchanged surface geometry |
| `check-window-plate.mjs` | no | flat plate, support contact at both ends, retained wall layout, variable window-height cuts and vertical grain |
| `check-doorway.mjs` | no | shop king-stud terms, header bearing, variable opening cuts, three arrangements, wall-height reuse and fit rejection |
| `check-utility-framing.mjs` | no | 89-inch utility studs, confirmed 12.5-inch window-plate gap and derived elevations, real opening contacts, roof stock by sales width and horizontal-run pitch |
| `check-look.mjs` | yes | the 24 finished pictures recorded from Barnwright, pixel for pixel; true colour (the Yoder site's look, the standard) changes the colour and nothing else; a rebuild stays inside its time budget |
| `check-golden-labels.mjs` | yes | the part label on every recorded triangle, proved a second, independent way |
| `check-engine.mjs` | yes | the drawing kit, the maths, the camera fit, the 11 textures and five whole pictures match Barnwright's own page, byte for byte |
| `check-engine-smoke.mjs` | yes | the engine really draws in a browser, and the building-step table hides and lifts steps (shadows included) |
| `check-shaders.mjs` | yes | the shaders and texture painters are Barnwright's, character for character; the true-colour shader, rooms and contact shadow are the Yoder site's (the shader differs from Barnwright's only in its six documented lines) |
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
| `check-gable-lesson.mjs` | no | the 2x6 rests on the end upper plate with a 1/2 in inside ledge, 1 1/2 in outside ledge and 2 1/2 in projections; actual mesh, contact and resizing formulas agree, and existing floor/wall/ordinary geometry stays unchanged |
| `check-truss-lesson.mjs` | no | truss dimensions, plate datum, gable-stud layout and contact agree with the measured fit preview |
| `check-gable-backing.mjs` | no | backing uses the upper-plate top, fits all stud bays and reaches both outer trusses, recalculates at other sizes and is omitted for real or fake gable windows |
| `check-gable-window.mjs` | no | different opening sizes/positions, clear cavity, box contacts, exact mesh volume, fit rejection and restoration of no-window framing |
| `check-model-live.mjs` | yes | the rules (sizes, walls, roof line, standard doors and windows, clamping, prices) are Barnwright's, number for number, against its live page |
| `check-ui.mjs` | yes | the designer page works: every style, size, colour, door and window, drag, "Add here", layouts on phone and desktop, escaping |
| `check-views.mjs` | yes | Outside and Inside on seven buildings, dimension labels, unchanged finished geometry, no construction controls or runtime, and phone layout |
| `check-customer-views.mjs` | no | Outside/Inside behavior, accessible selection, old flags unable to expose construction views, and no geometry access or rebuilds while switching |
| `check-office.mjs` | no | the Dealer Center's server: first owner, invites, who sees which lot, the price list reaching every lot at once, server pricing, quote requests sent twice or at once, customers, orders, and safe answers |
| `check-style-variants.mjs` | no | a business's own style built like a library style draws, comes with and prices exactly like it; named options; every mistake in plain words |
| `check-dealer-center.mjs` | yes | the Dealer Center in Chromium: every screen for the owner, a manager and a dealer on a desktop and a phone, a price change reaching every lot's designer, a website quote landing on its lot, designing for a customer, the "try it" demo, and Help (asking Barnwright and seeing the answer, problem reports from a screen and a designer) |
| `check-control-room.mjs` | no | a business's Dealer Center and Barnwright's control room: leases signed by the control room read the same way; changes stop and 3D designer links close when the account is off or out of touch for 7 days; open lots never pass the plan's number; help from Barnwright only while the owner allows it; the help pass is asked for in the control room's shape and only a well-formed one is taken |
| `check-help.mjs` | no | Help, against a pretend control room and Sales Inbox: a question goes from the person signed in with only the promised facts (no customers, prices, orders or keys), also while changes are stopped; each person sees the right questions; plain words when Barnwright can't be reached; problem reports once per kind a day and at most 10; the browser's reporter; the short answers name only real buttons |
| `check-dealer-demo.mjs` | no | the "try it" demo runs the real Dealer Center on made-up data with nothing sent anywhere, and only Alan's learning preview and his demo site (no lesson pages there) offer it (a client build has no demo file and no empty-boxes sign-in) |
| `check-wording.mjs` | no | every sentence on the Dealer Center's screens, its server answers and emails uses the plain words in docs/OFFICE.md, none of the old ones |
| `check-managed-client.mjs` | no | lot links and website code, shared-design lot preservation, safe retries, error handling and customer build exclusions |
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
2. **The finished building is Barnwright's shape for shape, lit the way the
   Yoder site lights it.** A red `check-golden.mjs` is a look change: fix the
   code (see the `check-the-look` skill). True colour is the standard light;
   Barnwright's warm light is kept for the golden and look checks.
3. **One real-life part = one file in `parts/` + one skill.** Read the part's
   skill before changing it; update the skill after (the `add-a-part` skill
   for a new one).
4. **A new company is a settings file, never code** (the `new-company` skill).
5. **Every word from a company file, a link or a customer goes through
   `ui/esc.js`** before it reaches the page.
