/* Friday afternoon: the Shabbat briefing to every subscriber who wants it.
   14:30 UTC = 16:30 in winter, 17:30 in summer (Israel). */
import { computeBrief } from "./lib/brief.mjs";
import { pickMessage, cleanChap } from "./lib/brief-chapter.mjs";
import { sendAll } from "./lib/push.mjs";
import { opsLog } from "./lib/ops.mjs";
export default async () => {
  try {
    const b = await computeBrief("friday");
    /* each rider gets the brief for the built-in chapter they chose (best chapter when none or unknown) */
    const r = await sendAll(rec => { const m = pickMessage(b.messages, cleanChap(rec.chap)); return { title: m.title, body: m.body, tag: "brief-" + b.sat, url: "./#brief" }; }, "friday");
    console.log("friday brief", b.title, JSON.stringify(r)); await opsLog("push", "info", `תדריך שישי נשלח ל־${r.sent} מתוך ${r.total}`, r);
  } catch (e) { await opsLog("push", "error", "תדריך שישי נכשל: " + e.message); }
};
export const config = { schedule: "30 14 * * 5" };
