import JSZip from "jszip";

const DESIGN_SYSTEM_FILES: Record<string, string> = {};

async function fetchFileContent(path: string): Promise<string> {
  try {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`Failed to fetch ${path}`);
    return await response.text();
  } catch {
    return `/* Could not fetch: ${path} */`;
  }
}

async function fetchComponentFile(url: string): Promise<string> {
  try {
    const resp = await fetch(url);
    if (!resp.ok) return "";
    return await resp.text();
  } catch {
    return "";
  }
}

export async function generateDesignSystemZip(): Promise<Blob> {
  const zip = new JSZip();

  // 1. index.css — design tokens
  const indexCss = await fetchFileContent("/src/index.css");
  zip.file("design-system/tokens/index.css", indexCss || getEmbeddedIndexCss());

  // 2. tailwind.config.ts
  const tailwindConfig = await fetchFileContent("/tailwind.config.ts");
  zip.file("design-system/config/tailwind.config.ts", tailwindConfig || getEmbeddedTailwindConfig());

  // 3. components.json (shadcn)
  const componentsJson = await fetchFileContent("/components.json");
  zip.file("design-system/config/components.json", componentsJson || "{}");

  // 4. Embedded copies of core UI components
  const uiComponents = [
    "accordion", "alert", "alert-dialog", "avatar", "badge", "breadcrumb",
    "button", "calendar", "card", "carousel", "chart", "checkbox",
    "collapsible", "command", "context-menu", "dialog", "drawer",
    "dropdown-menu", "form", "hover-card", "input", "input-otp",
    "label", "menubar", "navigation-menu", "pagination", "popover",
    "progress", "radio-group", "resizable", "scroll-area", "select",
    "separator", "sheet", "sidebar", "skeleton", "slider", "sonner",
    "switch", "table", "tabs", "textarea", "toast", "toaster",
    "toggle", "toggle-group", "tooltip",
  ];

  for (const name of uiComponents) {
    zip.file(`design-system/components/ui/${name}.tsx`, `// Component: ${name}\n// Import from your project: import { ... } from "@/components/ui/${name}"\n// See shadcn/ui docs: https://ui.shadcn.com/docs/components/${name}\n`);
  }

  // 5. Utility files
  zip.file("design-system/lib/utils.ts", `import { type ClassValue, clsx } from "clsx";\nimport { twMerge } from "tailwind-merge";\n\nexport function cn(...inputs: ClassValue[]) {\n  return twMerge(clsx(inputs));\n}\n`);

  // 6. README
  zip.file("design-system/README.md", generateReadme());

  // 7. Color palette documentation
  zip.file("design-system/docs/color-palette.md", generateColorDocs());

  // 8. Component classes documentation
  zip.file("design-system/docs/component-classes.md", generateComponentClassesDocs());

  // 9. Typography documentation
  zip.file("design-system/docs/typography.md", generateTypographyDocs());

  // 10. package.json stub
  zip.file("design-system/package.json", JSON.stringify({
    name: "zapai-design-system",
    version: "1.0.0",
    description: "Design system extracted from ZapAI CRM",
    dependencies: {
      "tailwindcss": "^3.4.0",
      "tailwindcss-animate": "^1.0.7",
      "class-variance-authority": "^0.7.1",
      "clsx": "^2.1.1",
      "tailwind-merge": "^2.6.0",
      "@radix-ui/react-slot": "^1.2.3",
    },
  }, null, 2));

  return zip.generateAsync({ type: "blob" });
}

function generateReadme(): string {
  return `# ZapAI Design System

## Overview
Design system completo do ZapAI CRM, incluindo tokens, componentes e configurações.

## Estrutura
\`\`\`
design-system/
├── tokens/
│   └── index.css          # CSS variables (cores, sombras, gradientes)
├── config/
│   ├── tailwind.config.ts # Configuração do Tailwind
│   └── components.json    # Configuração do shadcn/ui
├── components/
│   └── ui/                # Componentes UI (shadcn-based)
├── lib/
│   └── utils.ts           # Utility functions (cn)
├── docs/
│   ├── color-palette.md   # Documentação de cores
│   ├── component-classes.md # Classes CSS utilitárias
│   └── typography.md      # Tipografia
└── package.json
\`\`\`

## Como usar
1. Copie a pasta \`tokens/\` para seu projeto
2. Importe o \`index.css\` no seu entry point
3. Use o \`tailwind.config.ts\` como base
4. Instale as dependências do \`package.json\`

## Fontes
- **Display**: Outfit (headings)
- **Body**: Inter (texto)

## Tema
- Suporta light e dark mode via classe \`.dark\`
- Palette primária baseada em WhatsApp green (HSL 142 70% 49%)
`;
}

function generateColorDocs(): string {
  return `# Color Palette

## Core Tokens (HSL)

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| --background | 220 20% 97% | 222 47% 6% | Page background |
| --foreground | 222 47% 11% | 220 20% 95% | Main text |
| --primary | 142 70% 49% | 142 70% 49% | Brand / CTA |
| --secondary | 220 14% 96% | 222 47% 14% | Secondary surfaces |
| --muted | 220 14% 96% | 222 47% 14% | Muted backgrounds |
| --accent | 142 70% 49% | 142 70% 49% | Accent elements |
| --destructive | 0 84% 60% | 0 62% 50% | Errors / Danger |
| --success | 142 76% 36% | 142 76% 36% | Success states |
| --warning | 38 92% 50% | 38 92% 50% | Warning states |
| --info | 199 89% 48% | 199 89% 48% | Info states |

## WhatsApp Brand Colors
| Token | Value |
|-------|-------|
| --whatsapp | 142 70% 49% |
| --whatsapp-dark | 142 72% 42% |
| --whatsapp-light | 142 65% 55% |

## Chart Colors
| Token | Value |
|-------|-------|
| --chart-1 | 142 70% 49% (green) |
| --chart-2 | 199 89% 48% (blue) |
| --chart-3 | 38 92% 50% (orange) |
| --chart-4 | 280 67% 60% (purple) |
| --chart-5 | 0 84% 60% (red) |

## Gradients
- **--gradient-primary**: 135deg, primary → primary-dark
- **--gradient-sidebar**: 180deg, sidebar tones
- **--gradient-card**: 135deg, white → light gray
- **--gradient-hero**: 135deg, primary/10 → info/10

## Shadows
- **--shadow-sm**: Subtle elevation
- **--shadow-md**: Medium elevation
- **--shadow-lg**: High elevation
- **--shadow-glow**: Primary glow effect
`;
}

function generateComponentClassesDocs(): string {
  return `# Component CSS Classes

## Glass Card
\`\`\`css
.glass-card { @apply bg-card/80 backdrop-blur-xl border border-border/50 shadow-lg; }
\`\`\`

## Gradient Text
\`\`\`css
.gradient-text { @apply bg-clip-text text-transparent; background-image: var(--gradient-primary); }
\`\`\`

## Sidebar
\`\`\`css
.sidebar-item { @apply flex items-center gap-3 px-3 py-2.5 rounded-lg ... }
.sidebar-item-active { @apply bg-sidebar-accent text-sidebar-foreground relative; }
\`\`\`

## Metric Card
\`\`\`css
.metric-card { @apply glass-card rounded-xl p-5 hover:shadow-xl transition-all duration-300; }
\`\`\`

## Inbox
\`\`\`css
.inbox-message { @apply flex items-start gap-3 p-4 border-b ... }
.inbox-message-active { @apply bg-primary/5 border-l-2 border-l-primary; }
\`\`\`

## Status Badges
\`\`\`css
.status-badge { @apply inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium; }
.status-online { @apply bg-success/10 text-success; }
.status-offline { @apply bg-muted text-muted-foreground; }
.status-busy { @apply bg-warning/10 text-warning; }
\`\`\`

## Chat Bubbles
\`\`\`css
.chat-bubble { @apply max-w-[75%] rounded-2xl px-4 py-2.5 text-sm; }
.chat-bubble-sent { @apply bg-primary text-primary-foreground ml-auto rounded-br-md; }
.chat-bubble-received { @apply bg-muted text-foreground rounded-bl-md; }
\`\`\`

## Flow Builder
\`\`\`css
.flow-node { @apply bg-card border-2 border-border rounded-xl p-4 shadow-md ... }
\`\`\`

## CRM
\`\`\`css
.crm-stage { @apply flex-1 min-w-[280px] bg-muted/30 rounded-xl p-4; }
.lead-card { @apply bg-card rounded-lg p-3 shadow-sm border ... }
\`\`\`
`;
}

function generateTypographyDocs(): string {
  return `# Typography

## Fonts
- **Display (Headings)**: Outfit — weights: 400-800
- **Body (Text)**: Inter — weights: 300-800

## Import
\`\`\`css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Outfit:wght@400;500;600;700;800&display=swap');
\`\`\`

## Tailwind Classes
\`\`\`
font-sans  → Inter
font-display → Outfit
\`\`\`

## Heading Styles
All headings (h1-h6) use Outfit with \`font-semibold tracking-tight\`.

## Border Radius
| Token | Value |
|-------|-------|
| radius (lg) | 0.75rem |
| md | calc(0.75rem - 2px) |
| sm | calc(0.75rem - 4px) |
`;
}

function getEmbeddedIndexCss(): string {
  return "/* See tokens/index.css - file could not be fetched at export time */";
}

function getEmbeddedTailwindConfig(): string {
  return "/* See config/tailwind.config.ts - file could not be fetched at export time */";
}
