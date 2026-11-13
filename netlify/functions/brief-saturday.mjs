/* Saturday dawn update: 03:15 UTC = 05:15 in winter, 06:15 in summer (Israel).
   The brief is computed here once; the sending runs in
   brief-send-background (scheduled functions stop after 30 s), see lib/brief-job.mjs. */
import { getStore } from "@netlify/blobs";
import { computeBrief } from "./lib/brief.mjs";
import { dispatchBrief, briefPayload } from "./lib/brief-job.mjs";
import { sendAll } from "./lib/push.mjs";
import { opsLog } from "./lib/ops.mjs";
const BASE = () => Netlify.env.get("URL") || "https://blueronin.app";
export default async () => {
  try {
    const b = await computeBrief("saturday");
    const r = await dispatchBrief({ store: getStore({ name: "brn", consistency: "strong" }), b, mode: "saturday", now: Date.now(),
      trigger: id => fetch(BASE() + "/.netlify/functions/brief-send-background", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ job: id }) }),
      send: job => sendAll(briefPayload(job), "saturday") });
    console.log("saturday brief", b.title, JSON.stringify(r));
    if (!r.queued) await opsLog("push", "info", `עדכון שבת בבוקר נשלח ל־${r.sent} מתוך ${r.total}`, r);
  } catch (e) { await opsLog("push", "error", "עדכון שבת בבוקר נכשל: " + e.message); }
};
export const config = { schedule: "15 3 * * 6" };
