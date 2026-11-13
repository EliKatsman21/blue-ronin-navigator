/* Web Push plumbing: VAPID keys and subscriptions live in Netlify Blobs (created on first use, no setup).
   The logic (endpoint allow-list, throttle, cap, bounded sending) is in lib/push-core.mjs, unit-tested. */
import { getStore } from "@netlify/blobs";
import webpush from "web-push";
import { validSub, keyOf, sendAllWith, PUSH_TIMEOUT_MS } from "./push-core.mjs";

const meta = () => getStore({ name: "brn", consistency: "strong" });
const subs = () => getStore({ name: "brn-subs", consistency: "strong" });
export { validSub, keyOf };

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
/* saving, the chapter and the throttle of /api/subscribe: push-core.mjs makeSubscribe */
export const removeSub = endpoint => subs().delete(keyOf(endpoint));
export const getSub = endpoint => subs().get(keyOf(endpoint), { type: "json" });

const payloadOf = p => JSON.stringify({ title: p.title, body: p.body, tag: p.tag || "brief", url: p.url || "./", sos: !!p.sos });
/* N2: every send has a timeout, so a slow push endpoint cannot hold a function until it times out */
const push = (sub, p, opts = {}) => webpush.sendNotification(sub, payloadOf(p), { TTL: opts.ttl || 12 * 3600, urgency: opts.urgency || "normal", timeout: PUSH_TIMEOUT_MS });

export async function sendOne(rec, payload, opts = {}) {
  await configure();
  try { await push(rec.sub, payload, opts); return true; }
  catch (e) { if (e.statusCode === 404 || e.statusCode === 410) await removeSub(rec.sub.endpoint); return false; }
}
/* payload: one payload for all, or a function rec => payload (the weekend brief: the rider's chapter).
   Sent with bounded concurrency (push-core SEND_CONCURRENCY). */
export async function sendAll(payload, pref) {
  await configure();
  return sendAllWith({ store: subs(), send: (sub, p) => push(sub, p), payload, pref });
}
