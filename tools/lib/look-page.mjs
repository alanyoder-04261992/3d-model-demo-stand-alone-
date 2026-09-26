/* OPEN OUR LOOK HARNESS PAGE AND HAVE IT DRAW BUILDINGS (Node side).

   Used by tools/check-look.mjs. In plain words: it serves this repo on a
   local port, opens tools/look.html in headless Chromium with software
   graphics, set up exactly like the browser that recorded Barnwright's
   pictures (a 1440 x 900 window, one device pixel per CSS pixel, "reduce
   motion" on, nothing allowed to leave this machine), hands the page the
   Barnwright company as JSON, and asks it to draw a building. The picture
   comes back as a PNG, which is decoded here to its exact pixels with the
   same decoder the recording used (tools/capture-golden.mjs decodePng).

     const h = await openLook();            // server + browser + page, ready
     await h.useBarnwright();               // the Barnwright company, as JSON
     const pic = await h.draw({ state, ... });  // -> { width, height, rgba, info }
     const ms = await h.rebuildTime({ state, ... });  // a rebuild's cost, per run
     const tex = await h.textures();        // SHA-256 of every uploaded texture
     await h.close();                       // browser and server stopped

   Only this repo is served, read only. Ports 8360 (the web server) and 8361
   (kept free for a second page server if one is ever needed) belong to the
   look check. */

import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { decodePng } from "../capture-golden.mjs";
import { barnwrightCompany } from "./barnwright-company.mjs";
import { readManufacturer, readJSON } from "./load.mjs";

const require = createRequire(import.meta.url);
export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const PORT = 8360;
export const SPARE_PORT = 8361;
export const VIEWPORT = Object.freeze({ width: 1440, height: 900 });
export const DEVICE_SCALE_FACTOR = 1;
export const CHROMIUM_ARGS = Object.freeze(["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]);
/* the address the page fetches the Barnwright company from; answered by this file, never on disk */
export const BARNWRIGHT_JSON_PATH = "/tools/look-data/barnwright.json";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function answers(url) {
  try { const r = await fetch(url, { cache: "no-store" }); return r.ok ? await r.text() : null; } catch { return null; }
}

/* Serve this repo on our port. Something already answering there is only
   reused when it serves THIS repo's harness page, byte for byte. */
export async function startServer(port = PORT) {
  const url = `http://127.0.0.1:${port}/`;
  const mine = readFileSync(resolve(ROOT, "tools/look.html"), "utf8");
  const already = await answers(url + "tools/look.html");
  if (already != null) {
    if (already !== mine) throw new Error(`Something else is answering on port ${port}: stop it (the look check uses ports ${PORT} and ${SPARE_PORT}).`);
    return { url, reused: true, stop: async () => {} };
  }
  const child = spawn("npx", ["http-server", ROOT, "-p", String(port), "-a", "127.0.0.1", "-s", "-c-1"], { stdio: "ignore", detached: true });
  let dead = false;
  child.on("exit", () => { dead = true; });
  for (let i = 0; ; i++) {
    if (dead) throw new Error(`The web server on port ${port} did not start (is the port taken?).`);
    const got = await answers(url + "tools/look.html");
    if (got != null) break;
    if (i > 300) throw new Error(`The web server on port ${port} never answered.`);
    await sleep(100);
  }
  return {
    url, reused: false,
    stop: async () => { try { process.kill(-child.pid, "SIGTERM"); } catch { /* already gone */ } await sleep(50); },
  };
}

export function loadPlaywright() {
  return require("/opt/node22/lib/node_modules/playwright/index.js");
}

/* The Barnwright company as the page receives it: the company object (built
   from test/golden/barnwright-catalogue.json), the standard manufacturer file
   and the construction defaults -- the same three things tools/lib/
   barnwright-company.mjs resolves for the Node checks. */
export function barnwrightJSON() {
  return JSON.stringify({
    company: barnwrightCompany(),
    manufacturer: readManufacturer("standard"),
    library: readJSON("library/construction.json"),
  });
}

/* A PNG data: URL from the page -> { width, height, rgba } (exact pixels). */
export function pixelsOf(dataUrl) {
  const buf = Buffer.from(String(dataUrl).replace(/^data:image\/png;base64,/, ""), "base64");
  return decodePng(buf);
}

export async function openLook() {
  const server = await startServer(PORT);
  const { chromium } = loadPlaywright();
  let browser;
  try {
    browser = await chromium.launch({ args: [...CHROMIUM_ARGS] });
  } catch (e) {
    await server.stop();
    throw e;
  }
  const context = await browser.newContext({
    viewport: { ...VIEWPORT }, deviceScaleFactor: DEVICE_SCALE_FACTOR, reducedMotion: "reduce", serviceWorkers: "block",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String((e && e.message) || e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
  const origin = server.url.replace(/\/$/, "");
  const served = barnwrightJSON();
  await page.route("**/*", (route) => {
    const u = route.request().url();
    if (!u.startsWith(origin + "/")) return route.abort();            /* nothing leaves this machine */
    if (new URL(u).pathname === BARNWRIGHT_JSON_PATH) return route.fulfill({ status: 200, contentType: "application/json", body: served });
    return route.continue();
  });
  await page.goto(origin + "/tools/look.html", { waitUntil: "load" });
  await page.waitForFunction(() => window.look && window.look.ready, null, { timeout: 60000 });
  return {
    page, errors, server,
    async useBarnwright() {
      return page.evaluate((url) => window.look.loadServed("barnwright", url), BARNWRIGHT_JSON_PATH);
    },
    async useCompany(id) {
      return page.evaluate((cid) => window.look.loadCompany(cid), id);
    },
    async defaultState(name) {
      return page.evaluate((n) => window.look.defaultState(n), name);
    },
    /* draw one building; the picture comes back decoded */
    async draw(opts) {
      const info = await page.evaluate((o) => window.look.draw(o), opts);
      const img = pixelsOf(info.png);
      delete info.png;
      return { width: img.width, height: img.height, rgba: img.rgba, info };
    },
    /* milliseconds per Finished-view rebuild (plan + assemble + upload), one per run */
    async rebuildTime(opts) {
      return page.evaluate((o) => window.look.rebuildTime(o), opts);
    },
    async textures() {
      return page.evaluate(() => window.look.textures());
    },
    async close() {
      try { await browser.close(); } catch { /* ignore */ }
      await server.stop();
    },
  };
}
