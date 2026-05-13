/**
 * InboxRuntimeBoundary
 *
 * Wraps Inbox.tsx to:
 * 1. Catch runtime errors inside Inbox without crashing the full app
 * 2. Provide a recovery UI that allows the user to retry loading
 * 3. Report errors to the backend via errorLogService (with circuit breaker)
 *
 * This is NOT a rewrite of Inbox — it's a protective wrapper.
 */
import { Component, type ErrorInfo, type ReactNode } from "react";
import { sendErrorLog } from "@/services/errorLogService";

type State = {
  hasError: boolean;
  errorMessage: string;
  retryCount: number;
};

type Props = {
  children: ReactNode;
};

export class InboxRuntimeBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: "", retryCount: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      errorMessage: error?.message ?? "Erro desconhecido na Inbox",
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Report to backend — circuit breaker in errorLogService prevents loops
    void sendErrorLog({
      message: `[InboxRuntimeBoundary] ${error?.message ?? "Unknown"}`,
      componentStack: info.componentStack ?? "Inbox",
      timestamp: new Date().toISOString(),
      type: "inbox_runtime_error",
      level: "error",
      stack: error?.stack,
    });
  }

  handleRetry = () => {
    this.setState((prev) => ({
      hasError: false,
      errorMessage: "",
      retryCount: prev.retryCount + 1,
    }));
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          minHeight: "60vh",
          gap: "16px",
          padding: "24px",
          textAlign: "center",
          color: "var(--foreground)",
        }}
      >
        <div
          style={{
            width: "48px",
            height: "48px",
            borderRadius: "50%",
            background: "var(--destructive, #ef4444)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "24px",
          }}
        >
          ⚠
        </div>
        <div>
          <p style={{ fontWeight: 600, marginBottom: "4px" }}>
            Inbox temporariamente indisponível
          </p>
          <p
            style={{
              fontSize: "0.85rem",
              opacity: 0.6,
              maxWidth: "360px",
            }}
          >
            {this.state.errorMessage || "Ocorreu um erro ao carregar a Inbox."}
          </p>
        </div>
        <button
          onClick={this.handleRetry}
          style={{
            padding: "8px 20px",
            borderRadius: "8px",
            background: "var(--primary, #6366f1)",
            color: "white",
            border: "none",
            cursor: "pointer",
            fontWeight: 500,
          }}
        >
          Tentar novamente
        </button>
        {this.state.retryCount > 0 && (
          <p style={{ fontSize: "0.75rem", opacity: 0.4 }}>
            Tentativa {this.state.retryCount}
          </p>
        )}
      </div>
    );
  }
}
