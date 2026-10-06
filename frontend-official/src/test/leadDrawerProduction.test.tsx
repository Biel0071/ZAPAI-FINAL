import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { LeadDrawer } from '@/components/contacts/LeadDrawer';
import { apiService } from '@/core/services/apiService';
vi.mock('@/components/contacts/LeadKnowledgeGraph', () => ({ LeadKnowledgeGraph: () => null }));
vi.mock('@/core/services/notifyService', () => ({ notify: { success: vi.fn(), info: vi.fn(), error: vi.fn() } }));
vi.mock('@/core/services/apiService', () => ({ apiService: { getConversationInsights: vi.fn().mockResolvedValue({}), getAIFollowupPlan: vi.fn(), getAIRecoveryApproach: vi.fn() } }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root; let container: HTMLDivElement;
const lead = { id: '1', name: 'Ana', phone: '5511999990000', conversationId: 'conv1', sessionId: 'centro' };
beforeEach(() => { vi.clearAllMocks(); container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); });
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
async function render(item = lead) { await act(async () => root.render(<MemoryRouter><LeadDrawer lead={item} onClose={vi.fn()} /></MemoryRouter>)); }
it('não inventa métricas, intenção, desconto ou qualificação de um contato', async () => {
  await render();
  for (const text of ['84%', 'Compra Direta / Orçamento', 'Muito Interessado', 'Enviar proposta com desconto', 'Alta (Responde em', 'Follow-up (6)']) expect(document.body.textContent).not.toContain(text);
});
it('preserva confiança medida igual a zero', async () => {
  vi.mocked(apiService.getConversationInsights).mockResolvedValueOnce({ data: { confidence: 0 } } as never);
  await render();
  expect(document.body.textContent).toContain('0%');
});
it('descarta a análise atrasada do contato anterior', async () => {
  let complete: (value: unknown) => void = () => {};
  vi.mocked(apiService.getConversationInsights).mockReturnValueOnce(new Promise(resolve => { complete = resolve; }) as never);
  await render();
  await render({ ...lead, id: '2', name: 'Bia', conversationId: 'conv2' });
  await act(async () => complete({ data: { summary: 'ANÁLISE EXCLUSIVA DE ANA' } }));
  expect(document.body.textContent).not.toContain('ANÁLISE EXCLUSIVA DE ANA');
});
