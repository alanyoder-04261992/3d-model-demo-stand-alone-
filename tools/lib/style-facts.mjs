/* THE STYLE REFERENCE FACTS: what each library style looks like, in numbers
   and plain words, for matching a dealer's photos to a style. Node only, pure
   (it reads what it is handed; tools/make-style-refs.mjs and
   tools/check-style-refs.mjs do the file reading).

   Alan's Control Room shows Claude these facts and two pictures of each style
   (get_style_reference). They are published from this repository's main
   branch, in library/style-refs/:

     <code>.jpg       the style from its front corner (the designer's opening view)
     <code>-end.jpg   the style straight at its front end (the roof's shape and pitch)
     sheet.jpg        every style's corner picture on one page, labelled with its code
     styles.json      the facts below, the pictures' sha256, and the library's version

   Every number comes from the designer's own model code (model/plan.js,
   model/roof-shapes.js, model/layout.js ...) run on the library
   (library/manufacturers/standard.json and library/construction.json) and the
   sample price list (companies/demo), which sells every library style at
   Barnwright's own sizes. Only TELLS below is written by hand: what tells a
   style apart in a photo, and which styles look like it.

   styleRefsDoc({standardBytes, constructionBytes, company, pictureBytes})
                       the whole styles.json, as an object. pictureBytes(file)
                       gives a picture's bytes, or null when it is not there.
   serializeDoc(doc)   its exact text, as written and as checked
   drawingCatalogue(...)  the sample price list resolved on the library, ready to draw
   typicalState(cat, code)   the building each picture shows
   jpegSize(bytes)     {width, height} of a JPEG, or null when it is not one */

import { createHash } from "node:crypto";
import { resolve as resolveCompany } from "../../model/company.js";
import { defaults, setType, normalize } from "../../model/design.js";
import { frameOf } from "../../model/frame.js";
import { resetItems, openingRect } from "../../model/layout.js";
import { makePlan } from "../../model/plan.js";
import { gableBandY } from "../../model/roof-shapes.js";
import { pSizes } from "../../model/pricing.js";
import { y0 } from "../../engine/constants.js";

export const REFS_DIR = "library/style-refs";
export const STYLES_FILE = "styles.json";
export const SHEET_FILE = "sheet.jpg";
export const STANDARD_PATH = "library/manufacturers/standard.json";
export const CONSTRUCTION_PATH = "library/construction.json";
export const DRAW_COMPANY = "demo";
export const FORMAT = 1;

/* How the pictures are drawn and saved (tools/make-style-refs.mjs reads these). */
export const BACKDROP = "#E9E9E5";            /* the studio backdrop, as the look check uses */
export const LONG_SIDE = 1024;                /* every picture is this many pixels on its long side */
export const JPEG_QUALITY = 0.8;
export const VIEWS = Object.freeze({
  three_quarter: Object.freeze({ suffix: "", css: Object.freeze({ w: 900, h: 700 }), camera: Object.freeze({ yaw: 0.62, pitch: 0.215, distOverFit: 1 }),
    words: "From the front corner: the front end on the left, the right long side on the right. The same view the 3D designer opens on." }),
  end: Object.freeze({ suffix: "-end", css: Object.freeze({ w: 700, h: 520 }), camera: Object.freeze({ yaw: 0, pitch: 0.03, distOverFit: 1 }),
    words: "Straight at the front end, from a little above the floor. The roof's shape and pitch can be measured on it: the right long side is on the right." }),
});
export const SHEET = Object.freeze({ columns: 4, width: LONG_SIDE });

/* Size limits, so the Control Room can send pictures to Claude: one picture
   under 100,000 bytes, and one style's two pictures under 140,000 base64
   characters together (about 105,000 bytes). */
export const MAX_PICTURE_BYTES = 100_000;
export const MAX_PAIR_BASE64 = 140_000;
export const base64Length = (bytes) => 4 * Math.ceil(bytes / 3);

export const PICTURE_NAME = /^[A-Z0-9]{1,8}(-end)?\.jpg$/;
export const fileOf = (code, view) => `${code}${VIEWS[view].suffix}.jpg`;

export const PITCH_NOTE = "Every pitch, height and size here is the library's own number: Barnwright's drawing of the standard building line. " +
  "They are not a shop's measured numbers. A dealer's real buildings can be steeper or flatter, and a photo can only say roughly how steep a roof is.";

export const WALL_WORDS = Object.freeze({
  F: "the front end", B: "the back end", R: "the right long side", L: "the left long side",
  S1: "the porch's back wall", S2: "the porch's end wall", S3: "the porch's other end wall",
  P1: "the porch's angled wall", P2: "the porch's side wall", P3: "the porch's back wall",
});
const WALLS_LEGEND = {
  F: "The front end: the short end on the left in the corner picture, and the end the end picture looks at.",
  B: "The back end: the other short end, not seen in either picture.",
  R: "The right long side: the long side on the right in the corner picture. Side-door styles have their doors here.",
  L: "The left long side: the other long side, not seen in either picture.",
  porch: "A porch's own walls are named as the porch's back, end, side or angled wall.",
};

/* ---------------------------------------------------------------------------
   WHAT TELLS EACH STYLE APART IN A PHOTO, and the styles that look like it.
   Written by hand from the reference pictures (judgement, not measurement).
   Every library style needs an entry: the check fails without one. */
export const TELLS = Object.freeze({
  UT: { tells: ["Plain A roof, both sides the same.", "Double doors in the middle of the front end.", "Painted siding, with a trim band across the gable at the top of the walls."],
    look_alikes: [["MU", "Metal siding and no trim band."], ["G", "A roll-up door on the front end."], ["GU", "Smaller: 6 ft wide, short walls and one door."]] },
  SU: { tells: ["Plain A roof.", "Double doors in the middle of a long side, with a window each side."],
    look_alikes: [["DS", "A dormer on the roof, and a steeper roof."], ["SLB", "A barn roof."], ["CS", "The roof's peak is off-centre."]] },
  DS: { tells: ["A dormer with windows on the roof, over the doors.", "A steeper A roof than the Side Utility.", "Doors and windows on a long side."],
    look_alikes: [["SU", "No dormer, and a flatter roof."]] },
  BU: { tells: ["One-slope roof, low over the door side and high at the back.", "Small: 6 ft wide.", "One door in the middle of a long side."],
    look_alikes: [["SS", "The high side is over the door, with a row of small windows up high."]] },
  GU: { tells: ["A small A-roof building, 6 ft wide, with short walls.", "One door on the front end.", "The roof hardly sticks out past the ends.", "No trim band across the gable."],
    look_alikes: [["UT", "Taller walls, double doors, a trim band, and the roof sticks out past the ends."]] },
  SB: { tells: ["A small barn roof on very short walls.", "The door rises up into the gable.", "No gable vent and no trim band."],
    look_alikes: [["LB", "Taller walls, a gable vent, a trim band and a loft window."]] },
  LB: { tells: ["Barn roof: a steep lower part and a flatter top.", "Double doors in the middle of the front end.", "A small loft window above the doors."],
    look_alikes: [["MLB", "Metal siding and no loft window."], ["SLB", "The doors are on a long side."], ["SB", "Very short walls and no loft window."]] },
  SLB: { tells: ["Barn roof.", "Double doors in the middle of a long side, with a window each side."],
    look_alikes: [["LB", "The doors are on the front end."], ["SU", "A plain A roof."]] },
  CS: { tells: ["The roof's peak is off-centre: a short steep slope over the door side, a long flatter slope behind.", "The door is near one end of the long side, with a double window beside it.", "Boxed eaves, and the roof hardly sticks out past the ends."],
    look_alikes: [["SU", "Both roof slopes the same."], ["MCS", "Metal siding and no trim band."]] },
  SS: { tells: ["One-slope roof, high over the door side.", "A row of small windows high up on the door side.", "A glass door in the middle of the long side."],
    look_alikes: [["BU", "The low side is over the door, and no row of high windows."]] },
  C: { tells: ["A porch across the front end, under the main roof, with posts and rails.", "Plain A roof.", "A glass door behind the porch, with a window each side."],
    look_alikes: [["SC", "The porch is cut into a long side."], ["DSC", "The porch wraps round a corner."], ["LBC", "A barn roof."]] },
  LBC: { tells: ["Barn roof with a porch across the front end.", "An octagon window in the front gable."],
    look_alikes: [["C", "A plain A roof."], ["LSC", "The porch is cut into a long side."]] },
  SC: { tells: ["A porch cut into one end of a long side, with posts.", "Plain A roof.", "A glass door inside the porch."],
    look_alikes: [["C", "The porch is across the front end."], ["DSC", "The porch wraps round the corner, with an angled wall."]] },
  LSC: { tells: ["Barn roof with a porch cut into one end of a long side.", "A loft window in the gable next to the porch."],
    look_alikes: [["SC", "A plain A roof."], ["LBC", "The porch is across the front end."]] },
  DSC: { tells: ["A porch that wraps round a front corner, with an angled wall behind it.", "Plain A roof.", "A glass door inside the porch."],
    look_alikes: [["SC", "No angled wall, and no porch across the front."], ["C", "The porch is across the front end only."]] },
  SLC: { tells: ["Barn roof with a porch that wraps round a front corner.", "A loft window in the front gable."],
    look_alikes: [["DSC", "A plain A roof."], ["LSC", "The porch is cut into a long side."]] },
  G: { tells: ["Plain A roof.", "A big roll-up door on the front end.", "A steel walk-in door and a window on a long side."],
    look_alikes: [["MG", "Metal siding and no trim band."], ["LBG", "A barn roof."], ["UT", "Wooden double doors instead of a roll-up door."]] },
  LBG: { tells: ["Barn roof with a roll-up door on the front end.", "A loft window above the roll-up door."],
    look_alikes: [["G", "A plain A roof."]] },
  MU: { tells: ["Ribbed metal siding and no trim band.", "Plain A roof.", "Double doors in the middle of the front end."],
    look_alikes: [["UT", "Painted siding with a trim band."], ["MG", "A roll-up door."]] },
  MLB: { tells: ["Ribbed metal siding with a barn roof.", "Double doors on the front end, and no loft window."],
    look_alikes: [["LB", "Painted siding and a loft window."]] },
  MG: { tells: ["Ribbed metal siding.", "A roll-up door on the front end."],
    look_alikes: [["G", "Painted siding with a trim band."], ["MU", "Double doors instead of a roll-up door."]] },
  MCS: { tells: ["Ribbed metal siding.", "The roof's peak is off-centre, toward the door side."],
    look_alikes: [["CS", "Painted siding with a trim band."]] },
  DK: { tells: ["The front half is an open dog run with chain-link sides and gates.", "One door on the back end.", "Plain A roof."],
    look_alikes: [] },
});

/* --------------------------------------------------------------- helpers */
export const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const r1 = (n) => Math.round(n * 10) / 10;
const r2 = (n) => Math.round(n * 100) / 100;
const r3 = (n) => Math.round(n * 1000) / 1000;
const num = (n) => String(r2(n));
/* feet and inches to the nearest half inch: "7 ft 9 in", "5 ft 11½ in", "11 in" */
function feetInches(ft) {
  const halves = Math.round(ft * 24);
  const f = Math.floor(halves / 24), rest = halves - f * 24;
  const inches = rest ? `${Math.floor(rest / 2) || (rest % 2 ? "" : 0)}${rest % 2 ? "½" : ""} in` : "";
  if (!f) return inches || "0 in";
  return inches ? `${f} ft ${inches}` : `${f} ft`;
}
const height = (ft) => ({ ft: r2(ft), in: r1(ft * 12), words: feetInches(ft) });
function pitchOf(rise, run) {
  return { pitch: `${num(rise / run * 12)}/12`, degrees: r1(Math.atan2(rise, run) * 180 / Math.PI) };
}
const plural = (n, word) => (n === 1 ? word : `${n} x ${word}`);

/* {width, height} from a JPEG's frame header, or null when it is not a JPEG. */
export function jpegSize(buf) {
  if (!buf || buf.length < 4 || buf[0] !== 0xFF || buf[1] !== 0xD8 || buf[2] !== 0xFF) return null;
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xFF) return null;
    const m = buf[i + 1];
    if (m === 0xFF) { i++; continue; }
    if (m === 0xD9 || m === 0xDA) return null;
    if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) return { width: buf.readUInt16BE(i + 7), height: buf.readUInt16BE(i + 5) };
    i += 2 + buf.readUInt16BE(i + 2);
  }
  return null;
}

/* ------------------------------------------------------------ the library */

/* The library's two files as read, their sha256 and one short version. */
export function libraryVersion(standardBytes, constructionBytes) {
  const files = { [STANDARD_PATH]: sha256(standardBytes), [CONSTRUCTION_PATH]: sha256(constructionBytes) };
  return { version: sha256(files[STANDARD_PATH] + "\n" + files[CONSTRUCTION_PATH]).slice(0, 16), files };
}

/* The sample price list resolved on the library, as the pictures are drawn.
   Refused when it would not show the library's own numbers. */
export function drawingCatalogue({ standardBytes, constructionBytes, company }) {
  const manufacturer = JSON.parse(Buffer.from(standardBytes).toString("utf8"));
  const library = JSON.parse(Buffer.from(constructionBytes).toString("utf8"));
  if (manufacturer.extends) throw new Error(`${STANDARD_PATH} extends another manufacturer file; the style pictures expect the standard line on its own.`);
  if (company.manufacturer !== manufacturer.id) throw new Error(`companies/${DRAW_COMPANY} sells "${company.manufacturer}", not the standard line.`);
  for (const [who, c] of [[STANDARD_PATH, manufacturer.construction], [`companies/${DRAW_COMPANY}/company.json`, company.construction]]) {
    if (c && Object.keys(c).some((k) => !k.startsWith("_"))) throw new Error(`${who} changes the construction numbers, so the pictures would not show the library's own pitches. Take that out of ${who} first.`);
  }
  const cat = resolveCompany(company, manufacturer, library);
  const missing = Object.keys(manufacturer.styles).filter((k) => !Object.prototype.hasOwnProperty.call(cat.TYPES, k));
  if (missing.length) throw new Error(`The sample price list (companies/${DRAW_COMPANY}) does not sell ${missing.join(", ")}, so there is nothing to draw. Add ${missing.length > 1 ? "them" : "it"} there first, with ${missing.length > 1 ? "their" : "its"} sizes.`);
  const noTells = Object.keys(manufacturer.styles).filter((k) => !TELLS[k]);
  if (noTells.length) throw new Error(`Say what tells ${noTells.join(", ")} apart in a photo: add ${noTells.length > 1 ? "them" : "it"} to TELLS in tools/lib/style-facts.mjs.`);
  return { cat, manufacturer, library };
}

/* The building a style's pictures show: the size the designer lands on when
   that style is picked (the size Barnwright's own pictures of it use), with
   its standard doors and windows, in the sample price list's opening colours. */
export function typicalState(cat, code) {
  const s = defaults(cat);
  if (s.type !== code) setType(s, code, cat);
  normalize(s, null, cat);
  s.sel = null;
  return JSON.parse(JSON.stringify(s));
}

/* ------------------------------------------------------------- the facts */

function roofFacts(plan) {
  const W = plan.W, top = plan.topY;
  const prof = plan.prof.map((p) => [p[0], p[1] - top]);
  const segs = [];
  for (let i = 0; i < prof.length - 1; i++) segs.push(pitchOf(Math.abs(prof[i + 1][1] - prof[i][1]), Math.abs(prof[i + 1][0] - prof[i][0])));
  const n = segs.length;
  const mirrored = n > 1 && n % 2 === 0 && segs.every((s, i) => s.pitch === segs[n - 1 - i].pitch);
  let slopes;
  if (n === 1) {
    const highLeft = prof[0][1] > prof[1][1];
    slopes = [{ where: `one slope, high over ${highLeft ? WALL_WORDS.L : WALL_WORDS.R} and low over ${highLeft ? WALL_WORDS.R : WALL_WORDS.L}`, ...segs[0] }];
  } else if (mirrored && n === 2) slopes = [{ where: "each side", ...segs[0] }];
  else if (mirrored && n === 4) slopes = [{ where: "lower part, each side", ...segs[0] }, { where: "upper part, each side", ...segs[1] }];
  else if (n === 2) slopes = [{ where: `over ${WALL_WORDS.L}`, ...segs[0] }, { where: `over ${WALL_WORDS.R}`, ...segs[1] }];
  else slopes = segs.map((s, i) => ({ where: `part ${i + 1} of ${n}, left to right`, ...s }));
  const peak = Math.max(...prof.map((p) => p[1]));
  return { slopes, peak_over_wall: height(peak), peak_per_width: r3(peak / W) };
}

const ROOF_WORDS = { gable: "gable: an A roof, both sides the same", gambrel: "gambrel: a barn roof, steep at the bottom and flatter at the top",
  salt: "saltbox: an A roof with its peak off-centre", lean: "lean-to: one slope", slope: "single slope: one slope" };

function sizeOf(size) { const [w, l] = String(size).split("x").map(Number); return { w, l }; }

function itemWords(it, CAT) {
  const c = CAT[it.cat];
  const name = c.n + (it.dbl ? " (a double: two sashes side by side)" : "");
  if (c.gable) return { name, where: `in the ${it.wall === "B" ? "back" : "front"} gable` };
  const wall = WALL_WORDS[it.wall] || it.wall;
  const pos = typeof it.pos === "number" ? it.pos : 0;
  if (Math.abs(pos) < 0.05) return { name, where: `centred on ${wall}` };
  return { name, where: `on ${wall}, ${num(Math.abs(pos))} ft ${pos > 0 ? "right" : "left"} of its middle` };
}
const isOpening = (it, CAT) => { const c = CAT[it.cat]; return !!c && !c.int && (c.k === "door" || c.k === "ru" || c.k === "win"); };

/* Which doors and windows come standard at every standard size: [] when the
   same ones come at every size, else one group per set of sizes. */
function changesWithSize(cat, code, sizes) {
  const groups = [];
  for (const size of sizes) {
    const s = defaults(cat);
    if (s.type !== code) setType(s, code, cat);
    s.size = size;
    resetItems(s, frameOf(s, cat), cat);
    normalize(s, null, cat);
    const counts = new Map();
    for (const it of s.items) {
      if (!isOpening(it, cat.CAT)) continue;
      const c = cat.CAT[it.cat];
      const key = `${c.n}${it.dbl ? " (double)" : ""} ${c.gable ? `in the ${it.wall === "B" ? "back" : "front"} gable` : `on ${WALL_WORDS[it.wall] || it.wall}`}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    const list = [...counts.entries()].map(([k, n]) => plural(n, k));
    const sig = JSON.stringify(list);
    const g = groups.find((x) => x.sig === sig);
    if (g) g.sizes.push(size); else groups.push({ sig, sizes: [size], doors_windows: list });
  }
  return groups.length > 1 ? groups.map(({ sizes: z, doors_windows }) => ({ sizes: z, doors_windows })) : [];
}

function porchFacts(plan) {
  const t = plan.t;
  if (t.porch === "F") return "A 4 ft deep porch across the front end, under the main roof, with posts and rails.";
  if (t.porch === "S") return `A 4 ft deep porch cut into the right long side at the ${plan.span.f ? "back" : "front"} end, ${num(plan.span.P)} ft long, with posts and rails.`;
  if (t.porch === "C") return `A porch that wraps round the front corner: 4 ft deep across the front end and ${num(plan.L / 2 - plan.ws.P3.at)} ft down the right long side, with an angled wall behind it.`;
  return null;
}

function bandWords(plan, k) {
  const y = gableBandY(k, plan, plan.state.items);
  if (y == null) return "none";
  return Math.abs(y - (plan.topY - 0.02)) < 1e-9 ? "at the top of the walls" : "at the loft line, 40% of the way up the gable";
}

/* Everything measured about one style (no pictures). */
export function styleFacts(cat, manufacturer, code) {
  const lib = manufacturer.styles[code];
  const state = typicalState(cat, code);
  const plan = makePlan(state, cat);
  const t = plan.t, CAT = cat.CAT;
  const sizes = pSizes(code, cat);
  const roof = roofFacts(plan);

  /* the same roof at every standard width? */
  const widths = [...new Set(sizes.map((z) => sizeOf(z).w))].sort((a, b) => a - b);
  const byWidth = widths.map((w) => {
    const s = JSON.parse(JSON.stringify(state));
    s.size = sizes.find((z) => sizeOf(z).w === w);
    const f = roofFacts(makePlan(s, cat));
    return { width_ft: w, pitches: f.slopes.map((x) => x.pitch), peak_over_wall_in: f.peak_over_wall.in };
  });
  const same = byWidth.every((b) => JSON.stringify(b.pitches) === JSON.stringify(byWidth[0].pitches));

  const wall = { height: height(t.wallH) };
  if (t.roof === "lean" || t.roof === "slope") {
    const side = t.roof === "lean" ? "L" : "R";
    wall.high_side = { wall: side, words: WALL_WORDS[side], ...height(plan.ws[side].top - y0) };
  }

  const openings = state.items.filter((it) => isOpening(it, CAT));
  const doors = openings.filter((it) => CAT[it.cat].k !== "win").sort((a, b) => CAT[b.cat].w - CAT[a.cat].w);
  let mainDoor = null;
  if (doors.length) {
    const it = doors[0], r = openingRect(it, plan);
    const wallTop = plan.ws[it.wall].top - y0, doorTop = r.yb - y0 + r.ch;
    const over = (wallTop - doorTop) * 12;
    mainDoor = { name: CAT[it.cat].n, wall: it.wall, top_from_floor: height(doorTop),
      wall_over_it_in: r1(over), words: over >= 0 ? `${num(r1(over))} in of wall above it` : `it rises ${num(r1(-over))} in into the gable` };
  }
  const tells = TELLS[code];
  const out = {
    code, name: lib.name, group: lib.category,
    drawn_at: state.size,
    roof: {
      type: t.roof, words: ROOF_WORDS[t.roof] || t.roof,
      slopes: roof.slopes, peak_over_wall: roof.peak_over_wall, peak_per_width: roof.peak_per_width,
      same_at_every_width: same, by_width: same ? [] : byWidth,
    },
    walls: wall,
    main_door: mainDoor,
    standard_doors_windows: openings.map((it) => { const w = itemWords(it, CAT); return { item: it.cat, name: w.name, wall: it.wall, words: `${w.name}, ${w.where}` }; }),
    changes_with_size: changesWithSize(cat, code, sizes),
    porch: porchFacts(plan),
    porch_posts: state.items.filter((it) => CAT[it.cat] && CAT[it.cat].k === "post").length,
    drawn_length_ft: plan.L !== sizeOf(state.size).l ? plan.L : null,
    dormer: t.dormer ? { width_ft: Number(state.dormer), choices_ft: (cat.DORMERS || []).filter((d) => d[0] !== "none").map((d) => Number(d[0])),
      words: `A ${num(Number(state.dormer))} ft dormer with windows on the roof over the right long side.` } : null,
    loft: t.loft ? `A ${num(t.loft.depthFt)} ft loft inside at ${t.loft.ends.length > 1 ? "each end" : "one end"}. It can't be seen from outside.` : null,
    siding: t.metal ? "ribbed metal" : "painted grooved panel",
    gable_vent: t.gableVent !== false,
    trim_band: { front: bandWords(plan, "F"), back: bandWords(plan, "B") },
    colors: { siding: plan.colors.names.body, trim: plan.colors.names.trim, roof: plan.colors.names.roof },
    tells: tells.tells.slice(),
    look_alikes: tells.look_alikes.map(([c, how]) => ({ code: c, name: (manufacturer.styles[c] || {}).name || null, how })),
    standard_sizes: sizes,
  };
  for (const a of out.look_alikes) if (!a.name) throw new Error(`TELLS for ${code} names ${a.code}, which is not a library style.`);
  return out;
}

/* --------------------------------------------------------------- the doc */

function pictureEntry(file, pictureBytes) {
  const bytes = pictureBytes(file);
  if (!bytes) throw new Error(`${REFS_DIR}/${file} is not there. Make the pictures: node tools/make-style-refs.mjs`);
  const size = jpegSize(bytes);
  if (!size) throw new Error(`${REFS_DIR}/${file} is not a JPEG picture. Make the pictures again: node tools/make-style-refs.mjs`);
  return { file, sha256: sha256(bytes), bytes: bytes.length, width: size.width, height: size.height };
}

export function styleRefsDoc({ standardBytes, constructionBytes, company, pictureBytes }) {
  const { cat, manufacturer } = drawingCatalogue({ standardBytes, constructionBytes, company });
  const lib = libraryVersion(standardBytes, constructionBytes);
  const codes = Object.keys(manufacturer.styles);
  const styles = codes.map((code) => {
    const f = styleFacts(cat, manufacturer, code);
    f.pictures = Object.fromEntries(Object.keys(VIEWS).map((v) => [v, pictureEntry(fileOf(code, v), pictureBytes)]));
    return f;
  });
  return {
    format: FORMAT,
    about: "Pictures and shape facts for every style in the 3D designer's library, for matching a dealer's photos to a style. " +
      "Made by node tools/make-style-refs.mjs and checked by node tools/check-style-refs.mjs in the 3D designer repository.",
    pitch_note: PITCH_NOTE,
    library_version: lib.version,
    library_files: lib.files,
    drawn_with: {
      price_list: `companies/${DRAW_COMPANY}`,
      look: cat.look && cat.look.trueColour ? "the Yoder Storage Barns site's light (true colour)" : "Barnwright's warm light",
      backdrop: BACKDROP, long_side_px: LONG_SIDE, jpeg_quality: JPEG_QUALITY,
      views: Object.fromEntries(Object.entries(VIEWS).map(([k, v]) => [k, { words: v.words, camera: { yaw: v.camera.yaw, pitch: v.camera.pitch }, file: `<code>${v.suffix}.jpg` }])),
    },
    floor_above_ground: height(y0),
    walls_legend: WALLS_LEGEND,
    sheet: { ...pictureEntry(SHEET_FILE, pictureBytes), columns: SHEET.columns, order: codes,
      words: `Every style's corner picture, ${SHEET.columns} across in the order of "order", each labelled with its code.` },
    styles,
  };
}

export const serializeDoc = (doc) => JSON.stringify(doc, null, 1) + "\n";
