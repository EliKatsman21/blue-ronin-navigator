/* GET /api/osm — cached north layers. Served from Netlify's CDN; refreshed daily by osm-refresh. */
import { getCached, refresh, addCafes } from "./lib/osm.mjs";
const MAX_AGE = 3 * 864e5;
const headers = { "content-type": "application/json", "cache-control": "public, max-age=900", "netlify-cdn-cache-control": "public, durable, s-maxage=3600, stale-while-revalidate=86400" };

export default async (req, context) => {
  let data = await getCached();
  if (data && !data.cafes) { try { data = await addCafes(data); } catch (e) { console.log("cafes upgrade failed", e.message); } }
  if (data && (Date.now() - data.ts > MAX_AGE || !data.cafes)) context.waitUntil(refresh().catch(e => console.log("osm bg refresh failed", e.message)));
  if (!data) {
    try { data = await refresh(); }
    catch (e) { return Response.json({ error: "overpass unavailable" }, { status: 503, headers: { "cache-control": "no-store" } }); }
  }
  return new Response(JSON.stringify(data), { headers });
};
export const config = { path: "/api/osm" };
