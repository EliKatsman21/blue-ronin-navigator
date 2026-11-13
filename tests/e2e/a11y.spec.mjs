// Accessibility baseline (round 2.8, legal P0): axe-core on every tab, the intro and the public pages,
// at phone size, in the light and the dark theme. Fails on serious or critical WCAG 2.0 / 2.1 A and AA violations.
// Plus keyboard checks for the patterns axe cannot see: tabs, the dialog, the SOS alternative to long-press.
//
// Documented exclusions:
// - "#map": the MapLibre canvas and its markers. The map is a visual aid; every fact on it has a text twin
//   in the tabs (route steps, stops, fuel, cafes), as the accessibility statement says. MapLibre's own controls
//   and attribution are third-party markup.
// - ".lockwrap .blur": the blurred Pro preview is decorative and intentionally faded behind the unlock button.
// Everything else is in scope: the sheet, the top bar, the floating buttons, the modal, the public pages.
import { test, expect, boot } from "./fixtures.mjs";
import AxeBuilder from "@axe-core/playwright";

test.skip(({ isMobile }) => !isMobile, "phone size only (legal baseline); desktop shares the same markup");

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const EXCLUDE = ["#map", ".lockwrap .blur"];
async function axe(page, exclude = EXCLUDE) {
  let b = new AxeBuilder({ page }).withTags(TAGS);
  for (const e of exclude) b = b.exclude(e);
  const r = await b.analyze();
  const bad = r.violations.filter(v => v.impact === "serious" || v.impact === "critical");
  const msg = bad.map(v => `${v.id} (${v.impact}): ${v.help}\n  ` + v.nodes.slice(0, 6).map(n => n.target.join(" ") + "  " + (n.failureSummary || "").split("\n").slice(1, 2).join("")).join("\n  ")).join("\n");
  expect(bad, msg).toEqual([]);
}

for (const scheme of ["light", "dark"]) {
  test.describe(scheme, () => {
    test.use({ colorScheme: scheme });
    for (const t of ["go", "brief", "route", "stops", "me", "tools"]) {
      test(`axe: tab ${t}`, async ({ page }) => {
        await boot(page, "#" + t);
        await page.locator(`.tab[data-t="${t}"]`).click();
        await page.waitForTimeout(900);
        await axe(page);
      });
    }
    for (const p of ["accessibility.html", "privacy.html", "terms.html", "join.html", "go.html"]) {
      test(`axe: ${p}`, async ({ page }) => {
        await page.goto("/" + p);
        await page.waitForTimeout(300);
        await axe(page, []);
      });
    }
  });
}

test("axe: intro on a cold start, and the intro is not hidden from screen readers", async ({ page }) => {
  await page.goto("/index.html");
  await expect(page.locator("#intro")).not.toHaveAttribute("aria-hidden", "true");
  await axe(page);
});

test("axe: an open dialog", async ({ page }) => {
  await boot(page, "#tools");
  await page.locator('.tab[data-t="tools"]').click();
  await page.locator("#creditsGo").click();
  await expect(page.locator("#modal")).toBeVisible();
  await page.waitForTimeout(400);
  await axe(page);
});

test("tabs: tab/tabpanel wiring and arrow keys (RTL: left = next)", async ({ page }) => {
  await boot(page, "#brief");
  const tabs = page.locator(".tab");
  await expect(tabs).toHaveCount(6);
  for (const t of await tabs.all()) {
    const panel = await t.getAttribute("aria-controls");
    await expect(page.locator("#" + panel)).toHaveAttribute("role", "tabpanel");
    await expect(page.locator("#" + panel)).toHaveAttribute("aria-labelledby", await t.getAttribute("id"));
  }
  await page.locator('.tab[data-t="brief"]').click();
  await expect(page.locator('.tab[tabindex="0"]')).toHaveCount(1);
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator('.tab[data-t="route"]')).toBeFocused();
  await expect(page.locator('.tab[data-t="route"]')).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#p-route")).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator('.tab[data-t="brief"]')).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("End");
  await expect(page.locator('.tab[data-t="tools"]')).toBeFocused();
  await page.keyboard.press("Home");
  await expect(page.locator('.tab[data-t="go"]')).toBeFocused();
});

test("dialog: named, focus moves in, Escape closes, focus returns", async ({ page }) => {
  await boot(page, "#tools");
  await page.locator('.tab[data-t="tools"]').click();
  const opener = page.locator("#creditsGo");
  await opener.focus();
  await page.keyboard.press("Enter");
  const m = page.locator("#modal");
  await expect(m).toBeVisible();
  const lab = await m.getAttribute("aria-labelledby");
  expect(lab).toBeTruthy();
  expect((await page.locator("#" + lab).innerText()).trim().length).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(() => document.getElementById("modal").contains(document.activeElement))).toBe(true);
  for (let i = 0; i < 25; i++) await page.keyboard.press("Tab");
  expect(await page.evaluate(() => document.getElementById("modal").contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(m).toBeHidden();
  await expect(opener).toBeFocused();
});

test("toast is a live region", async ({ page }) => {
  await boot(page);
  await expect(page.locator("#toast")).toHaveAttribute("role", "status");
  await expect(page.locator("#toast")).toHaveAttribute("aria-live", "polite");
});

test("SOS: a tap or Enter opens a confirm step and never sends by itself", async ({ page }) => {
  await boot(page);
  const sent = [];
  await page.route("**/api/sos/**", r => { sent.push(r.request().url()); return r.fulfill({ status: 503, body: "{}" }); });
  await page.evaluate(() => { document.body.classList.add("riding", "hud-compact"); document.getElementById("hud").hidden = false; });
  const sos = page.locator("#hudSos");
  await sos.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#modal")).toBeVisible();
  await expect(page.locator("#sosSend")).toBeVisible();
  await expect(page.locator("#sosNo")).toBeFocused();
  await page.keyboard.press("Enter"); // a second Enter lands on "cancel"
  await expect(page.locator("#modal")).toBeHidden();
  await sos.click();
  await expect(page.locator("#sosSend")).toBeVisible();
  await page.locator("#sosNo").click();
  await page.waitForTimeout(300);
  expect(sent).toEqual([]);
  await expect(page.locator("#modal")).toBeHidden();
});

test("feedback: labelled fields and a text error next to the field", async ({ page }) => {
  await boot(page, "#tools");
  await page.locator('.tab[data-t="tools"]').click();
  await expect(page.getByLabel("סוג הפנייה")).toBeVisible();
  await expect(page.locator('#fbKind option[value="a11y"]')).toHaveText("נגישות");
  await page.locator("#fbGo").click();
  await expect(page.locator("#fbText")).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator("#fbTextErr")).toContainText("כתבו כמה מילים");
  await expect(page.locator("#fbText")).toBeFocused();
  await expect(page.locator(".legal a[href='accessibility.html']")).toBeVisible();
});
