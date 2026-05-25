import type { ReactNode } from "react";

export interface SettingsViewProps {
  navigation: ReactNode;
  content: ReactNode;
}

export function SettingsView({ navigation, content }: SettingsViewProps) {
  return (
    <div className="page-container section-stack">
      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="w-full flex-shrink-0 lg:w-64">{navigation}</div>
        <div className="flex-1">{content}</div>
      </div>
    </div>
  );
}
