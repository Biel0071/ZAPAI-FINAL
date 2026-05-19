# UI Shell Rules

## Shell permitido

A UI oficial usa somente:

- `MainLayout`
- `Header`
- `Sidebar`

## Regras obrigatórias

1. Nenhuma página autenticada pode bypassar `MainLayout`.
2. Nenhuma página autenticada pode renderizar topbar própria fora de `Header`.
3. Nenhuma página pode introduzir `sticky top-0` concorrente no nível root da tela.
4. Nenhuma página pode aplicar `h-screen`, `h-dvh` ou `overflow-hidden` no root da página quando isso competir com o shell.
5. Nenhuma página pode criar offset lateral próprio que replique o trabalho de `MainLayout`.
6. A sidebar oficial é sempre `src/components/layout/Sidebar.tsx`.
7. O header oficial é sempre `src/components/layout/Header.tsx`.

## Padrões recomendados de página

Estrutura esperada:

```tsx
<div className="min-h-screen">
  <Header title="..." subtitle="..." />
  <div className="page-container section-stack">
    ...conteúdo...
  </div>
</div>
```

Para páginas mais densas, o conteúdo pode usar um container próprio, mas sem competir com o shell:

```tsx
<div className="min-h-screen">
  <Header title="Inbox" subtitle="..." />
  <div className="page-container pt-4 lg:pt-6">
    <div className="grid min-h-[calc(100vh-8.5rem)] overflow-hidden rounded-2xl ...">
      ...
    </div>
  </div>
</div>
```

## Anti-patterns proibidos

- topbar extra em `MainLayout`
- badge global fora do `Header`
- página com `position: fixed` ocupando a viewport inteira sem necessidade
- wrappers de compatibilidade com frontend antigo
- `preview:unsafe` como fluxo operacional
- qualquer import de shell vindo de arquivos legacy

## Regras de viewport

Antes de mergear mudanças visuais, validar:

- desktop
- notebook
- mobile
- reload em rota interna
- navegação entre páginas
- login/logout
- reconnect websocket

## Critério de rejeição

A mudança deve ser rejeitada se causar qualquer um destes sintomas:

- header duplicado
- conteúdo escondido atrás do topo
- clipping de headings
- scroll invisível
- double scrollbar sem necessidade
- diferença perceptível entre localhost e baseline Lovable esperado
