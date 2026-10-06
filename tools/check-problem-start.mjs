/* CHECK: the 3D designer tells Barnwright about a problem while it is still
   loading, in a real browser.
   Run: node tools/check-problem-start.mjs        (check-all: browser)

   WHY. Alan (Oct 2026): "do 1 and 2" -- item 2 included "also report errors
   that happen while the 3D designer is still loading". The problem watcher
   (ui/problems.js) used to start inside ui/app.js, after every file app.js
   needs had arrived and started. A file that didn't arrive, or one that
   broke as it started, stopped the page before anything could say so: the
   customer saw a designer that never opened, and Barnwright never heard.
   Now index.html loads ui/problems-start.js on its own, just before
   ui/app.js, and app.js imports it first as well.

   HOW. Chromium (software graphics) opens the designer at a made-up address;
   every file is answered from this checkout and the site's problem address
   (POST /api/office/problem) is answered here, so nothing leaves this
   computer and no port is used. One file is broken on purpose per case.

   WHAT IT PROVES:
   1. A file the designer needs doesn't arrive (model/pricing.js answers
      404): one report, to this site's /api/office/problem, saying which of
      the page's scripts didn't load ("/ui/app.js (or a file it needs)").
   2. A file that breaks as it starts (model/pricing.js throws): one report
      with its own words and where it broke.
   3. The designer opening normally sends nothing.
   4. With only ui/app.js on the page (index.html's early script left out),
      a file that breaks as it starts is still reported, because app.js
      imports the watcher first; a file that doesn't arrive at all is not,
      which is why index.html loads the watcher on its own. */

import { readFileSync, existsSync, statSync } from "node:fs";
import { resolve, dirname, extname, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { loadPlaywright, CHROMIUM_ARGS } from "./lib/barnwright-page.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "http://designer.test";
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2", ".ico": "image/x-icon" };

let passed = 0;
const failed = [];
function ok(what, cond, extra = "") {
  if (cond) { passed++; console.log(`  ok   ${what}`); return true; }
  failed.push(what);
  console.log(`  FAIL ${what}${extra ? `\n       ${extra}` : ""}`);
  return false;
}

const PAGE = readFileSync(resolve(ROOT, "index.html"), "utf8");
const EARLY = '<script type="module" src="ui/problems-start.js"><\\/script>';
const PRICING = readFileSync(resolve(ROOT, "model/pricing.js"), "utf8");

/* Open the designer once. change: {path: {status, body}} for the files
   broken on purpose; page: the designer page's own HTML. -> the reports. */
async function open(browser, { change = {}, page = PAGE } = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const reports = [];
  await context.route(`${SITE}/**`, async (route) => {
    const req = route.request(), url = new URL(req.url());
    if (url.pathname === "/api/office/problem") {
      if (req.method() === "POST") { try { reports.push(JSON.parse(req.postData() || "null")); } catch { reports.push(null); } }
      return route.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' });
    }
    if (change[url.pathname]) return route.fulfill({ contentType: TYPES[".js"], ...change[url.pathname] });
    if (url.pathname === "/" || url.pathname === "/index.html") return route.fulfill({ status: 200, contentType: TYPES[".html"], body: page });
    const file = normalize(resolve(ROOT, "." + decodeURIComponent(url.pathname)));
    if (!file.startsWith(ROOT + sep) || !existsSync(file) || !statSync(file).isFile()) return route.fulfill({ status: 404, body: "Not found" });
    return route.fulfill({ status: 200, contentType: TYPES[extname(file)] || "application/octet-stream", body: readFileSync(file) });
  });
  const tab = await context.newPage();
  await tab.goto(`${SITE}/?company=demo`, { waitUntil: "load" });
  /* long enough for the page to start, draw and report */
  await tab.waitForTimeout(2500);
  await context.close();
  return reports;
}

const { chromium } = loadPlaywright();
const browser = await chromium.launch({ args: [...CHROMIUM_ARGS] });
try {
  console.log("1. A file the designer needs doesn't arrive");
  let got = await open(browser, { change: { "/model/pricing.js": { status: 404, body: "Not found" } } });
  ok("one report, saying which of the page's scripts didn't load", got.length === 1
    && got[0]?.message === "This page's script didn't load: /ui/app.js (or a file it needs)" && got[0]?.where === "/ui/app.js", JSON.stringify(got));
  ok("... from the 3D designer, on its page's path, with a short code the server takes", got[0]?.area === "designer" && got[0]?.page === "/"
    && /^designer:[0-9a-f]{16}$/.test(got[0]?.signature || "") && got[0]?.count === 1, JSON.stringify(got[0]));

  console.log("\n2. A file that breaks as it starts");
  const broken = { "/model/pricing.js": { status: 200, body: `throw new Error("broke while loading (check)");\n${PRICING}` } };
  got = await open(browser, { change: broken });
  ok("one report with its own words and where it broke", got.length === 1 && /broke while loading \(check\)/.test(got[0]?.message || "")
    && /^\/model\/pricing\.js:1:\d+$/.test(got[0]?.where || ""), JSON.stringify(got));

  console.log("\n3. The designer opening normally");
  got = await open(browser);
  ok("nothing is sent", got.length === 0, JSON.stringify(got));

  console.log("\n4. With only ui/app.js on the page");
  const alone = PAGE.replace(EARLY, "");
  ok("(the page without index.html's early script)", alone !== PAGE && alone.includes('src="ui/app.js"'));
  got = await open(browser, { change: broken, page: alone });
  ok("a file that breaks as it starts is still reported (app.js imports the watcher first)", got.length === 1 && /broke while loading \(check\)/.test(got[0]?.message || ""), JSON.stringify(got));
  got = await open(browser, { change: { "/model/pricing.js": { status: 404, body: "Not found" } }, page: alone });
  ok("a file that doesn't arrive at all is not: why index.html loads the watcher on its own", got.length === 0, JSON.stringify(got));
} finally {
  await browser.close();
}

if (failed.length) {
  console.log(`\nFAIL: ${failed.length} of ${passed + failed.length} checks failed.`);
  process.exit(1);
}
console.log(`\nPROVED (${passed} checks): the 3D designer passes on a problem while it is still loading -- a script that didn't arrive, or one that broke as it started -- and nothing when it opens normally.`);
