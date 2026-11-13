/* The SOS alert fan-out, pure (security review 2026-11-13 final, H1). sos.mjs passes the sender (lib/push.mjs sendOne:
   "ok" | "gone" | "fail") and applies the result to a fresh copy of the circle, so the unit tests run it with a fake.

   - Every guardian is sent to at the same time (at most 5), so one slow push service cannot use up the function's
     time before the others are tried.
   - A "fail" that came back quickly (a 5xx, 429 or network error, not a 5 s timeout) gets one retry after a short
     pause. A timeout is not retried: a second 5 s wait could push the function past its time limit.
   - A guardian is removed ONLY when the push service says the subscription is gone (404/410). A failure, however
     many in a row, never removes an emergency contact: g.fails counts them so the rider's app can be honest. */
export const RETRY_IF_UNDER_MS = 2500, RETRY_PAUSE_MS = 300;
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* guardians: [{gid, sub, ...}], send(g) -> "ok" | "gone" | "fail" -> { results: {gid: outcome}, sent, failed, gone } */
export async function alertGuardians(guardians, send, { clock = Date.now, pause = RETRY_PAUSE_MS, retryUnder = RETRY_IF_UNDER_MS } = {}) {
  const once = async g => { try { const r = await send(g); return r === "ok" || r === "gone" ? r : "fail"; } catch (e) { return "fail"; } };
  const outs = await Promise.all(guardians.map(async g => {
    const t0 = clock(); let r = await once(g);
    if (r === "fail" && clock() - t0 < retryUnder) { await sleep(pause); r = await once(g); }
    return r;
  }));
  const results = {}; let sent = 0, failed = 0, gone = 0;
  guardians.forEach((g, i) => { const r = outs[i]; results[g.gid] = r; if (r === "ok") sent++; else if (r === "gone") gone++; else failed++; });
  return { results, sent, failed, gone };
}

/* apply results to the guardians list as it is NOW (a fresh read: a join or remove during the send is kept).
   Gone -> removed; ok -> fails cleared; fail -> fails + 1, kept. Guardians not in results are untouched. */
export function applyResults(list, results) {
  const out = [];
  for (const g of list || []) {
    const r = results[g.gid];
    if (r === "gone") continue;
    if (r === "ok") { if (g.fails) { const { fails, ...rest } = g; out.push(rest); } else out.push(g); }
    else if (r === "fail") out.push({ ...g, fails: (g.fails || 0) + 1 });
    else out.push(g);
  }
  return out;
}
