/* A quote's original building, independent of later price-list changes.
   Retain the resolved construction and item definitions used at pricing;
   keep only this style and size, and omit logos and submission links.
   Identical snapshots share one immutable server record. */
export function quoteCatalogue(cat, design) {
  const saved = structuredClone(cat);
  saved.TYPES = { [design.type]: saved.TYPES[design.type] };
  saved.P = { [design.type]: { [design.size]: saved.P[design.type][design.size] } };
  saved.CATS = saved.CATS.filter(([, styles]) => styles.split(",").includes(design.type)).map(([label]) => [label, design.type]);
  saved.defaults = { ...saved.defaults, type: design.type, size: design.size };
  saved.brand = { ...saved.brand, logo: "" };
  saved.leads = { ...saved.leads, mode: "none", url: "", images: false };
  saved.embed = { origins: [], shareUrl: "" };
  return saved;
}
