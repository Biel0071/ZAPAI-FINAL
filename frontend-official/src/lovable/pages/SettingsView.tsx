import type { ReactNode } from "react";

export interface SettingsViewProps {
  navigation: ReactNode;
  content: ReactNode;
}

export function SettingsView({ navigation, content }: SettingsViewProps) {
  return (
    <div className="page-container section-stack w-full max-w-full overflow-x-hidden">
      <div className="flex flex-col gap-6 lg:flex-row w-full min-w-0">
        <aside className="w-full shrink-0 lg:w-64 min-w-0">{navigation}</aside>
        <main className="flex-1 min-w-0 w-full overflow-x-hidden">{content}</main>
      </div>
    </div>
  );
}

