/* Small Netlify Blobs helpers shared by feedback and push. Pure: the store is passed in, so the unit tests run them
   with an in-memory store.

   rateGate (security review 2026-11-13, N1): a per-IP hourly limit kept as one marker blob per request, under
   a prefix like rl:<hour>:<ip>:. It counts first and answers "no" WITHOUT writing when the IP is already at the
   limit, so a flood from one IP leaves about max + (requests in flight at once) markers per hour, not one per
   request. Under the limit it writes its marker and counts again: a burst that raced past the first count sees
   the others and fails closed. */
import { randomBytes } from "node:crypto";

export const HOUR = 36e5, BATCH = 25;
export const hourOf = t => Math.floor(t / HOUR);

export async function listKeys(store, prefix) { const { blobs } = await store.list({ prefix }); return blobs.map(b => b.key); }

/* true = allowed (and counted) */
export async function rateGate(store, prefix, max, now = Date.now()) {
  if ((await listKeys(store, prefix)).length >= max) return false;
  await store.setJSON(prefix + randomBytes(4).toString("hex"), { t: now });
  return (await listKeys(store, prefix)).length <= max;
}

/* fn over items in parallel batches; stops before a batch once clock() >= end. Returns { n: items done, done } */
export async function inBatches(items, fn, { size = BATCH, end = Infinity, clock = Date.now } = {}) {
  let n = 0;
  for (let i = 0; i < items.length; i += size) {
    if (clock() >= end) return { n, done: false };
    const part = items.slice(i, i + size); await Promise.all(part.map(x => Promise.resolve().then(() => fn(x)).catch(() => { }))); n += part.length;
  }
  return { n, done: true };
}
