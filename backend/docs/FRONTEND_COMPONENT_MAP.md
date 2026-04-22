# FRONTEND COMPONENT MAP

## Global Layout

Primary layout:
- `AppShell`
  - `TopBar`
  - `SideNav`
  - `MainContent`
  - `RightContextPanel` (optional contextual details)
  - `GlobalToasts`

Layout responsibilities:
- Route-level composition.
- Global loading and error boundaries.
- Cross-module quick actions and notifications.

## Navigation System

Core navigation components:
- `SideNav`
  - Dashboard
  - Inbox
  - Contacts
  - Campaigns
  - Automation
  - Analytics
  - AI Settings
  - System Settings
- `TopBar`
  - Session status indicator
  - Search and quick actions
  - User menu

Navigation behavior:
- Route-driven rendering in `MainContent`.
- Deep-link support for conversation and campaign detail pages.
- Breadcrumbs for nested builders.

## State Management

Recommended architecture:
- Server state: React Query (or equivalent) for API cache/fetch lifecycle.
- Realtime state: socket event reducer/store for live updates.
- UI state: local component state for transient interactions.
- Global app state: lightweight store for session/runtime and feature flags.

State domains:
- `inboxState`
- `contactsState`
- `campaignState`
- `automationState`
- `analyticsState`
- `aiSettingsState`
- `systemState`

Data flow rule:
- HTTP for baseline data.
- Socket events for incremental updates.
- Optimistic UI only where rollback is safe.

## UI Component Library

Foundation components:
- `PageLayout`
- `Card`
- `DataTable`
- `FormField`
- `Modal`
- `Drawer`
- `Tabs`
- `Badge`
- `StatusPill`
- `Toast`
- `Skeleton`
- `EmptyState`

Design system requirements:
- Consistent spacing, typography, and semantic colors.
- Accessible keyboard/focus behavior.
- Standardized loading, error, and empty variants.

## Core Components

## ChatWindow

Purpose:
- Render conversation timeline and message composition area.

Children:
- `MessageList`
- `MessageBubble`
- `AttachmentPreview`
- `MessageComposer`
- `TypingOrStatusIndicator`

Dependencies:
- Conversations APIs and messaging send APIs.
- Realtime events for new messages and conversation updates.

## ConversationList

Purpose:
- Show all conversations with status and unread counts.

Children:
- `ConversationListItem`
- `ConversationFilters`
- `ConversationSearch`

Dependencies:
- `GET /conversations`
- Realtime conversation and message update events.

## ContactCard

Purpose:
- Show compact contact identity and metadata.

Children:
- `Avatar`
- `ContactMeta`
- `ContactTags`
- `QuickActions`

Dependencies:
- Contacts API and related lead metadata APIs.

## CampaignBuilder

Purpose:
- Create or edit campaign definitions.

Children:
- `CampaignForm`
- `AudienceSelector`
- `SchedulePicker`
- `MessageTemplateEditor`

Dependencies:
- Campaign CRUD and start APIs.

## AutomationBuilder

Purpose:
- Build flow trigger/action logic.

Children:
- `FlowCanvas`
- `TriggerNodeEditor`
- `ActionNodeEditor`
- `FlowValidationPanel`

Dependencies:
- Flows APIs and operational queue/process endpoints.

## AnalyticsCharts

Purpose:
- Present KPI and trend visualizations.

Children:
- `KpiCardGrid`
- `TimeseriesChart`
- `FunnelChart`
- `SegmentFilterBar`

Dependencies:
- Analytics API and optional AI learning dashboard data.

## AISettingsPanel

Purpose:
- Manage AI status, prompt, memory, and agents.

Children:
- `AIStatusToggle`
- `PromptEditor`
- `MemoryEditor`
- `AgentList`
- `DiagnosticsPanel`

Dependencies:
- AI status/prompt/memory/agent APIs and diagnostics endpoints.

## Component Hierarchy and Relationships

```text
AppShell
- SideNav
- TopBar
- MainContent
  - DashboardPage
  - InboxPage
    - ConversationList
    - ChatWindow
    - ContactCard
  - ContactsPage
    - ContactsTable
    - ContactCard
  - CampaignsPage
    - CampaignBuilder
  - AutomationPage
    - AutomationBuilder
  - AnalyticsPage
    - AnalyticsCharts
  - AISettingsPage
    - AISettingsPanel
  - SystemSettingsPage
    - SessionControls
    - RuntimeDiagnostics
```

Relationship rules:
- `ConversationList` selects context for `ChatWindow`.
- `ContactCard` is reused in Inbox and Contacts.
- `CampaignBuilder` can reference segments created by Automation.
- `AISettingsPanel` impacts behavior of Inbox auto-response and diagnostics.

## Realtime Integration Pattern

Component subscription model:
- Page-level socket subscription in module containers.
- Dispatch normalized events into shared realtime state store.
- Child components read derived selectors, not raw socket payloads.

Safety rules:
- Deduplicate events by message ID/conversation ID.
- Keep idempotent reducers for duplicated alias events.
- Fallback to API refetch on event parse failure.
