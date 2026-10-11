/* THE DEALER CENTER: start-up, the frame around every screen, and the
   address (#/customers/abc) that says which screen is showing.

   Start-up: handle a link from a Netlify email -> ask the server who this
   is -> sign-in screen, "not on the team yet", first setup, or the Dealer
   Center itself.

   Screens live in ui/office/views/<name>.js. Each exports
   render(ctx) -> an element (or a promise of one). ctx carries the shared
   app (who, lots, customers), the parts of the address, go(path) and
   setTitle(words). A screen with unsaved changes sets app.leaveGuard to a
   function that returns a question ("Leave without saving?") or null.

   A BARNWRIGHT VISIT (docs/OFFICE.md "The visit"): Alan's Control Room
   opens /dealer#barnwright=<pass>. The page reads the pass, clears the
   address at once, and starts the visit (the server sets its own cookie).
   Then a smaller frame: only Price list and Settings, and a bar on top,
   "Working on <business> as Barnwright until 3:15 PM. [Done]". A visit
   that ends never shows a sign-in screen and never reloads: the work on
   screen stays (and is kept in this tab, visit-draft.js). */

import { h, clear, icon, button, linkButton, toast, loading, emptyState } from "./dom.js";
import { app } from "./app.js";
import { configureApi, signOut, post, get, startVisit, endVisit, VISIT_ENDED } from "./api.js";
import { signInScreen, notOnTeam, handleEmailLink } from "./auth.js";
import { ROLE_WORDS, initials, dayWords, todayKey, untilWords } from "./words.js";
import { visitMark, visitMarked } from "./visit-draft.js";
import { watchProblems, reportProblem, screenOf } from "../problems.js";

const root = document.getElementById("dealer-center");

/* A problem on these screens that nothing caught goes to this site's own
   server (ui/problems.js), which passes it on to Barnwright for a business
   Barnwright set up. The page is the screen, never which customer. The
   "try it" demo keeps them in the page. */
watchProblems({
  area: "dealer-center",
  endpoint: "/api/office/problem",
  page: () => location.pathname + screenOf(location.hash),
  skip: () => app.demo || new URLSearchParams(location.search).has("demo"),
});

/* The screens, in the order of the menu. `roles` lists who sees the menu
   item (the server checks every action again anyway). On a phone the
   first four are in the bar at the bottom and the rest under More. */
const NAV = [
  { path: "/", label: "Today", icon: "today", roles: ["owner", "manager", "dealer"] },
  { path: "/customers", label: "Customers", icon: "customers", roles: ["owner", "manager", "dealer"] },
  { path: "/orders", label: "Orders", icon: "orders", roles: ["owner", "manager", "dealer"] },
  { path: "/price-list", label: "Price list", icon: "prices", roles: ["owner", "manager", "dealer"], visit: true },
  { path: "/lots", label: "Lots", icon: "lots", roles: ["owner", "manager", "dealer"] },
  { path: "/team", label: "Team", icon: "team", roles: ["owner", "manager"] },
  { path: "/settings", label: "Settings", icon: "settings", roles: ["owner"], visit: true },
  { path: "/help", label: "Help", icon: "help", roles: ["owner", "manager", "dealer"] },
];
/* the only screens a Barnwright visit has */
const VISIT_VIEWS = ["price-list", "settings"];

const ROUTES = [
  [/^\/$/, "today"],
  [/^\/customers$/, "customers"],
  [/^\/customers\/([A-Za-z0-9]{8,24})$/, "customer"],
  [/^\/customers\/([A-Za-z0-9]{8,24})\/design(?:\/([A-Za-z0-9]{8,24}))?$/, "design"],
  [/^\/orders$/, "orders"],
  [/^\/customers\/([A-Za-z0-9]{8,24})\/orders\/([A-Za-z0-9]{8,24})$/, "order"],
  [/^\/customers\/([A-Za-z0-9]{8,24})\/quotes\/([A-Za-z0-9]{8,24})$/, "quote"],
  [/^\/price-list(?:\/([a-z-]+))?$/, "price-list"],
  [/^\/lots$/, "lots"],
  [/^\/lots\/([a-z0-9-]{2,40})$/, "lot"],
  [/^\/team$/, "team"],
  [/^\/settings$/, "settings"],
  [/^\/help$/, "help"],
  [/^\/setup$/, "setup"],
];

/* Each screen's code, loaded when first needed. */
const VIEWS = {
  today: () => import("./views/today.js"),
  customers: () => import("./views/customers.js"),
  customer: () => import("./views/customer.js"),
  design: () => import("./views/design.js"),
  orders: () => import("./views/orders.js"),
  order: () => import("./views/order-sheet.js"),
  quote: () => import("./views/order-sheet.js"),
  "price-list": () => import("./views/price-list.js"),
  lots: () => import("./views/lots.js"),
  lot: () => import("./views/lots.js"),
  team: () => import("./views/team.js"),
  settings: () => import("./views/settings.js"),
  help: () => import("./views/help.js"),
  setup: () => import("./views/setup.js"),
};

export function go(path) {
  location.hash = "#" + path;
}

function currentPath() {
  const raw = location.hash.replace(/^#/, "") || "/";
  const [path, query = ""] = raw.split("?");
  return { path: path || "/", query: new URLSearchParams(query) };
}

/* ---- the frame -------------------------------------------------------------- */

let main, navEls = [], lotPicker, lastHash = location.hash;

/* The Dealer Center keeps its own black and gold look for every business
   (office.css); a business's colors are for its customers' 3D designer.
   Its name and logo show here. */
function applyBrand(business) {
  document.title = business ? `${business.name} · Dealer Center` : "Dealer Center";
}

/* The business's name over "Dealer Center" (just "Dealer Center" before
   the business has a name, during first setup). */
function brandWords(business) {
  const name = business?.short || business?.name;
  return h("span", { class: "brand-words" }, h("strong", {}, name || "Dealer Center"), name ? h("span", {}, "Dealer Center") : null);
}

function badge(business) {
  if (business?.logo) return h("img", { class: "brand-logo", src: business.logo, alt: "" });
  return h("span", { class: "brand-initials", "aria-hidden": "true" }, business?.initials || initials(business?.name || "DC"));
}

function personMenu() {
  const p = app.person;
  const menu = h("div", { class: "person-menu", hidden: true },
    h("div", { class: "person-menu-who" }, h("strong", {}, p.name || p.email), h("span", {}, p.email),
      h("span", { class: "role-tag" }, ROLE_WORDS[p.role] + (p.role === "dealer" ? ` · ${p.lots.map((s) => app.lotName(s)).join(", ")}` : ""))),
    button("Sign out", signOut, { kind: "quiet", icon: "signOut" }));
  const toggle = h("button", { type: "button", class: "person-button", "aria-haspopup": "true", "aria-expanded": "false",
    onclick: () => { menu.hidden = !menu.hidden; toggle.setAttribute("aria-expanded", String(!menu.hidden)); } },
  h("span", { class: "avatar" }, initials(p.name || p.email)), h("span", { class: "person-name" }, (p.name || p.email).split(" ")[0]));
  document.addEventListener("click", (e) => { if (!menu.hidden && !menu.parentElement.contains(e.target)) { menu.hidden = true; toggle.setAttribute("aria-expanded", "false"); } });
  return h("div", { class: "person" }, toggle, menu);
}

function buildLotPicker() {
  const lots = app.lots;
  if (lots.length < 2) return null;
  const select = h("select", { class: "lot-select", "aria-label": "Show lot",
    onchange: () => { app.setLotFilter(select.value); render(); } },
  h("option", { value: "all" }, app.seesAllLots ? "All lots" : "All my lots"),
  lots.map((l) => h("option", { value: l.slug }, l.name + (l.active === false ? " (closed)" : ""))));
  select.value = app.lotFilter;
  return h("label", { class: "lot-picker" }, icon("lots"), select);
}

function frameUp() {
  const business = app.business;
  const visit = !!app.barnwright;
  applyBrand(business);
  const items = NAV.filter((n) => (visit ? n.visit : n.roles.includes(app.role)));
  navEls = items.map((n) => h("a", { href: "#" + n.path, class: "nav-item", dataset: { path: n.path } }, icon(n.icon), h("span", {}, n.label)));
  /* phones: the first four, then "More" with the rest */
  const phoneMain = items.slice(0, 4).map((n) => h("a", { href: "#" + n.path, class: "tab-item", dataset: { path: n.path } }, icon(n.icon), h("span", {}, n.label)));
  const more = items.slice(4);
  const moreSheet = h("div", { class: "more-sheet", hidden: true },
    more.map((n) => h("a", { href: "#" + n.path, class: "more-item", dataset: { path: n.path }, onclick: () => { moreSheet.hidden = true; } }, icon(n.icon), h("span", {}, n.label))),
    visit ? null : h("button", { type: "button", class: "more-item", onclick: signOut }, icon("signOut"), h("span", {}, "Sign out")));
  const moreBtn = h("button", { type: "button", class: "tab-item", onclick: () => { moreSheet.hidden = !moreSheet.hidden; } }, icon("menu"), h("span", {}, "More"));
  lotPicker = visit ? null : buildLotPicker();
  main = h("main", { id: "main", class: "main", tabindex: "-1" });
  clear(root,
    h("a", { href: "#main", class: "skip" }, "Skip to the page"),
    h("header", { class: "topbar" },
      h("a", { href: visit ? "#/price-list" : "#/", class: "brand" }, badge(business),
        brandWords(business)),
      visit ? h("div", { class: "topbar-tools" }) : h("div", { class: "topbar-tools" },
        lotPicker,
        h("a", { href: "#/customers?new=1", class: "btn btn-accent btn-small new-customer" }, icon("plus"), h("span", {}, "Customer")),
        h("a", { href: "#/help", class: "topbar-help", title: "Help", "aria-label": "Help", dataset: { path: "/help" } }, icon("help"), h("span", {}, "Help")),
        personMenu())),
    h("nav", { class: "sidenav", "aria-label": "Dealer Center" }, navEls),
    main,
    h("nav", { class: "tabbar", "aria-label": "Dealer Center" }, phoneMain, more.length ? moreBtn : null),
    moreSheet);
}

/* The "try it" demo (/dealer?demo): made-up data that lives only in this tab. */
function demoBanner() {
  if (!__DEALER_DEMO__ || !app.demo) return null;
  return h("div", { class: "banner demo" }, icon("star"),
    h("span", {}, "This is a demo with a made-up business. Everything you do stays in this browser tab — nothing is saved or sent."),
    button("Start over", async () => (await import(DEMO_MODULE)).demoStartOver(), { kind: "ghost", small: true }));
}

/* The business's Barnwright account (only with a control room connection):
   why nothing can be saved, for everybody; and for the owner, a warning
   while check-ins are failing, before the seven days run out. */
const ACCOUNT_BANNER = {
  unactivated: "Your Dealer Center isn't switched on yet. Contact Barnwright to finish setting it up. Until then nothing can be saved and your 3D designer links are closed.",
  invalid_license: "Your Dealer Center can't confirm its Barnwright account, so nothing can be saved and your 3D designer links are closed. Contact Barnwright.",
  deactivated: "Your Barnwright account is switched off. You can still look at and download everything, but changes can't be saved and your 3D designer links are closed. Contact Barnwright to switch it back on.",
  expired: "Your Dealer Center hasn't reached Barnwright in 7 days. You can still look at and download everything, but changes can't be saved and your 3D designer links are closed until it does.",
};
function accountBanner() {
  const a = app.account;
  if (!a) return null;
  if (!a.canWrite) return h("div", { class: "banner warn account" }, icon("alert"), h("span", {}, ACCOUNT_BANNER[a.reason] || ACCOUNT_BANNER.invalid_license));
  const day = 86400000;
  if (app.isOwner && a.checkedAt && Date.now() - a.checkedAt > day && a.expiresAt) {
    return h("div", { class: "banner warn account" }, icon("clock"), h("span", {},
      `Your Dealer Center hasn't reached Barnwright since ${dayWords(todayKey(new Date(a.checkedAt)))}. If it can't by ${dayWords(todayKey(new Date(a.expiresAt)))}, changes will stop and your 3D designer links will close.`));
  }
  return null;
}

/* The owner of a business Barnwright sells to agrees to the Barnwright Terms
   and Conditions: asked here when they set up before the box existed, or the
   terms changed (server/office/terms.js). The button says what they agree
   to, the same words as first setup. Nobody else is asked. */
function termsBanner() {
  const t = app.me?.terms;
  if (!t || t.agreed || !app.isOwner || !app.business) return null;
  const btn = button(`I have read and agree to the ${t.title}`, async () => {
    btn.disabled = true;
    try {
      await post("terms", { agree: true });
      await app.loadMe();
      toast(`Thanks. Your agreement to the ${t.title} is saved.`);
      render();
    } catch (e) {
      btn.disabled = false;
      toast(e.message, { error: true });
    }
  }, { kind: "primary", small: true });
  return h("div", { class: "banner info terms" }, icon("note"),
    h("span", {}, "Please read the ", h("a", { href: t.url, target: "_blank", rel: "noopener" }, t.title),
      ` (version ${t.version}).`),
    btn);
}

/* Barnwright setup access, for the owner (server/office/setup-access.js;
   me.setup is {mode, until, live}): while their switch is on, a line that
   says until when, with Turn off. */
const PRELIVE_WORDS = "Barnwright is setting up your prices. Look at the preview, check it with Alan, then open it to customers in Settings.";
function switchBanner() {
  const s = app.me?.setup;
  if (!app.isOwner || s?.mode !== "switch") return null;
  const btn = button("Turn off", async () => {
    btn.disabled = true;
    try {
      await post("barnwright-help", { on: false });
      await app.loadMe();
      /* before live, setup access goes on: say only what stopped */
      toast(app.me?.setup?.mode === "prelive"
        ? "Checks are off. Barnwright can still set up your price list until you open it. To stop that too, tap Stop Barnwright's setup access."
        : "Barnwright can't change anything now.", { ms: 8000 });
      render();
    } catch (e) {
      btn.disabled = false;
      toast(e.message, { error: true });
    }
  }, { kind: "primary", small: true });
  return h("div", { class: "banner info setup-switch" }, icon("user"),
    h("span", {}, `Barnwright can change your price list and settings until ${untilWords(s.until)}.`), btn);
}

/* The bar on top of every screen during a Barnwright visit. Once it ended,
   the server's own words: why, when access closed (the owner stopped it,
   the switch went off, the designer opened), or what to tap. */
function visitBar() {
  if (app.visitEnded) return h("div", { class: "banner warn bw-bar", role: "alert" }, icon("alert"), h("span", {}, app.visitEndedWords || VISIT_ENDED));
  const b = app.barnwright;
  const lot = app.lots[0];
  return h("div", { class: "banner info bw-bar", role: "status" }, icon("user"),
    h("span", {}, `Working on ${app.business?.name || "this business"} as Barnwright until ${untilWords(b.visitEndsAt)}.`),
    lot ? linkButton("Look at the preview", app.previewUrl(lot.slug), { small: true, newTab: true, icon: "cube" }) : null,
    button("Done", doneVisit, { kind: "primary", small: true }));
}

function closedBanner() {
  if (app.demo) return demoBanner();
  if (app.barnwright) return visitBar();
  const account = accountBanner();
  if (account) return account;
  const terms = termsBanner();
  if (terms) return terms;
  const setup = switchBanner();
  if (setup) return setup;
  if (!app.business || app.business.open || !app.isOwner) return null;
  const lot = app.openLots()[0] || app.lots[0];
  return h("div", { class: "banner warn" }, icon("alert"),
    h("span", {}, app.me?.setup?.mode === "prelive" ? PRELIVE_WORDS : "Your 3D designer links are closed to customers. Check your prices, then open them in Settings."),
    lot ? linkButton("Look at the preview", app.previewUrl(lot.slug), { small: true, newTab: true, icon: "cube" }) : null,
    h("a", { href: "#/settings", class: "btn btn-small btn-primary" }, "Open for customers"));
}

/* ---- a Barnwright visit --------------------------------------------------------------- */

/* A screen with words and nothing to sign in to. */
function visitScreen(title, words) {
  clear(root, h("main", { class: "auth" }, h("div", { class: "auth-card bw-card" }, h("h1", {}, title), h("p", {}, words))));
}

/* The visit ended while Alan was working: say so on top, keep everything on screen. */
function visitEnded(data) {
  const words = data?.code === "visit-ended" && typeof data.error === "string" ? data.error : null;
  const first = !app.visitEnded;
  if (!first && words === app.visitEndedWords) return;
  app.visitEnded = true;
  app.visitEndedWords = words;
  if (first) window.dispatchEvent(new Event("dealer:visit-ended"));
  drawVisitBar();
}
function drawVisitBar() {
  const old = main && [...main.children].find((el) => el.matches(".bw-bar"));
  if (old) old.replaceWith(visitBar());
  else if (main) main.prepend(visitBar());
}

/* A request worked again after the visit ended: Alan opened a new visit
   from his Control Room (its cookie is this whole browser's) and came back
   to this tab. The bar says who and until when again, with Done. */
let visitComingBack = false;
async function visitBack() {
  if (!app.visitEnded || visitComingBack) return;
  visitComingBack = true;
  app.visitEnded = false;
  app.visitEndedWords = null;
  try { await app.loadMe(); } catch { /* a 401 says so again */ }
  visitComingBack = false;
  if (!app.visitEnded) drawVisitBar();
}

async function doneVisit() {
  if (app.leaveGuard) {
    const question = app.leaveGuard();
    if (question && !confirm(question)) return;
  }
  app.leaveGuard = null;
  await endVisit();
  visitMark(false);
  const name = app.business?.name || "this business";
  visitScreen("Done", `Your Barnwright visit to ${name} has ended. You can close this tab.`);
}

async function startBarnwright(pass) {
  configureApi({ barnwright: true, visitEnded, visitBack });
  if (pass) {
    const out = await startVisit(pass);
    if (out.status !== 200) {
      return visitScreen(out.status === 401 || out.status === 410 ? "This link ran out" : "Barnwright can't open this price list",
        out.error || "This link ran out. Tap Open their price list again.");
    }
    visitMark(true);
  }
  try {
    await app.loadMe();
  } catch (e) {
    return visitScreen("Your Barnwright visit ended", e.message || VISIT_ENDED);
  }
  try { app.lots = (await get("lots")).lots || []; } catch { app.lots = []; }
  frameUp();
  const { path } = currentPath();
  if (!/^\/(price-list|settings)(\/|$)/.test(path)) { history.replaceState(null, "", "#/price-list"); lastHash = "#/price-list"; }
  render();
}

/* ---- showing a screen ----------------------------------------------------------- */

let renderSeq = 0;
async function render() {
  if (!main) return;   /* still on the sign-in screen: nothing to show yet */
  const { path, query } = currentPath();
  let match = null, viewName = null;
  for (const [re, name] of ROUTES) {
    const m = re.exec(path);
    if (m) { match = m.slice(1).filter((x) => x !== undefined); viewName = name; break; }
  }
  for (const el of [...navEls, ...root.querySelectorAll(".tab-item[data-path], .more-item[data-path], .topbar-help[data-path]")]) {
    const p = el.dataset.path;
    /* an order sheet lives under its customer's address but belongs to Orders */
    const section = /^\/customers\/[^/]+\/orders\//.test(path) ? "/orders" : "/" + (path.split("/")[1] || "");
    const on = p === section;
    el.classList.toggle("on", on);
    if (on) el.setAttribute("aria-current", "page"); else el.removeAttribute("aria-current");
  }
  const seq = ++renderSeq;
  app.leaveGuard = null;
  clear(main, closedBanner(), loading());
  if (app.barnwright && !VISIT_VIEWS.includes(viewName)) {
    if (path === "/") { go("/price-list"); return; }
    viewName = null;
  }
  if (!viewName) {
    clear(main, closedBanner(), app.barnwright
      /* the page is there for the team; a visit just doesn't include it */
      ? emptyState("Only the price list and settings", "A Barnwright visit has only the price list and settings.",
        h("a", { href: "#/price-list", class: "btn btn-primary" }, "Go to the price list"))
      : emptyState("Nothing here", "That page doesn't exist.", h("a", { href: "#/", class: "btn btn-primary" }, "Go to Today")));
    return;
  }
  try {
    const mod = await VIEWS[viewName]();
    const ctx = {
      app, params: match, query, go, toast, view: viewName,
      refresh: () => render(),
      setTitle: (words) => { document.title = `${words} · ${app.business?.name || "Dealer Center"}`; },
    };
    const el = await mod.render(ctx);
    if (seq !== renderSeq) return;
    clear(main, closedBanner(), el);
    main.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  } catch (e) {
    if (seq !== renderSeq) return;
    console.error(e);
    reportProblem(e);   /* passed on to Barnwright like one nothing caught (an answer from the server isn't) */
    clear(main, emptyState("This page didn't load", e.message || "Something went wrong.", button("Try again", () => render(), { kind: "primary" })));
  }
}

const HELP = /^#\/help(?:[?]|$)/;
window.addEventListener("hashchange", () => {
  /* a Barnwright visit's link opened in this tab: start the page again with it
     (a draft on screen is kept in this tab first, visit-draft.js) */
  if (location.hash.startsWith("#barnwright=")) {
    window.dispatchEvent(new Event("pagehide"));
    app.leaveGuard = null;   /* kept: no need to ask before leaving */
    location.reload();
    return;
  }
  if (app.leaveGuard) {
    const question = app.leaveGuard();
    if (question && !confirm(question)) {
      history.replaceState(null, "", lastHash || "#/");
      return;
    }
  }
  /* the screen someone was on when they opened Help goes with their question */
  if (HELP.test(location.hash) && !HELP.test(lastHash || "")) app.helpFrom = screenOf(lastHash || "#/") || "#/";
  lastHash = location.hash;
  render();
});
window.addEventListener("beforeunload", (e) => {
  if (app.leaveGuard && app.leaveGuard()) { e.preventDefault(); e.returnValue = ""; }
});
window.addEventListener("dealer:refresh", () => render());

/* Settings changed the business (name, logo, colors, open or closed):
   put the header and the "closed" banner right without reloading the page
   (so nothing typed on the screen is lost). Added by the Settings screen. */
window.addEventListener("dealer:brand", () => {
  const business = app.business;
  applyBrand(business);
  const brand = root.querySelector(".topbar .brand");
  if (brand) {
    brand.replaceChildren(badge(business),
      brandWords(business));
  }
  if (!main) return;
  const old = [...main.children].find((el) => el.matches(".banner.warn, .banner.demo, .banner.setup-switch, .bw-bar"));
  const fresh = closedBanner();
  if (old && fresh) old.replaceWith(fresh);
  else if (old) old.remove();
  else if (fresh) main.prepend(fresh);
});

/* A lot was added, closed or opened: rebuild the lot picker at the top.
   Added by the Lots screen. */
window.addEventListener("dealer:lots", () => {
  const tools = root.querySelector(".topbar-tools");
  if (!tools) return;
  const next = buildLotPicker();
  if (lotPicker) lotPicker.remove();
  lotPicker = next;
  if (next) tools.prepend(next);
});

/* ---- start-up ----------------------------------------------------------------------- */

/* The demo's code is its own file (it carries a copy of the server), loaded
   only for /dealer?demo -- the name is kept in a variable so the build does
   not fold it into this file. */
const DEMO_MODULE = __DEALER_DEMO__ ? "/ui/office/demo.js" : "";

/* __DEALER_DEMO__ (true or false) is written in by whatever bundles this
   file: tools/build-site.mjs says true only for Alan's learning preview and
   his demo site (tools/site-profiles.mjs), so a client build leaves every bit
   of the demo out; the local Dealer Center (tools/office-local.mjs) says true. */

async function start() {
  /* a Barnwright visit: the pass leaves the address at once */
  const visitPass = /^#barnwright=([A-Za-z0-9_.-]{1,8000})$/.exec(location.hash)?.[1] || null;
  if (location.hash.startsWith("#barnwright=")) {
    history.replaceState(null, "", location.pathname + location.search);
    lastHash = "";
  }
  if (visitPass || visitMarked()) {
    clear(root, h("div", { class: "boot" }, loading("Opening their price list…")));
    return startBarnwright(visitPass);
  }
  clear(root, h("div", { class: "boot" }, loading("Opening the Dealer Center…")));
  let note = null;
  if (__DEALER_DEMO__ && new URLSearchParams(location.search).has("demo")) {
    try {
      await (await import(DEMO_MODULE)).startDemo();
      app.demo = true;
    } catch (e) {
      console.error(e);
      clear(root, h("main", { class: "auth" }, h("div", { class: "auth-card" },
        h("h1", {}, "The demo didn't start"), h("p", {}, "Reload the page to try again."))));
      return;
    }
  } else {
    try {
      const linked = await handleEmailLink(root);
      note = linked?.message || null;
    } catch { /* carry on to sign in */ }
  }
  let me;
  try {
    me = await app.loadMe();
  } catch (e) {
    clear(root, h("main", { class: "auth" }, h("div", { class: "auth-card" },
      h("h1", {}, "The Dealer Center isn't answering"), h("p", {}, e.message), button("Try again", () => location.reload(), { kind: "primary" }))));
    return;
  }
  configureApi({ mode: me.signIn, signedOut: () => location.reload() });
  if (me.status === 401) return signInScreen(root, { mode: me.signIn || "netlify", business: null, note });
  if (!me.person) return notOnTeam(root, { email: me.user.email, signOut });
  if (me.setupNeeded) {
    frameUp();
    if (currentPath().path !== "/setup") { history.replaceState(null, "", "#/setup"); lastHash = "#/setup"; }
    return render();
  }
  frameUp();
  if (note) toast(note);
  render();
}

start();
