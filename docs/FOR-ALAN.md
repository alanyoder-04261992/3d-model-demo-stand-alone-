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
   **Share my design**, which makes a link that opens this exact building.

The price plate on the picture shows the total as the customer goes. A company
can choose instead to show a "from" price (the building on its own) or no price
at all (the plate then says "Ask us"), and a rent-to-own monthly figure or
none.

## The views

Four buttons sit over the top-left of the picture:

* **Outside** — the finished building, drawn exactly as Barnwright draws it.
  This is what opens first, and it turns slowly for ten seconds (not for a
  visitor whose phone asks for less motion).
* **Inside** — the floor plan, drawn like a builder's blueprint on navy paper:
  every wall, door (with its swing), window, roll-up, porch, outlet, light,
  bench, shelf and the ramp, with the width and length marked. Things can be
  picked, dragged and added on the plan too.
* **Framing** — the lumber inside the building: blocks and anchors, skids,
  floor joists and decking, studs with their headers round every door and
  window, trusses, the loft, the roof deck, and the benches, shelves and
  electrical boxes. The siding, roofing, doors and windows are hidden. A line
  just under the four buttons gives the sizes (stud size and spacing,
  trusses, joists), taken from the company's own construction numbers.
* **Watch it build** — the building put together in the order the shop builds
  it: site, blocks, skids, floor frame, decking, walls, siding, and so on up to
  the roof, doors, windows and extras. Each step is lowered into place with a
  caption saying what it is in real life. Play, pause, back, forward and start
  again; a step this building has nothing for is skipped; at the end it goes
  back to Outside.

A company can switch Framing, Watch it build and the floor plan off in its
settings.

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
* Their page is told when a quote was requested (for their own records or
  analytics). Telling it when the designer is ready and when the customer
  changes the building is written but not switched on yet (see "Not finished
  yet" at the end).

Each company's designer lives at its own address on the site you host
(/c/ and the company's id). The company never gets a copy of the files.

## Where quote requests go

This designer has no server of its own, so a quote request goes wherever the
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
8. **Skids: treated 4x6 on edge** (only the caption says so; the picture keeps
   Barnwright's skid).
9. **Porch: 4x4 posts, 2x6 deck joists, railing 34 in high.**
10. **The Watch it build order** (site, blocks, skids, floor frame, decking,
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

* The designer does not yet tell a company's page "ready" and "the customer
  changed the building" by itself (a quote request it already reports): the
  piece that does it (ui/embed-mode.js) is written and tested, but the
  designer page does not load it yet.
* A company that frames its roofs with rafters instead of trusses still reads
  the word "trusses" in the Framing line, and the roof-framing caption still
  talks about gusset plates and a bottom chord. The rafters themselves are
  drawn and checked; only the words have not caught up.
* The contract promises one more check that is not written yet: that every
  style's standard doors and windows land without being nudged, at every size
  of every company. Today the demo's are proved to be Barnwright's, and a new
  company's are looked at on its contact sheet.
