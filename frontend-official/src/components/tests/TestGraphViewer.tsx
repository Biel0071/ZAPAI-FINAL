import React, { useState } from "react";
import { CheckCircle, XCircle, Clock, Lightning, Cpu, TreeStructure, Info } from "@phosphor-icons/react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export interface TestNode {
  id: string;
  label: string;
  type: "root" | "suite" | "assertion";
  status: "passed" | "failed" | "running" | "pending";
  latencyMs: number;
  details?: string;
  error?: string | null;
  testsCount?: number;
  passedCount?: number;
  failedCount?: number;
}

export interface TestEdge {
  source: string;
  target: string;
  type?: string;
}

export interface TestGraphData {
  nodes: TestNode[];
  edges: TestEdge[];
}

interface TestGraphViewerProps {
  graph: TestGraphData | null;
  isLoading?: boolean;
}

export const TestGraphViewer: React.FC<TestGraphViewerProps> = ({ graph, isLoading }) => {
  const [selectedNode, setSelectedNode] = useState<TestNode | null>(null);

  if (isLoading) {
    return (
      <Card className="bg-[#0f172a]/80 border-slate-800 text-white shadow-2xl p-8 text-center">
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
          <p className="text-sm font-medium text-slate-400">Construindo Grafo de Execução em Tempo Real...</p>
        </div>
      </Card>
    );
  }

  if (!graph || !graph.nodes || graph.nodes.length === 0) {
    return (
      <Card className="bg-[#0f172a]/80 border-slate-800 text-white p-8 text-center">
        <TreeStructure className="w-12 h-12 text-slate-600 mx-auto mb-3" />
        <p className="text-slate-400 font-medium">Nenhum grafo de execução disponível.</p>
        <p className="text-xs text-slate-500 mt-1">Execute uma rodada de testes para gerar a árvore de nós visual.</p>
      </Card>
    );
  }

  const rootNode = graph.nodes.find((n) => n.type === "root") || graph.nodes[0];
  const suiteNodes = graph.nodes.filter((n) => n.type === "suite");
  const assertionNodes = graph.nodes.filter((n) => n.type === "assertion");

  const getStatusBadge = (status: TestNode["status"]) => {
    switch (status) {
      case "passed":
        return (
          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 flex items-center gap-1">
            <CheckCircle className="w-3.5 h-3.5" /> Passou
          </Badge>
        );
      case "failed":
        return (
          <Badge className="bg-rose-500/20 text-rose-400 border-rose-500/30 flex items-center gap-1">
            <XCircle className="w-3.5 h-3.5" /> Falhou
          </Badge>
        );
      case "running":
        return (
          <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 flex items-center gap-1 animate-pulse">
            <Clock className="w-3.5 h-3.5 animate-spin" /> Executando
          </Badge>
        );
      default:
        return (
          <Badge className="bg-slate-800 text-slate-400 border-slate-700 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" /> Pendente
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6">
      <Card className="bg-[#0b0f19] border-slate-800/80 shadow-2xl overflow-hidden backdrop-blur-xl">
        <CardHeader className="border-b border-slate-800/60 bg-slate-900/40 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                <TreeStructure className="w-5 h-5 text-emerald-400" />
                Grafo de Execução Visual (Node Flow)
              </CardTitle>
              <CardDescription className="text-slate-400 text-xs mt-1">
                Estrutura de dependências e estado de cada módulo e asserção sintética sem navegador.
              </CardDescription>
            </div>
            <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs">
              ⚡ Execução Ultra-Rápida em Memória
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {/* NÓ RAIZ */}
          <div className="flex justify-center mb-8">
            <div
              onClick={() => setSelectedNode(rootNode)}
              className="cursor-pointer group relative bg-gradient-to-r from-emerald-950/60 via-slate-900 to-teal-950/60 border-2 border-emerald-500/40 hover:border-emerald-400 rounded-2xl p-4 shadow-[0_0_30px_rgba(16,185,129,0.15)] hover:shadow-[0_0_40px_rgba(16,185,129,0.3)] transition-all duration-300 w-72 text-center"
            >
              <div className="flex items-center justify-center gap-2 mb-1">
                <Cpu className="w-5 h-5 text-emerald-400 animate-pulse" />
                <span className="font-bold text-white text-base">{rootNode.label}</span>
              </div>
              <p className="text-xs text-slate-400 mb-2">{rootNode.details}</p>
              <div className="flex justify-center">{getStatusBadge(rootNode.status)}</div>
            </div>
          </div>

          {/* LINHA CONECTORA PRINCIPAL */}
          <div className="w-0.5 h-6 bg-gradient-to-b from-emerald-500/50 to-slate-700 mx-auto mb-8" />

          {/* NÓS DAS SUÍTES DE MÓDULO */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {suiteNodes.map((suite) => {
              const childAssertions = assertionNodes.filter(
                (a) => a.id.startsWith(`test_${suite.id.replace("suite_", "")}`) || a.parentSuite === suite.id.replace("suite_", "")
              );

              return (
                <div
                  key={suite.id}
                  onClick={() => setSelectedNode(suite)}
                  className={`cursor-pointer group relative rounded-xl border p-4 transition-all duration-300 hover:scale-[1.02] ${
                    suite.status === "passed"
                      ? "bg-slate-900/80 border-emerald-500/30 hover:border-emerald-400/60 shadow-[0_0_15px_rgba(16,185,129,0.1)]"
                      : suite.status === "failed"
                      ? "bg-slate-900/80 border-rose-500/40 hover:border-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.15)]"
                      : "bg-slate-900/60 border-slate-800"
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <span className="font-semibold text-sm text-slate-100 group-hover:text-emerald-300 transition-colors">
                      {suite.label}
                    </span>
                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      ⚡ {suite.latencyMs}ms
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 line-clamp-2 mb-3">{suite.details}</p>

                  <div className="flex items-center justify-between border-t border-slate-800/80 pt-2 text-[11px]">
                    <span className="text-slate-400">{childAssertions.length} Asserções</span>
                    {getStatusBadge(suite.status)}
                  </div>
                </div>
              );
            })}
          </div>

          {/* VISUALIZAÇÃO DE ASSERÇÕES INDIVIDUAIS DO GRAFO */}
          <div className="border-t border-slate-800/80 pt-6">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Lightning className="w-4 h-4 text-amber-400" />
              Asserções e Nós de Teste Sintéticos ({assertionNodes.length})
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {assertionNodes.map((test) => (
                <div
                  key={test.id}
                  onClick={() => setSelectedNode(test)}
                  className="cursor-pointer bg-slate-900/40 hover:bg-slate-800/60 border border-slate-800 hover:border-slate-700 rounded-lg p-2.5 transition-all flex items-center justify-between text-xs"
                >
                  <div className="truncate mr-2">
                    <p className="font-medium text-slate-200 truncate">{test.label}</p>
                    <p className="text-[10px] text-slate-400 font-mono">⚡ {test.latencyMs}ms</p>
                  </div>
                  <div>{getStatusBadge(test.status)}</div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* MODAL DE INSPEÇÃO DO NÓ */}
      <Dialog open={Boolean(selectedNode)} onOpenChange={(open) => !open && setSelectedNode(null)}>
        <DialogContent className="bg-[#0f172a] border-slate-800 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between text-base">
              <span>{selectedNode?.label}</span>
              {selectedNode && getStatusBadge(selectedNode.status)}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Detalhes técnicos e tempo de resposta da execução do nó.
            </DialogDescription>
          </DialogHeader>

          {selectedNode && (
            <div className="space-y-4 text-xs">
              <div className="bg-slate-900/90 rounded-lg p-3 border border-slate-800 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400">ID do Nó:</span>
                  <span className="font-mono text-slate-200">{selectedNode.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Tipo de Nó:</span>
                  <span className="capitalize font-medium text-emerald-400">{selectedNode.type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Tempo de Resposta:</span>
                  <span className="font-mono text-amber-300">⚡ {selectedNode.latencyMs}ms</span>
                </div>
              </div>

              <div>
                <p className="font-semibold text-slate-300 mb-1">Resultado / Detalhes:</p>
                <div className="bg-slate-950 p-3 rounded border border-slate-800 text-slate-300 font-mono text-[11px] whitespace-pre-wrap">
                  {selectedNode.error ? (
                    <span className="text-rose-400">{selectedNode.error}</span>
                  ) : (
                    selectedNode.details || "Asserção sintética finalizada sem erros."
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
