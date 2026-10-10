/* OPEN BARNWRIGHT'S OWN 3D DESIGNER, UNTOUCHED, SO A CHECK CAN ASK IT QUESTIONS.

   The checks in this repo prove our rules against Barnwright's by asking
   Barnwright's page directly: "what doors does a 12x24 Garage come with?",
   "what does this building cost?". This file starts a small web server over
   Barnwright's public/ folder (READ ONLY -- nothing here writes a byte there),
   opens 3ddesign.html in a headless Chromium with software WebGL, waits until
   its functions exist, and hands back helpers to run code inside it.

   Rules it keeps:
   - Port 8302 is this tool's port (the model agent's). Pass another only if a
     caller owns it.
   - Every request that is not to our local server is refused, and Barnwright's
     boot-time loads (its office prices, colours, extras, which live in its own
     database) are refused too, so the page answers with its built-in tables
     every time.
   - reducedMotion "reduce" and a fixed 1440x900 window, so nothing depends on
     the machine it runs on.

   Use:
     const bw = await openBarnwright();
     const r = await bw.evaluate(() => includedItems("UT", 10, 20));
     await bw.close();                                                    */

import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { BARNWRIGHT_PAGE } from "./barnwright-blocks.mjs";

const require = createRequire(import.meta.url);

export const BARNWRIGHT_PUBLIC = "/home/user/boisterous-lokum-a737e0/public";
export const BARNWRIGHT_FILE = BARNWRIGHT_PUBLIC + "/3ddesign.html";
export const DEFAULT_PORT = 8302;

/* The browser flags every browser check in this repo uses: software WebGL. */
export const CHROMIUM_ARGS = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"];

export function loadPlaywright() {
  return require("/opt/node22/lib/node_modules/playwright/index.js");
}

/* The SHA-256 of Barnwright's designer file as it is on disk right now. */
export function barnwrightSha256() {
  return createHash("sha256").update(readFileSync(BARNWRIGHT_FILE)).digest("hex");
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function answers(url) {
  try {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) return null;
    return await r.text();
  } catch (e) {
    return null;
  }
}

/* Start `npx http-server <dir> -p <port> -s -c-1` unless something on that
   port is already serving the same folder (a previous run left it up). */
export async function serveFolder(dir, port, probePath) {
  const probe = `http://127.0.0.1:${port}/${probePath}`;
  const already = await answers(probe);
  if (already != null) return { url: `http://127.0.0.1:${port}/`, stop: async () => {} , reused: true };
  const child = spawn("npx", ["http-server", dir, "-p", String(port), "-a", "127.0.0.1", "-s", "-c-1"], {
    stdio: "ignore",
    detached: true,
  });
  let dead = false;
  child.on("exit", () => { dead = true; });
  for (let i = 0; i < 200; i++) {
    if (dead) throw new Error(`The little web server on port ${port} did not start (is the port taken by something else?).`);
    if ((await answers(probe)) != null) break;
    await sleep(100);
    if (i === 199) throw new Error(`The web server on port ${port} never answered ${probe}.`);
  }
  return {
    url: `http://127.0.0.1:${port}/`,
    reused: false,
    stop: async () => {
      try { process.kill(-child.pid, "SIGTERM"); } catch (e) { /* already gone */ }
      await sleep(50);
    },
  };
}

/* Open Barnwright's page and wait for its globals. */
export async function openBarnwright(opts = {}) {
  const port = opts.port || DEFAULT_PORT;
  const viewport = opts.viewport || { width: 1440, height: 900 };
  const server = await serveFolder(BARNWRIGHT_PUBLIC, port, "3ddesign.html");
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ args: CHROMIUM_ARGS });
  const context = await browser.newContext({ viewport, reducedMotion: "reduce", deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e && e.message || e)));
  const origin = `http://127.0.0.1:${port}`;
  await page.route("**/*", (route) => {
    const u = route.request().url();
    /* nothing leaves this machine, and Barnwright's database loads are refused
       so its built-in tables are what we read */
    if (!u.startsWith(origin + "/")) return route.abort();
    if (/shedline-[a-z]+\.json|designs(-img)?\/|\.netlify\/functions/.test(u)) return route.abort();
    return route.continue();
  });
  await page.goto(origin + "/" + BARNWRIGHT_PAGE, { waitUntil: "load" });   /* its warm light (barnwright-blocks.mjs) */
  await page.waitForFunction(() =>
    typeof includedItems === "function" && typeof clampPos === "function" &&
    typeof priceParts === "function" && typeof buildShed === "function" &&
    typeof wallDefs === "function" && typeof roofProfile === "function" &&
    window.state && Array.isArray(state.items) && state.items.length > 0 &&
    typeof TYPES === "object" && typeof CAT === "object",
    null, { timeout: 60000 });

  return {
    page,
    browser,
    errors,
    sha256: barnwrightSha256(),
    /* run a function inside Barnwright's page; arg must be JSON-able */
    evaluate(fn, arg) { return page.evaluate(fn, arg); },
    /* set fields on Barnwright's live `state` object (never replace it), then
       call one of its global functions by name and return a JSON copy */
    async call(stateFields, fnName, ...args) {
      return page.evaluate(([sf, name, a]) => {
        if (sf) for (const k of Object.keys(sf)) state[k] = JSON.parse(JSON.stringify(sf[k]));
        const r = window[name].apply(null, a);
        return r === undefined ? null : JSON.parse(JSON.stringify(r));
      }, [stateFields || null, fnName, args]);
    },
    async close() {
      try { await browser.close(); } catch (e) { /* ignore */ }
      await server.stop();
    },
  };
}
