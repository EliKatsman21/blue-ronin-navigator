// SOS alert fan-out (security review 2026-11-13 final, H1): a push failure must never remove an emergency contact.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { alertGuardians, applyResults } from "../../netlify/functions/lib/sos-core.mjs";
import { trySend, isGone } from "../../netlify/functions/lib/push-core.mjs";

const require = createRequire(import.meta.url);
const { BRL } = require("../../site/logic.js");
const fn = f => readFileSync(new URL("../../netlify/functions/" + f, import.meta.url), "utf8");
const err = (statusCode, msg = "push error") => Object.assign(new Error(msg), statusCode ? { statusCode } : {});
const g = (gid, host = "fcm.googleapis.com") => ({ gid, name: gid, sub: { endpoint: `https://${host}/fcm/send/${gid}`, keys: {} }, t: 1 });

test("H1: a push send has three outcomes; only 404/410 is gone", async () => {
  assert.equal(await trySend(async () => { }, {}, {}), "ok");
  assert.equal(await trySend(async () => { throw err(410); }, {}, {}), "gone");
  assert.equal(await trySend(async () => { throw err(404); }, {}, {}), "gone");
  // web-push rejects a socket timeout with no statusCode
  for (const e of [err(0, "Socket timeout"), err(503), err(500), err(429), err(400), err(403), new Error("ENOTFOUND"), null, "x"])
    assert.equal(await trySend(async () => { throw e; }, {}, {}), "fail", String(e && e.statusCode || e));
  assert.equal(isGone(err(503)), false);
});

test("H1: a timeout and a 503 keep the guardian, a 410 removes it, and the counts are honest", async () => {
  // fake web-push: a = ok, b = timeout (no statusCode), c = 503 twice, d = 410 gone, e = 503 once then ok
  const calls = {};
  const webpush = async sub => {
    const id = sub.endpoint.split("/").pop(); calls[id] = (calls[id] || 0) + 1;
    if (id === "b") throw err(0, "Socket timeout");
    if (id === "c") throw err(503);
    if (id === "d") throw err(410);
    if (id === "e" && calls.e === 1) throw err(503);
  };
  const list = ["a", "b", "c", "d", "e"].map(x => g(x));
  const r = await alertGuardians(list, x => trySend(webpush, x.sub, {}), { pause: 1 });
  assert.deepEqual(r.results, { a: "ok", b: "fail", c: "fail", d: "gone", e: "ok" });
  assert.equal(r.sent, 2); assert.equal(r.failed, 2); assert.equal(r.gone, 1);
  assert.equal(calls.c, 2, "a quick failure is retried once"); assert.equal(calls.e, 2, "the retry can succeed"); assert.equal(calls.d, 1, "gone is not retried");
  const kept = applyResults(list, r.results);
  assert.deepEqual(kept.map(x => x.gid), ["a", "b", "c", "e"], "only the 410 guardian is removed");
  assert.equal(kept.find(x => x.gid === "b").fails, 1); assert.equal(kept.find(x => x.gid === "a").fails, undefined);
  // failures in a row never remove a guardian; a success clears the count
  let again = kept; for (let i = 0; i < 10; i++) again = applyResults(again, { b: "fail" });
  assert.equal(again.find(x => x.gid === "b").fails, 11);
  assert.equal(applyResults(again, { b: "ok" }).find(x => x.gid === "b").fails, undefined);
});

test("H1: a slow failure (timeout) is not retried, so the alert stays inside the function time limit", async () => {
  let n = 0, t = 0; const clock = () => t;
  const r = await alertGuardians([g("a")], async () => { n++; t += 5000; return "fail"; }, { clock, pause: 1 });
  assert.equal(n, 1); assert.equal(r.failed, 1);
});

test("H1: guardians are sent to in parallel, and a sender that throws counts as a failure", async () => {
  let live = 0, peak = 0;
  const r = await alertGuardians(["a", "b", "c", "d", "e"].map(x => g(x)), async x => {
    live++; peak = Math.max(peak, live); await new Promise(res => setTimeout(res, 20)); live--;
    if (x.gid === "e") throw new Error("boom"); return "ok";
  }, { pause: 1 });
  assert.equal(peak, 5); assert.equal(r.sent, 4); assert.equal(r.failed, 1);
});

test("H1: results apply to a fresh list: a guardian who joined during the send is kept", () => {
  const fresh = [g("a"), g("b"), g("new")];
  assert.deepEqual(applyResults(fresh, { a: "gone", b: "fail" }).map(x => x.gid), ["b", "new"]);
});

test("H1: sos.mjs uses the tri-state fan-out, re-reads the circle, returns failed and keeps the critical log", () => {
  const src = fn("sos.mjs");
  assert.match(src, /alertGuardians\(C\.g, g => sendOne\(/);
  assert.match(src, /F\.g = applyResults\(F\.g, r\.results\)/);
  assert.match(src, /return J\(\{ sent, failed, total, where \}\)/);
  assert.match(src, /sent \? "error" : "critical"/);
  assert.doesNotMatch(src, /if \(ok\) \{ sent\+\+; alive\.push/, "the old 'drop on any failure' loop is gone");
  // every other caller treats the result as a tri-state and never deletes on a failure
  const health = fn("lib/health.mjs");
  assert.match(health, /else if \(r === "gone"\) await ops\.delete\(b\.key\)/);
  assert.doesNotMatch(health, /fails >= \d+\) await ops\.delete/);
  assert.match(fn("test-push.mjs"), /ok: r === "ok"/);
  const push = fn("lib/push.mjs");
  assert.match(push, /if \(r === SEND_GONE\) await removeSub/);
  assert.equal((push.match(/removeSub\(/g) || []).length, 1, "removeSub is called only on gone");
});

test("H1: the rider's app says honestly who the alert reached", () => {
  assert.match(BRL.sosReach({ sent: 0, failed: 0, total: 0 }, false), /אין עדיין איש קשר/);
  assert.match(BRL.sosReach({ sent: 0, failed: 2, total: 2 }, false), /לא הגיעה כרגע לאף איש קשר/);
  assert.match(BRL.sosReach({ sent: 0, failed: 2, total: 2 }, true), /לא הגיעה לאף איש קשר/);
  const part = BRL.sosReach({ sent: 2, failed: 1, total: 3 }, false);
  assert.match(part, /נשלחה ל־2 אנשי קשר/); assert.match(part, /לאיש קשר אחד היא לא הגיעה/); assert.match(part, /התקשרו/);
  assert.equal(BRL.sosReach({ sent: 1, total: 1 }, true), "התראת בדיקה נשלחה לאיש קשר אחד.");
  // an older server (no failed field) still reads right
  assert.equal(BRL.sosReach({ sent: 3, total: 3 }, false), "התראה עם המיקום שלך נשלחה ל־3 אנשי קשר.");
  const app = readFileSync(new URL("../../site/app.js", import.meta.url), "utf8");
  assert.match(app, /L\.sosReach\(res, true\)/); assert.match(app, /L\.sosReach\(res, false\)/);
});

test("m8: a server error reaches the rider only when it is Hebrew", () => {
  assert.equal(BRL.heText("קצר מדי", "x"), "קצר מדי");
  assert.equal(BRL.heText("forbidden", "השליחה נכשלה"), "השליחה נכשלה");
  assert.equal(BRL.heText("Error: at foo (bar.js:1)", "השליחה נכשלה"), "השליחה נכשלה");
  assert.equal(BRL.heText(undefined, "f"), "f"); assert.equal(BRL.heText({ a: 1 }, "f"), "f");
  assert.equal(BRL.heText("א".repeat(500), "f").length, 200);
  const app = readFileSync(new URL("../../site/app.js", import.meta.url), "utf8");
  assert.match(app, /: L\.heText\(err, "השליחה נכשלה"\);/, "feedback");
  assert.match(app, /throw new Error\(L\.heText\(j\.error, ""\)\)/, "push subscribe");
  assert.match(app, /new Error\(L\.heText\(j\.error, j\.error \? "השליחה נכשלה\. נסו שוב" : "אין חיבור"\)\)/, "post (SOS join, groups)");
});
