import React from "react";
import { cn } from "@/lib/utils";

export interface PageContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  fluid?: boolean;
  scrollable?: boolean;
  padded?: boolean;
  children: React.ReactNode;
}

export function PageContainer({
  fluid = false,
  scrollable = false,
  padded = true,
  className,
  children,
  ...props
}: PageContainerProps) {
  return (
    <div
      className={cn(
        "w-full flex-1 min-h-0 flex flex-col",
        !fluid && "max-w-[1600px] mx-auto",
        padded && "px-3.5 py-3 md:px-5 md:py-4",
        scrollable ? "overflow-y-auto scrollbar-thin" : "overflow-hidden",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function SectionHeader({
  title,
  subtitle,
  actions,
  badge,
  className,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  badge?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 mb-3 border-b border-border/40", className)}>
      <div className="flex items-center gap-2.5">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-display text-base font-semibold tracking-tight text-foreground">{title}</h3>
            {badge}
          </div>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
