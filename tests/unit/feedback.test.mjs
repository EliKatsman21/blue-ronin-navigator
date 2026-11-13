// /api/feedback hardening (security review 2026-11-13): the handler runs against an in-memory Blobs store.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeFeedback, RATE_MAX, validBody, inboxNow, INBOX_MAX } from "../../netlify/functions/lib/feedback-core.mjs";

/* the parts of a Netlify Blobs store the feedback code uses; reads and writes yield to the event loop like I/O */
export function fakeStore() {
  const m = new Map(), tick = () => new Promise(r => setImmediate(r));
  return {
    m,
    async get(k, o) { await tick(); const v = m.get(k); if (v == null) return null; return o && o.type === "json" ? JSON.parse(v.data) : v.data; },
    async setJSON(k, v, o) { await tick(); m.set(k, { data: JSON.stringify(v), metadata: (o && o.metadata) || {} }); },
    async set(k, v, o) { await tick(); m.set(k, { data: v, metadata: (o && o.metadata) || {} }); },
    async delete(k) { await tick(); m.delete(k); },
    async getMetadata(k) { await tick(); const v = m.get(k); return v ? { metadata: v.metadata } : null; },
    async list(o = {}) { await tick(); return { blobs: [...m.keys()].filter(k => k.startsWith(o.prefix || "")).map(key => ({ key })) }; }
  };
}
const jpeg = n => "data:image/jpeg;base64," + Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(Math.max(0, n - 4), 7)]).toString("base64");
export const req = (body, ip = "ip1") => new Request("https://x.test/api/feedback", { method: "POST", headers: { "content-type": "application/json", "x-ip": ip }, body: typeof body === "string" ? body : JSON.stringify(body) });
export function setup(extra = {}) {
  const fb = fakeStore(), media = fakeStore(); let t = Date.UTC(2026, 10, 13, 9, 0, 0);
  const h = makeFeedback({ fb, media, ipHash: async r => r.headers.get("x-ip"), now: () => t, ...extra });
  return { fb, media, h, at: v => { t = v; } };
}

test("L1: the rate limit answers 429 before the body is parsed or decoded", async () => {
  const { h } = setup();
  for (let i = 0; i < RATE_MAX; i++) assert.equal((await h(req({ kind: "bug", text: "בדיקה " + i }))).status, 200);
  // a body that would fail parsing (400) and one that would fail media checks (400) both get 429 now
  assert.equal((await h(req("{not json"))).status, 429);
  assert.equal((await h(req({ kind: "bug", text: "שוב", photos: ["%%%"] }))).status, 429);
  // another IP is not affected
  assert.equal((await h(req({ kind: "idea", text: "מישהו אחר" }, "ip2"))).status, 200);
});

test("feedback still works: text, kind, location in Israel, photos stored under p/p1", async () => {
  const { h, fb, media } = setup();
  const r = await h(req({ kind: "a11y", text: "כפתור בלי שם", lat: 32.1, lon: 34.8, photos: [jpeg(500), jpeg(600)] }));
  assert.equal(r.status, 200); const j = await r.json(); assert.match(j.ref, /^[A-F0-9]{5}$/);
  const inbox = await inboxNow(fb, media); assert.equal(inbox.length, 1);
  assert.equal(inbox[0].kind, "a11y"); assert.deepEqual(inbox[0].media, ["p", "p1"]); assert.equal(inbox[0].lat, 32.1);
  assert.ok(media.m.has(inbox[0].id + "-p") && media.m.has(inbox[0].id + "-p1"));
  assert.equal((await h(req({ kind: "bug", text: "x" }))).status, 400, "too short");
});

test("L2: a body that is not a JSON object is a 400, never a crash", async () => {
  for (const body of ["null", "1", "\"text\"", "[]", "true"]) { const { h } = setup(); const r = await h(req(body)); assert.equal(r.status, 400, body); }
  assert.ok(validBody({}) && !validBody(null) && !validBody([]) && !validBody("x"));
});

test("M1: parallel requests from one IP cannot get past the hourly limit", async () => {
  const { h, fb } = setup();
  const res = await Promise.all(Array.from({ length: 20 }, (_, i) => h(req({ kind: "bug", text: "מקביל " + i, photos: [jpeg(300)] }))));
  const ok = res.filter(r => r.status === 200).length;
  assert.ok(ok <= RATE_MAX, `${ok} accepted`);
  // the counter lives in its own blobs, one per request in this hour, not in the inbox
  assert.ok([...fb.m.keys()].filter(k => k.startsWith("rl:")).length === 20);
});

test("M1: parallel reports from different riders all reach the inbox, and media is written only for them", async () => {
  const { h, fb, media } = setup();
  const res = await Promise.all(Array.from({ length: 8 }, (_, i) => h(req({ kind: "bug", text: "רוכב " + i, photos: [jpeg(300)] }, "ip" + i))));
  assert.ok(res.every(r => r.status === 200));
  // the rider never writes the inbox blob: each report is its own queued blob, folded in when the admin reads
  assert.equal(fb.m.has("inbox"), false);
  const inbox = await inboxNow(fb, media);
  assert.equal(inbox.length, 8, "no report lost to a parallel write");
  assert.equal([...fb.m.keys()].filter(k => k.startsWith("q:")).length, 0, "the queue is folded in and cleared");
  assert.equal((await inboxNow(fb, media)).length, 8, "reading again changes nothing");
  const ids = new Set(inbox.map(x => x.id));
  assert.ok([...media.m.keys()].every(k => ids.has(k.split("-")[0])), "no media without an inbox entry");
});

test("M1: the monitor's sweep deletes orphan media older than an hour and old rate markers", async () => {
  const { fb, media } = setup();
  const now = Date.UTC(2026, 10, 13, 12, 0, 0), H = 36e5;
  await fb.setJSON("inbox", [{ id: "aaaaaaaaaaaa", t: now, media: ["p"] }]);
  await media.set("aaaaaaaaaaaa-p", Buffer.from("x"), { metadata: { ct: "image/jpeg", t: now - 5 * H } });
  await media.set("bbbbbbbbbbbb-p", Buffer.from("x"), { metadata: { ct: "image/jpeg", t: now - 2 * H } });
  await media.set("cccccccccccc-p1", Buffer.from("x"), { metadata: { ct: "image/jpeg", t: now - 10 * 6e4 } });
  await media.set("dddddddddddd-a", Buffer.from("x"), { metadata: { ct: "audio/webm" } });
  await fb.setJSON(`rl:${Math.floor(now / H) - 3}:ip:1`, {}); await fb.setJSON(`rl:${Math.floor(now / H)}:ip:2`, {});
  const { sweepFeedback } = await import("../../netlify/functions/lib/feedback-core.mjs");
  const r = await sweepFeedback({ fb, media, now });
  assert.equal(r.orphans, 2);
  assert.deepEqual([...media.m.keys()].sort(), ["aaaaaaaaaaaa-p", "cccccccccccc-p1"], "kept: in the inbox, or younger than an hour");
  assert.deepEqual([...fb.m.keys()].filter(k => k.startsWith("rl:")), [`rl:${Math.floor(now / H)}:ip:2`]);
});

test("M1: the inbox keeps the last 500, and media of reports that fall off is deleted", async () => {
  const { fb, media } = setup();
  const old = Array.from({ length: INBOX_MAX }, (_, i) => ({ id: (i + 1).toString(16).padStart(12, "0"), t: 1000 + i, media: ["p"] }));
  await fb.setJSON("inbox", old); await media.set(old[0].id + "-p", Buffer.from("x"), { metadata: { t: 1 } });
  const h = makeFeedback({ fb, media, ipHash: async () => "ip9", now: () => 5000 });
  assert.equal((await h(req({ kind: "bug", text: "החדש" }))).status, 200);
  const inbox = await inboxNow(fb, media);
  assert.equal(inbox.length, INBOX_MAX); assert.equal(inbox[inbox.length - 1].text, "החדש"); assert.ok(!inbox.some(x => x.id === old[0].id));
  assert.equal(media.m.has(old[0].id + "-p"), false);
});
