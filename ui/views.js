/* THE VIEW SWITCHER: Outside, Inside, Framing and "Watch it build".
   Browser file, a plugin of the designer page (ui/app.js loads it first,
   after the first picture, and calls install(api) with window.shedUI).

   What the customer sees: four buttons over the top-left of the 3D picture.
     Outside         the finished building, exactly as Barnwright draws it.
     Inside          the floor plan (ui/blueprint.js draws it; this only asks
                     for it through shedUI.onInside, or shedUI.setMode("in")
                     when no floor-plan plugin is there).
     Framing         the lumber inside the building: blocks, skids, joists,
                     studs, trusses, the loft and the roof deck -- the siding,
                     roofing, doors and windows are hidden. A short line says
                     the sizes, filled in from the company's own construction
                     numbers (plan.construction), never typed here.
     Watch it build  the building put together in the order the shop builds
                     it (plan.construction.buildOrder): each step is lowered
                     into place from 3 ft up (about 0.9 s, eased), with a
                     caption naming the step and saying what it is in real
                     life (each part's own realLife sentence, filled from the
                     company's numbers). Play / pause, previous, next, start
                     again and a step counter; a step this building has
                     nothing for is skipped; at the end it becomes Outside.
                     A visitor who asks for reduced motion gets the steps
                     without the lowering.
   Framing and Watch it build are offered only when the company's settings
   allow them (features.framingView / features.buildPlayback) and the browser
   can draw 3D at all. Inside is offered unless features.floorPlan is false.

   HOW IT WORKS (docs/ARCHITECTURE.md, "Views"):
   * every triangle carries its building step (parts/stages.js); the renderer
     hides or lifts whole steps with one small table (renderer.setStages), so
     switching views never redraws the building from scratch -- except that
   * the framing is only BUILT while Framing or Watch it build is on the
     screen (shedUI.setBuildOptions({frames: true})). Back on Outside it is
     switched off again, so a colour tap or a drag in the finished view costs
     exactly what it did before this file existed.
   * a door or window the view hides cannot be tapped: the tap targets carry
     their step and ui/interaction.js skips the hidden ones. Going into
     Framing or Watch it build also puts down whatever was selected.

   For checks and other plugins it hangs a small controller on the page API:
   shedUI.views = { view, set(name), steps(), step(), playing(), play(),
   pause(), next(), prev(), restart(), caption(), framingNote(), message(),
   timeScale }.
   If the framing cannot be drawn for a building (a part fails), Framing and
   Watch it build go back to Outside with a plain-words message instead of
   showing an empty yard; a company whose build order names no step of the
   building gets "Nothing to show step by step" instead of an empty player.

   The pure helpers at the top (stageTriangles, stagesPresent, partCatalogue,
   stageCaption, buildSteps, framingSummary) are also used by the parts gallery
   (ui/parts-gallery.js). They touch no page. */

import { STAGES, STAGE_ID, buildVisibility } from "../parts/stages.js";
import { PIPELINE, fillRealLife } from "../parts/index.js";
import { DRAW_MODULES } from "../parts/openings/index.js";
import { stageTableFor, stageTableFromBuild } from "../engine/renderer.js";
import { esc } from "./esc.js";

export const VIEW_NAMES = Object.freeze(["finished", "inside", "framing", "build"]);
export const LIFT_FT = 3;          /* each step is lowered from 3 ft up */
export const DROP_MS = 900;        /* ... over about 0.9 s */
export const HOLD_MS = 1500;       /* then it rests this long before the next step */

/* ------------------------------------------------------------------------
   PURE HELPERS (no page) */

const stagesOf = (m) => (Array.isArray(m.stage) ? m.stage : [m.stage]);

/* How many triangles each part drew on each building step:
   Map stageKey -> Map part label -> count, in drawing order. Reads the 9th
   number of each triangle's first corner (every corner of a triangle carries
   the same step). */
export function stageTriangles(build) {
  const out = new Map();
  const add = (sid, part, n) => {
    const st = STAGES[sid];
    if (!st || !n) return;
    let s = out.get(st.key);
    if (!s) { s = new Map(); out.set(st.key, s); }
    s.set(part, (s.get(part) || 0) + n);
  };
  /* counted in runs of triangles on the same step, so a big framing build
     costs one lookup per run, not one per triangle */
  const run = (v, from, to, part) => {
    let sid = -1, n = 0;
    for (let tri = from; tri < to; tri++) {
      const x = v[tri * 27 + 8];
      if (x !== sid) { add(sid, part, n); sid = x; n = 0; }
      n++;
    }
    add(sid, part, n);
  };
  for (const k of build.ORDER) {
    const b = build.buckets[k];
    if (!b || !b.n) continue;
    const segs = build.tags && build.tags[k];
    if (segs && segs.length) for (const sg of segs) run(b.v, sg.from, sg.from + sg.count, sg.part);
    else run(b.v, 0, Math.floor(b.v.length / 27), "?");
  }
  return out;
}

/* Which building steps this drawing has triangles on, and which parts drew
   them: Map stageKey -> Set of part labels, in drawing order. */
export function stagesPresent(build, counts) {
  const out = new Map();
  for (const [key, parts] of (counts || stageTriangles(build))) out.set(key, new Set(parts.keys()));
  return out;
}

/* Every part module and the part labels triangles carry, in PIPELINE order:
   { order: [label...], byId: {id: module}, byLabel: {label: [module...]} }.
   A label is usually a module's own id; the porch label is also drawn by the
   porch-junction entry, and the door/window labels by the draw modules of
   parts/openings/. */
let PARTCAT = null;
export function partCatalogue() {
  if (PARTCAT) return PARTCAT;
  const byId = {}, byLabel = {}, order = [];
  for (const en of PIPELINE) if (en.module && en.module.id) byId[en.module.id] = en.module;
  for (const m of DRAW_MODULES) byId[m.id] = m;
  for (const en of PIPELINE) for (const tag of en.tags) if (order.indexOf(tag) < 0) order.push(tag);
  for (const tag of order) {
    const list = [];
    if (byId[tag] && tag !== "openings") list.push(byId[tag]);
    for (const en of PIPELINE) if (en.part === tag && en.module && list.indexOf(en.module) < 0) list.push(en.module);
    byLabel[tag] = list;
  }
  PARTCAT = Object.freeze({ order: Object.freeze(order), byId: Object.freeze(byId), byLabel: Object.freeze(byLabel) });
  return PARTCAT;
}

/* The caption for one building step: { key, title, lines: [{id, name, text}] }.
   `labels` is the set of part labels this building has on that step
   (stagesPresent). Each label's own part tells what it is in real life,
   filled from plan.construction; a part whose MAIN step is this one is
   preferred (the roofing's rake boards are on the trim step, but the trim
   step is about the corner trim) -- unless `counts` (that step's
   Map label -> triangles, from stageTriangles) shows another part carrying
   at least a quarter of what lands on the step: then it is told too (the
   porch's own corner posts and beam land on "Porch posts and beam", beside
   the extra post a customer adds). The part named after the step leads
   (Roof framing before the gable studs). */
export const CAPTION_SHARE = 0.25;
export function stageCaption(stageKey, labels, construction, counts) {
  const st = STAGES[STAGE_ID[stageKey]];
  const pc = partCatalogue();
  const want = pc.order.filter((t) => labels && labels.has(t));
  let total = 0;
  if (counts) for (const t of want) total += counts.get(t) || 0;
  const main = [], big = [], rest = [];
  for (const tag of want) {
    const cands = pc.byLabel[tag] || [];
    let p = cands.filter((m) => stagesOf(m)[0] === stageKey);
    const isMain = p.length > 0;
    if (!p.length) p = cands.filter((m) => stagesOf(m).indexOf(stageKey) >= 0);
    if (!p.length && cands.length) p = [cands[0]];
    const large = !!counts && total > 0 && (counts.get(tag) || 0) >= total * CAPTION_SHARE;
    for (const m of p) {
      const into = isMain ? main : (large ? big : rest);
      if (main.indexOf(m) < 0 && big.indexOf(m) < 0 && rest.indexOf(m) < 0) into.push(m);
    }
  }
  const use = main.length ? main.concat(big) : big.concat(rest);
  const lead = use.findIndex((m) => m.id === stageKey);
  if (lead > 0) use.unshift(use.splice(lead, 1)[0]);
  return {
    key: stageKey,
    title: st ? st.name : stageKey,
    lines: use.map((m) => ({ id: m.id, name: m.name, text: fillRealLife(m.realLife, construction || {}).text })),
  };
}

/* The steps Watch it build plays for this building: the company's build
   order, less any step this building has nothing on (and any name that is not
   a building step). */
export function buildSteps(order, present) {
  const out = [];
  for (const k of order || []) {
    if (STAGE_ID[k] === undefined || out.indexOf(k) >= 0) continue;
    if (present && !present.has(k)) continue;
    out.push(k);
  }
  return out;
}

/* One line for the Framing view, from the company's numbers. */
export const FRAMING_SUMMARY = "{walls.stud} studs {walls.spacingIn} in on centre · {roof.chord} trusses {roof.spacingIn} in on centre · {floor.joist} floor joists {floor.spacingIn} in on centre";
export function framingSummary(construction) {
  return fillRealLife(FRAMING_SUMMARY, construction || {}).text;
}

/* ------------------------------------------------------------------------
   THE PLUGIN */

function injectCss() {
  if (document.getElementById("vw-css")) return;
  const l = document.createElement("link");
  l.id = "vw-css"; l.rel = "stylesheet";
  l.href = new URL("./views.css", import.meta.url).href;
  document.head.appendChild(l);
}

function easeOutCubic(t) { t = Math.max(0, Math.min(1, t)); return 1 - Math.pow(1 - t, 3); }

export function install(api) {
  const cat = api.getCatalogue();
  const feats = cat.features || {};
  const renderer = api.renderer, stage = api.stage, mount = api.mounts && api.mounts.view;
  if (!mount || !stage) return null;
  const can3d = !(renderer && renderer.off);
  const offer = {
    finished: true,
    inside: feats.floorPlan !== false,
    framing: can3d && feats.framingView !== false,
    build: can3d && feats.buildPlayback !== false,
  };
  let reduced = false;
  try { reduced = matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { reduced = false; }

  injectCss();

  /* ---- the buttons ---- */
  const LABELS = { finished: ["Outside", "Outside"], inside: ["Inside", "Inside"], framing: ["Framing", "Framing"], build: ["Watch it build", "Build"] };
  const TIPS = {
    finished: "The finished building",
    inside: "The floor plan, from above",
    framing: "The lumber inside the walls, floor and roof",
    build: "Watch the building go together, step by step",
  };
  const shown = VIEW_NAMES.filter((v) => offer[v]);
  const tabs = {};
  if (shown.length > 1) {
    const grp = document.createElement("div");
    grp.className = "vw-tabs"; grp.setAttribute("role", "group"); grp.setAttribute("aria-label", "What to show");
    for (const v of shown) {
      const b = document.createElement("button");
      b.type = "button"; b.className = "vw-tab"; b.setAttribute("data-view", v);
      b.title = TIPS[v];
      b.innerHTML = '<span class="vw-long">' + esc(LABELS[v][0]) + '</span><span class="vw-short">' + esc(LABELS[v][1]) + "</span>";
      b.onclick = () => setView(v, "button");
      grp.appendChild(b);
      tabs[v] = b;
    }
    mount.appendChild(grp);
  }

  /* ---- the Framing note ---- */
  const note = document.createElement("div");
  note.className = "vw-note"; note.id = "vw-note"; note.hidden = true;
  stage.appendChild(note);

  /* ---- the Watch it build player ---- */
  const player = document.createElement("div");
  player.className = "vw-player"; player.id = "vw-player"; player.hidden = true;
  player.innerHTML =
    '<div class="vw-cap"><div class="vw-head"><div class="vw-step" id="vw-step" aria-live="polite"></div>' +
      '<button type="button" data-act="more" id="vw-more" class="vw-more" aria-expanded="false" aria-controls="vw-text">More</button></div>' +
      '<div class="vw-text" id="vw-text"></div></div>' +
    '<div class="vw-bar"><i id="vw-fill"></i></div>' +
    '<div class="vw-ctl">' +
      '<button type="button" data-act="restart" id="vw-restart" title="Start again" aria-label="Start again">&#8634;</button>' +
      '<button type="button" data-act="prev" id="vw-prev" title="Previous step" aria-label="Previous step">&#9664;</button>' +
      '<button type="button" data-act="play" id="vw-play" class="vw-main" title="Pause" aria-label="Pause">&#10074;&#10074;</button>' +
      '<button type="button" data-act="next" id="vw-next" title="Next step" aria-label="Next step">&#9654;</button>' +
      '<span class="vw-count" id="vw-count"></span>' +
      '<button type="button" data-act="end" id="vw-end" class="vw-endbtn" title="Show the finished building">Finished</button>' +
    "</div>";
  stage.appendChild(player);
  const $ = (id) => document.getElementById(id);
  player.addEventListener("click", (e) => {
    const b = e.target.closest ? e.target.closest("button[data-act]") : null;
    if (!b) return;
    const a = b.getAttribute("data-act");
    if (a === "restart") restart();
    else if (a === "prev") prev();
    else if (a === "next") next();
    else if (a === "play") { if (playing) pause(); else play(); }
    else if (a === "end") finish();
    else if (a === "more") { expanded = !expanded; drawPlayer(); }
  });

  /* ON A SMALL SCREEN THE CAPTION FOLDS TO ONE LINE, so the step being put
     together (blocks, skids, the floor) is not hidden behind it; "More"
     opens the full sentence. On a bigger picture it is open from the start. */
  let expanded = null;          /* null: decided by the size of the picture */
  function compactNow() {
    if (expanded !== null) return !expanded;
    return stage.clientHeight < 640 || stage.clientWidth < 600;
  }

  /* ---- state ---- */
  let view = "finished";
  let steps = [], k = 0, present = new Map(), counts = new Map(), playing = false;
  let stepStart = 0, raf = 0, flashTimer = 0;
  const ctl = { timeScale: 1 };

  function stageClass() {
    stage.classList.toggle("vw-framing", view === "framing");
    stage.classList.toggle("vw-build", view === "build");
    for (const v in tabs) {
      tabs[v].classList.toggle("on", v === view);
      tabs[v].setAttribute("aria-pressed", v === view ? "true" : "false");
    }
  }

  /* build the framing, or stop building it; false when the building could
     not be drawn that way (a part failed -- the page keeps its last picture) */
  function framesOn(want) {
    const cur = !!api.getBuildOptions().frames;
    if (cur !== want) return api.setBuildOptions({ frames: want }) != null;
    return true;
  }

  function readBuild() {
    const res = api.getResult();
    counts = res && res.build ? stageTriangles(res.build) : new Map();
    present = stagesPresent(null, counts);
    const plan = api.getPlan();
    const order = plan && plan.construction && plan.construction.buildOrder;
    const old = steps[k];
    steps = buildSteps(order, present);
    const at = old ? steps.indexOf(old) : -1;
    k = at >= 0 ? at : Math.max(0, Math.min(k, steps.length - 1));
  }

  function setView(v, why) {
    if (VIEW_NAMES.indexOf(v) < 0) throw new Error(`views: "${v}" is not a view (${VIEW_NAMES.join(", ")})`);
    if (!offer[v]) return view;
    stopTimer();
    playing = false;
    api.hideAddPop();        /* a menu opened (unseen) in Framing must not pop up on Outside */
    clearFlash();
    const was = view;
    view = v;
    if (v !== "inside" && api.getMode() === "in") api.setMode("out");
    if (v === "finished" || v === "inside") {
      framesOn(false);
      renderer.setStages(stageTableFor("finished"));
    }
    if (v === "framing" || v === "build") {
      if (api.getState().sel) api.select(null);   /* nothing selected that this view may hide */
      if (!framesOn(true)) {
        /* the framing could not be drawn for this building: showing the
           finished building with its finish hidden would be an empty yard,
           so go back to Outside and say why in plain words */
        view = "finished";
        framesOn(false);
        renderer.setStages(stageTableFor("finished"));
        player.hidden = true;
        stageClass(); drawNote();
        flash("The framing for this building could not be drawn just now, so here is the finished building.");
        renderer.needsDraw = true;
        return view;
      }
    }
    if (v === "framing") renderer.setStages(stageTableFor("framing"));
    if (v === "inside" && api.getMode() !== "in") {
      let done = false;
      if (typeof api.onInside === "function") {
        try { api.onInside({ want: "in", reason: "views" }, api); done = api.getMode() === "in"; }
        catch (e) { console.error("The Inside view failed:", e); }
      }
      if (!done) api.setMode("in");
    }
    stageClass();
    if (v === "build") {
      readBuild();
      k = 0;
      showStep(0);
      if (steps.length) play();
    } else {
      player.hidden = true;
    }
    drawNote();
    if (was !== v) renderer.needsDraw = true;
    return view;
  }

  /* a short plain-words message in the note's place, gone after 8 s or at
     the next switch */
  function clearFlash() { if (flashTimer) clearTimeout(flashTimer); flashTimer = 0; note.classList.remove("vw-flash"); }
  function flash(msg) {
    clearFlash();
    note.textContent = msg; note.hidden = false; note.classList.add("vw-flash");
    flashTimer = setTimeout(() => { flashTimer = 0; note.classList.remove("vw-flash"); drawNote(); }, 8000);
  }

  function drawNote() {
    if (flashTimer) return;
    if (view !== "framing") { note.hidden = true; note.textContent = ""; return; }
    const plan = api.getPlan();
    note.innerHTML = "<b>Framing</b> " + esc(framingSummary(plan && plan.construction));
    note.hidden = false;
  }

  /* ---- Watch it build ---- */
  function now() { return (window.performance && performance.now) ? performance.now() : Date.now(); }
  function scale() { const s = +ctl.timeScale; return s > 0 ? s : 1; }
  /* how far up the step being placed is right now, in feet */
  function currentLift() {
    if (reduced) return 0;
    return LIFT_FT * (1 - easeOutCubic((now() - stepStart) / (DROP_MS * scale())));
  }
  function applyStep(lift) {
    if (!steps.length) { renderer.setStages(stageTableFor("finished")); return; }
    renderer.setStages(stageTableFromBuild(buildVisibility(steps, k), reduced ? 0 : Math.max(0, lift)));
  }
  function caption() {
    const plan = api.getPlan();
    const key = steps[k];
    if (!key) return { key: null, title: "", lines: [] };
    return stageCaption(key, present.get(key), plan && plan.construction, counts.get(key));
  }
  function drawPlayer() {
    player.hidden = view !== "build";
    if (view !== "build") return;
    const compact = compactNow();
    player.classList.toggle("vw-compact", compact);
    const mb = $("vw-more");
    mb.textContent = compact ? "More" : "Less";
    mb.setAttribute("aria-expanded", compact ? "false" : "true");
    if (!steps.length) {
      /* the company's build order names no step this building has */
      $("vw-step").innerHTML = "<b>Nothing to show step by step</b>";
      $("vw-text").textContent = "This company's settings list no building steps for this building. Tap Finished to see the whole building.";
      $("vw-count").textContent = "";
      $("vw-fill").style.width = "0%";
      const pb0 = $("vw-play");
      pb0.innerHTML = "&#9654;"; pb0.title = "Play"; pb0.setAttribute("aria-label", "Play");
      pb0.disabled = true; $("vw-prev").disabled = true; $("vw-next").disabled = true; $("vw-restart").disabled = true;
      return;
    }
    $("vw-play").disabled = false; $("vw-next").disabled = false; $("vw-restart").disabled = false;
    const c = caption();
    $("vw-step").innerHTML = "<b>Step " + (k + 1) + " of " + steps.length + "</b> &middot; " + esc(c.title);
    $("vw-text").innerHTML = c.lines.map((l) => "<p><b>" + esc(l.name) + ".</b> " + esc(l.text) + "</p>").join("");
    $("vw-count").textContent = (k + 1) + " / " + steps.length;
    $("vw-fill").style.width = (steps.length ? ((k + 1) / steps.length) * 100 : 0) + "%";
    const pb = $("vw-play");
    pb.innerHTML = playing ? "&#10074;&#10074;" : "&#9654;";
    pb.title = playing ? "Pause" : "Play";
    pb.setAttribute("aria-label", playing ? "Pause" : "Play");
    $("vw-prev").disabled = k <= 0;
  }
  function showStep(i) {
    k = Math.max(0, Math.min(i, steps.length - 1));
    stepStart = now();
    applyStep(currentLift());
    drawPlayer();
    kick();
  }
  function kick() { if (!raf) raf = requestAnimationFrame(tick); }
  function stopTimer() { if (raf) cancelAnimationFrame(raf); raf = 0; }
  /* one animation frame: lower the step being placed; when playing and it has
     rested long enough, go on to the next step (or, after the last, to the
     finished building) */
  function tick() {
    raf = 0;
    if (view !== "build") return;
    const t = now() - stepStart;
    const lift = currentLift();
    applyStep(lift);
    if (playing && t >= (DROP_MS + HOLD_MS) * scale()) {
      if (k >= steps.length - 1) { finish(); return; }
      showStep(k + 1);
      return;
    }
    if (lift > 0 || playing) kick();
  }
  function play() {
    if (view !== "build") { setView("build", "play"); return; }
    if (!steps.length) { drawPlayer(); return; }
    if (!playing) {
      /* carry on from where the step is: it finishes landing, then rests in full */
      const t = now() - stepStart, drop = DROP_MS * scale();
      stepStart = now() - Math.min(Math.max(t, 0), drop);
    }
    playing = true; drawPlayer(); kick();
  }
  function pause() {
    if (!playing) return;
    playing = false; drawPlayer(); kick();     /* the step being lowered still lands */
  }
  function next() {
    if (view !== "build") return;
    if (k >= steps.length - 1) { finish(); return; }
    showStep(k + 1);
  }
  function prev() { if (view === "build" && k > 0) showStep(k - 1); }
  function restart() {
    if (view !== "build") { setView("build", "restart"); return; }
    if (!steps.length) { drawPlayer(); return; }
    playing = true; showStep(0);
  }
  function finish() { playing = false; setView("finished", "end"); }

  /* ---- keep in step with the page ---- */
  /* A rebuild that throws while the framing is showing (a size or option
     whose framing cannot be drawn): go back to the finished building and say
     so, rather than leave the last framing picture on screen as if it were
     this building's. */
  api.on("rebuild-error", (d) => {
    if (view !== "framing" && view !== "build") return;
    stopTimer(); playing = false;
    view = "finished";
    if (d && d.frames) framesOn(false);
    renderer.setStages(stageTableFor("finished"));
    player.hidden = true; stageClass(); drawNote();
    flash("The framing for this building could not be drawn just now, so here is the finished building.");
    renderer.needsDraw = true;
  });
  /* Nothing is picked while the building is going together: a door that has
     already landed would open its card over the player. (In Framing the doors
     and windows are hidden, so their tap targets are skipped anyway.) */
  api.on("select", (d) => {
    if ((view === "build" || view === "framing") && d && d.id) api.select(null);
  });
  /* Something added while Framing or Watch it build is showing is hidden
     there (a door, a window) -- go back to Outside so it can be seen and
     dragged. Inside items open the floor plan themselves. */
  api.on("change", (d) => {
    if (d && d.reason === "add" && (view === "framing" || view === "build")) {
      if (api.getMode() !== "in") setView("finished", "add");
    }
  });
  api.on("rebuild", () => {
    if (view === "build") { readBuild(); applyStep(currentLift()); drawPlayer(); }
    else if (view === "framing") drawNote();
  });
  api.on("mode", (d) => {
    if (d.mode === "in" && view !== "inside") {
      /* the Inside button under the picture was pressed */
      stopTimer(); playing = false; view = "inside";
      framesOn(false); renderer.setStages(stageTableFor("finished"));
      player.hidden = true; drawNote(); stageClass();
    } else if (d.mode === "out" && view === "inside") {
      view = "finished"; stageClass();
    }
  });

  stageClass();

  Object.defineProperty(ctl, "view", { get: () => view, enumerable: true });
  Object.assign(ctl, {
    offered: () => shown.slice(),
    set: (v) => setView(v, "api"),
    steps: () => steps.slice(),
    step: () => k,
    playing: () => playing,
    play, pause, next, prev, restart, finish,
    caption, framingNote: () => (note.hidden || flashTimer ? "" : note.textContent),
    message: () => (flashTimer ? note.textContent : ""),
    reducedMotion: () => reduced,
  });
  api.views = ctl;
  return ctl;
}

export default install;
