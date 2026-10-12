/* CHECK THE PUBLIC BUILDING PICTURES AND THEIR CLIENT BUNDLE.
   Run: node tools/check-building-pictures.mjs
   check-all: node
   Proves the fallback plan is today's shop standard, each image matches its
   recorded bytes, the engine is separate and its hash reaches the main file,
   layout mode ships its stylesheet, and setup references stay internal. */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { ROOT, PUBLIC_PICTURES, standardPicturesCatalogue, publicPictureFacts, pictureEngine } from "./lib/building-pictures.mjs";
import { jpegSize } from "./lib/style-facts.mjs";

const failures = [];
let passed = 0;
function ok(name, condition, detail = "") {
  if (condition) { passed++; console.log(`  ok   ${name}`); }
  else { failures.push(name); console.log(`  FAIL ${name}${detail ? ": " + detail : ""}`); }
}
const { cat, manufacturer } = standardPicturesCatalogue();
const codes = Object.keys(manufacturer.styles);
const dir = resolve(ROOT, PUBLIC_PICTURES);
const engine = await pictureEngine();
let stored;
try { stored = JSON.parse(readFileSync(resolve(dir, "pictures.json"), "utf8")); } catch (error) { ok("the public pictures have their drawing record", false, error.message); }
let fresh;
try { fresh = publicPictureFacts(cat, codes, engine.id, (style) => readFileSync(resolve(dir, `${style}.jpg`))); }
catch (error) { ok("every standard building has a public fallback picture", false, error.message); }
if (fresh && stored) ok("the public pictures match today's engine, shop numbers, opening colors and recorded image bytes",
  JSON.stringify(fresh) === JSON.stringify(stored), "Run node tools/make-building-pictures.mjs after a drawing change.");
if (fresh) {
  const bad = codes.filter((style) => {
    const bytes = readFileSync(resolve(dir, `${style}.jpg`)), size = jpegSize(bytes);
    return !size || size.width !== 800 || size.height !== 600 || bytes.length < 1000 || bytes.length > 100000;
  });
  ok("every public fallback is an 800 by 600 JPEG under 100 KB", !bad.length, bad.join(", "));
  const expected = new Set(["pictures.json", ...codes.map((style) => `${style}.jpg`)]);
  ok("the public folder contains only standard corner pictures and their drawing record", readdirSync(dir).every((name) => expected.has(name)));
}
const env = { ...process.env };
for (const key of ["SITE_ID", "INCLUDE_LEARNING_PREVIEW", "DEALER_DEMO"]) delete env[key];
const build = spawnSync(process.execPath, ["tools/build-site.mjs", "--client"], { cwd: ROOT, encoding: "utf8", timeout: 180000, env });
ok("the client build runs", build.status === 0, (build.stdout + build.stderr).trim().split("\n").slice(-4).join(" | "));
if (build.status === 0) {
  const out = resolve(ROOT, "dist-client");
  const drawing = readFileSync(resolve(out, "ui/office/pictures.js"));
  const main = readFileSync(resolve(out, "ui/office/main.js"), "utf8");
  const id = createHash("sha256").update(drawing).digest("hex").slice(0, 16);
  ok("the main file carries the exact hash of the separate picture engine", main.includes(id) && id === engine.id);
  ok("the main file keeps the drawing engine lazy", !main.includes("WEBGL_lose_context") && !main.includes("attribute vec3 aP") && drawing.includes(Buffer.from("WEBGL_lose_context")));
  ok("the layout mode stylesheet ships in the client package", existsSync(resolve(out, "ui/layout-mode.css")));
  ok("every public fallback ships while Control Room references stay internal",
    codes.every((style) => existsSync(resolve(out, PUBLIC_PICTURES, `${style}.jpg`))) && !existsSync(resolve(out, "library/style-refs")));
}
if (failures.length) { console.log(`FAIL: ${failures.length} building picture check(s) failed: ${failures.join("; ")}`); process.exitCode = 1; }
else console.log(`PROVED: ${passed} public building picture checks passed: today's shop standard, verified image bytes, a separate engine with its exact hash, and complete client assets.`);
