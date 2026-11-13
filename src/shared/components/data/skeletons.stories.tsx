import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { ShellQuota } from "@/shared/shell/view";
import { FolderIcon, HardDriveIcon, UsersIcon, ZapIcon } from "lucide-react";

import { expect } from "storybook/test";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { QuotaCard } from "./quota-card";
import {
  CardsRowSkeleton,
  EntityHeaderSkeleton,
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

/** With `tabs`, a strip of that many tabs under the header, as the settings pages have: 44 px high on its hairline, each tab the width of a label, in a few widths. */
export const PageHeaderWithTabs: Story = {
  render: () => <PageHeaderSkeleton tabs={5} />,
};

/** A breadcrumb, a title with its description, and one action: the header of the page of an entity, drawn to the size of `EntityHeader`. */
export const EntityHeader: Story = {
  render: () => <EntityHeaderSkeleton />,
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

/** The quota cards of the home, four on its columns (one, two from `sm`, four from `xl`): the variant `quota` draws the tile and the name, the figure and the bar of a `QuotaCard` in its ordinary state, 156 px tall where a stat card is 92 px, and 164 px from `xl`, where the longest name wraps onto a second line. A quota that is running low or at its limit adds a badge and the way up, and is 36 px taller. */
export const QuotaCards: Story = {
  render: () => (
    <CardsRowSkeleton
      variant="quota"
      count={4}
      className="grid-cols-1 sm:grid-cols-2 xl:grid-cols-4"
    />
  ),
};

// The four quotas of the shell, as it hands them over: the icon already drawn,
// the label already translated, every one with room left.
const QUOTAS = [
  { id: "projects", label: "Projects", used: 12, limit: 50, icon: <FolderIcon aria-hidden="true" />, tone: 1 },
  { id: "members", label: "Members", used: 3, limit: 10, icon: <UsersIcon aria-hidden="true" />, tone: 2 },
  { id: "storage", label: "Storage", used: 120, limit: 10_000, unit: "megabyte", icon: <HardDriveIcon aria-hidden="true" />, tone: 3 },
  { id: "aiCredits", label: "AI credits this month", used: 410, limit: 5000, icon: <ZapIcon aria-hidden="true" />, tone: 4 },
] satisfies Omit<ShellQuota, "status" | "upgradeHref">[];

/**
 * The quota skeleton and the real quota cards, one row over the other, on the
 * columns of the home: each row is as tall as its own content makes it, and the
 * play measures them at the width of the window the story is in. They are as
 * tall as one another, at 390 px (one column) as at 1280 px (four across, where
 * the longest name wraps), and that is what keeps the home from moving when its
 * quotas arrive.
 */
export const QuotaRowHeight: Story = {
  render: () => (
    <div className="space-y-6">
      <CardsRowSkeleton
        variant="quota"
        count={4}
        className="grid-cols-1 sm:grid-cols-2 xl:grid-cols-4"
      />
      <ul role="list" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {QUOTAS.map((quota) => (
          <li key={quota.id}>
            <QuotaCard quota={{ ...quota, status: "ok", upgradeHref: null }} />
          </li>
        ))}
      </ul>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const height = (selector: string) =>
      canvasElement.querySelector<HTMLElement>(selector)?.getBoundingClientRect().height ?? 0;
    const skeleton = height('[data-slot="cards-row-skeleton"]');
    const real = height('ul[role="list"]');

    await expect(skeleton).toBeGreaterThan(0);
    await expect(Math.abs(skeleton - real)).toBeLessThanOrEqual(1);
  },
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

/**
 * What the `loading.tsx` of an entity route shows when its page draws the header
 * itself: the header of the entity, then the list or the cards of the page.
 * `LoadingRegion` knows `EntityHeaderSkeleton` as it knows the other pieces, and
 * says "Loading" once. A route whose layout draws the header, as a project's
 * does, is already under it while the page loads: its `loading.tsx` is the page
 * alone, or the header would be drawn twice.
 */
export const WholeEntityPage: Story = {
  render: () => (
    <LoadingRegion className="space-y-6">
      <EntityHeaderSkeleton />
      <Card>
        <CardContent>
          <ListSkeleton announce={false} />
        </CardContent>
      </Card>
    </LoadingRegion>
  ),
};
