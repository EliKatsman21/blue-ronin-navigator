/* The automatic monitor. Every 30 minutes (and on demand from the admin console) it checks the whole chain a
   rider depends on: our site and API, the shared caches, every outside service, the field error reports and
   the ops log. Results are kept for the console; a problem that persists across two scans (or anything critical)
   opens an incident and pushes an alert to the admin's phone, and a recovery closes it with a second push.
   It also fixes what it safely can by itself: stale OSM layers are re-queued and old records are pruned. */
import { getStore } from "@netlify/blobs";
import { opsStore, opsLog, usage } from "./ops.mjs";
import { sendOne } from "./push.mjs";
import { subsCap } from "./push-core.mjs";
import { briefWatch } from "./brief-job.mjs";
import { sweepFeedback, mediaUse } from "./feedback-core.mjs";

const errStore = () => getStore({ name: "brn-err", consistency: "strong" });
const subsStore = () => getStore({ name: "brn-subs", consistency: "strong" });
const fbStores = () => ({ fb: getStore({ name: "brn-feedback", consistency: "strong" }), media: getStore({ name: "brn-fb-media", consistency: "strong" }) });
const BASE = () => Netlify.env.get("URL") || "https://blueronin.app";
const MIN = 6e4, HOUR = 36e5;

/* what each check means for riders, and what to do about it */
export const PLAYBOOK = {
  site: ["האתר", "critical", "האתר לא נטען. לבדוק ב־Netlify את הפריסה האחרונה ולהחזיר גרסה קודמת (Rollback) אם צריך."],
  appjs: ["קוד האפליקציה", "critical", "app.js לא נטען או חסר גרסה. כנראה פריסה שבורה: Rollback ב־Netlify."],
  blobs: ["אחסון השרת", "critical", "Netlify Blobs לא עונה. רוב הפיצ׳רים בשרת מושבתים. לבדוק את דף הסטטוס של Netlify."],
  content: ["תוכן ציבורי", "high", "/api/content לא עונה: הודעות, פרקים ומתגים לא יתעדכנו. לבדוק את הפונקציה ב־Netlify."],
  wx: ["מזג אוויר", "high", "שרת התחזית שלנו לא מחזיר נתונים. המטמון בטלפונים מגן כמה שעות. אם נמשך: לבדוק מכסת Open-Meteo."],
  osm: ["שכבות OSM", "normal", "השכבות (דלק, מצפורים, קפה) ישנות. הסורק כבר הפעיל רענון. אם נמשך יומיים: Overpass עמוס."],
  tiles: ["מפות OpenFreeMap", "critical", "שרת המפות לא עונה: המפה ריקה למי שאין לו מטמון. אם נמשך מעל שעה, לשקול סגנון גיבוי."],
  libs: ["ספריות המפה", "critical", "MapLibre או SunCalc לא נטענים מהאתר (site/vendor). כנראה פריסה שבורה: Rollback ב־Netlify."],
  osrm: ["ניתוב OSRM", "normal", "שרת הניתוב לא עונה: בניית מסלול וניווט מחדש בזמן רכיבה נפגעים. המסלולים המובנים שמורים."],
  geo: ["חיפוש כתובות (HERE)", "normal", "מכסת החיפושים החודשית מתקרבת לסוף. מעבר לה האפליקציה עוברת לחיפוש החלופי (פחות מדויק במספרי בתים). אפשר להעלות HERE_GEO_CAP אם יש יתרה."],
  traffic: ["תנועה (HERE)", "normal", "מכסת HERE החודשית מתקרבת לסוף. אפשר להעלות את HERE_MONTHLY_CAP אם יש יתרה בחשבון."],
  field: ["תקלות מהשטח", "high", "קפיצה בתקלות מהטלפונים. לפתוח את ״בעיות מובילות״ ולבדוק איזו גרסה ואיזה מכשיר."],
  boot: ["פתיחת האפליקציה", "critical", "טלפונים לא מצליחים לפתוח את האפליקציה. לבדוק את התקלות האחרונות ולשקול Rollback."],
  ops: ["יומן השרת", "high", "שגיאות בפונקציות השרת. הפירוט ביומן למטה."],
  fbmedia: ["תמונות משוב", "normal", "תמונות והקלטות המשוב של היום הגיעו ל־80% מהמכסה היומית. מעבר למכסה דיווחים מתקבלים בלי תמונות. אם זה רוכבים אמיתיים, אפשר להעלות את FB_MEDIA_DAILY_MB; אם זו הצפה, לבדוק את התיבה ולשקול חסימה ב־Cloudflare."],
  brief: ["תדריך סופ״ש", "high", "התדריך הועבר לשליחה אבל לא נרשמה שליחה תוך 20 דקות: פונקציית הרקע (brief-send-background) כנראה לא רצה. לבדוק את הלוגים שלה ב־Netlify. רוכבים לא קיבלו את התדריך השבוע."],
  push: ["התראות", "normal", "מספר המנויים להתראות הגיע ל־90% מהתקרה (PUSH_SUBS_CAP, ברירת מחדל 20000). מעבר לתקרה הרשמות חדשות נדחות. אם אלה רוכבים אמיתיים, אפשר להעלות את PUSH_SUBS_CAP; אם זו הצפה, לבדוק ולשקול חסימה ב־Cloudflare."]
};

async function probe(url, opts = {}) {
  const t0 = Date.now();
  try { const r = await fetch(url, { method: opts.method || "GET", headers: { "user-agent": "BlueRoninMonitor/1 (+https://blueronin.app)", ...(opts.headers || {}) }, signal: AbortSignal.timeout(opts.timeout || 9000) });
    const body = opts.text || opts.json ? await r.text() : ""; return { ok: r.ok, status: r.status, ms: Date.now() - t0, body, json: opts.json ? (() => { try { return JSON.parse(body); } catch (e) { return null; } })() : null };
  } catch (e) { return { ok: false, status: 0, ms: Date.now() - t0, err: String(e.message || e).slice(0, 120) }; }
}
const fp = x => `${x.kind}|${String(x.msg || "").replace(/\d+/g, "#").replace(/https?:\/\/\S+/g, "").slice(0, 120)}|${String(x.src || "").split("?")[0].split("/").pop()}`;
export { fp as fingerprint };

export async function runScan({ manual = false } = {}) {
  const now = Date.now(), base = BASE(), ops = opsStore(), checks = [];
  const add = (id, ok, detail, ms, level) => checks.push({ id, name: PLAYBOOK[id][0], ok, level: ok ? "ok" : (level || PLAYBOOK[id][1]), detail: String(detail || "").slice(0, 200), ms: ms ?? null });
  const state = (await ops.get("state", { type: "json" }).catch(() => null)) || { fails: {}, open: {}, lastScan: 0, seen: [] };
  const since = state.lastScan || now - 30 * MIN;

  const [site, app, content, wx, osm, tiles, ml, sc, osrm] = await Promise.all([
    probe(base + "/", { text: true }), probe(base + "/app.js", { text: true }), probe(base + "/api/content", { json: true }),
    probe(base + "/api/wx?p=32.65,35.10", { json: true, timeout: 14000 }), probe(base + "/api/osm?v=4", { json: true, timeout: 14000 }),
    probe("https://tiles.openfreemap.org/styles/liberty", { text: true }),
    probe(base + "/vendor/maplibre-gl/4.7.1/maplibre-gl.js", { method: "HEAD" }), probe(base + "/vendor/suncalc/1.9.0/suncalc.js", { method: "HEAD" }),
    probe("https://router.project-osrm.org/route/v1/driving/35.105,32.651;35.12,32.66?overview=false", { json: true })
  ]);
  add("site", site.ok && /app\.js/.test(site.body), site.ok ? `${site.status} · ${site.ms} מ״ש` : site.err || "HTTP " + site.status, site.ms);
  const ver = (app.body.match(/APP_VER = "([0-9.]+)"/) || [])[1];
  add("appjs", app.ok && !!ver, ver ? `גרסה ${ver}` : app.err || "HTTP " + app.status, app.ms);
  let blobOk = false; try { await ops.setJSON("ping", { t: now }); blobOk = ((await ops.get("ping", { type: "json" })) || {}).t === now; } catch (e) { }
  add("blobs", blobOk, blobOk ? "כתיבה וקריאה תקינות" : "כתיבה או קריאה נכשלה");
  add("content", content.ok && content.json, content.ok ? `${content.ms} מ״ש` : content.err || "HTTP " + content.status, content.ms);
  const wxOk = wx.ok && wx.json && Array.isArray(wx.json.data) && wx.json.data[0] && wx.json.data[0].hourly;
  add("wx", wxOk && wx.json.src !== "stale", wxOk ? (wx.json.src === "stale" ? `מגיש מהמטמון (${Math.round((now - wx.json.t) / MIN)} דק׳). Open-Meteo: ${wx.json.note || "לא זמין"}` : `${wx.json.src === "cache" ? "מהמטמון" : "חי"} · ${wx.ms} מ״ש`) : wx.err || (wx.json && wx.json.error) || "HTTP " + wx.status, wx.ms, wxOk ? "normal" : null);
  const osmAge = osm.json && osm.json.ts ? (now - osm.json.ts) / HOUR : null;
  add("osm", osm.ok && osmAge != null && osmAge < 36 && (osm.json.fuel || []).length > 50, osm.ok ? `עודכן לפני ${osmAge != null ? osmAge.toFixed(0) : "?"} שעות · ${(osm.json && osm.json.fuel || []).length} תחנות` : osm.err || "HTTP " + osm.status, osm.ms);
  if (osm.ok && osmAge != null && osmAge > 30 && (!state.osmKick || now - state.osmKick > 6 * HOUR)) { state.osmKick = now; fetch(base + "/.netlify/functions/osm-refresh-background", { method: "POST" }).catch(() => { }); await opsLog("monitor", "info", "השכבות ישנות: הופעל רענון אוטומטי"); }
  add("tiles", tiles.ok && /"layers"/.test(tiles.body), tiles.ok ? `${tiles.ms} מ״ש` : tiles.err || "HTTP " + tiles.status, tiles.ms);
  add("libs", ml.ok && sc.ok, ml.ok && sc.ok ? `MapLibre ${ml.ms} · SunCalc ${sc.ms} מ״ש` : `MapLibre ${ml.status || ml.err} · SunCalc ${sc.status || sc.err}`);
  add("osrm", osrm.ok && osrm.json && osrm.json.code === "Ok", osrm.ok ? `${osrm.ms} מ״ש` : osrm.err || "HTTP " + osrm.status, osrm.ms);
  if (Netlify.env.get("HERE_API_KEY")) { const cap = +(Netlify.env.get("HERE_MONTHLY_CAP") || 4500), n = await usage("here"), pct = n / cap; add("traffic", pct < 0.8, `${n} מתוך ${cap} קריאות החודש (${Math.round(pct * 100)}%)`, null, pct >= 1 ? "high" : "normal");
    const gc = +(Netlify.env.get("HERE_GEO_CAP") || 9000), gn = await usage("heregeo"), gp = gn / gc; add("geo", gp < 0.8, `${gn} מתוך ${gc} חיפושים החודש (${Math.round(gp * 100)}%)`, null, gp >= 1 ? "high" : "normal"); }

  /* field errors since the last scan */
  let recent = [], all = [];
  try { const { blobs } = await errStore().list({ prefix: "e:" }); const keys = blobs.map(b => b.key).sort();
    const newer = keys.filter(k => +k.split(":")[1] > since).slice(-120); recent = (await Promise.all(newer.map(k => errStore().get(k, { type: "json" }).catch(() => null)))).filter(Boolean); all = keys; } catch (e) { }
  const bootFails = recent.filter(x => x.kind === "boot" || x.kind === "load" || x.boot);
  add("boot", bootFails.length < 3, bootFails.length ? `${bootFails.length} כשלי פתיחה מאז הסריקה הקודמת` : "אין כשלי פתיחה");
  const real = recent.filter(x => !["boot", "load", "storage"].includes(x.kind) && !/^weather/.test(x.kind));
  const groups = {}; real.forEach(x => { const k = fp(x); groups[k] = (groups[k] || 0) + 1; });
  const newKinds = Object.keys(groups).filter(k => !(state.seen || []).includes(k));
  add("field", real.length < 8, real.length ? `${real.length} תקלות ב־${Object.keys(groups).length} סוגים${newKinds.length ? ` · ${newKinds.length} חדשים` : ""}` : "שקט");
  state.seen = [...new Set([...(state.seen || []), ...Object.keys(groups)])].slice(-400);

  /* server-side log since the last scan */
  let logs = []; try { const { blobs } = await ops.list({ prefix: "l:" }); const ks = blobs.map(b => b.key).filter(k => +k.split(":")[1] > since).slice(-200); logs = (await Promise.all(ks.map(k => ops.get(k, { type: "json" }).catch(() => null)))).filter(Boolean); } catch (e) { }
  const own = logs.filter(l => l.service !== "monitor"); /* the monitor's own alerts must not feed back into this check */
  const bad = own.filter(l => l.level === "error" || l.level === "critical"), crit = own.filter(l => l.level === "critical");
  add("ops", !bad.length, bad.length ? `${bad.length} שגיאות: ${[...new Set(bad.map(l => l.service))].join(", ")} · ${bad[bad.length - 1].msg}` : "אין שגיאות", null, crit.length ? "critical" : null);
  /* feedback media: today's use against the daily budget (one list). The sweep runs after the record is saved. */
  try { const sw = await mediaUse({ media: fbStores().media, now, budgetMb: Netlify.env.get("FB_MEDIA_DAILY_MB") });
    const mb = n => (n / 1048576).toFixed(1); add("fbmedia", sw.pct < 0.8, `${mb(sw.used)} מתוך ${mb(sw.cap)} MB היום (${Math.round(sw.pct * 100)}%)`, null, sw.pct >= 1 ? "high" : "normal"); } catch (e) { }
  let subs = 0; try { subs = (await subsStore().list()).blobs.length; } catch (e) { }
  { const cap = subsCap(Netlify.env.get("PUSH_SUBS_CAP")), pct = subs / cap; /* N2: alert at 90% of the cap on subscriptions */
    add("push", pct < 0.9, `${subs} מנויים להתראות מתוך תקרה של ${cap} (${Math.round(pct * 100)}%)`, null, pct >= 1 ? "high" : "normal"); }

  /* R1: a weekend brief that was queued but never recorded as sent within 20 minutes */
  try { const bw = briefWatch(await ops.get("brief", { type: "json" }), now); add("brief", bw.ok, bw.detail); } catch (e) { }

  /* incidents: open after two failing scans in a row (one, for critical or a missed brief: it will not fix itself), close on recovery */
  const alerts = [];
  for (const c of checks) {
    const f = c.ok ? 0 : (state.fails[c.id] || 0) + 1; state.fails[c.id] = f; const open = state.open[c.id];
    if (!c.ok && !open && (f >= 2 || c.level === "critical" || c.id === "brief")) { state.open[c.id] = { id: c.id, title: c.name, level: c.level, since: now, last: now, detail: c.detail, hint: PLAYBOOK[c.id][2], n: 1 }; alerts.push({ kind: "open", c }); }
    else if (!c.ok && open) { open.last = now; open.n++; open.detail = c.detail; if (c.level === "critical" && open.level !== "critical") { open.level = "critical"; alerts.push({ kind: "open", c }); } }
    else if (c.ok && open) { const dur = Math.round((now - open.since) / MIN); delete state.open[c.id]; alerts.push({ kind: "close", c, dur }); const hist = (await ops.get("incidents", { type: "json" }).catch(() => null)) || []; hist.unshift(Object.assign({}, open, { closed: now })); await ops.setJSON("incidents", hist.slice(0, 60)); }
  }
  for (const k of newKinds.slice(0, 3)) await opsLog("monitor", "info", "סוג תקלה חדש מהשטח: " + k.split("|")[1]);
  const overall = checks.some(c => !c.ok && c.level === "critical") ? "critical" : checks.some(c => !c.ok && c.level === "high") ? "degraded" : checks.some(c => !c.ok) ? "warn" : "ok";
  const rec = { t: now, manual, overall, ver, checks };
  await ops.setJSON(`h:${String(now).padStart(14, "0")}`, rec);
  state.lastScan = now; state.overall = overall; await ops.setJSON("state", state);
  if (alerts.length) await notifyAdmins(alerts);

  /* housekeeping: keep ~5 days of scans, 14 days of log, this and last month's usage counters, 300 field reports */
  try {
    const { blobs } = await ops.list(); const keys = blobs.map(b => b.key);
    const hs = keys.filter(k => k.startsWith("h:")).sort(); for (const k of hs.slice(0, Math.max(0, hs.length - 240))) await ops.delete(k);
    for (const k of keys.filter(k => k.startsWith("l:") && now - +k.split(":")[1] > 14 * 24 * HOUR).slice(0, 300)) await ops.delete(k);
    const m0 = new Date(now).toISOString().slice(0, 7), m1 = new Date(now - 32 * 24 * HOUR).toISOString().slice(0, 7);
    for (const k of keys.filter(k => k.startsWith("u:") && !k.includes(":" + m0 + ":") && !k.includes(":" + m1 + ":")).slice(0, 500)) await ops.delete(k);
    if (all.length > 320) for (const k of all.slice(0, all.length - 300)) await errStore().delete(k);
  } catch (e) { }
  /* N1: the feedback sweep runs last, after the record and the state are saved, in batches with a time budget
     (a flood of rate markers can never cost the scan its result; what is left waits for the next scan) */
  try { const sw = await sweepFeedback({ ...fbStores(), now, budgetMb: Netlify.env.get("FB_MEDIA_DAILY_MB"), budgetMs: manual ? 3000 : 8000 });
    if (sw.orphans || sw.more) await opsLog("monitor", "info", `ניקוי משוב: ${sw.orphans} קובצי מדיה בלי דיווח, ${sw.markers} סימונים${sw.more ? " · נשאר עוד, ימשיך בסריקה הבאה" : ""}`, sw); } catch (e) { }
  return rec;
}

/* push to every admin device that opted in (stored separately from riders' subscriptions) */
export async function notifyAdmins(alerts) {
  const ops = opsStore(); let list = []; try { list = (await ops.list({ prefix: "adminsub:" })).blobs; } catch (e) { return 0; }
  const opens = alerts.filter(a => a.kind === "open"), closes = alerts.filter(a => a.kind === "close");
  const crit = opens.some(a => a.c.level === "critical");
  const title = opens.length ? `${crit ? "🔴" : "🟠"} Blue Ronin · ${opens.map(a => a.c.name).join(", ")}` : `🟢 Blue Ronin · חזר לפעול: ${closes.map(a => a.c.name).join(", ")}`;
  const body = opens.length ? opens.map(a => `${a.c.detail}. ${PLAYBOOK[a.c.id][2]}`).join("\n").slice(0, 300) : closes.map(a => `${a.c.name} תקין שוב אחרי ${a.dur} דק׳`).join("\n");
  let sent = 0;
  for (const b of list) { const rec = await ops.get(b.key, { type: "json" }).catch(() => null); if (!rec) continue;
    const r = await sendOne({ sub: rec.sub }, { title, body, tag: "ops-" + (opens[0] ? opens[0].c.id : "ok"), url: "/admin#monitor", sos: crit }, { urgency: crit ? "high" : "normal", ttl: 6 * 3600 }).catch(() => "fail");
    /* H1: an admin device is removed only when the push service says it is gone (404/410), never on a failure */
    if (r === "ok") { sent++; if (rec.fails) { rec.fails = 0; await ops.setJSON(b.key, rec); } }
    else if (r === "gone") await ops.delete(b.key).catch(() => { });
    else { rec.fails = (rec.fails || 0) + 1; await ops.setJSON(b.key, rec).catch(() => { }); } }
  await opsLog("monitor", opens.length ? (crit ? "critical" : "warn") : "info", `${opens.length ? "נפתחה תקלה" : "תקלה נסגרה"}: ${(opens.length ? opens : closes).map(a => a.c.name).join(", ")} · נשלח ל־${sent} מכשירי מנהל`);
  return sent;
}
