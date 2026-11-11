/* Blue Ronin Navigator — pure ride logic (no DOM). Coordinates are [lon, lat]. */
(function (g) {
  const R = Math.PI / 180;

  function hav(a, b) {
    const dl = (b[1] - a[1]) * R, dn = (b[0] - a[0]) * R;
    const x = Math.sin(dl / 2) ** 2 + Math.cos(a[1] * R) * Math.cos(b[1] * R) * Math.sin(dn / 2) ** 2;
    return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(x)));
  }
  function bearing(a, b) {
    const y = Math.sin((b[0] - a[0]) * R) * Math.cos(b[1] * R);
    const x = Math.cos(a[1] * R) * Math.sin(b[1] * R) - Math.sin(a[1] * R) * Math.cos(b[1] * R) * Math.cos((b[0] - a[0]) * R);
    return (Math.atan2(y, x) / R + 360) % 360;
  }
  const angDiff = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

  /* Distance from a point to the route LINE, not to its vertices. OSRM puts vertices hundreds of metres apart on
     straight roads, so the nearest vertex can be far from a rider who is exactly on the road (that read as "off
     route" and triggered reroute after reroute). Searches a window around the last index first, then the whole
     line. Returns { i, km, d }: i = start of the nearest segment, km = distance along the route at the projected
     point, d = km from the line. Local flat projection: exact enough at these distances. */
  function nearestOnLine(c, cum, idx, p, back = 150, ahead = 2500) {
    const n = c.length; if (!n) return { i: 0, km: 0, d: 1e9 }; if (n < 2) return { i: 0, km: 0, d: hav(c[0], p) };
    const kx = 111.32 * Math.cos(p[1] * Math.PI / 180), ky = 110.57;
    const scan = (a, z, b) => {
      for (let i = a; i < z; i++) {
        const ax = (c[i][0] - p[0]) * kx, ay = (c[i][1] - p[1]) * ky, dx = (c[i + 1][0] - c[i][0]) * kx, dy = (c[i + 1][1] - c[i][1]) * ky, l2 = dx * dx + dy * dy;
        let t = l2 > 0 ? -(ax * dx + ay * dy) / l2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
        const qx = ax + t * dx, qy = ay + t * dy, d = Math.sqrt(qx * qx + qy * qy); if (d < b.d) { b.d = d; b.i = i; b.t = t; }
      }
      return b;
    };
    const k = Math.max(0, Math.min(n - 2, idx | 0));
    let b = scan(Math.max(0, k - back), Math.min(n - 1, k + ahead), { d: 1e9, i: k, t: 0 });
    if (b.d > 0.4) b = scan(0, n - 1, { d: 1e9, i: k, t: 0 });
    return { i: b.i, km: cum[b.i] + (cum[b.i + 1] - cum[b.i]) * b.t, d: b.d };
  }
  /* Off-route decision with hysteresis, so GPS jitter never triggers a reroute: the threshold grows with the fix's
     reported accuracy (65 m at 20 m accuracy, capped at 200 m), it takes 3 off fixes in a row spanning at least
     6 s, and never within 25 s of the previous reroute. `s` is the ride's state object: { n, since, lastAt }. */
  function offThreshold(accM) { return Math.max(0.05, Math.min(0.2, 0.035 + (accM > 0 ? accM : 20) * 1.5 / 1000)); }
  function offRoute(s, d, accM, now, moving) {
    if (!moving || d <= offThreshold(accM)) { s.n = 0; s.since = 0; return false; }
    s.n = (s.n || 0) + 1; if (!s.since) s.since = now;
    return s.n >= 3 && now - s.since >= 6000 && now - (s.lastAt || 0) >= 25000;
  }
  /* Search text as Israelis type it, made readable for the geocoders: one kind of quote mark, common city
     abbreviations spelled out (ת"א, פ"ת, ב"ש…), the "רחוב/רח'" prefix dropped, spaces collapsed. */
  const ABBR = [[/(^|[\s,])ת"?א(?:-?יפו)?(?=$|[\s,])/g, "$1תל אביב"], [/(^|[\s,])פ"ת(?=$|[\s,])/g, "$1פתח תקווה"], [/(^|[\s,])ב"ש(?=$|[\s,])/g, "$1באר שבע"],
    [/(^|[\s,])ר"ג(?=$|[\s,])/g, "$1רמת גן"], [/(^|[\s,])ראשל"צ(?=$|[\s,])/g, "$1ראשון לציון"], [/(^|[\s,])רמה"ש(?=$|[\s,])/g, "$1רמת השרון"],
    [/(^|[\s,])ק"ש(?=$|[\s,])/g, "$1קריית שמונה"], [/(^|[\s,])י-?ם(?=$|[\s,])/g, "$1ירושלים"], [/(^|[\s,])תל-אביב/g, "$1תל אביב"]];
  function normQuery(q) {
    let t = String(q || "").replace(/[\u05F4\u201C\u201D\u201E]/g, '"').replace(/[\u05F3\u2018\u2019`]/g, "'").replace(/\u05BE/g, " ").replace(/\s+/g, " ").trim();
    t = t.replace(/^(רחוב|רח'|רח\.?|רח)\s+/, "").replace(/(^|\s)שד'\s*/g, "$1שדרות ");
    for (const [re, to] of ABBR) t = t.replace(re, to);
    return t.replace(/\s+/g, " ").trim();
  }
  const looksLikeAddress = q => /\d/.test(q) && /[\u0590-\u05FFA-Za-z]{2}/.test(q);
  function cumulative(c) { const out = [0]; for (let i = 1; i < c.length; i++) out.push(out[i - 1] + hav(c[i - 1], c[i])); return out; }

  function pointAt(c, cum, km) {
    if (km <= 0) return c[0];
    const L = cum[cum.length - 1]; if (km >= L) return c[c.length - 1];
    let lo = 0, hi = cum.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] < km) lo = m; else hi = m; }
    const t = (km - cum[lo]) / ((cum[hi] - cum[lo]) || 1);
    return [c[lo][0] + (c[hi][0] - c[lo][0]) * t, c[lo][1] + (c[hi][1] - c[lo][1]) * t];
  }
  function sample(c, n) { const cum = cumulative(c), L = cum[cum.length - 1]; const out = []; for (let i = 0; i < n; i++) out.push(pointAt(c, cum, (L * i) / (n - 1))); return { pts: out, km: L }; }

  /* Curve density: degrees of heading change per km, in ~400 m windows.
     Short vertices (<8 m) are merged so GPS-like noise doesn't inflate the score. */
  function simplifyByDist(c, minKm) { const out = [c[0]]; for (let i = 1; i < c.length - 1; i++) if (hav(out[out.length - 1], c[i]) >= minKm) out.push(c[i]); out.push(c[c.length - 1]); return out; }
  const curveClass = dpk => dpk < 70 ? 0 : dpk < 170 ? 1 : dpk < 330 ? 2 : 3;
  const CURVE_LABEL = ["ישר", "זורם", "מפותל", "עיקולים צפופים"];
  function curveSegments(coords, win = 0.4) {
    const c = simplifyByDist(coords, 0.008);
    const segs = []; let cur = [c[0]], len = 0, turn = 0, prevB = null, startKm = 0, total = 0;
    for (let i = 1; i < c.length; i++) {
      const d = hav(c[i - 1], c[i]); const b = bearing(c[i - 1], c[i]);
      if (prevB !== null) turn += angDiff(prevB, b);
      prevB = b; len += d; total += d; cur.push(c[i]);
      if (len >= win || i === c.length - 1) {
        const dpk = len > 0.05 ? turn / len : 0;
        segs.push({ coords: cur, km: len, dpk, cls: curveClass(dpk), startKm });
        startKm = total; cur = [c[i]]; len = 0; turn = 0;
      }
    }
    return segs;
  }
  function curveStats(segs) { const km = [0, 0, 0, 0]; segs.forEach(s => km[s.cls] += s.km); const total = km.reduce((a, b) => a + b, 0); return { km, total, twisty: km[2] + km[3], score: total ? Math.min(100, Math.round(((km[1] * 1 + km[2] * 2.2 + km[3] * 3.4) / total) * 30)) : 0 }; }

  /* Motorcycle wind chill at riding speed (Environment Canada formula). */
  function windChill(t, v = 80) { if (t > 30) return t; const p = Math.pow(v, 0.16); return 13.12 + 0.6215 * t - 11.37 * p + 0.3965 * t * p; }
  function gear(tMin, tMax, rainP, fog) {
    const wc = windChill(tMin);
    const out = [];
    if (wc < 4) out.push("מעיל חורף + שכבה תרמית, כפפות חורף, צווארון");
    else if (wc < 11) out.push("מעיל עם בטנה סגורה, כפפות ביניים, צווארון");
    else if (wc < 18) out.push("מעיל עם בטנה; את הבטנה מורידים בצהריים");
    else if (wc < 26) out.push("מעיל ריינג׳ עם פתחי אוורור פתוחים");
    else out.push("מעיל רשת, שתייה, עצירות בצל");
    if (tMax - tMin >= 10) out.push(`הפרש ${Math.round(tMax - tMin)}° בין הבוקר לצהריים: שכבות שאפשר להוריד`);
    if (rainP >= 35) out.push("חליפת גשם בתא");
    if (fog) out.push("ויזור שקוף ואפוד זוהר לערפל של הבוקר");
    return { wc: Math.round(wc), items: out };
  }

  const WMO = {
    0: ["בהיר", "sun"], 1: ["בהיר ברובו", "sun"], 2: ["מעונן חלקית", "part"], 3: ["מעונן", "cloud"],
    45: ["ערפל", "fog"], 48: ["ערפל קפוא", "fog"],
    51: ["טפטוף קל", "drizzle"], 53: ["טפטוף", "drizzle"], 55: ["טפטוף חזק", "drizzle"],
    56: ["טפטוף קפוא", "drizzle"], 57: ["טפטוף קפוא", "drizzle"],
    61: ["גשם קל", "rain"], 63: ["גשם", "rain"], 65: ["גשם חזק", "rain"], 66: ["גשם קפוא", "rain"], 67: ["גשם קפוא", "rain"],
    71: ["שלג קל", "snow"], 73: ["שלג", "snow"], 75: ["שלג כבד", "snow"], 77: ["פתיתי שלג", "snow"],
    80: ["ממטרים", "rain"], 81: ["ממטרים", "rain"], 82: ["ממטרים עזים", "rain"], 85: ["ממטרי שלג", "snow"], 86: ["ממטרי שלג", "snow"],
    95: ["סופת רעמים", "storm"], 96: ["סופה עם ברד", "storm"], 99: ["סופה עם ברד", "storm"]
  };
  const wmo = code => { const w = WMO[code] || ["לא ידוע", "cloud"]; return { t: w[0], k: w[1] }; };

  /* Ride Index 0-100 for a window of hourly rows. Penalties reflect two-wheeler risk. */
  function rideIndex(w) {
    let i = 100; const why = [];
    if (w.maxP > 10) { i -= (w.maxP - 10) * 0.55; if (w.maxP >= 40) why.push(`סיכוי גשם ${Math.round(w.maxP)}%`); }
    if (w.sumMm > 0.2) { i -= Math.min(35, w.sumMm * 9); why.push(`${w.sumMm.toFixed(1)} מ״מ גשם`); }
    if (w.wet) { i -= 10; why.push("כביש רטוב מהלילה"); }
    if (w.maxGust > 35) { i -= (w.maxGust - 35) * 1.3; why.push(`משבי רוח ${Math.round(w.maxGust)} קמ״ש`); }
    if (w.minVis < 1000) { i -= 28; why.push("ערפל כבד"); } else if (w.minVis < 4000) { i -= 12; why.push("ערפל בבוקר"); }
    if (w.tMin < 8) { i -= (8 - w.tMin) * 2.5; why.push(`קר: ${Math.round(w.tMin)}°`); }
    if (w.tMax > 32) { i -= (w.tMax - 32) * 3; why.push(`חם: ${Math.round(w.tMax)}°`); }
    if (w.storm) { i -= 40; why.push("סופת רעמים"); }
    i = Math.max(0, Math.min(100, Math.round(i)));
    return { i, why, verdict: verdict(i) };
  }
  function verdict(i) {
    if (i >= 78) return { t: "שבת מושלמת לרכיבה", k: "go" };
    if (i >= 58) return { t: "רוכבים, עם עין פקוחה", k: "ok" };
    if (i >= 38) return { t: "גבולי. לבחור קטע קצר", k: "warn" };
    return { t: "השבת הזאת לא", k: "no" };
  }

  /* Summarise Open-Meteo hourly arrays between two local ISO hours (inclusive). */
  function windowStats(h, fromIso, toIso, wetFromIso) {
    const idx = []; h.time.forEach((t, k) => { if (t >= fromIso && t <= toIso) idx.push(k); });
    if (!idx.length) return null;
    const pick = key => idx.map(k => h[key] ? h[key][k] : null).filter(v => v !== null && v !== undefined);
    const mx = a => a.length ? Math.max(...a) : 0, mn = a => a.length ? Math.min(...a) : 0, sum = a => a.reduce((x, y) => x + y, 0);
    let wetMm = 0; if (wetFromIso) h.time.forEach((t, k) => { if (t >= wetFromIso && t < fromIso && h.precipitation) wetMm += h.precipitation[k] || 0; });
    const codes = pick("weather_code");
    return {
      idx, tMin: mn(pick("temperature_2m")), tMax: mx(pick("temperature_2m")), maxP: mx(pick("precipitation_probability")),
      sumMm: sum(pick("precipitation")), maxGust: mx(pick("wind_gusts_10m")), maxWind: mx(pick("wind_speed_10m")),
      minVis: pick("visibility").length ? mn(pick("visibility")) : 99999, wet: wetMm > 0.6, wetMm,
      storm: codes.some(c => c >= 95), fog: codes.some(c => c === 45 || c === 48) || (pick("visibility").length && mn(pick("visibility")) < 4000),
      code: codes.length ? mode(codes) : 0
    };
  }
  function mode(a) { const m = {}; let best = a[0], n = 0; a.forEach(v => { m[v] = (m[v] || 0) + 1; if (m[v] > n || (m[v] === n && v > best)) { n = m[v]; best = v; } }); return best; }

  /* Sun-glare: segment heading within 28° of a low sun (0-18° altitude). sunAt(date, lon, lat) -> {az, alt} in compass degrees. */
  function glareSegments(coords, startTime, kmh, sunAt) {
    const c = simplifyByDist(coords, 0.15); const out = []; let km = 0, run = null;
    for (let i = 1; i < c.length; i++) {
      const d = hav(c[i - 1], c[i]); const t = new Date(startTime.getTime() + (km / kmh) * 3600e3);
      const s = sunAt(t, c[i][0], c[i][1]); const b = bearing(c[i - 1], c[i]);
      const glare = s.alt > -1 && s.alt < 18 && angDiff(b, s.az) < 28;
      if (glare) { if (!run) run = { coords: [c[i - 1]], km: 0, at: t }; run.coords.push(c[i]); run.km += d; }
      else if (run) { if (run.km > 0.3) out.push(run); run = null; }
      km += d;
    }
    if (run && run.km > 0.3) out.push(run);
    return out;
  }

  /* Saturday helper in Asia/Jerusalem: returns {y,m,d,iso, isToday}. */
  function nextSaturday(now = new Date(), tz = "Asia/Jerusalem") {
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false, weekday: "short" }).formatToParts(now).map(p => [p.type, p.value]));
    const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday);
    let add = (6 - wd + 7) % 7; if (add === 0 && +parts.hour >= 15) add = 7;
    const base = Date.UTC(+parts.year, +parts.month - 1, +parts.day) + add * 864e5; const dt = new Date(base);
    const pad = n => String(n).padStart(2, "0");
    const iso = `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
    const prev = new Date(base - 864e5); const prevIso = `${prev.getUTCFullYear()}-${pad(prev.getUTCMonth() + 1)}-${pad(prev.getUTCDate())}`;
    return { iso, prevIso, isToday: add === 0, daysAway: add, noonUTC: new Date(base + 10 * 3600e3) };
  }

  /* Tiles covering a bbox at zoom z (slippy map). */
  function tilesForBbox(b, z) {
    const n = 2 ** z; const lon2x = lon => Math.floor(((lon + 180) / 360) * n);
    const lat2y = lat => Math.floor(((1 - Math.log(Math.tan(lat * R) + 1 / Math.cos(lat * R)) / Math.PI) / 2) * n);
    const out = []; for (let x = lon2x(b[0][0]); x <= lon2x(b[1][0]); x++) for (let y = lat2y(b[1][1]); y <= lat2y(b[0][1]); y++) out.push([z, x, y]);
    return out;
  }
  function tilesAlong(coords, z, pad = 1) {
    const n = 2 ** z, set = new Set();
    coords.forEach(([lon, lat]) => { const x = Math.floor(((lon + 180) / 360) * n), y = Math.floor(((1 - Math.log(Math.tan(lat * R) + 1 / Math.cos(lat * R)) / Math.PI) / 2) * n); for (let dx = -pad; dx <= pad; dx++) for (let dy = -pad; dy <= pad; dy++) set.add(`${z}/${x + dx}/${y + dy}`); });
    return [...set].map(s => s.split("/").map(Number));
  }

  /* OSM opening_hours → Saturday status. Covers the patterns used in Israel:
     "24/7", "Su-Th 06:00-22:00; Fr 06:00-15:00; Sa off", "Mo-Su 06:00-23:00", "Sa 08:00-14:00,17:00-22:00". */
  const DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
  function expandDays(spec) {
    const out = new Set();
    spec.split(",").map(x => x.trim()).filter(Boolean).forEach(part => {
      const m = part.match(/^(Mo|Tu|We|Th|Fr|Sa|Su)(?:-(Mo|Tu|We|Th|Fr|Sa|Su))?$/); if (!m) return;
      let a = DAYS.indexOf(m[1]); const b = m[2] ? DAYS.indexOf(m[2]) : a;
      for (let i = 0; i < 7; i++) { out.add(DAYS[a]); if (a === b) break; a = (a + 1) % 7; }
    });
    return out;
  }
  function saturdayHours(oh) {
    if (!oh || typeof oh !== "string") return { k: "unknown" };
    const s = oh.trim();
    if (/^24\/7$/i.test(s)) return { k: "open", t: "24/7", all: true };
    let res = null, sawRule = false;
    for (const raw of s.split(";")) {
      const rule = raw.trim(); if (!rule) continue;
      const m = rule.match(/^((?:(?:Mo|Tu|We|Th|Fr|Sa|Su)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))?\s*,?\s*)+)?(?:PH\s*,?\s*)?(.*)$/);
      if (!m) continue; sawRule = true;
      const days = m[1] ? expandDays(m[1].replace(/\s+/g, "")) : new Set(DAYS);
      if (!days.has("Sa")) continue;
      const times = (m[2] || "").trim();
      if (/^(off|closed)$/i.test(times)) res = { k: "closed" };
      else if (/^(24\/7|00:00-24:00)$/.test(times)) res = { k: "open", t: "24 שעות", all: true };
      else if (/\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}/.test(times)) { const t = times.match(/\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}/g).map(x => x.replace(/\s/g, "")).join(", "); res = { k: "open", t, all: t === "00:00-24:00" }; }
      else if (!res) res = { k: "unknown" };
    }
    if (res) return res;
    return sawRule ? { k: "closed", inferred: true } : { k: "unknown" };
  }

  /* Fuel plan along a route: start with a full tank, keep a 20% reserve, stop at the furthest usable station in reach. */
  function fuelPlan(stations, totalKm, rangeKm) {
    const usable = stations.filter(s => s.ok).sort((a, b) => a.km - b.km);
    const reach = rangeKm * 0.8; const plan = []; let pos = 0;
    while (totalKm - pos > reach) {
      const cand = usable.filter(s => s.km > pos + 2 && s.km <= pos + reach);
      if (!cand.length) { const nxt = usable.find(s => s.km > pos + 2); return { plan, gap: { from: Math.round(pos), to: Math.round(nxt ? nxt.km : totalKm), noMore: !nxt } }; }
      const nxt = cand[cand.length - 1]; plan.push(nxt); pos = nxt.km;
    }
    return { plan, gap: null };
  }

  /* Fuel along a route, litre by litre.
     Burn per km = the bike's published consumption x riding style x a road factor (straights are ridden
     faster, tight curves on lower gears with more throttle work), plus the energy to lift bike and rider:
     about 0.03 L per 100 m of net climb (m·g·h for ~280 kg at ~25% engine efficiency). Descents give
     nothing back. The planner then walks the route: at each station that suits the ride it refuels only
     if it can't reach the next suitable station (or the end) above the reserve. */
  const ROAD_F = [1.04, 1.0, 1.1, 1.18];
  function burnProfile({ totalKm, segs = [], elev = null, cons, style = 1.08, step = 0.25 }) {
    const n = Math.max(2, Math.ceil(totalKm / step) + 1), per = new Float64Array(n), cum = new Float64Array(n);
    let si = 0;
    const elAt = km => { if (!elev || !elev.el || !elev.el.length) return null; const f = Math.max(0, Math.min(1, km / (elev.km || totalKm))) * (elev.el.length - 1); const i = Math.floor(f), t = f - i; return elev.el[i] + ((elev.el[Math.min(i + 1, elev.el.length - 1)] - elev.el[i]) * t); };
    let prevEl = elAt(0);
    for (let i = 1; i < n; i++) {
      const km = Math.min(totalKm, i * step), mid = km - step / 2, d = km - Math.min(totalKm, (i - 1) * step);
      while (si < segs.length - 1 && segs[si].startKm + segs[si].km < mid) si++;
      const cls = segs[si] && segs[si].startKm <= mid ? segs[si].cls : 1;
      let l = d * cons / 100 * style * ROAD_F[cls] ;
      const e = elAt(km); if (e != null && prevEl != null && e > prevEl) l += (e - prevEl) * 0.0003; prevEl = e;
      per[i] = l; cum[i] = cum[i - 1] + l;
    }
    const at = km => { const f = Math.max(0, Math.min(n - 1, km / step)), i = Math.floor(f); return i >= n - 1 ? cum[n - 1] : cum[i] + (cum[i + 1] - cum[i]) * (f - i); };
    return { step, n, cum, at, total: cum[n - 1] };
  }
  function fuelSim({ totalKm, segs, elev, tank, cons, style = 1.08, startPct = 1, stations = [], reservePct = 0.15, minReserve = 2.5 }) {
    const P = burnProfile({ totalKm, segs, elev, cons, style });
    const reserve = Math.min(tank * 0.4, Math.max(minReserve, tank * reservePct));
    const ok = stations.filter(s => s.ok && s.km > 0.3 && s.km < totalKm - 0.3).sort((a, b) => a.km - b.km);
    const refuels = []; let fuel = tank * Math.max(0.05, Math.min(1, startPct)), pos = 0;
    const lvl = []; // [km, litres] break points for drawing
    lvl.push([0, fuel]);
    for (let k = 0; k <= ok.length; k++) {
      const s = ok[k], nextKm = s ? s.km : totalKm;
      fuel -= P.at(nextKm) - P.at(pos); pos = nextKm; lvl.push([pos, fuel]);
      if (!s) break;
      const nxt = ok[k + 1], needTo = nxt ? nxt.km : totalKm, need = P.at(needTo) - P.at(pos);
      if (fuel - need < reserve && fuel < tank - 0.5) { refuels.push(Object.assign({ before: fuel, liters: tank - fuel }, s)); fuel = tank; lvl.push([pos, fuel]); }
    }
    /* where the level first hits the reserve / runs dry (between break points, burn is monotonic) */
    const levelAt = km => { let base = lvl[0][1], from = 0; for (const [k, l] of lvl) { if (k > km) break; base = l; from = k; } return base - (P.at(km) - P.at(from)); };
    let lowAtKm = null, emptyAtKm = null; let minL = Infinity;
    for (let km = 0; km <= totalKm; km += 0.5) { const l = levelAt(km); minL = Math.min(minL, l); if (lowAtKm == null && l < reserve) lowAtKm = km; if (emptyAtKm == null && l <= 0) { emptyAtKm = km; break; } }
    const avgPerKm = P.total / Math.max(0.1, totalKm);
    return { profile: P, reserve, refuels, lowAtKm, emptyAtKm, endLiters: levelAt(totalKm), minLiters: minL, levelAt, burn: P.total, avgL100: avgPerKm * 100, rangeFull: (tank - reserve) / avgPerKm, rangeDry: tank / avgPerKm };
  }
  /* Litres left at a given km for a rider who left with startL and refilled to full at the given kms. */
  function fuelLeftAt(P, km, startL, tank, refillKms = []) {
    let from = 0, base = startL; refillKms.filter(k => k <= km).sort((a, b) => a - b).forEach(k => { from = k; base = tank; });
    return base - (P.at(km) - P.at(from));
  }
  /* Colour for a fuel fraction: green full → amber half → red near empty (HSL hue 140 → 0). */
  const fuelHue = f => Math.round(Math.max(0, Math.min(1, f)) ** 0.85 * 140);

  /* Route difficulty, 0-100 and five levels, from what the road actually does:
     curve density, climbing per km, steepest sampled grade, length, and a per-chapter road factor
     (narrow, no shoulders, traffic) set in the ride book. Elevation is optional. */
  const DIFF_LEVELS = [
    { n: 1, t: "שיוט", d: "מתאים גם לרוכבים בתחילת הדרך" },
    { n: 2, t: "זורם", d: "עיקולים נוחים, קצב רגוע" },
    { n: 3, t: "מאתגר", d: "דורש ניסיון בעיקולים ובירידות" },
    { n: 4, t: "טכני", d: "עיקולים צפופים ושיפועים. לרוכבים מנוסים" },
    { n: 5, t: "מומחים", d: "צר, תלול ובלי שוליים. ריכוז מלא" }
  ];
  function difficulty({ km, cstats, el, elKm, tech = 0.5 }) {
    const total = cstats && cstats.total ? cstats.total : 0;
    const curves = total ? Math.min(1, ((cstats.km[2] + 1.7 * cstats.km[3]) / total) / 0.55) : 0.3;
    let climb = null, grade = null;
    if (el && el.length > 2 && elKm) {
      climb = 0; grade = 0; const step = (elKm * 1000) / (el.length - 1);
      for (let i = 1; i < el.length; i++) { const d = el[i] - el[i - 1]; if (d > 0) climb += d; grade = Math.max(grade, Math.abs(d) / step * 100); }
    }
    const climbF = climb === null ? 0.4 : Math.min(1, (climb / Math.max(1, km)) / 26);
    const gradeF = grade === null ? 0.4 : Math.min(1, Math.max(0, (grade - 3) / 7));
    const distF = Math.min(1, km / 380);
    const parts = [
      { k: "עיקולים", v: curves, w: 0.36 }, { k: "טיפוס", v: climbF, w: 0.18 },
      { k: "שיפועים", v: gradeF, w: 0.12 }, { k: "אורך", v: distF, w: 0.14 }, { k: "אופי הכביש", v: tech, w: 0.2 }
    ];
    const score = Math.round(parts.reduce((a, p) => a + p.v * p.w, 0) * 100);
    const lvl = score < 32 ? 1 : score < 46 ? 2 : score < 60 ? 3 : score < 75 ? 4 : 5;
    return { score, level: DIFF_LEVELS[lvl - 1], parts, climb: climb === null ? null : Math.round(climb), grade: grade === null ? null : Math.round(grade * 10) / 10, provisional: climb === null };
  }

  /* ---------- territories: where a route is inside a polygon ring ([lon,lat]...) ---------- */
  function inRing(p, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if ((yi > p[1]) !== (yj > p[1]) && p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  /* Spans of the route inside the ring, with the crossing points refined to ~20 m. */
  function ringSpans(coords, ring) {
    if (!ring || !coords || coords.length < 2) return [];
    let w = 180, s = 90, e = -180, n = -90; ring.forEach(([x, y]) => { w = Math.min(w, x); e = Math.max(e, x); s = Math.min(s, y); n = Math.max(n, y); });
    const test = p => p[0] >= w && p[0] <= e && p[1] >= s && p[1] <= n && inRing(p, ring);
    const spans = []; let km = 0, prev = coords[0], prevIn = test(prev), cur = prevIn ? { fromKm: 0, enter: prev, startsInside: true } : null;
    for (let i = 1; i < coords.length; i++) {
      const p = coords[i], d = hav(prev, p), inside = test(p);
      if (inside !== prevIn) {
        let a = 0, b = 1; for (let k = 0; k < 12; k++) { const m = (a + b) / 2; const q = [prev[0] + (p[0] - prev[0]) * m, prev[1] + (p[1] - prev[1]) * m]; if (test(q) === prevIn) a = m; else b = m; }
        const x = [prev[0] + (p[0] - prev[0]) * b, prev[1] + (p[1] - prev[1]) * b], xk = km + d * b;
        if (inside) cur = { fromKm: xk, enter: x }; else if (cur) { cur.toKm = xk; cur.exit = x; spans.push(cur); cur = null; }
      }
      km += d; prev = p; prevIn = inside;
    }
    if (cur) { cur.toKm = km; cur.endsInside = true; spans.push(cur); }
    return spans;
  }

  /* ---------- turn-by-turn, in Hebrew ---------- */
  const DIRS = { left: "שמאלה", right: "ימינה", "slight left": "קלות שמאלה", "slight right": "קלות ימינה", "sharp left": "חדות שמאלה", "sharp right": "חדות ימינה", straight: "ישר", uturn: "פרסה" };
  const ORD = ["", "הראשונה", "השנייה", "השלישית", "הרביעית", "החמישית", "השישית", "השביעית"];
  const roadOf = m => { const ref = (m.ref || "").split(";")[0].trim(); if (/^\d+$/.test(ref)) return "כביש " + ref; return ref || m.name || ""; };
  function instruction(m) {
    const road = roadOf(m), to = road ? ` אל ${road}` : "", dir = DIRS[m.modifier] || "";
    switch (m.type) {
      case "depart": return road ? `צאו לדרך ב${road}` : "צאו לדרך";
      case "arrive": return m.last ? "הגעתם ליעד" : "הגעתם לעצירה";
      case "roundabout": case "rotary": return `בכיכר צאו ביציאה ${ORD[m.exit] || (m.exit ? "ה־" + m.exit : "")}${to}`.replace("  ", " ");
      case "roundabout turn": return `בכיכר פנו ${dir}${to}`;
      case "fork": return `בפיצול שמרו ${m.modifier && m.modifier.includes("left") ? "שמאלה" : "ימינה"}${to}`;
      case "merge": return road ? `השתלבו ב${road}` : "השתלבו בתנועה";
      case "on ramp": return road ? `עלו ל${road}` : `עלו לרמפה ${dir}`;
      case "off ramp": return `צאו ${dir || "מהכביש"}${road ? ` לכיוון ${road}` : ""}`;
      case "end of road": return `בסוף הדרך פנו ${dir}${to}`;
      case "continue": case "new name": return m.modifier && m.modifier !== "straight" ? `המשיכו ${dir}${to}` : `המשיכו ישר${to}`;
      case "turn": default: return m.modifier === "uturn" ? "בצעו פרסה" : m.modifier === "straight" ? `המשיכו ישר${to}` : `פנו ${dir}${to}`;
    }
  }
  /* Which maneuvers deserve a spoken prompt. */
  const speakable = m => !(m.type === "new name" || (m.type === "continue" && (!m.modifier || m.modifier === "straight")) || m.type === "depart");
  /* Arrow angle for the HUD icon (degrees, 0 = straight up). */
  const ARROW = { straight: 0, "slight right": 40, right: 90, "sharp right": 135, uturn: 180, "sharp left": -135, left: -90, "slight left": -40 };
  const arrowAngle = m => m.type === "arrive" ? null : (m.type === "roundabout" || m.type === "rotary") ? "rb" : (ARROW[m.modifier] ?? 0);

  /* ---------- fly-through path: resampled every `step` km and smoothed ---------- */
  function flyPath(coords, step = 0.015) {
    const cum = cumulative(coords), L = cum[cum.length - 1]; const n = Math.max(2, Math.min(40000, Math.ceil(L / step) + 1)); const st = L / (n - 1);
    const raw = new Array(n); let j = 0;
    for (let i = 0; i < n; i++) { const km = i * st; while (j < cum.length - 2 && cum[j + 1] < km) j++; const t = (km - cum[j]) / ((cum[j + 1] - cum[j]) || 1); raw[i] = [coords[j][0] + (coords[j + 1][0] - coords[j][0]) * t, coords[j][1] + (coords[j + 1][1] - coords[j][1]) * t]; }
    const box = (arr, w) => { const out = new Array(arr.length); let sx = 0, sy = 0, cnt = 0; const h = w >> 1;
      for (let i = -h; i < arr.length; i++) { const add = i + h; if (add < arr.length) { sx += arr[add][0]; sy += arr[add][1]; cnt++; } const rem = i - h - 1; if (rem >= 0) { sx -= arr[rem][0]; sy -= arr[rem][1]; cnt--; } if (i >= 0) out[i] = [sx / cnt, sy / cnt]; } return out; };
    const sm = box(box(raw, 7), 7);
    const look = Math.max(4, Math.round(0.16 / st)); const head = new Float32Array(n);
    for (let i = 0; i < n; i++) head[i] = bearing(sm[Math.max(0, i - 2)], sm[Math.min(n - 1, i + look)]);
    return { pts: sm, head, step: st, km: L, n };
  }

  g.BRL = { normQuery, looksLikeAddress, nearestOnLine, offRoute, offThreshold, burnProfile, fuelSim, fuelLeftAt, fuelHue, inRing, ringSpans, instruction, speakable, arrowAngle, roadOf, flyPath, difficulty, DIFF_LEVELS, saturdayHours, fuelPlan, hav, bearing, angDiff, cumulative, pointAt, sample, curveSegments, curveStats, curveClass, CURVE_LABEL, windChill, gear, wmo, rideIndex, verdict, windowStats, glareSegments, nextSaturday, tilesForBbox, tilesAlong, simplifyByDist };
})(typeof module !== "undefined" ? module.exports : window);
