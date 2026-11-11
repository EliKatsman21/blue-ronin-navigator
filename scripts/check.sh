#!/usr/bin/env bash
# Runs every check: static unit tests, then the Playwright smoke suite.
# Usage: scripts/check.sh            (all)
#        scripts/check.sh --unit     (no browser, a few seconds)
set -euo pipefail
cd "$(dirname "$0")/../tests"
[ -d node_modules ] || npm ci --no-audit --no-fund
echo "== unit"; node --test unit/*.test.mjs
[ "${1:-}" = "--unit" ] && exit 0
echo "== e2e"; npx playwright test
echo "All checks passed."
