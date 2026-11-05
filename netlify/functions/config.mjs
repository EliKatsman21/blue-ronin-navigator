/* GET /api/config — which optional live services are switched on (keys stay on the server).
   Traffic needs more than a key: TomTom has to actually cover Israel. As of Nov 2026 its flow data
   is empty here (tiles blank, "point too far from segment"), so we probe two busy Israeli roads and
   only switch the layer on when TomTom answers. It turns on by itself if coverage arrives. */
let probe = { ts: 0, ok: false };
async function tomtomCovers(key) {
  if (Date.now() - probe.ts < 6 * 3600e3) return probe.ok;
  const pts = [[32.0853, 34.7980], [32.7934, 35.0217]]; let ok = false;
  for (const [lat, lon] of pts) {
    try { const r = await fetch(`https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json?point=${lat},${lon}&unit=KMPH&key=${key}`); if (r.ok) { ok = true; break; } } catch (e) { }
  }
  probe = { ts: Date.now(), ok }; return ok;
}
export default async () => {
  const key = Netlify.env.get("TOMTOM_KEY");
  return Response.json({
    traffic: key ? await tomtomCovers(key) : false,
    trafficKey: !!key,
    mapillary: !!Netlify.env.get("MAPILLARY_TOKEN")
  }, { headers: { "cache-control": "public, max-age=300", "netlify-cdn-cache-control": "public, s-maxage=3600" } });
};
export const config = { path: "/api/config" };
