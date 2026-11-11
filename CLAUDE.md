# Blue Ronin Navigator: instructions for Claude

Two-wheeler navigator PWA for Israel (brand "BLUE RONIN · ישראל"), live at https://blueronin.app.
Owner: Eli Katsman. He writes in Hebrew; answer him in Hebrew. Code, commits and docs stay in English
except user-facing strings, which are Hebrew.

Read `docs/STATUS.md` before any non-trivial change: it holds the current state, design decisions,
incidents and open items. This file holds the rules.

## The one rule about deploys
Every push to `main` is a production deploy on Netlify and costs about 15 of 1,000 monthly credits.
- Work on the `dev` branch (or a short `fix/…` / `feat/…` branch merged into `dev`). Never push to `main` directly.
- `netlify.toml` has `ignore = test "$CONTEXT" != "production"`, so pushes to `dev`, other branches and
  PR previews never build. Do not remove it.
- Eli decides when a round is big enough to release. Only then: release checklist below, then merge `dev` into `main`.
- Urgent production fixes may go out alone, still through the checklist, and only when Eli says so.

## Repo map
- `site/`: the PWA. Load order in `index.html`: `guard.js` (boot guard + field error reporter) → `intro.js` →
  MapLibre + SunCalc from CDN → `geo.js` → `data.js` (chapters, cafes, enforcement) → `bikes.js` → `logic.js` → `app.js`.
  Also `sw.js` (offline shell), `sw-retire.js` (old host only), `admin.html/js`, `live.html/js`, `privacy.html`, `terms.html`.
- `netlify/functions/`: server. Shared code in `lib/` (`admin`, `push`, `pro`, `safety`, `ops`, `health`, `osm`, `brief`).
- `tests/`: test harness with its own `package.json` (kept out of the root so Netlify builds stay lean).
- `scripts/`: `check.sh` (all tests), `bump-version.sh` (release version bump).
- `docs/`: `STATUS.md` (project state, source of truth), `WORKFLOW.md` (how Eli and Claude work, Hebrew).
- `media/`: video and content production: scripts, storyboards, shot lists, small assets. Renders stay out of git.
- `.github/`: issue templates, PR template, CI workflow that runs the tests on every push.

## Tests
Run `scripts/check.sh` before every commit you push and always before a release.
- `tests/unit/`: node:test, no browser: version consistency, every script and function parses, sw shell files exist,
  chapter stops inside the Israel outline, no secrets, netlify.toml guards.
- `tests/e2e/`: Playwright (Chromium, phone + desktop). `tests/serve.mjs` serves `site/` locally; `/api/*` answers 503
  so the app runs its degraded paths; MapLibre/SunCalc come from `tests/node_modules`; every other outside request is blocked.
  The `pageErrors` fixture fails a test on any uncaught error.
- There is no WebKit here. iPhone-only problems show up in the field error reporter and the admin monitor ("בקרה").
- When you fix a bug, add a test that would have caught it, where that is practical.
- GitHub Actions (`.github/workflows/check.yml`) runs the same suite on pushes to `dev` and on PRs. It is free and spends no Netlify credits.

## Release checklist (only when Eli asks for a release)
1. `scripts/bump-version.sh X.Y.Z`: sets `APP_VER` (app.js), `VER` (guard.js), bumps `SHELL` (sw.js).
2. Add the top `CHANGELOG` entry in `site/app.js` (Hebrew, user-facing, short items). The unit test fails until it matches.
3. If a chapter's stops changed: bump that chapter's `rv` in `data.js`.
4. `scripts/check.sh` green.
5. Update `docs/STATUS.md` (release section, open items).
6. Merge `dev` → `main` and push. Wait for the Netlify deploy, then verify on https://blueronin.app
   (version in the app, the changed features, admin "בקרה" has no new incidents).
7. Copy `docs/STATUS.md` to the claude.ai Project doc `claude/blue-ronin-navigator.md` so chats see the same state.

## Commits
- Author: `Eli Katsman`, committer: `Claude <noreply@anthropic.com>`. Small, focused commits with clear messages.
- Reference the issue: `Fixes #12` / `Refs #12`.

## Issues are the backlog
Every request, bug and idea is a GitHub issue with labels: `bug`, `enhancement`, `video`, `content`, `infra`,
`pro`, `safety`, `urgent`, `next-release`, `from-monitor`, `needs-eli`. When Eli asks for something in chat,
open (or update) the issue first, then work. Close issues from commits on release.

## Secrets and keys
Never commit keys. They live in Netlify environment variables: `HERE_API_KEY`, `HERE_MONTHLY_CAP`, `HERE_GEO_CAP`,
`MAPILLARY_TOKEN`, `ADMIN_SETUP_CODE` (and `ADMIN_RESET_CODE` only during recovery). If a key is pasted in chat,
tell Eli to rotate it. Env var changes need a production rebuild before functions see them.

## Things that bite
- Built-in chapters carry `rv`; cache keys `route:v4`, `elev:v4`, `steps:v2`. Change stops → bump `rv`.
- OSM layers are filtered by `IL_POLY`/`inIL` in `lib/osm.mjs`. Re-check when adding chapters near a border.
- Every tab has an error boundary; a tab must never render empty. External services (Open-Meteo, HERE, OSRM) fail: validate replies, keep the last good value.
- Safety features are never paywalled.
- `/api/config` is cached ~10 min.
- Old host `blueronin-north-map.netlify.app` 301-redirects to blueronin.app; keep those redirects above any catch-all.
