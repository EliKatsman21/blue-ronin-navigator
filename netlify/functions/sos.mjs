/* Emergency contacts ("guardians"). The rider's phone holds a circle id + secret key. A contact joins with a
   one-time invite code and their phone's push subscription; the rider can list and remove contacts.
   An alert (manual SOS, detected fall, or a test) pushes a high-urgency notification to every contact,
   with a link to the rider's live location.
   POST /api/sos/circle {name}                      -> {circle, key}
   POST /api/sos/invite {circle,key}                -> {inv, exp}
   GET  /api/sos/invite/<inv>                       -> {name}
   POST /api/sos/join   {inv, sub, name}            -> {ok}
   POST /api/sos/list   {circle,key}                -> {guardians}
   POST /api/sos/remove {circle,key,gid}            -> {ok}
   POST /api/sos/alert  {circle,key,kind,lat,lon,acc,live,name,phone} -> {sent, total} */
import { sosStore, rid, hashKey, keyOk, clean, okId, inIL, body, J } from "./lib/safety.mjs";
import { ipHash } from "./lib/admin.mjs";
import { validSub, sendOne } from "./lib/push.mjs";
import { opsLog } from "./lib/ops.mjs";
const MAXG = 5, INV_DAYS = 7, INV_CH = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const invCode = () => { const b = rid(16); let o = ""; for (let i = 0; i < 8; i++) o += INV_CH[b.charCodeAt(i) % INV_CH.length]; return o; };
const normInv = x => String(x || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
export default async req => {
  const u = new URL(req.url), seg = u.pathname.replace(/^\/api\/sos\/?/, "").split("/").filter(Boolean), s = sosStore(), now = Date.now();
  if (req.method === "GET" && seg[0] === "invite") {
    const inv = normInv(seg[1]); const I = inv.length === 8 && await s.get("i:" + inv, { type: "json" });
    if (!I || I.exp < now) return J({ error: "הקוד לא בתוקף. בקשו קוד חדש מהרוכב" }, 404);
    const C = await s.get("c:" + I.circle, { type: "json" }); return J({ name: C ? C.name : "רוכב" });
  }
  if (req.method !== "POST") return J({ error: "method" }, 405);
  let b; try { b = await body(req, 6000); } catch (e) { return J({ error: "bad request" }, e.status || 400); }
  const ip = await ipHash(req), op = seg[0];
  const limit = async (k, n, win) => { const a = ((await s.get("rl:" + k, { type: "json" })) || []).filter(t => now - t < win); if (a.length >= n) return true; a.push(now); await s.setJSON("rl:" + k, a); return false; };
  if (op === "circle") {
    if (await limit("c:" + ip, 6, 864e5)) return J({ error: "נסו שוב מחר" }, 429);
    const circle = rid(16), key = rid(24); await s.setJSON("c:" + circle, { name: clean(b.name, 30) || "רוכב", key: hashKey(key), g: [], created: now });
    return J({ circle, key });
  }
  if (op === "join") {
    if (await limit("j:" + ip, 10, 36e5)) return J({ error: "יותר מדי ניסיונות. נסו שוב בעוד שעה" }, 429);
    const inv = normInv(b.inv), I = inv.length === 8 && await s.get("i:" + inv, { type: "json" });
    if (!I || I.exp < now) return J({ error: "הקוד לא בתוקף. בקשו קוד חדש מהרוכב" }, 404);
    if (!validSub(b.sub)) return J({ error: "אין הרשאת התראות במכשיר הזה" }, 400);
    const C = await s.get("c:" + I.circle, { type: "json" }); if (!C) return J({ error: "not found" }, 404);
    const ep = b.sub.endpoint; C.g = C.g.filter(g => g.sub.endpoint !== ep);
    if (C.g.length >= MAXG) return J({ error: `אפשר עד ${MAXG} אנשי קשר` }, 400);
    const gid = rid(6); C.g.push({ gid, name: clean(b.name, 30) || "איש קשר", sub: { endpoint: ep, keys: { p256dh: b.sub.keys.p256dh, auth: b.sub.keys.auth } }, t: now });
    await s.setJSON("c:" + I.circle, C); I.used = (I.used || 0) + 1; if (I.used >= 3) await s.delete("i:" + inv); else await s.setJSON("i:" + inv, I);
    await sendOne({ sub: C.g[C.g.length - 1].sub }, { title: "Blue Ronin · נרשמת כאיש קשר לחירום", body: `מעכשיו תקבלו כאן התראה אם ${C.name} ישלח קריאת חירום או אם תזוהה נפילה, יחד עם המיקום.`, tag: "sos-join", url: "./" }).catch(() => { });
    return J({ ok: true, rider: C.name });
  }
  if (!okId(b.circle)) return J({ error: "not found" }, 404);
  const C = await s.get("c:" + b.circle, { type: "json" }); if (!C) return J({ error: "not found" }, 404);
  if (!keyOk(b.key, C.key)) return J({ error: "forbidden" }, 403);
  if (b.name && clean(b.name, 30) && clean(b.name, 30) !== C.name) { C.name = clean(b.name, 30); await s.setJSON("c:" + b.circle, C); }
  if (op === "invite") {
    if (await limit("i:" + b.circle, 20, 864e5)) return J({ error: "יותר מדי קודים היום" }, 429);
    const inv = invCode(), exp = now + INV_DAYS * 864e5; await s.setJSON("i:" + inv, { circle: b.circle, exp }); return J({ inv, exp });
  }
  if (op === "list") return J({ guardians: C.g.map(g => ({ gid: g.gid, name: g.name, t: g.t })) });
  if (op === "remove") { C.g = C.g.filter(g => g.gid !== b.gid); await s.setJSON("c:" + b.circle, C); return J({ ok: true }); }
  if (op === "alert") {
    if (await limit("a:" + b.circle, 8, 6e5)) return J({ error: "נשלחו כבר כמה התראות בדקות האחרונות" }, 429);
    const kind = ["sos", "crash", "test"].includes(b.kind) ? b.kind : "sos", lat = +b.lat, lon = +b.lon, has = inIL(lat, lon);
    const live = okId(b.live) ? b.live : "", name = C.name, base = process.env.URL || "https://blueronin.app";
    const where = has ? `https://maps.google.com/?q=${lat.toFixed(5)},${lon.toFixed(5)}` : "";
    const T = { sos: `🆘 ${name} שלח קריאת חירום`, crash: `🚨 ${name}: ייתכן שהייתה נפילה`, test: `בדיקה: התראת חירום מ־${name}` }[kind];
    const B = kind === "test" ? "זו רק בדיקה. ככה תיראה התראה אמיתית. לחיצה פותחת את המיקום." : `${kind === "crash" ? "הטלפון זיהה מכה חזקה ועצירה, ולא היה מענה במשך 30 שניות. " : ""}לחצו לפתיחת המיקום${live ? " החי" : ""}. ${b.phone && /^\+?[0-9]{9,15}$/.test(b.phone) ? "טלפון: " + b.phone : ""}`;
    const url = live ? `${base}/live.html#${live}` : (where || base);
    let sent = 0; const alive = [];
    for (const g of C.g) { const ok = await sendOne({ sub: g.sub }, { title: T, body: B.trim(), tag: "sos-" + b.circle, url, sos: kind !== "test" }, { urgency: "high", ttl: 3600 }); if (ok) { sent++; alive.push(g); } }
    if (alive.length !== C.g.length) { C.g = alive; await s.setJSON("c:" + b.circle, C); }
    C.last = { t: now, kind, sent }; await s.setJSON("c:" + b.circle, C);
    /* no personal data in the ops log: only that an alert went out and whether it reached anyone */
    if (kind !== "test") await opsLog("sos", sent ? "warn" : "critical", sent ? `קריאת חירום (${kind}) נשלחה ל־${sent} אנשי קשר` : `קריאת חירום (${kind}) לא הגיעה לאף איש קשר`, { sent, total: C.g.length });
    return J({ sent, total: C.g.length, where });
  }
  return J({ error: "not found" }, 404);
};
export const config = { path: ["/api/sos/*", "/api/sos"] };
