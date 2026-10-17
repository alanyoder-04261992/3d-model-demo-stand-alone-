/* CHECK: external quote replies and failures are described truthfully.
   check-all: browser
   Run: node tools/check-quote.mjs
   A real browser sends the real quote form to two local origins. The small
   fixture installs only the quote plugin; WebGL and rendering are unused.
   It proves that a form service on another site whose page loads in the
   hidden frame says "Quote request sent" (its page can never be read, so
   nothing surer is possible; review 17 F4), while a same-site HTML answer,
   a timeout, and opening a tab or mail app never claim receipt. Observable
   JSON acknowledgements and failures are distinguished. Each request is
   sent once, and the contact details, design and direct-contact fallback
   survive an unconfirmed answer. No external service receives a message. */

import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { loadCatalogue } from "./lib/load.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cat = JSON.parse(JSON.stringify(loadCatalogue("demo")));
cat.brand = { ...cat.brand, name: "Acme Sheds", short: "Acme Sheds", phone: "(555) 010-0142", email: "sales@acme.example" };
const requests = [], arrivals = new Set(), hanging = new Set(), servers = [];
let pass = 0;
function ok(name, condition) { assert.ok(condition, name); pass++; console.log("  ok   " + name); }

async function start() {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, "http://" + req.headers.host);
    if (req.method === "POST") {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const request = { url: url.href, path: url.pathname, fields: Object.fromEntries(new URLSearchParams(Buffer.concat(chunks).toString())), contentType: req.headers["content-type"] };
      requests.push(request);
      for (const arrived of arrivals) arrived(request);
      if (url.pathname === "/provider/hang") { hanging.add(res); return; }
      const kind = url.pathname.split("/").pop();
      res.writeHead(kind === "fail" ? 503 : 200, { "Content-Type": /^(ok|success|refuse|empty)$/.test(kind) ? "application/json" : "text/html" });
      res.end({ ok: '{"ok":true}', success: '{"success":true}', refuse: '{"success":false}', empty: '{}' }[kind] || '<!doctype html><title>Form response</title><p>Please complete verification or try later.</p>');
      return;
    }
    if (url.pathname === "/host") {
      res.writeHead(200, { "Content-Type": "text/html" });
      return res.end('<!doctype html><script>window.events=[];addEventListener("message",e=>events.push(e.data))</script><iframe id="designer" src="/fixture' + url.search.replace(/&/g, "&amp;").replace(/"/g, "&quot;") + '"></iframe>');
    }
    if (url.pathname === "/fixture") {
      res.writeHead(200, { "Content-Type": "text/html" });
      return res.end(`<!doctype html><div id="quote-mount"></div><script type="module">
        import {install} from '/ui/quote.js';
        import {defaults,fromState} from '/model/design.js';
        import {priceParts} from '/model/pricing.js';
        const cat=${JSON.stringify(cat)};
        cat.embed={origins:[location.origin],shareUrl:''};
        const state=defaults(cat);
        window.shedUI={getCatalogue:()=>cat,getState:()=>state,getDesign:opts=>fromState(state,cat,opts),price:()=>priceParts(state,cat),on:()=>()=>{}};
        window.resetQuote=({mode='form',provider='',target='frame',timeoutMs=20000}={})=>{
          cat.leads={mode,url:provider,target,email:'quotes@acme.example',askPlan:false,fields:{name:'required',phone:'required',email:'optional',zip:'required',address:'optional',note:'optional'}};
          Object.defineProperty(performance,'now',{configurable:true,value:()=>0});
          install(window.shedUI);
          Object.defineProperty(performance,'now',{configurable:true,value:()=>5000});
          window.shedUI.quote.timeoutMs=timeoutMs;
        };
        window.resetQuote();
        window.ready=true;
      </script>`);
    }
    if (url.pathname === "/favicon.ico") { res.writeHead(204); return res.end(); }
    const file = resolve(ROOT, "." + url.pathname);
    if (!file.startsWith(ROOT + "/")) { res.writeHead(404); return res.end(); }
    try {
      const data = await readFile(file);
      res.writeHead(200, { "Content-Type": extname(file) === ".js" ? "text/javascript" : "text/css" }); res.end(data);
    } catch { res.writeHead(404); res.end(); }
  });
  servers.push(server);
  await new Promise(r => server.listen(0, "127.0.0.1", r));
  return "http://127.0.0.1:" + server.address().port;
}

let browser;
async function waitForArrival(provider) {
  if (requests.some(r => r.url === provider)) return;
  await new Promise((resolveArrival, reject) => {
    const arrived = request => {
      if (request.url !== provider) return;
      clearTimeout(timer); arrivals.delete(arrived); resolveArrival();
    };
    const timer = setTimeout(() => { arrivals.delete(arrived); reject(new Error("quote POST did not arrive: " + provider)); }, 90000);
    arrivals.add(arrived);
  });
}

try {
  const base = await start(), foreign = await start();
  const require = createRequire(import.meta.url);
  const { chromium } = require("/opt/node22/lib/node_modules/playwright/index.js");
  browser = await chromium.launch({ args: ["--disable-webgl"] });
  const page = await browser.newPage();
  page.setDefaultTimeout(90000);
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  await page.goto(base + "/host");
  const frame = page.frameLocator("#designer");
  await frame.locator(".qsend").waitFor();
  /* Keep target=tab on this single page: it still submits a genuine native
     POST into a named frame; this check observes its unconfirmed state. */
  async function run(kind, { outside = false, target = "frame", mode = "form" } = {}) {
    console.log(`Checking ${mode}, ${target}, ${outside ? "cross-origin" : "same-origin"} ${kind}…`);
    requests.length = 0;
    const provider = (outside ? foreign : base) + "/provider/" + kind;
    await page.evaluate(() => { window.events=[]; });
    await frame.locator("body").evaluate((body, settings) => window.resetQuote(settings), { provider, target, mode, timeoutMs: kind === "hang" ? 500 : 20000 });
    /* This fixture tests transport and receipts; the full leads check covers
       typing and validation. Fill its contact fields in one browser call. */
    await frame.locator("body").evaluate(() => {
      for (const [name,value] of Object.entries({name:'Jane Doe',phone:'(941) 555-0123',zip:'33952',email:'jane@example.com',note:'Gate is 10 ft wide.'})) {
        const input=document.querySelector(`[name="${name}"]`);
        input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));
      }
    });
    if (target === "tab") await frame.locator("body").evaluate(() => {
      const receiver=document.createElement('iframe');receiver.name='quote-test-tab';document.body.appendChild(receiver);
      const submit=HTMLFormElement.prototype.submit;
      HTMLFormElement.prototype.submit=function(){if(this.target==='_blank')this.target='quote-test-tab';return submit.call(this)};
    });
    if (mode === "mailto") await frame.locator("body").evaluate(() => {
      /* The test mail app records the composed message. Letting Chromium
         launch an unavailable desktop app can replace this fixture frame. */
      document.addEventListener('click',event=>{
        const anchor=event.target instanceof Element?event.target.closest('a'):null;
        if(anchor?.href.startsWith('mailto:')){window.openedMail=anchor.href;event.preventDefault()}
      },true);
    });
    await frame.locator(".qsend").click();
    await frame.locator(".qresult").locator(".sent,.qunconfirmed,.qerr,.qok,.errbox").waitFor();
    const result = await frame.locator("body").evaluate(() => ({
      last:window.shedUI.quote.last, words:document.querySelector('.qresult').textContent,
      sent:!!document.querySelector('.sent'), copy:!!document.querySelector('.qcopy'),
      tel:!!document.querySelector('.qresult a[href^="tel:"]'),
      summary:document.querySelector('.qsumtext')?.textContent||'',
      name:document.querySelector('[name="name"]').value,
      mail:window.openedMail||'',
    }));
    if (["sent", "unconfirmed", "opened"].includes(result.last.status)) await page.waitForFunction(() => window.events.some(e => e.type === 'shed:quote-requested'));
    result.events = await page.evaluate(() => window.events.filter(e => e.type === 'shed:quote-requested'));
    /* A tab-open result can precede its network request. Wait for the
       actual server receipt before resetting records for the next case. */
    if (mode === "form") await waitForArrival(provider);
    return result;
  }
  function unconfirmed(name, r) {
    ok(name, r.last.status === "unconfirmed" && !r.sent && !/Quote request sent/.test(r.words));
    ok(name + ": contact details and design fallback survive", r.name === "Jane Doe" && r.tel && r.copy && /Name: Jane Doe/.test(r.summary) && /See it in 3D:.*#d=/.test(r.summary));
    ok(name + ": parent receives no false sent flag or customer details", r.events.length === 1 && r.events[0].sent === false && r.events[0].status === "unconfirmed" && !r.events[0].contact && !r.events[0].summary && !JSON.stringify(r.events).includes("Jane Doe"));
  }
  /* A form service on another site (Formspree and the like): its page
     loading in the hidden frame is the only answer a browser can see, so
     the customer is told it was sent (review 17 F4). */
  function sentToOtherSite(name, r) {
    ok(name, r.last.status === "sent" && r.sent && /Quote request sent/.test(r.words) && /Thanks, Jane!/.test(r.words) && !/confirm your quote request/i.test(r.words));
    ok(name + ": parent is told it was sent, without customer details", r.events.length === 1 && r.events[0].sent === true && r.events[0].status === "sent" && !JSON.stringify(r.events).includes("Jane Doe"));
  }
  const crossSite = await run("html", { outside: true });
  sentToOtherSite("cross-origin form service page loading says Quote request sent", crossSite);
  /* The trade-off, written down (waiting for Alan's yes): a browser cannot
     read a page from another site, so when the form service is down
     (HTTP 503) or shows an "are you human?" page, the customer ALSO sees
     "Quote request sent". The fixture's HTML page above is such a
     verification page; this is the service being down. */
  sentToOtherSite("known trade-off: a cross-origin HTTP 503 (form service down) also says Quote request sent", await run("fail", { outside: true }));
  ok("cross-origin HTTP 503 sends once", requests.length === 1);
  ok("cross-origin form preserves its URL-encoded fields and sends once", requests.length === 1 && /application\/x-www-form-urlencoded/.test(requests[0].contentType) && requests[0].fields.name === "Jane Doe" && requests[0].fields.email === "jane@example.com" && requests[0].fields.note === "Gate is 10 ft wide." && requests[0].fields.link.includes("#d="));
  unconfirmed("same-origin HTTP 200 HTML is unconfirmed", await run("html"));
  unconfirmed("JSON without acknowledgement is unconfirmed", await run("empty"));
  for (const kind of ["ok", "success"]) {
    const r = await run(kind);
    ok(kind + ": explicit provider acknowledgement is sent", r.last.status === "sent" && r.sent && /Quote request sent/.test(r.words) && r.events.length === 1 && r.events[0].sent === true && requests.length === 1);
  }
  for (const kind of ["fail", "refuse"]) {
    const r = await run(kind);
    ok(kind + ": observable refusal is failed with contact/design fallback", r.last.status === "failed" && !r.sent && r.tel && r.copy && r.events.length === 0 && requests.length === 1);
  }
  unconfirmed("cross-origin timeout is unconfirmed", await run("hang", { outside: true }));
  ok("timeout sends once and never retries automatically", requests.length === 1);
  unconfirmed("same-origin timeout is unconfirmed", await run("hang"));
  unconfirmed("target=tab asks customer to finish and confirm", await run("fail", { outside: true, target: "tab" }));
  ok("target=tab describes the customer's next step", /Finish your request in the new tab/.test(await page.frameLocator("#designer").locator(".qresult").textContent()));
  const mail = await run("html", { mode: "mailto" });
  ok("opening mail app never claims receipt", mail.last.status === "opened" && mail.mail.startsWith("mailto:quotes@acme.example?") && !mail.sent && mail.tel && mail.copy && mail.events.length === 1 && mail.events[0].sent === false && mail.events[0].status === "opened" && requests.length === 0);
  ok("quote pipeline has no page errors", errors.length === 0);
  console.log(`PROVED: ${pass} quote acknowledgement and fallback checks passed.`);
} finally {
  await browser?.close();
  for (const res of hanging) res.destroy();
  for (const server of servers) await new Promise(r => server.close(r));
}
