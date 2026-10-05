/* A CUSTOMER (#/customers/:id): everything about one person in one place.

   The stage (Lost asks why), the lot (owner and manager can move them),
   who is working them, how to reach them (Call, Text, Email, Edit), the
   next follow-up, every quote (see it in 3D, print it, change it, mark it
   sold), every order (where the building is, payment, delivery), and the
   history of everything anybody did, with a box to add a note, call, text,
   email or visit.

   Each change sends one small request; the answer is the whole customer,
   and the page redraws from it in place (no reload, the scroll stays). */

import { h, clear, icon, button, linkButton, field, checkbox, form, dialog, confirmBox, toast } from "../dom.js";
import { app } from "../app.js";
import { post, patch } from "../api.js";
import {
  STAGES, STAGE_WORDS, PAYMENTS, PAYMENT_WORDS, ORDER_WORDS, NOTE_KINDS, money, phone as phoneWords, telHref, smsHref,
  todayKey, addDays, dayWords, followUpWords, ago, when, plural,
} from "../words.js";
import { encodeSync } from "../../../model/design.js";
import { planWords } from "../../../model/quote-plan.js";
import { statusPill, followUpTone, changeStage, sourceWords, confirmChoice, dayKeyOf, dateFromNow, loadCustomer, missingCustomer } from "./crm-kit.js";

const STEPS = ["sold", "sent", "ready", "delivered"];
const ACTIVITY_ICONS = {
  created: "plus", website: "globe", quote: "shed", note: "note", call: "phone", text: "text", email: "mail", visit: "visit",
  stage: "arrowRight", followup: "calendar", assigned: "user", order: "dollar", "order-status": "truck", moved: "lots", edited: "edit",
};
const COMPOSE = {
  note: ["Write a note…", "Save note"],
  call: ["What did you talk about? (optional)", "Save call"],
  text: ["What did you text them? (optional)", "Save text"],
  email: ["What did you email them? (optional)", "Save email"],
  visit: ["What did they look at? (optional)", "Save visit"],
};
const ACTIVITY_PAGE = 25;

export async function render(ctx) {
  const { app } = ctx;
  const [id] = ctx.params;
  let c = await loadCustomer(id);
  if (!c) return missingCustomer(ctx);
  const view = { kind: "note", draft: "", activityShown: ACTIVITY_PAGE, open: new Set() };
  const root = h("div", { class: "crm-customer" });

  /* every change goes through here: send, take the new customer, redraw */
  async function act(work, done) {
    try {
      const out = await work();
      if (out?.customer) c = out.customer;
      app.customersChanged();
      paint();
      if (done) toast(typeof done === "function" ? done(out) : done);
      return out;
    } catch (e) {
      toast(e.message, { error: true });
      throw e;
    }
  }
  const quiet = (p) => p.catch(() => null);

  function paint() {
    ctx.setTitle(c.name);
    const side = h("div", { class: "crm-cust-side" }, contactCard(), followCard(), lotCard());
    const main = h("div", { class: "crm-cust-main" }, quotesCard(), ordersCard(), activityCard());
    clear(root, header(), c.stage === "lost" ? lostBanner() : null, h("div", { class: "crm-cust-grid" }, main, side));
  }

  /* ---- the top ---- */
  function header() {
    const stageSel = h("select", { class: ["crm-stage-select", `stage-${c.stage}`], "aria-label": "Stage" },
      STAGES.map(([k, label]) => h("option", { value: k }, label)));
    stageSel.value = c.stage;
    stageSel.addEventListener("change", async () => {
      const stage = stageSel.value;
      stageSel.value = c.stage;
      const live = c.orders.some((o) => o.status !== "cancelled");
      if ((stage === "sold" || stage === "delivered") && !live) {
        const pick = await confirmChoice(`Mark ${c.name} ${STAGE_WORDS[stage]}?`,
          c.quotes.length
            ? "An order keeps the price, payment and delivery date. Tap Mark sold on the quote they're buying, or just change the stage."
            : "They have no quote yet. Design a building for them and mark it sold, or just change the stage.",
          [["back", c.quotes.length ? "Pick the quote" : "Design a building", "primary"], ["move", "Just change the stage", "ghost"]]);
        if (pick === "back" && !c.quotes.length) { ctx.go(`/customers/${c.id}/design`); return; }
        if (pick !== "move") return;
      }
      await quiet(act(async () => ({ customer: await changeStage(c, stage) || c })));
    });
    const facts = [app.lotName(c.lot), sourceWords(c.source), `Added ${dayWords(dayKeyOf(c.createdAt))}`];
    return h("header", { class: "crm-cust-head" },
      h("a", { class: "back", href: "#/customers" }, icon("arrowLeft"), "Customers"),
      h("div", { class: "crm-cust-title" },
        h("div", { class: "page-titles" }, h("h1", {}, c.name), h("p", { class: "crm-cust-facts" }, facts.join(" · "))),
        h("div", { class: "crm-cust-actions" },
          h("label", { class: "crm-stage-pick" }, h("span", {}, "Stage"), stageSel),
          linkButton("Design a building for them", `#/customers/${c.id}/design`, { kind: "accent", icon: "cube" }))));
  }

  function lostBanner() {
    return h("div", { class: "banner info crm-lost" }, icon("alert"),
      h("span", {}, c.lostReason ? `Lost: ${c.lostReason}` : "Marked Lost."),
      button("Work them again", () => quiet(act(async () => ({ customer: await changeStage(c, c.quotes.length ? "quoted" : "contacted") }))), { small: true }));
  }

  /* ---- contact ---- */
  function contactCard() {
    const cityLine = [c.city, [c.state, c.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");
    const quick = h("div", { class: "crm-reach" },
      c.phone ? linkButton("Call", telHref(c.phone), { kind: "primary", icon: "phone" }) : null,
      c.phone ? linkButton("Text", smsHref(c.phone), { kind: "ghost", icon: "text" }) : null,
      c.email ? linkButton("Email", `mailto:${c.email}`, { kind: "ghost", icon: "mail" }) : null);
    return h("section", { class: "card crm-contact" },
      h("div", { class: "card-head" }, h("h2", { class: "card-title" }, "Contact"),
        button("Edit", () => editContact(), { kind: "quiet", icon: "edit", small: true })),
      h("dl", { class: "crm-facts" },
        c.phone ? [h("dt", {}, "Phone"), h("dd", {}, h("a", { href: telHref(c.phone) }, phoneWords(c.phone)),
          c.smsOk === true ? h("span", { class: "pill plain crm-ok" }, icon("check"), "OK to text") : null,
          c.smsOk === false ? h("span", { class: "pill plain" }, "Don't text") : null)] : null,
        c.email ? [h("dt", {}, "Email"), h("dd", {}, h("a", { href: `mailto:${c.email}`, class: "crm-break" }, c.email))] : null,
        c.address || cityLine ? [h("dt", {}, "Address"), h("dd", { class: "crm-pre" }, [c.address, cityLine].filter(Boolean).join("\n"))] : null),
      quick.children.length ? quick : null);
  }

  function editContact() {
    const f = {
      name: field("Name", { required: true, value: c.name, maxLength: 100, wide: true }),
      phone: field("Phone", { type: "tel", value: c.phone, inputmode: "tel" }),
      email: field("Email", { type: "email", value: c.email }),
      address: field("Street address", { value: c.address, wide: true }),
      city: field("City", { value: c.city }),
      state: field("State", { value: c.state, maxLength: 40 }),
      zip: field("ZIP", { value: c.zip, inputmode: "numeric", maxLength: 12 }),
    };
    const sms = checkbox("OK to text", c.smsOk === true, { hint: "They said we can send them text messages." });
    const box = dialog(`Edit ${c.name}`, form([
      h("div", { class: "form-grid" }, Object.values(f).map((x) => x.wrap)),
      sms.wrap,
      h("div", { class: "actions end" }, button("Cancel", () => box.close()),
        h("button", { type: "submit", class: "btn btn-primary" }, icon("check"), h("span", {}, "Save changes"))),
    ], async () => {
      const body = {};
      for (const [k, x] of Object.entries(f)) if (x.input.value.trim() !== (c[k] || "")) body[k] = x.input.value.trim();
      if (sms.input.checked !== (c.smsOk === true)) body.smsOk = sms.input.checked;
      if (!Object.keys(body).length) { box.close(); return; }
      if (!(body.phone ?? c.phone) && !(body.email ?? c.email)) throw new Error("Keep a phone number or an email address so the lot can reach them.");
      const out = await patch(`customers/${c.id}`, body);
      box.close();
      await act(async () => out, "Contact details saved.");
    }), { wide: true });
  }

  /* ---- follow-up ---- */
  function followCard() {
    const f = c.followUp;
    const note = field("Note", { value: f?.note || "", placeholder: "Call about the delivery date", maxLength: 300 });
    const date = field("Or pick a day", { type: "date", value: f?.date || "" });
    const setTo = (key) => quiet(act(() => patch(`customers/${c.id}`, { followUp: { date: key, note: note.input.value.trim() } }),
      `Follow-up set for ${dayWords(key)}.`));
    const quick = h("div", { class: "crm-quick" },
      [["Today", 0], ["Tomorrow", 1], ["In 3 days", 3], ["Next week", 7]].map(([label, n]) =>
        h("button", { type: "button", class: "chip", onclick: () => setTo(addDays(todayKey(), n)) }, label)));
    const now = f ? h("div", { class: ["crm-follow-now", followUpTone(f.date)] },
      h("span", { class: "crm-follow-day" }, icon("clock"), h("strong", {}, followUpWords(f.date)), h("span", {}, dayWords(f.date))),
      f.note ? h("p", {}, f.note) : null,
      button("Done", () => quiet(act(() => patch(`customers/${c.id}`, { followUp: null }), "Follow-up done.")), { kind: "primary", icon: "check", small: true }))
      : h("p", { class: "muted crm-follow-none" }, "No follow-up set. Pick a day to see them on Today.");
    return h("section", { class: "card crm-followcard" },
      h("div", { class: "card-head" }, h("h2", { class: "card-title" }, "Follow-up")),
      now,
      h("div", { class: "crm-follow-set" },
        h("p", { class: "crm-label" }, f ? "Move it to" : "Follow up"),
        quick,
        form([note.wrap, h("div", { class: "crm-follow-row" }, date.wrap,
          h("button", { type: "submit", class: "btn btn-ghost" }, h("span", {}, "Save follow-up")))], async () => {
          if (!date.input.value) throw new Error("Pick a day, or tap one of the buttons above.");
          await setTo(date.input.value);
        })));
  }

  /* ---- lot and who is working them ---- */
  function lotCard() {
    const team = app.teamFor(c.lot);
    const who = h("select", { "aria-label": "Working them" },
      h("option", { value: "" }, "Nobody yet"), team.map((p) => h("option", { value: p.userId }, p.name || p.email)));
    who.value = team.some((p) => p.userId === c.assignedTo) ? c.assignedTo : "";
    who.addEventListener("change", () => {
      const pickedName = who.value ? app.personName(who.value) : "";
      quiet(act(() => patch(`customers/${c.id}`, { assignedTo: who.value || null }), pickedName ? `${pickedName} is working ${c.name} now.` : `Nobody is working ${c.name} now.`));
    });
    let lotPart;
    if (app.can("moveCustomers") && app.lots.length > 1) {
      const lotSel = h("select", { "aria-label": "Lot" }, app.lots.map((l) => h("option", { value: l.slug }, l.name + (l.active === false ? " (closed)" : ""))));
      lotSel.value = c.lot;
      lotSel.addEventListener("change", async () => {
        const to = lotSel.value;
        lotSel.value = c.lot;
        if (to === c.lot) return;
        const ok = await confirmBox(`Move ${c.name} to ${app.lotName(to)}?`,
          `${app.lotName(to)}'s dealers will see ${c.name.split(" ")[0]} from now on, and ${app.lotName(c.lot)}'s dealers won't. Their quotes, orders and notes go with them.`,
          { yes: `Move to ${app.lotName(to)}` });
        if (ok) quiet(act(() => patch(`customers/${c.id}`, { lot: to }), `${c.name} moved to ${app.lotName(to)}.`));
      });
      lotPart = h("div", { class: "field" }, h("label", {}, "Lot"), lotSel);
    } else {
      lotPart = h("div", { class: "field" }, h("label", {}, "Lot"), h("p", { class: "crm-static" }, icon("lots"), app.lotName(c.lot)));
    }
    return h("section", { class: "card crm-lotcard" },
      h("h2", { class: "card-title" }, "Lot and salesperson"),
      h("div", { class: "form" }, lotPart, h("div", { class: "field" }, h("label", {}, "Working them"), who)));
  }

  /* ---- quotes ---- */
  function quotesCard() {
    const quotes = c.quotes.slice().reverse();
    const designBtn = linkButton("Design a building", `#/customers/${c.id}/design`, { kind: "ghost", icon: "plus", small: true });
    return h("section", { class: "card crm-quotes" },
      h("div", { class: "card-head" }, h("h2", { class: "card-title" }, "Quotes", quotes.length ? h("span", { class: "crm-count" }, String(quotes.length)) : null), quotes.length ? designBtn : null),
      quotes.length ? h("div", { class: "crm-quote-list" }, quotes.map(quoteItem))
        : h("div", { class: "crm-none" }, h("p", {}, "No quotes yet. Design a building with them and save it here — it gets a quote number they can come back with."),
          linkButton("Design a building for them", `#/customers/${c.id}/design`, { kind: "accent", icon: "cube" })));
  }

  function quoteItem(q) {
    const order = c.orders.find((o) => o.quoteId === q.id && o.status !== "cancelled");
    const lines = q.price?.lines || [];
    const madeBy = q.source === "website" || !q.by ? `Sent from the ${app.lotName(c.lot)} 3D designer` : `Made by ${q.by.name}`;
    const open = view.open.has(q.id);
    const details = h("details", { class: "crm-lines", open },
      h("summary", {}, `Price lines (${lines.length + 1})`),
      priceTable(q));
    details.addEventListener("toggle", () => { if (details.open) view.open.add(q.id); else view.open.delete(q.id); });
    return h("article", { class: ["crm-quote", order && "sold"] },
      h("div", { class: "crm-quote-top" },
        h("div", {},
          h("p", { class: "crm-num" }, `Quote #${q.number}`),
          h("h3", {}, q.building),
          h("p", { class: "crm-meta" }, `${dayWords(dayKeyOf(q.at))} · ${madeBy}`),
          /* what the customer said on the 3D designer's quote form */
          planWords(q.plan) ? h("p", { class: "crm-want" }, "What they want to do: ", h("strong", {}, planWords(q.plan))) : null,
          q.rto ? h("p", { class: "crm-want" }, `Looked at rent to own: ${money(q.rto.monthly)} a month over ${q.rto.months} months`) : null),
        h("div", { class: "crm-quote-total" }, h("strong", {}, money(q.total)),
          order ? h("a", { class: "pill status-sold", href: `#/customers/${c.id}/orders/${order.id}` }, `Sold · order #${order.number}`) : null)),
      details,
      h("div", { class: "crm-quote-actions" },
        order ? null : button("Mark sold", () => markSold(q), { kind: "primary", icon: "check" }),
        h("a", { class: "btn btn-ghost", href: `${app.designerUrl(c.lot)}#d=${encodeSync(q.design)}&view=1`, target: "_blank", rel: "noopener" }, icon("cube"), h("span", {}, "See it in 3D")),
        linkButton("Change it", `#/customers/${c.id}/design/${q.id}`, { kind: "ghost", icon: "edit" }),
        linkButton("Print", `#/customers/${c.id}/quotes/${q.id}`, { kind: "ghost", icon: "print" })));
  }

  function priceTable(q) {
    const p = q.price || { base: q.total, lines: [], total: q.total };
    return h("table", { class: "crm-price" },
      h("tbody", {},
        h("tr", {}, h("td", {}, `${q.building}`, h("small", {}, " base price")), h("td", { class: "num" }, money(p.base))),
        (p.lines || []).map(([label, amount]) => h("tr", {}, h("td", {}, label), h("td", { class: "num" }, money(amount))))),
      h("tfoot", {}, h("tr", {}, h("th", {}, "Total"), h("th", { class: "num" }, money(p.total)))));
  }

  function addressOf() {
    if (!c.address && !c.city) return "";
    return [c.address, [c.city, [c.state, c.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ")].filter(Boolean).join("\n");
  }

  function markSold(q) {
    const pay = field("Payment", { type: "select", options: PAYMENTS, required: true, value: "cash" });
    const deposit = field("Deposit", { type: "money", placeholder: "0", hint: `Total ${money(q.total)}` });
    const addr = field("Delivery address", { type: "textarea", rows: 2, value: addressOf(), wide: true });
    const date = field("Delivery date", { type: "date", min: todayKey() });
    const dnotes = field("Delivery notes", { type: "textarea", rows: 2, wide: true, placeholder: "Gate code, where to set it, ground level…" });
    const notes = field("Order notes", { type: "textarea", rows: 2, wide: true });
    const box = dialog(`Mark quote #${q.number} sold`, form([
      h("div", { class: "crm-sold-sum" }, icon("shed"), h("div", {}, h("strong", {}, q.building), h("span", {}, `Quote #${q.number}`)), h("strong", { class: "num" }, money(q.total))),
      h("div", { class: "form-grid" }, pay.wrap, deposit.wrap, date.wrap, addr.wrap, dnotes.wrap, notes.wrap),
      h("div", { class: "actions end" }, button("Cancel", () => box.close()),
        h("button", { type: "submit", class: "btn btn-primary" }, icon("check"), h("span", {}, "Make the order"))),
    ], async () => {
      const dep = deposit.input.value === "" ? null : Number(deposit.input.value);
      if (dep != null && (!Number.isFinite(dep) || dep < 0)) throw new Error("Deposit must be a dollar amount.");
      if (dep != null && dep > q.total) throw new Error(`The deposit is more than the building costs (${money(q.total)}).`);
      const out = await post(`customers/${c.id}/orders`, {
        quoteId: q.id, payment: pay.input.value, deposit: dep, deliveryAddress: addr.input.value.trim(),
        deliveryDate: date.input.value, deliveryNotes: dnotes.input.value.trim(), notes: notes.input.value.trim(),
      });
      box.close();
      await act(async () => out, `Sold. Order #${out.order.number} — ${money(out.order.total)}.`);
    }), { wide: true });
  }

  /* ---- orders ---- */
  function ordersCard() {
    if (!c.orders.length) return null;
    const orders = c.orders.slice().reverse();
    return h("section", { class: "card crm-orders" },
      h("div", { class: "card-head" }, h("h2", { class: "card-title" }, "Orders", h("span", { class: "crm-count" }, String(orders.length)))),
      h("div", { class: "crm-order-list" }, orders.map(orderItem)));
  }

  function orderItem(o) {
    const cancelled = o.status === "cancelled";
    const balance = Math.max(0, (Number(o.total) || 0) - (Number(o.deposit) || 0));
    const at = STEPS.indexOf(o.status);
    const stepper = cancelled ? null : h("ol", { class: "crm-steps", "aria-label": "Where the building is" },
      STEPS.map((s, i) => h("li", { class: [i < at && "done", i === at && "now"] },
        h("button", { type: "button", "aria-current": i === at ? "step" : null, disabled: i === at,
          title: i === at ? `${ORDER_WORDS[s]} now` : `Mark ${ORDER_WORDS[s]}`,
          onclick: () => quiet(act(() => patch(`customers/${c.id}/orders/${o.id}`, { status: s }), `Order #${o.number} moved to ${ORDER_WORDS[s]}.`)) },
        h("span", { class: "crm-step-dot" }, i < at ? icon("check") : String(i + 1)), h("span", {}, ORDER_WORDS[s])))));
    const fact = (label, value, cls) => value ? [h("dt", {}, label), h("dd", { class: cls }, value)] : null;
    return h("article", { class: ["crm-order", cancelled && "cancelled"] },
      h("div", { class: "crm-quote-top" },
        h("div", {},
          h("p", { class: "crm-num" }, `Order #${o.number}`),
          h("h3", {}, o.building),
          h("p", { class: "crm-meta" }, `Sold ${dayWords(dayKeyOf(o.soldAt))}${o.soldBy?.name ? ` by ${o.soldBy.name}` : ""}`)),
        h("div", { class: "crm-quote-total" }, h("strong", {}, money(o.total)), statusPill(o.status))),
      stepper,
      h("dl", { class: "crm-facts two" },
        fact("Payment", PAYMENT_WORDS[o.payment] || "—"),
        fact("Deposit", money(o.deposit || 0)),
        fact("Balance due", money(balance), balance > 0 ? "crm-due" : ""),
        fact("Delivery date", o.deliveryDate ? dateFromNow(o.deliveryDate) : "Not set yet"),
        fact("Deliver to", o.deliveryAddress, "crm-pre"),
        fact("Delivery notes", o.deliveryNotes, "crm-pre"),
        fact("Order notes", o.notes, "crm-pre")),
      h("div", { class: "crm-quote-actions" },
        linkButton("Print order", `#/customers/${c.id}/orders/${o.id}`, { kind: "ghost", icon: "print" }),
        button("Edit order details", () => editOrder(o), { kind: "ghost", icon: "edit" }),
        cancelled
          ? button("Reopen order", () => quiet(act(() => patch(`customers/${c.id}/orders/${o.id}`, { status: "sold" }), `Order #${o.number} is open again.`)), { kind: "quiet", icon: "history" })
          : button("Cancel order", async () => {
            const ok = await confirmBox(`Cancel order #${o.number}?`,
              `${c.name}'s order for the ${o.building} will show as Cancelled everywhere, and it leaves the sales numbers. The quote stays, so you can sell it again later.`,
              { yes: "Cancel order", no: "Keep the order", danger: true });
            if (ok) quiet(act(() => patch(`customers/${c.id}/orders/${o.id}`, { status: "cancelled" }), `Order #${o.number} is cancelled.`));
          }, { kind: "quiet", icon: "x" })));
  }

  function editOrder(o) {
    const pay = field("Payment", { type: "select", options: PAYMENTS });
    pay.input.value = o.payment;
    const deposit = field("Deposit", { type: "money", value: o.deposit ?? "", hint: `Total ${money(o.total)}` });
    const date = field("Delivery date", { type: "date", value: o.deliveryDate || "" });
    const addr = field("Delivery address", { type: "textarea", rows: 2, value: o.deliveryAddress || "", wide: true });
    const dnotes = field("Delivery notes", { type: "textarea", rows: 2, value: o.deliveryNotes || "", wide: true });
    const notes = field("Order notes", { type: "textarea", rows: 2, value: o.notes || "", wide: true });
    const box = dialog(`Order #${o.number}`, form([
      h("div", { class: "form-grid" }, pay.wrap, deposit.wrap, date.wrap, addr.wrap, dnotes.wrap, notes.wrap),
      h("div", { class: "actions end" }, button("Cancel", () => box.close()),
        h("button", { type: "submit", class: "btn btn-primary" }, icon("check"), h("span", {}, "Save order"))),
    ], async () => {
      const dep = deposit.input.value === "" ? 0 : Number(deposit.input.value);
      if (!Number.isFinite(dep) || dep < 0) throw new Error("Deposit must be a dollar amount.");
      if (dep > o.total) throw new Error(`The deposit is more than the building costs (${money(o.total)}).`);
      const next = { payment: pay.input.value, deposit: dep, deliveryDate: date.input.value, deliveryAddress: addr.input.value.trim(),
        deliveryNotes: dnotes.input.value.trim(), notes: notes.input.value.trim() };
      const body = {};
      for (const [k, v] of Object.entries(next)) if (String(v ?? "") !== String(o[k] ?? "")) body[k] = v;
      if (!Object.keys(body).length) { box.close(); return; }
      const out = await patch(`customers/${c.id}/orders/${o.id}`, body);
      box.close();
      await act(async () => out, `Order #${o.number} saved.`);
    }), { wide: true });
  }

  /* ---- what happened ---- */
  function activityCard() {
    const kinds = h("div", { class: "crm-kinds", role: "group", "aria-label": "What happened" });
    const textBox = h("textarea", { rows: 3, "aria-label": "What happened", maxLength: 4000 });
    textBox.value = view.draft;
    textBox.addEventListener("input", () => { view.draft = textBox.value; });
    const saveBtn = h("button", { type: "submit", class: "btn btn-primary" }, icon("check"), h("span", {}, ""));
    const setKind = (k) => {
      view.kind = k;
      for (const b of kinds.children) b.setAttribute("aria-pressed", String(b.dataset.key === k));
      textBox.placeholder = COMPOSE[k][0];
      saveBtn.querySelector("span").textContent = COMPOSE[k][1];
    };
    for (const [k, label, ic] of NOTE_KINDS) {
      kinds.append(h("button", { type: "button", dataset: { key: k }, onclick: () => { setKind(k); textBox.focus(); } }, icon(ic), h("span", {}, label)));
    }
    setKind(view.kind);
    const doneBox = c.followUp ? checkbox(`Follow-up done (it was set for ${dayWords(c.followUp.date)})`, false) : null;
    const composer = form([kinds, textBox,
      h("div", { class: "crm-compose-foot" }, doneBox ? doneBox.wrap : h("span", {}), saveBtn)], async () => {
      const words = textBox.value.trim();
      if (view.kind === "note" && !words) { textBox.focus(); throw new Error("Write the note first."); }
      const body = { type: view.kind, text: words };
      if (doneBox?.input.checked) body.clearFollowUp = true;
      const out = await post(`customers/${c.id}/activity`, body);
      view.draft = "";
      await act(async () => out, { note: "Note saved.", call: "Call saved.", text: "Text saved.", email: "Email saved.", visit: "Visit saved." }[body.type]);
    }, { class: "crm-compose" });

    const items = c.activity.slice().reverse();
    const shown = items.slice(0, view.activityShown);
    return h("section", { class: "card crm-activity" },
      h("div", { class: "card-head" }, h("h2", { class: "card-title" }, "What happened")),
      composer,
      h("ol", { class: "crm-feed" }, shown.map((a) => h("li", { class: `t-${a.type}` },
        h("span", { class: "crm-feed-icon" }, icon(ACTIVITY_ICONS[a.type] || "dot")),
        h("div", { class: "crm-feed-body" },
          h("p", { class: "crm-pre" }, a.text),
          h("p", { class: "crm-meta" }, a.by?.name || (a.type === "website" ? "3D designer" : "Automatic"), " · ",
            h("time", { dateTime: a.at, title: when(a.at) }, ago(a.at))))))),
      items.length > shown.length ? button(`Show ${plural(items.length - shown.length, "older line")}`, () => { view.activityShown = items.length; paint(); }, { kind: "quiet" }) : null);
  }

  paint();
  return root;
}
