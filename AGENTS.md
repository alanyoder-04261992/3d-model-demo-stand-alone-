# The standalone 3D shed designer

Read [CLAUDE.md](CLAUDE.md) for the repository's architecture and part rules.
This project is separate from Barnwright; never modify the Barnwright repository.

For customer setup, terminology, or a new buyer's design, use
[shed-customer-setup](.agents/skills/shed-customer-setup/SKILL.md).
[BUILDING-TERMS.md](docs/BUILDING-TERMS.md) is the shared glossary, and
[the 10x16 example](docs/examples/10x16-side-loft.md) records Alan's
confirmed style and current floor-first, manual learning approach. Keep model defaults and unconfirmed shop
assumptions distinct from facts Alan or a builder has confirmed.

A dealer/company gets one settings file; an individual shed buyer gets a
design within that company's catalogue. Read an existing part's skill before
changing it, and update that skill with any part change. Preserve finished
geometry unless a visual change is requested.

Validate company files with `node tools/list-companies.mjs`; run
`node tools/check-all.mjs --fast` for the checks without a browser. The legacy
automated browser checks target a Linux Playwright installation. On other
systems inspect the local designer with available browser tooling and state
which checks ran. Never report skipped checks as passed.
