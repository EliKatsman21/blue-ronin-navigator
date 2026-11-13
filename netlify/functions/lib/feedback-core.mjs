/* POST /api/feedback, the logic. The stores and the IP hash are passed in, so the unit tests run it with an
   in-memory store (no Netlify). See feedback.mjs for the wiring.

   Order of work (security review 2026-11-13):
   1. Rate limit FIRST, before the body is read, parsed or decoded (L1), with rateGate (lib/blob-util.mjs):
      markers rl:<hour>:<ipHash>:<rand>, one per counted request, so the counter is not in the inbox blob and
      parallel requests cannot all read "0 so far" (M1). An IP already at the limit gets its 429 without a new
      marker (N1), so a flood does not grow the store. Under a burst it fails closed.
   2. The body must be a JSON object (L2), then the media is checked (lib/fbmedia.mjs).
   3. A global daily media budget (M2): each report with media leaves a marker mb:<day>:<bytes>:<id> in the
      media store; their sum is today's use. Above FB_MEDIA_DAILY_MB (default 50) a report is still accepted, as
      text, without its photos and voice note, and the rider is told why. The monitor alerts at 80%.
   4. No read-modify-write of the inbox on the rider's path (M1). @netlify/blobs 8.x has no conditional
      (etag) writes (checked in the 8.2.0 package), so instead every report is its own blob q:<t>-<id>
      (a new key, nothing to race with). The admin console folds the queue into the one inbox blob
      (inboxNow) when it reads it; only the admin writes the inbox. Media is written after its report blob,
      with metadata { ct, t }, and the monitor deletes media whose report is gone (sweepFeedback). */
import { randomBytes } from "node:crypto";
import { collectMedia, BODY_MAX } from "./fbmedia.mjs";
import { HOUR, hourOf, listKeys, rateGate, inBatches } from "./blob-util.mjs";
export { hourOf, listKeys };

export const KINDS = ["bug", "idea", "data", "hazard", "pro", "a11y", "other"];
export const RATE_MAX = 6, INBOX_MAX = 500, MEDIA_DAILY_MB = 50;
export const SWEEP_MS = 8000; /* the monitor's sweep stops after this and continues on the next scan */
const clean = (x, n) => String(x ?? "").replace(/[\u0000-\u0008\u000B-\u001F\u007F‪-‮⁦-⁩]/g, "").trim().slice(0, n);
const json = (o, status = 200) => Response.json(o, { status });
export const dayOf = t => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date(t));
export const budgetBytes = env => { const mb = +(env || ""); return (Number.isFinite(mb) && mb > 0 ? mb : MEDIA_DAILY_MB) * 1024 * 1024; };
/* bytes used today, from the keys mb:<day>:<bytes>:<id> */
export const usedBytes = keys => keys.reduce((a, k) => a + (+k.split(":")[2] || 0), 0);
/* L2: only a JSON object is a report (null, a number, a string or an array is a 400, not a crash) */
export const validBody = b => !!b && typeof b === "object" && !Array.isArray(b);
/* media keys <id>-<k> whose report is in neither the inbox nor the queue (the sweep then checks their age) */
export const orphanKeys = (keys, liveIds) => keys.filter(k => { const id = k.split("-")[0]; return /^[a-f0-9]{12}$/.test(id) && !liveIds.has(id); });

/* a report waiting for the admin: its own blob, never a read-modify-write (also used by /api/pro "interest") */
export const queueReport = (fb, it) => fb.setJSON(`q:${String(it.t).padStart(14, "0")}-${it.id}`, it);

/* The admin's view of the inbox: the inbox blob plus the queued reports, oldest first, the last INBOX_MAX kept.
   When there was a queue it is folded in: the inbox is written, read back, and only the queued blobs that made
   it into the inbox are deleted, with the media of reports that fell off the end. */
export async function inboxNow(fb, media) {
  const inbox = (await fb.get("inbox", { type: "json" })) || [];
  const qk = (await listKeys(fb, "q:")).sort(); if (!qk.length) return inbox;
  const have = new Set(inbox.map(x => x.id));
  for (const k of qk) { const it = await fb.get(k, { type: "json" }).catch(() => null); if (it && it.id && !have.has(it.id)) { inbox.push(it); have.add(it.id); } }
  inbox.sort((a, b) => a.t - b.t);
  const keep = inbox.slice(-INBOX_MAX), dropped = inbox.slice(0, inbox.length - keep.length);
  await fb.setJSON("inbox", keep);
  const back = new Set(((await fb.get("inbox", { type: "json" })) || []).map(x => x.id)), gone = new Set(dropped.map(x => x.id));
  for (const k of qk) { const id = k.split("-").pop(); if (back.has(id) || gone.has(id)) await fb.delete(k).catch(() => { }); }
  for (const x of dropped) for (const k of x.media || []) await media.delete(x.id + "-" + k).catch(() => { });
  return keep;
}

/* deps: { fb, media, ipHash(req) -> string, now() -> ms, budgetMb: FB_MEDIA_DAILY_MB or undefined } */
export function makeFeedback(deps) {
  return async req => {
    if (req.method !== "POST") return new Response("method", { status: 405 });
    const len = +(req.headers.get("content-length") || 0); if (len > BODY_MAX * 1.1) return new Response("too large", { status: 413 });
    const now = deps.now(), ip = await deps.ipHash(req), hr = hourOf(now);
    /* 1. rate limit before any parsing */
    if (!(await rateGate(deps.fb, `rl:${hr}:${ip}:`, RATE_MAX, now))) return json({ error: "יותר מדי דיווחים בשעה האחרונה" }, 429);
    /* 2. body */
    let b; try { const t = await req.text(); if (t.length > BODY_MAX) return new Response("too large", { status: 413 }); b = JSON.parse(t); } catch (e) { return new Response("bad json", { status: 400 }); }
    if (!validBody(b)) return new Response("bad body", { status: 400 });
    const kind = KINDS.includes(b.kind) ? b.kind : "other", text = clean(b.text, 1000);
    if (text.length < 3) return json({ error: "קצר מדי" }, 400);
    const m = collectMedia(b); if (m.error) return json({ error: m.error }, 400);
    const it = { id: randomBytes(6).toString("hex"), t: now, ip, kind, text, status: "new", chap: /^[a-z0-9_]{1,24}$/i.test(b.chap || "") ? b.chap : "", ver: clean(b.ver, 20), ua: clean(req.headers.get("user-agent"), 120) };
    if (Number.isFinite(+b.lat) && Number.isFinite(+b.lon) && +b.lat > 29 && +b.lat < 33.6 && +b.lon > 34 && +b.lon < 36.2) { it.lat = +(+b.lat).toFixed(5); it.lon = +(+b.lon).toFixed(5); }
    /* 3. the daily media budget */
    let note = "";
    if (m.items.length) {
      const bytes = m.items.reduce((a, x) => a + x.buf.length, 0), day = dayOf(now);
      if (usedBytes(await listKeys(deps.media, `mb:${day}:`)) + bytes > budgetBytes(deps.budgetMb)) { m.items = []; it.mediaDropped = true; note = "הדיווח התקבל בלי התמונות וההקלטה, כי הגענו למכסה היומית שלנו. אפשר לשלוח אותן שוב מחר."; }
      else { await deps.media.setJSON(`mb:${day}:${bytes}:${it.id}`, { t: now }); it.media = m.items.map(x => x.k); }
    }
    /* 4. the report first (its own blob), then its media */
    await queueReport(deps.fb, it);
    for (const x of m.items) await deps.media.set(it.id + "-" + x.k, x.buf, { metadata: { ct: x.ct, t: now } });
    return json(note ? { ok: true, ref: it.id.slice(0, 5).toUpperCase(), note } : { ok: true, ref: it.id.slice(0, 5).toUpperCase() });
  };
}

/* Today's media use against the daily budget (the monitor's 80% alert). One list of today's budget markers. */
export async function mediaUse({ media, now, budgetMb }) {
  const used = usedBytes(await listKeys(media, `mb:${dayOf(now)}:`)), cap = budgetBytes(budgetMb);
  return { used, cap, pct: used / cap };
}

/* The monitor's sweep (lib/health.mjs, after the scan record is saved): rate markers older than an hour (the
   ones a flood leaves, so first), budget markers older than yesterday, and media whose report is in neither the
   inbox nor the queue and is older than an hour (or has no time) are deleted, in parallel batches of 25. N1: it
   stops after budgetMs and reports more: true; the next scan continues. Returns today's media use too. */
export async function sweepFeedback({ fb, media, now, budgetMb, budgetMs = SWEEP_MS, clock = Date.now }) {
  const end = clock() + budgetMs, opt = { end, clock };
  let orphans = 0, markers = 0, more = false;
  const hr = hourOf(now), day = dayOf(now), yday = dayOf(now - 24 * HOUR);
  const rl = await inBatches((await listKeys(fb, "rl:")).filter(k => +k.split(":")[1] < hr - 1), k => fb.delete(k), opt);
  markers += rl.n; more = !rl.done;
  if (!more) {
    const mb = await inBatches((await listKeys(media, "mb:")).filter(k => { const d = k.split(":")[1]; return d !== day && d !== yday; }), k => media.delete(k), opt);
    markers += mb.n; more = !mb.done;
  }
  if (!more && clock() < end) {
    const inbox = (await fb.get("inbox", { type: "json" })) || [];
    const ids = new Set([...inbox.map(x => x.id), ...(await listKeys(fb, "q:")).map(k => k.split("-").pop())]);
    const r = await inBatches(orphanKeys(await listKeys(media, ""), ids), async k => {
      const md = await media.getMetadata(k).catch(() => null), t = md && md.metadata && +md.metadata.t;
      if (!t || now - t > HOUR) { await media.delete(k); orphans++; }
    }, opt);
    more = !r.done;
  } else more = true;
  return { orphans, markers, more, ...(await mediaUse({ media, now, budgetMb })) };
}
