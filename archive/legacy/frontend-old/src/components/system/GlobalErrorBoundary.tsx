import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { sendErrorLog } from "@/services/errorLogService";

type ErrorBoundaryState = {
  hasError: boolean;
  message: string;
  componentStack?: string;
  timestamp?: string;
  reporting: boolean;
  reportFailed: boolean;
};

export class GlobalErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    message: "",
    componentStack: "",
    timestamp: undefined,
    reporting: false,
    reportFailed: false,
  };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      message: error.message || "Unknown frontend error",
      timestamp: new Date().toISOString(),
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const timestamp = new Date().toISOString();
    const componentStack = errorInfo.componentStack || "";

    this.setState({
      message: error.message || "Unknown frontend error",
      componentStack,
      timestamp,
    });

    void sendErrorLog({
      message: error.message || "Unknown frontend error",
      componentStack,
      timestamp,
    }).catch(() => {
      this.setState({ reportFailed: true });
    });
  }

  private handleReport = async () => {
    if (!this.state.message || this.state.reporting) return;

    this.setState({ reporting: true, reportFailed: false });
    try {
      await sendErrorLog({
        message: this.state.message,
        componentStack: this.state.componentStack,
        timestamp: this.state.timestamp || new Date().toISOString(),
      });
    } catch {
      this.setState({ reportFailed: true });
    } finally {
      this.setState({ reporting: false });
    }
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle>System encountered an error</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">A component crashed, but the app safety layer prevented a full dashboard shutdown.</p>
            {this.state.reportFailed && <p className="text-sm text-destructive">Report failed. Try again.</p>}
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => window.location.reload()}>Reload Page</Button>
              <Button variant="outline" onClick={() => void this.handleReport()} disabled={this.state.reporting}>
                {this.state.reporting ? "Reporting..." : "Report Error"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
}
