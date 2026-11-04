import { vapid } from "./lib/push.mjs";
export default async () => {
  const v = await vapid();
  return Response.json({ key: v.publicKey }, { headers: { "cache-control": "no-store" } });
};
export const config = { path: "/api/vapid" };
