// Admin console on a phone (Eli runs it from his phone): every view fits the screen, nothing is cut off at the
// edge (wide tables scroll inside their own box), and the buttons are real touch targets. The admin API is
// mocked here with plausible data; the real one only runs on Netlify.
import { test, expect } from "./fixtures.mjs";

const now = Date.now(), H = 36e5;
const checks = ["site", "config", "here", "wx", "osrm", "push", "blobs", "errors"].map((id, i) => ({ id, name: "בדיקה " + id, ok: i !== 3, level: i === 3 ? "high" : "ok", detail: "פירוט ארוך של הבדיקה " + id + " עם מספרים 1234ms ועוד טקסט", ms: 120 + i }));
const PLAYBOOK = Object.fromEntries(checks.map(c => [c.id, [c.name, "high", "מה עושים כשזה נופל: בודקים את הלוג ומרעננים"]]));
const MOCK = {
  session: { authed: true, needsSetup: false, exp: now + 8 * H },
  content: { v: 3, updated: now - H, announce: { on: true, text: "הודעה לרוכבים", level: "info", until: "", link: "" }, maintenance: { on: false, text: "" }, chapters: {}, notes: {}, flags: { fly: true, builder: true, fuelVotes: true, photos: true, feedback: true, move: false }, featured: "", hazards: [{ id: "h1", lat: 32.7, lon: 35.1, text: "חצץ בעיקול", kind: "gravel", until: "" }] },
  stats: { days: Object.fromEntries(Array.from({ length: 30 }, (_, i) => [new Date(now - i * 864e5).toISOString().slice(0, 10), { opens: 40 + i, rides: i % 5, uniq: 20 + i }])), subs: 41, stations: 12, votes: 77, feedbackNew: 3, feedbackAll: 18, lastLogin: now - H, pwChanged: now - 30 * 864e5, fails24: 0 },
  ops: { state: { overall: "caution", lastScan: now - 600000, open: [{ id: "wx", since: now - 2 * H, level: "high", name: "מזג אוויר" }] }, latest: { t: now - 600000, overall: "caution", checks },
    history: Array.from({ length: 48 }, (_, i) => ({ t: now - i * 1800000, overall: i % 7 ? "go" : "caution", c: Object.fromEntries(checks.map((c, j) => [c.id, (i + j) % 9 ? 1 : 0])) })),
    incidents: [{ id: "wx", name: "מזג אוויר", level: "high", start: now - 3 * H, end: now - 2 * H, dur: H }], logs: Array.from({ length: 12 }, (_, i) => ({ t: now - i * 60000, level: i % 4 ? "info" : "warn", src: "scan", msg: "רישום ארוך מאוד של אירוע במערכת עם פרטים טכניים רבים " + i, kind: "scan" })),
    groups: [{ k: "g1", kind: "error", msg: "TypeError: Cannot read properties of undefined (reading 'coords') at a very long place", n: 4, first: now - 5 * H, last: now - H, vers: { "2.7.1": 4 }, devs: { iPhone: 3, Android: 1 }, sample: { src: "https://blueronin.app/app.js", line: 2034, stack: "at x (app.js:1:2)\nat y (app.js:3:4)", crumbs: ["0.1s guard", "1.2s map"], ua: "iPhone", tab: "go" } }],
    errTotal: 4, usage: { here: { day: 120, month: 2100 }, hereCap: 4500, geo: { day: 30, month: 400 }, geoCap: 9000, openmeteo: { day: 900, month: 21000 } }, adminSubs: 1, playbook: PLAYBOOK },
  errors: { items: [{ t: now - H, kind: "error", msg: "ReferenceError: x is not defined", src: "app.js", line: 10, stack: "at a\nat b", ver: "2.7.1", ua: "Mozilla/5.0 (iPhone)", sa: true, boot: false, crumbs: ["a", "b"] }] },
  feedback: { items: [{ id: "a1b2c3d4e5f6", t: now - H, kind: "bug", text: "המפה לא נטענת אחרי שחוזרים מהרקע, וגם הכפתור של הניווט נשאר תקוע. מצרף תמונות.", status: "new", chap: "carmel", ver: "2.7.1", ua: "iPhone", lat: 32.7, lon: 35.1, media: ["p", "p1", "p2", "a"] }, { id: "b1b2c3d4e5f6", t: now - 2 * H, kind: "idea", text: "רעיון", status: "done", ver: "2.7.0", ua: "Android" }] },
  fuel: { rows: Array.from({ length: 6 }, (_, i) => ({ id: "n10000000" + i, riders: 3 + i, open: 2, closed: 1, y98: 1, n98: 2, last: now - i * H })) },
  pro: { trials: 7, interest: { monthly: 4, yearly: 9 }, codes: Array.from({ length: 4 }, (_, i) => ({ code: "BRN-ABCD-EF" + i, days: 30, max: 10, used: i, label: "קבוצת רוכבי הגליל הארוכה " + i, created: now - i * 864e5, revoked: i === 3 })) },
  join: { need: 3, go: { ig: 12, yt: 3, wa: 40 }, items: Array.from({ length: 5 }, (_, i) => ({ k: "a".repeat(23) + i, t: now - i * H, email: `rider.number.${i}@example-long-domain.co.il`, name: "רוכב " + i, code: "C" + i, ref: i ? "C0" : "", src: "wa", refs: i ? 0 : 4 })) },
  audit: { items: Array.from({ length: 8 }, (_, i) => ({ t: now - i * H, a: i % 3 ? "login" : "content", ip: "abcdef0123456789", d: { v: i, what: "שינוי בהודעה" } })) },
  history: { items: [{ id: "x1", t: now - H, kind: "announce", level: "info", text: "הודעה ששודרה לכולם", link: "" }] },
};
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

async function openAdmin(page, view) {
  await page.route(/\/api\/admin\//, r => {
    const p = new URL(r.request().url()).pathname.replace(/^\/api\/admin\//, "");
    if (p === "feedback/media") return r.fulfill({ status: 200, contentType: "image/png", body: PNG });
    const body = MOCK[p] ?? { ok: true };
    return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
  await page.route(/\/api\/(content|vapid)/, r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK.content) }));
  await page.goto("/admin.html#" + view);
  await expect(page.locator("#app")).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(900);
}
// every visible element stays inside the screen, unless it lives in a box that scrolls sideways
const cutOff = page => page.evaluate(() => {
  const W = innerWidth, out = [];
  const scrolls = el => { for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { const ox = getComputedStyle(p).overflowX; if (ox === "auto" || ox === "scroll") return true; } return false; };
  for (const el of document.querySelectorAll("#app *, header.top *")) {
    if (!el.offsetParent && getComputedStyle(el).position !== "fixed") continue;
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
    if ((r.right > W + 1 || r.left < -1) && !scrolls(el)) out.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 30)} [${Math.round(r.left)}..${Math.round(r.right)}] "${(el.textContent || "").trim().slice(0, 30)}"`);
  }
  return out.slice(0, 8);
});
const smallTargets = page => page.evaluate(() => [...document.querySelectorAll("#app button, #app .btn, #app a.btn, header.top .btn, #nav button")]
  .filter(b => b.offsetParent).map(b => { const r = b.getBoundingClientRect(); return { h: r.height, w: r.width, t: (b.textContent || b.getAttribute("aria-label") || "").trim().slice(0, 24) }; })
  .filter(x => x.h < 43.5 || x.w < 43.5).slice(0, 8));

const VIEWS = ["overview", "monitor", "notice", "chapters", "hazards", "inbox", "fuel", "pro", "join", "system"];
test.describe("admin on a phone", () => {
  test.beforeEach(({}, ti) => test.skip(ti.project.name !== "phone", "phone sizes only"));
  for (const width of [360, 430]) {
    test(`every view fits ${width}px`, async ({ page, pageErrors }) => {
      test.setTimeout(120_000);
      await page.setViewportSize({ width, height: 800 });
      await openAdmin(page, "overview");
      const ids = await page.locator("#nav button").evaluateAll(bs => bs.map(b => b.dataset.v || b.getAttribute("data-view") || ""));
      for (const v of VIEWS.filter(v => ids.includes(v) || !ids.length)) {
        await page.evaluate(v => { location.hash = v; }, v);
        const btn = page.locator(`#nav button[data-v="${v}"]`);
        if (await btn.count()) await btn.click();
        await page.waitForTimeout(500);
        expect(await cutOff(page), `${v}: something is cut off at the screen edge`).toEqual([]);
        expect(await smallTargets(page), `${v}: buttons smaller than 44px`).toEqual([]);
        const wide = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
        expect(wide, `${v}: horizontal page scroll`).toBeLessThanOrEqual(1);
      }
      expect(pageErrors, pageErrors.join("\n\n")).toEqual([]);
    });
  }
  test("bottom nav: every section reachable, current one visible", async ({ page, pageErrors }) => {
    await page.setViewportSize({ width: 360, height: 760 });
    await openAdmin(page, "system");
    const nav = await page.locator("#nav").boundingBox();
    expect(nav.y + nav.height).toBeGreaterThanOrEqual(759);
    const cur = page.locator('#nav button[aria-current="page"]');
    await expect(cur).toBeVisible();
    const r = await cur.boundingBox();
    expect(r.x).toBeGreaterThanOrEqual(-1); expect(r.x + r.width).toBeLessThanOrEqual(361);
    expect(pageErrors, pageErrors.join("\n\n")).toEqual([]);
  });
});
