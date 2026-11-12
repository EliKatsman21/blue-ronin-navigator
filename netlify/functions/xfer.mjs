/* Device-to-device / address-to-address transfer. The phone encrypts its data (AES-GCM) with a key that
   never leaves it: the key is half of the code the rider types on the other phone. We only ever hold
   ciphertext, for 24 hours, readable a few times, then it is deleted.
   POST /api/xfer        {ct, iv}  -> {id}
   GET  /api/xfer/<id>             -> {ct, iv} */
import { edgeGate } from "./lib/edge.mjs";
import { getStore } from "@netlify/blobs";
import { ipHash } from "./lib/admin.mjs";
const store = () => getStore({ name: "brn-xfer", consistency: "strong" });
const CH = "ABCDEFGHJKMNPQRSTUVWXYZ23456789", MAX = 4.5 * 1024 * 1024, TTL = 864e5, READS = 6;
const J = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
export default async req => {
  const gate = edgeGate(req); if (gate) return gate;
  const st = store(), now = Date.now(), ip = await ipHash(req), id = new URL(req.url).pathname.split("/")[3] || "";
  const limit = async (k, n) => { const a = ((await st.get("rl:" + k, { type: "json" })) || []).filter(x => now - x < 36e5); if (a.length >= n) return true; a.push(now); await st.setJSON("rl:" + k, a); return false; };
  if (req.method === "GET") {
    if (!/^[A-Z2-9]{6}$/.test(id)) return J({ error: "קוד לא תקין" }, 400);
    if (await limit("g:" + ip, 30)) return J({ error: "יותר מדי ניסיונות. נסו שוב בעוד שעה" }, 429);
    const m = await st.get("m:" + id, { type: "json" }); if (!m || m.exp < now) { if (m) { await st.delete("m:" + id); await st.delete("d:" + id); } return J({ error: "הקוד לא נמצא או שפג תוקפו" }, 404); }
    const ct = await st.get("d:" + id); m.reads = (m.reads || 0) + 1;
    if (m.reads >= READS) { await st.delete("m:" + id); await st.delete("d:" + id); } else await st.setJSON("m:" + id, m);
    return J({ ct, iv: m.iv });
  }
  if (req.method !== "POST") return J({ error: "method" }, 405);
  if (await limit("p:" + ip, 12)) return J({ error: "יותר מדי העברות בשעה האחרונה" }, 429);
  const t = await req.text(); if (t.length > MAX) return J({ error: "יותר מדי נתונים להעברה בקוד. השתמשו בגיבוי לקובץ" }, 413);
  let b; try { b = JSON.parse(t); } catch (e) { return J({ error: "bad" }, 400); }
  if (typeof b.ct !== "string" || !/^[A-Za-z0-9_-]{16,}$/.test(b.ct) || typeof b.iv !== "string" || !/^[A-Za-z0-9_-]{16}$/.test(b.iv)) return J({ error: "bad" }, 400);
  let nid = ""; for (let k = 0; k < 5; k++) { nid = Array.from(crypto.getRandomValues(new Uint8Array(6)), x => CH[x % CH.length]).join(""); if (!(await st.get("m:" + nid))) break; }
  await st.set("d:" + nid, b.ct); await st.setJSON("m:" + nid, { iv: b.iv, exp: now + TTL, reads: 0 });
  return J({ id: nid, exp: now + TTL });
};
export const config = { path: ["/api/xfer", "/api/xfer/*"] };
