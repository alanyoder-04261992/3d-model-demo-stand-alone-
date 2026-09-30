---
name: part-gable-backing
description: Add or adjust Alan's horizontal gable backing between gable studs, using the upper-plate height datum, actual stud-face gaps and the no-window-or-fake-window condition.
---

# Gable backing (`parts/gable-backing.js`)

## What it is in real life

**Gable backing** is Alan's name for horizontal nominal 2x4 pieces between
the gable studs when that gable has **no window and no fake window**.
The actual section is **1.5 in thick by 3.5 in high**. Alan confirmed the
wide face points outward, in line with the gable studs' wide faces.
The **bottom** of the backing is **11 in above the top of the upper plate**.

## Stage

The `gable-backing` PIPELINE entry is framing, stage `roof-frame`, after
the gable and truss members. It draws only in the explicitly enabled learned
truss assembly (`plan.trussStudy`); company settings alone do not change
the ordinary designer or the earlier floor, wall and gable-board lessons.
The learning view is `learn.html?step=truss`, with a **Gable backing** view.

## Construction settings

The learning company supplies `construction.gableBacking`; there is no
universal default for other builders:

```json
{
  "nominal": "2x4", "thicknessIn": 1.5, "heightIn": 3.5,
  "bottomOffsetIn": 11, "datum": "upper-plate-top",
  "orientation": "broad-face-outward", "when": "no-window-or-fake-window"
}
```

Use the actual selected end's gable-window catalogue entries, including
the `faux-loft` draw trait. A fake window still suppresses this backing
even though it is not a physical opening. A window on the opposite gable
or an ordinary wall window below this gable does not suppress it here.
The current lesson models end `B`. Window framing is a separate lesson;
this rule only controls the backing.

## Where it came from in Barnwright

New -- Barnwright drew none. It fits between the learned outward-facing
gable studs, above the gable board. Read
[gable framing](../part-gable-frame/SKILL.md) for the supporting assembly.

## The owner's facts

Alan named and described this part on September 29, 2026: horizontal 2x4s
between the gable studs, omitted with a window or fake window, with their
bottoms 11 in above the upper-plate top. He then explicitly confirmed the
3.5 in wide face points outward in line with the gable studs. Nominal 2x4
means actual 1.5 x 3.5 in here. Treatment and fastening details are unspecified.

## Kept quirks

None inherited. The surrounding truss's remaining profile and stud-top
assumptions remain identified by the existing truss skill. Do not turn
this new backing rule into approval of those cuts.

## How to change it safely

Derive, rather than copying the example's cut length or count:

- `backing bottom = actual upper-plate top + 11 in`.
- `backing top = backing bottom + actual backing height`.
- `clear length = right stud's left face - left stud's right face`.
  For equal studs: `center spacing - actual outward face width`.
- Align the backing's outward face with the studs' outward faces.
  Each end contacts a neighboring stud across the full backing section.
- Add one piece per internal stud bay. Do not extend past the outermost
  gable studs or invent pieces from a stud to the sloping truss.

For the current four studs at 24 in on center, the result is **three pieces,
each 20.5 in long** (`24 - 3.5`). Subtract the outward face width, not the
1.5 in through-wall thickness. The 5.5 in gable board leaves a **5.5 in gap**
between its top and the backing bottom (`11 - 5.5`). With upper-plate top
79.5 in above flooring, backing bottom is **90.5 in**, and top is **94 in**.
Neither the offset nor stock section scales with building width.

For another size, recompute the actual stud layout, clear face gaps and
piece count. Require both full backing ends to fit the neighboring studs;
reject a height that would leave an end above a sloped stud top. Preserve
the gable board, truss, studs and prior assemblies. The same member records
drive rendering, dimensions and horizontal wood grain.

## Checks that guard it

`node tools/check-gable-backing.mjs` verifies the upper-plate datum, full
stud contact, actual mesh volume, three distinct wood finishes, per-end
real/fake-window exclusions, and recalculation at another width and spacing.
Run `node tools/check-truss-lesson.mjs` and the required
`node tools/check-all.mjs --fast` regression checks; report skipped browser
checks accurately. Validate the skill with the skill-creator validator.

Update model pictures with `node tools/export-joist-render-data.mjs --truss`
and `python tools/render-joist-picture.py --truss`. Inspect
[the backing close-up](../../../images/gable-backing.png) and the
[phone picture page](../../../truss.html), including the 11 in dimension's
two real endpoints.
