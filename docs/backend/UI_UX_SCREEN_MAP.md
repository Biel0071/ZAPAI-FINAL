# UI UX SCREEN MAP

## Product Navigation Hierarchy

```text
App Shell
- Dashboard
- Inbox
  - Conversation Thread
  - Message Composer
  - Conversation Details
- Contacts
  - Contacts List
  - Contact Profile
- Campaigns
  - Campaign List
  - Campaign Builder
  - Campaign Execution View
- Automation
  - Flows List
  - Flow Builder
- Analytics
  - KPI Overview
  - Funnel and Performance Views
- AI Settings
  - AI Status
  - Prompt and Memory
  - AI Agents
- System Settings
  - Sessions and Runtime
  - Business Hours
  - Diagnostics and Logs
```

## Screen Definitions

## Dashboard

Purpose:
- Provide operational overview of CRM and WhatsApp runtime.

Main UI components:
- KPI cards.
- Recent conversations panel.
- Runtime status panel.
- Alerts/health widgets.

User actions:
- Open inbox conversations.
- Jump to analytics or settings.
- Trigger quick system checks.

Required backend APIs:
- `GET /api/analytics`
- `GET /health`
- `GET /system/status`
- `GET /runtime/status`

Realtime interactions:
- Live KPI refresh after message/campaign events.
- Runtime status updates.

## Inbox

Purpose:
- Central workspace for customer messaging and conversation handling.

Main UI components:
- ConversationList.
- ChatWindow.
- Composer (text/media).
- Conversation metadata drawer.

User actions:
- Send message and media.
- Mark conversation as read.
- Save or clear conversation draft.
- Toggle AI for conversation.

Required backend APIs:
- `GET /conversations`
- `GET /conversations/:conversationId/messages`
- `GET /conversations/:conversationId/draft`
- `POST /conversations/:conversationId/draft`
- `DELETE /conversations/:conversationId/draft`
- `POST /conversations/:conversationId/read`
- `PATCH /conversations/:phone/ai`
- `POST /send-message`
- `POST /send-media`

Realtime interactions:
- New inbound/outbound message push.
- Conversation preview and unread counter updates.

## Contacts

Purpose:
- Manage contact records and contact-centric context for CRM actions.

Main UI components:
- Contacts table/list.
- Search and filters.
- ContactCard / profile detail panel.

User actions:
- Browse contacts.
- Inspect contact profile and related conversations.

Required backend APIs:
- `GET /api/contacts`
- `GET /api/leads`
- `GET /api/leads/:id`

Realtime interactions:
- Contact activity indicator from message events.

## Campaigns

Purpose:
- Create, launch, and monitor broadcast campaigns.

Main UI components:
- Campaign list.
- CampaignBuilder form.
- Campaign progress panel.

User actions:
- Create campaign.
- Start campaign.
- Monitor campaign performance.

Required backend APIs:
- `GET /api/campaigns`
- `POST /api/campaigns`
- `POST /api/campaigns/:id/start`

Realtime interactions:
- Campaign progress and status updates.
- Delivery/reply counters update while running.

## Automation

Purpose:
- Build and operate workflow automations.

Main UI components:
- Flow list.
- AutomationBuilder canvas.
- Trigger/action configuration panel.

User actions:
- Create flow.
- Activate and monitor automations.

Required backend APIs:
- `GET /api/flows`
- `POST /api/flows`
- `POST /queue/process` (operational execution endpoint)

Realtime interactions:
- Trigger execution status.
- Flow run logs and alerts.

## Analytics

Purpose:
- Visualize operational, conversion, and messaging performance.

Main UI components:
- KPI summary cards.
- AnalyticsCharts (timeseries/funnel).
- Segment filters.

User actions:
- Filter date range and segment.
- Compare campaign/conversation performance.

Required backend APIs:
- `GET /api/analytics`
- `GET /ai/learning/dashboard` (AI learning insights view)

Realtime interactions:
- Near realtime metric updates from messaging/campaign events.

## AI Settings

Purpose:
- Configure and monitor AI behavior across CRM and ZAPAI ENGINE integration.

Main UI components:
- AI status toggle panel.
- Prompt editor.
- Memory editor.
- AI agents manager.

User actions:
- Enable/disable AI.
- Update prompt and memory.
- Create/update/toggle AI agents.
- Run diagnostics.

Required backend APIs:
- `POST /ai/enable`
- `POST /ai/disable`
- `POST /ai/toggle`
- `GET /ai/status`
- `GET /ai/prompt`
- `POST /ai/prompt`
- `GET /ai/memory`
- `POST /ai/memory`
- `GET /config/ai-agents`
- `POST /config/ai-agents`
- `PUT /config/ai-agents/:key`
- `PATCH /config/ai-agents/:key/active`
- `GET /ai/system-diagnostics`

Realtime interactions:
- AI status and diagnostics refresh.
- Optional live tracing for AI replies.

## System Settings

Purpose:
- Operate runtime sessions, infrastructure status, and global business settings.

Main UI components:
- Session control panel.
- Runtime logs view.
- Business hours and absence message editor.
- System diagnostics panels.

User actions:
- Start/stop/restart sessions.
- Inspect QR/session status.
- Configure business hours.
- Restart ngrok and clear runtime logs.

Required backend APIs:
- `POST /session/start`
- `POST /session/restart`
- `POST /session/logout`
- `GET /sessions`
- `GET /sessions/status`
- `GET /sessions/qr`
- `POST /start`
- `POST /stop`
- `GET /status`
- `GET /runtime/status`
- `GET /runtime/debug`
- `POST /runtime/restart-ngrok`
- `GET /runtime/logs`
- `DELETE /runtime/logs`
- `GET /config/business-hours`
- `POST /config/business-hours`
- `GET /config/absence-message`
- `POST /config/absence-message`

Realtime interactions:
- Session connectivity changes.
- Runtime status changes and alerts.

## Navigation Relationships

Primary relationships:
- Dashboard links to Inbox, Analytics, and System Settings.
- Inbox links to Contacts and conversation-level AI actions.
- Campaigns and Automation are tightly related through trigger/action operations.
- AI Settings influences Inbox behavior directly (auto-reply).
- System Settings affects all runtime-dependent screens.

Navigation model:
- Global left navigation for primary modules.
- Secondary tabs inside Inbox, Campaigns, and Settings.
- Context side panels for detail/edit operations.

## UX Principles For AI-Generated Screens

- Preserve API contracts already implemented by backend routes.
- Treat Inbox as realtime-first experience.
- Keep campaign/automation operations resilient and observable.
- Prefer explicit loading, empty, and degraded states for runtime outages.
- Keep AI controls transparent and reversible for operators.
