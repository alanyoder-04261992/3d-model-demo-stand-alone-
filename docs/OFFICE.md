# The Office — how the dealer software works

<!-- WHAT THIS FILE IS: the contract for the private Office (prices, lots,
     team, customers, orders) and the public lot designer links. Code in
     server/office/, ui/office/, netlify/functions/ and tools/office-*.mjs
     follows it. Plain-English guide for Alan: docs/FOR-ALAN.md. -->

The **Office** is the private side of the 3D designer. One shed business
(for example Yoder Storage Barns) runs everything from it:

* the **owner** sets the **price list** — which buildings are sold, every size
  and price, doors and windows, options and colors — and every **lot** uses
  that one price list, so a price change reaches every lot the moment it is
  saved;
* each **lot** gets its own 3D designer link to put on its website;
* everybody who sells works their **customers** — new website quote requests,
  walk-ins and phone calls — with notes, follow-up dates, quotes and **orders**.

One Office site belongs to one business. A new shed company gets its own copy
of the site (see "Setting up a new company" below), so one company's customers
can never show up in another company's Office.

## The words we use

Use these words everywhere a person can read them: screens, emails, error
messages and docs. Never show a code ("LB", "w48", an ID) where a name fits.

| Say | Meaning | Never say |
|---|---|---|
| **Office** | the private site at `/office` | portal, workspace, dashboard, back end |
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

Sizes are whole feet, width 4–16 and length 4–60 in the Office. Widths with
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
  quotes: [{ id, number, at, by, source, building, design, price, total, cfg }],
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

## The Office API

All under `/api/office/`. JSON in and out. Errors are `{error: "Plain
sentence a dealer can act on"}` with a 4xx/5xx status; a price list that
cannot be saved (422) also lists every problem as `problems: ["…"]`, in the
owner's words (never a settings path or a code). Every change
(`POST/PUT/PATCH/DELETE`) needs an `Origin` header equal to the site's own.
Responses are `Cache-Control: private, no-store`.

| Route | Who | Does |
|---|---|---|
| `GET me` | anyone | `{person, business, lots, signIn}`; `person` is null until the person has access; `business` is null before setup |
| `POST setup` | first owner | `{businessName, phone, email, website, start: "full"\|"small"}` creates the price list (closed to customers until the owner opens it) |
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
| `POST customers/:id/quotes` | lot access | `{design}` — a building designed in the Office; priced on the server |
| `POST customers/:id/orders` | lot access | `{quoteId, payment, deposit, deliveryAddress, deliveryDate, deliveryNotes, notes}`; the deposit is never above the total |
| `PATCH customers/:id/orders/:orderId` | lot access | `{status?, payment?, deposit?, deliveryDate?, …}` |
| `GET customers.csv` | owner, manager | a spreadsheet of the visible customers |

Public routes (no sign-in):

| Route | Does |
|---|---|
| `GET /api/lots/:slug` | `{company, lot, version}` for the lot's 3D designer; 404 when the lot is closed or the business is not open yet |
| `POST /api/lots/:slug/quote-requests` | `{design, contact, idempotencyKey}` → `{id, number, total, price, receivedAt, repriced}` (201; the same send again → the same receipt, 200) |

A website quote request is matched to an existing customer of that lot by
email or phone (digits compared); otherwise a new customer is made. A
customer of another lot is never matched. Either way the quote and an
activity line are added. A Lost or Delivered customer who comes back goes
back to New. The same send arriving twice at once (a double tap, a retry)
waits a few seconds for the first and gets its receipt; a send left half
done for over a minute is taken over by the retry.

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

When `RESEND_API_KEY` and `EMAIL_FROM` are set, the Office emails a lot's
email address when a website quote request arrives, and can email an invite
to a person the owner adds. Without them nothing is emailed and the Office
works the same.

## Running it on your computer

```
npm run office          # http://127.0.0.1:8383/office — sample business, sign in as anyone
npm run office -- --reset   # start the sample data again
```

This local Office keeps its data in `.office-local/` (never published) and
replaces Netlify sign-in with a list of the sample people. It serves the lot
designer links too (`/d/port-charlotte/`), so a quote sent from the designer
appears in the Office.

## Setting up a new company

1. Make a new Netlify site from this repository.
2. In the site's settings turn on **Identity** (registration: open — anyone
   can make a login, but only people the owner adds can see anything).
3. Add the environment variable `OWNER_EMAIL` with the owner's email.
4. The owner opens `/office`, makes a login with that email, confirms it, and
   follows the setup steps: business details, a starting price list, the
   first lot.

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
| `netlify/functions/office-api.mts` | serves `/api/office/*` and `/api/lots/*` |
| `netlify/functions/lot-designer.mts` | serves `/d/:slug/` with that lot's allowed websites |
| `office.html`, `ui/office/*` | the Office screens |
| `tools/office-local.mjs` | the local Office with sample data |
| `tools/check-office.mjs` | proves the API rules |
| `tools/check-office-browser.mjs` | clicks through the Office and a lot designer in Chromium |

## The screens

The Office looks like the 3D designer: the navy header with the blueprint
grid, Oswald capitals for headings, IBM Plex Sans for writing, white cards on
a light page, the business's own header and accent colors. It works on a
phone first: a dealer standing on the lot uses it one-handed. Buttons are at
least 44 px tall; phone numbers and emails are tap-to-call, tap-to-text and
tap-to-email links.

Frame: header (business logo/name, "Office", the lot picker for people with
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
them" (opens the lot's 3D designer for this customer); the activity history
with a box to add a note, call, text, email or visit.

**Orders** (`#/orders`) — sold buildings: status chips (Sold, Sent to
builder, Ready, Delivered, Cancelled), lot filter, totals. An order page is a
printable order sheet: business header, order number and date, customer,
building with every option and price line, total, down payment, balance,
delivery address, date and notes, and signature lines.

**Price list** (`#/price-list`) — four tabs. Everyone can look; only owners
see inputs.
* *Buildings* — styles by group; each shows "Sold" or "Not sold", its name
  as customers see it, and a table of sizes and prices. Add a size (width ×
  length, price), remove a size, rename the style, add a style (from the
  library or built like one of them). "Change prices" raises or lowers
  every price in a style, a group or everything by a percent or dollars,
  rounded to $5, with a preview first.
* *Doors & windows* — each door, window, light and fixture: price, sold or
  not (standard ones cannot be switched off but can be $0).
* *Options* — dormers, ramps, electrical packages, shutters, door window,
  exterior light, per-square-foot upgrades, and the business's own extras.
* *Colors* — which siding, trim and roof colors customers can pick.
A bar at the bottom counts unsaved changes: "6 changes — Save for all
lots" / "Undo". After saving: "Saved. All 3 lots show the new prices now."
*History* lists every save in words, with who and when, and "Put this back".

**Lots** (`#/lots`) — a card per lot: name, address, phone, its counts, its
designer link (open, copy), "Put the designer on your website" (the code to
paste and the websites allowed to show it), people working it. "+ Add a lot".
A lot can be closed (its link stops working; its customers stay).

**Team** (`#/team`) — people with role, lots and last visit; invites not yet
used. "+ Add a person": name, email, role, lots. Then a message to send them,
ready to copy (and emailed when email is set up): where to go and which email
to sign in with.

**Settings** (`#/settings`, owner) — business name, phone, email, website,
tagline, logo (upload; shrunk in the browser), header and accent colors; how
prices show on the designer (full price, "from" price, no price), rent-to-own
monthly terms; the line under the price (fine print); which contact details
the quote form asks for; text-message permission wording; "Open for
customers" / "Closed".

**Sign in** — email and password; "Make your login" (for people the owner
added); "Forgot your password?"; links from Netlify emails (confirm, invite,
reset) land here and are handled. Someone signed in but not added yet sees
"You're signed in as maria@…, but nobody has added you to this Office yet.
Ask the owner to add this email."

**First setup** (the first owner, once) — three steps: your business, your
starting price list (every standard building at example prices, or three
buildings to start small — all example prices to change), your first lot.
The designer links stay closed until the owner presses "Open for
customers".
