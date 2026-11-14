// The Play Store app (android/) opens blueronin.app full screen only while assetlinks.json vouches for it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = p => readFileSync(join(ROOT, p), "utf8");
const FP = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/;

test("assetlinks.json names the Android package with the Play signing and upload certificates", () => {
  const links = JSON.parse(read("site/.well-known/assetlinks.json"));
  const app = links.find(l => l.target?.namespace === "android_app");
  assert.ok(app, "android_app statement");
  assert.deepEqual(app.relation, ["delegate_permission/common.handle_all_urls"]);
  const pkg = read("android/app/build.gradle").match(/applicationId "([^"]+)"/)[1];
  assert.equal(app.target.package_name, pkg);
  assert.equal(app.target.sha256_cert_fingerprints.length, 2);
  for (const fp of app.target.sha256_cert_fingerprints) assert.match(fp, FP);
});

test("Android versions agree and no signing key is in the repo", () => {
  const gradle = read("android/app/build.gradle");
  const twa = JSON.parse(read("android/twa-manifest.json"));
  assert.equal(Number(gradle.match(/versionCode (\d+)/)[1]), twa.appVersionCode);
  assert.equal(twa.host, "blueronin.app");
  assert.match(read(".gitignore"), /^\*\.jks$/m);
});
