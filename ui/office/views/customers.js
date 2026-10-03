/* PLACEHOLDER: this screen is being written. */
import { pageHead, emptyState } from "../dom.js";
export function render(ctx) {
  ctx.setTitle("customers");
  const wrap = document.createElement("div");
  wrap.append(pageHead("customers"), emptyState("Coming soon", "This screen is being built."));
  return wrap;
}
