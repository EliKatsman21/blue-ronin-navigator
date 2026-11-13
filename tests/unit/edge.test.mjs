// Cloudflare edge handshake: who may tell us the visitor's address, and when the API refuses direct hits.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { viaEdge, clientIp, edgeGate, edgeReady, publicPing, adminPing } from "../../netlify/functions/lib/edge.mjs";

const SECRET = "s3cr3t-s3cr3t-s3cr3t-s3cr3t-42";
const req = h => new Request("https://blueronin.app/api/join", { headers: h });
beforeEach(() => { delete process.env.EDGE_SECRET; delete process.env.EDGE_ENFORCE; });

test("without the handshake a forged cf-connecting-ip is ignored", () => {
  process.env.EDGE_SECRET = SECRET;
  const r = req({ "cf-connecting-ip": "1.2.3.4", "x-nf-client-connection-ip": "9.9.9.9" });
  assert.equal(viaEdge(r), false);
  assert.equal(clientIp(r), "9.9.9.9");
  assert.equal(clientIp(req({ "x-br-edge": "wrong", "cf-connecting-ip": "1.2.3.4", "x-nf-client-connection-ip": "9.9.9.9" })), "9.9.9.9");
});

test("through Cloudflare the real visitor address is used, not Cloudflare's", () => {
  process.env.EDGE_SECRET = SECRET;
  const r = req({ "x-br-edge": SECRET, "cf-connecting-ip": "1.2.3.4", "x-nf-client-connection-ip": "172.70.1.1" });
  assert.equal(viaEdge(r), true);
  assert.equal(clientIp(r), "1.2.3.4");
});

test("a short or missing secret never counts as the handshake", () => {
  process.env.EDGE_SECRET = "short";
  assert.equal(viaEdge(req({ "x-br-edge": "short" })), false);
  delete process.env.EDGE_SECRET;
  assert.equal(viaEdge(req({ "x-br-edge": "" })), false);
});

test("the gate stays open until EDGE_ENFORCE=1, then refuses direct requests", () => {
  process.env.EDGE_SECRET = SECRET;
  assert.equal(edgeGate(req({})), null);
  process.env.EDGE_ENFORCE = "1";
  assert.equal(edgeGate(req({})).status, 403);
  assert.equal(edgeGate(req({ "x-br-edge": SECRET })), null);
});

test("every /api function passes through the gate", () => {
  const dir = new URL("../../netlify/functions/", import.meta.url);
  for (const f of readdirSync(dir).filter(f => f.endsWith(".mjs"))) {
    const s = readFileSync(new URL(f, dir), "utf8");
    if (!/config = \{ path/.test(s) || f === "traffic-tile.mjs") continue;
    assert.match(s, /const gate = edgeGate\(req\); if \(gate\) return gate;/, `${f} must call edgeGate first`);
  }
  const admin = readFileSync(new URL("lib/admin.mjs", dir), "utf8");
  assert.match(admin, /ipOf = req => clientIp\(req\)/, "lib/admin.mjs must take the address from lib/edge.mjs");
});

test("edgeReady reports only whether a usable secret is configured", () => {
  assert.equal(edgeReady(), false);
  process.env.EDGE_SECRET = SECRET;
  assert.equal(edgeReady(), true);
});

test("L4: the public ping tells only whether the request came through the edge; ready is for the admin", () => {
  process.env.EDGE_SECRET = SECRET;
  assert.deepEqual(Object.keys(publicPing(req({}))), ["edge"]);
  assert.deepEqual(publicPing(req({ "x-br-edge": SECRET })), { edge: true });
  assert.deepEqual(adminPing(req({})), { edge: false, ready: true });
  const dir = new URL("../../netlify/functions/", import.meta.url);
  const ping = readFileSync(new URL("ping.mjs", dir), "utf8"), admin = readFileSync(new URL("admin.mjs", dir), "utf8");
  assert.ok(ping.includes("Response.json(publicPing(req)")); assert.ok(!/edgeReady|ready:/.test(ping), "ping.mjs must not expose ready");
  // the admin route sits behind the session check
  assert.ok(admin.indexOf('route === "GET edge"') > admin.indexOf("const me = await session(req, auth); if (!me) return"));
});
