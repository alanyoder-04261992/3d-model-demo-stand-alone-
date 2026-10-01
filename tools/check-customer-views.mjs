/* CHECK: customer view behavior without a browser. Construction machinery is
   deliberately unavailable in the fake page API, so a regression that tries
   to read geometry, construct framing or run a player fails immediately.
   Run: node tools/check-customer-views.mjs            (check-all: node) */
import assert from "node:assert/strict";
import { install, VIEW_NAMES } from "../ui/views.js";

let checks = 0;
function check(name, fn) { fn(); checks++; console.log("  ok   " + name); }
function page(features = {}) {
  const elements = [];
  const element = () => {
    const classes = new Set();
    const node = {
      children: [], attributes: {},
      appendChild(child) { this.children.push(child); },
      setAttribute(key, value) { this.attributes[key] = value; },
      classList: { toggle(key, value) { if (value) classes.add(key); else classes.delete(key); }, contains: key => classes.has(key) },
    };
    elements.push(node); return node;
  };
  globalThis.document = { createElement: element, head: element(), getElementById: id => elements.find(e => e.id === id) };
  const events = {}, mount = element();
  let mode = "out", hides = 0;
  const api = {
    mounts: { view: mount }, stage: element(), getCatalogue: () => ({ features }),
    getMode: () => mode,
    setMode(value) { mode = value; for (const fn of events.mode || []) fn({ mode }); },
    hideAddPop() { hides++; },
    on(name, fn) { (events[name] ||= []).push(fn); },
  };
  for (const key of ["renderer", "getResult", "getPlan", "getBuildOptions", "setBuildOptions", "rebuild", "select"]) {
    Object.defineProperty(api, key, { get() { throw new Error("Customer views must not use construction work: " + key); } });
  }
  const views = install(api);
  return { api, views, elements, mount, events, get hides() { return hides; }, tabs: () => mount.children[0]?.children || [] };
}
try {
  check("only the two customer view names are supported", () => assert.deepEqual(VIEW_NAMES, ["finished", "inside"]));
  const p = page({ floorPlan: true, framingView: true, buildPlayback: true });
  check("old framing and playback flags cannot expose construction controls", () => {
    assert.deepEqual(p.views.offered(), ["finished", "inside"]);
    assert.deepEqual(p.tabs().map(t => t.textContent), ["Outside", "Inside"]);
    assert.ok(p.tabs()[0].classList.contains("on"));
    assert.equal(p.tabs()[0].attributes["aria-pressed"], "true");
    assert.deepEqual(Object.keys(p.events), ["mode"]);
    assert.ok(!p.elements.some(e => e.id === "vw-player" || e.id === "vw-note"));
    for (const key of ["play", "pause", "steps", "caption"]) assert.equal(p.views[key], undefined);
  });
  check("the Inside button opens the floor plan plugin and updates accessible selection", () => {
    let requests = 0;
    p.api.onInside = req => { requests++; assert.equal(req.want, "in"); p.api.setMode("in"); };
    p.tabs()[1].onclick();
    assert.equal(requests, 1); assert.equal(p.api.getMode(), "in"); assert.equal(p.views.view, "inside");
    assert.equal(p.tabs()[1].attributes["aria-pressed"], "true");
    assert.equal(p.tabs()[0].attributes["aria-pressed"], "false");
  });
  check("Outside returns from the plan without reading geometry or rebuilding", () => {
    p.tabs()[0].onclick(); assert.equal(p.api.getMode(), "out"); assert.equal(p.views.view, "finished"); assert.equal(p.hides, 2);
  });
  check("the original mode bar and interior item changes keep tabs in sync", () => {
    p.api.setMode("in"); assert.equal(p.views.view, "inside"); assert.ok(p.tabs()[1].classList.contains("on"));
    p.api.setMode("out"); assert.equal(p.views.view, "finished");
  });
  check("removed construction views cannot be activated through the API", () => {
    for (const name of ["framing", "build"]) assert.throws(() => p.views.set(name), /not a customer view/);
    assert.equal(p.api.getMode(), "out");
  });
  check("a disabled floor plan has no redundant switcher and cannot be opened", () => {
    const q = page({ floorPlan: false, framingView: true, buildPlayback: true });
    assert.deepEqual(q.views.offered(), ["finished"]); assert.equal(q.tabs().length, 0);
    assert.equal(q.views.set("inside"), "finished"); assert.equal(q.api.getMode(), "out");
  });
  check("the floor plan mode has a fallback before its drawing plugin installs", () => {
    const q = page(); q.views.set("inside"); assert.equal(q.api.getMode(), "in"); assert.equal(q.views.view, "inside");
  });
  console.log(`PROVED: ${checks} customer view behavior checks passed; Outside/Inside switch without geometry access, rebuilding or construction controls.`);
} finally { delete globalThis.document; }
