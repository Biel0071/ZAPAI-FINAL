/**
 * Canonical Session Path Alignment & Safe Migration Helper.
 * Feature F1.1 (Milestone 1).
 *
 * Centralizes directory and file path resolution for Baileys WhatsApp sessions,
 * ensuring all components (stableSession, sessionManager, sessionPersistenceValidator,
 * connectionService, QA scripts) inspect and modify the identical location.
 */

const fs = require('fs');
const path = require('path');

/**
 * Root directory of the repository.
 * Relative to backend/services/whatsapp/connection: 4 levels up.
 */
const PROJECT_ROOT = path.resolve(__dirname, '../../../../');

/**
 * Legacy sessions directory used in earlier iterations: <root>/backend/sessions.
 */
const LEGACY_SESSIONS_DIR = path.resolve(__dirname, '../../../sessions');

/**
 * Returns the canonical sessions directory.
 * Resolution precedence:
 * 1. process.env.WHATSAPP_SESSIONS_DIR (if set and non-empty)
 * 2. Linux container root /data/sessions (if non-Windows and /data/sessions exists or is a mount point)
 * 3. <PROJECT_ROOT>/data/sessions
 *
 * @returns {string} Absolute path to canonical sessions directory.
 */
function getCanonicalSessionsDirectory() {
  if (process.env.WHATSAPP_SESSIONS_DIR && process.env.WHATSAPP_SESSIONS_DIR.trim().length > 0) {
    return path.resolve(process.env.WHATSAPP_SESSIONS_DIR.trim());
  }

  // Docker production environment mounting /data/sessions on Linux
  if (process.platform !== 'win32') {
    try {
      if (fs.existsSync('/data/sessions')) {
        return '/data/sessions';
      }
    } catch {
      // fallback to project root data/sessions if /data is not accessible
    }
  }

  return path.resolve(PROJECT_ROOT, 'data', 'sessions');
}

/**
 * Returns the legacy sessions directory (<root>/backend/sessions).
 * @returns {string} Absolute path.
 */
function getLegacySessionsDirectory() {
  return LEGACY_SESSIONS_DIR;
}

/**
 * Normalizes a session identifier to a secure, filesystem-safe string.
 * Strictly prevents path traversal (.., ../, ..\\), slashes, null bytes, and non-whitelisted characters.
 *
 * @param {string} sessionId
 * @returns {string} Sanitized session identifier matching /^[a-z0-9_\-]+$/
 */
function normalizeSessionId(sessionId = 'main') {
  if (sessionId === null || sessionId === undefined) {
    return 'main';
  }

  // 1. Remove null bytes and trim whitespace
  const raw = String(sessionId).replace(/\0/g, '').trim();
  if (!raw) {
    return 'main';
  }

  // 2. Normalize backslashes to forward slashes for cross-platform basename extraction
  const forwardSlashed = raw.replace(/\\/g, '/');

  // 3. Extract basename to strip all directory traversal prefixes
  const base = path.posix.basename(forwardSlashed);
  if (!base || base === '.' || base === '..') {
    return 'main';
  }

  // 4. Whitelist: replace any character outside [a-zA-Z0-9_\-] with underscore and convert to lowercase
  const sanitized = base.replace(/[^a-zA-Z0-9_\-]/g, '_').toLowerCase();

  // 5. Fallback to 'main' if the result is empty or contains only underscores
  if (!sanitized || sanitized.replace(/_/g, '').length === 0) {
    return 'main';
  }

  return sanitized;
}

/**
 * Returns the canonical path for a specific session directory.
 * Guarantees that the resolved path is strictly contained within the canonical sessions directory.
 *
 * @param {string} sessionId
 * @returns {string} Absolute path to session directory.
 * @throws {Error} If resolved path escapes canonical sessions directory.
 */
function getSessionPath(sessionId = 'main') {
  const canonicalDir = getCanonicalSessionsDirectory();
  const normalized = normalizeSessionId(sessionId);
  const resolved = path.resolve(canonicalDir, normalized);

  // Hard sandbox containment check: relative path must not escape canonicalDir
  const relative = path.relative(canonicalDir, resolved);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Security Violation: Session path "${resolved}" escapes canonical directory "${canonicalDir}"`);
  }

  return resolved;
}

/**
 * Lock and temporary files that should never be copied across migrations.
 */
const EXCLUDED_MIGRATION_FILES = new Set(['.lock', '.write_lock', '.tmp']);

/**
 * In-flight migration promise cache to prevent concurrent race conditions.
 * Keyed by `${resolvedLegacyDir}:::${resolvedCanonicalDir}`.
 */
const inFlightMigrations = new Map();

/**
 * Safely migrates legacy session folders from backend/sessions to data/sessions.
 * - Idempotent: will not overwrite existing canonical credentials.
 * - Non-destructive: copies credentials and preserves legacy folder as backup.
 * - Filters out stale lock files to prevent deadlocks.
 * - Concurrency protected: multiple concurrent calls await the active in-flight migration promise.
 *
 * @param {string} [customLegacyDir=null] - Optional source legacy directory (e.g. for isolated unit tests).
 * @param {string} [customCanonicalDir=null] - Optional destination canonical directory (e.g. for isolated unit tests).
 * @returns {Promise<{ migrated: string[], skipped: string[], errors: Array<{ sessionId: string, error: string }> }>}
 */
async function migrateLegacySessions(customLegacyDir = null, customCanonicalDir = null) {
  const legacyDir = customLegacyDir ? path.resolve(customLegacyDir) : getLegacySessionsDirectory();
  const canonicalDir = customCanonicalDir ? path.resolve(customCanonicalDir) : getCanonicalSessionsDirectory();

  const migrationKey = `${path.resolve(legacyDir)}:::${path.resolve(canonicalDir)}`;

  // Deduplication: if a migration is already active for these directories, await that promise
  if (inFlightMigrations.has(migrationKey)) {
    return inFlightMigrations.get(migrationKey);
  }

  const migrationPromise = (async () => {
    const result = {
      migrated: [],
      skipped: [],
      errors: [],
    };

    // If legacy directory doesn't exist or is the same as canonical, nothing to do
    if (!fs.existsSync(legacyDir) || path.resolve(legacyDir) === path.resolve(canonicalDir)) {
      return result;
    }

    try {
      // Ensure canonical sessions directory exists
      await fs.promises.mkdir(canonicalDir, { recursive: true });

      const entries = await fs.promises.readdir(legacyDir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory() || entry.name.startsWith('.')) {
          continue;
        }

        const sessionId = normalizeSessionId(entry.name);
        const srcDir = path.join(legacyDir, entry.name);
        const dstDir = path.join(canonicalDir, sessionId);

        try {
          const legacyCreds = path.join(srcDir, 'creds.json');
          const canonicalCreds = path.join(dstDir, 'creds.json');

          // Check if legacy has creds
          if (!fs.existsSync(legacyCreds)) {
            result.skipped.push(sessionId);
            continue;
          }

          // Check if canonical already has creds
          if (fs.existsSync(canonicalCreds)) {
            result.skipped.push(sessionId);
            continue;
          }

          // Create destination directory
          await fs.promises.mkdir(dstDir, { recursive: true });

          // Copy all non-lock files
          const files = await fs.promises.readdir(srcDir);
          let copiedCount = 0;

          for (const file of files) {
            if (EXCLUDED_MIGRATION_FILES.has(file) || file.endsWith('.lock') || file.endsWith('.tmp')) {
              continue;
            }
            const srcFile = path.join(srcDir, file);
            const dstFile = path.join(dstDir, file);

            const stat = await fs.promises.stat(srcFile);
            if (stat.isFile()) {
              await fs.promises.copyFile(srcFile, dstFile);
              copiedCount += 1;
            }
          }

          if (copiedCount > 0) {
            result.migrated.push(sessionId);
            // eslint-disable-next-line no-console
            console.log(`[SESSION MIGRATION] Migrated session "${sessionId}" from ${srcDir} to ${dstDir} (${copiedCount} files).`);
          } else {
            result.skipped.push(sessionId);
          }
        } catch (sessionErr) {
          result.errors.push({
            sessionId,
            error: sessionErr?.message || String(sessionErr),
          });
          // eslint-disable-next-line no-console
          console.warn(`[SESSION MIGRATION] Failed migrating session "${sessionId}":`, sessionErr?.message || sessionErr);
        }
      }
    } catch (err) {
      result.errors.push({
        sessionId: 'global',
        error: err?.message || String(err),
      });
      // eslint-disable-next-line no-console
      console.error('[SESSION MIGRATION] Global migration error:', err?.message || err);
    }

    return result;
  })();

  inFlightMigrations.set(migrationKey, migrationPromise);

  try {
    return await migrationPromise;
  } finally {
    inFlightMigrations.delete(migrationKey);
  }
}

module.exports = {
  PROJECT_ROOT,
  getCanonicalSessionsDirectory,
  getLegacySessionsDirectory,
  getSessionPath,
  migrateLegacySessions,
  normalizeSessionId,
};
