# Context Efficiency & Progressive Disclosure Strategy — skill-global

**Version:** 1.0.0  
**Package:** `skill-global`  

---

## 🎯 Core Objective

Prevent AI agents from loading the entire repository or dumping 100+ prompt instructions into LLM context windows simultaneously.

---

## 📐 Progressive Disclosure Architecture

```
1. INTENT MATCHING (Frontmatter Metadata Only)
   → Read YAML frontmatter (name & description) of skills
   → Matches prompt intent (e.g. "auth bug" → debugger, security, developer, tester, reviewer)

2. ON-DEMAND SKILL LOADING (Targeted SKILL.md)
   → Load ONLY matched SKILL.md files (max 5 skills per session)
   → Parse rules, workflow, and action checklists

3. LAZY-LOADED RESOURCES (References & Scripts)
   → Load detailed technical documentation from references/ ONLY when explicitly required
   → Execute helper scripts from scripts/ ONLY during execution steps
```

---

## 🛡 Token Minimization Rules

1. **Max 5 Active Skills**: Never load more than 5 skills into an active conversation context.
2. **Zero Global Dumps**: Never load full repository files during initialization.
3. **Selective File Inspection**: Read max 5 targeted files per investigative step.
4. **Isolated Memory**: Keep scratch outputs and intermediate execution logs in dedicated directories (`outros/temp/`, `outros/diagnostics/`).
