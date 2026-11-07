/* Operations log shared by every function: one blob per event (no read-modify-write races), plus small
   per-service counters. The admin "בקרה" view and the scheduled health scan read from here. */
import { getStore } from "@netlify/blobs";
export const opsStore = () => getStore({ name: "brn-ops", consistency: "strong" });
const rnd = () => Math.random().toString(36).slice(2, 7);
/* level: info | warn | error | critical */
export async function opsLog(service, level, msg, extra) {
  try { const t = Date.now(); await opsStore().setJSON(`l:${t}:${rnd()}`, { t, service, level, msg: String(msg).slice(0, 300), extra: extra ? JSON.stringify(extra).slice(0, 600) : undefined }); } catch (e) { }
}
/* monthly usage counter for paid/limited upstreams (HERE, Open-Meteo...) */
export async function bump(service, n = 1) {
  const m = new Date().toISOString().slice(0, 7), key = `u:${service}:${m}:${rnd()}`;
  try { await opsStore().setJSON(key, { n }); } catch (e) { }
}
export async function usage(service) {
  const m = new Date().toISOString().slice(0, 7); let n = 0;
  try { const { blobs } = await opsStore().list({ prefix: `u:${service}:${m}:` }); n = blobs.length; } catch (e) { }
  return n;
}
