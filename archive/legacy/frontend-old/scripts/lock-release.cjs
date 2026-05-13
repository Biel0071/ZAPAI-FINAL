const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT, 'dist');
const RELEASE_LOCK_FILE = path.join(ROOT, 'release.lock.json');

function extractCurrentBuildSignature() {
  const indexPath = path.join(DIST_DIR, 'index.html');
  if (!fs.existsSync(indexPath)) {
    return `stable-${Date.now()}`;
  }

  const html = fs.readFileSync(indexPath, 'utf8');
  const jsMatch = html.match(/assets\/index\.([A-Za-z0-9_-]+)\.js/);
  if (jsMatch && jsMatch[1]) {
    return jsMatch[1];
  }

  const hash = crypto.createHash('sha256').update(html).digest('hex').slice(0, 16);
  return hash;
}

const buildId = extractCurrentBuildSignature();

const payload = {
  locked: true,
  buildId,
  lockedAt: new Date().toISOString(),
};

fs.writeFileSync(RELEASE_LOCK_FILE, JSON.stringify(payload, null, 2));
console.log('[lock-release] locked build id:', buildId);
console.log('[lock-release] file:', RELEASE_LOCK_FILE);
