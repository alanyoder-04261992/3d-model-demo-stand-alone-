/* check-all: node
   PROVE that standard layouts save only for the owner, keep every lot on
   the same checked recipe, and that "comes with the building" covers only
   what a design's own size and porch come with: more is charged at its
   normal price through the public and dealer quote routes, never refused
   (Alan, Oct 17 2026: "Yes, charge for them"). */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createOffice } from "../server/office/index.js";
import { MemoryBlobs } from "../server/office/store.js";
import { priceDesign } from "../server/office/pricing.js";
import { resolve } from "../model/company.js";
import { defaults, setType, setSize, fromState, toState } from "../model/design.js";
import { choosePorchLength, chooseSize } from "../ui/state.js";
import { priceParts } from "../model/pricing.js";
import { resetItems } from "../model/layout.js";
import { frameOf } from "../model/frame.js";

const read = (p) => JSON.parse(readFileSync(new URL("../" + p, import.meta.url), "utf8"));
const manufacturer = read("library/manufacturers/standard.json"), library = read("library/construction.json");
const templates = { full: read("companies/demo/company.json"), small: read("companies/starter/company.json") };
const SITE = "https://layouts.example";
const users = Object.fromEntries(["owner", "manager", "dealer"].map((id) => [id, { id, email: `${id}@layouts.example`, confirmedAt: "2026-10-01T00:00:00Z", emailVerified: true }]));
const blobs = new MemoryBlobs();
const office = createOffice({ blobs, identityUser: async (req) => users[req.headers.get("x-test-person")] || null,
  ownerEmail: users.owner.email, manufacturer, library, templates, now: () => new Date("2026-10-12T12:00:00Z"), log: () => {} });
let checks = 0;
function prove(what, value) { assert.ok(value, what); checks++; }
async function call(method, path, body, { person = "owner", origin = SITE } = {}) {
  const headers = { "x-test-person": person, "content-type": "application/json", origin };
  const r = await office.handle(new Request(SITE + "/api/office/" + path, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }));
  return { status: r.status, data: await r.json(), headers: r.headers };
}
const priceList = async () => (await call("GET", "price-list")).data;
const saveLayout = async (layout, extra = {}) => call("POST", "price-list/layout", { style: "LB", layout, version: (await priceList()).version, ...extra });

prove("the owner is signed in", (await call("GET", "me")).status === 200);
prove("the real starting price list is made", (await call("POST", "setup", { businessName: "Layout Sheds", start: "full", phone: "941-555-0123", agreeTerms: true })).status === 201);
for (const name of ["Riverside", "Uptown"]) prove(`${name} is a lot`, (await call("POST", "lots", { name })).status === 201);
for (const role of ["manager", "dealer"]) {
  prove(`${role} is invited`, (await call("POST", "team", { role, email: users[role].email, name: role, lots: ["riverside"] })).status === 201);
  prove(`${role} joins the team`, (await call("GET", "me", undefined, { person: role })).status === 200);
  prove(`${role} cannot open layout mode`, (await call("GET", "layout-mode?style=LB", undefined, { person: role })).status === 403);
  prove(`${role} cannot save a layout`, (await call("POST", "price-list/layout", { style: "LB", layout: [], version: 1 }, { person: role })).status === 403);
}
prove("a visitor cannot open layout mode", (await call("GET", "layout-mode?style=LB", undefined, { person: "" })).status === 401);
prove("an unknown building has useful words", (await call("GET", "layout-mode?style=missing")).status === 404);
const opened = await call("GET", "layout-mode?style=LB");
prove("the owner opens a data recipe, sizes, colors and their company's catalogue", opened.status === 200 && Array.isArray(opened.data.layout) && opened.data.layout.length > 0 && opened.data.sizes.includes("8x12") && opened.data.colors.body && opened.data.catalogue.id === opened.data.companyId && opened.data.own === false);
prove("the layout answer stays private", opened.headers.get("cache-control") === "private, no-store");
const starting = await priceList();
const unchanged = await call("PUT", "price-list", { settings: starting.settings, version: starting.version });
prove("an old list with no layouts saves unchanged", unchanged.status === 200 && unchanged.data.changes.length === 0 && unchanged.data.version === starting.version);
const initialCat = resolve(starting.settings, manufacturer, library);
const olderDesign = fromState(building("LB", "10x20", initialCat), initialCat);
olderDesign.items.find((i) => initialCat.CAT[i.cat].k === "door").pos += 0.25;
const crowdedDesign = fromState(building("SU", "8x12", initialCat), initialCat);
const customerAnswer = await call("POST", "customers", { lot: "riverside", name: "Existing customer", phone: "941-555-0101" });
prove("an existing customer can be saved", customerAnswer.status === 201);
const customer = customerAnswer.data.customer;
const oldQuote = await call("POST", `customers/${customer.id}/quotes`, { design: olderDesign });
prove("a customer already has a saved quote", oldQuote.status === 201);
const oldOrder = await call("POST", `customers/${customer.id}/orders`, { quoteId: oldQuote.data.quote.id, payment: "cash", deposit: 0 });
prove("the old quote is sold at its saved price", oldOrder.status === 201 && oldOrder.data.order.total === oldQuote.data.quote.total);
const recordsBefore = JSON.stringify({ quotes: oldOrder.data.customer.quotes, orders: oldOrder.data.customer.orders });
const layout = [{ cat: "w48", wall: "F", at: "center" }, { cat: "w23", wall: "R", at: { pos: "len*0.15" }, when: { minL: 20 }, ifFits: true }];
const saved = await saveLayout(layout);
prove("a checked layout saves through the real price list", saved.status === 200 && saved.data.version === starting.version + 1 && saved.data.settings.cfg === starting.settings.cfg + 1 && saved.data.lotCount === 2);
prove("the server resolves the owner's layout", JSON.stringify(resolve(saved.data.settings, manufacturer, library).TYPES.LB.loadout) === JSON.stringify(layout));
const recordsAfter = (await call("GET", `customers/${customer.id}`)).data.customer;
prove("a standard layout save keeps existing quotes, orders and prices unchanged", JSON.stringify({ quotes: recordsAfter.quotes, orders: recordsAfter.orders }) === recordsBefore);
const afterLayoutCat = resolve(saved.data.settings, manufacturer, library);
prove("opening an older crowded quote keeps every saved position", JSON.stringify(fromState(toState(crowdedDesign, afterLayoutCat, { asSaved: true }).state, afterLayoutCat).items) === JSON.stringify(crowdedDesign.items));
const olderAgain = await call("POST", `customers/${customer.id}/quotes`, { design: olderDesign });
prove("an older moved design keeps previously included windows after the owner removes them", olderAgain.status === 201 && olderAgain.data.quote.total === oldQuote.data.quote.total);
const forgedOlder = structuredClone(olderDesign);
const gableOld = forgedOlder.items.find((i) => initialCat.CAT[i.cat].gable);
forgedOlder.items.push(structuredClone(gableOld));
const overHistory = await call("POST", `customers/${customer.id}/quotes`, { design: forgedOlder });
prove("an old cfg never allows more included windows than its authoritative history: the extra one is charged at its normal price", overHistory.status === 201 && overHistory.data.quote.total === oldQuote.data.quote.total + afterLayoutCat.CAT[gableOld.cat].p);
const future = structuredClone(olderDesign); future.cfg = saved.data.cfg + 100;
const futureQuote = await call("POST", `customers/${customer.id}/quotes`, { design: future });
const todayOnly = priceDesign({ ...structuredClone(olderDesign), cfg: afterLayoutCat.cfg }, afterLayoutCat).price.total;
prove("an invented cfg cannot claim historical included items: they are charged as today's list says", futureQuote.status === 201 && futureQuote.data.quote.total === todayOnly && todayOnly > oldQuote.data.quote.total);
prove("history says what changed on this building", saved.data.changes.some((s) => s.startsWith("Standard layout of the Lofted Barn:") && /added|removed/.test(s)));
const history = await call("GET", "price-list/history");
prove("history kept the saved version", history.data.entries[0].version === saved.data.version && history.data.entries[0].changes.some((s) => /Standard layout/.test(s)));
prove("opening the owner's recipe doesn't change it", (await call("GET", "layout-mode?style=LB")).data.own === true);
prove("an old layout version cannot overwrite another save", (await call("POST", "price-list/layout", { style: "LB", layout, version: starting.version })).status === 409);
prove("another site cannot save it", (await call("POST", "price-list/layout", { style: "LB", layout, version: saved.data.version }, { origin: "https://elsewhere.example" })).status === 403);
prove("layout saves cannot smuggle price changes", (await saveLayout(layout, { settings: {} })).status === 422);
const clash = await saveLayout([{ cat: "w48", wall: "F", at: "center" }, { cat: "w48", wall: "F", at: "center" }]);
prove("a door clash refuses the save in plain words", clash.status === 422 && /closer|doesn't fit|do not fit|door/.test(clash.data.error));
const noDoor = await saveLayout([{ cat: "w23", wall: "R", at: "center", ifFits: true }]);
prove("every size needs a door", noDoor.status === 422 && /door/i.test(noDoor.data.error));
prove("a misspelled size rule is refused", (await saveLayout([{ cat: "w48", wall: "F", at: "center", when: { minp: 20 } }])).status === 422);
prove("the 100-item cap leaves room for customer additions", (await saveLayout(Array.from({ length: 101 }, () => ({ cat: "w48", wall: "F", at: "center" })))).status === 422);
const withoutItem = structuredClone((await priceList()).settings);
delete withoutItem.items.w36;
prove("an unused door can stop selling", (await call("PUT", "price-list", { settings: withoutItem, version: (await priceList()).version })).status === 200);
const unsold = await saveLayout([{ cat: "w36", wall: "F", at: "center" }]);
prove("a layout cannot give away a door without a price", unsold.status === 422 && /price|sell/i.test(unsold.data.error));
const current = await priceList();
current.settings.status = "active";
prove("the owner opens the designer", (await call("PUT", "price-list", { settings: current.settings, version: current.version })).status === 200);
for (const slug of ["riverside", "uptown"]) {
  const r = await office.handle(new Request(SITE + "/api/lots/" + slug));
  const answer = await r.json();
  prove(`the saved layout reaches ${slug}`, r.status === 200 && JSON.stringify(answer.company.offer.LB.layout) === JSON.stringify(layout));
}
const websiteOld = await office.handle(new Request(SITE + "/api/lots/riverside/quote-requests", {
  method: "POST", headers: { "content-type": "application/json", origin: SITE },
  body: JSON.stringify({ design: olderDesign, contact: { name: "Existing customer", phone: "941-555-0101", zip: "33952" }, idempotencyKey: "older-layout-website-1" }),
}));
const websiteReceipt = await websiteOld.json();
prove("the public designer also keeps an older saved design's included items", websiteOld.status === 201 && websiteReceipt.total === oldQuote.data.quote.total && websiteReceipt.repriced === true);
const websiteForge = await office.handle(new Request(SITE + "/api/lots/riverside/quote-requests", {
  method: "POST", headers: { "content-type": "application/json", origin: SITE },
  body: JSON.stringify({ design: forgedOlder, contact: { name: "Existing customer", phone: "941-555-0101", zip: "33952" }, idempotencyKey: "older-layout-website-2" }),
}));
const websiteForgeReceipt = await websiteForge.json();
prove("public sends charge included items above the historical allowance at their normal price", websiteForge.status === 201 && websiteForgeReceipt.total === oldQuote.data.quote.total + afterLayoutCat.CAT[gableOld.cat].p);

/* These are the real customer actions that used to be rejected by the
   current-size-only included count. Compare with the browser's own price. */
const cat = resolve((await priceList()).settings, manufacturer, library);
function building(type, size, catalogue = cat) {
  const state = defaults(catalogue); setType(state, type, catalogue); state.size = size;
  resetItems(state, frameOf(state, catalogue), catalogue); return state;
}
function quotes(what, state) {
  const before = priceParts(state, cat).total;
  const priced = priceDesign(fromState(state, cat), cat);
  prove(what, priced.price.total === before);
}
for (const [type, from, to] of [["C", "10x20", "8x12"], ["BU", "6x12", "6x8"], ["LB", "10x20", "8x12"]]) {
  const state = building(type, from); state.items.find((i) => cat.CAT[i.cat].k === "door").pos += 0.25;
  setSize(state, to, cat);
  quotes(`${type} keeps its included price after a moved door and smaller size`, state);
}
const cabin = building("SC", "12x24"); choosePorchLength(cabin, 8, cat);
quotes("a Side Cabin keeps its included price with the 4 x 8 porch", cabin);
/* Designs saved by the live designer (c355440, October 13 2026): open a
   size, move a door, choose a smaller size. The items keep their "came
   with the building" marks and the saved design names no other size. Such
   saved links, autosaves and dealer quotes must still send, at the price
   the designer shows (review 17 round 2: a first fix refused them). */
let sentOld = 0;
for (const [type, from, to] of [["C", "12x32", "8x12"], ["SS", "12x24", "8x12"], ["SC", "12x32", "10x20"]]) {
  if (!cat.P[type] || !cat.P[type][from] || !cat.P[type][to]) continue;
  const state = building(type, from); state.items.find((i) => cat.CAT[i.cat].k === "door").pos += 0.25;
  chooseSize(state, to, cat);
  const design = fromState(state, cat); delete design.orig;
  const r = await office.handle(new Request(SITE + "/api/lots/riverside/quote-requests", {
    method: "POST", headers: { "content-type": "application/json", origin: SITE },
    body: JSON.stringify({ design, contact: { name: "Resized customer", phone: "941-555-0102", zip: "33952" }, idempotencyKey: `resized-${type}-${from}-${to}` }),
  }));
  const receipt = await r.json();
  prove(`a ${type} ${from} made ${to} on the live designer still sends, at the designer's price`, r.status === 201 && receipt.total === priceParts(toState(design, cat).state, cat).total);
  sentOld++;
}
prove("the resized designs above were really sent (the price list sells those sizes)", sentOld >= 2);
/* Alan, Oct 17 2026, "Yes, charge for them" (review 17 CS-1): an 8x12
   Cabin link edited by hand to keep the 12x32's included windows is
   charged the normal window price for each window above what an 8x12
   comes with, through the public quote route and the dealer quote route
   (c355440 gave them away). The same design made in the designer (12x32,
   move a door, pick 8x12) is priced the same, and the designer shows it. */
{
  const big = building("C", "12x32"), small = building("C", "8x12");
  const isWin = (i) => i.inc && cat.CAT[i.cat].k === "win";
  const extra = big.items.filter(isWin).length - small.items.filter(isWin).length;
  const edited = fromState(small, cat);
  const w = edited.items.find(isWin);
  for (let n = 0; n < extra; n++) edited.items.push({ ...structuredClone(w), pos: 0.1 + 0.1 * n });
  const fair = priceParts(small, cat).total + extra * cat.CAT[w.cat].p;
  const r = await office.handle(new Request(SITE + "/api/lots/riverside/quote-requests", {
    method: "POST", headers: { "content-type": "application/json", origin: SITE },
    body: JSON.stringify({ design: edited, contact: { name: "Edited link", phone: "941-555-0103", zip: "33952" }, idempotencyKey: "edited-cabin-8x12" }),
  }));
  const receipt = await r.json();
  prove(`an 8x12 Cabin link edited to keep the 12x32's ${extra} included windows is charged ${extra} x the window price on the public quote route`, extra > 0 && r.status === 201 && receipt.total === fair
    && receipt.price.lines.filter((l) => l[2] === "cat." + w.cat && l[1] === cat.CAT[w.cat].p && !/upgrade/.test(l[0])).length === extra);
  const dealerQuote = await call("POST", `customers/${customer.id}/quotes`, { design: edited }, { person: "dealer" });
  prove("... and the same on the dealer quote route", dealerQuote.status === 201 && dealerQuote.data.quote.total === fair);
  const made = building("C", "12x32"); made.items.find((i) => cat.CAT[i.cat].k === "door").pos += 0.25;
  chooseSize(made, "8x12", cat);
  prove("the same building made in the designer (12x32, move a door, pick 8x12) shows that price", priceParts(made, cat).total === fair && priceDesign(fromState(made, cat), cat).price.total === fair);
}
const forged = fromState(building("LB", "10x20"), cat);
const twin = forged.items.find((i) => i.cat === "w48");
forged.items.push(structuredClone(twin));
prove("a second door marked as coming with the building is charged at its normal price, never refused", priceDesign(forged, cat).price.total === priceParts(building("LB", "10x20"), cat).total + cat.CAT.w48.p);
const back = await saveLayout(null);
prove("going back removes only the chosen layout", back.status === 200 && !("layout" in back.data.settings.offer.LB) && back.data.changes.some((s) => /went back to the builder's layout/.test(s)));
const raceVersion = back.data.version;
const alternate = structuredClone(layout); alternate[1].at = { pos: "len*0.1" };
const raced = await Promise.all([layout, alternate].map((recipe) => call("POST", "price-list/layout", { style: "LB", layout: recipe, version: raceVersion })));
prove("two layout saves at once keep one result and refuse the other", raced.filter((r) => r.status === 200).length === 1 && raced.filter((r) => r.status === 409).length === 1);
const nowRecord = await priceList();
const hurried = createOffice({ blobs, identityUser: async (req) => users[req.headers.get("x-test-person")] || null,
  ownerEmail: users.owner.email, manufacturer, library, templates, now: () => new Date("2026-10-12T12:00:00Z"), sizeCheckMs: 0, log: () => {} });
const slowerLayout = structuredClone(layout); slowerLayout[1].at = { pos: "len*0.12" };
const noTime = await hurried.handle(new Request(SITE + "/api/office/price-list/layout", { method: "POST", headers: { "x-test-person": "owner", "content-type": "application/json", origin: SITE }, body: JSON.stringify({ style: "LB", layout: slowerLayout, version: nowRecord.version }) }));
prove("a layout whose budget runs out cannot save unchecked sizes", noTime.status === 422 && (await priceList()).version === nowRecord.version);
/* Each whole allowance belongs to one authoritative price list. Old and
   new doors must never be combined into a bigger free allowance. */
const utilityBefore = await priceList();
const utilityBeforeCat = resolve(utilityBefore.settings, manufacturer, library);
const oldUtility = fromState(building("UT", "10x20", utilityBeforeCat), utilityBeforeCat);
prove("the historical Utility comes with double doors", oldUtility.items.some((i) => i.cat === "w72" && i.inc));
const replacedDoor = await call("POST", "price-list/layout", { style: "UT", layout: [{ cat: "w48", wall: "F", at: "center" }], version: utilityBefore.version });
prove("the owner replaces the Utility's standard door", replacedDoor.status === 200);
const actualHistory = await office.parts.priceList.catalogue({ cfg: oldUtility.cfg, company: oldUtility.company });
prove("the old allowance is loaded from its real saved history", actualHistory.includedCat?.cfg === oldUtility.cfg);
const realOld = await call("POST", `customers/${customer.id}/quotes`, { design: oldUtility });
prove("a genuine old door stays included from its historical price list", realOld.status === 201 && realOld.data.quote.total === priceParts(toState(oldUtility, utilityBeforeCat).state, utilityBeforeCat).total);
const currentUtility = fromState(building("UT", "10x20", actualHistory.cat), actualHistory.cat);
prove("the genuine current door stays included", (await call("POST", `customers/${customer.id}/quotes`, { design: currentUtility })).status === 201);
const union = structuredClone(oldUtility);
union.items.push({ cat: "w48", wall: "B", pos: 0, inc: true });
const unionQuote = await call("POST", `customers/${customer.id}/quotes`, { design: union });
prove("old and current included doors cannot be combined into a free allowance: one of them is charged", unionQuote.status === 201 && unionQuote.data.quote.total === realOld.data.quote.total + actualHistory.cat.CAT.w48.p);
union.items.at(-1).inc = false;
const paid = await call("POST", `customers/${customer.id}/quotes`, { design: union });
prove("the extra replacement door can be bought at its current price", paid.status === 201 && paid.data.quote.total === realOld.data.quote.total + actualHistory.cat.CAT.w48.p);
const dependencyRecord = await priceList();
const dependencySettings = structuredClone(dependencyRecord.settings);
const cabinRecipe = (await call("GET", "layout-mode?style=C")).data.layout;
cabinRecipe.find((entry) => entry.cat === "d36lite").cat = "d36in";
dependencySettings.offer.C.layout = cabinRecipe;
dependencySettings.offer = { C: dependencySettings.offer.C };
dependencySettings.categories = [["Cabins", ["C"]]];
dependencySettings.defaults.style = "C";
dependencySettings.defaults.size = "10x20";
delete dependencySettings.items.d36lite;
const dependency = await call("PUT", "price-list", { settings: dependencySettings, version: dependencyRecord.version });
prove("an unpriced item used only for a layout's measurements gets useful owner words", dependency.status === 422
  && dependency.data.problems.some((words) => words.includes("standard layout of the Cabin uses its size") && words.includes("Sell it on Doors & windows") && !/items\.|CAT\./.test(words)));
console.log(`PROVED (${checks} checks): owners save checked standard layouts for every lot, history and version checks hold, and items marked as coming with the building are free only up to what the design's own size and porch come with: the rest is charged at its normal price, never refused.`);
