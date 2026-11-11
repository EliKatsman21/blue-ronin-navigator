// The waitlist and link-hub pages: they render, validate before sending, and survive the API being down.
import { test, expect } from "./fixtures.mjs";

test("join: validates, then reports the outage instead of breaking", async ({ page, pageErrors }) => {
  await page.goto("/join.html?src=ig");
  await expect(page.locator("h1")).toBeVisible();
  await page.locator("#jGo").click();
  await expect(page.locator("#jErr")).toContainText("מייל");
  await page.locator("#jEmail").fill("rider@example.com");
  await page.locator("#jGo").click();
  await expect(page.locator("#jErr")).toContainText("הסכמה");
  await page.locator("#jOk").check();
  await page.locator("#jGo").click();
  await expect(page.locator("#jErr")).not.toBeEmpty(); // the test server answers 503
  await expect(page.locator("#jGo")).toBeEnabled();
  expect(pageErrors, pageErrors.join("\n\n")).toEqual([]);
});

test("join: a successful signup shows the personal link", async ({ page, pageErrors }) => {
  await page.route("**/api/join", r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, code: "ABC234", n: 7, refs: 1, need: 3 }) }));
  await page.goto("/join.html?r=XYZ789");
  await page.locator("#jEmail").fill("rider@example.com"); await page.locator("#jOk").check(); await page.locator("#jGo").click();
  await expect(page.locator("#jDone")).toBeVisible();
  await expect(page.locator("#jLink")).toHaveText("https://blueronin.app/join?r=ABC234");
  await expect(page.locator("#jNum")).toHaveText("#7");
  await expect(page.locator("#jDots i.on")).toHaveCount(1);
  expect(pageErrors, pageErrors.join("\n\n")).toEqual([]);
});

test("go: links carry the channel", async ({ page, pageErrors }) => {
  await page.goto("/go.html?src=yt");
  await expect(page.locator("#gJoin")).toHaveAttribute("href", "join?src=yt");
  await expect(page.locator("a.btn")).toHaveCount(5);
  expect(pageErrors, pageErrors.join("\n\n")).toEqual([]);
});
