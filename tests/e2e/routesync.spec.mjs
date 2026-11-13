// The weekend tab follows the route chosen in the route tab: its hour-by-hour forecast and score belong to THAT
// route, never to the previous one while the new forecast loads. The weather API is mocked: every point's
// temperature equals its latitude, so the numbers tell whose weather is on screen.
import { test, expect, boot } from "./fixtures.mjs";

const days = () => { const out = []; for (let d = -1; d < 10; d++) out.push(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date(Date.now() + d * 864e5))); return [...new Set(out)]; };
function wxFor(lat) {
  const time = []; days().forEach(d => { for (let h = 0; h < 24; h++) time.push(`${d}T${String(h).padStart(2, "0")}:00`); });
  const n = time.length, f = v => Array(n).fill(v);
  return { hourly: { time, temperature_2m: f(lat), precipitation_probability: f(0), precipitation: f(0), weather_code: f(1), wind_speed_10m: f(8), wind_gusts_10m: f(15), visibility: f(20000), cloud_cover: f(10) },
    current: { temperature_2m: lat, apparent_temperature: lat, weather_code: 1, wind_speed_10m: 8, wind_gusts_10m: 15, precipitation: 0 } };
}
// two routes of the rider's own: the north one's middle stop is at 33.1°N, the south one's at 30.6°N
const U1 = { id: "unorth", title: "צפון שלי", stops: [{ name: "א", lat: 32.95, lon: 35.30 }, { name: "ב", lat: 33.10, lon: 35.45 }, { name: "ג", lat: 33.05, lon: 35.60 }], opts: {} };
const U2 = { id: "usouth", title: "דרום שלי", stops: [{ name: "ד", lat: 30.90, lon: 34.80 }, { name: "ה", lat: 30.60, lon: 34.80 }, { name: "ו", lat: 30.40, lon: 34.90 }], opts: {} };

test("weekend tab: hour-by-hour weather is the chosen route's, also right after switching", async ({ page, pageErrors }) => {
  test.setTimeout(90_000);
  let delay = 0;
  await page.route(/\/api\/wx\?p=/, async r => {
    const p = new URL(r.request().url()).searchParams.get("p").split(";").map(s => s.split(",").map(Number));
    if (delay) await new Promise(res => setTimeout(res, delay));
    await r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: p.map(([lat]) => wxFor(lat)) }) });
  });
  await page.addInitScript(([u1, u2]) => { try { localStorage.setItem("brn:myRoutes", JSON.stringify([u1, u2])); localStorage.setItem("brn:chap", JSON.stringify(u1.id)); localStorage.removeItem("brn:wx2"); } catch (e) { } }, [U1, U2]);
  await boot(page, "#brief");
  await page.locator('.tab[data-t="brief"]').click();
  const hourly = page.locator("#p-brief h3", { hasText: "שעה אחרי שעה" });
  await expect(hourly).toContainText(U1.title, { timeout: 15_000 });
  await expect(page.locator("#p-brief .hours .hour .t").first()).toHaveText("33°");

  const events = await page.evaluate(() => { window.__routeEv = []; addEventListener("br:route", e => window.__routeEv.push(e.detail)); return true; });
  expect(events).toBe(true);
  delay = 2500; // the new route's forecast takes a while: nothing of the old route may stand in for it
  await page.locator('.tab[data-t="route"]').click();
  await expect(page.locator(`[data-c="${U2.id}"]`)).toBeAttached({ timeout: 10_000 });
  await page.evaluate(id => { const b = document.querySelector(`[data-c="${id}"]`); if (b) b.click(); else throw new Error("no route button " + id); }, U2.id);
  await page.locator('.tab[data-t="brief"]').click();
  await page.waitForTimeout(300);
  const during = await page.evaluate(() => [...document.querySelectorAll("#p-brief .hours .hour .t")].map(e => e.textContent));
  expect(during.includes("33°"), "the north route's weather is not shown for the south route").toBe(false);
  await expect(hourly).toContainText(U2.title, { timeout: 15_000 });
  await expect(page.locator("#p-brief .hours .hour .t").first()).toHaveText("31°");
  expect(await page.evaluate(() => window.__routeEv)).toEqual([{ id: U2.id, prev: U1.id }]);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("brn:chap")))).toBe(U2.id);
  expect(pageErrors, pageErrors.join("\n\n")).toEqual([]);
});
