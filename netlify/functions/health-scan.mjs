/* Every 30 minutes: the automatic monitor (lib/health.mjs). */
import { runScan } from "./lib/health.mjs";
export default async () => { try { const r = await runScan(); console.log("health", r.overall, r.checks.filter(c => !c.ok).map(c => c.id).join(",")); } catch (e) { console.log("health scan failed", e.message); } };
export const config = { schedule: "*/30 * * * *" };
