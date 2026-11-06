/* POST /api/feedback — riders send bugs, ideas, data fixes or a road report. It lands in the admin
   inbox only: nothing a rider sends is shown to other riders until the admin approves it.
   Anonymous; throttled per (hashed) IP. */
import { getStore } from "@netlify/blobs";
import { randomBytes } from "node:crypto";
import { ipHash } from "./lib/admin.mjs";
const fb = () => getStore({ name: "brn-feedback", consistency: "strong" });
const media = () => getStore({ name: "brn-fb-media", consistency: "strong" });
/* A photo (jpeg/webp, made small on the phone) and/or a voice note (up to ~1 minute) can ride along.
   Checked by magic bytes, not by what the client claims. */
const IMG_MAX = 600 * 1024, AUD_MAX = 700 * 1024;
const sniff = buf => { if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg"; if (buf.slice(0, 4).toString() === "RIFF" && buf.slice(8, 12).toString() === "WEBP") return "image/webp";
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return "audio/webm"; if (buf.slice(4, 8).toString() === "ftyp") return "audio/mp4"; if (buf.slice(0, 4).toString() === "OggS") return "audio/ogg"; return null; };
const decode = (s, max) => { if (typeof s !== "string" || !s) return null; const b = Buffer.from(s.replace(/^data:[^,]*,/, ""), "base64"); return b.length && b.length <= max ? b : null; };
const KINDS = ["bug", "idea", "data", "hazard", "pro", "other"];
const clean = (x, n) => String(x ?? "").replace(/[\u0000-\u0008\u000B-\u001F\u007F‪-‮⁦-⁩]/g, "").trim().slice(0, n);
export default async req => {
  if (req.method !== "POST") return new Response("method", { status: 405 });
  let b; try { const t = await req.text(); if (t.length > 1900000) return new Response("too large", { status: 413 }); b = JSON.parse(t); } catch (e) { return new Response("bad json", { status: 400 }); }
  const kind = KINDS.includes(b.kind) ? b.kind : "other", text = clean(b.text, 1000);
  if (text.length < 3) return Response.json({ error: "קצר מדי" }, { status: 400 });
  const ip = await ipHash(req), now = Date.now(), s = fb();
  const inbox = (await s.get("inbox", { type: "json" })) || [];
  if (inbox.filter(x => x.ip === ip && now - x.t < 36e5).length >= 6) return Response.json({ error: "יותר מדי דיווחים בשעה האחרונה" }, { status: 429 });
  const it = { id: randomBytes(6).toString("hex"), t: now, ip, kind, text, status: "new", chap: /^[a-z0-9_]{1,24}$/i.test(b.chap || "") ? b.chap : "", ver: clean(b.ver, 20), ua: clean(req.headers.get("user-agent"), 120) };
  if (Number.isFinite(+b.lat) && Number.isFinite(+b.lon) && +b.lat > 29 && +b.lat < 33.6 && +b.lon > 34 && +b.lon < 36.2) { it.lat = +(+b.lat).toFixed(5); it.lon = +(+b.lon).toFixed(5); }
  const img = decode(b.photo, IMG_MAX), aud = decode(b.voice, AUD_MAX); it.media = [];
  if (img) { const ct = sniff(img); if (!ct || !ct.startsWith("image/")) return Response.json({ error: "התמונה לא נתמכת" }, { status: 400 }); await media().set(it.id + "-p", img, { metadata: { ct } }); it.media.push("p"); }
  if (aud) { const ct = sniff(aud); if (!ct || !ct.startsWith("audio/")) return Response.json({ error: "ההקלטה לא נתמכת" }, { status: 400 }); await media().set(it.id + "-a", aud, { metadata: { ct } }); it.media.push("a"); }
  if (!it.media.length) delete it.media;
  inbox.push(it);
  for (const old of inbox.slice(0, Math.max(0, inbox.length - 500))) for (const k of old.media || []) await media().delete(old.id + "-" + k).catch(() => { });
  await s.setJSON("inbox", inbox.slice(-500));
  return Response.json({ ok: true, ref: it.id.slice(0, 5).toUpperCase() });
};
export const config = { path: "/api/feedback" };
