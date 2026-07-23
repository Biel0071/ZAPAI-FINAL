import React, { useEffect, useState } from "react";
import {
  Play,
  TreeStructure,
  Sparkle,
  Terminal as TerminalIcon,
  CheckCircle,
  XCircle,
  Clock,
  Lightning,
  RefreshCw,
  Cpu,
  Layers,
  Flask,
} from "@phosphor-icons/react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import apiService from "@/services/apiService";
import { TestGraphViewer, TestGraphData } from "@/components/tests/TestGraphViewer";
import { TestScriptGenerator, GeneratedScript } from "@/components/tests/TestScriptGenerator";
import { TestExecutionTerminal, LogEntry } from "@/components/tests/TestExecutionTerminal";

export interface SuiteOverview {
  id: string;
  name: string;
  description: string;
  totalTests: number;
}

const Tests: React.FC = () => {
  const [suites, setSuites] = useState<SuiteOverview[]>([]);
  const [selectedSuiteIds, setSelectedSuiteIds] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isLoadingSuites, setIsLoadingSuites] = useState<boolean>(true);
  const [graphData, setGraphData] = useState<TestGraphData | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [metrics, setMetrics] = useState({
    totalTests: 0,
    passedTests: 0,
    failedTests: 0,
    successRate: 100,
    totalDurationMs: 0,
  });

  const loadInitialData = async () => {
    setIsLoadingSuites(true);
    try {
      const suitesRes = await apiService.fetchTestSuites();
      if (suitesRes.success && Array.isArray(suitesRes.data)) {
        setSuites(suitesRes.data);
        setSelectedSuiteIds(suitesRes.data.map((s) => s.id));
      }

      const graphRes = await apiService.fetchTestGraph();
      if (graphRes.success && graphRes.data) {
        setGraphData(graphRes.data);
      }
    } catch (err) {
      console.error("[TESTS_PAGE] Error loading initial suites:", err);
    } finally {
      setIsLoadingSuites(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  const handleRunTests = async (customIds?: string[]) => {
    const idsToRun = customIds || selectedSuiteIds;
    if (idsToRun.length === 0) {
      toast.warning("Selecione pelo menos um módulo para testar.");
      return;
    }

    setIsRunning(true);
    try {
      const res = await apiService.runTestSuites(idsToRun);
      if (res.success && res.data) {
        const run = res.data;
        setMetrics({
          totalTests: run.metrics.totalTests,
          passedTests: run.metrics.passedTests,
          failedTests: run.metrics.failedTests,
          successRate: run.metrics.successRate,
          totalDurationMs: run.totalDurationMs,
        });

        if (run.graph) {
          setGraphData(run.graph);
        }

        // Converte o resultado das suítes em entradas de log para o terminal
        const newLogs: LogEntry[] = [];
        const timestamp = new Date().toLocaleTimeString();

        run.suites.forEach((suite: any) => {
          suite.tests.forEach((test: any) => {
            newLogs.push({
              id: `${test.id}_${Date.now()}`,
              suiteName: suite.name,
              testName: test.name,
              status: test.status,
              latencyMs: test.latencyMs,
              details: test.details,
              error: test.error,
              timestamp,
            });
          });
        });

        setLogs((prev) => [...newLogs, ...prev]);

        if (run.metrics.failedTests === 0) {
          toast.success(
            `Todos os ${run.metrics.totalTests} testes sintéticos passaram em ${run.totalDurationMs}ms!`
          );
        } else {
          toast.error(
            `${run.metrics.failedTests} de ${run.metrics.totalTests} testes falharam. Verifique o grafo.`
          );
        }
      }
    } catch (err: any) {
      toast.error(`Erro ao executar testes: ${err.message || String(err)}`);
    } finally {
      setIsRunning(false);
    }
  };

  const handleGenerateScript = async (suiteId?: string): Promise<GeneratedScript[]> => {
    const res = await apiService.generateTestScripts(suiteId);
    return res.data || [];
  };

  const toggleSelectSuite = (suiteId: string) => {
    setSelectedSuiteIds((prev) =>
      prev.includes(suiteId) ? prev.filter((id) => id !== suiteId) : [...prev, suiteId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedSuiteIds.length === suites.length) {
      setSelectedSuiteIds([]);
    } else {
      setSelectedSuiteIds(suites.map((s) => s.id));
    }
  };

  return (
    <div className="min-h-screen bg-[#07090e] text-white p-6 space-y-6 animate-fade-in">
      {/* HEADER DE CABEÇALHO */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
              <Flask className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
                Central de Testes & Grafos de Automação
              </h1>
              <p className="text-xs text-slate-400 font-medium">
                Execução de testes funcionais browserless ultra-rápidos com gerador de scripts e visualização em nó.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={() => loadInitialData()}
            variant="outline"
            className="border-slate-700 bg-slate-900/60 hover:bg-slate-800 text-slate-200 text-xs"
          >
            <RefreshCw className="w-4 h-4 mr-1.5" /> Atualizar
          </Button>

          <Button
            onClick={() => handleRunTests()}
            disabled={isRunning}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-xl shadow-emerald-900/30 px-5"
          >
            {isRunning ? (
              <>
                <Clock className="w-4 h-4 mr-2 animate-spin" /> Executando Testes...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" /> Executar Todos (Browserless)
              </>
            )}
          </Button>
        </div>
      </div>

      {/* METRICAS SUPERIORES */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card className="bg-[#0b0f19] border-slate-800 p-4">
          <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">Total de Testes</p>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-white">{metrics.totalTests}</span>
            <Badge variant="outline" className="border-slate-700 text-slate-400 text-[10px]">
              {suites.length} Módulos
            </Badge>
          </div>
        </Card>

        <Card className="bg-[#0b0f19] border-slate-800 p-4">
          <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">Taxa de Sucesso</p>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-emerald-400">{metrics.successRate}%</span>
            <CheckCircle className="w-5 h-5 text-emerald-400" />
          </div>
        </Card>

        <Card className="bg-[#0b0f19] border-slate-800 p-4">
          <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">Falhas Detectadas</p>
          <div className="flex items-baseline justify-between mt-2">
            <span className={`text-2xl font-black ${metrics.failedTests > 0 ? "text-rose-400" : "text-slate-400"}`}>
              {metrics.failedTests}
            </span>
            <XCircle className={`w-5 h-5 ${metrics.failedTests > 0 ? "text-rose-400" : "text-slate-600"}`} />
          </div>
        </Card>

        <Card className="bg-[#0b0f19] border-slate-800 p-4">
          <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">Tempo Total de Execução</p>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-amber-300">⚡ {metrics.totalDurationMs}ms</span>
            <Lightning className="w-5 h-5 text-amber-400 animate-pulse" />
          </div>
        </Card>

        <Card className="bg-[#0b0f19] border-slate-800 p-4 col-span-2 sm:col-span-1">
          <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">Modo de Execução</p>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20">
              Browserless In-App
            </span>
            <Cpu className="w-5 h-5 text-emerald-400" />
          </div>
        </Card>
      </div>

      {/* ABAS DA CENTRAL DE TESTES */}
      <Tabs defaultValue="graph" className="w-full space-y-6">
        <TabsList className="bg-[#0b0f19] border border-slate-800 p-1 rounded-xl">
          <TabsTrigger value="graph" className="text-xs data-[state=active]:bg-emerald-600 data-[state=active]:text-white gap-2">
            <TreeStructure className="w-4 h-4" /> Grafo de Execução Visual
          </TabsTrigger>
          <TabsTrigger value="generator" className="text-xs data-[state=active]:bg-emerald-600 data-[state=active]:text-white gap-2">
            <Sparkle className="w-4 h-4" /> Gerador de Scripts Automáticos
          </TabsTrigger>
          <TabsTrigger value="terminal" className="text-xs data-[state=active]:bg-emerald-600 data-[state=active]:text-white gap-2">
            <TerminalIcon className="w-4 h-4" /> Terminal & Logs ({logs.length})
          </TabsTrigger>
          <TabsTrigger value="suites" className="text-xs data-[state=active]:bg-emerald-600 data-[state=active]:text-white gap-2">
            <Layers className="w-4 h-4" /> Seleção de Módulos ({selectedSuiteIds.length}/{suites.length})
          </TabsTrigger>
        </TabsList>

        {/* ABA: GRAFO VISUAL */}
        <TabsContent value="graph" className="m-0">
          <TestGraphViewer graph={graphData} isLoading={isRunning} />
        </TabsContent>

        {/* ABA: GERADOR DE SCRIPTS */}
        <TabsContent value="generator" className="m-0">
          <TestScriptGenerator
            onGenerate={handleGenerateScript}
            onRunScript={(suiteId) => handleRunTests([suiteId])}
          />
        </TabsContent>

        {/* ABA: TERMINAL E LOGS */}
        <TabsContent value="terminal" className="m-0">
          <TestExecutionTerminal logs={logs} onClearLogs={() => setLogs([])} />
        </TabsContent>

        {/* ABA: SELEÇÃO DE MÓDULOS */}
        <TabsContent value="suites" className="m-0">
          <Card className="bg-[#0b0f19] border-slate-800/80 p-6">
            <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-white text-base">Seletor de Suítes Módulares</h3>
                <p className="text-xs text-slate-400">Marque quais módulos deseja incluir na próxima rodada sintética.</p>
              </div>

              <Button onClick={toggleSelectAll} variant="outline" size="sm" className="border-slate-700 text-slate-300 text-xs">
                {selectedSuiteIds.length === suites.length ? "Desmarcar Todos" : "Marcar Todos"}
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {suites.map((suite) => {
                const isSelected = selectedSuiteIds.includes(suite.id);
                return (
                  <div
                    key={suite.id}
                    onClick={() => toggleSelectSuite(suite.id)}
                    className={`cursor-pointer rounded-xl border p-4 transition-all ${
                      isSelected
                        ? "bg-slate-900 border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.1)]"
                        : "bg-slate-950/60 border-slate-800 opacity-60 hover:opacity-100"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Checkbox checked={isSelected} onCheckedChange={() => toggleSelectSuite(suite.id)} />
                        <span className="font-bold text-xs text-white">{suite.name}</span>
                      </div>
                      <Badge variant="outline" className="text-[10px] border-slate-700 text-slate-400">
                        {suite.totalTests} testes
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-400 line-clamp-2">{suite.description}</p>
                  </div>
                );
              })}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Tests;
