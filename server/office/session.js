/* STAYING SIGNED IN: the Dealer Center's own sign-in cookie.

   The password goes only to Netlify Identity, straight from the page
   (ui/office/identity.js). The page then hands Identity's refresh token to
   POST /api/office/session, and this file:
     1. swaps it at Identity at once (Identity spends the page's copy, so it
        never works again anywhere), and asks Identity whose sign-in the new
        one is (a confirmed email only, the same rule as every request);
     2. keeps the new tokens in the record sessions/<user key>/<SHA-256 of
        the cookie> -- only the cookie's hash, so the records alone can sign
        nobody in;
     3. answers with one cookie, set by the server:
          __Host-dc_signin=<user key>.<32 random bytes>; Path=/; Secure;
          HttpOnly; SameSite=Strict[; Max-Age=...]
        No page script can read it (HttpOnly), it goes only to this site's
        own address over https (__Host-, Secure, no Domain), and never with
        a request another website starts (SameSite=Strict).

   "Keep me signed in on this device for 30 days" ticked (keep: true): the
   cookie has a Max-Age, so it lasts through closing the browser -- and
   because the server sets it, Safari's 7-day limit on what a page's own
   script stores does not cut it short. Not ticked: no Max-Age, so the
   browser drops it when it closes. Either way the sign-in ends 30 days
   after it started (endsAt; it is not made longer by using it), and Sign
   out ends it at once. A kept cookie lives two days past endsAt, so on day
   31 the page can still say why it asks to sign in again.

   Every request with the cookie: the record, refused past endsAt; the
   access token, refreshed at Identity when it has under 5 minutes left
   (one request at a time: a claim written into the record, so two
   requests never spend the same refresh token, and the other one uses the
   access token still good or waits for the new one); then Identity's own
   answer to "whose token is this" (identity.js, remembered a minute), so
   nothing gets weaker than an Identity token: roles still come only from
   people/<userId> and removing somebody from the team counts at once.

   An ended sign-in keeps a short record with no tokens -- {ended: "time" |
   "password" | "everywhere" | "identity"} -- for two days, so the page says
   why. Each sign-in tidies that person's own records (ended ones, and more
   than 20 at once). Tokens and cookies are never written to a log, an
   error or an answer. */

import { fail, json, readBody, cookieOf, onlyKeys } from "./http.js";
import { KEEP } from "./store.js";
import { sha256Hex } from "./hash.js";
import { confirmed } from "./people.js";
import { signInDown, tokenOf } from "./identity.js";

export const COOKIE = "__Host-dc_signin";
const PREFIX = "sessions/";
const DAY = 86400000;
export const SIGN_IN_DAYS = 30;
const LASTS_MS = SIGN_IN_DAYS * DAY;
/* how long an ended (or run out) record stays, so the page can say why */
const GRACE_MS = 2 * DAY;
/* refresh the access token when it has less than this left */
const EARLY_MS = 5 * 60 * 1000;
/* one request's claim to refresh; longer than Identity's time limit */
const CLAIM_MS = 30 * 1000;
const MAX_LIVE = 20;
const COOKIE_RE = /^([a-f0-9]{24})\.([A-Za-z0-9_-]{43})$/;

/* What a person reads. */
export const SESSION_WORDS = {
  ranOut: "That sign-in ran out. Sign in again.",
  notConfirmed: "Confirm your email first: open the link we emailed you.",
};

const b64url = (bytes) => {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const pause = (ms) => new Promise((done) => setTimeout(done, ms));

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

export function createSessions({ store, identity, now, log = console.error }) {
  const ms = () => now().getTime();
  const iso = () => now().toISOString();
  const userKey = (userId) => sha256Hex(`dc-signin:${userId}`).slice(0, 24);
  const keyOf = (cookie) => {
    const m = COOKIE_RE.exec(cookie || "");
    return m ? `${PREFIX}${m[1]}/${sha256Hex(cookie)}` : null;
  };
  const goneAt = (r) => Date.parse(r.ended ? r.endedAt : r.endsAt) || 0;
  /* an ended record: no tokens, kept two days */
  const endedOf = (r, why) => ({ v: 1, userId: r.userId, keep: !!r.keep, startedAt: r.startedAt, endsAt: r.endsAt, ended: why, endedAt: iso() });

  async function endKey(key, why, onlyIf = null) {
    await store.change(key, (r) => (r && !r.ended && (!onlyIf || onlyIf(r)) ? endedOf(r, why) : KEEP));
  }

  /* That person's records: ended ones two days old go; with `why`, every
     live one (but `except`) ends; the oldest go past 20 at once. */
  async function tidy(userId, { except = null, why = null } = {}) {
    const keys = await store.keys(`${PREFIX}${userKey(userId)}/`);
    const live = [];
    for (const key of keys) {
      if (key === except) continue;
      const r = await store.get(key);
      if (!r) continue;
      const over = r.ended || Date.parse(r.endsAt) <= ms();
      if (over && goneAt(r) + GRACE_MS <= ms()) { await store.remove(key); continue; }
      if (over) continue;
      if (why) { await endKey(key, why); continue; }
      live.push({ key, at: Date.parse(r.startedAt) || 0 });
    }
    live.sort((a, b) => b.at - a.at);
    for (const old of live.slice(MAX_LIVE - 1)) await endKey(old.key, "identity");
  }

  /* POST /api/office/session {refreshToken, keep, why?}: the page's fresh
     sign-in becomes the cookie. why "reset" (a new password) ends that
     person's sign-in on every other device. */
  async function start(request) {
    const data = await readBody(request);
    onlyKeys(data, ["refreshToken", "keep", "why"]);
    if (typeof data.refreshToken !== "string" || !/^[A-Za-z0-9._~+/=-]{8,512}$/.test(data.refreshToken)) fail(422, SESSION_WORDS.ranOut);
    if (data.keep !== undefined && typeof data.keep !== "boolean") fail(422, "Something went wrong. Reload the page and try again.");
    const keep = data.keep === true;
    const origin = new URL(request.url).origin;
    const fresh = await identity.refresh(origin, data.refreshToken);
    if (!fresh) fail(401, SESSION_WORDS.ranOut);
    const user = await identity.user(origin, fresh.accessToken);
    if (!user) fail(401, SESSION_WORDS.ranOut);
    if (!confirmed(user)) fail(401, SESSION_WORDS.notConfirmed);

    const bytes = new Uint8Array(32);
    globalThis.crypto.getRandomValues(bytes);
    const cookie = `${userKey(user.id)}.${b64url(bytes)}`;
    const key = keyOf(cookie);
    const startedAt = iso();
    const endsAt = new Date(ms() + LASTS_MS).toISOString();
    if (!(await store.create(key, {
      v: 1, userId: user.id, keep, startedAt, endsAt,
      accessToken: fresh.accessToken, accessExp: ms() + fresh.expiresIn * 1000, refreshToken: fresh.refreshToken, refreshedAt: startedAt,
    }))) fail(503, "Something went wrong on our end. Try again in a minute.");
    try { await tidy(user.id, { except: key, why: data.why === "reset" ? "password" : null }); } catch (error) {
      log("Signing in couldn't tidy older sign-ins:", error?.name || "Error");
    }
    return withCookies(json({ ok: true, keep, endsAt }, 201), [cookieLine(cookie, keep ? (LASTS_MS + GRACE_MS) / 1000 : null), ...OLD_COOKIES]);
  }

  /* An access token for the record that is good for a few more minutes:
     refreshed at Identity when needed, one request at a time. -> the
     token, or null when the sign-in ended; a 503 when Identity can't be
     asked and the old token has run out. force: refresh even if it looks
     good (Identity just said no to it). */
  async function accessFor(origin, key, found, { force = false } = {}) {
    const first = found.data.refreshToken;
    let cur = found;
    for (let round = 0; round < 3; round++) {
      const rec = cur?.data;
      if (!rec || rec.ended) return null;
      /* another request refreshed it meanwhile */
      if (rec.refreshToken !== first) return rec.accessToken;
      const left = rec.accessExp - ms();
      if (!force && left > EARLY_MS) return rec.accessToken;
      const claimedByOther = rec.refreshing && ms() - Date.parse(rec.refreshing.at) < CLAIM_MS;
      if (!claimedByOther) {
        const id = b64url(globalThis.crypto.getRandomValues(new Uint8Array(12)));
        if (await store.replace(key, cur, { ...rec, refreshing: { at: iso(), id } })) return refreshWith(origin, key, rec, id, force);
      } else {
        /* another request is refreshing: the token it holds may still do,
           or wait (4 seconds at most, Identity's own time limit) for the new
           one; if that request gave up, Identity can't be asked now */
        if (!force && left > 5000) return rec.accessToken;
        for (let i = 0; i < 16; i++) {
          await pause(250);
          const again = await store.read(key);
          cur = again;
          if (!again?.data || again.data.ended || again.data.refreshToken !== first) break;
          if (!again.data.refreshing) return signInDown();
        }
        continue;
      }
      cur = await store.read(key);
    }
    return signInDown();
  }

  /* This request holds the claim (id): swap the refresh token at Identity. */
  async function refreshWith(origin, key, rec, id, force) {
    let fresh;
    try {
      fresh = await identity.refresh(origin, rec.refreshToken);
    } catch (error) {
      await store.change(key, (r) => (r?.refreshing?.id === id ? { ...r, refreshing: null } : KEEP));
      if (!force && rec.accessExp - ms() > 5000) return rec.accessToken;
      throw error;
    }
    if (!fresh) {
      /* spent, signed out of Identity, or too old: the sign-in is over
         (unless it was refreshed meanwhile after all) */
      await endKey(key, "identity", (r) => r.refreshToken === rec.refreshToken);
      const now2 = (await store.read(key))?.data;
      return now2 && !now2.ended && now2.refreshToken !== rec.refreshToken ? now2.accessToken : null;
    }
    /* this request now holds the only good refresh token: keep it, unless
       the sign-in ended meanwhile (Sign out) */
    await store.change(key, (r) => (r && !r.ended && r.refreshToken === rec.refreshToken
      ? { ...r, accessToken: fresh.accessToken, accessExp: ms() + fresh.expiresIn * 1000, refreshToken: fresh.refreshToken, refreshing: null, refreshedAt: iso() }
      : KEEP));
    return fresh.accessToken;
  }

  /* -> null when the request has no cookie; {ended, keep} when its sign-in
     ended (or was never there); {user, session: {keep, endsAt}} when it is
     good -- user as identity.js answers it. A 503 when Identity can't be
     asked. */
  async function from(request) {
    const cookie = cookieOf(request, COOKIE);
    if (!cookie) return null;
    const key = keyOf(cookie);
    const found = key ? await store.read(key) : null;
    if (!found?.data) return { ended: "gone", keep: false };
    const rec = found.data;
    if (rec.ended) return { ended: rec.ended, keep: !!rec.keep };
    if (Date.parse(rec.endsAt) <= ms()) {
      await endKey(key, "time");
      return { ended: "time", keep: !!rec.keep };
    }
    const origin = new URL(request.url).origin;
    let access = await accessFor(origin, key, found);
    let user = access ? await identity.user(origin, access) : null;
    if (access && !user) {
      /* Identity said no to a token we thought good: refresh once and ask again */
      const again = await store.read(key);
      access = again?.data && !again.data.ended ? await accessFor(origin, key, again, { force: true }) : null;
      user = access ? await identity.user(origin, access) : null;
    }
    if (!user || user.id !== rec.userId) {
      await endKey(key, "identity");
      return { ended: "identity", keep: !!rec.keep };
    }
    return { user, session: { keep: !!rec.keep, endsAt: rec.endsAt }, key, access };
  }

  /* POST /api/office/sign-out: this device's sign-in ends at once (its
     record goes, and so does the cookie). {everywhere: true} also ends the
     person's sign-in on every other device and at Identity. Never calls
     Identity for a plain Sign out, so the iPad stays signed in when the
     computer signs out. Always answers 200 with the cookies cleared. */
  async function end(request) {
    let data = {};
    try { data = await readBody(request); } catch { data = {}; }
    const everywhere = data?.everywhere === true;
    const cookie = cookieOf(request, COOKIE);
    const key = keyOf(cookie);
    const clear = [cookieLine("", 0), ...OLD_COOKIES];
    if (everywhere) {
      const origin = new URL(request.url).origin;
      let user = null, access = null;
      try {
        const s = key ? await from(request) : null;
        if (s?.user) ({ user, access } = s);
        else if (tokenOf(request)) {
          access = tokenOf(request);
          user = await identity.user(origin, access);
        }
      } catch (error) {
        log("Signing out everywhere couldn't ask Identity:", error?.name || "Error");
      }
      if (user && access) await identity.logout(origin, access);
      if (user) await tidy(user.id, { why: "everywhere" });
    }
    if (key) await store.remove(key);
    return withCookies(json({ ok: true, everywhere: everywhere || undefined }), clear);
  }

  return { start, from, end, tidy, keyOf, userKey };
}
