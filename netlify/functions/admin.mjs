/* /api/admin/* — the admin API. Everything except session/setup/login needs a valid admin session.
   See lib/admin.mjs for the security model. */
import { getStore } from "@netlify/blobs";
import { randomBytes } from "node:crypto";
import {
  store, json, sleep, hashPw, checkPw, pwProblem, b32encode, totpStep, otpauth, issue, clearCookie, session,
  sameOrigin, throttled, failed, cleared, audit, cleanContent, getContent, ipHash
} from "./lib/admin.mjs";
import { sendAll } from "./lib/push.mjs";

const fuelStore = () => getStore({ name: "brn-fuel", consistency: "strong" });
const fbStore = () => getStore({ name: "brn-feedback", consistency: "strong" });
const statStore = () => getStore({ name: "brn-stats", consistency: "strong" });
const subsStore = () => getStore({ name: "brn-subs", consistency: "strong" });

async function body(req, max = 70000) { const t = await req.text(); if (t.length > max) throw new Error("too large"); return t ? JSON.parse(t) : {}; }
const codeOk = (got, envName) => { const want = Netlify.env.get(envName); return !!want && want.length >= 8 && typeof got === "string" && got.length === want.length && got === want; };

export default async req => {
  const path = new URL(req.url).pathname.replace(/^\/api\/admin\/?/, "").replace(/\/$/, "");
  const route = `${req.method} ${path}`;
  if (!sameOrigin(req)) return json({ error: "origin" }, 403);
  const s = store(); const auth = await s.get("auth", { type: "json" });
  let b = {}; if (req.method !== "GET") { try { b = await body(req); } catch (e) { return json({ error: "bad body" }, 400); } }

  /* ---------- public part ---------- */
  if (route === "GET session") {
    const me = await session(req, auth);
    return json({ authed: !!me, needsSetup: !auth || !auth.active, exp: me ? me.exp : null, setupCode: !!Netlify.env.get("ADMIN_SETUP_CODE"), resetCode: !!Netlify.env.get("ADMIN_RESET_CODE") });
  }
  if (route === "POST setup") {
    if (await throttled(req)) return json({ error: "יותר מדי ניסיונות. נסו שוב בעוד רבע שעה." }, 429);
    const reset = auth && auth.active;
    if (reset ? !codeOk(b.code, "ADMIN_RESET_CODE") : !codeOk(b.code, "ADMIN_SETUP_CODE")) { await failed(req, "setup"); await sleep(400); return json({ error: reset ? "קוד שחזור שגוי" : "קוד הקמה שגוי" }, 401); }
    const prob = pwProblem(b.password); if (prob) return json({ error: "סיסמה: " + prob }, 400);
    const totp = b32encode(randomBytes(20)); const pw = await hashPw(b.password);
    await s.setJSON("pending", { pw, totp, exp: Date.now() + 15 * 6e4 });
    return json({ secret: totp, uri: otpauth(totp, "admin") });
  }
  if (route === "POST setup/confirm") {
    if (await throttled(req)) return json({ error: "יותר מדי ניסיונות" }, 429);
    const reset = auth && auth.active; const p = await s.get("pending", { type: "json" });
    if (!p || p.exp < Date.now()) return json({ error: "ההקמה פגה. מתחילים מחדש." }, 400);
    if (reset ? !codeOk(b.code, "ADMIN_RESET_CODE") : !codeOk(b.code, "ADMIN_SETUP_CODE")) { await failed(req, "setup"); return json({ error: "קוד שגוי" }, 401); }
    const step = totpStep(p.totp, b.totp); if (step < 0) { await failed(req, "setup-totp"); return json({ error: "הקוד מהאפליקציה לא תואם. בדקו שהשעון בטלפון מדויק." }, 401); }
    const next = { active: true, pw: p.pw, totp: p.totp, lastStep: step, sv: ((auth && auth.sv) || 0) + 1, created: (auth && auth.created) || Date.now(), pwChanged: Date.now(), lastLogin: Date.now() };
    await s.setJSON("auth", next); await s.delete("pending"); await cleared(req); await audit(reset ? "reset" : "setup", { ip: await ipHash(req) });
    return json({ ok: true }, 200, { "set-cookie": await issue(next) });
  }
  if (route === "POST login") {
    if (!auth || !auth.active) return json({ error: "עוד לא הוקם מנהל" }, 400);
    if (await throttled(req)) return json({ error: "יותר מדי ניסיונות. נסו שוב בעוד רבע שעה." }, 429);
    const okPw = typeof b.password === "string" && b.password.length <= 200 && await checkPw(b.password, auth.pw);
    const step = okPw ? totpStep(auth.totp, b.totp, auth.lastStep ?? -1) : -1;
    if (!okPw || step < 0) { await failed(req, "login"); await sleep(500); return json({ error: "פרטי הכניסה שגויים" }, 401); }
    auth.lastStep = step; auth.lastLogin = Date.now(); await s.setJSON("auth", auth); await cleared(req); await audit("login", { ip: await ipHash(req) });
    return json({ ok: true }, 200, { "set-cookie": await issue(auth) });
  }
  if (route === "POST logout") return json({ ok: true }, 200, { "set-cookie": clearCookie });

  /* ---------- everything below needs a session ---------- */
  const me = await session(req, auth); if (!me) return json({ error: "auth" }, 401, { "set-cookie": clearCookie });

  if (route === "GET content") return json(await getContent());
  if (route === "PUT content") {
    const cur = await getContent(); if (typeof b.baseV === "number" && b.baseV !== cur.v) return json({ error: "התוכן השתנה בינתיים. רעננו.", current: cur }, 409);
    const next = cleanContent(b.content); next.v = (cur.v || 0) + 1; next.updated = Date.now();
    await s.setJSON("content", next); await audit("content", { v: next.v, what: String(b.what || "").slice(0, 80) });
    return json(next);
  }
  if (route === "GET stats") {
    const days = (await statStore().get("days", { type: "json" })) || {};
    let subs = 0; try { subs = (await subsStore().list()).blobs.length; } catch (e) { }
    const fuel = (await fuelStore().get("all", { type: "json" })) || {}; let votes = 0; for (const st of Object.values(fuel)) votes += Object.keys(st.v || {}).length + (st.r || []).length;
    const fb = (await fbStore().get("inbox", { type: "json" })) || [];
    const auditLog = (await s.get("audit", { type: "json" })) || [];
    return json({ days, subs, stations: Object.keys(fuel).length, votes, feedbackNew: fb.filter(x => x.status === "new").length, feedbackAll: fb.length, lastLogin: auth.lastLogin || null, pwChanged: auth.pwChanged || null, fails24: auditLog.filter(x => x.a.startsWith("fail") && Date.now() - x.t < 864e5).length });
  }
  if (route === "GET fuel") {
    const all = (await fuelStore().get("all", { type: "json" })) || {};
    const rows = Object.entries(all).map(([id, st]) => { const v = Object.values(st.v || {}); return { id, riders: v.length, open: v.filter(r => r.sat === "open").length, closed: v.filter(r => r.sat === "closed").length, y98: v.filter(r => r.o98 === true).length, n98: v.filter(r => r.o98 === false).length, last: Math.max(0, ...v.map(r => r.ts || 0)) }; }).sort((a, b) => b.last - a.last).slice(0, 200);
    return json({ rows });
  }
  if (route === "POST fuel/reset") {
    if (!/^[nwr]\d{1,12}$/.test(b.id || "")) return json({ error: "bad id" }, 400);
    const all = (await fuelStore().get("all", { type: "json" })) || {}; delete all[b.id]; await fuelStore().setJSON("all", all); await audit("fuel-reset", { id: b.id });
    return json({ ok: true });
  }
  if (route === "GET feedback") return json({ items: ((await fbStore().get("inbox", { type: "json" })) || []).slice().reverse() });
  if (route === "POST feedback/status") {
    const inbox = (await fbStore().get("inbox", { type: "json" })) || []; const it = inbox.find(x => x.id === b.id); if (!it) return json({ error: "not found" }, 404);
    if (b.status === "delete") inbox.splice(inbox.indexOf(it), 1); else if (["new", "open", "done"].includes(b.status)) it.status = b.status; else return json({ error: "bad status" }, 400);
    await fbStore().setJSON("inbox", inbox); await audit("feedback", { id: b.id, s: b.status }); return json({ ok: true });
  }
  if (route === "POST broadcast") {
    const title = String(b.title || "").trim().slice(0, 60), text = String(b.body || "").trim().slice(0, 180);
    if (!title || !text || b.confirm !== "שלח") return json({ error: "חסרים כותרת, טקסט או אישור" }, 400);
    const last = await s.get("lastBroadcast", { type: "json" }); if (last && Date.now() - last.t < 10 * 6e4) return json({ error: "שידור אחד בכל 10 דקות" }, 429);
    await s.setJSON("lastBroadcast", { t: Date.now() });
    const r = await sendAll({ title, body: text, tag: "admin-" + Date.now(), url: "./" }); await audit("broadcast", { title, sent: r.sent });
    return json(r);
  }
  if (route === "GET audit") return json({ items: ((await s.get("audit", { type: "json" })) || []).slice().reverse().slice(0, 150) });
  if (route === "POST password") {
    if (await throttled(req)) return json({ error: "יותר מדי ניסיונות" }, 429);
    const ok = typeof b.current === "string" && await checkPw(b.current, auth.pw); const step = ok ? totpStep(auth.totp, b.totp, auth.lastStep ?? -1) : -1;
    if (!ok || step < 0) { await failed(req, "password"); return json({ error: "הסיסמה הנוכחית או הקוד שגויים" }, 401); }
    const prob = pwProblem(b.next); if (prob) return json({ error: "סיסמה חדשה: " + prob }, 400);
    auth.pw = await hashPw(b.next); auth.lastStep = step; auth.sv = (auth.sv || 1) + 1; auth.pwChanged = Date.now(); await s.setJSON("auth", auth); await audit("password");
    return json({ ok: true }, 200, { "set-cookie": await issue(auth) });
  }
  if (route === "POST logout-all") { auth.sv = (auth.sv || 1) + 1; await s.setJSON("auth", auth); await audit("logout-all"); return json({ ok: true }, 200, { "set-cookie": clearCookie }); }
  return json({ error: "not found" }, 404);
};
export const config = { path: ["/api/admin", "/api/admin/*"] };
