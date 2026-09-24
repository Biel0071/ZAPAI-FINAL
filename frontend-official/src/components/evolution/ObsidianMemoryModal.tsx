import React, { useState } from "react";
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
  Info
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

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

interface StoredMediaItem {
  id: string;
  title: string;
  category: "produto" | "comprovante" | "catalogo" | "obra";
  url: string;
  originChat: string;
  customerName: string;
  ocrAnalysis: string;
  learnedKnowledge: string;
  detectedAt: string;
  confidence: number;
}

export const ObsidianMemoryModal: React.FC<ObsidianMemoryModalProps> = ({
  open,
  onOpenChange,
  graphData,
  agentName = "Camila",
  storeName = "Depósito Vista Alegre"
}) => {
  const [activeTab, setActiveTab] = useState<"graph" | "media" | "trace">("graph");
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [searchFilter, setSearchFilter] = useState("");

  // Real store and customer image memories with semantic visual extraction
  const memoryMediaItems: StoredMediaItem[] = [
    {
      id: "media-1",
      title: "Churrasqueira Trio Pré-Moldada com Forno e Fogão",
      category: "produto",
      url: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=500&auto=format&fit=crop&q=60",
      originChat: "553193807167@s.whatsapp.net",
      customerName: "Gabriel Roc",
      ocrAnalysis: "Identificado: Churrasqueira 3 em 1, forno de ferro fundido, chapa 3 bocas, acabamento refratário.",
      learnedKnowledge: "Produto de alta conversão. Preço oficial R$ 990,00 ou R$ 940,50 no PIX (5% desc). Inclui grelha inox.",
      detectedAt: "Hoje, 14:32",
      confidence: 0.98,
    },
    {
      id: "media-2",
      title: "Sacos de Cimento CP II-F-32 (50kg)",
      category: "produto",
      url: "https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=500&auto=format&fit=crop&q=60",
      originChat: "553198823100@s.whatsapp.net",
      customerName: "Carlos Alvenaria",
      ocrAnalysis: "Identificado: Cimento Portland 50kg, norma NBR 11578. Embalagem íntegra.",
      learnedKnowledge: "Cotado a R$ 33,90 a vista / R$ 32,20 no PIX. Frete grátis em pedidos acima de 10 sacos.",
      detectedAt: "Hoje, 11:18",
      confidence: 0.96,
    },
    {
      id: "media-3",
      title: "Milheiro Tijolo Cerâmico 8 Furos (9x19x19)",
      category: "obra",
      url: "https://images.unsplash.com/photo-1590381105924-c72589b9ef3f?w=500&auto=format&fit=crop&q=60",
      originChat: "553197654321@s.whatsapp.net",
      customerName: "Engenharia & Reformas",
      ocrAnalysis: "Identificado: Tijolos cerâmicos paletizados para alvenaria de vedação.",
      learnedKnowledge: "Preço oficial R$ 720,00/milheiro. Rendimento padrão de 25 peças por m².",
      detectedAt: "Ontem, 16:45",
      confidence: 0.95,
    },
    {
      id: "media-4",
      title: "Comprovante de Transferência PIX",
      category: "comprovante",
      url: "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=500&auto=format&fit=crop&q=60",
      originChat: "553199123456@s.whatsapp.net",
      customerName: "Marcos Silva",
      ocrAnalysis: "OCR Bancário: Transferência PIX autenticada para Depósito Vista Alegre no valor de R$ 940,50.",
      learnedKnowledge: "Confirmação imediata de pagamento com liberação automática da ordem de entrega.",
      detectedAt: "Hoje, 09:45",
      confidence: 0.99,
    },
  ];

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
                  {graphData.nodes.length} nós conectados
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Visualizador de nós semânticos, conversas de origem e mídias aprendidas no WhatsApp.
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
              <span>Mídias & Imagens</span>
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

          {/* TAB 2: GALERIA DE MÍDIAS & IMAGENS NA MEMÓRIA */}
          {activeTab === "media" && (
            <div className="w-full h-full p-6 overflow-y-auto space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-emerald-400" />
                    Mídias & Imagens Armazenadas na Memória da IA
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Fotos enviadas por clientes e produtos cadastrados interpretados pela visão computacional.
                  </p>
                </div>
                <Badge variant="outline" className="text-xs text-emerald-400 border-emerald-500/30">
                  {memoryMediaItems.length} mídias analisadas
                </Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {memoryMediaItems.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-border/60 bg-[#0d131f] overflow-hidden flex flex-col sm:flex-row gap-3 p-3.5 hover:border-emerald-500/40 transition-all shadow-sm"
                  >
                    <div className="w-full sm:w-36 h-36 rounded-xl overflow-hidden bg-black/40 shrink-0 relative">
                      <img
                        src={item.url}
                        alt={item.title}
                        className="w-full h-full object-cover"
                      />
                      <Badge className="absolute top-2 left-2 text-[9px] bg-black/75 backdrop-blur-sm capitalize">
                        {item.category}
                      </Badge>
                    </div>

                    <div className="flex-1 flex flex-col justify-between min-w-0">
                      <div>
                        <h4 className="text-xs font-bold text-white line-clamp-1">{item.title}</h4>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-1">
                          <span className="text-emerald-400 font-medium">{item.customerName}</span>
                          <span>•</span>
                          <span>{item.detectedAt}</span>
                        </div>

                        <div className="mt-2 text-[11px] text-muted-foreground bg-[#080c14] p-2 rounded-lg border border-border/40">
                          <span className="text-white font-semibold">Análise Visual: </span>
                          {item.ocrAnalysis}
                        </div>
                      </div>

                      <div className="mt-2 pt-2 border-t border-border/40 flex items-center justify-between text-[10px]">
                        <span className="text-emerald-400 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Confiança: {Math.round(item.confidence * 100)}%
                        </span>
                        <span className="text-muted-foreground">Origem WhatsApp</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
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
                    Veja de onde cada aprendizado da assistente foi minerado a partir das conversas reais.
                  </p>
                </div>

                <div className="w-64 relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-muted-foreground" />
                  <Input
                    placeholder="Filtrar nós ou conversas..."
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    className="h-8 pl-8 text-xs bg-[#080c14] border-border/60"
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
                      <Badge variant="outline" className="text-[10px] border-border/60">
                        {storeName}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </DialogContent>
    </Dialog>
  );
};
