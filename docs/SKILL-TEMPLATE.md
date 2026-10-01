# The skill file every part carries

Alan asked for "a skill for each part". Every real-life part of a shed has one
module in `parts/` and one skill file at `.claude/skills/part-<id>/SKILL.md`,
where `<id>` is the part's `id` (the module's file name). A Claude session
that is about to change a part reads its skill first, and updates it after.

These skills and the construction-learning/framing studies are internal
setup tools. Alan clarified on October 1, 2026 that their purpose is to make
new customer building setup faster. Keep lessons and study controls out of
the shipped customer designer; carry applicable confirmed construction
rules into its company settings and model. Record unknown fits explicitly
instead of treating a learning preview as an approved customer default.

`tools/check-parts.mjs` enforces the layout below: a part that is no longer a
stub (`pending` is gone) with no skill file fails, a `part-*` skill with no
part fails, and a skill missing the frontmatter or one of the eight required
`##` sections fails. Write for someone who knows sheds but not this code --
Alan does not read code, and the next session does not remember this one.

## The layout (copy it; keep the headings word for word)

```markdown
---
name: part-<id>
description: <One sentence: what this part is on a real shed and what the skill helps with, e.g. "The skids (runners) under a portable building -- read before changing where they sit or how they are drawn.">
---

# <The part's name> (`parts/<file>.js`)

## What it is in real life

Plain words: what the part is on a building the shop builds, what it is made
of, where it sits, what it does. No code.

## Stage

The building step(s) its triangles carry (`parts/stages.js`), and what that
means in each view: Finished, Framing, Watch-it-build. Name the PIPELINE
entry it runs at (`parts/index.js`) and why there.

## Construction settings

Every `plan.construction` value the part reads (e.g. `skids.table`,
`floor.spacingIn`), what it means, its default in `library/construction.json`,
and what a company changing it does to the drawing. "None" is a valid answer.

## Where it came from in Barnwright

The Barnwright source it was ported from: `public/3ddesign.html` line numbers
(pinned file SHA-256 `0bdcf663...`, see `tools/lib/barnwright-blocks.mjs`),
the function names, and every porting edit made (only the ones in
`docs/ARCHITECTURE.md` "Porting rules" are allowed). A NEW part (framing,
ramp) says "new -- Barnwright drew none" and names what it fits into.

## The owner's facts

Every real-life fact from Alan (measurements, how the shop builds it, dates
and his own words when there are any), copied from the comments in the code.
These comments are kept in the code AND here. If there are none, say so.

## Kept quirks

Barnwright numbers that look odd but are kept because the picture depends on
them (and why). "None" is a valid answer.

## How to change it safely

What to run before and after, what must not move, which numbers are
look-defining, and how to re-record the golden fixtures on purpose if the look
really must change (`node tools/capture-golden.mjs`, with a reason).

## Checks that guard it

The `tools/check-*.mjs` commands that prove this part, and what each proves
(e.g. `node tools/check-golden.mjs --part skids`: every skid triangle of all
148 recorded buildings, number for number).
```

## Rules

* The frontmatter `name` is exactly `part-<id>`; `description` is one line.
* The eight `##` headings above are required, in any order, spelled as shown
  (the check compares them ignoring case). Add more sections if useful.
* A part's `realLife` caption (in the module) is a template: `{a.b}` is the
  value at `plan.construction.a.b` (e.g. `{floor.joist}` -> `2x6`). A FRAME
  part's caption may hold no digit outside a placeholder, so the caption can
  never contradict a company's own numbers.
* When a part is split across files (a helper another entry calls, like
  `kennel.front` called from the siding loop), the skill belongs to the part
  that OWNS the triangles (the `kit.part` id), and says where it is called from.
