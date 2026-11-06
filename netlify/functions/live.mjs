/* Live location sharing. A rider opens a share; whoever has the link sees the last positions until it ends.
   - The link id is random (128 bit); writing needs a separate secret key held only by the rider's phone.
   - Positions are kept only while the share lives: 12 hours at most, then deleted on the next read.
   - Nothing here is ever listed or shown anywhere else.
   POST /api/live/start   {name, chap}            -> {id, key, exp}
   POST /api/live/update  {id, key, pts, state}   -> {ok}
   POST /api/live/stop    {id, key}               -> {ok}
   GET  /api/live/<id>                            -> share as viewers see it */
import { liveStore, rid, hashKey, keyOk, clean, okId, inIL, body, J } from "./lib/safety.mjs";
import { ipHash } from "./lib/admin.mjs";
const MAX_H = 12, KEEP_PTS = 400, STATES = ["riding", "stopped", "sos", "ended"];
export default async req => {
  const u = new URL(req.url), seg = u.pathname.replace(/^\/api\/live\/?/, "").split("/").filter(Boolean), s = liveStore(), now = Date.now();
  if (req.method === "GET") {
    const id = seg[0]; if (!okId(id)) return J({ error: "not found" }, 404);
    const L = await s.get("l:" + id, { type: "json" });
    if (!L || L.exp < now) { if (L) await s.delete("l:" + id); return J({ error: "השיתוף הסתיים" }, 404); }
    return J({ name: L.name, chap: L.chap, state: L.state, started: L.started, updated: L.updated, exp: L.exp, ended: L.ended || null, phone: L.phone || "", pts: L.pts, park: L.park || null });
  }
  if (req.method !== "POST") return J({ error: "method" }, 405);
  let b; try { b = await body(req, 30000); } catch (e) { return J({ error: "bad request" }, e.status || 400); }
  const op = seg[0];
  if (op === "start") {
    const ip = await ipHash(req), rl = (await s.get("rl:" + ip, { type: "json" })) || []; const recent = rl.filter(t => now - t < 36e5);
    if (recent.length >= 12) return J({ error: "יותר מדי שיתופים בשעה האחרונה" }, 429);
    recent.push(now); await s.setJSON("rl:" + ip, recent);
    const id = rid(16), key = rid(24), L = { name: clean(b.name, 30) || "רוכב", chap: clean(b.chap, 60), phone: /^\+?[0-9]{9,15}$/.test(b.phone || "") ? b.phone : "", started: now, updated: 0, exp: now + MAX_H * 36e5, key: hashKey(key), state: "riding", pts: [], lastW: 0 };
    await s.setJSON("l:" + id, L); return J({ id, key, exp: L.exp });
  }
  const id = b.id; if (!okId(id)) return J({ error: "not found" }, 404);
  const L = await s.get("l:" + id, { type: "json" }); if (!L || L.exp < now) return J({ error: "השיתוף הסתיים" }, 404);
  if (!keyOk(b.key, L.key)) return J({ error: "forbidden" }, 403);
  if (op === "update") {
    if (now - (L.lastW || 0) < 4000 && b.state !== "sos") return J({ ok: true, throttled: true });
    const pts = (Array.isArray(b.pts) ? b.pts : []).slice(-60).map(p => [+(+p[0]).toFixed(5), +(+p[1]).toFixed(5), Math.min(now, +p[2] || now), p[3] == null ? null : Math.max(0, Math.min(300, Math.round(+p[3]))), p[4] == null ? null : Math.min(5000, Math.round(+p[4]))]).filter(p => inIL(p[1], p[0]) && p[2] > L.started - 6e4 && p[2] > (L.pts.length ? L.pts[L.pts.length - 1][2] : 0));
    L.pts = L.pts.concat(pts).slice(-KEEP_PTS);
    if (STATES.includes(b.state) && b.state !== "ended") L.state = b.state;
    if (b.park && inIL(+b.park.lat, +b.park.lon)) L.park = { lat: +(+b.park.lat).toFixed(5), lon: +(+b.park.lon).toFixed(5), t: +b.park.t || now }; else if (b.park === null) L.park = null;
    L.updated = now; L.lastW = now; await s.setJSON("l:" + id, L); return J({ ok: true });
  }
  if (op === "stop") { L.state = "ended"; L.ended = now; L.exp = Math.min(L.exp, now + 36e5); await s.setJSON("l:" + id, L); return J({ ok: true }); }
  return J({ error: "not found" }, 404);
};
export const config = { path: ["/api/live/*", "/api/live"] };
