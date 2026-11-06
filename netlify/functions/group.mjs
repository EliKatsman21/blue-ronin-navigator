/* Group rides. A leader with Pro opens a group; anyone with the 6-letter code joins (free).
   Each member writes only their own record (p:<gid>:<mid>), so members never overwrite each other.
   Every position update returns the whole group, so one request per tick does both.
   Groups end after 12 hours or when the leader ends them; everything is deleted then.
   POST /api/group/create {title, name, pro}        -> {gid, mid, key, exp}
   POST /api/group/join   {code, name}              -> {gid, mid, key, exp, title}
   POST /api/group/pos    {gid, mid, key, lat, lon, spd, acc, state} -> snapshot
   POST /api/group/meet   {gid, mid, key, lat, lon, label}  (leader)
   POST /api/group/leave  {gid, mid, key}
   POST /api/group/end    {gid, mid, key}  (leader) */
import { getStore } from "@netlify/blobs";
import { ipHash } from "./lib/admin.mjs";
import { verify } from "./lib/pro.mjs";
import { rid, hashKey, keyOk, clean, inIL, J } from "./lib/safety.mjs";
const store = () => getStore({ name: "brn-group", consistency: "strong" });
const CH = "ABCDEFGHJKMNPQRSTUVWXYZ23456789", MAXM = 20, TTL = 12 * 36e5;
const COLORS = ["#5C8DFF", "#FFA24A", "#2BB673", "#E84A8A", "#9B6BFF", "#18B6C9", "#E0C341", "#FF6B5C", "#7AC943", "#C77DFF"];
const okG = x => typeof x === "string" && /^[A-Z2-9]{6}$/.test(x), okM = x => typeof x === "string" && /^[A-Za-z0-9]{6,16}$/.test(x);
export default async req => {
  if (req.method !== "POST") return J({ error: "method" }, 405);
  const op = new URL(req.url).pathname.split("/")[3] || "", st = store(), now = Date.now();
  let b; try { const t = await req.text(); if (t.length > 4000) return J({ error: "too large" }, 413); b = JSON.parse(t || "{}"); } catch (e) { return J({ error: "bad" }, 400); }
  const ip = await ipHash(req);
  const limit = async (k, n, win) => { const a = ((await st.get("rl:" + k, { type: "json" })) || []).filter(x => now - x < win); if (a.length >= n) return true; a.push(now); await st.setJSON("rl:" + k, a); return false; };
  const meta = async g => { const m = await st.get("g:" + g, { type: "json" }); if (!m) return null; if (m.exp < now || m.ended) { await wipe(g); return null; } return m; };
  const wipe = async g => { const { blobs } = await st.list({ prefix: "p:" + g + ":" }); for (const x of blobs) await st.delete(x.key); await st.delete("g:" + g); };
  const snap = async (g, m) => { const { blobs } = await st.list({ prefix: "p:" + g + ":" }); const members = [];
    for (const x of blobs) { const r = await st.get(x.key, { type: "json" }); if (r && !r.left) members.push({ mid: r.mid, name: r.name, color: r.color, lat: r.lat, lon: r.lon, t: r.t || 0, spd: r.spd, state: r.state || "ride", leader: r.mid === m.leader }); }
    return { gid: g, title: m.title, exp: m.exp, leader: m.leader, meet: m.meet || null, members, now }; };
  if (op === "create") {
    if (await limit("c:" + ip, 8, 864e5)) return J({ error: "נפתחו כבר כמה קבוצות היום" }, 429);
    const pro = typeof b.pro === "string" ? await verify(b.pro).catch(() => null) : null;
    if (!pro || !(pro.exp > now)) return J({ error: "פתיחת קבוצה היא חלק מ־Pro", pro: true }, 402);
    let g = ""; for (let k = 0; k < 6; k++) { g = Array.from(crypto.getRandomValues(new Uint8Array(6)), x => CH[x % CH.length]).join(""); if (!(await st.get("g:" + g))) break; }
    const mid = rid(8), key = rid(18);
    await st.setJSON("g:" + g, { title: clean(b.title, 40) || "רכיבה קבוצתית", leader: mid, exp: now + TTL, created: now, n: 1 });
    await st.setJSON(`p:${g}:${mid}`, { mid, name: clean(b.name, 24) || "מוביל", color: COLORS[0], key: hashKey(key), joined: now });
    return J({ gid: g, mid, key, exp: now + TTL, title: clean(b.title, 40) || "רכיבה קבוצתית", leader: true });
  }
  if (op === "join") {
    if (await limit("j:" + ip, 20, 36e5)) return J({ error: "יותר מדי ניסיונות. נסו שוב בעוד שעה" }, 429);
    const g = String(b.code || "").toUpperCase().replace(/[^A-Z0-9]/g, ""); if (!okG(g)) return J({ error: "הקוד צריך 6 תווים" }, 400);
    const m = await meta(g); if (!m) return J({ error: "הקבוצה לא נמצאה או שהסתיימה" }, 404);
    const { blobs } = await st.list({ prefix: "p:" + g + ":" }); if (blobs.length >= MAXM) return J({ error: `אפשר עד ${MAXM} רוכבים בקבוצה` }, 400);
    const mid = rid(8), key = rid(18);
    await st.setJSON(`p:${g}:${mid}`, { mid, name: clean(b.name, 24) || "רוכב", color: COLORS[blobs.length % COLORS.length], key: hashKey(key), joined: now });
    return J({ gid: g, mid, key, exp: m.exp, title: m.title, leader: false });
  }
  if (!okG(b.gid) || !okM(b.mid)) return J({ error: "not found" }, 404);
  const m = await meta(b.gid); if (!m) return J({ error: "הקבוצה הסתיימה", ended: true }, 410);
  const pk = `p:${b.gid}:${b.mid}`, me = await st.get(pk, { type: "json" });
  if (!me || me.left || !keyOk(b.key, me.key)) return J({ error: "forbidden" }, 403);
  if (op === "pos") {
    if (now - (me.w || 0) >= 4000 || b.state === "sos") {
      const lat = +b.lat, lon = +b.lon;
      if (inIL(lat, lon)) { me.lat = +lat.toFixed(5); me.lon = +lon.toFixed(5); me.t = now; me.spd = b.spd == null ? null : Math.max(0, Math.min(300, Math.round(+b.spd))); }
      me.state = ["ride", "stop", "sos"].includes(b.state) ? b.state : "ride"; me.w = now; await st.setJSON(pk, me);
    }
    return J(await snap(b.gid, m));
  }
  if (op === "meet") {
    if (m.leader !== b.mid) return J({ error: "רק מוביל הקבוצה קובע נקודת מפגש" }, 403);
    if (b.clear) m.meet = null; else { const lat = +b.lat, lon = +b.lon; if (!inIL(lat, lon)) return J({ error: "מיקום לא תקין" }, 400); m.meet = { lat: +lat.toFixed(5), lon: +lon.toFixed(5), label: clean(b.label, 40), t: now }; }
    await st.setJSON("g:" + b.gid, m); return J(await snap(b.gid, m));
  }
  if (op === "leave") { me.left = true; await st.setJSON(pk, me); return J({ ok: true }); }
  if (op === "end") { if (m.leader !== b.mid) return J({ error: "רק המוביל מסיים את הקבוצה" }, 403); await wipe(b.gid); return J({ ok: true }); }
  return J({ error: "not found" }, 404);
};
export const config = { path: "/api/group/*" };
