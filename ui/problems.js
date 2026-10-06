/* BROWSER PROBLEMS, PASSED ON TO BARNWRIGHT. Browser file: the 3D designer
   (ui/app.js) and the Dealer Center (ui/office/main.js) start it.

   When something on the page goes wrong that nothing caught (the window's
   "error" and "unhandledrejection"), this tells the site's own server
   (POST api/office/problem, server/office/help.js). A business connected
   to Barnwright passes it on to Barnwright's Sales Inbox; everywhere else
   the server drops it. What goes:
     signature  the same short code for the same error in the same place
                ("designer:" or "dealer-center:" and 16 letters and digits),
                so Barnwright sees one problem with a count, not a pile
     message    the error's own words, at most 300 characters, with any
                email address, phone number, long code, and the part of a
                web address after ? or #, taken out
     where      the script's path with line and column, no query string
     page       the page's path: on a 3D designer never the part after #
                (it holds the customer's building); on the Dealer Center the
                screen, never which customer, order or quote (screenOf)
     area, browser, count, firstAt, lastAt
   Never anything a customer typed. At most 3 reports per page load, each
   kind of error once (repeats only add to its count here). The Dealer
   Center's Help screen sends the recent ones with a question
   (recentProblems). A failure the page catches itself, so it can show its
   own words ("This page didn't load"), is passed on the same way
   (reportProblem).

   It never shows anything, never throws, only ever sends to this same
   site, and doesn't mind a site that has no such address (a static copy
   answers 404): the answer is never read. */

const MAX_SENT = 3;     /* reports per page load */
const KEEP = 20;        /* kinds of error remembered for the Help screen */

const state = { on: false, sent: 0, seen: new Map(), options: null };

/* options: {area: "designer" | "dealer-center", endpoint: an address on this
   site or () => one, page: () => the page's path, skip: () => true to keep
   reports here (the "try it" demo)}. -> true when it is watching. */
export function watchProblems(options = {}) {
  const w = typeof window === "undefined" ? null : window;
  if (state.on || !w || typeof w.addEventListener !== "function") return false;
  state.on = true;
  state.options = { area: "designer", endpoint: "/api/office/problem", page: () => location.pathname, skip: () => false, ...options };
  w.addEventListener("error", (event) => { try { note(fromError(event)); } catch { /* never in the way */ } });
  w.addEventListener("unhandledrejection", (event) => { try { note(fromRejection(event)); } catch { /* never in the way */ } });
  return true;
}

/* A failure the page caught itself (it shows its own words, like "This page
   didn't load"), passed on like one nothing caught. An answer from the
   server (it carries its status) is not a problem in the code. Never
   throws. */
export function reportProblem(error) {
  try { if (state.on) note(fromRejection({ reason: error })); } catch { /* never in the way */ }
}

/* The errors seen on this page so far, newest last (at most 10), for a
   question to Barnwright. */
export function recentProblems() {
  return [...state.seen.values()].slice(-10).map((p) => ({ message: p.message, where: p.where, at: p.lastAt, count: p.count }));
}

/* "#/customers/Ab12Cd34/orders/Ef56?new=1" -> "#/customers/:id/orders/:id":
   the Dealer Center's screen, never which customer, order or quote; and ""
   for anything after # that isn't a screen (a sign-in email's link). A
   screen already made this way stays the same. */
export function screenOf(hash) {
  const h = String(hash || "").split("?")[0];
  if (!/^#\/[A-Za-z0-9/:._-]*$/.test(h)) return "";
  return h.replace(/(\/(?:customers|orders|quotes|design))\/[^/#]+/g, "$1/:id").slice(0, 200);
}

/* An error's words, safe to send: no email addresses, phone numbers, long
   codes (a saved design, a sign-in) or what follows ? or # in a web
   address; one line, at most 300 characters. Only the first 1,000
   characters are read, so a huge message costs no time (an email address
   cut there still goes as "(email)"). The server cleans what it passes on
   the same way (server/office/help.js). */
export function tidyMessage(value) {
  const all = String(value ?? "");
  const start = all.length > 1000 ? all.slice(0, 1000).replace(/\S*@\S*$/, "(email)") : all;
  return start
    .replace(/\b([a-z][a-z0-9+.-]*:\/\/[^\s?#'"<>()]*)[?#][^\s'"<>()]*/gi, "$1")
    .replace(/[^\s@'"<>()[\]{},;:]+@[^\s@'"<>()[\]{},;:]+\.[a-z]{2,}/gi, "(email)")
    .replace(/[A-Za-z0-9_-]{40,}/g, "(code)")
    .replace(/\+?\d[\d ().-]{6,}\d/g, "(number)")
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ").trim().slice(0, 300);
}

/* "https://site/ui/app.js?v=2", 120, 7 -> "/ui/app.js:120:7" */
export function whereOf(file, line, column) {
  if (!file) return "";
  let path;
  try { path = new URL(String(file), location.href).pathname; } catch { path = String(file).split(/[?#]/)[0]; }
  const parts = [path];
  if (line > 0) { parts.push(line); if (column > 0) parts.push(column); }
  return parts.join(":").slice(0, 200);
}

/* the first place in a stack that names a script: "at f (https://site/ui/x.js:12:5)" */
function whereInStack(stack) {
  for (const m of String(stack || "").matchAll(/((?:[a-z][a-z0-9+.-]*:\/\/|\/)[^\s()@]*?):(\d+):(\d+)/gi)) {
    if (/^(?:chrome|moz|safari|safari-web)-extension:/i.test(m[1])) continue;
    return whereOf(m[1], Number(m[2]), Number(m[3]));
  }
  return "";
}

/* a short code for the same words in the same place (two 32-bit hashes) */
function code(text) {
  let a = 0x811c9dc5, b = 0x9747b28c;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = Math.imul(b ^ c, 0x5bd1e995) >>> 0;
  }
  return a.toString(16).padStart(8, "0") + b.toString(16).padStart(8, "0");
}

function made(message, where) {
  const words = tidyMessage(message);
  if (!words) return null;
  return { signature: `${state.options.area}:${code(`${words}|${where}`)}`, message: words, where };
}

function fromError(e) {
  if (!e) return null;
  const message = e.message || (e.error && e.error.message) || "";
  /* "Script error." is all a browser tells about another site's script */
  if (!message || /^Script error\.?$/i.test(message)) return null;
  if (/^(?:chrome|moz|safari|safari-web)-extension:/i.test(String(e.filename || ""))) return null;
  return made(message, whereOf(e.filename, e.lineno, e.colno));
}

function fromRejection(e) {
  const r = e ? e.reason : undefined;
  /* an answer from the server (the Dealer Center's ApiError carries its
     status) or a cancelled request is not a problem in the code */
  if (r && typeof r === "object" && (typeof r.status === "number" || r.name === "AbortError")) return null;
  const message = r && typeof r.message === "string" ? `${r.name || "Error"}: ${r.message}`
    : typeof r === "string" ? r : "A promise failed without saying why";
  return made(message, whereInStack(r && r.stack));
}

function note(problem) {
  if (!problem) return;
  const at = new Date().toISOString();
  const known = state.seen.get(problem.signature);
  if (known) { known.count++; known.lastAt = at; return; }
  const entry = { ...problem, count: 1, firstAt: at, lastAt: at };
  state.seen.set(problem.signature, entry);
  while (state.seen.size > KEEP) state.seen.delete(state.seen.keys().next().value);
  if (state.sent >= MAX_SENT || state.options.skip()) return;
  state.sent++;
  send(entry);
}

function send(entry) {
  const o = state.options;
  let address;
  try {
    address = new URL(typeof o.endpoint === "function" ? o.endpoint() : o.endpoint, location.href);
    if (!/^https?:$/.test(location.protocol) || address.origin !== location.origin) return;   /* this site's own server only */
  } catch { return; }
  let page = "";
  try { page = String(o.page() || "").split("?")[0].slice(0, 200); } catch { page = ""; }
  const body = JSON.stringify({
    signature: entry.signature, message: entry.message, where: entry.where, page, area: o.area,
    browser: String((typeof navigator !== "undefined" && navigator.userAgent) || "").slice(0, 300),
    count: entry.count, firstAt: entry.firstAt, lastAt: entry.lastAt,
  });
  try {
    const go = window.fetch;   /* looked up now: the "try it" demo answers inside the page */
    if (typeof go !== "function") return;
    Promise.resolve(go.call(window, address.href, {
      method: "POST", credentials: "same-origin", keepalive: true, cache: "no-store",
      headers: { "Content-Type": "application/json" }, body,
    })).then(() => {}, () => {});
  } catch { /* nothing to do */ }
}
