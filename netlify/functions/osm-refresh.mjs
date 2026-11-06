/* Daily at 00:40 UTC: hand the slow Overpass refresh to the background function (15 min budget),
   since a scheduled function gets only seconds. */
export default async () => {
  const base = Netlify.env.get("URL") || "https://blueronin-north-map.netlify.app";
  try { const r = await fetch(base + "/.netlify/functions/osm-refresh-background", { method: "POST" }); console.log("osm refresh queued", r.status); }
  catch (e) { console.log("osm refresh trigger failed", e.message); }
};
export const config = { schedule: "40 0 * * *" };
