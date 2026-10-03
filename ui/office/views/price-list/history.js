/* PRICE LIST, HISTORY TAB (owner and manager): every save, newest first,
   with when, who and what changed in words. The owner can put an earlier
   price list back; that is a new save, so it can be undone the same way. */

import { h, clear, button, icon, loading, emptyState, confirmBox, toast } from "../../dom.js";
import { get, post } from "../../api.js";
import { when, dayWords, plural } from "../../words.js";
import { S } from "./state.js";

export function historyTab({ app, ctx }) {
  const wrap = h("div", { class: "pl-tab stack" }, loading("Loading the history…"));
  const load = () => {
    clear(wrap, loading("Loading the history…"));
    get("price-list/history")
      .then(({ entries }) => clear(wrap, list(entries || [], app, ctx)))
      .catch((e) => clear(wrap, emptyState("The history didn't load", e.message, button("Try again", load, { kind: "primary" }))));
  };
  load();
  return wrap;
}

function list(entries, app, ctx) {
  if (!entries.length) {
    return emptyState("No saves yet", "Each time the price list is saved, it shows up here with who saved it and what changed.");
  }
  const owner = app.can("changePrices");
  const current = S.latest?.version;
  return [
    h("p", { class: "pl-intro" }, owner
      ? "Every save is kept here. If a change went wrong, put an earlier price list back."
      : "Every save is kept here, with who made it and what changed."),
    h("ol", { class: "pl-history" }, entries.map((e) => {
      const now = e.version === current;
      const who = e.savedBy?.name || "Someone";
      const changes = e.changes || [];
      const ul = h("ul", { class: "pl-changes" }, changes.map((c, i) => h("li", { hidden: i >= 8 }, c)));
      const more = changes.length > 8 ? h("button", { type: "button", class: "btn btn-link pl-more" }, `and ${changes.length - 8} more`) : null;
      more?.addEventListener("click", () => { for (const li of ul.children) li.hidden = false; more.remove(); });
      return h("li", { class: ["card", "pl-history-entry", now && "now"] },
        h("div", { class: "pl-history-head" },
          h("div", { class: "pl-history-when" }, h("strong", {}, when(e.savedAt)), h("span", {}, `by ${who}`)),
          now ? h("span", { class: "pill stage-sold" }, "In use now")
            : owner ? button("Put this back", () => putBack(e, app, ctx), { icon: "history", small: true }) : null),
        changes.length ? ul : h("p", { class: "muted small" }, "Nothing a customer sees changed."),
        more);
    })),
  ];
}

async function putBack(entry, app, ctx) {
  const unsaved = S.changes.length;
  const lots = app.openLots().length;
  const ok = await confirmBox(`Put back the price list from ${dayWords(entry.savedAt)}?`,
    `${lots === 1 ? "Your lot goes" : `All ${lots} lots go`} back to the prices saved ${when(entry.savedAt)} by ${entry.savedBy?.name || "someone"}. ` +
    `The price list in use now stays in this history, so you can put it back too.` +
    (unsaved ? ` Your ${plural(unsaved, "change")} not saved yet will be dropped.` : ""),
    { yes: "Put this back" });
  if (!ok) return;
  try {
    await post("price-list/restore", { version: entry.version, current: S.latest.version });
  } catch (e) {
    toast(e.message, { error: true, ms: 7000 });
    if (e.status === 409) {
      S.hooks.reset?.(await app.loadPriceList(true));
      ctx.refresh();
    }
    return;
  }
  S.hooks.reset?.(await app.loadPriceList(true));
  S.justSaved = null;
  toast(lots === 1 ? `Put back. Your lot shows the price list from ${dayWords(entry.savedAt)} again.` : `Put back. All ${lots} lots show the price list from ${dayWords(entry.savedAt)} again.`, { ms: 6000 });
  ctx.refresh();
}
