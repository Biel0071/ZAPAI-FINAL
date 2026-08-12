# Changelog — skill-global

All notable changes to the `skill-global` universal engineering pack will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-08-11

### Added
- **Canonical Skill Registries**: Integrated 23 core canonical skills into `.agents/skills/`.
- **Native Agents**: Added 7 agent specifications (`architect`, `developer`, `debugger`, `tester`, `reviewer`, `security`, `release`).
- **Orchestration Engine**: Pipeline routing and intent matching rules (`.agents/rules/orchestrator.md`).
- **Multi-Agent Adapters**: Adapters for Claude Code, Google Antigravity, OpenAI Codex, Gemini CLI, and Qwen Code.
- **Auto-Stack Detector**: Automatic project stack, frameworks, database, ORM, and testing tool detector (`installer/detector.js`).
- **CLI Executable**: Cross-platform CLI binary (`bin/skill-global.js`) with `install`, `update`, `audit`, `verify`, `doctor`, `list`, `remove`, `portable`, `version` commands.
- **Security & Lockfile Engine**: SHA-256 hash generation and lockfile verification (`.zapflow/lock.json`, `.zapflow/policy.json`).
- **Test Suite**: Automated unit and integration test runner (`tests/test-runner.js`).
