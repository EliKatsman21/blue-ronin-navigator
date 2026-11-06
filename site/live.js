/* Blue Ronin · live location viewer. Reads /api/live/<id> every 15 s (slower when hidden). No cookies, no tracking. */
(() => {
  const id = (location.hash || "").slice(1).replace(/[^A-Za-z0-9]/g, ""), $ = i => document.getElementById(i);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const fmtT = t => new Intl.DateTimeFormat("he-IL", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jerusalem" }).format(new Date(t));
  const ago = t => { const s = Math.round((Date.now() - t) / 1000); return s < 60 ? "עכשיו" : s < 3600 ? `לפני ${Math.round(s / 60)} דק׳` : `לפני ${Math.round(s / 3600)} שע׳`; };
  const map = new maplibregl.Map({ container: "map", style: "https://tiles.openfreemap.org/styles/dark", center: [35.2, 32.6], zoom: 8, attributionControl: { compact: true } });
  let meMk = null, bikeMk = null, fitted = false, timer = null, data = null;
  map.on("load", () => { map.addSource("trk", { type: "geojson", data: { type: "FeatureCollection", features: [] } }); map.addLayer({ id: "trk", type: "line", source: "trk", paint: { "line-color": "#5C8DFF", "line-width": 4, "line-opacity": .85 }, layout: { "line-cap": "round", "line-join": "round" } }); if (data) draw(data); });
  function draw(d) {
    if (!map.isStyleLoaded()) return; const pts = d.pts || [], last = pts[pts.length - 1];
    map.getSource("trk") && map.getSource("trk").setData({ type: "FeatureCollection", features: pts.length > 1 ? [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: pts.map(p => [p[0], p[1]]) } }] : [] });
    if (last) { if (!meMk) { const e = document.createElement("div"); e.className = "me"; meMk = new maplibregl.Marker({ element: e }).setLngLat([last[0], last[1]]).addTo(map); } meMk.setLngLat([last[0], last[1]]); meMk.getElement().classList.toggle("sosm", d.state === "sos");
      if (!fitted) { fitted = true; map.jumpTo({ center: [last[0], last[1]], zoom: 13.5 }); } }
    if (d.park) { if (!bikeMk) { const e = document.createElement("div"); e.className = "bike"; e.textContent = "🏍"; e.title = "האופנוע חונה כאן"; bikeMk = new maplibregl.Marker({ element: e }).addTo(map); } bikeMk.setLngLat([d.park.lon, d.park.lat]); } else if (bikeMk) { bikeMk.remove(); bikeMk = null; }
  }
  function card(d) {
    const last = d.pts && d.pts[d.pts.length - 1], age = last ? Date.now() - last[2] : Infinity, live = d.state !== "ended" && age < 120000;
    const stateTxt = d.state === "sos" ? "" : d.state === "ended" ? `השיתוף הסתיים ב־${fmtT(d.ended)}` : d.state === "stopped" ? "עצר" : last && last[3] != null && last[3] > 5 ? "ברכיבה" : "עומד";
    $("nm").textContent = d.name || "רוכב";
    $("card").innerHTML = `<h1 id="nm">${esc(d.name || "רוכב")}</h1>${d.state === "sos" ? `<div class="sos">🆘 קריאת חירום פעילה</div>` : ""}
      <div class="small"><span class="dot ${live ? "" : age < 600000 && d.state !== "ended" ? "old" : "off"}"></span>${last ? `עודכן ${ago(last[2])}` : "עוד אין מיקום"}${stateTxt ? " · " + stateTxt : ""}${d.chap ? ` · <span class="muted">${esc(d.chap)}</span>` : ""}</div>
      ${!live && d.state !== "ended" && last ? `<div class="small muted">המיקום מתעדכן כשהאפליקציה פתוחה אצל הרוכב. העדכון האחרון מוצג במפה.</div>` : ""}
      <div class="row">${last ? `<a class="btn primary" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${last[1]},${last[0]}">ניווט אליו</a><a class="btn" target="_blank" rel="noopener" href="https://waze.com/ul?ll=${last[1]},${last[0]}&navigate=yes">Waze</a>` : ""}${d.phone ? `<a class="btn" href="tel:${esc(d.phone)}">התקשרות</a>` : ""}${d.state === "sos" ? `<a class="btn red" href="tel:101">מד״א 101</a>` : ""}</div>
      ${d.park ? `<div class="small muted">🏍 האופנוע חונה מ־${fmtT(d.park.t)}</div>` : ""}`;
    document.title = (d.state === "sos" ? "🆘 " : "") + (d.name || "רוכב") + " · מיקום חי";
  }
  async function load() {
    clearTimeout(timer);
    try { const r = await fetch("/api/live/" + id, { cache: "no-store" }); const j = await r.json(); if (!r.ok) throw new Error(j.error || "השיתוף לא נמצא"); data = j; card(j); draw(j); if (j.state === "ended") return; }
    catch (e) { $("card").innerHTML = `<h1>אין מיקום להצגה</h1><div class="small muted">${esc(e.message)}. ייתכן שהשיתוף הסתיים או שהקישור לא שלם.</div>`; return; }
    timer = setTimeout(load, document.hidden ? 60000 : 15000);
  }
  document.addEventListener("visibilitychange", () => { if (!document.hidden) load(); });
  if (!id) $("card").innerHTML = `<h1>קישור לא שלם</h1>`; else load();
})();
