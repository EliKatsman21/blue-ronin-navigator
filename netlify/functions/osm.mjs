/* GET /api/osm — cached north layers. Served from Netlify's CDN; refreshed daily by osm-refresh. */
import { getCached, refresh } from "./lib/osm.mjs";
const MAX_AGE = 3 * 864e5;
const headers = { "content-type": "application/json", "cache-control": "public, max-age=900", "netlify-cdn-cache-control": "public, durable, s-maxage=900, stale-while-revalidate=86400" };

export default async (req, context) => {
  let data = await getCached();
  if (data && (Date.now() - data.ts > MAX_AGE || !data.cafes)) context.waitUntil(fetch(new URL("/.netlify/functions/osm-refresh-background", req.url), { method: "POST" }).catch(e => console.log("bg trigger failed", e.message)));
  if (!data) {
    try { data = await refresh(); }
    catch (e) { return Response.json({ error: "overpass unavailable" }, { status: 503, headers: { "cache-control": "no-store" } }); }
  }
  const h = data.cafes ? headers : Object.assign({}, headers, { "netlify-cdn-cache-control": "public, s-maxage=60" });
  return new Response(JSON.stringify(data), { headers: h });
};
export const config = { path: "/api/osm" };
