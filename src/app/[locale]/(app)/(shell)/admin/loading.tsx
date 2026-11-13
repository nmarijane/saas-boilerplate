import {
  LoadingRegion,
  PageHeaderSkeleton,
  TableSkeleton,
} from "@/shared/components/data/skeletons";

// The pages of the administration share this one state: a header, then a table,
// which is what five of the seven draw. The metrics page draws only cards, and
// the waitlist draws two figures and a list of referrers before its table: on
// those two the table stands in for what comes under the header.
export default function AdminLoading() {
  return (
    <LoadingRegion className="space-y-6">
      <PageHeaderSkeleton />
      <TableSkeleton />
    </LoadingRegion>
  );
}
