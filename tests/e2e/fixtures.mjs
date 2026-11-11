// Shared setup: CDN libraries come from node_modules, every other outside request is blocked,
// so the tests are deterministic and need no network. Page errors are collected per test.
import { test as base, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const nm = p => readFileSync(fileURLToPath(new URL(`../node_modules/${p}`, import.meta.url)));
const LIBS = [
  [/unpkg\.com\/maplibre-gl@[^/]+\/dist\/maplibre-gl\.js/, "maplibre-gl/dist/maplibre-gl.js", "text/javascript"],
  [/unpkg\.com\/maplibre-gl@[^/]+\/dist\/maplibre-gl\.css/, "maplibre-gl/dist/maplibre-gl.css", "text/css"],
  [/cdnjs\.cloudflare\.com\/ajax\/libs\/suncalc\/.*suncalc(\.min)?\.js/, "suncalc/suncalc.js", "text/javascript"],
];
export const test = base.extend({
  // auto: every test gets the offline routing, even if it never reads pageErrors.
  pageErrors: [async ({ page }, use) => {
    const errors = [];
    page.on("pageerror", e => errors.push(String(e && e.stack || e)));
    await page.route(url => !/^http:\/\/localhost/.test(url.href), route => {
      const u = route.request().url();
      const lib = LIBS.find(([re]) => re.test(u));
      return lib ? route.fulfill({ status: 200, contentType: lib[2], body: nm(lib[1]) }) : route.abort("internetdisconnected");
    });
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
