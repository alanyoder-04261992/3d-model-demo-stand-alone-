/* check-all: node
   PROVE Alan's Oct 17 2026 decision ("Yes, charge for them"): an item marked
   "comes with the building" is free only up to how many of it the design's
   own size and porch come with; the rest is charged at its normal price,
   never refused, through every route that prices a design; saved quotes
   and orders keep the total they were saved with.

   The case (review 17 CS-1): an 8x12 Cabin with the 12x32's windows still
   marked included, made in the designer (12x32, move a door, pick 8x12) or
   by editing a design link by hand. On c355440 both were given away free
   through the public quote route and the dealer quote route. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createOffice } from "../server/office/index.js";
import { MemoryBlobs } from "../server/office/store.js";
import { priceDesign } from "../server/office/pricing.js";
import { resolve } from "../model/company.js";
import { defaults, setType, fromState, toState } from "../model/design.js";
import { chooseSize, choosePorchLength } from "../ui/state.js";
import * as UI from "../ui/state.js";
import { priceParts } from "../model/pricing.js";
import { resetItems } from "../model/layout.js";
import { frameOf } from "../model/frame.js";

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
prove(`... and says so in one line: "${line}"`, line === `${extra} windows that came with the 12×32 are now charged on the 8×12.`, line);
const sent = await website(fromState(made, cat), "Designer customer");
prove("... and the public route charges the designer's total", sent.status === 201 && sent.data.total === priceParts(made, cat).total);
const back = toState(fromState(made, cat), cat).state;
prove("a reopened link says it without the size it came from", note(back) === `This 8×12 comes with fewer, so ${extra} windows are now charged.` && priceParts(back, cat).total === charged);
chooseSize(made, "12x32", cat);
prove("going back to 12x32 makes them free again, with nothing said", priceParts(made, cat).total === priceParts(big, cat).total + 0 && note(made) === "");

/* 3. Honest designs keep their price: every style and size the business
   sells, as laid out, and with each porch length */
let honest = 0;
for (const type of Object.keys(cat.TYPES)) for (const size of Object.keys(cat.P[type])) {
  const s = building(type, size);
  const lens = cat.TYPES[type].porch === "S" ? [8, 12] : [null];
  for (const len of lens) {
    if (len != null) { choosePorchLength(s, len, cat); resetItems(s, frameOf(s, cat), cat); }
    const p = priceParts(s, cat);
    assert.ok(!p.lines.some((l) => /^cat\./.test(l[2])), `${type} ${size}: a standard building's doors and windows are all free (${JSON.stringify(p.lines)})`);
    assert.equal(priceDesign(fromState(s, cat), cat).price.total, p.total);
    assert.equal(note(s) === "(the designer has no line for it)" ? "" : note(s), "");
    honest++;
  }
}
prove(`${honest} standard buildings (every style, size and side-porch length) have every door and window free, priced the same by the designer and the server`, honest > 50);

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

if (failed.length) {
  for (const s of said) console.log("  ok   " + s);
  for (const f of failed) console.log("  FAIL " + f);
  console.log(`FAIL: ${failed.length} of ${checks} checks failed.`);
  process.exit(1);
}
console.log(`PROVED (${checks} checks): an item marked "comes with the building" is free only up to what its own size and porch come with; the rest is charged at its normal price on the public and dealer quote routes, the designer shows the same total with one plain line, honest buildings keep their price, and saved quotes and orders keep theirs.`);
for (const s of said) console.log("  ok " + s);
