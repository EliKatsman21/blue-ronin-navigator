/* Saturday dawn update: 03:15 UTC = 05:15 in winter, 06:15 in summer (Israel).
   The brief is computed here once; the sending runs in
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
    const b = await computeBrief("saturday");
    const queuedAt = Date.now(); await noteQueued(ops, "saturday", queuedAt); /* R1: the monitor watches that a send follows */
    const r = await dispatchBrief({ store: getStore({ name: "brn", consistency: "strong" }), b, mode: "saturday", now: queuedAt, start,
      trigger: id => fetch(BASE() + "/.netlify/functions/brief-send-background", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ job: id }) }),
      send: (job, deadline) => sendAll(briefPayload(job), "saturday", { deadline }) });
    console.log("saturday brief", b.title, JSON.stringify(r));
    /* sent here (refused or never-run hand-off): record it and say why; sent by the background function: it logs */
    if (!r.queued) { await noteSent(ops, "saturday", Date.now(), r, queuedAt); await opsLog("push", r.how === "fallback" || r.cut ? "warn" : "info", sentLine("saturday", r) + (r.how === "fallback" ? " · מהפונקציה המתוזמנת: פונקציית הרקע לא רצה" : " · מהפונקציה המתוזמנת: ההעברה לרקע נדחתה"), r); }
  } catch (e) { await opsLog("push", "error", "עדכון שבת בבוקר נכשל: " + e.message); }
};
export const config = { schedule: "15 3 * * 6" };
