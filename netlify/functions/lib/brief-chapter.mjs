/* The weekend push brief follows the rider's chosen built-in chapter (Eli, 2026-11-13, option 1).
   Pure helpers, no I/O, so they are unit-tested without Netlify:
   - CHAPTER_IDS / cleanChap: the only chapter ids a push subscription may store (validated server-side).
   - briefText: the title and body of the brief for one chapter (same wording as before for the best one).
   - pickMessage: which message a subscriber gets (their chapter, or the best one when it is unknown or missing).
   The brief already computes every chapter from one weather call, so per-chapter messages cost nothing extra. */
import dataMod from "../../../site/data.js";

export const CHAPTER_IDS = dataMod.BRD.CHAPTERS.map(c => c.id);
export const cleanChap = id => typeof id === "string" && CHAPTER_IDS.includes(id) ? id : "";

/* c = { title, ri: { i, verdict: { t }, why: [] }, agg: { tMin, tMax }, fog: [] }; ctx = { sunrise, depart, now, wmo } */
export function briefText(c, mode, ctx) {
  const temps = `${Math.round(c.agg.tMin)}°–${Math.round(c.agg.tMax)}°`;
  const warn = c.fog[0] || (c.ri.why[0] ? c.ri.why[0] : "בלי גשם, ערפל או רוח חריגה");
  if (mode === "saturday") return {
    title: c.ri.i < 38 ? "בוקר שבת · היום עדיף לוותר" : `בוקר שבת · ${c.title} ${c.ri.i}/100`,
    body: `עכשיו ${Math.round(ctx.now.temperature_2m ?? 0)}° ביוקנעם, ${ctx.wmo(ctx.now.weather_code).t}. ${warn}. זריחה ${ctx.sunrise}, יציאה מומלצת ${ctx.depart}.`
  };
  return {
    title: c.ri.i < 38 ? "תדריך שבת · השבת הזאת לא" : `תדריך שבת · ${c.title} ${c.ri.i}/100`,
    body: `${c.ri.verdict.t}. ${temps} בבוקר. ${warn}. זריחה ${ctx.sunrise}.`
  };
}

/* messages = { best: {title, body}, byChap: { [id]: {title, body} } } */
export const pickMessage = (messages, chap) => (chap && messages.byChap && messages.byChap[chap]) || messages.best;
