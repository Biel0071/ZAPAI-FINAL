# Milestone 1 Adversarial Testing & Review Handoff Report

**Agent**: `m1_challenger_1` (Empirical Challenger / Reviewer)  
**Parent / Recipient**: `3265ab63-b153-484a-b6d7-740defe3b059` (Orchestrator)  
**Milestone**: Milestone 1 (`m1_whatsapp_session_stability`)  
**Scope**: WhatsApp Engine Stability, Canonical Session Paths, Auto-Migration, Boot Auto-Restore, Reconnection State Machine, Socket Cleanup  
**Date**: 2026-11-04  
**Verdict**: **`REJECT`** (Empirically Confirmed Failure Modes & Security Vulnerabilities Require Surgical Remediation)  
**Handoff Type**: Hard Handoff  

---

## 1. Observation

Direct empirical probes and test executions across `sessionPaths.js`, `sessionPersistenceValidator.js`, `sessionRecoveryService.js`, and `sessionManager.legacy.js` revealed five distinct defects:

### 1.1 Unhandled `TypeError` Crash on `null` in `validateSession()`
- **Location**: `backend/services/whatsapp/connection/sessionPersistenceValidator.js:96`
- **Verbatim Code**:
  ```javascript
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

  // 4. Check required credential keys (including me.id for paired sessions)
  const missingKeys = REQUIRED_CRED_KEYS.filter((key) => !creds[key]);
  ```
- **Observed Behavior**:
  When `creds.json` contains literal `null` (e.g. from an aborted session serialization or empty payload), `JSON.parse('null')` does not throw an error and returns `null`. `result.credsValid` is incorrectly set to `true`. Then line 96 executes `!creds[key]`, which throws:
  ```
  TypeError: Cannot read properties of null (reading 'noiseKey')
      at C:\projetos\ZAPAI-FINAL\backend\services\whatsapp\connection\sessionPersistenceValidator.js:96:64
      at Array.filter (<anonymous>)
      at validateSession (C:\projetos\ZAPAI-FINAL\backend\services\whatsapp\connection\sessionPersistenceValidator.js:96:42)
  ```
  This is unhandled inside `validateSession()`, throwing an unhandled Promise rejection.

### 1.2 Cascading Auto-Recovery Failure across Healthy Sessions in `sessionRecoveryService.js`
- **Location**: `backend/services/sessionRecoveryService.js:60-68`
- **Verbatim Code**:
  ```javascript
  for (const id of sessionIds) {
    const normalizedId = sessionManager.normalizeSessionName(id);
    
    // 1. Verify credentials validity
    const validation = await validateSession(normalizedId);
    if (!validation.ok) {
      console.log(`[SessionRecoveryService] Session "${normalizedId}" has invalid or incomplete credentials. Skipping.`);
      continue;
    }
  ```
- **Observed Log Output in Test Execution**:
  ```
  [SessionRecoveryService] Found session directories: [ 'session_aaa_corrupted', 'session_zzz_valid' ]
  [SessionRecoveryService] Error during session recovery: Cannot read properties of null (reading 'noiseKey')
  [recoverSessions Result with corrupted neighbor]: []
  ```
- **Observed Behavior**:
  Because line 64 is outside the inner `try/catch` block, when `session_aaa_corrupted` throws `TypeError: Cannot read properties of null`, the entire `recoverSessions()` loop aborts. `session_zzz_valid` (which has valid, healthy credentials) is never checked or recovered.

### 1.3 Path Traversal Escape in `normalizeSessionId()` & Arbitrary Deletion in `deleteSessionFolder()`
- **Location**: `backend/services/whatsapp/connection/sessionPaths.js:65-81` and `backend/services/sessionManager.legacy.js:284-294`
- **Verbatim Code (`sessionPaths.js:65`)**:
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
- **Observed Behavior in Adversarial Test Probe**:
  Input `sessionId = '../victim_critical_data'` normalized to `'../victim_critical_data'`.  
  `getSessionPath('../victim_critical_data')` evaluated to `path.join('.../data/sessions', '../victim_critical_data')`, resolving directly to `.../data/victim_critical_data`, entirely escaping the canonical sessions directory.
- **Amplification in `deleteSessionFolder` (`sessionManager.legacy.js:284-294`)**:
  ```javascript
  async function deleteSessionFolder(sessionName) {
    const normalizedName = normalizeSessionName(sessionName);
    const sessionPath = getSessionPath(normalizedName);
    try {
      await fs.rm(sessionPath, { force: true, recursive: true });
  ```
  Any invocation of `disposeSession`, `removeSession`, or `restartSession` with a traversal-bearing session name executes recursive deletion (`fs.rm(..., { force: true, recursive: true })`) on directories outside `data/sessions`.

### 1.4 Missing Concurrency Lock in `migrateLegacySessions()`
- **Location**: `backend/services/whatsapp/connection/sessionPaths.js:96-189`
- **Observed Behavior**:
  Under 10 concurrent requests, all 10 workers executed migration in parallel, printing `[SESSION MIGRATION] Migrated session ... (3 files)` 10 times simultaneously. There is no mutex, atomic rename, or in-flight promise deduplication guarding `migrateLegacySessions()`.

### 1.5 Missing Restoration Invocations in Worker's Test Suite
- **Location**: `backend/tests/sessionAutoRestoreAndPersistence.test.js:121-164`
- **Observed Behavior**:
  The test entitled `'sessionManager - restoreSessions restores valid session on boot and skips invalid'` only calls `validateSession('restore_valid')` and `validateSession('restore_invalid')`. It **never invokes `sessionManager.restoreSessions()`**.
- **Location**: `backend/tests/sessionPathsAndMigration.test.js:89-98`
- **Observed Behavior**:
  `migrateLegacySessions()` hardcodes `getLegacySessionsDirectory()` to `backend/sessions`. In the worker's unit test, instead of testing `migrateLegacySessions()`, lines 93-98 manually copied the files with an ad-hoc loop.

---

## 2. Logic Chain

1. **Premise 1**: Acceptance Criteria R1 requires reliable persistence and auto-restoration across restarts without unexpected drops or unhandled rejections.
2. **Observation 1.1 + Observation 1.2**: If any session directory contains empty or `null` JSON, `validateSession()` throws `TypeError: Cannot read properties of null (reading 'noiseKey')`. When `sessionRecoveryService.recoverSessions()` runs, this unhandled error crashes the scanning loop, preventing all subsequent valid sessions from being restored.
3. **Premise 2**: System security and directory integrity require that session identifiers never escape the designated sandbox `<root>/data/sessions`.
4. **Observation 1.3**: `normalizeSessionId()` fails to strip `..`, `/`, and `\`. Calling `getSessionPath()` with traversal sequences escapes the session directory. Calling `deleteSessionFolder()` with such inputs recursively deletes arbitrary directories on the host filesystem.
5. **Premise 3**: Production boot processes may trigger concurrent restores or health checks.
6. **Observation 1.4**: Without a mutex or in-flight deduplication flag, concurrent calls to `migrateLegacySessions()` race against each other, creating potential partial-file reads and writes.
7. **Conclusion**: The current implementation contains two critical bugs (unhandled null crash halting session recovery; path traversal allowing arbitrary directory deletion) and two test gaps. Therefore, Milestone 1 cannot be approved in its current state.

---

## 3. Caveats

- **Normal Cases Work Well**: When credentials are fully populated and valid, the baseline reconnection state machine (`reconnect.js`), disconnect reason classification, and socket listener teardown functions properly and pass 18/18 baseline tests.
- **Database Fallback Persistence**: `safeUpdateSessionStatus` and `safeCreateSessionRecord` in `persistence.js` properly prevent fatal unhandled exceptions when session owner is missing.
- **Reviewer Non-Modification Constraint**: As an empirical challenger, we have strictly created only test verification harnesses (`backend/tests/adversarialMilestone1.test.js`) and metadata files. We have NOT modified any production files.

---

## 4. Conclusion

**Verdict: `REJECT`**

Milestone 1 is rejected due to:
1. `sessionPersistenceValidator.js:96`: `validateSession` crashes on non-object / `null` `creds.json`.
2. `sessionRecoveryService.js:64`: Loop crashes and drops all valid sessions if one session has corrupted credentials.
3. `sessionPaths.js:65`: Path traversal vulnerability in `normalizeSessionId` allows directory escape and arbitrary deletion.
4. `sessionPaths.js:96`: Lack of concurrent migration guard.

### Required Surgical Remediation for Worker (`m1_worker_1`):

1. **In `backend/services/whatsapp/connection/sessionPersistenceValidator.js`**:
   Sanitize `creds` immediately after `JSON.parse`:
   ```javascript
   if (!creds || typeof creds !== 'object' || Array.isArray(creds)) {
     warnings.push('creds.json is not a valid JSON object');
     result.credsValid = false;
     return result;
   }
   ```
2. **In `backend/services/sessionRecoveryService.js`**:
   Wrap the per-session validation check inside the loop in a `try/catch` so a corrupted session directory never prevents other healthy sessions from recovering.
3. **In `backend/services/whatsapp/connection/sessionPaths.js`**:
   Sanitize `normalizeSessionId` to strip directory traversal sequences:
   ```javascript
   function normalizeSessionId(sessionId = 'main') {
     const raw = String(sessionId || 'main').trim();
     const sanitized = path.basename(raw).replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
     return sanitized || 'main';
   }
   ```
   And in `getSessionPath`:
   ```javascript
   function getSessionPath(sessionId = 'main') {
     const canonicalDir = getCanonicalSessionsDirectory();
     const normalized = normalizeSessionId(sessionId);
     const resolved = path.resolve(canonicalDir, normalized);
     // Guard against path traversal
     if (!resolved.startsWith(canonicalDir)) {
       throw new Error(`Security Violation: Session path "${resolved}" escapes canonical directory "${canonicalDir}"`);
     }
     return resolved;
   }
   ```
4. **In `backend/services/whatsapp/connection/sessionPaths.js`**:
   Add an in-flight migration lock to `migrateLegacySessions()`:
   ```javascript
   let migrationInFlight = null;
   async function migrateLegacySessions() {
     if (migrationInFlight) return migrationInFlight;
     migrationInFlight = (async () => { ... })();
     try { return await migrationInFlight; } finally { migrationInFlight = null; }
   }
   ```

---

## 5. Verification Method

To independently verify all findings and reproduce the defects, run:

```powershell
node --test backend/tests/adversarialMilestone1.test.js
```

### Invalidation Conditions:
The rejection is invalidated and can be converted to `APPROVE` once:
1. `validateSession()` returns `{ ok: false, credsValid: false }` without throwing an unhandled exception when `creds.json` is `null`, `true`, `"string"`, or `[]`.
2. `sessionRecoveryService.recoverSessions()` successfully recovers `session_zzz_valid` even when preceded by `session_aaa_corrupted`.
3. `getSessionPath('../victim')` throws or sanitizes to `.../data/sessions/victim` without escaping `data/sessions`.
4. All existing 18 tests and all 10 adversarial tests pass with exit code 0.
