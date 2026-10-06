/* THE PARTS GALLERY (parts.html): every real-life part of one building,
   each drawn ON ITS OWN, with what it is in real life. Browser file.

   Alan asked for "a 3D model of each part of a shed". This page is where you
   can see them: pick a company (?company=<id>, default "demo"), a style and a
   size, and every part that building has -- the skids, the floor frame, the
   studs, the trusses, the siding, the roofing, each door and window... -- is
   drawn by itself in its own picture, with:
     * its name and the building step(s) it belongs to (parts/stages.js),
     * its real-life caption, filled in from THIS company's construction
       numbers (a company with 24 in stud spacing reads "24 in on centre"),
     * the name of its skill (.claude/skills/part-<id>/SKILL.md), the notes a
       Claude session reads before changing that part -- a link when the page
       is opened on Alan's own computer, plain text on the hosted website
       (which does not serve those notes; see skillsAreServed).
   The cards come in the order the shop puts the building together (the
   company's build order), each part at its first step.
   Parts the building does not have (a dormer on a utility shed, a porch...)
   are listed at the bottom by name. The parts Alan learned in a lesson (a
   part module with `lesson`, parts/README.md) are listed apart, each a link
   to the lesson page that draws it: no building in the designer has them
   (CLAUDE.md rule 5, the designer is kept apart from the lessons).

   HOW THE PICTURES ARE MADE, cheaply:
   * ONE renderer (one WebGL context) for the whole page -- a browser allows
     only a handful of contexts, so never one per picture.
   * The building is put together ONCE with its framing
     (engine/assemble.js assemble(plan, {frames: true})), then for each part
     the drawing is filtered down to that part's triangles (onlyParts -- the
     very same filter assemble(plan, {only: [id], frames: true}) applies), so
     a part keeps exactly the paint it has on the whole building.
   * The part is moved to the middle of the picture and the camera stands
     back just far enough to fit it (a gable vent gets a close-up, the siding
     a wide shot); the yard itself is shown the way the designer shows it.
   * engine/snapshot.js draws and copies each picture in the same step, and
     the pictures are drawn one at a time with a pause between, so the page
     stays responsive while they fill in.

   Also exported for setup.html (ui/setup.js): companyFromAddress, themePage,
   showProblems, makeRenderer. They touch only the page they are given. */

import { loadCompany } from "./load.js";
import { esc, safeUrl } from "./esc.js";
import { defaults, setType, normalize } from "../model/design.js";
import { frameOf } from "../model/frame.js";
import { resetItems } from "../model/layout.js";
import * as S from "./state.js";
import { pSizes } from "../model/pricing.js";
import { makePlan } from "../model/plan.js";
import { assemble, onlyParts } from "../engine/assemble.js";
import { fitDistFor } from "../engine/camera.js";
import { createRenderer } from "../engine/renderer.js";
import { snapshotCanvas } from "../engine/snapshot.js";
import { STAGES, STAGE_ID } from "../parts/stages.js";
import { fillRealLife } from "../parts/index.js";
import { partCatalogue, stagesPresent } from "./part-details.js";

const ID_RE = /^[a-z0-9-]{2,40}$/;
export const PART_PIC = Object.freeze({ w: 320, h: 240 });
const FOVY = 0.55;                       /* the renderer's view angle, top to bottom (engine/renderer.js) */
const YAW = 0.62, PITCH = 0.3;           /* the opening three-quarter view, a little higher up */

/* ------------------------------------------------------------------------
   Shared with setup.html */

export function companyFromAddress() {
  const q = new URLSearchParams(location.search);
  const id = q.get("company") || "demo";
  return ID_RE.test(id) ? id : "demo";
}

/* The company's header and accent colours on the page (the designer works
   out ten colours from five -- ui/app.js; two are plenty here). */
export function themePage(cat) {
  const C = (cat.brand && cat.brand.colors) || {};
  const hex = (v) => (typeof v === "string" && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v.trim()) ? v.trim() : null);
  const css = [];
  if (hex(C.header)) css.push("--navy-deep:" + hex(C.header), "--navy:" + hex(C.primary || C.header));
  if (hex(C.accent)) css.push("--red:" + hex(C.accent));
  if (!css.length) return;
  const st = document.createElement("style");
  st.textContent = ":root:root{" + css.join(";") + "}";
  document.head.appendChild(st);
}

export function brandBadge(el, cat) {
  const b = cat.brand || {};
  const logo = safeUrl(b.logo, { image: true, mail: false });
  el.textContent = "";
  if (logo) { const img = document.createElement("img"); img.alt = ""; img.src = logo; el.appendChild(img); }
  else el.textContent = (b.initials || String(b.name || "").split(/\s+/).map((w) => w[0] || "").join("").slice(0, 3)).toUpperCase();
}

/* A settings problem, in plain words, in place of the page. */
export function showProblems(box, title, lines) {
  box.innerHTML = '<section class="pg-msg"><h2>' + esc(title) + "</h2><ul>" + lines.map((l) => "<li>" + esc(l) + "</li>").join("") + "</ul></section>";
}

/* One renderer for the whole page, on a canvas the visitor never sees. */
export function makeRenderer(cat) {
  const cv = document.createElement("canvas");
  cv.width = 2; cv.height = 2;
  cv.setAttribute("aria-hidden", "true");
  cv.className = "pg-offscreen";
  document.body.appendChild(cv);
  const r = createRenderer(cv, { trueColour: !!(cat.look && cat.look.trueColour), scene: (cat.look && cat.look.scene) || "studio", note: " " });
  r.test.freezeWatchdog = true;
  return r;
}

/* The design for one style and size, with its standard doors and windows. */
export function stateFor(cat, style, size) {
  const s = defaults(cat);
  if (style && Object.prototype.hasOwnProperty.call(cat.TYPES, style) && style !== s.type) setType(s, style, cat);
  if (size && pSizes(s.type, cat).indexOf(size) >= 0 && size !== s.size) {
    s.size = size;
    resetItems(s, frameOf(s, cat), cat);
  }
  normalize(s, null, cat);
  s.sel = null;
  return s;
}

/* "Show the optional parts too": the same building with one of each thing a
   customer can add that has a 3D shape of its own -- an outside light, the
   biggest electric package (its outlets, switch and lights, with the
   exterior light when the company sells it), a work bench and a shelf, a
   ramp with wood in it, and shutters on the windows -- so the parts that
   only exist when chosen can be seen too. Only what the company sells. */
export function withExtras(state, cat) {
  const has = (o, k) => o != null && Object.prototype.hasOwnProperty.call(o, k);
  const firstOfKind = (k) => Object.keys(cat.CAT).find((id) => cat.CAT[id].k === k) || null;
  const light = firstOfKind("light"), bench = firstOfKind("bench"), shelf = firstOfKind("shelf");
  if (bench) S.addInterior(state, bench, cat, 0.62);
  if (shelf) S.addInterior(state, shelf, cat, 0.62);
  const pk = (cat.ELECPK || []).filter((e) => +e[0] > 0).map((e) => e[0]);
  if (pk.length) {
    S.setElec(state, pk[pk.length - 1], cat);
    if (has(cat.MISC, "ext") && !state.elec.ext) S.toggleExt(state, cat);
  }
  /* one outside light: the package's own, or one put on the wall */
  if (light && !state.items.some((it) => cat.CAT[it.cat] && cat.CAT[it.cat].k === "light")) S.addItem(state, light, cat, 0.62);
  const ramps = (cat.RAMPS || []).filter((r) => r[0] !== "none" && r[0] !== "kit");
  if (ramps.length) S.setRamp(state, ramps[ramps.length - 1][0]);
  if (has(cat.MISC, "shutter")) for (const it of state.items) { const c = cat.CAT[it.cat]; if (c && c.k === "win" && !c.gable && c.draw === "window") it.shut = true; }
  normalize(state, null, cat);
  state.sel = null;
  return state;
}

/* ------------------------------------------------------------------------
   A part on its own, moved to the middle and framed */

/* the box round a drawing's triangles; keep(cz) picks triangles by where
   their middle is along the length */
function boxOf(build, keep) {
  let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity, n = 0;
  for (const k of build.ORDER) {
    const b = build.buckets[k];
    if (!b || !b.n) continue;
    const v = b.v;
    for (let i = 0; i + 26 < v.length; i += 27) {
      if (keep && !keep((v[i + 2] + v[i + 11] + v[i + 20]) / 3)) continue;
      for (let j = i; j < i + 27; j += 9) {
        const x = v[j], y = v[j + 1], z = v[j + 2];
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
        if (z < z0) z0 = z; if (z > z1) z1 = z;
      }
      n++;
    }
  }
  return n ? { x0, y0, z0, x1, y1, z1, n } : null;
}

/* the same drawing moved sideways by (dx, dz): a copy, nothing shared */
function shifted(build, dx, dz) {
  const out = { ORDER: build.ORDER.slice(), buckets: {}, tags: build.tags, hitQuads: [] };
  for (const k of build.ORDER) {
    const b = build.buckets[k];
    const v = new Float32Array(b.v.length);
    for (let i = 0; i < b.v.length; i += 9) {
      v[i] = b.v[i] + dx; v[i + 1] = b.v[i + 1]; v[i + 2] = b.v[i + 2] + dz;
      for (let j = 3; j < 9; j++) v[i + j] = b.v[i + j];
    }
    out.buckets[k] = Object.assign({}, b, { v: v });
  }
  return out;
}

/* How far back the camera must stand, looking from (yaw, pitch) at the
   middle of the box, so that all eight corners are in a w x h picture --
   worked out corner by corner the way the renderer projects them
   (engine/math.js matLook + matPersp), with a little room round the edge. */
export function distToFit(box, yaw, pitch, size) {
  const cx = (box.x0 + box.x1) / 2, cy = (box.y0 + box.y1) / 2, cz = (box.z0 + box.z1) / 2;
  const f = [Math.cos(pitch) * Math.sin(yaw), Math.sin(pitch), Math.cos(pitch) * Math.cos(yaw)];   /* toward the eye */
  let r = [f[2], 0, -f[0]];
  const rl = Math.hypot(r[0], r[2]) || 1; r = [r[0] / rl, 0, r[2] / rl];
  const u = [f[1] * r[2] - f[2] * r[1], f[2] * r[0] - f[0] * r[2], f[0] * r[1] - f[1] * r[0]];
  const tv = Math.tan(FOVY / 2), th = tv * (size.w / size.h);
  let d = 0;
  for (const X of [box.x0, box.x1]) for (const Y of [box.y0, box.y1]) for (const Z of [box.z0, box.z1]) {
    const p = [X - cx, Y - cy, Z - cz];
    const a = p[0] * r[0] + p[1] * r[1] + p[2] * r[2];
    const b = p[0] * u[0] + p[1] * u[1] + p[2] * u[2];
    const c = p[0] * f[0] + p[1] * f[1] + p[2] * f[2];
    d = Math.max(d, c + Math.abs(a) / th, c + Math.abs(b) / tv, c + 1.5);
  }
  return d * 1.1;
}

/* Which way to look at a part: the three-quarter view from the front right,
   unless the part mostly faces another way (the back gable's band on a
   cabin, whose front gable is the porch; a kennel's back wall) -- then the
   three-quarter view from the side it faces, because a surface is only drawn
   from the side it faces. Worked out from the triangles' own facing
   directions, weighted by their size. */
export const YAWS = Object.freeze([YAW, -YAW, Math.PI - YAW, -(Math.PI - YAW)]);
export function facingYaw(build) {
  let nx = 0, nz = 0, area = 0;
  for (const k of build.ORDER) {
    const b = build.buckets[k];
    if (!b || !b.n || b.unlit) continue;              /* soft shadows face nowhere */
    const v = b.v;
    for (let i = 0; i + 26 < v.length; i += 27) {
      const ax = v[i + 9] - v[i], ay = v[i + 10] - v[i + 1], az = v[i + 11] - v[i + 2];
      const bx = v[i + 18] - v[i], by = v[i + 19] - v[i + 1], bz = v[i + 20] - v[i + 2];
      const cx = ay * bz - az * by, cy = az * bx - ax * bz, cz = ax * by - ay * bx;
      const A = 0.5 * Math.sqrt(cx * cx + cy * cy + cz * cz);
      nx += v[i + 3] * A; nz += v[i + 5] * A; area += A;
    }
  }
  if (!(area > 0)) return YAW;
  const score = (y) => (Math.sin(y) * nx + Math.cos(y) * nz) / area;
  if (score(YAW) > -0.05) return YAW;
  return YAWS.reduce((best, y) => (score(y) > score(best) ? y : best), YAW);
}

/* -> { build, bounds, gr, fitDist, cam } ready for snapshotCanvas, or null
   when the part drew nothing on this building */
export function framePart(sub, full, size) {
  const all = boxOf(sub);
  if (!all) return null;
  const B = full.bounds;
  const R = 0.5 * Math.hypot(all.x1 - all.x0, all.y1 - all.y0, all.z1 - all.z0);
  const bigR = 0.5 * Math.hypot(B.W, B.L, B.H);
  if (R > bigR * 1.6) {
    /* the yard: shown the way the designer frames the whole building */
    const fd = fitDistFor(B.W, B.L, size, "fitref");
    return { build: sub, bounds: B, gr: full.gr, fitDist: fd, cam: { yaw: YAW, pitch: 0.215, dist: fd } };
  }
  const yaw = facingYaw(sub);
  /* a part at both ends (the gable siding, its band and vent, the gable
     studs, the corner boards): close in on the end nearer the camera */
  let bx = all;
  const front = boxOf(sub, (z) => z >= 0), back = boxOf(sub, (z) => z < 0);
  if (front && back && front.z0 - back.z1 > 1) bx = Math.cos(yaw) >= 0 ? front : back;
  const cx = (bx.x0 + bx.x1) / 2, cz = (bx.z0 + bx.z1) / 2, cy = Math.max(0.25, (bx.y0 + bx.y1) / 2);
  const dist = Math.max(2.5, distToFit(bx, yaw, PITCH, size));
  return {
    build: shifted(sub, -cx, -cz),
    bounds: { W: Math.max(bx.x1 - bx.x0, 1), L: Math.max(bx.z1 - bx.z0, 1), H: cy / 0.42 },   /* the renderer aims at H x 0.42 */
    gr: full.gr,
    fitDist: Math.max(dist, full.fitDist),                                                  /* only sets how far the picture reaches */
    cam: { yaw: yaw, pitch: PITCH, dist: dist },
  };
}

/* the part labels on this building, with the steps each one's triangles are
   on. Given the company's build order (plan.construction.buildOrder), the
   parts come in the order the shop puts them together -- each part at its
   earliest step in that order -- which is what the page promises; parts on
   no step of the order (the finished floor slab) come last. Without it, and
   between parts on the same step, PIPELINE order. The rest are `off` (not on
   this building) or, for a lesson part, `lessons` (only on its lesson page). */
export function partsOnBuilding(build, buildOrder) {
  const present = stagesPresent(build);
  const stagesByLabel = new Map();
  for (const [key, labels] of present) for (const l of labels) {
    if (!stagesByLabel.has(l)) stagesByLabel.set(l, []);
    stagesByLabel.get(l).push(key);
  }
  for (const [, keys] of stagesByLabel) keys.sort((a, b) => STAGE_ID[a] - STAGE_ID[b]);
  const pc = partCatalogue();
  const on = pc.order.filter((l) => stagesByLabel.has(l)).map((l) => ({ label: l, stages: stagesByLabel.get(l) }));
  if (Array.isArray(buildOrder)) {
    const when = (p) => {
      let best = Infinity;
      for (const k of p.stages) { const i = buildOrder.indexOf(k); if (i >= 0 && i < best) best = i; }
      return best;
    };
    const at = new Map(on.map((p, i) => [p, [when(p), i]]));
    on.sort((a, b) => (at.get(a)[0] - at.get(b)[0]) || (at.get(a)[1] - at.get(b)[1]));
  }
  const rest = pc.order.filter((l) => !stagesByLabel.has(l));
  return { on, off: rest.filter((l) => !pc.lessons[l]), lessons: rest.filter((l) => pc.lessons[l]) };
}

/* A skill is a file among the designer's own notes (.claude/skills/...),
   which the hosted website deliberately does not serve (netlify.toml answers
   "not found" for /.claude/*). So its name is a link only when the page is
   opened from Alan's own computer; on the website it is shown as plain text
   with the file's path, never as a link that goes nowhere. */
export function skillsAreServed(loc) {
  const l = loc || (typeof location !== "undefined" ? location : null);
  if (!l) return false;
  if (l.protocol === "file:") return true;
  return /^(localhost|127\.\d+\.\d+\.\d+|\[::1\])$/i.test(String(l.hostname || ""));
}

/* the real-life text for one part label on this building: every module that
   draws that label and applies to this building */
export function partText(label, plan) {
  const pc = partCatalogue();
  let mods = (pc.byLabel[label] || []).filter((m) => { try { return typeof m.appliesTo !== "function" || m.appliesTo(plan); } catch (e) { return false; } });
  if (!mods.length) mods = (pc.byLabel[label] || []).slice(0, 1);
  return mods.map((m) => ({ id: m.id, name: m.name, text: fillRealLife(m.realLife, plan.construction).text }));
}

/* ------------------------------------------------------------------------
   The page */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const frameNow = () => new Promise((r) => (typeof requestAnimationFrame === "function" ? requestAnimationFrame(() => r()) : setTimeout(r, 0)));

export async function startGallery() {
  const $ = (id) => document.getElementById(id);
  const out = { ready: false, parts: [], off: [], lessons: [], error: null };
  window.partsGallery = out;
  const id = companyFromAddress();
  let loaded;
  try { loaded = await loadCompany(id); }
  catch (e) { showProblems($("pg-main"), "The parts gallery could not start", [e.message]); out.error = e.message; out.ready = true; return out; }
  if (loaded.problems.length) {
    showProblems($("pg-main"), `The settings for "${id}" need fixing`, loaded.problems);
    out.error = loaded.problems.join("; "); out.ready = true; return out;
  }
  const cat = loaded.catalogue;
  themePage(cat);
  brandBadge($("pg-badge"), cat);
  $("pg-company").textContent = cat.brand.name || id;
  document.title = "Parts of a shed — " + (cat.brand.name || id);

  const q = new URLSearchParams(location.search);
  const styleSel = $("pg-style"), sizeSel = $("pg-size");
  const styles = Object.keys(cat.TYPES);
  styleSel.innerHTML = styles.map((t) => '<option value="' + esc(t) + '">' + esc(cat.TYPES[t].name) + "</option>").join("");
  const extrasBox = $("pg-extras");
  let extras = q.get("extras") === "1";
  if (extrasBox) extrasBox.checked = extras;
  const make = (style, size) => { const st = stateFor(cat, style, size); return extras ? withExtras(st, cat) : st; };
  let state = make(q.get("style"), q.get("size"));
  function fillSizes() {
    sizeSel.innerHTML = pSizes(state.type, cat).map((z) => '<option value="' + esc(z) + '">' + esc(z.replace("x", " × ")) + "</option>").join("");
    styleSel.value = state.type; sizeSel.value = state.size;
  }
  fillSizes();

  let renderer;
  try { renderer = makeRenderer(cat); }
  catch (e) { showProblems($("pg-main"), "This browser cannot draw 3D pictures", [String(e && e.message || e)]); out.error = String(e); out.ready = true; return out; }
  if (renderer.off) { showProblems($("pg-main"), "This browser cannot draw 3D pictures", ["WebGL is switched off or not available, so there is nothing to draw the parts with."]); out.error = "no WebGL"; out.ready = true; return out; }

  const linkSkills = skillsAreServed();
  let run = 0;
  async function draw() {
    const my = ++run;
    out.ready = false; out.parts = []; out.off = []; out.lessons = [];
    const grid = $("pg-grid"), offBox = $("pg-off"), status = $("pg-status");
    grid.innerHTML = ""; offBox.innerHTML = "";
    const plan = makePlan(state, cat);
    const size = { w: PART_PIC.w, h: PART_PIC.h };
    const full = assemble(plan, { viewport: size, fit: "fitref", frames: true });
    const { on, off, lessons } = partsOnBuilding(full.build, plan.construction && plan.construction.buildOrder);
    const T = cat.TYPES[state.type];
    $("pg-building").textContent = state.size.replace("x", " × ") + " " + T.name;
    status.textContent = "Drawing " + on.length + " parts…";
    const cards = on.map((p) => {
      const texts = partText(p.label, plan);
      const card = document.createElement("article");
      card.className = "pg-card"; card.setAttribute("data-part", p.label);
      const stageNames = p.stages.map((k) => STAGES[STAGE_ID[k]].name);
      card.innerHTML =
        '<div class="pg-pic"><img alt="' + esc(texts[0] ? texts[0].name : p.label) + ' on its own" width="' + size.w + '" height="' + size.h + '"></div>' +
        '<div class="pg-body"><h3>' + esc(texts[0] ? texts[0].name : p.label) + "</h3>" +
        '<div class="pg-stages">' + stageNames.map((n) => '<span class="pg-stage">' + esc(n) + "</span>").join("") + "</div>" +
        texts.map((t) => '<p class="pg-real">' + (texts.length > 1 ? "<b>" + esc(t.name) + ".</b> " : "") + esc(t.text) + "</p>").join("") +
        '<p class="pg-skill">Skill: ' + texts.map((t) => {
          const path = ".claude/skills/part-" + t.id + "/SKILL.md";
          return linkSkills ? '<a href="' + esc(path) + '" target="_blank" rel="noopener">part-' + esc(t.id) + "</a>"
            : '<code title="' + esc("In the designer's files: " + path) + '">part-' + esc(t.id) + "</code>";
        }).join(", ") + "</p>" +
        "</div>";
      grid.appendChild(card);
      const rec = { label: p.label, stages: p.stages.slice(), caption: texts.map((t) => t.text).join(" "), skills: texts.map((t) => "part-" + t.id), img: null, drawn: false };
      out.parts.push(rec);
      return { card, rec };
    });
    const pc = partCatalogue();
    out.off = off.slice();
    out.lessons = lessons.map((l) => ({ label: l, page: pc.lessons[l] }));
    let offHtml = "";
    if (off.length) {
      const names = [];
      for (const l of off) { const m = (pc.byLabel[l] || [])[0]; const n = m ? m.name : l; if (names.indexOf(n) < 0) names.push(n); }
      offHtml += "<h2>Not on this building</h2><p>" + names.map(esc).join(" · ") + "</p>";
    }
    /* the lesson parts: a link to the lesson page that draws each one (the
       lesson pages ship wherever this page does -- Alan's own computer and
       his learning preview, tools/build-site.mjs) */
    if (lessons.length) {
      offHtml += "<h2>Only in a lesson</h2><p>Construction details learned in a lesson, each drawn on its lesson page: " +
        out.lessons.map((x) => '<a class="pg-lesson" href="' + esc(x.page) + '">' + esc(pc.byLabel[x.label][0].name) + "</a>").join(" · ") + "</p>";
    }
    offBox.innerHTML = offHtml;
    const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
    for (let i = 0; i < cards.length; i++) {
      if (my !== run) return out;                  /* a newer choice has started over */
      const { card, rec } = cards[i];
      try {
        const sub = onlyParts(full.build, rec.label);
        const fr = framePart(sub, full, size);
        const img = card.querySelector("img");
        if (!fr) { card.classList.add("pg-empty"); img.alt = "Nothing to draw on this building"; }
        else {
          const c = snapshotCanvas(renderer, { build: fr.build, bounds: fr.bounds, gr: fr.gr, fitDist: fr.fitDist, cam: fr.cam, size: size, dpr: dpr, restore: false });
          img.src = c.toDataURL("image/png");
          rec.img = img.src; rec.drawn = true;
        }
      } catch (e) {
        console.error("The part " + rec.label + " could not be drawn on its own:", e);
        card.classList.add("pg-failed");
        card.querySelector(".pg-pic").textContent = "This part could not be drawn.";
      }
      status.textContent = "Drawn " + (i + 1) + " of " + cards.length + " parts…";
      await frameNow();
    }
    if (my !== run) return out;
    status.textContent = cards.length + " parts on this building, each drawn on its own.";
    out.ready = true;
    document.body.setAttribute("data-ready", "1");
    return out;
  }

  function choose() {
    document.body.removeAttribute("data-ready");
    const u = new URL(location.href);
    u.searchParams.set("style", state.type); u.searchParams.set("size", state.size);
    if (extras) u.searchParams.set("extras", "1"); else u.searchParams.delete("extras");
    try { history.replaceState(null, "", u.pathname + u.search); } catch (e) { /* a file:// page */ }
    return draw();
  }
  styleSel.onchange = () => { state = make(styleSel.value, null); fillSizes(); choose(); };
  sizeSel.onchange = () => { state = make(state.type, sizeSel.value); fillSizes(); choose(); };
  if (extrasBox) extrasBox.onchange = () => { extras = !!extrasBox.checked; state = make(state.type, state.size); fillSizes(); choose(); };
  await draw();
  await sleep(0);
  return out;
}
