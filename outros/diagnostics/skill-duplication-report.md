# Relatório de Duplicação e Divergência de Skills (Fase 9)

**Data:** 2026-08-11  
**Escopo:** `ZAPAI-FINAL/.claude/skills/` vs. `ZAPAI-FINAL/.agents/skills/` vs. `skill-global/.agents/skills/`  

---

## 🔍 Mapeamento e Classificação

### 1. Source of Truth Canônico Universal (`skill-global/.agents/skills/`)
Contém a definição master das 23 skills universais do pacote.
- `project-context`, `engineering-standards`, `brainstorming`, `architect`, `developer`, `debugger`, `tester`, `reviewer`, `security`, `performance`, `database`, `analytics`, `automation`, `documentation`, `devops`, `release`, `project-hygiene`, `autonomous-improvement`, `orchestrator`, `karpathy`, `graphify`, `qa`, `whatsapp`.

### 2. Integração do Consumidor (`ZAPAI-FINAL/.agents/skills/`)
Sincronizado via `skill-global install`. Mantido em sincronia idêntica de hashes SHA-256 validados no lockfile `.zapflow/lock.json`.

### 3. Adapters Ativos do Claude Code (`ZAPAI-FINAL/.claude/skills/`)
Contém cópias dos arquivos `SKILL.md` geradas dinamicamente pelo adapter `adapters/claude/` do `skill-global`.

---

## 📊 Matriz de Status e Divergência

| Skill Name | Canonical (`skill-global/.agents/skills`) | Consumer (`ZAPAI-FINAL/.agents/skills`) | Claude Adapter (`.claude/skills`) | Divergência Detectada |
|------------|------------------------------------------|-----------------------------------------|------------------------------------|----------------------|
| `architect` | ✅ v1.0.0 | ✅ Sincronizado | ✅ Adapter ativo | 🟢 Nenhuma (0 hash diff) |
| `security` | ✅ v1.0.0 | ✅ Sincronizado | ✅ Adapter ativo | 🟢 Nenhuma (0 hash diff) |
| `reviewer` | ✅ v1.0.0 | ✅ Sincronizado | ✅ Adapter ativo | 🟢 Nenhuma (0 hash diff) |
| `debugger` | ✅ v1.0.0 | ✅ Sincronizado | ✅ Adapter ativo | 🟢 Nenhuma (0 hash diff) |
| `developer` | ✅ v1.0.0 | ✅ Sincronizado | ✅ Adapter ativo | 🟢 Nenhuma (0 hash diff) |
| `tester` | ✅ v1.0.0 | ✅ Sincronizado | ✅ Adapter ativo | 🟢 Nenhuma (0 hash diff) |
| `release` | ✅ v1.0.0 | ✅ Sincronizado | ✅ Adapter ativo | 🟢 Nenhuma (0 hash diff) |
| `orchestrator` | ✅ v1.0.0 | ✅ Sincronizado | ✅ Adapter ativo | 🟢 Nenhuma (0 hash diff) |
| `project-hygiene` | ✅ v1.0.0 | ✅ Sincronizado | ✅ Adapter ativo | 🟢 Nenhuma (0 hash diff) |
| `autonomous-improvement` | ✅ v1.0.0 | ✅ Sincronizado | ✅ Adapter ativo | 🟢 Nenhuma (0 hash diff) |
| `engineering-standards` | ✅ v1.0.0 | ✅ Sincronizado | ✅ Adapter ativo | 🟢 Nenhuma (0 hash diff) |
| `project-context` | ✅ v1.0.0 | ✅ Sincronizado | ✅ Adapter ativo | 🟢 Nenhuma (0 hash diff) |

---

## 💡 Recomendação de Manutenção

- **Source of Truth**: Toda alteração de skill universal deve ser feita prioritariamente em `skill-global/.agents/skills/<name>/SKILL.md`.
- **Sincronização**: Ao executar `npm run zapflow:skills:update`, os adapters do consumidor `ZAPAI-FINAL` são automaticamente atualizados de forma atômica e seus hashes registrados no `lock.json`.
