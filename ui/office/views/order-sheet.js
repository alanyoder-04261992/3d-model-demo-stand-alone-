/* PLACEHOLDER: this screen is being written. */
import { pageHead, emptyState } from "../dom.js";
export function render(ctx) {
  ctx.setTitle("order-sheet");
  const wrap = document.createElement("div");
  wrap.append(pageHead("order-sheet"), emptyState("Coming soon", "This screen is being built."));
  return wrap;
}
