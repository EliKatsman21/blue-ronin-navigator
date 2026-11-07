/* Saturday dawn update: 03:15 UTC = 05:15 in winter, 06:15 in summer (Israel). */
import { computeBrief } from "./lib/brief.mjs";
import { sendAll } from "./lib/push.mjs";
import { opsLog } from "./lib/ops.mjs";
export default async () => {
  try {
    const b = await computeBrief("saturday");
    const r = await sendAll({ title: b.title, body: b.body, tag: "morning-" + b.sat, url: "./#brief" }, "saturday");
    console.log("saturday brief", b.title, JSON.stringify(r)); await opsLog("push", "info", `עדכון שבת בבוקר נשלח ל־${r.sent} מתוך ${r.total}`, r);
  } catch (e) { await opsLog("push", "error", "עדכון שבת בבוקר נכשל: " + e.message); }
};
export const config = { schedule: "15 3 * * 6" };
