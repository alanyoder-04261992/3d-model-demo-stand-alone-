# The Dealer Center — how the dealer software works

<!-- WHAT THIS FILE IS: the contract for the Dealer Center (prices, lots,
     team, customers, orders) and the public lot designer links. Code in
     server/office/, ui/office/, netlify/functions/ and tools/office-local.mjs
     follows it ("office" is only the code's folder name; people always
     read "Dealer Center"). Plain-English guide for Alan: docs/FOR-ALAN.md. -->

The **Dealer Center** is the private side of the 3D designer, at `/dealer`. One shed business
(for example Yoder Storage Barns) runs everything from it:

* the **owner** sets the **price list** — which buildings are sold, every size
  and price, doors and windows, options and colors — and every **lot** uses
  that one price list, so a price change reaches every lot the moment it is
  saved;
* each **lot** gets its own 3D designer link to put on its website;
* everybody who sells works their **customers** — new website quote requests,
  walk-ins and phone calls — with notes, follow-up dates, quotes and **orders**.

One Dealer Center site belongs to one business. A new shed company gets its own copy
of the site (see "Setting up a new company" below), so one company's customers
can never show up in another company's Dealer Center.

## The words we use

Use these words everywhere a person can read them: screens, emails, error
messages and docs. Never show a code ("LB", "w48", an ID) where a name fits.

| Say | Meaning | Never say |
|---|---|---|
| **Dealer Center** | the private site at `/dealer` | portal, office, workspace, dashboard, back end |
| **Owner** | runs the business; sets prices, lots and team | admin, Owner/Admin, administrator, tenant |
| **Manager** | works every lot's customers and orders; cannot change prices or people | admin |
| **Dealer** | works the customers and orders of their own lot(s) | member, staff account, user |
| **Lot** | a sales lot (a place that sells the buildings) | dealer lot ID, location record |
| **Price list** | buildings, sizes, prices, doors and windows, options, colors | catalogue, catalog, price book, config |
| **Building style** | Utility Shed, Lofted Barn, Cabin… | type, style code |
| **Customer** | a person who designed a building or talked to a lot | lead record, contact, request |
| **Quote** | one priced building for a customer | customer sales request, submission |
| **Order** | a quote the customer bought | — |
| **Follow-up** | the next day to contact a customer | task, reminder record |
| **3D designer** | the customer-facing designer | configurator, app |

Customer **stages** (where the sale is):

| Stage | Means |
|---|---|
| **New** | came in and nobody has talked to them yet |
| **Contacted** | someone talked to them |
| **Quoted** | they have a price for a building |
| **Sold** | they bought (an order exists) |
| **Delivered** | their building is set on their property |
| **Lost** | they bought somewhere else or stopped answering (a reason is kept) |

Order **statuses** (where the building is): **Sold → Sent to builder →
Ready → Delivered**, or **Cancelled**. Creating an order moves the customer to
Sold; delivering it moves them to Delivered.

Payment types: **Cash**, **Rent-to-own**, **Financing**, **Other**.

Writing style: short sentences, say what happened and what to do next. No
legal-sounding disclaimers, no "This does not…" negations, no passive voice
where a person did something. Money is "$5,540" (cents only when there are
any). Dates are "Oct 3" this year, "Oct 3, 2025" otherwise. Sizes are
"10×16" (with ×), buildings "10×16 Lofted Barn".

## Who can do what

| | Owner | Manager | Dealer |
|---|---|---|---|
| See customers and orders | every lot | every lot | their lots |
| Add customers, notes, follow-ups, quotes, orders | ✓ | ✓ | their lots |
| Move a customer to another lot | ✓ | ✓ | — |
| See the price list | ✓ | ✓ | ✓ |
| Change the price list | ✓ | — | — |
| Add and edit lots | ✓ | — | — |
| Add, change and remove people | ✓ | — | — |
| Business settings | ✓ | — | — |
| Download customers as a spreadsheet | ✓ | ✓ | — |

There can be more than one owner. The last active owner cannot be removed or
demoted. Every rule above is checked on the server; the screens only hide
what a person cannot do.

## How a price change reaches every lot

The price list is stored once. A lot stores only its own name, address and
contact details. When a customer opens a lot's designer link, the server
sends that lot the current price list, so a saved change shows on every lot
at once.

* **Quotes keep their price.** A quote stores its price lines and total when
  it is made. Changing the price list later never changes an existing quote
  or order.
* **Nobody designing a building is thrown out.** The price list has a
  `cfg` number that goes up only when something that changes a price or what
  can be picked changes (sizes, prices, doors and windows, options, colors).
  When a customer sends a design made under an older price list, the server
  prices it again at today's prices if everything in it is still sold, and
  the customer's confirmation shows the new total. Only a design with
  something no longer sold is sent back, with "Something in this building is
  no longer offered. Refresh the page to see today's options, then send it
  again."
* **History.** Every save keeps a copy of the price list and a list of what
  changed in words ("Lofted Barn 10×16: $5,540 → $5,700"). The owner can
  restore an earlier copy.

## Building styles

The builder's library (`library/manufacturers/standard.json`) holds every
building the 3D designer can draw (23 styles). The owner turns styles on and
off, renames them, adds and removes sizes, and sets every price.

The owner can also **add a style of their own**, built like one of the
library's: for example "Premium Lofted Barn", shaped like the Lofted Barn,
with its own sizes and prices, sold beside the regular one. In the settings
it is an `offer` entry with a `base`:

```json
"offer": {
  "LB":   {"sizes": {"10x16": 5540}},
  "LBX1": {"base": "LB", "name": "Premium Lofted Barn", "sizes": {"10x16": 6290}}
}
```

It is drawn exactly like its base (same roof, walls, standard doors and
windows, construction). A building with a different shape (a new roof, wall
height or door layout) is a new library style: use the `add-a-style` skill.

Sizes are whole feet, width 4–16 and length 4–60 in the Dealer Center. Widths with
proven drawings and skid tables are 6, 8, 10, 12 and 14.

## Data

Production uses the Netlify Blobs store `office-v2` (previews use a
deploy-only store). Every record is JSON. Reads are strongly consistent;
creates use `onlyIfNew`; changes use `onlyIfMatch` with the record's ETag and
retry on a clash, so two people working the same customer never overwrite
each other.

| Key | Holds |
|---|---|
| `setup` | the first owner's claim `{userId, at}` |
| `barnwright-terms` | `{current: {version, agreedAt, by: {userId, email, name}}, history: [...]}` — the owner's agreement to the Barnwright terms (connected businesses only) |
| `price-list` | `{settings, version, cfg, savedAt, savedBy}` — `settings` is a company settings object (`model/company.js`) |
| `price-list-history/<version>` | `{version, savedAt, savedBy, changes:[text], settings}` |
| `lots/<slug>` | `{slug, name, address, city, state, zip, phone, email, hours, website, embedOrigins[], active, createdAt, updatedAt}` |
| `people/<userId>` | `{userId, email, name, role, lots[], active, addedAt, addedBy, lastSeenAt}` |
| `invites/<sha256(email)>` | `{email, name, role, lots[], invitedAt, invitedBy}` |
| `customers/<id>` | the whole customer (below) |
| `lists/<slug>` | one row per customer of that lot, for lists, search and the Today screen |
| `counters/quote-number` | `{next}` — one counter for quote numbers, from 1001; an order keeps its quote's number |
| `website-requests/<hash>` | `{customerId, quoteId, fingerprint, receipt}` — makes a retried send safe |
| `limits/<slug>/<bucket>` | website send counts per lot (and per visitor) |

A **customer**:

```js
{ id, lot, name, phone, email, address, city, state, zip, smsOk,
  source,            // "website" | "walk-in" | "phone" | "other"
  stage, lostReason, assignedTo /* userId or null */,
  followUp,          // {date: "2026-10-05", note} or null
  quotes: [{ id, number, at, by, source, building, design, price, total, cfg,
             note?,           // a quote made in the Dealer Center
             plan?,           // website: what they want to do (model/quote-plan.js key)
             rto? }],         // website: {months, monthly} the rent to own they looked at
  orders: [{ id, number, quoteId, status, soldAt, soldBy, total, payment,
             deposit, deliveryAddress, deliveryDate, deliveryNotes,
             notes, history: [{status, at, by}] }],
  activity: [{ id, at, by /* {id,name} or null for the website */,
               type, text }],
  pastLots,          // lots they were moved away from (to tidy old list rows)
  createdAt, updatedAt }
```

`type` is one of `created, website, quote, note, call, text, email, visit,
stage, followup, assigned, order, order-status, moved, edited`.

A **list row** holds what lists need without opening every customer: `id,
name, phone, email, stage, assignedTo, followUp, building, total, source,
createdAt, updatedAt, lastActivityAt, quotes:[[at,total]], orders:[{id,
number, status, total, soldAt}]`. The customer record is the truth; a row is
rebuilt from it whenever the customer changes. The row is written from the
customer as stored at that moment (read inside the list's own conditional
write), so two changes finishing together never leave an older row, and a
moved customer's row never comes back to the lot they left. A row that is
missing or out of date (a write that stopped halfway) is put right when
anyone opens the customer.

## The Dealer Center API

All under `/api/office/`. JSON in and out. Errors are `{error: "Plain
sentence a dealer can act on"}` with a 4xx/5xx status; a price list that
cannot be saved (422) also lists every problem as `problems: ["…"]`, in the
owner's words (never a settings path or a code). Every change
(`POST/PUT/PATCH/DELETE`) needs an `Origin` header equal to the site's own.
Responses are `Cache-Control: private, no-store`.

| Route | Who | Does |
|---|---|---|
| `GET me` | anyone | `{person, business, lots, signIn, account, terms}`; `person` is null until the person has access; `business` is null before setup; `account` and `terms` are null unless the business is connected to Barnwright's control room (see "The business's Barnwright account"); `terms` is `{version, date, url, title, agreed}`, `agreed` null until the owner agrees to this version |
| `POST setup` | first owner | `{businessName, phone, email, website, start: "full"\|"small", agreeTerms}` creates the price list (closed to customers until the owner opens it); a connected business needs `agreeTerms: true` ("Tick the box to agree to the Barnwright terms.") and the agreement is kept |
| `POST terms` | owner | `{agree: true}` agrees to the current Barnwright terms (an owner who set up before the box existed, or after the terms changed); works while changes are stopped too |
| `GET price-list` | everyone with access | `{settings, version, cfg, savedAt, savedBy}` |
| `PUT price-list` | owner | `{settings, version}` → `{version, cfg, changes}`; 409 when someone saved first |
| `GET price-list/history` | owner, manager | `{entries: [{version, savedAt, savedBy, changes}]}` |
| `POST price-list/restore` | owner | `{version, current}` puts an earlier copy back as a new save |
| `GET lots` | everyone | their lots (all lots for owner/manager) |
| `POST lots` | owner | `{name, slug?, address, …}` |
| `PATCH lots/:slug` | owner | any lot field except `slug` |
| `GET team` | owner, manager | `{people, invites}` |
| `POST team` | owner | `{email, name, role, lots}` adds an invite (or updates the person if they already have access) |
| `PATCH team/:userId` | owner | `{name?, role?, lots?, active?}` |
| `DELETE team/invites/:hash` | owner | removes an invite not yet used |
| `GET customers` | everyone | `{rows}` for the lots the person can see; `?lot=` narrows |
| `POST customers` | everyone | `{lot, name, phone, email, …, source, note?}` |
| `GET customers/:id` | lot access | the whole customer |
| `PATCH customers/:id` | lot access | contact fields, `stage`, `lostReason`, `assignedTo`, `followUp`, `lot` (owner/manager) |
| `POST customers/:id/activity` | lot access | `{type: note\|call\|text\|email\|visit, text}` |
| `POST customers/:id/quotes` | lot access | `{design}` — a building designed in the Dealer Center; priced on the server |
| `POST customers/:id/orders` | lot access | `{quoteId, payment, deposit, deliveryAddress, deliveryDate, deliveryNotes, notes}`; the deposit is never above the total |
| `PATCH customers/:id/orders/:orderId` | lot access | `{status?, payment?, deposit?, deliveryDate?, …}` |
| `GET customers.csv` | owner, manager | a spreadsheet of the visible customers |
| `GET barnwright-help` | owner | `{help: {on, until, reason, log}}`, or `help: null` when not connected to the control room |
| `POST barnwright-help` | owner | `{on: true, reason, hours: 1–24}` lets Barnwright run checks; `{on: false}` stops them at once |

Public routes (no sign-in):

| Route | Does |
|---|---|
| `GET /api/lots/:slug` | `{company, lot, version}` for the lot's 3D designer; 404 when the lot is closed or the business is not open yet |
| `GET /d/:slug/` | the lot's 3D designer page; when closed, a short "Our 3D designer isn't open right now" page that says who to call — the lot's phone when the owner closed the whole designer, the business's phone when only that lot is closed (`pages.js` `closedPage`) |
| `POST /api/lots/:slug/quote-requests` | `{design, contact, idempotencyKey}` → `{id, number, total, price, receivedAt, repriced}` (201; the same send again → the same receipt, 200) |
| `POST /.netlify/functions/tenant-diagnostics` | Barnwright's support check (control room only, with a support pass, while the owner has help turned on) |

A website quote request is matched to an existing customer of that lot by
email or phone (digits compared); otherwise a new customer is made. A
customer of another lot is never matched. Either way the quote and an
activity line are added. The contact may carry `city` (kept with the street),
`plan` (what they want to do with the quote) and `rtoMonths` (the rent-to-own
term they looked at); the quote keeps `plan` and `rto: {months, monthly}`,
the monthly worked out from the server's own price, and the activity line,
the lot's email and the customer's quote say them in words ("What they want
to do: Ready to buy now — no permit needed", "Looked at rent to own: $183.89
a month over 60 months"). An answer or a term the business doesn't offer is
left out, never a reason to turn the quote away. A Lost or Delivered customer who comes back goes
back to New. The same send arriving twice at once (a double tap, a retry)
waits a few seconds for the first and gets its receipt; a send left half
done for over a minute is taken over by the retry.

## The business's Barnwright account

A shed company that buys the Dealer Center from Barnwright is connected to
Barnwright's control room (`alanyoder-04261992/control-room`), where Alan
keeps his customers, their payments and their activation keys. Alan's own
business, the local copy and the demo are not connected, and nothing below
applies to them.

**Checking in.** The Dealer Center checks in with the control room when
someone opens it and its last check-in is more than six hours old, and
every six hours on its own (`netlify/functions/barnwright-check-in.mts`).
It reports how many lots are open and gets back a pass signed by the
control room, good for exactly seven days: the account is on or off, and
how many lots may be open. `server/office/control-room.js` is the control
room's own check-in code (its `sdk/`, copied to plain JavaScript;
`license-core.js` holds the rules) and `account.js` says what the pass
means here.

**When changes stop.** The account was never switched on, Barnwright
switched it off, the pass can't be confirmed, or seven days passed without a
check-in. Then:
* every change answers 423 with a plain sentence, and every screen shows why
  at the top. Reading, searching and the spreadsheet keep working;
* taking a person off the team, or taking back an invite, still works, so
  nobody keeps access by accident;
* every lot's 3D designer link closes ("Our 3D designer isn't open right
  now" with the lot's number to call), because a customer's quote is a
  change too;
* the owner is warned at the top once a day passes without a check-in,
  with the day changes will stop.

**Open lots.** A lot that opens (a new one, or a closed one reopened) first
takes a place in one shared record (`barnwright-lot-slots`), written with a
conditional write, so two lots opened at the same moment can't both take
the last place. A lot added closed needs no place; closing a lot gives its
place back. Lots already open over a lowered limit stay open; the Lots
screen says "3 of 3 open lots in your Barnwright plan" and turns off
**Add a lot** when it is full.

**Help from Barnwright.** In Settings the owner lets Barnwright run checks
for 1 to 24 hours, with a reason. The control room then sends a support pass
(at most 15 minutes) to `/.netlify/functions/tenant-diagnostics`; every
visit is checked online with the control room and against the owner's
switch here. The answer is how the Dealer Center runs (version, account
state, whether storage answers) and never customers, prices, settings or
keys. Turning help off stops it here at once, even if the control room
can't be reached. Each turn on, turn off and check is written in a short log
the owner sees under the switch.

**Settings** (Netlify environment variables, from the control room when
Alan makes the activation key): `CONTROL_ROOM_URL`,
`CONTROL_ROOM_CUSTOMER_ID`, `CONTROL_ROOM_ACTIVATION_KEY` (secret,
Functions scope only), `CONTROL_ROOM_PUBLIC_KEY`, and optionally
`CONTROL_ROOM_SITE_ID` (Netlify's own site ID otherwise). None set: not
connected. Some but not all: nothing can be changed until they are all
there.

`npm run office -- --control-room` runs the local copy against a pretend
control room (`tools/lib/fake-control-room.mjs`, 3 open lots in its plan);
`tools/check-control-room.mjs` proves every rule above, and that leases
signed by the control room's own code (`test/control-room/leases.json`)
read the same way.

## Security rules that never bend

* **Prices come from the server.** Every quote is checked and priced by
  `server/office/pricing.js` from the stored price list. A browser total, a
  forged lot or company, or "included" flags that would make an extra free
  change nothing.
* **Sign-in is Netlify Identity.** Only a confirmed email counts. Roles live
  in `people/<userId>`, never in anything the browser can edit.
* **First owner.** The `OWNER_EMAIL` setting names the first owner. The first
  confirmed sign-in with that email claims the business, once; changing the
  setting later does not make another owner.
* **Lots are walls.** A dealer's every read and write is checked against
  their lots. Asking for another lot's customer answers 404.
* **Website sends** are limited per visitor and per lot, retried sends make
  one quote, and the reply never repeats the customer's contact details.
* Request bodies are JSON, at most 256 KB, at most 24 levels deep, with no
  `__proto__`/`constructor`/`prototype` keys. Text is length-limited and
  control characters are refused.

## Email (optional)

When `RESEND_API_KEY` and `EMAIL_FROM` are set, the Dealer Center emails a lot's
email address when a website quote request arrives, and can email an invite
to a person the owner adds. Without them nothing is emailed and the Dealer Center
works the same.

## Running it on your computer

```
npm run office          # http://127.0.0.1:8383/dealer — sample business, sign in as anyone
npm run office -- --reset   # start the sample data again
```

This local Dealer Center keeps its data in `.office-local/` (never published) and
replaces Netlify sign-in with a list of the sample people. It serves the lot
designer links too (`/d/riverside/`), so a quote sent from the designer
appears in the Dealer Center.

## Try it without signing in

On Alan's learning preview and on his demo site, leave the email and
password empty and tap **Sign in** (or open `/dealer?demo`). The Dealer Center opens with the
sample business, running entirely in the visitor's browser: the server
code runs inside the page on made-up data that stays in that browser tab,
and nothing is sent to the site's real data. Pick who to be (the owner,
the manager or a dealer). Reloading the tab keeps what was done; **Start
over** puts the sample back. A lot's 3D designer link does not exist in the
demo, so "See it in 3D" and "Design a building" use the example designer
(`/c/demo/`). Good for showing the Dealer Center to a shed company before
they buy.

Only the learning preview and the demo site offer it. The demo site
(`barnwright-demo` on Netlify, recognized by its Netlify ID like the
learning preview) is the 3D designer and the Dealer Center with the demo,
and no lesson pages; a build run with `DEALER_DEMO=true` does the same
anywhere else. Every other site, and every client build
(`npm run build:client`, even with `DEALER_DEMO=true`), leaves the demo out
completely: no demo file and no empty-boxes sign-in, so a real login always
needs both an email and a password. The build decides this (`__DEALER_DEMO__` in
`tools/build-site.mjs`, from `tools/site-profiles.mjs`);
`tools/check-dealer-demo.mjs` proves it.

## Setting up a new company

Alan's whole procedure, from the day a company says yes to the day it goes
live, with every button named, is
**`docs/legal/Barnwright-Adding-a-New-Customer.pdf`** (made by
`tools/legal/make-legal-pdfs.py`). In short:

Barnwright sells **one product**, the Barnwright 3D designer (the 3D designer
and its Dealer Center), which works alongside whatever software the company
already uses. **No setup fee; $250 a month from go-live, with the first lot
included**; each lot after the first is **$250 one time** and adds nothing to
the monthly fee. Every business lives at
**`<their name>.barnwrightsoftware.com`** (once, before the first customer,
`barnwrightsoftware.com` goes on Netlify DNS so each new address is one step).

1. **Paperwork.** Alan fills in Sections B and C of the Sign-Up Form
   (`docs/legal/Barnwright-Sign-Up-Form.pdf`, fillable, with Barnwright
   Software, sales@barnwrightsoftware.com and the $250 monthly fee typed in:
   lots, the lots after the first and their lot fees, which is nothing for
   one lot) and sends it with the terms (`legal/barnwright-terms.pdf`)
   and the Setup Questions (`docs/legal/Barnwright-Setup-Questions.pdf`); the
   company fills in Section A, initials Section D and signs; Alan signs. The
   company sends back its answers with its logo, price sheet and photos.
2. **Control room.** **Add customer** with a dealership cap of 1 (the lot
   the monthly fee includes), 0 for the build fee and 250 for the monthly
   subscription. More than one lot: **Collect lot fee** for the lots after
   the first; when Stripe confirms the payment the control room raises the
   cap by itself. The monthly fee does not start yet.
3. **Their site.** A new Netlify project from this repository (named for the
   business) with the domain `<their name>.barnwrightsoftware.com`; its
   Project ID and that address go on the customer in the control room; **Identity** on (registration open: anyone can make a login, but
   only people the owner adds can see anything); **Create activation key** in
   the control room; then the environment variables `OWNER_EMAIL` (the
   owner's email from the form), `CONTROL_ROOM_URL`,
   `CONTROL_ROOM_CUSTOMER_ID`, `CONTROL_ROOM_PUBLIC_KEY` and
   `CONTROL_ROOM_ACTIVATION_KEY` (secret, Functions scope only), optionally
   `RESEND_API_KEY` and `EMAIL_FROM`; deploy again.
4. **The owner sets up.** They open `/dealer`, make a login with that email,
   confirm it, and follow the setup steps: business details with "I agree to
   the Barnwright terms", a starting price list, the first lot. Then their
   prices, Settings, lots and team; Open to customers; the website code for
   each lot; a test quote.
5. **Go live.** **Start monthly subscription** in the control room, and the
   go-live email with the date the monthly fee starts.
6. **Adding a lot later.** **Collect lot fee** on the customer in the
   control room ($250 for each new lot, one time) and email them the link.
   When Stripe confirms the payment, the control room raises the
   **Dealership cap** by that many lots by itself; the Dealer Center picks it
   up at its next check-in (within six hours).

### The Setup Questions

`docs/legal/Barnwright-Setup-Questions.pdf` is what a new company answers so
it can be set up: the business and its web address, the look, each lot, the
team, the styles it sells (with its own names), sizes and prices, how it
builds (each construction number with the standard beside it), doors,
windows and options with prices and its own extras, colors, how prices show,
rent to own, and what the quote form asks. Its lists come from
`library/manufacturers/standard.json` and `library/construction.json` when the
script runs, so they always match the designer. The `new-company` skill says
which answer goes where.

### The papers in the control room

The control room's **Papers** page lists the papers (Sign-Up Form, terms,
Setup Questions, Adding a New Customer, and the one-page Flyer and Price
Sheet to hand to shed companies) so Alan can open or download
them anywhere. It reads `docs/legal/papers.json` and each PDF from this
repository's `main` branch on GitHub every time, so once a change to the papers
is merged here, the control room has it: there is nothing to copy. The script
writes `papers.json` too; a new paper added to its list shows up in the
control room on its own.

### The Barnwright terms

A business Barnwright sells to agrees to the **Barnwright Software Terms and
Conditions** (`legal/barnwright-terms.pdf`, published on every business's
site by `tools/build-site.mjs`) in two places: the paper Sign-Up Form, and
the Dealer Center (`server/office/terms.js`). First setup can't make the
business without the owner's "I agree"; an owner who set up before the box
existed, or before the terms changed, sees "Please read the Barnwright
Software Terms and Conditions (version 1.0), then tap I agree." at the top
of every screen until they do. Each agreement is kept with its version, time
and the owner's login, and Settings, Help from Barnwright, says who agreed
and when. Alan's own business, the local copy and the demo are not asked.
To change the terms: edit `tools/legal/make-legal-pdfs.py`, raise `VERSION`
there and `TERMS.version` in `server/office/terms.js` together, run the
script, and email every customer the new terms 30 days ahead.

## Files

| File | Job |
|---|---|
| `server/office/index.js` | `createOffice(deps)` → `{handle, publicLot}`; the routes |
| `server/office/http.js` | reading requests, writing answers, the Origin check |
| `server/office/store.js` | reads, create-only and conditional writes, retry on a clash |
| `server/office/people.js` | sign-in, the first owner, invites, roles |
| `server/office/price-list.js` | saving, `cfg`, history and the words for each change |
| `server/office/lots.js` | lots |
| `server/office/customers.js` | customers, list rows, activity, quotes, orders |
| `server/office/website.js` | public lot data and website quote requests |
| `server/office/pricing.js` | checking and pricing a design on the server |
| `server/office/email.js` | the optional emails |
| `server/office/netlify.js` | Netlify Blobs, Identity and environment |
| `server/office/account.js` | the business's Barnwright account: when changes stop, open lots, help from Barnwright |
| `server/office/terms.js` | the owner's agreement to the Barnwright terms |
| `legal/barnwright-terms.pdf` | the Barnwright Software Terms and Conditions, published on every business's site |
| `tools/legal/make-legal-pdfs.py` | makes the terms, the Sign-Up Form, the new customer steps and the Setup Questions (`docs/legal/`), and `docs/legal/papers.json`, the list the control room's Papers page reads |
| `server/office/control-room.js`, `license-core.js` | the control room's own check-in code, copied to plain JavaScript |
| `netlify/functions/tenant-diagnostics.mts` | Barnwright's support check |
| `netlify/functions/barnwright-check-in.mts` | checks in with the control room every six hours |
| `netlify/functions/office-api.mts` | serves `/api/office/*` and `/api/lots/*` |
| `netlify/functions/lot-designer.mts` | serves `/d/:slug/` with that lot's allowed websites |
| `dealer.html`, `ui/office/*` | the Dealer Center's screens (`ui/office/views/`), its frame and its look |
| `ui/office/demo.js` | the "try it" demo: the server code running in the page on made-up data (`/dealer?demo`, learning preview and demo site only) |
| `server/office/sample.js` | the sample business (Sample Storage Barns, 3 lots, 30 customers) for the local Dealer Center, the demo and the checks |
| `server/office/identity.js` | asks Netlify Identity who is signed in; the autoconfirm guard |
| `server/office/hash.js` | SHA-256 and random ids in plain JavaScript (the same on Netlify and in a browser) |
| `tools/office-local.mjs` | the local Dealer Center with sample data (`npm run office`) |
| `tools/check-office.mjs` | proves the API rules |
| `tools/check-dealer-center.mjs` | clicks through the Dealer Center, a lot designer and the demo in Chromium |
| `tools/check-wording.mjs` | keeps the old words out of every screen and answer |
| `tools/check-style-variants.mjs` | a business's own style draws and prices exactly like its library style |
| `tools/check-control-room.mjs` | the Barnwright account rules, against a pretend control room |

## The screens

The Dealer Center is black and gold for every business: a black header with
the blueprint grid and a black left column, gold for the button that matters
and the page you are on, Oswald capitals for headings, IBM Plex Sans for
writing, white cards on a warm light page. Gold words on white use a deeper
gold so they read easily, and gold buttons carry black words. The business's
logo and name show in the header; its own colors (Settings, Colors) go on its
customers' 3D designer, never on the Dealer Center. A new business's 3D
designer starts black and gold too, and "Use the standard black and gold"
in Settings, Colors puts it back. It works on a
phone first: a dealer standing on the lot uses it one-handed. Buttons are at
least 44 px tall; phone numbers and emails are tap-to-call, tap-to-text and
tap-to-email links.

Frame: header (business logo/name, "Dealer Center", the lot picker for people with
more than one lot, the person's menu with Sign out). Navigation: a left
column on wide screens, a bottom bar on phones.

**Today** (`#/`) — "Good morning, Alan." Follow-ups due today and overdue
(overdue in red), new customers nobody has contacted, numbers for this month
(new customers, quotes, buildings sold, sales $), and for owners and managers
the same numbers per lot. Each row opens the customer.

**Customers** (`#/customers`) — search (name, phone, email), stage chips with
counts, lot filter, "Only mine", a list or a board (one column per stage).
"+ Add customer" (walk-in, phone call). Rows show name, building, total,
stage, follow-up, lot, last activity.

**A customer** (`#/customers/:id`) — name, stage picker, lot, assigned
person; contact with call/text/email buttons and an edit form; follow-up date
with "Tomorrow", "In 3 days", "Next week" and a note; quotes (building,
price, date, "Open in 3D", "Print", "Mark sold"); orders (number, status
steps, payment, down payment, balance, delivery); "Design a building for
them" (opens the lot's 3D designer for this customer, under a bar with
"Copy link to this building", Cancel and "Save quote": the copy button puts
the lot's own designer link with this exact building in it on the clipboard,
to text or email to the customer, who can change it and send it in like any
quote; the lot's link that customers use has no such button); the activity history
with a box to add a note, call, text, email or visit.

**Orders** (`#/orders`) — sold buildings: status chips (Sold, Sent to
builder, Ready, Delivered, Cancelled), lot filter, totals. An order page is a
printable order sheet: business header, order number and date, customer,
building with every option and price line, total, down payment, balance,
delivery address, date and notes, and signature lines.

**Price list** (`#/price-list`, `#/price-list/<tab>`) — tabs Buildings,
Doors & windows, Options, Colors and (owner, manager) History. Everyone can
look: dealers and managers see a clean price sheet with a search box ("12x24",
"cabin"). Only owners see inputs, and they work on a draft that is checked
as they type with the server's own rules (`model/company.js`), so each
problem shows in plain words next to the box it is about, before saving.
* *Buildings* — styles by group in cards that fold; each style shows its
  name, a Sold switch, its size count and "from" price, and opens to the
  name customers see, its sizes and prices (width then length) and "Add a
  size" (width 4–16, length 4–60, whole feet). Switching a style off keeps
  its sizes until saving; removing its last size asks to stop selling it.
  "Change prices" raises or lowers every price in a style, a group or
  everything by a percent or dollars, rounded to the nearest $1, $5, $10
  or $25, with a preview; it changes the draft only. "Add a building style"
  adds one of the library's styles (example sizes, prices left empty to
  type) or the business's own style built like one of them (code like
  "LB1", never shown). "The 3D designer opens on" picks the first building.
* *Doors & windows* — each door, window, light and fixture: name customers
  see, price, "Sell this". One that comes with a sold style or option says
  so and stays sold ($0 is fine).
* *Options* — dormers, ramps, electrical packages, shutters, door window,
  exterior light and per-square-foot upgrades (sell, price, rename), and the
  business's own options (name, how it is priced, price).
* *Colors* — siding, trim and roof swatches to switch on and off, colors of
  the business's own, and the colors the 3D designer opens on.
A bar at the bottom counts unsaved changes: "6 changes", "See them", "Undo
changes", "Save for all lots", and what still needs fixing ("2 prices
missing", "Show me"). Leaving the price list with changes asks first. After
saving: "Saved. All 3 lots show the new prices now." with the change list.
If someone else saved first, the owner is told and reloads. *History* lists
every save in words, with who and when, and (owner) "Put this back".

**Lots** (`#/lots`, one lot at `#/lots/<link name>`) — a card per lot: name,
Open or Closed, address, phone, email, hours, website; customers working now,
sold and sales this month ("See its customers"); the dealers who work it; its
3D designer link (shown in full, "Open the designer", "Copy link"); "Put the
designer on your website": one sentence to pass on ("Send this to whoever
runs your website…"), the website code with "Copy website code"
(`<div id="shed-designer">` and `embed.js` with `data-lot`), and "Websites
that may show it" as plain addresses (yoursite.com), with "Add website"
(offering the www. twin in one tap) and "Remove". Owners: "Add a lot" (the
pop-up shows the link the name will get), "Edit lot", "Close lot" / "Open
lot" ("Closing Arcadia stops its 3D designer link. Its customers stay.").
Managers see every lot and dealers their own, without the owner's buttons
but with the link and the website code.

**Team** (`#/team`, owner and manager) — people with job, lots and last
visit; removed people (greyed, "Put back"); invites not yet used ("Invited
Oct 3 — hasn't signed in yet", "Copy message", "Remove invite"). "Add a
person": name, email, job (Owner, Manager, Dealer) and, for a dealer, lots.
Then a message to send them, ready to copy or email ("Hi Maria — I added you
to the Yoder Storage Barns Dealer Center. Go to …/dealer, tap “Make your
login” and use maria@example.com."), and emailed too when email is set up.
"Edit": name, job, lots, "Remove from team" (they can't sign in; their
customers stay). The last owner can't be removed or made a manager or
dealer. Managers see the list without the buttons; dealers don't see it.

**Settings** (`#/settings`, owner) — *Your business* (name, phone, email,
website); *Logo* (upload; shrunk in the browser to fit 360×360,
PNG or WebP, at most 150 KB; "Remove logo"); *Colors* (header and button
colors with a live preview; a warning when white words would be hard to
read on the header; on a light button the words turn black; "Use the
standard black and gold"); *3D designer* ("Open to customers" or "Closed" — closed links show
who to call; how prices show: the full price, a starting price ("from") or
no price; a monthly rent-to-own price over one of the price list's terms,
which also puts a box in the customer's quote with a button for each term,
and the words under that figure;
the line under the price; notes for building widths; the building it opens
on); *The quote form* (phone, email, ZIP, street address and a note: "Must
give", "Can give" or "Don't ask" — the name is always asked, and phone or
email must be; the street address is asked as Street and City; "Ask what
they want to do with the quote", on unless turned off; the texting
permission sentence, empty = don't ask). It all
saves into the price list record with one bar at the bottom ("3 changes",
"Undo changes", "Save settings"); someone saving first is told to reload.
Managers and dealers see "Only the owner can change settings".

**Sign in** — email and password; "Make your login" (for people the owner
added); "Forgot your password?"; links from Netlify emails (confirm, invite,
reset) land here and are handled. Someone signed in but not added yet sees
"You're signed in as maria@…, but you're not on the team yet.
Ask the owner to add this email."

**First setup** (`#/setup`, the first owner, once; the menu is hidden
until it's done) — three steps: your business (your name, business name,
phone, email, and for a business Barnwright sells to "I have read and agree
to the Barnwright Software Terms and Conditions (version 1.0) for my
business", with a link to the PDF; Next says "Tick the box to agree to the
Barnwright terms." until it is ticked), your starting price list (every standard building at example
prices, or three buildings to start small — all example prices to change),
your first lot (showing the link it will get). Then "Your Dealer Center is
ready." with "Check your prices" and "Add your team". The designer links
stay closed until the owner picks "Open to customers" in Settings.
