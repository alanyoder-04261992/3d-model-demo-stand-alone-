/* THE OFFICE'S FILING CABINET: one Netlify Blobs store (or a stand-in with
   the same three calls, for the checks and the local Office).

   The store must offer:
     getWithMetadata(key, {type: "json", consistency: "strong"}) -> {data, etag} | null
     setJSON(key, data, {onlyIfNew} | {onlyIfMatch: etag})      -> {modified, etag}
     delete(key)
     list({prefix, paginate: true})                              -> async pages of {blobs: [{key}]}

   Three ways to write:
     create(key, data)        only if nothing is there yet; false if something is
     replace(key, read, data) only if the record is still the one that was read
     change(key, fn)          read, let fn change a copy, write it back only if
                              nobody else wrote in between -- and if somebody
                              did, wait a moment, read again and repeat (up to
                              12 times). This is how two dealers can add notes
                              to the same customer at the same moment and both
                              notes stay.

   If fn throws, nothing is written: fn only ever changes a copy, and the
   copy is written after fn has finished. fn may run more than once (once
   per try), so it must not change anything outside the copy it is given. */

import { fail } from "./http.js";

const ATTEMPTS = 12;

/* After a clash, wait a short, slightly random time before trying again,
   so a crowd of writers to one record (a burst of website quotes on one
   lot's list) spreads out instead of clashing again in step. */
const pause = (attempt) => new Promise((done) => setTimeout(done, Math.random() * Math.min(5 * 2 ** attempt, 200)));

export function wrapStore(blobs) {
  async function read(key) {
    const r = await blobs.getWithMetadata(key, { type: "json", consistency: "strong" });
    if (!r) return null;
    return { data: r.data, etag: r.etag };
  }

  async function get(key) {
    return (await read(key))?.data ?? null;
  }

  async function create(key, data) {
    const r = await blobs.setJSON(key, data, { onlyIfNew: true });
    return !!r.modified;
  }

  async function replace(key, previous, data) {
    if (!previous?.etag) fail(503, "Something went wrong saving that. Please try again.");
    const r = await blobs.setJSON(key, data, { onlyIfMatch: previous.etag });
    return !!r.modified;
  }

  async function put(key, data) {
    await blobs.setJSON(key, data);
  }

  /* fn(copy) returns the new record, or undefined to keep the copy it
     changed, or the symbol KEEP to write nothing. A missing record is passed
     as null; fn may then return a new record to create. */
  async function change(key, fn) {
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      if (attempt > 0) await pause(attempt);
      const current = await read(key);
      const copy = current ? structuredClone(current.data) : null;
      let next = await fn(copy);
      if (next === KEEP) return current?.data ?? null;
      if (next === undefined) next = copy;
      if (next == null) return null;
      const ok = current ? await replace(key, current, next) : await create(key, next);
      if (ok) return next;
    }
    fail(503, "We're busy right now. Try again in a minute.");
  }

  async function remove(key) {
    await blobs.delete(key);
  }

  async function keys(prefix) {
    const out = [];
    for await (const page of blobs.list({ prefix, paginate: true })) {
      for (const blob of page.blobs) out.push(blob.key);
    }
    return out;
  }

  /* Read every record under a prefix, a few at a time. */
  async function all(prefix, limit = 2000) {
    const names = await keys(prefix);
    if (names.length > limit) fail(503, "There are too many records to show at once.");
    const out = [];
    for (let i = 0; i < names.length; i += 16) {
      const batch = await Promise.all(names.slice(i, i + 16).map(get));
      for (const data of batch) if (data) out.push(data);
    }
    return out;
  }

  return { read, get, create, replace, put, change, remove, keys, all };
}

export const KEEP = Symbol("keep");

/* An in-memory store with the same behaviour as Netlify Blobs, for the
   checks. ETags change on every write; a failed condition writes nothing. */
export class MemoryBlobs {
  constructor() {
    this.values = new Map();
    this.seq = 0;
  }
  async getWithMetadata(key) {
    const hit = this.values.get(key);
    return hit ? structuredClone(hit) : null;
  }
  async setJSON(key, data, options = {}) {
    const old = this.values.get(key);
    if (options.onlyIfNew && old) return { modified: false };
    if (options.onlyIfMatch && old?.etag !== options.onlyIfMatch) return { modified: false };
    const etag = `"${++this.seq}"`;
    this.values.set(key, { data: structuredClone(data), etag });
    return { modified: true, etag };
  }
  async delete(key) {
    this.values.delete(key);
  }
  async *list({ prefix = "" } = {}) {
    const blobs = [...this.values.keys()].filter((k) => k.startsWith(prefix)).sort().map((key) => ({ key }));
    yield { blobs };
  }
}
