/* THE PAGES' SECURITY POLICIES -- shared by the build, the Netlify
   function and the local Office, so all three send exactly the same.

   The Office (/office): only this site's own scripts, styles, fonts and
   data; never shown inside another website's frame. It may show this site's
   own lot designer in a frame (to design a building for a customer).

   A lot's designer (/d/<lot>/): the designer's own scripts (plus the hashes
   of its few inline scripts), shown in a frame only by this site and the
   lot's own websites. */

export const OFFICE_POLICY = [
  "default-src 'self'", "script-src 'self'", "style-src 'self'", "img-src 'self' data: blob: https:",
  "font-src 'self'", "connect-src 'self'", "frame-src 'self'", "frame-ancestors 'none'",
  "base-uri 'self'", "form-action 'self'", "object-src 'none'",
].join("; ");

export function lotDesignerPolicy(hashes, origins) {
  /* only exact https sites (or this site); never a wildcard, path or policy text */
  const allowed = origins.filter((s) => /^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(s));
  return [
    "default-src 'self'", `script-src 'self' ${hashes.join(" ")}`, "style-src 'self' 'unsafe-inline'",
    "font-src 'self'", "img-src 'self' data: blob: https:", "connect-src 'self' data: blob:",
    "worker-src 'self' blob:", "form-action 'self'", "object-src 'none'", "base-uri 'self'",
    `frame-ancestors 'self' ${allowed.join(" ")}`.trim(),
  ].join("; ");
}

export function lotDesignerPage({ html, hashes, origins, head = false }) {
  return new Response(head ? null : html, { headers: {
    "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store",
    "Content-Security-Policy": lotDesignerPolicy(hashes, origins),
    "X-Content-Type-Options": "nosniff", "Referrer-Policy": "strict-origin-when-cross-origin",
  } });
}

/* call: {name, phone} from website.js publicLot -- who to call while the
   link is closed (every word escaped: the owner typed them). */
export function closedPage(status, call = null) {
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const dial = call?.phone ? String(call.phone).replace(/[^\d+]/g, "") : "";
  const words = status === 404
    ? ["This designer link isn't open right now.", dial
      ? `Please call ${esc(call.name || "us")} at <a href="tel:${dial}">${esc(call.phone)}</a>, or check back soon.`
      : "Please call the lot, or check back soon."]
    : ["The designer couldn't load just now.", "Please try again in a minute."];
  const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${words[0]}</title><link rel="stylesheet" href="/ui/office/closed.css"></head><body><main><h1>${words[0]}</h1><p>${words[1]}</p></main></body></html>`;
  return new Response(page, { status: status === 404 ? 404 : 503, headers: {
    "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store",
    "Content-Security-Policy": "default-src 'none'; style-src 'self'; frame-ancestors *",
    "X-Content-Type-Options": "nosniff",
  } });
}
