# Skill Taxonomy — skill-global

**Version:** 1.0.0  
**Package:** `skill-global`  

---

## 🏛 1. Core Universal Layer (20 Skills)

Core skills are 100% stack-agnostic and portable to any software project regardless of language, framework, database, or domain.

- `project-context`: Auto-detects project stack and minimizes LLM context window.
- `engineering-standards`: Enforces core discipline (`UNDERSTAND → CONTEXT → PLAN → IMPLEMENT → TEST → REVIEW`).
- `project-hygiene`: Enforces workspace root cleanliness and artifact classification into `outros/` (or equivalent).
- `brainstorming`: Divergent thinking and option exploration before planning.
- `architect`: Structural design, dependency evaluation, ADR creation.
- `developer`: Plan-driven implementation adhering strictly to approved specifications.
- `debugger`: Root cause analysis (`REPRODUCE → TRACE → HYPOTHESIS → FIX → VERIFY`).
- `tester`: TDD, unit tests, integration tests, E2E assertion coverage.
- `reviewer`: Quality, readability, complexity, and duplicate code review.
- `karpathy`: Code minimization and elimination of premature abstraction.
- `autonomous-improvement`: Karpathy ratchet loop for continuous experimental enhancement.
- `security`: Universal OWASP checks, tenant data isolation, JWT/token verification, secret protection.
- `performance`: Memory, CPU, query, and bundle optimization guidelines.
- `devops`: Universal deployment rules for Docker, Kubernetes, PM2, systemd, Nginx, cloud providers.
- `release`: Version bump and CHANGELOG preparation (Zero auto-deploy).
- `documentation`: Technical documentation, README, and API contract maintenance.
- `database`: Universal schema design, migrations, query safety, and indexing.
- `qa`: Universal QA suite execution and test runner orchestration.
- `orchestrator`: Intent routing and minimal skill loading.

---

## 🔌 2. Domain Packs (`skill-global/domain-packs/`)

Domain packs contain specialized skills loaded ONLY when their specific domain/technology is detected in a target project.

```
domain-packs/
├── analytics/     ← Metric design, dashboards, heatmaps (loaded when charting/analytics detected)
├── graphify/      ← Codebase graph dependency mapping (loaded when graphify is detected)
└── whatsapp/      ← Baileys/WhatsApp multi-device integration (loaded when WhatsApp dependencies detected)
```

---

## 🎯 3. Project-Specific Skills (`.agents/skills/`)

Projects consuming `skill-global` may define custom skills specific to their internal business domain without polluting the universal core package.
