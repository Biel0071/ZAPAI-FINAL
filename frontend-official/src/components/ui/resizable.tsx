import * as ResizablePrimitive from "react-resizable-panels";

import { cn } from "@/lib/utils";

const ResizablePanelGroup = ({ className, ...props }: React.ComponentProps<typeof ResizablePrimitive.PanelGroup>) => (
  <ResizablePrimitive.PanelGroup
    className={cn("flex h-full w-full data-[panel-group-direction=vertical]:flex-col", className)}
    {...props}
  />
);

const ResizablePanel = ResizablePrimitive.Panel;

const ResizableHandle = ({
  withHandle: _withHandle,
  className,
  children,
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.PanelResizeHandle> & {
  withHandle?: boolean;
}) => (
  <ResizablePrimitive.PanelResizeHandle
    className={cn(
      "group relative flex w-2 items-center justify-center bg-transparent transition-colors duration-200 cursor-col-resize data-[panel-group-direction=vertical]:cursor-row-resize focus-visible:outline-none focus-visible:bg-primary/15 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-primary",
      className,
    )}
    {...props}
  >
    {children || (
      <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-transparent transition-all duration-200 group-hover:bg-emerald-500 group-data-[resize-handle-state=drag]:bg-emerald-500" />
    )}
  </ResizablePrimitive.PanelResizeHandle>
);

export { ResizablePanelGroup, ResizablePanel, ResizableHandle };
