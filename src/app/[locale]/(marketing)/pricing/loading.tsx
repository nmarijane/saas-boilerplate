import { LoadingRegion } from "@/shared/components/data/skeletons";
import { Skeleton } from "@/shared/components/ui/skeleton";

// The prices are drawn from who is looking, so they wait for the session: the
// header of the page and the three cards, in the place they will take.
export default function PricingLoading() {
  return (
    <LoadingRegion className="container mx-auto max-w-6xl space-y-12 px-4 py-16">
      <div className="flex flex-col items-center gap-4">
        <Skeleton className="h-10 w-80 max-w-full" />
        <Skeleton className="h-6 w-96 max-w-full" />
      </div>
      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-3">
        {[0, 1, 2].map((index) => (
          <Skeleton key={index} className="h-96 rounded-lg" />
        ))}
      </div>
    </LoadingRegion>
  );
}
