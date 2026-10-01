/* THE QUOTE FORM: HOW A CUSTOMER'S DESIGN REACHES THE COMPANY. Browser file,
   a plugin of the designer page (ui/app.js loads it after the first picture
   and calls install(api) with window.shedUI). It fills #quote-mount, under
   the summary in card 6, "Your quote".

   Managed dealer links save requests through the same-origin backend. Legacy
   company links use the COMPANY'S settings, company.leads.mode:
     none         a showroom: no form at all.
     form         an ordinary web-form post to a form service the company
                  already uses (Formspree, Basin, Web3Forms, Netlify Forms):
                  one plain field each (name, phone, email, zip, address,
                  note, sms_ok, building, total, summary, link, _subject,
                  _replyto) -- the kind of post every such service takes, and
                  the kind a browser sends without asking permission first. It
                  goes into a hidden frame (or a new tab, when leads.target is
                  "tab", for a service that shows its own "are you human?"
                  page); the service answering counts as sent.
     mailto       opens the customer's own e-mail app with the summary and the
                  link to the design in it, addressed to leads.email (else
                  brand.email). Kept under about 1,800 characters (older mail
                  apps cut longer ones): the list of options is shortened
                  first, never the link.
     webhook      POST to leads.url as text/plain (so no permission request
                  goes first) of
                    { design, contact, summary, link, priceComputedBy: "browser",
                      images? }
                  -- images only when leads.images is true: a 2x2 picture of
                  the FRONT, RIGHT, BACK and LEFT (Barnwright's snapImages
                  thumbnail, drawn by engine/snapshot.js) and the floor plan
                  (ui/blueprint.js drawPlanPicture, when that plugin is on the
                  page), together at most 300 KB (smaller and smaller pictures
                  are tried; the plan is dropped before the building). The
                  webhook must answer with a success code, and with the header
                  Access-Control-Allow-Origin, for the page to know it arrived
                  (Zapier, Make, n8n and Pipedream do); otherwise the customer
                  is shown the "reach us directly" box below.
     postMessage  hands the request to the company's own web page the
                  designer is embedded in (embed.js), as a message
                    { type: "shed:quote-requested", v: 1, mode: "postMessage",
                      design, contact, summary, link, priceComputedBy }
                  -- ONLY when that page's address (location.ancestorOrigins,
                  else document.referrer) is on company.embed.origins, and only
                  to that exact address, never to "*". Anywhere else, the
                  customer gets the "reach us directly" box.
   In the other modes, when the designer sits inside an allowed company page,
   that page is told a quote was requested ({type: "shed:quote-requested",
   mode, sent: true, design, link}) WITHOUT the customer's details.

   WHAT IS ASKED: company.leads.fields -- name, phone, email, zip, address,
   note, each "required", "optional" or "off" (not asked). A company with
   leads.smsConsent gets a box with those words, NOT ticked: texting is
   something a customer agrees to, never something assumed. When neither a
   phone nor an e-mail is required, at least one of them is.

   TWO SPEED BUMPS FOR ROBOTS: a box no person can see (a robot filling in
   every box fills that one too), and a minimum time on the page (3 seconds
   from when the form appeared). Either one and nothing is sent. The box is
   hidden with the "hidden" attribute and has a name no phone's AutoFill
   knows, so a real person's phone cannot fill it by accident; and even so
   the person is shown the company's phone number and their design, never a
   dead end.

   THE RESULT IS ALWAYS SHOWN. Sent: "Quote request sent". Not sent (the
   service was down, the webhook broken, no answer in 20 seconds, not inside
   the company's page) -- and ALWAYS after mailto, because the page cannot
   know whether the customer pressed Send -- the customer gets the company's
   phone as Call and Text links, a "Copy my design link" button and the
   summary of their design, so nothing is ever lost.

   The link sent with a quote opens the design LOOK-ONLY (ui/share.js,
   "&view=1") and prices it from the company's price list on the day it is
   opened; the price the customer saw rides along and is compared.
   Every word from the company file or the customer goes through ui/esc.js
   (or .textContent) before it touches the page.

   For the checks: shedUI.quote = { mode, last, lastPost, minMs, timeoutMs
   (can be changed), summary(contact), link(), images(cap) }. */

import { esc, safeUrl } from "./esc.js";
import { submitManagedOrder } from "./managed-order.js";
import { money, priceParts } from "../model/pricing.js";
import { colorName, sidingPalette } from "../model/company.js";
import { frameOf } from "../model/frame.js";
import { makePlan } from "../model/plan.js";
import { assemble } from "../engine/assemble.js";
import { snapshotCanvas } from "../engine/snapshot.js";
import { stageTableFor } from "../engine/renderer.js";
import { keepLink, copyText, contactHtml, today } from "./share.js";

export const MIN_MS = 3000;            /* the least time a person spends before sending */
export const TIMEOUT_MS = 20000;       /* how long a form service or webhook gets to answer */
export const IMAGE_CAP = 300 * 1024;   /* all the pictures together, as sent */
export const MAILTO_MAX = 1800;        /* the whole mail link */
const HONEYPOT = "leave_this_empty";

/* the boxes, in Barnwright's order (name, phone, ZIP, email) and then the new ones */
export const FIELDS = [
  { key: "name", words: "your name", ph: "Your name", auto: "name", type: "text", max: 100 },
  { key: "phone", words: "your phone number", ph: "Phone", auto: "tel", type: "tel", mode: "tel", max: 40 },
  { key: "zip", words: "your ZIP code", ph: "ZIP", auto: "postal-code", type: "text", mode: "numeric", max: 12, cls: "qzip" },
  { key: "email", words: "your e-mail address", ph: "Email", auto: "email", type: "email", mode: "email", max: 200, cls: "qwide" },
  { key: "address", words: "where the building will go", ph: "Where it will go (street address)", auto: "street-address", type: "text", max: 300, cls: "qwide" },
  { key: "note", words: "a note", ph: "Anything else we should know?", type: "textarea", max: 1000, cls: "qwide" },
];
const LABEL = { name: "Name", phone: "Phone", zip: "ZIP", email: "E-mail", address: "Address", note: "Note" };
const EMAIL_RE = /^[^\s@<>"',;:?&]+@[^\s@<>"',;:?&]+\.[^\s@<>"',;:?&]+$/;   /* an address put INTO a mail link: strict */
/* the customer's own address, only ever sent as data: looser, because real
   addresses have apostrophes in them (o'brien@...) and must not be turned away */
const CUSTOMER_EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]+$/;

function andList(a) { return a.length < 2 ? (a[0] || "") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1]; }
function asked(cat, key) { const m = (cat.leads.fields || {})[key]; return m === "required" || m === "optional"; }
function required(cat, key) { return (cat.leads.fields || {})[key] === "required"; }

/* ------------------------------------------------------------------------
   The summary: Barnwright's summaryText (3ddesign.html 5312-5327) -- the
   company's name, the size and style, the colours, the porch, every priced
   line, the total -- then the customer's details and the link.
   opts.short: 1 leaves out the option lines (the link has them), 2 also the
   colours and porch, 3 also the address and note. */
export function summaryText(state, cat, contact, link, opts) {
  const short = (opts && opts.short) || 0;
  const t = cat.TYPES[state.type] || {};
  const fr = frameOf(state, cat);
  const pp = priceParts(state, cat, fr);
  const show = cat.pricing.show !== "none";
  const L = [];
  L.push(String(cat.brand.name || "Shed").toUpperCase() + " QUOTE REQUEST");
  L.push(String(state.size).replace("x", " x ") + " " + (t.name || state.type));
  if (short < 2) {
    L.push((t.metal ? "Metal " : "Siding ") + colorName(sidingPalette(t, cat.COLORS), state.body) +
      " / Trim " + colorName(cat.COLORS.trim, state.trim) + " / Roof " + colorName(cat.COLORS.metal, state.roof));
    if (t.porch === "S" && fr.span) L.push("Porch 4x" + fr.span.P + " — " + (state.pMid ? "middle" : (state.pFlip ? "right" : "left")) + " end");
  }
  if (short < 1) pp.lines.forEach((l) => L.push(l[0] + (show ? " " + money(l[1]) : "")));
  else if (pp.lines.length) L.push("+ " + pp.lines.length + " option" + (pp.lines.length > 1 ? "s" : "") + " (all in the link below)");
  if (show) L.push("Estimated total: " + money(pp.total));
  const c = contact || {};
  for (const f of FIELDS) {
    if (short >= 3 && (f.key === "address" || f.key === "note")) continue;
    const v = String(c[f.key] == null ? "" : c[f.key]).trim();
    if (v) L.push(LABEL[f.key] + ": " + v.replace(/\s*\n\s*/g, " / "));
  }
  if (typeof c.smsOk === "boolean") L.push("OK to text: " + (c.smsOk ? "yes" : "no"));
  if (link) L.push("See it in 3D: " + link);
  return L.join("\n");
}

export function mailHref(to, subject, body) {
  const a = String(to || "").trim();
  if (!EMAIL_RE.test(a)) return "";
  return "mailto:" + a + "?subject=" + encodeURIComponent(subject || "") + "&body=" + encodeURIComponent(body || "");
}

/* the mail link, as long as it may be: shortened a step at a time */
export function fitMailto(to, subject, bodies) {
  let h = "";
  for (const b of bodies) { h = mailHref(to, subject, b); if (h && h.length <= MAILTO_MAX) return h; }
  return h;
}

/* ------------------------------------------------------------------------
   The pictures (webhook, leads.images: true). */

const ANGLES = [[0, 0.20], [Math.PI / 2, 0.20], [Math.PI, 0.20], [-Math.PI / 2, 0.20]];
const ANGLE_WORDS = ["FRONT", "RIGHT", "BACK", "LEFT"];

/* the renderer's step table back into the form setStages takes */
function tableBack(f32) {
  const out = [];
  for (let i = 0; i + 1 < f32.length; i += 4) out.push([f32[i] > 0.5, f32[i + 1] || 0]);
  return out;
}

/* Front, right, back and left in one 2x2 picture, as Barnwright's quote
   thumbnail -- of the FINISHED building (whatever view is on screen), with
   nothing selected, and without moving the camera on screen. */
function viewCanvas(api, maxTile) {
  const r = api.renderer;
  if (!r || r.off) return null;
  const cv = api.canvas;
  let w = cv.clientWidth || 600, h = cv.clientHeight || 420;
  if (w < 2) w = 600; if (h < 2) h = 420;
  const k = Math.min(1, maxTile / w, maxTile / h);
  w = Math.max(40, Math.round(w * k)); h = Math.max(40, Math.round(h * k));
  const st = structuredClone(api.getState()); st.sel = null;
  const o = { viewport: { w: w, h: h }, fit: "fitref", frames: false };
  const bo = api.getBuildOptions ? api.getBuildOptions() : {};
  if (bo && bo.scene) o.scene = bo.scene;
  const res = assemble(makePlan(st, api.getCatalogue()), o);
  const off = document.createElement("canvas");
  off.width = w * 2; off.height = h * 2;
  const x = off.getContext("2d");
  const f = (r.scene && r.scene.fogC) || [0.93, 0.93, 0.92];
  x.fillStyle = "rgb(" + Math.round(f[0] * 255) + "," + Math.round(f[1] * 255) + "," + Math.round(f[2] * 255) + ")";
  x.fillRect(0, 0, off.width, off.height);
  const pos = [[0, 0], [w, 0], [0, h], [w, h]];
  const saved = r.stageTable;
  try {
    r.setStages(stageTableFor("finished"));
    for (let i = 0; i < ANGLES.length; i++) {
      const c = snapshotCanvas(r, { result: res, size: { w: w, h: h }, dpr: 1, cam: { yaw: ANGLES[i][0], pitch: ANGLES[i][1] }, restore: false });
      x.drawImage(c, pos[i][0], pos[i][1], w, h);
      x.fillStyle = "rgba(14,58,95,.9)"; x.fillRect(pos[i][0] + 6, pos[i][1] + 6, 60, 19);
      x.fillStyle = "#F4EFE4"; x.font = "600 12px Oswald, IBM Plex Sans, sans-serif";
      x.textBaseline = "middle"; x.textAlign = "left"; x.fillText(ANGLE_WORDS[i], pos[i][0] + 12, pos[i][1] + 16);
    }
  } finally {
    r.setStages(tableBack(saved));
    r.needsDraw = true;
    try { r.draw(); } catch (e) { /* the loop draws it next */ }
  }
  return off;
}

async function planCanvas(api, w, h) {
  const cat = api.getCatalogue();
  if (!api.plugins || api.plugins.blueprint !== true) return null;
  if (cat.features && cat.features.floorPlan === false) return null;
  let mod;
  try { mod = await import("./blueprint.js"); } catch (e) { return null; }
  if (!mod || typeof mod.drawPlanPicture !== "function") return null;
  try {
    const st = structuredClone(api.getState()); st.sel = null;
    return mod.drawPlanPicture(st, cat, w, h, {});
  } catch (e) { console.error("The floor plan picture could not be drawn:", e); return null; }
}

/* -> { images: {view, plan} | null, bytes, steps } -- at most `cap` characters
   of pictures (a data: address is what is sent, so that is what is counted). */
export async function leadImages(api, cap) {
  cap = cap || IMAGE_CAP;
  const tiles = {}, plans = {};
  const tries = [
    { tile: 480, q: 0.84, plan: "png" }, { tile: 480, q: 0.84, plan: "jpeg" }, { tile: 420, q: 0.72, plan: "jpeg" },
    { tile: 340, q: 0.62, plan: "jpeg" }, { tile: 340, q: 0.62, plan: null }, { tile: 260, q: 0.5, plan: null },
  ];
  let n = 0;
  for (const t of tries) {
    n++;
    let view = "", plan = "";
    try {
      if (!(t.tile in tiles)) tiles[t.tile] = viewCanvas(api, t.tile);
      if (tiles[t.tile]) view = tiles[t.tile].toDataURL("image/jpeg", t.q);
    } catch (e) { console.error("The pictures of the building could not be taken:", e); tiles[t.tile] = null; }
    if (t.plan) {
      const pw = t.tile >= 420 ? 640 : 480, ph = Math.round(pw * 0.7);
      const pk = pw + "x" + ph;
      if (!(pk in plans)) plans[pk] = await planCanvas(api, pw, ph);
      if (plans[pk]) plan = t.plan === "png" ? plans[pk].toDataURL("image/png") : plans[pk].toDataURL("image/jpeg", 0.8);
    }
    const bytes = view.length + plan.length;
    if (!bytes) return { images: null, bytes: 0, steps: n };
    if (bytes <= cap) {
      const images = {};
      if (view) images.view = view;
      if (plan) images.plan = plan;
      return { images: images, bytes: bytes, steps: n };
    }
  }
  return { images: null, bytes: 0, steps: n };
}

/* ------------------------------------------------------------------------
   Sending. */

let seq = 0;
function postForm(url, fields, target, timeoutMs) {
  const name = "shedq" + (++seq) + "x" + Date.now();
  const form = document.createElement("form");
  form.method = "POST"; form.action = url; form.acceptCharset = "UTF-8";
  form.style.display = "none"; form.setAttribute("aria-hidden", "true");
  Object.keys(fields).forEach((k) => {
    const i = document.createElement("input");
    i.type = "hidden"; i.name = k; i.value = fields[k] == null ? "" : String(fields[k]);
    form.appendChild(i);
  });
  if (target === "tab") {
    form.target = "_blank";
    document.body.appendChild(form);
    form.submit(); form.remove();
    return Promise.resolve({ ok: true, how: "tab" });
  }
  const frame = document.createElement("iframe");
  frame.name = name; frame.title = "Sending your quote request"; frame.hidden = true;
  frame.style.display = "none"; frame.setAttribute("aria-hidden", "true"); frame.tabIndex = -1;
  document.body.appendChild(frame);
  form.target = name;
  document.body.appendChild(form);
  return new Promise((resolve) => {
    let done = false;
    const finish = (r) => {
      if (done) return; done = true; clearTimeout(tm);
      form.remove(); setTimeout(() => frame.remove(), 50);
      resolve(r);
    };
    const tm = setTimeout(() => finish({ ok: false, why: "the form service did not answer" }), timeoutMs);
    frame.addEventListener("load", () => {
      let blank = false;
      try { blank = frame.contentWindow.location.href === "about:blank"; } catch (e) { blank = false; }
      if (!blank) finish({ ok: true, how: "frame" });       /* the service's own page came back */
    });
    try { form.submit(); } catch (e) { finish({ ok: false, why: "the form could not be sent" }); }
  });
}

async function postHook(url, payload, timeoutMs) {
  const ctl = typeof AbortController === "function" ? new AbortController() : null;
  const tm = setTimeout(() => { if (ctl) ctl.abort(); }, timeoutMs);
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=UTF-8" },   /* a "simple" request: no preflight */
      body: JSON.stringify(payload),
      credentials: "omit",
      signal: ctl ? ctl.signal : undefined,
    });
    if (!r.ok) return { ok: false, why: "the webhook answered " + r.status };
    return { ok: true, how: "webhook" };
  } catch (e) {
    return { ok: false, why: e && e.name === "AbortError" ? "the webhook did not answer in time" : "the webhook could not be reached" };
  } finally { clearTimeout(tm); }
}

/* the address of the page this designer is inside, or "" */
export function parentOrigin() {
  try { if (window.parent === window) return ""; } catch (e) { return ""; }
  try { if (location.ancestorOrigins && location.ancestorOrigins.length) return String(location.ancestorOrigins[0]); } catch (e) { /* not in this browser */ }
  try { return document.referrer ? new URL(document.referrer).origin : ""; } catch (e) { return ""; }
}

/* ------------------------------------------------------------------------
   The plugin. */

let cssAdded = false;
function addCss() {
  if (cssAdded || typeof document === "undefined") return;
  cssAdded = true;
  if (document.querySelector("link[data-quote-css]")) return;
  const l = document.createElement("link");
  l.rel = "stylesheet"; l.href = new URL("./quote.css", import.meta.url).href;
  l.setAttribute("data-quote-css", "");
  document.head.appendChild(l);
}

function formHtml(cat) {
  const L = cat.leads;
  let h = '<form class="qform" novalidate autocomplete="on"><div class="qgrid">';
  for (const f of FIELDS) {
    if (!asked(cat, f.key)) continue;
    const req = required(cat, f.key);
    const ph = f.ph + (req ? "" : " (optional)");
    const common = ' name="' + f.key + '" class="qin' + (f.cls ? " " + f.cls : "") + '" aria-label="' + esc(f.ph) + '"' +
      ' placeholder="' + esc(ph) + '" maxlength="' + f.max + '"' + (f.auto ? ' autocomplete="' + f.auto + '"' : "") +
      (f.mode ? ' inputmode="' + f.mode + '"' : "") + (req ? ' aria-required="true"' : "");
    h += f.type === "textarea" ? "<textarea rows=\"2\"" + common + "></textarea>" : '<input type="' + f.type + '"' + common + ">";
  }
  h += "</div>";
  if (typeof L.smsConsent === "string" && L.smsConsent.trim()) {
    h += '<label class="smsok qsms"><input type="checkbox" name="sms_ok" value="yes"><span>' + esc(L.smsConsent.trim()) + "</span></label>";
  }
  /* the robots' box: no person sees it, and no AutoFill knows its name */
  h += '<div class="qhp" hidden aria-hidden="true"><label>Leave this box empty <input type="text" name="' + HONEYPOT + '" tabindex="-1" autocomplete="off"></label></div>';
  h += '<p class="qreq"></p>';
  h += '<button class="bigbtn qsend" type="submit">' + (L.mode === "mailto" ? "E-mail my quote request" : "Request my quote") + "</button>";
  h += '<div class="qresult" role="status" aria-live="polite"></div></form>';
  return h;
}

export function install(api) {
  const cat = api.getCatalogue();
  const L = cat.leads || {};
  const mode = L.mode || "none";
  const mount = (api.mounts && api.mounts.quote) || document.getElementById("quote-mount");
  const state = {
    last: null, lastPost: null, minMs: MIN_MS, timeoutMs: TIMEOUT_MS, busy: false,
  };
  let keeper = null;                                /* the link, kept ready (below) */
  api.quote = {
    mode: mode,
    get last() { return state.last; },
    get lastPost() { return state.lastPost; },
    get minMs() { return state.minMs; },
    get timeoutMs() { return state.timeoutMs; },
    set timeoutMs(v) { if (v > 0) state.timeoutMs = +v; },
    summary: (contact) => summaryText(api.getState(), cat, contact || null, keeper ? keeper.now() : ""),
    link: () => (keeper ? keeper.get() : Promise.resolve("")),
    images: (cap) => leadImages(api, cap),
  };
  if (mode === "none" || !mount) return;            /* a showroom */
  addCss();

  keeper = keepLink(api, { view: true });
  const who = cat.brand.name || "the company";
  const canReach = !!contactHtml(cat, {});         /* the company has a phone or an e-mail to show */
  const shownAt = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
  const since = () => ((typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now()) - shownAt;

  mount.innerHTML = formHtml(cat);
  const form = mount.querySelector(".qform");
  const btn = form.querySelector(".qsend");
  const res = form.querySelector(".qresult");
  const btnWords = btn.textContent;

  /* what has to be filled in, said once under the boxes */
  const needWords = FIELDS.filter((f) => required(cat, f.key)).map((f) => f.words);
  const phoneOrMail = !required(cat, "phone") && !required(cat, "email") && (asked(cat, "phone") || asked(cat, "email"));
  form.querySelector(".qreq").textContent = needWords.length
    ? "We need " + andList(needWords) + " so " + who + " can get back to you with the exact price."
    : phoneOrMail ? "Leave a phone number or an e-mail address so " + who + " can get back to you." : "";

  const box = (k) => form.querySelector('[name="' + k + '"]');
  function readContact() {
    const c = {};
    for (const f of FIELDS) {
      if (!asked(cat, f.key)) continue;
      const el = box(f.key);
      c[f.key] = el ? String(el.value || "").trim().slice(0, f.max) : "";
    }
    const sms = box("sms_ok");
    if (sms) c.smsOk = !!sms.checked;
    return c;
  }

  function clearMarks() {
    Array.prototype.forEach.call(form.querySelectorAll(".qin"), (el) => { el.classList.remove("qbad"); el.removeAttribute("aria-invalid"); });
  }
  function check(c) {
    clearMarks();
    const bad = [], words = [];
    const missing = FIELDS.filter((f) => required(cat, f.key) && !c[f.key]);
    if (missing.length) { missing.forEach((f) => bad.push(f.key)); words.push("Please add " + andList(missing.map((f) => f.words)) + " so " + who + " can reach you."); }
    if (phoneOrMail && !c.phone && !c.email) {
      if (asked(cat, "phone")) bad.push("phone"); if (asked(cat, "email")) bad.push("email");
      words.push("Please add a phone number or an e-mail address so " + who + " can reach you.");
    }
    if (c.phone && c.phone.replace(/[^0-9]/g, "").length < 7) { bad.push("phone"); words.push("Please check your phone number — it looks too short."); }
    if (c.email && !CUSTOMER_EMAIL_RE.test(c.email)) { bad.push("email"); words.push("Please check your e-mail address — it doesn't look complete."); }
    if (c.zip && !/[0-9A-Za-z]{3}/.test(c.zip)) { bad.push("zip"); words.push("Please check your ZIP code."); }
    bad.forEach((k) => { const el = box(k); if (el) { el.classList.add("qbad"); el.setAttribute("aria-invalid", "true"); } });
    if (bad.length) { const el = box(bad[0]); if (el) { try { el.focus(); } catch (e) { /* ignore */ } } }
    return words;
  }

  function contactLinks(link, summary) {
    return contactHtml(cat, {
      sms: "Hi " + who + ", I'd like a quote on the shed I designed: " + link,
      subject: "Quote request: " + String(api.getState().size).replace("x", " x ") + " " + ((cat.TYPES[api.getState().type] || {}).name || ""),
      mail: summary,
    });
  }

  /* the "reach us directly" box: Call / Text, copy the link, the summary */
  function fallback(link, summary) {
    const h = '<div class="qfallback">' + contactLinks(link, shortMailBody(summary, link)) +
      '<div class="qcopyrow"><button type="button" class="copybtn qcopy">Copy my design link</button><span class="qcopymsg" aria-live="polite"></span></div>' +
      '<input class="qlinkbox" type="text" readonly hidden aria-label="The link to your design">' +
      '<div class="qsumhead">Your design</div><pre class="qsumtext"></pre></div>';
    return h;
  }
  function wireFallback(link, summary) {
    const pre = res.querySelector(".qsumtext"); if (pre) pre.textContent = summary;
    const cb = res.querySelector(".qcopy"), msg = res.querySelector(".qcopymsg"), lb = res.querySelector(".qlinkbox");
    if (cb) cb.addEventListener("click", () => {
      copyText(link).then((ok) => {
        cb.textContent = ok ? "Copied ✓" : "Copy my design link";
        msg.textContent = ok ? "Paste it into a text or an e-mail to " + who + "." : "Copying is blocked here — press and hold the link below to copy it.";
        if (!ok && lb) { lb.hidden = false; lb.value = link; try { lb.focus(); lb.select(); } catch (e) { /* ignore */ } }
      });
    });
  }
  /* a shorter body for a mail link in the fallback box */
  function shortMailBody(summary, link) { return summary.length + link.length < 1200 ? summary : "My shed design: " + link; }

  function again(label) {
    return '<button type="button" class="copybtn qagain">' + esc(label) + "</button>";
  }
  function wireAgain() {
    const a = res.querySelector(".qagain");
    if (a) a.addEventListener("click", () => { res.innerHTML = ""; btn.hidden = false; btn.disabled = false; btn.textContent = btnWords; });
  }

  function showSent(c, how) {
    const first = String(c.name || "").trim().split(/\s+/)[0] || "";
    const reach = c.phone ? " at " + c.phone : c.email ? " at " + c.email : "";
    const p = how === "tab"
      ? "Your request opened in a new tab" + (first ? ", " + first : "") + ". If it asks you anything there, finish it and " + who + " will have your design."
      : (first ? "Thanks, " + first + "! " : "Thanks! ") + who + " has your design and will get back to you" + reach + " with the exact price.";
    res.innerHTML = '<div class="sent"><div class="disp">✓ Quote request sent</div><p class="qsentwords"></p></div>' + again("Changed something? Send it again");
    res.querySelector(".qsentwords").textContent = p;
    btn.hidden = true;
    wireAgain();
  }
  function showFailed(link, summary, why) {
    res.innerHTML = '<div class="qerr"><b>We couldn’t send your request just now.</b> Nothing is lost — ' + (canReach ? "reach " + esc(who) + " directly below" : "copy the link to your design below and send it to " + esc(who)) + ", or try again in a minute.</div>" + fallback(link, summary);
    wireFallback(link, summary);
    btn.hidden = false; btn.disabled = false; btn.textContent = "Try again";
    if (why) {
      res.querySelector(".qerr").setAttribute("data-why", why);
      if (cat.managed) { const detail = document.createElement("p"); detail.textContent = why; res.querySelector(".qerr").appendChild(detail); }
    }
  }
  function showMailto(href, link, summary) {
    res.innerHTML = '<div class="qok"><b>Your e-mail app should have opened</b> with your design in it — press Send there to reach ' + esc(who) + ". " +
      (href ? '<a class="qmailagain" href="' + esc(href) + '">Open the e-mail again</a>' : "") + "</div>" + fallback(link, summary) + again("Start again");
    wireFallback(link, summary);
    btn.hidden = true;
    wireAgain();
  }

  function record(r) { state.last = Object.assign({ mode: mode, at: Date.now() }, r); return state.last; }

  function tellParent(msg, withContact) {
    const po = parentOrigin();
    if (!po || po === "null" || (cat.embed.origins || []).indexOf(po) < 0) return false;
    if (!withContact) { delete msg.contact; delete msg.summary; }
    try {
      window.parent.postMessage(JSON.parse(JSON.stringify(msg)), po);    /* to that page only -- never "*" */
      state.lastPost = { origin: po, type: msg.type, withContact: !!withContact };
      return true;
    } catch (e) { console.error("The quote could not be handed to the page:", e); return false; }
  }

  async function submit() {
    if (state.busy) return;
    clearMarks();
    const c = readContact();
    const trap = box(HONEYPOT);
    const now = keeper.now();                        /* ready inside the tap (mailto needs that) */

    /* a robot filled the box nobody can see: nothing is sent, and the
       person (if it was one) still gets the way to reach the company */
    if (trap && String(trap.value || "").trim()) {
      const link = now || await keeper.get();
      const summary = summaryText(api.getState(), cat, c, link);
      res.innerHTML = '<div class="qerr">We couldn’t send this one automatically. Please ' + (canReach ? "reach " + esc(who) + " directly:" : "copy the link to your design below and send it to " + esc(who) + ".") + "</div>" + fallback(link, summary);
      wireFallback(link, summary);
      return record({ status: "dropped", why: "honeypot" });
    }
    const problems = check(c);
    if (problems.length) {
      res.innerHTML = '<div class="errbox qneed"></div>';
      res.querySelector(".qneed").textContent = problems.join(" ");
      return record({ status: "invalid", why: problems.join(" ") });
    }
    if (since() < state.minMs) {
      res.innerHTML = '<div class="qerr qslow">Just a moment — please check your details, then tap “' + esc(btnWords) + '” again.</div>';
      return record({ status: "dropped", why: "too-fast" });
    }

    state.busy = true;
    btn.disabled = true; btn.textContent = "Sending…";
    res.innerHTML = "";
    let link = now, summary = "", out = null;
    try {
      if (mode === "mailto") {
        /* inside the tap: the e-mail app may only be opened from it */
        if (!link) link = await keeper.get();
        summary = summaryText(api.getState(), cat, c, link);
        const title = String(api.getState().size).replace("x", " x ") + " " + ((cat.TYPES[api.getState().type] || {}).name || "");
        const bodies = [0, 1, 2, 3].map((s) => summaryText(api.getState(), cat, c, link, { short: s }));
        bodies.push("Quote request\n" + (c.name ? c.name + "\n" : "") + (c.phone ? c.phone + "\n" : "") + "See it in 3D: " + link);
        const href = fitMailto(L.email || cat.brand.email, "Quote request: " + title, bodies);
        if (href) {
          const a = document.createElement("a");
          a.href = href; a.style.display = "none"; a.rel = "noopener";
          document.body.appendChild(a);
          try { a.click(); } catch (e) { /* the link on screen still works */ }
          a.remove();
        }
        if (!href) {                                 /* no usable address in the settings */
          showFailed(link, summary, "no e-mail address to send it to");
          return (out = record({ status: "failed", why: "no e-mail address to send it to" }));
        }
        showMailto(href, link, summary);
        out = record({ status: "opened", why: "", href: href, length: href.length });
        tellParent({ type: "shed:quote-requested", v: 1, mode: mode, sent: true, design: api.getDesign({ priced: true, at: today() }), link: link }, false);
        return out;
      }

      if (!link) link = await keeper.get();
      summary = summaryText(api.getState(), cat, c, link);
      const design = api.getDesign({ priced: true, at: today() });   /* the customer's own day */
      let r;
      if (mode === "managed" && cat.managed) {
        r = await submitManagedOrder(cat.managed, design, c, state.timeoutMs);
      } else if (mode === "form") {
        const pp = api.price();
        const t = cat.TYPES[api.getState().type] || {};
        const fields = {};
        for (const f of FIELDS) if (asked(cat, f.key)) fields[f.key] = c[f.key] || "";
        if (typeof c.smsOk === "boolean") fields.sms_ok = c.smsOk ? "yes" : "no";
        fields.building = String(api.getState().size).replace("x", " x ") + " " + (t.name || "");
        fields.total = cat.pricing.show === "none" ? "" : money(pp.total);
        fields.summary = summary;
        fields.link = link;
        fields._subject = "Quote request: " + fields.building + (c.name ? " — " + c.name : "");
        if (c.email) fields._replyto = c.email;
        const url = safeUrl(L.url, { mail: false });
        r = /^https?:/i.test(url) ? await postForm(url, fields, L.target, state.timeoutMs) : { ok: false, why: "no form address" };
      } else if (mode === "webhook") {
        const payload = { design: design, contact: c, summary: summary, link: link, priceComputedBy: "browser" };
        let pics = null;
        if (L.images === true) {
          try { pics = await leadImages(api); } catch (e) { console.error("The pictures could not be made:", e); pics = null; }
          if (pics && pics.images) payload.images = pics.images;
        }
        const url = safeUrl(L.url, { mail: false });
        r = /^https?:/i.test(url) ? await postHook(url, payload, state.timeoutMs) : { ok: false, why: "no webhook address" };
        if (pics) r.imageBytes = pics.bytes;
      } else if (mode === "postMessage") {
        const sent = tellParent({ type: "shed:quote-requested", v: 1, mode: mode, design: design, contact: c, summary: summary, link: link, priceComputedBy: "browser" }, true);
        r = sent ? { ok: true, how: "postMessage" } : { ok: false, why: "this designer is not inside " + who + "'s own website" };
      } else {
        r = { ok: false, why: "unknown leads mode " + mode };
      }
      if (r.ok) {
        showSent(c, r.how);
        if (r.receipt) {
          const receipt = document.createElement("p");
          receipt.textContent = `Request ${r.receipt.id} · Saved to your dealer's inbox.`;
          res.querySelector(".sent").appendChild(receipt);
        }
        if (mode !== "postMessage") tellParent({ type: "shed:quote-requested", v: 1, mode: mode, sent: true, design: design, link: link }, false);
        out = record(Object.assign({ status: "sent" }, r));
      } else {
        showFailed(link, summary, r.why);
        out = record(Object.assign({ status: "failed" }, r));
      }
      return out;
    } catch (e) {
      console.error("The quote request could not be sent:", e);
      const lk = link || "";
      showFailed(lk, summary || summaryText(api.getState(), cat, c, lk), "a fault in the page");
      return record({ status: "failed", why: String(e && e.message || e) });
    } finally {
      state.busy = false;
      if (!btn.hidden && btn.textContent === "Sending…") { btn.disabled = false; btn.textContent = btnWords; }
      try { res.scrollIntoView({ block: "nearest" }); } catch (e) { /* ignore */ }
    }
  }

  form.addEventListener("submit", (e) => { e.preventDefault(); submit(); });
  api.quote.submit = submit;
}

export default install;
