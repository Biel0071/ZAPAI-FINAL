
# Relatório de Garantia de Qualidade (QA) - ZAPFLOW AI
**Executado em:** 03/11/2026, 23:53:39

## 📊 Resumo Executivo
* **Frontend Servido (8080):** ✅ ONLINE
* **WebSocket Handshake (4025):** ❌ FALHA
* **Build de Produção:** ✅ COMPILADO
* **Testes Unitários:** ❌ FALHAS DETECTADAS
* **Auditoria E2E (Crawler):** ❌ FALHA NA EXECUÇÃO

## 🗺️ Homologação de Páginas / Recursos
- **Dashboard:** 🟢 Homologado
- **Inbox:** 🟢 Homologado
- **Connections:** 🟢 Homologado
- **Analytics:** 🟢 Homologado
- **Runtime:** 🔴 Falha
- **WebSocket:** 🔴 Falha
- **Mapa:** 🟢 Homologado
- **Performance:** 🔴 Falha

## 🔌 Sessões WhatsApp Detectadas localmente
- Sessão `broken_session_test`: status=No credentials (autenticação=false)
- Sessão `main`: status=No credentials (autenticação=false)

## 🚨 Falhas / Alertas Registrados
- Healthcheck do backend retornou falha estrutural.
- Falha no handshake do Socket.IO: connect ECONNREFUSED 127.0.0.1:4025
- Testes unitários falharam: Command failed: npm run test
- Falha no crawler E2E Playwright: Command failed: npx playwright test tests/ui/discovery-crawler.spec.ts

---
Relatório gerado automaticamente pela suíte de QA oficial do Zapflow.
