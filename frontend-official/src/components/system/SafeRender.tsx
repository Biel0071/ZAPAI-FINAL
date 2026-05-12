import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { reportFrontendIssue } from "@/services/frontendHealthService";

type SafeRenderProps = {
  children: ReactNode;
  fallback?: ReactNode;
  scope?: string;
};

type SafeRenderState = {
  hasError: boolean;
};

export class SafeRender extends Component<SafeRenderProps, SafeRenderState> {
  state: SafeRenderState = { hasError: false };

  static getDerivedStateFromError(): SafeRenderState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    reportFrontendIssue({
      type: "unexpected_error",
      service: this.props.scope ?? "safe-render",
      message: error.message || "Erro de renderização",
      level: "error",
    });

    void errorInfo;
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    if (this.props.fallback) return this.props.fallback;

    return (
      <div className="flex min-h-[240px] items-center justify-center rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-center">
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4" />
          <span>Falha de renderização nesta seção.</span>
        </div>
      </div>
    );
  }
}