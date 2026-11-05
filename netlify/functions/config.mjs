/* GET /api/config — which optional live services are switched on (keys stay on the server). */
export default async () => Response.json({
  traffic: !!Netlify.env.get("TOMTOM_KEY"),
  mapillary: !!Netlify.env.get("MAPILLARY_TOKEN")
}, { headers: { "cache-control": "public, max-age=300" } });
export const config = { path: "/api/config" };
