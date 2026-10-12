/* GETTING STARTED: the owner's card at the top of Today (#/), from their
   first sign-in until every step is done or they tap Hide this list
   (server/office/first-start.js works out the ticks; GET me's
   gettingStarted is null for everybody else).

   There are no setup screens: the first sign-in already made the price
   list ("Every standard building" at example prices, closed to customers)
   and the first lot, named after the business. The card says what is left,
   each step a link to the screen that does it, ticked by itself once done:
   check your prices, your logo and colors, your lots, your team, look at
   the preview, open to customers.

   A Dealer Center with no business name to start from (not connected to
   Barnwright, or no details from the sign-up page) asks for it first:
   Business name, Start (POST start), and the rest follows. */

import { h, clear, icon, field, form, toast } from "../dom.js";
import { post } from "../api.js";

/* the words of each step (server/office/first-start.js gives the ids) */
const STEPS = {
  prices: { title: "Check your prices", href: "#/price-list" },
  look: { title: "Add your logo and colors", href: "#/settings", words: "Customers see them on your 3D designer." },
  lot: { title: "Add your first lot", href: "#/lots", words: "Each lot gets its own 3D designer link." },
  lots: { title: "Add your other lots", href: "#/lots" },
  team: { title: "Add your team", href: "#/team", words: "Managers and dealers sign in with the email you add." },
  preview: { title: "Look at the preview", words: "See your 3D designer the way your customers will." },
  open: { title: "Open to customers", href: "#/settings", words: "When your prices are right: in Settings, under 3D designer, pick Open to customers and tap Save settings." },
};
export const GETTING_STARTED_WORDS = Object.freeze({
  title: "Getting started",
  ready: "Your Dealer Center is ready. Your 3D designer stays closed to customers until you open it.",
  name: "Type your business name to start. Your price list and your first lot are made from it.",
  nameHint: "Customers see it at the top of your 3D designer and on their quotes.",
  prices: "Every price is an example. Turn off what you don't sell and type your own.",
  pricesBarnwright: "Barnwright set up your price list. Check it, and change anything.",
  hide: "Hide this list",
  hidden: "The Getting started list is hidden.",
  started: "Your price list and your first lot are ready.",
  startedNoLot: "Your price list is ready. Add your first lot on Lots.",
});

const lotsWords = (limit, open) => `Your plan includes ${limit} open lots. ${open} ${open === 1 ? "is" : "are"} open now.`;

/* -> the card, or null (not the owner, nothing left, or hidden) */
export function gettingStartedCard(ctx) {
  const { app } = ctx;
  const gs = app.me?.gettingStarted;
  if (!gs || !app.isOwner || app.barnwright || app.demo) return null;
  const box = h("section", { class: "card gs-card", "aria-labelledby": "gs-title" });
  draw(box, ctx, gs);
  return box;
}

function head(words, count = null) {
  return h("header", { class: "gs-top" },
    h("span", { class: "gs-mark", "aria-hidden": "true" }, icon("star")),
    h("div", { class: "gs-titles" }, h("h2", { id: "gs-title" }, GETTING_STARTED_WORDS.title), h("p", {}, words)),
    count);
}

function draw(box, ctx, gs) {
  const { app } = ctx;
  if (gs.name) {
    box.classList.add("gs-name");
    const name = field("Business name", { required: true, maxLength: 80, autocomplete: "organization", hint: GETTING_STARTED_WORDS.nameHint });
    clear(box, head(GETTING_STARTED_WORDS.name),
      form([
        h("div", { class: "gs-name-row" }, name.wrap,
          h("button", { type: "submit", class: "btn btn-accent gs-start" }, h("span", {}, "Start"), icon("arrowRight"))),
      ], async () => {
        const typed = name.input.value.trim();
        if (!typed) throw new Error("Type your business name.");
        const out = await post("start", { businessName: typed });
        await app.loadMe();
        window.dispatchEvent(new Event("dealer:brand"));
        window.dispatchEvent(new Event("dealer:lots"));
        toast(out.start?.lot ? GETTING_STARTED_WORDS.started : GETTING_STARTED_WORDS.startedNoLot, { ms: 6000 });
        ctx.refresh();
      }, { class: "gs-form" }));
    return;
  }
  box.classList.remove("gs-name");
  const done = gs.steps.filter((x) => x.done).length;
  const bar = h("span", { class: "gs-bar-fill" });
  bar.style.width = `${Math.round((done / gs.steps.length) * 100)}%`;
  const lot = app.openLots()[0] || app.lots[0] || null;
  const steps = h("ol", { class: "gs-steps" }, gs.steps.map((x) => {
    const words = STEPS[x.id];
    if (!words) return null;
    const sub = x.id === "prices" ? (gs.barnwright ? GETTING_STARTED_WORDS.pricesBarnwright : GETTING_STARTED_WORDS.prices)
      : x.id === "lots" ? lotsWords(gs.lotLimit, gs.openLots) : words.words;
    const inner = [
      h("span", { class: "gs-tick", "aria-hidden": "true" }, x.done ? icon("check") : null),
      h("span", { class: "gs-words" }, h("strong", {}, words.title), h("span", {}, sub)),
      h("span", { class: "gs-go", "aria-hidden": "true" }, x.done ? h("span", { class: "gs-done" }, "Done") : icon(x.id === "preview" ? "cube" : "arrowRight")),
    ];
    const label = `${words.title}${x.done ? " (done)" : ""}`;
    const link = x.id === "preview"
      ? h("a", { class: "gs-link", href: lot ? app.previewUrl(lot.slug) : "#/lots", target: lot ? "_blank" : null, rel: lot ? "noopener" : null, "aria-label": label,
        onclick: () => { if (lot) seen(box, ctx); } }, inner)
      : h("a", { class: "gs-link", href: words.href, "aria-label": label }, inner);
    return h("li", { class: ["gs-step", x.done && "done"], dataset: { step: x.id } }, link);
  }));
  const hide = h("button", { type: "button", class: "btn btn-quiet btn-small gs-hide", onclick: async () => {
    hide.disabled = true;
    try {
      await post("getting-started", { hide: true });
      if (app.me) app.me.gettingStarted = null;
      box.remove();
      toast(GETTING_STARTED_WORDS.hidden);
    } catch (e) {
      hide.disabled = false;
      toast(e.message, { error: true });
    }
  } }, GETTING_STARTED_WORDS.hide);
  clear(box,
    head(GETTING_STARTED_WORDS.ready, h("span", { class: "gs-count" }, `${done} of ${gs.steps.length} done`)),
    h("div", { class: "gs-bar", role: "presentation" }, bar),
    steps,
    h("footer", { class: "gs-foot" }, hide));
}

/* Look at the preview was tapped (it opens in a new tab): ticked here and on the server */
async function seen(box, ctx) {
  try {
    const out = await post("getting-started", { preview: true });
    if (ctx.app.me) ctx.app.me.gettingStarted = out.gettingStarted;
    if (out.gettingStarted) draw(box, ctx, out.gettingStarted);
    else box.remove();
  } catch { /* the tick waits for the next visit */ }
}
