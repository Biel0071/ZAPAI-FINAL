# Polimento visual — 15/09/2026

Escopo autorizado: corrigir recolhimento das barras, ícones, emojis e proporções; melhorar consistência das telas existentes e verificar uso real no navegador. Sem publicar nesta etapa.

Alternativas: apenas CSS deixaria o tamanho persistido do painel incorreto; substituir o layout perderia redimensionamento e aumentaria risco. Escolha: manter react-resizable-panels, conectar seu estado ao recolhimento existente e usar o Popover Radix existente para o seletor de emojis.

Implementação: InboxView recebe estado/callback internos de recolhimento; a coluna contextual colapsa para uma faixa de 64 px e recupera a largura expandida. Redimensionamento continua disponível. O seletor de emojis usa portal e detecção de colisão, com altura disponível e foco no compositor. Navegação compacta recebe nomes acessíveis. Ajustar estilos compartilhados de cards, mensagens e foco sem alterar APIs, dados ou envio.

Verificação: navegador contra o mesmo frontend local, nas larguras 360/390/768/1024/1440/1920 e paisagem 844x390. Recolher/expandir ambos os lados, redimensionar, abrir/pesquisar/inserir emoji e fechar com Escape; revisar telas principais nos temas claro/escuro, console e screenshots. Testes de regressão do layout e build. Dados de teste e evidências sem dados pessoais.
