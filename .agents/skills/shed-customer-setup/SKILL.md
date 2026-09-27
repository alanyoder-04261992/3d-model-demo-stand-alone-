---
name: shed-customer-setup
description: Set up a shed company or an individual buyer's design in the 3D stand alone repository, and learn or agree on building terms using the visible 10x16 Side Lofted Barn example. Use when Alan asks to onboard a designer customer, start a shed design, or clarify what a building part is called.
---

# Shed customer setup

Work in this repository. Start with the relevant entries in
[the building terms](../../../docs/BUILDING-TERMS.md) and
[the 10x16 Side Lofted Barn example](../../../docs/examples/10x16-side-loft.md).
These hold the confirmed vocabulary, proposed labels and first worked example;
refer to them instead of copying the glossary into each customer's files.

## Choose what is being set up

- A **shed company or dealer buying the designer** gets
  `companies/<id>/company.json`. Reuse the existing company when updating it.
  Follow the relevant steps in [new-company](../../../.claude/skills/new-company/SKILL.md).
- A **person buying a shed** gets a design within their dealer's existing
  catalogue. Select the style, size, colours and openings, then save or share
  the design using the existing designer. Do not create a new company for
  each shed buyer.
- A **learning exercise** can start at
  `/?company=learning-side-loft` after `npm run serve`. Its only building is
  the 10x16 Side Lofted Barn (`SLB`), with prices hidden and quotes off.
  This example is not a customer's price book.

Use facts already provided or recorded. Ask only for missing information that
affects the current result; a learning exercise does not need a complete
company intake. Preserve the user's selected scope and view choices.

## Learn the terms together

Start with the building and view currently visible to Alan. During terminology
learning, discuss one physical part at a time. Locate it in plain visual words
before naming it: its position, appearance, and a nearby feature Alan can see.
Point it out or annotate the view when the available tools make that useful.
Stay with visible parts when the user has chosen the finished building.

Propose a name as a draft, then ask whether the description identifies the
same part and what Alan's shop calls it. For example: "I mean the white outside
panels around the double doors. I'd call those siding. Is that the part and
name you mean?" Allow Alan to confirm or correct it before introducing the
next term. Do not ask him to approve a whole glossary at once.

Code names and conventional building words are useful source mappings, but
neither proves that a name is agreed with Alan. Keep those mappings marked as
proposed until he confirms the referent and wording. Promote only the name he
confirms to the shared confirmed vocabulary. Agreement on a name does not
confirm dimensions, materials or construction methods.

## Keep the building facts straight

For model inputs, **10x16** means width × length in feet. `SLB` is the model's
standard Side Lofted Barn; Alan confirmed that "side loft" means a lofted barn
with a side entrance. Read the example for the model's wall letters and opening
locations before moving a door or describing a side. Explain these conventions
when needed instead of assuming the user already knows them.

Distinguish what the current software draws, what Alan or the builder has
confirmed, and what the data marks as an assumption. For example, the standard
SLB loft depth is marked `assumed` in the manufacturer file. A displayed
dimension is not evidence that a shop builds it that way.

Trace a term or setting to its source as needed:

- [Manufacturer catalogue](../../../library/manufacturers/standard.json):
  style names, traits, standard openings and colours; no prices.
- [Construction defaults](../../../library/construction.json): construction
  values and explicit assumption flags.
- `model/`, `parts/`, and the relevant `.claude/skills/part-<id>/SKILL.md`:
  how the model resolves and draws a particular part.
- `companies/<id>/company.json`: that company's offer, prices, starting
  building, appearance and enabled views.

When Alan confirms or corrects a term, update the shared glossary and the
affected worked example. Record the preferred wording, the physical part it
identifies, any useful old alias, who confirmed it and when, and whether it
applies to one builder or the shared line. Preserve useful source-code mappings
as draft mappings if their shop meaning is not yet agreed. Keep uncertain
facts visibly uncertain. Change construction data only when the task calls
for it, using [change-construction](../../../.claude/skills/change-construction/SKILL.md).
Company names, prices, sizes and feature choices belong in company settings;
read [add-a-style](../../../.claude/skills/add-a-style/SKILL.md) if another
builder needs different style traits or standard openings.

## Reuse the company setup

Use `node tools/new-company.mjs` and `node tools/import-prices.mjs` as described
in the existing workflow. Run commands from the repository root. For a visitor
starting on this example, set `defaults.style` to `SLB` and `defaults.size`
to `10x16`; that style and size must also exist in `offer`.

For this learning company, `features.framingView` and `features.buildPlayback`
are `false`, and `features.floorPlan` is `true`. Use those switches rather than
removing shared rendering code. They are this example's choices, not defaults
to impose on future customers.

A company inherits no prices. Use its supplied prices; never substitute demo
or golden-test prices. The setup tool uses `$1` placeholders when prices are
missing. Keep missing prices explicit in unfinished work. After generating a
new customer draft with missing prices, use `pricing.show: "none"` and
`leads.mode: "none"` while pricing is unsettled, just as for the learning
showroom. This is a default for new drafts; respect an explicit user choice
for a preview, and do not silently change a live company's settings. Hidden
prices still exist in the data. Before treating a draft as ready for customer
quotes, replace placeholders with that company's supplied prices and finish
its requested quote setup.

## Verify and preserve the result

For company edits, run `node tools/list-companies.mjs` and
`node tools/check-all.mjs --fast`. Open the affected designer and check the
starting style/size, standard openings and enabled views. Use the contact sheet
at `setup.html?company=<id>` when reviewing a company's offered range.
Rebuild `_headers` with `node tools/build-headers.mjs` after adding a company
or changing its embed/lead settings, then check with `--check`.

Browser checks in this repository currently reference Linux Playwright paths.
On another machine, use available browser tooling to verify the result and
report which automated checks could not run; do not claim they passed.
For terminology-only edits, verify source facts and relative links and run
`node tools/check-docs.mjs` where applicable.

Keep the glossary, example and skill changes together in version control.
When GitHub work is requested, follow the repository's branch/PR workflow and
report the resulting link or the concrete reason publishing was unavailable.
Company setup alone does not authorize a production deployment or contacting
the company's customers.
