/* CHECK: A LOT'S 3D DESIGNER LINK (/d/<lot>/) AND THE CUSTOMER BUILD.
   Uses fetch mocks and Node; no browser and nothing is really sent.
   Run: node tools/check-managed-client.mjs [--skip-build]
   --skip-build leaves out the build (the last check) while the Dealer
   Center's files are being written.
   check-all: node

   It proves:
   * a lot's link loads the business's price list from the Dealer Center
     (api/lots/<lot>), with the lot's phone, email and websites, and sends
     quotes to api/lots/<lot>/quote-requests; it never falls back to a
     company file, not even with ?company=demo in the address;
   * when the lot cannot open, the customer sees "Our 3D designer isn't open
     right now" (closed) or "couldn't open just now", with the lot's phone
     when it is known -- never a settings problem, a code or "demo";
   * sentences name the business ("Yoder Storage Barns"), never the header's
     "<Business> — <Lot>";
   * sending twice makes one quote (the same one-time key, never the
     customer's details in storage);
   * the receipt reads "Your quote number is #1042." and, when the server's
     total is not the page's, "Today's price for this building is $X.";
   * the server's own sentence is shown for a 4xx; a 5xx, an unreadable
     answer, no connection or no answer in time get plain words without
     "your dealer", "request", "submission" or "timed out";
   * a 409 "no longer offered" offers a Refresh that puts the building in
     the address (#d=...) first, so the refresh keeps it;
   * embed.js with a wrong data-lot says so (on the page and in the console)
     and never falls back to data-company;
   * the customer build ships index.html, dealer.html, the Dealer Center's
     one bundled script and its stylesheets (closed.css too), with the
     Dealer Center's security policy in _headers, and nothing from server/,
     tools/, docs, lessons, skills, or any source map. */
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { existsSync, readdirSync } from "node:fs";
import { dirname, resolve, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { runInNewContext } from "node:vm";
import { loadLot } from "../ui/load.js";
import { submitManagedOrder, addressWithDesign, reloadWithDesign, WORDS } from "../ui/managed-order.js";
import { receiptWords } from "../ui/quote.js";
import { designLink, businessName, priceNote } from "../ui/share.js";
import { defaults, fromState, decode } from "../model/design.js";
import { OFFICE_POLICY } from "../server/office/pages.js";
import { inlineScriptHashes } from "./build-headers.mjs";
import { includeLearningPreview, learningSiteId } from "./site-profiles.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = "https://designer.example/product/";
const read = path => readFile(resolve(ROOT, path), "utf8");
const company = JSON.parse(await read("companies/demo/company.json"));
const manufacturer = JSON.parse(await read(`library/manufacturers/${company.manufacturer}.json`));
const library = JSON.parse(await read("library/construction.json"));
const lot = { id: "port-charlotte", slug: "port-charlotte", name: "Port Charlotte", phone: "(941) 555-0140", email: "lot@example.test", website: "https://dealer.example/", embedOrigins: ["https://dealer.example", "https://www.dealer.example"] };
const data = { company, lot, version: 7 };
/* words a customer on a lot's link must never read in our own sentences */
const NOT_FOR_CUSTOMERS = /your dealer|\brequest\b|submission|timed out|inbox|demo|\bJSON\b/i;
let checks = 0;
const failures = [];
async function check(name, fn) {
  try { await fn(); checks++; console.log("  ok   " + name); }
  catch (error) { failures.push(name); console.error("  FAIL " + name + "\n       " + (error.stack || error)); }
}
const originals = Object.fromEntries(["fetch", "sessionStorage", "document", "window", "location"].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
function mock(name, value) { Object.defineProperty(globalThis, name, { configurable: true, writable: true, value }); }
function json(value, status = 200) { return new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } }); }
function lotFetch(status = 200, override = data) {
  const calls = [];
  mock("fetch", async url => {
    const address = new URL(url); calls.push(address.href);
    if (address.href === BASE + "api/lots/port-charlotte") return json(status === 200 ? override : { error: "This designer link is not open right now." }, status);
    if (address.href === BASE + `library/manufacturers/${company.manufacturer}.json`) return json(manufacturer);
    if (address.href === BASE + "library/construction.json") return json(library);
    throw new Error("Unexpected request: " + address.href);
  });
  return calls;
}

/* Start the real designer page (ui/app.js) on a lot's link with a pretend
   page; -> the boot message's HTML ("" when none) and what was fetched. */
let bootRun = 0;
async function bootOnLot(fetchFn) {
  const calls = [], elements = [];
  const layout = { style: {} };
  mock("location", { pathname: "/d/port-charlotte/", search: "?company=demo", hash: "" });
  mock("window", {});
  mock("document", { body: { classList: { add() {} }, appendChild: element => elements.push(element) }, getElementById: id => id === "layout" ? layout : null, createElement: () => ({}) });
  mock("fetch", async (url, options) => { calls.push(String(url)); return fetchFn(new URL(url, "https://designer.example/"), options); });
  const log = console.error; console.error = () => {};
  let started;
  try {
    const app = await import(pathToFileURL(resolve(ROOT, "ui/app.js")).href + "?lot-boot-" + (++bootRun));
    started = await app.started;
  } finally { console.error = log; }
  const box = elements.find(element => element.id === "bootmsg");
  return { started, calls, html: box ? box.innerHTML : "", hidden: layout.style.display === "none", shedUI: window.shedUI };
}

let catalogue;
try {
  await check("only the established learning site opts in, and client packaging always overrides it", async () => {
    assert.equal(includeLearningPreview({ env: {} }), false);
    assert.equal(includeLearningPreview({ env: { SITE_ID: "new-customer-site" } }), false);
    assert.equal(includeLearningPreview({ env: { SITE_ID: learningSiteId } }), true);
    assert.equal(includeLearningPreview({ env: { INCLUDE_LEARNING_PREVIEW: "true" } }), true);
    assert.equal(includeLearningPreview({ env: { SITE_ID: learningSiteId, INCLUDE_LEARNING_PREVIEW: "false" } }), false);
    assert.equal(includeLearningPreview({ client: true, env: { SITE_ID: learningSiteId, INCLUDE_LEARNING_PREVIEW: "true" } }), false);
  });
  await check("a lot's link loads the price list from the Dealer Center with the lot's phone, email and websites, and sends quotes to quote-requests", async () => {
    const calls = lotFetch();
    const result = await loadLot("port-charlotte", { base: BASE });
    assert.deepEqual(result.problems, []); catalogue = result.catalogue;
    assert.equal(catalogue.id, company.id);
    assert.equal(catalogue.brand.name, `${company.brand.name} — Port Charlotte`, "the header says <Business> — <Lot>");
    assert.equal(catalogue.brand.phone, lot.phone); assert.equal(catalogue.brand.email, lot.email);
    assert.equal(catalogue.leads.mode, "managed"); assert.equal(catalogue.leads.images, false);
    assert.deepEqual(catalogue.embed.origins, lot.embedOrigins);
    assert.equal(catalogue.embed.shareUrl, BASE + "d/port-charlotte/");
    assert.deepEqual(catalogue.managed, {
      slug: "port-charlotte", lotId: lot.id, lotName: "Port Charlotte", lotPhone: lot.phone,
      businessName: company.brand.name, companyId: company.id, version: 7,
      quoteUrl: BASE + "api/lots/port-charlotte/quote-requests",
    });
    assert.equal(calls.length, 3); assert.ok(!calls.some(url => url.includes("companies/")));
  });
  await check("sentences name the business, never \"<Business> — <Lot>\" in the middle of a sentence", async () => {
    assert.ok(catalogue);
    assert.equal(businessName(catalogue), company.brand.name);
    const note = priceNote({ priced: { total: 1.5, at: "2026-01-15" } }, 2.5, catalogue);
    assert.match(note, new RegExp(`contact ${company.brand.name} at \\(941\\) 555-0140 for today's price`));
    assert.ok(!note.includes("— Port Charlotte"), note);
    assert.equal(businessName({ brand: { name: "Acme Sheds" } }), "Acme Sheds", "a company's own link keeps its name");
  });
  await check("shared designs keep their lot link, the building and the look-only option", async () => {
    assert.ok(catalogue);
    const state = defaults(catalogue);
    const link = await designLink({ getCatalogue: () => catalogue, getDesign: options => fromState(state, catalogue, options) }, { view: true, href: "https://unrelated.example/?company=starter" });
    const url = new URL(link);
    assert.equal(url.origin + url.pathname, BASE + "d/port-charlotte/");
    assert.match(url.hash, /&view=1$/);
    const design = await decode(url.hash);
    assert.equal(design.company, company.id); assert.equal(design.type, state.type); assert.equal(design.size, state.size);
  });
  await check("a lot's form always asks for a name and at least one way to reach the customer", async () => {
    for (const fields of [
      { name: "off", phone: "off", email: "off" },
      { name: "optional", phone: "required", email: "off" },
      { name: "off", phone: "off", email: "optional" },
    ]) {
      const settings = structuredClone(company);
      settings.leads = { ...settings.leads, fields: { ...settings.leads.fields, ...fields } };
      lotFetch(200, { ...data, company: settings });
      const result = await loadLot("port-charlotte", { base: BASE });
      assert.deepEqual(result.problems, []);
      assert.equal(result.catalogue.leads.fields.name, "required");
      assert.equal(result.catalogue.leads.fields.phone, fields.phone);
      assert.equal(result.catalogue.leads.fields.email, fields.phone === "off" && fields.email === "off" ? "required" : fields.email);
      assert.equal(result.company.leads.fields.name, fields.name, "the form's rules must not change the stored price list");
    }
  });
  await check("a closed or broken lot never falls back to a company file, and the error keeps the server's answer code", async () => {
    for (const status of [404, 403, 503]) {
      const calls = lotFetch(status);
      await assert.rejects(loadLot("port-charlotte", { base: BASE }), (e) => e.status === status && new RegExp(String(status)).test(e.message));
      assert.deepEqual(calls, [BASE + "api/lots/port-charlotte"]);
    }
  });
  await check("a wrong lot name fails before anything is fetched", async () => {
    const calls = lotFetch();
    await assert.rejects(loadLot("../demo", { base: BASE }), /not allowed/); assert.equal(calls.length, 0);
  });
  await check("the real designer page on a lot's link: a closed lot says \"Our 3D designer isn't open right now\", never a code or \"demo\", even with ?company=demo", async () => {
    const r = await bootOnLot(() => json({ error: "This designer link is not open right now." }, 404));
    assert.equal(r.started, null);
    assert.equal(r.calls.length, 1); assert.match(r.calls[0], /api\/lots\/port-charlotte$/);
    assert.ok(r.hidden, "the designer is hidden");
    assert.match(r.html, /Our 3D designer isn&#39;t open right now/);
    assert.match(r.html, /Please check back soon\./);
    assert.ok(!/404|api\/lots|demo|settings|could not load/i.test(r.html), r.html);
    assert.equal(r.shedUI, undefined);
  });
  await check("...no answer or a server problem says \"couldn't open just now\" (try again), never the reason", async () => {
    for (const answer of [() => json({ error: "Something went wrong on our end. Try again in a minute." }, 503), () => { throw new TypeError("Failed to fetch"); }]) {
      const r = await bootOnLot(answer);
      assert.equal(r.started, null);
      assert.match(r.html, /Our 3D designer couldn&#39;t open just now/);
      assert.match(r.html, /Please try again in a minute\./);
      assert.ok(!/503|api\/lots|demo|settings|connection\?|Failed to fetch/i.test(r.html), r.html);
    }
  });
  await check("...a price list with a problem shows the lot's phone as a call link, never the list of problems", async () => {
    const broken = structuredClone(company);
    broken.pricing = { ...broken.pricing, show: "everything" };
    const r = await bootOnLot((url) => {
      if (url.pathname.endsWith("/api/lots/port-charlotte")) return json({ ...data, company: broken });
      if (url.pathname.endsWith(`library/manufacturers/${company.manufacturer}.json`)) return json(manufacturer);
      if (url.pathname.endsWith("library/construction.json")) return json(library);
      throw new Error("Unexpected request: " + url.href);
    });
    assert.equal(r.started, null);
    assert.match(r.html, /couldn&#39;t open just now/);
    assert.match(r.html, /Call us at <a href="tel:9415550140">\(941\) 555-0140<\/a>\./);
    assert.ok(!/pricing\.show|problem|settings|demo/i.test(r.html), r.html);
  });

  const managed = { slug: "port-charlotte", version: 7, quoteUrl: BASE + "api/lots/port-charlotte/quote-requests" };
  const design = { v: 1, company: "demo", type: "UT", size: "10x16" };
  const contact = { name: "Client Test", email: "customer@example.test", phone: "5550102000" };
  const receipt = { id: "q8d2k4m1x9", number: 1042, total: 5540, price: [["10×16 Utility Shed", 5540]], receivedAt: "2026-10-03T14:00:00.000Z", repriced: false };
  async function retries(storage, marker) {
    const posts = [];
    mock("sessionStorage", storage);
    mock("fetch", async (url, options) => {
      posts.push({ url, options, body: JSON.parse(options.body) });
      if (posts.length === 1) throw new TypeError("network disconnected after server accepted");
      return json(receipt, 201);
    });
    const c = { ...contact, note: marker };
    const first = await submitManagedOrder(managed, design, c);
    const second = await submitManagedOrder(managed, design, c);
    assert.equal(first.ok, false); assert.equal(first.kind, "offline"); assert.equal(second.ok, true);
    assert.deepEqual(second.receipt, receipt);
    assert.equal(posts[0].body.idempotencyKey, posts[1].body.idempotencyKey);
    assert.match(posts[0].body.idempotencyKey, /^[0-9a-f-]{36}$/i);
    assert.equal(posts[0].url, BASE + "api/lots/port-charlotte/quote-requests"); assert.equal(posts[0].options.credentials, "omit");
    assert.deepEqual(posts[0].body.design, design); assert.deepEqual(posts[0].body.contact, c); assert.equal(posts[0].body.version, 7);
    assert.deepEqual(Object.keys(posts[0].body).sort(), ["contact", "design", "idempotencyKey", "version"]);
  }
  await check("a lost answer is sent again with the same one-time key when storage reads are blocked (a frame)", async () => {
    await retries({ getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } }, "read denied");
  });
  await check("...and when storage is full", async () => {
    await retries({ getItem() { return null; }, setItem() { throw new Error("quota"); } }, "write denied");
  });
  await check("the kept key is only a fingerprint and a random key, never the customer's details", async () => {
    const storage = new Map();
    await retries({ getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) }, "persisted");
    assert.equal(storage.size, 1);
    for (const [key, value] of storage) { assert.match(key, /^shed-order:port-charlotte:[0-9a-f]{64}$/); assert.match(value, /^[0-9a-f-]{36}$/i); }
  });
  await check("a changed design gets a different key while the same send keeps it", async () => {
    mock("sessionStorage", { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } });
    const keys = [];
    mock("fetch", async (_, options) => { keys.push(JSON.parse(options.body).idempotencyKey); return json(receipt, 201); });
    await submitManagedOrder(managed, design, contact);
    await submitManagedOrder(managed, design, contact);
    await submitManagedOrder(managed, { ...design, size: "12x16" }, contact);
    assert.equal(keys[0], keys[1]); assert.notEqual(keys[0], keys[2]);
  });
  await check("a page opened before the change (orderUrl only) still sends", async () => {
    const urls = [];
    mock("fetch", async (url) => { urls.push(url); return json(receipt, 201); });
    const r = await submitManagedOrder({ slug: "port-charlotte", version: 7, orderUrl: BASE + "api/lots/port-charlotte/orders" }, design, { ...contact, note: "old page" });
    assert.equal(r.ok, true); assert.deepEqual(urls, [BASE + "api/lots/port-charlotte/orders"]);
  });
  await check("the server's own sentences reach the customer for a 4xx; a 409 that asks for a refresh is marked for the Refresh button", async () => {
    const notOffered = "Something in this building is no longer offered. Refresh the page to see today's options, then send it again.";
    for (const [status, error, kind] of [
      [422, "Please add a phone number or an email address so we can reach you.", "answer"],
      [429, "Too many quote requests from here right now. Please call the lot, or try again in a few minutes.", "answer"],
      [404, "This designer link is not open right now.", "answer"],
      [409, "Your request is already on its way. Wait a moment, then check for the confirmation.", "answer"],
      [409, notOffered, "refresh"],
    ]) {
      mock("fetch", async () => json({ error }, status));
      assert.deepEqual(await submitManagedOrder(managed, design, contact), { ok: false, why: error, kind, code: status });
    }
  });
  await check("a 5xx, an answer that cannot be read, or a success without a receipt get plain words, never the server's", async () => {
    for (const answer of [
      () => json({ error: "Something went wrong on our end. Try again in a minute." }, 503),
      () => new Response("Gateway error", { status: 502 }),
      () => new Response("<!doctype html><title>Page not found</title>", { status: 404 }),
      () => new Response("<!doctype html><p>hello</p>", { status: 200 }),
      () => json({}, 200),
    ]) {
      mock("fetch", async () => answer());
      const r = await submitManagedOrder(managed, design, contact);
      assert.equal(r.ok, false); assert.equal(r.kind, "busy"); assert.equal(r.why, WORDS.busy);
    }
    assert.equal(WORDS.busy, "We couldn't send that just now. Please try again in a minute.");
  });
  await check("no answer in time: \"That took too long. Tap Try again — we won't get it twice.\"", async () => {
    mock("fetch", (_, options) => new Promise((_, reject) => options.signal.addEventListener("abort", () => reject(new DOMException("Timed out", "AbortError")), { once: true })));
    const result = await submitManagedOrder(managed, design, contact, 5);
    assert.deepEqual(result, { ok: false, why: "That took too long. Tap Try again — we won't get it twice.", kind: "slow", code: 0 });
    mock("fetch", async () => { throw new TypeError("Failed to fetch"); });
    const offline = await submitManagedOrder(managed, design, contact);
    assert.equal(offline.kind, "offline"); assert.match(offline.why, /^We couldn't send that just now\./);
  });
  await check("our own words on a lot's link never say \"your dealer\", \"request\", \"submission\" or \"timed out\"", async () => {
    for (const words of Object.values(WORDS)) assert.ok(!NOT_FOR_CUSTOMERS.test(words), words);
    const quote = await read("ui/quote.js");
    assert.ok(!/dealer'?s inbox|Request \$\{|Saved to your/.test(quote), "the old receipt words are gone");
  });
  await check("the receipt: \"Your quote number is #1042.\", plus today's price only when the server's total is not the page's", async () => {
    const cat = { pricing: { show: "price" } };
    assert.deepEqual(receiptWords(receipt, 5540, cat), ["Your quote number is #1042."]);
    assert.deepEqual(receiptWords({ ...receipt, total: 5700, repriced: true }, 5540, cat), ["Your quote number is #1042.", "Today's price for this building is $5,700."]);
    assert.deepEqual(receiptWords({ ...receipt, total: 5700.5 }, 5540, cat)[1], "Today's price for this building is $5,700.50.");
    assert.deepEqual(receiptWords({ ...receipt, total: 5700 }, 5540, { pricing: { show: "none" } }), ["Your quote number is #1042."], "a business that shows no prices never gets one here");
    assert.deepEqual(receiptWords(null, 5540, cat), []);
    for (const words of receiptWords({ ...receipt, total: 5700 }, 5540, cat)) assert.ok(!NOT_FOR_CUSTOMERS.test(words), words);
  });
  await check("the 409 Refresh keeps the building: the design goes into the address (#d=...) before the page reloads", async () => {
    const state = defaults(catalogue);
    const mine = fromState(state, catalogue);
    const href = "https://designer.example/d/port-charlotte/?embed=1#d=olderDesign&view=1";
    const next = await addressWithDesign(mine, href);
    const u = new URL(next);
    assert.equal(u.origin + u.pathname + u.search, "https://designer.example/d/port-charlotte/?embed=1", "the lot and the frame stay");
    assert.match(u.hash, /^#d=[A-Za-z0-9_-]+$/, "only the design, so the page opens ready to change (no &view=1)");
    assert.deepEqual(await decode(u.hash), mine);
    const steps = [];
    const where = {
      location: { href, reload() { steps.push(["reload"]); } },
      history: { state: { keep: 1 }, replaceState(s, t, url) { steps.push(["address", url, s]); } },
    };
    await reloadWithDesign(mine, where);
    assert.deepEqual(steps, [["address", next, { keep: 1 }], ["reload"]], "the address changes first, then the page reloads");
    const source = await read("ui/quote.js");
    assert.match(source, /reloadWithDesign\(api\.getDesign\(\)\)/, "the Refresh button uses it with the building on screen");
  });

  const embedSource = await read("embed.js");
  function embed(attributes) {
    const nodes = [], handlers = {}, errors = [];
    function element(tag) {
      const attrs = {}, listeners = {};
      const node = { tag, children: [], style: {}, clientWidth: 800, contentWindow: {},
        getAttribute: key => attrs[key] ?? null, setAttribute: (key, value) => { attrs[key] = value; },
        appendChild(child) { this.children.push(child); child.parentElement = this; },
        addEventListener: (name, fn) => { listeners[name] = fn; }, dispatchEvent() {},
      };
      nodes.push(node); return node;
    }
    const host = element("div"), script = element("script");
    script.src = BASE + "embed.js";
    for (const [key, value] of Object.entries({ "data-fullscreen": "off", ...attributes })) script.setAttribute(key, value);
    const location = { hash: "#d=abc123&view=1&lot=other-lot" };
    const window = { innerHeight: 800, addEventListener: (name, fn) => { handlers[name] = fn; }, console: { error: (...a) => errors.push(a.join(" ")) } };
    const document = { currentScript: script, querySelector: () => host, createElement: element, documentElement: { style: {} }, addEventListener() {} };
    runInNewContext(embedSource, { window, document, location, URL, console: window.console, isFinite, parseInt });
    return { window, nodes, host, handlers, location, errors };
  }
  await check("data-lot shows the lot's designer, and a shared design in the address stays on that lot", async () => {
    const result = embed({ "data-lot": "port-charlotte", "data-company": "another-company" });
    const frame = result.nodes.find(node => node.tag === "iframe");
    assert.equal(frame.src, BASE + "d/port-charlotte/?embed=1#d=abc123&view=1");
    result.location.hash = "#d=nextDesign&lot=other-lot"; result.handlers.hashchange();
    assert.equal(frame.src, BASE + "d/port-charlotte/?embed=1#d=nextDesign");
  });
  await check("a wrong data-lot shows no frame, says so on the page and in the console (naming data-lot), and never uses data-company", async () => {
    const result = embed({ "data-lot": "../wrong", "data-company": "demo" });
    assert.ok(!result.nodes.some(node => node.tag === "iframe"));
    assert.match(result.host.children[0].textContent, /could not be shown: the lot in its embed code \(data-lot="\.\.\/wrong"\)/);
    assert.equal(result.errors.length, 1);
    assert.match(result.errors[0], /data-lot "\.\.\/wrong"/); assert.ok(!/data-company/.test(result.errors[0]), result.errors[0]);
  });
  await check("a company's own embed code keeps its /c/<id>/ address", async () => {
    const result = embed({ "data-company": "demo" });
    assert.equal(result.nodes.find(node => node.tag === "iframe").src, BASE + "c/demo/?embed=1#d=abc123&view=1");
    const bad = embed({ "data-company": "Bad Id!" });
    assert.match(bad.errors[0], /data-company "Bad Id!"/);
  });

  if (process.argv.includes("--skip-build")) console.log("SKIPPED: customer build checks (--skip-build).");
  else await check("the customer build ships the designer and the Dealer Center (one bundled script, its stylesheets, its security policy) and nothing private", async () => {
    for (const path of ["dealer.html", "ui/office/main.js", "ui/office/closed.css"]) assert.ok(existsSync(resolve(ROOT, path)), "Required build input missing: " + path);
    for (const old of ["portal.html", "ui/portal.js", "ui/portal.css"]) assert.ok(!existsSync(resolve(ROOT, old)), "The old dealer software is still here: " + old);
    const result = spawnSync(process.execPath, ["tools/build-site.mjs", "--client"], { cwd: ROOT, encoding: "utf8", timeout: 120000,
      env: { ...process.env, SITE_ID: learningSiteId, INCLUDE_LEARNING_PREVIEW: "true" } });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const out = resolve(ROOT, "dist-client");
    const files = [];
    async function walk(dir) {
      for (const entry of await readdir(dir, { withFileTypes: true })) {
        const path = resolve(dir, entry.name);
        if (entry.isDirectory()) await walk(path); else files.push(relative(out, path).replaceAll("\\", "/"));
      }
    }
    await walk(out);
    const officeCss = readdirSync(resolve(ROOT, "ui/office")).filter(f => f.endsWith(".css")).map(f => "ui/office/" + f);
    assert.ok(officeCss.includes("ui/office/closed.css"));
    for (const file of ["index.html", "embed.js", "dealer.html", "ui/app.js", "ui/views.js", "ui/managed-order.js", "ui/quote.js", "ui/share.js", "ui/office/main.js", ...officeCss, "_headers"]) assert.ok(files.includes(file), "Missing client file " + file);
    const forbidden = files.filter(file => /(^|\/)(\.agents|\.claude|\.office-local|docs|tools|test|server|netlify|node_modules|images)(\/|$)|(^|\/)learning-[^/]+|^ui\/(learn[^/]*|parts-gallery|part-details|setup)\.|(^|\/)portal\.|\.(md|tsx|ts|mts|toml|map)$/i.test(file));
    assert.deepEqual(forbidden, []);
    assert.deepEqual(files.filter(file => file.endsWith(".html")).sort(), ["404.html", "dealer.html", "index.html"]);
    assert.deepEqual(files.filter(file => file.startsWith("ui/office/") && file.endsWith(".js")), ["ui/office/main.js"], "the Dealer Center ships as one bundled script");
    for (const file of files.filter(file => file.endsWith(".js"))) {
      const source = await readFile(resolve(out, file), "utf8");
      assert.ok(!/sourceMappingURL/.test(source), "no source map in " + file);
      for (const match of source.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*)["'](\.[^"']+\.js)["']/g)) {
        assert.ok(existsSync(resolve(out, dirname(file), match[1])), `Shipped ${file} imports missing ${match[1]}`);
      }
    }
    const bundle = await readFile(resolve(out, "ui/office/main.js"), "utf8");
    const entry = await read("ui/office/main.js");
    assert.ok(!/THE DEALER CENTER: start-up/.test(bundle) && bundle.length < entry.length * 40, "ui/office/main.js is bundled and minified (no comments)");
    const views = await readFile(resolve(out, "ui/views.js"), "utf8");
    assert.ok(!/vw-player|Watch it build|stageTriangles/.test(views));
    const headers = await readFile(resolve(out, "_headers"), "utf8");
    for (const path of ["/dealer", "/dealer.html"]) {
      assert.ok(headers.includes(`\n${path}\n  Content-Security-Policy: ${OFFICE_POLICY}\n  Cache-Control: no-store\n`), "the Dealer Center's rules for " + path);
    }
    assert.ok(!/portal/i.test(headers), "no rules for the old dealer software");
    const index = await readFile(resolve(out, "index.html"), "utf8");
    assert.match(index, /location\.replace\('\/dealer'\+location\.hash\)/, "sign-in email links go to the Dealer Center");
    const generated = await import(pathToFileURL(resolve(ROOT, "server/generated/designer.js")).href + "?" + Date.now());
    assert.equal(generated.html, index, "server/generated/designer.js holds today's index.html");
    assert.deepEqual(generated.hashes, inlineScriptHashes(index));
  });
} finally {
  for (const [key, descriptor] of Object.entries(originals)) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
  }
}
if (failures.length) { console.error(`FAIL: ${failures.length} lot link checks failed; ${checks} passed.`); process.exitCode = 1; }
else console.log(`PROVED: ${checks} lot link checks passed${process.argv.includes("--skip-build") ? "; customer build checks skipped" : ", including what the customer build ships"}.`);
