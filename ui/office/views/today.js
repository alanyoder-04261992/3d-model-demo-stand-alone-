/* TODAY (#/): what to do first. The customers to call back (late ones
   first, in red), the new ones nobody has talked to yet (oldest first),
   the deliveries coming up, and this month's numbers -- with the same
   numbers per lot for an owner or manager looking at all lots.

   Everything comes from the customer list rows (one call), narrowed by the
   lot picked at the top. */

import { h, icon, linkButton, emptyState } from "../dom.js";
import {
  greeting, money, plural, todayKey, addDays, daysBetween, dayWords, followUpWords,
} from "../words.js";
import { followUpBadge, callButton, statusPill, buildingWords, thisMonth, dayKeyOf, sourceWords } from "./crm-kit.js";

const SHOW = 12;   /* rows per section before "Show all" */

export async function render(ctx) {
  const { app } = ctx;
  ctx.setTitle("Today");
  await app.loadCustomers();
  const rows = app.rowsInView();
  const today = todayKey();

  /* ---- the lists ---- */
  const due = rows.filter((r) => r.followUp?.date && r.followUp.date <= today && r.stage !== "lost")
    .sort((a, b) => a.followUp.date.localeCompare(b.followUp.date) || a.name.localeCompare(b.name));
  const fresh = rows.filter((r) => r.stage === "new")
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  const soon = addDays(today, 14);
  const deliveries = [];
  for (const r of rows) {
    for (const o of r.orders || []) {
      if (!o.deliveryDate || o.status === "delivered" || o.status === "cancelled") continue;
      if (o.deliveryDate <= soon) deliveries.push({ row: r, order: o });
    }
  }
  deliveries.sort((a, b) => a.order.deliveryDate.localeCompare(b.order.deliveryDate));

  /* ---- the words at the top ---- */
  const late = due.filter((r) => r.followUp.date < today).length;
  const lotWords = app.lotFilter === "all" ? (app.lots.length > 1 ? (app.seesAllLots ? "All lots" : "All your lots") : app.lots[0]?.name || "") : app.lotName(app.lotFilter);
  const dateWords = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const summary = [];
  if (due.length) summary.push(plural(due.length, "follow-up") + " due" + (late ? ` (${late} late)` : ""));
  if (fresh.length) summary.push(plural(fresh.length, "new customer") + " waiting");
  const head = h("header", { class: "page-head crm-today-head" },
    h("div", { class: "page-titles" },
      h("p", { class: "crm-eyebrow" }, [dateWords, lotWords].filter(Boolean).join(" · ")),
      h("h1", {}, greeting(app.person?.name)),
      h("p", {}, summary.length ? summary.join(", ") + "." : "You're all caught up. Nice work.")),
  );

  /* ---- follow-ups ---- */
  const followCard = section("crm-sec-follow", "Follow up today", "clock", due.length,
    due.length ? listOf(due, (r) => personRow(r, {
      sub: buildingWords(r) + (r.total != null ? ` · ${money(r.total)}` : ""),
      note: r.followUp.note,
      end: followUpBadge(r.followUp),
      lot: lotTag(app, r),
    })) : quiet("Nothing due today. Nice.", "When you set a follow-up on a customer, it shows up here on that day."));

  /* ---- new ---- */
  const newCard = section("crm-sec-new", "New — nobody has talked to them yet", "star", fresh.length,
    fresh.length ? listOf(fresh, (r) => {
      const waited = daysBetween(dayKeyOf(r.createdAt), today);
      return personRow(r, {
        sub: buildingWords(r) + (r.total != null ? ` · ${money(r.total)}` : ""),
        note: sourceWords(r.source),
        end: h("span", { class: ["crm-wait", waited >= 2 && "late"] }, waited <= 0 ? "Came in today" : waited === 1 ? "Waiting 1 day" : `Waiting ${waited} days`),
        lot: lotTag(app, r),
      });
    }) : quiet("Everyone has been contacted.", "New customers from your 3D designer and the ones you add show up here until someone calls, texts or emails them."));

  /* ---- deliveries ---- */
  const deliveryCard = section("crm-sec-deliveries", "Deliveries coming up", "truck", deliveries.length,
    deliveries.length ? listOf(deliveries, ({ row, order }) => deliveryRow(app, row, order, today))
      : quiet("No deliveries in the next two weeks.", "When an order has a delivery date, it shows up here two weeks ahead."));

  /* ---- this month ---- */
  const month = thisMonth();
  const stats = numbersFor(rows, month);
  const monthName = new Date().toLocaleDateString("en-US", { month: "long" });
  const tiles = h("section", { class: "card crm-month" },
    h("div", { class: "card-head" }, h("h2", { class: "card-title" }, icon("calendar"), `This month · ${monthName}`)),
    h("div", { class: "crm-tiles" },
      tile("New customers", stats.customers.toLocaleString("en-US"), "customers"),
      tile("Quotes made", stats.quotes.toLocaleString("en-US"), "shed"),
      tile("Buildings sold", stats.sold.toLocaleString("en-US"), "check"),
      tile("Sales", money(stats.sales), "dollar", true)));

  let perLot = null;
  if (app.seesAllLots && app.lotFilter === "all" && app.lots.length > 1) {
    const byLot = app.lots.map((l) => ({ lot: l, n: numbersFor(rows.filter((r) => r.lot === l.slug), month) }));
    perLot = h("section", { class: "card flush crm-perlot" },
      h("div", { class: "card-head" }, h("h2", { class: "card-title" }, icon("lots"), "Each lot this month")),
      h("div", { class: "table-wrap" }, h("table", { class: "table" },
        h("thead", {}, h("tr", {}, h("th", {}, "Lot"), h("th", { class: "right" }, "New"), h("th", { class: "right" }, "Quotes"),
          h("th", { class: "right" }, "Sold"), h("th", { class: "right" }, "Sales"))),
        h("tbody", {}, byLot.map(({ lot, n }) => h("tr", {},
          h("td", {}, lot.name, lot.active === false ? h("span", { class: "muted small" }, " (closed)") : null),
          h("td", { class: "right num" }, String(n.customers)), h("td", { class: "right num" }, String(n.quotes)),
          h("td", { class: "right num" }, String(n.sold)), h("td", { class: "right num" }, money(n.sales))))),
        h("tfoot", {}, h("tr", {}, h("th", {}, "All lots"), h("th", { class: "right num" }, String(stats.customers)),
          h("th", { class: "right num" }, String(stats.quotes)), h("th", { class: "right num" }, String(stats.sold)),
          h("th", { class: "right num" }, money(stats.sales)))))));
  }

  if (!rows.length) {
    return h("div", { class: "crm-today" }, head,
      h("section", { class: "card" }, emptyState("No customers yet",
        "Customers who send a quote from your 3D designer show up here, and so do the walk-ins and phone calls you add.",
        linkButton("Add customer", "#/customers?new=1", { kind: "primary", icon: "plus" }))));
  }

  return h("div", { class: "crm-today" }, head,
    h("div", { class: "crm-today-grid" },
      h("div", { class: "stack crm-today-left" }, followCard, newCard),
      h("div", { class: "stack crm-today-right" }, tiles, perLot, deliveryCard)));
}

/* ---- pieces ---------------------------------------------------------------- */

function section(cls, title, iconName, count, body) {
  return h("section", { class: ["card", "flush", "crm-section", cls] },
    h("div", { class: "card-head" },
      h("h2", { class: "card-title" }, icon(iconName), title),
      count ? h("span", { class: "crm-count" }, String(count)) : null),
    body);
}

function quiet(title, words) {
  return h("div", { class: "crm-quiet" }, icon("check"), h("div", {}, h("strong", {}, title), h("p", {}, words)));
}

function listOf(items, rowFn) {
  const list = h("div", { class: "rows crm-rows" }, items.slice(0, SHOW).map(rowFn));
  if (items.length <= SHOW) return list;
  const more = h("button", { type: "button", class: "btn btn-quiet btn-block crm-more", onclick: () => {
    list.append(...items.slice(SHOW).map(rowFn));
    more.remove();
  } }, `Show all ${items.length}`);
  return h("div", {}, list, more);
}

function lotTag(app, row) {
  return app.lotFilter === "all" && app.lots.length > 1 ? app.lotName(row.lot) : "";
}

function personRow(r, { sub, note, end, lot }) {
  return h("div", { class: "crm-line" },
    h("a", { class: "crm-line-main", href: `#/customers/${r.id}` },
      h("span", { class: "row-title" }, r.name),
      h("span", { class: "row-sub" }, [sub, lot].filter(Boolean).join(" · ")),
      note ? h("span", { class: "crm-note" }, note) : null,
      h("span", { class: "crm-line-end" }, end)),
    callButton(r.phone, r.name));
}

function deliveryRow(app, row, order, today) {
  const d = new Date(order.deliveryDate + "T12:00:00");
  const diff = daysBetween(today, order.deliveryDate);
  const soonWords = followUpWords(order.deliveryDate);
  const whenWords = diff < 0 ? "Not marked delivered yet" : soonWords === dayWords(order.deliveryDate) ? "" : soonWords;
  return h("div", { class: "crm-line" },
    h("a", { class: "crm-line-main crm-delivery", href: `#/customers/${row.id}/orders/${order.id}` },
      h("span", { class: ["crm-datebox", diff < 0 && "late"], "aria-hidden": "true" },
        h("span", {}, d.toLocaleDateString("en-US", { month: "short" })), h("strong", {}, String(d.getDate()))),
      h("span", { class: "row-title" }, row.name),
      h("span", { class: "row-sub" }, [order.building, lotTag(app, row)].filter(Boolean).join(" · ")),
      h("span", { class: "crm-delivery-status" }, statusPill(order.status), h("span", { class: "crm-num-small" }, `#${order.number}`),
        whenWords ? h("span", { class: ["crm-when-small", diff < 0 && "late"] }, whenWords) : null)),
    callButton(row.phone, row.name));
}

function tile(label, value, iconName, wide = false) {
  return h("div", { class: ["crm-tile", wide && "money"] },
    h("span", { class: "crm-tile-icon" }, icon(iconName)),
    h("strong", {}, value), h("span", {}, label));
}

function numbersFor(rows, month) {
  const n = { customers: 0, quotes: 0, sold: 0, sales: 0 };
  for (const r of rows) {
    if (dayKeyOf(r.createdAt).startsWith(month)) n.customers++;
    for (const [at] of r.quotes || []) if (dayKeyOf(at).startsWith(month)) n.quotes++;
    for (const o of r.orders || []) {
      if (o.status === "cancelled" || !dayKeyOf(o.soldAt).startsWith(month)) continue;
      n.sold++;
      n.sales += Number(o.total) || 0;
    }
  }
  return n;
}
