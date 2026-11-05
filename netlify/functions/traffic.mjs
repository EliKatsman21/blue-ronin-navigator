/* GET /api/traffic?pts=lat,lon;lat,lon… (up to 30) — live speed vs free-flow speed at points along a route,
   from TomTom Flow Segment Data. Cached for three minutes at the CDN. */
const MAX = 30;
async function seg(key, lat, lon) {
  const u = `https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json?point=${lat},${lon}&unit=KMPH&openLr=false&key=${key}`;
  try {
    const r = await fetch(u); if (!r.ok) return { lat, lon, err: r.status };
    const d = (await r.json()).flowSegmentData || {};
    return { lat, lon, cur: d.currentSpeed, free: d.freeFlowSpeed, ratio: d.freeFlowSpeed ? Math.min(1.2, d.currentSpeed / d.freeFlowSpeed) : null, closed: !!d.roadClosure, conf: d.confidence, frc: d.frc };
  } catch (e) { return { lat, lon, err: "fetch" }; }
}
export default async req => {
  const key = Netlify.env.get("TOMTOM_KEY");
  if (!key) return Response.json({ error: "traffic not configured" }, { status: 404 });
  const raw = new URL(req.url).searchParams.get("pts") || "";
  const pts = raw.split(";").map(s => s.split(",").map(Number)).filter(p => p.length === 2 && p.every(Number.isFinite) && p[0] > 29 && p[0] < 34 && p[1] > 34 && p[1] < 36.2).slice(0, MAX);
  if (!pts.length) return Response.json({ error: "no points" }, { status: 400 });
  const out = new Array(pts.length); let i = 0;
  await Promise.all(Array.from({ length: 6 }, async () => { while (i < pts.length) { const k = i++; out[k] = await seg(key, pts[k][0], pts[k][1]); } }));
  return Response.json({ ts: Date.now(), pts: out }, { headers: { "cache-control": "public, max-age=60", "netlify-cdn-cache-control": "public, s-maxage=180" } });
};
export const config = { path: "/api/traffic" };
