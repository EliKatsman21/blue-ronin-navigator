/* Friday afternoon: the Shabbat briefing to every subscriber who wants it.
   14:30 UTC = 16:30 in winter, 17:30 in summer (Israel). The brief is computed here once; the sending runs in
   brief-send-background (scheduled functions stop after 30 s), see lib/brief-job.mjs. */
import { getStore } from "@netlify/blobs";
import { computeBrief } from "./lib/brief.mjs";
import { dispatchBrief, briefPayload } from "./lib/brief-job.mjs";
import { sendAll } from "./lib/push.mjs";
import { opsLog } from "./lib/ops.mjs";
const BASE = () => Netlify.env.get("URL") || "https://blueronin.app";
export default async () => {
  try {
    const b = await computeBrief("friday");
    const r = await dispatchBrief({ store: getStore({ name: "brn", consistency: "strong" }), b, mode: "friday", now: Date.now(),
      trigger: id => fetch(BASE() + "/.netlify/functions/brief-send-background", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ job: id }) }),
      send: job => sendAll(briefPayload(job), "friday") });
    console.log("friday brief", b.title, JSON.stringify(r));
    if (!r.queued) await opsLog("push", "info", `תדריך שישי נשלח ל־${r.sent} מתוך ${r.total}`, r);
  } catch (e) { await opsLog("push", "error", "תדריך שישי נכשל: " + e.message); }
};
export const config = { schedule: "30 14 * * 5" };
