import type { Decorator, Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  ActivityIcon,
  CreditCardIcon,
  FolderIcon,
  UsersIcon,
} from "lucide-react";

import { StatCard } from "./stat-card";

const meta = {
  title: "Data/StatCard",
  component: StatCard,
  tags: ["autodocs"],
  argTypes: {
    icon: { control: false },
  },
  args: { title: "Members", value: 1284, icon: UsersIcon },
} satisfies Meta<typeof StatCard>;

export default meta;
type Story = StoryObj<typeof meta>;

// One card in a column, as it sits in a grid of four.
const oneCard: Decorator[] = [
  (Story) => (
    <div className="max-w-xs">
      <Story />
    </div>
  ),
];

/** A figure, in a monospace face with tabular figures, and its icon in a tinted tile. */
export const Default: Story = {
  decorators: oneCard,
};

/** A rise: the sign and the success color say it together. */
export const WithTrend: Story = {
  decorators: oneCard,
  args: { trend: { value: 12, positive: true } },
};

/** A fall: the sign and the danger color say it together. */
export const WithNegativeTrend: Story = {
  decorators: oneCard,
  args: {
    title: "Active projects",
    value: 48,
    trend: { value: -4, positive: false },
  },
};

/** The sign says which way the figure went, the color whether that is good: more churn is "+5%" in the danger color. */
export const UnwelcomeRise: Story = {
  decorators: oneCard,
  args: {
    title: "Churn",
    value: "2.4%",
    trend: { value: 5, positive: false },
  },
};

/** ...and less churn is "−3%" in the success color. */
export const WelcomeFall: Story = {
  decorators: oneCard,
  args: {
    title: "Churn",
    value: "2.1%",
    trend: { value: -3, positive: true },
  },
};

/** The value can be a word, as the plan of a workspace. */
export const TextValue: Story = {
  decorators: oneCard,
  args: { title: "Plan", value: "Pro", icon: CreditCardIcon },
};

/** Four cards on a dashboard: the figures line up from one card to the next. */
export const Dashboard: Story = {
  render: () => (
    <div className="grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="Members"
        value={1284}
        icon={UsersIcon}
        trend={{ value: 12, positive: true }}
      />
      <StatCard title="Revenue" value="$12,480" icon={CreditCardIcon} />
      <StatCard
        title="Activity"
        value={342}
        icon={ActivityIcon}
        trend={{ value: -4, positive: false }}
      />
      <StatCard title="Projects" value={48} icon={FolderIcon} />
    </div>
  ),
};

/** French runs longer: the title wraps, and the tile keeps its size. */
export const LongTitle: Story = {
  decorators: [
    (Story) => (
      <div className="max-w-56">
        <Story />
      </div>
    ),
  ],
  args: {
    title: "Membres actifs depuis le début du mois",
    value: "12 480,00 $",
    trend: { value: 12, positive: true },
  },
};
