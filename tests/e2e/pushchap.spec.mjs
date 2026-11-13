// The weekend push brief follows the current route (QA round 2.8, m3, decision B): a built-in chapter sends its
// id, a custom route sends "" (the best chapter this weekend), debounced, only on a change. Service workers are
// blocked in the tests, so a stand-in navigator.serviceWorker with one push subscription is installed first.
import { test, expect, boot } from "./fixtures.mjs";

const U1 = { id: "umine", title: "המסלול שלי", stops: [{ name: "א", lat: 32.95, lon: 35.30 }, { name: "ב", lat: 33.10, lon: 35.45 }, { name: "ג", lat: 33.05, lon: 35.60 }], opts: {} };

test("push chapter: a custom route sends best (\"\"), a built-in chapter sends its id", async ({ page, pageErrors }, ti) => {
  test.skip(ti.project.name !== "desktop", "app logic, once");
  test.setTimeout(60_000);
  const sent = [];
  await page.route("**/api/subscribe", async r => { const b = JSON.parse(r.request().postData() || "{}"); sent.push(b); await r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, chap: b.chap }) }); });
  await page.addInitScript(u1 => {
    try { localStorage.setItem("brn:myRoutes", JSON.stringify([u1])); localStorage.setItem("brn:chap", JSON.stringify("c1")); localStorage.setItem("brn:pushChap", JSON.stringify("c1")); } catch (e) { }
    const sub = { endpoint: "https://fcm.googleapis.com/fcm/send/test", toJSON() { return { endpoint: this.endpoint, keys: { p256dh: "k", auth: "a" } }; } };
    const reg = { pushManager: { getSubscription: async () => sub }, update: async () => { }, addEventListener() { } };
    Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: { controller: {}, ready: Promise.resolve(reg), register: async () => reg, addEventListener() { }, getRegistrations: async () => [] } });
  }, U1);
  await boot(page, "#route");
  await page.locator('.tab[data-t="route"]').click();
  const pick = id => page.evaluate(id => { const b = document.querySelector(`[data-c="${id}"]`); if (!b) throw new Error("no route button " + id); b.click(); }, id);
  await expect(page.locator(`[data-c="${U1.id}"]`)).toBeAttached({ timeout: 10_000 });
  await pick(U1.id);
  await expect.poll(() => sent.length, { timeout: 10_000 }).toBe(1);
  expect(sent[0]).toEqual({ setChap: true, endpoint: "https://fcm.googleapis.com/fcm/send/test", chap: "" });
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("brn:pushChap")))).toBe("");
  await page.locator('.tab[data-t="route"]').click();
  await expect(page.locator('[data-c="c2"]')).toBeAttached({ timeout: 10_000 });
  await pick("c2");
  await expect.poll(() => sent.length, { timeout: 10_000 }).toBe(2);
  expect(sent[1].chap).toBe("c2");
  expect(pageErrors, pageErrors.join("\n\n")).toEqual([]);
});
