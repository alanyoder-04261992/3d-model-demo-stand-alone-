import type { Config, Context } from "@netlify/functions";
import { backendFor } from "../../server/netlify-runtime.js";
import { html, hashes } from "../../server/generated/designer.js";

export default async (request: Request, context: Context) => {
  try {
    const backend = await backendFor(context);
    const data = await backend.publicLot(context.params.slug);
    // Only exact HTTPS origins are permitted. No wildcards, paths or CSP syntax.
    const origins = (data.lot.embedOrigins || []).filter((s: string) =>
      /^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(s));
    const policy = ["default-src 'self'", `script-src 'self' ${hashes.join(" ")}`,
      "style-src 'self' 'unsafe-inline'", "font-src 'self'", "img-src 'self' data: blob: https:",
      "connect-src 'self' data: blob:", "worker-src 'self' blob:", "form-action 'self'",
      "object-src 'none'", "base-uri 'self'", `frame-ancestors 'self' ${origins.join(" ")}`].join("; ");
    return new Response(request.method === "HEAD" ? null : html, { headers: {
      "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store",
      "Content-Security-Policy": policy, "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    } });
  } catch (error: any) {
    const status = Number.isInteger(error.status) ? error.status : 503;
    return new Response(status === 404 ? "This dealer designer is not available." : "The dealer designer is temporarily unavailable.",
      { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
  }
};

export const config: Config = { path: ["/d/:slug", "/d/:slug/"], method: ["GET", "HEAD"] };
