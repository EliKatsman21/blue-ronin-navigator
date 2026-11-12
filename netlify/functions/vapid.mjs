import { edgeGate } from "./lib/edge.mjs";
import { vapid } from "./lib/push.mjs";
export default async req => {
  const gate = edgeGate(req); if (gate) return gate;
  const v = await vapid();
  return Response.json({ key: v.publicKey }, { headers: { "cache-control": "no-store" } });
};
export const config = { path: "/api/vapid" };
