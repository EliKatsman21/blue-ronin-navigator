// The installed shell opens with the whole network off (promoted from QA round 2.8): second open after the
// service worker has precached the shell, then offline reload. MapLibre comes from the shell cache and no tab
// renders empty. Service workers are allowed in this test only (the config blocks them elsewhere).
import { test, expect } from "./fixtures.mjs";

const TABS = ["go", "brief", "route", "stops", "me", "tools"];

test("offline boot: the installed shell opens with the network off, no tab empty", async ({ browser }, ti) => {
  test.skip(ti.project.name !== "phone", "once, phone first");
  test.setTimeout(60_000);
  const ctx = await browser.newContext({ ...ti.project.use, serviceWorkers: "allow", baseURL: ti.project.use.baseURL });
  const page = await ctx.newPage(); const errs = []; page.on("pageerror", e => errs.push(String(e && e.stack || e)));
  try {
    await page.route(u => !/^http:\/\/localhost/.test(u.href), r => r.abort("internetdisconnected"));
    await page.addInitScript(() => { try { localStorage.setItem("brn:introSeen", "1"); } catch (e) { } });
    await page.goto("/index.html");
    await page.locator(".tabs .tab").first().waitFor({ timeout: 20_000 });
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    // the shell is precached when the worker is active and its cache holds the vendored map library
    await expect.poll(() => page.evaluate(async () => { for (const k of await caches.keys()) { const c = await caches.open(k); if ((await c.keys()).some(r => /vendor\/maplibre-gl/.test(r.url))) return true; } return false; }), { timeout: 20_000 }).toBe(true);
    await ctx.setOffline(true);
    await page.reload();
    await page.locator(".tabs .tab").first().waitFor({ timeout: 20_000 });
    expect(await page.evaluate(() => navigator.onLine)).toBe(false);
    expect(await page.evaluate(() => !!window.maplibregl), "MapLibre loaded from the shell cache").toBe(true);
    for (const t of TABS) { await page.locator(`.tab[data-t="${t}"]`).click(); await expect(page.locator(`.tab[data-t="${t}"]`)).toHaveAttribute("aria-selected", "true"); }
    const empty = await page.evaluate(() => [...document.querySelectorAll("#panes > *")].filter(p => !p.textContent.trim()).map(p => p.id));
    expect(empty, "no tab renders empty").toEqual([]);
    expect(errs, errs.join("\n\n")).toEqual([]);
  } finally { await ctx.close(); }
});
