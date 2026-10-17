/* Carry only this editor's changed values onto the newly saved settings.
   Objects merge by field; an edited array stays together. The review
   screen explains overlapping edits before the person chooses this. */
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const object = (value) => value && typeof value === "object" && !Array.isArray(value);
export function mergeSettings(before, mine, latest) {
  if (same(before, mine)) return structuredClone(latest);
  if (object(before) && object(mine) && object(latest)) {
    const out = {};
    for (const key of new Set([...Object.keys(before), ...Object.keys(mine), ...Object.keys(latest)])) {
      const value = mergeSettings(before[key], mine[key], latest[key]);
      if (value !== undefined) out[key] = value;
    }
    return out;
  }
  return structuredClone(mine);
}
