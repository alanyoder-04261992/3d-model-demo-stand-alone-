/* CHECK: failed saves, retry recovery, modal protection, and settings review.
   Run: node tools/check-dealer-reliability.mjs (check-all: browser)
   One real browser/page, isolated fake local data; no galleries or live mail. */
import { spawn } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = resolve(ROOT, "test/out/dealer-reliability-data"), OUT = resolve(ROOT, "test/out/dealer-reliability");
const BASE = "http://127.0.0.1:8377";
const HISTORICAL_ONLY = process.argv.includes("--historical-only");
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "/opt/node22/lib/node_modules/playwright/index.js");
rmSync(DATA, { recursive: true, force: true }); mkdirSync(OUT, { recursive: true });
const server = spawn(process.execPath, ["tools/office-local.mjs", "--port", "8377", "--identity", "--data", DATA], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
let log = "", browser, page, passed = 0;
server.stdout.on("data", (data) => { log += data; }); server.stderr.on("data", (data) => { log += data; });
const pause = (ms) => new Promise((done) => setTimeout(done, ms));
const ok = (name, value) => { if (!value) throw new Error(name); passed++; console.log("  ok " + name); };
const errors = [];
async function api(path, body, method = "GET") {
  return page.evaluate(async ({ path, body, method }) => {
    const response = await fetch("/api/office/" + path, { method, headers: body === undefined ? {} : { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, data: await response.json() };
  }, { path, body, method });
}
async function open(hash) {
  await page.goto(BASE + "/dealer" + hash, { waitUntil: "domcontentloaded" });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("#main");
  await page.waitForFunction(() => !document.querySelector("#main .loading"));
}
async function discard() { page.once("dialog", (dialog) => dialog.accept()); await page.locator("dialog").getByRole("button", { name: "Cancel", exact: true }).click(); }
async function decline(action) {
  const answered = page.waitForEvent("dialog").then((dialog) => dialog.dismiss());
  await action(); await answered;
}
try {
  for (let i = 0; i < 120 && !log.includes("is running"); i++) await pause(250);
  if (!log.includes("is running")) throw new Error("Local server did not start: " + log);
  browser = await chromium.launch({ ...(process.env.CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH } : {}), args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 850 }, reducedMotion: "reduce" });
  await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
  page = await context.newPage(); page.setDefaultTimeout(25000); page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(BASE + "/dealer", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email", { exact: true }).fill("chris@samplebarns.example");
  await page.getByLabel("Password", { exact: true }).fill("sample-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click(); await page.waitForSelector("#main");
  let id;
  if (!HISTORICAL_ONLY) {
  await open("#/customers");
  await page.getByRole("button", { name: "Add customer", exact: true }).first().click();
  await page.getByLabel("Name", { exact: true }).fill("Retry regression customer");
  await page.getByLabel("Email", { exact: true }).fill("dealer-retry@example.com");
  let first = true, committedId;
  await page.route("**/api/office/customers", async (route) => {
    if (route.request().method() === "POST" && first) { first = false; const response = await route.fetch(); committedId = (await response.json()).customer.id; await route.abort("failed"); }
    else await route.continue();
  });
  await page.getByRole("button", { name: "Save customer", exact: true }).click();
  await page.getByText("Can't reach the Dealer Center. Check your internet connection and try again.", { exact: true }).waitFor();
  ok("failed customer response keeps the entered name and re-enables retry", await page.getByLabel("Name", { exact: true }).inputValue() === "Retry regression customer" && await page.getByRole("button", { name: "Save customer", exact: true }).isEnabled());
  await page.getByRole("button", { name: "Save customer", exact: true }).click(); await page.waitForURL(/#\/customers\/[A-Za-z0-9]+$/);
  id = page.url().split("/").at(-1); await page.unroute("**/api/office/customers");
  const matches = (await api("customers")).data.rows.filter((row) => row.email === "dealer-retry@example.com");
  ok("customer retry opens the first committed record and creates no duplicate", id === committedId && matches.length === 1);
  await page.route("**/api/office/customers/" + id, (route) => route.request().method() === "PATCH"
    ? route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Assignment regression failure", requestId: "assignmentCheck01" }) }) : route.continue());
  await page.getByLabel("Working them", { exact: true }).selectOption("sample-sarah");
  await page.getByText("Assignment regression failure", { exact: true }).waitFor();
  await page.waitForFunction(() => !document.querySelector('select[aria-label="Working them"]').disabled);
  ok("assignment failure restores Chris and an enabled selector", await page.getByLabel("Working them", { exact: true }).inputValue() === "sample-chris");
  await page.unroute("**/api/office/customers/" + id);
  await api("customers/" + id, { phone: "2395550137", smsOk: false }, "PATCH"); await open("#/customers/" + id);
  await page.getByText("Don't text", { exact: true }).waitFor();
  ok("Don't text customers keep Call and Email without a Text action", await page.getByRole("link", { name: "Text", exact: true }).count() === 0 && await page.getByRole("link", { name: "Call", exact: true }).count() === 1);
  await page.locator(".crm-contact").getByRole("button", { name: "Edit", exact: true }).click(); await page.getByLabel("Name", { exact: true }).fill("Unsaved contact edit");
  await decline(() => page.keyboard.press("Escape"));
  ok("contact edits are kept when closing is declined", await page.getByLabel("Name", { exact: true }).inputValue() === "Unsaved contact edit"); await discard();

  await api("lots/riverside", { state: "GA" }, "PATCH"); await open("#/customers");
  await page.getByRole("button", { name: "Add customer", exact: true }).first().click();
  await page.getByLabel("Lot", { exact: true }).selectOption("riverside");
  ok("an untouched State follows the selected lot", await page.getByLabel("State", { exact: true }).inputValue() === "GA");
  await page.getByLabel("State", { exact: true }).fill("NC"); await page.getByLabel("Lot", { exact: true }).selectOption("brookside");
  ok("choosing another lot preserves an explicitly edited State", await page.getByLabel("State", { exact: true }).inputValue() === "NC");
  await page.getByLabel("Name", { exact: true }).fill("Protected customer draft");
  await decline(() => page.keyboard.press("Escape"));
  ok("Escape can be declined without losing the customer draft", await page.getByLabel("Name", { exact: true }).inputValue() === "Protected customer draft");
  await decline(() => page.evaluate(() => { location.hash = "#/orders"; })); await page.waitForURL(/#\/customers$/);
  ok("declining navigation keeps the modal and original route", page.url().endsWith("#/customers") && await page.getByLabel("Name", { exact: true }).inputValue() === "Protected customer draft");
  await discard();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Add customer", exact: true }).first().click();
  await page.getByRole("button", { name: "Save customer", exact: true }).click();
  ok("phone validation focuses the required Name", await page.getByLabel("Name", { exact: true }).evaluate((input) => input === document.activeElement));
  await page.getByLabel("Name", { exact: true }).fill("Pending customer"); await page.getByLabel("Email", { exact: true }).fill("pending-dealer@example.com");
  let release, startedResolve; const started = new Promise((done) => { startedResolve = done; });
  const blocked = new Promise((done) => { release = done; });
  await page.route("**/api/office/customers", async (route) => { if (route.request().method() === "POST") { startedResolve(); await blocked; } await route.continue(); });
  await page.getByRole("button", { name: "Save customer", exact: true }).click(); await started;
  await page.locator("dialog").getByRole("button", { name: "Close", exact: true }).click(); await page.keyboard.press("Escape");
  ok("a pending save keeps its modal open and input locked", await page.locator("dialog[open]").count() === 1 && await page.getByLabel("Name", { exact: true }).isDisabled());
  await page.screenshot({ path: OUT + "/pending-customer-phone.png", fullPage: true });
  release(); await page.waitForURL(/#\/customers\/[A-Za-z0-9]+$/); await page.unroute("**/api/office/customers");
  await page.setViewportSize({ width: 1280, height: 850 });
  await open("#/team"); await page.getByRole("button", { name: "Add a person", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("Protected teammate");
  await decline(() => page.keyboard.press("Escape"));
  ok("team form keeps the entered work when closing is declined", await page.getByLabel("Name", { exact: true }).inputValue() === "Protected teammate"); await discard();
  await open("#/lots"); await page.getByRole("button", { name: "Add a lot", exact: true }).click(); await page.getByLabel("Lot name", { exact: true }).fill("Protected lot");
  await decline(() => page.keyboard.press("Escape"));
  ok("lot form keeps entered work when closing is declined", await page.getByLabel("Lot name", { exact: true }).inputValue() === "Protected lot"); await discard();
  const orderCustomer = (await api("customers")).data.rows.find((row) => row.orders?.length); await open("#/customers/" + orderCustomer.id);
  await page.getByRole("button", { name: "Edit order details", exact: true }).first().click(); await page.getByLabel("Order notes", { exact: true }).fill("Protected order notes");
  await decline(() => page.keyboard.press("Escape"));
  ok("order edits keep entered work when closing is declined", await page.getByLabel("Order notes", { exact: true }).inputValue() === "Protected order notes"); await discard();

  await open("#/settings"); await page.getByLabel("Business name", { exact: true }).fill("Saved with refresh failure"); let wrote = false;
  await page.route("**/api/office/price-list", async (route) => {
    if (route.request().method() === "PUT") { const response = await route.fetch(); wrote = response.ok(); await route.fulfill({ response }); }
    else if (route.request().method() === "GET" && wrote) await route.abort("failed"); else await route.continue();
  });
  await page.getByRole("button", { name: "Save settings", exact: true }).click(); await page.getByRole("button", { name: "Retry refresh", exact: true }).waitFor();
  ok("a committed Settings save with lost refresh offers recovery without a repeat save", wrote && await page.getByRole("button", { name: "Save settings", exact: true }).count() === 0 && await page.getByLabel("Business name", { exact: true }).inputValue() === "Saved with refresh failure");
  await page.screenshot({ path: OUT + "/settings-refresh-recovery.png", fullPage: true });
  await page.unroute("**/api/office/price-list"); await page.getByRole("button", { name: "Retry refresh", exact: true }).click(); await page.getByText("Settings refreshed.", { exact: true }).waitFor();
  ok("Retry refresh finishes without changing the saved name", await page.getByRole("button", { name: "Retry refresh", exact: true }).count() === 0 && (await api("price-list")).data.settings.brand.name === "Saved with refresh failure");
  await page.getByLabel("Business name", { exact: true }).fill("My reviewed name");
  const newer = (await api("price-list")).data; newer.settings.brand.email = "other-editor@example.com";
  ok("another editor's independent settings save succeeds", (await api("price-list", { settings: newer.settings, version: newer.version }, "PUT")).status === 200);
  await page.getByRole("button", { name: "Save settings", exact: true }).click(); await page.getByRole("button", { name: "Review newer settings", exact: true }).waitFor();
  ok("a version conflict keeps the original typed business name", await page.getByLabel("Business name", { exact: true }).inputValue() === "My reviewed name");
  await page.getByRole("button", { name: "Review newer settings", exact: true }).click(); await page.locator("dialog").getByRole("button", { name: "Keep my changes", exact: true }).click();
  ok("review carries my name together with the other editor's email", await page.getByLabel("Business name", { exact: true }).inputValue() === "My reviewed name" && await page.getByRole("textbox", { name: "Email", exact: true }).inputValue() === "other-editor@example.com");
  await page.getByRole("button", { name: "Save settings", exact: true }).click(); await page.waitForFunction(() => !document.querySelector(".set-bar:not([hidden])"));
  const combined = (await api("price-list")).data;
  ok("the reviewed save persists both people's independent work", combined.settings.brand.name === "My reviewed name" && combined.settings.brand.email === "other-editor@example.com");
  const width = await page.getByLabel("Width", { exact: true }).inputValue(); await page.getByRole("button", { name: "Add a note", exact: true }).click();
  ok("Add a note focuses the new textarea", await page.getByLabel(`Note for ${width} ft wide buildings`, { exact: true }).evaluate((input) => input === document.activeElement));
  await page.getByRole("button", { name: `Remove the note for ${width} ft wide buildings`, exact: true }).click();
  await open("#/customers"); await page.getByRole("button", { name: "Add customer", exact: true }).first().click();
  await page.getByLabel("Name", { exact: true }).fill("Kept through sign-in expiry"); await page.getByLabel("Email", { exact: true }).fill("expiry-dealer@example.com");
  await context.request.post(BASE + "/__local/clock", { data: { shift: 31 * 86400000 } });
  await page.getByRole("button", { name: "Save customer", exact: true }).click(); await page.locator("dialog .form-status").filter({ hasText: "Sign in in a new tab" }).waitFor();
  ok("sign-in expiry preserves the changed modal instead of reloading it", await page.getByLabel("Name", { exact: true }).inputValue() === "Kept through sign-in expiry" && await page.getByRole("button", { name: "Save customer", exact: true }).isEnabled());
  const grant = await context.request.post(BASE + "/.netlify/identity/token", { form: { grant_type: "password", username: "chris@samplebarns.example", password: "sample-password" } });
  const login = await grant.json();
  const renewed = await context.request.post(BASE + "/api/office/session", { headers: { Origin: BASE }, data: { refreshToken: login.refresh_token, keep: true } });
  ok("the fake authenticated session can be renewed without a second browser page", renewed.ok());
  await page.getByRole("button", { name: "Save customer", exact: true }).click(); await page.waitForURL(/#\/customers\/[A-Za-z0-9]+$/);
  ok("saving the preserved modal after signing in creates the original entry", (await api("customers")).data.rows.filter((row) => row.email === "expiry-dealer@example.com").length === 1);
  } else {
    const fixture = await api("customers", { lot: "brookside", name: "Historical view regression", email: "historical-view@example.com", requestKey: "historical-only-fixture" }, "POST");
    if (fixture.status !== 201) throw new Error("Could not create historical fixture");
    id = fixture.data.customer.id;
  }

  /* Only one renderer runs: block the sheet's background iframe, then open
     its original-view link on this same page and export its image there. */
  const design = await page.evaluate(async () => {
    const { loadLot } = await import("/ui/load.js"), { toState, fromState } = await import("/model/design.js");
    const { catalogue: cat } = await loadLot("brookside");
    return fromState(toState({ v: 1, company: cat.id, cfg: cat.cfg, type: "LB", size: "10x20", colors: {} }, cat).state, cat);
  });
  const quoted = await api(`customers/${id}/quotes`, { design }, "POST"); ok("historical browser fixture saves a Lofted Barn quote", quoted.status === 201);
  const original = (await api(`customers/${id}/quotes/${quoted.data.quote.id}/designer`)).data;
  const current = (await api("price-list")).data; delete current.settings.offer.LB;
  current.settings.categories = current.settings.categories.map(([label, styles]) => [label, styles.filter((key) => key !== "LB")]).filter(([, styles]) => styles.length);
  if (current.settings.defaults.style === "LB") { current.settings.defaults.style = "UT"; current.settings.defaults.size = Object.keys(current.settings.offer.UT.sizes)[0]; }
  current.settings.notes.finePrint = "Later terms after the original quote."; current.settings.items.w72 = { price: 325, name: "Later renamed doors" };
  ok("current price list removes the saved style and changes descriptions", (await api("price-list", { settings: current.settings, version: current.version }, "PUT")).status === 200);
  await open(`#/customers/${id}`);
  const cardLink = await page.getByRole("link", { name: "See it in 3D", exact: true }).getAttribute("href");
  ok("the normal customer quote card opens its saved historical definitions", new URL(cardLink).searchParams.get("saved-quote") === `${id}/${quoted.data.quote.id}`);
  await page.route("**/d/**", (route) => route.request().frame().parentFrame() && new URL(route.request().url()).searchParams.has("saved-quote")
    ? route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>Single renderer check</title>" }) : route.continue());
  await open(`#/customers/${id}/quotes/${quoted.data.quote.id}`);
  ok("historical sheet keeps original fine print and item names", await page.locator(".sheet-fine").innerText() === original.catalogue.notes.finePrint && !(await page.locator(".sheet-item-cols").innerText()).includes("Later renamed doors"));
  const originalLink = await page.getByRole("link", { name: "See it in 3D", exact: true }).getAttribute("href");
  ok("historical sheet links to its authenticated saved quote", new URL(originalLink).searchParams.get("saved-quote") === `${id}/${quoted.data.quote.id}`);
  ok("customer card and printable sheet share the same original-view URL", cardLink === originalLink);
  await page.screenshot({ path: OUT + "/historical-quote-sheet.png", fullPage: true });
  await page.goto(originalLink, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.shedUI?.ready, null, { timeout: 60000 });
  const viewed = await page.evaluate(async () => ({ type: shedUI.getDesign().type, size: shedUI.getDesign().size, readOnly: shedUI.readOnly, warnings: shedUI.startWarnings,
    image: !!(await shedUI.quote.images())?.images?.view }));
  ok("original 3D viewer draws the removed Lofted Barn without substitutions", viewed.type === "LB" && viewed.size === "10x20" && viewed.readOnly && !viewed.warnings.length);
  ok("original snapshot viewer can export the order-sheet picture", viewed.image);
  ok("historical prices are labeled as the original quote", await page.getByText("Original quote total", { exact: true }).count() === 1 && !(await page.locator(".shview").innerText()).includes("Estimated total today"));
  ok("historical view keeps its immutable actions separate from public shared designs", await page.getByRole("button", { name: "Change this design", exact: true }).count() === 0 && await page.getByRole("button", { name: "Share this design", exact: true }).count() === 0 && await page.getByRole("link", { name: "Back to customer", exact: true }).count() === 1);
  await page.screenshot({ path: OUT + "/historical-quote-viewer.png", fullPage: true });
  const publicUrl = new URL(originalLink); publicUrl.searchParams.delete("saved-quote");
  await page.goto(publicUrl.href, { waitUntil: "domcontentloaded" }); await page.waitForFunction(() => window.shedUI?.ready, null, { timeout: 60000 });
  ok("ordinary public shared designs retain today's-price wording and Change", await page.getByText("Estimated total today", { exact: true }).count() === 1 && await page.getByRole("button", { name: "Change this design", exact: true }).count() === 1 && !(await page.locator(".shview").innerText()).includes("Original quote total"));
  ok("expected API failures leave no uncaught browser errors", errors.length === 0);
  console.log(`PROVED (${passed} checks): ${HISTORICAL_ONLY ? "original quote definitions, exported pictures, immutable historical captions/actions and ordinary shared-design behavior work in a real browser" : "Dealer save retries, assignment rollback, contact preference, protected forms, phone validation, settings recovery and conflict review work in a real browser"}.`);
} finally { if (browser) await browser.close(); server.kill("SIGTERM"); }
