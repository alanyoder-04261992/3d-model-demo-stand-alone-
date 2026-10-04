/* TALKING TO THE DEALER CENTER'S SERVER (/api/office/...).

   api(path, {method, body}) -> the answer's data, or throws an ApiError
   whose message is the server's plain sentence (and .problems, a list, for
   a price list the server would not save). A sign-in that ran out is
   refreshed once and the call tried again; after that the page goes back
   to the sign-in screen. */

import * as identity from "@netlify/identity";

export class ApiError extends Error {
  constructor(status, message, problems = null) {
    super(message);
    this.status = status;
    this.problems = problems;
  }
}

let signInMode = "netlify";
let onSignedOut = () => {};
export function configureApi({ mode, signedOut }) {
  if (mode) signInMode = mode;
  if (signedOut) onSignedOut = signedOut;
}

async function send(path, { method = "GET", body } = {}) {
  return fetch(`/api/office/${path}`, {
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
    if (r.status === 401 && signInMode === "netlify" && /(^|;\s*)nf_(jwt|refresh)=/.test(document.cookie)) {
      try { await identity.refreshSession(); } catch { /* fall through to sign-in */ }
      r = await send(path, options);
    }
  } catch {
    throw new ApiError(0, "Can't reach the Dealer Center. Check your internet connection and try again.");
  }
  let data = null;
  try { data = await r.json(); } catch { data = null; }
  if (r.status === 401 && path !== "me") {
    onSignedOut();
    throw new ApiError(401, "You were signed out. Sign in again.");
  }
  if (!r.ok && !(path === "me" && r.status === 401)) {
    throw new ApiError(r.status, data?.error || "Something went wrong on our end. Try again in a minute.", data?.problems || null);
  }
  return { status: r.status, ...(data || {}) };
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
