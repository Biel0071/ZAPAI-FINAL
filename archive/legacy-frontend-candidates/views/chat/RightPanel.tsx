import { useEffect, useMemo, useState } from 'react';
import { MonochromeIcon } from '../../components/icons/MonochromeIcon';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { SidePanel } from '../../components/ui/SidePanel';
import { StatePanel } from '../../components/ui/StatePanel';
import { Tabs } from '../../components/ui/Tabs';
import { Toggle } from '../../components/ui/Toggle';
import { AiEngineStatus } from '../../lib/aiEngine';
import { Conversation, QuickReply } from '../../types';
import { getDddMeta } from '../../utils/ddd';
import { conversationDisplayName } from '../../utils/inbox';

type RightPanelProps = {
  selectedConversation: Conversation | null;
  quickReplies: QuickReply[];
  aiStatus: AiEngineStatus | null;
  connectionStatus: 'offline' | 'connecting' | 'connected' | 'qr';
  updatingConversationState: boolean;
  onAppendQuickReply: (content: string) => void;
  onSendQuickReply: (content: string) => void;
  onSetConversationMode: (mode: 'ai' | 'human') => void;
  onToggleConversationAi: (value: boolean) => void;
};

function temperatureLabel(value: string | undefined) {
  const normalized = String(value || 'cold').toLowerCase();

  if (normalized.includes('hot') || normalized.includes('quente')) {
    return {
      badge: 'Prioridade alta',
      className: 'border-rose-500/20 bg-rose-500/8 text-rose-100',
    };
  }

  if (normalized.includes('warm') || normalized.includes('morno')) {
    return {
      badge: 'Prioridade media',
      className: 'border-amber-500/20 bg-amber-500/8 text-amber-100',
    };
  }

  return {
    badge: 'Prioridade baixa',
    className: 'border-borderSoft bg-panelSoft/70 text-textSecondary',
  };
}

export function RightPanel({
  selectedConversation,
  quickReplies,
  aiStatus,
  connectionStatus,
  updatingConversationState,
  onAppendQuickReply,
  onSendQuickReply,
  onSetConversationMode,
  onToggleConversationAi,
}: RightPanelProps) {
  const [activeTab, setActiveTab] = useState<'summary' | 'replies'>('summary');
  const [replySearch, setReplySearch] = useState('');
  const [aiAutoEnabled, setAiAutoEnabled] = useState<boolean>(selectedConversation?.aiEnabled ?? true);

  useEffect(() => {
    setAiAutoEnabled(selectedConversation?.aiEnabled ?? true);
  }, [selectedConversation?.aiEnabled, selectedConversation?.id]);

  const dddMeta = useMemo(() => getDddMeta(selectedConversation?.phone || ''), [selectedConversation?.phone]);
  const temperature = useMemo(
    () => temperatureLabel(selectedConversation?.leadTemperature),
    [selectedConversation?.leadTemperature],
  );

  const filteredReplies = useMemo(() => {
    const normalized = replySearch.trim().toLowerCase();

    if (!normalized) {
      return quickReplies;
    }

    return quickReplies.filter((reply) =>
      [reply.title, reply.category, reply.content].join(' ').toLowerCase().includes(normalized),
    );
  }, [quickReplies, replySearch]);

  const summaryText =
    selectedConversation?.conversationSummary ||
    selectedConversation?.lastMessage ||
    'Sem resumo consolidado. O painel permanece funcional com fallback seguro.';

  return (
    <div className="space-y-3">
      <SidePanel title="Preview e acoes" subtitle="Resumo da conversa, modo de atendimento e respostas reutilizaveis">
        <div className="mb-4 flex items-center justify-between gap-3">
          <Tabs
            items={[
              { key: 'summary', label: 'RESUMO' },
              { key: 'replies', label: 'RESPOSTAS' },
            ]}
            activeKey={activeTab}
            onChange={(key) => setActiveTab(key as 'summary' | 'replies')}
          />
          <Badge
            variant={
              connectionStatus === 'connected'
                ? 'success'
                : connectionStatus === 'offline'
                  ? 'neutral'
                  : 'warning'
            }
          >
            {connectionStatus}
          </Badge>
        </div>

        {activeTab === 'summary' ? (
          <div className="space-y-3">
            {!selectedConversation ? (
              <StatePanel
                tone="empty"
                title="Selecione uma conversa"
                description="O painel lateral continua disponivel para status global mesmo antes da escolha de um atendimento."
              />
            ) : (
              <>
                <div className="rounded-2xl border border-borderSoft bg-panelSoft/70 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-textPrimary">
                        {conversationDisplayName(selectedConversation)}
                      </p>
                      <p className="mt-1 text-xs text-textSecondary">{selectedConversation.phone}</p>
                    </div>
                    <span className={`rounded-full border px-2 py-1 text-[11px] ${temperature.className}`}>
                      {temperature.badge}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-2 text-xs">
                    <div className="flex items-center justify-between rounded-xl border border-borderSoft bg-panel px-3 py-2">
                      <span className="text-textSecondary">Regiao</span>
                      <span className="text-textPrimary">
                        {dddMeta ? `${dddMeta.stateCode} • ${dddMeta.region}` : 'Nao identificado'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-xl border border-borderSoft bg-panel px-3 py-2">
                      <span className="text-textSecondary">Agente</span>
                      <span className="text-textPrimary">{selectedConversation.assignedAgent || 'Nao atribuido'}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-xl border border-borderSoft bg-panel px-3 py-2">
                      <span className="text-textSecondary">Modo</span>
                      <span className="text-textPrimary">{selectedConversation.humanActive ? 'Manual' : 'AI ativo'}</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-borderSoft bg-panelSoft/70 p-4">
                  <div className="flex items-center gap-2">
                    <MonochromeIcon name="chart" className="h-4 w-4 text-textMuted" />
                    <p className="text-sm font-semibold text-textPrimary">Resumo da conversa</p>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-textSecondary">{summaryText}</p>
                </div>

                <div className="rounded-2xl border border-borderSoft bg-panelSoft/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-textPrimary">Controle de atendimento</p>
                      <p className="mt-1 text-xs text-textSecondary">
                        Ajusta IA automatica e modo humano sem depender de refresh total do Inbox.
                      </p>
                    </div>
                    <Toggle
                      checked={aiAutoEnabled}
                      onChange={(value) => {
                        setAiAutoEnabled(value);
                        onToggleConversationAi(value);
                      }}
                    />
                  </div>

                  <div className="mt-4 grid gap-2">
                    <Button
                      type="button"
                      variant={selectedConversation.humanActive ? 'primary' : 'secondary'}
                      disabled={updatingConversationState}
                      onClick={() => onSetConversationMode('human')}
                    >
                      Atendimento manual
                    </Button>
                    <Button
                      type="button"
                      variant={!selectedConversation.humanActive ? 'primary' : 'secondary'}
                      disabled={updatingConversationState}
                      onClick={() => onSetConversationMode('ai')}
                    >
                      IA conduzindo
                    </Button>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Badge variant={aiStatus?.active ? 'success' : 'warning'}>
                      {aiStatus?.active ? 'AI engine disponivel' : 'AI engine em fallback'}
                    </Badge>
                    {selectedConversation.nextAction ? <Badge variant="neutral">{selectedConversation.nextAction}</Badge> : null}
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <label className="flex items-center gap-2 rounded-xl border border-borderSoft bg-panelSoft/80 px-3 py-2">
              <MonochromeIcon name="search" className="h-4 w-4 text-textMuted" />
              <input
                value={replySearch}
                onChange={(event) => setReplySearch(event.target.value)}
                placeholder="Filtrar respostas"
                className="w-full bg-transparent text-sm text-textPrimary outline-none placeholder:text-textMuted"
              />
            </label>

            {filteredReplies.length === 0 ? (
              <StatePanel
                compact
                tone="empty"
                title="Nenhuma resposta encontrada"
                description="As respostas rapidas continuam disponiveis assim que a API ou o fallback devolverem itens."
              />
            ) : (
              <div className="space-y-2">
                {filteredReplies.map((reply) => (
                  <div key={reply.id} className="rounded-2xl border border-borderSoft bg-panelSoft/70 p-3">
                    <p className="text-sm font-semibold text-textPrimary">{reply.title}</p>
                    <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-textMuted">{reply.category}</p>
                    <p className="mt-3 line-clamp-3 text-sm leading-6 text-textSecondary">{reply.content}</p>

                    <div className="mt-3 flex gap-2">
                      <Button type="button" variant="secondary" className="flex-1" onClick={() => onAppendQuickReply(reply.content)}>
                        Inserir
                      </Button>
                      <Button
                        type="button"
                        className="flex-1"
                        disabled={!selectedConversation}
                        onClick={() => onSendQuickReply(reply.content)}
                      >
                        Enviar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </SidePanel>
    </div>
  );
}
