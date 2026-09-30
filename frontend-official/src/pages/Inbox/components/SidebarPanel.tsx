import { useEffect, useMemo, useState } from "react";
import { Bot, ChevronLeft, ChevronRight, Copy, Download, FileText, Folder, Image, MessageSquare, MoreHorizontal, Paperclip, Pencil, Plus, Search, Star, Trash2, UserRound, Video, Workflow } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { InboxSectionBoundary } from "@/components/system/InboxSectionBoundary";
import { useProtectedMediaUrl } from "@/core/runtime/hooks/useProtectedMediaUrl";
import type { ChatMessage, Conversation } from "@/core/services/apiService";
import type { AiMemoryRecord, InboxAiRuntime, PreviewMediaState, QuickReplyItem } from "../types";
import { extractMessageAssetUrl, formatPhoneNumber, getConversationSourceLabel, getMediaFileName, getMediaTypeLabel, getQuickReplyPreviewText, getTagColor, inferMediaTypeFromSource, sanitizeSidebarText, sortMessagesAsc } from "../utils";
import { cn } from "@/core/lib/utils";
import { QuickResponseModal } from "./QuickResponseModal";

interface SidebarPanelProps {
  selectedConversation: Conversation | null;
  rightPanelTab: "ai" | "lead" | "files" | "qr" | "history" | null;
  setRightPanelTab: (val: "ai" | "lead" | "files" | "qr" | "history" | null) => void;
  rightPanelCollapsed: boolean;
  setRightPanelCollapsed: (val: boolean | ((prev: boolean) => boolean)) => void;
  isTabletLayout: boolean;
  aiEnabledForConversation: boolean;
  aiRuntime: InboxAiRuntime;
  conversationAiOverrideEnabled: boolean;
  suggestingResponse: boolean;
  handleSuggestResponse: () => Promise<void>;
  messages: ChatMessage[];
  aiMemory: AiMemoryRecord | null;
  leadNotes: string;
  setLeadNotes: (val: string) => void;
  handleSaveLeadNotes: () => Promise<void>;
  newTagInput: string;
  setNewTagInput: (val: string) => void;
  handleAddTagToSelectedConversation: () => void;
  handleRemoveTagFromSelectedConversation: (tag: string) => void;
  updatingAiToggle: boolean;
  handleSetConversationAiEnabled: (val: boolean) => Promise<void>;
  responseSearchQuery: string;
  setResponseSearchQuery: (val: string) => void;
  quickReplies: QuickReplyItem[];
  quickRepliesLoading?: boolean;
  quickRepliesError?: boolean;
  sending: boolean;
  openCreateQuickReplyDialog: () => void;
  quickReplyCategory: string;
  setQuickReplyCategory: (val: string) => void;
  sendQuickReply: (item: QuickReplyItem, delayMs?: number) => Promise<void>;
  toggleFavoriteQuickReply: (id: string) => void;
  openEditQuickReplyDialog: (item: QuickReplyItem) => void;
  duplicateQuickReply: (item: QuickReplyItem) => void;
  deleteQuickReply: (id: string) => void;
  setMessageInput: (val: string) => void;
  handleOpenMediaPreview: (media: PreviewMediaState) => void;
  handleDownloadMedia: (message: ChatMessage) => void;
  aiAgents?: Array<{ id?: string; name: string; active?: boolean }>;
  loadingAgents?: boolean;
  handleSetConversationAgent?: (agentName: string) => Promise<void> | void;
  isDrawer?: boolean;
  onAttachMedia?: (message: ChatMessage) => void;
  isWhatsappConnected?: boolean;
}

const SECTIONS = [
  { id: "ai", label: "Atendimento", icon: MessageSquare },
  { id: "lead", label: "Cliente", icon: UserRound },
  { id: "files", label: "Arquivos", icon: Folder },
] as const;

function SharedMediaCard({ message, onOpen, onDownload, onAttach }: {
  message: ChatMessage;
  onOpen: (media: PreviewMediaState) => void;
  onDownload: (message: ChatMessage) => void;
  onAttach?: (message: ChatMessage) => void;
}) {
  const rawUrl = extractMessageAssetUrl(message);
  const mediaUrl = useProtectedMediaUrl(rawUrl);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [mediaUrl]);
  const type = message.mediaType ?? inferMediaTypeFromSource(rawUrl) ?? "file";
  const previewType = ["image", "sticker", "audio", "video"].includes(type) ? type as PreviewMediaState["type"] : "file";
  const fileName = getMediaFileName(message);
  const open = () => { if (mediaUrl && !failed) onOpen({ url: mediaUrl, type: previewType, fileName, messageId: message.id }); };
  return (
    <div className="min-w-0 rounded-xl border border-border/60 bg-card/40 p-2.5">
      <button type="button" onClick={open} disabled={!mediaUrl || failed} aria-label={`Abrir ${fileName}`} className="flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-lg bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring">
        {mediaUrl && !failed && (type === "image" || type === "sticker") ? (
          <img src={mediaUrl} alt={fileName} className="h-full w-full object-contain" loading="lazy" onError={() => setFailed(true)} />
        ) : type === "video" && mediaUrl && !failed ? (
          <video src={mediaUrl} className="h-full w-full object-cover" preload="metadata" onError={() => setFailed(true)} />
        ) : <FileText className="h-8 w-8 text-muted-foreground" />}
      </button>
      <p className="mt-2 truncate text-xs font-medium" title={fileName}>{fileName}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{failed ? "Não foi possível abrir este arquivo" : getMediaTypeLabel(type)}</p>
      <div className="mt-2 flex items-center gap-1">
        <Button size="sm" variant="ghost" className="h-8 flex-1 px-1 text-xs" disabled={!mediaUrl || failed} onClick={open}>Abrir</Button>
        <Button size="icon" variant="ghost" className="h-8 w-8" disabled={!mediaUrl || failed} onClick={() => onDownload(message)} aria-label={`Baixar ${fileName}`}><Download className="h-4 w-4" /></Button>
        {onAttach && <Button size="icon" variant="ghost" className="h-8 w-8" disabled={!mediaUrl || failed} onClick={() => onAttach(message)} aria-label={`Anexar ${fileName} ao rascunho`}><Paperclip className="h-4 w-4" /></Button>}
      </div>
    </div>
  );
}

export function SidebarPanel({ selectedConversation, rightPanelTab, setRightPanelTab, rightPanelCollapsed, setRightPanelCollapsed, isTabletLayout, aiEnabledForConversation, aiRuntime, conversationAiOverrideEnabled, suggestingResponse, handleSuggestResponse, messages, aiMemory, leadNotes, setLeadNotes, handleSaveLeadNotes, newTagInput, setNewTagInput, handleAddTagToSelectedConversation, handleRemoveTagFromSelectedConversation, updatingAiToggle, handleSetConversationAiEnabled, responseSearchQuery, setResponseSearchQuery, quickReplies, quickRepliesLoading = false, quickRepliesError = false, sending, openCreateQuickReplyDialog, quickReplyCategory, setQuickReplyCategory, sendQuickReply, toggleFavoriteQuickReply, openEditQuickReplyDialog, duplicateQuickReply, deleteQuickReply, setMessageInput, handleOpenMediaPreview, handleDownloadMedia, aiAgents = [], loadingAgents = false, handleSetConversationAgent, isDrawer = false, onAttachMedia, isWhatsappConnected = false }: SidebarPanelProps) {
  const [fileFilter, setFileFilter] = useState("all");
  const [showAllFiles, setShowAllFiles] = useState(false);
  const [previewReply, setPreviewReply] = useState<QuickReplyItem | null>(null);
  const [savingNotes, setSavingNotes] = useState(false);
  useEffect(() => { setPreviewReply(null); setShowAllFiles(false); setFileFilter("all"); }, [selectedConversation?.id]);
  const activeTab = rightPanelTab === "lead" || rightPanelTab === "files" ? rightPanelTab : "ai";
  const categories = useMemo(() => Array.from(new Set(quickReplies.map(reply => reply.category).filter(Boolean))), [quickReplies]);
  const variableContext = { contactName: selectedConversation?.contactName, phone: selectedConversation?.phone, company: aiMemory?.company };
  const filteredReplies = quickReplies.filter(reply => (quickReplyCategory === "all" || quickReplyCategory === reply.category) && `${reply.title} ${reply.text}`.toLocaleLowerCase().includes(responseSearchQuery.trim().toLocaleLowerCase()));
  const orderedMessages = useMemo(() => sortMessagesAsc(messages), [messages]);
  const mediaMessages = orderedMessages.filter(message => Boolean(extractMessageAssetUrl(message))).reverse();
  const filteredMedia = mediaMessages.filter(message => {
    const type = message.mediaType ?? inferMediaTypeFromSource(extractMessageAssetUrl(message));
    if (fileFilter === "all") return true;
    if (fileFilter === "image") return type === "image" || type === "sticker";
    if (fileFilter === "file") return type === "file" || type === "document";
    return type === fileFilter;
  });
  const summary = sanitizeSidebarText(aiMemory?.summary ?? selectedConversation?.summary ?? "");
  const agentName = selectedConversation?.agent_name || selectedConversation?.assigned_to || selectedConversation?.assignedAgentName || "";
  const hasCustomerMessage = messages.some(message => !message.fromMe && Boolean(message.content?.trim()));
  const aiStatus = aiRuntime.loading ? "Verificando IA" : aiEnabledForConversation ? "Respondendo automaticamente" : !aiRuntime.globalEnabled ? "IA global pausada" : !aiRuntime.aiOn ? "Provedor indisponível" : "Atendimento humano";
  const chooseReply = (reply: QuickReplyItem) => {
    const entries = reply.isFlow ? reply.steps ?? [] : reply.items ?? [];
    if (reply.isFlow || entries.some(entry => entry.type !== "text")) setPreviewReply(reply);
    else setMessageInput(getQuickReplyPreviewText(reply, variableContext));
  };
  const panelContent = selectedConversation ? (
    <Tabs value={activeTab} onValueChange={value => setRightPanelTab(value as "ai" | "lead" | "files")} className="flex h-full min-h-0 w-full flex-col">
      <div className="shrink-0 border-b border-border/60 px-4 pb-3 pt-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="min-w-0"><p className="text-sm font-semibold">Detalhes da conversa</p><p className="truncate text-xs text-muted-foreground">{selectedConversation.contactName}</p></div>
          {!isDrawer && <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => setRightPanelCollapsed(true)} aria-label="Recolher painel de detalhes"><ChevronRight className="h-4 w-4" /></Button>}
        </div>
        <TabsList className="grid h-10 w-full grid-cols-3 bg-muted/60 p-1">
          {SECTIONS.map(section => <TabsTrigger key={section.id} value={section.id} className="min-w-0 px-1 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">{section.label}</TabsTrigger>)}
        </TabsList>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 text-sm scrollbar-thin">
        <TabsContent value="ai" className="m-0 space-y-5">
          <InboxSectionBoundary fallbackLabel="Atendimento">
            <section className="space-y-4 rounded-xl border border-border/60 bg-card/40 p-3.5">
              <div className="flex items-start justify-between gap-2"><div><h3 className="font-semibold">Atendimento</h3><p className={cn("mt-1 text-xs", isWhatsappConnected ? "text-emerald-500" : "text-amber-500")}>WhatsApp {isWhatsappConnected ? "conectado" : "desconectado"}</p></div><Badge variant="outline" className={cn("shrink-0 text-xs", aiEnabledForConversation ? "border-emerald-500/30 text-emerald-500" : "text-muted-foreground")}>{aiEnabledForConversation ? "IA ativa" : "Humano"}</Badge></div>
              <div className="flex items-center justify-between gap-3"><label htmlFor="conversation-ai-toggle" className="min-w-0"><span className="block text-sm font-medium">Permitir IA nesta conversa</span><span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{aiStatus}</span></label><Switch id="conversation-ai-toggle" checked={conversationAiOverrideEnabled} onCheckedChange={handleSetConversationAiEnabled} disabled={updatingAiToggle || aiRuntime.loading} /></div>
              <div className="space-y-1.5"><label htmlFor="conversation-agent" className="text-xs font-medium text-muted-foreground">Agente responsável</label><select id="conversation-agent" value={agentName} onChange={event => void handleSetConversationAgent?.(event.target.value)} disabled={loadingAgents || !handleSetConversationAgent || aiAgents.length === 0} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"><option value="">Agente padrão da conexão</option>{agentName && !aiAgents.some(agent => agent.name === agentName) && <option value={agentName}>{agentName}</option>}{aiAgents.map(agent => <option key={agent.id || agent.name} value={agent.name}>{agent.name}{agent.active === false ? " (pausado)" : ""}</option>)}</select>{!loadingAgents && aiAgents.length === 0 && <p className="text-xs text-muted-foreground">Cadastre um agente em IA & Automação.</p>}</div>
              <div className="border-t border-border/50 pt-3"><Button className="h-auto min-h-10 w-full gap-2 py-2 text-sm" disabled={aiRuntime.loading || !aiRuntime.providerReady || suggestingResponse || !hasCustomerMessage} onClick={() => void handleSuggestResponse()}><Bot className="h-4 w-4" />{suggestingResponse ? "Preparando sugestão…" : "Sugerir resposta"}</Button><p className="mt-2 text-xs leading-relaxed text-muted-foreground">{!hasCustomerMessage ? "Aguarde uma mensagem de texto do cliente para gerar uma sugestão." : !aiRuntime.providerReady && !aiRuntime.loading ? "Configure um provedor de IA para gerar sugestões." : "A sugestão entra no rascunho para sua revisão, mesmo com o atendimento automático pausado."}</p></div>
            </section>
            <section className="mt-5 space-y-3">
              <div className="flex items-center justify-between gap-2"><h3 className="font-semibold">Respostas rápidas</h3><Button size="sm" variant="outline" className="h-8 gap-1.5 px-2.5 text-xs" onClick={openCreateQuickReplyDialog}><Plus className="h-3.5 w-3.5" />Nova</Button></div>
              <div className="relative"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label="Buscar respostas rápidas" value={responseSearchQuery} onChange={event => setResponseSearchQuery(event.target.value)} placeholder="Buscar resposta rápida" className="h-10 pl-9 text-sm" /></div>
              {categories.length > 1 && <select aria-label="Filtrar categoria" value={quickReplyCategory} onChange={event => setQuickReplyCategory(event.target.value)} className="h-9 w-full rounded-lg border border-border bg-background px-2 text-xs"><option value="all">Todas as categorias</option>{categories.map(category => <option key={category} value={category}>{category}</option>)}</select>}
              <p className="text-xs leading-relaxed text-muted-foreground">Texto vai para o rascunho. Mídias e fluxos abrem uma prévia antes do envio.</p>
              {quickRepliesLoading ? <p className="py-3 text-xs text-muted-foreground">Carregando respostas…</p> : quickRepliesError ? <p role="alert" className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-500">Não foi possível carregar as respostas rápidas. Reabra o Inbox para tentar novamente.</p> : filteredReplies.length === 0 ? <p className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">{quickReplies.length ? "Nenhuma resposta encontrada." : "Crie sua primeira resposta rápida para agilizar o atendimento."}</p> : (
                <div className="space-y-2">{filteredReplies.map(reply => <div key={reply.id} className="flex items-center gap-1 rounded-lg border border-border/60 bg-card/30 p-1.5"><button type="button" onClick={() => chooseReply(reply)} disabled={sending} className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring">{reply.isFlow ? <Workflow className="h-4 w-4 shrink-0 text-violet-400" /> : <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />}<div className="min-w-0"><p className="truncate text-sm font-medium">{reply.title || reply.text}</p><p className="truncate text-xs text-muted-foreground">{reply.isFlow ? "Prévia do fluxo" : getQuickReplyPreviewText(reply, variableContext)}</p></div></button><Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" aria-label={`Favoritar ${reply.title}`} onClick={() => toggleFavoriteQuickReply(reply.id)}><Star className={cn("h-4 w-4", reply.favorite && "fill-amber-400 text-amber-400")} /></Button><DropdownMenu><DropdownMenuTrigger asChild><Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" aria-label={`Opções de ${reply.title}`}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => openEditQuickReplyDialog(reply)}><Pencil className="mr-2 h-4 w-4" />Editar</DropdownMenuItem><DropdownMenuItem onClick={() => duplicateQuickReply(reply)}><Copy className="mr-2 h-4 w-4" />Duplicar</DropdownMenuItem><DropdownMenuItem className="text-destructive" onClick={() => deleteQuickReply(reply.id)}><Trash2 className="mr-2 h-4 w-4" />Excluir</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div>)}</div>
              )}
            </section>
            <details className="mt-5 rounded-xl border border-border/60 bg-card/20"><summary className="cursor-pointer p-3 text-sm font-medium">Informações da IA</summary><dl className="space-y-2 px-3 pb-3 text-xs"><div className="flex justify-between gap-3"><dt className="text-muted-foreground">Ativação global</dt><dd>{aiRuntime.loading ? "Verificando" : aiRuntime.globalEnabled ? "Ativada" : "Pausada"}</dd></div><div className="flex justify-between gap-3"><dt className="text-muted-foreground">Provedor</dt><dd className="truncate">{aiRuntime.provider}</dd></div><div className="flex justify-between gap-3"><dt className="text-muted-foreground">Modelo</dt><dd className="truncate">{aiRuntime.model}</dd></div>{aiRuntime.lastResponseAt && <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Última resposta</dt><dd>{new Date(aiRuntime.lastResponseAt).toLocaleString("pt-BR")}</dd></div>}{aiRuntime.lastResponseTimeMs != null && <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Tempo da resposta</dt><dd>{aiRuntime.lastResponseTimeMs} ms</dd></div>}</dl></details>
          </InboxSectionBoundary>
        </TabsContent>
        <TabsContent value="lead" className="m-0 space-y-5">
          <InboxSectionBoundary fallbackLabel="Cliente">
            <section className="space-y-3"><h3 className="break-words text-base font-semibold">{selectedConversation.contactName}</h3><p className="text-sm text-muted-foreground">{formatPhoneNumber(selectedConversation.phone)}</p><dl className="space-y-2 text-xs"><div className="flex justify-between gap-3"><dt className="text-muted-foreground">Origem</dt><dd>{getConversationSourceLabel(selectedConversation)}</dd></div><div className="flex justify-between gap-3"><dt className="text-muted-foreground">Última interação</dt><dd>{selectedConversation.updatedAt ? new Date(selectedConversation.updatedAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "Sem registro"}</dd></div>{selectedConversation.funnel_stage && <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Etapa</dt><dd>{selectedConversation.funnel_stage}</dd></div>}</dl></section>
            <section className="mt-5 border-t border-border/50 pt-4"><h3 className="mb-3 font-semibold">Etiquetas</h3><div className="flex flex-wrap gap-2">{(selectedConversation.tags ?? []).map(tag => <Badge key={tag} variant="outline" className={cn("gap-1.5 py-1 text-xs", getTagColor(tag))}>{tag}<button type="button" onClick={() => handleRemoveTagFromSelectedConversation(tag)} aria-label={`Remover etiqueta ${tag}`} className="rounded hover:text-destructive"><Trash2 className="h-3 w-3" /></button></Badge>)}{!selectedConversation.tags?.length && <p className="text-xs text-muted-foreground">Sem etiquetas.</p>}</div><div className="mt-3 flex gap-2"><Input aria-label="Nova etiqueta" value={newTagInput} onChange={event => setNewTagInput(event.target.value)} placeholder="Adicionar etiqueta" className="h-10 text-sm" onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); handleAddTagToSelectedConversation(); } }} /><Button size="icon" variant="outline" className="h-10 w-10 shrink-0" aria-label="Adicionar etiqueta" disabled={!newTagInput.trim()} onClick={handleAddTagToSelectedConversation}><Plus className="h-4 w-4" /></Button></div></section>
            <section className="mt-5 border-t border-border/50 pt-4"><label htmlFor="client-notes" className="font-semibold">Notas do atendimento</label><textarea id="client-notes" value={leadNotes} onChange={event => setLeadNotes(event.target.value)} placeholder="Registre o contexto importante deste cliente" className="mt-3 min-h-28 w-full resize-y rounded-lg border border-border bg-background p-3 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-ring" /><Button size="sm" variant="outline" className="mt-2 h-9 text-xs" disabled={savingNotes} onClick={async () => { setSavingNotes(true); try { await handleSaveLeadNotes(); } finally { setSavingNotes(false); } }}>{savingNotes ? "Salvando…" : "Salvar notas"}</Button></section>
            <details className="mt-5 rounded-xl border border-border/60 bg-card/20"><summary className="cursor-pointer p-3 text-sm font-medium">Resumo da conversa</summary><p className="px-3 pb-3 text-sm leading-relaxed text-muted-foreground">{summary || "Ainda não há resumo salvo para esta conversa."}</p>{aiMemory?.last_updated && <p className="px-3 pb-3 text-xs text-muted-foreground">Atualizado em {new Date(aiMemory.last_updated).toLocaleString("pt-BR")}</p>}</details>
          </InboxSectionBoundary>
        </TabsContent>
        <TabsContent value="files" className="m-0 space-y-4">
          <InboxSectionBoundary fallbackLabel="Arquivos">
            <div><h3 className="font-semibold">Arquivos compartilhados</h3><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Arquivos do histórico carregado desta conversa. Carregue mensagens anteriores para consultar arquivos mais antigos.</p></div>
            <div className="mt-3 flex flex-wrap gap-1.5">{[{ value: "all", label: "Todos", icon: Folder }, { value: "image", label: "Imagens", icon: Image }, { value: "video", label: "Vídeos", icon: Video }, { value: "audio", label: "Áudios", icon: MessageSquare }, { value: "file", label: "Docs", icon: FileText }].map(filter => <Button key={filter.value} size="sm" variant={fileFilter === filter.value ? "secondary" : "ghost"} className="h-8 gap-1.5 px-2 text-xs" onClick={() => { setFileFilter(filter.value); setShowAllFiles(false); }}><filter.icon className="h-3.5 w-3.5" />{filter.label}</Button>)}</div>
            {filteredMedia.length === 0 ? <p className="mt-4 rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Nenhum arquivo encontrado neste histórico.</p> : <><div className="mt-4 grid grid-cols-2 gap-2.5">{filteredMedia.slice(0, showAllFiles ? undefined : 6).map(message => <SharedMediaCard key={message.id} message={message} onOpen={handleOpenMediaPreview} onDownload={handleDownloadMedia} onAttach={onAttachMedia} />)}</div>{filteredMedia.length > 6 && <Button variant="outline" size="sm" className="mt-3 h-9 w-full text-xs" onClick={() => setShowAllFiles(value => !value)}>{showAllFiles ? "Mostrar menos" : `Ver mais ${filteredMedia.length - 6} arquivos`}</Button>}</>}
          </InboxSectionBoundary>
        </TabsContent>
      </div>
      <QuickResponseModal isOpen={Boolean(previewReply)} onClose={() => setPreviewReply(null)} quickReply={previewReply} recipientName={selectedConversation.contactName} onDispatch={sendQuickReply} disabled={sending || !isWhatsappConnected} />
    </Tabs>
  ) : <div className="p-5 text-sm text-muted-foreground">Selecione uma conversa para ver os detalhes.</div>;
  if (isDrawer) return <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-background">{panelContent}</div>;
  return <aside className={cn("h-full min-h-0 w-full border-l border-border/60 bg-background", isTabletLayout ? "hidden" : "hidden lg:flex lg:flex-col")} aria-label="Painel da conversa">{rightPanelCollapsed ? <div className="flex flex-col items-center gap-3 py-4"><TooltipProvider delayDuration={150}><Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" className="h-10 w-10" aria-label="Expandir painel de detalhes" onClick={() => setRightPanelCollapsed(false)}><ChevronLeft className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent side="left">Expandir painel</TooltipContent></Tooltip>{SECTIONS.map(section => <Tooltip key={section.id}><TooltipTrigger asChild><Button size="icon" variant="ghost" className={cn("h-10 w-10", activeTab === section.id && "bg-primary/10 text-primary")} aria-label={section.label} onClick={() => { setRightPanelTab(section.id); setRightPanelCollapsed(false); }}><section.icon className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent side="left">{section.label}</TooltipContent></Tooltip>)}</TooltipProvider></div> : panelContent}</aside>;
}
