# Technical Exploration Report: Feature F1.1 (Canonical Session Path Alignment & Auto-Migration)

**Target Milestone**: Milestone 1 (`m1_whatsapp_session_stability`)  
**Target Feature**: F1.1 — Canonical Session Path Alignment & Auto-Migration  
**Explorer**: m1_explorer_1 (Teamwork Read-Only Explorer)  
**Date**: 2026-11-04  
**Workspace**: `c:\projetos\ZAPAI-FINAL`

---

## 1. Executive Summary

A thorough investigation of the backend session architecture revealed the exact mechanism causing WhatsApp sessions to fail to persist across restarts. 

When a session authenticates via Baileys multi-file auth:
- `backend/services/whatsapp/connection/stableSession.js` (line 99) creates the session credentials folder in `<root>/data/sessions/<sessionId>/`.
- Conversely, `backend/services/sessionManager.legacy.js` (line 20), `backend/services/whatsapp/connection/sessionPersistenceValidator.js` (line 24), and `backend/services/connectionService.legacy.js` (line 432) inspect, list, validate, and clean up `<root>/backend/sessions/<sessionId>/`.

### The Resulting Failure Chain:
1. On boot/restart, `sessionManager.restoreSessions()` queries stored session names and executes `validateSession(sessionId)`.
2. `sessionPersistenceValidator.js` looks for `creds.json` under `backend/sessions/<sessionId>/creds.json`.
3. Because the authentic credentials were written to `data/sessions/<sessionId>/creds.json`, `validateSession()` throws `ENOENT` and reports `{ ok: false, warnings: ['creds.json missing...'] }`.
4. `sessionManager.restoreSessions()` logs:
   `[WHATSAPP] Skipping auto-restore for session main (no valid/complete creds.json found).`
5. `sessionRecoveryService.recoverSessions()` then calls `listSessionIds()` on `backend/sessions/`, receives `[]`, and exits.
6. The user is presented with a disconnected status and forced to scan a new QR code after every restart or deployment!
7. When a user requests session deletion or logout (`DELETE /sessions/:id`), `sessionManager.legacy.js` executes `fs.rm` against `backend/sessions/<sessionId>`, leaving orphaned credentials inside `data/sessions/<sessionId>`, creating auth collision bugs on re-connection.

---

## 2. Exhaustive Audit of Session Folder Occurrences

Below is the verified inventory of all filesystem session path definitions across the entire repository:

| # | File Path | Line(s) | Current Hardcoded Definition | Effective Path (Windows / Linux) | Role in System |
|---|---|---|---|---|---|
| 1 | `backend/services/whatsapp/connection/stableSession.js` | 99, 180, 186, 1851 | `path.join(__dirname, '..', '..', '..', '..', 'data', 'sessions')` | `<root>/data/sessions` | **Canonical Baileys Auth Store** (creates auth files, saves keys, deletes on 401 loggedOut) |
| 2 | `backend/services/sessionManager.legacy.js` | 20, 22, 240, 393, 789, 838 | `path.join(__dirname, '..', 'sessions')` | `<root>/backend/sessions` | **Lifecycle Manager** (auto-restore on boot, directory enumeration, session deletion, zombie pruning) |
| 3 | `backend/services/whatsapp/connection/sessionPersistenceValidator.js` | 24, 48, 132, 187 | `path.join(__dirname, '..', '..', '..', 'sessions')` | `<root>/backend/sessions` | **Health & Persistence Validator** (validates creds.json, lists sessions for recovery) |
| 4 | `backend/services/connectionService.legacy.js` | 432-434 | `path.join(__dirname, '..', 'sessions')` | `<root>/backend/sessions` | **Connection Normalizer** (`getSessionHealth` checks if `creds.json` exists for `hasCreds` metric) |
| 5 | `scripts/qa/run-qa.js` | 140-146 | `path.join(root, "backend/sessions")` | `<root>/backend/sessions` | **QA Suite** (scans sessions for QA report; fails homologation if empty) |
| 6 | `backend/scripts/healthcheck.js` | 36, 120, 264, 273, 277 | `path.join(__dirname, '../sessions')` | `<root>/backend/sessions` | **Ops Healthcheck** (`checkBaileySessions()` marks status degraded if no creds in `backend/sessions`) |
| 7 | `backend/scripts/protect-whatsapp-sessions.js` | 7, 92, 118 | `path.join(ROOT, 'sessions')` | `<root>/backend/sessions` | **Backup & Protection Script** (backs up session folders) |
| 8 | `backend/scripts/session_reset_and_qr.js` | 102-105 | `path.join(__dirname, '..', 'sessions', sessionId)` | `<root>/backend/sessions/<session>` | **Reset Script** (deletes auth folder before issuing fresh QR) |
| 9 | `backend/scripts/recovery.sh` | 17, 111, 151 | `"$ROOT_DIR/sessions"` | `<root>/backend/sessions` | **Bash Recovery Script** (detects and clears stale `.lock` files) |
| 10 | `docker-compose.yml` | 66, 79 | `- dev_sessions:/app/sessions` | Container `/app/sessions` | Dev Docker container volume mapping |
| 11 | `docker-compose.production.yml` | 163, 192 | `- zapai_sessions:/data/sessions` | Container `/data/sessions` | Production Docker container volume mapping |
| 12 | `Dockerfile` | 36 | `VOLUME ["/app/backend/.sessions"]` | Container `/app/backend/.sessions` | Obsolete Docker volume instruction |

---

## 3. Canonical Path Helper Strategy

To ensure zero divergence across all current and future modules, we establish a **single authoritative module**:
`backend/services/whatsapp/connection/sessionPaths.js`

### 3.1 Architecture of `sessionPaths.js`

```javascript
/**
 * Canonical WhatsApp Session Paths & Auto-Migration Helper
 * Single Source of Truth for Session Filesystem Paths
 */

const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');

/**
 * Resolves the canonical root directory for WhatsApp session data.
 * Priority:
 *   1. process.env.WHATSAPP_SESSIONS_DIR (if set and non-empty)
 *   2. /data/sessions (if running in Linux environment with root mount)
 *   3. <project_root>/data/sessions (standard monorepo location)
 */
function getCanonicalSessionsDirectory() {
  if (process.env.WHATSAPP_SESSIONS_DIR && process.env.WHATSAPP_SESSIONS_DIR.trim() !== '') {
    return path.resolve(process.env.WHATSAPP_SESSIONS_DIR.trim());
  }
  if (process.platform !== 'win32' && fs.existsSync('/data/sessions')) {
    return '/data/sessions';
  }
  return path.resolve(__dirname, '../../../../data/sessions');
}

/**
 * Returns the legacy session directory (<project_root>/backend/sessions)
 * for backwards-compatible inspection and auto-migration.
 */
function getLegacySessionsDirectory() {
  return path.resolve(__dirname, '../../../sessions');
}

function normalizeSessionName(sessionName) {
  return String(sessionName || 'main').trim().toLowerCase();
}

/**
 * Resolves the full path to a specific session's auth directory.
 */
function getSessionPath(sessionName) {
  const canonicalDir = getCanonicalSessionsDirectory();
  const normalized = normalizeSessionName(sessionName);
  return path.join(canonicalDir, normalized);
}

async function ensureSessionsDirectory() {
  const dir = getCanonicalSessionsDirectory();
  await fsp.mkdir(dir, { recursive: true });
  return dir;
}

function ensureSessionsDirectorySync() {
  const dir = getCanonicalSessionsDirectory();
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
```

### 3.2 Key Architectural Benefits:
1. **Dynamic Environment Override**: In production Docker containers or staging environments, `WHATSAPP_SESSIONS_DIR` can be set to any persistent volume path without modifying code.
2. **Predictable Local Development**: On Windows or developer machines, it defaults automatically to `<root>/data/sessions`.
3. **Cross-Platform Consistency**: Normalized forward/back-slashes via `path.resolve` and `path.join`.
4. **Synchronous and Asynchronous Guarantees**: Both `ensureSessionsDirectory` (async) and `ensureSessionsDirectorySync` (for top-level module load in legacy files) are provided.

---

## 4. Backwards-Compatible Startup Auto-Migration

To guarantee zero downtime and prevent existing users from losing active sessions when transitioning to the canonical path, an automatic, idempotent migration routine must run on server startup prior to `restoreSessions()`.

### 4.1 Migration Algorithm (`migrateLegacySessions`)

```javascript
/**
 * Automatically inspects the legacy session directory (backend/sessions)
 * and copies any authenticated sessions into the canonical directory (data/sessions)
 * if the canonical session directory does not already have valid credentials.
 *
 * Idempotent, non-destructive, and resilient to crashes.
 */
async function migrateLegacySessions() {
  const canonicalDir = getCanonicalSessionsDirectory();
  const legacyDir = getLegacySessionsDirectory();

  const report = {
    canonicalDir,
    legacyDir,
    migrated: [],
    skipped: [],
    errors: [],
  };

  // If canonical and legacy resolve to the same path, no migration is necessary
  if (path.resolve(canonicalDir) === path.resolve(legacyDir)) {
    return report;
  }

  // If legacy directory doesn't exist, nothing to migrate
  try {
    await fsp.access(legacyDir);
  } catch {
    return report;
  }

  await fsp.mkdir(canonicalDir, { recursive: true });

  try {
    const entries = await fsp.readdir(legacyDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue;

      const sessionName = entry.name;
      const legacySessionDir = path.join(legacyDir, sessionName);
      const canonicalSessionDir = path.join(canonicalDir, sessionName);
      const legacyCreds = path.join(legacySessionDir, 'creds.json');
      const canonicalCreds = path.join(canonicalSessionDir, 'creds.json');

      // 1. Verify that legacy session contains a readable creds.json
      let hasLegacyCreds = false;
      try {
        await fsp.access(legacyCreds, fs.constants.R_OK);
        hasLegacyCreds = true;
      } catch {
        hasLegacyCreds = false;
      }

      if (!hasLegacyCreds) {
        report.skipped.push(`${sessionName} (no creds.json in legacy directory)`);
        continue;
      }

      // 2. Check if canonical session already contains creds.json
      let hasCanonicalCreds = false;
      try {
        await fsp.access(canonicalCreds, fs.constants.R_OK);
        hasCanonicalCreds = true;
      } catch {
        hasCanonicalCreds = false;
      }

      if (hasCanonicalCreds) {
        report.skipped.push(`${sessionName} (canonical directory already has creds.json)`);
        continue;
      }

      // 3. Safe copy all auth state files (skipping locks)
      try {
        await fsp.mkdir(canonicalSessionDir, { recursive: true });
        const files = await fsp.readdir(legacySessionDir, { withFileTypes: true });
        let filesCopied = 0;

        for (const file of files) {
          // Never copy lock files (.lock, .write_lock)
          if (file.isFile() && !file.name.endsWith('.lock')) {
            const src = path.join(legacySessionDir, file.name);
            const dst = path.join(canonicalSessionDir, file.name);
            await fsp.copyFile(src, dst);
            filesCopied++;
          }
        }

        console.log(`[SESSION MIGRATION] Migrated session "${sessionName}" (${filesCopied} files) from ${legacySessionDir} to ${canonicalSessionDir}`);
        report.migrated.push(sessionName);
      } catch (copyErr) {
        console.error(`[SESSION MIGRATION] Failed migrating session "${sessionName}":`, copyErr.message);
        report.errors.push(`${sessionName}: ${copyErr.message}`);
      }
    }
  } catch (err) {
    console.error('[SESSION MIGRATION] Error scanning legacy sessions directory:', err.message);
    report.errors.push(`readdir: ${err.message}`);
  }

  return report;
}
```

### 4.2 Where Migration Executes:
- In `backend/services/sessionManager.legacy.js` at the very beginning of `restoreSessions()`, before `listStoredSessionNames()` is invoked.
- Also in `backend/services/systemManager.js` inside `startSystem(store)` before `sessionManager.restoreSessions()`.
- Being idempotent, running this check takes < 5ms and ensures that any credentials found in `backend/sessions` are seamlessly mirrored into `data/sessions` before Baileys initializes.

---

## 5. Recommended Concrete Implementation Plan

### Step 1: Create `backend/services/whatsapp/connection/sessionPaths.js`
Implement the helper as detailed in Section 3 and 4.

### Step 2: Update `backend/services/whatsapp/connection/stableSession.js`
- Replace line 99:
  ```javascript
  const {
    getCanonicalSessionsDirectory,
    getSessionPath: getCanonicalSessionPath,
    ensureSessionsDirectory,
  } = require('./sessionPaths');
  const SESSIONS_DIRECTORY = getCanonicalSessionsDirectory();
  ```
- In `ensureSessionPath` (lines 183-198), utilize `getCanonicalSessionPath(normalizedSessionName)`.

### Step 3: Update `backend/services/sessionManager.legacy.js`
- Replace lines 20-22:
  ```javascript
  const {
    getCanonicalSessionsDirectory,
    getSessionPath: getCanonicalSessionPath,
    ensureSessionsDirectorySync,
    migrateLegacySessions,
  } = require('./whatsapp/connection/sessionPaths');
  const SESSIONS_DIRECTORY = getCanonicalSessionsDirectory();
  ensureSessionsDirectorySync();
  ```
- In `deleteSessionFolder` (line 240): use `getCanonicalSessionPath(normalizedName)`.
- In `restoreSessions` (line 740): invoke `await migrateLegacySessions().catch(...)` before scanning.

### Step 4: Update `backend/services/whatsapp/connection/sessionPersistenceValidator.js`
- Replace line 24:
  ```javascript
  const { getCanonicalSessionsDirectory, getSessionPath: getCanonicalSessionPath } = require('./sessionPaths');
  const SESSIONS_ROOT = getCanonicalSessionsDirectory();
  ```
- In `validateSession` (line 48): use `getCanonicalSessionPath(sessionId)`.
- In `fix` (line 187): use `getCanonicalSessionPath(id)`.

### Step 5: Update `backend/services/connectionService.legacy.js`
- In `getSessionHealth` (line 432):
  ```javascript
  const { getSessionPath } = require('./whatsapp/connection/sessionPaths');
  ...
  const credsPath = path.join(getSessionPath(sessionId), 'creds.json');
  const hasCreds = fs.existsSync(credsPath);
  ```

### Step 6: Update QA and Maintenance Scripts
- `scripts/qa/run-qa.js`: Line 140 -> check `path.join(root, "data/sessions")` first, with fallback to `backend/sessions`.
- `backend/scripts/healthcheck.js`: Line 36 -> import `getCanonicalSessionsDirectory` with fallback.
- `backend/scripts/protect-whatsapp-sessions.js`: Line 7 -> import `getCanonicalSessionsDirectory` with fallback.
- `backend/scripts/session_reset_and_qr.js`: Line 102 -> import `getSessionPath` with fallback.

### Step 7: Update Docker Configuration
- `docker-compose.yml`: Line 66 -> map `- dev_sessions:/app/data/sessions` and set `WHATSAPP_SESSIONS_DIR: /app/data/sessions`.
- `docker-compose.production.yml`: Line 121 -> add `WHATSAPP_SESSIONS_DIR: /data/sessions` to environment.

---

## 6. Verification and Test Suite Formulation

To prove that Feature F1.1 is completely solved without regression, the implementer must create and run:

### Test File: `backend/tests/sessionPathsAndMigration.test.js`
Tests to include:
1. `Canonical session path defaults to <root>/data/sessions`
2. `Canonical session path respects process.env.WHATSAPP_SESSIONS_DIR`
3. `sessionManager, stableSession, and sessionPersistenceValidator share identical canonical path`
4. `migrateLegacySessions() copies creds.json from legacy to canonical when canonical is empty`
5. `migrateLegacySessions() is idempotent and does not overwrite existing valid canonical creds`
6. `migrateLegacySessions() ignores empty directories or lock files`
7. `validateSession() returns ok: true when credentials exist in canonical directory`

### Commands to Run:
```bash
# 1. Run new session path and migration test suite
node --test backend/tests/sessionPathsAndMigration.test.js

# 2. Run existing recovery service test
node --test backend/tests/sessionRecoveryService.test.js

# 3. Run QA health check script
node scripts/qa/run-qa.js
```
