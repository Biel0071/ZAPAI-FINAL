import { Skeleton } from "@/components/ui/skeleton";
import { CardSkeleton } from "@/components/ui/loading-skeleton";

export function PageFallback() {
  return (
    <div className="page-container section-stack min-h-screen">
      <Skeleton className="h-10 w-64 rounded-lg" />
      <div className="grid gap-4 md:grid-cols-3">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
      <Skeleton className="h-[420px] rounded-lg" />
    </div>
  );
}
