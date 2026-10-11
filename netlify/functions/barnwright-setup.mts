/* BARNWRIGHT'S SETUP DOOR (server/office/setup-access.js door).

   Barnwright's control room calls POST /.netlify/functions/barnwright-setup
   (its fixed address, so no path is set here) from its own server, with a
   one-use setup pass made for that request's exact body. It can say where
   Barnwright's setup access stands, read the price list in parts, check a
   list of edits, save exactly what was checked, and put back the price
   list from before Barnwright's last change -- only before the business
   is live, or while the owner's switch is on. Never customers, quotes,
   orders, the team or keys. The contract is docs/OFFICE.md, "Barnwright
   setup access". */
import type { Context } from "@netlify/functions";
import { officeFor } from "../../server/office/netlify.js";

export default async (request: Request, context: Context) => officeFor(context).setupDoor(request);
