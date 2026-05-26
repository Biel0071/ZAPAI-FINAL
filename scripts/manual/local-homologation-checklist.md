# Checklist de Homologação Local Geral

Siga este checklist para homologar visualmente e funcionalmente o sistema no ambiente local.

---

## 🖥️ 1. Homologação Visual (Lovable Parity)
- [ ] O visual geral respeita o tema escuro premium do Zapflow (cores harmoniosas, fundo escuro, fontes legíveis).
- [ ] A barra lateral (Sidebar) recolhe e expande sem quebrar o layout das páginas.
- [ ] As telas de Dashboard, Inbox, Connections, Analytics e Diagnostics carregam sem disparar telas de erro (SafeRender/ErrorBoundary).
- [ ] Não existem textos temporários (como "mock", "stub", "fake data") nas métricas reais do Dashboard ou gráficos do Analytics.

## 🚀 2. Homologação do Roteador (Router Hardening)
- [ ] Navegue entre todas as páginas na barra lateral rápida e verifique se não ocorrem flashes de tela branca.
- [ ] Acesse a rota `/automation` diretamente pelo navegador e verifique se ela redireciona suavemente para `/flows`.
- [ ] Acesse a rota `/integrations` diretamente e confirme se ela redireciona para `/connections`.
- [ ] Acesse a rota `/dev-tools` e confirme se ela redireciona para `/diagnostics` (apenas para admins).

## 🔌 3. Homologação de Rede (WebSocket & API)
- [ ] Abra o Console de Desenvolvedor (F12) no navegador.
- [ ] Recarregue a página (F5) e confirme se não há erros de CORS ou falhas de conexão de WebSocket no painel Network/WS.
- [ ] O runtime indicator no cabeçalho deve estar marcado como **🟢 Online**.
- [ ] Desligue temporariamente o servidor backend (`node scripts/dev/stop.js`) e confirme se a UI atualiza seu status para **Offline/Reconectando** graciosamente, sem travar a interface.
- [ ] Religue o servidor e confirme se a interface se reconecta automaticamente e atualiza as informações em tela sem necessidade de dar F5 manual.

## 📈 4. Homologação de Performance
- [ ] Abra o Inbox com uma conversa longa.
- [ ] Role o histórico para cima e confirme se o scroll dinâmico (Virtual List / react-window) renderiza as mensagens de forma fluida sem lentidão.
- [ ] Monitore o uso de memória heap e tempo de CPU no script de QA (`node scripts/qa/run-qa.js`) para assegurar que está dentro de limites aceitáveis.
