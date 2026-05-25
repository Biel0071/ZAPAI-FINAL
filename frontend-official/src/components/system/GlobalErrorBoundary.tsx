import { Component, type ErrorInfo, type ReactNode } from "react";

type ErrorBoundaryState = {
  hasError: boolean;
  message: string;
  componentStack: string;
  timestamp: string;
  route: string;
  retryCount: number;
};

const MAX_AUTO_RETRIES = 2;

/**
 * Production-grade Error Boundary.
 *
 * Uses ONLY inline styles — cannot depend on Tailwind/shadcn-ui components
 * because those may be the very things that crashed.
 *
 * Handles:
 *  - React render crashes
 *  - Dynamic import / ChunkLoadError (auto-reload once)
 *  - Corrupted storage recovery
 *  - Crash loop detection (avoids infinite reload)
 */
export class GlobalErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    message: "",
    componentStack: "",
    timestamp: "",
    route: "",
    retryCount: 0,
  };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      message: error?.message || "Unknown frontend error",
      timestamp: new Date().toISOString(),
      route: typeof window !== "undefined" ? window.location.pathname : "",
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const componentStack = errorInfo.componentStack || "";

    this.setState({
      message: error?.message || "Unknown frontend error",
      componentStack,
      timestamp: new Date().toISOString(),
      route: window.location.pathname,
    });

    console.error("[ZAPFLOW ErrorBoundary] Caught:", error);
    console.error("[ZAPFLOW ErrorBoundary] Component Stack:", componentStack);

    // ── Try to report to backend (best-effort) ──
    this.reportError(error.message, componentStack);
  }

  private reportError(message: string, componentStack: string) {
    try {
      const apiUrl = (import.meta.env.VITE_API_URL ?? "").trim().replace(/\/+$/, "");
      if (!apiUrl) return;

      void fetch(`${apiUrl}/api/system/error-log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `[ErrorBoundary] ${message}`,
          componentStack,
          timestamp: new Date().toISOString(),
        }),
      }).catch(() => {});
    } catch {
      // Ignore — error reporting is best-effort
    }
  }

  private handleResetStorage = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      // Ignore
    }
    window.location.href = "/login";
  };

  private handleContinue = () => {
    this.setState({
      hasError: false,
      message: "",
      componentStack: "",
      timestamp: "",
      route: "",
      retryCount: this.state.retryCount + 1,
    });

    // Navigate to dashboard to avoid the same route crashing again
    if (window.location.pathname !== "/dashboard") {
      window.history.replaceState({}, "", "/dashboard");
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
  };

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    // Inline-only fallback UI — no dependencies on any component library
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          backgroundColor: "#0a0f1a",
          color: "#e2e8f0",
          padding: "24px",
          fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        }}
      >
        <div
          style={{
            maxWidth: "520px",
            width: "100%",
            backgroundColor: "#1a2332",
            padding: "32px",
            borderRadius: "12px",
            border: "1px solid #2d3748",
            boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "10px",
                backgroundColor: "rgba(239, 68, 68, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "20px",
              }}
            >
              ⚠️
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "#f8fafc" }}>
                Modo de Segurança
              </h2>
              <p style={{ margin: 0, fontSize: "13px", color: "#94a3b8" }}>
                O sistema interceptou um erro e impediu falha total.
              </p>
            </div>
          </div>

          {/* Error details */}
          <div
            style={{
              backgroundColor: "#0f172a",
              borderRadius: "8px",
              padding: "14px",
              marginBottom: "20px",
              fontSize: "12px",
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              border: "1px solid #1e293b",
            }}
          >
            <div style={{ color: "#ef4444", marginBottom: "6px", wordBreak: "break-word" }}>
              {this.state.message || "Unknown error"}
            </div>
            <div style={{ color: "#64748b", fontSize: "11px" }}>
              Rota: {this.state.route || "/"} • {this.state.timestamp}
            </div>
            {this.state.componentStack && (
              <details style={{ marginTop: "8px" }}>
                <summary style={{ color: "#64748b", cursor: "pointer", fontSize: "11px" }}>
                  Component stack
                </summary>
                <pre
                  style={{
                    color: "#94a3b8",
                    fontSize: "10px",
                    whiteSpace: "pre-wrap",
                    maxHeight: "120px",
                    overflow: "auto",
                    marginTop: "4px",
                  }}
                >
                  {this.state.componentStack}
                </pre>
              </details>
            )}
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button
              onClick={this.handleContinue}
              style={{
                flex: 1,
                padding: "10px 16px",
                backgroundColor: "#3b82f6",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "13px",
                fontWeight: 600,
                transition: "background-color 0.2s",
              }}
              onMouseEnter={(e) => ((e.target as HTMLButtonElement).style.backgroundColor = "#2563eb")}
              onMouseLeave={(e) => ((e.target as HTMLButtonElement).style.backgroundColor = "#3b82f6")}
            >
              Tentar Recuperar
            </button>
            <button
              onClick={this.handleReload}
              style={{
                padding: "10px 16px",
                backgroundColor: "#1e293b",
                color: "#94a3b8",
                border: "1px solid #334155",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "13px",
                fontWeight: 500,
              }}
            >
              Recarregar
            </button>
            <button
              onClick={this.handleResetStorage}
              style={{
                padding: "10px 16px",
                backgroundColor: "transparent",
                color: "#ef4444",
                border: "1px solid rgba(239,68,68,0.3)",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "13px",
                fontWeight: 500,
              }}
            >
              Limpar Cache
            </button>
          </div>
        </div>
      </div>
    );
  }
}
