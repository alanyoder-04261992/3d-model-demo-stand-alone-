/* CUSTOMERS, THEIR QUOTES AND ORDERS -- the heart of the Office.

   A customer is one record, customers/<id>: contact details, the lot they
   belong to, their stage, who is working them, the next follow-up, every
   quote (a priced building), every order (a sold building), and the
   history of everything anybody did ("activity").

   Lists, search and the Today screen read lists/<lot>: one short row per
   customer of that lot, rebuilt from the customer every time the customer
   changes. The customer record is the truth; when a row is missing or out
   of date (a write that stopped halfway), opening the customer fixes it.

   Every change is a small operation ("add this note", "set the stage")
   applied to the newest copy with store.change, so two people working the
   same customer at the same moment both keep their work. The person's
   right to the customer's lot is checked again on that newest copy: a
   manager may have moved the customer to another lot in the meantime. */

import { randomId } from "./hash.js";
import { fail, text, email, phone, day, money, oneOf, bool, onlyKeys } from "./http.js";
import { KEEP } from "./store.js";
import { can, ROLE_WORDS } from "./people.js";
import { priceOrExplain, buildingName } from "./pricing.js";
import { rtoMonthly } from "../../model/pricing.js";
import { planWords } from "../../model/quote-plan.js";

export const STAGES = ["new", "contacted", "quoted", "sold", "delivered", "lost"];
export const STAGE_WORDS = { new: "New", contacted: "Contacted", quoted: "Quoted", sold: "Sold", delivered: "Delivered", lost: "Lost" };
export const SOURCES = ["website", "walk-in", "phone", "text", "facebook", "referral", "repeat", "other"];
export const SOURCE_WORDS = { website: "3D designer", "walk-in": "Walk-in", phone: "Phone call", text: "Text", facebook: "Facebook", referral: "Referral", repeat: "Repeat customer", other: "Other" };
export const LOST_REASONS = ["Bought somewhere else", "Price", "Not ready yet", "No answer", "Didn't qualify for rent-to-own", "Other"];
export const ORDER_STATUSES = ["sold", "sent", "ready", "delivered", "cancelled"];
export const ORDER_WORDS = { sold: "Sold", sent: "Sent to builder", ready: "Ready", delivered: "Delivered", cancelled: "Cancelled" };
export const PAYMENTS = ["cash", "rto", "financing", "other"];
export const PAYMENT_WORDS = { cash: "Cash", rto: "Rent-to-own", financing: "Financing", other: "Other" };
export const NOTE_TYPES = ["note", "call", "text", "email", "visit"];

const MAX_ACTIVITY = 500;
const MAX_QUOTES = 100;
const MAX_ORDERS = 50;

export const newId = () => randomId(12);
const ID_RE = /^[A-Za-z0-9]{8,24}$/;

const dollars = (n) => "$" + Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 });
const shortDay = (iso) => new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
export const phoneDigits = (p) => String(p || "").replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");

/* The short row lists and the Today screen use. */
export function rowOf(c) {
  const latest = c.quotes[c.quotes.length - 1] || null;
  return {
    id: c.id, lot: c.lot, name: c.name, phone: c.phone, email: c.email, city: c.city || "", zip: c.zip || "",
    stage: c.stage, source: c.source, assignedTo: c.assignedTo || null,
    followUp: c.followUp || null,
    building: latest ? latest.building : "", total: latest ? latest.total : null,
    quotes: c.quotes.map((q) => [q.at, q.total]),
    orders: c.orders.map((o) => ({ id: o.id, number: o.number, status: o.status, total: o.total, soldAt: o.soldAt, building: o.building, deliveryDate: o.deliveryDate || "", payment: o.payment })),
    createdAt: c.createdAt, updatedAt: c.updatedAt,
    lastActivityAt: c.activity.length ? c.activity[c.activity.length - 1].at : c.createdAt,
    lastActivity: c.activity.length ? c.activity[c.activity.length - 1].text : "",
  };
}

const NOT_FOUND = "We couldn't find that customer.";

export function createCustomers({ store, now, lots, priceList, log: logError = console.error }) {
  const iso = () => now().toISOString();
  const byOf = (who) => (who ? { id: who.person.userId, name: who.person.name || who.person.email } : null);

  function log(c, who, type, words) {
    c.activity.push({ id: newId(), at: iso(), by: byOf(who), type, text: words });
    if (c.activity.length > MAX_ACTIVITY) c.activity.splice(0, c.activity.length - MAX_ACTIVITY);
    c.updatedAt = iso();
  }

  /* The next quote number (an order keeps its quote's number). One shared
     counter, changed with store.change, so two quotes made at the same
     moment never get the same number. */
  async function nextNumber(name) {
    const r = await store.change(`counters/${name}`, (c) => ({ next: (c?.next || 1001) + 1, last: c?.next || 1001 }));
    return r.last;
  }

  /* ---- the list rows ---------------------------------------------------- */

  /* Make lists/<slug> agree with the customer as stored right now: their
     row when they belong to that lot, no row when they do not (they were
     moved away). The customer is read INSIDE the list's conditional write,
     after the list itself was read. So of two changes to one customer that
     finish at the same moment, the list write that lands last always
     carries the newest customer: an older copy can never overwrite a newer
     row, and a moved customer's row never comes back to the lot they left. */
  async function syncRow(slug, id) {
    await store.change(`lists/${slug}`, async (doc) => {
      const fresh = await store.get(`customers/${id}`);
      const list = doc || { rows: {} };
      if (fresh && fresh.lot === slug) {
        const row = rowOf(fresh);
        if (JSON.stringify(list.rows[id]) === JSON.stringify(row)) return KEEP;
        list.rows[id] = row;
        return list;
      }
      if (!list.rows[id]) return KEEP;
      delete list.rows[id];
      return list;
    });
  }

  /* After a customer is saved, the rows must follow -- but the customer is
     already saved, so a row that cannot be written right now is logged, not
     turned into an error (the person would do it again: a second note, a
     second quote). Opening the customer puts the row right. */
  async function syncRows(c, slugs) {
    for (const slug of new Set(slugs)) {
      try {
        await syncRow(slug, c.id);
      } catch (e) {
        logError("A customer list row could not be updated (opening the customer fixes it):", e);
      }
    }
  }

  /* The lots whose lists may hold this customer: where they are now, and
     every lot they were moved away from. */
  const rowLots = (c) => [c.lot, ...(c.pastLots || [])];

  /* Repair the rows if any is missing or out of date. */
  async function repairRows(c) {
    for (const slug of new Set(rowLots(c))) {
      const row = (await store.get(`lists/${slug}`))?.rows?.[c.id];
      const right = slug === c.lot ? JSON.stringify(row) === JSON.stringify(rowOf(c)) : !row;
      if (!right) await syncRows(c, [slug]);
    }
  }

  /* Change a customer and keep the rows in step. who is the person making
     the change (null for the website); they must still be able to see the
     customer's lot on the newest copy. fn may run more than once. */
  async function changeCustomer(who, id, fn) {
    let movedFrom = null;
    const c = await store.change(`customers/${id}`, (cur) => {
      if (!cur || (who && !can.seeLot(who.person, cur.lot))) fail(404, NOT_FOUND);
      const before = cur.lot;
      const out = fn(cur) ?? cur;
      if (out.stage !== "lost") out.lostReason = "";      /* a reason only while they are Lost */
      movedFrom = out.lot !== before ? before : null;
      if (movedFrom) out.pastLots = [...new Set([...(out.pastLots || []), movedFrom])].slice(-20);
      return out;
    });
    await syncRows(c, movedFrom ? [movedFrom, c.lot] : [c.lot]);
    return c;
  }

  /* ---- who may see what ------------------------------------------------- */

  async function visibleLots(who) {
    const all = await lots.all();
    return all.filter((l) => can.seeLot(who.person, l.slug));
  }

  async function mustSeeLot(who, slug) {
    if (typeof slug !== "string" || !can.seeLot(who.person, slug) || !(await lots.get(slug))) fail(404, "We couldn't find that lot.");
  }

  /* Another lot's customer answers exactly like a customer that does not
     exist (404), so a dealer cannot even learn that the id is real. */
  async function load(who, id) {
    if (typeof id !== "string" || !ID_RE.test(id)) fail(404, NOT_FOUND);
    const c = await store.get(`customers/${id}`);
    if (!c) fail(404, NOT_FOUND);
    if (!can.seeLot(who.person, c.lot)) {
      /* a row left behind in this person's lot (a move that stopped
         halfway) led them here: take it away */
      await repairRows(c);
      fail(404, NOT_FOUND);
    }
    return c;
  }

  async function checkAssignee(userId, slug) {
    if (userId == null || userId === "") return null;
    if (typeof userId !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(userId)) fail(422, "Pick someone from the team.");
    const p = await store.get(`people/${userId}`);
    if (!p || p.active === false) fail(422, "That person is not on the team.");
    if (!can.seeLot(p, slug)) fail(422, `${p.name || p.email} does not work this lot.`);
    return p;
  }

  /* ---- reading ------------------------------------------------------------ */

  async function list(who, { lot } = {}) {
    let slugs = (await visibleLots(who)).map((l) => l.slug);
    if (lot) {
      if (!slugs.includes(lot)) fail(404, "We couldn't find that lot.");
      slugs = [lot];
    }
    const rows = [];
    for (const slug of slugs) {
      const doc = await store.get(`lists/${slug}`);
      if (doc) for (const row of Object.values(doc.rows)) if (row.lot === slug) rows.push(row);
    }
    rows.sort((a, b) => String(b.lastActivityAt).localeCompare(String(a.lastActivityAt)));
    return { rows };
  }

  async function get(who, id) {
    const c = await load(who, id);
    await repairRows(c);
    return c;
  }

  /* ---- contact details ---------------------------------------------------- */

  function contactFields(data, old = {}) {
    const out = {};
    const has = (k) => k in data;
    if (has("name") || !old.id) out.name = text(data.name, 100, "Name", { required: true });
    if (has("phone") || !old.id) out.phone = phone(data.phone);
    if (has("email") || !old.id) out.email = email(data.email);
    if (has("address") || !old.id) out.address = text(data.address, 200, "Street address");
    if (has("city") || !old.id) out.city = text(data.city, 80, "City");
    if (has("state") || !old.id) out.state = text(data.state, 40, "State");
    if (has("zip") || !old.id) out.zip = text(data.zip, 12, "ZIP");
    if (has("smsOk")) out.smsOk = data.smsOk == null ? null : bool(data.smsOk, "OK to text");
    const merged = { ...old, ...out };
    if (!merged.phone && !merged.email) fail(422, "Add a phone number or an email address so the lot can reach them.");
    return out;
  }

  async function create(who, data) {
    onlyKeys(data, ["lot", "name", "phone", "email", "address", "city", "state", "zip", "smsOk", "source", "note", "assignedTo", "followUp"], "The customer");
    await mustSeeLot(who, data.lot);
    const source = data.source == null ? "walk-in" : oneOf(data.source, SOURCES.filter((s) => s !== "website"), "Pick where they came from.");
    const contact = contactFields(data);
    const assignee = data.assignedTo === undefined ? who.person : await checkAssignee(data.assignedTo, data.lot);
    const at = iso();
    const c = {
      id: newId(), lot: data.lot, ...contact, smsOk: contact.smsOk ?? null, source, stage: "new", lostReason: "",
      assignedTo: assignee && can.seeLot(assignee, data.lot) ? assignee.userId : null,
      followUp: null, quotes: [], orders: [], activity: [], createdAt: at, updatedAt: at,
    };
    log(c, who, "created", `Added by ${byOf(who).name} (${SOURCE_WORDS[source].toLowerCase()})`);
    const note = text(data.note, 4000, "Note", { multiline: true });
    if (note) log(c, who, "note", note);
    if (data.followUp) c.followUp = followUpOf(data.followUp);
    if (!(await store.create(`customers/${c.id}`, c))) fail(503, "Something went wrong saving that. Please try again.");
    await syncRows(c, [c.lot]);
    return c;
  }

  function followUpOf(value) {
    if (value == null) return null;
    if (typeof value !== "object" || Array.isArray(value)) fail(422, "Pick a follow-up date.");
    onlyKeys(value, ["date", "note"], "The follow-up");
    const date = day(value.date, "Follow-up date");
    if (!date) fail(422, "Pick a follow-up date.");
    return { date, note: text(value.note, 300, "Follow-up note") };
  }

  async function update(who, id, data) {
    onlyKeys(data, ["name", "phone", "email", "address", "city", "state", "zip", "smsOk", "stage", "lostReason", "assignedTo", "followUp", "lot"], "The customer");
    const c0 = await load(who, id);
    /* A move happens only when a lot is sent; a change that sends no lot
       never moves the customer (not even back, after somebody else moved
       them a moment ago). */
    const moveTo = "lot" in data && data.lot !== c0.lot ? data.lot : null;
    if (moveTo !== null) {
      if (!can.moveCustomers(who.person)) fail(403, "Only the owner or a manager can move a customer to another lot.");
      await mustSeeLot(who, moveTo);
    }
    const assignee = "assignedTo" in data ? await checkAssignee(data.assignedTo, moveTo ?? c0.lot) : undefined;
    const stage = "stage" in data ? oneOf(data.stage, STAGES, "Pick a stage.") : undefined;
    const followUp = "followUp" in data ? followUpOf(data.followUp) : undefined;
    const lostReason = "lostReason" in data ? text(data.lostReason, 300, "Why they were lost") : undefined;
    const lotNames = Object.fromEntries((await lots.all()).map((l) => [l.slug, l.name]));

    return changeCustomer(who, id, (c) => {
      const contact = contactFields(data, c);
      const changed = Object.keys(contact).filter((k) => (c[k] ?? null) !== (contact[k] ?? null));
      Object.assign(c, contact);
      if (changed.length) {
        const words = { name: "name", phone: "phone", email: "email", address: "address", city: "city", state: "state", zip: "ZIP", smsOk: "texting permission" };
        log(c, who, "edited", `Changed ${changed.map((k) => words[k]).join(", ")}`);
      }
      if (moveTo !== null && moveTo !== c.lot) {
        log(c, who, "moved", `Moved from ${lotNames[c.lot] || "another lot"} to ${lotNames[moveTo] || "another lot"}`);
        c.lot = moveTo;
        if (c.assignedTo && assignee === undefined) c.assignedTo = null;
      }
      if (assignee && !can.seeLot(assignee, c.lot)) fail(422, `${assignee.name || assignee.email} does not work this lot.`);
      if (stage !== undefined && stage !== c.stage) {
        log(c, who, "stage", `${STAGE_WORDS[c.stage]} → ${STAGE_WORDS[stage]}${stage === "lost" && lostReason ? `: ${lostReason}` : ""}`);
        c.stage = stage;
      }
      if (lostReason !== undefined) c.lostReason = c.stage === "lost" ? lostReason : "";
      if (assignee !== undefined && (assignee?.userId || null) !== (c.assignedTo || null)) {
        c.assignedTo = assignee ? assignee.userId : null;
        log(c, who, "assigned", assignee ? `Assigned to ${assignee.name || assignee.email}` : "Not assigned to anyone");
      }
      if (followUp !== undefined && JSON.stringify(followUp) !== JSON.stringify(c.followUp || null)) {
        c.followUp = followUp;
        log(c, who, "followup", followUp ? `Follow up ${shortDay(followUp.date)}${followUp.note ? `: ${followUp.note}` : ""}` : "Follow-up done");
      }
      c.updatedAt = iso();
    });
  }

  /* ---- notes, calls, texts ----------------------------------------------- */

  async function addActivity(who, id, data) {
    onlyKeys(data, ["type", "text", "clearFollowUp"], "The note");
    const type = oneOf(data.type, NOTE_TYPES, "Pick a note, call, text, email or visit.");
    const words = text(data.text, 4000, "Note", { multiline: true, required: type === "note" });
    await load(who, id);
    const label = { note: "", call: "Called", text: "Texted", email: "Emailed", visit: "Visited the lot" }[type];
    return changeCustomer(who, id, (c) => {
      log(c, who, type, label ? (words ? `${label}: ${words}` : label) : words);
      if (type !== "note" && c.stage === "new") {
        c.stage = "contacted";
        log(c, null, "stage", "New → Contacted");
      }
      if (data.clearFollowUp === true && c.followUp) {
        c.followUp = null;
        log(c, who, "followup", "Follow-up done");
      }
    });
  }

  /* ---- quotes -------------------------------------------------------------- */

  function quoteOf(priced, cat, { by, source, number }) {
    return {
      id: newId(), number, at: iso(), by, source,
      building: buildingName(priced.design, cat),
      design: priced.design, price: priced.price, total: priced.price.total, cfg: cat.cfg,
    };
  }

  async function addQuote(who, id, data) {
    onlyKeys(data, ["design", "note"], "The quote");
    const c0 = await load(who, id);
    const { cat } = await priceList.catalogue();
    const priced = priceOrExplain(data.design, cat, logError);
    const note = text(data.note, 1000, "Note", { multiline: true });
    if (c0.quotes.length >= MAX_QUOTES) fail(422, "This customer has too many quotes. Add a new customer for new buildings.");
    const number = await nextNumber("quote-number");
    const quote = quoteOf(priced, cat, { by: byOf(who), source: "office", number });
    if (note) quote.note = note;
    const c = await changeCustomer(who, id, (cur) => {
      if (cur.quotes.length >= MAX_QUOTES) fail(422, "This customer has too many quotes. Add a new customer for new buildings.");
      cur.quotes.push(quote);
      log(cur, who, "quote", `Quote #${number}: ${quote.building} — ${dollars(quote.total)}`);
      if (cur.stage === "new" || cur.stage === "contacted" || cur.stage === "lost") {
        log(cur, null, "stage", `${STAGE_WORDS[cur.stage]} → Quoted`);
        cur.stage = "quoted";
      }
    });
    return { customer: c, quote };
  }

  /* ---- orders -------------------------------------------------------------- */

  function orderFields(data, old = {}) {
    const out = {};
    const has = (k) => k in data;
    if (has("payment") || !old.id) out.payment = data.payment == null ? "cash" : oneOf(data.payment, PAYMENTS, "Pick how they are paying.");
    if (has("deposit") || !old.id) out.deposit = money(data.deposit, "Deposit") ?? 0;
    if (has("deliveryAddress") || !old.id) out.deliveryAddress = text(data.deliveryAddress, 300, "Delivery address", { multiline: true });
    if (has("deliveryDate") || !old.id) out.deliveryDate = day(data.deliveryDate, "Delivery date");
    if (has("deliveryNotes") || !old.id) out.deliveryNotes = text(data.deliveryNotes, 2000, "Delivery notes", { multiline: true });
    if (has("notes") || !old.id) out.notes = text(data.notes, 2000, "Order notes", { multiline: true });
    return out;
  }

  function settleStage(c, who) {
    const live = c.orders.filter((o) => o.status !== "cancelled");
    let stage = c.stage;
    if (live.length && live.every((o) => o.status === "delivered")) stage = "delivered";
    else if (live.length) stage = "sold";
    else if (c.stage === "sold" || c.stage === "delivered") stage = c.quotes.length ? "quoted" : "contacted";
    if (stage !== c.stage) {
      log(c, null, "stage", `${STAGE_WORDS[c.stage]} → ${STAGE_WORDS[stage]}`);
      c.stage = stage;
    }
  }

  async function addOrder(who, id, data) {
    onlyKeys(data, ["quoteId", "payment", "deposit", "deliveryAddress", "deliveryDate", "deliveryNotes", "notes"], "The order");
    const c0 = await load(who, id);
    const quote = c0.quotes.find((q) => q.id === data.quoteId);
    if (!quote) fail(422, "Pick the quote the customer is buying.");
    if (c0.orders.some((o) => o.quoteId === quote.id && o.status !== "cancelled")) fail(409, "That quote is already sold. Open its order instead.");
    if (c0.orders.length >= MAX_ORDERS) fail(422, "This customer has too many orders.");
    const fields = orderFields(data);
    if (fields.deposit > quote.total) fail(422, "The deposit is more than the building costs.");
    const number = quote.number;
    const at = iso();
    const order = {
      id: newId(), number, quoteId: quote.id, building: quote.building, total: quote.total,
      status: "sold", soldAt: at, soldBy: byOf(who), ...fields,
      deliveryAddress: fields.deliveryAddress || [c0.address, [c0.city, c0.state].filter(Boolean).join(", "), c0.zip].filter(Boolean).join("\n"),
      history: [{ status: "sold", at, by: byOf(who) }],
    };
    const c = await changeCustomer(who, id, (cur) => {
      if (cur.orders.some((o) => o.quoteId === quote.id && o.status !== "cancelled")) fail(409, "That quote is already sold. Open its order instead.");
      if (cur.orders.length >= MAX_ORDERS) fail(422, "This customer has too many orders.");
      cur.orders.push(order);
      log(cur, who, "order", `Sold: ${order.building} — ${dollars(order.total)} (order #${number}, ${PAYMENT_WORDS[order.payment].toLowerCase()})`);
      settleStage(cur, who);
    });
    return { customer: c, order };
  }

  async function updateOrder(who, id, orderId, data) {
    onlyKeys(data, ["status", "payment", "deposit", "deliveryAddress", "deliveryDate", "deliveryNotes", "notes"], "The order");
    const c0 = await load(who, id);
    const o0 = c0.orders.find((o) => o.id === orderId);
    if (!o0) fail(404, "We couldn't find that order.");
    const status = "status" in data ? oneOf(data.status, ORDER_STATUSES, "Pick where the building is: Sold, Sent to builder, Ready, Delivered or Cancelled.") : undefined;
    const fields = orderFields(data, o0);
    if (fields.deposit != null && fields.deposit > o0.total) fail(422, "The deposit is more than the building costs.");
    const c = await changeCustomer(who, id, (cur) => {
      const o = cur.orders.find((x) => x.id === orderId);
      if (!o) fail(404, "We couldn't find that order.");
      const changed = Object.keys(fields).filter((k) => JSON.stringify(o[k] ?? "") !== JSON.stringify(fields[k] ?? ""));
      Object.assign(o, fields);
      if (changed.length) log(cur, who, "order-status", `Order #${o.number}: changed ${changed.map((k) => ({ payment: "payment", deposit: "deposit", deliveryAddress: "delivery address", deliveryDate: "delivery date", deliveryNotes: "delivery notes", notes: "notes" }[k])).join(", ")}`);
      if (status !== undefined && status !== o.status) {
        if (o.status === "cancelled" && cur.orders.some((x) => x.id !== o.id && x.quoteId === o.quoteId && x.status !== "cancelled")) {
          fail(409, "That quote was sold again on another order.");
        }
        o.status = status;
        o.history.push({ status, at: iso(), by: byOf(who) });
        log(cur, who, "order-status", `Order #${o.number}: ${ORDER_WORDS[status]}`);
        settleStage(cur, who);
      }
    });
    return { customer: c, order: c.orders.find((o) => o.id === orderId) };
  }

  /* ---- a spreadsheet --------------------------------------------------------- */

  async function csv(who) {
    if (!can.exportCustomers(who.person)) fail(403, "Only the owner or a manager can download customers.");
    const { rows } = await list(who);
    const lotNames = Object.fromEntries((await lots.all()).map((l) => [l.slug, l.name]));
    const team = Object.fromEntries((await store.all("people/")).map((p) => [p.userId, p.name || p.email]));
    const cell = (v) => {
      let s = v == null ? "" : String(v);
      if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const head = ["Name", "Phone", "Email", "City", "ZIP", "Lot", "Stage", "Came from", "Working them", "Follow-up", "Latest building", "Latest quote", "Orders", "Added", "Last activity"];
    const lines = [head.map(cell).join(",")];
    for (const r of rows) {
      lines.push([
        r.name, r.phone, r.email, r.city, r.zip, lotNames[r.lot] || r.lot, STAGE_WORDS[r.stage], SOURCE_WORDS[r.source] || r.source,
        r.assignedTo ? team[r.assignedTo] || "" : "", r.followUp?.date || "", r.building, r.total ?? "",
        r.orders.filter((o) => o.status !== "cancelled").map((o) => `#${o.number} (${ORDER_WORDS[o.status]})`).join("; "),
        r.createdAt.slice(0, 10), String(r.lastActivityAt).slice(0, 10),
      ].map(cell).join(","));
    }
    return "﻿" + lines.join("\r\n") + "\r\n";
  }

  /* ---- for website quote requests (website.js) --------------------------------- */

  async function findMatch(slug, contact) {
    const doc = await store.get(`lists/${slug}`);
    if (!doc) return null;
    const mail = (contact.email || "").toLowerCase();
    const digits = phoneDigits(contact.phone);
    const rows = Object.values(doc.rows).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    /* The same email is the same customer. The same phone is the same
       customer (or household) when the first or the last name agrees too:
       "Maria G" is Maria Gonzalez, Mary Smith shares John Smith's phone,
       but Bob Jones typing Maria's number is somebody new. */
    const words = (name) => String(name || "").trim().toLowerCase().replace(/[^a-z\s'-]/g, "").split(/\s+/).filter(Boolean);
    const sameName = (a, b) => {
      const x = words(a), y = words(b);
      if (!x.length || !y.length) return true;
      const first = x[0] === y[0];
      const last = x.length > 1 && y.length > 1 && (x.at(-1) === y.at(-1) || x.at(-1).startsWith(y.at(-1)) || y.at(-1).startsWith(x.at(-1)));
      return first || last;
    };
    return rows.find((r) => mail && r.email && r.email.toLowerCase() === mail)
      || rows.find((r) => digits.length >= 7 && phoneDigits(r.phone) === digits && sameName(r.name, contact.name))
      || null;
  }

  async function addWebsiteQuote(slug, contact, priced, cat) {
    const number = await nextNumber("quote-number");
    const quote = quoteOf(priced, cat, { by: null, source: "website", number });
    /* what they want to do with it, and the rent-to-own payment they looked
       at -- worked out here from the server's own price, never the page's */
    if (contact.plan) quote.plan = contact.plan;
    const monthly = contact.rtoMonths ? rtoMonthly(quote.total, cat.pricing?.rto, contact.rtoMonths) : 0;
    if (monthly > 0) quote.rto = { months: contact.rtoMonths, monthly };
    const words = [
      `Sent a quote from the 3D designer: ${quote.building} — ${dollars(quote.total)} (quote #${number})`,
      quote.plan ? `What they want to do: ${planWords(quote.plan)}` : "",
      quote.rto ? `Looked at rent to own: ${dollars(quote.rto.monthly)} a month over ${quote.rto.months} months` : "",
    ].filter(Boolean).join("\n");
    const match = await findMatch(slug, contact);
    let c = null;
    if (match) {
      c = await changeCustomer(null, match.id, (cur) => {
        if (cur.lot !== slug) fail(404, "moved");
        cur.quotes.push(quote);
        trimQuotes(cur);
        for (const k of ["phone", "email", "address", "city", "zip"]) if (!cur[k] && contact[k]) cur[k] = contact[k];
        if (typeof contact.smsOk === "boolean") cur.smsOk = contact.smsOk;
        log(cur, null, "website", words + (contact.note ? `\n“${contact.note}”` : ""));
        if (cur.stage === "lost" || cur.stage === "delivered") {
          log(cur, null, "stage", `${STAGE_WORDS[cur.stage]} → New`);
          cur.stage = "new";
        }
      }).catch((e) => {
        if (e.status === 404) return null;   /* the row was stale: make a new customer */
        throw e;
      });
    }
    if (!c) {
      const at = iso();
      c = {
        id: newId(), lot: slug, name: contact.name, phone: contact.phone || "", email: contact.email || "",
        address: contact.address || "", city: contact.city || "", state: "", zip: contact.zip || "", smsOk: typeof contact.smsOk === "boolean" ? contact.smsOk : null,
        source: "website", stage: "new", lostReason: "", assignedTo: null, followUp: null,
        quotes: [quote], orders: [], activity: [], createdAt: at, updatedAt: at,
      };
      log(c, null, "website", words + (contact.note ? `\n“${contact.note}”` : ""));
      if (!(await store.create(`customers/${c.id}`, c))) fail(503, "We couldn't save your request. Please try again.");
      await syncRows(c, [c.lot]);
    }
    return { customer: c, quote };
  }

  /* A customer who keeps sending designs from the website could pile up
     quotes without end: past MAX_QUOTES the oldest quote nobody bought is
     let go. A quote that has an order is always kept (its order sheet
     shows its price lines). */
  function trimQuotes(c) {
    while (c.quotes.length > MAX_QUOTES) {
      const sold = new Set(c.orders.map((o) => o.quoteId));
      const oldest = c.quotes.findIndex((q) => !sold.has(q.id));
      if (oldest < 0) break;
      c.quotes.splice(oldest, 1);
    }
  }

  return { list, get, create, update, addActivity, addQuote, addOrder, updateOrder, csv, addWebsiteQuote, rowOf };
}

export const WORDS = { STAGE_WORDS, SOURCE_WORDS, ORDER_WORDS, PAYMENT_WORDS, ROLE_WORDS, LOST_REASONS };
