/* THE BUSINESS'S BARNWRIGHT ACCOUNT: what Barnwright's control room allows.

   A business that buys the Dealer Center from Barnwright gets an activation
   key. Its Dealer Center checks in with the control room (control-room.js)
   and gets back a signed pass good for seven days: the account is on or
   off, and how many lots may be open. This file turns that pass into the
   Dealer Center's rules:

     * changes stop when the account is not on: never switched on yet,
       switched off by Barnwright, or no check-in for seven days. Everybody
       can still look at and download everything; taking a person off the
       team still works (index.js), so nobody keeps access by accident;
     * every lot's 3D designer link closes the same way (the "Our 3D
       designer isn't open right now" page with a number to call), because
       a quote a customer sends is a change too;
     * the lots open at once are capped at the plan's number. Opening a lot
       reserves its place in one shared record first (lot-slots below), so
       two lots opened at the same moment cannot both take the last place;
     * "Help from Barnwright": the owner lets Barnwright run checks for 1 to
       24 hours. Every support visit is checked online with the control room
       and against the owner's switch here, and written in a short log.

   license is null when the Dealer Center is not connected to a control room
   (Alan's own business, the sample on this computer, the demo): then
   nothing here limits anything and every answer says "not connected".

   Node-safe and browser-safe: control-room.js (the part that needs Node) is
   handed in as `license` by netlify.js, never imported here. */

import { fail, json, text, OfficeError } from "./http.js";
import { randomId } from "./hash.js";
import { canAddDealership } from "./license-core.js";

const CHECK_IN_EVERY = 6 * 3600_000;      /* check in again after six hours */
const HOLD_FOR = 2 * 60_000;              /* a half-finished lot opening holds its place this long */
const LOG_SIZE = 50;

const HELP = "barnwright-help";
const HELP_LOG = "barnwright-help-log";
const SLOTS = "barnwright-lot-slots";

/* Why changes are stopped, said plainly (the control room's reasons). */
export const ACCOUNT_WORDS = {
  unactivated: "Your Dealer Center isn't switched on yet, so changes can't be saved. Contact Barnwright to finish setting it up.",
  invalid_license: "Your Dealer Center can't confirm its Barnwright account, so changes can't be saved. Contact Barnwright.",
  deactivated: "Your Barnwright account is switched off, so changes can't be saved. You can still look at and download everything.",
  expired: "Your Dealer Center hasn't reached Barnwright in 7 days, so changes can't be saved. You can still look at and download everything.",
};
const lotLimitWords = (limit) => limit === 0
  ? "Your Barnwright plan doesn't include open lots. Contact Barnwright to add one."
  : `Your Barnwright plan includes ${limit} open lot${limit === 1 ? "" : "s"}. Close a lot, or contact Barnwright to add more.`;

export function createAccount({ store, license, lots, now, appVersion = "dealer-center", log = console.error }) {
  const connected = !!license;
  const iso = () => now().toISOString();

  /* a refusal from control-room.js -> the plain words for it */
  function refused(error) {
    if (error?.status === 423 && error.code) {
      throw new OfficeError(423, error.code === "dealership_limit_reached" ? lotLimitWords(error.limit ?? 0) : ACCOUNT_WORDS[error.code] || ACCOUNT_WORDS.invalid_license);
    }
    throw error;
  }

  async function openLots() {
    const all = await lots.all();
    return { open: all.filter((l) => l.active !== false).map((l) => l.slug), closed: new Set(all.filter((l) => l.active === false).map((l) => l.slug)) };
  }

  /* What the screens show: null when not connected. Reads only. */
  async function status() {
    if (!connected) return null;
    const a = await license.peekAccess();
    return {
      canWrite: a.canWrite, reason: a.reason, expiresAt: a.expiresAt, checkedAt: a.checkedAt ?? null,
      lotLimit: a.dealerLimit, openLots: (await openLots()).open.length,
    };
  }

  /* Check in when the pass is missing or older than six hours (or when asked).
     A failed check-in never shortens or lengthens the pass. */
  async function checkIn({ force = false } = {}) {
    if (!connected || license.misconfigured) return;
    try {
      const a = await license.peekAccess();
      if (!force && a.checkedAt && now().getTime() - a.checkedAt < CHECK_IN_EVERY) return;
      await license.refresh({ appVersion, dealerCount: (await openLots()).open.length });
    } catch (error) {
      log("Barnwright check-in failed:", error?.name || "Error");
    }
  }

  /* Before any change. */
  async function mustWrite() {
    if (!connected) return;
    try { await license.assertWritable(); } catch (e) { refused(e); }
  }

  /* May a customer use a lot's 3D designer (and send a quote)? */
  async function designerOpen() {
    if (!connected) return true;
    return (await license.peekAccess()).canWrite;
  }

  /* ---- open lots, at most the plan's number ---------------------------------------- */

  /* Reserve a place before a lot opens: the lot's link name when reopening a
     closed lot, or a placeholder for a new lot (its link name is not known
     yet). -> the reserved key, or null when not connected. */
  async function holdLot(slug = null) {
    if (!connected) return null;
    let access;
    try { access = await license.assertWritable(); } catch (e) { refused(e); }
    const { open, closed } = await openLots();
    const key = slug || `pending:${randomId(12)}`;
    const at = now(), stamp = at.toISOString();
    await store.change(SLOTS, (doc) => {
      const held = { ...(doc?.open || {}) };
      for (const [k, when] of Object.entries(held)) {
        const old = at.getTime() - Date.parse(when) > HOLD_FOR;
        if (old && (k.startsWith("pending:") || closed.has(k))) delete held[k];
      }
      for (const s of open) if (!(s in held)) held[s] = stamp;
      if (!(key in held)) {
        if (!canAddDealership(access, Object.keys(held).length)) throw new OfficeError(423, lotLimitWords(access.dealerLimit));
        held[key] = stamp;
      }
      return { open: held };
    });
    return key;
  }
  /* The new lot exists: its place is now under its link name. */
  async function keepLot(hold, slug) {
    if (!hold || hold === slug) return;
    await store.change(SLOTS, (doc) => {
      const held = { ...(doc?.open || {}) };
      delete held[hold];
      held[slug] = iso();
      return { open: held };
    });
  }
  /* The lot did not open after all, or it closed: give the place back. */
  async function freeLot(key) {
    if (!connected || !key) return;
    await store.change(SLOTS, (doc) => {
      if (!doc?.open || !(key in doc.open)) return doc ?? { open: {} };
      const held = { ...doc.open };
      delete held[key];
      return { open: held };
    });
  }

  /* ---- help from Barnwright --------------------------------------------------------------- */

  async function note(words) {
    await store.change(HELP_LOG, (doc) => ({ entries: [{ at: iso(), words }, ...(doc?.entries || [])].slice(0, LOG_SIZE) }));
  }

  async function help() {
    if (!connected) return null;
    const consent = await store.get(HELP);
    const on = !!consent?.enabled && Date.parse(consent.expiresAt) > now().getTime();
    const logged = (await store.get(HELP_LOG))?.entries || [];
    return { on, until: on ? consent.expiresAt : null, reason: on ? consent.reason : "", log: logged.slice(0, 10) };
  }

  /* person: the owner (index.js checks). data: {on, reason, hours} */
  async function setHelp(person, data) {
    if (!connected) fail(404, "This Dealer Center isn't connected to Barnwright.");
    const who = person.name || person.email;
    const approver = async () => ({ ownerId: person.email });
    if (data.on === true) {
      const reason = text(data.reason, 300, "What Barnwright should look at", { required: true });
      const hours = Number(data.hours);
      if (!Number.isInteger(hours) || hours < 1 || hours > 24) fail(422, "Pick how long Barnwright can help: 1 to 24 hours.");
      let grant;
      try {
        grant = await license.forwardSupportConsent(null, approver, { enabled: true, reason, hours });
      } catch (error) {
        log("Barnwright help could not be turned on:", error?.name || "Error");
        fail(503, "Barnwright couldn't be reached just now, so help is still off. Try again in a minute.");
      }
      await store.put(HELP, grant);
      await note(`${who} let Barnwright help for ${hours} hour${hours === 1 ? "" : "s"}: ${reason}`);
    } else if (data.on === false) {
      /* off here first: a support visit needs this switch on, so access ends now even if Barnwright can't be reached */
      const current = await store.get(HELP);
      await store.put(HELP, { ...(current || { approvedBy: person.email, reason: "", grantedAt: iso() }), enabled: false, expiresAt: iso() });
      try {
        const grant = await license.forwardSupportConsent(null, approver, { enabled: false, reason: "Turned off in the Dealer Center" });
        await store.put(HELP, grant);
      } catch (error) {
        log("Barnwright help could not be turned off at the control room:", error?.name || "Error");
      }
      await note(`${who} turned off help from Barnwright.`);
    } else {
      fail(422, "Say whether Barnwright can help.");
    }
    return help();
  }

  /* POST /.netlify/functions/tenant-diagnostics from the control room, with
     a support pass good for at most 15 minutes. Answers only how the
     Dealer Center is running: no customers, no settings, no keys. */
  let lastRefusalNote = 0;
  async function diagnostics(request) {
    if (!connected) return json({ error: "This Dealer Center isn't connected to Barnwright." }, 404);
    if (request.method !== "POST") return json({ error: "Use POST." }, 405);
    const auth = request.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    let claims;
    try {
      claims = await license.verifySupportAccess(token, async () => await store.get(HELP));
    } catch {
      /* written down only while help is on, and at most once a minute */
      if ((await help())?.on && now().getTime() - lastRefusalNote > 60_000) {
        lastRefusalNote = now().getTime();
        await note("A support check was refused: the visit had expired or didn't match the help you turned on.");
      }
      return json({ error: "Support access is off or has expired." }, 403);
    }
    const access = await license.peekAccess();
    let database = true;
    try { await store.get("price-list"); } catch { database = false; }
    await note(`Barnwright (${String(claims.actor).slice(0, 120)}) ran a check of your Dealer Center.`);
    return json({
      ok: true,
      checkedAt: iso(),
      appVersion,
      license: { mode: access.mode, reason: access.reason, expiresAt: access.expiresAt, dealerLimit: license.misconfigured ? null : access.dealerLimit },
      checks: { database, licensingConfigured: !license.misconfigured, stripeConfigured: false },
    });
  }

  return { connected, status, checkIn, mustWrite, designerOpen, holdLot, keepLot, freeLot, help, setHelp, diagnostics };
}
