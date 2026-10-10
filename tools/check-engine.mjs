/* CHECK: the engine draws exactly what Barnwright's engine draws.
   Run: node tools/check-engine.mjs

   Barnwright's 3D designer is opened in a real (headless) browser, read only,
   and its OWN drawing functions -- MAT, mat, DECAL, box, wq, wbrace, wtri3,
   gq2, gbrace2, pushQuad, pushTri -- are run on a fresh, empty set of
   buckets, side by side with ours running the same calls in the same page.
   Every number that would go to the graphics card is compared: every corner's
   position, normal and texture coordinate, every material's paint, shine,
   relief and flags, the order materials are drawn in. Ours carries a 9th
   number per corner (the building step); it is checked separately and then
   left out of the comparison.

   Also compared against Barnwright's own page: the matrix and vector maths,
   the camera fit (fitDistFor "barnwright" against Barnwright's fitCamera on
   many screen shapes), the sun direction, the scene table, norm2pi, and all
   eleven TEXTURES pixel for pixel when both are painted with the same
   repeatable randomness (restarted at each texture as engine/seeded.js says).
   "fitref" is compared against the Yoder site's own fitCamera, read from its
   file. Finally the WHOLE PICTURE: Barnwright's own building, drawn by our
   renderer in the same page, must match Barnwright's picture byte for byte
   (five cases: styles, scenes, a selected item, camera angles, and the
   Finished step table switched on). And, without a browser: beam() makes
   closed, outward-facing lumber;
   part() tags nest; the step number on every corner is the right one.

   Needs: Barnwright's folder served on port 8301 and this repo on 8311 (the
   check starts both with http-server and stops them afterwards). */

import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { BARNWRIGHT_PAGE } from "./lib/barnwright-blocks.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BARN_DIR = "/home/user/boisterous-lokum-a737e0/public";
const YODER = "/home/user/yoder-storage-barns/design.html";
const P_BARN = 8301, P_OURS = 8311;
const BASE = "http://127.0.0.1:" + P_OURS;

let pass = 0, fail = 0, floats = 0;
const failures = [];
function ok(name, cond, extra) {
  if (cond) { pass++; console.log("  ok   " + name); }
  else { fail++; failures.push(name); console.log("  FAIL " + name + (extra ? "\n       " + String(extra).slice(0, 700) : "")); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- a folder on a port, started here and stopped at the end ---------- */
const servers = [];
async function serve(dir, port, probe, cors) {
  const url = "http://127.0.0.1:" + port + "/" + probe;
  const answers = async () => { try { const r = await fetch(url); return r.ok && (!cors || !!r.headers.get("access-control-allow-origin")); } catch { return false; } };
  if (await answers()) return;                      /* already being served (e.g. by another check) */
  const args = ["http-server", dir, "-p", String(port), "-s", "-c-1", "-a", "127.0.0.1"];
  if (cors) args.push("--cors");
  const child = spawn("npx", args, { detached: true, stdio: "ignore" });
  servers.push(child);
  for (let i = 0; i < 150; i++) { if (await answers()) return; await sleep(100); }
  throw new Error("could not serve " + dir + " on port " + port);
}
function stopServers() { for (const c of servers) { try { process.kill(-c.pid, "SIGTERM"); } catch {} } servers.length = 0; }
process.on("exit", stopServers);

/* ============================================================== Node part */
const M = await import(pathToFileURL(resolve(ROOT, "engine/buckets.js")).href);
const CAM = await import(pathToFileURL(resolve(ROOT, "engine/camera.js")).href);
const ST = await import(pathToFileURL(resolve(ROOT, "parts/stages.js")).href);
const MATH = await import(pathToFileURL(resolve(ROOT, "engine/math.js")).href);
const SEEDED = await import(pathToFileURL(resolve(ROOT, "engine/seeded.js")).href);

console.log("check-engine: our engine against Barnwright's own\n");
console.log("The kit on its own (no browser)");

/* stage numbers */
{
  const build = M.createBuild({ sel: null });
  const kit = M.makeKit(build, { view: { fitDist: 40 } });
  let threw = false;
  try { kit.box(kit.MAT("x", "flat", [1, 1, 1]), 0, 0, 0, 1, 1, 1); } catch (e) { threw = /setStage/.test(e.message); }
  ok("drawing before setStage() is refused with a plain message", threw);
  let bad = false;
  try { kit.setStage("no-such-step"); } catch (e) { bad = /Unknown stage/.test(e.message); }
  ok("an unknown step name is refused", bad);
  const b = kit.MAT("x", "flat", [1, 1, 1]);
  kit.setStage("skids"); kit.box(b, 0, 0, 0, 1, 1, 1);
  kit.setStage("roofing"); kit.pushTri(b, [0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0], [1, 0], [0, 1]);
  const ninth = []; for (let i = 8; i < b.v.length; i += 9) ninth.push(b.v[i]);
  ok("every corner carries its step as the 9th number (skids = 1 on the box's 36 corners, roofing = 11 after)",
    b.v.length === b.n * 9 && ninth.length === 39 && ninth.slice(0, 36).every((s) => s === ST.stageId("skids")) && ninth.slice(36).every((s) => s === ST.stageId("roofing")));
  kit.setItem("d1"); kit.hit("d1", [0, 0, 1], [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]]);
  ok("hit() records the tap target with the current step", build.hitQuads.length === 1 && build.hitQuads[0].id === "d1" && build.hitQuads[0].stage === "roofing");
  ok("the kit is frozen (a part cannot replace a tool)", Object.isFrozen(kit) && (() => { try { "use strict"; kit.box = null; return false; } catch { return true; } })());
  ok("kit.STEP defaults to GROOVE, kit.view is what was handed in", kit.STEP === 0.667 && kit.view.fitDist === 40);
  const kitMetal = M.makeKit(M.createBuild({}), { STEP: 0.75 });
  ok("kit.STEP is RIB when assemble says the building is metal", kitMetal.STEP === 0.75);
  const b2 = M.createBuild({}), k2 = M.makeKit(b2, {});
  ok("two builds never share buckets", Object.keys(b2.buckets).length === 0 && Object.keys(build.buckets).length === 1);
}

/* part tags */
{
  const build = M.createBuild({});
  const kit = M.makeKit(build, {});
  kit.setStage("siding");
  const b = kit.MAT("body", "siding", [1, 1, 1]);
  kit.pushTri(b, [0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0], [1, 0], [0, 1]);                 /* 0: no part */
  kit.part("siding", () => {
    kit.box(b, 0, 0, 0, 1, 1, 1);                                                             /* 1..12 siding */
    kit.part("kennel", () => { kit.setStage("extras"); kit.pushQuad(b, [0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0], [1, 0], [1, 1], [0, 1]); }); /* 13,14 kennel */
    ok("part() puts the step back when it ends (a part cannot leak its step)", kit.stage === "siding");
    kit.pushTri(b, [0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0], [1, 0], [0, 1]);               /* 15 siding */
  });
  kit.pushTri(b, [0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0], [1, 0], [0, 1]);                 /* 16 none */
  const want = [{ part: null, from: 0, count: 1 }, { part: "siding", from: 1, count: 12 }, { part: "kennel", from: 13, count: 2 }, { part: "siding", from: 15, count: 1 }, { part: null, from: 16, count: 1 }];
  ok("part() tags nest, innermost wins, runs merge: " + build.tags.body.map((s) => (s.part || "none") + "x" + s.count).join(" "), JSON.stringify(build.tags.body) === JSON.stringify(want), JSON.stringify(build.tags.body));
  const total = build.tags.body.reduce((a, s) => a + s.count, 0);
  ok("every triangle is covered by exactly one tag", total === b.n / 3);
  const st = []; for (let i = 8; i < b.v.length; i += 9) st.push(b.v[i]);
  ok("the kennel's triangles carry its own step (extras), the rest siding", st.slice(39, 45).every((s) => s === ST.stageId("extras")) && st.slice(0, 39).concat(st.slice(45)).every((s) => s === ST.stageId("siding")));
  ok("part() hands back what its function returns", kit.part("x", () => 42) === 42 && build.part === null);
}

/* beam */
{
  const cases = [
    ["a floor joist across the width", [-5, 0.5, 2], [5, 0.5, 2], 1.5 / 12, 5.5 / 12, [0, 1, 0]],
    ["a stud standing up, deep into the wall", [3, 0.92, -4], [3, 8.2, -4], 1.5 / 12, 3.5 / 12, [1, 0, 0]],
    ["a rafter on a slope", [-6, 8.2, 0], [0, 11.5, 0], 1.5 / 12, 3.5 / 12, [0.5, 1, 0]],
    ["a skewed board with a rough 'up'", [0.3, 1.1, -2.2], [2.9, 4.4, 1.7], 0.3, 0.5, [0.2, 0.9, 0.1]],
    ["a vertical post with an 'up' along its length (falls back)", [0, 0, 0], [0, 7, 0], 0.29, 0.29, [0, 1, 0]],
  ];
  for (const [name, p0, p1, w, d, up] of cases) {
    const build = M.createBuild({}), kit = M.makeKit(build, {});
    kit.setStage("wall-frame");
    const b = kit.MAT("lumber", "flat", [1, 1, 1]);
    kit.beam(b, p0, p1, w, d, up);
    const mid = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, (p0[2] + p1[2]) / 2];
    let outward = true, vol = 0;
    for (let t = 0; t < b.n / 3; t++) {
      const q = (k) => [b.v[(t * 3 + k) * 9], b.v[(t * 3 + k) * 9 + 1], b.v[(t * 3 + k) * 9 + 2]];
      const a = q(0), c = q(1), e = q(2), n = [b.v[t * 27 + 3], b.v[t * 27 + 4], b.v[t * 27 + 5]];
      const cen = [(a[0] + c[0] + e[0]) / 3, (a[1] + c[1] + e[1]) / 3, (a[2] + c[2] + e[2]) / 3];
      if (MATH.dot3(n, MATH.sub3(cen, mid)) <= 0) outward = false;
      vol += MATH.dot3(a, MATH.cross3(c, e)) / 6;
    }
    const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]);
    ok("beam: " + name + " -- 12 triangles, all facing out, closed (volume " + vol.toFixed(4) + " = w*d*length)",
      b.n === 36 && outward && Math.abs(vol - w * d * len) < 1e-9, "n=" + b.n + " outward=" + outward + " vol=" + vol + " want " + w * d * len);
  }
}

/* camera, no browser */
{
  const cam = CAM.createCamera();
  ok("the camera opens where Barnwright's does (yaw 0.62, pitch 0.215, 46 ft)", cam.yaw === 0.62 && cam.pitch === 0.215 && cam.dist === 46 && cam.fitDist === 46 && !cam.interacted);
  CAM.fitCamera(cam, 10, 20, { w: 742, h: 803 }, "barnwright");
  ok("fitCamera: distance follows the fit until the customer touches it", cam.dist === cam.fitDist);
  cam.interacted = true; cam.dist = 500; CAM.setFitDist(cam, 40);
  ok("fitCamera: after touching, the distance is only kept within 0.55-1.9 of the fit", cam.dist === 40 * 1.9);
  let t = 1000; const clock = () => t; let hinted = 0; cam.onInteract = () => hinted++;
  cam.yaw = 3.0; CAM.animYaw(cam, -3.0, 2, clock);
  t = 1210; CAM.stepCamera(cam);
  const dyShort = CAM.norm2pi(-3.0 - 3.0);
  ok("animYaw glides the short way round, eased out (half-way in time is 87.5% there), pitch capped at 1.05",
    Math.abs(cam.yaw - (3.0 + dyShort * 0.875)) < 1e-12 && cam.pitch <= 1.05 && hinted === 1);
  t = 1500; CAM.stepCamera(cam);
  ok("the glide ends at the target after 420 ms", cam.anim === null && Math.abs(cam.yaw - (3.0 + dyShort)) < 1e-12 && cam.pitch === 1.05);
  const plan = { CAT: { w72: { k: "door" }, ppost: { k: "post" } }, t: { porch: "R" }, ws: { R: { n: [1, 0, 0] }, F: { n: [0, 0, 1] } } };
  ok("wallYaw faces an item's wall, and porch posts face across a side porch",
    CAM.wallYaw({ cat: "w72", wall: "R" }, plan, cam) === Math.PI / 2 && CAM.wallYaw({ cat: "w72", wall: "F" }, plan, cam) === 0 &&
    CAM.wallYaw({ cat: "ppost", wall: "F" }, plan, cam) === Math.PI / 2);
}

/* fitref against the Yoder site's own fitCamera, read from its file */
{
  const Y = readFileSync(YODER, "utf8");
  const refLine = Y.slice(Y.indexOf("var FIT_REF="), Y.indexOf("\n", Y.indexOf("var FIT_REF=")));
  const i = Y.indexOf("function fitCamera(W,L){"), j = Y.indexOf("\n}\n", i) + 2;
  const yoderFit = new Function("W", "L", "cw", "ch",
    "var canvas={clientWidth:cw,clientHeight:ch}, interacted=false, cam={yaw:0,pitch:0,dist:46,fitDist:46};\n" + refLine + "\n" + Y.slice(i, j) + "\nfitCamera(W,L); return cam.fitDist;");
  let n = 0, bad = [];
  for (const [W, L] of [[6, 8], [8, 12], [10, 16], [10, 20], [12, 24], [12, 32], [14, 40], [16, 12]])
    /* the last three sit either side of the 0.1% tolerance ("a picture already
       at the yardstick keeps its old number"): 1000x1088 and 1000x940 are
       backed off by 0.5% and 0.75%, 1000x1083 is 0.07% over and must NOT be */
    for (const [cw, ch] of [[742, 803], [1440, 900], [820, 1180], [1180, 820], [390, 700], [1024, 1366], [1000, 1000], [700, 735], [700, 736], [594, 1270], [0, 0], [1000, 1088], [1000, 940], [1000, 1083]]) {
      n++;
      const a = CAM.fitDistFor(W, L, { w: cw, h: ch }, "fitref"), b = yoderFit(W, L, cw, ch);
      if (!Object.is(a, b)) bad.push(W + "x" + L + " on " + cw + "x" + ch + ": " + a + " vs " + b);
    }
  ok("fitDistFor 'fitref' equals the Yoder site's fitCamera on all " + n + " building/screen pairs", bad.length === 0, bad.slice(0, 5).join("; "));
  ok("'fitref' is the default, and the two modes agree at 1440x900 (742x803 picture)",
    CAM.fitDistFor(10, 20, { w: 742, h: 803 }) === CAM.fitDistFor(10, 20, { w: 742, h: 803 }, "fitref") &&
    CAM.fitDistFor(14, 40, { w: 742, h: 803 }, "fitref") === CAM.fitDistFor(14, 40, { w: 742, h: 803 }, "barnwright"));
}

/* ---------- the samples: the same calls, run once through Barnwright's
   globals and once through our kit. A is the toolbox, W the walls. Each may
   set `sel` (the selected item) and may return something to compare (wtri3
   swapping the caller's UVs, for instance). ---------- */
const SAMPLES_SRC = `[
 { name: "box, default tile size (a siding-body box with age 4)", fn: (A, W) => { const b = A.mat("body", A.T.siding, "#c8c8c8", 0.06, 14, 0.6); b.age = 4; A.box(b, 0.3, 0.1, -0.2, 2.1, 1.3, 0.7); } },
 { name: "box, explicit tile size (a skid)", fn: (A, W) => { const b = A.mat("skid", A.T.flat, "#6d5f49", 0.04, 10); A.box(b, -1.7, 0, 0, 0.5, 0.5, 12.2, 2); } },
 { name: "wq 'sid' UVs on the front wall (siding)", fn: (A, W) => { const b = A.mat("body", A.T.siding, "#8b2f2a", 0.06, 14, 0.6); A.wq(b, W.F, -4.9, 0.63, 4.9, 8.35, 0, "sid"); } },
 { name: "wq 'sid' UVs on a metal body (GROOVE, not RIB)", fn: (A, W) => { const b = A.mat("body", A.T.metal, "#8a9aa0", 0.5, 40, 1.1); b.age = 3; A.wq(b, W.R, -8, 0.63, 4, 9.1, 0, "sid"); } },
 { name: "wq 'glass' UVs (a pane, glassM)", fn: (A, W) => { const b = A.mat("glass", A.T.glass, [0.02, 0.03, 0.04], 1.2, 80); b.glassM = 1; A.wq(b, W.L, -1, 4.2, 1, 6.9, 0.05, "glass"); } },
 { name: "wq default UVs, and facing inward (u0 > u1)", fn: (A, W) => { const b = A.mat("trim", A.T.trim, "#f4f4f4", 0.10, 20, 0.12); A.wq(b, W.B, -1.5, 1, 1.5, 3, 0.02); A.wq(b, W.B, 1.5, 1, -1.5, 3, 0.02); } },
 { name: "wq on a free (diagonal corner-porch) wall, 'sid' and default", fn: (A, W) => { const b = A.mat("body", A.T.siding, "#dcdcd0", 0.06, 14, 0.6); A.wq(b, W.P1, -2, 0.63, 2, 8.35, 0, "sid"); A.wq(b, W.P1, -0.5, 2, 0.5, 5, 0.04); } },
 { name: "wbrace (a door Z-brace) and a zero-length brace", fn: (A, W) => { const b = A.mat("trim", A.T.trim, "#1b1b1b", 0.10, 20, 0.12); A.wbrace(b, W.F, -2, 1.2, 1.9, 6.3, 0.29, 0.06); A.wbrace(b, W.R, 1, 2, 1, 2, 0.2, 0.06); } },
 { name: "wtri3 already anticlockwise, default UVs", fn: (A, W) => { const b = A.mat("body", A.T.siding, "#c8c8c8", 0.06, 14, 0.6); A.wtri3(b, W.R, [0, 5], [2, 5], [1, 7], 0.03); } },
 { name: "wtri3 clockwise: winding flipped AND the caller's UVs swapped", fn: (A, W) => { const b = A.mat("body", A.T.siding, "#c8c8c8", 0.06, 14, 0.6); const uvs = [[0, 0], [1, 0], [0.5, 1]]; A.wtri3(b, W.F, [0, 5], [1, 7], [2, 5], 0.03, uvs); return uvs; } },
 { name: "wtri3 clockwise without UVs, on a free wall", fn: (A, W) => { const b = A.mat("trim", A.T.trim, "#f4f4f4", 0.10, 20); A.wtri3(b, W.P1, [0, 5], [1, 7], [2, 5], 0.01); } },
 { name: "gq2 front gable (sgn +1), 4 points, default UVs", fn: (A, W) => { const b = A.mat("body", A.T.siding, "#c8c8c8", 0.06, 14, 0.6); A.gq2(b, [[-5, 8.35], [5, 8.35], [5, 9], [-5, 9]], 8, 1, 0); } },
 { name: "gq2 back gable (sgn -1), 4 points, 'sid' UVs", fn: (A, W) => { const b = A.mat("body", A.T.siding, "#c8c8c8", 0.06, 14, 0.6); A.gq2(b, [[-5, 8.35], [5, 8.35], [5, 9], [-5, 9]], -8, -1, 0, "sid"); } },
 { name: "gq2 triangle (3 points), 'sid', both gables", fn: (A, W) => { const b = A.mat("body", A.T.siding, "#c8c8c8", 0.06, 14, 0.6); A.gq2(b, [[-5, 8.35], [5, 8.35], [0, 11.05]], 8, 1, 0, "sid"); A.gq2(b, [[-5, 8.35], [5, 8.35], [0, 11.05]], -8, -1, 0, "sid"); } },
 { name: "gq2 pentagon (5 points, a gambrel end), 'sid' and default, both gables", fn: (A, W) => { const b = A.mat("body", A.T.siding, "#c8c8c8", 0.06, 14, 0.6); const P = [[-5, 7.9], [5, 7.9], [4.1, 10.2], [0, 11.4], [-4.1, 10.2]]; A.gq2(b, P, 8, 1, 0.01, "sid"); A.gq2(b, P, -8, -1, 0.01); } },
 { name: "gq2 'glass' UVs: 4 fixed, 3 and 5 from the bounding box (an octagon's pieces)", fn: (A, W) => { const b = A.mat("glass", A.T.glass, [0.02, 0.03, 0.04], 1.2, 80); b.glassM = 1; A.gq2(b, [[-0.5, 9], [0.5, 9], [0.5, 10], [-0.5, 10]], 8, 1, 0.05, "glass"); A.gq2(b, [[-0.5, 9], [0.5, 9], [0, 10]], -8, -1, 0.05, "glass"); A.gq2(b, [[-0.75, 9.3], [-0.3, 8.85], [0.3, 8.85], [0.75, 9.3], [0, 10.4]], 8, 1, 0.05, "glass"); A.gq2(b, [[0, 1], [0, 2], [0, 3]], 8, 1, 0, "glass"); } },
 { name: "gbrace2 on both gables", fn: (A, W) => { const b = A.mat("trim", A.T.trim, "#f4f4f4", 0.10, 20, 0.12); A.gbrace2(b, -5, 8.35, 0, 11.05, 0.29, 8, 1, 0.03); A.gbrace2(b, 5, 8.35, 0, 11.05, 0.29, -8, -1, 0.03); } },
 { name: "pushTri / pushQuad / quadUV directly (the lawn disc and a decal)", fn: (A, W) => { const m = A.MAT("ground", A.T.grass, [0.700, 0.720, 0.560], 0.03, 12, 0, 1.05); m.noCast = true; m.turf = 1; const GR = 67.48, SEG = 72; for (let s2 = 0; s2 < SEG; s2++) { const a0 = s2 / SEG * Math.PI * 2, a1 = (s2 + 1) / SEG * Math.PI * 2; A.pushTri(m, [0, 0.004, 0], [Math.cos(a1) * GR, 0.004, Math.sin(a1) * GR], [Math.cos(a0) * GR, 0.004, Math.sin(a0) * GR], [0, 0], [Math.cos(a1) * GR / 3.0, Math.sin(a1) * GR / 3.0], [Math.cos(a0) * GR / 3.0, Math.sin(a0) * GR / 3.0]); } const d = A.DECAL("ctshadow", A.T.ao); A.pushQuad(d, [-5.85, 0.012, 8.85], [5.85, 0.012, 8.85], [5.85, 0.012, -8.85], [-5.85, 0.012, -8.85], [0, 0], [1, 0], [1, 1], [0, 1]); const e = A.DECAL("eaveAO", A.T.aoV); A.quadUV(e, [[5.02, 7.3, 6], [5.02, 7.3, -6], [5.02, 8.35, -6], [5.02, 8.35, 6]], [[0, 1], [1, 1], [1, 0], [0, 0]]); } },
 { name: "mat: hex paint -> linear, array paint as given, missing shine -> 24", fn: (A, W) => { A.mat("trim", A.T.trim, "#1a2b3c", 0.1, 20, 0.12); A.mat("dark", A.T.flat, [0.02, 0.02, 0.02]); A.mat("white", A.T.flat, "#FFFFFF", 0, 0); A.mat("roof", A.T.roofMetal, "#2b2b2b", 0.34, 80, 0.6); A.mat("roofCap", A.T.roofCap, [0.1, 0.1, 0.1], 0.38, 92, 0.35); } },
 { name: "mat: the selected item's parts get their own glowing !==g bucket", sel: "i7", fn: (A, W) => { A.setItem("i7"); const g = A.mat("trim", A.T.trim, "#f4f4f4", 0.10, 20, 0.12); A.wq(g, W.F, -1, 1, 1, 2, 0.05); A.setItem("i8"); const n = A.mat("trim", A.T.trim, "#f4f4f4", 0.10, 20, 0.12); A.wq(n, W.F, 2, 1, 3, 2, 0.05); A.setItem(null); A.mat("glass", A.T.glass, [0, 0, 0], 1.2, 80); } },
 { name: "mat: item 0 never glows (Barnwright's truthiness test)", sel: 0, fn: (A, W) => { A.setItem(0); A.mat("trim", A.T.trim, "#f4f4f4", 0.10, 20, 0.12); } },
 { name: "MAT: first call wins, later arguments ignored, draw order = first creation", fn: (A, W) => { const a = A.MAT("galv", A.T.flat, [0.6, 0.62, 0.64], 0.5, 30, 0, 0.2); const b = A.MAT("iron", A.T.metal, [0.1, 0.1, 0.1], 0.2, 20); const c = A.MAT("galv", A.T.metal, [0.9, 0.9, 0.9], 1, 60, 1, 1); A.box(c, 0, 0, 0, 1, 1, 1); A.box(b, 1, 0, 0, 1, 1, 1); A.mat("galv", A.T.trim, "#cfd4d8", 0.6, 50); return a === c; } },
 { name: "DECAL: unlit, casts no shadow, first call wins", fn: (A, W) => { const d = A.DECAL("cornerAO", A.T.aoCorner); const d2 = A.DECAL("cornerAO", A.T.ao); A.wq(d2, W.L, -0.2, 0.63, 0.2, 8.35, 0.018); return d === d2; } },
]`;

/* ============================================================== browser part */
console.log("\nSide by side in Barnwright's own page (headless Chromium, software WebGL)");
const require = createRequire(import.meta.url);
const { chromium } = require("/opt/node22/lib/node_modules/playwright/index.js");
let browser;
try {
  await serve(BARN_DIR, P_BARN, "3ddesign.html", false);
  await serve(ROOT, P_OURS, "engine/buckets.js", true);
  browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const ctx = await browser.newContext({ serviceWorkers: "block", viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  await ctx.route("**/*", (r) => { const u = r.request().url(); if (u.startsWith("http://127.0.0.1:" + P_BARN + "/") || u.startsWith(BASE + "/")) r.continue(); else r.abort(); });
  /* Seed Barnwright's painters the documented way: restart Math.random at the
     start of each mkTex call (its first canvas), keep a copy of each finished
     texture as it is uploaded. Barnwright's file itself is not touched. */
  await ctx.addInitScript({ content: `(() => {
    const mulberry32 = ${SEEDED.MULBERRY32_SOURCE};
    const textureSeed = ${SEEDED.textureSeed.toString()};
    let idx = 0, inTex = false; const realRandom = Math.random;
    window.__bwTex = [];
    const oc = Document.prototype.createElement;
    Document.prototype.createElement = function (tag, o) {
      if (idx < 11 && !inTex && String(tag).toLowerCase() === "canvas") { inTex = true; Math.random = mulberry32(textureSeed(idx)); }
      return oc.call(this, tag, o);
    };
    const ot = WebGLRenderingContext.prototype.texImage2D;
    WebGLRenderingContext.prototype.texImage2D = function (...a) {
      if (inTex && a.length === 6 && a[5] instanceof ImageData) {
        window.__bwTex.push({ w: a[5].width, h: a[5].height, data: new Uint8Array(a[5].data) });
        inTex = false; idx++; Math.random = realRandom;
      }
      return ot.apply(this, a);
    };
  })();` });
  const page = await ctx.newPage();
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  await page.goto("http://127.0.0.1:" + P_BARN + "/" + BARNWRIGHT_PAGE, { waitUntil: "load" });
  await page.waitForFunction(() => typeof MAT === "function" && typeof buildShed === "function" && window.__bwTex && window.__bwTex.length === 11, null, { timeout: 30000 });

  const report = await page.evaluate(async ({ BASE, SAMPLE_SRC }) => {
    const M = await import(BASE + "/engine/buckets.js");
    const MATH = await import(BASE + "/engine/math.js");
    const CAM = await import(BASE + "/engine/camera.js");
    const SC = await import(BASE + "/engine/scene.js");
    const SD = await import(BASE + "/engine/scene-data.js");
    const STG = await import(BASE + "/parts/stages.js");
    const out = { samples: [], math: [], fit: null, sun: null, scenes: null, norm2pi: null, tex: null, floats: 0 };

    /* ---- the walls the samples draw on (shaped like Barnwright's wallDefs) ---- */
    const dxp = 10 - 8, dzp = -4, lp = Math.hypot(dxp, dzp);
    const W = {
      F: { ax: [1, 0, 0], n: [0, 0, 1], at: 8, len: 10, cx: 0, top: 8.35 },
      B: { ax: [-1, 0, 0], n: [0, 0, -1], at: -8, len: 10, cx: 0, top: 8.35 },
      R: { ax: [0, 0, -1], n: [1, 0, 0], at: 5, len: 12, cx: -2, top: 9.1 },
      L: { ax: [0, 0, 1], n: [-1, 0, 0], at: -5, len: 16, cx: 0, top: 8.35 },
      P1: { ox: 0, oz: 2, ax: [dxp / lp, 0, dzp / lp], n: [4 / lp, 0, dxp / lp], len: lp, top: 8.35 },
    };
    const SAMPLES = new Function("return " + SAMPLE_SRC)();

    /* ---- Barnwright's side: its own globals, on fresh buckets ---- */
    const TB = { siding: texSiding, metal: texMetal, trim: texTrim, flat: texFlat, grass: texGrass, glass: texGlass, roofMetal: texRoofMetal, roofCap: texRoofCap, ao: texAO, aoV: texAOv, aoCorner: texAOcorner };
    const texName = new Map(Object.entries(TB).map(([k, v]) => [v, k]));
    const AB = { MAT, DECAL, mat, pushTri, pushQuad, quadUV, box, wq, wbrace, wtri3, gq2, gbrace2, T: TB, setItem: (id) => { CURIT = id; } };
    function runBarn(s) {
      const sb = buckets, so = ORDER, sc = CURIT, ss = state.sel;
      buckets = {}; ORDER = []; CURIT = null; state.sel = s.sel === undefined ? null : s.sel;
      try { const ret = s.fn(AB, W); return { bk: buckets, order: ORDER.slice(), ret: JSON.stringify(ret === undefined ? null : ret) }; }
      finally { buckets = sb; ORDER = so; CURIT = sc; state.sel = ss; }
    }
    /* ---- our side: a fresh build and kit ---- */
    const TO = { siding: "siding", metal: "metal", trim: "trim", flat: "flat", grass: "grass", glass: "glass", roofMetal: "roofMetal", roofCap: "roofCap", ao: "ao", aoV: "aoV", aoCorner: "aoCorner" };
    function runOurs(s) {
      const build = M.createBuild({ sel: s.sel === undefined ? null : s.sel });
      const kit = M.makeKit(build, { view: {} });
      kit.setStage("siding");
      const AO = Object.assign({}, kit, { T: TO, setItem: kit.setItem });
      const ret = s.fn(AO, W);
      return { bk: build.buckets, order: build.ORDER.slice(), ret: JSON.stringify(ret === undefined ? null : ret) };
    }
    const SID = STG.stageId("siding");
    for (const s of SAMPLES) {
      const b = runBarn(s), o = runOurs(s);
      const problems = [];
      if (JSON.stringify(b.order) !== JSON.stringify(o.order)) problems.push("draw order " + JSON.stringify(o.order) + " vs " + JSON.stringify(b.order));
      if (b.ret !== o.ret) problems.push("returned " + o.ret + " vs " + b.ret);
      let nf = 0;
      for (const key of b.order) {
        const x = b.bk[key], y = o.bk[key];
        if (!y) { problems.push("no bucket " + key); continue; }
        if (texName.get(x.tex) !== y.tex) problems.push(key + ": texture " + y.tex + " vs " + texName.get(x.tex));
        for (const f of ["spec", "gloss", "glow", "bump", "noCast", "unlit", "age", "glassM", "turf", "n"]) if (!Object.is(x[f], y[f])) problems.push(key + "." + f + ": " + y[f] + " vs " + x[f]);
        if (!Array.isArray(x.tint) || x.tint.length !== y.tint.length || x.tint.some((v, i) => !Object.is(v, y.tint[i]))) problems.push(key + ".tint: " + JSON.stringify(y.tint) + " vs " + JSON.stringify(x.tint));
        if (x.v.length !== x.n * 8) problems.push(key + ": Barnwright has " + x.v.length + " numbers for " + x.n + " corners?");
        if (y.v.length !== y.n * 9) problems.push(key + ": ours has " + y.v.length + " numbers for " + y.n + " corners");
        for (let c = 0; c < x.n && problems.length < 6; c++) {
          for (let k = 0; k < 8; k++) {
            nf++;
            if (!Object.is(x.v[c * 8 + k], y.v[c * 9 + k])) { problems.push(key + " corner " + c + " number " + k + ": " + y.v[c * 9 + k] + " vs " + x.v[c * 8 + k]); break; }
          }
          if (y.v[c * 9 + 8] !== SID) problems.push(key + " corner " + c + ": step " + y.v[c * 9 + 8] + " vs " + SID);
        }
      }
      out.floats += nf;
      out.samples.push({ name: s.name, ok: problems.length === 0, problems: problems.slice(0, 4), buckets: b.order.length, corners: b.order.reduce((a, k) => a + b.bk[k].n, 0) });
    }

    /* ---- maths ---- */
    const same = (a, b) => (a.length === b.length) && Array.prototype.every.call(a, (v, i) => Object.is(v, b[i]));
    const vecs = [[0.3, -1.7, 2.2], [1e-9, 5, -3], [0, 0, 0], [7.25, 0.001, -0.5], [-2, -3, -4]];
    let mOk = true, mN = 0;
    for (const a of vecs) for (const b of vecs) {
      mN++;
      mOk = mOk && same(MATH.norm3(a), norm3(a)) && same(MATH.sub3(a, b), sub3(a, b)) && same(MATH.cross3(a, b), cross3(a, b)) && Object.is(MATH.dot3(a, b), dot3(a, b));
    }
    out.math.push({ name: "norm3 / sub3 / cross3 / dot3 on " + mN + " pairs", ok: mOk });
    let hOk = true;
    for (const h of ["#000000", "#ffffff", "#1a2b3c", "#C9CDCF", "#6e7d5d", "#80ff01"]) hOk = hOk && same(MATH.hexRGB(h), hexRGB(h)) && same(MATH.tintShade(h, 0.92), tintShade(h, 0.92)) && MATH.shade2(h, 0.85) === shade2(h, 0.85) && same([MATH.srgbLin(0.5)], [srgbLin(0.5)]);
    out.math.push({ name: "hexRGB / srgbLin / tintShade / shade2 on six colours", ok: hOk });
    let xOk = true;
    for (const [e, t] of [[[12, 9, 30], [0, 3.1, 0]], [[-40, 22, 5], [0, 4, 0]], [[0.001, 50, 0.002], [0, 0, 0]]]) {
      const v1 = MATH.matLook(e, t, [0, 1, 0]), v2 = matLook(e, t, [0, 1, 0]);
      const p1 = MATH.matPersp(0.55, 742 / 803, 1, 263.6), p2 = matPersp(0.55, 742 / 803, 1, 263.6);
      const o1 = MATH.matOrtho(-17.3, 17.3, -17.3, 17.3, 8, 132), o2 = matOrtho(-17.3, 17.3, -17.3, 17.3, 8, 132);
      xOk = xOk && same(v1, v2) && same(p1, p2) && same(o1, o2) && same(MATH.matMul(p1, v1), matMul(p2, v2)) && same(MATH.matMul(o1, v1), matMul(o2, v2));
    }
    out.math.push({ name: "matLook / matPersp / matOrtho / matMul on three cameras", ok: xOk });

    /* ---- camera fit: ours "barnwright" against Barnwright's fitCamera ---- */
    const sCanvas = canvas, sCam = Object.assign({}, cam), sInt = interacted;
    const bad = []; let fitN = 0;
    try {
      interacted = false;
      for (const [Wd, Ln] of [[6, 8], [8, 12], [10, 16], [10, 20], [12, 24], [12, 32], [14, 40], [16, 12]])
        for (const [cw, ch] of [[742, 803], [1440, 900], [820, 1180], [1180, 820], [390, 700], [1000, 1000], [700, 735], [700, 736], [0, 0]]) {
          fitN++;
          canvas = { clientWidth: cw, clientHeight: ch };
          fitCamera(Wd, Ln);
          const ours = CAM.fitDistFor(Wd, Ln, { w: cw, h: ch }, "barnwright");
          if (!Object.is(ours, cam.fitDist)) bad.push(Wd + "x" + Ln + " @" + cw + "x" + ch + ": " + ours + " vs " + cam.fitDist);
          const c2 = CAM.createCamera(); CAM.fitCamera(c2, Wd, Ln, { w: cw, h: ch }, "barnwright");
          if (!Object.is(c2.dist, cam.dist)) bad.push("dist " + Wd + "x" + Ln + ": " + c2.dist + " vs " + cam.dist);
        }
    } finally { canvas = sCanvas; Object.assign(cam, sCam); interacted = sInt; }
    out.fit = { n: fitN, bad };

    /* ---- the sun, the scene table, norm2pi ---- */
    const sYaw = cam.yaw; let sunOk = true;
    try {
      for (const y of [0, 0.62, 1.3, -2.2, 3.1, 7.9]) { cam.yaw = y; sunFromCam(); sunOk = sunOk && same(SC.sunFromCam({ yaw: y }), LIGHT); }
    } finally { cam.yaw = sYaw; }
    out.sun = sunOk;
    out.scenes = JSON.stringify(SD.SCENES) === JSON.stringify(SCENES) && SD.sceneFor("studio") === SD.SCENES.studio && SD.sceneFor("nowhere") === SD.SCENES.yard && SCENE === SD.DEFAULT_SCENE;
    out.norm2pi = [-20, -3.2, -1, 0, 1, 3.2, 3.14159, 9.9, 100].every((a) => Object.is(CAM.norm2pi(a), norm2pi(a)));

    /* ---- textures: ours, seeded, in a fresh WebGL context in this page ---- */
    const TX = await import(BASE + "/engine/textures.js");
    const TN = await import(BASE + "/engine/tex-names.js");
    function paint(opts) {
      const cv = document.createElement("canvas");
      const gl2 = cv.getContext("webgl");
      const got = [];
      const orig = gl2.texImage2D;
      gl2.texImage2D = function (...a) { if (a.length === 6 && a[5] instanceof ImageData) got.push({ w: a[5].width, h: a[5].height, data: new Uint8Array(a[5].data) }); return orig.apply(this, a); };
      const map = TX.createTextures(gl2, opts);
      return { got, names: Object.keys(map) };
    }
    const seeded = paint({ seeded: true });
    const bw = window.__bwTex;
    const per = TN.TEX_ORDER.map((name, i) => {
      const a = seeded.got[i], b = bw[i];
      let diff = -1;
      if (a && b && a.data.length === b.data.length) { diff = 0; for (let k = 0; k < a.data.length; k++) if (a.data[k] !== b.data[k]) diff++; }
      return { name, size: a ? a.w : 0, bsize: b ? b.w : 0, diff, bytes: a ? a.data.length : 0 };
    });
    const unseeded = paint({});
    let unseededDiff = 0; for (let k = 0; k < unseeded.got[0].data.length; k++) if (unseeded.got[0].data[k] !== bw[0].data[k]) unseededDiff++;
    const SE = await import(BASE + "/engine/seeded.js");
    const byFn = paint({ randFor: (i) => SE.mulberry32(SE.textureSeed(i)) });
    out.tex = { per, count: seeded.got.length, bcount: bw.length, names: seeded.names, unseededDiff, sameViaRandFor: byFn.got.every((g, i) => g.data.every((v, k) => v === seeded.got[i].data[k])) };
    return out;
  }, { BASE, SAMPLE_SRC: SAMPLES_SRC }).catch((e) => ({ error: String(e && e.stack || e) }));

  if (report.error) { ok("the side-by-side run completed", false, report.error); }
  else {
    console.log("\nDrawing primitives (Barnwright's globals vs our kit, " + report.samples.length + " samples)");
    for (const s of report.samples) ok(s.name + "  [" + s.buckets + " material(s), " + s.corners + " corners]", s.ok, s.problems.join("\n       "));
    floats = report.floats;
    console.log("\nMaths, camera, sun and scenes");
    for (const m of report.math) ok(m.name + " identical", m.ok);
    ok("fitDistFor 'barnwright' (and the distance clamp) equals Barnwright's fitCamera on all " + report.fit.n + " building/screen pairs", report.fit.bad.length === 0, report.fit.bad.slice(0, 5).join("; "));
    ok("sunFromCam gives Barnwright's sun direction for six camera angles", report.sun);
    ok("SCENES is Barnwright's table (studio is the default; unknown names fall back to the yard)", report.scenes);
    ok("norm2pi identical", report.norm2pi);
    console.log("\nTextures, painted with the same repeatable randomness in both");
    ok("eleven textures painted on each side", report.tex.count === 11 && report.tex.bcount === 11);
    ok("createTextures hands back the eleven names in order", JSON.stringify(report.tex.names) === JSON.stringify(["siding", "metal", "trim", "flat", "grass", "glass", "roofMetal", "roofCap", "ao", "aoV", "aoCorner"]));
    for (const t of report.tex.per) ok("  " + t.name + " (" + t.size + "x" + t.size + ") identical to Barnwright's, all " + t.bytes + " bytes", t.diff === 0 && t.size === t.bsize, "different bytes: " + t.diff + " size " + t.size + " vs " + t.bsize);
    ok("randFor: (i) => mulberry32(textureSeed(i)) paints the same eleven textures as { seeded: true }", report.tex.sameViaRandFor);
    ok("control: an UNSEEDED siding differs from Barnwright's seeded one (" + report.tex.unseededDiff + " bytes) -- the comparison can fail", report.tex.unseededDiff > 1000);
  }
  /* ---------- the whole picture: our renderer against Barnwright's ----------
     Barnwright builds its own shed; its buckets are copied at the moment it
     uploads them (a 9th number added to every corner), and our renderer draws
     them in the same page, at the same size, from the same camera, with the
     same seeded textures, shadows forced on and the watchdogs held still.
     Every byte of the two pictures is compared. Barnwright is drawn twice
     before reading: its first frame after a rebuild has no shadows (see the
     note at the top of engine/renderer.js). */
  console.log("\nThe whole picture: our renderer draws Barnwright's own building");
  const pix = await page.evaluate(async ({ BASE }) => {
    const R = await import(BASE + "/engine/renderer.js");
    const M = await import(BASE + "/engine/buckets.js");
    const TB = { siding: texSiding, metal: texMetal, trim: texTrim, flat: texFlat, grass: texGrass, glass: texGlass, roofMetal: texRoofMetal, roofCap: texRoofCap, ao: texAO, aoV: texAOv, aoCorner: texAOcorner };
    const texName = new Map(Object.entries(TB).map(([k, v]) => [v, k]));
    const box = document.createElement("div");
    box.style.cssText = "position:fixed;left:0;top:0;width:" + canvas.clientWidth + "px;height:" + canvas.clientHeight + "px;z-index:-5";
    const cv = document.createElement("canvas"); cv.style.cssText = "width:100%;height:100%;display:block";
    box.appendChild(cv); document.body.appendChild(box);
    const ours = R.createRenderer(cv, { seededTextures: true, scene: "studio" });
    ours.test.freezeWatchdog = true; ours.test.forceShadow = true; ours.test.dprCap = 2;
    function capture() {
      let cap = null; const up = uploadBuffers;
      uploadBuffers = function () {
        cap = ORDER.map((k) => { const b = buckets[k]; return { key: k, tex: texName.get(b.tex), tint: b.tint, spec: b.spec, gloss: b.gloss, glow: b.glow, bump: b.bump, unlit: b.unlit, noCast: b.noCast, age: b.age, glassM: b.glassM, turf: b.turf, v: b.v.slice(), n: b.n }; });
        up();
      };
      try { buildShed(); } finally { uploadBuffers = up; }
      const build = M.createBuild({});
      for (const c of cap) {
        const v = new Array(c.n * 9);
        for (let i = 0; i < c.n; i++) { for (let k = 0; k < 8; k++) v[i * 9 + k] = c.v[i * 8 + k]; v[i * 9 + 8] = 9; }
        build.ORDER.push(c.key);
        build.buckets[c.key] = { tex: c.tex, tint: c.tint, spec: c.spec, gloss: c.gloss, glow: c.glow, bump: c.bump, unlit: c.unlit, noCast: c.noCast, age: c.age, glassM: c.glassM, turf: c.turf, v, n: c.n };
      }
      return build;
    }
    function compare(yaw, pitch, table) {
      if (yaw != null) cam.yaw = yaw; if (pitch != null) cam.pitch = pitch;
      const build = capture();
      hasShadow = true; DPRCAP = 2; FRAMES = 0; FCOST.length = 0;
      draw(); draw();
      const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, A = new Uint8Array(w * h * 4);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, A);
      const d = dims(), t = T();
      ours.setScene(SCENE);
      ours.setStages(table || null);
      ours.show({ build, bounds: { W: d.W, L: d.L, H: y0 + t.wallH + roofRise(d.W) }, gr: window.__GR, fitDist: cam.fitDist });
      Object.assign(ours.cam, { yaw: cam.yaw, pitch: cam.pitch, dist: cam.dist, fitDist: cam.fitDist });
      ours.draw();
      const px = ours.test.readPixels();
      let diff = -1;
      if (px.data.length === A.length) { diff = 0; for (let i = 0; i < A.length; i++) if (A[i] !== px.data[i]) diff++; }
      let lit = 0; for (let i = 3; i < A.length; i += 4) if (A[i]) lit++;
      return { type: state.type, size: state.size, scene: SCENE, sel: state.sel, w, h, ow: px.w, oh: px.h, diff, lit, bytes: A.length };
    }
    const out = [];
    out.push(Object.assign({ label: "the opening building" }, compare(null, null, null)));
    out.push(Object.assign({ label: "the same with the Finished step table set" }, compare(null, null, R.stageTableFor("finished"))));
    const types = Object.keys(TYPES);
    const metal = types.find((k) => TYPES[k].metal), gamb = types.find((k) => TYPES[k].roof === "gambrel"), porch = types.find((k) => TYPES[k].porch && TYPES[k].porch !== "none");
    if (metal) { setType(metal); out.push(Object.assign({ label: "a metal building, from behind and above" }, compare(2.4, 0.5, null))); }
    if (gamb) { setType(gamb); SCENE = "yard"; paintBackdrop(); state.sel = state.items.length ? state.items[0].id : null; out.push(Object.assign({ label: "a gambrel barn in the yard scene, one door selected (glowing)" }, compare(-0.9, 0.3, null))); SCENE = "studio"; paintBackdrop(); state.sel = null; }
    if (porch) { setType(porch); out.push(Object.assign({ label: "a porch building, from the other side" }, compare(-1.9, 0.25, null))); }
    return out;
  }, { BASE }).catch((e) => [{ label: "the picture comparison ran", error: String(e && e.stack || e) }]);
  for (const c of pix) {
    if (c.error) { ok(c.label, false, c.error); continue; }
    ok(c.label + " -- " + c.type + " " + c.size + ", " + c.scene + (c.sel ? ", selected " + c.sel : "") + ": all " + c.bytes + " bytes identical (" + c.w + "x" + c.h + ", " + c.lit + " px drawn)",
      c.diff === 0 && c.w === c.ow && c.h === c.oh && c.lit > 100000, "differing bytes: " + c.diff + ", sizes " + c.w + "x" + c.h + " vs " + c.ow + "x" + c.oh);
  }
  ok("five whole-picture cases were compared", pix.length === 5, pix.length);

  ok("Barnwright's page raised no errors while being read", pageErrors.length === 0, pageErrors.join(" | "));
} finally {
  if (browser) await browser.close();
  stopServers();
}

console.log("\n" + (fail ? "FAILED" : "PASSED") + ": " + pass + " passed, " + fail + " failed; " + floats + " vertex numbers compared exactly.");
if (fail) { console.log("\nWhat failed:\n  " + failures.join("\n  ")); process.exit(1); }
console.log("Proved: our drawing kit, maths, camera fit, sun, scene table and all eleven textures produce exactly what");
console.log("Barnwright's own code produces, number for number and pixel for pixel; our renderer draws Barnwright's own");
console.log("building byte for byte the same as Barnwright; the fitref camera is the Yoder site's; beam() lumber is closed");
console.log("and faces out; part tags and the building-step numbers are right.");
