/* Cloudflare edge handshake.
   Requests that pass through our Cloudflare zone carry `x-br-edge: <EDGE_SECRET>`, set by a Cloudflare request-header
   transform rule (it overwrites anything a visitor sends). Only those requests are allowed to tell us the visitor's
   real address through `cf-connecting-ip`; a request that reaches Netlify directly keeps Netlify's own connection IP,
   so nobody can fake an address to slip past the per-IP throttles.
   EDGE_ENFORCE=1 (Netlify env) makes every /api function refuse requests that did not come through Cloudflare.
   Leave it unset until the zone is active and verified, or the app loses its API. */
import { timingSafeEqual } from "node:crypto";
const env = k => { try { return (globalThis.Netlify?.env?.get(k) ?? process.env[k]) || ""; } catch (e) { return process.env[k] || ""; } };
const same = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && timingSafeEqual(x, y); };

export function viaEdge(req) {
  const s = env("EDGE_SECRET"), h = req.headers.get("x-br-edge");
  return s.length >= 24 && !!h && same(h, s);
}
/* true when the function can read a usable EDGE_SECRET (the value itself never leaves the server). */
export const edgeReady = () => env("EDGE_SECRET").length >= 24;
/* The public GET /api/ping answer (security review L4): only whether this request came through our edge.
   Whether EDGE_SECRET is configured ("ready") is shown to the admin only (GET /api/admin/edge). */
export const publicPing = req => ({ edge: viaEdge(req) });
export const adminPing = req => ({ edge: viaEdge(req), ready: edgeReady() });
export function clientIp(req) {
  const cf = viaEdge(req) ? req.headers.get("cf-connecting-ip") : "";
  return (cf && cf.trim()) || req.headers.get("x-nf-client-connection-ip") || req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "0";
}
/* null = carry on; a Response = answer with it. */
export function edgeGate(req) {
  if (env("EDGE_ENFORCE") !== "1" || !env("EDGE_SECRET")) return null;
  if (viaEdge(req)) return null;
  return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}
