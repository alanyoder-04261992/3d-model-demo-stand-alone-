# Selling the 3D designer to a shed company

<!-- WHAT THIS FILE IS: how the designer is sold and run for a company -- the
     hosting and licence model in docs/ARCHITECTURE.md ("Embedding and phones",
     "Setting up a company"), what a company gets, what it has to send, and a
     setup checklist. tools/check-docs.mjs proves every file and tool named
     here exists. The plain guide to the designer itself: docs/FOR-ALAN.md. -->

## How it is sold: Alan hosts it, the company pastes two lines

**What Barnwright sells: one product**, the Barnwright 3D designer (the 3D
designer and its Dealer Center). It stands on its own and works alongside the
software the company already uses. A one-time build fee and a monthly fee
from go-live; the first lot comes with it, and each lot after the first is
**$250 one time** with no change to the monthly fee. Each business is at
`<their name>.barnwrightsoftware.com`.

**Signing up a company that said yes**, step by step (the Sign-Up Form,
terms and Setup Questions, the control room, their Dealer Center site, their
owner's setup with "I agree to the Barnwright terms", go-live, adding a lot
later): `docs/legal/Barnwright-Adding-a-New-Customer.pdf`. The papers
themselves: `docs/legal/Barnwright-Sign-Up-Form.pdf`,
`docs/legal/Barnwright-Setup-Questions.pdf` and `legal/barnwright-terms.pdf`
([OFFICE.md, "Setting up a new company"](OFFICE.md)).

A business gets its own copy of the site with the **Dealer Center**
([how it works and how to set one up](OFFICE.md)). The owner sets the price
list and adds the lots and the team there. Each lot has its own 3D designer
link, `/d/<lot>/`, and two lines of website code with its own `data-lot`;
every quote sent from it lands on that lot's customer list. The websites
allowed to show a lot's designer take effect as soon as they are saved.
The older `/c/<company id>/` setup below still works for companies that only
want the designer.

`npm run build:client` creates client output without lessons, reference photos,
skills or setup tools. `tools/site-profiles.mjs` recognizes the existing Yoder
learning-preview site's Netlify ID and preserves its public lesson pages.
Other sites remain customer-only. `INCLUDE_LEARNING_PREVIEW=true` explicitly
enables lessons for a local preview; `false` disables them on any site.
Never enable lessons for clients. The explicit client build always excludes them.
Alan's demo site for shed companies says `DEALER_DEMO=true`: it adds the
Dealer Center's "try it" demo and no lessons ([OFFICE.md](OFFICE.md), "Try
it without signing in").

* **Alan hosts one copy of the designer** (the files are ready for Netlify:
  `netlify.toml`). Every company runs on that one copy, at its own address:
  `/c/<company id>/`. A company never receives the files, so every fix and
  every improvement reaches every company at once. (The code files are
  re-checked on every visit and `embed.js` is kept for only five minutes, so
  an update shows up quickly.)
* **The company pastes two lines on its own website** (below). That puts
  its designer in a frame on its page, loaded only when a visitor scrolls near
  it.
* **Only the websites Alan allows can show it.** Each company's settings list
  its own websites (`embed.origins`). `node tools/build-headers.mjs` turns
  that list into `_headers`, which tells every browser to refuse to show that
  company's designer inside any other website — another dealer copying the
  two lines gets an empty box. Re-run it after adding a company or changing
  its websites (`tools/check-embed.mjs` fails while `_headers` is out of date).
* **Alan can switch a company off.** Setting its `status` to `"suspended"`
  replaces the designer, on their site and at their address, with "This
  designer is not available" and the company's phone number. `"active"` turns
  it back on. Nothing is deleted.
* **The licence is recorded in the company's settings** (`license.plan`:
  `hosted` or `self`, and `license.renews`: the renewal date).
  `node tools/list-companies.mjs` shows every company's renewal date, the days
  left, or OVERDUE. Nothing switches off by itself on the date: suspending is
  Alan's call.
* **The credit line.** Every designer carries a small "3D designer by
  Barnwright" line (`brand.credit`, with a link if Alan wants one). A
  **white-label** customer gets `"show": false` and no credit at all.
* **Self-hosting** is recorded as a licence plan (`"self"`) but there is no
  packaged way for a company to run its own copy yet. Treat it as "ask Alan".
* **What to charge** — for the licence, for white-label, for setup, for a
  renewal — is Alan's decision and is not written anywhere in this repo.

## What the company gets

* The 3D designer with **its own name, colours, logo, phone and e-mail**, and
  only **its own styles, sizes and prices**.
* Its customers can pick a building, size and colours; add, move, swap and
  remove doors, windows, roll-ups, lights and porch posts; add shutters,
  double windows, a window in a door; pick a dormer, porch, electrical
  package, ramp, benches, shelves and upgrades; and see the total change as
  they go.
* **Outside**, the finished 3D building, and **Inside**, the dimensioned floor
  plan. The company can switch the floor plan off.
* **Share my design**: a link that opens that exact building, for the
  customer's spouse or for the salesperson. Links can open on the company's
  own page (`embed.shareUrl`).
* **Quote requests delivered where the company already works**: a form
  service (Formspree, Basin, Web3Forms, Netlify Forms), a webhook (Zapier,
  Make, their own system — with pictures if they want), the customer's own
  e-mail, or handed to their web page. Or none: a showroom. If a request
  cannot go through, the customer is shown the company's phone number and a
  link to their design, so no lead is lost.
* A **full-screen** button, a phone-friendly layout, and a "Tap to design"
  cover so the designer never traps a visitor scrolling their page on a phone.
* Company-specific model settings prepared during onboarding. Construction
  lessons and reusable skills are Alan's internal setup aids; they are not
  included in the customer designer.
* A **contact sheet** before going live: every building and size it offers,
  drawn with its standard doors and windows and priced, to check and sign off.

## What the company needs to send

1. **Prices, as a spreadsheet** (any spreadsheet program, saved as CSV). One
   row per price: a building, a door/window/fixture, or an upgrade. Buildings
   can be written the way people write them (the style's name or code, "10 x
   16" or "10x16", with or without "$" and commas). Doors, windows and upgrades
   are safest by their code, with the name after the price as a reminder
   (anything after the price is ignored):

   ```
   style,size,price
   Utility Shed,10 x 16,"$5,190"
   Lofted Barn,12x24,9590
   item,price,name
   w48,160,48″ Wooden Door
   w23,210,2×3 Window
   option,price,name
   ramps.r4,260,4′ ramp
   elec.1,720,Option 1
   rates.dbl,2.10,Double floor
   ```

   That is the layout `node tools/import-prices.mjs companies/<id>
   --export` writes, so the easiest way is to set the company up, export
   their price sheet, and send it to them to fill in. A style's sizes appear
   in the order the spreadsheet lists them. Every door, window and option
   they sell needs a price (0 is fine for something included). A spreadsheet
   program puts quotes round "$5,190" by itself; in a file typed by hand, a
   price with a comma must be in quotes (or written 5190), or it is read as
   $5.
2. **Which styles they sell**, and the building a new visitor should start on.
3. **Their colours**: the header colour and the accent colour of their
   website (as `#rrggbb` if they know it), and which siding, trim and roof
   colours they offer — names from the standard colour cards, or their own
   names with a colour.
4. **Their logo**, as a web address of a picture (https), or none (the badge
   then shows their initials).
5. **Name, short name for the price plate, phone, e-mail, website**, and a
   tagline if they want one.
6. **Where quote requests should go**: the form service's address, the
   webhook's address, the e-mail address, or "our own page". Which boxes to
   ask (name, phone, e-mail, ZIP, delivery address, a note) and which are
   required. If they want to text customers: the exact wording of the
   un-ticked "you may text me" box.
7. **Their website addresses** that will show the designer (every one, with
   and without `www.`), and optionally the page it sits on (so shared links
   open there).
8. **The fine print** under the price ("Prices plus tax…"), any note for a
   building width (a 14 ft wide permit note, say), whether to show the price, a
   "from" price or none, and whether to show a rent-to-own monthly figure.
9. **How they build, if it is not the standard way**: stud size and spacing,
   floor joists, trusses or rafters and their spacing, anchors, loft depth…
   Anything they do not mention stays standard.

## Setting one up — the checklist

The `new-company` skill (`.claude/skills/new-company/SKILL.md`) is the full
procedure for Claude. In short:

- [ ] Everything in "What the company needs to send" is in hand.
- [ ] `node tools/new-company.mjs --id <id> --name "<name>" --phone "<phone>" --email <email> --styles <codes> --from-csv <their spreadsheet> --origins <their websites> --leads <mode> --leads-url <address> --renews <date>`
      writes `companies/<id>/company.json` and prints what is still to do.
- [ ] Every item on its "STILL TO DO" list is done; no price is left at $1
      (`node tools/import-prices.mjs companies/<id> <spreadsheet>` for more
      prices; `node tools/import-prices.mjs companies/<id> --export` lists
      every price, so a 1 left in the price column is easy to spot).
- [ ] `node tools/list-companies.mjs` says the file loads.
- [ ] The designer opens for them: `/?company=<id>` when running it locally
      (`npm run serve`), `/c/<id>/` once hosted — their name, colours, styles
      and prices.
- [ ] The contact sheet (`setup.html?company=<id>`) is printed or screenshot
      and **signed off by the company**.
- [ ] A test quote request reaches them.
- [ ] `node tools/build-headers.mjs` has been run, and the checks pass.
- [ ] The change is published, and the company has the two lines below.
- [ ] Their licence renewal date is in their settings.

## The two lines for their website

The company's web person puts these where the designer should appear, with
Alan's web address in place of `<where the designer lives>` and the company's
id in place of `acme`:

```html
<div id="shed-designer"></div>
<script src="https://<where the designer lives>/embed.js" data-company="acme" data-height="640"></script>
```

* `data-height` — the height in pixels (at least 520). Left out, the designer
  is three quarters as tall as it is wide.
* `data-target` — put it somewhere else on the page, by CSS selector, instead
  of the `shed-designer` box.
* `data-fullscreen="off"` — leave out the Full screen button.

The page can listen for `shed:quote-requested` (the customer sent a quote
request; the customer's details are included only when the company's leads go
to its own page). `embed-demo.html` is a sample company page showing all of
it (on the hosted site: it opens the designer at `/c/<id>/`, which
`npm run serve` does not provide, so locally its frame stays empty).

## After it is live

* **Price changes**: they send a new spreadsheet; `node tools/import-prices.mjs`
  puts it in and raises the price-list number (`cfg`), so an old shared link
  says "this design was priced at $X on <date>; prices may have changed".
* **Renamed or dropped items, sizes or colours**: the company's `renames`
  settings keep old links opening; anything that no longer exists is named on
  screen, never silently dropped.
* **A company stops paying**: set `status` to `"suspended"` and publish.
