/* A FOLDER THAT BEHAVES LIKE NETLIFY BLOBS, for the local Office.

   Each record is one JSON file {data, etag}; the key is the file name
   (encoded, so "customers/abc" is one file). Writes go to a temporary file
   first and are renamed into place, and a write that names an etag (or
   "only if new") is checked against the file on disk first, so the Office's
   "nobody else wrote in between" rule holds here too. One process only. */

import { mkdirSync, readFileSync, writeFileSync, renameSync, readdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";

export class FileBlobs {
  constructor(dir) {
    this.dir = dir;
    mkdirSync(dir, { recursive: true });
    this.seq = 0;
  }
  file(key) {
    return join(this.dir, encodeURIComponent(key) + ".json");
  }
  readRaw(key) {
    try { return JSON.parse(readFileSync(this.file(key), "utf8")); } catch { return null; }
  }
  async getWithMetadata(key) {
    return this.readRaw(key);
  }
  async setJSON(key, data, options = {}) {
    const old = this.readRaw(key);
    if (options.onlyIfNew && old) return { modified: false };
    if (options.onlyIfMatch && old?.etag !== options.onlyIfMatch) return { modified: false };
    const etag = `"${Date.now().toString(36)}-${(++this.seq).toString(36)}"`;
    const tmp = this.file(key) + ".tmp";
    writeFileSync(tmp, JSON.stringify({ data, etag }));
    renameSync(tmp, this.file(key));
    return { modified: true, etag };
  }
  async delete(key) {
    rmSync(this.file(key), { force: true });
  }
  async *list({ prefix = "" } = {}) {
    const blobs = existsSync(this.dir) ? readdirSync(this.dir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => decodeURIComponent(f.slice(0, -5)))
      .filter((k) => k.startsWith(prefix))
      .sort()
      .map((key) => ({ key })) : [];
    yield { blobs };
  }
}
