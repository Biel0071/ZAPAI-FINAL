# Relatório de Bugs Visuais e Estabilidade Layout

**Executado em:** 15/06/2026, 16:08:40

---

## 📐 1. Elementos Sobrepostos / Colisões de Texto (314)
Elementos HTML cujos bounding rectangles colidem visualmente, podendo gerar obstrução ou quebra de legibilidade.


| Rota | Tag A | Texto A | Tag B | Texto B | Coordenadas |
|---|---|---|---|---|---|
| `/dashboard` | `span` | "VSTABLE" | `span` | "" | A: x=72, y=58 / B: x=81, y=66.75 |
| `/dashboard` | `a` | "Dashboard" | `span` | "Dashboard" | A: x=12, y=106.75 / B: x=49, y=116 |
| `/dashboard` | `a` | "InboxLIVE" | `span` | "Inbox" | A: x=12, y=148.75 / B: x=48, y=158 |
| `/dashboard` | `a` | "Conexões" | `span` | "Conexões" | A: x=12, y=190.75 / B: x=48, y=200 |
| `/dashboard` | `a` | "Contatos" | `span` | "Contatos" | A: x=12, y=232.75 / B: x=48, y=242 |
| `/dashboard` | `a` | "Campanhas" | `span` | "Campanhas" | A: x=12, y=274.75 / B: x=48, y=284 |
| `/dashboard` | `a` | "IA & Automação" | `span` | "IA & Automação" | A: x=12, y=316.75 / B: x=48, y=326 |
| `/dashboard` | `a` | "Fluxos" | `span` | "Fluxos" | A: x=12, y=358.75 / B: x=48, y=368 |
| `/dashboard` | `a` | "Memória IA" | `span` | "Memória IA" | A: x=12, y=400.75 / B: x=48, y=410 |
| `/dashboard` | `a` | "Analytics" | `span` | "Analytics" | A: x=12, y=442.75 / B: x=48, y=452 |
| `/dashboard` | `button` | "Administração" | `span` | "Administração" | A: x=12, y=488.75 / B: x=20, y=496.75 |
| `/dashboard` | `a` | "Status & Saúde" | `span` | "Status & Saúde" | A: x=12, y=772.5 / B: x=48, y=781.75 |
| `/dashboard` | `a` | "Configurações" | `span` | "Configurações" | A: x=12, y=814.5 / B: x=48, y=823.75 |
| `/dashboard` | `button` | "Recolher" | `span` | "Recolher" | A: x=12, y=856.5 / B: x=50, y=862.5 |
| `/dashboard` | `span` | "Online" | `span` | "" | A: x=532, y=24 / B: x=532, y=29 |
| `/dashboard` | `button` | "ZAZA" | `span` | "ZA" | A: x=1511.4375, y=16 / B: x=1517.4375, y=18 |
| `/dashboard` | `button` | "ZAZA" | `span` | "ZA" | A: x=1511.4375, y=16 / B: x=1517.4375, y=18 |
| `/dashboard` | `button` | "ZAZA" | `span` | "ZA" | A: x=1511.4375, y=16 / B: x=1553.4375, y=24 |
| `/dashboard` | `span` | "ZA" | `span` | "ZA" | A: x=1517.4375, y=18 / B: x=1517.4375, y=18 |
| `/connections` | `span` | "VSTABLE" | `span` | "" | A: x=72, y=58 / B: x=81, y=66.75 |
| `/connections` | `a` | "Dashboard" | `span` | "Dashboard" | A: x=12, y=106.75 / B: x=48, y=116 |
| `/connections` | `a` | "InboxLIVE" | `span` | "Inbox" | A: x=12, y=148.75 / B: x=48, y=158 |
| `/connections` | `a` | "Conexões" | `span` | "Conexões" | A: x=12, y=190.75 / B: x=49, y=200 |
| `/connections` | `a` | "Contatos" | `span` | "Contatos" | A: x=12, y=232.75 / B: x=48, y=242 |
| `/connections` | `a` | "Campanhas" | `span` | "Campanhas" | A: x=12, y=274.75 / B: x=48, y=284 |
| `/connections` | `a` | "IA & Automação" | `span` | "IA & Automação" | A: x=12, y=316.75 / B: x=48, y=326 |
| `/connections` | `a` | "Fluxos" | `span` | "Fluxos" | A: x=12, y=358.75 / B: x=48, y=368 |
| `/connections` | `a` | "Memória IA" | `span` | "Memória IA" | A: x=12, y=400.75 / B: x=48, y=410 |
| `/connections` | `a` | "Analytics" | `span` | "Analytics" | A: x=12, y=442.75 / B: x=48, y=452 |
| `/connections` | `button` | "Administração" | `span` | "Administração" | A: x=12, y=488.75 / B: x=20, y=496.75 |
| `/connections` | `a` | "Status & Saúde" | `span` | "Status & Saúde" | A: x=12, y=772.5 / B: x=48, y=781.75 |
| `/connections` | `a` | "Configurações" | `span` | "Configurações" | A: x=12, y=814.5 / B: x=48, y=823.75 |
| `/connections` | `button` | "Recolher" | `span` | "Recolher" | A: x=12, y=856.5 / B: x=50, y=862.5 |
| `/connections` | `span` | "Online" | `span` | "" | A: x=532, y=24 / B: x=532, y=29 |
| `/connections` | `button` | "ZAZA" | `span` | "ZA" | A: x=1511.4375, y=16 / B: x=1517.4375, y=18 |
| `/connections` | `button` | "ZAZA" | `span` | "ZA" | A: x=1511.4375, y=16 / B: x=1517.4375, y=18 |
| `/connections` | `button` | "ZAZA" | `span` | "ZA" | A: x=1511.4375, y=16 / B: x=1553.4375, y=24 |
| `/connections` | `span` | "ZA" | `span` | "ZA" | A: x=1517.4375, y=18 / B: x=1517.4375, y=18 |
| `/connections` | `p` | "Sessão ativa: teste1010" | `span` | "teste1010" | A: x=381, y=214 / B: x=472.59375, y=215 |
| `/connections` | `h3` | "teste1010(teste1010)" | `span` | "(teste1010)" | A: x=377, y=302 / B: x=441.15625, y=302 |
| `/connections` | `button` | "QR" | `span` | "QR" | A: x=329, y=424 / B: x=414.359375, y=431.75 |
| `/connections` | `button` | "Desconectar" | `span` | "Desconectar" | A: x=501.328125, y=424 / B: x=560.96875, y=431.75 |
| `/contacts` | `span` | "VSTABLE" | `span` | "" | A: x=72, y=58 / B: x=81, y=66.75 |
| `/contacts` | `a` | "Dashboard" | `span` | "Dashboard" | A: x=12, y=106.75 / B: x=48, y=116 |
| `/contacts` | `a` | "InboxLIVE" | `span` | "Inbox" | A: x=12, y=148.75 / B: x=48, y=158 |
| `/contacts` | `a` | "Conexões" | `span` | "Conexões" | A: x=12, y=190.75 / B: x=48, y=200 |
| `/contacts` | `a` | "Contatos" | `span` | "Contatos" | A: x=12, y=232.75 / B: x=49, y=242 |
| `/contacts` | `a` | "Campanhas" | `span` | "Campanhas" | A: x=12, y=274.75 / B: x=48, y=284 |
| `/contacts` | `a` | "IA & Automação" | `span` | "IA & Automação" | A: x=12, y=316.75 / B: x=48, y=326 |
| `/contacts` | `a` | "Fluxos" | `span` | "Fluxos" | A: x=12, y=358.75 / B: x=48, y=368 |
| `/contacts` | `a` | "Memória IA" | `span` | "Memória IA" | A: x=12, y=400.75 / B: x=48, y=410 |
| `/contacts` | `a` | "Analytics" | `span` | "Analytics" | A: x=12, y=442.75 / B: x=48, y=452 |
| `/contacts` | `button` | "Administração" | `span` | "Administração" | A: x=12, y=488.75 / B: x=20, y=496.75 |
| `/contacts` | `a` | "Status & Saúde" | `span` | "Status & Saúde" | A: x=12, y=772.5 / B: x=48, y=781.75 |
| `/contacts` | `a` | "Configurações" | `span` | "Configurações" | A: x=12, y=814.5 / B: x=48, y=823.75 |
| `/contacts` | `button` | "Recolher" | `span` | "Recolher" | A: x=12, y=856.5 / B: x=50, y=862.5 |
| `/contacts` | `span` | "Online" | `span` | "" | A: x=532, y=24 / B: x=532, y=29 |
| `/contacts` | `button` | "ZAZA" | `span` | "ZA" | A: x=1511.4375, y=16 / B: x=1517.4375, y=18 |
| `/contacts` | `button` | "ZAZA" | `span` | "ZA" | A: x=1511.4375, y=16 / B: x=1517.4375, y=18 |
| `/contacts` | `button` | "ZAZA" | `span` | "ZA" | A: x=1511.4375, y=16 / B: x=1553.4375, y=24 |
| `/contacts` | `span` | "ZA" | `span` | "ZA" | A: x=1517.4375, y=18 / B: x=1517.4375, y=18 |
| `/contacts` | `button` | "Todos35" | `span` | "Todos" | A: x=324, y=235.5 / B: x=364, y=243.5 |
| `/contacts` | `button` | "Inbox35" | `span` | "Inbox" | A: x=324, y=275.5 / B: x=364, y=283.5 |
| `/contacts` | `button` | "Leads CRM9" | `span` | "Leads CRM" | A: x=324, y=315.5 / B: x=364, y=323.5 |
| `/contacts` | `button` | "Salvos" | `span` | "Salvos" | A: x=324, y=355.5 / B: x=364, y=363.5 |
| `/contacts` | `button` | "Grupos11" | `span` | "Grupos" | A: x=324, y=395.5 / B: x=364, y=403.5 |
| `/contacts` | `button` | "Arquivados" | `span` | "Arquivados" | A: x=324, y=435.5 / B: x=364, y=443.5 |
| `/contacts` | `button` | "Lead Quente" | `span` | "Lead Quente" | A: x=324, y=519.5 / B: x=364, y=527.5 |
| `/contacts` | `button` | "Lead Morno" | `span` | "Lead Morno" | A: x=324, y=559.5 / B: x=364, y=567.5 |
| `/contacts` | `button` | "Lead Frio" | `span` | "Lead Frio" | A: x=324, y=599.5 / B: x=364, y=607.5 |
| `/contacts` | `button` | "Ativos35" | `span` | "Ativos" | A: x=324, y=683.5 / B: x=364, y=691.5 |
| `/contacts` | `button` | "Recorrentes" | `span` | "Recorrentes" | A: x=324, y=723.5 / B: x=364, y=731.5 |
| `/contacts` | `button` | "Em Risco" | `span` | "Em Risco" | A: x=324, y=763.5 / B: x=364, y=771.5 |
| `/contacts` | `button` | "Bloqueados" | `span` | "Bloqueados" | A: x=324, y=803.5 / B: x=364, y=811.5 |
| `/flows` | `span` | "VSTABLE" | `span` | "" | A: x=72, y=58 / B: x=81, y=66.75 |
| `/flows` | `a` | "Dashboard" | `span` | "Dashboard" | A: x=12, y=106.75 / B: x=48, y=116 |
| `/flows` | `a` | "InboxLIVE" | `span` | "Inbox" | A: x=12, y=148.75 / B: x=48, y=158 |
| `/flows` | `a` | "Conexões" | `span` | "Conexões" | A: x=12, y=190.75 / B: x=48, y=200 |
| `/flows` | `a` | "Contatos" | `span` | "Contatos" | A: x=12, y=232.75 / B: x=48, y=242 |
| `/flows` | `a` | "Campanhas" | `span` | "Campanhas" | A: x=12, y=274.75 / B: x=48, y=284 |
| `/flows` | `a` | "IA & Automação" | `span` | "IA & Automação" | A: x=12, y=316.75 / B: x=48, y=326 |
| `/flows` | `a` | "Fluxos" | `span` | "Fluxos" | A: x=12, y=358.75 / B: x=49, y=368 |
| `/flows` | `a` | "Memória IA" | `span` | "Memória IA" | A: x=12, y=400.75 / B: x=48, y=410 |
| `/flows` | `a` | "Analytics" | `span` | "Analytics" | A: x=12, y=442.75 / B: x=48, y=452 |
| `/flows` | `button` | "Administração" | `span` | "Administração" | A: x=12, y=488.75 / B: x=20, y=496.75 |
| `/flows` | `a` | "Status & Saúde" | `span` | "Status & Saúde" | A: x=12, y=772.5 / B: x=48, y=781.75 |
| `/flows` | `a` | "Configurações" | `span` | "Configurações" | A: x=12, y=814.5 / B: x=48, y=823.75 |
| `/flows` | `button` | "Recolher" | `span` | "Recolher" | A: x=12, y=856.5 / B: x=50, y=862.5 |
| `/flows` | `span` | "Online" | `span` | "" | A: x=532, y=24 / B: x=532, y=29 |
| `/flows` | `button` | "ZAZA" | `span` | "ZA" | A: x=1511.4375, y=16 / B: x=1517.4375, y=18 |
| `/flows` | `button` | "ZAZA" | `span` | "ZA" | A: x=1511.4375, y=16 / B: x=1517.4375, y=18 |
| `/flows` | `button` | "ZAZA" | `span` | "ZA" | A: x=1511.4375, y=16 / B: x=1553.4375, y=24 |
| `/flows` | `span` | "ZA" | `span` | "ZA" | A: x=1517.4375, y=18 / B: x=1517.4375, y=18 |
| `/flows` | `p` | "gatilho:" | `span` | "gatilho:" | A: x=333, y=826 / B: x=333, y=827 |
| `/flows` | `p` | "resposta:" | `span` | "resposta:" | A: x=333, y=858 / B: x=333, y=859 |
| `/ai` | `span` | "VSTABLE" | `span` | "" | A: x=72, y=58 / B: x=81, y=66.75 |
| `/ai` | `a` | "Dashboard" | `span` | "Dashboard" | A: x=12, y=106.75 / B: x=48, y=116 |
| `/ai` | `a` | "InboxLIVE" | `span` | "Inbox" | A: x=12, y=148.75 / B: x=48, y=158 |
| `/ai` | `a` | "Conexões" | `span` | "Conexões" | A: x=12, y=190.75 / B: x=48, y=200 |
| `/ai` | `a` | "Contatos" | `span` | "Contatos" | A: x=12, y=232.75 / B: x=48, y=242 |
| `/ai` | `a` | "Campanhas" | `span` | "Campanhas" | A: x=12, y=274.75 / B: x=48, y=284 |
| `/ai` | `a` | "IA & Automação" | `span` | "IA & Automação" | A: x=12, y=316.75 / B: x=49, y=326 |
| `/ai` | `a` | "Fluxos" | `span` | "Fluxos" | A: x=12, y=358.75 / B: x=48, y=368 |
| `/ai` | `a` | "Memória IA" | `span` | "Memória IA" | A: x=12, y=400.75 / B: x=48, y=410 |
| `/ai` | `a` | "Analytics" | `span` | "Analytics" | A: x=12, y=442.75 / B: x=48, y=452 |
| `/ai` | `button` | "Administração" | `span` | "Administração" | A: x=12, y=488.75 / B: x=20, y=496.75 |
| `/ai` | `a` | "Status & Saúde" | `span` | "Status & Saúde" | A: x=12, y=772.5 / B: x=48, y=781.75 |
| `/ai` | `a` | "Configurações" | `span` | "Configurações" | A: x=12, y=814.5 / B: x=48, y=823.75 |
| `/ai` | `button` | "Recolher" | `span` | "Recolher" | A: x=12, y=856.5 / B: x=50, y=862.5 |
| `/ai` | `span` | "Online" | `span` | "" | A: x=532, y=24 / B: x=532, y=29 |
| `/ai` | `button` | "ZAZA" | `span` | "ZA" | A: x=1511.4375, y=16 / B: x=1517.4375, y=18 |
| `/ai` | `button` | "ZAZA" | `span` | "ZA" | A: x=1511.4375, y=16 / B: x=1517.4375, y=18 |
| `/ai` | `button` | "ZAZA" | `span` | "ZA" | A: x=1511.4375, y=16 / B: x=1553.4375, y=24 |
| `/ai` | `span` | "ZA" | `span` | "ZA" | A: x=1517.4375, y=18 / B: x=1517.4375, y=18 |
| `/ai` | `button` | "Dashboard IA" | `span` | "Dashboard IA" | A: x=354, y=292.5 / B: x=392, y=300.5 |
| `/ai` | `button` | "Atendentes" | `span` | "Atendentes" | A: x=354, y=328.5 / B: x=392, y=336.5 |
| `/ai` | `button` | "Provedores" | `span` | "Provedores" | A: x=354, y=364.5 / B: x=392, y=372.5 |
| `/ai` | `button` | "Conhecimento" | `span` | "Conhecimento" | A: x=354, y=400.5 / B: x=392, y=408.5 |
| `/ai` | `button` | "Operação" | `span` | "Operação" | A: x=354, y=436.5 / B: x=392, y=444.5 |
| `/ai` | `button` | "Análise" | `span` | "Análise" | A: x=354, y=472.5 / B: x=392, y=480.5 |
| `/ai` | `button` | "" | `span` | "" | A: x=1003, y=402 / B: x=1025, y=404 |
| `/analytics` | `span` | "VSTABLE" | `span` | "" | A: x=72, y=58 / B: x=81, y=66.75 |
| `/analytics` | `a` | "Dashboard" | `span` | "Dashboard" | A: x=12, y=106.75 / B: x=48, y=116 |
| `/analytics` | `a` | "InboxLIVE" | `span` | "Inbox" | A: x=12, y=148.75 / B: x=48, y=158 |
| `/analytics` | `a` | "Conexões" | `span` | "Conexões" | A: x=12, y=190.75 / B: x=48, y=200 |
| `/analytics` | `a` | "Contatos" | `span` | "Contatos" | A: x=12, y=232.75 / B: x=48, y=242 |
| `/analytics` | `a` | "Campanhas" | `span` | "Campanhas" | A: x=12, y=274.75 / B: x=48, y=284 |
| `/analytics` | `a` | "IA & Automação" | `span` | "IA & Automação" | A: x=12, y=316.75 / B: x=48, y=326 |
| `/analytics` | `a` | "Fluxos" | `span` | "Fluxos" | A: x=12, y=358.75 / B: x=48, y=368 |
| `/analytics` | `a` | "Memória IA" | `span` | "Memória IA" | A: x=12, y=400.75 / B: x=48, y=410 |
| `/analytics` | `a` | "Analytics" | `span` | "Analytics" | A: x=12, y=442.75 / B: x=49, y=452 |
| `/analytics` | `button` | "Administração" | `span` | "Administração" | A: x=12, y=488.75 / B: x=20, y=496.75 |
| `/analytics` | `a` | "Status & Saúde" | `span` | "Status & Saúde" | A: x=12, y=772.5 / B: x=48, y=781.75 |
| `/analytics` | `a` | "Configurações" | `span` | "Configurações" | A: x=12, y=814.5 / B: x=48, y=823.75 |
| `/analytics` | `button` | "Recolher" | `span` | "Recolher" | A: x=12, y=856.5 / B: x=50, y=862.5 |
| `/analytics` | `span` | "Online" | `span` | "" | A: x=532, y=24 / B: x=532, y=29 |
| `/analytics` | `button` | "ZAZA" | `span` | "ZA" | A: x=1511.4375, y=16 / B: x=1517.4375, y=18 |
| `/analytics` | `button` | "ZAZA" | `span` | "ZA" | A: x=1511.4375, y=16 / B: x=1517.4375, y=18 |
| `/analytics` | `button` | "ZAZA" | `span` | "ZA" | A: x=1511.4375, y=16 / B: x=1553.4375, y=24 |
| `/analytics` | `span` | "ZA" | `span` | "ZA" | A: x=1517.4375, y=18 / B: x=1517.4375, y=18 |
| `/campaigns` | `span` | "VSTABLE" | `span` | "" | A: x=72, y=58 / B: x=81, y=66.75 |
| `/campaigns` | `a` | "Dashboard" | `span` | "Dashboard" | A: x=12, y=106.75 / B: x=48, y=116 |
| `/campaigns` | `a` | "InboxLIVE" | `span` | "Inbox" | A: x=12, y=148.75 / B: x=48, y=158 |
| `/campaigns` | `a` | "Conexões" | `span` | "Conexões" | A: x=12, y=190.75 / B: x=48, y=200 |
| `/campaigns` | `a` | "Contatos" | `span` | "Contatos" | A: x=12, y=232.75 / B: x=48, y=242 |
| `/campaigns` | `a` | "Campanhas" | `span` | "Campanhas" | A: x=12, y=274.75 / B: x=49, y=284 |
| `/campaigns` | `a` | "IA & Automação" | `span` | "IA & Automação" | A: x=12, y=316.75 / B: x=48, y=326 |
| `/campaigns` | `a` | "Fluxos" | `span` | "Fluxos" | A: x=12, y=358.75 / B: x=48, y=368 |
| `/campaigns` | `a` | "Memória IA" | `span` | "Memória IA" | A: x=12, y=400.75 / B: x=48, y=410 |
| `/campaigns` | `a` | "Analytics" | `span` | "Analytics" | A: x=12, y=442.75 / B: x=48, y=452 |
| `/campaigns` | `button` | "Administração" | `span` | "Administração" | A: x=12, y=488.75 / B: x=20, y=496.75 |
| `/campaigns` | `a` | "Status & Saúde" | `span` | "Status & Saúde" | A: x=12, y=772.5 / B: x=48, y=781.75 |
| `/campaigns` | `a` | "Configurações" | `span` | "Configurações" | A: x=12, y=814.5 / B: x=48, y=823.75 |
| `/campaigns` | `button` | "Recolher" | `span` | "Recolher" | A: x=12, y=856.5 / B: x=50, y=862.5 |
| `/campaigns` | `span` | "Online" | `span` | "" | A: x=532, y=24 / B: x=532, y=29 |
| `/campaigns` | `button` | "ZAZA" | `span` | "ZA" | A: x=1511.4375, y=16 / B: x=1517.4375, y=18 |
| `/campaigns` | `button` | "ZAZA" | `span` | "ZA" | A: x=1511.4375, y=16 / B: x=1517.4375, y=18 |
| `/campaigns` | `button` | "ZAZA" | `span` | "ZA" | A: x=1511.4375, y=16 / B: x=1553.4375, y=24 |
| `/campaigns` | `span` | "ZA" | `span` | "ZA" | A: x=1517.4375, y=18 / B: x=1517.4375, y=18 |
| `/campaigns` | `button` | "1Público" | `span` | "1" | A: x=333, y=300 / B: x=387.59375, y=317 |
| `/campaigns` | `button` | "1Público" | `span` | "Público" | A: x=333, y=300 / B: x=382.484375, y=365 |
| `/campaigns` | `button` | "2Mensagem" | `span` | "2" | A: x=490.1875, y=300 / B: x=544.78125, y=317 |
| `/campaigns` | `button` | "2Mensagem" | `span` | "Mensagem" | A: x=490.1875, y=300 / B: x=531.28125, y=365 |
| `/campaigns` | `button` | "3Delays" | `span` | "3" | A: x=647.390625, y=300 / B: x=701.984375, y=317 |
| `/campaigns` | `button` | "3Delays" | `span` | "Delays" | A: x=647.390625, y=300 / B: x=699.671875, y=365 |
| `/campaigns` | `button` | "4Revisão" | `span` | "4" | A: x=804.59375, y=300 / B: x=859.1875, y=317 |
| `/campaigns` | `button` | "4Revisão" | `span` | "Revisão" | A: x=804.59375, y=300 / B: x=854.25, y=365 |
| `/campaigns` | `button` | "5Lançar" | `span` | "5" | A: x=961.796875, y=300 / B: x=1016.390625, y=317 |
| `/campaigns` | `button` | "5Lançar" | `span` | "Lançar" | A: x=961.796875, y=300 / B: x=1012.765625, y=365 |
| `/campaigns` | `button` | "Filtro AtualUsar leads do mapa" | `p` | "Filtro Atual" | A: x=333, y=506.5 / B: x=358, y=599.5 |
| `/campaigns` | `button` | "Filtro AtualUsar leads do mapa" | `p` | "Usar leads do mapa ou CRM" | A: x=333, y=506.5 / B: x=358, y=643.5 |
| `/campaigns` | `button` | "Importar ListaPlanilha .xlsx o" | `p` | "Importar Lista" | A: x=597.65625, y=506.5 / B: x=622.65625, y=599.5 |
| `/campaigns` | `button` | "Importar ListaPlanilha .xlsx o" | `p` | "Planilha .xlsx ou .csv" | A: x=597.65625, y=506.5 / B: x=622.65625, y=643.5 |
| `/memory` | `span` | "VSTABLE" | `span` | "" | A: x=72, y=58 / B: x=81, y=66.75 |
| `/memory` | `a` | "Dashboard" | `span` | "Dashboard" | A: x=12, y=106.75 / B: x=48, y=116 |
| `/memory` | `a` | "InboxLIVE" | `span` | "Inbox" | A: x=12, y=148.75 / B: x=48, y=158 |
| `/memory` | `a` | "Conexões" | `span` | "Conexões" | A: x=12, y=190.75 / B: x=48, y=200 |
| `/memory` | `a` | "Contatos" | `span` | "Contatos" | A: x=12, y=232.75 / B: x=48, y=242 |
| `/memory` | `a` | "Campanhas" | `span` | "Campanhas" | A: x=12, y=274.75 / B: x=48, y=284 |
| `/memory` | `a` | "IA & Automação" | `span` | "IA & Automação" | A: x=12, y=316.75 / B: x=48, y=326 |
| `/memory` | `a` | "Fluxos" | `span` | "Fluxos" | A: x=12, y=358.75 / B: x=48, y=368 |
| `/memory` | `a` | "Memória IA" | `span` | "Memória IA" | A: x=12, y=400.75 / B: x=49, y=410 |
| `/memory` | `a` | "Analytics" | `span` | "Analytics" | A: x=12, y=442.75 / B: x=48, y=452 |
| `/memory` | `button` | "Administração" | `span` | "Administração" | A: x=12, y=488.75 / B: x=20, y=496.75 |
| `/memory` | `a` | "Status & Saúde" | `span` | "Status & Saúde" | A: x=12, y=772.5 / B: x=48, y=781.75 |
| `/memory` | `a` | "Configurações" | `span` | "Configurações" | A: x=12, y=814.5 / B: x=48, y=823.75 |
| `/memory` | `button` | "Recolher" | `span` | "Recolher" | A: x=12, y=856.5 / B: x=50, y=862.5 |
| `/memory` | `span` | "Online" | `span` | "" | A: x=532, y=24 / B: x=532, y=29 |
| `/memory` | `button` | "ZAZA" | `span` | "ZA" | A: x=1511.4375, y=16 / B: x=1517.4375, y=18 |
| `/memory` | `button` | "ZAZA" | `span` | "ZA" | A: x=1511.4375, y=16 / B: x=1517.4375, y=18 |
| `/memory` | `button` | "ZAZA" | `span` | "ZA" | A: x=1511.4375, y=16 / B: x=1553.4375, y=24 |
| `/memory` | `span` | "ZA" | `span` | "ZA" | A: x=1517.4375, y=18 / B: x=1517.4375, y=18 |
| `/memory` | `button` | "" | `span` | "" | A: x=633.328125, y=379 / B: x=655.328125, y=381 |
| `/memory` | `button` | "" | `span` | "" | A: x=633.328125, y=458 / B: x=655.328125, y=460 |
| `/memory` | `button` | "" | `span` | "" | A: x=633.328125, y=537 / B: x=655.328125, y=539 |
| `/users` | `span` | "VSTABLE" | `span` | "" | A: x=72, y=58 / B: x=81, y=66.75 |
| `/users` | `a` | "Dashboard" | `span` | "Dashboard" | A: x=12, y=106.75 / B: x=48, y=116 |
| `/users` | `a` | "InboxLIVE" | `span` | "Inbox" | A: x=12, y=148.75 / B: x=48, y=158 |
| `/users` | `a` | "Conexões" | `span` | "Conexões" | A: x=12, y=190.75 / B: x=48, y=200 |
| `/users` | `a` | "Contatos" | `span` | "Contatos" | A: x=12, y=232.75 / B: x=48, y=242 |
| `/users` | `a` | "Campanhas" | `span` | "Campanhas" | A: x=12, y=274.75 / B: x=48, y=284 |
| `/users` | `a` | "IA & Automação" | `span` | "IA & Automação" | A: x=12, y=316.75 / B: x=48, y=326 |
| `/users` | `a` | "Fluxos" | `span` | "Fluxos" | A: x=12, y=358.75 / B: x=48, y=368 |
| `/users` | `a` | "Memória IA" | `span` | "Memória IA" | A: x=12, y=400.75 / B: x=48, y=410 |
| `/users` | `a` | "Analytics" | `span` | "Analytics" | A: x=12, y=442.75 / B: x=48, y=452 |
| `/users` | `button` | "Administração" | `span` | "Administração" | A: x=12, y=488.75 / B: x=20, y=496.75 |
| `/users` | `a` | "Status & Saúde" | `span` | "Status & Saúde" | A: x=12, y=772.5 / B: x=48, y=781.75 |
| `/users` | `a` | "Configurações" | `span` | "Configurações" | A: x=12, y=814.5 / B: x=48, y=823.75 |
| `/users` | `button` | "Recolher" | `span` | "Recolher" | A: x=12, y=856.5 / B: x=50, y=862.5 |
| `/users` | `span` | "Online" | `span` | "" | A: x=532, y=24 / B: x=532, y=29 |
| `/users` | `button` | "ZAZA" | `span` | "ZA" | A: x=1511.4375, y=16 / B: x=1517.4375, y=18 |
| `/users` | `button` | "ZAZA" | `span` | "ZA" | A: x=1511.4375, y=16 / B: x=1517.4375, y=18 |
| `/users` | `button` | "ZAZA" | `span` | "ZA" | A: x=1511.4375, y=16 / B: x=1553.4375, y=24 |
| `/users` | `span` | "ZA" | `span` | "ZA" | A: x=1517.4375, y=18 / B: x=1517.4375, y=18 |
| `/nodes` | `span` | "VSTABLE" | `span` | "" | A: x=72, y=58 / B: x=81, y=66.75 |
| `/nodes` | `a` | "Dashboard" | `span` | "Dashboard" | A: x=12, y=106.75 / B: x=48, y=116 |
| `/nodes` | `a` | "InboxLIVE" | `span` | "Inbox" | A: x=12, y=148.75 / B: x=48, y=158 |
| `/nodes` | `a` | "Conexões" | `span` | "Conexões" | A: x=12, y=190.75 / B: x=48, y=200 |
| `/nodes` | `a` | "Contatos" | `span` | "Contatos" | A: x=12, y=232.75 / B: x=48, y=242 |
| `/nodes` | `a` | "Campanhas" | `span` | "Campanhas" | A: x=12, y=274.75 / B: x=48, y=284 |
| `/nodes` | `a` | "IA & Automação" | `span` | "IA & Automação" | A: x=12, y=316.75 / B: x=48, y=326 |
| `/nodes` | `a` | "Fluxos" | `span` | "Fluxos" | A: x=12, y=358.75 / B: x=48, y=368 |
| `/nodes` | `a` | "Memória IA" | `span` | "Memória IA" | A: x=12, y=400.75 / B: x=48, y=410 |
| `/nodes` | `a` | "Analytics" | `span` | "Analytics" | A: x=12, y=442.75 / B: x=48, y=452 |
| `/nodes` | `button` | "Administração" | `span` | "Administração" | A: x=12, y=488.75 / B: x=20, y=496.75 |
| `/nodes` | `a` | "Status & Saúde" | `span` | "Status & Saúde" | A: x=12, y=772.5 / B: x=48, y=781.75 |
| `/nodes` | `a` | "Configurações" | `span` | "Configurações" | A: x=12, y=814.5 / B: x=48, y=823.75 |
| `/nodes` | `button` | "Recolher" | `span` | "Recolher" | A: x=12, y=856.5 / B: x=50, y=862.5 |
| `/nodes` | `span` | "Online" | `span` | "" | A: x=532, y=24 / B: x=532, y=29 |
| `/nodes` | `button` | "ZAZA" | `span` | "ZA" | A: x=1511.4375, y=16 / B: x=1517.4375, y=18 |
| `/nodes` | `button` | "ZAZA" | `span` | "ZA" | A: x=1511.4375, y=16 / B: x=1517.4375, y=18 |
| `/nodes` | `button` | "ZAZA" | `span` | "ZA" | A: x=1511.4375, y=16 / B: x=1553.4375, y=24 |
| `/nodes` | `span` | "ZA" | `span` | "ZA" | A: x=1517.4375, y=18 / B: x=1517.4375, y=18 |
| `/deployments` | `span` | "VSTABLE" | `span` | "" | A: x=72, y=58 / B: x=81, y=66.75 |
| `/deployments` | `a` | "Dashboard" | `span` | "Dashboard" | A: x=12, y=106.75 / B: x=48, y=116 |
| `/deployments` | `a` | "InboxLIVE" | `span` | "Inbox" | A: x=12, y=148.75 / B: x=48, y=158 |
| `/deployments` | `a` | "Conexões" | `span` | "Conexões" | A: x=12, y=190.75 / B: x=48, y=200 |
| `/deployments` | `a` | "Contatos" | `span` | "Contatos" | A: x=12, y=232.75 / B: x=48, y=242 |
| `/deployments` | `a` | "Campanhas" | `span` | "Campanhas" | A: x=12, y=274.75 / B: x=48, y=284 |
| `/deployments` | `a` | "IA & Automação" | `span` | "IA & Automação" | A: x=12, y=316.75 / B: x=48, y=326 |
| `/deployments` | `a` | "Fluxos" | `span` | "Fluxos" | A: x=12, y=358.75 / B: x=48, y=368 |
| `/deployments` | `a` | "Memória IA" | `span` | "Memória IA" | A: x=12, y=400.75 / B: x=48, y=410 |
| `/deployments` | `a` | "Analytics" | `span` | "Analytics" | A: x=12, y=442.75 / B: x=48, y=452 |
| `/deployments` | `button` | "Administração" | `span` | "Administração" | A: x=12, y=488.75 / B: x=20, y=496.75 |
| `/deployments` | `a` | "Status & Saúde" | `span` | "Status & Saúde" | A: x=12, y=772.5 / B: x=48, y=781.75 |
| `/deployments` | `a` | "Configurações" | `span` | "Configurações" | A: x=12, y=814.5 / B: x=48, y=823.75 |
| `/deployments` | `button` | "Recolher" | `span` | "Recolher" | A: x=12, y=856.5 / B: x=50, y=862.5 |
| `/deployments` | `span` | "Online" | `span` | "" | A: x=532, y=24 / B: x=532, y=29 |
| `/deployments` | `button` | "ZAZA" | `span` | "ZA" | A: x=1511.4375, y=16 / B: x=1517.4375, y=18 |
| `/deployments` | `button` | "ZAZA" | `span` | "ZA" | A: x=1511.4375, y=16 / B: x=1517.4375, y=18 |
| `/deployments` | `button` | "ZAZA" | `span` | "ZA" | A: x=1511.4375, y=16 / B: x=1553.4375, y=24 |
| `/deployments` | `span` | "ZA" | `span` | "ZA" | A: x=1517.4375, y=18 / B: x=1517.4375, y=18 |
| `/logs` | `span` | "VSTABLE" | `span` | "" | A: x=72, y=58 / B: x=81, y=66.75 |
| `/logs` | `a` | "Dashboard" | `span` | "Dashboard" | A: x=12, y=106.75 / B: x=48, y=116 |
| `/logs` | `a` | "InboxLIVE" | `span` | "Inbox" | A: x=12, y=148.75 / B: x=48, y=158 |
| `/logs` | `a` | "Conexões" | `span` | "Conexões" | A: x=12, y=190.75 / B: x=48, y=200 |
| `/logs` | `a` | "Contatos" | `span` | "Contatos" | A: x=12, y=232.75 / B: x=48, y=242 |
| `/logs` | `a` | "Campanhas" | `span` | "Campanhas" | A: x=12, y=274.75 / B: x=48, y=284 |
| `/logs` | `a` | "IA & Automação" | `span` | "IA & Automação" | A: x=12, y=316.75 / B: x=48, y=326 |
| `/logs` | `a` | "Fluxos" | `span` | "Fluxos" | A: x=12, y=358.75 / B: x=48, y=368 |
| `/logs` | `a` | "Memória IA" | `span` | "Memória IA" | A: x=12, y=400.75 / B: x=48, y=410 |
| `/logs` | `a` | "Analytics" | `span` | "Analytics" | A: x=12, y=442.75 / B: x=48, y=452 |
| `/logs` | `button` | "Administração" | `span` | "Administração" | A: x=12, y=488.75 / B: x=20, y=496.75 |
| `/logs` | `a` | "Status & Saúde" | `span` | "Status & Saúde" | A: x=12, y=772.5 / B: x=48, y=781.75 |
| `/logs` | `a` | "Configurações" | `span` | "Configurações" | A: x=12, y=814.5 / B: x=48, y=823.75 |
| `/logs` | `button` | "Recolher" | `span` | "Recolher" | A: x=12, y=856.5 / B: x=50, y=862.5 |
| `/logs` | `span` | "Online" | `span` | "" | A: x=532, y=24 / B: x=532, y=29 |
| `/logs` | `button` | "ZAZA" | `span` | "ZA" | A: x=1511.4375, y=16 / B: x=1517.4375, y=18 |
| `/logs` | `button` | "ZAZA" | `span` | "ZA" | A: x=1511.4375, y=16 / B: x=1517.4375, y=18 |
| `/logs` | `button` | "ZAZA" | `span` | "ZA" | A: x=1511.4375, y=16 / B: x=1553.4375, y=24 |
| `/logs` | `span` | "ZA" | `span` | "ZA" | A: x=1517.4375, y=18 / B: x=1517.4375, y=18 |
| `/diagnostics` | `span` | "VSTABLE" | `span` | "" | A: x=72, y=58 / B: x=81, y=66.75 |
| `/diagnostics` | `a` | "Dashboard" | `span` | "Dashboard" | A: x=12, y=106.75 / B: x=48, y=116 |
| `/diagnostics` | `a` | "InboxLIVE" | `span` | "Inbox" | A: x=12, y=148.75 / B: x=48, y=158 |
| `/diagnostics` | `a` | "Conexões" | `span` | "Conexões" | A: x=12, y=190.75 / B: x=48, y=200 |
| `/diagnostics` | `a` | "Contatos" | `span` | "Contatos" | A: x=12, y=232.75 / B: x=48, y=242 |
| `/diagnostics` | `a` | "Campanhas" | `span` | "Campanhas" | A: x=12, y=274.75 / B: x=48, y=284 |
| `/diagnostics` | `a` | "IA & Automação" | `span` | "IA & Automação" | A: x=12, y=316.75 / B: x=48, y=326 |
| `/diagnostics` | `a` | "Fluxos" | `span` | "Fluxos" | A: x=12, y=358.75 / B: x=48, y=368 |
| `/diagnostics` | `a` | "Memória IA" | `span` | "Memória IA" | A: x=12, y=400.75 / B: x=48, y=410 |
| `/diagnostics` | `a` | "Analytics" | `span` | "Analytics" | A: x=12, y=442.75 / B: x=48, y=452 |
| `/diagnostics` | `button` | "Administração" | `span` | "Administração" | A: x=12, y=488.75 / B: x=20, y=496.75 |
| `/diagnostics` | `a` | "Status & Saúde" | `span` | "Status & Saúde" | A: x=12, y=772.5 / B: x=49, y=781.75 |
| `/diagnostics` | `a` | "Configurações" | `span` | "Configurações" | A: x=12, y=814.5 / B: x=48, y=823.75 |
| `/diagnostics` | `button` | "Recolher" | `span` | "Recolher" | A: x=12, y=856.5 / B: x=50, y=862.5 |
| `/diagnostics` | `span` | "Online" | `span` | "" | A: x=532, y=24 / B: x=532, y=29 |
| `/diagnostics` | `button` | "ZAZA" | `span` | "ZA" | A: x=1511.4375, y=16 / B: x=1517.4375, y=18 |
| `/diagnostics` | `button` | "ZAZA" | `span` | "ZA" | A: x=1511.4375, y=16 / B: x=1517.4375, y=18 |
| `/diagnostics` | `button` | "ZAZA" | `span` | "ZA" | A: x=1511.4375, y=16 / B: x=1553.4375, y=24 |
| `/diagnostics` | `span` | "ZA" | `span` | "ZA" | A: x=1517.4375, y=18 / B: x=1517.4375, y=18 |
| `/diagnostics` | `span` | "" | `span` | "" | A: x=329, y=720 / B: x=330, y=721 |
| `/diagnostics` | `h4` | "teste1010()" | `span` | "()" | A: x=385, y=722 / B: x=449.15625, y=722 |
| `/diagnostics` | `p` | "Número: +55 (31) 9367-2075" | `span` | "Número:" | A: x=385, y=748 / B: x=385, y=748 |
| `/settings` | `span` | "VSTABLE" | `span` | "" | A: x=72, y=58 / B: x=81, y=66.75 |
| `/settings` | `a` | "Dashboard" | `span` | "Dashboard" | A: x=12, y=106.75 / B: x=48, y=116 |
| `/settings` | `a` | "InboxLIVE" | `span` | "Inbox" | A: x=12, y=148.75 / B: x=48, y=158 |
| `/settings` | `a` | "Conexões" | `span` | "Conexões" | A: x=12, y=190.75 / B: x=48, y=200 |
| `/settings` | `a` | "Contatos" | `span` | "Contatos" | A: x=12, y=232.75 / B: x=48, y=242 |
| `/settings` | `a` | "Campanhas" | `span` | "Campanhas" | A: x=12, y=274.75 / B: x=48, y=284 |
| `/settings` | `a` | "IA & Automação" | `span` | "IA & Automação" | A: x=12, y=316.75 / B: x=48, y=326 |
| `/settings` | `a` | "Fluxos" | `span` | "Fluxos" | A: x=12, y=358.75 / B: x=48, y=368 |
| `/settings` | `a` | "Memória IA" | `span` | "Memória IA" | A: x=12, y=400.75 / B: x=48, y=410 |
| `/settings` | `a` | "Analytics" | `span` | "Analytics" | A: x=12, y=442.75 / B: x=48, y=452 |
| `/settings` | `button` | "Administração" | `span` | "Administração" | A: x=12, y=488.75 / B: x=20, y=496.75 |
| `/settings` | `a` | "Status & Saúde" | `span` | "Status & Saúde" | A: x=12, y=772.5 / B: x=48, y=781.75 |
| `/settings` | `a` | "Configurações" | `span` | "Configurações" | A: x=12, y=814.5 / B: x=49, y=823.75 |
| `/settings` | `button` | "Recolher" | `span` | "Recolher" | A: x=12, y=856.5 / B: x=50, y=862.5 |
| `/settings` | `span` | "Online" | `span` | "" | A: x=532, y=24 / B: x=532, y=29 |
| `/settings` | `button` | "ZAZA" | `span` | "ZA" | A: x=1511.4375, y=16 / B: x=1517.4375, y=18 |
| `/settings` | `button` | "ZAZA" | `span` | "ZA" | A: x=1511.4375, y=16 / B: x=1517.4375, y=18 |
| `/settings` | `button` | "ZAZA" | `span` | "ZA" | A: x=1511.4375, y=16 / B: x=1553.4375, y=24 |
| `/settings` | `span` | "ZA" | `span` | "ZA" | A: x=1517.4375, y=18 / B: x=1517.4375, y=18 |
| `/settings` | `button` | "IA Ativa" | `span` | "" | A: x=1447.703125, y=164 / B: x=1464.703125, y=179 |
| `/settings` | `span` | "AD" | `span` | "AD" | A: x=617, y=328 / B: x=617, y=328 |


---

## 📱 2. Falhas de Responsividade / Overflows de Layout (0)
Telas que apresentaram estouro horizontal (barra de rolagem horizontal desnecessária).

🟢 _Nenhuma falha de layout overflow detectada._
