/* CHECK: THE DEALER CENTER'S "TRY IT" DEMO, AND WHO GETS IT.
   Run: node tools/check-dealer-demo.mjs   (check-all: node)

   The demo (/dealer?demo, ui/office/demo.js) runs the Dealer Center's real
   server code inside the page on a made-up business. This proves, without a
   browser:
     * it starts from the sample business and never calls the internet: the
       only files it asks this site for are the builder's library and the two
       example price lists;
     * signing in as the owner, a price change saved in the demo reaches
       every lot's price list, and a dealer sees only their own lot;
     * reloading the tab keeps what was done, "Start over" throws it away,
       and the example files it started from are not changed;
     * only Alan's learning preview and his demo site (or a build run with
       DEALER_DEMO=true) offer it: those builds ship the demo's own file and
       the "leave both boxes empty" sign-in, and the demo site has no lesson
       pages; a client build (npm run build:client) ships neither, even on
       the learning site.

   The browser side (the banner, signing in as anyone, 0 calls to a real
   server) is in tools/check-dealer-center.mjs. */

import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { learningSiteId, demoSiteId } from "./site-profiles.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const STATIC = ["/library/manufacturers/standard.json", "/library/construction.json", "/companies/demo/company.json", "/companies/starter/company.json"];
const before = Object.fromEntries(STATIC.map((p) => [p, readFileSync(resolve(ROOT, "." + p), "utf8")]));

/* a browser tab, as far as demo.js needs one */
const saved = new Map();
const asked = [];
let reloads = 0;
globalThis.sessionStorage = {
  getItem: (k) => (saved.has(k) ? saved.get(k) : null),
  setItem: (k, v) => { saved.set(k, String(v)); },
  removeItem: (k) => { saved.delete(k); },
};
globalThis.location = { origin: "https://demo.test", href: "https://demo.test/dealer?demo", reload: () => { reloads++; } };
globalThis.window = globalThis;
const siteFetch = async (input) => {
  const url = new URL(typeof input === "string" ? input : input.url, location.href);
  asked.push(url.href);
  if (url.origin === location.origin && STATIC.includes(url.pathname)) return new Response(before[url.pathname], { headers: { "content-type": "application/json" } });
  throw new Error("The demo asked for something it should never need: " + url.href);
};
globalThis.fetch = siteFetch;

const { startDemo, demoStartOver } = await import("../ui/office/demo.js");

let passed = 0;
async function check(name, work) {
  await work();
  passed++;
  console.log("  ok   " + name);
}
const call = async (method, path, body) => {
  const r = await window.fetch(path, { method, headers: body ? { "content-type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  return { status: r.status, data: text ? JSON.parse(text) : null };
};
const signIn = async (email) => assert.equal((await call("POST", "/__local/sign-in", { email })).status, 204);

console.log("The Dealer Center's \"try it\" demo:");
const t0 = Date.now();
await startDemo();
const startSecs = (Date.now() - t0) / 1000;
let price = 0;

await check("it starts from the sample business (3 lots, 5 people, 30 customers) and only reads the builder's library and the example price lists", async () => {
  assert.deepEqual([...new Set(asked.map((u) => new URL(u).pathname))].sort(), [...STATIC].sort());
  const people = (await call("GET", "/__local/people")).data.people;
  assert.equal(people.length, 5);
  await signIn("chris@samplebarns.example");
  const me = (await call("GET", "/api/office/me")).data;
  assert.equal(me.person.role, "owner");
  assert.equal(me.business.name, "Sample Storage Barns");
  assert.deepEqual(me.lots.map((l) => l.slug).sort(), ["brookside", "riverside", "springfield"]);
  assert.equal((await call("GET", "/api/office/customers")).data.rows.length, 30);
  assert.ok(startSecs < 20, `started in ${startSecs.toFixed(1)} s`);
});

await check("the owner's price change, saved in the demo, shows on every lot's price list", async () => {
  const pl = (await call("GET", "/api/office/price-list")).data;
  const settings = structuredClone(pl.settings);
  price = settings.offer.UT.sizes["10x16"] + 135;
  settings.offer.UT.sizes["10x16"] = price;
  const r = await call("PUT", "/api/office/price-list", { settings, version: pl.version });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  for (const slug of ["riverside", "springfield", "brookside"]) {
    const lot = await call("GET", `/api/lots/${slug}`);
    assert.equal(lot.status, 200);
    assert.equal(lot.data.company.offer.UT.sizes["10x16"], price, slug);
  }
});

await check("a dealer in the demo sees only their own lot's customers, and cannot change prices", async () => {
  await signIn("mike@samplebarns.example");
  const list = (await call("GET", "/api/office/customers")).data.rows;
  assert.ok(list.length > 0 && list.every((c) => c.lot === "riverside"));
  const pl = (await call("GET", "/api/office/price-list")).data;
  assert.equal((await call("PUT", "/api/office/price-list", { settings: pl.settings, version: pl.version })).status, 403);
});

await check("reloading the tab keeps what was done; \"Start over\" throws it away; the example files are untouched", async () => {
  window.fetch = siteFetch;
  await startDemo();
  await signIn("chris@samplebarns.example");
  assert.equal((await call("GET", "/api/lots/brookside")).data.company.offer.UT.sizes["10x16"], price);
  demoStartOver();
  assert.equal(reloads, 1);
  assert.equal(saved.size, 0);
  window.fetch = siteFetch;
  await startDemo();
  await signIn("chris@samplebarns.example");
  assert.notEqual((await call("GET", "/api/lots/brookside")).data.company.offer.UT.sizes["10x16"], price);
  for (const p of STATIC) assert.equal(readFileSync(resolve(ROOT, "." + p), "utf8"), before[p], p);
  assert.ok(asked.every((u) => STATIC.includes(new URL(u).pathname)), "nothing else was asked for");
});

const ENTRY = "Leave both boxes empty and tap Sign in";
/* a site's build settings, with none of this computer's own mixed in */
const siteEnv = (settings) => {
  const env = { ...process.env };
  for (const name of ["SITE_ID", "INCLUDE_LEARNING_PREVIEW", "DEALER_DEMO"]) delete env[name];
  return { ...env, ...settings };
};
const LEARNING_SITE = { SITE_ID: learningSiteId, INCLUDE_LEARNING_PREVIEW: "true" };
const LESSONS = ["learn.html", "parts.html", "setup.html", "ui/learn.js", "ui/learn.css", "images", "companies/learning-side-loft"];
const BUILDS = [
  { what: "Alan's learning preview offers the demo: its own file and the empty-boxes sign-in", env: LEARNING_SITE, demo: true, lessons: true },
  { what: "his demo site offers it too, and has no lesson pages", env: { SITE_ID: demoSiteId }, demo: true, lessons: false },
  { what: "so does any build run with DEALER_DEMO=true", env: { SITE_ID: "another-site", DEALER_DEMO: "true" }, demo: true, lessons: false },
  { what: "a client build (npm run build:client), even on the learning site with DEALER_DEMO=true, leaves the demo out: no demo file and no empty-boxes sign-in",
    env: { ...LEARNING_SITE, DEALER_DEMO: "true" }, client: true, demo: false, lessons: false },
];
for (const b of BUILDS) {
  await check(b.what, async () => {
    const build = spawnSync(process.execPath, ["tools/build-site.mjs", ...(b.client ? ["--client"] : [])], {
      cwd: ROOT, encoding: "utf8", timeout: 180000, env: siteEnv(b.env),
    });
    assert.equal(build.status, 0, build.stdout + build.stderr);
    const out = resolve(ROOT, b.client ? "dist-client" : "dist");
    const main = readFileSync(resolve(out, "ui/office/main.js"), "utf8");
    assert.equal(existsSync(resolve(out, "ui/office/demo.js")), b.demo, "ui/office/demo.js");
    assert.equal(main.includes(ENTRY), b.demo, "the empty-boxes sign-in");
    assert.equal(main.includes("/ui/office/demo.js"), b.demo, "the way to load the demo");
    assert.ok(!main.includes("__DEALER_DEMO__"), "the build answered __DEALER_DEMO__");
    assert.ok(!/MemoryBlobs|website-requests\//.test(main), "the screens never carry the demo's copy of the server");
    assert.deepEqual(LESSONS.filter((path) => existsSync(resolve(out, path))), b.lessons ? LESSONS : [], "the lesson pages");
  });
}

console.log(`PROVED (${passed} checks): the "try it" demo runs the real Dealer Center on the sample business with nothing sent anywhere, a saved price reaches all 3 lots, a dealer sees only their lot, a reload keeps the work and Start over clears it; only the learning preview and the demo site (no lesson pages there) offer it, and a client build leaves out both the demo file and the empty-boxes sign-in.`);
