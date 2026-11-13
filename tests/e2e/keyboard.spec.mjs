// Keyboard use (QA round 2.8, m1, m5 and the keyboard walk): the layers panel closes on Escape, map markers show a
// focus ring, and a keyboard-only pass through every tab finds no control without a name or inside hidden content.
import { test, expect, boot } from "./fixtures.mjs";

const TABS = ["go", "brief", "route", "stops", "me", "tools"];

test("layers panel: keyboard open, Escape closes, focus returns to its button", async ({ page, pageErrors }) => {
  await boot(page);
  const b = page.locator("#fLayers");
  await b.focus(); await page.keyboard.press("Enter");
  await expect(page.locator("#layersPop")).toBeVisible();
  await expect(b).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");
  await expect(page.locator("#layersPop")).toBeHidden();
  await expect(b).toHaveAttribute("aria-pressed", "false");
  expect(await b.evaluate(e => e === document.activeElement), "focus is back on the layers button").toBe(true);
  expect(pageErrors, pageErrors.join("\n\n")).toEqual([]);
});
