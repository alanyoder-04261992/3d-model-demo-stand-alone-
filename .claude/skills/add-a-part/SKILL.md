---
name: add-a-part
description: Add a new real-life part of a shed (something the shop builds that the designer does not draw yet -- framing, a fitting, an option) as its own module, stage and skill -- use when asked to draw something new on or inside the building, or to split a part in two.
---

# Add a new part

Alan's rule: **one real-life part = one file in `parts/` + one skill in
`.claude/skills/part-<id>/SKILL.md`.** Read `parts/README.md`, the
"Parts", "PIPELINE" and "Framing datums" sections of `docs/ARCHITECTURE.md`,
and the skill of the part nearest to yours first (`part-floor-deck` for a
simple framing part, `part-ramp` for a new finished part, `part-skids` for
the smallest ported one).

## 1. Which kind of part is it?

The kind decides where it may run, and getting it wrong changes Barnwright's
picture.

* **Framing** (lumber and hardware inside or under the building, shown in the
  Framing view and Watch it build, never in the finished view): stage kind
  `frame`. This is the usual case.
* **Finished, but only with an option nobody had before** (the ramp is the
  example: drawn only when a ramp is chosen): stage kind `finish`. It must
  draw **nothing** on any building Barnwright can make without that option,
  or the finished look stops being Barnwright's.
* **A part Barnwright already draws** (siding, a door...): it is not new; find
  it in the gallery (`parts.html`) and read its skill instead.

## 2. The file: `parts/<id>.js`

```js
/* THE <PART>: what it is on a real shed, in plain words ... (the note every
   file opens with -- Alan does not read code) */
export default {
  id: "<id>",                    // = the file name; the skill is part-<id>
  name: "<Name>",                // shown in the parts gallery
  stage: "<stage key>",          // one key, or a list (the first is the main one)
  realLife: "{walls.stud} ...",  // the caption; {a.b} = plan.construction.a.b
  appliesTo(plan) { ... },       // does THIS building have one?
  members(plan) { ... },         // framing parts: the list of pieces (below)
  build(plan, kit, core) { kit.setStage("<stage key>"); ... },
};
```

* **Node-safe**: no `window`, `document`, DOM or WebGL; no JSON imports; no
  `Math.random`; function declarations rather than arrow constants.
* It reads only `plan` (frozen: it can never change the design) and `kit`
  (and `core`, the five core materials). Sizes come from `plan.construction`,
  never typed into the code: add new numbers to `library/construction.json`
  with a `_help` note, and say "ASSUMPTION" there when the number is not from
  Alan's shop (then add it to "What you still need to decide" in
  `docs/FOR-ALAN.md`).
* A **framing caption may hold no digit outside a `{placeholder}`**, so it can
  never contradict a company's own numbers (`check-parts.mjs` refuses it).
* **Framing parts**: build a list of pieces with the shared framing kit in
  `parts/floor-frame.js` (`beamMember`, `boxMember`, `wallMember`,
  `slabMember`, `prismMember`, `lumberSize`, `frameMat`), export it as
  `members(plan)`, and draw exactly that list with `drawMembers(kit, list,
  stage)`. The framing check reads `members` and demands the drawing matches
  it, piece for piece.
* **Finished parts**: use material keys of your own. Materials are "first call
  wins": a key that already exists hands back the existing paint and ignores
  yours, and the draw order is the order keys were first used. Never reorder
  or "tidy" existing `mat()` calls.
* `pending: true` marks a stub that draws nothing yet; the golden check reports
  its labels as PENDING instead of failing. Remove it when the part is done.

## 3. Its stage (`parts/stages.js`)

Use an existing stage when one fits (`floor-frame`, `wall-frame`,
`roof-frame`, `interior`...). A new step: **append** it with the next free id
(ids are stamped on every triangle and are permanent: never renumber; there is
room for 32), give it a `kind` (`frame`, `finish`, `both`, `always`), add it to
`COVERS` if a finish step should hide it once landed (siding hides wall
framing, roofing hides roof framing), add it to `buildOrder` in
`library/construction.json` (the Watch-it-build order), and to the stage table
in `docs/ARCHITECTURE.md`.

## 4. Its place in the PIPELINE (`parts/index.js`)

* **Ported finished entries keep Barnwright's `buildShed` order, line for
  line.** Never insert anything between them: the order materials are first
  asked for is the draw order, and it is part of the look.
* **A new finished part goes after `ground`**, beside `ramp`, with
  `frame: false`.
* **A framing part goes last**, among the framing entries, with
  `frame: true`: it only runs when a view asks for framing
  (`assemble(plan, {frames: true})`), so a colour tap in the finished view
  costs what it always did. Put it after the parts it stands on (it may read
  their `members`).
* The entry: `e("<id>", module, "parts/<id>.js", frame, "<id>", ["<id>"])` --
  `part` is the id every triangle is labelled with, `tags` the labels the
  entry can produce.

## 5. Attribution: `kit.part`

`assemble` runs every entry inside `kit.part(<entry's part>, ...)`, so its
triangles carry that label. A part drawn from INSIDE another entry (the way
the kennel's front is drawn from the siding loop, at Barnwright's position)
wraps its drawing in `kit.part("<owner id>", function () { ... })`: the
innermost label wins, the owner's skill describes it, and it says where it is
called from. Every entry starts with no stage: call `kit.setStage` before
drawing (drawing with no stage throws).

## 6. Its skill

Copy the layout in `docs/SKILL-TEMPLATE.md` to
`.claude/skills/part-<id>/SKILL.md`: frontmatter `name: part-<id>` and a
one-line `description` saying when to read it, then the eight sections word
for word (What it is in real life, Stage, Construction settings, Where it
came from in Barnwright -- "new -- Barnwright drew none" and what it fits
into --, The owner's facts, Kept quirks, How to change it safely, Checks that
guard it). Copy every real-life fact from Alan into both the code comment and
the skill.

## 7. Checks

* `node tools/check-parts.mjs` -- a valid part, in the PIPELINE under its own
  name, a framing entry drawing only framing stages, the caption filling in on
  all 148 recorded buildings, its skill present and well formed.
* `node tools/check-imports.mjs` -- it loads in Node with no browser.
* `node tools/check-golden.mjs` -- must stay green: a new part may not move one
  triangle of Barnwright's finished buildings (it also proves drawing the
  framing changes nothing finished).
* Framing parts: `node tools/check-framing.mjs` (every frame part's pieces:
  inside the footprint, walls or roof; no overlaps; nothing floating; spacing
  from the construction numbers) and, for anything in the roof,
  `node tools/check-framing-roof.mjs`.
* In a browser: `node tools/check-views.mjs` (Framing and Watch it build) and
  `node tools/check-gallery.mjs` (the gallery draws every part a building can
  have on its own at least once -- open
  `parts.html?company=demo&style=<a style that has it>` and look at it too).
  A part only one of Alan's lessons draws says `lesson: "<page>"`
  (`parts/README.md`); the check then wants it on no building, listed with a
  link to that page, and drawn on its own from the plan the lesson builds:
  add that plan to `LESSON_PLANS` in the check.
* `node tools/check-docs.mjs` (every part has its skill) and finally
  `node tools/check-all.mjs --fast`.
