import React, { useState } from "react";
import { ThumbsUp, ThumbsDown, Edit3, Brain, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { API_ORIGIN } from "@/services/apiService";

interface AIMessageFeedbackProps {
  conversationId: string | number;
  messageId?: string | number;
  aiResponseText?: string;
}

export function AIMessageFeedback({ conversationId, messageId, aiResponseText }: AIMessageFeedbackProps) {
  const { toast } = useToast();
  const [rated, setRated] = useState<"positive" | "negative" | "corrected" | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [feedbackCategory, setFeedbackCategory] = useState("strategy");
  const [correctionNote, setCorrectionNote] = useState("");
  const [sending, setSending] = useState(false);

  const handleQuickRating = async (rating: "positive" | "negative") => {
    setRated(rating);
    try {
      await fetch(`${API_ORIGIN}/api/ai/evolution/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "omit",
        body: JSON.stringify({
          conversationId,
          rating,
          category: "general",
          note: rating === "positive" ? "Atendente marcou como eficaz" : "Atendente marcou como insatisfatório"
        })
      });
      toast({
        title: rating === "positive" ? "Experiência positiva registrada!" : "Feedback registrado para evolução.",
      });
    } catch (err) {
      console.warn("[AIMessageFeedback] error sending feedback:", err);
    }
  };

  const handleSaveCorrection = async () => {
    if (!correctionNote.trim()) {
      toast({ title: "Informe como a IA deveria responder", variant: "destructive" });
      return;
    }

    try {
      setSending(true);
      await fetch(`${API_ORIGIN}/api/ai/evolution/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "omit",
        body: JSON.stringify({
          conversationId,
          rating: "corrected",
          category: feedbackCategory,
          note: correctionNote
        })
      });

      setRated("corrected");
      setModalOpen(false);
      toast({
        title: "Correção salva na Memória de Experiência!",
        description: "A IA utilizará este exemplo para sugerir um novo padrão no Evolution Center.",
      });
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-1 mt-1 opacity-70 hover:opacity-100 transition-opacity">
        <Button
          size="icon"
          variant="ghost"
          className={`h-5 w-5 rounded p-0 text-muted-foreground hover:text-emerald-400 ${rated === "positive" ? "text-emerald-400 font-bold" : ""}`}
          title="Resposta eficaz (Gostei)"
          onClick={() => handleQuickRating("positive")}
        >
          {rated === "positive" ? <Check className="w-3 h-3" /> : <ThumbsUp className="w-3 h-3" />}
        </Button>

        <Button
          size="icon"
          variant="ghost"
          className={`h-5 w-5 rounded p-0 text-muted-foreground hover:text-amber-400 ${rated === "negative" ? "text-amber-400 font-bold" : ""}`}
          title="Pode melhorar"
          onClick={() => handleQuickRating("negative")}
        >
          <ThumbsDown className="w-3 h-3" />
        </Button>

        <Button
          size="icon"
          variant="ghost"
          className={`h-5 w-5 rounded p-0 text-muted-foreground hover:text-blue-400 ${rated === "corrected" ? "text-blue-400 font-bold" : ""}`}
          title="Corrigir / Ensinar resposta ideal"
          onClick={() => setModalOpen(true)}
        >
          <Edit3 className="w-3 h-3" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="h-5 px-1.5 text-[10px] text-muted-foreground hover:text-purple-400 flex items-center gap-0.5"
          onClick={() => setModalOpen(true)}
        >
          <Brain className="w-2.5 h-2.5" /> Ensinar IA
        </Button>
      </div>

      {/* Teaching Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Brain className="w-4 h-4 text-purple-400" />
              Ensinar IA — Correção de Atendimento
            </DialogTitle>
            <DialogDescription className="text-xs">
              Ensine a IA como responder corretamente nesta situação. Este ensinamento gerará uma nova
              sugestão evolutiva para aprovação.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <Label className="text-xs">Tipo de Correção</Label>
              <Select value={feedbackCategory} onValueChange={setFeedbackCategory}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="strategy">Estratégia de Venda / CTA</SelectItem>
                  <SelectItem value="price">Preço ou Condição de Pagamento</SelectItem>
                  <SelectItem value="shipping">Frete e Regra de Entrega</SelectItem>
                  <SelectItem value="tone">Tom de Voz / Simpatia</SelectItem>
                  <SelectItem value="info">Informação Técnica do Produto</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {aiResponseText && (
              <div className="p-2 rounded bg-muted/20 border border-border/30 text-[11px] text-muted-foreground">
                <span className="font-semibold text-foreground">Resposta da IA que precisa mudar:</span>
                <p className="line-clamp-2 mt-0.5 italic">"{aiResponseText}"</p>
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-xs">Como a IA deveria responder?</Label>
              <Textarea
                value={correctionNote}
                onChange={(e) => setCorrectionNote(e.target.value)}
                placeholder="Escreva a resposta ou argumento comercial ideal que você usaria..."
                rows={4}
                className="text-xs"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button size="sm" className="bg-purple-600 hover:bg-purple-700 text-white" disabled={sending} onClick={handleSaveCorrection}>
              {sending ? "Salvando..." : "Ensinar IA"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
export default AIMessageFeedback;
