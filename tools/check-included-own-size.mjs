/* check-all: node
   PROVE Alan's Oct 17 2026 decision ("Yes, charge for them"): an item marked
   "comes with the building" is free only up to how many of it the design's
   own size and porch come with; the rest is charged at its normal price,
   never refused, through every route that prices a design; saved quotes
   and orders keep the total they were saved with.

   The case (review 17 CS-1): an 8x12 Cabin with the 12x32's windows still
   marked included, made in the designer (12x32, move a door, pick 8x12) or
   by editing a design link by hand. On c355440 both were given away free
   through the public quote route and the dealer quote route.

   Review 17 FREE (each fails on bf2be2c):
   FREE-1 a side porch's length is a free choice at the same price: the
          porch chip lays an untouched layout out again for the new porch,
          and a changed layout is never charged for the windows the other
          porch length comes with (step 3);
   FREE-2 a design made before the owner changed a standard layout: the
          designer, given the lot's copy of that older price list, shows
          what the server charges, and the server never charges more for it
          (step 5);
   FREE-4 a charged item is saved as added, a stand-in as a swap from the
          item it stands in for, named plainly (step 6);
   FREE-6 the line says what this size comes with (step 2).
   Alan, Oct 17 2026 (step 7): "standard" is the business's own standard
   layout; a standard door or window the customer removes comes off the
   price ("Yes, take its price off"); the library's layout gives nothing
   free and charges nothing for a business with its own. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createOffice } from "../server/office/index.js";
import { MemoryBlobs } from "../server/office/store.js";
import { priceDesign } from "../server/office/pricing.js";
import { resolve } from "../model/company.js";
import { defaults, setType, fromState, toState } from "../model/design.js";
import { chooseSize, chooseType, choosePorchLength, addItem, removeItem } from "../ui/state.js";
import * as UI from "../ui/state.js";
import { priceParts } from "../model/pricing.js";
import { resetItems } from "../model/layout.js";
import { frameOf, sidePorchLengthsFor } from "../model/frame.js";

const read = (p) => JSON.parse(readFileSync(new URL("../" + p, import.meta.url), "utf8"));
const manufacturer = read("library/manufacturers/standard.json"), library = read("library/construction.json");
const templates = { full: read("companies/demo/company.json"), small: read("companies/starter/company.json") };
const SITE = "https://included.example";
const users = Object.fromEntries(["owner", "dealer"].map((id) => [id, { id, email: `${id}@included.example`, confirmedAt: "2026-10-01T00:00:00Z", emailVerified: true }]));
const blobs = new MemoryBlobs();
const office = createOffice({ blobs, identityUser: async (req) => users[req.headers.get("x-test-person")] || null,
  ownerEmail: users.owner.email, manufacturer, library, templates, now: () => new Date("2026-10-17T12:00:00Z"), log: () => {} });
let checks = 0;
const said = [], failed = [];
/* every check runs, so a failure says each thing that is wrong */
function prove(what, value, detail = "") {
  checks++;
  if (value) said.push(what); else failed.push(what + (detail ? ` -- ${detail}` : ""));
}
const note = (s) => (typeof UI.chargedNote === "function" ? UI.chargedNote(s, cat) : "(the designer has no line for it)");
async function call(method, path, body, { person = "owner" } = {}) {
  const headers = { "x-test-person": person, "content-type": "application/json", origin: SITE };
  const r = await office.handle(new Request(SITE + "/api/office/" + path, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }));
  return { status: r.status, data: await r.json() };
}
let keyN = 0;
async function website(design, name = "Website customer") {
  const r = await office.handle(new Request(SITE + "/api/lots/riverside/quote-requests", {
    method: "POST", headers: { "content-type": "application/json", origin: SITE },
    body: JSON.stringify({ design, contact: { name, phone: `941-555-01${String(keyN).padStart(2, "0")}`, zip: "33952" }, idempotencyKey: `included-own-size-${keyN++}` }),
  }));
  return { status: r.status, data: await r.json() };
}

assert.equal((await call("POST", "setup", { businessName: "Included Sheds", start: "full", phone: "941-555-0123", agreeTerms: true })).status, 201);
assert.equal((await call("POST", "lots", { name: "Riverside" })).status, 201);
assert.equal((await call("POST", "team", { role: "dealer", email: users.dealer.email, name: "dealer", lots: ["riverside"] })).status, 201);
assert.equal((await call("GET", "me", undefined, { person: "dealer" })).status, 200);
const listNow = (await call("GET", "price-list")).data;
listNow.settings.status = "active";
assert.equal((await call("PUT", "price-list", { settings: listNow.settings, version: listNow.version })).status, 200);
const cat = resolve((await call("GET", "price-list")).data.settings, manufacturer, library);
const customer = (await call("POST", "customers", { lot: "riverside", name: "Dealer customer", phone: "941-555-0199" }, { person: "dealer" })).data.customer;

function building(type, size) {
  const s = defaults(cat); setType(s, type, cat); s.size = size; resetItems(s, frameOf(s, cat), cat); return s;
}
const isWin = (i) => i.inc && !i.pk && cat.CAT[i.cat].k === "win";

/* 1. The forged link: an 8x12 Cabin with the 12x32's windows marked included */
const big = building("C", "12x32"), small = building("C", "8x12");
const extra = big.items.filter(isWin).length - small.items.filter(isWin).length;
const smallPrice = priceParts(small, cat).total;
const forged = fromState(small, cat);
const win = forged.items.find(isWin);
for (let n = 0; n < extra; n++) forged.items.push({ ...structuredClone(win), pos: -2 + 0.5 * n });
const windowPrice = cat.CAT[win.cat].p;
const charged = smallPrice + extra * windowPrice;
prove(`a 12x32 Cabin comes with ${extra} more windows than an 8x12`, extra > 0);

const pub = await website(forged);
prove(`public quote route (POST /api/lots/riverside/quote-requests): the forged 8x12 is charged ${extra} x ${windowPrice} for the windows an 8x12 does not come with`,
  pub.status === 201 && pub.data.total === charged, `${pub.status} ${JSON.stringify(pub.data.total ?? pub.data.error)} (want ${charged}, was ${smallPrice} on c355440)`);
prove("... each charged window is its own line at the normal window price, not an upgrade",
  pub.data.price.lines.filter((l) => l[2] === "cat." + win.cat && l[1] === windowPrice && !/upgrade/.test(l[0])).length === extra);
const dealer = await call("POST", `customers/${customer.id}/quotes`, { design: forged }, { person: "dealer" });
prove("dealer quote route (POST /api/office/customers/<id>/quotes): the same price", dealer.status === 201 && dealer.data.quote.total === charged,
  `${dealer.status} ${dealer.data.quote?.total ?? dealer.data.error}`);
const order = await call("POST", `customers/${customer.id}/orders`, { quoteId: dealer.data.quote.id, payment: "cash", deposit: 0 }, { person: "dealer" });
prove("an order from that quote totals the charged price", order.status === 201 && order.data.order.total === charged);

/* 2. The same building made in the designer, and the line it shows */
const made = building("C", "12x32");
made.items.find((i) => cat.CAT[i.cat].k === "door").pos += 0.25;
chooseSize(made, "8x12", cat);
prove("the designer (12x32, move a door, pick 8x12) shows the same total the server charges",
  priceParts(made, cat).total === charged && priceDesign(fromState(made, cat), cat).price.total === charged);
const line = note(made);
const comes = small.items.filter(isWin).length;
const LINE = `An 8×12 comes with ${comes} window${comes === 1 ? "" : "s"}, so ${extra} of your windows are charged.`;
prove(`... and says so in one plain line: "${line}"`, line === LINE, line);
const sent = await website(fromState(made, cat), "Designer customer");
prove("... and the public route charges the designer's total", sent.status === 201 && sent.data.total === priceParts(made, cat).total);
const back = toState(fromState(made, cat), cat).state;
prove("a reopened link says the same line", note(back) === LINE && priceParts(back, cat).total === charged);
chooseSize(made, "12x32", cat);
prove("going back to 12x32 makes them free again, with nothing said", priceParts(made, cat).total === priceParts(big, cat).total + 0 && note(made) === "");

/* 3. Honest designs keep their price: every style and size the business
   sells, as laid out, with each side-porch length picked on its chip
   (review 17 FREE-1: on bf2be2c the Side Cabin and Loft Side Cabin chip
   kept the 12 ft porch's layout on the 8 ft porch and charged a window),
   and with a window moved first and then each porch length */
let honest = 0, chips = 0, touchedChips = 0;
const wrong = [];
const priceOf = (s) => ({ designer: priceParts(s, cat).total, server: priceDesign(fromState(s, cat), cat).price.total });
for (const type of Object.keys(cat.TYPES)) for (const size of Object.keys(cat.P[type])) {
  const s = building(type, size);
  const lens = cat.TYPES[type].porch === "S" ? sidePorchLengthsFor(cat.TYPES[type], frameOf(s, cat).d.L) : [null];
  for (const len of lens) {
    if (len != null) choosePorchLength(s, len, cat);
    const p = priceParts(s, cat);
    if (p.lines.some((l) => /^cat\./.test(l[2])) || priceDesign(fromState(s, cat), cat).price.total !== p.total || note(s) !== "") wrong.push(`${type} ${size}${len ? ` ${len} ft porch` : ""}: ${JSON.stringify(p.lines)} "${note(s)}"`);
    honest++;
  }
  if (lens.length < 2) continue;
  const base = cat.P[type][size];
  for (const len of lens) {
    /* the chip on an untouched layout: laid out again, the price unchanged */
    const u = building(type, size);
    choosePorchLength(u, len, cat);
    const up = priceOf(u);
    prove(`${type} ${size}: the ${len} ft porch chip keeps the price ${base} (designer ${up.designer}, server ${up.server}) and lays the porch's own layout`,
      up.designer === base && up.server === base && UI.isStandardLayout(u, cat) && note(u) === "");
    chips++;
    /* then another size still lays its own layout out */
    const other = Object.keys(cat.P[type]).find((z) => z !== size);
    if (other) { const r = chooseSize(u, other, cat); prove(`${type} ${size}: after the ${len} ft chip, picking ${other} still lays its own layout out at its own price`, r.relaid === true && priceOf(u).designer === cat.P[type][other] && priceOf(u).server === cat.P[type][other]); }
    /* a window moved first, then the chip: the windows are kept, never charged */
    const t = building(type, size);
    const w = t.items.find((i) => i.inc && cat.CAT[i.cat].k === "win");
    if (!w) continue;
    UI.moveItem(t, w.id, { pos: w.pos + 0.25 }, cat);
    for (const to of lens) {
      choosePorchLength(t, to, cat);
      const tp = priceOf(t);
      prove(`${type} ${size}: a changed layout moved to the ${to} ft porch is not charged (designer ${tp.designer}, server ${tp.server})`, tp.designer === base && tp.server === base && note(t) === "");
      touchedChips++;
    }
  }
}
prove(`${honest} standard buildings (every style, size and side-porch length) have every door and window free, priced the same by the designer and the server`, honest > 50 && !wrong.length, wrong.slice(0, 6).join("; "));
prove(`${chips} porch chips on untouched side porches and ${touchedChips} on changed ones keep the building's price`, chips >= 10 && touchedChips >= 10);

/* 4. Saved quotes and orders keep the price they were saved with. A quote
   saved on c355440 (extra windows free) is written as it was stored; the
   Dealer Center shows it, sells it and opens it at that total, and only a
   new quote ("Change it") uses the rule. */
const keep = (await call("POST", "customers", { lot: "riverside", name: "Earlier customer", phone: "941-555-0188" })).data.customer;
const first = await call("POST", `customers/${keep.id}/quotes`, { design: fromState(small, cat) });
const oldTotal = smallPrice;
await office.parts.store.change(`customers/${keep.id}`, (c) => {
  const q = c.quotes.find((x) => x.id === first.data.quote.id);
  q.design = structuredClone(forged);
  q.design.cfg = cat.cfg;
  q.price = { base: cat.P.C["8x12"], lines: [], total: oldTotal };
  q.total = oldTotal;
});
const seen = (await call("GET", `customers/${keep.id}`)).data.customer;
prove("a quote saved before the change still shows the total it was saved with", seen.quotes[0].total === oldTotal && seen.quotes[0].price.total === oldTotal);
const view = await call("GET", `customers/${keep.id}/quotes/${first.data.quote.id}/designer`);
prove("... opened from the Dealer Center, it brings the price it was saved with", view.status === 200 && view.data.historical === true && view.data.price?.total === oldTotal && view.data.total === oldTotal,
  `${view.status} ${JSON.stringify(view.data.price || view.data.error)}`);
const sold = await call("POST", `customers/${keep.id}/orders`, { quoteId: first.data.quote.id, payment: "cash", deposit: 0 });
prove("... sold, the order keeps that total", sold.status === 201 && sold.data.order.total === oldTotal);
const changed = await call("POST", `customers/${keep.id}/quotes`, { design: view.data.design });
prove("... priced again (Change it, a new quote), the rule counts", changed.status === 201 && changed.data.quote.total === charged);
const again = (await call("GET", `customers/${keep.id}`)).data.customer;
prove("... and the first quote and its order still say the saved total", again.quotes.find((q) => q.id === first.data.quote.id).total === oldTotal && again.orders[0].total === oldTotal);

/* 5. FREE-2: a design made before the owner changed a standard layout.
   The owner takes the Lofted Barn's double doors and faux loft window out
   of its standard layout. The server prices a design made before with
   what its own price list came with (its History copy) when that costs
   less; the lot sends the designer that same copy for the design's
   version, so the page shows what the server charges, and neither raises
   the old design's price. */
const before = (await call("GET", "price-list")).data;
const oldCat = resolve(before.settings, manufacturer, library);
const lb = defaults(oldCat); setType(lb, "LB", oldCat); lb.size = "10x20"; resetItems(lb, frameOf(lb, oldCat), oldCat);
const oldDesign = fromState(lb, oldCat);
const oldLb = priceParts(lb, oldCat).total;
before.settings.offer.LB.layout = [{ cat: "w48", wall: "B", at: "center" }];
const put = await call("PUT", "price-list", { settings: before.settings, version: before.version });
const newCat = resolve((await call("GET", "price-list")).data.settings, manufacturer, library);
prove("the owner saves a new Lofted Barn layout, and the price list moves to a new version", put.status === 200 && newCat.cfg > oldCat.cfg, `${put.status} ${JSON.stringify(put.data.error || "")}`);
const lotAnswer = async (q) => { const r = await office.handle(new Request(SITE + "/api/lots/riverside" + q, { headers: { origin: SITE } })); return { status: r.status, data: await r.json() }; };
const asked = await lotAnswer(`?cfg=${oldCat.cfg}`);
prove("the lot sends the designer its kept copy of the older version when a link of that version is opened (GET /api/lots/riverside?cfg=old)",
  asked.status === 200 && asked.data.included?.cfg === oldCat.cfg && asked.data.included.company?.cfg === oldCat.cfg, JSON.stringify(Object.keys(asked.data)));
prove("... and nothing for today's version, a version it never had, or no version",
  !(await lotAnswer(`?cfg=${newCat.cfg}`)).data.included && !(await lotAnswer("?cfg=9999")).data.included && !(await lotAnswer("?cfg=x")).data.included && !(await lotAnswer("")).data.included);
const pageCat = Object.freeze({ ...newCat, olderIncluded: asked.data.included ? resolve(asked.data.included.company, manufacturer, library) : undefined });
const opened = toState(structuredClone(oldDesign), pageCat).state;
const shown = priceParts(opened, pageCat).total;
const fromPage = fromState(opened, pageCat, { priced: true });
const olderSent = await website(fromPage, "Older link customer");
prove(`the designer shows the older design at ${shown}, what the server charges for what the page sends (${olderSent.data.total})`, olderSent.status === 201 && olderSent.data.total === shown && fromPage.priced.total === shown,
  `${olderSent.status} ${olderSent.data.total ?? olderSent.data.error}`);
prove(`... which is the price it was made at (${oldLb}): the owner's change never makes it dearer`, shown === oldLb && priceDesign(structuredClone(oldDesign), newCat, { includedCat: oldCat }).price.total === oldLb);
prove("... and the line under the price says nothing is charged", UI.chargedNote(opened, pageCat) === "");
const plain = toState(structuredClone(oldDesign), newCat).state;
const plainSent = await website(fromState(plain, newCat), "Older link, no copy");
prove("without the older copy the page and the server both use today's layout, and agree", plainSent.status === 201 && plainSent.data.total === priceParts(plain, newCat).total);

/* 6. FREE-4: what is saved, printed and sold says what was charged. The
   dealer's quote from step 1 keeps the windows an 8x12 comes with marked
   included and saves the charged ones as added; a Cottage made 10x16, a
   door moved, then 10x12, keeps its 72 in double doors as a swap from the
   48 in door the 10x12 comes with, named plainly, at the difference. */
const savedItems = dealer.data.quote.design.items;
const incWins = savedItems.filter((i) => i.inc && cat.CAT[i.cat].k === "win").length, addedWins = savedItems.filter((i) => !i.inc && !i.pk && cat.CAT[i.cat].k === "win").length;
prove(`the saved 8x12 lists ${comes} window${comes === 1 ? "" : "s"} it comes with and the ${extra} charged ones as added`, incWins === comes && addedWins === extra, `${incWins} included, ${addedWins} added`);
prove("... and the saved design prices to the saved total", priceParts(toState(dealer.data.quote.design, cat).state, cat).total === dealer.data.quote.total);
const cot = building("CS", "10x16");
cot.items.find((i) => cat.CAT[i.cat].k === "door").pos += 0.25;
chooseSize(cot, "10x12", cat);
const cotQuote = await call("POST", `customers/${customer.id}/quotes`, { design: fromState(cot, cat) }, { person: "dealer" });
const cotDoor = cotQuote.data.quote?.design.items.find((i) => i.cat === "w72");
const diff = cat.CAT.w72.p - cat.CAT.w48.p;
const cotLine = cotQuote.data.quote?.price.lines.find((l) => l[2] === "cat.w72");
prove(`a kept 72 in double door on the 10x12 Cottage is saved in place of the 48 in door it comes with, charged the difference ${diff}: "${cotLine?.[0]}"`,
  cotQuote.status === 201 && cotDoor?.inc === true && cotDoor.origCat === "w48" && cotLine?.[1] === diff && cotLine[0] === `${cat.CAT.w72.n}, in place of the ${cat.CAT.w48.n}`
  && cotQuote.data.quote.total === priceParts(cot, cat).total, JSON.stringify(cotQuote.data.quote?.price.lines || cotQuote.data.error));
prove(`... and the designer's line says only the difference is charged: "${note(cot)}"`, note(cot) === `A 10×12 comes with the ${cat.CAT.w48.n}, so only the difference is charged for your ${cat.CAT.w72.n}.`);

/* 7. Alan, Oct 17 2026: "standard" is always THIS business's own standard
   layout, never the library's. A business whose standard Cabin is only one
   door and one window: adding a window charges it, removing that window
   takes its price off ("Yes, take its price off"), and the library's
   Cabin layout gives nothing free and charges nothing. An owner changing
   the standard changes new quotes only; saved quotes keep their totals. */
const libCat = resolve((await call("GET", "price-list")).data.settings, manufacturer, library);
const libCabin = building("C", "10x16");                     /* the library's Cabin, as this business sold it so far */
const libDesign = fromState(libCabin, libCat);
const libQuote = await call("POST", `customers/${customer.id}/quotes`, { design: libDesign }, { person: "dealer" });
const cabinBase = libCat.P.C["10x16"], w23 = libCat.CAT.w23.p;
prove(`before the change, the library's Cabin 10x16 is this business's standard and costs ${cabinBase}`, libQuote.status === 201 && libQuote.data.quote.total === cabinBase);
const own = (await call("GET", "price-list")).data;
own.settings.offer.C = { ...(own.settings.offer.C || {}), layout: [{ cat: "d36lite", wall: "F", at: "center" }, { cat: "w23", wall: "R", at: "center" }] };
const ownPut = await call("PUT", "price-list", { settings: own.settings, version: own.version });
const ownCat = resolve((await call("GET", "price-list")).data.settings, manufacturer, library);
const mine = (size) => { const s = defaults(ownCat); chooseType(s, "C", ownCat); chooseSize(s, size, ownCat); return s; };
const std1 = mine("10x16");
prove("the owner's standard Cabin is one door and one window at every size",
  ownPut.status === 200 && Object.keys(ownCat.P.C).every((z) => { const s = mine(z); return s.items.filter((i) => !i.pk).map((i) => i.cat).sort().join() === "d36lite,w23"; }), JSON.stringify(ownPut.data.error || std1.items.map((i) => i.cat)));
const priced = (s) => ({ designer: priceParts(s, ownCat).total, server: priceDesign(fromState(s, ownCat), ownCat).price.total });
const p0 = priced(std1);
prove(`... and it costs the Cabin's own price ${cabinBase}, nothing added or taken off (designer ${p0.designer}, server ${p0.server})`, p0.designer === cabinBase && p0.server === cabinBase);
const plus = mine("10x16"); addItem(plus, "w23", ownCat, Math.PI);
const p1 = priced(plus);
prove(`a customer adding a window pays ${w23} for it (designer ${p1.designer}, server ${p1.server})`, p1.designer === cabinBase + w23 && p1.server === cabinBase + w23);
const minus = mine("10x16"); removeItem(minus, minus.items.find((i) => i.cat === "w23").id);
const p2 = priced(minus);
const minusLine = priceParts(minus, ownCat).lines.find((l) => l[2] === "removed.w23");
prove(`a customer removing that window gets ${w23} taken off (designer ${p2.designer}, server ${p2.server}, "${minusLine?.[0]}")`, p2.designer === cabinBase - w23 && p2.server === cabinBase - w23 && minusLine?.[1] === -w23);
const minusSent = await website(fromState(minus, ownCat), "Took a window off");
prove("... through the public quote route too", minusSent.status === 201 && minusSent.data.total === cabinBase - w23);
const minusOrder = await call("POST", `customers/${customer.id}/quotes`, { design: fromState(minus, ownCat) }, { person: "dealer" });
const minusSold = await call("POST", `customers/${customer.id}/orders`, { quoteId: minusOrder.data.quote?.id, payment: "cash", deposit: 0 }, { person: "dealer" });
prove("... and a dealer quote and its order", minusOrder.data.quote?.total === cabinBase - w23 && minusSold.data.order?.total === cabinBase - w23);
/* the library's layout on this business today (a link edited to it, or made with today's version) */
const libToday = structuredClone(libDesign); libToday.cfg = ownCat.cfg;
const libPriced = priceDesign(libToday, ownCat).price;
const libExtra = libCabin.items.filter((i) => i.cat === "w23").length - 1;
prove(`the library's Cabin layout is never free here: its ${libExtra} extra windows are charged (${libPriced.total})`, libPriced.total === cabinBase + libExtra * w23 && priceParts(toState(libToday, ownCat).state, ownCat).total === libPriced.total);
const forgedOff = fromState(std1, ownCat); forgedOff.removed = ["w23", "w23", "w23", "ppost"];
prove("... and the library's windows and posts this Cabin never had are never taken off, even when a link says they were", priceDesign(forgedOff, ownCat).price.total === cabinBase && priceParts(toState(forgedOff, ownCat).state, ownCat).total === cabinBase);
const keptQuote = (await call("GET", `customers/${customer.id}`, undefined, { person: "dealer" })).data.customer.quotes.find((q) => q.id === libQuote.data.quote.id);
prove("the quote saved before the owner's change keeps its total", keptQuote?.total === cabinBase);
const oldAgain = await call("POST", `customers/${customer.id}/quotes`, { design: libDesign }, { person: "dealer" });
prove("... and its design, made under the earlier version, is still compared with that version's standard", oldAgain.status === 201 && oldAgain.data.quote.total === cabinBase);

if (failed.length) {
  for (const s of said) console.log("  ok   " + s);
  for (const f of failed) console.log("  FAIL " + f);
  console.log(`FAIL: ${failed.length} of ${checks} checks failed.`);
  process.exit(1);
}
console.log(`PROVED (${checks} checks): every design is compared with the business's own standard layout for its size: an item marked "comes with the building" is free only up to what that standard comes with and the rest is charged, a standard door or window the customer removes comes off the price, on the public and dealer quote routes and in orders; the designer shows the same total with one plain line; the porch chip and an owner's later change never move a price on their own; honest buildings keep their price; saved quotes and orders keep theirs.`);
for (const s of said) console.log("  ok " + s);
