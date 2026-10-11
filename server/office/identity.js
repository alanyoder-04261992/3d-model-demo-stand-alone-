/* WHO IS SIGNED IN, ASKED OF NETLIFY IDENTITY DIRECTLY.

   identityClient() asks Netlify Identity (at the site's own
   /.netlify/identity) three things, each with a time limit:
     user(origin, accessToken)    whose sign-in this is: only a real,
                                  unexpired sign-in gets a 200 back
                                  (remembered for a minute per token);
     refresh(origin, refreshToken) a new access token and a new refresh
                                  token for a refresh token (Identity spends
                                  the old one: it never works twice);
     logout(origin, accessToken)  every refresh token of that person goes
                                  (their sign-in on every device).
   Identity saying no (401, a spent refresh token) is null. Identity that
   can't be asked -- too slow, down (5xx), too many requests (429), a
   garbled answer -- is never "not signed in": it is a 503 with the words
   IDENTITY_DOWN, so the page says the sign-in isn't answering instead of
   showing an empty Sign in card.

   We do not use @netlify/identity's server getUser(): on a deployed site it
   can send the site's own admin token instead of the person's and answer
   with a user that has no confirmed email.

   The Dealer Center's own sign-in cookie (session.js) holds the tokens on
   the server. netlifyIdentity() still reads a token the request carries
   itself ("Authorization: Bearer", or the nf_jwt cookie a browser kept from
   before the cookie existed), so a page open across a deploy keeps working.

   Identity can be set to "autoconfirm" (no email check). Then anybody could
   make a login with the owner's or an invited person's email, so invites
   and the first-owner claim are refused while autoconfirm is on (people
   who already have access keep it). */

import { fail } from "./http.js";

const USER_CACHE_MS = 60 * 1000;
const SETTINGS_CACHE_MS = 5 * 60 * 1000;

/* What a person reads when Identity can't be asked (any route, 503). */
export const IDENTITY_DOWN = "The sign-in isn't answering right now. Try again in a minute.";
export const signInDown = () => fail(503, IDENTITY_DOWN, { code: "sign-in-down" });

/* Identity is busy or broken, as opposed to saying no. */
const cannotAsk = (status) => status === 429 || status >= 500;

/* Time limits: a Netlify function has 10 seconds in all, and one request
   may need a renewal and a "whose token is this" (4 + 4). */
export function identityClient({ fetchImpl = fetch, now = () => Date.now(), timeoutMs = 4000, refreshMs = 4000 } = {}) {
  const users = new Map();
  let settings = { at: 0, autoconfirm: true };
  const base = (origin) => `${origin}/.netlify/identity`;

  async function autoconfirm(origin) {
    if (now() - settings.at < SETTINGS_CACHE_MS) return settings.autoconfirm;
    try {
      const r = await fetchImpl(`${base(origin)}/settings`, { signal: AbortSignal.timeout(timeoutMs) });
      const data = r.ok ? await r.json() : null;
      settings = { at: now(), autoconfirm: data ? data.autoconfirm === true : true };
    } catch {
      settings = { at: now() - SETTINGS_CACHE_MS + 30000, autoconfirm: true };
    }
    return settings.autoconfirm;
  }

  /* -> the person for an access token, or null when Identity says no;
     a 503 (IDENTITY_DOWN) when Identity can't be asked. */
  async function user(origin, token) {
    if (typeof token !== "string" || !token) return null;
    const hit = users.get(token);
    let found = hit && now() - hit.at < USER_CACHE_MS ? hit.user : null;
    if (!found) {
      let r;
      try {
        r = await fetchImpl(`${base(origin)}/user`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(timeoutMs) });
      } catch {
        signInDown();
      }
      if (cannotAsk(r.status)) signInDown();
      if (r.status !== 200) return null;
      let u;
      try { u = await r.json(); } catch { signInDown(); }
      if (!u || typeof u.id !== "string" || typeof u.email !== "string") return null;
      found = {
        id: u.id, email: u.email, confirmedAt: u.confirmed_at || u.email_confirmed_at || null,
        name: u.user_metadata?.full_name || "",
      };
      if (users.size > 500) users.clear();
      users.set(token, { user: found, at: now() });
    }
    return { ...found, emailVerified: !(await autoconfirm(origin)) };
  }

  /* -> {accessToken, refreshToken, expiresIn (seconds)}, or null when
     Identity says the refresh token is no good (spent, signed out, too
     old); a 503 when Identity can't be asked. */
  async function refresh(origin, refreshToken) {
    let r;
    try {
      r = await fetchImpl(`${base(origin)}/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }).toString(),
        signal: AbortSignal.timeout(refreshMs),
      });
    } catch {
      signInDown();
    }
    if (cannotAsk(r.status)) signInDown();
    if (r.status !== 200) return null;
    let data;
    try { data = await r.json(); } catch { signInDown(); }
    if (!data || typeof data.access_token !== "string" || typeof data.refresh_token !== "string" || !data.access_token || !data.refresh_token) signInDown();
    const expiresIn = Number.isFinite(data.expires_in) && data.expires_in > 0 ? data.expires_in : 3600;
    return { accessToken: data.access_token, refreshToken: data.refresh_token, expiresIn };
  }

  /* Sign the person out of Identity on every device. -> true when Identity
     did it; never throws. */
  async function logout(origin, accessToken) {
    try {
      const r = await fetchImpl(`${base(origin)}/logout`, { method: "POST", headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(timeoutMs) });
      return r.status >= 200 && r.status < 300;
    } catch {
      return false;
    }
  }

  return { user, refresh, logout };
}

/* The Identity token a request carries itself, or null. */
export function tokenOf(request) {
  const auth = request.headers.get("authorization") || "";
  const m = /^Bearer\s+([A-Za-z0-9._-]{20,4096})$/.exec(auth.trim());
  if (m) return m[1];
  const cookies = request.headers.get("cookie") || "";
  for (const part of cookies.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === "nf_jwt") {
      let value = rest.join("=");
      try { value = decodeURIComponent(value); } catch { continue; }
      if (/^[A-Za-z0-9._-]{20,4096}$/.test(value)) return value;
    }
  }
  return null;
}

/* async (request) -> the person whose Identity token the request carries
   itself, or null; a 503 when Identity can't be asked. .client is the
   identityClient it asks (for session.js). */
export function netlifyIdentity(options = {}) {
  const client = options.client || identityClient(options);
  const identityUser = async (request) => {
    const token = tokenOf(request);
    if (!token) return null;
    return client.user(new URL(request.url).origin, token);
  };
  identityUser.client = client;
  return identityUser;
}

/* Send Netlify Identity's own invite email (works when registration is
   "Invite only"). Needs the site's admin token, which only a deployed
   function has. -> true when Identity accepted it. */
export async function identityInvite({ url, token }, email, fetchImpl = fetch) {
  if (!url || !token) return false;
  try {
    const r = await fetchImpl(`${url}/invite`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
      signal: AbortSignal.timeout(8000),
    });
    return r.ok;
  } catch {
    return false;
  }
}
