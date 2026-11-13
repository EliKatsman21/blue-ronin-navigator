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
  assert.match(push, /import \{ validSub, keyOf, sendAllWith, PUSH_TIMEOUT_MS \} from "\.\/push-core\.mjs"/);
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
