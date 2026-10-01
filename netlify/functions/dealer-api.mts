/* SERVE THE COMPANY OFFICE AND DEALER-ROUTED CUSTOMER REQUESTS. */
import type { Context, Config } from "@netlify/functions";
import { backendFor } from "../../server/netlify-runtime.js";

export default async (request: Request, context: Context) => backendFor(context).handle(request);

export const config: Config = {
  path: ["/api/dealer/*", "/api/lots/:slug", "/api/lots/:slug/orders"],
};
