/* Blue Ronin Navigator — app runtime */
(() => {
  "use strict";
  const { CHAPTERS, CAFES, ENF, NORTH_BOUNDS, CENTER_BOUNDS, REGIONS, LIVE_BOARD } = window.BRD;
  const GL = window.BR_GREENLINE || null;
  const BUILT_IN = CHAPTERS.length;
  const APP_VER = "2.7.1";
  const L = window.BRL;
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  /* Device storage. When the phone's quota is full, cached map data (routes, elevation, weather, places)
     is dropped first so the rider's own data (routes, rides, bike, safety, Pro) is never the thing lost. */
  const CACHE_KEY = /^(route:|elev:|steps:|osm|wx|crowd|rideLive)/;
  const LS = {
    get(k, d) { try { const v = localStorage.getItem("brn:" + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) {
      let s; try { s = JSON.stringify(v); } catch (e) { return false; }
      try { localStorage.setItem("brn:" + k, s); return true; } catch (e) { }
      try { const drop = []; for (let i = 0; i < localStorage.length; i++) { const key = localStorage.key(i); if (key && key.startsWith("brn:") && CACHE_KEY.test(key.slice(4)) && key !== "brn:" + k) drop.push(key); } drop.forEach(x => localStorage.removeItem(x)); localStorage.setItem("brn:" + k, s); return true; }
      catch (e) { if (!CACHE_KEY.test(k) && !LS.warned) { LS.warned = true; setTimeout(() => { try { toast("אין מספיק מקום בטלפון לשמירה. כדאי לשמור גיבוי בלשונית שלי", 6000); } catch (x) { } }, 50); window.BRG && BRG.report("storage", "quota " + k, "", 0, ""); } return false; }
    }
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
    layers: Object.assign({ curves: true, glare: true, stops: true, wx: true, radar: false, cams: true, cafes: true, osmview: true, fuel: true, moto: true, hillshade: true, green: true, traffic: true }, LS.get("layers", {})),
    shabbat: LS.get("shabbat", true),
    theme: LS.get("theme", "system"),
    routes: {}, curves: {}, cstats: {}, glare: {}, elev: {},
    wx: LS.get("wx2", null), osm: LS.get("osm4", null), radar: null, crowd: LS.get("crowd", {}), api: null,
    bike: Object.assign({ id: "", tank: 15, cons: 5.0, style: "normal", start: 100, fuel: "95", measured: null, range: 220 }, LS.get("bike", {})), fuelFilter: LS.get("fuelFilter", { sat: true, oct: false }),
    stopsCat: LS.get("stopsCat", "all"), fuelRide: LS.get("fuelRide", null),
    terrain: false, ride: null, me: null, fly: null, tab: "brief",
    terr: {}, traffic: {}, cfg: { traffic: false, mapillary: false }, build: null, myRoutes: LS.get("myRoutes", []),
    buildPrefs: Object.assign({ noHighway: false, loop: false }, LS.get("buildPrefs", {})), voice: LS.get("voice", true),
    sat: L.nextSaturday()
  };
  /* Saved custom routes behave exactly like chapters once added to the list. */
  const customChapter = u => ({ id: u.id, title: u.title, short: u.title, custom: true, shared: u.shared || null, region: "custom", tech: 0.5, opts: u.opts || {}, sub: u.sub || "מסלול שבניתי", note: "", stops: u.stops.map((p, i, a) => ({ id: u.id + "_" + i, name: p.name, lat: p.lat, lon: p.lon, kind: i === 0 ? "start" : i === a.length - 1 ? "view" : "road", note: p.note || "", roads: [] })) });
  st.myRoutes.forEach(u => CHAPTERS.push(customChapter(u)));
  /* ---------- admin-managed layer (read-only for riders; edited in /admin.html) ---------- */
  st.flags = { fly: true, builder: true, fuelVotes: true, photos: true, feedback: true, move: false }; st.hazards = []; st.content = null;
  CHAPTERS.slice(0, BUILT_IN).forEach(c => c.stops.forEach(s => { if (s._note0 === undefined) s._note0 = s.note; }));
  function applyContent(ct) {
    if (!ct || typeof ct !== "object") return; st.content = ct;
    Object.assign(st.flags, ct.flags || {});
    CHAPTERS.slice(0, BUILT_IN).forEach(c => { const x = (ct.chapters || {})[c.id] || {}; c.hidden = !!x.hidden; c.alertMsg = x.alert || ""; c.featured = ct.featured === c.id; c.stops.forEach(s => { const n = (ct.notes || {})[c.id + ":" + s.id]; s.note = n || s._note0; }); });
    st.hazards = Array.isArray(ct.hazards) ? ct.hazards : [];
    if (CHAPTERS.find(c => c.id === st.chap)?.hidden) st.chap = (CHAPTERS.find(c => !c.hidden) || CHAPTERS[0]).id;
  }
  applyContent(LS.get("content", null));
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
  /* One info window at a time: opening a popup for another place closes the previous one (like every maps app).
     Popups keep all their content and buttons; only the stacking is gone. */
  try { const P = maplibregl.Popup.prototype, add = P.addTo; let open = null;
    P.addTo = function (m) { if (open && open !== this) { try { open.remove(); } catch (e) { } } open = this; this.once("close", () => { if (open === this) open = null; }); return add.call(this, m); };
  } catch (e) { }
  window.BRG && BRG.crumb("map");
  let map; try { map = new maplibregl.Map({
    container: "map", style: OFM + styleName, center: [35.0, 31.6], zoom: 6.2,
    maxPitch: 80, attributionControl: { compact: true }, dragRotate: true, cooperativeGestures: false,
    pixelRatio: Math.min(2, window.devicePixelRatio || 1), fadeDuration: 160, maxTileCacheSize: 360, refreshExpiredTiles: false
  }); } catch (e) { window.BRG && (BRG.report("map", e.message, "", 0, e.stack), BRG.fatal("map")); throw e; }
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
    cam: ["M3 8.5h11v7H3z", "M14 10.5l6-3v9l-6-3", "M6 12h.01"],
    moto: ["M14.5 6.5a4 4 0 0 0-5.4 5l-5.6 5.6a1.6 1.6 0 0 0 2.3 2.3l5.6-5.6a4 4 0 0 0 5-5.4l-2.4 2.4-2.1-.4-.4-2.1z"],
    haz: ["M12 4 3 19.5h18z", "M12 10v4.5", "M12 17h.01"],
    cup: ["M5 9h11v5a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4z", "M16 10.5h1.4a2 2 0 0 1 0 4H16", "M8.5 4.5c0 1 1 1.2 1 2.2M12 4.5c0 1 1 1.2 1 2.2", "M4 20.5h13"]
  };
  /* ================= modal sheet (one at a time) ================= */
  function openModal(html, cls = "") {
    clearTimeout(closeModal.t); /* a sheet opened right after another closed must not be wiped by the old close */
    const m = $("modal"); $("mbody").innerHTML = html; m.className = "modal " + cls; m.hidden = false;
    requestAnimationFrame(() => m.classList.add("in")); const f = m.querySelector("[autofocus], .btn.primary"); if (f) setTimeout(() => f.focus(), 250);
    return $("mbody");
  }
  function closeModal() { const m = $("modal"); if (m.hidden) return; m.classList.remove("in"); clearTimeout(closeModal.t); closeModal.t = setTimeout(() => { m.hidden = true; $("mbody").innerHTML = ""; }, 220); }
  $("mx").onclick = closeModal; $("modal").addEventListener("click", e => { if (e.target.id === "modal") closeModal(); });
  addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });

  /* ================= Blue Ronin Pro =================
     Free forever: the Saturday brief, all chapters, ride mode with voice, cameras, hazards, territory alerts,
     fuel planner and the nearest-station finder, offline maps. Safety is never behind a paywall.
     Pro: route insights, the full ride journal + GPX, the full fly-through, unlimited own routes. */
  st.pro = LS.get("pro", null);
  const isPro = () => !!(st.pro && st.pro.exp > Date.now());
  const FREE_ROUTES = 2, FLY_FREE = 0.3, FREE_MEM = 24;
  const proPost = async (path, body) => { const r = await fetch("/api/pro/" + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || "אין חיבור"); return j; };
  function setPro(j) { st.pro = { token: j.token, exp: j.exp, src: j.src, checked: Date.now(), trialUsed: (st.pro && st.pro.trialUsed) || j.src === "trial" }; LS.set("pro", st.pro); proBadge(); renderAll(); }
  async function proCheck() {
    if (!st.pro || !st.pro.token || Date.now() - (st.pro.checked || 0) < 6 * 36e5) return;
    try { const j = await proPost("status", { token: st.pro.token }); st.pro.exp = j.pro ? j.exp : 0; st.pro.checked = Date.now(); LS.set("pro", st.pro); proBadge(); renderAll(); } catch (e) { }
  }
  function proBadge() { const b = $("proBadge"); if (b) { b.hidden = !isPro(); b.title = isPro() ? `Pro עד ${fmtD(new Date(st.pro.exp))}` : ""; } }
  const daysLeft = () => isPro() ? Math.max(1, Math.ceil((st.pro.exp - Date.now()) / 864e5)) : 0;
  const PW = {
    insights: ["התובנות של הפרק מוכנות", "מתי לצאת, איפה העיקולים הטכניים, איפה הטיפוסים ואיפה השמש בעיניים. מחושב מהמסלול ומהתחזית של השבת הזאת."],
    fly: ["רוצים לראות את כל הדרך?", "המעוף המלא עובר על כל הפרק, עיקול אחרי עיקול, לפני שיוצאים."],
    routes: ["עוד מסלול משלך", `בחינם שומרים עד ${FREE_ROUTES} מסלולים. עם Pro בונים כמה שרוצים, ומשתפים כל אחד בקישור.`],
    journal: ["היומן המלא שלך", "כל הרכיבות שהקלטת שמורות במכשיר. Pro פותח את כולן, עם סטטיסטיקה מצטברת וייצוא GPX."],
    fuel: ["תוכנית הדלק המלאה", "איפה בדיוק לתדלק ובכמה ליטר, מד מיכל לאורך כל הפרק, סגנון רכיבה, כיול מתדלוק אמיתי וצביעת המסלול במפה לפי הדלק שנשאר."],
    replay: ["השחזור המלא של הרכיבה", "כל הדרך שרכבת, בתלת־ממד, עם השעון של אותו בוקר והתמונות שצילמת בדיוק במקום שבו צילמת."],
    group: ["רכיבה קבוצתית", "פותחים קבוצה, וכל הרוכבים רואים זה את זה על מפה אחת, עם נקודת מפגש וקריאת חירום לכולם. ההצטרפות חינם לכל חברי הקבוצה."],
    memories: ["הזיכרונות שלך מהדרך", `בחינם שומרים עד ${FREE_MEM} תמונות והקלטות. עם Pro בלי הגבלה, כולל אלבום לכל רכיבה בסיכום שלה.`],
    gpx: ["ייצוא הרכיבה", "קובץ GPX של המסלול שרכבת בפועל, ל־Strava, ל־OsmAnd או לארכיון שלך."],
    default: ["Blue Ronin Pro", "כלים לרוכב שיוצא כל שבת: תובנות לכל פרק, יומן רכיבות, מעוף מלא ומסלולים בלי הגבלה."]
  };
  function personalLine() {
    const c = chap(), cs = st.cstats[c.id], ins = routeInsights(c.id), rides = (LS.get("rides", []) || []).length;
    const bits = [];
    if (cs && cs.twisty >= 1) bits.push(`${Math.round(cs.twisty)} ק״מ מפותלים`);
    if (ins) { if (ins.tech.length) bits.push(`${ins.tech.length} קטעים טכניים`); if (ins.climbs.length) bits.push(`${ins.climbs.length} טיפוסים`); }
    if (rides) bits.push(`${rides} רכיבות שמורות אצלך`);
    return bits.length ? `ב${c.title}: ${bits.join(" · ")}` : "";
  }
  function openPaywall(reason = "default") {
    const [h, sub] = PW[reason] || PW.default, pl = personalLine(), used = st.pro && st.pro.trialUsed;
    const f = [
      ["spark", "תובנות לכל פרק", "חלון היציאה הטוב לפי התחזית, קטעים טכניים, טיפוסים וסנוור, בקילומטר המדויק"],
      ["fuel", "תוכנית דלק מלאה", "תחנות התדלוק בדיוק, מד מיכל לאורך הפרק, סגנון רכיבה וכיול לפי האופנוע שלך"],
      ["book", "יומן רכיבות מלא", "כל רכיבה: ק״מ, זמן תנועה, ממוצע ודלק משוער. סיכום חודשי ו־GPX"],
      ["cam", "זיכרונות בלי הגבלה", "תמונות והקלטות מכל עצירה, מסודרות לפי תאריך ופרק, ואלבום לכל רכיבה"],
      ["route", "רכיבה קבוצתית", "כולם על מפה אחת, נקודת מפגש, וחירום שמגיע לכל הקבוצה. מצטרפים בחינם"],
      ["play", "שחזור 3D של כל רכיבה", "הרכיבה שלך בתלת־ממד עם השעון האמיתי והתמונות מהדרך"],
      ["play", "מעוף ציפור מלא", "כל הפרק במצלמת רדיפה, עם טעינה מראש"],
      ["route", "מסלולים בלי הגבלה", "בונים, שומרים ומשתפים כמה שרוצים"],
      ["star", "פרקים חדשים קודם", "מנויי Pro מקבלים כל פרק חדש לפני כולם"]
    ];
    const box = openModal(`<div class="pw">
      <div class="pwhead"><span class="pwlogo">PRO</span><h2>${esc(h)}</h2><p>${esc(sub)}</p>${pl ? `<div class="pwme">${esc(pl)}</div>` : ""}</div>
      ${isPro() ? `<div class="alert info">Pro פעיל עוד ${daysLeft()} ימים${st.pro.src === "trial" ? " (תקופת ניסיון)" : ""}.</div>` : `<button type="button" class="btn primary big" id="pwTrial" ${used ? "hidden" : ""}>7 ימי Pro חינם · בלי כרטיס אשראי</button>`}
      <ul class="pwf">${f.map(([i, t, d]) => `<li><span class="pwi">${PWI[i]}</span><div><b>${t}</b><span>${d}</span></div></li>`).join("")}</ul>
      <div class="pwplans" role="group" aria-label="בחירת מסלול"><button type="button" class="plan best" data-plan="yearly" aria-pressed="false"><span class="tag">מחיר מייסדים</span><b>₪99</b><span>לשנה · ₪8.25 לחודש</span></button><button type="button" class="plan" data-plan="monthly" aria-pressed="false"><b>₪14.90</b><span>לחודש</span></button></div>
      <p class="small muted" style="margin:0">התשלום ייפתח עם ההשקה בגוגל פליי. לחיצה על מסלול משריינת את מחיר המייסדים, בלי התחייבות ובלי פרטי תשלום. לחיצה נוספת מבטלת.</p>
      <details class="pwcode"><summary>יש לי קוד</summary><div class="row"><input id="pwCode" class="btn mono" dir="ltr" placeholder="BR-XXXX-XXXX" autocomplete="off" maxlength="14" style="flex:1"><button type="button" class="btn" id="pwRedeem">הפעלה</button></div></details>
      <div class="pwfree"><b>תמיד בחינם, לכולם:</b> תדריך שבת, כל הפרקים, איש קשר לחירום, זיהוי נפילה ושיתוף מיקום חי, מצב רכיבה עם הנחיות קוליות, התראות עיקולים חדים, מצלמות ומפגעים, התראות שטחים, התשובה אם הדלק מספיק, איתור התחנה הקרובה לפי הדלק שנשאר ונורית דלק במצב רכיבה, מפות אופליין. בטיחות לא נמכרת.</div>
      <div class="err small" id="pwErr"></div></div>`, "pwmodal");
    const err = m => { $("pwErr").textContent = m; };
    if ($("pwTrial")) $("pwTrial").onclick = async () => { $("pwTrial").disabled = true; try { setPro(await proPost("trial", { cid })); closeModal(); toast("Pro פעיל ל־7 ימים. רכיבה טובה!"); if (reason === "fly" && st.fly) { st.fly.cap = Infinity; } } catch (e) { err(e.message); $("pwTrial").disabled = false; if (/נוצלה/.test(e.message)) { st.pro = Object.assign(st.pro || {}, { trialUsed: true }); LS.set("pro", st.pro); $("pwTrial").hidden = true; } } };
    $("pwRedeem").onclick = async () => { try { const j = await proPost("redeem", { cid, code: $("pwCode").value }); setPro(j); closeModal(); toast(`הקוד הופעל. Pro פעיל ל־${Math.round((j.exp - Date.now()) / 864e5)} ימים`); if (st.fly) st.fly.cap = Infinity; } catch (e) { err(e.message); } };
    /* the plans behave like a choice: one at a time, tap again to cancel, remembered on this phone */
    const paint = () => { const cur = LS.get("proPlan", null); box.querySelectorAll("[data-plan]").forEach(b => { b.classList.toggle("chosen", b.dataset.plan === cur); b.setAttribute("aria-pressed", String(b.dataset.plan === cur)); }); };
    paint();
    box.querySelectorAll("[data-plan]").forEach(b => b.onclick = async () => {
      const cur = LS.get("proPlan", null), next = cur === b.dataset.plan ? "none" : b.dataset.plan;
      box.querySelectorAll("[data-plan]").forEach(x => x.disabled = true);
      try { await proPost("interest", { plan: next, prev: cur, ver: APP_VER }); LS.set("proPlan", next === "none" ? null : next); paint();
        toast(next === "none" ? "השריון בוטל" : cur ? `עודכן ל${next === "yearly" ? "מנוי שנתי" : "מנוי חודשי"}. המחיר שמור לך` : "נשמר. מחיר המייסדים שמור לך, ונעדכן כשהתשלום ייפתח"); }
      catch (e) { err(e.message); } box.querySelectorAll("[data-plan]").forEach(x => x.disabled = false);
    });
  }
  const PWI = {
    spark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3l2.2 5.8L20 11l-5.8 2.2L12 19l-2.2-5.8L4 11l5.8-2.2z"/></svg>',
    book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M7 4v16l13-8z"/></svg>',
    route: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="6" r="2.5"/><path d="M8.5 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.5"/></svg>',
    fuel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 20V5.5A1.5 1.5 0 0 1 6.5 4h6A1.5 1.5 0 0 1 14 5.5V20M3.5 20h12M7.5 7h4v3.5h-4z"/><path d="M14 9.5h1.5A1.5 1.5 0 0 1 17 11v4.5a1.3 1.3 0 0 0 2.6 0V8.5L17 6"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l12.5-7.5z"/></svg>',
    star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></svg>',
    share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4"/></svg>',
    phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>',
    moto: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="5.5" cy="16.5" r="3.5"/><circle cx="18.5" cy="16.5" r="3.5"/><path d="M5.5 16.5 9 10h5l2.5 6.5M14 10l-1.5-3H10M16.5 10H20"/></svg>',
    cam: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
    mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/></svg>',
    pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 21s-6.5-6.2-6.5-11.5a6.5 6.5 0 0 1 13 0C18.5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.3"/></svg>',
    lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>'
  };

  /* ---------- route insights (Pro): what this road does, and when to ride it ---------- */
  const insCache = new Map();
  function routeInsights(cid) {
    const r = st.routes[cid]; if (!r) return null; const segs = st.curves[cid] || [], e = st.elev[cid];
    const key = `${cid}|${r.km.toFixed(1)}|${segs.length}|${!!e}|${st.wx ? st.wx.ts : 0}|${st.sat.iso}`; if (insCache.has(key)) return insCache.get(key);
    /* technical stretches: tight-curve segments merged across short gaps */
    const tech = []; segs.forEach(s => { if (s.cls < 3) return; const last = tech[tech.length - 1]; if (last && s.startKm - (last.from + last.km) < 0.35) last.km = s.startKm + s.km - last.from; else tech.push({ from: s.startKm, km: s.km }); });
    const techL = tech.filter(t => t.km >= 0.35).sort((a, b) => b.km - a.km).slice(0, 6).sort((a, b) => a.from - b.from);
    /* sustained climbs from the elevation profile */
    const climbs = []; if (e && e.el) { const n = e.el.length, dk = e.km / (n - 1); let s = 0; for (let i = 1; i <= n; i++) { const up = i < n && e.el[i] >= e.el[i - 1] - 3; if (!up) { const gain = e.el[i - 1] - e.el[s], km = (i - 1 - s) * dk; if (gain >= 110 && km > 0.6) climbs.push({ from: s * dk, km, gain: Math.round(gain), grade: gain / (km * 10) }); s = i; } } climbs.sort((a, b) => b.gain - a.gain); climbs.splice(4); climbs.sort((a, b) => a.from - b.from); }
    /* best departure: for each start between sunrise and 11:00, weather over the riding window + low-sun glare */
    let windows = [];
    const cw = chapterWx(cid); const c = CHAPTERS.find(x => x.id === cid);
    if (cw && c) {
      const base = departFor(c), hours = r.min / 60 * 1.25 + 0.5;
      for (let k = 0; k < 12; k++) {
        const t0 = new Date(base.getTime() + k * 30 * 6e4); const hr0 = +new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: TZ }).format(t0); if (hr0 > 11) break;
        let sc = 0, nn = 0, why = new Set();
        for (let h = hr0; h <= Math.min(17, hr0 + Math.ceil(hours)); h++) cw.rows.forEach(rw => { const x = satHour(rw.i, h); if (!x) return; nn++; let s = 100; s -= (x.p || 0) * 0.7; if (x.p >= 40) why.add("גשם"); s -= Math.max(0, x.g - 28) * 1.3; if (x.g >= 40) why.add("רוח"); if (x.vis != null && x.vis < 3000) { s -= 30; why.add("ערפל"); } if (x.t < 9) { s -= (9 - x.t) * 3.5; why.add("קור"); } if (x.t > 31) { s -= (x.t - 31) * 3; why.add("חום"); } sc += s; });
        if (!nn) continue; sc /= nn;
        const gl = L.glareSegments(r.coords, t0, 55, sunAt); const glKm = gl.reduce((a, g) => a + g.km, 0); sc -= Math.min(20, glKm * 2); if (glKm > 2) why.add("סנוור");
        windows.push({ t: t0, score: Math.round(Math.max(0, Math.min(100, sc))), glKm, why: [...why] });
      }
    }
    const best = windows.slice().sort((a, b) => b.score - a.score)[0] || null;
    const out = { tech: techL, climbs, windows, best, glare: st.glare[cid] || [] };
    if (insCache.size > 30) insCache.clear(); insCache.set(key, out); return out;
  }
  /* =====================================================================================
     Pro · the ride plan ("תובנות הפרק"). Pick a departure time and the whole Saturday lays out:
     when you reach every stop, the weather you'll meet there at that hour, how cold it feels at riding
     speed, where the sun will be in your eyes (to the minute), the technical and climbing stretches
     between stops, where to take the break and what to wear. Everything recomputes as the slider moves.
     ===================================================================================== */
  st.planDep = st.planDep || {};
  const hourOf = t => +new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: TZ }).format(t);
  function planDepartures(cid) {
    const c = CHAPTERS.find(x => x.id === cid), ins = routeInsights(cid); if (!c) return [];
    if (ins && ins.windows.length) return ins.windows;
    const base = departFor(c), out = []; for (let k = 0; k < 12; k++) { const t = new Date(base.getTime() + k * 30 * 6e4); if (hourOf(t) > 11) break; out.push({ t, score: null, glKm: 0, why: [] }); } return out;
  }
  function ridePlan(cid, dep) {
    const r = st.routes[cid], c = CHAPTERS.find(x => x.id === cid); if (!r || !c || !r.stopKm) return null;
    const ins = routeInsights(cid) || { tech: [], climbs: [] }, cum = r.cum || (r.cum = L.cumulative(r.coords));
    const v = Math.max(38, Math.min(75, r.km / (r.min / 60) * 0.92)); /* riders' moving average, from the road's own driving time */
    const techBefore = km => ins.tech.reduce((a, t) => a + Math.max(0, Math.min(km, t.from + t.km) - t.from), 0);
    const moveH = km => km / v + techBefore(km) * (1 / (v * 0.68) - 1 / v);
    const DWELL = { view: 8, cafe: 30 }; let dwell = 0;
    const wpts = wxPoints().map((p, i) => ({ p, i })).filter(x => x.p.chap === cid || (c.combo && c.combo.includes(x.p.chap)));
    const wxNear = s => { if (!st.wx || !wpts.length) return -1; let bi = -1, bd = 1e9; wpts.forEach(x => { const d = L.hav([x.p.lon, x.p.lat], [s.lon, s.lat]); if (d < bd) { bd = d; bi = x.i; } }); return bi; };
    const stops = c.stops.map((s, i) => {
      const km = r.stopKm[i] || 0, eta = new Date(dep.getTime() + (moveH(km) * 60 + dwell) * 6e4); const leave = new Date(eta.getTime() + (DWELL[s.kind] || 0) * 6e4); dwell += DWELL[s.kind] || 0;
      const wi = wxNear(s), hr = hourOf(eta), w = wi >= 0 ? satHour(wi, Math.min(23, hr + (eta.getMinutes() >= 30 ? 1 : 0))) : null;
      return { s, i, km, eta, leave, w, feel: w ? Math.round(L.windChill(w.t, 70)) : null, rideMin: Math.round(moveH(km) * 60) };
    });
    const end = stops[stops.length - 1].eta;
    /* sun in the eyes, to the minute, located on the route */
    const gl = L.glareSegments(r.coords, dep, v, sunAt).filter(g => g.km >= 0.3).map(g => { const k0 = (g.at - dep) / 3600e3 * v; return { from: k0, km: g.km, at: g.at, till: new Date(g.at.getTime() + g.km / v * 3600e3), p: g.coords[Math.floor(g.coords.length / 2)] }; });
    const legOf = km => { const i = stops.findIndex(x => x.km >= km); return i < 0 ? stops.length - 1 : Math.max(1, i); };
    const ev = stops.map(() => []);
    ins.tech.forEach(t => ev[legOf(t.from)].push({ k: "tech", km: t.from, txt: `קטע טכני ${t.km.toFixed(1)} ק״מ`, p: L.pointAt(r.coords, cum, t.from + t.km / 2) }));
    ins.climbs.forEach(t => ev[legOf(t.from)].push({ k: "climb", km: t.from, txt: `טיפוס +${t.gain} מ׳ (${t.grade.toFixed(0)}%)`, p: L.pointAt(r.coords, cum, t.from + t.km / 2) }));
    gl.forEach(g => ev[legOf(g.from)].push({ k: "sun", km: g.from, txt: `שמש בעיניים ${fmtT(g.at)}–${fmtT(g.till)}`, p: g.p }));
    ev.forEach(l => l.sort((a, b) => a.km - b.km));
    /* what deserves attention, most important first */
    const watch = [];
    const rainy = stops.filter(x => x.w && x.w.p >= 40); if (rainy.length) watch.push({ lvl: 3, txt: `סיכוי ${Math.max(...rainy.map(x => x.w.p))}% לגשם ב${rainy[0].s.name.split(" · ")[0]} סביב ${fmtT(rainy[0].eta)}`, p: lonlat(rainy[0].s) });
    const gust = stops.filter(x => x.w && x.w.g >= 38).sort((a, b) => b.w.g - a.w.g)[0]; if (gust) watch.push({ lvl: 2, txt: `משבי רוח של ${Math.round(gust.w.g)} קמ״ש ב${gust.s.name.split(" · ")[0]} (${fmtT(gust.eta)})`, p: lonlat(gust.s) });
    const fog = stops.find(x => x.w && x.w.vis != null && x.w.vis < 2500); if (fog) watch.push({ lvl: 2, txt: `ראות מוגבלת (${(fog.w.vis / 1000).toFixed(1)} ק״מ) ב${fog.s.name.split(" · ")[0]} ב־${fmtT(fog.eta)}`, p: lonlat(fog.s) });
    if (gl.length) { const g = gl.slice().sort((a, b) => b.km - a.km)[0]; watch.push({ lvl: 2, txt: `השמש נמוכה מולך ${fmtT(g.at)}–${fmtT(g.till)}, ${g.km.toFixed(1)} ק״מ. ויזור כהה או משקפיים`, p: g.p }); }
    const cw = chapterWx(cid); if (cw && cw.agg.wet) watch.push({ lvl: 2, txt: "ירד גשם בלילה: הכביש עלול להיות רטוב וחלק בשעה הראשונה", p: null });
    const cold = stops.filter(x => x.feel != null).sort((a, b) => a.feel - b.feel)[0], warm = stops.filter(x => x.feel != null).sort((a, b) => b.feel - a.feel)[0];
    if (cold && cold.feel <= 6) watch.push({ lvl: 1, txt: `קר ברכיבה: מרגיש כמו ${cold.feel}° ב${cold.s.name.split(" · ")[0]}`, p: lonlat(cold.s) });
    watch.sort((a, b) => b.lvl - a.lvl);
    /* the break: first view or cafe after ~70 minutes of riding, otherwise the one nearest the middle */
    const cand = stops.filter(x => x.i > 0 && x.i < stops.length - 1 && (x.s.kind === "cafe" || x.s.kind === "view" || x.s.cafe));
    const brk = cand.find(x => x.rideMin >= 70) || cand.sort((a, b) => Math.abs(a.km - r.km / 2) - Math.abs(b.km - r.km / 2))[0] || null;
    /* what to wear: start gear for the coldest feel, and when it is warm enough to open up */
    let wear = null; if (cold && warm) { const gr = L.gear(cold.w.t, warm.w.t, Math.max(...stops.map(x => x.w ? x.w.p || 0 : 0)), !!fog).items; wear = { start: gr[0], open: warm.feel - cold.feel >= 7 ? stops.find(x => x.feel != null && x.feel >= cold.feel + 6) : null, extra: gr.slice(1, 3) }; }
    const sun = SunCalc.getTimes(st.sat.noonUTC, c.stops[0].lat, c.stops[0].lon);
    const golden = stops.filter(x => x.s.kind === "view" && x.eta - sun.sunrise < 75 * 6e4 && x.eta > sun.sunrise);
    return { dep, end, v: Math.round(v), stops, ev, watch, brk, wear, golden, cold, warm, glKm: gl.reduce((a, g) => a + g.km, 0) };
  }
  function planSummary(P, win) {
    const parts = [];
    if (win && win.score != null) parts.push(win.score >= 80 ? "בוקר טוב לרכיבה." : win.score >= 60 ? "בוקר סביר, עם כמה דברים לשים לב אליהם." : "בוקר מאתגר לרכיבה.");
    if (P.cold && P.warm) parts.push(P.warm.feel - P.cold.feel >= 5 ? `מתחילים ב־${P.cold.feel}° בתחושה ברכיבה ומסיימים ב־${P.warm.feel}°.` : `בתחושה ברכיבה סביב ${P.cold.feel}° לאורך כל הדרך.`);
    if (P.golden.length) parts.push(`מגיעים ל${P.golden[0].s.name.split(" · ")[0]} באור זהב.`);
    if (P.glKm >= 0.5) parts.push(`${P.glKm.toFixed(1)} ק״מ עם שמש נמוכה מולך.`); else parts.push("בלי סנוור שמש בשעה הזאת.");
    return parts.join(" ");
  }
  function planBody(cid, pro) {
    const deps = planDepartures(cid); if (!deps.length) return `<p class="small muted" style="margin:0">התוכנית תיבנה כשהמסלול ייטען.</p>`;
    const ins = routeInsights(cid), best = ins && ins.best;
    let k = st.planDep[cid]; if (k == null || k >= deps.length) k = best ? deps.indexOf(best) : 0; if (k < 0) k = 0;
    const win = deps[k], P = ridePlan(cid, win.t); if (!P) return `<p class="small muted" style="margin:0">התוכנית תיבנה כשהמסלול ייטען.</p>`;
    const mk = v => pro ? v : String(v).replace(/[0-9]/g, "•");
    const dur = Math.round((P.end - P.dep) / 6e4);
    const strip = deps.some(w => w.score != null) ? `<div class="wins lab" dir="ltr" role="img" aria-label="ציון יציאה לפי שעה">${deps.map((w, i) => `<div class="w${i === k ? " best" : ""}"><i style="height:${Math.max(6, w.score || 6)}%;background:hsl(${Math.round((w.score || 0) * 1.3)} 65% 48%)"></i><span>${i % 3 === 0 ? mk(fmtT(w.t)) : ""}</span></div>`).join("")}</div>` : "";
    const EVI = { tech: "〰", climb: "↗", sun: "☀" };
    const tl = P.stops.map((x, i) => `${P.ev[i].map(e => `<li class="pev ${e.k}"${pro && e.p ? ` data-pp="${e.p[0].toFixed(5)},${e.p[1].toFixed(5)}"` : ""}><span class="pi">${EVI[e.k]}</span><span>${esc(mk(e.txt))}</span></li>`).join("")}
      <li class="pst${P.brk && P.brk.i === i ? " brk" : ""}"${pro ? ` data-pp="${x.s.lon},${x.s.lat}"` : ""}><span class="pt mono">${mk(fmtT(x.eta))}</span><span class="pn"><b>${esc(x.s.name.split(" · ")[0])}</b>${P.brk && P.brk.i === i ? '<span class="pbadge">הפסקה</span>' : ""}${P.golden.includes(x) ? '<span class="pbadge sun">אור זהב</span>' : ""}<span class="small muted">ק״מ ${mk(Math.round(x.km))}${x.s.kind === "cafe" || x.s.cafe ? " · קפה" : x.s.kind === "view" ? " · תצפית" : ""}</span></span>${x.w ? `<span class="pw"><span class="pwx">${wxIcon(x.w.code)}</span><span class="mono">${mk(Math.round(x.w.t))}°</span><span class="small muted">מרגיש ${mk(x.feel)}°${x.w.p >= 20 ? ` · ${mk(x.w.p)}% גשם` : ""}${x.w.g >= 30 ? ` · משבים ${mk(Math.round(x.w.g))}` : ""}</span></span>` : ""}</li>`).join("");
    return `<div class="pdep"><div class="row" style="justify-content:space-between;align-items:baseline"><div><span class="k">יציאה</span><b class="mono">${mk(fmtT(P.dep))}</b><span class="k">סיום</span><b class="mono">${mk(fmtT(P.end))}</b></div>${win.score != null ? `<span class="pscore" style="--h:${Math.round(win.score * 1.3)}">${mk(win.score)}<small>/100</small></span>` : ""}</div>
      <input type="range" dir="ltr" id="planDep" min="0" max="${deps.length - 1}" step="1" value="${k}" aria-label="שעת יציאה" ${pro ? "" : "disabled"}>${strip}
      <div class="small muted">${best && deps.indexOf(best) !== k ? `<button type="button" class="linkbtn" id="planBest">המומלץ: ${mk(fmtT(best.t))}</button> · ` : best ? "זו השעה המומלצת · " : ""}${mk(Math.floor(dur / 60))}:${mk(String(dur % 60).padStart(2, "0"))} שעות כולל עצירות · ממוצע ${mk(P.v)} קמ״ש בתנועה</div></div>
      <p class="psum">${esc(mk(planSummary(P, win)))}</p>
      ${P.watch.length ? `<div class="pwatch"><b>שימו לב</b>${P.watch.slice(0, 4).map(w => `<button type="button" class="pwrow l${w.lvl}"${pro && w.p ? ` data-pp="${w.p[0]},${w.p[1]}"` : ""}>${esc(mk(w.txt))}</button>`).join("")}</div>` : `<div class="pwatch ok"><b>שימו לב</b><span class="small">אין שום דבר חריג בשעה הזאת.</span></div>`}
      ${P.wear ? `<div class="pgear"><b>מה ללבוש</b><span>${esc(P.wear.start)}${P.wear.open ? ` · מ־${mk(fmtT(P.wear.open.eta))} (${esc(P.wear.open.s.name.split(" · ")[0])}) כבר אפשר לפתוח אוורור או להוריד בטנה` : ""}</span>${P.wear.extra.length ? `<span class="small muted">${esc(P.wear.extra.join(" · "))}</span>` : ""}</div>` : ""}
      <ol class="rplan">${tl}</ol>
      <div class="small muted">מחושב מהמסלול, מהגובה, מהעיקולים, מתחזית השעה לכל עצירה וממיקום השמש. הקשה על שורה מראה אותה במפה.</div>`;
  }
  function insightsCard(cid) {
    if (!st.routes[cid]) return ""; const pro = isPro(), ins = routeInsights(cid);
    const teaser = ["שעת יציאה מומלצת", "שעה ומזג אוויר בכל עצירה", "סנוור שמש לפי דקה", "מה ללבוש", ins && ins.tech.length ? `${ins.tech.length} קטעים טכניים` : ""].filter(Boolean).join(" · ");
    return `<div class="card ins plancard${pro ? "" : " locked"}" id="insCard"><div class="row" style="justify-content:space-between"><div><h3>תוכנית הרכיבה</h3><span class="small muted">תובנות הפרק · לפי השעה שתבחרו</span></div><span class="probadge">PRO</span></div>
      ${pro ? `<div id="planBody">${planBody(cid, true)}</div>` : `<p class="small" style="margin:0">${esc(teaser)}</p><div class="lockwrap"><div class="blur" aria-hidden="true" inert>${planBody(cid, false)}</div><button type="button" class="btn primary lockbtn" id="insOpen">${PWI.lock}פתיחת תוכנית הרכיבה</button></div>`}</div>`;
  }
  function bindInsights(cid) {
    const c = $("insCard"); if (!c) return;
    if ($("insOpen")) $("insOpen").onclick = () => openPaywall("insights");
    const bind = () => {
      const sl = $("planDep"); if (sl && !sl.disabled) sl.oninput = () => { st.planDep[cid] = +sl.value; const pb = $("planBody"); if (pb) { pb.innerHTML = planBody(cid, true); bind(); const s2 = $("planDep"); if (s2) s2.focus(); } };
      if ($("planBest")) $("planBest").onclick = () => { const deps = planDepartures(cid), ins = routeInsights(cid); st.planDep[cid] = ins && ins.best ? deps.indexOf(ins.best) : 0; $("planBody").innerHTML = planBody(cid, true); bind(); };
      c.querySelectorAll("[data-pp]").forEach(b => b.onclick = () => { const [lo, la] = b.dataset.pp.split(",").map(Number); map.flyTo({ center: [lo, la], zoom: 13.5, padding: sheetPad(), duration: 1000 }); if (innerWidth < 900) setSheet("peek"); });
    };
    bind();
  }

  /* ================= ride journal ================= */
  function rideTrack(R, me, p, spd) {
    const t = p.timestamp, last = R.trk[R.trk.length - 1];
    if (!last || L.hav([last[0], last[1]], me) > 0.025 || t - last[2] > 10000) R.trk.push([+me[0].toFixed(5), +me[1].toFixed(5), t, spd != null ? Math.round(spd) : null]);
    if (R.trk.length % 20 === 0 && R.trk.length !== R.liveN) { R.liveN = R.trk.length; LS.set("rideLive", { cid: R.c.id, title: R.c.title, odo: R.odo, moving: R.moving, vmax: R.vmax, trk: R.trk.slice(-1500) }); }
    if (spd != null && spd < 230) { if (R.prevSpd != null) R.vmax = Math.max(R.vmax || 0, Math.min(spd, R.prevSpd)); R.prevSpd = spd; if (spd > 5 && R.lastT) R.moving += Math.min(30, (t - R.lastT) / 1000); }
    R.lastT = t;
  }
  function saveRide(R) {
    if (!R.trk || R.trk.length < 3 || R.odo < 1) return null;
    const trk = R.trk.length > 600 ? R.trk.filter((_, i) => i % Math.ceil(R.trk.length / 600) === 0 || i === R.trk.length - 1) : R.trk;
    const cidR = R.c ? R.c.id : R.cid, sim = cidR && st.routes[cidR] ? fuelSimFor(cidR) : null, rate = sim ? sim.burn / sim.total : (bikeEff().cons * bikeEff().style / 100);
    const ride = { id: "r" + Date.now().toString(36), chap: cidR, title: R.c ? R.c.title : R.title, start: R.trk[0][2], end: R.trk[R.trk.length - 1][2], km: +R.odo.toFixed(1), moving: Math.round(R.moving > 60 ? R.moving : (R.trk[R.trk.length - 1][2] - R.trk[0][2]) / 1000), vmax: Math.round(R.vmax || 0), fuel: +(R.odo * rate).toFixed(1), bike: bikeEff().name, trk };
    const rides = LS.get("rides", []); rides.unshift(ride); LS.set("rides", rides.slice(0, 60));
    return ride;
  }
  const dur = s => `${Math.floor(s / 3600)}:${String(Math.round(s % 3600 / 60)).padStart(2, "0")}`;
  function rideSummary(ride) {
    const avg = ride.moving > 60 ? ride.km / (ride.moving / 3600) : 0;
    openModal(`<div class="ridesum"><div class="small muted">${esc(fmtD(new Date(ride.start)))} · ${esc(ride.title)}</div><h2>רכיבה טובה!</h2>
      <div class="fsum"><div><span class="k">מרחק</span><b class="mono">${ride.km}</b><span class="k">ק״מ</span></div><div><span class="k">זמן תנועה</span><b class="mono">${dur(ride.moving)}</b></div><div><span class="k">ממוצע</span><b class="mono">${Math.round(avg)}</b><span class="k">קמ״ש</span></div>${ride.vmax ? `<div><span class="k">מירבית</span><b class="mono">${Math.round(ride.vmax)}</b><span class="k">קמ״ש</span></div>` : ""}<div><span class="k">דלק משוער</span><b class="mono">${ride.fuel}</b><span class="k">ל׳</span></div></div>
      <p class="small muted" style="margin:0">נשמר ביומן הרכיבות בלשונית ״שלי״.</p>
      <div class="row"><button type="button" class="btn primary" id="rsPlay">${PWI.play}שחזור 3D</button><button type="button" class="btn" id="rsShow">במפה</button><button type="button" class="btn" id="rsShare">שיתוף</button><button type="button" class="btn" id="rsClose">סגירה</button></div></div>`);
    $("rsPlay").onclick = () => { closeModal(); if (innerWidth < 900) setSheet("peek"); replayRide(ride); }; $("rsShare").onclick = () => shareRideCard(ride);
    $("rsShow").onclick = () => { closeModal(); showRide(ride); }; $("rsClose").onclick = closeModal;
    memAll().then(ms => { const mine = ms.filter(m => m.kind === "photo" && m.t >= ride.start - 6e4 && m.t <= ride.end + 6e4).slice(0, 8); const box = document.querySelector(".ridesum"); if (!mine.length || !box) return; const g = document.createElement("div"); g.className = "memgrid"; g.innerHTML = mine.map(m => `<button type="button" class="memt" data-mem="${m.id}"><img src="${blobUrl(m.id + "t", m.thumb)}" alt=""></button>`).join(""); box.insertBefore(g, box.querySelector(".row")); g.querySelectorAll("[data-mem]").forEach(b => b.onclick = () => memViewer(b.dataset.mem)); });
  }
  /* Viewing a past ride: only the ride on a clean map. Chapter routes, curve/glare/traffic lines, POIs and the
     stop/weather markers step aside until the rider leaves this view (✕, home, another chapter or ride mode). */
  const RIDE_CLUTTER = ["br-route-dim", "br-route-casing", "br-route-solid", "br-curves", "br-glare", "br-fuelline", "br-trafpts", "br-traffic", "br-inc", "br-view", "br-fuel", "br-moto", "br-cafe", "br-cam", "br-enf-pt", "br-enf-line", "br-pick", "br-terr", "br-terr-pt", "br-green"];
  let rideSaved = null;
  function rideFocus(on, ride) {
    if (on && !rideSaved) { rideSaved = {}; RIDE_CLUTTER.forEach(id => { if (!map.getLayer(id)) return; rideSaved[id] = map.getLayoutProperty(id, "visibility") || "visible"; map.setLayoutProperty(id, "visibility", "none"); }); }
    if (!on && rideSaved) { Object.entries(rideSaved).forEach(([id, v]) => { if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", v); }); rideSaved = null; }
    document.body.classList.toggle("rideview", !!on);
    let chip = $("rideChip"); if (!on) { if (chip) chip.remove(); return; }
    if (!chip) { chip = document.createElement("div"); chip.id = "rideChip"; chip.className = "ridechip"; document.body.appendChild(chip); }
    chip.innerHTML = `<span>${esc(ride.title)} · ${ride.km} ק״מ</span><button type="button" aria-label="חזרה למפה הרגילה">✕</button>`;
    chip.querySelector("button").onclick = () => { st.rideShown = null; pushSources(); rideFocus(false); fitChapter(); };
  }
  function showRide(ride) {
    st.rideShown = ride; pushSources(); rideFocus(true, ride);
    const b = new maplibregl.LngLatBounds(); ride.trk.forEach(p => b.extend([p[0], p[1]])); map.fitBounds(b, { padding: 60, duration: 900, maxZoom: 13 }); if (innerWidth < 900) setSheet("peek");
    toast(`${ride.title} · ${ride.km} ק״מ`);
  }
  function rideGpx(ride) {
    if (!isPro()) return openPaywall("gpx");
    const g = `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Blue Ronin Navigator" xmlns="http://www.topografix.com/GPX/1/1">\n<trk><name>${esc(ride.title)}</name><trkseg>\n${ride.trk.map(p => `<trkpt lat="${p[1]}" lon="${p[0]}"><time>${new Date(p[2]).toISOString()}</time></trkpt>`).join("\n")}\n</trkseg></trk>\n</gpx>\n`;
    saveFile(`blue-ronin-ride-${new Date(ride.start).toISOString().slice(0, 10)}.gpx`, g, "application/gpx+xml");
  }
  function journalCard() {
    const rides = LS.get("rides", []); const pro = isPro();
    if (!rides.length) return `<div class="card"><div class="row" style="justify-content:space-between"><h3>הרכיבות שלי</h3><span class="probadge soft">יומן</span></div><p class="small muted" style="margin:0">כל רכיבה במצב רכיבה נרשמת כאן אוטומטית: מרחק, זמן תנועה, ממוצע ודלק משוער. הכול נשמר רק במכשיר שלך.</p><div class="row"><button type="button" class="btn sm primary" id="jDemo">${PWI.play}הדגמה: שחזור 3D</button></div><p class="small muted" style="margin:0">רכיבה לדוגמה על הפרק שבחרתם, כדי לראות איך נראה השחזור. היא לא נשמרת ביומן.</p></div>`;
    const month = new Date().toISOString().slice(0, 7), mrides = rides.filter(r => new Date(r.start).toISOString().slice(0, 7) === month);
    const tot = (list, f) => list.reduce((a, r) => a + (r[f] || 0), 0);
    const row = (r, i) => `<div class="item"><div style="min-width:0"><b>${esc(r.title)}</b><span class="small muted mono">${esc(fmtD(new Date(r.start)))} · ${r.km} ק״מ · ${dur(r.moving)} · ${r.fuel} ל׳</span></div><div class="row" style="flex-wrap:nowrap"><button type="button" class="btn sm primary" data-rplay="${i}" aria-label="שחזור תלת־ממד">${PWI.play}3D</button><button type="button" class="btn sm" data-rshow="${i}">במפה</button><button type="button" class="btn sm" data-rgpx="${i}">GPX</button></div></div>`;
    const visible = pro ? rides : rides.slice(0, 1), hiddenN = rides.length - visible.length;
    return `<div class="card"><div class="row" style="justify-content:space-between"><h3>הרכיבות שלי</h3>${pro ? '<span class="probadge">PRO</span>' : ""}</div>
      ${pro ? `<div class="fsum"><div><span class="k">החודש</span><b class="mono">${Math.round(tot(mrides, "km"))}</b><span class="k">ק״מ</span></div><div><span class="k">רכיבות</span><b class="mono">${mrides.length}</b></div><div><span class="k">סה״כ</span><b class="mono">${Math.round(tot(rides, "km"))}</b><span class="k">ק״מ</span></div><div><span class="k">דלק</span><b class="mono">${Math.round(tot(rides, "fuel"))}</b><span class="k">ל׳</span></div></div>` : ""}
      ${visible.map(row).join("")}
      <button type="button" class="linkbtn small muted" id="jDemo" style="justify-self:start">הדגמת שחזור 3D על הפרק הנוכחי</button>
      ${hiddenN ? `<button type="button" class="lockrow" id="jMore">${PWI.lock}<span>עוד ${hiddenN} רכיבות שמורות במכשיר שלך. היומן המלא פתוח ב־Pro</span></button>` : ""}</div>`;
  }
  function bindJournal() {
    const rides = LS.get("rides", []);
    document.querySelectorAll("[data-rshow]").forEach(b => b.onclick = () => showRide(rides[+b.dataset.rshow]));
    document.querySelectorAll("[data-rgpx]").forEach(b => b.onclick = () => rideGpx(rides[+b.dataset.rgpx]));
    document.querySelectorAll("[data-rplay]").forEach(b => b.onclick = () => { if (innerWidth < 900) setSheet("peek"); replayRide(rides[+b.dataset.rplay]); });
    if ($("jMore")) $("jMore").onclick = () => openPaywall("journal");
    if ($("jDemo")) $("jDemo").onclick = () => { if (innerWidth < 900) setSheet("peek"); replayRide(demoRide()); };
  }
  function proCard() {
    if (isPro()) return `<div class="card procard on"><div class="row" style="justify-content:space-between"><h3>Blue Ronin Pro</h3><span class="probadge">PRO</span></div><p class="small" style="margin:0">פעיל עוד ${daysLeft()} ימים${st.pro.src === "trial" ? " · תקופת ניסיון" : ""}. תודה שאת/ה חלק מזה.</p><div class="row"><button type="button" class="btn sm" id="proMore">מה כלול</button></div></div>`;
    return `<div class="card procard"><div class="row" style="justify-content:space-between"><h3>Blue Ronin Pro</h3><span class="probadge">PRO</span></div><p class="small" style="margin:0">${esc(personalLine() || "תובנות לכל פרק, יומן רכיבות מלא, מעוף מלא ומסלולים בלי הגבלה.")}</p><div class="row"><button type="button" class="btn primary" id="proMore">${st.pro && st.pro.trialUsed ? "מה כלול ב־Pro" : "7 ימים חינם"}</button></div></div>`;
  }

  /* ================= notifications center ================= */
  const CHANGELOG = [
    { v: "2.7.1", d: "2026-11-12", items: ["אבטחה: הגנה חזקה יותר על השרתים של האפליקציה מפני תעבורה זדונית והצפות"] },
    { v: "2.7.0", d: "2026-11-11", items: ["מצב רכיבה: המסלול מסומן בקו כחול עבה ובולט, והקטע שכבר עברתם מתעמעם", "תוקן: ״מחשב מסלול מחדש״ חזר שוב ושוב כשהייתם על המסלול. עכשיו מודדים מרחק מהכביש עצמו, ומחשבים מחדש רק אחרי סטייה אמיתית", "טלפון לרוחב: מהירות ושעת הגעה גדולות זו לצד זו, והלוח בגובה התוכן בלבד (גם ב״מפה״), בשני צדי הסיבוב", "שעת ההגעה, הקילומטרים והדקות שנותרו בולטים יותר גם לאורך", "חיפוש כתובות: יותר כתובות נמצאות, כולל קיצורים כמו ת״א, ב״ש ופ״ת", "רשימת המתנה להשקה עם קישור אישי: 3 חברים מצטרפים, חודש Pro במתנה", "נשארים בקשר: וואטסאפ, אינסטגרם, יוטיוב, טיקטוק ופייסבוק בלשונית כלים"] },
    { v: "2.6.0", d: "2026-11-10", items: ["חיפוש כתובות מדויק עד מספר הבית, כולל מרכזים מסחריים ועסקים", "זמן הגעה מדויק יותר: התנועה החיה נמדדת רק בכיוון הנסיעה שלכם", "״עזרה בדרך״: מוסכי אופנועים קרובים עם חיוג וניווט, ומספר הגרר של הביטוח במקום אחד. המוסכים מופיעים גם על המפה", "בית ועבודה: עריכה, החלפה והסרה בלחיצה על העיפרון", "מצב רכיבה: אופנוע שזז בצורה חלקה על המפה, ותצוגה שמתאימה את עצמה כשמסובבים את הטלפון", "סיכום רכיבה עם המהירות המרבית", "סופ״ש: היציאה מחושבת מהמיקום שלכם, והתזכורת ליומן תמיד לשישי הקרוב", "מפה נקייה יותר: תחנות, בתי קפה, תצפיות ומצלמות מופיעים כשמתקרבים לאזור", "״במפה״ ברכיבה שמורה מציג רק את הרכיבה, בלי שכבות", "כפתור הבית מציג תמיד את כל הארץ", "Pro: בחירת מסלול אחד בכל פעם, ולחיצה נוספת מבטלת", "טקסט המשוב נשמר גם כשעוברים לשונית"] },
    { v: "2.5.0", d: "2026-11-08", items: ["ניווט יומיומי בכל הארץ: לשונית ״ניווט״ עם חיפוש יעד (גם בקול), בית, עבודה ויעדים אחרונים, זמן הגעה עם תנועה חיה ומזג האוויר ביעד", "לשונית ״סופ״ש״ לתכנון רכיבת סוף שבוע: התדריך, הפרקים והתוכנית, כמו שהיו", "Blue Ronin · ישראל: האפליקציה לכל רוכבי הדו־גלגלי בארץ", "קישור למסלול נפתח ישר על המסלול, נשמר אצלכם ומסומן ״משיתוף״", "פרק 6 קוצר: בלי הקטע הלוך־חזור לים המלח, כדי שהדלק יספיק לכל הלולאה"] },
    { v: "2.4.0", d: "2026-11-07", items: ["תוכנית הרכיבה (Pro): בוחרים שעת יציאה ורואים מתי מגיעים לכל עצירה, מה מזג האוויר שם באותה שעה, כמה קר ברכיבה, מתי השמש בעיניים, איפה לעצור להפסקה ומה ללבוש", "תנועה חיה בישראל: כבישים איטיים וסגורים על המפה, ותאונות וחסימות על המסלול", "מצב רכיבה: שלושה גדלים ללוח (מלא, מצומצם, מפה), תוויות לכל כפתור, וכפתורי המפה תמיד מעל הלוח", "הדגמה של שחזור 3D בלשונית ״שלי״, עוד לפני הרכיבה הראשונה", "במפה נפתח חלון מידע אחד בכל פעם", "הכתובת הקודמת מעבירה אוטומטית ל־blueronin.app"] },
    { v: "2.3.1", d: "2026-11-06", items: ["תיקון דחוף: התדריך והמסלול נטענים תמיד, גם כששירות מזג האוויר החיצוני עמוס", "התחזית מגיעה עכשיו ממטמון משותף בשרת שלנו, עם גיבוי ישיר ושמירת התחזית האחרונה", "אם לשונית נתקלת בבעיה מוצגת הודעה עם כפתור טעינה מחדש במקום מסך ריק"] },
    { v: "2.3.0", d: "2026-11-06", items: ["שחזור 3D של רכיבה שרכבת: השעון האמיתי, צבע השמיים של אותה שעה, ועצירה על כל תמונה במקום שבו צילמת", "רכיבה קבוצתית: כל הרוכבים על מפה אחת, נקודת מפגש, וקריאת חירום שמגיעה לכל הקבוצה", "העברת נתונים בקוד מוצפן (גם באייפון), וגיבוי ושחזור לקובץ", "צילום מהמצלמה נשמר כבר מהפעם הראשונה, ועיבוד תמונות מהיר יותר", "חיפוש קולי עם מסך האזנה שתמיד אפשר לסגור, ומעבר להכתבה מהמקלדת כשצריך", "אישור ברור אחרי שליחת דיווח, עם מספר פנייה", "מנגנון שמונע היתקעות בפתיחה, ודיווח תקלות אוטומטי לצוות", "שמירת הנתונים שלך קודמת לכל מטמון כשהזיכרון בטלפון מתמלא"] },
    { v: "2.2.0", d: "2026-11-06", items: ["לשונית חדשה ״שלי״: בטיחות, מיקום חי, האופנוע והזיכרונות שלך", "איש קשר לחירום: כפתור SOS במצב רכיבה (לחיצה ארוכה), התקשרות ו־וואטסאפ עם המיקום בלחיצה, והתראה דחופה לטלפון של איש הקשר", "זיהוי נפילה במצב רכיבה (בטא): ספירה של 30 שניות, ואם אין תשובה יוצאת התראה", "שיתוף מיקום חי בקישור, עד 12 שעות", "איפה חניתי: המיקום נשמר לבד כשעוצרים, וחץ שמוביל ברגל חזרה לאופנוע", "זיכרונות: צילום והקלטה מהדרך, מסודרים לפי תאריך ופרק, ותמונות הרכיבה בסיכום שלה", "חיפוש קולי בבניית מסלול", "משוב לצוות עם תמונה או הקלטה, ודיווח לקבוצה עם תמונה", "מצב רכיבה: ההנחיות הקוליות עובדות מהלחיצה הראשונה, הכרזה בהגעה לעצירה, ק״מ ושעת הגעה, אזהרה לפני עיקול חד ותזכורת שקיעה", "תוכנית הדלק המלאה עברה ל־Pro. התשובה אם הדלק מספיק, האזהרה ואיתור התחנה נשארים חינם", "מעבר לכתובת הקבועה blueronin.app עם כל הנתונים"] },
    { v: "2.1.0", d: "2026-11-06", items: ["Blue Ronin Pro: תובנות לכל פרק, יומן רכיבות מלא ו־7 ימי ניסיון", "יומן רכיבות: כל רכיבה נשמרת אוטומטית", "כרטיס ״השבת שלי״ לשיתוף בוואטסאפ", "מרכז הודעות עם היסטוריה", "מצפורים נפתחים עם תמונות, ומיון לפי המרחק ממך"] },
    { v: "2.0.0", d: "2026-11-05", items: ["עצירות, קפה ודלק לאורך הפרק שבחרת", "תוכנית דלק לפי דגם האופנוע, מד מיכל צבעוני ואיתור תחנה", "מעוף ציפור חלק עם טעינה מראש", "פרק 6 על כביש 90 בלבד"] }
  ];
  function inboxItems() {
    const ct = st.content || {}, out = [];
    (ct.history || []).forEach(h => out.push({ t: h.t, kind: h.kind, level: h.level, title: h.kind === "push" ? h.title : "הודעה מהצוות", text: h.text, link: h.link }));
    out.sort((a, b) => b.t - a.t); return out;
  }
  function unreadCount() { const seen = LS.get("inboxSeen", 0); return inboxItems().filter(x => x.t > seen).length + (CHANGELOG[0] && LS.get("seenVer", "") !== CHANGELOG[0].v ? 1 : 0); }
  function renderBell() { const n = unreadCount(), b = $("bellN"); if (!b) return; b.hidden = !n; b.textContent = n > 9 ? "9+" : n; $("bellBtn").setAttribute("aria-label", n ? `הודעות, ${n} חדשות` : "הודעות"); }
  function openInbox() {
    const items = inboxItems(), seen = LS.get("inboxSeen", 0), hz = st.hazards || [], ct = st.content || {};
    const fmtDT = t => new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: TZ }).format(new Date(t));
    const ic = { announce: "📣", push: "🔔" };
    const box = openModal(`<div class="inbox"><h2>הודעות</h2>
      ${ct.announce && ct.announce.on ? `<div class="alert ${ct.announce.level === "info" ? "info" : ""}"><b>עכשיו:</b> ${esc(ct.announce.text)}${ct.announce.link ? ` <a href="${esc(ct.announce.link)}" target="_blank" rel="noopener">פרטים</a>` : ""}</div>` : ""}
      ${hz.length ? `<h3>עדכוני דרך פעילים</h3>${hz.map(h => `<button type="button" class="item ibtn" data-hz="${esc(h.id)}"><span class="pic" style="background:var(--caution)">${glyphSvgRaw("haz")}</span><div style="min-width:0"><b>${esc(HZK[h.kind] || "עדכון דרך")}</b><span class="small muted">${esc(h.text)}${h.until ? ` · עד ${esc(h.until.split("-").reverse().join("."))}` : ""}</span></div></button>`).join("")}` : ""}
      <h3>מהצוות</h3>${items.length ? items.map(x => `<div class="item imsg${x.t > seen ? " new" : ""}"><div style="min-width:0"><b>${x.kind === "push" ? "התראה: " : ""}${esc(x.title)}</b><span class="small">${esc(x.text)}</span>${x.link ? `<a class="small" href="${esc(x.link)}" target="_blank" rel="noopener">פרטים</a>` : ""}</div><span class="small muted mono" style="white-space:nowrap">${esc(fmtDT(x.t))}</span></div>`).join("") : `<p class="small muted">עוד אין הודעות. כשהצוות מפרסם משהו, הוא נשמר כאן.</p>`}
      <h3>מה חדש באפליקציה</h3>${CHANGELOG.map(c => `<div class="chlog"><b class="mono">${c.v}</b> <span class="small muted">${esc(c.d.split("-").reverse().join("."))}</span><ul>${c.items.map(i => `<li>${esc(i)}</li>`).join("")}</ul></div>`).join("")}</div>`, "inboxm");
    box.querySelectorAll("[data-hz]").forEach(b => b.onclick = () => { const h = hz.find(x => x.id === b.dataset.hz); if (!h) return; closeModal(); map.flyTo({ center: [h.lon, h.lat], zoom: 13.5, padding: sheetPad() }); if (innerWidth < 900) setSheet("peek"); });
    LS.set("inboxSeen", Math.max(Date.now(), ...items.map(x => x.t))); LS.set("seenVer", CHANGELOG[0].v); renderBell();
  }
  const glyphSvgRaw = g => `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">${GLYPH[g].map(d => `<path d="${d}"/>`).join("")}</svg>`;
  $("bellBtn").onclick = openInbox;
  if (location.hash === "#inbox") setTimeout(openInbox, 1200);

  /* ================= "My Saturday" share card ================= */
  function shareSatBtn() { return `<button type="button" class="sharesat" id="shareSat"><span class="pwi">${PWI.share}</span><span><b>השבת שלי</b><span class="small muted">כרטיס עם ${esc(chap().title)}, שעת היציאה והתחזית. מוכן לוואטסאפ</span></span></button>`; }
  async function shareSaturday() {
    const c = chap(), r = st.routes[c.id], w = chapterWx(c.id), sim = fuelSimFor(c.id), ins = isPro() ? routeInsights(c.id) : null;
    const pdeps = ins ? planDepartures(c.id) : [], pk = st.planDep && st.planDep[c.id];
    const dep = pk != null && pdeps[pk] ? pdeps[pk].t : ins && ins.best ? ins.best.t : departFor(c);
    const P = placesAlong(c.id); const cafe = P.cafes.find(x => x.curated || x.sat === "open") || P.cafes[0];
    try { await Promise.all(["700 76px Assistant, system-ui, sans-serif", "500 36px Assistant, system-ui, sans-serif", "700 46px Karantina"].map(f => document.fonts.load(f))); } catch (e) { }
    const W = 1080, H = 1350, cv = document.createElement("canvas"); cv.width = W; cv.height = H; const g = cv.getContext("2d");
    const grd = g.createLinearGradient(0, 0, 0, H); grd.addColorStop(0, "#0B1424"); grd.addColorStop(1, "#16233B"); g.fillStyle = grd; g.fillRect(0, 0, W, H);
    /* the route itself, drawn as the hero */
    if (r) { const s = L.simplifyByDist(r.coords, Math.max(0.05, r.km / 600)); let w0 = 180, e0 = -180, s0 = 90, n0 = -90; s.forEach(p => { w0 = Math.min(w0, p[0]); e0 = Math.max(e0, p[0]); s0 = Math.min(s0, p[1]); n0 = Math.max(n0, p[1]); });
      const kx = Math.cos((s0 + n0) / 2 * Math.PI / 180), bw = (e0 - w0) * kx, bh = n0 - s0, sc = Math.min(800 / bw, 560 / bh), ox = (W - bw * sc) / 2, oy = 330 + (560 - bh * sc) / 2;
      const X = p => ox + (p[0] - w0) * kx * sc, Y = p => oy + (n0 - p[1]) * sc;
      g.lineJoin = g.lineCap = "round"; g.strokeStyle = "rgba(92,141,255,.25)"; g.lineWidth = 26; g.beginPath(); s.forEach((p, i) => i ? g.lineTo(X(p), Y(p)) : g.moveTo(X(p), Y(p))); g.stroke();
      g.strokeStyle = "#5C8DFF"; g.lineWidth = 9; g.stroke(); g.fillStyle = "#FFA24A"; g.beginPath(); g.arc(X(s[0]), Y(s[0]), 16, 0, Math.PI * 2); g.fill(); }
    g.direction = "rtl"; g.textAlign = "right"; const R0 = W - 72;
    g.fillStyle = "#5C8DFF"; g.font = "700 46px Karantina, Assistant, sans-serif"; g.fillText("BLUE RONIN · השבת שלי", R0, 96);
    g.fillStyle = "#E6ECF4"; g.font = "700 76px Assistant, system-ui, sans-serif"; g.fillText(c.title, R0, 196);
    g.fillStyle = "#8C9DB3"; g.font = "500 40px Assistant, system-ui, sans-serif"; g.fillText(fmtD(st.sat.noonUTC), R0, 260);
    const tiles = [["יציאה", fmtT(dep)], ["מרחק", r ? Math.round(r.km) + " ק״מ" : "--"], ["טמפ׳", w ? `${Math.round(w.agg.tMin)}°–${Math.round(w.agg.tMax)}°` : "--"], ["ציון שבת", w ? w.ri.i + "/100" : "--"]];
    tiles.forEach(([k, v], i) => { const x = R0 - i * 240, y = 940; g.fillStyle = "rgba(255,255,255,.06)"; g.beginPath(); if (g.roundRect) g.roundRect(x - 220, y, 220, 150, 22); else g.rect(x - 220, y, 220, 150); g.fill(); g.fillStyle = "#8C9DB3"; g.font = "500 32px Assistant, system-ui, sans-serif"; g.fillText(k, x - 22, y + 50); g.fillStyle = "#E6ECF4"; g.font = "700 50px Assistant, system-ui, sans-serif"; g.direction = /^[\d\s°–:/.-]+$/.test(v) ? "ltr" : "rtl"; g.fillText(v, x - 22, y + 115); g.direction = "rtl"; });
    g.font = "500 36px Assistant, system-ui, sans-serif"; g.fillStyle = "#E6ECF4"; let y = 1160;
    if (cafe) { g.fillText(`☕ עצירה: ${cafe.name}${cafe.km != null ? ` · ק״מ ${Math.round(cafe.km)}` : ""}`, R0, y); y += 58; }
    if (sim) { g.fillText(sim.refuels.length ? `⛽ תדלוק: ${sim.refuels.map(x => x.label).join(", ")}` : `⛽ ${sim.be.name}: בלי לתדלק בדרך`, R0, y); y += 58; }
    g.fillStyle = "#8C9DB3"; g.font = "500 30px Assistant, system-ui, sans-serif"; g.fillText(location.host, R0, H - 50);
    const blob = await new Promise(res => cv.toBlob(res, "image/png")); const file = new File([blob], "blue-ronin-shabbat.png", { type: "image/png" });
    const text = `השבת שלי: ${c.title}. יציאה ${fmtT(dep)}, ${r ? Math.round(r.km) + " ק״מ" : ""}. מצטרפים? ${location.origin}/?c=${c.id}`;
    try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text }); return; } } catch (e) { if (e.name === "AbortError") return; }
    const u = URL.createObjectURL(blob); openModal(`<div class="ridesum"><h2>השבת שלי</h2><img src="${u}" alt="כרטיס השבת" style="border-radius:14px;width:100%"><div class="row"><a class="btn primary" href="${u}" download="blue-ronin-shabbat.png">שמירת התמונה</a><a class="btn" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(text)}">שליחה בוואטסאפ</a></div></div>`);
  }

  /* ================= viewpoints: same floating card as cafes, with photos ================= */
  function viewPopup(v) {
    const c = chap(), r = st.routes[c.id]; let onRoute = "";
    const nr = nearRoute([v], c.id, 1.5, "vp:" + v.lat + "," + v.lon); if (nr.length) onRoute = `ק״מ ${Math.round(nr[0].km)} בפרק${nr[0].d > 0.15 ? ` · ${nr[0].d < 1 ? Math.round(nr[0].d * 1000) + " מ׳" : nr[0].d.toFixed(1) + " ק״מ"} מהכביש` : ""}`;
    const sun = SunCalc.getTimes(st.sat.noonUTC, v.lat, v.lon);
    const q = `${v.name || "מצפור"} מצפור`;
    const pop = new maplibregl.Popup({ closeButton: false, maxWidth: "290px" }).setLngLat([v.lon, v.lat]).setHTML(`${photoSlot(v.lat, v.lon, "view")}<b>${esc(v.name || "מצפור")}</b><div class="small muted">${onRoute ? esc(onRoute) + " · " : ""}מצפור · OpenStreetMap</div><div class="chips" style="margin-top:4px"><span class="chip sun">זריחה ${fmtT(sun.sunrise)}</span><span class="chip sun">שקיעה ${fmtT(sun.sunset)}</span></div><div class="row" style="margin-top:6px">${navBtn("w", wazeLL(v.lat, v.lon))}${navBtn("g", gmLL(v.lat, v.lon))}<a class="navb m" target="_blank" rel="noopener" href="https://www.google.com/search?q=${encodeURIComponent(q)}">${IC.mountain}<span>עוד</span></a></div>`).addTo(map);
    fillPhotos(pop.getElement());
  }

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
    set("i-moto", iconImage("#7A5AF8", "moto"));
    set("i-cam", iconImage(css("--warn"), "cam"));
    set("i-haz", iconImage(css("--caution"), "haz"));
    set("i-cafe", iconImage("#8F5A35", "cup")); set("i-cafe-top", iconImage(css("--sun"), "cup"));
  }
  function setupStyle() {
    hebrewize();
    const under = firstOf(/^(tunnel|road|highway|bridge|transportation|aeroway|building)/) || firstSymbol();
    const sym = firstSymbol();
    if (!map.getSource("dem")) map.addSource("dem", DEM);
    if (!map.getSource("dem-hs")) map.addSource("dem-hs", DEM);
    map.addLayer({ id: "br-hill", type: "hillshade", source: "dem-hs", layout: { visibility: st.layers.hillshade ? "visible" : "none" }, paint: { "hillshade-exaggeration": isDark() ? 0.45 : 0.3, "hillshade-shadow-color": isDark() ? "#000814" : "#55657a", "hillshade-highlight-color": isDark() ? "#2a3a55" : "#ffffff", "hillshade-accent-color": isDark() ? "#0b1424" : "#6b7a8c" } }, under);
    ["br-route", "br-curves", "br-glare", "br-enf", "br-osm", "br-terr", "br-green", "br-trafpts", "br-fly", "br-pick", "br-haz", "br-cafes", "br-ride", "br-walk"].forEach(id => { if (!map.getSource(id)) map.addSource(id, { type: "geojson", data: FC() }); });
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
    if (!map.getSource("br-fuelline")) map.addSource("br-fuelline", { type: "geojson", lineMetrics: true, data: FC() });
    map.addLayer({ id: "br-fuelline", type: "line", source: "br-fuelline", layout: { "line-cap": "round", "line-join": "round", visibility: "none" }, paint: { "line-width": ["interpolate", ["linear"], ["zoom"], 7, 4, 13, 8], "line-color": c("--go") } }, sym);
    map.addLayer({ id: "br-fly", type: "line", source: "br-fly", paint: { "line-color": "#fff", "line-width": ["interpolate", ["linear"], ["zoom"], 8, 2, 14, 5], "line-opacity": 0.85, "line-blur": 0.5 }, layout: { "line-cap": "round", "line-join": "round" } });
    /* ride-mode guide line: the route still ahead, bold and bright, over a contrasting casing; the part already
       ridden fades out. Shown only while riding (the chapter line and curve colours step aside). */
    if (!map.getSource("br-guide")) map.addSource("br-guide", { type: "geojson", lineMetrics: true, data: FC() });
    map.addLayer({ id: "br-guide-casing", type: "line", source: "br-guide", layout: { visibility: "none", "line-cap": "round", "line-join": "round" }, paint: { "line-width": ["interpolate", ["exponential", 1.4], ["zoom"], 9, 7, 13, 12, 16, 20, 18, 30], "line-gradient": guideGrad(0, true) } }, sym);
    map.addLayer({ id: "br-guide", type: "line", source: "br-guide", layout: { visibility: "none", "line-cap": "round", "line-join": "round" }, paint: { "line-width": ["interpolate", ["exponential", 1.4], ["zoom"], 9, 4, 13, 7.5, 16, 13, 18, 20], "line-gradient": guideGrad(0, false) } }, sym);
    if (st.ride) guideShow(st.ride.G);
    map.addLayer({ id: "br-ride-casing", type: "line", source: "br-ride", paint: { "line-color": c("--bg"), "line-width": ["interpolate", ["linear"], ["zoom"], 8, 5, 14, 9] }, layout: { "line-cap": "round", "line-join": "round" } });
    map.addLayer({ id: "br-ride", type: "line", source: "br-ride", paint: { "line-color": c("--sun"), "line-width": ["interpolate", ["linear"], ["zoom"], 8, 2.5, 14, 5] }, layout: { "line-cap": "round", "line-join": "round" } });
    map.addLayer({ id: "br-walk", type: "line", source: "br-walk", paint: { "line-color": c("--accent"), "line-width": 4, "line-dasharray": [1, 1.6] }, layout: { "line-cap": "round" } });
    map.addLayer({ id: "br-trafpts", type: "circle", source: "br-trafpts", paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 7, 4, 13, 8], "circle-color": ["case", [">=", ["get", "r"], 0.8], c("--go"), [">=", ["get", "r"], 0.55], c("--caution"), c("--no")], "circle-stroke-color": "#fff", "circle-stroke-width": 1.8, "circle-opacity": 0.95 } });
    map.addLayer({ id: "br-pick", type: "circle", source: "br-pick", paint: { "circle-radius": 9, "circle-color": c("--report"), "circle-stroke-color": "#fff", "circle-stroke-width": 2.5 } });
    if (st.cfg.traffic) addTrafficLayer();
    map.addLayer({ id: "br-enf-pt", type: "circle", source: "br-enf", filter: ["==", ["geometry-type"], "Point"], minzoom: 9, paint: { "circle-radius": 7, "circle-color": c("--warn"), "circle-stroke-color": "#fff", "circle-stroke-width": 2 } });
    addIcons();
    const sz = (a, b) => ["interpolate", ["linear"], ["zoom"], 7, a, 13, b];
    map.addLayer({ id: "br-view", type: "symbol", source: "br-osm", filter: ["==", ["get", "k"], "view"], minzoom: 9.6, layout: { "icon-image": "i-view", "icon-size": sz(0.5, 0.9), "icon-allow-overlap": false, "icon-padding": 1, "symbol-sort-key": 3 } });
    map.addLayer({ id: "br-fuel", type: "symbol", source: "br-osm", filter: ["==", ["get", "k"], "fuel"], minzoom: 9.3, layout: { "icon-image": ["concat", "i-fuel-", ["coalesce", ["get", "s"], "unknown"]], "icon-size": sz(0.55, 0.95), "icon-allow-overlap": true, "symbol-sort-key": 2 } });
    map.addLayer({ id: "br-cafe", type: "symbol", source: "br-cafes", minzoom: 9.6, layout: { "icon-image": ["case", ["get", "top"], "i-cafe-top", "i-cafe"], "icon-size": sz(0.5, 0.88), "icon-allow-overlap": ["case", ["get", "top"], true, false], "icon-padding": 1, "symbol-sort-key": ["case", ["get", "top"], 0, 4] } });
    map.addLayer({ id: "br-moto", type: "symbol", source: "br-osm", filter: ["==", ["get", "k"], "moto"], minzoom: 9.5, layout: { visibility: st.layers.moto ? "visible" : "none", "icon-image": "i-moto", "icon-size": sz(0.5, 0.9), "icon-allow-overlap": false, "icon-padding": 1, "symbol-sort-key": 2 } });
    map.addLayer({ id: "br-cam", type: "symbol", source: "br-osm", filter: ["==", ["get", "k"], "cam"], minzoom: 9, layout: { "icon-image": "i-cam", "icon-size": sz(0.55, 0.9), "icon-allow-overlap": true, "symbol-sort-key": 1 } });
    map.addLayer({ id: "br-haz-halo", type: "circle", source: "br-haz", paint: { "circle-radius": sz(9, 18), "circle-color": c("--caution"), "circle-opacity": 0.22 } });
    map.addLayer({ id: "br-haz", type: "symbol", source: "br-haz", layout: { "icon-image": "i-haz", "icon-size": sz(0.6, 1), "icon-allow-overlap": true, "symbol-sort-key": 0 } });
    if (st.layers.radar) addRadarLayer();
    if (st.terrain) map.setTerrain({ source: "dem", exaggeration: 1.5 });
    pushSources(); applyLayerVis();
  }
  let styleReady = false;
  map.on("style.load", () => { styleReady = true; setupStyle(); });
  window.BR_MAP = map;

  const HZK = { closure: "כביש סגור", gravel: "חצץ או שמן", works: "עבודות", police: "אכיפה", info: "עדכון דרך" };
  map.on("click", "br-haz", e => { const p = e.features[0].properties; new maplibregl.Popup({ closeButton: false, maxWidth: "280px" }).setLngLat(e.lngLat).setHTML(`<b>${esc(HZK[p.kind] || "עדכון דרך")}</b><div>${esc(p.text)}</div><div class="small muted">עדכון מצוות Blue Ronin${p.until ? ` · בתוקף עד ${esc(p.until.split("-").reverse().join("."))}` : ""}</div>`).addTo(map); });
  map.on("click", "br-cafe", e => { const c = allCafes().find(x => x.id === e.features[0].properties.id); if (c) cafePopup(c); });
  map.on("mouseenter", "br-cafe", () => map.getCanvas().style.cursor = "pointer"); map.on("mouseleave", "br-cafe", () => map.getCanvas().style.cursor = "");
  ["br-cam", "br-view", "br-fuel", "br-moto", "br-enf-pt", "br-enf-line"].forEach(id => {
    map.on("click", id, e => {
      const f = e.features[0], p = f.properties; const [lon, lat] = e.lngLat.toArray ? e.lngLat.toArray() : [e.lngLat.lng, e.lngLat.lat];
      let h = "";
      if (id === "br-moto") { const n = st.osm && (st.osm.moto || []).find(x => x.id === p.id); if (n) motoPopup(n); return; }
      if (id === "br-fuel") { const n = st.osm && st.osm.fuel.find(x => x.id === p.id); if (n) { openFuelPopup(n); return; } }
      if (id === "br-view") { const [vl, vt] = f.geometry.coordinates; viewPopup({ name: p.name, lat: vt, lon: vl }); return; }
      if (id === "br-cam") h = `<b>מצלמת מהירות</b><div class="small muted">OpenStreetMap${p.maxspeed ? " · מהירות " + esc(p.maxspeed) : ""}</div>`;
      else if (id.startsWith("br-enf")) h = `<b>${esc(p.name)}</b><div class="small muted">${esc(p.src)}</div>`;
      else h = `<b>${esc(p.name || (id === "br-fuel" ? "תחנת דלק" : "מצפור"))}</b><div class="small muted">${id === "br-fuel" ? esc(p.brand || "תחנת דלק") : "מצפור · OpenStreetMap"}</div><div class="row" style="margin-top:6px">${navBtn("w", wazeLL(lat, lon))}${navBtn("g", gmLL(lat, lon))}</div>`;
      const pop = new maplibregl.Popup({ closeButton: false, maxWidth: "280px" }).setLngLat(e.lngLat).setHTML((id === "br-view" ? photoSlot(lat, lon, "view") : "") + h).addTo(map);
      fillPhotos(pop.getElement());
    });
    map.on("mouseenter", id, () => map.getCanvas().style.cursor = "pointer");
    map.on("mouseleave", id, () => map.getCanvas().style.cursor = "");
  });

  const LAYER_MAP = { curves: ["br-curves"], glare: ["br-glare"], cams: ["br-cam", "br-enf-pt", "br-enf-line"], osmview: ["br-view"], fuel: ["br-fuel"], moto: ["br-moto"], cafes: ["br-cafe"], fuelline: ["br-fuelline"], hillshade: ["br-hill"], radar: ["br-radar"], green: ["br-green", "br-terr", "br-terr-pt"], traffic: ["br-traffic", "br-trafpts", "br-inc"] };
  function applyLayerVis() {
    if (!styleReady) { renderMarkers(); return; }
    for (const k in LAYER_MAP) LAYER_MAP[k].forEach(id => { if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", st.layers[k] ? "visible" : "none"); });
    if (map.getLayer("br-route-solid")) map.setLayoutProperty("br-route-solid", "visibility", st.layers.curves ? "none" : "visible");
    if (map.getLayer("br-fuelline")) map.setLayoutProperty("br-fuelline", "visibility", st.layers.fuelline && !st.fly ? "visible" : "none");
    if (st.ride && map.getLayer("br-guide")) GUIDE_HIDE.forEach(id => map.getLayer(id) && map.setLayoutProperty(id, "visibility", "none"));
    renderMarkers();
  }
  function setSrc(id, data) { const s = map.getSource(id); if (s) s.setData(data); }
  /* ---------- ride guide line ---------- */
  const GUIDE_HIDE = ["br-route-dim", "br-route-casing", "br-route-solid", "br-curves", "br-glare"];
  function guideGrad(f, casing) {
    const dk = isDark(), ahead = casing ? (dk ? "rgba(236,242,252,0.95)" : "rgba(10,38,96,0.92)") : (dk ? "#4F8BFF" : "#1E5BFF");
    const done = casing ? (dk ? "rgba(236,242,252,0.18)" : "rgba(10,38,96,0.18)") : (dk ? "rgba(140,157,179,0.55)" : "rgba(86,104,122,0.5)");
    const x = Math.max(0.0002, Math.min(0.9997, f || 0));
    return ["interpolate", ["linear"], ["line-progress"], 0, done, x, done, x + 0.0002, ahead, 1, ahead];
  }
  function guideShow(G) {
    if (!map.getSource("br-guide") || !G) return;
    setSrc("br-guide", FC([{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: G.coords } }])); G.gf = -1;
    ["br-guide-casing", "br-guide"].forEach(id => map.getLayer(id) && map.setLayoutProperty(id, "visibility", "visible"));
    GUIDE_HIDE.forEach(id => map.getLayer(id) && map.setLayoutProperty(id, "visibility", "none"));
    guideProgress(G, G.cum[G.idx] || 0);
  }
  function guideProgress(G, km) {
    if (!map.getLayer("br-guide")) return; const tot = G.cum[G.cum.length - 1] || 1, f = Math.max(0, Math.min(1, km / tot));
    if (Math.abs(f - (G.gf ?? -1)) < 0.0015) return; G.gf = f;
    try { map.setPaintProperty("br-guide-casing", "line-gradient", guideGrad(f, true)); map.setPaintProperty("br-guide", "line-gradient", guideGrad(f, false)); } catch (e) { }
  }
  function guideHide() {
    if (!map.getSource("br-guide")) return; setSrc("br-guide", FC());
    ["br-guide-casing", "br-guide"].forEach(id => map.getLayer(id) && map.setLayoutProperty(id, "visibility", "none"));
    ["br-route-dim", "br-route-casing"].forEach(id => map.getLayer(id) && map.setLayoutProperty(id, "visibility", "visible"));
    applyLayerVis();
  }
  /* the map's credits fold into the (i) button during a ride, so they never cover the ride buttons */
  function foldAttrib() { document.querySelectorAll(".maplibregl-ctrl-attrib.maplibregl-compact-show").forEach(x => x.classList.remove("maplibregl-compact-show")); }
  function pushSources() {
    if (!map.getSource("br-route")) return;
    setSrc("br-route", FC(CHAPTERS.filter(c => st.routes[c.id] && (!c.hidden || c.id === st.chap) && (!c.combo || c.id === st.chap) && (c.region === chap().region || c.id === st.chap)).map(c => ({ type: "Feature", properties: { chap: c.id, active: c.id === st.chap }, geometry: { type: "LineString", coordinates: st.routes[c.id].coords } }))));
    setSrc("br-ride", FC(st.rideShown ? [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: st.rideShown.trk.map(p => [p[0], p[1]]) } }] : []));
    setSrc("br-curves", FC((st.curves[st.chap] || []).map(s => ({ type: "Feature", properties: { cls: s.cls }, geometry: { type: "LineString", coordinates: s.coords } }))));
    setSrc("br-terr", FC((st.terr[st.chap] || []).flatMap(t => [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: t.coords } }, { type: "Feature", properties: { k: "in" }, geometry: { type: "Point", coordinates: t.enter } }].concat(t.exit ? [{ type: "Feature", properties: { k: "out" }, geometry: { type: "Point", coordinates: t.exit } }] : []))));
    { const tr = st.traffic[st.chap]; if (map.getSource("br-traffic")) { setSrc("br-traffic", FC(tr && tr.segs ? tr.segs.map(g => ({ type: "Feature", properties: { j: g.j, c: g.c }, geometry: { type: "LineString", coordinates: g.l } })) : [])); setSrc("br-inc", FC(tr && tr.inc ? tr.inc.map(i => ({ type: "Feature", properties: { kind: i.kind, label: i.label, closed: !!i.closed, txt: i.txt || "", until: i.until || "" }, geometry: { type: "Point", coordinates: [i.lon, i.lat] } })) : [])); } }
    const tr = st.traffic[st.chap]; setSrc("br-trafpts", FC(tr && tr.pts ? tr.pts.filter(p => p.ratio != null && p.ratio < 0.8 || p.closed).map(p => ({ type: "Feature", properties: { r: p.closed ? 0 : p.ratio }, geometry: { type: "Point", coordinates: [p.lon, p.lat] } })) : []));
    setSrc("br-glare", FC((st.glare[st.chap] || []).map(g => ({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: g.coords } }))));
    setSrc("br-enf", FC(ENF.map(e => ({ type: "Feature", properties: { name: e.name, src: e.src }, geometry: e.pts.length > 1 ? { type: "LineString", coordinates: e.pts.map(p => [p[1], p[0]]) } : { type: "Point", coordinates: [e.pts[0][1], e.pts[0][0]] } }))));
    if (st.routes[st.chap]) { const cf = placesAlong(st.chap).cafes.filter(c => !st.shabbat || c.sat !== "closed"); setSrc("br-cafes", FC(cf.map(c => ({ type: "Feature", properties: { id: c.id, top: !!c.curated }, geometry: { type: "Point", coordinates: [c.lon, c.lat] } })))); }
    paintFuelLine();
    setSrc("br-haz", FC(st.hazards.map(h => ({ type: "Feature", properties: { id: h.id, text: h.text, kind: h.kind, until: h.until || "" }, geometry: { type: "Point", coordinates: [h.lon, h.lat] } }))));
    const o = st.osm;
    if (o) setSrc("br-osm", FC([...(o.moto || []).map(n => ({ type: "Feature", properties: { k: "moto", id: n.id }, geometry: { type: "Point", coordinates: [n.lon, n.lat] } })), ...o.cams.map(n => ({ type: "Feature", properties: { k: "cam", maxspeed: n.maxspeed || "" }, geometry: { type: "Point", coordinates: [n.lon, n.lat] } })), ...o.views.map(n => ({ type: "Feature", properties: { k: "view", name: n.name || "" }, geometry: { type: "Point", coordinates: [n.lon, n.lat] } })), ...o.fuel.map(n => { const f = fuelStatus(n); return { type: "Feature", properties: { k: "fuel", id: n.id, name: n.name || "", brand: n.brand || "", s: f.sat }, geometry: { type: "Point", coordinates: [n.lon, n.lat] } }; })]));
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
    if (st.layers.wx && st.wx && !st.fly) wxPoints().forEach((p, i) => {
      const h = satHour(i, 8); if (!h) return;
      const e = document.createElement("div"); e.className = "mkw"; e.innerHTML = `${wxIcon(h.code)}${Math.round(h.t)}°`;
      mk.push(new maplibregl.Marker({ element: e, anchor: "bottom" }).setLngLat([p.lon, p.lat]).addTo(map));
    });
    if (st.me) { const e = document.createElement("div"); e.className = "me"; mk.push(new maplibregl.Marker({ element: e }).setLngLat([st.me.lon, st.me.lat]).addTo(map)); }
  }
  function cafePopup(c) {
    const q = `${c.name} ${c.place || ""}`.trim(), f = c.sat ? c : Object.assign({}, c, cafeStatus(c));
    const pop = new maplibregl.Popup({ closeButton: false, maxWidth: "290px" }).setLngLat([c.lon, c.lat]).setHTML(`${photoSlot(c.lat, c.lon, "cafe")}<b>${esc(c.name)}</b><div class="small muted">${esc(c.place || "")}${c.place ? " · " : ""}${esc(c.src || "OpenStreetMap")}</div><div class="chips" style="margin-top:4px">${cafePill(f)}</div><div class="row" style="margin-top:6px">${navBtn("w", c.curated ? wazeQ(q) : wazeLL(c.lat, c.lon))}${navBtn("g", c.curated ? gmQ(q) : gmLL(c.lat, c.lon))}<a class="navb m" target="_blank" rel="noopener" href="https://www.google.com/search?q=${encodeURIComponent(q + " תפריט")}">${IC.menu}<span>תפריט</span></a></div>`).addTo(map);
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
  /* the home button: all of Israel, close enough to read, the same every time (the sheet size no longer changes
     the zoom: the map is framed for the space above a half sheet at most) */
  const ISRAEL = [[34.27, 29.5], [35.9, 33.33]];
  function homeIsrael(dur = 1200) {
    const ph = innerWidth < 900, H = innerHeight, pad = ph ? { top: 70, bottom: Math.min(H * 0.42, sheetPad().bottom || 0) + 10, left: 70, right: 16 } : { top: 70, bottom: 30, left: 90, right: Math.min(innerWidth * 0.42, 460) + 20 };
    let cam = null; try { cam = map.cameraForBounds(ISRAEL, { padding: pad, bearing: 0 }); } catch (e) { }
    if (!cam) try { cam = map.cameraForBounds(ISRAEL, { padding: 10, bearing: 0 }); } catch (e) { }
    if (cam) map.easeTo(Object.assign({}, cam, { pitch: 0, bearing: 0, duration: dur })); else map.fitBounds(ISRAEL, { padding: 10, duration: dur });
  }
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
  const routeKey = c => c.custom ? "uroute:v1:" + hashStr(JSON.stringify([routePts(c).map(s => [s.lon.toFixed(5), s.lat.toFixed(5)]), !!(c.opts && c.opts.noHighway)])) : "route:v4:" + c.id + (c.rv ? ":" + c.rv : ""); /* rv: bump when a built-in chapter's stops change */
  const osrmUrl = (c, extra = "") => { const { pts, wp } = routeCoords(c); return `https://router.project-osrm.org/route/v1/driving/${pts.map(s => `${s.lon.toFixed(5)},${s.lat.toFixed(5)}`).join(";")}?overview=full&geometries=geojson&continue_straight=false${wp.length < pts.length ? "&waypoints=" + wp.join(";") : ""}${c.opts && c.opts.noHighway ? "&exclude=motorway" : ""}${extra}`; };
  async function loadRoute(c) {
    const key = routeKey(c); const cached = c.nav ? null : LS.get(key, null);
    if (cached) return cached;
    try {
      const r = await fetch(osrmUrl(c));
      const j = await r.json(); if (j.code !== "Ok") throw new Error(j.code);
      const rt = j.routes[0]; const out = { coords: rt.geometry.coordinates.map(p => [+p[0].toFixed(5), +p[1].toFixed(5)]), km: rt.distance / 1000, min: rt.duration / 60, legs: rt.legs.map(l => l.distance / 1000), real: true };
      if (!c.nav) LS.set(key, out); return out;
    } catch (e) {
      const cs = routeCoords(c).pts.map(lonlat); const cum = L.cumulative(cs);
      return { coords: cs, km: cum[cum.length - 1] * 1.35, min: cum[cum.length - 1] * 1.35 / 55 * 60, legs: [], real: false };
    }
  }
  const sunAt = (t, lon, lat) => { const p = SunCalc.getPosition(t, lat, lon); return { az: (p.azimuth * 180 / Math.PI + 180) % 360, alt: p.altitude * 180 / Math.PI }; };
  /* where the weekend ride starts from, for the brief's sunrise row: the rider's position, else the saved home,
     else the start of the selected chapter (never a fixed town) */
  function briefOrigin() {
    if (st.me) return { lat: st.me.lat, lon: st.me.lon, label: "יציאה מהמיקום שלך" };
    const h = (LS.get("navPlaces", {}) || {}).home; if (h && isFinite(h.lat)) return { lat: h.lat, lon: h.lon, label: "יציאה מהבית" };
    const c = CHAPTERS.find(x => x.id === st.chap && !x.nav) || CHAPTERS[0], s0 = c.stops[0]; return { lat: s0.lat, lon: s0.lon, label: "יציאה מ" + s0.name.split(" · ")[0].split(",")[0] };
  }
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
    const cc = CHAPTERS.find(c => c.id === id), key = "elev:v4:" + (cc && cc.custom ? routeKey(cc) : id + (cc && cc.rv ? ":" + cc.rv : "")); const c = LS.get(key, null); if (c) { c.climb = climbOf(c.el); return (st.elev[id] = c); }
    const r = st.routes[id]; if (!r) return null;
    const { pts, km } = L.sample(r.coords, Math.min(300, Math.max(100, Math.round(r.km / 1.2))));
    try {
      const el = [];
      for (let i = 0; i < pts.length; i += 100) { const ch = pts.slice(i, i + 100); const j = await (await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${ch.map(p => p[1].toFixed(4)).join(",")}&longitude=${ch.map(p => p[0].toFixed(4)).join(",")}`)).json(); if (!Array.isArray(j.elevation)) throw new Error("elev"); el.push(...j.elevation); }
      const out = { pts, km, el }; out.climb = climbOf(out.el); LS.set(key, out); return (st.elev[id] = out);
    } catch (e) { return null; }
  }

  /* ---------- weather (Open-Meteo, live) ---------- */
  /* Weather: a shared server cache (/api/wx) first, Open-Meteo direct as a fallback, and the last good forecast kept
     if both fail. A reply is accepted only when every point carries an hourly series, so a quota or error answer
     (e.g. Open-Meteo 429) can never overwrite good data or break the tabs. */
  const wxOk = arr => Array.isArray(arr) && arr.length > 0 && arr.every(x => x && x.hourly && Array.isArray(x.hourly.time) && x.hourly.time.length > 24);
  const wxValid = w => !!(w && Array.isArray(w.pts) && w.pts.length && w.pts.every(p => p && p.h && Array.isArray(p.h.time)));
  if (!wxValid(st.wx)) { st.wx = null; try { localStorage.removeItem("brn:wx2"); } catch (e) { } }
  function wxPoints() {
    const pts = [];
    CHAPTERS.filter(c => !c.combo && !c.nav && (!c.custom || c.id === st.chap)).forEach(c => { const s = c.stops; [s[0], s[Math.floor(s.length / 2)], s[s.length - 1]].forEach(p => pts.push({ lat: p.lat, lon: p.lon, name: p.name.split(" · ")[0], chap: c.id })); });
    /* "now" uses the rider's position rounded to ~10 km: precise enough for current conditions, and riding
       around no longer invalidates the cache and refetches every point. */
    const r1 = v => Math.round(v * 10) / 10;
    pts.push({ lat: st.me ? r1(st.me.lat) : 32.651, lon: st.me ? r1(st.me.lon) : 35.105, name: st.me ? "המיקום שלך" : "יוקנעם", chap: "now" });
    return pts;
  }
  const wxSig = () => wxPoints().map(p => p.lat.toFixed(2) + p.lon.toFixed(2)).join("");
  const WX_Q = "&hourly=temperature_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,visibility,cloud_cover" +
    "&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_gusts_10m,precipitation&forecast_days=9&timezone=Asia%2FJerusalem&wind_speed_unit=kmh";
  async function wxFromServer(pts) {
    const r = await withTimeout(fetch("/api/wx?p=" + pts.map(p => p.lat.toFixed(2) + "," + p.lon.toFixed(2)).join(";")), 10000);
    const j = await r.json(); if (!r.ok || !j || !wxOk(j.data) || j.data.length !== pts.length) throw new Error((j && j.error) || "wx " + r.status);
    return j.data;
  }
  async function wxDirect(pts) {
    const url = "https://api.open-meteo.com/v1/forecast?latitude=" + pts.map(p => p.lat.toFixed(2)).join(",") + "&longitude=" + pts.map(p => p.lon.toFixed(2)).join(",") + WX_Q;
    const r = await withTimeout(fetch(url), 10000); const j = await r.json(); const arr = Array.isArray(j) ? j : [j];
    if (!r.ok || !wxOk(arr) || arr.length !== pts.length) throw new Error((j && j.reason) || "open-meteo " + r.status);
    return arr;
  }
  let wxBusy = null;
  function loadWeather(force) {
    if (!force && st.wx && Date.now() - st.wx.ts < 30 * 6e4 && st.wx.sat === st.sat.iso && st.wx.sig === wxSig()) { renderNow(); return Promise.resolve(); }
    if (wxBusy) return wxBusy;
    if (!force && st.wxFailTs && Date.now() - st.wxFailTs < 3 * 6e4) return Promise.resolve(); /* back off after a failed round */
    return wxBusy = (async () => {
      const pts = wxPoints(), sig = wxSig(); let arr = null;
      try { arr = await wxFromServer(pts); } catch (e) { try { arr = await wxDirect(pts); } catch (e2) { if (window.BRG) BRG.report("weather", String((e2 && e2.message) || e2) + " / " + String((e && e.message) || e)); } }
      st.wxFail = !arr; st.wxFailTs = arr ? 0 : Date.now();
      if (arr) { st.wx = { ts: Date.now(), sat: st.sat.iso, sig, pts: arr.map(x => ({ h: x.hourly, cur: x.current })) }; LS.set("wx2", st.wx); }
      else if (st.wx && st.wx.sig !== sig) { /* the cached forecast is for other points: keep it only if it still lines up */ if (st.wx.pts.length !== pts.length) st.wx = null; }
      if (!st.wx && force) toast("התחזית לא זמינה כרגע. ננסה שוב בעוד כמה דקות.");
      const s = f => { try { f(); } catch (e) { if (window.BRG) BRG.report("weather-render", String(e && e.stack || e)); } };
      s(renderNow); s(renderMarkers); if (st.tab === "brief") s(renderBrief);
    })().finally(() => { wxBusy = null; });
  }
  function satHour(i, hour) {
    const p = st.wx && st.wx.pts[i]; if (!p || !p.h || !Array.isArray(p.h.time)) return null; const iso = `${st.sat.iso}T${String(hour).padStart(2, "0")}:00`; const k = p.h.time.indexOf(iso); if (k < 0) return null;
    return { t: p.h.temperature_2m[k], code: p.h.weather_code[k], p: p.h.precipitation_probability[k], g: p.h.wind_gusts_10m[k], vis: p.h.visibility ? p.h.visibility[k] : null };
  }
  function wxMid(cid) { const cc = CHAPTERS.find(c => c.id === cid); const id = cc && cc.combo ? cc.combo[Math.floor(cc.combo.length / 2)] : cid; return wxPoints().findIndex(x => x.chap === id) + 1; }
  function chapterWx(cid) {
    if (!st.wx) return null; const pts = wxPoints(); const rows = []; const cc = CHAPTERS.find(c => c.id === cid); const ids = cc && cc.combo ? cc.combo : [cid];
    pts.forEach((p, i) => { if (!ids.includes(p.chap) || !st.wx.pts[i] || !st.wx.pts[i].h || !Array.isArray(st.wx.pts[i].h.time)) return; const w = L.windowStats(st.wx.pts[i].h, `${st.sat.iso}T06:00`, `${st.sat.iso}T12:00`, `${st.sat.prevIso}T20:00`); if (w) rows.push({ p, w, i }); });
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
    return { ts: Date.now(), cams: els.filter(n => t(n).highway === "speed_camera").map(pick), fuel: els.filter(n => t(n).amenity === "fuel").map(pick), views: els.filter(n => t(n).tourism === "viewpoint").map(pick), cafes: els.filter(n => t(n).amenity === "cafe" || t(n).shop === "coffee").map(pick) };
  }
  async function fromServer() { const r = await withTimeout(fetch("/api/osm?v=4"), 9000); if (!r.ok) throw new Error(r.status); const j = await r.json(); if (!j.fuel) throw new Error("bad"); return j; }
  async function fromOverpass() {
    const q = "[out:json][timeout:40];(" + Object.values(REGIONS).map(B => { const bb = `${B[0][1]},${B[0][0]},${B[1][1]},${B[1][0]}`; return `node["highway"="speed_camera"](${bb});nwr["amenity"="fuel"](${bb});node["tourism"="viewpoint"](${bb});nwr["amenity"="cafe"](${bb});nwr["shop"="coffee"](${bb});`; }).join("") + ");out center tags;";
    const ctl = new AbortController();
    try { return await withTimeout(Promise.any(["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter", "https://overpass.private.coffee/api/interpreter"].map(async ep => { const r = await fetch(ep + "?data=" + encodeURIComponent(q), { signal: ctl.signal }); if (!r.ok) throw new Error(r.status); const j = await r.json(); if (!j.elements || !j.elements.length) throw new Error("empty"); return normOverpass(j); })), 25000); }
    finally { ctl.abort(); }
  }
  let osmBusy = false, cafeRetry = 0;
  async function loadOSM(force, quiet) {
    const age = st.osm ? Date.now() - st.osm.ts : 1e12;
    if (!force && age < 20 * 3600e3 && st.osm.cafes && st.osm.cafes.length) { pushSources(); return; }
    if (osmBusy) return; osmBusy = true;
    try {
      let d = null; try { d = await fromServer(); } catch (e) { }
      if ((!d && (!st.osm || force)) || (d && !d.cafes && quiet)) { try { d = await fromOverpass(); } catch (e) { } }
      if (d) {
        d.fuel.forEach(f => { f.name = f.name || ""; f.brand = f.brand || ""; f.oh = f.oh || ""; if (f.o95 === undefined) f.o95 = null; if (f.o98 === undefined) f.o98 = null; if (f.diesel === undefined) f.diesel = null; });
        d.views.forEach(v => v.name = v.name || ""); if (!d.cafes) { d.cafes = (st.osm && st.osm.cafes) || []; if (!d.cafes.length && cafeRetry++ < 2) setTimeout(() => loadOSM(true, true), 4000); }
        st.osm = d; nearCache.clear(); LS.set("osm4", st.osm); pushSources(); renderAll();
        if (force && !quiet) toast(`עודכן: ${st.osm.fuel.length} תחנות דלק, ${st.osm.views.length} מצפורים, ${st.osm.cams.length} מצלמות`);
      } else if (force || !st.osm) { toast("המידע על תחנות ומצפורים לא נטען כרגע. ננסה שוב בעוד רגע."); if (!st.osm) setTimeout(() => loadOSM(), 20000); }
    } finally { osmBusy = false; }
  }
  /* Cached per route+radius: the distance scan is the heaviest thing the stops tab does. */
  const nearCache = new Map();
  function nearRoute(list, cid, maxKm, tag) {
    const r = st.routes[cid]; if (!r || !list || !list.length) return [];
    const key = `${cid}|${maxKm}|${tag || (list === (st.osm && st.osm.fuel) ? "f" : list === (st.osm && st.osm.views) ? "v" : list === (st.osm && st.osm.cams) ? "c" : "x")}|${list.length}|${st.osm ? st.osm.ts : 0}|${r.coords.length}|${r.km.toFixed(2)}`;
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
  /* Error boundary for every tab: if a render throws (bad cached data, a flaky API answer), the tab shows a short
     note with a retry instead of going blank, and the error is reported from the field. */
  function paneSafe(name, f) {
    const fail = e => {
      if (window.BRG) BRG.report("tab-" + name, String(e && e.message || e), "", 0, String(e && e.stack || ""));
      const el = $("p-" + name); if (!el) return;
      el.innerHTML = `<div class="card" style="text-align:center;padding:22px 16px"><div style="font-weight:800;margin-bottom:6px">משהו לא נטען כמו שצריך</div><div class="muted" style="margin-bottom:12px">ייתכן שאחד מהשירותים החיצוניים לא זמין כרגע. הנתונים שלכם שמורים.</div><button type="button" class="btn primary" id="paneRetry-${name}">טעינה מחדש של הלשונית</button></div>`;
      const b = $("paneRetry-" + name); if (b) b.onclick = () => { if (name === "brief" || name === "route") loadWeather(true); paneSafe(name, f); };
    };
    try { const r = f(); if (r && typeof r.catch === "function") r.catch(fail); return r; } catch (e) { fail(e); }
  }
  function renderBrief() { return paneSafe("brief", renderBrief_); }
  function renderBrief_() {
    const p = $("p-brief"); const satDate = st.sat.noonUTC, org = briefOrigin(); const t = SunCalc.getTimes(satDate, org.lat, org.lon);
    const golden = new Date(t.sunrise.getTime() + 60 * 6e4), leave = new Date(t.sunrise.getTime() + 15 * 6e4);
    let h = `<div class="brief-head"><div><div class="small muted">${st.sat.isToday ? "היום" : st.sat.daysAway === 1 ? "מחר" : `בעוד ${st.sat.daysAway} ימים`}</div><h2>${esc(fmtD(satDate))}</h2></div><button type="button" class="btn sm" id="wxRefresh">רענון</button></div>
      <div class="sunrow"><div><div class="k">זריחה</div><div class="v sun mono">${fmtT(t.sunrise)}</div></div><div><div class="k">${esc(org.label)}</div><div class="v mono">${fmtT(leave)}</div></div><div><div class="k">אור זהב עד</div><div class="v mono">${fmtT(golden)}</div></div></div>`;
    if (!st.wx) { h += st.wxFail ? `<div class="alert info">התחזית לשבת לא זמינה כרגע (שירות מזג האוויר עמוס). המסלולים, העצירות והניווט עובדים כרגיל, והתחזית תתעדכן לבד. אפשר גם ללחוץ ״רענון״.</div>` : `<p class="muted">טוען תחזית לשבת…</p>`; h += shareSatBtn(); p.innerHTML = h; bindBrief(); return; }
    const res = CHAPTERS.filter(c => !c.hidden && (!c.custom || c.id === st.chap)).map(c => ({ c, w: chapterWx(c.id) })).filter(x => x.w);
    const best = res.filter(x => !x.c.combo).sort((a, b) => b.w.ri.i - a.w.ri.i)[0];
    if (st.sat.daysAway > 5) h += `<div class="alert info">התחזית ל־${st.sat.daysAway} ימים עדיין רחוקה. התדריך מתעדכן אוטומטית ככל שהשבת מתקרבת.</div>`;
    h += `<div class="ccards">` + res.map(({ c, w }) => {
      const cs = st.cstats[c.id]; const isBest = best && best.c.id === c.id;
      return `<button type="button" class="ccard ${isBest ? "best" : ""}" data-chap="${c.id}">${gauge(w.ri.i, w.ri.verdict.k)}<div><div class="row" style="gap:6px"><h3>${esc(c.title)}</h3>${isBest ? '<span class="best-tag">הפרק של השבת</span>' : ""}${c.featured ? '<span class="best-tag feat">מומלץ השבוע</span>' : ""}</div>${c.alertMsg ? `<div class="calert">${esc(c.alertMsg)}</div>` : ""}<div class="verdict v-${w.ri.verdict.k}">${esc(w.ri.verdict.t)}</div><div class="why">${w.ri.why.length ? esc(w.ri.why.slice(0, 3).join(" · ")) : "בלי גשם, ערפל או רוח חריגה"}${cs ? ` · ${Math.round(cs.twisty)} ק״מ מפותלים` : ""}</div>${diffMini(c.id)}</div><div style="text-align:center">${wxIcon(w.code).replace("<svg", '<svg width="30" height="30"')}<div class="mono small" dir="ltr">${Math.round(w.agg.tMin)}°–${Math.round(w.agg.tMax)}°</div></div></button>`;
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
    h += shareSatBtn();
    h += `<div class="fresh">תחזית: Open-Meteo, עודכנה ${ago(st.wx.ts)} · מתעדכנת בכל פתיחה ובכל 30 דקות${st.osm ? ` · OSM: ${ago(st.osm.ts)}` : ""}</div>`;
    p.innerHTML = h; bindBrief();
  }
  function bindBrief() {
    const r = $("wxRefresh"); if (r) r.onclick = () => { loadWeather(true); toast("מרענן תחזית"); };
    const sh = $("shareSat"); if (sh) sh.onclick = async () => { sh.disabled = true; try { await shareSaturday(); } catch (e) { toast("לא הצלחנו להכין את הכרטיס"); } sh.disabled = false; };
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
  function renderRoute() { return paneSafe("route", renderRoute_); }
  function renderRoute_() {
    const c = chap(), r = st.routes[c.id], cs = st.cstats[c.id], e = st.elev[c.id];
    let h = `<div class="chapsel">${CHAPTERS.filter(x => x.id !== DRAFT && !x.hidden).map(x => `<button type="button" data-c="${x.id}" aria-pressed="${x.id === st.chap && !st.build}"><span>${x.custom ? (x.shared ? "⇄ " : "★ ") + esc(x.short) : `פרק ${CHAPTERS.indexOf(x) + 1} · ${esc(x.short)}`}</span>${leds(diffOf(x.id), true)}</button>`).join("")}${st.flags.builder ? `<button type="button" class="newroute" id="bNew" aria-pressed="${!!st.build}">＋ מסלול משלי</button><button type="button" class="newroute" id="bImp">⤓ מסלול מקישור</button>` : ""}</div>`;
    if (st.build) h += builderPanel();
    if (st.build && st.chap !== DRAFT) { $("p-route").innerHTML = h; if ($("bNew")) $("bNew").onclick = () => startBuild(); if ($("bImp")) $("bImp").onclick = importLink; bindBuilder(); return; }
    else h += `<div><div class="row" style="justify-content:space-between;align-items:flex-start"><h2>${esc(c.title)}${c.shared ? `<span class="chipshare" title="התקבל בקישור">משיתוף</span>` : ""}</h2>${c.custom ? `<div class="row"><button type="button" class="btn sm" id="bEdit">עריכה</button><button type="button" class="btn sm" id="bShareR">שיתוף</button></div>` : ""}</div><p class="muted" style="margin:4px 0 0">${c.shared ? `מסלול שקיבלתם בקישור${c.shared.t ? ` ב־${new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "numeric" }).format(c.shared.t)}` : ""}. הוא נשמר אצלכם, ואפשר לערוך או לצאת איתו.` : esc(c.sub)}</p></div>${c.alertMsg ? `<div class="alert">${esc(c.alertMsg)}</div>` : ""}`;
    h += `
      <div class="stats"><div class="stat"><div class="k">מרחק</div><div class="v">${r ? Math.round(r.km) : "--"}<span class="small"> ק״מ</span></div></div><div class="stat"><div class="k">זמן נטו</div><div class="v">${r ? `${Math.floor(r.min / 60)}:${String(Math.round(r.min % 60)).padStart(2, "0")}` : "--"}</div></div><div class="stat"><div class="k">מפותל</div><div class="v">${cs ? Math.round(cs.twisty) : "--"}<span class="small"> ק״מ</span></div></div><div class="stat"><div class="k">טיפוס</div><div class="v">${e && e.climb != null ? e.climb : "--"}<span class="small"> מ׳</span></div></div></div>`;
    h += terrCard(c.id) + diffCard(c.id) + trafficCard(c.id);
    if (cs) h += `<div><div class="curvebar">${cs.km.map((k, i) => `<span style="width:${(k / cs.total * 100).toFixed(1)}%;background:var(--c${i})"></span>`).join("")}</div><div class="legend" style="margin-top:6px">${L.CURVE_LABEL.map((l, i) => `<span><i style="background:var(--c${i})"></i>${l} ${Math.round(cs.km[i])}</span>`).join("")}</div></div>`;
    h += `<div id="profWrap">${profileSvg(e)}</div>`;
    h += insightsCard(c.id);
    h += fuelPlanCard();
    if (r && !r.real) h += `<div class="alert">המסלול משוער (שרת הניתוב לא היה זמין). הקישור לגוגל מנווט על הכבישים האמיתיים.</div>`;
    h += `<div class="row"><a class="btn primary" target="_blank" rel="noopener" href="${gmRoute(c.stops)}">${IC.nav}ניווט הפרק בגוגל</a><a class="btn" target="_blank" rel="noopener" href="${wazeLL(c.stops[0].lat, c.stops[0].lon)}">Waze לנקודת הפתיחה</a>${st.flags.fly ? '<button type="button" class="btn" id="bFly">מעוף על הפרק</button>' : ""}<button type="button" class="btn" id="bGpx">GPX</button></div>`;
    h += `<ol class="stops">` + c.stops.map((s, i) => { const nav = stopNav(s); const cafe = s.cafe && CAFES.find(x => x.id === s.cafe); return `<li class="stop"><span class="num ${s.kind === "view" ? "view" : s.kind === "cafe" ? "cafe" : ""}">${i + 1}</span><div><h3><button type="button" data-s="${s.id}">${esc(s.name)}</button></h3><p>${esc(s.note)}</p><div class="chips" style="margin-bottom:6px">${(s.roads || []).map(x => `<span class="chip road">${x}</span>`).join("")}${r && r.stopKm ? `<span class="chip road">ק״מ ${Math.round(r.stopKm[i])}</span>` : ""}${cafe && cafe.shabbat ? '<span class="chip sun">פתוח בשבת</span>' : ""}${s.score ? `<span class="score">עיקולים <b>${stars(s.score[0])}</b> נוף <b>${stars(s.score[1])}</b></span>` : ""}</div><div class="row">${navBtn("w", nav.w)}${navBtn("g", nav.g)}</div></div></li>`; }).join("") + `</ol>`;
    $("p-route").innerHTML = h;
    $("p-route").querySelectorAll("[data-c]").forEach(b => b.onclick = () => { st.build = null; setPick(false); setChap(b.dataset.c); });
    if ($("bNew")) $("bNew").onclick = () => startBuild(); if ($("bImp")) $("bImp").onclick = importLink; if ($("bEdit")) $("bEdit").onclick = () => startBuild(c); if ($("bShareR")) $("bShareR").onclick = () => shareRoute(c);
    if (st.build) bindBuilder(); bindTraffic(c.id);
    $("p-route").querySelectorAll("[data-s]").forEach(b => b.onclick = () => { const s = c.stops.find(x => x.id === b.dataset.s); map.flyTo({ center: lonlat(s), zoom: 13, padding: sheetPad(), duration: 1100 }); stopPopup(s, c.stops.indexOf(s) + 1); if (innerWidth < 900) setSheet("peek"); });
    if ($("bFly")) $("bFly").onclick = () => startFly(); $("bGpx").onclick = gpx; bindFuelPlan(); bindInsights(c.id);
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

  /* ---------- places along the chosen route: cafes, fuel, viewpoints ---------- */
  let cafesMemo = null;
  function allCafes() {
    const o = st.osm, ts = o ? o.ts : 0, n = o && o.cafes ? o.cafes.length : 0;
    if (cafesMemo && cafesMemo.ts === ts && cafesMemo.n === n) return cafesMemo.list;
    const cur = CAFES.map(c => Object.assign({ curated: true }, c));
    const osm = (o && o.cafes || []).filter(x => x.name && !cur.some(c => L.hav([c.lon, c.lat], [x.lon, x.lat]) < 0.15));
    cafesMemo = { ts, n, list: cur.concat(osm) }; return cafesMemo.list;
  }
  function cafeStatus(c) {
    if (c.curated) return c.shabbat === true ? { sat: "open", hours: null } : { sat: "unknown" };
    const oh = L.saturdayHours(c.oh); return { sat: oh.k === "open" ? "open" : oh.k === "closed" ? "closed" : "unknown", hours: oh.t || null, inferred: oh.inferred };
  }
  const cafePill = f => f.sat === "open" ? `<span class="chip" style="border-color:var(--go);color:var(--go)">שבת: ${esc(f.hours || "פתוח")}</span>` : f.sat === "closed" ? `<span class="chip" style="border-color:var(--no);color:var(--no)">סגור בשבת${f.inferred ? "?" : ""}</span>` : `<span class="chip">שבת: לבדוק</span>`;
  function placesAlong(cid) {
    const cafes = nearRoute(allCafes(), cid, 2.5, "cafe").map(c => Object.assign({ t: "cafe" }, c, cafeStatus(c)));
    const fuel = fuelAlong(cid, 1.5).map(f => Object.assign({ t: "fuel" }, f));
    const views = nearRoute(st.osm && st.osm.views, cid, 1.5, "view").filter(v => v.name).map(v => Object.assign({ t: "view" }, v));
    return { cafes, fuel, views };
  }
  const PCAT = { all: "הכול", cafe: "קפה", fuel: "דלק", view: "מצפורים" };
  const PIC = { cafe: ["#8F5A35", "cup"], fuel: ["var(--fuel)", "fuel"], view: ["var(--view)", "view"] };
  const glyphSvg = (t) => `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">${GLYPH[PIC[t][1]].map(d => `<path d="${d}"/>`).join("")}</svg>`;
  /* A strip of the whole route with every place at its kilometre: reading the ride at a glance. */
  function placeStrip(items, total) {
    const W = 360, X = km => 10 + (Math.max(0, Math.min(total, km)) / total) * (W - 20);
    const lanes = { cafe: 12, fuel: 26, view: 40 };
    return `<svg class="pstrip" direction="ltr" viewBox="0 0 ${W} 64" role="img" aria-label="המקומות לאורך המסלול, לפי קילומטר">
      ${Object.entries(lanes).map(([t, y]) => `<line x1="10" x2="${W - 10}" y1="${y}" y2="${y}" stroke="var(--line)" stroke-width="1"/>`).join("")}
      ${items.map(p => `<circle cx="${X(p.km).toFixed(1)}" cy="${lanes[p.t]}" r="${p.curated || (p.t === "fuel" && p.ok) ? 4.6 : 3.4}" fill="${PIC[p.t][0]}" stroke="var(--bg)" stroke-width="1.2"${p.t !== "view" && p.sat === "closed" ? ' opacity=".35"' : ""}/>`).join("")}
      <text x="10" y="60" font-size="10" fill="var(--muted)">0</text><text x="${W / 2}" y="60" font-size="10" fill="var(--muted)" text-anchor="middle">${Math.round(total / 2)}</text><text x="${W - 10}" y="60" font-size="10" fill="var(--muted)" text-anchor="end">${Math.round(total)} ק״מ</text></svg>`;
  }
  const meTxt = p => p.dme != null ? ` · ${p.dme < 1 ? Math.round(p.dme * 1000) + " מ׳" : p.dme.toFixed(1) + " ק״מ"} ממך` : "";
  function placeRow(p) {
    const off = p.d > 0.15 ? `${p.d < 1 ? Math.round(p.d * 1000) + " מ׳" : p.d.toFixed(1) + " ק״מ"} מהכביש` : "על הדרך";
    const ic = `<span class="pic" style="background:${PIC[p.t][0]}">${glyphSvg(p.t)}</span>`;
    if (p.t === "fuel") return `<div class="item place"><div class="row" style="flex-wrap:nowrap;gap:10px;min-width:0">${ic}<div style="min-width:0"><b>${esc(p.label)}</b><span class="small muted mono">ק״מ ${Math.round(p.km)} · ${off}${meTxt(p)}</span><div class="chips" style="margin-top:3px">${satPill(p)}${octChips(p)}</div></div></div><div class="row" style="flex-wrap:nowrap">${navBtn("w", wazeLL(p.lat, p.lon))}<button type="button" class="btn sm" data-fx="${p.id}">פרטים</button></div></div>`;
    if (p.t === "cafe") return `<div class="item place"><div class="row" style="flex-wrap:nowrap;gap:10px;min-width:0">${ic}<div style="min-width:0"><b>${esc(p.name)}</b>${p.curated ? ' <span class="chip sun">מומלץ</span>' : ""}<span class="small muted mono">ק״מ ${Math.round(p.km)} · ${off}${meTxt(p)}${p.place ? " · " + esc(p.place) : ""}</span><div class="chips" style="margin-top:3px">${cafePill(p)}</div></div></div><div class="row" style="flex-wrap:nowrap">${navBtn("w", p.curated ? wazeQ(p.name + " " + p.place) : wazeLL(p.lat, p.lon))}<button type="button" class="btn sm" data-cf="${p.id}">במפה</button></div></div>`;
    return `<div class="item place"><div class="row" style="flex-wrap:nowrap;gap:10px;min-width:0">${ic}<div style="min-width:0"><b>${esc(p.name)}</b><span class="small muted mono">ק״מ ${Math.round(p.km)} · ${off}${meTxt(p)}</span></div></div><div class="row" style="flex-wrap:nowrap">${navBtn("w", wazeLL(p.lat, p.lon))}<button type="button" class="btn sm" data-vw="${p.lat},${p.lon}">במפה</button></div></div>`;
  }
  function renderStops() { return paneSafe("stops", renderStops_); }
  function renderStops_() {
    const c = chap(), r = st.routes[c.id], cat = st.stopsCat;
    let h = `<div class="row" style="justify-content:space-between;align-items:flex-start"><div style="min-width:0"><h2>לאורך ${esc(c.title)}</h2><span class="small muted">${r ? Math.round(r.km) + " ק״מ · " : ""}קפה עד 2.5 ק״מ מהכביש, דלק ומצפורים עד 1.5 ק״מ</span></div><label class="toggle"><input type="checkbox" id="shab" ${st.shabbat ? "checked" : ""}> מצב שבת</label></div>`;
    if (!r) { $("p-stops").innerHTML = h + `<p class="small muted">מחשב את המסלול…</p>`; return; }
    if (!st.osm) { $("p-stops").innerHTML = h + `<p class="small muted">טוען מקומות מ־OpenStreetMap…</p>`; return; }
    const P = placesAlong(c.id);
    const keep = p => !st.shabbat || p.t === "view" || p.sat !== "closed";
    const ff = st.fuelFilter;
    const fuelOkF = f => (!ff.oct || f.o98 !== false);
    const sets = { cafe: P.cafes.filter(keep), fuel: P.fuel.filter(keep).filter(fuelOkF), view: P.views };
    const all = sets.cafe.concat(sets.fuel, sets.view).sort((a, b) => a.km - b.km);
    let shown = cat === "all" ? all : sets[cat];
    if (st.stopsNear && st.me) { const me = [st.me.lon, st.me.lat]; shown = shown.map(x => Object.assign({}, x, { dme: L.hav(me, [x.lon, x.lat]) })).sort((a, b) => a.dme - b.dme); }
    h += `<div class="seg pcat" role="tablist" aria-label="סוג מקום">${Object.entries(PCAT).map(([k, t]) => `<button type="button" role="tab" data-pc="${k}" aria-selected="${k === cat}">${t} <span class="mono">${k === "all" ? all.length : sets[k].length}</span></button>`).join("")}</div>`;
    h += `<div class="row" style="justify-content:space-between;margin:0">${placeStrip(all, r.km)}</div><div class="row small" style="margin:0;justify-content:space-between"><span class="muted">${st.stopsNear && st.me ? "ממוין לפי המרחק ממך" : "ממוין לפי הקילומטר בפרק"}</span><button type="button" class="btn sm" id="pNear" aria-pressed="${!!st.stopsNear}">${IC.nav}${st.stopsNear ? "לפי הפרק" : "קרוב אליי"}</button></div>`;
    if (cat === "fuel") h += `<div class="row small" style="margin:0"><label class="toggle"><input type="checkbox" id="ffOct" ${ff.oct ? "checked" : ""}> רק תחנות עם 98</label><span class="muted">אימות רוכבים: לוחצים ״פרטים״</span></div>`;
    if (st.shabbat) h += `<p class="small muted" style="margin:0">מצב שבת מסתיר מקומות שמסומנים סגורים בשבת. ״לבדוק״ = אין מידע, כדאי להתקשר.</p>`;
    const lim = st.stopsMore ? 400 : 30;
    h += shown.length ? `<div class="places">${shown.slice(0, lim).map(placeRow).join("")}</div>` + (shown.length > lim ? `<button type="button" class="btn sm" id="pMore">עוד ${shown.length - lim}</button>` : "") : `<p class="small muted">${cat === "cafe" ? "אין בתי קפה ידועים ליד הפרק. אפשר להציע מקום דרך ״משוב לצוות״ בלשונית כלים." : "לא נמצאו מקומות ליד הפרק."}</p>`;
    h += `<p class="small muted" style="margin:6px 0 0">בתי קפה ושעות מ־OpenStreetMap ומהמלצות של הצוות. שעות בשבת משתנות; בודקים בבוקר.</p>`;
    $("p-stops").innerHTML = h; lazyThumbs($("p-stops"));
    $("shab").onchange = e => { st.shabbat = e.target.checked; LS.set("shabbat", st.shabbat); renderStops(); pushSources(); };
    $("p-stops").querySelectorAll("[data-pc]").forEach(b => b.onclick = () => { st.stopsCat = b.dataset.pc; st.stopsMore = false; LS.set("stopsCat", st.stopsCat); renderStops(); });
    if ($("ffOct")) $("ffOct").onchange = e => { st.fuelFilter.oct = e.target.checked; LS.set("fuelFilter", st.fuelFilter); renderStops(); };
    if ($("pMore")) $("pMore").onclick = () => { st.stopsMore = true; renderStops(); };
    const fly = (lon, lat) => { map.flyTo({ center: [lon, lat], zoom: 14, padding: sheetPad() }); if (innerWidth < 900) setSheet("peek"); };
    $("p-stops").querySelectorAll("[data-cf]").forEach(b => b.onclick = () => { const x = allCafes().find(k => k.id === b.dataset.cf); if (x) { fly(x.lon, x.lat); cafePopup(x); } });
    $("p-stops").querySelectorAll("[data-ll]").forEach(b => b.onclick = () => fly(...b.dataset.ll.split(",").map(Number)));
    $("p-stops").querySelectorAll("[data-vw]").forEach(b => b.onclick = () => { const [la, lo] = b.dataset.vw.split(",").map(Number); const v = P.views.find(x => x.lat === la && x.lon === lo) || { lat: la, lon: lo, name: "מצפור" }; fly(lo, la); viewPopup(v); });
    $("pNear").onclick = async () => { if (st.stopsNear) { st.stopsNear = false; return renderStops(); } const b = $("pNear"); b.disabled = true; try { await getPos(); st.stopsNear = true; renderMarkers(); } catch (e) { toast("אין גישה למיקום"); } renderStops(); };
    $("p-stops").querySelectorAll("[data-fx]").forEach(x => x.onclick = () => { const n = st.osm.fuel.find(k => k.id === x.dataset.fx); if (!n) return; fly(n.lon, n.lat); openFuelPopup(n); });
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
  function fuelAlong(cid_, maxKm = 0.8) {
    const list = nearRoute(st.osm && st.osm.fuel, cid_, maxKm, "fuel");
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
  function voteBtn(id, f, v, label) { if (!st.flags.fuelVotes) return ""; const on = mineVal(id, f) === asVal(f, v); return `<button type="button" class="btn sm vote" aria-pressed="${on}" data-fr="${id}|${f}|${v}">${on ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5 9-10"/></svg>' : ""}${label}</button>`; }
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
  /* ---------- fuel planner: your bike, your tank, litre by litre along the route ---------- */
  const STYLES = { calm: [0.95, "רגוע"], normal: [1.08, "רגיל"], brisk: [1.22, "נמרץ"], sport: [1.4, "ספורטיבי"] };
  const BIKES = (window.BRB && window.BRB.list) || [];
  const bikeModel = () => BIKES.find(x => x.id === st.bike.id) || null;
  function bikeEff() {
    const b = st.bike, m = bikeModel();
    return { tank: +b.tank || 15, cons: +(b.measured || b.cons) || 5, style: b.measured ? 1 : (STYLES[b.style] || STYLES.normal)[0], name: m ? `${m.brand} ${m.model}` : "אופנוע מותאם אישית", measured: !!b.measured };
  }
  const simCache = new Map();
  function fuelSimFor(cid) {
    const r = st.routes[cid]; if (!r) return null; const be = bikeEff();
    const stations = st.osm ? fuelAlong(cid, 0.8) : [];
    const key = [cid, r.km.toFixed(2), JSON.stringify(be), st.bike.start, st.bike.fuel, st.osm ? st.osm.ts : 0, st.crowdTs || 0, !!st.elev[cid], (st.curves[cid] || []).length].join("|");
    if (simCache.has(key)) return simCache.get(key);
    const sim = L.fuelSim({ totalKm: r.km, segs: st.curves[cid] || [], elev: st.elev[cid], tank: be.tank, cons: be.cons, style: be.style, startPct: st.bike.start / 100, stations });
    sim.stations = stations; sim.tank = be.tank; sim.total = r.km; sim.be = be;
    if (simCache.size > 20) simCache.clear(); simCache.set(key, sim);
    st.bike.range = Math.round(sim.rangeFull); return sim;
  }
  const fuelColor = (l, tank) => `hsl(${L.fuelHue(l / tank)} 72% 46%)`;
  /* The gauge: the whole route as a bar coloured by what's in the tank at each kilometre. */
  function fuelGauge(sim, meKm) {
    const W = 360, x0 = 10, x1 = W - 10, T = sim.total, X = km => x0 + (Math.max(0, Math.min(T, km)) / T) * (x1 - x0);
    const N = 90; let bars = "";
    for (let i = 0; i < N; i++) { const a = T * i / N, b = T * (i + 1) / N, l = sim.levelAt((a + b) / 2); bars += `<rect x="${X(a).toFixed(1)}" y="30" width="${(X(b) - X(a) + 0.6).toFixed(1)}" height="14" fill="${fuelColor(l, sim.tank)}"/>`; }
    const ticks = sim.stations.map(s => `<path d="M${X(s.km).toFixed(1)} 26l-3.2 -5h6.4z" fill="${s.ok ? "var(--go)" : "var(--muted)"}" opacity="${s.ok ? 1 : 0.55}"/>`).join("");
    const ref = sim.refuels.map((s, i) => `<g><line x1="${X(s.km).toFixed(1)}" x2="${X(s.km).toFixed(1)}" y1="18" y2="48" stroke="var(--ink)" stroke-width="1.6"/><circle cx="${X(s.km).toFixed(1)}" cy="13" r="7" fill="var(--fuel)" stroke="var(--bg)" stroke-width="1.5"/><text x="${X(s.km).toFixed(1)}" y="16.5" font-size="9.5" font-weight="700" fill="#fff" text-anchor="middle">${i + 1}</text></g>`).join("");
    const low = sim.lowAtKm != null ? `<g><line x1="${X(sim.lowAtKm).toFixed(1)}" x2="${X(sim.lowAtKm).toFixed(1)}" y1="28" y2="50" stroke="var(--no)" stroke-width="2" stroke-dasharray="2 2"/><text x="${X(sim.lowAtKm).toFixed(1)}" y="60" font-size="10" fill="var(--no)" text-anchor="middle">${sim.emptyAtKm != null ? "נגמר" : "נורית"} · ק״מ ${Math.round(sim.lowAtKm)}</text></g>` : "";
    const me = meKm != null ? `<g><path d="M${X(meKm).toFixed(1)} 47l-5 8h10z" fill="var(--accent)" stroke="var(--bg)" stroke-width="1.2"/></g>` : "";
    return `<svg class="fgauge" direction="ltr" viewBox="0 0 ${W} 66" role="img" aria-label="מצב המיכל לאורך המסלול">${bars}<rect x="${x0}" y="30" width="${x1 - x0}" height="14" fill="none" stroke="var(--line)" rx="2"/>${ticks}${ref}${low}${me}
      ${sim.lowAtKm == null ? `<text x="${x0}" y="60" font-size="10" fill="var(--muted)">0</text><text x="${x1}" y="60" font-size="10" fill="var(--muted)" text-anchor="end">${Math.round(T)} ק״מ</text>` : ""}</svg>`;
  }
  function bikeOptions() {
    const cur = st.bike.id;
    return `<option value="">בחירת אופנוע…</option>` + (window.BRB ? window.BRB.brands.map(br => `<optgroup label="${esc(br)}">${BIKES.filter(x => x.brand === br).map(x => `<option value="${x.id}" ${x.id === cur ? "selected" : ""}>${esc(x.model)} · ${x.tank} ל׳</option>`).join("")}</optgroup>`).join("") : "") + `<option value="custom" ${cur === "custom" ? "selected" : ""}>אחר: הזנה ידנית</option>`;
  }
  function fuelPlanCard() {
    const r = st.routes[st.chap], b = st.bike, be = bikeEff(), pro = isPro();
    const styleSeg = `<div class="seg fstyle" role="radiogroup" aria-label="סגנון רכיבה">${Object.entries(STYLES).map(([k, [, t]]) => `<button type="button" role="radio" data-st="${k}" aria-checked="${b.style === k && !b.measured}">${t}</button>`).join("")}</div>`;
    const calib = `<details class="small"><summary class="muted">התאמה ידנית וכיול מתדלוק אמיתי</summary><div class="row" style="margin-top:6px;gap:8px"><label>מיכל <input id="bkTank" class="btn sm mono" type="number" inputmode="decimal" min="5" max="40" step="0.1" value="${b.tank}" style="width:70px"> ל׳</label><label>צריכה <input id="bkCons" class="btn sm mono" type="number" inputmode="decimal" min="1.5" max="12" step="0.1" value="${b.cons}" style="width:70px"> ל׳/100</label></div>
        <div class="row" style="margin-top:6px;gap:8px"><span class="muted">בתדלוק האחרון:</span><label><input id="calKm" class="btn sm mono" type="number" inputmode="decimal" min="10" max="900" placeholder="ק״מ" style="width:70px"> ק״מ</label><label><input id="calL" class="btn sm mono" type="number" inputmode="decimal" min="1" max="40" step="0.1" placeholder="ליטר" style="width:70px"> ליטר</label><button type="button" class="btn sm" id="calGo">כיול</button>${b.measured ? `<button type="button" class="btn sm" id="calClr">ביטול כיול (${b.measured} ל׳/100)</button>` : ""}</div>
        <p class="muted" style="margin:6px 0 0">הצריכה היא נתון היצרן. סגנון הרכיבה מוסיף עליה, והמסלול מוסיף לפי עיקולים וטיפוס. כיול מתדלוק אמיתי הוא המדויק מכולם.</p></details>`;
    let h = `<div class="card fuelplan" id="fuelPlan"><div class="row" style="justify-content:space-between"><h3>תוכנית דלק</h3><span class="small muted">${esc(be.name)} · ${be.tank} ל׳ · ${(+be.cons).toFixed(1)} ל׳/100${be.measured ? " (מכויל)" : ""}</span></div>
      <label class="f small"><span class="muted">האופנוע</span><select id="bkModel" class="btn">${bikeOptions()}</select></label>
      <div class="row small" style="gap:10px"><label for="bkStart">מיכל ביציאה</label><input id="bkStart" type="range" min="10" max="100" step="5" value="${b.start}" style="flex:1;min-width:120px"><b class="mono" id="bkStartV">${b.start}%</b><label for="bkFuel">דלק</label><select id="bkFuel" class="btn sm"><option value="95">95</option><option value="98">98</option></select></div>`;
    if (pro) h += styleSeg + calib;
    if (!r) return h + `<p class="small muted" style="margin:0">מחשב…</p></div>`;
    const sim = fuelSimFor(st.chap);
    const pct = l => Math.round(Math.max(0, l) / sim.tank * 100);
    const mk = v => pro ? v : String(v).replace(/[0-9]/g, "•");
    /* the answer that matters for safety is free for everyone: enough fuel, or not */
    let verdict = "";
    if (!st.osm) verdict = `<p class="small muted" style="margin:0">טוען תחנות…</p>`;
    else if (sim.emptyAtKm != null) verdict = `<div class="alert">אין תחנה מתאימה בזמן: המיכל מתרוקן בערך בק״מ ${Math.round(sim.emptyAtKm)}. ${st.bike.start < 100 ? "צאו עם מיכל מלא, או " : ""}תדלקו לפני היציאה${sim.refuels.length ? " והקפידו על התדלוקים המסומנים" : ""}.</div>`;
    else if (!sim.refuels.length) verdict = `<p style="margin:0"><b style="color:var(--go)">אין צורך לתדלק בדרך.</b> <span class="muted">${pro ? `מסיימים עם כ־${Math.max(0, sim.endLiters).toFixed(1)} ל׳${sim.lowAtKm != null ? `, הנורית נדלקת בערך בק״מ ${Math.round(sim.lowAtKm)}` : ""}.` : "לפי הדגם, מצב המיכל ביציאה והמסלול."}</span></p>`;
    else verdict = `<p style="margin:0"><b style="color:var(--caution)">${sim.refuels.length === 1 ? "צריך לתדלק פעם אחת בדרך." : `צריך לתדלק ${sim.refuels.length} פעמים בדרך.`}</b>${pro ? "" : ` <span class="muted">איפה בדיוק ובכמה ליטר, בתוכנית המלאה.</span>`}</p>`;
    const detail = fuelGauge(sim, st.fuelMeKm != null && st.fuelMeChap === st.chap ? st.fuelMeKm : null)
      + `<div class="fsum"><div><span class="k">צריכה צפויה</span><b class="mono">${mk(sim.burn.toFixed(1))} ל׳</b></div><div><span class="k">ממוצע במסלול</span><b class="mono">${mk(sim.avgL100.toFixed(1))}</b><span class="k">ל׳/100</span></div><div><span class="k">טווח מלא עד הנורית</span><b class="mono">${mk(Math.round(sim.rangeFull))}</b><span class="k">ק״מ</span></div><div><span class="k">בסוף</span><b class="mono" style="color:${fuelColor(sim.endLiters, sim.tank)}">${mk(pct(sim.endLiters))}%</b></div></div>`
      + (sim.refuels.length ? sim.refuels.map((x, i) => `<div class="item"><div style="min-width:0"><b>${i + 1}. תדלוק: ${pro ? esc(x.label) : "••••••"}</b><span class="small muted mono">ק״מ ${mk(Math.round(x.km))} · מגיעים עם ${mk(pct(x.before))}% · נכנסים כ־${mk(x.liters.toFixed(1))} ל׳</span></div>${pro ? navBtn("w", wazeLL(x.lat, x.lon)) : ""}</div>`).join("") : "");
    h += pro ? detail + verdict : verdict + `<div class="lockwrap"><div class="blur" aria-hidden="true" inert>${detail}</div><button type="button" class="btn primary lockbtn" id="fuelOpen">${PWI.lock}תוכנית הדלק המלאה</button></div>`;
    if (pro && st.osm && sim.stations.filter(x => x.ok).length === 0) h += `<p class="small muted" style="margin:0">אין תחנה מאומתת כפתוחה בשבת${st.bike.fuel === "98" ? " עם 98" : ""} עד 800 מ׳ מהמסלול. התוכנית מניחה שלא מתדלקים בדרך.</p>`;
    h += `<div class="row"><button type="button" class="btn primary" id="fuelNear"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"/></svg>התחנה הקרובה לפי הדלק שנשאר</button>${pro ? `<label class="toggle small"><input type="checkbox" id="fuelLineT" ${st.layers.fuelline ? "checked" : ""}> צביעת המסלול במפה</label>` : ""}</div><div id="fuelLive"></div>`;
    if (pro) h += `<div class="legend"><span><i style="background:hsl(140 72% 46%)"></i>מלא</span><span><i style="background:hsl(70 72% 46%)"></i>חצי</span><span><i style="background:hsl(25 72% 46%)"></i>רבע</span><span><i style="background:hsl(0 72% 46%)"></i>ריק</span><span><svg width="10" height="8"><path d="M5 8 0 0h10z" fill="var(--go)"/></svg> תחנה פתוחה בשבת</span></div>`;
    return h + `</div>`;
  }

  function bindFuelPlan() {
    const box = $("fuelPlan"); if (!box) return;
    const on = (id, f) => { const e = $(id); if (e) f(e); };
    if ($("fuelOpen")) $("fuelOpen").onclick = () => openPaywall("fuel");
    const save = () => { LS.set("bike", st.bike); renderRoute(); pushSources(); };
    $("bkFuel").value = st.bike.fuel;
    $("bkModel").onchange = e => { const v = e.target.value; if (v === "custom") st.bike.id = "custom"; else { const m = BIKES.find(x => x.id === v); if (!m) return; st.bike.id = m.id; st.bike.tank = m.tank; st.bike.cons = m.cons; st.bike.measured = null; } save(); };
    box.querySelectorAll("[data-st]").forEach(b => b.onclick = () => { st.bike.style = b.dataset.st; st.bike.measured = null; save(); });
    const sv = $("bkStart"); sv.oninput = () => { $("bkStartV").textContent = sv.value + "%"; }; sv.onchange = () => { st.bike.start = +sv.value; save(); };
    $("bkFuel").onchange = e => { st.bike.fuel = e.target.value; save(); };
    on("bkTank", x => x.onchange = e => { st.bike.tank = Math.max(5, Math.min(40, +e.target.value || 15)); st.bike.id = "custom"; save(); });
    on("bkCons", x => x.onchange = e => { st.bike.cons = Math.max(1.5, Math.min(12, +e.target.value || 5)); st.bike.id = "custom"; st.bike.measured = null; save(); });
    if ($("calGo")) $("calGo").onclick = () => { const km = +$("calKm").value, l = +$("calL").value; if (!(km >= 20 && l >= 1)) return toast("מזינים כמה ק״מ נסעתם ובכמה ליטר מילאתם"); const m = Math.round(l / km * 1000) / 10; if (m < 1.5 || m > 15) return toast("המספרים לא נראים הגיוניים. בודקים שוב"); st.bike.measured = m; toast(`מכויל: ${m} ל׳/100 ק״מ`); save(); };
    if ($("calClr")) $("calClr").onclick = () => { st.bike.measured = null; save(); };
    if (!$("fuelNear")) return; /* route still loading: the rest of the card isn't drawn yet */
    if ($("fuelLineT")) $("fuelLineT").onchange = e => { st.layers.fuelline = e.target.checked; LS.set("layers", st.layers); paintFuelLine(); applyLayerVis(); };
    $("fuelNear").onclick = fuelNearMe;
    if (st.fuelLiveHtml && st.fuelLiveChap === st.chap) { $("fuelLive").innerHTML = st.fuelLiveHtml; bindFuelLive(); }
  }
  /* The same colours on the map, along the route line itself. */
  function paintFuelLine() {
    if (!styleReady || !map.getLayer("br-fuelline")) return;
    const r = st.routes[st.chap]; if (!st.layers.fuelline || !r || !isPro()) { setSrc("br-fuelline", FC()); return; }
    const sim = fuelSimFor(st.chap); if (!sim) return;
    setSrc("br-fuelline", FC([{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: r.coords } }]));
    const stops = []; for (let i = 0; i <= 60; i++) { const p = i / 60; stops.push(p, fuelColor(sim.levelAt(p * sim.total), sim.tank)); }
    map.setPaintProperty("br-fuelline", "line-gradient", ["interpolate", ["linear"], ["line-progress"], ...stops]);
  }
  /* Where am I, how much is left, and which station can I still reach? */
  const shabbatNow = () => { const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jerusalem", weekday: "short", hour: "numeric", hour12: false }).formatToParts(new Date()).map(x => [x.type, x.value])); return p.weekday === "Sat" || (p.weekday === "Fri" && +p.hour >= 15); };
  function getPos() {
    if (st.me && st.meTs && Date.now() - st.meTs < 90e3) return Promise.resolve([st.me.lon, st.me.lat]);
    return new Promise((res, rej) => { if (!navigator.geolocation) return rej(new Error("no geo")); navigator.geolocation.getCurrentPosition(p => { st.me = { lat: p.coords.latitude, lon: p.coords.longitude }; st.meTs = Date.now(); res([p.coords.longitude, p.coords.latitude]); }, rej, { enableHighAccuracy: true, timeout: 9000, maximumAge: 30000 }); });
  }
  function fuelRideState() {
    const today = new Date().toISOString().slice(0, 10); let f = st.fuelRide;
    if (!f || f.date !== today || f.chap !== st.chap) f = st.fuelRide = { date: today, chap: st.chap, refills: [] };
    return f;
  }
  /* ---------- motorcycle garages and roadside help ---------- */
  const motoKind = n => n.rep ? (n.tyres ? "מוסך אופנועים · צמיגים" : "מוסך אופנועים") : n.tyres ? "חנות אופנועים · צמיגים" : "חנות אופנועים";
  function motoPopup(n) {
    const pop = new maplibregl.Popup({ closeButton: false, maxWidth: "290px" }).setLngLat([n.lon, n.lat]).setHTML(`<b>${esc(n.name || motoKind(n))}</b><div class="small muted">${motoKind(n)}${n.brand && n.brand !== n.name ? " · " + esc(n.brand) : ""}</div>${n.oh ? `<div class="small mono" dir="ltr" style="text-align:end">${esc(n.oh)}</div>` : ""}${n.phone ? `<div class="small"><span dir="ltr" class="mono sel">${esc(n.phone)}</span></div>` : ""}
      <div class="row" style="margin-top:6px">${n.phone ? `<a class="btn sm" href="${telOf(n.phone)}">${PWI.phone}חיוג</a>` : ""}<button type="button" class="btn sm primary" data-mgo="1">${IC.nav}ניווט</button>${navBtn("w", wazeLL(n.lat, n.lon))}</div><div class="small muted">OpenStreetMap · כדאי להתקשר לפני שמגיעים</div>`).addTo(map);
    const b = pop.getElement().querySelector("[data-mgo]"); if (b) b.onclick = () => { pop.remove(); setTab("go"); navTo({ name: n.name || motoKind(n), sub: motoKind(n), lat: n.lat, lon: n.lon }); };
  }
  async function helpSheet() {
    let me = st.me ? [st.me.lon, st.me.lat] : null; if (!me) try { me = await getPosFresh(6000); } catch (e) { }
    if (!st.osm) await loadOSM(true).catch(() => { });
    const list = me && st.osm ? (st.osm.moto || []).map(n => Object.assign({ d: L.hav(me, [n.lon, n.lat]) }, n)).sort((a, b) => a.d - b.d).slice(0, 6) : [];
    const tow = LS.get("towPhone", "");
    openModal(`<div class="xsheet helps"><h2>עזרה בדרך</h2><p class="muted" style="margin:0">תקלה, פנצ׳ר או נפילה בלי פציעה. בפציעה: קודם כל 101.</p>
      <div class="card helptow"><div class="row" style="justify-content:space-between;align-items:center"><div style="min-width:0"><b>הגרר של הביטוח</b><div class="small muted">${tow ? `<span dir="ltr" class="mono">${esc(tow)}</span>` : "שמרו את המספר מהפוליסה, כדי שיהיה כאן כשצריך"}</div></div>${tow ? `<a class="btn primary" href="${telOf(tow)}">${PWI.phone}חיוג</a>` : ""}</div>
        <div class="row"><input id="towIn" class="btn" inputmode="tel" dir="ltr" placeholder="מספר שירות הגרירה" value="${esc(tow)}" style="flex:1;min-width:0"><button type="button" class="btn sm" id="towSave">שמירה</button></div>
        <div class="small muted">כשמזמינים: אמרו שזה אופנוע ובקשו גרר עם מתקן לאופנועים, ותנו את המיקום המדויק (למטה).</div></div>
      ${me ? `<p class="small muted mono" style="margin:0" dir="ltr">${me[1].toFixed(5)}, ${me[0].toFixed(5)}</p>` : ""}
      <h3 style="margin:4px 0 0">מוסכים וחנויות אופנועים קרובים</h3>
      ${list.length ? `<div class="list golist">${list.map((n, i) => `<div class="gli helprow"><span class="grow"><b>${esc(n.name || motoKind(n))}</b><span class="small muted">${motoKind(n)} · ${n.d < 10 ? n.d.toFixed(1) : Math.round(n.d)} ק״מ${n.oh ? " · " + esc(n.oh) : ""}</span></span>${n.phone ? `<a class="btn sm" href="${telOf(n.phone)}" aria-label="חיוג">${PWI.phone}</a>` : ""}<button type="button" class="btn sm" data-hgo="${i}">ניווט</button></div>`).join("")}</div>` : `<p class="small muted" style="margin:0">${me ? "עוד אין מוסכי אופנועים מסומנים קרוב אליך במפה הפתוחה." : "צריך מיקום כדי למצוא את הקרובים."}</p>`}
      <a class="btn" target="_blank" rel="noopener" href="https://www.google.com/search?q=${encodeURIComponent("גרר אופנועים קרוב אליי")}">חיפוש גרר אופנועים באזור</a>
      <p class="small muted" style="margin:0">פנצ׳ר בכביש מהיר: עוצרים בשול רחוק ככל האפשר, מדליקים מהבהבים, ועומדים מאחורי המעקה, לא ליד האופנוע.</p></div>`);
    $("towSave").onclick = () => { const v = $("towIn").value.replace(/[^\d+*#-]/g, "").slice(0, 20); LS.set("towPhone", v); toast(v ? "נשמר" : "נמחק"); closeModal(); helpSheet(); };
    document.querySelectorAll("[data-hgo]").forEach(b => b.onclick = () => { const n = list[+b.dataset.hgo]; closeModal(); setTab("go"); navTo({ name: n.name || motoKind(n), sub: motoKind(n), lat: n.lat, lon: n.lon }); });
  }
  async function fuelNearMe() {
    const out = $("fuelLive"); if (!out) return; out.innerHTML = `<p class="small muted">מאתר את המיקום שלך…</p>`;
    let me; try { me = await getPos(); } catch (e) { out.innerHTML = `<div class="alert">אין גישה למיקום. מאשרים מיקום לאתר בהגדרות הדפדפן ומנסים שוב.</div>`; return; }
    const r = st.routes[st.chap], sim = fuelSimFor(st.chap); if (!r || !sim) return;
    let bi = 0, bd = 1e9; for (let i = 0; i < r.coords.length; i++) { const d = L.hav(r.coords[i], me); if (d < bd) { bd = d; bi = i; } }
    const cum = r.cum || (r.cum = L.cumulative(r.coords)); const myKm = cum[bi], onRoute = bd < 2;
    const fr = fuelRideState(), be = bikeEff(), P = sim.profile, startL = sim.tank * st.bike.start / 100, rate = sim.burn / sim.total;
    const left = onRoute ? L.fuelLeftAt(P, myKm, startL, sim.tank, fr.refills) : null;
    const sat = shabbatNow();
    const usable = f => (sat ? f.sat !== "closed" : true) && (st.bike.fuel === "98" ? f.o98 !== false : f.o95 !== false);
    const all = (st.osm ? st.osm.fuel : []).map(n => Object.assign({}, n, fuelStatus(n), { label: n.name || n.brand || "תחנת דלק", dist: L.hav(me, [n.lon, n.lat]) }));
    let cands;
    if (onRoute) cands = fuelAlong(st.chap, 1.5).filter(f => f.km > myKm - 0.2 && usable(f)).map(f => { const need = P.at(f.km) - P.at(Math.min(myKm, f.km)) + f.d * 2 * rate; return Object.assign(f, { need, arrive: left - need, ahead: f.km - myKm }); });
    else cands = all.filter(usable).sort((a, b) => a.dist - b.dist).slice(0, 12).map(f => Object.assign(f, { need: f.dist * 1.35 * rate, ahead: f.dist * 1.35 }));
    const liters = left != null ? left : null;
    const reach = cands.filter(f => liters == null || f.arrive > 0.3).sort((a, b) => (a.ahead || 0) - (b.ahead || 0));
    /* the pick: on the route, the last reachable station before the reserve (or the next one if already low); off the route, the nearest */
    let pick = null;
    if (onRoute && liters != null) { const beforeLow = reach.filter(f => f.arrive >= sim.reserve); pick = liters - sim.reserve < 4 * rate * 10 ? reach[0] : (beforeLow[beforeLow.length - 1] || reach[0]); }
    else pick = reach[0] || null;
    st.fuelMeKm = onRoute ? myKm : null; st.fuelMeChap = st.chap;
    const pct = l => Math.round(Math.max(0, l) / sim.tank * 100);
    let h = `<div class="flive">`;
    if (onRoute) h += `<div class="ftank" style="--f:${pct(liters)}%;--fc:${fuelColor(liters, sim.tank)}"><div class="fbar"><i></i></div><div><b class="mono">${pct(liters)}%</b> <span class="muted">כ־${Math.max(0, liters).toFixed(1)} ל׳ · עוד כ־${Math.max(0, Math.round((liters - sim.reserve) / rate))} ק״מ עד הנורית</span></div></div><p class="small muted" style="margin:0">ק״מ ${Math.round(myKm)} במסלול, לפי מיכל של ${st.bike.start}% ביציאה${fr.refills.length ? ` ותדלוק בק״מ ${fr.refills.map(Math.round).join(", ")}` : ""}.</p>`;
    else h += `<p class="small" style="margin:0">את/ה ${bd.toFixed(1)} ק״מ מהמסלול. מוצגות התחנות הקרובות אלייך${sat ? " שלא ידוע שהן סגורות בשבת" : ""}.</p>`;
    if (!pick) h += `<div class="alert">${onRoute ? "אין תחנה מתאימה שאפשר להגיע אליה לפי החישוב. מורידים קצב, והכי קרוב: " + (all.sort((a, b) => a.dist - b.dist)[0] ? esc(all[0].label) + ` (${all[0].dist.toFixed(1)} ק״מ באוויר)` : "לא ידוע") : "לא נמצאה תחנה קרובה."}</div>`;
    else h += `<div class="fpick"><div class="k">${onRoute ? (pick === reach[0] ? "התחנה הבאה שאפשר להגיע אליה" : "תדלוק מומלץ לפני הנורית") : "הכי קרובה"}</div><b>${esc(pick.label)}</b><span class="small muted mono">${onRoute ? `${pick.ahead < 0.3 ? "ממש כאן" : `בעוד ${pick.ahead.toFixed(1)} ק״מ`} · מגיעים עם ${pct(pick.arrive)}%` : `${pick.dist.toFixed(1)} ק״מ באוויר`}</span><div class="chips">${satPill(pick)}${octChips(pick)}</div><div class="row">${navBtn("w", wazeLL(pick.lat, pick.lon))}${navBtn("g", gmLL(pick.lat, pick.lon))}<button type="button" class="btn sm" data-fx="${pick.id}">במפה</button></div></div>`;
    const alt = reach.filter(f => f !== pick).slice(0, 3);
    if (alt.length) h += `<div class="small muted">גם בדרך: ${alt.map(f => `${esc(f.label)} (${onRoute ? "בעוד " + Math.max(0, f.ahead).toFixed(1) : f.dist.toFixed(1)} ק״מ)`).join(" · ")}</div>`;
    if (onRoute) h += `<div class="row"><button type="button" class="btn sm" id="fRefill">תדלקתי כאן, מיכל מלא</button>${fr.refills.length ? `<button type="button" class="btn sm" id="fRefillClr">איפוס תדלוקים</button>` : ""}</div>`;
    h += `</div>`;
    st.fuelLiveHtml = h; st.fuelLiveChap = st.chap;
    renderRoute(); const fp = $("fuelPlan"); if (fp) fp.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
  function bindFuelLive() {
    const root = $("fuelLive"); if (!root) return;
    root.querySelectorAll("[data-fx]").forEach(x => x.onclick = () => { const n = st.osm.fuel.find(k => k.id === x.dataset.fx); if (!n) return; map.flyTo({ center: [n.lon, n.lat], zoom: 14, padding: sheetPad() }); openFuelPopup(n); if (innerWidth < 900) setSheet("peek"); });
    if ($("fRefill")) $("fRefill").onclick = () => { const fr = fuelRideState(); if (st.fuelMeKm != null) fr.refills.push(st.fuelMeKm); LS.set("fuelRide", st.fuelRide); toast("נרשם: מיכל מלא מכאן"); fuelNearMe(); };
    if ($("fRefillClr")) $("fRefillClr").onclick = () => { fuelRideState().refills = []; LS.set("fuelRide", st.fuelRide); fuelNearMe(); };
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
  const photoSlot = (lat, lon, kind) => !st.flags.photos ? "" : `<div class="ph" data-ph="${lat},${lon},${kind}"><div class="ph-skel"></div></div>`;
  const thumbSlot = (lat, lon, kind, id) => !st.flags.photos ? "" : `<button type="button" class="thumb" data-ph="${lat},${lon},${kind}" ${kind === "cafe" ? `data-cafe="${id}"` : `data-ll="${lon},${lat}"`} aria-label="תמונה ומיקום"><span class="ph-skel"></span></button>`;
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

  /* ---------- live traffic (HERE, through our server): slow and closed roads as lines, incidents as points ---------- */
  function addTrafficLayer() {
    if (!st.cfg.traffic || map.getSource("br-traffic")) return; const c = n => css(n), vis = st.layers.traffic ? "visible" : "none";
    map.addSource("br-traffic", { type: "geojson", data: FC(), attribution: "תנועה: HERE" }); map.addSource("br-inc", { type: "geojson", data: FC() });
    map.addLayer({ id: "br-traffic", type: "line", source: "br-traffic", minzoom: 7, layout: { visibility: vis, "line-cap": "round", "line-join": "round" }, paint: { "line-color": ["case", [">=", ["get", "j"], 8], c("--no"), [">=", ["get", "j"], 5], c("--warn"), c("--caution")], "line-width": ["interpolate", ["linear"], ["zoom"], 8, 2.5, 13, 5], "line-offset": ["interpolate", ["linear"], ["zoom"], 8, 1.5, 13, 4], "line-opacity": 0.9 } }, map.getLayer("br-route-casing") ? "br-route-casing" : firstSymbol());
    map.addLayer({ id: "br-inc", type: "circle", source: "br-inc", minzoom: 8, layout: { visibility: vis }, paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 5, 13, 8], "circle-color": ["case", ["get", "closed"], c("--no"), ["==", ["get", "kind"], "accident"], c("--no"), c("--warn")], "circle-stroke-color": "#fff", "circle-stroke-width": 2 } });
    map.on("click", "br-inc", e => { const p = e.features[0].properties; new maplibregl.Popup({ closeButton: false, maxWidth: "270px" }).setLngLat(e.lngLat).setHTML(`<b>${esc(p.label)}${p.closed === true || p.closed === "true" ? " · סגור" : ""}</b>${p.txt ? `<div class="small">${esc(p.txt)}</div>` : ""}${p.until ? `<div class="small muted">עד ${esc(fmtT(new Date(p.until)))}</div>` : ""}<div class="small muted">HERE · מתעדכן כל כמה דקות</div>`).addTo(map); });
    map.on("mouseenter", "br-inc", () => map.getCanvas().style.cursor = "pointer"); map.on("mouseleave", "br-inc", () => map.getCanvas().style.cursor = "");
    pushSources();
  }
  function samplePts(coords, maxN = 24) {
    const cum = L.cumulative(coords), total = cum[cum.length - 1]; const step = Math.max(3, total / maxN); const out = [];
    for (let km = step / 2; km < total; km += step) { const p = L.pointAt(coords, cum, km); out.push({ km, lat: +p[1].toFixed(4), lon: +p[0].toFixed(4) }); }
    return out;
  }
  async function fetchTraffic(pts, full) {
    const r = await fetch("/api/traffic?pts=" + pts.map(p => `${p.lat},${p.lon}`).join(";")); if (!r.ok) throw new Error(r.status);
    const j = await r.json(); if (!Array.isArray(j.pts)) throw new Error("bad");
    const out = j.pts.map((x, i) => Object.assign({ km: pts[i].km }, x)); return full ? { pts: out, segs: j.segs || [], inc: j.inc || [] } : out;
  }
  async function loadTraffic(id, force) {
    if (!st.cfg.traffic) return; const r = st.routes[id]; if (!r) return;
    const cur = st.traffic[id]; if (!force && cur && (cur.busy || Date.now() - cur.ts < 3 * 6e4)) return;
    st.traffic[id] = Object.assign({}, cur || {}, { busy: true, ts: Date.now() });
    try { const f = await fetchTraffic(samplePts(r.coords), true); st.traffic[id] = { ts: Date.now(), pts: f.pts, segs: f.segs, inc: f.inc, km: r.km, way: cur && cur.way }; }
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
    if (!st.cfg.traffic) return `<div class="card"><div class="row" style="justify-content:space-between"><h3>עומסים עכשיו</h3><a class="navb w" target="_blank" rel="noopener" href="${waze}">${NAVI.w}<span>מפת התנועה</span></a></div><p class="small muted" style="margin:0">שכבת התנועה החיה מתחברת בקרוב. בינתיים, מפת התנועה של Waze פתוחה עם היעד של הפרק.</p></div>`;
    const t = st.traffic[id];
    let h = `<div class="card traffic"><div class="row" style="justify-content:space-between"><h3>עומסים עכשיו</h3><span class="small muted">${t && t.pts ? `עודכן ${fmtT(new Date(t.ts))}` : t && t.busy ? "טוען…" : ""}</span></div>`;
    const incOn = t && t.inc ? t.inc.filter(i => i.on) : [];
    if (incOn.length) h += `<div class="trinc">${incOn.slice(0, 4).map(i => `<div class="item"><span class="dot" style="background:${i.closed || i.kind === "accident" ? "var(--no)" : "var(--warn)"}"></span><div style="min-width:0"><b>${esc(i.label)}${i.closed ? " · הכביש סגור" : ""}</b>${i.txt ? `<span class="small muted">${esc(i.txt)}</span>` : ""}</div></div>`).join("")}</div>`;
    h += t && t.pts ? `<div class="small" style="font-weight:700">לאורך הפרק</div>${trStrip(t)}` : t && t.err ? `<p class="small muted" style="margin:0">שירות התנועה לא ענה. נסו שוב בעוד דקה.</p>` : `<div class="trstrip skel"></div>`;
    const w = t && t.way;
    h += w && w.pts ? `<div class="small" style="font-weight:700;margin-top:4px">מהמיקום שלך עד תחילת הפרק · ${Math.round(w.km)} ק״מ, כ־${Math.round(w.min)} דק׳</div>${trStrip(w)}`
      : `<div class="row"><button type="button" class="btn sm" id="trWay">${w && w.busy ? "בודק…" : "עומסים בדרך אל הפרק"}</button><button type="button" class="btn sm" id="trRe">רענון</button><a class="navb w" target="_blank" rel="noopener" href="${waze}">${NAVI.w}<span>Waze</span></a></div>${w && w.err ? `<div class="small muted">${w.err === "מיקום" ? "אין גישה למיקום." : "לא הצלחתי לחשב את הדרך."}</div>` : ""}`;
    return h + `<div class="legend"><span><i style="background:var(--go)"></i>זורם</span><span><i style="background:var(--caution)"></i>איטי</span><span><i style="background:var(--no)"></i>עומס או סגור</span><span class="small">HERE · חי</span></div></div>`;
  }
  function bindTraffic(id) {
    if ($("trWay")) $("trWay").onclick = () => trafficOnTheWay(id);
    if ($("trRe")) $("trRe").onclick = () => loadTraffic(id, true);
  }

  /* ---------- route builder: search, waypoints, preferences, save and share ---------- */
  const DRAFT = "draft", NAV = "nav";
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
  /* Search: HERE (exact addresses with house numbers, businesses, junctions) and OSM/Photon (outdoor places,
     viewpoints) in parallel; HERE first, duplicates within 150 m dropped. Either one alone is enough. */
  async function remoteSearch(q, near) {
    q = L.normQuery(q);
    const ctl = new AbortController(); remoteSearch.ctl && remoteSearch.ctl.abort(); remoteSearch.ctl = ctl;
    const c = near ? { lat: near.lat, lng: near.lon } : map.getCenter();
    const here = st.cfg.geo ? fetch(`/api/geo?q=${encodeURIComponent(q)}&at=${c.lat.toFixed(3)},${c.lng.toFixed(3)}`, { signal: ctl.signal }).then(r => r.ok ? r.json() : { items: [] }).then(j => j.items || []).catch(e => { if (e.name === "AbortError") throw e; return []; }) : Promise.resolve([]);
    const osm = remoteSearchOsm(q, c, ctl).catch(e => { if (e.name === "AbortError") throw e; return []; });
    const [a, b] = await Promise.all([here, osm]);
    /* an OSM hit is dropped only when it is the same place: within 40 m, or the same name within 150 m (two house
       numbers on one street are both kept) */
    const same = (x, y) => { const d = L.hav([x.lon, x.lat], [y.lon, y.lat]); return d < 0.04 || (d < 0.15 && x.name === y.name); };
    let out = a.concat(b.filter(x => !a.some(y => same(x, y))));
    /* an address nobody found yet: one more try with Nominatim before saying "not found" */
    if (out.length < 2 && L.looksLikeAddress(q) && st.cfg.geo) { const nm = await osmNominatim(q, ctl); out = out.concat(nm.filter(x => !out.some(y => same(x, y)))); }
    return out.slice(0, 10);
  }
  /* OSM side: Photon (fast, outdoor places), and for address-looking text Nominatim too, which knows house numbers
     Photon sometimes lacks. A Photon failure falls back to Nominatim. */
  async function remoteSearchOsm(q, c, ctl) {
    if (L.looksLikeAddress(q) && !st.cfg.geo) { const [ph, nm] = await Promise.all([osmPhoton(q, c, ctl).catch(e => { if (e.name === "AbortError") throw e; return []; }), osmNominatim(q, ctl)]); return nm.concat(ph.filter(x => !nm.some(y => L.hav([x.lon, x.lat], [y.lon, y.lat]) < 0.04))); }
    return osmPhoton(q, c, ctl).catch(e => { if (e.name === "AbortError") throw e; return osmNominatim(q, ctl); });
  }
  async function osmPhoton(q, c, ctl) {
    const r = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=8&lat=${c.lat.toFixed(3)}&lon=${c.lng.toFixed(3)}&bbox=34.2,29.4,35.95,33.45`, { signal: ctl.signal });
    const j = await r.json();
    return j.features.map(f => { const p = f.properties; const [lon, lat] = f.geometry.coordinates; const street = p.street ? p.street + (p.housenumber ? " " + p.housenumber : "") : ""; const sub = [p.name && street, p.city || p.county, p.state].filter(Boolean).join(", "); return { name: p.name || street || p.city, sub, lat, lon, k: p.housenumber && !p.name ? "כתובת" : p.osm_value === "fuel" ? "דלק" : p.osm_key === "highway" ? "כביש" : p.osm_key === "place" ? "יישוב" : "מקום" }; }).filter(x => x.name);
  }
  function osmNominatim(q, ctl) {
    return fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(q)}&countrycodes=il,ps&accept-language=he&limit=6`, { signal: ctl.signal }).then(r => r.json())
      .then(j => j.map(x => ({ name: x.name || x.display_name.split(",").slice(0, 2).join(" ").trim(), sub: x.display_name.split(",").slice(1, 3).join(","), lat: +x.lat, lon: +x.lon, k: x.addresstype === "building" || x.type === "house" ? "כתובת" : "מקום" })))
      .catch(e => { if (e.name === "AbortError") throw e; return []; });
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
    const mic = micFor(q, () => q.oninput()); if (mic) q.parentNode.insertBefore(mic, q.nextSibling);
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
    if (!b.editing && st.myRoutes.length >= FREE_ROUTES && !isPro()) return openPaywall("routes");
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
  /* iPhone opens every link in Safari (home-screen apps can't catch links), so a friend's route can be
     pasted into the installed app here. */
  function importLink() {
    openModal(`<div class="xsheet"><h2>מסלול מקישור</h2><p class="small muted" style="margin:0">קיבלתם קישור למסלול בוואטסאפ? העתיקו אותו והדביקו כאן.</p><input id="ilIn" class="xin" dir="ltr" placeholder="https://blueronin.app/?r=…" style="font-size:15px;letter-spacing:0"><div class="row"><button type="button" class="btn" id="ilPaste">הדבקה</button><button type="button" class="btn primary" id="ilGo">פתיחה</button></div><div class="err small" id="ilErr"></div></div>`);
    $("ilPaste").onclick = async () => { try { $("ilIn").value = await navigator.clipboard.readText(); } catch (e) { $("ilIn").focus(); toast("לחיצה ארוכה בשדה ← הדבקה"); } };
    $("ilGo").onclick = () => { const v = $("ilIn").value.trim(); let q = null; try { q = new URL(v).searchParams.get("r"); } catch (e) { const m = v.match(/[?&]r=([A-Za-z0-9_-]+)/); q = m && m[1]; } if (!q) { $("ilErr").textContent = "זה לא קישור למסלול של Blue Ronin"; return; } closeModal(); importShared(q); };
  }
  /* A shared link opens the route itself: it is saved with a "משיתוף" tag, selected and shown, so nobody
     misses it in the builder. Same stops already saved → that route opens. At the free limit it opens as an
     unsaved preview, with the option to save. */
  function importShared(fromLink) {
    const q = fromLink || new URLSearchParams(location.search).get("r"); if (!q) return;
    try {
      const d = JSON.parse(unb64u(q)); history.replaceState(null, "", location.pathname + location.hash);
      if (!Array.isArray(d.p) || d.p.length < 2) return;
      const pts = d.p.slice(0, 25).map(([name, lat, lon]) => ({ name: String(name).slice(0, 60), lat: +lat, lon: +lon })).filter(p => isFinite(p.lat) && isFinite(p.lon) && p.lat > 29 && p.lat < 34 && p.lon > 34 && p.lon < 36.3);
      if (pts.length < 2) return;
      const title = String(d.t || "").slice(0, 40).trim() || `${pts[0].name.split(",")[0]} ← ${pts[pts.length - 1].name.split(",")[0]}`;
      const opts = { noHighway: !!(d.o && d.o.noHighway), loop: !!(d.o && d.o.loop) }, sig = JSON.stringify(pts.map(p => [p.lat.toFixed(4), p.lon.toFixed(4)]));
      const same = st.myRoutes.find(u => JSON.stringify(u.stops.map(p => [(+p.lat).toFixed(4), (+p.lon).toFixed(4)])) === sig);
      const show = id => { setChap(id); setTab("route"); if (innerWidth < 900) setSheet("half"); setTimeout(() => { const h = $("p-route").querySelector("h2"); if (h) h.scrollIntoView({ block: "start", behavior: "smooth" }); }, 400); };
      if (same) { show(same.id); toast("המסלול הזה כבר שמור אצלכם. פתחתי אותו"); }
      else if (st.myRoutes.length < FREE_ROUTES || isPro()) {
        const id = "u" + Date.now().toString(36), rec = { id, title, stops: pts, opts, shared: { t: Date.now() } };
        st.myRoutes.push(rec); LS.set("myRoutes", st.myRoutes); const c = customChapter(rec); CHAPTERS.push(c);
        show(id); loadRoute(c).then(r => { processRoute(c, r); pushSources(); renderMarkers(); if (st.chap === id) { renderTab(); fitChapter(); } loadElev(id).then(() => st.tab === "route" && st.chap === id && renderRoute()); });
        toast(`קיבלתם מסלול: ${title}. הוא נשמר אצלכם`, 3500);
      } else {
        st.build = { editing: null, title, pts, opts, results: [], q: "", shared: true };
        st.prevChap = st.chap; syncDraft(); setTab("route"); toast("קיבלתם מסלול מחבר. הגעתם למגבלת המסלולים: שמירה תדרוש Pro או מחיקה של מסלול ישן", 4500);
      }
      if (!fromLink && isIOS && !standalone()) setTimeout(() => updBar("האפליקציה מותקנת אצלכם? באייפון קישורים נפתחים בספארי. העתיקו את הקישור, ובאפליקציה: מסלול ← ״מסלול מקישור״", { ms: 14000 }), 3500);
    } catch (e) { }
  }

  /* =====================================================================================
     Everyday navigation ("ניווט"): the app as a daily navigator for two-wheelers anywhere in Israel,
     next to the weekend tab. Search a place (or say it), see the trip with live traffic and the weather
     on arrival, and go: the trip rides on the same engine as the chapters (voice, re-routing, HUD, SOS,
     journal). Home, work and recent places are kept on the phone only.
     ===================================================================================== */
  st.nav = null; /* { dest, tr, wx, busy, err } */
  const navPlaces = () => LS.get("navPlaces", {}) || {};
  const navRecent = () => (LS.get("navRecent", []) || []).filter(x => x && isFinite(x.lat) && isFinite(x.lon));
  const NAVQ = { q: "", results: [], searching: false };
  const fmtDur = m => m < 60 ? `${Math.max(1, Math.round(m))} דק׳` : `${Math.floor(m / 60)}:${String(Math.round(m % 60)).padStart(2, "0")} שע׳`;
  function navChapter() { return CHAPTERS.find(c => c.id === NAV); }
  /* Traffic delay as a share of the whole trip: every sampled point stands for an equal slice of the route, a
     point with no live data counts as free-flowing, and one jammed point can slow its slice at most ~2.5×.
     The total is capped (+80%), so a few mismatched segments can never double the trip as before. */
  function navTrafficFactor() {
    const t = st.traffic[NAV]; if (!t || !t.pts || !t.pts.length) return null; const n = t.pts.length, r = t.pts.filter(p => p.ratio != null);
    if (!r.length) return null; const extra = r.reduce((a, p) => a + (1 / Math.max(0.4, Math.min(1, p.ratio)) - 1), 0) / n; return Math.min(1.8, 1 + extra);
  }
  async function navTo(dest, opts) {
    const me = st.me ? { lat: st.me.lat, lon: st.me.lon } : await getPosFresh(9000).then(p => p && { lat: p[1], lon: p[0] }).catch(() => null);
    if (!me) { toast("צריך גישה למיקום כדי לנווט. אפשר לאשר מיקום בהגדרות הדפדפן"); return; }
    if (L.hav([me.lon, me.lat], [dest.lon, dest.lat]) < 0.15) { toast("אתם כבר שם"); return; }
    navClear(true);
    const o = Object.assign({ noHighway: !!(navPlaces().noHw) }, opts || {});
    const c = customChapter({ id: NAV, title: dest.name, sub: dest.sub || "ניווט", stops: [{ name: "המיקום שלי", lat: +me.lat.toFixed(5), lon: +me.lon.toFixed(5) }, { name: dest.name, lat: +dest.lat, lon: +dest.lon }], opts: o });
    c.nav = true; c.hidden = true; CHAPTERS.push(c);
    st.navPrev = st.chap !== NAV ? st.chap : st.navPrev; st.nav = { dest, busy: true };
    const rec = navRecent().filter(x => L.hav([x.lon, x.lat], [dest.lon, dest.lat]) > 0.1); rec.unshift({ name: dest.name, sub: dest.sub || "", lat: +dest.lat, lon: +dest.lon, t: Date.now() }); LS.set("navRecent", rec.slice(0, 8));
    st.chap = NAV; renderGo();
    const r = await loadRoute(c); if (navChapter() !== c) return;
    processRoute(c, r); st.nav.busy = false; st.nav.err = r.real ? null : "השרת של המסלולים לא ענה, זה קו משוער. נסו שוב בעוד רגע";
    pushSources(); renderMarkers(); fitChapter(900); if (innerWidth < 900) setSheet("half"); renderGo();
    if (st.cfg.traffic) loadTraffic(NAV, true).then(() => st.tab === "go" && renderGo());
    navArrivalWx(dest, r);
  }
  async function navArrivalWx(dest, r) {
    const r1 = v => (Math.round(v * 10) / 10).toFixed(2);
    try { const j = await (await withTimeout(fetch(`/api/wx?p=${r1(dest.lat)},${r1(dest.lon)}`), 9000)).json(); const h = j.data && j.data[0] && j.data[0].hourly; if (!h || !st.nav) return;
      const eta = new Date(Date.now() + r.min * (navTrafficFactor() || 1) * 6e4), iso = new Intl.DateTimeFormat("sv-SE", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit" }).format(eta).replace(" ", "T") + ":00", i = h.time.indexOf(iso);
      if (i < 0) return; st.nav.wx = { t: h.temperature_2m[i], p: h.precipitation_probability[i], g: h.wind_gusts_10m[i], code: h.weather_code[i] }; if (st.tab === "go") renderGo();
    } catch (e) { }
  }
  function navClear(quiet) {
    const i = CHAPTERS.findIndex(c => c.id === NAV); if (i >= 0) CHAPTERS.splice(i, 1);
    ["routes", "curves", "cstats", "glare", "elev", "terr", "traffic"].forEach(k => delete st[k][NAV]);
    st.nav = null; if (quiet) return;
    st.chap = st.navPrev && CHAPTERS.some(c => c.id === st.navPrev) ? st.navPrev : LS.get("chap", "c1"); if (!CHAPTERS.some(c => c.id === st.chap)) st.chap = "c1";
    pushSources(); renderMarkers(); renderGo();
  }
  function navSave() {
    const c = navChapter(); if (!c) return; if (st.myRoutes.length >= FREE_ROUTES && !isPro()) return openPaywall("routes");
    const id = "u" + Date.now().toString(36), rec = { id, title: c.title.slice(0, 40), stops: c.stops.map(s => ({ name: s.name, lat: s.lat, lon: s.lon })), opts: c.opts };
    st.myRoutes.push(rec); LS.set("myRoutes", st.myRoutes); const nc = customChapter(rec); CHAPTERS.push(nc); if (st.routes[NAV]) processRoute(nc, st.routes[NAV]);
    toast("נשמר במסלולים שלך, בלשונית מסלול");
  }
  function navSetPlace(kind) { const n = st.nav; if (!n) return; const P = navPlaces(); P[kind] = { name: n.dest.name, sub: n.dest.sub || "", lat: +n.dest.lat, lon: +n.dest.lon }; LS.set("navPlaces", P); toast(kind === "home" ? "נשמר כבית" : "נשמר כעבודה"); renderGo(); }
  function navTripCard() {
    const n = st.nav, c = navChapter(); if (!n || !c) return "";
    if (n.busy) return `<div class="card navtrip"><div class="row" style="gap:10px"><span class="spin"></span><b>מחשב מסלול אל ${esc(n.dest.name)}…</b></div></div>`;
    const r = st.routes[NAV]; if (!r) return "";
    const f = navTrafficFactor(), mins = r.min * (f || 1), eta = new Date(Date.now() + mins * 6e4), t = st.traffic[NAV];
    const slow = t && t.pts ? t.pts.filter(p => p.ratio != null && p.ratio < 0.55) : [], inc = t && t.inc ? t.inc.filter(i => i.on) : [];
    const trLine = !st.cfg.traffic ? "" : !t ? `<span class="small muted">בודק תנועה…</span>` : inc.length ? `<span class="trk no">${esc(inc[0].label)}${inc[0].closed ? " · כביש סגור" : ""} במסלול</span>` : slow.length ? `<span class="trk warn">עומס בחלק מהדרך${f ? ` · +${Math.round(r.min * (f - 1))} דק׳` : ""}</span>` : t.pts && t.pts.some(p => p.ratio != null) ? `<span class="trk go">התנועה זורמת</span>` : `<span class="small muted">אין נתוני תנועה לדרך הזאת</span>`;
    const w = n.wx, P = navPlaces();
    return `<div class="card navtrip"><div class="row" style="justify-content:space-between;align-items:flex-start;gap:10px"><div style="min-width:0"><div class="small muted">אל</div><h3 class="navto">${esc(n.dest.name)}</h3>${n.dest.sub ? `<div class="small muted">${esc(n.dest.sub)}</div>` : ""}</div><button type="button" class="ic-btn" id="navX" aria-label="ביטול הניווט">✕</button></div>
      <div class="navnums"><div><b class="mono">${fmtT(eta)}</b><span>הגעה</span></div><div><b class="mono">${fmtDur(mins)}</b><span>${f && f > 1.08 ? "כולל עומסים" : "זמן נסיעה"}</span></div><div><b class="mono">${r.km < 10 ? r.km.toFixed(1) : Math.round(r.km)}</b><span>ק״מ</span></div></div>
      <div class="row" style="gap:8px;flex-wrap:wrap">${trLine}${w ? `<span class="trk wx"><span class="pwx">${wxIcon(w.code)}</span>ביעד ${Math.round(w.t)}°${w.p >= 20 ? ` · ${w.p}% גשם` : ""}${w.g >= 40 ? ` · משבים ${Math.round(w.g)}` : ""}</span>` : ""}</div>
      ${n.err ? `<div class="alert info small">${esc(n.err)}</div>` : ""}
      <button type="button" class="btn primary navgo" id="navGo">${IC.nav}יוצאים לדרך</button>
      <div class="row navacts"><label class="toggle small"><input type="checkbox" id="navNoHw" ${c.opts && c.opts.noHighway ? "checked" : ""}> בלי כבישים מהירים</label></div>
      <div class="row navacts"><button type="button" class="btn sm" id="navShare">${PWI.share}שיתוף</button><button type="button" class="btn sm" id="navSave">שמירה כמסלול</button><button type="button" class="btn sm" id="navHome">${P.home && L.hav([P.home.lon, P.home.lat], [n.dest.lon, n.dest.lat]) < 0.1 ? "★ הבית" : "שמירה כבית"}</button><button type="button" class="btn sm" id="navWork">${P.work && L.hav([P.work.lon, P.work.lat], [n.dest.lon, n.dest.lat]) < 0.1 ? "★ העבודה" : "שמירה כעבודה"}</button></div></div>`;
  }
  function placeSheet(k, setMode) {
    const P = navPlaces(), pl = P[k], label = k === "home" ? "הבית" : "העבודה"; if (!pl) return setMode(k);
    openModal(`<div class="xsheet"><h2>${label}</h2><p class="muted" style="margin:0">${esc(pl.name)}${pl.sub ? ` · ${esc(pl.sub)}` : ""}</p>
      <button type="button" class="btn primary" id="plChange">בחירת כתובת אחרת</button>
      ${st.me ? `<button type="button" class="btn" id="plHere">המיקום הנוכחי שלי הוא ${label}</button>` : ""}
      <button type="button" class="btn danger" id="plDel">הסרת ${label}</button></div>`);
    $("plChange").onclick = () => { closeModal(); setMode(k); };
    if ($("plHere")) $("plHere").onclick = () => { const P2 = navPlaces(); P2[k] = { name: k === "home" ? "הבית" : "העבודה", sub: "נשמר מהמיקום", lat: +st.me.lat.toFixed(6), lon: +st.me.lon.toFixed(6) }; LS.set("navPlaces", P2); closeModal(); toast(`${label} עודכן למיקום הנוכחי`); renderGo(); };
    $("plDel").onclick = () => { const P2 = navPlaces(); delete P2[k]; LS.set("navPlaces", P2); closeModal(); toast(`${label} הוסר`); renderGo(); };
  }
  function navResultsHtml() {
    if (!NAVQ.q) return "";
    if (!NAVQ.results.length) return NAVQ.searching ? `<div class="small muted sr">מחפש…</div>` : `<div class="small muted sr">לא נמצאו תוצאות</div>`;
    return NAVQ.results.map((r, i) => `<button type="button" class="sr" data-go="${i}"><span class="sr-k">${r.k}</span><span class="grow"><b>${esc(r.name)}</b><span class="small muted">${esc(r.sub || "")}</span></span><span class="sr-plus">${IC.nav}</span></button>`).join("");
  }
  function renderGo() { return paneSafe("go", renderGo_); }
  function renderGo_() {
    const p = $("p-go"); if (!p) return; const P = navPlaces(), rec = navRecent(), riding = !!st.ride;
    const qb = (id, icon, label, sub, edit) => `<div class="gqw"><button type="button" class="gq" id="${id}"><span class="gqi">${icon}</span><b>${label}</b><span class="small muted">${sub}</span></button>${edit ? `<button type="button" class="gqe" data-edit="${edit}" aria-label="שינוי ${label}">✎</button>` : ""}</div>`;
    const WRENCH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 6.5a4 4 0 0 0-5.4 5l-5.6 5.6a1.6 1.6 0 0 0 2.3 2.3l5.6-5.6a4 4 0 0 0 5-5.4l-2.4 2.4-2.1-.4-.4-2.1z"/></svg>';
    const HOME = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/></svg>', WORK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>', FUEL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16"/><path d="M3 21h12M4 10h10M14 8l3 3v6a2 2 0 0 0 4 0V9l-3-3"/></svg>';
    let h = `<div class="go"><div class="gohead"><h2>לאן רוכבים?</h2><span class="small muted">ניווט לאופנוע ולקטנוע בכל הארץ, עם תנועה חיה ומזג אוויר בדרך</span></div>
      ${NAVQ.setFor ? `<div class="setfor"><span>בוחרים כתובת ${NAVQ.setFor === "home" ? "לבית" : "לעבודה"}: חפשו ובחרו מהרשימה</span><button type="button" class="linkbtn" id="setCancel">ביטול</button></div>` : ""}
      <div class="search"><input id="goQ" type="search" enterkeyhint="search" autocomplete="off" placeholder="${NAVQ.setFor ? "הכתובת המלאה, למשל: שדרות רוטשילד 1, תל אביב" : "כתובת, מקום, יישוב או צומת"}" value="${esc(NAVQ.q)}" aria-label="חיפוש יעד"><div class="sres" id="goRes">${navResultsHtml()}</div></div>
      ${navTripCard()}
      <div class="gquick">${qb("gqHome", HOME, "הביתה", P.home ? esc(P.home.name) : "לחצו להגדרה", P.home ? "home" : "")}${qb("gqWork", WORK, "לעבודה", P.work ? esc(P.work.name) : "לחצו להגדרה", P.work ? "work" : "")}${qb("gqFuel", FUEL, "דלק קרוב", "לפי המיקום")}${qb("gqHelp", WRENCH, "עזרה בדרך", "מוסך, צמיג, גרר")}${st.park ? qb("gqPark", PWI.moto, "לאופנוע", "איפה חניתי") : ""}</div>
      ${rec.length ? `<div class="card"><h3>אחרונים</h3><div class="list golist">${rec.slice(0, 6).map((x, i) => `<button type="button" class="gli" data-rec="${i}"><span class="grow"><b>${esc(x.name)}</b><span class="small muted">${esc(x.sub || "")}</span></span><span class="small muted">${st.me ? `${Math.round(L.hav([st.me.lon, st.me.lat], [x.lon, x.lat]))} ק״מ` : ""}</span></button>`).join("")}</div></div>` : ""}
      ${st.myRoutes.length ? `<div class="card"><h3>המסלולים שלי</h3><div class="list golist">${st.myRoutes.slice(-4).reverse().map(u => `<button type="button" class="gli" data-mr="${esc(u.id)}"><span class="grow"><b>${esc(u.title)}</b><span class="small muted">${u.stops.length} נקודות${u.shared ? " · התקבל בשיתוף" : ""}</span></span><span class="small muted">פתיחה</span></button>`).join("")}</div></div>` : ""}
      <button type="button" class="gowk" id="goWeekend"><span><b>מתכננים רכיבת סוף שבוע?</b><span class="small muted">תדריך, פרקים מפותלים ותחזית לכל עצירה</span></span><span aria-hidden="true">←</span></button>
      ${riding ? "" : `<p class="small muted" style="margin:0">החיפוש והניווט עובדים בכל הארץ. בית, עבודה והיעדים האחרונים נשמרים רק בטלפון שלך.</p>`}</div>`;
    p.innerHTML = h; bindGo();
  }
  function goSearchAt() { return st.me ? { lat: st.me.lat, lon: st.me.lon } : null; }
  function bindGo() {
    const q = $("goQ"); if (!q) return;
    const refresh = () => { const el = $("goRes"); if (!el) return; el.innerHTML = navResultsHtml(); el.querySelectorAll("[data-go]").forEach(b => b.onclick = () => pickResult(NAVQ.results[+b.dataset.go])); };
    const pickResult = r => { if (!r) return; NAVQ.q = ""; NAVQ.results = [];
      if (NAVQ.setFor) { const P2 = navPlaces(), k = NAVQ.setFor; P2[k] = { name: r.name, sub: r.sub || "", lat: +r.lat, lon: +r.lon }; LS.set("navPlaces", P2); NAVQ.setFor = null; toast(k === "home" ? "הבית עודכן" : "העבודה עודכנה"); renderGo(); return; }
      navTo({ name: r.name, sub: r.sub, lat: r.lat, lon: r.lon }); };
    q.oninput = () => {
      NAVQ.q = q.value; NAVQ.results = localSearch(NAVQ.q); NAVQ.searching = NAVQ.q.trim().length >= 2; refresh();
      clearTimeout(bindGo.t); if (NAVQ.q.trim().length < 2) return;
      bindGo.t = setTimeout(async () => { try { const rem = await remoteSearch(NAVQ.q, goSearchAt()); const loc = localSearch(NAVQ.q); NAVQ.results = rem.concat(loc.filter(l => !rem.some(r => L.hav([l.lon, l.lat], [r.lon, r.lat]) < 0.2))).slice(0, 10); } catch (e) { return; } NAVQ.searching = false; refresh(); }, 300);
    };
    const mic = micFor(q, () => q.oninput()); if (mic) q.parentNode.insertBefore(mic, q.nextSibling);
    q.onkeydown = e => { if (e.key === "Enter" && NAVQ.results[0]) { e.preventDefault(); pickResult(NAVQ.results[0]); } };
    q.onfocus = () => { if (innerWidth < 900 && st.sheet !== "full") setSheet("full"); };
    refresh();
    const P = navPlaces();
    const setMode = k => { NAVQ.setFor = k; renderGo(); const q2 = $("goQ"); if (q2) q2.focus(); };
    $("gqHome").onclick = () => P.home ? navTo(P.home) : setMode("home");
    $("gqWork").onclick = () => P.work ? navTo(P.work) : setMode("work");
    if ($("setCancel")) $("setCancel").onclick = () => { NAVQ.setFor = null; renderGo(); };
    $("p-go").querySelectorAll("[data-edit]").forEach(b => b.onclick = () => placeSheet(b.dataset.edit, setMode));
    $("gqFuel").onclick = () => fuelNearMe();
    $("gqHelp").onclick = () => helpSheet();
    if ($("gqPark")) $("gqPark").onclick = () => walkStart();
    $("p-go").querySelectorAll("[data-rec]").forEach(b => b.onclick = () => navTo(navRecent()[+b.dataset.rec]));
    $("p-go").querySelectorAll("[data-mr]").forEach(b => b.onclick = () => { setChap(b.dataset.mr); setTab("route"); });
    $("goWeekend").onclick = () => setTab("brief");
    if ($("navX")) $("navX").onclick = () => { navClear(); fitChapter(); };
    if ($("navGo")) $("navGo").onclick = () => { if (st.ride) return toast("כבר במצב רכיבה"); startRide(); };
    if ($("navSave")) $("navSave").onclick = navSave;
    if ($("navShare")) $("navShare").onclick = () => { const c = navChapter(); if (c) shareRoute(c); };
    if ($("navHome")) $("navHome").onclick = () => navSetPlace("home");
    if ($("navWork")) $("navWork").onclick = () => navSetPlace("work");
    if ($("navNoHw")) $("navNoHw").onchange = e => { const P2 = navPlaces(); P2.noHw = e.target.checked; LS.set("navPlaces", P2); if (st.nav) navTo(st.nav.dest, { noHighway: e.target.checked }); };
  }

  /* ---------- turn-by-turn steps from OSRM ---------- */
  async function loadSteps(c, route) {
    const key = "steps:v2:" + routeKey(c); const cached = c.nav ? null : LS.get(key, null); if (cached) return cached;
    try {
      const j = await (await fetch(osrmUrl(c, "&steps=true"))).json(); if (j.code !== "Ok") throw 0;
      const legs = j.routes[0].legs; const out = []; let from = 0; const coords = route.coords, cum = route.cum;
      legs.forEach((lg, li) => lg.steps.forEach(sp => {
        const m = sp.maneuver; if (m.type === "depart" && li > 0) return; if (m.type === "arrive" && li < legs.length - 1) { out.push(stepRec(m, sp, false)); return; }
        out.push(stepRec(m, sp, li === legs.length - 1));
      }));
      function stepRec(m, sp, last) { const loc = m.location; let bi = from, bd = 1e9; for (let i = from; i < coords.length; i++) { const d = (coords[i][0] - loc[0]) ** 2 + (coords[i][1] - loc[1]) ** 2; if (d < bd) { bd = d; bi = i; } if (d > bd * 400 && i > bi + 400) break; } from = bi;
        return { km: +cum[bi].toFixed(3), type: m.type, modifier: m.modifier || "", exit: m.exit || 0, name: sp.name || "", ref: sp.ref || "", last }; }
      if (!c.nav) LS.set(key, out); return out;
    } catch (e) { return null; }
  }
  /* Voice: Hebrew speech when the phone has a Hebrew voice. */
  let heVoice = null;
  const pickVoice = () => { try { heVoice = speechSynthesis.getVoices().find(v => /^he|iw/i.test(v.lang)) || null; } catch (e) { } };
  if ("speechSynthesis" in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
  /* Phones only let a page talk once a tap has started speech, so the first sentence must be spoken inside
     the tap itself (startRide does that before any await). Chrome also drops an utterance queued in the same
     tick as cancel(), and pauses the engine after long silence: both handled here. */
  function say(text) {
    if (!st.voice || !("speechSynthesis" in window)) return;
    try {
      const S = speechSynthesis; if (!heVoice) pickVoice(); if (S.paused) S.resume();
      const u = new SpeechSynthesisUtterance(text); u.lang = "he-IL"; if (heVoice) u.voice = heVoice; u.rate = 1.02;
      if (S.speaking || S.pending) { S.cancel(); setTimeout(() => S.speak(u), 90); } else S.speak(u);
    } catch (e) { }
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
  function renderTools() { return paneSafe("tools", renderTools_); }
  function renderTools_() {
    const off = LS.get("offline", null); const ios = /iphone|ipad|ipod/i.test(navigator.userAgent); const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
    let h = `<h2>כלים</h2>
    <div class="card"><h3>מפות אופליין למסלולים</h3><p class="small muted" style="margin:0">מוריד את המפה סביב המסלולים עד רמת רחוב, את הפרקים בפירוט מלא ואת התבליט. עד כ־50MB, כדאי ב־Wi-Fi.</p><div class="progress"><span id="offBar" style="width:${off ? 100 : 0}%"></span></div><div class="row"><button type="button" class="btn primary" id="offGo">${off ? "עדכון ההורדה" : "הורדה לאופליין"}</button><span class="small muted" id="offTxt">${off ? `${off.n} אריחים · ${ago(off.ts)}` : "עוד לא הורד"}</span></div></div>
    <div class="card"><h3>התקנה כאפליקציה</h3>${standalone ? '<p class="small muted" style="margin:0">האפליקציה מותקנת.</p>' : installEvt ? '<button type="button" class="btn primary" id="instGo">התקנה למסך הבית</button>' : ios ? '<p class="small muted" style="margin:0">באייפון: כפתור השיתוף בספארי ← ״הוספה למסך הבית״.</p>' : '<p class="small muted" style="margin:0">בתפריט הדפדפן: ״התקנת אפליקציה״ או ״הוספה למסך הבית״.</p>'}</div>
    <div class="card"><h3>תזכורת תדריך שבתית</h3><p class="small muted" style="margin:0">אירוע חוזר ביומן בכל שישי ב־20:00 עם קישור לתדריך. עובד ביומן גוגל, אאוטלוק ואייפון.</p><div class="row"><button type="button" class="btn" id="icsGo">הוספה ליומן</button></div></div>
    <div class="card"><h3>שיתוף ודיווח לחבר׳ה</h3><div class="row"><button type="button" class="btn" id="shareGo">שיתוף האפליקציה</button><a class="btn" target="_blank" rel="noopener" href="${LIVE_BOARD}">לוח הדיווחים החי</a></div>
      <label for="repType" class="small muted">דיווח מהיר מהמיקום שלך לוואטסאפ</label><div class="row"><select id="repType" class="btn"><option>ניידת / ממל״ז</option><option>מצלמה ניידת / לייזר</option><option>חצץ או שמן על הכביש</option><option>עבודות / חסימה</option><option>כביש סגור</option><option>נקודת עצירה מומלצת</option></select><button type="button" class="btn primary" id="repGo">שליחה</button><button type="button" class="btn" id="repPhoto">${PWI.cam}עם תמונה</button></div></div>
    ${st.flags.feedback ? `<div class="card"><h3>משוב לצוות</h3><p class="small muted" style="margin:0">תקלה, רעיון, מידע שגוי או מפגע בדרך. מגיע ישירות לצוות ולא מוצג לאחרים עד שנבדק.</p><div class="row"><select id="fbKind" class="btn"><option value="bug">תקלה</option><option value="idea">רעיון</option><option value="data">מידע שגוי</option><option value="hazard">מפגע בדרך (עם מיקום)</option></select></div><textarea id="fbText" class="fbtext" maxlength="1000" rows="3" placeholder="מה קרה, איפה, ומה ציפיתם שיקרה"></textarea><div class="fbmedia"><button type="button" class="btn sm" id="fbPhoto">${PWI.cam}תמונה</button><button type="button" class="btn sm" id="fbVoice">${PWI.mic}הקלטה</button><span id="fbAtt" class="fbmedia"></span></div><div class="row"><button type="button" class="btn primary" id="fbGo">שליחה</button></div><div id="fbRes" aria-live="polite"></div></div>` : ""}
    <div class="card" id="pushCard"><h3>התראות לטלפון</h3><p class="small muted" style="margin:0">טוען…</p></div>
    <div class="card"><h3>תצוגה ונתונים</h3><div class="row"><label for="themeSel" class="small muted">ערכת צבע</label><select id="themeSel" class="btn"><option value="system">לפי המכשיר</option><option value="dark">לילה</option><option value="light">יום</option></select></div><label class="toggle small"><input type="checkbox" id="introSnd" ${LS.get("introSound", true) ? "checked" : ""}> צליל הנעה בפתיחת האפליקציה</label><div class="row"><button type="button" class="btn" id="refAll">רענון כל הנתונים</button></div><p class="small muted" style="margin:0">מזג אוויר: ${st.wx ? ago(st.wx.ts) : "—"} · OSM: ${st.osm ? ago(st.osm.ts) : "—"} · מסלולים: OSRM, נשמרים במכשיר</p></div>
    <div class="card"><h3>נשארים בקשר</h3><p class="small muted" style="margin:0">תדריך סופ״ש כל חמישי בוואטסאפ, סרטוני מסלולים, ורשימת ההמתנה להשקה בחנויות.</p><div class="row"><a class="btn primary" target="_blank" rel="noopener" href="https://whatsapp.com/channel/0029VbDmkfmBVJl8sVPC2f0m">ערוץ התדריך בוואטסאפ</a><a class="btn" href="join?src=app">רשימת ההמתנה</a><a class="btn" target="_blank" rel="noopener" href="https://www.instagram.com/blueroninapp/">אינסטגרם</a><a class="btn" target="_blank" rel="noopener" href="https://www.youtube.com/@blueroninapp">יוטיוב</a><a class="btn" target="_blank" rel="noopener" href="https://www.tiktok.com/@blueroninapp">טיקטוק</a><a class="btn" target="_blank" rel="noopener" href="https://www.facebook.com/blueroninapp/">פייסבוק</a></div></div>
    <div class="small muted legal"><a href="privacy.html">מדיניות פרטיות</a> · <a href="terms.html">תנאי שימוש</a> · <button type="button" class="linkbtn" id="creditsGo">מקורות המידע</button> · גרסה ${APP_VER}</div>`;
    $("p-tools").innerHTML = h;
    $("offGo").onclick = downloadOffline;
    if ($("instGo")) $("instGo").onclick = async () => { installEvt.prompt(); await installEvt.userChoice; installEvt = null; renderTools(); };
    if ($("fbGo")) { $("fbGo").onclick = sendFeedback; st.fbAtt = st.fbAtt || {}; paintFbAtt();
      /* the draft survives leaving the tab (or the app): a rider often goes to check where the problem was */
      { const d = LS.get("fbDraft", null); if (d) { if (d.text) $("fbText").value = d.text; if (d.kind) $("fbKind").value = d.kind; }
        const save = () => LS.set("fbDraft", { text: $("fbText").value, kind: $("fbKind").value, t: Date.now() }); $("fbText").addEventListener("input", save); $("fbKind").addEventListener("change", save); }
      $("fbPhoto").onclick = async () => { const [f] = await pickFile({}); if (!f) return; try { const im = await decodeImg(f); let q = 0.8, b = await toJpeg(im, 1400, q); while (b.size > 560 * 1024 && q > 0.4) { q -= 0.15; b = await toJpeg(im, 1100, q); } try { im.close && im.close(); } catch (e) { } st.fbAtt.photo = b; paintFbAtt(); } catch (e) { toast(e.message); } };
      $("fbVoice").onclick = async () => { const b = await recordVoice(60); if (b) { if (b.size > 680 * 1024) return toast("ההקלטה ארוכה מדי"); st.fbAtt.voice = b; paintFbAtt(); } }; }
    $("repPhoto").onclick = reportPhoto;
    $("creditsGo").onclick = () => openModal(`<h2>מקורות המידע</h2><p class="small" style="margin:0">מפה: OpenFreeMap ו־© OpenStreetMap contributors (ODbL). מזג אוויר וגבהים: Open-Meteo (CC BY 4.0). מכ״ם: RainViewer. ניתוב: OSRM. תבליט: Mapzen/AWS Terrain Tiles. שקיעה וזריחה: SunCalc. תמונות: Mapillary ו־Wikimedia Commons, עם קרדיט לכל צילום. בתי קפה מומלצים: טיולי, mako, מעריב. אכיפה: וואלה (2012), ynetnews (2026).</p>`);
    $("icsGo").onclick = ics; $("shareGo").onclick = share; $("repGo").onclick = report; renderPush();
    $("themeSel").value = st.theme; $("themeSel").onchange = e => { st.theme = e.target.value; LS.set("theme", st.theme); applyTheme(); const want = isDark() ? "dark" : "liberty"; if (want !== styleName) { styleName = want; styleReady = false; map.setStyle(OFM + styleName, { diff: false }); } };
    $("introSnd").onchange = e => { LS.set("introSound", e.target.checked); toast(e.target.checked ? "הצליל יתנגן בפתיחה הבאה" : "הפתיחה תהיה שקטה"); };
    $("refAll").onclick = () => { loadWeather(true); loadOSM(true); loadCrowd(true); };
  }
  function paintFbAtt() { const a = st.fbAtt || {}, box = $("fbAtt"); if (!box) return; box.innerHTML = (a.photo ? `<img src="${URL.createObjectURL(a.photo)}" alt="תמונה מצורפת"><button type="button" class="linkbtn small" data-fx="photo">הסרה</button>` : "") + (a.voice ? `<span class="chip">הקלטה ${Math.round(a.voice.size / 1024)}KB</span><button type="button" class="linkbtn small" data-fx="voice">הסרה</button>` : ""); box.querySelectorAll("[data-fx]").forEach(b => b.onclick = () => { delete st.fbAtt[b.dataset.fx]; paintFbAtt(); }); }
  const b64of = blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); });
  async function sendFeedback() {
    const kind = $("fbKind").value, text = $("fbText").value.trim(); if (text.length < 3) return toast("כתבו כמה מילים");
    const a = st.fbAtt || {}, photo = a.photo ? await b64of(a.photo) : undefined, voice = a.voice ? await b64of(a.voice) : undefined;
    const post = async (lat, lon) => { $("fbGo").disabled = true; $("fbRes").textContent = photo || voice ? "שולח…" : ""; try { const r = await fetch("/api/feedback", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind, text, lat, lon, chap: st.chap, ver: APP_VER, photo, voice }) }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || "השליחה נכשלה"); $("fbText").value = ""; try { localStorage.removeItem("brn:fbDraft"); } catch (e) { } st.fbAtt = {}; paintFbAtt();
        $("fbRes").innerHTML = `<div class="fbok" role="status"><span class="ck">✓</span><div><b>הדיווח התקבל. תודה!</b><span class="small">${j.ref ? `מספר פנייה <b class="mono" dir="ltr">${esc(j.ref)}</b> · ` : ""}הצוות קורא כל דיווח${kind === "bug" ? " ומטפל בתקלות לפי דחיפות" : ""}.</span></div></div>`;
        try { navigator.vibrate && navigator.vibrate(60); } catch (e) { } $("fbRes").scrollIntoView({ block: "nearest", behavior: "smooth" }); toast("הדיווח נשלח ✓");
      } catch (e) { $("fbRes").innerHTML = `<div class="fberr" role="alert">${esc(e.message || "אין חיבור")}. הטקסט נשמר, אפשר לנסות שוב.</div>`; } $("fbGo").disabled = false; };
    if (kind === "hazard" && navigator.geolocation) navigator.geolocation.getCurrentPosition(p => post(p.coords.latitude, p.coords.longitude), () => { const c = map.getCenter(); post(c.lat, c.lng); }, { timeout: 6000, enableHighAccuracy: true });
    else post(undefined, undefined);
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
    const url = (location.origin || NEW_HOME) + "/#brief";
    /* first occurrence = the coming Friday 20:00 Israel time (today if it is Friday before 20:00) */
    const now = new Date(), il = new Date(now.toLocaleString("en-US", { timeZone: TZ })), add = ((5 - il.getDay()) + 7) % 7 || (il.getHours() >= 20 ? 7 : 0);
    const fri = new Date(il.getFullYear(), il.getMonth(), il.getDate() + add), ymd = `${fri.getFullYear()}${String(fri.getMonth() + 1).padStart(2, "0")}${String(fri.getDate()).padStart(2, "0")}`;
    const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
    const s = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Blue Ronin//HE", "BEGIN:VEVENT", `UID:blue-ronin-brief@${location.host || "app"}`, `DTSTAMP:${stamp}`, `DTSTART;TZID=Asia/Jerusalem:${ymd}T200000`, "DURATION:PT15M", "RRULE:FREQ=WEEKLY;BYDAY=FR", "SUMMARY:Blue Ronin · תדריך שבת", `DESCRIPTION:מזג אוויר\\, ערפל\\, סנוור ופרק מומלץ לשבת: ${url}`, `URL:${url}`, "BEGIN:VALARM", "TRIGGER:PT0M", "ACTION:DISPLAY", "DESCRIPTION:תדריך שבת", "END:VALARM", "END:VEVENT", "END:VCALENDAR"].join("\r\n");
    saveFile("blue-ronin-shabbat.ics", s, "text/calendar"); toast("פתחו את הקובץ כדי להוסיף ליומן");
  }
  async function share() { const d = { title: "Blue Ronin Navigator", text: "הנביגטור של רוכבי הדו־גלגלי בישראל: ניווט יומיומי ומסלולי סוף שבוע", url: location.href.split("#")[0] }; try { if (navigator.share) await navigator.share(d); else { await navigator.clipboard.writeText(d.url); toast("הקישור הועתק"); } } catch (e) { } }
  function report() {
    const type = $("repType").value;
    const send = (lat, lon, src) => { const txt = `Blue Ronin · ${type}\n${src}\nWaze: https://waze.com/ul?ll=${lat.toFixed(5)},${lon.toFixed(5)}\n${new Intl.DateTimeFormat("he-IL", { hour: "2-digit", minute: "2-digit", timeZone: TZ }).format(new Date())}`; const u = "https://wa.me/?text=" + encodeURIComponent(txt); const w = window.open(u, "_blank"); if (!w) location.href = u; };
    if (navigator.geolocation) navigator.geolocation.getCurrentPosition(p => send(p.coords.latitude, p.coords.longitude, "מהמיקום שלי"), () => { const c = map.getCenter(); send(c.lat, c.lng, "מרכז המפה"); }, { timeout: 6000, enableHighAccuracy: true });
    else { const c = map.getCenter(); send(c.lat, c.lng, "מרכז המפה"); }
  }

  /* quick report to the group, with a photo straight from the camera */
  function reportPhoto() {
    const type = $("repType").value;
    pickFile({ capture: true }).then(async ([f]) => { if (!f) return; let pos = null; try { pos = await getPosFresh(6000); } catch (e) { }
      const img = await shrink(f, 1600, 0.82).catch(() => null); if (!img) return toast("התמונה לא נתמכת");
      const txt = `Blue Ronin · ${type}${pos ? `\nWaze: https://waze.com/ul?ll=${pos[1].toFixed(5)},${pos[0].toFixed(5)}` : ""}\n${fmtT(new Date())}`, file = new File([img], "blue-ronin-report.jpg", { type: "image/jpeg" });
      try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text: txt }); return; } } catch (e) { if (e.name === "AbortError") return; }
      saveBlob(file.name, img); const u = "https://wa.me/?text=" + encodeURIComponent(txt); const w = window.open(u, "_blank"); if (!w) location.href = u; toast("התמונה נשמרה. צרפו אותה בוואטסאפ"); });
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
      LS.set("offline", { ts: Date.now(), n: ok }); $("offTxt").textContent = `${ok} אריחים נשמרו`; toast("המפה שמורה במכשיר. המפה תעבוד גם בלי קליטה.");
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

  function startFly(opts) {
    if (st.fly) return stopFly();
    const o = opts && opts.coords ? opts : null;
    const c = o ? { id: "replay", title: "שחזור · " + o.title } : chap(), r = o ? null : st.routes[st.chap]; if (!o && !r) return;
    const coords = o ? o.coords : r.coords, km0 = o ? o.replay.cum[o.replay.cum.length - 1] : r.km;
    const P = L.flyPath(coords, km0 > 250 ? 0.025 : 0.015);
    const segs = o ? L.curveSegments(coords) : (st.curves[st.chap] || []); const cls = new Uint8Array(P.n);
    for (let i = 0, si = 0; i < P.n; i++) { const km = i * P.step; while (si < segs.length - 1 && segs[si].startKm + segs[si].km < km) si++; cls[i] = segs[si] ? segs[si].cls : 0; }
    const base = Math.min(2.4, Math.max(0.5, P.km / 85));
    const el = document.createElement("div"); el.className = "bike"; el.innerHTML = BIKE_SVG;
    const cam = map.getCenter();
    st.fly = { c, P, cls, E: o ? null : st.elev[st.chap], km: 0, cap: isPro() ? Infinity : FLY_FREE, replay: o ? Object.assign(o.replay, { scale: km0 / P.km }) : null, rate: LS.get("flyRate", 1), playing: false, loading: true, last: null, base, v: 0, uiT: 0, trT: 0, pfKm: -99, tpl: tileTemplates(),
      brg: { x: map.getBearing(), v: 0 }, bh: { x: P.head[0], v: 0 }, zoom: { x: map.getZoom(), v: 0 }, pitch: { x: map.getPitch(), v: 0 },
      from: [cam.lng, cam.lat], blend: 0, prevExag: st.terrain ? 1.5 : null,
      marker: new maplibregl.Marker({ element: el, rotationAlignment: "map", pitchAlignment: "map" }).setLngLat(P.pts[0]).addTo(map) };
    const F = st.fly;
    if (o && map.setSky) try { F.prevSky = map.getSky ? map.getSky() : null; map.setSky(skyFor(o.replay.ride.start)); } catch (e) { }
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
        if (F.km >= P.km * F.cap) { F.km = P.km * F.cap; F.playing = false; F.v = 0; flyUI(); setTimeout(() => openPaywall(F.replay ? "replay" : "fly"), 350); }
        if (F.km >= P.km - 0.002) { F.km = P.km; F.playing = false; F.v = 0; flyUI(); if (F.replay && !F.replay.endShown) { F.replay.endShown = true; setTimeout(() => st.fly === F && replayEnd(F), 900); } }
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
    if (ts - F.uiT > 200) { F.uiT = ts; flyInfo(i0); if (F.replay) replayPop(F); }
    F.raf = requestAnimationFrame(flyStep);
  }
  function flyInfo(i0) {
    const F = st.fly; if (!F) return; const P = F.P;
    let elv = ""; if (F.E && F.E.el) { const j = Math.min(F.E.el.length - 1, Math.round(F.km / F.E.km * (F.E.el.length - 1))); elv = ` · ${Math.round(F.E.el[j])} מ׳`; }
    if (F.loading) { $("flInfo").textContent = "טוען את הדרך מראש…"; return; }
    const dk = P.km < 40 ? 1 : 0, clock = F.replay ? ` · ${fmtT(new Date(replayClock(F)))}` : "";
    $("flInfo").textContent = `ק״מ ${F.km.toFixed(dk)} / ${P.km.toFixed(dk)}${clock}${elv} · ${L.CURVE_LABEL[F.cls[i0]]}`;
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
    if (!F.playing && F.km >= F.P.km * F.cap - 0.01) return openPaywall(F.replay ? "replay" : "fly");
    if (!F.playing) { const cm = map.getCenter(); F.from = [cm.lng, cm.lat]; F.blend = 0; F.brg.x = map.getBearing(); F.brg.v = 0; F.zoom.x = map.getZoom(); F.zoom.v = 0; F.pitch.x = map.getPitch(); F.pfKm = -99; }
    F.hold = false; F.playing = !F.playing; flyUI(); };
  $("flClose").onclick = () => stopFly(true);
  document.querySelectorAll("#flyui [data-rate]").forEach(x => x.onclick = () => { const F = st.fly; if (!F) return; F.rate = +x.dataset.rate; LS.set("flyRate", F.rate); flyUI(); });
  $("flSeek").addEventListener("input", e => { const F = st.fly; if (!F) return; flySeeking = true; F.km = e.target.value / 1000 * F.P.km; if (F.km > F.P.km * F.cap) { F.km = F.P.km * F.cap; e.target.value = Math.round(F.cap * 1000); if (!F.capT || Date.now() - F.capT > 4000) { F.capT = Date.now(); toast("המעוף החינמי מגיע עד 30% מהפרק. המעוף המלא ב־Pro"); } } F.snap = true; F.v = F.base * 0.5; F.pfKm = -99; warmAhead(F, F.km, F.km + 8); });
  $("flSeek").addEventListener("change", () => { flySeeking = false; });
  function stopFly(done) {
    const F = st.fly; if (!F) return;
    cancelAnimationFrame(F.raf); F.marker.remove(); st.fly = null; setSrc("br-fly", FC()); dropTileQueue(); renderMarkers();
    if (F.replay) { try { map.setSky && map.setSky(F.prevSky || {}); } catch (e) { } clearTimeout(F.replay.resume); $("rpPop").hidden = true; }
    map.setTerrain({ source: "dem", exaggeration: 1.5 });
    map.getCanvas().removeEventListener("pointerdown", flyTouch); document.body.classList.remove("flying");
    $("fFly").setAttribute("aria-pressed", "false"); flyUI(); map.setPadding({ top: 0, bottom: 0, left: 0, right: 0 });
    if (done) { if (F.replay) showRide(F.replay.ride); else fitChapter(1400); }
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
    say(c.nav ? "יוצאים לדרך. ניווט אל " + c.title : "מצב רכיבה פעיל. " + c.title); /* inside the tap, so the phone unlocks speech for the whole ride */
    unlockAudio(); if (st.sos.crash) askMotion().then(ok => { if (ok && st.ride) fallArm(); }); geoPause(); walkStop();
    st.ride = { c, G: guideFrom(c.stops, r, null), last: null, alerted: new Set(), spoke: new Set(), lock: null, odo: 0, lowWarned: false, offS: {}, rerouting: false, inT: null, terrMsg: null, trk: [], vmax: 0, moving: 0, lastT: 0 };
    loadSteps(c, r).then(s => { if (st.ride && st.ride.c === c) st.ride.G.steps = s; });
    try { st.ride.lock = await navigator.wakeLock.request("screen"); } catch (e) { }
    if (!st.ride) return;
    document.body.classList.add("riding"); guideShow(st.ride.G); foldAttrib(); $("hud").hidden = false; $("hudNextK").textContent = c.nav ? "יעד" : "העצירה הבאה"; requestAnimationFrame(hudMeasure); $("fRide").setAttribute("aria-pressed", "true"); $("hudVoice").setAttribute("aria-pressed", String(st.voice));
    if (!st.terrain) toggle3d(true);
    st.ride.watch = navigator.geolocation.watchPosition(onPos, () => toast("אין אות GPS"), { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 });
  }
  function stopRide() {
    if (!st.ride) return; navigator.geolocation.clearWatch(st.ride.watch); try { cancelAnimationFrame(st.ride.mkRaf); st.ride.mk && st.ride.mk.remove(); } catch (e) { } try { st.ride.lock && st.ride.lock.release(); } catch (e) { }
    try { speechSynthesis.cancel(); } catch (e) { }
    let done = null; try { done = saveRide(st.ride); } catch (e) { } LS.set("rideLive", null);
    fallDisarm(); try { const R0 = st.ride; if (R0.last && R0.odo > 0.3 && (R0.spd == null || R0.spd < 8)) setPark({ lat: R0.last.p[1], lon: R0.last.p[0], acc: st.meAcc }, true); } catch (e) { }
    if (done) setTimeout(() => rideSummary(done), 500);
    if (st.updWaiting) setTimeout(() => updBar("גרסה חדשה מוכנה", { btn: "עדכון עכשיו", go: () => location.reload() }), done ? 1200 : 300);
    st.ride = null; guideHide(); geoResume(); if (st.live) { liveFlush("stopped"); setTimeout(() => updBar("שיתוף המיקום החי עדיין פעיל", { btn: "הפסקה", go: () => { $("updbar").hidden = true; liveStop(); }, ms: 20000 }), 2500); } $("hudCenter").hidden = true; $("hudEta").textContent = ""; $("hudArrT").textContent = "--:--"; $("hudArrL").textContent = ""; document.body.classList.remove("riding"); $("hud").hidden = true; $("turn").hidden = true; $("fRide").setAttribute("aria-pressed", "false"); map.setPadding({ top: 0, bottom: 0, left: 0, right: 0 }); fitChapter();
  }
  function ridePad() { const land = innerWidth > innerHeight && innerHeight <= 560 && innerWidth <= 1000; if (land && st.ride) { const hw = $("hud") ? $("hud").getBoundingClientRect().width : 330; return { top: 40, bottom: 40, left: 20, right: Math.min(innerWidth * 0.5, hw + 24) }; } const h = $("hud"), wide = innerWidth >= 900, H = h && !h.hidden ? h.getBoundingClientRect().height : 230; return wide ? { top: 120, bottom: 60, left: 20, right: Math.min(innerWidth * 0.45, 500) } : { top: 150, bottom: Math.max(120, Math.min(H - 40, innerHeight * 0.45)), left: 20, right: 20 }; }
  function nearestOn(G, me) { const r = L.nearestOnLine(G.coords, G.cum, G.idx, me); G.idx = r.i; return { km: r.km, d: r.d }; }
  async function reroute(me) {
    const R = st.ride; if (!R || R.rerouting) return; R.rerouting = true; R.offS.lastAt = Date.now();
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
      R.G = { coords, cum, stops: rest, stopKm, steps, idx: 0 }; R.spoke = new Set(); R.offS = { lastAt: Date.now() }; guideShow(R.G);
      /* spoken once; a second reroute within two minutes only shows a quiet note */
      if (Date.now() - (R.rrSaid || 0) > 120000) { R.rrSaid = Date.now(); say("מחשב מסלול מחדש"); }
      toast("המסלול עודכן מהמיקום שלך", 2200);
    } catch (e) { if (st.ride && Date.now() - (st.ride.rrFail || 0) > 120000) { st.ride.rrFail = Date.now(); toast("אין חיבור לחישוב מסלול חדש. ממשיכים במסלול המקורי", 3500); } }
    finally { if (st.ride) st.ride.rerouting = false; }
  }
  /* Ride extras: arrival call-outs, remaining distance and ETA, spoken sharp-curve warnings, sunset race. */
  function rideExtras(R, G, me, myKm, near, spd) {
    const name = s => s.name.split(" · ")[0];
    if (near.d < 0.3) G.stopKm.forEach((k, i) => { if (i === 0 || R.alerted.has("st" + i) || myKm < k - 0.06) return; R.alerted.add("st" + i); if (myKm - k > 1) return; const nx = G.stops[i + 1]; say(nx ? `הגעתם ל${name(G.stops[i])}. הבא: ${name(nx)}, בעוד ${distSpeak(G.stopKm[i + 1] - k)}` : R.c.nav ? `הגעתם ליעד, ${name(G.stops[i])}` : `הגעתם ל${name(G.stops[i])}. סוף הפרק. רכיבה טובה`); });
    const total = G.cum[G.cum.length - 1], left = Math.max(0, total - myKm), r = st.routes[R.c.id];
    const pace = r && r.km > 0 ? r.min / r.km : 1.2, avg = R.moving > 300 && R.odo > 3 ? 60 * R.moving / 3600 / R.odo : pace;
    const mins = left * Math.max(pace * 0.8, Math.min(pace * 1.6, avg)), eta = new Date(Date.now() + mins * 6e4);
    const kmT = `${left < 10 ? left.toFixed(1) : Math.round(left)} ק״מ`, mR = Math.max(1, Math.round(mins)), minT = mR < 60 ? `${mR} דק׳` : `${Math.floor(mR / 60)}:${String(mR % 60).padStart(2, "0")} שע׳`;
    $("hudEta").innerHTML = left > 0.2 ? `הגעה <b>${fmtT(eta)}</b> · ${kmT} · ${minT}` : "";
    $("hudArrT").textContent = left > 0.2 ? fmtT(eta) : "הגעתם"; $("hudArrL").textContent = left > 0.2 ? `${kmT} · ${minT}` : "";
    if (G.coords === r.coords) { const seg = (st.curves[R.c.id] || []).find(x => x.cls >= 3 && x.startKm > myKm && x.startKm - myKm < (spd && spd > 70 ? 0.45 : 0.32)); if (seg && !R.alerted.has("cv" + seg.startKm.toFixed(2))) { R.alerted.add("cv" + seg.startKm.toFixed(2)); say(`עיקול חד בעוד ${distSpeak(seg.startKm - myKm)}`); } }
    if (!R.sunChk || Date.now() - R.sunChk > 6e4) { R.sunChk = Date.now(); const ss = SunCalc.getTimes(new Date(), me[1], me[0]).sunset, toSet = (ss - Date.now()) / 6e4; if (toSet > 0 && toSet < 45 && mins > toSet && !R.alerted.has("sun")) { R.alerted.add("sun"); say(`השקיעה בעוד ${Math.round(toSet)} דקות, ונשארו ${Math.round(left)} קילומטר. שימו לב לראות ולהיראות`); } }
  }
  map.on("dragstart", e => { if (!st.ride || !e.originalEvent) return; st.ride.free = Date.now(); $("hudCenter").hidden = false; });
  $("hudCenter").onclick = () => { if (st.ride) { st.ride.free = 0; $("hudCenter").hidden = true; if (st.me) map.easeTo({ center: [st.me.lon, st.me.lat], zoom: 15, pitch: 55, duration: 600, padding: ridePad() }); } };
  /* the screen lock is dropped whenever the app goes to the background; take it again on return */
  document.addEventListener("visibilitychange", async () => { if (document.visibilityState !== "visible" || !st.ride) return; try { if (!st.ride.lock || st.ride.lock.released) st.ride.lock = await navigator.wakeLock.request("screen"); } catch (e) { } try { speechSynthesis.paused && speechSynthesis.resume(); } catch (e) { } });
  /* the rider on the map during a ride: the same motorcycle as the fly-through, lying on the map and turned to the
     direction of travel, gliding between GPS fixes instead of jumping (and the camera glides with it) */
  function rideMarker(R, me, head, dur) {
    if (!R.mk) { const el = document.createElement("div"); el.className = "bike ridebike"; el.innerHTML = BIKE_SVG; R.mk = new maplibregl.Marker({ element: el, rotationAlignment: "map", pitchAlignment: "map" }).setLngLat(me).setRotation(head || 0).addTo(map); R.mkPos = me; R.mkRot = head || 0; return; }
    const from = R.mkPos, r0 = R.mkRot, r1 = head != null && !isNaN(head) ? head : r0, dr = ((r1 - r0 + 540) % 360) - 180, t0 = performance.now();
    cancelAnimationFrame(R.mkRaf);
    const step = now => { const k = Math.min(1, (now - t0) / dur); const p = [from[0] + (me[0] - from[0]) * k, from[1] + (me[1] - from[1]) * k];
      R.mkPos = p; R.mkRot = (r0 + dr * k + 360) % 360; R.mk.setLngLat(p).setRotation(R.mkRot); if (k < 1 && st.ride === R) R.mkRaf = requestAnimationFrame(step); };
    R.mkRaf = requestAnimationFrame(step);
  }
  function onPos(p) {
    const R = st.ride; if (!R) return; const me = [p.coords.longitude, p.coords.latitude]; feed(p);
    let spd = p.coords.speed != null && p.coords.speed >= 0 ? p.coords.speed * 3.6 : null;
    if (spd == null && R.last) { const dt = (p.timestamp - R.last.t) / 3600e3; if (dt > 0) spd = L.hav(R.last.p, me) / dt; }
    let head = p.coords.heading; if ((head == null || isNaN(head)) && R.last && L.hav(R.last.p, me) > 0.01) head = L.bearing(R.last.p, me);
    if (R.last) { const step = L.hav(R.last.p, me); if (step < 1.5 && !(R.parkAuto && (spd == null || spd < 12))) R.odo += step; }
    R.spd = spd; R.spdT = Date.now(); fallSpeed(spd); try { parkWatch(R, me, spd); } catch (e) { }
    R.last = { p: me, t: p.timestamp };
    $("hudSpeed").textContent = spd != null ? Math.round(spd) : "--";
    const glide = Math.max(300, Math.min(1100, R.lastFixAt ? Date.now() - R.lastFixAt : 900)); R.lastFixAt = Date.now();
    try { rideMarker(R, me, head, glide); } catch (e) { }
    try { rideTrack(R, me, p, spd); } catch (e) { }
    const G = R.G; const near = nearestOn(G, me); const myKm = near.km;
    const ni = G.stopKm.findIndex(k => k > myKm + 0.08);
    if (ni >= 0) { $("hudNext").textContent = G.stops[ni].name.split(" · ")[0]; $("hudDist").textContent = distTxt(G.stopKm[ni] - myKm); } else { $("hudNext").textContent = "סוף המסלול"; $("hudDist").textContent = ""; }
    try { rideExtras(R, G, me, myKm, near, spd); } catch (e) { }
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
    if (!msg) for (const h of st.hazards) { const d = L.hav(me, [h.lon, h.lat]); if (d < 1.2 && (head == null || d < 0.15 || L.angDiff(head, L.bearing(me, [h.lon, h.lat])) < 60)) { msg = `${h.text} · בעוד ${Math.round(d * 1000)} מ׳`; cls = "cam"; if (!R.alerted.has("h" + h.id)) { R.alerted.add("h" + h.id); say("זהירות. " + h.text); try { navigator.vibrate && navigator.vibrate([250, 100, 250]); } catch (e) { } } break; } }
    if (!msg && tmsg) { msg = tmsg; cls = "terr"; }
    /* fuel: the same model as the planner — on the planned line by kilometre, after a reroute by odometer */
    const sim = fuelSimFor(st.chap);
    if (sim) {
      const fr = fuelRideState(), startL = sim.tank * st.bike.start / 100, rate = sim.burn / sim.total;
      const onPlan = G.coords === st.routes[R.c.id].coords;
      const litres = onPlan ? L.fuelLeftAt(sim.profile, myKm, startL, sim.tank, fr.refills) : startL - R.odo * rate;
      const toLow = Math.max(0, (litres - sim.reserve) / rate), pct = Math.max(0, Math.round(litres / sim.tank * 100));
      const hf = $("hudFuel"); hf.hidden = false; hf.style.setProperty("--f", pct + "%"); hf.style.setProperty("--fc", fuelColor(litres, sim.tank)); $("hudFuelT").textContent = `${pct}% · ${Math.round(toLow)} ק״מ`;
      if (!msg && toLow < 30) { const sat = shabbatNow(); const nxt = fuelAlong(st.chap, 1.5).find(f => f.km > myKm - 0.3 && (!sat || f.sat !== "closed")); const far = nxt && nxt.km - myKm > litres / rate; msg = nxt ? `דלק: עוד כ־${Math.round(toLow)} ק״מ עד הנורית. ${nxt.label} ${nxt.km - myKm < 0.3 ? "ממש כאן" : `בעוד ${(nxt.km - myKm).toFixed(1)} ק״מ`}${far ? " (מעבר לטווח)" : ""}` : `דלק: עוד כ־${Math.round(toLow)} ק״מ עד הנורית`; cls = "cam"; if (!R.lowWarned) { R.lowWarned = true; say(nxt ? `דלק נמוך. תחנה בעוד ${distSpeak(nxt.km - myKm)}` : "דלק נמוך"); try { navigator.vibrate && navigator.vibrate([400]); } catch (e) { } } }
    }
    const acc = p.coords.accuracy;
    if (L.offRoute(R.offS, near.d, acc, Date.now(), spd == null || spd > 4)) reroute(me);
    if (!msg && R.offS.n >= 2) msg = `מחוץ למסלול, ${near.d < 1 ? Math.round(near.d * 1000) + " מ׳" : near.d.toFixed(1) + " ק״מ"}`;
    guideProgress(R.G, myKm);
    if (!msg) { const seg = (st.curves[st.chap] || []).find(s => s.cls >= 2 && s.startKm > myKm && s.startKm - myKm < 1.6); if (seg && G.coords === st.routes[R.c.id].coords) { msg = `${L.CURVE_LABEL[seg.cls]} בעוד ${(seg.startKm - myKm).toFixed(1)} ק״מ`; cls = "curve"; } }
    const m = $("hudMsg"); m.hidden = !msg; if (msg) { m.textContent = msg; m.className = "hudmsg " + cls; }
    if (R.free && Date.now() - R.free < 15000) return; if (R.free) { R.free = 0; $("hudCenter").hidden = true; }
    map.easeTo({ center: me, bearing: head != null && !isNaN(head) ? head : map.getBearing(), pitch: 55, zoom: spd && spd > 80 ? 14.3 : 15, duration: glide, easing: t => t, padding: ridePad() });
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
  /* =====================================================================================
     "שלי" — safety (emergency contacts, SOS, fall detection), live location, the parked bike,
     ride memories (photos + voice), all in one personal tab.
     Honest limits, shown in the UI too: a web app works while it is open on screen (ride mode keeps the
     screen on). It cannot place a phone call or send an SMS by itself; contacts get a high-priority
     notification through the app, and the rider gets one-tap call / WhatsApp / SMS buttons.
     ===================================================================================== */
  const IL = p => { const d = String(p || "").replace(/[^\d+]/g, ""); if (/^0[2-9]\d{7,8}$/.test(d)) return "+972" + d.slice(1); if (/^972\d{8,9}$/.test(d)) return "+" + d; if (/^\+\d{9,15}$/.test(d)) return d; return ""; };
  const telOf = p => "tel:" + IL(p), waOf = (p, t) => `https://wa.me/${IL(p).replace("+", "")}?text=${encodeURIComponent(t)}`, smsOf = (p, t) => `sms:${IL(p)}${/iPhone|iPad/.test(navigator.userAgent) ? "&" : "?"}body=${encodeURIComponent(t)}`;
  const gmap = (lat, lon) => `https://maps.google.com/?q=${lat.toFixed(5)},${lon.toFixed(5)}`;
  st.sos = Object.assign({ name: "", phone: "", cName: "", cPhone: "", circle: "", key: "", crash: true, guards: [] }, LS.get("sos", {}) || {});
  const saveSos = () => LS.set("sos", st.sos);
  const post = async (url, b) => { const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }); const j = await r.json().catch(() => ({})); if (!r.ok) throw Object.assign(new Error(j.error || "אין חיבור"), { status: r.status }); return j; };

  /* ---------- one position feed for everything (ride mode has its own watch and forwards to this) ---------- */
  const geoSubs = new Set(); let geoW = null;
  function feed(p) { st.me = { lat: p.coords.latitude, lon: p.coords.longitude }; st.meTs = Date.now(); st.meAcc = p.coords.accuracy; geoSubs.forEach(f => { try { f(p); } catch (e) { } }); }
  function geoOn(f) { geoSubs.add(f); if (!st.ride && geoW == null && navigator.geolocation) geoW = navigator.geolocation.watchPosition(feed, () => { }, { enableHighAccuracy: true, maximumAge: 3000, timeout: 20000 }); }
  function geoOff(f) { geoSubs.delete(f); if (!geoSubs.size && geoW != null) { navigator.geolocation.clearWatch(geoW); geoW = null; } }

  /* ---------- live location ---------- */
  st.live = LS.get("live", null); if (st.live && st.live.exp < Date.now()) { st.live = null; LS.set("live", null); }
  let liveQ = [], liveT = null, liveLast = 0;
  const liveUrl = () => st.live ? `${location.origin}/live.html#${st.live.id}` : "";
  function livePush(p) { if (!st.live) return; const pt = [+p.coords.longitude.toFixed(5), +p.coords.latitude.toFixed(5), p.timestamp || Date.now(), p.coords.speed != null && p.coords.speed >= 0 ? Math.round(p.coords.speed * 3.6) : null, Math.round(p.coords.accuracy || 0)]; const prev = liveQ[liveQ.length - 1]; if (prev && L.hav(prev, pt) < 0.015 && pt[2] - prev[2] < 30000) return; liveQ.push(pt); if (Date.now() - liveLast > 15000) liveFlush(); }
  async function liveFlush(state) {
    if (!st.live) return; const pts = liveQ.splice(0); liveLast = Date.now();
    try { await post("/api/live/update", { id: st.live.id, key: st.live.key, pts, state: state || (st.sosOn ? "sos" : st.ride ? "riding" : "stopped"), park: st.park ? { lat: st.park.lat, lon: st.park.lon, t: st.park.t } : null }); }
    catch (e) { if (e.status === 404 || e.status === 403) { st.live = null; LS.set("live", null); geoOff(livePush); renderMeIf(); } else liveQ = pts.concat(liveQ).slice(-60); }
  }
  async function liveStart(silent) {
    if (st.live) return st.live;
    const j = await post("/api/live/start", { name: st.sos.name || "רוכב", chap: chap().title, phone: IL(st.sos.phone) });
    st.live = { id: j.id, key: j.key, exp: j.exp, since: Date.now() }; LS.set("live", st.live);
    geoOn(livePush); clearInterval(liveT); liveT = setInterval(() => liveFlush(), 20000); if (st.me) livePush({ coords: { latitude: st.me.lat, longitude: st.me.lon, accuracy: st.meAcc || 30, speed: null }, timestamp: Date.now() });
    setTimeout(() => liveFlush(), 600); if (!silent) toast("שיתוף המיקום החי פעיל"); renderMeIf(); return st.live;
  }
  async function liveStop() { if (!st.live) return; const L0 = st.live; await liveFlush("ended").catch(() => { }); try { await post("/api/live/stop", { id: L0.id, key: L0.key }); } catch (e) { } st.live = null; LS.set("live", null); clearInterval(liveT); geoOff(livePush); toast("שיתוף המיקום הופסק"); renderMeIf(); }
  async function liveShare() {
    try { await liveStart(true); } catch (e) { return toast(e.message); }
    const text = `${st.sos.name ? st.sos.name + " " : ""}רוכב עכשיו${st.ride ? " ב" + chap().title : ""}. המיקום שלי בזמן אמת: ${liveUrl()}`;
    try { if (navigator.share) { await navigator.share({ title: "המיקום שלי בזמן אמת", text }); return; } } catch (e) { if (e.name === "AbortError") return; }
    openModal(`<div class="ridesum"><h2>שיתוף מיקום חי</h2><p class="small" style="margin:0">הקישור פעיל עד ${fmtT(new Date(st.live.exp))} או עד שתפסיקו. מי שפותח אותו רואה איפה אתם ומתי עודכן לאחרונה.</p><input class="btn mono" dir="ltr" readonly value="${esc(liveUrl())}" id="lvUrl"><div class="row"><button type="button" class="btn primary" id="lvCopy">העתקה</button><a class="btn" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(text)}">וואטסאפ</a>${st.sos.cPhone ? `<a class="btn" target="_blank" rel="noopener" href="${waOf(st.sos.cPhone, text)}">ל${esc(st.sos.cName || "איש הקשר")}</a>` : ""}</div></div>`);
    $("lvCopy").onclick = () => navigator.clipboard.writeText(liveUrl()).then(() => toast("הועתק")).catch(() => $("lvUrl").select());
  }
  if (st.live) { geoOn(livePush); liveT = setInterval(() => liveFlush(), 20000); }

  /* ---------- emergency circle (contacts who get the alert on their phone) ---------- */
  async function ensureCircle() { if (st.sos.circle) return; const j = await post("/api/sos/circle", { name: st.sos.name || "רוכב" }); st.sos.circle = j.circle; st.sos.key = j.key; saveSos(); }
  async function sosGuards() { if (!st.sos.circle) return []; try { const j = await post("/api/sos/list", { circle: st.sos.circle, key: st.sos.key, name: st.sos.name }); st.sos.guards = j.guardians; saveSos(); } catch (e) { } return st.sos.guards; }
  async function sosInvite() {
    try { await ensureCircle(); const j = await post("/api/sos/invite", { circle: st.sos.circle, key: st.sos.key, name: st.sos.name }); return j.inv; } catch (e) { toast(e.message); return null; }
  }
  function sosText(kind, lat, lon) {
    const where = lat != null ? gmap(lat, lon) : "", live = st.live ? liveUrl() : "";
    return `${kind === "crash" ? "🚨 ייתכן שנפלתי מהאופנוע" : "🆘 צריך עזרה"}${st.sos.name ? " (" + st.sos.name + ")" : ""}.${where ? " המיקום שלי: " + where : ""}${live ? " מיקום חי: " + live : ""}`;
  }
  /* The alert itself: push to contacts + live location on, then a sheet with one-tap call / WhatsApp / SMS. */
  async function sosAlert(kind = "sos") {
    st.sosOn = kind !== "test"; if (kind !== "test") toast("שולח קריאת חירום…", 6000); let pos = null; try { pos = await getPosFresh(3500); } catch (e) { }
    const lat = pos ? pos[1] : st.me ? st.me.lat : null, lon = pos ? pos[0] : st.me ? st.me.lon : null;
    if (kind !== "test") { try { await liveStart(true); await liveFlush("sos"); } catch (e) { } if (st.group) gTick(); }
    let res = null, err = "";
    if (st.sos.circle) try { res = await post("/api/sos/alert", { circle: st.sos.circle, key: st.sos.key, kind, lat, lon, live: st.live ? st.live.id : "", phone: IL(st.sos.phone), name: st.sos.name }); } catch (e) { err = e.message; }
    if (kind === "test") { toast(res ? (res.sent ? `התראת בדיקה נשלחה ל־${res.sent} אנשי קשר` : "אין עדיין אנשי קשר מחוברים לקבלת התראות") : err || "לא נשלח"); return; }
    try { navigator.vibrate && navigator.vibrate([300, 120, 300]); } catch (e) { }
    const txt = sosText(kind, lat, lon), c = st.sos;
    openModal(`<div class="sos-sheet"><h2>${kind === "crash" ? "שלחנו התראת נפילה" : "קריאת חירום"}</h2>
      <p style="margin:0">${res ? (res.sent ? `התראה עם המיקום שלך נשלחה ל־${res.sent} ${res.sent === 1 ? "איש קשר" : "אנשי קשר"}.` : "אין עדיין איש קשר שמחובר לקבלת התראות. התקשרו או שלחו הודעה מכאן:") : `לא הצלחנו לשלוח התראה דרך האפליקציה${err ? " (" + esc(err) + ")" : ""}. התקשרו או שלחו הודעה מכאן:`}</p>
      ${lat != null ? `<p class="small muted mono" style="margin:0" dir="ltr">${lat.toFixed(5)}, ${lon.toFixed(5)}</p>` : ""}
      <a class="btn sosbig" href="tel:101">${PWI.phone}מד״א 101</a>
      ${c.cPhone ? `<a class="btn sosbig alt" href="${telOf(c.cPhone)}">${PWI.phone}התקשרות ל${esc(c.cName || "איש הקשר")}</a><div class="row"><a class="btn" target="_blank" rel="noopener" href="${waOf(c.cPhone, txt)}">וואטסאפ עם המיקום</a><a class="btn" href="${smsOf(c.cPhone, txt)}">SMS עם המיקום</a></div>` : `<button type="button" class="btn" id="sosSetup">הגדרת איש קשר לחירום</button>`}
      <div class="row"><a class="btn sm" href="tel:100">משטרה 100</a><a class="btn sm" href="tel:112">חירום 112</a><button type="button" class="btn sm" id="sosHelp">מוסך או גרר</button></div>
      <button type="button" class="btn" id="sosOk">אני בסדר, ביטול מצב חירום</button></div>`, "sosm");
    if ($("sosSetup")) $("sosSetup").onclick = () => { closeModal(); setTab("me"); };
    if ($("sosHelp")) $("sosHelp").onclick = () => { closeModal(); helpSheet(); };
    $("sosOk").onclick = async () => { st.sosOn = false; closeModal(); if (st.group) gTick(); if (res && res.sent && st.sos.circle) { try { await post("/api/sos/alert", { circle: st.sos.circle, key: st.sos.key, kind: "test", lat, lon, name: st.sos.name }); } catch (e) { } } liveFlush(st.ride ? "riding" : "stopped"); toast("מצב החירום בוטל"); };
  }
  /* A phone that stands still often stops sending position updates, so "old" is not "wrong": ask for a
     fresh fix, and if none comes in time, fall back to the last known one (up to 30 min). */
  function getPosFresh(ms = 8000) { return new Promise((res, rej) => {
    const last = st.me && st.meTs && Date.now() - st.meTs < 30 * 6e4 ? [st.me.lon, st.me.lat] : null;
    if (last && Date.now() - st.meTs < 15000) return res(last); if (!navigator.geolocation) return last ? res(last) : rej(new Error("no geo"));
    let done = false; const t = setTimeout(() => { if (done) return; done = true; last ? res(last) : rej(new Error("timeout")); }, ms + 500);
    navigator.geolocation.getCurrentPosition(p => { if (done) return; done = true; clearTimeout(t); feed(p); res([p.coords.longitude, p.coords.latitude]); }, e => { if (done) return; done = true; clearTimeout(t); last ? res(last) : rej(e); }, { enableHighAccuracy: true, timeout: ms, maximumAge: 30000 }); }); }

  /* ---------- fall detection (ride mode only, opt-in) ----------
     A hard hit alone is not enough (phones get dropped). We need: riding (> 25 km/h in the last 10 s),
     then a spike above ~3.5 g, then the bike stays still (< 5 km/h) for 12 s. Then a 30 s countdown with
     sound, vibration and voice; "אני בסדר" cancels. No answer → the alert goes out. */
  const FALL = { g: 3.5 * 9.81, still: 12000, count: 30 };
  let fall = null, audioCtx = null;
  function fallArm() {
    if (!st.sos.crash || fall) return; fall = { spike: 0, fastT: 0 };
    const onMotion = e => { const a = e.accelerationIncludingGravity || e.acceleration; if (!a || a.x == null) return; const m = Math.hypot(a.x, a.y, a.z); if (m > FALL.g && Date.now() - fall.fastT < 10000 && !fall.cd) { fall.spike = Date.now(); fall.spikeAt = st.me ? [st.me.lon, st.me.lat] : null; } };
    fall.onMotion = onMotion; addEventListener("devicemotion", onMotion);
    fall.tick = setInterval(() => { if (!fall || fall.cd || !fall.spike) return; const sp = st.ride && Date.now() - (st.ride.spdT || 0) < 5000 ? st.ride.spd : null; if (sp != null && sp > 8) { fall.spike = 0; return; } if (Date.now() - fall.spike > FALL.still) { fall.spike = 0; fallCountdown(); } }, 1000);
  }
  function fallDisarm() { if (!fall) return; removeEventListener("devicemotion", fall.onMotion); clearInterval(fall.tick); clearInterval(fall.cdT); fall = null; $("fallUI").hidden = true; }
  function fallSpeed(spd) { if (fall && spd != null && spd > 25) fall.fastT = Date.now(); }
  function beep() { try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); const o = audioCtx.createOscillator(), g = audioCtx.createGain(); o.type = "square"; o.frequency.value = 880; g.gain.value = 0.25; o.connect(g); g.connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime + 0.35); } catch (e) { } }
  function unlockAudio() { try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); audioCtx.resume(); } catch (e) { } }
  async function askMotion() { try { if (typeof DeviceMotionEvent !== "undefined" && typeof DeviceMotionEvent.requestPermission === "function") return (await DeviceMotionEvent.requestPermission()) === "granted"; } catch (e) { return false; } return true; }
  function fallCountdown(test) {
    if (!fall && !test) return; const F = fall || (fall = { test: true }); F.cd = true; let n = test ? 10 : FALL.count; const ui = $("fallUI"); ui.hidden = false; $("fallN").textContent = n;
    say("זוהתה נפילה. אם אתם בסדר, לחצו על אני בסדר"); try { navigator.vibrate && navigator.vibrate([600, 300, 600, 300, 600]); } catch (e) { }
    const done = () => { clearInterval(F.cdT); ui.hidden = true; F.cd = false; if (F.test) fall = null; };
    $("fallOk").onclick = () => { done(); toast("טוב שאתם בסדר. ממשיכים"); };
    F.cdT = setInterval(() => { n--; $("fallN").textContent = Math.max(0, n); beep(); if (n % 5 === 0) try { navigator.vibrate && navigator.vibrate(400); } catch (e) { } if (n <= 0) { done(); if (test) { toast("בבדיקה אמיתית ההתראה הייתה נשלחת עכשיו"); } else sosAlert("crash"); } }, 1000);
  }

  /* ---------- where I parked ---------- */
  st.park = LS.get("park", null); let parkMk = null, walk = null;
  function setPark(p, silent) { st.park = p ? { lat: +p.lat.toFixed(6), lon: +p.lon.toFixed(6), t: p.t || Date.now(), acc: Math.round(p.acc || 0) } : null; LS.set("park", st.park); drawPark(); if (st.live) liveFlush(); if (p && !silent) { toast("מיקום האופנוע נשמר"); say("מיקום האופנוע נשמר"); } renderMeIf(); }
  function drawPark() {
    if (parkMk) { parkMk.remove(); parkMk = null; } if (!st.park) return;
    const el = document.createElement("button"); el.type = "button"; el.className = "parkmk"; el.setAttribute("aria-label", "האופנוע שלי"); el.innerHTML = PWI.moto;
    el.onclick = e => { e.stopPropagation(); parkPopup(); };
    parkMk = new maplibregl.Marker({ element: el, anchor: "bottom" }).setLngLat([st.park.lon, st.park.lat]).addTo(map);
  }
  function parkPopup() {
    if (!st.park) return; const P = st.park, d = st.me ? L.hav([st.me.lon, st.me.lat], [P.lon, P.lat]) : null;
    const ago = Math.round((Date.now() - P.t) / 6e4), agoT = ago < 1 ? "עכשיו" : ago < 60 ? `לפני ${ago} דק׳` : `לפני ${Math.round(ago / 60)} שע׳`;
    const pop = new maplibregl.Popup({ closeButton: false, maxWidth: "270px", offset: 30 }).setLngLat([P.lon, P.lat]).setHTML(`<b>האופנוע שלך</b><div class="small muted">חנה ${agoT}${d != null ? ` · ${d < 1 ? Math.round(d * 1000) + " מ׳" : d.toFixed(1) + " ק״מ"} ממך` : ""}${P.acc > 25 ? ` · דיוק ${P.acc} מ׳` : ""}</div><div class="row" style="margin-top:6px"><button type="button" class="btn sm primary" data-pk="walk">הליכה אליו</button><a class="btn sm" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${P.lat},${P.lon}&travelmode=walking">Google</a><button type="button" class="btn sm" data-pk="clr">מחיקה</button></div>`).addTo(map);
    const el = pop.getElement(); el.querySelector('[data-pk="walk"]').onclick = () => { pop.remove(); walkStart(); }; el.querySelector('[data-pk="clr"]').onclick = () => { pop.remove(); walkStop(); setPark(null); toast("מיקום החניה נמחק"); };
  }
  /* walk back: live distance + an arrow that points at the bike (compass when the phone has one) */
  function walkStart() {
    if (!st.park) return; walkStop(); walk = { head: null }; $("walkUI").hidden = false;
    const upd = p => { if (!walk || !st.park) return; const me = [p.coords.longitude, p.coords.latitude], bk = [st.park.lon, st.park.lat], d = L.hav(me, bk);
      setSrc("br-walk", FC([{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [me, bk] } }]));
      walk.brg = L.bearing(me, bk); $("walkD").textContent = d < 1 ? Math.round(d * 1000) + " מ׳" : d.toFixed(2) + " ק״מ"; walkArrow();
      if (!walk.meMk) { const e = document.createElement("div"); e.className = "medot"; walk.meMk = new maplibregl.Marker({ element: e }).setLngLat(me).addTo(map); } else walk.meMk.setLngLat(me);
      const vis = map.getBounds(); if (!walk.fit || !vis.contains(me) || !vis.contains(bk)) { walk.fit = true; const b = new maplibregl.LngLatBounds(me, me).extend(bk); map.fitBounds(b, { padding: { top: 150, bottom: innerWidth < 900 ? 200 : 80, left: 60, right: 60 }, maxZoom: 18, duration: 700 }); }
      if (d < 0.012 && !walk.arrived) { walk.arrived = true; say("הגעתם לאופנוע"); $("walkD").textContent = "כאן!"; try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch (e) { } } };
    walk.upd = upd; geoOn(upd); if (st.me) upd({ coords: { latitude: st.me.lat, longitude: st.me.lon } });
    const onOri = e => { let h = e.webkitCompassHeading != null ? e.webkitCompassHeading : (e.absolute && e.alpha != null ? 360 - e.alpha : null); if (h != null && walk) { walk.head = h; walkArrow(); } };
    walk.onOri = onOri; addEventListener("deviceorientationabsolute", onOri); addEventListener("deviceorientation", onOri);
    try { if (typeof DeviceOrientationEvent !== "undefined" && DeviceOrientationEvent.requestPermission) DeviceOrientationEvent.requestPermission().catch(() => { }); } catch (e) { }
  }
  function walkArrow() { if (!walk || walk.brg == null) return; const ref = walk.head != null ? walk.head : map.getBearing(); $("walkA").style.transform = `rotate(${(walk.brg - ref + 360) % 360}deg)`; $("walkH").textContent = walk.head != null ? "החץ מכוון לפי המצפן" : "החץ מכוון לפי המפה"; }
  function walkStop() { if (!walk) return; geoOff(walk.upd); if (walk.meMk) walk.meMk.remove(); removeEventListener("deviceorientationabsolute", walk.onOri); removeEventListener("deviceorientation", walk.onOri); walk = null; $("walkUI").hidden = true; setSrc("br-walk", FC()); }
  /* automatic: in ride mode, standing still ~45 s at one spot = parked; riding off again clears it */
  function parkWatch(R, me, spd) {
    if (spd != null && spd > 20) { R.stillAt = null; if (st.park && R.parkAuto && L.hav(me, [st.park.lon, st.park.lat]) > 0.15) { R.parkAuto = false; setPark(null, true); } return; }
    if (R.odo < 0.3) return; const slow = spd == null || spd < 4;
    if (!slow) { if (R.stillAt && L.hav(me, R.stillAt.p) > 0.03) R.stillAt = null; return; }
    if (!R.stillAt || L.hav(me, R.stillAt.p) > 0.025) { R.stillAt = { p: me, t: Date.now(), fixes: [] }; }
    R.stillAt.fixes.push([me[0], me[1], st.meAcc || 30]);
    if (Date.now() - R.stillAt.t > 45000 && !R.stillAt.saved && (!st.park || L.hav(R.stillAt.p, [st.park.lon, st.park.lat]) > 0.02)) {
      const f = R.stillAt.fixes.slice().sort((a, b) => a[2] - b[2]).slice(0, Math.max(3, Math.ceil(R.stillAt.fixes.length / 2)));
      const lon = f.reduce((a, x) => a + x[0], 0) / f.length, lat = f.reduce((a, x) => a + x[1], 0) / f.length;
      R.stillAt.saved = true; R.parkAuto = true; setPark({ lat, lon, acc: f[0][2] });
    }
  }

  /* ---------- memories: photos + voice, kept privately on this phone (IndexedDB) ---------- */
  const idb = (() => { let dbp; const open = () => dbp || (dbp = new Promise((res, rej) => { const r = indexedDB.open("brn-mem", 1); r.onupgradeneeded = () => { const s = r.result.createObjectStore("items", { keyPath: "id" }); s.createIndex("t", "t"); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }));
    const tx = async (mode, fn) => { const db = await open(); return new Promise((res, rej) => { const t = db.transaction("items", mode), s = t.objectStore("items"); const out = fn(s); t.oncomplete = () => res(out && out.result !== undefined ? out.result : out); t.onerror = () => rej(t.error); }); };
    return { put: v => tx("readwrite", s => s.put(v)), del: id => tx("readwrite", s => s.delete(id)), get: id => tx("readonly", s => s.get(id)), all: () => tx("readonly", s => s.getAll()) }; })();
  let memCache = null; const memAll = async () => memCache || (memCache = (await idb.all().catch(() => [])).sort((a, b) => b.t - a.t));
  const memCtx = () => ({ chap: st.ride ? st.ride.c.id : st.chap, title: st.ride ? st.ride.c.title : chap().title, ride: st.ride ? "live" : "" });
  async function memLimit() { if (isPro()) return true; const n = (await memAll()).length; if (n < FREE_MEM) return true; openPaywall("memories"); return false; }
  async function memAddPhotos(files, fromCamera) {
    if (!files || !files.length) return; if (!(await memLimit())) return; let pos = null; if (fromCamera) try { pos = await getPosFresh(5000); } catch (e) { }
    const list = [...files].slice(0, 20); if (list.length > 1) toast(`שומר ${list.length} תמונות…`, 8000);
    let n = 0; for (const f of list) { try { const im = await decodeImg(f); let full, th; try { full = await toJpeg(im, 1800, 0.84); th = await toJpeg(im, 420, 0.72); } finally { try { im.close && im.close(); } catch (e) { } } const t = fromCamera ? Date.now() : (f.lastModified || Date.now());
      await idb.put(Object.assign({ id: "m" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), t, kind: "photo", blob: full, thumb: th, lat: pos ? pos[1] : null, lon: pos ? pos[0] : null, note: "" }, memCtx())); n++; } catch (e) { toast(e.message); } }
    memCache = null; try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) { }
    if (n) toast(n === 1 ? "התמונה נשמרה בזיכרונות" : `${n} תמונות נשמרו בזיכרונות`); renderMeIf();
  }
  function pickPhotos(camera) { pickFile({ capture: camera, multiple: !camera }).then(fs => { if (fs.length) memAddPhotos(fs, camera); }); }
  /* voice recorder sheet, shared by memories and team reports */
  async function recordVoice(maxSec = 60) {
    if (!navigator.mediaDevices || !window.MediaRecorder) { toast("ההקלטה לא נתמכת בדפדפן הזה"); return null; }
    let stream; try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch (e) { toast("אין גישה למיקרופון"); return null; }
    const type = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg"].find(t => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) || "";
    const rec = new MediaRecorder(stream, type ? { mimeType: type, audioBitsPerSecond: 48000 } : undefined), chunks = []; rec.ondataavailable = e => e.data.size && chunks.push(e.data);
    return new Promise(res => {
      let sec = 0, done = false; const box = openModal(`<div class="recsheet"><h2>הקלטה</h2><div class="recdot"></div><b class="mono" id="recT">0:00</b><p class="small muted" style="margin:0">עד ${maxSec} שניות</p><div class="row"><button type="button" class="btn primary" id="recStop">סיום ושמירה</button><button type="button" class="btn" id="recX">ביטול</button></div></div>`);
      let fin = false; const finish = keep => { if (fin) return; fin = true; try { stream.getTracks().forEach(t => t.stop()); } catch (e) { } if (!$("modal").hidden) closeModal(); res(keep && chunks.length ? new Blob(chunks, { type: rec.mimeType || type || "audio/webm" }) : null); };
      const end = keep => { if (done) return; done = true; clearInterval(tm); rec.onstop = () => finish(keep); try { if (rec.state !== "inactive") { rec.requestData && rec.requestData(); rec.stop(); } else finish(keep); } catch (e) { finish(keep); } setTimeout(() => finish(keep), 1500); };
      const tm = setInterval(() => { sec++; const e = $("recT"); if (e) e.textContent = `0:${String(sec).padStart(2, "0")}`; if (sec >= maxSec) end(true); }, 1000);
      $("recStop").onclick = () => end(true); $("recX").onclick = () => end(false); try { rec.start(250); } catch (e) { done = true; clearInterval(tm); finish(false); toast("ההקלטה לא התחילה"); }
      const mo = new MutationObserver(() => { if ($("modal").hidden || !$("recStop")) { end(false); mo.disconnect(); } }); mo.observe($("modal"), { attributes: true, attributeFilter: ["hidden", "class"] });
    });
  }
  async function memAddVoice() { if (!(await memLimit())) return; const b = await recordVoice(90); if (!b) return; let pos = null; try { pos = await getPosFresh(4000); } catch (e) { }
    await idb.put(Object.assign({ id: "v" + Date.now().toString(36), t: Date.now(), kind: "voice", blob: b, lat: pos ? pos[1] : null, lon: pos ? pos[0] : null, note: "" }, memCtx())); memCache = null; toast("ההקלטה נשמרה בזיכרונות"); renderMeIf(); }
  const urls = new Map(); const blobUrl = (id, b) => { if (!urls.has(id)) urls.set(id, URL.createObjectURL(b)); return urls.get(id); };
  async function memViewer(id) {
    const m = await idb.get(id); if (!m) return; const src = m.kind === "photo" ? blobUrl(id + "f", m.blob) : blobUrl(id + "a", m.blob);
    const box = openModal(`<div class="memview">${m.kind === "photo" ? `<img src="${src}" alt="${esc(m.title)}">` : `<div class="memvoice">${PWI.mic}<audio controls src="${src}"></audio></div>`}
      <div class="small muted">${esc(fmtD(new Date(m.t)))} · ${fmtT(new Date(m.t))} · ${esc(m.title || "")}</div>
      <input class="btn" id="mvNote" maxlength="120" placeholder="כמה מילים על הרגע" value="${esc(m.note || "")}" style="text-align:right">
      <div class="row">${m.lat != null ? `<button type="button" class="btn sm" id="mvMap">במפה</button>` : ""}<button type="button" class="btn sm primary" id="mvShare">שיתוף</button><button type="button" class="btn sm danger" id="mvDel">מחיקה</button></div></div>`, "memm");
    $("mvNote").onchange = async e => { m.note = e.target.value.trim().slice(0, 120); await idb.put(m); memCache = null; };
    if ($("mvMap")) $("mvMap").onclick = () => { closeModal(); new maplibregl.Popup({ closeButton: false, maxWidth: "220px" }).setLngLat([m.lon, m.lat]).setHTML(m.kind === "photo" ? `<img src="${blobUrl(id + "t", m.thumb)}" style="width:100%;border-radius:8px" alt=""><div class="small">${esc(m.note || m.title || "")}</div>` : `<b>הקלטה</b><div class="small">${esc(m.note || "")}</div>`).addTo(map); map.flyTo({ center: [m.lon, m.lat], zoom: 15 }); if (innerWidth < 900) setSheet("peek"); };
    $("mvShare").onclick = async () => { const ext = m.kind === "photo" ? "jpg" : (m.blob.type.includes("mp4") ? "m4a" : m.blob.type.includes("ogg") ? "ogg" : "webm"); const file = new File([m.blob], `blue-ronin-${new Date(m.t).toISOString().slice(0, 10)}.${ext}`, { type: m.blob.type });
      const text = `${m.note ? m.note + " · " : ""}${m.title || ""} · Blue Ronin`; try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text }); return; } } catch (e) { if (e.name === "AbortError") return; } saveBlob(file.name, m.blob); };
    $("mvDel").onclick = async () => { if (!confirmTap($("mvDel"), "למחוק לצמיתות?")) return; await idb.del(id); memCache = null; closeModal(); toast("נמחק"); renderMeIf(); };
  }
  function confirmTap(b, q) { if (b.dataset.ok) return true; b.dataset.ok = "1"; const t = b.textContent; b.textContent = q; setTimeout(() => { if (b.isConnected) { delete b.dataset.ok; b.textContent = t; } }, 3500); return false; }
  function saveBlob(name, blob) { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000); }

  /* ---------- the "שלי" tab ---------- */
  const renderMeIf = () => { if (st.tab === "me") renderMe(); };
  function renderMe() { return paneSafe("me", renderMe_); }
  async function renderMe_() {
    const p = $("p-me"), c = st.sos, mems = await memAll(), pro = isPro();
    const days = []; mems.forEach(m => { const k = new Date(m.t).toISOString().slice(0, 10) + "|" + (m.title || ""); let d = days.find(x => x.k === k); if (!d) days.push(d = { k, t: m.t, title: m.title, items: [] }); d.items.push(m); });
    const lim = pro ? null : FREE_MEM, used = mems.length;
    let h = `<h2>שלי</h2>`;
    /* safety first */
    const ready = !!(c.cPhone || (c.guards && c.guards.length));
    h += `<div class="card safety${ready ? " ok" : ""}"><div class="row" style="justify-content:space-between"><h3>בטיחות וחירום</h3><span class="probadge soft">חינם לכולם</span></div>
      ${ready ? "" : `<p class="small" style="margin:0">ב־2025 נהרגו בישראל 101 רוכבי אופנוע, כמעט רבע מכל ההרוגים בכבישים. כשקורה משהו, הדקות הראשונות קובעות. ההגדרה לוקחת דקה.</p>`}
      <div class="grid2"><label class="f small">השם שלי<input id="sName" maxlength="30" value="${esc(c.name)}" placeholder="יופיע בהתראה"></label><label class="f small">הטלפון שלי (רשות)<input id="sPhone" type="tel" inputmode="tel" dir="ltr" maxlength="16" value="${esc(c.phone)}" placeholder="050-0000000"></label>
      <label class="f small">איש קשר לחירום<input id="sCName" maxlength="30" value="${esc(c.cName)}" placeholder="למשל: בת הזוג"></label><label class="f small">הטלפון שלו<input id="sCPhone" type="tel" inputmode="tel" dir="ltr" maxlength="16" value="${esc(c.cPhone)}" placeholder="050-0000000"></label></div>
      <div class="sstep"><b>1.</b> שמירה. מכאן כפתור החירום מתקשר אליו ושולח לו את המיקום בוואטסאפ או SMS.</div>
      <div class="sstep"><b>2.</b> כדי שהוא יקבל <b>התראה אוטומטית לטלפון</b> גם כשאתם לא יכולים: שולחים לו הזמנה, והוא מאשר התראות. ${c.guards && c.guards.length ? `<span style="color:var(--go)">מחוברים: ${c.guards.map(g => esc(g.name)).join(", ")}</span>` : ""}</div>
      <div class="row"><button type="button" class="btn primary" id="sSave">שמירה</button><button type="button" class="btn" id="sInvite">${PWI.share}הזמנת איש קשר להתראות</button>${c.guards && c.guards.length ? `<button type="button" class="btn" id="sTest">שליחת בדיקה</button>` : ""}</div>
      ${c.guards && c.guards.length ? `<div class="glist">${c.guards.map(g => `<span class="chip">${esc(g.name)} <button type="button" class="linkbtn" data-gx="${esc(g.gid)}" aria-label="הסרה">✕</button></span>`).join("")}</div>` : ""}
      <label class="toggle small"><input type="checkbox" id="sCrash" ${c.crash ? "checked" : ""}> זיהוי נפילה במצב רכיבה (בטא): מכה חזקה ואחריה עצירה, ספירה של 30 שניות, ואם אין תשובה נשלחת התראה</label>
      <div class="row"><button type="button" class="btn sm" id="sFallTest">ניסיון של מסך הנפילה</button><button type="button" class="btn sm danger" id="sSos">קריאת חירום עכשיו</button></div>
      <p class="small muted" style="margin:0">עובד כשהאפליקציה פתוחה על המסך (מצב רכיבה משאיר אותו דולק). האפליקציה לא יכולה לחייג או לשלוח SMS לבד, ולכן ההתראה האוטומטית מגיעה כהודעה דחופה באפליקציה של איש הקשר.</p></div>`;
    h += groupCard();
    h += `<div class="card"><div class="row" style="justify-content:space-between"><h3>שיתוף מיקום חי</h3>${st.live ? '<span class="probadge" style="background:var(--go)">פעיל</span>' : ""}</div>
      <p class="small" style="margin:0">${st.live ? `פעיל עד ${fmtT(new Date(st.live.exp))}. מי שיש לו את הקישור רואה איפה אתם ומתי עודכן לאחרונה.` : "קישור שמראה למשפחה או לחברים איפה אתם בזמן אמת, עד 12 שעות או עד שתפסיקו. במצב חירום נפתח לבד."}</p>
      <div class="row">${st.live ? `<button type="button" class="btn primary" id="lvShare">שליחת הקישור</button><button type="button" class="btn" id="lvStop">הפסקה</button>` : `<button type="button" class="btn primary" id="lvShare">${PWI.share}התחלת שיתוף</button>`}</div></div>`;
    h += `<div class="card"><h3>האופנוע שלי</h3>${st.park ? `<p class="small" style="margin:0">חונה מ־${fmtT(new Date(st.park.t))}${st.me ? ` · ${(d => d < 1 ? Math.round(d * 1000) + " מ׳" : d.toFixed(1) + " ק״מ")(L.hav([st.me.lon, st.me.lat], [st.park.lon, st.park.lat]))} ממך` : ""}</p><div class="row"><button type="button" class="btn primary" id="pkWalk">הליכה אל האופנוע</button><button type="button" class="btn" id="pkShow">במפה</button><button type="button" class="btn" id="pkHere">חניתי כאן</button></div>` : `<p class="small muted" style="margin:0">במצב רכיבה המיקום נשמר לבד כשעוצרים לכמה דקות. אפשר גם לשמור ידנית.</p><div class="row"><button type="button" class="btn" id="pkHere">${PWI.moto}חניתי כאן</button></div>`}</div>`;
    h += `<div class="card mem"><div class="row" style="justify-content:space-between"><h3>הזיכרונות שלי</h3>${pro ? '<span class="probadge">PRO</span>' : `<span class="small muted">${used}/${lim} בחינם</span>`}</div>
      <p class="small muted" style="margin:0">תמונות והקלטות מהדרך, מסודרות לפי תאריך ופרק. נשמרות רק בטלפון שלך.</p>
      <div class="row"><button type="button" class="btn primary" id="memCam">${PWI.cam}צילום</button><button type="button" class="btn" id="memVoice">${PWI.mic}הקלטה</button><button type="button" class="btn" id="memPick">מהגלריה</button></div>
      ${days.length ? days.slice(0, pro ? 60 : 12).map(d => `<div class="memday"><div class="small"><b>${esc(fmtD(new Date(d.t)))}</b> <span class="muted">${esc(d.title || "")}</span></div><div class="memgrid">${d.items.map(m => `<button type="button" class="memt${m.kind === "voice" ? " v" : ""}" data-mem="${m.id}" aria-label="${m.kind === "voice" ? "הקלטה" : "תמונה"}">${m.kind === "photo" ? `<img src="${blobUrl(m.id + "t", m.thumb)}" alt="" loading="lazy">` : PWI.mic}</button>`).join("")}</div></div>`).join("") : `<div class="memempty small muted">עוד אין. צילום בעצירה הבאה, והוא יחכה פה עם התאריך, הפרק והמיקום.</div>`}</div>`;
    h += proCard() + journalCard();
    h += `<div class="card"><h3>גיבוי והעברה</h3><p class="small muted" style="margin:0">טלפון חדש, או מעבר מהכתובת הקודמת: הכול עובר בקוד מוצפן. גיבוי לקובץ כולל גם את הזיכרונות.</p>
      <div class="row"><button type="button" class="btn primary" id="xSend">שליחה למכשיר אחר</button><button type="button" class="btn" id="xRecv">קבלת נתונים בקוד</button></div>
      <div class="row"><button type="button" class="btn sm" id="xBackup">שמירת גיבוי לקובץ</button><button type="button" class="btn sm" id="xRestore">שחזור מקובץ</button></div></div>`;
    h += `<div class="card"><h3>אני איש קשר של רוכב</h3><p class="small muted" style="margin:0">קיבלתם קוד הזמנה? הזינו אותו כאן כדי לקבל התראות חירום בטלפון הזה.</p><div class="row"><input id="gCode" class="btn mono" dir="ltr" maxlength="9" placeholder="XXXX-XXXX" style="flex:1;min-width:0"><button type="button" class="btn" id="gGo">הצטרפות</button></div></div>`;
    p.innerHTML = h; bindMe();
  }
  function bindMe() {
    const c = st.sos, val = id => $(id).value.trim();
    $("sSave").onclick = () => { const ph = val("sCPhone"); if (ph && !IL(ph)) return toast("מספר הטלפון של איש הקשר לא תקין"); if (val("sPhone") && !IL(val("sPhone"))) return toast("מספר הטלפון שלך לא תקין"); Object.assign(c, { name: val("sName"), phone: val("sPhone"), cName: val("sCName"), cPhone: ph }); saveSos(); toast("נשמר"); renderMe(); };
    $("sInvite").onclick = async () => { if (!val("sName")) return toast("קודם כתבו את השם שלכם"); c.name = val("sName"); saveSos(); const inv = await sosInvite(); if (!inv) return; const code = inv.slice(0, 4) + "-" + inv.slice(4), link = `${location.origin}/#guard=${inv}`;
      const text = `${c.name} רוכב אופנוע ומבקש שתהיו איש הקשר שלו לחירום ב־Blue Ronin. אם יקרה משהו בדרך, תקבלו התראה עם המיקום שלו.\nלאישור: ${link}\n(או קוד: ${code})`;
      try { if (navigator.share) { await navigator.share({ text }); toast("כשהוא יאשר, השם שלו יופיע כאן"); return; } } catch (e) { if (e.name === "AbortError") return; }
      location.href = c.cPhone ? waOf(c.cPhone, text) : "https://wa.me/?text=" + encodeURIComponent(text); };
    if ($("sTest")) $("sTest").onclick = () => sosAlert("test");
    document.querySelectorAll("[data-gx]").forEach(b => b.onclick = async () => { if (!confirmTap(b, "להסיר?")) return; try { await post("/api/sos/remove", { circle: c.circle, key: c.key, gid: b.dataset.gx }); } catch (e) { } await sosGuards(); renderMe(); });
    $("sCrash").onchange = async e => { if (e.target.checked && !(await askMotion())) { e.target.checked = false; return toast("צריך לאשר גישה לחיישני התנועה"); } c.crash = e.target.checked; saveSos(); };
    $("sFallTest").onclick = () => { unlockAudio(); fallCountdown(true); };
    $("sSos").onclick = () => { if (!confirmTap($("sSos"), "לחיצה נוספת שולחת")) return; sosAlert("sos"); };
    $("lvShare").onclick = liveShare; if ($("lvStop")) $("lvStop").onclick = liveStop;
    $("pkHere").onclick = async () => { try { const p = await getPosFresh(8000); setPark({ lat: p[1], lon: p[0], acc: st.meAcc }); } catch (e) { toast("אין מיקום"); } };
    if ($("pkWalk")) $("pkWalk").onclick = () => { if (innerWidth < 900) setSheet("peek"); walkStart(); };
    if ($("pkShow")) $("pkShow").onclick = () => { map.flyTo({ center: [st.park.lon, st.park.lat], zoom: 16 }); if (innerWidth < 900) setSheet("peek"); setTimeout(parkPopup, 900); };
    $("memCam").onclick = () => pickPhotos(true); $("memPick").onclick = () => pickPhotos(false); $("memVoice").onclick = memAddVoice;
    document.querySelectorAll("[data-mem]").forEach(b => b.onclick = () => memViewer(b.dataset.mem));
    $("gGo").onclick = () => guardJoin($("gCode").value);
    bindGroup();
    $("xSend").onclick = () => sendSheet(false); $("xRecv").onclick = () => recvSheet(); $("xBackup").onclick = backupFile; $("xRestore").onclick = restoreFile;
    $("proMore").onclick = () => openPaywall(); bindJournal();
    if (c.circle && Date.now() - (st.sosListT || 0) > 6e4) { st.sosListT = Date.now(); const before = JSON.stringify(c.guards); sosGuards().then(g => { if (JSON.stringify(g) !== before) renderMeIf(); }); }
  }
  /* the contact's side: open the invite, allow notifications, done */
  async function guardJoin(code) {
    const inv = String(code || "").toUpperCase().replace(/[^A-Z0-9]/g, ""); if (inv.length !== 8) return toast("הקוד צריך 8 תווים");
    let rider = "רוכב"; try { rider = (await (await fetch("/api/sos/invite/" + inv)).json()).name || rider; } catch (e) { }
    const ios = /iPhone|iPad/.test(navigator.userAgent), standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
    const box = openModal(`<div class="ridesum"><h2>איש קשר לחירום</h2><p style="margin:0"><b>${esc(rider)}</b> ביקש שתקבלו התראה אם יקרה לו משהו בדרך: קריאת חירום או נפילה שזוהתה, יחד עם המיקום שלו.</p>
      ${ios && !standalone ? `<div class="alert">באייפון התראות עובדות רק מהאפליקציה במסך הבית: לחצו על כפתור השיתוף בספארי ← ״הוספה למסך הבית״, פתחו את Blue Ronin משם, ובלשונית ״שלי״ הזינו את הקוד <b class="mono" dir="ltr">${inv.slice(0, 4)}-${inv.slice(4)}</b>.</div>` : ""}
      <label class="f small">השם שלכם (יופיע לרוכב)<input id="gName" maxlength="30" placeholder="למשל: נועה"></label>
      <button type="button" class="btn primary big" id="gOk" ${ios && !standalone ? "disabled" : ""}>אישור וקבלת התראות</button><div class="err small" id="gErr"></div></div>`);
    $("gOk").onclick = async () => {
      $("gOk").disabled = true; const err = m => { $("gErr").textContent = m; $("gOk").disabled = false; };
      try {
        if (!("serviceWorker" in navigator) || !("PushManager" in window)) return err("הדפדפן הזה לא תומך בהתראות");
        if ((await Notification.requestPermission()) !== "granted") return err("צריך לאשר התראות כדי לקבל קריאות חירום");
        const reg = await navigator.serviceWorker.ready, key = (await (await fetch("/api/vapid", { cache: "no-store" })).json()).key;
        const sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64u(key) });
        const j = await post("/api/sos/join", { inv, sub: sub.toJSON(), name: $("gName").value.trim() });
        LS.set("guardOf", (LS.get("guardOf", []) || []).concat([{ rider: j.rider, t: Date.now() }]).slice(-5));
        closeModal(); history.replaceState(null, "", location.pathname); toast(`מחובר. התראת אישור בדרך אליכם`);
      } catch (e) { err(e.message || "לא הצליח"); }
    };
  }
  const gHash = location.hash.match(/^#guard=([A-Za-z0-9]{8})$/); if (gHash) setTimeout(() => guardJoin(gHash[1]), 900);

  /* ---------- voice search (builder) ---------- */
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  /* Voice search: a listening sheet you can always close, with watchdogs so a speech service that never
     answers can't freeze anything. Where the browser has no speech service (or refuses), the keyboard's
     own dictation is the fallback. */
  function micFor(input, onFinal) {
    const b = document.createElement("button"); b.type = "button"; b.className = "micbtn"; b.setAttribute("aria-label", "חיפוש קולי"); b.innerHTML = PWI.mic;
    b.onclick = () => listen(input, onFinal); return b;
  }
  function listen(input, onFinal) {
    const dictate = m => { toast(m || "לחצו על המיקרופון שבמקלדת כדי להכתיב", 4500); try { input.focus(); } catch (e) { } };
    if (!SR) return dictate();
    let r; try { r = new SR(); } catch (e) { return dictate(); }
    let text = "", ended = false, started = false; const timers = [];
    openModal(`<div class="listen"><div class="recdot"></div><b id="lsT">מקשיב… אמרו לאן</b><div id="lsTxt" class="lstxt"></div><div class="row"><button type="button" class="btn primary" id="lsDone">סיום</button><button type="button" class="btn" id="lsX">ביטול</button></div></div>`, "lsm");
    const finish = use => { if (ended) return; ended = true; timers.forEach(clearTimeout); mo.disconnect(); try { r.onresult = r.onend = r.onerror = r.onstart = null; r.abort(); } catch (e) { } if (!$("modal").hidden) closeModal(); if (use && text.trim()) { input.value = text.trim(); try { onFinal(text.trim()); } catch (e) { } } };
    const mo = new MutationObserver(() => { if ($("modal").hidden || !$("lsDone")) finish(false); }); mo.observe($("modal"), { attributes: true, attributeFilter: ["hidden", "class"] });
    r.lang = "he-IL"; r.interimResults = !isIOS; r.continuous = false; r.maxAlternatives = 1;
    r.onstart = () => { started = true; };
    r.onresult = e => { text = [...e.results].map(x => x[0].transcript).join(""); const t = $("lsTxt"); if (t) t.textContent = text; if (e.results[e.results.length - 1].isFinal) finish(true); };
    r.onerror = e => { const er = e.error; finish(false); if (er === "aborted") return; dictate(er === "not-allowed" || er === "service-not-allowed" ? "אין הרשאה לזיהוי דיבור. אפשר להכתיב דרך המיקרופון שבמקלדת" : er === "no-speech" ? "לא נשמע דיבור. נסו שוב, או הכתיבו דרך המקלדת" : "הזיהוי הקולי לא זמין כרגע. אפשר להכתיב דרך המקלדת"); };
    r.onend = () => finish(true);
    timers.push(setTimeout(() => { if (!started && !ended) { finish(false); dictate("הזיהוי הקולי לא התחיל. אפשר להכתיב דרך המיקרופון שבמקלדת"); } }, 6000));
    timers.push(setTimeout(() => finish(true), 15000));
    $("lsDone").onclick = () => { try { r.stop(); } catch (e) { } timers.push(setTimeout(() => finish(true), 1200)); };
    $("lsX").onclick = () => finish(false);
    try { r.start(); } catch (e) { finish(false); dictate(); }
  }

  function geoResume() { if (geoSubs.size && geoW == null && navigator.geolocation) geoW = navigator.geolocation.watchPosition(feed, () => { }, { enableHighAccuracy: true, maximumAge: 3000, timeout: 20000 }); }
  function geoPause() { if (geoW != null) { navigator.geolocation.clearWatch(geoW); geoW = null; } }
  setTimeout(drawPark, 1500);
  $("hudCam").innerHTML = PWI.cam + '<span class="lbl">צילום</span>'; $("hudPark").innerHTML = PWI.moto + '<span class="lbl">חניתי</span>'; $("hudLive").innerHTML = PWI.pin + '<span class="lbl">שיתוף</span>';
  /* ride HUD size: full / compact / map. Remembered per device; the map buttons always sit above the HUD. */
  const HS = ["full", "compact", "min"];
  function hudSize(v) { if (!HS.includes(v)) v = "compact"; HS.forEach(x => document.body.classList.toggle("hud-" + x, x === v)); document.querySelectorAll("[data-hs]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.hs === v))); LS.set("hudSize", v); requestAnimationFrame(hudMeasure); }
  function hudMeasure() {
    const h = $("hud"); if (!h || h.hidden) return; const b = document.body;
    const set = () => document.documentElement.style.setProperty("--hudH", Math.round(h.getBoundingClientRect().height) + "px");
    /* short screens: when the map buttons would run into the top bar, lay them out in a row instead */
    b.classList.remove("fabs-row"); set();
    if (innerWidth < 900) { const f = [...document.querySelectorAll("#fabs .fab")].filter(x => x.offsetParent); const colH = f.reduce((a, x) => a + x.offsetHeight + 8, 0); const top = innerHeight - h.getBoundingClientRect().height - 14 - colH; if (top < 72) { b.classList.add("fabs-row"); set(); } }
  }
  document.querySelectorAll("[data-hs]").forEach(b => b.onclick = () => hudSize(b.dataset.hs));
  if ("ResizeObserver" in window) new ResizeObserver(hudMeasure).observe($("hud"));
  const onTurn = () => setTimeout(() => { try { map.resize(); } catch (e) { } hudMeasure(); foldAttrib(); if (st.ride && st.me && !st.ride.free) map.easeTo({ center: [st.me.lon, st.me.lat], duration: 400, padding: ridePad() }); }, 350);
  addEventListener("orientationchange", onTurn); try { screen.orientation && screen.orientation.addEventListener("change", onTurn); } catch (e) { }
  hudSize(LS.get("hudSize", "compact"));
  $("hudCam").onclick = () => pickPhotos(true);
  $("hudPark").onclick = () => { if (!st.me) return toast("אין מיקום עדיין"); setPark({ lat: st.me.lat, lon: st.me.lon, acc: st.meAcc }); };
  $("hudLive").onclick = () => st.live ? liveShare() : liveShare();
  $("walkX").onclick = walkStop;
  (() => { const b = $("hudSos"); let t = null; const go = () => { b.classList.remove("hold"); t = null; try { navigator.vibrate && navigator.vibrate(200); } catch (e) { } sosAlert("sos"); };
    b.addEventListener("pointerdown", e => { e.preventDefault(); b.classList.add("hold"); t = setTimeout(go, 1200); });
    const cancel = () => { if (t) { clearTimeout(t); t = null; b.classList.remove("hold"); toast("החזיקו לחוץ שנייה כדי לשלוח"); } };
    b.addEventListener("pointerup", cancel); b.addEventListener("pointerleave", cancel); b.addEventListener("pointercancel", cancel);
    b.addEventListener("contextmenu", e => e.preventDefault()); })();
  setInterval(() => { const on = !!st.live; $("hudLive").classList.toggle("on", on); }, 2000);

  /* =====================================================================================
     Transfer and backup. On iPhone every home-screen app keeps its own storage (separate from Safari),
     so data can't ride in a link. Instead the phone encrypts its data with a key that stays in the code
     the rider types: our server only ever holds ciphertext, for 24 hours. A backup file works offline.
     ===================================================================================== */
  const XCH = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = () => { try { return matchMedia("(display-mode: standalone)").matches || !!navigator.standalone; } catch (e) { return false; } };
  const fmtCode = c => c.replace(/(.{4})(?=.)/g, "$1-");
  const normCode = c => String(c || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  async function xKey(part) { const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("brn-xfer|" + part)); return crypto.subtle.importKey("raw", h, "AES-GCM", false, ["encrypt", "decrypt"]); }
  async function gz(bytes, dir) { const S = dir ? window.CompressionStream : window.DecompressionStream; if (!S) return null; return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new S("gzip"))).arrayBuffer()); }
  const b64ofBytes = bytes => { let s = ""; for (let i = 0; i < bytes.length; i += 32768) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 32768)); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
  const bytesOfB64 = t => Uint8Array.from(atob(t.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
  const blob2url = b => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(b); });
  const url2blob = async u => (await fetch(u)).blob();
  async function collectData(withMem) {
    const d = {}; MOVE_KEYS.forEach(k => { const v = LS.get(k, undefined); if (v !== undefined && v !== null) d[k] = v; });
    if (withMem) { const ms = await memAll(); d.__mem = []; for (const m of ms) d.__mem.push(Object.assign({}, m, { blob: await blob2url(m.blob), thumb: m.thumb ? await blob2url(m.thumb) : null })); }
    return { v: 2, t: Date.now(), from: location.host, d };
  }
  const summary = d => { const n = []; const nr = (d.myRoutes || []).length, nd = (d.rides || []).length; if (nr) n.push(nr === 1 ? "מסלול אחד שבנית" : `${nr} מסלולים שבנית`); if (nd) n.push(nd === 1 ? "רכיבה אחת ביומן" : `${nd} רכיבות ביומן`); if (d.bike && d.bike.id) n.push("האופנוע וההגדרות"); if (d.sos && (d.sos.cPhone || d.sos.circle)) n.push("פרטי החירום ואנשי הקשר"); if (d.pro && d.pro.exp > Date.now()) n.push("מנוי Pro פעיל"); if ((d.__mem || []).length) n.push(d.__mem.length === 1 ? "זיכרון אחד" : `${d.__mem.length} זיכרונות`); return n.length ? n : ["ההגדרות שלך"]; };
  async function applyData(d) {
    const cur = { routes: LS.get("myRoutes", []) || [], rides: LS.get("rides", []) || [] };
    const keep = { ...d }; delete keep.__mem;
    /* never replace an active Pro or an emergency circle with an older/empty one */
    if (keep.pro && st.pro && st.pro.exp > (keep.pro.exp || 0)) delete keep.pro;
    if (keep.sos && st.sos && st.sos.circle && !keep.sos.circle) delete keep.sos;
    Object.entries(keep).forEach(([k, v]) => LS.set(k, v));
    if (cur.routes.length) LS.set("myRoutes", cur.routes.concat((d.myRoutes || []).filter(r => !cur.routes.some(x => x.id === r.id))));
    if (cur.rides.length) LS.set("rides", cur.rides.concat((d.rides || []).filter(r => !cur.rides.some(x => x.id === r.id))).sort((a, b) => b.start - a.start).slice(0, 60));
    if (Array.isArray(d.__mem)) for (const m of d.__mem) { try { await idb.put(Object.assign({}, m, { blob: await url2blob(m.blob), thumb: m.thumb ? await url2blob(m.thumb) : null })); } catch (e) { } }
    LS.set("moved", Date.now()); LS.set("movedSeen", false); LS.set("xferAsked", true);
  }
  async function xferSend() {
    const pack = await collectData(false), raw = new TextEncoder().encode(JSON.stringify(pack)), z = await gz(raw, true);
    const body = new Uint8Array((z || raw).length + 1); body[0] = z ? 1 : 0; body.set(z || raw, 1);
    const part = Array.from(crypto.getRandomValues(new Uint8Array(10)), x => XCH[x % XCH.length]).join(""), iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await xKey(part), body));
    const j = await post("/api/xfer", { ct: b64ofBytes(ct), iv: b64ofBytes(iv) });
    return { code: j.id + part, n: summary(pack.d), exp: j.exp };
  }
  async function xferFetch(code) {
    const c = normCode(code); if (c.length !== 16) throw new Error("הקוד צריך 16 תווים");
    const r = await fetch("/api/xfer/" + c.slice(0, 6), { cache: "no-store" }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || "אין חיבור");
    let plain; try { plain = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: bytesOfB64(j.iv) }, await xKey(c.slice(6)), bytesOfB64(j.ct))); } catch (e) { throw new Error("הקוד לא נכון. בדקו את 16 התווים"); }
    const data = plain[0] === 1 ? await gz(plain.subarray(1), false) : plain.subarray(1); if (!data) throw new Error("הדפדפן הזה ישן מדי לפתיחת ההעברה. עדכנו את מערכת ההפעלה");
    const o = JSON.parse(new TextDecoder().decode(data)); if (!o || typeof o.d !== "object") throw new Error("ההעברה לא תקינה"); return o.d;
  }
  /* sending side: one sheet for every case, with the right steps for the phone in hand */
  async function sendSheet(moving) {
    const box = openModal(`<div class="xsheet"><h2>${moving ? "מעבר לכתובת החדשה" : "העברה למכשיר אחר"}</h2><p class="small muted" style="margin:0">מכינים קוד העברה מוצפן…</p><div class="spin" style="margin:10px auto;width:28px;height:28px"></div></div>`, "xm");
    let r; try { r = await xferSend(); } catch (e) { box.innerHTML = `<div class="xsheet"><h2>לא הצלחנו להכין קוד</h2><p class="small">${esc(e.message)}</p><button type="button" class="btn primary" id="xRetry">ניסיון חוזר</button><button type="button" class="btn" id="xFile">שמירת גיבוי לקובץ במקום</button></div>`; $("xRetry").onclick = () => sendSheet(moving); $("xFile").onclick = backupFile; return; }
    const code = fmtCode(r.code), link = `${NEW_HOME}/#xfer=${r.code}`, ios = isIOS;
    try { await navigator.clipboard.writeText(r.code); } catch (e) { }
    if (!$("mbody") || $("modal").hidden) return;
    $("mbody").innerHTML = `<div class="xsheet"><h2>${moving ? "מעבר לכתובת החדשה" : "קוד העברה"}</h2>
      <div class="xcode mono" dir="ltr" id="xCode">${code}</div><button type="button" class="btn" id="xCopy">העתקת הקוד</button>
      <p class="small" style="margin:0">יעבור: ${r.n.map(esc).join(" · ")}. הקוד בתוקף 24 שעות. ההעברה מוצפנת, ואנחנו לא יכולים לקרוא אותה.</p>
      ${moving && ios && standalone() ? `<ol class="xsteps"><li>הקוד כבר הועתק.</li><li>פתחו את <b>Safari</b>, היכנסו ל־<b dir="ltr">blueronin.app</b>, ולחצו שיתוף ← <b>״הוספה למסך הבית״</b>.</li><li>פתחו את האפליקציה החדשה מהמסך הבית, ובהודעה שתופיע לחצו <b>״קבלת הנתונים״</b> ← הדבקה.</li><li><b>אל תמחקו את האייקון הישן</b> עד שתראו שהכול עבר.</li></ol>`
        : moving ? `<a class="btn primary big" href="${link}">פתיחה ב־blueronin.app עם הנתונים</a><p class="small muted" style="margin:0">באייפון: אם האפליקציה מותקנת במסך הבית, פתחו אותה, לחצו ״קבלת הנתונים״ והדביקו את הקוד.</p>`
        : `<p class="small" style="margin:0">במכשיר השני: לשונית ״שלי״ ← ״גיבוי והעברה״ ← ״קבלת נתונים בקוד״.</p>`}</div>`;
    $("xCopy").onclick = () => navigator.clipboard.writeText(r.code).then(() => toast("הקוד הועתק")).catch(() => { const rg = document.createRange(); rg.selectNodeContents($("xCode")); getSelection().removeAllRanges(); getSelection().addRange(rg); });
  }
  /* receiving side */
  function recvSheet(prefill) {
    openModal(`<div class="xsheet"><h2>קבלת הנתונים שלך</h2><p class="small muted" style="margin:0">הקוד מופיע באפליקציה הישנה (או במכשיר השני), 16 תווים.</p>
      <input id="xIn" class="xin mono" dir="ltr" maxlength="19" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXX-XXXX-XXXX-XXXX" value="${esc(prefill ? fmtCode(normCode(prefill)) : "")}">
      <div class="row"><button type="button" class="btn" id="xPaste">הדבקה</button><button type="button" class="btn primary" id="xGo">קבלה</button></div><div class="err small" id="xErr"></div></div>`, "xm");
    const inp = $("xIn"); inp.oninput = () => { const v = normCode(inp.value).slice(0, 16); const f = fmtCode(v); if (inp.value !== f) inp.value = f; };
    $("xPaste").onclick = async () => { try { inp.value = fmtCode(normCode(await navigator.clipboard.readText()).slice(0, 16)); } catch (e) { inp.focus(); toast("לחצו לחיצה ארוכה בשדה ← הדבקה"); } };
    $("xGo").onclick = async () => {
      const b = $("xGo"); b.disabled = true; $("xErr").textContent = "";
      try { const d = await xferFetch(inp.value); const items = summary(d);
        $("mbody").innerHTML = `<div class="xsheet"><h2>נמצאו הנתונים שלך</h2><ul class="xsteps">${items.map(i => `<li>${esc(i)}</li>`).join("")}</ul><button type="button" class="btn primary big" id="xApply">שמירה במכשיר הזה</button></div>`;
        $("xApply").onclick = async () => { $("xApply").disabled = true; await applyData(d); history.replaceState(null, "", location.pathname); location.reload(); };
      } catch (e) { $("xErr").textContent = e.message; b.disabled = false; }
    };
  }
  async function backupFile() {
    toast("מכין גיבוי…"); const pack = await collectData(true), name = `blue-ronin-backup-${new Date().toISOString().slice(0, 10)}.json`, blob = new Blob([JSON.stringify(pack)], { type: "application/json" });
    const file = new File([blob], name, { type: "application/json" });
    try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: "גיבוי Blue Ronin" }); return; } } catch (e) { if (e.name === "AbortError") return; }
    saveBlob(name, blob); toast("הגיבוי נשמר בהורדות");
  }
  async function restoreFile() {
    const [f] = await pickFile({ accept: ".json,application/json" }); if (!f) return;
    let o; try { o = JSON.parse(await f.text()); if (!o || typeof o.d !== "object") throw 0; } catch (e) { return toast("זה לא קובץ גיבוי של Blue Ronin"); }
    openModal(`<div class="xsheet"><h2>שחזור מגיבוי</h2><p class="small muted" style="margin:0">מ־${esc(fmtD(new Date(o.t || Date.now())))}</p><ul class="xsteps">${summary(o.d).map(i => `<li>${esc(i)}</li>`).join("")}</ul><p class="small" style="margin:0">מה שכבר יש במכשיר נשמר. מסלולים ורכיבות מתמזגים.</p><button type="button" class="btn primary big" id="rsGo">שחזור</button></div>`, "xm");
    $("rsGo").onclick = async () => { $("rsGo").disabled = true; await applyData(o.d); location.reload(); };
  }
  const xHash = location.hash.match(/^#xfer=([A-Za-z0-9-]{16,19})$/); if (xHash) setTimeout(() => recvSheet(xHash[1]), 900);

  /* ---------- reliable file pickers ----------
     iOS drops a detached <input type=file> while the camera is open, so the first photo was lost.
     The input lives in the page until the choice comes back (or the picker is cancelled). */
  function pickFile({ accept = "image/*", capture = false, multiple = false } = {}) {
    return new Promise(res => {
      const i = document.createElement("input"); i.type = "file"; i.accept = accept; if (capture) i.setAttribute("capture", "environment"); if (multiple) i.multiple = true;
      i.style.cssText = "position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0"; document.body.appendChild(i);
      let done = false; const fin = files => { if (done) return; done = true; setTimeout(() => i.remove(), 1000); res(files); };
      i.addEventListener("change", () => fin([...(i.files || [])]));
      i.addEventListener("cancel", () => fin([]));
      /* no 'cancel' event on older iOS: when the page regains focus and nothing came back within a while, give up */
      const onFocus = () => setTimeout(() => { if (!done && !(i.files && i.files.length)) fin([]); }, 4000);
      setTimeout(() => window.addEventListener("focus", onFocus, { once: true }), 300);
      i.click();
    });
  }
  /* decode once, make both sizes; falls back to <img> when createImageBitmap can't read the file */
  async function decodeImg(file) {
    try { if (window.createImageBitmap) return await createImageBitmap(file, { imageOrientation: "from-image" }); } catch (e) { }
    try { if (window.createImageBitmap) return await createImageBitmap(file); } catch (e) { }
    return await new Promise((res, rej) => { const u = URL.createObjectURL(file), im = new Image(); im.onload = () => { res(im); setTimeout(() => URL.revokeObjectURL(u), 1000); }; im.onerror = () => { URL.revokeObjectURL(u); rej(new Error("התמונה לא נתמכת")); }; im.src = u; });
  }
  function toJpeg(src, max, q) { const w = src.width || src.naturalWidth, h = src.height || src.naturalHeight, k = Math.min(1, max / Math.max(w, h)), c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k)); const g = c.getContext("2d"); g.imageSmoothingQuality = "high"; g.drawImage(src, 0, 0, c.width, c.height); return new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error("לא הצלחנו לעבד את התמונה")), "image/jpeg", q)); }
  async function shrink(file, max, q) { const im = await decodeImg(file); try { return await toJpeg(im, max, q); } finally { try { im.close && im.close(); } catch (e) { } } }

  /* =====================================================================================
     3D ride replay — the ride you actually rode, through the fly-through camera. Our touches: the real
     clock of the ride runs with it, the sky takes the colour of that hour, and the replay pauses on every
     photo you took, right where you took it.
     ===================================================================================== */
  function rideCoords(ride) {
    const raw = []; ride.trk.forEach(p => { const q = raw[raw.length - 1]; if (!q || L.hav([q[0], q[1]], [p[0], p[1]]) > 0.004) raw.push(p); });
    if (raw.length < 3) return null;
    /* light smoothing that keeps one point per fix, so time stays attached to place */
    const c = raw.map((p, i) => { if (i === 0 || i === raw.length - 1) return [p[0], p[1]]; const a = raw[i - 1], b = raw[i + 1]; return [(a[0] + 2 * p[0] + b[0]) / 4, (a[1] + 2 * p[1] + b[1]) / 4]; });
    return { coords: c, times: raw.map(p => p[2]) };
  }
  function skyFor(t) {
    const h = +new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: TZ }).format(new Date(t));
    if (h < 7) return { "sky-color": "#F6B27A", "horizon-color": "#FCD9B0", "fog-color": "#F3C9A0", "sky-horizon-blend": 0.6, "horizon-fog-blend": 0.6 };
    if (h < 16) return { "sky-color": "#7FB4F0", "horizon-color": "#DCEBFA", "fog-color": "#E6EEF7", "sky-horizon-blend": 0.5, "horizon-fog-blend": 0.5 };
    if (h < 18) return { "sky-color": "#F08A5D", "horizon-color": "#FFC48C", "fog-color": "#F4B183", "sky-horizon-blend": 0.7, "horizon-fog-blend": 0.6 };
    return { "sky-color": "#1D2B53", "horizon-color": "#5B4B8A", "fog-color": "#3A3F66", "sky-horizon-blend": 0.6, "horizon-fog-blend": 0.5 };
  }
  /* A sample ride on the current chapter, so the 3D replay can be tried before the first real ride.
     Speeds follow the road: slower in the bends, faster on the straights. Never written to the journal. */
  function demoRide() {
    const cid = st.routes[st.chap] ? st.chap : Object.keys(st.routes)[0], r = st.routes[cid], c = CHAPTERS.find(x => x.id === cid);
    if (!r) { toast("המסלול עוד נטען. נסו שוב בעוד רגע"); return null; }
    const step = Math.max(1, Math.ceil(r.coords.length / 500)), pts = r.coords.filter((_, i) => i % step === 0 || i === r.coords.length - 1);
    const sat = new Date(); sat.setDate(sat.getDate() - ((sat.getDay() + 1) % 7 || 7)); sat.setHours(6, 40, 0, 0);
    let t = sat.getTime(), km = 0, moving = 0, vmax = 0; const trk = [[pts[0][0], pts[0][1], t]];
    for (let i = 1; i < pts.length; i++) {
      const d = L.hav(pts[i - 1], pts[i]); if (d < 0.002) continue;
      const a = pts[Math.max(0, i - 3)], b = pts[Math.min(pts.length - 1, i + 3)], turn = i > 1 && i < pts.length - 1 ? L.angDiff(L.bearing(a, pts[i]), L.bearing(pts[i], b)) : 0;
      const v = Math.max(32, Math.min(92, 88 - Math.abs(turn) * 0.9)); vmax = Math.max(vmax, v);
      const dt = d / v * 3600; t += dt * 1000; moving += dt; km += d; trk.push([pts[i][0], pts[i][1], Math.round(t)]);
    }
    const ride = { id: "demo", demo: true, chap: cid, title: "הדגמה · " + (c ? c.title : "רכיבה"), start: trk[0][2], end: trk[trk.length - 1][2], km: +km.toFixed(1), moving: Math.round(moving), vmax: Math.round(vmax), fuel: +(km * bikeEff().cons / 100).toFixed(1), bike: bikeEff().name, trk };
    return ride;
  }
  async function replayRide(ride) {
    if (!ride || !ride.trk) return; const rc = rideCoords(ride); if (!rc) return toast("הרכיבה קצרה מדי לשחזור");
    closeModal(); if (st.ride) return toast("אפשר לצפות בשחזור בסוף הרכיבה");
    const cum = L.cumulative(rc.coords), mems = (await memAll()).filter(m => m.lat != null && m.t >= ride.start - 6e4 && m.t <= ride.end + 6e4);
    const pops = mems.map(m => { let bi = 0, bd = 1e9; for (let i = 0; i < rc.coords.length; i += 1) { const d = L.hav(rc.coords[i], [m.lon, m.lat]); if (d < bd) { bd = d; bi = i; } } return bd < 0.4 ? { km: cum[bi], m } : null; }).filter(Boolean).sort((a, b) => a.km - b.km);
    startFly({ coords: rc.coords, title: ride.title, replay: { ride, cum, times: rc.times, pops, next: 0 } });
  }
  function replayClock(F) { const R = F.replay, km = F.km * R.scale; let lo = 0, hi = R.cum.length - 1; while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (R.cum[mid] < km) lo = mid; else hi = mid; } const f = R.cum[hi] > R.cum[lo] ? (km - R.cum[lo]) / (R.cum[hi] - R.cum[lo]) : 0; return R.times[lo] + (R.times[hi] - R.times[lo]) * Math.max(0, Math.min(1, f)); }
  function replayPop(F) {
    const R = F.replay; if (!R || R.next >= R.pops.length) return; const p = R.pops[R.next]; if (F.km * R.scale < p.km) return; R.next++;
    const el = $("rpPop"); el.innerHTML = `<img src="${blobUrl(p.m.id + "t", p.m.thumb)}" alt=""><span>${esc(p.m.note || fmtT(new Date(p.m.t)))}</span>`; el.hidden = false; el.classList.remove("in"); void el.offsetWidth; el.classList.add("in");
    el.onclick = () => memViewer(p.m.id);
    if (F.playing) { F.playing = false; flyUI(); clearTimeout(R.resume); R.resume = setTimeout(() => { if (st.fly === F && !F.hold) { F.playing = true; flyUI(); } }, 2600); }
    clearTimeout(R.hide); R.hide = setTimeout(() => { el.classList.remove("in"); setTimeout(() => el.hidden = true, 300); }, 3200);
  }
  function replayEnd(F) {
    const ride = F.replay.ride, avg = ride.moving > 60 ? ride.km / (ride.moving / 3600) : 0;
    openModal(`<div class="ridesum"><div class="small muted">${esc(fmtD(new Date(ride.start)))}</div><h2>${esc(ride.title)}</h2>
      <div class="fsum"><div><span class="k">מרחק</span><b class="mono">${ride.km}</b><span class="k">ק״מ</span></div><div><span class="k">זמן תנועה</span><b class="mono">${dur(ride.moving)}</b></div><div><span class="k">ממוצע</span><b class="mono">${Math.round(avg)}</b><span class="k">קמ״ש</span></div><div><span class="k">רגעים</span><b class="mono">${F.replay.pops.length}</b><span class="k">תמונות</span></div></div>
      ${ride.demo ? '<p class="small muted" style="margin:0">זו הייתה הדגמה. אחרי רכיבה אמיתית במצב רכיבה, השחזור יראה בדיוק את הדרך שלך, את השעה ואת התמונות שצילמת.</p>' : ""}<div class="row">${ride.demo ? "" : `<button type="button" class="btn primary" id="rpShare">${PWI.share}שיתוף הרכיבה</button>`}<button type="button" class="btn" id="rpAgain">צפייה שוב</button></div></div>`);
    $("rpAgain").onclick = () => { closeModal(); const R = F.replay; if (st.fly === F) { F.km = 0; F.snap = true; R.next = 0; F.playing = true; flyUI(); } else replayRide(ride); };
    if ($("rpShare")) $("rpShare").onclick = () => shareRideCard(ride);
  }
  async function shareRideCard(ride) {
    const rc = rideCoords(ride); if (!rc) return; try { await Promise.all(["700 70px Assistant", "500 34px Assistant", "700 44px Karantina"].map(f => document.fonts.load(f))); } catch (e) { }
    const W = 1080, H = 1350, cv = document.createElement("canvas"); cv.width = W; cv.height = H; const g = cv.getContext("2d");
    const grd = g.createLinearGradient(0, 0, 0, H); grd.addColorStop(0, "#0B1424"); grd.addColorStop(1, "#1A2742"); g.fillStyle = grd; g.fillRect(0, 0, W, H);
    let w0 = 180, e0 = -180, s0 = 90, n0 = -90; rc.coords.forEach(p => { w0 = Math.min(w0, p[0]); e0 = Math.max(e0, p[0]); s0 = Math.min(s0, p[1]); n0 = Math.max(n0, p[1]); });
    const kx = Math.cos((s0 + n0) / 2 * Math.PI / 180), bw = Math.max(1e-6, (e0 - w0) * kx), bh = Math.max(1e-6, n0 - s0), sc = Math.min(860 / bw, 620 / bh), ox = (W - bw * sc) / 2, oy = 300 + (620 - bh * sc) / 2;
    const X = p => ox + (p[0] - w0) * kx * sc, Y = p => oy + (n0 - p[1]) * sc;
    g.lineJoin = g.lineCap = "round"; g.strokeStyle = "rgba(255,162,74,.25)"; g.lineWidth = 28; g.beginPath(); rc.coords.forEach((p, i) => i ? g.lineTo(X(p), Y(p)) : g.moveTo(X(p), Y(p))); g.stroke();
    g.strokeStyle = "#FFA24A"; g.lineWidth = 9; g.stroke(); g.fillStyle = "#5C8DFF"; g.beginPath(); g.arc(X(rc.coords[0]), Y(rc.coords[0]), 15, 0, 7); g.fill();
    g.direction = "rtl"; g.textAlign = "right"; const R0 = W - 72;
    g.fillStyle = "#FFA24A"; g.font = "700 44px Karantina, Assistant, sans-serif"; g.fillText("BLUE RONIN · רכבתי היום", R0, 96);
    g.fillStyle = "#E6ECF4"; g.font = "700 70px Assistant, system-ui, sans-serif"; g.fillText(ride.title, R0, 190);
    g.fillStyle = "#8C9DB3"; g.font = "500 36px Assistant, system-ui, sans-serif"; g.fillText(fmtD(new Date(ride.start)), R0, 248);
    const avg = ride.moving > 60 ? Math.round(ride.km / (ride.moving / 3600)) : 0;
    [["מרחק", ride.km + " ק״מ"], ["זמן תנועה", dur(ride.moving)], ["ממוצע", avg + " קמ״ש"]].forEach(([k, v], i) => { const x = R0 - i * 315, y = 990; g.fillStyle = "rgba(255,255,255,.06)"; g.beginPath(); if (g.roundRect) g.roundRect(x - 295, y, 295, 160, 24); else g.rect(x - 295, y, 295, 160); g.fill(); g.fillStyle = "#8C9DB3"; g.font = "500 32px Assistant, system-ui, sans-serif"; g.fillText(k, x - 24, y + 52); g.fillStyle = "#E6ECF4"; g.font = "700 50px Assistant, system-ui, sans-serif"; g.fillText(v, x - 24, y + 122); });
    g.fillStyle = "#8C9DB3"; g.font = "500 30px Assistant, system-ui, sans-serif"; g.fillText("blueronin.app", R0, H - 56);
    const blob = await new Promise(r => cv.toBlob(r, "image/png")), file = new File([blob], "blue-ronin-ride.png", { type: "image/png" }), text = `${ride.title} · ${ride.km} ק״מ · Blue Ronin`;
    try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text }); return; } } catch (e) { if (e.name === "AbortError") return; }
    saveBlob("blue-ronin-ride.png", blob); toast("התמונה נשמרה");
  }

  /* =====================================================================================
     Group rides — everyone in the group on one map, a meeting point the leader sets, and an SOS that
     reaches the whole group. Opening a group is Pro; joining is free.
     ===================================================================================== */
  st.group = LS.get("group", null); if (st.group && st.group.exp < Date.now()) { st.group = null; LS.set("group", null); }
  let gTimer = null, gMk = new Map(), gMeetMk = null, gPrev = null, gPick = false;
  const gTxt = d => d < 1 ? Math.round(d * 1000) + " מ׳" : d.toFixed(1) + " ק״מ";
  const gAgo = t => { const s = Math.round((Date.now() - t) / 1000); return !t ? "עוד אין מיקום" : s < 60 ? "עכשיו" : s < 3600 ? `לפני ${Math.round(s / 60)} דק׳` : `לפני ${Math.round(s / 3600)} שע׳`; };
  const gFeed = () => { };
  function gStart() { if (!st.group) return; geoOn(gFeed); clearInterval(gTimer); gTimer = setInterval(gTick, 15000); gTick(); }
  function gStop(msg) { clearInterval(gTimer); gTimer = null; geoOff(gFeed); st.group = null; st.gsnap = null; gPrev = null; LS.set("group", null); gMk.forEach(m => m.remove()); gMk.clear(); if (gMeetMk) { gMeetMk.remove(); gMeetMk = null; } $("hudGroup").textContent = ""; if (msg) toast(msg); renderMeIf(); }
  async function gTick() {
    const G = st.group; if (!G || document.hidden) return;
    const me = st.me && Date.now() - (st.meTs || 0) < 30 * 6e4 ? st.me : null;
    try { const snap = await post("/api/group/pos", { gid: G.gid, mid: G.mid, key: G.key, lat: me ? me.lat : null, lon: me ? me.lon : null, spd: st.ride && st.ride.spd != null ? st.ride.spd : null, state: st.sosOn ? "sos" : st.ride ? "ride" : "stop" }); gApply(snap); }
    catch (e) { if (e.status === 410 || e.status === 404 || e.status === 403) gStop("הרכיבה הקבוצתית הסתיימה"); }
  }
  function gApply(snap) {
    const G = st.group; if (!G) return; st.gsnap = snap; const me = st.me ? [st.me.lon, st.me.lat] : null;
    /* what changed since last time */
    if (gPrev) {
      snap.members.forEach(m => { if (m.mid === G.mid) return; const o = gPrev.members.find(x => x.mid === m.mid);
        if (!o) toast(`${m.name} הצטרף לקבוצה`);
        if (m.state === "sos" && (!o || o.state !== "sos")) { say(`קריאת חירום מ${m.name}`); try { navigator.vibrate && navigator.vibrate([500, 200, 500, 200, 800]); } catch (e) { } updBar(`🆘 ${m.name} שלח קריאת חירום`, { cls: "sosbar", btn: "למיקום", go: () => { $("updbar").hidden = true; if (m.lat != null) map.flyTo({ center: [m.lon, m.lat], zoom: 15 }); }, sticky: false }); } });
      const om = gPrev.meet, nm = snap.meet; if (nm && (!om || om.t !== nm.t)) { const d = me ? gTxt(L.hav(me, [nm.lon, nm.lat])) : ""; toast(`נקודת מפגש: ${nm.label || "במפה"}${d ? " · " + d : ""}`, 4000); say(`נקבעה נקודת מפגש${nm.label ? ": " + nm.label : ""}${d ? ", " + d.replace("ק״מ", "קילומטר").replace("מ׳", "מטר") : ""}`); }
    }
    gPrev = snap;
    /* markers */
    const seen = new Set();
    snap.members.forEach(m => { if (m.mid === G.mid || m.lat == null) return; seen.add(m.mid); let mk = gMk.get(m.mid);
      if (!mk) { const el = document.createElement("button"); el.type = "button"; el.className = "gmk"; el.onclick = e => { e.stopPropagation(); gPopup(m.mid); }; mk = new maplibregl.Marker({ element: el }).setLngLat([m.lon, m.lat]).addTo(map); gMk.set(m.mid, mk); }
      const el = mk.getElement(); el.style.background = m.color; el.textContent = (m.name || "?").trim().slice(0, 1); el.title = m.name; el.classList.toggle("old", snap.now - m.t > 180000); el.classList.toggle("sos", m.state === "sos"); el.classList.toggle("lead", !!m.leader); mk.setLngLat([m.lon, m.lat]); });
    gMk.forEach((mk, id) => { if (!seen.has(id)) { mk.remove(); gMk.delete(id); } });
    if (snap.meet) { if (!gMeetMk) { const el = document.createElement("div"); el.className = "gmeet"; el.innerHTML = "🏁"; gMeetMk = new maplibregl.Marker({ element: el, anchor: "bottom" }).addTo(map); } gMeetMk.setLngLat([snap.meet.lon, snap.meet.lat]); gMeetMk.getElement().title = snap.meet.label || "נקודת מפגש"; } else if (gMeetMk) { gMeetMk.remove(); gMeetMk = null; }
    /* ride HUD line: how spread out the group is */
    const others = snap.members.filter(m => m.mid !== G.mid && m.lat != null && snap.now - m.t < 600000);
    if (me && others.length) { const far = others.map(m => [m, L.hav(me, [m.lon, m.lat])]).sort((a, b) => b[1] - a[1])[0]; $("hudGroup").textContent = `קבוצה · ${others.length + 1} רוכבים · הרחוק: ${far[0].name}, ${gTxt(far[1])}`; } else $("hudGroup").textContent = st.group ? `קבוצה · ממתינים לרוכבים` : "";
    renderMeIf();
  }
  function gPopup(mid) {
    const m = st.gsnap && st.gsnap.members.find(x => x.mid === mid); if (!m) return; const me = st.me ? [st.me.lon, st.me.lat] : null;
    new maplibregl.Popup({ closeButton: false, maxWidth: "250px", offset: 18 }).setLngLat([m.lon, m.lat]).setHTML(`<b>${esc(m.name)}${m.leader ? " · מוביל" : ""}</b><div class="small muted">${m.state === "sos" ? "🆘 קריאת חירום · " : ""}${gAgo(m.t)}${me ? " · " + gTxt(L.hav(me, [m.lon, m.lat])) + " ממך" : ""}</div><div class="row" style="margin-top:6px">${navBtn("w", wazeLL(m.lat, m.lon))}${navBtn("g", gmLL(m.lat, m.lon))}</div>`).addTo(map);
  }
  async function gCreate(title) {
    if (!isPro()) return openPaywall("group");
    if (!st.sos.name) { const n = await askName(); if (!n) return; }
    try { const j = await post("/api/group/create", { title, name: st.sos.name, pro: st.pro.token }); st.group = Object.assign(j, { code: j.gid }); LS.set("group", st.group); gStart(); gInvite(); }
    catch (e) { if (e.status === 402) openPaywall("group"); else toast(e.message); }
  }
  async function gJoin(code) {
    if (st.group) return toast("אתם כבר בקבוצה. צאו ממנה קודם");
    if (!st.sos.name) { const n = await askName(); if (!n) return; }
    try { const j = await post("/api/group/join", { code, name: st.sos.name }); st.group = Object.assign(j, { code: j.gid }); LS.set("group", st.group); history.replaceState(null, "", location.pathname); toast(`הצטרפתם ל״${j.title}״`); gStart(); setTab("me"); }
    catch (e) { toast(e.message); }
  }
  function askName() { return new Promise(res => { openModal(`<div class="ridesum"><h2>איך לקרוא לך?</h2><label class="f small">השם שיופיע לשאר הרוכבים<input id="nmIn" maxlength="24" autofocus></label><button type="button" class="btn primary" id="nmOk">המשך</button></div>`); $("nmOk").onclick = () => { const v = $("nmIn").value.trim(); if (!v) return; st.sos.name = v; saveSos(); closeModal(); res(v); }; }); }
  function gInvite() {
    const G = st.group; if (!G) return; const link = `${NEW_HOME}/#group=${G.code}`, text = `מצטרפים לרכיבה ״${G.title}״ ב־Blue Ronin: כל הקבוצה על מפה אחת.\n${link}\n(קוד: ${G.code})`;
    if (navigator.share) { navigator.share({ text }).catch(() => { }); return; }
    openModal(`<div class="xsheet"><h2>הזמנה לקבוצה</h2><div class="xcode mono" dir="ltr">${G.code}</div><div class="row"><button type="button" class="btn primary" id="gCp">העתקת קישור</button><a class="btn" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(text)}">וואטסאפ</a></div></div>`);
    $("gCp").onclick = () => navigator.clipboard.writeText(link).then(() => toast("הועתק")).catch(() => { });
  }
  async function gMeet(lat, lon, label) { const G = st.group; try { gApply(await post("/api/group/meet", { gid: G.gid, mid: G.mid, key: G.key, lat, lon, label })); toast("נקודת המפגש נשלחה לכולם"); } catch (e) { toast(e.message); } }
  map.on("click", e => { if (!gPick || !st.group) return; gPick = false; document.body.classList.remove("gpicking"); gMeet(e.lngLat.lat, e.lngLat.lng, ""); });
  function groupCard() {
    const G = st.group, S = st.gsnap, me = st.me ? [st.me.lon, st.me.lat] : null;
    if (!G) return `<div class="card"><div class="row" style="justify-content:space-between"><h3>רכיבה קבוצתית</h3><span class="probadge">PRO</span></div><p class="small" style="margin:0">כל הקבוצה על מפה אחת, נקודת מפגש שכולם רואים, וקריאת חירום שמגיעה לכולם. פתיחת קבוצה ב־Pro, הצטרפות בחינם.</p>
      <div class="row"><input id="gTitle" class="gin" maxlength="40" placeholder="שם הרכיבה, למשל: שבת בגליל" style="flex:1;min-width:0"><button type="button" class="btn primary" id="gNew">פתיחת קבוצה</button></div>
      <div class="row"><input id="gCodeIn" class="gin mono" dir="ltr" maxlength="7" placeholder="קוד, 6 תווים" style="flex:1;min-width:0"><button type="button" class="btn" id="gJoinB">הצטרפות</button></div></div>`;
    const ms = S ? S.members.slice().sort((a, b) => (b.mid === G.mid) - (a.mid === G.mid) || (me && a.lat != null && b.lat != null ? L.hav(me, [a.lon, a.lat]) - L.hav(me, [b.lon, b.lat]) : 0)) : [];
    return `<div class="card gcard"><div class="row" style="justify-content:space-between"><h3>${esc(G.title)}</h3><span class="mono gcode" dir="ltr">${esc(G.code)}</span></div>
      ${S && S.meet ? `<div class="small">🏁 נקודת מפגש${S.meet.label ? ": " + esc(S.meet.label) : ""}${me ? " · " + gTxt(L.hav(me, [S.meet.lon, S.meet.lat])) : ""} <button type="button" class="linkbtn" id="gGoMeet">ניווט</button></div>` : ""}
      <div class="glist2">${ms.length ? ms.map(m => `<button type="button" class="gm-row" data-gm="${esc(m.mid)}"><i style="background:${esc(m.color)}">${esc((m.name || "?").slice(0, 1))}</i><span><b>${esc(m.name)}${m.mid === G.mid ? " (אני)" : ""}${m.leader ? " · מוביל" : ""}</b><span class="small muted">${m.state === "sos" ? "🆘 חירום · " : ""}${gAgo(m.t)}${me && m.lat != null && m.mid !== G.mid ? " · " + gTxt(L.hav(me, [m.lon, m.lat])) : ""}</span></span></button>`).join("") : `<div class="small muted">מתחברים…</div>`}</div>
      <div class="row"><button type="button" class="btn primary" id="gInv">${PWI.share}הזמנת רוכבים</button><button type="button" class="btn" id="gFit">כולם במפה</button></div>
      ${G.leader ? `<div class="row"><button type="button" class="btn sm" id="gMeetHere">נקודת מפגש כאן</button><button type="button" class="btn sm" id="gMeetMap">בחירה במפה</button>${S && S.meet ? `<button type="button" class="btn sm" id="gMeetClr">ביטול הנקודה</button>` : ""}<button type="button" class="btn sm danger" id="gEnd">סיום הקבוצה</button></div>` : `<div class="row"><button type="button" class="btn sm" id="gLeave">יציאה מהקבוצה</button></div>`}
      <p class="small muted" style="margin:0">המיקום מתעדכן כל 15 שניות כשהאפליקציה פתוחה. הקבוצה נמחקת אחרי 12 שעות.</p></div>`;
  }
  function bindGroup() {
    if ($("gNew")) $("gNew").onclick = () => gCreate($("gTitle").value.trim());
    if ($("gJoinB")) $("gJoinB").onclick = () => gJoin($("gCodeIn").value);
    if ($("gInv")) $("gInv").onclick = gInvite;
    if ($("gFit")) $("gFit").onclick = () => { const S = st.gsnap; if (!S) return; const b = new maplibregl.LngLatBounds(); S.members.forEach(m => m.lat != null && b.extend([m.lon, m.lat])); if (st.me) b.extend([st.me.lon, st.me.lat]); if (!b.isEmpty()) { map.fitBounds(b, { padding: 70, maxZoom: 15 }); if (innerWidth < 900) setSheet("peek"); } };
    document.querySelectorAll("[data-gm]").forEach(b => b.onclick = () => { const m = st.gsnap && st.gsnap.members.find(x => x.mid === b.dataset.gm); if (m && m.lat != null) { map.flyTo({ center: [m.lon, m.lat], zoom: 15 }); if (innerWidth < 900) setSheet("peek"); setTimeout(() => gPopup(m.mid), 900); } });
    if ($("gGoMeet")) $("gGoMeet").onclick = () => { const mt = st.gsnap.meet; window.open(wazeLL(mt.lat, mt.lon), "_blank"); };
    if ($("gMeetHere")) $("gMeetHere").onclick = async () => { toast("קובע נקודת מפגש…"); try { const p = await getPosFresh(4000); gMeet(p[1], p[0], ""); } catch (e) { toast("אין מיקום. אפשר לבחור במפה"); } };
    if ($("gMeetMap")) $("gMeetMap").onclick = () => { gPick = true; document.body.classList.add("gpicking"); if (innerWidth < 900) setSheet("peek"); toast("לחצו על המפה במקום המפגש", 4000); };
    if ($("gMeetClr")) $("gMeetClr").onclick = async () => { const G = st.group; try { gApply(await post("/api/group/meet", { gid: G.gid, mid: G.mid, key: G.key, clear: true })); } catch (e) { toast(e.message); } };
    if ($("gEnd")) $("gEnd").onclick = async () => { if (!confirmTap($("gEnd"), "לסיים לכולם?")) return; const G = st.group; try { await post("/api/group/end", { gid: G.gid, mid: G.mid, key: G.key }); } catch (e) { } gStop("הקבוצה הסתיימה"); };
    if ($("gLeave")) $("gLeave").onclick = async () => { if (!confirmTap($("gLeave"), "לצאת?")) return; const G = st.group; try { await post("/api/group/leave", { gid: G.gid, mid: G.mid, key: G.key }); } catch (e) { } gStop("יצאתם מהקבוצה"); };
  }
  document.addEventListener("visibilitychange", () => { if (!document.hidden && st.group) gTick(); });
  const grHash = location.hash.match(/^#group=([A-Za-z0-9]{6})$/); if (grHash) setTimeout(() => gJoin(grHash[1]), 1200);
  if (st.group) setTimeout(gStart, 2000);

  function setTab(t) {
    st.tab = t; document.querySelectorAll(".tab").forEach(b => b.setAttribute("aria-selected", String(b.dataset.t === t)));
    ["go", "brief", "route", "stops", "me", "tools"].forEach(k => $("p-" + k).hidden = k !== t); $("panes").scrollTop = 0;
    if (innerWidth < 900 && st.sheet === "peek") setSheet("half");
    renderTab();
  }
  const renderTab = () => ({ go: renderGo, brief: renderBrief, route: renderRoute, stops: renderStops, me: renderMe, tools: renderTools })[st.tab]();
  document.querySelectorAll(".tab").forEach(b => b.onclick = () => setTab(b.dataset.t));
  function setChap(id) { stopFly(); st.chap = id; st.rideShown = null; rideFocus(false); if (id !== DRAFT && id !== NAV) LS.set("chap", id); pushSources(); renderMarkers(); renderTab(); fitChapter(); if (wxSig() !== (st.wx && st.wx.sig)) loadWeather(); }
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
    if (["osmview", "fuel", "cams", "moto"].includes(i.dataset.l) && i.checked && !st.osm) loadOSM(true);
    if (i.dataset.l === "traffic" && i.checked && !st.cfg.traffic) toast(st.cfg.trafficKey ? "שירות התנועה לא זמין כרגע" : "שכבת התנועה החיה עוד לא מחוברת");
    applyLayerVis();
  });
  syncLayerBoxes();

  /* ---------- buttons ---------- */
  $("fHome").onclick = () => { stopFly(); if (st.rideShown) { st.rideShown = null; pushSources(); rideFocus(false); } if (innerWidth < 900 && st.sheet === "full") setSheet("half"); homeIsrael(); };
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
  window.BRG && BRG.crumb("boot");
  const safe = (name, f) => { try { f(); } catch (e) { window.BRG && BRG.report("boot:" + name, e.message, "", 0, e.stack); } };
  if (innerWidth < 900) setSheet("half"); else st.sheet = "half";
  safe("brief", renderBrief);
  let introDone = false;
  const endIntro = () => { if (introDone) return; const wait = (window.BR_introHold || 0) - performance.now(); if (wait > 0) return void setTimeout(endIntro, wait); introDone = true; $("intro").classList.add("out"); setTimeout(() => st.tab === "go" ? homeIsrael(2600) : home(2600), 250); };
  map.on("load", () => setTimeout(endIntro, 900));
  setTimeout(endIntro, 4500);
  if (window.BRG) BRG.booted = true;
  /* admin layer: announcement banner, maintenance notice, flags; once-a-day anonymous ping */
  function renderNotice() {
    const ct = st.content || {}, a = ct.announce || {}, el = $("annc"), seen = LS.get("anncSeen", "");
    const key = (ct.v || 0) + ":" + (a.text || "");
    el.hidden = !(a.on && a.text) || seen === key;
    if (!el.hidden) { el.className = "annc " + (a.level || "info"); $("anncT").textContent = a.text; const l = $("anncL"); l.hidden = !a.link; if (a.link) l.href = a.link; $("anncX").onclick = () => { LS.set("anncSeen", key); el.hidden = true; }; }
    const m = ct.maintenance || {}; let mSeen = false; try { mSeen = !!sessionStorage.getItem("brn:maintSeen"); } catch (e) { } $("maint").hidden = !(m.on && !mSeen); $("maintT").textContent = m.text || "מתבצעות עבודות תחזוקה. חלק מהנתונים עשויים לא להתעדכן.";
    $("maintX").onclick = () => { try { sessionStorage.setItem("brn:maintSeen", "1"); } catch (e) { } $("maint").hidden = true; };
    $("fFly").hidden = !st.flags.fly;
  }
  safe("notice", renderNotice); safe("bell", renderBell); safe("pro", proBadge); proCheck();
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") proCheck(); });
  /* a ride the phone cut short (app killed, battery) is still saved to the journal */
  (() => { const lv = LS.get("rideLive", null); if (lv && lv.trk && lv.trk.length > 2) { LS.set("rideLive", null); const d = saveRide({ cid: lv.cid, title: lv.title, odo: lv.odo, moving: lv.moving, vmax: lv.vmax, trk: lv.trk }); if (d) toast("הרכיבה הקודמת נשמרה ביומן"); } })();
  /* admin content: on open, whenever the app comes back to the screen, and every 5 minutes while open */
  let contentAt = 0;
  function syncContent() {
    contentAt = Date.now();
    fetch("/api/content?t=" + Math.floor(Date.now() / 5000), { cache: "no-store" }).then(r => r.ok ? r.json() : null).then(ct => {
      if (!ct || (st.content && JSON.stringify(ct) === JSON.stringify(st.content))) return;
      LS.set("content", ct); const was = st.chap; applyContent(ct); renderNotice(); renderBell(); pushSources(); renderAll(); if (was !== st.chap) fitChapter();
    }).catch(() => { });
  }
  syncContent();
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && Date.now() - contentAt > 20000) syncContent(); });
  setInterval(() => { if (document.visibilityState === "visible") syncContent(); }, 5 * 6e4);
  try { const d = new Date().toISOString().slice(0, 10); if (LS.get("pingDay", "") !== d) { LS.set("pingDay", d); fetch("/api/ping", { method: "POST", keepalive: true }).catch(() => { }); } } catch (e) { }
  fetch("/api/config").then(r => r.ok ? r.json() : {}).then(cfg => { Object.assign(st.cfg, cfg); if (styleReady) addTrafficLayer(); if (st.tab === "route") { loadTraffic(st.chap); renderRoute(); } }).catch(() => { });
  importShared();
  /* if location is already allowed, take one quiet fix so the brief, the weather "now" and navigation start from
     where the rider actually is (never prompts) */
  try { navigator.permissions && navigator.permissions.query({ name: "geolocation" }).then(ps => { if (ps.state !== "granted" || st.me) return;
    navigator.geolocation.getCurrentPosition(p => { const first = !st.me; feed(p); if (first) { if (st.tab === "brief") renderBrief(); if (st.tab === "go") renderGo(); try { Promise.resolve(wxBusy).catch(() => { }).then(() => loadWeather()); } catch (e) { } } }, () => { }, { enableHighAccuracy: false, maximumAge: 10 * 6e4, timeout: 8000 }); }).catch(() => { }); } catch (e) { }
  loadRoutes(); loadWeather(); loadOSM(); loadCrowd();
  /* opening tab: a link that names one wins; otherwise the weekend tab on Friday and Saturday, and everyday
     navigation the rest of the week */
  { const hs = { "#brief": "brief", "#route": "route", "#go": "go", "#stops": "stops", "#me": "me", "#tools": "tools" }[location.hash];
    const dow = new Date(new Date().toLocaleString("en-US", { timeZone: TZ })).getDay(); /* 0 = Sunday … 6 = Saturday */
    if (hs) setTab(hs); else if (st.tab === "brief" && !new URLSearchParams(location.search).get("r") && dow >= 0 && dow <= 4) setTab("go"); }
  /* ---------- transparent updates: what's happening is always on screen ---------- */
  function updBar(text, opt = {}) {
    const b = $("updbar"); b.className = "updbar" + (opt.cls ? " " + opt.cls : ""); $("updT").innerHTML = (opt.spin ? '<span class="spin" style="display:inline-block;vertical-align:-2px;margin-inline-end:8px"></span>' : "") + esc(text);
    const g = $("updGo"); g.hidden = !opt.btn; if (opt.btn) { g.textContent = opt.btn; g.onclick = opt.go; }
    $("updX").hidden = !!opt.sticky; $("updX").onclick = () => { b.hidden = true; if (opt.onClose) opt.onClose(); }; b.hidden = false;
    clearTimeout(updBar.t); if (opt.ms) updBar.t = setTimeout(() => b.hidden = true, opt.ms);
  }
  (() => { const last = LS.get("lastVer", null); if (last && last !== APP_VER) setTimeout(() => updBar(`האפליקציה עודכנה לגרסה ${APP_VER}`, { btn: "מה חדש", go: () => { $("updbar").hidden = true; openInbox(); }, ms: 12000 }), 2500); LS.set("lastVer", APP_VER); })();
  const busy = () => !!(st.ride || st.build || !$("modal").hidden);

  /* ---------- moving to blueronin.app: each rider carries their own data across (it never touches our server) ---------- */
  const NEW_HOME = "https://blueronin.app";
  const MOVE_KEYS = ["cid", "pro", "sos", "park", "myRoutes", "rides", "bike", "myVotes", "fuelRide", "chap", "layers", "shabbat", "theme", "stopsCat", "fuelFilter", "buildPrefs", "voice", "pushPrefs", "introSound", "inboxSeen", "seenVer", "anncSeen", "flyRate"];
  /* The old address (blueronin-north-map.netlify.app) now redirects here permanently (netlify.toml), so the
     one-time "move with your data" flow is retired. Device-to-device transfer and backup stay in "שלי". */
  if (LS.get("moved", 0) && !LS.get("movedSeen", false)) { LS.set("movedSeen", true); setTimeout(() => updBar("הנתונים הועברו. כדי לקבל שוב התראות לטלפון, מפעילים אותן בלשונית כלים", { btn: "לכלים", go: () => { $("updbar").hidden = true; setTab("tools"); }, ms: 15000 }), 1500); }

  /* live updates: network-first app shell + reload once when a new version takes over */
  if ("serviceWorker" in navigator) addEventListener("load", async () => {
    try {
      const reg = await navigator.serviceWorker.register("sw.js"); st.swReg = reg;
      document.addEventListener("visibilitychange", () => { if (!document.hidden) reg.update().catch(() => { }); });
      let reloading = false; const had = !!navigator.serviceWorker.controller;
      reg.addEventListener("updatefound", () => { if (had) updBar("מורידים עדכון לאפליקציה. אפשר להמשיך כרגיל", { spin: true, ms: 20000 }); });
      const apply = () => { reloading = true; updBar("מעדכנים לגרסה החדשה…", { spin: true, sticky: true }); setTimeout(() => location.reload(), 900); };
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (!had || reloading) return;
        if (busy()) { st.updWaiting = true; updBar(st.ride ? "גרסה חדשה מוכנה. היא תותקן כשתסיימו לרכוב" : "גרסה חדשה מוכנה", { btn: st.ride ? "" : "עדכון עכשיו", go: apply }); return; }
        apply();
      });
    } catch (e) { }
  });
})();
