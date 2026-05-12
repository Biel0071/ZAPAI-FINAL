import { useEffect, useState } from "react";
import {
  getFrontendHealthSnapshot,
  reportFrontendIssue,
  subscribeFrontendHealth,
  type FrontendHealthSnapshot,
} from "@/services/frontendHealthService";

export function useFrontendHealthWatcher() {
  const [frontendHealth, setFrontendHealth] = useState<FrontendHealthSnapshot>(getFrontendHealthSnapshot);

  useEffect(() => {
    const unsubscribe = subscribeFrontendHealth(setFrontendHealth);

    const onWindowError = (event: ErrorEvent) => {
      reportFrontendIssue({
        type: "unexpected_error",
        message: event.message || "Unexpected frontend error",
        service: "window.onerror",
        level: "error",
      });

      const isChunkError = event.message?.includes("dynamically imported module") || event.message?.includes("ChunkLoadError") || event.message?.includes("Failed to fetch");
      if (isChunkError) {
        const isRecovering = sessionStorage.getItem("chunk_recovery");
        if (!isRecovering) {
          sessionStorage.setItem("chunk_recovery", "true");
          window.location.reload();
        }
      }
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason =
        typeof event.reason === "string"
          ? event.reason
          : event.reason instanceof Error
            ? event.reason.message
            : "Unhandled promise rejection";

      reportFrontendIssue({
        type: "unexpected_error",
        message: reason,
        service: "window.unhandledrejection",
        level: "error",
      });

      const isChunkError = reason?.includes("dynamically imported module") || reason?.includes("ChunkLoadError") || reason?.includes("Failed to fetch");
      if (isChunkError) {
        const isRecovering = sessionStorage.getItem("chunk_recovery");
        if (!isRecovering) {
          sessionStorage.setItem("chunk_recovery", "true");
          window.location.reload();
        }
      }
    };

    window.addEventListener("error", onWindowError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    return () => {
      unsubscribe();
      window.removeEventListener("error", onWindowError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  return frontendHealth;
}
