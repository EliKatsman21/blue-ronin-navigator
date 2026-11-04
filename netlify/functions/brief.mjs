import { computeBrief } from "./lib/brief.mjs";
export default async req => {
  const mode = new URL(req.url).searchParams.get("mode") === "saturday" ? "saturday" : "friday";
  try { return Response.json(await computeBrief(mode), { headers: { "cache-control": "public, max-age=900" } }); }
  catch (e) { return Response.json({ error: String(e.message || e) }, { status: 502 }); }
};
export const config = { path: "/api/brief" };
