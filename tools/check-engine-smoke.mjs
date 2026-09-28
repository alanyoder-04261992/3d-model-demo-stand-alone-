/* CHECK: the engine really draws, in a real browser, and the building-step
   table really hides and lifts steps.
   Run: node tools/check-engine-smoke.mjs

   Opens tools/engine-smoke.html (a pretend shed made of a few boxes: grey
   siding, a RED door, a BLUE roof, a lawn, skids, a gable, a contact shadow
   and one framing board) in headless Chromium with software WebGL, once with
   Barnwright's shader and once with the true-colour one, and proves:

     * the picture is not blank, and the red door and blue roof are in it;
     * hiding the "doors" step removes every red pixel and nothing else moves;
     * lifting the "roofing" step 3 ft raises the blue roof on the screen while
       the door stays exactly where it was; hiding "roofing" removes it;
     * a hidden step is gone from the SHADOW too: hiding "roofing" gives
       exactly the picture of the building drawn with no roof at all, and the
       Finished view of a building that carries framing is exactly the
       building without it (the shadow pass has its own copy of the table);
     * a rebuild (new buffers, old ones deleted) draws the same picture on its
       very first frame -- Barnwright loses the shadows on that frame;
     * a snapshot of another view comes back as a picture of the right size,
       and the live canvas and camera are left as they were;
     * the render loop draws by itself, re-fits the camera when the canvas
       changes size, waits (without errors) while the canvas is 0 x 0, and
       carries on when it comes back;
     * the true-colour shader is really in use and is less warm;
     * with the repeatable randomness, two separate page loads paint all
       eleven textures and the whole picture IDENTICALLY -- and with ordinary
       randomness they differ, so the comparison means something;
     * no errors or WebGL warnings in the browser console at any point;
     * with WebGL switched off entirely, the page still loads: the canvas is
       swapped for a short note and every drawing call quietly does nothing
       (Barnwright's fallback, so the form and the price keep working).

   Needs this repo served on port 8311 (started here with http-server and
   stopped afterwards). */

import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 8311, BASE = "http://127.0.0.1:" + PORT;

let pass = 0, fail = 0;
const failures = [];
function ok(name, cond, extra) {
  if (cond) { pass++; console.log("  ok   " + name); }
  else { fail++; failures.push(name); console.log("  FAIL " + name + (extra !== undefined ? "\n       " + String(extra).slice(0, 600) : "")); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const servers = [];
async function serve(dir, port, probe) {
  const url = "http://127.0.0.1:" + port + "/" + probe;
  const answers = async () => { try { return (await fetch(url)).ok; } catch { return false; } };
  if (await answers()) return;
  const child = spawn("npx", ["http-server", dir, "-p", String(port), "-s", "-c-1", "-a", "127.0.0.1"], { detached: true, stdio: "ignore" });
  servers.push(child);
  for (let i = 0; i < 150; i++) { if (await answers()) return; await sleep(100); }
  throw new Error("could not serve " + dir + " on port " + port);
}
function stopServers() { for (const c of servers) { try { process.kill(-c.pid, "SIGTERM"); } catch {} } servers.length = 0; }
process.on("exit", stopServers);

const require = createRequire(import.meta.url);
const { chromium } = require("/opt/node22/lib/node_modules/playwright/index.js");

console.log("check-engine-smoke: the engine draws a picture in a real browser\n");
let browser;
const noise = [];
async function open(ctx, query) {
  const page = await ctx.newPage();
  page.on("pageerror", (e) => noise.push(query + " page error: " + e));
  page.on("console", (m) => { if (m.type() === "error" || (m.type() === "warning" && /WebGL|GL_/.test(m.text()))) noise.push(query + " " + m.type() + ": " + m.text()); });
  await page.goto(BASE + "/tools/engine-smoke.html" + query, { waitUntil: "load" });
  await page.waitForFunction(() => window.SMOKE && window.SMOKE.ready, null, { timeout: 60000 });
  return page;
}
try {
  await serve(ROOT, PORT, "tools/engine-smoke.html");
  browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const ctx = await browser.newContext({ viewport: { width: 800, height: 600 }, deviceScaleFactor: 1, reducedMotion: "reduce" });

  const results = {};
  for (const [label, q] of [["Barnwright's shader (FS)", "?true=0"], ["the true-colour shader (FSTRUE)", "?true=1"]]) {
    console.log("\nWith " + label);
    const page = await open(ctx, q);
    const R = await page.evaluate(async () => ({
      tex: SMOKE.texHashes.slice(), shadow: SMOKE.hasShadow(), deriv: SMOKE.extDeriv(),
      all: SMOKE.render(null),
      hideDoors: SMOKE.render({ doors: { hidden: true } }),
      lift: SMOKE.render({ roofing: { lift: 3 } }),
      hideRoof: SMOKE.render({ roofing: { hidden: true } }),
      finished: SMOKE.render(null),
      views: SMOKE.views(),
      absent: SMOKE.absentTest(),
      rebuild: SMOKE.rebuildTest(),
      snap: await SMOKE.snapshotTest(),
      loop: await SMOKE.loopTest(),
    }));
    results[q] = R;
    const A = R.all;
    ok("eleven textures painted; shadows and surface relief available", R.tex.length === 11 && R.shadow && R.deriv, JSON.stringify({ tex: R.tex.length, shadow: R.shadow, deriv: R.deriv }));
    ok("the picture is drawn and not blank (" + A.nonBlank + " of " + A.w * A.h + " pixels)", A.drew && A.nonBlank > 50000);
    ok("the red door (" + A.red + " px) and the blue roof (" + A.blue + " px) are in it", A.red > 2000 && A.blue > 2000);
    ok("hiding the 'doors' step removes every red pixel (" + R.hideDoors.red + " left)", R.hideDoors.red === 0);
    ok("...and nothing else moves (the roof is the same " + R.hideDoors.blue + " px in the same place)", R.hideDoors.blue === A.blue && R.hideDoors.blueTop === A.blueTop && R.hideDoors.nonBlank === A.nonBlank);
    ok("lifting 'roofing' 3 ft raises the roof on screen (its middle from row " + A.blueTop.toFixed(1) + " to " + R.lift.blueTop.toFixed(1) + ")", R.lift.blueTop < A.blueTop - 20);
    ok("...while the door stays exactly where it was (" + R.lift.red + " red px)", R.lift.red === A.red);
    ok("hiding 'roofing' removes the roof (" + R.hideRoof.blue + " blue px left)", R.hideRoof.blue === 0 && R.hideRoof.red === A.red);
    ok("clearing the table brings back exactly the first picture", R.finished.hash === A.hash);
    const V = R.views;
    ok("the Finished view hides the framing board and nothing else (the same picture as hiding just that board)", V.finished.hash !== V.all.hash && V.finished.hash === V.noBoard.hash && V.finished.red === A.red);
    ok("the Framing view hides the finish steps (no door, no roof) but keeps the ground, skids and lumber", V.framing.red === 0 && V.framing.blue === 0 && V.framing.nonBlank > 50000);
    const AB = R.absent;
    ok("a hidden step leaves no shadow behind: 'roofing' hidden is exactly the picture of the building drawn with no roof at all", AB.hideRoof === AB.noRoof && AB.hideRoof !== AB.full, JSON.stringify(AB));
    ok("...and the roof's shadow really is in the picture (" + AB.roofShadow + " px outside the roof change when it goes), so that comparison can fail", AB.roofShadow > 500);
    ok("the Finished view of a building that also carries its framing is exactly the building without the framing (no stud or truss shadow on it)", AB.finished === AB.noFrame, JSON.stringify(AB));
    ok("a rebuild draws the same picture on its very first frame (shadows kept)", R.rebuild.before === R.rebuild.first && R.rebuild.first === R.rebuild.second, JSON.stringify(R.rebuild));
    ok("a snapshot comes back as a " + R.snap.stats.w + "x" + R.snap.stats.h + " PNG with a building in it (" + R.snap.stats.nonBlank + " px)", R.snap.png === "data:image/png;base64," && R.snap.stats.w === 200 && R.snap.stats.h === 150 && R.snap.stats.nonBlank > 5000);
    ok("...and the live canvas (" + R.snap.live.w + "x" + R.snap.live.h + ") and camera are left as they were", R.snap.live.w === 480 && R.snap.live.h === 360 && R.snap.camYaw === 0.62);
    const L = R.loop;
    ok("the render loop draws by itself and fills projCache for picking", L.drewByItself && L.projects);
    ok("a canvas resized to 300x200 is redrawn at that size and the camera re-fitted", L.resized.w === 300 && L.resized.h === 200 && L.resized.fitDist === L.resized.fitWanted, JSON.stringify(L.resized));
    ok("a 0x0 canvas draws nothing and waits to be drawn", L.zeroDraw === false && L.zeroSizeKeptWaiting === true);
    ok("when it comes back, the loop draws it again", L.back.w === 480 && L.back.h === 360 && L.back.needsDraw === false, JSON.stringify(L.back));
    await page.close();
  }

  console.log("\nThe two shaders against each other");
  const fs = results["?true=0"].all, ft = results["?true=1"].all;
  ok("the true-colour shader is really in use (the pictures differ)", fs.hash !== ft.hash);
  ok("and it is less warm: red minus blue averages " + ft.warmth.toFixed(2) + " against " + fs.warmth.toFixed(2), ft.warmth < fs.warmth - 1);
  ok("the building steps work the same under both (same red and hidden-door counts)", fs.red === ft.red && results["?true=1"].hideDoors.red === 0);

  console.log("\nRepeatable textures");
  const again = await open(ctx, "?true=0");
  const R2 = await again.evaluate(() => ({ tex: SMOKE.texHashes.slice(), all: SMOKE.render(null) }));
  await again.close();
  const R1 = results["?true=0"];
  ok("two separate page loads paint all eleven textures identically", R2.tex.length === 11 && R2.tex.every((h, i) => h === R1.tex[i]), JSON.stringify({ first: R1.tex, second: R2.tex }));
  ok("...and draw the identical picture, pixel for pixel", R2.all.hash === R1.all.hash);
  const loose = await open(ctx, "?true=0&seed=0");
  const R3 = await loose.evaluate(() => ({ tex: SMOKE.texHashes.slice(), all: SMOKE.render(null) }));
  await loose.close();
  const differ = R3.tex.filter((h, i) => h !== R1.tex[i]).length;
  ok("control: with ordinary randomness the textures differ (" + differ + " of 11; the three smooth shadow gradients use none)", differ === 8, JSON.stringify(R3.tex));

  ok("no errors and no WebGL warnings in the browser console", noise.length === 0, noise.slice(0, 5).join(" | "));

  console.log("\nA browser with WebGL switched off (older phones, some in-app browsers)");
  const b2 = await chromium.launch({ args: ["--disable-3d-apis"] });
  try {
    const c2 = await b2.newContext({ viewport: { width: 800, height: 600 }, reducedMotion: "reduce" });
    const before = noise.length;
    const p2 = await open(c2, "?true=0&nowebgl");
    const N = await p2.evaluate(() => SMOKE.noWebGL());
    ok("the page still loads and builds the shed (the renderer reports WebGL off)", N.off === true);
    ok("the 3D canvas is hidden and the plain note takes its place", N.canvasHidden && /3D preview isn.t available/.test(N.note || ""), JSON.stringify(N));
    ok("drawing quietly does nothing, and a snapshot says why instead of crashing", N.drew === false && /no WebGL/.test(N.snapErr || ""), JSON.stringify(N));
    ok("no errors in the console without WebGL", noise.length === before, noise.slice(before).join(" | "));
  } finally { await b2.close(); }
} catch (e) {
  ok("the smoke run completed", false, e && e.stack || e);
} finally {
  if (browser) await browser.close();
  stopServers();
}

console.log("\n" + (fail ? "FAILED" : "PASSED") + ": " + pass + " passed, " + fail + " failed.");
if (fail) { console.log("\nWhat failed:\n  " + failures.join("\n  ")); process.exit(1); }
console.log("Proved: the renderer draws a real picture with both shaders, hiding a building step removes exactly its pixels,");
console.log("lifting one raises it, rebuilds, snapshots, resizing and the loop behave, and seeded textures repeat exactly.");
