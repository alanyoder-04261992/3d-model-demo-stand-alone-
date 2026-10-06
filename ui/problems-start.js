/* THE 3D DESIGNER'S PROBLEM WATCHER, STARTED BEFORE ANYTHING ELSE.

   index.html loads this on its own, just before ui/app.js, so a problem
   while the designer is still loading is passed on too (ui/problems.js):
   one of its scripts that didn't arrive, or one that broke as it started.
   ui/app.js imports it first as well, for a page that loads only app.js;
   the browser runs it once either way. The page is the path only: the
   part after # is the customer's building. */

import { watchProblems } from "./problems.js";

watchProblems({
  area: "designer",
  endpoint: () => new URL("../api/office/problem", import.meta.url).href,
  page: () => location.pathname,
});
