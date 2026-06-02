import { Component, type ErrorInfo, type ReactNode } from "react";
import { sendErrorLog } from "@/runtime/logs/errorLogService";

type State = {
  hasError: boolean;
  errorMessage: string;
  retryCount: number;
};

type Props = {
  children: ReactNode;
  pageName: string;
};

export class PageRouteBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: "", retryCount: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      errorMessage: error?.message ?? "Erro desconhecido",
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    void sendErrorLog({
      message: `[PageRouteBoundary - ${this.props.pageName}] ${error?.message ?? "Unknown"}`,
      componentStack: info.componentStack ?? this.props.pageName,
      timestamp: new Date().toISOString(),
      type: "page_runtime_error",
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
      <div className="flex min-h-[80vh] w-full flex-col items-center justify-center p-6 text-center">
        <div className="mx-auto max-w-md rounded-xl border border-destructive/20 bg-destructive/5 p-8 shadow-lg backdrop-blur-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive text-2xl">
            ⚠️
          </div>
          <h2 className="mb-2 text-xl font-bold tracking-tight text-foreground">
            Ocorreu um erro no módulo: {this.props.pageName}
          </h2>
          <p className="mb-6 text-sm text-muted-foreground line-clamp-3">
            {this.state.errorMessage}
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={this.handleRetry}
              className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/95 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              Recarregar Módulo
            </button>
            {this.state.retryCount > 0 && (
              <span className="text-xs text-muted-foreground">
                Tentativa de recuperação: {this.state.retryCount}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }
}
