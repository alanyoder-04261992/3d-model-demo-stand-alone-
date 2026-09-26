/* PROVE THE DESIGNER SITS SAFELY AND PROPERLY INSIDE A COMPANY'S OWN WEBSITE.
   check-all: browser

     node tools/check-embed.mjs

   A company pastes two lines on its website (embed.js). This check builds
   pretend company websites on OTHER addresses (another "origin", as a real
   company's site would be) and acts out what Netlify does when it hosts the
   designer -- the address rewrites in netlify.toml and the safety rules in
   _headers -- so the browser enforces them exactly as it would for real.
   Ports: 8356 the designer's site, 8357 a company site that IS allowed,
   8358 a site that is NOT.

   It proves, in this order:
   1. HOSTING FILES. _headers is up to date with the companies; each company's
      designer may be framed only by its own websites (embed.origins) and this
      site; the plain designer address only by this site; no address gets two
      different policies; the designer's policy names exactly the scripts in
      index.html; netlify.toml rewrites /c/<id>/ to the designer and keeps the
      checks' own files off the website; the fonts are on this site with their
      licence; embed.js never writes HTML from text.
   2. LAZY LOADING AND SIZE. Nothing of the designer is fetched until the
      visitor scrolls near it; the frame is the height asked for (data-height),
      or 3/4 of its width, and never under 520 pixels.
   3. THE LINK AND THE EVENTS. A shared design link on the company's page
      (#d=...) opens that building in the designer. The page hears
      shed:ready, shed:design-changed (after a colour tap) and
      shed:quote-requested (the real quote form, leads to the company's page);
      a message from ANY other frame, from the page itself, of an unknown kind
      or another version, is ignored.
   4. FULL SCREEN. The button fills the screen and gives it back; where the
      browser cannot (an iPhone), the designer is laid over the whole page
      instead, and Close (or Esc) puts it back.
   5. PHONES. On a touch screen a "Tap to design" cover lets a finger scroll
      the company's page without turning the building; after a tap, the
      finger moves the building and the page stays put.
   6. WHO MAY SHOW IT. A website not on the list gets an empty frame (the
      browser refuses), and even without that rule the designer tells such a
      page nothing.
   7. THE DESIGNER ON ITS OWN, under its policy: /c/<id>/ and /?company=
      start with nothing refused; a suspended company says "not available"
      with its phone number; embed-demo.html shows events from its designer.

   Pictures go to test/out/embed-*.png. */

import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync, readdirSync } from "node:fs";
import { resolve as resolvePath, join } from "node:path";
import { createRequire } from "node:module";
import {
  ROOT, buildHeaders, readCompanies, parseHeaders, headersFor, parseNetlifyToml, applyRedirects, tomlHeadersFor,
  inlineScriptHashes, frameOrigins,
} from "./build-headers.mjs";
import { readManufacturer, readJSON } from "./lib/load.mjs";
import { validate, resolve as resolveCompany } from "../model/company.js";
import { defaults, setType, fromState, encode } from "../model/design.js";
import { serveFolder } from "./lib/barnwright-page.mjs";

const require = createRequire(import.meta.url);
const PORT_D = 8356, PORT_H = 8357, PORT_X = 8358;
const D = `http://127.0.0.1:${PORT_D}`, H = `http://127.0.0.1:${PORT_H}`, X = `http://127.0.0.1:${PORT_X}`;
const OUT = resolvePath(ROOT, "test/out");
const HOSTDIR = resolvePath(OUT, "embed-host");
const LAUNCH = { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] };
const J = (v) => JSON.stringify(v);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let passed = 0;
const failures = [], notes = [], shots = [];
function section(t) { console.log("\n" + t); }
function ok(what, cond, info) {
  if (cond) { passed++; console.log("  ok   " + what); }
  else { failures.push(what); console.log("  FAIL " + what + (info ? "\n       " + String(info).slice(0, 900) : "")); }
  return !!cond;
}
function note(t) { notes.push(t); console.log("  NOTE " + t); }

/* ======================================================================
   The two pretend companies (kept in memory: nothing is written to
   companies/). "embed-check" may be shown on 8357 only, and hands quote
   requests to that page; "embed-check-off" is suspended. */
const manufacturer = readManufacturer("standard");
const library = readJSON("library/construction.json");
const starter = readJSON("companies/starter/company.json");
const TEST = Object.assign(JSON.parse(J(starter)), {
  id: "embed-check",
  embed: { origins: [H], shareUrl: "" },
  leads: Object.assign({}, starter.leads, { mode: "postMessage", url: "", smsConsent: null }),
});
TEST.brand = Object.assign({}, starter.brand, { name: "Embed Check Sheds", short: "Embed Check", initials: "EC" });
const OFF = Object.assign(JSON.parse(J(starter)), { id: "embed-check-off", status: "suspended" });
OFF.brand = Object.assign({}, starter.brand, { name: "Paused Sheds", phone: "(555) 010-0199" });
const MEMORY = { "embed-check": TEST, "embed-check-off": OFF };

/* ======================================================================
   1. the hosting files */
section("1. The hosting files: _headers, netlify.toml, the fonts, embed.js");
const INDEX = readFileSync(resolvePath(ROOT, "index.html"), "utf8");
const real = await readCompanies();
ok("every company's settings file loads (a broken one would stop tools/build-headers.mjs)", real.problems.length === 0, J(real.problems));
const fileNow = existsSync(resolvePath(ROOT, "_headers")) ? readFileSync(resolvePath(ROOT, "_headers"), "utf8") : "";
const fresh = buildHeaders({ companies: real.companies, indexHtml: INDEX });
ok("_headers is up to date with the companies and index.html (else: node tools/build-headers.mjs)", fileNow === fresh);
const rules = parseHeaders(fileNow);
const cspOf = (path) => (headersFor(rules, path)["content-security-policy"] || []);
const ancestorsOf = (csp) => { const m = /frame-ancestors ([^;]+)/.exec(csp || ""); return m ? m[1].trim().split(/\s+/) : null; };
for (const c of real.companies) {
  const want = ["'self'"].concat(frameOrigins(c.company));
  for (const p of [`/c/${c.id}/`, `/c/${c.id}`, `/c/${c.id}/index.html`]) {
    const got = cspOf(p);
    ok(`${p}: ONE policy, and it lets exactly ${want.join(" ")} show it`, new Set(got).size === 1 && J(ancestorsOf(got[0])) === J(want), J(got.map(ancestorsOf)));
  }
}
ok("starter (Cedar Ridge) may be shown on https://cedarridge.example and this site, nowhere else",
  J(ancestorsOf(cspOf("/c/starter/")[0])) === J(["'self'", "https://cedarridge.example"]));
ok("the demo may be shown on this site only (it has no embed.origins)", J(ancestorsOf(cspOf("/c/demo/")[0])) === J(["'self'"]));
for (const p of ["/", "/index.html"]) ok(`${p}: framed by this site only, so /c/<company>/ is the only way into another website`, J(ancestorsOf((cspOf(p) || [])[0])) === J(["'self'"]) && cspOf(p).length === 1);
ok("an address of a company not set up gets no policy of anyone else's", cspOf("/c/nobody/").length === 0);
const hashes = inlineScriptHashes(INDEX);
const scriptSrc = (/script-src ([^;]+)/.exec(cspOf("/c/starter/")[0] || "") || [])[1] || "";
ok(`the designer's policy allows exactly index.html's ${hashes.length} small in-page scripts (by fingerprint) and its own files -- no 'unsafe-inline' script`,
  hashes.length >= 1 && hashes.every((h) => scriptSrc.indexOf(h) >= 0) && !/unsafe-inline|unsafe-eval/.test(scriptSrc), scriptSrc);
ok("every file is sent with X-Content-Type-Options: nosniff", J(headersFor(rules, "/ui/app.js")["x-content-type-options"]) === J(["nosniff"]));
ok("a company whose leads go to a form service may post there (form-action) and show its answer (frame-src)", /form-action 'self' https:\/\/formspree\.io/.test(cspOf("/c/starter/")[0]) && /frame-src 'self' https:\/\/formspree\.io/.test(cspOf("/c/starter/")[0]));
ok("the staff pages (setup, parts gallery) can be framed by this site only", J(ancestorsOf(cspOf("/setup.html")[0])) === J(["'self'"]) && J(ancestorsOf(cspOf("/parts.html")[0])) === J(["'self'"]));

const TOML = parseNetlifyToml(readFileSync(resolvePath(ROOT, "netlify.toml"), "utf8"));
const fileExists = (p) => { try { return statSync(join(ROOT, p)).isFile(); } catch (e) { return false; } };
const rw = (p) => applyRedirects(TOML.redirects, p, fileExists);
ok("netlify.toml: /c/acme/ and /c/acme are the designer (index.html), the address kept", J(rw("/c/acme/")) === J({ to: "/index.html", status: 200, force: false }) && rw("/c/acme").to === "/index.html");
ok("netlify.toml: a designer file looked for under /c/acme/ is served from the top (ui/, engine/, fonts/ ...)", rw("/c/acme/ui/app.js").to === "/ui/app.js" && rw("/c/acme/engine/renderer.js").to === "/engine/renderer.js" && rw("/c/acme/fonts/oswald-latin.woff2").to === "/fonts/oswald-latin.woff2");
ok("netlify.toml: the checks' own files are not on the website", (rw("/tools/check-embed.mjs") || {}).status === 404 && (rw("/test/golden/x.json") || {}).status === 404);
ok("netlify.toml: a real file is never rewritten (index.html, ui/app.js)", rw("/ui/app.js") === null && rw("/index.html") === null);
const cc = (p) => (tomlHeadersFor(TOML.headers, p)["cache-control"] || []).join(", ");
ok("netlify.toml: the designer's code and settings are checked on every visit (no half-updated designer)", ["/engine/renderer.js", "/model/plan.js", "/parts/skids.js", "/ui/app.js", "/library/construction.json", "/companies/demo/company.json"].every((p) => /max-age=0, must-revalidate/.test(cc(p))));
ok("netlify.toml: the fonts are kept a year; embed.js five minutes", /max-age=31536000, immutable/.test(cc("/fonts/oswald-latin.woff2")) && /max-age=300/.test(cc("/embed.js")));

const FONTS = ["oswald-latin.woff2", "oswald-latin-ext.woff2", "ibm-plex-sans-latin.woff2", "ibm-plex-sans-latin-ext.woff2"];
const css = readFileSync(resolvePath(ROOT, "ui/styles.css"), "utf8");
ok("the four font files are on this site (fonts/), each a real WOFF2 file", FONTS.every((f) => existsSync(resolvePath(ROOT, "fonts", f)) && readFileSync(resolvePath(ROOT, "fonts", f)).slice(0, 4).toString("latin1") === "wOF2"));
ok("their licence travels with them (fonts/OFL.txt: SIL Open Font License 1.1, both copyright lines)", (() => { const t = readFileSync(resolvePath(ROOT, "fonts/OFL.txt"), "utf8"); return /SIL OPEN FONT LICENSE/.test(t) && /Version 1\.1/.test(t) && /Oswald Project Authors/.test(t) && /IBM Corp/.test(t); })());
ok("ui/styles.css takes Oswald and IBM Plex Sans from fonts/, not from Google", FONTS.every((f) => css.indexOf("url(../fonts/" + f + ")") >= 0) && /font-family:'Oswald'/.test(css) && /font-family:'IBM Plex Sans'/.test(css) && !/fonts\.googleapis/.test(css));
const EJS = readFileSync(resolvePath(ROOT, "embed.js"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
ok("embed.js never writes HTML (no innerHTML / outerHTML / document.write / eval): every word goes in as plain text", !/innerHTML|outerHTML|insertAdjacentHTML|document\.write|\beval\(|new Function/.test(EJS));
ok("embed.js passes on only messages from ITS frame and from the designer's own website", /e\.source !== frame\.contentWindow/.test(EJS) && /e\.origin !== designerOrigin/.test(EJS));

/* ======================================================================
   The browser part: the servers, the pretend company pages, and Netlify
   acted out. */
if (existsSync(HOSTDIR)) for (const f of readdirSync(HOSTDIR)) { try { require("node:fs").unlinkSync(join(HOSTDIR, f)); } catch (e) { /* ok */ } }
mkdirSync(HOSTDIR, { recursive: true });
const LISTEN = `<script>window.__events=[];["shed:ready","shed:design-changed","shed:quote-requested"].forEach(function(n){document.addEventListener(n,function(e){window.__events.push({type:e.type,detail:e.detail,on:e.target&&e.target.id})})});</script>`;
function hostPage(title, body, head) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>body{margin:0;font-family:sans-serif;background:#f5f2ea}.spacer{height:2200px;background:linear-gradient(#f5f2ea,#d9d3c5);padding:12px}</style>${LISTEN}${head || ""}</head><body>${body}</body></html>`;
}
const EMBED = (company, extra) => `<script src="${D}/embed.js" data-company="${company}"${extra || ""}></script>`;
writeFileSync(join(HOSTDIR, "blank.html"), "<!doctype html><title>blank</title><p>another frame</p>");
writeFileSync(join(HOSTDIR, "lazy.html"), hostPage("A company page",
  `<iframe id="rogue-x" src="${X}/blank.html" style="width:40px;height:20px;border:0"></iframe><iframe id="rogue-d" src="${D}/fonts/OFL.txt" style="width:40px;height:20px;border:0"></iframe>
<div class="spacer" id="above">A pretend company page. Scroll down for the designer.</div>
<div id="box" style="width:800px;margin:0 auto"><div id="shed-designer"></div>${EMBED("embed-check", ' data-height="640"')}</div>
<div class="spacer" id="below"></div>`));
writeFileSync(join(HOSTDIR, "sizes.html"), hostPage("Sizes",
  `<div class="spacer" style="height:4000px"></div>
<div id="a" style="width:800px"></div>${EMBED("embed-check", ' data-target="#a"')}
<div id="b" style="width:500px"></div>${EMBED("embed-check", ' data-target="#b"')}
<div id="c" style="width:800px"></div>${EMBED("embed-check", ' data-target="#c" data-height="300"')}
<div id="d" style="width:800px"></div>${EMBED("embed-check", ' data-target="#d" data-height="700"')}
<div id="e"></div>${EMBED("Bad Id!", ' data-target="#e"')}`));
writeFileSync(join(HOSTDIR, "phone.html"), hostPage("A company page on a phone",
  `<div class="spacer" id="above" style="height:1500px">Scroll down.</div><div id="shed-designer"></div>${EMBED("embed-check")}<div class="spacer" id="below"></div>`));

const servers = [];
async function stopAll() { for (const s of servers) { try { await s.stop(); } catch (e) { /* gone */ } } }
process.on("exit", () => { for (const s of servers) { try { s.stop(); } catch (e) { /* gone */ } } });

const TEST_HEADERS = parseHeaders(buildHeaders({ companies: real.companies.concat([{ id: "embed-check", company: TEST }, { id: "embed-check-off", company: OFF }]), indexHtml: INDEX }));

/* one browser "tab set" with Netlify acted out in front of the designer's site */
async function newContext(browser, o) {
  o = o || {};
  const ctx = await browser.newContext({ viewport: o.viewport || { width: 1200, height: 900 }, deviceScaleFactor: 1, reducedMotion: "reduce", hasTouch: !!o.touch, isMobile: !!o.mobile });
  ctx.fetched = [];
  await ctx.addInitScript(() => {
    window.__csp = [];
    document.addEventListener("securitypolicyviolation", (e) => { window.__csp.push(e.violatedDirective + " " + e.blockedURI); });
  });
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: "text/css", body: "" }));
  await ctx.route(D + "/**", async (route) => {
    const u = new URL(route.request().url());
    const path = decodeURIComponent(u.pathname);
    ctx.fetched.push(path);
    const cm = /^\/companies\/([a-z0-9-]+)\/company\.json$/.exec(path);
    if (cm && MEMORY[cm[1]]) return route.fulfill({ status: 200, contentType: "application/json", body: J(MEMORY[cm[1]]) });
    const red = applyRedirects(TOML.redirects, path, fileExists);
    let target = path;
    if (red) {
      if (red.status === 404) return route.fulfill({ status: 404, contentType: "text/plain", body: "Not found" });
      if (red.status !== 200) return route.fulfill({ status: red.status, headers: { location: red.to } });
      target = red.to;
    }
    let resp;
    try { resp = await route.fetch({ url: D + target + u.search }); } catch (e) { return route.abort(); }
    const hdrs = Object.assign({}, resp.headers());
    if (o.headers !== false) {
      const add = Object.assign({}, tomlHeadersFor(TOML.headers, path), headersFor(TEST_HEADERS, path));
      for (const k of Object.keys(add)) hdrs[k] = add[k].join(", ");
    }
    return route.fulfill({ response: resp, headers: hdrs });
  });
  return ctx;
}
async function openPage(ctx, url) {
  const page = await ctx.newPage();
  page.noise = [];
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") page.noise.push({ type: m.type(), text: m.text(), url: (m.location() || {}).url || "" }); });
  page.on("pageerror", (e) => page.noise.push({ type: "pageerror", text: String(e) }));
  await page.goto(url, { waitUntil: "load" });
  return page;
}
const designerFrame = (page) => page.frames().find((f) => /\/c\/embed-check\//.test(f.url()) || /\/c\/starter\//.test(f.url()));
async function waitDesigner(page, ms) {
  const t0 = Date.now();
  let f = null;
  while (Date.now() - t0 < (ms || 120000)) {
    f = designerFrame(page);
    if (f) { try { if (await f.evaluate(() => !!(window.shedUI && window.shedUI.ready))) return f; } catch (e) { /* navigating */ } }
    await sleep(250);
  }
  return null;
}
/* ui/app.js is meant to load ui/embed-mode.js on ?embed=1; if it does not
   yet, load it here so the rest can be proved, and say so */
let saidPlugin = false;
async function ensureEmbedMode(frame) {
  const has = await frame.evaluate(() => !!window.shedUI.embed);
  if (!has) {
    await frame.evaluate(async () => { const m = await import("/ui/embed-mode.js"); m.install(window.shedUI); });
    if (!saidPlugin) { saidPlugin = true; note("ui/app.js does not load ui/embed-mode.js yet, so this check loaded it by hand. For real pages, ui/app.js must import it when the address has ?embed=1 (add \"embed-mode\" to its plugin list)."); }
  } else if (!saidPlugin) { saidPlugin = true; ok("ui/app.js loads ui/embed-mode.js by itself on ?embed=1", true); }
  return !has;
}
const events = (page, type) => page.evaluate((t) => window.__events.filter((e) => !t || e.type === t), type || null);
async function waitEvent(page, type, pred, ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < (ms || 15000)) {
    const list = await events(page, type);
    const hit = list.find((e) => !pred || pred(e));
    if (hit) return hit;
    await sleep(150);
  }
  return null;
}
const realNoise = (noise) => noise.filter((m) => m.type === "pageerror" || m.type === "error");

const { chromium } = require("/opt/node22/lib/node_modules/playwright/index.js");
let browser = null;
try {
  servers.push(await serveFolder(ROOT, PORT_D, "embed.js"));
  servers.push(await serveFolder(HOSTDIR, PORT_H, "blank.html"));
  servers.push(await serveFolder(HOSTDIR, PORT_X, "blank.html"));
  browser = await chromium.launch(LAUNCH);

  /* a shared design link: a 12x24 garage in Barn Red */
  const TCAT = resolveCompany(JSON.parse(J(TEST)), manufacturer, library);
  const tv = validate(TEST, manufacturer);
  ok("the pretend company for this check is a valid settings file", tv.length === 0, J(tv));
  const st = defaults(TCAT); setType(st, "G", TCAT); st.size = "12x24";
  st.body = (TCAT.COLORS.paint.find((c) => c[0] === "Barn Red") || TCAT.COLORS.paint[0])[1];
  const LINK = await encode(fromState(st, TCAT));

  /* ====================================================================
     2. lazy loading and size */
  section("2. Lazy loading and the size of the frame (a company site on another address)");
  const ctxA = await newContext(browser);
  const pA = await openPage(ctxA, `${H}/lazy.html#d=${LINK}`);
  await sleep(1200);
  const before = await pA.evaluate(() => { const f = document.querySelector("#shed-designer iframe"); const r = f.getBoundingClientRect(); return { src: f.getAttribute("src"), lazy: f.getAttribute("loading"), w: r.width, h: r.height, state: document.getElementById("shed-designer").getAttribute("data-shed-state"), title: f.title }; });
  ok("before the visitor scrolls near it, the frame is empty and nothing of the designer is fetched", before.src === null && before.state === "waiting" && !ctxA.fetched.some((p) => p.startsWith("/c/")), J({ before, fetched: ctxA.fetched.filter((p) => !/OFL|embed\.js/.test(p)) }));
  ok("the frame is marked loading=lazy and titled for screen readers", before.lazy === "lazy" && before.title === "3D shed designer");
  ok("data-height=\"640\": the frame is 640 pixels tall and the full width of its box (800)", Math.abs(before.h - 640) < 1 && Math.abs(before.w - 800) < 1, J(before));
  await pA.evaluate(() => document.getElementById("shed-designer").scrollIntoView({ block: "center" }));
  const fA = await waitDesigner(pA);
  ok("scrolled into view, the designer loads at /c/<company>/?embed=1", !!fA && /\/c\/embed-check\/\?embed=1#d=/.test(fA.url()), fA ? fA.url() : "never loaded");
  if (!fA) throw new Error("the designer never loaded inside the company page");

  /* 3. the link and the events */
  section("3. The shared link, and what the designer tells the company's page");
  ok("the page's #d= link was handed to the designer unchanged", fA.url().endsWith("#d=" + LINK));
  const opened = await fA.evaluate(() => ({ type: window.shedUI.getState().type, size: window.shedUI.getState().size, body: window.shedUI.getDesign().colors.body, err: window.shedUI.startError, embedded: window.shedUI.embedded, hdr: getComputedStyle(document.getElementById("hdr")).display }));
  ok("the designer opened the shared building (a 12x24 Garage in Barn Red), not the company's default", opened.type === "G" && opened.size === "12x24" && opened.body === "Barn Red" && !opened.err, J(opened));
  ok("inside the company's page the designer has no header bar of its own", opened.embedded === true && opened.hdr === "none", J(opened));
  await ensureEmbedMode(fA);
  const ready = await waitEvent(pA, "shed:ready");
  ok("the company's page hears shed:ready, naming the company and the building", !!ready && ready.detail.company === "embed-check" && ready.detail.style === "G" && ready.detail.size === "12x24" && ready.on === "shed-designer", J(ready));
  ok("... and the designer marks its box ready", (await pA.evaluate(() => document.getElementById("shed-designer").getAttribute("data-shed-state"))) === "ready");
  const pickName = await fA.evaluate(() => {
    const sws = Array.from(document.querySelectorAll("#sw-body .sw"));
    const off = sws.find((s) => !s.classList.contains("on"));
    off.click();
    return window.shedUI.getDesign().colors.body;
  });
  const changed = await waitEvent(pA, "shed:design-changed", (e) => e.detail.design && e.detail.design.colors.body === pickName);
  ok(`tapping a colour (${pickName}) tells the page shed:design-changed, with the building and its price`, !!changed && changed.detail.summary && typeof changed.detail.summary.total === "number" && changed.detail.design.type === "G", J(changed && changed.detail.summary));
  ok("... and nothing about the customer rides along", !!changed && !("contact" in changed.detail));

  /* messages from anywhere else are ignored */
  const nBefore = (await events(pA)).length;
  const rogueX = pA.frames().find((f) => f.url().startsWith(X));
  const rogueD = pA.frames().find((f) => /OFL\.txt/.test(f.url()));
  await rogueX.evaluate(() => parent.postMessage({ type: "shed:quote-requested", v: 1, rogue: "another website's frame" }, "*"));
  await rogueD.evaluate(() => parent.postMessage({ type: "shed:quote-requested", v: 1, rogue: "a frame from the designer's own website" }, "*"));
  await pA.evaluate(() => window.postMessage({ type: "shed:quote-requested", v: 1, rogue: "the page itself" }, "*"));
  await fA.evaluate((h) => { parent.postMessage({ type: "shed:hello", v: 1, rogue: "an unknown kind" }, h); parent.postMessage({ type: "shed:ready", v: 2, rogue: "another version" }, h); parent.postMessage("shed:ready", h); }, H);
  await sleep(900);
  const after = (await events(pA)).slice(nBefore);
  ok("a message from another website's frame, from another frame of the designer's own website, from the page itself, of an unknown kind or version: all ignored", after.length === 0, J(after));

  /* the real quote form, leads to the company's page */
  const hasQuote = await fA.evaluate(() => !!(window.shedUI.quote && document.querySelector("#quote-mount .qform")));
  if (hasQuote) {
    await fA.evaluate(() => { const set = (n, v) => { const i = document.querySelector('#quote-mount [name="' + n + '"]'); if (i) { i.value = v; i.dispatchEvent(new Event("input", { bubbles: true })); } }; set("name", "Embed Check"); set("phone", "(555) 010-0111"); set("zip", "33948"); set("email", "embed@check.example"); });
    await sleep(Math.max(0, (await fA.evaluate(() => window.shedUI.quote.minMs || 3000))) + 300);
    await fA.evaluate(() => document.querySelector("#quote-mount .qsend").click());
    const q = await waitEvent(pA, "shed:quote-requested", (e) => !e.detail.rogue, 20000);
    ok("the real quote form (leads to the company's page) reaches it as shed:quote-requested, with the customer's details", !!q && q.detail.contact && q.detail.contact.name === "Embed Check" && q.detail.design && q.detail.design.type === "G", J(q && Object.keys(q.detail)));
  } else {
    note("ui/quote.js did not draw its form, so the quote message was sent by hand from the designer's frame");
    await fA.evaluate((h) => parent.postMessage({ type: "shed:quote-requested", v: 1, mode: "postMessage", design: window.shedUI.getDesign() }, h), H);
    const q = await waitEvent(pA, "shed:quote-requested", (e) => !e.detail.rogue);
    ok("a quote message from the designer's frame reaches the page as shed:quote-requested", !!q);
  }
  ok("no errors and nothing refused inside the designer on the company's page", realNoise(pA.noise).length === 0 && (await fA.evaluate(() => window.__csp.length)) === 0, J(realNoise(pA.noise)) + J(await fA.evaluate(() => window.__csp)));
  await pA.evaluate(() => document.getElementById("shed-designer").scrollIntoView({ block: "center" }));
  await fA.evaluate(() => { window.scrollTo(0, 0); const w = document.getElementById("wrap"); if (w) w.scrollTop = 0; });
  await sleep(600);
  await pA.screenshot({ path: resolvePath(OUT, "embed-desktop.png") }); shots.push("test/out/embed-desktop.png: the designer inside a pretend company page on another address (desktop)");

  /* 4. full screen */
  section("4. Full screen");
  const vp = pA.viewportSize();
  await pA.click("#shed-designer .shed-embed-fullscreen");
  await sleep(700);
  const fs1 = await pA.evaluate(() => { const w = document.querySelector("#shed-designer .shed-embed"), f = w.querySelector("iframe"), r = f.getBoundingClientRect(); return { el: document.fullscreenElement === w, full: document.getElementById("shed-designer").getAttribute("data-shed-full"), w: r.width, h: r.height, btn: w.querySelector("button").textContent }; });
  ok("the Full screen button makes the designer the whole screen (the browser's own full screen)", fs1.el && fs1.full === "native" && fs1.h > vp.height - 80 && fs1.w > vp.width - 40 && /Close/.test(fs1.btn), J({ fs1, vp }));
  await pA.screenshot({ path: resolvePath(OUT, "embed-fullscreen.png") }); shots.push("test/out/embed-fullscreen.png: the designer full screen, with its Close button");
  await pA.click("#shed-designer .shed-embed-fullscreen");
  await sleep(600);
  const fs2 = await pA.evaluate(() => { const w = document.querySelector("#shed-designer .shed-embed"), r = w.querySelector("iframe").getBoundingClientRect(); return { el: !!document.fullscreenElement, full: document.getElementById("shed-designer").getAttribute("data-shed-full"), h: r.height, w: r.width }; });
  ok("Close full screen gives the page back, the designer 640 x 800 again", !fs2.el && fs2.full === null && Math.abs(fs2.h - 640) < 1 && Math.abs(fs2.w - 800) < 1, J(fs2));
  /* a browser with no full screen for part of a page (an iPhone) */
  await pA.evaluate(() => { const w = document.querySelector("#shed-designer .shed-embed"); w.requestFullscreen = undefined; w.webkitRequestFullscreen = undefined; });
  await pA.click("#shed-designer .shed-embed-fullscreen");
  await sleep(500);
  const ov = await pA.evaluate(() => { const w = document.querySelector("#shed-designer .shed-embed"), r = w.getBoundingClientRect(), f = w.querySelector("iframe").getBoundingClientRect(); return { pos: getComputedStyle(w).position, top: r.top, left: r.left, w: r.width, h: r.height, fh: f.height, lock: document.documentElement.style.overflow, full: document.getElementById("shed-designer").getAttribute("data-shed-full"), native: !!document.fullscreenElement }; });
  ok("where the browser cannot, the designer is laid over the whole page instead (and the page underneath stops scrolling)", ov.pos === "fixed" && ov.top === 0 && ov.left === 0 && Math.abs(ov.w - vp.width) < 2 && Math.abs(ov.h - vp.height) < 2 && ov.fh > vp.height - 80 && ov.lock === "hidden" && ov.full === "overlay" && !ov.native, J(ov));
  await pA.keyboard.press("Escape");
  await sleep(300);
  const ov2 = await pA.evaluate(() => { const w = document.querySelector("#shed-designer .shed-embed"), f = w.querySelector("iframe").getBoundingClientRect(); return { pos: getComputedStyle(w).position, h: f.height, lock: document.documentElement.style.overflow, full: document.getElementById("shed-designer").getAttribute("data-shed-full") }; });
  ok("Esc (or Close) puts it back in the page, 640 pixels tall", ov2.pos !== "fixed" && Math.abs(ov2.h - 640) < 1 && ov2.lock === "" && ov2.full === null, J(ov2));
  await ctxA.close();

  /* sizes, with nothing loaded */
  section("2 (cont.). Sizes: 3/4 of the width, at least 520 pixels");
  const ctxS = await newContext(browser);
  const pS = await openPage(ctxS, `${H}/sizes.html`);
  await sleep(800);
  const sz = await pS.evaluate(() => ["a", "b", "c", "d"].map((id) => { const f = document.querySelector("#" + id + " iframe"); const r = f.getBoundingClientRect(); return { id, w: Math.round(r.width), h: Math.round(r.height), src: f.getAttribute("src") }; }));
  const byId = Object.fromEntries(sz.map((s) => [s.id, s]));
  ok("no height given, 800 wide: 600 tall (4:3)", byId.a.w === 800 && byId.a.h === 600, J(byId.a));
  ok("no height given, 500 wide: 520 tall (4:3 would be 375 -- too short for the designer's buttons)", byId.b.w === 500 && byId.b.h === 520, J(byId.b));
  ok("data-height=\"300\" is raised to 520; data-height=\"700\" is 700", byId.c.h === 520 && byId.d.h === 700, J([byId.c, byId.d]));
  ok("four designers on one page, none of them loaded while out of sight", sz.every((s) => s.src === null) && !ctxS.fetched.some((p) => p.startsWith("/c/")), J(sz));
  const bad = await pS.evaluate(() => { const e = document.getElementById("e"); return { text: e.textContent, frame: !!e.querySelector("iframe") }; });
  ok("a wrong company name in the embed code shows a plain sentence, not a broken frame", !bad.frame && /could not be shown/.test(bad.text) && /Bad Id!/.test(bad.text), J(bad));
  await ctxS.close();

  /* 5. phones */
  section("5. On a phone: the page scrolls past until the customer taps");
  const ctxP = await newContext(browser, { viewport: { width: 390, height: 844 }, touch: true, mobile: true });
  const pP = await openPage(ctxP, `${H}/phone.html`);
  const geo0 = await pP.evaluate(() => { const f = document.querySelector("#shed-designer iframe").getBoundingClientRect(); return { w: f.width, h: f.height, top: f.top + scrollY }; });
  ok("on a 390-pixel phone, no height given: the full width, 520 tall", Math.abs(geo0.w - 390) < 1 && Math.abs(geo0.h - 520) < 1, J(geo0));
  await pP.evaluate((t) => window.scrollTo(0, t - 120), geo0.top);
  const fP = await waitDesigner(pP);
  ok("the designer loads on the phone", !!fP);
  if (fP) {
    await pP.evaluate((t) => window.scrollTo(0, t - 120), geo0.top);
    await sleep(500);
    const cover = await fP.evaluate(() => ({ cover: !!document.getElementById("tapcover"), text: (document.getElementById("tapcover") || {}).textContent, ta: getComputedStyle(document.getElementById("stage")).touchAction }));
    ok("a 'Tap to design' cover lies over the building", cover.cover && /Tap to design/i.test(cover.text), J(cover));
    await pP.screenshot({ path: resolvePath(OUT, "embed-phone.png") }); shots.push("test/out/embed-phone.png: the designer on a phone inside a company page, with its Tap to design cover");
    /* a finger on the glass, the way a phone reports it (touch start, a
       dozen moves, touch end) */
    const cdp = await ctxP.newCDPSession(pP);
    const drag = async (x, y, dx, dy) => {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
      for (let i = 1; i <= 12; i++) { await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x + dx * i / 12, y: y + dy * i / 12 }] }); await sleep(16); }
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    };
    const box = await pP.evaluate(() => { const r = document.querySelector("#shed-designer iframe").getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + 140) }; });
    const cam0 = await fP.evaluate(() => ({ yaw: window.shedUI.camera.yaw, pitch: window.shedUI.camera.pitch }));
    const y0 = await pP.evaluate(() => scrollY);
    await drag(box.x, box.y, 0, 220);
    await sleep(600);
    const y1 = await pP.evaluate(() => scrollY);
    const cam1 = await fP.evaluate(() => ({ yaw: window.shedUI.camera.yaw, pitch: window.shedUI.camera.pitch }));
    ok("a finger swiping over the cover scrolls the company's page, and the building does not move", y1 < y0 - 60 && Math.abs(cam1.yaw - cam0.yaw) < 1e-9 && Math.abs(cam1.pitch - cam0.pitch) < 1e-9, J({ y0, y1, cam0, cam1 }));
    await pP.evaluate((t) => window.scrollTo(0, t - 120), geo0.top);
    await sleep(400);
    const box2 = await pP.evaluate(() => { const r = document.querySelector("#shed-designer iframe").getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + 140) }; });
    await pP.touchscreen.tap(box2.x, box2.y);
    await sleep(400);
    const gone = await fP.evaluate(() => !document.getElementById("tapcover"));
    ok("one tap takes the cover away", gone);
    const y2 = await pP.evaluate(() => scrollY);
    const cam2 = await fP.evaluate(() => ({ yaw: window.shedUI.camera.yaw, pitch: window.shedUI.camera.pitch }));
    await drag(box2.x, box2.y, -120, 200);
    await sleep(600);
    const y3 = await pP.evaluate(() => scrollY);
    const cam3 = await fP.evaluate(() => ({ yaw: window.shedUI.camera.yaw, pitch: window.shedUI.camera.pitch }));
    ok("after the tap, the same swipe turns the building and the company's page stays put", Math.abs(y3 - y2) < 2 && (Math.abs(cam3.yaw - cam2.yaw) > 0.01 || Math.abs(cam3.pitch - cam2.pitch) > 0.01), J({ y2, y3, cam2, cam3 }));
    ok("no errors on the phone", realNoise(pP.noise).length === 0, J(realNoise(pP.noise)));
  }
  await ctxP.close();

  /* 6. who may show it */
  section("6. A website that is NOT on the company's list");
  const ctxX = await newContext(browser);
  const pX = await openPage(ctxX, `${X}/lazy.html`);
  await pX.evaluate(() => document.getElementById("shed-designer").scrollIntoView({ block: "center" }));
  await sleep(6000);
  const fX = pX.frames().find((f) => f !== pX.mainFrame() && (/chrome-error/.test(f.url()) || /\/c\/embed-check\//.test(f.url())));
  let xRan = false;
  if (fX) { try { xRan = await fX.evaluate(() => !!window.shedUI); } catch (e) { xRan = false; } }
  const refused = pX.noise.some((m) => /frame-ancestors/.test(m.text));
  ok("the browser refuses to show the designer there (frame-ancestors): an empty frame, the refusal in the console", !xRan && refused && (await events(pX)).length === 0, J({ url: fX && fX.url(), xRan, noise: pX.noise.map((m) => m.text.slice(0, 140)) }));
  await pX.screenshot({ path: resolvePath(OUT, "embed-refused.png") }); shots.push("test/out/embed-refused.png: a website not on the company's list gets an empty frame");
  await ctxX.close();
  const ctxY = await newContext(browser, { headers: false });
  const pY = await openPage(ctxY, `${X}/lazy.html`);
  await pY.evaluate(() => document.getElementById("shed-designer").scrollIntoView({ block: "center" }));
  const fY = await waitDesigner(pY);
  if (fY) {
    await ensureEmbedMode(fY);
    await fY.evaluate(() => document.querySelector("#sw-body .sw:not(.on)").click());
    await sleep(1500);
    const inner = await fY.evaluate(() => ({ allowed: window.shedUI.embed.allowed, parent: window.shedUI.embed.parentOrigin, sent: window.shedUI.embed.sent.length }));
    ok("even with no frame rule at all, the designer tells a page that is not on the list nothing (no ready, no changes)", inner.allowed === false && inner.parent === X && inner.sent === 0 && (await events(pY)).length === 0, J(inner));
  } else ok("the designer loads when no frame rule is sent (to test its own refusal)", false);
  await ctxY.close();

  /* 7. the designer on its own */
  section("7. The designer on its own, under its safety rules");
  const ctxO = await newContext(browser);
  for (const addr of ["/c/embed-check/", "/?company=starter", "/c/starter/?embed=1"]) {
    const p = await openPage(ctxO, D + addr);
    await p.waitForFunction(() => window.shedUI && window.shedUI.ready, null, { timeout: 120000 }).catch(() => null);
    const r = await p.evaluate(() => ({ ready: !!(window.shedUI && window.shedUI.ready), csp: window.__csp, name: (document.getElementById("brand-name") || {}).textContent, fonts: Array.from(document.fonts).filter((f) => f.status === "loaded").map((f) => f.family.replace(/"/g, "")) }));
    ok(`${addr}: starts under its policy with nothing refused, and the self-hosted fonts load`, r.ready && r.csp.length === 0 && realNoise(p.noise).length === 0 && r.fonts.indexOf("Oswald") >= 0 && r.fonts.indexOf("IBM Plex Sans") >= 0, J({ r, noise: realNoise(p.noise) }));
    if (addr === "/c/embed-check/") {
      const lbl = await p.evaluate(() => Array.from(document.querySelectorAll("#card-colors .swrow")).map((row) => { const l = row.querySelector(".lbl").getBoundingClientRect(), n = row.querySelector(".swname").getBoundingClientRect(); return { lbl: row.querySelector(".lbl").textContent, right: l.right, name: n.left }; }));
      ok("the colour rows: every label (SIDING ... SHUTTERS) ends before its colour name begins", lbl.length >= 5 && lbl.every((x) => x.right <= x.name + 0.5), J(lbl));
    }
    await p.close();
  }
  const pOff = await openPage(ctxO, D + "/c/embed-check-off/?embed=1");
  await pOff.waitForSelector("#bootmsg", { timeout: 60000 }).catch(() => null);
  const off = await pOff.evaluate(() => { const b = document.getElementById("bootmsg"); const a = b && b.querySelector("a"); return { text: b ? b.textContent : "", tel: a ? a.getAttribute("href") : null, layout: getComputedStyle(document.getElementById("layout")).display }; });
  ok("a SUSPENDED company: \"This designer is not available -- please call <its phone>\", with the number as a call link, and no designer", /not available/.test(off.text) && /\(555\) 010-0199/.test(off.text) && off.tel === "tel:5550100199" && off.layout === "none", J(off));
  await pOff.close();
  await ctxO.close();

  /* embed-demo.html, the sample company page for demos */
  const ctxM = await newContext(browser, { viewport: { width: 1280, height: 900 } });
  const pM = await openPage(ctxM, D + "/embed-demo.html");
  await pM.evaluate(() => document.getElementById("shed-designer").scrollIntoView({ block: "start" }));
  const fM = await waitDesigner(pM);
  let demoOk = false;
  if (fM) {
    await ensureEmbedMode(fM);
    for (let i = 0; i < 40 && !demoOk; i++) { await sleep(250); demoOk = await pM.evaluate(() => /shed:ready/.test(document.getElementById("log").textContent)); }
  }
  ok("embed-demo.html (the sample company page) shows Cedar Ridge's designer, and its panel lists what the designer said", !!fM && demoOk && realNoise(pM.noise).length === 0, J(realNoise(pM.noise)));
  await pM.evaluate(() => window.scrollTo(0, 0));
  await sleep(300);
  await pM.screenshot({ path: resolvePath(OUT, "embed-demo.png"), fullPage: false }); shots.push("test/out/embed-demo.png: embed-demo.html, the sample company page with the designer and its event panel");
  await ctxM.close();
} catch (e) {
  failures.push("the check itself crashed: " + (e && e.message));
  console.log("  FAIL the check itself crashed:\n       " + (e && e.stack || e));
} finally {
  if (browser) await browser.close();
  await stopAll();
}

console.log("");
if (shots.length) { console.log("Pictures:"); for (const s of shots) console.log("  " + s); }
if (notes.length) { console.log("Notes:"); for (const n of notes) console.log("  - " + n); }
if (failures.length) {
  console.log(`\nFAIL: ${failures.length} of ${passed + failures.length} checks failed:`);
  for (const f of failures) console.log("  - " + f);
  process.exitCode = 1;
} else {
  console.log(`\nPROVED: all ${passed} checks passed -- the designer can sit inside a company's own website: lazy, the right size, full screen, scrolls past on a phone, talks only to that page and only about the building, and only on the websites the company listed.`);
}
