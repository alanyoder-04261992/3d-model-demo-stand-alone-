/* THE PRICE LIST (#/price-list, #/price-list/<tab>): what every lot sells
   and what it costs. One price list for the whole business; when the owner
   saves, every lot's 3D designer shows it at once.

   Everyone can look (dealers use it to answer customers). Only the owner
   sees boxes to change things. The owner works on a DRAFT copy: nothing
   reaches a lot until "Save for all lots" in the bar at the bottom. The
   draft is checked as it is typed with the same rules the server uses
   (model/company.js), so a problem shows next to the right box before
   saving, in plain words.

   Tabs: Buildings, Doors & windows, Options, Colors, History (owner and
   manager). Each tab is a module in views/price-list/; they share state.js. */

import { h, clear, button, icon, pageHead, tabs, toast, confirmBox, dialog } from "../dom.js";
import { put } from "../api.js";
import { plural, dayWords } from "../words.js";
import { S, TABS, freshParked } from "./price-list/state.js";
import { prepare, describe, problemsOf, lockedItems, tidyCategories, tidyDefaults, groupsOf, keysOf } from "./price-list/model.js";
import { buildingsTab } from "./price-list/buildings.js";
import { doorsTab } from "./price-list/doors.js";
import { optionsTab } from "./price-list/options.js";
import { colorsTab } from "./price-list/colors.js";
import { historyTab } from "./price-list/history.js";

const TAB_VIEWS = { buildings: buildingsTab, doors: doorsTab, options: optionsTab, colors: colorsTab, history: historyTab };
const IS_PRICE_LIST = /^#\/price-list(?:[/?]|$)/;

let page = null;

/* ---- loading ------------------------------------------------------------- */

async function loadLibrary(settings) {
  const id = /^[a-z0-9-]{2,40}$/.test(settings?.manufacturer || "") ? settings.manufacturer : "standard";
  if (S.M && S.M.id === id) return;
  let r;
  try {
    r = await fetch(`/library/manufacturers/${id}.json`, { credentials: "same-origin" });
  } catch {
    throw new Error("The list of buildings didn't load. Check your internet connection, then reload the page.");
  }
  if (!r.ok) throw new Error("The list of buildings didn't load. Reload the page to try again.");
  S.M = await r.json();
}

/* Start (again) from a price list as the server has it. */
function startFrom(record) {
  S.saved = record;
  S.latest = record;
  S.draft = S.owner ? structuredClone(record.settings) : null;
  if (S.draft && !S.draft.items) S.draft.items = {};
  S.parked = freshParked();
  S.problems = [];
  S.changes = [];
  S.locks = {};
}
S.hooks.reset = startFrom;

const dirty = () => !!S.draft && S.changes.length > 0;

/* ---- checking the draft --------------------------------------------------- */

function recompute() {
  if (!S.draft) {
    S.problems = [];
    S.changes = [];
    S.locks = S.saved ? lockedItems(S.saved.settings, S.M) : {};
    return [];
  }
  tidyCategories(S.draft, S.saved.settings, S.M);
  const notes = tidyDefaults(S.draft, S.M, groupsOf(S.draft, S.M).flatMap((g) => g[1]));
  const ready = prepare(S.draft);
  S.problems = problemsOf(ready, S.M);
  S.locks = lockedItems(ready, S.M);
  S.changes = describe(S.saved.settings, ready, S.M);
  return notes;
}

S.hooks.edited = ({ tab = false } = {}) => {
  const notes = recompute();
  if (S.justSaved) { S.justSaved = null; page?.saved?.remove(); }
  if (tab) renderTab({ keepScroll: true });
  else paintProblems();
  updateBar();
  for (const n of notes) toast(n);
};
S.hooks.paint = () => paintProblems();
S.hooks.focus = () => setTimeout(focusPending, 30);

/* ---- the screen ------------------------------------------------------------- */

export async function render(ctx) {
  const { app } = ctx;
  ctx.setTitle("Price list");
  S.ctx = ctx;
  const owner = app.can("changePrices");
  const record = await app.loadPriceList();
  await loadLibrary(record.settings);
  if (owner !== S.owner || !S.saved || (owner && !S.draft) || (!dirty() && S.saved.version !== record.version)) {
    S.owner = owner;
    startFrom(record);
  } else if (record.version !== S.saved.version) {
    S.latest = record;
  }
  let tab = TABS.some(([k]) => k === ctx.params?.[0]) ? ctx.params[0] : "buildings";
  if (tab === "history" && !app.can("seeHistory")) tab = "buildings";
  S.tab = tab;
  S.renderedHash = location.hash || "#/price-list";

  const body = h("div", { class: "pl-body" });
  page = { root: null, body };
  page.root = h("div", { class: "pl" }, head(app), staleBanner(), savedBanner(), tabStrip(app), body, bar(app));
  const root = page.root;
  recompute();
  renderTab();
  updateBar();
  app.leaveGuard = leaveGuard;
  if (S.focus) S.hooks.focus();
  /* on a phone the tabs scroll sideways: bring the one showing into view */
  setTimeout(() => {
    const on = page?.tabs?.querySelector("[aria-selected=true]");
    if (on && page.tabs.scrollWidth > page.tabs.clientWidth) page.tabs.scrollLeft = Math.max(0, on.offsetLeft - page.tabs.offsetLeft - 24);
  }, 0);
  return root;
}

function head(app) {
  const r = S.latest;
  const by = r.savedBy || {};
  const who = by.id && by.id === app.person?.userId ? "you" : String(by.name || "").trim().split(/\s+/)[0] || "the owner";
  const lots = app.seesAllLots ? app.openLots().length : null;
  const sub = S.owner
    ? "Set what every lot sells and what it costs. When you save, every lot's 3D designer shows it right away."
    : "What every lot sells and what it costs. Only the owner can change it.";
  return h("div", { class: "pl-head" },
    pageHead("Price list", sub),
    h("p", { class: "pl-stamp" }, icon("clock"),
      h("span", {}, `Last changed ${dayWords(r.savedAt)} by ${who}`),
      lots != null ? h("span", { class: "pl-stamp-lots" }, icon("lots"), lots === 1 ? "Your lot uses it" : `All ${lots} lots use it`) : null));
}

function staleBanner() {
  if (!dirty() || !S.latest || S.latest.version === S.saved.version) return null;
  return h("div", { class: "banner warn" }, icon("alert"),
    h("span", {}, "Someone else saved the price list while you were working. Reload to see their prices. Your changes here will be dropped."),
    button("Reload", reloadFresh, { kind: "primary", small: true }));
}

function savedBanner() {
  if (!S.justSaved) return null;
  const { changes, lotCount } = S.justSaved;
  const close = h("button", { type: "button", class: "pl-banner-x", "aria-label": "Close" }, icon("x"));
  const el = h("section", { class: "pl-saved", role: "status" },
    h("div", { class: "pl-saved-head" }, h("span", { class: "pl-saved-mark" }, icon("check")),
      h("div", {}, h("h2", {}, savedWords(lotCount)), changes.length ? h("p", {}, `What changed (${changes.length}):`) : null), close),
    changes.length ? changeList(changes, 8) : null);
  close.addEventListener("click", () => { S.justSaved = null; el.remove(); });
  page.saved = el;
  return el;
}

function savedWords(lotCount) {
  if (lotCount === 1) return "Saved. Your lot shows the new prices now.";
  if (lotCount > 1) return `Saved. All ${lotCount} lots show the new prices now.`;
  return "Saved. Open a lot to show these prices to customers.";
}

function tabStrip(app) {
  const items = TABS.filter(([k]) => k !== "history" || app.can("seeHistory"))
    .map(([k, label]) => [k, label, k === "buildings" ? keysOf((S.draft || S.saved.settings).offer).length : null]);
  const t = tabs(items, S.tab, (key) => {
    if (key === S.tab) return;
    S.ctx.go(key === "buildings" ? "/price-list" : `/price-list/${key}`);
  });
  t.el.classList.add("pl-tabs");
  page.tabs = t.el;
  return t.el;
}

function renderTab({ keepScroll = false } = {}) {
  if (!page) return;
  const y = window.scrollY;
  clear(page.body, TAB_VIEWS[S.tab]({ app: S.ctx.app, ctx: S.ctx }));
  paintProblems();
  if (keepScroll) window.scrollTo(0, y);
}

/* ---- problems next to the right box ------------------------------------------ */

function paintProblems() {
  if (!page) return;
  const root = page.root;
  for (const el of root.querySelectorAll(".pl-bad")) el.classList.remove("pl-bad");
  for (const el of root.querySelectorAll("[aria-invalid]")) el.removeAttribute("aria-invalid");
  for (const el of root.querySelectorAll(".pl-flagged")) el.classList.remove("pl-flagged");
  for (const ul of root.querySelectorAll("[data-msgs]")) ul.replaceChildren();
  const byWhere = new Map();
  for (const p of S.problems) {
    if (p.field) {
      const f = root.querySelector(`[data-field="${CSS.escape(p.field)}"]`);
      if (f) {
        f.setAttribute("aria-invalid", "true");
        (f.closest(".pl-price") || f).classList.add("pl-bad");
      }
    }
    if (p.style) for (const el of root.querySelectorAll(`[data-flag="style:${CSS.escape(p.style)}"]`)) el.classList.add("pl-flagged");
    if (!byWhere.has(p.where)) byWhere.set(p.where, []);
    byWhere.get(p.where).push(p);
  }
  for (const [where, list] of byWhere) {
    const box = root.querySelector(`[data-msgs="${CSS.escape(where)}"]`);
    if (!box) continue;
    const missing = list.filter((p) => p.missing);
    const lines = list.filter((p) => !p.missing).map((p) => p.words);
    if (missing.length === 1) lines.unshift(missing[0].words);
    else if (missing.length > 1) {
      const sizes = missing.map((p) => p.words.split(" ")[0]);
      const shown = sizes.length > 6 ? `${sizes.slice(0, 5).join(", ")} and ${sizes.length - 5} more` : `${sizes.slice(0, -1).join(", ")} and ${sizes[sizes.length - 1]}`;
      lines.unshift(`Type a price for ${shown}. Saving waits until every size has a price.`);
    }
    for (const words of [...new Set(lines)]) box.append(h("li", {}, icon("alert"), h("span", {}, words)));
  }
  /* a red count on each tab with something to fix */
  if (page.tabs) {
    for (const b of page.tabs.querySelectorAll(".tab")) {
      b.querySelector(".pl-tab-flag")?.remove();
      const n = S.problems.filter((p) => p.tab === b.dataset.key).length;
      if (n) b.append(h("span", { class: "pl-tab-flag", title: `${plural(n, "thing")} to fix` }, String(n)));
    }
  }
}

function focusPending() {
  const spec = S.focus;
  if (!spec || !page?.root.isConnected) return;
  if (spec.tab && spec.tab !== S.tab) return;
  S.focus = null;
  if (spec.style && !S.openStyles.has(spec.style)) {
    S.openStyles.add(spec.style);
    renderTab({ keepScroll: true });
  }
  if (spec.group) S.closedGroups.delete(spec.group);
  const root = page.root;
  const el = (spec.field && root.querySelector(`[data-field="${CSS.escape(spec.field)}"]`))
    || (spec.where && root.querySelector(`[data-msgs="${CSS.escape(spec.where)}"]`));
  if (!el) return;
  const groupBody = el.closest(".pl-group-body");
  if (groupBody?.hidden) groupBody.previousElementSibling?.click();
  el.scrollIntoView({ block: "center", behavior: "smooth" });
  if (el.matches("input, select, textarea, button")) el.focus({ preventScroll: true });
}

function showFirstProblem() {
  const p = S.problems[0];
  if (!p) return;
  const spec = { tab: p.tab, field: p.field, where: p.where, style: p.style };
  if (p.tab !== S.tab) {
    S.focus = spec;
    S.ctx.go(p.tab === "buildings" ? "/price-list" : `/price-list/${p.tab}`);
    return;
  }
  S.focus = spec;
  focusPending();
}

/* ---- the bar at the bottom: count, undo, save ------------------------------------ */

function bar(app) {
  const count = h("button", { type: "button", class: "pl-bar-count", onclick: showChanges });
  const trouble = h("span", { class: "pl-bar-trouble-words" });
  const troubleBox = h("span", { class: "pl-bar-trouble" }, icon("alert"), trouble,
    h("button", { type: "button", class: "pl-bar-show", onclick: showFirstProblem }, "Show me"));
  const lots = app.openLots().length;
  const save = button(lots === 1 ? "Save for your lot" : lots ? "Save for all lots" : "Save", saveAll, { kind: "accent", icon: "check" });
  const undo = button("Undo changes", undoAll, { kind: "ghost" });
  const el = h("div", { class: "pl-bar", role: "region", "aria-label": "Changes not saved yet", hidden: true },
    h("div", { class: "pl-bar-inner" },
      h("div", { class: "pl-bar-status" }, count, troubleBox),
      h("div", { class: "pl-bar-actions" }, undo, save)));
  page.bar = { el, count, trouble, troubleBox, save, undo };
  return el;
}

function updateBar() {
  if (!page?.bar) return;
  const { el, count, trouble, troubleBox } = page.bar;
  const n = S.changes.length;
  const show = !!S.draft && (n > 0 || S.problems.length > 0);
  el.hidden = !show;
  page.root.classList.toggle("has-bar", show);
  document.body.classList.toggle("pl-bar-on", show);
  clear(count, h("strong", {}, plural(n, "change")), h("span", { class: "pl-bar-see" }, "See them"));
  count.disabled = !n;
  const p = S.problems;
  troubleBox.hidden = !p.length;
  if (p.length) {
    const missing = p.filter((x) => x.missing).length;
    trouble.textContent = missing === p.length ? `${plural(missing, "price")} missing` : `${plural(p.length, "thing")} to fix`;
  }
}

function changeList(lines, first = 8) {
  const ul = h("ul", { class: "pl-changes" });
  lines.forEach((line, i) => { const li = h("li", {}, line); if (i >= first) li.hidden = true; ul.append(li); });
  if (lines.length <= first) return ul;
  const more = h("button", { type: "button", class: "btn btn-link pl-more" }, `Show ${lines.length - first} more`);
  more.addEventListener("click", () => { for (const li of ul.children) li.hidden = false; more.remove(); });
  return h("div", {}, ul, more);
}

function showChanges() {
  if (!S.changes.length) return;
  const box = dialog("Changes not saved yet", [
    h("p", { class: "muted" }, "These reach every lot when you press Save."),
    changeList(S.changes, 40),
    h("div", { class: "actions end" }, button("Close", () => box.close(), { kind: "primary" })),
  ]);
}

async function undoAll() {
  const n = S.changes.length;
  const ok = await confirmBox(`Undo ${plural(n, "change")}?`,
    `The price list goes back to how it was saved ${dayWords(S.saved.savedAt)}. Your lots keep showing those prices.`,
    { yes: "Undo changes", danger: true });
  if (!ok) return;
  startFrom(S.latest);
  S.justSaved = null;
  toast("Changes undone. Nothing was saved.");
  S.ctx.refresh();
}

async function reloadFresh() {
  try {
    const record = await S.ctx.app.loadPriceList(true);
    startFrom(record);
    S.justSaved = null;
    toast("Reloaded. This is the newest price list.");
    S.ctx.refresh();
  } catch (e) {
    toast(e.message, { error: true });
  }
}

async function saveAll() {
  if (S.saving || !S.draft) return;
  recompute();
  paintProblems();
  updateBar();
  if (S.problems.length) {
    const p = S.problems;
    const missing = p.filter((x) => x.missing).length;
    toast(missing === p.length ? `Type the ${plural(missing, "missing price")} first, then save.` : `Fix ${plural(p.length, "thing")} first: ${p[0].words}`, { error: true, ms: 6000 });
    showFirstProblem();
    return;
  }
  if (!S.changes.length) return;
  const { save, undo } = page.bar;
  S.saving = true;
  save.disabled = undo.disabled = true;
  const label = save.querySelector("span");
  const was = label.textContent;
  label.textContent = "Saving…";
  try {
    const answer = await put("price-list", { settings: prepare(S.draft), version: S.saved.version });
    const lotCount = Number.isInteger(answer.lotCount) ? answer.lotCount : S.ctx.app.openLots().length;
    const record = await S.ctx.app.loadPriceList(true);
    startFrom(record);
    S.justSaved = { changes: answer.changes || [], lotCount };
    toast(savedWords(lotCount));
    S.ctx.refresh();
  } catch (e) {
    if (e.status === 409) savedFirst();
    else if (e.status === 422) notSaved(e.problems?.length ? e.problems : [e.message]);
    else toast(e.message, { error: true, ms: 6000 });
  } finally {
    S.saving = false;
    save.disabled = undo.disabled = false;
    label.textContent = was;
  }
}

function savedFirst() {
  const box = dialog("Someone else saved first", [
    h("p", {}, "Someone else saved the price list while you were working."),
    h("p", {}, "Reload to see the price list as it is now, then make your changes again. Reloading drops these changes of yours:"),
    changeList(S.changes, 8),
    h("div", { class: "actions end" },
      button("Not now", () => box.close()),
      button("Reload", () => { box.close(); reloadFresh(); }, { kind: "primary" })),
  ]);
}

function notSaved(problems) {
  const box = dialog("The price list wasn't saved", [
    h("p", {}, "Fix these, then press Save again. Nothing changed on your lots."),
    h("ul", { class: "pl-msgs pl-msgs-list" }, problems.map((words) => h("li", {}, icon("alert"), h("span", {}, words)))),
    h("div", { class: "actions end" }, button("Fix them", () => box.close(), { kind: "primary" })),
  ]);
}

/* ---- leaving with changes not saved ---------------------------------------- */

/* main.js asks this before the address changes (and before the page
   closes). Moving between the price list's own tabs keeps the draft, so
   only leaving the price list asks. */
function leaveGuard() {
  if (!dirty()) return null;
  const next = location.hash || "#/";
  if (next !== S.renderedHash && IS_PRICE_LIST.test(next)) return null;
  return `Leave the price list without saving? Your ${plural(S.changes.length, "change")} will be lost.`;
}

/* After the address has changed (and main.js has put it back if the owner
   chose to stay): left the price list, so let the draft go. */
window.addEventListener("hashchange", () => {
  if (IS_PRICE_LIST.test(location.hash)) return;
  document.body.classList.remove("pl-bar-on");
  if (S.saved) {
    S.draft = null;
    S.parked = freshParked();
    S.changes = [];
    S.problems = [];
    S.justSaved = null;
    S.focus = null;
  }
  page = null;
});
