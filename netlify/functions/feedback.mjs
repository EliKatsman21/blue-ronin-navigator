/* POST /api/feedback — riders send bugs, ideas, data fixes or a road report. It lands in the admin
   inbox only: nothing a rider sends is shown to other riders until the admin approves it.
   Anonymous; throttled per (hashed) IP. */
import { getStore } from "@netlify/blobs";
import { randomBytes } from "node:crypto";
import { ipHash } from "./lib/admin.mjs";
const fb = () => getStore({ name: "brn-feedback", consistency: "strong" });
const KINDS = ["bug", "idea", "data", "hazard", "pro", "other"];
const clean = (x, n) => String(x ?? "").replace(/[\u0000-\u0008\u000B-\u001F\u007F‪-‮⁦-⁩]/g, "").trim().slice(0, n);
export default async req => {
  if (req.method !== "POST") return new Response("method", { status: 405 });
  let b; try { const t = await req.text(); if (t.length > 3000) return new Response("too large", { status: 413 }); b = JSON.parse(t); } catch (e) { return new Response("bad json", { status: 400 }); }
  const kind = KINDS.includes(b.kind) ? b.kind : "other", text = clean(b.text, 1000);
  if (text.length < 3) return Response.json({ error: "קצר מדי" }, { status: 400 });
  const ip = await ipHash(req), now = Date.now(), s = fb();
  const inbox = (await s.get("inbox", { type: "json" })) || [];
  if (inbox.filter(x => x.ip === ip && now - x.t < 36e5).length >= 6) return Response.json({ error: "יותר מדי דיווחים בשעה האחרונה" }, { status: 429 });
  const it = { id: randomBytes(6).toString("hex"), t: now, ip, kind, text, status: "new", chap: /^[a-z0-9_]{1,24}$/i.test(b.chap || "") ? b.chap : "", ver: clean(b.ver, 20), ua: clean(req.headers.get("user-agent"), 120) };
  if (Number.isFinite(+b.lat) && Number.isFinite(+b.lon) && +b.lat > 29 && +b.lat < 33.6 && +b.lon > 34 && +b.lon < 36.2) { it.lat = +(+b.lat).toFixed(5); it.lon = +(+b.lon).toFixed(5); }
  inbox.push(it); await s.setJSON("inbox", inbox.slice(-500));
  return Response.json({ ok: true });
};
export const config = { path: "/api/feedback" };
