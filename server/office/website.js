/* THE PUBLIC SIDE: a lot's 3D designer and the quote requests it sends.

   GET /api/lots/:slug gives the designer the business's current price list
   and the lot's public details. Nothing private is in it.

   POST /api/lots/:slug/quote-requests is a customer pressing "Send" in the
   designer. The lot comes from the address, never from what was sent. The
   design is checked and priced on the server. A customer the lot already
   knows (same email or phone) gets the new quote added to their file;
   anybody else becomes a new customer. Each send carries a one-time key, so
   pressing Send twice, or a retry after a dropped connection, makes one
   quote. Sends are limited per visitor and per lot. The answer never
   repeats the customer's contact details. */

import { sha256Hex } from "./hash.js";
import { fail, OfficeError, text, email, phone, bool, onlyKeys } from "./http.js";
import { KEEP } from "./store.js";
import { publicLotFields } from "./lots.js";
import { priceOrExplain } from "./pricing.js";

const KEY_RE = /^[A-Za-z0-9_-]{16,128}$/;
const hash = (s) => sha256Hex(s);

const TOO_MANY = "Too many quote requests from here right now. Please call the lot, or try again in a few minutes.";
const ON_ITS_WAY = "Your request is already on its way. Wait a moment, then check for the confirmation.";
const SEND_AGAIN = "Please refresh the page and send it again.";

export function createWebsite({ store, now, lots, priceList, customers, account = null, notify = async () => {}, log = console.error }) {
  /* A closed link still says who to call: the lot's own phone when the
     owner closed the whole 3D designer, the business's phone when only
     this lot is closed. It rides on the error for the "not open" page
     (pages.js closedPage); the API's answer never includes it. */
  function closed(name, phoneNumber) {
    const error = new OfficeError(404, "This designer link is not open right now.");
    if (phoneNumber) error.call = { name: name || "", phone: phoneNumber };
    throw error;
  }

  async function publicLot(slug) {
    const lot = await lots.get(slug);
    const record = lot ? await priceList.current() : null;
    const brand = record?.data.settings.brand || {};
    if (!lot) closed();
    if (lot.active === false) closed(brand.name, brand.phone);
    if (!record || record.data.settings.status === "suspended") closed(brand.name || lot.name, lot.phone || brand.phone);
    /* the business's Barnwright account stopped changes: a quote is a change, so the link closes the same way */
    if (account && !(await account.designerOpen())) closed(brand.name || lot.name, lot.phone || brand.phone);
    return { company: record.data.settings, lot: publicLotFields(lot), version: record.data.version };
  }

  /* A counter per time window, safe when many arrive at once. */
  async function limit(key, max, windowMs) {
    const bucket = Math.floor(now().getTime() / windowMs);
    let over = false;
    await store.change(key, (cur) => {
      over = false;                       /* this may run more than once */
      const count = cur?.bucket === bucket ? cur.count : 0;
      if (count >= max) { over = true; return KEEP; }
      return { bucket, count: count + 1 };
    });
    if (over) fail(429, TOO_MANY);
  }

  function contactOf(data, settings) {
    if (!data || typeof data !== "object" || Array.isArray(data)) fail(422, "Please add your name and a way to reach you.");
    onlyKeys(data, ["name", "phone", "email", "zip", "address", "note", "smsOk"], "Your details");
    const asks = settings.leads?.fields || {};
    const out = {
      name: text(data.name, 100, "Your name", { required: true }),
      phone: phone(data.phone, "Phone"),
      email: email(data.email, "Email", asks.email === "required"),
      zip: text(data.zip, 12, "ZIP", { required: asks.zip === "required" }),
      address: text(data.address, 300, "Address", { required: asks.address === "required" }),
      note: text(data.note, 1000, "Your note", { multiline: true }),
    };
    if (asks.phone === "required" && !out.phone) fail(422, "Phone is needed.");
    if (!out.phone && !out.email) fail(422, "Please add a phone number or an email address so we can reach you.");
    if (data.smsOk != null) out.smsOk = bool(data.smsOk, "OK to text");
    return out;
  }

  /* What the customer's browser gets back: the quote's number and price,
     never their own contact details. */
  function receiptOf(quote, repriced) {
    return { id: quote.id, number: quote.number, total: quote.total, price: quote.price, receivedAt: quote.at, repriced: !!repriced };
  }

  /* Claim the one-time key, so two identical sends at once make one quote.
     -> {done: receipt} when this send was already answered, or {claimed}
     when this request may go ahead. A claim left "working" for over a
     minute (the server stopped halfway) is taken over by the retry. */
  async function claim(key, fingerprint) {
    const mine = { state: "working", fingerprint, at: now().toISOString() };
    for (let attempt = 0; attempt < 3; attempt++) {
      if (await store.create(key, mine)) return { claimed: mine };
      let seen = await store.read(key);
      if (!seen) continue;                /* the other send just gave up: try again */
      if (seen.data.fingerprint !== fingerprint) fail(409, SEND_AGAIN);
      if (seen.data.state === "working") {
        const stuck = now().getTime() - Date.parse(seen.data.at) > 60000;
        if (stuck) {
          if (await store.replace(key, seen, mine)) return { claimed: mine };
          continue;
        }
        /* the same send is being saved right now (pressed twice, or a
           retry): wait a few seconds for it, then give the same receipt */
        seen = await waitWhileWorking(key);
        if (!seen) continue;              /* it failed and let go: try ourselves */
      }
      if (seen.data.state === "done") return { done: seen.data.receipt };
      fail(409, ON_ITS_WAY);
    }
    fail(409, ON_ITS_WAY);
  }

  /* -> the key's record once it is no longer "working" (null when it was
     let go), or the "working" record after about six seconds. */
  async function waitWhileWorking(key) {
    let seen = null;
    for (let i = 0; i < 30; i++) {
      await new Promise((done) => setTimeout(done, 200));
      seen = await store.read(key);
      if (!seen || seen.data.state !== "working") return seen;
    }
    return seen;
  }

  async function quoteRequest(slug, data, { clientIp = "unknown" } = {}) {
    onlyKeys(data, ["design", "contact", "idempotencyKey", "version"], "The quote request");
    const { company: settings, lot } = await publicLot(slug);
    if (typeof data.idempotencyKey !== "string" || !KEY_RE.test(data.idempotencyKey)) fail(422, SEND_AGAIN);
    const key = `website-requests/${hash(`${slug}:${data.idempotencyKey}`).slice(0, 40)}`;
    const fingerprint = hash(JSON.stringify({ design: data.design, contact: data.contact }));

    const claimed = await claim(key, fingerprint);
    if (claimed.done) return { receipt: claimed.done, created: false };

    let saved;
    try {
      await limit(`limits/${slug}/${hash(clientIp).slice(0, 32)}`, 20, 600000);
      await limit(`limits/${slug}/all`, 300, 3600000);
      const { cat } = await priceList.catalogue();
      const priced = priceOrExplain(data.design, cat, log);
      const contact = contactOf(data.contact, settings);
      saved = await customers.addWebsiteQuote(slug, contact, priced, cat);
      saved.repriced = priced.repriced;
    } catch (error) {
      /* nothing was saved: free the key so the customer can fix and resend */
      await store.remove(key).catch(() => {});
      throw error;
    }

    /* The quote is saved. From here on nothing may turn into an error, or
       the customer would send again and make a second quote. */
    const receipt = receiptOf(saved.quote, saved.repriced);
    try {
      await store.put(key, { state: "done", fingerprint, receipt, customerId: saved.customer.id, at: now().toISOString() });
    } catch (e) {
      log("A website quote was saved but its one-time key could not be marked done:", e);
    }
    try {
      await notify({ type: "website-quote", lot, customer: saved.customer, quote: saved.quote, settings });
    } catch (e) {
      log("The email about a website quote could not be sent:", e);
    }
    return { receipt, created: true };
  }

  return { publicLot, quoteRequest };
}
