/* FIRST SETUP (#/setup): shown once, to the first owner, before the
   business exists. Three short steps:

     1  Your business       your name, the business name, phone, email,
                            and (a business Barnwright sells to) "I agree to
                            the Barnwright terms" -- the business is not
                            made without it (server/office/terms.js)
     2  Your price list     every standard building at example prices, or
                            three buildings to start small
                            -> POST setup (the price list is made, closed
                               to customers)
     3  Your first lot      name, address, phone, email -> POST lots

   Then: "Your Dealer Center is ready", with the way to the price list and
   the team. The page reloads on the way out so the menu and the business
   name appear. While setting up, the menu is hidden: nothing else works
   before the business exists. */

import { h, clear, icon, button, field, form, linkButton, emptyState, pageHead } from "../dom.js";
import { post } from "../api.js";

const STEPS = ["Your business", "Your price list", "Your first lot"];

let wiz = null;

/* the menu comes back when leaving the setup screen */
window.addEventListener("hashchange", () => {
  if (!/^#\/setup(?:[/?]|$)/.test(location.hash)) document.body.classList.remove("setup-on");
});

export async function render(ctx) {
  const { app } = ctx;
  ctx.setTitle("Set up");
  if (!app.me?.setupNeeded) {
    /* the business exists but has no lot yet (the page was reloaded
       between steps 2 and 3): finish with the first lot */
    if (app.isOwner && app.business && !app.lots.length) {
      document.body.classList.add("setup-on");
      wiz = { ctx, step: 3, data: {}, start: "full", lot: null };
      return frame();
    }
    return h("div", { class: "setup-page" }, pageHead("Set up"),
      h("section", { class: "card" }, emptyState("Your business is set up",
        "Everything is ready. Today shows what to do first.", linkButton("Go to Today", "#/", { kind: "primary" }))));
  }
  document.body.classList.add("setup-on");
  wiz = {
    ctx, step: 1, start: "full", lot: null,
    data: { yourName: app.person?.name || app.me?.user?.name || "", businessName: "", phone: "", email: app.person?.email || "" },
  };
  return frame();
}

function frame() {
  const body = h("div", { class: "setup-body" });
  wiz.body = body;
  const el = h("div", { class: "setup-page" },
    h("header", { class: "setup-hello" },
      h("span", { class: "setup-mark", "aria-hidden": "true" }, icon("shed")),
      h("div", {}, h("h1", {}, "Set up your Dealer Center"),
        h("p", {}, "Three short steps. You can change all of it later."))),
    body);
  draw();
  return el;
}

function steps() {
  return h("ol", { class: "setup-steps" }, STEPS.map((words, i) => {
    const n = i + 1;
    const state = wiz.step > n ? "done" : wiz.step === n ? "now" : "later";
    return h("li", { class: ["setup-step", state], "aria-current": state === "now" ? "step" : null },
      h("span", { class: "setup-num" }, state === "done" ? icon("check") : String(n)), h("span", {}, words));
  }));
}

function draw() {
  const views = { 1: business, 2: priceList, 3: firstLot, 4: ready };
  clear(wiz.body, wiz.step < 4 ? steps() : null, views[wiz.step]());
  wiz.body.querySelector("input:not([type=radio])")?.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

function stepCard(n, title, intro, ...content) {
  return h("section", { class: "card setup-card" },
    h("h2", { class: "card-title" }, h("span", { class: "step" }, String(n)), title),
    intro ? h("p", { class: "setup-intro" }, intro) : null,
    content);
}

/* ---- 1. Your business ------------------------------------------------------------- */

function business() {
  const d = wiz.data;
  const yourName = field("Your name", { required: true, value: d.yourName, maxLength: 80, autocomplete: "name", placeholder: "Chris Walker" });
  const businessName = field("Business name", { required: true, value: d.businessName, maxLength: 80, autocomplete: "organization",
    placeholder: "Sample Storage Barns", hint: "Customers see it at the top of your 3D designer and on their quotes." });
  const phone = field("Business phone", { type: "tel", value: d.phone, maxLength: 40, autocomplete: "tel", placeholder: "(555) 010-0100" });
  const email = field("Business email", { type: "email", value: d.email, maxLength: 200, autocomplete: "email" });
  /* the Barnwright terms: only for a business connected to Barnwright */
  const terms = wiz.ctx.app.me?.terms || null;
  const agree = h("input", { type: "checkbox", checked: !!d.agreeTerms, "aria-describedby": "setup-terms-words" });
  const termsBox = terms ? h("label", { class: "check setup-terms" }, agree,
    h("span", { id: "setup-terms-words" }, "I have read and agree to the ",
      h("a", { href: terms.url, target: "_blank", rel: "noopener" }, terms.title),
      ` (version ${terms.version}) for my business.`)) : null;
  return stepCard(1, "Your business", "Who you are and how customers reach the business.",
    form([
      h("div", { class: "form-grid" }, yourName.wrap, businessName.wrap, phone.wrap, email.wrap),
      termsBox,
      h("div", { class: "actions end" },
        h("button", { type: "submit", class: "btn btn-primary" }, h("span", {}, "Next: your price list"), icon("arrowRight"))),
    ], async () => {
      Object.assign(d, {
        yourName: yourName.input.value.trim(), businessName: businessName.input.value.trim(),
        phone: phone.input.value.trim(), email: email.input.value.trim(),
      });
      if (!d.yourName) throw new Error("Type your name.");
      if (!d.businessName) throw new Error("Type the business name.");
      if (terms) {
        d.agreeTerms = agree.checked;
        if (!d.agreeTerms) throw new Error("Tick the box to agree to the Barnwright terms.");
      }
      wiz.step = 2;
      draw();
    }));
}

/* ---- 2. Your price list ------------------------------------------------------------------ */

function priceList() {
  const choice = (value, title, words, list) => {
    const input = h("input", { type: "radio", name: "setup-start", value, checked: wiz.start === value, onchange: () => { wiz.start = value; } });
    return h("label", { class: "setup-choice" }, input,
      h("span", { class: "setup-choice-words" }, h("strong", {}, title), h("span", {}, words), h("small", {}, list)));
  };
  return stepCard(2, "Your starting price list",
    "Pick where to start. Every price is an example: change them to yours before customers see them.",
    form([
      h("div", { class: "setup-choices", role: "radiogroup", "aria-label": "Starting price list" },
        choice("full", "Every standard building", "All 23 building styles at example prices. Turn off the ones you don't sell.",
          "Sheds, barns, cabins, garages, metal buildings and more"),
        choice("small", "Start small", "Three buildings at example prices. Add more styles any time.",
          "Utility Shed, Lofted Barn and Garage")),
      h("p", { class: "setup-note" }, icon("alert"), h("span", {}, "Your 3D designer stays closed to customers until you open it, so nobody sees example prices.")),
      h("div", { class: "actions setup-nav" },
        button("Back", () => { wiz.step = 1; draw(); }, { icon: "arrowLeft" }),
        h("button", { type: "submit", class: "btn btn-primary" }, h("span", {}, "Next: your first lot"), icon("arrowRight"))),
    ], async () => {
      const { app } = wiz.ctx;
      await post("setup", { ...wiz.data, start: wiz.start });
      await app.loadMe();
      wiz.step = 3;
      draw();
    }));
}

/* ---- 3. Your first lot ---------------------------------------------------------------------- */

function linkNameFrom(name) {
  return String(name).toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40).replace(/-+$/, "");
}

function firstLot() {
  const { app } = wiz.ctx;
  const d = wiz.data;
  const name = field("Lot name", { required: true, maxLength: 80, autocomplete: "off", placeholder: "Riverside",
    hint: "Most businesses name a lot after its town." });
  const street = field("Street address", { maxLength: 200, autocomplete: "street-address", wide: true });
  const city = field("City", { maxLength: 80, autocomplete: "address-level2" });
  const state = field("State", { maxLength: 40, autocomplete: "address-level1", placeholder: "FL" });
  const zip = field("ZIP", { maxLength: 12, inputmode: "numeric", autocomplete: "postal-code" });
  const phone = field("Lot phone", { type: "tel", value: d.phone || app.business?.phone || "", maxLength: 40, autocomplete: "tel" });
  const email = field("Lot email", { type: "email", value: d.email || app.business?.email || "", maxLength: 200, autocomplete: "email" });
  const link = h("span", {});
  const showLink = () => {
    const slug = linkNameFrom(name.input.value || "");
    if (!/^[a-z0-9-]{2,40}$/.test(slug)) { clear(link, "Its 3D designer link is made from the lot's name."); return; }
    clear(link, "Its 3D designer link will be ", h("strong", {}, new URL(app.designerUrl(slug), location.origin).href));
  };
  name.input.addEventListener("input", showLink);
  showLink();
  return stepCard(3, "Your first lot", "The place you sell from. It gets its own 3D designer link for your website. Add more lots later.",
    form([
      h("div", { class: "form-grid" }, name.wrap),
      h("p", { class: "setup-link" }, icon("link"), link),
      h("div", { class: "form-grid" }, street.wrap),
      h("div", { class: "setup-addr" }, city.wrap, state.wrap, zip.wrap),
      h("div", { class: "form-grid" }, phone.wrap, email.wrap),
      h("div", { class: "actions end" },
        h("button", { type: "submit", class: "btn btn-primary" }, icon("check"), h("span", {}, "Finish setup"))),
    ], async () => {
      const out = await post("lots", {
        name: name.input.value.trim(), address: street.input.value.trim(), city: city.input.value.trim(),
        state: state.input.value.trim(), zip: zip.input.value.trim(), phone: phone.input.value.trim(), email: email.input.value.trim(),
      });
      wiz.lot = out.lot;
      await app.loadMe();
      wiz.step = 4;
      draw();
    }));
}

/* ---- ready ------------------------------------------------------------------------------------ */

function ready() {
  const { app } = wiz.ctx;
  const goTo = (path) => () => {
    history.replaceState(null, "", `#${path}`);
    location.reload();
  };
  const lot = wiz.lot;
  return h("section", { class: "card setup-card setup-ready" },
    h("span", { class: "setup-done-mark" }, icon("check")),
    h("h2", {}, "Your Dealer Center is ready."),
    h("p", { class: "setup-ready-words" }, "Your 3D designer stays closed to customers until you check your prices and open it."),
    lot ? h("p", { class: "setup-link" }, icon("link"),
      h("span", {}, `${lot.name}'s 3D designer link: `, h("strong", {}, new URL(app.designerUrl(lot.slug), location.origin).href))) : null,
    h("ol", { class: "setup-next" },
      h("li", {}, h("strong", {}, "Check your prices."), " Turn off what you don't sell and type your own prices."),
      h("li", {}, h("strong", {}, "Add your team."), " Managers and dealers get a message telling them how to sign in."),
      h("li", {}, h("strong", {}, "Open for customers"), " in Settings, then put the designer on your website from the Lots page.")),
    h("div", { class: "actions center" },
      button("Check your prices", goTo("/price-list"), { kind: "primary", icon: "prices" }),
      button("Add your team", goTo("/team"), { icon: "team" })));
}
