/* CHECK: every file that is meant to work without a browser really does.
   Run: node tools/check-imports.mjs

   WHY. The finished building is put together by plain code (model/, parts/
   and the "Node-safe" engine files) so it can be tested and golden-checked
   with no screen at all, and so a company's settings can be checked on a
   server. One stray `document.` or `window.` in those files and every one of
   those checks breaks -- and in the browser it might not show until a phone
   with an odd setting hits it.

   WHAT IT DOES, for each Node-safe file (engine/ except the six browser files,
   and everything under model/ and parts/ that exists so far):
     1. imports it ALONE, in a fresh Node process, with tripwires on window,
        document, navigator-free browser things (requestAnimationFrame,
        matchMedia, localStorage, location, HTMLElement, WebGL ...) -- the file
        fails if it throws or if it so much as looks at one of them;
     2. reads its import lines: a Node-safe file must never import a browser
        file (engine/gl.js renderer.js textures.js scene.js shaders.js
        snapshot.js, or anything in ui/) and nothing under engine/ model/
        parts/ ui/ may import a .json file (import attributes break older
        Safari and Firefox);
   and, for the whole of engine/ model/ parts/ ui/:
     3. nothing calls Math.random except engine/textures.js (the painters).
   Files that do not exist yet are skipped and listed as such. */

import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BROWSER_ENGINE = ["gl.js", "renderer.js", "textures.js", "scene.js", "shaders.js", "snapshot.js"];
const EXPECTED_ENGINE = ["constants.js", "wall.js", "seeded.js", "math.js", "buckets.js", "tex-names.js", "scene-data.js", "camera.js", "assemble.js"];

function walk(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const n of readdirSync(dir).sort()) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(m?js)$/.test(n)) out.push(p);
  }
  return out;
}

let pass = 0, fail = 0;
const failures = [];
function ok(name, cond, extra) {
  if (cond) pass++;
  else { fail++; failures.push(name + (extra ? " -- " + extra : "")); console.log("  FAIL " + name + (extra ? " -- " + extra : "")); }
}

const engineFiles = walk(join(ROOT, "engine"));
const nodeSafe = [
  ...engineFiles.filter((f) => !BROWSER_ENGINE.includes(relative(join(ROOT, "engine"), f))),
  ...walk(join(ROOT, "model")),
  ...walk(join(ROOT, "parts")),
];

/* The tripwires: each browser-only name becomes a getter that records the
   touch (and hands back undefined, so a guarded `typeof window` check is
   still caught rather than crashing the probe). */
const PROBE = `
const touched = [];
const NAMES = ["window","document","self","requestAnimationFrame","cancelAnimationFrame","matchMedia",
  "localStorage","sessionStorage","location","history","HTMLElement","HTMLCanvasElement","Image","ImageData",
  "WebGLRenderingContext","getComputedStyle","devicePixelRatio","ResizeObserver","IntersectionObserver",
  "OffscreenCanvas","XMLHttpRequest","alert"];
for (const n of NAMES) {
  if (n in globalThis) { try { delete globalThis[n]; } catch (e) {} }
  Object.defineProperty(globalThis, n, { configurable: true, get() { touched.push(n); return undefined; } });
}
const file = process.argv[1];
try {
  const m = await import(file);
  console.log(JSON.stringify({ ok: true, touched: [...new Set(touched)], exports: Object.keys(m) }));
} catch (e) {
  console.log(JSON.stringify({ ok: false, touched: [...new Set(touched)], error: String(e && e.stack || e) }));
}
`;

console.log("check-imports: every Node-safe file imports alone in Node, touching nothing of a browser\n");

const expectedMissing = EXPECTED_ENGINE.filter((n) => !existsSync(join(ROOT, "engine", n)));
for (const f of nodeSafe) {
  const rel = relative(ROOT, f);
  const r = spawnSync(process.execPath, ["--input-type=module", "-e", PROBE, pathToFileURL(f).href], { encoding: "utf8", cwd: ROOT, timeout: 30000 });
  const line = (r.stdout || "").trim().split("\n").pop();
  let res = null;
  try { res = JSON.parse(line); } catch (e) { res = { ok: false, error: (r.stderr || r.stdout || "no output").slice(0, 400) }; }
  const good = res.ok && res.touched.length === 0;
  ok(rel + " imports alone in Node", res.ok, res.error && res.error.split("\n")[0]);
  ok(rel + " touches no browser-only name", !res.touched || res.touched.length === 0, res.touched && res.touched.join(", "));
  console.log((good ? "  ok   " : "  FAIL ") + rel + (res.ok ? "  (exports: " + res.exports.join(" ") + ")" : ""));
}

/* 2. import lines */
const IMPORT_RE = /(?:^|[;\n])\s*(?:import|export)\s[^'"`]*?from\s*["']([^"']+)["']|(?:^|[;\n])\s*import\s*["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g;
function importsOf(file) {
  const src = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  const out = [];
  let m;
  while ((m = IMPORT_RE.exec(src))) out.push(m[1] || m[2] || m[3]);
  const withJson = /\bwith\s*\{\s*type\s*:\s*["']json["']/.test(src) || /\bassert\s*\{\s*type\s*:\s*["']json["']/.test(src);
  return { specs: out, withJson };
}
const browserTargets = new Set(BROWSER_ENGINE.map((n) => join(ROOT, "engine", n)));
for (const f of nodeSafe) {
  const rel = relative(ROOT, f);
  const { specs } = importsOf(f);
  const bad = specs.filter((s) => {
    if (!s.startsWith(".")) return false;
    const target = resolve(dirname(f), s);
    return browserTargets.has(target) || target.startsWith(join(ROOT, "ui") + "/");
  });
  ok(rel + " imports no browser file", bad.length === 0, bad.join(", "));
}
const allCode = ["engine", "model", "parts", "ui"].flatMap((d) => walk(join(ROOT, d)));
for (const f of allCode) {
  const rel = relative(ROOT, f);
  const { specs, withJson } = importsOf(f);
  const json = specs.filter((s) => /\.json(\?|$)/.test(s));
  ok(rel + " imports no JSON", json.length === 0 && !withJson, json.join(", "));
}

/* 3. Math.random only in the texture painters */
for (const f of allCode) {
  const rel = relative(ROOT, f);
  if (rel === join("engine", "textures.js")) continue;
  const code = readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  ok(rel + " never calls Math.random", !/Math\s*\.\s*random/.test(code));
}

console.log("\nImported alone in Node: " + nodeSafe.length + " file(s): " + nodeSafe.map((f) => relative(ROOT, f)).join(", "));
if (expectedMissing.length) console.log("Not written yet (skipped): engine/" + expectedMissing.join(", engine/"));
if (!existsSync(join(ROOT, "model")) || walk(join(ROOT, "model")).length === 0) console.log("Not written yet (skipped): anything under model/");
console.log("Checked " + allCode.length + " file(s) under engine/ model/ parts/ ui/ for JSON imports and Math.random.");
console.log("\n" + (fail ? "FAILED" : "PASSED") + ": " + pass + " passed, " + fail + " failed.");
if (fail) {
  console.log("\nWhat failed:\n  " + failures.join("\n  "));
  process.exit(1);
}
console.log("Proved: every Node-safe file above loads on its own in Node without looking at a browser, none of them");
console.log("pulls in a browser file, no code imports a JSON file, and only the texture painters use randomness.");
