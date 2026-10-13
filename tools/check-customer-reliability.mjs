/* CHECK: safe customer-save retries and faithful historical quotes/orders.
   Run: node tools/check-customer-reliability.mjs (check-all: node)
   Real server, fake Identity and memory storage only; no network/mail. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createOffice } from "../server/office/index.js";
import { MemoryBlobs } from "../server/office/store.js";
import { fromState, toState } from "../model/design.js";
import { mergeSettings } from "../ui/office/settings-merge.js";
import { loadLot } from "../ui/load.js";

const read = (path) => JSON.parse(readFileSync(new URL("../" + path, import.meta.url), "utf8"));
const clock = { time: Date.parse("2026-10-13T15:00:00Z") };
const people = Object.fromEntries(["owner", "other", "dealer"].map((id) => [id, { id, email: id + "@reliability.example", confirmedAt: "2026-01-01T00:00:00Z", emailVerified: true }]));
const office = createOffice({ blobs: new MemoryBlobs(), ownerEmail: people.owner.email,
  identityUser: async (request) => people[request.headers.get("x-test-as") || "owner"] || null,
  manufacturer: read("library/manufacturers/standard.json"), library: read("library/construction.json"),
  templates: { full: read("companies/demo/company.json"), small: read("companies/starter/company.json") },
  now: () => new Date(clock.time), siteUrl: "https://reliability.example", signIn: "netlify", log: () => {},
});
const store = office.parts.store;
let passed = 0;
function ok(name, condition) { assert.ok(condition, name); passed++; console.log("  ok " + name); }
async function call(method, path, body, who = "owner") {
  const response = await office.handle(new Request("https://reliability.example/api/office/" + path, {
    method, headers: { Origin: "https://reliability.example", "x-test-as": who, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }));
  return { status: response.status, data: await response.json() };
}
ok("owner can start the isolated business", (await call("POST", "setup", { businessName: "Reliability Barns", yourName: "Owner", start: "full" })).status === 201);
ok("first local lot is created", (await call("POST", "lots", { name: "First Lot", slug: "first-lot", state: "FL" })).status === 201);
ok("second local lot is created", (await call("POST", "lots", { name: "Other Lot", slug: "other-lot", state: "GA" })).status === 201);
await store.put("people/other", { userId: "other", email: people.other.email, role: "owner", active: true, name: "Other Owner", lots: [] });
await store.put("people/dealer", { userId: "dealer", email: people.dealer.email, role: "dealer", active: true, name: "Dealer", lots: ["other-lot"] });
const body = { lot: "first-lot", name: "Retry customer", email: "retry@reliability.example", requestKey: "customer-form-1234", note: "One first note" };
const first = await call("POST", "customers", body);
ok("first customer save commits", first.status === 201);
const again = await call("POST", "customers", body);
ok("a lost-response retry returns the original customer id", again.status === 201 && again.data.customer.id === first.data.customer.id);
ok("retry keeps one first note and one created activity", again.data.customer.activity.length === 2 && (await store.keys("customers/")).length === 1);
const raced = await Promise.all(Array.from({ length: 8 }, () => call("POST", "customers", { ...body, requestKey: "parallel-form-1234" })));
ok("eight concurrent retries commit one customer", raced.every((r) => r.status === 201) && new Set(raced.map((r) => r.data.customer.id)).size === 1 && (await store.keys("customers/")).length === 2);
ok("changed details cannot reuse a completed create reference", (await call("POST", "customers", { ...body, name: "Changed after save" })).status === 409);
const other = await call("POST", "customers", body, "other");
ok("retry references are scoped to the signed-in person", other.status === 201 && other.data.customer.id !== first.data.customer.id);
ok("invalid references retain validation behavior", (await call("POST", "customers", { ...body, requestKey: "../bad" })).status === 422);
ok("another lot's dealer cannot retry or discover this customer", (await call("POST", "customers", body, "dealer")).status === 404);

let record = (await call("GET", "price-list")).data;
record.settings.notes.finePrint = "Original agreed fine print.";
record = (await call("PUT", "price-list", { settings: record.settings, version: record.version })).data;
const { cat } = await office.parts.priceList.catalogue();
const design = fromState(toState({ v: 1, company: cat.id, cfg: cat.cfg, type: "LB", size: "10x20", colors: {} }, cat).state, cat);
const quote = await call("POST", `customers/${first.data.customer.id}/quotes`, { design });
ok("a trusted quote snapshot is saved with the quote", quote.status === 201 && /^[a-f0-9]{64}$/.test(quote.data.quote.snapshot.catalogueId));
const qid = quote.data.quote.id, cid = first.data.customer.id;
const viewPath = `customers/${cid}/quotes/${qid}/designer`;
const savedView = await call("GET", viewPath);
ok("private view uses the original fine print and Lofted Barn", savedView.status === 200 && savedView.data.catalogue.TYPES.LB.name === "Lofted Barn" && savedView.data.catalogue.notes.finePrint === "Original agreed fine print.");
ok("saved catalogue reconstructs every original placement without warnings", toState(design, savedView.data.catalogue, { asSaved: true }).warnings.length === 0);
ok("historical style chips list only the saved style", savedView.data.catalogue.CATS.every(([, styles]) => styles === "LB"));
const originalFetch = globalThis.fetch;
try {
  globalThis.fetch = (url, options) => office.handle(new Request(url, options));
  const loaded = await loadLot("first-lot", { base: "https://reliability.example/", savedQuote: `${cid}/${qid}` });
  ok("authenticated snapshot loading works while the public designer is closed", loaded.catalogue.status === "active" && loaded.savedDesign.type === "LB" && loaded.catalogue.managed.historical);
  ok("historical loader never offers a quote submission address", loaded.catalogue.leads.mode === "none" && loaded.catalogue.managed.quoteUrl === null);
  await assert.rejects(loadLot("other-lot", { base: "https://reliability.example/", savedQuote: `${cid}/${qid}` }), /original building details could not be read/i);
  ok("a historical link cannot substitute another lot", true);
} finally { globalThis.fetch = originalFetch; }
const second = await call("POST", `customers/${cid}/quotes`, { design });
ok("identical building definitions share one immutable archive", second.data.quote.snapshot.catalogueId === quote.data.quote.snapshot.catalogueId && (await store.keys("quote-catalogues/")).length === 1);
ok("another lot's dealer cannot read the saved designer", (await call("GET", viewPath, undefined, "dealer")).status === 404);
ok("an unauthenticated visitor cannot read saved designer details", (await call("GET", viewPath, undefined, "none")).status === 401);
clock.time += 3600000;
record = (await call("GET", "price-list")).data;
record.settings.notes.finePrint = "New fine print after the sale.";
const fineChanged = await call("PUT", "price-list", { settings: record.settings, version: record.version });
ok("a fine-print edit alone keeps the design cfg", fineChanged.status === 200 && fineChanged.data.cfg === cat.cfg);
const raw = await store.get(`customers/${cid}`);
delete raw.quotes.find((q) => q.id === second.data.quote.id).snapshot;
await store.put(`customers/${cid}`, raw);
const legacyPath = `customers/${cid}/quotes/${second.data.quote.id}/designer`;
const legacy = await call("GET", legacyPath);
ok("legacy owner History without original library definitions is never treated as a faithful snapshot", legacy.status === 409 && /original building details are unavailable/i.test(legacy.data.error));
clock.time += 3600000;
record = (await call("GET", "price-list")).data;
delete record.settings.offer.LB;
record.settings.categories = record.settings.categories.map(([label, styles]) => [label, styles.filter((key) => key !== "LB")]).filter(([, styles]) => styles.length);
if (record.settings.defaults?.style === "LB") {
  record.settings.defaults.style = "UT";
  record.settings.defaults.size = Object.keys(record.settings.offer.UT.sizes)[0];
}
record.settings.items.w72 = { price: 325, name: "Later renamed doors" };
const changed = await call("PUT", "price-list", { settings: record.settings, version: record.version });
ok("owner can remove the sold style and rename the current doors: " + (changed.data.error || "saved"), changed.status === 200);
const later = await call("GET", viewPath);
ok("historical view keeps Lofted Barn and original door names", later.status === 200 && later.data.catalogue.TYPES.LB.name === "Lofted Barn" && later.data.catalogue.CAT.w72.n === savedView.data.catalogue.CAT.w72.n);
const laterState = toState(later.data.design, later.data.catalogue, { asSaved: true });
ok("historical building stays Lofted Barn after its removal", laterState.state.type === "LB" && laterState.state.size === "10x20" && laterState.warnings.length === 0);
ok("historical fine print stays the original text", later.data.catalogue.notes.finePrint === "Original agreed fine print.");
const order = await call("POST", `customers/${cid}/orders`, { quoteId: qid, payment: "cash", deposit: 100 });
ok("the order retains its original building and total", order.status === 201 && order.data.order.building === quote.data.quote.building && order.data.order.total === quote.data.quote.total);
for (const key of await store.keys("price-list-history/")) await store.remove(key);
ok("missing legacy history gives an explicit unavailable answer", (await call("GET", legacyPath)).status === 409);
const archiveKey = `quote-catalogues/${quote.data.quote.snapshot.catalogueId}`;
const damagedArchive = await store.get(archiveKey); damagedArchive.catalogue.CAT.w72.n = "Incorrect restored label";
await store.put(archiveKey, damagedArchive);
ok("a damaged archive is rejected instead of changing the original labels", (await call("GET", viewPath)).status === 409);
await store.remove(`quote-catalogues/${quote.data.quote.snapshot.catalogueId}`);
ok("missing saved archive never falls back to today's substituted building", (await call("GET", viewPath)).status === 409);

const before = { brand: { name: "Before", phone: "Old phone", email: "old@example.com" }, notes: { sizeNotes: { 12: "Old" } }, cfg: 1 };
const mine = { brand: { name: "My name", phone: "My phone", email: "old@example.com" }, notes: { sizeNotes: { 12: "Old" } }, cfg: 1 };
const latest = { brand: { name: "Before", phone: "Their phone", email: "new@example.com" }, notes: { sizeNotes: { 12: "Old", 14: "Their note" } }, cfg: 2 };
const merged = mergeSettings(before, mine, latest);
ok("review keeps this editor's name and chosen overlapping phone", merged.brand.name === "My name" && merged.brand.phone === "My phone");
ok("review retains someone else's unrelated email, notes and newer cfg", merged.brand.email === "new@example.com" && merged.notes.sizeNotes[14] === "Their note" && merged.cfg === 2);
console.log(`PROVED (${passed} checks): customer retries create once, original quote definitions and fine print survive later changes, historical access stays private, and reviewed settings retain both people's independent work.`);
