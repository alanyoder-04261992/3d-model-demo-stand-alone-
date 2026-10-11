/* THE EVERY-SIZE CHECK ON A PRICE LIST SAVE (How it's built).

   When the owner saves building numbers of the business's own -- a wall
   height, a roof pitch, a porch depth, an extra that makes a roof steeper --
   every style those numbers reach is drawn at every size it is sold in
   (model/style-check.js) before the save is written. Anything the new
   numbers cause that does not fit (a door taller than the wall leaves room
   for, a roof edge hanging in front of a door, framing that does not build)
   refuses the save with the words, like any other price list problem. What
   the same building also has with the standard numbers is never the
   owner's: it does not stop a save (model/built-check.js).

   * Only what changed is checked: a price-only save draws nothing and stays
     instant. A style whose numbers changed is checked at every size; a style
     that only gained sizes, at the new sizes; each of those again with every
     extra that changes how it is built switched on (the sample's Steep roof
     with a new wall); an extra that changed, or that reaches a style it did
     not reach before, on each style it reaches, with that extra on
     (model/built-check.js changedStyles).
   * Order, across every style reached: the size the designer opens on of
     each first, then the smallest and largest of each, then the rest; each
     with its side porch lengths and dormers (checkJobs).
   * A time budget, not a count (SAVE_BUDGET_MS, about 3 s: a Netlify
     function has 10 s and runs slower than a computer). What is left is
     listed ("Not checked yet: 14 sizes of the Lofted Barn. Press Check every
     size.") and never refuses the save; the How it's built screen checks
     the rest in the browser.
   * At most 8 lines in the refusal, like other save problems.

   checkChangedStyles(before, after, manufacturer, library, {cat, budgetMs})
     -> {problems: [words], warnings: [words], unchecked: [words],
         checked: [style names], styles: [{key, name}], already, buildings, ms} */

import { resolve } from "../../model/company.js";
import { changedStyles, checkJobs, summarize, withoutOwnNumbers } from "../../model/built-check.js";

export const SAVE_BUDGET_MS = 3000;

function now() { return (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now(); }

export function checkChangedStyles(before, after, manufacturer, library, { cat = null, budgetMs = SAVE_BUDGET_MS } = {}) {
  const t0 = now();
  const empty = { problems: [], warnings: [], unchecked: [], checked: [], styles: [], already: 0, buildings: 0, ms: 0 };
  const catNext = cat || resolve(after, manufacturer, library);
  /* the price list before this save, resolved, tells which styles an extra
     already reached (an older one that no longer resolves reaches none) */
  let catBefore = null;
  try { catBefore = before && typeof before === "object" ? resolve(before, manufacturer, library) : null; } catch { catBefore = null; }
  const todo = changedStyles(before, after, manufacturer, catNext, catBefore);
  if (!todo.length) return empty;
  /* the standard: no numbers of the business's own, and its raw
     construction as it was before this save */
  const std = resolve(withoutOwnNumbers(after, before && typeof before === "object" ? before : undefined), manufacturer, library);
  const results = checkJobs(catNext, std, todo, { budgetMs: Math.max(0, budgetMs - (now() - t0)) });
  const words = summarize(results);
  const styles = [];
  for (const r of results) if (!styles.some((x) => x.key === r.key)) styles.push({ key: r.key, name: r.name });
  return { ...words, checked: styles.map((x) => x.name), styles, ms: now() - t0 };
}
