import { saveSub, removeSub, validSub, getSub } from "./lib/push.mjs";
export default async req => {
  let body = {}; try { const t = await req.text(); if (t.length > 4000) return new Response("too large", { status: 413 }); body = JSON.parse(t || "{}"); } catch (e) { return new Response("bad json", { status: 400 }); }
  if (req.method === "DELETE") { if (typeof body.endpoint !== "string") return new Response("missing endpoint", { status: 400 }); await removeSub(body.endpoint); return Response.json({ ok: true }); }
  if (req.method === "GET") return new Response("method", { status: 405 });
  if (body.check && typeof body.endpoint === "string") { const r = await getSub(body.endpoint); return Response.json({ ok: !!r, prefs: r ? r.prefs : null }); }
  if (!validSub(body.sub)) return new Response("bad subscription", { status: 400 });
  const prefs = await saveSub(body.sub, body.prefs);
  return Response.json({ ok: true, prefs });
};
export const config = { path: "/api/subscribe" };
