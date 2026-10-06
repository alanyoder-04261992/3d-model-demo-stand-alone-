/* HELP: QUESTIONS TO BARNWRIGHT, BARNWRIGHT'S ANSWERS, AND PROBLEM REPORTS.

   Alan's words (Oct 2026): a Help button inside the software (no phone
   number), short help answers, and problem alerts. The Help screen
   (ui/office/views/help.js) carries the short answers itself; this file is
   the part that talks to Barnwright, for a business connected to
   Barnwright's control room:

     GET  /api/office/help      thread(who): the business's questions and
                                Barnwright's answers, newest first. The
                                owner and managers see every question; a
                                dealer sees the ones they asked.
     POST /api/office/help      ask(who, data): one question from whoever is
                                signed in (never from what the browser
                                says), with the page they came from and a
                                few facts about how the Dealer Center runs.
                                Works while changes are stopped: asking for
                                help is never a change.
     POST /api/office/problem   problem(request, data): one browser error
                                (ui/problems.js), no sign-in. Each kind of
                                error goes at most once in 24 hours, and at
                                most 10 go a day for the whole site; the
                                answer is always {ok: true}.

   How: the control room gives a pass good for 10 minutes (control-room.js
   helpPass, signed in with the activation key), and the pass goes with the
   question to Barnwright's Sales Inbox (POST /help/v1/ask, /thread or
   /problem at BARNWRIGHT_HELP_URL, netlify.js). The inbox checks the pass
   with the control room's public key; Claude drafts each answer, Alan sends
   it, and it reaches the person by email and on their Help screen.

   One time limit (12 seconds) covers all of a request's calls together,
   so a slow control room and a slow inbox never add up to a long wait.
   The same person sending the same words again within 9 minutes (the
   answer got lost, or they tapped Send again) goes with the same pass, and
   the inbox answers with the first one: one question, never two.

   When it doesn't work, the person reads why and what to do: the control
   room refusing this Dealer Center's key means Help isn't set up for it
   yet, the inbox refusing the question means it never will take it (both
   give the email to write to), and anything else is "try again in a
   minute".

   What goes with a question: what the person typed, the page they came
   from (the screen only: never which customer, order or quote), who they
   are (name, email, job), and these facts only: this copy's version, the
   business's name, its Barnwright account (on or off, why, lots allowed and
   open, the last check-in), how many lots are open and closed, how many
   people are on the team, whether email is set up, whether the price list
   is saved (and when), whether the 3D designer is open, and from the
   browser its name, screen size, language, time zone and recent errors.
   Never customers, prices, the price list itself, orders, keys or
   passwords. Nothing a person typed is ever written to the log.

   Not connected (Alan's own business, this computer, the "try it" demo):
   GET says connected: false, asking is refused in plain words, and
   problems are dropped quietly.

   Node-safe and browser-safe (fetch only, no node: imports): the demo runs
   index.js, and so this file, inside the page. */

import { fail, text as textField } from "./http.js";
import { KEEP } from "./store.js";
import { tidyMessage } from "../../ui/problems.js";

export const SUPPORT_EMAIL = "support@barnwrightsoftware.com";
export const HELP_INBOX = "https://inbox.barnwrightsoftware.com";

/* The sentences a person can read (the screen has the same "not connected"
   line in ui/office/help-answers.js; tools/check-help.mjs keeps them equal). */
export const HELP_WORDS = Object.freeze({
  unreachable: "Barnwright couldn't be reached just now. Try again in a minute.",
  tooMany: `Barnwright has had a lot of questions from your business today. To ask more, email ${SUPPORT_EMAIL}.`,
  notConnected: `Questions go straight to Barnwright from a Dealer Center Barnwright sets up. To ask from here, email ${SUPPORT_EMAIL}.`,
  notSetUp: `Barnwright hasn't finished setting up Help for your Dealer Center yet. Until then, email ${SUPPORT_EMAIL}.`,
  refused: `Barnwright couldn't take this question. Email it to ${SUPPORT_EMAIL} instead.`,
  badEmail: `Barnwright can't write back to the email you sign in with. Email your question to ${SUPPORT_EMAIL} instead.`,
  listUnreachable: "Barnwright couldn't be reached just now, so your questions aren't showing. Try again in a minute.",
});

const PROBLEMS = "barnwright-help-problems";   /* {day, sent, seen: {signature: when sent}} */
const PROBLEMS_A_DAY = 10;
const ASKED = "barnwright-help-asked";         /* {key: {pass, at}}: the questions of the last 9 minutes */
const SAME_QUESTION_MS = 9 * 60_000;           /* a pass is good for 10 */
const BUDGET_MS = 12_000;                      /* all of one request's calls together */
const DAY = 24 * 3600_000;
const DETAILS_MAX = 8000;                      /* bytes of JSON the inbox keeps */
const REPLY_MAX = 20_000;                      /* the longest answer the inbox sends */
/* an address the Sales Inbox can write to (its lib/mail.mjs isEmail) */
const INBOX_EMAIL = /^[^\s@<>()",;:\\[\]]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/;
const SIGNATURE_RE = /^[A-Za-z0-9:._/-]{1,120}$/;
const RESERVED = new Set(["__proto__", "constructor", "prototype"]);
const CONTROL = /[\u0000-\u001f\u007f]+/g;
const CONTROL_KEEP_LINES = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;

/* BARNWRIGHT_HELP_URL -> the inbox's address with nothing after its name.
   https only; plain http only for localhost when allowLocal (a run on this
   computer). Throws on anything else. */
export function inboxOrigin(value, { allowLocal = false } = {}) {
  const url = new URL(String(value));
  if (url.username || url.password || url.search || url.hash || (url.pathname !== "/" && url.pathname !== "")) {
    throw new Error("BARNWRIGHT_HELP_URL must be https:// and the inbox's name, with nothing after it");
  }
  const local = allowLocal && url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !local) throw new Error("BARNWRIGHT_HELP_URL must start with https://");
  return url.origin;
}

/* ---- small cleaners: every string from a browser or the inbox goes through one -- */

/* one short line, or "" */
const line = (value, max) => (typeof value === "string" ? value.replace(CONTROL, " ").replace(/\s+/g, " ").trim().slice(0, max) : "");
const bytes = (s) => new TextEncoder().encode(s).length;
function isoOr(value, fallback) {
  if (typeof value !== "string" || value.length > 40) return fallback;
  const t = Date.parse(value);
  return Number.isFinite(t) ? new Date(t).toISOString() : fallback;
}

/* The address Barnwright writes back to, the way the Sales Inbox reads
   addresses: a domain in other letters (bob@müller.de) as the internet
   writes it (bob@xn--mller-kva.de). "" when the inbox can't write to it. */
export function mailbox(email) {
  const value = String(email || "");
  const at = value.lastIndexOf("@");
  if (at < 1) return "";
  let domain = value.slice(at + 1);
  if (!domain || /[\s:/?#[\]@\\%]/.test(domain)) return "";
  try { domain = new URL(`http://${domain}`).hostname; } catch { return ""; }
  const out = `${value.slice(0, at)}@${domain}`;
  return out.length <= 254 && INBOX_EMAIL.test(out) ? out : "";
}

/* What a refusal means for the person: the control room refusing this
   Dealer Center's key (401, 403) -> Help isn't set up for it yet; the
   inbox refusing what was sent (a 4xx other than 429) -> it never will take
   it; anything else (no answer, 5xx, busy) -> try again in a minute. */
const passTrouble = (error) => (error?.status === 401 || error?.status === 403 ? "notSetUp"
  : error?.status >= 400 && error?.status < 500 && error?.status !== 409 && error?.status !== 429 ? "refused" : "unreachable");
const inboxTrouble = (status) => (status === 429 ? "tooMany"
  : status >= 400 && status < 500 && status !== 408 && status !== 409 ? "refused" : "unreachable");
const STATUS_OF = { notSetUp: 503, refused: 422, unreachable: 503, tooMany: 429 };

/* "/dealer#/customers/Ab12Cd34/orders/Ef56?x=1" -> "/dealer#/customers/:id/orders/:id":
   the page's path and which screen, never which customer, order or quote,
   no query string, and nothing after # that isn't a screen (a sign-in
   email's link, a customer's saved building). */
export function cleanPage(value) {
  if (typeof value !== "string") return "";
  const at = value.indexOf("#");
  const path = (at < 0 ? value : value.slice(0, at)).split("?")[0].replace(/[^A-Za-z0-9/._-]/g, "");
  const hash = at < 0 ? "" : value.slice(at + 1).split("?")[0];
  const screen = /^\/[A-Za-z0-9/:._-]*$/.test(hash) ? "#" + hash.replace(/(\/(?:customers|orders|quotes|design))\/[^/#]+/g, "$1/:id") : "";
  return (path + screen).slice(0, 200);
}

/* "https://site/ui/app.js?v=2:120:7" -> "/ui/app.js:120:7": the script's
   path, line and column, no site name and no query string. */
export function cleanWhere(value) {
  if (typeof value !== "string" || !value.trim()) return "";
  const m = /^(.*?)(?::(\d{1,7}))?(?::(\d{1,7}))?$/.exec(value.trim());
  const path = m[1].split(/[?#]/)[0].replace(/^.*?:\/\/[^/]*/, "").replace(/[^A-Za-z0-9/._~+-]/g, "");
  return [path, m[2], m[3]].filter((x) => x !== undefined && x !== "").join(":").slice(0, 200);
}

/* The inbox's short code for a refusal ("bad_pass"), for the log only. */
const codeOf = (data) => (typeof data?.error === "string" && /^[a-z_]{1,40}$/.test(data.error) ? data.error : "");

/* The first words of a question, for the control room's log (at most 120). */
function subjectOf(words) {
  const flat = words.replace(/\s+/g, " ").trim();
  if (flat.length <= 120) return flat;
  const cut = flat.slice(0, 119);
  const space = cut.lastIndexOf(" ");
  return (space > 60 ? cut.slice(0, space) : cut) + "…";
}

/* Recent errors the browser saw (ui/problems.js recentProblems). */
function cleanErrors(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const e of list.slice(0, 10)) {
    if (!e || typeof e !== "object") continue;
    const message = typeof e.message === "string" ? tidyMessage(e.message) : "";
    if (!message) continue;
    const entry = { message, where: cleanWhere(line(e.where, 400)) };
    const at = isoOr(e.at, "");
    if (at) entry.at = at;
    if (Number.isSafeInteger(e.count) && e.count > 0) entry.count = Math.min(e.count, 100000);
    out.push(entry);
  }
  return out;
}

/* What the browser may add: these four facts and its recent errors, nothing else. */
function browserFacts(b) {
  const out = {};
  const browser = line(b.browser, 300);
  if (browser) out.browser = browser;
  if (typeof b.screen === "string" && /^\d{1,5}x\d{1,5}$/.test(b.screen)) out.screen = b.screen;
  if (typeof b.language === "string" && /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8}){0,3}$/.test(b.language)) out.language = b.language;
  if (typeof b.timezone === "string" && /^[A-Za-z0-9_+/-]{1,64}$/.test(b.timezone)) out.timezone = b.timezone;
  out.errors = cleanErrors(b.errors);
  return out;
}

/* One question from the inbox's answer, kept to the fields the screen shows. */
function cleanItem(x) {
  if (!x || typeof x !== "object" || typeof x.id !== "string" || !x.id || x.id.length > 100 || typeof x.text !== "string") return null;
  const asker = x.asker && typeof x.asker === "object" ? x.asker : {};
  return {
    id: x.id,
    at: isoOr(x.at, ""),
    text: x.text.replace(CONTROL_KEEP_LINES, "").slice(0, 4000),
    page: cleanPage(x.page),
    asker: { id: typeof asker.id === "string" ? asker.id.slice(0, 128) : "", name: line(asker.name, 80) },
    status: ["waiting", "answered", "closed"].includes(x.status) ? x.status : "waiting",
    replies: (Array.isArray(x.replies) ? x.replies : []).slice(0, 50)
      .filter((r) => r && typeof r.text === "string" && r.text.trim())
      .map((r) => ({ at: isoOr(r.at, ""), text: r.text.replace(CONTROL_KEEP_LINES, "").slice(0, REPLY_MAX) })),
  };
}

export function createHelp({ store, license = null, inbox = null, account, lots, priceList, emailOn = false, appVersion = "dealer-center", now, log = console.error }) {
  const connected = !!license;
  let origin = null;
  if (connected && inbox) {
    try { origin = inboxOrigin(inbox.url || HELP_INBOX, { allowLocal: !!inbox.allowLocal }); }
    catch (error) { log("Help can't reach Barnwright:", error?.message || "Error"); }
  }
  /* some control room settings missing, or no inbox address: say to email instead */
  const canAsk = connected && !license.misconfigured && !!origin;
  const request = inbox?.fetch || ((url, init) => globalThis.fetch(url, init));
  const timeoutMs = Number.isInteger(inbox?.timeoutMs) && inbox.timeoutMs > 0 ? inbox.timeoutMs : 8000;
  const budgetMs = Number.isInteger(inbox?.budgetMs) && inbox.budgetMs > 0 ? inbox.budgetMs : BUDGET_MS;

  /* The time one request has left for its calls (real time, whatever the
     clock in the checks says). ms(most): what the next call may wait, at
     most `most`; 0 when it's used up. */
  function deadline() {
    const until = Date.now() + budgetMs;
    return { ms: (most) => Math.max(0, Math.min(most, until - Date.now())) };
  }
  const outOfTime = () => Object.assign(new Error("No time left for this request"), { name: "TimeoutError" });

  /* POST to the Sales Inbox -> {status, data}. Throws when it can't be reached.
     retry: once more with the same pass after a dropped connection (never
     after a timeout, nor with under 2 seconds left); the inbox answers a
     pass it has seen with the first answer's id and stores nothing new, so a
     question is never sent twice. */
  async function send(path, body, left, { retry = false } = {}) {
    const init = (ms) => ({
      method: "POST", redirect: "error", signal: AbortSignal.timeout(ms),
      headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const once = () => {
      const ms = left.ms(timeoutMs);
      if (ms < 250) throw outOfTime();
      return request(`${origin}/help/v1/${path}`, init(ms));
    };
    let response;
    try {
      response = await once();
    } catch (error) {
      if (!retry || error?.name === "TimeoutError" || error?.name === "AbortError" || left.ms(timeoutMs) < 2000) throw error;
      response = await once();
    }
    let data = null;
    try { data = await response.json(); } catch { data = null; }
    return { status: response.status, data };
  }

  /* A pass from the control room, within the request's time. Throws (with
     the control room's status when it answered). */
  async function passFor(kind, subject, left) {
    const ms = left.ms(timeoutMs);
    if (ms < 250) throw outOfTime();
    return license.helpPass(kind, subject, { timeoutMs: ms });
  }

  /* The same person asking the same words within 9 minutes goes with the
     same pass (see the top of this file). Kept: a short code for who and
     what (never the words), the pass and when. */
  async function sameQuestionKey(userId, words) {
    const subtle = globalThis.crypto?.subtle;
    if (!subtle) return "";
    const digest = await subtle.digest("SHA-256", new TextEncoder().encode(`${userId}\n${words}`));
    return [...new Uint8Array(digest)].slice(0, 16).map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  async function passAskedBefore(key) {
    if (!key) return "";
    const t = now().getTime();
    const seen = (await store.get(ASKED))?.[key];
    return seen && typeof seen.pass === "string" && t - Date.parse(seen.at) < SAME_QUESTION_MS && t >= Date.parse(seen.at) ? seen.pass : "";
  }
  async function rememberPass(key, pass) {
    if (!key) return;
    const t = now().getTime(), at = new Date(t).toISOString();
    await store.change(ASKED, (doc) => {
      const kept = Object.create(null);
      for (const [k, v] of Object.entries(doc || {})) if (v && t - Date.parse(v.at) < SAME_QUESTION_MS) kept[k] = v;
      kept[key] = { pass, at };
      return kept;
    });
  }

  /* The facts the server adds to a question (the list at the top of this file). */
  async function facts() {
    const record = (await priceList.current())?.data || null;
    const all = await lots.all();
    const open = all.filter((l) => l.active !== false).length;
    const team = (await store.all("people/")).filter((p) => p.active !== false).length;
    const status = await account.status();
    return {
      appVersion: line(appVersion, 100),
      business: line(record?.settings?.brand?.name || "", 120),
      ...(status ? { account: {
        canWrite: status.canWrite, reason: status.reason, lotLimit: status.lotLimit, openLots: status.openLots,
        checkedAt: status.checkedAt ?? null, expiresAt: status.expiresAt ?? null,
      } } : {}),
      lots: { open, closed: all.length - open },
      team,
      emailOn: !!emailOn,
      priceList: { saved: !!record, savedAt: record?.savedAt || "" },
      designerOpen: !!record && record.settings?.status !== "suspended" && (await account.designerOpen()),
    };
  }

  async function detailsFor(fromBrowser) {
    const b = fromBrowser && typeof fromBrowser === "object" && !Array.isArray(fromBrowser) ? fromBrowser : {};
    const details = { ...(await facts()), ...browserFacts(b) };
    while (details.errors.length && bytes(JSON.stringify(details)) > DETAILS_MAX) details.errors.pop();
    if (bytes(JSON.stringify(details)) > DETAILS_MAX) delete details.browser;
    return details;
  }

  /* ---- GET /api/office/help ---------------------------------------------------- */

  async function thread(who) {
    if (!connected) return { connected: false, canAsk: false, items: [] };
    if (!canAsk) return { connected: true, canAsk: false, items: [] };
    const left = deadline();
    const person = who.person;
    const seesAll = person.role === "owner" || person.role === "manager";
    let pass;
    try {
      pass = await passFor("thread", undefined, left);
    } catch (error) {
      log("Help: the control room gave no pass for the questions:", error?.status || error?.name || "Error");
      /* the control room refuses this Dealer Center's key: Help isn't set up for it */
      if (passTrouble(error) === "notSetUp") return { connected: true, canAsk: false, items: [] };
      return { connected: true, canAsk: true, items: null, problem: HELP_WORDS.listUnreachable };
    }
    let answer;
    try {
      /* a dealer's own questions only (the inbox picks them; checked again below) */
      answer = await send("thread", { pass, ...(seesAll ? {} : { askerId: person.userId }) }, left);
    } catch (error) {
      log("Help: Barnwright couldn't be reached for the questions:", error?.name || "Error");
      return { connected: true, canAsk: true, items: null, problem: HELP_WORDS.listUnreachable };
    }
    if (answer.status !== 200 || answer.data?.ok !== true || !Array.isArray(answer.data.items)) {
      log("Help: the Sales Inbox didn't give the questions; it answered", answer.status, codeOf(answer.data));
      return { connected: true, canAsk: true, items: null, problem: HELP_WORDS.listUnreachable };
    }
    const items = answer.data.items.slice(0, 30).map(cleanItem)
      .filter((item) => item && (seesAll || item.asker.id === person.userId))
      .sort((a, b) => String(b.at).localeCompare(String(a.at)));
    return { connected: true, canAsk: true, items };
  }

  /* ---- POST /api/office/help --------------------------------------------------- */

  /* who: people.member's answer -- the asker is always the person signed in */
  async function ask(who, data) {
    if (!connected) fail(409, HELP_WORDS.notConnected);
    if (!canAsk) fail(503, HELP_WORDS.notSetUp);
    const left = deadline();
    const words = textField(data?.text, 4000, "Your question", { required: true, multiline: true });
    const person = who.person;
    const replyTo = mailbox(person.email);
    if (!replyTo) fail(422, HELP_WORDS.badEmail);
    const question = {
      text: words,
      page: cleanPage(data?.page),
      asker: { id: person.userId, name: line(person.name || "", 80), email: replyTo, role: person.role },
      details: await detailsFor(data?.details),
    };
    const key = await sameQuestionKey(person.userId, words);
    let pass = await passAskedBefore(key);
    if (!pass) {
      try {
        pass = await passFor("question", subjectOf(words), left);
      } catch (error) {
        log("Help: the control room gave no pass for a question:", error?.status || error?.name || "Error");
        const why = passTrouble(error);
        fail(STATUS_OF[why], HELP_WORDS[why]);
      }
      /* not remembered (the store busy): the question still goes */
      try { await rememberPass(key, pass); } catch { /* only a repeat could make a second one */ }
    }
    let answer;
    try {
      answer = await send("ask", { pass, question }, left, { retry: true });
    } catch (error) {
      log("Help: the Sales Inbox couldn't be reached for a question:", error?.name || "Error");
      fail(503, HELP_WORDS.unreachable);
    }
    const d = answer.data;
    if ((answer.status !== 201 && answer.status !== 200) || d?.ok !== true || typeof d.id !== "string" || !d.id || d.id.length > 100) {
      log("Help: the Sales Inbox didn't take a question; it answered", answer.status, codeOf(d));
      const why = inboxTrouble(answer.status);
      fail(STATUS_OF[why], HELP_WORDS[why]);
    }
    return { ok: true, id: d.id, at: isoOr(d.at, now().toISOString()), email: person.email };
  }

  /* ---- POST /api/office/problem ------------------------------------------------- */

  /* Take a place for this kind of error: none when it went in the last 24
     hours or 10 went today. -> true when this report may go. */
  async function reserve(signature) {
    const t = now().getTime(), stamp = new Date(t).toISOString(), day = stamp.slice(0, 10);
    let mine = false;
    await store.change(PROBLEMS, (doc) => {
      mine = false;                                       /* this may run more than once */
      const seen = Object.create(null);
      for (const [sig, at] of Object.entries(doc?.seen || {})) if (t - Date.parse(at) < DAY) seen[sig] = at;
      const sent = doc?.day === day ? doc.sent || 0 : 0;
      if (seen[signature] || sent >= PROBLEMS_A_DAY) return KEEP;
      seen[signature] = stamp;
      mine = true;
      return { day, sent: sent + 1, seen };
    });
    return mine;
  }
  /* It didn't reach Barnwright: the next one like it may try again (today's count stays). */
  async function release(signature) {
    await store.change(PROBLEMS, (doc) => {
      if (!doc?.seen || !Object.hasOwn(doc.seen, signature)) return KEEP;
      const seen = Object.create(null);
      for (const [sig, at] of Object.entries(doc.seen)) if (sig !== signature) seen[sig] = at;
      return { ...doc, seen };
    });
  }

  function report(data, request) {
    if (!data || typeof data !== "object" || Array.isArray(data)) return null;
    if (typeof data.signature !== "string" || !SIGNATURE_RE.test(data.signature) || RESERVED.has(data.signature)) return null;
    if (data.area !== "designer" && data.area !== "dealer-center") return null;
    /* cleaned here too: no email, phone number, long code or query string, whatever the browser sent */
    const message = typeof data.message === "string" ? tidyMessage(data.message) : "";
    if (!message) return null;
    const t = now().getTime(), stamp = new Date(t).toISOString();
    /* a browser's clock can be wrong: a time more than a week old or in the future reads as now */
    const when = (value) => { const v = isoOr(value, stamp); const at = Date.parse(v); return at > t + 300_000 || at < t - 7 * DAY ? stamp : v; };
    return {
      signature: data.signature, message, where: cleanWhere(line(data.where, 400)), page: cleanPage(data.page), area: data.area,
      appVersion: line(appVersion, 100),
      browser: line(typeof data.browser === "string" ? data.browser : request?.headers?.get("user-agent") || "", 300),
      count: Number.isSafeInteger(data.count) && data.count > 0 ? Math.min(data.count, 1000) : 1,
      firstAt: when(data.firstAt), lastAt: when(data.lastAt),
    };
  }

  /* -> {sent}; index.js answers {ok: true} whatever this says */
  async function problem(request, data) {
    if (!canAsk) return { sent: false };
    const left = deadline();
    const one = report(data, request);
    if (!one || !(await reserve(one.signature))) return { sent: false };
    try {
      const answer = await send("problem", { pass: await passFor("problem", undefined, left), problem: one }, left);
      if ((answer.status === 200 || answer.status === 201) && answer.data?.ok === true) return { sent: true };
      log("Help: the Sales Inbox didn't take a problem report; it answered", answer.status, codeOf(answer.data));
    } catch (error) {
      log("Help: a problem report didn't reach Barnwright:", error?.status || error?.name || "Error");
    }
    await release(one.signature);
    return { sent: false };
  }

  return { connected, canAsk, ask, thread, problem };
}
