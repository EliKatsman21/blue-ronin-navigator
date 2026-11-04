/* Web Push plumbing: VAPID keys and subscriptions live in Netlify Blobs (created on first use, no setup). */
import { getStore } from "@netlify/blobs";
import webpush from "web-push";
import { createHash } from "node:crypto";

const meta = () => getStore({ name: "brn", consistency: "strong" });
const subs = () => getStore({ name: "brn-subs", consistency: "strong" });
export const keyOf = endpoint => createHash("sha256").update(endpoint).digest("hex").slice(0, 40);

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
export async function saveSub(sub, prefs) {
  const clean = { friday: prefs?.friday !== false, saturday: prefs?.saturday !== false };
  await subs().setJSON(keyOf(sub.endpoint), { sub: { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } }, prefs: clean, ts: Date.now() });
  return clean;
}
export const removeSub = endpoint => subs().delete(keyOf(endpoint));
export const getSub = endpoint => subs().get(keyOf(endpoint), { type: "json" });

const payloadOf = p => JSON.stringify({ title: p.title, body: p.body, tag: p.tag || "brief", url: p.url || "./" });

export async function sendOne(rec, payload) {
  await configure();
  try { await webpush.sendNotification(rec.sub, payloadOf(payload), { TTL: 12 * 3600, urgency: "normal" }); return true; }
  catch (e) { if (e.statusCode === 404 || e.statusCode === 410) await removeSub(rec.sub.endpoint); return false; }
}
export async function sendAll(payload, pref) {
  await configure();
  const s = subs(); const { blobs } = await s.list(); let sent = 0, gone = 0, skipped = 0;
  for (const b of blobs) {
    const rec = await s.get(b.key, { type: "json" });
    if (!rec || (pref && rec.prefs && rec.prefs[pref] === false)) { skipped++; continue; }
    try { await webpush.sendNotification(rec.sub, payloadOf(payload), { TTL: 12 * 3600, urgency: "normal" }); sent++; }
    catch (e) { if (e.statusCode === 404 || e.statusCode === 410) { await s.delete(b.key); gone++; } }
  }
  return { sent, gone, skipped, total: blobs.length };
}
