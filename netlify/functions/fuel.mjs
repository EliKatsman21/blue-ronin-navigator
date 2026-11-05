/* Rider-verified fuel info per OSM station: "open on Shabbat?" and "has 98 / 95?".
   Each rider (anonymous client id) holds at most one vote per question; sending the same
   vote again from the app clears it ("clear"), so mistakes can be undone. */
import { getStore } from "@netlify/blobs";
const store = () => getStore({ name: "brn-fuel", consistency: "strong" });
const TTL = 120 * 864e5, MAX_RIDERS = 60;
const FIELDS = ["sat", "o98", "o95", "hours"];

/* Older records kept a list of reports; fold them into one entry per rider. */
function riders(st) {
  const v = Object.assign({}, st.v || {});
  for (const x of st.r || []) {
    const cur = v[x.c] || (v[x.c] = { ts: 0 });
    for (const f of FIELDS) if (x[f] !== null && x[f] !== undefined && (!cur[f + "_ts"] || cur[f + "_ts"] < x.ts)) { cur[f] = x[f]; cur[f + "_ts"] = x.ts; }
    cur.ts = Math.max(cur.ts, x.ts);
  }
  return v;
}
function summarize(st) {
  const now = Date.now(), s = { open: 0, closed: 0, y98: 0, n98: 0, y95: 0, last: 0, hours: null };
  let hoursTs = 0;
  for (const r of Object.values(riders(st))) {
    if (now - r.ts > TTL) continue;
    if (r.sat === "open") s.open++; else if (r.sat === "closed") s.closed++;
    if (r.o98 === true) s.y98++; else if (r.o98 === false) s.n98++;
    if (r.o95 === true) s.y95++;
    if (typeof r.hours === "string" && (r.hours_ts || 0) > hoursTs) { s.hours = r.hours; hoursTs = r.hours_ts || 0; }
    if (r.sat || typeof r.o98 === "boolean" || r.o95 === true) s.last = Math.max(s.last, r.ts);
  }
  return s.open + s.closed + s.y98 + s.n98 + s.y95 || s.hours ? s : null;
}

export default async req => {
  const s = store();
  if (req.method === "GET") {
    const all = (await s.get("all", { type: "json" })) || {};
    const out = {}; for (const [id, st] of Object.entries(all)) { const x = summarize(st); if (x) out[id] = x; }
    return Response.json(out, { headers: { "cache-control": "public, max-age=30" } });
  }
  if (req.method !== "POST") return new Response("method", { status: 405 });
  let b; try { const t = await req.text(); if (t.length > 1500) return new Response("too large", { status: 413 }); b = JSON.parse(t); } catch (e) { return new Response("bad json", { status: 400 }); }
  if (!/^[nwr]\d{1,12}$/.test(b.id || "") || !/^[a-z0-9]{8,32}$/.test(b.c || "")) return new Response("bad id", { status: 400 });
  const patch = {};
  if (["open", "closed", "clear"].includes(b.sat)) patch.sat = b.sat === "clear" ? null : b.sat;
  for (const f of ["o98", "o95"]) if (typeof b[f] === "boolean" || b[f] === "clear") patch[f] = b[f] === "clear" ? null : b[f];
  if (typeof b.hours === "string" && /^[0-9:\-–, ]{4,40}$/.test(b.hours)) patch.hours = b.hours;
  if (!Object.keys(patch).length) return new Response("empty", { status: 400 });
  const all = (await s.get("all", { type: "json" })) || {};
  const st = all[b.id] || {}; const v = riders(st); const now = Date.now();
  const me = v[b.c] || { ts: 0 };
  for (const [f, val] of Object.entries(patch)) { if (val === null) { delete me[f]; delete me[f + "_ts"]; } else { me[f] = val; me[f + "_ts"] = now; } }
  me.ts = now; v[b.c] = me;
  const keep = Object.entries(v).filter(([, r]) => now - r.ts < TTL).sort((x, y) => y[1].ts - x[1].ts).slice(0, MAX_RIDERS);
  all[b.id] = { v: Object.fromEntries(keep) };
  await s.setJSON("all", all);
  return Response.json({ ok: true, station: summarize(all[b.id]), mine: { sat: me.sat || null, o98: typeof me.o98 === "boolean" ? me.o98 : null, o95: typeof me.o95 === "boolean" ? me.o95 : null } });
};
export const config = { path: "/api/fuel" };
