/* A PRETEND FORM SERVICE, A PRETEND WEBHOOK AND A PRETEND COMPANY WEB PAGE,
   FOR THE CHECKS ONLY. Node 22, no dependencies. Nothing on the real site
   uses this file.

   The quote form (ui/quote.js) sends a customer's design to places this repo
   does not own: a form service a company already uses (Formspree, Basin ...),
   a webhook (Zapier, Make ...), or the company's own page the designer is
   embedded in. A check cannot send real leads to real services, so this
   small server stands in for all of them and WRITES DOWN everything it is
   sent, so the check can read back exactly what arrived.

     const fake = await startFakeEndpoints({ port: 8355 });
     fake.url              "http://127.0.0.1:8355"
     fake.records          every request, oldest first (see below)
     fake.reset()          forget them
     fake.waitFor(fn, ms)  resolves with the first record fn() accepts
     await fake.stop()

   Each record: { at, method, path, query, headers: {content-type, origin,
   referer, access-control-request-method, access-control-request-headers},
   body (the raw text), fields (a form post, parsed), json (a webhook post,
   parsed, or null) }.

   The addresses it answers:
     POST /form     a form service: keeps the fields, answers a thank-you page
     POST /hook     a webhook: keeps the body, answers 200 {"ok":true} and the
                    header that lets a browser see the answer
                    (Access-Control-Allow-Origin: *), as Zapier and Make do
     POST /fail     a webhook that is broken today: answers 500 (with the same
                    header, so the page can SEE that it failed)
     POST /hang     a service that never answers (until stop())
     OPTIONS any    a "preflight" -- a browser asking permission before it
                    sends. It is WRITTEN DOWN (the check proves none happens:
                    the designer's posts are the simple kind that need none)
                    and answered permissively, so a preflight is never hidden
                    by being refused.
     GET /host.html?src=<address>   a stand-in for a company's own web page:
                    it shows the designer at <address> in a frame and keeps
                    every message the frame sends it in window.__got, as
                    {origin, data}. Served on 127.0.0.1 and on localhost (two
                    different "origins" to a browser, so one can be on a
                    company's allowed list and the other not).
     GET /log       the records, as JSON (for looking by hand). */

import { createServer } from "node:http";

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function hostPage(src) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>A company's own page</title>
<script>
window.__got = [];
window.addEventListener("message", function (e) { window.__got.push({ origin: e.origin, data: e.data }); });
</script></head><body style="margin:0;font-family:sans-serif">
<p style="margin:6px 10px">A pretend company web page with the designer in it.</p>
<iframe id="designer" src="${esc(src)}" style="width:1000px;height:780px;border:0;display:block" allow="clipboard-write"></iframe>
</body></html>`;
}

export async function startFakeEndpoints(opts) {
  opts = opts || {};
  const port = opts.port || 8355;
  const host = opts.host || "127.0.0.1";
  const records = [];
  const hanging = new Set();
  const waiters = [];

  function note(rec) {
    records.push(rec);
    for (const w of waiters.slice()) {
      if (w.fn(rec)) { waiters.splice(waiters.indexOf(w), 1); clearTimeout(w.timer); w.resolve(rec); }
    }
  }

  const server = createServer((req, res) => {
    const u = new URL(req.url, "http://" + (req.headers.host || host));
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const body = Buffer.concat(chunks).toString("utf8");
      const h = req.headers;
      const rec = {
        at: Date.now(), method: req.method, path: u.pathname, query: Object.fromEntries(u.searchParams),
        headers: {
          "content-type": h["content-type"] || "", origin: h.origin || "", referer: h.referer || "",
          "access-control-request-method": h["access-control-request-method"] || "",
          "access-control-request-headers": h["access-control-request-headers"] || "",
        },
        body, fields: null, json: null,
      };
      if (/application\/x-www-form-urlencoded/.test(rec.headers["content-type"])) rec.fields = Object.fromEntries(new URLSearchParams(body));
      if (req.method === "POST" && /^\/(hook|fail|hang)$/.test(u.pathname)) { try { rec.json = JSON.parse(body); } catch { rec.json = null; } }

      const cors = { "Access-Control-Allow-Origin": "*" };
      if (req.method === "OPTIONS") {
        note(rec);
        res.writeHead(204, Object.assign({ "Access-Control-Allow-Methods": "POST, GET, OPTIONS", "Access-Control-Allow-Headers": "*" }, cors));
        return res.end();
      }
      if (req.method === "GET" && u.pathname === "/host.html") {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
        return res.end(hostPage(u.searchParams.get("src") || "about:blank"));
      }
      if (req.method === "GET" && u.pathname === "/log") {
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify(records, null, 1));
      }
      if (req.method === "GET" && u.pathname === "/favicon.ico") { res.writeHead(404); return res.end(); }
      if (req.method !== "POST") { res.writeHead(404, cors); return res.end("not here"); }
      note(rec);
      if (u.pathname === "/form") {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        return res.end("<!doctype html><meta charset=utf-8><title>Thanks</title><p>Thanks, your form was received.</p>");
      }
      if (u.pathname === "/hook") {
        res.writeHead(200, Object.assign({ "Content-Type": "application/json" }, cors));
        return res.end('{"ok":true}');
      }
      if (u.pathname === "/fail") {
        res.writeHead(500, Object.assign({ "Content-Type": "text/plain" }, cors));
        return res.end("broken today");
      }
      if (u.pathname === "/hang") { hanging.add(res); return; }
      res.writeHead(404, cors); res.end("not here");
    });
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, resolve);
  });

  return {
    url: "http://" + host + ":" + port,
    port, records,
    reset() { records.length = 0; },
    waitFor(fn, ms) {
      const hit = records.find(fn);
      if (hit) return Promise.resolve(hit);
      return new Promise((resolve) => {
        const w = { fn, resolve, timer: setTimeout(() => { waiters.splice(waiters.indexOf(w), 1); resolve(null); }, ms || 10000) };
        waiters.push(w);
      });
    },
    async stop() {
      for (const r of hanging) { try { r.destroy(); } catch {} }
      hanging.clear();
      const closed = new Promise((resolve) => server.close(() => resolve()));
      if (server.closeAllConnections) server.closeAllConnections();
      await closed;
    },
  };
}
