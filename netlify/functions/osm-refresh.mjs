/* Daily: pull fresh fuel stations, viewpoints and cameras for the north. 00:40 UTC = 02:40/03:40 in Israel. */
import { refresh } from "./lib/osm.mjs";
export default async () => {
  try { const d = await refresh(); console.log("osm refreshed", d.fuel.length, "fuel,", d.views.length, "views,", d.cams.length, "cams"); }
  catch (e) { console.log("osm refresh failed", e.message); }
};
export const config = { schedule: "40 0 * * *" };
