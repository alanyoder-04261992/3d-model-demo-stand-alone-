/* CUSTOMERS (#/customers): everybody the lots are working, as a list or a
   board (one column per stage).

   Search (name, phone digits, email, building), stage chips with counts,
   "Only mine", sort, list or board, "Download spreadsheet" (owner and
   manager) and "Add customer" (#/customers?new=1 opens it straight away).
   The choices are remembered on this device.

   It reads the list rows once (app.loadCustomers) and filters them in the
   browser; nothing here calls the server per customer, and only the first
   rows are drawn until someone asks for more, so 2,000 customers stay fast. */

import { h, clear, icon, button, field, form, dialog, chips, toast, emptyState, pageHead, linkButton } from "../dom.js";
import { post } from "../api.js";
import { STAGES, STAGE_WORDS, SOURCES, money, ago, when, plural, todayKey, addDays, phone as phoneWords } from "../words.js";
import {
  stagePill, followUpBadge, changeStage, buildingWords, remember, recall, digitsOf, confirmChoice,
} from "./crm-kit.js";

const PAGE = 60;            /* list rows drawn at a time */
const COLUMN = 40;          /* board cards per column at a time */
const SORTS = [["activity", "Last activity"], ["follow", "Follow-up date"], ["newest", "Newest"], ["name", "Name"]];

export async function render(ctx) {
  const { app } = ctx;
  ctx.setTitle("Customers");
  await app.loadCustomers();
  const me = app.person?.userId;
  const memoryKey = `customers:${me}`;
  const saved = recall(memoryKey, { view: "list", sort: "activity", stage: "all", mine: false, lost: false });
  const state = { ...saved, search: "", shown: PAGE };
  const save = () => remember(memoryKey, { view: state.view, sort: state.sort, stage: state.stage, mine: state.mine, lost: state.lost });
  const manyLots = app.lotFilter === "all" && app.lots.length > 1;

  /* ---- the toolbar ---- */
  const search = h("input", { type: "search", placeholder: "Search name, phone, email, building", "aria-label": "Search customers", autocomplete: "off", enterKeyHint: "search" });
  let timer = 0;
  search.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(() => { state.shown = PAGE; draw(); }, 120); });

  const sortSel = h("select", { "aria-label": "Sort", onchange: () => { state.sort = sortSel.value; save(); draw(); } },
    SORTS.map(([k, label]) => h("option", { value: k }, label)));
  sortSel.value = state.sort;

  const mineBtn = h("button", { type: "button", class: "chip crm-mine", "aria-pressed": String(state.mine),
    onclick: () => { state.mine = !state.mine; mineBtn.setAttribute("aria-pressed", String(state.mine)); save(); state.shown = PAGE; draw(); } },
  icon("user"), "Only mine");

  const viewBtns = h("div", { class: "crm-switch", role: "group", "aria-label": "Show as" },
    [["list", "List", "list"], ["board", "Board", "board"]].map(([k, label, ic]) => h("button", {
      type: "button", "aria-pressed": String(state.view === k), dataset: { key: k },
      onclick: (e) => {
        state.view = k; save();
        for (const b of viewBtns.children) b.setAttribute("aria-pressed", String(b === e.currentTarget));
        draw();
      },
    }, icon(ic), h("span", {}, label))));

  const lostBtn = h("button", { type: "button", class: "btn btn-quiet btn-small crm-lost-toggle", onclick: () => { state.lost = !state.lost; save(); draw(); } });

  const chipsWrap = h("div", { class: "crm-chipbar" });
  const results = h("div", { class: "crm-results" });
  const countWords = h("p", { role: "status", "aria-live": "polite" });

  const head = pageHead("Customers",
    app.lotFilter === "all" ? (app.lots.length > 1 ? (app.seesAllLots ? "Every lot" : "Your lots") : app.lots[0]?.name) : app.lotName(app.lotFilter),
    app.can("exportCustomers") ? h("a", { class: "btn btn-ghost crm-download", href: "/api/office/customers.csv", download: "", title: "Download spreadsheet" }, icon("download"), h("span", {}, "Download spreadsheet")) : null,
    button("Add customer", () => addCustomer(ctx), { kind: "accent", icon: "plus" }));

  const page = h("div", { class: "crm-customers" }, head,
    h("div", { class: "card crm-toolbar" },
      h("div", { class: "crm-toolbar-row" },
        h("div", { class: "search crm-search" }, icon("search"), search),
        h("div", { class: "crm-toolbar-tools" }, mineBtn, h("label", { class: "crm-sort" }, h("span", { class: "sr-only" }, "Sort by"), sortSel))),
      chipsWrap),
    h("div", { class: "crm-countline" }, countWords, h("div", { class: "crm-countline-tools" }, lostBtn, viewBtns)), results);

  /* ---- filtering ---- */
  function matches(r, words, digits) {
    if (!words) return true;
    if (digits.length >= 3 && digitsOf(r.phone).includes(digits)) return true;
    const hay = `${r.name} ${r.email} ${r.building} ${r.city}`.toLowerCase();
    return words.split(/\s+/).every((w) => hay.includes(w));
  }

  function filtered() {
    const words = search.value.trim().toLowerCase();
    const digits = digitsOf(words);
    const base = app.rowsInView().filter((r) => (!state.mine || r.assignedTo === me) && matches(r, words, digits));
    const counts = Object.fromEntries(STAGES.map(([k]) => [k, 0]));
    for (const r of base) counts[r.stage] = (counts[r.stage] || 0) + 1;
    return { base, counts };
  }

  function sorted(list) {
    const by = {
      activity: (a, b) => String(b.lastActivityAt).localeCompare(String(a.lastActivityAt)),
      newest: (a, b) => String(b.createdAt).localeCompare(String(a.createdAt)),
      name: (a, b) => a.name.localeCompare(b.name),
      follow: (a, b) => (a.followUp?.date || "9999").localeCompare(b.followUp?.date || "9999") || a.name.localeCompare(b.name),
    }[state.sort] || (() => 0);
    return list.slice().sort(by);
  }

  function draw() {
    const { base, counts } = filtered();
    clear(chipsWrap, state.view === "board" ? null : chips(
      [["all", "All", base.length], ...STAGES.map(([k, label]) => [k, label, counts[k] || 0])],
      state.stage, (k) => { state.stage = k; save(); state.shown = PAGE; draw(); }, { label: "Stage" }));
    chipsWrap.hidden = state.view === "board";
    lostBtn.hidden = state.view !== "board";
    if (state.view === "board") {
      countWords.textContent = plural(base.length, "customer");
      lostBtn.textContent = state.lost ? "Hide Lost" : `Show Lost (${counts.lost || 0})`;
      lostBtn.setAttribute("aria-pressed", String(!!state.lost));
      clear(results, board(ctx, sorted(base), { manyLots, redraw: draw, lost: state.lost }));
      return;
    }
    const list = sorted(state.stage === "all" ? base : base.filter((r) => r.stage === state.stage));
    countWords.textContent = plural(list.length, "customer") + (search.value.trim() ? ` match “${search.value.trim()}”` : "");
    if (!list.length) {
      const nobody = app.rowsInView().length === 0;
      clear(results, h("div", { class: "card" }, nobody
        ? emptyState("No customers yet", "Customers who send a quote from your 3D designer show up here, and so do the walk-ins and phone calls you add.",
          button("Add customer", () => addCustomer(ctx), { kind: "primary", icon: "plus" }))
        : emptyState("Nobody matches", "Try fewer words, another stage, or turn off “Only mine”.",
          button("Show everyone", () => { search.value = ""; state.stage = "all"; state.mine = false; mineBtn.setAttribute("aria-pressed", "false"); save(); draw(); }))));
      return;
    }
    clear(results, listView(app, list.slice(0, state.shown), manyLots),
      list.length > state.shown ? h("button", { type: "button", class: "btn btn-ghost btn-block crm-more", onclick: () => { state.shown += PAGE * 3; draw(); } },
        `Show more (${(list.length - state.shown).toLocaleString("en-US")} left)`) : null);
  }

  draw();
  if (ctx.query.get("new") === "1") {
    history.replaceState(null, "", "#/customers");
    queueMicrotask(() => addCustomer(ctx));
  }
  return page;
}

/* ---- the list: a table on wide screens, cards on phones (one set of rows) ---- */

function listView(app, rows, manyLots) {
  return h("div", { class: ["card", "flush", "crm-list", manyLots && "with-lot"], role: "table", "aria-label": "Customers" },
    h("div", { class: "crm-list-head", role: "row" },
      ["Customer", "Building", "Total", "Stage", "Follow-up", manyLots ? "Lot" : null, "Last activity"].filter(Boolean)
        .map((t) => h("span", { role: "columnheader", class: t === "Total" ? "right" : "" }, t))),
    rows.map((r) => h("a", { class: "crm-list-row", href: `#/customers/${r.id}`, role: "row" },
      h("span", { class: "c-name", role: "cell" }, h("strong", {}, r.name),
        h("small", {}, r.city || phoneWords(r.phone) || r.email || "")),
      h("span", { class: "c-building", role: "cell" }, buildingWords(r)),
      h("span", { class: "c-total num", role: "cell" }, r.total != null ? money(r.total) : ""),
      h("span", { class: "c-stage", role: "cell" }, stagePill(r.stage)),
      h("span", { class: ["c-follow", !r.followUp && "none"], role: "cell" }, followUpBadge(r.followUp) || h("span", { class: "muted", "aria-label": "No follow-up" }, "—")),
      manyLots ? h("span", { class: "c-lot", role: "cell" }, app.lotName(r.lot)) : null,
      h("span", { class: "c-when", role: "cell", title: when(r.lastActivityAt) }, ago(r.lastActivityAt)))));
}

/* ---- the board: one column per stage (Lost only when asked for) ---- */

function board(ctx, rows, { manyLots, redraw, lost }) {
  const { app } = ctx;
  const byStage = Object.fromEntries(STAGES.map(([k]) => [k, []]));
  for (const r of rows) (byStage[r.stage] || byStage.new).push(r);
  const wrap = h("div", { class: "crm-board" });
  for (const [stage, label] of STAGES) {
    if (stage === "lost" && !lost) continue;
    const list = byStage[stage];
    const cards = h("div", { class: "crm-col-cards" });
    let shown = 0;
    const more = h("button", { type: "button", class: "btn btn-quiet btn-block btn-small", onclick: () => fill() });
    const fill = () => {
      cards.append(...list.slice(shown, shown + COLUMN).map((r) => boardCard(ctx, r, manyLots, redraw)));
      shown = Math.min(list.length, shown + COLUMN);
      more.hidden = shown >= list.length;
      more.textContent = `Show ${Math.min(COLUMN, list.length - shown)} more`;
    };
    const sales = stage === "sold" || stage === "delivered";
    const total = list.reduce((s, r) => s + (sales
      ? (r.orders || []).filter((o) => o.status !== "cancelled").reduce((t, o) => t + (Number(o.total) || 0), 0)
      : Number(r.total) || 0), 0);
    const col = h("section", { class: ["crm-col", `col-${stage}`], "aria-label": label },
      h("header", { class: "crm-col-head" },
        h("span", { class: ["crm-col-dot", `stage-${stage}`] }),
        h("h2", {}, label), h("span", { class: "crm-count" }, String(list.length)),
        stage !== "lost" && total ? h("span", { class: "crm-col-sum" }, `${money(total)} in ${sales ? "sales" : "quotes"}`) : null),
      cards, more);
    fill();
    if (!list.length) cards.append(h("p", { class: "crm-col-empty" }, "Nobody here right now."));
    wrap.append(col);
  }
  return wrap;
}

function boardCard(ctx, r, manyLots, redraw) {
  const { app } = ctx;
  const move = h("select", { class: "crm-move", "aria-label": `Move ${r.name} to another stage` },
    h("option", { value: "" }, "Move to…"),
    STAGES.filter(([k]) => k !== r.stage).map(([k, label]) => h("option", { value: k }, label)));
  move.value = "";
  move.addEventListener("change", async () => {
    const stage = move.value;
    move.value = "";
    if (!stage) return;
    if ((stage === "sold" || stage === "delivered") && !(r.orders || []).some((o) => o.status !== "cancelled")) {
      const pick = await confirmChoice(`Mark ${r.name} ${STAGE_WORDS[stage]}?`,
        r.quotes?.length
          ? `An order keeps the price, payment and delivery date. Open ${r.name} and tap Mark sold on the quote they're buying, or just move the card.`
          : `${r.name} has no quote yet. Open them to design a building and make an order, or just move the card.`,
        [["open", `Open ${r.name.split(" ")[0]}`, "primary"], ["move", "Just move the card", "ghost"]]);
      if (pick === "open") { ctx.go(`/customers/${r.id}`); return; }
      if (pick !== "move") return;
    }
    move.disabled = true;
    try {
      const c = await changeStage(r, stage);
      if (c) {
        Object.assign(r, { stage: c.stage, lastActivityAt: c.updatedAt, updatedAt: c.updatedAt });
        app.customersChanged();
        redraw();
      }
    } catch (e) {
      toast(e.message, { error: true });
    } finally {
      move.disabled = false;
    }
  });
  return h("article", { class: "crm-card" },
    h("a", { class: "crm-card-link", href: `#/customers/${r.id}` }, r.name),
    h("p", { class: "crm-card-building" }, buildingWords(r)),
    h("div", { class: "crm-card-meta" },
      r.total != null ? h("strong", { class: "num" }, money(r.total)) : null,
      followUpBadge(r.followUp),
      manyLots ? h("span", { class: "crm-card-lot" }, app.lotName(r.lot)) : null),
    move);
}

/* ---- adding a customer ---- */

export function addCustomer(ctx) {
  const { app } = ctx;
  const lots = app.openLots();
  if (!lots.length) {
    toast("Every lot is closed. Open a lot first, then add customers to it.", { error: true });
    return;
  }
  const picked = app.lotFilter !== "all" && lots.some((l) => l.slug === app.lotFilter) ? app.lotFilter : lots[0].slug;
  const lot = field("Lot", { type: "select", options: lots.map((l) => [l.slug, l.name]), required: true });
  lot.input.value = picked;
  const name = field("Name", { required: true, autocomplete: "off", placeholder: "First and last name", maxLength: 100 });
  const tel = field("Phone", { type: "tel", autocomplete: "off", inputmode: "tel", placeholder: "(941) 555-0123" });
  const mail = field("Email", { type: "email", autocomplete: "off", placeholder: "name@example.com" });
  const street = field("Street address", { autocomplete: "off", wide: true });
  const city = field("City", { autocomplete: "off" });
  const st = field("State", { autocomplete: "off", value: lots.find((l) => l.slug === picked)?.state || "", maxLength: 40 });
  const zip = field("ZIP", { autocomplete: "off", inputmode: "numeric", maxLength: 12 });
  const source = field("How they found us", { type: "select", options: SOURCES.filter(([k]) => k !== "website") });
  source.input.value = "walk-in";
  const note = field("First note", { type: "textarea", wide: true, rows: 3, placeholder: "What they're looking for, when they need it, how to reach them…" });
  const follow = field("Follow up on", { type: "date", min: todayKey(), hint: "Leave empty if you don't need a reminder." });
  const quick = h("div", { class: "crm-quick" }, [["Tomorrow", 1], ["In 3 days", 3], ["Next week", 7]].map(([label, n]) =>
    h("button", { type: "button", class: "chip", onclick: () => { follow.input.value = addDays(todayKey(), n); } }, label)));

  const box = dialog("Add a customer", form([
    lots.length > 1 ? lot.wrap : h("p", { class: "muted small" }, `For ${lots[0].name}`),
    h("div", { class: "form-grid" }, name.wrap, source.wrap, tel.wrap, mail.wrap, street.wrap, city.wrap, st.wrap, zip.wrap, note.wrap),
    h("div", { class: "crm-follow-pick" }, follow.wrap, quick),
    h("div", { class: "actions end" }, button("Cancel", () => box.close()),
      h("button", { type: "submit", class: "btn btn-primary" }, icon("check"), h("span", {}, "Save customer"))),
  ], async () => {
    if (!tel.input.value.trim() && !mail.input.value.trim()) {
      tel.input.focus();
      throw new Error("Add a phone number or an email address so the lot can reach them.");
    }
    const body = {
      lot: lot.input.value, name: name.input.value.trim(), phone: tel.input.value.trim(), email: mail.input.value.trim(),
      address: street.input.value.trim(), city: city.input.value.trim(), state: st.input.value.trim(), zip: zip.input.value.trim(),
      source: source.input.value,
    };
    if (note.input.value.trim()) body.note = note.input.value.trim();
    if (follow.input.value) body.followUp = { date: follow.input.value, note: "" };
    const out = await post("customers", body);
    app.customersChanged();
    box.close();
    toast(`${out.customer.name} is added to ${app.lotName(out.customer.lot)}.`);
    ctx.go(`/customers/${out.customer.id}`);
  }), { wide: true });
  return box;
}
