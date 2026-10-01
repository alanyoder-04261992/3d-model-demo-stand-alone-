/* CHECK: managed dealer links, protected routing, retry behavior, and the
   customer shipping boundary. Uses fetch mocks and Node; no browser or live
   submissions. Run: node tools/check-managed-client.mjs [--skip-build]
   --skip-build runs the client checks while portal files are being prepared.
   check-all: node */
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { runInNewContext } from "node:vm";
import { loadLot } from "../ui/load.js";
import { submitManagedOrder } from "../ui/managed-order.js";
import { designLink } from "../ui/share.js";
import { defaults, fromState, decode } from "../model/design.js";
import { includeLearningPreview, learningSiteId } from "./site-profiles.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = "https://designer.example/product/";
const read = path => readFile(resolve(ROOT, path), "utf8");
const company = JSON.parse(await read("companies/demo/company.json"));
const manufacturer = JSON.parse(await read(`library/manufacturers/${company.manufacturer}.json`));
const library = JSON.parse(await read("library/construction.json"));
const lot = { id: "lot-port-charlotte", name: "Port Charlotte", phone: "555-010-2000", email: "lot@example.test", website: "https://dealer.example", embedOrigins: ["https://dealer.example", "https://www.dealer.example"] };
const data = { company, lot, version: 7 };
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
    if (address.href === BASE + "api/lots/port-charlotte") return json(status === 200 ? override : { error: "Unavailable" }, status);
    if (address.href === BASE + `library/manufacturers/${company.manufacturer}.json`) return json(manufacturer);
    if (address.href === BASE + "library/construction.json") return json(library);
    throw new Error("Unexpected request: " + address.href);
  });
  return calls;
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
  await check("lot links load Owner/Admin catalogue with dealer contact details and exact dealer origins", async () => {
    const calls = lotFetch();
    const result = await loadLot("port-charlotte", { base: BASE });
    assert.deepEqual(result.problems, []); catalogue = result.catalogue;
    assert.equal(catalogue.id, company.id);
    assert.equal(catalogue.brand.phone, lot.phone); assert.equal(catalogue.brand.email, lot.email);
    assert.equal(catalogue.leads.mode, "managed"); assert.equal(catalogue.leads.images, false);
    assert.deepEqual(catalogue.embed.origins, lot.embedOrigins);
    assert.equal(catalogue.embed.shareUrl, BASE + "d/port-charlotte/");
    assert.deepEqual(catalogue.managed, { slug: "port-charlotte", lotId: lot.id, companyId: company.id, version: 7, orderUrl: BASE + "api/lots/port-charlotte/orders" });
    assert.equal(calls.length, 3); assert.ok(!calls.some(url => url.includes("companies/")));
  });
  await check("shared designs preserve their dealer route, selected design and look-only option", async () => {
    assert.ok(catalogue);
    const state = defaults(catalogue);
    const link = await designLink({ getCatalogue: () => catalogue, getDesign: options => fromState(state, catalogue, options) }, { view: true, href: "https://unrelated.example/?company=starter" });
    const url = new URL(link);
    assert.equal(url.origin + url.pathname, BASE + "d/port-charlotte/");
    assert.match(url.hash, /&view=1$/);
    const design = await decode(url.hash);
    assert.equal(design.company, company.id); assert.equal(design.type, state.type); assert.equal(design.size, state.size);
  });
  await check("managed forms always expose name and at least one usable contact field", async () => {
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
      assert.equal(result.company.leads.fields.name, fields.name, "Managed form defaults must not rewrite the stored company configuration");
    }
  });
  await check("unavailable and suspended lot endpoints cannot fall back to a public company", async () => {
    for (const status of [404, 403, 503]) {
      const calls = lotFetch(status);
      await assert.rejects(loadLot("port-charlotte", { base: BASE }), new RegExp(String(status)));
      assert.deepEqual(calls, [BASE + "api/lots/port-charlotte"]);
    }
  });
  await check("invalid dealer IDs fail before any request", async () => {
    const calls = lotFetch();
    await assert.rejects(loadLot("../demo", { base: BASE }), /not allowed/); assert.equal(calls.length, 0);
  });
  await check("actual designer bootstrap shows an error when a lot fails, even with a demo query", async () => {
    const calls = [], elements = [];
    const layout = { style: {} };
    mock("location", { pathname: "/d/port-charlotte/", search: "?company=demo", hash: "" });
    mock("window", {});
    mock("document", { body: { classList: { add() {} }, appendChild: element => elements.push(element) }, getElementById: id => id === "layout" ? layout : null, createElement: () => ({}) });
    mock("fetch", async url => { calls.push(String(url)); return json({ error: "Unavailable" }, 503); });
    const log = console.error; console.error = () => {};
    try {
      const app = await import(pathToFileURL(resolve(ROOT, "ui/app.js")).href + "?managed-client-error-test");
      assert.equal(await app.started, null);
    } finally { console.error = log; }
    assert.equal(calls.length, 1); assert.match(calls[0], /api\/lots\/port-charlotte$/);
    assert.equal(layout.style.display, "none");
    assert.ok(elements.some(element => element.id === "bootmsg" && /could not start/.test(element.innerHTML)));
    assert.equal(window.shedUI, undefined);
  });

  const managed = { slug: "port-charlotte", version: 7, orderUrl: BASE + "api/lots/port-charlotte/orders" };
  const design = { v: 1, company: "demo", type: "UT", size: "10x16" };
  const contact = { name: "Client Test", email: "customer@example.test", phone: "5550102000" };
  async function retries(storage, marker) {
    const posts = [];
    mock("sessionStorage", storage);
    mock("fetch", async (url, options) => {
      posts.push({ url, options, body: JSON.parse(options.body) });
      if (posts.length === 1) throw new TypeError("network disconnected after server accepted");
      return json({ id: "order-test", dealerLotId: lot.id });
    });
    const c = { ...contact, note: marker };
    const first = await submitManagedOrder(managed, design, c);
    const second = await submitManagedOrder(managed, design, c);
    assert.equal(first.ok, false); assert.equal(second.ok, true);
    assert.equal(second.receipt.id, "order-test");
    assert.equal(posts[0].body.idempotencyKey, posts[1].body.idempotencyKey);
    assert.match(posts[0].body.idempotencyKey, /^[0-9a-f-]{36}$/i);
    assert.equal(posts[0].url, managed.orderUrl); assert.equal(posts[0].options.credentials, "omit");
    assert.deepEqual(posts[0].body.design, design); assert.deepEqual(posts[0].body.contact, c); assert.equal(posts[0].body.version, 7);
    assert.deepEqual(Object.keys(posts[0].body).sort(), ["contact", "design", "idempotencyKey", "version"]);
  }
  await check("lost responses retry with the same request ID when embedded storage reads throw", async () => {
    await retries({ getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } }, "read denied");
  });
  await check("lost responses retry with the same request ID when storage is full", async () => {
    await retries({ getItem() { return null; }, setItem() { throw new Error("quota"); } }, "write denied");
  });
  await check("stored retry keys contain only a digest and UUID, never customer contact details", async () => {
    const storage = new Map();
    await retries({ getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) }, "persisted");
    assert.equal(storage.size, 1);
    for (const [key, value] of storage) { assert.match(key, /^shed-order:port-charlotte:[0-9a-f]{64}$/); assert.match(value, /^[0-9a-f-]{36}$/i); }
  });
  await check("a changed design receives a different ID while identical submissions reuse it", async () => {
    mock("sessionStorage", { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } });
    const keys = [];
    mock("fetch", async (_, options) => { keys.push(JSON.parse(options.body).idempotencyKey); return json({ id: "order-test" }); });
    await submitManagedOrder(managed, design, contact);
    await submitManagedOrder(managed, design, contact);
    await submitManagedOrder(managed, { ...design, size: "12x16" }, contact);
    assert.equal(keys[0], keys[1]); assert.notEqual(keys[0], keys[2]);
  });
  await check("stale catalogue and backend validation messages reach the quote caller unchanged", async () => {
    for (const [status, error] of [[409, "Prices changed. Reload this designer before submitting."], [422, "Enter a valid phone or email."], [503, "Orders are temporarily unavailable."]]) {
      mock("fetch", async () => json({ error }, status));
      assert.deepEqual(await submitManagedOrder(managed, design, contact), { ok: false, why: error });
    }
  });
  await check("timeouts are abortable and retry advice is explicit", async () => {
    mock("fetch", (_, options) => new Promise((_, reject) => options.signal.addEventListener("abort", () => reject(new DOMException("Timed out", "AbortError")), { once: true })));
    const result = await submitManagedOrder(managed, design, contact, 5);
    assert.equal(result.ok, false); assert.match(result.why, /timed out/); assert.match(result.why, /only be saved once/);
  });
  await check("unexpected server responses are reported as failure rather than a receipt", async () => {
    mock("fetch", async () => new Response("Gateway error", { status: 502 }));
    const result = await submitManagedOrder(managed, design, contact);
    assert.equal(result.ok, false); assert.match(result.why, /connection/);
  });

  const embedSource = await read("embed.js");
  function embed(attributes) {
    const nodes = [], handlers = {};
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
    const window = { innerHeight: 800, addEventListener: (name, fn) => { handlers[name] = fn; }, console: { error() {} } };
    const document = { currentScript: script, querySelector: () => host, createElement: element, documentElement: { style: {} }, addEventListener() {} };
    runInNewContext(embedSource, { window, document, location, URL, console: window.console, isFinite, parseInt });
    return { window, nodes, host, handlers, location };
  }
  await check("data-lot embeds and shared-design hash changes stay on the assigned dealer route", async () => {
    const result = embed({ "data-lot": "port-charlotte", "data-company": "another-company" });
    const frame = result.nodes.find(node => node.tag === "iframe");
    assert.equal(frame.src, BASE + "d/port-charlotte/?embed=1#d=abc123&view=1");
    result.location.hash = "#d=nextDesign&lot=other-lot"; result.handlers.hashchange();
    assert.equal(frame.src, BASE + "d/port-charlotte/?embed=1#d=nextDesign");
  });
  await check("invalid lot embed IDs do not create an iframe or silently use data-company", async () => {
    const result = embed({ "data-lot": "../wrong", "data-company": "demo" });
    assert.ok(!result.nodes.some(node => node.tag === "iframe"));
    assert.match(result.host.children[0].textContent, /dealer lot.*data-lot/);
  });
  await check("existing company embeds retain their public company route", async () => {
    const result = embed({ "data-company": "demo" });
    assert.equal(result.nodes.find(node => node.tag === "iframe").src, BASE + "c/demo/?embed=1#d=abc123&view=1");
  });

  if (process.argv.includes("--skip-build")) console.log("SKIPPED: customer artifact checks (--skip-build).");
  else await check("customer build ships required runtime and excludes lessons, skills, source tools and server files", async () => {
    for (const path of ["portal.html", "ui/portal.js", "ui/portal.css"]) assert.ok(existsSync(resolve(ROOT, path)), "Required build input missing: " + path);
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
    for (const file of ["index.html", "embed.js", "portal.html", "ui/app.js", "ui/views.js", "ui/managed-order.js", "ui/quote.js", "ui/share.js", "ui/portal.js", "ui/portal.css", "_headers"]) assert.ok(files.includes(file), "Missing client file " + file);
    const forbidden = files.filter(file => /(^|\/)(\.agents|\.claude|docs|tools|test|server|node_modules|images)(\/|$)|(^|\/)learning-[^/]+|^ui\/(learn[^/]*|parts-gallery|part-details|setup)\.|\.(md|tsx|mts|toml|map)$/i.test(file));
    assert.deepEqual(forbidden, []);
    assert.deepEqual(files.filter(file => file.endsWith(".html")).sort(), ["404.html", "index.html", "portal.html"]);
    for (const file of files.filter(file => file.endsWith(".js"))) {
      const source = await readFile(resolve(out, file), "utf8");
      for (const match of source.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*)["'](\.[^"']+\.js)["']/g)) {
        assert.ok(existsSync(resolve(out, dirname(file), match[1])), `Shipped ${file} imports missing ${match[1]}`);
      }
    }
    const views = await readFile(resolve(out, "ui/views.js"), "utf8");
    assert.ok(!/vw-player|Watch it build|stageTriangles/.test(views));
  });
} finally {
  for (const [key, descriptor] of Object.entries(originals)) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
  }
}
if (failures.length) { console.error(`FAIL: ${failures.length} managed client checks failed; ${checks} passed.`); process.exitCode = 1; }
else console.log(`PROVED: ${checks} managed client checks passed${process.argv.includes("--skip-build") ? "; customer build verification skipped" : ", including the customer shipping boundary"}.`);
