/* /api/admin/* — the admin API. Everything except session/setup/login needs a valid admin session.
   See lib/admin.mjs for the security model. */
import { getStore } from "@netlify/blobs";
import { randomBytes } from "node:crypto";
import {
  store, json, sleep, hashPw, checkPw, pwProblem, b32encode, totpStep, otpauth, issue, clearCookie, session,
  sameOrigin, throttled, failed, cleared, audit, cleanContent, getContent, ipHash, addHistory, getHistory
} from "./lib/admin.mjs";
import { proStore, newCode } from "./lib/pro.mjs";
import { sendAll, validSub, keyOf } from "./lib/push.mjs";
import { opsStore, usage } from "./lib/ops.mjs";
import { runScan, notifyAdmins, PLAYBOOK, fingerprint } from "./lib/health.mjs";

const fuelStore = () => getStore({ name: "brn-fuel", consistency: "strong" });
const fbStore = () => getStore({ name: "brn-feedback", consistency: "strong" });
const fbMedia = () => getStore({ name: "brn-fb-media", consistency: "strong" });
const dropMedia = async items => { for (const x of items) for (const k of x.media || []) await fbMedia().delete(x.id + "-" + k).catch(() => { }); };
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
    const pa = cur.announce || {}, na = next.announce;
    if (na.on && na.text && (!pa.on || pa.text !== na.text || pa.level !== na.level)) await addHistory({ kind: "announce", level: na.level, text: na.text, link: na.link || "" });
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
  /* ---------- monitoring center ---------- */
  if (route === "GET ops") {
    const ops = opsStore(), all = (await ops.list()).blobs.map(x => x.key);
    const get = k => ops.get(k, { type: "json" }).catch(() => null), many = async ks => { const out = []; for (let i = 0; i < ks.length; i += 25) out.push(...await Promise.all(ks.slice(i, i + 25).map(get))); return out.filter(Boolean); };
    const hs = all.filter(k => k.startsWith("h:")).sort().slice(-48), scans = await many(hs);
    const logs = (await many(all.filter(k => k.startsWith("l:")).sort().slice(-150))).reverse();
    const es = getStore({ name: "brn-err", consistency: "strong" }), ek = (await es.list({ prefix: "e:" })).blobs.map(x => x.key).sort().filter(k => Date.now() - +k.split(":")[1] < 7 * 864e5).slice(-300);
    const errs = []; for (let i = 0; i < ek.length; i += 25) errs.push(...(await Promise.all(ek.slice(i, i + 25).map(k => es.get(k, { type: "json" }).catch(() => null)))).filter(Boolean));
    const dev = ua => /iPhone|iPad/.test(ua) ? "iPhone" : /Android/.test(ua) ? "Android" : /Mac/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : "אחר";
    const G = {}; errs.forEach(x => { const k = fingerprint(x); const g = G[k] || (G[k] = { k, kind: x.kind, msg: x.msg, n: 0, first: x.t, last: x.t, vers: {}, devs: {}, sample: x }); g.n++; g.first = Math.min(g.first, x.t); if (x.t >= g.last) { g.last = x.t; g.sample = x; } g.vers[x.ver] = (g.vers[x.ver] || 0) + 1; g.devs[dev(x.ua)] = (g.devs[dev(x.ua)] || 0) + 1; });
    const groups = Object.values(G).sort((a, b) => b.last - a.last).sort((a, b) => b.n - a.n).slice(0, 30).map(g => ({ ...g, sample: { src: g.sample.src, line: g.sample.line, stack: g.sample.stack, crumbs: g.sample.crumbs, ua: g.sample.ua, tab: g.sample.tab } }));
    const state = (await get("state")) || {}, cap = +(Netlify.env.get("HERE_MONTHLY_CAP") || 4500);
    return json({ state: { overall: state.overall || null, lastScan: state.lastScan || 0, open: Object.values(state.open || {}) }, latest: scans[scans.length - 1] || null,
      history: scans.map(x => ({ t: x.t, overall: x.overall, c: Object.fromEntries(x.checks.map(c => [c.id, c.ok ? 1 : 0])) })), incidents: (await get("incidents")) || [], logs, groups, errTotal: errs.length,
      usage: { here: Netlify.env.get("HERE_API_KEY") ? await usage("here") : null, hereCap: cap, openmeteo: await usage("openmeteo") }, adminSubs: all.filter(k => k.startsWith("adminsub:")).length, playbook: PLAYBOOK });
  }
  if (route === "POST ops/scan") { const r = await runScan({ manual: true }); await audit("scan", { overall: r.overall }); return json(r); }
  if (route === "POST ops/subscribe") { if (!validSub(b.sub)) return json({ error: "מנוי לא תקין" }, 400); await opsStore().setJSON("adminsub:" + keyOf(b.sub.endpoint), { sub: { endpoint: b.sub.endpoint, keys: b.sub.keys }, t: Date.now(), dev: String(b.dev || "").slice(0, 40) }); await audit("alerts-on"); return json({ ok: true }); }
  if (route === "POST ops/unsubscribe") { if (typeof b.endpoint === "string") await opsStore().delete("adminsub:" + keyOf(b.endpoint)); return json({ ok: true }); }
  if (route === "POST ops/test") { const n = await notifyAdmins([{ kind: "close", c: { id: "push", name: "בדיקת התראה" }, dur: 0 }]); return json({ sent: n }); }
  if (route === "GET errors") { const es = getStore({ name: "brn-err", consistency: "strong" }); const { blobs } = await es.list({ prefix: "e:" }); const keys = blobs.map(b => b.key).sort().reverse().slice(0, 100); const items = []; for (const k of keys) { const v = await es.get(k, { type: "json" }); if (v) items.push(v); } return json({ items }); }
  if (route === "POST errors/clear") { const es = getStore({ name: "brn-err", consistency: "strong" }); const { blobs } = await es.list({ prefix: "e:" }); for (const b of blobs) await es.delete(b.key); await audit("errors.clear"); return json({ ok: true }); }
  if (route === "GET feedback/media") {
    const q = new URL(req.url).searchParams, id = q.get("id") || "", k = q.get("k"); if (!/^[a-f0-9]{12}$/.test(id) || !["p", "a"].includes(k)) return json({ error: "bad" }, 400);
    const r = await fbMedia().getWithMetadata(id + "-" + k, { type: "arrayBuffer" }); if (!r) return json({ error: "not found" }, 404);
    return new Response(r.data, { headers: { "content-type": r.metadata && r.metadata.ct || "application/octet-stream", "cache-control": "private, no-store", "x-content-type-options": "nosniff", "content-security-policy": "default-src 'none'; sandbox" } });
  }
  if (route === "GET feedback") return json({ items: ((await fbStore().get("inbox", { type: "json" })) || []).slice().reverse() });
  if (route === "POST feedback/status") {
    const inbox = (await fbStore().get("inbox", { type: "json" })) || []; const it = inbox.find(x => x.id === b.id); if (!it) return json({ error: "not found" }, 404);
    if (b.status === "delete") { inbox.splice(inbox.indexOf(it), 1); await dropMedia([it]); } else if (["new", "open", "done"].includes(b.status)) it.status = b.status; else return json({ error: "bad status" }, 400);
    await fbStore().setJSON("inbox", inbox); await audit("feedback", { id: b.id, s: b.status }); return json({ ok: true });
  }
  if (route === "POST feedback/purge") {
    const inbox = (await fbStore().get("inbox", { type: "json" })) || []; const keep = inbox.filter(x => x.status !== "done"); const n = inbox.length - keep.length; await dropMedia(inbox.filter(x => x.status === "done"));
    await fbStore().setJSON("inbox", keep); await audit("feedback-purge", { n }); return json({ ok: true, removed: n });
  }
  if (route === "POST broadcast") {
    const title = String(b.title || "").trim().slice(0, 60), text = String(b.body || "").trim().slice(0, 180);
    if (!title || !text || b.confirm !== "שלח") return json({ error: "חסרים כותרת, טקסט או אישור" }, 400);
    const last = await s.get("lastBroadcast", { type: "json" }); if (last && Date.now() - last.t < 10 * 6e4) return json({ error: "שידור אחד בכל 10 דקות" }, 429);
    await s.setJSON("lastBroadcast", { t: Date.now() });
    const r = await sendAll({ title, body: text, tag: "admin-" + Date.now(), url: "./#inbox" }); await audit("broadcast", { title, sent: r.sent });
    await addHistory({ kind: "push", title, text });
    return json(r);
  }
  if (route === "GET history") return json({ items: (await getHistory()).slice().reverse() });
  if (route === "POST history/delete") { const h = await getHistory(); const n = h.filter(x => x.id !== b.id); await s.setJSON("history", n); await audit("history-delete", { id: b.id }); return json({ ok: true }); }
  if (route === "GET pro") {
    const ps = proStore(); const codes = (await ps.get("codes", { type: "json" })) || {};
    let trials = 0; try { trials = (await ps.list({ prefix: "trial:" })).blobs.length; } catch (e) { }
    const interest = (await ps.get("interest", { type: "json" })) || { monthly: 0, yearly: 0 };
    return json({ trials, interest, codes: Object.entries(codes).map(([code, c]) => ({ code, days: c.days, max: c.max, used: c.used, label: c.label, created: c.created, revoked: !!c.revoked })).sort((a, b) => b.created - a.created) });
  }
  if (route === "POST pro/codes") {
    const count = Math.max(1, Math.min(50, +b.count || 1)), days = Math.max(1, Math.min(730, +b.days || 30)), max = Math.max(1, Math.min(1000, +b.max || 1));
    const label = String(b.label || "").replace(/[\u0000-\u001F]/g, "").trim().slice(0, 60);
    const ps = proStore(); const codes = (await ps.get("codes", { type: "json" })) || {}; const made = [];
    for (let i = 0; i < count; i++) { let c; do c = newCode(); while (codes[c]); codes[c] = { days, max, used: 0, label, created: Date.now(), by: [] }; made.push(c); }
    await ps.setJSON("codes", codes); await audit("pro-codes", { count, days, max, label }); return json({ codes: made });
  }
  if (route === "POST pro/revoke") {
    const ps = proStore(); const codes = (await ps.get("codes", { type: "json" })) || {}; if (!codes[b.code]) return json({ error: "not found" }, 404);
    codes[b.code].revoked = true; await ps.setJSON("codes", codes); await audit("pro-revoke", { code: b.code }); return json({ ok: true });
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
