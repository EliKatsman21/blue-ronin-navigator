// /api/feedback hardening (security review 2026-11-13): the handler runs against an in-memory Blobs store.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeFeedback, RATE_MAX, validBody } from "../../netlify/functions/lib/feedback-core.mjs";

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
  const inbox = JSON.parse(fb.m.get("inbox").data); assert.equal(inbox.length, 1);
  assert.equal(inbox[0].kind, "a11y"); assert.deepEqual(inbox[0].media, ["p", "p1"]); assert.equal(inbox[0].lat, 32.1);
  assert.ok(media.m.has(inbox[0].id + "-p") && media.m.has(inbox[0].id + "-p1"));
  assert.equal((await h(req({ kind: "bug", text: "x" }))).status, 400, "too short");
});

test("L2: a body that is not a JSON object is a 400, never a crash", async () => {
  for (const body of ["null", "1", "\"text\"", "[]", "true"]) { const { h } = setup(); const r = await h(req(body)); assert.equal(r.status, 400, body); }
  assert.ok(validBody({}) && !validBody(null) && !validBody([]) && !validBody("x"));
});
