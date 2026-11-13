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

test("keyboard-only walk through all six tabs: every stop has a name, none inside hidden content", async ({ page, pageErrors }) => {
  test.setTimeout(90_000);
  await boot(page);
  const hard = [];
  for (const t of TABS) {
    // reach the tab with the keyboard only: focus the selected tab, arrow to the wanted one, Enter
    await page.locator('.tab[aria-selected="true"]').focus();
    const order = await page.locator(".tab").evaluateAll(ts => ts.map(x => x.dataset.t));
    const cur = await page.locator('.tab[aria-selected="true"]').getAttribute("data-t");
    let steps = order.indexOf(t) - order.indexOf(cur);
    while (steps > 0) { await page.keyboard.press("ArrowLeft"); steps--; }
    while (steps < 0) { await page.keyboard.press("ArrowRight"); steps++; }
    await page.keyboard.press("Enter");
    await expect(page.locator(`.tab[data-t="${t}"]`)).toHaveAttribute("aria-selected", "true");
    const seen = [];
    for (let i = 0; i < 60; i++) {
      await page.keyboard.press("Tab");
      const f = await page.evaluate(() => {
        const e = document.activeElement; if (!e || e === document.body) return null;
        const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
        const name = e.getAttribute("aria-label") || (e.getAttribute("aria-labelledby") || "").split(" ").map(id => (document.getElementById(id) || {}).textContent || "").join(" ")
          || (e.labels && e.labels[0] && e.labels[0].textContent) || e.textContent || e.getAttribute("title") || e.getAttribute("placeholder") || (e.querySelector("img[alt]") || {}).alt || "";
        const vis = r.width > 0 && r.height > 0 && cs.visibility !== "hidden";
        return { key: e.id || e.tagName + "." + String(e.className).slice(0, 40) + ":" + name.trim().slice(0, 30), name: name.trim(), hidden: !!e.closest('[aria-hidden="true"],[hidden],[inert]'),
          vis, ring: cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0 || cs.boxShadow !== "none", mk: e.classList.contains("mk") };
      });
      if (!f) continue;
      if (seen.includes(f.key) && seen.length > 3) break; // wrapped around
      seen.push(f.key);
      if (!f.name) hard.push(`${t}: no name ${f.key}`);
      if (f.hidden) hard.push(`${t}: focus inside hidden content ${f.key}`);
      if (f.mk && f.vis && !f.ring) hard.push(`${t}: marker without a focus ring ${f.key}`);
    }
    expect(seen.length, `${t}: the keyboard reaches controls`).toBeGreaterThan(3);
  }
  expect(hard, hard.join("\n")).toEqual([]);
  expect(pageErrors, pageErrors.join("\n\n")).toEqual([]);
});
