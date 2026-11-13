// The app fills the phone screen edge to edge on every size, the ride sheet reaches the bottom in every size
// (peek / half / full) and its content scrolls fully into view, and nothing overflows sideways.
// The last test fakes the iOS 26 home-screen bug (innerHeight reports ~45px less than the real window) and checks
// that guard.js "Viewport fit" still stretches the app to the real bottom. There is no WebKit here, so the
// real iPhone check is Eli's field test.
import { test, expect, boot } from "./fixtures.mjs";

const SIZES = [
  { name: "small Android", width: 360, height: 640 },
  { name: "iPhone SE", width: 375, height: 667 },
  { name: "iPhone 15", width: 393, height: 852 },
  { name: "iPhone Pro Max", width: 430, height: 932 },
  { name: "landscape", width: 844, height: 390 },
];
const TABS = ["go", "brief", "route", "stops", "me", "tools"];

test.describe("phone viewport", () => {
  test.beforeEach(({}, ti) => test.skip(ti.project.name !== "phone", "phone sizes only"));

  for (const sz of SIZES) {
    test(`fills the screen: ${sz.name} ${sz.width}x${sz.height}`, async ({ page, pageErrors }) => {
      await page.setViewportSize({ width: sz.width, height: sz.height });
      await boot(page);
      const H = sz.height;
      const bottoms = await page.evaluate(() => ({
        body: document.body.getBoundingClientRect().bottom,
        map: document.getElementById("map").getBoundingClientRect().bottom,
        intro: (() => { const i = document.getElementById("intro"); return i ? i.getBoundingClientRect().bottom : -1; })(),
      }));
      expect(bottoms.body, "app root reaches the bottom").toBeGreaterThanOrEqual(H - 1);
      expect(bottoms.map, "map reaches the bottom").toBeGreaterThanOrEqual(H - 1);
      if (bottoms.intro >= 0) expect(bottoms.intro, "intro layer reaches the bottom").toBeGreaterThanOrEqual(H - 1);

      for (const size of ["peek", "half", "full"]) {
        await page.locator(`.sz[data-size="${size}"]`).click();
        await page.waitForTimeout(400);
        const r = await page.locator("#sheet").boundingBox();
        expect(r.y + r.height, `sheet (${size}) reaches the bottom`).toBeGreaterThanOrEqual(H - 1);
        expect(r.y, `sheet (${size}) top is on screen`).toBeGreaterThanOrEqual(0);
      }

      await page.locator('.sz[data-size="half"]').click();
      await page.waitForTimeout(350);
      for (const t of TABS) {
        await page.locator(`.tab[data-t="${t}"]`).click();
        await page.waitForTimeout(250);
        const res = await page.evaluate(() => {
          const panes = document.getElementById("panes"); panes.scrollTop = panes.scrollHeight;
          const pane = [...panes.children].find(p => p.offsetParent);
          const kids = pane ? [...pane.children].filter(k => k.offsetParent && k.getBoundingClientRect().height > 0) : [];
          const last = kids[kids.length - 1];
          const pr = panes.getBoundingClientRect();
          return {
            lastBottom: last ? last.getBoundingClientRect().bottom : 0, panesBottom: pr.bottom,
            sideways: panes.scrollWidth - panes.clientWidth,
            wide: [...pane.querySelectorAll("*")].filter(e => { const b = e.getBoundingClientRect(); return b.width > 0 && e.offsetParent && (b.right > innerWidth + 1 || b.left < -1) && !e.closest(".hours,.wins,.chips,.hscroll,[data-hscroll]") && getComputedStyle(e.parentElement).overflowX === "visible"; }).slice(0, 3).map(e => e.tagName + "." + e.className),
          };
        });
        expect(res.lastBottom, `tab ${t}: last item scrolls into view`).toBeLessThanOrEqual(res.panesBottom + 1);
        expect(res.sideways, `tab ${t}: no sideways scroll in the sheet`).toBeLessThanOrEqual(1);
        expect(res.wide, `tab ${t}: nothing sticks out of the screen`).toEqual([]);
      }
      const docWide = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      expect(docWide, "no horizontal page scroll").toBeLessThanOrEqual(1);
      expect(pageErrors, pageErrors.join("\n\n")).toEqual([]);
    });
  }

  test("iOS home-screen short viewport: the app still reaches the real bottom", async ({ page, pageErrors }) => {
    const W = 393, H = 852, SHORT = 45;
    await page.setViewportSize({ width: W, height: H });
    await page.addInitScript(([short]) => {
      const mm = window.matchMedia.bind(window);
      window.matchMedia = q => /display-mode:\s*standalone/.test(q) ? { matches: true, media: q, addEventListener() { }, removeEventListener() { }, addListener() { }, removeListener() { } } : mm(q);
      const real = Object.getOwnPropertyDescriptor(window, "innerHeight") || { get() { return document.documentElement.clientHeight; } };
      Object.defineProperty(window, "innerHeight", { configurable: true, get() { return (real.get ? real.get.call(window) : real.value) - short; } });
    }, [SHORT]);
    await boot(page);
    const r = await page.evaluate(() => ({ body: document.body.getBoundingClientRect().bottom, ih: innerHeight, vp: window.BRG && window.BRG.vp }));
    expect(r.ih, "the fake really reports a short window").toBe(H - SHORT);
    expect(r.body, "app root reaches the real bottom").toBeGreaterThanOrEqual(H - 1);
    const s = await page.locator("#sheet").boundingBox();
    expect(s.y + s.height, "sheet reaches the real bottom").toBeGreaterThanOrEqual(H - 1);
    expect(pageErrors, pageErrors.join("\n\n")).toEqual([]);
  });
});
