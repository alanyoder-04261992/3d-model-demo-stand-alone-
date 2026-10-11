/* CHECK IN WITH BARNWRIGHT'S CONTROL ROOM EVERY SIX HOURS (account.js checkIn).

   Keeps the business's seven-day pass fresh even when nobody opens the
   Dealer Center, and reports how many lots are open. Does nothing on a
   site that is not connected to the control room. Netlify runs scheduled
   functions on the published site only.

   The check-in goes first, so the lease always renews. Then, in its own
   try and for at most 5 seconds, Barnwright setup access looks back once
   for a business set up before it shipped (setup-access.js liveRecord: was
   it ever open to customers, or did it ever save a quote?). index.js
   scheduledCheckIn does both. */
import type { Config, Context } from "@netlify/functions";
import { officeFor } from "../../server/office/netlify.js";

export default async (_request: Request, context: Context) => {
  await officeFor(context).scheduledCheckIn();
  return new Response(null, { status: 204 });
};

export const config: Config = { schedule: "17 */6 * * *" };
