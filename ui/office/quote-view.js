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
