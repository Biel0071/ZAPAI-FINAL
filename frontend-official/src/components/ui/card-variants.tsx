import * as React from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./card";

export interface BaseCardProps extends React.HTMLAttributes<HTMLDivElement> {}

export { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle };

/**
 * CompactCard: Card denso com padding reduzido para seletores, listas e configurações rápidas.
 */
export function CompactCard({ className, ...props }: BaseCardProps) {
  return (
    <Card 
      className={cn(
        "rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm shadow-sm transition-all duration-200 hover:border-border/80 hover:bg-card/80 p-3.5",
        className
      )}
      {...props} 
    />
  );
}

/**
 * MetricCard: Card de métricas e KPIs corporativos com layout proporcional e altura determinada pelo conteúdo.
 */
export interface MetricCardProps extends BaseCardProps {
  icon?: React.ReactNode;
  label?: string;
  value?: React.ReactNode;
  hint?: React.ReactNode;
  badge?: React.ReactNode;
  tone?: "primary" | "success" | "warning" | "info" | "danger" | "neutral";
}

export function MetricCard({ 
  icon, 
  label, 
  value, 
  hint, 
  badge, 
  tone = "primary", 
  className, 
  children, 
  ...props 
}: MetricCardProps) {
  const toneBg = {
    primary: "bg-primary/10 text-primary border-primary/20",
    success: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    warning: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    info: "bg-sky-500/10 text-sky-400 border-sky-500/20",
    danger: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    neutral: "bg-muted/40 text-muted-foreground border-border/50",
  }[tone];

  return (
    <Card 
      className={cn(
        "relative flex flex-col justify-between rounded-xl border border-border/50 bg-card/70 backdrop-blur-md p-4 shadow-sm transition-all hover:border-border hover:bg-card/90",
        className
      )}
      {...props} 
    >
      {children ? children : (
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              {icon && (
                <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border", toneBg)}>
                  {icon}
                </div>
              )}
              {label && (
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground truncate">
                  {label}
                </span>
              )}
            </div>
            {badge && <div className="shrink-0">{badge}</div>}
          </div>

          <div className="flex items-baseline justify-between gap-2">
            {value !== undefined && (
              <span className="font-display text-xl font-bold tracking-tight text-foreground">
                {value}
              </span>
            )}
            {hint && (
              <span className="text-xs text-muted-foreground truncate">
                {hint}
              </span>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

/**
 * ActionCard: Card clicável para ações prioritárias, gatilhos ou modelos.
 */
export function ActionCard({ 
  className, 
  active = false,
  ...props 
}: BaseCardProps & { active?: boolean }) {
  return (
    <Card 
      className={cn(
        "cursor-pointer rounded-xl border p-3.5 transition-all active:scale-[0.99]",
        active
          ? "border-primary bg-primary/10 shadow-[0_0_15px_rgba(16,185,129,0.15)] ring-1 ring-primary/40"
          : "border-border/50 bg-card/50 hover:border-primary/40 hover:bg-card/80",
        className
      )}
      {...props} 
    />
  );
}

/**
 * PanelCard: Card para painéis laterais de ferramentas, configurações ou visualizações divididas.
 */
export function PanelCard({ 
  title, 
  headerActions,
  footer,
  className, 
  children, 
  ...props 
}: BaseCardProps & { 
  title?: React.ReactNode; 
  headerActions?: React.ReactNode; 
  footer?: React.ReactNode; 
}) {
  return (
    <Card 
      className={cn(
        "flex flex-col rounded-xl border border-border/60 bg-card/65 backdrop-blur-md shadow-sm overflow-hidden",
        className
      )}
      {...props} 
    >
      {title && (
        <div className="flex items-center justify-between border-b border-border/40 px-4 py-3 bg-muted/10 shrink-0">
          <h4 className="font-display text-xs font-bold uppercase tracking-wider text-foreground">
            {title}
          </h4>
          {headerActions && <div className="flex items-center gap-1.5">{headerActions}</div>}
        </div>
      )}
      <div className="flex-1 p-4 min-h-0">
        {children}
      </div>
      {footer && (
        <div className="border-t border-border/40 px-4 py-2.5 bg-muted/10 shrink-0">
          {footer}
        </div>
      )}
    </Card>
  );
}

/**
 * InteractiveCard: Card com suporte a seleção explícita.
 */
export function InteractiveCard({
  selected,
  className,
  ...props
}: BaseCardProps & { selected?: boolean }) {
  return (
    <Card
      className={cn(
        "cursor-pointer rounded-xl border p-4 transition-all duration-200",
        selected
          ? "border-primary bg-primary/10 shadow-[0_0_20px_rgba(16,185,129,0.18)] ring-1 ring-primary"
          : "border-border/60 bg-card/50 hover:border-border hover:bg-card/75",
        className
      )}
      {...props}
    />
  );
}

/**
 * EmptyStateCard: Card padronizado para feedback quando dados não forem encontrados.
 */
export function EmptyStateCard({
  icon,
  title,
  description,
  action,
  className,
  ...props
}: BaseCardProps & {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <Card
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-border/70 bg-card/30 p-8 text-center",
        className
      )}
      {...props}
    >
      {icon && (
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-muted/30 text-muted-foreground">
          {icon}
        </div>
      )}
      <h4 className="font-display text-sm font-semibold text-foreground">{title}</h4>
      {description && <p className="mt-1 max-w-sm text-xs text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </Card>
  );
}
