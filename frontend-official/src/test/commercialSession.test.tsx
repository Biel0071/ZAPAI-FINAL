import { afterEach, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { HistoryBootstrapPanel } from '@/components/evolution/HistoryBootstrapPanel';
const request = vi.hoisted(() => vi.fn());
vi.mock('@/core/services/apiService', () => ({ requestApiEndpoint: request }));
let root: Root;
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
afterEach(async () => { await act(async () => root?.unmount()); document.body.innerHTML = ''; request.mockReset(); });
const shared = { id: 'shared', name: 'Loja oficial', segment: 'Vendas', knowledge: 'Conhecimento', address: 'Rua real', phone: '123', website: 'https://loja.com', business_hours: '9 às 18', catalog_summary: 'Produtos', policies: 'Política', settings: { untouched: true }, attendant_config: { dna: 'preservar' }, numbers: [{ sessionId: 'zap', sessionName: 'Vendas' }, { sessionId: 'other', sessionName: 'Suporte' }] };
async function render() {
  request.mockImplementation(async (url: string, method = 'GET') => {
    if (url === '/api/stores') return { success: true, stores: [shared] };
    if (url === '/api/ai/history') return { sessions: [{ session_id: 'zap', session_name: 'Vendas' }] };
    if (url.endsWith('/profile') && method === 'GET') return { profile: { store_id: 'shared', segment: 'Vendas', service_type: 'Suporte', evolution_mode: 'paused' } };
    if (method === 'POST') return { id: 'own' };
    return { success: true };
  });
  const element = document.createElement('div'); document.body.appendChild(element); root = createRoot(element);
  await act(async () => root.render(<HistoryBootstrapPanel requestedMode="store" initialSessionId="zap" />));
}
const click = async (text: string) => act(async () => { [...document.querySelectorAll('button')].find(b => b.textContent === text)!.click(); });
it('loads full commercial fields and identifies every shared number without polling history', async () => {
  await render();
  expect(document.body.textContent).toContain('Suporte');
  expect(document.querySelector<HTMLInputElement>('[aria-label="Endereço"]')?.value).toBe('Rua real');
  expect(request.mock.calls.some(([url]) => String(url).endsWith('/status'))).toBe(false);
  await click('Salvar dados comerciais');
  expect(request).toHaveBeenCalledWith('/api/ai/history/stores/shared', 'PUT', expect.objectContaining({ settings: { untouched: true }, attendant_config: { dna: 'preservar' }, address: 'Rua real' }));
});
it('copies an exclusive store and retries the same created id when linking fails', async () => {
  await render(); await click('Dados próprios deste WhatsApp'); await click('Copiar loja atual');
  const original = request.getMockImplementation()!; let failures = 1;
  request.mockImplementation(async (...args) => { if (String(args[0]).endsWith('/profile') && args[1] === 'PUT' && failures-- > 0) throw new Error('Vínculo indisponível'); return original(...args); });
  await click('Criar e vincular dados próprios');
  expect(document.body.textContent).toContain('Vínculo indisponível');
  await click('Tentar vínculo novamente');
  expect(request.mock.calls.filter(([url, method]) => url === '/api/ai/history/stores' && method === 'POST')).toHaveLength(1);
  expect(request).toHaveBeenCalledWith('/api/ai/history/zap/profile', 'PUT', expect.objectContaining({ storeId: 'own', evolutionMode: 'paused' }));
});
it('starts exclusive data empty and never fabricates commercial information', async () => {
  await render(); await click('Dados próprios deste WhatsApp');
  expect(document.querySelector<HTMLInputElement>('[aria-label="Nome da loja"]')?.value).toBe('');
  expect(document.querySelector<HTMLTextAreaElement>('[aria-label="Conhecimento oficial"]')?.value).toBe('');
  expect([...document.querySelectorAll('button')].find(button => button.textContent === 'Criar e vincular dados próprios')).toBeDisabled();
  expect(request.mock.calls.some(([, method]) => method === 'POST')).toBe(false);
});
it('preserves session preferences when linking an existing commercial store', async () => {
  await render(); await click('Salvar vínculo e atendimento');
  expect(request).toHaveBeenCalledWith('/api/ai/history/zap/profile', 'PUT', { storeId: 'shared', segment: 'Vendas', serviceType: 'Suporte', evolutionMode: 'paused' });
});
it('does not report success when the store update returns false', async () => {
  await render(); const original = request.getMockImplementation()!;
  request.mockImplementation(async (...args) => String(args[0]).endsWith('/stores/shared') ? { success: false } : original(...args));
  await click('Salvar dados comerciais');
  expect(document.body.textContent).toContain('Não foi possível salvar os dados comerciais.');
  expect(document.body.textContent).not.toContain('Dados comerciais salvos.');
});
it('keeps commercial writes disabled until the selected profile has loaded', async () => {
  await render();
  const original = request.getMockImplementation()!;
  request.mockImplementation(async (...args) => { if (String(args[0]).endsWith('/profile') && !args[1]) throw new Error('Perfil indisponível'); return original(...args); });
  await click('Usar loja compartilhada');
  // Reloading is exposed only after an error; simulate a session refresh by remounting.
  await act(async () => root.render(<HistoryBootstrapPanel key="reload" requestedMode="store" initialSessionId="zap" />));
  expect(document.body.textContent).toContain('Perfil indisponível');
  expect(document.querySelector('fieldset')).toBeDisabled();
});
