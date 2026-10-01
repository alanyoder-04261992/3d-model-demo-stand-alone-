# The standalone 3D shed designer

Read [CLAUDE.md](CLAUDE.md) for the repository's architecture and part rules.
This project is separate from Barnwright; never modify the Barnwright repository.

For customer setup, terminology, or a new buyer's design, use
[shed-customer-setup](.agents/skills/shed-customer-setup/SKILL.md).
For measurements or a different building size, use
[shed-measurements](.agents/skills/shed-measurements/SKILL.md) to calculate from
the new dimensions and the agreed construction rules.
For Alan's utility style, use [utility-framing](.agents/skills/utility-framing/SKILL.md):
89-inch wall studs, the flat top window plate, studs above openings and A-frame roof pitch.
[BUILDING-TERMS.md](docs/BUILDING-TERMS.md) is the shared glossary, and
[the 10x16 example](docs/examples/10x16-side-loft.md) records Alan's
confirmed style and current floor-first, manual learning approach. Keep model defaults and unconfirmed shop
assumptions distinct from facts Alan or a builder has confirmed.

A dealer/company gets one settings file; an individual shed buyer gets a
design within that company's catalogue. Read an existing part's skill before
changing it, and update that skill with any part change. Preserve finished
geometry unless a visual change is requested.

The management portal stores validated company configuration and dealer lots
on the server. Each business has an Owner/Admin who controls prices and options;
dealer staff can access only assigned orders. Alan's own platform billing is
separate and deferred. Never trust browser prices, recipient IDs or user-editable
role metadata. Construction lessons and skills are internal setup knowledge,
excluded from the default customer build; see `docs/DEALER-BACKEND.md`.

Validate company files with `node tools/list-companies.mjs`; run
`node tools/check-all.mjs --fast` for the checks without a browser. The legacy
automated browser checks target a Linux Playwright installation. On other
systems inspect the local designer with available browser tooling and state
which checks ran. Never report skipped checks as passed.

Alan's standing GitHub instruction is to merge completed, checked updates
for this project into `main`, unless he requests another destination or asks
to hold a particular update. Do not leave an otherwise ready pull request
waiting for another merge confirmation. Keep required checks and repository
protections in place, and merge the exact reviewed head commit.
