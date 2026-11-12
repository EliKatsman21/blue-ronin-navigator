/* GET /api/geo?q=…&at=lat,lon — address and place search for everyday navigation, through HERE Geocoding &
   Search (streets with house numbers, businesses, junctions, in Hebrew). The key stays here.
   Privacy: queries are never stored or logged and responses are not cached (a home address is personal).
   A monthly budget guard (HERE_GEO_CAP, default 9,000) keeps us inside the free allowance; over it the app
   falls back to its own search.
   Two HERE endpoints in parallel when the text looks like an address (has a number): autosuggest (businesses,
   streets, places as you type) and geocode (the exact house number). Geocode hits come first. */
import { edgeGate } from "./lib/edge.mjs";
import { opsLog, bump, usage } from "./lib/ops.mjs";
const J = (o, s = 200) => Response.json(o, { status: s, headers: { "cache-control": "no-store" } });
let used = { t: 0, n: 0 }; /* usage is counted per call; re-read the monthly total at most every 10 minutes */
const KIND = { houseNumber: "כתובת", street: "רחוב", locality: "יישוב", place: "מקום", administrativeArea: "אזור", intersection: "צומת", addressBlock: "כתובת", chainQuery: "רשת" };
export default async req => {
  const gate = edgeGate(req); if (gate) return gate;
  const key = Netlify.env.get("HERE_API_KEY"); if (!key) return J({ error: "not configured" }, 404);
  const u = new URL(req.url), q = (u.searchParams.get("q") || "").replace(/[\u0000-\u001F]/g, " ").trim().slice(0, 120);
  if (q.length < 2) return J({ items: [] });
  const at = (u.searchParams.get("at") || "").split(",").map(Number), ok = at.length === 2 && at.every(Number.isFinite) && at[0] > 29 && at[0] < 34 && at[1] > 34 && at[1] < 36.3;
  const cap = +(Netlify.env.get("HERE_GEO_CAP") || 9000);
  if (Date.now() - used.t > 10 * 6e4) used = { t: Date.now(), n: await usage("heregeo") }; else used.n++;
  if (used.n >= cap) return J({ error: "budget" }, 503);
  try {
    const pos = ok ? at.join(",") : "32.08,34.78", k = encodeURIComponent(key), qq = encodeURIComponent(q);
    const addr = /\d/.test(q) && /[\u0590-\u05FFA-Za-z]{2}/.test(q);
    const call = async (url, label) => { const r = await fetch(url, { signal: AbortSignal.timeout(6000) }); await bump("heregeo"); if (!r.ok) { await opsLog("geo", r.status >= 500 ? "error" : "warn", `HERE ${label} ${r.status}`); return null; } return r.json(); };
    const [sug, geo] = await Promise.all([
      call(`https://autosuggest.search.hereapi.com/v1/autosuggest?q=${qq}&at=${pos}&in=countryCode:ISR&lang=he&limit=8&apiKey=${k}`, "autosuggest").catch(() => null),
      addr ? call(`https://geocode.search.hereapi.com/v1/geocode?q=${qq}&at=${pos}&in=countryCode:ISR&lang=he&limit=5&apiKey=${k}`, "geocode").catch(() => null) : null
    ]);
    if (!sug && !geo) return J({ error: "upstream" }, 502);
    /* geocode first, only its confident address hits; then autosuggest; one per spot (within 25 m and same name) */
    const raw = ((geo && geo.items) || []).filter(x => !x.scoring || (x.scoring.queryScore ?? 1) >= 0.6).concat((sug && sug.items) || []);
    const items = [];
    raw.filter(x => x.position).map(x => {
      const p = (x.access && x.access[0]) || x.position, label = (x.address && x.address.label) || x.title || "";
      const title = String(x.title || label).split(",")[0].trim(), sub = label.replace(/,\s*ישראל$/, "").split(",").slice(1).join(",").replace(/\b\d{5,7}\s*/g, "").trim();
      return { name: title, sub: sub || (KIND[x.resultType] || ""), k: KIND[x.resultType] || (x.categories && x.categories[0] && x.categories[0].name) || "מקום", lat: +p.lat.toFixed(6), lon: +p.lng.toFixed(6), dist: x.distance ?? null };
    }).forEach(it => { if (!items.some(y => y.name === it.name && Math.abs(y.lat - it.lat) < 0.00025 && Math.abs(y.lon - it.lon) < 0.0003)) items.push(it); });
    return J({ items: items.slice(0, 10) });
  } catch (e) { await opsLog("geo", "warn", "HERE search failed: " + String(e.message || e).slice(0, 100)); return J({ error: "upstream" }, 502); }
};
export const config = { path: "/api/geo" };
