/* ORDERS (#/orders): every sold building in the lots in view, newest sold
   first. Status chips with counts (Sold, Sent to builder, Ready, Delivered,
   Cancelled), a search, how many and how much (cancelled orders left out
   of the money). Tapping an order opens its printable order sheet.

   Built from the customer list rows (each row carries its orders), so it
   is one request however many orders there are. */

import { h, clear, icon, chips, emptyState, pageHead } from "../dom.js";
import { ORDER_STATUSES, PAYMENT_WORDS, money, plural, dayWords, followUpWords, todayKey } from "../words.js";
import { statusPill, remember, recall, dayKeyOf } from "./crm-kit.js";

const PAGE = 80;

export async function render(ctx) {
  const { app } = ctx;
  ctx.setTitle("Orders");
  await app.loadCustomers();
  const memoryKey = `orders:${app.person?.userId}`;
  const state = { ...recall(memoryKey, { status: "open" }), shown: PAGE };
  const manyLots = app.lotFilter === "all" && app.lots.length > 1;

  const all = [];
  for (const r of app.rowsInView()) {
    for (const o of r.orders || []) all.push({ ...o, customerId: r.id, customer: r.name, lot: r.lot, phone: r.phone });
  }
  all.sort((a, b) => String(b.soldAt).localeCompare(String(a.soldAt)));

  const search = h("input", { type: "search", placeholder: "Search name, order # or building", "aria-label": "Search orders", autocomplete: "off" });
  let timer = 0;
  search.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(() => { state.shown = PAGE; draw(); }, 120); });
  const chipsWrap = h("div", { class: "crm-chipbar" });
  const sums = h("div", { class: "crm-order-sums" });
  const results = h("div", { class: "crm-results" });

  const page = h("div", { class: "crm-orders-page" },
    pageHead("Orders", app.lotFilter === "all" ? (app.lots.length > 1 ? (app.seesAllLots ? "Every lot" : "Your lots") : app.lots[0]?.name) : app.lotName(app.lotFilter)),
    sums,
    h("div", { class: "card crm-toolbar" },
      h("div", { class: "crm-toolbar-row" }, h("div", { class: "search crm-search" }, icon("search"), search)),
      chipsWrap),
    results);

  function matching() {
    const words = search.value.trim().toLowerCase().replace(/^#/, "");
    if (!words) return all;
    return all.filter((o) => `${o.customer} ${o.number} ${o.building}`.toLowerCase().includes(words));
  }

  function draw() {
    const base = matching();
    const counts = {};
    for (const o of base) counts[o.status] = (counts[o.status] || 0) + 1;
    const open = base.filter((o) => o.status !== "delivered" && o.status !== "cancelled");
    clear(chipsWrap, chips([
      ["open", "Not delivered yet", open.length],
      ["all", "All", base.length],
      ...ORDER_STATUSES.map(([k, label]) => [k, label, counts[k] || 0]),
    ], state.status, (k) => { state.status = k; remember(memoryKey, { status: k }); state.shown = PAGE; draw(); }, { label: "Status" }));

    const list = state.status === "all" ? base : state.status === "open" ? open : base.filter((o) => o.status === state.status);
    const live = list.filter((o) => o.status !== "cancelled");
    const month = todayKey().slice(0, 7);
    const monthLive = all.filter((o) => o.status !== "cancelled" && dayKeyOf(o.soldAt).startsWith(month));
    clear(sums, 
      sum(plural(list.length, "order"), live.length !== list.length ? `${list.length - live.length} cancelled` : "in this list"),
      sum(money(live.reduce((s, o) => s + (Number(o.total) || 0), 0)), "sales in this list"),
      sum(money(monthLive.reduce((s, o) => s + (Number(o.total) || 0), 0)), "sold this month"));

    if (!list.length) {
      clear(results, h("div", { class: "card" }, all.length
        ? emptyState("No orders here", "Try another status or fewer words.")
        : emptyState("No orders yet", "When a customer buys, open them and tap Mark sold on their quote. The order shows up here.")));
      return;
    }
    clear(results, 
      h("div", { class: ["card", "flush", "crm-list", "crm-order-rows", manyLots && "with-lot"], role: "table", "aria-label": "Orders" },
        h("div", { class: "crm-list-head", role: "row" },
          ["Order", "Customer", "Building", "Total", "Payment", "Delivery", "Status", manyLots ? "Lot" : null].filter(Boolean)
            .map((t) => h("span", { role: "columnheader", class: t === "Total" ? "right" : "" }, t))),
        list.slice(0, state.shown).map((o) => h("a", { class: ["crm-list-row", o.status === "cancelled" && "is-cancelled"], href: `#/customers/${o.customerId}/orders/${o.id}`, role: "row" },
          h("span", { class: "o-num num", role: "cell" }, `#${o.number}`, h("small", {}, `Sold ${dayWords(dayKeyOf(o.soldAt))}`)),
          h("span", { class: "o-name", role: "cell" }, h("strong", {}, o.customer)),
          h("span", { class: "o-building", role: "cell" }, o.building || ""),
          h("span", { class: "o-total num", role: "cell" }, money(o.total)),
          h("span", { class: "o-pay", role: "cell" }, PAYMENT_WORDS[o.payment] || ""),
          h("span", { class: "o-date", role: "cell" }, o.deliveryDate
            ? h("span", { class: deliveryTone(o) }, icon("truck"), dayWords(o.deliveryDate))
            : h("span", { class: "muted" }, "No date yet")),
          h("span", { class: "o-status", role: "cell" }, statusPill(o.status)),
          manyLots ? h("span", { class: "o-lot", role: "cell" }, app.lotName(o.lot)) : null))),
      list.length > state.shown ? h("button", { type: "button", class: "btn btn-ghost btn-block crm-more", onclick: () => { state.shown += PAGE * 3; draw(); } },
        `Show more (${(list.length - state.shown).toLocaleString("en-US")} left)`) : null);
  }

  draw();
  return page;
}

function sum(big, small) {
  return h("div", { class: "crm-sum" }, h("strong", {}, big), h("span", {}, small));
}

function deliveryTone(o) {
  if (o.status === "delivered" || o.status === "cancelled") return "crm-date";
  const today = todayKey();
  if (o.deliveryDate < today) return "crm-date late";
  if (followUpWords(o.deliveryDate) === "Today" || followUpWords(o.deliveryDate) === "Tomorrow") return "crm-date due";
  return "crm-date";
}
