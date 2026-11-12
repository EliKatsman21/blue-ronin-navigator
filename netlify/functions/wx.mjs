/* Weather proxy with a shared cache. Every rider asks us; we ask Open-Meteo once per ~20 minutes per set of
   points, so the free daily quota (counted per IP and per location) is never exhausted by app usage.
   GET /api/wx?p=lat,lon;lat,lon;...   (rounded to 2 decimals, inside Israel, at most 30 points) */
import { edgeGate } from "./lib/edge.mjs";
import { getStore } from "@netlify/blobs";
import { opsLog, bump } from "./lib/ops.mjs";
const store = () => getStore({ name: "brn-wx", consistency: "strong" });
const FRESH = 20 * 6e4, KEEP = 3 * 864e5;
const HOURLY = "temperature_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,visibility,cloud_cover";
const CURRENT = "temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_gusts_10m,precipitation";
const valid = a => Array.isArray(a) && a.length && a.every(x => x && x.hourly && Array.isArray(x.hourly.time) && x.hourly.time.length > 24);
const J = (o, status, cache) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...(cache ? { "netlify-cdn-cache-control": "public, s-maxage=900, stale-while-revalidate=1800", "cache-control": "public, max-age=300" } : {}) } });
export default async req => {
  const gate = edgeGate(req); if (gate) return gate;
  const raw = new URL(req.url).searchParams.get("p") || "";
  const pts = raw.split(";").filter(Boolean).slice(0, 31).map(s => s.split(",").map(Number)).filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b) && a > 29 && a < 33.6 && b > 34 && b < 36.2).map(([a, b]) => [+a.toFixed(2), +b.toFixed(2)]);
  if (!pts.length || pts.length > 30) return J({ error: "bad points" }, 400);
  const key = "f:" + pts.map(p => p.join(",")).join(";"), st = store(), now = Date.now();
  const cached = await st.get(key, { type: "json" }).catch(() => null);
  if (cached && now - cached.t < FRESH) return J({ t: cached.t, data: cached.data, src: "cache" }, 200, true);
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${pts.map(p => p[0]).join(",")}&longitude=${pts.map(p => p[1]).join(",")}&hourly=${HOURLY}&current=${CURRENT}&forecast_days=9&timezone=Asia%2FJerusalem&wind_speed_unit=kmh`;
    await bump("openmeteo");
    const r = await fetch(url, { headers: { "user-agent": "BlueRoninNavigator/2.3 (+https://blueronin.app)" }, signal: AbortSignal.timeout(9000) });
    const j = await r.json().catch(() => null); const arr = Array.isArray(j) ? j : j ? [j] : null;
    if (!r.ok || !valid(arr)) throw new Error((j && j.reason) || "open-meteo " + r.status);
    const data = arr.map(x => ({ hourly: x.hourly, current: x.current }));
    await st.setJSON(key, { t: now, data });
    return J({ t: now, data, src: "live" }, 200, true);
  } catch (e) {
    await opsLog("weather", cached ? "warn" : "error", "Open-Meteo: " + String(e.message || e).slice(0, 160), { stale: !!cached });
    if (cached && now - cached.t < KEEP) return J({ t: cached.t, data: cached.data, src: "stale", note: String(e.message || e).slice(0, 120) }, 200, false);
    return J({ error: String(e.message || e).slice(0, 160) }, 502);
  }
};
export const config = { path: "/api/wx" };
