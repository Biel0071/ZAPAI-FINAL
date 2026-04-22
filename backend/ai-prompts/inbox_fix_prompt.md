# Inbox Stabilization Prompt

Analyze the full Inbox data flow and apply targeted, non-breaking fixes.

Goals:
- Keep all existing features active (no removals).
- Stabilize media upload and send (image, video, audio, document).
- Prevent ENOENT and path resolution errors for temp media files.
- Ensure socket events keep conversation list and message thread synchronized.
- Guarantee message send reliability with optimistic UI + server reconciliation.
- Fix refresh/reload behavior so history and unread counters remain consistent.

Scope:
- Backend: routes, controllers, services and media temp directory handling.
- Frontend: Inbox page state flow, retry/fallback strategy, socket listeners and dedup.

Execution checklist:
1. Map all send/receive/media endpoints and emitted socket events.
2. Validate media path creation and cleanup strategy.
3. Enforce one normalization contract for realtime payloads.
4. Add defensive deduplication for optimistic and realtime messages.
5. Add smoke checks for send text, send media, receive sync, refresh consistency.

Acceptance criteria:
- Sending text and media succeeds consistently.
- No ENOENT in media send path.
- No duplicated message rows after realtime updates.
- Reloading Inbox preserves expected conversation/message state.
