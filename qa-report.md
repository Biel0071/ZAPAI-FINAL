
# Relatório de Garantia de Qualidade (QA) - ZAPFLOW AI
**Executado em:** 02/07/2026, 16:15:13

## 📊 Resumo Executivo
* **Frontend Servido (8080):** ❌ OFFLINE
* **WebSocket Handshake (4025):** ❌ FALHA
* **Build de Produção:** ✅ COMPILADO
* **Testes Unitários:** ✅ PASSARAM
* **Auditoria E2E (Crawler):** ❌ FALHA NA EXECUÇÃO

## 🗺️ Homologação de Páginas / Recursos
- **Dashboard:** 🔴 Falha
- **Inbox:** 🟢 Homologado
- **Connections:** 🟢 Homologado
- **Analytics:** 🟢 Homologado
- **Runtime:** 🔴 Falha
- **WebSocket:** 🔴 Falha
- **Mapa:** 🔴 Falha
- **Performance:** 🔴 Falha

## 🔌 Sessões WhatsApp Detectadas localmente
- Sessão `111`: status=No credentials (autenticação=false)
- Sessão `main`: status=No credentials (autenticação=false)
- Sessão `teste1010`: status=Pre-authenticated (autenticação=true)

## 🚨 Falhas / Alertas Registrados
- Healthcheck do backend retornou falha estrutural.
- Frontend não responde em localhost:8080: connect ECONNREFUSED 127.0.0.1:8080
- Falha no handshake do Socket.IO: connect ECONNREFUSED 127.0.0.1:4025
- Falha no crawler E2E Playwright: Command failed: npx playwright test tests/ui/discovery-crawler.spec.ts

---
Relatório gerado automaticamente pela suíte de QA oficial do Zapflow.
