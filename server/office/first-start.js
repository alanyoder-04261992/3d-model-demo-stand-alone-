/* THE OWNER'S FIRST SIGN-IN: no setup screens (Alan, Oct 12 2026: "When a
   new customer owner first log in does it still do this because I think
   it's point less should just open to home page right away").

   The first owner signs in and lands on Today. The page asks the server to
   start the business once (POST start, `start` below), and Today shows a
   "Getting started" card until every step is done or the owner hides it
   (`gettingStarted` below). docs/OFFICE.md, "The owner's first sign-in".

   start(person, data): safe to run twice, and at the same moment in two
   tabs. Once it has run (first-start), or for a business that isn't new
   (it already has its price list and a lot, or was set up the old way,
   POST setup or the old setup screens: fresh below), it does nothing.
   Otherwise, in order:
     1. The price list. One that is there already (Barnwright set it up
        before the owner signed in, or another tab just made it) is kept
        exactly as it is. Otherwise "Every standard building" at example
        prices, closed to customers, made create-only as version 1 by the
        owner, from the business name the owner typed (data.businessName,
        on the card) or the one from their sign-up (barnwright-signup-
        details, setup-access.js), with the sign-up's phone and email as
        the business's own checks give them. No name from either: 422
        "Type your business name." and nothing is written.
     2. The terms: the agreement from the owner's sign-up page is kept as
        theirs when it counts (terms.js agreeFromSignup); otherwise nothing,
        and the line at the top of the Dealer Center asks.
     3. The first lot, only when the business has no lot at all: named
        after the business (cut to a lot name's 80 characters), its link
        name made from that name (given explicitly, so two starts at once
        can't make two lots: the second gets 409), with the business phone
        and email. It takes the plan's place first (account.holdLot); a
        plan with no lot left, an account that is off (423) or a refused
        field (422) makes no lot, and the card points to Lots.
     4. first-start {at, priceList: "made" | "kept", barnwright, lot,
        startVersion}, create-only: from then on GET me's startNeeded is
        false and the card shows. The sign-up details record is removed:
        it was only for this.
     5. The owner's name, when it is empty, from the name they typed on the
        sign-up page.

   Node-safe and browser-safe (the in-browser demo runs it too). */

import { fail, text, OfficeError, phone as phoneField, email as emailField } from "./http.js";
import { KEEP } from "./store.js";
import { slugFrom } from "./lots.js";
import { START_LINE } from "./price-list.js";

export const FIRST_START = "first-start";
export const GETTING_STARTED = "getting-started";
const HISTORY_1 = "price-list-history/000001";
const TERMS_RECORD = "barnwright-terms";
/* setup-access.js DETAILS_RECORD: removed once the start ran */
const DETAILS_RECORD = "barnwright-signup-details";
/* the starting colors (price-list.js startingSettings): changing them, or a
   logo, ticks "Your logo and colors" */
const START_COLORS = { header: "#16130E", primary: "#2E2920", accent: "#C9A227" };

export const START_WORDS = Object.freeze({
  name: "Type your business name.",
  say: "Say what to change on the Getting started list.",
});

const SLUG_RE = /^[a-z0-9-]{2,40}$/;

export function createFirstStart({ store, priceList, lots, account, terms, setup, now, log = console.error }) {
  const iso = () => now().toISOString();
  const or = (fn) => { try { return fn(); } catch { return ""; } };

  /* Does the owner's start still have to run? (GET me's startNeeded): it
     never ran, and the business is a new one (fresh). */
  async function needed(person, record, lotCount) {
    if (person?.role !== "owner") return false;
    if (await store.get(FIRST_START)) return false;
    return fresh(record, lotCount);
  }

  /* A new business the start is for: no price list yet; or no lot yet and
     a price list a start made (its version 1 is Barnwright's, or says
     START_LINE: Barnwright's start before the owner signed in, or the
     owner's own start in another tab) that the owner never took on here
     (no agreement of theirs here but the one from their sign-up page).
     A business set up the old way (POST setup, the old setup screens, which
     the owner may have left before adding a lot) is never changed without
     asking: no lot, no plan place, no card. record: the price list (data). */
  async function fresh(record, lotCount) {
    if (!record) return true;
    if (lotCount > 0) return false;
    const v1 = await store.get(HISTORY_1);
    const by = (v1 || (record.version === 1 ? record : null))?.savedBy;
    const started = by?.id === "barnwright" || (Array.isArray(v1?.changes) && v1.changes[0] === START_LINE);
    if (!started) return false;
    const agreed = (await store.get(TERMS_RECORD))?.current;
    return !agreed || agreed.from === "signup";
  }

  async function start(person, data = {}) {
    const typed = data.businessName != null && data.businessName !== ""
      ? text(data.businessName, 80, "Business name", { required: true }) : "";
    /* ran already, or a business that isn't new (it has its price list and
       a lot, or was set up the old way: fresh): nothing to do, and nothing
       is written */
    const done = await store.get(FIRST_START);
    const before = await priceList.current();
    if (done || (before && !(await fresh(before.data, (await lots.all()).length)))) {
      return { record: before?.data || null, start: { priceList: "kept", lot: null, terms: null } };
    }
    const { details, agreement } = setup?.remembered ? await setup.remembered() : { details: null, agreement: null };

    /* 1. the price list */
    let current = await priceList.current();
    let made = false;
    if (!current) {
      const name = typed || (details?.business ? or(() => text(details.business, 80, "Business name", { required: true })) : "");
      if (!name) fail(422, START_WORDS.name, { code: "name" });
      /* (signupStart cleans the phone and email as the business's own checks do) */
      const settings = priceList.signupStart({ business: name, phone: details?.phone, email: details?.email });
      made = !!(await priceList.startForOwner(person, settings));
      current = await priceList.current();
      if (!current) fail(503, "Something went wrong on our end. Try again in a minute.");
      if (made) await setup.started();
    }
    const brand = current.data.settings.brand || {};

    /* 2. the terms from the sign-up page */
    let fromSignup = null;
    if (terms.asks()) {
      try { fromSignup = await terms.agreeFromSignup(person, agreement); } catch (e) {
        log("The owner's agreement from the sign-up page couldn't be kept:", e?.name || "Error");
      }
    }

    /* 3. the first lot (a name over a lot name's 80 characters, which a
       Barnwright save can give the business, is cut to fit) */
    let lot = null;
    if (!(await lots.all()).length) {
      const lotName = String(brand.name || "").slice(0, 80).trim();
      const fromName = slugFrom(lotName);
      const slug = SLUG_RE.test(fromName) ? fromName : "lot";
      let hold = null;
      try {
        hold = await account.holdLot();
        const created = await lots.create(person, {
          name: lotName, slug,
          phone: or(() => phoneField(brand.phone || "")), email: or(() => emailField(brand.email || "")),
        });
        await account.keepLot(hold, created.slug);
        lot = created.slug;
      } catch (error) {
        if (hold) await account.freeLot(hold);
        /* another tab made it (409), a refused field (422), or no plan
           place or the account is off (423): no lot, and the card says
           Add your first lot; anything else is tried again next time */
        if (!(error instanceof OfficeError && (error.status === 409 || error.status === 422 || error.status === 423))) throw error;
      }
    }

    /* 4. done, once */
    let barnwright = false;
    if (!made) {
      try { barnwright = (await store.get(HISTORY_1))?.savedBy?.id === "barnwright"; } catch { barnwright = false; }
    }
    await store.create(FIRST_START, {
      at: iso(), priceList: made ? "made" : "kept", barnwright, lot, startVersion: current.data.version,
    });
    /* the sign-up's business name, phone and email were only for this */
    if (details) {
      try { await store.remove(DETAILS_RECORD); } catch (e) {
        log("The owner's sign-up details couldn't be removed:", e?.name || "Error");
      }
    }

    /* 5. the owner's name from the sign-up page */
    if (!person.name && agreement?.signature) {
      const name = or(() => text(agreement.signature, 80, "Your name"));
      if (name) await store.change(`people/${person.userId}`, (p) => (p && !p.name ? { ...p, name } : KEEP));
    }

    return { record: current.data, start: { priceList: made ? "made" : "kept", lot, terms: fromSignup ? "signup" : null } };
  }

  /* GET me's gettingStarted, for the owner: null for everybody else, once
     the owner hid it, before the start ran (unless there is no price list
     yet: then the card asks for the business name), and once every step is
     done. record: the price list record (data), lotList: every lot. */
  async function gettingStarted(person, record, lotList) {
    if (person?.role !== "owner") return null;
    /* no price list yet: the business name first (never hidden) */
    if (!record) return { name: true, barnwright: false, steps: [], lotLimit: null, openLots: 0 };
    const kept = (await store.get(GETTING_STARTED)) || {};
    if (kept.hidden) return null;
    const first = await store.get(FIRST_START);
    if (!first) return null;
    const s = record.settings;
    const open = s.status !== "suspended";
    const colors = s.brand?.colors || {};
    const openLots = lotList.filter((l) => l.active !== false).length;
    const status = await account.status();
    const limit = status ? Number(status.lotLimit) : null;
    const people = (await store.all("people/")).filter((p) => p.active !== false).length;
    const invited = (await store.keys("invites/")).length;
    const steps = [
      { id: "prices", done: !!kept.prices || open },
      { id: "look", done: !!s.brand?.logo || Object.entries(START_COLORS).some(([k, v]) => String(colors[k] || "").toUpperCase() !== v) },
      /* "other lots": one more lot open is enough (the plan's other places can wait) */
      ...(!lotList.length ? [{ id: "lot", done: false }] : limit > 1 ? [{ id: "lots", done: openLots >= 2 }] : []),
      { id: "team", done: people > 1 || invited > 0 },
      ...(lotList.length ? [{ id: "preview", done: !!kept.preview || open }] : []),
      { id: "open", done: open },
    ];
    if (steps.every((x) => x.done)) return null;
    return { name: false, barnwright: !!first.barnwright, steps, lotLimit: limit, openLots };
  }

  /* POST getting-started: {hide: true} or {preview: true}, by the owner. */
  async function change(data) {
    const hide = data?.hide === true, preview = data?.preview === true;
    if (!hide && !preview) fail(422, START_WORDS.say);
    const at = iso();
    await store.change(GETTING_STARTED, (doc) => ({ ...(doc || {}), ...(hide ? { hidden: at } : {}), ...(preview && !doc?.preview ? { preview: at } : {}) }));
  }

  /* A step done somewhere else (the owner's own price list save): ticked
     once, only after the start. Never stops what called it. */
  async function tick(key) {
    try {
      if (!(await store.get(FIRST_START))) return;
      await store.change(GETTING_STARTED, (doc) => (doc?.[key] ? KEEP : { ...(doc || {}), [key]: iso() }));
    } catch (e) {
      log("A Getting started tick couldn't be saved:", e?.name || "Error");
    }
  }

  return { needed, start, gettingStarted, change, tick };
}
