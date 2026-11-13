/* /api/subscribe: save, update, check or remove a rider's push subscription. The logic is in lib/push-core.mjs
   (unit-tested with a fake store): known push hosts only, a per-IP throttle and a cap on new subscriptions (N2). */
import { edgeGate } from "./lib/edge.mjs";
import { getStore } from "@netlify/blobs";
import { ipHash } from "./lib/admin.mjs";
import { makeSubscribe } from "./lib/push-core.mjs";
const handle = makeSubscribe({
  /* getters: the store is opened per request (the Blobs context is only there during an invocation) */
  get subs() { return getStore({ name: "brn-subs", consistency: "strong" }); },
  get rl() { return getStore({ name: "brn-feedback", consistency: "strong" }); }, /* markers pruned by the feedback sweep */
  get cap() { return Netlify.env.get("PUSH_SUBS_CAP"); }, /* default 20000 */
  ipHash, now: () => Date.now()
});
export default async req => {
  const gate = edgeGate(req); if (gate) return gate;
  return handle(req);
};
export const config = { path: "/api/subscribe" };
