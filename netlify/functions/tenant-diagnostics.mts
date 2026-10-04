/* BARNWRIGHT'S SUPPORT CHECK (server/office/account.js diagnostics).

   Barnwright's control room calls POST /.netlify/functions/tenant-diagnostics
   (its fixed address, so no path is set here) with a support pass good for
   at most 15 minutes, and only after the owner turned on "Help from
   Barnwright" in Settings. The answer says how the Dealer Center is running
   -- never customers, prices, settings or keys. */
import type { Context } from "@netlify/functions";
import { officeFor } from "../../server/office/netlify.js";

export default async (request: Request, context: Context) => officeFor(context).diagnostics(request);
