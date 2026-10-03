/* THE OFFICE API AND THE LOT DESIGNERS' QUOTE REQUESTS (server/office/). */
import type { Config, Context } from "@netlify/functions";
import { officeFor } from "../../server/office/netlify.js";

export default async (request: Request, context: Context) =>
  officeFor(context).handle(request, { clientIp: context.ip || "unknown" });

export const config: Config = {
  path: ["/api/office/*", "/api/lots/:slug", "/api/lots/:slug/quote-requests", "/api/lots/:slug/orders"],
};
