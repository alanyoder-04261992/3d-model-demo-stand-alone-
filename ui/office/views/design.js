/* DESIGN A BUILDING FOR A CUSTOMER (#/customers/:id/design, or
   .../design/:quoteId to change a quote).

   The lot's own 3D designer opens in a frame under a bar that says who it
   is for, with Cancel and Save quote. The frame is this site, so this page
   can read the designer when it is ready (window.shedUI): Save quote takes
   the design with today's price and sends it to the server, which prices
   it again from the price list and gives it the next quote number. The
   designer's own "send me a quote" form is hidden inside the frame, so
   nobody sends it as if they were the customer.

   A lot whose designer link is closed shows why instead of a blank frame. */

import { h, icon, button, linkButton, toast, loading } from "../dom.js";
import { get, post } from "../api.js";
import { money, todayKey } from "../words.js";
import { encodeSync } from "../../../model/design.js";
import { loadCustomer, missingCustomer } from "./crm-kit.js";

const WAIT_MS = 60000;

export async function render(ctx) {
  const { app } = ctx;
  const [id, quoteId] = ctx.params;
  const c = await loadCustomer(id);
  if (!c) return missingCustomer(ctx);
  const quote = quoteId ? c.quotes.find((q) => q.id === quoteId) : null;
  const lotName = app.lotName(c.lot);
  ctx.setTitle(`Design for ${c.name}`);
  const back = () => ctx.go(`/customers/${c.id}`);

  const title = h("div", { class: "crm-design-title" },
    h("span", { class: "crm-design-kicker" }, quote ? `Changing quote #${quote.number}` : "Designing for"),
    h("strong", {}, c.name, h("span", {}, ` · ${lotName}`)));
  const total = h("span", { class: "crm-design-total", "aria-live": "polite" });
  const saveBtn = button("Save quote", null, { kind: "accent", icon: "check" });
  saveBtn.disabled = true;
  const bar = h("div", { class: "crm-design-bar" },
    h("a", { class: "crm-design-back", href: `#/customers/${c.id}`, "aria-label": `Back to ${c.name}` }, icon("arrowLeft")),
    title, total,
    h("div", { class: "crm-design-actions" }, linkButton("Cancel", `#/customers/${c.id}`, { kind: "ghost" }), saveBtn));
  const stage = h("div", { class: "crm-design-stage" }, loading("Opening the 3D designer…"));
  const screen = h("div", { class: "crm-design" }, bar, stage);
  const closedNow = (note) => { saveBtn.hidden = true; total.hidden = true; stage.replaceChildren(note); };

  if (quoteId && !quote) {
    closedNow(closedNote("That quote isn't here", "It may belong to another customer. Go back and pick the quote again.", c));
    return screen;
  }

  /* Is the lot's designer open? (the same question a customer's browser asks) */
  let open = true;
  try {
    const r = await fetch(`/api/lots/${encodeURIComponent(c.lot)}`, { credentials: "same-origin", cache: "no-store" });
    open = r.ok;
    if (!r.ok && r.status !== 404) {
      closedNow(closedNote("The 3D designer didn't load", "Check your internet connection, then try again.", c, true));
      return screen;
    }
  } catch {
    closedNow(closedNote("The 3D designer didn't load", "Check your internet connection, then try again.", c, true));
    return screen;
  }
  if (!open) {
    /* the lot itself, or the whole business? (asked fresh: the lot may have closed since the page opened) */
    const fresh = (await get("lots").catch(() => null))?.lots || [];
    const lot = fresh.find((l) => l.slug === c.lot) || app.lot(c.lot);
    const lotClosed = !!lot && lot.active === false;
    closedNow(closedNote("The 3D designer is closed",
      lotClosed
        ? `${lotName} is closed, so its 3D designer can't open here either. The owner can open the lot again in Lots.`
        : "The 3D designer is closed to customers right now, so it can't open here either. The owner can open it in Settings.",
      c, false, app.isOwner ? (lotClosed ? ["Open Lots", "#/lots"] : ["Open Settings", "#/settings"]) : null));
    return screen;
  }

  const hash = quote ? `#d=${encodeSync(quote.design)}` : "";
  const frame = h("iframe", { class: "crm-design-frame", title: `3D designer for ${c.name}`, src: `/d/${encodeURIComponent(c.lot)}/?embed=1${hash}` });
  stage.replaceChildren(frame, h("div", { class: "crm-design-wait" }, loading("Opening the 3D designer…")));

  let shed = null;
  let dirty = false;
  app.leaveGuard = () => (dirty ? "Leave without saving this quote?" : null);

  const showTotal = () => {
    try {
      const p = shed.price();
      total.textContent = money(p.total);
    } catch { total.textContent = ""; }
  };

  function ready(api) {
    if (shed || !api) return;
    shed = api;
    const doc = frame.contentDocument;
    /* staff save quotes with the button above, not the customer's form */
    const card = doc?.getElementById("quotecard");
    if (card) { card.hidden = true; card.style.display = "none"; }
    doc?.getElementById("tapcover")?.remove();
    stage.querySelector(".crm-design-wait")?.remove();
    saveBtn.disabled = false;
    showTotal();
    shed.on("change", () => { dirty = true; showTotal(); });
    if (quote && shed.startWarnings?.length) {
      stage.prepend(h("div", { class: "banner warn crm-design-warn" }, icon("alert"),
        h("span", {}, `Some of quote #${quote.number} isn't sold any more: ${shed.startWarnings.join(" ")}`)));
    }
  }

  const started = Date.now();
  function watch() {
    let win;
    try { win = frame.contentWindow; } catch { win = null; }
    if (!win || shed) return;
    try {
      if (win.shedUI?.ready) return ready(win.shedUI);
      win.addEventListener("shedui:ready", (e) => ready(e.detail || win.shedUI), { once: true });
    } catch { /* not this site's page (a closed or error page) */ }
  }
  frame.addEventListener("load", () => {
    let closedPage = false;
    try { closedPage = !frame.contentWindow.document.getElementById("stage") && !frame.contentWindow.shedUI; } catch { closedPage = true; }
    if (closedPage) {
      closedNow(closedNote("The 3D designer is closed",
        "The 3D designer is closed to customers right now, so it can't open here either. The owner can open it in Settings.", c, false,
        app.isOwner ? ["Open Settings", "#/settings"] : null));
      return;
    }
    watch();
  });
  const poll = setInterval(() => {
    if (shed || !frame.isConnected) { clearInterval(poll); return; }
    watch();
    if (Date.now() - started > WAIT_MS) {
      clearInterval(poll);
      stage.querySelector(".crm-design-wait")?.replaceChildren(h("p", {}, "The 3D designer is taking a long time. ",
        button("Try again", () => ctx.refresh(), { kind: "link" })));
    }
  }, 400);

  saveBtn.addEventListener("click", async () => {
    if (!shed) return;
    saveBtn.disabled = true;
    try {
      const design = shed.getDesign({ priced: true, at: todayKey() });
      const out = await post(`customers/${c.id}/quotes`, { design });
      dirty = false;
      app.customersChanged();
      toast(`Saved quote #${out.quote.number} — ${money(out.quote.total)}`);
      back();
    } catch (e) {
      toast(e.message, { error: true, ms: 7000 });
      saveBtn.disabled = false;
    }
  });

  return screen;
}

function closedNote(title, words, c, retry = false, action = null) {
  return h("div", { class: "crm-design-closed" },
    h("div", { class: "card" },
      h("span", { class: "crm-design-closed-icon" }, icon("cube")),
      h("h2", {}, title), h("p", {}, words),
      h("div", { class: "actions center" },
        linkButton(`Back to ${c.name}`, `#/customers/${c.id}`, { kind: "ghost", icon: "arrowLeft" }),
        retry ? button("Try again", () => window.dispatchEvent(new Event("dealer:refresh")), { kind: "primary" }) : null,
        action ? linkButton(action[0], action[1], { kind: "primary" }) : null)));
}
