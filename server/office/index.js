/* THE OFFICE API: every route, and who may use it.

   createOffice(deps) -> { handle(request, {clientIp}), publicLot(slug) }

   deps (everything from outside is passed in, so the checks and the local
   Office run the same code as Netlify):
     blobs          a Netlify Blobs store, or MemoryBlobs / a file store
     identityUser   async (request) -> the signed-in Identity user, or null
     ownerEmail     the OWNER_EMAIL setting (the first owner)
     manufacturer   library/manufacturers/standard.json
     library        library/construction.json
     templates      {full, small}: starting price lists for first setup
     now            () -> Date
     sendEmail      optional async ({to, subject, text, html}) -> true
     siteUrl        "https://the-site" for links inside emails
     signIn         "netlify" | "local": which sign-in screen to show
     checkOrigin    false ONLY for the in-browser demo (/dealer?demo), where
                    every "request" is made inside the page itself
     license        optional: the check-in with Barnwright's control room
                    (control-room.js TenantLicenseClient, made by netlify.js).
                    Left out, the Dealer Center is not connected and nothing
                    is limited (Alan's own business, this computer, the demo).
     appVersion     optional: what this copy reports to the control room
     help           optional: Barnwright's Sales Inbox for the Help screen,
                    {url, fetch?, timeoutMs?, budgetMs?, allowLocal?}
                    (help.js; budgetMs: all of one request's calls). Used
                    only with a license; left out, Help says to email
                    Barnwright instead.

   The routes are listed in docs/OFFICE.md. */

import { fail, json, errorAnswer, readBody, requireSameSite, text, email as emailField, phone } from "./http.js";
import { wrapStore } from "./store.js";
import { createPeople, createTeam, publicPerson, can, must } from "./people.js";
import { createPriceList } from "./price-list.js";
import { createLots, website as websiteAddress } from "./lots.js";
import { createCustomers } from "./customers.js";
import { createWebsite } from "./website.js";
import { createEmail } from "./email.js";
import { createAccount } from "./account.js";
import { createTerms } from "./terms.js";
import { createHelp } from "./help.js";

export function createOffice(deps) {
  const now = deps.now || (() => new Date());
  const log = deps.log || console.error;
  const store = wrapStore(deps.blobs);
  const email = createEmail({ send: deps.sendEmail || null, siteUrl: deps.siteUrl || "" });
  const people = createPeople({ store, identityUser: deps.identityUser, ownerEmail: deps.ownerEmail, now });
  const lots = createLots({ store, now });
  const priceList = createPriceList({ store, manufacturer: deps.manufacturer, library: deps.library, templates: deps.templates || {}, now, log });
  const customers = createCustomers({ store, now, lots, priceList, log });
  const account = createAccount({ store, license: deps.license || null, lots, now, appVersion: deps.appVersion, log });
  const terms = createTerms({ store, account, now });
  const help = createHelp({
    store, license: deps.license || null, inbox: deps.help || null, account, lots, priceList,
    emailOn: email.on, appVersion: deps.appVersion || "dealer-center", now, log,
  });
  const businessName = async () => (await priceList.current())?.data.settings.brand?.name || "the business";
  const team = createTeam({
    store, now,
    lotExists: async (slug) => !!(await lots.get(slug)),
    sendInvite: async (invite) => email.invite({ ...invite, invitedByName: invite.invitedByName, business: await businessName() }),
    log,
  });
  const website = createWebsite({
    store, now, lots, priceList, customers, log, account,
    notify: async (event) => { if (event.type === "website-quote") await email.websiteQuote(event); },
  });
  const signIn = deps.signIn || "netlify";

  function business(record) {
    if (!record) return null;
    const s = record.settings;
    return {
      id: s.id, name: s.brand.name, short: s.brand.short || s.brand.name, initials: s.brand.initials || "",
      logo: s.brand.logo || "", colors: s.brand.colors || {}, phone: s.brand.phone || "", email: s.brand.email || "",
      website: s.brand.website || "", open: s.status !== "suspended",
    };
  }

  async function me(req) {
    let who;
    try {
      who = await people.whoIsAsking(req);
    } catch (e) {
      if (e.status === 401) return json({ error: e.message, signIn }, 401);
      throw e;
    }
    if (who.person) await account.checkIn();
    const record = (await priceList.current())?.data || null;
    const visible = who.person ? (await lots.all()).filter((l) => can.seeLot(who.person, l.slug)) : [];
    /* everybody's names, so screens can say who is working a customer */
    const teamNames = who.person ? (await store.all("people/")).map((p) => ({
      userId: p.userId, name: p.name || "", email: p.email, role: p.role, lots: p.lots || [], active: p.active !== false,
    })) : [];
    return json({
      user: who.user,
      person: who.person ? publicPerson(who.person) : null,
      business: business(record),
      setupNeeded: !!(who.person && who.person.role === "owner" && !record),
      lots: visible,
      team: teamNames,
      emailOn: email.on,
      signIn,
      /* null when not connected to Barnwright's control room */
      account: who.person ? await account.status() : null,
      /* the Barnwright terms the owner agrees to: null when not connected */
      terms: who.person ? await terms.status() : null,
      /* Help: connected to Barnwright, and whether questions can go (the
         Help screen draws its Ask box from this at once) */
      help: who.person ? { connected: help.connected, canAsk: help.canAsk } : null,
    });
  }

  /* The person, signed in and on the team, and the business's Barnwright
     account letting changes be saved. Every route that changes something
     starts here; the role checks (must) come after. */
  async function writer(req) {
    const who = await people.member(req);
    await account.mustWrite();
    return who;
  }

  /* ---- the router ------------------------------------------------------ */

  const routes = [];
  const route = (method, pattern, fn) => routes.push({ method, pattern, fn });

  /* public: a lot's designer */
  route("GET", /^\/api\/lots\/([a-z0-9-]{2,40})$/, async (_req, [slug]) => json(await website.publicLot(slug)));
  for (const tail of ["quote-requests", "orders"]) {
    route("POST", new RegExp(`^/api/lots/([a-z0-9-]{2,40})/${tail}$`), async (req, [slug], ctx) => {
      const out = await website.quoteRequest(slug, await readBody(req), { clientIp: ctx.clientIp });
      return json(out.receipt, out.created ? 201 : 200);
    });
  }

  /* the Office */
  route("GET", /^\/api\/office\/me$/, (req) => me(req));

  route("POST", /^\/api\/office\/setup$/, async (req) => {
    const who = await writer(req);
    must(who.person.role === "owner", "Only the owner can set up the business.");
    const data = await readBody(req);
    terms.mustHaveAgreed(data);
    const yourName = text(data.yourName, 80, "Your name");
    if (yourName) await store.change(`people/${who.person.userId}`, (p) => { if (p) p.name = yourName; });
    const record = await priceList.setup({ ...who.person, name: yourName || who.person.name }, {
      businessName: text(data.businessName, 80, "Business name", { required: true }),
      phone: phone(data.phone, "Business phone"),
      email: emailField(data.email, "Business email"),
      website: websiteAddress(data.website),
      start: data.start === "small" ? "small" : "full",
    });
    if (terms.asks()) await terms.agree({ ...who.person, name: yourName || who.person.name });
    return json({ business: business(record) }, 201);
  });

  /* The owner agrees to the Barnwright terms (when they set up before the
     box existed, or the terms changed). Works while changes are stopped too:
     agreeing is never what a switched-off account is waiting for. */
  route("POST", /^\/api\/office\/terms$/, async (req) => {
    const who = await people.member(req);
    must(who.person.role === "owner", "Only the owner can agree to the Barnwright terms.");
    const data = await readBody(req);
    if (data.agree !== true) fail(422, "Tick the box to agree to the Barnwright terms.");
    return json({ terms: await terms.agree(who.person) });
  });

  route("GET", /^\/api\/office\/price-list$/, async (req) => {
    await people.member(req);
    return json(await priceList.get());
  });
  route("PUT", /^\/api\/office\/price-list$/, async (req) => {
    const who = await writer(req);
    must(can.changePrices(who.person), "Only the owner can change the price list.");
    const data = await readBody(req);
    const lotCount = (await lots.all()).filter((l) => l.active !== false).length;
    const saved = await priceList.save(who.person, { settings: data.settings, version: data.version });
    return json({ ...saved, lotCount });
  });
  route("GET", /^\/api\/office\/price-list\/history$/, async (req) => {
    const who = await people.member(req);
    must(can.seeTeam(who.person), "Only the owner or a manager can see the price list history.");
    return json(await priceList.history());
  });
  route("POST", /^\/api\/office\/price-list\/restore$/, async (req) => {
    const who = await writer(req);
    must(can.changePrices(who.person), "Only the owner can change the price list.");
    const data = await readBody(req);
    return json(await priceList.restore(who.person, data));
  });

  route("GET", /^\/api\/office\/lots$/, async (req) => {
    const who = await people.member(req);
    return json({ lots: (await lots.all()).filter((l) => can.seeLot(who.person, l.slug)) });
  });
  /* With a Barnwright account, opening a lot (a new one, or reopening a
     closed one) first takes a place in the plan's number of open lots. */
  route("POST", /^\/api\/office\/lots$/, async (req) => {
    const who = await writer(req);
    must(can.changeLots(who.person), "Only the owner can add a lot.");
    const data = await readBody(req);
    const hold = data.active === false ? null : await account.holdLot();
    try {
      const lot = await lots.create(who.person, data);
      await account.keepLot(hold, lot.slug);
      return json({ lot }, 201);
    } catch (error) {
      await account.freeLot(hold);
      throw error;
    }
  });
  route("PATCH", /^\/api\/office\/lots\/([a-z0-9-]{2,40})$/, async (req, [slug]) => {
    const who = await writer(req);
    must(can.changeLots(who.person), "Only the owner can change a lot.");
    const data = await readBody(req);
    const before = await lots.get(slug);
    const reopening = before && before.active === false && data.active === true;
    const hold = reopening ? await account.holdLot(slug) : null;
    let lot;
    try {
      lot = await lots.update(who.person, slug, data);
    } catch (error) {
      if (hold) await account.freeLot(hold);
      throw error;
    }
    if (lot.active === false && before?.active !== false) await account.freeLot(slug);
    return json({ lot });
  });

  route("GET", /^\/api\/office\/team$/, async (req) => {
    const who = await people.member(req);
    must(can.seeTeam(who.person), "Only the owner or a manager can see the team.");
    return json(await team.list());
  });
  route("POST", /^\/api\/office\/team$/, async (req) => {
    const who = await writer(req);
    must(can.changeTeam(who.person), "Only the owner can add people.");
    return json(await team.add(who.person, await readBody(req)), 201);
  });
  /* Taking somebody off the team (or taking back an invite) works even
     while changes are stopped, so nobody keeps access by accident. */
  route("PATCH", /^\/api\/office\/team\/([A-Za-z0-9_-]{1,128})$/, async (req, [userId]) => {
    const who = await people.member(req);
    must(can.changeTeam(who.person), "Only the owner can change people.");
    const data = await readBody(req);
    const removing = data && typeof data === "object" && Object.keys(data).length === 1 && data.active === false;
    if (!removing) await account.mustWrite();
    return json(await team.change(who.person, userId, data));
  });
  route("DELETE", /^\/api\/office\/team\/invites\/([a-f0-9]{40})$/, async (req, [id]) => {
    const who = await people.member(req);
    must(can.changeTeam(who.person), "Only the owner can change people.");
    return json(await team.cancelInvite(id));
  });

  /* Help from Barnwright (only with a Barnwright account): the owner lets
     Barnwright run checks for 1 to 24 hours, or turns it off. */
  route("GET", /^\/api\/office\/barnwright-help$/, async (req) => {
    const who = await people.member(req);
    must(can.changeSettings(who.person), "Only the owner can see this.");
    return json({ help: await account.help() });
  });
  route("POST", /^\/api\/office\/barnwright-help$/, async (req) => {
    const who = await people.member(req);
    must(can.changeSettings(who.person), "Only the owner can let Barnwright help.");
    return json({ help: await account.setHelp(who.person, await readBody(req)) });
  });

  /* Help (help.js): everyone on the team can read the business's questions
     (a dealer their own) and ask Barnwright -- also while changes are
     stopped, so there is no account.mustWrite here. */
  route("GET", /^\/api\/office\/help$/, async (req) => {
    const who = await people.member(req);
    return json(await help.thread(who));
  });
  route("POST", /^\/api\/office\/help$/, async (req) => {
    const who = await people.member(req);
    return json(await help.ask(who, await readBody(req)), 201);
  });
  /* One browser error from the Dealer Center or a 3D designer page: no
     sign-in, same site only (handle() checks the Origin), and the answer is
     always {ok: true}, so it never tells a stranger anything. */
  route("POST", /^\/api\/office\/problem$/, async (req) => {
    let data = null;
    try { data = await readBody(req); } catch { data = null; }
    try { await help.problem(req, data); } catch (error) { log("Help: a problem report failed:", error?.name || "Error"); }
    return json({ ok: true });
  });

  route("GET", /^\/api\/office\/customers$/, async (req) => {
    const who = await people.member(req);
    const lot = new URL(req.url).searchParams.get("lot") || undefined;
    return json(await customers.list(who, { lot }));
  });
  route("GET", /^\/api\/office\/customers\.csv$/, async (req) => {
    const who = await people.member(req);
    const body = await customers.csv(who);
    return new Response(body, { headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="customers-${now().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
    } });
  });
  route("POST", /^\/api\/office\/customers$/, async (req) => {
    const who = await writer(req);
    return json({ customer: await customers.create(who, await readBody(req)) }, 201);
  });
  route("GET", /^\/api\/office\/customers\/([A-Za-z0-9]{8,24})$/, async (req, [id]) => {
    const who = await people.member(req);
    return json({ customer: await customers.get(who, id) });
  });
  route("PATCH", /^\/api\/office\/customers\/([A-Za-z0-9]{8,24})$/, async (req, [id]) => {
    const who = await writer(req);
    return json({ customer: await customers.update(who, id, await readBody(req)) });
  });
  route("POST", /^\/api\/office\/customers\/([A-Za-z0-9]{8,24})\/activity$/, async (req, [id]) => {
    const who = await writer(req);
    return json({ customer: await customers.addActivity(who, id, await readBody(req)) }, 201);
  });
  route("POST", /^\/api\/office\/customers\/([A-Za-z0-9]{8,24})\/quotes$/, async (req, [id]) => {
    const who = await writer(req);
    return json(await customers.addQuote(who, id, await readBody(req)), 201);
  });
  route("POST", /^\/api\/office\/customers\/([A-Za-z0-9]{8,24})\/orders$/, async (req, [id]) => {
    const who = await writer(req);
    return json(await customers.addOrder(who, id, await readBody(req)), 201);
  });
  route("PATCH", /^\/api\/office\/customers\/([A-Za-z0-9]{8,24})\/orders\/([A-Za-z0-9]{8,24})$/, async (req, [id, orderId]) => {
    const who = await writer(req);
    return json(await customers.updateOrder(who, id, orderId, await readBody(req)));
  });

  async function handle(request, ctx = {}) {
    try {
      const url = new URL(request.url);
      const path = url.pathname.replace(/\/+$/, "");
      const method = request.method === "HEAD" ? "GET" : request.method;
      if (!["GET", "POST", "PUT", "PATCH", "DELETE"].includes(method)) fail(405, "Something went wrong. Reload the page and try again.");
      if (method !== "GET" && deps.checkOrigin !== false) requireSameSite(request);
      let pathMatched = false;
      for (const r of routes) {
        const m = r.pattern.exec(path);
        if (!m) continue;
        pathMatched = true;
        if (r.method !== method) continue;
        return await r.fn(request, m.slice(1), { clientIp: ctx.clientIp || "unknown" });
      }
      fail(pathMatched ? 405 : 404, pathMatched ? "Something went wrong. Reload the page and try again." : "We couldn't find that.");
    } catch (error) {
      return errorAnswer(error, log);
    }
  }

  return {
    handle, publicLot: website.publicLot,
    /* for netlify/functions: the control room's support check, and the check-in every six hours */
    diagnostics: account.diagnostics,
    checkIn: account.checkIn,
    parts: { store, people, lots, priceList, customers, team, website, account, help },
  };
}
