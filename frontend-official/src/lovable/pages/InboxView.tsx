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
      <div className="page-container pt-4 lg:pt-6">
        <div className="grid min-h-[calc(100vh-8.5rem)] grid-cols-1 overflow-hidden rounded-none border-t border-border/70 bg-card/30 md:grid-cols-[320px_minmax(0,1fr)] lg:grid-cols-[340px_minmax(0,1fr)_320px]">
          {leftPanel}
          {centerPanel}
          {rightPanel}
        </div>
        {tabletLeadSheet}
      </div>
      {previewDialog}
    </>
  );
}
