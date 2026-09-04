import * as React from "react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./card"

export interface BaseCardProps extends React.HTMLAttributes<HTMLDivElement> {}

export function CompactCard({ className, ...props }: BaseCardProps) {
  return (
    <Card 
      className={cn(
        "rounded-xl border border-border/40 bg-card/40 backdrop-blur-sm shadow-soft transition-all duration-200 hover:border-border/80 hover:bg-card/60",
        className
      )}
      {...props} 
    />
  )
}

export function MetricCard({ className, ...props }: BaseCardProps) {
  return (
    <Card 
      className={cn(
        "flex flex-col justify-center rounded-2xl border border-border/30 bg-gradient-to-br from-card/80 to-card/20 p-5 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md",
        className
      )}
      {...props} 
    />
  )
}

export function ActionCard({ className, ...props }: BaseCardProps) {
  return (
    <Card 
      className={cn(
        "cursor-pointer rounded-xl border border-primary/20 bg-primary/5 p-4 transition-all hover:bg-primary/10 hover:border-primary/40 active:scale-[0.98]",
        className
      )}
      {...props} 
    />
  )
}
