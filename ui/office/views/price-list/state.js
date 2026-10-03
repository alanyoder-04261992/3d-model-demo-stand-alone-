/* WHAT THE PRICE LIST SCREEN REMEMBERS while the owner works, shared by its
   tabs. It lives as long as the page does, so switching tabs (or going to
   another screen and coming back) never loses a change that has not been
   saved yet; leaving the price list for another screen asks first and then
   lets the changes go.

   saved   the price list as last loaded from the server
           {settings, version, cfg, savedAt, savedBy}
   draft   the owner's working copy of saved.settings (null for everyone else)
   parked  things switched off since the last save, kept so switching them
           back on brings back their sizes, prices and names:
           {offer: {key: entry}, items: {id: value}, options: {group: {id: value}}}
   M       the builder's library (library/manufacturers/<id>.json)

   The screen (views/price-list.js) sets hooks.edited; a tab calls
   edited() after changing the draft, edited({tab: true}) when the tab
   itself must be drawn again. */

export const TABS = [
  ["buildings", "Buildings"],
  ["doors", "Doors & windows"],
  ["options", "Options"],
  ["colors", "Colors"],
  ["history", "History"],
];

export const S = {
  saved: null,
  latest: null,
  draft: null,
  parked: { offer: {}, items: {}, options: {} },
  M: null,
  example: undefined,
  owner: false,
  tab: "buildings",
  problems: [],
  locks: {},
  changes: [],
  justSaved: null,
  openStyles: new Set(),
  closedGroups: new Set(),
  lastWidth: {},
  focus: null,
  hooks: {},
  ctx: null,
};

export function edited(opts = {}) {
  S.hooks.edited?.(opts);
}

export function freshParked() {
  return { offer: {}, items: {}, options: {} };
}
