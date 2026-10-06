/* CHECK: HELP -- QUESTIONS TO BARNWRIGHT, THEIR ANSWERS, AND PROBLEM REPORTS.
   Run: node tools/check-help.mjs   (check-all: node)

   WHY. Alan asked for a Help button inside the software (no phone number),
   short help answers, and problem alerts (Oct 2026). A question must go to
   Barnwright from the person really signed in, with only the facts it
   promises -- never a customer, a price, the price list, an order or a key
   -- even while changes are stopped, and say in plain words when Barnwright
   can't be reached. Each person sees the questions they should: the owner
   and managers every one, a dealer their own. A browser problem must reach
   Barnwright once, never a flood. The short answers must name only buttons
   that really are on the screens.

   HOW. The real Dealer Center server (createOffice) runs on the sample
   business (Sample Storage Barns) in memory, connected to a pretend control
   room (tools/lib/fake-control-room.mjs) and a pretend Sales Inbox
   (tools/lib/fake-help-inbox.mjs): fetch stubs in this process that check
   every pass the way the real ones do (the control room's signature, the
   kind, the times). The browser's problem reporter (ui/problems.js) runs on
   a pretend window. Nothing is sent anywhere.

   WHAT IT PROVES:
    1. Not connected (Alan's own business, this computer, the demo): no
       asking (plain words with the email), problems dropped, nothing sent.
    2. A question: the pass request and the inbox request, field for field;
       the asker is the sign-in, never the body; the details hold only the
       promised facts, no customers, prices, orders or keys.
    3. Who sees which questions: owner and manager all, a dealer their own.
    4. Asking works while changes are stopped.
    5. Plain words when the control room or the inbox can't be reached, for
       "too many today", and for the list; a dropped connection is retried
       with the same pass and makes one question; nothing typed is logged.
    6. Help not set up yet (some settings missing, a wrong inbox address).
    7. Problem reports: one send per kind in 24 hours, at most 10 a day for
       the site, always {ok: true}, same site only.
    8. The browser's reporter: at most 3 a page, trimmed, no query strings,
       nothing typed, same site only, quiet when the address answers 404.
    9. Every page's security policy lets a page talk to its own site.
   10. The short answers: 10 to 14, every button they name is on a screen,
       every link opens a real screen, no slashes; the screen's words match
       the server's. */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve as resolvePath, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createOffice } from "../server/office/index.js";
import { MemoryBlobs } from "../server/office/store.js";
import { seedSample, SAMPLE_PEOPLE } from "../server/office/sample.js";
import { TenantLicenseClient, createLeaseStore, misconfiguredLicense } from "../server/office/control-room.js";
import { HELP_WORDS, SUPPORT_EMAIL, inboxOrigin, mailbox } from "../server/office/help.js";
import { OFFICE_POLICY, lotDesignerPolicy } from "../server/office/pages.js";
import { parseHeaders, designerCsp } from "./build-headers.mjs";
import { fakeControlRoom } from "./lib/fake-control-room.mjs";
import { fakeHelpInbox } from "./lib/fake-help-inbox.mjs";
import { ANSWERS, HELP_SCREEN, SUPPORT_EMAIL as SCREEN_EMAIL, answersFor, findAnswers } from "../ui/office/help-answers.js";

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), "..");
const J = (p) => JSON.parse(readFileSync(resolvePath(ROOT, p), "utf8"));
const manufacturer = J("library/manufacturers/standard.json"), library = J("library/construction.json");
const templates = { full: J("companies/demo/company.json"), small: J("companies/starter/company.json") };

let passed = 0;
const failed = [];
function ok(what, cond, extra = "") {
  if (cond) { passed++; return true; }
  failed.push(what);
  console.log(`  FAIL ${what}${extra ? `\n       ${extra}` : ""}`);
  return false;
}
const section = (t) => console.log(`\n${t}`);
const HOUR = 3600_000, DAY = 24 * HOUR;
const BASE = "https://samplebarns.test";

/* ---- the sample business, and who is signed in ------------------------------------------- */
const blobs = new MemoryBlobs();
const clock = { at: null };
let shift = 0;
const now = () => clock.at || new Date(Date.now() + shift);
const roomClock = { get t() { return now().getTime(); } };
const USERS = Object.fromEntries(SAMPLE_PEOPLE.map((p) => [p.email, { id: p.id, email: p.email, name: p.name, confirmedAt: "2026-01-01T00:00:00Z", emailVerified: true }]));
const EMAIL = Object.fromEntries(SAMPLE_PEOPLE.map((p) => [p.role === "dealer" ? p.email.split("@")[0] : p.role, p.email]));   /* owner, manager, mike, dana, lee */
let acting = null;
const logged = [];
const base = {
  blobs, identityUser: async () => (acting ? USERS[acting] || null : null), ownerEmail: SAMPLE_PEOPLE[0].email,
  manufacturer, library, templates, now, log: (...a) => logged.push(a.map((x) => String(x?.stack || x)).join(" ")),
};
await seedSample({ office: createOffice(base), clock, manufacturer, library, act: (p) => { acting = p ? p.email : null; } });

/* every fetch nobody stubbed is written down here (and fails) */
const stray = [];
globalThis.fetch = async (url) => { stray.push(String(url)); throw new TypeError("This check sends nothing anywhere"); };

let office = createOffice({ ...base, appVersion: "dealer-center check" });
async function call(method, path, body, { as = acting, origin = BASE, type, app = office } = {}) {
  const was = acting;
  acting = as;
  const headers = {};
  if (origin) headers.origin = origin;
  if (body !== undefined) headers["content-type"] = type || "application/json";
  const r = await app.handle(new Request(BASE + path, { method, headers, body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body) }), { clientIp: "203.0.113.7" });
  acting = was;
  const text = await r.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: r.status, data };
}
const ask = (as, text, more = {}) => call("POST", "/api/office/help", { text, page: "#/price-list", details: { browser: "Mozilla/5.0 (check)", screen: "390x844", language: "en-US", timezone: "America/New_York", errors: [] }, ...more }, { as });
const list = (as, app) => call("GET", "/api/office/help", undefined, { as, app });
const report = (body, opts = {}) => call("POST", "/api/office/problem", body, { as: null, ...opts });

/* ---- 1 ---------------------------------------------------------------------------------- */
section("1. Not connected to Barnwright (Alan's own business, this computer, the demo)");
let r = await list(EMAIL.owner);
ok("GET help says not connected, can't ask, no questions", r.status === 200 && r.data.connected === false && r.data.canAsk === false && Array.isArray(r.data.items) && r.data.items.length === 0, JSON.stringify(r.data));
r = await ask(EMAIL.mike, "Where do quotes go?");
ok("asking is refused in plain words that give the email to write to", r.status === 409 && r.data.error === HELP_WORDS.notConnected && r.data.error.includes(SUPPORT_EMAIL), JSON.stringify(r.data));
r = await report({ signature: "dealer-center:00aa11bb22cc33dd", message: "TypeError: x is undefined", where: "/ui/office/main.js:1:2", page: "/dealer#/", area: "dealer-center" });
ok("a problem report is answered {ok: true} and dropped quietly", r.status === 200 && r.data.ok === true);
ok("... and nothing at all was sent anywhere", stray.length === 0, stray.join(" "));
ok("the screen's line and the server's refusal say the same, with the same email", HELP_SCREEN.notConnected === HELP_WORDS.notConnected && HELP_SCREEN.notSetUp === HELP_WORDS.notSetUp && SCREEN_EMAIL === SUPPORT_EMAIL);

/* ---- the business connected to a pretend control room and a pretend Sales Inbox ---------- */
const room = fakeControlRoom({ clock: roomClock, dealerLimit: 3 });
const inbox = fakeHelpInbox({ clock: roomClock, publicKeyPem: room.publicKeyPem });
const license = new TenantLicenseClient({
  controlRoomUrl: room.origin, customerId: room.business.id, siteId: room.business.siteId,
  activationKey: room.business.key, publicKeyPem: room.publicKeyPem,
  store: createLeaseStore(room.business.id, room.business.siteId, blobs), fetch: room.fetch, now: () => now().getTime(),
});
const connectedWith = (more) => createOffice({ ...base, license, help: { url: inbox.origin, fetch: inbox.fetch }, appVersion: "dealer-center check", ...more });
/* the same business's check-in, reaching the control room through `fetch` */
const licenseWith = (fetch) => new TenantLicenseClient({
  controlRoomUrl: room.origin, customerId: room.business.id, siteId: room.business.siteId,
  activationKey: room.business.key, publicKeyPem: room.publicKeyPem,
  store: createLeaseStore(room.business.id, room.business.siteId, blobs), fetch, now: () => now().getTime(),
});
office = connectedWith();
await call("GET", "/api/office/me", undefined, { as: EMAIL.owner });   /* the first check-in */
const decode = (pass) => JSON.parse(Buffer.from(pass.split(".")[0], "base64url").toString("utf8"));
const lastCall = (path) => [...inbox.calls].reverse().find((c) => c.path === path);
const callsTo = (path) => inbox.calls.filter((c) => c.path === path).length;

/* ---- 2 ---------------------------------------------------------------------------------- */
section("2. A question goes to Barnwright from the person signed in, with only the promised facts");
const customers = await office.parts.store.all("customers/");
const someone = customers.find((c) => c.orders.length);
const words = "How do I add a 12×32 size to the Lofted Barn?\nI looked on the price list under Buildings and Options but couldn't find where the sizes are. (zebra-question)";
r = await call("POST", "/api/office/help", {
  text: words,
  page: `#/customers/${someone.id}/orders/${someone.orders[0].id}?tab=2`,
  details: {
    browser: "Mozilla/5.0 (check)", screen: "1280x900", language: "en-US", timezone: "America/New_York",
    errors: [{ message: "TypeError: x is undefined", where: "https://samplebarns.test/ui/office/main.js?v=3:120:7", at: new Date().toISOString(), count: 2 }],
    customers: customers.slice(0, 3).map((c) => ({ name: c.name, phone: c.phone })), business: "Forged Sheds", team: 99,
    priceList: { offer: { LB: { sizes: { "10x16": 1 } } } }, account: { canWrite: true, reason: "active" }, key: room.business.key,
  },
  asker: { id: "sample-mike", name: "Forged Name", email: "forged@evil.example", role: "owner" },
}, { as: EMAIL.owner });
ok("the owner's question is taken (201) and the answer gives the email Barnwright will write to", r.status === 201 && r.data.ok === true && typeof r.data.id === "string" && r.data.email === EMAIL.owner, JSON.stringify(r.data));
const passAsk = room.calls.at(-1) === "/api/help-pass" && room.helpPasses.at(-1);
const flat = words.replace(/\s+/g, " ");
ok("the control room was asked for a question's pass, with the question's first words (at most 120 characters, one line)",
  passAsk && passAsk.kind === "question" && flat.length > 120 && passAsk.subject.length <= 120 && passAsk.subject.endsWith("…")
  && flat.startsWith(passAsk.subject.slice(0, -1)) && passAsk.subject.length > 60 && !/\n/.test(passAsk.subject), JSON.stringify(passAsk));
const sentAsk = lastCall("/help/v1/ask");
ok("the inbox got POST /help/v1/ask as JSON, with no cookies, never following a redirect",
  sentAsk.method === "POST" && sentAsk.headers["content-type"] === "application/json" && !sentAsk.headers.cookie && sentAsk.redirect === "error" && sentAsk.signal instanceof AbortSignal, JSON.stringify(sentAsk.headers));
ok("... with exactly {pass, question: {text, page, asker, details}}", JSON.stringify(Object.keys(sentAsk.body)) === '["pass","question"]'
  && JSON.stringify(Object.keys(sentAsk.body.question)) === '["text","page","asker","details"]', JSON.stringify(Object.keys(sentAsk.body.question)));
const claims = decode(sentAsk.body.pass);
ok("... carrying the control room's own pass for this business, unchanged (the inbox checked its signature)",
  claims.purpose === "help-pass" && claims.kind === "question" && claims.customerId === room.business.id && claims.siteId === room.business.siteId
  && inbox.questions.at(-1).passId === claims.id, JSON.stringify(claims).slice(0, 160));
const q = sentAsk.body.question;
ok("the question is what the person typed", q.text === words);
ok("the asker is the person signed in (Chris, the owner), never what the browser said", JSON.stringify(q.asker) === JSON.stringify({ id: "sample-chris", name: "Chris Walker", email: EMAIL.owner, role: "owner" }), JSON.stringify(q.asker));
ok("the page is the screen only: no customer or order id, no query string", q.page === "#/customers/:id/orders/:id", q.page);
{
  const before = inbox.questions.length;
  await call("POST", "/api/office/help", { text: "A question from a sign-in link's page", page: "#invite_token=SECRET123abc" }, { as: EMAIL.owner });
  ok("a page that isn't a screen (a sign-in email's link) goes as nothing at all", inbox.questions.length === before + 1 && inbox.questions.at(-1).page === "" && !JSON.stringify(lastCall("/help/v1/ask").body).includes("SECRET123abc"), inbox.questions.at(-1).page);
}
const ALLOWED = ["appVersion", "business", "account", "lots", "team", "emailOn", "priceList", "designerOpen", "browser", "screen", "language", "timezone", "errors"];
const d = q.details;
ok("the details hold only the promised facts", Object.keys(d).every((k) => ALLOWED.includes(k)) && Object.keys(d.account).every((k) => ["canWrite", "reason", "lotLimit", "openLots", "checkedAt", "expiresAt"].includes(k))
  && JSON.stringify(Object.keys(d.priceList)) === '["saved","savedAt"]' && JSON.stringify(Object.keys(d.lots)) === '["open","closed"]', JSON.stringify(Object.keys(d)));
ok("... and the server's facts come from the server, not the browser", d.business === "Sample Storage Barns" && d.team === 5 && d.lots.open === 3 && d.lots.closed === 0
  && d.account.canWrite === true && d.account.reason === "active" && d.account.lotLimit === 3 && d.account.openLots === 3
  && d.priceList.saved === true && Number.isFinite(Date.parse(d.priceList.savedAt)) && d.designerOpen === true && d.emailOn === false && d.appVersion === "dealer-center check", JSON.stringify(d));
ok("... the browser's own facts are kept, and its errors without the site's name or query string",
  d.browser === "Mozilla/5.0 (check)" && d.screen === "1280x900" && d.language === "en-US" && d.timezone === "America/New_York"
  && JSON.stringify(d.errors) === JSON.stringify([{ message: "TypeError: x is undefined", where: "/ui/office/main.js:120:7", at: d.errors[0]?.at, count: 2 }]), JSON.stringify(d.errors));
const detailsJson = JSON.stringify(d);
const everything = JSON.stringify(sentAsk.body);
const people = customers.flatMap((c) => [c.name, c.phone, c.email, c.address].filter((x) => x && String(x).length > 3));
ok("no customer anywhere in what was sent: none of the 30 names, phones, emails or addresses", !people.some((x) => everything.includes(x)), people.find((x) => everything.includes(x)));
ok("no order, quote or customer id either", !customers.some((c) => everything.includes(c.id) || c.orders.some((o) => everything.includes(o.id)) || c.quotes.some((x) => everything.includes(x.id))));
const settings = (await office.parts.store.get("price-list")).settings;
const priceNumbers = new Set();
(function walk(v) { if (typeof v === "number" && v >= 100) priceNumbers.add(v); else if (v && typeof v === "object") Object.values(v).forEach(walk); })({ offer: settings.offer, items: settings.items, options: settings.options });
const detailNumbers = [];
(function walk(v) { if (typeof v === "number") detailNumbers.push(v); else if (v && typeof v === "object") Object.values(v).forEach(walk); })(d);
const styleNames = Object.keys(settings.offer).map((k) => manufacturer.styles[k]?.name || settings.offer[k].name).filter(Boolean);
ok(`no prices or price list in the details (none of the ${priceNumbers.size} prices, no style names, no sizes)`,
  !detailNumbers.some((n) => n < 1e9 && priceNumbers.has(n)) && !styleNames.some((n) => detailsJson.includes(n)) && !/offer|sizes|"10x16"/.test(detailsJson), detailNumbers.join(","));
ok("no keys: not the activation key, not a sign-in, not the forged fields", !everything.includes(room.business.key) && !/bwk_|Forged|forged@|"key"/.test(everything) && !detailsJson.includes("@"));
ok("the details stay under the inbox's 8 KB", Buffer.byteLength(detailsJson) <= 8000, String(Buffer.byteLength(detailsJson)));

/* ---- 3 ---------------------------------------------------------------------------------- */
section("3. Who sees which questions: the owner and managers all, a dealer their own");
r = await ask(EMAIL.mike, "A customer on the Riverside lot can't open the designer link. What should I check?");
ok("a dealer can ask", r.status === 201 && r.data.email === EMAIL.mike, JSON.stringify(r.data));
const mikeQ = r.data.id;
ok("... as themselves", inbox.questions.at(-1).asker.id === "sample-mike" && inbox.questions.at(-1).asker.role === "dealer");
r = await ask(EMAIL.dana, "How do I print an order sheet?");
ok("another dealer can ask", r.status === 201);
r = await ask(EMAIL.manager, "Can a manager download the customers?");
ok("a manager can ask", r.status === 201);
inbox.answer(mikeQ, "Open Lots and check that Riverside says Open. If it says Closed, the owner taps Open lot.");
const mine = await list(EMAIL.mike);
ok("Mike (a dealer) sees only his own question", mine.status === 200 && mine.data.connected === true && mine.data.canAsk === true
  && mine.data.items.length === 1 && mine.data.items[0].id === mikeQ, JSON.stringify(mine.data).slice(0, 200));
ok("... with Barnwright's answer, marked answered", mine.data.items[0].status === "answered" && /Open lot/.test(mine.data.items[0].replies[0]?.text || ""));
ok("... and nothing but what the screen shows (no email, no details, no pass)", JSON.stringify(Object.keys(mine.data.items[0])) === '["id","at","text","page","asker","status","replies"]'
  && JSON.stringify(Object.keys(mine.data.items[0].asker)) === '["id","name"]');
const danas = await list(EMAIL.dana);
ok("Dana (another dealer) sees only hers", danas.data.items.length === 1 && danas.data.items[0].asker.id === "sample-dana");
for (const role of ["owner", "manager"]) {
  const all = await list(EMAIL[role]);
  /* Chris asked 2, Mike, Dana and Sarah 1 each */
  ok(`the ${role} sees every question from the business, newest first (${all.data.items.length})`, all.data.items.length === inbox.questions.length && inbox.questions.length === 5
    && all.data.items.every((x, i, a) => i === 0 || a[i - 1].at >= x.at) && new Set(all.data.items.map((x) => x.asker.id)).size === 4, JSON.stringify(all.data.items.map((x) => x.asker.id)));
}
r = await list(null);
ok("someone not signed in sees nothing (401)", r.status === 401);

/* ---- 4 ---------------------------------------------------------------------------------- */
section("4. Asking works while changes are stopped");
room.business.status = "deactivated";
shift += 7 * HOUR;
let m = (await call("GET", "/api/office/me", undefined, { as: EMAIL.owner })).data;
ok("Barnwright switched the account off: changes are stopped", m.account.canWrite === false && m.account.reason === "deactivated", JSON.stringify(m.account));
ok("... really stopped (adding a customer answers 423)", (await call("POST", "/api/office/customers", { lot: "riverside", name: "Too Late", phone: "5550100999" }, { as: EMAIL.mike })).status === 423);
r = await ask(EMAIL.mike, "Why can't I save anything?");
ok("a dealer can still ask Barnwright", r.status === 201, JSON.stringify(r.data));
ok("... with the account's state in the details", lastCall("/help/v1/ask").body.question.details.account.canWrite === false && lastCall("/help/v1/ask").body.question.details.account.reason === "deactivated" && lastCall("/help/v1/ask").body.question.details.designerOpen === false);
ok("... and still read the answers", (await list(EMAIL.mike)).data.items.length === 2);
room.business.status = "active";
shift += 7 * HOUR;
m = (await call("GET", "/api/office/me", undefined, { as: EMAIL.owner })).data;
ok("switched back on", m.account.canWrite === true);

/* ---- 5 ---------------------------------------------------------------------------------- */
section("5. Plain words when Barnwright can't be reached");
const askedBefore = inbox.questions.length;
room.down = true;
let inboxCalls = inbox.calls.length;
r = await ask(EMAIL.mike, "Is the control room down? (zebra-question)");
ok(`the control room can't be reached: "${HELP_WORDS.unreachable}"`, r.status === 503 && r.data.error === HELP_WORDS.unreachable, JSON.stringify(r.data));
ok("... and nothing went to the inbox", inbox.calls.length === inboxCalls);
r = await list(EMAIL.mike);
ok("the list says so calmly: items null and the words", r.status === 200 && r.data.items === null && r.data.problem === HELP_WORDS.listUnreachable, JSON.stringify(r.data));
room.down = false;
inbox.down = true;
r = await ask(EMAIL.mike, "Is the inbox down? (zebra-question)");
ok("the inbox can't be reached: the same plain words", r.status === 503 && r.data.error === HELP_WORDS.unreachable);
r = await list(EMAIL.owner);
ok("... and the list: items null and the words", r.status === 200 && r.data.connected === true && r.data.items === null && r.data.problem === HELP_WORDS.listUnreachable);
inbox.down = false;
for (const [status, what] of [[503, "busy"], [500, "broken"]]) {
  inbox.nextStatus = { path: "ask", status };
  r = await ask(EMAIL.mike, `Inbox ${what} (zebra-question)`);
  ok(`the inbox ${what} (${status}): the same plain words`, r.status === 503 && r.data.error === HELP_WORDS.unreachable, JSON.stringify(r));
}
/* a refusal it will give every time: never "try again", always the email */
for (const [status, what] of [[401, "refusing the pass"], [400, "refusing the question"], [413, "finding it too big"]]) {
  inbox.nextStatus = { path: "ask", status };
  r = await ask(EMAIL.mike, `Inbox ${what} (zebra-question)`);
  ok(`the inbox ${what} (${status}): "${HELP_WORDS.refused}"`, r.status === 422 && r.data.error === HELP_WORDS.refused && r.data.error.includes(SUPPORT_EMAIL), JSON.stringify(r));
}
inbox.nextStatus = { path: "ask", status: 429 };
r = await ask(EMAIL.mike, "One more question (zebra-question)");
ok(`too many questions today (429): "${HELP_WORDS.tooMany}"`, r.status === 429 && r.data.error === HELP_WORDS.tooMany && /from your business today/.test(r.data.error) && r.data.error.includes(SUPPORT_EMAIL), JSON.stringify(r.data));
inbox.nextStatus = { path: "thread", status: 500 };
r = await list(EMAIL.owner);
ok("a broken list answer: items null and the words", r.data.items === null && r.data.problem === HELP_WORDS.listUnreachable);
ok("none of those failures stored a question", inbox.questions.length === askedBefore);
inbox.dropAfterNextAsk = true;
inboxCalls = callsTo("/help/v1/ask");
r = await ask(EMAIL.dana, "The connection dropped after the inbox took this one.");
const twoTries = inbox.calls.filter((c) => c.path === "/help/v1/ask").slice(-2);
ok("a connection that drops after the inbox took the question is tried once more, with the same pass", r.status === 201
  && callsTo("/help/v1/ask") === inboxCalls + 2 && twoTries[0].body.pass === twoTries[1].body.pass, JSON.stringify(r.data));
ok("... and it is one question, not two", inbox.questions.length === askedBefore + 1 && inbox.questions.at(-1).id === r.data.id);
let limitHit = null;
for (let i = 0; i < 60 && !limitHit; i++) {
  const x = await ask(EMAIL.lee, `Question number ${i + 1} today`);
  if (x.status !== 201) limitHit = x;
}
ok("the inbox's own daily limit (50 questions a business) comes back in the same plain words", limitHit?.status === 429 && limitHit.data.error === HELP_WORDS.tooMany && inbox.questions.filter((x) => x.at.slice(0, 10) === inbox.questions.at(-1).at.slice(0, 10)).length === 50, JSON.stringify(limitHit));
r = await ask(EMAIL.mike, "");
ok("an empty question: \"Your question is needed.\"", r.status === 422 && r.data.error === "Your question is needed.", JSON.stringify(r.data));
r = await ask(EMAIL.mike, "x".repeat(4001));
ok("a question over 4,000 characters is refused in plain words", r.status === 422 && r.data.error === "Your question is too long (at most 4000 characters).", JSON.stringify(r.data));
r = await ask(EMAIL.mike, "bad\u0007bell");
ok("... and one with characters that can't be saved", r.status === 422 && /characters we can't save/.test(r.data.error));
{
  /* an inbox that never answers: given up on in time */
  const hanging = connectedWith({ help: { url: inbox.origin, timeoutMs: 50, fetch: async (_url, init) => new Promise((_done, fail) => init.signal.addEventListener("abort", () => fail(init.signal.reason))) } });
  const awake = setTimeout(() => {}, 5000);   /* Node's timeout signal alone doesn't keep a check running */
  r = await call("POST", "/api/office/help", { text: "Anyone there? (zebra-question)" }, { as: EMAIL.mike, app: hanging });
  clearTimeout(awake);
  ok("an inbox that doesn't answer in time: the same plain words", r.status === 503 && r.data.error === HELP_WORDS.unreachable);
}
ok("nothing anybody typed was ever written to the log", !logged.some((l) => /zebra-question|Lofted Barn|Question number/.test(l)), logged.find((l) => /zebra|Lofted|Question number/.test(l)));
ok("... while each failure was logged in a few words", logged.some((l) => /Help: the Sales Inbox couldn't be reached/.test(l)) && logged.some((l) => /control room gave no pass/.test(l)));

/* ---- 6 ---------------------------------------------------------------------------------- */
section("6. Help not set up yet");
for (const [what, app] of [
  ["some control room settings missing", connectedWith({ license: misconfiguredLicense() })],
  ["no Sales Inbox given", connectedWith({ help: null })],
  ["a Sales Inbox address that isn't https", connectedWith({ help: { url: "http://inbox.barnwrightsoftware.com", fetch: inbox.fetch } })],
  ["a Sales Inbox address with a path", connectedWith({ help: { url: "https://inbox.barnwrightsoftware.com/help/v1", fetch: inbox.fetch } })],
]) {
  const before = inbox.calls.length;
  const listed = await list(EMAIL.owner, app);
  const asked = await call("POST", "/api/office/help", { text: "Hello?" }, { as: EMAIL.owner, app });
  ok(`${what}: connected, can't ask, plain words with the email, nothing sent`, listed.data.connected === true && listed.data.canAsk === false
    && asked.status === 503 && asked.data.error === HELP_WORDS.notSetUp && inbox.calls.length === before, JSON.stringify([listed.data, asked.data]));
}
ok("BARNWRIGHT_HELP_URL: https only, nothing after the name; plain http only for localhost on a computer",
  inboxOrigin("https://inbox.barnwrightsoftware.com") === "https://inbox.barnwrightsoftware.com" && inboxOrigin("http://localhost:8899", { allowLocal: true }) === "http://localhost:8899"
  && [["http://inbox.barnwrightsoftware.com"], ["http://localhost:8899"], ["https://inbox.barnwrightsoftware.com/x"], ["https://inbox.barnwrightsoftware.com?x=1"], ["https://user:pw@inbox.barnwrightsoftware.com"], ["http://evil.example", { allowLocal: true }], ["not an address"]]
    .every(([u, o]) => { try { inboxOrigin(u, o); return false; } catch { return true; } }));

/* ---- 7 ---------------------------------------------------------------------------------- */
section("7. Problem reports: once per kind in 24 hours, at most 10 a day, always {ok: true}");
/* a fresh day, half an hour past midnight (UTC) */
const nextDay = (t) => Math.ceil((t + 1) / DAY) * DAY + 30 * 60_000;
shift += nextDay(Date.now() + shift) - (Date.now() + shift);
const problem = (n, more = {}) => ({ signature: `designer:${String(n).padStart(16, "0")}`, message: `TypeError: thing ${n} is undefined`, where: "https://samplebarns.test/ui/app.js?v=9:120:7", page: "/d/riverside/", area: "designer", appVersion: "forged 9.9", browser: "Mozilla/5.0 (check)", count: 1, ...more });
let problemsSent = callsTo("/help/v1/problem");
r = await report(problem(1));
const sentProblem = lastCall("/help/v1/problem");
ok("a report from a page on this site, with no sign-in, is answered {ok: true}", r.status === 200 && JSON.stringify(r.data) === '{"ok":true}', JSON.stringify(r));
ok("... and reaches the inbox with a problem pass", callsTo("/help/v1/problem") === problemsSent + 1 && decode(sentProblem.body.pass).kind === "problem" && room.helpPasses.at(-1).kind === "problem" && room.helpPasses.at(-1).subject === null);
const p = sentProblem.body.problem;
ok("... in the inbox's shape, the server's version (not the page's), no site name or query string in where",
  p.signature === "designer:0000000000000001" && p.message === "TypeError: thing 1 is undefined" && p.where === "/ui/app.js:120:7" && p.page === "/d/riverside/"
  && p.area === "designer" && p.appVersion === "dealer-center check" && p.browser === "Mozilla/5.0 (check)" && p.count === 1
  && Number.isFinite(Date.parse(p.firstAt)) && Number.isFinite(Date.parse(p.lastAt)) && inbox.problems.at(-1).signature === p.signature, JSON.stringify(p));
problemsSent = callsTo("/help/v1/problem");
r = await report(problem(1, { message: "TypeError: thing 1 is undefined", count: 3 }));
ok("the same kind of problem again: {ok: true}, nothing sent (once in 24 hours)", r.data.ok === true && callsTo("/help/v1/problem") === problemsSent);
for (let n = 2; n <= 15; n++) await report(problem(n));
ok("15 kinds in one day: exactly 10 sent, the rest dropped quietly", callsTo("/help/v1/problem") === problemsSent + 9, String(callsTo("/help/v1/problem") - problemsSent + 1));
problemsSent = callsTo("/help/v1/problem");
shift += DAY;
r = await report(problem(16));
ok("the next day, reports go again", r.data.ok === true && callsTo("/help/v1/problem") === problemsSent + 1);
r = await report(problem(1));
ok("... and after 24 hours the same kind goes again", callsTo("/help/v1/problem") === problemsSent + 2);
problemsSent = callsTo("/help/v1/problem");
const dropped = [
  ["a signature with other characters", problem(20, { signature: "designer:bad sig!" })],
  ["a signature over 120 characters", problem(21, { signature: "d".repeat(121) })],
  ["the signature __proto__", problem(22, { signature: "__proto__" })],
  ["no message", problem(23, { message: "" })],
  ["a page area it doesn't know", problem(24, { area: "control-room" })],
  ["a list instead of a report", [problem(25)]],
];
for (const [what, body] of dropped) {
  r = await report(body);
  ok(`${what}: {ok: true}, nothing sent`, r.status === 200 && r.data.ok === true && callsTo("/help/v1/problem") === problemsSent, JSON.stringify(r));
}
r = await report("signature=designer:1&message=x", { type: "application/x-www-form-urlencoded" });
ok("a form post instead of JSON: {ok: true}, nothing sent", r.status === 200 && r.data.ok === true && callsTo("/help/v1/problem") === problemsSent);
r = await report("{\"signature\":", {});
ok("a broken body: {ok: true}, nothing sent", r.status === 200 && r.data.ok === true && callsTo("/help/v1/problem") === problemsSent);
r = await report(problem(26), { origin: "https://evil.example" });
ok("from another website: refused (403), nothing sent", r.status === 403 && callsTo("/help/v1/problem") === problemsSent);
r = await report(problem(27), { origin: null });
ok("with no Origin at all: refused (403), nothing sent", r.status === 403 && callsTo("/help/v1/problem") === problemsSent);
room.down = true;
r = await report(problem(28));
ok("the control room down: {ok: true}, nothing reached the inbox", r.data.ok === true && callsTo("/help/v1/problem") === problemsSent);
room.down = false;
r = await report(problem(28));
ok("... and the same problem goes once it's back (a report that didn't arrive doesn't count as sent)", callsTo("/help/v1/problem") === problemsSent + 1);
inbox.nextStatus = { path: "problem", status: 503 };
r = await report(problem(29));
ok("the inbox busy (503): {ok: true}", r.data.ok === true);
r = await report(problem(29));
ok("... and the next one like it tries again", callsTo("/help/v1/problem") === problemsSent + 3 && inbox.problems.some((x) => x.signature === problem(29).signature));
r = await report(problem(40, { page: "/dealer#confirmation_token=SECRET456def" }));
ok("a problem's page keeps its path and drops a sign-in email's link", lastCall("/help/v1/problem").body.problem.page === "/dealer" && !JSON.stringify(lastCall("/help/v1/problem").body).includes("SECRET456def"), lastCall("/help/v1/problem").body.problem.page);
const doc = await office.parts.store.get("barnwright-help-problems");
ok("what was sent is kept in the business's own store (today's count and when each kind went)", doc && typeof doc.sent === "number" && doc.seen && Object.keys(doc.seen).includes(problem(28).signature), JSON.stringify(doc).slice(0, 200));
ok("nothing sent in this check ever went anywhere but the pretend control room and inbox", stray.length === 0, stray.join(" "));

/* ---- 8 ---------------------------------------------------------------------------------- */
section("8. The browser's problem reporter (ui/problems.js), on a pretend page");
const SITE = "https://samplebarns.test";
const posts = [];
let answerWith = async () => new Response("Not found", { status: 404 });
const page = new EventTarget();
page.fetch = async (url, init) => { posts.push({ url: String(url), init, body: JSON.parse(init.body) }); return answerWith(); };
globalThis.window = page;
globalThis.location = { href: `${SITE}/d/riverside/?company=demo#d=Abc123${"x".repeat(80)}`, origin: SITE, protocol: "https:", pathname: "/d/riverside/", hash: `#d=Abc123${"x".repeat(80)}` };
const unhandled = [];
process.on("unhandledRejection", (e) => unhandled.push(e));
const reporter = await import(pathToFileURL(resolvePath(ROOT, "ui/problems.js")).href + "?page-1");
ok("it starts on a page that has a window", reporter.watchProblems({ area: "designer", endpoint: () => new URL("../api/office/problem", `${SITE}/ui/app.js`).href, page: () => location.pathname }) === true);
const fire = (type, props) => { const e = new Event(type); Object.assign(e, props); page.dispatchEvent(e); };
const typed = "Pat Customer pat.customer@example.com (555) 010-7788";
fire("error", {
  message: `Uncaught TypeError: Cannot read properties of undefined (reading 'name') ${typed} ${SITE}/d/riverside/?company=demo#d=${"Q".repeat(60)} token ${"A".repeat(50)} ${"z".repeat(300)}`,
  filename: `${SITE}/ui/app.js?v=7`, lineno: 120, colno: 7,
});
await new Promise((done) => setTimeout(done, 10));
const first = posts[0];
ok("an error is sent once, to this same site's /api/office/problem", posts.length === 1 && first.url === `${SITE}/api/office/problem` && first.init.method === "POST", first?.url);
ok("... as JSON, kept alive past the page closing, same-site credentials only", first.init.headers["Content-Type"] === "application/json" && first.init.keepalive === true && first.init.credentials === "same-origin");
const b = first.body;
ok("... with a short code the server takes", /^designer:[0-9a-f]{16}$/.test(b.signature) && /^[A-Za-z0-9:._/-]{1,120}$/.test(b.signature), b.signature);
ok("... the message cut to 300 characters", b.message.length <= 300 && b.message.startsWith("Uncaught TypeError: Cannot read properties of undefined (reading 'name')"), String(b.message.length));
ok("... with nothing a customer typed: no email, no phone number, no saved design, no query string, no long code",
  !/pat\.customer|@|010-7788|7788|company=demo|#d=|QQQQ|AAAAAAAAAA/.test(b.message), b.message);
ok("... where: the script's path, line and column, no query string", b.where === "/ui/app.js:120:7", b.where);
ok("... the page's path only (the customer's building after # stays on the page)", b.page === "/d/riverside/" && !JSON.stringify(b).includes("#d="), b.page);
ok("... and the kind of page, the browser, the count and when", b.area === "designer" && typeof b.browser === "string" && b.browser.length <= 300 && b.count === 1 && Number.isFinite(Date.parse(b.firstAt)));
for (let i = 0; i < 4; i++) fire("error", { message: `Uncaught TypeError: Cannot read properties of undefined (reading 'name') ${typed} ${SITE}/d/riverside/?company=demo#d=${"Q".repeat(60)} token ${"A".repeat(50)} ${"z".repeat(300)}`, filename: `${SITE}/ui/app.js?v=7`, lineno: 120, colno: 7 });
ok("the same error again and again: still one report, counted on the page", posts.length === 1 && reporter.recentProblems()[0].count === 5, JSON.stringify(reporter.recentProblems()[0]));
fire("error", { message: "Script error.", filename: "", lineno: 0, colno: 0 });
fire("unhandledrejection", { reason: Object.assign(new Error("You were signed out. Sign in again."), { status: 401 }) });
ok("another site's \"Script error.\" and an answer from the server are not problems in the code", posts.length === 1);
const boom = new Error("boom at chris@samplebarns.example");
boom.stack = `Error: boom\n    at draw (${SITE}/ui/views.js?v=2:12:5)\n    at ${SITE}/ui/app.js:1:1`;
fire("unhandledrejection", { reason: boom });
answerWith = async () => { throw new TypeError("Failed to fetch"); };
for (let n = 0; n < 5; n++) fire("error", { message: `ReferenceError: thing${n} is not defined`, filename: `${SITE}/ui/quote.js`, lineno: 10 + n, colno: 3 });
await new Promise((done) => setTimeout(done, 20));
ok("at most 3 reports a page load, however many errors", posts.length === 3, String(posts.length));
ok("a promise that failed: its name and words, where its stack says, no email", posts[1].body.message === "Error: boom at (email)" && posts[1].body.where === "/ui/views.js:12:5", JSON.stringify(posts[1].body));
ok("a site that answers 404, or can't be reached, changes nothing: no error, no unhandled promise", unhandled.length === 0, String(unhandled[0]));
ok("the page remembers what it saw for a question to Barnwright (at most 10, with counts)", reporter.recentProblems().length === 7 && reporter.recentProblems().every((x) => x.message && typeof x.count === "number"), JSON.stringify(reporter.recentProblems().map((x) => x.count)));
ok("the Dealer Center's page is its screen, never which customer", reporter.screenOf("#/customers/AbC123xyZ9/orders/Ord987654?new=1") === "#/customers/:id/orders/:id" && reporter.screenOf("#/price-list/doors") === "#/price-list/doors");
ok("... and never a sign-in email's link or a saved building", reporter.screenOf("#invite_token=Abc123Def456") === "" && reporter.screenOf("#recovery_token=x") === "" && reporter.screenOf("#d=AbcDef") === "");
r = await report(first.body);
ok("what the reporter sends is what the server takes: it reaches the inbox", r.data.ok === true && inbox.problems.some((x) => x.signature === first.body.signature && x.where === "/ui/app.js:120:7"));
{
  /* another page load: a report bound for another website is never sent; a demo keeps them */
  posts.length = 0;
  const other = await import(pathToFileURL(resolvePath(ROOT, "ui/problems.js")).href + "?page-2");
  other.watchProblems({ area: "dealer-center", endpoint: "https://evil.example/api/office/problem" });
  fire("error", { message: "TypeError: elsewhere", filename: `${SITE}/ui/office/main.js`, lineno: 1, colno: 1 });
  const demo = await import(pathToFileURL(resolvePath(ROOT, "ui/problems.js")).href + "?page-3");
  demo.watchProblems({ area: "dealer-center", endpoint: "/api/office/problem", skip: () => true });
  fire("error", { message: "TypeError: in the demo", filename: `${SITE}/ui/office/main.js`, lineno: 2, colno: 2 });
  await new Promise((done) => setTimeout(done, 10));
  ok("a report is only ever sent to this same site", !posts.some((x) => x.url.startsWith("https://evil.example")));
  ok("the \"try it\" demo keeps its problems on the page", !posts.some((x) => /in the demo/.test(x.body.message)) && demo.recentProblems().some((x) => /in the demo/.test(x.message)));
  globalThis.window = {};
  const bare = await import(pathToFileURL(resolvePath(ROOT, "ui/problems.js")).href + "?page-4");
  ok("with no real window (the checks that load the designer in Node), it does nothing", bare.watchProblems({ area: "designer" }) === false);
  delete globalThis.window;
  delete globalThis.location;
}

/* ---- 9 ---------------------------------------------------------------------------------- */
section("9. Every page's security policy lets it talk to its own site");
const connects = (policy) => (/(?:^|;\s*)connect-src ([^;]*)/.exec(policy)?.[1] || "").split(/\s+/).includes("'self'");
ok("the Dealer Center (/dealer)", connects(OFFICE_POLICY), OFFICE_POLICY);
ok("a lot's 3D designer (/d/<lot>/)", connects(lotDesignerPolicy(["'sha256-x'"], ["https://samplebarns.example"])));
ok("the 3D designer as the headers build writes it", connects(designerCsp({ hashes: [], ancestors: [] })));
const rules = parseHeaders(readFileSync(resolvePath(ROOT, "_headers"), "utf8"));
const csps = rules.flatMap((rule) => rule.headers.filter(([k, v]) => k.toLowerCase() === "content-security-policy" && /default-src/.test(v)).map(([, v]) => [rule.path, v]));
ok(`every designer page in _headers (${csps.length})`, csps.length > 3 && csps.every(([, v]) => connects(v)), csps.filter(([, v]) => !connects(v)).map(([p]) => p).join(", "));

/* ---- 10 --------------------------------------------------------------------------------- */
section("10. The short answers");
ok(`each Dealer Center shows 10 to 14 answers (connected ${answersFor(true).length}, not connected ${answersFor(false).length}), each with its own id`,
  [answersFor(true), answersFor(false)].every((l) => l.length >= 10 && l.length <= 14) && new Set(ANSWERS.map((a) => a.id)).size === ANSWERS.length
  && ANSWERS.every((a) => a.when === undefined || a.when === "connected" || a.when === "not-connected"));
{
  const ids = (connected) => answersFor(connected).map((a) => a.id);
  ok("what exists only when connected (a plan, its notes at the top, Help from Barnwright) shows only there; the demo and Alan's own business get their own way to open a lot",
    ["another-lot", "stopped", "barnwright-look"].every((id) => ids(true).includes(id) && !ids(false).includes(id))
    && ids(false).includes("another-lot-own") && !ids(true).includes("another-lot-own"), JSON.stringify([ids(true), ids(false)]));
  const all = ANSWERS.map((a) => `${a.title} ${a.lines.join(" ")}`).join(" ");
  ok("no answer names a price (a business's lot fee is its own) or says \"below\" (on a computer the box is beside them)", !/\$\s?\d/.test(all) && !/\bbelow\b/i.test(all), (all.match(/.{30}(?:\$\s?\d|below).{20}/i) || [""])[0]);
}
/* every sentence on the Dealer Center's screens and the customer's designer:
   the text itself, or a template literal with real words in it, where each
   ${...} stands for one word ("Add your own ${WORD[g]} color") */
function sources(dir) {
  const out = [];
  for (const n of readdirSync(dir)) {
    const f = join(dir, n);
    if (statSync(f).isDirectory()) out.push(...sources(f));
    else if (n.endsWith(".js") && n !== "help-answers.js") out.push(readFileSync(f, "utf8"));
  }
  return out;
}
const screenText = [...sources(resolvePath(ROOT, "ui/office")), readFileSync(resolvePath(ROOT, "ui/quote.js"), "utf8")].join("\n");
const templates2 = [...screenText.matchAll(/`([^`]*)`/g)].map((t) => t[1])
  .filter((t) => /\$\{/.test(t) && t.replace(/\$\{[^}]*\}/g, "").replace(/[^A-Za-z]/g, "").length >= 8)
  .map((t) => new RegExp("^" + t.split(/\$\{[^}]*\}/).map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\S+?") + "$", "i"));
const onScreen = (phrase) => screenText.toLowerCase().includes(phrase.toLowerCase()) || templates2.some((re) => re.test(phrase));
const named = ANSWERS.flatMap((a) => a.lines.flatMap((l) => [...l.matchAll(/\*\*([^*]+)\*\*/g)].map((x) => [a.id, x[1]])));
const missing = named.filter(([, phrase]) => !onScreen(phrase));
ok(`every button, heading and note the answers name is on a screen (${named.length})`, named.length > 40 && missing.length === 0, missing.map(([id, p]) => `${id}: ${p}`).join(" | "));
const routes = readFileSync(resolvePath(ROOT, "ui/office/main.js"), "utf8");
const routeRes = [...routes.matchAll(/^\s*\[\/(\^.*\$)\/, "[a-z-]+"\],?\s*$/gm)].map((x) => new RegExp(x[1]));
const badLinks = ANSWERS.filter((a) => a.link && !routeRes.some((re) => re.test(a.link[0].slice(1))));
ok("every answer's link opens a real screen", routeRes.length > 10 && badLinks.length === 0, badLinks.map((a) => a.link[0]).join(", "));
ok("no slashes in the words (the Dealer Center's writing style)", ANSWERS.every((a) => !/\//.test(a.title + a.lines.join(" "))));
ok("the search finds by any word, and nothing for nonsense", findAnswers("website").some((a) => a.id === "website") && findAnswers("password").some((a) => a.id === "sign-in")
  && findAnswers("PRICE").some((a) => a.id === "price") && findAnswers("qwertyzzz").length === 0 && findAnswers("").length === answersFor(true).length
  && findAnswers("", false).length === answersFor(false).length && findAnswers("lot", false).every((a) => a.when !== "connected"));
ok("after sending: \"Sent. Barnwright will answer here and by email at <their email>.\"", HELP_SCREEN.sent("mike@samplebarns.example") === "Sent. Barnwright will answer here and by email at mike@samplebarns.example.");
{
  const goes = HELP_SCREEN.whatGoes("");
  ok("the form says what goes with a question: every kind of fact the server sends, and never customers or prices", /the page you came from \(Price list\)/.test(HELP_SCREEN.whatGoes("Price list"))
    && ["your name, email and job", "how your Dealer Center is set up", "Barnwright account", "browser and screen", "recent errors"].every((w) => goes.includes(w))
    && /Never your customers or prices\./.test(goes), goes);
}
ok("Help is in the menu for every role, and at the top of every screen", /\{ path: "\/help", label: "Help", icon: "help", roles: \["owner", "manager", "dealer"\] \}/.test(routes) && /href: "#\/help", class: "topbar-help"/.test(routes));

/* ---- 11 --------------------------------------------------------------------------------- */
section("11. What the review of Help found, each fixed");
const pause = (ms) => new Promise((done) => setTimeout(done, ms));
{
  /* main.js keeps the screen someone came from (screenOf), and the Help screen reads it with screenOf again */
  const ids = ["#/customers/AbC123xyZ9/orders/Ord987654?new=1", "#/customers/AbC123xyZ9", "#/orders/Ord987654", "#/price-list/doors", "#/lots/riverside"];
  ok("the page someone came from survives being read twice (a customer's or an order's page stays that page, never which one)",
    ids.every((h) => reporter.screenOf(reporter.screenOf(h)) === reporter.screenOf(h) && reporter.screenOf(h) !== "")
    && reporter.screenOf(reporter.screenOf(ids[0])) === "#/customers/:id/orders/:id", ids.map((h) => reporter.screenOf(reporter.screenOf(h))).join(" "));
  r = await call("POST", "/api/office/help", { text: "Asked from a customer's order (zebra-question)", page: reporter.screenOf(reporter.screenOf(ids[0])) }, { as: EMAIL.mike });
  ok("... and goes to Barnwright as that screen", r.status === 201 && inbox.questions.at(-1).page === "#/customers/:id/orders/:id", inbox.questions.at(-1).page);
}
{
  /* the control room refusing this Dealer Center's key: Help isn't set up for it, and saying "try again" would be wrong */
  const realKey = room.business.key;
  room.business.key = "bwk_" + "q".repeat(40);
  const before = inbox.calls.length;
  r = await ask(EMAIL.mike, "Is Help set up for us? (zebra-question)");
  ok(`the control room refusing this Dealer Center's key (401): "${HELP_WORDS.notSetUp}", nothing sent`, r.status === 503 && r.data.error === HELP_WORDS.notSetUp && r.data.error.includes(SUPPORT_EMAIL) && inbox.calls.length === before, JSON.stringify(r.data));
  r = await list(EMAIL.mike);
  ok("... and the Help screen shows that line instead of the box (connected, can't ask)", r.status === 200 && r.data.connected === true && r.data.canAsk === false && Array.isArray(r.data.items) && r.data.items.length === 0, JSON.stringify(r.data));
  room.business.key = realKey;
  const broken = connectedWith({ license: licenseWith(async (url, init) => (new URL(url).pathname === "/api/help-pass" ? new Response("{}", { status: 500 }) : room.fetch(url, init))) });
  r = await call("POST", "/api/office/help", { text: "Control room broken (zebra-question)" }, { as: EMAIL.mike, app: broken });
  ok("the control room broken (500): try again in a minute", r.status === 503 && r.data.error === HELP_WORDS.unreachable, JSON.stringify(r.data));
}
{
  /* one time limit for all of a request's calls */
  const slowRoom = licenseWith(async (url, init) => { await pause(300); return room.fetch(url, init); });
  const slowInbox = (url, init) => new Promise((done, fail) => {
    const timer = setTimeout(() => done(inbox.fetch(url, init)), 400);
    init.signal.addEventListener("abort", () => { clearTimeout(timer); fail(init.signal.reason); });
  });
  const app = connectedWith({ license: slowRoom, help: { url: inbox.origin, fetch: slowInbox, timeoutMs: 1000, budgetMs: 500 } });
  const before = inbox.questions.length;
  const t0 = Date.now();
  r = await call("POST", "/api/office/help", { text: "Slow everywhere (zebra-question)" }, { as: EMAIL.mike, app });
  const took = Date.now() - t0;
  ok(`one time limit for the whole request: a slow control room (0.3 s) and a slow inbox (0.4 s), with 0.5 s for both, is given up on within it (${took} ms, not 0.7 s)`,
    r.status === 503 && r.data.error === HELP_WORDS.unreachable && took >= 290 && took < 600 && inbox.questions.length === before, `${took} ms ${JSON.stringify(r.data)}`);
  let tries = 0;
  const dropsLate = async () => { tries++; await pause(700); throw new TypeError("fetch failed: the connection dropped"); };
  const late = connectedWith({ help: { url: inbox.origin, fetch: dropsLate, timeoutMs: 2000, budgetMs: 2500 } });
  r = await call("POST", "/api/office/help", { text: "Dropped late (zebra-question)" }, { as: EMAIL.mike, app: late });
  ok("a connection that drops with under 2 seconds left isn't tried again (one that drops at once is, in section 5)", r.status === 503 && tries === 1, String(tries));
  const wasDealer = connectedWith({ license: slowRoom, help: { url: inbox.origin, fetch: inbox.fetch, budgetMs: 200 } });
  r = await list(EMAIL.mike, wasDealer);
  ok("the list has the same time limit: a slow control room past it says the questions aren't showing", r.status === 200 && r.data.items === null && r.data.problem === HELP_WORDS.listUnreachable, JSON.stringify(r.data));
}
{
  /* the same person sending the same words again (the answer got lost on the way back) */
  const passesBefore = room.helpPasses.length;
  const words = "The same words twice (zebra-question)";
  const first = await ask(EMAIL.dana, words);
  const asked = inbox.questions.length;
  const again = await ask(EMAIL.dana, words);
  ok("the same person sending the same words again makes one question: the same pass, and the first one's id back", first.status === 201 && again.status === 201
    && again.data.id === first.data.id && inbox.questions.length === asked && room.helpPasses.length === passesBefore + 1, JSON.stringify([first.data, again.data, room.helpPasses.length - passesBefore]));
  const other = await ask(EMAIL.mike, words);
  ok("... someone else with the same words asks their own question", other.status === 201 && other.data.id !== first.data.id && inbox.questions.length === asked + 1);
  shift += 10 * 60_000;
  const later = await ask(EMAIL.dana, words);
  ok("... and the same words after 9 minutes are a new question", later.status === 201 && later.data.id !== first.data.id && inbox.questions.length === asked + 2);
  const kept = await office.parts.store.get("barnwright-help-asked");
  ok("what's kept to know a question again holds no words and only the last 9 minutes", !!kept && !/same words|zebra/i.test(JSON.stringify(kept)) && Object.keys(kept).length === 1, String(JSON.stringify(kept)).slice(0, 200));
}
{
  /* an address the inbox can't write to */
  ok("an address in other letters goes as the internet writes it; one the inbox can't write to is caught here",
    mailbox("ines@müller.example") === "ines@xn--mller-kva.example" && mailbox("Bob.Smith+tag@Example.COM") === "Bob.Smith+tag@example.com" && mailbox(EMAIL.mike) === EMAIL.mike
    && ["pat@bad_domain.example", "pat@x.example:80", "pat@x.example/y", "nobody", "@x.example", "pat@", "pat@localhost"].every((x) => mailbox(x) === ""),
    JSON.stringify(["ines@müller.example", "pat@bad_domain.example", "pat@localhost"].map(mailbox)));
  for (const [id, email, name] of [["sample-ines", "ines@müller.example", "Ines Müller"], ["sample-pat", "pat@bad_domain.example", "Pat Shore"]]) {
    USERS[email] = { id, email, name, confirmedAt: "2026-01-01T00:00:00Z", emailVerified: true };
    await office.parts.store.put(`people/${id}`, { userId: id, email, name, role: "dealer", lots: ["riverside"], active: true });
  }
  r = await ask("ines@müller.example", "From a domain in other letters (zebra-question)");
  ok("... Ines (müller.example) asks, and Barnwright writes back to xn--mller-kva.example", r.status === 201 && inbox.questions.at(-1).asker.email === "ines@xn--mller-kva.example", JSON.stringify([r.data, inbox.questions.at(-1).asker]));
  const before = inbox.calls.length;
  r = await ask("pat@bad_domain.example", "From an address the inbox can't write to (zebra-question)");
  ok(`... Pat (bad_domain.example) is told at once: "${HELP_WORDS.badEmail}", nothing sent`, r.status === 422 && r.data.error === HELP_WORDS.badEmail && inbox.calls.length === before, JSON.stringify(r.data));
}
{
  /* a dealer's own questions never drop out behind the team's newest */
  for (let i = 0; i < 31; i++) await ask(EMAIL.lee, `Team question ${i} (zebra-question)`);
  const mikes = await list(EMAIL.mike);
  const sent = lastCall("/help/v1/thread");
  ok("a dealer's list asks the inbox for their own questions only (askerId), so an older one still shows behind the team's 31 newer ones",
    sent.body.askerId === "sample-mike" && mikes.data.items.some((x) => x.id === mikeQ) && mikes.data.items.every((x) => x.asker.id === "sample-mike"), JSON.stringify(sent.body).slice(0, 80));
  const owners = await list(EMAIL.owner);
  ok("... while the owner's list asks for the whole business's (the 30 newest)", !("askerId" in lastCall("/help/v1/thread").body) && owners.data.items.length === 30);
}
{
  /* the words of an error are cleaned on the server too, whatever the browser sent */
  r = await report({ signature: "designer:00000000000000aa", message: `TypeError: failed for pat.customer@example.com (555) 010-7788 https://samplebarns.test/d/riverside/?token=SECRET789 ${"A".repeat(50)}`, where: "/ui/app.js:1:1", page: "/d/riverside/", area: "designer" });
  const words = lastCall("/help/v1/problem").body.problem.message;
  ok("a problem's words are cleaned on the server too: no email, phone number, query string or long code", r.data.ok === true && !/pat\.customer|010-7788|SECRET789|AAAAAAAAAA/.test(words) && /\(email\)/.test(words) && /\(number\)/.test(words), words);
  r = await ask(EMAIL.mike, "Errors with private words (zebra-question)", { details: { errors: [{ message: "Error: chris@samplebarns.example called (555) 010-0100", where: "/ui/office/main.js:1:1", count: 1 }] } });
  const errs = lastCall("/help/v1/ask").body.question.details.errors;
  ok("... and so are the recent errors that go with a question", r.status === 201 && errs.length === 1 && !/@|010-0100/.test(errs[0].message) && /\(email\)/.test(errs[0].message), JSON.stringify(errs));
  const timings = [`TypeError: bad value ${"a".repeat(60000)}`, `Error: ${"1.".repeat(30000)}`].map((m) => { const t = performance.now(); reporter.tidyMessage(m); return performance.now() - t; });
  ok(`a 60,000-character error is cleaned at once (${timings.map((t) => t.toFixed(1)).join(" and ")} ms): only its first 1,000 characters are read`, timings.every((t) => t < 50), timings.join(" "));
  ok("... and an email address cut at 1,000 characters still goes as (email)", !/pat@exam/.test(reporter.tidyMessage(`${"x ".repeat(496)}pat@example.com`)) && reporter.tidyMessage(`${"x ".repeat(496)}pat@example.com`).length <= 300);
}
{
  /* long answers */
  const long = "Here is how. " + "Step after step. ".repeat(1100);
  inbox.answer(mikeQ, long);
  const shown = (await list(EMAIL.mike)).data.items.find((x) => x.id === mikeQ);
  ok(`a long answer (${long.length.toLocaleString("en-US")} characters, the inbox sends up to 20,000) shows in full on the Help screen`, shown?.replies.at(-1)?.text === long, String(shown?.replies.at(-1)?.text.length));
}
{
  /* GET me says at once whether questions can go */
  const helpOf = async (app) => (await call("GET", "/api/office/me", undefined, { as: EMAIL.mike, app })).data.help;
  const states = [await helpOf(office), await helpOf(createOffice({ ...base })), await helpOf(connectedWith({ help: null }))];
  ok("GET me says whether questions can go, so the Help screen draws its box without waiting for the list",
    JSON.stringify(states) === JSON.stringify([{ connected: true, canAsk: true }, { connected: false, canAsk: false }, { connected: true, canAsk: false }]), JSON.stringify(states));
}
{
  /* a failure the page caught itself */
  posts.length = 0;
  answerWith = async () => new Response("{}", { status: 200 });
  globalThis.window = page;
  globalThis.location = { href: `${SITE}/dealer#/customers/AbC123`, origin: SITE, protocol: "https:", pathname: "/dealer", hash: "#/customers/AbC123" };
  const caught = await import(pathToFileURL(resolvePath(ROOT, "ui/problems.js")).href + "?page-5");
  caught.watchProblems({ area: "dealer-center", endpoint: "/api/office/problem", page: () => location.pathname + caught.screenOf(location.hash) });
  caught.reportProblem(Object.assign(new Error("You were signed out. Sign in again."), { status: 401 }));
  caught.reportProblem(new TypeError("Cannot read properties of undefined (reading 'lots')"));
  await pause(20);
  ok("a failure the page caught itself is passed on like one nothing caught; an answer from the server isn't", posts.length === 1 && /^TypeError: Cannot read properties/.test(posts[0].body.message)
    && posts[0].body.area === "dealer-center" && posts[0].body.page === "/dealer#/customers/:id", JSON.stringify(posts.map((x) => x.body.message)));
  delete globalThis.window;
  delete globalThis.location;
  const mainSrc = readFileSync(resolvePath(ROOT, "ui/office/main.js"), "utf8");
  const appSrc = readFileSync(resolvePath(ROOT, "ui/app.js"), "utf8");
  ok("the Dealer Center's \"This page didn't load\", and the 3D designer's settings that didn't load, a lot's price list with problems and a part that didn't start, each pass theirs on",
    /reportProblem\(e\);[^\n]*\n\s*clear\(main, emptyState\("This page didn't load"/.test(mainSrc)
    && /could not load its settings:", e\.message\);\n\s*reportProblem\(e\);/.test(appSrc)
    && /reportProblem\(new Error\(`This lot's price list has \$\{n\} problem/.test(appSrc)
    && /failed to start:`, e\);\n\s*reportProblem\(e\);/.test(appSrc));
}

console.log("");
if (failed.length) {
  console.log(`FAIL: ${failed.length} of ${passed + failed.length} Help checks failed.`);
  process.exit(1);
}
console.log(`PROVED (${passed} checks): a question goes to Barnwright with the control room's pass, from the person signed in, with only the promised facts (no customers, prices, orders or keys), also while changes are stopped; owners and managers see every question and a dealer their own, however many the team asked; every failure says so in plain words (a refused key or question gives the email, never "try again"), within one time limit, and nothing typed is logged; a dropped connection or the same words sent again make one question; problem reports go once per kind in 24 hours and at most 10 a day, cleaned on the server too, always answered {ok: true}; the browser sends at most 3, trimmed, to its own site only, failures it caught itself included; not connected, nothing is sent; every page may talk to its own site; each Dealer Center's short answers fit it and name only real buttons.`);
