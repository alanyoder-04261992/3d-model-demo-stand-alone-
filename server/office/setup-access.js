/* BARNWRIGHT SETUP ACCESS: when Barnwright may change a business's price
   list and settings, and the visit in Alan's browser (docs/OFFICE.md,
   "Barnwright setup access" is the contract).

   Alan's words (October 2026): "I get access to change thing from control
   room until it goes live and then in the owner setting they can turn
   switch on to give me access."

     * Before the business is LIVE, Barnwright can change its price list and
       settings with no switch: that is how Alan sets a new business up.
     * After it is live, only while the owner's switch is on (Settings,
       Barnwright, "Run checks and change my price list and settings"),
       for 1 to 24 hours. The owner turns it off at any time.
     * Nothing works until the owner has agreed to the Barnwright Terms and
       Conditions 2.2 or later.

   access() works this out from this Dealer Center's own records on EVERY
   Barnwright request. It never asks the Control Room, so the owner's "off"
   works even when the Control Room is down.

   LIVE is the first of: the owner opens the 3D designer to customers (a
   price list save whose status isn't "suspended"), or the first real quote
   or order is saved. The record barnwright-live is written BEFORE that
   change (price-list.js and customers.js call markLive), and once live it
   never changes. For businesses set up before this shipped, the first look
   (liveRecord) goes back through the price list's history and the
   customers; too much to look through, or a read that fails, counts as
   live. That look back runs only for Barnwright requests, the owner's card
   and the scheduled check-in function -- never inside the check-in itself
   (report() reads stored records only) and never in GET me.

   THE VISIT (Alan in their Dealer Center, in his own browser): the Control
   Room hands Alan a link with a one-use setup pass after the #; the page
   posts it to POST /api/office/barnwright/start, and gets the cookie
   __Host-bw_setup (only its SHA-256 is kept, in barnwright-sessions). A
   visit lasts while access is open and at most 8 hours after its last
   request. Its routes are separate (/api/office/barnwright/*): Barnwright
   is never a person on the team or a role in `can`, so the visit can never
   reach customers, orders, the team, Help or the owner's own card.

   This module is given no way to send email or texts. Node-safe and
   browser-safe: it never imports control-room.js (that is handed in as
   `license` by netlify.js), so the in-browser demo still runs. */

import { fail, json, text, OfficeError, readJsonRaw, cookieOf } from "./http.js";
import { sha256Hex } from "./hash.js";
import { KEEP } from "./store.js";
import { withinMs } from "./account.js";
import { lockProblems, carryLocked } from "./setup-lock.js";

const SETUP = "barnwright-setup";
const LIVE = "barnwright-live";
const SEEN = "barnwright-setup-seen";
const SESSIONS = "barnwright-sessions";
const LIMITS = "barnwright-setup-limits";
const TERMS_RECORD = "barnwright-terms";

export const TERMS_NEEDED = "2.2";
export const COOKIE = "__Host-bw_setup";
const VISIT_MS = 8 * 3600_000;
const MAX_SESSIONS = 20;
const REQUESTS_PER_HOUR = 120;
const SAVES_PER_DAY = 60;
const LOOK_BACK_MAX = 500;
const REPORT_MS = 500;
const REFUSED_NOTE_EVERY = 60_000;

/* What Alan and Claude read for each reason access is closed. */
export const WHY = Object.freeze({
  "not-connected": "This Dealer Center isn't connected to Barnwright.",
  "no-price-list": "The owner hasn't finished First setup yet, so there is no price list to change.",
  terms: "The owner hasn't agreed to the Barnwright Terms and Conditions 2.2 yet. They see the button at the top of their Dealer Center.",
  stopped: "The owner stopped Barnwright's setup access in Settings, Barnwright.",
  "live-off": "Their 3D designer is open to customers, so you need the owner's switch. Ask the owner to turn on Run checks and change my price list and settings in Settings, Barnwright.",
});

export const VISIT_WORDS = Object.freeze({
  linkRanOut: "This link ran out. Tap Open their price list again.",
  ended: "Your Barnwright visit ended. In your Control Room tap Open their price list, then come back and tap Save.",
});

export const OWNER_WORDS = Object.freeze({
  termsFirstRefusal: "Agree to the new Barnwright Terms and Conditions at the top of the page first.",
  afterLivePrelive: "Your 3D designer is open, so use Run checks and change my price list and settings instead.",
  notReached: "Barnwright couldn't be reached just now, so checks are off. Barnwright can change your price list and settings.",
  level: "Pick what Barnwright can do: run checks, or run checks and change your price list and settings.",
  hours: "Pick how long Barnwright can help: 1 to 24 hours.",
  say: "Say whether Barnwright can help.",
});

const TOO_MANY = "Too many Barnwright requests for this Dealer Center this hour. Try again later.";
const TOO_MANY_SAVES = "Barnwright has saved 60 changes here today. Try again tomorrow.";
const BAD_REQUEST = "The Control Room sent a request this Dealer Center can't read.";

const hoursWords = (n) => `${n} hour${n === 1 ? "" : "s"}`;
const historyKey = (version) => `price-list-history/${String(version).padStart(6, "0")}`;

/* "2.2" or later ("2.10" is later than "2.9"). */
export function termsAtLeast(version, need = TERMS_NEEDED) {
  if (typeof version !== "string" || !/^\d{1,4}(\.\d{1,4}){0,3}$/.test(version)) return false;
  const a = version.split(".").map(Number), b = need.split(".").map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) > (b[i] || 0);
  }
  return true;
}

/* The owner's log line for a Barnwright save: the first 3 change lines and a count. */
export function changedWords(actor, lines) {
  return `Barnwright (${actor}) changed your price list: ${lines.slice(0, 3).join("; ")}${lines.length > 3 ? `, and ${lines.length - 3} more` : ""}.`;
}

function b64url(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/* deps: store, license (null when not connected), priceList, account,
   lots, website, now, log, appVersion, standardRise (the library's own
   gable rise, for the lock). */
export function createSetupAccess({ store, license, priceList, account, lots, website, now, log = console.error, appVersion = "dealer-center", standardRise = null }) {
  const connected = !!license && !license.misconfigured;
  const iso = () => now().toISOString();
  const ms = () => now().getTime();
  let knownLive = null;
  let lastRefusalNote = 0;

  const note = async (words, extra) => {
    try { await account.note(words, extra); } catch (e) { log("A line for the owner's Barnwright log could not be saved:", e?.name || "Error"); }
  };

  async function termsOk() {
    return termsAtLeast((await store.get(TERMS_RECORD))?.current?.version);
  }
  const switchOn = (rec) => !!rec?.enabled && Date.parse(rec.expiresAt) > ms();

  /* ---- live ------------------------------------------------------------------------------ */

  /* Write the live record (once: it never changes after). how: opened,
     quote, order, website-quote (the change about to be saved), or what the
     look back found (found-open, history, customers, unsure). */
  async function markLive(how, { quiet = false } = {}) {
    if (knownLive) return knownLive;
    let changed = false;
    const rec = await store.change(LIVE, (doc) => {
      changed = false;
      if (doc?.live) return KEEP;
      changed = true;
      return { live: true, liveAt: iso(), how };
    });
    if (rec?.live) knownLive = rec;
    if (changed && !quiet && connected) {
      await note(how === "opened" ? "Barnwright's setup access ended when you opened your 3D designer to customers."
        : "Barnwright's setup access ended when your first quote was saved.");
    }
    return rec;
  }

  /* First setup: not live, nothing to look back through. */
  async function started() {
    try {
      await store.change(LIVE, (doc) => (doc ? KEEP : { live: false, checkedThrough: 1 }));
    } catch (e) {
      log("The Barnwright live record could not be started:", e?.name || "Error");
    }
  }

  /* Look back through history versions from+1..to (and the customers on
     the first look). -> how it was live, or null. strict: a missing history
     entry counts as "unsure" (the first look, for businesses set up before
     the live record existed). */
  async function lookBack(from, to, { customers, strict }) {
    if (to - from > LOOK_BACK_MAX) return "unsure";
    const versions = [];
    for (let v = from + 1; v <= to; v++) versions.push(v);
    for (let i = 0; i < versions.length; i += 16) {
      const batch = await Promise.all(versions.slice(i, i + 16).map((v) => store.get(historyKey(v))));
      for (const e of batch) {
        if (!e) { if (strict) return "unsure"; continue; }
        if (e.settings?.status !== "suspended") return "history";
      }
    }
    if (customers) {
      const keys = await store.keys("customers/");
      if (keys.length > LOOK_BACK_MAX) return "unsure";
      for (let i = 0; i < keys.length; i += 16) {
        const batch = await Promise.all(keys.slice(i, i + 16).map((k) => store.get(k)));
        if (batch.some((c) => c && ((c.quotes || []).length || (c.orders || []).length))) return "customers";
      }
    }
    return null;
  }

  /* -> the live record. scan: look back when needed (Barnwright requests,
     the owner's card, the scheduled check-in); without it, only what is
     stored (null when nothing is). pl: the price list record, when read. */
  async function liveRecord({ scan = true, pl } = {}) {
    const rec = await store.get(LIVE);
    if (rec?.live) return rec;
    const current = pl !== undefined ? pl : await priceList.current();
    if (!current) return rec || null;
    if (current.data.settings.status !== "suspended") {
      return scan ? markLive("found-open", { quiet: true }) : { live: true, liveAt: null, how: "found-open" };
    }
    if (!scan) return rec || null;
    const from = rec ? Math.max(0, Number(rec.checkedThrough) || 0) : 0;
    if (rec && current.data.version <= from) return rec;
    let how;
    try { how = await lookBack(from, current.data.version, { customers: !rec, strict: !rec }); } catch (e) {
      log("Barnwright's look back couldn't read everything, so the business counts as live:", e?.name || "Error");
      how = "unsure";
    }
    if (how) return markLive(how, { quiet: true });
    return store.change(LIVE, (doc) => (doc?.live ? KEEP : { live: false, checkedThrough: Math.max(Number(doc?.checkedThrough) || 0, current.data.version) }));
  }

  /* ---- access --------------------------------------------------------------------------- */

  /* Where access stands. null when not connected. scan as liveRecord;
     without it and with no live record yet, nothing is said to be open. */
  async function view({ scan = true, pl } = {}) {
    if (!connected) return null;
    const record = pl !== undefined ? pl : await priceList.current();
    const rec = (await store.get(SETUP)) || {};
    const ok = await termsOk();
    const prelive = rec.prelive === "stopped" ? "stopped" : "on";
    const liveRec = record ? await liveRecord({ scan, pl: record }) : null;
    const live = !!liveRec?.live || (!!record && record.data.settings.status !== "suspended");
    let mode = null, why = null;
    if (!record) why = "no-price-list";
    else if (!ok) why = "terms";
    else if (switchOn(rec)) mode = "switch";
    else if (live) why = "live-off";
    else if (!liveRec) why = "unknown";
    else if (prelive === "stopped") why = "stopped";
    else mode = "prelive";
    return {
      mode, until: mode === "switch" ? rec.expiresAt : null, why: mode ? null : why,
      live, liveAt: liveRec?.live ? liveRec.liveAt || null : null, prelive, termsOk: ok, record, switchRecord: rec,
    };
  }
  const access = () => view({ scan: true });

  /* Who saved, by role, never by name or email (F8). */
  async function byWords(savedBy) {
    if (!savedBy || typeof savedBy !== "object") return "someone no longer on the team";
    if (savedBy.id === "barnwright") return typeof savedBy.name === "string" && /^Barnwright \(.{1,200}\)$/.test(savedBy.name) ? savedBy.name : "Barnwright";
    if (typeof savedBy.id !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(savedBy.id)) return "someone no longer on the team";
    const p = await store.get(`people/${savedBy.id}`);
    if (!p || p.active === false) return "someone no longer on the team";
    return p.role === "owner" ? "the owner" : p.role === "manager" ? "a manager" : "a dealer";
  }

  async function lastBarnwrightSave(data) {
    if (!data) return null;
    if (data.savedBy?.id === "barnwright") return { version: data.version, passId: data.savedBy.passId || null, at: data.savedAt };
    const names = (await store.keys("price-list-history/")).sort().reverse().slice(0, 20);
    for (const key of names) {
      const e = await store.get(key);
      if (e?.savedBy?.id === "barnwright") return { version: e.version, passId: e.savedBy.passId || null, at: e.savedAt };
    }
    return null;
  }

  /* The status fields every door answer carries (the door is part 2). */
  async function status(v = null) {
    v ||= await access();
    if (!v) return null;
    const data = v.record?.data || null;
    return {
      v: 1, live: v.live, liveAt: v.liveAt, access: v.mode || "closed", why: v.mode ? null : v.why, until: v.until,
      prelive: v.prelive, termsOk: v.termsOk,
      priceList: data ? { version: data.version, savedAt: data.savedAt, by: await byWords(data.savedBy), open: data.settings.status !== "suspended" } : null,
      lastBarnwrightSave: await lastBarnwrightSave(data),
      canUndo: data?.savedBy?.id === "barnwright",
      appVersion,
    };
  }

  /* For the check-in: stored records only, at most 500 ms; null when it
     fails, runs over, or the live record isn't written yet. */
  async function report() {
    if (!connected) return null;
    const work = (async () => {
      if (!(await store.get(LIVE))) return null;
      const v = await view({ scan: false });
      if (!v || v.why === "unknown") return null;
      return { v: 1, live: v.live, liveAt: v.liveAt, access: v.mode || "closed", why: v.mode ? null : v.why, until: v.until, prelive: v.prelive, termsOk: v.termsOk };
    })();
    try { return await withinMs(work, REPORT_MS); } catch (e) {
      log("The Barnwright setup report was skipped:", e?.name || "Error");
      return null;
    }
  }

  /* GET me: the owner's banner, from stored records only. */
  async function mine(pl) {
    const v = await view({ scan: false, pl });
    if (!v) return null;
    return { mode: v.mode, until: v.until, live: v.live };
  }

  /* ---- the owner's card (Settings, Barnwright) -------------------------------------------- */

  async function ownerView() {
    const v = await view({ scan: true });
    if (!v) return null;
    return { mode: v.mode, until: v.until, why: v.why === "unknown" ? null : v.why, live: v.live, liveAt: v.liveAt, prelive: v.prelive, termsOk: v.termsOk };
  }

  async function ownerGet() {
    return { help: await account.help(), setup: await ownerView() };
  }

  /* person: the owner (index.js checks). data: {on, reason, hours, level},
     {on: false} or {prelive: "stopped" | "on"}. */
  async function ownerSet(person, data) {
    if (!account.connected) fail(404, WHY["not-connected"]);
    const who = person.name || person.email;
    let notice = null;
    if (data?.on === true) {
      const level = data.level == null ? "checks" : data.level;
      if (level !== "checks" && level !== "change") fail(422, OWNER_WORDS.level);
      const reason = text(data.reason, 300, "What Barnwright should do", { required: true });
      const hours = Number(data.hours);
      if (!Number.isInteger(hours) || hours < 1 || hours > 24) fail(422, OWNER_WORDS.hours);
      if (level === "change") {
        if (!connected) fail(404, WHY["not-connected"]);
        if (!(await termsOk())) fail(422, OWNER_WORDS.termsFirstRefusal);
        const at = now();
        const until = new Date(at.getTime() + hours * 3600_000).toISOString();
        /* here first: changes never wait for the Control Room */
        await store.change(SETUP, (doc) => ({
          prelive: doc?.prelive === "stopped" ? "stopped" : "on", enabled: true, reason, hours,
          grantedAt: at.toISOString(), expiresAt: until, approvedBy: person.email,
        }));
        try { await account.setHelp(person, { on: true, reason, hours }, { quiet: true }); } catch (e) {
          if (!(e instanceof OfficeError)) throw e;
          notice = OWNER_WORDS.notReached;
        }
        await note(`${who} let Barnwright run checks and change the price list and settings for ${hoursWords(hours)}: ${reason}`, { until });
      } else {
        await account.setHelp(person, { on: true, reason, hours });
      }
    } else if (data?.on === false) {
      /* both off at once, here first */
      await store.change(SETUP, (doc) => ({ ...(doc || {}), prelive: doc?.prelive === "stopped" ? "stopped" : "on", enabled: false, expiresAt: iso() }));
      await account.setHelp(person, { on: false }, { quiet: true });
      await note(`${who} turned off Barnwright's access.`);
    } else if (data?.prelive === "stopped" || data?.prelive === "on") {
      if (!connected) fail(404, WHY["not-connected"]);
      const v = await view({ scan: true });
      if (v.live) fail(422, OWNER_WORDS.afterLivePrelive);
      await store.change(SETUP, (doc) => ({ enabled: false, ...(doc || {}), prelive: data.prelive }));
      await note(data.prelive === "stopped" ? `${who} stopped Barnwright's setup access.` : `${who} let Barnwright set up the price list again.`);
    } else {
      fail(422, OWNER_WORDS.say);
    }
    /* Alan's Control Room knows within seconds (best effort, 3 seconds) */
    try { await withinMs(account.checkIn({ force: true }), 3000); } catch { /* the next check-in tells it */ }
    return { ...(await ownerGet()), ...(notice ? { notice } : {}) };
  }

  /* ---- limits, passes, the log ------------------------------------------------------------ */

  const refusal = (status, code, words, extra = {}) => new OfficeError(status, words, { ok: false, code, ...extra });

  /* 120 Barnwright requests an hour (door and visit together); 60 saves a day. */
  async function count({ save = false } = {}) {
    const t = ms();
    const hour = Math.floor(t / 3600_000), day = Math.floor(t / 86400_000);
    let over = null;
    await store.change(LIMITS, (doc) => {
      over = null;
      const d = {
        hour, requests: doc?.hour === hour ? Number(doc.requests) || 0 : 0,
        day, saves: doc?.day === day ? Number(doc.saves) || 0 : 0,
      };
      if (!save && d.requests >= REQUESTS_PER_HOUR) { over = TOO_MANY; return KEEP; }
      if (save && d.saves >= SAVES_PER_DAY) { over = TOO_MANY_SAVES; return KEEP; }
      if (save) d.saves++; else d.requests++;
      return d;
    });
    if (over) throw refusal(429, "too-many", over);
  }

  /* Spend a pass's id before anything is done with it. -> false when it was spent already. */
  async function spend(claims) {
    const t = ms();
    let used = false;
    await store.change(SEEN, (doc) => {
      used = false;
      const ids = {};
      for (const [id, until] of Object.entries(doc?.ids || {})) if (Number(until) > t) ids[id] = until;
      if (Object.prototype.hasOwnProperty.call(ids, claims.id)) { used = true; return KEEP; }
      ids[claims.id] = claims.expiresAt;
      return { ids };
    });
    return !used;
  }

  /* A refused Barnwright change, in the owner's log while access is open, at most once a minute. */
  async function refusedNote(words) {
    if (ms() - lastRefusalNote < REFUSED_NOTE_EVERY) return;
    lastRefusalNote = ms();
    await note(`A Barnwright change was refused: ${String(words).replace(/\.$/, "")}.`);
  }

  /* ---- the visit ---------------------------------------------------------------------------- */

  const cookieLine = (token, seconds) => `${COOKIE}=${token}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${Math.max(0, Math.floor(seconds))}`;
  const ended = () => new OfficeError(401, VISIT_WORDS.ended, { code: "visit-ended" });
  const visitEnd = (v) => {
    const t = ms() + VISIT_MS;
    return new Date(v.mode === "switch" ? Math.min(t, Date.parse(v.until)) : t).toISOString();
  };
  const prune = (doc, t) => {
    const out = {};
    const live = Object.entries(doc || {}).filter(([, s]) => s && Date.parse(s.endsAt) > t)
      .sort((a, b) => String(b[1].lastAt).localeCompare(String(a[1].lastAt))).slice(0, MAX_SESSIONS);
    for (const [k, s] of live) out[k] = s;
    return out;
  };

  /* POST /api/office/barnwright/start, with the pass (action "session") and
     the body exactly {"action":"session"}. */
  async function start(request) {
    if (!connected) throw refusal(404, "not-connected", WHY["not-connected"]);
    const auth = request.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    let raw;
    try { ({ raw } = await readJsonRaw(request, { maxBytes: 1024 })); } catch { throw refusal(400, "bad-request", BAD_REQUEST); }
    let claims;
    try { claims = await license.verifySetupPass(token, { action: "session", bodyBytes: raw }); } catch (e) {
      log("A Barnwright visit's pass was refused:", e?.reason || "pass");
      throw refusal(401, "pass", VISIT_WORDS.linkRanOut);
    }
    if (!(await spend(claims))) throw refusal(410, "pass-used", VISIT_WORDS.linkRanOut);
    await count();
    const v = await access();
    if (!v.mode) throw refusal(403, "closed", WHY[v.why] || WHY["live-off"], { why: v.why });
    const bytes = new Uint8Array(32);
    globalThis.crypto.getRandomValues(bytes);
    const session = b64url(bytes);
    const at = iso(), endsAt = visitEnd(v);
    await store.change(SESSIONS, (doc) => ({ ...prune(doc, ms()), [sha256Hex(session)]: { actor: claims.actor, passId: claims.id, startedAt: at, lastAt: at, endsAt } }));
    await note(`Barnwright (${claims.actor}) opened your price list.`, { until: endsAt });
    const name = v.record?.data.settings.brand?.name || "";
    return json({ ok: true, mode: v.mode, until: v.until, visitEndsAt: endsAt, business: { name } }, 200,
      { "Set-Cookie": cookieLine(session, (Date.parse(endsAt) - ms()) / 1000) });
  }

  /* Every other visit request: the cookie, a visit that hasn't ended, and
     access() again. -> {key, token, actor, passId, view, endsAt}; the end
     moves 8 hours on (never past the switch's end). */
  async function from(request) {
    if (!connected) throw refusal(404, "not-connected", WHY["not-connected"]);
    const token = cookieOf(request, COOKIE);
    if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw ended();
    const key = sha256Hex(token);
    const s = (await store.get(SESSIONS))?.[key];
    if (!s || Date.parse(s.endsAt) <= ms()) throw ended();
    const v = await access();
    if (!v.mode) {
      await store.change(SESSIONS, (doc) => (doc?.[key] ? (() => { const d = { ...doc }; delete d[key]; return d; })() : KEEP));
      throw ended();
    }
    await count();
    const endsAt = visitEnd(v);
    await store.change(SESSIONS, (doc) => {
      if (!doc?.[key]) return KEEP;
      return { ...prune(doc, ms()), [key]: { ...doc[key], lastAt: iso(), endsAt } };
    });
    return { key, token, actor: s.actor, passId: s.passId, view: v, endsAt };
  }

  /* An answer during a visit: the cookie again, with its new end. */
  function keep(response, s) {
    response.headers.append("Set-Cookie", cookieLine(s.token, (Date.parse(s.endsAt) - ms()) / 1000));
    return response;
  }

  /* PUT price-list and POST price-list/restore during a visit. */
  async function save(s, data, { restore = false } = {}) {
    await account.mustWrite();
    await count({ save: true });
    const savedBy = { id: "barnwright", name: `Barnwright (${s.actor})`, passId: s.passId };
    const lock = (old, next) => lockProblems(old, next, { standardRise });
    let saved;
    try {
      saved = restore
        ? await priceList.restore(null, { version: data.version, current: data.current }, { lock, savedBy, ensureHistory: true, carry: carryLocked })
        : await priceList.save(null, { settings: data.settings, version: data.version }, { lock, savedBy, ensureHistory: true });
    } catch (e) {
      if (e?.locked) await refusedNote(e.problems?.[0] || e.message);
      throw e;
    }
    if (saved.changes?.length) await note(changedWords(s.actor, saved.changes));
    return saved;
  }

  /* POST /api/office/barnwright/end: Done. */
  async function end(request) {
    const token = cookieOf(request, COOKIE);
    if (connected && token && /^[A-Za-z0-9_-]{43}$/.test(token)) {
      const key = sha256Hex(token);
      await store.change(SESSIONS, (doc) => {
        if (!doc?.[key]) return KEEP;
        const d = { ...doc };
        delete d[key];
        return d;
      });
    }
    return json({ ok: true }, 200, { "Set-Cookie": cookieLine("", 0) });
  }

  async function lotList() {
    return { lots: (await lots.all()).map((l) => ({ slug: l.slug, name: l.name, active: l.active !== false })) };
  }

  return {
    connected, access, view, status, report, mine, liveRecord, markLive, started, termsOk,
    owner: { get: ownerGet, set: ownerSet },
    visit: { start, from, keep, save, end, lots: lotList, preview: (slug) => website.previewLot(slug) },
  };
}
