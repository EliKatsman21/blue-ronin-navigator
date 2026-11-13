// Ride-mode logic that runs on every GPS fix: distance to the route line, the off-route rule, search text.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const L = require("../../site/logic.js").BRL;

// A straight 4 km road north along longitude 35.0 with vertices only at the ends and the middle,
// the way OSRM draws a straight highway.
const road = [[35.0, 32.60], [35.0, 32.62], [35.0, 32.636]];
const cum = L.cumulative(road);

test("a rider on a long straight segment is on the route, not 1 km away", () => {
  const r = L.nearestOnLine(road, cum, 0, [35.0003, 32.61]); // ~28 m east of the road, mid-segment
  assert.ok(r.d < 0.04, `distance to the line should be ~28 m, got ${(r.d * 1000).toFixed(0)} m`);
  assert.ok(Math.abs(r.km - 1.11) < 0.02, `km along the route should be ~1.11, got ${r.km.toFixed(3)}`);
  assert.equal(r.i, 0);
});

test("km along the route moves smoothly inside a segment and clamps at the ends", () => {
  const a = L.nearestOnLine(road, cum, 0, [35.0, 32.605]).km, b = L.nearestOnLine(road, cum, 0, [35.0, 32.615]).km;
  assert.ok(b - a > 1.0 && b - a < 1.2);
  assert.equal(L.nearestOnLine(road, cum, 0, [35.0, 32.59]).km, 0);
  assert.ok(Math.abs(L.nearestOnLine(road, cum, 0, [35.0, 32.65]).km - cum[cum.length - 1]) < 1e-9);
});

test("a rider who really left the road is measured correctly", () => {
  const r = L.nearestOnLine(road, cum, 0, [35.005, 32.61]); // ~470 m east
  assert.ok(r.d > 0.4 && r.d < 0.55);
});

test("off-route needs 3 fixes over 6 s beyond an accuracy-aware threshold, with a cooldown", () => {
  const s = {}; let t = 1_000_000;
  // jitter inside the threshold never counts
  for (let i = 0; i < 10; i++) assert.equal(L.offRoute(s, 0.05, 20, (t += 1000), true), false);
  assert.equal(s.n, 0);
  // poor accuracy widens the threshold: 120 m off with 80 m accuracy is not "off"
  assert.equal(L.offRoute(s, 0.12, 80, (t += 1000), true), false);
  // three quick off fixes are not enough, time matters too
  assert.equal(L.offRoute(s, 0.3, 15, (t += 1000), true), false);
  assert.equal(L.offRoute(s, 0.3, 15, (t += 1000), true), false);
  assert.equal(L.offRoute(s, 0.3, 15, (t += 1000), true), false);
  assert.equal(L.offRoute(s, 0.3, 15, (t += 4000), true), true);
  // right after a reroute: quiet for 25 s even if still off
  s.lastAt = t; s.n = 0; s.since = 0;
  for (let i = 0; i < 10; i++) assert.equal(L.offRoute(s, 0.3, 15, (t += 2000), true), false);
  assert.equal(L.offRoute(s, 0.3, 15, (t += 6000), true), true);
  // standing still never reroutes
  const s2 = {}; for (let i = 0; i < 20; i++) assert.equal(L.offRoute(s2, 0.5, 10, (t += 2000), false), false);
});

test("search text: quote marks, abbreviations and street prefixes", () => {
  assert.equal(L.normQuery('רחוב הרצל 10 ת"א'), "הרצל 10 תל אביב");
  assert.equal(L.normQuery("שד׳ רוטשילד 1, ת״א-יפו"), "שדרות רוטשילד 1, תל אביב");
  assert.equal(L.normQuery("הנשיא 3 ב״ש"), "הנשיא 3 באר שבע");
  assert.equal(L.normQuery("דרך יפו 97 י-ם"), "דרך יפו 97 ירושלים");
  assert.equal(L.normQuery("  עזריאלי   חיפה "), "עזריאלי חיפה");
  assert.equal(L.normQuery("תאנה"), "תאנה"); // a word that starts with ת is left alone
  assert.ok(L.looksLikeAddress("הרצל 10 חיפה"));
  assert.ok(!L.looksLikeAddress("עזריאלי חיפה"));
  assert.ok(!L.looksLikeAddress("6"));
});

test("the search box never shows a real personal address as its example", async () => {
  const { readFileSync } = await import("node:fs");
  const app = readFileSync(new URL("../../site/app.js", import.meta.url), "utf8");
  assert.ok(!app.includes("המרגנית"), "placeholder must not carry a private address");
});

test("all-time top speed: highest saved ride, demo excluded, record survives the journal cap", () => {
  const r = (id, vmax, start, extra = {}) => ({ id, vmax, start, title: id, ...extra });
  const rides = [r("a", 96, 3), r("b", 131, 2), r("demo", 150, 4, { demo: true }), r("c", 131, 5), r("d", 240, 6)];
  assert.deepEqual(L.topSpeed(rides, null), { v: 131, id: "b", start: 2, title: "b" }, "tie goes to the earlier ride; demo and >230 ignored");
  assert.equal(L.topSpeed([], null), null);
  const rec = { v: 140, id: "old", start: 1, title: "old" };
  assert.equal(L.topSpeed(rides, rec).id, "old", "a record whose ride fell off the 60-ride list is kept");
  assert.equal(L.topSpeed([r("e", 150, 7)], rec).id, "e", "a faster ride takes the record");
  assert.equal(L.topSpeed([r("old", 90, 1), r("f", 100, 2)], rec).id, "f", "a ride still in the list is judged by the list (recomputed after a change)");
  assert.equal(L.topSpeed([r("x", 0, 1)], { v: 120, id: "demo", start: 1 }), null, "a demo record never counts");
});
