/* Background refresh of the OSM layers (fuel, viewpoints, cameras, cafes). Runs up to 15 minutes, so a slow
   Overpass mirror doesn't matter. Triggered by /api/osm when its cache is old or missing cafes; it refuses to
   run more than once every 10 minutes, so it can't be used to hammer Overpass. */
import { refresh, store } from "./lib/osm.mjs";
import { opsLog } from "./lib/ops.mjs";
export default async () => {
  const s = store(); const last = await s.get("lastRun", { type: "json" });
  if (last && Date.now() - last.t < 5 * 6e4) return;
  await s.setJSON("lastRun", { t: Date.now() });
  try { const d = await refresh(120000); console.log("osm refreshed", d.fuel.length, "fuel", d.cafes ? d.cafes.length : "no", "cafes"); await opsLog("osm", "info", `שכבות OSM עודכנו: ${d.fuel.length} תחנות, ${d.cafes ? d.cafes.length : 0} בתי קפה`); } catch (e) { console.log("osm refresh failed", e.message); await opsLog("osm", "error", "רענון שכבות OSM נכשל: " + e.message); }
};
