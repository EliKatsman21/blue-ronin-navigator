/* Field error reports from riders' phones (no personal data: message, stack, app version, device type,
   which screen, a few breadcrumbs). About the last 300 kept, one record per report. Admin reads them in System → "תקלות מהשטח". */
import { getStore } from "@netlify/blobs";
import { ipHash } from "./lib/admin.mjs";
const store = () => getStore({ name: "brn-err", consistency: "strong" });
const s = (x, n) => String(x ?? "").replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, "").slice(0, n);
export default async req => {
  if (req.method !== "POST") return new Response("method", { status: 405 });
  const t = await req.text(); if (t.length > 8000) return new Response("too large", { status: 413 });
  let b; try { b = JSON.parse(t); } catch (e) { return new Response("bad", { status: 400 }); }
  const st = store(), now = Date.now(), ip = await ipHash(req);
  const rl = ((await st.get("rl:" + ip, { type: "json" })) || []).filter(x => now - x < 36e5); if (rl.length >= 30) return Response.json({ ok: true, dropped: true }); rl.push(now); await st.setJSON("rl:" + ip, rl);
  const it = { t: now, ip: ip.slice(0, 6), ver: s(b.ver, 12), kind: s(b.kind, 16), msg: s(b.msg, 300), src: s(b.src, 160).replace(/^https?:\/\/[^/]+/, ""), line: +b.line || 0, stack: s(b.stack, 1500).replace(/https?:\/\/[^/\s)]+/g, ""), ua: s(b.ua, 200), sa: !!b.sa, path: s(b.path, 60), tab: s(b.tab, 12), crumbs: (Array.isArray(b.crumbs) ? b.crumbs : []).slice(-12).map(c => s(c, 60)), boot: +b.boot || 0 };
  /* one key per report: concurrent reports can't overwrite each other */
  await st.setJSON(`e:${String(now).padStart(14, "0")}:${Math.random().toString(36).slice(2, 8)}`, it);
  if (Math.random() < 0.1) { const { blobs } = await st.list({ prefix: "e:" }); const old = blobs.map(b => b.key).sort().slice(0, Math.max(0, blobs.length - 300)); for (const k of old) await st.delete(k); }
  return Response.json({ ok: true });
};
export const config = { path: "/api/errlog" };
