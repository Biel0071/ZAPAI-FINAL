#!/usr/bin/env bash
# Explicit code/frontend rollback; database and live credentials remain intact.
set -Eeuo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="${ZAPAI_ROOT:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
SNAPSHOT="${1:-}"
[[ -n "$SNAPSHOT" ]] || SNAPSHOT="$(cat "$ROOT_DIR/releases/last-safe-deploy")"
SNAPSHOT="$(realpath "$SNAPSHOT")"
[[ "$SNAPSHOT" == "$ROOT_DIR"/releases/safe-* && -f "$SNAPSHOT/previous-commit" && -f "$SNAPSHOT/frontend/index.html" ]]
cd "$ROOT_DIR"
git diff --quiet && git diff --cached --quiet || { echo 'Preserve tracked changes before rollback.' >&2; exit 2; }
WEB_ROOT="$(cat "$SNAPSHOT/web-root")"
[[ "$WEB_ROOT" == /etc/icontainer/apps/openresty/openresty/www/zapai && -d "$WEB_ROOT" && ! -L "$WEB_ROOT" ]]
exec 9>"$ROOT_DIR/.deploy.lock"
flock -n 9
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
NEXT_WEB="${WEB_ROOT}.restore-$STAMP"
cp -a "$SNAPSHOT/frontend" "$NEXT_WEB"
chmod -R a+rX "$NEXT_WEB"
DEPENDENCIES_CHANGED=false
if ! git diff --quiet HEAD "$(cat "$SNAPSHOT/previous-commit")" -- backend/package.json backend/package-lock.json; then DEPENDENCIES_CHANGED=true; fi
git switch --detach "$(cat "$SNAPSHOT/previous-commit")"
if $DEPENDENCIES_CHANGED; then (cd backend && npm ci --omit=dev --legacy-peer-deps --no-audit --no-fund); fi
mv "$WEB_ROOT" "${WEB_ROOT}.before-rollback-$STAMP"
mv "$NEXT_WEB" "$WEB_ROOT"
pm2 reload zapflow-api
curl --retry 8 --retry-delay 3 --retry-connrefused -fsS "http://127.0.0.1:${PORT:-4025}/api/health" >/dev/null
echo "Previous code and frontend restored from $SNAPSHOT"
