# ZapAI Master Node System

Arquitetura SaaS centralizada para gerenciamento de múltiplos nós VPS.

## Arquitetura

```
master-node/
├── api/              # API Master para gerenciamento de nós
├── agent/            # Agent local instalado em cada VPS
├── migrations/       # Migrations do banco de dados master
├── scripts/          # Scripts de instalação e manutenção
└── config/           # Configurações compartilhadas
```

## Funcionalidades

### Master API
- Registro automático de nós
- Recebimento de heartbeats (30s)
- Envio de comandos remotos
- Coleta de métricas e logs
- Painel para Lovable consumir

### Agent Local
- Heartbeat a cada 30 segundos
- Execução de comandos remotos:
  - restart
  - update
  - rebuild
  - disconnect whatsapp
  - backup
  - clear cache
- Envio de métricas em tempo real
- Envio de logs de erros
- Monitoramento de sessões WhatsApp

### Instalação 1-Clique
- Script install.sh automatizado
- Docker compose produção
- SSL automático (Let's Encrypt)
- Sistema de rollback

## Zero Mock

Todos os componentes são produção real. Sem dados falsos.
