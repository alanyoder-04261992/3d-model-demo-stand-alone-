import { encodeSync } from "../../model/design.js";

/* Both the customer card and printed sheet open the server's trusted
   original quote. The designer reads its saved design rather than using
   today's public price list or trusting an edited link hash. */
export function originalQuoteUrl(designerUrl, customerId, quoteId, design) {
  const url = new URL(designerUrl, location.origin);
  url.searchParams.set("saved-quote", `${customerId}/${quoteId}`);
  url.searchParams.set("view", "1");
  url.hash = `d=${encodeSync(design)}&view=1`;
  return url.href;
}

/* A quote saved before quotes kept their own copy of the price list (no
   snapshot) has no original to open, so it opens the way every quote did
   then: the lot's 3D designer with the saved design, priced and named from
   today's price list (DIFFERENCES #14). */
export function quoteViewUrl(designerUrl, customerId, quote) {
  if (quote.snapshot) return originalQuoteUrl(designerUrl, customerId, quote.id, quote.design);
  const url = new URL(designerUrl, location.origin);
  url.hash = `d=${encodeSync(quote.design)}&view=1`;
  return url.href;
}
