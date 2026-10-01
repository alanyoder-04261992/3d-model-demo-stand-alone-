/* CUSTOMER VIEWS: the finished building and its dimensioned floor plan.
   Installed by ui/app.js after the first picture. Construction lessons and
   their part descriptions belong to the separate internal learning pages.
   Switching customer views never rebuilds or scans the building's geometry. */

export const VIEW_NAMES = Object.freeze(["finished", "inside"]);

function injectCss() {
  if (document.getElementById("vw-css")) return;
  const link = document.createElement("link");
  link.id = "vw-css";
  link.rel = "stylesheet";
  link.href = new URL("./views.css", import.meta.url).href;
  document.head.appendChild(link);
}

export function install(api) {
  const mount = api.mounts && api.mounts.view;
  if (!mount || !api.stage) return null;
  const shown = api.getCatalogue().features?.floorPlan === false
    ? ["finished"] : VIEW_NAMES.slice();
  const tabs = {};
  let view = api.getMode() === "in" && shown.includes("inside") ? "inside" : "finished";
  injectCss();

  if (shown.length > 1) {
    const group = document.createElement("div");
    group.className = "vw-tabs";
    group.setAttribute("role", "group");
    group.setAttribute("aria-label", "What to show");
    for (const name of shown) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "vw-tab";
      button.setAttribute("data-view", name);
      button.textContent = name === "finished" ? "Outside" : "Inside";
      button.title = name === "finished" ? "The finished building" : "The floor plan, from above";
      button.onclick = () => setView(name);
      group.appendChild(button);
      tabs[name] = button;
    }
    mount.appendChild(group);
  }

  function updateTabs() {
    for (const [name, button] of Object.entries(tabs)) {
      button.classList.toggle("on", name === view);
      button.setAttribute("aria-pressed", String(name === view));
    }
  }

  function setView(name) {
    if (!VIEW_NAMES.includes(name)) throw new Error(`views: "${name}" is not a customer view (${VIEW_NAMES.join(", ")})`);
    if (!shown.includes(name)) return view;
    api.hideAddPop();
    const mode = name === "inside" ? "in" : "out";
    if (mode === "in" && api.getMode() !== "in" && typeof api.onInside === "function") {
      try { api.onInside({ want: "in", reason: "views" }, api); }
      catch (error) { console.error("The Inside view failed:", error); }
    }
    if (api.getMode() !== mode) api.setMode(mode);
    view = name;
    updateTabs();
    return view;
  }

  /* The Inside bar and interior item controls also change the current mode. */
  api.on("mode", (detail) => {
    view = detail.mode === "in" && shown.includes("inside") ? "inside" : "finished";
    updateTabs();
  });
  updateTabs();
  const controller = { offered: () => shown.slice(), set: setView };
  Object.defineProperty(controller, "view", { get: () => view, enumerable: true });
  api.views = controller;
  return controller;
}

export default install;
