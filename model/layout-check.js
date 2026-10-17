/* Check an owner's standard layout at every sold size and porch choice.
   Node-safe: the browser and server share the customer's recipe evaluator,
   fit decision and post bounds. Builder items settle before owner's items. */
import { frameOf, porchDepthOf } from "./frame.js";
import { evalDataRecipe, recipeEntries, layoutVariants, fitsWall, fitProblem, layoutProblems } from "./loadouts.js";
import { builderRecipe, builderEntryIndices, loadoutTwin } from "./loadout-twins.js";
import { clampPos, itemW } from "./item-placement.js";

const unique = (a) => [...new Set(a)];
const words = (a) => a.length < 3 ? a.join(" and ") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1];
const sizeWords = (s) => s.replace("x", "×");
const wallWords = { F: "front", B: "back", R: "right side", L: "left side", S1: "inside of the porch", S2: "end of the porch", S3: "other end of the porch", P1: "angled porch wall", P2: "side porch wall", P3: "back porch wall" };
const sortSizes = (a) => a.slice().sort((a, b) => { const [aw, al] = a.split("x").map(Number), [bw, bl] = b.split("x").map(Number); return aw - bw || al - bl; });
const place = (v) => v.pMid ? "middle" : v.pFlip ? "back" : "front";
const occurrence = (it) => `${it.entryIndex}:${it._layoutOccurrence || 0}`;
const itemName = (c) => (c.n || "item").toLowerCase();

function itemLabel(it, recipe, frame) {
  const e = recipe[it.entryIndex] || {}, len = (frame.ws[it.wall] || {}).len || 1;
  let at = "";
  if (e.at === "center" || e.at == null) at = "in the middle of the ";
  else if (e.at && e.at.sym != null) at = `${it._layoutOccurrence ? "second" : "first"} of the pair on the `;
  else if (e.at && e.at.fromStart != null) at = "near the left end of the ";
  else if (e.at && e.at.fromEnd != null) at = "near the right end of the ";
  else {
    const share = (it.pos / len + 0.5);
    at = Math.abs(share - 0.75) < 0.06 ? "about three quarters of the way along the "
      : Math.abs(share - 0.6) < 0.06 ? "about three fifths of the way along the " : "on the ";
  }
  const name = itemName(frame.CAT[it.cat]);
  if (e.at && e.at.sym != null) return `the ${it._layoutOccurrence ? "second" : "first"} ${name} of the pair on the ${wallWords[it.wall] || it.wall}`;
  return `the ${name} ${at}${wallWords[it.wall] || it.wall}`;
}

function porchWords(events, t, sizes) {
  if (t.porch !== "S") return "";
  const places = unique(events.map((e) => place(e.variant))), lengths = unique(events.map((e) => e.variant.pLen));
  const everyLength = sizes.every((size) => layoutVariants(t, size).every((v) => lengths.includes(v.pLen)));
  const length = everyLength ? "" : ` with the ${words(lengths.sort((a, b) => a - b).map((n) => `${porchDepthOf(t)} × ${n}`))} porch`;
  if (places.length === 3) return length;
  const action = words(places.map((p) => p === "middle" ? "Middle porch" : p === "back" ? "Flip porch" : "Corner porch"));
  return `${length} when the customer taps ${action}`;
}

function blank() {
  return { ok: false, errors: [], warnings: [], messages: [], problems: [], checks: [], examples: [], fixes: [], sizes: [], summary: "", leftOff: [], unchecked: [] };
}

/* Canonical signature plus the sizes gives one result line for matching porch
   places, instead of repeating it for every size and every porch choice. */
function groupEvents(events) {
  const byVariant = new Map();
  for (const e of events) {
    const k = `${e.kind}:${e.reason?.kind || ""}:${e.entryIndex}:${e.otherEntryIndex ?? ""}:${e.held ? 1 : 0}:${e.wall}:${e.variant.pLen}:${place(e.variant)}`;
    if (!byVariant.has(k)) byVariant.set(k, { ...e, events: [], sizes: [] });
    const g = byVariant.get(k); g.events.push(e); if (!g.sizes.includes(e.size)) g.sizes.push(e.size);
  }
  const merged = new Map();
  for (const g of byVariant.values()) {
    const k = `${g.kind}:${g.reason?.kind || ""}:${g.entryIndex}:${g.otherEntryIndex ?? ""}:${g.held ? 1 : 0}:${g.wall}:${g.sizes.join(",")}`;
    if (!merged.has(k)) merged.set(k, { ...g, events: [] });
    merged.get(k).events.push(...g.events);
  }
  return [...merged.values()];
}

function reasonWords(g, recipe) {
  if (g.reason.kind === "porch") return "it would stand in the open porch";
  if (g.reason.kind === "run") return "it would be on the dog run";
  if (g.reason.kind === "edge") return "it would be closer than 6 in to the corner";
  return `it would be closer than 7 1/2 in to ${itemLabel(g.reason.other, recipe, g.frame)}`;
}

/** checkLayout(layout, catalogue, styleKey, {budgetMs})
 * Also accepts (catalogue, styleKey, layout, options). Problems carry entry
 * indices for focusing a sheet; errors and warnings are plain screen words.
 * A budget expiry always leaves ok false, with the unexamined sizes named.
 */
export function checkLayout(layout, cat, key, options = {}) {
  if (layout && layout.TYPES) [layout, cat, key] = [key, layout, cat];
  const result = blank(), started = Date.now();
  const report = (kind, message, extra = {}) => {
    result[kind === "error" ? "errors" : "warnings"].push(message);
    result.problems.push({ style: key, message, kind, ...extra });
  };
  const t = cat && cat.TYPES && cat.TYPES[key];
  if (!t) { report("error", "Pick a building from your price list."); return finish(result); }
  let recipe;
  try {
    recipe = typeof layout === "string" ? loadoutTwin(layout) : layout == null ? builderRecipe(cat, key) : layout;
    if (!recipe) throw new Error(`The ${t.name}'s standard layout could not be read.`);
    const shape = layoutProblems(recipe, t.name);
    for (const entry of Array.isArray(recipe) ? recipe : []) {
      const c = entry && cat.CAT[entry.cat];
      if (c && !["door", "ru", "win", "post"].includes(c.k)) shape.push(`The standard layout of the ${t.name} can contain doors, windows and porch posts.`);
      if (c && c.k === "post" && (!t.porch || (t.porch === "F" && entry.wall !== "F") || (t.porch === "S" && entry.wall !== "R") || (t.porch === "C" && !["F", "R"].includes(entry.wall)))) shape.push(`The ${t.name}'s porch post needs to stand on its porch edge.`);
    }
    if (shape.length) { shape.forEach((m) => report("error", m)); return finish(result); }
  } catch (e) { report("error", e.message); return finish(result); }
  result.sizes = sortSizes(Object.keys(cat.P[key] || {}));
  if (!result.sizes.length) { report("error", "Add a size before setting the standard layout."); return finish(result); }
  const events = [], budget = options.budgetMs == null ? Infinity : Math.max(0, options.budgetMs);
  const builderIndices = builderEntryIndices(recipe, t);
  const isBuilder = (it) => !recipe[it.entryIndex].ifFits && builderIndices.has(it.entryIndex);
  for (const size of result.sizes) {
    for (const variant of layoutVariants(t, size)) {
      if (Date.now() - started >= budget) {
        result.unchecked = result.sizes.slice(result.sizes.indexOf(size)).map(sizeWords);
        report("error", `The standard layout still needs checking on the ${words(result.unchecked)}. Try Check every size again.`, { kind: "unchecked", sizes: result.unchecked });
        return finish(result);
      }
      const state = { type: key, size, ...variant, items: [] };
      const check = { size, variant, state, items: [], ok: true, errors: [], warnings: [], leftOff: [], held: [] };
      try {
        const frame = frameOf(state, cat), ctx = { ...frame, frame, porchDepth: porchDepthOf(t) };
        check.frame = frame;
        const raw = recipeEntries(recipe, frame.W, frame.L, ctx);
        const evaluated = evalDataRecipe(recipe, frame.W, frame.L, ctx);
        for (const it of raw.filter((it) => !isBuilder(it))) {
          const c = frame.CAT[it.cat];
          if (c.k === "post" || c.gable) continue;
          const priority = (o) => { const item = frame.CAT[o.cat]; return item.k === "post" ? 4 : item.gable ? 3 : item.k === "win" ? 2 : 1; };
          const prior = evaluated.filter((o) => isBuilder(o) || (!isBuilder(it) && (priority(o) < priority(it) || (priority(o) === priority(it) && (o.entryIndex < it.entryIndex || (o.entryIndex === it.entryIndex && o._layoutOccurrence < it._layoutOccurrence))))));
          if (fitsWall(frame.CAT, prior, it.cat, it.wall, it.pos, it.dbl, frame.ws[it.wall].len, ctx)) continue;
          const reason = fitProblem(frame.CAT, prior, it.cat, it.wall, it.pos, it.dbl, frame.ws[it.wall].len, ctx);
          const kind = ["door", "ru"].includes(c.k) || !recipe[it.entryIndex].ifFits ? "door" : "window";
          const event = { kind, size, variant, frame, item: it, entryIndex: it.entryIndex, wall: it.wall, cat: it.cat, reason, otherEntryIndex: reason.other && reason.other.entryIndex };
          events.push(event);
          if (kind === "window") check.leftOff.push(event);
          else { check.errors.push(event); check.ok = false; }
        }
        /* evalDataRecipe already uses these same post bounds. Keep the held
           record for the three result drawings and each item's carry-over. */
        for (const it of evaluated.filter((it) => frame.CAT[it.cat].k === "post")) {
          const before = raw.find((o) => occurrence(o) === occurrence(it));
          clampPos(it, { items: evaluated }, frame);
          if (before && Math.abs(before.pos - it.pos) > 1e-8) check.held.push({ entryIndex: it.entryIndex, cat: it.cat, wall: it.wall, from: before.pos, pos: it.pos });
        }
        const posts = evaluated.filter((it) => frame.CAT[it.cat].k === "post");
        for (let a = 0; a < posts.length; a++) for (let b = a + 1; b < posts.length; b++) {
          if (posts[a].wall !== posts[b].wall || Math.abs(posts[a].pos - posts[b].pos) >= (itemW(posts[a], frame.CAT, frame) + itemW(posts[b], frame.CAT, frame)) / 2 - 1e-9) continue;
          const held = check.held.some((h) => h.entryIndex === posts[a].entryIndex || h.entryIndex === posts[b].entryIndex);
          const event = { kind: "posts", size, variant, frame, item: posts[a], entryIndex: posts[a].entryIndex, otherEntryIndex: posts[b].entryIndex, wall: posts[a].wall, cat: posts[a].cat, held };
          events.push(event); check.warnings.push(event);
        }
        const hasDoor = evaluated.some((it) => ["door", "ru"].includes(frame.CAT[it.cat].k));
        if (!hasDoor) { const event = { kind: "no-door", size, variant, frame, entryIndex: -1, wall: "" }; events.push(event); check.errors.push(event); check.ok = false; }
        state.items = evaluated; check.items = evaluated;
        check.allFits = check.ok && !check.leftOff.length && !check.warnings.length;
        check.caption = check.warnings.length ? "Two posts in one spot" : check.errors.length ? "A door needs a change" : check.leftOff.length ? "A window is left off" : "Everything fits";
      } catch (e) { report("error", `On the ${sizeWords(size)} the standard layout could not be checked: ${e.message}`, { size, variant }); check.ok = false; check.errors.push(e.message); check.caption = "Needs checking"; }
      result.checks.push(check);
    }
  }
  for (const g of groupEvents(events)) {
    const sizes = sortSizes(g.sizes), porch = porchWords(g.events, t, sizes);
    const where = `On the ${words(sizes.map(sizeWords))}${porch}`;
    let message;
    if (g.kind === "no-door") message = `${where} there is no door. Every size needs a door.`;
    else if (g.kind === "posts") {
      const spot = g.held ? "at the end of the porch" : g.wall === "F" ? "on the front of the porch" : "on the side of the porch";
      if (t.porch === "S" && sizes.length === result.sizes.length) {
        const lens = unique(g.events.map((e) => e.variant.pLen)).sort((a, b) => a - b), places = unique(g.events.map((e) => place(e.variant)));
        const at = words(places.map((p) => p === "front" ? "at the front end" : p === "middle" ? "in the middle (Middle porch)" : "after Flip porch"));
        message = `If a customer picks the ${words(lens.map((n) => `${porchDepthOf(t)} × ${n}`))} porch ${at}, two porch posts end up in the same spot ${spot}, on every size. Move one, or remove it.`;
      } else message = `${t.porch !== "S" && sizes.length === result.sizes.length ? "Two" : `${where} two`} porch posts stand in the same spot ${spot}. Move one, or remove it.`;
    } else if (g.kind === "window") message = `${where} ${itemLabel(g.item, recipe, g.frame)} ${g.reason.kind === "porch" ? "would stand in the open porch" : g.reason.kind === "run" ? "would be on the dog run" : "doesn't fit"}, so it's left off there.`;
    else message = `${where} ${itemLabel(g.item, recipe, g.frame)} doesn't fit: ${reasonWords(g, recipe)}.`;
    const extra = { entryIndex: g.entryIndex, otherEntryIndex: g.otherEntryIndex, cat: g.cat, wall: g.wall, sizes, variants: g.events.map((e) => ({ size: e.size, ...e.variant })), kind: g.kind };
    report(g.kind === "window" || g.kind === "posts" ? "warning" : "error", message, extra);
    if (g.kind === "window") result.leftOff.push({ ...extra, message });
  }
  const doorEvents = events.filter((e) => e.kind === "door"), noDoor = events.some((e) => e.kind === "no-door");
  if (!noDoor) for (const entryIndex of unique(doorEvents.map((e) => e.entryIndex))) {
    const bad = new Set(doorEvents.filter((e) => e.entryIndex === entryIndex).map((e) => e.size));
    /* A suggested limit must leave another door on every omitted size. */
    if (result.checks.some((c) => bad.has(c.size) && !c.items.some((i) => i.entryIndex !== entryIndex && ["door", "ru"].includes(cat.CAT[i.cat].k)))) continue;
    for (const [rule, axis, unit] of [["minL", 1, "long"], ["minW", 0, "wide"]]) {
      const good = result.sizes.filter((s) => !bad.has(s));
      if (!good.length) continue;
      const threshold = Math.min(...good.map((s) => +s.split("x")[axis]));
      if (!result.sizes.every((s) => bad.has(s) === (+s.split("x")[axis] < threshold))) continue;
      const when = { ...(recipe[entryIndex].when || {}), [rule]: threshold };
      result.fixes.push({ entryIndex, when, words: `Only put it on sizes ${threshold} ft ${unit} and up`, message: `Only put it on sizes ${threshold} ft ${unit} and up` });
      break;
    }
  }
  for (const check of result.checks) {
    const applies = (p) => p.variants && p.variants.some((v) => v.size === check.size && v.pLen === check.variant.pLen && v.pMid === check.variant.pMid && v.pFlip === check.variant.pFlip);
    check.problems = result.problems.filter(applies);
    check.errors = check.problems.filter((p) => p.kind !== "posts" && p.kind !== "window").map((p) => p.message).concat(check.errors.filter((e) => typeof e === "string"));
    check.warnings = check.problems.filter((p) => p.kind === "posts" || p.kind === "window").map((p) => p.message);
    check.messages = check.errors.concat(check.warnings);
  }
  const typical = result.sizes.length > 5 ? 4 : Math.floor(result.sizes.length / 2);
  const sampleSizes = unique([result.sizes[0], result.sizes[typical], result.sizes[result.sizes.length - 1]]);
  result.examples = sampleSizes.map((size, i) => {
    const choices = result.checks.filter((c) => c.size === size), longest = Math.max(...choices.map((c) => c.variant.pLen));
    const example = choices.find((c) => c.problems?.some((p) => p.kind === "posts")) || choices.find((c) => c.variant.pLen === longest && !c.variant.pMid && !c.variant.pFlip) || choices[0];
    return { ...example, label: ["Smallest", "Typical", "Largest"][i] };
  });
  return finish(result);
}

function finish(result) {
  result.errors = unique(result.errors); result.warnings = unique(result.warnings);
  result.messages = result.errors.concat(result.warnings);
  result.ok = !result.errors.length && !result.unchecked.length;
  const count = result.unchecked.length ? unique(result.checks.filter((c) => !result.unchecked.includes(sizeWords(c.size))).map((c) => c.size)).length : result.sizes.length;
  result.summary = `Checked ${count} ${count === 1 ? "size" : "sizes"}. ${result.errors.length ? "The standard layout needs a change." : result.warnings.length ? "One thing to look at." : "Everything fits on every size."}`;
  return result;
}
