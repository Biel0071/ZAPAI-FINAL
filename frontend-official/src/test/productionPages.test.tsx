import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import Settings from '@/pages/Settings';
import Contacts from '@/pages/Contacts';
import Connections from '@/pages/Connections';
import Campaigns from '@/pages/Campaigns';
import { ZaibotFloatingAssistant } from '@/components/ai/ZaibotFloatingAssistant';
import { apiService } from '@/core/services/apiService';
import { createDashboardLovableViewModel } from '@/core/adapters/lovable/dashboardAdapter';
import type { Conversation } from '@/core/services/apiService';
import { notify } from '@/core/services/notifyService';
import { businessLabel } from '@/core/utils/tagEmojis';
import { createAnalyticsLovableViewModel } from '@/core/adapters/lovable/analyticsAdapter';
const state = vi.hoisted(() => ({ contacts: [] as unknown[], props: {} as Record<string, unknown>, sessions: [], qr: {} }));
vi.mock('@/components/layout/Header', () => ({ Header: () => null }));
vi.mock('@/pages/lovable/pages/SettingsPageView', () => ({ default: ({ navigation, content }: { navigation: ReactNode; content: ReactNode }) => <>{navigation}{content}</> }));
vi.mock('@/pages/lovable/pages/ContactsPageView', () => ({ default: (props: Record<string, unknown>) => { state.props = props; return null; } }));
vi.mock('@/components/contacts/LeadDrawer', () => ({ LeadDrawer: () => null }));
vi.mock('@/components/evolution/HistoryBootstrapPanel', () => ({ HistoryBootstrapPanel: () => null }));
vi.mock('@/components/campaigns/CampaignContextInput', () => ({ CampaignContextInput: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => <textarea aria-label="Contexto da campanha" value={value} onChange={event => onChange(event.target.value)} /> }));
vi.mock('@/components/campaigns/ConversionHeatmap', () => ({ ConversionHeatmap: () => null }));
vi.mock('@/components/campaigns/ChipMaturationCard', () => ({ ChipMaturationCard: () => null }));
vi.mock('@/components/ai/ZaiPlatformAssistantView', () => ({ ZaiPlatformAssistantView: () => <p>Copiloto canônico</p> }));
vi.mock('@/pages/lovable/pages/ConnectionsPageView', () => ({ default: (props: Record<string, unknown>) => { state.props = props; return null; } }));
vi.mock('@/state/stores/appStore', () => ({ useAppStore: Object.assign((select: (s: unknown) => unknown) => select({ sessions: state.sessions, lastQr: state.qr }), { getState: () => ({ setSessions: vi.fn() }) }) }));
vi.mock('@/core/runtime/services/frontendHealthService', () => ({ reportFrontendIssue: vi.fn() }));
vi.mock('@/state/hooks/useAdminAuth', () => ({ useAdminAuth: () => ({ username: 'operator' }) }));
vi.mock('next-themes', () => ({ useTheme: () => ({ theme: 'dark', setTheme: vi.fn() }) }));
vi.mock('@/state/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/core/services/notifyService', () => ({ notify: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/core/services/apiService', () => ({ apiService: {
  getAdminUsers: vi.fn().mockResolvedValue([]), getAIStatus: vi.fn().mockResolvedValue({ enabled: false }),
  getContacts: vi.fn().mockImplementation(async () => state.contacts),
  listSessions: vi.fn().mockResolvedValue([]), getAIAgents: vi.fn().mockResolvedValue({ agents: [] }),
  getCampaigns: vi.fn().mockResolvedValue([]), getConversations: vi.fn().mockResolvedValue([]), getQuickReplies: vi.fn().mockResolvedValue([]),
  getCampaignMaturationStats: vi.fn().mockResolvedValue({}), generateCampaignAI: vi.fn().mockResolvedValue(null), createQuickReply: vi.fn(),
} }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root; let container: HTMLDivElement;
beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); });
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
async function render(element: ReactNode, path: string) { await act(async () => root.render(<MemoryRouter initialEntries={[path]}>{element}</MemoryRouter>)); }
function dashboard(notes?: string) {
  return createDashboardLovableViewModel({ conversations: [{ id: '1', phone: '5511999990000', notes } as Conversation], metrics: null, sessions: [], runtimeStatus: 'offline', sessionState: 'offline' });
}
describe('Páginas com dados de produção', () => {
  it('não fabrica chaves de API nem expõe credenciais locais falsas', async () => {
    localStorage.setItem('zapai_api_keys', JSON.stringify([{ name: 'Falsa', key: 'zf_live_fake', status: 'Ativa' }]));
    await render(<Settings />, '/settings?tab=api-keys');
    expect(document.body.textContent).not.toContain('zf_live_fake');
    expect(document.body.textContent).not.toContain('Gerar Nova Chave');
  });
  it('mostra somente o idioma implementado sem simular tradução', async () => {
    await render(<Settings />, '/settings?tab=idioma');
    expect(document.body.textContent).toContain('Português');
    expect(document.body.textContent).not.toContain('English');
    expect(document.body.textContent).not.toContain('Español');
  });
  it('não oferece alteração de foto sem implementação nem salva perfil ausente', async () => {
    await render(<Settings />, '/settings?tab=perfil');
    expect(document.body.textContent).not.toContain('Alterar foto');
    const save = [...document.querySelectorAll('button')].find(b => b.textContent === 'Salvar Alterações');
    expect(save?.disabled).toBe(true);
  });
  it('mantém o mesmo contato em números WhatsApp distintos', async () => {
    state.contacts = ['centro', 'norte'].map((sessionId, index) => ({ id: String(index), name: sessionId, phone: '5511999990000', conversationId: String(index), sessionId, updatedAt: '2026-10-06T12:00:00Z' }));
    await render(<Contacts />, '/contacts');
    expect(state.props.counts).toMatchObject({ all: 2 });
  });
  it('usa DDD somente para agregação, sem inventar localização individual', () => {
    const model = dashboard();
    expect(model.map.dddRows[0].count).toBe(1);
    expect(model.map.leadPins).toHaveLength(0);
  });
  it('aceita coordenadas reais e rejeita coordenadas inválidas', () => {
    expect(dashboard('Coordenadas: -23, -46').map.leadPins).toHaveLength(1);
    expect(dashboard('Coordenadas: 123.5, -46.5').map.leadPins).toHaveLength(0);
  });
  it('expõe a falha de carregar conexões e permite repetir a consulta', async () => {
    vi.mocked(apiService.listSessions).mockRejectedValueOnce(new Error('Sessões indisponíveis'));
    await render(<Connections />, '/connections');
    expect(document.body.textContent).toContain('Sessões indisponíveis');
    const retry = [...document.querySelectorAll('button')].find(b => b.textContent === 'Tentar novamente');
    expect(retry).toBeDefined();
    await act(async () => retry?.click());
    expect(apiService.listSessions).toHaveBeenCalledTimes(2);
    expect(document.body.textContent).not.toContain('Sessões indisponíveis');
  });
  it('a atualização de conexões consulta o estado real novamente', async () => {
    await render(<Connections />, '/connections');
    await act(async () => (state.props.onRefresh as () => void)());
    expect(apiService.listSessions).toHaveBeenCalledTimes(2);
  });
  it('abre a implementação canônica do assistente somente sob demanda', async () => {
    await render(<ZaibotFloatingAssistant />, '/dashboard');
    expect(document.body.textContent).not.toContain('Copiloto canônico');
    await act(async () => (document.querySelector('[aria-label="Abrir Assistente ZAI"]') as HTMLButtonElement).click());
    expect(document.body.textContent).toContain('Copiloto canônico');
  });
  it('não inventa uma campanha nem persiste fluxo quando o provedor não retorna mensagens', async () => {
    state.contacts = [];
    await render(<Campaigns />, '/campaigns');
    const context = document.querySelector('[aria-label="Contexto da campanha"]') as HTMLTextAreaElement;
    expect(context).not.toBeNull();
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set?.call(context, 'Vender materiais para novos clientes');
      context.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const next = [...document.querySelectorAll('button')].find(b => b.textContent?.includes('Próximo Passo'));
    await act(async () => next?.click());
    expect(apiService.generateCampaignAI).toHaveBeenCalled();
    expect(apiService.createQuickReply).not.toHaveBeenCalled();
    expect(notify.error).toHaveBeenCalled();
    expect(notify.success).not.toHaveBeenCalled();
  });
  it('traduz rótulos conhecidos sem modificar valores e nomes personalizados', () => {
    expect(businessLabel('Open')).toBe('Em atendimento');
    expect(businessLabel('price_request')).toBe('Pedido de preço');
    expect(businessLabel('send_price')).toBe('Enviar preço');
    expect(businessLabel('Cliente VIP • Sul')).toBe('Cliente VIP • Sul');
  });
  it('distingue métricas indisponíveis de zero medido', () => {
    const unavailable = createAnalyticsLovableViewModel({ metrics: null, conversationCount: 0 });
    expect(unavailable.kpis[0].value).toBe('—');
    expect(unavailable.kpis[2].value).toBe('—');
    const measured = createAnalyticsLovableViewModel({ metrics: { messagesToday: 0, activeChats: 0, aiResponses: 0 }, conversationCount: 0 });
    expect(measured.kpis[0].value).toBe('0');
    expect(measured.kpis[1].value).toBe('0');
  });
  it('não distribui totais em horários ou temperaturas fictícias', () => {
    const model = createAnalyticsLovableViewModel({ metrics: { messagesToday: 100, aiResponses: 20 }, conversationCount: 10 });
    expect(model.chartData).toEqual([]);
    expect(model.tempDistribution.reduce((sum, item) => sum + item.value, 0)).toBe(0);
    expect(model.kpis[0].hint).not.toContain('+12%');
  });
});
