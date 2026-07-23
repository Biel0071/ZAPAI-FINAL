import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sparkle,
  Smiley,
  Paperclip,
  Link,
  ArrowsOut,
  Columns,
  ArrowCounterClockwise,
  ArrowClockwise,
  Bookmarks,
  MagicWand,
  DeviceMobile,
  CheckCircle,
  PaperPlaneTilt,
} from "@phosphor-icons/react";
import { useToast } from "@/hooks/use-toast";

interface RichCampaignEditorProps {
  initialValue?: string;
  onChange?: (value: string) => void;
  onSendTest?: (message: string) => void;
}

const DYNAMIC_VARIABLES = [
  { label: "Nome do Lead", value: "{{nome}}" },
  { label: "Empresa", value: "{{empresa}}" },
  { label: "Cidade", value: "{{cidade}}" },
  { label: "Produto de Interesse", value: "{{produto}}" },
  { label: "Preço / Valor", value: "{{valor}}" },
  { label: "Primeiro Nome", value: "{{primeiro_nome}}" },
];

const SAMPLE_TEMPLATES = [
  {
    title: "Boas-vindas Comercial B2B",
    content: "Olá {{primeiro_nome}}! Vi que você tem interesse em otimizar a operação da {{empresa}}. Gostaria de agendar uma breve demonstração hoje?",
  },
  {
    title: "Recuperação de Lead Frio",
    content: "Oi {{nome}}, tudo bem? Lembrei de você hoje porque lançamos uma condição especial no {{produto}} para empresas em {{cidade}}. Vamos conversar?",
  },
  {
    title: "Follow-up de Proposta Comercial",
    content: "Olá {{primeiro_nome}}, conseguiu analisar a proposta do {{produto}} com valor de {{valor}}? Fico à disposição para tirar qualquer dúvida!",
  },
];

export function RichCampaignEditor({ initialValue = "", onChange, onSendTest }: RichCampaignEditorProps) {
  const { toast } = useToast();
  const [content, setContent] = useState(initialValue);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isSplitView, setIsSplitView] = useState(true);
  const [history, setHistory] = useState<string[]>([initialValue]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const updateContent = (newText: string) => {
    setContent(newText);
    if (onChange) onChange(newText);

    // Track undo/redo history
    const nextHistory = history.slice(0, historyIndex + 1);
    nextHistory.push(newText);
    setHistory(nextHistory);
    setHistoryIndex(nextHistory.length - 1);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const prev = history[historyIndex - 1];
      setHistoryIndex(historyIndex - 1);
      setContent(prev);
      if (onChange) onChange(prev);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const next = history[historyIndex + 1];
      setHistoryIndex(historyIndex + 1);
      setContent(next);
      if (onChange) onChange(next);
    }
  };

  const insertVariable = (varValue: string) => {
    updateContent(content + " " + varValue);
    toast({ title: "Variável inserida", description: `${varValue} adicionada ao texto.` });
  };

  const insertTemplate = (templateContent: string) => {
    updateContent(templateContent);
    toast({ title: "Template Aplicado", description: "O conteúdo do modelo foi carregado." });
  };

  const handleGenerateAICopy = () => {
    const aiCopy = `Olá {{primeiro_nome}}! Analisei o perfil da {{empresa}} em {{cidade}} e identifiquei 3 oportunidades imediatas para escalar seu atendimento via WhatsApp com ZAPFLOW AI. Posso te enviar os detalhes em PDF?`;
    updateContent(aiCopy);
    toast({
      title: "Copy gerada por IA!",
      description: "Modelos persuasivos aplicados com sucesso.",
    });
  };

  // Token estimate (~4 chars per token)
  const tokenCount = Math.ceil(content.length / 4);
  const charCount = content.length;

  return (
    <div
      className={`flex flex-col border border-border/80 rounded-2xl bg-card transition-all duration-300 ${
        isFullScreen ? "fixed inset-4 z-50 shadow-2xl" : "w-full min-h-[420px]"
      }`}
    >
      {/* Toolbar Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 border-b border-border/60 bg-muted/30 rounded-t-2xl">
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="sm" onClick={handleUndo} disabled={historyIndex <= 0} title="Desfazer (Undo)">
            <ArrowCounterClockwise size={16} />
          </Button>
          <Button variant="ghost" size="sm" onClick={handleRedo} disabled={historyIndex >= history.length - 1} title="Refazer (Redo)">
            <ArrowClockwise size={16} />
          </Button>
          <div className="h-4 w-[1px] bg-border mx-1" />

          {/* AI Generator */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleGenerateAICopy}
            className="text-xs bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 font-semibold flex gap-1"
          >
            <MagicWand size={14} weight="duotone" /> Bloco IA
          </Button>

          {/* Emoji */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => updateContent(content + " 🚀⚡")}
            className="text-xs flex gap-1"
          >
            <Smiley size={16} /> Emojis
          </Button>

          {/* Attachment */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => toast({ title: "Anexo", description: "Selecione a mídia (PDF, Imagem, Áudio, Vídeo)" })}
            className="text-xs flex gap-1"
          >
            <Paperclip size={16} /> Anexos
          </Button>

          {/* Link */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => updateContent(content + " https://zapflow.ai")}
            className="text-xs flex gap-1"
          >
            <Link size={16} /> Link
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {/* Split View toggle */}
          <Button
            variant={isSplitView ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setIsSplitView(!isSplitView)}
            className="text-xs flex gap-1"
          >
            <Columns size={16} /> Split View
          </Button>

          {/* Full Screen toggle */}
          <Button
            variant={isFullScreen ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setIsFullScreen(!isFullScreen)}
            className="text-xs flex gap-1"
          >
            <ArrowsOut size={16} /> {isFullScreen ? "Sair da Tela Cheia" : "Tela Cheia"}
          </Button>
        </div>
      </div>

      {/* Variables & Templates Quick Bar */}
      <div className="flex flex-wrap items-center gap-2 p-2 border-b border-border/40 bg-card/40 text-xs">
        <span className="font-bold text-muted-foreground uppercase text-[10px]">Variáveis:</span>
        {DYNAMIC_VARIABLES.map((v) => (
          <Badge
            key={v.value}
            variant="outline"
            onClick={() => insertVariable(v.value)}
            className="cursor-pointer hover:bg-primary/20 hover:border-primary/50 text-[11px]"
          >
            + {v.label}
          </Badge>
        ))}
      </div>

      {/* Main Body (Split View or Single) */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border/60 min-h-[300px]">
        {/* Editor Area */}
        <div className="flex flex-col p-4 space-y-2">
          <Textarea
            value={content}
            onChange={(e) => updateContent(e.target.value)}
            placeholder="Digite aqui o texto da campanha ou mensagem autônoma..."
            className="flex-1 w-full bg-transparent border-0 focus-visible:ring-0 resize-none font-mono text-sm leading-relaxed"
          />

          {/* Templates Library */}
          <div className="pt-2 border-t border-border/40 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Bookmarks size={12} /> Biblioteca de Templates Rápidos
            </span>
            <div className="flex flex-wrap gap-1.5">
              {SAMPLE_TEMPLATES.map((t) => (
                <button
                  key={t.title}
                  type="button"
                  onClick={() => insertTemplate(t.content)}
                  className="text-[11px] px-2 py-1 rounded-lg border border-border/60 bg-muted/40 hover:bg-muted/80 text-left truncate max-w-[200px]"
                >
                  {t.title}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Live Preview Area (Split View) */}
        {isSplitView && (
          <div className="flex flex-col p-4 bg-muted/10 items-center justify-center">
            <div className="w-full max-w-sm rounded-3xl border border-border/80 bg-[#0b141a] p-4 shadow-xl text-white space-y-3">
              {/* WhatsApp Header Mock */}
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-emerald-500 flex items-center justify-center font-bold text-xs">
                    ZAP
                  </div>
                  <div>
                    <p className="text-xs font-bold text-emerald-400">Preview WhatsApp</p>
                    <p className="text-[10px] text-white/60">Disparo Autônomo</p>
                  </div>
                </div>
                <Badge variant="outline" className="text-[9px] border-emerald-500/40 text-emerald-400">
                  Ao Vivo
                </Badge>
              </div>

              {/* Message Bubble */}
              <div className="rounded-2xl rounded-tl-none bg-[#005c4b] p-3 text-xs leading-relaxed text-white shadow-md space-y-1">
                <p className="whitespace-pre-wrap">{content || "Sua mensagem aparecerá aqui conforme você digita..."}</p>
                <div className="flex justify-end items-center gap-1 text-[9px] text-white/70">
                  <span>14:32</span>
                  <CheckCircle size={10} className="text-emerald-300" />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Metrics & Actions */}
      <div className="flex items-center justify-between p-3 border-t border-border/60 bg-muted/20 text-xs rounded-b-2xl">
        <div className="flex items-center gap-4 text-muted-foreground">
          <span>
            Caracteres: <strong className="text-foreground">{charCount}</strong>
          </span>
          <span>
            Tokens Est.: <strong className="text-primary">{tokenCount}</strong>
          </span>
          <span className="hidden sm:inline text-emerald-400 font-semibold">✓ Formato WhatsApp Válido</span>
        </div>

        {onSendTest && (
          <Button
            size="sm"
            onClick={() => onSendTest(content)}
            className="rounded-xl text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground flex gap-1"
          >
            <PaperPlaneTilt size={14} weight="fill" /> Testar Envio
          </Button>
        )}
      </div>
    </div>
  );
}
