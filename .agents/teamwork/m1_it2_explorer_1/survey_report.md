# Milestone 1 Iteration 2: Technical Survey & Fix Strategy Report
**Component**: `sessionPaths.js` (Canonical Session Storage, Path Traversal Defense & Concurrency Locking)  
**Author**: `m1_it2_explorer_1` (Explorer Subagent)  
**Date**: 2026-11-04  
**Integrity Mode**: Read-Only Analysis & Design Specification  

---

## Executive Summary

Following the Milestone 1 Reviewer (`m1_reviewer_2`) and Challenger (`m1_challenger_1`) reports, two high-severity defects were uncovered in `backend/services/whatsapp/connection/sessionPaths.js`:
1. **Path Traversal Vulnerability (CWE-22)**: `normalizeSessionId` does not sanitize parent directory traversal sequences (`..`, `../`, `..\`) or path separators. Consequently, `getSessionPath('../victim')` escapes the canonical `<root>/data/sessions` directory, exposing external host directories to arbitrary recursive deletion via `sessionManager.deleteSessionFolder()`.
2. **Missing Concurrency Lock & Testing Rigidity**: `migrateLegacySessions()` lacks in-flight promise synchronization. Under concurrent startup calls (e.g., multi-worker startup or concurrent HTTP requests), multiple migrations execute simultaneously, duplicating disk operations and log entries. Additionally, `migrateLegacySessions()` hardcodes directory resolution, forcing unit tests to use facade copy loops rather than testing the real function.

This report establishes the verified mathematical and architectural fix strategy for both defects, including exact before-and-after line replacements and automated verification procedures.

---

## 1. Defect Analysis: Path Traversal in `sessionPaths.js`

### 1.1 Vulnerability Mechanics & Attack Vectors
In `backend/services/whatsapp/connection/sessionPaths.js:65-81`:
```javascript
function normalizeSessionId(sessionId = 'main') {
  const normalized = String(sessionId || 'main')
    .trim()
    .replace(/\s+/g, '_')
    .toLowerCase();
  return normalized || 'main';
}

function getSessionPath(sessionId = 'main') {
  const canonicalDir = getCanonicalSessionsDirectory();
  return path.join(canonicalDir, normalizeSessionId(sessionId));
}
```

When evaluated against traversal payloads:
| Input Attack String | Current Normalized Output | Resolved Path (`canonicalDir = /app/data/sessions`) | Escapes Canonical? |
|---|---|---|---|
| `../../../etc/passwd` | `../../../etc/passwd` | `/etc/passwd` | **YES** |
| `..\..\windows\system32` | `..\..\windows\system32` | `C:\windows\system32` | **YES** |
| `session/../../secret` | `session/../../secret` | `/app/data/secret` | **YES** |
| `../victim_critical_data` | `../victim_critical_data` | `/app/data/victim_critical_data` | **YES** |
| `..` | `..` | `/app/data` | **YES** |
| `.` | `.` | `/app/data/sessions` (itself) | **YES** |
| `sess\0null` | `sess\0null` | Null byte poisoning in C-bindings | **YES** |

### 1.2 Blast Radius
In `backend/services/sessionManager.legacy.js:284-294`:
```javascript
async function deleteSessionFolder(sessionName) {
  const normalizedName = normalizeSessionName(sessionName);
  const sessionPath = getSessionPath(normalizedName);
  try {
    await fs.rm(sessionPath, { force: true, recursive: true });
    // ...
```
Any call to `deleteSessionFolder`, `disposeSession`, or `removeSession` passing an unvetted session identifier results in an unconditional `fs.rm(..., { force: true, recursive: true })` against the traversed target path, allowing an attacker or malformed request to wipe out arbitrary project or system directories.

### 1.3 Fix Architecture: Two-Layer Defense-in-Depth

#### Layer 1: Multi-stage Sanitization in `normalizeSessionId`
1. **Null byte strip**: Eliminate `\0`.
2. **Separator normalization**: Replace all backslashes (`\`) with forward slashes (`/`) so `path.posix.basename` operates consistently on both Windows and POSIX platforms.
3. **Basename extraction**: Apply `path.posix.basename(forwardSlashed)` to strip all parent traversal prefixes.
4. **Dot / Traversal guard**: If the extracted basename is `.` or `..` or empty, immediately fallback to `'main'`.
5. **Character Whitelist**: Replace any character not in `[a-zA-Z0-9_\-]` with `_`, convert to lowercase, and collapse multiple underscores.
6. **All-underscore guard**: If the sanitized string consists only of underscores (e.g. from `..` converted to `__`), fallback to `'main'`.

#### Layer 2: Hard Canonical Sandbox Containment in `getSessionPath`
Evaluate the relative path from `canonicalDir` to `resolved`:
```javascript
const relative = path.relative(canonicalDir, resolved);
if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
  throw new Error(`Security Violation: Session path "${resolved}" escapes canonical directory "${canonicalDir}"`);
}
```
If any input ever managed to escape `canonicalDir`, or resolves to `canonicalDir` itself, `getSessionPath` immediately throws a security violation error, preventing `fs.rm` or file access.

### 1.4 Downstream Unification in `sessionManager.legacy.js`
In `backend/services/sessionManager.legacy.js:83-90`:
Currently, `normalizeSessionName` duplicates the naive normalization. It should delegate directly to `normalizeSessionId`:
```javascript
function normalizeSessionName(sessionName = DEFAULT_SESSION) {
  return normalizeSessionId(sessionName || DEFAULT_SESSION);
}
```
This instantly immunizes all 40+ call sites across controllers and services.

---

## 2. Defect Analysis: Concurrency Lock & Testing Rigidity in `migrateLegacySessions`

### 2.1 Problem Mechanics
In `backend/services/whatsapp/connection/sessionPaths.js:96-189`:
1. `migrateLegacySessions()` accepts no arguments, hardcoding `legacyDir = getLegacySessionsDirectory()`.
2. It maintains no mutex or in-flight promise.
3. Under concurrent calls (e.g., 10 parallel requests tested in `adversarialMilestone1.test.js:355`), 10 separate asynchronous workflows scan the directory, concurrently copy the same files, and print duplicate logs:
   ```
   [SESSION MIGRATION] Migrated session "adv_..." (3 files).
   [SESSION MIGRATION] Migrated session "adv_..." (3 files).
   ... (repeated 10 times)
   ```
4. In `backend/tests/sessionPathsAndMigration.test.js:80-104`, because `migrateLegacySessions` could not accept test directories, the test author wrote a facade copy loop in the test file itself.

### 2.2 Fix Architecture: In-Flight Promise Cache Map
1. Maintain an `inFlightMigrations` `Map`:
   Key: `${path.resolve(legacyDir)}:::${path.resolve(canonicalDir)}`.
2. Allow optional parameters:
   `async function migrateLegacySessions(customLegacyDir = null, customCanonicalDir = null)`
   If provided, use `path.resolve(customLegacyDir)` / `path.resolve(customCanonicalDir)`; otherwise fallback to `getLegacySessionsDirectory()` / `getCanonicalSessionsDirectory()`.
3. Check `if (inFlightMigrations.has(migrationKey)) return inFlightMigrations.get(migrationKey);`.
4. Wrap the migration routine in `migrationPromise` and store it in `inFlightMigrations`.
5. In a `try / finally` block, `await migrationPromise` and delete `migrationKey` in `finally`.
   - Guaranteed cleanup even on thrown exceptions.
   - Full deduplication: 10 concurrent requests await the identical migration promise, executing disk I/O exactly once.

---

## 3. Concrete Line Replacement Recommendations

### 3.1 Target File: `backend/services/whatsapp/connection/sessionPaths.js`

#### Chunk 1: Lines 60–82 (Path Traversal Fix)
**Target Content**:
```javascript
/**
 * Normalizes a session identifier to filesystem-safe string.
 * @param {string} sessionId
 * @returns {string}
 */
function normalizeSessionId(sessionId = 'main') {
  const normalized = String(sessionId || 'main')
    .trim()
    .replace(/\s+/g, '_')
    .toLowerCase();
  return normalized || 'main';
}

/**
 * Returns the canonical path for a specific session directory.
 * @param {string} sessionId
 * @returns {string} Absolute path to session directory.
 */
function getSessionPath(sessionId = 'main') {
  const canonicalDir = getCanonicalSessionsDirectory();
  return path.join(canonicalDir, normalizeSessionId(sessionId));
}
```

**Replacement Content**:
```javascript
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
```

---

#### Chunk 2: Lines 88–189 (Concurrency Lock & Optional Parameters)
**Target Content**:
```javascript
/**
 * Safely migrates legacy session folders from backend/sessions to data/sessions.
 * - Idempotent: will not overwrite existing canonical credentials.
 * - Non-destructive: copies credentials and preserves legacy folder as backup.
 * - Filters out stale lock files to prevent deadlocks.
 *
 * @returns {Promise<{ migrated: string[], skipped: string[], errors: Array<{ sessionId: string, error: string }> }>}
 */
async function migrateLegacySessions() {
  const result = {
    migrated: [],
    skipped: [],
    errors: [],
  };

  const legacyDir = getLegacySessionsDirectory();
  const canonicalDir = getCanonicalSessionsDirectory();

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
}
```

**Replacement Content**:
```javascript
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
```

---

### 3.2 Target File: `backend/services/sessionManager.legacy.js`

#### Chunk: Lines 83–90
**Target Content**:
```javascript
function normalizeSessionName(sessionName = DEFAULT_SESSION) {
  const normalized = String(sessionName || DEFAULT_SESSION)
    .trim()
    .replace(/\s+/g, '_')
    .toLowerCase();

  return normalized || DEFAULT_SESSION;
}
```

**Replacement Content**:
```javascript
function normalizeSessionName(sessionName = DEFAULT_SESSION) {
  return normalizeSessionId(sessionName || DEFAULT_SESSION);
}
```
*(Note: ensure `normalizeSessionId` is included in the destructuring of `./whatsapp/connection/sessionPaths` on line 10)*.

---

### 3.3 Target File: `backend/tests/sessionPathsAndMigration.test.js`

#### Chunk: Lines 80–104
Eliminate the facade manual copy loop and directly test `migrateLegacySessions(tempLegacy, tempCanonical)`:

**Target Content**:
```javascript
    // Manually run migration logic for custom directory test
    // We verify our sessionPaths module handles the migration
    const result = await migrateLegacySessions();
    assert.ok(result);
    assert.ok(Array.isArray(result.migrated));
    assert.ok(Array.isArray(result.skipped));
    assert.ok(Array.isArray(result.errors));

    // Test specific copy behavior
    const dstSessionDir = path.join(tempCanonical, testSession);
    await fsp.mkdir(dstSessionDir, { recursive: true });

    // Copy using the same exclusion filter as migrateLegacySessions
    const files = await fsp.readdir(legacySessionDir);
    for (const file of files) {
      if (!['.lock', '.write_lock', '.tmp'].includes(file) && !file.endsWith('.lock')) {
        await fsp.copyFile(path.join(legacySessionDir, file), path.join(dstSessionDir, file));
      }
    }

    assert.ok(fs.existsSync(path.join(dstSessionDir, 'creds.json')), 'creds.json should exist');
    assert.ok(fs.existsSync(path.join(dstSessionDir, 'app-state-sync-key-1.json')), 'sync key should exist');
    assert.ok(!fs.existsSync(path.join(dstSessionDir, '.lock')), '.lock file must not be copied');
    assert.ok(!fs.existsSync(path.join(dstSessionDir, '.write_lock')), '.write_lock must not be copied');
```

**Replacement Content**:
```javascript
    // Directly invoke migrateLegacySessions with custom test directories
    const result = await migrateLegacySessions(tempLegacy, tempCanonical);
    assert.ok(result);
    assert.deepEqual(result.migrated, [testSession]);
    assert.equal(result.errors.length, 0);

    const dstSessionDir = path.join(tempCanonical, testSession);
    assert.ok(fs.existsSync(path.join(dstSessionDir, 'creds.json')), 'creds.json should exist');
    assert.ok(fs.existsSync(path.join(dstSessionDir, 'app-state-sync-key-1.json')), 'sync key should exist');
    assert.ok(!fs.existsSync(path.join(dstSessionDir, '.lock')), '.lock file must not be copied');
    assert.ok(!fs.existsSync(path.join(dstSessionDir, '.write_lock')), '.write_lock must not be copied');
```

---

## 4. Verification & Invalidation Strategy

### 4.1 Verification Commands
The implementing worker (`m1_worker_1`) must verify these changes using the following test sequence:

1. **Adversarial Security & Concurrency Verification**:
   ```powershell
   node --test backend/tests/adversarialMilestone1.test.js
   ```
   *Expected Result*:
   - In `Adversarial 3.1`, `[SESSION MIGRATION]` logs appear exactly once (not 10 times).
   - In `Adversarial 1.2` and `4.2`, `normalizeSessionId('../victim')` normalizes to `'victim'` and `getSessionPath('../victim')` resolves strictly to `<canonicalDir>\victim` without escaping.
   - All 10 adversarial tests pass.

2. **Core Milestone 1 Unit Test Suite**:
   ```powershell
   node --test backend/tests/sessionPathsAndMigration.test.js backend/tests/sessionAutoRestoreAndPersistence.test.js backend/tests/reconnectStateMachine.test.js backend/tests/sessionRecoveryService.test.js
   ```
   *Expected Result*: All 18 tests pass with 0 failures.

3. **Master End-to-End Test Suite**:
   ```powershell
   node tests/e2e/run_all_e2e.js
   ```
   *Expected Result*: All 43 E2E tests across Tiers 1–4 pass.

### 4.2 Invalidation Conditions
This strategy is invalidated if:
- Any valid session name containing alphanumeric characters, underscores, or hyphens (e.g. `'wa-a'`, `'session_1'`, `'client_a'`) is improperly altered.
- `getSessionPath` escapes `data/sessions` under any combination of traversal characters (`../`, `..\`, `%2e%2e`, `\0`).
- A concurrent call to `migrateLegacySessions` triggers duplicate copy operations on disk.
