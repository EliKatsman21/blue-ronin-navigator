/* OpenStreetMap layers for the north (fuel, viewpoints, speed cameras), fetched from Overpass
   and cached in Netlify Blobs so riders never wait on a busy Overpass server. */
import { getStore } from "@netlify/blobs";

export const BBOX = "32.40,34.86,33.34,35.90"; // s,w,n,e
const QUERY = `[out:json][timeout:50];(node["highway"="speed_camera"](${BBOX});nwr["amenity"="fuel"](${BBOX});node["tourism"="viewpoint"](${BBOX}););out center tags;`;
const MIRRORS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter", "https://overpass.private.coffee/api/interpreter"];
export const store = () => getStore({ name: "brn-osm", consistency: "strong" });

const yes = v => v === "yes" ? true : v === "no" ? false : null;
function normalize(j) {
  const t = n => n.tags || {};
  const pick = n => {
    const la = n.lat ?? (n.center && n.center.lat), lo = n.lon ?? (n.center && n.center.lon); const g = t(n);
    const o = { id: n.type[0] + n.id, lat: +la.toFixed(5), lon: +lo.toFixed(5) };
    const name = g["name:he"] || g.name; if (name) o.name = name;
    const brand = g["brand:he"] || g.brand || g.operator; if (brand) o.brand = brand;
    if (g.maxspeed) o.maxspeed = g.maxspeed;
    if (g.opening_hours) o.oh = g.opening_hours;
    const o95 = yes(g["fuel:octane_95"]), o98 = yes(g["fuel:octane_98"]), d = yes(g["fuel:diesel"]);
    if (o95 !== null) o.o95 = o95; if (o98 !== null) o.o98 = o98; if (d !== null) o.diesel = d;
    return o;
  };
  const els = (j.elements || []).filter(n => n.lat != null || n.center);
  return {
    ts: Date.now(),
    cams: els.filter(n => t(n).highway === "speed_camera").map(pick),
    fuel: els.filter(n => t(n).amenity === "fuel").map(pick),
    views: els.filter(n => t(n).tourism === "viewpoint").map(pick)
  };
}

/* Ask every mirror at once, keep the first good answer. */
export async function fetchOverpass(timeoutMs = 45000) {
  const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const body = "data=" + encodeURIComponent(QUERY);
    const j = await Promise.any(MIRRORS.map(async u => {
      const r = await fetch(u, { method: "POST", body, signal: ctl.signal, headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": "BlueRoninNavigator/1.1 (northern Israel motorcycle navigator)" } });
      if (!r.ok) throw new Error(u + " " + r.status);
      const data = await r.json(); if (!data.elements || !data.elements.length) throw new Error("empty");
      return data;
    }));
    return normalize(j);
  } finally { clearTimeout(timer); ctl.abort(); }
}

export async function refresh() {
  const data = await fetchOverpass();
  await store().setJSON("north", data);
  return data;
}
export const getCached = () => store().get("north", { type: "json" });
