/* CHECK IN WITH BARNWRIGHT'S CONTROL ROOM RIGHT AFTER A DEPLOY
   (server/office/index.js deploySucceeded).

   Netlify runs a function named for one of its events when that event
   happens: this file is named for deploy-succeeded, so it runs each time a
   deploy of this site succeeds. Netlify signs every event it sends and
   checks the signature before it calls the function, so nobody else can
   run it; it has no path and no schedule.

   Only a production deploy checks in, the same as the six-hourly check-in
   (barnwright-check-in.mts): the lease renews and the control room learns
   the new version and where Barnwright setup access stands at once. So the
   first deploy that Make their Dealer Center starts shows Connected in the
   Control Room within a minute, not up to six hours later. A deploy
   preview or a branch deploy does nothing. Always 204. */
import type { Context } from "@netlify/functions";
import { officeFor } from "../../server/office/netlify.js";

export default async (request: Request, context: Context) => officeFor(context).deploySucceeded(request, context.deploy?.context);
