import React, { useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { UploadSimple, FileText, CheckCircle, WarningCircle, X } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiService } from "@/services/apiService";

interface CampaignContextInputProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function CampaignContextInput({ value, onChange, className }: CampaignContextInputProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const processFile = async (file: File) => {
    setIsUploading(true);
    setError(null);
    setFileName(file.name);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await apiService.parseContext(formData);
      if (res.success && res.text) {
        // Appends or sets text
        const newText = value ? `${value}\n\n[Conteúdo de ${file.name}]:\n${res.text}` : res.text;
        onChange(newText);
      } else {
        setError("Erro ao extrair contexto.");
      }
    } catch (err: any) {
      setError(err.message || "Erro no upload.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await processFile(e.target.files[0]);
    }
  };

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div 
        className={cn(
          "relative flex flex-col gap-2 rounded-xl border-2 border-dashed p-6 transition-all",
          isDragging ? "border-primary bg-primary/10" : "border-border/60 bg-card/40 hover:border-border/80"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="flex flex-col items-center justify-center text-center gap-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <UploadSimple className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">
              Arraste arquivos ou <button onClick={() => fileInputRef.current?.click()} className="text-primary hover:underline">clique para buscar</button>
            </p>
            <p className="text-[11px] text-muted-foreground">Suporta TXT, PDF, DOCX. A IA extrairá o contexto automaticamente.</p>
          </div>
        </div>
        
        {isUploading && (
          <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-card/80 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-sm font-medium text-primary">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></span>
              Extraindo texto...
            </div>
          </div>
        )}
      </div>

      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept=".txt,.pdf,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" 
        className="hidden" 
      />

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
          <WarningCircle className="h-4 w-4" />
          {error}
        </div>
      )}
      
      {fileName && !error && !isUploading && (
        <div className="flex items-center justify-between rounded-lg border border-border/50 bg-background/50 px-3 py-2">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <CheckCircle className="h-4 w-4 text-emerald-500" />
            <span className="truncate max-w-[200px]">{fileName} lido com sucesso</span>
          </div>
          <button onClick={() => setFileName(null)} className="text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <Textarea
        placeholder="Ou cole seu briefing / contexto / scripts aqui..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-[160px] resize-y rounded-xl border-border/50 bg-background/50 text-sm focus:border-primary/50"
      />
    </div>
  );
}
