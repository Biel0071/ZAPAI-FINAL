## 2026-11-04T01:44:49Z

Make the system fully functional and ready for production by stabilizing WhatsApp session connections, eliminating all sync UI and prompts in favor of automatic background synchronization of real data (catalog, orders, billing), and executing general performance optimization and system polish.

Integrity mode: development

## Requirements

### R1. WhatsApp Session Instantiation and Connection Stability
Stabilize WhatsApp session connections and lifecycle management (auto-reconnection, session persistence, QR code and status handling via Baileys) so that connections remain reliable and functional for real production use.

### R2. Silent Automatic Background Synchronization
Remove all sync buttons, modals, and manual sync prompts from the user interface. When an instance connects, automatically synchronize real data in the background, including catalog items, generated orders, and billing data from the logged WhatsApp instance.

### R3. Performance Optimization and Production Polish
Identify and resolve bottlenecks to improve overall system speed and responsiveness. Polish workflows and edge cases across the application to bring the system to full production quality.

## Acceptance Criteria

### Session & Connection Reliability
- [ ] WhatsApp instance session connects and stays connected without unexpected drops; disconnects trigger automatic reconnection.
- [ ] Session credentials and state persist across application restarts without requiring QR re-scanning unless the session is explicitly revoked.
- [ ] Session connection states (connecting, connected, disconnected, QR ready) reflect accurately in real time.

### Silent Background Sync
- [ ] No manual sync buttons, modals, or sync progress overlays appear in the user interface.
- [ ] Upon instance connection, catalog items, generated orders, and billing data are automatically fetched and persisted with real data without blocking user interaction.
- [ ] Real-time updates and incoming data from the connected WhatsApp session populate the database and relevant UI views automatically.

### System Speed & Production Polish
- [ ] Critical user-facing routes and WhatsApp session management actions execute with no UI freezing or unhandled promise rejections.
- [ ] All existing automated tests in the repository pass without regressions.

## Verification Resources
- Existing automated test suites, type checks, and local verification commands within the repository (`npm test`, build checks, and linting).
