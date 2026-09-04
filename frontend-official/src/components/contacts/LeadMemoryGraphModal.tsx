import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Brain,
  TreeStructure,
  User,
  ShoppingBag,
  PaperPlaneTilt,
  ChatTeardropText,
  Receipt,
  Headset,
  Sparkle,
  ClockHistory,
  Tag,
  CheckCircle,
} from "@phosphor-icons/react";

export interface LeadMemoryGraphModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: {
    id: string;
    name: string;
    phone: string;
    company?: string;
    city?: string;
    temperature?: "hot" | "warm" | "cold";
    sentiment?: string;
    summary?: string;
    preferences?: string[];
    objections?: string[];
    products?: string[];
    urgency?: string;
    persona?: string;
  } | null;
}

export function LeadMemoryGraphModal({ isOpen, onClose, lead }: LeadMemoryGraphModalProps) {
  if (!isOpen || !lead) return null;

  const [activeTab, setActiveTab] = useState<"graph" | "memory" | "commercial">("graph");

  const nodes = [
    { type: "cliente", title: lead.name, sub: lead.phone, icon: User, color: "bg-blue-500/20 text-blue-400 border-blue-500/40" },
    { type: "empresa", title: lead.company || "Empresa não informada", sub: lead.city || "S/N", icon: Tag, color: "bg-indigo-500/20 text-indigo-400 border-indigo-500/40" },
    { type: "produtos", title: lead.products?.[0] || "Nenhum produto associado", sub: lead.products?.length ? `${lead.products.length} itens` : "-", icon: ShoppingBag, color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40" },
    { type: "campanhas", title: "Campanhas Inbound", sub: "Não vinculado", icon: PaperPlaneTilt, color: "bg-purple-500/20 text-purple-400 border-purple-500/40" },
    { type: "mensagens", title: "Mensagens", sub: "Sem interações", icon: ChatTeardropText, color: "bg-amber-500/20 text-amber-400 border-amber-500/40" },
    { type: "pedidos", title: "Propostas", sub: "Nenhuma proposta", icon: Receipt, color: "bg-pink-500/20 text-pink-400 border-pink-500/40" },
    { type: "atendentes", title: "Atendimento", sub: "Aguardando", icon: Headset, color: "bg-teal-500/20 text-teal-400 border-teal-500/40" },
    { type: "memoria", title: "Memória IA", sub: `${lead.preferences?.length || 0} salva(s)`, icon: Brain, color: "bg-emerald-500/20 text-emerald-300 border-emerald-400/60" },
  ];

  return (
    <AnimatePresence>
      {isOpen && lead && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ type: "spring", bounce: 0.3, duration: 0.5 }}
            className="w-full max-w-4xl max-h-[90vh] bg-card/95 border border-border/60 rounded-2xl shadow-2xl shadow-emerald-500/10 flex flex-col overflow-hidden relative"
          >
            {/* Inner Glow / Glass Reflection */}
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />
            
            {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border/60 bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <TreeStructure size={28} weight="duotone" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display font-bold text-xl text-foreground">{lead.name}</h3>
                <Badge variant="outline" className="text-xs border-emerald-500/40 text-emerald-400">
                  Painel Inteligente + Memória
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {lead.phone} • {lead.company || "Empresa não informada"} • {lead.city || "Brasil"}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="rounded-xl">
            ✕
          </Button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 pt-3 border-b border-border/40 bg-card/60">
          <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as any)}>
            <TabsList className="bg-muted/40 p-1 rounded-xl">
              <TabsTrigger value="graph" className="text-xs font-semibold flex gap-1.5">
                <TreeStructure size={16} /> Grafo de Relacionamento
              </TabsTrigger>
              <TabsTrigger value="memory" className="text-xs font-semibold flex gap-1.5">
                <Brain size={16} /> Memória Persistente IA
              </TabsTrigger>
              <TabsTrigger value="commercial" className="text-xs font-semibold flex gap-1.5">
                <Receipt size={16} /> Histórico Comercial & Timeline
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Tab Contents */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* GRAPH TAB */}
          {activeTab === "graph" && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Conexões do Cliente no Ecossistema ZAPFLOW
                </h4>
                <Badge className="bg-primary/20 text-primary border-primary/40 text-xs">
                  8 Nós Conectados em Tempo Real
                </Badge>
              </div>

              {/* Node Graph Visualizer Grid */}
              <motion.div 
                className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4"
                initial="hidden"
                animate="visible"
                variants={{
                  visible: { transition: { staggerChildren: 0.08 } },
                  hidden: {}
                }}
              >
                {nodes.map((node, i) => {
                  const Icon = node.icon;
                  return (
                    <motion.div
                      key={node.type}
                      variants={{
                        hidden: { opacity: 0, scale: 0.8, y: 15 },
                        visible: { opacity: 1, scale: 1, y: 0, transition: { type: "spring", bounce: 0.4 } }
                      }}
                      whileHover={{ scale: 1.03 }}
                    >
                      <Card
                        className={`relative h-full rounded-2xl border p-4 transition-colors ${node.color} border-transparent bg-origin-border [background-image:linear-gradient(to_bottom,var(--border)_0%,transparent_100%)]`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Icon size={20} weight="duotone" />
                          <span className="text-[10px] font-bold uppercase tracking-[0.1em]">{node.type}</span>
                        </div>
                        <h5 className="font-bold text-sm text-foreground truncate">{node.title}</h5>
                        <p className="text-xs text-muted-foreground mt-0.5">{node.sub}</p>
                      </Card>
                    </motion.div>
                  );
                })}
              </motion.div>

              <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-xs text-emerald-300 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkle size={18} className="text-emerald-400" />
                  <span>
                    Todas as interações deste cliente geram indexação automática de embeddings no PostgreSQL.
                  </span>
                </div>
                <Button size="sm" variant="outline" className="text-xs border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/20">
                  Exportar Grafo JSON
                </Button>
              </div>
            </div>
          )}

          {/* MEMORY TAB */}
          {activeTab === "memory" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Resumo & Perfil */}
                <Card className="rounded-2xl border-transparent bg-origin-border [background-image:linear-gradient(to_bottom,var(--border)_0%,transparent_100%)] bg-card/60 p-4 space-y-3 relative overflow-hidden">
                  <div className="absolute inset-x-0 top-0 h-px bg-white/5" />
                  <h4 className="text-xs font-bold uppercase tracking-[0.1em] text-primary flex items-center gap-1.5">
                    <Brain size={16} /> Resumo Executivo & Perfil IA
                  </h4>
                  <p className="text-xs leading-relaxed text-muted-foreground text-balance">
                    {lead.summary ||
                      "Ainda não há dados suficientes para gerar o resumo executivo e perfil da IA. A memória será indexada após as interações iniciais."}
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-2 border-t border-border/40">
                    <Badge variant="secondary" className="text-[10px]">
                      Urgência: {lead.urgency || "Indefinido"}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px]">
                      Perfil: {lead.persona || "Não mapeado"}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px]">
                      Sentimento: {lead.sentiment || "Indefinido"}
                    </Badge>
                  </div>
                </Card>

                {/* Preferências & Objeções */}
                <Card className="rounded-2xl border-border/80 bg-card p-4 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle size={16} /> Preferências e Objeções Registradas
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="font-bold text-foreground block mb-1">Preferências Mapeadas:</span>
                      <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                        {lead.preferences?.length ? lead.preferences.map(
                          (p, i) => (
                            <li key={i}>{p}</li>
                          )
                        ) : (
                          <li>Nenhuma preferência registrada.</li>
                        )}
                      </ul>
                    </div>
                    <div className="pt-2 border-t border-border/40">
                      <span className="font-bold text-foreground block mb-1">Objeções Superadas:</span>
                      <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                        {lead.objections?.length ? lead.objections.map((o, i) => (
                          <li key={i}>{o}</li>
                        )) : (
                          <li>Nenhuma objeção registrada.</li>
                        )}
                      </ul>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          )}

          {/* COMMERCIAL TAB */}
          {activeTab === "commercial" && (
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <ClockHistory size={16} /> Timeline de Interações Comerciais
              </h4>

              <div className="space-y-3 pl-4 border-l-2 border-primary/40">
                <p className="text-xs text-muted-foreground">Não há histórico comercial ainda. Assim que as primeiras interações de venda ou propostas forem registradas, o grafo exibirá as trilhas de dados.</p>
              </div>
            </div>
          )}
        </div>
      </motion.div>
      )}
    </AnimatePresence>
  );
}

