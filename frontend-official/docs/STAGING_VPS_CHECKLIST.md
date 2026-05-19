# Staging / VPS Checklist

## Build

- [ ] Executar `npm --prefix frontend-official run build`
- [ ] Confirmar geração limpa do `dist/`
- [ ] Confirmar ausência de warnings novos além dos chunks grandes já conhecidos

## Runtime oficial

- [ ] Frontend servindo em `8080`
- [ ] Backend servindo em `4025`
- [ ] Nenhum processo ativo em `5173`
- [ ] Nenhum processo ativo em `4173`
- [ ] Nenhum preview paralelo

## UI crítica

- [ ] `/dashboard` abre com shell oficial único
- [ ] `/connections` abre com shell oficial único
- [ ] `/inbox` abre com shell oficial único
- [ ] `/campaigns` abre com shell oficial único
- [ ] `/settings` abre com shell oficial único
- [ ] `/contacts` abre com shell oficial único
- [ ] Sem header duplicado
- [ ] Sem sidebar duplicada
- [ ] Sem clipping de headings
- [ ] Sem double scrollbar inesperado
- [ ] Layout visual compatível com `docs/VISUAL_BASELINE.md`

## Backend real integrado

- [ ] Login administrativo funcionando
- [ ] Sessions WhatsApp carregando do backend real
- [ ] Inbox carregando conversas reais
- [ ] Campaigns persistindo via API real
- [ ] Diagnostics lendo health real
- [ ] Websocket conectando no backend oficial

## Testes

- [ ] `npm --prefix frontend-official run test`
- [ ] `npm --prefix frontend-official run test-ui`

## Rollback

- [ ] Commit anterior conhecido e válido documentado
- [ ] Processo de restart limpo disponível
- [ ] Estratégia de rollback sem preview paralelo
