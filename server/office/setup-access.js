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

   THE DOOR (door(request), the function barnwright-setup): the Control
   Room's server, for Alan and for Claude through the Control Room, with a
   one-use setup pass for each request, made for that request's exact body.
   It can tell where access stands (status), read the price list in parts
   (read, setup-view.js), check a list of edits without saving anything
   (check, setup-edits.js), save exactly what was checked (save: the
   settings' SHA-256 must match), and put back the price list from before
   Barnwright's last change (undo). While the owner's switch is on, only a
   save Alan tapped in the Control Room goes through (via "control-room").

   This module is given no way to send email or texts. Node-safe and
   browser-safe: it never imports control-room.js (that is handed in as
   `license` by netlify.js), so the in-browser demo still runs. */

import { fail, json, text, OfficeError, readJsonRaw, cookieOf } from "./http.js";
import { sha256Hex } from "./hash.js";
import { KEEP } from "./store.js";
import { withinMs } from "./account.js";
import { lockProblems, carryLocked } from "./setup-lock.js";
import { versionAtLeast, TERMS, signupCounts, termsCopies } from "./terms.js";
import { applyEdits, warnings, UNDO_LINE, TOO_MANY_EDITS, MAX_EDITS } from "./setup-edits.js";
import { readView, PARTS } from "./setup-view.js";
import { describeChanges, START_LINE } from "./price-list.js";

const SETUP = "barnwright-setup";
const LIVE = "barnwright-live";
const SEEN = "barnwright-setup-seen";
const SESSIONS = "barnwright-sessions";
const LIMITS = "barnwright-setup-limits";
const TERMS_RECORD = "barnwright-terms";
/* the owner's sign-up agreement, as the first pass that carried one that
   counts brought it (create-only, never changed; never a phone, email or
   business name) */
const SIGNUP_RECORD = "barnwright-signup-agreement";
/* the first owner's claim, written at the owner's first confirmed sign-in
   (people.js): until it exists, no owner has signed in */
const OWNER_CLAIM = "setup";
/* the status fields' version: 2 knows sign-up agreements and version 0 */
export const STATUS_V = 2;

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
  /* both places the owner agrees: the box in First setup (where an owner
     who just signed in is, with no button on top, even when Barnwright
     already started their price list), or the button at the top of their
     Dealer Center after it (the Control Room's OWNER_TERMS, word for word) */
  terms: "The owner hasn't agreed to the Barnwright Terms and Conditions 2.2 yet. They tick the box in First setup, or tap the button at the top of their Dealer Center.",
  "signup-terms": "They signed up before the Barnwright Terms and Conditions 2.2, so you can't start their price list yet. They agree to the new terms when they first sign in to their Dealer Center.",
  "signup-unknown": "Their Dealer Center doesn't have the terms they signed up under yet, so you can't start their price list. It gets the newest terms with its next deploy.",
  stopped: "The owner stopped Barnwright's setup access in Settings, Barnwright.",
  "live-off": "Their 3D designer is open to customers, so you need the owner's switch. Ask the owner to turn on Run checks and change my price list and settings in Settings, Barnwright.",
});

/* Until this Dealer Center's own terms are 2.2 or later, no owner can agree
   to them, so the words for why "terms" say so instead of pointing at a
   button that isn't there. */
export const TERMS_NOT_OUT = "Barnwright's new terms (2.2) aren't out yet, so Barnwright can only run checks for now.";

export const VISIT_WORDS = Object.freeze({
  linkRanOut: "This link ran out. Tap Open their price list again.",
  ended: "Your Barnwright visit ended. In your Control Room tap Open their price list, then come back and tap Save.",
  /* access closed while Alan worked: why, and that his work is kept */
  closed: (why) => `Your Barnwright visit ended. ${why} Your changes are kept in this tab.`,
});

export const OWNER_WORDS = Object.freeze({
  termsFirstRefusal: "Agree to the new Barnwright Terms and Conditions at the top of the page first.",
  afterLivePrelive: "Your 3D designer is open, so use Run checks and change my price list and settings instead.",
  notReached: "Barnwright couldn't be reached just now, so checks are off. Barnwright can change your price list and settings.",
  level: "Pick what Barnwright can do: run checks, or run checks and change your price list and settings.",
  hours: "Pick how long Barnwright can help: 1 to 24 hours.",
  say: "Say whether Barnwright can help.",
});

/* A refused Barnwright change, in the owner's log (at most once a minute,
   while access is open): always in the owner's own words, never the door's
   words for Alan (docs/OFFICE.md, The door, Refusals). */
export const REFUSED_LOG = Object.freeze({
  "needs-alan": "Barnwright tried a change that needs Alan's OK in his Control Room first. Nothing was changed.",
  locked: "Barnwright tried to change something only you can change. Nothing was changed.",
  other: "Barnwright tried a change that couldn't be saved. Nothing was changed.",
});

const TOO_MANY = "Too many Barnwright requests for this Dealer Center this hour. Try again later.";
const TOO_MANY_SAVES = "Barnwright has saved 60 changes here today. Try again tomorrow.";
const BAD_REQUEST = "The Control Room sent a request this Dealer Center can't read.";

/* The door's own refusals (docs/OFFICE.md, The door, Refusals). */
export const DOOR_WORDS = Object.freeze({
  method: "Use POST.",
  badRequest: BAD_REQUEST,
  tooBig: "That request is too big. Send at most 64 KB.",
  pass: "The pass for this request isn't valid. Try again from the Control Room.",
  passUsed: "This pass was already used. Each request needs a new pass.",
  needsAlan: "Their 3D designer is open, so this change has to be made from your Control Room's Make the change page.",
  version: "The price list was saved since you read it. Read it again, then check the change again.",
  changed: "The result isn't the one you checked. Check the change again.",
  cantUndo: "The owner saved the price list after your change, so undo would take theirs away too. The owner can put back an earlier price list in Price list, History.",
  nothingToUndo: "Barnwright hasn't changed this price list, so there is nothing to undo.",
  nothingBeforeStart: "This is the starting price list Barnwright set up, so there is nothing before it to put back.",
  copyGone: "The copy from before Barnwright's last change is gone, so it can't be put back here. The owner can put back an earlier price list in Price list, History.",
  accountOff: "Their Dealer Center can't save changes right now: its Barnwright account is off or hasn't checked in for 7 days. Reading still works.",
  error: "Something went wrong on their Dealer Center. Try again in a minute.",
});
const DOOR_ACTIONS = ["status", "read", "check", "save", "undo"];
const DOOR_MAX_BYTES = 64 * 1024;
const CHANGE_LINES = 500;
const HISTORY_SHOWN = 20;
const LOOKED = "Barnwright looked at your price list.";
const LOOKED_EVERY = 30 * 60_000;
const HELP_LOG = "barnwright-help-log";

const hoursWords = (n) => `${n} hour${n === 1 ? "" : "s"}`;
const historyKey = (version) => `price-list-history/${String(version).padStart(6, "0")}`;

/* "2.2" or later ("2.10" is later than "2.9"). */
export const termsAtLeast = (version, need = TERMS_NEEDED) => versionAtLeast(version, need);
/* Terms 2.2 are out: this Dealer Center asks owners to agree to them. */
export const termsOut = () => termsAtLeast(TERMS.version);
/* The words for a reason access is closed. */
export const whyWords = (why) => (why === "terms" && !termsOut() ? TERMS_NOT_OUT : WHY[why] || WHY["live-off"]);

/* The owner's log line for a Barnwright save: the first 3 change lines and a count. */
export function changedWords(actor, lines) {
  return `Barnwright (${actor}) changed your price list: ${lines.slice(0, 3).join("; ")}${lines.length > 3 ? `, and ${lines.length - 3} more` : ""}.`;
}
/* The owner's log line when Barnwright starts the price list before the owner first signs in. */
export const startedWords = (actor) => `Barnwright (${actor}) started your price list from Every standard building, using the terms you agreed to when you signed up.`;

function b64url(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/* deps: store, license (null when not connected), priceList, account,
   lots, website, now, log, appVersion, manufacturer (the builder's
   library, for the door's edits, reads and the lock), library (the
   builder's construction library, library/construction.json, which the
   How it's built change words read), terms (the terms this
   copy ships: TERMS; the checks and the local copy may pretend to ship
   newer ones) and copies (this copy's own copies of the terms by version,
   docs/legal/terms-sha256.json), for the owner's sign-up agreement. */
export function createSetupAccess({
  store, license, priceList, account, lots, website, now, log = console.error, appVersion = "dealer-center", manufacturer = {}, library = null,
  terms = TERMS, copies = termsCopies(),
}) {
  const connected = !!license && !license.misconfigured;
  /* this copy's own terms are 2.2 or later, so an owner can agree to them */
  const termsOutHere = termsAtLeast(terms.version);
  const whyHere = (why) => (why === "terms" && !termsOutHere ? TERMS_NOT_OUT : WHY[why] || WHY["live-off"]);
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
     look back found (found-open, history, customers, unsure: quiet, with
     no liveAt, as nobody knows when).

     The owner's log says setup access ended only when this business was
     known to be setting up (a record {live: false}). A business set up
     before the record existed is looked back through first, so an owner
     whose 3D designer was open long ago isn't told it ended today. Every
     Barnwright visit ends with it. */
  async function markLive(how, { quiet = false } = {}) {
    if (knownLive) return knownLive;
    if (!quiet && connected) {
      try { if (!(await store.get(LIVE))) await liveRecord({ scan: true }); } catch (e) {
        log("Barnwright's look back before going live failed:", e?.name || "Error");
      }
    }
    let changed = false, wasSettingUp = false;
    const rec = await store.change(LIVE, (doc) => {
      changed = false;
      if (doc?.live) return KEEP;
      changed = true;
      wasSettingUp = doc?.live === false;
      return { live: true, liveAt: wasSettingUp && !quiet ? iso() : null, how };
    });
    if (rec?.live) knownLive = rec;
    if (changed) await endVisits();
    if (changed && wasSettingUp && !quiet && connected) {
      await note(how === "opened" ? "Barnwright's setup access ended when you opened your 3D designer to customers."
        : "Barnwright's setup access ended when your first quote was saved.");
    }
    return rec;
  }

  /* Access ended (the owner's switch off, Stop, going live): every visit
     ends now, so none comes back when access opens again. Each is marked
     ended (kept until its own end, so its next request can still say why). */
  async function endVisits() {
    try {
      await store.change(SESSIONS, (doc) => {
        const open = Object.entries(doc || {}).filter(([, v]) => v && !v.ended);
        if (!open.length) return KEEP;
        const d = { ...doc };
        for (const [k, v] of open) d[k] = { ...v, ended: true };
        return d;
      });
    } catch (e) {
      log("Barnwright's visits couldn't be ended:", e?.name || "Error");
    }
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

  /* The owner's sign-up agreement (docs/OFFICE.md, "Before the owner first
     signs in"): the pass's when it counts, otherwise the one remembered,
     checked by the same rule each time. -> {present, counts, why, fromPass}. */
  async function signupAgreement(passSignup) {
    const rule = (s) => signupCounts(s, { ships: terms.version, ownCopies: copies });
    const remembered = await store.get(SIGNUP_RECORD);
    const pass = passSignup ? rule(passSignup) : null;
    if (pass?.counts) return { present: true, counts: true, why: null, fromPass: true };
    const kept = remembered ? rule(remembered) : null;
    if (kept?.counts) return { present: true, counts: true, why: null, fromPass: false };
    if (pass) return { present: true, counts: false, why: pass.why, fromPass: false };
    if (kept) return { present: true, counts: false, why: kept.why, fromPass: false };
    return { present: false, counts: false, why: null, fromPass: false };
  }

  /* An owner has signed in: the first owner's claim exists (or, for a
     business older than the claim, the owner has agreed to terms here). */
  async function ownerSignedIn() {
    if (await store.get(OWNER_CLAIM)) return true;
    return !!(await store.get(TERMS_RECORD))?.current;
  }

  /* Where access stands. null when not connected. scan as liveRecord;
     without it and with no live record yet, nothing is said to be open.
     signup: the sign-up agreement the pass carries, if any. The order is
     the contract's (docs/OFFICE.md, When Barnwright may change things). */
  async function view({ scan = true, pl, signup = null } = {}) {
    if (!connected) return null;
    const record = pl !== undefined ? pl : await priceList.current();
    const rec = (await store.get(SETUP)) || {};
    const ok = await termsOk();
    const ownerIn = await ownerSignedIn();
    const sign = ownerIn ? { present: false, counts: false, why: null, fromPass: false } : await signupAgreement(signup);
    const agreement = ownerIn ? (ok ? "owner" : null) : sign.counts ? "signup" : null;
    const prelive = rec.prelive === "stopped" ? "stopped" : "on";
    const liveRec = record ? await liveRecord({ scan, pl: record }) : null;
    const live = !!liveRec?.live || (!!record && record.data.settings.status !== "suspended");
    let mode = null, why = null;
    if (!record && (ownerIn || !sign.present)) why = "no-price-list";
    else if (!agreement) why = ownerIn ? "terms" : sign.why || "terms";
    else if (switchOn(rec)) mode = "switch";
    else if (live) why = "live-off";
    else if (record && !liveRec) why = "unknown";
    else if (prelive === "stopped") why = "stopped";
    else mode = "prelive";
    return {
      mode, until: mode === "switch" ? rec.expiresAt : null, why: mode ? null : why,
      live, liveAt: liveRec?.live ? liveRec.liveAt || null : null, prelive, termsOk: ok, termsOut: termsOutHere, agreement,
      record, switchRecord: rec, ownerIn, signupFromPass: sign.fromPass,
    };
  }
  const access = (signup = null) => view({ scan: true, signup });

  /* The first pass whose sign-up agreement counts writes it, once (create-only). */
  async function rememberSignup(v, claims) {
    if (!v?.signupFromPass || !claims?.signup) return;
    const s = claims.signup;
    try {
      await store.create(SIGNUP_RECORD, { termsVersion: s.termsVersion, termsSha256: s.termsSha256, signature: s.signature, signedAt: s.signedAt, at: iso(), passId: claims.id });
    } catch (e) {
      log("The owner's sign-up agreement couldn't be remembered:", e?.name || "Error");
    }
  }

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

  /* The status fields every door answer carries. signup: the pass's. */
  async function status(v = null, { signup = null } = {}) {
    v ||= await access(signup);
    if (!v) return null;
    const data = v.record?.data || null;
    return {
      v: STATUS_V, live: v.live, liveAt: v.liveAt, access: v.mode || "closed", why: v.mode ? null : v.why, until: v.until,
      prelive: v.prelive, termsOk: v.termsOk, termsOut: v.termsOut, agreement: v.agreement,
      priceList: data ? { version: data.version, savedAt: data.savedAt, by: await byWords(data.savedBy), open: data.settings.status !== "suspended" } : null,
      lastBarnwrightSave: await lastBarnwrightSave(data),
      /* the starting price list Barnwright made (version 1) has nothing before it */
      canUndo: data?.savedBy?.id === "barnwright" && data.version > 1,
      appVersion,
    };
  }

  /* For the check-in: stored records only, at most 500 ms; null when it
     fails, runs over, or the live record isn't written yet. */
  async function report() {
    if (!connected) return null;
    const work = (async () => {
      /* a price list with no live record yet is a business set up before
         this shipped: only the look back can say (never here). With no
         price list there is nothing to look back through. */
      const pl = await priceList.current();
      if (pl && !(await store.get(LIVE))) return null;
      const v = await view({ scan: false, pl });
      if (!v || v.why === "unknown") return null;
      return {
        v: STATUS_V, live: v.live, liveAt: v.liveAt, access: v.mode || "closed", why: v.mode ? null : v.why, until: v.until,
        prelive: v.prelive, termsOk: v.termsOk, termsOut: v.termsOut, agreement: v.agreement,
      };
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
    return { mode: v.mode, until: v.until, why: v.why === "unknown" ? null : v.why, live: v.live, liveAt: v.liveAt, prelive: v.prelive, termsOk: v.termsOk, termsOut: v.termsOut };
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
      /* before live, setup access goes on: say only what stopped */
      const still = connected ? (await view({ scan: false }))?.mode : null;
      if (!still) await endVisits();
      await note(still === "prelive" ? `${who} turned off Barnwright's checks.` : `${who} turned off Barnwright's access.`);
    } else if (data?.prelive === "stopped" || data?.prelive === "on") {
      if (!connected) fail(404, WHY["not-connected"]);
      const v = await view({ scan: true });
      if (v.live) fail(422, OWNER_WORDS.afterLivePrelive);
      await store.change(SETUP, (doc) => ({ enabled: false, ...(doc || {}), prelive: data.prelive }));
      if (data.prelive === "stopped" && !(await view({ scan: false }))?.mode) await endVisits();
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

  /* A refused Barnwright change, in the owner's log while access is open,
     at most once a minute. kind: "needs-alan", "locked" or "other". */
  async function refusedNote(kind) {
    if (ms() - lastRefusalNote < REFUSED_NOTE_EVERY) return;
    lastRefusalNote = ms();
    await note(REFUSED_LOG[kind] || REFUSED_LOG.other);
  }

  /* ---- the visit ---------------------------------------------------------------------------- */

  const cookieLine = (token, seconds) => `${COOKIE}=${token}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${Math.max(0, Math.floor(seconds))}`;
  const ended = () => new OfficeError(401, VISIT_WORDS.ended, { code: "visit-ended" });
  /* What a visit started under: before live, or the owner's switch turned
     on at grantedAt. A visit never outlives it: a visit from before live
     ends once the business is live, and one from a switch ends with that
     switch (a later switch is a new grant, and needs a new visit). Ending
     every visit when access ends (endVisits) does the same; this is the
     second guard. */
  const grantOf = (v) => (v.mode === "switch" ? { mode: "switch", agreement: v.agreement, grantedAt: v.switchRecord?.grantedAt || null } : { mode: "prelive", agreement: v.agreement });
  /* ...and a visit started on the owner's sign-up agreement ends once an
     owner has signed in, even after they agree: Alan opens a new one. */
  const sameGrant = (s, v) => (s.agreement === "signup" && v.agreement !== "signup" ? false
    : s.mode === "prelive" ? !v.live : s.mode === "switch" && v.mode === "switch" && !!s.grantedAt && s.grantedAt === v.switchRecord?.grantedAt);
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
    /* a visit is Alan by hand: the Control Room's own Open their price list,
       never a pass the Claude connector asked for */
    if (claims.via !== "control-room") {
      log("A Barnwright visit's pass was refused:", "via");
      throw refusal(401, "pass", VISIT_WORDS.linkRanOut);
    }
    await count();
    let v = await access(claims.signup);
    await rememberSignup(v, claims);
    if (!v.mode) throw refusal(403, "closed", whyHere(v.why), { why: v.why });
    /* Before a price list exists, the visit starts it: the starting price
       list, made exactly as a version-0 door save with no edits */
    let started = false;
    if (!v.record) {
      const start = startingFor(claims);
      try { await mustWriteToStart(); } catch (e) {
        if (e instanceof OfficeError && e.status === 423) throw refusal(423, "account-off", DOOR_WORDS.accountOff);
        throw e;
      }
      await count({ save: true });
      const made = await priceList.startForBarnwright(start, { id: "barnwright", name: `Barnwright (${claims.actor})`, passId: claims.id });
      if (!made) throw refusal(409, "version", DOOR_WORDS.version);
      await afterStart(claims.actor);
      await tellRoom({ version: 1, versionBefore: 0, changes: [START_LINE], actor: claims.actor, undo: false });
      started = true;
      v = await access(claims.signup);
      if (!v.mode) throw refusal(403, "closed", whyHere(v.why), { why: v.why });
    }
    const bytes = new Uint8Array(32);
    globalThis.crypto.getRandomValues(bytes);
    const session = b64url(bytes);
    const at = iso(), endsAt = visitEnd(v);
    await store.change(SESSIONS, (doc) => ({ ...prune(doc, ms()), [sha256Hex(session)]: { actor: claims.actor, passId: claims.id, startedAt: at, lastAt: at, endsAt, ...grantOf(v) } }));
    await note(`Barnwright (${claims.actor}) opened your price list.`);
    const name = v.record?.data.settings.brand?.name || "";
    return json({ ok: true, mode: v.mode, until: v.until, visitEndsAt: endsAt, business: { name }, ...(started ? { started: true } : {}) }, 200,
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
    const why = !v.mode ? v.why : !s.ended && sameGrant(s, v) ? null : "ended";
    if (why) {
      await store.change(SESSIONS, (doc) => (doc?.[key] ? (() => { const d = { ...doc }; delete d[key]; return d; })() : KEEP));
      if (why === "ended") throw ended();
      throw new OfficeError(401, VISIT_WORDS.closed(whyHere(why === "unknown" ? "live-off" : why)), { code: "visit-ended", why: why === "unknown" ? "live-off" : why });
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
    const lock = (old, next) => lockProblems(old, next, { manufacturer });
    let saved;
    try {
      saved = restore
        ? await priceList.restore(null, { version: data.version, current: data.current }, { lock, savedBy, ensureHistory: true, carry: (from, into) => carryLocked(from, into, { manufacturer }) })
        : await priceList.save(null, { settings: data.settings, version: data.version }, { lock, savedBy, ensureHistory: true });
    } catch (e) {
      if (e?.locked) await refusedNote("locked");
      throw e;
    }
    if (saved.changes?.length) {
      await note(changedWords(s.actor, saved.changes));
      await tellRoom({ version: saved.version, versionBefore: saved.version - 1, changes: saved.changes, actor: s.actor, undo: restore });
    }
    return saved;
  }

  /* A visit's save, told to the Control Room's service record (POST
     /api/setup-service, one line for each version there), as the door's
     saves already are. Best effort, 3 seconds at most: a Control Room that
     is down or slow changes nothing here, and the save stands. */
  async function tellRoom(report) {
    if (!connected || typeof license.forwardSetupService !== "function") return;
    try { await withinMs(license.forwardSetupService(report, { timeoutMs: 3000 }), 3000); } catch (e) {
      log("A Barnwright visit's save couldn't be told to the Control Room:", e?.name || "Error");
    }
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

  /* ---- the door ----------------------------------------------------------------------------- */

  const doorNo = (status, code, words, extra = {}) => new OfficeError(status, words, { code, ...extra });
  const answer = (status, body) => json(body, status);

  /* "Barnwright looked at your price list.", at most once every 30 minutes */
  async function lookedNote() {
    const entries = (await store.get(HELP_LOG))?.entries || [];
    if (entries.some((e) => e?.words === LOOKED && ms() - Date.parse(e.at) < LOOKED_EVERY)) return;
    await note(LOOKED);
  }

  /* A change line with the business phone, email or website in it, said
     without them: a read never carries them (the owner's own History
     screen still shows them). */
  const CONTACT_LINE = /^(Phone|Email|Website): /;
  const withoutContact = (line) => {
    const m = CONTACT_LINE.exec(String(line));
    return m ? `Changed the business ${m[1].toLowerCase()}` : line;
  };

  /* the newest 20 saves, who said by role (never by name or email) */
  async function doorHistory() {
    const names = (await store.keys("price-list-history/")).sort().reverse().slice(0, HISTORY_SHOWN);
    const out = [];
    for (const key of names) {
      const e = await store.get(key);
      if (!e) continue;
      const changes = Array.isArray(e.changes) ? e.changes : [];
      out.push({ version: e.version, savedAt: e.savedAt, by: await byWords(e.savedBy), changes: changes.slice(0, 5).map(withoutContact), more: Math.max(0, changes.length - 5) });
    }
    return out;
  }

  /* Before a price list exists (docs/OFFICE.md, "Before the owner first
     signs in"): the starting price list the pass's sign-up details make,
     at version 0. Those details are used for nothing else and kept
     nowhere. A pass that carries none can't start one. */
  function startingFor(claims) {
    if (!claims?.signup) throw refusal(403, "closed", WHY["no-price-list"], { why: "no-price-list" });
    return priceList.signupStart(claims.signup);
  }

  /* The lease, before Barnwright starts a price list. A Dealer Center the
     Control Room has just made may not have checked in yet (when the
     check-in right after its deploy didn't come, and nobody has opened it):
     then it checks in once first, so the start isn't refused for a lease
     it never asked for. Otherwise as account.mustWrite(). */
  async function mustWriteToStart() {
    try { return await account.mustWrite(); } catch (e) {
      if (!(e instanceof OfficeError && e.status === 423)) throw e;
      let never = false;
      try { never = !(await account.status())?.checkedAt; } catch { never = false; }
      if (!never) throw e;
      try { await withinMs(account.checkIn({ force: true }), 6000); } catch { /* the lease decides below */ }
      return account.mustWrite();
    }
  }

  /* After the starting price list is made (version 1): not live, checked
     through version 1, and the owner's log says how it started. */
  async function afterStart(actor) {
    await started();
    await note(startedWords(actor));
  }

  /* What a check, save or undo would store: the edits (or the price list
     from before Barnwright's last change), then the lock, then the owner's
     own check(). start: the starting price list when there is none yet
     (version 0). -> {next, changes, warnings, newCodes, edits, sha, lead}. */
  async function plan(v, data, undo, start = null) {
    const current = v.record ? v.record.data : { settings: start, version: 0 };
    const version = data.version;
    if (!Number.isSafeInteger(version)) throw doorNo(400, "bad-request", BAD_REQUEST);
    if (version !== current.version) throw doorNo(409, "version", DOOR_WORDS.version);
    /* the edits only once the version is right: a version 0 sent after a
       price list appeared is someone saving first (409), not the edits */
    if (!undo) editsOk(v, data);
    let settings, newCodes = {}, edits = 0, lead = null;
    if (undo) {
      if (data.edits !== undefined) throw doorNo(400, "bad-request", BAD_REQUEST);
      if (!v.record) throw doorNo(409, "cant-undo", DOOR_WORDS.nothingToUndo);
      if (current.savedBy?.id !== "barnwright") {
        throw doorNo(409, "cant-undo", (await lastBarnwrightSave(current)) ? DOOR_WORDS.cantUndo : DOOR_WORDS.nothingToUndo);
      }
      /* version 1 saved by Barnwright is only ever the starting price list */
      if (current.version === 1) throw doorNo(409, "cant-undo", DOOR_WORDS.nothingBeforeStart);
      const before = await store.get(historyKey(current.version - 1));
      if (!before?.settings) throw doorNo(409, "cant-undo", DOOR_WORDS.copyGone);
      settings = carryLocked(current.settings, before.settings, { manufacturer });
      lead = UNDO_LINE;
    } else if (!v.record && (data.edits === undefined || (Array.isArray(data.edits) && data.edits.length === 0))) {
      /* version 0 with no edits: the starting price list alone */
      settings = structuredClone(start);
    } else {
      const r = applyEdits(current.settings, data.edits, { manufacturer, mode: v.mode });
      if (r.problems.length) throw doorNo(422, "problems", r.problems.join(" "), { problems: r.problems });
      settings = r.settings;
      newCodes = r.newCodes;
      edits = data.edits.length;
    }
    let prepared;
    try {
      prepared = await priceList.preview(settings, version, {
        lock: (o, n) => lockProblems(o, n, { door: true, mode: v.mode, manufacturer }), lead,
        ...(v.record ? {} : { previous: { data: current } }),
      });
    } catch (e) {
      if (e instanceof OfficeError && e.status === 409) throw doorNo(409, "version", DOOR_WORDS.version);
      if (e instanceof OfficeError && e.status === 422) {
        const problems = e.problems || [e.message];
        throw Object.assign(doorNo(422, "problems", problems.join(" "), { problems }), { locked: !!e.locked });
      }
      throw e;
    }
    /* The door's change words: the owner's own History words, except that
       the business phone, email and website the owner typed are never said
       (only a new one an edit writes; for an undo, neither). */
    const changes = describeChanges(current.settings, prepared.next, manufacturer, { contact: undo ? "hidden" : "new", library });
    if (lead && changes.length) changes.unshift(lead);
    return {
      next: prepared.next, changes, warnings: warnings(current.settings, prepared.next, manufacturer),
      newCodes, edits, lead, sha: sha256Hex(JSON.stringify(prepared.next)),
      contact: ["phone", "email", "website"].some((k) => (current.settings.brand?.[k] || "") !== (prepared.next.brand?.[k] || "")),
    };
  }

  /* The edits a check or save carries: 1 to 300, or (version 0, before a
     price list exists) 0 to 300, left out meaning none. */
  function editsOk(v, data) {
    if (!v.record && data.version === 0 && data.edits === undefined) return;
    if (Array.isArray(data.edits) && data.edits.length <= MAX_EDITS && (data.edits.length >= 1 || (!v.record && data.version === 0))) return;
    throw doorNo(422, "problems", TOO_MANY_EDITS, { problems: [TOO_MANY_EDITS] });
  }

  /* One door action, once the pass is spent and counted. -> the answer's own fields. */
  async function doorAction(action, data, claims, seen) {
    const v = await access(claims.signup);
    seen.open = !!v.mode;
    await rememberSignup(v, claims);
    if (action === "status") return {};
    if (!v.mode) throw doorNo(403, "closed", whyHere(v.why === "unknown" ? "live-off" : v.why), { why: v.why === "unknown" ? "live-off" : v.why });
    /* before a price list exists, version 0 is the starting price list */
    const start = v.record ? null : startingFor(claims);
    if (action === "read") {
      const part = data.part === undefined ? "summary" : data.part;
      if (!PARTS.includes(part)) throw doorNo(400, "bad-request", BAD_REQUEST);
      /* nothing is written before there is a price list but the pass, the limits and the remembered agreement */
      if (start) return { part, view: readView(start, part, manufacturer), history: [] };
      const view = readView(v.record.data.settings, part, manufacturer);
      const history = await doorHistory();
      await lookedNote();
      return { part, view, history };
    }
    if (action === "check") {
      const undo = data.undo === true;
      if (data.undo !== undefined && !undo) throw doorNo(400, "bad-request", BAD_REQUEST);
      const p = await plan(v, data, undo, start);
      /* the undo's first line ("Put back the price list from before ...") says what this is; it isn't a change of its own */
      const counted = p.changes.length - (p.lead && p.changes[0] === p.lead ? 1 : 0);
      return {
        version: data.version, changes: p.changes.slice(0, CHANGE_LINES), moreChanges: Math.max(0, p.changes.length - CHANGE_LINES),
        warnings: p.warnings, counts: { edits: p.edits, changes: counted, warnings: p.warnings.length },
        contactDetailsChange: p.contact, newCodes: p.newCodes, settingsSha256: p.sha,
      };
    }
    /* save and undo: the lease, then (while the switch is on) Alan's own tap */
    try { await (start ? mustWriteToStart() : account.mustWrite()); } catch (e) {
      if (e instanceof OfficeError && e.status === 423) throw doorNo(423, "account-off", DOOR_WORDS.accountOff);
      throw e;
    }
    if (v.mode === "switch" && claims.via !== "control-room") throw doorNo(403, "needs-alan", DOOR_WORDS.needsAlan);
    const undo = action === "undo";
    const p = await plan(v, data, undo, start);
    if (typeof data.settingsSha256 !== "string" || data.settingsSha256 !== p.sha) throw doorNo(409, "changed", DOOR_WORDS.changed);
    const savedBy = { id: "barnwright", name: `Barnwright (${claims.actor})`, passId: claims.id };
    let from = data.version;
    if (start) {
      /* version 0: the starting price list first (version 1, create-only), then the edits (version 2) */
      const made = await priceList.startForBarnwright(start, savedBy);
      if (!made) throw doorNo(409, "version", DOOR_WORDS.version);
      await afterStart(claims.actor);
      if (!p.edits) return { versionBefore: 0, version: 1, changes: [], newCodes: p.newCodes };
      from = 1;
    }
    let saved;
    try {
      saved = await priceList.save(null, { settings: p.next, version: from }, {
        lock: (o, n) => lockProblems(o, n, { door: true, mode: v.mode, manufacturer }), lead: p.lead, savedBy, ensureHistory: true,
      });
    } catch (e) {
      if (e instanceof OfficeError && e.status === 409) throw doorNo(409, "version", DOOR_WORDS.version);
      throw e;
    }
    if (saved.changes?.length) await note(undo ? `Barnwright (${claims.actor}) put back the price list from before its last change.` : changedWords(claims.actor, saved.changes));
    return {
      versionBefore: data.version, version: saved.version, changes: (saved.changes?.length ? p.changes : []).slice(0, CHANGE_LINES),
      ...(undo ? {} : { newCodes: p.newCodes }),
    };
  }

  /* POST /.netlify/functions/barnwright-setup: the Control Room's server
     only, with a one-use setup pass. Answers the first check that fails, in
     the contract's order. */
  async function door(request) {
    if (!connected) return answer(404, { ok: false, code: "not-connected", error: WHY["not-connected"] });
    if (request.method !== "POST") return answer(405, { ok: false, code: "method", error: DOOR_WORDS.method });
    const bad = () => answer(400, { ok: false, code: "bad-request", error: BAD_REQUEST });
    const h = request.headers;
    if (h.has("origin") || h.has("cookie") || !(h.get("content-type") || "").toLowerCase().startsWith("application/json")) return bad();
    let data, raw;
    try { ({ data, raw } = await readJsonRaw(request, { maxBytes: DOOR_MAX_BYTES })); } catch (e) {
      return e?.tooBig ? answer(413, { ok: false, code: "too-big", error: DOOR_WORDS.tooBig }) : bad();
    }
    if (!DOOR_ACTIONS.includes(data.action)) return bad();
    const auth = h.get("authorization") || "";
    let claims;
    try { claims = license.verifySetupPass(auth.startsWith("Bearer ") ? auth.slice(7).trim() : "", { action: data.action, bodyBytes: raw }); } catch (e) {
      log("A Barnwright setup pass was refused:", e?.reason || "pass");
      return answer(401, { ok: false, code: "pass", error: DOOR_WORDS.pass });
    }
    /* from here every answer carries the status fields */
    const seen = { open: false };
    let body, httpStatus = 200;
    try {
      if (!(await spend(claims))) throw doorNo(410, "pass-used", DOOR_WORDS.passUsed);
      await count();
      if (data.action === "save" || data.action === "undo") await count({ save: true });
      body = { ok: true, ...(await doorAction(data.action, data, claims, seen)) };
    } catch (e) {
      if (!(e instanceof OfficeError)) {
        log("The Barnwright door failed:", e?.name || "Error");
        return answer(503, { ok: false, code: "error", error: DOOR_WORDS.error });
      }
      const code = e.extra?.code || (e.status === 422 ? "problems" : "error");
      httpStatus = code === "error" ? 503 : e.status;
      const words = code === "error" ? DOOR_WORDS.error : e.message;
      body = { ok: false, code, error: words, ...(e.extra?.why ? { why: e.extra.why } : {}), ...(e.problems || e.extra?.problems ? { problems: e.problems || e.extra.problems } : {}) };
      if (seen.open && (data.action === "save" || data.action === "undo" || e.locked) && !["too-many", "pass-used"].includes(code)) {
        await refusedNote(code === "needs-alan" ? "needs-alan" : e.locked ? "locked" : "other");
      }
    }
    let fields;
    try { fields = await status(null, { signup: claims.signup }); } catch (e) {
      log("The Barnwright door couldn't say where access stands:", e?.name || "Error");
      return answer(503, { ok: false, code: "error", error: DOOR_WORDS.error });
    }
    return answer(httpStatus, body.ok ? { ok: true, ...fields, ...body } : { ...body, ...fields });
  }

  async function lotList() {
    return { lots: (await lots.all()).map((l) => ({ slug: l.slug, name: l.name, active: l.active !== false })) };
  }

  return {
    connected, access, view, status, report, mine, liveRecord, markLive, started, termsOk, door,
    owner: { get: ownerGet, set: ownerSet },
    visit: { start, from, keep, save, end, lots: lotList, preview: (slug) => website.previewLot(slug) },
  };
}
