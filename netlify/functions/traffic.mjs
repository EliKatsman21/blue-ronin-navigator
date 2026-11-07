/* GET /api/traffic?pts=lat,lon;lat,lon… (up to 30 points along a route)
   Live traffic from HERE Traffic API v7, which covers Israel (flow + incidents). One call per area returns
   every road segment with its live and free-flow speed, so we answer three things at once:
     pts  — speed vs free flow at each requested point (the strip in the route tab)
     segs — slow / jammed / closed road segments in the area, as lines for the map
     inc  — accidents, closures and roadworks, flagged when they sit on the route
   Shared cache (Blobs + CDN, 5 minutes) and a monthly budget guard so the free allowance is never exceeded. */
import { getStore } from "@netlify/blobs";
import { opsLog, bump, usage } from "./lib/ops.mjs";
const MAX = 30, FRESH = 5 * 6e4, STALE = 60 * 6e4;
const store = () => getStore({ name: "brn-traffic", consistency: "strong" });
const R = Math.PI / 180, hav = (a, b) => { const dLat = (b[1] - a[1]) * R, dLon = (b[0] - a[0]) * R, x = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * R) * Math.cos(b[1] * R) * Math.sin(dLon / 2) ** 2; return 12742 * Math.asin(Math.sqrt(x)); };
function segDist(p, a, b) { /* km from point p to segment a-b, local flat projection */
  const k = Math.cos(p[1] * R), ax = (a[0] - p[0]) * k, ay = a[1] - p[1], bx = (b[0] - p[0]) * k, by = b[1] - p[1], dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
  const t = L2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / L2)) : 0; const x = ax + t * dx, y = ay + t * dy; return Math.sqrt(x * x + y * y) * 111.32;
}
const lineDist = (p, line) => { let d = 1e9; for (let i = 1; i < line.length; i++) d = Math.min(d, segDist(p, line[i - 1], line[i])); return line.length === 1 ? hav(p, line[0]) : d; };
const shapeOf = loc => ((loc && loc.shape && loc.shape.links) || []).map(l => (l.points || []).map(q => [+q.lng.toFixed(5), +q.lat.toFixed(5)])).filter(l => l.length);
const INC = { accident: "תאונה", congestion: "עומס", disabledVehicle: "רכב תקוע", roadClosure: "כביש סגור", construction: "עבודות בכביש", plannedEvent: "אירוע מתוכנן", laneRestriction: "צמצום נתיבים", roadHazard: "מפגע בכביש", weather: "מזג אוויר", massTransit: "תחבורה ציבורית", other: "אירוע תנועה" };
async function here(path, bbox, key) {
  const u = `https://data.traffic.hereapi.com/v7/${path}?in=bbox:${bbox.join(",")}&locationReferencing=shape&apiKey=${encodeURIComponent(key)}` + (path === "flow" ? "&functionalClasses=1,2,3,4" : "");
  const r = await fetch(u, { signal: AbortSignal.timeout(9000) }); await bump("here");
  if (!r.ok) throw new Error(`HERE ${path} ${r.status}`);
  return (await r.json()).results || [];
}
const J = (o, s = 200, cache) => Response.json(o, { status: s, headers: cache ? { "cache-control": "public, max-age=60", "netlify-cdn-cache-control": "public, s-maxage=240, stale-while-revalidate=120" } : { "cache-control": "no-store" } });
export default async req => {
  const key = Netlify.env.get("HERE_API_KEY");
  if (!key) return J({ error: "traffic not configured" }, 404);
  const raw = new URL(req.url).searchParams.get("pts") || "";
  const pts = raw.split(";").map(s => s.split(",").map(Number)).filter(p => p.length === 2 && p.every(Number.isFinite) && p[0] > 29 && p[0] < 34 && p[1] > 34 && p[1] < 36.2).slice(0, MAX);
  if (!pts.length) return J({ error: "no points" }, 400);
  /* area = the points' box + ~3 km, snapped to 0.02° so nearby requests share a cache entry; HERE allows up to 1° per side */
  let w = Math.min(...pts.map(p => p[1])) - 0.03, e = Math.max(...pts.map(p => p[1])) + 0.03, s = Math.min(...pts.map(p => p[0])) - 0.03, n = Math.max(...pts.map(p => p[0])) + 0.03;
  const snap = (v, f) => +(f(v / 0.02) * 0.02).toFixed(2); w = snap(w, Math.floor); s = snap(s, Math.floor); e = snap(e, Math.ceil); n = snap(n, Math.ceil);
  if (e - w > 1) { const c = (e + w) / 2; w = +(c - 0.5).toFixed(2); e = +(c + 0.5).toFixed(2); }
  if (n - s > 1) { const c = (n + s) / 2; s = +(c - 0.5).toFixed(2); n = +(c + 0.5).toFixed(2); }
  const bbox = [w, s, e, n], ck = "a:" + bbox.join(","), stB = store(), now = Date.now();
  let area = await stB.get(ck, { type: "json" }).catch(() => null);
  if (!area || now - area.t > FRESH) {
    const cap = +(Netlify.env.get("HERE_MONTHLY_CAP") || 4500), used = await usage("here");
    if (used >= cap) { await opsLog("traffic", "warn", `HERE monthly budget reached (${used}/${cap}), serving cache only`); if (!area || now - area.t > STALE) return J({ error: "budget" }, 503); }
    else try {
      const [flow, inc] = await Promise.all([here("flow", bbox, key), here("incidents", bbox, key).catch(() => [])]);
      const segs = flow.map(f => { const cf = f.currentFlow || {}; return { lines: shapeOf(f.location), cur: cf.speed != null ? cf.speed * 3.6 : null, free: cf.freeFlow != null ? cf.freeFlow * 3.6 : null, jam: cf.jamFactor, closed: cf.traversability === "closed", conf: cf.confidence }; }).filter(x => x.lines.length);
      const incs = inc.map(i => { const d = i.incidentDetails || {}, lines = shapeOf(i.location), mid = lines.length ? lines[0][Math.floor(lines[0].length / 2)] : null; return mid ? { lon: mid[0], lat: mid[1], lines, type: d.type || "other", crit: d.criticality || "", closed: !!d.roadClosed, txt: (d.description && d.description.value) || (d.summary && d.summary.value) || "", until: d.endTime || "" } : null; }).filter(Boolean);
      area = { t: now, segs, incs }; await stB.setJSON(ck, area);
    } catch (err) {
      await opsLog("traffic", area ? "warn" : "error", String(err.message || err), { bbox });
      if (!area || now - area.t > STALE) return J({ error: "upstream" }, 502);
    }
  }
  /* answer for the requested points */
  const out = pts.map(([lat, lon]) => { const p = [lon, lat]; let best = null, bd = 0.12; for (const sg of area.segs) for (const l of sg.lines) { const d = lineDist(p, l); if (d < bd) { bd = d; best = sg; } }
    return best ? { lat, lon, cur: best.cur, free: best.free, ratio: best.free ? Math.min(1.2, best.cur / best.free) : null, closed: best.closed, jam: best.jam } : { lat, lon, ratio: null }; });
  const route = pts.map(p => [p[1], p[0]]), near = l => l.some(q => lineDist(q, route) < 0.6);
  const segs = area.segs.filter(sg => sg.closed || (sg.jam != null && sg.jam >= 3)).flatMap(sg => sg.lines.map(l => ({ l, j: sg.closed ? 10 : Math.round(sg.jam), c: sg.closed ? 1 : 0 }))).slice(0, 600);
  const inc = area.incs.map(i => ({ lat: i.lat, lon: i.lon, kind: INC[i.type] ? i.type : "other", label: INC[i.type] || INC.other, crit: i.crit, closed: i.closed, txt: i.txt.slice(0, 160), until: i.until, on: i.lines.some(near) })).sort((a, b) => b.on - a.on).slice(0, 40);
  return J({ ts: area.t, src: "here", pts: out, segs, inc }, 200, true);
};
export const config = { path: "/api/traffic" };
