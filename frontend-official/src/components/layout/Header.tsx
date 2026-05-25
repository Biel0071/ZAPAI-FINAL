import { useNavigate } from "react-router-dom";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { useApiRuntimeStatus } from "@/hooks/useApiRuntimeStatus";
import { useRuntime } from "@/providers/RuntimeProvider";
import { HeaderShell } from "@/lovable/layout/HeaderShell";

interface HeaderProps {
  title: string;
  subtitle?: string;
  runtimeState?: "offline" | "starting" | "running" | "reconnecting" | "unconfigured";
  actions?: React.ReactNode;
}

export function Header({ title, subtitle, runtimeState, actions }: HeaderProps) {
  const navigate = useNavigate();
  const { logout, username } = useAdminAuth();
  const { connectionState, manualReconnect } = useApiRuntimeStatus();
  const { forceReconnect, status: runtimeProviderStatus } = useRuntime();
  const resolvedRuntimeState = runtimeState ?? (
    runtimeProviderStatus === "online"
      ? "running"
      : runtimeProviderStatus === "reconnecting"
        ? "reconnecting"
        : "offline"
  );

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const runtimeBadge =
    resolvedRuntimeState === "running"
      ? { label: "Online", tone: "online" as const }
      : resolvedRuntimeState === "starting" || resolvedRuntimeState === "reconnecting"
        ? { label: resolvedRuntimeState === "reconnecting" ? "Reconectando" : "Iniciando", tone: "warning" as const }
        : resolvedRuntimeState === "offline"
          ? { label: "Offline", tone: "offline" as const }
          : resolvedRuntimeState === "unconfigured"
            ? { label: "Não configurado", tone: "syncing" as const }
            : null;

  return (
    <HeaderShell
      title={title}
      subtitle={subtitle}
      runtimeLabel={runtimeBadge?.label ?? null}
      runtimeTone={runtimeBadge?.tone ?? "offline"}
      runtimePulse={resolvedRuntimeState === "starting" || resolvedRuntimeState === "reconnecting"}
      connectionOffline={connectionState === "OFFLINE"}
      onReconnect={() => {
        manualReconnect();
        forceReconnect();
      }}
      actions={actions}
      username={username}
      onLogout={handleLogout}
    />
  );
}
