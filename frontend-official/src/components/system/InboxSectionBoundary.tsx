import { Component, type ReactNode } from "react";

interface InboxSectionBoundaryProps {
  children: ReactNode;
  fallbackLabel?: string;
}

interface InboxSectionBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

/**
 * Lightweight ErrorBoundary for isolating individual Inbox sidebar modules.
 * If a module (Quick Replies, IA, Files, History) crashes, the rest of the
 * Inbox continues working normally. The failed module shows a minimal
 * fallback message instead of taking down the entire page.
 */
export class InboxSectionBoundary extends Component<InboxSectionBoundaryProps, InboxSectionBoundaryState> {
  state: InboxSectionBoundaryState = {
    hasError: false,
    errorMessage: "",
  };

  static getDerivedStateFromError(error: Error): Partial<InboxSectionBoundaryState> {
    return { hasError: true, errorMessage: error?.message || "Erro desconhecido" };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error(`[InboxSectionBoundary] ${this.props.fallbackLabel ?? "Módulo"} crash:`, error);
    if (info?.componentStack) {
      console.error("[InboxSectionBoundary] Stack:", info.componentStack);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, errorMessage: "" });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-xl border border-border bg-card/40 p-3 shadow-sm text-center">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            {this.props.fallbackLabel ?? "Módulo"} indisponível
          </p>
          <p className="text-[10px] text-muted-foreground mb-2">{this.state.errorMessage}</p>
          <button
            onClick={this.handleRetry}
            className="text-[10px] text-primary underline hover:text-primary/80 transition-colors"
          >
            Tentar novamente
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
