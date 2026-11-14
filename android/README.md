# Android app (Google Play)

A Trusted Web Activity: the Play Store app opens https://blueronin.app full screen in Chrome, so every web
release reaches the Android app with no new store upload. Generated with Bubblewrap core (`twa-manifest.json`
is the source; location and notification delegation are on).

- Package `app.blueronin.navigator`, Play Console app id 4973717920188794510.
- CI (`.github/workflows/android.yml`) builds the **unsigned** release bundle and pushes it to the branch `android-builds`.
- The bundle is signed with the **upload key** (`upload-key.jks`, alias `upload`) outside the repo:
  `jarsigner -keystore upload-key.jks app-release-unsigned.aab upload`. Google Play re-signs with the app signing key it holds.
  The upload key and its password are kept by Eli, never in git or in Actions secrets.
- A new store upload is needed only when something here changes (name, icon, colours, delegation, Android target).
  Each upload needs a higher `versionCode` in `app/build.gradle` (and `appVersionCode` in `twa-manifest.json`).
- Full-screen without the browser bar requires `site/.well-known/assetlinks.json` to list the SHA-256 of both
  the Play app signing key and the upload key, live on https://blueronin.app.
