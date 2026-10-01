# Architecture — the standalone 3D shed designer

This is the contract every file in this repo is built to. If code and this file
disagree, one of them is a bug: fix the code, or change this file on purpose
and say why in the commit. (Version 2: rewritten after three independent
critiques of version 1 — see git history.)

## What Alan asked for, and what proves each one

| Alan's words | What delivers it | What proves it |
|---|---|---|
| "I like how it looks" (Barnwright's 3D designer) | the same shader, textures and triangles, ported | `tools/check-golden.mjs` (every triangle), `tools/check-look.mjs` (pixels) |
| "3D rendering of each part of a shed" | one module per real part in `parts/`, and `parts.html` shows each on its own | `tools/check-parts.mjs`, `tools/check-framing.mjs` |
| "a skill for each part" | `.claude/skills/part-<id>/SKILL.md` for every part | `tools/check-parts.mjs` (no part without a skill, no skill without a part) |
| "when there is a new design it builds it like in real life" | internal construction lessons and part skills inform the model; customers use the finished building and floor plan | `tools/check-framing.mjs`, `tools/check-views.mjs` |
| "fast to set up new companies" | a company is one settings file on top of a shared manufacturer file; `tools/new-company.mjs`, `tools/import-prices.mjs`, `setup.html` contact sheet | `tools/check-companies.mjs`, `tools/check-loadouts.mjs`, `tools/check-starter.mjs` |
| "a company that just buys my 3D design, not the software" | managed dealer links and order inboxes; Owner/Admin catalogue control; `embed.js`; optional legacy lead integrations | `tools/check-embed.mjs`, `tools/check-leads.mjs` |
| "not touch Barnwright" | Barnwright is only ever read, by the golden capture | nothing in this repo writes outside it |

## Ground rules

1. **Plain ES modules for the designer; separate management backend.**
   Netlify Functions/Identity/Blobs support managed businesses and dealer lots.
   An allowlisted build excludes internal lessons and skills from client output.
   See [DEALER-BACKEND.md](DEALER-BACKEND.md) for server authorization and setup.
2. **Node-safe vs browser files.** Everything under `model/`, `parts/`,
   `library/`, and the engine files marked *Node-safe* below must import and run
   in Node 22 with no DOM and no WebGL. They never import a browser file
   (`engine/gl.js renderer.js textures.js scene.js snapshot.js`, `ui/*`).
   `tools/check-imports.mjs` imports each Node-safe file alone in Node to prove it.
3. **No JSON imports** anywhere under `engine/ model/ parts/ ui/` (import
   attributes break older Safari and Firefox). JSON is fetched by `ui/load.js`
   (browser) or read by `tools/lib/load.mjs` (Node); `model/` functions take
   already-parsed objects and do no I/O.
4. **Units and axes are Barnwright's, unchanged.** 1 unit = 1 ft. `x` across
   the width (the R wall is `+x`, the door side of side-entry styles), `z` along
   the length (the F gable end is `+z`), `y` up, `y0 = 0.92` the deck top.
   Wall-local `(u, y, o)`: `u` along the wall to the viewer's right from
   outside, `y` absolute height, `o` outward from the siding plane.
5. **Port, do not rewrite.** Finished-building code is lifted from Barnwright
   with its numbers byte for byte; only the edits under *Porting rules* are
   allowed, and the golden test must stay green.
6. **Function declarations, not arrow consts, in ported code** (hoisting).
7. **Every file opens with a plain-English note** of what it is for. Alan does
   not read code; the notes are for the next person or Claude session.
8. **Nothing calls `Math.random` except the texture painters** (see Textures).

## Layout

```
index.html            the designer
parts.html            parts gallery: each part drawn on its own with its real-life note
setup.html            contact sheet: every offered style x size with its standard doors/windows and price, for sign-off
embed.js              one <script> a company pastes on its site -> lazy iframe to the designer
_headers              generated per company (frame-ancestors) by tools/build-headers.mjs
engine/
  constants.js        GROOVE RIB y0 SKIRT CASING OCT_WIN OCT_TRIM LUMBER            (Node-safe)
  math.js             norm3 sub3 cross3 dot3 hexRGB srgbLin matMul matPersp matOrtho matLook (Node-safe)
  buckets.js          createBuild / makeKit: materials, buckets, primitives, stage + part tags (Node-safe)
  tex-names.js        the 11 texture names                                           (Node-safe)
  scene-data.js       SCENES (studio/yard/paper) data                                (Node-safe)
  camera.js           fitDistFor (pure) + the browser camera: cam, fitCamera, animYaw, wallYaw (Node-safe core)
  assemble.js         buildShed() replacement                                        (Node-safe)
  textures.js         mkTex + the 11 procedural textures (browser)
  shaders.js          VS FS FSTRUE VSD FSD (browser)
  scene.js            sunFromCam, paintBackdrop (browser)
  gl.js               context + no-WebGL stub (browser)
  renderer.js         upload, draw, shadow pass, watchdog, projCache, stage uniforms (browser)
  snapshot.js         2x2 thumbnail + floor-plan picture; parts-gallery pictures (browser)
model/                pure rules, Node-safe
  company.js          validate + resolve (manufacturer + company) -> one catalogue
  frame.js            frameOf(state, cat): t d W L topY span ws prof CAT STEP construction
  roof-shapes.js      roofRise roofProfile profileYat cottageEave gableClip gableBandY
  layout.js           itemW clampPos snapCenter neighborGaps openingRect resetItems freeSpot
  loadouts.js         standard doors/windows: named Barnwright recipes + data recipes
  pricing.js          basePrice itemCharge priceParts money sqftCharge
  design.js           defaults, toState / fromState, normalize, encode / decode (share link)
  construction.js     resolve construction rules for one building (rule form, options)
  plan.js             makePlan(state, cat) -> frozen copy the parts read
library/
  construction.json   default real-life construction numbers (schema below)
  manufacturers/standard.json   the standard portable-building line as Barnwright draws it:
                      styles, items (sizes + draw traits), palettes, loadouts, construction overrides. NO PRICES.
parts/
  stages.js           the stage table
  index.js            PIPELINE
  <part-id>.js        one real part each (openings/ holds the door/window family)
companies/
  demo/company.json   the sales demo: every standard style, example prices, look.trueColour false
  starter/company.json  a small made-up company: 3 styles, own brand and colours
  _template/company.json  what tools/new-company.mjs copies
ui/                   the designer screens (browser)
tools/                checks, generators, the golden capture (Node 22)
test/golden/          fixtures recorded from Barnwright (+ barnwright-catalogue.json: its exact tables)
.claude/skills/       part-<id>/ for every part, plus new-company, add-a-style, add-a-part, check-the-look
```

## Stages (`parts/stages.js`)

Ids are permanent: append, never renumber. `uStg` has room for 32.

| id | key | shown as | kind |
|---|---|---|---|
| 0 | `site` | Site and ground | always |
| 1 | `skids` | Skids | both |
| 2 | `floor-frame` | Floor frame (joists and rim) | frame |
| 3 | `floor-deck` | Floor decking | frame |
| 4 | `wall-frame` | Wall framing (studs, plates, headers) | frame |
| 5 | `roof-frame` | Roof framing (trusses, rafters, gable studs) | frame |
| 6 | `loft` | Loft | frame |
| 7 | `roof-deck` | Roof deck and purlins | frame |
| 8 | `floor` | Floor | finish |
| 9 | `siding` | Siding | finish |
| 10 | `trim` | Trim | finish |
| 11 | `roofing` | Roofing | finish |
| 12 | `porch` | Porch | finish |
| 13 | `dormer` | Dormer | finish |
| 14 | `doors` | Doors | finish |
| 15 | `windows` | Windows | finish |
| 16 | `extras` | Shutters, lights and extras | finish |
| 17 | `shading` | Contact shadows | finish |
| 18 | `gable-end` | Gable ends | finish |
| 19 | `porch-frame` | Porch posts and beam | both |
| 20 | `dormer-frame` | Dormer framing | frame |
| 21 | `foundation` | Blocks and anchors | frame |
| 22 | `interior` | Shelves, benches and electrical | frame |
| 23 | `ramp` | Ramp | finish |

* **frame** — NEW geometry (Barnwright drew no framing). Never shown in Finished.
* **finish** — Barnwright's geometry, triangle for triangle (except `ramp`, new, only when a ramp is chosen).
* **both** — shown in Finished and Framing (skids; porch posts and beam, which are Barnwright geometry).
* **always** — the ground.

### Views

The customer designer offers **Outside** (the finished 3D building) and
**Inside** (the dimensioned floor plan, unless `features.floorPlan` is false).
The finished picture retains `always`, `both` and `finish` stages, identical
to Barnwright. Customer rebuilds always use `frames: false`, including calls
to the page API. Switching views changes only the display mode; it does not
scan triangles, construct framing, create a player or run construction timers.
Legacy `features.framingView` and `features.buildPlayback` values cannot enable
customer tabs.

Construction lessons, part descriptions, the parts gallery and their skills
are internal onboarding aids. They remain in the working repository and
learning preview, outside the client website. `ui/part-details.js` holds the
parts gallery's geometry summaries; `ui/views.js` does not import them.
The engine retains framing stages and `assemble(plan, {frames:true})` for
internal previews and checks. `construction.buildOrder` records the internal
construction sequence and is not a customer playback feature.

## The engine

### Builds are values (`engine/buckets.js`)

```js
const build = createBuild({ sel });   // { buckets:{}, ORDER:[], hitQuads:[], tags:{}, stage, part, item }
const kit = makeKit(build, { constants, view: { fitDist, scene } });
```

`kit` is a frozen object of functions closed over one build, so two builds
never share state (parts gallery, snapshots, checks). It carries, with
Barnwright's names and maths:

* `MAT(key, tex, tint, spec, gloss, glow, bump)` — **first call per key wins**;
  `ORDER` = first-creation order = draw order.
* `DECAL(key, tex)`; `mat(key, tex, hexOrLin, spec, gloss, bump)` — hex→linear
  `^2.2`; when `kit.item` is the selected id the key gets `!==g` and `glow=1`.
  Flags set on a returned bucket (`age glassM turf noCast`) mutate it, as in Barnwright.
* `pushTri pushQuad quadUV box wq wbrace wtri3 gq2 gbrace2 wallPt` — Barnwright's.
* `beam(b, p0, p1, w, d, up)` — NEW, for framing only: a closed 6-face board
  from `p0` to `p1`, `w` wide and `d` deep, `up` giving its roll; CCW outward.
* `setStage(key)`, `setItem(id|null)` (replaces `CURIT`), `hit(id, n, pts)`
  (records the current stage too), `part(id, fn)` (runs `fn` with triangles
  tagged `id`; innermost wins).
* `kit.STEP` (`RIB` on metal buildings, else `GROOVE`), `kit.constants`, `kit.view`.

Vertex = **9 floats**: `x y z nx ny nz u v stage`. Per-triangle part tags are
kept beside the bucket as run-length segments `{part, from, count}` in
`build.tags[key]` (never in the vertex buffer).

### Textures (`engine/tex-names.js`, `engine/textures.js`)

Exactly Barnwright's 11, same identifiers, as strings:
`texSiding "siding"`, `texMetal "metal"`, `texTrim "trim"`, `texFlat "flat"`,
`texGrass "grass"`, `texGlass "glass"`, `texRoofMetal "roofMetal"`,
`texRoofCap "roofCap"`, `texAO "ao"`, `texAOv "aoV"`, `texAOcorner "aoCorner"`.
`textures.js` creates **all 11 eagerly, in Barnwright's order (1750-2054),
before anything else draws**, with painters copied byte for byte.
`createTextures(gl, { rand })` lets a test hand each painter its own seeded
generator (reset per texture). The renderer maps names to GL textures.

### Shaders (`engine/shaders.js`)

* `FS` — Barnwright's fragment shader, **byte-identical** (warm sun
  `vec3(1.32,1.24,1.06)`, per-sheet colour shift, lawn-green env).
* `FSTRUE` — the Yoder site's Sep 20 2026 true-colour version (grey lights at
  equal Rec.709 luminance, no per-sheet colour shift; glass and the `yard`
  scene keep their colour). Used when `company.look.trueColour` is true.
* `VS` and `VSD` gain the stage table:
  ```glsl
  attribute float aStage; uniform vec4 uStg[32];   // x = HIDDEN (1 = hidden), y = lift in ft
  vec4 s = uStg[int(aStage + 0.5)];
  vec3 p = aP + vec3(0.0, s.y, 0.0);               // p replaces aP for gl_Position, vW and vSh
  if (s.x > 0.5) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  ```
  Hidden = 1 so a never-uploaded table (all zeros) means "all visible, no
  lift" = Barnwright. `aP + 0.0` is exact, so the Finished view is unchanged.
* `bindAttribLocation` before linking both programs: `aP 0, aN 1, aUV 2, aStage 3`.
  Stride 36 bytes in both passes; `aStage` at offset 32 pointed per bucket in both.
  `uStg` uploaded to **both** programs whenever the view changes.

### Renderer (`engine/renderer.js`)

Barnwright's `uploadBuffers` + `draw` + shadow pass + both watchdogs +
`projCache`, taking the build and `{bounds:{W,L,H}, gr, fitDist}` from
`assemble` instead of reading globals. Kept quirks: the truncating
`canvas.width = cw*dpr` assignment; on window resize it re-fits the camera but
keeps the ground radius from the last build; `preserveDrawingBuffer:false`, so
`snapshot.js` draws and reads in the same task. Test hooks
(`renderer.test = { freezeWatchdog, forceShadow, dprCap }`) make pictures
deterministic. It skips drawing while the canvas is 0x0 (ResizeObserver) and
pauses while off screen (IntersectionObserver) or hidden.

### Camera (`engine/camera.js`)

`fitDistFor(W, L, {w, h}, mode)` is pure. `mode:"barnwright"` is Barnwright's
(×1.16 when the canvas is taller than 1.05× its width) — used by the golden and
look tests. `mode:"fitref"` is the Yoder site's `FIT_REF = 1.16*742/803`
back-off (no cliff, fixes iPads and phones) — used by the product. The two agree
at 1440x900, where the look tests run. `interacted` only affects the browser
camera, never the build.

### Assembly (`engine/assemble.js`)

```js
assemble(plan, { viewport:{w,h}, fit:"fitref", scene:"studio", frames:false, only:null })
  -> { build, ORDER, gr, fitDist, bounds:{W,L,H} }
```

Barnwright's `buildShed` order: create the build; `fitDist = fitDistFor(...)`;
core materials (`body trim wood skid`, `kfloor` on a kennel) with Barnwright's
parameters; run `PIPELINE` entries whose `appliesTo(plan)` is true, in order;
the frame parts last, and only when `frames` is true. `only` is a full build
filtered afterwards by part tag, so a part drawn alone keeps exactly the
materials and order it has on the whole building.

## Parts (`parts/`)

```js
export default {
  id: "wall-frame",                 // .claude/skills/part-wall-frame/SKILL.md
  name: "Wall framing",
  stage: "wall-frame",
  realLife: "{stud} studs {studSpacingIn} in on centre on a single bottom plate, doubled top plate; king and jack studs and a header at every opening.",
  appliesTo(plan) { return true },
  build(plan, kit) { … },
}
```

* `realLife` is a template; `{name}` placeholders are filled from
  `plan.construction` (so a caption never contradicts a company's numbers).
  `check-parts` fails on a digit outside a placeholder in a frame part's template.
* A part reads only `plan` and `kit` — no globals, no DOM.
* **A PIPELINE entry is a Barnwright call site, not a part boundary.** A part may
  export helpers another entry calls at Barnwright's position, wrapped in
  `kit.part("<owner id>", fn)` so the triangles are attributed to their owner.

### PIPELINE (Barnwright `buildShed` order; frame parts last)

| # | entry | parts attributed | stage(s) | Barnwright source |
|---|---|---|---|---|
| 1 | `skids` | skids | skids | floor loop, skid boxes; `skidXs` |
| 2 | `floor` | floor | floor | floor loop, deck slab |
| 3 | `siding` | siding, kennel | siding | walls loop F,B,R,L (+porch walls): wall siding, porch cut-outs, skirt rule. At F on a kennel calls `kennel.front`, at R/L `kennel.side` (attributed `kennel`), at B the `bodyIn` inner face |
| 4 | `corner-trim` | corner-trim | trim, shading | corner posts, corner AO decal |
| 5 | `porch-junction` | porch | trim | porch junction trim |
| 6 | `kennel` | kennel | extras | `kennelExtras` only |
| 7 | `gable-siding` | gable-siding | gable-end | gable-end fill (incl. cottage) |
| 8 | `gable-band` | gable-band | gable-end | band (`gableBandY`) |
| 9 | `gable-vent` | gable-vent | gable-end | vent |
| 10 | `belt-band` | belt-band | trim | single-slope belt band |
| 11 | `porch` | porch | porch, porch-frame | header/ceiling + porchFront / porchSideCorner / porchCorner |
| 12 | `roofing` | roofing | roofing, trim | `profileRoof` (fascia, soffit, rake boards tagged `trim`) |
| 13 | `dormer` | dormer | dormer | `dormer()` |
| 14 | `openings` | door-wood, door-steel, door-lite, roll-up, window, gable-window, light, porch-post | doors, windows, extras, porch-frame | `renderItem` / `renderGableWin` per item |
| 15 | `ground` | ground | site, shading | lawn disc, contact shadow, eave AO |
| — | `ramp` | ramp | ramp | NEW (only with a ramp chosen) |
| 16+ | `foundation floor-frame floor-deck wall-frame gable-frame roof-frame loft roof-deck dormer-frame porch-deck-frame interior` | each its own | frame stages | NEW, `frames:true` only |

`tools/lib/barnwright-blocks.mjs` records which Barnwright lines/functions
produce each part's triangles (the golden capture's tagging table), pinned to
the SHA-256 of Barnwright's file.

The learned `gable-backing` framing entry follows `roof-frame`. It is active
only with the opt-in truss lesson and the company’s `gableBacking` settings;
its selected-end window/fake-window condition, actual stud-face gaps and
outer roof outline control the pieces. Both outer bays extend behind the
truss face to support siding seams. Outer cuts derive at both backing-edge
heights; the precise face joint is provisional. It shares stage `roof-frame`.

The opt-in `gable-window-frame` entry follows it, also in `roof-frame`.
Its two horizontals read the selected clear `trussStudy.windowOpening`;
`gable-frame` supplies moved full-height side studs. Window dimensions are
per design, resolved by `model/truss-window.js`, with validated optional
auto-fit height. No window restores the regular marks and backing; a fake
window omits backing without inventing a real opening.

### Openings (`parts/openings/`)

The opt-in `window-header` framing entry follows `wall-frame`, using that
existing stage. It draws Alan's lofted-wall three-board header only when a
`windowHeaderStudy` exists. The separate `window-framing.html` lesson uses
`model/window-header-study.js` to isolate its members and add clearly
labeled portions of the top/upper plates as display context. It does not
put a header over uncut plain-wall studs or alter ordinary opening framing.
The following opt-in `window-plate` entry uses `windowPlateStudy` from
`model/window-plate-study.js`. It draws a flat plate and supporting studs
copied from the original wall layout and shortened between bottom-plate
top and window-plate underside. Window height controls the latter datum.
The UI has lower-assembly, header and all-learned-pieces views; the combined
view remains incomplete pending side framing. Contextual bottom-plate
portions do not change full wall cuts. Original layout datum is retained.

The opt-in `doorway-frame` entry follows the window lessons and reads only
`doorwayStudy`. `model/doorway-study.js` calculates independent opening
width, king-stud cut and selected header option. Alan's king stud is the
shorter support; legacy wall-frame member names remain internal. Header
cuts include full bearing at each end. The isolated `doorway-framing.html`
lesson shows loft headers, two stacked-flat boards, or king studs directly
to the top plate. Plate context retains actual elevations and upper end
setbacks; threshold cuts remain unconfirmed. Alan's subsequent rule adds
studs filling any positive gap above a framed opening. Their cuts follow
actual header-top and top-plate-underneath datums. `openingStudLayout`
reuses full-width supported wall marks; exact upper-stud layout is provisional.

`model/utility-study.js` opts in to Alan's 89-inch utility stud cut, keeping
the loft lesson and ordinary geometry unchanged. The new framing entry
`utility-window-frame` reads `utilityWindowStudy`: one flat top window
plate and studs above it. The confirmed gap is measured from the window
plate top to the wall top-plate underside: 12.5 in. Plate top/underside
derive to 78/76.5 in above flooring; they are not independent height defaults.
`utility-framing.html` uses exact-mesh PNGs and
an adjustable 3D detail; doorway framing can select utility or loft walls.
`construction.utilityStudy.roof` records standard 5/12 and steep 7/12
A-frame pitch. `utilityRoofPitch` computes rise from explicit horizontal
run for the diagram. `utilityRoofRule` selects 2x4 at or below nominal
10-wide, otherwise 2x6, and records 4-in side projection, 2-in end height
and the side-wall upper-plate-top bottom-cut datum. Full seat/joint geometry
remains separate from these confirmed inputs.
`model/utility-roof-study.js` adds an explicitly selected standard-pitch
end-wall roof preview; `roof-frame` reads its two clipped stock strips.
`model/utility-roof-measurements.js` supplies the existing wall and corner
plate display portions to exact-mesh PNGs. Its level tail, peak elevation,
ridge mitre and centered depth fit remain review assumptions. No utility
gable infill is inferred from the loft lesson; incompatible seat fits reject
rather than adding timber. `utility-framing.html#roof` shows both pictures.

`parts/openings/index.js` walks `plan.state.items` in array order exactly as
`buildShed` calls `renderItem`: skip interior items (before `setItem`), apply
the rotated-transom and door-height overrides, `setItem(it.id)`, create the
five preamble materials in Barnwright's order (`trim`, `body` with age, `dark`,
`white`, `glass` with glassM) for EVERY non-interior item, then hand off to the
item's draw module (`parts/openings/<draw>.js`, chosen by the item's `draw`
trait), and `setItem(null)` on every exit. Draw modules keep their own `mat()`
calls in source order, duplicate keys included (`galv`, `doorSh6`), so
first-wins resolves as it does in Barnwright. Shared casing/head/sill code and
the item primitives (`wret wrev wslab wbevel wdisc wdrum wslant`) live in
`parts/openings/common.js` and take `kit` as an argument.

## Framing datums (how real lumber fits Barnwright's drawn envelope)

The separate floor lesson explicitly calls `floorStudyPlan` in
`model/floor-study.js`. It reads company `construction.floorStudy` and adds
a frozen `plan.floorStudy`; ordinary `makePlan` does not activate it.
For that path, `skidStudyMembers` creates true notched prisms and
`floorPlanOf` sets joist bottom at skid height minus notch depth, then adds
the full actual joist depth. Sheets follow that top. Measurements and labels
read those same members. The lesson's confirmed outside-wall-to-inside-face
offset is separate from the normal skid table's center offsets. See
[the lesson agreement](examples/10x16-side-loft.md) for confirmed and pending
dimensions. The legacy datums below still govern the normal designer.

Barnwright's envelope was drawn to look right, not stacked from real lumber.
Frame parts fit INTO it; the caption names the real lumber.

1. **Floor**: skids occupy `y 0 .. 0.5`. Joists sit on the skids and the deck top
   is `y0`: joist depth drawn = `0.42 - deckThickness * layers`. Joists run across
   the width at `floor.spacingIn` on centre, rim joists along both long sides.
2. **Walls**: bottom plate on `y0`; the top of the upper top plate is `topY`;
   studs fill between. Studs sit inside the siding plane
   (`o` from `-0.02` to `-0.02 - studDepth`). Openings use `openingRect(it, plan)`
   (the same rectangle the openings part draws around): king studs outside, jack
   studs under the header, header over the opening, sill and cripples under a window.
3. **Roof**: members live between the underside of the roof slab and `topY`,
   below the profile line. Rafter/truss top chords follow the profile; where a
   chord crosses a wall it gets a bird's-mouth (clipped at `topY` inside the
   walls). Rafter tails may run out under the eave overhang, never past the
   fascia or soffit. Gable studs (`gable-frame`, stage `roof-frame`) fill the
   gable ends under the profile, clipped with `gableClip`.
4. **Loft**: joists at `topY` on the styles with the `loft` trait, at the ends
   and depth the trait gives, within the roof volume.
5. **`tools/check-framing.mjs`** tests by region: below `y0` inside the
   footprint (porch and kennel decks included); `y0..topY` inside the siding
   plane; above `topY` under the roof slab (eave and rake overhangs included),
   never outside the fascia or soffit. Also: no two members overlap by more than
   0.01 ft, no bearing gap over 0.01 ft, every opening has kings, jacks and a
   header, member spacing matches `plan.construction`.

## Construction settings (`library/construction.json`, `model/construction.js`)

Any value can be a single value or a rule list, first match wins:
`[{ "when": {"maxW": 8}, "value": "2x4" }, { "value": "2x6" }]`, where `when`
may test `minW maxW minL maxL styles roof metal`. Defaults (each overridable by
the manufacturer file, then the company):

* `site`: `blocks "4x8x16"`, one per `4` ft of perimeter; `anchors` by length.
* `skids`: `size "4x6"`, on edge, treated; `table {6:[6],8:[18],10:[30],12:[8,37],14:[8,54]}`
  (inches from each side edge to skid centre, Alan's build sheet); fallback bunk spacing 60 in.
* `floor`: `joist [{maxW:8 -> "2x4"}, "2x6"]`, `spacingIn 16`, `rim "2x6"`,
  `deck { thicknessIn 0.625, sheet "4x8 T&G", layers 1 }`.
* `walls`: `stud "2x4"`, `spacingIn 16`, `bottomPlates 1`, `topPlates 2`,
  `corner "3-stud"`, `header [{maxSpanFt:4 -> "2x6 doubled"}, {maxSpanFt:6.5 -> "2x8 doubled"}, "2x10 doubled"]`,
  `studLengthIn { loft 75, tall 89 }` (caption only).
* `openings`: `doorHeightIn { gambrel 71.5, other 76.5 }`, the window-top rule
  (loft builds 5 in under the wall top; tall walls level with the door head).
* `roof`: `framing "truss"`, `spacingIn 24`, `chord "2x4"`, `gussets "plywood"`,
  per roof shape `{ rise, knee, upperRise, eaveOverhang, rakeOverhang }` with
  Barnwright's numbers as defaults.
* `roofDeck`: `[{metal roof -> "purlins"}, "osb"]`, purlins `2x4 flat, 24 in`.
* `loft`: `joist "2x6"`, `spacingIn 16`, deck `0.625 in`.
* `porch`: `post "4x4"`, `joist "2x6"`, `railHeightIn 34`.
* `buildOrder`: see Views.
* `notes`: `{ "12": "A 12 ft wide building is 11 ft 2 in actual.", "14": "14 ft wide needs a permit or pilot car." }`.

Options change the frame: an option may carry
`"construction": { "floor.spacingIn": 12 }` (12 in joists) or
`{ "floor.deck.layers": 2 }` (double floor). `plan.construction` =
library defaults + manufacturer + company + the options chosen, resolved for this
building's width, length, style and roof.

## Catalogue: manufacturer + company

**Manufacturer file** (`library/manufacturers/<id>.json`) — what a builder
makes, shared by every dealer of that builder, **no prices**:

* `styles`: `{ "UT": { "name", "category", "roof", "wallH", "metal", "dormer",
  "porch", traits…, "loadout" } }`
* `items`: `{ "w72": { "name", "kind", "draw", "w", "h", "leaves", "rotatable",
  "gable", "int", "stretch", "dep", "perFt", "free" } }`
  — `draw` ∈ `shop-door steel-6panel lite-door roll-up window transom octagon
  gable-1824 faux-loft light porch-post bench shelf outlet overhead-light`.
* `palettes`: `{ "paint": [[name, hex]…], "trim": …, "metal": … }`
* `options`: which dormers, ramps, electrical packages, misc and per-sq-ft
  options exist, and their `construction` effects — no prices.
* `construction`: overrides of `library/construction.json`.

**Style traits** (replace every `state.type === "XX"`):

| trait | replaces | meaning |
|---|---|---|
| `kennel` | `"DK"` (13 places) | kennel walls, gates, run, `kfloor` |
| `cottage` | `"CS" \|\| "MCS"` | `cottageEave`, level soffit, gable fill to the roof line, band rule |
| `gambrel: {lowerRise, upperRise, knee}` in ft or `W`-fractions | `"SB"` in `roofProfile` | the mini barn's steep shoulders |
| `gableVent: false` | `"SB"` in the vent test | no gable vent |
| `gableBand: false` | `"GU" "SB"` in `gableBandY` | no gable band |
| `rakeOverhang` | `"GU" "CS" "MCS"` in the `profileRoof` call | gable-end overhang |
| `loft: {ends, depthFt}` | (new) | lofted styles, for the loft part |

`roofRise` keeps Barnwright's per-roof factors (0.45W for the mini barn,
although its profile differs — a kept quirk).

**Loadouts** (`model/loadouts.js`): a style's `loadout` is either a named
Barnwright recipe — `"barnwright:UT"` … one per `includedItems` branch, ported
exactly — or a data recipe: a list of
`{ cat, wall, at: "center" | {fromStart} | {fromEnd} | {sym: "L/4+1.4"}, when: {minL,maxL,minW,maxW}, dbl, ifFits, repeat: {count, spread} }`
with formulas over `W L q` and catalogue widths, evaluated by a small safe
parser (no `eval`). `tools/check-loadouts.mjs`: for every company, style and
offered size, the standard items land without `clampPos` moving them and
without overlapping; the demo reproduces the golden `includedItems` exactly.

**Company file** (`companies/<id>/company.json`):

```jsonc
{
  "id": "acme",                        // ^[a-z0-9-]{2,40}$
  "status": "active",                  // active | suspended
  "manufacturer": "standard",
  "brand": { "name", "short", "initials", "tagline", "phone", "email", "website",
             "colors": { "header", "accent" }, "logo",
             "credit": { "text": "3D designer by Barnwright", "url": "", "show": true } },
  "offer": {                           // ONLY these styles load; sizes REPLACE, in chip order
    "UT": { "sizes": { "8x12": 3400, … }, "name": "…optional rename…" }
  },
  "categories": [ ["Utility & Storage", ["UT", "SU"]] ],
  "items": { "w48": 150, "w72": 300, … },            // offered items and their prices
  "options": { "dormers": {"6": 1300}, "ramps": {…}, "elec": {…}, "misc": {…}, "rates": {…}, "extras": [] },
  "palettes": { "paint": ["White", "Navy", …] },     // names picked from the manufacturer, or [name, hex] pairs
  "defaults": { "style": "LB", "size": "10x20", "colors": { "body": "White", "trim": "Black", "roof": "Black" } },
  "construction": { … },
  "pricing": { "show": "price", "roundTo": 5, "minCharge": 5, "roofAreaFactor": 1.15,
               "rto": { "factors": {"36": 0.60, "48": 0.53, "60": 0.45}, "showTerm": 60 } },
  "notes": { "finePrint": "…", "sizeNotes": { "12": "…" } },
  "leads": { "mode": "form", "url": "…", "fields": { "name": "required", "phone": "required", "email": "optional", "zip": "required", "address": "optional", "note": "optional" },
             "smsConsent": null, "images": false },
  "embed": { "origins": ["https://acme-sheds.com"], "shareUrl": "https://acme-sheds.com/design" },
  "look": { "trueColour": true, "scene": "studio" },
  "features": { "floorPlan": true },
  "license": { "plan": "hosted", "renews": "2027-09-01" },
  "renames": { "items": {}, "sizes": {}, "colors": {} },
  "cfg": 1                             // bump when prices/items change; saved designs carry it
}
```

* A company inherits nothing priced. A size, item or option without a price in
  the company's own file is a validation ERROR, never a silent inherit.
* `companies/demo` offers every standard style with **example prices**.
  Barnwright's real tables live only in `test/golden/barnwright-catalogue.json`
  and are used only by the checks.
* `model/company.js` resolves manufacturer + company into one catalogue in
  Barnwright's shapes (`P`, `TYPES`, `CATS`, `CAT`, `DORMERS`, `RAMPS`,
  `ELECPK`, `MISC`, `RATES`, `OPTX`, `COLORS`) so ported code keeps its names,
  and reports every problem in plain words.

## Design (saved/shared) and state (live)

**`state`** — the live, mutable, Barnwright-shaped object the UI owns:
hex `body trim roof doorC shutC`; `items[]` with `id cat wall pos vy px pz rot
ln inc pk dbl shut lite origCat`; `sel seq dormer pLen pFlip pMid opts elec ramp xopt`.
Only `model/layout.js`, `model/design.js` and the UI mutate it. Layout functions
read siblings from the live `state.items` (clamping order matters).

**`design`** — the saved/shared form: `{ v:1, company, cfg, type, size,
colors by NAME, items with Barnwright's field names (defaults left out), dormer,
porch, opts, elec, ramp, xopt, priced?: {total, at} }`.
`toState(design, cat)` applies size → type → size (Barnwright `applyDesign`)
and restores colours by name; anything that no longer exists (renamed or
dropped item, size no longer sold) is reported, never silently dropped.
`fromState(state, cat)` is its inverse. Round trip is checked for every golden
case (same items, same `priceParts`).

**`normalize(state, frame, cat)`** holds the rules Barnwright applied while
rendering the UI (4x8 porch under 20 ft, hidden packages/options switched off),
so pricing never depends on whether the screen was drawn.

**`makePlan(state, cat)`** = `structuredClone` + `frameOf` + deep freeze. Parts
only ever see this frozen copy.

**Share link**: `encode(design)` → compact JSON (short keys, defaults left out,
items as tuples) → UTF-8 → optional `deflate-raw` (CompressionStream, `z`
prefix) → base64url via TextEncoder/TextDecoder (never `btoa` on text). A 30-item
design stays under 1,800 characters (checked). The link goes to
`company.embed.shareUrl + "#d=…"` when set (the company's own page), else the
designer's own address. **A link never carries a price anyone should trust**:
view mode prices from today's list; when the link's `priced.total` differs it
says so ("this link was priced at $X on <date>; prices may have changed").

## Leads (`ui/quote.js`)

Managed `/d/<lot>/` links load their company and lot from the backend. Submitting
an order resolves the recipient and recomputes its price on the server, saves a
catalogue/price snapshot and returns a receipt. A design link retains its lot.
Owner/Admin accounts control the business catalogue; dealer staff read only
assigned-lot orders. No payment or automatic dealer email is sent. Alan's
platform billing remains separate and deferred.

`company.leads.mode`:

* `none` — a showroom: no quote button.
* `form` (template default) — an ordinary HTML form POST (no CORS preflight) of
  flat fields plus the share link and summary to a form service the company
  already uses (Formspree, Basin, Web3Forms, Netlify Forms).
* `mailto` — opens the visitor's mail app; the link, not the pictures.
* `webhook` — `POST` as `text/plain;charset=UTF-8` (no preflight) of
  `{ design, contact, summary, link, priceComputedBy: "browser", images? }`;
  images only when `leads.images` is true, capped at 300 KB.
* `postMessage` — to the embedding page, only to an origin on `embed.origins`.

Always: `leads.fields` decides what is asked and required; optional
`leads.smsConsent` wording (unticked box); a honeypot field and a minimum time
on the form; the result is ALWAYS shown, and on failure (and always after
`mailto`) the company's phone (call/text links), a "copy my design link" button
and the summary appear on screen. Every string from a config, a link or a lead
is escaped (`ui/esc.js`).

## Embedding and phones

```html
<div id="shed-designer"></div>
<script src="https://<host>/embed.js" data-company="acme" data-height="640"></script>
```

* `embed.js` inserts a lazy iframe (`loading=lazy` + IntersectionObserver) of
  `/c/<id>/?embed=1` (a Netlify rewrite to `index.html`), height from
  `data-height` (default 4:3, at least 520 px), a Full-screen button (Fullscreen
  API, fixed overlay on iOS). It passes the host page's `#d=` into the iframe.
* It re-dispatches only messages with `e.source === iframe.contentWindow` and
  `e.origin === designerOrigin` as DOM events (`shed:ready`,
  `shed:design-changed`, `shed:quote-requested`). v1 accepts no commands in.
* The designer posts to the parent only when the parent origin
  (`location.ancestorOrigins[0]`, else `document.referrer`) is on
  `embed.origins`; contact details only in `postMessage` leads mode.
* In embed mode on touch screens a "Tap to design" overlay lets a vertical
  swipe scroll the host page until tapped; the mouse wheel zooms only with Ctrl
  or after a click. No header bar; the brand goes on the plate.
* Layout: the Yoder site's `100dvh` + `(min-width:940px) and (min-aspect-ratio:1/1)`
  two-column rule, so iPads keep the Inside button on screen.
* Hosting (default: Alan hosts): `tools/build-headers.mjs` writes `_headers`
  with `frame-ancestors` per company from `embed.origins`; `status:"suspended"`
  shows "This designer is not available — call <phone>"; `brand.credit` shows
  "3D designer by Barnwright" unless white-label.
* Budgets: first picture under 2.5 s on a mid-range phone; a 14x40 Finished
  rebuild under 45 ms (checked in the look/perf check at 1440x900 on swiftshader
  with a looser bound).

## Setting up a company

* `tools/new-company.mjs --id acme --name "Acme Sheds" --phone … --styles UT,LB,G`
  writes `companies/acme/company.json` from `_template`, validates it, and
  prints what is still missing in plain words.
* `tools/import-prices.mjs companies/acme prices.csv` reads `style,size,price`
  (and `item,price`) and writes them in; `--export` writes the CSV back out for
  the dealer to check.
* `setup.html?company=acme` — the contact sheet: every offered style and size
  drawn with its standard doors and windows and its price, to screenshot and
  send for sign-off.
* The `new-company` skill walks a Claude session through all of it.

## The golden test

`tools/capture-golden.mjs` (reads Barnwright only; refuses if the file's SHA-256
differs from the pinned one) opens Barnwright's `public/3ddesign.html` in
headless Chromium (swiftshader, `reducedMotion: "reduce"`, fixed viewport) and,
for every case in `tools/lib/golden-cases.mjs` (every style × smallest /
typical / largest size, plus item, colour, porch, dormer, glass, rotated
transom, double window, shutters, door lite, gable windows, roll-ups, lights,
porch posts and selection variations):

* sets the state through Barnwright's own functions, then records Barnwright's
  exact `state` (items with ids, sel, porch fields, hex colours);
* hooks `pushTri` (with `Error.stackTraceLimit = Infinity`) and tags every
  triangle with a part id: the innermost active wrapper (`profileRoof dormer
  renderItem(by draw trait) porchFront porchSideCorner porchCorner kennelFront
  kennelSide kennelExtras meshWall`) wins, else the `buildShed` line range;
  any untagged triangle fails the capture;
* wraps `uploadBuffers` and records `ORDER`; every bucket's parameters (texture
  name by identity against the 11 globals, tint, spec, gloss, glow, bump, unlit,
  noCast, age, glassM, turf); per `(bucket key, part)` the count and a hash of
  its vertex floats rounded to 1e-4 in emission order; each whole bucket's hash;
  the canvas client size, `cam.fitDist` and `window.__GR`;
* records one hash per procedural texture with seeded painters, and the
  Finished-view look pictures (Barnwright's settled SECOND frame after a
  rebuild — see DIFFERENCES #1).

The model results (`includedItems`, clamped positions, `roofProfile`,
`pSizes`, `priceParts`, `openingRect`) are not recorded: `tools/check-model-live.mjs`
compares them against Barnwright's live page for every style and size.
`test/golden/barnwright-catalogue.json` (Barnwright's exact tables) is written by
`tools/extract-barnwright-catalogue.mjs`.

`tools/check-golden.mjs` (Node, no browser) resolves the Barnwright catalogue
into a company, feeds each case's recorded `state` and viewport to `makePlan` /
`assemble({fit:"barnwright", frames:false})`, drops the 9th float, and compares:
`fitDist` and `gr`; per-part pairs (so one part can be proven at a time; a part
not yet ported is reported as pending, not failed, until the pipeline is
complete); then `ORDER`, whole buckets and material parameters. Exact, or it
names the case, bucket, part and first differing triangle.

`tools/check-look.mjs` renders the same cases in both pages with identical
viewport, `deviceScaleFactor`, camera, `hasShadow = true`, `DPRCAP = 2`,
watchdogs frozen, and per-texture seeded painters; it draws and reads pixels in
one task and compares the canvases (Finished view, `look.trueColour` off).

## Porting rules (the only edits allowed to Barnwright code)

1. `T()` → `plan.t`; `dims()` → `plan.d`; `pSpan()` → `plan.span`;
   `wallDefs()` → `plan.ws`; `state` → `plan.state`; `CAT` → `plan.CAT`;
   `STEP` → `kit.STEP`; constants from `engine/constants.js`;
   `SC()` → `kit.view.scene`; `cam.fitDist` → `kit.view.fitDist`.
2. `state.type === "XX"` → the style trait (table above).
3. Item-id tests → item traits from the manufacturer file: `it.cat === "w72"`
   → `plan.CAT[it.cat].leaves === 2`, `w36|w48|w72` → `draw === "shop-door"`,
   `dfr|d36lite` → `draw === "lite-door"`, `tr` → `draw === "transom"`, etc.
4. A shop literal becomes a construction read with Barnwright's value as the
   default (door heights, window-top rule, skid table, roof rise/knee/overhangs).
5. A pure calculation may move into `model/` (first: `openingRect(it, plan)`,
   used by openings, wall-frame, gable-frame and picking).
6. `CURIT = x` → `kit.setItem(x)`; `hitQuads.push` → `kit.hit`;
   `window.__GR = gr` → returned from assemble.
7. Add `setStage` and `part(...)` calls. They change no geometry.
8. Keep every comment that records a real-life fact, in the code AND in the
   part's skill file.

Each is allowed only while `tools/check-golden.mjs` stays green on the demo
catalogue. Anything else is a behaviour change: list it in `docs/DIFFERENCES.md`.

## Kept Barnwright quirks (look-defining)

`CASING = 0.27`; metal siding UVs divide by `GROOVE`; gambrel rake overhang
forced to 0.10 in `profileRoof`; `roofRise` 0.45W for the mini barn; porch C
adds 4 ft to `L`; the warm sun in `FS` (company option `look.trueColour`
switches to `FSTRUE`); the floor slab is segmented and inset 0.03; resize keeps
the built ground radius.

## Deliberate differences (`docs/DIFFERENCES.md`)

Behaviour fixed in the port, none of which changes a finished picture:
package fixtures laid after `resetItems` on a style change; colours restored by
name; a hidden dormer not pickable; one per-square-foot price function for the
label and the charge; `pkFixtures` order; size change re-lays the standard
doors and windows only if the customer has not touched them; camera fit
`fitref` in the product; one `visibilitychange` listener; full HTML escaping.
