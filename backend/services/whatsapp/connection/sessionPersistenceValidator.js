/**
 * SessionPersistenceValidator
 *
 * Validates that Baileys auth state is correctly persisted to disk
 * and that sessions can be restored after restart/crash/deploy.
 *
 * Usage (CLI):
 *   node backend/services/whatsapp/connection/sessionPersistenceValidator.js
 *   node backend/services/whatsapp/connection/sessionPersistenceValidator.js --session default
 *   node backend/services/whatsapp/connection/sessionPersistenceValidator.js --fix
 *
 * Usage (programmatic):
 *   const { validateAll } = require('./sessionPersistenceValidator');
 *   const report = await validateAll();
 *
 * Returns:
 *   { ok: boolean, sessions: SessionValidation[], summary: string }
 */

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');

const SESSIONS_ROOT = path.join(__dirname, '..', '..', '..', 'sessions');
const CREDS_FILE = 'creds.json';
const REQUIRED_CRED_KEYS = ['noiseKey', 'signedIdentityKey', 'registrationId', 'me'];

/**
 * @typedef {Object} SessionValidation
 * @property {string} sessionId
 * @property {string} sessionPath
 * @property {boolean} dirExists
 * @property {boolean} credsExists
 * @property {boolean} credsValid
 * @property {boolean} credsComplete
 * @property {string[]} missingKeys
 * @property {number|null} credsAgeMs
 * @property {string[]} warnings
 * @property {boolean} ok
 */

/**
 * Validates a single session directory.
 * @param {string} sessionId
 * @returns {Promise<SessionValidation>}
 */
async function validateSession(sessionId) {
  const sessionPath = path.join(SESSIONS_ROOT, sessionId);
  const credsPath = path.join(sessionPath, CREDS_FILE);
  const warnings = [];

  const result = {
    sessionId,
    sessionPath,
    dirExists: false,
    credsExists: false,
    credsValid: false,
    credsComplete: false,
    missingKeys: [],
    credsAgeMs: null,
    warnings,
    ok: false,
  };

  // 1. Check session directory
  try {
    const stat = await fsp.stat(sessionPath);
    result.dirExists = stat.isDirectory();
  } catch {
    warnings.push(`Session directory does not exist: ${sessionPath}`);
    return result;
  }

  // 2. Check creds.json exists
  try {
    await fsp.access(credsPath, fs.constants.R_OK);
    result.credsExists = true;
  } catch {
    warnings.push(`creds.json missing or not readable at: ${credsPath}`);
    return result;
  }

  // 3. Parse creds.json
  let creds;
  try {
    const raw = await fsp.readFile(credsPath, 'utf8');
    creds = JSON.parse(raw);
    result.credsValid = true;
  } catch (err) {
    warnings.push(`creds.json parse error: ${err.message}`);
    return result;
  }

  // 4. Check required credential keys
  const missingKeys = REQUIRED_CRED_KEYS.filter((key) => !creds[key]);
  result.missingKeys = missingKeys;
  result.credsComplete = missingKeys.length === 0;

  if (missingKeys.length > 0) {
    warnings.push(`creds.json incomplete — missing keys: ${missingKeys.join(', ')}`);
  }

  // 5. Check file age (warn if older than 30 days — may indicate stale session)
  try {
    const stat = await fsp.stat(credsPath);
    result.credsAgeMs = Date.now() - stat.mtimeMs;
    const ageDays = Math.floor(result.credsAgeMs / (1000 * 60 * 60 * 24));
    if (ageDays > 30) {
      warnings.push(`creds.json last modified ${ageDays} days ago — session may need reconnection`);
    }
  } catch { /* non-fatal */ }

  // 6. Check other auth files Baileys writes (app-state-sync-key-*, sender-key-*, etc.)
  try {
    const files = await fsp.readdir(sessionPath);
    const authFiles = files.filter((f) => f !== CREDS_FILE && f.endsWith('.json'));
    if (authFiles.length === 0) {
      warnings.push('No additional auth state files found — session may not be fully authenticated');
    }
  } catch { /* non-fatal */ }

  result.ok = result.credsExists && result.credsValid && result.credsComplete;
  return result;
}

/**
 * Lists all session IDs found in the sessions directory.
 * @returns {Promise<string[]>}
 */
async function listSessionIds() {
  try {
    const entries = await fsp.readdir(SESSIONS_ROOT, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}

/**
 * Validates all sessions found in the sessions directory.
 * @returns {Promise<{ ok: boolean, sessions: SessionValidation[], summary: string }>}
 */
async function validateAll() {
  const sessionIds = await listSessionIds();

  if (sessionIds.length === 0) {
    return {
      ok: true,
      sessions: [],
      summary: 'No sessions found. Connect WhatsApp to create the first session.',
    };
  }

  const results = await Promise.all(sessionIds.map(validateSession));

  const healthy = results.filter((r) => r.ok);
  const degraded = results.filter((r) => !r.ok);

  const lines = [
    `=== Session Persistence Validation ===`,
    `Sessions: ${results.length} total, ${healthy.length} healthy, ${degraded.length} degraded`,
    ``,
    ...results.map((r) => {
      const status = r.ok ? '✅' : '❌';
      const age = r.credsAgeMs != null ? `${Math.floor(r.credsAgeMs / 60000)}min ago` : 'N/A';
      const lines = [`${status} ${r.sessionId} (creds last updated: ${age})`];
      r.warnings.forEach((w) => lines.push(`   ⚠  ${w}`));
      return lines.join('\n');
    }),
  ];

  return {
    ok: degraded.length === 0,
    sessions: results,
    summary: lines.join('\n'),
  };
}

/**
 * Attempts basic recovery: re-creates missing session directories.
 * Does NOT recreate creds (impossible without QR scan).
 * @returns {Promise<void>}
 */
async function fix(sessionIds) {
  const targets = sessionIds || await listSessionIds();
  for (const id of targets) {
    const dir = path.join(SESSIONS_ROOT, id);
    await fsp.mkdir(dir, { recursive: true });
    console.log(`[SessionPersistenceValidator] Ensured directory: ${dir}`);
  }
}

module.exports = { fix, listSessionIds, validateAll, validateSession };

// ─── CLI mode ───────────────────────────────────────────────────────────────
if (require.main === module) {
  const args = process.argv.slice(2);
  const fixMode = args.includes('--fix');
  const sessionArg = args.find((a, i) => args[i - 1] === '--session');

  (async () => {
    if (fixMode) {
      await fix(sessionArg ? [sessionArg] : undefined);
    }

    const report = await validateAll();
    console.log(report.summary);
    process.exit(report.ok ? 0 : 1);
  })().catch((err) => {
    console.error('[SessionPersistenceValidator] Fatal:', err.message || err);
    process.exit(1);
  });
}
