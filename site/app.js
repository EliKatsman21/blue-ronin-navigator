/* Blue Ronin Navigator — app runtime */
(() => {
  "use strict";
  const { CHAPTERS, CAFES, ENF, NORTH_BOUNDS, CENTER_BOUNDS, REGIONS, LIVE_BOARD } = window.BRD;
  const GL = window.BR_GREENLINE || null;
  const BUILT_IN = CHAPTERS.length;
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
    nav: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="m3 11 18-8-8 18-2-8z"/></svg>',
    mountain: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M2.5 19 8.5 10l3.5 5 2.5-3.5 7 7.5z"/></svg>',
    menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M7 3v8a2 2 0 0 0 2 2v8M7 3v5M11 3v5M17 3c-2 2-2.5 5-2.5 8h3V21"/></svg>'
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
  /* Navigation buttons: plain icons with the app name (the brands' own logos are theirs to use). */
  const NAVI = {
    w: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"><path d="m4 11 16-7-7 16-2-7z"/></svg>',
    g: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/></svg>'
  };
  const navBtn = (k, href, label) => `<a class="navb ${k}" target="_blank" rel="noopener" href="${href}" aria-label="${k === "w" ? "ניווט ב־Waze" : "פתיחה בגוגל מפות"}">${NAVI[k]}<span>${label || (k === "w" ? "Waze" : "Google")}</span></a>`;
  const stopNav = s => { const c = s.cafe && CAFES.find(x => x.id === s.cafe); return c ? { w: wazeQ(`${c.name} ${c.place}`), g: gmQ(`${c.name} ${c.place}`) } : { w: wazeLL(s.lat, s.lon), g: gmLL(s.lat, s.lon) }; };

  /* ---------- state ---------- */
  const st = {
    chap: LS.get("chap", "c1"),
    layers: Object.assign({ curves: true, glare: true, stops: true, wx: true, radar: false, cams: true, cafes: true, osmview: true, fuel: true, hillshade: true, green: true, traffic: true }, LS.get("layers", {})),
    shabbat: LS.get("shabbat", true),
    theme: LS.get("theme", "system"),
    routes: {}, curves: {}, cstats: {}, glare: {}, elev: {},
    wx: LS.get("wx2", null), osm: LS.get("osm4", null), radar: null, crowd: LS.get("crowd", {}), api: null,
    bike: Object.assign({ range: 220, fuel: "95", name: "" }, LS.get("bike", {})), fuelFilter: LS.get("fuelFilter", { sat: true, oct: false }),
    terrain: false, ride: null, me: null, fly: null, tab: "brief",
    terr: {}, traffic: {}, cfg: { traffic: false, mapillary: false }, build: null, myRoutes: LS.get("myRoutes", []),
    buildPrefs: Object.assign({ noHighway: false, loop: false }, LS.get("buildPrefs", {})), voice: LS.get("voice", true),
    sat: L.nextSaturday()
  };
  /* Saved custom routes behave exactly like chapters once added to the list. */
  const customChapter = u => ({ id: u.id, title: u.title, short: u.title, custom: true, region: "custom", tech: 0.5, opts: u.opts || {}, sub: u.sub || "מסלול שבניתי", note: "", stops: u.stops.map((p, i, a) => ({ id: u.id + "_" + i, name: p.name, lat: p.lat, lon: p.lon, kind: i === 0 ? "start" : i === a.length - 1 ? "view" : "road", note: p.note || "", roads: [] })) });
  st.myRoutes.forEach(u => CHAPTERS.push(customChapter(u)));
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
    maxPitch: 80, attributionControl: { compact: true }, dragRotate: true, cooperativeGestures: false,
    pixelRatio: Math.min(2, window.devicePixelRatio || 1), fadeDuration: 160, maxTileCacheSize: 360, refreshExpiredTiles: false
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
    ["br-route", "br-curves", "br-glare", "br-enf", "br-osm", "br-terr", "br-green", "br-trafpts", "br-fly", "br-pick"].forEach(id => { if (!map.getSource(id)) map.addSource(id, { type: "geojson", data: FC() }); });
    const c = n => css(n);
    map.addLayer({ id: "br-enf-line", type: "line", source: "br-enf", filter: ["==", ["geometry-type"], "LineString"], paint: { "line-color": c("--warn"), "line-width": 9, "line-opacity": 0.28 }, layout: { "line-cap": "round" } }, sym);
    map.addLayer({ id: "br-route-dim", type: "line", source: "br-route", filter: ["!=", ["get", "active"], true], paint: { "line-color": c("--accent"), "line-width": 3, "line-opacity": 0.45, "line-dasharray": [2, 1.5] }, layout: { "line-cap": "round", "line-join": "round" } }, sym);
    map.addLayer({ id: "br-route-casing", type: "line", source: "br-route", filter: ["==", ["get", "active"], true], paint: { "line-color": c("--bg"), "line-width": ["interpolate", ["linear"], ["zoom"], 7, 6, 13, 11] }, layout: { "line-cap": "round", "line-join": "round" } }, sym);
    map.addLayer({ id: "br-route-solid", type: "line", source: "br-route", filter: ["==", ["get", "active"], true], paint: { "line-color": c("--accent"), "line-width": ["interpolate", ["linear"], ["zoom"], 7, 3, 13, 6] }, layout: { "line-cap": "round", "line-join": "round" } }, sym);
    map.addLayer({ id: "br-curves", type: "line", source: "br-curves", paint: { "line-color": ["match", ["get", "cls"], 0, c("--c0"), 1, c("--c1"), 2, c("--c2"), c("--c3")], "line-width": ["interpolate", ["linear"], ["zoom"], 7, 3, 13, 6] }, layout: { "line-cap": "round", "line-join": "round" } }, sym);
    map.addLayer({ id: "br-glare", type: "line", source: "br-glare", paint: { "line-color": c("--sun"), "line-width": ["interpolate", ["linear"], ["zoom"], 7, 3, 13, 5], "line-offset": ["interpolate", ["linear"], ["zoom"], 7, 6, 13, 12], "line-dasharray": [1, 1] }, layout: { "line-cap": "butt" } });
    if (GL) setSrc("br-green", FC([{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: GL.concat([GL[0]]) } }]));
    map.addLayer({ id: "br-green", type: "line", source: "br-green", minzoom: 6.5, paint: { "line-color": c("--caution"), "line-width": ["interpolate", ["linear"], ["zoom"], 7, 1, 12, 2.2], "line-opacity": 0.7, "line-dasharray": [3, 2] } }, sym);
    map.addLayer({ id: "br-terr", type: "line", source: "br-terr", paint: { "line-color": c("--caution"), "line-width": ["interpolate", ["linear"], ["zoom"], 7, 9, 13, 16], "line-opacity": 0.28 }, layout: { "line-cap": "round", "line-join": "round" } }, "br-route-casing");
    map.addLayer({ id: "br-terr-pt", type: "circle", source: "br-terr", filter: ["==", ["geometry-type"], "Point"], paint: { "circle-radius": 7, "circle-color": c("--caution"), "circle-stroke-color": c("--bg"), "circle-stroke-width": 2.5 } });
    map.addLayer({ id: "br-fly", type: "line", source: "br-fly", paint: { "line-color": "#fff", "line-width": ["interpolate", ["linear"], ["zoom"], 8, 2, 14, 5], "line-opacity": 0.85, "line-blur": 0.5 }, layout: { "line-cap": "round", "line-join": "round" } });
    map.addLayer({ id: "br-trafpts", type: "circle", source: "br-trafpts", paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 7, 4, 13, 8], "circle-color": ["case", [">=", ["get", "r"], 0.8], c("--go"), [">=", ["get", "r"], 0.55], c("--caution"), c("--no")], "circle-stroke-color": "#fff", "circle-stroke-width": 1.8, "circle-opacity": 0.95 } });
    map.addLayer({ id: "br-pick", type: "circle", source: "br-pick", paint: { "circle-radius": 9, "circle-color": c("--report"), "circle-stroke-color": "#fff", "circle-stroke-width": 2.5 } });
    if (st.cfg.traffic) addTrafficLayer();
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
      if (id === "br-fuel") { const n = st.osm && st.osm.fuel.find(x => x.id === p.id); if (n) { openFuelPopup(n); return; } }
      if (id === "br-cam") h = `<b>מצלמת מהירות</b><div class="small muted">OpenStreetMap${p.maxspeed ? " · מהירות " + esc(p.maxspeed) : ""}</div>`;
      else if (id.startsWith("br-enf")) h = `<b>${esc(p.name)}</b><div class="small muted">${esc(p.src)}</div>`;
      else h = `<b>${esc(p.name || (id === "br-fuel" ? "תחנת דלק" : "מצפור"))}</b><div class="small muted">${id === "br-fuel" ? esc(p.brand || "תחנת דלק") : "מצפור · OpenStreetMap"}</div><div class="row" style="margin-top:6px">${navBtn("w", wazeLL(lat, lon))}${navBtn("g", gmLL(lat, lon))}</div>`;
      const pop = new maplibregl.Popup({ closeButton: false, maxWidth: "280px" }).setLngLat(e.lngLat).setHTML((id === "br-view" ? photoSlot(lat, lon, "view") : "") + h).addTo(map);
      fillPhotos(pop.getElement());
    });
    map.on("mouseenter", id, () => map.getCanvas().style.cursor = "pointer");
    map.on("mouseleave", id, () => map.getCanvas().style.cursor = "");
  });

  const LAYER_MAP = { curves: ["br-curves"], glare: ["br-glare"], cams: ["br-cam", "br-enf-pt", "br-enf-line"], osmview: ["br-view"], fuel: ["br-fuel"], hillshade: ["br-hill"], radar: ["br-radar"], green: ["br-green", "br-terr", "br-terr-pt"], traffic: ["br-traffic", "br-trafpts"] };
  function applyLayerVis() {
    if (!styleReady) { renderMarkers(); return; }
    for (const k in LAYER_MAP) LAYER_MAP[k].forEach(id => { if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", st.layers[k] ? "visible" : "none"); });
    if (map.getLayer("br-route-solid")) map.setLayoutProperty("br-route-solid", "visibility", st.layers.curves ? "none" : "visible");
    renderMarkers();
  }
  function setSrc(id, data) { const s = map.getSource(id); if (s) s.setData(data); }
  function pushSources() {
    if (!map.getSource("br-route")) return;
    setSrc("br-route", FC(CHAPTERS.filter(c => st.routes[c.id] && (!c.combo || c.id === st.chap) && (c.region === chap().region || c.id === st.chap)).map(c => ({ type: "Feature", properties: { chap: c.id, active: c.id === st.chap }, geometry: { type: "LineString", coordinates: st.routes[c.id].coords } }))));
    setSrc("br-curves", FC((st.curves[st.chap] || []).map(s => ({ type: "Feature", properties: { cls: s.cls }, geometry: { type: "LineString", coordinates: s.coords } }))));
    setSrc("br-terr", FC((st.terr[st.chap] || []).flatMap(t => [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: t.coords } }, { type: "Feature", properties: { k: "in" }, geometry: { type: "Point", coordinates: t.enter } }].concat(t.exit ? [{ type: "Feature", properties: { k: "out" }, geometry: { type: "Point", coordinates: t.exit } }] : []))));
    const tr = st.traffic[st.chap]; setSrc("br-trafpts", FC(tr && tr.pts ? tr.pts.filter(p => p.ratio != null && p.ratio < 0.8 || p.closed).map(p => ({ type: "Feature", properties: { r: p.closed ? 0 : p.ratio }, geometry: { type: "Point", coordinates: [p.lon, p.lat] } })) : []));
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
    if (st.layers.cafes && !st.fly) CAFES.filter(c => !st.shabbat || c.shabbat === true).forEach(c => {
      const onRoute = chap().stops.some(s => s.cafe === c.id); if (onRoute && st.layers.stops) return;
      const e = document.createElement("button"); e.type = "button"; e.className = "mkc"; e.innerHTML = IC.cup; e.setAttribute("aria-label", c.name);
      e.onclick = ev => { ev.stopPropagation(); cafePopup(c); };
      mk.push(new maplibregl.Marker({ element: e }).setLngLat([c.lon, c.lat]).addTo(map));
    });
    if (st.layers.wx && st.wx && !st.fly) wxPoints().forEach((p, i) => {
      const h = satHour(i, 8); if (!h) return;
      const e = document.createElement("div"); e.className = "mkw"; e.innerHTML = `${wxIcon(h.code)}${Math.round(h.t)}°`;
      mk.push(new maplibregl.Marker({ element: e, anchor: "bottom" }).setLngLat([p.lon, p.lat]).addTo(map));
    });
    if (st.me) { const e = document.createElement("div"); e.className = "me"; mk.push(new maplibregl.Marker({ element: e }).setLngLat([st.me.lon, st.me.lat]).addTo(map)); }
  }
  function cafePopup(c) {
    const q = `${c.name} ${c.place}`;
    const pop = new maplibregl.Popup({ closeButton: false, maxWidth: "290px" }).setLngLat([c.lon, c.lat]).setHTML(`${photoSlot(c.lat, c.lon, "cafe")}<b>${esc(c.name)}</b><div class="small muted">${esc(c.place)} · ${esc(c.src)}</div><div class="row" style="margin-top:6px">${navBtn("w", wazeQ(q))}${navBtn("g", gmQ(q))}<a class="navb m" target="_blank" rel="noopener" href="https://www.google.com/search?q=${encodeURIComponent(q + " תפריט")}">${IC.menu}<span>תפריט</span></a></div>`).addTo(map);
    fillPhotos(pop.getElement());
  }
  function stopPopup(s, n) {
    const nav = stopNav(s);
    const pop = new maplibregl.Popup({ closeButton: false, maxWidth: "290px" }).setLngLat(lonlat(s)).setHTML(`${photoSlot(s.lat, s.lon, s.cafe ? "cafe" : "view")}<b>${n}. ${esc(s.name)}</b><div class="small muted" style="margin:3px 0 6px">${esc(s.note)}</div><div class="row">${navBtn("w", nav.w)}${navBtn("g", nav.g)}</div>`).addTo(map);
    fillPhotos(pop.getElement());
  }

  /* ---------- camera helpers ---------- */
  /* Home = the whole riding area of the chapter in view: the north, or the Jerusalem hills for chapter 5. */
  /* Frame a bounding box above the sheet. The camera is solved flat first and then tilted,
     so a 3D view never makes the fit fail on a small phone screen. */
  function frame(b, dur, pitch) {
    let cam = null; const pads = [sheetPad(), { top: 60, bottom: 60, left: 50, right: 20 }, 10];
    for (const padding of pads) { try { cam = map.cameraForBounds(b, { padding, bearing: 0 }); } catch (e) { cam = null; } if (cam) break; }
    if (!cam) return map.fitBounds(b, { padding: 10, duration: dur });
    map.easeTo(Object.assign({}, cam, { pitch: pitch || 0, bearing: 0, duration: dur }));
  }
  const routeBounds = id => { const r = st.routes[id]; const pts = r ? r.coords : CHAPTERS.find(c => c.id === id).stops.map(lonlat); return pts.reduce((b, p) => [[Math.min(b[0][0], p[0]), Math.min(b[0][1], p[1])], [Math.max(b[1][0], p[0]), Math.max(b[1][1], p[1])]], [[180, 90], [-180, -90]]); };
  const home = (dur = 1400) => frame(REGIONS[chap().region] || (chap().custom ? routeBounds(st.chap) : NORTH_BOUNDS), dur, 0);
  function fitChapter(dur = 1200) {
    const r = st.routes[st.chap]; const pts = r ? r.coords : chap().stops.map(lonlat);
    const b = pts.reduce((b, p) => [[Math.min(b[0][0], p[0]), Math.min(b[0][1], p[1])], [Math.max(b[1][0], p[0]), Math.max(b[1][1], p[1])]], [[180, 90], [-180, -90]]);
    frame(b, dur, st.terrain ? 50 : 0);
  }

  /* ---------- routing (OSRM, cached forever) ---------- */
  const hashStr = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };
  const routePts = c => (c.custom && c.opts && c.opts.loop && c.stops.length > 1 ? c.stops.concat([c.stops[0]]) : c.stops);
  /* Stops may carry silent via points (s.via = [[lat, lon], ...] before the stop): they shape the line
     but are passed to OSRM as non-waypoints, so they add no legs and no "arrived" prompts. */
  const routeCoords = c => { const pts = [], wp = []; routePts(c).forEach(s => { (s.via || []).forEach(v => pts.push({ lat: v[0], lon: v[1] })); wp.push(pts.length); pts.push(s); }); return { pts, wp }; };
  const routeKey = c => c.custom ? "uroute:v1:" + hashStr(JSON.stringify([routePts(c).map(s => [s.lon.toFixed(5), s.lat.toFixed(5)]), !!(c.opts && c.opts.noHighway)])) : "route:v4:" + c.id;
  const osrmUrl = (c, extra = "") => { const { pts, wp } = routeCoords(c); return `https://router.project-osrm.org/route/v1/driving/${pts.map(s => `${s.lon.toFixed(5)},${s.lat.toFixed(5)}`).join(";")}?overview=full&geometries=geojson&continue_straight=false${wp.length < pts.length ? "&waypoints=" + wp.join(";") : ""}${c.opts && c.opts.noHighway ? "&exclude=motorway" : ""}${extra}`; };
  async function loadRoute(c) {
    const key = routeKey(c); const cached = LS.get(key, null);
    if (cached) return cached;
    try {
      const r = await fetch(osrmUrl(c));
      const j = await r.json(); if (j.code !== "Ok") throw new Error(j.code);
      const rt = j.routes[0]; const out = { coords: rt.geometry.coordinates.map(p => [+p[0].toFixed(5), +p[1].toFixed(5)]), km: rt.distance / 1000, min: rt.duration / 60, legs: rt.legs.map(l => l.distance / 1000), real: true };
      LS.set(key, out); return out;
    } catch (e) {
      const cs = routeCoords(c).pts.map(lonlat); const cum = L.cumulative(cs);
      return { coords: cs, km: cum[cum.length - 1] * 1.35, min: cum[cum.length - 1] * 1.35 / 55 * 60, legs: [], real: false };
    }
  }
  const sunAt = (t, lon, lat) => { const p = SunCalc.getPosition(t, lat, lon); return { az: (p.azimuth * 180 / Math.PI + 180) % 360, alt: p.altitude * 180 / Math.PI }; };
  const departFor = c => { const s = c.stops[0]; return new Date(SunCalc.getTimes(st.sat.noonUTC, s.lat, s.lon).sunrise.getTime() + 15 * 6e4); };
  /* Everything derived from a route geometry: curves, stop kilometres, glare, territory crossings. */
  function processRoute(c, r) {
    st.routes[c.id] = r;
    st.curves[c.id] = L.curveSegments(r.coords); st.cstats[c.id] = L.curveStats(st.curves[c.id]);
    const cum = L.cumulative(r.coords); r.cum = cum;
    let from = 0; const kx = Math.cos(c.stops[0].lat * Math.PI / 180) ** 2;
    r.stopKm = c.stops.map(s => { let bi = from, bd = 1e9; for (let i = from; i < r.coords.length; i++) { const p = r.coords[i]; const d = kx * (p[0] - s.lon) ** 2 + (p[1] - s.lat) ** 2; if (d < bd) { bd = d; bi = i; } } from = bi; return cum[bi]; });
    st.glare[c.id] = L.glareSegments(r.coords, departFor(c), 55, sunAt);
    st.terr[c.id] = L.ringSpans(r.coords, GL).map(t => Object.assign(t, { coords: sliceKm(r.coords, cum, t.fromKm, t.toKm) }));
  }
  function sliceKm(coords, cum, a, b) { const out = [L.pointAt(coords, cum, a)]; for (let i = 0; i < coords.length; i++) if (cum[i] > a && cum[i] < b) out.push(coords[i]); out.push(L.pointAt(coords, cum, b)); return out; }
  async function loadRoutes() {
    await Promise.all(CHAPTERS.map(async c => { processRoute(c, await loadRoute(c)); }));
    pushSources(); renderAll();
    if (CHAPTERS.some(c => !st.routes[c.id].real)) toast("שרת הניתוב לא זמין כרגע. מוצג מסלול משוער.");
    if (st.tab === "route") loadTraffic(st.chap);
    for (const c of CHAPTERS) { if (!st.elev[c.id]) await loadElev(c.id); }
    if (st.tab === "brief" || st.tab === "route") renderTab();
  }

  /* ---------- elevation (Open-Meteo) ---------- */
  const climbOf = el => { let c = 0; for (let i = 1; i < el.length; i++) if (el[i] > el[i - 1]) c += el[i] - el[i - 1]; return Math.round(c); };
  async function loadElev(id) {
    if (st.elev[id]) return st.elev[id];
    const key = "elev:v4:" + (CHAPTERS.find(c => c.id === id) && CHAPTERS.find(c => c.id === id).custom ? routeKey(CHAPTERS.find(c => c.id === id)) : id); const c = LS.get(key, null); if (c) { c.climb = climbOf(c.el); return (st.elev[id] = c); }
    const r = st.routes[id]; if (!r) return null;
    const { pts, km } = L.sample(r.coords, Math.min(300, Math.max(100, Math.round(r.km / 1.2))));
    try {
      const el = [];
      for (let i = 0; i < pts.length; i += 100) { const ch = pts.slice(i, i + 100); const j = await (await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${ch.map(p => p[1].toFixed(4)).join(",")}&longitude=${ch.map(p => p[0].toFixed(4)).join(",")}`)).json(); if (!Array.isArray(j.elevation)) throw new Error("elev"); el.push(...j.elevation); }
      const out = { pts, km, el }; out.climb = climbOf(out.el); LS.set(key, out); return (st.elev[id] = out);
    } catch (e) { return null; }
  }

  /* ---------- weather (Open-Meteo, live) ---------- */
  function wxPoints() {
    const pts = [];
    CHAPTERS.filter(c => !c.combo && (!c.custom || c.id === st.chap)).forEach(c => { const s = c.stops; [s[0], s[Math.floor(s.length / 2)], s[s.length - 1]].forEach(p => pts.push({ lat: p.lat, lon: p.lon, name: p.name.split(" · ")[0], chap: c.id })); });
    pts.push({ lat: st.me ? st.me.lat : 32.651, lon: st.me ? st.me.lon : 35.105, name: st.me ? "המיקום שלך" : "יוקנעם", chap: "now" });
    return pts;
  }
  const wxSig = () => wxPoints().map(p => p.lat.toFixed(2) + p.lon.toFixed(2)).join("");
  async function loadWeather(force) {
    if (!force && st.wx && Date.now() - st.wx.ts < 30 * 6e4 && st.wx.sat === st.sat.iso && st.wx.sig === wxSig()) { renderNow(); return; }
    const pts = wxPoints();
    const url = "https://api.open-meteo.com/v1/forecast?latitude=" + pts.map(p => p.lat.toFixed(3)).join(",") + "&longitude=" + pts.map(p => p.lon.toFixed(3)).join(",") +
      "&hourly=temperature_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,visibility,cloud_cover" +
      "&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_gusts_10m,precipitation&forecast_days=9&timezone=Asia%2FJerusalem&wind_speed_unit=kmh";
    try {
      const j = await (await fetch(url)).json(); const arr = Array.isArray(j) ? j : [j];
      st.wx = { ts: Date.now(), sat: st.sat.iso, sig: wxSig(), pts: arr.map(x => ({ h: x.hourly, cur: x.current })) };
      LS.set("wx2", st.wx);
    } catch (e) { if (!st.wx) toast("אין חיבור למזג האוויר. נסו שוב בעוד רגע."); }
    renderNow(); renderMarkers(); if (st.tab === "brief") renderBrief();
  }
  function satHour(i, hour) {
    const p = st.wx && st.wx.pts[i]; if (!p) return null; const iso = `${st.sat.iso}T${String(hour).padStart(2, "0")}:00`; const k = p.h.time.indexOf(iso); if (k < 0) return null;
    return { t: p.h.temperature_2m[k], code: p.h.weather_code[k], p: p.h.precipitation_probability[k], g: p.h.wind_gusts_10m[k], vis: p.h.visibility ? p.h.visibility[k] : null };
  }
  function wxMid(cid) { const cc = CHAPTERS.find(c => c.id === cid); const id = cc && cc.combo ? cc.combo[Math.floor(cc.combo.length / 2)] : cid; return wxPoints().findIndex(x => x.chap === id) + 1; }
  function chapterWx(cid) {
    if (!st.wx) return null; const pts = wxPoints(); const rows = []; const cc = CHAPTERS.find(c => c.id === cid); const ids = cc && cc.combo ? cc.combo : [cid];
    pts.forEach((p, i) => { if (!ids.includes(p.chap) || !st.wx.pts[i]) return; const w = L.windowStats(st.wx.pts[i].h, `${st.sat.iso}T06:00`, `${st.sat.iso}T12:00`, `${st.sat.prevIso}T20:00`); if (w) rows.push({ p, w, i }); });
    if (!rows.length) return null;
    const agg = { tMin: Math.min(...rows.map(r => r.w.tMin)), tMax: Math.max(...rows.map(r => r.w.tMax)), maxP: Math.max(...rows.map(r => r.w.maxP)), sumMm: Math.max(...rows.map(r => r.w.sumMm)), maxGust: Math.max(...rows.map(r => r.w.maxGust)), minVis: Math.min(...rows.map(r => r.w.minVis)), wet: rows.some(r => r.w.wet), storm: rows.some(r => r.w.storm), fog: rows.some(r => r.w.fog) };
    return { rows, agg, ri: L.rideIndex(agg), code: rows[Math.floor(rows.length / 2)].w.code };
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
    const q = "[out:json][timeout:40];(" + Object.values(REGIONS).map(B => { const bb = `${B[0][1]},${B[0][0]},${B[1][1]},${B[1][0]}`; return `node["highway"="speed_camera"](${bb});nwr["amenity"="fuel"](${bb});node["tourism"="viewpoint"](${bb});`; }).join("") + ");out center tags;";
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
        st.osm = d; nearCache.clear(); LS.set("osm4", st.osm); pushSources(); renderAll();
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
    const res = CHAPTERS.filter(c => !c.custom || c.id === st.chap).map(c => ({ c, w: chapterWx(c.id) })).filter(x => x.w);
    const best = res.filter(x => !x.c.combo).sort((a, b) => b.w.ri.i - a.w.ri.i)[0];
    if (st.sat.daysAway > 5) h += `<div class="alert info">התחזית ל־${st.sat.daysAway} ימים עדיין רחוקה. התדריך מתעדכן אוטומטית ככל שהשבת מתקרבת.</div>`;
    h += `<div class="ccards">` + res.map(({ c, w }) => {
      const cs = st.cstats[c.id]; const isBest = best && best.c.id === c.id;
      return `<button type="button" class="ccard ${isBest ? "best" : ""}" data-chap="${c.id}">${gauge(w.ri.i, w.ri.verdict.k)}<div><div class="row" style="gap:6px"><h3>${esc(c.title)}</h3>${isBest ? '<span class="best-tag">הפרק של השבת</span>' : ""}</div><div class="verdict v-${w.ri.verdict.k}">${esc(w.ri.verdict.t)}</div><div class="why">${w.ri.why.length ? esc(w.ri.why.slice(0, 3).join(" · ")) : "בלי גשם, ערפל או רוח חריגה"}${cs ? ` · ${Math.round(cs.twisty)} ק״מ מפותלים` : ""}</div>${diffMini(c.id)}</div><div style="text-align:center">${wxIcon(w.code).replace("<svg", '<svg width="30" height="30"')}<div class="mono small" dir="ltr">${Math.round(w.agg.tMin)}°–${Math.round(w.agg.tMax)}°</div></div></button>`;
    }).join("") + `</div>`;
    const cw = chapterWx(st.chap); const ci = wxMid(st.chap);
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
  /* Difficulty: five shift-light LEDs (green, green, amber, orange, red), lit up to the level. */
  function diffOf(id) {
    const c = CHAPTERS.find(x => x.id === id), r = st.routes[id], cs = st.cstats[id], e = st.elev[id];
    if (!r || !cs) return null;
    return L.difficulty({ km: r.km, cstats: cs, el: e && e.el, elKm: e && e.km, tech: c.tech ?? 0.5 });
  }
  function leds(d, mini) {
    const n = d ? d.level.n : 0;
    return `<span class="leds${mini ? " mini" : ""}" role="img" aria-label="${d ? `רמת קושי ${n} מתוך 5: ${d.level.t}` : "רמת קושי מחושבת"}">${[1, 2, 3, 4, 5].map(i => `<i class="l${i}${i <= n ? " on" : ""}"></i>`).join("")}</span>`;
  }
  const diffMini = id => { const d = diffOf(id); return d ? `<div class="dmini">${leds(d, true)}<span>${esc(d.level.t)}</span></div>` : ""; };
  function diffCard(id) {
    const d = diffOf(id), c = CHAPTERS.find(x => x.id === id);
    if (!d) return `<div class="card diff"><div class="row" style="justify-content:space-between"><h3>רמת קושי</h3>${leds(null)}</div><p class="small muted" style="margin:0">מחשב לפי המסלול…</p></div>`;
    return `<div class="card diff lv${d.level.n}"><div class="dhead"><div><div class="small muted">רמת קושי</div><div class="dlvl"><b>${d.level.n}</b><span>/5</span> ${esc(d.level.t)}</div></div>${leds(d)}</div>
      <div class="small">${esc(d.level.d)}</div>
      <div class="dparts">${d.parts.map(p => `<div><span>${esc(p.k)}</span><i><b style="width:${Math.round(p.v * 100)}%"></b></i></div>`).join("")}</div>
      <div class="small muted">${d.grade != null ? `שיפוע מרבי בדגימה ${d.grade}% · ` : ""}${d.climb != null ? `טיפוס מצטבר ${d.climb} מ׳` : "טיפוס: מחשב…"}${c.note ? ` · ${esc(c.note)}` : ""}</div></div>`;
  }
  const stars = n => "●".repeat(n) + "○".repeat(5 - n);
  function renderRoute() {
    const c = chap(), r = st.routes[c.id], cs = st.cstats[c.id], e = st.elev[c.id];
    let h = `<div class="chapsel">${CHAPTERS.filter(x => x.id !== DRAFT).map((x, i) => `<button type="button" data-c="${x.id}" aria-pressed="${x.id === st.chap && !st.build}"><span>${x.custom ? "★ " + esc(x.short) : `פרק ${i + 1} · ${esc(x.short)}`}</span>${leds(diffOf(x.id), true)}</button>`).join("")}<button type="button" class="newroute" id="bNew" aria-pressed="${!!st.build}">＋ מסלול משלי</button></div>`;
    if (st.build) h += builderPanel();
    if (st.build && st.chap !== DRAFT) { $("p-route").innerHTML = h; $("bNew").onclick = () => startBuild(); bindBuilder(); return; }
    else h += `<div><div class="row" style="justify-content:space-between;align-items:flex-start"><h2>${esc(c.title)}</h2>${c.custom ? `<div class="row"><button type="button" class="btn sm" id="bEdit">עריכה</button><button type="button" class="btn sm" id="bShareR">שיתוף</button></div>` : ""}</div><p class="muted" style="margin:4px 0 0">${esc(c.sub)}</p></div>`;
    h += `
      <div class="stats"><div class="stat"><div class="k">מרחק</div><div class="v">${r ? Math.round(r.km) : "--"}<span class="small"> ק״מ</span></div></div><div class="stat"><div class="k">זמן נטו</div><div class="v">${r ? `${Math.floor(r.min / 60)}:${String(Math.round(r.min % 60)).padStart(2, "0")}` : "--"}</div></div><div class="stat"><div class="k">מפותל</div><div class="v">${cs ? Math.round(cs.twisty) : "--"}<span class="small"> ק״מ</span></div></div><div class="stat"><div class="k">טיפוס</div><div class="v">${e && e.climb != null ? e.climb : "--"}<span class="small"> מ׳</span></div></div></div>`;
    h += terrCard(c.id) + diffCard(c.id) + trafficCard(c.id);
    if (cs) h += `<div><div class="curvebar">${cs.km.map((k, i) => `<span style="width:${(k / cs.total * 100).toFixed(1)}%;background:var(--c${i})"></span>`).join("")}</div><div class="legend" style="margin-top:6px">${L.CURVE_LABEL.map((l, i) => `<span><i style="background:var(--c${i})"></i>${l} ${Math.round(cs.km[i])}</span>`).join("")}</div></div>`;
    h += `<div id="profWrap">${profileSvg(e)}</div>`;
    h += fuelPlanCard();
    if (r && !r.real) h += `<div class="alert">המסלול משוער (שרת הניתוב לא היה זמין). הקישור לגוגל מנווט על הכבישים האמיתיים.</div>`;
    h += `<div class="row"><a class="btn primary" target="_blank" rel="noopener" href="${gmRoute(c.stops)}">${IC.nav}ניווט הפרק בגוגל</a><a class="btn" target="_blank" rel="noopener" href="${wazeLL(c.stops[0].lat, c.stops[0].lon)}">Waze לנקודת הפתיחה</a><button type="button" class="btn" id="bFly">מעוף על הפרק</button><button type="button" class="btn" id="bGpx">GPX</button></div>`;
    h += `<ol class="stops">` + c.stops.map((s, i) => { const nav = stopNav(s); const cafe = s.cafe && CAFES.find(x => x.id === s.cafe); return `<li class="stop"><span class="num ${s.kind === "view" ? "view" : s.kind === "cafe" ? "cafe" : ""}">${i + 1}</span><div><h3><button type="button" data-s="${s.id}">${esc(s.name)}</button></h3><p>${esc(s.note)}</p><div class="chips" style="margin-bottom:6px">${(s.roads || []).map(x => `<span class="chip road">${x}</span>`).join("")}${r && r.stopKm ? `<span class="chip road">ק״מ ${Math.round(r.stopKm[i])}</span>` : ""}${cafe && cafe.shabbat ? '<span class="chip sun">פתוח בשבת</span>' : ""}${s.score ? `<span class="score">עיקולים <b>${stars(s.score[0])}</b> נוף <b>${stars(s.score[1])}</b></span>` : ""}</div><div class="row">${navBtn("w", nav.w)}${navBtn("g", nav.g)}</div></div></li>`; }).join("") + `</ol>`;
    $("p-route").innerHTML = h;
    $("p-route").querySelectorAll("[data-c]").forEach(b => b.onclick = () => { st.build = null; setPick(false); setChap(b.dataset.c); });
    $("bNew").onclick = () => startBuild(); if ($("bEdit")) $("bEdit").onclick = () => startBuild(c); if ($("bShareR")) $("bShareR").onclick = () => shareRoute(c);
    if (st.build) bindBuilder(); bindTraffic(c.id);
    $("p-route").querySelectorAll("[data-s]").forEach(b => b.onclick = () => { const s = c.stops.find(x => x.id === b.dataset.s); map.flyTo({ center: lonlat(s), zoom: 13, padding: sheetPad(), duration: 1100 }); stopPopup(s, c.stops.indexOf(s) + 1); if (innerWidth < 900) setSheet("peek"); });
    $("bFly").onclick = () => startFly(); $("bGpx").onclick = gpx; bindFuelPlan();
    if (!st.traffic[c.id] || Date.now() - st.traffic[c.id].ts > 3 * 6e4) loadTraffic(c.id);
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
      list.map(c => `<div class="item">${thumbSlot(c.lat, c.lon, "cafe", c.id)}<div class="grow"><b>${esc(c.name)}</b><span class="small muted">${esc(c.place)} · ${esc(c.src)}</span></div><div class="row" style="flex-wrap:nowrap">${navBtn("w", wazeQ(c.name + " " + c.place))}${navBtn("g", gmQ(c.name + " " + c.place))}</div></div>`).join("") + `</div>`;
    const views = nearRoute(st.osm && st.osm.views, st.chap, 1.2).filter(v => v.name);
    h += `<div><h3>מצפורים לאורך ${esc(chap().title)}</h3><p class="small muted" style="margin:2px 0 4px">מתוך OpenStreetMap, עד 1.2 ק״מ מהמסלול, לפי הסדר בדרך.</p>`;
    h += views.length ? views.slice(0, 14).map(v => `<div class="item">${thumbSlot(v.lat, v.lon, "view", v.id)}<div class="grow"><b>${esc(v.name)}</b><span class="small muted mono">ק״מ ${Math.round(v.km)} · ${Math.round(v.d * 1000)} מ׳ מהכביש</span></div><div class="row" style="flex-wrap:nowrap">${navBtn("w", wazeLL(v.lat, v.lon))}<button type="button" class="btn sm" data-ll="${v.lon},${v.lat}">במפה</button></div></div>`).join("") : `<p class="small muted">${st.osm ? "לא נמצאו מצפורים עם שם ליד הפרק." : "טוען מ־OpenStreetMap…"}</p>`;
    h += `</div>`;
    h += fuelSection();
    $("p-stops").innerHTML = h;
    bindFuelSection(); lazyThumbs($("p-stops"));
    $("p-stops").querySelectorAll("[data-cafe]").forEach(x => x.onclick = () => { const c = CAFES.find(k => k.id === x.dataset.cafe); if (!c) return; map.flyTo({ center: [c.lon, c.lat], zoom: 14, padding: sheetPad() }); cafePopup(c); if (innerWidth < 900) setSheet("peek"); });
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
    return `<div style="display:grid;gap:6px;min-width:220px">${photoSlot(n.lat, n.lon, "fuel")}<div><b>${esc(label)}</b>${n.brand && n.brand !== label ? `<span class="small muted"> · ${esc(n.brand)}</span>` : ""}</div><div class="chips">${satPill(f)}${octChips(f)}</div><div class="small muted">${esc(srcLine(f))}</div>
      <div class="row">${navBtn("w", wazeLL(n.lat, n.lon))}${navBtn("g", gmQ(q), "שעות")}</div>
      ${st.api ? `<div class="row small"><span class="muted">אני כאן עכשיו:</span>${voteBtn(n.id, "sat", "open", "פתוח בשבת")}${voteBtn(n.id, "sat", "closed", "סגור")}${voteBtn(n.id, "o98", "1", "יש 98")}${voteBtn(n.id, "o98", "0", "אין 98")}</div><div class="small muted" data-mine="${n.id}">${myVoteLine(n.id)}</div>` : ""}</div>`;
  }
  /* My own votes: a pressed button is my vote; tapping it again takes the vote back. */
  const myVotes = LS.get("myVotes", {});
  const mineVal = (id, f) => myVotes[id] ? myVotes[id][f] : undefined;
  const asVal = (f, v) => f === "sat" ? v : v === "1";
  function voteBtn(id, f, v, label) { const on = mineVal(id, f) === asVal(f, v); return `<button type="button" class="btn sm vote" aria-pressed="${on}" data-fr="${id}|${f}|${v}">${on ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5 9-10"/></svg>' : ""}${label}</button>`; }
  function myVoteLine(id) { const m = myVotes[id] || {}; const parts = []; if (m.sat) parts.push(m.sat === "open" ? "פתוח בשבת" : "סגור בשבת"); if (typeof m.o98 === "boolean") parts.push(m.o98 ? "יש 98" : "אין 98"); return parts.length ? `הסימון שלך: ${parts.join(", ")}. לביטול לוחצים שוב על אותו כפתור.` : ""; }
  let fuelPop = null;
  function openFuelPopup(n) {
    if (fuelPop) fuelPop.popup.remove();
    const popup = new maplibregl.Popup({ closeButton: false, maxWidth: "300px" }).setLngLat([n.lon, n.lat]).setHTML(fuelCard(n)).addTo(map);
    fuelPop = { popup, n }; popup.on("close", () => { if (fuelPop && fuelPop.popup === popup) fuelPop = null; });
    bindFuelButtons(popup.getElement()); fillPhotos(popup.getElement());
  }
  function refreshFuelUI(id) {
    if (fuelPop && fuelPop.n.id === id) { fuelPop.popup.setHTML(fuelCard(fuelPop.n)); bindFuelButtons(fuelPop.popup.getElement()); fillPhotos(fuelPop.popup.getElement()); }
    pushSources(); if (st.tab === "stops" || st.tab === "route") renderTab();
  }
  async function postFuel(id, field, val) {
    const prev = myVotes[id] ? Object.assign({}, myVotes[id]) : null;
    const want = asVal(field, val); const undo = mineVal(id, field) === want;
    const body = { id, c: cid }; body[field] = undo ? "clear" : want;
    const m = myVotes[id] || (myVotes[id] = {}); if (undo) delete m[field]; else m[field] = want; if (!Object.keys(m).length) delete myVotes[id];
    LS.set("myVotes", myVotes); refreshFuelUI(id);
    try {
      const r = await fetch("/api/fuel", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      if (!r.ok) throw 0; const j = await r.json();
      if (j.station) st.crowd[id] = j.station; else delete st.crowd[id]; LS.set("crowd", st.crowd);
      refreshFuelUI(id); toast(undo ? "הסימון בוטל" : "תודה! הדיווח מוצג עכשיו לכל הרוכבים");
    } catch (e) {
      if (prev) myVotes[id] = prev; else delete myVotes[id]; LS.set("myVotes", myVotes); refreshFuelUI(id);
      toast("הדיווח לא נשלח. בדקו חיבור ונסו שוב");
    }
  }
  function bindFuelButtons(root) { if (root) root.querySelectorAll("[data-fr]").forEach(b => b.onclick = () => { const [id, f, v] = b.dataset.fr.split("|"); postFuel(id, f, v); }); }
  function fuelSection() {
    const all = fuelAlong(st.chap); const ff = st.fuelFilter;
    const list = all.filter(f => (!ff.sat || f.sat !== "closed") && (!ff.oct || f.o98 !== false));
    let h = `<div><div class="row" style="justify-content:space-between"><h3>דלק לאורך ${esc(chap().title)}</h3></div>
      <div class="row small" style="margin:6px 0"><label class="toggle"><input type="checkbox" id="ffSat" ${ff.sat ? "checked" : ""}> בלי הסגורות בשבת</label><label class="toggle"><input type="checkbox" id="ffOct" ${ff.oct ? "checked" : ""}> רק אם יש 98</label></div>
      <div class="legend" style="margin-bottom:4px;align-items:center"><span class="small">במפה: משאבה בתכלת, והנקודה בפינה היא מצב השבת</span><span><i style="background:var(--go);width:9px;height:9px;border-radius:50%"></i>פתוח</span><span><i style="background:var(--no);width:9px;height:9px;border-radius:50%"></i>סגור</span><span><i style="background:#9AA5B4;width:9px;height:9px;border-radius:50%"></i>לא ידוע</span></div>`;
    if (!st.osm) h += `<p class="small muted">טוען תחנות מ־OpenStreetMap…</p>`;
    else if (!list.length) h += `<p class="small muted">אין תחנות שמתאימות לסינון ליד הפרק.</p>`;
    h += list.map(f => `<div class="item" style="display:block"><div class="row" style="justify-content:space-between;flex-wrap:nowrap"><div style="min-width:0"><b>${esc(f.label)}</b><span class="small muted mono">ק״מ ${Math.round(f.km)}${f.d > 0.08 ? ` · ${Math.round(f.d * 1000)} מ׳ מהכביש` : ""}</span></div><div class="row" style="flex-wrap:nowrap">${navBtn("w", wazeLL(f.lat, f.lon))}<button type="button" class="btn sm" data-fx="${f.id}">פרטים</button></div></div><div class="chips" style="margin-top:4px">${satPill(f)}${octChips(f)}<span class="small muted">${esc(srcLine(f))}</span></div></div>`).join("");
    if (st.osm && st.api === false) h += `<p class="small muted">אימות רוכבים יופעל כשהשרת מחובר.</p>`;
    return h + `</div>`;
  }
  function bindFuelSection() {
    const a = $("ffSat"), b = $("ffOct"); if (!a) return;
    a.onchange = () => { st.fuelFilter.sat = a.checked; LS.set("fuelFilter", st.fuelFilter); renderStops(); };
    b.onchange = () => { st.fuelFilter.oct = b.checked; LS.set("fuelFilter", st.fuelFilter); renderStops(); };
    document.querySelectorAll("#p-stops [data-fx]").forEach(x => x.onclick = () => { const n = st.osm.fuel.find(k => k.id === x.dataset.fx); if (!n) return; map.flyTo({ center: [n.lon, n.lat], zoom: 14, padding: sheetPad() }); openFuelPopup(n); if (innerWidth < 900) setSheet("peek"); });
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
      h += strict.plan.map(s => `<div class="item"><div><b>תדלוק: ${esc(s.label)}</b><span class="small muted mono">ק״מ ${Math.round(s.km)} · ${s.hours ? "שבת " + esc(s.hours) : "פתוח בשבת"}${s.o98 ? " · 98" : ""}</span></div>${navBtn("w", wazeLL(s.lat, s.lon))}</div>`).join("");
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

  /* ---------- place photos (Mapillary street level + Wikimedia Commons, with credits) ---------- */
  const photoCache = new Map();
  async function getPhotos(lat, lon, kind) {
    const key = `${(+lat).toFixed(4)},${(+lon).toFixed(4)},${kind}`;
    if (photoCache.has(key)) return photoCache.get(key);
    const p = fetch(`/api/photos?lat=${(+lat).toFixed(4)}&lon=${(+lon).toFixed(4)}&kind=${kind}`).then(r => r.ok ? r.json() : { photos: [] }).then(j => j.photos || []).catch(() => []);
    photoCache.set(key, p); return p;
  }
  const photoSlot = (lat, lon, kind) => `<div class="ph" data-ph="${lat},${lon},${kind}"><div class="ph-skel"></div></div>`;
  const thumbSlot = (lat, lon, kind, id) => `<button type="button" class="thumb" data-ph="${lat},${lon},${kind}" ${kind === "cafe" ? `data-cafe="${id}"` : `data-ll="${lon},${lat}"`} aria-label="תמונה ומיקום"><span class="ph-skel"></span></button>`;
  function fillPhotos(root) {
    if (!root) return;
    root.querySelectorAll(".ph[data-ph]").forEach(async el => {
      const [lat, lon, kind] = el.dataset.ph.split(","); const list = await getPhotos(lat, lon, kind);
      if (!list.length) { el.remove(); return; }
      el.innerHTML = `<div class="ph-strip">${list.map((x, i) => `<a href="${esc(x.link)}" target="_blank" rel="noopener" class="ph-img${i ? "" : " main"}"><img src="${esc(x.thumb)}" alt="" loading="lazy" decoding="async"></a>`).join("")}</div><div class="ph-cr">צילום: ${esc(list[0].author)}${list[0].license ? " · " + esc(list[0].license) : ""} · ${list[0].src === "mapillary" ? "Mapillary" : "Wikimedia Commons"}</div>`;
    });
  }
  let thumbIO = null;
  function lazyThumbs(root) {
    if (!("IntersectionObserver" in window)) return;
    thumbIO = thumbIO || new IntersectionObserver(es => es.forEach(async e => {
      if (!e.isIntersecting) return; thumbIO.unobserve(e.target); const el = e.target; const [lat, lon, kind] = el.dataset.ph.split(",");
      const list = await getPhotos(lat, lon, kind);
      el.innerHTML = list.length ? `<img src="${esc(list[0].thumb)}" alt="" loading="lazy" decoding="async">` : `<span class="ph-none">${kind === "cafe" ? IC.cup : IC.mountain}</span>`;
    }), { root: $("panes"), rootMargin: "120px" });
    root.querySelectorAll(".thumb[data-ph]").forEach(el => thumbIO.observe(el));
  }

  /* ---------- territories (Green Line from Natural Earth) ---------- */
  function terrCard(id) {
    const t = st.terr[id]; if (!t || !t.length) return "";
    const r = st.routes[id]; const inKm = t.reduce((a, x) => a + (x.toKm - x.fromKm), 0); const tot = r.cum ? r.cum[r.cum.length - 1] : r.km;
    const near = p => { const c = CHAPTERS.find(x => x.id === id); let best = null, bd = 1e9; c.stops.forEach(s => { const d = L.hav(p, lonlat(s)); if (d < bd) { bd = d; best = s; } }); return best && bd < 12 ? ` · ליד ${best.name.split(" · ")[0]}` : ""; };
    return `<div class="card terr"><div class="row" style="justify-content:space-between"><h3>מעבר בשטחים</h3><span class="chip" style="border-color:var(--caution);color:var(--caution)">${Math.round(inKm)} ק״מ מתוך ${Math.round(tot)}</span></div>
      <ol class="terrlist">${t.map(x => `<li><b>${x.startsInside ? "המסלול מתחיל בשטחים" : `כניסה · ק״מ ${Math.round(x.fromKm)}`}</b><span class="small muted">${x.startsInside ? "" : near(x.enter)}</span></li>${x.endsInside ? `<li><b>המסלול מסתיים בשטחים</b></li>` : `<li><b>יציאה · ק״מ ${Math.round(x.toKm)}</b><span class="small muted">${near(x.exit)}</span></li>`}`).join("")}</ol>
      <div class="small muted">הקו הירוק מסומן במפה בקו מקווקו, והקטעים שבתוך השטחים מודגשים. במצב רכיבה תקבלו התראה 2 ק״מ לפני כל מעבר ובזמן המעבר. ביריחו ובשטחי A (שלט אדום) הכניסה לישראלים אסורה. גבול: Natural Earth.</div></div>`;
  }

  /* ---------- live traffic (TomTom, through our server) ---------- */
  function addTrafficLayer() {
    if (!st.cfg.traffic || map.getSource("br-traffic")) return;
    map.addSource("br-traffic", { type: "raster", tiles: [location.origin + "/api/traffic-tile/{z}/{x}/{y}" + (isDark() ? "?dark=1" : "")], tileSize: 256, minzoom: 7, maxzoom: 17, attribution: "תנועה: TomTom" });
    map.addLayer({ id: "br-traffic", type: "raster", source: "br-traffic", minzoom: 7, layout: { visibility: st.layers.traffic ? "visible" : "none" }, paint: { "raster-opacity": 0.85 } }, map.getLayer("br-route-casing") ? "br-route-casing" : firstSymbol());
  }
  function samplePts(coords, maxN = 24) {
    const cum = L.cumulative(coords), total = cum[cum.length - 1]; const step = Math.max(3, total / maxN); const out = [];
    for (let km = step / 2; km < total; km += step) { const p = L.pointAt(coords, cum, km); out.push({ km, lat: +p[1].toFixed(4), lon: +p[0].toFixed(4) }); }
    return out;
  }
  async function fetchTraffic(pts) {
    const r = await fetch("/api/traffic?pts=" + pts.map(p => `${p.lat},${p.lon}`).join(";")); if (!r.ok) throw new Error(r.status);
    const j = await r.json(); return j.pts.map((x, i) => Object.assign({ km: pts[i].km }, x));
  }
  async function loadTraffic(id, force) {
    if (!st.cfg.traffic) return; const r = st.routes[id]; if (!r) return;
    const cur = st.traffic[id]; if (!force && cur && (cur.busy || Date.now() - cur.ts < 3 * 6e4)) return;
    st.traffic[id] = Object.assign({}, cur || {}, { busy: true, ts: Date.now() });
    try { const pts = await fetchTraffic(samplePts(r.coords)); st.traffic[id] = { ts: Date.now(), pts, km: r.km, way: cur && cur.way }; }
    catch (e) { st.traffic[id] = Object.assign({}, cur || {}, { ts: Date.now(), err: true }); }
    pushSources(); if (st.tab === "route" && st.chap === id) renderRoute();
  }
  async function trafficOnTheWay(id) {
    const c = CHAPTERS.find(x => x.id === id); const t = st.traffic[id] || (st.traffic[id] = { ts: 0 });
    t.way = { busy: true }; renderRoute();
    const pos = await new Promise(res => navigator.geolocation ? navigator.geolocation.getCurrentPosition(p => res([p.coords.longitude, p.coords.latitude]), () => res(null), { timeout: 8000 }) : res(null));
    if (!pos) { t.way = { err: "מיקום" }; renderRoute(); return; }
    try {
      const j = await (await fetch(`https://router.project-osrm.org/route/v1/driving/${pos[0].toFixed(5)},${pos[1].toFixed(5)};${c.stops[0].lon},${c.stops[0].lat}?overview=full&geometries=geojson`)).json();
      const rt = j.routes[0]; const pts = await fetchTraffic(samplePts(rt.geometry.coordinates, 20));
      t.way = { pts, km: rt.distance / 1000, min: rt.duration / 60, ts: Date.now() };
    } catch (e) { t.way = { err: "שרת" }; }
    renderRoute();
  }
  const trColor = p => p.closed ? "var(--no)" : p.ratio == null ? "var(--line)" : p.ratio >= 0.8 ? "var(--go)" : p.ratio >= 0.55 ? "var(--caution)" : "var(--no)";
  function trStrip(t) {
    const pts = t.pts || []; const total = t.km || (pts.length ? pts[pts.length - 1].km : 1);
    const worst = pts.filter(p => p.closed || (p.ratio != null && p.ratio < 0.7)).sort((a, b) => (a.closed ? -1 : a.ratio) - (b.closed ? -1 : b.ratio)).slice(0, 3);
    const ok = pts.filter(p => p.ratio != null).length;
    return `<div class="trstrip" dir="ltr">${pts.map(p => `<i style="background:${trColor(p)}"></i>`).join("")}</div>
      <div class="small muted">${ok ? (worst.length ? worst.map(p => p.closed ? `ק״מ ${Math.round(p.km)}: כביש סגור` : `ק״מ ${Math.round(p.km)}: ${Math.round(p.cur)} קמ״ש במקום ${Math.round(p.free)}`).join(" · ") : "פנוי לכל האורך") : "אין נתוני תנועה לקטעים האלה"}</div>`;
  }
  function trafficCard(id) {
    const c = CHAPTERS.find(x => x.id === id); const s = c.stops[0];
    const waze = `https://www.waze.com/live-map/directions?to=ll.${s.lat.toFixed(5)}%2C${s.lon.toFixed(5)}`;
    if (!st.cfg.traffic) return `<div class="card"><div class="row" style="justify-content:space-between"><h3>עומסים עכשיו</h3><a class="navb w" target="_blank" rel="noopener" href="${waze}">${NAVI.w}<span>מפת התנועה</span></a></div><p class="small muted" style="margin:0">שכבת התנועה החיה עוד לא חוברה לאפליקציה. בינתיים, מפת התנועה של Waze פתוחה עם היעד של הפרק.</p></div>`;
    const t = st.traffic[id];
    let h = `<div class="card traffic"><div class="row" style="justify-content:space-between"><h3>עומסים עכשיו</h3><span class="small muted">${t && t.pts ? `עודכן ${fmtT(new Date(t.ts))}` : t && t.busy ? "טוען…" : ""}</span></div>`;
    h += t && t.pts ? `<div class="small" style="font-weight:700">לאורך הפרק</div>${trStrip(t)}` : t && t.err ? `<p class="small muted" style="margin:0">שירות התנועה לא ענה. נסו שוב בעוד דקה.</p>` : `<div class="trstrip skel"></div>`;
    const w = t && t.way;
    h += w && w.pts ? `<div class="small" style="font-weight:700;margin-top:4px">מהמיקום שלך עד תחילת הפרק · ${Math.round(w.km)} ק״מ, כ־${Math.round(w.min)} דק׳</div>${trStrip(w)}`
      : `<div class="row"><button type="button" class="btn sm" id="trWay">${w && w.busy ? "בודק…" : "עומסים בדרך אל הפרק"}</button><button type="button" class="btn sm" id="trRe">רענון</button><a class="navb w" target="_blank" rel="noopener" href="${waze}">${NAVI.w}<span>Waze</span></a></div>${w && w.err ? `<div class="small muted">${w.err === "מיקום" ? "אין גישה למיקום." : "לא הצלחתי לחשב את הדרך."}</div>` : ""}`;
    return h + `<div class="legend"><span><i style="background:var(--go)"></i>זורם</span><span><i style="background:var(--caution)"></i>איטי</span><span><i style="background:var(--no)"></i>עומס או סגור</span><span class="small">TomTom</span></div></div>`;
  }
  function bindTraffic(id) {
    if ($("trWay")) $("trWay").onclick = () => trafficOnTheWay(id);
    if ($("trRe")) $("trRe").onclick = () => loadTraffic(id, true);
  }

  /* ---------- route builder: search, waypoints, preferences, save and share ---------- */
  const DRAFT = "draft";
  function startBuild(from) {
    const prefs = Object.assign({}, st.buildPrefs, from && from.opts);
    st.build = { editing: from ? from.id : null, title: from ? from.title : "", pts: from ? from.stops.map(s => ({ name: s.name, lat: s.lat, lon: s.lon })) : [], opts: prefs, results: [], q: "" };
    st.prevChap = st.chap; syncDraft(); setTab("route"); if (innerWidth < 900) setSheet("full");
  }
  function syncDraft() {
    const i = CHAPTERS.findIndex(c => c.id === DRAFT); if (i >= 0) CHAPTERS.splice(i, 1);
    ["routes", "curves", "cstats", "glare", "elev", "terr", "traffic"].forEach(k => delete st[k][DRAFT]);
    const b = st.build; if (!b || b.pts.length < 2) { if (st.chap === DRAFT || !CHAPTERS.some(c => c.id === st.chap)) st.chap = st.prevChap && st.prevChap !== DRAFT && CHAPTERS.some(c => c.id === st.prevChap) ? st.prevChap : "c1"; pushSources(); renderMarkers(); return; }
    const c = customChapter({ id: DRAFT, title: b.title || "המסלול שלי", stops: b.pts, opts: b.opts }); CHAPTERS.push(c); st.chap = DRAFT;
    clearTimeout(syncDraft.t); syncDraft.t = setTimeout(async () => { const r = await loadRoute(c); if (!CHAPTERS.includes(c)) return; processRoute(c, r); pushSources(); renderMarkers(); renderRoute(); fitChapter(); loadElev(DRAFT).then(() => st.tab === "route" && renderRoute()); }, 350);
  }
  function builderPanel() {
    const b = st.build;
    return `<div class="builder"><div class="row" style="justify-content:space-between"><h2>${b.editing ? "עריכת מסלול" : "מסלול משלי"}</h2><button type="button" class="btn sm" id="bbClose">סגירה</button></div>
      <div class="search"><input id="bbQ" type="search" enterkeyhint="search" autocomplete="off" placeholder="חיפוש מקום, צומת, בית קפה או תחנה" value="${esc(b.q)}" aria-label="חיפוש מקום"><div class="sres" id="bbRes">${resultsHtml()}</div></div>
      <div class="row"><button type="button" class="btn sm" id="bbMe">${IC.nav}המיקום שלי</button><button type="button" class="btn sm" id="bbPick" aria-pressed="${!!st.picking}">${st.picking ? "הקישו על המפה…" : "בחירה על המפה"}</button></div>
      <ol class="wps">${b.pts.map((p, i) => `<li><span class="num ${i === 0 ? "" : i === b.pts.length - 1 ? "view" : ""}">${i + 1}</span><span class="grow">${esc(p.name)}</span><button type="button" class="ic-btn" data-up="${i}" aria-label="הזזה למעלה" ${i ? "" : "disabled"}>↑</button><button type="button" class="ic-btn" data-dn="${i}" aria-label="הזזה למטה" ${i < b.pts.length - 1 ? "" : "disabled"}>↓</button><button type="button" class="ic-btn" data-rm="${i}" aria-label="הסרה">✕</button></li>`).join("") || `<li class="small muted" style="display:block">הוסיפו לפחות שתי נקודות: חיפוש, המיקום שלכם או נגיעה במפה.</li>`}</ol>
      <div class="row small"><label class="toggle"><input type="checkbox" id="bbNoHw" ${b.opts.noHighway ? "checked" : ""}> בלי כבישים מהירים</label><label class="toggle"><input type="checkbox" id="bbLoop" ${b.opts.loop ? "checked" : ""}> חזרה להתחלה</label></div>
      <div class="row"><input id="bbName" class="btn" style="flex:1;min-width:0;text-align:right" maxlength="40" placeholder="שם למסלול" value="${esc(b.title)}" aria-label="שם המסלול"><button type="button" class="btn primary" id="bbSave" ${b.pts.length < 2 ? "disabled" : ""}>שמירה</button>${b.editing ? `<button type="button" class="btn" id="bbDel">מחיקה</button>` : ""}</div>
      <div class="small muted">ההעדפות (בלי כבישים מהירים, חזרה להתחלה) נשמרות למסלולים הבאים. המסלולים נשמרים במכשיר, ואפשר לשלוח קישור לחברים.</div></div>`;
  }
  function resultsHtml() {
    const b = st.build; if (!b || !b.q) return "";
    if (!b.results.length) return b.searching ? `<div class="small muted sr">מחפש…</div>` : `<div class="small muted sr">לא נמצאו תוצאות</div>`;
    return b.results.map((r, i) => `<button type="button" class="sr" data-add="${i}"><span class="sr-k">${r.k}</span><span class="grow"><b>${esc(r.name)}</b><span class="small muted">${esc(r.sub || "")}</span></span><span class="sr-plus">＋</span></button>`).join("");
  }
  function localSearch(q) {
    const t = q.trim().toLowerCase(); if (t.length < 2) return [];
    const out = [], seen = new Set(); const add = (name, sub, lat, lon, k) => { const key = name + lat.toFixed(3); if (seen.has(key) || !name) return; seen.add(key); out.push({ name, sub, lat, lon, k }); };
    CHAPTERS.filter(c => !c.custom).forEach(c => c.stops.forEach(s => s.name.toLowerCase().includes(t) && add(s.name.split(" · ")[0], c.title, s.lat, s.lon, "עצירה")));
    CAFES.forEach(c => (c.name + " " + c.place).toLowerCase().includes(t) && add(c.name, c.place, c.lat, c.lon, "קפה"));
    if (st.osm) { st.osm.views.forEach(v => v.name && v.name.toLowerCase().includes(t) && add(v.name, "מצפור", v.lat, v.lon, "מצפור")); st.osm.fuel.forEach(f => ((f.name || "") + " " + (f.brand || "")).toLowerCase().includes(t) && add(f.name || f.brand, "תחנת דלק" + (f.brand && f.name ? " · " + f.brand : ""), f.lat, f.lon, "דלק")); }
    return out.slice(0, 6);
  }
  async function remoteSearch(q) {
    const ctl = new AbortController(); remoteSearch.ctl && remoteSearch.ctl.abort(); remoteSearch.ctl = ctl;
    const c = map.getCenter();
    try {
      const r = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=8&lat=${c.lat.toFixed(3)}&lon=${c.lng.toFixed(3)}&bbox=34.2,29.4,35.95,33.45`, { signal: ctl.signal });
      const j = await r.json();
      return j.features.map(f => { const p = f.properties; const [lon, lat] = f.geometry.coordinates; const sub = [p.street, p.city || p.county, p.state].filter(Boolean).join(", "); return { name: p.name || p.street || p.city, sub, lat, lon, k: p.osm_value === "fuel" ? "דלק" : p.osm_key === "highway" ? "כביש" : p.osm_key === "place" ? "יישוב" : "מקום" }; }).filter(x => x.name);
    } catch (e) {
      if (e.name === "AbortError") throw e;
      try { const j = await (await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(q)}&countrycodes=il,ps&accept-language=he&limit=8`, { signal: ctl.signal })).json(); return j.map(x => ({ name: x.name || x.display_name.split(",")[0], sub: x.display_name.split(",").slice(1, 3).join(","), lat: +x.lat, lon: +x.lon, k: "מקום" })); } catch (e2) { return []; }
    }
  }
  function refreshResults() { const el = $("bbRes"); if (el) { el.innerHTML = resultsHtml(); el.querySelectorAll("[data-add]").forEach(x => x.onclick = () => { const r = st.build.results[+x.dataset.add]; addPoint(r.name, r.lat, r.lon); }); } }
  function addPoint(name, lat, lon) {
    const b = st.build; b.pts.push({ name, lat: +(+lat).toFixed(5), lon: +(+lon).toFixed(5) }); b.q = ""; b.results = [];
    syncDraft(); renderRoute(); toast(`נוסף: ${name}`, 1600);
  }
  function setPick(on) { st.picking = on; map.getCanvas().style.cursor = on ? "crosshair" : ""; }
  map.on("click", e => {
    if (!st.picking || !st.build) return;
    const { lng, lat } = e.lngLat; setSrc("br-pick", FC([{ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [lng, lat] } }]));
    addPoint(`נקודה ${st.build.pts.length + 1}`, lat, lng);
    fetch(`https://photon.komoot.io/reverse?lat=${lat.toFixed(5)}&lon=${lng.toFixed(5)}&limit=1`).then(r => r.json()).then(j => { const p = j.features[0] && j.features[0].properties; const pt = st.build && st.build.pts.find(x => Math.abs(x.lat - lat) < 1e-4 && Math.abs(x.lon - lng) < 1e-4); if (p && pt) { pt.name = p.name || [p.street, p.city].filter(Boolean).join(", ") || pt.name; if (st.tab === "route") renderRoute(); } }).catch(() => { });
  });
  function bindBuilder() {
    const b = st.build; const q = $("bbQ");
    q.oninput = () => {
      b.q = q.value; b.results = localSearch(b.q); b.searching = b.q.trim().length >= 2; refreshResults();
      clearTimeout(bindBuilder.t); if (b.q.trim().length < 2) return;
      bindBuilder.t = setTimeout(async () => { try { const rem = await remoteSearch(b.q); const loc = localSearch(b.q); b.results = loc.concat(rem.filter(r => !loc.some(l => L.hav([l.lon, l.lat], [r.lon, r.lat]) < 0.2))).slice(0, 10); } catch (e) { return; } b.searching = false; refreshResults(); }, 320);
    };
    q.onkeydown = e => { if (e.key === "Enter" && b.results[0]) { e.preventDefault(); addPoint(b.results[0].name, b.results[0].lat, b.results[0].lon); } };
    refreshResults();
    $("bbClose").onclick = () => { st.build = null; setPick(false); setSrc("br-pick", FC()); syncDraft(); if (innerWidth < 900) setSheet("half"); renderRoute(); fitChapter(); };
    $("bbMe").onclick = () => navigator.geolocation && navigator.geolocation.getCurrentPosition(p => addPoint("המיקום שלי", p.coords.latitude, p.coords.longitude), () => toast("אין גישה למיקום"), { timeout: 8000, enableHighAccuracy: true });
    $("bbPick").onclick = () => { setPick(!st.picking); if (st.picking && innerWidth < 900) setSheet("peek"); renderRoute(); };
    $("p-route").querySelectorAll("[data-up],[data-dn],[data-rm]").forEach(x => x.onclick = () => {
      const i = +(x.dataset.up ?? x.dataset.dn ?? x.dataset.rm);
      if (x.dataset.rm != null) b.pts.splice(i, 1); else { const j = x.dataset.up != null ? i - 1 : i + 1; [b.pts[i], b.pts[j]] = [b.pts[j], b.pts[i]]; }
      syncDraft(); renderRoute();
    });
    const prefs = () => { b.opts = { noHighway: $("bbNoHw").checked, loop: $("bbLoop").checked }; st.buildPrefs = Object.assign({}, b.opts); LS.set("buildPrefs", st.buildPrefs); syncDraft(); };
    $("bbNoHw").onchange = prefs; $("bbLoop").onchange = prefs;
    $("bbName").oninput = e => { b.title = e.target.value; };
    $("bbSave").onclick = () => saveBuild();
    if ($("bbDel")) $("bbDel").onclick = () => { if ($("bbDel").dataset.sure) { deleteRoute(b.editing); } else { $("bbDel").dataset.sure = "1"; $("bbDel").textContent = "למחוק? לחצו שוב"; } };
  }
  function saveBuild() {
    const b = st.build; if (b.pts.length < 2) return;
    const title = (b.title || "").trim() || `${b.pts[0].name.split(",")[0]} ← ${b.pts[b.pts.length - 1].name.split(",")[0]}`;
    const id = b.editing || "u" + Date.now().toString(36);
    const rec = { id, title, stops: b.pts, opts: b.opts };
    const i = st.myRoutes.findIndex(u => u.id === id); if (i >= 0) st.myRoutes[i] = rec; else st.myRoutes.push(rec); LS.set("myRoutes", st.myRoutes);
    const ci = CHAPTERS.findIndex(c => c.id === id); const c = customChapter(rec); if (ci >= 0) CHAPTERS[ci] = c; else CHAPTERS.push(c);
    const draft = st.routes[DRAFT]; st.build = null; setPick(false); setSrc("br-pick", FC()); syncDraft();
    if (draft) processRoute(c, draft); else loadRoute(c).then(r => { processRoute(c, r); renderRoute(); });
    if (st.elev[DRAFT]) st.elev[id] = st.elev[DRAFT];
    setChap(id); if (innerWidth < 900) setSheet("half"); toast("המסלול נשמר");
  }
  function deleteRoute(id) {
    st.myRoutes = st.myRoutes.filter(u => u.id !== id); LS.set("myRoutes", st.myRoutes);
    const i = CHAPTERS.findIndex(c => c.id === id); if (i >= BUILT_IN) CHAPTERS.splice(i, 1);
    st.build = null; setPick(false); syncDraft(); setChap("c1"); toast("המסלול נמחק");
  }
  const toB64u = s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const unb64u = s => decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/"))));
  async function shareRoute(c) {
    const data = { t: c.title, o: c.opts || {}, p: c.stops.map(s => [s.name, +s.lat.toFixed(5), +s.lon.toFixed(5)]) };
    const url = `${location.origin}${location.pathname}?r=${toB64u(JSON.stringify(data))}`;
    try { if (navigator.share) await navigator.share({ title: "Blue Ronin · " + c.title, text: "מסלול רכיבה: " + c.title, url }); else { await navigator.clipboard.writeText(url); toast("הקישור למסלול הועתק"); } } catch (e) { }
  }
  function importShared() {
    const q = new URLSearchParams(location.search).get("r"); if (!q) return;
    try {
      const d = JSON.parse(unb64u(q)); history.replaceState(null, "", location.pathname + location.hash);
      if (!Array.isArray(d.p) || d.p.length < 2) return;
      st.build = { editing: null, title: String(d.t || "").slice(0, 40), pts: d.p.slice(0, 25).map(([name, lat, lon]) => ({ name: String(name).slice(0, 60), lat: +lat, lon: +lon })).filter(p => isFinite(p.lat) && isFinite(p.lon)), opts: { noHighway: !!(d.o && d.o.noHighway), loop: !!(d.o && d.o.loop) }, results: [], q: "" };
      st.prevChap = st.chap; syncDraft(); setTab("route"); toast("קיבלתם מסלול מחבר. שמרו אותו כדי שיישאר.");
    } catch (e) { }
  }

  /* ---------- turn-by-turn steps from OSRM ---------- */
  async function loadSteps(c, route) {
    const key = "steps:v2:" + routeKey(c); const cached = LS.get(key, null); if (cached) return cached;
    try {
      const j = await (await fetch(osrmUrl(c, "&steps=true"))).json(); if (j.code !== "Ok") throw 0;
      const legs = j.routes[0].legs; const out = []; let from = 0; const coords = route.coords, cum = route.cum;
      legs.forEach((lg, li) => lg.steps.forEach(sp => {
        const m = sp.maneuver; if (m.type === "depart" && li > 0) return; if (m.type === "arrive" && li < legs.length - 1) { out.push(stepRec(m, sp, false)); return; }
        out.push(stepRec(m, sp, li === legs.length - 1));
      }));
      function stepRec(m, sp, last) { const loc = m.location; let bi = from, bd = 1e9; for (let i = from; i < coords.length; i++) { const d = (coords[i][0] - loc[0]) ** 2 + (coords[i][1] - loc[1]) ** 2; if (d < bd) { bd = d; bi = i; } if (d > bd * 400 && i > bi + 400) break; } from = bi;
        return { km: +cum[bi].toFixed(3), type: m.type, modifier: m.modifier || "", exit: m.exit || 0, name: sp.name || "", ref: sp.ref || "", last }; }
      LS.set(key, out); return out;
    } catch (e) { return null; }
  }
  /* Voice: Hebrew speech when the phone has a Hebrew voice. */
  let heVoice = null;
  const pickVoice = () => { try { heVoice = speechSynthesis.getVoices().find(v => /^he|iw/i.test(v.lang)) || null; } catch (e) { } };
  if ("speechSynthesis" in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
  function say(text) {
    if (!st.voice || !("speechSynthesis" in window)) return;
    try { const u = new SpeechSynthesisUtterance(text); u.lang = "he-IL"; if (heVoice) u.voice = heVoice; u.rate = 1.02; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch (e) { }
  }
  const distTxt = km => km >= 1 ? `${km.toFixed(km >= 10 ? 0 : 1)} ק״מ` : `${Math.max(10, Math.round(km * 1000 / 10) * 10)} מ׳`;
  const distSpeak = km => km >= 1 ? `${km >= 10 ? Math.round(km) : km.toFixed(1)} קילומטר` : `${Math.round(km * 1000 / 50) * 50} מטר`;
  function arrowSvg(m) {
    const a = L.arrowAngle(m);
    if (a === null) return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-6-5.6-6-10a6 6 0 0 1 12 0c0 4.4-6 10-6 10z"/><circle cx="12" cy="11" r="2"/></svg>';
    if (a === "rb") return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22v-4.2"/><path d="M8.2 15.2A4.6 4.6 0 1 1 15.8 15.2"/><path d="m14 15.6 1.9-.3.3-2"/><path d="M12 8.6V2.5"/><path d="m9 5.4 3-3 3 3"/></svg>`;
    if (a === 180) return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 21V9a4 4 0 0 0-8 0v4"/><path d="m4 10 3 3 3-3"/></svg>';
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" style="transform:rotate(${a}deg)"><path d="M12 21V5"/><path d="m6 11 6-6 6 6"/></svg>`;
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
    <div class="card"><h3>תצוגה ונתונים</h3><div class="row"><label for="themeSel" class="small muted">ערכת צבע</label><select id="themeSel" class="btn"><option value="system">לפי המכשיר</option><option value="dark">לילה</option><option value="light">יום</option></select></div><label class="toggle small"><input type="checkbox" id="introSnd" ${LS.get("introSound", true) ? "checked" : ""}> צליל הנעה בפתיחת האפליקציה</label><div class="row"><button type="button" class="btn" id="refAll">רענון כל הנתונים</button></div><p class="small muted" style="margin:0">מזג אוויר: ${st.wx ? ago(st.wx.ts) : "—"} · OSM: ${st.osm ? ago(st.osm.ts) : "—"} · מסלולים: OSRM, נשמרים במכשיר</p></div>
    <div class="small muted">מפה: OpenFreeMap ו־OpenStreetMap (ODbL) · מזג אוויר וגבהים: Open-Meteo (CC BY 4.0) · מכ״ם: RainViewer · ניתוב: OSRM · תבליט: Mapzen/AWS · שקיעה וזריחה: SunCalc. בתי קפה: טיולי, mako, מעריב. אכיפה: וואלה (2012), ynetnews (2026).</div>`;
    $("p-tools").innerHTML = h;
    $("offGo").onclick = downloadOffline;
    if ($("instGo")) $("instGo").onclick = async () => { installEvt.prompt(); await installEvt.userChoice; installEvt = null; renderTools(); };
    $("icsGo").onclick = ics; $("shareGo").onclick = share; $("repGo").onclick = report; renderPush();
    $("themeSel").value = st.theme; $("themeSel").onchange = e => { st.theme = e.target.value; LS.set("theme", st.theme); applyTheme(); const want = isDark() ? "dark" : "liberty"; if (want !== styleName) { styleName = want; styleReady = false; map.setStyle(OFM + styleName, { diff: false }); } };
    $("introSnd").onchange = e => { LS.set("introSound", e.target.checked); toast(e.target.checked ? "הצליל יתנגן בפתיחה הבאה" : "הפתיחה תהיה שקטה"); };
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
      for (let z = 5; z <= 12; z++) add(tpl, L.tilesForBbox(CENTER_BOUNDS, z));
      CHAPTERS.forEach(c => { const r = st.routes[c.id]; if (r) { const s = L.simplifyByDist(r.coords, 0.5); add(tpl, L.tilesAlong(s, 14, 1)); } });
      for (let z = 7; z <= 11; z++) add(DEM.tiles[0], L.tilesForBbox(NORTH_BOUNDS, z));
      for (let z = 7; z <= 11; z++) add(DEM.tiles[0], L.tilesForBbox(CENTER_BOUNDS, z));
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

  /* ---------- fly-through: a chase camera behind a motorcycle on a smoothed copy of the route ---------- */
  const BIKE_SVG = '<svg viewBox="0 0 40 72" aria-hidden="true"><defs><radialGradient id="bkGlow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#5C8DFF" stop-opacity=".55"/><stop offset="1" stop-color="#5C8DFF" stop-opacity="0"/></radialGradient></defs><ellipse cx="20" cy="38" rx="20" ry="32" fill="url(#bkGlow)"/><rect x="17" y="3" width="6" height="15" rx="3" fill="#0B1220"/><rect x="17" y="54" width="6" height="15" rx="3" fill="#0B1220"/><path d="M20 8c5 0 8 6 8.5 14l1 18c.3 7-3 13-9.5 13S10.2 47 10.5 40l1-18C12 14 15 8 20 8z" fill="#2457E6" stroke="#fff" stroke-width="1.6"/><path d="M8 21h24" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><path d="M15 13.5c1.5-1.6 3.2-2.3 5-2.3s3.5.7 5 2.3" fill="none" stroke="#9FC0FF" stroke-width="1.6"/><ellipse cx="20" cy="33" rx="6.2" ry="7.5" fill="#0B1220"/><circle cx="20" cy="27" r="5.4" fill="#F2F5FA" stroke="#0B1220" stroke-width="1.2"/><path d="M16.2 25.4a4 4 0 0 1 7.6 0" fill="none" stroke="#FFA24A" stroke-width="2"/></svg>';
  /* Tile warm-up: fetches vector and DEM tiles ahead of the camera into the HTTP and service-worker
     caches, so MapLibre finds them locally by the time the bike gets there. Nearest first, 6 at a time. */
  const TQ = { q: [], busy: 0, seen: new Map() };
  function warmTile(u) {
    if (TQ.seen.has(u)) return TQ.seen.get(u);
    if (TQ.seen.size > 6000) TQ.seen.clear();
    const p = new Promise(res => TQ.q.push({ u, res })); TQ.seen.set(u, p); pumpTiles(); return p;
  }
  function pumpTiles() {
    while (TQ.busy < 6 && TQ.q.length) {
      const { u, res } = TQ.q.shift(); TQ.busy++;
      fetch(u, { mode: "cors", priority: "low" }).then(r => r.ok ? r.arrayBuffer() : 0).catch(() => 0).finally(() => { TQ.busy--; res(); pumpTiles(); });
    }
  }
  function dropTileQueue() { TQ.q.splice(0).forEach(x => { TQ.seen.delete(x.u); x.res(); }); }
  function tileTemplates() {
    const out = []; const style = map.getStyle();
    for (const id of Object.keys(style.sources)) { const so = map.getSource(id); if (so && so.type === "vector" && so.tiles && so.tiles[0]) out.push({ t: so.tiles[0], kind: "v" }); }
    out.push({ t: DEM.tiles[0], kind: "d" }); return out;
  }
  /* How far ahead (km) each zoom level is worth having: the pitched camera sees low zooms far away. */
  const WARM = { v: { 14: 4, 13: 9, 12: 18, 11: 36 }, d: { 13: 5, 12: 12, 11: 26 } };
  function warmAhead(F, fromKm, toKm) {
    const P = F.P, out = [], key = (tp, z, x, y) => tp.t.replace("{z}", z).replace("{x}", x).replace("{y}", y);
    const stepI = Math.max(1, Math.round(0.35 / P.step));
    for (let i = Math.max(0, Math.floor(fromKm / P.step)), k = 0; i < P.n && i * P.step <= toKm; i += stepI, k++) {
      const d = i * P.step - fromKm, pt = P.pts[i];
      for (const tp of F.tpl) for (const z in WARM[tp.kind]) if (d <= WARM[tp.kind][z] && (z > 12 || k % 3 === 0)) L.tilesAlong([pt], +z, 1).forEach(([zz, x, y]) => out.push(warmTile(key(tp, zz, x, y))));
    }
    return Promise.all(out);
  }
  function warmWhole(F) {
    const s = L.simplifyByDist(F.P.pts, 2), out = [];
    for (const tp of F.tpl) [9, 10].forEach(z => L.tilesAlong(s, z, 1).forEach(([zz, x, y]) => out.push(warmTile(tp.t.replace("{z}", zz).replace("{x}", x).replace("{y}", y)))));
    return Promise.all(out);
  }

  /* Critically damped springs: smooth, no overshoot, frame-rate independent. */
  const spring = (S, target, w, dt) => { S.v += (w * w * (target - S.x) - 2 * w * S.v) * dt; S.x += S.v * dt; };
  const springAng = (S, target, w, dt) => { const d = ((target - S.x + 540) % 360) - 180; S.v += (w * w * d - 2 * w * S.v) * dt; S.x = (S.x + S.v * dt + 360) % 360; };
  function flyAt(P, km) {
    const fi = Math.max(0, Math.min(P.n - 1.001, km / P.step)), i0 = Math.floor(fi), t = fi - i0, a = P.pts[i0], b = P.pts[i0 + 1];
    return { i: i0, p: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t] };
  }
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  function startFly() {
    if (st.fly) return stopFly();
    const c = chap(), r = st.routes[st.chap]; if (!r) return;
    const P = L.flyPath(r.coords, r.km > 250 ? 0.025 : 0.015);
    const segs = st.curves[st.chap] || []; const cls = new Uint8Array(P.n);
    for (let i = 0, si = 0; i < P.n; i++) { const km = i * P.step; while (si < segs.length - 1 && segs[si].startKm + segs[si].km < km) si++; cls[i] = segs[si] ? segs[si].cls : 0; }
    const base = Math.min(2.4, Math.max(0.5, P.km / 85));
    const el = document.createElement("div"); el.className = "bike"; el.innerHTML = BIKE_SVG;
    const cam = map.getCenter();
    st.fly = { c, P, cls, E: st.elev[st.chap], km: 0, rate: LS.get("flyRate", 1), playing: false, loading: true, last: null, base, v: 0, uiT: 0, trT: 0, pfKm: -99, tpl: tileTemplates(),
      brg: { x: map.getBearing(), v: 0 }, bh: { x: P.head[0], v: 0 }, zoom: { x: map.getZoom(), v: 0 }, pitch: { x: map.getPitch(), v: 0 },
      from: [cam.lng, cam.lat], blend: 0, prevExag: st.terrain ? 1.5 : null,
      marker: new maplibregl.Marker({ element: el, rotationAlignment: "map", pitchAlignment: "map" }).setLngLat(P.pts[0]).addTo(map) };
    const F = st.fly;
    /* A touch less relief while flying: the camera rides the ground, so less bounce on steep roads. */
    st.terrain = true; $("f3d").setAttribute("aria-pressed", "true"); map.setTerrain({ source: "dem", exaggeration: 1.2 });
    if (innerWidth < 900) setSheet("peek"); document.body.classList.add("flying"); closeLayers(); renderMarkers();
    $("fFly").setAttribute("aria-pressed", "true"); $("flTitle").textContent = c.title; flyUI();
    map.getCanvas().addEventListener("pointerdown", flyTouch, { passive: true });
    F.raf = requestAnimationFrame(flyStep);
    /* Pre-roll: the camera swoops down to the start while the first kilometres and the route overview
       load, then the ride begins. Never waits more than ~3 s. */
    (async () => {
      const first = Promise.all([warmAhead(F, 0, 6), warmWhole(F)]);
      await Promise.race([first, sleep(2600)]);
      if (st.fly !== F) return;
      await Promise.race([new Promise(res => map.once("idle", res)), sleep(900)]);
      if (st.fly !== F) return;
      F.loading = false; F.playing = !F.hold; F.pfKm = 0; flyUI();
    })();
  }
  /* a touch hands the camera to the rider: pause, and stop every spring so nothing fights the finger */
  function flyTouch() { const F = st.fly; if (!F) return; if (F.loading) F.hold = true; if (F.playing) F.playing = false; F.brg.v = 0; F.zoom.v = 0; F.pitch.v = 0; F.blend = 1; flyUI(); }
  function flySnap(F) {
    const P = F.P, { p, i } = flyAt(P, F.km), la = flyAt(P, F.km + 0.6).p, bk = flyAt(P, F.km - 0.1).p;
    F.brg = { x: L.bearing(bk, la), v: 0 }; F.bh = { x: P.head[i], v: 0 }; F.blend = 1; F.snap = false; F.force = true;
    return p;
  }
  function flyStep(ts) {
    const F = st.fly; if (!F) return;
    const DT = F.last == null ? 1 / 60 : Math.min(0.25, (ts - F.last) / 1000); F.last = ts;
    const P = F.P;
    if (F.snap) flySnap(F);
    /* sub-steps keep the springs stable on slow frames */
    const nSub = Math.max(1, Math.ceil(DT / (1 / 90))), dt = DT / nSub;
    let pos, i0;
    for (let s = 0; s < nSub; s++) {
      if (F.playing) {
        const i = Math.min(P.n - 1, Math.round(F.km / P.step)), ahead = Math.min(P.n - 1, i + Math.round(0.5 / P.step));
        let mx = 0; for (let k = i; k <= ahead; k += 3) if (F.cls[k] > mx) mx = F.cls[k];
        const left = P.km - F.km, endEase = Math.max(0.08, Math.min(1, left / 0.9));
        const target = F.base * F.rate * [1.35, 1.0, 0.62, 0.44][mx] * endEase;
        F.v += (target - F.v) * (1 - Math.exp(-dt * 1.4));
        F.km = Math.min(P.km, F.km + F.v * dt);
        if (F.km >= P.km - 0.002) { F.km = P.km; F.playing = false; F.v = 0; flyUI(); }
      } else F.v *= Math.exp(-dt * 4);
      const at = flyAt(P, F.km); pos = at.p; i0 = at.i;
      /* camera heading: the chord from just behind the bike to a point ahead that grows with speed,
         so it reads the road's direction instead of every wiggle */
      const la = Math.max(0.28, Math.min(1.5, 0.22 + F.v * 0.7));
      const tgt = L.bearing(flyAt(P, F.km - 0.08).p, flyAt(P, F.km + la).p);
      springAng(F.brg, tgt, F.loading ? 1.6 : 1.9, dt);
      springAng(F.bh, P.head[i0], 11, dt);
      let mxNear = 0; const j1 = Math.min(P.n - 1, i0 + Math.round(0.3 / P.step)); for (let k = i0; k <= j1; k += 4) if (F.cls[k] > mxNear) mxNear = F.cls[k];
      const zt = [13.45, 13.9, 14.3, 14.6][mxNear] - 0.32 * Math.log2(Math.max(1, F.rate));
      spring(F.zoom, F.loading ? zt - 0.25 : zt, F.blend < 1 ? 2.2 : 0.9, dt);
      spring(F.pitch, 62, F.blend < 1 ? 2.2 : 1.4, dt);
      if (F.blend < 1) F.blend = Math.min(1, F.blend + dt / 1.6);
    }
    F.marker.setLngLat(pos).setRotation(F.bh.x);
    if (F.force || (!F.hold && (F.playing || F.loading || F.blend < 1 || Math.abs(F.brg.v) > 0.05 || Math.abs(F.zoom.v) > 0.002))) {
      F.force = false;
      const Hh = map.getCanvas().clientHeight, e = F.blend * F.blend * (3 - 2 * F.blend);
      const center = e >= 1 ? pos : [F.from[0] + (pos[0] - F.from[0]) * e, F.from[1] + (pos[1] - F.from[1]) * e];
      map.jumpTo({ center, bearing: F.brg.x, pitch: F.pitch.x, zoom: F.zoom.x, padding: { top: Math.round(Hh * 0.38 * e), bottom: 0, left: 0, right: 0 } });
    }
    if (F.playing && F.km - F.pfKm > 1.2) { F.pfKm = F.km; warmAhead(F, F.km, F.km + 36); }
    if (ts - F.trT > 500) { F.trT = ts; const step = Math.max(1, Math.round(i0 / 500)); const line = []; for (let k = 0; k <= i0; k += step) line.push(P.pts[k]); line.push(pos); setSrc("br-fly", FC(line.length > 1 ? [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: line } }] : [])); }
    if (ts - F.uiT > 200) { F.uiT = ts; flyInfo(i0); }
    F.raf = requestAnimationFrame(flyStep);
  }
  function flyInfo(i0) {
    const F = st.fly; if (!F) return; const P = F.P;
    let elv = ""; if (F.E && F.E.el) { const j = Math.min(F.E.el.length - 1, Math.round(F.km / F.E.km * (F.E.el.length - 1))); elv = ` · ${Math.round(F.E.el[j])} מ׳`; }
    if (F.loading) { $("flInfo").textContent = "טוען את הדרך מראש…"; return; }
    const dk = P.km < 40 ? 1 : 0; $("flInfo").textContent = `ק״מ ${F.km.toFixed(dk)} / ${P.km.toFixed(dk)}${elv} · ${L.CURVE_LABEL[F.cls[i0]]}`;
    if (!flySeeking) $("flSeek").value = Math.round(F.km / P.km * 1000);
  }
  let flySeeking = false;
  function flyUI() {
    const F = st.fly; const ui = $("flyui"); ui.hidden = !F; if (!F) return;
    $("flPlay").innerHTML = F.playing ? '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>' : '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l12-7.5z"/></svg>';
    $("flPlay").setAttribute("aria-label", F.playing ? "השהיה" : "המשך");
    document.querySelectorAll("#flyui [data-rate]").forEach(x => x.setAttribute("aria-pressed", String(+x.dataset.rate === F.rate)));
  }
  $("flPlay").onclick = () => { const F = st.fly; if (!F || F.loading) return; if (F.km >= F.P.km) { F.km = 0; F.snap = true; }
    if (!F.playing) { const cm = map.getCenter(); F.from = [cm.lng, cm.lat]; F.blend = 0; F.brg.x = map.getBearing(); F.brg.v = 0; F.zoom.x = map.getZoom(); F.zoom.v = 0; F.pitch.x = map.getPitch(); F.pfKm = -99; }
    F.hold = false; F.playing = !F.playing; flyUI(); };
  $("flClose").onclick = () => stopFly(true);
  document.querySelectorAll("#flyui [data-rate]").forEach(x => x.onclick = () => { const F = st.fly; if (!F) return; F.rate = +x.dataset.rate; LS.set("flyRate", F.rate); flyUI(); });
  $("flSeek").addEventListener("input", e => { const F = st.fly; if (!F) return; flySeeking = true; F.km = e.target.value / 1000 * F.P.km; F.snap = true; F.v = F.base * 0.5; F.pfKm = -99; warmAhead(F, F.km, F.km + 8); });
  $("flSeek").addEventListener("change", () => { flySeeking = false; });
  function stopFly(done) {
    const F = st.fly; if (!F) return;
    cancelAnimationFrame(F.raf); F.marker.remove(); st.fly = null; setSrc("br-fly", FC()); dropTileQueue(); renderMarkers();
    map.setTerrain({ source: "dem", exaggeration: 1.5 });
    map.getCanvas().removeEventListener("pointerdown", flyTouch); document.body.classList.remove("flying");
    $("fFly").setAttribute("aria-pressed", "false"); flyUI(); map.setPadding({ top: 0, bottom: 0, left: 0, right: 0 });
    if (done) fitChapter(1400);
  }

  /* ---------- 3D ---------- */
  function toggle3d(on) {
    st.terrain = on ?? !st.terrain; $("f3d").setAttribute("aria-pressed", String(st.terrain));
    if (st.terrain) { map.setTerrain({ source: "dem", exaggeration: 1.5 }); map.easeTo({ pitch: 58, duration: 900 }); }
    else { map.setTerrain(null); map.easeTo({ pitch: 0, duration: 700 }); }
  }

  /* ---------- locate + ride mode with turn-by-turn ---------- */
  function locate() {
    if (!navigator.geolocation) return toast("אין גישה למיקום במכשיר הזה");
    navigator.geolocation.getCurrentPosition(p => { st.me = { lat: p.coords.latitude, lon: p.coords.longitude }; renderMarkers(); map.flyTo({ center: [st.me.lon, st.me.lat], zoom: 12.5, padding: sheetPad() }); }, () => toast("לא התקבלה הרשאת מיקום"), { enableHighAccuracy: true, timeout: 8000 });
  }
  function guideFrom(stops, route, steps) { return { coords: route.coords, cum: route.cum || L.cumulative(route.coords), stops, stopKm: route.stopKm, steps: steps || null, idx: 0 }; }
  async function startRide() {
    if (st.ride) return stopRide();
    if (!navigator.geolocation) return toast("מצב רכיבה צריך גישה למיקום");
    stopFly(); const c = chap(), r = st.routes[st.chap]; if (!r) return;
    st.ride = { c, G: guideFrom(c.stops, r, null), last: null, alerted: new Set(), spoke: new Set(), lock: null, odo: 0, lowWarned: false, off: 0, rerouting: false, inT: null, terrMsg: null };
    loadSteps(c, r).then(s => { if (st.ride && st.ride.c === c) st.ride.G.steps = s; });
    try { st.ride.lock = await navigator.wakeLock.request("screen"); } catch (e) { }
    document.body.classList.add("riding"); $("hud").hidden = false; $("fRide").setAttribute("aria-pressed", "true"); $("hudVoice").setAttribute("aria-pressed", String(st.voice));
    if (!st.terrain) toggle3d(true);
    say("מצב רכיבה פעיל. " + c.title);
    st.ride.watch = navigator.geolocation.watchPosition(onPos, () => toast("אין אות GPS"), { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 });
  }
  function stopRide() {
    if (!st.ride) return; navigator.geolocation.clearWatch(st.ride.watch); try { st.ride.lock && st.ride.lock.release(); } catch (e) { }
    try { speechSynthesis.cancel(); } catch (e) { }
    st.ride = null; document.body.classList.remove("riding"); $("hud").hidden = true; $("turn").hidden = true; $("fRide").setAttribute("aria-pressed", "false"); map.setPadding({ top: 0, bottom: 0, left: 0, right: 0 }); fitChapter();
  }
  function nearestOn(G, me) {
    const n = G.coords.length; let lo = Math.max(0, G.idx - 150), hi = Math.min(n - 1, G.idx + 2500), bi = G.idx, bd = 1e9;
    const scan = (a, z) => { for (let i = a; i <= z; i++) { const d = L.hav(G.coords[i], me); if (d < bd) { bd = d; bi = i; } } };
    scan(lo, hi); if (bd > 0.4) { bd = 1e9; scan(0, n - 1); }
    G.idx = bi; return { km: G.cum[bi], d: bd };
  }
  async function reroute(me) {
    const R = st.ride; if (!R || R.rerouting) return; R.rerouting = true;
    const G = R.G, myKm = G.cum[G.idx]; const rest = G.stops.filter((s, i) => G.stopKm[i] > myKm + 0.2).slice(0, 12);
    if (!rest.length) { R.rerouting = false; return; }
    /* keep only the via points still ahead of the rider, or OSRM would send them back */
    if (rest[0].via) { const nearKm = (lat, lon) => { let bi = 0, bd = 1e9; for (let i = 0; i < G.coords.length; i++) { const d = (G.coords[i][0] - lon) ** 2 + (G.coords[i][1] - lat) ** 2; if (d < bd) { bd = d; bi = i; } } return G.cum[bi]; }; rest[0] = Object.assign({}, rest[0], { via: rest[0].via.filter(v => nearKm(v[0], v[1]) > myKm + 0.3) }); }
    const tmp = { custom: true, opts: R.c.opts, stops: [{ lat: me[1], lon: me[0], name: "כאן" }].concat(rest) };
    try {
      const j = await (await fetch(osrmUrl(tmp, "&steps=true"))).json(); if (j.code !== "Ok" || !st.ride) throw 0;
      const rt = j.routes[0]; const coords = rt.geometry.coordinates; const cum = L.cumulative(coords);
      let from = 0; const stopKm = rest.map(s => { let bi = from, bd = 1e9; for (let i = from; i < coords.length; i++) { const d = (coords[i][0] - s.lon) ** 2 + (coords[i][1] - s.lat) ** 2; if (d < bd) { bd = d; bi = i; } } from = bi; return cum[bi]; });
      const steps = []; let f2 = 0; rt.legs.forEach((lg, li) => lg.steps.forEach(sp => { const m = sp.maneuver; if (m.type === "depart") return; let bi = f2, bd = 1e9; for (let i = f2; i < coords.length; i++) { const d = (coords[i][0] - m.location[0]) ** 2 + (coords[i][1] - m.location[1]) ** 2; if (d < bd) { bd = d; bi = i; } } f2 = bi; steps.push({ km: cum[bi], type: m.type, modifier: m.modifier || "", exit: m.exit || 0, name: sp.name || "", ref: sp.ref || "", last: li === rt.legs.length - 1 }); }));
      R.G = { coords, cum, stops: rest, stopKm, steps, idx: 0 }; R.spoke = new Set(); R.off = 0;
      say("מחשב מסלול מחדש"); toast("המסלול חושב מחדש מהמיקום שלך");
    } catch (e) { } finally { if (st.ride) st.ride.rerouting = false; }
  }
  function onPos(p) {
    const R = st.ride; if (!R) return; const me = [p.coords.longitude, p.coords.latitude]; st.me = { lat: me[1], lon: me[0] };
    let spd = p.coords.speed != null && p.coords.speed >= 0 ? p.coords.speed * 3.6 : null;
    if (spd == null && R.last) { const dt = (p.timestamp - R.last.t) / 3600e3; if (dt > 0) spd = L.hav(R.last.p, me) / dt; }
    let head = p.coords.heading; if ((head == null || isNaN(head)) && R.last && L.hav(R.last.p, me) > 0.01) head = L.bearing(R.last.p, me);
    if (R.last) { const step = L.hav(R.last.p, me); if (step < 1.5) R.odo += step; }
    R.last = { p: me, t: p.timestamp };
    $("hudSpeed").textContent = spd != null ? Math.round(spd) : "--";
    const G = R.G; const near = nearestOn(G, me); const myKm = near.km;
    const ni = G.stopKm.findIndex(k => k > myKm + 0.08);
    if (ni >= 0) { $("hudNext").textContent = G.stops[ni].name.split(" · ")[0]; $("hudDist").textContent = distTxt(G.stopKm[ni] - myKm); } else { $("hudNext").textContent = "סוף המסלול"; $("hudDist").textContent = ""; }
    /* next maneuver */
    const steps = G.steps; const turn = $("turn");
    if (steps && steps.length) {
      const si = steps.findIndex(s => s.km > myKm + 0.015);
      if (si >= 0) {
        const s = steps[si], dist = s.km - myKm;
        turn.hidden = false; $("turnIc").innerHTML = arrowSvg(s); $("turnD").textContent = distTxt(dist); $("turnT").textContent = L.instruction(s);
        if (L.speakable(s)) {
          const farAt = spd && spd > 70 ? 1.2 : 0.7;
          if (dist <= farAt && dist > 0.25 && !R.spoke.has(si + "f")) { R.spoke.add(si + "f"); say(`בעוד ${distSpeak(dist)}, ${L.instruction(s)}`); }
          if (dist <= 0.12 && !R.spoke.has(si + "n")) { R.spoke.add(si + "n"); R.spoke.add(si + "f"); say(L.instruction(s)); }
        }
      } else turn.hidden = true;
    } else turn.hidden = true;
    /* territories: warning 2 km ahead (on the planned route) and a call-out when actually crossing */
    let tmsg = null;
    const spans = R.G === undefined ? [] : (st.terr[R.c.id] || []);
    if (GL) {
      const inside = L.inRing(me, GL);
      if (R.inT !== null && inside !== R.inT) { const t = inside ? "נכנסתם לשטחים, יהודה ושומרון" : "יצאתם מהשטחים, חזרה לתחומי הקו הירוק"; say(t); try { navigator.vibrate && navigator.vibrate([300, 120, 300]); } catch (e) { } R.terrMsg = { t, until: Date.now() + 15000 }; }
      R.inT = inside;
      if (G === R.G && G.coords === st.routes[R.c.id].coords) spans.forEach((x, k) => {
        const ahead = (km, kind) => { const d = km - myKm; if (d > 0 && d < 2.2 && !R.alerted.has("t" + k + kind)) { R.alerted.add("t" + k + kind); const t = `בעוד ${distSpeak(d)}: ${kind === "in" ? "כניסה לשטחים" : "יציאה מהשטחים"}`; say(t); R.terrMsg = { t, until: Date.now() + 12000 }; } };
        if (!x.startsInside) ahead(x.fromKm, "in"); if (!x.endsInside) ahead(x.toKm, "out");
      });
      if (R.terrMsg && Date.now() < R.terrMsg.until) tmsg = R.terrMsg.t;
    }
    let msg = null, cls = "";
    const cams = (st.osm ? st.osm.cams : []).concat(ENF.map(e => ({ lat: e.pts[0][0], lon: e.pts[0][1], id: e.name })));
    for (const c of cams) { const d = L.hav(me, [c.lon, c.lat]); if (d < 0.7 && (head == null || L.angDiff(head, L.bearing(me, [c.lon, c.lat])) < 50)) { msg = `מצלמה בעוד ${Math.round(d * 1000)} מ׳`; cls = "cam"; const id = c.id || `${c.lat},${c.lon}`; if (!R.alerted.has(id)) { R.alerted.add(id); say("מצלמת מהירות"); try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch (e) { } } break; } }
    if (!msg && tmsg) { msg = tmsg; cls = "terr"; }
    const left = st.bike.range - R.odo;
    if (!msg && left < 60) { const nxt = fuelAlong(st.chap).find(f => f.km > myKm && f.ok); msg = nxt ? `דלק: נשארו כ־${Math.max(0, Math.round(left))} ק״מ. ${nxt.label} בעוד ${(nxt.km - myKm).toFixed(1)} ק״מ` : `דלק: נשארו כ־${Math.max(0, Math.round(left))} ק״מ`; cls = "cam"; if (!R.lowWarned) { R.lowWarned = true; say("דלק נמוך"); try { navigator.vibrate && navigator.vibrate([400]); } catch (e) { } } }
    if (near.d > 0.25 && (spd == null || spd > 4)) { R.off++; if (R.off >= 3) reroute(me); } else R.off = 0;
    if (!msg && near.d > 0.25) msg = `מחוץ למסלול, ${near.d.toFixed(1)} ק״מ`;
    if (!msg) { const seg = (st.curves[st.chap] || []).find(s => s.cls >= 2 && s.startKm > myKm && s.startKm - myKm < 1.6); if (seg && G.coords === st.routes[R.c.id].coords) { msg = `${L.CURVE_LABEL[seg.cls]} בעוד ${(seg.startKm - myKm).toFixed(1)} ק״מ`; cls = "curve"; } }
    const m = $("hudMsg"); m.hidden = !msg; if (msg) { m.textContent = msg; m.className = "hudmsg " + cls; }
    map.easeTo({ center: me, bearing: head != null && !isNaN(head) ? head : map.getBearing(), pitch: 55, zoom: spd && spd > 80 ? 14.3 : 15, duration: 900, padding: { top: 150, bottom: 230, left: 20, right: 20 } });
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
  function setChap(id) { stopFly(); st.chap = id; if (id !== DRAFT) LS.set("chap", id); pushSources(); renderMarkers(); renderTab(); fitChapter(); if (wxSig() !== (st.wx && st.wx.sig)) loadWeather(); }
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
    if (i.dataset.l === "traffic" && i.checked && !st.cfg.traffic) toast("שכבת התנועה החיה עוד לא מחוברת");
    applyLayerVis();
  });
  syncLayerBoxes();

  /* ---------- buttons ---------- */
  $("fHome").onclick = () => { stopFly(); home(); };
  $("f3d").onclick = () => toggle3d();
  $("fFly").onclick = () => startFly();
  $("fLocate").onclick = locate;
  $("fRide").onclick = startRide; $("hudExit").onclick = stopRide;
  $("hudVoice").onclick = () => { st.voice = !st.voice; LS.set("voice", st.voice); $("hudVoice").setAttribute("aria-pressed", String(st.voice)); if (st.voice) say("הנחיות קוליות פעילות"); else try { speechSynthesis.cancel(); } catch (e) { } };
  $("nowChip").onclick = () => setTab("brief");
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { if (st.theme !== "system") return; applyTheme(); const want = isDark() ? "dark" : "liberty"; if (want !== styleName) { styleName = want; styleReady = false; map.setStyle(OFM + styleName, { diff: false }); } });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) { st.sat = L.nextSaturday(); loadWeather(); loadOSM(); loadCrowd(); if (st.ride && !st.ride.lock) navigator.wakeLock && navigator.wakeLock.request("screen").then(l => st.ride && (st.ride.lock = l)).catch(() => { }); } });
  setInterval(() => { st.sat = L.nextSaturday(); loadWeather(); }, 30 * 6e4);

  /* ---------- boot ---------- */
  if (innerWidth < 900) setSheet("half"); else st.sheet = "half";
  renderBrief();
  let introDone = false;
  const endIntro = () => { if (introDone) return; const wait = (window.BR_introHold || 0) - performance.now(); if (wait > 0) return void setTimeout(endIntro, wait); introDone = true; $("intro").classList.add("out"); setTimeout(() => home(2600), 250); };
  map.on("load", () => setTimeout(endIntro, 900));
  setTimeout(endIntro, 4500);
  fetch("/api/config").then(r => r.ok ? r.json() : {}).then(cfg => { Object.assign(st.cfg, cfg); if (styleReady) addTrafficLayer(); if (st.tab === "route") { loadTraffic(st.chap); renderRoute(); } }).catch(() => { });
  importShared();
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
