import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import {
  CardsRowSkeleton,
  ListSkeleton,
  LoadingRegion,
  PageHeaderSkeleton,
  TableSkeleton,
} from "./skeletons";

const meta = {
  title: "Data/Skeletons",
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="max-w-5xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** A tile, a title with its context line, and one action: the header of a page. */
export const PageHeader: Story = {
  render: () => <PageHeaderSkeleton />,
};

/** Three cards unless `count` says otherwise, on a grid that wraps by itself, 14 rem a card at the least. Each card is a stat card without a trend: 92 px tall, where one with a trend is 114 px. */
export const CardsRow: Story = {
  render: () => <CardsRowSkeleton />,
};

/** Four cards on the columns of the dashboard, which the page passes as `className` and which replace the grid that wraps by itself: one column, two from `sm`, four from `lg`. Resize the window against the Dashboard story of `Data/StatCard`: the cards fall on the same lines. */
export const FourCards: Story = {
  render: () => (
    <CardsRowSkeleton count={4} className="sm:grid-cols-2 lg:grid-cols-4" />
  ),
};

/** Four rows of 56 px, in the card the real list sits in. */
export const List: Story = {
  decorators: [
    (Story) => (
      <div className="max-w-lg">
        <Story />
      </div>
    ),
  ],
  render: () => (
    <Card>
      <CardHeader>
        <CardTitle>Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <ListSkeleton />
      </CardContent>
    </Card>
  ),
};

/** Five rows of four columns: the surface, the header and the rows of the data table. */
export const Table: Story = {
  render: () => <TableSkeleton />,
};

/** Fewer rows and more columns. */
export const TableWithOptions: Story = {
  render: () => <TableSkeleton rows={3} columns={6} />,
};

/**
 * What a route's `loading.tsx` shows: the pieces one under the other, each at the
 * size of what replaces it. `LoadingRegion` is the busy region around them: it
 * says "Loading" once to a screen reader, and the skeletons that are its direct
 * children keep quiet (it hands them `announce={false}`). A piece on its own
 * announces by itself, and one nested deeper than a direct child takes
 * `announce={false}` by hand.
 */
export const WholePage: Story = {
  render: () => (
    <LoadingRegion className="space-y-6">
      <PageHeaderSkeleton />
      <CardsRowSkeleton className="sm:grid-cols-2 lg:grid-cols-4" count={4} />
      <TableSkeleton />
    </LoadingRegion>
  ),
};
