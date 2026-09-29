# SYSTEM FLOWS

## Incoming WhatsApp Message

Trigger:
- New inbound WhatsApp payload from Baileys listener.

Backend modules involved:
- Messaging Module.
- Conversations Module.
- Contacts Module.
- AI Integration Module (conditional).
- Analytics Module.

Database interactions:
- Create message record.
- Find/create conversation.
- Find/create contact where needed.
- Update conversation metadata and unread state.

Realtime events:
- `message:new`
- `new_message`
- `conversation:update`

AI engine interaction:
- If AI is enabled and conversation allows AI, CRM requests AI response through `services/aiResponseEngine.js` -> `ai/integration/engineClient.js` -> ZAPAI ENGINE.

## Outgoing Message

Trigger:
- Manual send from Inbox UI or API request (`POST /send-message`, `POST /send-media`).

Backend modules involved:
- Messaging Module.
- Conversations Module.
- Analytics Module.

Database interactions:
- Persist outbound message.
- Update conversation last message/timestamps.

Realtime events:
- `message:new`
- `conversation:update`

AI engine interaction:
- None by default for manual send.

## AI Auto Response

Trigger:
- Eligible inbound message with AI enabled globally and per conversation.

Backend modules involved:
- AI Integration Module.
- Messaging Module.
- Conversations Module.
- Analytics Module.

Database interactions:
- Read conversation history for context.
- Persist outbound AI-generated message.
- Update conversation metadata after response.

Realtime events:
- Outbound message events through standard messaging channels.
- Conversation update events for inbox synchronization.

AI engine interaction:
- CRM sends `incoming_message` event payload to ZAPAI ENGINE process flow.
- Engine runtime resolves agent/provider/context and returns response text and optional actions.

## Campaign Broadcast

Trigger:
- Campaign start request (`POST /api/campaigns/:id/start`) or runtime scheduling.

Backend modules involved:
- Campaigns Module.
- Messaging Module.
- Conversations Module.
- Analytics Module.

Database interactions:
- Read campaign configuration.
- Resolve target audience.
- Persist outbound campaign messages.
- Update delivery/progress counters.

Realtime events:
- Campaign status/progress updates.
- Message and conversation updates as sends occur.

AI engine interaction:
- Optional for AI-personalized campaign content (future-safe integration path).

## Automation Trigger

Trigger:
- Flow condition match from incoming message, campaign outcome, or explicit flow execution endpoint.

Backend modules involved:
- Automation Module.
- Messaging Module.
- Campaigns Module.
- AI Integration Module (optional).
- Analytics Module.

Database interactions:
- Read flow definitions.
- Persist execution state and resulting actions when applicable.

Realtime events:
- Automation execution status.
- Follow-up message/conversation updates.

AI engine interaction:
- Optional AI call for decisioning or generated response actions.

## Conversation Assignment

Trigger:
- New conversation creation or operator workflow action.

Backend modules involved:
- Conversations Module.
- Contacts Module.
- Messaging Module.

Database interactions:
- Update conversation ownership/metadata fields.
- Track assignment updates in conversation record.

Realtime events:
- `conversation:update` to refresh operator inbox views.

AI engine interaction:
- Optional context update to route AI behavior by assignment metadata.

## Analytics Tracking

Trigger:
- Message events, campaign events, automation actions, and periodic runtime jobs.

Backend modules involved:
- Analytics Module.
- Messaging Module.
- Campaigns Module.
- Automation Module.
- System/Runtime services.

Database interactions:
- Read aggregate counts and operational snapshots.
- Update metric snapshots where configured.

Realtime events:
- KPI refresh notifications for dashboard and analytics screens.

AI engine interaction:
- AI learning diagnostics and insight endpoints may consume conversation/operation data.

## Cross-Flow Safety Constraints

- Do not break existing route contracts.
- Keep current socket event compatibility.
- Preserve fallback behavior for degraded DB/runtime states.
- Keep `services/aiResponseEngine.js` as compatibility facade to AI integration.
- Prefer idempotent updates for message and AI response persistence.
