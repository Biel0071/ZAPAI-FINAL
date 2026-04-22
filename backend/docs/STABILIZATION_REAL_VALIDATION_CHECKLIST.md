# Stabilization Real Validation Checklist

Use this checklist right after session status changes from qr to connected.

## Preconditions

- [ ] API is running and healthy: GET /health returns status ok.
- [ ] Session is connected: GET /sessions/status returns status connected and connected true.
- [ ] AI engine is enabled: POST /ai/enable returns success.
- [ ] Frontend Inbox is open and websocket is connected.

## Run Smoke Script First

Command:

```bash
npm run test:stabilization
```

Optional (if server is on 4010):

```bash
npm run test:stabilization:4010
```

Optional live outbound validation:

Windows PowerShell:

```powershell
$env:SMOKE_REAL_PHONE='55DDDNXXXXXXXX'
npm run test:stabilization
```

Pass criteria:

- No FAIL in summary.
- SKIP only allowed for live outbound when no SMOKE_REAL_PHONE was provided.

## Real End-to-End Validation (Manual)

### 1. Incoming real WhatsApp -> persist + realtime

- [ ] Send a real inbound WhatsApp message from an external phone.
- [ ] Confirm conversation appears/updates in Inbox list.
- [ ] Confirm message appears in chat panel.
- [ ] Confirm unread and lastMessage update.

### 2. Decision action behavior

- [ ] Send greeting message (example: oi) and confirm trigger_flow greeting behavior.
- [ ] Send price request (example: quanto custa) and confirm trigger_flow price behavior.
- [ ] Send support request (example: preciso de suporte) and confirm escalate behavior.
- [ ] Confirm acknowledgement-only message does not trigger unnecessary response.

### 3. Human takeover simulation

- [ ] Click Assumir humano in Inbox.
- [ ] Confirm conversation badge shows Humano ativo.
- [ ] Send inbound user message while human is active and confirm AI does not auto reply.

### 4. AI resume simulation

- [ ] Click Retomar IA in Inbox.
- [ ] Confirm conversation badge returns to IA ativa.
- [ ] Send inbound user message and confirm AI pipeline resumes normal behavior.

### 5. Outbound real message check

- [ ] Send message from Inbox to real phone.
- [ ] Confirm WhatsApp recipient receives message.
- [ ] Confirm outgoing message is persisted and visible in conversation history.

### 6. Guardrails and resilience

- [ ] Repeat same inbound text quickly and confirm duplicate response blocking behavior.
- [ ] Force a temporary AI failure scenario and confirm fallback handling without crash.
- [ ] Confirm API remains responsive and no unhandled exception occurs.

## Evidence to Capture

- [ ] Smoke test terminal output summary.
- [ ] Session status snapshot from /sessions/status.
- [ ] Example conversation runtime snapshot from /conversations/:id/runtime.
- [ ] Screenshot of Inbox states: IA ativa, IA pausada, Humano ativo.

## Final Sign-off Rule

Production-ready stabilization only if:

- [ ] Smoke script has zero FAIL.
- [ ] Real end-to-end checks above are all completed.
- [ ] No blocking error in logs during validation window.
