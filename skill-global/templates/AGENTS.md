# Project Agent Instructions & Engineering Layer

This project uses the **ZapFlow Engineering Pack** to orchestrate AI agent skills, workflows, and standards.

## Core Rules

1. **Understand Before Coding**: Always inspect existing architecture, codebase structure, and `project-profile.json` before writing code.
2. **Context Minimization**: Load only the specific skills needed for the task intent (e.g. Debugger + Developer + Tester for bugfixes). Do not read the entire repository unnecessarily.
3. **Multi-Agent Pipeline**:
   ```
   REQUIREMENT → BRAINSTORM → ARCHITECT → PLAN → DEVELOPER → TESTER → REVIEWER → VALIDATE → RELEASE
   ```
4. **Project Hygiene**: Never pollute the project root with temporary or diagnostic files. Follow `.agents/skills/project-hygiene/SKILL.md`.
5. **No Destructive Operations**: Never modify environment secrets (`.env`), SSH keys, credentials, or execute unvalidated production deploys automatically.
