/* Web Push, the logic without web-push or Netlify (security review 2026-11-13, N2). The stores, the sender and the
   IP hash are passed in, so the unit tests run it with an in-memory store. lib/push.mjs and subscribe.mjs wire it.

   - validSub: the endpoint must be https on a known browser push service. web-push itself sends to any URL, so
     without this a script could make the server POST to hosts it chose. Hosts (checked 2026-11-13 against the
     browsers' push services): Chrome, Android, Samsung, Opera, Brave and Edge on Android use Firebase Cloud
     Messaging (fcm.googleapis.com); Firefox uses Mozilla autopush (updates.push.services.mozilla.com); Safari on
     macOS and iOS uses web.push.apple.com, and Apple names *.push.apple.com for web push, so any one-label
     subdomain of push.apple.com is accepted (M1, security review 2026-11-13 final; Apple-owned zone); Edge on
     Windows uses WNS (<node>.notify.windows.com). No userinfo, no port, bounded lengths.
   - sendAllWith: every send has a timeout (PUSH_TIMEOUT_MS) and at most SEND_CONCURRENCY run at once, so a slow
     endpoint cannot hold the weekend brief until it times out before it reaches real riders.
   - makeSubscribe: a NEW endpoint passes a per-IP hourly throttle (rateGate markers rl:<hour>:sub.<ip>:<rand> in
     the feedback store, pruned by the monitor's feedback sweep) and a cap on stored subscriptions (PUSH_SUBS_CAP,
     default 20000; the monitor alerts at 90%). Updating an existing endpoint (prefs, chapter) is never throttled.
   - refusedHost / noteRefusedHost (M1): an endpoint on a push service we do not know gets its own Hebrew message
     (PUSH_HOST_MSG, not "no notification permission"), and its HOSTNAME only (never the path: it is a capability URL)
     goes to the ops log, at most PUSH_HOST_LOG_MAX lines an hour across all IPs, so a new browser push host is noticed. */
import { createHash } from "node:crypto";
import { cleanChap } from "./brief-chapter.mjs";
import { hourOf, listKeys, rateGate } from "./blob-util.mjs";

export const PUSH_TIMEOUT_MS = 5000, SEND_CONCURRENCY = 20, SUB_RATE_MAX = 20, SUBS_CAP = 20000;
export const PUSH_HOSTS = ["fcm.googleapis.com", "updates.push.services.mozilla.com", "web.push.apple.com"];
const WNS = /^[a-z0-9-]+\.notify\.windows\.com$/, APPLE = /^[a-z0-9-]+\.push\.apple\.com$/;
export const PUSH_HOST_LOG_MAX = 5;
export const PUSH_HOST_MSG = "שירות ההתראות של הדפדפן הזה לא נתמך אצלנו. נסו Chrome או Safari";

export function pushHostOk(endpoint) {
  if (typeof endpoint !== "string" || endpoint.length > 2048) return false;
  let u; try { u = new URL(endpoint); } catch (e) { return false; }
  if (u.protocol !== "https:" || u.username || u.password || u.port) return false;
  const h = u.hostname.toLowerCase();
  return PUSH_HOSTS.includes(h) || WNS.test(h) || APPLE.test(h);
}
/* the hostname of a subscription refused for its push service ("" when the host is fine or there is no URL) */
export function refusedHost(sub) {
  const ep = sub && typeof sub === "object" ? sub.endpoint : null;
  if (typeof ep !== "string" || pushHostOk(ep)) return "";
  try { return new URL(ep).hostname.toLowerCase().slice(0, 100); } catch (e) { return ""; }
}
/* deps: { rl: store for the markers, now() -> ms, log(service, level, msg) }. Never throws. */
export async function noteRefusedHost(deps, host) {
  try {
    if (!deps || !deps.log || !host) return false;
    if (!(await rateGate(deps.rl, `rl:${hourOf(deps.now())}:pushhost:`, PUSH_HOST_LOG_MAX, deps.now()))) return false;
    await deps.log("push", "warn", `push host refused: ${host}`); return true;
  } catch (e) { return false; }
}
export const validSub = s => !!s && typeof s === "object" && pushHostOk(s.endpoint) && !!s.keys && typeof s.keys === "object"
  && typeof s.keys.p256dh === "string" && s.keys.p256dh.length <= 200 && typeof s.keys.auth === "string" && s.keys.auth.length <= 100;

export const keyOf = endpoint => createHash("sha256").update(endpoint).digest("hex").slice(0, 40);
export const subsCap = env => { const n = Math.floor(+(env || "")); return Number.isFinite(n) && n > 0 ? n : SUBS_CAP; };

/* fn over items, at most n at a time, results in order */
export async function mapLimit(items, n, fn) {
  const out = new Array(items.length); let i = 0;
  const run = async () => { while (i < items.length) { const j = i++; out[j] = await fn(items[j], j); } };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(n, items.length)) }, run));
  return out;
}

/* chap: the rider's chosen built-in chapter id (validated against data.js), or "" = the best chapter. Nothing
   else about the rider is kept. chap undefined keeps what was stored (an older app that does not send it); old = the stored record, if read */
export async function saveSubIn(store, sub, prefs, chap, old) {
  const clean = { friday: prefs?.friday !== false, saturday: prefs?.saturday !== false };
  const key = keyOf(sub.endpoint);
  if (chap === undefined && old === undefined) old = await store.get(key, { type: "json" }).catch(() => null);
  const c = chap === undefined ? cleanChap(old && old.chap) : cleanChap(chap);
  await store.setJSON(key, { sub: { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } }, prefs: clean, chap: c, ts: Date.now() });
  return clean;
}

/* H1 (security review 2026-11-13 final): a send has three outcomes. Only a 404/410 from the push service means the
   subscription is GONE and may be deleted. A timeout (web-push rejects with no statusCode), a 5xx, a 429, a DNS/TLS
   or network error is a FAIL: the subscription is kept, whoever stored it (rider, SOS guardian, admin device). */
export const SEND_OK = "ok", SEND_GONE = "gone", SEND_FAIL = "fail";
export const isGone = e => !!e && (e.statusCode === 404 || e.statusCode === 410);
/* send(sub, payload) resolves, or throws an error with statusCode -> "ok" | "gone" | "fail" (never throws) */
export async function trySend(send, sub, payload) {
  try { await send(sub, payload); return SEND_OK; } catch (e) { return isGone(e) ? SEND_GONE : SEND_FAIL; }
}

export async function sendAllWith({ store, send, payload, pref, concurrency = SEND_CONCURRENCY }) {
  const keys = await listKeys(store, ""); let sent = 0, gone = 0, skipped = 0, failed = 0;
  await mapLimit(keys, concurrency, async k => {
    const rec = await store.get(k, { type: "json" }).catch(() => null);
    if (!rec || !rec.sub || (pref && rec.prefs && rec.prefs[pref] === false)) { skipped++; return; }
    const p = typeof payload === "function" ? payload(rec) : payload;
    const r = await trySend(send, rec.sub, p);
    if (r === SEND_OK) sent++; else if (r === SEND_GONE) { await store.delete(k).catch(() => { }); gone++; } else failed++;
  });
  return { sent, gone, skipped, failed, total: keys.length };
}

const json = (o, status = 200) => Response.json(o, { status });
/* deps: { subs: store, rl: store for the throttle markers, ipHash(req), now() -> ms, cap: PUSH_SUBS_CAP or undefined,
   log: opsLog (optional, the refused-host line) } */
export function makeSubscribe(deps) {
  return async req => {
    let body = {}; try { const t = await req.text(); if (t.length > 4000) return new Response("too large", { status: 413 }); body = JSON.parse(t || "{}"); } catch (e) { return new Response("bad json", { status: 400 }); }
    if (!body || typeof body !== "object" || Array.isArray(body)) return new Response("bad body", { status: 400 });
    const subs = deps.subs;
    if (req.method === "DELETE") { if (typeof body.endpoint !== "string") return new Response("missing endpoint", { status: 400 }); await subs.delete(keyOf(body.endpoint)); return json({ ok: true }); }
    if (req.method !== "POST") return new Response("method", { status: 405 });
    if (body.check && typeof body.endpoint === "string") { const r = await subs.get(keyOf(body.endpoint), { type: "json" }); return json({ ok: !!r, prefs: r ? r.prefs : null }); }
    if (body.setChap && typeof body.endpoint === "string") {
      /* only the chapter of an existing subscription changes; an unknown endpoint is a 404 and nothing is written */
      const key = keyOf(body.endpoint), rec = await subs.get(key, { type: "json" }); if (!rec) return new Response("not found", { status: 404 });
      rec.chap = cleanChap(body.chap); rec.ts = Date.now(); await subs.setJSON(key, rec); return json({ ok: true, chap: rec.chap });
    }
    const host = refusedHost(body.sub);
    if (host) { await noteRefusedHost(deps, host); return json({ error: PUSH_HOST_MSG, code: "push_host" }, 400); }
    if (!validSub(body.sub)) return new Response("bad subscription", { status: 400 });
    const old = await subs.get(keyOf(body.sub.endpoint), { type: "json" }).catch(() => null);
    if (!old) {
      const ip = await deps.ipHash(req);
      if (!(await rateGate(deps.rl, `rl:${hourOf(deps.now())}:sub.${ip}:`, SUB_RATE_MAX, deps.now()))) return json({ error: "יותר מדי הרשמות מהרשת הזאת. נסו שוב בעוד שעה" }, 429);
      if ((await listKeys(subs, "")).length >= subsCap(deps.cap)) return json({ error: "ההרשמה להתראות סגורה כרגע. נסו שוב מאוחר יותר" }, 503);
    }
    return json({ ok: true, prefs: await saveSubIn(subs, body.sub, body.prefs, body.chap, old) });
  };
}
