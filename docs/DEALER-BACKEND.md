# Company owners, dealer lots, and customer requests

Each client business has an **Owner/Admin** office above its dealer lots.
Owners/admins control the business's available buildings, options, and prices.
Each dealer sees customer requests for its assigned lot. The owner/admin sees
requests from every lot within the businesses they own or are assigned to.
Alan's separate platform administration and client billing are not implemented.

An order in this office is a **customer sales request**, not an accepted
purchase, payment, or signed contract. The office stores the request and lets
staff track it as new, contacted, quoted, ordered, or closed. No email, text,
or external webhook is sent by this backend.

## First setup

1. Deploy the functions and portal using the project's normal Netlify build.
   Enable **Netlify Identity** in the site's settings. Prefer invite-only
   registration for staff accounts. Identity must be enabled separately;
   adding source code does not establish a working login service.
2. Create the intended owner's Identity account and complete email
   confirmation. Set the function environment variable
   `OWNER_BOOTSTRAP_EMAIL` to that owner's exact email address. Do not put it
   in source files. No owner email is preconfigured in this project.
3. The confirmed owner signs into the portal. The backend atomically records
   that account as the initial owner. It never grants access to whichever
   person happens to visit first, never accepts profile metadata as a role,
   and never grants a platform-wide administration role.
4. After successful setup, remove `OWNER_BOOTSTRAP_EMAIL`. The membership
   persists. The one-time claim is locked to the original Identity account;
   changing the variable does not create another owner.
5. Create the company from a settings template, replace example contact
   details/prices, and verify its catalogue. A company may be suspended while
   this is being prepared; suspended companies cannot receive requests.
6. Create a lot with a unique address such as `port-charlotte`. Its customer
   designer is `/d/port-charlotte/`. Put that lot's link or embed on its own
   website. Add the exact HTTPS origins allowed to embed it, without paths
   or a trailing slash, for example `https://dealer.example`.
7. Create dealer accounts through the Identity administration interface.
   After confirmation, each staff member can sign in and copy their account
   ID. An owner/admin assigns the matching account ID and confirmed email
   to the appropriate lot in the portal. Adding office access does not send
   email or create an Identity account.

An existing membership cannot be overwritten through this initial interface.
Reassigning a dealer, removing a membership, or transferring company ownership
requires a deliberate administrative change to the private membership/company
records. A verified login alone grants no business access. An assigned admin
can create a new business they own; that business is invisible to unrelated
owners. There is no billing or global client-account management screen.

## Where information is stored

Production uses the site-wide Netlify Blobs store `dealer-office-v1`, so
company settings, dealer assignments, and requests survive a new deploy.
Preview deploys use their own deploy-specific store. Preview data does not
automatically appear in production or in another preview. Never enter real
customer data while testing a preview.

Only functions read and write private records. The static website must not
publish the `server/`, `netlify/`, test, dependency, or private data directories.
Company catalogue and public lot contact details are intentionally public;
customer contact details and memberships are not.

The backend uses strong reads, ETag conditional writes for changes, and
create-only writes for unique companies, lots, memberships, and orders. A
conflict returns HTTP 409 with a request to reload. A customer submission key
identifies exactly one request; retries return the same receipt. Reusing that
key for different data is refused. Customer order snapshots retain the
catalogue version, design, server price lines, received time, and original
company/lot assignment even after settings change.

Owners should include this store in their backup/retention process. The
Netlify administration interface can inspect stored data; access to the
hosting account must therefore be restricted to trusted administrators.
This initial office lists the latest 500 accessible requests and indicates
when more exist. It scans lot records when listing requests; larger volumes,
full-text search, exports, and automatic retention need a database/index and
separate product work. There is a bounded per-lot/IP submission limit; this
is basic abuse protection, not a CAPTCHA or comprehensive fraud service.

## API contract

All request/response bodies are JSON. Staff use the same-origin Identity
session cookie. Writes require `Content-Type: application/json` and an
`Origin` matching the function URL. Authenticated responses and public
receipts use `no-store`; there are no cross-origin API permissions. An iframe
on a dealer website still calls the API from the designer's own origin.
Errors are `{ "error": "Plain English explanation" }`.

| Route | Result or write body |
|---|---|
| `GET /api/dealer/me` | `{user:{id,email,name}, membership, companies, lots}`; an unassigned verified account has `membership:null` |
| `GET /api/dealer/companies` | `{companies:[{id,name,status,version}]}` |
| `POST /api/dealer/companies` | Owner/admin only: `{company:<full company settings>}`; returns `{company,version}` |
| `GET /api/dealer/companies/:id/catalogue` | `{company,version}` |
| `PUT /api/dealer/companies/:id/catalogue` | Owner/admin only: `{company,version}`; server increments both version and catalogue `cfg` |
| `GET /api/dealer/companies/:id/lots` | `{lots:[...]}` within caller's allowed scope |
| `POST /api/dealer/companies/:id/lots` | Owner/admin only: `{slug,name,phone?,email?,website?,embedOrigins?,active?}` |
| `PUT /api/dealer/companies/:id/lots/:lotId` | Owner/admin only: `{version,name?,phone?,email?,website?,embedOrigins?,active?}` |
| `GET /api/dealer/orders?companyId=&lotId=` | `{orders:[...],truncated}`; query filters can only narrow the caller's access |
| `GET /api/dealer/orders/:id` | `{order}` within caller's scope |
| `PATCH /api/dealer/orders/:id` | `{version,status}` where status is `new`, `contacted`, `quoted`, `ordered`, or `closed` |
| `POST /api/dealer/memberships` | Owner/admin only: `{userId,email,role:"admin"|"dealer",companyId,lotId?}`; dealer requires lot ID |
| `GET /api/lots/:slug` | Public `{company,lot,version}`; inactive lot/suspended company returns 404 |
| `POST /api/lots/:slug/orders` | Public `{design,contact,version,idempotencyKey}`; returns receipt only |

Memberships contain `userId`, `email`, `role`, `companyIds`, `lotIds`, and
creation details. Lot records contain `id`, `slug`, `companyId`, `name`,
`phone`, `email`, `website`, `embedOrigins`, `active`, and `version`. Lot IDs
equal their immutable globally unique slugs. There are at most ten embed
origins per lot. Changing a lot's name or contact details does not reroute
its existing customer requests.

`design` is the existing `model/design.js` saved-design format. `contact`
contains `name`, `phone`, `email`, `zip`, `address`, `note`, and optional
boolean `smsOk`. The API bounds strings, design items, numeric values, JSON
size, and nesting. The submission key must be 16–128 characters using
letters, digits, `_`, or `-`; `crypto.randomUUID()` is appropriate. Preserve
the key for a retry of the same data and make a new key for a different
request.

Order validation happens before the browser's saved-link compatibility
decoder. Building/item/option IDs must be strings, quantities and package
IDs must be finite numbers with the expected ranges, and switches must be
booleans. Electrical package IDs must be offered nonnegative integers; the
exterior electrical option requires a selected package. Malformed data is
refused with HTTP 422, without silently coercing it into a different design.

A public receipt contains `{id,total,price,version,receivedAt}`, where
`price` is `{base,lines:[[label,amount,key],...],total}`. It never echoes
customer contact details. Staff records additionally include company/lot
IDs and names, status, revision `version`, `catalogueVersion`, canonical
design, contact details, `receivedAt`, `updatedAt`, status history, and the
base lot `link`. Staff can encode the stored design into that link using
the existing sharing module.

The server resolves company and lot from the requested slug, never from
client-submitted routing fields. It rejects outdated catalogues and checks
included-item allowances and electrical-package allowances against the
actual standard loadout. It recalculates the total from stored company
prices. Sending a cheaper browser total, a forged company ID, or flags that
make additional paid equipment look free cannot change the saved price or
its destination.

## Verification and implementation references

Run `node tools/check-backend.mjs` for local tests using simulated storage
and Identity records. These cover tenant/lot isolation, privilege escalation,
confirmed-owner setup, stale settings, conditional writes, malformed inputs,
price manipulation, inactive lots, retries, and simultaneous submissions.
They also check standard designs/electrical packages from every shipped
catalogue at every offered size, including the exterior electrical option,
against existing price totals. The regression cases include forged negative
electrical packages and malformed arrays/objects in pricing fields. These
are not claims that a real
Identity service or deployed persistence has been configured or tested.

`server/dealer-backend.js` owns authorization and request handling;
`server/order-pricing.js` validates pricing allowances;
`server/netlify-runtime.js` connects verified Identity and Blobs;
`netlify/functions/dealer-api.mts` exposes the modern function routes.
`backendFor(context).publicLot(slug)` also supports the dynamic designer page
and its per-lot embedding policy.

The implementation was checked against the installed `@netlify/identity`
and `@netlify/blobs` code/types. This Identity version returns `confirmedAt`
on a full verified user record; its claims-only fallback does not contain
that property and is refused. This Blobs version returns `modified:false`
when `onlyIfNew`/`onlyIfMatch` preconditions fail. See the official
[Netlify Blobs reference](https://docs.netlify.com/build/data-and-storage/netlify-blobs/)
and [Functions reference](https://docs.netlify.com/build/functions/overview/)
for platform details.
