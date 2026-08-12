# skill-global

> Universal, Stack-Agnostic AI Agent Engineering Layer & Skill Registry.

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](VERSION)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

---

## 🌟 Overview

**`skill-global`** is an independent, portable engineering layer designed to sit between any software project codebase and AI coding agents (`Claude Code`, `Google Antigravity`, `OpenAI Codex`, `Gemini CLI`, `Qwen Code`).

It equips AI agents with a canonical skill registry, agent personas, intent orchestrator, stack detector, and lockfile security engine.

---

## 🚀 Quick Start

### 1. Global Installation & Execution via NPX

```bash
# Run installer in any project
npx skill-global install

# Global installation (optional)
npm install -g skill-global
skill-global install
```

### 2. Project-Level Installation

```bash
# Add to your project
npm install --save-dev skill-global

# Execute commands
npx skill-global install
```

---

## ⚙️ CLI Commands (`skill-global`)

```bash
skill-global install        # Detect project stack, deploy canonical skills, sync adapters, generate lockfile
skill-global update         # Update skills safely without overwriting custom local edits
skill-global uninstall      # Cleanly remove installed skills and project metadata
skill-global doctor         # Environmental healthcheck (Node, Git, Agents, Locks)
skill-global audit          # Security audit: check dangerous root artifacts, missing metadata, secrets
skill-global verify         # Recalculate SHA-256 hashes against lockfile
skill-global list           # Display all installed skills, agents, and adapter statuses
skill-global remove <name>  # Safely remove a specific skill
skill-global portable       # Export air-gapped JSON bundle
skill-global version        # Show version
```

---

## 🏗 Architecture

```
skill-global/
├── .agents/
│   ├── skills/              ← SOURCE OF TRUTH (.agents/skills/<name>/SKILL.md)
│   ├── agents/              ← Personas (architect, developer, debugger, tester, reviewer, security, release)
│   └── rules/               ← Pipeline Orchestration rules
├── adapters/                ← Multi-agent compatibility adapters
│   ├── claude/              ← Claude Code / Desktop adapter (.claude/skills)
│   ├── antigravity/         ← Google Antigravity adapter (.agents)
│   ├── codex/               ← OpenAI Codex adapter
│   ├── gemini/              ← Gemini CLI adapter
│   └── qwen/                ← Qwen Code adapter
├── installer/
│   ├── detector.js          ← Auto-stack & dependency detector
│   └── sync.js              ← Multi-agent synchronizer & lock generator
├── bin/
│   └── skill-global.js      ← Executable binary CLI
├── tests/                   ← Automated unit & integration test runner
├── templates/               ← Baseline project templates
├── CHANGELOG.md             ← SemVer version history
├── VERSION                  ← 1.0.0
└── README.md
```

---

## 🧠 Skills Registry (23 Canonical Skills)

| Skill | Purpose |
|-------|---------|
| `project-context` | Stack detection, dependency scanning, context minimization |
| `engineering-standards` | Core flow: UNDERSTAND → CONTEXT → PLAN → IMPLEMENT → TEST → REVIEW |
| `brainstorming` | Divergent thinking before planning |
| `architect` | System architecture design & ADR creation |
| `developer` | Plan-driven code implementation |
| `debugger` | Root cause analysis (REPRODUCE → TRACE → HYPOTHESIS → FIX → VERIFY) |
| `tester` | TDD, unit testing, integration tests, E2E |
| `reviewer` | Code review, readability, duplication check |
| `security` | Multi-tenant isolation, SQL injection, JWT, secret protection |
| `performance` | Memory, CPU, latency, query profiling |
| `database` | Schema design, migrations, query optimization |
| `analytics` | Metric design, dashboards, heatmaps |
| `automation` | Background queues, workers, crons, webhooks |
| `documentation` | Documentation maintenance, README, API contracts |
| `devops` | Docker, PM2, Nginx, SSL, health checks |
| `release` | Release preparation, CHANGELOG, version bump (Zero auto-deploy) |
| `project-hygiene` | Root directory cleanliness & artifact classification |
| `autonomous-improvement` | Karpathy ratchet loop (MEASURE → COMPARE → KEEP/REVERT) |
| `orchestrator` | Intent detection and minimal skill loading |
| `karpathy` | Code minimization, eliminating premature abstraction |
| `graphify` | Structural graph dependency mapping |
| `qa` | Full QA suite execution and report generation |
| `whatsapp` | WhatsApp / Baileys multi-device protocol integration |

---

## 🤖 Native Agent Personas

- **Architect**: Requirements analysis, system design, ADRs, risk evaluation.
- **Developer**: Implements features adhering strictly to approved plans.
- **Debugger**: Root cause analysis and reproducible fix verification.
- **Tester**: Test writing, coverage enforcement, regression testing.
- **Reviewer**: Quality, readability, complexity, and duplicate code review.
- **Security**: Secret safety, multi-tenant isolation, OWASP compliance.
- **Release**: Changelog, versioning, release preparation (Zero auto-deploy).

---

## ⚡ Orchestration & Intent Routing

```
REQUIREMENT → BRAINSTORM → ARCHITECT → PLAN → DEVELOPER → TESTER → REVIEWER → VALIDATE → RELEASE
```

The `orchestrator` detects user intent (e.g. "bug fix", "auth bug", "new feature") and loads **only the minimal set of required skills** (max 5 active skills per session).

---

## 📐 Progressive Disclosure Strategy

To minimize LLM token usage:
1. **Metadata Matching**: Reads YAML frontmatter (`name`, `description`) to match prompt intent.
2. **On-Demand Skill Loading**: Loads matching `SKILL.md` files only.
3. **Lazy-Loaded References**: Deep documentation in `references/` or scripts in `scripts/` are loaded only when invoked.

---

## 🔌 Multi-Agent Adapters

- **Claude Code**: Syncs canonical skills into `.claude/skills/`.
- **Google Antigravity**: Configures customizations and rules in `.agents/`.
- **OpenAI Codex**: Exposes skill registry and instruction prompts.
- **Gemini CLI**: Exposes skill definitions for Gemini CLI integration.
- **Qwen Code**: Exposes skill definitions for Qwen Code.

---

## 🔒 Security & Hygiene Policy

- **Protected Secrets**: Never auto-modifies `.env`, `.env.*`, `*.pem`, `*.key`, `.ssh/`, or credentials.
- **Root Cleanliness**: All non-production artifacts (reports, diagnostics, plans) are classified into `outros/` (or project equivalent).
- **No Auto-Deploy**: Production deployment requires explicit human authorization.

---

## 🧪 Testing

```bash
npm test
```
