// Feedback rejected by the server (QA round 2.8, m2): the rider is told why in Hebrew, the text is kept and the
// button works again. The real server answers 413 in plain text and 429 with its own Hebrew error.
import { test, expect, boot } from "./fixtures.mjs";

for (const [status, ctype, body, want] of [
  [413, "text/plain", "too large", /התמונות או ההקלטה גדולות מדי\. נסו לשלוח פחות תמונות/],
  [429, "application/json", '{"error":"rate"}', /שלחתם הרבה דיווחים בשעה האחרונה\. אפשר לנסות שוב בעוד שעה/],
  [400, "application/json", '{"error":"קצר מדי"}', /קצר מדי/],
  [503, "application/json", "{}", /השליחה נכשלה/],
  // m8 (QA 2026-11-13): an English error (the edge gate's 403) never reaches the rider
  [403, "application/json", '{"error":"forbidden"}', /^השליחה נכשלה/]]) {
  test(`feedback: server answers ${status} -> a clear Hebrew message, text kept`, async ({ page, pageErrors }, ti) => {
    test.skip(ti.project.name === "phone" && status !== 413 && status !== 429, "the generic cases once");
    await page.route("**/api/feedback", r => r.fulfill({ status, contentType: ctype, body }));
    await boot(page, "#tools");
    await page.locator('.tab[data-t="tools"]').click();
    await page.locator("#fbText").fill("בדיקת דחייה מהשרת");
    await page.locator("#fbGo").click();
    const err = page.locator("#fbRes .fberr[role=alert]");
    await expect(err).toBeVisible({ timeout: 10_000 });
    await expect(err).toHaveText(want);
    await expect(err).toContainText("הטקסט נשמר");
    await expect(page.locator("#fbText")).toHaveValue("בדיקת דחייה מהשרת");
    await expect(page.locator("#fbGo")).toBeEnabled();
    expect(pageErrors, pageErrors.join("\n\n")).toEqual([]);
  });
}
