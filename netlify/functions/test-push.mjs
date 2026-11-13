import { edgeGate } from "./lib/edge.mjs";
import { getSub, sendOne } from "./lib/push.mjs";
import { computeBrief } from "./lib/brief.mjs";
export default async req => {
  const gate = edgeGate(req); if (gate) return gate;
  if (req.method !== "POST") return new Response("method", { status: 405 });
  let body = {}; try { body = await req.json(); } catch (e) { return new Response("bad json", { status: 400 }); }
  const rec = typeof body.endpoint === "string" ? await getSub(body.endpoint) : null;
  if (!rec) return new Response("not subscribed", { status: 404 });
  let p; try { const b = await computeBrief("friday"); p = { title: "בדיקה · " + b.title, body: b.body, tag: "test" }; }
  catch (e) { p = { title: "Blue Ronin מחובר", body: "ההתראות עובדות. התדריך הבא יגיע בשישי אחר הצהריים.", tag: "test" }; }
  const r = await sendOne(rec, p); /* "ok" | "gone" | "fail" (H1) */
  return Response.json({ ok: r === "ok" });
};
export const config = { path: "/api/test-push" };
