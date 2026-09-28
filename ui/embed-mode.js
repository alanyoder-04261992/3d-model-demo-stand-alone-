/* THE DESIGNER WHEN IT SITS INSIDE A COMPANY'S OWN WEB PAGE (?embed=1).
   Browser file, a plugin of the designer page: install(api) is called once
   with window.shedUI (see ui/app.js, "PLUGINS"). It does nothing at all when
   the designer is not embedded.

   ui/interaction.js already does the two things a visitor feels -- on a
   touch screen a "Tap to design" cover, so a finger scrolls the company's
   page past the designer until the customer means to use it; and the mouse
   wheel zooms only with Ctrl held or after a click -- and ui/styles.css hides
   the header bar. This file adds the rest:

   1. IT TELLS THE COMPANY'S PAGE WHAT IS HAPPENING, the way embed.js expects
      (embed.js turns these into events on the company's page):
        { type: "shed:ready", v: 1, company, style, styleName, size, total }
            once, when the first picture is drawn
        { type: "shed:design-changed", v: 1, company, reason, design,
          summary: { style, styleName, size, total }, link }
            after the customer changes the building (a short pause first,
            so dragging a door does not send a hundred messages)
      "total" is left out when the company shows no prices; "link" is the
      share link (ui/share.js), when that plugin is on the page. The building
      only -- never anything about the customer.
      Quote requests ("shed:quote-requested") are sent by ui/quote.js itself,
      with the customer's details ONLY when the company's leads go to its own
      page (leads mode "postMessage").
      TO WHOM: only the page the designer sits in, and only when that page's
      website is on the company's embed.origins (or is this designer's own
      website, as embed-demo.html is). The browser is told the exact website,
      never "*", so nothing reaches any other page. The website comes from
      location.ancestorOrigins (Chrome, Safari), else the address the frame
      was opened from (document.referrer; Firefox).
   2. A MOUSE USER WHO SCROLLS OVER THE BUILDING is told why it did not zoom:
      "Hold Ctrl and scroll to zoom -- or click the building first", for a
      moment, until they click it.

   For other plugins and the checks: api.embed = { parentOrigin, allowed,
   post(type, data), sent } -- post() sends one message by the same rules
   (type without "shed:"), sent lists what went.

   LOADING IT: ui/app.js must import this file when the address has
   ?embed=1 (add "embed-mode" to its plugin list, or import it for embedded
   pages). Until it does, tools/check-embed.mjs loads it by hand and says so. */

const NOTE_MS = 1800;
const PAUSE_MS = 350;

export function parentOriginOf(win, loc, doc) {
  try { if (win.parent === win) return ""; } catch (e) { return ""; }
  try { if (loc.ancestorOrigins && loc.ancestorOrigins.length) return String(loc.ancestorOrigins[0]); } catch (e) { /* not in this browser */ }
  try { return doc.referrer ? new URL(doc.referrer).origin : ""; } catch (e) { return ""; }
}

function addStyles() {
  if (document.getElementById("embed-mode-css")) return;
  const link = document.createElement("link");
  link.rel = "stylesheet"; link.id = "embed-mode-css";
  link.href = new URL("./embed-mode.css", import.meta.url).href;
  document.head.appendChild(link);
}

export function install(api) {
  if (!api || !api.embedded || api.embed) return;
  const cat = api.getCatalogue();
  const po = parentOriginOf(window, location, document);
  const allowed = !!po && po !== "null" && ((cat.embed && cat.embed.origins) || []).concat([location.origin]).indexOf(po) >= 0;
  const showPrice = !(cat.pricing && cat.pricing.show === "none");
  const sent = [];

  function post(type, data) {
    if (!allowed) return false;
    const msg = Object.assign({ type: "shed:" + String(type).replace(/^shed:/, ""), v: 1, company: cat.id }, data || {});
    try {
      window.parent.postMessage(JSON.parse(JSON.stringify(msg)), po);        /* to that website only -- never "*" */
      sent.push({ type: msg.type, at: Date.now() });
      return true;
    } catch (e) { console.error("The designer could not tell the company's page:", e); return false; }
  }

  function summary() {
    const s = api.getState();
    const t = (cat.TYPES && cat.TYPES[s.type]) || {};
    const out = { style: s.type, styleName: t.name || s.type, size: s.size };
    if (showPrice) { try { out.total = api.price().total; } catch (e) { /* the price is the cards' business */ } }
    return out;
  }

  async function linkNow() {
    if (!api.share || typeof api.share.link !== "function") return undefined;
    try {
      return await Promise.race([api.share.link(), new Promise((r) => setTimeout(() => r(undefined), 1500))]);
    } catch (e) { return undefined; }
  }

  api.embed = {
    get parentOrigin() { return po; },
    get allowed() { return allowed; },
    post: post,
    get sent() { return sent.slice(); },
  };

  if (!allowed && window.parent !== window) {
    console.info(`This designer is inside a page on ${po || "an unknown website"}, which is not on ${cat.id}'s list of websites (embed.origins), so it tells that page nothing.`);
  }

  /* 1. ready, once the first picture is drawn */
  let readySent = false;
  function ready() { if (readySent) return; readySent = true; post("ready", summary()); }
  if (api.ready) ready(); else window.addEventListener("shedui:ready", ready, { once: true });

  /* 1. changes, after a short pause */
  let timer = null, lastReason = "";
  api.on("change", (d) => {
    lastReason = (d && d.reason) || "";
    clearTimeout(timer);
    timer = setTimeout(async () => {
      let design;
      try { design = api.getDesign({ priced: showPrice }); } catch (e) { return; }
      const msg = { reason: lastReason, design: design, summary: summary() };
      const link = await linkNow();
      if (link) msg.link = link;
      post("design-changed", msg);
    }, PAUSE_MS);
  });

  /* 2. the wheel note */
  addStyles();
  let armed = false, noteTimer = null;
  const note = document.createElement("div");
  note.className = "embednote"; note.id = "embednote"; note.setAttribute("aria-live", "polite");
  note.textContent = "Hold Ctrl and scroll to zoom — or click the building first";
  if (api.stage) api.stage.appendChild(note);
  const arm = () => { armed = true; note.classList.remove("show"); };
  if (api.canvas) {
    api.canvas.addEventListener("pointerdown", arm);
    api.canvas.addEventListener("wheel", (e) => {
      if (armed || e.ctrlKey) return;
      note.classList.add("show");
      clearTimeout(noteTimer);
      noteTimer = setTimeout(() => note.classList.remove("show"), NOTE_MS);
    }, { passive: true });
  }
  document.addEventListener("click", (e) => { if (e.target && e.target.closest && e.target.closest("#tapcover")) arm(); }, true);
}

export default install;
