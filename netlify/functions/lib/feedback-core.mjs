/* POST /api/feedback, the logic. The stores and the IP hash are passed in, so the unit tests run it with an
   in-memory store (no Netlify). See feedback.mjs for the wiring.

   Order of work (security review 2026-11-13):
   1. Rate limit FIRST, before the body is read, parsed or decoded (L1): a throttled sender costs no parsing,
      no base64 decoding and no sniffing. */
import { randomBytes } from "node:crypto";
import { collectMedia, BODY_MAX } from "./fbmedia.mjs";

export const KINDS = ["bug", "idea", "data", "hazard", "pro", "a11y", "other"];
export const RATE_MAX = 6, INBOX_MAX = 500;
const HOUR = 36e5;
const clean = (x, n) => String(x ?? "").replace(/[\u0000-\u0008\u000B-\u001F\u007F‪-‮⁦-⁩]/g, "").trim().slice(0, n);
const json = (o, status = 200) => Response.json(o, { status });

export async function listKeys(store, prefix) { const { blobs } = await store.list({ prefix }); return blobs.map(b => b.key); }

/* deps: { fb, media, ipHash(req) -> string, now() -> ms } */
export function makeFeedback(deps) {
  return async req => {
    if (req.method !== "POST") return new Response("method", { status: 405 });
    const len = +(req.headers.get("content-length") || 0); if (len > BODY_MAX * 1.1) return new Response("too large", { status: 413 });
    const now = deps.now(), ip = await deps.ipHash(req);
    /* 1. rate limit before any parsing */
    const inbox = (await deps.fb.get("inbox", { type: "json" })) || [];
    if (inbox.filter(x => x.ip === ip && now - x.t < HOUR).length >= RATE_MAX) return json({ error: "יותר מדי דיווחים בשעה האחרונה" }, 429);
    /* 2. body */
    let b; try { const t = await req.text(); if (t.length > BODY_MAX) return new Response("too large", { status: 413 }); b = JSON.parse(t); } catch (e) { return new Response("bad json", { status: 400 }); }
    const m = collectMedia(b); if (m.error) return json({ error: m.error }, 400);
    const kind = KINDS.includes(b.kind) ? b.kind : "other", text = clean(b.text, 1000);
    if (text.length < 3) return json({ error: "קצר מדי" }, 400);
    const it = { id: randomBytes(6).toString("hex"), t: now, ip, kind, text, status: "new", chap: /^[a-z0-9_]{1,24}$/i.test(b.chap || "") ? b.chap : "", ver: clean(b.ver, 20), ua: clean(req.headers.get("user-agent"), 120) };
    if (Number.isFinite(+b.lat) && Number.isFinite(+b.lon) && +b.lat > 29 && +b.lat < 33.6 && +b.lon > 34 && +b.lon < 36.2) { it.lat = +(+b.lat).toFixed(5); it.lon = +(+b.lon).toFixed(5); }
    if (m.items.length) { it.media = []; for (const x of m.items) { await deps.media.set(it.id + "-" + x.k, x.buf, { metadata: { ct: x.ct } }); it.media.push(x.k); } }
    inbox.push(it);
    for (const old of inbox.slice(0, Math.max(0, inbox.length - INBOX_MAX))) for (const k of old.media || []) await deps.media.delete(old.id + "-" + k).catch(() => { });
    await deps.fb.setJSON("inbox", inbox.slice(-INBOX_MAX));
    return json({ ok: true, ref: it.id.slice(0, 5).toUpperCase() });
  };
}
