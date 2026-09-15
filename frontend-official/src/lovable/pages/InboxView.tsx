import { useEffect, useRef, useState, type ReactNode } from "react";
import type { ImperativePanelHandle } from "react-resizable-panels";
import { cn } from "@/lib/utils";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";

export interface InboxViewProps {
  leftPanel: ReactNode;
  centerPanel: ReactNode;
  rightPanel: ReactNode;
  tabletLeadSheet?: ReactNode;
  previewDialog?: ReactNode;
  isMobile?: boolean;
  mobileScreen?: "conversations" | "chat";
  rightPanelCollapsed?: boolean;
  onRightPanelCollapsedChange?: (collapsed: boolean) => void;
}

export function InboxView({
  leftPanel,
  centerPanel,
  rightPanel,
  tabletLeadSheet,
  previewDialog,
  isMobile = false,
  mobileScreen = "conversations",
  rightPanelCollapsed = false,
  onRightPanelCollapsedChange,
}: InboxViewProps) {
  const layoutRef = useRef<HTMLDivElement>(null);
  const contextPanelRef = useRef<ImperativePanelHandle>(null);
  const [railSize, setRailSize] = useState(5);
  const hasRightPanel = Boolean(rightPanel);

  useEffect(() => {
    const container = layoutRef.current;
    if (!container || isMobile) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width > 0) {
        setRailSize(Math.min(19, (64 / entry.contentRect.width) * 100));
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [isMobile, hasRightPanel]);

  useEffect(() => {
    const panel = contextPanelRef.current;
    if (!panel) return;
    if (rightPanelCollapsed) panel.collapse();
    else panel.expand();
  }, [rightPanelCollapsed, railSize, isMobile, hasRightPanel]);

  if (isMobile) {
    return (
      <>
        <div 
          className={cn(
            "w-full flex overflow-hidden border-t border-border/60 bg-card/30",
            mobileScreen === "chat" ? "h-screen border-t-0" : "flex-1 min-h-0"
          )}
        >
          <div 
            className={cn(
              "flex flex-col h-full overflow-hidden w-full",
              mobileScreen !== "conversations" && "hidden"
            )}
          >
            {leftPanel}
          </div>
          <div 
            className={cn(
              "flex-grow min-w-0 flex flex-col h-full overflow-hidden relative w-full",
              mobileScreen !== "chat" && "hidden"
            )}
          >
            {centerPanel}
          </div>
        </div>
        {tabletLeadSheet}
        {previewDialog}
      </>
    );
  }

  return (
    <>
      <div ref={layoutRef} className="w-full flex-1 min-h-0 flex overflow-hidden border-t border-border/60 bg-card/30">
        <ResizablePanelGroup
          direction="horizontal"
          autoSaveId="zapflow-inbox-panels-layout-v1"
          className="h-full w-full"
        >
          <ResizablePanel
            defaultSize={28}
            minSize={22}
            maxSize={38}
            id="inbox-conversations-panel"
            order={1}
            className="flex flex-col h-full overflow-hidden"
          >
            {leftPanel}
          </ResizablePanel>

          <ResizableHandle
            aria-label="Redimensionar lista de conversas"
            className="group relative w-2 cursor-col-resize bg-transparent transition-colors duration-200 hover:bg-transparent"
          >
            <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-transparent transition-all duration-200 group-hover:bg-emerald-500 group-data-[resize-handle-state=drag]:bg-emerald-500" />
          </ResizableHandle>

          <ResizablePanel
            defaultSize={rightPanel ? 46 : 72}
            minSize={30}
            id="inbox-chat-pane"
            order={2}
            className="flex flex-col h-full overflow-hidden min-w-0 relative"
          >
            {centerPanel}
          </ResizablePanel>

          {rightPanel && (
            <>
              <ResizableHandle
                aria-label="Redimensionar painel de detalhes"
                className="group relative w-2 cursor-col-resize bg-transparent transition-colors duration-200 hover:bg-transparent hidden lg:flex"
              >
                <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-transparent transition-all duration-200 group-hover:bg-emerald-500 group-data-[resize-handle-state=drag]:bg-emerald-500" />
              </ResizableHandle>
              <ResizablePanel
                ref={contextPanelRef}
                defaultSize={26}
                minSize={20}
                maxSize={42}
                collapsible
                collapsedSize={railSize}
                onCollapse={() => onRightPanelCollapsedChange?.(true)}
                onExpand={() => onRightPanelCollapsedChange?.(false)}
                id="inbox-context-panel"
                order={3}
                className="hidden lg:flex flex-col h-full overflow-hidden"
              >
                {rightPanel}
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </div>
      {tabletLeadSheet}
      {previewDialog}
    </>
  );
}
