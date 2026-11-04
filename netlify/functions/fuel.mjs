/* Rider-verified fuel info: "open on Shabbat?" and "has 98?" votes per OSM station. */
import { getStore } from "@netlify/blobs";
const store = () => getStore({ name: "brn-fuel", consistency: "strong" });
const MAX = 12, TTL = 120 * 864e5;

function summarize(all) {
  const out = {}; const now = Date.now();
  for (const [id, st] of Object.entries(all)) {
    const r = (st.r || []).filter(x => now - x.ts < TTL); if (!r.length) continue;
    const s = { open: 0, closed: 0, y98: 0, n98: 0, y95: 0, last: 0, hours: null };
    const seen = new Set();
    for (const x of r.slice().reverse()) { if (seen.has(x.c)) continue; seen.add(x.c);
      if (x.sat === "open") s.open++; if (x.sat === "closed") s.closed++;
      if (x.o98 === true) s.y98++; if (x.o98 === false) s.n98++; if (x.o95 === true) s.y95++;
      if (!s.hours && x.hours) s.hours = x.hours; s.last = Math.max(s.last, x.ts); }
    out[id] = s;
  }
  return out;
}

export default async req => {
  const s = store();
  if (req.method === "GET") {
    const all = (await s.get("all", { type: "json" })) || {};
    return Response.json(summarize(all), { headers: { "cache-control": "public, max-age=60" } });
  }
  if (req.method !== "POST") return new Response("method", { status: 405 });
  let b; try { const t = await req.text(); if (t.length > 1500) return new Response("too large", { status: 413 }); b = JSON.parse(t); } catch (e) { return new Response("bad json", { status: 400 }); }
  if (!/^[nwr]\d{1,12}$/.test(b.id || "") || !/^[a-z0-9]{8,32}$/.test(b.c || "")) return new Response("bad id", { status: 400 });
  const rep = { ts: Date.now(), c: b.c,
    sat: ["open", "closed"].includes(b.sat) ? b.sat : null,
    o98: typeof b.o98 === "boolean" ? b.o98 : null, o95: typeof b.o95 === "boolean" ? b.o95 : null,
    hours: typeof b.hours === "string" && /^[0-9:\-–, ]{4,40}$/.test(b.hours) ? b.hours : null };
  if (!rep.sat && rep.o98 === null && rep.o95 === null && !rep.hours) return new Response("empty", { status: 400 });
  const all = (await s.get("all", { type: "json" })) || {};
  const st = all[b.id] || { r: [] }; st.r.push(rep); st.r = st.r.slice(-MAX); all[b.id] = st;
  await s.setJSON("all", all);
  return Response.json({ ok: true, station: summarize({ [b.id]: st })[b.id] || null });
};
export const config = { path: "/api/fuel" };
