/* CHECK: the look-defining code is Barnwright's, character for character.
   Run: node tools/check-shaders.mjs

   Alan likes how Barnwright's 3D designer LOOKS, lit the way his own Yoder
   Storage Barns site lights it (true colour, the standard look since Oct
   2026; Barnwright's warm light is kept for the golden checks). Almost all
   of that look lives in two places: the fragment shader (how light, shadow,
   paint and haze are worked out for every pixel) and the eleven texture
   painters (the grain in the siding, the ribs and screws in the metal, the
   lawn). This check reads Barnwright's own file and the Yoder site's -- read
   only, never changed -- and proves:

     1. our FS is Barnwright's FS byte for byte;
     2. our FSTRUE is the Yoder site's true-colour FS byte for byte, and it
        differs from Barnwright's FS ONLY in the six colour lines documented
        in engine/shaders.js (every other line the same), with each grey
        light the same brightness (Rec.709 luminance) as the colour it
        replaced;
     3. our VS and VSD are Barnwright's with nothing added but the building-
        step table (the aStage input, the uStg table, lifting the corner and
        hiding it), and FSD is Barnwright's;
     4. the eleven texture painters (and the grain helper) in engine/
        textures.js are Barnwright's text with every Math.random() turned
        into rand() and nothing else, in the same order, and mkTex is
        Barnwright's plus the one seeding line; and the contact shadow the
        true-colour look paints in their place afterwards is the Yoder
        site's texAO painter character for character;
     5. all of them compile and link in a real browser (headless Chromium
        with software WebGL), the stage attribute sits in slot 3 in both
        programs, and Barnwright's own originals compile the same way.

   Barnwright's file uses Windows line endings; they are turned into plain
   ones before comparing (a line ending is not part of the code). */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BARN = "/home/user/boisterous-lokum-a737e0/public/3ddesign.html";
const YODER = "/home/user/yoder-storage-barns/design.html";

let pass = 0, fail = 0;
const failures = [];
function ok(name, cond, extra) {
  if (cond) { pass++; console.log("  ok   " + name); }
  else { fail++; failures.push(name); console.log("  FAIL " + name + (extra ? "\n       " + String(extra).slice(0, 600) : "")); }
}
function firstDiff(a, b) {
  const n = Math.min(a.length, b.length);
  let i = 0; while (i < n && a[i] === b[i]) i++;
  if (i === n && a.length === b.length) return "identical";
  const line = a.slice(0, i).split("\n").length;
  return "first difference at character " + i + " (line " + line + "): ours " + JSON.stringify(a.slice(i, i + 60)) + " vs theirs " + JSON.stringify(b.slice(i, i + 60));
}

const B = readFileSync(BARN, "utf8").replace(/\r\n/g, "\n");
const Y = readFileSync(YODER, "utf8").replace(/\r\n/g, "\n");

/* the text of `var NAME=...;` evaluated as a value (shader strings, scene tables) */
function grabVar(src, name, endMarker) {
  const start = "var " + name + "=";
  const i = src.indexOf(start);
  if (i < 0) throw new Error("cannot find " + start);
  const j = src.indexOf(endMarker, i);
  if (j < 0) throw new Error("cannot find the end of " + name);
  return new Function("return " + src.slice(i + start.length, j))();
}

const barn = {
  VS: grabVar(B, "VS", ";\nvar FS="),
  FS: grabVar(B, "FS", ";\nvar VSD="),
  VSD: grabVar(B, "VSD", ";\nvar FSD="),
  FSD: grabVar(B, "FSD", ";\nvar extDeriv="),
};
const yoderFS = grabVar(Y, "FS", ";\nvar VSD=");
const ours = await import(pathToFileURL(resolve(ROOT, "engine/shaders.js")).href);

console.log("check-shaders: the look-defining code is Barnwright's\n");

/* ---------- 1. FS ---------- */
console.log("The fragment shader");
ok("FS is Barnwright's fragment shader byte for byte (" + barn.FS.length + " characters)", ours.FS === barn.FS, firstDiff(ours.FS, barn.FS));
ok("FS still has Barnwright's warm sun vec3(1.32,1.24,1.06) (kept for the golden and look checks; true colour is the standard)", ours.FS.includes("vec3 sun=vec3(1.32,1.24,1.06)*ndl*sh;"));

/* ---------- 2. FSTRUE ---------- */
console.log("\nThe true-colour fragment shader (a company option)");
ok("FSTRUE is the Yoder site's true-colour shader byte for byte (" + yoderFS.length + " characters)", ours.FSTRUE === yoderFS, firstDiff(ours.FSTRUE, yoderFS));
function codeLines(glsl) {
  return glsl.replace(/\/\*[\s\S]*?\*\//g, "").split("\n").map((l) => l.trim()).filter(Boolean);
}
function lineDiff(a, b) {
  const n = a.length, m = b.length, dp = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const removed = [], added = [];
  let i = 0, j = 0;
  while (i < n && j < m) { if (a[i] === b[j]) { i++; j++; } else if (dp[i + 1][j] >= dp[i][j + 1]) removed.push(a[i++]); else added.push(b[j++]); }
  while (i < n) removed.push(a[i++]); while (j < m) added.push(b[j++]);
  return { removed, added };
}
const d = lineDiff(codeLines(ours.FS), codeLines(ours.FSTRUE));
const EXPECT_REMOVED = [
  "alb*=mix(vec3(1.016,1.0,0.968),vec3(0.986,1.0,1.024),hsh);",
  "col+=vec3(1.5,1.4,1.15)*pow(max(0.0,dot(R,uSun)),220.0)*(0.25+0.75*sh);",
  "vec3 sun=vec3(1.32,1.24,1.06)*ndl*sh;",
  "col+=vec3(1.00,1.02,1.06)*sp;",
  "vec3 sky2=mix(vec3(0.66,0.69,0.72),uSky,0.42);",
  "vec3 envc=mix(vec3(0.19,0.20,0.17),sky2,upR);",
];
const EXPECT_ADDED = [
  "uniform vec3 uEnvUp;uniform vec3 uEnvDn;",
  "col+=vec3(1.403,1.403,1.403)*pow(max(0.0,dot(R,uSun)),220.0)*(0.25+0.75*sh);",
  "vec3 sun=vec3(1.244,1.244,1.244)*ndl*sh;",
  "col+=vec3(1.019,1.019,1.019)*sp;",
  "vec3 sky2=mix(uEnvUp,uSky,0.42);",
  "vec3 envc=mix(uEnvDn,sky2,upR);",
];
ok("FSTRUE drops exactly the six colour lines of FS and nothing else", JSON.stringify(d.removed.sort()) === JSON.stringify(EXPECT_REMOVED.slice().sort()), JSON.stringify(d.removed));
ok("FSTRUE adds exactly their six grey / scene-driven replacements and nothing else", JSON.stringify(d.added.sort()) === JSON.stringify(EXPECT_ADDED.slice().sort()), JSON.stringify(d.added));
const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
ok("the grey sun 1.244 is the warm sun's brightness (Rec.709 " + lum(1.32, 1.24, 1.06).toFixed(4) + ")", Math.abs(lum(1.32, 1.24, 1.06) - 1.244) < 0.0005);
ok("the grey glint 1.403 is the old glint's brightness (Rec.709 " + lum(1.5, 1.4, 1.15).toFixed(4) + ")", Math.abs(lum(1.5, 1.4, 1.15) - 1.403) < 0.0005);
ok("the grey highlight 1.019 is the old highlight's brightness (Rec.709 " + lum(1.0, 1.02, 1.06).toFixed(4) + ")", Math.abs(lum(1.0, 1.02, 1.06) - 1.019) < 0.0005);
ok("FSTRUE keeps the glass's own blue daylight (uSkyG)", ours.FSTRUE.includes("vec3 skyR=mix(vec3(0.55,0.58,0.56),uSkyG*1.06,upR);"));

/* the true-colour room matches the Yoder site's, number for number */
const sd = await import(pathToFileURL(resolve(ROOT, "engine/scene-data.js")).href);
const ySCENES = grabVar(Y, "SCENES", ";\nfunction SC()");
const bSCENES = grabVar(B, "SCENES", ";\nfunction SC()");
ok("SCENES (studio, yard, paper) are Barnwright's number for number", JSON.stringify(sd.SCENES) === JSON.stringify(bSCENES));
const strip = (s) => { const o = Object.assign({}, s); delete o.stage; return o; };
/* the same numbers whatever order the keys are written in */
const canon = (v) => JSON.stringify(v, (k, x) => (x && typeof x === "object" && !Array.isArray(x)) ? Object.fromEntries(Object.keys(x).sort().map((q) => [q, x[q]])) : x);
ok("the true-colour studio is the Yoder site's studio number for number (backdrop too)", canon(sd.TRUE_SCENES.studio) === canon(ySCENES.studio));
ok("the true-colour yard is the Yoder site's yard number for number (its sky photograph is not in this repo; the plain gradient is kept)", canon(strip(sd.TRUE_SCENES.yard)) === canon(strip(ySCENES.yard)));
ok("the true-colour paper is the Yoder site's paper number for number", canon(sd.TRUE_SCENES.paper) === canon(ySCENES.paper));
ok("true-colour studio haze equals its backdrop's flat colour (#E9E9E9 = 233)", Math.round(sd.TRUE_SCENES.studio.fogC[0] * 255) === 233 && sd.TRUE_SCENES.studio.stage.includes("#E9E9E9 100%"));
{
  const css = readFileSync(resolve(ROOT, "ui/styles.css"), "utf8");
  const m = css.match(/\.stage\{[^}]*background:(linear-gradient\([^)]*\))/);
  ok("the page opens on the standard (true-colour) studio backdrop, so it never flicks from one to the other", !!m && m[1] === sd.TRUE_SCENES.studio.stage, m ? m[1] : "no .stage background in ui/styles.css");
}
ok("Barnwright studio haze equals its backdrop's flat colour (#E9E9E5)", sd.SCENES.studio.fogC.map((v) => Math.round(v * 255).toString(16).toUpperCase()).join("") === "E9E9E5" && sd.SCENES.studio.stage.includes("#E9E9E5 100%"));

/* ---------- 3. VS / VSD / FSD ---------- */
console.log("\nThe vertex shaders: Barnwright's plus the building-step table only");
ok("the step table declaration is the contract's", ours.STAGE_DECL === "attribute float aStage;uniform vec4 uStg[32];");
ok("a corner is lifted by y and read through p before anything uses it", ours.STAGE_HEAD === "vec4 s=uStg[int(aStage+0.5)];vec3 p=aP+vec3(0.0,s.y,0.0);");
ok("a corner of a hidden step (x > 0.5) is sent off the screen", ours.STAGE_TAIL === "if(s.x>0.5)gl_Position=vec4(2.0,2.0,2.0,1.0);");
function unstage(src) {
  let s = src.split("\n").filter((l) => l !== ours.STAGE_DECL).join("\n");
  s = s.split(ours.STAGE_DECL).join("").split(ours.STAGE_HEAD).join("").split(ours.STAGE_TAIL).join("");
  s = s.split("vW=p;").join("vW=aP;").split("vec4(p,1.0)").join("vec4(aP,1.0)");
  return s;
}
const vsBack = unstage(ours.VS), vsdBack = unstage(ours.VSD);
ok("VS minus the step table is Barnwright's VS byte for byte", vsBack === barn.VS, firstDiff(vsBack, barn.VS));
ok("VSD minus the step table is Barnwright's VSD byte for byte", vsdBack === barn.VSD, firstDiff(vsdBack, barn.VSD));
ok("VS feeds the lifted corner to gl_Position, vW and vSh (and nothing reads aP past the lift)",
  ours.VS.includes("vW=p;") && ours.VS.includes("vSh=uLVP*vec4(p,1.0);") && ours.VS.includes("gl_Position=uVP*vec4(p,1.0);") &&
  ours.VS.split("aP").length - 1 === 2 /* the declaration and the lift */);
ok("VSD feeds the lifted corner to the shadow map", ours.VSD.includes("gl_Position=uLVP*vec4(p,1.0);"));
/* "minus the step table" above cannot see a piece of the table that is MISSING
   (removing nothing leaves Barnwright's text too), so count them: each shader
   carries the declaration, the lift and the hide exactly once, and the hide is
   the last thing main() does -- a hidden step must leave the shadow map as
   well as the picture. */
const count = (s, sub) => s.split(sub).length - 1;
for (const [nm, src] of [["VS", ours.VS], ["VSD", ours.VSD]])
  ok(nm + " carries the step table exactly once (declaration, lift, and the hide as the last statement of main)",
    count(src, ours.STAGE_DECL) === 1 && count(src, ours.STAGE_HEAD) === 1 && count(src, ours.STAGE_TAIL) === 1 && src.trimEnd().endsWith(ours.STAGE_TAIL + "}"),
    JSON.stringify({ decl: count(src, ours.STAGE_DECL), head: count(src, ours.STAGE_HEAD), tail: count(src, ours.STAGE_TAIL) }));
ok("FSD is Barnwright's byte for byte", ours.FSD === barn.FSD);
ok("attribute slots are aP 0, aN 1, aUV 2, aStage 3; a corner is 36 bytes",
  JSON.stringify(ours.ATTRIBS) === JSON.stringify({ aP: 0, aN: 1, aUV: 2, aStage: 3 }) && ours.STRIDE === 36);
const barnU = grabVar(B.replace('var U={}; ["uVP"', 'var UNAMES=["uVP"').replace('].forEach(function(n){U[n]=gl.getUniformLocation(progMain,n);});\nvar UD_LVP', '];\nvar UD_LVP'), "UNAMES", ";\nvar UD_LVP");
ok("the uniform table is Barnwright's 23 plus the true-colour shader's uEnvUp and uEnvDn",
  JSON.stringify(ours.U_NAMES) === JSON.stringify(barnU.concat(["uEnvUp", "uEnvDn"])));

/* ---------- 4. textures ---------- */
console.log("\nThe texture painters");
const TX = readFileSync(resolve(ROOT, "engine/textures.js"), "utf8");
function between(src, a, b) {
  const i = src.indexOf(a); if (i < 0) throw new Error("missing marker " + a);
  const i2 = src.indexOf("\n", i) + 1;
  const j = src.indexOf(b, i2); if (j < 0) throw new Error("missing marker " + b);
  return src.slice(i2, j).replace(/\n$/, "");
}
const oursPainters = between(TX, "/* ==== BEGIN PAINTERS", "/* ==== END PAINTERS");
const iGrain = B.indexOf("function grain(x,s,n,a){");
const iAOc = B.indexOf("var texAOcorner=mkTex(");
const barnPainters = B.slice(iGrain, B.indexOf("},64);", iAOc) + "},64);".length);
const nRandom = barnPainters.split("Math.random()").length - 1;
const expected = barnPainters.split("Math.random()").join("rand()");
ok("the painters are Barnwright's text with Math.random() -> rand() and nothing else (" + nRandom + " calls, " + barnPainters.split("\n").length + " lines)", oursPainters === expected, firstDiff(oursPainters, expected));
ok("no Math.random is left in the painters", !oursPainters.includes("Math.random"));
ok("every random call in Barnwright's painters is the plain Math.random() form", (barnPainters.match(/Math\.random/g) || []).length === nRandom);
ok("Barnwright calls Math.random nowhere outside those painters", (B.match(/Math\.random/g) || []).length === nRandom);
/* one by one, so a failure names the texture */
const TEXVARS = ["texSiding", "texMetal", "texTrim", "texFlat", "texGrass", "texGlass", "texRoofMetal", "texRoofCap", "texAO", "texAOv", "texAOcorner"];
function statements(src) {
  const out = {};
  TEXVARS.forEach((v, k) => {
    const i = src.indexOf("var " + v + "=mkTex(");
    const next = k + 1 < TEXVARS.length ? src.indexOf("var " + TEXVARS[k + 1] + "=mkTex(") : src.length;
    out[v] = { at: i, text: src.slice(i, next) };
  });
  return out;
}
const so = statements(oursPainters), sb = statements(barnPainters);
const order = TEXVARS.map((v) => so[v].at);
ok("the eleven textures are made in Barnwright's order", order.every((a, k) => a >= 0 && (k === 0 || a > order[k - 1])));
for (const v of TEXVARS) ok("  " + v + " painter identical", so[v].text.trimEnd() === sb[v].text.split("Math.random()").join("rand()").trimEnd());
const tn = await import(pathToFileURL(resolve(ROOT, "engine/tex-names.js")).href);
ok("tex-names TEX_ORDER lists the eleven names in the same order", JSON.stringify(tn.TEX_ORDER) === JSON.stringify(TEXVARS.map((v) => tn[v])));
ok("the names are the contract's (siding metal trim flat grass glass roofMetal roofCap ao aoV aoCorner)", tn.TEX_ORDER.join(" ") === "siding metal trim flat grass glass roofMetal roofCap ao aoV aoCorner");
ok("createTextures hands back each texture under its own name", TEXVARS.every((v) => TX.includes("out[TN." + v + "]=" + v + ";")));
const oursMk = between(TX, "/* ==== BEGIN mkTex", "/* ==== END mkTex");
const barnMk = B.slice(B.indexOf("/* painter draws the color; hpaint"), B.indexOf("function grain(x,s,n,a){")).replace(/\n+$/, "");
const mkLines = oursMk.split("\n"), seedLines = mkLines.filter((l) => l.includes("rand=randFor?randFor(texIndex++):Math.random;"));
ok("mkTex is Barnwright's plus exactly one line: the seeding at its very start", seedLines.length === 1 && mkLines[mkLines.indexOf(seedLines[0]) - 1] === "function mkTex(painter,size,norm,hpaint){" && mkLines.filter((l) => !seedLines.includes(l)).join("\n") === barnMk, firstDiff(mkLines.filter((l) => !seedLines.includes(l)).join("\n"), barnMk));
/* the Yoder site's contact shadow, worn with true colour (its own block after the eleven) */
const oursYAO = between(TX, "/* ==== BEGIN YODER CONTACT SHADOW", "/* ==== END YODER CONTACT SHADOW");
const iYAO = Y.indexOf("var texAO=mkTex(");
const yoderAO = iYAO < 0 ? "" : Y.slice(iYAO, Y.indexOf("},256);", iYAO) + "},256);".length);
ok("the true-colour contact shadow is the Yoder site's texAO painter character for character (" + yoderAO.split("\n").length + " lines)", yoderAO !== "" && oursYAO === yoderAO, firstDiff(oursYAO, yoderAO));
ok("...it is darker than Barnwright's at its middle (#3f3f3f against #565656), and no other picture changes", oursYAO.includes('g.addColorStop(0,"#3f3f3f")') && sb.texAO.text.includes('g.addColorStop(0,"#565656")') && !oursYAO.includes("rand"));
const yAt = TX.indexOf("/* ==== BEGIN YODER CONTACT SHADOW"), endP = TX.indexOf("/* ==== END PAINTERS");
ok("...painted only with true colour, after all eleven (so the test randomness of every other picture is untouched), in place of Barnwright's",
  yAt > endP && TX.slice(endP, yAt).includes("if(opts.trueColour){ gl.deleteTexture(texAO);") && TX.indexOf("out[TN.texAO]=texAO;") > yAt);
const extLine = B.slice(B.indexOf("var extAniso=gl.getExtension("), B.indexOf("\n", B.indexOf("var extAniso=gl.getExtension(")));
ok("the anisotropic-filtering line is Barnwright's", TX.includes("\n" + extLine + "\n"));

/* ---------- 4b. Barnwright's own designer wears the same look ----------
   Alan, Oct 10 2026 ("yes change"): Barnwright's designer draws with the Yoder
   site's look too, and only ?light=warm (BARNWRIGHT_PAGE, how every check
   opens it) gives its warm light -- FS, SCENES and texAO, the originals the
   sections above compare with. */
console.log("\nBarnwright's own designer wears the Yoder site's look (its warm light only at ?light=warm)");
{
  const blocks = await import(pathToFileURL(resolve(ROOT, "tools/lib/barnwright-blocks.mjs")).href);
  const at = B.indexOf("function fsTrue(){ return "), look = B.indexOf("/* ---------- THE YODER SITE'S LOOK");
  ok("Barnwright's designer carries THE YODER SITE'S LOOK, switched by its address", at >= 0 && look >= 0 && B.includes("function bwTrueColour(){") && /light=warm/.test(B));
  ok("...and it is on unless the address says ?light=warm: its shader and its rooms both ask bwTrueColour()",
    B.includes("var progMain=mkProg(VS,bwTrueColour()?fsTrue():FS)") && B.includes("function SC(){ var T9=bwTrueColour()?trueScenes():SCENES;"));
  ok("every check opens Barnwright at ?light=warm (" + blocks.BARNWRIGHT_PAGE + ")", blocks.BARNWRIGHT_PAGE === "3ddesign.html?light=warm");
  if (at >= 0 && look >= 0) {
    const i = at + "function fsTrue(){ return ".length, j = B.indexOf('].join("\\n")', i);
    const bFS = new Function("return " + B.slice(i, j + '].join("\\n")'.length))();
    ok("its true-colour shader is the Yoder site's and this designer's FSTRUE, byte for byte", bFS === yoderFS && bFS === ours.FSTRUE, firstDiff(bFS, yoderFS));
    const ts = B.slice(B.indexOf("function trueScenes(){"), B.indexOf("var U_ENVUP="));
    const bTS = new Function("SCENES", ts + "; return trueScenes();")(bSCENES);
    ok("its true-colour rooms are this designer's TRUE_SCENES, number for number (studio, yard, paper)", canon(bTS) === canon(sd.TRUE_SCENES), canon(bTS).slice(0, 300));
    const ai = B.indexOf("var texAO=mkTex(", look), bAO = B.slice(ai, B.indexOf("},256);", ai) + "},256);".length);
    ok("its contact shadow is the Yoder site's painter, the one engine/textures.js paints, character for character", bAO === yoderAO && bAO === oursYAO, firstDiff(bAO, yoderAO));
    ok("...painted after its eleven textures, so its warm page's textures are untouched", look > B.indexOf("var texAOcorner=mkTex(") && B.slice(look).includes("if(bwTrueColour()){ try{ gl.deleteTexture(texAO); }catch(e){}"));
  }
}

/* ---------- 5. compile in a real browser ---------- */
console.log("\nCompiling in headless Chromium (software WebGL)");
const require = createRequire(import.meta.url);
const { chromium } = require("/opt/node22/lib/node_modules/playwright/index.js");
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
try {
  const page = await browser.newPage();
  await page.setContent("<canvas id=c width=8 height=8></canvas>");
  const res = await page.evaluate(({ S, B }) => {
    const gl = document.getElementById("c").getContext("webgl");
    if (!gl) return { error: "no WebGL" };
    const deriv = !!gl.getExtension("OES_standard_derivatives");
    function build(vs, fs, attribs) {
      const out = { ok: false };
      const sh = (t, src) => { const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); return s; };
      const v = sh(gl.VERTEX_SHADER, vs), f = sh(gl.FRAGMENT_SHADER, fs);
      out.vsLog = gl.getShaderParameter(v, gl.COMPILE_STATUS) ? "" : gl.getShaderInfoLog(v) || "failed";
      out.fsLog = gl.getShaderParameter(f, gl.COMPILE_STATUS) ? "" : gl.getShaderInfoLog(f) || "failed";
      const p = gl.createProgram(); gl.attachShader(p, v); gl.attachShader(p, f);
      if (attribs) Object.keys(attribs).forEach((n) => gl.bindAttribLocation(p, attribs[n], n));
      gl.linkProgram(p);
      out.linkLog = gl.getProgramParameter(p, gl.LINK_STATUS) ? "" : gl.getProgramInfoLog(p) || "failed";
      out.ok = !out.vsLog && !out.fsLog && !out.linkLog;
      if (out.ok) {
        out.aStage = gl.getAttribLocation(p, "aStage");
        out.aP = gl.getAttribLocation(p, "aP");
        out.uStg = !!gl.getUniformLocation(p, "uStg");
        out.uEnvUp = !!gl.getUniformLocation(p, "uEnvUp");
      }
      return out;
    }
    return {
      deriv,
      main: build(S.VS, S.FS, S.ATTRIBS),
      mainTrue: build(S.VS, S.FSTRUE, S.ATTRIBS),
      depth: build(S.VSD, S.FSD, S.ATTRIBS),
      barnMain: build(B.VS, B.FS),
      barnDepth: build(B.VSD, B.FSD),
    };
  }, { S: { VS: ours.VS, FS: ours.FS, FSTRUE: ours.FSTRUE, VSD: ours.VSD, FSD: ours.FSD, ATTRIBS: ours.ATTRIBS }, B: barn });
  if (res.error) ok("WebGL is available in headless Chromium", false, res.error);
  const log = (r) => [r.vsLog, r.fsLog, r.linkLog].filter(Boolean).join(" | ");
  ok("OES_standard_derivatives is available (asked for before compiling, as the renderer does)", res.deriv);
  ok("VS + FS compile and link", res.main.ok, log(res.main));
  ok("VS + FSTRUE compile and link", res.mainTrue.ok, log(res.mainTrue));
  ok("VSD + FSD (the shadow map) compile and link", res.depth.ok, log(res.depth));
  ok("the step attribute is in slot 3 and the table is live in the picture program", res.main.aStage === 3 && res.main.aP === 0 && res.main.uStg);
  ok("the step attribute is in slot 3 and the table is live in the shadow program", res.depth.aStage === 3 && res.depth.aP === 0 && res.depth.uStg);
  ok("FSTRUE reads uEnvUp from the scene; FS does not have it", res.mainTrue.uEnvUp && !res.main.uEnvUp);
  ok("control: Barnwright's own shaders compile the same way", res.barnMain.ok && res.barnDepth.ok, log(res.barnMain) + log(res.barnDepth));
} finally {
  await browser.close();
}

console.log("\n" + (fail ? "FAILED" : "PASSED") + ": " + pass + " passed, " + fail + " failed.");
if (fail) { console.log("\nWhat failed:\n  " + failures.join("\n  ")); process.exit(1); }
console.log("Proved: the picture shader, the shadow shaders and all eleven texture painters are Barnwright's own code,");
console.log("the only additions are the building-step table and the test seeding line, the true-colour look (the");
console.log("standard one) is the Yoder site's shader with exactly its six colour lines changed and the Yoder site's own");
console.log("contact shadow, Barnwright's own designer now wears that same look (its warm light only at ?light=warm),");
console.log("and everything compiles in a real browser.");
