/* A LOT'S 3D DESIGNER: /d/<lot>/ is the designer page, sent with a
   security policy that lets only that lot's own websites show it in a frame.
   A closed lot, or a business not open yet, gets a short page saying so.

   /d/<lot>/?preview=1 (the team) or ?preview=barnwright (a Barnwright
   visit) is the same page while it is closed. The page itself holds no
   prices: it asks the Dealer Center's own preview routes, which check who
   is signed in, and it never takes a quote. Only this site may frame it. */
import type { Config, Context } from "@netlify/functions";
import { officeFor } from "../../server/office/netlify.js";
import { lotDesignerPage, closedPage } from "../../server/office/pages.js";
import { html, hashes } from "../../server/generated/designer.js";

export default async (request: Request, context: Context) => {
  const preview = new URL(request.url).searchParams.get("preview");
  if (preview === "1" || preview === "barnwright") return lotDesignerPage({ html, hashes, origins: [], head: request.method === "HEAD" });
  try {
    const data = await officeFor(context).publicLot(context.params.slug);
    return lotDesignerPage({ html, hashes, origins: data.lot.embedOrigins || [], head: request.method === "HEAD" });
  } catch (error: any) {
    return closedPage(Number.isInteger(error?.status) ? error.status : 503, error?.call);
  }
};

export const config: Config = { path: ["/d/:slug", "/d/:slug/"], method: ["GET", "HEAD"] };
