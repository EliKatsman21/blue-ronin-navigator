/* Saturday dawn update: 03:15 UTC = 05:15 in winter, 06:15 in summer (Israel). */
import { computeBrief } from "./lib/brief.mjs";
import { sendAll } from "./lib/push.mjs";
export default async () => {
  const b = await computeBrief("saturday");
  const r = await sendAll({ title: b.title, body: b.body, tag: "morning-" + b.sat, url: "./#brief" }, "saturday");
  console.log("saturday brief", b.title, JSON.stringify(r));
};
export const config = { schedule: "15 3 * * 6" };
