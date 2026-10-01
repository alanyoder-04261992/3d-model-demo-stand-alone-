---
name: utility-framing
description: "Learn or apply Alan's utility wall, opening and A-frame roof rules: 89-inch studs, a flat top window plate, studs above openings and 5/12 or 7/12 pitch. Use for utility framing rather than the lofted-wall header or lofted roof."
---

# Utility framing

Alan confirmed these rules October 1, 2026. Use his terminology and keep
the utility lesson distinct from the learned lofted wall.

- Utility wall **stud cut length is 89 in**. It is not total wall height.
- **Top window plate** is one flat 2x4: actual 1.5 in tall, 3.5 in deep
  through the wall. Put studs in the space above it to the top plate.
- Fill empty space above any framed opening with studs, including above a
  utility doorway header. Do not draw zero-height studs when it meets the plate.
- Roof name: **A-frame roof**, also **utility-style roof**. Standard pitch
  is **5/12**; steep is **7/12**. The denominator is horizontal run, not
  distance along the sloping board. Rise = horizontal run × rise/run ratio.

Read [shared measurements](../shed-measurements/SKILL.md),
[utility top window plate](../../../.claude/skills/part-utility-window-frame/SKILL.md),
[doorway framing](../../../.claude/skills/part-doorway-frame/SKILL.md), and
[roof framing](../../../.claude/skills/part-roof-frame/SKILL.md) for affected parts.
Use `construction.utilityStudy` in the learning company and opt in through
`utilityWallStudyPlan`. Preserve the 75-inch loft wall and ordinary geometry.
The utility preview carries the current stock, three wall plates, corner
setbacks and wall grid as explicit reuse choices; the new stud-height
confirmation alone does not confirm every construction detail for this style.

With the current 1.5 in bottom plate, top-plate underside is `1.5+89=90.5`
in above flooring. Three flat plates give total `89+3×1.5=93.5` in.
For window opening top `U` above flooring, short upper-stud cut is
`90.5 - (U+1.5)`. For king cut `K` and chosen header height `H`, the
upper-stud cut is `89-K-H`. These are formulas; window/door dimensions vary.
Keep plate cut independent until window side supports/bearing are taught.

Use the existing wall grid for preview upper studs, retaining covered
double-stud pairs. Their exact layout is still provisional. Do not rename
Alan's shorter **king stud** to the legacy code's king/jack terminology.
Choose the doorway header separately using the learned doorway arrangements.
For a 60 in horizontal run, 5/12 rises 25 in and 7/12 rises 35 in. These
are pitch calculations, not confirmed peak elevations or fabrication cuts;
rafter stock, bearing span, overhang, seat and joints remain to learn.

The phone lesson is [utility-framing.html](../../../utility-framing.html),
with an adjustable window detail, exact-mesh PNGs and a pitch diagram.
The doorway link selects `doorway-framing.html?wall=utility#rotate`.
Run company validation, `node tools/check-all.mjs --fast`, and inspect
mobile controls. Export PNG geometry with `node tools/export-utility.mjs`
and render with `python tools/render-joist-picture.py --utility window`
and `--utility door` (development Pillow/NumPy only).
