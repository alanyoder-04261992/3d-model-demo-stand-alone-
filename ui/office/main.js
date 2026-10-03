/* THE DEALER CENTER: start-up, the frame around every screen, and the
   address (#/customers/abc) that says which screen is showing.

   Start-up: handle a link from a Netlify email -> ask the server who this
   is -> sign-in screen, "not on the team yet", first setup, or the Dealer
   Center itself.

   Screens live in ui/office/views/<name>.js. Each exports
   render(ctx) -> an element (or a promise of one). ctx carries the shared
   app (who, lots, customers), the parts of the address, go(path) and
   setTitle(words). A screen with unsaved changes sets app.leaveGuard to a
   function that returns a question ("Leave without saving?") or null. */

import { h, clear, icon, button, toast, loading, emptyState } from "./dom.js";
import { app } from "./app.js";
import { configureApi, signOut } from "./api.js";
import { signInScreen, notOnTeam, handleEmailLink } from "./auth.js";
import { ROLE_WORDS, initials } from "./words.js";

const root = document.getElementById("dealer-center");

/* The screens, in the order of the menu. `roles` lists who sees the menu
   item (the server checks every action again anyway). */
const NAV = [
  { path: "/", label: "Today", icon: "today", roles: ["owner", "manager", "dealer"] },
  { path: "/customers", label: "Customers", icon: "customers", roles: ["owner", "manager", "dealer"] },
  { path: "/orders", label: "Orders", icon: "orders", roles: ["owner", "manager", "dealer"] },
  { path: "/price-list", label: "Price list", icon: "prices", roles: ["owner", "manager", "dealer"] },
  { path: "/lots", label: "Lots", icon: "lots", roles: ["owner", "manager", "dealer"] },
  { path: "/team", label: "Team", icon: "team", roles: ["owner", "manager"] },
  { path: "/settings", label: "Settings", icon: "settings", roles: ["owner"] },
];

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

function applyBrand(business) {
  const colors = business?.colors || {};
  const set = (name, value) => { if (value && /^#[0-9a-f]{3,6}$/i.test(value)) document.documentElement.style.setProperty(name, value); };
  set("--brand-header", colors.header);
  set("--brand-accent", colors.accent);
  set("--brand-primary", colors.primary);
  document.title = business ? `${business.name} · Dealer Center` : "Dealer Center";
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
  applyBrand(business);
  const items = NAV.filter((n) => n.roles.includes(app.role));
  navEls = items.map((n) => h("a", { href: "#" + n.path, class: "nav-item", dataset: { path: n.path } }, icon(n.icon), h("span", {}, n.label)));
  /* phones: the first four, then "More" with the rest */
  const phoneMain = items.slice(0, 4).map((n) => h("a", { href: "#" + n.path, class: "tab-item", dataset: { path: n.path } }, icon(n.icon), h("span", {}, n.label)));
  const more = items.slice(4);
  const moreSheet = h("div", { class: "more-sheet", hidden: true },
    more.map((n) => h("a", { href: "#" + n.path, class: "more-item", dataset: { path: n.path }, onclick: () => { moreSheet.hidden = true; } }, icon(n.icon), h("span", {}, n.label))),
    h("button", { type: "button", class: "more-item", onclick: signOut }, icon("signOut"), h("span", {}, "Sign out")));
  const moreBtn = h("button", { type: "button", class: "tab-item", onclick: () => { moreSheet.hidden = !moreSheet.hidden; } }, icon("menu"), h("span", {}, "More"));
  lotPicker = buildLotPicker();
  main = h("main", { id: "main", class: "main", tabindex: "-1" });
  clear(root,
    h("a", { href: "#main", class: "skip" }, "Skip to the page"),
    h("header", { class: "topbar" },
      h("a", { href: "#/", class: "brand" }, badge(business),
        h("span", { class: "brand-words" }, h("strong", {}, business?.short || business?.name || "Dealer Center"), h("span", {}, "Dealer Center"))),
      h("div", { class: "topbar-tools" },
        lotPicker,
        h("a", { href: "#/customers?new=1", class: "btn btn-accent btn-small new-customer" }, icon("plus"), h("span", {}, "Customer")),
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

function closedBanner() {
  if (app.demo) return demoBanner();
  if (!app.business || app.business.open || !app.isOwner) return null;
  return h("div", { class: "banner warn" }, icon("alert"),
    h("span", {}, "Your 3D designer links are closed to customers. Check your prices, then open them in Settings."),
    h("a", { href: "#/settings", class: "btn btn-small btn-primary" }, "Open for customers"));
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
  for (const el of [...navEls, ...root.querySelectorAll(".tab-item[data-path], .more-item[data-path]")]) {
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
  if (!viewName) {
    clear(main, emptyState("Nothing here", "That page doesn't exist.", h("a", { href: "#/", class: "btn btn-primary" }, "Go to Today")));
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
    clear(main, emptyState("This page didn't load", e.message || "Something went wrong.", button("Try again", () => render(), { kind: "primary" })));
  }
}

window.addEventListener("hashchange", () => {
  if (app.leaveGuard) {
    const question = app.leaveGuard();
    if (question && !confirm(question)) {
      history.replaceState(null, "", lastHash || "#/");
      return;
    }
  }
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
      h("span", { class: "brand-words" }, h("strong", {}, business?.short || business?.name || "Dealer Center"), h("span", {}, "Dealer Center")));
  }
  if (!main) return;
  const old = [...main.children].find((el) => el.matches(".banner.warn, .banner.demo"));
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
   file: tools/build-site.mjs says true only for Alan's learning preview, so a
   client build leaves every bit of the demo out; the local Dealer Center
   (tools/office-local.mjs) says true. */

async function start() {
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
