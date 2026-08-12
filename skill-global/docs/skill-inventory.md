# Inventory of Canonical Skills — skill-global

**Version:** 1.0.0  
**Package:** `skill-global`  
**Location:** `skill-global/.agents/skills/`  

---

## 📋 Core Canonical Skills (Universal Layer)

| # | Skill Name | Category | Trigger / Purpose | Frontmatter Verified |
|---|------------|----------|-------------------|----------------------|
| 1 | `project-context` | Context | Stack detection, dependencies scanning, context minimization | ✅ YES |
| 2 | `engineering-standards` | Standards | Core engineering flow: UNDERSTAND → CONTEXT → PLAN → IMPLEMENT → TEST → REVIEW | ✅ YES |
| 3 | `brainstorming` | Strategy | Divergent thinking before planning | ✅ YES |
| 4 | `architect` | Architecture | Architectural analysis, modularization, ADR creation | ✅ YES |
| 5 | `developer` | Implementation | Plan-driven code implementation | ✅ YES |
| 6 | `debugger` | Analysis | Root cause analysis (REPRODUCE → OBSERVE → TRACE → HYPOTHESIS → FIX → TEST → VERIFY) | ✅ YES |
| 7 | `tester` | Quality | TDD, unit testing, integration tests, E2E | ✅ YES |
| 8 | `reviewer` | Quality | Code review, readability, duplication check | ✅ YES |
| 9 | `security` | Security | OWASP, multi-tenant isolation, SQL injection, JWT, secret protection | ✅ YES |
| 10 | `performance` | Optimization | Memory, CPU, latency, query profiling | ✅ YES |
| 11 | `database` | Storage | Schema design, migrations, query optimization | ✅ YES |
| 12 | `analytics` | BI / Metrics | Metric design, dashboards, heatmaps | ✅ YES |
| 13 | `automation` | Workflows | Background queues, workers, crons, webhooks | ✅ YES |
| 14 | `documentation` | Docs | Documentation maintenance, README, API contracts | ✅ YES |
| 15 | `devops` | Infrastructure | Docker, PM2, Nginx, SSL, health checks | ✅ YES |
| 16 | `release` | Release | Release preparation, CHANGELOG, version bump (Zero auto-deploy) | ✅ YES |
| 17 | `project-hygiene` | Hygiene | Root directory cleanliness, `outros/` classification rules | ✅ YES |
| 18 | `autonomous-improvement` | Optimization | Karpathy ratchet loop (OBSERVE → BASELINE → HYPOTHESIS → MEASURE → KEEP/REVERT) | ✅ YES |
| 19 | `orchestrator` | Orchestration | Intent detection and minimal skill loading | ✅ YES |
| 20 | `karpathy` | Simplicity | Code minimization, eliminating premature abstraction | ✅ YES |

---

## 🔌 Extended Domain Skills (Optional Integration Layer)

| # | Skill Name | Category | Trigger / Purpose | Frontmatter Verified |
|---|------------|----------|-------------------|----------------------|
| 21 | `graphify` | Tooling | Dependency mapping & structural graph querying | ✅ YES |
| 22 | `qa` | Testing | Full QA suite execution and report generation | ✅ YES |
| 23 | `whatsapp` | Integration | WhatsApp / Baileys multi-device protocol integration | ✅ YES |

---

## 🔒 Frontmatter Standard

All skills conform strictly to the Open Agent Skills Spec:
```yaml
---
name: <skill-name>
description: <concise trigger description for AI agent matching>
---
```
