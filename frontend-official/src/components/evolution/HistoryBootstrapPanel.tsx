import { useCallback, useEffect, useRef, useState } from 'react';
import { requestApiEndpoint } from '@/services/apiService';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Chats, PencilSimple, Sparkle, Storefront, X, FileText, Headphones, Image as ImageIcon } from '@phosphor-icons/react';

type Agent = { key: string; name: string; personality: string; active: boolean; sessionIds?: string[] };
type Candidate = { name: string; personality: string; partial?: boolean; summaryNote?: string; observedStyle?: string[]; patterns?: string[]; products?: string[]; pendingCommercial?: string[]; conflicts?: string[]; gaps?: string[]; examples?: string[]; evidenceIds?: (string | number)[] };
type Draft = { id: string; revision: string; status: string; candidate: Candidate; cursor_id: string; watermark: string; target_agent_key?: string; last_error?: string };
type Status = { total: number; imported: number; pending: number; failed: number; conversations: number; media_identified: number; media_pending: number; media_failed: number; media_done: number; media_downloaded: number; media_unsupported: number; first_message_at?: string; last_message_at?: string; last_error?: string; coverage: string; learning_enabled: boolean; target_agent_key?: string; history_requests_without_response: number; drafts: Draft[] };
type Evidence = { id: string; text: string; media_text: string; media_state: string; media_type?: string; media_path?: string; from_me: boolean; origin: string; occurred_at: string };
type Simulation = { question: string; before: string; after: string; note: string; evidenceId: string };
const labels: Record<string, string> = { analyzing: 'Analisando', draft: 'Aguardando revisão', published: 'Publicado', discarded: 'Descartado' };
const date = (value?: string) => value ? new Date(value).toLocaleDateString('pt-BR') : '—';
const mediaUrl = (value?: string) => {
  if (!value) return null;
  try {
    const url = new URL(value, window.location.origin);
    return url.origin === window.location.origin ? url.href : null;
  } catch { return null; }
};

export function HistoryBootstrapPanel({ 
  compact = false, 
  requestedMode,
  initialSessionId,
  onClose,
  isModal = false,
}: { 
  compact?: boolean; 
  requestedMode?: 'manual' | 'prompt' | 'history' | 'store' | null;
  initialSessionId?: string;
  onClose?: () => void;
  isModal?: boolean;
}) {
  const [mode, setMode] = useState<'history' | 'manual' | 'prompt' | 'store'>(requestedMode || 'history');
  useEffect(() => { if (requestedMode) setMode(requestedMode); }, [requestedMode]);
  useEffect(() => { if (initialSessionId) setSessionId(initialSessionId); }, [initialSessionId]);
  const [stores,setStores] = useState<{id:string;name:string;segment:string;knowledge:string}[]>([]);
  const [storeId,setStoreId] = useState('');
  const [storeName,setStoreName] = useState('');
  const [knowledge,setKnowledge] = useState('');
  const [segment,setSegment] = useState('');
  const [serviceType,setServiceType] = useState('');
  const [evolutionMode,setEvolutionMode] = useState('limited');
  const [memoryStatus,setMemoryStatus] = useState<{pending:number;total:number;last_error?:string}|null>(null);
  const [prompt,setPrompt] = useState('');
  const [editPrompt,setEditPrompt] = useState('');
  const [editCandidate,setEditCandidate] = useState<{name:string;personality:string}|null>(null);
  const [preview,setPreview] = useState<{name:string;personality:string}|null>(null);
  const [extraSessions,setExtraSessions] = useState<string[]>([]);
  const [versions,setVersions] = useState<{id:string;snapshot:Record<string,string>;reason:string;created_at:string}[]>([]);
  const [sessions, setSessions] = useState<{ session_id: string; session_name: string }[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [sessionId, setSessionId] = useState('');
  const [status, setStatus] = useState<Status | null>(null);
  const [target, setTarget] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [personality, setPersonality] = useState('');
  const [reviewed, setReviewed] = useState(false);
  const [simulation, setSimulation] = useState<Simulation | null>(null);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [mediaEvidence, setMediaEvidence] = useState<Evidence[]>([]);
  const [mediaCursor, setMediaCursor] = useState<string | null>(null);
  const [showMedia, setShowMedia] = useState(false);
  const [nextEvidence, setNextEvidence] = useState<string | null>(null);
  const [showEvidence, setShowEvidence] = useState(false);
  const initialized = useRef('');
  const chosenVersion = useRef('');
  const currentSession = useRef(sessionId);
  currentSession.current = sessionId;
  const defaultAgentKey = agents.find(a => a.key === 'camila')?.key || '';
  useEffect(() => { const agent = agents.find(a => a.key === target); setEditCandidate(agent ? { name: agent.name, personality: agent.personality } : null); }, [target, agents]);
  const base = `/api/ai/history/${encodeURIComponent(sessionId)}`;
  const draft = status?.drafts.find(d => d.id === chosenVersion.current) || status?.drafts.find(d => d.status === 'draft' || d.status === 'analyzing') || status?.drafts[0];
  const dirty = Boolean(draft && (name !== draft.candidate.name || personality !== draft.candidate.personality));
  const syncReady = Boolean(sessionId && status && status.total > 0 && status.pending === 0 && status.failed === 0 && !status.last_error);

  useEffect(() => {
    let alive = true;
    const load = () => requestApiEndpoint<{ sessions: typeof sessions; agents: Agent[]; stores: typeof stores }>('/api/ai/history').then(data => {
      if (!alive) return;
      setSessions(data.sessions); setAgents(data.agents); setStores(data.stores || []);
      setSessionId(current => initialSessionId || current || data.sessions[0]?.session_id || '');
    }).catch(e => { if (alive) setError(e.message || 'Não foi possível consultar o histórico.'); });
    void load();
    const timer = setInterval(load, 30000);
    return () => { alive = false; clearInterval(timer); };
  }, [initialSessionId]);

  const refresh = useCallback(async () => {
    if (!sessionId) return;
    const data = await requestApiEndpoint<Status>(`${base}/status`);
    if (currentSession.current !== sessionId) return;
    setStatus(data);
    const current = data.drafts.find(d => d.id === chosenVersion.current) || data.drafts.find(d => d.status === 'draft' || d.status === 'analyzing') || data.drafts[0];
    chosenVersion.current = current?.id || '';
    const key = `${sessionId}:${current?.id || ''}:${current?.status || ''}`;
    if (initialized.current !== key) {
      initialized.current = key;
      setTarget(data.target_agent_key || defaultAgentKey);
      setName(current?.candidate.name || ''); setPersonality(current?.candidate.personality || '');
      setReviewed(false); setSimulation(null);
    }
  }, [sessionId, base, defaultAgentKey]);

  useEffect(() => {
    setStatus(null); setEvidence([]); setShowEvidence(false); setMediaEvidence([]); setShowMedia(false); setError(''); initialized.current = ''; chosenVersion.current = '';
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try { if (!stopped) await refresh(); } catch (e) { if (!stopped) setError(e instanceof Error ? e.message : 'Falha ao atualizar.'); }
      if (!stopped) timer = setTimeout(poll, 8000);
    };
    void poll();
    return () => { stopped = true; clearTimeout(timer); };
  }, [refresh]);

  useEffect(()=>{
    if(!sessionId) return;
    let alive=true;
    const load=()=>requestApiEndpoint<{profile:{store_id:string|null;segment:string;service_type:string;evolution_mode:string};memory:typeof memoryStatus}>(base+'/profile').then(data=>{
      if(!alive) return;
      setMemoryStatus(data.memory);setStoreId(data.profile.store_id || '');setSegment(data.profile.segment);setServiceType(data.profile.service_type);setEvolutionMode(data.profile.evolution_mode);
    }).catch(e=>{if(alive)setError(e.message || 'Memória indisponível.');});
    setPreview(null);setExtraSessions([]);setVersions([]);void load();
    return ()=>{alive=false;};
  },[sessionId,base]);
  const saveProfile=()=>requestApiEndpoint(base+'/profile','PUT',{storeId:storeId || null,segment,serviceType,evolutionMode});
  const action = async (fn: () => Promise<unknown>, message: string) => {
    setBusy(true); setError(''); setNotice('');
    try { await fn(); await refresh(); setNotice(message); }
    catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível concluir.'); }
    finally { setBusy(false); }
  };
  const loadEvidence = async (after = '0') => {
    const data = await requestApiEndpoint<{ items: Evidence[]; next: string | null }>(`${base}/evidence?after=${after}`);
    setEvidence(previous => after === '0' ? data.items : [...previous, ...data.items]); setNextEvidence(data.next); setShowEvidence(true);
  };
  const loadMediaEvidence = async (after = '0') => {
    const data = await requestApiEndpoint<{ items: Evidence[]; next: string | null }>(`${base}/evidence?media=1&after=${after}`);
    setMediaEvidence(previous => after === '0' ? data.items : [...previous, ...data.items]);
    setMediaCursor(data.next);
    setShowMedia(true);
  };
  const section = (title: string, values?: string[]) => values?.length ? <details className="rounded-lg border p-3"><summary className="cursor-pointer font-medium">{title} ({values.length})</summary><ul className="mt-2 space-y-2 text-sm">{values.map((v, i) => <li key={i}>{v}</li>)}</ul></details> : null;

  const panelHeader = isModal ? (
    <div className="flex items-center justify-between border-b border-border/50 bg-muted/20 px-6 py-4">
      <div>
        <h3 className="text-base font-display font-bold text-foreground flex items-center gap-2">
          <Sparkle className="h-5 w-5 text-primary" weight="fill" />
          Central de IA, Histórico & Atendentes
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Sincronize mensagens, interprete mídias e crie ou treine seu atendente de IA
        </p>
      </div>
      {onClose && (
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/40" onClick={onClose} title="Fechar">
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  ) : (
    <CardHeader className="pb-3 border-b border-border/40 bg-muted/10">
      <div className="flex items-center justify-between">
        <div>
          <CardTitle className="text-base font-display">Histórico do WhatsApp → atendente da loja</CardTitle>
          <CardDescription className="text-xs">Recupere conversas antigas e transforme atendimentos em uma proposta revisável. O atendente ativo só muda após publicação.</CardDescription>
        </div>
        {onClose && (
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground" onClick={onClose} title="Fechar">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </CardHeader>
  );

  return <div className={isModal ? "flex flex-col h-full bg-card text-foreground" : "glass-card my-4 rounded-2xl border-border/70 shadow-sm overflow-hidden"} data-testid="history-bootstrap-panel">
    {panelHeader}
    <div className="space-y-4 p-4 sm:p-6">
      {/* 4 Tabs de Gestão da Central */}
      <div className="grid gap-2 grid-cols-2 sm:grid-cols-4" aria-label="Formas de criar atendente">
        {([
          { key: 'history', title: 'Ler conversas & Mídias', icon: Chats, desc: 'Sync de mensagens e mídias' },
          { key: 'prompt', title: 'Criar com IA', icon: Sparkle, desc: 'Gerar atendente com base no perfil' },
          { key: 'manual', title: 'Criar manualmente', icon: PencilSimple, desc: 'Definir instruções diretamente' },
          { key: 'store', title: 'Loja & Conhecimento', icon: Storefront, desc: 'Catálogo, preços e memória' },
        ] as const).map(option => <button key={option.key} type="button" onClick={() => { setMode(option.key); setPreview(option.key === 'manual' ? { name: '', personality: '' } : null); }}
          className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-all ${mode === option.key ? 'border-primary bg-primary/10 text-primary shadow-sm ring-1 ring-primary/30' : 'border-border/70 bg-muted/10 hover:bg-muted/30 text-foreground'}`}>
          <div className="flex items-center gap-2">
            <option.icon className="h-5 w-5 shrink-0" weight="duotone" />
            <span className="text-xs font-bold">{option.title}</span>
          </div>
          <span className="text-[10px] font-normal text-muted-foreground leading-tight">{option.desc}</span>
        </button>)}
      </div>

      {!syncReady && mode === 'history' && <p className="text-xs text-muted-foreground">{sessionId ? 'Sincronizando conversas e preparando a memória. As opções de criação ficam disponíveis após a importação.' : 'Conecte um WhatsApp para iniciar a sincronização e escolher como criar o atendente.'}</p>}
      {error && <p role="alert" className="text-xs text-destructive font-medium p-2 rounded-lg bg-destructive/10 border border-destructive/20">{error}</p>}
      {notice && <p role="status" className="text-xs text-emerald-400 font-medium p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">{notice}</p>}

      {/* Seletor de Conexão WhatsApp */}
      <div className="flex items-center justify-between gap-3 p-3 rounded-xl border border-border/50 bg-muted/10">
        <label className="text-xs font-semibold text-foreground flex items-center gap-2 shrink-0">
          <span>Número / Conexão:</span>
        </label>
        <select aria-label="Número para sincronizar" className="flex-1 max-w-md rounded-xl border border-border/80 bg-background/80 px-3 py-1.5 text-xs text-foreground shadow-sm transition-colors hover:bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/20" value={sessionId} onChange={e => setSessionId(e.target.value)} disabled={busy}>
          {!sessions.length && <option value="">Conecte um WhatsApp para começar</option>}
          {sessions.map(s => <option key={s.session_id} value={s.session_id}>{s.session_name ? `${s.session_name} (${s.session_id})` : s.session_id}</option>)}
        </select>
      </div>

      {/* ABA: LOJA & CONHECIMENTO */}
      {mode === 'store' && <div className="space-y-4 animate-fade-in">
        <div className="space-y-3 rounded-xl border border-border/60 bg-muted/10 p-4 shadow-sm">
          <p className="text-xs text-muted-foreground leading-relaxed">Cada WhatsApp mantém sua memória. Vincular uma loja acrescenta seus conhecimentos sem juntar conversas.</p>
          <label className="block text-sm font-medium">Loja vinculada<select aria-label="Loja vinculada" className="mt-1.5 w-full rounded-xl border border-border/80 bg-background/60 px-3 py-2 text-sm text-foreground shadow-sm transition-colors hover:bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/20" value={storeId} onChange={e=>setStoreId(e.target.value)}><option value="">Independente</option>{stores.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
          <Input aria-label="Segmento" placeholder="Segmento da loja" className="rounded-xl text-xs h-9 bg-background/60" value={segment} onChange={e=>setSegment(e.target.value)}/>
          <Input aria-label="Tipo de atendimento" placeholder="Tipo de atendimento: vendas, suporte…" className="rounded-xl text-xs h-9 bg-background/60" value={serviceType} onChange={e=>setServiceType(e.target.value)}/>
          <label className="block text-sm font-medium">Evolução<select className="mt-1.5 w-full rounded-xl border border-border/80 bg-background/60 px-3 py-2 text-sm text-foreground shadow-sm transition-colors hover:bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/20" value={evolutionMode} onChange={e=>setEvolutionMode(e.target.value)}><option value="limited">Automática: somente estilo</option><option value="paused">Pausada</option></select></label>
          <Button className="rounded-xl text-xs h-9 font-semibold shadow-sm" disabled={busy || !sessionId} onClick={()=>void action(saveProfile,'Vínculo e preferências salvos.')}>Salvar vínculo e preferências</Button>
          <details className="rounded-xl border border-border/50 bg-background/40 p-3"><summary className="cursor-pointer font-medium text-xs text-foreground hover:text-primary transition-colors select-none">Cadastrar ou editar conhecimento de uma loja</summary><div className="mt-3 space-y-2">
            <Input aria-label="Nome da loja" placeholder="Nome da loja" className="rounded-xl text-xs h-9 bg-background/60" value={storeName} onChange={e=>setStoreName(e.target.value)}/>
            <Textarea aria-label="Conhecimento oficial" placeholder="Produtos, preços e regras oficiais atuais" className="rounded-xl text-xs bg-background/60 min-h-20" value={knowledge} onChange={e=>setKnowledge(e.target.value)}/>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button className="rounded-xl text-xs h-8.5 font-semibold" disabled={busy || !storeName.trim()} onClick={()=>void action(async()=>{
                const data=await requestApiEndpoint<{id:string}>(base.replace(/\/[^/]+$/,'')+'/stores','POST',{name:storeName,segment,knowledge});
                setStores(prev=>[...prev,{id:data.id,name:storeName,segment,knowledge}]);setStoreId(data.id);
              },'Loja criada. Salve o vínculo para aplicá-la ao WhatsApp.')}>Criar loja</Button>
              <Button variant="outline" className="rounded-xl text-xs h-8.5 font-medium" disabled={busy || !storeId} onClick={()=>{const selected=stores.find(s=>s.id===storeId);if(selected){setStoreName(selected.name);setKnowledge(selected.knowledge);}}}>Carregar loja selecionada</Button>
              <Button variant="outline" className="rounded-xl text-xs h-8.5 font-medium" disabled={busy || !storeId || !storeName.trim()} onClick={()=>void action(async()=>{
                await requestApiEndpoint('/api/ai/history/stores/'+encodeURIComponent(storeId),'PUT',{name:storeName,segment,knowledge});
                setStores(prev=>prev.map(s=>s.id===storeId?{...s,name:storeName,segment,knowledge}:s));
              },'Conhecimento oficial atualizado.')}>Atualizar loja selecionada</Button>
            </div>
          </div></details>
          <p role="status" className="text-xs text-muted-foreground">{memoryStatus ? memoryStatus.last_error || (memoryStatus.pending ? 'Memória: '+memoryStatus.pending+' mensagens aguardam processamento.' : 'Memória persistida: '+memoryStatus.total+' mensagens processadas.') : 'Consultando persistência…'}</p>
          <Button variant="outline" className="rounded-xl text-xs h-8.5 font-medium" disabled={busy || !sessionId} onClick={()=>void action(async()=>{const data=await requestApiEndpoint<{memory:typeof memoryStatus}>(base+'/profile');setMemoryStatus(data.memory);},'Estado da memória atualizado.')}>Atualizar estado</Button>
        </div>

        <details className="rounded-xl border border-border/50 bg-background/40 p-3"><summary className="cursor-pointer font-medium text-xs text-foreground hover:text-primary transition-colors select-none">Versões do estilo e restauração</summary>
          <select aria-label="Atendente para versões" value={target} onChange={e=>{setTarget(e.target.value);setVersions([]);}} className="my-2 w-full rounded-xl border border-border/80 bg-background/60 px-3 py-2 text-sm text-foreground shadow-sm"><option value="">Selecione um atendente</option>{agents.map(a=><option key={a.key} value={a.key}>{a.name}</option>)}</select>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button variant="outline" className="rounded-xl text-xs h-8.5 font-medium" disabled={busy || !target} onClick={()=>void action(async()=>{const data=await requestApiEndpoint<{agent:Agent}>(base+'/agents/'+encodeURIComponent(target)+'/link','POST');setAgents(prev=>prev.map(a=>a.key===data.agent.key?data.agent:a));},'Atendente vinculado ao WhatsApp.')}>Vincular atendente selecionado</Button>
            <Button variant="outline" className="rounded-xl text-xs h-8.5 font-medium" disabled={busy || !target} onClick={()=>void action(async()=>{const data=await requestApiEndpoint<{versions:typeof versions}>(base+'/versions/'+encodeURIComponent(target));setVersions(data.versions);},'Versões consultadas.')}>Consultar versões</Button>
          </div>
          {target && editCandidate && <div className="space-y-2 rounded-xl border border-border/60 bg-muted/10 p-3">
            <p className="text-sm font-semibold">Editar atendente vinculado</p>
            <Input aria-label="Nome do atendente existente" value={editCandidate.name} maxLength={100} onChange={e=>setEditCandidate({...editCandidate,name:e.target.value})} />
            <Textarea aria-label="Instruções do atendente existente" value={editCandidate.personality} maxLength={10000} className="min-h-32" onChange={e=>setEditCandidate({...editCandidate,personality:e.target.value})} />
            <Textarea aria-label="Pedido de alteração por IA" placeholder="Descreva o que deseja mudar nas instruções" value={editPrompt} onChange={e=>setEditPrompt(e.target.value)} />
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" disabled={busy || !editPrompt.trim()} onClick={()=>void action(async()=>{const data=await requestApiEndpoint<{candidate:{name:string;personality:string}}>(`${base}/agents/${encodeURIComponent(target)}/preview`,'POST',{prompt:editPrompt});setEditCandidate(data.candidate);},'Prévia recebida. Revise antes de salvar.')}>Gerar alteração por IA</Button>
              <Button disabled={busy || !editCandidate.name.trim() || !editCandidate.personality.trim()} onClick={()=>void action(async()=>{const data=await requestApiEndpoint<{agent:Agent}>(`${base}/agents/${encodeURIComponent(target)}`,'PATCH',{...editCandidate,reviewed:true});setAgents(prev=>prev.map(a=>a.key===target?data.agent:a));setEditPrompt('');},'Atendente atualizado e versão registrada.')}>Salvar instruções revisadas</Button>
            </div>
            <p className="text-xs text-muted-foreground">A alteração afeta as conexões vinculadas a este atendente. Produtos, preços e políticas oficiais permanecem separados.</p>
          </div>}
          {versions.map(v=>{
            const desc = v.snapshot.name
              ? 'Configuração de ' + v.snapshot.name
              : v.snapshot.responseStyle === 'elaborate'
                ? 'Respostas detalhadas'
                : v.snapshot.responseStyle === 'short_natural'
                  ? 'Respostas curtas'
                  : v.snapshot.tone
                    ? `Tom: ${v.snapshot.tone}`
                    : v.reason === 'automatic_style'
                      ? 'Ajuste automático de estilo'
                      : v.reason === 'baseline'
                        ? 'Linha de base'
                        : 'Estilo do atendente';
            return <div key={v.id} className="my-2 flex flex-wrap items-center gap-2 text-sm"><span>{date(v.created_at)} — {desc}</span><Button variant="outline" className="rounded-xl text-xs h-7 font-medium" disabled={busy} onClick={()=>void action(async()=>{await requestApiEndpoint(base+'/versions/'+encodeURIComponent(target)+'/'+v.id+'/restore','POST');setEvolutionMode('paused');},'Versão restaurada. Evolução pausada.')}>Restaurar</Button></div>;
          })}
        </details>
      </div>}

      {/* ABA: CRIAR COM IA OU MANUAL */}
      {(mode === 'prompt' || mode === 'manual') && <div className="space-y-3 rounded-xl border border-border/60 bg-muted/10 p-4 shadow-sm animate-fade-in">
        {mode === 'prompt' && <>
          <label className="block text-xs font-semibold text-foreground">Descreva como o atendente deve agir:</label>
          <Textarea aria-label="Descrição do atendente" placeholder="Ex: Atendente prestativo que tira dúvidas sobre materiais de construção, sugere produtos complementares e direciona para fechamento de pedido." className="rounded-xl text-xs bg-background/60 min-h-24" value={prompt} onChange={e=>setPrompt(e.target.value)}/>
          <Button className="rounded-xl text-xs h-8.5 font-semibold" disabled={busy || !sessionId || !prompt.trim()} onClick={()=>void action(async()=>{const data=await requestApiEndpoint<{candidate:NonNullable<typeof preview>}>(base+'/preview','POST',{prompt,segment,serviceType});setPreview(data.candidate);},'Prévia gerada. Revise antes de ativar.')}>Gerar prévia com IA</Button>
        </>}
        {(preview || mode === 'manual') && <>
          <label className="block text-xs font-semibold text-foreground">Nome do atendente:</label>
          <Input aria-label="Nome do novo atendente" placeholder="Nome do atendente (ex: Camila)" className="rounded-xl text-xs h-9 bg-background/60" value={preview?.name || ''} onChange={e=>setPreview({name:e.target.value,personality:preview?.personality || ''})}/>
          <label className="block text-xs font-semibold text-foreground">Instruções e Personalidade:</label>
          <Textarea aria-label="Instruções do novo atendente" placeholder="Instruções completas do atendimento..." className="rounded-xl text-xs bg-background/60 min-h-32" value={preview?.personality || ''} onChange={e=>setPreview({name:preview?.name || '',personality:e.target.value})}/>
          <p className="text-xs text-muted-foreground">Atenderá o número selecionado. Outros números da mesma conta:</p>
          {sessions.filter(s=>s.session_id!==sessionId).map(s=><label key={s.session_id} className="flex items-center gap-2 text-xs text-foreground font-medium cursor-pointer"><input type="checkbox" className="rounded border-border" checked={extraSessions.includes(s.session_id)} onChange={e=>setExtraSessions(prev=>e.target.checked?[...prev,s.session_id]:prev.filter(id=>id!==s.session_id))}/> {s.session_name || s.session_id}</label>)}
          <Button className="rounded-xl text-xs h-9 font-semibold shadow-sm" disabled={busy || !sessionId || !preview?.name?.trim() || !preview?.personality?.trim()} onClick={()=>void action(async()=>{
            await saveProfile();
            const data=await requestApiEndpoint<{agent:Agent}>(base+'/agents','POST',{...(preview || {}),segment,serviceType,sessionIds:[sessionId,...extraSessions],reviewed:true});
            setAgents(prev=>[...prev,data.agent]);setPreview(mode==='manual'?{name:'',personality:''}:null);
          },'Atendente revisado e ativado.')}>Revisar e ativar atendente</Button>
        </>}
      </div>}
      <details className="rounded-xl border border-border/50 bg-background/40 p-3"><summary className="cursor-pointer font-medium text-xs text-foreground hover:text-primary transition-colors select-none">Versões do estilo e restauração</summary>
        <select aria-label="Atendente para versões" value={target} onChange={e=>{setTarget(e.target.value);setVersions([]);}} className="my-2 w-full rounded-xl border border-border/80 bg-background/60 px-3 py-2 text-sm text-foreground shadow-sm"><option value="">Selecione um atendente</option>{agents.map(a=><option key={a.key} value={a.key}>{a.name}</option>)}</select>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button variant="outline" className="rounded-xl text-xs h-8.5 font-medium" disabled={busy || !target} onClick={()=>void action(async()=>{const data=await requestApiEndpoint<{agent:Agent}>(base+'/agents/'+encodeURIComponent(target)+'/link','POST');setAgents(prev=>prev.map(a=>a.key===data.agent.key?data.agent:a));},'Atendente vinculado ao WhatsApp.')}>Vincular atendente selecionado</Button>
          <Button variant="outline" className="rounded-xl text-xs h-8.5 font-medium" disabled={busy || !target} onClick={()=>void action(async()=>{const data=await requestApiEndpoint<{versions:typeof versions}>(base+'/versions/'+encodeURIComponent(target));setVersions(data.versions);},'Versões consultadas.')}>Consultar versões</Button>
        </div>
        {target && editCandidate && <div className="space-y-2 rounded-xl border border-border/60 bg-muted/10 p-3">
          <p className="text-sm font-semibold">Editar atendente vinculado</p>
          <Input aria-label="Nome do atendente existente" value={editCandidate.name} maxLength={100} onChange={e=>setEditCandidate({...editCandidate,name:e.target.value})} />
          <Textarea aria-label="Instruções do atendente existente" value={editCandidate.personality} maxLength={10000} className="min-h-32" onChange={e=>setEditCandidate({...editCandidate,personality:e.target.value})} />
          <Textarea aria-label="Pedido de alteração por IA" placeholder="Descreva o que deseja mudar nas instruções" value={editPrompt} onChange={e=>setEditPrompt(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={busy || !editPrompt.trim()} onClick={()=>void action(async()=>{const data=await requestApiEndpoint<{candidate:{name:string;personality:string}}>(`${base}/agents/${encodeURIComponent(target)}/preview`,'POST',{prompt:editPrompt});setEditCandidate(data.candidate);},'Prévia recebida. Revise antes de salvar.')}>Gerar alteração por IA</Button>
            <Button disabled={busy || !editCandidate.name.trim() || !editCandidate.personality.trim()} onClick={()=>void action(async()=>{const data=await requestApiEndpoint<{agent:Agent}>(`${base}/agents/${encodeURIComponent(target)}`,'PATCH',{...editCandidate,reviewed:true});setAgents(prev=>prev.map(a=>a.key===target?data.agent:a));setEditPrompt('');},'Atendente atualizado e versão registrada.')}>Salvar instruções revisadas</Button>
          </div>
          <p className="text-xs text-muted-foreground">A alteração afeta as conexões vinculadas a este atendente. Produtos, preços e políticas oficiais permanecem separados.</p>
        </div>}
        {versions.map(v=>{
          const desc = v.snapshot.name
            ? 'Configuração de ' + v.snapshot.name
            : v.snapshot.responseStyle === 'elaborate'
              ? 'Respostas detalhadas'
              : v.snapshot.responseStyle === 'short_natural'
                ? 'Respostas curtas'
                : v.snapshot.tone
                  ? `Tom: ${v.snapshot.tone}`
                  : v.reason === 'automatic_style'
                    ? 'Ajuste automático de estilo'
                    : v.reason === 'baseline'
                      ? 'Linha de base'
                      : 'Estilo do atendente';
          return <div key={v.id} className="my-2 flex flex-wrap items-center gap-2 text-sm"><span>{date(v.created_at)} — {desc}</span><Button variant="outline" className="rounded-xl text-xs h-7 font-medium" disabled={busy} onClick={()=>void action(async()=>{await requestApiEndpoint(base+'/versions/'+encodeURIComponent(target)+'/'+v.id+'/restore','POST');setEvolutionMode('paused');},'Versão restaurada. Evolução pausada.')}>Restaurar</Button></div>;
        })}
      </details>
      {mode==='history' && status && <>
        <div className="rounded-xl border border-border/60 bg-muted/10 p-4 space-y-2" role="status" aria-live="polite">
          <div className="flex justify-between gap-3 text-sm font-medium"><span>Importação do histórico</span><span>{status.total ? Math.round(status.imported / status.total * 100) : 0}%</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${status.total ? Math.min(100, status.imported / status.total * 100) : 0}%` }} /></div>
          <p className="text-xs text-muted-foreground">{status.imported.toLocaleString('pt-BR')} mensagens salvas · {status.pending.toLocaleString('pt-BR')} aguardando · {status.conversations.toLocaleString('pt-BR')} conversas individuais</p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <Badge variant="secondary">{status.imported} / {status.total} mensagens recebidas importadas</Badge>
          <Badge variant="secondary">{status.conversations} conversas</Badge>
          <Badge variant="outline">{status.media_identified || 0} mídias identificadas</Badge>
          <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 bg-emerald-500/10 font-medium">
            {status.media_done} mídias analisadas & acopladas
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">Período recuperado: {date(status.first_message_at)} a {date(status.last_message_at)}. {status.coverage}</p>
        <p className="text-sm">Mídias: {status.media_pending} aguardam download; {status.media_downloaded || 0} baixadas e aguardando análise; {status.media_done} analisadas; {status.media_unsupported} anexos exibíveis sem interpretação; {status.media_failed} indisponíveis ou com falha. Falhas de mensagem: {status.failed}.</p>
        {status.history_requests_without_response > 0 && <p className="text-sm text-amber-500 dark:text-amber-400 font-medium">{status.history_requests_without_response} conversas sem resposta à solicitação de histórico anterior. Isso não confirma que todo o histórico foi recuperado.</p>}
        {status.last_error && <p role="alert" className="text-sm text-destructive">{status.last_error}</p>}
        <div className="flex flex-wrap gap-2 pt-1">
          <Button variant="outline" className="rounded-xl text-xs h-8.5 font-medium" disabled={busy} onClick={() => action(() => requestApiEndpoint(`${base}/resume`, 'POST'), 'Retomada solicitada. O processamento ocorre em segundo plano.')}>Retomar sincronização e análise</Button>
          <Button variant="outline" className="rounded-xl text-xs h-8.5 font-medium" disabled={busy} onClick={() => void loadMediaEvidence()}>Ver mídias do histórico</Button>
        </div>
        {showMedia && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Mídias do histórico">
          {mediaEvidence.map(item => {
            const url = mediaUrl(item.media_path);
            return <div key={item.id} className="rounded-xl border border-border/60 bg-muted/10 p-3 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  {item.media_type === 'audio' ? <Headphones className="h-4 w-4 text-emerald-500" /> : item.media_type === 'image' ? <ImageIcon className="h-4 w-4 text-blue-500" /> : <FileText className="h-4 w-4 text-purple-500" />}
                  {item.media_type === 'audio' ? 'Áudio' : item.media_type === 'image' ? 'Imagem' : 'Documento / Catálogo'}
                </span>
                <span className="text-[10px] text-muted-foreground">{date(item.occurred_at)}</span>
              </div>
              {url && item.media_type === 'image' && <img src={url} alt={`Imagem da mensagem ${item.id}`} className="max-h-40 w-full rounded-lg object-contain bg-background/50 border border-border/40" />}
              {url && item.media_type === 'audio' && <audio controls preload="none" src={url} className="w-full h-8" />}
              {url && !['image', 'audio'].includes(item.media_type || '') && <a href={url} target="_blank" rel="noreferrer" className="text-primary underline flex items-center gap-1"><FileText className="h-3.5 w-3.5" /> Abrir anexo / catálogo</a>}
              {!url && <p className="text-muted-foreground text-[11px]">{item.media_state === 'pending' ? '⏳ Aguardando download' : '⚠️ Arquivo indisponível no WhatsApp'}</p>}
              {item.media_text && (
                <div className="rounded-lg bg-background/60 p-2 border border-border/30 mt-1">
                  <p className="text-[10px] font-semibold text-emerald-500 mb-0.5">Transcrição / Conteúdo acoplado ao Agente:</p>
                  <p className="whitespace-pre-wrap text-[11px] text-muted-foreground">{item.media_text}</p>
                </div>
              )}
            </div>;
          })}
          {mediaEvidence.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma mídia identificada neste histórico.</p>}
          {mediaCursor && <Button variant="outline" className="rounded-xl text-xs h-8" onClick={() => void loadMediaEvidence(mediaCursor)}>Carregar mais mídias</Button>}
        </div>}
        <div className="space-y-4">
          <label className="block text-sm font-medium">Atendente de destino
            <select aria-label="Atendente de destino" className="mt-1.5 w-full rounded-xl border border-border/80 bg-background/60 px-3 py-2 text-sm text-foreground shadow-sm transition-colors hover:bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/20" value={target} onChange={e => setTarget(e.target.value)} disabled={busy || status.learning_enabled}>
              <option value="">Criar primeiro atendente da loja</option>
              {agents.map(a => <option key={a.key} value={a.key}>{a.name}</option>)}
            </select>
          </label>
          <p className="text-xs text-muted-foreground leading-relaxed">A análise usa o provedor de IA configurado da loja para textos, imagens e áudios e pode consumir créditos. O histórico gera rascunhos; preços e políticas exigem confirmação.</p>
          <div className="flex flex-wrap gap-2">
            <Button className="rounded-xl text-xs h-8.5 font-semibold" disabled={busy} onClick={() => action(() => requestApiEndpoint(`${base}/learning`, 'POST', { enabled: !status.learning_enabled, targetAgentKey: target || null }), status.learning_enabled ? 'Análise pausada.' : 'Análise contínua habilitada. O primeiro rascunho será gerado após processar o histórico recebido.')}>{status.learning_enabled ? 'Pausar análise contínua' : 'Analisar histórico e gerar atendente'}</Button>
            <Button variant="outline" className="rounded-xl text-xs h-8.5 font-medium" disabled={busy} onClick={() => action(() => loadEvidence(), 'Evidências carregadas.')}>Revisar conversas e autoria</Button>
          </div>
          {showEvidence && <div className="max-h-96 space-y-3 overflow-auto rounded-xl border border-border/60 bg-muted/10 p-3 shadow-inner">
            {evidence.map(item => <div key={item.id} className="border-b border-border/40 pb-3 text-xs">
              <p className="font-semibold text-foreground">#{item.id} · {item.from_me ? 'Loja' : 'Cliente'} · {date(item.occurred_at)}</p>
              <p className="whitespace-pre-wrap text-muted-foreground mt-1">{item.text || '[Mídia]'} {item.media_text}</p>
              {item.from_me && <label className="mt-1.5 block font-medium">Autoria: <select aria-label={`Autoria da mensagem ${item.id}`} className="ml-1.5 rounded-lg border border-border/80 bg-background/80 px-2 py-1 text-xs" value={['human','campaign','automation'].includes(item.origin) ? item.origin : 'unknown'} disabled={busy} onChange={e => {
                const origin = e.target.value;
                void action(async () => { await requestApiEndpoint(`${base}/evidence/${item.id}/author`, 'POST', { origin }); setEvidence(rows => rows.map(r => r.id === item.id ? { ...r, origin } : r)); }, 'Autoria registrada. A próxima versão considerará esta revisão.');
              }}><option value="unknown">Não confirmada</option><option value="human">Humano confirmado</option><option value="campaign">Disparo / campanha</option><option value="automation">Automação</option></select></label>}
            </div>)}
            {nextEvidence && <Button disabled={busy} variant="outline" className="rounded-xl text-xs h-8" onClick={() => action(() => loadEvidence(nextEvidence), 'Mais evidências carregadas.')}>Carregar mais</Button>}
          </div>}
          {draft && <div className="space-y-3 border-t border-border/40 pt-4">
            <label className="block text-sm font-medium">Versões recentes<select aria-label="Versão do atendente" className="ml-2 rounded-xl border border-border/80 bg-background/60 px-3 py-1.5 text-xs text-foreground shadow-sm" value={draft.id} disabled={busy || dirty} onChange={e => {
              chosenVersion.current = e.target.value; initialized.current = '';
              void action(async () => {}, 'Versão selecionada.');
            }}>{status.drafts.map(version => <option key={version.id} value={version.id}>#{version.id} · {labels[version.status] || version.status}</option>)}</select></label>
            <div className="flex flex-wrap items-center gap-2"><Badge className="rounded-lg">{labels[draft.status] || draft.status}</Badge><span className="text-xs text-muted-foreground">Versão #{draft.id}</span></div>
            {draft.status === 'analyzing' && <p className="text-xs text-muted-foreground">Analisando lotes e preservando o contexto das conversas. O processo pode ser retomado.</p>}
            {draft.last_error && <p className="text-xs text-destructive">{draft.last_error}</p>}
            {draft.candidate.partial && <p className="text-xs text-amber-500 font-medium">Proposta parcial: há lacunas no conteúdo ou na confirmação de autoria humana. Revise as evidências.</p>}
            {draft.candidate.summaryNote && <p className="text-xs text-muted-foreground">{draft.candidate.summaryNote}</p>}
            {section('Linguagem observada', draft.candidate.observedStyle)}
            {section('Padrões de atendimento', draft.candidate.patterns)}
            {section('Produtos mencionados', draft.candidate.products)}
            {section('Condições antigas — confirmar com a loja', draft.candidate.pendingCommercial)}
            {section('Contradições', draft.candidate.conflicts)}
            {section('Lacunas e melhorias', draft.candidate.gaps)}
            {section('Exemplos propostos', draft.candidate.examples)}
            {draft.status === 'draft' && <>
              <label className="block text-sm font-medium">Nome do atendente<Input value={name} maxLength={100} className="mt-1.5 rounded-xl text-xs h-9 bg-background/60" onChange={e => { setName(e.target.value); setReviewed(false); }} /></label>
              <details className="rounded-xl border border-border/50 bg-background/40 p-3"><summary className="cursor-pointer font-medium text-xs text-foreground hover:text-primary transition-colors select-none">Instruções atuais do atendente</summary><p className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">{agents.find(a => a.key === draft.target_agent_key)?.personality || 'Ainda não há atendente de destino.'}</p></details>
              <label className="block text-sm font-medium">Instruções propostas para revisão<Textarea className="mt-1.5 rounded-xl text-xs bg-background/60 min-h-48" value={personality} maxLength={20000} onChange={e => { setPersonality(e.target.value); setReviewed(false); }} /></label>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" className="rounded-xl text-xs h-8.5 font-medium" disabled={busy || !dirty || !name.trim() || !personality.trim()} onClick={() => action(() => requestApiEndpoint(`${base}/drafts/${draft.id}`, 'PATCH', { name, personality, segment, serviceType }), 'Revisão salva.')}>Salvar revisão</Button>
                <Button variant="outline" className="rounded-xl text-xs h-8.5 font-medium" disabled={busy || dirty} onClick={() => action(async () => setSimulation(await requestApiEndpoint<Simulation>(`${base}/drafts/${draft.id}/simulate`, 'POST')), 'Comparação gerada sem enviar mensagens.')}>Comparar em conversa reservada</Button>
                <Button variant="outline" className="rounded-xl text-xs h-8.5 font-medium" disabled={busy} onClick={() => action(() => requestApiEndpoint(`${base}/drafts/${draft.id}/discard`, 'POST'), 'Rascunho descartado. Atendente ativo preservado.')}>Descartar rascunho</Button>
              </div>
              {simulation && <div className="space-y-3 rounded-lg border p-3 text-sm"><p><strong>Pergunta reservada #{simulation.evidenceId}:</strong> {simulation.question}</p><div className="grid gap-4 md:grid-cols-2"><div><strong>Atendente atual</strong><p className="whitespace-pre-wrap">{simulation.before}</p></div><div><strong>Proposta</strong><p className="whitespace-pre-wrap">{simulation.after}</p></div></div><p className="text-muted-foreground">{simulation.note}</p></div>}
              <label className="flex items-start gap-2 text-sm cursor-pointer select-none"><input type="checkbox" className="mt-1 h-4 w-4 rounded border-border bg-background text-primary focus:ring-primary/20 accent-primary cursor-pointer" checked={reviewed} onChange={e => setReviewed(e.target.checked)} disabled={dirty || busy} />Revisei as instruções e as informações comerciais. Quero publicar esta versão no atendente selecionado.</label>
              <Button className="rounded-xl text-xs h-9 font-semibold shadow-sm" disabled={busy || dirty || !reviewed} onClick={() => action(() => saveProfile().then(() => requestApiEndpoint(`${base}/drafts/${draft.id}/publish`, 'POST', { reviewed: true, expectedRevision: draft.revision })), 'Versão publicada. A configuração global de envio da IA permanece sob seu controle.')}>Publicar versão revisada</Button>
            </>}
          </div>}
        </div>
      </>}
    </div>
  </div>;
}
