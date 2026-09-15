# Relatório de Auditoria E2E & Mapeamento Automático — ZAPFLOW AI

**Executado em:** 09/09/2026, 11:24:39
**Ferramenta:** Playwright Automated Discovery Crawler

---

## 📊 1. Resumo Executivo
* **Total de Rotas Mapeadas:** 15
* **Rotas Ativas (OK):** 15
* **Rotas Redirecionadas:** 0
* **Rotas Quebradas (400+ ou erro):** 0
* **Páginas Órfãs:** 14
* **Erros de Console/Navegador:** 0
* **APIs Consumidas:** 0 (Falhas: 0)

---

## 🚨 2. Análise de Erros e Rotas Quebradas
Abaixo estão detalhados os problemas graves que podem impedir a navegação ou causar falhas para o usuário.

### Rotas Quebradas
🟢 _Nenhuma rota quebrada detectada!_

### Páginas Órfãs
Estas páginas estão registradas na aplicação, mas não possuem links diretos no menu ou em botões mapeados:
* Rota `/inbox` (declarada no roteador, mas sem links diretos identificados)
* Rota `/connections` (declarada no roteador, mas sem links diretos identificados)
* Rota `/contacts` (declarada no roteador, mas sem links diretos identificados)
* Rota `/flows` (declarada no roteador, mas sem links diretos identificados)
* Rota `/ai` (declarada no roteador, mas sem links diretos identificados)
* Rota `/analytics` (declarada no roteador, mas sem links diretos identificados)
* Rota `/campaigns` (declarada no roteador, mas sem links diretos identificados)
* Rota `/memory` (declarada no roteador, mas sem links diretos identificados)
* Rota `/users` (declarada no roteador, mas sem links diretos identificados)
* Rota `/nodes` (declarada no roteador, mas sem links diretos identificados)
* Rota `/deployments` (declarada no roteador, mas sem links diretos identificados)
* Rota `/logs` (declarada no roteador, mas sem links diretos identificados)
* Rota `/diagnostics` (declarada no roteador, mas sem links diretos identificados)
* Rota `/settings` (declarada no roteador, mas sem links diretos identificados)

---

## 💻 3. Erros de Console e Exceções JS (Browser)
Logs de erro capturados diretamente no console do navegador ou exceções não tratadas.

### Exceções de Renderização/JS
_Nenhuma exceção lançada pelo navegador._

### Erros de Console (Console.error / Console.warn)
_Nenhum erro de console registrado._

---

## 🔌 4. Auditoria de Integração de APIs (HTTP Status >= 400)
Requisições feitas pelo frontend ao backend que falharam ou retornaram códigos de erro.

_Nenhuma chamada de API registrada._

---

## 📱 5. Auditoria de Responsividade (Viewports)
Checagem automática de estabilidade de layout e estouro de conteúdo (overflow horizontal).

| Rota | Desktop (1600px) | Mobile (375px) | Largura Overflow |
|---|---|---|---|
| `/dashboard` | 🟢 OK | 🟢 OK | - |
| `/inbox` | 🟢 OK | 🟢 OK | - |
| `/connections` | 🟢 OK | 🟢 OK | - |
| `/contacts` | 🟢 OK | 🟢 OK | - |
| `/flows` | 🟢 OK | 🟢 OK | - |
| `/ai` | 🟢 OK | 🟢 OK | - |
| `/analytics` | 🟢 OK | 🟢 OK | - |
| `/campaigns` | 🟢 OK | 🟢 OK | - |
| `/memory` | 🟢 OK | 🟢 OK | - |
| `/users` | 🟢 OK | 🟢 OK | - |
| `/nodes` | 🟢 OK | 🟢 OK | - |
| `/deployments` | 🟢 OK | 🟢 OK | - |
| `/logs` | 🟢 OK | 🟢 OK | - |
| `/diagnostics` | 🟢 OK | 🟢 OK | - |
| `/settings` | 🟢 OK | 🟢 OK | - |

---

## 🔘 6. Botões Sem Ação Suspeitos
Botões que estão habilitados, mas cujo clique não desencadeou navegação, abertura de modal ou requisições de rede.

| Rota | Texto do Botão | Classe / ID | Resultado do Clique |
|---|---|---|---|
| `/dashboard` | `Geração e modelos⌄` | `nav-group-toggle` | Not tested (safe/destructive mode or disabled) |
| `/dashboard` | `⚙ System Status⌄` | `nav-group-toggle` | Not tested (safe/destructive mode or disabled) |
| `/dashboard` | `🛡️ Admin⌄` | `nav-group-toggle` | Not tested (safe/destructive mode or disabled) |
| `/dashboard` | `Integrações opcionais⌄` | `nav-group-toggle` | Not tested (safe/destructive mode or disabled) |
| `/dashboard` | `☰` | `sidebar-toggle` | Not tested (safe/destructive mode or disabled) |
| `/dashboard` | `🔊` | `toggle-sound` | Not tested (safe/destructive mode or disabled) |
| `/dashboard` | `×` | `modal-close` | Not tested (safe/destructive mode or disabled) |
| `/inbox` | `Geração e modelos⌄` | `nav-group-toggle` | Not tested (safe/destructive mode or disabled) |
| `/inbox` | `⚙ System Status⌄` | `nav-group-toggle` | Not tested (safe/destructive mode or disabled) |
| `/inbox` | `🛡️ Admin⌄` | `nav-group-toggle` | Not tested (safe/destructive mode or disabled) |
| `/inbox` | `Integrações opcionais⌄` | `nav-group-toggle` | Not tested (safe/destructive mode or disabled) |
| `/inbox` | `☰` | `sidebar-toggle` | Not tested (safe/destructive mode or disabled) |
| `/inbox` | `🔊` | `toggle-sound` | Not tested (safe/destructive mode or disabled) |
| `/inbox` | `×` | `modal-close` | Not tested (safe/destructive mode or disabled) |
| `/connections` | `Geração e modelos⌄` | `nav-group-toggle` | Not tested (safe/destructive mode or disabled) |
| `/connections` | `⚙ System Status⌄` | `nav-group-toggle` | Not tested (safe/destructive mode or disabled) |
| `/connections` | `🛡️ Admin⌄` | `nav-group-toggle` | Not tested (safe/destructive mode or disabled) |
| `/connections` | `Integrações opcionais⌄` | `nav-group-toggle` | Not tested (safe/destructive mode or disabled) |
| `/connections` | `☰` | `sidebar-toggle` | Not tested (safe/destructive mode or disabled) |
| `/connections` | `🔊` | `toggle-sound` | Not tested (safe/destructive mode or disabled) |
| `/connections` | `×` | `modal-close` | Not tested (safe/destructive mode or disabled) |
| `/contacts` | `Geração e modelos⌄` | `nav-group-toggle` | Not tested (safe/destructive mode or disabled) |
| `/contacts` | `⚙ System Status⌄` | `nav-group-toggle` | Not tested (safe/destructive mode or disabled) |
| `/contacts` | `🛡️ Admin⌄` | `nav-group-toggle` | Not tested (safe/destructive mode or disabled) |
| `/contacts` | `Integrações opcionais⌄` | `nav-group-toggle` | Not tested (safe/destructive mode or disabled) |
| `/contacts` | `☰` | `sidebar-toggle` | Not tested (safe/destructive mode or disabled) |
| `/contacts` | `🔊` | `toggle-sound` | Not tested (safe/destructive mode or disabled) |
| `/contacts` | `×` | `modal-close` | Not tested (safe/destructive mode or disabled) |
| `/flows` | `Geração e modelos⌄` | `nav-group-toggle` | Not tested (safe/destructive mode or disabled) |
| `/flows` | `⚙ System Status⌄` | `nav-group-toggle` | Not tested (safe/destructive mode or disabled) |
| `/flows` | `🛡️ Admin⌄` | `nav-group-toggle` | Not tested (safe/destructive mode or disabled) |
| `/flows` | `Integrações opcionais⌄` | `nav-group-toggle` | Not tested (safe/destructive mode or disabled) |
| `/flows` | `☰` | `sidebar-toggle` | Not tested (safe/destructive mode or disabled) |
| `/flows` | `🔊` | `toggle-sound` | Not tested (safe/destructive mode or disabled) |
| `/flows` | `×` | `modal-close` | Not tested (safe/destructive mode or disabled) |
| `/ai` | `Geração e modelos⌄` | `nav-group-toggle` | Not tested (safe/destructive mode or disabled) |
| `/ai` | `⚙ System Status⌄` | `nav-group-toggle` | Not tested (safe/destructive mode or disabled) |
| `/ai` | `🛡️ Admin⌄` | `nav-group-toggle` | Not tested (safe/destructive mode or disabled) |
| `/ai` | `Integrações opcionais⌄` | `nav-group-toggle` | Not tested (safe/destructive mode or disabled) |
| `/ai` | `☰` | `sidebar-toggle` | Not tested (safe/destructive mode or disabled) |
| `/ai` | `🔊` | `toggle-sound` | Not tested (safe/destructive mode or disabled) |
| `/ai` | `×` | `modal-close` | Not tested (safe/destructive mode or disabled) |
| `/analytics` | `Geração e modelos⌄` | `nav-group-toggle` | Not tested (safe/destructive mode or disabled) |
| `/analytics` | `⚙ System Status⌄` | `nav-group-toggle` | Not tested (safe/destructive mode or disabled) |
| `/analytics` | `🛡️ Admin⌄` | `nav-group-toggle` | Not tested (safe/destructive mode or disabled) |
| `/analytics` | `Integrações opcionais⌄` | `nav-group-toggle` | Not tested (safe/destructive mode or disabled) |
| `/analytics` | `☰` | `sidebar-toggle` | Not tested (safe/destructive mode or disabled) |
| `/analytics` | `🔊` | `toggle-sound` | Not tested (safe/destructive mode or disabled) |
| `/analytics` | `×` | `modal-close` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `Geração e modelos⌄` | `nav-group-toggle` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `⚙ System Status⌄` | `nav-group-toggle` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `🛡️ Admin⌄` | `nav-group-toggle` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `Integrações opcionais⌄` | `nav-group-toggle` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `☰` | `sidebar-toggle` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `🔊` | `toggle-sound` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `×` | `modal-close` | Not tested (safe/destructive mode or disabled) |
| `/memory` | `Geração e modelos⌄` | `nav-group-toggle` | Not tested (safe/destructive mode or disabled) |
| `/memory` | `⚙ System Status⌄` | `nav-group-toggle` | Not tested (safe/destructive mode or disabled) |
| `/memory` | `🛡️ Admin⌄` | `nav-group-toggle` | Not tested (safe/destructive mode or disabled) |
| `/memory` | `Integrações opcionais⌄` | `nav-group-toggle` | Not tested (safe/destructive mode or disabled) |
| `/memory` | `☰` | `sidebar-toggle` | Not tested (safe/destructive mode or disabled) |
| `/memory` | `🔊` | `toggle-sound` | Not tested (safe/destructive mode or disabled) |
| `/memory` | `×` | `modal-close` | Not tested (safe/destructive mode or disabled) |
| `/users` | `Geração e modelos⌄` | `nav-group-toggle` | Not tested (safe/destructive mode or disabled) |
| `/users` | `⚙ System Status⌄` | `nav-group-toggle` | Not tested (safe/destructive mode or disabled) |
| `/users` | `🛡️ Admin⌄` | `nav-group-toggle` | Not tested (safe/destructive mode or disabled) |
| `/users` | `Integrações opcionais⌄` | `nav-group-toggle` | Not tested (safe/destructive mode or disabled) |
| `/users` | `☰` | `sidebar-toggle` | Not tested (safe/destructive mode or disabled) |
| `/users` | `🔊` | `toggle-sound` | Not tested (safe/destructive mode or disabled) |
| `/users` | `×` | `modal-close` | Not tested (safe/destructive mode or disabled) |
| `/nodes` | `Geração e modelos⌄` | `nav-group-toggle` | Not tested (safe/destructive mode or disabled) |
| `/nodes` | `⚙ System Status⌄` | `nav-group-toggle` | Not tested (safe/destructive mode or disabled) |
| `/nodes` | `🛡️ Admin⌄` | `nav-group-toggle` | Not tested (safe/destructive mode or disabled) |
| `/nodes` | `Integrações opcionais⌄` | `nav-group-toggle` | Not tested (safe/destructive mode or disabled) |
| `/nodes` | `☰` | `sidebar-toggle` | Not tested (safe/destructive mode or disabled) |
| `/nodes` | `🔊` | `toggle-sound` | Not tested (safe/destructive mode or disabled) |
| `/nodes` | `×` | `modal-close` | Not tested (safe/destructive mode or disabled) |
| `/deployments` | `Geração e modelos⌄` | `nav-group-toggle` | Not tested (safe/destructive mode or disabled) |
| `/deployments` | `⚙ System Status⌄` | `nav-group-toggle` | Not tested (safe/destructive mode or disabled) |
| `/deployments` | `🛡️ Admin⌄` | `nav-group-toggle` | Not tested (safe/destructive mode or disabled) |
| `/deployments` | `Integrações opcionais⌄` | `nav-group-toggle` | Not tested (safe/destructive mode or disabled) |
| `/deployments` | `☰` | `sidebar-toggle` | Not tested (safe/destructive mode or disabled) |
| `/deployments` | `🔊` | `toggle-sound` | Not tested (safe/destructive mode or disabled) |
| `/deployments` | `×` | `modal-close` | Not tested (safe/destructive mode or disabled) |
| `/logs` | `Geração e modelos⌄` | `nav-group-toggle` | Not tested (safe/destructive mode or disabled) |
| `/logs` | `⚙ System Status⌄` | `nav-group-toggle` | Not tested (safe/destructive mode or disabled) |
| `/logs` | `🛡️ Admin⌄` | `nav-group-toggle` | Not tested (safe/destructive mode or disabled) |
| `/logs` | `Integrações opcionais⌄` | `nav-group-toggle` | Not tested (safe/destructive mode or disabled) |
| `/logs` | `☰` | `sidebar-toggle` | Not tested (safe/destructive mode or disabled) |
| `/logs` | `🔊` | `toggle-sound` | Not tested (safe/destructive mode or disabled) |
| `/logs` | `×` | `modal-close` | Not tested (safe/destructive mode or disabled) |
| `/diagnostics` | `Geração e modelos⌄` | `nav-group-toggle` | Not tested (safe/destructive mode or disabled) |
| `/diagnostics` | `⚙ System Status⌄` | `nav-group-toggle` | Not tested (safe/destructive mode or disabled) |
| `/diagnostics` | `🛡️ Admin⌄` | `nav-group-toggle` | Not tested (safe/destructive mode or disabled) |
| `/diagnostics` | `Integrações opcionais⌄` | `nav-group-toggle` | Not tested (safe/destructive mode or disabled) |
| `/diagnostics` | `☰` | `sidebar-toggle` | Not tested (safe/destructive mode or disabled) |
| `/diagnostics` | `🔊` | `toggle-sound` | Not tested (safe/destructive mode or disabled) |
| `/diagnostics` | `×` | `modal-close` | Not tested (safe/destructive mode or disabled) |
| `/settings` | `Geração e modelos⌄` | `nav-group-toggle` | Not tested (safe/destructive mode or disabled) |
| `/settings` | `⚙ System Status⌄` | `nav-group-toggle` | Not tested (safe/destructive mode or disabled) |
| `/settings` | `🛡️ Admin⌄` | `nav-group-toggle` | Not tested (safe/destructive mode or disabled) |
| `/settings` | `Integrações opcionais⌄` | `nav-group-toggle` | Not tested (safe/destructive mode or disabled) |
| `/settings` | `☰` | `sidebar-toggle` | Not tested (safe/destructive mode or disabled) |
| `/settings` | `🔊` | `toggle-sound` | Not tested (safe/destructive mode or disabled) |
| `/settings` | `×` | `modal-close` | Not tested (safe/destructive mode or disabled) |

---
*Relatório gerado automaticamente pela suíte de auditoria contínua ZAPFLOW AI.*
