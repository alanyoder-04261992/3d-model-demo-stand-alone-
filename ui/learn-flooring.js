/* An illustrative surface for the floor lesson, based on Alan's close-up:
   matte warm taupe-brown, fine parallel ribs and tiny flecks. This does not
   identify the product or specify its rib/profile dimensions. No photo asset,
   sheet geometry, normal or construction stage is changed. */
import { hexRGB, srgbLin } from "../engine/math.js";
import { mulberry32 } from "../engine/seeded.js";

const PREFIX = "lessonFlooring-", VARIANTS = 4, EPSILON = 1e-7;
// Approximate display tint from Alan's later color-reference photo, allowing
// for the neutral texture/lighting. This is not a manufacturer color code.
const TINT = hexRGB("#a39c91").map(srgbLin);

function sheetHash(value) {
  let hash = 2166136261;
  for (const letter of value) hash = Math.imul(hash ^ letter.charCodeAt(0), 16777619);
  return hash >>> 0;
}

// Node-safe: the browser and static render exporter use these same pixels.
// Alpha is a neutral height value, not transparency, in the engine shader.
export function flooringTexture(name) {
  const match = /^lessonFlooring-([0-3])$/.exec(name);
  if (!match) return null;
  const variant = Number(match[1]);
  const width = 512, height = 512;
  const pixels = new Uint8ClampedArray(width * height * 4);
  const random = mulberry32(6203 + variant * 7919);
  const phase = random() * Math.PI * 2;
  // Ribs stay parallel; small irregularities and flecks avoid a printed grid.
  // Their visual scale is illustrative, not a measured product specification.
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const u = x / width, v = y / height;
    const irregular = .15 * Math.sin(v * Math.PI * 38 + Math.sin(u * Math.PI * 34))
      + .08 * Math.sin(v * Math.PI * 86 + u * Math.PI * 22);
    const rib = Math.sin(u * Math.PI * 128 + phase + irregular);
    const ribStrength = 3.7 * (.85 + .15 * Math.sin(v * Math.PI * 22 + u * Math.PI * 62));
    const fine = (random() - .5) * 6.4;
    const value = 241 + rib * ribStrength + fine;
    const at = (y * width + x) * 4;
    pixels[at] = value;
    pixels[at + 1] = value - .6;
    pixels[at + 2] = value - 2.4;
    pixels[at + 3] = 128;
  }
  // Wrap tiny uneven flecks at tile edges; no knots or broad wood-grain bands.
  for (let i = 0; i < 4800; i++) {
    const cx = Math.floor(random() * width), cy = Math.floor(random() * height);
    const rx = random() < .8 ? 1 : 2, ry = random() < .8 ? 1 : 2;
    const shade = random() < .7 ? -(5 + random() * 15) : 3 + random() * 8;
    for (let dy = -ry; dy <= ry; dy++) for (let dx = -rx; dx <= rx; dx++) {
      const distance = dx * dx / (rx * rx) + dy * dy / (ry * ry);
      if (distance > 1.2 || random() < .16) continue;
      const at = (((cy + dy + height) % height) * width + (cx + dx + width) % width) * 4;
      const strength = (1 - distance * .45) * shade;
      for (let channel = 0; channel < 3; channel++) pixels[at + channel] += strength;
    }
  }
  return { width, height, pixels };
}

export function installFlooringTexture(renderer) {
  const gl = renderer.gl;
  for (let variant = 0; variant < VARIANTS; variant++) {
    const name = PREFIX + variant;
    if (renderer.textures[name]) continue;
    const { width, height, pixels } = flooringTexture(name);
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.generateMipmap(gl.TEXTURE_2D);
    renderer.textures[name] = texture;
  }
}

export function flooringFinish(build, measurements) {
  if (!measurements?.study?.enabled || !measurements.deck?.sheets?.length ||
      !build.ORDER.some(key => (build.tags[key] || []).some(tag => tag.part === "floor-deck"))) return build;
  const out = { ...build, buckets: {}, ORDER: [], tags: {} };
  const sheets = measurements.deck.sheets;
  const inside = (point, bounds) => ["x", "y", "z"].every((axis, i) =>
    point[i] >= bounds[axis + "0Ft"] - EPSILON && point[i] <= bounds[axis + "1Ft"] + EPSILON);
  function append(key, source, vertices, tag, material) {
    if (!out.buckets[key]) {
      out.buckets[key] = { ...source, ...material, v: [], n: 0 };
      out.ORDER.push(key); out.tags[key] = [];
    }
    const bucket = out.buckets[key], tags = out.tags[key], last = tags[tags.length - 1];
    const from = bucket.n / 3;
    if (last && last.part === tag.part && last.from + last.count === from) last.count++;
    else tags.push({ ...tag, from, count: 1 });
    bucket.v.push(...vertices); bucket.n += 3;
  }
  for (const key of build.ORDER) {
    const bucket = build.buckets[key], tags = build.tags[key] || [];
    if (!tags.some(tag => tag.part === "floor-deck")) {
      out.buckets[key] = bucket; out.ORDER.push(key); out.tags[key] = tags; continue;
    }
    for (const tag of tags) for (let t = tag.from; t < tag.from + tag.count; t++) {
      const vertices = bucket.v.slice(t * 27, t * 27 + 27);
      if (tag.part !== "floor-deck") { append(key, bucket, vertices, tag); continue; }
      const points = [vertices.slice(0, 3), vertices.slice(9, 12), vertices.slice(18, 21)];
      const normal = vertices.slice(3, 6);
      const center = points[0].map((_, i) => points.reduce((sum, p) => sum + p[i] / 3, 0));
      // Touching sheets share the edge coordinates; the outward face normal
      // selects its owner so that all triangles on a sheet keep one appearance.
      const sheet = sheets.find(record => points.every(p => inside(p, record.bounds)) &&
        ["x", "y", "z"].some((axis, i) => Math.abs(normal[i]) > .9 &&
          Math.abs(center[i] - record.bounds[axis + (normal[i] > 0 ? "1Ft" : "0Ft")]) < EPSILON));
      if (!sheet) { append(key, bucket, vertices, tag); continue; }
      const identity = [sheet.layer, sheet.x0Ft, sheet.x1Ft, sheet.z0Ft, sheet.z1Ft].join(":");
      const hash = sheetHash(identity), random = mulberry32(hash);
      const uPhase = random(), vPhase = random(), tone = .993 + random() * .014;
      for (let i = 0; i < 27; i += 9) {
        if (Math.abs(normal[1]) > .9) {
          vertices[i + 6] = vertices[i] - sheet.x0Ft + uPhase;
          vertices[i + 7] = vertices[i + 2] - sheet.z0Ft + vPhase;
        } else {
          vertices[i + 6] = (Math.abs(normal[0]) > .9 ? vertices[i + 2] - sheet.z0Ft : vertices[i] - sheet.x0Ft) + uPhase;
          vertices[i + 7] = vertices[i + 1] - sheet.bounds.y0Ft + vPhase;
        }
      }
      append(key + ":flooring:" + hash, bucket, vertices, tag, {
        tex: PREFIX + hash % VARIANTS, tint: TINT.map(value => value * tone),
        spec: 0, gloss: 8, bump: 0,
      });
    }
  }
  return out;
}
