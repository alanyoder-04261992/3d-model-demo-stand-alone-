---
name: part-gable-backing
description: Model Alan's gable backing for siding seams, across all stud bays to the outer truss, using actual gaps, roof profile and the upper-plate datum.
---

# Gable backing (`parts/gable-backing.js`)

## What it is in real life

**Gable backing** is Alan's name for horizontal nominal 2x4 pieces across
the gable, **all the way to the outer truss**, supporting the siding where
its seams meet. Include the bays beyond the outermost studs. Use it when
that gable has **no window and no fake window**.
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
this rule only controls the backing. Alan's subsequently confirmed
[real-window framing rule](../part-gable-frame/SKILL.md#learned-rule-when-there-is-a-real-gable-window)
moves studs to the window sides and adds top/bottom 2x4s, all wide faces
outward. The [adjustable box](../part-gable-window-frame/SKILL.md) reads each
selected opening's dimensions; none is a fixed shop-wide size. Do not reuse the
11 in backing offset as the window height or extend the box rule to fake
windows without confirmation.

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
On September 30, he corrected the extent: it goes all the way to the outer
truss, and its purpose is support where the siding seams meet. This replaces
the earlier implementation that stopped at the outermost studs.

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
  Each stud-side end contacts its stud across the full backing section.
- Add one piece per internal stud bay **plus one outer piece on each side**,
  from the outermost stud to the truss. The existing preview has the studs
  behind the truss face; use the same plane for backing. Clip outer ends to
  the actual outer roof outline, giving face contact with the truss, rather
  than leaving a gap at the truss's inner edge. This exact joint/cut remains
  a preview fit, not a user-confirmed fastening or cut specification.
- At each backing height `y` relative to upper-plate top, intersect the roof
  outline. On the lower segment, `outer x = tip x - (y - tip y) / lower slope`.
  Derive the left side by mirroring; clip to both roof segments if needed.
  Subtract the outermost stud face position to get the outer piece's length.
  Calculate at both bottom and top: an angled end has different edge lengths.
  Render and label these from the polygon; do not copy a 10 ft example length.

For the current four studs at 24 in on center, the result is **five pieces**:
three internal pieces, each **20.5 in** (`24 - 3.5`), plus two outer pieces
fitted to the truss. Subtract the outward face width, not the
1.5 in through-wall thickness. The 5.5 in gable board leaves a **5.5 in gap**
between its top and the backing bottom (`11 - 5.5`). With upper-plate top
79.5 in above flooring, backing bottom is **90.5 in**, and top is **94 in**.
Neither the offset nor stock section scales with building width.

For another size, recompute the actual stud layout, clear face gaps, outer
roof intersections and piece count. Require full contact at each stud end;
reject a height that would leave an end above a sloped stud top. Preserve
the gable board, truss, studs and prior assemblies. The same member records
drive rendering, dimensions and horizontal wood grain.

## Checks that guard it

`node tools/check-gable-backing.mjs` verifies the upper-plate datum, full
stud and truss-face contact, actual tapered mesh volume, five distinct wood finishes, per-end
real/fake-window exclusions, and recalculation at another width and spacing.
Run `node tools/check-truss-lesson.mjs` and the required
`node tools/check-all.mjs --fast` regression checks; report skipped browser
checks accurately. Validate the skill with the skill-creator validator.

Update model pictures with `node tools/export-joist-render-data.mjs --truss`
and `python tools/render-joist-picture.py --truss`. Inspect
[the backing close-up](../../../images/gable-backing.png) and the
[phone picture page](../../../truss.html), including the 11 in dimension's
two real endpoints.
