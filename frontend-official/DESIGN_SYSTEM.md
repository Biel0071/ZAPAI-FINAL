# ZAPAI-FINAL Design System & Padrões de Interface (UI/UX)

Este documento define os padrões visuais, arquiteturais e comportamentais do ZAPAI-FINAL (ZAI CRM). Qualquer nova tela, componente ou evolução deve respeitar rigorosamente essas diretrizes para manter a consistência estética e funcional em nível de produção (Enterprise/SaaS).

---

## 1. Identidade Visual (Cores e Temas)

O ZAPAI-FINAL é construído primariamente em um tema **Dark Mode** sofisticado, utilizando tons profundos de azul/cinza (slate) e acentos vibrantes, especialmente verde esmeralda, que remetem a crescimento, inteligência e integração com plataformas como WhatsApp.

### Paleta Base (Backgrounds & Superfícies)
* **Background Global:** `bg-[#080b12]` (Fundo principal da aplicação)
* **Superfícies/Cards Nível 1:** `bg-[#0d131f]` (Painéis, modais principais)
* **Superfícies/Cards Nível 2:** `bg-[#111823]` ou `bg-black/40` (Elementos agrupados internamente)
* **Bordas:** `border-white/10` ou `border-white/5` (Bordas translúcidas)

### Paleta Semântica (Acentos & Status)
* **Primária / Sucesso (ZAI Green):** `text-emerald-400`, `bg-emerald-500` (Ações principais, status online, testes).
* **Alerta / IA / Insights:** `text-amber-400`, `bg-amber-500/20` (Sugestões, playbooks pendentes, insights de IA).
* **Secundária / Informação:** `text-cyan-400` ou `text-blue-400` (Métricas, links).
* **Erro / Destrutivo:** `text-red-400`, `bg-red-500/20` (Falhas críticas, desconexões).

---

## 2. Tipografia

O sistema utiliza a fonte nativa do sistema/Tailwind via classe utilitária padrão `Inter` ou nativa de interface.
* **Títulos de Painéis/Modais:** `text-sm font-bold` ou `text-xs uppercase font-bold tracking-wider`.
* **Texto Secundário (Labels):** `text-[10px] font-semibold text-slate-400`.
* **Corpo Textual Padrão:** `text-xs text-white` ou `text-slate-300`.

*Nota: Em componentes complexos de IA, mantemos fontes menores (10px a 12px) para acomodar alta densidade de informação estilo dashboard.*

---

## 3. UI/UX: Componentes Core

### 3.1. Glassmorphism e Profundidade
Utilizamos fortemente `backdrop-blur-md` ou `backdrop-blur-xl` para sobreposições flutuantes (como os toggles e headers).
Sempre combine `bg-black/60` (ou similar translúcido) com blur e uma borda leve (`border-white/10`).

### 3.2. Efeitos Hover e Interações
* Botões iterativos devem ter transição: `transition-all duration-200`.
* Alterações de `hover` mudam sutilmente cor de borda (ex: `hover:border-emerald-500/30`) e background (`hover:bg-white/5`).
* Evitar "pulos" de layout em transições.

### 3.3. Emojis e Ícones
* **Proibido** uso de emojis do sistema operacional diretamente no código fonte (ex: 🔥, ✅).
* **Uso Obrigatório** de ícones SVG da biblioteca `lucide-react` para garantir a estética vetorial.
* *Correspondências úteis:* 
  * 🟢 / ✅ -> `<Check />`, `<CheckCheck />`, `<CheckCircle2 />`
  * 🔥 / ⚡ -> `<Zap />`, `<Flame />`, `<Sparkles />` (Insights de IA)

---

## 4. Estrutura e Arquitetura de Pastas (Regra dos 5 Pilares)

Para evitar vazamento de dependências e garantir escalabilidade, o código front-end respeita o limite de **5 diretórios principais** dentro de `src/`:

1. `app/` ou `pages/`: Telas e roteamento (ex: `Inbox.tsx`, `EvolutionCenter.tsx`).
2. `components/`: Componentes visuais UI/UX reutilizáveis (Layouts, Botões, Cards, Drawers).
3. `core/`: Regra de negócio, serviços de API, adapters de integração, runtime configs e utilitários genéricos.
4. `state/`: Gerenciadores de estado (Zustand/Redux), stores, contextos (providers) e hooks customizados.
5. `test/`: Arquivos e utilitários de testes de componentes/integração.

---

## 5. UI de Agentes e Chatbots

Nas interfaces onde a IA se manifesta (Inbox de Testes, Simuladores, Insights de evolução):
* Respostas da IA devem conter feedback visual imediato ("Digitando..." com `animate-pulse` ou pinging).
* Erros do agente (ex: API offline, quota estourada) devem ser expostos na interface via **Graceful Degradation** (exibir a resposta mockada com a tag de erro `[Erro AI: detalhe]`), sem crashar a tela do usuário.
* O design de componentes de chat segue "bubbles" clássicos: usuário verde sólido (`bg-[#005c4b]`) alinhado à direita, e IA com tom de painel (`bg-[#1f2c34]`) alinhado à esquerda.

Ao seguir essas premissas, a evolução da plataforma ZAPAI permanecerá coesa, veloz e robusta para uso em larga escala (Enterprise).
