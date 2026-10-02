import { MainLayout } from "@/components/layout/MainLayout";
import { RuntimeProvider } from "@/state/providers/RuntimeProvider";
import { ConnectionLostOverlay } from "@/components/system/ConnectionLostOverlay";
import { ZaibotFloatingAssistant } from "@/components/ai/ZaibotFloatingAssistant";

export default function AuthenticatedAppShell() {
  return (
    <RuntimeProvider>
      <MainLayout />
      <ZaibotFloatingAssistant />
      <ConnectionLostOverlay />
    </RuntimeProvider>
  );
}
