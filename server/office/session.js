/* STAYING SIGNED IN: the Dealer Center's own sign-in cookie.

   The password goes only to Netlify Identity, straight from the page
   (ui/office/identity.js). The page then hands Identity's refresh token to
   POST /api/office/session, and this file:
     1. swaps it at Identity at once (Identity spends the page's copy, so it
        never works again anywhere), and asks Identity whose sign-in the new
        one is (a confirmed email only, the same rule as every request) --
        and whether that login is on the team (its own person record, an
        invite, or the first-owner claim): a login that isn't gets 403 and
        no cookie and no record, so a stranger's login can't fill the store;
     2. keeps the new tokens in the record sessions/<user key>/<SHA-256 of
        the cookie>, SEALED with a key only the cookie holds (AES-256-GCM,
        the key made from the cookie's 32 random bytes with HKDF-SHA256,
        "dc-signin tokens v1"). The record's name is only the cookie's hash
        and the tokens can only be opened with the cookie, so whoever can
        read the store can't sign anybody in with what is in it;
     3. answers with one cookie, set by the server:
          __Host-dc_signin=<user key>.<32 random bytes>; Path=/; Secure;
          HttpOnly; SameSite=Strict[; Max-Age=...]
        No page script can read it (HttpOnly), it goes only to this site's
        own address over https (__Host-, Secure, no Domain), and never with
        a request another website starts (SameSite=Strict).

   "Keep me signed in on this device for 30 days" ticked (keep: true): the
   cookie has a Max-Age, so it lasts through closing the browser -- and
   because the server sets it, Safari's 7-day limit on what a page's own
   script stores does not cut it short. It ends 30 days after it started
   (endsAt; using it doesn't make it longer). A kept cookie lives two days
   past endsAt, so on day 31 the page can still say why it asks to sign in
   again. Not ticked: no Max-Age, so the browser drops it when it closes --
   and because browsers often keep it anyway (Edge and Chrome bring it back
   with "continue where you left off", the iPad rarely closes Safari), the
   server ends it after 12 hours without use too. Sign out ends either at
   once.

   Every request with the cookie: the record, refused past endsAt (or 12
   hours unused when not kept); the access token, refreshed at Identity
   when it has under 5 minutes left (one request at a time: a claim written
   into the record, so two requests never spend the same refresh token; a
   turn number says it was refreshed meanwhile, and the other request uses
   the access token still good or waits for the new one); then Identity's
   own answer to "whose token is this" (identity.js, remembered a minute),
   so nothing gets weaker than an Identity token: roles still come only
   from people/<userId> and removing somebody from the team counts at once.
   The last use is written at most every 5 minutes.

   An ended sign-in keeps a short record with no tokens -- {ended: "time" |
   "idle" | "password" | "everywhere" | "identity" | "many"} -- for two
   days, so the page says why. Each sign-in tidies that person's own records:
   ended ones go after two days; at most 20 live at once (past that, the
   ones not kept end first, the least recently used first, so a kept iPad
   never makes way for leftovers from a lot computer); at most 20 ended.
   sweep() (the check-in every six hours) ends what ran out and removes
   what is two days past, for everybody, so nothing waits for that person's
   next sign-in. Tokens and cookies are never written to a log, an error or
   an answer. */

import { fail, json, readBody, cookieOf, onlyKeys } from "./http.js";
import { KEEP } from "./store.js";
import { sha256Hex } from "./hash.js";
import { confirmed } from "./people.js";
import { signInDown, tokenOf } from "./identity.js";

export const COOKIE = "__Host-dc_signin";
const PREFIX = "sessions/";
const HOUR = 3600000;
const DAY = 24 * HOUR;
export const SIGN_IN_DAYS = 30;
const LASTS_MS = SIGN_IN_DAYS * DAY;
/* a sign-in that isn't kept ends after this long without use */
export const IDLE_HOURS = 12;
const IDLE_MS = IDLE_HOURS * HOUR;
/* the last use is written at most this often */
const USED_EVERY_MS = 5 * 60 * 1000;
/* how long an ended (or run out) record stays, so the page can say why */
const GRACE_MS = 2 * DAY;
/* refresh the access token when it has less than this left */
const EARLY_MS = 5 * 60 * 1000;
/* one request's claim to refresh; longer than Identity's time limit */
const CLAIM_MS = 30 * 1000;
const MAX_LIVE = 20;
const MAX_ENDED = 20;
const COOKIE_RE = /^([a-f0-9]{24})\.([A-Za-z0-9_-]{43})$/;
const SEAL_INFO = "dc-signin tokens v1";

/* What a person reads. */
export const SESSION_WORDS = {
  ranOut: "That sign-in ran out. Sign in again.",
  notConfirmed: "Confirm your email first: open the link we emailed you.",
  notOnTeam: (email) => `You're not on the team here yet. Ask the owner to add ${email} to the team, then sign in again.`,
};

const enc = new TextEncoder();
const b64url = (bytes) => {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const fromB64url = (text) => {
  const s = String(text).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(s + "=".repeat((4 - (s.length % 4)) % 4));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};
const pause = (ms) => new Promise((done) => setTimeout(done, ms));

/* ---- sealing the tokens with the cookie ---------------------------------------- */

/* The key, made from the cookie's 32 random bytes (only the browser has them). */
async function sealKey(secret) {
  const subtle = globalThis.crypto.subtle;
  const ikm = await subtle.importKey("raw", fromB64url(secret), "HKDF", false, ["deriveKey"]);
  return subtle.deriveKey({ name: "HKDF", hash: "SHA-256", salt: new Uint8Array(0), info: enc.encode(SEAL_INFO) },
    ikm, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

/* The cookie, taken apart: the record's name, and its key (made once). */
function handleOf(cookie) {
  const m = COOKIE_RE.exec(cookie || "");
  if (!m) return null;
  let made = null;
  return { key: `${PREFIX}${m[1]}/${sha256Hex(cookie)}`, sealKey: () => (made ||= sealKey(m[2])) };
}

/* {accessToken, refreshToken} -> base64url(iv || AES-256-GCM), bound to the record's name */
async function seal(h, tokens) {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const plain = enc.encode(JSON.stringify({ a: tokens.accessToken, r: tokens.refreshToken }));
  const sealed = new Uint8Array(await globalThis.crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: enc.encode(h.key) }, await h.sealKey(), plain));
  const out = new Uint8Array(iv.length + sealed.length);
  out.set(iv);
  out.set(sealed, iv.length);
  return b64url(out);
}

/* the record's tokens, opened with the cookie -> {accessToken, refreshToken}, or null */
async function unseal(h, rec) {
  if (typeof rec?.sealed !== "string") return null;
  try {
    const all = fromB64url(rec.sealed);
    const plain = await globalThis.crypto.subtle.decrypt({ name: "AES-GCM", iv: all.slice(0, 12), additionalData: enc.encode(h.key) }, await h.sealKey(), all.slice(12));
    const t = JSON.parse(new TextDecoder().decode(plain));
    return typeof t?.a === "string" && typeof t?.r === "string" ? { accessToken: t.a, refreshToken: t.r } : null;
  } catch {
    return null;
  }
}

/* the cookie, set or cleared (seconds null: until the browser closes) */
export function cookieLine(value, seconds) {
  const age = seconds == null ? "" : `; Max-Age=${Math.max(0, Math.floor(seconds))}`;
  return `${COOKIE}=${value}; Path=/; Secure; HttpOnly; SameSite=Strict${age}`;
}
/* Netlify Identity's own cookies from before: gone, even one a page can't
   reach (HttpOnly), so nothing left over can get in the way. */
const OLD_COOKIES = ["nf_jwt", "nf_refresh"].map((name) => `${name}=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0`);

function withCookies(response, lines) {
  for (const line of lines) response.headers.append("Set-Cookie", line);
  return response;
}

/* Only a token in the Authorization header (a reset link's), not nf_jwt. */
function bearerOf(request) {
  const m = /^Bearer\s+([A-Za-z0-9._-]{20,4096})$/.exec((request.headers.get("authorization") || "").trim());
  return m ? m[1] : null;
}

/* canJoin: optional async (user) -> would this login be on the team
   (people.js couldJoin). Left out, every confirmed login gets a cookie. */
export function createSessions({ store, identity, now, log = console.error, canJoin = null }) {
  const ms = () => now().getTime();
  const iso = () => now().toISOString();
  const userKey = (userId) => sha256Hex(`dc-signin:${userId}`).slice(0, 24);
  const keyOf = (cookie) => handleOf(cookie)?.key || null;
  const goneAt = (r) => Date.parse(r.ended ? r.endedAt : r.endsAt) || 0;
  const lastUse = (r) => Math.max(Date.parse(r.lastUsedAt || 0) || 0, Date.parse(r.startedAt) || 0);
  /* a live record that ran out: "time" (30 days), "idle" (not kept, 12 hours unused), or null */
  const overOf = (r) => (Date.parse(r.endsAt) <= ms() ? "time" : !r.keep && ms() - lastUse(r) >= IDLE_MS ? "idle" : null);
  const turnOf = (r) => r?.turn || 0;
  /* an ended record: no tokens, kept two days */
  const endedOf = (r, why) => ({ v: 2, userId: r.userId, keep: !!r.keep, startedAt: r.startedAt, endsAt: r.endsAt, ended: why, endedAt: iso() });

  async function endKey(key, why, onlyIf = null) {
    await store.change(key, (r) => (r && !r.ended && (!onlyIf || onlyIf(r)) ? endedOf(r, why) : KEEP));
  }

  /* That person's records: what ran out ends, and goes two days later;
     with `why`, every live one (but `except`) ends; past 20 live at once,
     the ones not kept end first, then the least recently used; at most 20
     ended ones are kept. */
  async function tidy(userId, { except = null, why = null } = {}) {
    const keys = await store.keys(`${PREFIX}${userKey(userId)}/`);
    const live = [];
    const ended = [];
    for (const key of keys) {
      if (key === except) continue;
      const r = await store.get(key);
      if (!r) continue;
      if (!r.ended) {
        const over = overOf(r);
        if (over === "time" && Date.parse(r.endsAt) + GRACE_MS <= ms()) { await store.remove(key); continue; }
        if (over || why) { await endKey(key, over || why); ended.push({ key, at: ms() }); continue; }
        live.push({ key, keep: r.keep ? 1 : 0, used: lastUse(r), at: Date.parse(r.startedAt) || 0 });
        continue;
      }
      if (goneAt(r) + GRACE_MS <= ms()) { await store.remove(key); continue; }
      ended.push({ key, at: goneAt(r) });
    }
    /* the ones that stay first: kept, then the most recently used, then the newest */
    live.sort((a, b) => b.keep - a.keep || b.used - a.used || b.at - a.at);
    for (const old of live.slice(MAX_LIVE - 1)) { await endKey(old.key, "many"); ended.push({ key: old.key, at: ms() }); }
    ended.sort((a, b) => b.at - a.at);
    for (const old of ended.slice(MAX_ENDED)) await store.remove(old.key);
  }

  /* Everybody's records (the check-in every six hours): what ran out ends
     (its tokens go), and what is two days past goes. Stops after budgetMs
     (the next check-in carries on). -> {ended, removed} */
  async function sweep({ budgetMs = 8000 } = {}) {
    const stop = Date.now() + budgetMs;
    let ended = 0, removed = 0;
    for (const key of await store.keys(PREFIX)) {
      if (Date.now() > stop) break;
      const r = await store.get(key);
      if (!r) continue;
      if (r.ended) {
        if (goneAt(r) + GRACE_MS <= ms()) { await store.remove(key); removed++; }
        continue;
      }
      const over = overOf(r);
      if (!over) continue;
      if (Date.parse(r.endsAt) + GRACE_MS <= ms()) { await store.remove(key); removed++; } else { await endKey(key, over); ended++; }
    }
    return { ended, removed };
  }

  /* POST /api/office/session {refreshToken, keep, why?}: the page's fresh
     sign-in becomes the cookie. why "reset" (a new password, from a page
     that was open before the reset signed out every device itself) ends
     that person's sign-in on every other device -- and if that can't be
     done, nothing is signed in (503, the page tries again). */
  async function start(request) {
    const data = await readBody(request);
    onlyKeys(data, ["refreshToken", "keep", "why"]);
    if (typeof data.refreshToken !== "string" || !/^[A-Za-z0-9._~+/=-]{8,512}$/.test(data.refreshToken)) fail(422, SESSION_WORDS.ranOut);
    if (data.keep !== undefined && typeof data.keep !== "boolean") fail(422, "Something went wrong. Reload the page and try again.");
    const keep = data.keep === true;
    const reset = data.why === "reset";
    const origin = new URL(request.url).origin;
    const fresh = await identity.refresh(origin, data.refreshToken);
    if (!fresh) fail(401, SESSION_WORDS.ranOut);
    const user = await identity.user(origin, fresh.accessToken);
    if (!user) fail(401, SESSION_WORDS.ranOut);
    if (!confirmed(user)) fail(401, SESSION_WORDS.notConfirmed);
    const email = user.email.trim().toLowerCase();
    if (canJoin && !(await canJoin(user))) fail(403, SESSION_WORDS.notOnTeam(email), { code: "not-on-team", email });

    const bytes = new Uint8Array(32);
    globalThis.crypto.getRandomValues(bytes);
    const cookie = `${userKey(user.id)}.${b64url(bytes)}`;
    const h = handleOf(cookie);
    const startedAt = iso();
    const endsAt = new Date(ms() + LASTS_MS).toISOString();
    if (!(await store.create(h.key, {
      v: 2, userId: user.id, keep, startedAt, endsAt, lastUsedAt: startedAt,
      sealed: await seal(h, fresh), accessExp: ms() + fresh.expiresIn * 1000, turn: 0, refreshedAt: startedAt,
    }))) fail(503, "Something went wrong on our end. Try again in a minute.");
    try { await tidy(user.id, { except: h.key, why: reset ? "password" : null }); } catch (error) {
      log("Signing in couldn't tidy older sign-ins:", error?.name || "Error");
      if (reset) {
        try { await store.remove(h.key); } catch { /* it can't be opened without the cookie, which never left */ }
        fail(503, "Something went wrong on our end. Try again in a minute.");
      }
    }
    return withCookies(json({ ok: true, keep, endsAt }, 201), [cookieLine(cookie, keep ? (LASTS_MS + GRACE_MS) / 1000 : null), ...OLD_COOKIES]);
  }

  /* An access token for the record that is good for a few more minutes:
     refreshed at Identity when needed, one request at a time. -> the
     token, or null when the sign-in ended (or its tokens can't be opened);
     a 503 when Identity can't be asked and the old token has run out.
     force: refresh even if it looks good (Identity just said no to it). */
  async function accessFor(origin, h, found, { force = false } = {}) {
    const first = turnOf(found.data);
    let cur = found;
    for (let round = 0; round < 3; round++) {
      const rec = cur?.data;
      if (!rec || rec.ended) return null;
      /* another request refreshed it meanwhile */
      if (turnOf(rec) !== first) return (await unseal(h, rec))?.accessToken || null;
      const left = rec.accessExp - ms();
      if (!force && left > EARLY_MS) return (await unseal(h, rec))?.accessToken || null;
      const claimedByOther = rec.refreshing && ms() - Date.parse(rec.refreshing.at) < CLAIM_MS;
      if (!claimedByOther) {
        const id = b64url(globalThis.crypto.getRandomValues(new Uint8Array(12)));
        if (await store.replace(h.key, cur, { ...rec, refreshing: { at: iso(), id } })) return refreshWith(origin, h, rec, id, force);
      } else {
        /* another request is refreshing: the token it holds may still do,
           or wait (4 seconds at most, Identity's own time limit) for the new
           one; if that request gave up, Identity can't be asked now */
        if (!force && left > 5000) return (await unseal(h, rec))?.accessToken || null;
        for (let i = 0; i < 16; i++) {
          await pause(250);
          const again = await store.read(h.key);
          cur = again;
          if (!again?.data || again.data.ended || turnOf(again.data) !== first) break;
          if (!again.data.refreshing) return signInDown();
        }
        continue;
      }
      cur = await store.read(h.key);
    }
    return signInDown();
  }

  /* This request holds the claim (id): swap the refresh token at Identity. */
  async function refreshWith(origin, h, rec, id, force) {
    const release = () => store.change(h.key, (r) => (r?.refreshing?.id === id ? { ...r, refreshing: null } : KEEP));
    const tokens = await unseal(h, rec);
    if (!tokens) { await release(); return null; }
    let fresh;
    try {
      fresh = await identity.refresh(origin, tokens.refreshToken);
    } catch (error) {
      await release();
      if (!force && rec.accessExp - ms() > 5000) return tokens.accessToken;
      throw error;
    }
    if (!fresh) {
      /* spent, signed out of Identity, or too old: the sign-in is over
         (unless it was refreshed meanwhile after all) */
      await endKey(h.key, "identity", (r) => turnOf(r) === turnOf(rec));
      const now2 = (await store.read(h.key))?.data;
      return now2 && !now2.ended && turnOf(now2) !== turnOf(rec) ? (await unseal(h, now2))?.accessToken || null : null;
    }
    /* this request now holds the only good refresh token: keep it, sealed,
       unless the sign-in ended meanwhile (Sign out) */
    const sealed = await seal(h, fresh);
    await store.change(h.key, (r) => (r && !r.ended && turnOf(r) === turnOf(rec)
      ? { ...r, sealed, accessExp: ms() + fresh.expiresIn * 1000, turn: turnOf(r) + 1, refreshing: null, refreshedAt: iso() }
      : KEEP));
    return fresh.accessToken;
  }

  /* The last use, at most every 5 minutes; a failure never stops the request. */
  async function used(key, rec) {
    if (ms() - (Date.parse(rec.lastUsedAt || 0) || 0) < USED_EVERY_MS) return;
    try {
      await store.change(key, (r) => (r && !r.ended ? { ...r, lastUsedAt: iso() } : KEEP));
    } catch (error) {
      log("Couldn't note when a sign-in was last used:", error?.name || "Error");
    }
  }

  /* -> null when the request has no cookie; {ended, keep} when its sign-in
     ended (or was never there); {user, session: {keep, endsAt, left}} when
     it is good -- user as identity.js answers it. A 503 when Identity can't
     be asked. */
  async function from(request) {
    const cookie = cookieOf(request, COOKIE);
    if (!cookie) return null;
    const h = handleOf(cookie);
    const found = h ? await store.read(h.key) : null;
    if (!found?.data) return { ended: "gone", keep: false };
    const rec = found.data;
    if (rec.ended) return { ended: rec.ended, keep: !!rec.keep };
    const over = overOf(rec);
    if (over) {
      await endKey(h.key, over);
      return { ended: over, keep: !!rec.keep };
    }
    const origin = new URL(request.url).origin;
    let access = await accessFor(origin, h, found);
    let user = access ? await identity.user(origin, access) : null;
    if (access && !user) {
      /* Identity said no to a token we thought good: refresh once and ask again */
      const again = await store.read(h.key);
      access = again?.data && !again.data.ended ? await accessFor(origin, h, again, { force: true }) : null;
      user = access ? await identity.user(origin, access) : null;
    }
    if (!user || user.id !== rec.userId) {
      await endKey(h.key, "identity");
      return { ended: "identity", keep: !!rec.keep };
    }
    await used(h.key, rec);
    /* left: how long until endsAt by the server's clock, so the page can say when even if its own clock is off */
    return { user, session: { keep: !!rec.keep, endsAt: rec.endsAt, left: Date.parse(rec.endsAt) - ms() }, key: h.key, access };
  }

  /* POST /api/office/sign-out: this device's sign-in ends at once (its
     record goes, and so does the cookie). Never calls Identity for a plain
     Sign out, so the iPad stays signed in when the computer signs out.

     {everywhere: true} ends the person's sign-in on every device. The
     person is the one whose token the request carries in its Authorization
     header (a reset link's: then {why: "password"} says so on the other
     devices), else the one this device's own record names -- so it never
     needs Identity to find them -- else a sign-in from before the cookie
     (nf_jwt). Every Dealer Center sign-in of theirs ends first (the records
     hold the only copies of those refresh tokens), then Identity is asked
     to drop every refresh token of theirs (Identity's logout) with this
     sign-in's token. Answers {ok, everywhere: true, identity: true | false}
     (false: the Dealer Center sign-ins ended, Identity didn't answer);
     a 503, with this device still signed in, when the records couldn't be
     changed or Identity was needed to find the person and can't be asked. */
  async function end(request) {
    let data = {};
    try { data = await readBody(request); } catch { data = {}; }
    const everywhere = data?.everywhere === true;
    const h = handleOf(cookieOf(request, COOKIE));
    const clear = [cookieLine("", 0), ...OLD_COOKIES];
    let answer = { ok: true };
    if (everywhere) {
      const origin = new URL(request.url).origin;
      const found = h ? await store.read(h.key) : null;
      const bearer = bearerOf(request);
      let userId = null, access = null;
      if (bearer) {
        const user = await identity.user(origin, bearer);
        if (!user) fail(401, "Please sign in.");
        userId = user.id;
        access = bearer;
      } else if (found?.data?.userId) {
        userId = found.data.userId;
      } else if (tokenOf(request)) {
        access = tokenOf(request);
        userId = (await identity.user(origin, access))?.id || null;
      }
      if (userId) {
        await tidy(userId, { except: h?.key || null, why: data.why === "password" ? "password" : "everywhere" });
        if (!access && found?.data && !found.data.ended && found.data.userId === userId) {
          try { access = await accessFor(origin, h, found); } catch { access = null; }
        }
        const out = access ? await identity.logout(origin, access) : false;
        if (!out) log("Signing out everywhere: every Dealer Center sign-in ended, but the sign-in didn't answer");
        answer = { ok: true, everywhere: true, identity: out };
      }
    }
    if (h) await store.remove(h.key);
    return withCookies(json(answer), clear);
  }

  return { start, from, end, tidy, sweep, keyOf, userKey };
}
