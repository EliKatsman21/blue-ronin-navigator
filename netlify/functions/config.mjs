/* GET /api/config — which optional live services are switched on (keys stay on the server). */
export default async () => {
  const here = !!Netlify.env.get("HERE_API_KEY");
  return Response.json({ traffic: here, trafficKey: here, trafficSrc: here ? "HERE" : null, geo: here, mapillary: !!Netlify.env.get("MAPILLARY_TOKEN") },
    { headers: { "cache-control": "public, max-age=300", "netlify-cdn-cache-control": "public, s-maxage=600" } });
};
export const config = { path: "/api/config" };
