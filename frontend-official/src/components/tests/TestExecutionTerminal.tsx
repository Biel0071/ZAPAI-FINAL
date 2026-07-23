import React, { useState } from "react";
import { Terminal, CheckCircle, XCircle, Trash, Filter } from "@phosphor-icons/react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface LogEntry {
  id: string;
  suiteName: string;
  testName: string;
  status: "passed" | "failed" | "running";
  latencyMs: number;
  details?: string;
  error?: string | null;
  timestamp: string;
}

interface TestExecutionTerminalProps {
  logs: LogEntry[];
  onClearLogs?: () => void;
}

export const TestExecutionTerminal: React.FC<TestExecutionTerminalProps> = ({ logs, onClearLogs }) => {
  const [filterStatus, setFilterStatus] = useState<"all" | "passed" | "failed">("all");

  const filteredLogs = logs.filter((log) => {
    if (filterStatus === "passed") return log.status === "passed";
    if (filterStatus === "failed") return log.status === "failed";
    return true;
  });

  return (
    <Card className="bg-[#0b0f19] border-slate-800/80 shadow-2xl backdrop-blur-xl">
      <CardHeader className="border-b border-slate-800/60 bg-slate-900/40 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-emerald-400 font-bold" />
            <CardTitle className="text-base font-bold text-white">Terminal de Asserções & Logs de Execução</CardTitle>
            <Badge variant="outline" className="border-slate-700 bg-slate-800 text-slate-300 text-[10px]">
              {logs.length} Eventos
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-0.5">
              <Button
                onClick={() => setFilterStatus("all")}
                variant={filterStatus === "all" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 text-[11px] px-2"
              >
                Todos
              </Button>
              <Button
                onClick={() => setFilterStatus("passed")}
                variant={filterStatus === "passed" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 text-[11px] px-2 text-emerald-400"
              >
                Passou
              </Button>
              <Button
                onClick={() => setFilterStatus("failed")}
                variant={filterStatus === "failed" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 text-[11px] px-2 text-rose-400"
              >
                Falhou
              </Button>
            </div>

            {onClearLogs && (
              <Button
                onClick={onClearLogs}
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-slate-400 hover:text-white"
              >
                <Trash className="w-3.5 h-3.5 mr-1" /> Limpar
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4">
        <div className="bg-slate-950 rounded-xl p-4 border border-slate-800/80 font-mono text-xs max-h-96 overflow-y-auto space-y-2">
          {filteredLogs.length === 0 ? (
            <div className="text-slate-500 text-center py-8">
              Aguardando início de testes ou nenhuma entrada disponível com o filtro atual...
            </div>
          ) : (
            filteredLogs.map((log, i) => (
              <div
                key={log.id || i}
                className="flex items-start justify-between border-b border-slate-900/80 pb-2 last:border-0 hover:bg-slate-900/30 p-1.5 rounded transition-colors"
              >
                <div className="flex items-start gap-2 max-w-[80%]">
                  {log.status === "passed" ? (
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 text-[10px]">[{log.timestamp}]</span>
                      <span className="text-slate-300 font-bold">{log.suiteName}</span>
                      <span className="text-slate-400">➔ {log.testName}</span>
                    </div>
                    <p className={`text-[11px] mt-0.5 ${log.status === "failed" ? "text-rose-400" : "text-slate-400"}`}>
                      {log.error || log.details || "Asserção concluída."}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    ⚡ {log.latencyMs}ms
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};
