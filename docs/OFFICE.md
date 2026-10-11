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

| | Owner | Manager | Dealer | Barnwright (setup access) |
|---|---|---|---|---|
| See customers and orders | every lot | every lot | their lots | — |
| Add customers, notes, follow-ups, quotes, orders | ✓ | ✓ | their lots | — |
| Move a customer to another lot | ✓ | ✓ | — | — |
| See the price list | ✓ | ✓ | ✓ | while access is open |
| Change the price list | ✓ | — | — | while access is open |
| See a closed 3D designer as a preview | every lot | every lot | their lots | while access is open |
| Add and edit lots | ✓ | — | — | — |
| Add, change and remove people | ✓ | — | — | — |
| Business settings | ✓ | — | — | some, while access is open ("The lock") |
| Open or close the 3D designer to customers | ✓ | — | — | never |
| Let Barnwright run checks or change prices (Settings, Barnwright) | ✓ | — | — | never |
| Download customers as a spreadsheet | ✓ | ✓ | — | — |
| Ask Barnwright (Help) | ✓ | ✓ | ✓ | — |
| See the questions asked and Barnwright's answers | every one | every one | their own | — |

There can be more than one owner. The last active owner cannot be removed or
demoted. Every rule above is checked on the server; the screens only hide
what a person cannot do.

Barnwright is not a person on the team. It gets in only through its own
door and visit routes (see "Barnwright setup access"), never through the
team's routes, and it is never a role in `can`. "Access is open" means
before the business is live, or while the owner's switch is on.

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
* **Stricter checks never break a saved price list.** A save that adds a
  misspelt setting, a How it's built number past its limits or an extra
  that changes the roof through its construction settings is refused in
  plain words ("Side Utility: "sizez" is not part of a building style. Did
  you mean sizes?"). A problem the stored price list already had does not
  stop a save, every lot's designer and quotes keep opening on it, and
  putting an older copy back from History is always allowed
  (`server/office/price-list.js check(next, previous)`).

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

### How it's built

Each business can build a style its own way without a new version of the
3D designer: taller walls, another roof pitch, a deeper porch. The owner
types the numbers the way a shed builder says them ("5/12", "7 ft 9 1/2 in",
"76 1/2 in") in the Buildings tab, and they are saved in the price list like
a price (`model/build-settings.js`, the `how-its-built` skill):

* **On a style** (the style's own "How it's built" boxes): roof pitch or
  barn roof height for each width, eave overhang, gable-end overhang, wall
  height, wooden shop door height, and where the style has them, porch
  depth, side porch lengths (chips) and dormer side (chips). Each empty box
  shows the number the style is built with and where it comes from
  ("Standard: 7 ft 9 1/2 in", "Built like the Utility Shed: 6/12"); a barn's
  eave, which differs by width, is said short in the box ("1 3/4 to
  2 1/8 in") and at each width under it. A style of
  the business's own follows the style it is built like, unless it has a
  number of its own.
* **For the whole business** ("How your buildings are built", at the end
  of the Buildings tab): the same numbers for every building with one kind
  of roof, each saying which styles it reaches, which have their own, and
  which keep a feature of their own ("The Garden Utility keeps its flush
  gable end").
* **On an option** (Options tab, "Roof pitch at least"): an option like a
  steep roof makes the roof at least that steep when a customer picks it;
  it never makes a roof flatter. "Offered on" picks the buildings it is
  sold on (every building, or only the ones pressed; a style of the
  business's own follows the style it is built like); on any other
  building the 3D designer does not show it, takes it off with one plain
  line when the customer changes building, and the server refuses it. The
  pitch box and the chips are folded under "Only on some buildings, or
  changes the roof", so an option like a ridge vent stays short. Where the
  pitch changes nothing (a barn or saltbox roof, past a lean-to's 6/12, a
  roof already that steep) it says so under the option and in a yellow
  note when the price list opens ("Steep roof does not change the Lofted
  Barn (it has a barn roof). A customer would pay for nothing there.",
  `extrasThatChangeNothing`). The 3D designer names the roof it gives
  ("Steep roof (7/12 roof)"). No example price list a business starts
  with has one (Alan, Oct 11 2026: take the Steep roof out); an owner who
  sells a steeper roof makes their own option, for example "Steep roof" at
  7/12 on the Utility Shed and Side Utility. History says "Steep roof:
  roof pitch at least 7/12" and "Steep roof is offered on the Utility Shed
  and Side Utility".
* **As it is typed**, a number that cannot be read or is past its limits
  is said under its box ("Roof pitch: write it like 5/12.", "Porch depth
  72 ft is deeper than 8 ft. Did you mean 72 in (6 ft)?") with the red
  count on the tab, and Save waits until it is fixed.
* **Check every size** (on each style) draws the style at every size it is
  sold in with the numbers on the screen, saved or not, in the browser
  (`model/built-check.js`, `model/style-check.js`), and says in words what
  does not fit: a door taller than the wall leaves room for, a roof edge in
  front of a door, framing that does not build. It draws one size at a
  time and gives the page back in between, so a style with many sizes never
  freezes the page. What the same building has with the standard numbers,
  no worse, never stops a save; it is listed under "Already so in the
  standard building:" ("Side Utility 8x12: the 72″ Wooden Double Doors and
  the 2×3 Window on the right side overlap by 2 3/8 in.").
* **On save** the server does the same for every style whose numbers
  changed, each also with every option that changes how it is built
  switched on (a new wall with the business's Steep roof), and for every style a
  changed option reaches or now reaches (its buildings list widened, a
  style sold again) (`server/office/built-check.js`): what the new numbers
  cause refuses the save, in words, like any price list problem; a
  price-only save draws nothing. It draws the size each style opens on
  first, for every style, then the smallest and largest, then the rest; it
  stops after about 3 seconds and lists what is left ("Not checked yet: 14
  sizes of the Lofted Barn. Press Check every size."), which never stops a
  save. The owner putting an older copy back is never refused;
  what no longer fits is said instead. (Barnwright's put back carries the
  locked parts forward, so it is checked like a save: see "The lock".)
* **History** says each change: "Lofted Barn wall height: 6 ft 7 1/2 in →
  7 ft", "Business-wide roof pitch for gable roofs: standard → 6/12
  (Utility Shed, Side Utility and 3 more 5/12 → 6/12; Cabin, Side Cabin and
  3 more about 6 1/2/12 → 6/12)", naming each style a business-wide number moved,
  "Utility Shed wall height: 7 ft 9 1/2 in → 8 ft (and Premium Utility,
  built like it)", naming each style of their own a library style's own
  number reaches, "Steep roof: roof pitch at least 7/12", and "Wall upgrades priced by the
  square foot follow the new wall height: ..." when a wall height moves
  what a per-square-foot wall upgrade costs. A change that moves what is
  drawn raises `cfg`, so open designers redraw; the standard's own number
  typed on a style is said ("Utility Shed roof pitch: standard (5/12) →
  5/12 of its own") but draws nothing new, so `cfg` stays. Every number is
  stored as its number ("5/12" as 5), so sending it again is no change, and
  a barn width given twice ("08" and "8") is refused.
* **When the price list opens**, the owner's screen quietly checks the
  styles with numbers of the business's own for about 1 1/2 seconds and
  shows a yellow note if a change to the standard means they no longer
  fit ("Since the last update, your own building numbers do not fit
  everywhere."), with numbers the 3D designer could not use.
* **Managers and dealers** see each style's numbers, read only, under
  "How it's built" on its price card.

## Data

Production uses the Netlify Blobs store `office-v2` (previews use a
deploy-only store). Every record is JSON. Reads are strongly consistent;
creates use `onlyIfNew`; changes use `onlyIfMatch` with the record's ETag and
retry on a clash, so two people working the same customer never overwrite
each other.

| Key | Holds |
|---|---|
| `setup` | the first owner's claim `{userId, email, at}`, written at the owner's first confirmed sign-in; until it exists, no owner has signed in yet (see "Before the owner first signs in") |
| `barnwright-terms` | `{current: {version, agreedAt, by: {userId, email, name}}, history: [...]}` — the owner's agreement to the Barnwright terms (connected businesses only) |
| `price-list` | `{settings, version, cfg, savedAt, savedBy}` — `settings` is a company settings object (`model/company.js`); `savedBy` is `{id, name}` of the person, or `{id: "barnwright", name: "Barnwright (alan@...)", passId}` for a Barnwright save |
| `price-list-history/<version>` | `{version, savedAt, savedBy, changes:[text], settings}` (the version padded to 6 digits in the key) |
| `lots/<slug>` | `{slug, name, address, city, state, zip, phone, email, hours, website, embedOrigins[], active, createdAt, updatedAt}` |
| `people/<userId>` | `{userId, email, name, role, lots[], active, addedAt, addedBy, lastSeenAt}` |
| `invites/<sha256(email)>` | `{email, name, role, lots[], invitedAt, invitedBy}` |
| `customers/<id>` | the whole customer (below) |
| `lists/<slug>` | one row per customer of that lot, for lists, search and the Today screen |
| `counters/quote-number` | `{next}` — one counter for quote numbers, from 1001; an order keeps its quote's number |
| `website-requests/<hash>` | `{customerId, quoteId, fingerprint, receipt}` — makes a retried send safe |
| `limits/<slug>/<bucket>` | website send counts per lot (and per visitor) |
| `barnwright-help` | `{enabled, access, reason, approvedBy, grantedAt, expiresAt}` — the owner's "Run checks" switch as the control room confirmed it (connected businesses only; see "Help from Barnwright") |
| `barnwright-help-log` | `{entries: [{at, words, until?}]}` — the one log on the owner's Barnwright card, newest first: 100 kept, 10 shown; times are fields, never inside the words |
| `barnwright-help-asked` | `{<short code>: {pass, at}}` — Help questions of the last 9 minutes, so the same words sent again go with the same pass (a short code, never the words) |
| `barnwright-lot-slots` | `{open: {<link name, or pending:…>: at}}` — the open lots' places in the plan (see "Open lots") |
| `barnwright-setup` | `{prelive: "on"\|"stopped", enabled, reason, hours, grantedAt, expiresAt, approvedBy}` — the owner's change switch and setup stop (see "Barnwright setup access") |
| `barnwright-live` | `{live: true, liveAt, how}` or `{live: false, checkedThrough}` — whether the business is live; `how` is `opened`, `quote`, `order`, `website-quote`, `found-open`, `history`, `customers` or `unsure`; once live, never changed |
| `barnwright-setup-seen` | `{ids: {<pass id>: expiresAt}}` — setup passes already used |
| `barnwright-sessions` | `{<SHA-256 of the cookie>: {actor, passId, startedAt, lastAt, endsAt, mode, agreement, grantedAt?, ended?}}` — Barnwright visits (at most 20; ones past their end removed on each write); `mode`, `agreement` (`owner` or `signup`) and `grantedAt` say what the visit started under, `ended` that access closed since |
| `barnwright-signup-agreement` | `{termsVersion, termsSha256, signature, signedAt, at, passId}` — the owner's agreement from the Control Room's sign-up page, as the first pass that carried one that counts brought it; written once (create-only) and never changed; never a phone, email or business name (see "Before the owner first signs in") |
| `barnwright-setup-limits` | `{hour, requests, day, saves}` — Barnwright requests this hour and saves today |
| `barnwright-help-problems` | `{v: 2, day, team, public, repeats, visitors: {who: n}, seen: {signature: {at, last, extra}}}` — today's shares of the problem reports used (`who` is a visitor's address hashed with the day, never the address), and each kind passed on in the last 24 hours: when it first went, when its count last went, and how many more times it happened since (connected businesses only; see "Help") |

The Barnwright lease (the check-in's signed seven-day pass) is kept in a
store of its own, `barnwright-tenant-license-v1`.

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
| `GET me` | anyone | `{person, business, lots, signIn, account, terms, help}`; `person` is null until the person has access; `business` is null before setup, and for a login that isn't on the team (`person` null) it leaves out `phone`, `email` and `website`; `account` and `terms` are null unless the business is connected to Barnwright's control room (see "The business's Barnwright account"); `terms` is `{version, date, url, title, agreed}`, `agreed` null until the owner agrees to this version; `help` is `{connected, canAsk}` (null until the person has access), so the Help screen draws its Ask box at once; `setup` is `{mode, until}` for the owner and null for everyone else (see "Barnwright setup access"); `setupNeeded` is true for the owner until First setup is done, which includes a price list Barnwright started before the owner's first sign-in (`business` is then not null, and First setup skips the starting price list: see "Before the owner first signs in") |
| `POST setup` | first owner | `{businessName, phone, email, website, start: "full"\|"small", agreeTerms}` creates the price list (closed to customers until the owner opens it); a connected business needs `agreeTerms: true` ("Tick the box to agree to the Barnwright Terms and Conditions.") and the agreement is kept. When Barnwright already started the price list, `start` is left out: the business details are saved into it as the owner's change (only what differs) and the agreement is kept → 200 `{business}` (see "Before the owner first signs in") |
| `POST terms` | owner | `{agree: true}` agrees to the current Barnwright Terms and Conditions (an owner who set up before the box existed, or after the terms changed); works while changes are stopped too |
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
| `GET barnwright-help` | owner | `{help: {on, until, reason, log}, setup: {mode, until, why, live, liveAt, prelive, termsOk, termsOut}}`, both null when not connected to the control room |
| `POST barnwright-help` | owner | `{on: true, reason, hours: 1–24, level}`: `level` `"checks"` (left out too) lets Barnwright run checks, `"change"` also lets it change the price list and settings; `{on: false}` stops both at once; `{prelive: "stopped"\|"on"}` stops or allows setup access before live (see "Barnwright setup access") |
| `GET lots/:slug/preview` | lot access | the lot's 3D designer as a preview, as `GET /api/lots/:slug` plus `preview: true` and `closed` (`business`, `lot` or null), also while it is closed |
| `GET help` | everyone | `{connected, canAsk, items}`: the questions asked of Barnwright and Barnwright's answers, newest first (owner and managers every question from the business, a dealer their own); `items: null` with `problem` (plain words) when Barnwright can't be reached; `connected: false` when not connected to the control room; `canAsk: false` when Help isn't set up for it (the control room refusing its key included) |
| `POST help` | everyone | `{text, page, details: {browser, screen, language, timezone, errors}}` asks Barnwright (see "Help"); the asker is the person signed in, never the body; works while changes are stopped → `{ok, id, at, email}` (201) |

Barnwright's visit has routes of its own under `barnwright/`, signed in by
its cookie, never by Identity (see "The visit: Alan in their Dealer
Center").

Public routes (no sign-in):

| Route | Does |
|---|---|
| `GET /api/lots/:slug` | `{company, lot, version}` for the lot's 3D designer; 404 when the lot is closed or the business is not open yet |
| `GET /d/:slug/` | the lot's 3D designer page; when closed, a short "Our 3D designer isn't open right now" page that says who to call — the lot's phone when the owner closed the whole designer, the business's phone when only that lot is closed (`pages.js` `closedPage`) |
| `POST /api/lots/:slug/quote-requests` | `{design, contact, idempotencyKey}` → `{id, number, total, price, receivedAt, repriced}` (201; the same send again → the same receipt, 200) |
| `POST /.netlify/functions/tenant-diagnostics` | Barnwright's support check (control room only, with a support pass, while the owner has help turned on) |
| `POST /.netlify/functions/barnwright-setup` | Barnwright's setup door (control room only, with a setup pass; see "Barnwright setup access") |
| `POST /api/office/problem` | one browser error from a page on this site (`ui/problems.js`), same site only; a new kind passed on to Barnwright once in 24 hours, how many more times at most once an hour; a day's 30 shared out (10 new kinds from strangers, at most 3 from one visitor; 10 for the team signed in; 10 count updates); always `{ok: true}` (see "Help") |

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
someone opens it and its last check-in is more than six hours old,
every six hours on its own (`netlify/functions/barnwright-check-in.mts`),
and right after each production deploy succeeds
(`netlify/functions/deploy-succeeded.mts`), so a Dealer Center the Control
Room just made shows **Connected** within a minute (see "The check-in"
under "Barnwright setup access").
It reports how many lots are open and the site's main address
(`siteUrl`: Netlify's own `URL` setting, sent only when it is a plain https
address, with no path, user or port), and gets back a pass signed by the
control room, good for exactly seven days: the account is on or off, and
how many lots may be open. The control room fills in the business's Dealer
Center address from `siteUrl` the first time the site connects.
`server/office/control-room.js` is the control
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

**Help from Barnwright.** In Settings, Barnwright, the owner lets
Barnwright run checks for 1 to 24 hours, with a reason. The same card lets
Barnwright change the price list (see "Barnwright setup access"). The control room then sends a support pass
(at most 15 minutes) to `/.netlify/functions/tenant-diagnostics`; every
visit is checked online with the control room and against the owner's
switch here. The answer is how the Dealer Center runs (version, account
state, whether storage answers) and never customers, prices, settings or
keys. Turning help off stops it here at once, even if the control room
can't be reached. Each turn on, turn off and check is written in a short log
the owner sees under the switch.

**Settings** (Netlify environment variables: the Control Room's **Make
their Dealer Center** puts them on the business's site by itself, or, by
hand, Alan pastes them all at once from **Copy settings for Netlify** with
Netlify's **Import from a .env file**): `CONTROL_ROOM_URL`,
`CONTROL_ROOM_CUSTOMER_ID`, `CONTROL_ROOM_ACTIVATION_KEY` (secret,
Functions scope only), `CONTROL_ROOM_PUBLIC_KEY`, and optionally
`CONTROL_ROOM_SITE_ID` (Netlify's own site ID otherwise). None set: not
connected. Some but not all: nothing can be changed until they are all
there. One more, optional and normally left out: `BARNWRIGHT_HELP_URL`
(see "Help").

`npm run office -- --control-room` runs the local copy against a pretend
control room (`tools/lib/fake-control-room.mjs`, 3 open lots in its plan);
`tools/check-control-room.mjs` proves every rule above, and that leases
signed by the control room's own code (`test/control-room/leases.json`)
read the same way.

## Help

Alan's words (October 2026): a Help button inside the software (no phone
number), short help answers, and problem alerts. Barnwright drafts each
reply with Claude, and Alan approves it in his Sales Inbox.

* **The Help screen** (`#/help`): **Help** is in everyone's menu (under
  **More** on a phone) and at the top of every screen. It has 15 short
  answers with a search box (`ui/office/help-answers.js`: every button an
  answer names is checked against the screens), **Ask Barnwright** (a box
  and **Send**, saying what goes with the question), and **Your questions**,
  each "Waiting for an answer" or "Answered" with Barnwright's answers,
  newest first. The owner and managers see every question from the
  business; a dealer sees their own. After sending: "Sent. Barnwright will
  answer here and by email at <their email>."
* **A question** goes from the business's own server, never the browser:
  the control room gives a pass good for 10 minutes (`POST /api/help-pass`
  with the activation key; `control-room.js` `helpPass`), and the pass goes
  with the question to Barnwright's Sales Inbox (`POST /help/v1/ask`;
  `/thread` reads the answers, `/problem` takes a problem report), which
  checks it with the control room's public key. The asker is always the
  person signed in. With the question go only the page they came from (the
  screen, never which customer, order or quote) and these facts: the
  version, the business's name, its Barnwright account (on or off, why,
  lots allowed and open, the last check-in), how many lots are open and
  closed, how many people are on the team, whether email is set up,
  whether the price list is saved (and when), whether the 3D designer is
  open, and the browser's name, screen size, language, time zone and
  recent errors. Never customers, prices, the price list itself, orders,
  keys or passwords. Asking works while changes are stopped, and nothing a
  person typed is written to the log.
* **When it doesn't work**, the person reads why and what to do. Barnwright
  can't be reached (no answer, a 5xx, busy): "Barnwright couldn't be
  reached just now. Try again in a minute." The control room refuses the
  Dealer Center's key: "Barnwright hasn't finished setting up Help for your
  Dealer Center yet. Until then, email support@barnwrightsoftware.com."
  (and the Help screen shows that line instead of the box). The inbox
  refuses the question (another 4xx): "Barnwright couldn't take this
  question. Email it to support@barnwrightsoftware.com instead." An email
  the inbox can't write to: "Barnwright can't write back to the email you
  sign in with. Email your question to support@barnwrightsoftware.com
  instead." (a domain in other letters goes as the internet writes it,
  xn--…). Too many in one day for the business: "Barnwright has had a lot
  of questions from your business today. To ask more, email
  support@barnwrightsoftware.com." The list says calmly that the questions
  aren't showing, with **Try again**.
* **One time limit** (12 seconds) covers all of a request's calls
  together, so a slow control room and a slow inbox never add up; a
  dropped connection is tried again only with 2 seconds or more left. The
  same person sending the same words again within 9 minutes goes with the
  same pass (`barnwright-help-asked` keeps a short code, never the words),
  so a lost answer never makes a second question. A dealer's list asks the
  inbox for their own questions only (`askerId`), so theirs never drop out
  behind the team's. `GET me` says `help: {connected, canAsk}`, so the box
  shows at once and only the list waits.
* **Problem alerts.** The Dealer Center's screens and every 3D designer
  page (`ui/problems.js`) report an error nothing caught to
  `POST /api/office/problem` on their own site, and so do the failures a
  page catches to show its own words (`reportProblem`: "This page didn't
  load", a 3D designer whose settings or lot price list didn't load, a part
  that didn't start; an answer from the server is never one). The 3D
  designer starts watching before anything else (`ui/problems-start.js`,
  loaded by `index.html` just before `ui/app.js`, which imports it first
  too), so a script that didn't arrive, or one that broke as it started, is
  reported while the designer is still loading. At most 3 kinds a page
  load; a kind that keeps happening sends how many more times later, as
  its own report (when the page is put away or closed, or 10 minutes after
  it came back on a page left open); the message cut to 300 characters (only its first 1,000 read),
  with any email address, phone number, long code or query string taken
  out, in the browser and again on the server; where in the code (the script's
  path, line and column, no query string); the page's path (the screen on
  the Dealer Center; never the part after # on a 3D designer, which holds
  the customer's building); never anything a customer typed. The server
  sends a new kind (its `signature`) once in 24 hours; later reports of it
  are added up and their count goes at most once an hour (the Sales Inbox
  adds it to the same problem: "happened 40 times"), a count that didn't
  arrive going with the next. A day's reports are shared out so a stranger
  can't use them up: 10 new kinds from pages nobody signed in to, at most
  3 from one visitor (by address, hashed with the day); 10 more for the
  people signed in on the team; 10 count updates -- 30, what the Sales
  Inbox takes from one business a day (`barnwright-help-problems`). It
  always answers `{ok: true}`. A copy without that address (a 404) changes nothing for
  the page. Every page's security policy already allows it
  (`connect-src 'self'`).
* **Not connected** (Alan's own business, the local copy, the demo): its
  answers (those about a Barnwright plan, its notes and Help from Barnwright
  show only when connected; `help-answers.js` `when`), and instead of the
  box "Questions go straight to Barnwright from
  a Dealer Center Barnwright sets up. To ask from here, email
  support@barnwrightsoftware.com." Problem reports are dropped. A connected
  business with some settings missing is told Barnwright hasn't finished
  setting up Help yet, with the same email.
* **The setting** (optional, normally left out): `BARNWRIGHT_HELP_URL`, the
  Sales Inbox's address, `https://inbox.barnwrightsoftware.com` when left
  out. https only, with nothing after the name; plain http only for
  localhost while running `netlify dev` on a computer.

`npm run office -- --control-room` comes with a pretend Sales Inbox
(`tools/lib/fake-help-inbox.mjs`); `POST /__local/help-inbox` with
`{answer: "words"}` answers the newest question still waiting.
`tools/check-help.mjs` proves every rule above against a pretend control
room and inbox; `tools/check-dealer-center.mjs` asks and answers in
Chromium.

With `--control-room`, `POST /__local/barnwright` tries Barnwright setup
access on the computer: `{terms: "2.2"}` records the owner's agreement to
terms 2.2, and `{visit: true}` answers `{url}`, a `/dealer#barnwright=...`
address with a fresh pass from the pretend control room (what **Open their
price list** opens). `{door: {action: "status"}}` (any door request's
body) answers `{door: {pass, body}}`: a pass made for exactly that body, to
send to the door at `POST /.netlify/functions/barnwright-setup` on the same
computer (add `via: "claude"` for a pass as Claude's). Add `signup: true`
(beside `visit` or `door`) for a pass that carries the pretend owner's
sign-up agreement to the terms this copy ships, as the Control Room sends
for a customer who signed up; with no owner signed in yet, that is how to
try "Before the owner first signs in" on the computer. While terms 2.2
aren't out, start the local copy with `--terms-version 2.2` so it acts as
if it shipped them (the checks do the same with the `termsVersion`
option of `createOffice`).
`tools/check-setup-access.mjs` proves the server's rules (the door's too)
and `tools/check-setup-screens.mjs` clicks through the owner's card, the
preview and a visit in Chromium.

## Barnwright setup access

<!-- THE CONTRACT for Barnwright changing a business's price list and
     settings: the door the Control Room calls, the pass, the edits, the
     visit in Alan's browser, the owner's card and the check-in. The
     Dealer Center side is built here; the Control Room builds against
     tools/lib/setup-fixtures.json (made by tools/lib/make-setup-fixtures.mjs),
     which holds an example of every request and answer below. Change this
     section and the fixtures together, then tell the Control Room. -->

Alan's words (October 2026): "I get access to change thing from control
room until it goes live and then in the owner setting they can turn switch
on to give me access."

In short:

* **Before the business is live**, Barnwright can change its price list and
  settings with no switch. This is how Alan sets a new business up.
* **Before the owner first signs in**, too: as soon as Alan taps **Make
  their Dealer Center**, Barnwright can start the price list from Alan's
  photos (Alan by hand in the visit, or Claude through the Control Room),
  using the terms the owner agreed to on the Control Room's sign-up page.
  The owner finds it ready the first time they sign in.
* **After it is live**, Barnwright can change them only while the owner's
  switch is on (Settings, Barnwright, "Run checks and change my price list
  and settings"), for 1 to 24 hours.
* Barnwright gets in two ways, and both follow the same rules: **the door**,
  which Alan's Control Room (and Claude, through the Control Room) calls from
  its server, and **the visit**, where Alan works in this Dealer Center's own
  price list screens in his browser.
* Every change is listed for the owner (Settings, Barnwright, and Price
  list, History) and can be put back. Nothing here emails, texts or calls
  anyone: the setup code is given no way to send anything.
* The Dealer Center decides. The Control Room only asks, and only for Alan.
* Nothing works until the owner has agreed to the Barnwright Terms and
  Conditions 2.2 or later: in the Dealer Center, or, until they first sign
  in, on the Control Room's sign-up page. Until terms 2.2 come out, every
  request is refused with `why: "terms"`.

The words people read: the owner reads "Barnwright can change your
prices"; Alan reads "You can change their prices".

### When Barnwright may change things

`access()` is worked out on every Barnwright request (door and visit), from
this Dealer Center's own records. It never asks the Control Room, so it
works when the Control Room is down. It checks, in this order, and stops at
the first that applies:

1. Not connected to the Control Room, or some settings missing: the door
   answers 404 (`not-connected`).
2. No price list yet, and an owner has signed in (First setup is theirs to
   finish) or no sign-up agreement came with the pass or is remembered:
   closed, `no-price-list`.
3. The agreement. An owner has signed in: they must have agreed to terms
   2.2 or later in the Dealer Center, else closed, `terms`. No owner has
   signed in yet: the owner's sign-up agreement must count (see "Before
   the owner first signs in"), else closed, `terms` (this Dealer Center's
   own terms are older than 2.2), `signup-terms` (they signed up under
   terms older than 2.2) or `signup-unknown` (they signed up under terms
   this Dealer Center doesn't have).
4. The owner's switch is on and not past its end: `switch`, until its end.
5. The business is live (below): closed, `live-off`.
6. The owner stopped setup access: closed, `stopped`.
7. Otherwise: `prelive`, with no end (it lasts until the business is live).
   Before a price list exists, `prelive` means Barnwright can start it.

"An owner has signed in" means the first owner's claim (`setup`) exists: it
is written at the owner's first confirmed sign-in, before First setup.

What Alan and Claude read for each `why` (the door sends it as `error`):

| why | words |
|---|---|
| `no-price-list` | The owner hasn't finished First setup yet, so there is no price list to change. |
| `terms` | The owner hasn't agreed to the Barnwright Terms and Conditions 2.2 yet. They tick the box in First setup, or tap the button at the top of their Dealer Center. |
| `signup-terms` | They signed up before the Barnwright Terms and Conditions 2.2, so you can't start their price list yet. They agree to the new terms when they first sign in to their Dealer Center. |
| `signup-unknown` | Their Dealer Center doesn't have the terms they signed up under yet, so you can't start their price list. It gets the newest terms with its next deploy. |
| `stopped` | The owner stopped Barnwright's setup access in Settings, Barnwright. |
| `live-off` | Their 3D designer is open to customers, so you need the owner's switch. Ask the owner to turn on Run checks and change my price list and settings in Settings, Barnwright. |

An owner who has just signed in is in First setup, where the terms are a
box to tick, even when Barnwright already started their price list; the
button at the top of the Dealer Center comes only after First setup. So the
words for `terms` name both places, and so does the visit that ends when
the owner first signs in (the Control Room says the same, `OWNER_TERMS`).

Until this Dealer Center's own terms (`TERMS.version`) are 2.2 or later, no
owner can agree to them and no sign-up agreement counts, so `why: "terms"`
says instead: "Barnwright's new terms (2.2) aren't out yet, so Barnwright
can only run checks for now." The status fields' `termsOut` says which.

Saving also needs the business's Barnwright account to allow changes (the
lease, `account.mustWrite()`). When it doesn't, a save answers 423 and
reading still works.

### Live

A business is **live** from the first of these, and stays live for good:

* the owner opens the 3D designer to customers (a price list save whose
  status isn't `suspended`). Only the owner can: Barnwright can never
  change `status`;
* the first real quote or order is saved: `customers.addQuote`,
  `customers.addOrder`, or a quote request from a lot's 3D designer. A
  Dealer Center has no example or practice customers, so every one counts.

The record `barnwright-live` is written **before** the change that makes
the business live: before the price list is replaced, and before the quote
or order is written. If that change then fails, the business still counts
as live, which is the safe way round. Once `live` is true it never changes.

On every Barnwright request, `access()` also counts the business as live
when the current price list's status isn't `suspended`, or when a history
entry newer than `checkedThrough` has a status that isn't `suspended` (it
reads only those, then moves `checkedThrough` on).

**Businesses set up before this shipped.** The first time it's needed, the
Dealer Center looks back. Live if the 3D designer is open now, or any
`price-list-history/` entry isn't `suspended`, or any `customers/` record
has a quote or an order. More than 500 history entries or 500 customers to
look through, or any read that fails: live (`how: "unsure"`). Nothing
found: `{live: false, checkedThrough: <current version>}`. First setup
writes `{live: false, checkedThrough: 1}` straight away. What the look back
finds is written quietly, with `liveAt: null`: nobody knows when it went
live.

The owner's log says "Barnwright's setup access ended when ..." only when
the record said `{live: false}` before (the business was known to be
setting up). The owner's first save or quote after this ships, in a
business that has no record yet, looks back first, so an owner whose 3D
designer was open long ago is never told today that setup access ended.
Going live ends every Barnwright visit at once.

The look back runs only inside `access()` (Barnwright requests), before a
business with no record goes live, and in the scheduled check-in function
(`netlify/functions/barnwright-check-in.mts`, `scheduledCheckIn`: the
check-in goes first, so the lease always renews; then the look back, in its
own try, for at most 5 seconds). Never inside the check-in itself and never
in `GET me`, so it can't slow down or break a lease renewal or the owner's
page.

### The preview

A closed 3D designer can be looked at without opening it. The owner and the
team (signed in, for the lots they can see) and a Barnwright visit see a
lot's 3D designer as a **preview**, with a bar on top: "Preview. Your
customers can't see this until you open it in Settings." When the business
is open and only that lot is closed, the bar says: "Preview. Your customers
can't see this lot until you open it in Lots."

* `GET /api/office/lots/:slug/preview` (the team) and
  `GET /api/office/barnwright/lots/:slug/preview` (the visit) answer like
  `GET /api/lots/:slug`, plus `preview: true` and `closed` (`"business"`
  when the whole 3D designer is closed, `"lot"` when only that lot is, null
  when it is open), also while the 3D designer or that lot is closed.
* The pages: `/d/<lot>/?preview=1` (the team; the Lots screen's and the
  closed banner's **Look at the preview**) and `/d/<lot>/?preview=barnwright`
  (the visit). Each serves the lot's 3D designer page even while it is
  closed, and the page loads the preview answer above instead of the
  customers' one. Nobody else gets a preview: without the sign-in or the
  visit's cookie the answer is a 401 and the page says to sign in to the
  Dealer Center first.
* A preview has no Send: a quote can't come from it. Customers still get
  the closed page. Opening has no grace period: once open, Barnwright needs
  the owner's switch.
* While Barnwright is setting up (`prelive`), the owner's closed banner
  says: "Barnwright is setting up your prices. Look at the preview, check
  it with Alan, then open it to customers in Settings."
* Adding a New Customer (`tools/legal/make-legal-pdfs.py`) checks the
  buildings and prices with the owner on the preview, before opening.

### The pass

Every door request carries a pass, and so does the start of a visit. The
Control Room makes a pass for one request and signs it with its license key
(`LICENSE_PRIVATE_KEY`, ECDSA P-256). The Dealer Center checks it offline
with `CONTROL_ROOM_PUBLIC_KEY`, which every connected Dealer Center already
has. No new key, secret or webhook.

**Format:** `<head>.<signature>`

* `head` is the claims as JSON, in base64url with no padding.
* `signature` is the ECDSA P-256 SHA-256 signature in IEEE P1363 form
  (exactly 64 bytes), base64url, over the ASCII text
  `barnwright-setup-pass/v1.` followed by `head`.
* The whole pass is at most 8,000 characters and is two base64url parts
  joined by one dot.

The prefix keeps it apart from everything else the same key signs: leases
(canonical JSON), support passes (the bare body) and help passes
(`barnwright-help-pass/v1.`). `/` and `.` never appear in base64url, so no
other signed text can start with this prefix.

**Claims**, in this order:

```
{ "v": 1, "purpose": "setup-pass",
  "id": "<16 random bytes, base64url: 22 characters>",
  "customerId": "...", "siteId": "...",
  "actor": "alan@...",
  "via": "control-room" | "claude",
  "action": "status" | "read" | "check" | "save" | "undo" | "session",
  "bodySha256": "<lowercase hex SHA-256 of the exact request body bytes>",
  "issuedAt": <ms since 1970>, "expiresAt": <ms since 1970>,
  "signup": { "termsVersion": "2.2", "termsSha256": "<64 lowercase hex>",
              "signature": "Pat Owner", "signedAt": "<ISO time>",
              "business": "Testing Sheds", "phone": "941-555-0100",
              "email": "pat@testingsheds.example" } }
```

* `customerId` and `siteId` are the business's, the same as this Dealer
  Center's own (`CONTROL_ROOM_CUSTOMER_ID`, `CONTROL_ROOM_SITE_ID`).
* `actor` is who asked: Alan's Control Room sign-in. It is written in the
  owner's log and in the price list history.
* `via` is `control-room` when Alan tapped a button on a Control Room page
  (the customer's panel, the Make the change page), and `claude` when the
  Claude connector sent the request without that tap.
* `signup` (optional, always last) is the owner's agreement from the
  Control Room's sign-up page, with the business name, phone and email
  they gave there. The Control Room puts it on every setup pass for a
  customer who signed up on that page, and leaves it out otherwise. What
  the Dealer Center does with it is in "Before the owner first signs in".

**The Dealer Center refuses a pass** (401, code `pass`) when:

* it isn't a string of the right shape, or is over 8,000 characters;
* the signature isn't 64 bytes, the key isn't P-256, or the signature
  doesn't check out over the prefix and `head`;
* the claims aren't an object with `v: 1` and `purpose: "setup-pass"`, an
  `id` of 16 to 64 base64url characters, an `actor` of 1 to 200 characters
  with no control characters, and a known `via` and `action`;
* `customerId` or `siteId` isn't this business's;
* `expiresAt - issuedAt` is over 5 minutes, or `issuedAt` is more than 60
  seconds ahead (the same allowance as `license-core.js`
  `MAX_FUTURE_SKEW_MS`), or the pass has expired by `license.clock()`,
  which never goes back;
* `action` isn't the request's (the door: `body.action`; a visit's start:
  `session`);
* `bodySha256` isn't the SHA-256 of the exact body bytes;
* `signup` is there but isn't an object with exactly these seven keys:
  `termsVersion` a version (1 to 4 whole numbers of 1 to 4 digits, with
  dots: `2.2`), `termsSha256` 64 lowercase hex characters, `signature` 1
  to 200 characters, `signedAt` an ISO time (ending in `Z` or an offset, at
  most 50 characters) no later than 60 seconds after `issuedAt`,
  `business` 1 to 80 characters, `phone` 0 to 40 and `email` 0 to 200
  characters (no control characters in any of them, and `signature` and
  `business` not only spaces). A sign-up that doesn't fit is left out by
  the Control Room, never cut to fit.

The answer never says which; the reason goes in the function log.
`checkSetupPass()` in `tools/lib/make-setup-fixtures.mjs` is this rule
written out, and both ends must agree with it on every pass in the
fixtures.

**One use.** Once a pass gets through those checks, its `id` is spent
before the action runs: `barnwright-setup-seen` holds
`{ids: {<id>: expiresAt}}`, written with a conditional write, with expired
ids taken out on each write. The same pass again answers 410
(`pass-used`), even when its first use was refused for another reason.

**Lifetime.** The Control Room makes each pass good for 2 minutes, for one
request, and never sends a request twice. A request that timed out after it
was sent is not sent again: the Control Room asks `status` and looks at
`lastBarnwrightSave.passId` to see whether the save landed.

### The door

`POST https://<their site>/.netlify/functions/barnwright-setup`

A fixed function address, like `tenant-diagnostics`: the `/api/office/`
routes need the site's own Origin on every change, and the door is server
to server.

**The request:** `Authorization: Bearer <pass>`,
`Content-Type: application/json`, and a JSON object body of at most 64 KB,
with the same limits as every Dealer Center body (24 levels deep, 20,000
values, no `__proto__`, `constructor` or `prototype` keys). `body.action`
is the pass's `action`. No `Origin` and no `Cookie` header. The door never
sends CORS headers.

**The order of checks.** The door answers the first that fails:

1. not connected, or some settings missing: 404 `not-connected`;
2. not POST: 405 `method`;
3. an `Origin` or `Cookie` header, or not `application/json`: 400
   `bad-request`;
4. over 64 KB: 413 `too-big`;
5. not a JSON object within the limits, or an action the door doesn't
   have: 400 `bad-request` (a request refused here or above doesn't spend
   its pass);
6. the pass: 401 `pass`, or 410 `pass-used`;
7. the limits: 429 `too-many`. At most 120 Barnwright requests an hour
   (door and visit together) and 60 saves a day (door saves, undos, visit
   saves and put backs together);
8. the action, below. A body the action can't read (a `part` that isn't
   one of the list, a `version` that isn't a whole number, `undo` that
   isn't `true`, or both `edits` and `undo`) is 400 `bad-request`, with the
   status fields.

**Every answer** is JSON with `Cache-Control: private, no-store`. A success
is `{ok: true, ...}`. A refusal is `{ok: false, code, error, ...}`, where
`error` is one plain sentence Alan and Claude can repeat as it is. Every
answer to a pass that got through step 6 also carries **the status
fields**, refusals included, so the Control Room always learns the state:

```
{ "v": 2,
  "live": false, "liveAt": null,
  "access": "prelive", "why": null, "until": null,
  "prelive": "on", "termsOk": true, "termsOut": true, "agreement": "owner",
  "priceList": {"version": 1, "savedAt": "<ISO time>", "by": "the owner", "open": false},
  "lastBarnwrightSave": null,
  "canUndo": false,
  "appVersion": "dealer-center <deploy>" }
```

* `v` is 2 from "Before the owner first signs in" on: a Dealer Center
  that says 2 takes the pass's sign-up agreement and starts a price list
  at version 0. One that says 1 has no `agreement` and never does.

* `access` is `prelive`, `switch` or `closed`; `why` is null unless
  closed; `until` is the switch's end, or null.
* `liveAt` is an ISO time once live (null when the look back found it
  live: nobody knows when). `prelive` is `on` or `stopped`.
* `termsOk`: the owner agreed to terms 2.2 or later in the Dealer Center
  (a sign-up agreement never makes it true). `termsOut`: this Dealer
  Center's own terms are 2.2 or later, so the owner can agree.
* `agreement` is what setup access stands on: `owner` (the owner's own
  agreement, `termsOk`), `signup` (no owner has signed in yet and their
  sign-up agreement counts), or null (neither).
* `priceList` is null while there is no price list (before First setup,
  or before Barnwright starts it). `open` is whether customers can use the
  3D designer now.
* `by` names who saved by role, never by name or email: "the owner",
  "a manager", "Barnwright (alan@...)" (the pass's actor), or "someone no
  longer on the team". The same goes for every `by` in history.
* `lastBarnwrightSave` is `{version, passId, at}` of Barnwright's newest
  save, looked for in the price list and its 20 newest history entries.
* `canUndo` is true while the current version is a Barnwright save with a
  version before it (the starting price list Barnwright made, version 1,
  has none).

#### status

`{"action": "status"}`. Always answered for a connected Dealer Center,
whatever `access` is, and also while its account is off. Only the status
fields: no prices, no settings.

#### read

`{"action": "read", "part": "buildings"}`, `part` one of the list below
(`summary` when left out). Needs access open. Works while the account is
off. Answers the status fields plus `part`, `view` and `history`: the
newest 20 saves,
`[{version, savedAt, by, changes (the first 5), more}]`. The owner's log
gets "Barnwright looked at your price list." at most once every 30 minutes.

| part | view |
|---|---|
| `summary` | `business` (below), `styles` sold `[{code, name, sizes, from}]`, `counts` `{styles, sizes, items, options, extras}`, `colors` (how many of each), `show`, `rentToOwn` (true or false), `open` |
| `buildings` | `groups [{name, styles: [codes]}]`; `styles [{code, name, builtLike, roof, pitch, sizes: {"10x16": 5540}}]` in group order; `opensOn {style, size}`. `pitch` is `"N/12"` for a gable roof that can change (see `set_roof_pitch`) when the business set its pitch in How it's built (on that style, on the style it is built like, or for the whole business), `"standard"` when it didn't, else null |
| `doors_windows` | `items [{code, name, price}]`, the ones they sell |
| `options` | `dormers`, `ramps`, `elec`, `misc`, `rates` as `[{key, name, price}]` (`rates` add `per`: "sq ft of floor", "wall" or "roof"); `extras [{key, name, charged, price}]` |
| `colors` | `paint`, `trim`, `metal` as `[{name, hex, own}]` in order; `opensOn {body, trim, roof}` |
| `prices_and_quotes` | `show`, `finePrint`, `sizeNotes`, `rentToOwn` (`{terms: [{months, factor}], showTerm, note}` or null), `quoteForm {fields, askPlan, smsConsent}`, `business` with `initials` and `colors` |
| `library` | the builder's `styles [{code, name, roof, group, sold, built}]`, `items [{code, name, sold}]`, `options {group: [{key, name}]}`, `colors {group: [{name, hex}]}` and `gableStyles`: codes and names, no prices. `built` is each style's How it's built numbers (below) |

Before a price list exists (`priceList: null`, access open), `read`
answers the parts of the starting price list the first save would make,
with `history: []` (see "Before the owner first signs in").

Each library style's `built` lists the How it's built numbers that apply to
it, so Claude can compare a dealer's building in a photo with the drawing
(the roof, the walls, the doors) and knows what `set_built` would change:
`[{setting, name, now, standard, from}]`, for example

```
{"setting": "wallHeight", "name": "Wall height", "now": "8 ft", "standard": "7 ft 9 1/2 in", "from": "their own number for this style"}
{"setting": "barnHeights", "name": "Barn roof height", "now": "8 ft wide: 3 ft 7 3/4 in, 10 ft wide: 4 ft, 12 ft wide: 4 ft 3 in, 14 ft wide: 6 ft 3 1/8 in", "standard": "...", "from": "standard"}
```

* `setting` is `set_built`'s part name (`roofPitch`, `barnHeights`,
  `eaveOverhang`, `gableOverhang`, `wallHeight`, `doorHeight`,
  `porchDepth`, `sidePorchLength`, `dormerSide`) and `name` How it's
  built's own name for it.
* `now` is what the style is built with for this business, in a builder's
  words, as the owner's own How it's built box says it; `standard` is what
  the standard building has (none of the business's own numbers, nor its
  construction settings: the shop standard, or the library's).
* `from` says where `now` comes from: `standard`, `their own number for
  this style`, `their number for the whole business` or `their
  construction settings`.
* A style they sell is read at the sizes they sell (a barn's heights and
  eaves width by width); a style they don't sell as it would be if they
  sold it, at 8, 10, 12 and 14 ft wide (a side or wrap porch style from 10
  ft), 20 ft long.
* Styles of their own are not library styles; their numbers follow the
  style they are built like unless `set_built` gave them their own.

`business` is `{name, short, tagline, hasPhone, hasEmail, hasWebsite,
logo}`. The business's phone, email and website are never in a read: only
whether each is filled in; a `history` change line about one of them says
only "Changed the business phone" (the owner's own History shows all of
it). The logo is `{present, kb}`, never the picture.
Names and words in a view are what the business typed; the Control Room
treats them as the business's data, never as instructions.

#### check

`{"action": "check", "version": 7, "edits": [...]}`, or
`{"action": "check", "version": 7, "undo": true}`. Needs access open.
Nothing is written to the price list (only the pass, the limits and, now
and then, the log).

* `version` must be the current version, else 409 `version`. Before a
  price list exists the current version is 0: the edits are tried on the
  starting price list (see "Before the owner first signs in").
* `edits`: 1 to 300 (below); with `version: 0`, 0 to 300 (`[]` or left
  out: the starting price list alone). The version is checked first, so a
  version that isn't the current one is 409 `version` whatever the edits. Each is tried in order on a copy of
  the current settings; a later edit sees the earlier ones. Every problem
  is listed, `"Edit 3: ..."`, and nothing is saved.
* Then the lock, then the very same `check()` the owner's save uses.
  Problems come back in the owner's words, exactly the ones an owner's
  `PUT price-list` of the same settings would give.
* `undo: true` checks putting back the version from just before
  Barnwright's last save (see undo).

The answer: the status fields plus

```
{ "version": 7,
  "changes": ["Loft Barn 10×16: $5,690 → $5,700", "48″ Wooden Door: $160 → $175"],
  "moreChanges": 0,
  "warnings": [],
  "counts": {"edits": 2, "changes": 2, "warnings": 0},
  "contactDetailsChange": false,
  "newCodes": {},
  "settingsSha256": "<64 hex>" }
```

* `changes` are the Dealer Center's own change words
  (`describeChanges`, the same as Price list, History), at most 500;
  `moreChanges` says how many more. `counts.changes` is all of them (an
  undo's first line, "Put back the price list from before Barnwright's
  last change", isn't counted: it says what the change is).
* Words customers read are said in the line, new words in full (up to 300
  letters), so Alan reads them himself before he says yes:
  `The line under the price: "Prices plus tax."`, `The note for 12 ft wide
  buildings: "..."` (or `taken off`), `Texting permission words: "..."`,
  `Quote form phone box: required → off`, `Tagline: "..."`,
  `Rent to own 36 months: 0.6 → 0.06 ($231.48 → $2,314.81 a month on
  $5,000)`, `Gutters: $5 a foot → 5% of the building price`,
  `New building group "..."`. Every line stays under 400 letters.
* The business phone, email and website the owner typed are never in a
  door answer: `Phone: changed to 941-555-0199` (an edit wrote it),
  `Phone: taken off`, and for an undo only `Phone: changed`. The owner's
  own History says them in full (`Phone: 941-555-0100 → 941-555-0199`).
* `warnings`: see Warnings.
* `contactDetailsChange` is true when the business phone, email or website
  changes.
* `newCodes` gives the code of each new style of their own:
  `{"Premium Loft Barn": "LB1"}`.
* `settingsSha256` is the lowercase hex SHA-256 of `JSON.stringify` of the
  exact settings the save would store (cfg worked out). The Control Room
  only passes it back.

#### save

`{"action": "save", "version": 7, "edits": [...], "settingsSha256": "..."}`.
Needs access open and the lease (423 `account-off`). While the owner's
switch is on (`access: "switch"`), the pass must be `via: "control-room"`:
Alan tapped Make the change in the Control Room. A `claude` pass is refused
(403 `needs-alan`). Before live, either is fine.

1. The same edits on the same version, the lock and `check()`, as in check.
2. The result's hash must equal `settingsSha256`, else 409 `changed`.
3. The current version's history entry is written first if it is missing.
   If that fails, nothing is saved: 503 `no-copy`.
4. The price list is saved with
   `savedBy: {id: "barnwright", name: "Barnwright (<actor>)", passId}`, by
   the same conditional write as the owner's save (409 `version` if someone
   saved first). History shows "by Barnwright (alan@...)".
5. The owner's log gets one line.

The answer: the status fields plus `{versionBefore, version, changes, newCodes}`.

With `version: 0` (no price list yet), the save first makes the starting
price list as version 1 (a create-only write), then saves the edits as
version 2; `versionBefore` is 0 (see "Before the owner first signs in").

#### undo

First a check with `undo: true`, then
`{"action": "undo", "version": 8, "settingsSha256": "<from that check>"}`.
Needs what save needs, including `via: "control-room"` while the switch is
on.

* It works only while the current version is a Barnwright save
  (`savedBy.id === "barnwright"`). Otherwise 409 `cant-undo`: "The owner
  saved the price list after your change, so undo would take theirs away
  too. The owner can put back an earlier price list in Price list,
  History." When Barnwright never saved (or there is no price list yet):
  "Barnwright hasn't changed this price list, so there is nothing to
  undo." At the starting price list Barnwright made (version 1): "This is
  the starting price list Barnwright set up, so there is nothing before it
  to put back." When the copy from before is
  missing from the history (it is always kept first, so this is only a
  history removed by hand): "The copy from before Barnwright's last change
  is gone, so it can't be put back here. The owner can put back an earlier
  price list in Price list, History."
* It puts back the history entry of the version before, with the current
  values of the locked parts carried forward (`carryLocked`), then the lock
  and `check()`, then the same steps 2 to 5 as save.
* The first change line is "Put back the price list from before
  Barnwright's last change", then the differences.
* An undo is a Barnwright save, so undo again puts the change back.

The answer: the status fields plus `{versionBefore, version, changes}`.

#### Refusals

| status | code | error |
|---|---|---|
| 400 | `bad-request` | The Control Room sent a request this Dealer Center can't read. |
| 401 | `pass` | The pass for this request isn't valid. Try again from the Control Room. |
| 403 | `closed` | the words for `why` (the answer has `why`) |
| 403 | `needs-alan` | Their 3D designer is open, so this change has to be made from your Control Room's Make the change page. |
| 404 | `not-connected` | This Dealer Center isn't connected to Barnwright. |
| 405 | `method` | Use POST. |
| 409 | `version` | The price list was saved since you read it. Read it again, then check the change again. |
| 409 | `changed` | The result isn't the one you checked. Check the change again. |
| 409 | `cant-undo` | see undo |
| 410 | `pass-used` | This pass was already used. Each request needs a new pass. |
| 413 | `too-big` | That request is too big. Send at most 64 KB. |
| 422 | `problems` | the problems joined (the answer has `problems: [...]`) |
| 423 | `account-off` | Their Dealer Center can't save changes right now: its Barnwright account is off or hasn't checked in for 7 days. Reading still works. |
| 429 | `too-many` | Too many Barnwright requests for this Dealer Center this hour. Try again later. (Saves: "Barnwright has saved 60 changes here today. Try again tomorrow.") |
| 503 | `no-copy` | Couldn't keep a copy of the current price list first, so nothing was changed. Try again. |
| 503 | `error` | Something went wrong on their Dealer Center. Try again in a minute. |

A Dealer Center older than this answers the door's address with a plain
404 that has no `code`: the Control Room says "Their Dealer Center needs
the newest version. It updates on its next deploy." While access is open,
a refused save, undo, or a change the lock refuses puts one line in the
owner's log, at most once a minute, always in the owner's own words and
never the words for Alan above:

| Refused | The owner's log says |
|---|---|
| `needs-alan` (a Claude save while the owner's switch is on) | Barnwright tried a change that needs Alan's OK in his Control Room first. Nothing was changed. |
| the lock (a part only the owner may change) | Barnwright tried to change something only you can change. Nothing was changed. |
| anything else (`version`, `changed`, `cant-undo`, `problems`, `account-off`, `no-copy`) | Barnwright tried a change that couldn't be saved. Nothing was changed. |

### The edits

Claude, through the Control Room, sends **edits**, not whole settings. The
Dealer Center applies them to its own copy with its own library, rules and
change words. Codes come from `read` part `library` and part `buildings`.
Every edit is an object with `do` and only the parts listed for it below:
an edit with any other part is refused ("Edit 3: prise isn't part of
set_price."), so a typo never goes unnoticed. The Control Room keeps its
own notes (`source`, `checked_by_alan`) out of the edits it sends. Text
limits: names at most 60 characters (a business name 80, as at First
setup), other text at most 300, no control characters. Prices are 0 to
1,000,000 with at most 2 decimals; a building size's price is above 0.
Sizes are `"WxL"` in whole feet, width 4 to 16, length 4 to 60.

**Buildings**

* `set_price {style, size, price}`: a style they sell. A size they don't
  have yet is added, in width then length order.
* `remove_size {style, size}`. Not the style's last size: "Edit 3: 14×28
  is the Garage's last size. Stop selling the style instead."
* `sell_style {style, name?, group?, sizes}`: a library style. `sizes`
  (at most 60) replaces the style's whole size list, in the order given,
  and turns it on. `group` is a group's name; a new name makes a new group
  at the end. Left out, the style goes where the owner's screen would put
  it.
* `add_own_style {built_like, name, group?, sizes}`: a style of their own,
  built like a library style. The Dealer Center picks the code the way the
  owner's screen does (the base and the lowest free number: `LB1`) and
  gives it back in `newCodes`. Left out, `group` puts it right after the
  style it is built like.
* `stop_selling_style {style}`. A group left empty goes. If the 3D designer
  opened on that style, it opens on the first style still sold.
* `rename_style {style, name}`: the name customers see.
* `change_prices {scope, by_percent | by_dollars, round_to}`: the owner's
  Change prices rule. `scope` is `{style}`, `{group}` or `{all: true}`;
  every size price in it moves by the percent or dollars (negative lowers),
  rounds to the nearest `round_to` (1, 5, 10 or 25), and never drops below
  `round_to`. Lowering by 100% or more is refused.
* `set_built {style, roofPitch?, barnHeights?, eaveOverhang?, gableOverhang?,
  wallHeight?, doorHeight?, porchDepth?, sidePorchLength?, dormerSide?}`:
  a building style's own numbers in How it's built, see How it's built.
* `set_roof_pitch {style, pitch}`: the short form of `set_built {style,
  roofPitch}`, with its own stricter limits, see Roof pitch.

**Doors, windows and options**

* `set_item {item, price, name?}`: starts selling it if they don't.
  With `name`, it is stored `{price, name}`.
* `stop_selling_item {item}`. Not one that comes standard on a style they
  sell: "Edit 1: The 72″ Wooden Double Doors comes with the Utility Shed
  and the Loft Barn, so it stays sold."
* `set_option {group, key, price, name?}`: `group` is `dormers`, `ramps`,
  `elec`, `misc` or `rates` (`rates` are per square foot).
* `stop_option {group, key}`.
* `set_extra {key?, name, charged, price}`: `charged` is `check`, `qty`,
  `lf`, `sqftF`, `sqftW`, `sqftR` or `pct`. With `key`, that extra changes;
  without, a new one gets a key made from its name (lower case, dashes:
  "Gutters" is `gutters`; `-2`, `-3` when taken). An extra that changes how
  the building is built (its `construction`, see The lock) keeps that
  effect exactly: no edit can give an extra one or change it.
* `remove_extra {key}`. Not an extra that changes how the building is
  built (the lock refuses it).
* `set_colors {which, colors}`: `which` is `paint` (siding), `trim` or
  `metal` (roof). 1 to 40 colors; the list replaces the whole list, in
  order. A library name turns that swatch on; `{name, hex}` is a color of
  their own (stored `[name, hex]`).

**How prices and quotes show**

* `set_defaults {style?, size?, colors?: {body?, trim?, roof?}}`: what the
  3D designer opens on. `style` must be one they sell; a size or color
  they don't have is refused by the owner's own check, in the owner's
  words. A new style alone keeps the size if that style has it, else its
  first size.
* `set_price_display {show}`: `price`, `from` or `none`.
* `set_fine_print {text}`: the line under the price.
* `set_size_note {width, text}`: the note for one width; `text: null`
  removes it.
* `set_rent_to_own {terms, show_term?, note?}`: `terms` is
  `[{months, factor}]` (months 1 to 120, factor above 0 and at most 1),
  stored as `pricing.rto.factors`; `terms: null` turns rent to own off.
  `show_term` must be one of the months, or null. `note` is the words under
  the rent-to-own price, or null.
* `set_quote_form {fields?, ask_plan?, sms_consent?}`: `fields` sets
  `phone`, `email`, `zip`, `address` or `note` to `required`, `optional` or
  `off` (the name is always asked); `sms_consent` is the texting permission
  words, or null not to ask.

**The business**

* `set_business {name?, short?, tagline?, phone?, email?, website?}`.
  Before live, all of them. While the owner's switch is on, `phone`, `email`
  and `website` are refused: "While their 3D designer is open, the business
  phone, email and website can be changed only by the owner, or by Alan by
  hand in Open their price list." A contact change is always warned first.
* `set_brand_colors {header?, primary?, accent?}`: hex colors (`#1f2a24`).

The logo is never an edit: Alan uploads it by hand in the visit.

**How it's built** (`set_built`). A building style's own numbers in How
it's built (`offer.<code>.built`, `model/build-settings.js`), written the way
the owner's own How it's built boxes write them, so Claude can make a
dealer's building match the photos: its roof, its walls, its doors.

```
{"do": "set_built", "style": "UT", "roofPitch": "6/12", "wallHeight": "8 ft", "doorHeight": "80 in"}
```

| Part | How it's built | Written like | Applies to |
|---|---|---|---|
| `roofPitch` | Roof pitch | `"5/12"`, `"5 1/4/12"` (quarter steps) | gable, lean-to and single slope roofs (a metal gable roof 4/12 to 12/12, any other gable 3/12 to 12/12; lean-to 1 1/4/12 to 6/12; single slope 2/12 to 8/12); the Dormer Shed's own main roof |
| `barnHeights` | Barn roof height, from the top of the wall to the top of the trusses, by width | `{"10": "4 ft 2 in"}` or `"8 ft wide: 3 ft 9 in, 10 ft wide: 4 ft 2 in"` | barn roofs; a width left out keeps the standard's height |
| `eaveOverhang` | Eave overhang, measured level out from the long walls | `"4 in"` | gable roofs (0 to 12 in) and barn roofs (0 to 3 in), not the cottages |
| `gableOverhang` | Gable-end overhang | `"4 in"` | every roof (0 to 12 in) |
| `wallHeight` | Wall height, floor to the top of the wall plate | `"7 ft 9 1/2 in"` | every style (4 ft to 10 ft) |
| `doorHeight` | Wooden shop door height (the opening) | `"76 1/2 in"` | every style (60 to 96 in) |
| `porchDepth` | Porch depth | `"6 ft"` | porch styles (3 to 8 ft, at least 4 ft of room left inside) |
| `sidePorchLength` | Side porch lengths the customer can pick | `"8 ft, 12 ft"` or `["8 ft", "12 ft"]` | side porch styles (1 to 4 lengths, 4 to 20 ft, each leaving 4 ft of side wall) |
| `dormerSide` | Dormer side | `"door side"` or `"back side"` | dormer styles |

* `style` is a style they sell: a library style, or a style of their own
  (it may have numbers of its own). Numbers on a library style also reach
  every style of theirs built like it that has none of its own. A library
  style they don't sell: "Edit 1: They don't sell the Garden Utility. Sell
  it first (sell_style), then set how it's built."
* One or more parts, each a builder's words (text, at most 120 letters), or
  `"standard"`: that takes the style's own number out, so the standard
  building's number is used again (the shop standard, or the library's).
  A bare number is never guessed (inches or feet?): "Edit 1: Wall height:
  write it the way a builder says it, like 7 ft 9 1/2 in, or standard."
  Text with no unit is the unit the owner's box shows (inches; feet for a
  porch), as there: "Edit 1: Wall height 8 in is lower than 4 ft. Did you
  mean 8 ft?"
* Only the parts that apply to that style: "Edit 1: The Utility Shed has no
  porch.", "Edit 1: The Loft Barn has a barn roof, so it has no roof pitch.
  Set its barn roof height instead." Every part's problem in one edit is
  said at once.
* Each is checked with How it's built's own limits and words for that
  style (its roof, its sizes, its porch): "Edit 2: Eave overhang 6 in is
  more than a barn roof can take: 3 in at most." Then, after the lock, the
  owner's own `check()` (barn heights joined width by width with the
  standard's: "Barn roof height: the 12 ft wide barn (4 ft 3 in, the
  standard) would be lower than the 10 ft wide barn (5 ft). Type a height
  for the 12 ft wide barn too.") and the every-size check
  (`server/office/built-check.js`): what the new numbers cause at some
  size refuses the change in its words ("Utility Shed 12x20: the 72″
  Wooden Double Doors on the front should be 76 1/2 in tall, but the wall
  leaves room for 55 5/8 in. ..."); what it finds that still builds, and
  the sizes it had no time for, come back as warnings (see Warnings).
* A number the business set up by hand another way (a construction
  setting on the same path) stays theirs: "Edit 1: Their wooden shop door
  height was set up another way, so it can't be changed here."
* A price list from before How it's built holding the old roof pitch rule
  list moves it into How it's built first, as every save does.
* It is written with `model/build-settings.js` `setBuilt`, stored as numbers
  (`"8 ft"` is `96`, `"6/12"` is `6`). The change words are the owner's own
  History words for How it's built: "Utility Shed wall height: 7 ft 9 1/2 in
  → 8 ft", "Loft Barn barn roof height at 10 ft wide: 4 ft → 4 ft 2 in", and
  back with `"standard"` "Utility Shed wall height: 8 ft → 7 ft 9 1/2 in". A
  style started in the same change says its own numbers after "Started
  selling ...": "Tall Loft Barn wall height: 7 ft of its own". A library
  style's line names every style of theirs built like it that the number
  reaches (no number of its own for that setting): "Utility Shed wall
  height: 7 ft 9 1/2 in → 8 ft 6 in (and Premium Utility, built like it)".
  Alan says yes to these words, so a building that changes is always
  named.
* Before live, and while the owner's switch is on (a save then needs Alan's
  tap in the Control Room, as every save does).
* How it's built for the whole business (`built`), the construction
  settings and an extra's numbers stay the owner's.
* `read` part `library` gives each library style's numbers now and the
  standard's, by these same part names.

**Roof pitch** (Alan: "make sure roof pitch is the same").
`set_roof_pitch {style, pitch}`, with `pitch` `"N/12"` (N a whole number, 3
to 12) or `"standard"`: the short form of `set_built {style, roofPitch}`,
with stricter limits and its own words, kept as they were.

* Only these library styles, all gable roofs: UT, SU, GU, C, SC, DSC, G, MU,
  MG, DK (`gableStyles` in `read` part `library`). Others are refused:
  * gambrel, saltbox, lean-to and single slope: "Only a gable roof's pitch
    can be changed here. The Loft Barn has a gambrel roof, so a different
    pitch needs a new library style.";
  * the Dormer Shed (its dormer sets its roof): "The Dormer Shed's dormer
    sets its roof, so its pitch can't be changed here. A different pitch
    needs a new library style.";
  * a style of their own: "UT1 is a style of their own. Change the pitch of
    the library style it is built like.";
  * any other pitch: "Pick a pitch from 3/12 to 12/12, in whole twelfths,
    or standard.";
  * a style they don't sell: "They don't sell the Garden Utility. Sell it
    first (sell_style), then set its roof pitch.";
  * a pitch How it's built doesn't allow on that roof (a metal roof is never
    flatter than 4/12), in How it's built's own words: "Roof pitch 3/12 is
    flatter than 4/12, the flattest the 3D designer can frame a metal
    roof.";
  * a business whose gable roofs were set up by hand some other way (a
    construction setting on the gable rise): "Their gable roofs were set up
    another way, so the pitch can't be changed here."
* It writes that style's own roof pitch in How it's built,
  `offer.<code>.built.roofPitch` (a number per 12: `6` is 6/12), with
  `model/build-settings.js` `setBuilt`, as the owner's own "How it's built"
  box does. `"standard"` takes the style's own number out, so the standard
  building's pitch is used again: the shop standard where there is one
  (the Utility Shed's 5/12), or the library's.
* The pitch also reaches every style of their own built like it that has
  no pitch of its own, and the change words name them. Nothing is written
  in the construction settings.
* A price list from before How it's built may hold the rule list this edit
  used to write (`construction.roof.shapes.gable.rise`: one `{when:
  {styles: [code]}, value: {w: N / 24}}` for each style, then the library's
  own rise last). It is moved into How it's built first (`liftRawRules`,
  the same move every save makes), so each style keeps the pitch it had.
* The change words are the owner's own History words for How it's built,
  with the standard said as its number: "Utility Shed roof pitch: 5/12 →
  6/12", and back again "Utility Shed roof pitch: 6/12 → 5/12". When a
  style of their own is built like it with no pitch of its own: "Utility
  Shed roof pitch: 5/12 → 6/12 (and Premium Utility, built like it)".
* The save is checked like the owner's own: How it's built's limits, then
  every size of that style (the every-size check, `server/office/
  built-check.js`); a problem the new pitch causes refuses the save in
  words, and what it finds that still builds is a warning.
* Every other number of a style's own is `set_built`'s; every other change
  to how the buildings are built stays locked.

**Examples.** `edits.samples` in the fixtures has every edit with the
change words it must give, the settings it must leave, and the refusals.
The base is First setup with the small starting price list.

### Warnings

`check` sends warnings with the change words. They never stop a save: they
are for Alan to read before he says yes. In this order:

1. The business phone, email or website changes: "This changes the
   business phone that customers see. Check it with the owner." ("phone and
   email", "phone, email and website" when more change.)
2. Text customers read that this change writes or changes, with a web
   address, an email address or a phone number in it: the business name
   and short name, the fine print, a width note, the words under the
   rent-to-own price, the texting permission words, the tagline, a group
   name, a color of their own, or a style, door, window, option or extra
   name. "The line under the price has a phone number in it. Customers read
   it, so check it is right." ("The texting permission words have ... in
   them. Customers read them, so check they are right.")
3. A bigger size cheaper than a smaller one (same style, at least as wide
   and as long): "Utility Shed 12×24 ($7,000) costs less than the smaller
   12×20 ($7,290)."
4. A price that moves more than 40%: "Loft Barn 14×32 moves 45%: $14,490 →
   $21,000." (doors, windows, options and extras too, by their names; an
   extra charged another way than before isn't compared). A rent-to-own
   factor too: "The rent-to-own factor for 36 months moves 90%: 0.6 →
   0.06."
5. A building size under $500 or over $100,000: "Utility Shed 4×6 at $450
   is under $500." / "Garage 14×60 at $120,000 is over $100,000."
6. Every size of a style at one price (2 sizes or more): "Every size of the
   Garage is $9,000."
7. More than half of the building prices change: "This changes 15 of 15
   building prices."
8. Three or more styles stop selling: "This stops selling 3 building
   styles: Utility Shed, Loft Barn, Garage."
9. An extra of theirs with a roof pitch of its own ("Roof pitch at least")
   that this change makes change nothing on a building it is offered on:
   its pitch counts only when it is steeper than the style's, yet customers
   would still pay for it. In the words the owner's How it's built screen
   uses: "Steep roof does not change the Utility Shed (its roof is already
   8/12). A customer would pay for nothing there." A building it already
   changed nothing on before isn't said again.
10. What the every-size check of How it's built finds that still builds,
   when a building style's own numbers change (`set_built`,
   `set_roof_pitch`): "Utility Shed 12x20: even set as low as it goes, right
   under the peak, the 18×24 Gable Window's trim runs into the roof. The
   same at 12x24 and 12x16." (What it finds that doesn't build refuses the
   change instead, 422 `problems`.)
11. The sizes the every-size check had no time for (about 3 seconds):
   "Not checked yet: 14 sizes of the Lofted Barn. To check the rest, tap
   Open their price list and press Check every size in that building's How
   it's built."

Warnings 3 to 6 look only at styles and prices this change touches.
Money and sizes are written as everywhere else ($5,540, 10×16). What counts
as contact details in text: a web address (`http://`, `https://`, `www.`,
or any name with a dot and an ending of 2 to 24 letters: othersheds.shop,
bit.ly/3xYz, t.me/x), an email address, or a 10-digit phone number in any
usual form (941-555-0100, (941) 555-0100, 941.555.0100, +1 941 555 0100).

### The lock: what Barnwright may change

The lock runs on every Barnwright check and save (door check, save and
undo; visit save and put back), before the owner's own `check()`. A
Barnwright save can never be anything an owner's save couldn't be.

| Part of the settings | Door (Control Room, Claude) | Visit (Alan by hand) |
|---|---|---|
| `brand` name, short, initials, tagline, colors | yes | yes |
| `brand.logo` | no edit reaches it | `""`, unchanged, or a picture (`data:image/png`, `webp` or `jpeg`) of 150 KB or less |
| `brand` phone, email, website | before live; not while the switch is on | yes |
| `offer`, `categories`, `items`, `options`, `palettes`, `defaults`, `pricing`, `notes` | yes | yes |
| `leads.fields`, `leads.askPlan`, `leads.smsConsent` | yes | yes |
| `look`, `features`, `renames` | no edit reaches them | yes |
| a building style's own How it's built numbers (`offer.<code>.built`) | yes, through `set_built` (and its short form `set_roof_pitch`), before live and while the switch is on | yes, every number its screen has |
| How it's built for the whole business (`built`) | never | never |
| `construction` | never | never (no screen edits it) |
| an extra that changes how the building is built: its construction effect (`options.extras[].construction`), its own How it's built numbers (`options.extras[].built`) and, for such an extra, the buildings it is offered on (`styles`) | never: no new one, no change, no removing an extra that has one | never, the same |
| `status`, `id`, `manufacturer`, `license`, `embed`, `brand.credit`, every other `leads` key (`mode`, `url`, `email`, `images`) | never | never |
| `cfg` | worked out by the server | worked out by the server |

Each refusal is one plain sentence:

| What | Words |
|---|---|
| `status` | Only the owner can open or close the 3D designer to customers. |
| `id` | This price list belongs to a different business. Reload the page and try again. |
| `manufacturer` | The builder's library cannot change here. |
| `license` | The 3D designer's license settings can't be changed by Barnwright. |
| `embed` | Only the owner can change which websites may show the 3D designer. |
| where quotes go (`leads` other than the three above) | Only the owner can change where quotes go. |
| `brand.credit` | The 3D designer credit line can't be changed by Barnwright. |
| `construction` | How the buildings are built can't be changed here, except a building style's own numbers in How it's built. |
| `built` (for the whole business) | Only the owner can change How it's built for the whole business. A building style's own numbers can be changed here. |
| an extra that changes how the building is built | The extra "<name>" changes how the building is built, so only the owner can add it, remove it or change what it builds. |
| a logo that is a web address | The logo must be a picture uploaded in Settings, Logo, not a web address. |
| a logo over 150 KB | The logo is too big. Use a picture of 150 KB or less. |
| contact details while the switch is on (door) | While their 3D designer is open, the business phone, email and website can be changed only by the owner, or by Alan by hand in Open their price list. |

A web address would load the logo from someone else's server on every
customer's 3D designer, so the logo must be a picture.

**Building shape.** The only change to how a building is built that
Barnwright can make is a building style's own numbers in How it's built
(`offer.<code>.built`): at the door through `set_built` (and its short
form `set_roof_pitch`), in the visit any number that style's "How it's
built" boxes have. They are
checked exactly as the owner's are, after the lock: How it's built's own
limits and words (`model/build-settings.js`), then every size of each
style whose numbers changed (the every-size check); what they cause
refuses the save. How it's built for the whole business and the
construction settings stay the owner's. Both sides are read the way a save
stores them: a price list from before How it's built, holding
`set_roof_pitch`'s old rule list, reads as each style's own pitch, and
"7/12" and 7 are one number. An option or an extra can change how the
building is built too: the builder's library's options carry their effect
in the library, which no setting changes, so selling or not selling one is
fine; an extra of the business's own carries a construction effect
(`options.extras[].construction`, `model/company.js` `optionEffects`), its
own How it's built numbers (`options.extras[].built`), or both, on the
buildings its `styles` names. The lock compares every extra that has one,
by its key: each must still be there with exactly the same effect, numbers
and buildings, and no other extra may have one. Keys are read as text, the way the 3D
designer reads them, so a key with an effect is never used by two extras
(5 and "5" are one key); and an extra's key must be text in every save
(`validate()`, the owner's words "One of your extras could not be saved.
Reload the page and try again."). An extra's name, how it is charged and
its price can still change. The words name the extra: its name before the
change, or a new extra's own name.

Undo and put back carry the current values of every "never" part forward
(`carryLocked`), so going back can't open the 3D designer, change where
quotes go or which websites may show it; the construction settings and How
it's built for the whole business stay as they are now too, while each
building style's own numbers (its roof pitch) go back with the rest. An
undo or put back that would add, change or remove an extra that changes
how the building is built is refused by the lock like any other change.
What it carries forward makes a price list nobody saved before (the copy's
own wall height with the door height set for the whole business since), so
it is checked like a save: what How it's built's own rules or the every-size
check find that neither the copy as it was kept nor the price list in use
already had refuses it, in their words ("Utility Shed 10x20: the 72″
Wooden Double Doors on the front should be 78 in tall, but the wall leaves
room for 76 5/8 in. ..."), and nothing is saved. What the copy already had
goes back with it, said.

### The visit: Alan in their Dealer Center

For the things an edit can't do (the logo, how the 3D designer looks), and
for anything Alan would rather type himself, he works in the business's own
price list screens, the same ones the owner uses.

1. In the Control Room, **Open their price list** gets a pass (action
   `session`) and shows a second button that opens
   `https://<their site>/dealer#barnwright=<pass>`. Two taps, so iPad Safari
   doesn't block it. The pass is in the part after `#`, which is never sent
   to a server or in a Referer.
2. The page reads the pass, clears the address at once, and posts it to
   `POST /api/office/barnwright/start` with `Authorization: Bearer <pass>`
   and the body exactly `{"action":"session"}`.
3. The Dealer Center checks the pass (as above). A visit is Alan by hand,
   so the pass must be `via: "control-room"` (the Control Room's own Open
   their price list); a `claude` pass gets 401 "This link ran out. Tap Open
   their price list again." It checks `access()`, and sets the cookie
   `__Host-bw_setup` (32 random bytes, base64url;
   `Path=/; Secure; HttpOnly; SameSite=Strict`). Only its SHA-256 is
   stored, in `barnwright-sessions`, with what it started under (before
   live, or the switch turned on at `grantedAt`, and the agreement:
   `owner`, or `signup` before the owner first signs in). The owner's log
   gets "Barnwright (alan@...) opened your price list." once (no `until`: a
   visit's end slides, and setup access may end first). Access closed:
   403 `closed` with the words for `why`, and no cookie.
4. Before a price list exists, a start whose pass carries a sign-up
   agreement that counts first makes the starting price list (as a
   version-0 save with no edits), then starts the visit; the answer adds
   `started: true` and the price list screens open on it, ready to edit
   (see "Before the owner first signs in").

**How long.** A visit lasts while access is open, and at most 8 hours after
its last request: every request moves its end to 8 hours later, never past
the switch's end. Every answer sends the cookie again with the new
`Max-Age`. The switch going off, the owner tapping Stop, or the business
going live ends every visit at once (each is marked ended), and
`access()` is checked on every request too. A visit never outlives what it
started under: one from before live ends once the business is live, and
one from a switch ends with that switch, so turning the switch on again
needs a new visit (and the owner's log says so again). A visit started on
the sign-up agreement ends once an owner has signed in, even after they
agree.

**The routes** (all under `/api/office/barnwright/`, the cookie only; every
change also needs the site's own Origin, like every `/api/office/` change):

| Route | Does |
|---|---|
| `POST start` | the pass (action `session`) → `{ok, mode, until, visitEndsAt, business: {name}, started?}` and the cookie (`started: true` when it made the starting price list) |
| `GET me` | `{barnwright: {actor, mode, until, visitEndsAt}, business}` (`business` as in `GET me`) |
| `GET price-list` | as the owner's `GET price-list` |
| `PUT price-list` | `{settings, version}` as the owner's, through the lock and the same `check()`; needs the lease; the history copy kept first; `savedBy` is Barnwright with the start pass's id |
| `GET price-list/history` | as the owner's |
| `POST price-list/restore` | `{version, current}` as the owner's Put this back, the "never" parts carried forward |
| `GET lots` | `{lots: [{slug, name, active}]}`, for the previews |
| `GET lots/:slug/preview` | the preview |
| `POST end` | the Done button: ends the visit and clears the cookie → `{ok: true}` |

* The visit's routes ignore Identity; the owner's routes ignore the
  cookie. Barnwright is never a role in `people/` or in `can`, so the
  visit can never reach customers, orders, the team, a lot's details, Help
  or the owner's Barnwright card (and can't turn on its own access).
* A pass that ran out or was used before, at start: 401 or 410 with "This
  link ran out. Tap Open their price list again." Never a sign-in screen.
* A visit that ended while access is still open (its 8 hours, or a new
  switch): 401 `{error: "Your Barnwright visit ended. In your Control Room
  tap Open their price list, then come back and tap Save.", code:
  "visit-ended"}`. One that ended because access closed says why instead:
  `{error: "Your Barnwright visit ended. <the words for why> Your changes
  are kept in this tab.", code: "visit-ended", why}`. The page never
  reloads: the draft stays on screen and in sessionStorage, and comes back
  on the next visit. Once a new visit has started, Save in the same tab
  works and the bar comes back.
* The screens: a bar on top, "Working on <business> as Barnwright until
  3:15 PM. [Done]" (the time in Alan's browser), and only Price list (all
  its tabs, History with Put this back) and Settings: Your business, Logo,
  Colors, the 3D designer's prices and words (how prices show, rent to own,
  the line under the price, width notes, the building it opens on, never
  Open or Closed), and the quote form's boxes (never where quotes go).
  Any other screen says "A Barnwright visit has only the price list and
  settings." with Go to the price list. On a phone the bar's buttons are
  full touch size (44 px).
* A draft kept in the tab comes back once: Undo changes, Reload or leaving
  the screen let it go for good.
* When the owner saves over a Barnwright save, their 409 says "Barnwright
  saved a change while you were working. Reload to see it, then make yours
  again." with `savedAt` for the browser to show the time.
* Each save and put back in a visit is told to the Control Room's service
  record, as the door's saves already are: `POST /api/setup-service` on
  the control room, signed in with the activation key like the check-in,
  `{customerId, siteId, action: "setup-saved", version, versionBefore,
  changes (the first 500), more, actor, undo}` (`undo` is true for a put
  back; a start that made the starting price list is `version: 1,
  versionBefore: 0` with its one line). The control room writes one line
  for each version. Best effort, 3 seconds at most: when it can't be
  reached, the save still stands.

### The owner's card: Settings, Barnwright

One card, **Barnwright**, takes the place of Help from Barnwright. Help's
own workings don't change (the switch is sent to the Control Room, and
every check is confirmed online). The change switch stays here in the
Dealer Center and never depends on the Control Room being up.

* **Before live:** "Barnwright is setting up your 3D designer. Until you
  open it to customers, they can change your price list and settings for
  you. Every change is listed here and in Price list, History." [Stop
  Barnwright's setup access]. When stopped: [Let Barnwright set it up
  again]. Run checks works as Help did.
* **After live:** one choice, "Run checks" or "Run checks and change my
  price list and settings", how long (1, 4, 8 or 24 hours; 4 to start), a
  reason (needed), [Turn on]. While on: "Barnwright can change your price
  list and settings until 3:00 PM." (or "can run checks until") [Turn off
  now].
* Before the owner has agreed to terms 2.2: the change choice says "Agree
  to the new terms at the top of the page first."
* Before terms 2.2 are out (`setup.termsOut` false: this Dealer Center's
  own terms are older), the card shows none of the setup access words and
  no change choice, only "Barnwright's new terms (2.2) aren't out yet, so
  Barnwright can only run checks for now." and Run checks.
* Turn off, before live: checks go off and setup access goes on, so the
  owner reads "Checks are off. Barnwright can still set up your price list
  until you open it. To stop that too, tap Stop Barnwright's setup
  access." "Barnwright can't run checks or change anything now." is said
  only when it is true.
* The log follows: the newest 10 lines.

**The routes** (the owner only: `people.member` and `can.changeSettings`;
no `mustWrite`, so turning off always works; a visit's cookie is not a
sign-in):

* `GET /api/office/barnwright-help` →
  `{help: {on, until, reason, log}, setup: {mode, until, why, live, liveAt, prelive, termsOk, termsOut}}`;
  both null when not connected. `help.on` is checks; `setup.mode` is
  `prelive`, `switch` or null.
* `POST /api/office/barnwright-help`, one of:
  * `{on: true, reason, hours, level}`: `level` is `checks` (as today, and
    when left out) or `change`; `hours` 1 to 24. `change` turns the local
    switch on first, then turns checks on as Help does. If the Control Room
    can't be reached, changes stay on, checks stay off, and the answer has
    `notice`: "Barnwright couldn't be reached just now, so checks are off.
    Barnwright can change your price list and settings." `change` before
    terms 2.2: 422 "Agree to the new Barnwright Terms and Conditions at the
    top of the page first."
  * `{on: false}`: both off at once, here first. Every visit ends when
    access closes; before live, setup access goes on (and so does a
    visit), and the log says "Pat Owner turned off Barnwright's checks."
  * `{prelive: "stopped"}` or `{prelive: "on"}` (Stop ends every visit):
    before live only (after:
    422 "Your 3D designer is open, so use Run checks and change my price
    list and settings instead.").
  * The answer is the same as GET. After any change, the Dealer Center
    checks in once at once (best effort, 3 seconds), so Alan's Control Room
    knows within seconds.
* A manager: 403 "Only the owner can let Barnwright help." A visit's cookie
  alone: 401 "Please sign in."
* `GET me` gains `setup: {mode, until}` for the owner (null for everyone
  else), so the banner draws with no extra request.

**The banner** (the owner only, after the account and terms banners):
while the switch is on, "Barnwright can change your price list and
settings until 3:00 PM." [Turn off]; while `prelive`, the closed banner's
words given in The preview, above.

**Opening to customers** shows one line first: "Opening ends Barnwright's
setup access. After this, Barnwright needs your switch to change your
prices."

**The log** (`barnwright-help-log`, one log for checks and changes, 100
lines kept, 10 shown). Each line is `{at, words, until?}`: times are never
inside the words; the browser shows `at` and `until` in the owner's own
time.

* "Barnwright (alan@...) changed your price list: Loft Barn 10×16: $5,690 →
  $5,700; 48″ Wooden Door: $160 → $175." (the first 3 change lines, then
  ", and 4 more")
* "Barnwright (alan@...) started your price list from Every standard
  building, using the terms you agreed to when you signed up." (before the
  owner first signs in)
* "Barnwright (alan@...) put back the price list from before its last
  change."
* "Barnwright (alan@...) opened your price list." (once a visit)
* "Barnwright looked at your price list." (at most once every 30 minutes)
* "Pat Owner let Barnwright run checks for 4 hours: <reason>" /
  "Pat Owner let Barnwright run checks and change the price list and
  settings for 4 hours: <reason>" (with `until`)
* "Pat Owner turned off Barnwright's access." (before live: "Pat Owner
  turned off Barnwright's checks.") / "Pat Owner stopped
  Barnwright's setup access." / "Pat Owner let Barnwright set up the price
  list again."
* "Barnwright's setup access ended when you opened your 3D designer to
  customers." / "Barnwright's setup access ended when your first quote was
  saved."
* "Barnwright tried a change that needs Alan's OK in his Control Room
  first. Nothing was changed." / "Barnwright tried to change something only
  you can change. Nothing was changed." / "Barnwright tried a change that
  couldn't be saved. Nothing was changed." (a refused change while access
  is open, at most once a minute; see Refusals)
* and Help's own lines, as today ("Barnwright (alan@...) ran a check of
  your Dealer Center.").

The Help screen gains a short answer, "Let Barnwright change your prices".
Nothing about any of this is emailed or texted to the owner.

### Before the owner first signs in

Alan's choice (October 2026): start right away. As soon as Alan taps
**Make their Dealer Center** in his Control Room, Barnwright can set up the
business's price list from Alan's photos: Alan by hand in the visit, or
Claude through the Control Room. The owner finds it ready the first time
they sign in. It uses the terms the owner already agreed to on the Control
Room's sign-up page.

**The sign-up agreement.** On the sign-up page Alan texts them, the owner
reads the terms, ticks "I agree" and types their name. The Control Room
keeps `termsVersion`, `termsSha256` (the SHA-256 of the exact
`docs/legal/terms.json` bytes the page showed), `signature` (the name they
typed) and `signedAt`. Every setup pass for that customer carries them, with
the business name, phone and email from the same sign-up, in the claim
`signup` (see The pass).

**When it counts.** The Dealer Center takes the sign-up agreement as the
owner's agreement for setup access, and for nothing else, only when all of
these hold:

* `termsVersion` is 2.2 or later, and so are this Dealer Center's own
  terms (`termsOut`);
* `termsSha256` is one of this Dealer Center's own copies of that
  version's terms bytes, or `termsVersion` is the version it ships
  (`TERMS.version`). Its own copies are in `docs/legal/terms-sha256.json`,
  `{"versions": {"2.2": ["<64 lowercase hex>", ...]}}`:
  `tools/legal/make-legal-pdfs.py` adds the SHA-256 of every
  `docs/legal/terms.json` it writes for 2.2 or later and never takes one
  away (`tools/legal/terms_sha256.py`, which also runs on its own), and
  `server/office/terms.js` reads it;
* no owner has signed in yet (no `setup` record).

When a sign-up agreement is there but doesn't count, access says why:
`signup-terms` (older than 2.2), `signup-unknown` (2.2 or later, but not
the version it ships nor one of its own copies), or `terms` while this
Dealer Center's own terms are older than 2.2. Once an owner has signed in,
a sign-up agreement never counts again: only the owner's own agreement in
the Dealer Center does.

It never counts as the owner's own tick. `barnwright-terms` is never
written from it, `GET me`'s `terms.agreed` stays null and `termsOk` stays
false, and First setup still asks the owner to tick "I have read and agree
to the Barnwright Terms and Conditions".

**Remembered once.** The first pass whose sign-up agreement counts (any
action, `status` included) writes `barnwright-signup-agreement`
`{termsVersion, termsSha256, signature, signedAt, at, passId}` with a
create-only write. It is never changed. `access()` uses the pass's sign-up
agreement when it counts, otherwise the remembered one, checked by the same
rule each time. So the visit's later requests and the check-in's report,
which carry no pass, see it too. A check-in can't know about the agreement
before a pass brings it, so until then it reports `no-price-list`.

**The details are for setup only.** The business name, phone and email a
pass carries are used only to make the starting price list (below). They
are never kept anywhere else (the remembered agreement holds none of them),
never put in an answer, a log line or a change line, and once a price list
exists, the details a pass carries change nothing. The phone and email are
contact details set up before live, which is allowed (see The lock), and
they are not warned about: they are the owner's own, from their sign-up.

**The starting price list (version 0).** While there is no price list and
access is `prelive`:

* `read` answers the parts of the starting price list the first save would
  make: the "Every standard building" template (`companies/demo/company.json`,
  First setup's `full`), set up the way First setup sets up a business
  (closed to customers, `status: "suspended"`), with the business name from
  the pass's sign-up (and the short name, initials and the price list's
  `id` worked out from it as First setup does), its phone and email as
  First setup's own checks give them (trimmed, the email in lower case;
  one those checks would refuse is left empty) and no website.
  The status fields say `priceList: null`, and `history` is `[]`. Nothing
  is written but the pass, the limits and the remembered agreement.
* `check` takes `version: 0` and 0 to 300 edits (`[]` or left out: the
  starting price list alone), tried on the starting price list. The rest
  is as in check: the lock, `check()`, the change words against the
  starting price list, the warnings and `settingsSha256`.
* `save` takes `version: 0`, the same edits and the check's
  `settingsSha256`. It makes the price list with a create-only write as
  version 1, the starting price list, saved by Barnwright with this pass's
  id and the history line "Started the price list from Every standard
  building, at example prices", and writes `barnwright-live`
  `{live: false, checkedThrough: 1}`. Then, when there are edits, it saves
  them as version 2 the usual way. The answer is the status fields plus
  `{versionBefore: 0, version, changes, newCodes}` (`version` is 1 with no
  edits, else 2; `changes` are the edits' lines). It counts as one save. A
  price list that appeared since the check: 409 `version`. A pass that
  carries no sign-up (the agreement only remembered) can't make one: 403
  `closed`, `no-price-list`. It needs the lease like every save; a Dealer
  Center that has never checked in (the check-in right after its deploy
  didn't come and nobody has opened it) checks in once first.
* Any other version: 409 `version`. Once a price list exists, `version: 0`
  is 409 `version` too, with edits or with none.
* `undo`: nothing to undo (409 `cant-undo`). At the starting price list
  itself (version 1, made this way), undo says "This is the starting price
  list Barnwright set up, so there is nothing before it to put back." and
  `canUndo` is false; after version 2, undo puts version 1 back as usual.
* The owner's log gets "Barnwright (alan@...) started your price list from
  Every standard building, using the terms you agreed to when you signed
  up." and, with edits, the usual changed line.

There is no new door action: version 0 is how Barnwright starts a price
list from the door. Claude's `propose_change` checks with version 0, and
`apply_change` saves with it.

**The visit.** Open their price list works before there is a price list
too. Its start pass (action `session`) carries the sign-up agreement; when
it counts and there is no price list, `POST /api/office/barnwright/start`
first makes the starting price list exactly as a version-0 save with no
edits (the same history line and log line; it needs the lease, checking
in once first when it never has, else 423 `account-off` with the door's
words; it counts as a save), then starts the visit. The answer adds `started: true`, the price list screens open on the
template ready to edit, and the start is told to the Control Room's service
record (`version: 1`, `versionBefore: 0`, the start line). A visit started
on the sign-up agreement (`agreement: "signup"` in `barnwright-sessions`)
ends once an owner has signed in, even after they agree: Alan opens a new
one.

**The owner's first sign-in.** The owner makes a login with the email from
their sign-up, as before. `GET me` says `setupNeeded: true` with `business`
not null when the price list exists, `barnwright-signup-agreement` exists
and the owner has never agreed to any terms in the Dealer Center (an
existing business never has the record, so it is never sent back to First
setup). Until then the business phone and email are the ones the owner
typed on the sign-up page (the email is their login), and anyone can make
a login, so `GET me` gives a login that isn't on the team the business
without its phone, email and website. First setup then:

* has two steps, **Your business** and **Your first lot**, skips "Your
  starting price list", and says above them: "Barnwright set up your price
  list. You can change anything." (its welcome line reads "Two short
  steps. You can change all of it later.");
* still asks for the business details (filled in from the price list: the
  business name, phone and email), the terms tick and the first lot;
* sends `POST setup` without `start`. The agreement is kept as the owner's
  own, and a business name, phone, email or website that differs from the
  price list's is saved into it as the owner's change (a new version by the
  owner, with the short name and initials worked out from a new name as
  First setup does). The answer is 200 `{business}`. When the price list
  wasn't started this way, or the owner has agreed already: 409 "The
  business is already set up." as before.

From then on, access stands on the owner's own agreement: `prelive` until
the business is live, as for every business. Settings, Barnwright shows
"Barnwright is setting up your 3D designer. ..." with **Stop Barnwright's
setup access**, and its log starts with Barnwright's start and changes; the
closed banner says "Barnwright is setting up your prices. Look at the
preview, check it with Alan, then open it to customers in Settings."
Between the owner's first sign-in and their tick, access is closed
(`terms`, or `no-price-list` when Barnwright hadn't started a price list),
and every visit started on the sign-up agreement ends.

Live is unchanged: the owner opening the 3D designer, or the first real
quote or order.

### The check-in

`account.checkIn` adds `setup` to what it sends the Control Room
(`POST /api/license`):

```
"setup": { "v": 2, "live": false, "liveAt": null, "access": "prelive",
           "why": null, "until": null, "prelive": "on", "termsOk": true,
           "termsOut": true, "agreement": "owner" }
```

These are the same names and values as the status fields, so the Control
Room reads both with one check. Before the owner first signs in it uses the
remembered sign-up agreement (`agreement: "signup"`); before any pass has
brought one, it says `access: "closed", why: "no-price-list"`.

* `setup.report()` runs in its own try, with 500 ms at most. If it fails,
  runs over, or `barnwright-live` isn't written yet, the check-in goes
  without `setup`, and the lease renews as before.
* `report()` reads only stored records. It never looks back through
  history or customers.
* A Control Room older than this ignores `setup`. The Control Room shows
  Open their price list only once a check-in or a `status` answer has
  `setup.v` of 1 or more and access open.

**Right after a deploy** (`netlify/functions/deploy-succeeded.mts`, new).
Netlify runs a function named for one of its events when that event
happens; this one is named for `deploy-succeeded`, so it runs each time a
deploy of the site succeeds. It is Netlify's older way of naming an event
function (the file name), which Netlify still supports; its default export
takes the request and Netlify's `context` like the other functions. Netlify
signs every event it sends and checks the signature before it calls the
function, so nobody else can run it. It has no `path` and no `schedule`.

* It checks in only for a production deploy: the deploy in the body Netlify
  sends (`{payload: {id, context, ...}}`, the deploy as Netlify's API
  describes it) has `context: "production"`, and the function itself runs
  in production (`context.deploy.context`, as `officeFor` reads it). A
  deploy preview, a branch deploy, or a body it can't read does nothing: a
  preview has its own empty storage and must never report it.
* It runs `scheduledCheckIn()`, the same as the six-hourly check-in: the
  check-in first (forced, so the lease renews and the Control Room learns
  the new `appVersion` and `setup` at once), then the look back, in its own
  try, for at most 5 seconds. Nothing else from the body is read.
* It always answers 204. A site that isn't connected does nothing.
* So the first deploy that **Make their Dealer Center** starts checks in
  within a minute of finishing: the Control Room shows **Connected**,
  fills in the address, and learns setup access's state, instead of
  waiting up to six hours for the schedule or for someone to open the
  Dealer Center.
* The function is a few lines, like the others; the rule is
  `deploySucceeded(request, deployContext)` beside `scheduledCheckIn` in
  `server/office/index.js`. `tools/check-control-room.mjs` calls it the
  way Netlify calls the function (a POST whose body has `payload`, and the
  deploy's context) with a production deploy, a deploy preview, a branch
  deploy and a body that isn't JSON, against the pretend control room: one
  check-in for production, none for the others. It also loads the
  function file itself and proves it has no `path` or `schedule`.
  `netlify functions:invoke deploy-succeeded --payload ...` with
  `netlify dev` tries it by hand.

### Records

The new records are in the Data table above: `barnwright-setup`,
`barnwright-live`, `barnwright-setup-seen`, `barnwright-sessions`,
`barnwright-setup-limits`, `barnwright-signup-agreement`, and Barnwright's
`savedBy` on the price list.

The door and the visit write only `price-list` (before there is one, with
a create-only write), its history, `barnwright-live`,
`barnwright-setup-seen`, `barnwright-sessions`, `barnwright-setup-limits`,
`barnwright-help-log` and, once, `barnwright-signup-agreement`. They read
`barnwright-setup`, `barnwright-terms` and the first owner's claim `setup`
but never write them: only the owner's routes change the switch, and only
the owner's own sign-in and tick write the claim and their agreement.
`customers/` and `lots/` are read only to work out live and to show
previews; `customers/`, `people/`, `lots/`,
`invites/`, `barnwright-terms`, `barnwright-help` and the lease stay
exactly as they were, and nothing here sends email.

### Where it lives

* `server/office/setup-access.js` (new): `access()`, the live record and the
  look back, the owner's switch, the log, the door, the visit and `report()`.
  Browser-safe, never imports `control-room.js`, and has no `sendEmail`.
* `server/office/setup-edits.js` (new, pure): `applyEdits` and `warnings`.
* `server/office/setup-lock.js` (new, pure): `lockProblems` and
  `carryLocked`.
* `server/office/setup-view.js` (new, pure): the read parts.
* `server/office/control-room.js`: `verifySetupPass(token, {action,
  bodyBytes})`, and a refusing twin for incomplete settings.
* `netlify/functions/barnwright-setup.mts` (new): the door, three lines like
  `tenant-diagnostics.mts`.
* `netlify/functions/deploy-succeeded.mts` (new): the check-in right after
  a production deploy (`index.js` `deploySucceeded`).
* `server/office/terms.js` and `docs/legal/terms-sha256.json` (new, kept by
  `tools/legal/make-legal-pdfs.py`): whether a sign-up agreement is to
  terms this Dealer Center has; `server/office/price-list.js`: the
  starting price list Barnwright makes, and First setup on a price list
  that already exists.
* `ui/office/api.js`, `ui/office/main.js` and `ui/office/visit-draft.js`
  (new): the visit's Barnwright mode, its reduced screens, the Done bar and
  the unsaved work kept in the tab (`sessionStorage`) when the visit ends;
  `ui/office/views/settings.js`: the Barnwright card.
* `ui/app.js` and `ui/load.js`: the preview bar and the preview answer.
* `tools/lib/setup-fixtures.json`: the examples (TEST ONLY key pairs),
  made by `node tools/lib/make-setup-fixtures.mjs`;
  `node tools/lib/make-setup-fixtures.mjs --check` proves the file is what
  the script makes and that every pass in it is kept or refused by the rule
  above. The Control Room's tests copy this file.

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
appears in the Dealer Center. It isn't connected to Barnwright, so Help
shows its answers and the email to write to;
`npm run office -- --control-room` connects it to a pretend control room
and Sales Inbox, so questions and answers work too.

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

Alan's whole procedure, from saying hello at their lot to their first quote,
with every button named, is
**`docs/legal/Barnwright-Adding-a-New-Customer.pdf`** (made by
`tools/legal/make-legal-pdfs.py`). The Control Room's **Practice adding a
customer** runs it with nothing real: no texts, no emails, no payments. In
short:

Barnwright sells **one product**, the Barnwright 3D designer (the 3D designer
and its Dealer Center), which works alongside whatever software the company
already uses. **No setup fee; $250 a month from the day it's ready, with the first lot
included**; each lot after the first is **$250 one time** and adds nothing to
the monthly fee. Every business lives at
**`<their name>.barnwrightsoftware.com`** (once, before the first customer,
`barnwrightsoftware.com` goes on Netlify DNS so each new address is one step).

Two addresses Alan uses while adding a client (Alan, October 6, 2026): his
**Sales Inbox** at **`inbox.barnwrightsoftware.com`**, his private inbox for
Barnwright sales messages, and **3D Setup** at
**`3dsetup.barnwrightsoftware.com`**, where a new client's 3D designer is set
up. Both are on the control room's Links page too.

**Before the first customer** (once): Alan gives his Control Room a Netlify
key (a personal access token, saved as `NETLIFY_API_TOKEN` in the Control
Room's own Netlify project), so it can make a business's site, and lets
Stripe save cards.

1. **The sign-up link.** At their lot, Alan adds them in the Control Room
   (**New customer**: as much or as little as he knows) and texts or
   emails the owner a sign-up link (**Send sign-up link**). On their phone
   the owner fills in or checks their details and their 3D designer web
   address, reads the short version of the terms (`docs/legal/terms.json`,
   the same words as `legal/barnwright-terms.pdf`), ticks "I agree", types
   their name and taps **Sign up and save my card**: Stripe saves their
   card. Nothing is charged that day except the one-time fees for the lots
   after the first. What they typed fills into the Control Room by itself,
   which shows **Signed** and **Card saved**. There is no paper form.
2. **The photos.** **Take photos** on the customer: each style they sell,
   every page of their price list, and their doors, windows, options, color
   cards and logo. A company Alan can't visit answers the Setup Questions
   instead (below).
3. **Their site: one button.** **Make their Dealer Center**, then **Make
   it**: the Control Room makes a Netlify project from this repository named
   for the business, gives it `<their name>.barnwrightsoftware.com`, turns
   on **Identity** (registration open: anyone can make a login, but only
   people the owner adds can see anything), puts the settings on it
   (`OWNER_EMAIL`, the owner's email from the sign-up, and the
   `CONTROL_ROOM_*` settings in "The business's Barnwright account") and
   deploys it. If it says **One more step**, Alan turns on Identity from the
   link it shows. Right after that deploy, the Dealer Center checks in, and
   from then on Alan (in **Open their price list**) or Claude can set up
   the price list from the photos, before the owner has ever signed in
   (see "Before the owner first signs in"). Only when the Control Room has
   no Netlify key does it show the steps by hand instead: a new Netlify project from this repository,
   its name and domain, Identity on, one paste of the settings (**Copy
   settings for Netlify**, then **Import from a .env file**) and a new
   deploy. When the Dealer Center first checks in, the Control Room shows
   **Connected** and fills in its address from the check-in ("Checking
   in").
4. **The owner's computer.** On the owner's computer they open `/dealer`,
   make a login with the email from their sign-up, confirm it, and follow
   the setup steps: business details with "I have read and agree to the
   Barnwright Terms and Conditions", a starting price list, the first lot.
   When Barnwright already set up the price list, First setup says so and
   skips the starting price list.
   They put the Dealer Center on their computer and phone like an app
   (`dealer.webmanifest`: Chrome and Edge show **Install** at the right end
   of the address bar; on an iPhone, Share, Add to Home Screen; Help has
   the steps). Then their prices
   from Alan's photos, Settings, their other lots and their team; Open to
   customers; the website code for each lot; a test quote. Alan gives the
   owner the one-page Welcome Sheet
   (`docs/legal/Barnwright-Welcome-Sheet.pdf`).
5. **Start.** **Start monthly fee**, then **Start and charge the card**: the
   card saved at sign-up is charged that day (the start date in the terms)
   and on the same day every month. With no card saved, **Start monthly
   fee** gives a payment link to text or email instead.
6. **Adding a lot later.** **Get extra lot payment link** on the customer
   ($250 for each new lot, one time), texted or emailed to the owner. When
   Stripe confirms the payment, the Control Room raises the number of lots
   in their plan by itself; the Dealer Center picks it up at its next
   check-in (within six hours), and the owner adds the lot under **Lots**.

### The Setup Questions

`docs/legal/Barnwright-Setup-Questions.pdf` is for a company Alan can't
visit: what it answers, with photos of its buildings, price list and
options, so it can be set up: the business and its 3D designer web address,
the look, each lot, the team, the styles it sells (with its own names),
sizes and prices, how it builds (each construction number with the standard
beside it), doors, windows and options with prices and its own extras,
colors, how prices show, rent to own, and what the quote form asks. Its
lists come from `library/manufacturers/standard.json` and
`library/construction.json` when the script runs, so they always match the
designer. The `new-company` skill says which answer goes where.

### The papers in the control room

The Control Room's **Papers** page lists the papers (Adding a New Customer,
the Welcome Sheet for the owner, the terms, the one-page Flyer and Price
Sheet to hand to shed companies, and the Setup Questions) so Alan can open
or download them anywhere. It reads `docs/legal/papers.json` and each PDF
from this repository's `main` branch on GitHub every time, so once a change
to the papers is merged here, the Control Room has it: there is nothing to
copy. The script writes `papers.json` too (and checks it against the
Control Room's rules for the list); a new paper added to its list shows up
in the Control Room on its own. The sign-up page reads the terms the same
way, from `docs/legal/terms.json`.

### The Barnwright terms

A business Barnwright sells to agrees to the **Barnwright Terms and
Conditions** (`legal/barnwright-terms.pdf`, published on every business's
site by `tools/build-site.mjs`) in two places: on the sign-up page Alan
texts the owner (it shows the short version and the full terms from
`docs/legal/terms.json`; the owner ticks "I agree" and types their name),
and in the Dealer Center (`server/office/terms.js`). First setup can't make
the business without the owner ticking "I have read and agree to the
Barnwright Terms and Conditions"; an owner who set up before the box
existed, or before the terms changed, sees "Please read the Barnwright Terms
and Conditions (version 2.1)." and the button "I have read and agree to the
Barnwright Terms and Conditions" at the top of every screen until they tap
it. Each agreement is kept with its version, time and the owner's login, and
Settings, Barnwright, says who agreed and when. Until the owner first signs
in, the agreement from the sign-up page (2.2 or later) lets Barnwright set
up their price list, and nothing else; it is never taken as their tick in
the Dealer Center (see "Before the owner first signs in"). Alan's own
business, the local copy and the demo are not asked. To change the terms:
edit `tools/legal/make-legal-pdfs.py`, raise `TERMS_VERSION` and `TERMS_DATE`
there and `TERMS.version` and `TERMS.date` in `server/office/terms.js`
together, run the script (it writes the PDF, `docs/legal/terms.json` and the
papers list), and tell every customer about the new terms 30 days ahead (terms
section 19).

## Files

| File | Job |
|---|---|
| `server/office/index.js` | `createOffice(deps)` → `{handle, publicLot}`; the routes |
| `server/office/http.js` | reading requests, writing answers, the Origin check |
| `server/office/store.js` | reads, create-only and conditional writes, retry on a clash |
| `server/office/people.js` | sign-in, the first owner, invites, roles |
| `server/office/price-list.js` | saving, `cfg`, history and the words for each change |
| `server/office/built-check.js`, `model/built-check.js` | the every-size check on a save with How it's built numbers, and which finding is the business's own |
| `server/office/lots.js` | lots |
| `server/office/customers.js` | customers, list rows, activity, quotes, orders |
| `server/office/website.js` | public lot data and website quote requests |
| `server/office/pricing.js` | checking and pricing a design on the server |
| `server/office/email.js` | the optional emails |
| `server/office/netlify.js` | Netlify Blobs, Identity and environment |
| `server/office/account.js` | the business's Barnwright account: when changes stop, open lots, help from Barnwright |
| `server/office/terms.js` | the owner's agreement to the Barnwright Terms and Conditions |
| `legal/barnwright-terms.pdf` | the Barnwright Terms and Conditions, published on every business's site |
| `docs/legal/terms.json` | the same terms as plain text, with their short version, for the Control Room's sign-up page |
| `tools/legal/make-legal-pdfs.py` | makes the terms (the PDF and `docs/legal/terms.json`), Adding a New Customer, the Welcome Sheet, the Setup Questions, the Flyer and the Price Sheet (`docs/legal/`), and `docs/legal/papers.json`, the list the Control Room's Papers page reads |
| `server/office/control-room.js`, `license-core.js` | the control room's own check-in code, copied to plain JavaScript |
| `netlify/functions/tenant-diagnostics.mts` | Barnwright's support check |
| `netlify/functions/barnwright-check-in.mts` | checks in with the control room every six hours |
| `netlify/functions/deploy-succeeded.mts` | checks in with the control room right after each production deploy, so a new Dealer Center shows Connected within a minute |
| `docs/legal/terms-sha256.json` | the SHA-256 of every `docs/legal/terms.json` written for terms 2.2 or later, by version (`tools/legal/make-legal-pdfs.py` adds, never removes): which sign-up agreements this Dealer Center can take |
| `netlify/functions/office-api.mts` | serves `/api/office/*` and `/api/lots/*` |
| `netlify/functions/lot-designer.mts` | serves `/d/:slug/` with that lot's allowed websites |
| `dealer.html`, `ui/office/*` | the Dealer Center's screens (`ui/office/views/`), its frame and its look |
| `dealer.webmanifest`, `ui/office/app-icons/` | the Dealer Center as an app on a computer or phone (Install in Chrome and Edge, Add to Home Screen on a phone): its name, start page and black and gold icons; every build ships them (`tools/build-site.mjs`) |
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
| `server/office/help.js` | Help: questions to Barnwright, Barnwright's answers, problem reports |
| `ui/office/views/help.js`, `ui/office/help-answers.js`, `ui/office/help.css` | the Help screen, its short answers and its look |
| `ui/office/views/price-list/built.js` | How it's built on the price list: a style's boxes, the business-wide card, Check every size, the quiet check on open, the read-only lines |
| `tools/check-how-its-built.mjs` | How it's built in a real browser (owner, manager, the "try it" demo; 1280 and 390 wide) |
| `ui/problems.js` | reports an error nothing caught to the site's own server (the Dealer Center and every 3D designer page) |
| `ui/problems-start.js` | starts it on a 3D designer page before anything else, so a problem while the designer is still loading is reported too |
| `tools/check-help.mjs` | Help's rules, against a pretend control room and Sales Inbox |
| `tools/lib/fake-help-inbox.mjs` | the pretend Sales Inbox (the checks and `--control-room`) |
| `server/office/setup-access.js` | Barnwright setup access: when Barnwright may change things, the owner's Barnwright card, the visit, and what the check-in reports |
| `server/office/setup-lock.js` | the lock: what Barnwright may never change in a price list |
| `ui/office/visit-draft.js` | keeps a visit's unsaved work in the tab when the visit ends |
| `tools/check-setup-access.mjs` | Barnwright setup access's rules, against a pretend control room |
| `tools/check-setup-screens.mjs` | the Barnwright card, the preview and a visit, in Chromium |
| `tools/lib/setup-fixtures.json`, `tools/lib/make-setup-fixtures.mjs` | Barnwright setup access: an example of every request and answer (with TEST ONLY key pairs), and the script that makes and checks it (`--check`) |

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
more than one lot, **+ Customer**, **Help**, the person's menu with Sign out).
Navigation: a left column on wide screens, a bottom bar on phones (the first
four screens, the rest under **More**).

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
  Each style's editor ends with its "How it's built" boxes and "Check every
  size"; the tab ends with "How your buildings are built" (see "How it's
  built" above), and opens with a yellow note when numbers of the
  business's own no longer fit.
* *Doors & windows* — each door, window, light and fixture: name customers
  see, price, "Sell this". One that comes with a sold style or option says
  so and stays sold ($0 is fine).
* *Options* — dormers, ramps, electrical packages, shutters, door window,
  exterior light and per-square-foot upgrades (sell, price, rename), and the
  business's own options (name, how it is priced, price, and "Roof pitch
  at least" for an option like a steep roof).
* *Colors* — siding, trim and roof swatches to switch on and off, colors of
  the business's own, and the colors the 3D designer opens on.
A bar at the bottom counts unsaved changes: "6 changes", "See them", "Undo
changes", "Save for all lots", and what still needs fixing ("2 prices
missing", "Show me"). Leaving the price list with changes asks first. After
saving: "Saved. All 3 lots show the new prices now." with the change list,
and when building numbers changed, what the every-size check said and "See
the Lofted Barn in the 3D designer" (a lot's own designer link).
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

**Help** (`#/help`, everyone) — short answers with a search box ("website",
"price"); **Ask Barnwright**: "Your question", a line saying what goes with
it (the page you came from and a few technical details, never your
customers or prices) and **Send**; **Your questions** with each one's
"Waiting for an answer" or "Answered" and Barnwright's answers. Not
connected (and in the demo): the answers and one line with
support@barnwrightsoftware.com instead of the box. See "Help" above.

**Sign in** — email and password; "Make your login" (for people the owner
added); "Forgot your password?"; links from Netlify emails (confirm, invite,
reset) land here and are handled. Someone signed in but not added yet sees
"You're signed in as maria@…, but you're not on the team yet.
Ask the owner to add this email."

**First setup** (`#/setup`, the first owner, once; the menu is hidden
until it's done) — three steps: your business (your name, business name,
phone, email, and for a business Barnwright sells to "I have read and agree
to the Barnwright Terms and Conditions", with a link to the PDF; Next says
"Tick the box to agree to the Barnwright Terms and Conditions." until it is
ticked), your starting price list (every standard building at example
prices, or three buildings to start small — all example prices to change),
your first lot (showing the link it will get). Then "Your Dealer Center is
ready." with "Check your prices" and "Add your team". The designer links
stay closed until the owner picks "Open to customers" in Settings. When
Barnwright set up the price list before the owner's first sign-in, First
setup has two steps (your business, filled in from the price list, with the
terms box; your first lot), skips the starting price list and says above
them "Barnwright set up your price list. You can change anything."
