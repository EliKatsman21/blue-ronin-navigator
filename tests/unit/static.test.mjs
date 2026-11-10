// Static checks that need no browser and no network. Run: node --test tests/unit/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SITE = join(ROOT, "site");
const FN = join(ROOT, "netlify", "functions");
const read = p => readFileSync(p, "utf8");
const require = createRequire(import.meta.url);

test("version is the same in app.js, guard.js and the top CHANGELOG entry", () => {
  const app = read(join(SITE, "app.js"));
  const appVer = app.match(/const APP_VER = "([\d.]+)"/)?.[1];
  const guardVer = read(join(SITE, "guard.js")).match(/const VER = "([\d.]+)"/)?.[1];
  const logVer = app.match(/const CHANGELOG = \[\s*\{ v: "([\d.]+)"/)?.[1];
  assert.ok(appVer, "APP_VER not found in app.js");
  assert.equal(guardVer, appVer, "guard.js VER must match APP_VER");
  assert.equal(logVer, appVer, "first CHANGELOG entry must be the current APP_VER");
});

test("service worker shell version looks right and every shell file exists", () => {
  const sw = read(join(SITE, "sw.js"));
  assert.match(sw, /const SHELL = "brn-shell-v\d+"/);
  const files = JSON.parse(sw.match(/const SHELL_FILES = (\[[^\]]+\])/)[1]);
  for (const f of files) if (f !== "./") assert.ok(existsSync(join(SITE, f)), `sw.js precaches missing file: ${f}`);
});

test("every browser script parses", () => {
  for (const f of readdirSync(SITE).filter(f => f.endsWith(".js")))
    execFileSync(process.execPath, ["--check", join(SITE, f)]);
});

test("every Netlify function parses", () => {
  const walk = d => readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(join(d, e.name)) : e.name.endsWith(".mjs") ? [join(d, e.name)] : []);
  for (const f of walk(FN)) execFileSync(process.execPath, ["--check", f]);
});

test("chapters: unique ids, at least 2 stops, every stop inside Israel", () => {
  const { CHAPTERS } = require(join(SITE, "data.js")).BRD;
  const poly = JSON.parse(read(join(FN, "lib", "osm.mjs")).match(/const IL_POLY = (\[\[.*?\]\]);/)[1]);
  const inIL = (lat, lon) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > lat) !== (yj > lat) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) c = !c; } return c; };
  const ids = new Set();
  for (const ch of CHAPTERS) {
    assert.ok(!ids.has(ch.id), `duplicate chapter id ${ch.id}`); ids.add(ch.id);
    if (ch.combo) continue;
    assert.ok(ch.stops?.length >= 2, `${ch.id} has fewer than 2 stops`);
    for (const s of ch.stops) assert.ok(inIL(s.lat, s.lon), `${ch.id}/${s.id} (${s.lat},${s.lon}) is outside the Israel outline`);
  }
});

test("no API keys or secrets committed", () => {
  const walk = d => readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(join(d, e.name)) : /\.(m?js|html|toml|json)$/.test(e.name) ? [join(d, e.name)] : []);
  const bad = [/apiKey=[A-Za-z0-9_-]{20,}/, /HERE_API_KEY\s*[:=]\s*["'][A-Za-z0-9_-]{20,}/, /-----BEGIN [A-Z ]*PRIVATE KEY-----/, /\bAKIA[0-9A-Z]{16}\b/];
  for (const f of [...walk(SITE), ...walk(FN), join(ROOT, "netlify.toml")])
    for (const re of bad) assert.ok(!re.test(read(f)), `possible secret in ${f} (${re})`);
});

test("netlify.toml keeps the old-host redirects and never builds non-production deploys", () => {
  const t = read(join(ROOT, "netlify.toml"));
  assert.match(t, /blueronin-north-map\.netlify\.app\/\*"\s*\n\s*to = "https:\/\/blueronin\.app\/:splat"/);
  assert.match(t, /ignore = .*CONTEXT.*production/);
});
