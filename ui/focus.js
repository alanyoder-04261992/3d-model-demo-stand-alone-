/* Remember a public designer control across a redraw. Stable keys name the
   same choice, rather than its old DOM node or its position in a list. */
export function rememberFocus() {
  const node = document.activeElement;
  if (!node || node === document.body || node === document.documentElement) return null;
  if (node.id) return {node, id: node.id};
  const host = node.parentElement?.closest("[id]");
  const key = node.getAttribute("data-focus-key");
  return host && key !== null ? {node, host: host.id, key} : null;
}

export function restoreFocus(saved, {force = false, preventScroll = true} = {}) {
  if (!saved) return false;
  const active = document.activeElement;
  if (!force && active && active !== document.body && active !== document.documentElement && active !== saved.node) return false;
  const target = saved.id ? document.getElementById(saved.id)
    : Array.from(document.getElementById(saved.host)?.querySelectorAll("[data-focus-key]") || []).find(node => node.getAttribute("data-focus-key") === saved.key);
  if (!target || target.disabled || !target.getClientRects().length) return false;
  try { target.focus({preventScroll}); return document.activeElement === target; } catch { return false; }
}
