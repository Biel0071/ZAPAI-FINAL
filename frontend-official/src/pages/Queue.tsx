import React, { useState, useEffect } from "react";
import { apiService, OutboundQueueItem } from "@/services/apiService";
import { ListFilter, RefreshCw, Send, AlertTriangle, CheckCircle2, Clock, Activity, MessageSquare } from "lucide-react";

export default function Queue() {
  const [activeTab, setActiveTab] = useState<"pending" | "dead_letter">("pending");
  const [pendingItems, setPendingItems] = useState<OutboundQueueItem[]>([]);
  const [deadItems, setDeadItems] = useState<OutboundQueueItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      if (activeTab === "pending") {
        const res = await apiService.getOutboundQueuePending(500);
        setPendingItems(res.items || []);
      } else {
        const res = await apiService.getOutboundQueueDeadLetters(500);
        setDeadItems(res.items || []);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load queue data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const handleReprocess = async (id: string) => {
    try {
      await apiService.reprocessDeadLetter(id);
      await loadData();
    } catch (err: any) {
      alert("Erro ao reprocessar: " + (err.message || "Erro desconhecido"));
    }
  };

  const getStatusBadge = (state: string) => {
    switch (state) {
      case "queued": return <span className="px-2 py-1 bg-yellow-500/20 text-yellow-500 rounded text-xs font-medium border border-yellow-500/30 flex items-center gap-1"><Clock size={12}/> Na Fila</span>;
      case "processing": return <span className="px-2 py-1 bg-blue-500/20 text-blue-500 rounded text-xs font-medium border border-blue-500/30 flex items-center gap-1"><Activity size={12}/> Processando</span>;
      case "dead_letter": return <span className="px-2 py-1 bg-red-500/20 text-red-500 rounded text-xs font-medium border border-red-500/30 flex items-center gap-1"><AlertTriangle size={12}/> Falha Permanente</span>;
      case "completed": return <span className="px-2 py-1 bg-emerald-500/20 text-emerald-500 rounded text-xs font-medium border border-emerald-500/30 flex items-center gap-1"><CheckCircle2 size={12}/> Enviado</span>;
      default: return <span className="px-2 py-1 bg-zinc-500/20 text-zinc-400 rounded text-xs font-medium">{state}</span>;
    }
  };

  const currentItems = activeTab === "pending" ? pendingItems : deadItems;

  return (
    <div className="flex flex-col h-full bg-[#09090b] text-zinc-100 p-6 overflow-hidden">
      
      {/* HEADER */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-zinc-100 to-zinc-400 bg-clip-text text-transparent mb-2">
            Fila de Envios (Outbound Queue)
          </h1>
          <p className="text-zinc-400">
            Monitore mensagens que estão sendo processadas, aguardando envio, ou que falharam.
          </p>
        </div>
        <button 
          onClick={loadData}
          disabled={loading}
          className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-4 py-2 rounded-lg flex items-center gap-2 transition-colors border border-zinc-700/50"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          Atualizar
        </button>
      </div>

      {/* TABS */}
      <div className="flex space-x-1 bg-zinc-900/50 p-1 rounded-xl mb-6 w-max border border-zinc-800">
        <button
          onClick={() => setActiveTab("pending")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2
            ${activeTab === "pending" ? "bg-zinc-800 text-white shadow-sm" : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"}`}
        >
          <Send size={16} /> Pendentes ({activeTab === "pending" ? pendingItems.length : "..."})
        </button>
        <button
          onClick={() => setActiveTab("dead_letter")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2
            ${activeTab === "dead_letter" ? "bg-red-500/20 text-red-500 shadow-sm" : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"}`}
        >
          <AlertTriangle size={16} /> Falhas Irrecuperáveis ({activeTab === "dead_letter" ? deadItems.length : "..."})
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-4 rounded-lg mb-6 flex items-start gap-3">
          <AlertTriangle size={20} className="mt-0.5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* TABLE */}
      <div className="flex-1 bg-[#121214] border border-zinc-800 rounded-xl overflow-hidden flex flex-col">
        <div className="overflow-auto flex-1 p-4">
          {loading ? (
            <div className="h-full flex items-center justify-center text-zinc-500 gap-2">
              <RefreshCw className="animate-spin" size={20} />
              <span>Carregando fila...</span>
            </div>
          ) : currentItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-zinc-500 gap-4">
              <ListFilter size={48} className="opacity-20" />
              <p>Nenhuma mensagem nesta fila.</p>
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="text-zinc-400 border-b border-zinc-800 sticky top-0 bg-[#121214]">
                <tr>
                  <th className="pb-3 font-medium">Destinatário</th>
                  <th className="pb-3 font-medium">Mensagem</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Tentativas</th>
                  {activeTab === "dead_letter" && <th className="pb-3 font-medium">Motivo do Erro</th>}
                  <th className="pb-3 font-medium text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {currentItems.map((item) => (
                  <tr key={item.id} className="hover:bg-zinc-800/20 transition-colors group">
                    <td className="py-4 text-zinc-300">
                      <div className="font-medium text-zinc-200">{item.payload?.phone || "Desconhecido"}</div>
                      <div className="text-xs text-zinc-500 font-mono mt-1" title={item.id}>ID: {item.id.substring(0,8)}...</div>
                    </td>
                    <td className="py-4">
                      <div className="flex items-center gap-2 text-zinc-300 max-w-[250px] truncate">
                        <MessageSquare size={14} className="text-zinc-500 shrink-0" />
                        <span className="truncate" title={item.payload?.text?.text || item.payload?.caption || "Mídia"}>
                          {item.payload?.text?.text || item.payload?.caption || "[Mídia / Documento]"}
                        </span>
                      </div>
                    </td>
                    <td className="py-4">
                      {getStatusBadge(item.state)}
                    </td>
                    <td className="py-4 text-zinc-400">
                      {item.attempts}
                    </td>
                    {activeTab === "dead_letter" && (
                      <td className="py-4">
                        <div className="text-xs text-red-400 bg-red-900/10 p-2 rounded border border-red-900/30 max-w-xs overflow-hidden text-ellipsis whitespace-nowrap" title={JSON.stringify(item.lastFailure)}>
                          {item.lastFailure?.message || item.lastFailure?.error || "Erro desconhecido"}
                        </div>
                      </td>
                    )}
                    <td className="py-4 text-right">
                      {activeTab === "dead_letter" ? (
                        <button 
                          onClick={() => handleReprocess(item.id)}
                          className="px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded text-xs font-medium border border-blue-500/20 transition-colors"
                        >
                          Tentar Novamente
                        </button>
                      ) : (
                        <span className="text-xs text-zinc-600">Automático</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
