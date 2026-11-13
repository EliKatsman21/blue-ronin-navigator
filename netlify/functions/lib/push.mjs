/* Web Push plumbing: VAPID keys and subscriptions live in Netlify Blobs (created on first use, no setup). */
import { getStore } from "@netlify/blobs";
import webpush from "web-push";
import { createHash } from "node:crypto";
import { cleanChap } from "./brief-chapter.mjs";

const meta = () => getStore({ name: "brn", consistency: "strong" });
const subs = () => getStore({ name: "brn-subs", consistency: "strong" });
export const keyOf = endpoint => createHash("sha256").update(endpoint).digest("hex").slice(0, 40);

export { configure };
export async function vapid() {
  const s = meta(); let v = await s.get("vapid", { type: "json" });
  if (!v) { v = webpush.generateVAPIDKeys(); await s.setJSON("vapid", v); }
  return v;
}
async function configure() {
  const v = await vapid();
  webpush.setVapidDetails(process.env.URL || "https://blue-ronin.netlify.app", v.publicKey, v.privateKey);
}
export const validSub = s => s && typeof s.endpoint === "string" && /^https:\/\//.test(s.endpoint) && s.keys && typeof s.keys.p256dh === "string" && typeof s.keys.auth === "string";
/* chap: the rider's chosen built-in chapter id (validated against data.js), or "" = the best chapter.
   undefined keeps what was stored (an older app that does not send it). Nothing else about the rider is kept. */
export async function saveSub(sub, prefs, chap) {
  const clean = { friday: prefs?.friday !== false, saturday: prefs?.saturday !== false };
  const key = keyOf(sub.endpoint), old = chap === undefined ? await subs().get(key, { type: "json" }).catch(() => null) : null;
  const c = chap === undefined ? cleanChap(old && old.chap) : cleanChap(chap);
  await subs().setJSON(key, { sub: { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } }, prefs: clean, chap: c, ts: Date.now() });
  return clean;
}
/* Only the chapter of an existing subscription changes (the rider picked another built-in chapter). */
export async function setSubChap(endpoint, chap) {
  const key = keyOf(endpoint), rec = await subs().get(key, { type: "json" });
  if (!rec) return null;
  rec.chap = cleanChap(chap); rec.ts = Date.now(); await subs().setJSON(key, rec);
  return rec.chap;
}
export const removeSub = endpoint => subs().delete(keyOf(endpoint));
export const getSub = endpoint => subs().get(keyOf(endpoint), { type: "json" });

const payloadOf = p => JSON.stringify({ title: p.title, body: p.body, tag: p.tag || "brief", url: p.url || "./", sos: !!p.sos });

export async function sendOne(rec, payload, opts = {}) {
  await configure();
  try { await webpush.sendNotification(rec.sub, payloadOf(payload), { TTL: opts.ttl || 12 * 3600, urgency: opts.urgency || "normal" }); return true; }
  catch (e) { if (e.statusCode === 404 || e.statusCode === 410) await removeSub(rec.sub.endpoint); return false; }
}
/* payload: one payload for all, or a function rec => payload (the weekend brief: the rider's chapter). */
export async function sendAll(payload, pref) {
  await configure();
  const s = subs(); const { blobs } = await s.list(); let sent = 0, gone = 0, skipped = 0;
  for (const b of blobs) {
    const rec = await s.get(b.key, { type: "json" });
    if (!rec || (pref && rec.prefs && rec.prefs[pref] === false)) { skipped++; continue; }
    const p = typeof payload === "function" ? payload(rec) : payload;
    try { await webpush.sendNotification(rec.sub, payloadOf(p), { TTL: 12 * 3600, urgency: "normal" }); sent++; }
    catch (e) { if (e.statusCode === 404 || e.statusCode === 410) { await s.delete(b.key); gone++; } }
  }
  return { sent, gone, skipped, total: blobs.length };
}
