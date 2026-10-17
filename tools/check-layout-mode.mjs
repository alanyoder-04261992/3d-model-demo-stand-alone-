/* CHECK: the owner sets a real standard layout and every lot starts from it.
   Includes phone sheets, porch gestures, every-size results and kept drafts.
   check-all: browser */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = process.env.LAYOUT_TEST_ROOT || resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.LAYOUT_MODE_PORT || 8395);
const WIDTHS = (process.env.LAYOUT_MODE_WIDTHS || "390,820,1280").split(",").map(Number);
const SCHEMES = (process.env.LAYOUT_MODE_SCHEMES || "light,dark").split(",");
assert.ok(WIDTHS.every(w => [390, 820, 1280].includes(w)) && SCHEMES.every(s => ["light", "dark"].includes(s)), "Use the supported layout test widths and color schemes.");
const BASE = `http://127.0.0.1:${PORT}`;
const DATA = "test/out/layout-mode-check-data";
const OUT = resolve(ROOT, "test/out/your-buildings");
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "/opt/node22/lib/node_modules/playwright/index.js");
mkdirSync(OUT, { recursive: true });
rmSync(resolve(ROOT, DATA), { recursive: true, force: true });
const server = spawn(process.execPath, ["tools/office-local.mjs", "--reset", "--port", String(PORT), "--data", DATA], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
let serverLog = "", browser, passed = 0;
server.stdout.on("data", (d) => { serverLog += d; });
server.stderr.on("data", (d) => { serverLog += d; });
const check = (name, condition) => { assert.ok(condition, name); passed++; console.log("PASS " + name); };
const ownerHeaders = { cookie: "dealer_local_user=chris%40samplebarns.example", origin: BASE, "content-type": "application/json" };
const call = async (path, body, headers = ownerHeaders) => {
  const r = await fetch(BASE + "/api/office/" + path, { method: body === undefined ? "GET" : "POST", headers, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: r.status, data: await r.json() };
};
const ready = async (page) => page.waitForFunction(() => window.shedUI?.ready && window.shedUI?.layoutMode, null, { timeout: 60000 });
const state = (page) => page.evaluate(() => window.shedUI.getState().items.map((i) => ({ id: i.id, cat: i.cat, wall: i.wall, pos: i.pos })));
const open = async (context, key) => { const p = await context.newPage(); p.errors = []; p.on("pageerror", e => p.errors.push(e.message)); await p.goto(`${BASE}/d/riverside/?layout=${key}`); await ready(p); return p; };
const select = (page, cat, wall) => page.evaluate(({ cat, wall }) => { const ui = window.shedUI; const item = ui.getState().items.find(i => i.cat === cat && (!wall || i.wall === wall)); if (!item) throw new Error("Missing " + cat); ui.select(item.id); }, { cat, wall });
const geometry = (page) => page.evaluate(() => ({ overflow: document.documentElement.scrollWidth - innerWidth, bar: document.querySelector("#layout-savebar").getBoundingClientRect().top,
  controls: ["layout-left", "layout-right", "sh-dup", "sh-del", "sh-done"].map(id => { const r = document.getElementById(id).getBoundingClientRect(); return { id, top: r.top, bottom: r.bottom, width: r.width, height: r.height }; }) }));

try {
  for (let n = 0; n < 240 && !serverLog.includes("is running"); n++) await new Promise(r => setTimeout(r, 250));
  assert.ok(serverLog.includes("is running"), serverLog || "Local Dealer Center did not start.");
  check("only an owner can open standard layout mode", (await call("layout-mode?style=LB")).status === 200);
  check("a manager gets no layout permission", (await call("layout-mode?style=LB", undefined, { cookie: "dealer_local_user=sarah%40samplebarns.example" })).status === 403);
  browser = await chromium.launch({ ...(process.env.CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH } : {}), args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
  await context.addCookies([{ name: "dealer_local_user", value: "chris%40samplebarns.example", url: BASE }]);
  const page = await open(context, "LB");
  check("the real designer shows the standard-layout bar", /Every lot uses it/.test(await page.locator(".layout-heading").innerText()));
  check("customer quote and color controls are hidden", !await page.locator("#card-colors").isVisible());
  await page.locator('[data-layout-view="R"]').click();
  await page.getByRole("button", { name: "+ 36″ 11-Lite Door", exact: true }).click();
  await page.locator("#layout-rule-select").selectOption("left");
  await page.locator("#layout-gap").fill("18");
  await page.locator("#layout-gapapply").click();
  const doorBefore = (await state(page)).find(i => i.cat === "d36lite" && i.wall === "R").pos;
  await page.locator("#layout-right").click();
  const doorAfter = (await state(page)).find(i => i.cat === "d36lite" && i.wall === "R").pos;
  check("Move advances the door exactly three inches", Math.abs(doorAfter - doorBefore - .25) < .001);
  await page.locator("#sh-done").click();
  await page.getByRole("button", { name: "+ 2×3 Window", exact: true }).click();
  await page.locator("#layout-rule-select").selectOption("right");
  await page.locator("#layout-gap").fill("24");
  await page.locator("#layout-gapapply").click();
  await page.locator("#sh-done").click();
  await page.locator("#layout-save").click();
  await page.waitForFunction(() => /Saved/.test(document.querySelector("#layout-result h2")?.textContent || ""));
  check("Save checks every size and shows three drawings", await page.locator(".layout-examples svg").count() === 3);
  check("the three result drawings use the real building renderer", await page.locator('.layout-examples svg image[href^="data:image/png"]').count() === 3);
  const saved = await call("price-list");
  check("the server saves the actual layout", Array.isArray(saved.data.settings.offer.LB.layout));
  const customer = await context.newPage(); await customer.goto(BASE + "/d/riverside/");
  await customer.waitForFunction(() => window.shedUI?.ready, null, { timeout: 60000 });
  check("the customer's building includes the owner's right-side door", (await state(customer)).some(i => i.cat === "d36lite" && i.wall === "R"));
  check("saving keeps the three-inch move after setting an end gap", Math.abs((await state(customer)).find(i => i.cat === "d36lite" && i.wall === "R").pos - doorAfter) < 1 / 192);
  check("customer mode has no standard-layout save bar", await customer.locator("#layout-savebar").count() === 0);
  await customer.close(); await page.close();

  for (const colorScheme of SCHEMES) for (const width of WIDTHS) {
    const phone = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 1000 }, colorScheme, reducedMotion: "reduce", hasTouch: true, isMobile: width === 390 });
    await phone.addCookies([{ name: "dealer_local_user", value: "chris%40samplebarns.example", url: BASE }]);
    const p = await open(phone, "C");
    await p.addStyleTag({ content: ".test-app-header { position:fixed;inset:0 0 auto;height:100px;z-index:35;background:#16130e;color:white; }" });
    await p.evaluate(() => { const h = document.createElement("div"); h.className = "test-app-header"; h.textContent = "Phone app header"; document.body.append(h); });
    await p.locator('.layout-wallchoices [data-layout-view="PF"]').click();
    await select(p, "ppost", "F");
    await p.waitForTimeout(400);
    const g = await geometry(p);
    await p.screenshot({ path: resolve(OUT, `layout-sheet-${width}-${colorScheme}.png`) });
    check(`${width} ${colorScheme}: no sideways scrolling`, g.overflow <= 1);
    check(`${width} ${colorScheme}: Move and sheet buttons stay above the bar ${JSON.stringify(g)}`, g.controls.every(c => c.top >= 100 && c.bottom <= g.bar + 1 && c.width >= 44 && c.height >= 44));
    const chosen = await p.evaluate(() => window.shedUI.getState().sel);
    const previous = (await state(p)).find(i => i.id === chosen).pos;
    await p.locator("#layout-right").click();
    check(`${width} ${colorScheme}: a post moves while selected`, Math.abs((await state(p)).find(i => i.id === chosen).pos - previous - .25) < .001);
    await p.locator("#sh-dup").click();
    const posts = (await state(p)).filter(i => i.cat === "ppost");
    check(`${width} ${colorScheme}: adding another post leaves room`, posts.every((a, i) => posts.every((b, j) => i === j || Math.abs(a.pos - b.pos) >= .67 - .001)));
    await p.screenshot({ path: resolve(OUT, `layout-porch-${width}-${colorScheme}.png`), fullPage: true });
    if (width === 390 && colorScheme === "light") {
      await p.evaluate(() => window.shedUI.select(null));
      await p.locator('.layout-wallchoices [data-layout-view="F"]').click();
      /* Scroll the drawing below the simulated app header, as a person
         would. A generic locator scroll does not account for that header. */
      await p.locator("#stage").evaluate(el => window.scrollBy(0, el.getBoundingClientRect().top - 120));
      await p.waitForTimeout(300);
      const ghost = p.locator('.layout-posthit.ghost:not(.fixed)').first();
      await ghost.waitFor({ state: "visible" });
      const ghostId = await ghost.getAttribute("data-item"), beforeTap = await state(p);
      const ghostHit = await ghost.boundingBox();
      await p.touchscreen.tap(ghostHit.x + ghostHit.width / 2, ghostHit.y + ghostHit.height / 2);
      check("a phone tap on a dashed post opens Porch and selects that post", await p.evaluate(id => window.shedUI.layoutMode.view === "PF" && window.shedUI.getState().sel === id, ghostId));
      check("tapping the dashed post leaves the wall's door and windows alone", JSON.stringify((await state(p)).filter(i => i.cat !== "ppost")) === JSON.stringify(beforeTap.filter(i => i.cat !== "ppost")));
      /* A slow, careful press: the finger rests on the dashed post for two
         seconds before it lifts. The click that follows the lift must not
         pick the post that now sits under the finger on the Porch view. */
      await p.evaluate(() => window.shedUI.select(null));
      await p.locator('.layout-wallchoices [data-layout-view="F"]').click();
      await p.locator("#stage").evaluate(el => window.scrollBy(0, el.getBoundingClientRect().top - 120));
      await p.waitForTimeout(300);
      const heldHit = await p.locator(`.layout-posthit.ghost[data-item="${ghostId}"]`).boundingBox(), held = { x: heldHit.x + heldHit.width / 2, y: heldHit.y + heldHit.height / 2 };
      const holdCdp = await phone.newCDPSession(p);
      await holdCdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [held] });
      await p.waitForTimeout(2000);
      await holdCdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await p.waitForTimeout(400);
      check("a two-second press on a dashed post still picks that post", await p.evaluate(id => window.shedUI.layoutMode.view === "PF" && window.shedUI.getState().sel === id, ghostId));
      const selected = p.locator(`.layout-posthit.solid[data-item="${ghostId}"]`);
      await p.waitForTimeout(300);
      const hit = await selected.boundingBox(), clearance = await p.evaluate(() => ({ sheet: document.getElementById("sheet").getBoundingClientRect().top, bar: document.getElementById("layout-savebar").getBoundingClientRect().top }));
      const showing = Math.max(0, Math.min(hit.y + hit.height, clearance.sheet, clearance.bar) - Math.max(hit.y, 100));
      check("a picked phone post remains at least half visible above its sheet", showing >= hit.height / 2 - 1);
      check("the phone post's touch target is at least 44 px", hit.width >= 44 && hit.height >= 44);
      const cdp = await phone.newCDPSession(p), start = { x: hit.x + hit.width / 2, y: Math.max(104, hit.y + Math.min(hit.height / 2, showing / 2)) };
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [start] });
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ ...start, x: start.x + 24 }] });
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      check("a real phone drag moves the selected porch post", Math.abs((await state(p)).find(i => i.id === ghostId).pos - beforeTap.find(i => i.id === ghostId).pos) > .05);
      await p.evaluate(() => window.shedUI.select(null));
      const fixed = p.locator('.layout-posthit.fixed').first(), unchanged = await state(p);
      await fixed.tap();
      check("a corner post explains why it stays and changes no items", /hold up the porch roof, so they stay/.test(await p.locator("#layout-notice").innerText()) && JSON.stringify(await state(p)) === JSON.stringify(unchanged));
      /* The keyboard still picks a dashed post: Enter on its button. */
      await p.locator('.layout-wallchoices [data-layout-view="F"]').click();
      await p.waitForTimeout(300);
      await p.locator(`.layout-posthit.ghost[data-item="${ghostId}"]`).focus();
      await p.keyboard.press("Enter");
      await p.waitForTimeout(300);
      check("Enter on a dashed post's button picks that post", await p.evaluate(id => window.shedUI.layoutMode.view === "PF" && window.shedUI.getState().sel === id, ghostId));
    }
    await p.close(); await phone.close();
  }
  const sc = await open(context, "SC");
  await sc.locator('.layout-wallchoices [data-layout-view="PR"]').click();
  check("Side Cabin exposes every porch the customer can pick", await sc.locator("#layout-porch-select option").count() >= 6);
  await sc.getByRole("button", { name: "+ Porch post", exact: true }).click();
  const checked = await sc.evaluate(() => window.shedUI.layoutMode.check());
  check("new Side Cabin posts stay clear on every size and porch", !checked.warnings.some(w => /two porch posts/i.test(w)));
  await sc.locator("#sh-del").click();
  check("Remove deletes the selected porch post", (await state(sc)).filter(i => i.cat === "ppost").length === 2);
  await sc.close();

  /* After Save as standard the result box keeps its heading, its close
     button and its way-out buttons on the screen: below a phone app's own
     100 px header and above the save bar. A change after a save says it is
     not saved, and Cancel and Start again ask in the page with named buttons. */
  for (const colorScheme of SCHEMES) for (const width of WIDTHS) {
    const height = width === 390 ? 844 : width === 820 ? 1180 : 800;
    const ctx = await browser.newContext({ viewport: { width, height }, colorScheme, reducedMotion: "reduce", hasTouch: true, isMobile: width === 390 });
    await ctx.addCookies([{ name: "dealer_local_user", value: "chris%40samplebarns.example", url: BASE }]);
    const r = await open(ctx, "C"), label = `${width} ${colorScheme}`, browserBoxes = [];
    r.on("dialog", (dialog) => { browserBoxes.push(dialog.message()); dialog.dismiss(); });
    await r.addStyleTag({ content: ".test-app-header { position:fixed;inset:0 0 auto;height:100px;z-index:35;background:#16130e;color:white; }" });
    await r.evaluate(() => { const h = document.createElement("div"); h.className = "test-app-header"; h.textContent = "Phone app header"; document.body.append(h); });
    const header = width === 1280 ? 0 : 100;
    await r.locator('.layout-wallchoices [data-layout-view="PF"]').click();
    await select(r, "ppost", "F");
    await r.locator("#layout-right").click();
    const words = await r.evaluate(() => ({ chips: document.getElementById("sizechips").innerText, caption: document.getElementById("layout-caption").innerText }));
    check(`${label}: the layout screen writes sizes 8×12 and whole-dollar prices ${JSON.stringify(words.chips.slice(0, 60))}`, /\d+×\d+/.test(words.chips) && !/\d \u00d7 \d/.test(words.chips + words.caption) && !/\.\d\d\b/.test(words.chips) && /\$\d/.test(words.chips));
    await r.locator("#layout-save").click();
    await r.waitForFunction(() => /Saved/.test(document.querySelector("#layout-result h2")?.textContent || ""), null, { timeout: 60000 });
    await r.waitForTimeout(200);
    const box = await r.evaluate(() => {
      const at = (node) => { const b = node.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom) }; };
      return { h2: at(document.querySelector("#layout-result h2")), close: at(document.getElementById("layout-resultclose")),
        buttons: [...document.querySelectorAll(".layout-resultbuttons button")].map((b) => ({ text: b.textContent, ...at(b) })),
        bar: Math.round(document.getElementById("layout-savebar").getBoundingClientRect().top), screen: innerHeight };
    });
    await r.screenshot({ path: resolve(OUT, `layout-result-${width}-${colorScheme}.png`) });
    const floor = Math.min(box.bar, box.screen);
    check(`${label}: the saved result's heading and close button sit below the app header ${JSON.stringify(box)}`, box.h2.top >= header && box.close.top >= header);
    check(`${label}: the saved result's buttons are on the screen above the save bar`, box.buttons.length > 0 && box.buttons.some((b) => /Back to Edit building/.test(b.text)) && box.buttons.every((b) => b.top >= header && b.bottom <= floor));
    await r.locator("#layout-resultclose").click();
    check(`${label}: right after a save the bar says it saved`, /Saved for every lot/.test(await r.locator("#layout-savewords").innerText()));
    await select(r, "ppost", "F");
    await r.locator("#layout-right").click();
    check(`${label}: a move after a save says it is not saved yet`, /Not saved yet/.test(await r.locator("#layout-savewords").innerText()));
    await r.locator("#layout-cancel").click();
    const ask = r.locator("#layout-ask");
    await ask.waitFor({ state: "visible" });
    const askBox = await ask.boundingBox();
    check(`${label}: Cancel asks in the page with named buttons`, browserBoxes.length === 0 && /Leave without saving the layout/.test(await ask.innerText())
      && await r.getByRole("button", { name: "Leave without saving", exact: true }).isVisible() && await r.getByRole("button", { name: "Keep changing it", exact: true }).isVisible());
    check(`${label}: the question sits below the app header and above the save bar`, askBox.y >= header && askBox.y + askBox.height <= floor);
    await r.getByRole("button", { name: "Keep changing it", exact: true }).click();
    check(`${label}: Keep changing it stays in the layout`, await ask.waitFor({ state: "detached", timeout: 5000 }).then(() => true, () => false) && /layout=C/.test(r.url()));
    await r.evaluate(() => window.shedUI.select(null));
    await r.locator("#layout-builder").evaluate((node) => node.click());
    await ask.waitFor({ state: "visible" });
    check(`${label}: Start again asks in the page with named buttons`, browserBoxes.length === 0 && await r.getByRole("button", { name: "Start again", exact: true }).isVisible() && await r.getByRole("button", { name: "Keep mine", exact: true }).isVisible());
    await r.getByRole("button", { name: "Keep mine", exact: true }).click();
    await ask.waitFor({ state: "detached", timeout: 5000 });
    await r.locator("#layout-cancel").click();
    await r.getByRole("button", { name: "Leave without saving", exact: true }).click();
    await r.waitForURL(/\/dealer/, { timeout: 30000 }).catch(() => {});
    check(`${label}: Leave without saving goes back to the Dealer Center`, /\/dealer/.test(r.url()) && browserBoxes.length === 0);
    await r.close(); await ctx.close();
  }
  /* The Edit page's layout card writes a porch post in small letters. */
  const edit = await context.newPage(); await edit.goto(`${BASE}/dealer#/price-list/building/C`);
  await edit.locator(".pl-layout-card .pl-layout-list li").first().waitFor({ timeout: 60000 });
  const cardWords = await edit.locator(".pl-layout-card .pl-layout-list").innerText();
  check(`the Edit page says "porch post" in small letters mid-sentence ${JSON.stringify(cardWords.slice(0, 160))}`, /porch post/.test(cardWords) && !/Porch Post/.test(cardWords));
  await edit.close();
  check("the layout editor had no browser errors", page.errors.length === 0);
  await context.close();
  console.log(`PROVED (${passed} checks): checked owner layouts reach customers, three-inch moves and included items persist, phone and tablet sheets stay reachable, and added posts stay clear on every porch.`);
} finally {
  await browser?.close(); server.kill("SIGTERM");
}
