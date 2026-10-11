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
     that only gained sizes, at the new sizes; a changed extra with numbers,
     on each style it reaches, with that extra on.
   * Order, per style: the size the designer opens on, the smallest, the
     largest, then the rest; each with its side porch lengths and dormers.
   * A time budget, not a count (SAVE_BUDGET_MS, about 3 s: a Netlify
     function has 10 s and runs slower than a computer). What is left is
     listed ("Not checked yet: 14 sizes of the Lofted Barn. Press Check every
     size.") and never refuses the save; the How it's built screen checks
     the rest in the browser.
   * At most 8 lines in the refusal, like other save problems.

   checkChangedStyles(before, after, manufacturer, library, {cat, budgetMs})
     -> {problems: [words], warnings: [words], unchecked: [words],
         checked: [style names], already, buildings, ms} */

import { resolve } from "../../model/company.js";
import { changedStyles, checkAgainstStandard, summarize, withoutOwnNumbers } from "../../model/built-check.js";

export const SAVE_BUDGET_MS = 3000;

function now() { return (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now(); }

export function checkChangedStyles(before, after, manufacturer, library, { cat = null, budgetMs = SAVE_BUDGET_MS } = {}) {
  const t0 = now();
  const empty = { problems: [], warnings: [], unchecked: [], checked: [], already: 0, buildings: 0, ms: 0 };
  const catNext = cat || resolve(after, manufacturer, library);
  const todo = changedStyles(before, after, manufacturer, catNext);
  if (!todo.length) return empty;
  const std = resolve(withoutOwnNumbers(after), manufacturer, library);
  const results = [];
  for (const job of todo) {
    const left = Math.max(0, budgetMs - (now() - t0));
    results.push(checkAgainstStandard(catNext, std, job.key, { sizes: job.sizes, extra: job.extra, budgetMs: left }));
  }
  const words = summarize(results);
  return { ...words, checked: [...new Set(results.map((r) => r.name))], ms: now() - t0 };
}
