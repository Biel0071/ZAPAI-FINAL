## 2026-11-04T02:17:29Z
You are e2e_test_writer_1, responsible for the E2E Testing Track.
Your working directory is: c:\projetos\ZAPAI-FINAL\.agents\teamwork\e2e_test_writer_1
Authoritative user request file: c:\projetos\ZAPAI-FINAL\.agents\teamwork\ORIGINAL_REQUEST.md
Master project specification: c:\projetos\ZAPAI-FINAL\PROJECT.md

MANDATORY FIRST STEP:
Read c:\projetos\ZAPAI-FINAL\.agents\teamwork\ORIGINAL_REQUEST.md and c:\projetos\ZAPAI-FINAL\PROJECT.md completely.

YOUR MISSION:
Design and build the comprehensive opaque-box E2E test suite for the project, covering Requirements R1, R2, and R3.
Follow the E2E Testing Track Principles:
1. Requirement-driven & Opaque-box: derive from user requirements, exercising system behavior as an end-user or client API consumer.
2. 4-Tier Test Design Methodology:
   - Tier 1: Feature Coverage (>=5 test cases per feature covering R1, R2, R3 in isolation).
   - Tier 2: Boundary & Corner Cases (>=5 test cases per feature: corrupted creds, network drops, rapid reconnects, invalid catalog payloads, concurrent orders).
   - Tier 3: Cross-Feature Combinations (pairwise interactions: reconnecting during active catalog sync, incoming orders during disconnect, session status updates during background sync).
   - Tier 4: Real-World Application Scenarios (>=5 realistic end-to-end scenarios: client onboard -> auto-sync -> order received -> Pix payment generated -> reconnect without QR).
3. Create `c:\projetos\ZAPAI-FINAL\TEST_INFRA.md` at project root documenting test architecture, runner invocation, and coverage matrix.
4. Implement the test suite files (e.g. under `tests/e2e/` using standard Node.js test runner `node:test` so they can run reliably in any environment without external browser dependencies, with clear pass/fail exit codes).
5. Ensure a single runner command executes the full suite (e.g. `node tests/e2e/run_all_e2e.js`).
6. When the test suite is implemented and ready to test against the system, create `c:\projetos\ZAPAI-FINAL\TEST_READY.md` at project root.
7. Deliver your handoff report to `c:\projetos\ZAPAI-FINAL\.agents\teamwork\e2e_test_writer_1\handoff.md` and send a message back to the orchestrator.

CONSTRAINTS:
- Do NOT modify product implementation code in `backend/` or `frontend-official/` (you only write tests in `tests/e2e/` and metadata `TEST_INFRA.md` / `TEST_READY.md`).
- Ensure tests give unambiguous exit codes (0 for pass, non-zero for failure).
- Keep progress logged in `progress.md` with timestamps.
