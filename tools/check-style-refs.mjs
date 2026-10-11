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
      nothing else is in the folder;
   4. the comparison CAN fail: one changed byte in a picture, a steeper gable
      in the library, and a missing picture are each caught;
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
      fresh.styles.every((s) => s.roof.slopes.length && s.roof.slopes.every((x) => /^\d+(\.\d+)?\/12$/.test(x.pitch)) && /^\d+ ft( \d*½? in)?$/.test(s.walls.height.words)));
    ok("the pitches are said to be the library's (Barnwright's) numbers, not a shop's", /library's own number/.test(fresh.pitch_note) && /Barnwright/.test(fresh.pitch_note));
    const ut = fresh.styles.find((s) => s.code === "UT"), lb = fresh.styles.find((s) => s.code === "LB"), cs = fresh.styles.find((s) => s.code === "CS");
    if (ut && lb && cs) {
      ok("spot check: the Utility Shed is a 6.48/12 gable on 7 ft 9 in walls; the Lofted Barn 32/12 and 4.11/12; the Cottage Shed 4.59/12 and 9.75/12",
        ut.roof.slopes.map((x) => x.pitch).join() === "6.48/12" && ut.walls.height.words === "7 ft 9 in" &&
        lb.roof.slopes.map((x) => x.pitch).join() === "32/12,4.11/12" && cs.roof.slopes.map((x) => x.pitch).join() === "4.59/12,9.75/12",
        JSON.stringify([ut.roof.slopes, lb.roof.slopes, cs.roof.slopes]));
    }
  }
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
  const ut2 = t2 && t2.styles && t2.styles.find((s) => s.code === "UT");
  ok("a steeper or flatter library gable is caught: with the gable rise at 0.25 of the width the Utility Shed's pitch is worked out as 6/12 and the library version changes",
    !!ut2 && ut2.roof.slopes[0].pitch === "6/12" && t2.library_version !== fresh.library_version, JSON.stringify(ut2 ? ut2.roof.slopes : t2));
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
    `every picture's sha256 matches, the sizes fit what the Control Room sends, a changed picture or pitch is caught, and no dealer's website or function carries the pictures.`);
}
