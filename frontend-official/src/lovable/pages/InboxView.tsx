import type { ReactNode } from "react";

export interface InboxViewProps {
  leftPanel: ReactNode;
  centerPanel: ReactNode;
  rightPanel: ReactNode;
  tabletLeadSheet?: ReactNode;
  previewDialog?: ReactNode;
}

export function InboxView({ leftPanel, centerPanel, rightPanel, tabletLeadSheet, previewDialog }: InboxViewProps) {
  return (
    <>
      <div className="w-full h-[calc(100vh-64px)] flex overflow-hidden border-t border-border/60 bg-card/30">
        <div className="w-[360px] shrink-0 flex flex-col h-full overflow-hidden">
          {leftPanel}
        </div>
        <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden relative">
          {centerPanel}
        </div>
        {rightPanel}
      </div>
      {tabletLeadSheet}
      {previewDialog}
    </>
  );
}
