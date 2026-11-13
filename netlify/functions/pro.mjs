/* /api/pro/* — trial, code redemption, status check, and "reserve founder price" interest.
   Everything is anonymous: the device id is the same random id used for fuel votes. */
import { edgeGate } from "./lib/edge.mjs";
import { getStore } from "@netlify/blobs";
import { randomBytes } from "node:crypto";
import { proStore, sign, verify, cidOk, TRIAL_DAYS } from "./lib/pro.mjs";
import { ipHash } from "./lib/admin.mjs";
import { queueReport } from "./lib/feedback-core.mjs";

const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const day = 864e5;
async function limited(req, key, max, winMs) {
  const s = proStore(), k = "rl:" + key + ":" + (await ipHash(req)); const now = Date.now();
  const hits = ((await s.get(k, { type: "json" })) || []).filter(t => now - t < winMs);
  if (hits.length >= max) return true; hits.push(now); await s.setJSON(k, hits); return false;
}
export default async req => {
  const gate = edgeGate(req); if (gate) return gate;
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const path = new URL(req.url).pathname.replace(/^\/api\/pro\/?/, "");
  let b = {}; try { const t = await req.text(); if (t.length > 2000) return json({ error: "too large" }, 413); b = t ? JSON.parse(t) : {}; } catch (e) { return json({ error: "bad json" }, 400); }
  const s = proStore();

  if (path === "status") {
    const p = await verify(b.token);
    return json(p && p.exp > Date.now() ? { pro: true, exp: p.exp, src: p.src } : { pro: false, expired: !!p });
  }
  if (path === "trial") {
    if (!cidOk(b.cid)) return json({ error: "מזהה מכשיר חסר" }, 400);
    if (await limited(req, "trial", 5, day)) return json({ error: "יותר מדי ניסיונות היום" }, 429);
    if (await s.get("trial:" + b.cid)) return json({ error: "תקופת הניסיון כבר נוצלה במכשיר הזה" }, 409);
    const exp = Date.now() + TRIAL_DAYS * day; await s.setJSON("trial:" + b.cid, { t: Date.now() });
    return json({ token: await sign({ cid: b.cid, exp, src: "trial" }), exp, src: "trial" });
  }
  if (path === "redeem") {
    if (!cidOk(b.cid)) return json({ error: "מזהה מכשיר חסר" }, 400);
    if (await limited(req, "redeem", 10, 36e5)) return json({ error: "יותר מדי ניסיונות. נסו שוב בעוד שעה" }, 429);
    const code = String(b.code || "").toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^BR(?=.{8}$)/, "").replace(/^(.{4})(.{4})$/, "BR-$1-$2");
    const codes = (await s.get("codes", { type: "json" })) || {}; const c = codes[code];
    if (!c || c.revoked) return json({ error: "הקוד לא נמצא" }, 404);
    if (c.until && c.until < Date.now()) return json({ error: "תוקף הקוד פג" }, 410);
    c.by = c.by || []; const again = c.by.includes(b.cid);
    if (!again && c.used >= c.max) return json({ error: "הקוד כבר נוצל עד הסוף" }, 409);
    if (!again) { c.used++; c.by.push(b.cid); c.by = c.by.slice(-1000); await s.setJSON("codes", codes); }
    const exp = Date.now() + c.days * day;
    return json({ token: await sign({ cid: b.cid, exp, src: "code", code }), exp, src: "code", label: c.label || "" });
  }
  if (path === "interest") {
    if (await limited(req, "interest", 8, day)) return json({ error: "יותר מדי שינויים היום. נסו מחר" }, 429);
    /* one reservation per rider: changing the plan moves it, "none" cancels it */
    const prev = ["monthly", "yearly"].includes(b.prev) ? b.prev : null;
    if (b.plan === "none") { if (prev) { const c0 = (await s.get("interest", { type: "json" })) || { monthly: 0, yearly: 0 }; c0[prev] = Math.max(0, (c0[prev] || 0) - 1); await s.setJSON("interest", c0); } return json({ ok: true }); }
    const plan = ["monthly", "yearly"].includes(b.plan) ? b.plan : "yearly";
    const fb = getStore({ name: "brn-feedback", consistency: "strong" });
    const contact = String(b.contact || "").replace(/[\u0000-\u001F‪-‮]/g, "").trim().slice(0, 120);
    /* into the admin inbox queue (its own blob, no read-modify-write of the inbox; lib/feedback-core.mjs) */
    await queueReport(fb, { id: randomBytes(6).toString("hex"), t: Date.now(), ip: await ipHash(req), kind: "pro", text: `שריון מחיר מייסד: ${plan === "yearly" ? "שנתי" : "חודשי"}${contact ? " · " + contact : ""}`, status: "new", ver: String(b.ver || "").slice(0, 20) });
    const cnt = (await s.get("interest", { type: "json" })) || { monthly: 0, yearly: 0 }; cnt[plan]++; if (prev && prev !== plan) cnt[prev] = Math.max(0, (cnt[prev] || 0) - 1); await s.setJSON("interest", cnt);
    return json({ ok: true });
  }
  return json({ error: "not found" }, 404);
};
export const config = { path: "/api/pro/*" };
