/* GET /api/ping — {edge}: did this request come through the Cloudflare handshake (see lib/edge.mjs). Whether the
   secret is configured is not public; the admin sees it at GET /api/admin/edge.
   POST /api/ping — one anonymous "opened today" count per device per day (the app sends it once a day).
   No id, no IP, nothing personal: just a number per date for the admin's usage chart. */
import { edgeGate, publicPing } from "./lib/edge.mjs";
import { getStore } from "@netlify/blobs";
export default async req => {
  const gate = edgeGate(req); if (gate) return gate;
  // GET = handshake check for the Cloudflare setup: did this request arrive through our Cloudflare zone? (one boolean)
  if (req.method === "GET") return Response.json(publicPing(req), { headers: { "cache-control": "no-store" } });
  if (req.method !== "POST") return new Response("method", { status: 405 });
  const s = getStore({ name: "brn-stats", consistency: "strong" });
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date());
  const days = (await s.get("days", { type: "json" })) || {}; days[day] = (days[day] || 0) + 1;
  const keep = Object.keys(days).sort().slice(-180); await s.setJSON("days", Object.fromEntries(keep.map(k => [k, days[k]])));
  return new Response(null, { status: 204 });
};
export const config = { path: "/api/ping" };
