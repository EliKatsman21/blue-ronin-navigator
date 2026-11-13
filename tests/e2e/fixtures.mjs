// Shared setup: MapLibre and SunCalc are self-hosted in site/vendor/ and served by serve.mjs like the rest of
// the app; every outside request is blocked (as if the CDNs were down), so the tests are deterministic, need
// no network, and prove the app boots without any CDN. Page errors are collected per test.
import { test as base, expect } from "@playwright/test";
export const test = base.extend({
  // auto: every test gets the offline routing, even if it never reads pageErrors.
  pageErrors: [async ({ page }, use) => {
    const errors = [];
    page.on("pageerror", e => errors.push(String(e && e.stack || e)));
    await page.route(url => !/^http:\/\/localhost/.test(url.href), route => route.abort("internetdisconnected"));
    await use(errors);
  }, { auto: true }],
});
export { expect };
// Opens the app, skips the intro and waits for the tab bar.
export async function boot(page, hash = "") {
  await page.addInitScript(() => { try { localStorage.setItem("brn:introSeen", "1"); } catch (e) {} });
  await page.goto("/index.html" + hash);
  await page.locator(".tabs .tab").first().waitFor({ state: "visible", timeout: 20_000 });
  const intro = page.locator("#intro");
  if (await intro.isVisible().catch(() => false)) { await intro.click({ force: true }).catch(() => {}); await page.waitForTimeout(3500); }
}
