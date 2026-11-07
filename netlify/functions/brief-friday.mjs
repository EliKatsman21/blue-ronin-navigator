/* Friday afternoon: the Shabbat briefing to every subscriber who wants it.
   14:30 UTC = 16:30 in winter, 17:30 in summer (Israel). */
import { computeBrief } from "./lib/brief.mjs";
import { sendAll } from "./lib/push.mjs";
import { opsLog } from "./lib/ops.mjs";
export default async () => {
  try {
    const b = await computeBrief("friday");
    const r = await sendAll({ title: b.title, body: b.body, tag: "brief-" + b.sat, url: "./#brief" }, "friday");
    console.log("friday brief", b.title, JSON.stringify(r)); await opsLog("push", "info", `תדריך שישי נשלח ל־${r.sent} מתוך ${r.total}`, r);
  } catch (e) { await opsLog("push", "error", "תדריך שישי נכשל: " + e.message); }
};
export const config = { schedule: "30 14 * * 5" };
