/* MAKE THE STYLE REFERENCE PICTURES AND FACTS (library/style-refs/).
   Run: node tools/make-style-refs.mjs [--port 8362] [--only UT,LB]

   WHY. Alan's Control Room shows Claude what each library style looks like
   when Claude helps set up a dealer's price list from their photos
   (get_style_reference). It reads these files from this repository's main
   branch on GitHub, the way it reads the papers and the terms.

   WHAT IT WRITES, in library/style-refs/:
     <code>.jpg       every library style from its front corner, the view the
                      3D designer opens on: 1024 px wide, JPEG, about 50 KB
     <code>-end.jpg   the same building straight at its front end, so the
                      roof's shape and pitch can be measured
     sheet.jpg        every corner picture on one page, labelled with its code
     styles.json      the facts about every style (roof type and pitch for each
                      slope, wall height, standard doors and windows, what tells
                      it apart in a photo, its standard sizes), each picture's
                      sha256, and the library's version
                      (tools/lib/style-facts.mjs works them out)

   HOW. Each style is drawn at the size the designer lands on when it is
   picked, with its standard doors and windows, in the sample price list's
   opening colours (companies/demo: white siding, black trim, black roof), by
   the designer's own engine on the look check's harness page (tools/look.html
   through tools/lib/look-page.mjs): headless Chromium with software graphics.
   The page shrinks each picture to 1024 px on the studio backdrop and saves it
   as a JPEG itself, so nothing new is installed.

   --port N      serve the harness page on port N (default 8362; the look check
                 uses 8360 and 8361)
   --only A,B    draw just these styles again and keep the others' pictures;
                 the sheet and styles.json are always made again

   Remake them when a library style is added or changed, when the
   construction numbers change, or when the look changes (the check-the-look
   skill). node tools/check-style-refs.mjs says when they are out of date. */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { openLook, ROOT } from "./lib/look-page.mjs";
import {
  REFS_DIR, STYLES_FILE, SHEET_FILE, STANDARD_PATH, CONSTRUCTION_PATH, DRAW_COMPANY,
  BACKDROP, LONG_SIDE, JPEG_QUALITY, VIEWS, SHEET, MAX_PICTURE_BYTES, MAX_PAIR_BASE64, PICTURE_NAME,
  base64Length, fileOf, drawingCatalogue, typicalState, styleRefsDoc, serializeDoc,
} from "./lib/style-facts.mjs";

const args = process.argv.slice(2);
function value(name) {
  const i = args.indexOf(name);
  if (i >= 0) return args[i + 1];
  const eq = args.find((a) => a.startsWith(name + "="));
  return eq ? eq.slice(name.length + 1) : null;
}
const PORT_DEFAULT = 8362;
const port = value("--port") == null ? PORT_DEFAULT : Number(value("--port"));
if (!Number.isInteger(port) || port < 1024 || port > 65535) { console.log(`FAIL: --port must be a whole number from 1024 to 65535 (got ${value("--port")}).`); process.exit(1); }

const OUT = resolve(ROOT, REFS_DIR);
const read = (rel) => readFileSync(resolve(ROOT, rel));
const inputs = () => ({
  standardBytes: read(STANDARD_PATH), constructionBytes: read(CONSTRUCTION_PATH),
  company: JSON.parse(read(`companies/${DRAW_COMPANY}/company.json`).toString("utf8")),
});
const { cat, manufacturer } = drawingCatalogue(inputs());
const codes = Object.keys(manufacturer.styles);
const only = value("--only") ? value("--only").split(",").map((s) => s.trim().toUpperCase()).filter(Boolean) : null;
if (only) {
  const unknown = only.filter((c) => !codes.includes(c));
  if (unknown.length) { console.log(`FAIL: ${unknown.join(", ")} ${unknown.length > 1 ? "are not library styles" : "is not a library style"}. The library styles are: ${codes.join(", ")}.`); process.exit(1); }
}
const todo = only || codes;

/* ---- in the page: draw one building and save it as a 1024 px JPEG on the backdrop ---- */
async function inPageShot({ opts, longSide, quality, backdrop }) {
  const info = window.look.draw(opts);
  const img = new Image();
  img.src = info.png;
  await img.decode();
  const scale = longSide / Math.max(img.width, img.height);
  const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d");
  g.fillStyle = backdrop; g.fillRect(0, 0, w, h);
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high";
  g.drawImage(img, 0, 0, w, h);
  /* how much of the picture is not plain backdrop (a blank draw is caught) */
  const px = g.getImageData(0, 0, w, h).data;
  const br = parseInt(backdrop.slice(1, 3), 16), bg = parseInt(backdrop.slice(3, 5), 16), bb = parseInt(backdrop.slice(5, 7), 16);
  let n = 0;
  for (let i = 0; i < px.length; i += 4) if (Math.abs(px[i] - br) + Math.abs(px[i + 1] - bg) + Math.abs(px[i + 2] - bb) > 24) n++;
  return { jpeg: c.toDataURL("image/jpeg", quality), width: w, height: h, cover: n / (w * h), drew: info.drew, glErrors: info.glErrors, drawn: { w: img.width, h: img.height } };
}

/* ---- in the page: every corner picture on one sheet, labelled, under maxBytes ---- */
async function inPageSheet({ tiles, columns, width, quality, maxBytes, backdrop }) {
  const imgs = [];
  for (const t of tiles) { const i = new Image(); i.src = t.src; await i.decode(); imgs.push(i); }
  const tw = Math.floor(width / columns), th = Math.round(tw * imgs[0].height / imgs[0].width);
  const rows = Math.ceil(tiles.length / columns);
  const c = document.createElement("canvas");
  c.width = tw * columns; c.height = th * rows;
  const g = c.getContext("2d");
  g.fillStyle = backdrop; g.fillRect(0, 0, c.width, c.height);
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high";
  tiles.forEach((t, k) => {
    const x = (k % columns) * tw, y = Math.floor(k / columns) * th;
    g.drawImage(imgs[k], x, y, tw, th);
    g.font = "bold 30px sans-serif";
    const m = g.measureText(t.code);
    g.fillStyle = "rgba(255,255,255,0.85)"; g.fillRect(x + 6, y + 6, m.width + 16, 40);
    g.fillStyle = "#111"; g.fillText(t.code, x + 14, y + 37);
    g.strokeStyle = "#c8c8c2"; g.lineWidth = 1; g.strokeRect(x + 0.5, y + 0.5, tw - 1, th - 1);
  });
  for (let q = Math.round(quality * 100); q >= 40; q -= 5) {
    const url = c.toDataURL("image/jpeg", q / 100);
    if (Math.floor((url.length - url.indexOf(",") - 1) * 3 / 4) <= maxBytes) return { jpeg: url, quality: q / 100, width: c.width, height: c.height };
  }
  return { jpeg: null };
}

const fromDataUrl = (url) => Buffer.from(String(url).replace(/^data:image\/jpeg;base64,/, ""), "base64");
const problems = [];
const t0 = Date.now();
mkdirSync(OUT, { recursive: true });
const h = await openLook({ port });
try {
  await h.useCompany(DRAW_COMPANY);
  for (const code of todo) {
    const state = typicalState(cat, code);
    const sizes = {};
    for (const [view, v] of Object.entries(VIEWS)) {
      const r = await h.page.evaluate(inPageShot, {
        opts: { company: DRAW_COMPANY, state, size: { w: v.css.w, h: v.css.h }, fit: "fitref", scene: "studio",
          trueColour: !!(cat.look && cat.look.trueColour), camera: { ...v.camera }, stages: "finished" },
        longSide: LONG_SIDE, quality: JPEG_QUALITY, backdrop: BACKDROP,
      });
      const bytes = fromDataUrl(r.jpeg);
      const file = fileOf(code, view);
      if (r.glErrors.first.length) problems.push(`${file}: the graphics card reported errors while drawing it (${r.glErrors.first.join(", ")}).`);
      if (!(r.cover > 0.03)) problems.push(`${file}: the picture is almost empty (${(r.cover * 100).toFixed(1)}% building).`);
      if (bytes.length > MAX_PICTURE_BYTES) problems.push(`${file} is ${bytes.length} bytes; a picture must stay under ${MAX_PICTURE_BYTES}.`);
      writeFileSync(resolve(OUT, file), bytes);
      sizes[view] = bytes.length;
      console.log(`${code.padEnd(4)} ${manufacturer.styles[code].name.padEnd(24)} ${state.size.padEnd(6)} ${view.padEnd(13)} ${r.drawn.w}x${r.drawn.h} -> ${r.width}x${r.height}  ${(bytes.length / 1024).toFixed(1)} KB  ${(r.cover * 100).toFixed(0)}% building`);
    }
    const pair = Object.values(sizes).reduce((a, b) => a + base64Length(b), 0);
    if (pair > MAX_PAIR_BASE64) problems.push(`${code}: its two pictures come to ${pair} base64 characters; together they must stay under ${MAX_PAIR_BASE64}.`);
  }
  /* the sheet, from the corner pictures now on disk */
  const tiles = codes.map((code) => {
    const f = resolve(OUT, fileOf(code, "three_quarter"));
    if (!existsSync(f)) throw new Error(`${REFS_DIR}/${fileOf(code, "three_quarter")} is not there yet: run without --only once.`);
    return { code, src: "data:image/jpeg;base64," + readFileSync(f).toString("base64") };
  });
  const sheet = await h.page.evaluate(inPageSheet, { tiles, columns: SHEET.columns, width: SHEET.width, quality: JPEG_QUALITY, maxBytes: MAX_PICTURE_BYTES, backdrop: BACKDROP });
  if (!sheet.jpeg) problems.push(`${SHEET_FILE} would not fit under ${MAX_PICTURE_BYTES} bytes even at a low quality.`);
  else {
    const bytes = fromDataUrl(sheet.jpeg);
    writeFileSync(resolve(OUT, SHEET_FILE), bytes);
    console.log(`sheet ${SHEET.columns} across        ${sheet.width}x${sheet.height}  ${(bytes.length / 1024).toFixed(1)} KB  (quality ${sheet.quality})`);
  }
  if (h.errors.length) problems.push(...h.errors.map((e) => "the page: " + e));
} finally {
  await h.close();
}

/* pictures of styles no longer in the library go */
const keep = new Set([STYLES_FILE, SHEET_FILE, ...codes.flatMap((c) => Object.keys(VIEWS).map((v) => fileOf(c, v)))]);
for (const f of readdirSync(OUT)) {
  if (keep.has(f)) continue;
  if (PICTURE_NAME.test(f)) { rmSync(resolve(OUT, f)); console.log(`removed ${REFS_DIR}/${f}: not a library style any more`); }
  else problems.push(`${REFS_DIR}/${f} is not one of the style pictures. Move it somewhere else.`);
}

if (problems.length) {
  console.log(`\nFAIL: ${problems.length} problem(s); styles.json was not written:\n - ` + problems.join("\n - "));
  process.exit(1);
}
const doc = styleRefsDoc({ ...inputs(), pictureBytes: (file) => (existsSync(resolve(OUT, file)) ? readFileSync(resolve(OUT, file)) : null) });
writeFileSync(resolve(OUT, STYLES_FILE), serializeDoc(doc));
const total = readdirSync(OUT).reduce((a, f) => a + readFileSync(resolve(OUT, f)).length, 0);
console.log(`\nPROVED: drew ${todo.length} of ${codes.length} library styles (2 pictures each) and the sheet, and wrote ${REFS_DIR}/${STYLES_FILE} ` +
  `(library version ${doc.library_version}); ${readdirSync(OUT).length} files, ${(total / 1024).toFixed(0)} KB in all. ${((Date.now() - t0) / 1000).toFixed(0)} s. ` +
  `Check them: node tools/check-style-refs.mjs`);
