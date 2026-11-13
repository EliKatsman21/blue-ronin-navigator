// Feedback media: several photos per report, limits checked on the server, budget shared on the phone.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { pathToFileURL, fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const M = await import(pathToFileURL(join(ROOT, "netlify", "functions", "lib", "fbmedia.mjs")).href);
const L = require("../../site/logic.js").BRL;
const jpeg = n => "data:image/jpeg;base64," + Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(Math.max(0, n - 4), 7)]).toString("base64");
const webm = n => Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(n - 4, 1)]).toString("base64");

test("several photos get keys p, p1, p2, p3 and a voice note a", () => {
  const r = M.collectMedia({ photos: [jpeg(1000), jpeg(2000), jpeg(3000), jpeg(4000)], voice: webm(500) });
  assert.equal(r.error, undefined);
  assert.deepEqual(r.items.map(x => x.k), ["p", "p1", "p2", "p3", "a"]);
  assert.ok(r.items.every(x => M.MEDIA_KEY.test(x.k)));
});
test("the older single 'photo' field still works", () => {
  const r = M.collectMedia({ photo: jpeg(1000) });
  assert.deepEqual(r.items.map(x => x.k), ["p"]);
});
test("limits: count, size per photo, total size, real image bytes", () => {
  assert.ok(M.collectMedia({ photos: Array(5).fill(jpeg(100)) }).error, "5 photos are refused");
  assert.ok(M.collectMedia({ photos: [jpeg(M.IMG_MAX + 10)] }).error, "a photo over 600KB is refused");
  assert.ok(M.collectMedia({ photos: [jpeg(550e3), jpeg(550e3), jpeg(550e3)] }).error, "over 1.4MB together is refused");
  assert.ok(M.collectMedia({ photos: [Buffer.from("<svg onload=alert(1)>").toString("base64")] }).error, "not an image is refused");
  assert.ok(M.collectMedia({ photos: [webm(100)] }).error, "audio posing as a photo is refused");
  assert.deepEqual(M.collectMedia({}).items, []);
});
test("the admin media key pattern accepts only the keys we write", () => {
  for (const k of ["p", "p1", "p2", "p3", "a"]) assert.ok(M.MEDIA_KEY.test(k), k);
  for (const k of ["p4", "p0", "x", "", "p1a", "../p"]) assert.ok(!M.MEDIA_KEY.test(k), k);
});
test("phone budget: one photo keeps 560KB, four share the request and fit the server", () => {
  assert.equal(L.photoBudget(1), 560 * 1024);
  const four = L.photoBudget(L.FB_PHOTOS_MAX);
  assert.ok(four * L.FB_PHOTOS_MAX <= 1200 * 1024 && four * L.FB_PHOTOS_MAX < M.IMG_TOTAL);
  assert.ok(four < M.IMG_MAX);
  assert.ok(L.FB_PHOTOS_MAX === M.PHOTOS_MAX, "phone and server agree on the count");
  // 4 photos at budget + the longest voice note, base64 in JSON, fit under the body limit
  assert.ok(Math.ceil((four * 4 + M.AUD_MAX) * 4 / 3) + 4000 < M.BODY_MAX);
});
test("L3: stored media is served with fixed, safe headers", () => {
  const h = M.mediaHeaders("image/jpeg");
  assert.equal(h["content-type"], "image/jpeg");
  assert.equal(h["content-disposition"], 'inline; filename="report.jpg"');
  assert.equal(h["cross-origin-resource-policy"], "same-origin");
  assert.equal(h["x-content-type-options"], "nosniff");
  assert.equal(h["content-security-policy"], "default-src 'none'; sandbox");
  assert.equal(h["cache-control"], "private, no-store");
  assert.equal(M.mediaHeaders("audio/webm")["content-disposition"], 'inline; filename="report.webm"');
  // an unknown or missing type is never echoed back
  for (const ct of [undefined, "text/html", "image/svg+xml"]) { const x = M.mediaHeaders(ct); assert.equal(x["content-type"], "application/octet-stream"); assert.equal(x["content-disposition"], 'inline; filename="report.bin"'); }
  const { readFileSync } = require("node:fs");
  assert.match(readFileSync(join(ROOT, "netlify", "functions", "admin.mjs"), "utf8"), /new Response\(r\.data, \{ headers: mediaHeaders\(r\.metadata && r\.metadata\.ct\) \}\)/);
});
