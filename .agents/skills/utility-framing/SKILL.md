---
name: utility-framing
description: "Learn or apply Alan's utility wall, opening and A-frame roof rules: 89-inch studs, a flat top window plate, studs above openings and 5/12 or 7/12 pitch. Use for utility framing rather than the lofted-wall header or lofted roof."
---

# Utility framing

This is internal knowledge for Alan and the setup agent to learn a builder's
construction and configure customer buildings faster. The lesson pages,
framing previews and study settings are development aids; do not ship them
as customer designer features. Apply confirmed rules to a customer's
settings/model only within that builder's scope.

Alan confirmed these rules October 1, 2026. Use his terminology and keep
the utility lesson distinct from the learned lofted wall.

- Utility wall **stud cut length is 89 in**. It is not total wall height.
- **Top window plate** is one flat 2x4: actual 1.5 in tall, 3.5 in deep
  through the wall. Put studs in the space above it to the top plate.
- Its **top** is **12.5 in below the bottom of the wall top plate**.
  These are the two tape datums. Upper studs cut to 12.5 in; do not
  subtract the window plate thickness from this gap again.
- Fill empty space above any framed opening with studs, including above a
  utility doorway header. Do not draw zero-height studs when it meets the plate.
- Roof name: **A-frame roof**, also **utility-style roof**. Standard pitch
  is **5/12**; steep is **7/12**. The denominator is horizontal run, not
  distance along the sloping board. Rise = horizontal run × rise/run ratio.
- Roof stock follows the **nominal sales width**: **10-wide and under
  use 2x4** (actual 1.5 x 3.5); wider uses **2x6** (actual 1.5 x 5.5).
  Actual building width is a separate geometry input (12-wide is 134 in).
- Roof projects **4 in beyond each side wall**; its outer end is **2 in
  high** before the top slopes to the peak. The bottom cut is level with
  the **top of the side wall's upper plate**. Exact seat shape is pending
  fit confirmation; do not quietly borrow the lofted truss tail.
- **Siding** is actual **1/2 in thick**, with its top flush with the
  **upper-plate top**. Its bottom overhang differs from the lofted barn's
  3.5 in and remains to be measured.
- An **outside 2x4** is nailed over that siding, parallel to the upper
  plate, with its **3.5 in face against the siding** and its **top edge
  level with the upper-plate top**. Use this descriptive name until Alan
  names it. End/corner fit, length and nail details remain unconfirmed.

The [siding skill](../../../.claude/skills/part-siding/SKILL.md) records these
new cladding facts and the separate **3.5 in × 5/8 in trim**. They are saved
under `construction.claddingStudy` as facts only; no cladding geometry or
new customer controls follow merely from saving them.

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
Window-plate top is `90.5 - 12.5 = 78 in` above flooring; its underside
is `78 - 1.5 = 76.5 in`. In general use `topPlate.bottom - gap` for
window-plate top, then subtract actual thickness for its underside.
For king cut `K` and chosen header height `H`, the
upper-stud cut is `89-K-H`. These are formulas; window/door dimensions vary.
Keep plate cut independent until window side supports/bearing are taught.

Use the existing wall grid for preview upper studs, retaining covered
double-stud pairs. Their exact layout is still provisional. Do not rename
Alan's shorter **king stud** to the legacy code's king/jack terminology.
Choose the doorway header separately using the learned doorway arrangements.
For a 60 in horizontal run, 5/12 rises 25 in and 7/12 rises 35 in. These
are pitch calculations, not confirmed peak elevations or fabrication cuts;
peak datum, complete seat shape and joints remain to learn.
`utilityRoofRule` selects confirmed stock/projection/end height independently
of the pitch-only diagram. Preserve the named width even when actual width differs.

The phone lesson is [utility-framing.html](../../../utility-framing.html),
with an adjustable window detail, exact-mesh PNGs and a pitch diagram.
The roof section shows a 10-wide standard 5/12 roof over the utility end
wall and a tail close-up. The level-tail shape and ridge/depth fit are
explicit review assumptions, not confirmed cuts. Read the roof skill's
[preview formulas](../../../.claude/skills/part-roof-frame/SKILL.md#utility-roof-over-an-end-wall-exact-mesh-preview).
The shown gable is left open; its utility infill rules remain to learn.
The doorway link selects `doorway-framing.html?wall=utility#rotate`.
Run company validation, `node tools/check-all.mjs --fast`, and inspect
mobile controls. Export PNG geometry with `node tools/export-utility.mjs`
and render with `python tools/render-joist-picture.py --utility window`
and `--utility door` or `--utility roof` (development Pillow/NumPy only).
