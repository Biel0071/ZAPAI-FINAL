export type NavigationIcon =
  | 'analytics'
  | 'bot'
  | 'campaigns'
  | 'contacts'
  | 'dashboard'
  | 'diagnostics'
  | 'flows'
  | 'inbox'
  | 'map'
  | 'sessions';

export type NavigationItem = {
  to: string;
  label: string;
  description: string;
  icon: NavigationIcon;
  aliases?: string[];
};

export type NavigationSection = {
  title: string;
  items: NavigationItem[];
};

export const navigationSections: NavigationSection[] = [
  {
    title: 'Principal',
    items: [
      {
        to: '/',
        label: 'Painel',
        description: 'Visão executiva consolidada',
        icon: 'dashboard',
      },
      {
        to: '/analytics',
        label: 'Analytics',
        description: 'Métricas, tendências e volumetria',
        icon: 'analytics',
      },
      {
        to: '/map',
        label: 'Mapa DDD',
        description: 'Distribuição por estado e região',
        icon: 'map',
      },
      {
        to: '/diagnostics',
        label: 'Diagnóstico',
        description: 'Saúde do runtime e da integração',
        icon: 'diagnostics',
      },
      {
        to: '/ai',
        label: 'IA',
        description: 'Memória, insights e backlog supervisionado',
        icon: 'bot',
      },
    ],
  },
  {
    title: 'Operação',
    items: [
      {
        to: '/inbox',
        label: 'Inbox',
        description: 'Conversas, preview e ações',
        icon: 'inbox',
        aliases: ['/chat'],
      },
      {
        to: '/connections',
        label: 'Conexões',
        description: 'Sessões WhatsApp e QR',
        icon: 'sessions',
      },
      {
        to: '/flows',
        label: 'Fluxos',
        description: 'Automações e jornadas',
        icon: 'flows',
      },
      {
        to: '/campaigns',
        label: 'Campanhas',
        description: 'Execução outbound e cadência',
        icon: 'campaigns',
      },
      {
        to: '/contacts',
        label: 'Contatos',
        description: 'Base ativa e segmentos',
        icon: 'contacts',
      },
    ],
  },
];

export const navigationItems = navigationSections.flatMap((section) => section.items);

export function getNavigationItem(pathname: string) {
  return (
    navigationItems.find((item) => item.to === pathname || item.aliases?.includes(pathname)) ||
    navigationItems[0]
  );
}
