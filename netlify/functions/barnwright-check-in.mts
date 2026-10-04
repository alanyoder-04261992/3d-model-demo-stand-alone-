/* CHECK IN WITH BARNWRIGHT'S CONTROL ROOM EVERY SIX HOURS (account.js checkIn).

   Keeps the business's seven-day pass fresh even when nobody opens the
   Dealer Center, and reports how many lots are open. Does nothing on a
   site that is not connected to the control room. Netlify runs scheduled
   functions on the published site only. */
import type { Config, Context } from "@netlify/functions";
import { officeFor } from "../../server/office/netlify.js";

export default async (_request: Request, context: Context) => {
  await officeFor(context).checkIn({ force: true });
  return new Response(null, { status: 204 });
};

export const config: Config = { schedule: "17 */6 * * *" };
