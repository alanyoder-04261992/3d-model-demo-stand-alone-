/* WHAT A DESIGN COSTS. Node-safe, pure: every function takes the design
   (state) and the company's catalogue (cat) and changes nothing.

   Lifted from Barnwright's 3ddesign.html (pricing 638-655 and 1313-1391, the
   company extras 830-913) with the same rules and the same quote lines:
     pPrice / pSizes / minPrice   the price book (the company's own; no
                                  second list of overrides -- the company file
                                  IS the price list)
     basePrice                    the building at its size, standard doors and
                                  windows included
     stdDouble                    does this building come with a double of that
                                  window? (read off its loadout, never stored)
     itemCharge                   one item: upgrades are the difference, no
                                  refunds, a second pane costs a window unless
                                  the building comes with the double
     includedCounts /             "comes with the building" covers only what
     chargedIncluded              the building's own size and porch come with;
                                  more is charged at the normal price
     priceParts                   every quote line [label, amount, key] + total
     sqftCharge                   THE ONE per-square-foot price, used by the
                                  button label AND the charge (Barnwright had
                                  four copies of it)
     money                        "$1,234.00"
     rtoTerms / rtoMonthly        rent to own: the terms offered, and the
                                  monthly payment for one of them (RTO_NOTE:
                                  the words under it when the company has
                                  written none)

   The per-square-foot areas are Barnwright's: floor = W x L (the corner porch's
   4 ft deck included), wall = round(2 x (W + L) x wall height), roof =
   round(floor x 1.15); each charge rounds to the nearest $5 with a $5 minimum.
   Those three numbers (roundTo, minCharge, roofAreaFactor) are the company's
   pricing policy, Barnwright's values by default.

   Quote-line keys use one namespace everywhere: cat.<item>, misc.<shutter|lite|ext>,
   dormer.<size>, elec.<n>, ramp.<id>, rate.<id>, and an extra's own key. */

import { frameOf } from "./frame.js";
import { standardItems } from "./loadouts.js";
import { extraOfferedOn } from "./company.js";

export const DEFAULT_POLICY = Object.freeze({ roundTo: 5, minCharge: 5, roofAreaFactor: 1.15 });

export function policyOf(cat) {
  const p = (cat && cat.pricing) || {};
  return {
    roundTo: p.roundTo != null ? p.roundTo : DEFAULT_POLICY.roundTo,
    minCharge: p.minCharge != null ? p.minCharge : DEFAULT_POLICY.minCharge,
    roofAreaFactor: p.roofAreaFactor != null ? p.roofAreaFactor : DEFAULT_POLICY.roofAreaFactor,
  };
}

/* own keys only: "constructor" is not a size (a plain object would hand back
   a function, which then counts as "sold") */
function ownKey(o, k) { return o != null && Object.prototype.hasOwnProperty.call(o, k); }

export function pPrice(t, z, cat) {
  const P = cat.P;
  return (ownKey(P, t) && ownKey(P[t], z) && P[t][z]) || 0;
}

/* Every size of a style, in the company's own order (the size-chip order). */
export function pSizes(t, cat) {
  return ownKey(cat.P, t) ? Object.keys(cat.P[t]) : [];
}

export function minPrice(t, cat) {
  let m = 1e9;
  pSizes(t, cat).forEach((z) => { const v = pPrice(t, z, cat); if (v && v < m) m = v; });
  return m === 1e9 ? 0 : m;
}

export function basePrice(state, cat) { return pPrice(state.type, state.size, cat); }

/* round to the policy's step with its minimum -- Barnwright's r5/r5x */
export function roundCharge(x, pol) {
  return Math.max(pol.minCharge, Math.round(x / pol.roundTo) * pol.roundTo);
}

/* the three areas, exactly as Barnwright works them out */
export function areasOf(frame, pol) {
  const areaF = frame.d.W * frame.d.L;
  return {
    areaF: areaF,
    wallA: Math.round(2 * (frame.d.W + frame.d.L) * frame.t.wallH),
    roofA: Math.round(areaF * pol.roofAreaFactor),
  };
}

/* THE per-square-foot charge. basis: "floor" | "wall" | "roof" (or the extras'
   names sqftF | sqftW | sqftR). One function for the label and the charge. */
export function sqftCharge(basis, rate, frame, cat) {
  const pol = policyOf(cat);
  const a = areasOf(frame, pol);
  const area = (basis === "floor" || basis === "sqftF") ? a.areaF :
    (basis === "wall" || basis === "sqftW") ? a.wallA :
    (basis === "roof" || basis === "sqftR") ? a.roofA : NaN;
  if (!(area === area)) throw new Error(`"${basis}" is not a per-square-foot basis (use floor, wall or roof).`);
  return roundCharge(area * rate, pol);
}

/* Does this building, as it is sold, come with a DOUBLE of this window?
   Worked out fresh from the loadout, because a saved design is reopened
   without the fields that say where an item came from. */
export function stdDouble(catId, state, cat, frame) {
  try {
    const fr = frame || frameOf(state, cat);
    return standardItems(fr.t, fr.d.W, fr.d.L, { CAT: fr.CAT, span: fr.span, ws: fr.ws, frame: fr }, state.type)
      .some((x) => x.dbl && x.cat === catId);
  } catch (e) { return false; }
}

/* WHAT "COMES WITH THE BUILDING" COVERS (Alan, Oct 17 2026: "Yes, charge
   for them"). An item marked included (inc) is free only up to how many of
   that item the building comes with AT ITS OWN SIZE AND PORCH: the standard
   layout for the size and porch it is now (model/loadouts.js standardItems,
   the same list a style or size change lays out). Counted by the item the
   building came with: a swapped door counts as the door it replaced
   (origCat).
   Why: a customer can lay out a 12x32, move a door, then pick 8x12; the
   doors and windows are kept, still marked included (DIFFERENCES #12). The
   ones above what an 8x12 comes with are charged at their normal price, as
   if never included. A link edited by hand to the same thing is priced the
   same way. Nothing is refused for it.
   Two things are never charged twice, so a customer pays exactly what this
   building costs made at its own size:
   - a kept item standing in for one this size comes with that is not on
     the building (a touched 10x16 Cottage made 10x12 keeps its 72 in double
     doors, and the 10x12 comes with the 48 in door) is priced as that swap
     on the sheet would be: the difference, never a refund;
   - the shop standard's own door at some sizes (t.standardSwaps, the 72 in
     double doors and the 48 in door, DIFFERENCES #27) counts as the other
     of the pair, free, because the designer turns it into that door
     (model/design.js followStandardDoor); a look-only link drawn with the
     door it was sold with keeps its price.
   When more are marked than the building comes with, the ones that would
   cost the most stay included (in their order on the building when they
   cost the same), so the customer pays the least the rule allows.
   includedCounts -> Map(item -> how many come with this size and porch)
   chargedIncluded -> Map(marked item -> null: charged at its normal price,
   or the item it is priced as a swap from). allowance: another count to use
   instead (the server's History copy for a design made under an older price
   list, server/office/pricing.js). */
export function includedCounts(state, cat, frame) {
  const counts = new Map();
  let std = [];
  try {
    const fr = frame || frameOf(state, cat);
    std = standardItems(fr.t, fr.d.W, fr.d.L, { CAT: fr.CAT, span: fr.span, ws: fr.ws, frame: fr }, state.type);
  } catch (e) { std = []; }
  std.forEach((x) => counts.set(x.cat, (counts.get(x.cat) || 0) + 1));
  return counts;
}

const NONE = new Map();

/* the items the sheet lets this one be swapped for (the server's check too) */
export function swapsOf(key, cat) {
  const c = cat.CAT[key], L = cat.LISTS || {};
  const k = c && c.k;
  return k === "win" ? (L.sheetWindow || []) : (k === "door" || k === "ru") ? (L.sheetDoor || []) : [key];
}

export function chargedIncluded(state, cat, frame, allowance) {
  const out = new Map();
  const groups = new Map();
  (state.items || []).forEach((it) => {
    if (!it.inc || it.pk || !cat.CAT[it.cat]) return;
    const key = it.origCat || it.cat;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(it);
  });
  if (!groups.size) return out;
  const fr = frame || frameOf(state, cat);
  const allowed = allowance || includedCounts(state, cat, fr);
  const left = new Map(allowed), over = [];
  for (const [key, list] of groups) {
    const room = allowed.get(key) || 0;
    left.set(key, Math.max(0, room - list.length));
    if (list.length <= room) continue;
    const saving = (it) => itemCharge(it, state, cat, fr, NONE, true) - itemCharge(it, state, cat, fr, NONE);
    list.map((it, i) => ({ it, i, save: saving(it) }))
      .sort((a, b) => (b.save - a.save) || (a.i - b.i))
      .slice(room).forEach((x) => over.push(x.it));
  }
  const t = cat.TYPES && cat.TYPES[state.type];
  const pairs = (t && Array.isArray(t.standardSwaps) ? t.standardSwaps : []).filter((e) => e && cat.CAT[e.from] && cat.CAT[e.to]);
  for (const it of over) {
    const was = it.origCat || it.cat;
    const pair = pairs.find((e) => (e.from === was && left.get(e.to) > 0) || (e.to === was && left.get(e.from) > 0));
    if (pair) { const other = pair.from === was ? pair.to : pair.from; left.set(other, left.get(other) - 1); continue; }
    /* in place of an item this size comes with that is not on the building:
       the cheapest such swap */
    let best = null, bestCharge = Infinity;
    for (const [key, n] of left) {
      if (!(n > 0) || !cat.CAT[key] || (key !== it.cat && swapsOf(key, cat).indexOf(it.cat) < 0)) continue;
      const charge = itemCharge(Object.assign({}, it, { origCat: key }), state, cat, fr, NONE);
      if (charge < bestCharge) { best = key; bestCharge = charge; }
    }
    if (best != null) { left.set(best, left.get(best) - 1); out.set(it, best); continue; }
    out.set(it, null);
  }
  return out;
}

/* One item's charge. charged: the Map from chargedIncluded (worked out here
   when not given); asPaid: price it as if it were not marked included. */
export function itemCharge(it, state, cat, frame, charged, asPaid) {
  const CAT = cat.CAT;
  const c = CAT[it.cat];
  if (it.pk) return 0;                                        /* part of the electric package */
  if (it.inc && !asPaid) {
    const over = charged || chargedIncluded(state, cat, frame);
    if (over.has(it)) {
      const as = over.get(it);
      return as == null ? itemCharge(it, state, cat, frame, NONE, true) : itemCharge(Object.assign({}, it, { origCat: as }), state, cat, frame, NONE);
    }
  }
  if (c.perFt) return Math.round(c.p * (it.ln || 4));
  /* A double window is two windows, and the shop builds and glazes both --
     BUT NOT WHEN THE BUILDING COMES WITH THE DOUBLE (the cottage): a standard
     double is priced the way a standard single is, on both of its panes. */
  const twin = (it.dbl && c.k === "win" && !c.gable);
  const up = (it.inc && it.origCat && it.origCat !== it.cat) ? Math.max(0, c.p - CAT[it.origCat].p) : 0;
  if (!it.inc || asPaid) return c.p + (twin ? c.p : 0);
  if (!twin) return up;
  return up + (stdDouble(it.origCat || it.cat, state, cat, frame) ? up : c.p);
}

function hidden(cat, key) { return !!(cat.OPTX && (cat.OPTX.hide || []).indexOf(key) > -1); }

/* The company's own extras (no 3D shape): how many, and what they add.
   With a design, only the ones offered on its building (an extra with a
   styles list, like a Steep roof for the Utility Shed and Side Utility, is
   offered only there: model/company.js extraOfferedOn). */
export function optxList(cat, state) {
  const all = ((cat.OPTX && cat.OPTX.extras) || []).filter((x) => x && x.key && x.name);
  if (!state || !state.type) return all;
  const t = cat.TYPES && cat.TYPES[state.type];
  return all.filter((x) => extraOfferedOn(x, t, state.type));
}
export function optxQty(x, state) {
  const v = state.xopt ? state.xopt[x.key] : null;
  if (x.input === "qty") return Math.max(0, Math.min(99, Math.round(+v || 0)));
  if (x.input === "lf") return Math.max(0, Math.min(200, Math.round(+v || 0)));
  return v ? 1 : 0;
}
export function optxOn(x, state) { return optxQty(x, state) > 0; }
/* what an extra would add if switched on (for its label; Barnwright's
   optxChargeIfOn) */
export function optxChargeIfOn(x, state, cat, frame) {
  const p = +x.price || 0;
  if (x.input === "sqftF" || x.input === "sqftW" || x.input === "sqftR") return sqftCharge(x.input, p, frame || frameOf(state, cat), cat);
  if (x.input === "pct") return roundCharge(basePrice(state, cat) * p / 100, policyOf(cat));
  return Math.round(p);          /* a switch's price; for qty / lf, the price of one */
}
export function optxCharge(x, state, cat, frame) {
  if (!optxOn(x, state)) return 0;
  const p = +x.price || 0;
  if (x.input === "qty" || x.input === "lf") return Math.round(p * optxQty(x, state));
  return optxChargeIfOn(x, state, cat, frame);
}

/* The price of each per-square-foot upgrade for this building (the button
   labels) -- the same function the quote uses. */
export function rateCharges(state, cat, frame) {
  const fr = frame || frameOf(state, cat);
  const out = {};
  for (const k of Object.keys(cat.RATES || {})) out[k] = sqftCharge(cat.RATEDEF[k].basis, cat.RATES[k], fr, cat);
  return out;
}

/* Every quote line and the total. Same lines, labels, keys and order as
   Barnwright's priceParts. An included item above what this size and porch
   come with is a normal line at its normal price (chargedIncluded).
   opts.allowance: the included counts to use instead (the server's History
   copy, server/office/pricing.js). */
export function priceParts(state, cat, frame, opts) {
  const fr = frame || frameOf(state, cat);
  const CAT = cat.CAT, MISC = cat.MISC || {};
  const lines = [];
  const charged = chargedIncluded(state, cat, fr, opts && opts.allowance);
  let total = basePrice(state, cat), shutN = 0, liteN = 0;
  state.items.forEach((it) => {
    const c = CAT[it.cat], chg = itemCharge(it, state, cat, fr, charged);
    const paid = !it.inc || (charged.has(it) && charged.get(it) == null);
    if (chg > 0) lines.push([(paid ? c.n : c.n + " (upgrade)"), chg, "cat." + it.cat]);
    if (it.shut) shutN++;
    if (it.lite && c.k === "door" && c.draw === "shop-door") liteN++;
    total += chg;
  });
  /* (a price missing from MISC means the company does not offer it: no line,
     never a NaN total). An option the company named itself (MISCNAMES,
     ELECPK's fourth entry, RAMPS / DORMERS / RATEDEF names) is quoted by that
     name; otherwise the words are Barnwright's, exactly as they always were. */
  const MN = cat.MISCNAMES || {};
  if (shutN > 0 && MISC.shutter != null) { const shC = MISC.shutter * shutN; lines.push([(MN.shutter || "Shutters") + " × " + shutN + " set" + (shutN > 1 ? "s" : ""), shC, "misc.shutter"]); total += shC; }
  if (liteN > 0 && MISC.lite != null) { const ltC = MISC.lite * liteN; lines.push([(MN.lite || "Door window") + " × " + liteN, ltC, "misc.lite"]); total += ltC; }
  if (fr.t.dormer && state.dormer !== "none") {
    const d = (cat.DORMERS || []).filter((x) => x[0] === state.dormer)[0];
    if (d && !hidden(cat, "dormer." + d[0])) { lines.push([d[1], d[2], "dormer." + d[0]]); total += d[2]; }
  }
  if (state.elec && state.elec.pkg > 0) {
    const epk = (cat.ELECPK || []).filter((x) => +x[0] === +state.elec.pkg)[0];
    const ep = epk ? epk[2] : 0;
    lines.push([(epk && epk[3]) || ("Electric package " + state.elec.pkg), ep, "elec." + state.elec.pkg]); total += ep;
    if (state.elec.ext && MISC.ext != null) { lines.push([MN.ext || "Exterior light + dual switch", MISC.ext, "misc.ext"]); total += MISC.ext; }
  }
  if (state.ramp && state.ramp !== "none") {
    const rmp = (cat.RAMPS || []).filter((x) => x[0] === state.ramp)[0];
    if (rmp) { lines.push([rmp[3] || rmp[1], rmp[2], "ramp." + rmp[0]]); total += rmp[2]; }
  }
  const O = state.opts || {};
  for (const k of Object.keys(cat.RATES || {})) {
    if (!O[k]) continue;
    const def = cat.RATEDEF[k];
    const v = sqftCharge(def.basis, cat.RATES[k], fr, cat);
    lines.push([def.quoteName || def.name, v, "rate." + k]); total += v;
  }
  /* whatever the company added to the list itself */
  optxList(cat, state).forEach((x) => {
    if (!optxOn(x, state)) return;
    const xc = optxCharge(x, state, cat, fr); if (!(xc > 0)) return;
    const q = optxQty(x, state);
    lines.push([x.name + ((x.input === "qty" && q > 1) ? (" × " + q) : (x.input === "lf" ? (" — " + q + " ft") : "")), xc, x.key]);
    total += xc;
  });
  return { base: basePrice(state, cat), lines: lines, total: total };
}

/* "$1,234.00". Barnwright formats with the visitor's own locale; this is fixed
   to US style so a quote reads the same on every device. */
export function money(n, symbol) {
  const v = Number(n) || 0;
  const s = symbol == null ? "$" : symbol;
  return (v < 0 ? "-" + s : s) + Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* RENT TO OWN (the Yoder site, Aug 2026). pricing.rto is
   {factors: {"36": 0.60, "48": 0.53, "60": 0.45}, showTerm, note}: a monthly
   payment is the price / the term's factor / the months -- the arithmetic
   rent-to-own companies use -- worked out on the pre-tax total and rounded
   to the cent. rtoTerms -> the months offered, shortest first; rtoMonthly ->
   the payment, 0 when the term is not one of them. */
/* the words under the monthly price when the company has written none */
export const RTO_NOTE = "Before sales tax and any delivery fee. Starts with a deposit plus the first payment — ask us and we will put the exact figures on your quote.";
export function rtoTerms(rto) {
  const f = rto && rto.factors;
  if (!f || typeof f !== "object") return [];
  return Object.keys(f).map(Number).filter((m) => Number.isInteger(m) && m > 0 && +f[String(m)] > 0).sort((x, y) => x - y);
}
export function rtoMonthly(total, rto, months) {
  const f = rto && rto.factors ? +rto.factors[String(months)] : 0;
  if (!(f > 0) || !(months > 0) || !(total > 0)) return 0;
  return Math.round((total / f / months) * 100) / 100;
}
