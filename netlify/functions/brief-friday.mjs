/* Friday afternoon: the Shabbat briefing to every subscriber who wants it.
   14:30 UTC = 16:30 in winter, 17:30 in summer (Israel). The brief is computed here once; the sending runs in
   brief-send-background (scheduled functions stop after 30 s), see lib/brief-job.mjs. */
import { getStore } from "@netlify/blobs";
import { computeBrief } from "./lib/brief.mjs";
import { dispatchBrief, briefPayload, noteQueued, noteSent, sentLine } from "./lib/brief-job.mjs";
import { sendAll } from "./lib/push.mjs";
import { opsLog, opsStore } from "./lib/ops.mjs";
const BASE = () => Netlify.env.get("URL") || "https://blueronin.app";
export default async () => {
  const start = Date.now(), ops = opsStore();
  try {
    const b = await computeBrief("friday");
    const queuedAt = Date.now(); await noteQueued(ops, "friday", queuedAt); /* R1: the monitor watches that a send follows */
    const r = await dispatchBrief({ store: getStore({ name: "brn", consistency: "strong" }), b, mode: "friday", now: queuedAt, start,
      trigger: id => fetch(BASE() + "/.netlify/functions/brief-send-background", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ job: id }) }),
      send: (job, deadline) => sendAll(briefPayload(job), "friday", { deadline }) });
    console.log("friday brief", b.title, JSON.stringify(r));
    /* sent here (refused or never-run hand-off): record it and say why; sent by the background function: it logs */
    if (!r.queued) { await noteSent(ops, "friday", Date.now(), r, queuedAt); await opsLog("push", r.how === "fallback" || r.cut ? "warn" : "info", sentLine("friday", r) + (r.how === "fallback" ? " · מהפונקציה המתוזמנת: פונקציית הרקע לא רצה" : " · מהפונקציה המתוזמנת: ההעברה לרקע נדחתה"), r); }
  } catch (e) { await opsLog("push", "error", "תדריך שישי נכשל: " + e.message); }
};
export const config = { schedule: "30 14 * * 5" };
