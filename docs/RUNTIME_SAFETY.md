# ZAPFLOW AI — Runtime Safety & Worktree Policy

## Problem (May 2026 Incident)

Claude worktrees at `.claude/worktrees/` were running stale frontend/backend
processes on ports 8080/4025. The browser was loading OLD code with ghost
functions like `refreshRuntimeSessions` while all edits went to the
canonical `frontend-official/` directory. Result: invisible, undiagnosable
runtime divergence.

## Canonical Directories

| Service | Canonical Path | Port |
|---------|---------------|------|
| Frontend | `frontend-official/` | 8080 |
| Backend | `backend/` | 4025 |

**No other directory may serve on these ports.**

## Safety Systems

### 1. start-zapflow.bat (auto-kill stale processes)
Before starting, the script:
- Detects and kills any process on port 8080 or 4025
- Detects and kills any node process from `.claude/worktrees/`
- Clears Vite cache
- Prints VERIFY lines showing actual CWD of launched processes

### 2. Runtime Identity (window.__ZAPFLOW_RUNTIME__)
Every browser load prints:
```
[ZAPFLOW Runtime Identity]
  frontend: frontend-official
  runtimeId: rt-xxxxx-yyyyy
  env: development
  buildHash: stable
  viteRoot: /
  startedAt: 2026-...
```
If this log is missing or shows wrong `frontend`, the browser is loading a ghost.

### 3. Structured Observability Logs
- `[Runtime]` prefix — provider lifecycle events
- `[Socket]` prefix — WebSocket lifecycle events
- `[ZAPFLOW]` prefix — bootstrap events

## Rules

### NEVER
- Run worktree frontends on port 8080
- Run worktree backends on port 4025
- Use worktrees as production-local environment

### IF a worktree needs to run for testing
- Use alternative ports: 8181 (frontend), 4125 (backend)
- Kill it immediately after testing

### Diagnosis Checklist
If the browser shows unexpected behavior:
1. Open DevTools console → check for `[ZAPFLOW Runtime Identity]` 
2. Verify `frontend: frontend-official`
3. Run `window.__ZAPFLOW_RUNTIME__` in console
4. Check `netstat -ano | findstr ":8080"` → verify PID → `wmic process where "ProcessId=XXX" get CommandLine`
