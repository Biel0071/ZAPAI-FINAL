# ZapAI CRM System Architecture Map

Generated modular map focused on preserved features and progressive modularization.

## Modules

### Inbox
- Frontend pages: Inbox.tsx, InboxModular.tsx
- Backend routes: routes/messages.js, routes/conversations.js
- Backend services: services/whatsappService.js, services/conversationSummarizer.js

### Contacts
- Frontend pages: Contacts.tsx
- Backend routes: routes/conversations.js
- Backend services: services/leadAnalyzer.js

### Automation
- Frontend pages: Flows.tsx, Campaigns.tsx, Scheduler.tsx
- Backend routes: routes/system.js
- Backend services: services/campaignEngine.js, services/campaignRuntime.js, services/microtaskRunner.js

### AI
- Frontend pages: AI.tsx, AIDashboard.tsx, ModuleBuilder.tsx
- Backend routes: routes/ai.js
- Backend services: services/aiResponseEngine.js, services/aiLearningEngine.js
- Backend AI core: ai/featureEngine.js, ai/devCore.js

### Analytics
- Frontend pages: Analytics.tsx, Diagnostics.tsx
- Backend routes: routes/system.js
- Backend services: services/metricsTracker.js, services/aiDiagnosticsService.js

### System
- Frontend pages: Settings.tsx, Connections.tsx
- Backend routes: routes/system.js, routes/sessions.js
- Backend services: services/systemManager.js, services/sessionManager.js, services/runtimeManager.js

## Registry Layer
- Core registry file: core/moduleRegistry.js
- Persistence: data/module_registry.json
- Registry responsibilities:
  - Routes registration
  - Navigation registration
  - API endpoints registration

## Development Core
- Feature generation: ai/featureEngine.js
- Project evolution core: ai/devCore.js
- Dashboard integration: pages/AIDashboard.tsx
- Visual builder: pages/ModuleBuilder.tsx
