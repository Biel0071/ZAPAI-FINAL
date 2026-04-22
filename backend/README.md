# backend/crm

Camada de regras de negocio do CRM.

## Responsabilidade
- Casos de uso (conversas, leads, campanhas, automacao).
- Persistencia e orquestracao de dominio.

## Regra
- Nao acoplar diretamente com detalhes de transporte HTTP.
- Consumir integracoes externas por adaptadores/ports.
