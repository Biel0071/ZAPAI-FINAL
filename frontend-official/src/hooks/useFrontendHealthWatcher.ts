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
