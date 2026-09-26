---
name: part-wall-frame
description: The wall framing -- studs, plates, 3-stud corners and the king/jack studs, headers, sills and cripples round every door and window, on every wall including porch walls and the kennel -- read before changing stud size or spacing, header rules, corners or how openings are framed.
---

# Wall framing (`parts/wall-frame.js`)

## What it is in real life

Every wall is studs standing on a bottom plate nailed to the floor, with two
top plates on them, the studs `walls.spacingIn` on centre measured from the
corner so the 4 ft siding sheets land on studs. At a corner one wall runs
through and the other butts into it: the walls across the width (F, B, and
the porch walls S2, S3, P3) run through; the long walls (R, L, S1, P2) butt
between them; the angled corner-porch wall P1 always butts. A "3-stud"
corner is the through wall's last two studs side by side and the butting
wall's end stud against them. At an inside corner (a porch notch) the
through wall runs on to the far face of the butting wall's frame.

At every door and window (the rectangle `model/layout.js openingRect`
gives -- its clear opening IS the shop's rough opening): a jack stud each
side under a header, a full-height king stud outside each jack, cripples
between the header and the top plates, and under a window a flat rough sill
on cripples. The bottom plate is cut out across a door. A double window gets
a doubled mullion under its shared middle board.

Where the header the rule asks for does not fit under the top plates (a door
on a short loft wall), the next size that fits is used, down to a flat 2x;
where not even that fits, the jacks run up to the plates and the plates span
the opening. A header is never left hanging a fraction of an inch under the
plates: when what is left over it is less than a cripple's worth
(`CRIPPLE_MIN`, 0.6 in -- e.g. the flat 2x over a loft barn's windows, which
sit 5 in under the wall top), the header goes up tight under the plates and
the jacks run up to it, the way a framer nails a header up under the plate
and shims the opening. A door that reaches up past the wall top on a GABLE
END (the Standard Barn's end door) has the plates cut across it and its jacks
and kings stop under them; its header is in the gable, framed by
`gable-frame`, which stands its kings on this wall's top plate. WHICH doors
those are is read from `roof-frame`'s `gableOpenings` itself (an end-wall
door whose top is more than 0.01 ft over the wall top, and whose framing the
gable can take -- it refuses one that would run past its own framing), so
the two parts can never disagree: the plates are cut only across the doors
on that list. A door whose top only reaches into the plates (an 8 ft roll-up
on the Standard Barn's 8 ft end, squeezed by Barnwright), or one the gable
does not take, is held under the plates like any door too tall for a header;
in a crowded opening framed as one, the plates stay over the doors in it
that are not on the list.

AN OPENING WIDER THAN ITS WALL (an 8 ft roll-up on an 8 ft end wall, double
doors picked for a 4 ft porch wall -- Barnwright draws the door past the
corners) is framed only as wide as the wall's frame allows: a jack against
each end of the frame, the corner doing the king's job, the header inside
the walls.

CROWDED WALLS: Barnwright lets openings crowd closer than framing can go (on
an 8 ft side porch its standard door and two windows even overlap). Two
openings with room for ONE stud between them share it as the jack of both --
only when their headers sit at the same height, since one stud carries one
header line (a door beside a window whose top is higher would leave one
header's end hanging); closer, overlapping, or with headers at different
heights, they are framed as ONE wide rough opening (one header at the higher
top, the plate cut if either is a door, one sill if both are windows). Any
two openings on the wall are compared, not only neighbours in the list (a
transom framed above can sit between a door and a window). Openings one
above the other (the single slope's transom row, a gable window dragged down
over a window) are framed separately, the studs between cut round both, and
the lower one's header sized to fit under the upper one's sill (tight up
under it if less than a cripple's worth is left); when not even a flat 2x
fits between them they are framed as one.

THE DOG KENNEL: the enclosed back half is framed (B, the back halves of R and
L, and the partition facing the run with a framed opening for each doggie
door); the open run is post-and-beam -- 4x4 posts at the front corners and
middle, a post at the back of each side against the partition, headers over
the front and down each side, top plates on them.

## Stage

Stage `wall-frame` (kind `frame`): Framing view only; in Watch-it-build it
lands after the floor decking and is hidden again once the siding lands
(`COVERS` in `parts/stages.js`). PIPELINE: among the framing entries, only
with `frames: true`.

## Construction settings

* `walls.stud` (2x4), `walls.spacingIn` (16) -- stud size and spacing.
* `walls.bottomPlates` (1), `walls.topPlates` (2).
* `walls.corner` ("3-stud"; "2-stud" gives one + one).
* `walls.header` -- a rule list by the opening's width (`maxSpanFt`): 2x6
  doubled up to 4 ft, 2x8 doubled up to 6.5 ft, 2x10 doubled beyond.
* `walls.studLengthIn` -- caption only (the drawn wall height is the style's
  `wallH`).
* `porch.post` -- the kennel run's posts.
* `openings.doorHeightIn`, `openings.windowTop` -- through `openingRect`.

## Where it came from in Barnwright

New -- Barnwright drew none (its walls are one flat face of siding each).
It fits behind the siding (`buildShed` walls loop, `3ddesign.html` 3878-3905,
pinned SHA-256 `0bdcf663...`; `parts/siding.js` -- the framed spans are the
siding's own, cut round the porch notch), round the openings `renderItem`
draws (3122-3236), and under the roof profile (`roofProfile` 2159-2175).
docs/ARCHITECTURE.md "Framing datums" 2: bottom plate on y0, top of the upper
top plate at the wall top, studs inside the siding plane from o = -0.02 to
-0.02 - the stud depth. The high side wall of a lean-to or single slope stops
its plates under the roof line at its inside face.

Helpers other parts use: `wallRuns` (every framed run with its corner ends),
`frameRun`, `wallFrame(plan)` (members, runs, and each opening's framing),
`openingFrames(plan)` (for the gable framing), `wallSpec`, `runTop`,
`kennelPartition`.

## The owner's facts

* The shop (Barnwright 2150-2152, kept word for word in the code): "Walls:
  studs on a bottom plate with two top plates; loft ("short wall") studs are
  75" for about a 6.63 ft wall, tall-wall (UTX) studs are 89" for about
  7.79 ft. A 2x4 really measures 1 1/2" x 3 1/2"."
* Door rough openings from the shop (Barnwright 707-714): the 36 in door
  opens 37 1/4 in, the 48 in opens 48 1/4 in, the double opens 76 in -- the
  catalogue widths `openingRect` uses as the clear opening.
* Door heights 71 1/2 in on loft builds, 76 1/2 in on tall walls; a window
  top 5 in under the wall top on loft builds, level with the door head on
  tall walls (Barnwright 3126-3129, 3190-3196; `plan.construction.openings`).
* "doors on the end walls rise into the gable up to the roofline" (Barnwright
  3180) -- why a Standard Barn door goes through the plates.

## Kept quirks

* A double window's shared middle board is CASING (3.24 in) wide; the mullion
  is two 2x (3 in) under it.
* Barnwright's clamp lets openings overlap on crowded walls, and lets a
  door be wider than its wall; the framing frames them as one opening, or
  only as wide as the wall, rather than moving anything (the finished picture
  must stay Barnwright's).

## How to change it safely

* Sizes, spacing, plates, corners and the header rule are settings.
  `HEADER_FALLBACK` (the sizes tried when the rule's does not fit) and
  `CRIPPLE_MIN` (the shortest cripple, below which a header goes tight under
  the plates) are in the code, and the check reads both.
* Anything that changes where openings are (`openingRect`) changes this
  framing too -- run `node tools/check-framing.mjs`.
* Which doors go through the plates is `parts/roof-frame.js gableOpenings`'
  list (this part imports it): change the rule there, and both parts follow.
  Near a corner of the Standard Barn's end the gable takes the door but has
  no room for a header over it (its own "fits" test) -- see the roof
  framing's skill before relying on it.
* Run `node tools/check-framing.mjs` (and `--mine` for just the non-roof
  parts) and `node tools/check-golden.mjs`.

## Checks that guard it

* `node tools/check-framing.mjs` -- on every golden building, every style at
  every size of three catalogues, five hand-made crowded walls, the hardest
  walls a customer can make (openings wider than their wall, a window under
  the transom row, a gable window dragged onto a window, a fourth opening on
  a 12 ft wall) and five other companies' ways of building (2x6 studs at
  24 in with one top plate and two-stud corners, tripled headers, two bottom
  plates ...): every opening has jacks, kings (or a corner or neighbour's
  jack doing that job) and a header (or the plates right over it; or the
  gable framing spanning it when it goes through the plates), windows a sill
  and cripples; every header is the rule's size for its span or the deepest
  that fits, and none has a gap under what it carries; a shared stud carries
  both headers; layout studs on their `walls.spacingIn` marks and no wider bay
  except across an opening; nothing overlapping by more than 0.01 ft, nothing
  outside the walls, every stud, plate and header resting on what is under
  it; the finished building untouched.
* `node tools/check-parts.mjs`, `node tools/check-imports.mjs`.
