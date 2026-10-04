/* SENDING A QUOTE REQUEST FROM A LOT'S 3D DESIGNER (/d/<lot>/) TO THE
   DEALER CENTER. Browser file; ui/quote.js calls it when the customer taps
   "Request my quote" on a lot's link.

   submitManagedOrder(managed, design, contact, timeoutMs)
     POSTs {design, contact, version, idempotencyKey} to managed.quoteUrl
     (api/lots/<lot>/quote-requests). The server decides the lot (from the
     address) and the price (from the price list); nothing the browser says
     about either is trusted.
     -> {ok: true, how: "managed", receipt}
          receipt = {id, number, total, price, receivedAt, repriced}
     -> {ok: false, why, kind, code}
          why     one sentence for the customer, ready to show
          kind    "answer"   the server said what is wrong (a 4xx with a
                             sentence written for customers: show it)
                  "refresh"  a 409 that asks for a refresh (something in the
                             building is no longer offered): offer Refresh,
                             which keeps the building (reloadWithDesign)
                  "slow"     no answer in time
                  "offline"  the server could not be reached
                  "busy"     a 5xx, or an answer the page could not read
          code    the server's answer code (0 when there was none)

   SENDING TWICE MAKES ONE QUOTE. Each different send gets a random one-time
   key, kept (with a fingerprint of the design and details, never the
   details themselves) in this tab's sessionStorage, so "Try again" after a
   lost answer sends the SAME key and the server answers with the quote it
   already saved. In a frame where storage is blocked, the key is kept in
   memory for as long as the page is open.

   reloadWithDesign(design) / addressWithDesign(design, href)
     The refresh that keeps the customer's building: the design goes into
     the address (#d=<encoded design>, the same link "Share my design"
     makes, model/design.js encode) and the page reloads, so it opens their
     building with today's price list and options. */

import { encode } from "../model/design.js";

const pendingRequests = new Map();

/* the words the customer sees when the server's own sentence cannot be used */
export const WORDS = Object.freeze({
  slow: "That took too long. Tap Try again — we won't get it twice.",
  offline: "We couldn't send that just now. Check your internet connection, then tap Try again.",
  busy: "We couldn't send that just now. Please try again in a minute.",
});

export async function submitManagedOrder(managed, design, contact, timeoutMs = 20000) {
  const url = managed.quoteUrl || managed.orderUrl;          /* orderUrl: a page opened before the change */
  const content = JSON.stringify({ design, contact, version: managed.version });
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",
    new TextEncoder().encode(content))), (b) => b.toString(16).padStart(2, "0")).join("");
  const key = `shed-order:${managed.slug}:${digest}`;
  let idempotencyKey = pendingRequests.get(key);
  try { idempotencyKey ||= sessionStorage.getItem(key); } catch { /* storage blocked in a frame */ }
  idempotencyKey ||= crypto.randomUUID();
  pendingRequests.set(key, idempotencyKey);
  try { sessionStorage.setItem(key, idempotencyKey); } catch { /* still send it */ }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetch(url, {
      method: "POST", credentials: "omit", signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ design, contact, version: managed.version, idempotencyKey }),
    });
  } catch (e) {
    clearTimeout(timer);
    return e && e.name === "AbortError" ? failed("slow", WORDS.slow, 0) : failed("offline", WORDS.offline, 0);
  }

  /* the answer: a receipt, or a sentence that says what is wrong */
  let answer = null;
  try { answer = await response.json(); }
  catch (e) {
    clearTimeout(timer);
    return e && e.name === "AbortError" ? failed("slow", WORDS.slow, response.status) : failed("busy", WORDS.busy, response.status);
  }
  clearTimeout(timer);

  if (response.ok) {
    const receipt = answer && typeof answer === "object" && !Array.isArray(answer) ? answer : null;
    if (!receipt || (!receipt.id && !receipt.number)) return failed("busy", WORDS.busy, response.status);
    return { ok: true, how: "managed", receipt };
  }
  const said = answer && typeof answer.error === "string" ? answer.error.trim() : "";
  if (response.status >= 500 || response.status < 400 || !said) return failed("busy", WORDS.busy, response.status);
  if (response.status === 409 && /refresh/i.test(said)) return failed("refresh", said, 409);
  return failed("answer", said, response.status);
}

function failed(kind, why, code) {
  return { ok: false, why, kind, code };
}

/* The address with the design in it: whatever came after "#" (an older
   design, "&view=1") is replaced, so the page opens ready to change. */
export async function addressWithDesign(design, href) {
  const u = new URL(href);
  u.hash = "d=" + await encode(design);
  return u.href;
}

/* Put the design in the address, then reload: the page opens the customer's
   own building with today's price list (ui/app.js reads #d=). */
export async function reloadWithDesign(design, where = globalThis) {
  const next = await addressWithDesign(design, where.location.href);
  try { where.history.replaceState(where.history.state, "", next); }
  catch (e) { where.location.hash = new URL(next).hash; }
  where.location.reload();
  return next;
}
