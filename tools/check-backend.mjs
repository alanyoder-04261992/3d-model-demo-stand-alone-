/* PROVE THE PRIVATE OFFICE'S ACCESS BOUNDARIES AND ORDER PRICES without
   contacting Identity, sending mail, or writing any real customer data. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createBackend } from "../server/dealer-backend.js";
import { priceOrder } from "../server/order-pricing.js";
import { resolve } from "../model/company.js";
import { defaults, fromState, toState } from "../model/design.js";
import { priceParts } from "../model/pricing.js";
import { pkFixtures } from "../model/layout.js";
import { frameOf } from "../model/frame.js";
import { setElec, toggleExt } from "../ui/state.js";

const json = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const template = json("../companies/starter/company.json"), manufacturer = json("../library/manufacturers/standard.json"), library = json("../library/construction.json");
const clone = structuredClone;
class MemoryStore {
  constructor() { this.values = new Map(); this.seq = 0; }
  async getWithMetadata(key) { return clone(this.values.get(key) || null); }
  async setJSON(key, data, options = {}) {
    const old = this.values.get(key);
    if ((options.onlyIfNew && old) || (options.onlyIfMatch && old?.etag !== options.onlyIfMatch)) return { modified: false };
    const etag = String(++this.seq); this.values.set(key, { data: clone(data), etag }); return { modified: true, etag };
  }
  async *list({ prefix }) { yield { blobs: [...this.values.keys()].filter((key) => key.startsWith(prefix)).map((key) => ({ key })) }; }
}
const store = new MemoryStore();
const users = new Map([
  ["owner-a", { id: "owner-a", email: "owner-a@example.test", confirmedAt: "2026-01-01T00:00:00Z" }],
  ["owner-b", { id: "owner-b", email: "owner-b@example.test", confirmedAt: "2026-01-01T00:00:00Z" }],
  ["dealer-a", { id: "dealer-a", email: "dealer-a@example.test", confirmedAt: "2026-01-01T00:00:00Z" }],
  ["dealer-b", { id: "dealer-b", email: "dealer-b@example.test", confirmedAt: "2026-01-01T00:00:00Z" }],
  ["unconfirmed", { id: "unconfirmed", email: "owner-a@example.test", roles: ["admin"], userMetadata: { role: "admin" } }],
]);
let who = "owner-a";
const deps = { store, identityUser: async () => users.get(who) || null, lookupUser: async (id) => users.get(id), bootstrapEmail: "owner-a@example.test", loadCatalogue: async (id) => { if (id !== "standard") throw Error(); return { manufacturer, library }; }, now: () => new Date("2026-10-01T16:00:00Z"), clientIp: "192.0.2.1" };
let app = createBackend(deps);
let checks = 0;
async function call(path, method = "GET", data, expected = 200, origin = "https://office.example") {
  const response = await app.handle(new Request(`https://office.example${path}`, { method, headers: { "Content-Type": "application/json", ...(origin ? { Origin: origin } : {}) }, ...(data === undefined ? {} : { body: JSON.stringify(data) }) }));
  const result = await response.json(); assert.equal(response.status, expected, `${method} ${path}: ${JSON.stringify(result)}`); checks++; return result;
}
who = "unconfirmed";
await call("/api/dealer/me", "GET", undefined, 401);
assert.equal(store.values.has("setup/first-owner"), false);
who = "owner-a";
const me = await call("/api/dealer/me"); assert.equal(me.membership.role, "admin"); assert.equal(me.membership.platformAdmin, false);
function company(id) { const c = clone(template); c.id = id; c.brand.name = id; c.leads = { mode: "none", fields: { name: "required", phone: "optional", email: "optional", zip: "optional", address: "optional", note: "optional" } }; c.embed = { origins: [] }; return c; }
const companyA = company("company-a");
await call("/api/dealer/companies", "POST", { company: companyA }, 201);
await call("/api/dealer/companies", "POST", { company: companyA }, 409);
const lotA = (await call("/api/dealer/companies/company-a/lots", "POST", { slug: "lot-a", name: "Dealer A", embedOrigins: ["https://dealer-a.example"] }, 201)).lot;
await call("/api/dealer/companies/company-a/lots", "POST", { slug: "lot-a2", name: "Dealer A2" }, 201);
await call("/api/dealer/companies/company-a/lots", "POST", { slug: "bad-origin", name: "Bad", embedOrigins: ["https://example.test;script-src"] }, 422);
await call("/api/dealer/memberships", "POST", { userId: "dealer-a", email: "dealer-a@example.test", role: "dealer", companyId: "company-a", lotId: "lot-a" }, 201);
await call("/api/dealer/memberships", "POST", { userId: "dealer-b", email: "wrong@example.test", role: "dealer", companyId: "company-a", lotId: "lot-a2" }, 422);
await call("/api/dealer/memberships", "POST", { userId: "dealer-b", email: "dealer-b@example.test", role: "dealer", companyId: "company-a", lotId: "lot-a2" }, 201);
await store.setJSON("members/owner-b", { userId: "owner-b", role: "admin", companyIds: [], lotIds: [], platformAdmin: false });
who = "owner-b";
await call("/api/dealer/companies", "POST", { company: company("company-b") }, 201);
await call("/api/dealer/companies/company-b/lots", "POST", { slug: "lot-b", name: "Other company" }, 201);
await call("/api/dealer/companies/company-a/catalogue", "GET", undefined, 404);
await call("/api/dealer/orders?companyId=company-a", "GET", undefined, 404);
await call("/api/dealer/memberships", "POST", { userId: "dealer-a", email: "dealer-a@example.test", role: "admin", companyId: "company-a" }, 404);
assert.equal((await call("/api/dealer/companies")).companies.length, 1);
who = null;
const publicA = await call("/api/lots/lot-a"); assert.equal(publicA.lot.companyId, "company-a"); assert.deepEqual(publicA.lot.embedOrigins, ["https://dealer-a.example"]);
const cat = resolve(publicA.company, manufacturer, library), state = defaults(cat), design = fromState(state, cat);
const submission = { design, version: publicA.version, contact: { name: "Test Customer", email: "customer@example.test" }, idempotencyKey: "submission-key-0001", companyId: "company-b", lotId: "lot-b", price: 1 };
const receipt = await call("/api/lots/lot-a/orders", "POST", submission, 201); assert.equal(receipt.total, priceParts(state, cat).total); assert.equal("contact" in receipt, false);
const duplicate = await call("/api/lots/lot-a/orders", "POST", submission); assert.equal(duplicate.id, receipt.id);
await call("/api/lots/lot-a/orders", "POST", { ...submission, contact: { name: "Different", email: "customer@example.test" } }, 409);
app = createBackend(deps); assert.equal((await call("/api/lots/lot-a/orders", "POST", submission)).id, receipt.id);
await call("/api/lots/lot-a/orders", "POST", { ...submission, idempotencyKey: "stale-version-0001", version: 0 }, 409);
await call("/api/lots/lot-a/orders", "POST", { ...submission, idempotencyKey: "wrong-company-001", design: { ...design, company: "company-b" } }, 422);
const evil = clone(design); evil.items.push({ cat: "d36in", wall: "B", pos: 0, pk: true });
await call("/api/lots/lot-a/orders", "POST", { ...submission, idempotencyKey: "tampered-pkg-0001", design: evil }, 422);
const evilInc = clone(design); evilInc.items.push({ cat: "d36in", wall: "B", pos: 0, inc: true, origCat: "w72" });
await call("/api/lots/lot-a/orders", "POST", { ...submission, idempotencyKey: "tampered-inc-0001", design: evilInc }, 422);
const evilLength = clone(design); evilLength.items.push({ cat: "bench", wall: "IN", ln: -20 });
await call("/api/lots/lot-a/orders", "POST", { ...submission, idempotencyKey: "tampered-ln-00001", design: evilLength }, 422);
const huge = clone(design); huge.items = Array.from({ length: 251 }, () => design.items[0]);
await call("/api/lots/lot-a/orders", "POST", { ...submission, idempotencyKey: "tampered-big-0001", design: huge }, 422);
await call("/api/lots/lot-a/orders", "POST", { ...submission, idempotencyKey: "cross-origin-001" }, 403, "https://attacker.example");
await call("/api/lots/lot-a/orders", "POST", { ...submission, idempotencyKey: "missing-origin01" }, 403, null);
const parallelData = { ...submission, idempotencyKey: "parallel-key-0001" };
const parallel = await Promise.all([app.handle(new Request("https://office.example/api/lots/lot-a/orders", { method: "POST", headers: { Origin: "https://office.example", "Content-Type": "application/json" }, body: JSON.stringify(parallelData) })), app.handle(new Request("https://office.example/api/lots/lot-a/orders", { method: "POST", headers: { Origin: "https://office.example", "Content-Type": "application/json" }, body: JSON.stringify(parallelData) }))]);
assert.deepEqual(parallel.map((r) => r.status).sort(), [200, 201]);
const pr = await Promise.all(parallel.map((r) => r.json())); assert.equal(pr[0].id, pr[1].id);
who = "dealer-a";
assert.equal((await call("/api/dealer/orders")).orders.length, 2);
await call("/api/dealer/orders?lotId=lot-a2", "GET", undefined, 404);
await call("/api/dealer/companies/company-a/catalogue", "PUT", { company: companyA, version: 1 }, 403);
await call("/api/dealer/companies/company-a/lots", "POST", { slug: "bad-lot", name: "Bad" }, 403);
await call("/api/dealer/memberships", "POST", { userId: "dealer-a", email: "dealer-a@example.test", role: "admin", companyId: "company-a" }, 403);
const saved = (await call(`/api/dealer/orders/${receipt.id}`, "PATCH", { status: "contacted", version: 1 })).order;
assert.equal(saved.companyId, "company-a"); assert.equal(saved.lotId, "lot-a"); assert.equal(saved.version, 2); assert.equal("fingerprint" in saved, false);
await call(`/api/dealer/orders/${receipt.id}`, "PATCH", { status: "closed", version: 1 }, 409);
who = "dealer-b";
await call(`/api/dealer/orders/${receipt.id}`, "GET", undefined, 404);
await call(`/api/dealer/orders/${receipt.id}`, "PATCH", { status: "closed", version: 2 }, 404);
assert.equal((await call("/api/dealer/orders")).orders.length, 0);
who = "owner-a";
assert.equal((await call("/api/dealer/orders")).orders.length, 2);
await call("/api/dealer/memberships", "POST", { userId: "dealer-a", email: "dealer-a@example.test", role: "admin", companyId: "company-a" }, 409);
await call("/api/dealer/companies/company-a/lots/lot-a", "PUT", { version: 1, active: false });
await call("/api/lots/lot-a", "GET", undefined, 404);
await call("/api/lots/lot-a/orders", "POST", { ...submission, idempotencyKey: "disabled-lot-0001" }, 404);
await call("/api/dealer/companies/company-a/lots/lot-a", "PUT", { version: 1, active: true }, 409);
await call("/api/dealer/companies/company-a/lots/lot-a", "PUT", { version: 2, active: true });
const c1 = await call("/api/dealer/companies/company-a/catalogue");
const c2 = await call("/api/dealer/companies/company-a/catalogue", "PUT", { company: c1.company, version: c1.version }); assert.equal(c2.version, 2); assert.equal(c2.company.cfg, 2);
await call("/api/dealer/companies/company-a/catalogue", "PUT", { company: c1.company, version: c1.version }, 409);
await call("/api/lots/lot-a/orders", "POST", { ...submission, idempotencyKey: "stale-after-save1" }, 409);
assert.equal((await call(`/api/dealer/orders/${receipt.id}`)).order.price.total, receipt.total);
const racedSettings = await Promise.all([1, 2].map(() => app.handle(new Request("https://office.example/api/dealer/companies/company-a/catalogue", { method: "PUT", headers: { Origin: "https://office.example", "Content-Type": "application/json" }, body: JSON.stringify({ company: c2.company, version: 2 }) }))));
assert.deepEqual(racedSettings.map((r) => r.status).sort(), [200, 409]);
await call("/api/dealer/companies", "POST", { company: "invalid" }, 422);
await call("/api/dealer/companies", "POST", JSON.parse('{"company":{"__proto__":{"role":"admin"}}}'), 422);
users.set("profile-admin", { id: "profile-admin", email: "unassigned@example.test", confirmedAt: "2026-01-01T00:00:00Z", roles: ["admin"], userMetadata: { role: "admin", companyIds: ["company-a"] } });
who = "profile-admin";
assert.equal((await call("/api/dealer/me")).membership, null);
await call("/api/dealer/orders", "GET", undefined, 403);
who = "owner-a";
await call("/api/dealer/companies/company-a/lots", "POST", { slug: "rate-test", name: "Submission limit check" }, 201);
const latest = await call("/api/lots/rate-test");
const latestDesign = fromState(defaults(resolve(latest.company, manufacturer, library)), resolve(latest.company, manufacturer, library));
for (let n = 0; n < 21; n++) await call("/api/lots/rate-test/orders", "POST", { ...submission, design: latestDesign, version: latest.version, idempotencyKey: `rate-test-key-${String(n).padStart(4, "0")}` }, n < 20 ? 201 : 429);

// Inputs must fail as validation errors before the browser's compatibility
// decoder coerces them. Check both direct pricing (NaN is not JSON) and the
// HTTP boundary (JSON turns NaN/Infinity into null, which must also fail).
const malformed = [
  ["negative package with free exterior fixture", (d) => { d.elec = { pkg: -1, ext: true }; d.items.push({ cat: "light", wall: "F", pos: 2, pk: true }); }],
  ["NaN electrical package", (d) => { d.elec.pkg = NaN; }],
  ["infinite electrical package", (d) => { d.elec.pkg = Infinity; }],
  ["string electrical package", (d) => { d.elec.pkg = "1"; }],
  ["fractional electrical package", (d) => { d.elec.pkg = 1.5; }],
  ["unoffered electrical package", (d) => { d.elec.pkg = 999; }],
  ["null electrical package", (d) => { d.elec.pkg = null; }],
  ["array electrical package", (d) => { d.elec.pkg = [1]; }],
  ["package zero with exterior light", (d) => { d.elec = { pkg: 0, ext: true }; }],
  ["nonboolean exterior option", (d) => { d.elec.ext = "false"; }],
  ["null electrical object", (d) => { d.elec = null; }],
  ["array style ID", (d) => { d.type = [d.type]; }],
  ["array size ID", (d) => { d.size = [d.size]; }],
  ["object color", (d) => { d.colors.body = { toString: "White" }; }],
  ["array colors", (d) => { d.colors = []; }],
  ["object extra", (d) => { d.xopt.anchors = { toString: "x" }; }],
  ["array extras", (d) => { d.xopt = []; }],
  ["negative extra", (d) => { d.xopt.anchors = -1; }],
  ["excessive quantity", (d) => { d.xopt.anchors = 100; }],
  ["nonboolean switch value", (d) => { d.xopt["ridge-vent"] = 2; }],
  ["unknown extra", (d) => { d.xopt.unknown = 0; }],
  ["array upgrade ID", (d) => { d.opts = [["jo12"]]; }],
  ["repeated upgrade", (d) => { d.opts = ["jo12", "jo12"]; }],
  ["object upgrades", (d) => { d.opts = { jo12: 1 }; }],
  ["array porch", (d) => { d.porch = []; }],
  ["string porch length", (d) => { d.porch.pLen = "12"; }],
  ["number porch toggle", (d) => { d.porch.pMid = 1; }],
  ["array ramp ID", (d) => { d.ramp = ["none"]; }],
  ["object dormer ID", (d) => { d.dormer = {}; }],
  ["array item ID", (d) => { d.items[0].cat = [d.items[0].cat]; }],
  ["array wall", (d) => { d.items[0].wall = ["F"]; }],
  ["array original item", (d) => { d.items[0].origCat = [d.items[0].cat]; }],
  ["string item flag", (d) => { d.items[0].inc = "false"; }],
  ["null item flag", (d) => { d.items[0].pk = null; }],
  ["infinite position", (d) => { d.items[0].pos = Infinity; }],
  ["string measurement", (d) => { d.items[0].pos = "0"; }],
  ["invalid displayed price", (d) => { d.priced = { total: -1, at: "2026-10-01" }; }],
  ["unknown design field", (d) => { d.role = "admin"; }],
];
const currentCat = resolve(latest.company, manufacturer, library);
for (const [index, [label, change]] of malformed.entries()) {
  const invalid = clone(latestDesign); change(invalid);
  assert.throws(() => priceOrder(invalid, currentCat), (error) => error.status === 422, label);
  app = createBackend({ ...deps, clientIp: `validation-case-${index}` });
  await call("/api/lots/lot-a/orders", "POST", { ...submission, design: invalid, version: latest.version, idempotencyKey: `malformed-case-${String(index).padStart(4, "0")}` }, 422);
}
app = createBackend(deps);
const demoCat = resolve(json("../companies/demo/company.json"), manufacturer, library), demoState = defaults(demoCat), demoDesign = fromState(demoState, demoCat);
demoDesign.items.push({ cat: "light", wall: "F", pos: 2 });
assert.equal(priceOrder(demoDesign, demoCat).price.total, priceParts(demoState, demoCat).total + demoCat.CAT.light.p);
demoDesign.elec = { pkg: -1, ext: true }; demoDesign.items.at(-1).pk = true;
assert.throws(() => priceOrder(demoDesign, demoCat), (error) => error.status === 422, "negative-package exterior-light price bypass");
const switchedOff = defaults(demoCat);
setElec(switchedOff, 1, demoCat); toggleExt(switchedOff, demoCat); setElec(switchedOff, 0, demoCat);
assert.deepEqual(switchedOff.elec, { pkg: 0, ext: false }, "switching off an electrical package also clears its exterior option");
assert.equal(switchedOff.items.some((item) => item.pk), false);
assert.equal(priceOrder(fromState(switchedOff, demoCat), demoCat).price.total, priceParts(switchedOff, demoCat).total);
assert.equal(priceOrder(fromState(switchedOff, demoCat, { priced: true, at: "2026-10-01" }), demoCat).price.total, priceParts(switchedOff, demoCat).total);
const oldLink = fromState(switchedOff, demoCat); oldLink.elec.ext = true;
const reopened = toState(oldLink, demoCat);
assert.equal(reopened.state.elec.ext, false, "an old link clears an exterior option without a package");
assert.ok(reopened.warnings.some((warning) => warning.includes("exterior electrical light")));
assert.equal(priceOrder(fromState(reopened.state, demoCat), demoCat).price.total, priceParts(switchedOff, demoCat).total);

// Every shipped catalogue's standard design and electrical packages keep
// their existing totals while allowance checks reject forged free items.
let pricedCases = 0;
for (const companyId of ["demo", "starter", "learning-side-loft"]) {
  const c = json(`../companies/${companyId}/company.json`), catalogue = resolve(c, manufacturer, library);
  for (const type of Object.keys(catalogue.TYPES)) for (const size of Object.keys(catalogue.P[type])) {
    const d = fromState(defaults(catalogue), catalogue); d.type = type; d.size = size; delete d.items;
    const fresh = toState(d, catalogue).state;
    const validated = priceOrder(fromState(fresh, catalogue), catalogue); assert.equal(validated.price.total, priceParts(fresh, catalogue).total); pricedCases++;
    for (const pkg of catalogue.ELECPK || []) {
      fresh.elec = { pkg: +pkg[0], ext: false }; pkFixtures(fresh, frameOf(fresh, catalogue), catalogue);
      assert.equal(priceOrder(fromState(fresh, catalogue), catalogue).price.total, priceParts(fresh, catalogue).total); pricedCases++;
      if (+pkg[0] > 0 && catalogue.MISC.ext != null) {
        fresh.elec.ext = true; pkFixtures(fresh, frameOf(fresh, catalogue), catalogue);
        assert.equal(priceOrder(fromState(fresh, catalogue), catalogue).price.total, priceParts(fresh, catalogue).total); pricedCases++;
      }
    }
  }
}
console.log(`PASS: ${checks} office API assertions, ${malformed.length} malformed-design regressions and ${pricedCases} shipped style/size/electrical price cases; verified-owner bootstrap, company and lot isolation, owner-only settings, stale saves, price tampering, persistent reads, inactive lots, duplicate/racing requests, and CSRF boundaries.`);
