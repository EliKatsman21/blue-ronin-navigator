/* POST /api/feedback — riders send bugs, ideas, data fixes, a road report or an accessibility problem. It lands
   in the admin inbox only: nothing a rider sends is shown to other riders until the admin approves it.
   Anonymous; throttled per (hashed) IP. The logic is in lib/feedback-core.mjs (unit-tested with a fake store);
   photos (up to 4) and a voice note can ride along, see lib/fbmedia.mjs for the limits and the checks. */
import { edgeGate } from "./lib/edge.mjs";
import { getStore } from "@netlify/blobs";
import { ipHash } from "./lib/admin.mjs";
import { makeFeedback } from "./lib/feedback-core.mjs";
const handle = makeFeedback({
  /* getters: the store is opened per request (the Blobs context is only there during an invocation) */
  get fb() { return getStore({ name: "brn-feedback", consistency: "strong" }); },
  get media() { return getStore({ name: "brn-fb-media", consistency: "strong" }); },
  get budgetMb() { return Netlify.env.get("FB_MEDIA_DAILY_MB"); }, /* daily media budget in MB, default 50 */
  ipHash, now: () => Date.now()
});
export default async req => {
  const gate = edgeGate(req); if (gate) return gate;
  return handle(req);
};
export const config = { path: "/api/feedback" };
