/* GET /api/traffic-tile/:z/:x/:y — TomTom live traffic-flow raster tiles, proxied so the key stays
   private. Netlify's CDN keeps each tile for two minutes, so a group of riders shares one fetch. */
export default async (req, context) => {
  const key = Netlify.env.get("TOMTOM_KEY");
  if (!key) return new Response("traffic not configured", { status: 404 });
  const { z, x, y } = context.params;
  if (![z, x, y].every(v => /^\d{1,6}$/.test(v)) || +z < 5 || +z > 18) return new Response("bad tile", { status: 400 });
  const dark = new URL(req.url).searchParams.get("dark") === "1";
  const r = await fetch(`https://api.tomtom.com/traffic/map/4/tile/flow/${dark ? "relative0-dark" : "relative0"}/${z}/${x}/${y}.png?key=${key}&tileSize=256&thickness=6`);
  if (!r.ok) return new Response("upstream " + r.status, { status: 502, headers: { "cache-control": "no-store" } });
  return new Response(r.body, { headers: { "content-type": "image/png", "cache-control": "public, max-age=60", "netlify-cdn-cache-control": "public, s-maxage=120, stale-while-revalidate=60" } });
};
export const config = { path: "/api/traffic-tile/:z/:x/:y" };
