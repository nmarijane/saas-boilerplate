import {
  ListSkeleton,
  LoadingRegion,
} from "@/shared/components/data/skeletons";
import { Card, CardContent, CardHeader } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";

// What a project's page draws under its header: the layout has drawn the header
// and the tabs already, so this is the card of the page, with its title and its
// rows, and nothing above it (a header drawn here would be drawn twice).
export default function ProjectLoading() {
  return (
    <LoadingRegion className="space-y-6">
      <Card>
        <CardHeader>
          <Skeleton className="h-4 w-24" />
        </CardHeader>
        <CardContent>
          <ListSkeleton rows={3} announce={false} />
        </CardContent>
      </Card>
    </LoadingRegion>
  );
}
