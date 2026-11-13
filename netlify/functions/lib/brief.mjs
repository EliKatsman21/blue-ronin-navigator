/* Server-side Shabbat briefing — same ride logic and data the app uses. */
import logicMod from "../../../site/logic.js";
import dataMod from "../../../site/data.js";
import SunCalc from "suncalc";
import { briefText } from "./brief-chapter.mjs";

const L = logicMod.BRL;
const { CHAPTERS } = dataMod.BRD;
const TZ = "Asia/Jerusalem";
const hhmm = d => new Intl.DateTimeFormat("he-IL", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TZ }).format(d);

function points() {
  const pts = [];
  CHAPTERS.filter(c => !c.combo).forEach(c => { const s = c.stops; [s[0], s[Math.floor(s.length / 2)], s[s.length - 1]].forEach(p => pts.push({ lat: p.lat, lon: p.lon, name: p.name.split(" · ")[0], chap: c.id })); });
  pts.push({ lat: 32.651, lon: 35.105, name: "יוקנעם", chap: "now" });
  return pts;
}

export async function computeBrief(mode = "friday") {
  const sat = L.nextSaturday(new Date());
  const pts = points();
  const url = "https://api.open-meteo.com/v1/forecast?latitude=" + pts.map(p => p.lat.toFixed(3)).join(",") + "&longitude=" + pts.map(p => p.lon.toFixed(3)).join(",") +
    "&hourly=temperature_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,visibility" +
    "&current=temperature_2m,weather_code,wind_speed_10m,visibility&forecast_days=9&timezone=Asia%2FJerusalem&wind_speed_unit=kmh";
  const r = await fetch(url, { headers: { "user-agent": "BlueRoninNavigator/1.0" } });
  if (!r.ok) throw new Error("open-meteo " + r.status);
  const arr = await r.json(); const wx = Array.isArray(arr) ? arr : [arr];

  const chapters = CHAPTERS.map(c => {
    const ids = c.combo || [c.id];
    const rows = []; pts.forEach((p, i) => { if (!ids.includes(p.chap)) return; const w = L.windowStats(wx[i].hourly, `${sat.iso}T06:00`, `${sat.iso}T12:00`, `${sat.prevIso}T20:00`); if (w) rows.push({ p, w, i }); });
    if (!rows.length) return null;
    const agg = { tMin: Math.min(...rows.map(x => x.w.tMin)), tMax: Math.max(...rows.map(x => x.w.tMax)), maxP: Math.max(...rows.map(x => x.w.maxP)), sumMm: Math.max(...rows.map(x => x.w.sumMm)), maxGust: Math.max(...rows.map(x => x.w.maxGust)), minVis: Math.min(...rows.map(x => x.w.minVis)), wet: rows.some(x => x.w.wet), storm: rows.some(x => x.w.storm), fog: rows.some(x => x.w.fog) };
    const fog = [];
    rows.forEach(x => { const h = wx[x.i].hourly; for (let hr = 5; hr <= 10; hr++) { const k = h.time.indexOf(`${sat.iso}T${String(hr).padStart(2, "0")}:00`); if (k >= 0 && h.visibility && h.visibility[k] < 3000) { fog.push(`ערפל ב${x.p.name} סביב ${String(hr).padStart(2, "0")}:00`); break; } } });
    return { id: c.id, title: c.title, agg, ri: L.rideIndex(agg), fog };
  }).filter(Boolean);

  const best = chapters.filter(c => !CHAPTERS.find(x => x.id === c.id).combo).sort((a, b) => b.ri.i - a.ri.i)[0];
  const t = SunCalc.getTimes(sat.noonUTC, 32.651, 35.105);
  const sunrise = hhmm(t.sunrise), depart = hhmm(new Date(t.sunrise.getTime() + 15 * 6e4));
  const now = wx[wx.length - 1].current || {};
  const temps = c => `${Math.round(c.agg.tMin)}°–${Math.round(c.agg.tMax)}°`;
  const ctx = { sunrise, depart, now, wmo: L.wmo };

  /* the general message (best chapter) and one per chapter, for riders who chose a built-in chapter */
  const { title, body } = best ? briefText(best, mode, ctx) : { title: "תדריך שבת", body: "התחזית לשבת עוד לא זמינה." };
  const byChap = {}; for (const c of chapters) byChap[c.id] = briefText(c, mode, ctx);
  return {
    mode, sat: sat.iso, sunrise, depart, title, body, messages: { best: { title, body }, byChap },
    best: best ? { id: best.id, title: best.title, i: best.ri.i, verdict: best.ri.verdict } : null,
    chapters: chapters.map(c => ({ id: c.id, title: c.title, i: c.ri.i, verdict: c.ri.verdict.t, why: c.ri.why, fog: c.fog, temps: temps(c) }))
  };
}
