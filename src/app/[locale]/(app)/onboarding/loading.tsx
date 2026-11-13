import { LoadingRegion } from "@/shared/components/data/skeletons";
import { Card, CardContent, CardHeader } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";

// The card of the onboarding as it will be, centered in its column: the title,
// the step it is at and the bar of the progress, then the fields of the step and
// its button.
export default function OnboardingLoading() {
  return (
    <LoadingRegion>
      <Card className="mx-auto w-full max-w-lg">
        <CardHeader className="items-center">
          <Skeleton className="h-4 w-56" />
          <Skeleton className="h-3.5 w-40" />
          <Skeleton className="mt-4 h-2 w-full rounded-full" />
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-10 w-28" />
        </CardContent>
      </Card>
    </LoadingRegion>
  );
}
