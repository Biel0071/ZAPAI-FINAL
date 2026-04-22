# BACKEND SYSTEM MAP

## Backend Modules

## Messaging Module

Responsibilities:
- Inbound and outbound message processing.
- Media send and media path normalization.
- Message persistence and realtime delivery updates.

Services:
- `services/messageService.js`
- `services/whatsappService.js`
- `services/messagingService.js`
- `services/messageAuditService.js`

Repositories:
- `repositories/messageRepository.js`
- `repositories/conversationRepository.js` (conversation updates during message events)

Routes:
- `routes/messages.js`
  - `GET /chats`
  - `GET /chats/:chatId/messages`
  - `GET /messages/by-phone/:phone`
  - `GET /messages/:conversationId`
  - `POST /messages`
  - `POST /send-message`
  - `POST /send-media`
  - `POST /receive-message`

Events:
- `message:new`
- `new_message`
- `conversation:update`

## Conversations Module

Responsibilities:
- Conversation CRUD and listing.
- Message timeline retrieval by conversation.
- Draft management and read/unread state transitions.
- AI enabled flag per conversation.

Services:
- `services/conversationService.js`
- `services/conversationSummarizer.js`

Repositories:
- `repositories/conversationRepository.js`
- `repositories/messageRepository.js`

Routes:
- `routes/conversations.js`
  - `POST /conversations`
  - `GET /conversations`
  - `GET /conversations/:conversationId/messages`
  - `GET /conversations/:conversationId/draft`
  - `POST /conversations/:conversationId/draft`
  - `DELETE /conversations/:conversationId/draft`
  - `POST /conversations/:conversationId/read`
  - `PATCH /conversations/:phone/ai`

Events:
- `conversation:update`
- `conversation_updated`

## Contacts Module

Responsibilities:
- Contact listing and retrieval for CRM workflows.
- Contact lookup support for messaging and conversation enrichment.

Services:
- `services/contactsService.js`

Repositories:
- `repositories/contactRepository.js`

Routes:
- `routes/contacts.js`
  - `GET /api/contacts`

Events:
- Mostly consumed through conversation/message updates.
- Optional contact refresh events can be added in realtime layer.

## Campaigns Module

Responsibilities:
- Campaign definition lifecycle.
- Campaign start/run behavior.
- Lead or segment-oriented broadcast logic.

Services:
- `services/campaignEngine.js`
- `services/campaignRuntime.js`
- `services/campaignService.js`

Repositories:
- Campaign persistence is currently service/runtime-centered; repository abstraction is a recommended next step.

Routes:
- `routes/automation.js`
  - `GET /api/campaigns`
  - `POST /api/campaigns`
  - `POST /api/campaigns/:id/start`

Events:
- Campaign progress/status events are expected through realtime compatibility layer.

## Automation Module

Responsibilities:
- Flow definitions and automation trigger execution.
- Microtask and runtime automation orchestration.

Services:
- `services/automationService.js`
- `services/microtaskRunner.js`

Repositories:
- Flow and automation persistence is currently service-driven.

Routes:
- `routes/automation.js`
  - `GET /api/flows`
  - `POST /api/flows`

Events:
- Trigger outcomes and automation state updates should be emitted for UI observability.

## Analytics Module

Responsibilities:
- KPI summary for CRM operations.
- Message, conversation, and campaign metrics exposure.

Services:
- `services/analyticsService.js`
- `services/metricsTracker.js`

Repositories:
- Analytics reads aggregate from existing CRM repositories and runtime snapshots.

Routes:
- `routes/analytics.js`
  - `GET /api/analytics`

Events:
- Analytics refresh events are driven by runtime updates and message/campaign activity.

## AI Integration Module

Responsibilities:
- Stable AI contract for CRM flows.
- Prompt/context composition and AI call orchestration.
- Compatibility integration with extracted ZAPAI ENGINE.

Services:
- `services/aiResponseEngine.js`
- `ai/integration/engineClient.js`

Repositories:
- `repositories/systemSettingsRepository.js` (AI config-related settings)

Routes:
- `routes/ai.js` (AI operations, diagnostics, generation, status)
- `routes/aiConfig.js` (AI memory, business hours, advanced AI, AI agents)

Events:
- AI-driven outbound messaging reuses messaging realtime events.
- Diagnostic and status updates can be surfaced via system/realtime channels.

## Event Flow Between Modules

1. Incoming message event
- Messaging receives and persists message.
- Conversations updates last-message metadata.
- Contacts may be created or enriched.
- Analytics counters are updated.
- AI integration may generate auto-reply based on conversation state.

2. AI auto-reply event
- AI Integration returns response text.
- Messaging sends and persists outbound response.
- Conversations updates timeline and unread/read metrics.
- Realtime notifies inbox and conversation views.

3. Campaign trigger event
- Campaigns module selects recipients.
- Messaging module sends broadcast messages.
- Conversations and analytics update from delivery/reply outcomes.
- Automation may enqueue follow-up actions.

4. Automation trigger event
- Automation evaluates flow condition.
- Can call Messaging, Campaigns, and AI Integration.
- Realtime and analytics reflect action outcomes.

## Summary

This backend uses stable route contracts with progressive modularization layers. The safest path for evolution is to keep controllers/routes intact and move logic behind module/service/realtime/worker boundaries incrementally.
