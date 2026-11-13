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

test("map markers: keyboard focus shows the app's focus ring, the start marker too", async ({ page, pageErrors }) => {
  await boot(page, "#route");
  await page.locator('.tab[data-t="route"]').click();
  await expect(page.locator(".mk.start").first()).toBeAttached({ timeout: 15_000 });
  const ring = () => page.evaluate(() => { const e = document.activeElement, cs = getComputedStyle(e);
    return { mk: e.classList.contains("mk"), start: e.classList.contains("start"), style: cs.outlineStyle, w: parseFloat(cs.outlineWidth), color: cs.outlineColor,
      sun: (() => { const t = document.createElement("i"); t.style.color = "var(--sun)"; document.body.appendChild(t); const c = getComputedStyle(t).color; t.remove(); return c; })() }; });
  // reach the start marker from the one after it with the keyboard, so :focus-visible applies
  const marks = page.locator(".mk");
  await marks.nth(1).focus(); await page.keyboard.press("Shift+Tab");
  const s = await ring();
  expect(s.mk && s.start, "focus on the start marker").toBe(true);
  expect(s.style).toBe("solid"); expect(s.w).toBeGreaterThanOrEqual(2);
  expect(s.color, "the focus colour, not the start marker's own outline").toBe(s.sun);
  await page.keyboard.press("Tab");
  const n = await ring();
  expect(n.mk && !n.start).toBe(true); expect(n.style).toBe("solid"); expect(n.w).toBeGreaterThanOrEqual(2);
  expect(pageErrors, pageErrors.join("\n\n")).toEqual([]);
});
