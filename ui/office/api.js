/* TALKING TO THE DEALER CENTER'S SERVER (/api/office/...).

   api(path, {method, body}) -> the answer's data, or throws an ApiError
   whose message is the server's plain sentence (and .problems, a list, for
   a price list the server would not save; .data, the whole answer). A
   sign-in that ran out is refreshed once and the call tried again; after
   that the page goes back to the sign-in screen.

   BARNWRIGHT MODE (a Barnwright visit, docs/OFFICE.md "The visit"): every
   path goes to /api/office/barnwright/<path>, signed in by the visit's own
   cookie, never by Identity. A 401 there means the visit ended: the page
   never reloads (the work on screen stays, and the screens keep it in this
   tab's sessionStorage); visitEnded() is told and the call throws the
   server's words. */

import * as identity from "@netlify/identity";

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
let onSignedOut = () => {};
let barnwright = false;
let onVisitEnded = () => {};
export function configureApi({ mode, signedOut, barnwright: visit, visitEnded }) {
  if (mode) signInMode = mode;
  if (signedOut) onSignedOut = signedOut;
  if (visit !== undefined) barnwright = !!visit;
  if (visitEnded) onVisitEnded = visitEnded;
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
    if (r.status === 401 && !barnwright && signInMode === "netlify" && /(^|;\s*)nf_(jwt|refresh)=/.test(document.cookie)) {
      try { await identity.refreshSession(); } catch { /* fall through to sign-in */ }
      r = await send(path, options);
    }
  } catch {
    throw new ApiError(0, "Can't reach the Dealer Center. Check your internet connection and try again.");
  }
  let data = null;
  try { data = await r.json(); } catch { data = null; }
  if (r.status === 401 && barnwright) {
    onVisitEnded(data);
    throw new ApiError(401, data?.error || VISIT_ENDED, null, data);
  }
  if (r.status === 401 && path !== "me") {
    onSignedOut();
    throw new ApiError(401, "You were signed out. Sign in again.");
  }
  if (!r.ok && !(path === "me" && r.status === 401)) {
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

/* ---- signing in ----------------------------------------------------------- */

export { identity };

export async function signOut() {
  if (signInMode === "local") {
    await fetch("/__local/sign-out", { method: "POST", credentials: "same-origin" });
  } else {
    try { await identity.logout(); } catch { /* already signed out */ }
  }
  location.hash = "";
  location.reload();
}
