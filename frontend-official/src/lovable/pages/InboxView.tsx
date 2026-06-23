import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface InboxViewProps {
  leftPanel: ReactNode;
  centerPanel: ReactNode;
  rightPanel: ReactNode;
  tabletLeadSheet?: ReactNode;
  previewDialog?: ReactNode;
  isMobile?: boolean;
  mobileScreen?: "conversations" | "chat";
}

export function InboxView({
  leftPanel,
  centerPanel,
  rightPanel,
  tabletLeadSheet,
  previewDialog,
  isMobile = false,
  mobileScreen = "conversations"
}: InboxViewProps) {
  return (
    <>
      <div 
        className={cn(
          "w-full flex overflow-hidden border-t border-border/60 bg-card/30",
          isMobile && mobileScreen === "chat" ? "h-screen border-t-0" : "flex-1 min-h-0"
        )}
      >
        <div 
          className={cn(
            "flex flex-col h-full overflow-hidden",
            isMobile 
              ? (mobileScreen === "conversations" ? "w-full" : "hidden")
              : "w-[320px] shrink-0 xl:w-[360px]"
          )}
        >
          {leftPanel}
        </div>
        <div 
          className={cn(
            "flex-grow min-w-0 flex flex-col h-full overflow-hidden relative",
            isMobile && mobileScreen !== "chat" && "hidden"
          )}
        >
          {centerPanel}
        </div>
        {rightPanel}
      </div>
      {tabletLeadSheet}
      {previewDialog}
    </>
  );
}

