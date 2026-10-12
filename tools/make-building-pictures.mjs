/* MAKE THE DEALER CENTER'S PUBLIC STANDARD PICTURES.
   Run: node tools/make-building-pictures.mjs
   Uses the shop standard and demo opening colors, at 400×300 and 2x pixels.
   The same separate browser renderer draws an owner's price list pictures.
   The internal library/style-refs pictures and facts are never copied out. */
import { writeFileSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { ROOT, PUBLIC_PICTURES, RECIPE, standardPicturesCatalogue, publicPictureFacts, openPictureHarness } from "./lib/building-pictures.mjs";

const { cat, manufacturer } = standardPicturesCatalogue();
const codes = Object.keys(manufacturer.styles);
const out = resolve(ROOT, PUBLIC_PICTURES);
mkdirSync(out, { recursive: true });
const pictures = new Map();
const harness = await openPictureHarness();
try {
  const errors = [];
  harness.page.on("pageerror", (error) => errors.push(error.message));
  await harness.page.evaluate(async () => { window.pictureRenderer = (await import("/__picture-engine.js")).startPictures(); });
  for (const style of codes) {
    const encoded = await harness.page.evaluate(async ({ cat, style, recipe }) => {
      const blob = await window.pictureRenderer.draw(cat, style, recipe);
      return new Promise((done, fail) => { const reader = new FileReader(); reader.onload = () => done(reader.result.split(",")[1]); reader.onerror = fail; reader.readAsDataURL(blob); });
    }, { cat, style, recipe: RECIPE });
    const bytes = Buffer.from(encoded, "base64");
    if (bytes.length < 1000 || bytes.length > 100000) throw new Error(`${style}: the standard picture is missing or too large (${bytes.length} bytes).`);
    pictures.set(style, bytes);
    writeFileSync(resolve(out, `${style}.jpg`), bytes);
    console.log(`${style}: ${manufacturer.styles[style].name}, ${(bytes.length / 1024).toFixed(1)} KB`);
  }
  await harness.page.evaluate(() => window.pictureRenderer.close());
  if (errors.length) throw new Error(errors.join("; "));
} finally { await harness.close(); }
writeFileSync(resolve(out, "pictures.json"), JSON.stringify(publicPictureFacts(cat, codes, harness.engine, (style) => pictures.get(style)), null, 2) + "\n");
const keep = new Set(["pictures.json", ...codes.map((style) => `${style}.jpg`)]);
for (const name of readdirSync(out)) if (!keep.has(name)) rmSync(resolve(out, name));
console.log(`PROVED: drew ${codes.length} public standard building pictures from the Dealer Center's own renderer; the Control Room references stay separate.`);
