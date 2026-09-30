import { toast } from "sonner";

type NotifyVariant = "success" | "warning" | "error" | "info";

const DEFAULT_DURATION_MS = 4000;

function publish(variant: NotifyVariant, message: string) {
  if (variant === "success") {
    toast.success(message, { duration: DEFAULT_DURATION_MS });
    return;
  }

  if (variant === "warning") {
    toast.warning(message, { duration: DEFAULT_DURATION_MS });
    return;
  }

  if (variant === "info") { toast.info(message, { duration: DEFAULT_DURATION_MS }); return; }
  toast.error(message, { duration: DEFAULT_DURATION_MS });
}

export const notify = {
  info: (message: string) => publish("info", message),
  warn: (message: string) => publish("warning", message),
  success: (message: string) => publish("success", message),
  warning: (message: string) => publish("warning", message),
  error: (message: string) => publish("error", message),
};
