// Weekend brief delivery is observable and self-healing (QA 2026-11-13 final, R1; with security L1).
// lib/brief-job.mjs against an in-memory store, a fake trigger and a fake clock.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dispatchBrief, takeJob, noteQueued, noteSent, briefWatch, sentLine, CONFIRM_MS, INLINE_DEADLINE_MS, WATCH_MS }
  from "../../netlify/functions/lib/brief-job.mjs";
import { sendAllWith, keyOf } from "../../netlify/functions/lib/push-core.mjs";

function fakeStore() {
  const m = new Map();
  return {
    m,
    async get(k, o) { const v = m.get(k); if (v == null) return null; return o && o.type === "json" ? JSON.parse(v) : v; },
    async setJSON(k, v) { m.set(k, JSON.stringify(v)); },
    async delete(k) { m.delete(k); },
    async list(o = {}) { return { blobs: [...m.keys()].filter(k => k.startsWith(o.prefix || "")).map(key => ({ key })) }; }
  };
}
const b = { title: "T", sat: "2026-11-14", messages: { best: { title: "best", body: "B" } } };
const now = Date.UTC(2026, 10, 13, 14, 30);
const fn = f => readFileSync(new URL("../../netlify/functions/" + f, import.meta.url), "utf8");

/* a background function that runs (or not) when triggered: it takes the job, like brief-send-background */
function rig({ status = 202, runs = true, throws = false, late = false } = {}) {
  const store = fakeStore(); let bg = 0, inline = 0, waited = 0, pending = null;
  const trigger = async id => {
    const run = async () => { if (await takeJob(store, id, now)) bg++; };
    if (runs && !late) await run(); else if (runs && late) pending = run;
    if (throws) throw new Error("socket hang up");
    return { status };
  };
  const send = async (job, deadline) => { inline++; assert.equal(deadline, now + INLINE_DEADLINE_MS); return { sent: 5, gone: 1, failed: 2, total: 8 }; };
  const wait = async ms => { waited += ms; if (pending) { const p = pending; pending = null; await p(); } };
  return { store, trigger, send, wait, get bg() { return bg; }, get inline() { return inline; }, get waited() { return waited; } };
}
const go = (R, extra = {}) => dispatchBrief({ store: R.store, b, mode: "friday", now, trigger: R.trigger, send: R.send, wait: R.wait, clock: () => now, ...extra });

test("R1: 202 and the background function runs: it sends, the scheduled function checks and does not", async () => {
  const R = rig(); const r = await go(R);
  assert.equal(r.how, "background"); assert.equal(r.queued, true); assert.equal(R.bg, 1); assert.equal(R.inline, 0);
  assert.equal(R.waited, CONFIRM_MS); assert.ok(CONFIRM_MS + 2000 < INLINE_DEADLINE_MS && INLINE_DEADLINE_MS < 30000);
});

test("R1: 202 but the background function never runs: the scheduled function takes the job back and sends inline", async () => {
  const R = rig({ runs: false }); const r = await go(R);
  assert.equal(r.how, "fallback"); assert.equal(r.queued, false); assert.equal(R.inline, 1); assert.equal(R.bg, 0);
  assert.equal(r.sent, 5); assert.equal(R.store.m.size, 0, "the job is taken");
});

test("R1: a refused hand-off (non-202) sends inline at once, with no wait", async () => {
  const R = rig({ status: 500, runs: false }); const r = await go(R);
  assert.equal(r.how, "inline"); assert.equal(R.inline, 1); assert.equal(R.waited, 0);
});

test("R1 + L1: never sent twice", async () => {
  // the fetch threw after the background function got it: it sends; the check finds the job gone
  let R = rig({ throws: true }); let r = await go(R);
  assert.equal(R.bg + R.inline, 1); assert.equal(r.how, "background"); assert.equal(r.unsure, true);
  // the fetch threw and nothing ran: sent once, inline
  R = rig({ throws: true, runs: false }); r = await go(R);
  assert.equal(R.bg + R.inline, 1); assert.equal(r.how, "fallback"); assert.equal(r.threw, true);
  // the background function starts late, during the wait: it takes the job first, nothing inline
  R = rig({ late: true }); r = await go(R);
  assert.equal(R.bg, 1); assert.equal(R.inline, 0);
  // the background function arrives after the scheduled function took the job back: it finds nothing
  R = rig({ runs: false }); const ids = []; const t0 = R.trigger; R.trigger = async id => { ids.push(id); return t0(id); };
  r = await go(R); assert.equal(R.inline, 1); assert.equal(await takeJob(R.store, ids[0], now), null);
});

test("R1: inline sending stops starting new pushes at the deadline", async () => {
  const store = fakeStore(), keys = { p256dh: "B" + "x".repeat(86), auth: "y".repeat(22) };
  for (let i = 0; i < 50; i++) { const sub = { endpoint: `https://fcm.googleapis.com/fcm/send/t${i}`, keys }; store.m.set(keyOf(sub.endpoint), JSON.stringify({ sub, prefs: {} })); }
  let t = 0; const r = await sendAllWith({ store, send: async () => { t += 100; }, payload: { title: "t", body: "b" }, concurrency: 1, deadline: 1000, clock: () => t });
  assert.equal(r.sent + r.cut, 50); assert.ok(r.cut > 0 && r.sent > 0, JSON.stringify(r));
});

test("R1: the watch record and the monitor check", async () => {
  const ops = fakeStore();
  await noteQueued(ops, "friday", now);
  assert.equal(briefWatch(await ops.get("brief", { type: "json" }), now + 5 * 6e4).ok, true, "still in time");
  const late = briefWatch(await ops.get("brief", { type: "json" }), now + WATCH_MS + 1);
  assert.equal(late.ok, false); assert.match(late.detail, /תדריך שישי/); assert.match(late.detail, /לא נרשמה שליחה/);
  await noteSent(ops, "friday", now + 60e3, { sent: 5, gone: 1, failed: 2, total: 8 }, now);
  const ok = briefWatch(await ops.get("brief", { type: "json" }), now + WATCH_MS + 1);
  assert.equal(ok.ok, true); assert.match(ok.detail, /נשלח ל־5/);
  assert.equal(briefWatch(null, now).ok, true);
  assert.equal(briefWatch({ mode: "friday", queued: now, sent: 0 }, now + 2 * 864e5).ok, true, "looks back one day at most");
  assert.equal(sentLine("saturday", { sent: 5, gone: 1, failed: 2, total: 8, cut: 3 }), "עדכון שבת בבוקר נשלח: 5 הגיעו, 1 הוסרו (לא קיימים), 2 נכשלו, מתוך 8 · 3 לא נשלחו (נגמר הזמן)");
});

test("R1: wiring: the scheduled runs record the queue and the fallback, the background run records the send, the monitor watches", () => {
  for (const m of ["friday", "saturday"]) {
    const src = fn(`brief-${m}.mjs`);
    assert.match(src, new RegExp(`noteQueued\\(ops, "${m}"`)); assert.match(src, /start,/);
    assert.match(src, new RegExp(`send: \\(job, deadline\\) => sendAll\\(briefPayload\\(job\\), "${m}", \\{ deadline \\}\\)`));
    assert.match(src, /if \(!r\.queued\) \{ await noteSent\(ops/); assert.match(src, /sentLine\(/);
  }
  const bg = fn("brief-send-background.mjs");
  assert.match(bg, /await noteSent\(opsStore\(\), job\.mode/); assert.match(bg, /sentLine\(job\.mode, r\)/);
  const health = fn("lib/health.mjs");
  assert.match(health, /briefWatch\(await ops\.get\("brief"/); assert.match(health, /c\.id === "brief"/);
  assert.match(fn("lib/push.mjs"), /sendAllWith\(\{ store: subs\(\), send: \(sub, p\) => push\(sub, p\), payload, pref, deadline \}\)/);
});
