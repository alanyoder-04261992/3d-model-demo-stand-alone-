/* CHECK: THE STYLE REFERENCE PICTURES AND FACTS ARE TRUE AND COMPLETE.
   Run: node tools/check-style-refs.mjs   (check-all: node -- no browser)

   WHY. Alan's Control Room shows Claude library/style-refs/ (from this
   repository's main branch on GitHub) when Claude matches a dealer's photos
   to a library style: a picture of each style from its front corner, one
   straight at its front end, and styles.json with each style's roof type and
   pitch, wall height, standard doors and windows, what tells it apart and its
   standard sizes. If the library changes and the files do not, Claude is told
   the wrong pitch. tools/make-style-refs.mjs makes them (it needs a browser);
   this check proves, without drawing anything:

   1. every library style (library/manufacturers/standard.json) has its two
      pictures and an entry, with what tells it apart written down;
   2. styles.json is exactly what the library says today: every fact is worked
      out again from standard.json, construction.json and the sample price
      list (companies/demo) with the designer's own model code, and every
      picture's sha256, size in bytes and width and height are read again from
      the file itself, and the whole text must match byte for byte;
   3. each picture is a JPEG 1024 px on its long side and under 100,000 bytes,
      one style's two pictures come to under 140,000 base64 characters (what
      the Control Room may send to Claude at once), the sheet fits too, and
      nothing else is in the folder; and every line of words is at most 400
      characters and the about and pitch notes at most 1,500, or the Control
      Room's strict reader refuses the whole file (control-room
      netlify/functions/_shared/style-refs.ts WORDS_MAX and NOTE_MAX). A
      401-character line is caught;
   4. the comparison CAN fail: one changed byte in a picture, a steeper gable
      in the library, a changed shop number, and a missing picture are each
      caught;
   4b. every length and pitch a person reads is said the way How it's built
      says it (feet and inches to the nearest 1/16 in, "5/12", "about
      6 1/2/12"): no decimal like "16.5 in" or "6.4 ft" and no "½" anywhere
      in the words, and each height's words say exactly its number; and each
      style's wall height, roof pitch and barn roof heights are the same
      numbers, in the same words, as the Dealer Center's How it's built
      shows for that style (model/build-settings.js effective). A barn's
      heights are tied each to its own width: "4 ft at 10 ft wide" never
      passes for "4 ft 3 in at 10 ft wide", the words name no width How it's
      built has no height for, and every number beside them (by_width and the
      peak at drawn_at) is How it's built's to the 1/16 in. A decimal put
      into the words, two widths' heights swapped and a height's number
      changed are each caught;
   5. no dealer's website carries the pictures: the website build
      (npm run build) and the client package (npm run build:client) leave
      library/style-refs/ out and keep the rest of the library, and the Netlify
      functions do not bundle them (netlify.toml included_files);
   6. the look harness can be moved to another port (LOOK_PORT), which is how
      the pictures are drawn beside a running look check.

   When styles.json is out of date it says which fact changed. Remake them:
   node tools/make-style-refs.mjs */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { ROOT } from "./lib/load.mjs";
import { lookPort, PORT as LOOK_DEFAULT_PORT } from "./lib/look-page.mjs";
import { effective, inchesWords, pitchWords } from "../model/build-settings.js";
import {
  REFS_DIR, STYLES_FILE, SHEET_FILE, STANDARD_PATH, CONSTRUCTION_PATH, DRAW_COMPANY, VIEWS, LONG_SIDE,
  MAX_PICTURE_BYTES, MAX_PAIR_BASE64, PICTURE_NAME, base64Length, fileOf, jpegSize,
  drawingCatalogue, styleRefsDoc, serializeDoc, TELLS,
} from "./lib/style-facts.mjs";

let passed = 0;
const failures = [];
function ok(what, cond, detail) {
  if (cond) { passed++; console.log("  ok   " + what); }
  else { failures.push(what + (detail ? ` (${detail})` : "")); console.log("  FAIL " + what + (detail ? `\n       ${detail}` : "")); }
}
function attempt(what, fn) {
  try { return fn(); } catch (e) { ok(what, false, e.message); return undefined; }
}
const DIR = resolve(ROOT, REFS_DIR);
const read = (rel) => readFileSync(resolve(ROOT, rel));
const inputs = () => ({
  standardBytes: read(STANDARD_PATH), constructionBytes: read(CONSTRUCTION_PATH),
  company: JSON.parse(read(`companies/${DRAW_COMPANY}/company.json`).toString("utf8")),
});
const fromDisk = (file) => (existsSync(resolve(DIR, file)) ? readFileSync(resolve(DIR, file)) : null);
const REMAKE = "Remake them: node tools/make-style-refs.mjs";

/* A length the way How it's built says it: "7 ft", "7 ft 9 1/2 in",
   "1 ft 0 5/16 in", "11 1/16 in", "3/4 in". */
const BUILDER_LENGTH = /^(\d+ ft( (\d+|0)( \d+\/(2|4|8|16))? in)?|(\d+ )?\d+\/(2|4|8|16) in|\d+ in)$/;
/* Keys whose strings no person reads as words: codes, file names, hashes,
   sizes and the exact pitch kept for measuring a photo (the Control Room's
   strict "N/12"). */
const MACHINE_KEYS = new Set(["pitch", "pitches", "sha256", "file", "library_version", "library_files", "code", "item", "wall", "type", "drawn_at", "sizes", "standard_sizes", "order", "backdrop", "price_list"]);
/* Every string a person reads in styles.json said with a decimal or a "½"
   (How it's built never writes either), and every height whose words are
   not exactly its number. -> ["path: words"] */
function readerWordsProblems(doc) {
  const out = [];
  (function walk(v, path, key) {
    if (MACHINE_KEYS.has(key)) return;
    if (typeof v === "string") {
      if (/\d\.\d|[½¼¾⅛]/.test(v)) out.push(`${path}: ${v}`);
      return;
    }
    if (Array.isArray(v)) { v.forEach((x, i) => walk(x, `${path}[${i}]`, key)); return; }
    if (v && typeof v === "object") {
      if (typeof v.in === "number" && typeof v.words === "string" && v.words !== inchesWords(v.in)) out.push(`${path}.words: ${v.words} for ${v.in} in`);
      for (const k of Object.keys(v)) walk(v[k], path ? `${path}.${k}` : k, k);
    }
  })(doc, "", "");
  return out;
}

/* A barn roof's heights, each tied to its own width, against How it's
   built's Barn roof height (row.value: inches by width). The roof words list
   "<height> at <width> ft wide" (or "<height> at 8 and 10 ft wide" when one
   height fits several), one item after "the top, " or after ", " or " and ",
   so "4 ft at" can never be read in "4 ft 3 in at". The words name no other
   width, by_width's numbers and the peak at drawn_at are How it's built's to
   the 1/16 in. -> ["what is off"] */
const escape = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const sixteenth = (inches) => Math.round(inches * 16) / 16;
function barnRoofProblems(s, row) {
  const v = row && row.value;
  if (!v || !Object.keys(v).length) return [`${s.code}: How it's built has no barn roof height`];
  const out = [], said = s.roof.words;
  for (const w of Object.keys(v)) {
    const h = inchesWords(v[w]);
    if (!new RegExp(`(, | and )${escape(h)} at (\\d+(, | and ))*${w}((, | and )\\d+)* ft wide`).test(said)) out.push(`${s.code} at ${w} ft wide: How it's built says ${h}, the words say "${said}"`);
  }
  const named = [...said.matchAll(/ at ((\d+(, | and ))*\d+) ft wide/g)].flatMap((m) => m[1].split(/, | and /).map((n) => String(Number(n))));
  for (const w of named) if (!(w in v)) out.push(`${s.code}: the words name ${w} ft wide, How it's built has no height for it`);
  for (const b of s.roof.by_width) {
    const want = v[String(b.width_ft)];
    if (want === undefined || sixteenth(want) !== b.peak_over_wall_in) out.push(`${s.code} by_width ${b.width_ft} ft: ${b.peak_over_wall_in} in, How it's built: ${want === undefined ? "none" : sixteenth(want) + " in"}`);
  }
  const at = String(Number(s.drawn_at.split("x")[0])), peak = s.roof.peak_over_wall;
  if (v[at] === undefined || sixteenth(v[at]) !== peak.in || inchesWords(v[at]) !== peak.words) out.push(`${s.code} drawn at ${s.drawn_at}: peak ${peak.in} in (${peak.words}), How it's built at ${at} ft wide: ${v[at] === undefined ? "none" : `${sixteenth(v[at])} in (${inchesWords(v[at])})`}`);
  return out;
}

/* What the Control Room's strict reader accepts (control-room
   netlify/functions/_shared/style-refs.ts): every line of words at most
   WORDS_MAX, the about and pitch notes at most NOTE_MAX. One line over and
   the room refuses the whole file. -> ["path: length"] */
const ROOM_WORDS_MAX = 400, ROOM_NOTE_MAX = 1500, ROOM_NOTES = new Set(["about", "pitch_note"]);
function roomLimitProblems(doc) {
  const out = [];
  (function walk(v, path) {
    if (typeof v === "string") {
      const max = ROOM_NOTES.has(path) ? ROOM_NOTE_MAX : ROOM_WORDS_MAX;
      if (v.length > max) out.push(`${path}: ${v.length} characters (${max} at most)`);
    } else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`));
    else if (v && typeof v === "object") for (const k of Object.keys(v)) walk(v[k], path ? `${path}.${k}` : k);
  })(doc, "");
  return out;
}

/* the first place two values differ, as a readable path (a style is named by its code) */
function firstDifference(a, b, path = "") {
  if (JSON.stringify(a) === JSON.stringify(b)) return null;
  if (a && b && typeof a === "object" && typeof b === "object" && Array.isArray(a) === Array.isArray(b)) {
    if (Array.isArray(a) && a.every((x) => x && x.code) && b.every((x) => x && x.code)) {
      for (const x of b) { const y = a.find((q) => q.code === x.code); if (!y) return { path: `${path}[${x.code}]`, was: "(no entry)", now: "(an entry)" }; const d = firstDifference(y, x, `${path}[${x.code}]`); if (d) return d; }
      for (const y of a) if (!b.find((q) => q.code === y.code)) return { path: `${path}[${y.code}]`, was: "(an entry)", now: "(not a library style any more)" };
    }
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      const d = firstDifference(a[k], b[k], Array.isArray(a) ? `${path}[${k}]` : path ? `${path}.${k}` : k);
      if (d) return d;
    }
  }
  return { path: path || "(the whole file)", was: JSON.stringify(a), now: JSON.stringify(b) };
}

console.log("The style reference pictures and facts (library/style-refs/):");

/* ---------------------------------------------------------- 1. every style */
const prepared = attempt("the sample price list sells every library style, on the library's own numbers, and each has what tells it apart", () => drawingCatalogue(inputs()));
const codes = prepared ? Object.keys(prepared.manufacturer.styles) : [];
if (prepared) {
  ok(`the sample price list sells every library style, on the library's own numbers, and each has what tells it apart (${codes.length} styles)`, true);
  ok("the hand-written list of what tells styles apart names only library styles", Object.keys(TELLS).every((c) => codes.includes(c)), Object.keys(TELLS).filter((c) => !codes.includes(c)).join(", "));
  const missing = codes.flatMap((c) => Object.keys(VIEWS).map((v) => fileOf(c, v))).filter((f) => !fromDisk(f));
  ok("every library style has both pictures", !missing.length, missing.length ? `missing: ${missing.join(", ")}. ${REMAKE}` : "");
}

/* ------------------------------------------------- 2. the facts, recomputed */
const storedText = fromDisk(STYLES_FILE);
let fresh = null;
if (!storedText) ok(`${REFS_DIR}/${STYLES_FILE} is there`, false, REMAKE);
else if (prepared) {
  fresh = attempt("the facts can be worked out again from the library", () => styleRefsDoc({ ...inputs(), pictureBytes: fromDisk }));
  if (fresh) {
    const same = serializeDoc(fresh) === storedText.toString("utf8");
    let detail = "";
    if (!same) {
      let stored = null;
      try { stored = JSON.parse(storedText.toString("utf8")); } catch { detail = `${STYLES_FILE} is not valid JSON. ${REMAKE}`; }
      if (stored) {
        const d = firstDifference(stored, fresh);
        detail = d ? `${d.path} is ${d.was} in ${STYLES_FILE} but ${d.now} now. ${REMAKE}` : `the text differs (spacing or order). ${REMAKE}`;
      }
    }
    ok(`${STYLES_FILE} is exactly what the library says today: every pitch, wall height, door, window and size worked out again, and every picture's sha256 read again (library version ${fresh.library_version})`, same, detail);
    ok("every style's pitch is given as N/12 for each slope, with its wall height in feet and inches",
      fresh.styles.every((s) => s.roof.slopes.length && s.roof.slopes.every((x) => /^\d+(\.\d+)?\/12$/.test(x.pitch)) && BUILDER_LENGTH.test(s.walls.height.words)));
    /* the note says whose numbers they are: every style with Alan's shop
       numbers (styles.<KEY>.built in the standard line) by name, and
       Barnwright's drawing for the rest */
    const shop = Object.entries(prepared.manufacturer.styles).filter(([, st]) => st.built && Object.keys(st.built).some((k) => !k.startsWith("_"))).map(([, st]) => st.name);
    const unnamed = shop.filter((name) => !new RegExp(`(^|[ ,(])${name}([ ,);']|$)`).test(fresh.pitch_note));
    ok(`the note names every style built to Alan's shop numbers (${shop.length}) and says the rest use Barnwright's drawing`,
      shop.length > 0 && !unnamed.length && /Alan's/.test(fresh.pitch_note) && /other styles use Barnwright's drawing/.test(fresh.pitch_note), unnamed.length ? `not named: ${unnamed.join(", ")}` : fresh.pitch_note);
    const ut = fresh.styles.find((s) => s.code === "UT"), lb = fresh.styles.find((s) => s.code === "LB"), cs = fresh.styles.find((s) => s.code === "CS");
    if (ut && lb && cs) {
      ok("spot check: the Utility Shed is a 5/12 gable on 7 ft 9 1/2 in walls (Alan's); the Lofted Barn's trusses are 3 ft 7 3/4 in, 4 ft and 4 ft 3 in tall at 8, 10 and 12 ft wide on 6 ft 7 1/2 in walls (Alan's), the 14 ft keeping its own (6 ft 3 1/8 in); the Cottage Shed 4.59/12 and 9.75/12 (Barnwright's)",
        ut.roof.slopes.map((x) => x.pitch).join() === "5/12" && ut.walls.height.words === "7 ft 9 1/2 in" && ut.roof.words === "gable: an A roof at 5/12, both sides the same" &&
        lb.walls.height.words === "6 ft 7 1/2 in" && lb.roof.same_at_every_width === false &&
        JSON.stringify(lb.roof.by_width.map((b) => [b.width_ft, b.peak_over_wall_in])) === JSON.stringify([[8, 43.75], [10, 48], [12, 51], [14, 75.125]]) &&
        lb.roof.words === "gambrel: a barn roof, steep at the bottom and flatter at the top, 3 ft 7 3/4 in at 8 ft wide, 4 ft at 10 ft wide, 4 ft 3 in at 12 ft wide and 6 ft 3 1/8 in at 14 ft wide from the top of the wall to the peak of its trusses" &&
        cs.roof.slopes.map((x) => x.pitch).join() === "4.59/12,9.75/12",
        JSON.stringify([ut.roof.slopes, ut.walls.height.words, lb.walls.height.words, lb.roof.by_width, cs.roof.slopes]));
    }
  }
}

/* ------------------------- 4b. builder's words, How it's built's numbers */
if (fresh && prepared) {
  const problems = readerWordsProblems(fresh);
  ok("every length and pitch a person reads is said the way How it's built says it: feet and inches to the nearest 1/16 in, no decimal (\"16.5 in\", \"6.4 ft\", \"14.58/12\") and no \"½\" in any words, and each height's words say exactly its number",
    !problems.length, problems.slice(0, 6).join("; "));
  const off = [];
  for (const s of fresh.styles) {
    const rows = Object.fromEntries(effective(prepared.cat, s.code).map((r) => [r.id, r]));
    if (!rows.wallHeight || s.walls.height.words !== rows.wallHeight.words) off.push(`${s.code} walls: ${s.walls.height.words}, How it's built: ${rows.wallHeight ? rows.wallHeight.words : "none"}`);
    if (rows.roofPitch) {
      const drawn = s.roof.slopes.map((x) => pitchWords(Number(x.pitch.split("/")[0])));
      if (!s.roof.words.includes(`at ${rows.roofPitch.words}`) || drawn.some((w) => w !== rows.roofPitch.words)) off.push(`${s.code} roof: "${s.roof.words}" (drawn ${drawn.join(", ")}), How it's built: ${rows.roofPitch.words}`);
    } else if (s.roof.type === "gambrel") {
      off.push(...barnRoofProblems(s, rows.barnPeak));
    } else {
      const said = s.roof.slopes.map((x) => pitchWords(Number(x.pitch.split("/")[0])));
      if (said.some((w) => !s.roof.words.includes(w))) off.push(`${s.code} roof: "${s.roof.words}" does not say ${said.join(" and ")}`);
    }
  }
  ok(`one number for one wall: every style's wall height, roof pitch and barn roof heights are the numbers and words How it's built shows for it, each barn height tied to its own width and its numbers How it's built's to the 1/16 in (the Cabin's walls 7 ft 4 13/16 in, its roof about 6 1/2/12; the Lofted Barn 4 ft at 10 ft wide and 4 ft 3 in at 12)`,
    !off.length, off.slice(0, 6).join("; "));
  /* the barn check CAN fail: the Lofted Barn's 10 and 12 ft heights swapped
     in the words ("4 ft 3 in at 10 ft wide and 4 ft at 12": "4 ft" is the
     start of "4 ft 3 in"), a by_width number that is the next width's, and
     the peak at drawn_at 1/16 in off */
  const lbRow = (() => { const r = effective(prepared.cat, "LB").find((x) => x.id === "barnPeak"); return r; })();
  const lbFresh = fresh.styles.find((s) => s.code === "LB");
  if (lbRow && lbFresh) {
    const h10 = inchesWords(lbRow.value["10"]), h12 = inchesWords(lbRow.value["12"]);
    const swapped = structuredClone(lbFresh);
    swapped.roof.words = swapped.roof.words.replace(`${h10} at 10 ft wide`, "\u0000").replace(`${h12} at 12 ft wide`, `${h10} at 12 ft wide`).replace("\u0000", `${h12} at 10 ft wide`);
    const numbers = structuredClone(lbFresh);
    numbers.roof.by_width.find((b) => b.width_ft === 10).peak_over_wall_in = numbers.roof.by_width.find((b) => b.width_ft === 12).peak_over_wall_in;
    const drawn = structuredClone(lbFresh);
    drawn.roof.peak_over_wall.in += 1 / 16;
    const sw = barnRoofProblems(swapped, lbRow), nu = barnRoofProblems(numbers, lbRow), dr = barnRoofProblems(drawn, lbRow);
    ok(`two widths' barn heights swapped are caught: "${h12} at 10 ft wide, ${h10} at 12 ft wide" on the Lofted Barn names both widths; so is a by_width number that is the 12 ft's at 10 ft, and a peak 1/16 in off at ${lbFresh.drawn_at}`,
      swapped.roof.words !== lbFresh.roof.words && !barnRoofProblems(lbFresh, lbRow).length
        && sw.some((x) => /at 10 ft wide/.test(x)) && sw.some((x) => /at 12 ft wide/.test(x))
        && nu.some((x) => /by_width 10 ft/.test(x)) && dr.some((x) => /drawn at/.test(x)),
      JSON.stringify({ words: swapped.roof.words, swapped: sw, numbers: nu, drawn: dr }));
  } else ok("the Lofted Barn has its barn roof heights in How it's built", false);
  /* the words check CAN fail */
  const bad = structuredClone(fresh);
  const dk = bad.styles.find((s) => s.main_door);
  dk.main_door.words = "16.5 in of wall above it";
  bad.styles[0].standard_doors_windows.push({ item: "w23", name: "2×3 Window", wall: "R", words: "2×3 Window, on the right long side, 6.4 ft left of its middle" });
  bad.styles[0].walls.height.words = "7 ft 9½ in";
  const caught = readerWordsProblems(bad);
  ok("a decimal or a \"½\" in the words is caught: \"16.5 in of wall above it\", \"6.4 ft left of its middle\" and \"7 ft 9½ in\" each named",
    caught.length >= 3 && ["16.5 in", "6.4 ft", "9½"].every((w) => caught.some((c) => c.includes(w))), caught.join("; "));
}

/* ------------------------------- 3. what the Control Room's reader accepts */
if (fresh) {
  const long = roomLimitProblems(fresh);
  const longest = (() => { let m = { at: "", n: 0 }; (function walk(v, p) { if (typeof v === "string") { if (!ROOM_NOTES.has(p) && v.length > m.n) m = { at: p, n: v.length }; } else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${p}[${i}]`)); else if (v && typeof v === "object") for (const k of Object.keys(v)) walk(v[k], p ? `${p}.${k}` : k); })(fresh, ""); return m; })();
  ok(`every line of words is at most ${ROOM_WORDS_MAX} characters (the longest, ${longest.at}, is ${longest.n}) and the about and pitch notes at most ${ROOM_NOTE_MAX.toLocaleString("en-US")} (${fresh.about.length} and ${fresh.pitch_note.length}): the Control Room refuses the whole file otherwise`,
    !long.length, long.slice(0, 6).join("; "));
  const over = structuredClone(fresh), edge = structuredClone(fresh);
  over.styles[0].roof.words = "x".repeat(ROOM_WORDS_MAX + 1);
  over.pitch_note = "x".repeat(ROOM_NOTE_MAX + 1);
  edge.styles[0].roof.words = "x".repeat(ROOM_WORDS_MAX);
  edge.pitch_note = "x".repeat(ROOM_NOTE_MAX);
  const caught = roomLimitProblems(over);
  ok(`a ${ROOM_WORDS_MAX + 1}-character roof.words and a ${ROOM_NOTE_MAX + 1}-character pitch note are each caught; ${ROOM_WORDS_MAX} and ${ROOM_NOTE_MAX} pass`,
    caught.some((x) => x.startsWith("styles[0].roof.words")) && caught.some((x) => x.startsWith("pitch_note"))
      && !roomLimitProblems(edge).some((x) => x.startsWith("styles[0].roof.words") || x.startsWith("pitch_note")), caught.join("; "));
}

/* -------------------------------------------- 3. sizes, and nothing extra */
if (prepared) {
  const big = [], notJpeg = [], wrongSide = [], pairs = [];
  for (const code of codes) {
    let pair = 0;
    for (const v of Object.keys(VIEWS)) {
      const f = fileOf(code, v), b = fromDisk(f);
      if (!b) continue;
      const s = jpegSize(b);
      if (!s) notJpeg.push(f);
      else if (Math.max(s.width, s.height) !== LONG_SIDE) wrongSide.push(`${f} ${s.width}x${s.height}`);
      if (b.length > MAX_PICTURE_BYTES) big.push(`${f} ${b.length}`);
      pair += base64Length(b.length);
    }
    if (pair > MAX_PAIR_BASE64) pairs.push(`${code} ${pair}`);
  }
  const sheet = fromDisk(SHEET_FILE);
  ok(`every picture is a JPEG ${LONG_SIDE} px on its long side`, !notJpeg.length && !wrongSide.length, [...notJpeg.map((f) => f + " is not a JPEG"), ...wrongSide].join("; "));
  ok(`every picture is under ${MAX_PICTURE_BYTES} bytes, and each style's two come to under ${MAX_PAIR_BASE64} base64 characters`, !big.length && !pairs.length, [...big, ...pairs].join("; "));
  ok(`${SHEET_FILE}, every style on one page, is there, a JPEG ${LONG_SIDE} px wide and under ${MAX_PICTURE_BYTES} bytes`,
    !!sheet && !!jpegSize(sheet) && jpegSize(sheet).width === LONG_SIDE && sheet.length <= MAX_PICTURE_BYTES, sheet ? `${sheet.length} bytes` : "missing");
  const expected = new Set([STYLES_FILE, SHEET_FILE, ...codes.flatMap((c) => Object.keys(VIEWS).map((v) => fileOf(c, v)))]);
  const extra = existsSync(DIR) ? readdirSync(DIR).filter((f) => !expected.has(f)) : [];
  ok("nothing else is in the folder (no picture of a style the library no longer has)", !extra.length, extra.join(", "));
  ok("every file name is one the Control Room accepts", [...expected].every((f) => f === STYLES_FILE || f === SHEET_FILE || PICTURE_NAME.test(f)));
  ok(`${STYLES_FILE} is small enough to fetch (under 256,000 bytes)`, !storedText || storedText.length < 256_000, storedText ? `${storedText.length} bytes` : "");
}

/* --------------------------------------------- 4. the comparison CAN fail */
if (fresh && storedText) {
  const stored = storedText.toString("utf8");
  const tampered = (file) => { const b = fromDisk(file); if (!b || file !== "UT.jpg") return b; const c = Buffer.from(b); c[c.length - 3] ^= 0x01; return c; };
  const t1 = attempt("a changed picture is caught", () => serializeDoc(styleRefsDoc({ ...inputs(), pictureBytes: tampered })));
  if (t1 !== undefined) ok("a changed picture is caught: one byte of UT.jpg different gives a different sha256 than styles.json has", t1 !== stored && /"file": "UT.jpg"/.test(t1));
  const lib = JSON.parse(read(CONSTRUCTION_PATH).toString("utf8"));
  lib.roof.shapes.gable.rise = { w: 0.25 };
  let t2 = null;
  try { t2 = styleRefsDoc({ ...inputs(), constructionBytes: Buffer.from(JSON.stringify(lib, null, 1)), pictureBytes: fromDisk }); } catch (e) { t2 = { error: e.message }; }
  const mu2 = t2 && t2.styles && t2.styles.find((s) => s.code === "MU");
  ok("a steeper or flatter library gable is caught: with the gable rise at 0.25 of the width the Metal Utility's pitch (Barnwright's) is worked out as 6/12 and the library version changes",
    !!mu2 && mu2.roof.slopes[0].pitch === "6/12" && t2.library_version !== fresh.library_version, JSON.stringify(mu2 ? mu2.roof.slopes : t2));
  const std = JSON.parse(read(STANDARD_PATH).toString("utf8"));
  std.styles.UT.built = { ...std.styles.UT.built, roofPitch: 6 };
  let t4 = null;
  try { t4 = styleRefsDoc({ ...inputs(), standardBytes: Buffer.from(JSON.stringify(std, null, 1)), pictureBytes: fromDisk }); } catch (e) { t4 = { error: e.message }; }
  const ut4 = t4 && t4.styles && t4.styles.find((s) => s.code === "UT");
  ok("a changed shop number is caught: with the Utility Shed's shop pitch at 6/12 it is worked out as 6/12 and the library version changes",
    !!ut4 && ut4.roof.slopes[0].pitch === "6/12" && t4.library_version !== fresh.library_version, JSON.stringify(ut4 ? ut4.roof.slopes : t4));
  let t3 = null;
  try { styleRefsDoc({ ...inputs(), pictureBytes: (f) => (f === "LB-end.jpg" ? null : fromDisk(f)) }); } catch (e) { t3 = e.message; }
  ok("a missing picture is caught, in plain words", !!t3 && /LB-end\.jpg is not there/.test(t3) && /make-style-refs/.test(t3), t3 || "nothing was said");
}

/* ----------------------------------------------- 5. no dealer site carries them */
const siteEnv = () => {
  const env = { ...process.env };
  for (const name of ["SITE_ID", "INCLUDE_LEARNING_PREVIEW", "DEALER_DEMO"]) delete env[name];
  return env;
};
for (const [what, flags, out] of [["the website build (npm run build)", [], "dist"], ["the client package (npm run build:client)", ["--client"], "dist-client"]]) {
  const r = spawnSync(process.execPath, ["tools/build-site.mjs", ...flags], { cwd: ROOT, encoding: "utf8", timeout: 180000, env: siteEnv() });
  if (r.status !== 0) { ok(`${what} runs`, false, (r.stdout + r.stderr).trim().split("\n").slice(-5).join(" | ")); continue; }
  const has = (p) => existsSync(resolve(ROOT, out, p));
  ok(`${what} leaves the style pictures out and keeps the library the designer reads`,
    !has(REFS_DIR) && has(STANDARD_PATH) && has(CONSTRUCTION_PATH),
    `${REFS_DIR}: ${has(REFS_DIR) ? "shipped" : "left out"}; ${STANDARD_PATH}: ${has(STANDARD_PATH) ? "shipped" : "missing"}; ${CONSTRUCTION_PATH}: ${has(CONSTRUCTION_PATH) ? "shipped" : "missing"}`);
}
const toml = read("netlify.toml").toString("utf8");
const line = toml.split("\n").find((l) => /^\s*included_files\s*=/.test(l));
const globs = line ? [...line.matchAll(/"([^"]+)"/g)].map((m) => m[1]) : [];
const globRe = (g) => new RegExp("^" + g.split("**").map((part) => part.split("*").map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join("[^/]*")).join(".*") + "$");
const bundled = (p) => globs.some((g) => !g.startsWith("!") && globRe(g).test(p)) && !globs.some((g) => g.startsWith("!") && globRe(g.slice(1)).test(p));
ok("the Netlify functions bundle the library they read but not the style pictures (netlify.toml included_files)",
  globs.length > 0 && bundled(STANDARD_PATH) && bundled(CONSTRUCTION_PATH) && !bundled(`${REFS_DIR}/UT.jpg`) && !bundled(`${REFS_DIR}/${STYLES_FILE}`) && !bundled(`${REFS_DIR}/${SHEET_FILE}`),
  `included_files = ${JSON.stringify(globs)}`);

/* ------------------------------------------------- 6. the harness's port */
ok(`the look harness opens on LOOK_PORT when it is set to a usable port, else on ${LOOK_DEFAULT_PORT}`,
  lookPort({ LOOK_PORT: "9501" }) === 9501 && lookPort({}) === LOOK_DEFAULT_PORT && lookPort({ LOOK_PORT: "80" }) === LOOK_DEFAULT_PORT && lookPort({ LOOK_PORT: "abc" }) === LOOK_DEFAULT_PORT);

if (failures.length) {
  console.log(`\nFAIL: ${failures.length} of ${passed + failures.length} style reference checks failed:\n - ` + failures.join("\n - "));
  process.exitCode = 1;
} else {
  console.log(`\nPROVED (${passed} checks): every one of the ${codes.length} library styles has its corner and end pictures and an entry in ${REFS_DIR}/${STYLES_FILE} ` +
    `that matches the library today (pitches as N/12 for each slope, wall heights, standard doors and windows, sizes; library version ${fresh ? fresh.library_version : "?"}), ` +
    `every length and pitch in the words is said the way How it's built says it, with How it's built's own numbers and each barn height at its own width, ` +
    `every line fits what the Control Room's reader accepts, `+
    `every picture's sha256 matches, the sizes fit what the Control Room sends, a changed picture or pitch is caught, and no dealer's website or function carries the pictures.`);
}
