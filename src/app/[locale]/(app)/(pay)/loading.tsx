import { LoadingRegion } from "@/shared/components/data/skeletons";
import { Skeleton } from "@/shared/components/ui/skeleton";

// What the pages of payment have in common as they load: a title, then the
// content that follows, in the place it will take.
export default function PayLoading() {
  return (
    <LoadingRegion className="space-y-8">
      <div className="flex flex-col items-center gap-3">
        <Skeleton className="h-9 w-72 max-w-full" />
        <Skeleton className="h-5 w-96 max-w-full" />
      </div>
      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-3">
        {[0, 1, 2].map((index) => (
          <Skeleton key={index} className="h-80 rounded-lg" />
        ))}
      </div>
    </LoadingRegion>
  );
}
