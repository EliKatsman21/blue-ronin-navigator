/* Blue Ronin Navigator — app runtime */
(() => {
  "use strict";
  const { CHAPTERS, CAFES, ENF, NORTH_BOUNDS, LIVE_BOARD } = window.BRD;
  const L = window.BRL;
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const LS = {
    get(k, d) { try { const v = localStorage.getItem("brn:" + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem("brn:" + k, JSON.stringify(v)); } catch (e) { } }
  };
  const toast = (m, ms = 2600) => { const t = $("toast"); t.textContent = m; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, ms); };
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const TZ = "Asia/Jerusalem";
  const fmtT = d => new Intl.DateTimeFormat("he-IL", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TZ }).format(d);
  const fmtD = d => new Intl.DateTimeFormat("he-IL", { weekday: "long", day: "numeric", month: "long", timeZone: TZ }).format(d);
  const ago = ts => { const m = Math.round((Date.now() - ts) / 6e4); return m < 1 ? "עכשיו" : m < 60 ? `לפני ${m} דק׳` : m < 1440 ? `לפני ${Math.round(m / 60)} שע׳` : `לפני ${Math.round(m / 1440)} ימים`; };
  const lonlat = s => [s.lon, s.lat];

  /* ---------- icons ---------- */
  const IC = {
    sun: '<svg viewBox="0 0 24 24" fill="none" stroke="var(--sun)" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    part: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><circle cx="9" cy="9" r="3.5" stroke="var(--sun)"/><path d="M9 2.5v1.5M2.5 9H4M4.4 4.4l1 1M13.6 4.4l-1 1" stroke="var(--sun)"/><path d="M8 19h9a4 4 0 0 0 0-8 5 5 0 0 0-9.3 2A3 3 0 0 0 8 19z" stroke="var(--muted)"/></svg>',
    cloud: '<svg viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="2"><path d="M7 19h10a4.5 4.5 0 0 0 0-9 6 6 0 0 0-11.4 2.3A3.4 3.4 0 0 0 7 19z"/></svg>',
    fog: '<svg viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="2" stroke-linecap="round"><path d="M4 9h16M2 13h20M5 17h14M8 21h8"/></svg>',
    drizzle: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><path d="M7 15h10a4 4 0 0 0 0-8 5.5 5.5 0 0 0-10.5 2A3 3 0 0 0 7 15z" stroke="var(--muted)"/><path d="M9 18v1M13 18v1M17 18v1" stroke="var(--accent)"/></svg>',
    rain: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><path d="M7 14h10a4 4 0 0 0 0-8 5.5 5.5 0 0 0-10.5 2A3 3 0 0 0 7 14z" stroke="var(--muted)"/><path d="m8 17-1 3M12 17l-1 3M16 17l-1 3" stroke="var(--accent)"/></svg>',
    storm: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 14h10a4 4 0 0 0 0-8 5.5 5.5 0 0 0-10.5 2A3 3 0 0 0 7 14z" stroke="var(--muted)"/><path d="m12 15-2 4h3l-2 4" stroke="var(--sun)"/></svg>',
    snow: '<svg viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round"><path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9"/></svg>',
    cup: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M4 9h12v5a5 5 0 0 1-10 0z"/><path d="M16 10h2a2.5 2.5 0 0 1 0 5h-2"/></svg>',
    nav: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="m3 11 18-8-8 18-2-8z"/></svg>'
  };
  const wxIcon = code => IC[L.wmo(code).k] || IC.cloud;

  /* ---------- links ---------- */
  const wazeLL = (lat, lon) => `https://waze.com/ul?ll=${lat.toFixed(5)},${lon.toFixed(5)}&navigate=yes`;
  const wazeQ = q => `https://waze.com/ul?q=${encodeURIComponent(q)}&navigate=yes`;
  const gmLL = (lat, lon) => `https://www.google.com/maps/search/?api=1&query=${lat.toFixed(5)},${lon.toFixed(5)}`;
  const gmQ = q => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
  function gmRoute(stops) {
    let s = stops.slice();
    if (s.length > 11) { const keep = [s[0]], step = (s.length - 1) / 10; for (let i = 1; i < 10; i++) keep.push(s[Math.round(i * step)]); keep.push(s[s.length - 1]); s = keep; }
    const f = p => `${p.lat.toFixed(5)},${p.lon.toFixed(5)}`;
    const w = s.slice(1, -1).map(f).join("|");
    return `https://www.google.com/maps/dir/?api=1&origin=${f(s[0])}&destination=${f(s[s.length - 1])}${w ? "&waypoints=" + encodeURIComponent(w) : ""}&travelmode=driving`;
  }
  const stopNav = s => { const c = s.cafe && CAFES.find(x => x.id === s.cafe); return c ? { w: wazeQ(`${c.name} ${c.place}`), g: gmQ(`${c.name} ${c.place}`) } : { w: wazeLL(s.lat, s.lon), g: gmLL(s.lat, s.lon) }; };

  /* ---------- state ---------- */
  const st = {
    chap: LS.get("chap", "c1"),
    layers: Object.assign({ curves: true, glare: true, stops: true, wx: true, radar: false, cams: true, cafes: true, osmview: true, fuel: true, hillshade: true }, LS.get("layers", {})),
    shabbat: LS.get("shabbat", true),
    theme: LS.get("theme", "system"),
    routes: {}, curves: {}, cstats: {}, glare: {}, elev: {},
    wx: LS.get("wx", null), osm: LS.get("osm2", null), radar: null, crowd: LS.get("crowd", {}), api: null,
    bike: Object.assign({ range: 220, fuel: "95", name: "" }, LS.get("bike", {})), fuelFilter: LS.get("fuelFilter", { sat: true, oct: false }),
    terrain: false, ride: null, me: null, fly: null, tab: "brief",
    sat: L.nextSaturday()
  };
  if (!CHAPTERS.some(c => c.id === st.chap)) st.chap = "c1";
  const chap = () => CHAPTERS.find(c => c.id === st.chap);
  const isDark = () => st.theme === "dark" || (st.theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  function applyTheme() { if (st.theme === "system") document.documentElement.removeAttribute("data-theme"); else document.documentElement.setAttribute("data-theme", st.theme); document.querySelector('meta[name="theme-color"]').content = css("--bg") || "#0A111E"; }
  applyTheme();

  /* ---------- map ---------- */
  const OFM = "https://tiles.openfreemap.org/styles/";
  let styleName = isDark() ? "dark" : "liberty";
  try { maplibregl.setRTLTextPlugin("https://unpkg.com/@mapbox/mapbox-gl-rtl-text@0.2.3/mapbox-gl-rtl-text.min.js", true); } catch (e) { }
  const sheetPad = () => {
    if (innerWidth >= 900) return { top: 80, bottom: 40, left: 80, right: 460 };
    const sh = $("sheet").getBoundingClientRect().height || 300;
    return { top: 90, bottom: Math.min(sh + 20, innerHeight * 0.6), left: 70, right: 30 };
  };
  const map = new maplibregl.Map({
    container: "map", style: OFM + styleName, center: [35.0, 31.6], zoom: 6.2,
    maxPitch: 80, attributionControl: { compact: true }, dragRotate: true, cooperativeGestures: false
  });
  map.on("error", e => {
    const msg = String(e && e.error && (e.error.message || e.error.status) || "");
    if (!styleReady && styleName === "dark" && /style|404|Failed|fetch/i.test(msg)) { styleName = "liberty"; map.setStyle(OFM + styleName, { diff: false }); }
  });

  function firstOf(re) { const ls = map.getStyle().layers; const f = ls.find(l => re.test(l.id)); return f && f.id; }
  function firstSymbol() { const f = map.getStyle().layers.find(l => l.type === "symbol"); return f && f.id; }

  function hebrewize() {
    for (const l of map.getStyle().layers) {
      if (l.type !== "symbol" || !l.layout || !l.layout["text-field"]) continue;
      const s = JSON.stringify(l.layout["text-field"]);
      if (/ref|housenumber|ele/.test(s) || !/name/.test(s)) continue;
      try { map.setLayoutProperty(l.id, "text-field", ["coalesce", ["get", "name:he"], ["get", "name"], ["get", "name:latin"]]); } catch (e) { }
    }
  }

  const DEM = { type: "raster-dem", tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"], encoding: "terrarium", tileSize: 256, maxzoom: 13, attribution: "תבליט: Mapzen / AWS Terrain Tiles" };
  const FC = f => ({ type: "FeatureCollection", features: f || [] });

  /* Map icons drawn on canvas: a category color disc, a white glyph, and for fuel a small Shabbat-status dot. */
  const GLYPH = {
    fuel: ["M5 20V5.5A1.5 1.5 0 0 1 6.5 4h6A1.5 1.5 0 0 1 14 5.5V20", "M3.5 20h12", "M7.5 7h4v3.5h-4z", "M14 9.5h1.5a1.5 1.5 0 0 1 1.5 1.5v4.5a1.3 1.3 0 0 0 2.6 0V8.5L17 6"],
    view: ["M2.5 19 8.5 10l3.5 5 2.5-3.5 7 7.5z", "M16.5 7.2a1.8 1.8 0 1 0 .01 0"],
    cam: ["M3 8.5h11v7H3z", "M14 10.5l6-3v9l-6-3", "M6 12h.01"]
  };
  function iconImage(color, glyph, dot) {
    const px = 2, S = 30 * px, c = document.createElement("canvas"); c.width = S; c.height = S; const g = c.getContext("2d");
    g.save(); g.shadowColor = "rgba(0,0,0,.35)"; g.shadowBlur = 4 * px; g.shadowOffsetY = 1.5 * px;
    g.beginPath(); g.arc(S / 2, S / 2, 12 * px, 0, Math.PI * 2); g.fillStyle = color; g.fill(); g.restore();
    g.lineWidth = 2.2 * px; g.strokeStyle = "#fff"; g.beginPath(); g.arc(S / 2, S / 2, 12 * px, 0, Math.PI * 2); g.stroke();
    g.save(); g.translate(S / 2 - 8.4 * px, S / 2 - 8.4 * px); g.scale(0.7 * px, 0.7 * px);
    g.strokeStyle = "#fff"; g.lineWidth = 2.3; g.lineCap = "round"; g.lineJoin = "round";
    GLYPH[glyph].forEach(d => g.stroke(new Path2D(d))); g.restore();
    if (dot) { g.beginPath(); g.arc(S - 6.5 * px, 6.5 * px, 5 * px, 0, Math.PI * 2); g.fillStyle = dot; g.fill(); g.lineWidth = 2 * px; g.strokeStyle = "#fff"; g.stroke(); }
    return g.getImageData(0, 0, S, S);
  }
  function addIcons() {
    const set = (id, img) => { if (map.hasImage(id)) map.removeImage(id); map.addImage(id, img, { pixelRatio: 2 }); };
    const fuel = css("--fuel");
    set("i-fuel-open", iconImage(fuel, "fuel", css("--go")));
    set("i-fuel-closed", iconImage(fuel, "fuel", css("--no")));
    set("i-fuel-unknown", iconImage(fuel, "fuel", "#9AA5B4"));
    set("i-view", iconImage(css("--view"), "view"));
    set("i-cam", iconImage(css("--warn"), "cam"));
  }
  function setupStyle() {
    hebrewize();
    const under = firstOf(/^(tunnel|road|highway|bridge|transportation|aeroway|building)/) || firstSymbol();
    const sym = firstSymbol();
    if (!map.getSource("dem")) map.addSource("dem", DEM);
    if (!map.getSource("dem-hs")) map.addSource("dem-hs", DEM);
    map.addLayer({ id: "br-hill", type: "hillshade", source: "dem-hs", layout: { visibility: st.layers.hillshade ? "visible" : "none" }, paint: { "hillshade-exaggeration": isDark() ? 0.45 : 0.3, "hillshade-shadow-color": isDark() ? "#000814" : "#55657a", "hillshade-highlight-color": isDark() ? "#2a3a55" : "#ffffff", "hillshade-accent-color": isDark() ? "#0b1424" : "#6b7a8c" } }, under);
    ["br-route", "br-curves", "br-glare", "br-enf", "br-osm"].forEach(id => { if (!map.getSource(id)) map.addSource(id, { type: "geojson", data: FC() }); });
    const c = n => css(n);
    map.addLayer({ id: "br-enf-line", type: "line", source: "br-enf", filter: ["==", ["geometry-type"], "LineString"], paint: { "line-color": c("--warn"), "line-width": 9, "line-opacity": 0.28 }, layout: { "line-cap": "round" } }, sym);
    map.addLayer({ id: "br-route-dim", type: "line", source: "br-route", filter: ["!=", ["get", "active"], true], paint: { "line-color": c("--accent"), "line-width": 3, "line-opacity": 0.45, "line-dasharray": [2, 1.5] }, layout: { "line-cap": "round", "line-join": "round" } }, sym);
    map.addLayer({ id: "br-route-casing", type: "line", source: "br-route", filter: ["==", ["get", "active"], true], paint: { "line-color": c("--bg"), "line-width": ["interpolate", ["linear"], ["zoom"], 7, 6, 13, 11] }, layout: { "line-cap": "round", "line-join": "round" } }, sym);
    map.addLayer({ id: "br-route-solid", type: "line", source: "br-route", filter: ["==", ["get", "active"], true], paint: { "line-color": c("--accent"), "line-width": ["interpolate", ["linear"], ["zoom"], 7, 3, 13, 6] }, layout: { "line-cap": "round", "line-join": "round" } }, sym);
    map.addLayer({ id: "br-curves", type: "line", source: "br-curves", paint: { "line-color": ["match", ["get", "cls"], 0, c("--c0"), 1, c("--c1"), 2, c("--c2"), c("--c3")], "line-width": ["interpolate", ["linear"], ["zoom"], 7, 3, 13, 6] }, layout: { "line-cap": "round", "line-join": "round" } }, sym);
    map.addLayer({ id: "br-glare", type: "line", source: "br-glare", paint: { "line-color": c("--sun"), "line-width": ["interpolate", ["linear"], ["zoom"], 7, 3, 13, 5], "line-offset": ["interpolate", ["linear"], ["zoom"], 7, 6, 13, 12], "line-dasharray": [1, 1] }, layout: { "line-cap": "butt" } });
    map.addLayer({ id: "br-enf-pt", type: "circle", source: "br-enf", filter: ["==", ["geometry-type"], "Point"], paint: { "circle-radius": 7, "circle-color": c("--warn"), "circle-stroke-color": "#fff", "circle-stroke-width": 2 } });
    addIcons();
    const sz = (a, b) => ["interpolate", ["linear"], ["zoom"], 7, a, 13, b];
    map.addLayer({ id: "br-view", type: "symbol", source: "br-osm", filter: ["==", ["get", "k"], "view"], minzoom: 8.5, layout: { "icon-image": "i-view", "icon-size": sz(0.5, 0.9), "icon-allow-overlap": false, "icon-padding": 1, "symbol-sort-key": 3 } });
    map.addLayer({ id: "br-fuel", type: "symbol", source: "br-osm", filter: ["==", ["get", "k"], "fuel"], minzoom: 7.5, layout: { "icon-image": ["concat", "i-fuel-", ["coalesce", ["get", "s"], "unknown"]], "icon-size": sz(0.55, 0.95), "icon-allow-overlap": true, "symbol-sort-key": 2 } });
    map.addLayer({ id: "br-cam", type: "symbol", source: "br-osm", filter: ["==", ["get", "k"], "cam"], layout: { "icon-image": "i-cam", "icon-size": sz(0.55, 0.9), "icon-allow-overlap": true, "symbol-sort-key": 1 } });
    if (st.layers.radar) addRadarLayer();
    if (st.terrain) map.setTerrain({ source: "dem", exaggeration: 1.5 });
    pushSources(); applyLayerVis();
  }
  let styleReady = false;
  map.on("style.load", () => { styleReady = true; setupStyle(); });
  window.BR_MAP = map;

  ["br-cam", "br-view", "br-fuel", "br-enf-pt", "br-enf-line"].forEach(id => {
    map.on("click", id, e => {
      const f = e.features[0], p = f.properties; const [lon, lat] = e.lngLat.toArray ? e.lngLat.toArray() : [e.lngLat.lng, e.lngLat.lat];
      let h = "";
      if (id === "br-fuel") { const n = st.osm && st.osm.fuel.find(x => x.id === p.id); if (n) { new maplibregl.Popup({ closeButton: false, maxWidth: "290px" }).setLngLat([n.lon, n.lat]).setHTML(fuelCard(n, true)).addTo(map); bindFuelButtons(document.querySelector(".maplibregl-popup")); return; } }
      if (id === "br-cam") h = `<b>מצלמת מהירות</b><div class="small muted">OpenStreetMap${p.maxspeed ? " · מהירות " + esc(p.maxspeed) : ""}</div>`;
      else if (id.startsWith("br-enf")) h = `<b>${esc(p.name)}</b><div class="small muted">${esc(p.src)}</div>`;
      else h = `<b>${esc(p.name || (id === "br-fuel" ? "תחנת דלק" : "מצפור"))}</b><div class="small muted">${id === "br-fuel" ? esc(p.brand || "תחנת דלק") : "מצפור · OpenStreetMap"}</div><div class="row" style="margin-top:6px"><a class="btn sm" target="_blank" rel="noopener" href="${wazeLL(lat, lon)}">Waze</a><a class="btn sm" target="_blank" rel="noopener" href="${gmLL(lat, lon)}">Google</a></div>`;
      new maplibregl.Popup({ closeButton: false, maxWidth: "260px" }).setLngLat(e.lngLat).setHTML(h).addTo(map);
    });
    map.on("mouseenter", id, () => map.getCanvas().style.cursor = "pointer");
    map.on("mouseleave", id, () => map.getCanvas().style.cursor = "");
  });

  const LAYER_MAP = { curves: ["br-curves"], glare: ["br-glare"], cams: ["br-cam", "br-enf-pt", "br-enf-line"], osmview: ["br-view"], fuel: ["br-fuel"], hillshade: ["br-hill"], radar: ["br-radar"] };
  function applyLayerVis() {
    if (!styleReady) { renderMarkers(); return; }
    for (const k in LAYER_MAP) LAYER_MAP[k].forEach(id => { if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", st.layers[k] ? "visible" : "none"); });
    if (map.getLayer("br-route-solid")) map.setLayoutProperty("br-route-solid", "visibility", st.layers.curves ? "none" : "visible");
    renderMarkers();
  }
  function setSrc(id, data) { const s = map.getSource(id); if (s) s.setData(data); }
  function pushSources() {
    if (!map.getSource("br-route")) return;
    setSrc("br-route", FC(CHAPTERS.filter(c => st.routes[c.id]).map(c => ({ type: "Feature", properties: { chap: c.id, active: c.id === st.chap }, geometry: { type: "LineString", coordinates: st.routes[c.id].coords } }))));
    setSrc("br-curves", FC((st.curves[st.chap] || []).map(s => ({ type: "Feature", properties: { cls: s.cls }, geometry: { type: "LineString", coordinates: s.coords } }))));
    setSrc("br-glare", FC((st.glare[st.chap] || []).map(g => ({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: g.coords } }))));
    setSrc("br-enf", FC(ENF.map(e => ({ type: "Feature", properties: { name: e.name, src: e.src }, geometry: e.pts.length > 1 ? { type: "LineString", coordinates: e.pts.map(p => [p[1], p[0]]) } : { type: "Point", coordinates: [e.pts[0][1], e.pts[0][0]] } }))));
    const o = st.osm;
    if (o) setSrc("br-osm", FC([...o.cams.map(n => ({ type: "Feature", properties: { k: "cam", maxspeed: n.maxspeed || "" }, geometry: { type: "Point", coordinates: [n.lon, n.lat] } })), ...o.views.map(n => ({ type: "Feature", properties: { k: "view", name: n.name || "" }, geometry: { type: "Point", coordinates: [n.lon, n.lat] } })), ...o.fuel.map(n => { const f = fuelStatus(n); return { type: "Feature", properties: { k: "fuel", id: n.id, name: n.name || "", brand: n.brand || "", s: f.sat }, geometry: { type: "Point", coordinates: [n.lon, n.lat] } }; })]));
  }

  /* ---------- DOM markers ---------- */
  let mk = [];
  function renderMarkers() {
    mk.forEach(m => m.remove()); mk = [];
    let n = 0;
    if (st.layers.stops) CHAPTERS.forEach(c => c.stops.forEach((s, i) => {
      if (c.id !== st.chap) return; n = i + 1;
      const e = document.createElement("button"); e.type = "button"; e.className = `mk ${s.kind}`; e.textContent = n; e.setAttribute("aria-label", s.name);
      e.onclick = ev => { ev.stopPropagation(); stopPopup(s, n); };
      mk.push(new maplibregl.Marker({ element: e }).setLngLat(lonlat(s)).addTo(map));
    }));
    if (st.layers.cafes) CAFES.filter(c => !st.shabbat || c.shabbat === true).forEach(c => {
      const onRoute = chap().stops.some(s => s.cafe === c.id); if (onRoute && st.layers.stops) return;
      const e = document.createElement("button"); e.type = "button"; e.className = "mkc"; e.innerHTML = IC.cup; e.setAttribute("aria-label", c.name);
      e.onclick = ev => { ev.stopPropagation(); new maplibregl.Popup({ closeButton: false, maxWidth: "260px" }).setLngLat([c.lon, c.lat]).setHTML(`<b>${esc(c.name)}</b><div class="small muted">${esc(c.place)} · ${esc(c.src)}</div><div class="row" style="margin-top:6px"><a class="btn sm" target="_blank" rel="noopener" href="${wazeQ(c.name + " " + c.place)}">Waze</a><a class="btn sm" target="_blank" rel="noopener" href="${gmQ(c.name + " " + c.place)}">Google</a></div>`).addTo(map); };
      mk.push(new maplibregl.Marker({ element: e }).setLngLat([c.lon, c.lat]).addTo(map));
    });
    if (st.layers.wx && st.wx) wxPoints().forEach((p, i) => {
      const h = satHour(i, 8); if (!h) return;
      const e = document.createElement("div"); e.className = "mkw"; e.innerHTML = `${wxIcon(h.code)}${Math.round(h.t)}°`;
      mk.push(new maplibregl.Marker({ element: e, anchor: "bottom" }).setLngLat([p.lon, p.lat]).addTo(map));
    });
    if (st.me) { const e = document.createElement("div"); e.className = "me"; mk.push(new maplibregl.Marker({ element: e }).setLngLat([st.me.lon, st.me.lat]).addTo(map)); }
  }
  function stopPopup(s, n) {
    const nav = stopNav(s);
    new maplibregl.Popup({ closeButton: false, maxWidth: "280px" }).setLngLat(lonlat(s)).setHTML(`<b>${n}. ${esc(s.name)}</b><div class="small muted" style="margin:3px 0 6px">${esc(s.note)}</div><div class="row"><a class="btn sm primary" target="_blank" rel="noopener" href="${nav.w}">Waze</a><a class="btn sm" target="_blank" rel="noopener" href="${nav.g}">Google</a></div>`).addTo(map);
  }

  /* ---------- camera helpers ---------- */
  const home = (dur = 1400) => map.fitBounds(NORTH_BOUNDS, { padding: sheetPad(), pitch: 0, bearing: 0, duration: dur });
  function fitChapter(dur = 1200) {
    const r = st.routes[st.chap]; const pts = r ? r.coords : chap().stops.map(lonlat);
    const b = pts.reduce((b, p) => [[Math.min(b[0][0], p[0]), Math.min(b[0][1], p[1])], [Math.max(b[1][0], p[0]), Math.max(b[1][1], p[1])]], [[180, 90], [-180, -90]]);
    map.fitBounds(b, { padding: sheetPad(), pitch: st.terrain ? 50 : 0, bearing: 0, duration: dur });
  }

  /* ---------- routing (OSRM, cached forever) ---------- */
  async function loadRoute(c) {
    const key = "route:v3:" + c.id; const cached = LS.get(key, null);
    if (cached) return cached;
    const coords = c.stops.map(s => `${s.lon},${s.lat}`).join(";");
    try {
      const r = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&continue_straight=false`);
      const j = await r.json(); if (j.code !== "Ok") throw new Error(j.code);
      const rt = j.routes[0]; const out = { coords: rt.geometry.coordinates.map(p => [+p[0].toFixed(5), +p[1].toFixed(5)]), km: rt.distance / 1000, min: rt.duration / 60, legs: rt.legs.map(l => l.distance / 1000), real: true };
      LS.set(key, out); return out;
    } catch (e) {
      const cs = c.stops.map(lonlat); const cum = L.cumulative(cs);
      return { coords: cs, km: cum[cum.length - 1] * 1.35, min: cum[cum.length - 1] * 1.35 / 55 * 60, legs: [], real: false };
    }
  }
  const sunAt = (t, lon, lat) => { const p = SunCalc.getPosition(t, lat, lon); return { az: (p.azimuth * 180 / Math.PI + 180) % 360, alt: p.altitude * 180 / Math.PI }; };
  const departFor = c => { const s = c.stops[0]; return new Date(SunCalc.getTimes(st.sat.noonUTC, s.lat, s.lon).sunrise.getTime() + 15 * 6e4); };
  async function loadRoutes() {
    await Promise.all(CHAPTERS.map(async c => {
      const r = await loadRoute(c); st.routes[c.id] = r;
      st.curves[c.id] = L.curveSegments(r.coords); st.cstats[c.id] = L.curveStats(st.curves[c.id]);
      const cum = L.cumulative(r.coords); r.cum = cum;
      r.stopKm = c.stops.map(s => { let bi = 0, bd = 1e9; r.coords.forEach((p, i) => { const d = (p[0] - s.lon) ** 2 + (p[1] - s.lat) ** 2; if (d < bd) { bd = d; bi = i; } }); return cum[bi]; });
      st.glare[c.id] = L.glareSegments(r.coords, departFor(c), 55, sunAt);
    }));
    pushSources(); renderAll();
    if (CHAPTERS.some(c => !st.routes[c.id].real)) toast("שרת הניתוב לא זמין כרגע. מוצג מסלול משוער.");
  }

  /* ---------- elevation (Open-Meteo) ---------- */
  const climbOf = el => { let c = 0; for (let i = 1; i < el.length; i++) if (el[i] > el[i - 1]) c += el[i] - el[i - 1]; return Math.round(c); };
  async function loadElev(id) {
    if (st.elev[id]) return st.elev[id];
    const key = "elev:v2:" + id; const c = LS.get(key, null); if (c) { c.climb = climbOf(c.el); return (st.elev[id] = c); }
    const r = st.routes[id]; if (!r) return null;
    const { pts, km } = L.sample(r.coords, 100);
    try {
      const j = await (await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${pts.map(p => p[1].toFixed(4)).join(",")}&longitude=${pts.map(p => p[0].toFixed(4)).join(",")}`)).json();
      const out = { pts, km, el: j.elevation }; out.climb = climbOf(out.el); LS.set(key, out); return (st.elev[id] = out);
    } catch (e) { return null; }
  }

  /* ---------- weather (Open-Meteo, live) ---------- */
  function wxPoints() {
    const pts = [];
    CHAPTERS.forEach(c => { const s = c.stops; [s[0], s[Math.floor(s.length / 2)], s[s.length - 1]].forEach(p => pts.push({ lat: p.lat, lon: p.lon, name: p.name.split(" · ")[0], chap: c.id })); });
    pts.push({ lat: st.me ? st.me.lat : 32.651, lon: st.me ? st.me.lon : 35.105, name: st.me ? "המיקום שלך" : "יוקנעם", chap: "now" });
    return pts;
  }
  async function loadWeather(force) {
    if (!force && st.wx && Date.now() - st.wx.ts < 30 * 6e4 && st.wx.sat === st.sat.iso) { renderNow(); return; }
    const pts = wxPoints();
    const url = "https://api.open-meteo.com/v1/forecast?latitude=" + pts.map(p => p.lat.toFixed(3)).join(",") + "&longitude=" + pts.map(p => p.lon.toFixed(3)).join(",") +
      "&hourly=temperature_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,visibility,cloud_cover" +
      "&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_gusts_10m,precipitation&forecast_days=9&timezone=Asia%2FJerusalem&wind_speed_unit=kmh";
    try {
      const j = await (await fetch(url)).json(); const arr = Array.isArray(j) ? j : [j];
      st.wx = { ts: Date.now(), sat: st.sat.iso, pts: arr.map(x => ({ h: x.hourly, cur: x.current })) };
      LS.set("wx", st.wx);
    } catch (e) { if (!st.wx) toast("אין חיבור למזג האוויר. נסו שוב בעוד רגע."); }
    renderNow(); renderMarkers(); if (st.tab === "brief") renderBrief();
  }
  function satHour(i, hour) {
    const p = st.wx && st.wx.pts[i]; if (!p) return null; const iso = `${st.sat.iso}T${String(hour).padStart(2, "0")}:00`; const k = p.h.time.indexOf(iso); if (k < 0) return null;
    return { t: p.h.temperature_2m[k], code: p.h.weather_code[k], p: p.h.precipitation_probability[k], g: p.h.wind_gusts_10m[k], vis: p.h.visibility ? p.h.visibility[k] : null };
  }
  function chapterWx(cid) {
    if (!st.wx) return null; const pts = wxPoints(); const rows = [];
    pts.forEach((p, i) => { if (p.chap !== cid) return; const w = L.windowStats(st.wx.pts[i].h, `${st.sat.iso}T06:00`, `${st.sat.iso}T12:00`, `${st.sat.prevIso}T20:00`); if (w) rows.push({ p, w, i }); });
    if (!rows.length) return null;
    const agg = { tMin: Math.min(...rows.map(r => r.w.tMin)), tMax: Math.max(...rows.map(r => r.w.tMax)), maxP: Math.max(...rows.map(r => r.w.maxP)), sumMm: Math.max(...rows.map(r => r.w.sumMm)), maxGust: Math.max(...rows.map(r => r.w.maxGust)), minVis: Math.min(...rows.map(r => r.w.minVis)), wet: rows.some(r => r.w.wet), storm: rows.some(r => r.w.storm), fog: rows.some(r => r.w.fog) };
    return { rows, agg, ri: L.rideIndex(agg), code: rows[1] ? rows[1].w.code : rows[0].w.code };
  }
  function renderNow() {
    const n = st.wx && st.wx.pts[st.wx.pts.length - 1]; if (!n || !n.cur) return;
    $("nowIcon").innerHTML = wxIcon(n.cur.weather_code); $("nowTemp").textContent = Math.round(n.cur.temperature_2m) + "°";
    $("nowText").textContent = `${L.wmo(n.cur.weather_code).t} · רוח ${Math.round(n.cur.wind_speed_10m)}`;
  }

  /* ---------- OSM live layers (weekly refresh) ---------- */
  /* OSM layers: served pre-cached by our own server (/api/osm, refreshed daily) so they load in a blink.
     Overpass is only a fallback, and then all mirrors race in parallel. */
  const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);
  function normOverpass(j) {
    const t = n => n.tags || {}; const yes = v => v === "yes" ? true : v === "no" ? false : null;
    const pick = n => { const la = n.lat ?? (n.center && n.center.lat), lo = n.lon ?? (n.center && n.center.lon); const g = t(n); return { id: n.type[0] + n.id, lat: +la.toFixed(5), lon: +lo.toFixed(5), name: g["name:he"] || g.name || "", brand: g["brand:he"] || g.brand || g.operator || "", maxspeed: g.maxspeed || "", oh: g.opening_hours || "", o95: yes(g["fuel:octane_95"]), o98: yes(g["fuel:octane_98"]), diesel: yes(g["fuel:diesel"]) }; };
    const els = j.elements.filter(n => n.lat != null || n.center);
    return { ts: Date.now(), cams: els.filter(n => t(n).highway === "speed_camera").map(pick), fuel: els.filter(n => t(n).amenity === "fuel").map(pick), views: els.filter(n => t(n).tourism === "viewpoint").map(pick) };
  }
  async function fromServer() { const r = await withTimeout(fetch("/api/osm"), 9000); if (!r.ok) throw new Error(r.status); const j = await r.json(); if (!j.fuel) throw new Error("bad"); return j; }
  async function fromOverpass() {
    const bb = `${NORTH_BOUNDS[0][1]},${NORTH_BOUNDS[0][0]},${NORTH_BOUNDS[1][1]},${NORTH_BOUNDS[1][0]}`;
    const q = `[out:json][timeout:40];(node["highway"="speed_camera"](${bb});nwr["amenity"="fuel"](${bb});node["tourism"="viewpoint"](${bb}););out center tags;`;
    const ctl = new AbortController();
    try { return await withTimeout(Promise.any(["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter", "https://overpass.private.coffee/api/interpreter"].map(async ep => { const r = await fetch(ep + "?data=" + encodeURIComponent(q), { signal: ctl.signal }); if (!r.ok) throw new Error(r.status); const j = await r.json(); if (!j.elements || !j.elements.length) throw new Error("empty"); return normOverpass(j); })), 25000); }
    finally { ctl.abort(); }
  }
  let osmBusy = false;
  async function loadOSM(force) {
    const age = st.osm ? Date.now() - st.osm.ts : 1e12;
    if (!force && age < 20 * 3600e3) { pushSources(); return; }
    if (osmBusy) return; osmBusy = true;
    try {
      let d = null; try { d = await fromServer(); } catch (e) { }
      if (!d && (!st.osm || force)) { try { d = await fromOverpass(); } catch (e) { } }
      if (d) {
        d.fuel.forEach(f => { f.name = f.name || ""; f.brand = f.brand || ""; f.oh = f.oh || ""; if (f.o95 === undefined) f.o95 = null; if (f.o98 === undefined) f.o98 = null; if (f.diesel === undefined) f.diesel = null; });
        d.views.forEach(v => v.name = v.name || "");
        st.osm = d; nearCache.clear(); LS.set("osm2", st.osm); pushSources(); renderAll();
        if (force) toast(`עודכן: ${st.osm.fuel.length} תחנות דלק, ${st.osm.views.length} מצפורים, ${st.osm.cams.length} מצלמות`);
      } else if (force || !st.osm) { toast("המידע על תחנות ומצפורים לא נטען כרגע. ננסה שוב בעוד רגע."); if (!st.osm) setTimeout(() => loadOSM(), 20000); }
    } finally { osmBusy = false; }
  }
  /* Cached per route+radius: the distance scan is the heaviest thing the stops tab does. */
  const nearCache = new Map();
  function nearRoute(list, cid, maxKm) {
    const r = st.routes[cid]; if (!r || !list || !list.length) return [];
    const key = `${cid}|${maxKm}|${list === (st.osm && st.osm.fuel) ? "f" : list === (st.osm && st.osm.views) ? "v" : list === (st.osm && st.osm.cams) ? "c" : list.length}|${st.osm ? st.osm.ts : 0}|${r.coords.length}`;
    if (nearCache.has(key)) { const ids = nearCache.get(key); return ids.map(([i, d, km]) => Object.assign({ d, km }, list[i])); }
    const simp = L.simplifyByDist(r.coords, 0.15); const cum = L.cumulative(simp);
    const pad = maxKm / 100; let w = 180, so = 90, e = -180, n = -90; simp.forEach(p => { w = Math.min(w, p[0]); e = Math.max(e, p[0]); so = Math.min(so, p[1]); n = Math.max(n, p[1]); });
    const hits = [];
    list.forEach((x, i) => { if (x.lon < w - pad || x.lon > e + pad || x.lat < so - pad || x.lat > n + pad) return; let bd = 1e9, bk = 0; for (let k = 0; k < simp.length; k++) { const d = L.hav(simp[k], [x.lon, x.lat]); if (d < bd) { bd = d; bk = cum[k]; } } if (bd <= maxKm) hits.push([i, bd, bk]); });
    hits.sort((a, b) => a[2] - b[2]); nearCache.set(key, hits);
    return hits.map(([i, d, km]) => Object.assign({ d, km }, list[i]));
  }
  /* ---------- radar (RainViewer) ---------- */
  async function addRadarLayer() {
    try {
      if (!st.radar || Date.now() - st.radar.ts > 10 * 6e4) { const j = await (await fetch("https://api.rainviewer.com/public/weather-maps.json")).json(); const f = j.radar.past[j.radar.past.length - 1]; st.radar = { ts: Date.now(), url: `${j.host}${f.path}/256/{z}/{x}/{y}/2/1_1.png`, time: f.time * 1000 }; }
      if (map.getLayer("br-radar")) map.removeLayer("br-radar"); if (map.getSource("br-radar")) map.removeSource("br-radar");
      map.addSource("br-radar", { type: "raster", tiles: [st.radar.url], tileSize: 256, maxzoom: 7, attribution: "מכ״ם: RainViewer" });
      map.addLayer({ id: "br-radar", type: "raster", source: "br-radar", paint: { "raster-opacity": 0.65 } }, firstSymbol());
      toast(`מכ״ם גשם: ${fmtT(new Date(st.radar.time))}`);
    } catch (e) { toast("המכ״ם לא זמין כרגע"); st.layers.radar = false; syncLayerBoxes(); }
  }

  /* ---------- briefing ---------- */
  const gauge = (i, k) => { const col = { go: "--go", ok: "--ok", warn: "--caution", no: "--no" }[k]; const a = (i / 100) * 251.3; return `<svg class="gauge" viewBox="0 0 64 64"><circle cx="32" cy="32" r="26" fill="none" stroke="var(--line)" stroke-width="6"/><circle cx="32" cy="32" r="26" fill="none" stroke="var(${col})" stroke-width="6" stroke-linecap="round" stroke-dasharray="${a.toFixed(1)} 400" transform="rotate(-90 32 32)"/><text x="32" y="39" text-anchor="middle">${i}</text></svg>`; };
  function renderBrief() {
    const p = $("p-brief"); const satDate = st.sat.noonUTC; const t = SunCalc.getTimes(satDate, 32.651, 35.105);
    const golden = new Date(t.sunrise.getTime() + 60 * 6e4);
    let h = `<div class="brief-head"><div><div class="small muted">${st.sat.isToday ? "היום" : st.sat.daysAway === 1 ? "מחר" : `בעוד ${st.sat.daysAway} ימים`}</div><h2>${esc(fmtD(satDate))}</h2></div><button type="button" class="btn sm" id="wxRefresh">רענון</button></div>
      <div class="sunrow"><div><div class="k">זריחה</div><div class="v sun mono">${fmtT(t.sunrise)}</div></div><div><div class="k">יציאה מיוקנעם</div><div class="v mono">${fmtT(departFor(CHAPTERS[0]))}</div></div><div><div class="k">אור זהב עד</div><div class="v mono">${fmtT(golden)}</div></div></div>`;
    if (!st.wx) { h += `<p class="muted">טוען תחזית לשבת…</p>`; p.innerHTML = h; bindBrief(); return; }
    const res = CHAPTERS.map(c => ({ c, w: chapterWx(c.id) })).filter(x => x.w);
    const best = res.slice().sort((a, b) => b.w.ri.i - a.w.ri.i)[0];
    if (st.sat.daysAway > 5) h += `<div class="alert info">התחזית ל־${st.sat.daysAway} ימים עדיין רחוקה. התדריך מתעדכן אוטומטית ככל שהשבת מתקרבת.</div>`;
    h += `<div class="ccards">` + res.map(({ c, w }) => {
      const cs = st.cstats[c.id]; const isBest = best && best.c.id === c.id;
      return `<button type="button" class="ccard ${isBest ? "best" : ""}" data-chap="${c.id}">${gauge(w.ri.i, w.ri.verdict.k)}<div><div class="row" style="gap:6px"><h3>${esc(c.title)}</h3>${isBest ? '<span class="best-tag">הפרק של השבת</span>' : ""}</div><div class="verdict v-${w.ri.verdict.k}">${esc(w.ri.verdict.t)}</div><div class="why">${w.ri.why.length ? esc(w.ri.why.slice(0, 3).join(" · ")) : "בלי גשם, ערפל או רוח חריגה"}${cs ? ` · ${Math.round(cs.twisty)} ק״מ מפותלים` : ""}</div></div><div style="text-align:center">${wxIcon(w.code).replace("<svg", '<svg width="30" height="30"')}<div class="mono small" dir="ltr">${Math.round(w.agg.tMin)}°–${Math.round(w.agg.tMax)}°</div></div></button>`;
    }).join("") + `</div>`;
    const cw = chapterWx(st.chap); const ci = wxPoints().findIndex(x => x.chap === st.chap) + 1;
    if (cw) {
      h += `<div><h3 style="margin-bottom:6px">שעה אחרי שעה · ${esc(chap().title)}</h3><div class="hours">`;
      for (let hr = 5; hr <= 14; hr++) { const x = satHour(ci, hr); if (!x) continue; h += `<div class="hour"><span class="h">${String(hr).padStart(2, "0")}:00</span>${wxIcon(x.code)}<span class="t">${Math.round(x.t)}°</span><span class="p">${x.p ?? 0}%</span><span class="w">${Math.round(x.g)} קמ״ש</span></div>`; }
      h += `</div><div class="small muted">טמפ׳ · סיכוי גשם · משבי רוח, בנקודת האמצע של הפרק</div></div>`;
      const al = [];
      cw.rows.forEach(r => { const hh = st.wx.pts[r.i].h; for (let hr = 5; hr <= 10; hr++) { const k = hh.time.indexOf(`${st.sat.iso}T${String(hr).padStart(2, "0")}:00`); if (k >= 0 && hh.visibility && hh.visibility[k] < 3000) { al.push(["", `ערפל ב${r.p.name} סביב ${String(hr).padStart(2, "0")}:00 (ראות ${Math.round(hh.visibility[k] / 100) / 10} ק״מ)`]); break; } } });
      if (cw.agg.maxGust >= 40) al.push(["", `משבי רוח עד ${Math.round(cw.agg.maxGust)} קמ״ש. ברכסים ובגולן מרגישים את זה בעיקולים פתוחים.`]);
      if (cw.agg.wet) al.push(["", "ירד גשם בלילה שלפני. בבוקר הכביש עלול להיות חלק, במיוחד בצל ובירידות."]);
      const g = st.glare[st.chap] || []; if (g.length) { const long = g.slice().sort((a, b) => b.km - a.km)[0]; al.push(["sun", `סנוור שמש: ${g.length} קטעים שבהם רוכבים ישר אל שמש נמוכה, הארוך ${long.km.toFixed(1)} ק״מ סביב ${fmtT(long.at)}. ויזור כהה או מגן סנוור.`]); }
      const cams = nearRoute(st.osm && st.osm.cams, st.chap, 0.15); if (cams.length) al.push(["cam", `${cams.length} מצלמות מהירות קבועות על הפרק (OpenStreetMap). בנוסף, המשטרה פורסת ב־2026 מצלמות מהירות ממוצעת.`]);
      if (st.chap === "c3") al.push(["info", "כביש 899 צמוד לגבול לבנון. בדקו הנחיות פיקוד העורף וסגירות כבישים לפני היציאה."]);
      if (al.length) h += `<div class="alerts">${al.map(a => `<div class="alert ${a[0]}">${esc(a[1])}</div>`).join("")}</div>`;
      const gr = L.gear(cw.agg.tMin, cw.agg.tMax, cw.agg.maxP, cw.agg.fog);
      h += `<div class="card"><h3>מה לובשים</h3><div class="small muted">תחושת קור ב־80 קמ״ש בבוקר: <b class="mono">${gr.wc}°</b></div><ul class="gear">${gr.items.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>`;
    }
    h += `<div class="fresh">תחזית: Open-Meteo, עודכנה ${ago(st.wx.ts)} · מתעדכנת בכל פתיחה ובכל 30 דקות${st.osm ? ` · OSM: ${ago(st.osm.ts)}` : ""}</div>`;
    p.innerHTML = h; bindBrief();
  }
  function bindBrief() {
    const r = $("wxRefresh"); if (r) r.onclick = () => { loadWeather(true); toast("מרענן תחזית"); };
    document.querySelectorAll("#p-brief [data-chap]").forEach(b => b.onclick = () => { setChap(b.dataset.chap); setTab("route"); });
  }

  /* ---------- route pane ---------- */
  function profileSvg(e) {
    if (!e || !e.el) return `<p class="small muted">טוען פרופיל גובה…</p>`;
    const W = 360, H = 120, P = 22; const mn = Math.min(...e.el), mx = Math.max(...e.el); const rg = Math.max(50, mx - mn);
    const X = i => P + (i / (e.el.length - 1)) * (W - P - 6), Y = v => H - 16 - ((v - mn) / rg) * (H - 30);
    const line = e.el.map((v, i) => `${i ? "L" : "M"}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join(" ");
    let climb = 0; for (let i = 1; i < e.el.length; i++) if (e.el[i] > e.el[i - 1]) climb += e.el[i] - e.el[i - 1];
    e.climb = Math.round(climb);
    return `<svg class="profile" id="prof" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="פרופיל גובה"><line class="grid" x1="${P}" x2="${W - 6}" y1="${Y(mn)}" y2="${Y(mn)}"/><line class="grid" x1="${P}" x2="${W - 6}" y1="${Y(mx)}" y2="${Y(mx)}"/><path class="area" d="${line} L${X(e.el.length - 1)} ${H - 16} L${P} ${H - 16} Z"/><path class="ln" d="${line}"/><text x="2" y="${Y(mx) + 3}">${Math.round(mx)}</text><text x="2" y="${Y(mn) + 3}">${Math.round(mn)}</text><text x="${P}" y="${H - 3}">0</text><text x="${W - 40}" y="${H - 3}">${Math.round(e.km)} ק״מ</text><line id="profCur" x1="0" x2="0" y1="6" y2="${H - 16}" stroke="var(--sun)" stroke-width="1.5" visibility="hidden"/></svg>`;
  }
  const stars = n => "●".repeat(n) + "○".repeat(5 - n);
  function renderRoute() {
    const c = chap(), r = st.routes[c.id], cs = st.cstats[c.id], e = st.elev[c.id];
    let h = `<div class="chapsel">${CHAPTERS.map((x, i) => `<button type="button" data-c="${x.id}" aria-pressed="${x.id === st.chap}">פרק ${i + 1} · ${esc(x.short)}</button>`).join("")}</div>
      <div><h2>${esc(c.title)}</h2><p class="muted" style="margin:4px 0 0">${esc(c.sub)}</p></div>
      <div class="stats"><div class="stat"><div class="k">מרחק</div><div class="v">${r ? Math.round(r.km) : "--"}<span class="small"> ק״מ</span></div></div><div class="stat"><div class="k">זמן נטו</div><div class="v">${r ? `${Math.floor(r.min / 60)}:${String(Math.round(r.min % 60)).padStart(2, "0")}` : "--"}</div></div><div class="stat"><div class="k">מפותל</div><div class="v">${cs ? Math.round(cs.twisty) : "--"}<span class="small"> ק״מ</span></div></div><div class="stat"><div class="k">טיפוס</div><div class="v">${e && e.climb != null ? e.climb : "--"}<span class="small"> מ׳</span></div></div></div>`;
    if (cs) h += `<div><div class="curvebar">${cs.km.map((k, i) => `<span style="width:${(k / cs.total * 100).toFixed(1)}%;background:var(--c${i})"></span>`).join("")}</div><div class="legend" style="margin-top:6px">${L.CURVE_LABEL.map((l, i) => `<span><i style="background:var(--c${i})"></i>${l} ${Math.round(cs.km[i])}</span>`).join("")}</div></div>`;
    h += `<div id="profWrap">${profileSvg(e)}</div>`;
    h += fuelPlanCard();
    if (r && !r.real) h += `<div class="alert">המסלול משוער (שרת הניתוב לא היה זמין). הקישור לגוגל מנווט על הכבישים האמיתיים.</div>`;
    h += `<div class="row"><a class="btn primary" target="_blank" rel="noopener" href="${gmRoute(c.stops)}">${IC.nav}ניווט הפרק בגוגל</a><a class="btn" target="_blank" rel="noopener" href="${wazeLL(c.stops[0].lat, c.stops[0].lon)}">Waze לנקודת הפתיחה</a><button type="button" class="btn" id="bFly">מעוף על הפרק</button><button type="button" class="btn" id="bGpx">GPX</button></div>`;
    h += `<ol class="stops">` + c.stops.map((s, i) => { const nav = stopNav(s); const cafe = s.cafe && CAFES.find(x => x.id === s.cafe); return `<li class="stop"><span class="num ${s.kind === "view" ? "view" : s.kind === "cafe" ? "cafe" : ""}">${i + 1}</span><div><h3><button type="button" data-s="${s.id}">${esc(s.name)}</button></h3><p>${esc(s.note)}</p><div class="chips" style="margin-bottom:6px">${(s.roads || []).map(x => `<span class="chip road">${x}</span>`).join("")}${r && r.stopKm ? `<span class="chip road">ק״מ ${Math.round(r.stopKm[i])}</span>` : ""}${cafe && cafe.shabbat ? '<span class="chip sun">פתוח בשבת</span>' : ""}${s.score ? `<span class="score">עיקולים <b>${stars(s.score[0])}</b> נוף <b>${stars(s.score[1])}</b></span>` : ""}</div><div class="row"><a class="btn sm" target="_blank" rel="noopener" href="${nav.w}">Waze</a><a class="btn sm" target="_blank" rel="noopener" href="${nav.g}">Google</a></div></div></li>`; }).join("") + `</ol>`;
    $("p-route").innerHTML = h;
    $("p-route").querySelectorAll("[data-c]").forEach(b => b.onclick = () => setChap(b.dataset.c));
    $("p-route").querySelectorAll("[data-s]").forEach(b => b.onclick = () => { const s = c.stops.find(x => x.id === b.dataset.s); map.flyTo({ center: lonlat(s), zoom: 13, padding: sheetPad(), duration: 1100 }); stopPopup(s, c.stops.indexOf(s) + 1); if (innerWidth < 900) setSheet("peek"); });
    $("bFly").onclick = () => startFly(); $("bGpx").onclick = gpx; bindFuelPlan();
    if (!e) loadElev(c.id).then(x => { if (x && st.tab === "route" && st.chap === c.id) renderRoute(); });
    else bindProfile(e);
  }
  let profMk = null;
  function bindProfile(e) {
    const svg = $("prof"); if (!svg) return;
    const move = ev => { const b = svg.getBoundingClientRect(); const x = (ev.clientX - b.left) / b.width * 360; const i = Math.max(0, Math.min(e.el.length - 1, Math.round((x - 22) / (360 - 28) * (e.el.length - 1)))); const cur = $("profCur"); const px = 22 + (i / (e.el.length - 1)) * (360 - 28); cur.setAttribute("x1", px); cur.setAttribute("x2", px); cur.setAttribute("visibility", "visible");
      if (!profMk) { const d = document.createElement("div"); d.className = "me"; d.style.background = "var(--sun)"; profMk = new maplibregl.Marker({ element: d }); } profMk.setLngLat(e.pts[i]).addTo(map); };
    svg.addEventListener("pointermove", move); svg.addEventListener("pointerdown", move);
    svg.addEventListener("pointerleave", () => { $("profCur") && $("profCur").setAttribute("visibility", "hidden"); profMk && profMk.remove(); });
  }

  /* ---------- stops pane ---------- */
  function renderStops() {
    const list = CAFES.filter(c => !st.shabbat || c.shabbat === true);
    let h = `<div class="row" style="justify-content:space-between"><h2>קפה בדרך</h2><label class="toggle"><input type="checkbox" id="shab" ${st.shabbat ? "checked" : ""}> מצב שבת</label></div><p class="small muted" style="margin:0">במצב שבת מוצגים רק מקומות שמופיעים כפתוחים בשבת. שעות משתנות; כדאי לבדוק בבוקר.</p><div>` +
      list.map(c => `<div class="item"><div><b>${esc(c.name)}</b><span class="small muted">${esc(c.place)} · ${esc(c.src)}</span></div><div class="row" style="flex-wrap:nowrap"><a class="btn sm" target="_blank" rel="noopener" href="${wazeQ(c.name + " " + c.place)}">Waze</a><a class="btn sm" target="_blank" rel="noopener" href="${gmQ(c.name + " " + c.place)}">Google</a></div></div>`).join("") + `</div>`;
    const views = nearRoute(st.osm && st.osm.views, st.chap, 1.2).filter(v => v.name);
    h += `<div><h3>מצפורים לאורך ${esc(chap().title)}</h3><p class="small muted" style="margin:2px 0 4px">מתוך OpenStreetMap, עד 1.2 ק״מ מהמסלול, לפי הסדר בדרך.</p>`;
    h += views.length ? views.slice(0, 14).map(v => `<div class="item"><div><b>${esc(v.name)}</b><span class="small muted mono">ק״מ ${Math.round(v.km)} · ${Math.round(v.d * 1000)} מ׳ מהכביש</span></div><div class="row" style="flex-wrap:nowrap"><a class="btn sm" target="_blank" rel="noopener" href="${wazeLL(v.lat, v.lon)}">Waze</a><button type="button" class="btn sm" data-ll="${v.lon},${v.lat}">במפה</button></div></div>`).join("") : `<p class="small muted">${st.osm ? "לא נמצאו מצפורים עם שם ליד הפרק." : "טוען מ־OpenStreetMap…"}</p>`;
    h += `</div>`;
    h += fuelSection();
    $("p-stops").innerHTML = h;
    bindFuelSection();
    $("shab").onchange = e => { st.shabbat = e.target.checked; LS.set("shabbat", st.shabbat); renderStops(); renderMarkers(); };
    $("p-stops").querySelectorAll("[data-ll]").forEach(b => b.onclick = () => { map.flyTo({ center: b.dataset.ll.split(",").map(Number), zoom: 14, padding: sheetPad() }); if (innerWidth < 900) setSheet("peek"); });
  }

  /* ---------- fuel: Shabbat hours, 95/98, rider-verified ---------- */
  const cid = (() => { let c = LS.get("cid", null); if (!c) { c = Array.from(crypto.getRandomValues(new Uint8Array(8)), b => b.toString(16).padStart(2, "0")).join(""); LS.set("cid", c); } return c; })();
  async function loadCrowd(force) {
    if (!force && st.crowdTs && Date.now() - st.crowdTs < 5 * 6e4) return;
    try { const r = await fetch("/api/fuel", { cache: "no-store" }); if (!r.ok) throw 0; st.crowd = await r.json(); st.crowdTs = Date.now(); st.api = true; LS.set("crowd", st.crowd); pushSources(); if (st.tab === "stops" || st.tab === "route") renderTab(); }
    catch (e) { if (st.api === null) st.api = false; }
  }
  function fuelStatus(n) {
    const c = st.crowd && st.crowd[n.id]; const oh = L.saturdayHours(n.oh);
    let sat = oh.k === "open" ? "open" : oh.k === "closed" ? "closed" : "unknown", src = n.oh ? "osm" : null, hours = oh.t || null;
    if (c && (c.open || c.closed)) { sat = c.open >= c.closed ? "open" : "closed"; src = "riders"; if (c.hours) hours = c.hours; }
    const o98 = c && (c.y98 || c.n98) ? c.y98 >= c.n98 : n.o98;
    const o95 = c && c.y95 ? true : n.o95;
    return { sat, hours, src, o98, o95, diesel: n.diesel, votes: c ? c.open + c.closed + c.y98 + c.n98 : 0, last: c ? c.last : 0, inferred: oh.inferred };
  }
  const fuelOk = (f, strict) => (strict ? f.sat === "open" : f.sat !== "closed") && (st.bike.fuel === "98" ? (strict ? f.o98 === true : f.o98 !== false) : f.o95 !== false);
  function fuelAlong(cid_) {
    const list = nearRoute(st.osm && st.osm.fuel, cid_, 0.35);
    return list.map(n => { const f = fuelStatus(n); return Object.assign({}, n, f, { label: n.name || n.brand || "תחנת דלק", ok: fuelOk(f, true), okLoose: fuelOk(f, false) }); });
  }
  function satPill(f) {
    if (f.sat === "open") return `<span class="chip" style="border-color:var(--go);color:var(--go)">שבת: ${esc(f.hours === "24/7" || f.hours === "24 שעות" ? "24 שעות" : f.hours || "פתוח")}</span>`;
    if (f.sat === "closed") return `<span class="chip" style="border-color:var(--no);color:var(--no)">סגור בשבת${f.inferred ? "?" : ""}</span>`;
    return `<span class="chip">שבת: לא ידוע</span>`;
  }
  const octChips = f => [f.o95 === true ? '<span class="chip road">95</span>' : "", f.o98 === true ? '<span class="chip road" style="border-color:var(--accent);color:var(--accent)">98</span>' : f.o98 === false ? '<span class="chip road" style="text-decoration:line-through">98</span>' : "", f.diesel === true ? '<span class="chip">סולר</span>' : ""].join("");
  const srcLine = f => f.src === "riders" ? `אומת ע״י ${f.votes} רוכבים · ${ago(f.last)}` : f.src === "osm" ? "לפי OpenStreetMap" : "אין עדיין מידע. מי שעובר שם, דווחו";
  function fuelCard(n, popup) {
    const f = Object.assign({}, n, fuelStatus(n)); const label = n.name || n.brand || "תחנת דלק";
    const q = `${label} ${n.brand && n.brand !== label ? n.brand : ""} תחנת דלק`.trim();
    return `<div style="display:grid;gap:6px;min-width:220px"><div><b>${esc(label)}</b>${n.brand && n.brand !== label ? `<span class="small muted"> · ${esc(n.brand)}</span>` : ""}</div><div class="chips">${satPill(f)}${octChips(f)}</div><div class="small muted">${esc(srcLine(f))}</div>
      <div class="row"><a class="btn sm primary" target="_blank" rel="noopener" href="${wazeLL(n.lat, n.lon)}">Waze</a><a class="btn sm" target="_blank" rel="noopener" href="${gmQ(q)}">שעות בגוגל</a></div>
      ${st.api ? `<div class="row small"><span class="muted">אני כאן עכשיו:</span><button type="button" class="btn sm" data-fr="${n.id}|sat|open">פתוח בשבת</button><button type="button" class="btn sm" data-fr="${n.id}|sat|closed">סגור</button><button type="button" class="btn sm" data-fr="${n.id}|o98|1">יש 98</button><button type="button" class="btn sm" data-fr="${n.id}|o98|0">אין 98</button></div>` : ""}</div>`;
  }
  async function postFuel(id, field, val) {
    const body = { id, c: cid }; body[field] = field === "sat" ? val : val === "1";
    try {
      const r = await fetch("/api/fuel", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      if (!r.ok) throw 0; const j = await r.json(); if (j.station) st.crowd[id] = j.station; LS.set("crowd", st.crowd);
      pushSources(); renderTab(); toast("תודה! הדיווח מוצג עכשיו לכל הרוכבים");
    } catch (e) { toast("הדיווח לא נשלח. בדקו חיבור ונסו שוב"); }
  }
  function bindFuelButtons(root) { if (root) root.querySelectorAll("[data-fr]").forEach(b => b.onclick = () => { const [id, f, v] = b.dataset.fr.split("|"); b.disabled = true; postFuel(id, f, v); }); }
  function fuelSection() {
    const all = fuelAlong(st.chap); const ff = st.fuelFilter;
    const list = all.filter(f => (!ff.sat || f.sat !== "closed") && (!ff.oct || f.o98 !== false));
    let h = `<div><div class="row" style="justify-content:space-between"><h3>דלק לאורך ${esc(chap().title)}</h3></div>
      <div class="row small" style="margin:6px 0"><label class="toggle"><input type="checkbox" id="ffSat" ${ff.sat ? "checked" : ""}> בלי הסגורות בשבת</label><label class="toggle"><input type="checkbox" id="ffOct" ${ff.oct ? "checked" : ""}> רק אם יש 98</label></div>
      <div class="legend" style="margin-bottom:4px;align-items:center"><span class="small">במפה: משאבה בתכלת, והנקודה בפינה היא מצב השבת</span><span><i style="background:var(--go);width:9px;height:9px;border-radius:50%"></i>פתוח</span><span><i style="background:var(--no);width:9px;height:9px;border-radius:50%"></i>סגור</span><span><i style="background:#9AA5B4;width:9px;height:9px;border-radius:50%"></i>לא ידוע</span></div>`;
    if (!st.osm) h += `<p class="small muted">טוען תחנות מ־OpenStreetMap…</p>`;
    else if (!list.length) h += `<p class="small muted">אין תחנות שמתאימות לסינון ליד הפרק.</p>`;
    h += list.map(f => `<div class="item" style="display:block"><div class="row" style="justify-content:space-between;flex-wrap:nowrap"><div style="min-width:0"><b>${esc(f.label)}</b><span class="small muted mono">ק״מ ${Math.round(f.km)}${f.d > 0.08 ? ` · ${Math.round(f.d * 1000)} מ׳ מהכביש` : ""}</span></div><div class="row" style="flex-wrap:nowrap"><a class="btn sm" target="_blank" rel="noopener" href="${wazeLL(f.lat, f.lon)}">Waze</a><button type="button" class="btn sm" data-fx="${f.id}">פרטים</button></div></div><div class="chips" style="margin-top:4px">${satPill(f)}${octChips(f)}<span class="small muted">${esc(srcLine(f))}</span></div></div>`).join("");
    if (st.osm && st.api === false) h += `<p class="small muted">אימות רוכבים יופעל כשהשרת מחובר.</p>`;
    return h + `</div>`;
  }
  function bindFuelSection() {
    const a = $("ffSat"), b = $("ffOct"); if (!a) return;
    a.onchange = () => { st.fuelFilter.sat = a.checked; LS.set("fuelFilter", st.fuelFilter); renderStops(); };
    b.onchange = () => { st.fuelFilter.oct = b.checked; LS.set("fuelFilter", st.fuelFilter); renderStops(); };
    document.querySelectorAll("#p-stops [data-fx]").forEach(x => x.onclick = () => { const n = st.osm.fuel.find(k => k.id === x.dataset.fx); if (!n) return; map.flyTo({ center: [n.lon, n.lat], zoom: 14, padding: sheetPad() }); new maplibregl.Popup({ closeButton: false, maxWidth: "300px" }).setLngLat([n.lon, n.lat]).setHTML(fuelCard(n)).addTo(map); bindFuelButtons(document.querySelector(".maplibregl-popup")); if (innerWidth < 900) setSheet("peek"); });
  }
  function fuelPlanCard() {
    const r = st.routes[st.chap]; const b = st.bike;
    let h = `<div class="card"><div class="row" style="justify-content:space-between"><h3>תוכנית דלק לשבת</h3><span class="small muted">מתחילים עם מיכל מלא</span></div>
      <div class="row small"><label for="bkRange">טווח מיכל מלא</label><input id="bkRange" class="btn sm mono" type="number" inputmode="numeric" min="80" max="600" step="10" value="${b.range}" style="width:84px"> ק״מ
      <label for="bkFuel" style="margin-inline-start:8px">דלק</label><select id="bkFuel" class="btn sm"><option value="95">95</option><option value="98">98</option></select></div>`;
    if (!r || !st.osm) return h + `<p class="small muted" style="margin:0">מחשב…</p></div>`;
    const st8 = fuelAlong(st.chap); const total = r.km;
    const strict = L.fuelPlan(st8, total, b.range);
    if (!strict.plan.length && !strict.gap) h += `<p style="margin:0"><b style="color:var(--go)">אין צורך לתדלק בדרך.</b> <span class="muted">${Math.round(total)} ק״מ, בתוך הטווח עם רזרבה.</span></p>`;
    else {
      h += strict.plan.map(s => `<div class="item"><div><b>תדלוק: ${esc(s.label)}</b><span class="small muted mono">ק״מ ${Math.round(s.km)} · ${s.hours ? "שבת " + esc(s.hours) : "פתוח בשבת"}${s.o98 ? " · 98" : ""}</span></div><a class="btn sm primary" target="_blank" rel="noopener" href="${wazeLL(s.lat, s.lon)}">Waze</a></div>`).join("");
      if (strict.gap) {
        const loose = L.fuelPlan(st8.map(s => Object.assign({}, s, { ok: s.okLoose })), total, b.range);
        h += `<div class="alert">${strict.gap.noMore ? `מק״מ ${strict.gap.from} אין עוד תחנה מאומתת שפתוחה בשבת${b.fuel === "98" ? " עם 98" : ""}.` : `בין ק״מ ${strict.gap.from} לק״מ ${strict.gap.to} אין תחנה מאומתת פתוחה בשבת${b.fuel === "98" ? " עם 98" : ""}.`} ${loose.gap ? "גם בלי אימות אין כיסוי. כדאי לתדלק לפני היציאה." : `אפשרות: ${esc(loose.plan.map(s => s.label + " (ק״מ " + Math.round(s.km) + ")").join(", "))}, בלי אימות לשבת.`}</div>`;
      }
    }
    return h + `</div>`;
  }
  function bindFuelPlan() {
    const rg = $("bkRange"), fu = $("bkFuel"); if (!rg) return; fu.value = st.bike.fuel;
    const save = () => { st.bike.range = Math.max(80, Math.min(600, +rg.value || 220)); st.bike.fuel = fu.value; LS.set("bike", st.bike); renderRoute(); };
    rg.onchange = save; fu.onchange = save;
  }

  /* ---------- push notifications ---------- */
  const b64u = s => { const p = "=".repeat((4 - s.length % 4) % 4); const r = atob((s + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(r, c => c.charCodeAt(0)); };
  async function apiOk() { if (st.api !== null && st.vapid) return st.api; try { const r = await fetch("/api/vapid", { cache: "no-store" }); if (!r.ok) throw 0; st.vapid = (await r.json()).key; st.api = true; } catch (e) { st.api = false; } return st.api; }
  async function renderPush() {
    const box = $("pushCard"); if (!box) return;
    const head = `<h3>התראות לטלפון</h3>`;
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent); const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      box.innerHTML = head + `<p class="small muted" style="margin:0">${ios && !standalone ? "באייפון התראות עובדות רק מהאפליקציה המותקנת: שיתוף ← ״הוספה למסך הבית״, ואז פותחים מהאייקון וחוזרים לכאן." : "הדפדפן הזה לא תומך בהתראות. בכרום או בספארי המעודכן זה עובד."}</p>`; return;
    }
    if (!(await apiOk())) { box.innerHTML = head + `<p class="small muted" style="margin:0">השרת של ההתראות עוד לא מחובר לאתר. ברגע שהוא יעלה, ההפעלה תהיה כאן.</p>`; return; }
    const reg = await Promise.race([navigator.serviceWorker.ready, new Promise(r => setTimeout(() => r(null), 6000))]);
    if (!reg) { box.innerHTML = head + `<p class="small muted" style="margin:0">האפליקציה עוד לא סיימה להיטען במלואה. פתחו אותה שוב בעוד רגע.</p>`; return; }
    const sub = await reg.pushManager.getSubscription();
    const prefs = Object.assign({ friday: true, saturday: true }, LS.get("pushPrefs", {}));
    if (Notification.permission === "denied") { box.innerHTML = head + `<p class="small muted" style="margin:0">ההתראות חסומות בהגדרות הדפדפן לאתר הזה. מאפשרים שם, ואז חוזרים לכאן.</p>`; return; }
    if (!sub) {
      box.innerHTML = head + `<p class="small muted" style="margin:0">תדריך שבת בשישי אחר הצהריים: הפרק המומלץ, הציון, ערפל ורוח. ועדכון קצר בבוקר שבת לפני היציאה.</p><div class="row"><button type="button" class="btn primary" id="pushOn">הפעלת התראות</button></div>`;
      $("pushOn").onclick = async () => {
        try {
          const perm = await Notification.requestPermission(); if (perm !== "granted") { renderPush(); return; }
          const s = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64u(st.vapid) });
          const r = await fetch("/api/subscribe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sub: s.toJSON(), prefs }) });
          if (!r.ok) throw 0; toast("ההתראות פעילות"); renderPush();
        } catch (e) { toast("ההפעלה לא הצליחה. נסו שוב"); }
      };
      return;
    }
    box.innerHTML = head + `<div class="small" style="color:var(--go);font-weight:700">פעילות במכשיר הזה</div>
      <label class="toggle small"><input type="checkbox" id="ppF" ${prefs.friday ? "checked" : ""}> תדריך שבת · שישי אחר הצהריים</label>
      <label class="toggle small"><input type="checkbox" id="ppS" ${prefs.saturday ? "checked" : ""}> עדכון בוקר שבת · לפני הזריחה</label>
      <div class="row"><button type="button" class="btn" id="pushTest">שליחת התראת בדיקה</button><button type="button" class="btn" id="pushOff">כיבוי</button></div>`;
    const savePrefs = async () => { const p = { friday: $("ppF").checked, saturday: $("ppS").checked }; LS.set("pushPrefs", p); try { await fetch("/api/subscribe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sub: sub.toJSON(), prefs: p }) }); toast("נשמר"); } catch (e) { toast("לא נשמר, אין חיבור"); } };
    $("ppF").onchange = savePrefs; $("ppS").onchange = savePrefs;
    $("pushTest").onclick = async () => { try { const r = await fetch("/api/test-push", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) }); if (r.status === 404) { await fetch("/api/subscribe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sub: sub.toJSON(), prefs }) }); toast("נרשם מחדש. לחצו שוב"); return; } toast(r.ok ? "נשלחה. היא תקפוץ בעוד רגע" : "השליחה נכשלה"); } catch (e) { toast("אין חיבור לשרת"); } };
    $("pushOff").onclick = async () => { try { await fetch("/api/subscribe", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) }); } catch (e) { } await sub.unsubscribe(); toast("ההתראות כבויות"); renderPush(); };
  }

  /* ---------- tools pane ---------- */
  let installEvt = null;
  addEventListener("beforeinstallprompt", e => { e.preventDefault(); installEvt = e; if (st.tab === "tools") renderTools(); });
  function renderTools() {
    const off = LS.get("offline", null); const ios = /iphone|ipad|ipod/i.test(navigator.userAgent); const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
    let h = `<h2>כלים</h2>
    <div class="card"><h3>מפות אופליין לצפון</h3><p class="small muted" style="margin:0">מוריד את מפת הצפון עד רמת רחוב, את מסלולי שלושת הפרקים בפירוט מלא ואת התבליט. עד כ־50MB, כדאי ב־Wi-Fi.</p><div class="progress"><span id="offBar" style="width:${off ? 100 : 0}%"></span></div><div class="row"><button type="button" class="btn primary" id="offGo">${off ? "עדכון ההורדה" : "הורדה לאופליין"}</button><span class="small muted" id="offTxt">${off ? `${off.n} אריחים · ${ago(off.ts)}` : "עוד לא הורד"}</span></div></div>
    <div class="card"><h3>התקנה כאפליקציה</h3>${standalone ? '<p class="small muted" style="margin:0">האפליקציה מותקנת.</p>' : installEvt ? '<button type="button" class="btn primary" id="instGo">התקנה למסך הבית</button>' : ios ? '<p class="small muted" style="margin:0">באייפון: כפתור השיתוף בספארי ← ״הוספה למסך הבית״.</p>' : '<p class="small muted" style="margin:0">בתפריט הדפדפן: ״התקנת אפליקציה״ או ״הוספה למסך הבית״.</p>'}</div>
    <div class="card"><h3>תזכורת תדריך שבתית</h3><p class="small muted" style="margin:0">אירוע חוזר ביומן בכל שישי ב־20:00 עם קישור לתדריך. עובד ביומן גוגל, אאוטלוק ואייפון.</p><div class="row"><button type="button" class="btn" id="icsGo">הוספה ליומן</button></div></div>
    <div class="card"><h3>שיתוף ודיווח לחבר׳ה</h3><div class="row"><button type="button" class="btn" id="shareGo">שיתוף האפליקציה</button><a class="btn" target="_blank" rel="noopener" href="${LIVE_BOARD}">לוח הדיווחים החי</a></div>
      <label for="repType" class="small muted">דיווח מהיר מהמיקום שלך לוואטסאפ</label><div class="row"><select id="repType" class="btn"><option>ניידת / ממל״ז</option><option>מצלמה ניידת / לייזר</option><option>חצץ או שמן על הכביש</option><option>עבודות / חסימה</option><option>כביש סגור</option><option>נקודת עצירה מומלצת</option></select><button type="button" class="btn primary" id="repGo">שליחה</button></div></div>
    <div class="card" id="pushCard"><h3>התראות לטלפון</h3><p class="small muted" style="margin:0">טוען…</p></div>
    <div class="card"><h3>תצוגה ונתונים</h3><div class="row"><label for="themeSel" class="small muted">ערכת צבע</label><select id="themeSel" class="btn"><option value="system">לפי המכשיר</option><option value="dark">לילה</option><option value="light">יום</option></select></div><div class="row"><button type="button" class="btn" id="refAll">רענון כל הנתונים</button></div><p class="small muted" style="margin:0">מזג אוויר: ${st.wx ? ago(st.wx.ts) : "—"} · OSM: ${st.osm ? ago(st.osm.ts) : "—"} · מסלולים: OSRM, נשמרים במכשיר</p></div>
    <div class="small muted">מפה: OpenFreeMap ו־OpenStreetMap (ODbL) · מזג אוויר וגבהים: Open-Meteo (CC BY 4.0) · מכ״ם: RainViewer · ניתוב: OSRM · תבליט: Mapzen/AWS · שקיעה וזריחה: SunCalc. בתי קפה: טיולי, mako, מעריב. אכיפה: וואלה (2012), ynetnews (2026).</div>`;
    $("p-tools").innerHTML = h;
    $("offGo").onclick = downloadOffline;
    if ($("instGo")) $("instGo").onclick = async () => { installEvt.prompt(); await installEvt.userChoice; installEvt = null; renderTools(); };
    $("icsGo").onclick = ics; $("shareGo").onclick = share; $("repGo").onclick = report; renderPush();
    $("themeSel").value = st.theme; $("themeSel").onchange = e => { st.theme = e.target.value; LS.set("theme", st.theme); applyTheme(); const want = isDark() ? "dark" : "liberty"; if (want !== styleName) { styleName = want; styleReady = false; map.setStyle(OFM + styleName, { diff: false }); } };
    $("refAll").onclick = () => { loadWeather(true); loadOSM(true); loadCrowd(true); };
  }
  function saveFile(name, text, type) { const b = new Blob([text], { type }); const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); }
  function gpx() {
    const c = chap(), r = st.routes[c.id]; const x = esc;
    let g = `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Blue Ronin Navigator" xmlns="http://www.topografix.com/GPX/1/1">\n<metadata><name>${x("Blue Ronin · " + c.title)}</name></metadata>\n`;
    c.stops.forEach((s, i) => g += `<wpt lat="${s.lat}" lon="${s.lon}"><name>${x(i + 1 + ". " + s.name)}</name><desc>${x(s.note)}</desc></wpt>\n`);
    CAFES.filter(k => k.shabbat).forEach(k => g += `<wpt lat="${k.lat}" lon="${k.lon}"><name>${x("קפה: " + k.name)}</name><desc>${x(k.place)}</desc></wpt>\n`);
    const pts = r ? L.simplifyByDist(r.coords, 0.03) : c.stops.map(lonlat);
    g += `<trk><name>${x(c.title)}</name><trkseg>\n${pts.map(p => `<trkpt lat="${p[1]}" lon="${p[0]}"/>`).join("\n")}\n</trkseg></trk>\n</gpx>\n`;
    saveFile(`blue-ronin-${c.id}.gpx`, g, "application/gpx+xml"); toast("קובץ GPX נשמר. ייבוא ל־OsmAnd או Organic Maps.");
  }
  function ics() {
    const url = location.href.split("#")[0];
    const s = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Blue Ronin//HE", "BEGIN:VEVENT", `UID:blue-ronin-brief@${location.host || "app"}`, "DTSTAMP:20261104T120000Z", "DTSTART;TZID=Asia/Jerusalem:20261106T200000", "DURATION:PT15M", "RRULE:FREQ=WEEKLY;BYDAY=FR", "SUMMARY:Blue Ronin · תדריך שבת", `DESCRIPTION:מזג אוויר\\, ערפל\\, סנוור ופרק מומלץ לשבת: ${url}`, `URL:${url}`, "BEGIN:VALARM", "TRIGGER:PT0M", "ACTION:DISPLAY", "DESCRIPTION:תדריך שבת", "END:VALARM", "END:VEVENT", "END:VCALENDAR"].join("\r\n");
    saveFile("blue-ronin-shabbat.ics", s, "text/calendar"); toast("פתחו את הקובץ כדי להוסיף ליומן");
  }
  async function share() { const d = { title: "Blue Ronin Navigator", text: "מסלולי אופנוע לצפון עם תדריך שבת חי", url: location.href.split("#")[0] }; try { if (navigator.share) await navigator.share(d); else { await navigator.clipboard.writeText(d.url); toast("הקישור הועתק"); } } catch (e) { } }
  function report() {
    const type = $("repType").value;
    const send = (lat, lon, src) => { const txt = `Blue Ronin · ${type}\n${src}\nWaze: https://waze.com/ul?ll=${lat.toFixed(5)},${lon.toFixed(5)}\n${new Intl.DateTimeFormat("he-IL", { hour: "2-digit", minute: "2-digit", timeZone: TZ }).format(new Date())}`; const u = "https://wa.me/?text=" + encodeURIComponent(txt); const w = window.open(u, "_blank"); if (!w) location.href = u; };
    if (navigator.geolocation) navigator.geolocation.getCurrentPosition(p => send(p.coords.latitude, p.coords.longitude, "מהמיקום שלי"), () => { const c = map.getCenter(); send(c.lat, c.lng, "מרכז המפה"); }, { timeout: 6000, enableHighAccuracy: true });
    else { const c = map.getCenter(); send(c.lat, c.lng, "מרכז המפה"); }
  }

  /* ---------- offline download ---------- */
  async function downloadOffline() {
    if (!("caches" in window)) { toast("הדפדפן לא תומך בשמירה אופליין"); return; }
    const btn = $("offGo"); btn.disabled = true; $("offTxt").textContent = "מכין רשימה…";
    try {
      const style = map.getStyle(); const urls = new Set();
      const vsrc = Object.values(style.sources).find(s => s.type === "vector" && (s.url || s.tiles));
      let tpl = vsrc.tiles && vsrc.tiles[0];
      if (!tpl && vsrc.url) { const tj = await (await fetch(vsrc.url)).json(); tpl = tj.tiles[0]; urls.add(vsrc.url); }
      const add = (t, list) => list.forEach(([z, x, y]) => urls.add(t.replace("{z}", z).replace("{x}", x).replace("{y}", y)));
      for (let z = 5; z <= 13; z++) add(tpl, L.tilesForBbox(NORTH_BOUNDS, z));
      CHAPTERS.forEach(c => { const r = st.routes[c.id]; if (r) { const s = L.simplifyByDist(r.coords, 0.5); add(tpl, L.tilesAlong(s, 14, 1)); } });
      for (let z = 7; z <= 11; z++) add(DEM.tiles[0], L.tilesForBbox(NORTH_BOUNDS, z));
      urls.add(OFM + styleName);
      if (style.sprite) { const sp = typeof style.sprite === "string" ? [style.sprite] : style.sprite.map(s => s.url); sp.forEach(u => ["", "@2x"].forEach(r => { urls.add(u + r + ".json"); urls.add(u + r + ".png"); })); }
      if (style.glyphs) { const fonts = new Set(); style.layers.forEach(l => { const f = l.layout && l.layout["text-font"]; if (Array.isArray(f) && typeof f[0] === "string") fonts.add(f.join(",")); }); fonts.forEach(f => ["0-255", "256-511", "1280-1535", "8192-8447"].forEach(r => urls.add(style.glyphs.replace("{fontstack}", encodeURIComponent(f)).replace("{range}", r)))); }
      const list = [...urls]; const cache = await caches.open("brn-tiles-v1"); let done = 0, ok = 0;
      const worker = async () => { while (list.length) { const u = list.pop(); try { if (!(await cache.match(u))) { const r = await fetch(u, { mode: "cors" }); if (r.ok) { await cache.put(u, r); ok++; } } else ok++; } catch (e) { } done++; if (done % 20 === 0 || !list.length) { $("offBar").style.width = (done / urls.size * 100).toFixed(1) + "%"; $("offTxt").textContent = `${done} / ${urls.size}`; } } };
      await Promise.all(Array.from({ length: 4 }, worker));
      LS.set("offline", { ts: Date.now(), n: ok }); $("offTxt").textContent = `${ok} אריחים נשמרו`; toast("הצפון שמור במכשיר. המפה תעבוד גם בלי קליטה.");
    } catch (e) { toast("ההורדה נעצרה. נסו שוב עם חיבור יציב."); }
    btn.disabled = false;
  }

  /* ---------- fly-through ---------- */
  function startFly() {
    if (st.fly) return stopFly();
    const r = st.routes[st.chap]; if (!r) return;
    const c = L.simplifyByDist(r.coords, 0.05); const cum = L.cumulative(c); const total = cum[cum.length - 1];
    const dur = Math.max(25, Math.min(75, total * 0.35)) * 1000;
    if (!st.terrain) toggle3d(true);
    if (innerWidth < 900) setSheet("peek");
    let t0 = null, b = map.getBearing();
    $("fFly").setAttribute("aria-pressed", "true");
    const step = ts => {
      if (!st.fly) return; if (t0 === null) t0 = ts; const f = Math.min(1, (ts - t0) / dur); const km = f * total;
      const pos = L.pointAt(c, cum, km), ahead = L.pointAt(c, cum, Math.min(total, km + 1.5));
      const target = L.bearing(pos, ahead); let d = ((target - b + 540) % 360) - 180; b = (b + d * 0.06 + 360) % 360;
      map.jumpTo({ center: pos, bearing: b, pitch: 64, zoom: 12.6 });
      if (f < 1) st.fly = requestAnimationFrame(step); else stopFly(true);
    };
    st.fly = requestAnimationFrame(step);
    ["mousedown", "touchstart", "wheel"].forEach(ev => map.getCanvas().addEventListener(ev, stopFlyOnce, { once: true, passive: true }));
  }
  const stopFlyOnce = () => stopFly();
  function stopFly(done) { if (st.fly) cancelAnimationFrame(st.fly); st.fly = null; $("fFly").setAttribute("aria-pressed", "false"); if (done) fitChapter(1600); }

  /* ---------- 3D ---------- */
  function toggle3d(on) {
    st.terrain = on ?? !st.terrain; $("f3d").setAttribute("aria-pressed", String(st.terrain));
    if (st.terrain) { map.setTerrain({ source: "dem", exaggeration: 1.5 }); map.easeTo({ pitch: 58, duration: 900 }); }
    else { map.setTerrain(null); map.easeTo({ pitch: 0, duration: 700 }); }
  }

  /* ---------- locate + ride mode ---------- */
  function locate() {
    if (!navigator.geolocation) return toast("אין גישה למיקום במכשיר הזה");
    navigator.geolocation.getCurrentPosition(p => { st.me = { lat: p.coords.latitude, lon: p.coords.longitude }; renderMarkers(); map.flyTo({ center: [st.me.lon, st.me.lat], zoom: 12.5, padding: sheetPad() }); }, () => toast("לא התקבלה הרשאת מיקום"), { enableHighAccuracy: true, timeout: 8000 });
  }
  async function startRide() {
    if (st.ride) return stopRide();
    if (!navigator.geolocation) return toast("מצב רכיבה צריך גישה למיקום");
    const r = st.routes[st.chap]; if (!r) return;
    const simp = L.simplifyByDist(r.coords, 0.03); const cum = L.cumulative(simp);
    st.ride = { simp, cum, last: null, alerted: new Set(), lock: null, odo: 0, lowWarned: false };
    try { st.ride.lock = await navigator.wakeLock.request("screen"); } catch (e) { }
    document.body.classList.add("riding"); $("hud").hidden = false; $("fRide").setAttribute("aria-pressed", "true");
    if (!st.terrain) toggle3d(true);
    st.ride.watch = navigator.geolocation.watchPosition(onPos, () => toast("אין אות GPS"), { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 });
  }
  function stopRide() {
    if (!st.ride) return; navigator.geolocation.clearWatch(st.ride.watch); try { st.ride.lock && st.ride.lock.release(); } catch (e) { }
    st.ride = null; document.body.classList.remove("riding"); $("hud").hidden = true; $("fRide").setAttribute("aria-pressed", "false"); fitChapter();
  }
  function onPos(p) {
    const R = st.ride; if (!R) return; const me = [p.coords.longitude, p.coords.latitude]; st.me = { lat: me[1], lon: me[0] };
    let spd = p.coords.speed != null && p.coords.speed >= 0 ? p.coords.speed * 3.6 : null;
    if (spd == null && R.last) { const dt = (p.timestamp - R.last.t) / 3600e3; if (dt > 0) spd = L.hav(R.last.p, me) / dt; }
    let head = p.coords.heading; if ((head == null || isNaN(head)) && R.last && L.hav(R.last.p, me) > 0.01) head = L.bearing(R.last.p, me);
    if (R.last) { const step = L.hav(R.last.p, me); if (step < 1.5) R.odo += step; }
    R.last = { p: me, t: p.timestamp };
    $("hudSpeed").textContent = spd != null ? Math.round(spd) : "--";
    let bi = 0, bd = 1e9; R.simp.forEach((q, i) => { const d = L.hav(q, me); if (d < bd) { bd = d; bi = i; } }); const myKm = R.cum[bi];
    const r = st.routes[st.chap]; const stops = chap().stops;
    const ni = r.stopKm.findIndex(k => k > myKm + 0.08);
    if (ni >= 0) { $("hudNext").textContent = stops[ni].name.split(" · ")[0]; $("hudDist").textContent = `${(r.stopKm[ni] - myKm).toFixed(1)} ק״מ`; } else { $("hudNext").textContent = "סוף הפרק"; $("hudDist").textContent = ""; }
    let msg = null, cls = "";
    const cams = (st.osm ? st.osm.cams : []).concat(ENF.map(e => ({ lat: e.pts[0][0], lon: e.pts[0][1], id: e.name })));
    for (const c of cams) { const d = L.hav(me, [c.lon, c.lat]); if (d < 0.7 && (head == null || L.angDiff(head, L.bearing(me, [c.lon, c.lat])) < 50)) { msg = `מצלמה בעוד ${Math.round(d * 1000)} מ׳`; cls = "cam"; const id = c.id || `${c.lat},${c.lon}`; if (!R.alerted.has(id)) { R.alerted.add(id); try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch (e) { } } break; } }
    const left = st.bike.range - R.odo;
    if (!msg && left < 60) { const nxt = fuelAlong(st.chap).find(f => f.km > myKm && f.ok); msg = nxt ? `דלק: נשארו כ־${Math.max(0, Math.round(left))} ק״מ. ${nxt.label} בעוד ${(nxt.km - myKm).toFixed(1)} ק״מ` : `דלק: נשארו כ־${Math.max(0, Math.round(left))} ק״מ`; cls = "cam"; if (!R.lowWarned) { R.lowWarned = true; try { navigator.vibrate && navigator.vibrate([400]); } catch (e) { } } }
    if (!msg && bd > 0.5) { msg = `מחוץ למסלול, ${bd.toFixed(1)} ק״מ מהפרק`; }
    if (!msg) { const seg = (st.curves[st.chap] || []).find(s => s.cls >= 2 && s.startKm > myKm && s.startKm - myKm < 1.6); if (seg) { msg = `${L.CURVE_LABEL[seg.cls]} בעוד ${(seg.startKm - myKm).toFixed(1)} ק״מ`; cls = "curve"; } }
    const m = $("hudMsg"); m.hidden = !msg; if (msg) { m.textContent = msg; m.className = "hudmsg " + cls; }
    map.easeTo({ center: me, bearing: head != null && !isNaN(head) ? head : map.getBearing(), pitch: 55, zoom: 15, duration: 900, padding: { top: 80, bottom: 220, left: 20, right: 20 } });
  }

  /* ---------- sheet / tabs ---------- */
  /* Bottom sheet (phone): three explicit sizes in a segmented control, plus drag on the header. */
  const HINT = { peek: "פתיחת הלוח ←", half: "גררו או בחרו גודל", full: "חזרה למפה ←" };
  function setSheet(mode) {
    const s = $("sheet"); s.classList.remove("peek", "full"); s.style.height = ""; document.body.classList.remove("sheet-peek", "sheet-full");
    if (mode !== "half") { s.classList.add(mode); document.body.classList.add("sheet-" + mode); }
    st.sheet = mode; document.querySelectorAll(".sz").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.size === mode)));
    const h = $("sheetHint"); if (h) h.textContent = HINT[mode];
    if (mode !== "peek") closeLayers();
  }
  document.querySelectorAll(".sz").forEach(b => b.onclick = e => { e.stopPropagation(); setSheet(b.dataset.size); });
  (() => {
    const head = $("sheetHead"), sheet = $("sheet"); if (!head) return; let drag = null;
    head.addEventListener("pointerdown", e => { if (e.target.closest("button") || innerWidth >= 900) return; drag = { y: e.clientY, h: sheet.getBoundingClientRect().height, t: performance.now(), moved: false }; head.setPointerCapture(e.pointerId); sheet.classList.add("dragging"); });
    head.addEventListener("pointermove", e => { if (!drag) return; const dy = e.clientY - drag.y; if (Math.abs(dy) > 4) drag.moved = true; const max = innerHeight - 64; sheet.style.height = Math.max(90, Math.min(max, drag.h - dy)) + "px"; });
    const end = e => {
      if (!drag) return; sheet.classList.remove("dragging"); const dy = e.clientY - drag.y, v = dy / Math.max(1, performance.now() - drag.t), h = sheet.getBoundingClientRect().height; const was = drag; drag = null;
      if (!was.moved) { setSheet(st.sheet === "peek" ? "half" : st.sheet === "half" ? "full" : "half"); return; }
      if (v < -0.6) return setSheet(st.sheet === "peek" ? "half" : "full");
      if (v > 0.6) return setSheet(st.sheet === "full" ? "half" : "peek");
      const H = innerHeight; const opts = [["peek", 124], ["half", Math.min(H * 0.46, 460)], ["full", H - 64]];
      setSheet(opts.reduce((a, b) => Math.abs(b[1] - h) < Math.abs(a[1] - h) ? b : a)[0]);
    };
    head.addEventListener("pointerup", end); head.addEventListener("pointercancel", end);
  })();
  function setTab(t) {
    st.tab = t; document.querySelectorAll(".tab").forEach(b => b.setAttribute("aria-selected", String(b.dataset.t === t)));
    ["brief", "route", "stops", "tools"].forEach(k => $("p-" + k).hidden = k !== t); $("panes").scrollTop = 0;
    if (innerWidth < 900 && st.sheet === "peek") setSheet("half");
    renderTab();
  }
  const renderTab = () => ({ brief: renderBrief, route: renderRoute, stops: renderStops, tools: renderTools })[st.tab]();
  document.querySelectorAll(".tab").forEach(b => b.onclick = () => setTab(b.dataset.t));
  function setChap(id) { st.chap = id; LS.set("chap", id); pushSources(); renderMarkers(); renderTab(); fitChapter(); }
  const renderAll = () => { renderTab(); renderMarkers(); };

  /* ---------- layers popover ---------- */
  function syncLayerBoxes() { document.querySelectorAll("#layersPop input").forEach(i => i.checked = !!st.layers[i.dataset.l]); }
  function closeLayers() { const p = $("layersPop"); if (p && !p.hidden) { p.hidden = true; $("fLayers").setAttribute("aria-pressed", "false"); } }
  $("fLayers").onclick = () => { const p = $("layersPop"); const open = p.hidden; if (open && innerWidth < 900 && st.sheet !== "peek") setSheet("peek"); p.hidden = !open; $("fLayers").setAttribute("aria-pressed", String(open)); };
  $("layersClose").onclick = closeLayers;
  map.on("click", () => { if (innerWidth < 900) closeLayers(); });
  document.querySelectorAll("#layersPop input").forEach(i => i.onchange = () => {
    st.layers[i.dataset.l] = i.checked; LS.set("layers", Object.assign({}, st.layers, { radar: false }));
    if (i.dataset.l === "radar") { if (i.checked) addRadarLayer(); else if (map.getLayer("br-radar")) { map.removeLayer("br-radar"); map.removeSource("br-radar"); } }
    if (["osmview", "fuel", "cams"].includes(i.dataset.l) && i.checked && !st.osm) loadOSM(true);
    applyLayerVis();
  });
  syncLayerBoxes();

  /* ---------- buttons ---------- */
  $("fHome").onclick = () => { stopFly(); home(); };
  $("f3d").onclick = () => toggle3d();
  $("fFly").onclick = () => startFly();
  $("fLocate").onclick = locate;
  $("fRide").onclick = startRide; $("hudExit").onclick = stopRide;
  $("nowChip").onclick = () => setTab("brief");
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { if (st.theme !== "system") return; applyTheme(); const want = isDark() ? "dark" : "liberty"; if (want !== styleName) { styleName = want; styleReady = false; map.setStyle(OFM + styleName, { diff: false }); } });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) { st.sat = L.nextSaturday(); loadWeather(); loadOSM(); loadCrowd(); if (st.ride && !st.ride.lock) navigator.wakeLock && navigator.wakeLock.request("screen").then(l => st.ride && (st.ride.lock = l)).catch(() => { }); } });
  setInterval(() => { st.sat = L.nextSaturday(); loadWeather(); }, 30 * 6e4);

  /* ---------- boot ---------- */
  if (innerWidth < 900) setSheet("half"); else st.sheet = "half";
  renderBrief();
  let introDone = false;
  const endIntro = () => { if (introDone) return; introDone = true; $("intro").classList.add("out"); setTimeout(() => home(2600), 250); };
  map.on("load", () => setTimeout(endIntro, 900));
  setTimeout(endIntro, 4500);
  loadRoutes(); loadWeather(); loadOSM(); loadCrowd();
  if (location.hash === "#brief") setTab("brief");
  /* live updates: network-first app shell + reload once when a new version takes over */
  if ("serviceWorker" in navigator) addEventListener("load", async () => {
    try {
      const reg = await navigator.serviceWorker.register("sw.js"); st.swReg = reg;
      document.addEventListener("visibilitychange", () => { if (!document.hidden) reg.update().catch(() => { }); });
      let reloading = false; const had = !!navigator.serviceWorker.controller;
      navigator.serviceWorker.addEventListener("controllerchange", () => { if (!had || reloading || st.ride) return; reloading = true; toast("גרסה חדשה הותקנה"); setTimeout(() => location.reload(), 600); });
    } catch (e) { }
  });
})();
