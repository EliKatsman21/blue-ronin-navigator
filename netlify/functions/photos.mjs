/* GET /api/photos?lat=&lon=&kind=view|fuel|cafe — free-licensed photos near a place.
   Street-level photos from Mapillary (when a token is set) suit fuel stations and roadside cafes;
   Wikimedia Commons suits viewpoints and landmarks. Every photo carries its author and licence. */
const UA = "BlueRoninNavigator/1.2 (motorcycle route app; netlify)";
const strip = h => String(h || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().slice(0, 80);
const hav = (a, b, c, d) => { const R = Math.PI / 180, x = Math.sin((c - a) * R / 2) ** 2 + Math.cos(a * R) * Math.cos(c * R) * Math.sin((d - b) * R / 2) ** 2; return 2 * 6371000 * Math.asin(Math.sqrt(x)); };

async function commons(lat, lon, radius) {
  const u = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=geosearch&ggscoord=${lat}%7C${lon}&ggsradius=${radius}&ggsnamespace=6&ggslimit=12&prop=imageinfo%7Ccoordinates&iiprop=url%7Cextmetadata%7Cmime&iiurlwidth=640`;
  const r = await fetch(u, { headers: { "user-agent": UA } }); if (!r.ok) return [];
  const pages = Object.values(((await r.json()).query || {}).pages || {});
  return pages.map(p => { const ii = (p.imageinfo || [])[0] || {}, m = ii.extmetadata || {}, c = (p.coordinates || [])[0];
    return { src: "commons", thumb: ii.thumburl, link: ii.descriptionurl, author: strip(m.Artist && m.Artist.value) || "Wikimedia Commons", license: strip(m.LicenseShortName && m.LicenseShortName.value), d: c ? hav(lat, lon, c.lat, c.lon) : radius, mime: ii.mime }; })
    .filter(x => x.thumb && /jpeg|png|webp/.test(x.mime || "")).sort((a, b) => a.d - b.d).slice(0, 4);
}
async function mapillary(lat, lon, token, radius) {
  const dLat = radius / 111320, dLon = radius / (111320 * Math.cos(lat * Math.PI / 180));
  const u = `https://graph.mapillary.com/images?access_token=${encodeURIComponent(token)}&fields=id,thumb_1024_url,computed_geometry,captured_at,creator&bbox=${lon - dLon},${lat - dLat},${lon + dLon},${lat + dLat}&limit=40`;
  const r = await fetch(u); if (!r.ok) return [];
  const data = ((await r.json()).data || []).filter(x => x.thumb_1024_url && x.computed_geometry);
  return data.map(x => { const [lo, la] = x.computed_geometry.coordinates; return { src: "mapillary", thumb: x.thumb_1024_url, link: `https://www.mapillary.com/app/?pKey=${x.id}`, author: (x.creator && x.creator.username) || "Mapillary", license: "CC BY-SA 4.0", d: hav(lat, lon, la, lo), ts: x.captured_at }; })
    .sort((a, b) => (a.d - b.d) || (b.ts - a.ts)).slice(0, 3);
}
export default async req => {
  const q = new URL(req.url).searchParams; const lat = +q.get("lat"), lon = +q.get("lon"), kind = q.get("kind") || "view";
  if (!(lat > 29 && lat < 34 && lon > 34 && lon < 36.2)) return Response.json({ error: "bad point" }, { status: 400 });
  const token = Netlify.env.get("MAPILLARY_TOKEN"); const street = kind === "fuel" || kind === "cafe";
  let out = [];
  try {
    const [m, c] = await Promise.all([token ? mapillary(lat, lon, token, street ? 60 : 120).catch(() => []) : [], commons(lat, lon, street ? 150 : 400).catch(() => [])]);
    out = street ? [...m, ...c] : [...c, ...m];
  } catch (e) { }
  return Response.json({ photos: out.slice(0, 4) }, { headers: { "cache-control": "public, max-age=3600", "netlify-cdn-cache-control": "public, durable, s-maxage=604800" } });
};
export const config = { path: "/api/photos" };
