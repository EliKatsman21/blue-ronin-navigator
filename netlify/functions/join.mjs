/* /api/join — the launch waitlist and the link-hub counter.
   POST { email, name?, ref?, src?, consent:true }  → joins; answers the rider's own referral code.
   GET  ?c=CODE                                      → how many friends joined through that code (no personal data).
   POST { hit:"go", src }                            → anonymous visit counter for /go (which channel sends riders).
   Throttled per hashed IP. Nothing here is shown to other riders. */
import { ipHash, json } from "./lib/admin.mjs";
import { bump, opsLog } from "./lib/ops.mjs";
import { joinStore, NEED, cleanSrc, cleanEmail, cleanName, newRef, isRef, emailHash, count, refsOf } from "./lib/join.mjs";
const HOUR = 36e5;
export default async req => {
  const s = joinStore();
  if (req.method === "GET") {
    const c = new URL(req.url).searchParams.get("c");
    if (!isRef(c) || !(await s.get("c:" + c, { type: "json" }))) return json({ error: "לא מצאנו את הקוד" }, 404);
    return json({ refs: await refsOf(c), need: NEED, total: await count("e:") });
  }
  if (req.method !== "POST") return json({ error: "method" }, 405);
  let b; try { const t = await req.text(); if (t.length > 2000) return json({ error: "too large" }, 413); b = JSON.parse(t); } catch (e) { return json({ error: "bad json" }, 400); }
  if (b.hit === "go") { await bump("go:" + cleanSrc(b.src)); return json({ ok: true }); }
  if (b.website) return json({ ok: true, code: newRef(), n: 1, refs: 0, need: NEED }); // honeypot: bots get a polite nothing
  const email = cleanEmail(b.email);
  if (!email) return json({ error: "כתובת המייל לא נראית תקינה" }, 400);
  if (b.consent !== true) return json({ error: "צריך לאשר קבלת עדכון על ההשקה" }, 400);
  const ip = await ipHash(req), now = Date.now();
  try {
    const { blobs } = await s.list({ prefix: `ip:` });
    for (const x of blobs) if (now - +x.key.split(":")[2] > 24 * HOUR) await s.delete(x.key).catch(() => { });
    if (blobs.filter(x => x.key.startsWith(`ip:${ip}:`) && now - +x.key.split(":")[2] < HOUR).length >= 5) return json({ error: "יותר מדי הרשמות מהרשת הזו. נסו שוב בעוד שעה." }, 429);
  } catch (e) { }
  const h = await emailHash(email), had = await s.get("e:" + h, { type: "json" });
  if (had) return json({ ok: true, again: true, code: had.code, n: had.n, refs: await refsOf(had.code), need: NEED });
  await s.setJSON(`ip:${ip}:${now}`, {});
  let code; do code = newRef(); while (await s.get("c:" + code, { type: "json" }));
  const ref = isRef(b.ref) && (await s.get("c:" + b.ref, { type: "json" })) ? b.ref : "";
  const n = (await count("e:")) + 1;
  await s.setJSON("c:" + code, { h });
  await s.setJSON("e:" + h, { t: now, email, name: cleanName(b.name), code, ref, src: cleanSrc(b.src), n });
  if (ref) await s.setJSON(`r:${ref}:${h}`, { t: now });
  await bump("join");
  if (n === 1 || n % 50 === 0) await opsLog("join", "info", `waitlist reached ${n}`);
  return json({ ok: true, code, n, refs: 0, need: NEED });
};
export const config = { path: "/api/join" };
