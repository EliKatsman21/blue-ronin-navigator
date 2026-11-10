// Smoke: the app boots offline, every tab renders something, nothing throws.
import { test, expect, boot } from "./fixtures.mjs";
const TABS = ["go", "brief", "route", "stops", "me", "tools"];

test("boots without uncaught errors", async ({ page, pageErrors }) => {
  await boot(page);
  await page.waitForTimeout(1500);
  expect(pageErrors, pageErrors.join("\n\n")).toEqual([]);
});

for (const t of TABS) {
  test(`tab ${t} renders`, async ({ page, pageErrors }) => {
    await boot(page, "#" + t);
    await page.locator(`.tab[data-t="${t}"]`).click();
    await expect(page.locator(`.tab[data-t="${t}"]`)).toHaveAttribute("aria-selected", "true");
    await page.waitForTimeout(800);
    const visibleText = await page.evaluate(() => document.body.innerText.length);
    expect(visibleText).toBeGreaterThan(200);
    expect(pageErrors, pageErrors.join("\n\n")).toEqual([]);
  });
}

test("boot guard reports a successful boot", async ({ page }) => {
  await boot(page);
  await expect.poll(() => page.evaluate(() => !!(window.BRG && window.BRG.booted)), { timeout: 15_000 }).toBe(true);
});
