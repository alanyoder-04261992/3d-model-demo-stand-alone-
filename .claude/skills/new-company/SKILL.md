---
name: new-company
description: Set up a new shed company (a new customer of the designer) from its prices, colours, logo and where its leads go -- use when Alan asks to add, onboard or set up a company or dealer, or to change a company's settings file.
---

## A business on the Dealer Center

A business that wants its own price list, lots, team and customer list gets
its own copy of the site with the Dealer Center (`/dealer`). Follow "Setting up
a new company" in `docs/OFFICE.md`: a new Netlify site, Identity on, the
owner's email as `OWNER_EMAIL`. The owner then sets everything up on screen:
the price list (sizes, styles, prices, options, colors), the lots (each gets
`/d/<lot>/` and its own `data-lot` website code) and the team. No settings
file is written by hand for these businesses; the price list is the same
validated settings object a `companies/<id>/company.json` file holds. Dealers
never change prices or options. Charging businesses for Barnwright comes later.

Run `npm run build:client` for a client delivery. Do not include learning pages,
reference photos, setup tools, `.agents`, `.claude` or these skills. The existing
learning preview's opt-in setting must not be copied to client deployments.

# Set up a new company

A company is **one settings file**, `companies/<id>/company.json`, on top of
the shared manufacturer file (`library/manufacturers/standard.json`) and the
construction defaults (`library/construction.json`). Never write code for a
company, never edit the manufacturer file for one company, and never guess a
price. The business side (what they get, what they send) is
`docs/SELLING.md`; this is the procedure.

For the shared vocabulary and the first building exercise, read
[Building terms](../../../docs/BUILDING-TERMS.md) and
[the 10x16 Side Lofted Barn](../../../docs/examples/10x16-side-loft.md).
The [shed-customer-setup skill](../../../.agents/skills/shed-customer-setup/SKILL.md)
distinguishes a new company from a buyer's design within an existing company.
Reuse facts already supplied; ask only for information still needed for the
current setup.

The construction lessons, framing studies and their skills are internal
tools for faster setup. Do not ship lesson pages, study controls or the
learning company as customer designer features. Transfer only the rules
confirmed for the new company's construction; the learning example's
measurements and unfinished fits are not defaults for every customer.

## 1. Get what you need (ask the company, through Alan)

Gather what is still missing below in one message when it is needed for the
current setup; do not ask the company to repeat information already supplied.

1. **Prices as a spreadsheet** (CSV). Best: set the company up first with its
   styles, export its price sheet (step 3) and send that for them to fill in.
2. **Which styles they sell** (see the style keys in
   `library/manufacturers/standard.json`: UT, SU, DS, BU, GU, SB, LB, SLB, CS,
   SS, C, LBC, SC, LSC, DSC, SLC, G, LBG, MU, MLB, MG, MCS, DK) and the building
   a new visitor should start on.
3. **Name**, short name for the price plate, **phone**, **e-mail**,
   **website**, tagline.
4. **Colours**: header and accent (`#rrggbb`), and which siding, trim and
   roof colours they offer. With none given, the standard black and gold
   (header `#16130E`, accent `#C9A227`). The header needs a dark colour; a
   light button colour is fine, its words turn dark (docs/DIFFERENCES.md 23).
5. **Logo**: an `https://` address of a picture, or none (the badge shows the
   initials).
6. **Where quote requests go** and which boxes to ask (see step 4).
7. **Their websites** that will show the designer (with and without `www.`),
   and optionally the page it sits on (`embed.shareUrl`).
8. **Fine print**, width notes, price display (`price`, `from` or `none`),
   rent-to-own term or none.
9. **How they build, if not standard** (studs, joists, trusses, anchors, loft
   depth) -- that part is the `change-construction` skill.

Also ask Alan: the licence renewal date, and whether this company is
white-label (no "3D designer by Barnwright" line).

## 2. Write the file with one command

```
node tools/new-company.mjs --id acme --name "Acme Sheds" \
     --phone "(555) 010-0100" --email sales@acme.example --website https://acme.example \
     --header "#2F4A3B" --accent "#C98B3E" --styles UT,LB,G --from-csv prices.csv \
     --origins https://acme.example,https://www.acme.example \
     --leads form --leads-url https://formspree.io/f/their-form-id --renews 2027-09-01
```

(`acme` and `prices.csv` stand for the real company's id and spreadsheet.)

* `--id`: 2 to 40 lower-case letters, digits or dashes. It is the folder and
  the address (`/c/acme/`). It never changes once a company is live (saved
  links carry it).
* `--styles` by code or name; may be left out when `--from-csv` lists styles.
* Without `--from-csv` every style gets its standard sizes at a **$1
  placeholder** price -- on purpose, so nothing looks believable by accident.
* `--leads`: `none` (default: a showroom), `form`, `mailto`, `webhook`,
  `postMessage`; `--leads-url` for `form` and `webhook`.
* `--short`, `--initials`, `--tagline` are optional; `--force` replaces an
  existing company (only when Alan asks).

It checks the file exactly as the designer will and writes nothing if it would
not load. Then it prints **STILL TO DO**: a numbered list. Work through every
item.

## 3. Prices

```
node tools/import-prices.mjs companies/acme prices.csv --dry-run   # show what would change
node tools/import-prices.mjs companies/acme prices.csv             # write it
node tools/import-prices.mjs companies/acme --export acme-prices.csv   # their sheet, to send them
```

* Rows: `style,size,price` (name or code; "10 x 16"; "$5,190" all fine --
  in quotes: a spreadsheet program adds them, but in a hand-typed file
  `UT,10x16,$5,190` is read as **$5** with "190" ignored as a note),
  `item,price` and `option,price` (`ramps.r4`, `dormers.6`, `elec.1`,
  `misc.shutter`, `rates.dbl` per sq ft). **Use item CODES** (`w48`, `w23`):
  item names only match when spelled exactly as the manufacturer file spells
  them ("48″ Wooden Door", "2×3 Window"), so "48 in Door" or "2x3 Window" is
  refused. The export writes codes with the name after the price, and anything
  after the price is ignored -- so the exported sheet reads back unchanged.
* A style in the sheet has its sizes REPLACED, in the sheet's order (the order
  of the size buttons). A bad row changes nothing and names the line.
* Every import that changes a price raises `cfg` by one, so old shared links
  say their price may have changed (an import that changes nothing writes
  nothing).
* Every door or window a style comes with as standard needs a price (0 is
  fine). A company inherits NO price from anywhere: a missing one is a
  validation error, never a silent default.
* Never copy prices from `test/golden/barnwright-catalogue.json` (Barnwright's
  real price book, for checks only) or from the demo (made-up examples).

## 4. The rest of the settings file (edit `companies/<id>/company.json`)

Every block has a `_help` note beside it (from `companies/_template/company.json`).
The ones that usually need a hand edit:

* `palettes` -- `paint` (siding, doors, shutters), `trim`, `metal` (every
  roof, and the siding of metal styles): colour names from the manufacturer
  file, or `["Their Name", "#rrggbb"]` for their own. Leave a list out to offer
  all of the manufacturer's.
* `categories` -- how the style buttons are grouped; every offered style must
  be in one.
* `defaults` -- the starting style, size (must be a size they sell) and
  colours by name.
* `leads` -- `mode` and `url` (above); `email` for `mailto` (else
  `brand.email`); `fields`: `name phone email zip address note`, each
  `required`, `optional` or `off`; `smsConsent`: their exact words for an
  un-ticked "you may text me" box, or `null`; `images`: pictures with a
  `webhook` only; `target: "tab"` for a form service that shows its own
  "are you human?" page (the request then opens in a new tab). A `webhook`
  must answer with `Access-Control-Allow-Origin` for the page to know it
  arrived (Zapier, Make, n8n and Pipedream do); `postMessage` needs their
  site in `embed.origins`.
* `embed.origins` -- `https://` addresses only, never `*`; `embed.shareUrl`.
* `pricing.show` (`price`, `from`, `none`), `pricing.rto.showTerm` (a term like
  60, or `null`), `notes.finePrint`, `notes.sizeNotes` (by width in feet).
* `look.trueColour` -- the template says `true` (grey daylight). Which one a
  new company gets is an open decision of Alan's (docs/FOR-ALAN.md): ask.
* `features` -- `framingView`, `buildPlayback`, `floorPlan`.
* `brand.credit.show` -- `false` only for a white-label licence.
* `license` -- `plan` (`hosted`), `renews`.
* `construction` -- only through the `change-construction` skill.

## 5. Validate

```
node tools/list-companies.mjs         # exit 1, with the reason, when any company file does not load
node tools/check-companies.mjs        # every folder in companies/ passes validation (a browser check)
```

Also `npm run serve` and open `http://127.0.0.1:8282/?company=acme`: the
header shows their name and badge, their colours, only their styles, their
prices. A file with a mistake shows its problems in plain words instead of a
designer -- read them and fix the file.

## 6. The contact sheet, for sign-off

Open `setup.html?company=acme` (same server). One tile per style and size, in
their category order, with the standard doors and windows and the price the
designer shows, and lines at the bottom to sign. "Draw every picture" draws
any tile not yet drawn. Take a full-page picture for Alan. In the original
Linux environment, `loadPlaywright()` in `tools/lib/barnwright-page.mjs` loads
Playwright; launch Chromium with
`--use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`.
On another system, use the available browser tooling and report any automated
checks that could not run. Wait for `window.contactSheet.ready`, call
`window.contactSheet.drawAll()`, then screenshot with `fullPage: true` into
`test/out/`. **Look at every tile
yourself before sending it**: no `$1.00`, the right doors and windows, the
width notes. Alan sends it to the company; they sign it or mark changes.

The contact sheet shows BUILDING prices only. A door, window, fixture or
upgrade still at the $1 placeholder never appears on it: run
`node tools/import-prices.mjs companies/acme --export` and look down the price
column for a 1 (the STILL TO DO list from step 2 names them too, but only at
the moment the file was made).

## 7. Allow their website, and publish

```
node tools/build-headers.mjs            # rewrite _headers from every company's embed.origins
node tools/build-headers.mjs --check    # says whether _headers is up to date
```

Re-run it after any change to `embed.origins` or the leads address (the leads
address is allowed in the page's safety policy too). Then the changes are
published to the site Alan hosts, and Alan sends the company the two lines:

```html
<div id="shed-designer"></div>
<script src="https://<where the designer lives>/embed.js" data-company="acme" data-height="640"></script>
```

(`data-height` at least 520; `data-target` another CSS selector;
`data-fullscreen="off"`.) Their designer is at `/c/acme/`, and
`embed-demo.html?company=acme` shows it inside a sample company page -- on the
hosted site only: the frame opens `/c/acme/`, which Netlify makes
(`netlify.toml`) and `npm run serve` does not, so locally the frame stays
empty. `node tools/check-embed.mjs` proves the embedding without a host.

## 8. Before you say it is done

* `node tools/list-companies.mjs` -- loads, active, renewal date, styles,
  where quotes go, which websites show it.
* `node tools/check-all.mjs --fast`, and when a browser is available
  `node tools/check-companies.mjs` and `node tools/check-embed.mjs` (fails
  while `_headers` is out of date).
* Tell Alan, in plain words: what is set up, anything still at a placeholder,
  what the company still has to send, and the contact sheet picture.
* Leave no test company behind in `companies/` (the checks use their own and
  delete them).

## Changing a live company later

* Prices: a new spreadsheet through `tools/import-prices.mjs` (raises `cfg`).
* A renamed or dropped item, size or colour: add it to `renames` (old -> new)
  so shared links keep opening; anything that no longer exists is warned
  about on screen, never silently dropped.
* Switch off: `"status": "suspended"` (the designer shows "not available" and
  their phone); back on: `"active"`.

## Checks that guard this

* `node tools/check-companies.mjs` -- every company file loads, no price is
  inherited, about 35 mistakes give the right plain-English error.
* `node tools/check-starter.mjs` -- the whole procedure above, acted out with a
  made-up company from a messy spreadsheet (and cleaned up afterwards).
* `node tools/check-embed.mjs` -- `_headers` is current and only a company's
  own websites can show its designer.
* `node tools/check-gallery.mjs` -- the contact sheet shows every offered style
  and size at the designer's own price.
