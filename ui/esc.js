/* EVERY WORD FROM A SETTINGS FILE, A SHARED LINK OR A CUSTOMER GOES THROUGH
   HERE BEFORE IT TOUCHES THE PAGE. Node-safe (no DOM).

   A company's name, a style they renamed, a colour name, an extra they added,
   the fine print, a saved design's warning -- all of it is text somebody
   typed, and none of it may ever be read by the browser as HTML. A company
   called <script>...</script> must show those characters on the screen, not
   run them. Barnwright escaped some of its view page (& < > " only, and not
   everywhere); this designer escapes everything, always (docs/DIFFERENCES.md
   #15).

     esc(v)          text -> safe to put between tags or inside a quoted
                     attribute: & < > " ' ` are all turned into entities.
                     null / undefined become "".
     safeUrl(v, o)   a web address from a settings file -> the address, or ""
                     when it is not one a link or a picture may point at.
                     Allowed: https:, http:, mailto:, tel: (o.tel), and a
                     relative path. Never javascript:, data: (unless
                     o.image and it is a data:image/png|jpeg|gif|webp) or
                     anything else. Spaces and control characters inside the
                     scheme (the old "java\tscript:" trick) count as unsafe.
     telHref(phone)  "(555) 010-0142" -> "tel:5550100142" (digits and a
                     leading + only), or "" when there are no digits.

   Rule for the rest of ui/: build HTML only from esc()'d pieces, or set
   .textContent. Never put a settings string into innerHTML raw. */

const ENT = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;", "`": "&#96;" };

export function esc(v) {
  return String(v == null ? "" : v).replace(/[&<>"'`]/g, (c) => ENT[c]);
}

export function safeUrl(v, o) {
  o = o || {};
  const s = String(v == null ? "" : v).trim();
  if (!s) return "";
  /* anything with a control character or a raw space before the first ":" is
     refused outright: browsers strip those and read the scheme anyway */
  const colon = s.indexOf(":");
  const head = colon < 0 ? s : s.slice(0, colon);
  if (/[\u0000- \u007f-\u009f]/.test(head)) return "";
  if (colon < 0 || /[\/?#]/.test(head)) {
    /* no scheme: a relative path ("images/logo.png", "/logo.png", "./x") */
    if (/^\/\//.test(s)) return "";                  /* "//evil.com" is another site */
    return s;
  }
  const scheme = head.toLowerCase();
  if (scheme === "https" || scheme === "http") return s;
  if (scheme === "mailto" && o.mail !== false) return s;
  if (scheme === "tel" && o.tel) return s;
  if (scheme === "data" && o.image && /^data:image\/(png|jpeg|gif|webp);/i.test(s)) return s;
  return "";
}

export function telHref(phone) {
  const s = String(phone == null ? "" : phone).trim();
  const digits = s.replace(/[^0-9]/g, "");
  if (!digits) return "";
  return "tel:" + (s[0] === "+" ? "+" : "") + digits;
}
