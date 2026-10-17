/* CHECK: Netlify can open an original quote while the lot is closed.
   check-all: node
   Run: node tools/check-lot-designer.mjs

   Bundle and run the real Netlify handler, with the real HTML and page/CSP
   helpers. Only officeFor is a service stub. The generated designer module
   is supplied from index.html and its inline script hashes, exactly as the
   build writes it, so this check also works before a build. No browser,
   network requests or customer records are used. Private data still comes
   from the signed-in quote-view API, rather than this generic HTML shell. */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { inlineScriptHashes } from "./build-headers.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const shell = readFileSync(resolve(ROOT, "index.html"), "utf8");
const hashes = inlineScriptHashes(shell);
const SERVICE = "__lotDesignerCheckOffice";
const previousService = globalThis[SERVICE];
const context = { params: { slug: "closed-lot" }, deploy: { context: "production" } };
const externalOrigins = ["https://dealer.example", "https://www.dealer.example"];
let opened = false;
const factories = [], lots = [];
let passed = 0;
function ok(what, cond, detail) {
  assert.ok(cond, detail ? `${what}: ${detail}` : what);
  passed++;
  console.log("  ok   " + what);
}
const ancestors = response => (response.headers.get("Content-Security-Policy") || "").split(";").map(s => s.trim()).find(s => s.startsWith("frame-ancestors "));

globalThis[SERVICE] = received => {
  factories.push(received);
  return {
    publicLot: async slug => {
      lots.push(slug);
      if (!opened) throw Object.assign(new Error("The lot is closed."), { status: 404, call: { name: "Closed lot", phone: "555-010-0142" } });
      return { lot: { embedOrigins: externalOrigins } };
    },
    // A shell must never read a private customer or quote to render HTML.
    get privateCustomer() { throw new Error("Private customer data was accessed."); },
    get privateQuote() { throw new Error("Private quote data was accessed."); },
  };
};

try {
  const bundled = await build({
    entryPoints: [resolve(ROOT, "netlify/functions/lot-designer.mts")], bundle: true,
    platform: "node", format: "esm", write: false, logLevel: "silent",
    plugins: [{ name: "lot-designer-test-services", setup(builder) {
      builder.onResolve({ filter: /server\/office\/netlify\.js$/ }, () => ({ path: "office-service", namespace: "test" }));
      builder.onResolve({ filter: /server\/generated\/designer\.js$/ }, () => ({ path: "designer-shell", namespace: "test" }));
      builder.onLoad({ filter: /^office-service$/, namespace: "test" }, () => ({ loader: "js", contents: `export const officeFor = context => globalThis[${JSON.stringify(SERVICE)}](context);` }));
      builder.onLoad({ filter: /^designer-shell$/, namespace: "test" }, () => ({ loader: "js", contents: `export const html = ${JSON.stringify(shell)}; export const hashes = ${JSON.stringify(hashes)};` }));
    } }],
  });
  const { default: handler } = await import("data:text/javascript;base64," + Buffer.from(bundled.outputFiles[0].text).toString("base64"));
  async function call(query = {}, method = "GET") {
    factories.length = 0; lots.length = 0;
    const params = new URLSearchParams(query);
    return handler(new Request("https://dealer.test/d/closed-lot/" + (params.size ? "?" + params : ""), { method }), context);
  }
  function privatePolicy(name, response) {
    ok(name + " allows only this site's frame", ancestors(response) === "frame-ancestors 'self'" && externalOrigins.every(origin => !response.headers.get("Content-Security-Policy").includes(origin)));
    ok(name + " is HTML kept out of caches", /^text\/html/.test(response.headers.get("Content-Type")) && response.headers.get("Cache-Control") === "no-store");
  }

  const closed = await call();
  ok("an ordinary closed lot remains 404", closed.status === 404 && /isn't open right now/.test(await closed.text()));
  ok("the public route still asks for that lot using Netlify's context", factories.length === 1 && factories[0] === context && lots.length === 1 && lots[0] === "closed-lot");

  let firstHistory = "";
  for (const reference of ["Customer/Quote123", "ABCDEFGHIJKLMNOPQRSTUVWX/ZYXWVUTSRQPONMLKJIHGFEDC"]) {
    const response = await call({ "saved-quote": reference });
    ok("a valid saved quote opens its shell while the lot is closed", response.status === 200, reference);
    ok("the historical shell reads neither the public lot nor private records", factories.length === 0 && lots.length === 0);
    privatePolicy("the historical shell", response);
    const html = await response.text();
    ok("the historical response is exactly the generic designer HTML", html === shell && !html.includes(reference));
    if (firstHistory) ok("different customer and quote references return the same HTML", html === firstHistory);
    else firstHistory = html;
  }
  const historyHead = await call({ "saved-quote": "Customer1/Quote123" }, "HEAD");
  ok("a saved quote HEAD returns 200 with an empty body and no lot lookup", historyHead.status === 200 && await historyHead.text() === "" && factories.length === 0 && lots.length === 0);
  privatePolicy("a saved quote HEAD", historyHead);

  const invalid = ["", "Custome/Quote123", "Customer1/Quote12", "A".repeat(25) + "/Quote123", "Customer1/" + "Q".repeat(25),
    "Customer1/Quote123/Extra123", "/Customer1/Quote123", "Customer1/Quote123/", "Customer1//Quote123", "Customer1", "Customer1/",
    "Customer-1/Quote123", "Customer1/Quote_123", " Customer1/Quote123", "Customer1/Quote123 ", "Customer1%2FQuote123"];
  for (const reference of invalid) {
    const response = await call({ "saved-quote": reference });
    ok("an invalid saved-quote reference keeps the ordinary closed response", response.status === 404 && factories.length === 1 && lots.length === 1 && /isn't open right now/.test(await response.text()), JSON.stringify(reference));
  }

  for (const preview of ["1", "barnwright"]) {
    const response = await call({ preview, "saved-quote": "invalid/reference" });
    ok("an existing signed-in preview still opens the generic shell", response.status === 200 && await response.text() === shell && factories.length === 0 && lots.length === 0, preview);
    privatePolicy("the " + preview + " preview", response);
    const head = await call({ preview }, "HEAD");
    ok("an existing preview HEAD stays empty", head.status === 200 && await head.text() === "" && factories.length === 0, preview);
  }
  const wrongPreview = await call({ preview: "true" });
  ok("other preview values keep the lot's normal closed response", wrongPreview.status === 404 && lots.length === 1);

  opened = true;
  const publicPage = await call();
  ok("an ordinary open lot still serves the designer after its public lookup", publicPage.status === 200 && await publicPage.text() === shell && lots.length === 1 && factories[0] === context);
  ok("an open lot retains its configured external frame origins", ancestors(publicPage) === "frame-ancestors 'self' " + externalOrigins.join(" "));
  const openHead = await call({}, "HEAD");
  ok("an ordinary open lot HEAD stays empty with its public frame policy", openHead.status === 200 && await openHead.text() === "" && ancestors(openHead) === ancestors(publicPage) && lots.length === 1);
  const openHistory = await call({ "saved-quote": "Customer1/Quote123" });
  ok("an open lot's saved history still excludes its external frame origins", openHistory.status === 200 && ancestors(openHistory) === "frame-ancestors 'self'" && factories.length === 0 && await openHistory.text() === shell);

  console.log(`PROVED (${passed} checks): the real Netlify route keeps public closed lots closed, serves only generic same-site HTML for saved quotes and existing previews, and preserves open-lot framing and HEAD behavior.`);
} finally {
  if (previousService === undefined) delete globalThis[SERVICE];
  else globalThis[SERVICE] = previousService;
}
