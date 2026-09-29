import { cn } from "@/core/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-md bg-muted shimmer", className)} {...props} />;
}

export { Skeleton };
