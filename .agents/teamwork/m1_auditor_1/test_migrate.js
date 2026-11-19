const fs = require('fs');
const path = require('path');
const os = require('os');
const { migrateLegacySessions, getLegacySessionsDirectory } = require('../../../backend/services/whatsapp/connection/sessionPaths');

async function testMigrate() {
  const legacyDir = getLegacySessionsDirectory();
  const testSessionDir = path.join(legacyDir, 'audit_test_session');
  fs.mkdirSync(testSessionDir, { recursive: true });
  fs.writeFileSync(path.join(testSessionDir, 'creds.json'), JSON.stringify({ test: 1 }));
  fs.writeFileSync(path.join(testSessionDir, 'test.lock'), 'locked');
  fs.writeFileSync(path.join(testSessionDir, '.write_lock'), 'locked');
  fs.writeFileSync(path.join(testSessionDir, 'data.json'), JSON.stringify({ data: true }));

  const tempCanonical = fs.mkdtempSync(path.join(os.tmpdir(), 'audit_canonical_'));
  process.env.WHATSAPP_SESSIONS_DIR = tempCanonical;

  try {
    const res = await migrateLegacySessions();
    console.log('Migrate result:', JSON.stringify(res));
    const destCreds = path.join(tempCanonical, 'audit_test_session', 'creds.json');
    const destData = path.join(tempCanonical, 'audit_test_session', 'data.json');
    const destLock = path.join(tempCanonical, 'audit_test_session', 'test.lock');
    const destWriteLock = path.join(tempCanonical, 'audit_test_session', '.write_lock');

    console.log('destCreds exists:', fs.existsSync(destCreds));
    console.log('destData exists:', fs.existsSync(destData));
    console.log('destLock exists:', fs.existsSync(destLock));
    console.log('destWriteLock exists:', fs.existsSync(destWriteLock));
  } finally {
    fs.rmSync(testSessionDir, { recursive: true, force: true });
    fs.rmSync(tempCanonical, { recursive: true, force: true });
    delete process.env.WHATSAPP_SESSIONS_DIR;
  }
}

testMigrate().catch((e) => {
  console.error(e);
  process.exit(1);
});
