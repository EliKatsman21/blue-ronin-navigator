/* OpenStreetMap layers for the north (fuel, viewpoints, speed cameras), fetched from Overpass
   and cached in Netlify Blobs so riders never wait on a busy Overpass server. */
import { getStore } from "@netlify/blobs";

/* North (Carmel to Rosh HaNikra and the Golan) and the Jerusalem hills / Judean lowlands (chapter 5). s,w,n,e */
export const BBOXES = ["32.40,34.86,33.34,35.90", "31.52,34.76,31.84,35.20", "31.74,35.30,32.40,35.62"];
const QUERY = "[out:json][timeout:90];(" + BBOXES.map(b => `node["highway"="speed_camera"](${b});nwr["amenity"="fuel"](${b});node["tourism"="viewpoint"](${b});`).join("") + ");out center tags;";
/* motorcycle garages and shops, all of Israel: roadside help is needed anywhere, not only on the chapters */
export const IL_BBOX = "29.45,34.25,33.35,35.92";
const motoQuery = `[out:json][timeout:90];(nwr["shop"="motorcycle"](${IL_BBOX});nwr["shop"="motorcycle_repair"](${IL_BBOX});nwr["service:vehicle:motorcycle"="yes"](${IL_BBOX});nwr["motorcycle:repair"="yes"](${IL_BBOX}););out center tags;`;
const cafeQuery = b => `[out:json][timeout:90];(nwr["amenity"="cafe"](${b});nwr["shop"="coffee"](${b}););out center tags;`;
const MIRRORS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter", "https://overpass.private.coffee/api/interpreter"];
export const store = () => getStore({ name: "brn-osm", consistency: "strong" });

const yes = v => v === "yes" ? true : v === "no" ? false : null;
/* coarse outline of the area riders use (Israel, the Golan, the Jordan Valley roads), lon/lat. The query boxes are
   rectangles that spill into Jordan, Egypt, Lebanon and Syria; anything outside this outline is dropped. */
const IL_POLY = [[35.10, 33.10], [35.50, 33.10], [35.53, 33.20], [35.545, 33.255], [35.565, 33.282], [35.575, 33.295], [35.84, 33.34], [35.90, 33.12], [35.84, 32.82], [35.72, 32.71], [35.66, 32.675], [35.60, 32.655], [35.585, 32.64], [35.578, 32.40], [35.555, 32.20], [35.53, 32.05], [35.56, 31.76], [35.53, 31.40], [35.44, 31.10], [35.38, 30.90], [35.17, 30.45], [35.08, 30.05], [34.96, 29.54], [34.89, 29.48], [34.27, 31.22], [34.20, 31.32], [34.47, 31.60], [34.74, 32.20], [34.88, 32.60], [34.96, 32.90], [35.07, 33.09]];
export function inIL(lat, lon) { let c = false; for (let i = 0, j = IL_POLY.length - 1; i < IL_POLY.length; j = i++) { const [xi, yi] = IL_POLY[i], [xj, yj] = IL_POLY[j]; if ((yi > lat) !== (yj > lat) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) c = !c; } return c; }
function normalize(j) {
  const t = n => n.tags || {};
  const pick = n => {
    const la = n.lat ?? (n.center && n.center.lat), lo = n.lon ?? (n.center && n.center.lon); const g = t(n);
    const o = { id: n.type[0] + n.id, lat: +la.toFixed(5), lon: +lo.toFixed(5) };
    const name = g["name:he"] || g.name; if (name) o.name = name;
    const brand = g["brand:he"] || g.brand || g.operator; if (brand) o.brand = brand;
    if (g.maxspeed) o.maxspeed = g.maxspeed;
    if (g.opening_hours) o.oh = g.opening_hours;
    const ph = g.phone || g["contact:phone"] || g["contact:mobile"]; if (ph) o.phone = String(ph).split(";")[0].trim().slice(0, 24);
    const o95 = yes(g["fuel:octane_95"]), o98 = yes(g["fuel:octane_98"]), d = yes(g["fuel:diesel"]);
    if (o95 !== null) o.o95 = o95; if (o98 !== null) o.o98 = o98; if (d !== null) o.diesel = d;
    return o;
  };
  const els = (j.elements || []).filter(n => n.lat != null || n.center).filter(n => inIL(n.lat ?? n.center.lat, n.lon ?? n.center.lon));
  return {
    ts: Date.now(),
    cams: els.filter(n => t(n).highway === "speed_camera").map(pick),
    fuel: els.filter(n => t(n).amenity === "fuel").map(pick),
    views: els.filter(n => t(n).tourism === "viewpoint").map(pick),
    cafes: els.filter(n => t(n).amenity === "cafe" || t(n).shop === "coffee").map(pick),
    moto: els.filter(n => { const g = t(n); return g.shop === "motorcycle" || g.shop === "motorcycle_repair" || g["service:vehicle:motorcycle"] === "yes" || g["motorcycle:repair"] === "yes"; })
      .map(n => { const g = t(n), o = pick(n); o.rep = g.shop === "motorcycle_repair" || g["service:motorcycle:repair"] === "yes" || g["motorcycle:repair"] === "yes" || g["service:vehicle:motorcycle"] === "yes"; if (g["service:motorcycle:tyres"] === "yes" || g["motorcycle:tyres"] === "yes") o.tyres = true; return o; })
  };
}

/* Ask every mirror at once, keep the first good answer; say why each one failed if none did. */
async function runQuery(q, timeoutMs, allowEmpty = false) {
  const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const body = "data=" + encodeURIComponent(q);
    return await Promise.any(MIRRORS.map(async u => {
      const r = await fetch(u, { method: "POST", body, signal: ctl.signal, headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": "BlueRoninNavigator/1.2 (northern Israel motorcycle navigator; netlify)" } });
      if (!r.ok) throw new Error(new URL(u).host + " " + r.status);
      const data = await r.json(); if (!data.elements || (!allowEmpty && !data.elements.length)) throw new Error(new URL(u).host + " empty");
      return data;
    }));
  } catch (e) { throw new Error((e.errors || [e]).map(x => x.name === "AbortError" ? "timeout" : x.message).join("; ")); }
  finally { clearTimeout(timer); ctl.abort(); }
}
export async function fetchOverpass(timeoutMs = 45000) { return normalize(await runQuery(QUERY, timeoutMs)); }

/* Base layers in one query, cafes one region at a time (small queries pass where one big one times out).
   If cafes fail, the previous cafes are kept. */
export async function refresh(timeoutMs = 45000) {
  const prev = await getCached().catch(() => null);
  const data = await fetchOverpass(timeoutMs);
  const cafes = []; let ok = true;
  for (const b of BBOXES) {
    try { cafes.push(...normalize(await runQuery(cafeQuery(b), Math.max(timeoutMs, 60000), true)).cafes); }
    catch (e) { ok = false; console.log("cafes", b, e.message); }
  }
  if (ok) data.cafes = cafes; else if (prev && prev.cafes) data.cafes = prev.cafes;
  try { data.moto = normalize(await runQuery(motoQuery, Math.max(timeoutMs, 60000), true)).moto; } catch (e) { console.log("moto", e.message); data.moto = (prev && prev.moto) || []; }
  await store().setJSON("v4", data);
  return data;
}
export const getCached = async () => (await store().get("v4", { type: "json" })) || (await store().get("v3", { type: "json" }));
