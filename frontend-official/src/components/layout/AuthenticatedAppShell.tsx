import { MainLayout } from "@/components/layout/MainLayout";
import { RuntimeProvider } from "@/providers/RuntimeProvider";
import { ConnectionLostOverlay } from "@/components/system/ConnectionLostOverlay";
import { FloatingMascotAssistant } from "@/components/ai/FloatingMascotAssistant";

export default function AuthenticatedAppShell() {
  return (
    <RuntimeProvider>
      <MainLayout />
      <FloatingMascotAssistant />
      <ConnectionLostOverlay />
    </RuntimeProvider>
  );
}
