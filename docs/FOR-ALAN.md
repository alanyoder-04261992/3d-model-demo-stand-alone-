# The 3D shed designer — for Alan

<!-- WHAT THIS FILE IS: the plain-English guide for Alan. No code. What the
     designer does, how a new company is set up and put on its website, where
     quote requests go, what is still yours to decide, and how to ask Claude
     for a change. tools/check-docs.mjs proves every file and tool named here
     exists, and that every assumption the settings files mark is listed in
     "What you still need to decide". -->

This is Barnwright's 3D designer, on its own, so you can sell it to a shed
company that wants the designer and not the rest of Barnwright. It looks exactly
like Barnwright's (one check compares every triangle of 148 buildings,
another every pixel of 24 finished pictures), every
real part of a shed is its own piece with its own notes for Claude, and a new
company is one settings file rather than new programming.

Selling it — what a company gets, what they send you, what you charge for —
is in [SELLING.md](SELLING.md).

Start learning with the [10x16 Side Lofted Barn](examples/10x16-side-loft.md)
and [our building terms](BUILDING-TERMS.md). Start at
`learn.html?company=learning-side-loft` to build from the floor, revealing
pieces by hand and agreeing on each part before moving on. The regular
designer still offers the finished building as a reference. Use the
[shed-customer-setup skill](../.agents/skills/shed-customer-setup/SKILL.md)
to reuse the terminology and setup steps for the next customer.

## What the customer can do

The page has the 3D building on one side and six cards on the other:

1. **Pick your building** — the styles the company sells, in their groups
   (and the dormer size on a Dormer Shed).
2. **Size** — only the sizes the company sells, at its prices (and the porch
   on a side cabin).
3. **Colors** — siding, trim, doors, shutters and roof, from the company's own
   colour list, each with its name.
4. **Doors & windows** — add a door, window, roll-up, light or porch post. Tap
   one on the building to pick it: drag it along its wall, send it to another
   wall, swap it for a bigger one, add shutters or a window in the door,
   make a window a double window, or remove it. Press and hold on a bare wall
   for "Add here".
5. **Inside & upgrades** — work benches, shelves, an electrical package,
   a ramp, the per-square-foot upgrades (double floor, 12 in joists, moisture
   and radiant barriers) and any extras the company adds of its own.
6. **Your quote** — the price with everything in it, a quote request form, and
   **Share my design**, which makes a link that opens this exact building. When
   the business shows rent to own, a box under the price has a button for each
   term (36, 48, 60 months) and "As low as $183.89/mo". The form asks the
   address as Street and City, and "What do you want to do with this quote?"
   with your four answers, the same as your own site. Nobody has to answer it.
   "Copy link to this building" is in the Dealer Center, where your team
   designs for a customer, not here.

The price plate on the picture shows the total as the customer goes. A company
can choose instead to show a "from" price (the building on its own) or no price
at all (the plate then says "Ask us"), and a rent-to-own monthly figure or
none.

## The views

Two buttons sit over the top-left of the picture:

* **Outside** — the finished building, drawn exactly as Barnwright draws it.
  This is what opens first, and it turns slowly for ten seconds (not for a
  visitor whose phone asks for less motion).
* **Inside** — the floor plan, drawn like a builder's blueprint on navy paper:
  every wall, door (with its swing), window, roll-up, porch, outlet, light,
  bench, shelf and the ramp, with the width and length marked. Things can be
  picked, dragged and added on the plan too.
A company can switch the floor plan off in its settings. The Framing and
Build tabs are removed from every customer designer.

The construction lessons and reusable skills are our internal onboarding
notes. We use them to understand how each company builds and prepare its
models; customers do not receive the lessons or skills with their designer.
The separate learning preview remains available for our work together.

## Setting up a new company

A company is **one settings file**, in its own folder under companies/. It
holds the company's name, phone, colours, logo, which styles it sells, every
price, where quote requests go and which websites may show it. Everything else
(how the buildings are drawn, the doors and windows, the colours they can pick
from) is shared.

Ask Claude something like: *"Set up Acme Sheds as a new company. Here is
their price spreadsheet, their colours are dark green and gold, their website
is acme-sheds.com and quote requests should go to their Formspree form. Use the
new-company skill."* The skill walks Claude through it. What happens:

1. **Collect what the company sends you.** The checklist is in
   [SELLING.md](SELLING.md): a price spreadsheet, their colours and logo,
   phone and e-mail, their website address, and where quote requests go.
2. **One command writes the settings file** — the new-company tool
   (tools/new-company.mjs). It copies the template, puts in the name, phone,
   colours and styles, reads the price spreadsheet, checks the file exactly
   the way the designer will, and prints a numbered list of what is still to
   do in plain words. It never guesses a price: anything the spreadsheet did
   not give stays at **$1** so it can't look believable by accident.
3. **Prices can be put in or changed any time** from a spreadsheet — the
   import-prices tool (tools/import-prices.mjs). It can also write the
   company's prices back out as a spreadsheet: the easiest way is to set the
   company up, send them that sheet to fill in, and read it back. Buildings can
   be written the way people write them ("Utility Shed, 10 x 16, $5,190");
   doors and windows go by the short codes the sheet already has in it.
4. **Look at every building.** The contact sheet (setup.html) shows every
   style and size the company offers, drawn with its standard doors and
   windows, with the price the designer will show. Print it or screenshot it
   and send it to the company to sign off. Claude opens the designer itself
   for the company as well. The contact sheet shows the buildings' prices
   only: the door, window and upgrade prices are in the spreadsheet the
   import-prices tool writes out, and none of them may still be $1.
5. **Allow their website.** Their web address goes into the settings, and the
   build-headers tool (tools/build-headers.mjs) writes the file that tells
   browsers which websites may show this company's designer. Any other website
   that tries to show it gets an empty box.
6. **Publish** the new settings to the site you host (see "Where it lives on
   the web" under What you still need to decide), and send the company the
   two lines for their website.

The list-companies tool (tools/list-companies.mjs) shows every company at a
glance: whether its file loads, active or suspended, when its licence renews
(and "OVERDUE"), its styles, where its quotes go and which websites show it.

## Putting it on a company's website

The company's web person pastes **two lines** into the page where the designer
should go (the exact lines are in [SELLING.md](SELLING.md)). That is all they
do. What their visitors get:

* The designer loads only when a visitor scrolls near it, so their page stays
  fast.
* It fits the page width, with a **Full screen** button; on an iPhone it is
  laid over the whole page instead, with a Close button.
* On a phone, a "Tap to design" cover lets a finger scroll past the designer
  without spinning the building, until the visitor taps it.
* A shared design link on their page opens that building.
* Their allowed website is told when the designer is ready, when the design
  changes and when a quote was requested. On a lot's link, the customer's
  contact details go only to the Dealer Center.

Each company's designer lives at its own address on the site you host
(/c/ and the company's id). The company never gets a copy of the files.

## The Dealer Center

The Dealer Center is the private side of the designer, at **/dealer** on the
site. One shed business runs everything from it:

* **The owner sets the price list once** — which buildings are sold, every
  size and its price, the doors and windows, the options and the colors.
  Every lot uses that one price list, so when the owner saves a change,
  every lot's 3D designer shows it right away. Quotes a customer already
  has keep the price they were given.
* **The owner can add sizes and building styles.** A style can be one of the
  builder's styles, renamed if they like, or their own style "built like" one
  of them (for example a "Premium Lofted Barn" that looks like the Lofted
  Barn but has its own sizes and prices). A "Change prices" button raises or
  lowers a whole group at once (say, every barn 5%), with a preview first.
  Every save is kept with a list of what changed, and an older price list
  can be put back.
* **Lots.** Each lot gets its own 3D designer link and the two lines of
  website code for its own website. A lot can be closed and opened again.
* **Team.** The owner adds people by email: an **owner**, a **manager** (sees
  every lot, can't change prices or people) or a **dealer** (sees only their
  own lots). The person makes a login with that email and they're in.
* **Customers.** Every quote sent from a lot's 3D designer becomes a customer
  of that lot (the same person sending again is added to their file, not
  doubled up). Walk-ins and phone calls are added by hand. Each customer has
  a stage — New, Contacted, Quoted, Sold, Delivered or Lost — a follow-up
  date, notes of every call and text, their quotes, and their orders.
* **Signing up a new company.** Your step-by-step guide from "yes" to live:
  `docs/legal/Barnwright-Adding-a-New-Customer.pdf`. You send them the
  Sign-Up Form, the terms and the questions they answer so you can set them
  up and build their buildings their way:
  `docs/legal/Barnwright-Setup-Questions.pdf`. Their owner ticks
  "I agree to the Barnwright terms" in the Dealer Center's first setup, and
  Settings shows who agreed and when. It's one product: $250 a month from
  go-live, no build fee, and each lot after the first is $250 one time.
  Every business gets its own `name.barnwrightsoftware.com` address. All
  four papers are also on the **Papers** page of your control room, always
  the latest version.
* **Designing for a customer.** "Design a building for them" opens the lot's
  3D designer inside the Dealer Center; "Save quote" puts the building and
  its price on the customer's file. "Copy link to this building" copies a
  link to the lot's designer with that exact building in it, every door and
  window where you put it, to text or email to the customer. That button is
  only for your team; the designer link customers use doesn't have it.
* **Orders.** "Mark sold" turns a quote into an order with the same number
  (#1042): cash, rent-to-own or financing, the deposit, the delivery address
  and date. The order moves Sold → Sent to builder → Ready → Delivered, and
  prints as an order sheet with signature lines.
* **Today** shows each person who to call today, who is new, the deliveries
  coming up and the month's numbers.

Every price a customer sees is worked out again by the server from the price
list, so nobody can change a price by tampering with the page.

To try it with a made-up business (Sample Storage Barns: three lots, five
people, thirty customers), open `/dealer` on your demo site
(3ddemo.barnwrightsoftware.com; barnwright-demo.netlify.app works too) or on
your learning preview site, leave the email and
password empty and tap **Sign in**. The demo site has no lessons, so it is
the one to show shed companies. Nothing you do there is saved or
sent anywhere. Sites you sell to a shed company never have this: their
sign-in always needs a real email and password. On your own computer,
`npm run office` does the same with the sample business. How it is put on a real website is in [the Dealer Center
guide](OFFICE.md).

### Connected to your control room

When you sell the Dealer Center to a shed company, you make the company in
your control room, take its payment there and make its activation key. The
key and four other settings go into the company's Netlify settings (the
list is in [the Dealer Center guide](OFFICE.md)). From then on:

* **It checks in with your control room** every few hours and gets a pass
  good for 7 days.
* **If they stop paying, or you switch them off,** changes stop the next time it
  checks in. They can still look at and download all their customers and
  orders, and remove a person from their team. Every screen tells them why.
* **Their 3D designer links close** and show "Our 3D designer isn't open
  right now" with the lot's phone number, because a new quote is a change.
* **If their site can't reach your control room for 7 days,** the same
  thing happens until it can. Their owner gets a warning a day after it
  last checked in, with the day it will happen.
* **The number of lots in their plan** (the dealership limit you set in the
  control room) is how many lots they can have open. The Lots screen says
  "3 of 3 open lots in your Barnwright plan" and turns off **Add a lot**
  when they're at the limit.
* **Help from Barnwright:** their owner can switch it on in Settings for 1 to
  24 hours. Then **Run customer diagnostics** in your control room checks
  how their Dealer Center is running. You never see their customers or
  prices, and it turns itself off when the time is up. They can see each
  check in a short list under the switch.

Your own business isn't connected to a control room, so none of this ever
limits it. On your own computer, `npm run office -- --control-room` shows
what a connected company sees.

### Older company links (without the Dealer Center)

Existing static company links can still send quote requests wherever the
company already receives things. One choice per company:

* **None** — a showroom: no quote form, just the building and the price.
* **A form service** they already use (Formspree, Basin, Web3Forms, Netlify
  Forms). The request arrives like any web form, with the customer's details,
  the building, the total, a summary and a link to the design.
* **E-mail** — opens the customer's own e-mail app with everything filled in,
  addressed to the company. The customer still has to press Send.
* **A webhook** — for a company with its own system (Zapier, Make and the
  like). It can include pictures of the building and the floor plan if they
  want them.
* **Their own web page** — the request is handed to the page the designer
  sits in, for a company whose web person wants to handle it themselves. Only
  their own website (from the allowed list) can receive it.

The company chooses which boxes are asked (name, phone, e-mail, ZIP, delivery
address, a note) and whether each is required, and can add an un-ticked "you
may text me" box in their own words. Two quiet checks stop robots. **If a
request can't be sent** (the service is down, or it's e-mail), the customer is
shown the company's phone number to call or text, a "Copy my design link"
button and the summary — a lead is never lost to a dead end.

The link in a quote request opens the design **look-only** and prices it from
the company's price list **on the day it is opened**. The price the customer
saw rides along; if the list has changed since, the page says so. The price in
a quote request was worked out in the customer's browser, so a company should
always go by the building and its own list, not by the number alone.

## Switching a company off

In the company's settings, the status can be set to **suspended**. The designer
then says "This designer is not available" with the company's phone number,
on their website and at their own address. Setting it back to active turns it
on again. Nothing switches off by itself when a licence renewal date passes:
the list-companies tool shows it as OVERDUE, and the decision is yours.

## What you still need to decide

### Building facts we had to choose

**Floor lesson update, September 27, 2026:** you have now confirmed the names
**skids** and **notches**. For the 10x16 example the skids are nominal 4x6,
actual 3 1/2 x 5 1/2 in, total length 16 ft. Crosswise nominal 2x6 members,
actual 1 1/2 x 5 1/2 in, sit in notches cut 1 in down into the skid tops.
You confirmed 16 in on center as standard and extra notches for the 12 in
on center option; the extra cuts can be unused with the standard spacing.
Your photos corroborate the connection, and the dimensions are from your
words. The photos are not published with the lesson. You also confirmed
that the skids are treated wood.

The top end notches run 3 in inward from one tip and 1 1/2 in from the
other, both 1 in deep, without a raised lip beyond the cut. You confirmed
45-degree bottom-corner cuts sloping upward toward the tips, reaching
**3 in back from each end**. The resulting 3 in rise is calculated from
that reach and angle. With the notch seat 4 1/2 in above the bottom, the
remaining vertical end face is a calculated 1 1/2 in high. The unequal
top notches have no agreed front/back assignment. You later confirmed
**two boards at one end and one at the other**. The pair fits the 3 in cut,
and the single fits the 1 1/2 in cut; that mapping and placement are derived
from fit, not an agreed shop front/back name.

You clarified that the 30 in skid offset is from the **outside of the wall
to the inside face of the skid**, toward the middle of the floor. The
confirmed 3 1/2 in width puts the center 28 1/4 in from that wall. For the
current pair across a nominal 10 ft width, that gives 63 1/2 in between
centers; the skid count itself is still provisional. Repeated-notch
first-center placement, cut clearance, outer-board height and length,
remaining long-board dimensions and unspecified flooring product details also remain open.
Your nominal/actual examples are now recorded as 2x4 =
1 1/2 x 3 1/2 in, 2x6 = 1 1/2 x 5 1/2 in and 4x6 = 3 1/2 x 5 1/2 in;
other lumber sections have not been confirmed by these examples.
You accepted the skid render and asked for the next part, then confirmed
**floor joist** for the crosswise 2x6 seated 1 in down in the skid notches.
You then confirmed a **10 ft outside floor width** with a **1 1/2 in outer
board on each side**, making the joists 3 in shorter. That rule gives a
calculated **117 in / 9 ft 9 in** joist length. We have not treated it as a
separate field measurement. You also confirmed that these floor joists,
outer boards and end boards are **treated wood**, and asked for grain and
knots that differ between boards. Their patterns stay stable while you
move the view. This does not confirm deck treatment, species or grade.
You also described the **Board the mule hooks onto** when dragging the
barn: a **flat treated 2x4**, **93 in long**, behind the double end boards,
resting on the skid tops. That length converts to **7 ft 9 in**. The
section is 3 1/2 in horizontal by 1 1/2 in vertical, putting its top at a
calculated 7 in above the skid bottoms. The model centers it sideways for
now; you have not confirmed that placement. No formal shop name, hardware
details or load rating has been supplied.
You now confirmed **Flooring** as the sheet layer: **4x8 ft tongue and
groove, 5/8 in thick**, with staggered seams and the last row trimmed.
The first row is 8+8 ft, and you explicitly confirmed the second row as
**4+8+4 ft**. The third row repeats 8+8 ft with a calculated **2 ft width**
remaining (`10 - 4 - 4`). The seven laid pieces cover the model's actual
10x16 ft frame outline without changing its timbers. The one modeled layer,
manufacturer net coverage/profile, sheet material and treatment are not
additional confirmed facts; no stock-sheet purchase count is implied.
The current manual view is `learn.html?company=learning-side-loft&step=deck`,
showing skids, frame and flooring together. Earlier frame and joist views
remain available. “Outer board” and “Flooring” are your recorded wording.
“Rim joist,” “end joist” and “floor frame” remain proposed technical names.
The
opt-in learning model uses the corrected sections and notched seating; the
normal finished reference keeps its earlier drawing dimensions. See the
[example's current record](examples/10x16-side-loft.md#floor-measurements-to-show).

The older notes below record the background defaults; they do not establish
those remaining details for the current lesson.

Barnwright's designer never drew any framing, so the framing needed numbers
it never had. These came from your shop (through Barnwright's notes, and your
answers for the Yoder site) and are settled: 2x6 floor joists on the skids
(2x4 on 8 ft wide and narrower), 16 in on centre (your answer: 16 in is
standard, 12 in is the upgrade), 5/8 in decking in 4x8 tongue-and-groove
sheets, one bottom plate and two top plates, 75 in studs on loft walls and
89 in on tall walls, the skid positions from your build sheet, door openings
71½ in on barns and 76½ in on tall walls, the work bench 2 ft deep and 3 ft
high, the shelf 1 ft deep and 5 ft high, and a double floor being a second
layer of decking.

**These we chose, and the settings mark some of them as ASSUMPTIONS. Please
confirm or correct each one** (a correction is a one-line settings change, for
everybody or for one company):

1. **Loft depth: 4 ft at both ends** on every lofted style: Lofted Barn, Side
   Lofted Barn, Lofted Barn Cabin, Loft Side Cabin, Deluxe Loft Side Cabin,
   Lofted Barn Garage and Metal Lofted Barn. Marked as an assumption in the
   manufacturer file. Also: loft joists 2x6 at 16 in, a
   5/8 in loft floor, laid at the top of the wall.
2. **Ground anchors: 4** on buildings up to 16 ft long, **6** up to 28 ft,
   **8** longer. Marked as an assumption — please check against the master
   anchor plan.
3. **Blocks: 4x8x16 concrete blocks, one per 4 ft of outside wall.** Your own
   website and Weather King disagree on the block size (4x16x16 against
   4x8x16); we used Weather King's.
4. **Roof deck: 7/16 in OSB** on painted buildings; **2x4 purlins laid flat,
   24 in apart** on metal buildings.
5. **Roof framing: trusses** (not rafters) **24 in on centre**, 2x4 chords,
   plywood gussets.
6. **Walls: 2x4 studs 16 in on centre, three-stud corners**; headers 2x6
   doubled over openings up to 4 ft, 2x8 doubled up to 6½ ft, 2x10 doubled
   wider.
7. **Rim joists: 2x6** along both long sides of the floor.
8. **Skids:** the 4x6 nominal / 3 1/2 x 5 1/2 in actual section and 16 ft
   length are now confirmed for this lesson, with the notched connection
   described above. Treatment and the remaining placement/cut details have
   not been newly confirmed. The ordinary finished reference keeps
   Barnwright's older skid; the learning page uses the corrected section.
9. **Porch: 4x4 posts, 2x6 deck joists, railing 34 in high.**
10. **The internal construction sequence** (site, blocks, skids, floor frame, decking,
    walls, siding, porch posts, trusses, dormer framing, loft, gable ends, roof
    deck, roofing, dormer, trim, porch, doors, windows, extras, inside, ramp).
11. **The two width notes** shown on 12 and 14 ft wide buildings: "A 12 ft wide
    building is 11 ft 2 in actual" and "14 ft wide needs a permit or pilot
    car."

All of these live in two files: library/construction.json (how the sheds are
built) and library/manufacturers/standard.json (the styles, including the
loft). Any company can build differently in its own settings.

### Choices about the product

1. **The light for new companies.** New companies start with **true colour**
   (grey daylight, so a paint colour looks like its chip — the look you chose
   for the Yoder site on Sep 20 2026). The demo keeps **Barnwright's warm
   late-afternoon sun**, which is the look the golden check proves. Which should
   a new company get by default?
2. **Where it lives on the web.** Everything is ready for you to host it on
   Netlify (the files say how), with each company at its own address. The site
   itself and its web address are yours to set up — the address goes into the
   two lines companies paste.
3. **What you charge**, and whether a company may remove the small "3D
   designer by Barnwright" line (white-label) for a higher price. The line is
   on by default; turning it off is one setting.
4. **Self-hosting.** A company's settings can say "self" instead of "hosted",
   but there is no packaged way yet for a company to run it on its own server.
   Decide whether you offer that at all.
5. **Renewals.** Nothing stops a company's designer when its renewal date
   passes; you suspend it by hand. Decide whether you want that automatic.

## Asking Claude to change something

* **A part of the building** (the loft, a door, the roofing, the studs): every
  part has its own notes, called a skill. Start with *"Read the part-loft skill
  first, then …"* — the skill says what the part is in real life, which
  numbers come from you, what must not move so the finished look stays
  Barnwright's, and which checks prove it. Claude updates the notes after the
  change. The parts gallery (parts.html) shows every part on its own and names
  its skill.
* **How a company builds** (24 in stud spacing, 12 in joists as standard,
  rafters instead of trusses): that is a settings change, not a part change —
  *"Use the change-construction skill: Acme builds with 2x6 studs at 24 in."*
* **A new building style**: *"Use the add-a-style skill to add a …"*
* **A new real-life part** (something the shop builds that isn't drawn yet):
  *"Use the add-a-part skill."*
* **Anything that might change how the finished building looks**: *"Use the
  check-the-look skill."* The finished building must stay exactly Barnwright's
  unless you decide otherwise; the checks catch it if it doesn't.

After any change Claude runs the checks. Each one says in plain words what it
proved; the full list is in [the README](../README.md).

## Not finished yet

* Each business's Dealer Center needs Netlify Identity turned on and the
  owner's email set once (the steps are in [the Dealer Center guide](OFFICE.md)).
  Emailing a lot when a quote arrives needs an email service key; without it
  everything else works the same. Taking payment from a business happens
  in your control room; turning on live payments there is still to do.
* The control room's own screens and messages still say "HQ" (for example
  "enable support in HQ Setup"). For a Dealer Center company that switch is
  **Help from Barnwright** in their Settings.
* Some internal part descriptions still assume trusses and their framing
  description talks about gusset plates and a bottom chord. The rafters themselves are
  drawn and checked; only the words have not caught up.
* The contract promises one more check that is not written yet: that every
  style's standard doors and windows land without being nudged, at every size
  of every company. Today the demo's are proved to be Barnwright's, and a new
  company's are looked at on its contact sheet.
