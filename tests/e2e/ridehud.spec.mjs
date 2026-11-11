// Ride board layout on a phone held sideways: speed and arrival are large and side by side, the card is as tall
// as its content (no empty column in "מפה"), and it stays clear of the turn card. Ride mode itself needs GPS and a
// route, so this drives the layout directly: the same classes the app sets.
import { test, expect, boot } from "./fixtures.mjs";

for (const size of ["full", "compact", "min"]) {
  test(`landscape ride board, size ${size}`, async ({ page, pageErrors }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await boot(page);
    await page.evaluate(sz => {
      document.body.classList.add("riding", "hud-" + sz);
      ["full", "compact", "min"].filter(x => x !== sz).forEach(x => document.body.classList.remove("hud-" + x));
      document.getElementById("hud").hidden = false;
      document.getElementById("hudSpeed").textContent = "87";
      document.getElementById("hudArrT").textContent = "18:32";
      document.getElementById("hudArrL").textContent = "76 ק״מ · 52 דק׳";
      document.getElementById("hudNext").textContent = "המרכז";
      const t = document.getElementById("turn"); t.hidden = false;
    }, size);
    await page.waitForTimeout(300);
    const box = id => page.locator(id).boundingBox();
    const hud = await box("#hud"), spd = await box(".hud .speed"), arr = await box("#hudArr"), turn = await box("#turn");
    expect(spd && arr, "speed and arrival tiles are visible").toBeTruthy();
    expect(Math.abs(spd.y - arr.y), "tiles sit side by side").toBeLessThan(4);
    const fs = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector(".hud .speed")).fontSize));
    expect(fs, "speed is large").toBeGreaterThanOrEqual(44);
    const arrFs = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector("#hudArrT")).fontSize));
    expect(arrFs, "arrival time is large").toBeGreaterThanOrEqual(26);
    expect(hud.y + hud.height, "card fits the screen").toBeLessThanOrEqual(390);
    if (size === "min") expect(hud.height, "map mode card is short, not a full-height column").toBeLessThan(260);
    expect(turn.x + turn.width, "turn card does not run under the board").toBeLessThanOrEqual(hud.x + 1);
    expect(pageErrors, pageErrors.join("\n\n")).toEqual([]);
  });
}

test("portrait ride board shows the arrival line, not the landscape tiles", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await boot(page);
  await page.evaluate(() => { document.body.classList.add("riding", "hud-compact"); document.getElementById("hud").hidden = false; document.getElementById("hudEta").innerHTML = "הגעה <b>18:32</b> · 76 ק״מ · 52 דק׳"; });
  await expect(page.locator("#hudArr")).toBeHidden();
  await expect(page.locator("#hudEta b")).toBeVisible();
});
