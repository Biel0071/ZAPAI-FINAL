import { act, type ComponentProps } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MessageRow } from '@/pages/Inbox/components/MessageRow';
import { formatTime } from '@/pages/Inbox/utils';

vi.mock('@/core/runtime/hooks/useProtectedMediaUrl', () => ({ useProtectedMedia: () => ({ url: null, loading: false }) }));
vi.mock('@/components/inbox/AIMessageFeedback', () => ({ AIMessageFeedback: () => <button type="button">Avaliar resposta</button> }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root | undefined;
afterEach(async () => { if (root) await act(async () => root?.unmount()); root = undefined; document.body.innerHTML = ''; });
function props(): ComponentProps<typeof MessageRow> {
  return {
    message: { id: 'message-1', conversationId: 'chat-1', content: 'Mensagem recebida', fromMe: true, isAI: true, createdAt: '2026-10-06T09:33:00Z', status: 'delivered' },
    onReact: vi.fn(), onOpenMediaPreview: vi.fn(), isMenuOpen: false, isReactionPickerOpen: false,
    onToggleMenu: vi.fn(), onToggleReactionPicker: vi.fn(), onCopyMessage: vi.fn(), onReplyMessage: vi.fn(),
    onForwardMessage: vi.fn(), onDeleteMessage: vi.fn(), onDownloadMedia: vi.fn(), onToggleAudio: vi.fn(),
    isAudioLoading: false, isAudioPlaying: false, audioProgress: 0, audioDuration: 0, backendOnline: true,
  };
}
async function render(input: ComponentProps<typeof MessageRow>) {
  const container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
  await act(async () => root!.render(<MessageRow {...input} />));
}
describe('Rodapé de mensagem', () => {
  it('mantém horário, entrega e opções no fim da bolha sem controles aninhados', async () => {
    const input = props(); await render(input);
    const time = document.querySelector('time');
    expect(time).not.toBeNull();
    expect(time?.getAttribute('datetime')).toBe(input.message.createdAt);
    expect(time?.textContent).toBe(formatTime(input.message.createdAt));
    const menu = document.querySelector<HTMLButtonElement>('button[aria-label="Opções da mensagem"]');
    expect(menu).not.toBeNull();
    expect(time?.parentElement).toBe(menu?.parentElement);
    expect(menu?.parentElement?.parentElement?.lastElementChild).toBe(menu?.parentElement);
    expect(document.querySelector('button button')).toBeNull();
    await act(async () => menu!.click());
    expect(input.onToggleMenu).toHaveBeenCalledExactlyOnceWith('message-1');
  });
  it('mostra horário indisponível sem inventar o momento atual', async () => {
    const input = props(); input.message = { ...input.message, fromMe: false, isAI: false, createdAt: '' };
    await render(input);
    expect(document.querySelector('time')?.textContent).toBe('--:--');
  });
  it('usa horário original do WhatsApp e informa separadamente a chegada ao sistema', async () => {
    const input = props(); input.message.timestamp = '2026-10-05T09:33:00Z';
    await render(input);
    expect(document.querySelector('time')?.textContent).toBe(formatTime(input.message.timestamp));
    expect(document.querySelector('time')?.getAttribute('datetime')).toBe(input.message.timestamp);
    expect(document.querySelector('time')?.title).toContain(input.message.createdAt);
  });
  it('atualiza conteúdo e horário sincronizados mesmo sem mudar id ou status', async () => {
    const input = props(); await render(input);
    const refreshed = { ...input, message: { ...input.message, content: 'Conteúdo sincronizado', timestamp: '2026-10-06T12:01:00Z' } };
    await act(async () => root!.render(<MessageRow {...refreshed} />));
    expect(document.body.textContent).toContain('Conteúdo sincronizado');
    expect(document.querySelector('time')?.getAttribute('datetime')).toBe(refreshed.message.timestamp);
  });
});
