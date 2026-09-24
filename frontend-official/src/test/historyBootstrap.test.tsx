import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { HistoryBootstrapPanel } from '@/components/evolution/HistoryBootstrapPanel';

const request = vi.hoisted(() => vi.fn());
vi.mock('@/services/apiService', () => ({ requestApiEndpoint: request }));
let root: Root | undefined;
afterEach(async () => { if (root) await act(async () => root?.unmount()); document.body.innerHTML = ''; request.mockReset(); });
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
async function renderPanel(compact = false) {
  const container = document.createElement('div'); document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => { root!.render(<HistoryBootstrapPanel compact={compact} />); });
}
const button = (text: string) => [...document.querySelectorAll('button')].find(b => b.textContent === text)!;
const checkbox = () => document.querySelector<HTMLInputElement>('input[type=checkbox]')!;

const candidate = { name: 'Camila', personality: 'Seja natural e consulte o catálogo oficial.', partial: true, pendingCommercial: ['Preço antigo: confirmar'], gaps: ['Autoria incerta'] };
const status = { total: 251, imported: 251, pending: 0, failed: 0, conversations: 20, media_pending: 0, media_failed: 2, media_done: 5, media_unsupported: 1,
  coverage: 'Somente o histórico disponibilizado pelo WhatsApp.', learning_enabled: true, target_agent_key: 'camila', history_requests_without_response: 2,
  drafts: [{ id: '1', revision: 'reviewed-version', status: 'draft', candidate, target_agent_key: 'camila' }] };

function mockApi() {
  request.mockImplementation(async (url: string, method = 'GET') => {
    if (url === '/api/ai/history') return { sessions: [{ session_id: 'loja', session_name: 'Loja' }], agents: [{ key: 'camila', name: 'Camila', personality: 'Anterior', active: true }] };
    if (url.endsWith('/profile')) return {profile:{store_id:null,segment:'',service_type:'',evolution_mode:'limited'},memory:{pending:0,total:251}};
    if (url.endsWith('/agents') && method==='POST') return {agent:{key:'new',name:'Joana',sessionIds:['loja']}};
    if (url.endsWith('/status')) return structuredClone(status);
    if (method === 'POST') return { success: true };
    return {};
  });
}

describe('history bootstrap review', () => {
  it('shows actual coverage and never presents import as guaranteed full account history', async () => {
    mockApi(); await renderPanel(true);
    expect(document.body.textContent).toContain('251 / 251 mensagens recebidas importadas');
    expect(document.body.textContent).toContain('Somente o histórico disponibilizado');
    expect(document.body.textContent).toContain('não confirma que todo o histórico');
    expect(button('Publicar versão revisada')?.disabled).toBe(true);
  });

  it('requires explicit review and saving edits before publication', async () => {
    mockApi(); await renderPanel();
    const publish = button('Publicar versão revisada');
    expect(publish).toBeDisabled();
    await act(async () => checkbox().click());
    expect(publish).toBeEnabled();
    await act(async () => {
      const textarea = [...document.querySelectorAll('textarea')].find(t=>t.closest('label')?.textContent?.includes('Instruções propostas'))!;
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea, 'Texto revisado');
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(publish).toBeDisabled();
    expect(checkbox()).not.toBeChecked();
    expect(request.mock.calls.some(call => String(call[0]).endsWith('/publish'))).toBe(false);
  });

  it('publishes only after the user reviews and clicks the explicit action', async () => {
    mockApi(); await renderPanel();
    const publish = button('Publicar versão revisada');
    await act(async () => checkbox().click());
    await act(async () => publish.click());
    expect(request).toHaveBeenCalledWith('/api/ai/history/loja/drafts/1/publish', 'POST', { reviewed: true, expectedRevision: 'reviewed-version' });
  });
});

async function fill(label:string,value:string) {
  await act(async()=>{
    const input=document.querySelector('[aria-label="'+label+'"]') as HTMLInputElement | HTMLTextAreaElement;
    const proto=input.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto,'value')!.set!.call(input,value);
    input.dispatchEvent(new Event('input',{bubbles:true}));
  });
}
it('manual creation requires a complete preview and explicitly binds the selected WhatsApp',async()=>{
  mockApi();await renderPanel();
  await act(async()=>button('Criar manualmente').click());
  expect(button('Revisar e ativar atendente')).toBeDisabled();
  await fill('Nome do novo atendente','Joana');await fill('Instruções do novo atendente','Atenda suporte com clareza.');
  await act(async()=>button('Revisar e ativar atendente').click());
  expect(request).toHaveBeenCalledWith('/api/ai/history/loja/agents','POST',expect.objectContaining({name:'Joana',reviewed:true,sessionIds:['loja']}));
});
it('provider failure never activates an agent or reports a successful preview',async()=>{
  mockApi();const previous=request.getMockImplementation()!;
  request.mockImplementation(async(...args)=>{if(String(args[0]).endsWith('/preview'))throw new Error('IA indisponível');return previous(...args);});
  await renderPanel();await act(async()=>button('Criar com IA').click());
  await fill('Descrição do atendente','Atenda uma floricultura');
  await act(async()=>button('Gerar prévia').click());
  expect(document.body.textContent).toContain('IA indisponível');
  expect(button('Revisar e ativar atendente')).toBeUndefined();
  expect(request.mock.calls.some(c=>String(c[0]).endsWith('/agents'))).toBe(false);
});
