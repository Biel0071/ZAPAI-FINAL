#!/usr/bin/env bash
# Deploy only a reviewed commit and its locally verified frontend artifact.
# Usage: bash ops/deploy/auto-deploy.sh --ref=<sha> --artifact=/path/dist.tar.gz
set -Eeuo pipefail
umask 077
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="${ZAPAI_ROOT:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
WEB_ROOT="${WEB_ROOT:-/etc/icontainer/apps/openresty/openresty/www/zapai}"
TARGET_REF=""
ARTIFACT=""
DRY_RUN=false
for arg in "$@"; do
  case "$arg" in
    --ref=*) TARGET_REF="${arg#*=}" ;;
    --artifact=*) ARTIFACT="${arg#*=}" ;;
    --dry-run) DRY_RUN=true ;;
    *) echo "Unknown option: $arg" >&2; exit 2 ;;
  esac
done
[[ "$TARGET_REF" =~ ^[0-9a-f]{40}$ ]] || { echo 'A full reviewed commit SHA is required.' >&2; exit 2; }
for bin in git node npm pm2 pg_dump tar curl flock; do command -v "$bin" >/dev/null; done
cd "$ROOT_DIR"
[[ "$(git rev-parse --show-toplevel)" == "$ROOT_DIR" ]]
git cat-file -e "$TARGET_REF^{commit}"
git diff --quiet && git diff --cached --quiet || { echo 'Tracked server changes must be preserved before deploying.' >&2; exit 2; }
[[ -f "$ARTIFACT" ]] || { echo 'Verified frontend artifact missing.' >&2; exit 2; }
[[ -d "$WEB_ROOT" && ! -L "$WEB_ROOT" ]] || { echo 'Expected OpenResty document root missing or symlinked.' >&2; exit 2; }
[[ -f backend/.env || -f .env.production ]] || { echo 'Existing production environment missing.' >&2; exit 2; }
AVAILABLE_KB="$(df -Pk "$ROOT_DIR" | awk 'NR==2 {print $4}')"
(( AVAILABLE_KB > 1048576 )) || { echo 'Less than 1 GiB free; deploy stopped.' >&2; exit 2; }
if $DRY_RUN; then echo 'Preflight passed; no state changed.'; exit 0; fi
exec 9>"$ROOT_DIR/.deploy.lock"
flock -n 9 || { echo 'Another deployment is active.' >&2; exit 2; }
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
SNAPSHOT="$ROOT_DIR/releases/safe-$STAMP"
mkdir -p "$SNAPSHOT/state" "$SNAPSHOT/frontend"
chmod 700 "$SNAPSHOT"
git rev-parse HEAD > "$SNAPSHOT/previous-commit"
printf '%s\n' "$TARGET_REF" > "$SNAPSHOT/target-commit"
printf '%s\n' "$WEB_ROOT" > "$SNAPSHOT/web-root"
git status --porcelain > "$SNAPSHOT/server-status"
pm2 jlist > "$SNAPSHOT/pm2.json"
for path in .env .env.production backend/.env.production backend/.env backend/sessions data/sessions data/json_db backend/data backend/upload backend/uploads data/uploads; do
  if [[ -e "$ROOT_DIR/$path" ]]; then mkdir -p "$SNAPSHOT/state/$(dirname "$path")"; cp -a "$ROOT_DIR/$path" "$SNAPSHOT/state/$path"; fi
done
# Immutable media files stay in persistent storage. Hard links protect them from
# deletion without duplicating 6+ GiB; mutable metadata receives a separate copy.
if [[ -d storage/media ]]; then
  mkdir -p "$SNAPSHOT/state/storage"
  cp -al storage/media "$SNAPSHOT/state/storage/media"
  if [[ -d storage/media/.metadata ]]; then cp -a storage/media/.metadata "$SNAPSHOT/media-metadata"; fi
fi
cp -a "$WEB_ROOT/." "$SNAPSHOT/frontend/"
BACKUP_DIR="$SNAPSHOT" node <<'NODE'
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const dotenv = require('./backend/node_modules/dotenv');
const saved = JSON.parse(fs.readFileSync(path.join(process.env.BACKUP_DIR, 'pm2.json'), 'utf8')).find(p => p.name === 'zapflow-api');
if (!saved) throw Error('Production PM2 process missing');
const environment = { ...saved.pm2_env };
// Match server.js: each existing dotenv file overrides the process environment.
for (const file of ['.env', '.env.production', 'backend/.env.production', 'backend/.env']) {
  if (fs.existsSync(file)) Object.assign(environment, dotenv.parse(fs.readFileSync(file)));
}
if (!environment.DATABASE_URL || !environment.JWT_SECRET || !environment.ENCRYPTION_KEY) throw Error('Production credentials are incomplete; no secrets generated');
const url = new URL(environment.DATABASE_URL);
const result = spawnSync('pg_dump', ['--format=custom', '--no-owner', '--no-acl', '--host', url.hostname, '--port', url.port || '5432', '--username', decodeURIComponent(url.username), '--dbname', decodeURIComponent(url.pathname.slice(1)), '--file', path.join(process.env.BACKUP_DIR, 'database.dump')], { env: { ...process.env, PGPASSWORD: decodeURIComponent(url.password), PGSSLMODE: url.searchParams.get('sslmode') || 'prefer' }, encoding: 'utf8' });
if (result.status !== 0) throw Error('Database snapshot failed');
NODE
[[ -s "$SNAPSHOT/database.dump" ]]
(( $(df -Pk "$ROOT_DIR" | awk 'NR==2 {print $4}') > 1048576 )) || { echo 'Insufficient free space after backup.' >&2; exit 2; }
NEXT_WEB="${WEB_ROOT}.next-$STAMP"
mkdir "$NEXT_WEB"
tar -xzf "$ARTIFACT" -C "$NEXT_WEB" --no-same-owner
[[ -s "$NEXT_WEB/index.html" ]]
chmod -R a+rX "$NEXT_WEB"
CHANGED=false
SWAPPED=false
DEPENDENCIES_CHANGED=false
rollback() {
  local result=$?
  trap - ERR
  set +e
  if $CHANGED; then
    git switch --detach "$(cat "$SNAPSHOT/previous-commit")"
    if $SWAPPED; then
      if [[ -e "$WEB_ROOT" ]]; then mv "$WEB_ROOT" "${WEB_ROOT}.failed-$STAMP"; fi
      mv "${WEB_ROOT}.previous-$STAMP" "$WEB_ROOT"
    fi
    if $DEPENDENCIES_CHANGED; then (cd backend && npm ci --omit=dev --legacy-peer-deps --no-audit --no-fund); fi
    pm2 reload zapflow-api || true
  fi
  echo "Deployment failed; previous release restored. Snapshot: $SNAPSHOT" >&2
  exit "$result"
}
trap rollback ERR
CHANGED=true
git switch --detach "$TARGET_REF"
if ! git diff --quiet "$(cat "$SNAPSHOT/previous-commit")" "$TARGET_REF" -- backend/package.json backend/package-lock.json; then
  DEPENDENCIES_CHANGED=true
  (cd backend && npm ci --omit=dev --legacy-peer-deps --no-audit --no-fund)
fi
# Schema migrations are never automatic here; each change has its own reviewed gate.
mv "$WEB_ROOT" "${WEB_ROOT}.previous-$STAMP"
SWAPPED=true
mv "$NEXT_WEB" "$WEB_ROOT"
pm2 reload zapflow-api
for attempt in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:${PORT:-4025}/api/health" > "$SNAPSHOT/health.json" && node -e "const h=require(process.argv[1]);if(h.backend!==true||h.database?.status!=='online'||h.system?.socket!=='connected')process.exit(1)" "$SNAPSHOT/health.json"; then break; fi
  if [[ "$attempt" == 30 ]]; then false; fi
  sleep 3
done
curl -fLsS --max-redirs 3 --max-time 30 --header 'Host: 209.50.241.22' http://127.0.0.1/ > "$SNAPSHOT/served-index.html"
cmp -s "$WEB_ROOT/index.html" "$SNAPSHOT/served-index.html"
SOCKET_HANDSHAKE="$(curl -fsS "http://127.0.0.1:${PORT:-4025}/socket.io/?EIO=4&transport=polling")"
[[ "${SOCKET_HANDSHAKE:0:1}" == 0 ]]
printf '%s\n' "$SNAPSHOT" > "$ROOT_DIR/releases/last-safe-deploy"
trap - ERR
pm2 save >/dev/null
echo "Published commit $TARGET_REF. Snapshot: $SNAPSHOT"
echo 'WhatsApp, real delivery and AI must be confirmed in authenticated acceptance testing.'
