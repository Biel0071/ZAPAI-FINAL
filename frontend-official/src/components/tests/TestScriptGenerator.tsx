import React, { useState } from "react";
import { Code, Copy, Download, Play, Check, Sparkle, FileCode } from "@phosphor-icons/react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export interface GeneratedScript {
  suiteId: string;
  suiteName: string;
  filename: string;
  code: string;
}

interface TestScriptGeneratorProps {
  onGenerate: (suiteId?: string) => Promise<GeneratedScript[]>;
  onRunScript?: (suiteId: string) => void;
}

export const TestScriptGenerator: React.FC<TestScriptGeneratorProps> = ({ onGenerate, onRunScript }) => {
  const [selectedSuite, setSelectedSuite] = useState<string>("all");
  const [scripts, setScripts] = useState<GeneratedScript[]>([]);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const suiteIdToPass = selectedSuite === "all" ? undefined : selectedSuite;
      const res = await onGenerate(suiteIdToPass);
      setScripts(res);
      toast.success(`${res.length} script(s) de teste gerado(s) com sucesso!`);
    } catch (err: any) {
      toast.error(`Erro ao gerar scripts: ${err.message || String(err)}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = (code: string, index: number) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(index);
    toast.success("Script de teste copiado para a área de transferência!");
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleDownload = (script: GeneratedScript) => {
    const element = document.createElement("a");
    const file = new Blob([script.code], { type: "text/javascript" });
    element.href = URL.createObjectURL(file);
    element.download = script.filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    toast.success(`Download de ${script.filename} concluído!`);
  };

  return (
    <Card className="bg-[#0b0f19] border-slate-800/80 shadow-2xl backdrop-blur-xl">
      <CardHeader className="border-b border-slate-800/60 bg-slate-900/40 pb-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
              <Sparkle className="w-5 h-5 text-amber-400 animate-pulse" />
              Gerador Automático de Scripts de Teste Real
            </CardTitle>
            <CardDescription className="text-slate-400 text-xs mt-1">
              Gere scripts de teste reais em JavaScript/Vitest para qualquer módulo do sistema instantaneamente.
            </CardDescription>
          </div>

          <div className="flex items-center gap-3">
            <Select value={selectedSuite} onValueChange={setSelectedSuite}>
              <SelectTrigger className="w-48 bg-slate-900 border-slate-700 text-white text-xs">
                <SelectValue placeholder="Selecione o Módulo" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800 text-white text-xs">
                <SelectItem value="all">Todos os Módulos</SelectItem>
                <SelectItem value="auth">Autenticação & RBAC</SelectItem>
                <SelectItem value="contacts">Contatos & Leads</SelectItem>
                <SelectItem value="inbox">Inbox & Mensagens</SelectItem>
                <SelectItem value="whatsapp">Conexão WhatsApp</SelectItem>
                <SelectItem value="ai">IA & Memória</SelectItem>
                <SelectItem value="automation">Engine de Fluxos</SelectItem>
                <SelectItem value="campaigns">Campanhas</SelectItem>
                <SelectItem value="system">Saúde do Sistema</SelectItem>
              </SelectContent>
            </Select>

            <Button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-900/20"
            >
              {isGenerating ? (
                <>Gerando Scripts...</>
              ) : (
                <>
                  <FileCode className="w-4 h-4 mr-1.5" /> Gerar Script Real
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6">
        {scripts.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-slate-800 rounded-xl">
            <Code className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-300 font-medium">Nenhum script gerado ainda.</p>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">
              Selecione um módulo acima e clique em &quot;Gerar Script Real&quot; para criar arquivos de teste executáveis em JavaScript.
            </p>
            <Button onClick={handleGenerate} variant="outline" className="border-slate-700 text-slate-200 text-xs">
              Gerar Todos os Scripts Agora
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {scripts.map((script, idx) => (
              <div key={script.filename || idx} className="rounded-xl border border-slate-800 bg-slate-950 overflow-hidden shadow-lg">
                <div className="flex items-center justify-between bg-slate-900 px-4 py-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-emerald-400" />
                    <span className="font-mono text-xs font-bold text-white">{script.filename}</span>
                    <Badge variant="outline" className="text-[10px] bg-slate-800 text-slate-400 border-slate-700">
                      {script.suiteName}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => handleCopy(script.code, idx)}
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs text-slate-300 hover:text-white hover:bg-slate-800"
                    >
                      {copiedIndex === idx ? (
                        <>
                          <Check className="w-3.5 h-3.5 mr-1 text-emerald-400" /> Copiado!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 mr-1" /> Copiar Código
                        </>
                      )}
                    </Button>

                    <Button
                      onClick={() => handleDownload(script)}
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs text-slate-300 hover:text-white hover:bg-slate-800"
                    >
                      <Download className="w-3.5 h-3.5 mr-1" /> Download
                    </Button>

                    {onRunScript && (
                      <Button
                        onClick={() => onRunScript(script.suiteId)}
                        size="sm"
                        className="h-8 text-xs bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30"
                      >
                        <Play className="w-3.5 h-3.5 mr-1" /> Executar
                      </Button>
                    )}
                  </div>
                </div>

                <div className="p-4 overflow-x-auto">
                  <pre className="font-mono text-xs text-emerald-300/90 leading-relaxed whitespace-pre">
                    {script.code}
                  </pre>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
