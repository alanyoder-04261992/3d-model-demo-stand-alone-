/* WHAT EVERY SCREEN SHARES: who is signed in, the business, the lots they
   can see, the lot picked at the top, the team's names, and the customer
   list (loaded once and refreshed when it is more than a minute old or
   something changed).

   Screens get it as ctx.app. */

import { get } from "./api.js";

const LOT_KEY = "dealer-center:lot";

export const app = {
  me: null,
  lots: [],
  lotFilter: "all",
  customers: null,
  customersAt: 0,
  priceList: null,
  priceListAt: 0,
  leaveGuard: null,
  demo: false,
  /* the screen someone was on when they opened Help ("#/price-list"; main.js
     keeps it, views/help.js sends it with a question) */
  helpFrom: null,
  /* the owner's start (POST start, main.js) failed for another reason than
     a missing business name: its words, for the Getting started card */
  startError: null,

  get person() { return this.me?.person || null; },
  get business() { return this.me?.business || null; },
  get role() { return this.me?.person?.role || null; },
  get isOwner() { return this.role === "owner"; },
  get seesAllLots() { return this.role === "owner" || this.role === "manager"; },
  /* the business's Barnwright account (null when not connected to Barnwright's control room) */
  get account() { return this.me?.account || null; },
  get changesStopped() { return !!this.me?.account && !this.me.account.canWrite; },
  /* a Barnwright visit (docs/OFFICE.md "The visit"): {actor, mode, until,
     visitEndsAt}, or null. Barnwright is never a person on the team: it
     may change the price list and some settings, and see the history. */
  get barnwright() { return this.me?.barnwright || null; },

  can(what) {
    if (this.barnwright) return ["changePrices", "changeSettings", "seeHistory"].includes(what);
    const r = this.role;
    switch (what) {
      case "changePrices": case "changeLots": case "changeTeam": case "changeSettings": return r === "owner";
      case "seeTeam": case "moveCustomers": case "exportCustomers": case "seeHistory": return r === "owner" || r === "manager";
      default: return !!r;
    }
  },

  async loadMe() {
    this.me = await get("me");
    /* when this device's sign-in ends, in this browser's own time */
    const s = this.me?.session;
    if (s && Number.isFinite(s.left)) s.endsLocal = new Date(Date.now() + s.left).toISOString();
    this.lots = this.me.lots || [];
    let saved = "all";
    try { saved = localStorage.getItem(`${LOT_KEY}:${this.me?.user?.id}`) || "all"; } catch { /* private mode */ }
    this.lotFilter = saved === "all" || this.lots.some((l) => l.slug === saved) ? saved : "all";
    if (this.lots.length === 1) this.lotFilter = this.lots[0].slug;
    return this.me;
  },

  setLotFilter(slug) {
    this.lotFilter = slug;
    try { localStorage.setItem(`${LOT_KEY}:${this.me?.user?.id}`, slug); } catch { /* fine */ }
  },

  /* Where a lot's 3D designer lives. The demo has no lot links, so it uses
     the example designer (its business shares that designer's id). */
  designerUrl(slug) {
    return this.demo ? "/c/demo/" : `/d/${slug}/`;
  },
  /* A lot's 3D designer while it is closed, as a preview (the team, or a
     Barnwright visit): it never takes a quote. */
  previewUrl(slug) {
    return this.demo ? "/c/demo/" : `/d/${slug}/?preview=${this.barnwright ? "barnwright" : "1"}`;
  },

  openLots() { return this.lots.filter((l) => l.active !== false); },
  lotName(slug) { return this.lots.find((l) => l.slug === slug)?.name || slug; },
  lot(slug) { return this.lots.find((l) => l.slug === slug) || null; },

  /* people's names, for "working them" and activity */
  personName(userId) {
    if (!userId) return "";
    const p = (this.me?.team || []).find((x) => x.userId === userId);
    return p ? p.name || p.email : "";
  },
  teamFor(slug) {
    return (this.me?.team || []).filter((p) => p.active !== false && (p.role !== "dealer" || (p.lots || []).includes(slug)));
  },

  /* rows for the lots in view (the picker at the top narrows them) */
  async loadCustomers(force = false) {
    if (force || !this.customers || Date.now() - this.customersAt > 60000) {
      this.customers = (await get("customers")).rows || [];
      this.customersAt = Date.now();
    }
    return this.customers;
  },
  rowsInView() {
    const rows = this.customers || [];
    return this.lotFilter === "all" ? rows : rows.filter((r) => r.lot === this.lotFilter);
  },
  customersChanged() { this.customersAt = 0; },

  async loadPriceList(force = false) {
    if (force || !this.priceList || Date.now() - this.priceListAt > 60000) {
      this.priceList = await get("price-list");
      this.priceListAt = Date.now();
    }
    return this.priceList;
  },
};
