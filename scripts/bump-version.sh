#!/usr/bin/env bash
# Release version bump: APP_VER (app.js), VER (guard.js), SHELL +1 (sw.js).
# Usage: scripts/bump-version.sh 2.7.0
# Then add the matching CHANGELOG entry at the top of the list in site/app.js (the unit test checks it).
set -euo pipefail
v="${1:?usage: bump-version.sh X.Y.Z}"
[[ "$v" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "bad version: $v"; exit 1; }
cd "$(dirname "$0")/../site"
sed -i -E "s/const APP_VER = \"[0-9.]+\"/const APP_VER = \"$v\"/" app.js
sed -i -E "s/const VER = \"[0-9.]+\"/const VER = \"$v\"/" guard.js
n=$(grep -oE 'brn-shell-v[0-9]+' sw.js | head -1 | grep -oE '[0-9]+$')
sed -i -E "s/brn-shell-v$n\"/brn-shell-v$((n+1))\"/" sw.js
echo "APP_VER/VER = $v, SHELL = brn-shell-v$((n+1))"
grep -q "{ v: \"$v\"" app.js || echo "Now add the CHANGELOG entry for $v at the top of CHANGELOG in site/app.js."
