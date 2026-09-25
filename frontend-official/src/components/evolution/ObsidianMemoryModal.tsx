import React, { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { MemoryGraphViewer } from "@/components/MemoryGraphViewer";
import {
  Network,
  Image as ImageIcon,
  MessageSquare,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Search,
  Tag,
  CheckCircle2,
  Calendar,
  Layers,
  Info,
  Loader2,
  Maximize2,
  Copy,
  Check,
  Filter,
  FileText
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { API_ORIGIN, requestApiEndpoint } from "@/services/apiService";
import { useToast } from "@/hooks/use-toast";

interface ObsidianMemoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  graphData: {
    nodes: any[];
    edges: any[];
    stats?: any;
  };
  agentName?: string;
  storeName?: string;
}

export interface StoredMediaItem {
  id: string;
  title: string;
  category: "produto" | "comprovante" | "catalogo" | "obra" | "documento";
  url: string;
  mediaType?: string;
  originChat: string;
  customerName: string;
  ocrAnalysis: string;
  learnedKnowledge: string;
  detectedAt: string;
  confidence: number;
  fromMe?: boolean;
}

export const ObsidianMemoryModal: React.FC<ObsidianMemoryModalProps> = ({
  open,
  onOpenChange,
  graphData,
  agentName = "Camila",
  storeName = "Depósito Vista Alegre"
}) => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"graph" | "media" | "trace">("graph");
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [searchFilter, setSearchFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("todos");

  // Real WhatsApp media state
  const [mediaItems, setMediaItems] = useState<StoredMediaItem[]>([]);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [selectedPreviewItem, setSelectedPreviewItem] = useState<StoredMediaItem | null>(null);
  const [copiedOcr, setCopiedOcr] = useState(false);

  // Fetch real media from database
  const fetchRealMedia = useCallback(async () => {
    try {
      setLoadingMedia(true);
      const res = await requestApiEndpoint<any>(`/api/ai/memory/media?limit=50`);
      const items = Array.isArray(res)
        ? res
        : (Array.isArray(res?.items)
          ? res.items
          : (Array.isArray(res?.data)
            ? res.data
            : []));
      setMediaItems(items);
    } catch (err: any) {
      console.error("[ObsidianMemoryModal] Failed to fetch real media:", err);
      toast({
        title: "Aviso",
        description: "Não foi possível carregar as mídias em tempo real.",
        variant: "destructive",
      });
    } finally {
      setLoadingMedia(false);
    }
  }, [toast]);

  useEffect(() => {
    if (open) {
      void fetchRealMedia();
    }
  }, [open, fetchRealMedia]);

  const resolveMediaUrl = (url: string) => {
    if (!url) return "";
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    if (url.startsWith("/http://") || url.startsWith("/https://")) return url.slice(1);
    const clean = url.startsWith("/") ? url : `/${url}`;
    return `${API_ORIGIN}${clean}`;
  };

  const handleCopyOcr = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedOcr(true);
    setTimeout(() => setCopiedOcr(false), 2000);
    toast({ title: "Copiado", description: "Texto da análise visual copiado!" });
  };

  const filteredMedia = mediaItems.filter((item) => {
    const matchesCategory = categoryFilter === "todos" || item.category === categoryFilter;
    const matchesSearch = searchFilter
      ? item.title.toLowerCase().includes(searchFilter.toLowerCase()) ||
        item.customerName.toLowerCase().includes(searchFilter.toLowerCase()) ||
        item.ocrAnalysis.toLowerCase().includes(searchFilter.toLowerCase())
      : true;
    return matchesCategory && matchesSearch;
  });

  const filteredNodes = graphData.nodes.filter((n) =>
    searchFilter ? n.label.toLowerCase().includes(searchFilter.toLowerCase()) || n.type.toLowerCase().includes(searchFilter.toLowerCase()) : true
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[88vh] flex flex-col p-0 overflow-hidden bg-[#0a0f18] border-border/80 text-foreground">
        
        {/* HEADER MODAL */}
        <DialogHeader className="p-5 border-b border-border/60 bg-[#0d131f] flex flex-row items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Network className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold flex items-center gap-2 text-white">
                Memória Ativa — {agentName}
                <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/30">
                  {graphData.nodes.length} nós no grafo
                </Badge>
                <Badge variant="outline" className="text-[10px] text-cyan-400 border-cyan-500/30">
                  {mediaItems.length} mídias reais
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Nós semânticos, mídias e fotos reais do WhatsApp com visão computacional e OCR da loja {storeName}.
              </DialogDescription>
            </div>
          </div>

          {/* SUBTABS */}
          <div className="flex items-center gap-1.5 bg-[#080c14] p-1 rounded-xl border border-border/50">
            <button
              type="button"
              onClick={() => setActiveTab("graph")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === "graph"
                  ? "bg-emerald-500 text-black shadow-sm"
                  : "text-muted-foreground hover:text-white"
              }`}
            >
              <Network className="w-3.5 h-3.5" />
              <span>Grafo Obsidian</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("media")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === "media"
                  ? "bg-emerald-500 text-black shadow-sm"
                  : "text-muted-foreground hover:text-white"
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>Mídias & Imagens ({mediaItems.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("trace")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === "trace"
                  ? "bg-emerald-500 text-black shadow-sm"
                  : "text-muted-foreground hover:text-white"
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Rastreabilidade</span>
            </button>
          </div>
        </DialogHeader>

        {/* MODAL BODY */}
        <div className="flex-1 overflow-hidden relative">
          
          {/* TAB 1: GRAFO OBSIDIAN */}
          {activeTab === "graph" && (
            <div className="w-full h-full relative flex">
              <div className="flex-1 h-full relative">
                <MemoryGraphViewer
                  graphData={graphData}
                  height={window.innerHeight * 0.72}
                  onNodeClick={(node) => setSelectedNode(node)}
                />
              </div>

              {/* NODE DETAILS DRAWER */}
              {selectedNode && (
                <div className="w-80 border-l border-border/60 bg-[#0d131f]/95 p-4 backdrop-blur-md overflow-y-auto animate-fade-in shrink-0">
                  <div className="flex items-center justify-between pb-3 border-b border-border/40">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Conceito Selecionado
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedNode(null)}
                      className="text-xs text-muted-foreground hover:text-white"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="mt-4 space-y-3">
                    <div>
                      <h4 className="text-sm font-bold text-white">{selectedNode.label}</h4>
                      <Badge variant="secondary" className="mt-1 text-[10px] capitalize">
                        {selectedNode.type}
                      </Badge>
                    </div>

                    <div className="p-3 rounded-xl bg-background/50 border border-border/50 space-y-1.5 text-xs">
                      <div className="text-muted-foreground">Peso do conceito:</div>
                      <div className="font-semibold text-emerald-400">{selectedNode.weight || 1} conexões</div>
                    </div>

                    {selectedNode.properties && Object.keys(selectedNode.properties).length > 0 && (
                      <div className="space-y-1.5 text-xs">
                        <div className="font-medium text-muted-foreground">Propriedades Extraídas:</div>
                        <div className="p-2.5 rounded-lg bg-[#080c14] border border-border/40 text-[11px] font-mono break-all space-y-1">
                          {Object.entries(selectedNode.properties).map(([k, v]) => (
                            <div key={k}>
                              <span className="text-emerald-400">{k}:</span> {String(v)}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: GALERIA DE MÍDIAS & IMAGENS NA MEMÓRIA (DADOS 100% REAIS DO WHATSAPP) */}
          {activeTab === "media" && (
            <div className="w-full h-full p-6 overflow-y-auto space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border/40">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-emerald-400" />
                    Mídias & Imagens Armazenadas no Banco WhatsApp
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Fotos reais recebidas dos clientes e produtos cadastrados interpretados pela visão computacional.
                  </p>
                </div>

                {/* FILTROS E BUSCA */}
                <div className="flex items-center gap-2">
                  <div className="relative w-48 sm:w-56">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por produto, OCR ou cliente..."
                      value={searchFilter}
                      onChange={(e) => setSearchFilter(e.target.value)}
                      className="h-8 pl-8 text-xs bg-[#080c14] border-border/60 text-white"
                    />
                  </div>

                  <div className="flex items-center gap-1 bg-[#080c14] p-0.5 rounded-lg border border-border/50 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setCategoryFilter("todos")}
                      className={`px-2 py-1 rounded transition-all ${
                        categoryFilter === "todos"
                          ? "bg-emerald-500 text-black font-bold"
                          : "text-muted-foreground hover:text-white"
                      }`}
                    >
                      Todos
                    </button>
                    <button
                      type="button"
                      onClick={() => setCategoryFilter("produto")}
                      className={`px-2 py-1 rounded transition-all ${
                        categoryFilter === "produto"
                          ? "bg-emerald-500 text-black font-bold"
                          : "text-muted-foreground hover:text-white"
                      }`}
                    >
                      Produtos
                    </button>
                    <button
                      type="button"
                      onClick={() => setCategoryFilter("comprovante")}
                      className={`px-2 py-1 rounded transition-all ${
                        categoryFilter === "comprovante"
                          ? "bg-emerald-500 text-black font-bold"
                          : "text-muted-foreground hover:text-white"
                      }`}
                    >
                      Comprovantes
                    </button>
                    <button
                      type="button"
                      onClick={() => setCategoryFilter("obra")}
                      className={`px-2 py-1 rounded transition-all ${
                        categoryFilter === "obra"
                          ? "bg-emerald-500 text-black font-bold"
                          : "text-muted-foreground hover:text-white"
                      }`}
                    >
                      Obras
                    </button>
                  </div>
                </div>
              </div>

              {loadingMedia ? (
                <div className="py-20 flex flex-col items-center justify-center gap-3 text-muted-foreground text-xs">
                  <Loader2 className="w-7 h-7 text-emerald-400 animate-spin" />
                  <span>Carregando mídias reais do WhatsApp...</span>
                </div>
              ) : filteredMedia.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground text-xs space-y-2">
                  <ImageIcon className="w-10 h-10 mx-auto opacity-30 text-emerald-400" />
                  <p className="font-semibold text-white">Nenhuma mídia encontrada com os filtros selecionados</p>
                  <p className="max-w-md mx-auto">
                    Quando clientes enviarem fotos de produtos, comprovantes ou obras no WhatsApp, a IA interpretará automaticamente e indexará aqui.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredMedia.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-border/60 bg-[#0d131f] overflow-hidden flex flex-col sm:flex-row gap-3 p-3.5 hover:border-emerald-500/40 transition-all shadow-sm group"
                    >
                      <div
                        className="w-full sm:w-36 h-36 rounded-xl overflow-hidden bg-black/40 shrink-0 relative cursor-pointer group-hover:opacity-95 transition-opacity flex items-center justify-center border border-border/40"
                        onClick={() => setSelectedPreviewItem(item)}
                      >
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-2 text-center text-muted-foreground/60 select-none pointer-events-none">
                          {item.category === "comprovante" ? (
                            <FileText className="w-8 h-8 mb-1 text-emerald-400/40" />
                          ) : (
                            <ImageIcon className="w-8 h-8 mb-1 text-emerald-400/40" />
                          )}
                          <span className="text-[9px] line-clamp-1 text-slate-400 font-mono">
                            {item.title.slice(0, 20)}
                          </span>
                        </div>
                        <img
                          src={resolveMediaUrl(item.url)}
                          alt={item.title}
                          className="w-full h-full object-cover relative z-0"
                          onError={(e) => {
                            // Fallback to icon preview if file missing
                            const target = e.target as HTMLElement;
                            target.style.display = "none";
                          }}
                        />
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity z-10">
                          <Maximize2 className="w-5 h-5 text-white" />
                        </div>
                        <Badge className="absolute top-2 left-2 text-[9px] bg-black/75 backdrop-blur-sm capitalize z-10">
                          {item.category}
                        </Badge>
                      </div>

                      <div className="flex-1 flex flex-col justify-between min-w-0">
                        <div>
                          <div className="flex items-start justify-between gap-1">
                            <h4
                              className="text-xs font-bold text-white line-clamp-1 cursor-pointer hover:text-emerald-400 transition-colors"
                              onClick={() => setSelectedPreviewItem(item)}
                              title={item.title}
                            >
                              {item.title}
                            </h4>
                            <Badge variant="outline" className="text-[9px] text-emerald-400 border-emerald-500/30 shrink-0">
                              {item.fromMe ? "Loja" : "Cliente"}
                            </Badge>
                          </div>

                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-1">
                            <span className="text-emerald-400 font-medium">{item.customerName}</span>
                            <span>•</span>
                            <span>{item.detectedAt}</span>
                          </div>

                          <div className="mt-2 text-[11px] text-muted-foreground bg-[#080c14] p-2 rounded-lg border border-border/40 line-clamp-3">
                            <span className="text-white font-semibold">Análise Visual: </span>
                            {item.ocrAnalysis}
                          </div>
                        </div>

                        <div className="mt-2 pt-2 border-t border-border/40 flex items-center justify-between text-[10px]">
                          <span className="text-emerald-400 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Confiança: {Math.round(item.confidence * 100)}%
                          </span>
                          <button
                            type="button"
                            onClick={() => setSelectedPreviewItem(item)}
                            className="text-emerald-400 hover:underline flex items-center gap-1"
                          >
                            <span>Inspecionar</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: RASTREABILIDADE DAS CONVERSAS */}
          {activeTab === "trace" && (
            <div className="w-full h-full p-6 overflow-y-auto space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-emerald-400" />
                    Rastreabilidade de Aprendizado Contínuo
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Veja de onde cada aprendizado da assistente foi minerado a partir das conversas reais no WhatsApp.
                  </p>
                </div>

                <div className="w-64 relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-muted-foreground" />
                  <Input
                    placeholder="Filtrar nós ou conversas..."
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    className="h-8 pl-8 text-xs bg-[#080c14] border-border/60 text-white"
                  />
                </div>
              </div>

              <div className="space-y-2">
                {filteredNodes.slice(0, 30).map((node, i) => (
                  <div
                    key={node.id || i}
                    className="p-3 rounded-xl border border-border/60 bg-[#0d131f] flex items-center justify-between gap-4 hover:border-emerald-500/30 transition-all text-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold text-[10px]">
                        #{i + 1}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-white truncate">{node.label}</div>
                        <div className="text-[10px] text-muted-foreground flex items-center gap-2 mt-0.5">
                          <span className="capitalize text-emerald-400">{node.type}</span>
                          <span>•</span>
                          <span>Peso semântico: {node.weight}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] border-border/60 text-muted-foreground">
                        {storeName}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* FULL IMAGE & OCR INSPECTION MODAL */}
        {selectedPreviewItem && (
          <Dialog open={Boolean(selectedPreviewItem)} onOpenChange={() => setSelectedPreviewItem(null)}>
            <DialogContent className="max-w-3xl bg-[#0d131f] border-border text-foreground p-0 overflow-hidden">
              <div className="p-4 border-b border-border/60 flex items-center justify-between bg-[#0a0f18]">
                <div className="flex items-center gap-2">
                  <Badge className="capitalize text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                    {selectedPreviewItem.category}
                  </Badge>
                  <h3 className="text-sm font-bold text-white line-clamp-1">{selectedPreviewItem.title}</h3>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {selectedPreviewItem.detectedAt}
                </div>
              </div>

              <div className="p-4 space-y-4 max-h-[75vh] overflow-y-auto">
                <div className="w-full min-h-60 max-h-96 rounded-xl overflow-hidden bg-black/60 flex items-center justify-center border border-border/50 relative">
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-muted-foreground select-none pointer-events-none">
                    {selectedPreviewItem.category === "comprovante" ? (
                      <FileText className="w-12 h-12 mb-2 text-emerald-400/30" />
                    ) : (
                      <ImageIcon className="w-12 h-12 mb-2 text-emerald-400/30" />
                    )}
                    <p className="text-xs font-semibold text-white">{selectedPreviewItem.title}</p>
                    <p className="text-[11px] text-muted-foreground mt-1 max-w-sm">
                      Arquivo indexado no banco WhatsApp ({selectedPreviewItem.originChat}).
                    </p>
                  </div>
                  <img
                    src={resolveMediaUrl(selectedPreviewItem.url)}
                    alt={selectedPreviewItem.title}
                    className="max-h-96 max-w-full object-contain relative z-10"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                </div>

                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-[#080c14] border border-border/60 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                        Análise de Visão Computacional / OCR
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopyOcr(selectedPreviewItem.ocrAnalysis)}
                        className="text-[11px] text-muted-foreground hover:text-white flex items-center gap-1"
                      >
                        {copiedOcr ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedOcr ? "Copiado" : "Copiar Análise"}</span>
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
                      {selectedPreviewItem.ocrAnalysis}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                    <div className="p-2.5 rounded-lg bg-background/50 border border-border/40">
                      <span className="block text-[10px] text-muted-foreground">Origem</span>
                      <strong className="text-white truncate block">{selectedPreviewItem.customerName}</strong>
                    </div>
                    <div className="p-2.5 rounded-lg bg-background/50 border border-border/40">
                      <span className="block text-[10px] text-muted-foreground">Confiança da Visão</span>
                      <strong className="text-emerald-400">{Math.round(selectedPreviewItem.confidence * 100)}%</strong>
                    </div>
                    <div className="p-2.5 rounded-lg bg-background/50 border border-border/40">
                      <span className="block text-[10px] text-muted-foreground">Chat WhatsApp</span>
                      <strong className="text-white truncate block">{selectedPreviewItem.originChat}</strong>
                    </div>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}

      </DialogContent>
    </Dialog>
  );
};
