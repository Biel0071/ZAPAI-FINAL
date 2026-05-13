const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT, 'dist');
const RELEASE_LOCK_FILE = path.join(ROOT, 'release.lock.json');
const LOCKED_RELEASE_FILE = path.join(DIST_DIR, 'locked-release.json');

if (!fs.existsSync(RELEASE_LOCK_FILE)) {
  console.error('[publish-locked] release.lock.json not found');
  process.exit(1);
}

if (!fs.existsSync(DIST_DIR)) {
  console.error('[publish-locked] dist not found. Build first.');
  process.exit(1);
}

const lock = JSON.parse(fs.readFileSync(RELEASE_LOCK_FILE, 'utf8'));
if (!lock.locked || !lock.buildId) {
  console.error('[publish-locked] release lock is not active');
  process.exit(1);
}

const payload = {
  release: 'locked',
  buildId: String(lock.buildId),
  lockedAt: lock.lockedAt || new Date().toISOString(),
  publishedAt: new Date().toISOString(),
};

fs.writeFileSync(LOCKED_RELEASE_FILE, JSON.stringify(payload, null, 2));
console.log('[publish-locked] locked release manifest generated');
console.log('[publish-locked] file:', LOCKED_RELEASE_FILE);
