import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { MetricGrid } from '../components/modules/overview/MetricGrid';
import { OverviewPageHeader } from '../components/modules/overview/OverviewPageHeader';
import { StatusGrid } from '../components/modules/overview/StatusGrid';
import { TrendBarsCard } from '../components/modules/overview/TrendBarsCard';
import { StatePanel } from '../components/ui/StatePanel';
import { useAiIntelligencePanel } from '../hooks/useAiIntelligencePanel';
import { formatCount } from '../views/overview/formatters';

function badgeVariant(priority: string) {
  if (priority === 'high') {
    return 'danger';
  }

  if (priority === 'medium') {
    return 'warning';
  }

  return 'neutral';
}

function improvementTone(status: string) {
  if (status === 'applied') {
    return 'success';
  }

  if (status === 'approved') {
    return 'info';
  }

  if (status === 'ignored') {
    return 'neutral';
  }

  return 'warning';
}

export default function AIIntelligencePage() {
  const {
    approveImprovement,
    applyImprovement,
    busyDocs,
    busyImprovementId,
    data,
    error,
    ignoreImprovement,
    loading,
    refresh,
    refreshDocs,
    refreshing,
  } = useAiIntelligencePanel();

  return (
    <div className="space-y-4">
      <OverviewPageHeader
        title="Inteligencia interna"
        description="Memoria operacional, aprendizado supervisionado, insights de engenharia e backlog incremental de evolucao do ZAPAI CRM."
        refreshedAt={data?.state?.lastAnalyzedAt || data?.generatedAt}
        partial={Boolean(data?.degraded)}
        refreshing={refreshing}
        onRefresh={refresh}
      />

      {loading && !data ? (
        <StatePanel
          tone="loading"
          title="Montando a camada de inteligencia"
          description="A leitura combina memoria de conversa, health do runtime, analise de arquitetura e backlog de melhoria."
        />
      ) : null}

      {error ? (
        <StatePanel
          tone={data ? 'info' : 'error'}
          title={data ? 'Painel parcial carregado' : 'Falha ao carregar a inteligencia interna'}
          description={error}
        />
      ) : null}

      {data ? (
        <>
          <MetricGrid
            items={[
              {
                icon: 'contacts',
                label: 'Memorias',
                value: formatCount(data.metrics?.totalMemories),
                hint: `${formatCount(data.metrics?.summarizedMemories)} resumos estruturados disponiveis.`,
              },
              {
                icon: 'analytics',
                label: 'Insights',
                value: formatCount(data.metrics?.insightsGenerated),
                hint: `${formatCount(data.memory?.contactsPreferringAudio)} contatos com preferencia por audio.`,
              },
              {
                icon: 'diagnostics',
                label: 'Backlog pendente',
                value: formatCount(data.metrics?.pendingImprovements),
                hint: `${formatCount(data.metrics?.approvedImprovements)} aprovadas e ${formatCount(data.metrics?.appliedImprovements)} aplicadas.`,
              },
              {
                icon: 'dashboard',
                label: 'Docs gerados',
                value: formatCount(data.metrics?.docsGenerated),
                hint: `${formatCount(data.metrics?.audioIntentDetected)} sinais de voz detectados no aprendizado.`,
              },
            ]}
          />

          <div className="grid gap-4 xl:grid-cols-[1.4fr,1fr]">
            <TrendBarsCard
              title="Cadencia de aprendizado"
              subtitle="Evolucao recente de insights e melhorias geradas pela camada de inteligencia."
              points={data.timeline || []}
            />
            <StatusGrid title="Estado da IA" items={data.healthStatusItems || []} />
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.15fr,1fr]">
            <article className="crm-card p-4">
              <header className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-textPrimary">Insights recentes</h3>
                  <p className="mt-1 text-sm text-textSecondary">
                    Sinais extraidos de memoria, sentimento, voz e comportamento operacional.
                  </p>
                </div>
                <Badge variant="info">{formatCount(data.insights?.length)}</Badge>
              </header>

              {data.insights && data.insights.length > 0 ? (
                <div className="space-y-3">
                  {data.insights.slice(0, 8).map((insight) => (
                    <div key={insight.id} className="rounded-xl border border-borderSoft bg-panelSoft/70 px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-textPrimary">{insight.title}</p>
                        <Badge variant={badgeVariant(insight.severity || 'low')}>{insight.severity || 'info'}</Badge>
                      </div>
                      <p className="mt-2 text-sm text-textSecondary">{insight.description}</p>
                      <p className="mt-2 text-xs text-textMuted">
                        {insight.contactId || 'Sistema'} • {insight.createdAt || 'sem data'}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <StatePanel
                  compact
                  tone="empty"
                  title="Sem insights ainda"
                  description="Os sinais aparecem aqui conforme a memoria e a analise de engenharia observam novos eventos."
                />
              )}
            </article>

            <article className="crm-card p-4">
              <header className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-textPrimary">Documentacao automatica</h3>
                  <p className="mt-1 text-sm text-textSecondary">
                    Saidas estruturadas em docs/ para acelerar leitura tecnica e continuidade do projeto.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={refreshDocs}
                  disabled={busyDocs}
                >
                  {busyDocs ? 'Gerando...' : 'Gerar docs'}
                </Button>
              </header>

              {data.docs?.files && data.docs.files.length > 0 ? (
                <div className="space-y-3">
                  {data.docs.files.map((file) => (
                    <div key={file.file} className="rounded-xl border border-borderSoft bg-panelSoft/70 px-4 py-3">
                      <p className="text-sm font-semibold text-textPrimary">{file.file}</p>
                      <p className="mt-1 text-sm text-textSecondary">{file.note || 'Arquivo de apoio interno.'}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <StatePanel
                  compact
                  tone="empty"
                  title="Documentacao pendente"
                  description="A primeira geracao cria o snapshot tecnico em docs/ai-analysis, docs/system-map, docs/improvements e docs/learned-patterns."
                />
              )}
            </article>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.25fr,1fr]">
            <article className="crm-card p-4">
              <header className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-textPrimary">Backlog de melhorias</h3>
                  <p className="mt-1 text-sm text-textSecondary">
                    Sugestoes de engenharia e atendimento com aprovacao manual antes de qualquer rollout.
                  </p>
                </div>
                <Badge variant="warning">{formatCount(data.improvements?.length)}</Badge>
              </header>

              {data.improvements && data.improvements.length > 0 ? (
                <div className="space-y-3">
                  {data.improvements.slice(0, 8).map((improvement) => (
                    <div key={improvement.id} className="rounded-xl border border-borderSoft bg-panelSoft/70 px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-textPrimary">{improvement.title}</p>
                        <Badge variant={badgeVariant(improvement.priority)}>{improvement.priority}</Badge>
                        <Badge variant={improvementTone(improvement.status)}>{improvement.status}</Badge>
                      </div>
                      <p className="mt-2 text-sm text-textSecondary">{improvement.summary}</p>
                      <p className="mt-2 text-xs text-textMuted">{improvement.recommendation}</p>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {improvement.status === 'pending' ? (
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => approveImprovement(improvement.id)}
                            disabled={busyImprovementId === improvement.id}
                          >
                            Aprovar
                          </Button>
                        ) : null}
                        {improvement.status === 'approved' ? (
                          <Button
                            type="button"
                            variant="primary"
                            onClick={() => applyImprovement(improvement.id)}
                            disabled={busyImprovementId === improvement.id}
                          >
                            Marcar aplicada
                          </Button>
                        ) : null}
                        {improvement.status !== 'ignored' && improvement.status !== 'applied' ? (
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => ignoreImprovement(improvement.id)}
                            disabled={busyImprovementId === improvement.id}
                          >
                            Ignorar
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <StatePanel
                  compact
                  tone="empty"
                  title="Sem backlog gerado"
                  description="As recomendacoes aparecem aqui apos a analise consolidar problemas e oportunidades."
                />
              )}
            </article>

            <article className="crm-card p-4">
              <header className="mb-4">
                <h3 className="text-sm font-semibold text-textPrimary">Padroes detectados</h3>
                <p className="mt-1 text-sm text-textSecondary">
                  Leitura agregada de tags, intencoes e perguntas recorrentes para orientar produto e atendimento.
                </p>
              </header>

              <div className="space-y-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-textMuted">Top tags</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(data.patterns?.topTags || []).map((tag) => (
                      <Badge key={tag.label} variant="neutral">
                        {tag.label} • {tag.value}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-textMuted">Top intencoes</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(data.patterns?.topIntents || []).map((intent) => (
                      <Badge key={intent.label} variant="info">
                        {intent.label} • {intent.value}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-textMuted">Perguntas frequentes</p>
                  {(data.patterns?.frequentQuestions || []).length > 0 ? (
                    <div className="mt-2 space-y-2">
                      {data.patterns?.frequentQuestions?.slice(0, 6).map((question) => (
                        <div key={`${question.question}-${question.count}`} className="rounded-xl border border-borderSoft bg-panelSoft/70 px-4 py-3">
                          <p className="text-sm text-textPrimary">{question.question || 'Pergunta nao identificada'}</p>
                          <p className="mt-1 text-xs text-textMuted">{formatCount(question.count)} ocorrencias</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <StatePanel
                      compact
                      tone="empty"
                      title="Sem frequencia consolidada"
                      description="As perguntas recorrentes entram aqui conforme o aprendizado de conversas amadurece."
                    />
                  )}
                </div>
              </div>
            </article>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1fr,1.1fr]">
            <article className="crm-card p-4">
              <header className="mb-4">
                <h3 className="text-sm font-semibold text-textPrimary">Contatos em atencao</h3>
                <p className="mt-1 text-sm text-textSecondary">
                  Conversas com sentimento negativo, prontidao de compra ou preferencia por voz.
                </p>
              </header>

              {(data.memory?.recentAttention || []).length > 0 ? (
                <div className="space-y-3">
                  {data.memory?.recentAttention?.slice(0, 8).map((entry) => (
                    <div key={entry.contact_id} className="rounded-xl border border-borderSoft bg-panelSoft/70 px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-textPrimary">
                          {entry.name || entry.contact_id}
                        </p>
                        <Badge variant={entry.sentiment === 'negative' ? 'danger' : 'info'}>
                          {entry.sentiment || 'neutral'}
                        </Badge>
                        <Badge variant="neutral">{entry.intent || 'information'}</Badge>
                      </div>
                      <p className="mt-2 text-sm text-textSecondary">
                        {entry.summary || 'Sem resumo disponivel.'}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <StatePanel
                  compact
                  tone="empty"
                  title="Nenhum contato critico"
                  description="A lista e preenchida automaticamente quando a memoria identifica sinais de atencao."
                />
              )}
            </article>

            <article className="crm-card p-4">
              <header className="mb-4">
                <h3 className="text-sm font-semibold text-textPrimary">Estado atual e proximos passos</h3>
                <p className="mt-1 text-sm text-textSecondary">
                  Resumo tecnico do sistema para acelerar leitura de arquitetura e priorizacao de roadmap.
                </p>
              </header>

              <div className="space-y-3">
                {(data.reports?.problemsFound || []).slice(0, 4).map((problem) => (
                  <div key={problem.id || problem.title} className="rounded-xl border border-borderSoft bg-panelSoft/70 px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-textPrimary">{problem.title || 'Problema mapeado'}</p>
                      <Badge variant={badgeVariant(problem.severity || 'medium')}>
                        {problem.severity || 'medium'}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm text-textSecondary">{problem.detail || 'Sem detalhe adicional.'}</p>
                  </div>
                ))}

                {(data.reports?.nextSteps || []).slice(0, 4).map((step, index) => (
                  <div key={`${step.title}-${index}`} className="rounded-xl border border-borderSoft bg-panelSoft/70 px-4 py-3">
                    <p className="text-sm font-semibold text-textPrimary">{step.title || 'Proximo passo'}</p>
                    <p className="mt-2 text-sm text-textSecondary">{step.action || 'Sem acao detalhada.'}</p>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </>
      ) : null}
    </div>
  );
}
