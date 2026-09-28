/* "SHARE MY DESIGN", AND OPENING A DESIGN SOMEBODY SHARED. Browser file, a
   plugin of the designer page (ui/app.js loads it last, after the first
   picture, and calls install(api) with window.shedUI).

   WHAT THE CUSTOMER SEES
   * A "Share my design" button at the bottom of the quote card (#share-mount).
     It makes a LINK that opens this exact building -- style, size, colours,
     every door and window where they put it -- and:
       - on a phone or tablet that has one, opens the phone's share sheet
         (Messages, Mail, WhatsApp ...);
       - otherwise copies the link, and says so;
     and either way shows the link in a box with a Copy button, so it can be
     copied by hand when a browser refuses to copy for us.
   * Where the link goes: the company's own page that holds the designer
     (company.embed.shareUrl) when the company has one, else this page's own
     address. The building rides in the part after "#d=" (model/design.js
     encode: short, and never sent to any server -- the part after "#" stays
     in the browser).
   * OPENING A LINK. ui/app.js has already put the building from a "#d=" link
     on the screen before this file runs. This file tells the customer what
     they need to know about it, in plain words, in a card at the top of the
     side column:
       - LOOK-ONLY LINKS (#d=...&view=1, or ?view=1): the page becomes a
         look-only page -- nothing can be picked, dragged or added
         (shedUI.setReadOnly) and the cards are hidden -- with a card showing
         the building and its price FROM TODAY'S PRICE LIST, buttons to call
         or text the company, to share it on, and "Change this design" (which
         turns the normal designer back on). This is what the quote form
         (ui/quote.js) sends the company, so the person reading a quote sees
         the building, not a list of codes.
       - A LINK NEVER CARRIES A PRICE ANYONE SHOULD TRUST (docs/DIFFERENCES.md
         #14). The link remembers what the design cost the day it was made
         (the customer's own day, not London's); when today's price is
         different the card says so: "This design was priced at $X on <date>;
         prices may have changed -- contact <company>". A company that shows
         no prices (pricing.show "none") gets links with no price in them at
         all: anybody can unpack a link and read what is inside it.
       - Anything in the link the company no longer offers (a size, a colour,
         a door, an upgrade) was left off or swapped by model/design.js
         toState; the card lists what, in its own plain sentences.
       - A link that was cut short or changed by hand cannot be read: the
         customer sees the standard building and a plain message saying the
         link could not be opened and what to do -- never a blank page and
         never a half-built building.
     If the address changes to a different "#d=" link while the page is open
     (a link tapped with the designer already open in that tab), the page
     reloads so the new building is shown.

   Every word from the company file, the link or its warnings goes through
   ui/esc.js before it touches the page.

   FOR ui/quote.js (and checks) this file exports the link and the contact
   helpers, so a quote carries the very same link the Share button makes:
     shareBase(cat, href)          the address a link starts with
     today()                       "2026-01-14" on the customer's own calendar
     linkDesign(api)               the design as a link carries it: with the
                                   price and today's date, or with no price
                                   at all for a company that shows none
     designLink(api, {view})       -> Promise of the full link for the design
                                   now on screen (view: true adds "&view=1")
     keepLink(api, {view})         the same link kept ready: .now() / .get()
     copyText(text)                -> Promise of true/false (the clipboard,
                                   with the old copy-command fallback)
     smsHref(phone, body)          an sms: link (iPhones and Androids write it
                                   differently -- Barnwright's smsLink)
     contactHtml(cat, words)       Call / Text / E-mail links for the company,
                                   escaped, or "" when it has none
     priceNote(design, total, cat) the "priced at $X on <date>" sentence or ""
     viewAsked(href)               does this address ask for the look-only page
   and hangs shedUI.share = { link(), linkNow(), view, notice, copy() } on the
   page for the checks (tools/check-share.mjs). */

import { esc, safeUrl, telHref } from "./esc.js";
import { encode } from "../model/design.js";
import { money } from "../model/pricing.js";
import { colorName, sidingPalette } from "../model/company.js";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/* ------------------------------------------------------------------------
   The link. */

/* The address a shared link starts with: the company's own designer page
   when it has one (any "#..." on it dropped), else this page's address
   without the parts that only make sense here (embed=1: the header bar is
   hidden inside a company's page; view=1: the link decides that itself). */
export function shareBase(cat, href) {
  const own = cat && cat.embed && typeof cat.embed.shareUrl === "string" ? cat.embed.shareUrl.trim() : "";
  if (own && safeUrl(own, { mail: false })) return own.split("#")[0];
  let u;
  try { u = new URL(href || location.href); } catch (e) { return ""; }
  u.hash = "";
  u.searchParams.delete("embed");
  u.searchParams.delete("view");
  return u.toString().replace(/\?$/, "");
}

/* Today on the customer's own calendar, "2026-01-14". (The day in London is
   no use: at 9 pm in Florida it is already tomorrow there, and the look-only
   page would say the design was priced on a day that had not come yet.) */
export function today(now) {
  const d = now || new Date();
  const two = (n) => (n < 10 ? "0" : "") + n;
  return d.getFullYear() + "-" + two(d.getMonth() + 1) + "-" + two(d.getDate());
}

/* The design as a link carries it: with the price the customer saw and the
   day -- except for a company that shows no prices (pricing.show "none"),
   whose links carry no price at all, because anybody can read what is in a
   link. */
export function linkDesign(api) {
  const cat = api.getCatalogue();
  const showsPrices = !(cat.pricing && cat.pricing.show === "none");
  return api.getDesign(showsPrices ? { priced: true, at: today() } : {});
}

export async function designLink(api, opts) {
  opts = opts || {};
  const design = linkDesign(api);
  const text = await encode(design);
  return shareBase(api.getCatalogue(), opts.href) + "#d=" + text + (opts.view ? "&view=1" : "");
}

/* A link kept ready for the design on screen, remade shortly after every
   change, so a tap can use it at once: a phone only lets a page copy, share
   or open an e-mail inside the tap itself, and making a link takes a moment.
   now() is the link if it still matches the design on screen, else null;
   get() is a promise of an up-to-date one. */
export function keepLink(api, opts) {
  let ready = { key: null, link: "" }, timer = null;
  const keyNow = () => JSON.stringify(api.getDesign());
  function make() {
    const key = keyNow();
    return designLink(api, opts).then((l) => { ready = { key: key, link: l }; return l; });
  }
  api.on("change", () => { clearTimeout(timer); timer = setTimeout(() => { make().catch(() => {}); }, 120); });
  make().catch((e) => console.error("A link to the design could not be made:", e));
  return {
    now() { return ready.key !== null && ready.key === keyNow() ? ready.link : null; },
    get() { const n = this.now(); return n ? Promise.resolve(n) : make(); },
  };
}

/* Does this address ask for the look-only page? "#d=...&view=1" or "?view=1". */
export function viewAsked(href) {
  let u;
  try { u = new URL(href || location.href); } catch (e) { return false; }
  if (u.searchParams.get("view") === "1") return true;
  return /(^|[#&])view=1(&|$)/.test(u.hash || "");
}

/* the "d=" part of an address's hash, or "" */
function linkBody(hash) {
  const m = /[#&]d=([^&#]*)/.exec(hash || "");
  return m ? m[1] : "";
}

/* ------------------------------------------------------------------------
   Copying and sending. */

function fallbackCopy(t) {
  try {
    const ta = document.createElement("textarea");
    ta.value = t; ta.setAttribute("readonly", "");
    ta.style.cssText = "position:fixed;left:-9999px;top:0";
    document.body.appendChild(ta);
    ta.select(); ta.setSelectionRange(0, t.length);
    const ok = document.execCommand("copy");
    ta.parentNode.removeChild(ta);
    return !!ok;
  } catch (e) { return false; }
}

export function copyText(t) {
  return new Promise((resolve) => {
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
        navigator.clipboard.writeText(t).then(() => resolve(true), () => resolve(fallbackCopy(t)));
        return;
      }
    } catch (e) { /* fall through to the old way */ }
    resolve(fallbackCopy(t));
  });
}

export function isIOS() {
  try {
    if (/iPad|iPhone|iPod/.test(navigator.userAgent)) return true;
    return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;   /* newer iPads */
  } catch (e) { return false; }
}

/* iPhones and Androids disagree about how a text message link is written. */
export function smsHref(phone, body) {
  const tel = telHref(phone);
  if (!tel) return "";
  return "sms:" + tel.slice(4) + (body ? (isIOS() ? "&" : "?") + "body=" + encodeURIComponent(body) : "");
}

function mailHref(addr, subject, body) {
  const a = String(addr || "").trim();
  if (!/^[^\s@<>"',;:?&]+@[^\s@<>"',;:?&]+\.[^\s@<>"',;:?&]+$/.test(a)) return "";
  return "mailto:" + a + "?subject=" + encodeURIComponent(subject || "") + (body ? "&body=" + encodeURIComponent(body) : "");
}

/* Call / Text / E-mail links for the company, escaped. words: {sms, subject, mail}. */
export function contactHtml(cat, words) {
  words = words || {};
  const b = cat.brand || {};
  const out = [];
  const tel = telHref(b.phone);
  if (tel) {
    out.push('<a class="shcall" href="' + esc(tel) + '"><b>Call</b> <span>' + esc(b.phone) + "</span></a>");
    const sms = smsHref(b.phone, words.sms || "");
    if (sms) out.push('<a class="shtext" href="' + esc(sms) + '"><b>Text</b> <span>' + esc(b.phone) + "</span></a>");
  }
  const mail = mailHref(b.email, words.subject || "My shed design", words.mail || words.sms || "");
  if (mail) out.push('<a class="shmail" href="' + esc(mail) + '"><b>E-mail</b> <span>' + esc(b.email) + "</span></a>");
  return out.length ? '<div class="shcontact">' + out.join("") + "</div>" : "";
}

/* ------------------------------------------------------------------------
   The words. */

export function niceDate(at) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(at == null ? "" : at));
  if (!m || +m[2] < 1 || +m[2] > 12 || +m[3] < 1 || +m[3] > 31) return "";
  /* a day the calendar does not have (February 30, from a hand-made link) is no date */
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  if (d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3]) return "";
  return MONTHS[+m[2] - 1] + " " + (+m[3]) + ", " + m[1];
}

/* "This design was priced at $X on <date>; prices may have changed -- contact
   <company>." when the link's saved price differs from today's, else "".
   Plain text: the caller escapes it. */
export function priceNote(design, nowTotal, cat) {
  const p = design && design.priced;
  if (!p || typeof p !== "object" || (cat.pricing && cat.pricing.show === "none")) return "";
  const was = typeof p.total === "number" ? p.total : NaN;
  if (!isFinite(was) || Math.abs(was - nowTotal) < 0.005) return "";
  const when = niceDate(p.at);
  const b = cat.brand || {};
  const who = (b.name || "the company") + (b.phone ? " at " + b.phone : "");
  return "This design was priced at " + money(was) + (when ? " on " + when : " earlier") +
    "; prices may have changed - contact " + who + " for today's price. The price shown here is from today's price list.";
}

function sizeWords(size) { return String(size || "").replace("x", " × "); }

/* the building and its price today, as the quote card's summary lines */
function summaryHtml(api) {
  const cat = api.getCatalogue(), st = api.getState(), T = cat.TYPES[st.type] || {};
  const pp = api.price();
  const show = cat.pricing.show !== "none";
  const amt = (n) => show ? "<b>" + esc(money(n)) + "</b>" : "<b></b>";
  let h = '<div class="sumline"><span>' + esc(sizeWords(st.size) + " " + (T.name || st.type)) + "</span>" + amt(pp.base) + "</div>";
  pp.lines.forEach((l) => { h += '<div class="sumline"><span>' + esc(l[0]) + "</span>" + amt(l[1]) + "</div>"; });
  h += '<div class="sumline"><span>' + (T.metal ? "Metal" : "Siding") + " " + esc(colorName(sidingPalette(T, cat.COLORS), st.body)) +
    " · Trim " + esc(colorName(cat.COLORS.trim, st.trim)) + " · Roof " + esc(colorName(cat.COLORS.metal, st.roof)) + "</span><b>—</b></div>";
  if (show) h += '<div class="sumline tot"><span class="disp" style="letter-spacing:.08em;text-transform:uppercase;font-size:13px">Estimated total today</span><b>' + esc(money(pp.total)) + "</b></div>";
  return h;
}

/* ------------------------------------------------------------------------
   The plugin. */

let cssAdded = false;
function addCss() {
  if (cssAdded || typeof document === "undefined") return;
  cssAdded = true;
  if (document.querySelector("link[data-share-css]")) return;
  const l = document.createElement("link");
  l.rel = "stylesheet"; l.href = new URL("./share.css", import.meta.url).href;
  l.setAttribute("data-share-css", "");
  document.head.appendChild(l);
}

export function install(api) {
  const cat = api.getCatalogue();
  const wrap = document.getElementById("wrap");
  const mount = (api.mounts && api.mounts.share) || document.getElementById("share-mount");
  addCss();

  /* ---- the link, kept ready so a tap can copy it at once (a phone only
     lets a page copy or share inside the tap itself) ---- */
  const keeper = keepLink(api);
  const currentLink = () => keeper.get();

  const b = cat.brand || {};
  const shareTitle = (b.name ? b.name + " — " : "") + "my shed design";

  /* ---- the Share button ---- */
  function shareBox(label) {
    const box = document.createElement("div");
    box.className = "sharebox";
    box.innerHTML = '<button type="button" class="bigbtn alt sharebtn">' + esc(label) + "</button>" +
      '<div class="sharepanel" hidden>' +
      '<p class="sharehow">Send this link to anyone — it opens this exact building.</p>' +
      '<input class="sharelink" type="text" readonly aria-label="The link to your design">' +
      '<div class="sharerow"><button type="button" class="copybtn sharecopy">Copy link</button>' +
      (typeof navigator.share === "function" ? '<button type="button" class="copybtn sharemore">Send it…</button>' : "") +
      '<span class="sharemsg" role="status" aria-live="polite"></span></div></div>';
    const btn = box.querySelector(".sharebtn"), panel = box.querySelector(".sharepanel");
    const input = box.querySelector(".sharelink"), msg = box.querySelector(".sharemsg");
    const say = (t) => { msg.textContent = t; };
    function show(link) { input.value = link; panel.hidden = false; }
    function copy(link) {
      show(link);
      return copyText(link).then((ok) => {
        say(ok ? "Link copied — paste it into a text or an e-mail." : "Copying is blocked here — press and hold the link above to copy it.");
        if (!ok) { try { input.focus(); input.select(); } catch (e) { /* ignore */ } }
        return ok;
      });
    }
    function sheet(link) {
      show(link);
      try {
        return navigator.share({ title: shareTitle, text: "Here's the shed I designed:", url: link }).then(
          () => { say("Sent."); return true; },
          (e) => { if (e && e.name === "AbortError") { say(""); return false; } return copy(link); });
      } catch (e) { return copy(link); }
    }
    const touch = () => { try { return window.matchMedia("(pointer: coarse)").matches; } catch (e) { return false; } };
    function go(useSheet) {
      const run = (link) => (useSheet && typeof navigator.share === "function") ? sheet(link) : copy(link);
      const now = keeper.now();
      if (now) return run(now);                                 /* inside the tap */
      say("Making your link…");
      return currentLink().then(run, () => { say("Sorry — the link could not be made. Please try again."); return false; });
    }
    btn.addEventListener("click", () => go(touch()));
    box.querySelector(".sharecopy").addEventListener("click", () => go(false));
    const more = box.querySelector(".sharemore");
    if (more) more.addEventListener("click", () => go(true));
    input.addEventListener("focus", () => { try { input.select(); } catch (e) { /* ignore */ } });
    return box;
  }
  if (mount) mount.appendChild(shareBox("Share my design"));

  /* ---- what the opened link says ---- */
  const opened = api.startDesign || null;
  const warnings = Array.isArray(api.startWarnings) ? api.startWarnings : [];
  const damaged = api.startError || null;
  const wantView = viewAsked(location.href);
  const info = { view: false, notice: "", priceNote: "", warnings: warnings.slice(), damaged: damaged };

  function cardAtTop(cls, html, role) {
    const c = document.createElement("section");
    c.className = "vcard " + cls;
    if (role) c.setAttribute("role", role);
    c.innerHTML = html;
    if (wrap) wrap.insertBefore(c, wrap.firstChild);
    else document.body.appendChild(c);
    return c;
  }
  function warnHtml() {
    if (!warnings.length) return "";
    return '<div class="shwarn"><b>Since this design was made:</b><ul>' + warnings.map((w) => "<li>" + esc(w) + "</li>").join("") + "</ul></div>";
  }

  if (damaged) {
    const who = b.name ? b.name : "the company";
    const phone = b.phone ? ", or call " + who + " at " + b.phone : "";
    info.notice = "This design link could not be opened. " + damaged + " You're looking at the standard building instead. Ask whoever sent the link to send it again" + phone + ".";
    cardAtTop("shnotice shbad",
      "<h3>This design link could not be opened</h3>" +
      '<p class="vnote">' + esc(damaged) + "</p>" +
      '<p class="vnote">You’re looking at the standard building instead. Ask whoever sent the link to send it again' + esc(phone) + ".</p>" +
      contactHtml(cat, { sms: "Hi, a design link you sent me would not open. Could you send it again?" }) +
      '<div class="sharerow"><button type="button" class="copybtn shok">OK</button></div>', "alert");
  } else if (opened) {
    const note = priceNote(opened, api.price().total, cat);
    info.priceNote = note;
    if (wantView) {
      enterView(note);
    } else if (note || warnings.length) {
      info.notice = [note].concat(warnings).filter(Boolean).join(" ");
      cardAtTop("shnotice",
        "<h3>About this design link</h3>" +
        (note ? '<p class="vnote shprice">' + esc(note) + "</p>" : "") + warnHtml() +
        '<div class="sharerow"><button type="button" class="copybtn shok">OK</button></div>', "status");
    }
  }
  Array.prototype.forEach.call(document.querySelectorAll(".shnotice .shok"), (k) => {
    k.addEventListener("click", () => { const c = k.closest(".shnotice"); if (c) c.remove(); });
  });

  /* ---- the look-only page ---- */
  function enterView(note) {
    info.view = true;
    api.setReadOnly(true);
    const hint = document.getElementById("hint");
    const hintWas = hint ? hint.textContent : "";
    if (hint) hint.textContent = "Drag to spin it around";
    const card = cardAtTop("shview",
      "<h3>" + esc(b.name ? b.name + " — a shared design" : "A shared design") + "</h3>" +
      '<div class="shsum"></div>' +
      (note ? '<p class="vnote shprice">' + esc(note) + "</p>" : "") + warnHtml() +
      contactHtml(cat, { sms: "Hi, I'm looking at a shed design on your website and I have a question." }) +
      '<button type="button" class="bigbtn shchange">Change this design</button>' +
      '<div class="shviewshare"></div>' +
      '<p class="vnote">' + (cat.pricing.show !== "none" ? "Prices are from today’s price list" + (cat.notes && cat.notes.finePrint ? ". " : ".") : "") +
      esc((cat.notes && cat.notes.finePrint) || "") + "</p>");
    const sum = card.querySelector(".shsum");
    const paint = () => { sum.innerHTML = summaryHtml(api); };
    paint();
    const offChange = api.on("change", paint);
    card.querySelector(".shviewshare").appendChild(shareBox("Share this design"));
    card.querySelector(".shchange").addEventListener("click", () => {
      offChange();
      card.remove();
      if (hint) hint.textContent = hintWas;
      api.setReadOnly(false);
      info.view = false;
      /* a reload now keeps the designer open for changes */
      try {
        const u = new URL(location.href);
        u.searchParams.delete("view");
        u.hash = u.hash.replace(/&view=1(?=&|$)/, "").replace(/^#view=1&?/, "#");
        history.replaceState(history.state, "", u.toString());
      } catch (e) { /* an old browser keeps the address as it was */ }
    });
  }

  /* a different design link opened in this same tab: show it */
  const openedBody = linkBody(location.hash);
  window.addEventListener("hashchange", () => {
    const now = linkBody(location.hash);
    if (now && now !== openedBody) location.reload();
  });

  api.share = {
    link: () => currentLink(),
    linkNow: () => keeper.now(),
    viewLink: () => designLink(api, { view: true }),
    get view() { return info.view; },
    get notice() { return info.notice; },
    get priceNote() { return info.priceNote; },
    get warnings() { return info.warnings.slice(); },
    get damaged() { return info.damaged; },
    copy: () => currentLink().then(copyText),
  };
}

export default install;
