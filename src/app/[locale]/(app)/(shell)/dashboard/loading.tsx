import {
  CardsRowSkeleton,
  ListSkeleton,
  LoadingRegion,
  PageHeaderSkeleton,
} from "@/shared/components/data/skeletons";
import { Card, CardContent } from "@/shared/components/ui/card";

// The home as it will be: its header, the four quotas as quota cards (the
// height of the real ones) on the columns the page gives them (one, two from
// `sm`, four from `xl`), and a card of rows for what the features put under them.
export default function DashboardLoading() {
  return (
    <LoadingRegion className="space-y-6">
      <PageHeaderSkeleton />
      <CardsRowSkeleton
        variant="quota"
        count={4}
        className="grid-cols-1 sm:grid-cols-2 xl:grid-cols-4"
      />
      <Card>
        <CardContent>
          <ListSkeleton announce={false} />
        </CardContent>
      </Card>
    </LoadingRegion>
  );
}
