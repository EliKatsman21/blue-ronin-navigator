// Several photos from the gallery at once: ride memories and the feedback form (admin inbox).
// The pickers must ask for multiple files, keep going past a photo the phone can't read, and the feedback
// request must carry every photo (up to 4).
import { test, expect, boot } from "./fixtures.mjs";

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const img = i => ({ name: `ride-${i}.png`, mimeType: "image/png", buffer: PNG });
const broken = { name: "broken.jpg", mimeType: "image/jpeg", buffer: Buffer.from("not really a photo") };

test("memories: the gallery picker takes several photos and skips the broken one", async ({ page, pageErrors }) => {
  await boot(page, "#me");
  await page.locator('.tab[data-t="me"]').click();
  const pick = page.locator("#memPick"); await pick.scrollIntoViewIfNeeded();
  const [chooser] = await Promise.all([page.waitForEvent("filechooser"), pick.click()]);
  expect(chooser.isMultiple(), "gallery picker allows several photos").toBe(true);
  await chooser.setFiles([img(1), img(2), broken]);
  await expect(page.locator("#toast")).toContainText("2 תמונות נשמרו", { timeout: 15_000 });
  await expect(page.locator("#toast")).toContainText("1 לא נתמכו");
  await expect.poll(() => page.locator(".memt").count(), { timeout: 10_000 }).toBeGreaterThanOrEqual(2);
  expect(pageErrors, pageErrors.join("\n\n")).toEqual([]);
});

test("feedback: up to 4 photos at once, all of them sent", async ({ page, pageErrors }) => {
  let sent = null;
  await page.route("**/api/feedback", async r => { sent = JSON.parse(r.request().postData() || "{}"); await r.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true,"ref":"TEST1"}' }); });
  await boot(page, "#tools");
  await page.locator('.tab[data-t="tools"]').click();
  const btn = page.locator("#fbPhoto"); await btn.scrollIntoViewIfNeeded();
  const [chooser] = await Promise.all([page.waitForEvent("filechooser"), btn.click()]);
  expect(chooser.isMultiple()).toBe(true);
  await chooser.setFiles([img(1), img(2), img(3), img(4), img(5)]);
  await expect(page.locator("#fbAtt .fbth")).toHaveCount(4, { timeout: 15_000 });
  await expect(page.locator("#toast")).toContainText("עד 4");
  await page.locator("#fbAtt [data-fp]").first().click();
  await expect(page.locator("#fbAtt .fbth")).toHaveCount(3);
  await page.locator("#fbText").fill("בדיקה עם כמה תמונות");
  await page.locator("#fbGo").click();
  await expect(page.locator("#fbRes")).toContainText("הדיווח התקבל", { timeout: 15_000 });
  expect(sent && sent.photos && sent.photos.length).toBe(3);
  expect(sent.photos.every(p => p.startsWith("data:image/jpeg;base64,"))).toBe(true);
  expect(sent.photo, "the old single field is gone").toBeUndefined();
  await expect(page.locator("#fbAtt .fbth")).toHaveCount(0);
  expect(pageErrors, pageErrors.join("\n\n")).toEqual([]);
});
