import { LoadingRegion } from "@/shared/components/data/skeletons";
import { Skeleton } from "@/shared/components/ui/skeleton";

// The assistant as it will be, in the room its layout gives it (the height of
// the screen under the shell): the bar of the model and the credits, the
// conversation, and the box that holds the message.
export default function AILoading() {
  return (
    <LoadingRegion className="flex flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-hairline px-4 py-2">
        <Skeleton className="h-9 w-44" />
        <Skeleton className="h-4 w-24" />
      </div>
      <div className="flex-1 px-4 py-6">
        <div className="mx-auto max-w-3xl space-y-6">
          <Skeleton className="h-16 w-2/3" />
          <Skeleton className="ml-auto h-10 w-1/2" />
          <Skeleton className="h-24 w-3/4" />
        </div>
      </div>
      <div className="border-t border-hairline p-4">
        <Skeleton className="mx-auto h-15 max-w-3xl" />
      </div>
    </LoadingRegion>
  );
}
