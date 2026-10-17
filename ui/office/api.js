/* TALKING TO THE DEALER CENTER'S SERVER (/api/office/...).

   api(path, {method, body}) -> the answer's data, or throws an ApiError
   whose message is the server's plain sentence (and .problems, a list, for
   a price list the server would not save; .data, the whole answer). The
   sign-in is the Dealer Center's own cookie (server/office/session.js),
   which the server keeps fresh by itself; a 401 means the sign-in ended,
   and the page goes back to the sign-in screen. A 503 with code
   "sign-in-down" means the sign-in couldn't be checked (never "signed
   out"): the call throws those words.

   SIGNING IN AND OUT (live site): startSession(refreshToken, {keep, why})
   hands a fresh sign-in from Identity (identity.js) to the server, which
   answers with the cookie. signOut() ends it on this device -- without
   asking Identity, so the person's other devices stay signed in -- with a
   time limit, and never leaves the page signed in or stuck: until the
   server has said the sign-in is gone, a note in this browser makes the
   next start ask again first. signOut({everywhere: true}) reloads only
   once the server said every device is out; when it couldn't, it throws
   the words and this device stays signed in to try again. A 401 on a tap
   calls the signedOut handler (main.js), whose answer, when it keeps the
   screen (unsaved changes), is the words the call throws.
   signOutEverywhereWith(access) is the reset link's: every device out,
   with the link's own token.

   BARNWRIGHT MODE (a Barnwright visit, docs/OFFICE.md "The visit"): every
   path goes to /api/office/barnwright/<path>, signed in by the visit's own
   cookie, never by Identity. A 401 there means the visit ended: the page
   never reloads (the work on screen stays, and the screens keep it in this
   tab's sessionStorage); visitEnded() is told and the call throws the
   server's words. When a request works again (a new visit was opened from
   the Control Room; its cookie is the whole browser's), visitBack() is
   told. */

import { fetchWithin, forgetOldSignIn } from "./identity.js";
import { reportApiProblem } from "../problems.js";

export class ApiError extends Error {
  constructor(status, message, problems = null, data = null) {
    super(message);
    this.status = status;
    this.problems = problems;
    this.data = data;
  }
}

/* What a Barnwright visit that ended says (the server says the same). */
export const VISIT_ENDED = "Your Barnwright visit ended. In your Control Room tap Open their price list, then come back and tap Save.";

let signInMode = "netlify";
let demo = false;
let onSignedOut = () => {};
let barnwright = false;
let onVisitEnded = () => {};
let onVisitBack = () => {};
export function configureApi({ mode, demo: inDemo, signedOut, barnwright: visit, visitEnded, visitBack }) {
  if (mode) signInMode = mode;
  if (inDemo !== undefined) demo = !!inDemo;
  if (signedOut) onSignedOut = signedOut;
  if (visit !== undefined) barnwright = !!visit;
  if (visitEnded) onVisitEnded = visitEnded;
  if (visitBack) onVisitBack = visitBack;
}
export const inBarnwrightMode = () => barnwright;

async function send(path, { method = "GET", body } = {}) {
  return fetch(`/api/office/${barnwright ? "barnwright/" : ""}${path}`, {
    method,
    credentials: "same-origin",
    cache: "no-store",
    headers: body !== undefined ? { "Content-Type": "application/json" } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export async function api(path, options = {}) {
  let r;
  try {
    r = await send(path, options);
  } catch {
    throw new ApiError(0, "Can't reach the Dealer Center. Check your internet connection and try again.");
  }
  let data = null;
  try { data = await r.json(); } catch { data = null; }
  if (r.status === 401 && barnwright) {
    onVisitEnded(data);
    throw new ApiError(401, data?.error || VISIT_ENDED, null, data);
  }
  if (barnwright && r.ok) onVisitBack();
  if (r.status === 401 && path !== "me") {
    const words = onSignedOut(data);
    throw new ApiError(401, typeof words === "string" && words ? words : "You were signed out. Sign in again.", null, data);
  }
  if (!r.ok && !(path === "me" && r.status === 401)) {
    reportApiProblem({ status: r.status, path, requestId: data?.requestId || r.headers.get("X-Request-Id"), code: data?.code });
    throw new ApiError(r.status, data?.error || "Something went wrong on our end. Try again in a minute.", data?.problems || null, data);
  }
  return { status: r.status, ...(data || {}) };
}

/* A Barnwright visit starts: the pass from the link, and the body exactly
   {"action":"session"} (the pass was made for those bytes). -> {status,
   ...the answer}; the answer sets the visit's cookie. */
export async function startVisit(pass) {
  let r;
  try {
    r = await fetch("/api/office/barnwright/start", {
      method: "POST", credentials: "same-origin", cache: "no-store",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${pass}` },
      body: '{"action":"session"}',
    });
  } catch {
    return { status: 0, error: "Can't reach the Dealer Center. Check your internet connection and try again." };
  }
  let data = null;
  try { data = await r.json(); } catch { data = null; }
  return { status: r.status, ...(data || {}) };
}

/* Done: the visit ends and its cookie goes. */
export async function endVisit() {
  try { await fetch("/api/office/barnwright/end", { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json" }, body: "{}" }); }
  catch { /* the visit ends by itself */ }
}

export const get = (path) => api(path);
export const post = (path, body) => api(path, { method: "POST", body });
export const put = (path, body) => api(path, { method: "PUT", body });
export const patch = (path, body) => api(path, { method: "PATCH", body });
export const del = (path) => api(path, { method: "DELETE" });

/* ---- signing in and out --------------------------------------------------- */

const SIGN_OUT_MS = 6000;
/* set while a Sign out hasn't been confirmed by the server yet */
const SIGNING_OUT = "dealer-center:signing-out";
/* tells this browser's other Dealer Center tabs (the storage event) */
const SIGNED = "dealer-center:signed";

function note(key, value) {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch { /* storage blocked: the other tabs find out at their next tap */ }
}
const noted = (key) => { try { return localStorage.getItem(key); } catch { return null; } };

/* Other tabs of this browser: "in" or "out" happened here. */
export function tellOtherTabs(what) {
  note(SIGNED, JSON.stringify({ what, at: Date.now() }));
}
export function onOtherTabs(fn) {
  window.addEventListener("storage", (event) => {
    if (event.key !== SIGNED || !event.newValue) return;
    try { fn(JSON.parse(event.newValue).what); } catch { /* not ours */ }
  });
}

/* A fresh sign-in (Identity's refresh token) becomes the Dealer Center's
   sign-in cookie. keep: "Keep me signed in on this device for 30 days".
   why "reset": a new password, which signs this person out everywhere
   else. -> {ok, keep, endsAt}; throws an ApiError with plain words. */
export async function startSession(refreshToken, { keep = false, why } = {}) {
  let r;
  try {
    r = await fetchWithin("/api/office/session", {
      method: "POST", credentials: "same-origin", cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken, keep: !!keep, ...(why ? { why } : {}) }),
    }, 20000);
  } catch {
    throw new ApiError(0, "Can't reach the Dealer Center. Check your internet connection and try again.");
  }
  let data = null;
  try { data = await r.json(); } catch { data = null; }
  if (!r.ok) {
    throw new ApiError(r.status, r.status === 503
      ? "Your password is right, but the Dealer Center couldn't finish signing you in. Try again in a minute."
      : data?.error || "That didn't work. Sign in again.", null, data);
  }
  note(SIGNING_OUT, null);
  forgetOldSignIn();
  return data;
}

/* Words for the next Sign in card in this tab (after the reload). */
const CARD_NOTE = "dealer-center:sign-in-note";
export function takeSignInNote() {
  try {
    const words = sessionStorage.getItem(CARD_NOTE);
    sessionStorage.removeItem(CARD_NOTE);
    return words || null;
  } catch { return null; }
}
function noteForCard(words) {
  try { sessionStorage.setItem(CARD_NOTE, words); } catch { /* the card shows without them */ }
}

export const SIGN_OUT_WORDS = {
  /* every Dealer Center sign-in ended, but Identity's own sign-out didn't answer */
  everywhereHalf: "You're signed out of the Dealer Center on every device, but the sign-in didn't answer. In a minute, sign in and tap Sign out on every device again to finish.",
  everywhereNot: "Couldn't sign out on every device. You're still signed in here. Try again in a minute.",
  cantReach: "Can't reach the Dealer Center. Check your internet connection and try again.",
  /* the reset link's sign out on every device didn't finish */
  resetNotOut: "Your new password is saved, but the sign-in didn't answer, so your other devices may still be signed in. Wait a minute, then tap Save password again.",
};

/* Ask the server to end this device's sign-in (and with everywhere, every
   device's; token: a reset link's own sign-in). -> {ok, status, data};
   status 0 when it couldn't be reached in time. */
async function endOnServer(everywhere, { token = null, why = null, ms = SIGN_OUT_MS } = {}) {
  try {
    const r = await fetchWithin("/api/office/sign-out", {
      method: "POST", credentials: "same-origin", cache: "no-store",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(everywhere ? { everywhere: true, ...(why ? { why } : {}) } : {}),
    }, ms);
    let data = null;
    try { data = await r.json(); } catch { data = null; }
    return { ok: r.ok, status: r.status, data };
  } catch {
    return { ok: false, status: 0, data: null };
  }
}

/* A Sign out that the server never confirmed (no internet, too slow):
   asked again when the page starts. -> true when nothing is left over. */
export async function finishSignOut() {
  if (noted(SIGNING_OUT) == null) return true;
  if (!(await endOnServer(false)).ok) return false;
  note(SIGNING_OUT, null);
  return true;
}

/* The reset link: every device signed out -- every Dealer Center sign-in,
   and at Identity every refresh token of this person, even one somebody
   kept from the old password -- with the link's own token. Throws an
   ApiError with words to show unless all of that happened. */
export async function signOutEverywhereWith(access) {
  const out = await endOnServer(true, { token: access, why: "password", ms: SIGN_OUT_MS * 2 });
  if (out.status === 0) throw new ApiError(0, SIGN_OUT_WORDS.cantReach);
  if (!out.ok || out.data?.everywhere !== true || out.data?.identity !== true) throw new ApiError(out.status, SIGN_OUT_WORDS.resetNotOut, null, out.data);
  return out.data;
}

/* Sign out: this device only (or every device with everywhere). The
   page then starts again on a clean sign-in card at /dealer. Every device:
   only once the server said so -- otherwise this throws the words and this
   device stays signed in to try again; when Identity itself didn't answer,
   the card says so. */
export async function signOut({ everywhere = false } = {}) {
  if (signInMode === "local") {
    try { await fetchWithin("/__local/sign-out", { method: "POST", credentials: "same-origin" }, SIGN_OUT_MS); } catch { /* the reload asks again */ }
  } else if (everywhere) {
    const out = await endOnServer(true, { ms: SIGN_OUT_MS * 2 });
    /* (ok without everywhere, or 401: this device was signed out already -- start again) */
    if (!out.ok && out.status !== 401) throw new ApiError(out.status, out.status === 0 ? SIGN_OUT_WORDS.cantReach : out.data?.error || SIGN_OUT_WORDS.everywhereNot, null, out.data);
    if (out.data?.everywhere === true && out.data?.identity === false) noteForCard(SIGN_OUT_WORDS.everywhereHalf);
    forgetOldSignIn();
  } else {
    note(SIGNING_OUT, "1");
    if ((await endOnServer(false)).ok) note(SIGNING_OUT, null);
    forgetOldSignIn();
  }
  /* the "try it" demo signs out of nothing real: the other tabs stay as they are */
  if (!demo) tellOtherTabs("out");
  location.replace(location.pathname + location.search);
}
