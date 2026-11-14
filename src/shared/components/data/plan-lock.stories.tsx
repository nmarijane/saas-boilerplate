import type { Decorator, Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import { PlanLock } from "./plan-lock";

// A story must not leave the page when the link is followed.
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
  title: "Data/PlanLock",
  component: PlanLock,
  tags: ["autodocs"],
  decorators: [stayHere],
  args: {
    variant: "card",
    feature: "More projects",
    planName: "Pro",
    description: "Your plan has room for 3 projects.",
    href: "/settings/billing",
  },
  parameters: { layout: "centered" },
} satisfies Meta<typeof PlanLock>;

export default meta;
type Story = StoryObj<typeof meta>;

/** In a grid of cards: the feature, the plan that includes it, one button to the plans. */
export const Card: Story = {
  decorators: [(Story) => <div className="w-80"><Story /></div>],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText("Included in the Pro plan")).toBeVisible();
    await expect(canvas.getByRole("link", { name: "See the plans" })).toHaveAttribute("href", "/en/settings/billing");
  },
};

/** Inside a form or a dialog: one line, with a link instead of a button. */
export const Line: Story = {
  args: { variant: "line", description: undefined },
};

/** A whole page the plan does not include: the title is the page's heading. */
export const Page: Story = {
  args: { variant: "page", headingLevel: 1, feature: "The API", description: "Create keys and call the API from your own tools." },
  decorators: [(Story) => <div className="w-[36rem] max-w-full"><Story /></div>],
};

/** A role that cannot buy has no link: it is told to ask. */
export const AskAnAdmin: Story = {
  args: { href: null },
  decorators: [(Story) => <div className="w-80"><Story /></div>],
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(/Ask an owner or an admin/)).toBeVisible();
    await expect(within(canvasElement).queryByRole("link")).toBeNull();
  },
};

/** The highest plan has nothing above it to say. */
export const NoPlanAbove: Story = {
  args: { planName: undefined },
  decorators: [(Story) => <div className="w-80"><Story /></div>],
};
