/* THE ORDER SHEET AND THE QUOTE SHEET (#/customers/:cid/orders/:oid and
   #/customers/:cid/quotes/:qid): one printable page to hand the customer
   or send to the builder.

   The business and the lot at the top, the number and date, the customer,
   the building (its colors, the doors and windows it comes with and the
   ones added), the price lines as they were when the quote was made, and
   for an order the payment, deposit, balance and delivery; signature lines
   and the business's fine print at the bottom. "Print" uses the browser's
   own print (print.css hides everything but the sheet).

   A picture of the building is added when the lot's 3D designer can draw
   one in a hidden frame; the sheet never waits for it. */

import { h, icon, button, emptyState, linkButton } from "../dom.js";
import { get } from "../api.js";
import { money, phone as phoneWords, PAYMENT_WORDS, ORDER_WORDS, initials } from "../words.js";
import { encodeSync } from "../../../model/design.js";
import { resolve as resolveCatalogue } from "../../../model/company.js";

const PICTURE_MS = 25000;
const COLOR_WORDS = [["body", "Siding"], ["trim", "Trim"], ["roof", "Roof"], ["door", "Door"], ["shutters", "Shutters"]];

export async function render(ctx) {
  const { app } = ctx;
  const [cid, xid] = ctx.params;
  const isOrder = ctx.view === "order";
  const c = (await get(`customers/${cid}`)).customer;
  const order = isOrder ? c.orders.find((o) => o.id === xid) : null;
  const quote = isOrder ? (order && c.quotes.find((q) => q.id === order.quoteId)) : c.quotes.find((q) => q.id === xid);
  const backTo = h("a", { class: "back", href: `#/customers/${c.id}` }, icon("arrowLeft"), c.name);

  if ((isOrder && !order) || (!isOrder && !quote)) {
    ctx.setTitle("Not found");
    return h("div", {}, backTo, h("div", { class: "card" }, emptyState(isOrder ? "That order isn't here" : "That quote isn't here",
      "It may have been moved to another customer. Go back and open it again.", linkButton(`Back to ${c.name}`, `#/customers/${c.id}`, { kind: "primary" }))));
  }

  const number = isOrder ? order.number : quote.number;
  const kindWords = isOrder ? "Order" : "Quote";
  ctx.setTitle(`${kindWords} #${number} · ${c.name}`);

  /* the price list (fine print) and, if it loads, the names of the doors and windows */
  const [priceList, cat] = await Promise.all([
    app.loadPriceList().catch(() => null),
    catalogue(app).catch(() => null),
  ]);
  const settings = priceList?.settings || {};
  const business = app.business || {};
  const lot = app.lot(c.lot) || { name: app.lotName(c.lot) };
  const design = quote?.design || null;
  const price = quote?.price || { base: order?.total ?? 0, lines: [], total: order?.total ?? 0 };
  const total = isOrder ? order.total : quote.total;
  const dateIso = isOrder ? order.soldAt : quote.at;
  const building = isOrder ? order.building : quote.building;

  /* ---- top ---- */
  const logo = business.logo ? h("img", { class: "sheet-logo", src: business.logo, alt: "" })
    : h("span", { class: "sheet-initials", "aria-hidden": "true" }, business.initials || initials(business.name));
  const top = h("header", { class: "sheet-top" },
    h("div", { class: "sheet-business" }, logo,
      h("div", {}, h("h2", {}, business.name || ""),
        lines([business.phone && phoneWords(business.phone), business.email, business.website && business.website.replace(/^https?:\/\//, "").replace(/\/$/, "")]))),
    h("div", { class: "sheet-lot" },
      h("strong", {}, lot.name),
      lines([lot.address, [lot.city, [lot.state, lot.zip].filter(Boolean).join(" ")].filter(Boolean).join(", "), lot.phone && phoneWords(lot.phone), lot.email])));

  const title = h("div", { class: "sheet-title" },
    h("div", {}, h("h1", {}, `${kindWords} #${number}`),
      h("p", {}, `${isOrder ? "Sold" : "Quoted"} ${longDate(dateIso)}`,
        isOrder && order.soldBy?.name ? ` by ${order.soldBy.name}` : (!isOrder && quote.by?.name ? ` by ${quote.by.name}` : ""))),
    isOrder ? h("span", { class: ["pill", `status-${order.status}`] }, ORDER_WORDS[order.status]) : null);

  /* ---- who and where ---- */
  const cityLine = [c.city, [c.state, c.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const people = h("div", { class: "sheet-two" },
    block("Customer", h("strong", {}, c.name), lines([c.phone && phoneWords(c.phone), c.email, c.address, cityLine])),
    isOrder
      ? block("Delivery",
        h("p", {}, h("strong", {}, order.deliveryDate ? longDate(order.deliveryDate + "T12:00:00") : "Date to be set")),
        order.deliveryAddress ? h("p", { class: "sheet-pre" }, order.deliveryAddress) : null,
        order.deliveryNotes ? h("p", { class: "sheet-pre sheet-small" }, order.deliveryNotes) : null)
      : block("Building", h("strong", {}, building), h("p", { class: "sheet-small" }, `${lot.name} lot`)));

  /* ---- the building ---- */
  const picture = h("div", { class: "sheet-picture", hidden: true });
  const buildingPart = h("section", { class: "sheet-section sheet-building" },
    h("h3", {}, "The building"),
    h("p", { class: "sheet-building-name" }, building),
    design ? colorList(design) : null,
    design && cat ? itemLists(design, cat) : null,
    picture);

  /* ---- the price ---- */
  const deposit = isOrder ? Number(order.deposit) || 0 : 0;
  const priceTable = h("table", { class: "sheet-price" },
    h("thead", {}, h("tr", {}, h("th", {}, "Item"), h("th", { class: "num" }, "Price"))),
    h("tbody", {},
      h("tr", {}, h("td", {}, building, h("span", { class: "sheet-small" }, " — base price, standard doors and windows included")), h("td", { class: "num" }, money(price.base))),
      (price.lines || []).map(([label, amount]) => h("tr", {}, h("td", {}, label), h("td", { class: "num" }, money(amount))))),
    h("tfoot", {},
      h("tr", { class: "sheet-total" }, h("th", {}, "Total"), h("th", { class: "num" }, money(total))),
      isOrder ? h("tr", {}, h("td", {}, "Deposit paid"), h("td", { class: "num" }, money(deposit))) : null,
      isOrder ? h("tr", { class: "sheet-balance" }, h("th", {}, "Balance due"), h("th", { class: "num" }, money(Math.max(0, total - deposit)))) : null));
  const pricePart = h("section", { class: "sheet-section" }, h("h3", {}, "Price"), priceTable,
    isOrder ? h("p", { class: "sheet-pay" }, h("strong", {}, "Payment: "), PAYMENT_WORDS[order.payment] || "—") : null,
    isOrder && order.notes ? h("p", { class: "sheet-pre sheet-notes" }, h("strong", {}, "Notes: "), order.notes) : null,
    !isOrder && quote.note ? h("p", { class: "sheet-pre sheet-notes" }, h("strong", {}, "Notes: "), quote.note) : null);

  /* ---- sign and fine print ---- */
  const signs = h("section", { class: "sheet-signs" },
    sign("Customer"), sign("Date"), sign("Dealer"), sign("Date"));
  const finePrint = settings.notes?.finePrint ? h("p", { class: "sheet-fine" }, settings.notes.finePrint) : null;

  const sheet = h("article", { class: "sheet" }, top, title, people, buildingPart, pricePart, signs, finePrint);

  const tools = h("div", { class: "sheet-tools" }, backTo,
    h("div", { class: "actions" },
      design ? h("a", { class: "btn btn-ghost", href: `/d/${c.lot}/#d=${encodeSync(design)}&view=1`, target: "_blank", rel: "noopener" }, icon("cube"), h("span", {}, "See it in 3D")) : null,
      button(`Print ${kindWords.toLowerCase()}`, () => window.print(), { kind: "primary", icon: "print" })));

  const page = h("div", { class: "sheet-page" }, tools, sheet);
  if (design) setTimeout(() => addPicture(c.lot, design, picture), 50);
  return page;
}

/* ---- pieces ------------------------------------------------------------------- */

function lines(list) {
  const items = list.filter(Boolean);
  return items.length ? h("p", { class: "sheet-lines" }, items.flatMap((t, i) => (i ? [h("br"), t] : [t]))) : null;
}

function block(title, ...children) {
  return h("section", { class: "sheet-block" }, h("h3", {}, title), children);
}

function sign(label) {
  return h("div", { class: "sheet-sign" }, h("span", { class: "sheet-sign-line" }), h("span", {}, label));
}

function longDate(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.valueOf()) ? "" : d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function colorList(design) {
  const colors = COLOR_WORDS.filter(([k]) => design.colors?.[k]).map(([k, label]) => [label, design.colors[k]]);
  if (!colors.length) return null;
  return h("dl", { class: "sheet-colors" }, colors.map(([label, name]) => [h("dt", {}, label), h("dd", {}, name)]));
}

/* The doors, windows and fixtures by name, counted ("2×3 Window × 2"). */
function itemLists(design, cat) {
  const groups = { comes: new Map(), added: new Map(), elec: new Map() };
  for (const it of design.items || []) {
    const def = cat.CAT?.[it.cat];
    if (!def) continue;
    let name = def.n;
    if (it.dbl) name += " (double)";
    if (it.shut) name += " with shutters";
    if (it.lite) name += " with door window";
    if (it.inc && it.origCat && it.origCat !== it.cat) name += " (upgrade)";
    const group = it.pk ? groups.elec : it.inc ? groups.comes : groups.added;
    group.set(name, (group.get(name) || 0) + 1);
  }
  const list = (title, map) => map.size ? h("div", { class: "sheet-items" }, h("h4", {}, title),
    h("ul", {}, [...map].map(([name, n]) => h("li", {}, n > 1 ? `${name} × ${n}` : name)))) : null;
  const parts = [list("Comes with", groups.comes), list("Added", groups.added), list("Electrical", groups.elec)].filter(Boolean);
  return parts.length ? h("div", { class: "sheet-item-cols" }, parts) : null;
}

let catalogueCache = null;
async function catalogue(app) {
  const pl = await app.loadPriceList();
  if (catalogueCache && catalogueCache.version === pl.version) return catalogueCache.cat;
  const json = async (url) => {
    const r = await fetch(url, { credentials: "same-origin" });
    if (!r.ok) throw new Error("not found");
    return r.json();
  };
  const [manufacturer, library] = await Promise.all([json("/library/manufacturers/standard.json"), json("/library/construction.json")]);
  const cat = resolveCatalogue(pl.settings, manufacturer, library);
  catalogueCache = { version: pl.version, cat };
  return cat;
}

/* A picture of the building from the lot's own designer, drawn in a frame
   nobody sees. Any trouble (a closed lot, a slow computer) and the sheet
   simply has no picture. */
async function addPicture(lot, design, slot) {
  if (!slot.isConnected) return;
  const frame = h("iframe", { class: "sheet-shot", title: "Picture of the building", "aria-hidden": "true", tabindex: "-1",
    src: `/d/${encodeURIComponent(lot)}/?embed=1#d=${encodeSync(design)}&view=1` });
  Object.assign(frame.style, { position: "fixed", left: "-12000px", top: "0", width: "960px", height: "640px", border: "0", opacity: "0", pointerEvents: "none" });
  document.body.append(frame);
  const done = () => frame.remove();
  const started = Date.now();
  try {
    const shed = await new Promise((resolve, reject) => {
      const tick = setInterval(() => {
        let api = null;
        try { api = frame.contentWindow?.shedUI; } catch { api = null; }
        if (api?.ready) { clearInterval(tick); resolve(api); }
        else if (!slot.isConnected || Date.now() - started > PICTURE_MS) { clearInterval(tick); reject(new Error("slow")); }
      }, 300);
    });
    if (!shed.quote?.images || !slot.isConnected) return done();
    const pics = await shed.quote.images();
    const view = pics?.images?.view;
    if (view && slot.isConnected) {
      slot.replaceChildren(h("img", { src: view, alt: "The building from the front, right, back and left" }));
      slot.hidden = false;
    }
  } catch { /* no picture this time */ }
  done();
}
