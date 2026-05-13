import { Skeleton } from "@/components/ui/skeleton";

export function PageFallback() {
  return (
    <div className="min-h-screen p-6 space-y-4">
      <Skeleton className="h-12 w-72" />
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-28 rounded-xl" />
      </div>
      <Skeleton className="h-[420px] rounded-xl" />
    </div>
  );
}
