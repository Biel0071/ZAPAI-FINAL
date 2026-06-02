# Relatório de Bugs Visuais e Estabilidade Layout

**Executado em:** 28/05/2026, 14:23:54

---

## 📐 1. Elementos Sobrepostos / Colisões de Texto (374)
Elementos HTML cujos bounding rectangles colidem visualmente, podendo gerar obstrução ou quebra de legibilidade.


| Rota | Tag A | Texto A | Tag B | Texto B | Coordenadas |
|---|---|---|---|---|---|
| `/dashboard` | `span` | "VSTABLE" | `span` | "" | A: x=72, y=58 / B: x=81, y=66.75 |
| `/dashboard` | `a` | "Dashboard" | `span` | "Dashboard" | A: x=12, y=106.75 / B: x=53, y=116 |
| `/dashboard` | `a` | "InboxLIVE" | `span` | "Inbox" | A: x=12, y=148.75 / B: x=52, y=158 |
| `/dashboard` | `a` | "Conexões" | `span` | "Conexões" | A: x=12, y=190.75 / B: x=52, y=200 |
| `/dashboard` | `a` | "Contatos" | `span` | "Contatos" | A: x=12, y=232.75 / B: x=52, y=242 |
| `/dashboard` | `a` | "Campanhas" | `span` | "Campanhas" | A: x=12, y=274.75 / B: x=52, y=284 |
| `/dashboard` | `a` | "IA & Automação" | `span` | "IA & Automação" | A: x=12, y=316.75 / B: x=52, y=326 |
| `/dashboard` | `a` | "Fluxos" | `span` | "Fluxos" | A: x=12, y=358.75 / B: x=52, y=368 |
| `/dashboard` | `a` | "Memória IA" | `span` | "Memória IA" | A: x=12, y=400.75 / B: x=52, y=410 |
| `/dashboard` | `a` | "Analytics" | `span` | "Analytics" | A: x=12, y=442.75 / B: x=52, y=452 |
| `/dashboard` | `button` | "Administração" | `span` | "Administração" | A: x=12, y=488.75 / B: x=20, y=496.75 |
| `/dashboard` | `a` | "Status & Saúde" | `span` | "Status & Saúde" | A: x=12, y=772.5 / B: x=52, y=781.75 |
| `/dashboard` | `a` | "Configurações" | `span` | "Configurações" | A: x=12, y=814.5 / B: x=52, y=823.75 |
| `/dashboard` | `button` | "Recolher" | `span` | "Recolher" | A: x=12, y=856.5 / B: x=50, y=862.5 |
| `/dashboard` | `span` | "Online" | `span` | "" | A: x=532, y=24 / B: x=532, y=29 |
| `/dashboard` | `button` | "ZAZA" | `span` | "ZA" | A: x=1511.4375, y=16 / B: x=1517.4375, y=18 |
| `/dashboard` | `button` | "ZAZA" | `span` | "ZA" | A: x=1511.4375, y=16 / B: x=1517.4375, y=18 |
| `/dashboard` | `button` | "ZAZA" | `span` | "ZA" | A: x=1511.4375, y=16 / B: x=1553.4375, y=24 |
| `/dashboard` | `span` | "ZA" | `span` | "ZA" | A: x=1517.4375, y=18 / B: x=1517.4375, y=18 |
| `/inbox` | `span` | "VSTABLE" | `span` | "" | A: x=72, y=58 / B: x=81, y=66.75 |
| `/inbox` | `a` | "Dashboard" | `span` | "Dashboard" | A: x=12, y=106.75 / B: x=52, y=116 |
| `/inbox` | `a` | "InboxLIVE" | `span` | "Inbox" | A: x=12, y=148.75 / B: x=53, y=158 |
| `/inbox` | `a` | "Conexões" | `span` | "Conexões" | A: x=12, y=190.75 / B: x=52, y=200 |
| `/inbox` | `a` | "Contatos" | `span` | "Contatos" | A: x=12, y=232.75 / B: x=52, y=242 |
| `/inbox` | `a` | "Campanhas" | `span` | "Campanhas" | A: x=12, y=274.75 / B: x=52, y=284 |
| `/inbox` | `a` | "IA & Automação" | `span` | "IA & Automação" | A: x=12, y=316.75 / B: x=52, y=326 |
| `/inbox` | `a` | "Fluxos" | `span` | "Fluxos" | A: x=12, y=358.75 / B: x=52, y=368 |
| `/inbox` | `a` | "Memória IA" | `span` | "Memória IA" | A: x=12, y=400.75 / B: x=52, y=410 |
| `/inbox` | `a` | "Analytics" | `span` | "Analytics" | A: x=12, y=442.75 / B: x=52, y=452 |
| `/inbox` | `button` | "Administração" | `span` | "Administração" | A: x=12, y=488.75 / B: x=20, y=496.75 |
| `/inbox` | `a` | "Status & Saúde" | `span` | "Status & Saúde" | A: x=12, y=772.5 / B: x=52, y=781.75 |
| `/inbox` | `a` | "Configurações" | `span` | "Configurações" | A: x=12, y=814.5 / B: x=52, y=823.75 |
| `/inbox` | `button` | "Recolher" | `span` | "Recolher" | A: x=12, y=856.5 / B: x=50, y=862.5 |
| `/inbox` | `span` | "Online" | `span` | "" | A: x=532, y=24 / B: x=532, y=29 |
| `/inbox` | `button` | "ZAZA" | `span` | "ZA" | A: x=1511.4375, y=16 / B: x=1517.4375, y=18 |
| `/inbox` | `button` | "ZAZA" | `span` | "ZA" | A: x=1511.4375, y=16 / B: x=1517.4375, y=18 |
| `/inbox` | `button` | "ZAZA" | `span` | "ZA" | A: x=1511.4375, y=16 / B: x=1553.4375, y=24 |
| `/inbox` | `span` | "ZA" | `span` | "ZA" | A: x=1517.4375, y=18 / B: x=1517.4375, y=18 |
| `/inbox` | `button` | "555319367207510:09delivery con" | `span` | "5" | A: x=300, y=237 / B: x=314, y=245.5 |
| `/inbox` | `button` | "555319367207510:09delivery con" | `span` | "5" | A: x=300, y=237 / B: x=315, y=246.5 |
| `/inbox` | `button` | "555319367207510:09delivery con" | `h4` | "553193672075" | A: x=300, y=237 / B: x=370, y=247 |
| `/inbox` | `button` | "555319367207510:09delivery con" | `span` | "10:09" | A: x=300, y=237 / B: x=597.21875, y=249.5 |
| `/inbox` | `button` | "555319367207510:09delivery con" | `p` | "delivery consistency check" | A: x=300, y=237 / B: x=370, y=269 |
| `/inbox` | `button` | "555319367207510:09delivery con" | `span` | "delivery consistency check" | A: x=300, y=237 / B: x=370, y=269 |
| `/inbox` | `button` | "555319367207510:09delivery con" | `span` | "2" | A: x=300, y=237 / B: x=603, y=268 |
| `/inbox` | `span` | "5" | `span` | "5" | A: x=314, y=245.5 / B: x=315, y=246.5 |
| `/inbox` | `p` | "delivery consistency check" | `span` | "delivery consistency check" | A: x=370, y=269 / B: x=370, y=269 |
| `/inbox` | `button` | "KMKalu Moda Íntima10:28[SMOKE]" | `span` | "KM" | A: x=300, y=303 / B: x=312, y=311.5 |
| `/inbox` | `button` | "KMKalu Moda Íntima10:28[SMOKE]" | `span` | "KM" | A: x=300, y=303 / B: x=313, y=312.5 |
| `/inbox` | `button` | "KMKalu Moda Íntima10:28[SMOKE]" | `h4` | "Kalu Moda Íntima" | A: x=300, y=303 / B: x=368, y=313 |
| `/inbox` | `button` | "KMKalu Moda Íntima10:28[SMOKE]" | `span` | "10:28" | A: x=300, y=303 / B: x=597.453125, y=315.5 |
| `/inbox` | `button` | "KMKalu Moda Íntima10:28[SMOKE]" | `p` | "[SMOKE] inbound stabilization " | A: x=300, y=303 / B: x=368, y=335 |
| `/inbox` | `button` | "KMKalu Moda Íntima10:28[SMOKE]" | `span` | "[SMOKE] inbound stabilization " | A: x=300, y=303 / B: x=368, y=335 |
| `/inbox` | `button` | "KMKalu Moda Íntima10:28[SMOKE]" | `span` | "41" | A: x=300, y=303 / B: x=600.296875, y=334 |
| `/inbox` | `span` | "KM" | `span` | "KM" | A: x=312, y=311.5 / B: x=313, y=312.5 |
| `/inbox` | `p` | "[SMOKE] inbound stabilization " | `span` | "[SMOKE] inbound stabilization " | A: x=368, y=335 / B: x=368, y=335 |
| `/inbox` | `button` | "WIWard imports13:44[SMOKE] inb" | `span` | "WI" | A: x=300, y=369 / B: x=312, y=377.5 |
| `/inbox` | `button` | "WIWard imports13:44[SMOKE] inb" | `span` | "WI" | A: x=300, y=369 / B: x=313, y=378.5 |
| `/inbox` | `button` | "WIWard imports13:44[SMOKE] inb" | `h4` | "Ward imports" | A: x=300, y=369 / B: x=368, y=379 |
| `/inbox` | `button` | "WIWard imports13:44[SMOKE] inb" | `span` | "13:44" | A: x=300, y=369 / B: x=596.953125, y=381.5 |
| `/inbox` | `button` | "WIWard imports13:44[SMOKE] inb" | `p` | "[SMOKE] inbound stabilization " | A: x=300, y=369 / B: x=368, y=401 |
| `/inbox` | `button` | "WIWard imports13:44[SMOKE] inb" | `span` | "[SMOKE] inbound stabilization " | A: x=300, y=369 / B: x=368, y=401 |
| `/inbox` | `button` | "WIWard imports13:44[SMOKE] inb" | `span` | "86" | A: x=300, y=369 / B: x=597.984375, y=400 |
| `/inbox` | `span` | "WI" | `span` | "WI" | A: x=312, y=377.5 / B: x=313, y=378.5 |
| `/inbox` | `p` | "[SMOKE] inbound stabilization " | `span` | "[SMOKE] inbound stabilization " | A: x=368, y=401 / B: x=368, y=401 |
| `/inbox` | `button` | "WIWard imports08:56????22" | `span` | "WI" | A: x=300, y=435 / B: x=312, y=443.5 |
| `/inbox` | `button` | "WIWard imports08:56????22" | `span` | "WI" | A: x=300, y=435 / B: x=313, y=444.5 |
| `/inbox` | `button` | "WIWard imports08:56????22" | `h4` | "Ward imports" | A: x=300, y=435 / B: x=368, y=445 |
| `/inbox` | `button` | "WIWard imports08:56????22" | `span` | "08:56" | A: x=300, y=435 / B: x=595.484375, y=447.5 |
| `/inbox` | `button` | "WIWard imports08:56????22" | `p` | "????" | A: x=300, y=435 / B: x=368, y=467 |
| `/inbox` | `button` | "WIWard imports08:56????22" | `span` | "????" | A: x=300, y=435 / B: x=368, y=467 |
| `/inbox` | `button` | "WIWard imports08:56????22" | `span` | "22" | A: x=300, y=435 / B: x=598.390625, y=466 |
| `/inbox` | `span` | "WI" | `span` | "WI" | A: x=312, y=443.5 / B: x=313, y=444.5 |
| `/inbox` | `p` | "????" | `span` | "????" | A: x=368, y=467 / B: x=368, y=467 |
| `/inbox` | `button` | "CCaua08:53Será q tem jeito84" | `span` | "C" | A: x=300, y=501 / B: x=312, y=509.5 |
| `/connections` | `span` | "VSTABLE" | `span` | "" | A: x=72, y=58 / B: x=81, y=66.75 |
| `/connections` | `a` | "Dashboard" | `span` | "Dashboard" | A: x=12, y=106.75 / B: x=52, y=116 |
| `/connections` | `a` | "InboxLIVE" | `span` | "Inbox" | A: x=12, y=148.75 / B: x=52, y=158 |
| `/connections` | `a` | "Conexões" | `span` | "Conexões" | A: x=12, y=190.75 / B: x=53, y=200 |
| `/connections` | `a` | "Contatos" | `span` | "Contatos" | A: x=12, y=232.75 / B: x=52, y=242 |
| `/connections` | `a` | "Campanhas" | `span` | "Campanhas" | A: x=12, y=274.75 / B: x=52, y=284 |
| `/connections` | `a` | "IA & Automação" | `span` | "IA & Automação" | A: x=12, y=316.75 / B: x=52, y=326 |
| `/connections` | `a` | "Fluxos" | `span` | "Fluxos" | A: x=12, y=358.75 / B: x=52, y=368 |
| `/connections` | `a` | "Memória IA" | `span` | "Memória IA" | A: x=12, y=400.75 / B: x=52, y=410 |
| `/connections` | `a` | "Analytics" | `span` | "Analytics" | A: x=12, y=442.75 / B: x=52, y=452 |
| `/connections` | `button` | "Administração" | `span` | "Administração" | A: x=12, y=488.75 / B: x=20, y=496.75 |
| `/connections` | `a` | "Status & Saúde" | `span` | "Status & Saúde" | A: x=12, y=772.5 / B: x=52, y=781.75 |
| `/connections` | `a` | "Configurações" | `span` | "Configurações" | A: x=12, y=814.5 / B: x=52, y=823.75 |
| `/connections` | `button` | "Recolher" | `span` | "Recolher" | A: x=12, y=856.5 / B: x=50, y=862.5 |
| `/connections` | `span` | "Online" | `span` | "" | A: x=532, y=24 / B: x=532, y=29 |
| `/connections` | `button` | "ZAZA" | `span` | "ZA" | A: x=1511.4375, y=16 / B: x=1517.4375, y=18 |
| `/connections` | `button` | "ZAZA" | `span` | "ZA" | A: x=1511.4375, y=16 / B: x=1517.4375, y=18 |
| `/connections` | `button` | "ZAZA" | `span` | "ZA" | A: x=1511.4375, y=16 / B: x=1553.4375, y=24 |
| `/connections` | `span` | "ZA" | `span` | "ZA" | A: x=1517.4375, y=18 / B: x=1517.4375, y=18 |
| `/connections` | `p` | "Sessão ativa: Nenhuma ativa" | `span` | "Nenhuma ativa" | A: x=381, y=214 / B: x=472.59375, y=215 |
| `/connections` | `span` | "(qa_stress_temp_qa_stress_1779" | `h3` | "QA Stress Temp qa_stress_17798" | A: x=649.84375, y=302 / B: x=803.65625, y=302 |
| `/connections` | `button` | "QR" | `span` | "QR" | A: x=329, y=424 / B: x=414.859375, y=431.75 |
| `/connections` | `button` | "Reiniciar" | `span` | "Reiniciar" | A: x=502.328125, y=424 / B: x=572.375, y=431.75 |
| `/connections` | `button` | "QR" | `span` | "QR" | A: x=755.65625, y=424 / B: x=841.515625, y=431.75 |
| `/connections` | `button` | "Reiniciar" | `span` | "Reiniciar" | A: x=928.984375, y=424 / B: x=999.046875, y=431.75 |
| `/contacts` | `span` | "VSTABLE" | `span` | "" | A: x=72, y=58 / B: x=81, y=66.75 |
| `/contacts` | `a` | "Dashboard" | `span` | "Dashboard" | A: x=12, y=106.75 / B: x=52, y=116 |
| `/contacts` | `a` | "InboxLIVE" | `span` | "Inbox" | A: x=12, y=148.75 / B: x=52, y=158 |
| `/contacts` | `a` | "Conexões" | `span` | "Conexões" | A: x=12, y=190.75 / B: x=52, y=200 |
| `/contacts` | `a` | "Contatos" | `span` | "Contatos" | A: x=12, y=232.75 / B: x=53, y=242 |
| `/contacts` | `a` | "Campanhas" | `span` | "Campanhas" | A: x=12, y=274.75 / B: x=52, y=284 |
| `/contacts` | `a` | "IA & Automação" | `span` | "IA & Automação" | A: x=12, y=316.75 / B: x=52, y=326 |
| `/contacts` | `a` | "Fluxos" | `span` | "Fluxos" | A: x=12, y=358.75 / B: x=52, y=368 |
| `/contacts` | `a` | "Memória IA" | `span` | "Memória IA" | A: x=12, y=400.75 / B: x=52, y=410 |
| `/contacts` | `a` | "Analytics" | `span` | "Analytics" | A: x=12, y=442.75 / B: x=52, y=452 |
| `/contacts` | `button` | "Administração" | `span` | "Administração" | A: x=12, y=488.75 / B: x=20, y=496.75 |
| `/contacts` | `a` | "Status & Saúde" | `span` | "Status & Saúde" | A: x=12, y=772.5 / B: x=52, y=781.75 |
| `/contacts` | `a` | "Configurações" | `span` | "Configurações" | A: x=12, y=814.5 / B: x=52, y=823.75 |
| `/contacts` | `button` | "Recolher" | `span` | "Recolher" | A: x=12, y=856.5 / B: x=50, y=862.5 |
| `/contacts` | `span` | "Online" | `span` | "" | A: x=532, y=24 / B: x=532, y=29 |
| `/contacts` | `button` | "ZAZA" | `span` | "ZA" | A: x=1511.4375, y=16 / B: x=1517.4375, y=18 |
| `/contacts` | `button` | "ZAZA" | `span` | "ZA" | A: x=1511.4375, y=16 / B: x=1517.4375, y=18 |
| `/contacts` | `button` | "ZAZA" | `span` | "ZA" | A: x=1511.4375, y=16 / B: x=1553.4375, y=24 |
| `/contacts` | `span` | "ZA" | `span` | "ZA" | A: x=1517.4375, y=18 / B: x=1517.4375, y=18 |
| `/contacts` | `button` | "Todos129" | `span` | "Todos" | A: x=324, y=235.5 / B: x=364, y=243.5 |
| `/contacts` | `button` | "Inbox129" | `span` | "Inbox" | A: x=324, y=275.5 / B: x=364, y=283.5 |
| `/contacts` | `button` | "Leads CRM20" | `span` | "Leads CRM" | A: x=324, y=315.5 / B: x=364, y=323.5 |
| `/contacts` | `button` | "Salvos" | `span` | "Salvos" | A: x=324, y=355.5 / B: x=364, y=363.5 |
| `/contacts` | `button` | "Grupos10" | `span` | "Grupos" | A: x=324, y=395.5 / B: x=364, y=403.5 |
| `/contacts` | `button` | "Arquivados" | `span` | "Arquivados" | A: x=324, y=435.5 / B: x=364, y=443.5 |
| `/contacts` | `button` | "Lead Quente" | `span` | "Lead Quente" | A: x=324, y=519.5 / B: x=364, y=527.5 |
| `/contacts` | `button` | "Lead Morno" | `span` | "Lead Morno" | A: x=324, y=559.5 / B: x=364, y=567.5 |
| `/contacts` | `button` | "Lead Frio" | `span` | "Lead Frio" | A: x=324, y=599.5 / B: x=364, y=607.5 |
| `/contacts` | `button` | "Ativos129" | `span` | "Ativos" | A: x=324, y=683.5 / B: x=364, y=691.5 |
| `/contacts` | `button` | "Recorrentes" | `span` | "Recorrentes" | A: x=324, y=723.5 / B: x=364, y=731.5 |
| `/contacts` | `button` | "Em Risco" | `span` | "Em Risco" | A: x=324, y=763.5 / B: x=364, y=771.5 |
| `/contacts` | `button` | "Bloqueados" | `span` | "Bloqueados" | A: x=324, y=803.5 / B: x=364, y=811.5 |
| `/flows` | `span` | "VSTABLE" | `span` | "" | A: x=72, y=58 / B: x=81, y=66.75 |
| `/flows` | `a` | "Dashboard" | `span` | "Dashboard" | A: x=12, y=106.75 / B: x=52, y=116 |
| `/flows` | `a` | "InboxLIVE" | `span` | "Inbox" | A: x=12, y=148.75 / B: x=52, y=158 |
| `/flows` | `a` | "Conexões" | `span` | "Conexões" | A: x=12, y=190.75 / B: x=52, y=200 |
| `/flows` | `a` | "Contatos" | `span` | "Contatos" | A: x=12, y=232.75 / B: x=52, y=242 |
| `/flows` | `a` | "Campanhas" | `span` | "Campanhas" | A: x=12, y=274.75 / B: x=52, y=284 |
| `/flows` | `a` | "IA & Automação" | `span` | "IA & Automação" | A: x=12, y=316.75 / B: x=52, y=326 |
| `/flows` | `a` | "Fluxos" | `span` | "Fluxos" | A: x=12, y=358.75 / B: x=53, y=368 |
| `/flows` | `a` | "Memória IA" | `span` | "Memória IA" | A: x=12, y=400.75 / B: x=52, y=410 |
| `/flows` | `a` | "Analytics" | `span` | "Analytics" | A: x=12, y=442.75 / B: x=52, y=452 |
| `/flows` | `button` | "Administração" | `span` | "Administração" | A: x=12, y=488.75 / B: x=20, y=496.75 |
| `/flows` | `a` | "Status & Saúde" | `span` | "Status & Saúde" | A: x=12, y=772.5 / B: x=52, y=781.75 |
| `/flows` | `a` | "Configurações" | `span` | "Configurações" | A: x=12, y=814.5 / B: x=52, y=823.75 |
| `/flows` | `button` | "Recolher" | `span` | "Recolher" | A: x=12, y=856.5 / B: x=50, y=862.5 |
| `/flows` | `span` | "Online" | `span` | "" | A: x=532, y=24 / B: x=532, y=29 |
| `/flows` | `button` | "ZAZA" | `span` | "ZA" | A: x=1511.4375, y=16 / B: x=1517.4375, y=18 |
| `/flows` | `button` | "ZAZA" | `span` | "ZA" | A: x=1511.4375, y=16 / B: x=1517.4375, y=18 |
| `/flows` | `button` | "ZAZA" | `span` | "ZA" | A: x=1511.4375, y=16 / B: x=1553.4375, y=24 |
| `/flows` | `span` | "ZA" | `span` | "ZA" | A: x=1517.4375, y=18 / B: x=1517.4375, y=18 |
| `/flows` | `p` | "gatilho:" | `span` | "gatilho:" | A: x=333, y=826 / B: x=333, y=827 |
| `/flows` | `p` | "resposta:" | `span` | "resposta:" | A: x=333, y=858 / B: x=333, y=859 |
| `/ai` | `span` | "VSTABLE" | `span` | "" | A: x=72, y=58 / B: x=81, y=66.75 |
| `/ai` | `a` | "Dashboard" | `span` | "Dashboard" | A: x=12, y=106.75 / B: x=52, y=116 |
| `/ai` | `a` | "InboxLIVE" | `span` | "Inbox" | A: x=12, y=148.75 / B: x=52, y=158 |
| `/ai` | `a` | "Conexões" | `span` | "Conexões" | A: x=12, y=190.75 / B: x=52, y=200 |
| `/ai` | `a` | "Contatos" | `span` | "Contatos" | A: x=12, y=232.75 / B: x=52, y=242 |
| `/ai` | `a` | "Campanhas" | `span` | "Campanhas" | A: x=12, y=274.75 / B: x=52, y=284 |
| `/ai` | `a` | "IA & Automação" | `span` | "IA & Automação" | A: x=12, y=316.75 / B: x=53, y=326 |
| `/ai` | `a` | "Fluxos" | `span` | "Fluxos" | A: x=12, y=358.75 / B: x=52, y=368 |
| `/ai` | `a` | "Memória IA" | `span` | "Memória IA" | A: x=12, y=400.75 / B: x=52, y=410 |
| `/ai` | `a` | "Analytics" | `span` | "Analytics" | A: x=12, y=442.75 / B: x=52, y=452 |
| `/ai` | `button` | "Administração" | `span` | "Administração" | A: x=12, y=488.75 / B: x=20, y=496.75 |
| `/ai` | `a` | "Status & Saúde" | `span` | "Status & Saúde" | A: x=12, y=772.5 / B: x=52, y=781.75 |
| `/ai` | `a` | "Configurações" | `span` | "Configurações" | A: x=12, y=814.5 / B: x=52, y=823.75 |
| `/ai` | `button` | "Recolher" | `span` | "Recolher" | A: x=12, y=856.5 / B: x=50, y=862.5 |
| `/ai` | `span` | "Online" | `span` | "" | A: x=532, y=24 / B: x=532, y=29 |
| `/ai` | `button` | "ZAZA" | `span` | "ZA" | A: x=1511.4375, y=16 / B: x=1517.4375, y=18 |
| `/ai` | `button` | "ZAZA" | `span` | "ZA" | A: x=1511.4375, y=16 / B: x=1517.4375, y=18 |
| `/ai` | `button` | "ZAZA" | `span` | "ZA" | A: x=1511.4375, y=16 / B: x=1553.4375, y=24 |
| `/ai` | `span` | "ZA" | `span` | "ZA" | A: x=1517.4375, y=18 / B: x=1517.4375, y=18 |
| `/ai` | `button` | "Status da IA" | `span` | "Status da IA" | A: x=341, y=118 / B: x=353, y=128 |
| `/ai` | `button` | "Editor de Prompt" | `span` | "Editor de Prompt" | A: x=341, y=158 / B: x=353, y=168 |
| `/ai` | `button` | "Provedores de IA" | `span` | "Provedores de IA" | A: x=341, y=198 / B: x=353, y=208 |
| `/ai` | `button` | "Horário Comercial" | `span` | "Horário Comercial" | A: x=341, y=238 / B: x=353, y=248 |
| `/ai` | `button` | "Mensagem de Ausência" | `span` | "Mensagem de Ausência" | A: x=341, y=278 / B: x=353, y=288 |
| `/ai` | `button` | "Fila de Reativação" | `span` | "Fila de Reativação" | A: x=341, y=318 / B: x=353, y=328 |
| `/ai` | `button` | "Central de Treinamento" | `span` | "Central de Treinamento" | A: x=341, y=358 / B: x=353, y=368 |
| `/ai` | `button` | "AI Learning" | `span` | "AI Learning" | A: x=341, y=398 / B: x=353, y=408 |
| `/ai` | `button` | "Configuração de Memória" | `span` | "Configuração de Memória" | A: x=341, y=438 / B: x=353, y=448 |
| `/ai` | `button` | "Ajustes Avançados" | `span` | "Ajustes Avançados" | A: x=341, y=478 / B: x=353, y=488 |
| `/ai` | `h3` | "Status da IA" | `button` | "" | A: x=634, y=265.5 / B: x=793.75, y=267.5 |
| `/ai` | `button` | "" | `span` | "" | A: x=1469, y=366.5 / B: x=1471, y=368.5 |
| `/analytics` | `span` | "VSTABLE" | `span` | "" | A: x=72, y=58 / B: x=81, y=66.75 |
| `/analytics` | `a` | "Dashboard" | `span` | "Dashboard" | A: x=12, y=106.75 / B: x=52, y=116 |
| `/analytics` | `a` | "InboxLIVE" | `span` | "Inbox" | A: x=12, y=148.75 / B: x=52, y=158 |
| `/analytics` | `a` | "Conexões" | `span` | "Conexões" | A: x=12, y=190.75 / B: x=52, y=200 |
| `/analytics` | `a` | "Contatos" | `span` | "Contatos" | A: x=12, y=232.75 / B: x=52, y=242 |
| `/analytics` | `a` | "Campanhas" | `span` | "Campanhas" | A: x=12, y=274.75 / B: x=52, y=284 |
| `/analytics` | `a` | "IA & Automação" | `span` | "IA & Automação" | A: x=12, y=316.75 / B: x=52, y=326 |
| `/analytics` | `a` | "Fluxos" | `span` | "Fluxos" | A: x=12, y=358.75 / B: x=52, y=368 |
| `/analytics` | `a` | "Memória IA" | `span` | "Memória IA" | A: x=12, y=400.75 / B: x=52, y=410 |
| `/analytics` | `a` | "Analytics" | `span` | "Analytics" | A: x=12, y=442.75 / B: x=53, y=452 |
| `/analytics` | `button` | "Administração" | `span` | "Administração" | A: x=12, y=488.75 / B: x=20, y=496.75 |
| `/analytics` | `a` | "Status & Saúde" | `span` | "Status & Saúde" | A: x=12, y=772.5 / B: x=52, y=781.75 |
| `/analytics` | `a` | "Configurações" | `span` | "Configurações" | A: x=12, y=814.5 / B: x=52, y=823.75 |
| `/analytics` | `button` | "Recolher" | `span` | "Recolher" | A: x=12, y=856.5 / B: x=50, y=862.5 |
| `/analytics` | `span` | "Online" | `span` | "" | A: x=532, y=24 / B: x=532, y=29 |
| `/analytics` | `button` | "ZAZA" | `span` | "ZA" | A: x=1511.4375, y=16 / B: x=1517.4375, y=18 |
| `/analytics` | `button` | "ZAZA" | `span` | "ZA" | A: x=1511.4375, y=16 / B: x=1517.4375, y=18 |
| `/analytics` | `button` | "ZAZA" | `span` | "ZA" | A: x=1511.4375, y=16 / B: x=1553.4375, y=24 |
| `/analytics` | `span` | "ZA" | `span` | "ZA" | A: x=1517.4375, y=18 / B: x=1517.4375, y=18 |
| `/campaigns` | `span` | "VSTABLE" | `span` | "" | A: x=72, y=58 / B: x=81, y=66.75 |
| `/campaigns` | `a` | "Dashboard" | `span` | "Dashboard" | A: x=12, y=106.75 / B: x=52, y=116 |
| `/campaigns` | `a` | "InboxLIVE" | `span` | "Inbox" | A: x=12, y=148.75 / B: x=52, y=158 |
| `/campaigns` | `a` | "Conexões" | `span` | "Conexões" | A: x=12, y=190.75 / B: x=52, y=200 |
| `/campaigns` | `a` | "Contatos" | `span` | "Contatos" | A: x=12, y=232.75 / B: x=52, y=242 |
| `/campaigns` | `a` | "Campanhas" | `span` | "Campanhas" | A: x=12, y=274.75 / B: x=53, y=284 |
| `/campaigns` | `a` | "IA & Automação" | `span` | "IA & Automação" | A: x=12, y=316.75 / B: x=52, y=326 |
| `/campaigns` | `a` | "Fluxos" | `span` | "Fluxos" | A: x=12, y=358.75 / B: x=52, y=368 |
| `/campaigns` | `a` | "Memória IA" | `span` | "Memória IA" | A: x=12, y=400.75 / B: x=52, y=410 |
| `/campaigns` | `a` | "Analytics" | `span` | "Analytics" | A: x=12, y=442.75 / B: x=52, y=452 |
| `/campaigns` | `button` | "Administração" | `span` | "Administração" | A: x=12, y=488.75 / B: x=20, y=496.75 |
| `/campaigns` | `a` | "Status & Saúde" | `span` | "Status & Saúde" | A: x=12, y=772.5 / B: x=52, y=781.75 |
| `/campaigns` | `a` | "Configurações" | `span` | "Configurações" | A: x=12, y=814.5 / B: x=52, y=823.75 |
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
| `/campaigns` | `button` | "3Mídia" | `span` | "3" | A: x=647.390625, y=300 / B: x=701.984375, y=317 |
| `/campaigns` | `button` | "3Mídia" | `span` | "Mídia" | A: x=647.390625, y=300 / B: x=705.203125, y=365 |
| `/campaigns` | `button` | "4Delays" | `span` | "4" | A: x=804.59375, y=300 / B: x=859.1875, y=317 |
| `/campaigns` | `button` | "4Delays" | `span` | "Delays" | A: x=804.59375, y=300 / B: x=856.875, y=365 |
| `/campaigns` | `button` | "5Revisão" | `span` | "5" | A: x=961.796875, y=300 / B: x=1016.390625, y=317 |
| `/campaigns` | `button` | "5Revisão" | `span` | "Revisão" | A: x=961.796875, y=300 / B: x=1011.453125, y=365 |
| `/campaigns` | `button` | "Filtro AtualUsar leads do mapa" | `p` | "Filtro Atual" | A: x=333, y=506.5 / B: x=358, y=599.5 |
| `/campaigns` | `button` | "Filtro AtualUsar leads do mapa" | `p` | "Usar leads do mapa ou CRM" | A: x=333, y=506.5 / B: x=358, y=643.5 |
| `/campaigns` | `button` | "Importar ListaPlanilha .xlsx o" | `p` | "Importar Lista" | A: x=597.65625, y=506.5 / B: x=622.65625, y=599.5 |
| `/campaigns` | `button` | "Importar ListaPlanilha .xlsx o" | `p` | "Planilha .xlsx ou .csv" | A: x=597.65625, y=506.5 / B: x=622.65625, y=643.5 |
| `/memory` | `span` | "VSTABLE" | `span` | "" | A: x=72, y=58 / B: x=81, y=66.75 |
| `/memory` | `a` | "Dashboard" | `span` | "Dashboard" | A: x=12, y=106.75 / B: x=52, y=116 |
| `/memory` | `a` | "InboxLIVE" | `span` | "Inbox" | A: x=12, y=148.75 / B: x=52, y=158 |
| `/memory` | `a` | "Conexões" | `span` | "Conexões" | A: x=12, y=190.75 / B: x=52, y=200 |
| `/memory` | `a` | "Contatos" | `span` | "Contatos" | A: x=12, y=232.75 / B: x=52, y=242 |
| `/memory` | `a` | "Campanhas" | `span` | "Campanhas" | A: x=12, y=274.75 / B: x=52, y=284 |
| `/memory` | `a` | "IA & Automação" | `span` | "IA & Automação" | A: x=12, y=316.75 / B: x=52, y=326 |
| `/memory` | `a` | "Fluxos" | `span` | "Fluxos" | A: x=12, y=358.75 / B: x=52, y=368 |
| `/memory` | `a` | "Memória IA" | `span` | "Memória IA" | A: x=12, y=400.75 / B: x=53, y=410 |
| `/memory` | `a` | "Analytics" | `span` | "Analytics" | A: x=12, y=442.75 / B: x=52, y=452 |
| `/memory` | `button` | "Administração" | `span` | "Administração" | A: x=12, y=488.75 / B: x=20, y=496.75 |
| `/memory` | `a` | "Status & Saúde" | `span` | "Status & Saúde" | A: x=12, y=772.5 / B: x=52, y=781.75 |
| `/memory` | `a` | "Configurações" | `span` | "Configurações" | A: x=12, y=814.5 / B: x=52, y=823.75 |
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
| `/users` | `a` | "Dashboard" | `span` | "Dashboard" | A: x=12, y=106.75 / B: x=52, y=116 |
| `/users` | `a` | "InboxLIVE" | `span` | "Inbox" | A: x=12, y=148.75 / B: x=52, y=158 |
| `/users` | `a` | "Conexões" | `span` | "Conexões" | A: x=12, y=190.75 / B: x=52, y=200 |
| `/users` | `a` | "Contatos" | `span` | "Contatos" | A: x=12, y=232.75 / B: x=52, y=242 |
| `/users` | `a` | "Campanhas" | `span` | "Campanhas" | A: x=12, y=274.75 / B: x=52, y=284 |
| `/users` | `a` | "IA & Automação" | `span` | "IA & Automação" | A: x=12, y=316.75 / B: x=52, y=326 |
| `/users` | `a` | "Fluxos" | `span` | "Fluxos" | A: x=12, y=358.75 / B: x=52, y=368 |
| `/users` | `a` | "Memória IA" | `span` | "Memória IA" | A: x=12, y=400.75 / B: x=52, y=410 |
| `/users` | `a` | "Analytics" | `span` | "Analytics" | A: x=12, y=442.75 / B: x=52, y=452 |
| `/users` | `button` | "Administração" | `span` | "Administração" | A: x=12, y=488.75 / B: x=20, y=496.75 |
| `/users` | `a` | "Status & Saúde" | `span` | "Status & Saúde" | A: x=12, y=772.5 / B: x=52, y=781.75 |
| `/users` | `a` | "Configurações" | `span` | "Configurações" | A: x=12, y=814.5 / B: x=52, y=823.75 |
| `/users` | `button` | "Recolher" | `span` | "Recolher" | A: x=12, y=856.5 / B: x=50, y=862.5 |
| `/users` | `span` | "Online" | `span` | "" | A: x=532, y=24 / B: x=532, y=29 |
| `/users` | `button` | "ZAZA" | `span` | "ZA" | A: x=1511.4375, y=16 / B: x=1517.4375, y=18 |
| `/users` | `button` | "ZAZA" | `span` | "ZA" | A: x=1511.4375, y=16 / B: x=1517.4375, y=18 |
| `/users` | `button` | "ZAZA" | `span` | "ZA" | A: x=1511.4375, y=16 / B: x=1553.4375, y=24 |
| `/users` | `span` | "ZA" | `span` | "ZA" | A: x=1517.4375, y=18 / B: x=1517.4375, y=18 |
| `/nodes` | `span` | "VSTABLE" | `span` | "" | A: x=72, y=58 / B: x=81, y=66.75 |
| `/nodes` | `a` | "Dashboard" | `span` | "Dashboard" | A: x=12, y=106.75 / B: x=52, y=116 |
| `/nodes` | `a` | "InboxLIVE" | `span` | "Inbox" | A: x=12, y=148.75 / B: x=52, y=158 |
| `/nodes` | `a` | "Conexões" | `span` | "Conexões" | A: x=12, y=190.75 / B: x=52, y=200 |
| `/nodes` | `a` | "Contatos" | `span` | "Contatos" | A: x=12, y=232.75 / B: x=52, y=242 |
| `/nodes` | `a` | "Campanhas" | `span` | "Campanhas" | A: x=12, y=274.75 / B: x=52, y=284 |
| `/nodes` | `a` | "IA & Automação" | `span` | "IA & Automação" | A: x=12, y=316.75 / B: x=52, y=326 |
| `/nodes` | `a` | "Fluxos" | `span` | "Fluxos" | A: x=12, y=358.75 / B: x=52, y=368 |
| `/nodes` | `a` | "Memória IA" | `span` | "Memória IA" | A: x=12, y=400.75 / B: x=52, y=410 |
| `/nodes` | `a` | "Analytics" | `span` | "Analytics" | A: x=12, y=442.75 / B: x=52, y=452 |
| `/nodes` | `button` | "Administração" | `span` | "Administração" | A: x=12, y=488.75 / B: x=20, y=496.75 |
| `/nodes` | `a` | "Status & Saúde" | `span` | "Status & Saúde" | A: x=12, y=772.5 / B: x=52, y=781.75 |
| `/nodes` | `a` | "Configurações" | `span` | "Configurações" | A: x=12, y=814.5 / B: x=52, y=823.75 |
| `/nodes` | `button` | "Recolher" | `span` | "Recolher" | A: x=12, y=856.5 / B: x=50, y=862.5 |
| `/nodes` | `span` | "Online" | `span` | "" | A: x=532, y=24 / B: x=532, y=29 |
| `/nodes` | `button` | "ZAZA" | `span` | "ZA" | A: x=1511.4375, y=16 / B: x=1517.4375, y=18 |
| `/nodes` | `button` | "ZAZA" | `span` | "ZA" | A: x=1511.4375, y=16 / B: x=1517.4375, y=18 |
| `/nodes` | `button` | "ZAZA" | `span` | "ZA" | A: x=1511.4375, y=16 / B: x=1553.4375, y=24 |
| `/nodes` | `span` | "ZA" | `span` | "ZA" | A: x=1517.4375, y=18 / B: x=1517.4375, y=18 |
| `/deployments` | `span` | "VSTABLE" | `span` | "" | A: x=72, y=58 / B: x=81, y=66.75 |
| `/deployments` | `a` | "Dashboard" | `span` | "Dashboard" | A: x=12, y=106.75 / B: x=52, y=116 |
| `/deployments` | `a` | "InboxLIVE" | `span` | "Inbox" | A: x=12, y=148.75 / B: x=52, y=158 |
| `/deployments` | `a` | "Conexões" | `span` | "Conexões" | A: x=12, y=190.75 / B: x=52, y=200 |
| `/deployments` | `a` | "Contatos" | `span` | "Contatos" | A: x=12, y=232.75 / B: x=52, y=242 |
| `/deployments` | `a` | "Campanhas" | `span` | "Campanhas" | A: x=12, y=274.75 / B: x=52, y=284 |
| `/deployments` | `a` | "IA & Automação" | `span` | "IA & Automação" | A: x=12, y=316.75 / B: x=52, y=326 |
| `/deployments` | `a` | "Fluxos" | `span` | "Fluxos" | A: x=12, y=358.75 / B: x=52, y=368 |
| `/deployments` | `a` | "Memória IA" | `span` | "Memória IA" | A: x=12, y=400.75 / B: x=52, y=410 |
| `/deployments` | `a` | "Analytics" | `span` | "Analytics" | A: x=12, y=442.75 / B: x=52, y=452 |
| `/deployments` | `button` | "Administração" | `span` | "Administração" | A: x=12, y=488.75 / B: x=20, y=496.75 |
| `/deployments` | `a` | "Status & Saúde" | `span` | "Status & Saúde" | A: x=12, y=772.5 / B: x=52, y=781.75 |
| `/deployments` | `a` | "Configurações" | `span` | "Configurações" | A: x=12, y=814.5 / B: x=52, y=823.75 |
| `/deployments` | `button` | "Recolher" | `span` | "Recolher" | A: x=12, y=856.5 / B: x=50, y=862.5 |
| `/deployments` | `span` | "Online" | `span` | "" | A: x=532, y=24 / B: x=532, y=29 |
| `/deployments` | `button` | "ZAZA" | `span` | "ZA" | A: x=1511.4375, y=16 / B: x=1517.4375, y=18 |
| `/deployments` | `button` | "ZAZA" | `span` | "ZA" | A: x=1511.4375, y=16 / B: x=1517.4375, y=18 |
| `/deployments` | `button` | "ZAZA" | `span` | "ZA" | A: x=1511.4375, y=16 / B: x=1553.4375, y=24 |
| `/deployments` | `span` | "ZA" | `span` | "ZA" | A: x=1517.4375, y=18 / B: x=1517.4375, y=18 |
| `/logs` | `span` | "VSTABLE" | `span` | "" | A: x=72, y=58 / B: x=81, y=66.75 |
| `/logs` | `a` | "Dashboard" | `span` | "Dashboard" | A: x=12, y=106.75 / B: x=52, y=116 |
| `/logs` | `a` | "InboxLIVE" | `span` | "Inbox" | A: x=12, y=148.75 / B: x=52, y=158 |
| `/logs` | `a` | "Conexões" | `span` | "Conexões" | A: x=12, y=190.75 / B: x=52, y=200 |
| `/logs` | `a` | "Contatos" | `span` | "Contatos" | A: x=12, y=232.75 / B: x=52, y=242 |
| `/logs` | `a` | "Campanhas" | `span` | "Campanhas" | A: x=12, y=274.75 / B: x=52, y=284 |
| `/logs` | `a` | "IA & Automação" | `span` | "IA & Automação" | A: x=12, y=316.75 / B: x=52, y=326 |
| `/logs` | `a` | "Fluxos" | `span` | "Fluxos" | A: x=12, y=358.75 / B: x=52, y=368 |
| `/logs` | `a` | "Memória IA" | `span` | "Memória IA" | A: x=12, y=400.75 / B: x=52, y=410 |
| `/logs` | `a` | "Analytics" | `span` | "Analytics" | A: x=12, y=442.75 / B: x=52, y=452 |
| `/logs` | `button` | "Administração" | `span` | "Administração" | A: x=12, y=488.75 / B: x=20, y=496.75 |
| `/logs` | `a` | "Status & Saúde" | `span` | "Status & Saúde" | A: x=12, y=772.5 / B: x=52, y=781.75 |
| `/logs` | `a` | "Configurações" | `span` | "Configurações" | A: x=12, y=814.5 / B: x=52, y=823.75 |
| `/logs` | `button` | "Recolher" | `span` | "Recolher" | A: x=12, y=856.5 / B: x=50, y=862.5 |
| `/logs` | `span` | "Online" | `span` | "" | A: x=532, y=24 / B: x=532, y=29 |
| `/logs` | `button` | "ZAZA" | `span` | "ZA" | A: x=1511.4375, y=16 / B: x=1517.4375, y=18 |
| `/logs` | `button` | "ZAZA" | `span` | "ZA" | A: x=1511.4375, y=16 / B: x=1517.4375, y=18 |
| `/logs` | `button` | "ZAZA" | `span` | "ZA" | A: x=1511.4375, y=16 / B: x=1553.4375, y=24 |
| `/logs` | `span` | "ZA" | `span` | "ZA" | A: x=1517.4375, y=18 / B: x=1517.4375, y=18 |
| `/diagnostics` | `span` | "VSTABLE" | `span` | "" | A: x=72, y=58 / B: x=81, y=66.75 |
| `/diagnostics` | `a` | "Dashboard" | `span` | "Dashboard" | A: x=12, y=106.75 / B: x=52, y=116 |
| `/diagnostics` | `a` | "InboxLIVE" | `span` | "Inbox" | A: x=12, y=148.75 / B: x=52, y=158 |
| `/diagnostics` | `a` | "Conexões" | `span` | "Conexões" | A: x=12, y=190.75 / B: x=52, y=200 |
| `/diagnostics` | `a` | "Contatos" | `span` | "Contatos" | A: x=12, y=232.75 / B: x=52, y=242 |
| `/diagnostics` | `a` | "Campanhas" | `span` | "Campanhas" | A: x=12, y=274.75 / B: x=52, y=284 |
| `/diagnostics` | `a` | "IA & Automação" | `span` | "IA & Automação" | A: x=12, y=316.75 / B: x=52, y=326 |
| `/diagnostics` | `a` | "Fluxos" | `span` | "Fluxos" | A: x=12, y=358.75 / B: x=52, y=368 |
| `/diagnostics` | `a` | "Memória IA" | `span` | "Memória IA" | A: x=12, y=400.75 / B: x=52, y=410 |
| `/diagnostics` | `a` | "Analytics" | `span` | "Analytics" | A: x=12, y=442.75 / B: x=52, y=452 |
| `/diagnostics` | `button` | "Administração" | `span` | "Administração" | A: x=12, y=488.75 / B: x=20, y=496.75 |
| `/diagnostics` | `a` | "Status & Saúde" | `span` | "Status & Saúde" | A: x=12, y=772.5 / B: x=53, y=781.75 |
| `/diagnostics` | `a` | "Configurações" | `span` | "Configurações" | A: x=12, y=814.5 / B: x=52, y=823.75 |
| `/diagnostics` | `button` | "Recolher" | `span` | "Recolher" | A: x=12, y=856.5 / B: x=50, y=862.5 |
| `/diagnostics` | `span` | "Online" | `span` | "" | A: x=532, y=24 / B: x=532, y=29 |
| `/diagnostics` | `button` | "ZAZA" | `span` | "ZA" | A: x=1511.4375, y=16 / B: x=1517.4375, y=18 |
| `/diagnostics` | `button` | "ZAZA" | `span` | "ZA" | A: x=1511.4375, y=16 / B: x=1517.4375, y=18 |
| `/diagnostics` | `button` | "ZAZA" | `span` | "ZA" | A: x=1511.4375, y=16 / B: x=1553.4375, y=24 |
| `/diagnostics` | `span` | "ZA" | `span` | "ZA" | A: x=1517.4375, y=18 / B: x=1517.4375, y=18 |
| `/settings` | `span` | "VSTABLE" | `span` | "" | A: x=72, y=58 / B: x=81, y=66.75 |
| `/settings` | `a` | "Dashboard" | `span` | "Dashboard" | A: x=12, y=106.75 / B: x=52, y=116 |
| `/settings` | `a` | "InboxLIVE" | `span` | "Inbox" | A: x=12, y=148.75 / B: x=52, y=158 |
| `/settings` | `a` | "Conexões" | `span` | "Conexões" | A: x=12, y=190.75 / B: x=52, y=200 |
| `/settings` | `a` | "Contatos" | `span` | "Contatos" | A: x=12, y=232.75 / B: x=52, y=242 |
| `/settings` | `a` | "Campanhas" | `span` | "Campanhas" | A: x=12, y=274.75 / B: x=52, y=284 |
| `/settings` | `a` | "IA & Automação" | `span` | "IA & Automação" | A: x=12, y=316.75 / B: x=52, y=326 |
| `/settings` | `a` | "Fluxos" | `span` | "Fluxos" | A: x=12, y=358.75 / B: x=52, y=368 |
| `/settings` | `a` | "Memória IA" | `span` | "Memória IA" | A: x=12, y=400.75 / B: x=52, y=410 |
| `/settings` | `a` | "Analytics" | `span` | "Analytics" | A: x=12, y=442.75 / B: x=52, y=452 |
| `/settings` | `button` | "Administração" | `span` | "Administração" | A: x=12, y=488.75 / B: x=20, y=496.75 |
| `/settings` | `a` | "Status & Saúde" | `span` | "Status & Saúde" | A: x=12, y=772.5 / B: x=52, y=781.75 |
| `/settings` | `a` | "Configurações" | `span` | "Configurações" | A: x=12, y=814.5 / B: x=53, y=823.75 |
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
