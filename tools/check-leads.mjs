/* CHECK: a customer's quote request reaches the company, every way a company
   can ask for it, and never reaches anybody it should not.
   Run: node tools/check-leads.mjs [--quiet]            (check-all: browser)

   WHY. This designer has no server of its own. A company that buys only the
   3D designer receives its leads through a form service it already uses, a
   webhook, the customer's own e-mail, or its own web page the designer sits
   in (docs/ARCHITECTURE.md, "Leads"; ui/quote.js). A lead that silently goes
   nowhere is a lost sale nobody hears about -- so this check sends real
   requests from a real browser to a pretend form service, webhook and
   company page (tools/lib/fake-endpoints.mjs) and reads back exactly what
   arrived.

   WHAT IT PROVES (test companies made from the demo company, one per way of
   receiving leads, served to the page in place of a real company file):
   1. THE FORM: only the boxes the company asks for are there, the texting box
      (leads.smsConsent) is there UNTICKED, the robots' box is hidden. An
      empty form sends nothing and says, in plain words, what is missing.
      The address is a question of its own (an Address heading, a Street box
      and a City box, "Can skip if you already sent it to us."); "What do you
      want to do with this quote?" has four answers, none picked, and a
      company with leads.askPlan false is not asked it. With a rent-to-own
      term shown (pricing.rto.showTerm), "Your quote" has a chip for each
      term and the monthly figure to the cent (price / factor / months), the
      plate shows the same figure, and tapping another term changes both.
   2. ROBOTS: a request sent within 3 seconds of the form appearing is
      dropped (nothing arrives) with a "just a moment" message; a request
      with the hidden robots' box filled is dropped (nothing arrives) and the
      page still shows the company's phone and the design.
   3. FORM SERVICE (leads.mode "form"): an ordinary form post arrives -- no
      permission request (preflight) before it -- with every box, the texting
      answer, the city, the answer about what they want to do, the
      rent-to-own term they looked at, the building, the total, the summary
      and a link that opens THIS design (same style, size and price,
      look-only); the page says it was sent. A form service that never answers shows the "reach us directly"
      box after the time limit.
   4. WEBHOOK: the post arrives as text/plain with no preflight, carrying
      {design, contact, summary, link, priceComputedBy: "browser"}; no
      pictures unless the company asked for them (leads.images); with them,
      a 2x2 picture of the building and the floor plan that the browser can
      open, together under 300 KB (and, with a smaller cap, made smaller
      step by step until they fit). A customer e-mail address with an
      apostrophe in it is accepted. A broken webhook (it answers 500) shows the
      "reach us directly" box: Call and Text links with the company's phone,
      a "Copy my design link" button that copies the link, and the summary.
   5. E-MAIL (mailto): the mail link is addressed to the company, carries the
      summary and the link, stays under 1,800 characters even for a design
      with 30 priced options (the option list is shortened, never the link),
      and the page then shows the phone, the copy button and the summary.
   6. THE COMPANY'S OWN PAGE (postMessage): inside a page whose address is on
      the company's embed.origins list the request is handed to that page
      (it arrives there, from the designer's address, addressed to that page
      alone -- never "*"); inside a page NOT on the list nothing about the
      customer reaches it and the customer gets the "reach us directly" box;
      and in the other modes an allowed page is told a quote was requested
      WITHOUT the customer's details.
   7. ESCAPING: a customer named <img src=x onerror=...>, a company named
      with <b> in it, a company phone with an <img> tag in it and texting
      words with <i> in them all show as the characters typed -- nothing
      runs, no element is made. A company with no phone or e-mail on file is
      not promised to the customer as a way to reach it.
   8. A showroom company (leads.mode "none") has no quote form.
   9. No console errors (the browser's own "failed to load" line for the
      deliberately broken endpoints and Google Fonts aside).
   Pictures: test/out/leads-*.png. */

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { startFakeEndpoints } from "./lib/fake-endpoints.mjs";
import { decode } from "../model/design.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(ROOT, "test/out");
const PORT = 8354, FPORT = 8355;
const BASE = "http://127.0.0.1:" + PORT;
const QUIET = process.argv.includes("--quiet");
const J = (v) => JSON.stringify(v);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0;
const failures = [];
function ok(name, cond, extra) {
  if (cond) { pass++; if (!QUIET) console.log("  ok   " + name); }
  else { fail++; failures.push(name); console.log("  FAIL " + name + (extra !== undefined ? "\n       " + String(extra).slice(0, 1200) : "")); }
  return !!cond;
}
function section(t) { console.log("\n" + t); }

/* ---------------- the server, the pretend endpoints, the browser ---------------- */
const servers = [];
async function serve() {
  const url = BASE + "/index.html";
  const answers = async () => { try { return (await fetch(url)).ok; } catch { return false; } };
  if (await answers()) return;
  const child = spawn("npx", ["http-server", ROOT, "-p", String(PORT), "-s", "-c-1", "-a", "127.0.0.1"], { detached: true, stdio: "ignore" });
  servers.push(child);
  for (let i = 0; i < 150; i++) { if (await answers()) return; await sleep(100); }
  throw new Error("could not serve the repo on port " + PORT);
}
function stopServers() { for (const c of servers) { try { process.kill(-c.pid, "SIGTERM"); } catch {} } servers.length = 0; }
process.on("exit", stopServers);

const require = createRequire(import.meta.url);
const { chromium } = require("/opt/node22/lib/node_modules/playwright/index.js");
const LAUNCH = { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] };

/* ---------------- the test companies ---------------- */
const DEMO = JSON.parse(readFileSync(resolve(ROOT, "companies/demo/company.json"), "utf8"));
let FAKE = "";            /* http://127.0.0.1:8355 once started */
const PHONE = "(555) 010-0142";
const FIELDS_ALL = { name: "required", phone: "required", email: "optional", zip: "required", address: "optional", note: "optional" };
const SMS_WORDS = "Yes, you may text me about this quote. Message and data rates may apply. Reply STOP to stop. <i>really</i>";
function company(id, leads, extra) {
  const c = JSON.parse(JSON.stringify(DEMO));
  c.id = id;
  c.brand = Object.assign({}, c.brand, { name: "Acme Sheds", short: "Acme Sheds", phone: PHONE, email: "sales@acme.example" });
  c.leads = Object.assign({ fields: FIELDS_ALL, smsConsent: null, images: false }, leads);
  c.embed = { origins: [], shareUrl: "" };
  return Object.assign(c, extra || {});
}
function companies() {
  const allowed = { origins: [FAKE], shareUrl: "" };
  return {
    /* shows a rent-to-own price, starting on 60 months */
    leadform: company("leadform", { mode: "form", url: FAKE + "/form", smsConsent: SMS_WORDS }, { pricing: Object.assign({}, DEMO.pricing, { rto: Object.assign({}, DEMO.pricing.rto, { showTerm: 60 }) }) }),
    /* asks no address and not what they want to do */
    leadnoplan: company("leadnoplan", { mode: "form", url: FAKE + "/form", fields: Object.assign({}, FIELDS_ALL, { address: "off" }), askPlan: false }),
    leadhang: company("leadhang", { mode: "form", url: FAKE + "/hang" }),
    leadhook: company("leadhook", { mode: "webhook", url: FAKE + "/hook", smsConsent: SMS_WORDS }),
    leadimg: company("leadimg", { mode: "webhook", url: FAKE + "/hook", images: true }),
    leadfail: company("leadfail", { mode: "webhook", url: FAKE + "/fail" }),
    leadmail: company("leadmail", { mode: "mailto", email: "quotes@acme.example" }),
    leadpm: company("leadpm", { mode: "postMessage" }, { embed: allowed }),
    leademb: company("leademb", { mode: "webhook", url: FAKE + "/hook" }, { embed: allowed }),
    leadnone: company("leadnone", { mode: "none" }),
    leadesc: company("leadesc", { mode: "webhook", url: FAKE + "/hook", smsConsent: SMS_WORDS }, {
      brand: Object.assign({}, DEMO.brand, { name: 'Acme <b>Sheds</b> & "Co"', short: "Acme", phone: PHONE + ' <img src=x onerror="window.__pwned=true">', email: "sales@acme.example" }),
    }),
    /* a company with no phone number and no e-mail address on file */
    leadbare: company("leadbare", { mode: "webhook", url: FAKE + "/fail" }, {
      brand: Object.assign({}, DEMO.brand, { name: "Bare Sheds", short: "Bare", phone: "", email: "" }),
    }),
  };
}

let COS = null;
async function newContext(browser, o) {
  o = o || {};
  const ctx = await browser.newContext({ viewport: o.viewport || { width: 1200, height: 860 }, reducedMotion: "reduce", deviceScaleFactor: 1 });
  await ctx.route(/^https?:\/\/(?!(127\.0\.0\.1|localhost)[:\/])/, (r) => r.abort());
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: "text/css", body: "" }));
  await ctx.route(/\/companies\/(lead[a-z]+)\/company\.json/, (r) => {
    const id = /\/companies\/(lead[a-z]+)\//.exec(r.request().url())[1];
    if (!COS[id]) return r.fulfill({ status: 404, body: "no such test company" });
    return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(COS[id]) });
  });
  try { await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE }); } catch { /* older Playwright */ }
  return ctx;
}

/* console noise that is NOT a fault: the browser's own line for an address
   that failed on purpose, and the fonts this sandbox cannot load */
function realNoise(noise, allowed) {
  return noise.filter((m) => {
    if (m.type !== "error" && m.type !== "pageerror") return false;
    const t = m.text + " " + (m.url || "");
    if (/fonts\.(googleapis|gstatic)\.com/.test(t)) return false;
    if ((allowed || []).some((re) => re.test(t))) return false;
    return true;
  });
}
function listen(page) {
  const noise = [];
  page.on("console", (m) => { const t = m.type(); if (t === "error") noise.push({ type: t, text: m.text(), url: (m.location() || {}).url }); });
  page.on("pageerror", (e) => noise.push({ type: "pageerror", text: String(e) }));
  return noise;
}
async function openDesigner(ctx, id, extraQuery) {
  const page = await ctx.newPage();
  const noise = listen(page);
  await page.goto(BASE + "/?company=" + id + (extraQuery || ""), { waitUntil: "load" });
  await page.waitForFunction(() => window.shedUI && window.shedUI.ready, null, { timeout: 90000 });
  const readyAt = Date.now();
  return { page, noise, readyAt };
}
/* wait until the form has been on screen long enough for a person */
async function pastMinimum(readyAt) { const left = 3200 - (Date.now() - readyAt); if (left > 0) await sleep(left); }
async function fillBasics(target, o) {
  o = o || {};
  await target.fill('#quote-mount [name="name"]', o.name || "Jane Doe");
  await target.fill('#quote-mount [name="phone"]', o.phone || "(941) 555-0123");
  await target.fill('#quote-mount [name="zip"]', o.zip || "33952");
  if (o.email !== undefined) await target.fill('#quote-mount [name="email"]', o.email);
  if (o.address !== undefined) await target.fill('#quote-mount [name="address"]', o.address);
  if (o.city !== undefined) await target.fill('#quote-mount [name="city"]', o.city);
  if (o.plan !== undefined) await target.check('#quote-mount input[name="plan"][value="' + o.plan + '"]');
  if (o.note !== undefined) await target.fill('#quote-mount [name="note"]', o.note);
}
const lastOf = (target) => target.evaluate(() => window.shedUI.quote.last);
async function waitLast(target, want, ms) {
  await target.waitForFunction((w) => { const l = window.shedUI.quote.last; return l && (w ? w.indexOf(l.status) >= 0 : true); }, want || null, { timeout: ms || 20000 });
  return lastOf(target);
}
async function shot(page, name) {
  try {
    mkdirSync(OUT, { recursive: true });
    /* the header bar stays at the top of the window and would sit over the card */
    await page.evaluate(() => { const h = document.querySelector(".hdr"); if (h) h.style.visibility = "hidden"; });
    await page.locator("#quotecard").screenshot({ path: resolve(OUT, name) });
    await page.evaluate(() => { const h = document.querySelector(".hdr"); if (h) h.style.visibility = ""; });
    return true;
  }
  catch (e) { console.log("       (picture " + name + " not saved: " + e.message + ")"); return false; }
}
function preflights(fake, path) { return fake.records.filter((r) => r.method === "OPTIONS" && (!path || r.path === path)); }
async function linkDesign(link) { return decode(link); }

/* ---------------- the check ---------------- */
let browser = null, fake = null;
try {
  await serve();
  fake = await startFakeEndpoints({ port: FPORT });
  FAKE = fake.url;
  COS = companies();
  browser = await chromium.launch(LAUNCH);
  mkdirSync(OUT, { recursive: true });

  /* ------------------------------------------------------------ 1, 2, 3 */
  section("1-3. The form service: the boxes, the robots, a real post");
  {
    const ctx = await newContext(browser);
    const { page, noise, readyAt } = await openDesigner(ctx, "leadform");
    const form = await page.evaluate(() => {
      const m = document.getElementById("quote-mount");
      const names = Array.from(m.querySelectorAll(".qin")).map((e) => e.name);
      const sms = m.querySelector('[name="sms_ok"]');
      const hp = m.querySelector('[name="leave_this_empty"]');
      const vis = (e) => !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== "hidden";
      return { names, sms: sms ? { checked: sms.checked, visible: vis(sms), words: sms.parentElement.textContent } : null,
        hp: hp ? { visible: vis(hp), name: hp.name, auto: hp.getAttribute("autocomplete") } : null,
        btn: m.querySelector(".qsend") && m.querySelector(".qsend").textContent, mode: window.shedUI.quote.mode };
    });
    ok("the boxes the company asks for are there, in Barnwright's order then the new ones (the address as Street and City)", J(form.names) === J(["name", "phone", "zip", "email", "address", "city", "note"]), J(form.names));
    const extra = await page.evaluate(() => {
      const m = document.getElementById("quote-mount");
      const a = m.querySelector(".qaddr");
      const plans = Array.from(m.querySelectorAll('input[name="plan"]'));
      return {
        addr: a ? { head: a.querySelector(".qaddr-l").textContent, ph: Array.from(a.querySelectorAll(".qin")).map((e) => e.placeholder), note: (a.querySelector(".qaddr-note") || {}).textContent, auto: Array.from(a.querySelectorAll(".qin")).map((e) => e.getAttribute("autocomplete")) } : null,
        legend: (m.querySelector(".qplan legend") || {}).textContent,
        plans: plans.map((p) => [p.value, p.parentElement.textContent, p.checked]),
      };
    });
    ok("the address is a question of its own: an Address heading, Street and City boxes a phone can fill in one tap, and 'Can skip if you already sent it to us.'", extra.addr && extra.addr.head === "Address" && J(extra.addr.ph) === J(["Street", "City"]) && extra.addr.note === "Can skip if you already sent it to us." && J(extra.addr.auto) === J(["street-address", "address-level2"]), J(extra.addr));
    ok("'What do you want to do with this quote?' has the four answers, none picked", extra.legend === "What do you want to do with this quote?" && J(extra.plans.map((x) => x[0])) === J(["buy-now", "buy-permit", "engineering", "pricing"]) && extra.plans[0][1] === "Ready to buy now — no permit needed" && extra.plans.every((x) => x[2] === false), J(extra));

    /* 1c. rent to own: the box under the total, the same figure on the plate */
    const rtoAt = async () => page.evaluate(() => ({
      chips: Array.from(document.querySelectorAll("#sum .rtochip")).map((b) => [+b.getAttribute("data-rto"), b.classList.contains("on")]),
      fig: (document.querySelector("#sum .rtomonthly") || {}).textContent, plate: document.getElementById("platerto").textContent,
      note: (document.querySelector("#sum .rtonote") || {}).textContent, total: window.shedUI.price().total, picked: window.shedUI.rentToOwn(),
    }));
    const r60 = await rtoAt();
    const want = (m, f) => "$" + (Math.round((r60.total / f / m) * 100) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    ok("rent to own in 'Your quote': a chip for 36, 48 and 60 months, starting on 60, 'as low as' " + r60.fig + " (the price / 0.45 / 60, to the cent)", J(r60.chips) === J([[36, false], [48, false], [60, true]]) && r60.fig === want(60, 0.45) + "/mo" && /deposit plus the first payment/.test(r60.note || ""), J(r60));
    ok("...and the price plate shows the same figure", r60.plate === " · or " + want(60, 0.45) + "/mo", J(r60.plate));
    await page.click('#sum .rtochip[data-rto="36"]');
    const r36 = await rtoAt();
    ok("tapping 36 months changes the figure and the plate to " + r36.fig + " (the price / 0.60 / 36)", J(r36.chips) === J([[36, true], [48, false], [60, false]]) && r36.fig === want(36, 0.6) + "/mo" && r36.plate === " · or " + want(36, 0.6) + "/mo" && r36.picked && r36.picked.months === 36, J(r36));
    ok("the texting box is there, with the company's words, and NOT ticked", form.sms && form.sms.visible && form.sms.checked === false && form.sms.words.indexOf("Reply STOP to stop") >= 0, J(form.sms));
    ok("the robots' box is on the page but no person can see it (and its name is not one AutoFill knows)", form.hp && !form.hp.visible && form.hp.auto === "off" && !/company|name|email|phone/i.test(form.hp.name), J(form.hp));

    /* 2a. too fast: all filled in and sent at once */
    await fillBasics(page);
    await page.click("#quote-mount .qsend");
    const fast = await waitLast(page);
    const fastWords = await page.textContent("#quote-mount .qresult");
    ok("a request sent within 3 seconds of the form appearing is dropped, with a plain 'just a moment' message", fast.status === "dropped" && fast.why === "too-fast" && /Just a moment/.test(fastWords), J({ fast, fastWords }));

    /* 1b. required boxes */
    await page.fill('#quote-mount [name="name"]', "");
    await page.fill('#quote-mount [name="zip"]', "");
    await pastMinimum(readyAt);
    await page.click("#quote-mount .qsend");
    const inv = await waitLast(page, ["invalid"]);
    const need = await page.evaluate(() => ({ words: document.querySelector("#quote-mount .qresult").textContent, bad: Array.from(document.querySelectorAll("#quote-mount [aria-invalid=true]")).map((e) => e.name), focus: document.activeElement && document.activeElement.name }));
    ok("an unfinished form sends nothing and says in plain words what is missing (name and ZIP), marking those boxes", inv.status === "invalid" && /your name/.test(need.words) && /ZIP code/.test(need.words) && J(need.bad) === J(["name", "zip"]) && need.focus === "name", J({ inv, need }));
    await page.fill('#quote-mount [name="phone"]', "12");
    await page.fill('#quote-mount [name="name"]', "Jane Doe");
    await page.fill('#quote-mount [name="zip"]', "33952");
    await page.fill('#quote-mount [name="email"]', "jane@");
    await page.click("#quote-mount .qsend");
    const inv2 = await waitLast(page, ["invalid"]);
    ok("a phone number that is too short and an e-mail address that is not finished are pointed out", /phone number/.test(inv2.why) && /e-mail address/.test(inv2.why), J(inv2));

    /* 2b. the robots' box filled */
    await fillBasics(page, { email: "jane@example.com" });
    await page.evaluate(() => { document.querySelector('#quote-mount [name="leave_this_empty"]').value = "http://spam.example"; });
    fake.reset();
    await page.click("#quote-mount .qsend");
    const trap = await waitLast(page, ["dropped"]);
    await sleep(800);
    const trapUi = await page.evaluate(() => ({ tel: !!document.querySelector('#quote-mount .qresult a[href^="tel:"]'), copy: !!document.querySelector("#quote-mount .qresult .qcopy"), sum: (document.querySelector("#quote-mount .qsumtext") || {}).textContent || "" }));
    ok("a request with the hidden robots' box filled is dropped: nothing arrives at the form service", trap.status === "dropped" && trap.why === "honeypot" && fake.records.length === 0, J({ trap, arrived: fake.records.length }));
    ok("...and the page still shows the company's phone, a copy-my-link button and the design (a person is never left stuck)", trapUi.tel && trapUi.copy && /Estimated total/.test(trapUi.sum), J(trapUi));
    await page.evaluate(() => { document.querySelector('#quote-mount [name="leave_this_empty"]').value = ""; });

    /* 3. a real post */
    await fillBasics(page, { name: "Jane Doe", email: "jane@example.com", address: "123 Main St", city: "Port Charlotte", note: "Gate is 10 ft wide.", plan: "engineering" });
    await page.check('#quote-mount [name="sms_ok"]');
    fake.reset();
    await page.evaluate(() => { document.querySelector("#quote-mount .qresult").innerHTML = ""; });
    await page.locator("#quote-mount .qsend").scrollIntoViewIfNeeded();
    await page.screenshot({ path: resolve(OUT, "leads-form-page.png") });
    await shot(page, "leads-form.png");
    await page.click("#quote-mount .qsend");
    const got = await fake.waitFor((r) => r.method === "POST" && r.path === "/form", 20000);
    const sent = await waitLast(page, ["sent", "failed"]);
    const onPage = await page.evaluate(() => ({ state: window.shedUI.getState(), total: window.shedUI.price().total, sent: (document.querySelector("#quote-mount .sent") || {}).textContent || "" }));
    ok("the form service receives an ordinary form post (application/x-www-form-urlencoded)", got && /application\/x-www-form-urlencoded/.test(got.headers["content-type"]), got && got.headers["content-type"]);
    ok("with no permission request (preflight) before it", preflights(fake).length === 0, J(preflights(fake)));
    const f = (got && got.fields) || {};
    ok("every box arrives as its own field, as typed", f.name === "Jane Doe" && f.phone === "(941) 555-0123" && f.zip === "33952" && f.email === "jane@example.com" && f.address === "123 Main St" && f.city === "Port Charlotte" && f.note === "Gate is 10 ft wide.", J(f));
    const rtoSent = "$" + (Math.round((onPage.total / 0.6 / 36) * 100) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " a month over 36 months";
    ok("what they want to do arrives in plain words, and the rent-to-own term they were looking at (" + f.rent_to_own + ")", f.plan === "I need engineering plans for permits first" && f.rent_to_own === rtoSent, J({ plan: f.plan, rto: f.rent_to_own, want: rtoSent }));
    ok("...and both are in the summary, with the city", /City: Port Charlotte/.test(f.summary || "") && /What they want to do: I need engineering plans for permits first/.test(f.summary || "") && (f.summary || "").indexOf("Rent to own: as low as " + rtoSent) > 0, f.summary);
    ok("the texting answer arrives (sms_ok = yes, because it was ticked); the robots' box does not", f.sms_ok === "yes" && !("leave_this_empty" in f), J({ sms_ok: f.sms_ok }));
    ok("the building, the total, a subject line and a reply-to arrive", f.building === "10 x 20 Lofted Barn" && f.total === "$" + onPage.total.toLocaleString("en-US", { minimumFractionDigits: 2 }) && /Quote request: 10 x 20 Lofted Barn/.test(f._subject || "") && f._replyto === "jane@example.com", J({ building: f.building, total: f.total, s: f._subject, r: f._replyto }));
    ok("the summary arrives: the company, the building, the total, the customer and the link", /^ACME SHEDS QUOTE REQUEST/.test(f.summary || "") && /Estimated total: \$/.test(f.summary || "") && /Name: Jane Doe/.test(f.summary || "") && (f.summary || "").indexOf(f.link) > 0, f.summary);
    let d = null;
    try { d = await linkDesign(f.link || ""); } catch (e) { d = { error: e.message }; }
    ok("the link opens THIS design, look-only (&view=1), on this designer", /^http:\/\/127\.0\.0\.1:8354\/\?company=leadform#d=/.test(f.link || "") && /&view=1$/.test(f.link || "") && d && d.type === onPage.state.type && d.size === onPage.state.size && d.items.length === onPage.state.items.length, J({ link: (f.link || "").slice(0, 80), d: d && { type: d.type, size: d.size, n: d.items && d.items.length } }));
    ok("the link remembers the price the customer saw (the look-only page compares it with today's)", d && d.priced && Math.abs(d.priced.total - onPage.total) < 0.005 && /^\d{4}-\d{2}-\d{2}$/.test(d.priced.at), J(d && d.priced));
    ok("the page says it was sent, thanking them by first name", sent.status === "sent" && /Quote request sent/.test(onPage.sent) && /Thanks, Jane!/.test(onPage.sent), J({ sent, words: onPage.sent }));
    await shot(page, "leads-sent.png");
    ok("no console errors", realNoise(noise).length === 0, J(realNoise(noise)));
    await ctx.close();
  }

  /* a form service that never answers */
  {
    const ctx = await newContext(browser);
    const { page, noise, readyAt } = await openDesigner(ctx, "leadhang");
    await page.evaluate(() => { window.shedUI.quote.timeoutMs = 2500; });
    await fillBasics(page);
    await pastMinimum(readyAt);
    fake.reset();
    await page.click("#quote-mount .qsend");
    const r = await waitLast(page, ["sent", "failed"], 20000);
    const ui = await page.evaluate(() => ({ tel: !!document.querySelector('#quote-mount .qresult a[href^="tel:"]'), copy: !!document.querySelector("#quote-mount .qcopy"), btn: document.querySelector("#quote-mount .qsend").textContent }));
    ok("a form service that never answers: after the time limit the customer gets the 'reach us directly' box and a Try again button", r.status === "failed" && ui.tel && ui.copy && ui.btn === "Try again", J({ r, ui }));
    ok("no console errors", realNoise(noise).length === 0, J(realNoise(noise)));
    await ctx.close();
  }

  /* ------------------------------------------------------------ 4 */
  section("1d. A company that asks no address and not what they want to do");
  {
    const ctx = await newContext(browser);
    const { page, noise } = await openDesigner(ctx, "leadnoplan");
    const r = await page.evaluate(() => {
      const m = document.getElementById("quote-mount");
      return { names: Array.from(m.querySelectorAll(".qin")).map((e) => e.name), addr: !!m.querySelector(".qaddr"), plan: !!m.querySelector(".qplan"), rto: !!document.querySelector("#sum .rtobox"), plate: document.getElementById("platerto").textContent };
    });
    ok("no Address question (no Street, no City), no 'What do you want to do' question (leads.askPlan false)", J(r.names) === J(["name", "phone", "zip", "email", "note"]) && !r.addr && !r.plan, J(r));
    ok("no rent-to-own box and no monthly price on the plate when the company shows no term", !r.rto && r.plate === "", J(r));
    ok("no console errors", realNoise(noise).length === 0, J(realNoise(noise)));
    await ctx.close();
  }

  section("4. The webhook: text/plain, no preflight, pictures only when asked");
  {
    const ctx = await newContext(browser);
    const { page, noise, readyAt } = await openDesigner(ctx, "leadhook");
    /* a real address with an apostrophe in it must not be turned away */
    await fillBasics(page, { email: "jane.o'hara@example.com" });
    await pastMinimum(readyAt);
    fake.reset();
    await page.click("#quote-mount .qsend");
    /* "invalid" too: a form that turned the address away is a failure to report, not a stall */
    const first = await waitLast(page, ["sent", "failed", "invalid"]);
    const got = first.status === "invalid" ? null : await fake.waitFor((r) => r.method === "POST" && r.path === "/hook", 20000);
    const last = await waitLast(page, ["sent", "failed", "invalid"]);
    const onPage = await page.evaluate(() => ({ design: window.shedUI.getDesign(), total: window.shedUI.price().total }));
    const j = (got && got.json) || {};
    ok("the webhook receives the post as text/plain;charset=UTF-8", got && /^text\/plain;\s*charset=UTF-8$/i.test(got.headers["content-type"]), got && got.headers["content-type"]);
    ok("with no permission request (preflight) before it", preflights(fake).length === 0, J(preflights(fake)));
    ok("it carries design, contact, summary, link and priceComputedBy: \"browser\" -- and no pictures (leads.images is off)", J(Object.keys(j).sort()) === J(["contact", "design", "link", "priceComputedBy", "summary"]) && j.priceComputedBy === "browser", J(Object.keys(j)));
    ok("the contact is what was typed -- an e-mail address with an apostrophe in it (jane.o'hara@...) is accepted -- with the texting answer (not ticked: false)", j.contact && j.contact.name === "Jane Doe" && j.contact.phone === "(941) 555-0123" && j.contact.zip === "33952" && j.contact.email === "jane.o'hara@example.com" && j.contact.smsOk === false, J(j.contact));
    ok("...with the city and what they want to do (nothing picked: empty), and no rent-to-own term (this company shows none)", j.contact && j.contact.city === "" && j.contact.plan === "" && !("rtoMonths" in j.contact), J(j.contact));
    const dd = j.design ? Object.assign({}, j.design) : {};
    delete dd.priced;
    ok("the design is the one on screen (and carries the price the browser worked out)", J(dd) === J(onPage.design) && j.design.priced && Math.abs(j.design.priced.total - onPage.total) < 0.005, J({ got: dd, want: onPage.design }));
    let d = null;
    try { d = await linkDesign(j.link || ""); } catch (e) { d = { error: e.message }; }
    ok("the link decodes to the same design", d && d.type === onPage.design.type && d.size === onPage.design.size && J(d.items) === J(onPage.design.items), J(d));
    ok("the page says it was sent", last.status === "sent", J(last));
    ok("no console errors", realNoise(noise).length === 0, J(realNoise(noise)));
    await ctx.close();
  }
  {
    const ctx = await newContext(browser);
    const { page, noise, readyAt } = await openDesigner(ctx, "leadimg");
    /* sent from the Inside view (the floor plan on screen; customers have
       Outside and Inside only, docs/DIFFERENCES.md #20): the pictures must
       still be of the FINISHED building */
    const inside = await page.evaluate(() => { const v = window.shedUI.views; if (!v || !v.set) return false; v.set("inside"); return v.view === "inside"; });
    await fillBasics(page);
    await pastMinimum(readyAt);
    fake.reset();
    await page.click("#quote-mount .qsend");
    const got = await fake.waitFor((r) => r.method === "POST" && r.path === "/hook", 60000);
    await waitLast(page, ["sent", "failed"], 60000);
    const j = (got && got.json) || {};
    const im = j.images || {};
    const bytes = (im.view || "").length + (im.plan || "").length;
    ok("with leads.images on: a picture of the building (JPEG) and the floor plan ride along", /^data:image\/jpeg;base64,/.test(im.view || "") && /^data:image\/(png|jpeg);base64,/.test(im.plan || ""), J({ view: (im.view || "").slice(0, 30), plan: (im.plan || "").slice(0, 30) }));
    ok("together under 300 KB (" + Math.round(bytes / 1024) + " KB)", bytes > 0 && bytes <= 300 * 1024, bytes);
    ok("still text/plain with no preflight, even this large", got && /^text\/plain/i.test(got.headers["content-type"]) && preflights(fake).length === 0);
    const dims = await page.evaluate(async (srcs) => {
      const load = (s) => new Promise((res) => { const i = new Image(); i.onload = () => res({ w: i.naturalWidth, h: i.naturalHeight }); i.onerror = () => res(null); i.src = s; });
      const v = await load(srcs.view), p = await load(srcs.plan);
      /* the 2x2: four tiles with a building in them (not all background), and
         the building FINISHED: the black roof is there (the framing has none) */
      let busy = 0, dark = 0;
      if (v) {
        const i = new Image(); i.src = srcs.view; await new Promise((r) => { i.onload = r; });
        const c = document.createElement("canvas"); c.width = v.w; c.height = v.h;
        const x = c.getContext("2d"); x.drawImage(i, 0, 0);
        const px = x.getImageData(0, 0, v.w / 2, v.h / 2).data;
        const r0 = px[(Math.floor(v.h / 4) * (v.w / 2) + 4) * 4], g0 = px[(Math.floor(v.h / 4) * (v.w / 2) + 4) * 4 + 1];
        for (let k = 0; k < px.length; k += 4 * 7) if (Math.abs(px[k] - r0) + Math.abs(px[k + 1] - g0) > 60) busy++;
        const all = x.getImageData(0, 0, v.w, v.h).data;
        for (let k = 0; k < all.length; k += 4) if (all[k] < 70 && all[k + 1] < 70 && all[k + 2] < 70) dark++;
      }
      return { v, p, busy, dark };
    }, { view: im.view, plan: im.plan });
    ok("the browser can open both pictures; the building picture is a 2x2 (" + (dims.v ? dims.v.w + "x" + dims.v.h : "none") + ") with a building in it", dims.v && dims.p && dims.v.w % 2 === 0 && dims.v.h % 2 === 0 && dims.busy > 200, J(dims));
    /* the 300 KB cap is only ever reached by a big, busy building, so the
       smaller-and-smaller steps are proved here with a smaller cap */
    const CAP = 60 * 1024;
    const small = await page.evaluate(async (cap) => { const r = await window.shedUI.quote.images(cap); return { bytes: r.bytes, steps: r.steps, view: !!(r.images && r.images.view), plan: !!(r.images && r.images.plan) }; }, CAP);
    ok("with a smaller cap (60 KB) the pictures are made smaller, step by step, until they fit (" + Math.round(small.bytes / 1024) + " KB after " + small.steps + " steps; the building kept)", small.view && small.bytes > 0 && small.bytes <= CAP && small.steps > 1, J(small));
    const after = await page.evaluate(() => ({ view: window.shedUI.views && window.shedUI.views.view, plan: document.querySelector(".stage").classList.contains("bpmode") }));
    ok("sent from the Inside view, the pictures are of the FINISHED building (its black roof is in them: " + dims.dark + " dark pixels)", inside && dims.dark > 2000, J({ inside, dark: dims.dark }));
    ok("...and the screen is left in the Inside view it was in (the floor plan still showing)", after.view === "inside" && after.plan === true, J(after));
    await page.evaluate(() => window.shedUI.views.set("finished"));
    ok("no console errors", realNoise(noise).length === 0, J(realNoise(noise)));
    try { mkdirSync(OUT, { recursive: true }); const buf = Buffer.from((im.view || "").split(",")[1] || "", "base64"); if (buf.length) (await import("node:fs")).writeFileSync(resolve(OUT, "leads-webhook-picture.jpg"), buf); } catch {}
    await ctx.close();
  }
  {
    const ctx = await newContext(browser);
    const { page, noise, readyAt } = await openDesigner(ctx, "leadfail");
    await fillBasics(page);
    await pastMinimum(readyAt);
    fake.reset();
    await page.click("#quote-mount .qsend");
    const last = await waitLast(page, ["sent", "failed"]);
    const want = await page.evaluate(() => window.shedUI.quote.link());
    const ui = await page.evaluate(() => {
      const r = document.querySelector("#quote-mount .qresult");
      return { tel: (r.querySelector('a[href^="tel:"]') || {}).href || "", sms: (r.querySelector('a[href^="sms:"]') || {}).href || "",
        copy: !!r.querySelector(".qcopy"), sum: (r.querySelector(".qsumtext") || {}).textContent || "", err: (r.querySelector(".qerr") || {}).textContent || "" };
    });
    ok("a webhook that answers 500: the page says it could not send", last.status === "failed" && /couldn’t send/.test(ui.err), J({ last, err: ui.err }));
    ok("...and shows Call and Text links with the company's phone", ui.tel === "tel:5550100142" && /^sms:5550100142\?body=/.test(ui.sms), J(ui));
    ok("...and the summary of the design with its link", /ACME SHEDS QUOTE REQUEST/.test(ui.sum) && ui.sum.indexOf(want) > 0, ui.sum);
    await page.click("#quote-mount .qcopy");
    await page.waitForFunction(() => /Copied|blocked/.test(document.querySelector("#quote-mount .qcopy").textContent + document.querySelector("#quote-mount .qcopymsg").textContent), null, { timeout: 5000 });
    let clip = "";
    try { clip = await page.evaluate(() => navigator.clipboard.readText()); } catch (e) { clip = "(could not read: " + e.message + ")"; }
    ok("'Copy my design link' copies the link to the design", clip === want, J({ clip: clip.slice(0, 90), want: want.slice(0, 90) }));
    await shot(page, "leads-fallback.png");
    /* the name typed is sent back to the fallback words, escaped (section 7 has more) */
    ok("no console errors (the browser's own line for the 500 aside)", realNoise(noise, [/status of 500/]).length === 0, J(realNoise(noise, [/status of 500/])));
    await ctx.close();
  }

  /* ------------------------------------------------------------ 5 */
  section("5. E-mail: the customer's own mail app");
  {
    const ctx = await newContext(browser);
    const { page, noise, readyAt } = await openDesigner(ctx, "leadmail");
    const btn = await page.textContent("#quote-mount .qsend");
    await fillBasics(page, { email: "jane@example.com" });
    await pastMinimum(readyAt);
    /* the browser really is asked to open the mail app (not just told about it) */
    const mailOpened = [];
    page.on("request", (rq) => { if (/^mailto:/i.test(rq.url())) mailOpened.push(rq.url()); });
    await page.click("#quote-mount .qsend");
    const last = await waitLast(page, ["opened", "failed"]);
    const want = await page.evaluate(() => window.shedUI.quote.link());
    const href = last.href || "";
    await sleep(300);
    ok("the tap itself asks the browser to open the customer's mail app, with that mail link", mailOpened.length === 1 && mailOpened[0].slice(0, 60) === href.slice(0, 60), J({ opened: mailOpened.map((u) => u.slice(0, 60)), href: href.slice(0, 60) }));
    const body = decodeURIComponent((/[?&]body=([^&]*)/.exec(href) || [])[1] || "");
    const subj = decodeURIComponent((/[?&]subject=([^&]*)/.exec(href) || [])[1] || "");
    ok("the button says what it does ('E-mail my quote request')", /E-mail my quote request/.test(btn), btn);
    ok("the mail link is addressed to the company's leads e-mail, with a subject", /^mailto:quotes@acme\.example\?subject=/.test(href) && /Quote request: 10 x 20 Lofted Barn/.test(subj), href.slice(0, 120));
    ok("it carries the summary and the link to the design, and is under 1,800 characters (" + href.length + ")", /Estimated total/.test(body) && body.indexOf(want) >= 0 && /Name: Jane Doe/.test(body) && href.length <= 1800, J({ len: href.length }));
    const ui = await page.evaluate(() => {
      const r = document.querySelector("#quote-mount .qresult");
      return { ok: (r.querySelector(".qok") || {}).textContent || "", again: (r.querySelector(".qmailagain") || {}).href || "", tel: !!r.querySelector('a[href^="tel:"]'), copy: !!r.querySelector(".qcopy"), sum: (r.querySelector(".qsumtext") || {}).textContent || "" };
    });
    ok("afterwards the page ALWAYS shows the phone, the copy-my-link button and the summary (it cannot know Send was pressed)", /e-mail app should have opened/.test(ui.ok) && ui.again === href && ui.tel && ui.copy && ui.sum.indexOf(want) > 0, J(ui));
    await shot(page, "leads-mailto.png");
    /* a design with 30 priced options */
    await page.click("#quote-mount .qagain");
    /* a long note as well, so the whole summary cannot fit */
    await page.fill('#quote-mount [name="note"]', "We would like the building set on the flat spot behind the garage, next to the old oak tree. ".repeat(9).trim());
    const n = await page.evaluate(() => {
      const api = window.shedUI, d = api.getDesign();
      d.type = "UT"; d.size = "14x40";
      d.items = [];
      for (let i = 0; i < 30; i++) d.items.push({ cat: i % 2 ? "w23" : "w33", wall: ["L", "R"][i % 2], pos: -16 + (i >> 1) * 2.2 });
      api.applyDesign(d);
      return api.price().lines.length;
    });
    await sleep(400);
    await page.click("#quote-mount .qsend");
    await page.waitForFunction(() => { const l = window.shedUI.quote.last; return l && l.status === "opened" && /14%20x%2040/.test(l.href); }, null, { timeout: 10000 });
    const big = await lastOf(page);
    const want2 = await page.evaluate(() => window.shedUI.quote.link());
    const body2 = decodeURIComponent((/[?&]body=([^&]*)/.exec(big.href) || [])[1] || "");
    ok("a design with " + n + " priced options and a long note: the mail link still fits (" + big.href.length + " characters) and still carries the whole link", n >= 25 && big.href.length <= 1800 && body2.indexOf(want2) >= 0, J({ n, len: big.href.length }));
    ok("...by shortening the option list, not the link ('all in the link below')", /all in the link below/.test(body2) && body2.split("\n").length < n, body2.slice(0, 300));
    ok("no console errors (the browser's own note that it has no mail app here aside)", realNoise(noise, [/mailto/i]).length === 0, J(realNoise(noise, [/mailto/i])));
    await ctx.close();
  }

  /* ------------------------------------------------------------ 6 */
  section("6. The company's own page (postMessage): only to an allowed address, never \"*\"");
  const src = fileSrc();
  ok("ui/quote.js never posts a message to \"*\" (every postMessage names the page it is for)", !/postMessage\([^)]*["']\*["']/.test(src) && /postMessage\(JSON\.parse\(JSON\.stringify\(msg\)\), po\)/.test(src));
  async function hostPage(ctx, hostBase, id) {
    const page = await ctx.newPage();
    const noise = listen(page);
    await page.goto(hostBase + "/host.html?src=" + encodeURIComponent(BASE + "/?company=" + id + "&embed=1"), { waitUntil: "load" });
    let frame = null;
    for (let i = 0; i < 200 && !frame; i++) { frame = page.frames().find((f) => f.url().startsWith(BASE)); if (!frame) await sleep(100); }
    await frame.waitForFunction(() => window.shedUI && window.shedUI.ready, null, { timeout: 90000 });
    return { page, frame, noise, readyAt: Date.now() };
  }
  const quoteMsgs = (page) => page.evaluate(() => window.__got.filter((m) => m.data && m.data.type === "shed:quote-requested"));
  {
    const ctx = await newContext(browser);
    /* ALLOWED: the company's page at http://127.0.0.1:8355 is on its embed.origins */
    const { page, frame, noise, readyAt } = await hostPage(ctx, FAKE, "leadpm");
    await fillBasics(frame, { name: "Jane Doe" });
    await pastMinimum(readyAt);
    await frame.click("#quote-mount .qsend");
    await page.waitForFunction(() => window.__got.some((m) => m.data && m.data.type === "shed:quote-requested"), null, { timeout: 15000 }).catch(() => {});
    const msgs = await quoteMsgs(page);
    const m = msgs[0] || {};
    const post = await frame.evaluate(() => window.shedUI.quote.lastPost);
    const lastA = await frame.evaluate(() => window.shedUI.quote.last);
    ok("inside the company's own (allowed) page: the request arrives there, once, from the designer's address", msgs.length === 1 && m.origin === BASE, J(msgs.map((x) => x.origin)));
    ok("it carries design, contact, summary, link and priceComputedBy", m.data && m.data.contact && m.data.contact.name === "Jane Doe" && m.data.design && m.data.design.type && /#d=/.test(m.data.link || "") && /Jane Doe/.test(m.data.summary || "") && m.data.priceComputedBy === "browser", J(m.data && Object.keys(m.data)));
    ok("the designer addressed it to that page's exact address (" + (post && post.origin) + "), not \"*\"", post && post.origin === FAKE && post.withContact === true, J(post));
    ok("the customer is told it was sent", lastA.status === "sent", J(lastA));
    await page.screenshot({ path: resolve(OUT, "leads-host-page.png") });
    ok("no console errors", realNoise(noise).length === 0, J(realNoise(noise)));

    /* NOT ALLOWED: the same page at http://localhost:8355 -- a different address to a browser */
    const other = await hostPage(ctx, "http://localhost:" + FPORT, "leadpm");
    await fillBasics(other.frame, { name: "Jane Doe" });
    await pastMinimum(other.readyAt);
    await other.frame.click("#quote-mount .qsend");
    const lastB = await waitLast(other.frame, ["sent", "failed"]);
    await sleep(500);
    const all = await other.page.evaluate(() => window.__got);
    const ui = await other.frame.evaluate(() => ({ tel: !!document.querySelector('#quote-mount .qresult a[href^="tel:"]'), copy: !!document.querySelector("#quote-mount .qcopy"), post: window.shedUI.quote.lastPost }));
    ok("inside a page NOT on the company's list: nothing about the customer reaches that page", !JSON.stringify(all).includes("Jane Doe") && !all.some((x) => x.data && x.data.type === "shed:quote-requested"), J(all));
    ok("...the designer posted nothing, and the customer gets the 'reach us directly' box", lastB.status === "failed" && ui.post === null && ui.tel && ui.copy, J({ lastB, ui }));
    ok("no console errors", realNoise(other.noise).length === 0, J(realNoise(other.noise)));

    /* the designer opened on its own (no page around it) */
    const alone = await openDesigner(ctx, "leadpm");
    await fillBasics(alone.page);
    await pastMinimum(alone.readyAt);
    await alone.page.click("#quote-mount .qsend");
    const lastC = await waitLast(alone.page, ["sent", "failed"]);
    ok("the postMessage designer opened on its own (in no company page): the 'reach us directly' box", lastC.status === "failed" && /not inside/.test(lastC.why), J(lastC));

    /* another mode inside an allowed page: told, WITHOUT the customer's details */
    const emb = await hostPage(ctx, FAKE, "leademb");
    await fillBasics(emb.frame, { name: "Jane Doe" });
    await pastMinimum(emb.readyAt);
    fake.reset();
    await emb.frame.click("#quote-mount .qsend");
    await waitLast(emb.frame, ["sent", "failed"]);
    await emb.page.waitForFunction(() => window.__got.some((m) => m.data && m.data.type === "shed:quote-requested"), null, { timeout: 10000 }).catch(() => {});
    const em = await quoteMsgs(emb.page);
    ok("a webhook designer inside an allowed page tells that page a quote was requested -- without the customer's name, phone or summary", em.length === 1 && em[0].data.sent === true && em[0].data.mode === "webhook" && !("contact" in em[0].data) && !("summary" in em[0].data) && !J(em[0].data).includes("Jane Doe") && !J(em[0].data).includes("555-0123"), J(em.map((x) => x.data && Object.keys(x.data))));
    ok("...and the webhook itself still got the whole request", fake.records.some((r) => r.path === "/hook" && r.json && r.json.contact && r.json.contact.name === "Jane Doe"));
    await ctx.close();
  }

  /* ------------------------------------------------------------ 7 */
  section("7. Escaping: nothing a customer or a company types can run");
  {
    const ctx = await newContext(browser);
    /* the elements the typed words WOULD have made, had they been read as HTML
       (the page's own bold words are not counted) */
    await ctx.addInitScript(() => {
      window.planted = (m) => m.querySelectorAll("img, script").length +
        Array.from(m.querySelectorAll("b, i")).filter((e) => /^(Sheds|really)$/.test(e.textContent)).length;
    });
    const { page, noise, readyAt } = await openDesigner(ctx, "leadesc");
    const evil = 'Jane <img src=x onerror="window.__pwned=1"> Doe';
    await fillBasics(page, { name: evil, note: "<script>window.__pwned=2</script>" });
    await pastMinimum(readyAt);
    fake.reset();
    await page.click("#quote-mount .qsend");
    const got = await fake.waitFor((r) => r.path === "/hook", 20000);
    await waitLast(page, ["sent", "failed"]);
    const r = await page.evaluate(() => {
      const m = document.getElementById("quote-mount");
      return { pwned: window.__pwned, els: planted(m), sent: (m.querySelector(".qsentwords") || {}).textContent || "",
        req: (m.querySelector(".qreq") || {}).textContent || "", sms: (m.querySelector(".qsms") || {}).textContent || "" };
    });
    ok("a customer named with an <img onerror> tag: the thank-you shows the characters, nothing runs, no element is made", r.pwned === undefined && r.els === 0 && r.sent.indexOf("Thanks, Jane!") === 0, J(r));
    ok("a company named 'Acme <b>Sheds</b> & \"Co\"' shows exactly that, and texting words with <i> show the <i>", r.req.indexOf('Acme <b>Sheds</b> & "Co"') >= 0 && r.sms.indexOf("<i>really</i>") >= 0, J({ req: r.req, sms: r.sms }));
    ok("the webhook receives the name exactly as typed (escaping is for the screen, not the data)", got && got.json && got.json.contact.name === evil, got && got.json && got.json.contact.name);
    /* the same name on the fallback box */
    COS.leadesc.leads.url = FAKE + "/fail";
    const p2 = await openDesigner(ctx, "leadesc");
    await fillBasics(p2.page, { name: evil });
    await pastMinimum(p2.readyAt);
    await p2.page.click("#quote-mount .qsend");
    await waitLast(p2.page, ["failed", "sent"]);
    const r2 = await p2.page.evaluate(() => {
      const m = document.getElementById("quote-mount");
      return { pwned: window.__pwned, els: planted(m), sum: (m.querySelector(".qsumtext") || {}).textContent || "", err: (m.querySelector(".qerr") || {}).textContent || "",
        call: (m.querySelector(".shcall") || {}).textContent || "", tel: (m.querySelector(".shcall") || {}).getAttribute ? m.querySelector(".shcall").getAttribute("href") : "" };
    });
    ok("...and on the 'reach us directly' box: the summary shows the name as typed, the company name as typed, a company phone with an <img> tag in it shows as typed, nothing runs", r2.pwned === undefined && r2.els === 0 && r2.sum.indexOf(evil) >= 0 && r2.err.indexOf('Acme <b>Sheds</b> & "Co"') >= 0 && r2.call.indexOf('<img src=x onerror="window.__pwned=true">') >= 0 && r2.tel === "tel:5550100142", J(r2));
    ok("no console errors", realNoise(noise).length === 0 && realNoise(p2.noise, [/status of 500/]).length === 0, J(realNoise(noise).concat(realNoise(p2.noise, [/status of 500/]))));
    await ctx.close();
  }

  /* ------------------------------------------------------------ 7b */
  section("7b. A company with no phone number or e-mail on file");
  {
    const ctx = await newContext(browser);
    const { page, noise, readyAt } = await openDesigner(ctx, "leadbare");
    await fillBasics(page);
    await pastMinimum(readyAt);
    await page.click("#quote-mount .qsend");
    await waitLast(page, ["sent", "failed"]);
    const b = await page.evaluate(() => { const r = document.querySelector("#quote-mount .qresult"); return { err: (r.querySelector(".qerr") || {}).textContent || "", links: r.querySelectorAll(".shcontact a").length, copy: !!r.querySelector(".qcopy") }; });
    ok("when the company has no phone or e-mail to show, the failure box does not promise a way to 'reach them directly below' -- it says to copy the link and send it to them", /copy the link to your design below and send it to Bare Sheds/.test(b.err) && !/directly below/.test(b.err) && b.links === 0 && b.copy, J(b));
    ok("no console errors (the browser's own line for the 500 aside)", realNoise(noise, [/status of 500/]).length === 0, J(realNoise(noise, [/status of 500/])));
    await ctx.close();
  }

  /* ------------------------------------------------------------ 8 */
  section("8. A showroom (leads.mode none)");
  {
    const ctx = await newContext(browser);
    const { page, noise } = await openDesigner(ctx, "leadnone");
    const r = await page.evaluate(() => ({ html: document.getElementById("quote-mount").innerHTML, mode: window.shedUI.quote.mode, share: !!document.querySelector("#share-mount .sharebtn") }));
    ok("no quote form at all (the Share button stays)", r.html === "" && r.mode === "none" && r.share, J(r));
    ok("no console errors", realNoise(noise).length === 0, J(realNoise(noise)));
    await ctx.close();
  }
} catch (e) {
  ok("the check ran to the end", false, e && e.stack || e);
} finally {
  if (browser) await browser.close();
  if (fake) await fake.stop();
  stopServers();
}

function fileSrc() { return readFileSync(resolve(ROOT, "ui/quote.js"), "utf8"); }

console.log(`\ncheck-leads: ${pass} passed, ${fail} failed`);
if (fail) { console.log("FAILED:\n - " + failures.join("\n - ")); process.exit(1); }
console.log("PROVED: a quote request reaches the company every way a company can receive one -- a form service (an ordinary post with every box, the summary and a link that opens the same building), a webhook (text/plain with no preflight, pictures only when asked and under 300 KB), the customer's own e-mail (under 1,800 characters, never losing the link) and the company's own page (only an allowed address, never \"*\") -- the address (Street and City), what they want to do and the rent-to-own term they looked at ride along; robots and unfinished forms send nothing, a failure always leaves the customer the phone number, their link and their design, and nothing typed can run on the page.");
process.exit(0);
