# Blue Ronin Navigator: project status

Source of truth for the project's state. Rules for working on the code are in `/CLAUDE.md`; the human workflow is in
`docs/WORKFLOW.md`. A copy of this file lives in the claude.ai Project as `claude/blue-ronin-navigator.md` and is
refreshed at the end of every round.

Two-wheeler navigator PWA for all of Israel (brand "BLUE RONIN · ישראל" since 2.5.0): everyday navigation anywhere, plus curated weekend chapters in the north, the Jerusalem hills and the Jordan Valley. Live at https://blueronin.app. The old address https://blueronin-north-map.netlify.app 301-redirects there (since v2.4.0). App version 2.8.0 (deployed 2026-11-13), SW shell v20.

## How it ships
- Code: GitHub `EliKatsman21/blue-ronin-navigator` (public). Netlify site `blueronin-north-map` (id 4bff772c-…) builds production from `main` only; `netlify.toml` `ignore` skips every non-production build (since 2026-11-10).
- Branches: day-to-day work on `dev`; `main` = what is live. Merge `dev` → `main` only for a release Eli approved.
- Netlify Personal plan: 1,000 credits/month, ~15 per production deploy. Eli wants changes batched and one deploy per round; he decides when a round is big enough. Urgent fixes may go out alone.
- Commits: author Eli Katsman, committer Claude <noreply@anthropic.com>.
- Release checklist: in `CLAUDE.md` (`scripts/bump-version.sh`, CHANGELOG entry, `scripts/check.sh`, merge, verify live, refresh this file and the Project doc).
- Backlog: GitHub Issues with labels (see `docs/WORKFLOW.md`). Content and video work shares the same backlog (`video` label, `media/`).
- Tests (in the repo since 2026-11-10): `tests/unit` (node:test: versions, parsing, sw shell, chapter stops inside Israel, no secrets, netlify guards) and `tests/e2e` (Playwright Chromium, phone + desktop: offline boot, all six tabs render, no uncaught errors, boot guard). GitHub Actions runs them on every push to `dev` and on PRs. The older scenario suites (transfer, camera, voice, group, replay, weather outage, ride HUD sizes, single popup, ride plan, traffic, load tests, HERE traffic unit test) lived in a session scratchpad and were lost; rebuild them in `tests/` as those areas are touched. No WebKit in the sandbox, so iPhone-only issues show up in the field error reporter and the monitor.

## Structure
- `site/`: `index.html`, `guard.js` (loads first), `intro.js`, `app.js`, `logic.js`, `data.js`, `bikes.js`, `geo.js`, `sw.js`, `sw-retire.js` (served as /sw.js on the old host only), `admin.html` + `admin.js`, `live.html` + `live.js`, `privacy.html`, `terms.html`.
- `netlify/functions/`: `osm*`, `fuel`, `brief*`, `vapid`, `subscribe`, `test-push`, `config`, `traffic` (HERE), `traffic-tile` (retired, 410), `wx` (weather proxy), `health-scan` (every 30 min), `photos`, `admin`, `content`, `feedback`, `ping`, `pro`, `live`, `sos`, `group`, `xfer`, `errlog`, `geo`. Shared: `lib/admin.mjs`, `lib/push.mjs`, `lib/pro.mjs`, `lib/safety.mjs`, `lib/ops.mjs` (ops log + usage counters, store `brn-ops`), `lib/health.mjs` (scanner + playbook + admin alerts), `lib/osm.mjs`, `lib/brief.mjs`.
- `tests/`, `scripts/`, `docs/`, `media/`, `.github/`: see `CLAUDE.md`.
- Tabs: ניווט · סופ״ש (the former תדריך שבת) · מסלול · עצירות ודלק · שלי · כלים. Opening tab: a #hash wins; else סופ״ש on Fri/Sat and ניווט Sun–Thu.

## Release 2.8.0 (2026-11-13, issue #13)
- Screen fit on iPhone (iOS 26 home-screen viewport bug): `guard.js` sets `--app-h` / `--sab`; every tab scrolls to its last button. Proven only in the field.
- Replay lifecycle fixed (one bike, coloured route, ride after ride). One route everywhere: `setCurrentRoute()` + `br:route` event syncs navigate, weekend brief, journal and share.
- Feedback with up to 4 photos (`lib/fbmedia.mjs`, EXIF stripped on the phone); feedback queue blobs `q:`, rate markers `rl:`, budget `mb:`.
- Pro: all-time top speed + total riding time tile in the journal (`vmaxRec`). Open question m4: the record outlives a deleted journal.
- Accessibility legal baseline (IS 5568 / WCAG AA P0 items, axe spec) + honest statement `accessibility.html` ("partial, in progress"). Contact = in-app feedback form only until hello@blueronin.app receives mail (then restore the mailto line and its unit test). Phase 2 in 2.8.1.
- Push brief per chapter (`lib/brief-chapter.mjs`); send moved to `brief-send-background` + `lib/brief-job.mjs` (job id, 8 s check, inline takeover, monitor check "brief"). Push hardening `lib/push-core.mjs` (host allow-list, 5 s timeout, keep on transient failure, remove only on 410/404, subscribe throttle, 20,000 cap). SOS `lib/sos-core.mjs`: guardians kept on transient failure, rider told clearly when an alert reached nobody.
- MapLibre 4.7.1 + SunCalc 1.9.0 self-hosted in `site/vendor/` (SHA-256 pinned, cache-first, immutable header). Server errors shown in Hebrew only (`BRL.heText`).
- Privacy text: push row (chapter id) and media row (up to 4 photos, EXIF removed) approved by Eli 2026-11-13.
- Gates: QA final GO with conditions, security final GO, performance OK (reports in the company folder `work/`). Deferred to 2.8.1: m10 SOS join race, m11 possible double brief at the 8 s check, m12 renderPush page error, m8 residue, D1-D3 brief atomicity, CSP vendoring, MapLibre upgrade.
- Released on a Friday at Eli's explicit decision; watch the Saturday-morning brief in the ops log.

## Release 2.7.1 (2026-11-12)
- Security only: `lib/edge.mjs` (Cloudflare edge handshake, Cloudflare-aware client IP, optional origin lock), every `/api` function gated. Env `EDGE_SECRET` set (Production). See "Cloudflare edge".

## Release 2.7.0 (2026-11-11)
From Eli's first real ride with everyday navigation, plus the launch pages.
- Reroute loop fixed. Root cause: `nearestOn` measured the distance to the nearest route *vertex*. OSRM leaves vertices hundreds of metres apart on straight roads, so a rider exactly on the road read as 250 m+ "off route", rerouted, and did it again every few fixes ("מחשב מסלול מחדש" over and over). Now `L.nearestOnLine` projects onto the segments (km along the route is interpolated too), and `L.offRoute` decides with hysteresis: threshold from the fix's accuracy (65 m at 20 m accuracy, 50–200 m), 3 off fixes spanning ≥ 6 s, 25 s cooldown after a reroute, never while standing. The voice says it at most once per 2 minutes; a failed reroute waits for the cooldown and shows one note instead of retrying every fix. Unit tests in `tests/unit/ride.test.mjs`.
- Ride guide line: source `br-guide` (lineMetrics) with layers `br-guide-casing` + `br-guide`: a thick blue line (white casing on the dark map, navy on light) for the route ahead, the ridden part faded through `line-gradient` updated per fix. While riding, the chapter line, curve colours and glare step aside (`GUIDE_HIDE`), restored with the rider's layer choices after. The line follows reroutes (it used to keep showing the old route).
- Ride board: speed uses the body face (the display face drew 0 as a slotted bar). New `#hudArr` tile (arrival time, km and minutes left). Landscape phone: speed and arrival tiles side by side, card as tall as its content (`bottom:auto`), "מפה" = tiles + destination + full-width SOS, turn card never runs under the board, map padding measured from the real card. Portrait: arrival line `הגעה 18:32 · 76 ק״מ · 52 דק׳` in larger type. Orientation: `screen.orientation` change too, `map.resize()`, the map credits fold into (i) on ride start and rotation. E2E `tests/e2e/ridehud.spec.mjs` checks the landscape layout in all three sizes.
- Search: `L.normQuery` (one quote style, ת"א/פ"ת/ב"ש/ר"ג/ראשל"צ/י-ם spelled out, "רחוב/רח'" dropped). `/api/geo` calls HERE geocode next to autosuggest when the text has a number (exact house numbers first, 2 calls count against `HERE_GEO_CAP`). Client: Photon results keep the house number, OSM hits are dropped only when they are the same place (40 m, or same name within 150 m), Nominatim is asked when an address query still has < 2 results. The home/work example no longer shows a real address.
- Released here: `/join`, `/go`, the "נשארים בקשר" card, now with TikTok and Facebook (see the section below).

## Release 2.6.0 (2026-11-10)
- Address search: `/api/geo` (HERE Geocoding & Search autosuggest, `in=countryCode:ISR`, Hebrew) finds house numbers, commercial centres and businesses; runs in parallel with Photon/Nominatim, HERE first, OSM duplicates within 150 m dropped. Queries are not logged or stored. Budget `HERE_GEO_CAP` (default 9,000/month, counter `heregeo`), health check "geo", admin usage meter.
- ETA: traffic matching is direction-aware (segment bearing within 60° of the route, 80 m), factor is coverage-weighted and capped at 1.8×. Root cause of the 2:36-vs-0:39 report: samples from the opposite carriageway and parallel roads.
- Help on the road ("עזרה בדרך", go tab and SOS sheet): insurance tow number saved per device, 6 nearest motorcycle garages (call / navigate / Waze), Google tow search link. OSM layer `br-moto` (shop=motorcycle, motorcycle_repair, service:vehicle:motorcycle, motorcycle:repair), toggle "מוסכי אופנועים".
- Home/work: ✎ next to each quick button opens change / set to current location / remove; unset buttons enter "set" mode.
- Ride mode: interpolated bike marker (same icon as the fly-through), camera eases with the time between fixes; landscape layout (HUD side panel, fab row, header hidden) and re-centre on rotation. Summary shows max speed (needs two sustained readings).
- Weekend brief: departure from the rider's location (else home, else the chapter start); calendar reminder = the coming Friday 20:00.
- Decluttered map: fuel 9.3, view/cafe 9.6, cameras 9 minzoom. Home button frames all of Israel with fixed bounds. "במפה" on a saved ride hides all layers and chapters (chip ✕ to exit).
- Pro paywall plans are exclusive, tap again cancels (`proPlan` in LS; server counts `prev` / `plan:"none"`). Feedback draft persists (`fbDraft`).
- Fixed a long-standing race: a sheet opened right after another closed was wiped by the old close timer.
- OSM layers are filtered by a coarse outline of Israel (`IL_POLY`/`inIL` in lib/osm.mjs, at refresh and on read): the query boxes had put ~186 cafes, ~99 fuel stations and garages from Lebanon/Jordan on the map. All 66 chapter stops are inside (now enforced by a unit test); re-check when adding chapters near a border.
- Deferred by Eli's choice: mute + music player in ride mode (possible Pro later).

## Everyday navigation (2.5.0)
Tab "ניווט": search (local stops/cafes/OSM + Photon, biased to the rider's position, all Israel; voice), home/work/recents in LS (`navPlaces`, `navRecent`), quick buttons (home, work, nearest fuel, back to the bike). Choosing a place builds a hidden custom chapter `id: "nav"` (`nav: true, hidden: true`) from the rider's position to the destination; OSRM route (not cached in LS, nor its steps), HERE traffic for the trip with an ETA factor, weather at arrival from `/api/wx` (point rounded to 0.1°), avoid-highways toggle, share, save as route, save as home/work. "יוצאים לדרך" starts ride mode on the trip (voice says "ניווט אל…", HUD label "יעד", arrival "הגעתם ליעד"). The trip is excluded from forecast points, chapter lists and the saved `chap`. Follow-ups: stronger route line and fewer POI markers during a trip, alternatives, rain-on-the-way alert.

## Shared links (2.5.0)
`?r=` links save the route to `myRoutes` with `shared: {t}` and open it in the route tab (tag "משיתוף", chip "⇄"), dedupe by stops, invalid points dropped (must be inside Israel bounds). At the free limit (2 routes) the link opens as an unsaved builder preview.

## Chapter 6 (2.5.0)
Removed the out-and-back to Almog (north Dead Sea): the loop is Beit She'an → Route 90 → Petza'el → 505 climb → Allon road → Mehola → Beit She'an, ~70 km shorter, so fuel covers it. The 90-pin via point moved to the Petza'el stop. Built-in chapters carry `rv` (route version) in the route/elevation cache keys; bump it whenever a chapter's stops change.

## Weather (fixed in 2.3.1 after an outage)
Incident 2026-11-06: Open-Meteo answered 429 (daily limit); the error object was cached as the forecast and the brief/route tabs went blank. Fix: every reply is validated; the last good forecast is kept; bad caches are dropped at boot; `/api/wx` is a shared server cache (Blobs + CDN, 20 min fresh, up to 3 days stale) tried first, direct Open-Meteo as fallback; the rider's "now" point is rounded to ~10 km; 3-minute back-off after a failed round. Every tab has an error boundary (retry card + field report) so no tab can render empty.

## Live traffic (v2.4.0, live since 2026-11-07)
TomTom has no traffic data for Israel, so it was replaced by HERE Traffic API v7 (Israel: flow + incidents). `/api/traffic?pts=…` makes one flow + one incidents call per area (bbox snapped to 0.02°, ≤1° per side), cached 5 min (Blobs + CDN), stale up to 1 h. Returns per-point speed ratio (the route-tab strip), slow/closed segments (map lines, jam ≥3) and incidents flagged when on the route. Monthly budget guard `HERE_MONTHLY_CAP` (default 4,500 calls). `HERE_API_KEY` set in Netlify on 2026-11-07 (plain env var: secret vars returned 403 on this plan; server-side only, never in the repo; do not enable HERE "trusted domains", server calls carry no referrer). Without it the app shows the Waze fallback. `TOMTOM_KEY` env var is unused and can be deleted.

## Monitoring (admin "בקרה", v2.4.0)
Scheduled scan every 30 min, plus "סריקה עכשיו". Checks: site, app.js version, Blobs round-trip, /api/content, /api/wx, OSM age and count (auto re-queues refresh if older than 30 h), OpenFreeMap style, MapLibre/SunCalc CDN, OSRM, HERE monthly usage, boot failures, field errors (grouped by fingerprint, new kinds logged), server ops log, push subscribers. An incident opens after two failing scans (one if critical) and pushes to admin devices ("התראות לטלפון שלי"); recovery pushes too. History of closed incidents, 48-scan uptime bars, top field issues (7 days, by version and device), server log with filters, "דוח מצב להעתקה" (markdown report to paste to Claude or into an issue labelled `from-monitor`). Housekeeping prunes scans (~5 days), logs (14 days), usage counters and field reports (300).

## Transfer and backup
`/api/xfer`: phone encrypts its data (AES-GCM, key = SHA-256 of 10 code chars that never leave the phones), server holds ciphertext 24 h / 6 reads. Backup file + restore. Transfer and backup stay in "שלי".

## Admin console (`/admin.html`, not linked from the app)
scrypt + TOTP, HMAC cookie, lockout, audit. Views: overview, בקרה (monitoring), announcement, chapters, hazards, inbox with media, fuel votes, Pro, system (flags, field errors, password, logout-all).

## Safety (free)
Emergency circle, SOS sheet (HUD long-press), fall detection (beta), live location, parked bike + walk-back. SOS sends are written to the ops log (count only, no personal data); an SOS that reached nobody is logged as critical.

## Group rides
`/api/group/*`: leader with Pro opens, members join free with a code, max 20, 12 h, one record per member, meeting point, group SOS.

## Memories and replay
Photos/voice in IndexedDB `brn-mem` (24 free, unlimited Pro). 3D replay of recorded rides (real clock, sky of that hour, photo pauses, share card). Free replay stops at 30%. "הדגמה: שחזור 3D" in the journal (tab "שלי") plays a generated ride on the current chapter (bend-aware speeds), never saved. Good source of clean footage for videos (`media/`).

## Pro
Safety never paywalled. Pro: ride plan ("תוכנית הרכיבה": departure slider, ETA + weather + riding wind-chill per stop, sun glare to the minute, technical/climb stretches per leg, break suggestion, what to wear, tap to map), full fuel plan, full fly-through and replay, unlimited routes and memories, full journal + GPX, opening group rides. Planned for Pro once HERE is proven: traffic alerts on the chosen route before leaving. 7-day trial or admin codes; ₪99/yr founders, ₪14.90/mo once Play Billing opens.

## Ride mode
Voice unlocked inside the tap; arrival call-outs, ETA, curve warnings, sunset reminder, free pan, wake lock. HUD sizes: מלא / מצומצם (default) / מפה (one line + SOS), remembered per device; labelled buttons (צילום, חניתי, שיתוף, SOS "לחיצה ארוכה"); map buttons sit above the HUD (row layout on short screens); desktop HUD is a side card. Map: one popup at a time.

## Keys / headers
`HERE_API_KEY`, `HERE_MONTHLY_CAP` (optional), `HERE_GEO_CAP` (optional), `MAPILLARY_TOKEN`, `ADMIN_SETUP_CODE`. CSP (self, unpkg, cdnjs); admin CSP allows `worker-src 'self'` for admin push.

## Chapters and routing
1 Carmel–Gilboa · 2 Kinneret–Golan · 3 Upper Galilee · 4 northern ring · 5 Nes Harim & Beit Guvrin · 6 Jordan Valley. Cache keys `route:v4`, `elev:v4`, `steps:v2`.

## Business and launch
- Plan doc: https://claude.ai/artifact/VRcrkLdMD3SnckamEmpbMd · HQ board: https://claude.ai/artifact/8fSTGLQZPBrYZ4o2b7tNp7
- Google Play (issue #14): personal account, identity and device verified (device check done 2026-11-14 on a friend's Android phone). App created 2026-11-14: Play app id 4973717920188794510, package `app.blueronin.navigator`, store name "Blue Ronin · ניווט לרוכבים" (no "נביגטור"), Hebrew default, free, Play App Signing on.
  - `android/`: Trusted Web Activity generated with Bubblewrap core (PWABuilder's scanner timed out on the site), minSdk 24, target 36, location + notification delegation. `android/README.md` has the flow.
  - CI `android.yml` builds the unsigned bundle on pushes to `dev` touching `android/`, and pushes it with the build log to branch `android-builds` (public run logs need a sign-in). Signing is done off CI with the upload key (alias `upload`, SHA-256 `61:B2:E6:…:BB:E6`), which Eli keeps; it is not in git or Actions secrets. The signed v1 is on branch `android-release`.
  - Play app-signing certificate SHA-256 `E2:A1:E4:…:E9:C5`. Both are in `site/.well-known/assetlinks.json` (on `dev`; live only after the next production release, until then the Android app shows a browser bar).
  - versionCode 1 (2.8.0) uploaded to internal testing as a draft. Web releases reach the Android app with no new upload; a new upload (higher versionCode) only when `android/` changes.
  - App content (2026-11-14): all declarations done, nothing pending — privacy policy URL, no ads, no advertising ID, not government, no financial or health features, app access (no login; Pro via the free 7-day trial, steps given to reviewers), target audience 18+, content rating IARC 3+ ("users interact", "shares location"), trader status = yes (EU; Eli, 2026-11-14), Data safety: collected, none shared, encrypted in transit, no accounts — name/email/phone, approximate+precise location, photos, voice recordings, other user content (optional, app functionality; email = developer communications), crash logs + diagnostics (required, analytics), device ID (required, app functionality + fraud prevention). Two optional URLs were left empty because Google checks them live and the domain is down: data deletion `https://blueronin.app/privacy.html#delete` (Data safety, step 2) and terms `https://blueronin.app/terms.html` (trader status). Add both once the domain is back and `#delete` is released.
  - Next: store listing (texts, 512 icon, 1024×500 feature graphic, phone screenshots), then closed test 12 testers × 14 days.

## Marketing and launch (plan written 2026-11-11)
- Plan doc (Hebrew, editable): https://claude.ai/artifact/6V7PFQk33MePZ75pyptWf1 . HQ items g00–g33 (area "שיווק"). Pre-registration on Play stays locked until the closed test passes, so the waitlist lives on blueronin.app.
- Channels (handle `blueroninapp` everywhere; blueronin.app was taken on one platform): YouTube @blueroninapp and Instagram blueroninapp (the existing channels, renamed 2026-11-11; Instagram is a business account), WhatsApp channel "Blue Ronin · תדריך סופ״ש" https://whatsapp.com/channel/0029VbDmkfmBVJl8sVPC2f0m (opened 2026-11-11). TikTok https://www.tiktok.com/@blueroninapp (personal account: switching to business asks for company registration documents, so it waits for the עוסק, HQ m03) and Facebook Page https://www.facebook.com/blueroninapp/ (opened 2026-11-11, linked to Instagram in Meta Business Suite, website set). New logo, banners and bios on all channels; YouTube channel keywords set.
- Slogan: "כל הארץ. שני גלגלים. דרך אחת." Brand line: "הרונין לא ממהר. הוא חוזר הביתה."
- Logo on every channel = the app icon (sun + road), drawn by `media/brand/build.py`. The old rider/R9 logo is retired.
- Eli stays anonymous for now; he will appear as the founder once the product is stable (his call, 2026-11-11).
- Old riding videos that show fast or risky riding go Private, not deleted. Footage policy checklist in the plan doc.
- Engines: weekly brief on WhatsApp (Thu 18:00), 3D chapter fly-throughs as Reels/TikTok/Shorts, "12 הרונינים" closed-test campaign (recruit 20), waitlist with referrals, 6-chapter countdown from 2027-02-01, launch ride on chapter 1 on Sat 2027-03-13, store launch about 2027-03-15.
- Bio links: Instagram `blueronin.app/go?src=ig`, YouTube `?src=yt`, WhatsApp `?src=wa`, TikTok `?src=tt`, Facebook `?src=fb` (live from 2.7.0).

## Waitlist and link hub (released in 2.7.0, issue #12)
- `/join` (`site/join.html` + `join.js`): launch waitlist. Email, optional name, consent checkbox, honeypot. After signup the rider gets a personal link `blueronin.app/join?r=CODE`; 3 friends who join through it = one month of Pro at launch (granted by hand with admin Pro codes). The code is remembered on the device (`brn:join` in LS) so a return visit shows progress.
- `/go` (`site/go.html` + `go.js`): one link for every social bio (waitlist, app, WhatsApp channel, Instagram, YouTube). `?src=ig|yt|wa|tt|fb|qr|press` counts a visit per channel (ops counter `go:<src>`, a number only) and carries the source into `/join`.
- `/api/join` (`netlify/functions/join.mjs`, rules in `lib/join-core.mjs`, storage in `lib/join.mjs`, store `brn-join`): one blob per signup, throttled 5/hour per hashed IP. Admin: view "המתנה" (totals, per-channel visits and signups, list, CSV, copy emails, delete one) via `GET join` / `POST join/delete`.
- Privacy policy: two new rows (waitlist email, link-hub counter) and how to be removed. Needs the lawyer's eye with the rest (HQ s03).
- App, tools tab: card "נשארים בקשר" (WhatsApp channel, waitlist, Instagram, YouTube, TikTok, Facebook). `/go` has all five channels.
- `site/icons/og.jpg`: 1200x630 link preview for the two pages. `media/brand/build.py` draws the profile pictures, banners and og image as vectors from the app icon.
- Tests: unit (waitlist rules, landing pages have no inline scripts) and e2e `landing.spec.mjs`.
- Netlify serves `/join` and `/go` from `join.html` / `go.html` (pretty URLs). Verify both on the live site after the release, and one real signup end to end.

## Cloudflare edge (set up 2026-11-12, waiting for the nameserver switch)
- Zone `blueronin.app` on Cloudflare Free (account of eli211299@gmail.com), status pending until the nameservers move
  (Netlify-registered domains have no NS editor; the domain is being moved to Eli's Name.com account, see Open items). Assigned NS: `damiete.ns.cloudflare.com`, `melany.ns.cloudflare.com`.
- DNS: apex and www CNAME → `blueronin-north-map.netlify.app`, proxied. No mail on the domain: SPF `-all`, DMARC `p=reject`, null MX.
  CAA: `letsencrypt.org` only (Netlify certs; Cloudflare adds its own CAs), no wildcards.
- SSL Full (strict), Always HTTPS, TLS 1.2+, TLS 1.3, 0-RTT off, HTTP/3. Rocket Loader, email obfuscation, Always Online off (do not touch the app HTML).
- Cache rule: Cloudflare caches nothing. Netlify stays the only CDN, so deploys are seen immediately.
- WAF: Free Managed Ruleset; custom rules (5/5): exploit probes, unused HTTP methods (allowed: GET HEAD POST OPTIONS DELETE),
  `/admin*` and `/api/admin*` from Israel only, scripted clients on `/api/`, injection/traversal patterns in the URL.
  Rate limit (1/1): `/api/*` except `/api/traffic-tile/*`, 100 requests / 10 s per IP → block 10 s. Bot Fight Mode on. Security level medium.
- Under Attack mode: off. Emergency only (Overview → Under Attack Mode); it challenges every visitor and breaks `/api`, push, link previews.
- DNSSEC signed in Cloudflare, DS **not** at the registrar yet. Add the DS at Name.com only after the zone is Active:
  `blueronin.app. 3600 IN DS 2371 13 2 F0D80DA5601D8AE7F44073A3337D1CFD6289557F603BF60E61BCF4E0E4DF9DC9`.
- Alerts by email: L7 DDoS, Universal SSL, security insights.
- Edge handshake: a Cloudflare request-header rule (late transform) sets `x-br-edge` to a secret on every request. Netlify env
  `EDGE_SECRET` holds the same value (Functions scope). `lib/edge.mjs`: only requests carrying it may supply the visitor address via
  `cf-connecting-ip` (all per-IP throttles use `ipOf` → `clientIp`); without it the Netlify connection IP is used, so the address can't be forged.
  `EDGE_ENFORCE=1` (set only after the zone is Active and verified, needs a rebuild) makes every `/api` function answer 403 to requests
  that bypass Cloudflare (direct to netlify.app or a Netlify IP).
- Netlify's own rate-limit config is deliberately not used: behind a proxy it counts Cloudflare's IPs, so all riders would share one bucket.
- Order matters: env `EDGE_SECRET` → release with `lib/edge.mjs` → then the nameserver switch. Switching first makes Cloudflare's IP
  look like one visitor (waitlist "5 per hour per network", admin lockout).
- If something breaks after the switch: first turn off Bot Fight Mode, then the custom rule that matches (Security → Events shows which).

## Open items
- **Outage 2026-11-13 ~19:40 UTC → ongoing:** Netlify's internal transfer to Eli's Name.com account (3371704-9a613da) failed and left blueronin.app with no nameservers (registry status `inactive`, NXDOMAIN). The domain is in neither the Netlify nor the Name.com account. Eli wrote Netlify (#1191302) on 2026-11-14 06:56 and opened Name.com support ticket #3112318 (07:52). When it lands in his account: NS → `damiete`/`melany.ns.cloudflare.com`, then the Cloudflare checklist below. Browsers with the old service worker show the cached app shell for every page while the domain is down (that is why privacy.html looked like "2.4.0").
- Cloudflare: Netlify can't change nameservers (it resells Name.com). Ticket #1191302: Netlify moves the domain into Eli's own Name.com account (free internal transfer); Eli created the account, verified ICANN contacts and sent the account code on 2026-11-13. Waiting for Netlify to confirm the transfer. Then at Name.com: set NS to `damiete`/`melany.ns.cloudflare.com`, turn on auto-renew there (renewal moves from Netlify to Name.com, due Oct 2027), and later add the DS record there ourselves. When the zone is Active: release the `GET /api/ping` handshake check (on `dev`), confirm `{"edge":true,"ready":true}` through blueronin.app → verify app, waitlist, push, live share, link previews, a deploy → then add the DS record. After verification: `EDGE_ENFORCE=1` + rebuild.
- If the MapLibre CDN (unpkg) is unreachable the app does not boot and the guard shows recovery (seen in the offline test harness). Consider self-hosting MapLibre and SunCalc in `site/vendor/` so the shell is fully offline-capable and one CDN outage can't take the app down.
- Rebuild the lost scenario test suites in `tests/e2e` as each area is touched (ride mode, transfer, group, replay, weather outage first).
- `README.md` still describes the early north-only app and TomTom; refresh it.
- Env var changes need a production rebuild before functions see them, and `/api/config` is cached ~10 min.
- HERE coverage in Israel (checked 2026-11-07): incidents are rich; flow data is sparse on rural roads on a Saturday morning. Watch on weekdays before promising traffic in Pro marketing.
- Eli: turn on admin push alerts in "בקרה" on his phone.
- First real rides: journal, replay, ride plan against reality.
- Watch the monitor for the iPhone intro-stuck report.
- Moto garages depend on OSM tagging, which is thin in Israel: consider a curated list or rider submissions.
- Re-issue the HERE key (it was pasted in chat) and update the env var.
- Field check of 2.7.0 (Eli, next ride): no repeated "מחשב מסלול מחדש" on a straight road, the blue guide line is clear under the bike, landscape board readable in both rotation directions, and a real house number found in search. Field errors and reroutes show in "בקרה".
- One real signup on https://blueronin.app/join end to end (appears in the admin "המתנה" view), then switch every bio link to `blueronin.app/go?src=…`.
- Repo: `dev` began as its own root; release 2.7.0 (a9d0068) joined it to `main`, so future releases are ordinary merges.
