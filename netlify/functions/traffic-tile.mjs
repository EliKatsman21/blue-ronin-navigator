/* Retired: the TomTom raster tiles had no data for Israel. Live traffic now comes from /api/traffic (HERE),
   drawn on the map as vector lines. Kept as a 410 so any old cached client fails fast and quietly. */
export default async () => new Response("gone", { status: 410, headers: { "cache-control": "public, max-age=86400" } });
export const config = { path: "/api/traffic-tile/:z/:x/:y" };
