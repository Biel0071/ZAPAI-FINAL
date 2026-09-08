import React, { useState, useRef, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  Sparkle,
  Paperclip,
  UploadSimple,
  FileText,
  CheckCircle,
  WarningCircle,
  X,
  ArrowClockwise,
  Check,
  Tag,
  Money,
  Users,
  Target,
  Truck,
  FilePdf,
  FileDoc,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiService } from "@/services/apiService";

export interface ContextAnalysisSummary {
  hasContent: boolean;
  documentRead: boolean;
  product?: string | null;
  offer?: string | null;
  audience?: string | null;
  conditions?: string | null;
  objective?: string | null;
}

interface UploadedFileItem {
  id: string;
  name: string;
  size: number;
  status: "uploading" | "done" | "error";
  error?: string;
}

interface CampaignContextInputProps {
  value: string;
  onChange: (value: string) => void;
  onAnalysisChange?: (analysis: ContextAnalysisSummary) => void;
  className?: string;
  disabled?: boolean;
}

function extractSemanticInsights(text: string, hasFiles: boolean): ContextAnalysisSummary {
  const clean = text.trim();
  const lower = clean.toLowerCase();

  const hasContent = clean.length > 10 || hasFiles;
  if (!hasContent) {
    return {
      hasContent: false,
      documentRead: false,
      product: null,
      offer: null,
      audience: null,
      conditions: null,
      objective: null,
    };
  }

  // 1. Produto identificado
  const productMatch =
    clean.match(/(?:caixa\s+d['’]?\s*água|fortlev|tanque|reservat[oó]rio|produto|servi[cç]o)[\w\s.-]{0,30}/i) ||
    clean.match(/(?:vender|promo[cç][aã]o|oferta)\s+(?:de\s+)?([A-Za-z0-9À-ÿ\s]{3,30})/i);
  const product = productMatch ? productMatch[0].trim() : clean.length > 20 ? "Produto em destaque" : null;

  // 2. Oferta identificada
  const priceMatch = clean.match(/R\$\s*[\d.,]+(?:\s*(?:em\s+)?\d+x(?:\s+sem\s+juros)?)?/i) ||
    clean.match(/\d+x(?:\s+sem\s+juros)?/i) ||
    clean.match(/desconto(?:\s+de\s+\d+%)?/i);
  const offer = priceMatch ? priceMatch[0].trim() : lower.includes("promoção") || lower.includes("desconto") ? "Condição promocional ativa" : null;

  // 3. Público identificado
  const audienceMatch = clean.match(/(?:leads?|clientes?|p[uú]blico|contatos?)\s+([A-Za-z0-9À-ÿ\s]{3,25})/i);
  const audience = audienceMatch
    ? `Público: ${audienceMatch[1].trim()}`
    : lower.includes("morno")
    ? "Leads mornos (em consideração)"
    : lower.includes("quente")
    ? "Leads quentes (alta intenção)"
    : lower.includes("obra") || lower.includes("construção")
    ? "Clientes em fase de obra"
    : "Base qualificada de leads";

  // 4. Condições identificadas
  const conditionMatch = clean.match(/(?:entrega|frete|prazo|estoque|garantia)[\w\s.-]{0,35}/i);
  const conditions = conditionMatch
    ? conditionMatch[0].trim()
    : lower.includes("frete grátis") || lower.includes("entrega")
    ? "Entrega expressa / frete incluso"
    : lower.includes("estoque")
    ? "Disponibilidade para pronta entrega"
    : null;

  // 5. Objetivo identificado
  const objective = lower.includes("estoque")
    ? "Venda e liquidação de estoque"
    : lower.includes("orçamento") || lower.includes("proposta")
    ? "Geração de orçamentos qualificados"
    : lower.includes("reativar") || lower.includes("recuperar")
    ? "Reativação de oportunidades"
    : "Conversão direta e vendas";

  return {
    hasContent: true,
    documentRead: hasFiles || clean.length > 20,
    product,
    offer,
    audience,
    conditions,
    objective,
  };
}

export function CampaignContextInput({
  value,
  onChange,
  onAnalysisChange,
  className,
  disabled = false,
}: CampaignContextInputProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<UploadedFileItem[]>([]);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const analysis = useMemo(() => {
    const res = extractSemanticInsights(value, files.some((f) => f.status === "done"));
    return res;
  }, [value, files]);

  React.useEffect(() => {
    if (onAnalysisChange) {
      onAnalysisChange(analysis);
    }
  }, [analysis, onAnalysisChange]);

  const handleUploadFile = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      setUploadError(`O arquivo "${file.name}" excede o limite de 10 MB.`);
      return;
    }

    const fileId = `${Date.now()}-${Math.random().toString(36).substr(2, 7)}`;
    const newFile: UploadedFileItem = {
      id: fileId,
      name: file.name,
      size: file.size,
      status: "uploading",
    };

    setFiles((prev) => [...prev, newFile]);
    setIsProcessingFile(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await apiService.parseContext(formData);

      if (res.success && res.text) {
        const extractedText = res.text.trim();
        const headerNote = `[Contexto extraído de ${file.name}]:\n${extractedText}`;
        const updated = value.trim() ? `${value.trim()}\n\n${headerNote}` : headerNote;
        onChange(updated);

        setFiles((prev) =>
          prev.map((f) => (f.id === fileId ? { ...f, status: "done" } : f))
        );
      } else {
        throw new Error(res.error || "Não foi possível extrair o texto do arquivo.");
      }
    } catch (err: any) {
      setUploadError(err.message || "Erro no upload do arquivo.");
      setFiles((prev) =>
        prev.map((f) => (f.id === fileId ? { ...f, status: "error", error: err.message } : f))
      );
    } finally {
      setIsProcessingFile(false);
    }
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        await handleUploadFile(e.dataTransfer.files[i]);
      }
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      for (let i = 0; i < e.target.files.length; i++) {
        await handleUploadFile(e.target.files[i]);
      }
      e.target.value = "";
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* Box Unificado de Contexto da Campanha */}
      <div className="rounded-2xl border border-border/70 bg-card/75 backdrop-blur-md overflow-hidden shadow-sm transition-all">
        {/* Top: Text Area */}
        <div className="p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                <Sparkle className="h-3.5 w-3.5" weight="fill" />
              </span>
              <label className="font-display text-xs font-bold uppercase tracking-wider text-foreground">
                Contexto da campanha
              </label>
            </div>
            <span className="text-[11px] font-mono text-muted-foreground">
              {value.length.toLocaleString("pt-BR")} caracteres
            </span>
          </div>

          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            placeholder={`Cole aqui informações, briefing, oferta, produtos ou instruções para a IA.\n\nExemplo:\n"Quero vender 20 caixas d'água Fortlev de 5.000 litros por R$ 2.299 em até 10x sem juros. Entrega expressa para MG e frete cortesia nesta semana para liquidar estoque."`}
            rows={5}
            className="w-full resize-y rounded-xl border border-border/40 bg-background/50 p-3 text-xs leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus:border-primary/60 focus:outline-none focus:ring-1 focus:ring-primary/40"
          />

          {value.trim().length === 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[10px] text-muted-foreground">Sugestão rápida:</span>
              <button
                type="button"
                onClick={() =>
                  onChange(
                    "Quero vender 20 caixas d'água de 5.000 litros por R$ 2.299 em até 10x sem juros. Entrega imediata para MG com frete cortesia para fechar hoje. O objetivo é liquidar estoque com abordagem consultiva e direta."
                  )
                }
                className="text-[10.5px] rounded-md border border-border/60 bg-muted/20 px-2 py-0.5 text-primary hover:bg-primary/10 transition-colors"
              >
                + Usar Exemplo: Caixa d'água 5.000L
              </button>
            </div>
          )}
        </div>

        {/* Divider contíguo */}
        <div className="border-t border-border/50" />

        {/* Bottom: Document Ingestion */}
        <div
          className={cn(
            "p-4 transition-all",
            isDragging ? "bg-primary/10" : "bg-muted/5 hover:bg-muted/10"
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-background/60 text-muted-foreground">
                <Paperclip className="h-4 w-4" />
              </span>
              <div>
                <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  Adicionar documentos
                  <span className="text-[10px] font-normal text-muted-foreground">
                    (PDF, DOC, DOCX, TXT até 10 MB)
                  </span>
                </p>
                <p className="text-[11px] text-muted-foreground">
                  A IA extrai o texto real e normaliza em regras para a campanha.
                </p>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || isProcessingFile}
              onClick={() => fileInputRef.current?.click()}
              className="rounded-xl border-border/80 bg-background/80 hover:bg-card hover:border-primary/50 text-xs font-semibold h-8 shrink-0 gap-1.5"
            >
              {isProcessingFile ? (
                <>
                  <ArrowClockwise className="h-3.5 w-3.5 animate-spin text-primary" />
                  Processando...
                </>
              ) : (
                <>
                  <UploadSimple className="h-3.5 w-3.5" />
                  Selecionar arquivos
                </>
              )}
            </Button>
          </div>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            multiple
            accept=".pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
            className="hidden"
          />

          {uploadError && (
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-400">
              <WarningCircle className="h-4 w-4 shrink-0" />
              <span>{uploadError}</span>
            </div>
          )}

          {/* Uploaded files chips */}
          {files.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {files.map((file) => (
                <div
                  key={file.id}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-2.5 py-1 text-xs transition-all",
                    file.status === "done"
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                      : file.status === "uploading"
                      ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                      : "border-rose-500/30 bg-rose-500/10 text-rose-300"
                  )}
                >
                  {file.name.endsWith(".pdf") ? (
                    <FilePdf className="h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <FileDoc className="h-3.5 w-3.5 shrink-0" />
                  )}
                  <span className="font-medium truncate max-w-[160px]">{file.name}</span>
                  <span className="text-[10px] text-muted-foreground">
                    ({formatFileSize(file.size)})
                  </span>
                  {file.status === "done" && (
                    <span className="text-[10px] text-emerald-400 font-semibold">✓ Lido</span>
                  )}
                  {file.status === "uploading" && (
                    <ArrowClockwise className="h-3 w-3 animate-spin" />
                  )}
                  <button
                    type="button"
                    onClick={() => removeFile(file.id)}
                    className="ml-1 text-muted-foreground hover:text-foreground"
                    title="Remover arquivo"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Checklist de Processamento & Ingestão Inteligente */}
      {analysis.hasContent && (
        <div className="rounded-xl border border-border/60 bg-background/40 p-3.5 space-y-2.5 animate-fade-in">
          <div className="flex items-center justify-between">
            <span className="font-display text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <CheckCircle className="h-3.5 w-3.5 text-emerald-500" weight="fill" />
              IA Processando Contexto
            </span>
            <span className="text-[10px] text-emerald-400 font-semibold">
              Pronto para gerar
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {/* 1. Documento lido */}
            <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-card/40 px-2.5 py-1.5">
              <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0 stroke-[3]" />
              <div className="min-w-0">
                <span className="text-[10px] font-bold text-foreground block">
                  Documento / Briefing
                </span>
                <span className="text-[10.5px] text-muted-foreground truncate block">
                  {files.length > 0
                    ? `${files.length} arquivo(s) analisado(s)`
                    : "Texto inserido pelo usuário"}
                </span>
              </div>
            </div>

            {/* 2. Produto identificado */}
            <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-card/40 px-2.5 py-1.5">
              <Check
                className={cn(
                  "h-3.5 w-3.5 shrink-0 stroke-[3]",
                  analysis.product ? "text-emerald-500" : "text-muted-foreground/40"
                )}
              />
              <div className="min-w-0">
                <span className="text-[10px] font-bold text-foreground block">
                  Produto Identificado
                </span>
                <span className="text-[10.5px] text-emerald-400 font-medium truncate block">
                  {analysis.product || "Detectando..."}
                </span>
              </div>
            </div>

            {/* 3. Oferta identificada */}
            <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-card/40 px-2.5 py-1.5">
              <Check
                className={cn(
                  "h-3.5 w-3.5 shrink-0 stroke-[3]",
                  analysis.offer ? "text-emerald-500" : "text-muted-foreground/40"
                )}
              />
              <div className="min-w-0">
                <span className="text-[10px] font-bold text-foreground block">
                  Oferta Identificada
                </span>
                <span className="text-[10.5px] text-emerald-400 font-medium truncate block">
                  {analysis.offer || "Condições padrão"}
                </span>
              </div>
            </div>

            {/* 4. Público identificado */}
            <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-card/40 px-2.5 py-1.5">
              <Check
                className={cn(
                  "h-3.5 w-3.5 shrink-0 stroke-[3]",
                  analysis.audience ? "text-emerald-500" : "text-muted-foreground/40"
                )}
              />
              <div className="min-w-0">
                <span className="text-[10px] font-bold text-foreground block">
                  Público Identificado
                </span>
                <span className="text-[10.5px] text-emerald-400 font-medium truncate block">
                  {analysis.audience || "Base completa"}
                </span>
              </div>
            </div>

            {/* 5. Condições identificadas */}
            <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-card/40 px-2.5 py-1.5">
              <Check
                className={cn(
                  "h-3.5 w-3.5 shrink-0 stroke-[3]",
                  analysis.conditions ? "text-emerald-500" : "text-muted-foreground/40"
                )}
              />
              <div className="min-w-0">
                <span className="text-[10px] font-bold text-foreground block">
                  Condições / Entrega
                </span>
                <span className="text-[10.5px] text-emerald-400 font-medium truncate block">
                  {analysis.conditions || "Condições comerciais padrão"}
                </span>
              </div>
            </div>

            {/* 6. Objetivo identificado */}
            <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-card/40 px-2.5 py-1.5">
              <Check
                className={cn(
                  "h-3.5 w-3.5 shrink-0 stroke-[3]",
                  analysis.objective ? "text-emerald-500" : "text-muted-foreground/40"
                )}
              />
              <div className="min-w-0">
                <span className="text-[10px] font-bold text-foreground block">
                  Objetivo Identificado
                </span>
                <span className="text-[10.5px] text-emerald-400 font-medium truncate block">
                  {analysis.objective || "Venda direta"}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
