/* Sends the weekend brief to every subscriber, handed over by brief-friday / brief-saturday (lib/brief-job.mjs).
   Background function: up to 15 minutes. It runs only a one-time job id the scheduled function stored. */
import { getStore } from "@netlify/blobs";
import { takeJob, briefPayload, MODES } from "./lib/brief-job.mjs";
import { sendAll } from "./lib/push.mjs";
import { opsLog } from "./lib/ops.mjs";
export default async req => {
  let body = {}; try { body = JSON.parse((await req.text()).slice(0, 200) || "{}"); } catch (e) { return; }
  const job = await takeJob(getStore({ name: "brn", consistency: "strong" }), body && body.job, Date.now()); if (!job) return;
  const what = job.mode === "friday" ? "תדריך שישי" : "עדכון שבת בבוקר";
  try { const r = await sendAll(briefPayload(job), MODES[job.mode].pref); console.log(job.mode, "brief", job.title, JSON.stringify(r)); await opsLog("push", "info", `${what} נשלח ל־${r.sent} מתוך ${r.total}`, r); }
  catch (e) { await opsLog("push", "error", `${what} נכשל: ` + e.message); }
};
