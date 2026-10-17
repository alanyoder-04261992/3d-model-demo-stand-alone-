/* CHECK: customer and Help drafts, arriving answers, older questions and
   failed saves, using a real browser and the local fake services only.
   Run: node tools/check-support-experience.mjs   (check-all: browser) */
import { spawn } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(ROOT, "test/out/support-experience");
const DATA = resolve(ROOT, "test/out/support-experience-data");
const BASE = "http://127.0.0.1:8376";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "/opt/node22/lib/node_modules/playwright/index.js");
/* Only this check's own previous data is reset. */
rmSync(DATA, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const server = spawn(process.execPath, ["tools/office-local.mjs", "--port", "8376", "--identity", "--control-room", "--data", DATA], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
let serverLog = "";
server.stdout.on("data", (data) => { serverLog += data; });
server.stderr.on("data", (data) => { serverLog += data; });
const pause = (ms) => new Promise((done) => setTimeout(done, ms));
let browser, context, page, passed = 0;
function ok(name, condition) {
  if (!condition) throw new Error(name);
  passed++;
  console.log(`  ok ${name}`);
}
async function local(path, body = {}) {
  const response = await fetch(BASE + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return response.json();
}
async function signIn(tab) {
  await tab.getByLabel("Email", { exact: true }).fill("chris@samplebarns.example");
  await tab.getByLabel("Password", { exact: true }).fill("sample-password");
  await tab.getByRole("checkbox", { name: /Keep me signed in/ }).check();
  await tab.getByRole("button", { name: "Sign in", exact: true }).click();
  await tab.waitForSelector("#main");
}
const note = () => page.getByRole("textbox", { name: "What happened", exact: true });
const followNote = () => page.getByLabel("Note", { exact: true });
/* Wait for a box to hold the words; a slow screen fails the check after 15 s. */
async function waitForValue(locator, value) {
  for (let i = 0; i < 150; i++) { if (await locator.inputValue().catch(() => "") === value) return; await pause(100); }
}
const followDate = () => page.getByLabel("Or pick a day", { exact: true });
async function api(path, body) {
  return page.evaluate(async ({ path, body }) => {
    const response = await fetch("/api/office/" + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { status: response.status, data: await response.json() };
  }, { path, body });
}

try {
  for (let i = 0; i < 120 && !serverLog.includes("is running"); i++) await pause(250);
  if (!serverLog.includes("is running")) throw new Error("The local Dealer Center didn't start: " + serverLog);
  mkdirSync(OUT, { recursive: true });
  browser = await chromium.launch({ ...(process.env.CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH } : {}) });
  context = await browser.newContext({ viewport: { width: 1280, height: 850 }, reducedMotion: "reduce" });
  await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
  page = await context.newPage();
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(BASE + "/dealer");
  await signIn(page);
  const creation = await api("customers", { lot: "brookside", name: "Support regression customer", email: "support-check@example.com" });
  if (creation.status !== 201) throw new Error("Could not create regression customer: " + creation.status + " " + creation.data.error);
  const customer = creation.data.customer;
  const customerHash = `#/customers/${customer.id}`;
  await page.goto(BASE + "/dealer" + customerHash);
  await note().fill("Keep this activity note while changing the stage.");
  await followNote().fill("Keep this follow-up note too.");
  await followDate().fill("2026-12-20");
  const changed = page.waitForResponse((response) => response.url().endsWith(`/customers/${customer.id}`) && response.request().method() === "PATCH");
  await page.getByLabel("Stage", { exact: true }).selectOption("contacted");
  await changed;
  await page.waitForTimeout(200);
  ok("changing Stage preserves activity text and both follow-up fields", await note().inputValue() === "Keep this activity note while changing the stage."
    && await followNote().inputValue() === "Keep this follow-up note too." && await followDate().inputValue() === "2026-12-20");

  /* The leave-page box comes a moment after the click (on the address
     change), so wait for it to be answered and for the address to settle. */
  const answered = new Promise((done) => page.once("dialog", (dialog) => dialog.dismiss().then(() => done(true), () => done(true))));
  await page.getByRole("link", { name: "Help", exact: true }).first().click();
  const settled = await Promise.race([answered, pause(15000).then(() => false)])
    && await page.waitForFunction((hash) => location.hash === hash, customerHash, { timeout: 15000 }).then(() => true, () => false);
  ok("cancelling navigation keeps the customer's unsaved writing", settled && page.url().endsWith(customerHash) && await note().inputValue() !== "");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("link", { name: "Help", exact: true }).first().click();
  await page.waitForURL(/#\/help$/);
  await page.getByRole("link", { name: "Customers", exact: true }).first().click();
  await page.evaluate((hash) => { location.hash = hash; }, customerHash);
  await note().waitFor();
  await waitForValue(note(), "Keep this activity note while changing the stage.");
  ok("returning from Help restores the customer draft", await note().inputValue() === "Keep this activity note while changing the stage."
    && await followNote().inputValue() === "Keep this follow-up note too.");
  page.once("dialog", (dialog) => dialog.accept());
  await page.reload();
  await waitForValue(note(), "Keep this activity note while changing the stage.");
  ok("a tab refresh restores the customer draft", await note().inputValue() === "Keep this activity note while changing the stage.");

  let reloads = 0;
  const onLoad = () => { reloads++; };
  page.on("load", onLoad);
  await local("/__local/clock", { shift: 31 * 86400000 });
  await page.getByRole("button", { name: "Save note", exact: true }).click();
  await page.locator(".banner.signed-out").waitFor();
  ok("sign-in expiry keeps the unsaved customer screen and explains how to sign in", reloads === 0 && await note().inputValue() !== ""
    && await followNote().inputValue() === "Keep this follow-up note too.");
  const anotherTab = await context.newPage();
  await anotherTab.goto(BASE + "/dealer");
  await signIn(anotherTab);
  await page.bringToFront();
  await page.getByRole("button", { name: "Save note", exact: true }).click();
  await page.waitForFunction(() => !document.querySelector('textarea[aria-label="What happened"]')?.value);
  ok("saving after signing in clears only activity text, keeping unsaved follow-up", await note().inputValue() === ""
    && await followNote().inputValue() === "Keep this follow-up note too.");
  await anotherTab.close();
  page.off("load", onLoad);

  await page.getByRole("button", { name: "Save follow-up", exact: true }).click();
  await page.waitForFunction(() => document.querySelector(".crm-follow-now")?.textContent.includes("Keep this follow-up note too."));
  await followNote().fill("A new follow-up draft while completing the old one.");
  await followDate().fill("2026-12-24");
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.waitForFunction(() => !document.querySelector(".crm-follow-now"));
  ok("completing the saved follow-up preserves a different new follow-up draft", await followNote().inputValue() === "A new follow-up draft while completing the old one."
    && await followDate().inputValue() === "2026-12-24");
  await page.getByRole("button", { name: "Save follow-up", exact: true }).click();
  await page.waitForFunction(() => document.querySelector(".crm-follow-now")?.textContent.includes("A new follow-up draft while completing the old one."));
  await page.getByRole("link", { name: "Help", exact: true }).first().click();
  const ask = () => page.getByLabel("Your question", { exact: true });
  await ask().fill("First support question " + customer.id);
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await page.getByText("Waiting for an answer", { exact: true }).waitFor();
  await ask().fill("Second question draft must survive the arriving answer.");
  const answer = "An answer arrived without reloading " + customer.id;
  await local("/__local/help-inbox", { answer });
  await page.getByText(answer, { exact: true }).waitFor({ timeout: 40000 });
  ok("a waiting Help question receives its answer on the same page and keeps another draft", await ask().inputValue() === "Second question draft must survive the arriving answer.");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("link", { name: "Customers", exact: true }).first().click();
  await page.getByRole("link", { name: "Help", exact: true }).first().click();
  ok("Help restores its unsent question after navigation", await ask().inputValue() === "Second question draft must survive the arriving answer.");

  const olderQuestions = [];
  for (let i = 0; i < 32; i++) {
    const response = await api("help", { text: `Older question ${i} ${customer.id}` });
    if (response.status !== 201) throw new Error("Could not seed older Help history: " + response.status);
    olderQuestions.push(response.data.id);
  }
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await page.getByRole("button", { name: "Show older questions", exact: true }).waitFor();
  await page.getByRole("button", { name: "Show older questions", exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll(".hp-item").length === 33);
  ok("older Help questions are reachable without duplicate cards or losing the question draft", await page.locator(".hp-item").count() === 33
    && await ask().inputValue() === "Second question draft must survive the arriving answer.");
  const olderAnswer = "A reply to a question on an older page " + customer.id;
  await local("/__local/help-inbox", { id: olderQuestions[0], answer: olderAnswer });
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await page.getByText(olderAnswer, { exact: true }).waitFor();
  ok("refresh also updates a pending question on an already loaded older page", await ask().inputValue() === "Second question draft must survive the arriving answer."
    && await page.locator(".hp-item").count() === 33);
  await local("/__local/clock", { shift: 32 * 86400000 }); // another day's Help allowance
  for (let i = 0; i < 31; i++) {
    const response = await api("help", { text: `Newer arrival ${i} ${customer.id}` });
    if (response.status !== 201) throw new Error("Could not seed newer arrivals: " + response.status);
  }
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await page.getByRole("button", { name: "Show older questions", exact: true }).waitFor();
  await page.getByRole("button", { name: "Show older questions", exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll(".hp-item").length === 64);
  ok("more than a page of new arrivals leaves the intervening questions reachable", await page.locator(".hp-item").count() === 64
    && await ask().inputValue() === "Second question draft must survive the arriving answer.");
  await page.screenshot({ path: resolve(OUT, "help-history-1280.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  ok("Help with older questions fits a phone", await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: resolve(OUT, "help-history-390.png"), fullPage: true });

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("link", { name: "Customers", exact: true }).last().click();
  await page.evaluate((hash) => { location.hash = hash; }, customerHash);
  await note().fill("Private customer writing must not enter an error report.");
  let reported;
  page.on("request", (request) => { if (request.url().endsWith("/api/office/problem")) reported = request.postDataJSON(); });
  await page.route(`**/api/office/customers/${customer.id}/activity`, (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Couldn't save right now.", requestId: "browserFAIL12345" }) }));
  await page.getByRole("button", { name: "Save note", exact: true }).click();
  await page.waitForFunction(() => document.body.textContent.includes("Couldn't save right now."));
  await pause(200);
  ok("a caught failed save reports its reference while preserving the note and excluding customer text and ID", reported?.message.includes("browserFAIL12345")
    && reported.where === "/api/office/customers" && !JSON.stringify(reported).includes(customer.id)
    && !JSON.stringify(reported).includes("Private customer writing") && await note().inputValue() === "Private customer writing must not enter an error report.");
  ok("the whole support workflow has no uncaught browser errors", errors.length === 0);
  console.log(`PROVED (${passed} checks): customer and Help drafts survive screen changes, repaint, refresh and sign-in expiry; arriving answers update without reload; older questions remain reachable; failed saves report a safe request reference.`);
} catch (error) {
  console.error("FAIL:", error.message);
  if (page) await page.screenshot({ path: resolve(OUT, "failure.png"), fullPage: true }).catch(() => {});
  process.exitCode = 1;
} finally {
  await browser?.close();
  server.kill();
}
