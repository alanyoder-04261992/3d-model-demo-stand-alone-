/* A PRETEND BARNWRIGHT SALES INBOX, for tools/check-help.mjs, the browser
   check and the local Dealer Center (npm run office -- --control-room).

   It answers the three calls a business's Dealer Center makes, the way the
   real one does (alanyoder-04261992/inbox-barnwrightsoftware, the help pass
   spec v1, Oct 6 2026, section 2), as a fetch stub in the same process:
     POST /help/v1/ask      a question -> 201 {ok, id, at}; the same pass
                            again -> 200 with the same id, nothing new stored
     POST /help/v1/thread   the business's questions, newest first, at most
                            30, with Barnwright's replies
     POST /help/v1/problem  a browser problem -> {ok, id, new}; the same
                            signature from the same business within 24 hours
                            adds to the first one's count
   Every pass is checked the way the inbox checks it: its shape, the control
   room's signature (with the control room's public key, over
   "barnwright-help-pass/v1." + its body), v, purpose, the kind for that
   address, its id and its times. Limits per day (UTC), per business: 20
   questions and 30 problem reports (then 429 with Retry-After).

   What Alan does in the real inbox: answer(id, words) -- the newest waiting
   question when id is left out.
   Switches for the checks: down (every call fails as if the inbox could not
   be reached), nextStatus = {path, status} (the next call to that address
   gets that answer), dropAfterNextAsk (the next question is stored, then
   the connection drops before the answer arrives). calls lists every call
   with its headers and body. */

import { createPublicKey, verify, randomBytes } from "node:crypto";

const PASS_RE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const EMAIL_RE = /^[^\s@<>()",;]+@[^\s@<>()",;]+\.[^\s@<>()",;]+$/;
const KINDS = { "/help/v1/ask": "question", "/help/v1/thread": "thread", "/help/v1/problem": "problem" };

export function fakeHelpInbox({ clock, publicKeyPem, origin = "https://help-inbox.test" }) {
  const key = createPublicKey(publicKeyPem);
  const inbox = { origin, down: false, nextStatus: null, dropAfterNextAsk: false, calls: [], questions: [], problems: [] };
  const now = () => clock.t;
  const answer = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...headers } });
  const refuse = (status, error, message) => answer({ error, message }, status, status === 429 ? { "Retry-After": "3600" } : {});
  const str = (v, max, min = 0) => typeof v === "string" && v.length >= min && v.length <= max;
  const iso = (t) => new Date(t).toISOString();
  const newId = () => randomBytes(12).toString("base64url");

  /* -> the claims, or null when the inbox would answer 401 bad_pass */
  function checkPass(pass, kind) {
    if (!str(pass, 8000, 3) || !PASS_RE.test(pass)) return null;
    const [body, sig] = pass.split(".");
    const signature = Buffer.from(sig, "base64url");
    if (signature.length !== 64) return null;
    try {
      if (!verify("sha256", Buffer.from("barnwright-help-pass/v1." + body), { key, dsaEncoding: "ieee-p1363" }, signature)) return null;
    } catch { return null; }
    let c;
    try { c = JSON.parse(Buffer.from(body, "base64url").toString("utf8")); } catch { return null; }
    const t = now();
    if (!c || c.v !== 1 || c.purpose !== "help-pass" || c.kind !== kind || !str(c.id, 64, 16) || !/^[A-Za-z0-9_-]+$/.test(c.id)
      || !str(c.customerId, 100, 1) || !str(c.siteId, 100, 1)
      || !Number.isSafeInteger(c.issuedAt) || !Number.isSafeInteger(c.expiresAt)
      || c.issuedAt > t + 60_000 || c.expiresAt <= t || c.expiresAt - c.issuedAt > 15 * 60_000) return null;
    return c;
  }
  const today = (list, customerId) => list.filter((x) => x.customerId === customerId && x.at.slice(0, 10) === iso(now()).slice(0, 10)).length;

  function ask(c, q) {
    const a = q?.asker;
    if (!q || typeof q !== "object" || !str(q.text, 4000, 1) || !q.text.trim() || (q.page !== undefined && !str(q.page, 200))
      || !a || !str(a.id, 128, 1) || !str(a.name ?? "", 80) || !str(a.email, 254, 3) || !EMAIL_RE.test(a.email)
      || !["owner", "manager", "dealer"].includes(a.role)
      || (q.details !== undefined && (typeof q.details !== "object" || Buffer.byteLength(JSON.stringify(q.details)) > 8000))) {
      return refuse(400, "bad_request", "That question isn't complete.");
    }
    const again = inbox.questions.find((x) => x.passId === c.id);
    if (again) return answer({ ok: true, id: again.id, at: again.at }, 200);
    if (today(inbox.questions, c.customerId) >= 20) return refuse(429, "too_many", "Too many questions today.");
    const item = {
      id: newId(), at: iso(now()), passId: c.id, customerId: c.customerId, text: q.text, page: q.page || "",
      asker: { id: a.id, name: a.name || "", email: a.email, role: a.role }, details: q.details ?? null,
      status: "waiting", replies: [],
    };
    inbox.questions.push(item);
    if (inbox.dropAfterNextAsk) {
      inbox.dropAfterNextAsk = false;
      throw new TypeError("fetch failed: the connection dropped");
    }
    return answer({ ok: true, id: item.id, at: item.at }, 201);
  }

  function thread(c) {
    const items = inbox.questions.filter((x) => x.customerId === c.customerId)
      .sort((x, y) => y.at.localeCompare(x.at) || inbox.questions.indexOf(y) - inbox.questions.indexOf(x)).slice(0, 30)
      .map((x) => ({ id: x.id, at: x.at, text: x.text, page: x.page, asker: { id: x.asker.id, name: x.asker.name }, status: x.status, replies: x.replies.map((r) => ({ at: r.at, text: r.text })) }));
    return answer({ ok: true, items });
  }

  function problem(c, p) {
    if (!p || typeof p !== "object" || !str(p.signature, 120, 1) || !/^[A-Za-z0-9:._/-]+$/.test(p.signature) || !str(p.message, 300, 1)
      || !str(p.where ?? "", 200) || !str(p.page ?? "", 200) || !["designer", "dealer-center"].includes(p.area)
      || !str(p.appVersion ?? "", 100) || !str(p.browser ?? "", 300) || (p.count !== undefined && (!Number.isSafeInteger(p.count) || p.count < 1))
      || (p.firstAt !== undefined && !Number.isFinite(Date.parse(p.firstAt))) || (p.lastAt !== undefined && !Number.isFinite(Date.parse(p.lastAt)))) {
      return refuse(400, "bad_request", "That problem report isn't complete.");
    }
    const t = now();
    const known = inbox.problems.find((x) => x.customerId === c.customerId && x.signature === p.signature && t - Date.parse(x.at) < 24 * 3600_000);
    if (known) {
      known.count += p.count || 1;
      known.lastAt = p.lastAt || iso(t);
      return answer({ ok: true, id: known.id, new: false });
    }
    if (today(inbox.problems, c.customerId) >= 30) return refuse(429, "too_many", "Too many problem reports today.");
    const item = { id: newId(), at: iso(t), customerId: c.customerId, ...p, count: p.count || 1 };
    inbox.problems.push(item);
    return answer({ ok: true, id: item.id, new: true });
  }

  inbox.fetch = async (url, init = {}) => {
    const path = new URL(url).pathname;
    const headers = new Headers(init.headers || {});
    const raw = typeof init.body === "string" ? init.body : "";
    let body = null;
    try { body = JSON.parse(raw); } catch { body = null; }
    inbox.calls.push({ path, method: init.method, headers: Object.fromEntries(headers), redirect: init.redirect, signal: init.signal, body });
    if (inbox.down) throw new TypeError("fetch failed");
    if (init.method !== "POST") return refuse(405, "bad_request", "Use POST.");
    if (!/^application\/json/i.test(headers.get("content-type") || "")) return refuse(400, "bad_request", "Send JSON.");
    if (headers.has("cookie")) return refuse(400, "bad_request", "No cookies here.");
    if (Buffer.byteLength(raw) > 64 * 1024) return refuse(413, "too_big", "That is too much.");
    if (!body || typeof body !== "object" || Array.isArray(body)) return refuse(400, "bad_request", "Send JSON.");
    const forced = inbox.nextStatus;
    if (forced && (!forced.path || path.endsWith("/" + forced.path))) {
      inbox.nextStatus = null;
      return refuse(forced.status, forced.status === 429 ? "too_many" : forced.status === 401 ? "bad_pass" : "busy", "Forced by the check.");
    }
    const kind = KINDS[path];
    if (!kind) return refuse(404, "not_found", "Not here.");
    const claims = checkPass(body.pass, kind);
    if (!claims) return refuse(401, "bad_pass", "That pass isn't valid.");
    if (kind === "question") return ask(claims, body.question);
    if (kind === "thread") return thread(claims);
    return problem(claims, body.problem);
  };

  /* Alan's reply, sent from the Sales Inbox */
  inbox.answer = (id, words) => {
    const q = id ? inbox.questions.find((x) => x.id === id) : [...inbox.questions].reverse().find((x) => x.status === "waiting");
    if (!q) return null;
    q.replies.push({ at: iso(now()), text: words });
    q.status = "answered";
    return q;
  };
  return inbox;
}
