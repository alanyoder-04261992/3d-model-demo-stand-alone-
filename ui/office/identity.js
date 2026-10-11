/* NETLIFY IDENTITY, ASKED STRAIGHT FROM THE PAGE (the live site's sign-in).

   The password goes only to Identity (/.netlify/identity on this same
   site), never to the Dealer Center's own server. What comes back is a
   refresh token, which the page hands at once to the Dealer Center
   (api.js startSession); the server swaps it, so the page's copy is spent
   and nothing about the sign-in stays in the page: no localStorage, no
   cookie a page script can read, no timer.

     passwordSignIn(email, password)  -> refresh token
     signup(email, password, name)    "Make your login" (Identity emails a link)
     recover(email)                   "Forgot your password?" (same answer either way)
     verify(type, token, password?)   a link from an email: "signup" (confirm,
                                      or an invite with its new password),
                                      "recovery" -> {access, refresh}
     setPassword(access, password)    the new password after a reset link
     emailOf(access)                  whose sign-in an access token is

   Every call has a time limit and fails with a SignInError whose message
   is plain words for the sign-in card, and whose kind says what happened:
   "wrong" (that email and password don't match), "confirm" (the email
   isn't confirmed yet), "busy" (too many tries), "down" (Identity can't be
   reached or is broken), "used" (a link that ran out), "exists", "closed"
   (new logins by invitation only), "refused" (anything else Identity
   turned down). */

const BASE = "/.netlify/identity";
const LIMIT_MS = 15000;

export const SIGN_IN_WORDS = {
  wrong: "That email and password don't match. Try again, or reset your password.",
  confirm: "Confirm your email first: open the link we emailed you.",
  busy: "Too many tries. Wait a few minutes, then try again.",
  down: "Can't reach the sign-in right now. Check your internet connection and try again in a minute.",
  used: "That link has expired or was already used. Sign in, or ask for a new link.",
  exists: "There is already a login for that email. Sign in, or reset the password.",
  closed: "New logins are by invitation here. Ask the owner to send you an invite.",
  refused: "We couldn't make that login. Check the email and try again.",
};

export class SignInError extends Error {
  constructor(kind, status = 0) {
    super(SIGN_IN_WORDS[kind] || SIGN_IN_WORDS.down);
    this.kind = kind;
    this.status = status;
  }
}

/* fetch with a time limit (AbortController: older iPads have no
   AbortSignal.timeout). Exported for api.js. */
export async function fetchWithin(url, options, ms) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: ctl.signal });
  } finally {
    clearTimeout(timer);
  }
}

/* -> {status, data}; a SignInError("down") when Identity can't be reached
   in time, is broken (5xx), or answers too often ("busy", 429). */
async function ask(path, { method = "GET", form, body, token } = {}) {
  const headers = {};
  if (form) headers["Content-Type"] = "application/x-www-form-urlencoded";
  else if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  let r;
  try {
    r = await fetchWithin(BASE + path, {
      method, headers, credentials: "same-origin", cache: "no-store",
      body: form ? new URLSearchParams(form).toString() : body !== undefined ? JSON.stringify(body) : undefined,
    }, LIMIT_MS);
  } catch {
    throw new SignInError("down");
  }
  if (r.status === 429) throw new SignInError("busy", 429);
  if (r.status >= 500) throw new SignInError("down", r.status);
  let data = null;
  try { data = await r.json(); } catch { data = null; }
  return { status: r.status, data };
}

const said = (data) => `${data?.error_description || ""} ${data?.msg || ""} ${data?.error || ""}`;
const tokensOf = (data) => {
  if (!data || typeof data.refresh_token !== "string" || !data.refresh_token || typeof data.access_token !== "string") throw new SignInError("down");
  return { access: data.access_token, refresh: data.refresh_token };
};

async function passwordGrant(email, password) {
  const { status, data } = await ask("/token", { method: "POST", form: { grant_type: "password", username: email, password } });
  if (status === 200) return tokensOf(data).refresh;
  if (/confirm/i.test(said(data))) throw new SignInError("confirm", status);
  if (status === 400 || status === 401 || status === 422) throw new SignInError("wrong", status);
  throw new SignInError("down", status);
}

/* The email as typed first; when it has capital letters and Identity
   says no, once more in small letters (a login made before "Make your
   login" saved emails in small letters). */
export async function passwordSignIn(email, password) {
  const typed = String(email || "").trim();
  try {
    return await passwordGrant(typed, password);
  } catch (e) {
    const lower = typed.toLowerCase();
    if (e.kind !== "wrong" || lower === typed) throw e;
    return passwordGrant(lower, password);
  }
}

export async function signup(email, password, name) {
  const { status, data } = await ask("/signup", { method: "POST", body: { email: String(email).trim().toLowerCase(), password, data: { full_name: name } } });
  if (status >= 200 && status < 300) return true;
  const words = said(data);
  if (status === 403 || /not allowed|disabled/i.test(words)) throw new SignInError("closed", status);
  if (/already/i.test(words)) throw new SignInError("exists", status);
  throw new SignInError("refused", status);
}

export async function recover(email) {
  try { await ask("/recover", { method: "POST", body: { email: String(email).trim().toLowerCase() } }); } catch { /* the same answer either way */ }
}

export async function verify(type, token, password) {
  const { status, data } = await ask("/verify", { method: "POST", body: { token, type, ...(password ? { password } : {}) } });
  if (status === 200) return tokensOf(data);
  throw new SignInError(status === 404 || status === 410 || status === 422 || status === 400 ? "used" : "down", status);
}

export async function setPassword(access, password) {
  const { status } = await ask("/user", { method: "PUT", token: access, body: { password } });
  if (status === 200) return true;
  throw new SignInError(status === 401 ? "used" : "refused", status);
}

export async function emailOf(access) {
  try {
    const { status, data } = await ask("/user", { token: access });
    return status === 200 && typeof data?.email === "string" ? data.email : "";
  } catch {
    return "";
  }
}

/* ---- what a sign-in from before left in this browser ------------------------------------- */

/* Before the Dealer Center had its own sign-in cookie, Netlify's
   @netlify/identity kept the sign-in in localStorage ("gotrue.user") and
   in two cookies a page could read (nf_jwt, nf_refresh). */
const OLD_KEY = "gotrue.user";

/* -> the refresh token a sign-in from before left here, or null */
export function oldSignIn() {
  try {
    const u = JSON.parse(localStorage.getItem(OLD_KEY) || "null");
    if (typeof u?.token?.refresh_token === "string" && u.token.refresh_token) return u.token.refresh_token;
  } catch { /* storage blocked or unreadable */ }
  const m = /(?:^|;\s*)nf_refresh=([^;]+)/.exec(document.cookie);
  if (m) try { return decodeURIComponent(m[1]); } catch { /* unreadable */ }
  return null;
}

/* Leave nothing of it behind (the server's answers also clear the cookies,
   even ones a page can't reach). */
export function forgetOldSignIn() {
  try { localStorage.removeItem(OLD_KEY); } catch { /* storage blocked */ }
  for (const name of ["nf_jwt", "nf_refresh"]) {
    if (new RegExp(`(?:^|;\\s*)${name}=`).test(document.cookie)) document.cookie = `${name}=; path=/; secure; samesite=lax; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  }
}
