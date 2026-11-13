/* POST /api/feedback — riders send bugs, ideas, data fixes or a road report. It lands in the admin
   inbox only: nothing a rider sends is shown to other riders until the admin approves it.
   Anonymous; throttled per (hashed) IP. */
import { edgeGate } from "./lib/edge.mjs";
import { getStore } from "@netlify/blobs";
import { randomBytes } from "node:crypto";
import { ipHash } from "./lib/admin.mjs";
import { collectMedia, BODY_MAX } from "./lib/fbmedia.mjs";
const fb = () => getStore({ name: "brn-feedback", consistency: "strong" });
const media = () => getStore({ name: "brn-fb-media", consistency: "strong" });
/* Photos (up to 4) and a voice note can ride along: see lib/fbmedia.mjs for the limits and the checks. */
const KINDS = ["bug", "idea", "data", "hazard", "pro", "other"];
const clean = (x, n) => String(x ?? "").replace(/[\u0000-\u0008\u000B-\u001F\u007F‪-‮⁦-⁩]/g, "").trim().slice(0, n);
export default async req => {
  const gate = edgeGate(req); if (gate) return gate;
  if (req.method !== "POST") return new Response("method", { status: 405 });
  let b; try { const t = await req.text(); if (t.length > BODY_MAX) return new Response("too large", { status: 413 }); b = JSON.parse(t); } catch (e) { return new Response("bad json", { status: 400 }); }
  const m = collectMedia(b); if (m.error) return Response.json({ error: m.error }, { status: 400 });
  const kind = KINDS.includes(b.kind) ? b.kind : "other", text = clean(b.text, 1000);
  if (text.length < 3) return Response.json({ error: "קצר מדי" }, { status: 400 });
  const ip = await ipHash(req), now = Date.now(), s = fb();
  const inbox = (await s.get("inbox", { type: "json" })) || [];
  if (inbox.filter(x => x.ip === ip && now - x.t < 36e5).length >= 6) return Response.json({ error: "יותר מדי דיווחים בשעה האחרונה" }, { status: 429 });
  const it = { id: randomBytes(6).toString("hex"), t: now, ip, kind, text, status: "new", chap: /^[a-z0-9_]{1,24}$/i.test(b.chap || "") ? b.chap : "", ver: clean(b.ver, 20), ua: clean(req.headers.get("user-agent"), 120) };
  if (Number.isFinite(+b.lat) && Number.isFinite(+b.lon) && +b.lat > 29 && +b.lat < 33.6 && +b.lon > 34 && +b.lon < 36.2) { it.lat = +(+b.lat).toFixed(5); it.lon = +(+b.lon).toFixed(5); }
  if (m.items.length) { it.media = []; for (const x of m.items) { await media().set(it.id + "-" + x.k, x.buf, { metadata: { ct: x.ct } }); it.media.push(x.k); } }
  inbox.push(it);
  for (const old of inbox.slice(0, Math.max(0, inbox.length - 500))) for (const k of old.media || []) await media().delete(old.id + "-" + k).catch(() => { });
  await s.setJSON("inbox", inbox.slice(-500));
  return Response.json({ ok: true, ref: it.id.slice(0, 5).toUpperCase() });
};
export const config = { path: "/api/feedback" };
