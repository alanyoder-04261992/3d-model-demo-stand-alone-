/* The public Dealer Center fallback pictures, drawn by its own picture
   renderer. The internal Control Room references stay in library/style-refs. */
import { readFileSync } from "node:fs";
import { resolve, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { build } from "esbuild";
import { drawingCatalogue } from "./style-facts.mjs";
import { pictureKey, CARD_PICTURE, PICTURE_CAMERA, PICTURE_BACKDROP } from "../../model/picture-key.js";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const PUBLIC_PICTURES = "ui/office/building-pictures";
export const RECIPE = Object.freeze({ ...CARD_PICTURE, dpr: 2, cam: PICTURE_CAMERA, bg: PICTURE_BACKDROP });
export function standardPicturesCatalogue() {
  const read = (path) => readFileSync(resolve(ROOT, path));
  return drawingCatalogue({ standardBytes: read("library/manufacturers/standard.json"), constructionBytes: read("library/construction.json"),
    company: JSON.parse(read("companies/demo/company.json")) });
}
export async function pictureEngine() {
  const result = await build({ entryPoints: [resolve(ROOT, "ui/office/pictures.js")], outfile: "pictures.js", write: false,
    bundle: true, format: "esm", platform: "browser", target: "es2022", minify: true, sourcemap: false,
    legalComments: "none", logLevel: "warning" });
  const code = result.outputFiles[0].contents;
  return { code, id: createHash("sha256").update(code).digest("hex").slice(0, 16) };
}
export function publicPictureFacts(cat, codes, engine, bytesOf) {
  return { recipe: RECIPE, engine, styles: Object.fromEntries(codes.map((style) => [style, {
    key: pictureKey(cat, style, RECIPE, engine), sha256: createHash("sha256").update(bytesOf(style)).digest("hex"),
  }])) };
}

/* A random local port, this checkout only. No external network is used. */
export async function openPictureHarness() {
  const bundle = await pictureEngine();
  const server = createServer((req, res) => {
    let path;
    try { path = decodeURIComponent(new URL(req.url, "http://localhost").pathname); } catch { res.writeHead(400).end(); return; }
    if (path === "/__pictures") { res.writeHead(200, { "Content-Type": "text/html" }).end("<!doctype html><title>Dealer Center pictures</title><body></body>"); return; }
    if (path === "/__picture-engine.js") { res.writeHead(200, { "Content-Type": "text/javascript" }).end(bundle.code); return; }
    const file = resolve(ROOT, "." + path);
    if (!file.startsWith(ROOT + "/")) { res.writeHead(403).end(); return; }
    try {
      const type = { ".js": "text/javascript", ".json": "application/json", ".jpg": "image/jpeg", ".css": "text/css" }[extname(file)] || "application/octet-stream";
      const bytes = readFileSync(file);
      res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store" }).end(bytes);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise((done, fail) => { server.once("error", fail); server.listen(0, "127.0.0.1", done); });
  const url = `http://127.0.0.1:${server.address().port}`;
  const require = createRequire(import.meta.url);
  let browser;
  try {
    const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "/opt/node22/lib/node_modules/playwright/index.js");
    browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
      args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, serviceWorkers: "block" });
    await page.route("**/*", (route) => route.request().url().startsWith(url + "/") ? route.continue() : route.abort());
    await page.goto(url + "/__pictures");
    return { page, browser, url, engine: bundle.id, close: async () => { await browser.close(); await new Promise((done) => server.close(done)); } };
  } catch (error) { await browser?.close(); await new Promise((done) => server.close(done)); throw error; }
}
