import { Skeleton } from "@/components/ui/skeleton";

/**
 * Generic page-level skeleton shown during route loads / pending transitions.
 * Mirrors the typical layout: hero heading, subheading, and a content grid.
 */
export function PageSkeleton() {
  return (
    <div className="py-24 animate-fade-up">
      <div className="container mx-auto px-6">
        <div className="max-w-2xl mx-auto text-center mb-16 space-y-5">
          <Skeleton className="h-3 w-32 mx-auto" />
          <Skeleton className="h-14 w-3/4 mx-auto" />
          <Skeleton className="h-14 w-2/3 mx-auto" />
          <Skeleton className="h-4 w-full mx-auto" />
          <Skeleton className="h-4 w-5/6 mx-auto" />
        </div>
        <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="glass rounded-3xl p-10 space-y-5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-10 w-2/3" />
              <Skeleton className="h-12 w-1/2" />
              <div className="space-y-3 pt-4">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-11/12" />
                <Skeleton className="h-3 w-10/12" />
                <Skeleton className="h-3 w-9/12" />
              </div>
              <Skeleton className="h-12 w-full rounded-full mt-6" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
