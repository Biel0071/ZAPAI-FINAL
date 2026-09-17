import React, { useState, useEffect } from "react";
import {
  Brain,
  ShieldCheck,
  BookOpen,
  MapPin,
  Tag,
  CheckCircle,
  History,
  Sparkles,
  RefreshCw,
  Plus
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { API_ORIGIN } from "@/services/apiService";

interface AILearningSidebarProps {
  conversationId: string | number;
  phone?: string;
  onOpenTeachModal?: () => void;
}

export function AILearningSidebar({ conversationId, phone, onOpenTeachModal }: AILearningSidebarProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

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
    <div className="w-80 h-full border-l border-border/50 bg-card/40 flex flex-col overflow-y-auto p-4 space-y-4 text-xs">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-border/40 pb-3">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-emerald-400" />
          <h3 className="font-semibold text-foreground text-sm">AI Learning</h3>
        </div>
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={fetchContext} disabled={loading}>
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Layer 1: Official Rules Guard */}
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 space-y-1.5">
        <div className="flex items-center gap-1.5 font-medium text-emerald-400">
          <ShieldCheck className="w-4 h-4" />
          <span>Verdade Oficial Ativa</span>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Preços de catálogo, política de frete e prazos protegidos contra alucinações.
        </p>
      </div>

      {/* Layer 2: Customer Structured Memory */}
      <Card className="border border-border/50 bg-background/50 shadow-none">
        <CardHeader className="p-3 pb-1.5">
          <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-blue-400" />
            Memória do Cliente
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0 space-y-2">
          <div>
            <span className="text-muted-foreground text-[11px]">Bairro / Local:</span>
            <p className="font-medium text-foreground">
              {ctx.neighborhood ? ctx.neighborhood : <span className="text-muted-foreground italic">Ainda não informado</span>}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground text-[11px]">Itens de Interesse / Cotados:</span>
            {ctx.quotedProducts && ctx.quotedProducts.length > 0 ? (
              <div className="flex flex-wrap gap-1 mt-1">
                {ctx.quotedProducts.map((p: string, idx: number) => (
                  <Badge key={idx} variant="secondary" className="text-[10px] px-1.5 py-0">
                    {p}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground italic">Nenhum produto fixado</p>
            )}
          </div>
          {ctx.paymentPreference && (
            <div>
              <span className="text-muted-foreground text-[11px]">Pagamento Preferido:</span>
              <p className="font-medium text-emerald-400">{ctx.paymentPreference}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Layer 3: Active Playbook */}
      <Card className="border border-border/50 bg-background/50 shadow-none">
        <CardHeader className="p-3 pb-1.5">
          <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5 text-purple-400" />
            Playbook em Execução
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0 space-y-1.5">
          {pb ? (
            <>
              <Badge className="bg-purple-600 text-white text-[10px]">
                {pb.name}
              </Badge>
              <p className="text-[11px] text-muted-foreground mt-1">
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
        </CardContent>
      </Card>

      {/* Layer 4: Recent Experiences in this chat */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-muted-foreground font-medium text-[11px]">
          <History className="w-3.5 h-3.5 text-amber-400" />
          <span>Experiências Registradas</span>
        </div>
        {recent.length === 0 ? (
          <p className="text-muted-foreground italic text-[11px]">Nenhum evento registrado ainda neste chat.</p>
        ) : (
          <div className="space-y-1.5">
            {recent.slice(0, 3).map((exp: any) => (
              <div key={exp.id} className="p-2 rounded bg-muted/20 border border-border/30 text-[11px] space-y-1">
                <p className="text-muted-foreground truncate">
                  <strong>Cli:</strong> "{exp.customer_utterance}"
                </p>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-emerald-400">
                    {exp.customer_replied ? "✓ Cliente respondeu" : "Aguardando réplica"}
                  </span>
                  {exp.human_intervened && (
                    <Badge variant="outline" className="text-[9px] border-amber-500/30 text-amber-400 px-1 py-0">
                      Intervenção humana
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom CTA to Teach AI */}
      <div className="pt-2">
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
