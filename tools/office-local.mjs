/* THE DEALER CENTER ON YOUR OWN COMPUTER, with a sample business.

   Run:  npm run office                 (or node tools/office-local.mjs)
         npm run office -- --reset      start the sample data again
         npm run office -- --empty      no sample data: try the first setup
                                        (sign in as owner@example.com)
         npm run office -- --port 8390  another port
         npm run office -- --control-room      as a business connected to a
                                        pretend Barnwright control room (3
                                        open lots in its plan) and a
                                        pretend Sales Inbox for the Help
                                        screen; add --control-room-off to
                                        start with the account switched off

   Then open http://127.0.0.1:8383/dealer

   It runs the same server code as the live site (server/office/) with:
     * the data in .office-local/ (a folder, never published);
     * sign-in replaced by "pick who you are" (only on this computer --
       the live site always uses Netlify Identity);
     * the lot designer links (/d/riverside/) served with the same
       security policy as the live site, so a quote sent from a lot's 3D
       designer shows up in the Dealer Center;
     * the Dealer Center's script bundled on the fly (esbuild), as the
       build does for the live site.
   It listens on 127.0.0.1 only. */

import http from "node:http";
import { readFileSync, existsSync, statSync, rmSync } from "node:fs";
import { resolve, dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import { Readable } from "node:stream";
import { context as esbuildContext } from "esbuild";
import { createOffice } from "../server/office/index.js";
import { lotDesignerPage, closedPage, OFFICE_POLICY } from "../server/office/pages.js";
import { inlineScriptHashes } from "./build-headers.mjs";
import { FileBlobs } from "./lib/file-blobs.mjs";
import { seedSample, SAMPLE_PEOPLE } from "../server/office/sample.js";
import { TenantLicenseClient, createLeaseStore } from "../server/office/control-room.js";
import { fakeControlRoom } from "./lib/fake-control-room.mjs";
import { fakeHelpInbox } from "./lib/fake-help-inbox.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const value = (name, fallback) => { const i = args.indexOf(name); return i >= 0 && args[i + 1] ? args[i + 1] : fallback; };
const PORT = Number(value("--port", process.env.PORT || 8383));
const DATA = resolve(ROOT, value("--data", ".office-local"));
const EMPTY = flag("--empty");
const OWNER_EMAIL = value("--owner", EMPTY ? "owner@example.com" : SAMPLE_PEOPLE[0].email);
const CONTROL_ROOM = flag("--control-room") || flag("--control-room-off");

if (process.env.NETLIFY || process.env.NETLIFY_BLOBS_CONTEXT) {
  console.log("FAIL: the local Dealer Center is for your own computer, not for Netlify.");
  process.exit(1);
}
if (flag("--reset") && existsSync(DATA)) rmSync(DATA, { recursive: true });

const json = (p) => JSON.parse(readFileSync(resolve(ROOT, p), "utf8"));
const manufacturer = json("library/manufacturers/standard.json");
const library = json("library/construction.json");
const templates = { full: json("companies/demo/company.json"), small: json("companies/starter/company.json") };

/* ---- who is signed in (a cookie that holds an email) --------------------- */

const requestStore = new AsyncLocalStorage();
const COOKIE = "dealer_local_user";
function localUserFrom(email) {
  if (!email) return null;
  const sample = SAMPLE_PEOPLE.find((p) => p.email === email);
  const id = sample ? sample.id : "local-" + createHash("sha256").update(email).digest("hex").slice(0, 16);
  return { id, email, name: sample?.name || "", confirmedAt: "2026-01-01T00:00:00Z", emailVerified: true };
}
function cookieEmail(request) {
  for (const part of (request.headers.get("cookie") || "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === COOKIE) {
      const email = decodeURIComponent(v.join("="));
      if (/^[^\s@]+@[^\s@]+$/.test(email)) return email.toLowerCase();
    }
  }
  return null;
}

let seeding = null;          /* during seeding, the person the sample script acts as */
const clock = { at: null };
const blobs = new FileBlobs(DATA);
const deps = {
  blobs,
  identityUser: async (request) => (seeding ? seeding.user : localUserFrom(cookieEmail(request || requestStore.getStore()))),
  ownerEmail: OWNER_EMAIL,
  manufacturer, library, templates,
  now: () => clock.at || new Date(),
  siteUrl: `http://127.0.0.1:${PORT}`,
  signIn: "local",
  log: (...a) => console.error(...a),
};
/* --control-room: a pretend Barnwright control room in this process
   (tools/lib/fake-control-room.mjs). POST /__local/control-room with
   {status: "active" | "deactivated", down: true | false, dealerLimit: n}
   changes it; POST /__local/control-room/check runs a support check.
   It comes with a pretend Sales Inbox for the Help screen
   (tools/lib/fake-help-inbox.mjs): POST /__local/help-inbox with
   {answer: "words"} answers the newest question still waiting (or the one
   with {id}), {down: true | false} makes it unreachable or not; the answer
   lists the questions and problem reports it holds.
   Without --control-room the Dealer Center is not connected: Help shows
   its answers and the email to write to. */
const roomClock = { get t() { return (clock.at || new Date()).getTime(); } };
const room = CONTROL_ROOM ? fakeControlRoom({ clock: roomClock, dealerLimit: 3 }) : null;
const helpInbox = room ? fakeHelpInbox({ clock: roomClock, publicKeyPem: room.publicKeyPem }) : null;
const office = createOffice({
  ...deps,
  license: room ? new TenantLicenseClient({
    controlRoomUrl: room.origin, customerId: room.business.id, siteId: room.business.siteId,
    activationKey: room.business.key, publicKeyPem: room.publicKeyPem,
    store: createLeaseStore(room.business.id, room.business.siteId, blobs), fetch: room.fetch,
  }) : undefined,
  help: helpInbox ? { url: helpInbox.origin, fetch: helpInbox.fetch } : null,
  appVersion: "dealer-center local",
});

if (!EMPTY && !existsSync(join(DATA, encodeURIComponent("price-list") + ".json"))) {
  process.stdout.write("Making the sample business (Sample Storage Barns, 3 lots, 30 customers)... ");
  const t = Date.now();
  await seedSample({
    office: room ? createOffice(deps) : office, clock, manufacturer, library,
    act: (person) => { seeding = person ? { user: localUserFrom(person.email) } : { user: null }; },
  });
  seeding = null;
  console.log(`done in ${((Date.now() - t) / 1000).toFixed(1)} s.`);
}
if (room) {
  if (flag("--control-room-off")) room.business.status = "deactivated";
  console.log(`Connected to a pretend Barnwright control room: account ${room.business.status === "active" ? "on" : "switched off"}, ${room.business.dealerLimit} open lots in the plan.`);
}

/* ---- the Dealer Center's script, bundled like the build does ---------------- */

const demoBundler = await esbuildContext({
  entryPoints: [resolve(ROOT, "ui/office/demo.js")], bundle: true, format: "esm", platform: "browser",
  target: "es2022", write: false, outfile: "demo.js", logLevel: "silent", sourcemap: "inline",
});
const bundler = await esbuildContext({
  entryPoints: [resolve(ROOT, "ui/office/main.js")], bundle: true, format: "esm", platform: "browser",
  target: "es2022", write: false, outfile: "main.js", logLevel: "silent", sourcemap: "inline",
  define: { __DEALER_DEMO__: "true" },   /* the local copy always offers the "try it" demo */
});
async function officeBundle() {
  const r = await bundler.rebuild();
  return r.outputFiles[0].contents;
}

/* ---- serving files --------------------------------------------------------- */

const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".woff2": "font/woff2", ".ico": "image/x-icon", ".txt": "text/plain; charset=utf-8",
  ".pdf": "application/pdf",
};
const PRIVATE = /^\/(server|tools|netlify|test|node_modules|docs|\.[^/]*)(\/|$)/;

function fileAnswer(path, extra = {}) {
  const file = normalize(join(ROOT, decodeURIComponent(path)));
  if (!file.startsWith(ROOT + "/") || !existsSync(file) || !statSync(file).isFile()) return null;
  return new Response(readFileSync(file), { headers: {
    "Content-Type": TYPES[extname(file)] || "application/octet-stream", "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff", ...extra,
  } });
}

const designerHtml = () => readFileSync(resolve(ROOT, "index.html"), "utf8");

async function route(request) {
  const url = new URL(request.url);
  const path = url.pathname;
  if (path.startsWith("/api/")) return office.handle(request, { clientIp: "127.0.0.1" });

  if (room && path === "/__local/control-room" && request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    if (body.status === "active" || body.status === "deactivated") room.business.status = body.status;
    if (typeof body.down === "boolean") room.down = body.down;
    if (Number.isInteger(body.dealerLimit) && body.dealerLimit >= 0) room.business.dealerLimit = body.dealerLimit;
    await office.checkIn({ force: true });
    return Response.json({ status: room.business.status, down: room.down, dealerLimit: room.business.dealerLimit, dealerCount: room.business.dealerCount });
  }
  if (room && path === "/__local/control-room/check" && request.method === "POST") {
    let token;
    try { token = room.issueSupport("alan@barnwright.example"); } catch { return Response.json({ error: "Help from Barnwright is off." }, { status: 403 }); }
    return office.diagnostics(new Request(`http://127.0.0.1:${PORT}/.netlify/functions/tenant-diagnostics`, { method: "POST", headers: { authorization: `Bearer ${token}` } }));
  }
  if (helpInbox && path === "/__local/help-inbox" && request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    if (typeof body.down === "boolean") helpInbox.down = body.down;
    const answered = typeof body.answer === "string" && body.answer.trim() ? helpInbox.answer(typeof body.id === "string" ? body.id : null, body.answer.trim()) : null;
    return Response.json({
      down: helpInbox.down, answered: answered ? answered.id : null,
      questions: helpInbox.questions.map((q) => ({ id: q.id, page: q.page, asker: { id: q.asker.id, role: q.asker.role }, status: q.status, details: Object.keys(q.details || {}) })),
      problems: helpInbox.problems.map((x) => ({ signature: x.signature, area: x.area, where: x.where, page: x.page, count: x.count })),
    });
  }
  if (path === "/.netlify/functions/tenant-diagnostics") return office.diagnostics(request);
  if (path === "/__local/people" && request.method === "GET") {
    const people = (await office.parts.store.all("people/")).filter((p) => p.active !== false)
      .map((p) => ({ email: p.email, name: p.name, role: p.role, lots: p.lots }));
    const invites = (await office.parts.store.all("invites/")).map((i) => ({ email: i.email, name: i.name, role: i.role, lots: i.lots, invited: true }));
    return Response.json({ people: [...people, ...invites], ownerEmail: OWNER_EMAIL });
  }
  if (path === "/__local/sign-in" && request.method === "POST") {
    if (request.headers.get("origin") !== url.origin) return new Response("no", { status: 403 });
    const { email } = await request.json();
    if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return Response.json({ error: "Type an email address." }, { status: 422 });
    return new Response(null, { status: 204, headers: { "Set-Cookie": `${COOKIE}=${encodeURIComponent(email.trim().toLowerCase())}; Path=/; SameSite=Lax; HttpOnly` } });
  }
  if (path === "/__local/sign-out" && request.method === "POST") {
    return new Response(null, { status: 204, headers: { "Set-Cookie": `${COOKIE}=; Path=/; Max-Age=0; SameSite=Lax; HttpOnly` } });
  }
  if (path.startsWith("/.netlify/")) return new Response("Netlify Identity is not on this computer.", { status: 404 });

  if (["/office", "/office/", "/portal", "/portal/", "/portal.html", "/dealer/"].includes(path)) {
    return new Response(null, { status: 302, headers: { Location: "/dealer" + url.search + url.hash } });
  }
  if (path === "/dealer" || path === "/dealer.html") {
    return fileAnswer("/dealer.html", { "Content-Security-Policy": OFFICE_POLICY, "Referrer-Policy": "same-origin" });
  }
  if (path === "/ui/office/demo.js") {
    const r = await demoBundler.rebuild();
    return new Response(r.outputFiles[0].contents, { headers: { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "no-store" } });
  }
  if (path === "/ui/office/main.js") {
    return new Response(await officeBundle(), { headers: { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "no-store" } });
  }

  let m = /^\/d\/([a-z0-9-]{2,40})$/.exec(path);
  if (m) return new Response(null, { status: 301, headers: { Location: `/d/${m[1]}/${url.search}` } });
  m = /^\/d\/([a-z0-9-]{2,40})\/$/.exec(path);
  if (m) {
    try {
      const data = await office.publicLot(m[1]);
      const html = designerHtml();
      return lotDesignerPage({ html, hashes: inlineScriptHashes(html), origins: data.lot.embedOrigins || [], head: request.method === "HEAD" });
    } catch (e) {
      return closedPage(e.status || 503, e.call);
    }
  }
  m = /^\/(c|d)\/[a-z0-9-]{2,40}\/(ui|engine|model|parts|library|companies|fonts)\/(.+)$/.exec(path);
  if (m) return fileAnswer(`/${m[2]}/${m[3]}`);
  if (/^\/c\/[a-z0-9-]{2,40}\/?$/.test(path)) return fileAnswer("/index.html");

  if (path === "/") return fileAnswer("/index.html");
  if (PRIVATE.test(path)) return new Response("Not here.", { status: 404 });
  return fileAnswer(path) || new Response("Not found.", { status: 404 });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = `http://127.0.0.1:${PORT}${req.url}`;
    const hasBody = !["GET", "HEAD"].includes(req.method);
    const request = new Request(url, {
      method: req.method, headers: req.headers,
      body: hasBody ? Readable.toWeb(req) : undefined, duplex: hasBody ? "half" : undefined,
    });
    const answer = await requestStore.run(request, () => route(request));
    const headers = {};
    answer.headers.forEach((v, k) => { headers[k] = v; });
    res.writeHead(answer.status, headers);
    res.end(req.method === "HEAD" ? undefined : Buffer.from(await answer.arrayBuffer()));
  } catch (e) {
    console.error(e);
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("The local Dealer Center had a problem: " + e.message);
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`The Dealer Center is running: http://127.0.0.1:${PORT}/dealer`);
  console.log(`A lot's 3D designer:          http://127.0.0.1:${PORT}/d/riverside/`);
  console.log(EMPTY ? `No sample data. Sign in as ${OWNER_EMAIL} to set up the business.` : "Sign in as anyone on the sample team. Press Ctrl+C to stop.");
});

for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => { bundler.dispose(); demoBundler.dispose(); server.close(); process.exit(0); });
