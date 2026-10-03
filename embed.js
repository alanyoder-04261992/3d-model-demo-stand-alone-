/* PUT THE 3D SHED DESIGNER ON A COMPANY'S OWN WEBSITE -- the one line a
   company pastes into its page. A plain browser script (not a module), so it
   works pasted into any website builder.

     <div id="shed-designer"></div>
     <script src="https://<where the designer lives>/embed.js"
             data-company="acme" data-height="640"></script>

   WHAT IT DOES
   * Puts a frame showing that company's designer (/c/<company>/?embed=1)
     into the empty <div id="shed-designer"> -- or, when there is none, right
     where the script line is.
   * WAITS until a visitor scrolls near it before loading anything (the frame
     is "lazy"), so the company's page opens as fast as it did before.
   * HEIGHT: data-height in pixels. Left out, it is three quarters of its
     width (a 4:3 box). Never less than 520 pixels either way -- a designer
     shorter than that has no room for its buttons.
   * A "Full screen" button under the designer. On phones and browsers that
     cannot make part of a page full screen (an iPhone), the designer is
     laid over the whole page instead, with a Close button.
   * A shared design link (the company's page address ending #d=...) is
     handed on to the designer, so the link opens that building.
   * The designer tells the company's page what the customer does, as events
     on the <div> (they bubble up to the whole page):
       shed:ready             the designer has loaded
       shed:design-changed    the customer changed the building
       shed:quote-requested   the customer sent a quote request
     each with event.detail = what the designer said (the building, its
     link, and -- only for a company whose leads go to its own page -- the
     customer's contact details). For example:
       document.addEventListener("shed:quote-requested", function (e) {
         console.log(e.detail);
       });
     ONLY messages from THIS designer frame, from the designer's own website,
     are passed on: another frame on the page, or another website, cannot
     pretend to be the designer. The designer only talks to websites listed
     in the company's settings (embed.origins).

   OPTIONS (data-... on the script line)
     data-company        the company's id (this or data-lot is required)
     data-lot            a lot of a business on the Dealer Center: its link
                         name (data-lot="port-charlotte" shows /d/port-charlotte/);
                         used instead of data-company when both are there
     data-height         the height in pixels (at least 520)
     data-target         where to put it, as a CSS selector (default
                         #shed-designer)
     data-fullscreen     "off" leaves out the Full screen button

   Nothing here writes anything from the page's address or the script line
   into the page as HTML: every word goes in as plain text. */
(function () {
  "use strict";

  var MIN_H = 520;
  var ID_RE = /^[a-z0-9-]{2,40}$/;
  var EVENTS = { "ready": 1, "design-changed": 1, "quote-requested": 1 };

  var script = document.currentScript || (function () {
    var s = document.getElementsByTagName("script");
    for (var i = s.length - 1; i >= 0; i--) {
      if (/(^|\/)embed\.js(\?|#|$)/.test(s[i].getAttribute("src") || "") && !s[i].getAttribute("data-shed-done")) return s[i];
    }
    return null;
  })();
  if (!script || script.getAttribute("data-shed-done")) return;
  script.setAttribute("data-shed-done", "1");

  function css(el, styles) { for (var k in styles) if (Object.prototype.hasOwnProperty.call(styles, k)) el.style[k] = styles[k]; return el; }
  function fire(target, name, detail) {
    var ev;
    try { ev = new CustomEvent(name, { detail: detail, bubbles: true }); }
    catch (e) { ev = document.createEvent("CustomEvent"); ev.initCustomEvent(name, true, false, detail); }
    target.dispatchEvent(ev);
  }

  /* where the designer lives: the folder embed.js was loaded from */
  var base;
  try { base = new URL(".", script.src); } catch (e) { return; }
  var designerOrigin = base.origin;

  /* where to put it */
  var sel = script.getAttribute("data-target");
  var host = null;
  try { host = document.querySelector(sel || "#shed-designer"); } catch (e) { host = null; }
  if (host && host.getAttribute("data-shed-embed")) host = null;       /* already holds one */
  if (!host) {
    host = document.createElement("div");
    script.parentNode.insertBefore(host, script.nextSibling);
  }
  host.setAttribute("data-shed-embed", "1");

  var company = String(script.getAttribute("data-company") || "").trim();
  var lot = String(script.getAttribute("data-lot") || "").trim();
  /* data-lot wins over data-company: a lot's designer (/d/<lot>/) gets the
     business's price list from the Dealer Center */
  var attr = lot ? "data-lot" : "data-company";
  if (!ID_RE.test(lot || company)) {
    var msg = css(document.createElement("p"), { border: "1px solid #c8b8b0", borderRadius: "8px", padding: "12px 14px", color: "#7c2a22", background: "#fdf3f2", font: "14px/1.45 system-ui, sans-serif" });
    msg.textContent = "The 3D designer could not be shown: the " + (lot ? "lot" : "company") + " in its embed code (" + attr + "=\"" + (lot || company) +
      "\") is not right. It should be 2 to 40 lower-case letters, digits or dashes, as it was given to you.";
    host.appendChild(msg);
    if (window.console) {
      console.error(lot ? "embed.js: data-lot \"" + lot + "\" is not a lot's link name (2 to 40 lower-case letters, digits or dashes)."
        : "embed.js: data-company \"" + company + "\" is not a company id.");
    }
    return;
  }

  /* a shared design link on this page (…#d=…) goes on to the designer */
  function designHash() {
    var h = String(location.hash || "").replace(/^#/, "");
    var d = null, view = false;
    h.split("&").forEach(function (kv) {
      var i = kv.indexOf("="), k = i < 0 ? kv : kv.slice(0, i), v = i < 0 ? "" : kv.slice(i + 1);
      if (k === "d" && /^[A-Za-z0-9_-]{1,20000}$/.test(v)) d = v;
      if (k === "view" && v === "1") view = true;
    });
    return d ? "#d=" + d + (view ? "&view=1" : "") : "";
  }
  function frameUrl() {
    var u = new URL((lot ? "d/" + lot : "c/" + company) + "/", base);
    u.search = "?embed=1";
    return u.href + designHash();
  }

  /* the pieces */
  var fixedH = parseInt(script.getAttribute("data-height"), 10);
  fixedH = isFinite(fixedH) && fixedH > 0 ? Math.max(MIN_H, fixedH) : 0;
  var wrap = css(document.createElement("div"), { position: "relative", width: "100%", maxWidth: "100%", boxSizing: "border-box" });
  wrap.className = "shed-embed";
  var frame = css(document.createElement("iframe"), { display: "block", width: "100%", border: "0", background: "#E9EDF0", borderRadius: "6px" });
  frame.title = "3D shed designer";
  frame.setAttribute("loading", "lazy");
  frame.setAttribute("allow", "fullscreen; clipboard-write; web-share");
  frame.setAttribute("allowfullscreen", "");
  frame.referrerPolicy = "strict-origin-when-cross-origin";
  wrap.appendChild(frame);

  var bar = null, btn = null;
  if (String(script.getAttribute("data-fullscreen") || "").toLowerCase() !== "off") {
    bar = css(document.createElement("div"), { display: "flex", justifyContent: "flex-end", padding: "6px 0 0" });
    btn = css(document.createElement("button"), { font: "600 13px/1 system-ui, -apple-system, sans-serif", color: "#0E3A5F", background: "#fff",
      border: "1px solid rgba(14,58,95,.35)", borderRadius: "7px", padding: "7px 12px", cursor: "pointer" });
    btn.type = "button";
    btn.className = "shed-embed-fullscreen";
    bar.appendChild(btn);
    wrap.appendChild(bar);
  }
  host.appendChild(wrap);
  host.setAttribute("data-shed-state", "waiting");

  /* ---- the height ---- */
  var full = null;                        /* null | "native" | "overlay" */
  function barH() { return bar ? bar.offsetHeight : 0; }
  function size() {
    if (full) { frame.style.height = Math.max(200, (window.innerHeight || 600) - barH()) + "px"; return; }
    var h = fixedH || Math.max(MIN_H, Math.round((wrap.clientWidth || 800) * 3 / 4));
    frame.style.height = h + "px";
  }
  size();
  if (typeof ResizeObserver === "function") new ResizeObserver(function () { size(); }).observe(wrap);
  window.addEventListener("resize", size);

  /* ---- load only when it is about to be seen ---- */
  var loaded = false;
  function load() {
    if (loaded) return;
    loaded = true;
    host.setAttribute("data-shed-state", "loading");
    frame.src = frameUrl();
  }
  if (typeof IntersectionObserver === "function") {
    var io = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) if (entries[i].isIntersecting) { io.disconnect(); load(); return; }
    }, { rootMargin: "300px 0px" });
    io.observe(wrap);
  } else load();

  /* a different design link opened on this page: the designer shows it */
  window.addEventListener("hashchange", function () {
    if (!loaded || !designHash()) return;
    frame.src = frameUrl();
  });

  /* ---- full screen ---- */
  var saved = null;
  function label() {
    if (!btn) return;
    btn.textContent = full ? "✕ Close full screen" : "⤢ Full screen";
    btn.setAttribute("aria-label", full ? "Close full screen" : "Show the designer full screen");
  }
  label();
  /* THE OVERLAY MUST COVER THE WHOLE WINDOW. A "fixed" box normally does --
     but not inside a part of the page that is moved, tilted, filtered or
     "contained" (website builders do that to sections all the time, for their
     animations): there the box is pinned to that section instead, and the
     designer came out a few pixels tall. The frame cannot be moved elsewhere
     in the page (moving a frame reloads it, and the customer's building with
     it), so while the overlay is up those few settings are switched off on
     the boxes around it, and put back exactly as they were on Close. */
  var TRAP = [["transform", "none"], ["translate", "none"], ["rotate", "none"], ["scale", "none"], ["perspective", "none"],
    ["filter", "none"], ["backdrop-filter", "none"], ["-webkit-backdrop-filter", "none"], ["contain", "none"],
    ["container-type", "normal"], ["will-change", "auto"], ["content-visibility", "visible"]];
  var freed = [];
  function freeAncestors() {
    freed = [];
    for (var el = wrap.parentElement; el && el !== document.documentElement; el = el.parentElement) {
      var cs; try { cs = getComputedStyle(el); } catch (e) { continue; }
      for (var i = 0; i < TRAP.length; i++) {
        var prop = TRAP[i][0], neutral = TRAP[i][1], v = cs.getPropertyValue(prop);
        if (!v || v === neutral || (prop === "will-change" && v === "auto")) continue;
        freed.push([el, prop, el.style.getPropertyValue(prop), el.style.getPropertyPriority(prop)]);
        el.style.setProperty(prop, neutral, "important");
      }
    }
  }
  function restoreAncestors() {
    for (var i = freed.length - 1; i >= 0; i--) {
      var f = freed[i];
      if (f[2]) f[0].style.setProperty(f[1], f[2], f[3]); else f[0].style.removeProperty(f[1]);
    }
    freed = [];
  }
  function enterStyles(kind) {
    full = kind;
    saved = { wrap: wrap.getAttribute("style"), html: document.documentElement.style.overflow };
    css(wrap, { background: "#fff", padding: "8px", display: "flex", flexDirection: "column" });
    if (kind === "overlay") {
      freeAncestors();
      css(wrap, { position: "fixed", top: "0", left: "0", right: "0", bottom: "0", width: "auto", height: "auto", maxWidth: "none", zIndex: "2147483000" });
      document.documentElement.style.overflow = "hidden";
    } else css(wrap, { width: "100%", height: "100%" });
    if (bar) css(bar, { padding: "8px 0 0" });
    label(); size();
    host.setAttribute("data-shed-full", kind);
  }
  function leaveStyles() {
    if (!full) return;
    full = null;
    if (saved) { wrap.setAttribute("style", saved.wrap || ""); document.documentElement.style.overflow = saved.html || ""; }
    restoreAncestors();
    if (bar) css(bar, { padding: "6px 0 0" });
    label(); size();
    host.removeAttribute("data-shed-full");
  }
  function nativeEl() { return document.fullscreenElement || document.webkitFullscreenElement || null; }
  function onFsChange() {
    if (full === "native" && nativeEl() !== wrap) leaveStyles();
  }
  /* the browser said no (an older Safari says so with an event, not an
     error): lay it over the page instead */
  function onFsError() {
    if (full === "native" && nativeEl() !== wrap) { leaveStyles(); enterStyles("overlay"); }
  }
  document.addEventListener("fullscreenchange", onFsChange);
  document.addEventListener("webkitfullscreenchange", onFsChange);
  document.addEventListener("fullscreenerror", onFsError);
  document.addEventListener("webkitfullscreenerror", onFsError);
  document.addEventListener("keydown", function (e) { if (full === "overlay" && (e.key === "Escape" || e.key === "Esc")) leaveStyles(); });

  function enter() {
    load();
    var req = wrap.requestFullscreen || wrap.webkitRequestFullscreen;
    var allowed = document.fullscreenEnabled != null ? document.fullscreenEnabled : document.webkitFullscreenEnabled;
    if (!req || allowed === false) { enterStyles("overlay"); return; }
    enterStyles("native");
    var p;
    try { p = req.call(wrap); } catch (e) { leaveStyles(); enterStyles("overlay"); return; }
    if (p && typeof p.then === "function") p.then(null, function () { leaveStyles(); enterStyles("overlay"); });
  }
  function leave() {
    if (full === "native" && nativeEl() === wrap) {
      var ex = document.exitFullscreen || document.webkitExitFullscreen;
      try { var p = ex && ex.call(document); if (p && p.then) p.then(null, leaveStyles); } catch (e) { /* the change event tidies up */ }
      if (!ex) leaveStyles();
    } else leaveStyles();
  }
  if (btn) btn.addEventListener("click", function () { if (full) leave(); else enter(); });

  /* ---- what the designer says ---- */
  window.addEventListener("message", function (e) {
    if (!frame.contentWindow || e.source !== frame.contentWindow) return;   /* only THIS frame */
    if (e.origin !== designerOrigin) return;                                 /* only from the designer's own website */
    var d = e.data;
    if (!d || typeof d !== "object" || typeof d.type !== "string") return;
    if (d.v != null && d.v !== 1) return;
    var name = d.type.replace(/^shed:/, "");
    if (!Object.prototype.hasOwnProperty.call(EVENTS, name)) return;   /* not "constructor", "toString" ... */
    if (name === "ready") host.setAttribute("data-shed-state", "ready");
    fire(host, "shed:" + name, d);
  });

  /* for a page that wants to reach it (and for the checks) */
  var api = { company: company, frame: frame, wrap: wrap, host: host, origin: designerOrigin, load: load,
    fullscreen: function (on) { if (on === false) leave(); else enter(); }, get full() { return full; } };
  (window.ShedDesigner = window.ShedDesigner || { embeds: [] }).embeds.push(api);
})();
