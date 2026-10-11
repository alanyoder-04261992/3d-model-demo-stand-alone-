/* THE LOCK: WHAT BARNWRIGHT MAY CHANGE IN A BUSINESS'S PRICE LIST AND
   SETTINGS (docs/OFFICE.md, "Barnwright setup access", "The lock").

   Every Barnwright check and save runs this first (the visit's save and
   put back now; the door's check, save and undo too), then the very same
   check() the owner's own save runs. So a Barnwright save can never be
   anything an owner's save couldn't be, and it can never:

     * open or close the 3D designer to customers (status);
     * change which websites may show it (embed), the license settings,
       the credit line, or where quotes go (every `leads` key except the
       quote form's boxes, its plan question and its texting words);
     * change how the buildings are built, except one gable roof's pitch;
     * put a web address in as the logo: a logo is a picture of 150 KB or
       less, so no customer's 3D designer ever loads it from somewhere else.

   While the owner's switch is on (the business is open to customers), the
   door may not change the business phone, email or website either; Alan
   by hand in the visit may.

   carryLocked() is for going back (put back, undo): the "never" parts keep
   their values from now, so going back can't open the 3D designer, change
   where quotes go or which websites may show it.

   Pure: no store, no clock. Node-safe and browser-safe. */

export const LOCK_WORDS = Object.freeze({
  status: "Only the owner can open or close the 3D designer to customers.",
  id: "This price list belongs to a different business. Reload the page and try again.",
  manufacturer: "The builder's library cannot change here.",
  license: "The 3D designer's license settings can't be changed by Barnwright.",
  embed: "Only the owner can change which websites may show the 3D designer.",
  leads: "Only the owner can change where quotes go.",
  credit: "The 3D designer credit line can't be changed by Barnwright.",
  construction: "How the buildings are built can't be changed here, except a gable roof's pitch.",
  logoAddress: "The logo must be a picture uploaded in Settings, Logo, not a web address.",
  logoBig: "The logo is too big. Use a picture of 150 KB or less.",
  contact: "While their 3D designer is open, the business phone, email and website can be changed only by the owner, or by Alan by hand in Open their price list.",
});

/* The library styles whose gable roof pitch may change (set_roof_pitch). */
export const GABLE_STYLES = Object.freeze(["UT", "SU", "GU", "C", "SC", "DSC", "G", "MU", "MG", "DK"]);
export const LOGO_MAX = 150 * 1024;

/* the quote form's own parts; every other `leads` key says where quotes go */
const LEADS_OPEN = ["fields", "askPlan", "smsConsent"];
const CONTACT = ["phone", "email", "website"];
const NEVER = ["status", "id", "manufacturer", "license", "embed"];
const LOGO_RE = /^data:image\/(?:png|webp|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/;

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/* The same value whatever order its keys were written in. */
function canon(v) {
  if (Array.isArray(v)) return `[${v.map(canon).join(",")}]`;
  if (isObj(v)) return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canon(v[k])}`).join(",")}}`;
  return JSON.stringify(v ?? null);
}
const same = (a, b) => canon(a) === canon(b);
const openOf = (s) => (s?.status === "suspended" ? "suspended" : "active");

/* construction without the one rule Barnwright may change (the gable
   roof's rise), with the containers it leaves empty taken away */
function pitchless(construction) {
  if (!isObj(construction)) return construction ?? null;
  const c = structuredClone(construction);
  const gable = c.roof?.shapes?.gable;
  if (isObj(gable) && "rise" in gable) {
    delete gable.rise;
    if (!Object.keys(gable).length) delete c.roof.shapes.gable;
    if (!Object.keys(c.roof.shapes).length) delete c.roof.shapes;
    if (!Object.keys(c.roof).length) delete c.roof;
  }
  return Object.keys(c).length ? c : null;
}
const riseOf = (construction) => (isObj(construction?.roof?.shapes?.gable) ? construction.roof.shapes.gable.rise : undefined);

/* A rise Barnwright may write: one rule per library gable style, N/12 for N
   from 3 to 12, then the library's own rise last. */
function pitchRuleOk(rise, standardRise) {
  if (rise === undefined) return true;
  if (!Array.isArray(rise) || rise.length < 2) return false;
  const last = rise[rise.length - 1];
  if (!isObj(last) || Object.keys(last).length !== 1 || !isObj(last.value) || Object.keys(last.value).length !== 1) return false;
  if (standardRise != null && last.value.w !== standardRise) return false;
  const seen = new Set();
  for (const rule of rise.slice(0, -1)) {
    if (!isObj(rule) || !same(Object.keys(rule).sort(), ["value", "when"])) return false;
    const styles = rule.when?.styles;
    if (!isObj(rule.when) || Object.keys(rule.when).length !== 1 || !Array.isArray(styles) || styles.length !== 1) return false;
    if (!GABLE_STYLES.includes(styles[0]) || seen.has(styles[0])) return false;
    seen.add(styles[0]);
    if (!isObj(rule.value) || Object.keys(rule.value).length !== 1 || typeof rule.value.w !== "number") return false;
    const twelfths = rule.value.w * 24;
    if (Math.abs(twelfths - Math.round(twelfths)) > 1e-9 || Math.round(twelfths) < 3 || Math.round(twelfths) > 12) return false;
  }
  return true;
}

/* -> the plain sentences for everything in `next` that Barnwright may not
   change from `old` (none: an empty list). options:
     door          true for the door (Claude through the Control Room)
     mode          "prelive" or "switch" (access() says which)
     standardRise  the library's own gable rise (library/construction.json) */
export function lockProblems(old, next, { door = false, mode = "prelive", standardRise = null } = {}) {
  const out = [];
  const o = isObj(old) ? old : {}, n = isObj(next) ? next : {};
  if (openOf(o) !== openOf(n)) out.push(LOCK_WORDS.status);
  if (o.id !== n.id) out.push(LOCK_WORDS.id);
  if (o.manufacturer !== n.manufacturer) out.push(LOCK_WORDS.manufacturer);
  if (!same(o.license, n.license)) out.push(LOCK_WORDS.license);
  if (!same(o.embed, n.embed)) out.push(LOCK_WORDS.embed);
  const ol = isObj(o.leads) ? o.leads : {}, nl = isObj(n.leads) ? n.leads : {};
  const routing = [...new Set([...Object.keys(ol), ...Object.keys(nl)])].filter((k) => !LEADS_OPEN.includes(k));
  if (routing.some((k) => !same(ol[k], nl[k]))) out.push(LOCK_WORDS.leads);
  const ob = isObj(o.brand) ? o.brand : {}, nb = isObj(n.brand) ? n.brand : {};
  if (!same(ob.credit, nb.credit)) out.push(LOCK_WORDS.credit);
  if (!same(pitchless(o.construction), pitchless(n.construction))
    || (!same(riseOf(o.construction), riseOf(n.construction)) && !pitchRuleOk(riseOf(n.construction), standardRise))) {
    out.push(LOCK_WORDS.construction);
  }
  const logo = nb.logo ?? "";
  if (logo !== (ob.logo ?? "") && logo !== "") {
    if (typeof logo !== "string" || !LOGO_RE.test(logo)) out.push(LOCK_WORDS.logoAddress);
    else if (logo.length > LOGO_MAX) out.push(LOCK_WORDS.logoBig);
  }
  if (door && mode === "switch" && CONTACT.some((k) => (ob[k] || "") !== (nb[k] || ""))) out.push(LOCK_WORDS.contact);
  return out;
}

/* -> a copy of `into` (an earlier price list being put back) with the
   parts Barnwright may never change taken from `from` (the one in use now):
   status, id, manufacturer, license, embed, the credit line, where quotes
   go, and how the buildings are built (the gable pitch rule stays as `into`
   had it). */
export function carryLocked(from, into) {
  const f = isObj(from) ? from : {};
  const out = structuredClone(isObj(into) ? into : {});
  for (const k of NEVER) {
    if (k in f) out[k] = structuredClone(f[k]);
    else delete out[k];
  }
  out.brand = isObj(out.brand) ? out.brand : {};
  if (isObj(f.brand) && "credit" in f.brand) out.brand.credit = structuredClone(f.brand.credit);
  else delete out.brand.credit;
  const fl = isObj(f.leads) ? f.leads : {};
  const leads = isObj(out.leads) ? out.leads : {};
  for (const k of [...new Set([...Object.keys(fl), ...Object.keys(leads)])]) {
    if (LEADS_OPEN.includes(k)) continue;
    if (k in fl) leads[k] = structuredClone(fl[k]);
    else delete leads[k];
  }
  if (isObj(out.leads) || Object.keys(leads).length) out.leads = leads;
  const rise = riseOf(out.construction);
  const built = pitchless(f.construction);
  const construction = built ? structuredClone(built) : {};
  if (rise !== undefined) {
    construction.roof = isObj(construction.roof) ? construction.roof : {};
    construction.roof.shapes = isObj(construction.roof.shapes) ? construction.roof.shapes : {};
    construction.roof.shapes.gable = isObj(construction.roof.shapes.gable) ? construction.roof.shapes.gable : {};
    construction.roof.shapes.gable.rise = structuredClone(rise);
  }
  if (Object.keys(construction).length) out.construction = construction;
  else delete out.construction;
  return out;
}
