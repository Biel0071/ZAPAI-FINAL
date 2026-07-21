import { MainLayout } from "@/components/layout/MainLayout";
import { RuntimeProvider } from "@/providers/RuntimeProvider";

export default function AuthenticatedAppShell() {
  return (
    <RuntimeProvider>
      <MainLayout />
    </RuntimeProvider>
  );
}
