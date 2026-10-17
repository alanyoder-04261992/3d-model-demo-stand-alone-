/* AN OLDER DESIGN'S PRICE LIST IS FOUND WITHOUT READING THE WHOLE HISTORY
   AGAIN (review 17 P3/CS-3).

   A quote sent from the public 3D designer with an older cfg makes the
   server look for the price list that design was made under, in the price
   list's History. It used to read History from the newest copy down for
   every such quote, remembering only 16 answers, so anyone cycling older
   cfg numbers through the public quote form made it read the whole History
   each time. Each History copy is now read at most once while the server
   runs, and the answer is still the newest copy with that cfg.

   Run: node tools/check-history-lookup.mjs (no browser) */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createOffice } from "../server/office/index.js";
import { MemoryBlobs } from "../server/office/store.js";

const read = (p) => JSON.parse(readFileSync(new URL("../" + p, import.meta.url), "utf8"));
const manufacturer = read("library/manufacturers/standard.json"), library = read("library/construction.json");
const templates = { full: read("companies/demo/company.json"), small: read("companies/starter/company.json") };
const SITE = "https://history.example";
const owner = { id: "owner", email: "owner@history.example", confirmedAt: "2026-10-01T00:00:00Z", emailVerified: true };
const blobs = new MemoryBlobs();
let historyReads = 0;
const realGet = blobs.getWithMetadata.bind(blobs);
blobs.getWithMetadata = async (key, ...rest) => { if (String(key).startsWith("price-list-history/")) historyReads++; return realGet(key, ...rest); };
const office = createOffice({ blobs, identityUser: async (req) => (req.headers.get("x-test-person") === "owner" ? owner : null),
  ownerEmail: owner.email, manufacturer, library, templates, now: () => new Date("2026-10-12T12:00:00Z"), log: () => {} });
let checks = 0;
function prove(what, value) { assert.ok(value, what); checks++; console.log("  ok " + what); }
async function call(method, path, body) {
  const r = await office.handle(new Request(SITE + "/api/office/" + path, { method, headers: { "x-test-person": "owner", "content-type": "application/json", origin: SITE }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }));
  return { status: r.status, data: await r.json() };
}

prove("the starting price list is made", (await call("POST", "setup", { businessName: "History Sheds", start: "full", phone: "941-555-0123", agreeTerms: true })).status === 201);
/* 24 price changes, each one a new cfg; the 2x3 window's price says which */
const windowPrice = new Map();
for (let n = 0; n < 24; n++) {
  const pl = (await call("GET", "price-list")).data;
  windowPrice.set(pl.settings.cfg, pl.settings.items.w23?.price);
  pl.settings.items.w23 = { ...(pl.settings.items.w23 || {}), price: 200 + n };
  const saved = await call("PUT", "price-list", { settings: pl.settings, version: pl.version });
  if (saved.status !== 200) throw new Error("save " + n + " failed: " + JSON.stringify(saved.data));
}
const now = (await call("GET", "price-list")).data;
const company = now.settings.id;
const older = [...windowPrice.keys()].filter((cfg) => cfg < now.settings.cfg);
const historyCount = Object.keys(Object.fromEntries([...blobs.values.keys()].filter((k) => k.startsWith("price-list-history/")).map((k) => [k, 1]))).length;
prove("the price list has a long History with many older cfgs", older.length >= 20 && historyCount >= 24);

const priceList = office.parts.priceList;
let right = true;
historyReads = 0;
for (let round = 0; round < 3; round++) {
  for (const cfg of older) {
    const { includedCat } = await priceList.catalogue({ cfg, company });
    if (!includedCat || includedCat.cfg !== cfg || includedCat.CAT.w23.p !== (windowPrice.get(cfg) ?? 195)) right = false;
  }
}
prove("each older cfg gets the price list it was made under", right);
const lookups = older.length * 3;
prove(`${lookups} lookups of ${older.length} older cfgs read History no more than once per copy plus once per lookup (read ${historyReads}, History has ${historyCount})`, historyReads <= historyCount + lookups);
historyReads = 0;
for (const cfg of older) await priceList.catalogue({ cfg, company });
prove(`once History has been read, a round of ${older.length} lookups reads at most one copy each (read ${historyReads})`, historyReads <= older.length);

/* a save after the History was read: its copy is read too, and the newest
   copy with a cfg still wins */
const pl = (await call("GET", "price-list")).data;
const replacedCfg = pl.settings.cfg, replacedPrice = pl.settings.items.w23.price;
pl.settings.items.w23 = { ...pl.settings.items.w23, price: 999 };
prove("one more price change saves", (await call("PUT", "price-list", { settings: pl.settings, version: pl.version })).status === 200);
const lastOld = (await priceList.catalogue({ cfg: replacedCfg, company })).includedCat;
prove("the price list just replaced is found from its new History copy", lastOld?.cfg === replacedCfg && lastOld.CAT.w23.p === replacedPrice);
/* A newer History copy with the same cfg that no longer resolves: the next
   older copy with that cfg is used, as before (review 17 round 2). A fresh
   server, so nothing is remembered from above. */
const brokenCfg = older[2];
const realKey = [...blobs.values.keys()].filter((k) => k.startsWith("price-list-history/") && blobs.values.get(k).data?.settings?.cfg === brokenCfg).sort().pop();
const broken = structuredClone(blobs.values.get(realKey).data); broken.settings.items = null;
await blobs.setJSON(realKey + "a", broken);
const fresh = createOffice({ blobs, identityUser: async () => null, ownerEmail: owner.email, manufacturer, library, templates, now: () => new Date("2026-10-12T12:00:00Z"), log: () => {} });
const fallback = (await fresh.parts.priceList.catalogue({ cfg: brokenCfg, company })).includedCat;
prove("a History copy that no longer resolves is passed over for the next older copy with the same cfg", fallback?.cfg === brokenCfg && fallback.CAT.w23.p === (windowPrice.get(brokenCfg) ?? 195));
console.log(`PROVED (${checks} checks): an older design's price list comes from the newest History copy with its cfg, and each History copy is read at most once while the server runs, so older cfgs sent from the public quote form never make it read the whole History again.`);
