/* THE SAMPLE BUSINESS for the local Office and the browser check.

   Made through the Office's own API (so it is exactly what real use would
   store): an owner, a manager and three dealers; three lots; the full
   example price list; about thirty customers spread over the last six
   weeks -- website quote requests, walk-ins and phone calls, notes, calls,
   follow-ups (some due today, some late), quotes, orders at every status
   and a few lost sales. Names, phone numbers (555) and email addresses
   (example.com) are made up. Same data every time (no randomness). */

import { resolve as resolveCatalogue } from "../../model/company.js";
import { defaults, fromState } from "../../model/design.js";
import { chooseType, chooseSize, setElec, setRamp, toggleOpt, setColour } from "../../ui/state.js";

export const SAMPLE_PEOPLE = [
  { id: "sample-alan", email: "alan@yoderbarns.example", name: "Alan Yoder", role: "owner", lots: [] },
  { id: "sample-sarah", email: "sarah@yoderbarns.example", name: "Sarah Miller", role: "manager", lots: [] },
  { id: "sample-mike", email: "mike@yoderbarns.example", name: "Mike Hostetler", role: "dealer", lots: ["port-charlotte"] },
  { id: "sample-dana", email: "dana@yoderbarns.example", name: "Dana Ruiz", role: "dealer", lots: ["punta-gorda"] },
  { id: "sample-lee", email: "lee@yoderbarns.example", name: "Lee Carter", role: "dealer", lots: ["arcadia", "punta-gorda"] },
];

const LOTS = [
  { name: "Port Charlotte", address: "4250 Tamiami Trail", city: "Port Charlotte", state: "FL", zip: "33952", phone: "(941) 555-0140", email: "portcharlotte@yoderbarns.example", hours: "Mon–Fri 9–5\nSat 9–2", embedOrigins: ["https://yoderbarns.example"] },
  { name: "Punta Gorda", address: "1180 Marion Ave", city: "Punta Gorda", state: "FL", zip: "33950", phone: "(941) 555-0172", email: "puntagorda@yoderbarns.example", hours: "Mon–Sat 9–5" },
  { name: "Arcadia", address: "905 E Oak St", city: "Arcadia", state: "FL", zip: "34266", phone: "(863) 555-0119", email: "arcadia@yoderbarns.example", hours: "Tue–Sat 9–4" },
];

/* name, lot, how they came, building [style, size, extras], what happened */
const CUSTOMERS = [
  ["John Smith", "port-charlotte", "website", ["LB", "12x24", { elec: 1, ramp: "r4" }], "sold:sent", 41],
  ["Maria Gonzalez", "port-charlotte", "website", ["UT", "10x16", {}], "quoted:followToday", 9],
  ["Bob Whitaker", "port-charlotte", "walk-in", ["G", "12x24", { elec: 2 }], "sold:ready", 33],
  ["Linda Park", "port-charlotte", "website", ["C", "12x24", { opts: ["dbl"] }], "new", 0],
  ["Ray Johnson", "port-charlotte", "phone", ["SU", "10x16", {}], "contacted:followLate", 12],
  ["Angela Brooks", "port-charlotte", "website", ["LBC", "12x20", {}], "lost:Bought from another dealer", 28],
  ["Tom Becker", "port-charlotte", "website", ["LB", "10x16", {}], "delivered", 38],
  ["Kelly Nguyen", "port-charlotte", "website", ["CS", "10x16", {}], "new", 1],
  ["Dave Martin", "port-charlotte", "walk-in", ["MU", "10x20", {}], "quoted:followSoon", 6],
  ["Susan Reed", "port-charlotte", "website", ["SLB", "12x24", { elec: 1 }], "sold:sold", 3],
  ["Carlos Diaz", "punta-gorda", "website", ["LB", "12x32", { elec: 2, ramp: "r6" }], "sold:delivered", 36],
  ["Patty Hall", "punta-gorda", "website", ["DS", "10x16", {}], "quoted:followToday", 7],
  ["Greg Foster", "punta-gorda", "walk-in", ["UT", "8x12", {}], "contacted", 4],
  ["Nancy Cole", "punta-gorda", "website", ["SC", "12x24", {}], "new", 0],
  ["Ed Turner", "punta-gorda", "phone", ["G", "14x28", { elec: 3 }], "quoted:followLate", 15],
  ["Rita Shaw", "punta-gorda", "website", ["BU", "6x10", {}], "lost:Decided not to buy this year", 25],
  ["Jim O'Neal", "punta-gorda", "website", ["LBG", "12x24", {}], "sold:sent", 19],
  ["Heather Lane", "punta-gorda", "website", ["GU", "6x12", {}], "new", 2],
  ["Frank Moore", "punta-gorda", "walk-in", ["SS", "10x16", {}], "quoted", 10],
  ["Amy Ross", "arcadia", "website", ["LB", "10x20", {}], "quoted:followToday", 8],
  ["Bill Carter", "arcadia", "website", ["MLB", "12x24", {}], "sold:sold", 2],
  ["Joyce Kim", "arcadia", "phone", ["UT", "12x20", {}], "new", 0],
  ["Hank Wells", "arcadia", "walk-in", ["DK", "8x16", {}], "contacted:followSoon", 5],
  ["Donna Price", "arcadia", "website", ["SLC", "12x24", { opts: ["dbl", "mbF"] }], "quoted:followLate", 18],
  ["Wayne Ford", "arcadia", "website", ["LB", "14x32", { elec: 1, ramp: "r6" }], "delivered", 44],
  ["Megan Hart", "arcadia", "website", ["SU", "10x14", {}], "new", 1],
  ["Phil Grant", "port-charlotte", "website", ["MG", "12x24", {}], "contacted", 3],
  ["Tina Lopez", "punta-gorda", "website", ["C", "10x16", {}], "quoted", 13],
  ["Steve Adams", "arcadia", "walk-in", ["LBC", "12x24", {}], "lost:Price — went with a smaller building elsewhere", 30],
  ["Rosa Vega", "port-charlotte", "website", ["DSC", "12x24", {}], "new", 0],
];

const NOTES = [
  "Wants it by the end of the month.",
  "Asked about rent-to-own. Sent the terms.",
  "Needs to check with the HOA first.",
  "Coming by Saturday to look at the display models.",
  "Site is level, gate is 12 ft wide.",
  "Asked for barn red siding with white trim.",
];

function day(offsetDays, from) {
  const d = new Date(from.getTime() + offsetDays * 86400000);
  return d.toISOString().slice(0, 10);
}

/* office: from createOffice; act(person) switches who is signed in;
   clock: {at: Date} that the office's now() reads. */
export async function seedSample({ office, act, clock, manufacturer, library }) {
  const realNow = new Date();
  const start = new Date(realNow.getTime() - 46 * 86400000);
  clock.at = start;
  const origin = "http://127.0.0.1";
  async function call(method, path, body) {
    const r = await office.handle(new Request(origin + path, {
      method, headers: { "content-type": "application/json", origin }, body: body ? JSON.stringify(body) : undefined,
    }), { clientIp: "127.0.0.1" });
    const data = await r.json();
    if (!r.ok) throw new Error(`${method} ${path}: ${r.status} ${data.error}`);
    return data;
  }
  const owner = SAMPLE_PEOPLE[0];
  act(owner);
  await call("GET", "/api/office/me");
  await call("POST", "/api/office/setup", { yourName: owner.name, businessName: "Yoder Storage Barns", phone: "(941) 555-0100", email: "office@yoderbarns.example", start: "full" });
  const pl = await call("GET", "/api/office/price-list");
  const settings = structuredClone(pl.settings);
  settings.status = "active";
  settings.brand.website = "https://yoderbarns.example";
  settings.brand.tagline = "Portable storage buildings, delivered and set up";
  await call("PUT", "/api/office/price-list", { settings, version: pl.version });
  for (const lot of LOTS) await call("POST", "/api/office/lots", lot);
  for (const p of SAMPLE_PEOPLE.slice(1)) {
    await call("POST", "/api/office/team", { email: p.email, name: p.name, role: p.role, lots: p.lots });
    act(p);
    await call("GET", "/api/office/me");
    act(owner);
  }

  const cat = resolveCatalogue((await call("GET", "/api/office/price-list")).settings, manufacturer, library);
  const dealerFor = (slug) => SAMPLE_PEOPLE.find((p) => p.role === "dealer" && p.lots[0] === slug) || SAMPLE_PEOPLE.find((p) => p.lots.includes(slug));
  let n = 0;
  const sorted = [...CUSTOMERS].sort((a, b) => b[5] - a[5]);
  for (const [name, lot, source, [style, size, extra], story, daysAgo] of sorted) {
    n++;
    clock.at = new Date(realNow.getTime() - daysAgo * 86400000 - (n % 7) * 3600000);
    const state = defaults(cat);
    chooseType(state, style, cat);
    chooseSize(state, size, cat);
    if (extra.elec) setElec(state, extra.elec, cat);
    if (extra.ramp) setRamp(state, extra.ramp);
    for (const o of extra.opts || []) toggleOpt(state, o);
    const paints = cat.COLORS.paint;
    if (n % 3 === 0 && paints.length > 8) setColour(state, "body", paints[8][1]);
    const design = fromState(state, cat, { priced: true, at: day(0, clock.at) });
    const first = name.split(" ")[0].toLowerCase().replace(/[^a-z]/g, "");
    const contact = { name, phone: `(941) 555-${String(1000 + n * 37).slice(-4)}`, email: n % 4 === 1 ? "" : `${first}${n}@example.com`, zip: "33948" };
    const dealer = dealerFor(lot);
    let id;
    if (source === "website") {
      act(null);
      await call("POST", `/api/lots/${lot}/quote-requests`, { design, contact: { ...contact, note: n % 5 === 0 ? "Do you deliver to Englewood?" : "" }, idempotencyKey: `sample-request-key-${String(n).padStart(4, "0")}` });
      act(dealer);
      const rows = (await call("GET", `/api/office/customers?lot=${lot}`)).rows;
      id = rows.find((r) => r.name === name).id;
    } else {
      act(dealer);
      id = (await call("POST", "/api/office/customers", { lot, ...contact, source, note: source === "walk-in" ? "Looked at the display buildings." : "Called about prices." })).customer.id;
      await call("POST", `/api/office/customers/${id}/quotes`, { design });
    }
    const [stage, detail] = story.split(":");
    const later = (h) => { clock.at = new Date(Math.min(clock.at.getTime() + h * 3600000, realNow.getTime() - 60000)); };
    if (stage !== "new") {
      later(5);
      await call("POST", `/api/office/customers/${id}/activity`, { type: n % 2 ? "call" : "text", text: NOTES[n % NOTES.length] });
    }
    if (stage === "contacted" || stage === "quoted" || stage === "lost") {
      if (stage === "quoted" && source === "website") { later(20); await call("PATCH", `/api/office/customers/${id}`, { stage: "quoted" }); }
      if (stage === "lost") { later(48); await call("PATCH", `/api/office/customers/${id}`, { stage: "lost", lostReason: detail }); }
    }
    if (detail === "followToday" || detail === "followLate" || detail === "followSoon") {
      later(2);
      const when = detail === "followToday" ? 0 : detail === "followLate" ? -2 - (n % 3) : 2 + (n % 4);
      await call("PATCH", `/api/office/customers/${id}`, { followUp: { date: day(when, realNow), note: ["Call back about colors", "Check if the HOA said yes", "Send rent-to-own papers", "Ask about delivery date"][n % 4] } });
    }
    if (stage === "sold" || stage === "delivered") {
      later(30);
      const c = (await call("GET", `/api/office/customers/${id}`)).customer;
      const q = c.quotes[c.quotes.length - 1];
      const payment = ["cash", "rto", "rto", "financing"][n % 4];
      const o = await call("POST", `/api/office/customers/${id}/orders`, {
        quoteId: q.id, payment, deposit: payment === "cash" ? Math.round(q.total / 2) : 450,
        deliveryDate: day(daysAgo > 30 ? -(daysAgo - 21) : 10 + (n % 9), realNow), deliveryNotes: "Gate code 1234. Set it on the left side of the driveway.",
      });
      const steps = stage === "delivered" ? ["sent", "ready", "delivered"] : { sold: [], sent: ["sent"], ready: ["sent", "ready"], delivered: ["sent", "ready", "delivered"] }[detail] || [];
      for (const s of steps) { later(72); await call("PATCH", `/api/office/customers/${id}/orders/${o.order.id}`, { status: s }); }
    }
  }
  act(null);
  clock.at = null;
}
