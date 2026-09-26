---
name: part-dormer-frame
description: The framing of the Dormer Shed's dormer -- the cut main trusses and headers, the dormer's front wall and windows, its cheek walls, its rafters and its roof deck -- read before changing how the dormer is framed or anything in parts/dormer.js it follows.
---

# Dormer framing (`parts/dormer-frame.js`)

## What it is in real life

The Dormer Shed has a shed dormer standing up out of the main roof on the
door (+x) side (`parts/dormer.js`): an upright front wall just in from the
eave with two or three windows, two triangular cheeks down to the main roof,
and a shallow single-slope roof rising back to tie in just under the ridge.
This part frames exactly that box, the way a shed dormer is built:

* the MAIN TRUSSES ARE CUT where the dormer opens: `parts/roof-frame.js` takes
  their +x top chord out between the two headers (with that side's strut and
  plates), and their bottom chord's heel stops at the dormer's front wall; the
  full trusses either side (the trimmers) carry the upper header and stay
  WHOLE -- webs, struts and heel plates; only the plate on a trimmer's inner
  face gives way where the header butts its chord, by the ridge (until Sep
  2026 a trimmer lost everything between the header and the front wall, its
  +x strut and heel plate included) -- where a trimmer is an end truss, the
  header stops at the gable framing;
* an UPPER HEADER -- a doubled `roof.chord` -- across the opening near the
  ridge, just clear of the king post (or ridge board), where the cut chords
  end and the dormer rafters bear;
* the FRONT WALL: a doubled sill header across the opening at the wall top, a
  bottom plate, `walls.stud` studs every `walls.spacingIn` on centre, a
  doubled top plate, and each window framed with king studs, a flat sill and
  -- where there is room under the plates -- a header (otherwise the doubled
  top plate spans it);
* a CHEEK WALL each side: a bottom plate lying on the main roof deck along
  the slope, a top plate under the outermost dormer rafter, and studs between,
  from the front wall back as far as the cheek has height;
* DORMER RAFTERS (`roof.chord`, every `roof.spacingIn` on centre, the outer
  ones flush inside the cheeks) from the upper header down over the front
  wall with a seat cut, their tails run out under the front overhang and cut
  off level with the soffit (over a cheek wall a rafter rides above the
  cheek's bottom plate);
* the dormer's own ROOF DECK (stage `roof-deck`), the same kind as the main
  roof's (`roofDeck.type`), over the dormer and out over its side overhangs
  where they clear the main roof's steel, never dipping into the main roof's
  own deck.
The main roof deck is left open under the dormer (roof-frame `dormerHoles`).

Everything stays inside the dormer as drawn -- under the dormer roof's
underside, inside its front siding and between its cheek siding -- or inside
the main roof's own volume. The drawn dormer roof meets the top of the drawn
face in a corner (as the main roof meets a wall), so the rafters sit on the
front wall with a seat cut and their tails are only as deep as the space
between the soffit and the roof.

## Stage

Stages `dormer-frame` (the framing) and `roof-deck` (its sheathing or
purlins), both kind `frame`: hidden in the Finished view, shown in the
Framing view; in Watch-it-build the framing lands after the roof framing, the
deck with the main deck, and the roofing hides both. PIPELINE entry
`dormer-frame`, among the framing entries (only with `frames: true`), only on
a style with the `dormer` trait with a dormer chosen (`state.dormer` not
"none"). Materials `lumber`, `osb`.

## Construction settings

* `roof.chord` -- the dormer rafters and the upper header (doubled), default
  `2x4`; `roof.spacingIn` -- dormer rafter spacing, default 24.
* `walls.stud`, `walls.spacingIn` -- the front and cheek walls' studs and
  plates; `walls.header` -- window headers, by width.
* `roofDeck.type`, `roofDeck.sheathingIn`, `roofDeck.purlins.*` -- the
  dormer's deck, as the main roof's.
* `roof.dormerRise` -- through the main roof's profile (the Dormer Shed's
  steeper 0.30W gable, which gives the dormer room to stand).
* The dormer's size is the design's (`state.dormer`: 6, 9 or 12 ft on the
  standard line), clamped to the length less 2 ft, as `parts/dormer.js` does.

## Where it came from in Barnwright

New -- Barnwright drew none. It frames the dormer Barnwright draws:
`dormer()`, `public/3ddesign.html` 2978-3059, called from `buildShed`
4040-4041 (`parts/dormer.js`), pinned SHA-256
`0bdcf663c5cb988623d2cb0dd271156fb690564072b301b0a15b917fd921ac6c`. Its
numbers are repeated exactly by `dormerGeom` in `parts/roof-frame.js`: the
face at W/2 - 0.50, the tie-in at x 0.12 just under the ridge, the face
height (1.2 to 1.95 ft), the windows (two, three from 8 ft wide, with a
0.10 ft white frame round the glass), the 0.30 front and 0.26 side overhangs,
the soffit from the face top to 0.15 under the fascia. `tools/check-framing-roof.mjs`
reads the dormer's roof panel and face back out of the dormer part's own
triangles to prove the framing is inside it.

## The owner's facts

* 6, 9 or 12 ft dormers; the face sits just above the eave resting on the
  main roof (0.5 ft in from the wall plane); the dormer roof rises backward
  and ties in just under the ridge cap; its width is limited to L - 2
  (Barnwright 739, 2979-2998).
* The dormer sits on the door (+x / R) side of the Dormer Shed.
* Dormer windows are white-framed 4-lite, three when the dormer is 8 ft or
  wider and two otherwise.
* The face has corner boards and a band under the fascia; the fascia runs
  across the front and both sides, and a soffit closes the front overhang.
* The standard dormer is the 6 ft one on the Yoder site; Barnwright's own
  default is 9 (company data, not engine data).

## Kept quirks

* THE FRONT WALL DOES NOT STAND ON THE MAIN WALL. The drawn dormer face is
  half a foot in from the siding (Barnwright's `xF = W/2 - 0.50`), so the
  front wall's framing -- and its doubled sill header at the wall top -- sits
  2 1/2 in inside the main wall's framing, over the room. What holds it is
  the cut trusses' bottom-chord ends (which stop against it) and the cut top
  chords' stubs outside it (which bear on the main wall's plates) -- face
  contact, not bearing. A real shed dormer carries its front wall on the main
  wall, or on a header between the trimmers; neither fits the drawn face:
  raising the wall onto the chords pushes the drawn windows' rough openings
  below its bottom plate. The framing checks' "rests on or is nailed to" test
  passes it. The cut trusses' own heels are likewise only the stub on the
  plate and the bottom chord against the sill header (no heel plate joins
  them), which is why the heel-plate check leaves cut trusses out.

* The drawn dormer roof ties in only 0.05 ft above the main roof's underside,
  so near the tie-in the dormer rafters dip below the main roof line (inside
  the dormer, where the main trusses are cut and the main deck is open) and
  the cheek walls only start where the cheek has height.
* A dormer too small for its windows (never offered) gets no window framing.

## How to change it safely

1. Read this skill, `part-dormer` (the drawn dormer) and `part-roof-frame`
   (`dormerGeom`, `dormerHoles`, the cut in `trussMembers`).
2. If `parts/dormer.js` ever changes its numbers, change `dormerGeom` in
   `parts/roof-frame.js` to match -- the check reads the drawn dormer and will
   say where the framing no longer fits.
3. Change lumber and spacing in `library/construction.json` or a company's
   `construction`.
4. Run `node tools/check-framing-roof.mjs` (every Dormer Shed size with each
   dormer, and the construction variants), `node tools/check-framing.mjs`,
   `node tools/check-parts.mjs` and `node tools/check-golden.mjs`.

## Checks that guard it

* `node tools/check-framing-roof.mjs` -- dormer framing exactly when a dormer
  is drawn (a header and rafters); every board inside the dormer as drawn
  (under its roof panel, inside its face and cheeks, above its soffit, above
  the main steel under its side overhangs) or inside the main roof; nothing
  overlapping the cut trusses, the trimmers or the main deck; the trimmer
  trusses whole (as much web lumber as a plain truss); exactly its members
  drawn, in stages `dormer-frame` and `roof-deck`.
* `node tools/check-framing.mjs` -- region, overlap, bearing.
* `node tools/check-parts.mjs` -- valid part, caption, this skill.
