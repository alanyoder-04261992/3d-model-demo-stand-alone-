/* WHAT THE CUSTOMER WANTS TO DO WITH A QUOTE (the Yoder site; Alan, Sep 17
   2026: "in the Submit for quote can you add a multiple choice part that ask
   what they want to do with this quote"). The difference between these four
   is the difference between a sale this week and somebody dreaming on a lunch
   break, and it costs the customer one tap to say which. Never required: a
   building sent without an answer beats a building nobody sent.

   Node-safe. The quote form (ui/quote.js) shows these words and the Dealer
   Center (server/office/website.js, customers.js) writes them on the
   customer, so both read them from here. A company turns the question off
   with leads.askPlan: false. */

export const QUOTE_PLANS = Object.freeze([
  Object.freeze(["buy-now", "Ready to buy now — no permit needed"]),
  Object.freeze(["buy-permit", "Ready to buy now — I need paperwork for permits"]),
  Object.freeze(["engineering", "I need engineering plans for permits first"]),
  Object.freeze(["pricing", "Just seeing what my dream building would cost"]),
]);

/* the words for an answer's key, "" for no answer or one we don't know */
export function planWords(key) {
  const p = QUOTE_PLANS.find((q) => q[0] === key);
  return p ? p[1] : "";
}

/* does this company ask? (yes unless it said leads.askPlan: false) */
export function asksPlan(cat) {
  return !(cat && cat.leads && cat.leads.askPlan === false);
}
