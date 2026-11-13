import { LoadingRegion } from "@/shared/components/data/skeletons";
import { Card, CardContent, CardHeader } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";

// What the settings of a project draw under its header: the card of its form, a
// title, two fields and the button that saves. The layout has drawn the header
// and the tabs already.
export default function ProjectSettingsLoading() {
  return (
    <LoadingRegion className="space-y-6">
      <Card>
        <CardHeader>
          <Skeleton className="h-4 w-24" />
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-10 w-24" />
        </CardContent>
      </Card>
    </LoadingRegion>
  );
}
