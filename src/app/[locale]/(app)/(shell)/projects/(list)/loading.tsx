import {
  CardsRowSkeleton,
  LoadingRegion,
  PageHeaderSkeleton,
} from "@/shared/components/data/skeletons";

// The list of the projects as it will be: its header, and the cards on the
// columns of the grid (one, two from `sm`, three from `lg`). This file is in a
// route group, beside `[projectId]`, and not in `projects/`: a loading boundary
// above `[projectId]/layout.tsx` would stream the `notFound()` of that layout
// with a status of 200, and an unknown project would no longer answer 404.
export default function ProjectsLoading() {
  return (
    <LoadingRegion className="space-y-6">
      <PageHeaderSkeleton />
      <CardsRowSkeleton
        count={6}
        className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
      />
    </LoadingRegion>
  );
}
