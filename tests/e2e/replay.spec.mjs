// Ride replay from the journal: any ride opens after any other, from any state, with the bike on the map and
// the route of THAT ride drawn. A minimal local map style stands in for OpenFreeMap (blocked in tests), so the
// app's own sources and layers really exist.
import { test, expect, boot } from "./fixtures.mjs";

const STYLE = { version: 8, sources: {}, layers: [{ id: "bg", type: "background", paint: { "background-color": "#1b2433" } }] };
// a ride: n points heading roughly north-east from a start, one fix every 10 s
const mkRide = (id, title, lon0, lat0, n, startIso, vmax) => {
  const start = Date.parse(startIso), trk = [];
  for (let i = 0; i < n; i++) trk.push([+(lon0 + i * 0.0012).toFixed(6), +(lat0 + i * 0.0009 + Math.sin(i / 3) * 0.0003).toFixed(6), start + i * 10_000]);
  return { id, chap: "custom", title, start, end: trk[n - 1][2], km: +(n * 0.14).toFixed(1), moving: n * 10, vmax, fuel: 0.4, bike: "test", trk };
};
const A = mkRide("r-a", "רכיבה א׳ · כרמל", 35.02, 32.70, 40, "2026-11-07T06:30:00Z", 96);
const B = mkRide("r-b", "רכיבה ב׳ · גליל", 35.40, 32.95, 50, "2026-11-08T07:00:00Z", 112);

async function setup(page) {
  await page.route(/tiles\.openfreemap\.org\/styles\//, r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(STYLE) }));
  await page.addInitScript(([rides]) => {
    try {
      localStorage.setItem("brn:rides", JSON.stringify(rides));
      localStorage.setItem("brn:pro", JSON.stringify({ token: "test", exp: Date.now() + 864e5, src: "code", checked: Date.now() }));
    } catch (e) { }
  }, [[B, A]]); // newest first, like the app stores them
  await boot(page, "#me");
  await expect.poll(() => page.evaluate(() => !!(window.BR_MAP && BR_MAP.getLayer("br-ride"))), { timeout: 20_000 }).toBe(true);
}
const state = page => page.evaluate(() => {
  const m = window.BR_MAP, src = m.getSource("br-ride"), d = src && src.serialize().data;
  const first = d && d.features && d.features[0] ? d.features[0].geometry.coordinates[0] : null;
  const bikes = [...document.querySelectorAll(".maplibregl-marker.bike")];
  return {
    first, bikes: bikes.length, bikeShown: bikes.length === 1 && getComputedStyle(bikes[0]).display !== "none",
    rideLayer: !!m.getLayer("br-ride") && m.getLayoutProperty("br-ride", "visibility") !== "none",
    flySrc: !!m.getSource("br-fly"), chip: (document.getElementById("rideChip") || {}).textContent || "",
    flying: document.body.classList.contains("flying"), flyui: !document.getElementById("flyui").hidden,
  };
});
const openMe = async page => {
  await page.evaluate(() => { const b = document.querySelector('.sz[data-size="half"]'); b && b.click(); });
  await page.evaluate(() => document.querySelector('.tab[data-t="me"]').click());
  await expect(page.locator("[data-rplay]").first()).toBeAttached({ timeout: 10_000 });
};
// journal buttons are under the faded sheet while flying; click them the way a tap lands once the sheet is up
const tap = (page, sel) => page.evaluate(s => document.querySelector(s).click(), sel);
const expectRide = async (page, ride) => {
  await expect.poll(async () => (await state(page)).first, { timeout: 10_000 }).toEqual([ride.trk[0][0], ride.trk[0][1]]);
  const s = await state(page);
  expect(s.bikeShown, "exactly one bike marker, visible").toBe(true);
  expect(s.rideLayer, "the ride's route layer is there and visible").toBe(true);
  expect(s.flySrc).toBe(true);
  expect(s.chip).toContain(ride.title);
  expect(s.flying && s.flyui).toBe(true);
};

test("replay ride A, then ride B (while A flies), then the demo", async ({ page, pageErrors }) => {
  await setup(page); await openMe(page);
  await tap(page, '[data-rplay="1"]'); // A (second in the list)
  await expectRide(page, A);
  await tap(page, '[data-rplay="0"]'); // B, straight over the running replay
  await expectRide(page, B);
  await tap(page, "#jDemo");
  await expect.poll(async () => (await state(page)).chip, { timeout: 10_000 }).toContain("הדגמה");
  const s = await state(page);
  expect(s.bikeShown).toBe(true);
  expect(s.first).not.toEqual([B.trk[0][0], B.trk[0][1]]);
  expect(pageErrors, pageErrors.join("\n\n")).toEqual([]);
});

test("close a replay, show another ride 'on the map', then replay it: the bike is back", async ({ page, pageErrors }) => {
  await setup(page); await openMe(page);
  await tap(page, '[data-rplay="1"]');
  await expectRide(page, A);
  await page.locator("#flClose").click(); // ends in the clean ride view of A
  await expect.poll(async () => (await state(page)).bikes).toBe(0);
  await openMe(page);
  await tap(page, '[data-rshow="0"]'); // B on the map
  await expect.poll(async () => (await state(page)).first).toEqual([B.trk[0][0], B.trk[0][1]]);
  expect((await state(page)).chip).toContain(B.title);
  await openMe(page);
  await tap(page, '[data-rplay="0"]'); // replay B from inside the ride view
  await expectRide(page, B);
  await tap(page, '[data-rshow="1"]'); // "on the map" for A while B flies: the replay stops, A is shown
  await expect.poll(async () => (await state(page)).first).toEqual([A.trk[0][0], A.trk[0][1]]);
  const s = await state(page);
  expect(s.flying, "the replay stopped").toBe(false);
  expect(s.bikes).toBe(0);
  expect(pageErrors, pageErrors.join("\n\n")).toEqual([]);
});

test("a style reload during a replay keeps the ride view clean and the bike on", async ({ page, pageErrors }) => {
  await setup(page); await openMe(page);
  await tap(page, '[data-rplay="1"]');
  await expectRide(page, A);
  await page.evaluate(s => window.BR_MAP.setStyle(s, { diff: false }), { ...STYLE, layers: [{ id: "bg2", type: "background", paint: { "background-color": "#eeeeee" } }] });
  await expect.poll(() => page.evaluate(() => !!BR_MAP.getLayer("br-ride")), { timeout: 10_000 }).toBe(true);
  await page.waitForTimeout(300);
  const vis = await page.evaluate(() => BR_MAP.getLayer("br-route-solid") ? BR_MAP.getLayoutProperty("br-route-solid", "visibility") : "none");
  expect(vis, "chapter route stays hidden in the ride view").toBe("none");
  await expectRide(page, A);
  expect(pageErrors, pageErrors.join("\n\n")).toEqual([]);
});

test("journal stats: the top speed tile holds the fastest ride and opens it", async ({ page, pageErrors }) => {
  await setup(page); await openMe(page);
  const top = page.locator("#jTop");
  await expect(top).toContainText("112");
  await expect(page.locator(".fsum.jstats > *")).toHaveCount(6);
  const heights = await page.locator(".fsum.jstats > *").evaluateAll(els => els.map(e => Math.round(e.getBoundingClientRect().height)));
  expect(Math.max(...heights) - Math.min(...heights), "tiles in a row line up").toBeLessThanOrEqual(2);
  await top.click();
  await expect.poll(async () => (await state(page)).chip).toContain(B.title);
  expect(pageErrors, pageErrors.join("\n\n")).toEqual([]);
});
