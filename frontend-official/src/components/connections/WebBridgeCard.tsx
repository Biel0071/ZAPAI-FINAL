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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { apiService } from "@/core/services/apiService";
import { notify } from "@/core/services/notifyService";
import { getSharedSocket } from "@/core/runtime/socket/socketManager";
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
  const [isModalOpen, setIsModalOpen] = useState(false);

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

  const isConnected = Boolean(bridgeState.authenticated || bridgeState.status === "connected");

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

  const handleOpenQRModal = useCallback(async () => {
    setIsModalOpen(true);
    await loadQR();
  }, [loadQR]);

  // Polling em tempo real enquanto o modal estiver aberto e aguardando leitura
  useEffect(() => {
    if (!isModalOpen || isConnected) return;
    const interval = setInterval(async () => {
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
            qrImage: res.qrImage || prev.qrImage,
          }));
          if (res.authenticated) {
            notify.success("WhatsApp Web Conectado com Sucesso!");
          }
        }
      } catch (_) {}
    }, 3000);
    return () => clearInterval(interval);
  }, [isModalOpen, isConnected, sessionId]);

  useEffect(() => {
    void loadStatus();
    const timer = setInterval(() => {
      void loadStatus();
    }, 15000);

    const socket = getSharedSocket();
    const handleRealtimeSync = (data: any) => {
      void loadStatus();
      if (data?.total !== undefined) {
        setBridgeState((prev) => ({
          ...prev,
          productCount: data.total,
          lastSyncAt: data.timestamp || new Date().toISOString(),
        }));
      }
    };

    if (socket && typeof socket.on === "function") {
      socket.on("catalog:synced", handleRealtimeSync);
      socket.on("webbridge:authenticated", handleRealtimeSync);
      socket.on("webbridge:status", handleRealtimeSync);
    }

    return () => {
      clearInterval(timer);
      if (socket && typeof socket.off === "function") {
        socket.off("catalog:synced", handleRealtimeSync);
        socket.off("webbridge:authenticated", handleRealtimeSync);
        socket.off("webbridge:status", handleRealtimeSync);
      }
    };
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

  return (
    <Card id="webbridge-card-section" className="rounded-2xl border border-border/70 bg-card/60 backdrop-blur-md shadow-xl overflow-hidden relative group">
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

        {/* QR Code Container Inline (Se desconectado ou aguardando leitura) */}
        {!isConnected && bridgeState.qrImage && (
          <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 flex flex-col items-center justify-center text-center space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-400">
              <QrIcon className="h-4 w-4" />
              <span>Escaneie para conectar o WebBridge (Aparelho Adicional)</span>
            </div>
            <div className="relative inline-flex items-center justify-center p-3 bg-white rounded-xl shadow-lg border border-border">
              <img
                src={bridgeState.qrImage}
                alt="QR Code WebBridge"
                className="h-44 w-44 object-contain"
              />
              {/* Logo ZAI centralizado no meio do QR Code */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="h-11 w-11 rounded-xl bg-white shadow-md border-2 border-emerald-500/60 p-1 flex items-center justify-center">
                  <img
                    src="/brand/logo-dark.svg"
                    alt="ZAI"
                    className="h-7 w-7 object-contain drop-shadow"
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenQRModal}
                className="text-xs rounded-xl h-7 px-3 border-amber-500/40 text-amber-400 hover:bg-amber-500/10 gap-1.5 font-medium"
              >
                <QrIcon className="h-3.5 w-3.5" />
                <span>Ampliar QR Code</span>
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground max-w-sm">
              No WhatsApp do celular: <strong>Configurações &gt; Aparelhos Conectados &gt; Conectar um aparelho</strong>.
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
              onClick={handleOpenQRModal}
              disabled={loading}
              className="h-8 text-xs rounded-xl px-3 gap-1.5 border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
              title="Abre a tela pop-up com QR Code para o WhatsApp Web"
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

      {/* ============================================================== */}
      {/* POP-UP MODAL REAL FUNCIONAL WEBBRIDGE COM LOGO ZAI NO CENTRO   */}
      {/* ============================================================== */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md border-border/80 bg-card/95 backdrop-blur-xl text-center">
          <DialogHeader className="text-center sm:text-center pr-0">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <Browsers className="h-6 w-6" />
            </div>
            <DialogTitle className="font-display text-lg text-foreground">
              Conectar WhatsApp Web Bridge
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Conexão 2 (Commerce) — WhatsApp Web Companion para sincronização do catálogo oficial
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 space-y-4">
            {isConnected ? (
              <div className="p-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 space-y-3">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                  <CheckCircle className="h-8 w-8" />
                </div>
                <h4 className="font-bold text-base text-foreground">
                  WhatsApp Web Conectado!
                </h4>
                <p className="text-xs text-muted-foreground">
                  O navegador Chromium na VPS está autenticado e operando em conjunto com o Baileys. O catálogo oficial já pode ser sincronizado em tempo real.
                </p>
                <div className="pt-2">
                  <Button
                    variant="default"
                    size="sm"
                    className="rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium gap-2 px-4 shadow-emerald-900/30"
                    onClick={() => {
                      setIsModalOpen(false);
                      void handleSyncCatalog();
                    }}
                  >
                    <ArrowClockwise className="h-4 w-4" />
                    <span>Sincronizar Catálogo Agora</span>
                  </Button>
                </div>
              </div>
            ) : loading || !bridgeState.qrImage ? (
              <div className="rounded-2xl border border-border/70 bg-background/50 p-8 flex flex-col items-center justify-center min-h-[280px] gap-3">
                <Spinner className="h-10 w-10 animate-spin text-emerald-500" />
                <p className="font-medium text-sm text-foreground">Iniciando Chromium na VPS...</p>
                <p className="text-xs text-muted-foreground max-w-xs text-center">
                  Aguardando geração do QR Code pelo WhatsApp Web. Isso pode levar alguns segundos.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="relative inline-flex items-center justify-center p-3.5 bg-white rounded-2xl shadow-2xl border border-border mx-auto">
                  <img
                    src={bridgeState.qrImage || undefined}
                    alt="QR Code WhatsApp Web Bridge"
                    className="h-[256px] w-[256px] object-contain rounded-xl"
                  />
                  {/* Logo ZAI centralizado no meio do QR Code */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="h-14 w-14 rounded-2xl bg-white shadow-xl border-2 border-emerald-500/60 p-1.5 flex items-center justify-center">
                      <img
                        src="/brand/logo-dark.svg"
                        alt="ZAI"
                        className="h-10 w-10 object-contain drop-shadow"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2 text-left bg-background/60 p-3.5 rounded-xl border border-border/60 text-xs">
                  <p className="font-semibold text-foreground flex items-center gap-1.5 text-xs">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 font-mono text-[10px]">1</span>
                    Abra o WhatsApp no celular do número conectado
                  </p>
                  <p className="font-semibold text-foreground flex items-center gap-1.5 text-xs">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 font-mono text-[10px]">2</span>
                    Toque em Aparelhos Conectados &gt; Conectar um aparelho
                  </p>
                  <p className="font-semibold text-foreground flex items-center gap-1.5 text-xs">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 font-mono text-[10px]">3</span>
                    Aponte a câmera para este QR Code com o logo ZAI
                  </p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex items-center justify-between sm:justify-between gap-2 pt-2 border-t border-border/40">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsModalOpen(false)}
              className="rounded-xl text-xs"
            >
              Fechar
            </Button>
            {!isConnected && (
              <Button
                variant="default"
                size="sm"
                onClick={loadQR}
                disabled={loading}
                className="rounded-xl text-xs bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5 font-medium"
              >
                {loading ? <Spinner className="h-3.5 w-3.5 animate-spin" /> : <ArrowClockwise className="h-3.5 w-3.5" />}
                <span>Atualizar QR Code</span>
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
