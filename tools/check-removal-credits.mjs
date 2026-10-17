/* check-all: node
   PROVE a door or window taken off comes off the price only for what the
   building really came with (final review of Oct 17 2026; each step fails
   on b81183a):
   1. the porch length chosen: a Side Cabin on the 8 ft porch is never
      credited for the 12 ft porch's extra window, by a link edited by hand
      or by the designer (12 ft porch, take a window off, pick 8 ft);
   2. a layout with a double and a single of the same window: taking off
      the single comes off at one pane, and making the single double is
      charged its second pane;
   3. a design naming an older price list: never credited for what today's
      own standard does not have;
   4. a porch post is never credited (Alan's words: doors and windows);
   5. an older design is saved with its older price list version, so it
      prices the same when it is sent again;
   6. the lot's answer for an older version carries today's price list with
      only the older standard layouts, never the older prices or settings.
   The designer and the server give the same total every time. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createOffice } from "../server/office/index.js";
import { MemoryBlobs } from "../server/office/store.js";
import { priceDesign } from "../server/office/pricing.js";
import { resolve } from "../model/company.js";
import * as D from "../model/design.js";
import * as UI from "../ui/state.js";
import { priceParts } from "../model/pricing.js";
import { loadCatalogue, loadCompany } from "./lib/load.mjs";

const copy = (x) => JSON.parse(JSON.stringify(x));
const server = (d, cat, ctx) => priceDesign(structuredClone(d), cat, ctx).price.total;
const both = (s, cat, ctx) => {
  const des = priceParts(s, cat).total, srv = server(D.fromState(s, cat), cat, ctx);
  assert.equal(srv, des, "the designer and the server give the same total");
  return des;
};
const std = (cat, type, size, len) => {
  const s = D.defaults(cat); UI.chooseType(s, type, cat); UI.chooseSize(s, size, cat);
  if (len) UI.choosePorchLength(s, len, cat);
  return s;
};

/* 1. the porch length chosen */
{
  const cat = loadCatalogue("demo");
  const s8 = std(cat, "SC", "10x20", 8), full = both(s8, cat);
  const forged = { ...D.fromState(s8, cat), removed: ["w23"] };
  assert.equal(server(forged, cat), full, "8 ft porch, nothing taken off, a window named as taken off: no credit");
  const s = std(cat, "SC", "10x20", 12);
  UI.removeItem(s, s.items.find((i) => i.cat === "w23").id);
  const twelve = both(s, cat);
  assert.equal(twelve, full - cat.CAT.w23.p, "12 ft porch with a window taken off: the window comes off");
  UI.choosePorchLength(s, 8, cat);
  assert.equal(s.items.filter((i) => i.cat === "w23").length, s8.items.filter((i) => i.cat === "w23").length, "the building is now the 8 ft porch's standard");
  assert.equal(both(s, cat), full, "so it costs the 8 ft porch's standard price");
  console.log(`ok 1 Side Cabin 10×20: 8 ft porch standard $${full}; a hand-edited "window taken off" stays $${full}; 12 ft porch less a window $${twelve}, then the 8 ft porch $${full}`);
}

/* 2. a double and a single of the same window */
{
  const d = loadCompany("demo"), co = copy(d.company); co.cfg++;
  co.offer.C = { ...(co.offer.C || {}), layout: [{ cat: "d36lite", wall: "F", at: "center" }, { cat: "w23", wall: "B", at: "center", dbl: true }, { cat: "w23", wall: "R", at: "center" }] };
  const cat = resolve(co, d.manufacturer, d.library), pane = cat.CAT.w23.p;
  const base = both(std(cat, "C", "10x16"), cat);
  const s = std(cat, "C", "10x16");
  UI.removeItem(s, s.items.find((i) => i.cat === "w23" && !i.dbl).id);
  assert.equal(both(s, cat), base - pane, "taking off the single comes off at one pane");
  const s2 = std(cat, "C", "10x16");
  UI.removeItem(s2, s2.items.find((i) => i.cat === "w23" && i.dbl).id);
  assert.equal(both(s2, cat), base - 2 * pane, "taking off the double comes off at two panes");
  const s3 = std(cat, "C", "10x16");
  UI.toggleDouble(s3, s3.items.find((i) => i.cat === "w23" && !i.dbl).id, cat);
  assert.equal(both(s3, cat), base + pane, "making the single double charges its second pane");
  console.log(`ok 2 a Cabin that comes with a double and a single window ($${base}): single off $${base - pane}, double off $${base - 2 * pane}, single made double $${base + pane}`);
}

/* 3. an older price list never credits what today's standard does not have */
{
  const b = loadCompany("demo"), oldCo = copy(b.company);
  const oldCat = resolve(oldCo, b.manufacturer, b.library);
  const old = D.fromState(std(oldCat, "C", "10x16"), oldCat);
  const oldKeys = old.items.filter((i) => i.inc && !i.pk).map((i) => i.cat);
  const newCo = copy(b.company); newCo.cfg = oldCo.cfg + 1;
  newCo.offer.C = { ...(newCo.offer.C || {}), layout: [{ cat: "d36lite", wall: "F", at: "center" }, { cat: "w23", wall: "R", at: "center" }] };
  const cat = resolve(newCo, b.manufacturer, b.library);
  const today = D.fromState(std(cat, "C", "10x16"), cat), price = server(today, cat);
  assert.ok(oldKeys.filter((k) => k === "w23").length > 1, "the older Cabin came with more windows");
  const forged = { ...copy(today), cfg: oldCo.cfg, removed: oldKeys };
  assert.equal(server(forged, cat, { includedCat: oldCat }), price, "today's standard naming the older list and its items as taken off: no credit");
  const empty = { ...copy(today), cfg: oldCo.cfg, items: [], removed: [...oldKeys, ...oldKeys] };
  const fair = price - cat.CAT.w23.p - cat.CAT.d36lite.p;
  assert.equal(server(empty, cat, { includedCat: oldCat }), fair, "an empty building comes off by today's door and window only");
  const designer = Object.freeze({ ...cat, olderIncluded: oldCat });
  assert.equal(priceParts(D.toState(forged, designer).state, designer).total, price, "the designer shows the same");
  console.log(`ok 3 today's Cabin is one door and one window ($${price}); naming the older 3-window list credits nothing extra; an empty building is $${fair}`);
}

/* 4. a porch post is never credited */
{
  const d = loadCompany("demo"), co = copy(d.company); co.cfg++;
  co.items = { ...co.items, ppost: 90 };
  const cat = resolve(co, d.manufacturer, d.library);
  const s = std(cat, "SC", "10x20", 8), full = both(s, cat);
  const post = s.items.find((i) => i.cat === "ppost");
  assert.ok(post, "the Side Cabin comes with porch posts");
  UI.removeItem(s, post.id);
  assert.equal(both(s, cat), full, "a porch post taken off does not come off the price");
  console.log(`ok 4 a porch post priced at $90 taken off: the price stays $${full}`);
}

/* 5 and 6: through the Dealer Center */
{
  const R = (p) => JSON.parse(readFileSync(new URL("../" + p, import.meta.url), "utf8"));
  const manufacturer = R("library/manufacturers/standard.json"), library = R("library/construction.json");
  const templates = { full: R("companies/demo/company.json"), small: R("companies/starter/company.json") };
  const SITE = "https://credits.example";
  const users = { owner: { id: "owner", email: "owner@credits.example", confirmedAt: "2026-10-01T00:00:00Z", emailVerified: true } };
  const office = createOffice({ blobs: new MemoryBlobs(), identityUser: async (req) => users[req.headers.get("x-test-person")] || null,
    ownerEmail: users.owner.email, manufacturer, library, templates, now: () => new Date("2026-10-17T12:00:00Z"), log: () => {} });
  const call = async (method, path, body) => {
    const r = await office.handle(new Request(SITE + "/api/office/" + path, { method, headers: { "x-test-person": "owner", "content-type": "application/json", origin: SITE }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }));
    return { status: r.status, data: await r.json() };
  };
  const lot = async (q = "") => (await office.handle(new Request(SITE + "/api/lots/riverside" + q, { headers: { origin: SITE } }))).json();
  await call("POST", "setup", { businessName: "Credit Sheds", start: "full", phone: "941-555-0123", agreeTerms: true });
  await call("POST", "lots", { name: "Riverside" });
  let pl = (await call("GET", "price-list")).data; pl.settings.status = "active";
  await call("PUT", "price-list", { settings: pl.settings, version: pl.version });
  pl = (await call("GET", "price-list")).data;
  const oldCat = resolve(pl.settings, manufacturer, library);
  const oldDesign = D.fromState(std(oldCat, "C", "10x16"), oldCat);
  /* the owner changes the Cabin to one door and one window, and a price */
  pl.settings.offer.C = { ...(pl.settings.offer.C || {}), layout: [{ cat: "d36lite", wall: "F", at: "center" }, { cat: "w23", wall: "R", at: "center" }] };
  pl.settings.items = { ...pl.settings.items, w23: 205 };
  assert.equal((await call("PUT", "price-list", { settings: pl.settings, version: pl.version })).status, 200);
  const now = (await call("GET", "price-list")).data.settings;
  assert.ok(now.cfg > oldCat.cfg, "the price list has a newer version");

  const plain = await lot(), older = await lot("?cfg=" + oldCat.cfg);
  assert.ok(older.included && older.included.cfg === oldCat.cfg, "the lot answers with the older version");
  const a = copy(older.included.company), b = copy(plain.company);
  assert.deepEqual(a.items, b.items, "today's prices, never the older ones");
  a.offer.C.layout = b.offer.C.layout; a.cfg = b.cfg;
  assert.deepEqual(a, b, "today's price list apart from the older standard layouts");
  console.log(`ok 6 the lot's older version ${oldCat.cfg} is today's price list with only the older standard layouts`);

  const cust = (await call("POST", "customers", { lot: "riverside", name: "Older design", phone: "941-555-0199" })).data.customer;
  const take = copy(oldDesign);
  take.items.splice(take.items.findIndex((i) => i.cat === "w23"), 1); take.removed = ["w23"];
  const first = (await call("POST", `customers/${cust.id}/quotes`, { design: take })).data.quote;
  assert.equal(first.design.cfg, oldCat.cfg, "saved with the older version it was priced under");
  const again = (await call("POST", `customers/${cust.id}/quotes`, { design: first.design })).data.quote;
  assert.equal(again.total, first.total, "sent again, the same total");
  console.log(`ok 5 an older Cabin less a window is quoted $${first.total}, saved with version ${first.design.cfg}, and sent again at $${again.total}`);
}
console.log("check-removal-credits: every step passed");
