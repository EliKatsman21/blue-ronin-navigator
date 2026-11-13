// Push subscriptions hardening (security review 2026-11-13, N2): lib/push-core.mjs against an in-memory store.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validSub, pushHostOk, keyOf, subsCap, mapLimit, sendAllWith, makeSubscribe, SUB_RATE_MAX, SUBS_CAP, PUSH_TIMEOUT_MS }
  from "../../netlify/functions/lib/push-core.mjs";

function fakeStore() {
  const m = new Map(), tick = () => new Promise(r => setImmediate(r));
  return {
    m,
    async get(k, o) { await tick(); const v = m.get(k); if (v == null) return null; return o && o.type === "json" ? JSON.parse(v) : v; },
    async setJSON(k, v) { await tick(); m.set(k, JSON.stringify(v)); },
    async delete(k) { await tick(); m.delete(k); },
    async list(o = {}) { await tick(); return { blobs: [...m.keys()].filter(k => k.startsWith(o.prefix || "")).map(key => ({ key })) }; }
  };
}
const keys = { p256dh: "B" + "x".repeat(86), auth: "y".repeat(22) };
const sub = (n, host = "fcm.googleapis.com") => ({ endpoint: `https://${host}/fcm/send/tok${n}`, keys });
const req = (body, { ip = "ip1", method = "POST" } = {}) => new Request("https://x.test/api/subscribe", { method, headers: { "x-ip": ip }, body: JSON.stringify(body) });
function setup(cap) {
  const subs = fakeStore(), rl = fakeStore();
  return { subs, rl, h: makeSubscribe({ subs, rl, ipHash: async r => r.headers.get("x-ip"), now: () => Date.UTC(2026, 10, 13, 9), cap }) };
}

test("N2: only https endpoints on the browser push services are accepted", () => {
  for (const ep of ["https://fcm.googleapis.com/fcm/send/abc", "https://updates.push.services.mozilla.com/wpush/v2/abc",
    "https://web.push.apple.com/QH1abc", "https://wns2-par02p.notify.windows.com/w/?token=abc", "https://FCM.googleapis.com/x"])
    assert.ok(pushHostOk(ep), ep);
  for (const ep of ["http://fcm.googleapis.com/x", "https://evil.example/x", "https://fcm.googleapis.com.evil.example/x",
    "https://evil.example/fcm.googleapis.com", "https://fcm.googleapis.com:8443/x", "https://u:p@fcm.googleapis.com/x",
    "https://notify.windows.com.evil.example/x", "https://a.b.notify.windows.com/x", "https://127.0.0.1/x", "not a url", "",
    "https://fcm.googleapis.com/" + "x".repeat(2100)])
    assert.equal(pushHostOk(ep), false, ep);
  assert.ok(validSub(sub(1)));
  assert.equal(validSub({ endpoint: "https://evil.example/x", keys }), false);
  assert.equal(validSub({ endpoint: sub(1).endpoint }), false);
  assert.equal(validSub({ endpoint: sub(1).endpoint, keys: { p256dh: "x".repeat(500), auth: "y" } }), false);
  assert.equal(validSub(null), false);
  // the SOS circle and the admin alerts use the same check through lib/push.mjs
  const push = readFileSync(new URL("../../netlify/functions/lib/push.mjs", import.meta.url), "utf8");
  assert.match(push, /import \{ validSub, keyOf, sendAllWith, trySend, SEND_GONE, SEND_FAIL, PUSH_TIMEOUT_MS \} from "\.\/push-core\.mjs"/);
});

test("N2: every push is sent with a 5000 ms timeout", () => {
  assert.equal(PUSH_TIMEOUT_MS, 5000);
  const push = readFileSync(new URL("../../netlify/functions/lib/push.mjs", import.meta.url), "utf8");
  assert.match(push, /timeout: PUSH_TIMEOUT_MS/);
  assert.equal((push.match(/webpush\.sendNotification\(/g) || []).length, 1, "one send path, with the timeout");
});

test("N2: sendAll runs with bounded concurrency, removes gone subscriptions and keeps going past failures", async () => {
  const store = fakeStore();
  for (let i = 0; i < 60; i++) await store.setJSON(keyOf(sub(i).endpoint), { sub: sub(i), prefs: { friday: i % 10 !== 0, saturday: true }, chap: "" });
  let live = 0, peak = 0;
  const send = async s => {
    live++; peak = Math.max(peak, live); await new Promise(r => setTimeout(r, 5)); live--;
    const n = +s.endpoint.split("tok")[1];
    if (n === 1) { const e = new Error("gone"); e.statusCode = 410; throw e; }
    if (n === 2) throw new Error("timeout");
    return true;
  };
  const r = await sendAllWith({ store, send, payload: rec => ({ title: rec.chap || "best", body: "b" }), pref: "friday", concurrency: 8 });
  assert.ok(peak <= 8 && peak > 1, `peak ${peak}`);
  assert.equal(r.total, 60); assert.equal(r.skipped, 6); assert.equal(r.gone, 1); assert.equal(r.failed, 1); assert.equal(r.sent, 52);
  assert.equal(store.m.has(keyOf(sub(1).endpoint)), false, "410 removes the subscription");
  assert.deepEqual(await mapLimit([3, 1, 2], 2, async x => x * 2), [6, 2, 4]);
});

test("N2: /api/subscribe rejects unknown hosts, throttles new endpoints per IP, never updates of existing ones", async () => {
  const { h, subs, rl } = setup();
  assert.equal((await h(req({ sub: { endpoint: "https://tarpit.example/x", keys } }))).status, 400);
  assert.equal(subs.m.size, 0);
  for (let i = 0; i < SUB_RATE_MAX; i++) assert.equal((await h(req({ sub: sub(i), prefs: { friday: true } }))).status, 200, "new #" + i);
  const r = await h(req({ sub: sub(999) })); assert.equal(r.status, 429); assert.match((await r.json()).error, /נסו שוב/);
  assert.equal(subs.m.size, SUB_RATE_MAX);
  // flooding does not grow the marker store (N1 pattern)
  for (let i = 0; i < 50; i++) await h(req({ sub: sub(1000 + i) }));
  assert.ok(rl.m.size <= SUB_RATE_MAX + 1, `${rl.m.size} markers`);
  // the markers use the feedback rate prefix so the monitor's sweep prunes them
  assert.ok([...rl.m.keys()].every(k => /^rl:\d+:sub\.ip1:[a-f0-9]{8}$/.test(k)));
  // an existing subscription can still change prefs and chapter, and another IP is not affected
  const up = await h(req({ sub: sub(0), prefs: { friday: false } })); assert.equal(up.status, 200); assert.deepEqual((await up.json()).prefs, { friday: false, saturday: true });
  assert.equal((await h(req({ sub: sub(2000) }, { ip: "ip2" }))).status, 200);
  // check, setChap (unknown = 404) and DELETE keep working
  assert.deepEqual(await (await h(req({ check: true, endpoint: sub(0).endpoint }))).json(), { ok: true, prefs: { friday: false, saturday: true } });
  assert.equal((await h(req({ setChap: true, endpoint: "https://fcm.googleapis.com/none", chap: "x" }))).status, 404);
  assert.equal((await h(req({ endpoint: sub(0).endpoint }, { method: "DELETE" }))).status, 200);
  assert.equal(subs.m.has(keyOf(sub(0).endpoint)), false);
  assert.equal((await h(new Request("https://x.test/api/subscribe", { method: "POST", body: "null" }))).status, 400);
});

test("N2: a cap on stored subscriptions (PUSH_SUBS_CAP, default 20000) and the monitor alert", async () => {
  assert.equal(subsCap(undefined), SUBS_CAP); assert.equal(SUBS_CAP, 20000); assert.equal(subsCap("50"), 50); assert.equal(subsCap("x"), SUBS_CAP); assert.equal(subsCap("-3"), SUBS_CAP);
  const { h, subs } = setup("3");
  for (let i = 0; i < 3; i++) assert.equal((await h(req({ sub: sub(i) }, { ip: "ip" + i }))).status, 200);
  const r = await h(req({ sub: sub(3) }, { ip: "ip9" })); assert.equal(r.status, 503); assert.match((await r.json()).error, /סגורה כרגע/);
  assert.equal(subs.m.size, 3);
  assert.equal((await h(req({ sub: sub(1), prefs: { saturday: false } }, { ip: "ip9" }))).status, 200, "an existing rider can still update");
  const health = readFileSync(new URL("../../netlify/functions/lib/health.mjs", import.meta.url), "utf8");
  assert.match(health, /subsCap\(Netlify\.env\.get\("PUSH_SUBS_CAP"\)\)/);
  assert.match(health, /add\("push", pct < 0\.9/);
});

test("perf: 1,000 subscribers fan out with 20 in flight, in bounded time", async () => {
  const store = fakeStore();
  for (let i = 0; i < 1000; i++) store.m.set(keyOf(sub(i).endpoint), JSON.stringify({ sub: sub(i), prefs: { friday: true, saturday: true }, chap: "" }));
  let live = 0, peak = 0; const LAT = 20;
  const send = async () => { live++; peak = Math.max(peak, live); await new Promise(r => setTimeout(r, LAT)); live--; return true; };
  const t0 = Date.now(); const r = await sendAllWith({ store, send, payload: { title: "t", body: "b" }, pref: "friday" });
  const ms = Date.now() - t0;
  assert.equal(r.sent, 1000); assert.equal(peak, 20);
  // one at a time this would be 1000 x 20 ms = 20 s; 20 in flight is about 1 s (allow for a slow machine)
  assert.ok(ms < 5000, `${ms} ms`);
  // worst case, every push service slow: 1000 / 20 x 5 s = 250 s, beyond the 30 s scheduled limit, hence the background hand-off
  assert.ok(1000 / 20 * PUSH_TIMEOUT_MS / 1000 > 30);
});

test("perf: the brief is handed to a background function as a one-time job, sent at most once", async () => {
  const { queueJob, takeJob, dispatchBrief, briefPayload, JOB_TTL } = await import("../../netlify/functions/lib/brief-job.mjs");
  const b = { title: "T", sat: "2026-11-14", messages: { best: { title: "best", body: "B" }, byChap: { c2: { title: "c2", body: "C" } } } };
  const store = fakeStore(), now = Date.UTC(2026, 10, 13, 14, 30);
  // the background function took it (202): nothing sent inline, the job waits for it, once
  let inline = 0, ids = [];
  let r = await dispatchBrief({ store, b, mode: "friday", now, trigger: async id => { ids.push(id); return { status: 202 }; }, send: async () => { inline++; return { sent: 1 }; } });
  assert.deepEqual(r, { queued: true }); assert.equal(inline, 0);
  const job = await takeJob(store, ids[0], now + 1000); assert.equal(job.mode, "friday");
  assert.equal(await takeJob(store, ids[0], now + 1000), null, "a job runs once");
  const p = briefPayload(job);
  assert.deepEqual(p({ chap: "c2" }), { title: "c2", body: "C", tag: "brief-2026-11-14", url: "./#brief" });
  assert.equal(p({ chap: "nope" }).title, "best");
  // the hand-off failed: the scheduled function sends inline, and the job is gone
  r = await dispatchBrief({ store, b, mode: "saturday", now, trigger: async () => { throw new Error("down"); }, send: async j => { inline++; assert.equal(j.mode, "saturday"); return { sent: 7, total: 7 }; } });
  assert.equal(r.queued, false); assert.equal(r.sent, 7); assert.equal(inline, 1); assert.equal(store.m.size, 0);
  // nobody outside can start a send: bad ids, unknown ids, expired jobs
  for (const id of [undefined, "", "x", "../job", "a".repeat(31), "A".repeat(32)]) assert.equal(await takeJob(store, id, now), null, String(id));
  assert.equal(await takeJob(store, "f".repeat(32), now), null);
  const old = await queueJob(store, b, "friday", now); assert.equal(await takeJob(store, old, now + JOB_TTL + 1), null); assert.equal(store.m.size, 0, "an expired job is deleted too");
  // the scheduled functions only queue; the background function is the only sender of the brief
  const bg = readFileSync(new URL("../../netlify/functions/brief-send-background.mjs", import.meta.url), "utf8");
  assert.match(bg, /takeJob\(/); assert.match(bg, /sendAll\(briefPayload\(job\), MODES\[job\.mode\]\.pref\)/);
});

test("M1: Apple's push subdomains are accepted; a refused host gets its own message and only its hostname is logged", async () => {
  const { refusedHost, noteRefusedHost, PUSH_HOST_MSG, PUSH_HOST_LOG_MAX } = await import("../../netlify/functions/lib/push-core.mjs");
  for (const ep of ["https://web.push.apple.com/QH1", "https://api.push.apple.com/x", "https://eu-1.push.apple.com/x"]) assert.ok(pushHostOk(ep), ep);
  for (const ep of ["https://push.apple.com/x", "https://a.b.push.apple.com/x", "https://push.apple.com.evil.example/x", "https://evilpush.apple.com/x".replace("evilpush.apple", "evil.push.apple.com.x"), "http://web.push.apple.com/x"])
    assert.equal(pushHostOk(ep), false, ep);
  assert.equal(refusedHost(sub(1)), "");
  assert.equal(refusedHost({ endpoint: "https://Push.Example.net/secret/token123", keys }), "push.example.net");
  assert.equal(refusedHost({ endpoint: "not a url" }), ""); assert.equal(refusedHost(null), "");
  // subscribe: the Hebrew message, a log line with the hostname only, at most PUSH_HOST_LOG_MAX an hour
  const subs = fakeStore(), rl = fakeStore(), lines = [];
  const h = makeSubscribe({ subs, rl, ipHash: async () => "ip", now: () => Date.UTC(2026, 10, 13, 9), log: async (...a) => lines.push(a) });
  for (let i = 0; i < 12; i++) {
    const r = await h(req({ sub: { endpoint: `https://push.example.net/secret/token${i}`, keys } }));
    assert.equal(r.status, 400); const j = await r.json(); assert.equal(j.error, PUSH_HOST_MSG); assert.equal(j.code, "push_host");
  }
  assert.equal(lines.length, PUSH_HOST_LOG_MAX);
  assert.deepEqual(lines[0], ["push", "warn", "push host refused: push.example.net"]);
  assert.ok(lines.every(l => !/secret|token/.test(l.join(" "))), "never the path");
  assert.equal(subs.m.size, 0);
  // a malformed subscription on a known host is still the old plain 400, and logs nothing
  assert.equal((await h(req({ sub: { endpoint: sub(1).endpoint } }))).status, 400); assert.equal(lines.length, PUSH_HOST_LOG_MAX);
  assert.equal(await noteRefusedHost({ rl, now: () => 0, log: async () => { throw new Error("x"); } }, "h"), false, "never throws");
  // the SOS join gives the same message for a refused push service, not "no notification permission"
  const sos = readFileSync(new URL("../../netlify/functions/sos.mjs", import.meta.url), "utf8");
  assert.match(sos, /const host = refusedHost\(b\.sub\);[^\n]*\n\s+if \(host\) \{ await noteRefusedHost\([^\n]*return J\(\{ error: PUSH_HOST_MSG, code: "push_host" \}, 400\)/);
  assert.ok(sos.indexOf("refusedHost(b.sub)") < sos.indexOf("if (!validSub(b.sub))"));
  assert.match(readFileSync(new URL("../../netlify/functions/subscribe.mjs", import.meta.url), "utf8"), /log: opsLog/);
});

test("M1: the app shows the server's reason when a push subscription is refused", () => {
  const app = readFileSync(new URL("../../site/app.js", import.meta.url), "utf8");
  assert.match(app, /if \(!r\.ok\) \{ const j = await r\.json\(\)\.catch\(\(\) => \(\{\}\)\); throw new Error\(j\.error \|\| ""\); \}/);
  assert.doesNotMatch(app, /if \(!r\.ok\) throw 0; LS\.set\("pushChap"/);
});
