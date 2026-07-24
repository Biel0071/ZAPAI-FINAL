import { MainLayout } from "@/components/layout/MainLayout";
import { RuntimeProvider } from "@/providers/RuntimeProvider";
import { ConnectionLostOverlay } from "@/components/system/ConnectionLostOverlay";

export default function AuthenticatedAppShell() {
  return (
    <RuntimeProvider>
      <MainLayout />
      <ConnectionLostOverlay />
    </RuntimeProvider>
  );
}
