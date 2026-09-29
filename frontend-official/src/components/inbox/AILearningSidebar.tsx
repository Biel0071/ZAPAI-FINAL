import React, { useState, useEffect } from "react";
import {
  Brain,
  ShieldCheck,
  BookOpen,
  MapPin,
  History,
  Sparkles,
  RefreshCw,
  ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { useNavigate } from "react-router-dom";
import { API_ORIGIN } from "@/core/services/apiService";

interface AILearningSidebarProps {
  conversationId: string | number;
  phone?: string;
  onOpenTeachModal?: () => void;
}

export function AILearningSidebar({ conversationId, phone, onOpenTeachModal }: AILearningSidebarProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const fetchContext = async () => {
    if (!conversationId) return;
    try {
      setLoading(true);
      const url = `${API_ORIGIN}/api/ai/evolution/context/${conversationId}${phone ? `?phone=${phone}` : ""}`;
      const res = await fetch(url, { credentials: "omit" });
      if (res.ok) {
        const json = await res.json();
        if (json.success) setData(json.data);
      }
    } catch (err) {
      console.warn("[AILearningSidebar] error fetching context:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContext();
  }, [conversationId, phone]);

  const ctx = data?.customerContext || {};
  const pb = data?.activePlaybook || null;
  const recent = data?.recentExperiences || [];

  return (
    <div className="w-80 h-full border-l border-border/50 bg-card/40 flex flex-col overflow-y-auto p-4 space-y-5 text-xs">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-border/40 pb-3">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-emerald-400" />
          <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
            AI Learning
            <ShieldCheck className="w-4 h-4 text-emerald-500" title="Verdade Oficial Ativa" />
          </h3>
        </div>
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={fetchContext} disabled={loading}>
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Memória do Cliente */}
      <div className="space-y-3">
        <h4 className="font-semibold flex items-center gap-1.5 text-blue-400">
          <MapPin className="w-3.5 h-3.5" />
          Memória do Cliente
        </h4>
        <div className="space-y-2 text-[11px]">
          <div>
            <span className="text-muted-foreground">Bairro / Local: </span>
            <span className="font-medium text-foreground">
              {ctx.neighborhood ? ctx.neighborhood : <span className="text-muted-foreground italic">Ainda não informado</span>}
            </span>
          </div>
          
          <div>
            <span className="text-muted-foreground block mb-1">Itens de Interesse / Cotados:</span>
            {ctx.quotedProducts && ctx.quotedProducts.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {ctx.quotedProducts.map((p: string, idx: number) => (
                  <Badge key={idx} variant="secondary" className="text-[10px] px-1.5 py-0 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border-none">
                    {p}
                  </Badge>
                ))}
              </div>
            ) : (
              <span className="text-muted-foreground italic">Nenhum produto fixado</span>
            )}
          </div>

          {ctx.paymentPreference && (
            <div>
              <span className="text-muted-foreground">Pagamento Preferido: </span>
              <span className="font-medium text-emerald-400">{ctx.paymentPreference}</span>
            </div>
          )}
        </div>
        
        <Button 
          variant="link" 
          className="text-[11px] h-auto p-0 text-blue-400 hover:text-blue-300 font-medium group" 
          onClick={() => navigate(`/contacts?phone=${phone}`)}
        >
          Ver ficha completa no CRM
          <ArrowRight className="w-3 h-3 ml-1 group-hover:translate-x-0.5 transition-transform" />
        </Button>
      </div>

      {/* Accordion para Playbook */}
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="playbook" className="border-border/30">
          <AccordionTrigger className="text-xs font-semibold text-purple-400 py-2 hover:no-underline hover:text-purple-300">
            <div className="flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5" />
              Playbook em Execução
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-2 pb-1 space-y-2">
            {pb ? (
              <>
                <Badge className="bg-purple-600/20 text-purple-300 text-[10px] hover:bg-purple-600/30 border-none">
                  {pb.name}
                </Badge>
                <p className="text-[11px] text-muted-foreground">
                  {pb.goal}
                </p>
                {pb.recommended_cta && (
                  <div className="p-2 rounded bg-purple-500/10 text-[11px] text-purple-300 italic mt-1 border border-purple-500/20">
                    CTA: "{pb.recommended_cta}"
                  </div>
                )}
              </>
            ) : (
              <p className="text-muted-foreground italic text-[11px]">Atendimento padrão de qualificação</p>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Experiências Registradas */}
      <div className="space-y-3">
        <h4 className="font-semibold flex items-center gap-1.5 text-amber-400">
          <History className="w-3.5 h-3.5" />
          Experiências
        </h4>
        {recent.length === 0 ? (
          <p className="text-muted-foreground italic text-[11px]">Nenhum evento registrado ainda.</p>
        ) : (
          <div className="space-y-3 border-l-2 border-border/50 ml-1.5 pl-3">
            {recent.slice(0, 3).map((exp: any) => (
              <div key={exp.id} className="text-[11px] space-y-1">
                <p className="text-foreground truncate" title={exp.customer_utterance}>
                  <span className="text-muted-foreground mr-1">Cli:</span>
                  "{exp.customer_utterance}"
                </p>
                <div className="flex items-center gap-2 text-[10px]">
                  <span className="text-emerald-400/80">
                    {exp.customer_replied ? "✓ Respondeu" : "Aguardando"}
                  </span>
                  {exp.human_intervened && (
                    <span className="text-amber-500/80">• Intervenção</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom CTA to Teach AI */}
      <div className="pt-4 mt-auto">
        <Button
          variant="outline"
          size="sm"
          className="w-full text-xs gap-1.5 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
          onClick={onOpenTeachModal}
        >
          <Sparkles className="w-3.5 h-3.5" /> Ensinar IA com esta conversa
        </Button>
      </div>
    </div>
  );
}

export default AILearningSidebar;
