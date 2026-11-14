import type { Decorator, Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import { LimitNotice } from "./limit-notice";

const stayHere: Decorator = (Story) => (
  <div
    onClickCapture={(event) => {
      if ((event.target as HTMLElement).closest("a")) {
        event.preventDefault();
      }
    }}
  >
    <Story />
  </div>
);

const meta = {
  title: "Data/LimitNotice",
  component: LimitNotice,
  tags: ["autodocs"],
  decorators: [stayHere],
  args: {
    feature: "More projects",
    limit: { key: "projects", limit: 3, used: 3, planId: "free", planName: "Free", includedIn: "Pro", upgradeHref: "/settings/billing" },
  },
  parameters: { layout: "centered" },
} satisfies Meta<typeof LimitNotice>;

export default meta;
type Story = StoryObj<typeof meta>;

/** What a form says when the server refused it for a limit of the plan: the lock, as a line, with the way to the plans. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText("More projects")).toBeVisible();
    await expect(canvas.getByText(/Included in the Pro plan/)).toBeVisible();
    await expect(canvas.getByRole("link", { name: "See the plans" })).toHaveAttribute("href", "/en/settings/billing");
  },
};

/** A role that cannot buy has no link: it is told to ask. */
export const AskAnAdmin: Story = {
  args: { limit: { key: "projects", limit: 3, used: 3, planId: "free", planName: "Free", includedIn: "Pro", upgradeHref: null } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole("link")).toBeNull();
    await expect(within(canvasElement).getByRole("alert")).toHaveTextContent("Ask an owner or an admin");
  },
};

/** The highest plan has nothing above it. */
export const HighestPlan: Story = {
  args: { limit: { key: "projects", limit: 500, used: 500, planId: "top", planName: "Top", includedIn: null, upgradeHref: null } },
};
