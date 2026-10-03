/* LOTS (#/lots) and ONE LOT (#/lots/<link name>): the places that sell the
   buildings.

   A card per lot: where it is and how to reach it, how many customers it
   is working and what it sold this month, who works there, its own 3D
   designer link, and the code that puts that designer on a website (with
   the websites allowed to show it).

   Owners add and edit lots, close and open them, and choose the websites.
   Managers see every lot; dealers see their own. Both can still copy the
   link and the website code (handy for a dealer's own website).

   Prices are never on a lot: every lot sells from the one price list. */

import { h, clear, icon, button, linkButton, field, form, dialog, confirmBox, toast, pageHead, emptyState, copyText } from "../dom.js";
import { post, patch } from "../api.js";
import { money, plural, phone as phoneWords, telHref, todayKey, initials, ROLE_WORDS } from "../words.js";

/* the file a website loads to show the designer (kept apart from the words
   on screen) */
const SCRIPT_FILE = "embed.js";
const MAX_SITES = 10;

export async function render(ctx) {
  const { app } = ctx;
  const single = ctx.view === "lot";
  await app.loadMe();
  let rows = [];
  try { rows = await app.loadCustomers(); } catch { rows = null; }
  const owner = app.can("changeLots");

  if (single) {
    const lot = app.lot(ctx.params[0]);
    if (!lot) {
      ctx.setTitle("Lot not found");
      return h("div", { class: "lots" }, backLink(),
        h("section", { class: "card" }, emptyState("We couldn't find that lot",
          "It may be a lot you don't work, or the link was cut short.",
          linkButton("See your lots", "#/lots", { kind: "primary" }))));
    }
    ctx.setTitle(lot.name);
    return h("div", { class: "lots lots-one" }, backLink(), lotCard(ctx, lot, rows, { big: true }));
  }

  ctx.setTitle("Lots");
  const lots = app.lots;
  const open = lots.filter((l) => l.active !== false).length;
  const closed = lots.length - open;
  const sub = app.seesAllLots
    ? lots.length
      ? `${plural(open, "lot")} open${closed ? `, ${closed} closed` : ""}. Every lot sells from the same price list, and each one has its own 3D designer link.`
      : "Every lot sells from the same price list, and each one has its own 3D designer link."
    : lots.length > 1 ? "The lots you work." : "The lot you work.";
  const head = pageHead("Lots", sub, owner ? button("Add a lot", () => lotDialog(ctx, null), { kind: "primary", icon: "plus" }) : null);

  if (!lots.length) {
    return h("div", { class: "lots" }, head, h("section", { class: "card" }, owner
      ? emptyState("No lots yet", "Add your first lot to get its 3D designer link and the code for your website.",
        button("Add a lot", () => lotDialog(ctx, null), { kind: "primary", icon: "plus" }))
      : emptyState("You're not on a lot yet", "Ask the owner to add you to a lot. Its customers and orders show up here once they do.")));
  }
  return h("div", { class: "lots" }, head,
    h("div", { class: "lots-list" }, lots.map((lot) => lotCard(ctx, lot, rows, { big: false }))));
}

function backLink() {
  return h("a", { class: "back", href: "#/lots" }, icon("arrowLeft"), "All lots");
}

/* ---- one lot's card ------------------------------------------------------------ */

function lotCard(ctx, lot, rows, { big }) {
  const { app } = ctx;
  const owner = app.can("changeLots");
  const isOpen = lot.active !== false;
  const title = big ? h("h1", { class: "lots-name" }, lot.name) : h("h2", { class: "lots-name" }, h("a", { href: `#/lots/${lot.slug}` }, lot.name));
  const tools = owner ? h("div", { class: "actions lots-tools" },
    button("Edit lot", () => lotDialog(ctx, lot), { icon: "edit", small: true }),
    isOpen ? button("Close lot", () => setOpen(ctx, lot, false), { kind: "quiet", small: true })
      : button("Open lot", () => setOpen(ctx, lot, true), { kind: "primary", small: true })) : null;

  return h("section", { class: ["card", "lots-card", big && "big", !isOpen && "closed"] },
    h("header", { class: "lots-head" },
      h("div", { class: "lots-title" }, title,
        h("span", { class: ["pill", "lots-state", isOpen ? "open" : "shut"] }, isOpen ? "Open" : "Closed")),
      tools),
    !isOpen ? h("p", { class: "lots-closed-note" }, icon("alert"),
      h("span", {}, "This lot is closed. Its 3D designer link shows a short “not open” message. Its customers and orders stay here.")) : null,
    h("div", { class: "lots-body" },
      h("div", { class: "lots-col" },
        facts(lot),
        numbers(ctx, lot, rows),
        big ? people(app, lot) : null),
      h("div", { class: "lots-col" },
        designerLink(ctx, lot),
        websitePart(ctx, lot, big),
        big ? null : people(app, lot))));
}

/* where it is and how to reach it */
function facts(lot) {
  const place = [lot.address, [lot.city, [lot.state, lot.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ")].filter(Boolean);
  const items = [];
  if (place.length) items.push(fact("visit", h("span", {}, place.map((line, i) => [i ? h("br") : null, line]))));
  if (lot.phone) items.push(fact("phone", h("a", { href: telHref(lot.phone) }, phoneWords(lot.phone))));
  if (lot.email) items.push(fact("mail", h("a", { href: `mailto:${lot.email}` }, lot.email)));
  if (lot.hours) items.push(fact("clock", h("span", { class: "lots-hours" }, lot.hours)));
  if (lot.website) items.push(fact("globe", h("a", { href: lot.website, target: "_blank", rel: "noopener" }, plainAddress(lot.website))));
  if (!items.length) return h("p", { class: "lots-nofacts muted small" }, "No address or phone number yet.");
  return h("ul", { class: "lots-facts" }, items);
}
function fact(iconName, content) {
  return h("li", {}, icon(iconName), content);
}

/* "working now" and this month's sales, from the customer list */
function numbers(ctx, lot, rows) {
  const { app } = ctx;
  const n = rows ? countsFor(rows, lot.slug) : null;
  const month = new Date().toLocaleDateString("en-US", { month: "long" });
  const show = (v) => (n ? v : "—");
  const tile = (value, label, wide, zero) => h("div", { class: ["lots-tile", wide && "money", zero && "zero"] }, h("strong", {}, value), h("span", {}, label));
  const see = h("a", { href: "#/customers", class: "lots-see", onclick: (e) => {
    if (app.lots.length < 2) return;
    e.preventDefault();
    app.setLotFilter(lot.slug);
    const picker = document.querySelector(".topbar .lot-select");
    if (picker) picker.value = lot.slug;
    ctx.go("/customers");
  } }, "See its customers", icon("arrowRight"));
  return h("div", { class: "lots-numbers" },
    h("div", { class: "lots-tiles" },
      tile(show(n?.working.toLocaleString("en-US")), "Customers working now", false, !n?.working),
      tile(show(n?.sold.toLocaleString("en-US")), `Sold in ${month}`, false, !n?.sold),
      tile(show(n ? money(n.sales) : ""), `Sales in ${month}`, true, !n?.sales)),
    see);
}

function countsFor(rows, slug) {
  const month = todayKey().slice(0, 7);
  const out = { working: 0, sold: 0, sales: 0 };
  for (const r of rows) {
    if (r.lot !== slug) continue;
    if (r.stage !== "delivered" && r.stage !== "lost") out.working++;
    for (const o of r.orders || []) {
      if (o.status === "cancelled" || !o.soldAt) continue;
      const d = new Date(o.soldAt);
      if (Number.isNaN(d.valueOf()) || todayKey(d).slice(0, 7) !== month) continue;
      out.sold++;
      out.sales += Number(o.total) || 0;
    }
  }
  return out;
}

/* the dealers who work here, and who sees every lot */
function people(app, lot) {
  const team = (app.me?.team || []).filter((p) => p.active !== false);
  const here = team.filter((p) => p.role === "dealer" && (p.lots || []).includes(lot.slug));
  const everywhere = team.filter((p) => p.role !== "dealer");
  const name = (p) => p.name || p.email;
  return h("div", { class: "lots-people" },
    h("h3", { class: "lots-sub" }, "Who works here"),
    here.length
      ? h("ul", { class: "lots-faces" }, here.map((p) => h("li", {}, h("span", { class: "lots-face", "aria-hidden": "true" }, initials(name(p))),
        h("span", {}, name(p), h("small", {}, ROLE_WORDS[p.role])))))
      : h("p", { class: "muted small" }, "No dealers on this lot yet.",
        app.can("changeTeam") ? [" ", h("a", { href: "#/team" }, "Add one on the Team page.")] : null),
    everywhere.length ? h("p", { class: "lots-everyone" }, `${listWords(everywhere.map(name))} ${everywhere.length === 1 ? "sees" : "see"} every lot.`) : null);
}

function listWords(names) {
  if (names.length < 3) return names.join(" and ");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/* ---- the 3D designer link ------------------------------------------------------- */

function designerUrl(app, lot) {
  return new URL(app.designerUrl(lot.slug), location.origin).href;
}

function designerLink(ctx, lot) {
  const { app } = ctx;
  const url = designerUrl(app, lot);
  const isOpen = lot.active !== false;
  const businessOpen = app.business?.open !== false;
  let note = null;
  if (!isOpen) note = h("p", { class: "lots-link-note" }, "Open the lot to turn this link back on.");
  else if (!businessOpen) {
    note = h("p", { class: "lots-link-note" }, "Your 3D designer is closed to customers, so this link shows a short message for now.",
      app.isOwner ? [" ", h("a", { href: "#/settings" }, "Open it in Settings")] : null);
  }
  return h("div", { class: ["lots-link", !isOpen && "off"] },
    h("h3", { class: "lots-sub" }, icon("link"), "Its 3D designer link"),
    h("p", { class: "lots-url" }, url),
    h("div", { class: "actions" },
      linkButton("Open the designer", url, { icon: "cube", newTab: true, small: true }),
      button("Copy link", async () => say(await copyText(url), "Link copied."), { icon: "copy", small: true })),
    note);
}

async function say(copied, words) {
  if (copied) toast(words);
  else toast("Couldn't copy. Press and hold the words to copy them.", { error: true });
}

/* ---- the designer on a website ----------------------------------------------------- */

function websiteCode(lot) {
  return `<div id="shed-designer"></div>\n<script src="${location.origin}/${SCRIPT_FILE}" data-lot="${lot.slug}" data-height="720" async></script>`;
}

function websitePart(ctx, lot, big) {
  const { app } = ctx;
  const owner = app.can("changeLots");
  const code = websiteCode(lot);
  let sites = [...(lot.embedOrigins || [])];
  let suggestion = null;

  const list = h("ul", { class: "lots-sites" });
  const addArea = h("div", { class: "lots-site-add" });

  const drawList = () => {
    list.replaceChildren(...(sites.length ? sites.map((site) => h("li", {},
      icon("globe"), h("span", { class: "lots-site-name" }, plainAddress(site)),
      owner ? button("Remove", () => removeSite(site), { kind: "quiet", small: true, icon: "trash" }) : null))
      : [h("li", { class: "lots-sites-none" }, owner
        ? "No websites yet. Add the website where you'll paste the code, or the designer won't show there."
        : "No websites yet. Ask the owner to add your website here.")]));
  };

  async function save(next, done) {
    const out = await patch(`lots/${lot.slug}`, { embedOrigins: next });
    sites = [...(out.lot.embedOrigins || [])];
    lot.embedOrigins = sites;
    await app.loadMe().catch(() => null);
    drawList();
    done?.();
  }

  async function removeSite(site) {
    const yes = await confirmBox(`Remove ${plainAddress(site)}?`,
      `The 3D designer for ${lot.name} stops showing on ${plainAddress(site)}.`, { yes: "Remove website", danger: true });
    if (!yes) return;
    try {
      await save(sites.filter((s) => s !== site));
      suggestion = null;
      drawAdd();
      toast(`Removed ${plainAddress(site)}.`);
    } catch (e) {
      toast(e.message, { error: true });
    }
  }

  async function addSite(typed) {
    const before = new Set(sites);
    await save([...sites, typed]);
    const added = sites.find((s) => !before.has(s));
    const partner = added ? wwwPartner(added) : null;
    suggestion = partner && !sites.includes(partner) && sites.length < MAX_SITES ? partner : null;
    drawAdd();
    toast(added ? `Added ${plainAddress(added)}.` : `${plainAddress(typed)} is already on the list.`);
  }

  function drawAdd() {
    if (!owner) { clear(addArea); return; }
    const box = field("Add a website", { placeholder: "yoursite.com", inputmode: "url", autocomplete: "off", maxLength: 300,
      hint: "Just the address, like yoursite.com. Add each one the designer should show on." });
    box.input.setAttribute("autocapitalize", "off");
    box.input.setAttribute("spellcheck", "false");
    const full = sites.length >= MAX_SITES;
    const f = form([
      h("div", { class: "lots-site-row" }, box.wrap,
        h("button", { type: "submit", class: "btn btn-ghost", disabled: full }, icon("plus"), h("span", {}, "Add website"))),
      full ? h("p", { class: "hint" }, `That's ${MAX_SITES} websites, the most a lot can have. Remove one to add another.`) : null,
    ], async () => {
      const typed = box.input.value.trim();
      if (!typed) throw new Error("Type the website's address first, like yoursite.com.");
      if (!looksLikeWebsite(typed)) throw new Error(`“${typed}” is not a website address. Type it like yoursite.com.`);
      await addSite(typed);
    });
    clear(addArea,
      suggestion ? h("div", { class: "lots-suggest" },
        h("span", {}, `People also reach this website at ${plainAddress(suggestion)}.`),
        button(`Add ${plainAddress(suggestion)} too`, async (e) => {
          e.currentTarget.disabled = true;
          try { await addSite(suggestion); } catch (err) { toast(err.message, { error: true }); drawAdd(); }
        }, { kind: "primary", small: true, icon: "plus" })) : null,
      f);
  }

  drawList();
  drawAdd();

  const body = [
    h("p", { class: "lots-web-intro" }, "Send this to whoever runs your website. Paste it where the designer should show."),
    h("pre", { class: "lots-code" }, h("code", {}, code)),
    h("div", { class: "actions" },
      button("Copy website code", async () => say(await copyText(code), "Website code copied."), { kind: "primary", icon: "copy", small: true })),
    h("h4", { class: "lots-sub small-sub" }, "Websites that may show it"),
    list,
    addArea,
  ];
  if (big) {
    return h("section", { class: "lots-web open" }, h("h3", { class: "lots-sub" }, icon("globe"), "Put the designer on your website"), body);
  }
  return h("details", { class: "lots-web" },
    h("summary", {}, icon("globe"), h("span", {}, "Put the designer on your website"),
      h("span", { class: "lots-web-count" }, sites.length ? plural(sites.length, "website") : "No websites yet"),
      icon("chevronDown", "lots-chev")),
    h("div", { class: "lots-web-body" }, body));
}

/* "https://www.mysite.com" -> "www.mysite.com"; "https://mysite.com/" -> "mysite.com" */
function plainAddress(address) {
  return String(address || "").replace(/^https?:\/\//i, "").replace(/\/$/, "");
}

/* A quick look before asking the server (which checks it properly):
   "mysite.com", "https://www.mysite.com/page" yes; "my site" no. */
function looksLikeWebsite(typed) {
  try {
    const u = new URL(/^[a-z]+:\/\//i.test(typed) ? typed : `https://${typed}`);
    return /^https?:$/.test(u.protocol) && !/\s/.test(typed) && (u.hostname.includes(".") || u.hostname === "localhost");
  } catch {
    return false;
  }
}

/* mysite.com <-> www.mysite.com: the other way people type the same website */
function wwwPartner(address) {
  try {
    const u = new URL(address);
    const host = u.hostname;
    if (host === "localhost" || /^[\d.]+$/.test(host)) return null;
    const partner = host.startsWith("www.") ? host.slice(4) : host.split(".").length === 2 ? `www.${host}` : null;
    if (!partner || !partner.includes(".")) return null;
    return `${u.protocol}//${partner}${u.port ? `:${u.port}` : ""}`;
  } catch {
    return null;
  }
}

/* ---- adding, changing, closing ---------------------------------------------------------- */

/* the lot's part of its link, made from its name (as the server makes it) */
function linkNameFrom(name) {
  return String(name).toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40).replace(/-+$/, "");
}
function freeLinkName(app, name) {
  let base = linkNameFrom(name);
  if (!/^[a-z0-9-]{2,40}$/.test(base)) base = "lot";
  const taken = new Set(app.lots.map((l) => l.slug));
  for (let n = 1; n <= 20; n++) {
    const slug = n === 1 ? base : `${base.slice(0, 37)}-${n}`;
    if (!taken.has(slug)) return slug;
  }
  return base;
}

function lotDialog(ctx, lot) {
  const { app } = ctx;
  const isNew = !lot;
  const v = lot || {};
  const name = field("Lot name", { required: true, value: v.name || "", placeholder: "Port Charlotte", maxLength: 80, autocomplete: "off",
    hint: isNew ? "Customers see it on the designer, like “Yoder Storage Barns — Port Charlotte”." : null });
  const street = field("Street address", { value: v.address || "", maxLength: 200, autocomplete: "street-address", wide: true });
  const city = field("City", { value: v.city || "", maxLength: 80, autocomplete: "address-level2" });
  const state = field("State", { value: v.state || "", maxLength: 40, autocomplete: "address-level1", placeholder: "FL" });
  const zip = field("ZIP", { value: v.zip || "", maxLength: 12, inputmode: "numeric", autocomplete: "postal-code" });
  const phone = field("Phone", { type: "tel", value: v.phone || "", maxLength: 40, autocomplete: "tel", placeholder: "(941) 555-0140" });
  const email = field("Email", { type: "email", value: v.email || "", maxLength: 200, autocomplete: "email",
    hint: "New quotes from this lot's designer go here when email is set up." });
  const hours = field("Hours", { type: "textarea", rows: 3, value: v.hours || "", maxLength: 300, wide: true, placeholder: "Mon–Fri 9–5\nSat 9–2" });
  const website = field("Lot website", { value: v.website ? plainAddress(v.website) : "", maxLength: 300, inputmode: "url", autocomplete: "url",
    placeholder: "yoursite.com", wide: true, hint: "If this lot has its own website. Leave it empty to use the business website." });
  website.input.setAttribute("autocapitalize", "off");

  const linkWords = h("span", {});
  const showLink = () => {
    if (isNew && !name.input.value.trim()) {
      clear(linkWords, "Its 3D designer link is made from the lot's name.");
      return;
    }
    const slug = isNew ? freeLinkName(app, name.input.value) : lot.slug;
    const url = new URL(app.designerUrl(slug), location.origin).href;
    clear(linkWords, isNew ? "Its 3D designer link will be " : "Its 3D designer link stays ", h("strong", {}, url),
      isNew ? "" : ". Renaming the lot keeps the same link, so websites keep working.");
  };
  if (isNew) name.input.addEventListener("input", showLink);
  showLink();
  const linkNote = h("p", { class: "lots-link-preview" }, icon("link"), linkWords);

  const box = dialog(isNew ? "Add a lot" : `Edit ${lot.name}`, form([
    h("div", { class: "form-grid" }, name.wrap),
    linkNote,
    h("div", { class: "form-grid" }, street.wrap),
    h("div", { class: "lots-addr" }, city.wrap, state.wrap, zip.wrap),
    h("div", { class: "form-grid" }, phone.wrap, email.wrap, hours.wrap, website.wrap),
    h("div", { class: "actions end" },
      button("Cancel", () => box.close()),
      h("button", { type: "submit", class: "btn btn-primary" }, icon(isNew ? "plus" : "check"), h("span", {}, isNew ? "Add lot" : "Save lot"))),
  ], async () => {
    const body = {
      name: name.input.value.trim(), address: street.input.value.trim(), city: city.input.value.trim(),
      state: state.input.value.trim(), zip: zip.input.value.trim(), phone: phone.input.value.trim(),
      email: email.input.value.trim(), hours: hours.input.value.replace(/\r/g, "").trim(), website: website.input.value.trim(),
    };
    if (isNew) {
      const out = await post("lots", body);
      box.close();
      await app.loadMe();
      window.dispatchEvent(new Event("dealer:lots"));
      toast(`Added ${out.lot.name}. Its 3D designer link is ready.`);
      ctx.go(`/lots/${out.lot.slug}`);
    } else {
      const out = await patch(`lots/${lot.slug}`, body);
      box.close();
      await app.loadMe();
      window.dispatchEvent(new Event("dealer:lots"));
      toast(`Saved ${out.lot.name}.`);
      ctx.refresh();
    }
  }), { wide: true });
}

async function setOpen(ctx, lot, open) {
  const { app } = ctx;
  const yes = await confirmBox(open ? `Open ${lot.name}?` : `Close ${lot.name}?`,
    open ? `${lot.name}'s 3D designer link works again, and customers can send quotes from it.`
      : `Closing ${lot.name} stops its 3D designer link. Its customers stay.`,
    { yes: open ? "Open lot" : "Close lot", danger: !open });
  if (!yes) return;
  try {
    await patch(`lots/${lot.slug}`, { active: open });
  } catch (e) {
    toast(e.message, { error: true });
    return;
  }
  await app.loadMe();
  window.dispatchEvent(new Event("dealer:lots"));
  toast(open ? `${lot.name} is open. Its 3D designer link works again.` : `${lot.name} is closed. Its 3D designer link is off; its customers stay.`);
  ctx.refresh();
}
