/* PLACEHOLDER: this screen is being written. */
import { pageHead, emptyState } from "../dom.js";
export function render(ctx) {
  ctx.setTitle("lots");
  const wrap = document.createElement("div");
  wrap.append(pageHead("lots"), emptyState("Coming soon", "This screen is being built."));
  return wrap;
}
