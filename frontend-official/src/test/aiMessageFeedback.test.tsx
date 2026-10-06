import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AIMessageFeedback } from '@/components/inbox/AIMessageFeedback';
const mocks = vi.hoisted(() => ({ request: vi.fn(), toast: vi.fn() }));
vi.mock('@/core/services/apiService', () => ({ API_ORIGIN: '', requestApiEndpoint: mocks.request }));
vi.mock('@/state/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root;
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }));
  const container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); document.body.innerHTML = ''; vi.unstubAllGlobals(); });
async function rate() {
  await act(async () => root.render(<AIMessageFeedback conversationId="chat-1" messageId="message-1" aiResponseText="Resposta oficial" />));
  await act(async () => document.querySelector<HTMLButtonElement>('button[title="Resposta eficaz (Gostei)"]')!.click());
}
describe('Feedback real da mensagem', () => {
  it('usa o cliente autenticado e confirma somente o resultado persistido', async () => {
    mocks.request.mockResolvedValue({ success: true, eventId: 42 }); await rate();
    expect(mocks.request).toHaveBeenCalledWith('/api/ai/evolution/feedback', 'POST', expect.objectContaining({ conversationId: 'chat-1', rating: 'positive' }));
    expect(fetch).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Experiência positiva registrada!' }));
  });
  it('mostra a falha do servidor e permite repetir sem marcar como salvo', async () => {
    mocks.request.mockResolvedValue({ success: false, error: 'Nenhuma experiência encontrada.' }); await rate();
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }));
    const button = document.querySelector<HTMLButtonElement>('button[title="Resposta eficaz (Gostei)"]')!;
    expect(button.className).not.toContain('font-bold');
    expect(button.disabled).toBe(false);
  });
  it('não confirma erro de autorização', async () => {
    mocks.request.mockRejectedValue(new Error('Sessão expirada.')); await rate();
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ description: 'Sessão expirada.', variant: 'destructive' }));
    expect(mocks.toast).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'Experiência positiva registrada!' }));
  });
});
