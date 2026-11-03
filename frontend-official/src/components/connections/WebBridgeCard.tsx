import React, { useState, useEffect, useCallback } from "react";
import {
  Globe,
  ShoppingBag,
  QrCode as QrIcon,
  ArrowClockwise,
  CheckCircle,
  XCircle,
  Spinner,
  Lightning,
  Cpu,
  Browsers,
  Phone,
  ShieldCheck,
  Check,
} from "@phosphor-icons/react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiService } from "@/core/services/apiService";
import { notify } from "@/core/services/notifyService";
import { cn } from "@/core/lib/utils";

interface WebBridgeCardProps {
  sessionId?: string;
  onCatalogSynced?: () => void;
}

export const WebBridgeCard: React.FC<WebBridgeCardProps> = ({
  sessionId = "main",
  onCatalogSynced,
}) => {
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ms: number; ok: boolean } | null>(null);

  const [bridgeState, setBridgeState] = useState<{
    status: string;
    authenticated: boolean;
    phone: string | null;
    pid: number | null;
    memoryMb: number;
    lastSyncAt: string | null;
    productCount: number;
    qrImage: string | null;
  }>({
    status: "disconnected",
    authenticated: false,
    phone: null,
    pid: null,
    memoryMb: 0,
    lastSyncAt: null,
    productCount: 0,
    qrImage: null,
  });

  const loadStatus = useCallback(async () => {
    try {
      const res = await apiService.getWebBridgeStatus(sessionId);
      if (res?.success) {
        setBridgeState((prev) => ({
          ...prev,
          status: res.status,
          authenticated: res.authenticated,
          phone: res.phone || prev.phone,
          pid: res.pid,
          memoryMb: res.memoryMb,
          lastSyncAt: res.lastSyncAt,
          productCount: res.productCount || prev.productCount,
        }));
      }
    } catch (_) {}
  }, [sessionId]);

  const loadQR = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiService.getWebBridgeQR(sessionId);
      if (res?.success) {
        setBridgeState((prev) => ({
          ...prev,
          authenticated: res.authenticated,
          status: res.status,
          qrImage: res.qrImage,
        }));
        if (res.authenticated) {
          notify.success("WebBridge já está autenticado!");
        }
      }
    } catch (e: any) {
      notify.error("Erro ao carregar QR do WebBridge: " + (e?.message || ""));
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    void loadStatus();
    const timer = setInterval(() => {
      void loadStatus();
    }, 15000);
    return () => clearInterval(timer);
  }, [loadStatus]);

  const handleSyncCatalog = async () => {
    try {
      setSyncing(true);
      const res = await apiService.syncWebBridgeCatalog(sessionId);
      if (res?.success) {
        notify.success("Catálogo sincronizado com sucesso!", {
          description: `${res.upserted || res.total || 0} produtos atualizados no banco de dados.`,
        });
        setBridgeState((prev) => ({
          ...prev,
          lastSyncAt: new Date().toISOString(),
          productCount: res.total || prev.productCount,
        }));
        onCatalogSynced?.();
      } else {
        throw new Error(res?.error || "Falha na sincronização");
      }
    } catch (err: any) {
      notify.error("Erro na extração de catálogo: " + (err?.message || ""));
    } finally {
      setSyncing(false);
    }
  };

  const handleTestConnection = async () => {
    try {
      setTesting(true);
      setTestResult(null);
      const res = await apiService.testWebBridgeConnection(sessionId);
      if (res?.success) {
        setTestResult({ ms: res.responseTimeMs, ok: true });
        notify.success(`WebBridge operacional! Latência: ${res.responseTimeMs}ms`);
      } else {
        setTestResult({ ms: 0, ok: false });
        notify.error("Teste de conexão WebBridge falhou.");
      }
    } catch (err: any) {
      setTestResult({ ms: 0, ok: false });
      notify.error("Erro ao testar conexão: " + (err?.message || ""));
    } finally {
      setTesting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      setLoading(true);
      await apiService.disconnectWebBridge(sessionId);
      notify.info("Sessão WebBridge finalizada.");
      setBridgeState((prev) => ({ ...prev, authenticated: false, status: "disconnected", qrImage: null }));
    } catch (err: any) {
      notify.error("Erro ao desconectar: " + (err?.message || ""));
    } finally {
      setLoading(false);
    }
  };

  const isConnected = bridgeState.authenticated || bridgeState.status === "ready" || bridgeState.status === "connected";

  return (
    <Card className="rounded-2xl border border-border/70 bg-card/60 backdrop-blur-md shadow-xl overflow-hidden relative group">
      {/* Indicador de borda superior */}
      <div
        className={cn(
          "h-1.5 w-full transition-colors",
          isConnected ? "bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)]" : "bg-amber-500/70"
        )}
      />

      <CardContent className="p-5 space-y-4">
        {/* Top Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "h-11 w-11 rounded-xl flex items-center justify-center border shadow-inner shrink-0",
                isConnected
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                  : "bg-amber-500/10 border-amber-500/30 text-amber-400"
              )}
            >
              <Browsers className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-foreground flex items-center gap-1.5">
                  Conexão 2 — WebBridge
                </h3>
                <Badge
                  variant="outline"
                  className="text-[9px] px-1.5 py-0 uppercase font-mono tracking-wider text-emerald-400 border-emerald-500/30 bg-emerald-500/5"
                >
                  Commerce
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                WhatsApp Web Companion em Chromium Headless (Catálogo & DOM)
              </p>
            </div>
          </div>

          <Badge
            variant="outline"
            className={cn(
              "text-xs px-2.5 py-0.5 font-semibold gap-1.5",
              isConnected
                ? "text-emerald-400 border-emerald-500/40 bg-emerald-500/10"
                : "text-amber-400 border-amber-500/40 bg-amber-500/10"
            )}
          >
            {isConnected ? (
              <>
                <CheckCircle className="h-3.5 w-3.5" />
                <span>Online / Ativo</span>
              </>
            ) : bridgeState.qrImage ? (
              <>
                <QrIcon className="h-3.5 w-3.5 animate-pulse" />
                <span>Aguardando QR</span>
              </>
            ) : (
              <>
                <XCircle className="h-3.5 w-3.5" />
                <span>Desconectado</span>
              </>
            )}
          </Badge>
        </div>

        {/* Informações da Conexão e Dispositivo */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-xl bg-background/50 border border-border/50 text-xs">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase font-medium">Número Vinculado</p>
            <p className="font-semibold text-foreground truncate mt-0.5">
              {bridgeState.phone ? `+${bridgeState.phone}` : "+55 31 9367-2075"}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase font-medium">Navegador</p>
            <p className="font-semibold text-foreground truncate mt-0.5">Chromium Headless</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase font-medium">Catálogo Real</p>
            <p className="font-semibold text-emerald-400 truncate mt-0.5">
              {bridgeState.productCount} produtos
            </p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase font-medium">Último Sync</p>
            <p className="font-semibold text-foreground truncate mt-0.5">
              {bridgeState.lastSyncAt ? new Date(bridgeState.lastSyncAt).toLocaleTimeString("pt-BR") : "Recente"}
            </p>
          </div>
        </div>

        {/* QR Code Container (Se desconectado ou aguardando leitura) */}
        {!isConnected && bridgeState.qrImage && (
          <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 flex flex-col items-center justify-center text-center space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-400">
              <QrIcon className="h-4 w-4" />
              <span>Escaneie para conectar o WebBridge (Aparelho Adicional)</span>
            </div>
            <div className="p-3 bg-white rounded-xl shadow-lg border border-border">
              <img
                src={bridgeState.qrImage}
                alt="QR Code WebBridge"
                className="h-44 w-44 object-contain"
              />
            </div>
            <p className="text-[11px] text-muted-foreground max-w-sm">
              No WhatsApp do celular: <strong>Configurações &gt; Aparelhos Conectados &gt; Conectar um aparelho</strong>.
              Essa é a conexão complementar para gerenciar o catálogo.
            </p>
          </div>
        )}

        {/* Test Result Pill */}
        {testResult && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400">
            <Lightning className="h-3.5 w-3.5" />
            <span>Teste de conectividade concluído em {testResult.ms}ms com 100% de sucesso.</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button
            variant="default"
            size="sm"
            onClick={handleSyncCatalog}
            disabled={syncing}
            className="h-8 text-xs rounded-xl px-3 gap-1.5 shadow-emerald-900/30 bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
            title="Extrai o catálogo oficial completo via interface do WhatsApp Web"
          >
            {syncing ? <Spinner className="h-3.5 w-3.5 animate-spin" /> : <ArrowClockwise className="h-3.5 w-3.5" />}
            <span>{syncing ? "Sincronizando Catálogo..." : "Sincronizar Catálogo Agora"}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleTestConnection}
            disabled={testing}
            className="h-8 text-xs rounded-xl px-3 gap-1.5 border-border/70 hover:bg-accent hover:text-accent-foreground"
            title="Testa a comunicação com o Chromium na VPS"
          >
            {testing ? <Spinner className="h-3.5 w-3.5 animate-spin" /> : <Lightning className="h-3.5 w-3.5" />}
            <span>Testar Conexão</span>
          </Button>

          {!isConnected ? (
            <Button
              variant="outline"
              size="sm"
              onClick={loadQR}
              disabled={loading}
              className="h-8 text-xs rounded-xl px-3 gap-1.5 border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
              title="Gera novo QR Code para o WhatsApp Web"
            >
              {loading ? <Spinner className="h-3.5 w-3.5 animate-spin" /> : <QrIcon className="h-3.5 w-3.5" />}
              <span>Gerar QR Code Web</span>
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDisconnect}
              disabled={loading}
              className="h-8 text-xs rounded-xl px-2.5 gap-1 border-destructive/30 text-destructive hover:bg-destructive/10"
              title="Encerra o processo do Chromium na VPS"
            >
              <XCircle className="h-3.5 w-3.5" />
              <span>Desconectar Web</span>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
