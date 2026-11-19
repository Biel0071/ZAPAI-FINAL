# Dispatch for Survey Explorer 2

- Working directory: c:\projetos\ZAPAI-FINAL\.agents\teamwork\explorer_survey_2
- Authoritative User Request: c:\projetos\ZAPAI-FINAL\.agents\teamwork\ORIGINAL_REQUEST.md
- Scope: R2 - Silent Automatic Background Synchronization
## 2026-11-04T01:46:31Z
Sender: 3265ab63-b153-484a-b6d7-740defe3b059
Priority: MESSAGE_PRIORITY_HIGH
Content:
You are explorer_survey_2, a read-only exploration agent.
Your working directory is: c:\projetos\ZAPAI-FINAL\.agents\teamwork\explorer_survey_2
Authoritative user request file: c:\projetos\ZAPAI-FINAL\.agents\teamwork\ORIGINAL_REQUEST.md

MANDATORY FIRST STEP:
Read c:\projetos\ZAPAI-FINAL\.agents\teamwork\ORIGINAL_REQUEST.md completely.

YOUR MISSION:
Map and investigate all aspects of Requirement R2: Silent Automatic Background Synchronization.
Specifically investigate:
1. All occurrences across the frontend UI of manual sync elements: sync buttons, "Sincronizar", sync modals, manual sync dialogs, progress overlays, sync spinners, and prompt banners (search across pages like Catalog, Products, Orders, Billing, Settings, Instances, Dashboard, etc.).
2. WhatsApp business data synchronization architecture:
   - Catalog products/collections sync from WhatsApp / Baileys APIs (`getWhatsAppCatalog`, `getProducts`, etc.).
   - Order history and generated orders sync from WhatsApp interactions.
   - Billing and payment data sync associated with WhatsApp instances.
3. How data synchronization is currently triggered and executed in backend services, controllers, workers, or queues.
4. How to transition completely from manual UI-triggered sync to silent, non-blocking, automatic background sync triggered upon WhatsApp instance connection.
5. Real-time updates: How background sync results and incoming WhatsApp updates populate PostgreSQL/Prisma database models and stream to the frontend in real time without requiring manual page reloads or UI blocking.

CONSTRAINTS:
- Do NOT write or modify application code. You are read-only.
- Document concrete file paths, line numbers, function names, and architecture diagrams.
- Write your comprehensive findings to c:\projetos\ZAPAI-FINAL\.agents\teamwork\explorer_survey_2\survey_report.md
- Write a structured handoff to c:\projetos\ZAPAI-FINAL\.agents\teamwork\explorer_survey_2\handoff.md following the standard Handoff Protocol (Observation, Logic Chain, Caveats, Conclusion, Verification Method).
- Send a completion message via send_message to the orchestrator when finished.
