// The weekend push brief follows the rider's chosen built-in chapter (round 2.8, Eli's decision B, option 1).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CHAPTER_IDS, cleanChap, briefText, pickMessage } from "../../netlify/functions/lib/brief-chapter.mjs";
const read = p => readFileSync(new URL(p, import.meta.url), "utf8");

test("chapter ids are validated against the built-in list", () => {
  assert.deepEqual(CHAPTER_IDS, ["c1", "c2", "c3", "c4", "c5", "c6"]);
  for (const id of CHAPTER_IDS) assert.equal(cleanChap(id), id);
  for (const bad of ["", "c99", "draft", "nav", "custom_1", "C1", " c1", "c1 ", "__proto__", "constructor", null, undefined, 1, {}, ["c1"]]) assert.equal(cleanChap(bad), "", String(bad));
});

const ctx = { sunrise: "06:12", depart: "06:27", now: { temperature_2m: 14.4, weather_code: 0 }, wmo: () => ({ t: "בהיר" }) };
const chap = (title, i, extra = {}) => ({ title, ri: { i, verdict: { t: "יום מצוין לרכיבה" }, why: [] }, agg: { tMin: 11.6, tMax: 19.2 }, fog: [], ...extra });

test("brief text: same wording as before, for any chapter", () => {
  assert.deepEqual(briefText(chap("כרמל וגלבוע", 82), "friday", ctx), { title: "תדריך שבת · כרמל וגלבוע 82/100", body: "יום מצוין לרכיבה. 12°–19° בבוקר. בלי גשם, ערפל או רוח חריגה. זריחה 06:12." });
  assert.equal(briefText(chap("כנרת וגולן", 30), "friday", ctx).title, "תדריך שבת · השבת הזאת לא");
  const sat = briefText(chap("גליל עליון", 70, { fog: ["ערפל בצפת סביב 06:00"] }), "saturday", ctx);
  assert.equal(sat.title, "בוקר שבת · גליל עליון 70/100");
  assert.equal(sat.body, "עכשיו 14° ביוקנעם, בהיר. ערפל בצפת סביב 06:00. זריחה 06:12, יציאה מומלצת 06:27.");
});

test("each subscriber gets their chapter's brief, the best one when none or unknown", () => {
  const messages = { best: { title: "best" }, byChap: { c1: { title: "one" }, c5: { title: "five" } } };
  assert.equal(pickMessage(messages, "c1").title, "one");
  assert.equal(pickMessage(messages, "c5").title, "five");
  assert.equal(pickMessage(messages, "").title, "best");
  assert.equal(pickMessage(messages, undefined).title, "best");
  assert.equal(pickMessage(messages, "c3").title, "best"); // no forecast for that chapter this week
  // grouping a list of subscriptions costs no extra compute: one brief, a lookup per rider
  const recs = [{ chap: "c1" }, { chap: "c5" }, {}, { chap: "zz" }, { chap: "c1" }];
  assert.deepEqual(recs.map(r => pickMessage(messages, cleanChap(r.chap)).title), ["one", "five", "best", "best", "one"]);
});

test("the scheduled briefs send per chapter, and the subscription stores the chapter id only", () => {
  for (const f of ["brief-friday.mjs", "brief-saturday.mjs"]) {
    const src = read(`../../netlify/functions/${f}`);
    assert.match(src, /sendAll\(rec => \{ const m = pickMessage\(b\.messages, cleanChap\(rec\.chap\)\)/, f);
    assert.equal((src.match(/computeBrief\(/g) || []).length, 1, `${f} computes the brief once`);
  }
  const push = read("../../netlify/functions/lib/push-core.mjs"); /* the logic moved here (N2) */
  assert.match(push, /prefs: clean, chap: c, ts: Date\.now\(\)/);
  assert.match(push, /rec\.chap = cleanChap\(body\.chap\)/);
  const brief = read("../../netlify/functions/lib/brief.mjs");
  assert.match(brief, /for \(const c of chapters\) byChap\[c\.id\] = briefText\(c, mode, ctx\)/);
  // the client sends nothing but the endpoint and the built-in chapter id
  const app = read("../../site/app.js");
  assert.match(app, /JSON\.stringify\(\{ setChap: true, endpoint: sub\.endpoint, chap: id \}\)/);
  assert.match(app, /return i >= 0 && i < BUILT_IN && !CHAPTERS\[i\]\.custom \? id : ""/);
});
